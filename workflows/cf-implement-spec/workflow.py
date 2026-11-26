"""Enterprise Code Factory Stage 3 Partitioned Spec Implementer.

Self-contained top-level-await workflow script (zero local repo imports).
Validates <= 5 strictly disjoint file partitions, executes parallel builders,
detects out-of-scope edits, and runs verification with ToolError.denied handling.
"""
# ruff: noqa: F821

from __future__ import annotations

from collections import deque
import json
import pathlib
import re
from typing import Any

_ALLOWED_ROOT_KEYS = frozenset(
    {"spec_path", "verify_cmd", "worker_workspace", "partitions"}
)
_ALLOWED_PART_KEYS = frozenset(
    {
        "id",
        "role",
        "type_name",
        "model",
        "owned_files",
        "forbidden_files",
        "instructions",
    }
)
_PART_ID_RE = re.compile(r"\A[a-z0-9-]+\Z")
_WIN_DRIVE_RE = re.compile(r"\A[A-Za-z]:")
_ALLOWED_WORKSPACES = frozenset({"share", "branch"})
_ALLOWED_TYPES = frozenset({"cf-backend", "cf-frontend", "cf-tester", "self"})
_ALLOWED_MODELS = frozenset({"inherit", "flash", "flash_lite", "pro"})


def _normalize_repo_path(raw: str, field_name: str) -> str:
    if not isinstance(raw, str) or not raw.strip() or "\x00" in raw:
        raise ValueError(f"{field_name} must be a non-empty relative path")
    if "\\" in raw:
        raise ValueError(f"{field_name} must use POSIX '/' separators: {raw!r}")
    stripped = raw.strip()
    if stripped.startswith("/") or _WIN_DRIVE_RE.match(stripped):
        raise ValueError(f"{field_name} must be relative, got absolute path: {raw!r}")
    is_dir = stripped.endswith("/")
    posix = pathlib.PurePosixPath(stripped)
    if posix.is_absolute() or ".." in posix.parts:
        raise ValueError(f"{field_name} must not traverse with '..': {raw!r}")
    norm = posix.as_posix()
    if norm in ("", "."):
        raise ValueError(f"{field_name} cannot be '.'")
    if is_dir and not norm.endswith("/"):
        norm = f"{norm}/"
    return norm


_ClassSpec = tuple[bool, frozenset[str], tuple[tuple[str, str], ...]]


def _tokenize_glob_segment(seg: str) -> list[tuple[str, Any]]:
    tokens: list[tuple[str, Any]] = []
    idx = 0
    length = len(seg)
    while idx < length:
        ch = seg[idx]
        if ch == "*":
            if not tokens or tokens[-1][0] != "star":
                tokens.append(("star", None))
            idx += 1
        elif ch == "?":
            tokens.append(("any", None))
            idx += 1
        elif ch == "[":
            end = idx + 1
            if end < length and seg[end] in ("!", "^"):
                end += 1
            if end < length and seg[end] == "]":
                end += 1
            while end < length and seg[end] != "]":
                end += 1
            if end >= length:
                tokens.append(("lit", "["))
                idx += 1
            else:
                inner = seg[idx + 1 : end]
                negated = False
                if inner and inner[0] in ("!", "^"):
                    negated = True
                    inner = inner[1:]
                chars: set[str] = set()
                ranges: list[tuple[str, str]] = []
                k = 0
                while k < len(inner):
                    if k + 2 < len(inner) and inner[k + 1] == "-":
                        lo, hi = inner[k], inner[k + 2]
                        if lo <= hi:
                            ranges.append((lo, hi))
                        k += 3
                    else:
                        chars.add(inner[k])
                        k += 1
                tokens.append(("class", (negated, frozenset(chars), tuple(ranges))))
                idx = end + 1
        else:
            tokens.append(("lit", ch))
            idx += 1
    return tokens


def _char_in_class(ch: str, spec: _ClassSpec) -> bool:
    if ch == "/":
        return False
    negated, chars, ranges = spec
    matched = ch in chars or any(lo <= ch <= hi for lo, hi in ranges)
    return (not matched) if negated else matched


def _class_candidates(spec: _ClassSpec) -> list[str]:
    _, chars, ranges = spec
    out = list(chars)
    for lo, hi in ranges:
        out.append(lo)
        out.append(hi)
        mid = chr((ord(lo) + ord(hi)) // 2)
        out.append(mid)
    return out


def _class_non_empty(spec: _ClassSpec) -> bool:
    if spec[0]:
        return True
    return any(_char_in_class(c, spec) for c in _class_candidates(spec))


def _classes_intersect(spec_a: _ClassSpec, spec_b: _ClassSpec) -> bool:
    if spec_a[0] and spec_b[0]:
        return True
    probes = (
        _class_candidates(spec_a)
        + _class_candidates(spec_b)
        + [chr(c) for c in range(32, 127) if c != 47]
        + ["\u00e9"]
    )
    return any(_char_in_class(c, spec_a) and _char_in_class(c, spec_b) for c in probes)


def _tokens_match_common_char(tok_a: tuple[str, Any], tok_b: tuple[str, Any]) -> bool:
    kind_a, val_a = tok_a
    kind_b, val_b = tok_b
    if kind_a == "lit" and kind_b == "lit":
        return val_a == val_b
    if kind_a == "lit":
        return kind_b in ("any", "star") or (
            kind_b == "class" and _char_in_class(val_a, val_b)
        )
    if kind_b == "lit":
        return kind_a in ("any", "star") or (
            kind_a == "class" and _char_in_class(val_b, val_a)
        )
    if kind_a in ("any", "star") and kind_b in ("any", "star"):
        return True
    if kind_a == "class" and kind_b in ("any", "star"):
        return _class_non_empty(val_a)
    if kind_b == "class" and kind_a in ("any", "star"):
        return _class_non_empty(val_b)
    return _classes_intersect(val_a, val_b)


def _segments_intersect_tokens(
    toks_a: list[tuple[str, Any]], toks_b: list[tuple[str, Any]]
) -> bool:
    len_a = len(toks_a)
    len_b = len(toks_b)
    start = (0, 0, False)
    queue: deque[tuple[int, int, bool]] = deque([start])
    visited: set[tuple[int, int, bool]] = {start}

    while queue:
        i, j, non_empty = queue.popleft()
        if i == len_a and j == len_b and non_empty:
            return True

        if i < len_a and toks_a[i][0] == "star":
            nxt = (i + 1, j, non_empty)
            if nxt not in visited:
                visited.add(nxt)
                queue.append(nxt)
        if j < len_b and toks_b[j][0] == "star":
            nxt = (i, j + 1, non_empty)
            if nxt not in visited:
                visited.add(nxt)
                queue.append(nxt)

        if i < len_a and j < len_b:
            if _tokens_match_common_char(toks_a[i], toks_b[j]):
                next_i = i if toks_a[i][0] == "star" else i + 1
                next_j = j if toks_b[j][0] == "star" else j + 1
                nxt = (next_i, next_j, True)
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append(nxt)
    return False


def _split_pattern_segments(pat: str) -> list[str]:
    if pat.endswith("/"):
        raw_segs = [s for s in pat[:-1].split("/") if s] + ["**"]
    else:
        raw_segs = [s for s in pat.split("/") if s]
    collapsed: list[str] = []
    for seg in raw_segs:
        if seg == "**" and collapsed and collapsed[-1] == "**":
            continue
        collapsed.append(seg)
    return collapsed


def _paths_overlap(pat_a: str, pat_b: str) -> bool:
    if pat_a == pat_b:
        return True
    segs_a = _split_pattern_segments(pat_a)
    segs_b = _split_pattern_segments(pat_b)
    toks_a = [None if s == "**" else _tokenize_glob_segment(s) for s in segs_a]
    toks_b = [None if s == "**" else _tokenize_glob_segment(s) for s in segs_b]
    star_seg: list[tuple[str, Any]] = [("star", None)]

    len_a = len(toks_a)
    len_b = len(toks_b)
    queue: deque[tuple[int, int]] = deque([(0, 0)])
    visited: set[tuple[int, int]] = {(0, 0)}

    while queue:
        i, j = queue.popleft()
        if i == len_a and j == len_b:
            return True

        if i < len_a and toks_a[i] is None:
            if (i + 1, j) not in visited:
                visited.add((i + 1, j))
                queue.append((i + 1, j))
            if j < len_b and toks_b[j] is not None:
                if _segments_intersect_tokens(star_seg, toks_b[j]):
                    if (i, j + 1) not in visited:
                        visited.add((i, j + 1))
                        queue.append((i, j + 1))

        if j < len_b and toks_b[j] is None:
            if (i, j + 1) not in visited:
                visited.add((i, j + 1))
                queue.append((i, j + 1))
            if i < len_a and toks_a[i] is not None:
                if _segments_intersect_tokens(toks_a[i], star_seg):
                    if (i + 1, j) not in visited:
                        visited.add((i + 1, j))
                        queue.append((i + 1, j))

        if i < len_a and j < len_b:
            if toks_a[i] is None and toks_b[j] is None:
                if (i + 1, j + 1) not in visited:
                    visited.add((i + 1, j + 1))
                    queue.append((i + 1, j + 1))
            elif toks_a[i] is not None and toks_b[j] is not None:
                if _segments_intersect_tokens(toks_a[i], toks_b[j]):
                    if (i + 1, j + 1) not in visited:
                        visited.add((i + 1, j + 1))
                        queue.append((i + 1, j + 1))
    return False


def assert_disjoint_partitions(partitions: list[dict[str, Any]]) -> None:
    """Ensure <= 5 partitions with unique IDs and strictly disjoint owned_files."""
    if not isinstance(partitions, list) or not (1 <= len(partitions) <= 5):
        raise ValueError("partitions must contain between 1 and 5 items")

    seen_ids: set[str] = set()
    claimed: list[tuple[str, str]] = []

    for part in partitions:
        pid = part["id"]
        if pid in seen_ids:
            raise ValueError(f"Duplicate partition id: {pid!r}")
        seen_ids.add(pid)

        local_seen: set[str] = set()
        for raw_path in part["owned_files"]:
            norm = _normalize_repo_path(raw_path, f"partitions[{pid}].owned_files")
            if norm in local_seen:
                raise ValueError(f"Duplicate owned_files entry {norm!r} in partition {pid!r}")
            local_seen.add(norm)
            for prev_pid, prev_path in claimed:
                if _paths_overlap(prev_path, norm):
                    raise ValueError(
                        f"Overlapping owned_files between '{prev_pid}' ({prev_path!r}) "
                        f"and '{pid}' ({norm!r})"
                    )
            claimed.append((pid, norm))


def validate_implement_args(raw_args: Any) -> dict[str, Any]:
    """Fail-closed validation matching workflows/cf-implement-spec/workflow.json."""
    if not isinstance(raw_args, dict):
        raise ValueError("args must be a JSON object")

    unknown = sorted(set(raw_args.keys()) - _ALLOWED_ROOT_KEYS)
    if unknown:
        raise ValueError(f"Unsupported arg(s): {', '.join(unknown)}")

    spec_path = _normalize_repo_path(raw_args.get("spec_path", ""), "spec_path")

    verify_cmd = raw_args.get("verify_cmd")
    if (
        not isinstance(verify_cmd, str)
        or not verify_cmd.strip()
        or len(verify_cmd) > 400
    ):
        raise ValueError("verify_cmd must be a non-empty string (<= 400 chars)")

    worker_ws = raw_args.get("worker_workspace", "share")
    if not isinstance(worker_ws, str) or worker_ws not in _ALLOWED_WORKSPACES:
        raise ValueError("worker_workspace must be 'share' or 'branch'")

    raw_parts = raw_args.get("partitions")
    if not isinstance(raw_parts, list) or not (1 <= len(raw_parts) <= 5):
        raise ValueError("partitions must be a list of 1..5 objects")

    normalized_parts: list[dict[str, Any]] = []
    for idx, part in enumerate(raw_parts):
        if not isinstance(part, dict):
            raise ValueError(f"partitions[{idx}] must be an object")
        unknown_p = sorted(set(part.keys()) - _ALLOWED_PART_KEYS)
        if unknown_p:
            raise ValueError(
                f"Unsupported field(s) in partitions[{idx}]: {', '.join(unknown_p)}"
            )

        pid = part.get("id")
        if not isinstance(pid, str) or not _PART_ID_RE.match(pid):
            raise ValueError(f"partitions[{idx}].id must match ^[a-z0-9-]+$")

        role = part.get("role")
        if not isinstance(role, str) or not (1 <= len(role.strip()) <= 80):
            raise ValueError(f"partitions[{pid}].role must be 1..80 chars")

        type_name = part.get("type_name", "self")
        if not isinstance(type_name, str) or type_name not in _ALLOWED_TYPES:
            raise ValueError(f"partitions[{pid}].type_name invalid: {type_name!r}")

        model = part.get("model", "inherit")
        if not isinstance(model, str) or model not in _ALLOWED_MODELS:
            raise ValueError(f"partitions[{pid}].model invalid: {model!r}")

        owned = part.get("owned_files")
        if not isinstance(owned, list) or not owned:
            raise ValueError(f"partitions[{pid}].owned_files must be a non-empty list")
        norm_owned = [
            _normalize_repo_path(p, f"partitions[{pid}].owned_files") for p in owned
        ]

        forbidden = part.get("forbidden_files", [])
        if not isinstance(forbidden, list):
            raise ValueError(f"partitions[{pid}].forbidden_files must be a list")
        norm_forbidden = [
            _normalize_repo_path(p, f"partitions[{pid}].forbidden_files")
            for p in forbidden
        ]

        instructions = part.get("instructions")
        if not isinstance(instructions, str) or not instructions.strip():
            raise ValueError(f"partitions[{pid}].instructions must be non-empty")

        normalized_parts.append(
            {
                "id": pid,
                "role": role.strip(),
                "type_name": type_name,
                "model": model,
                "owned_files": norm_owned,
                "forbidden_files": norm_forbidden,
                "instructions": instructions.strip(),
            }
        )

    assert_disjoint_partitions(normalized_parts)

    return {
        "spec_path": spec_path,
        "verify_cmd": verify_cmd.strip(),
        "worker_workspace": worker_ws,
        "partitions": normalized_parts,
    }


def _matches_pattern(file_path: str, pattern: str) -> bool:
    if file_path == pattern:
        return True
    if pattern.endswith("/"):
        return file_path.startswith(pattern)
    file_segs = [s for s in file_path.split("/") if s]
    pat_segs = _split_pattern_segments(pattern)
    file_toks = [[("lit", ch) for ch in seg] for seg in file_segs]
    pat_toks = [None if s == "**" else _tokenize_glob_segment(s) for s in pat_segs]

    len_f = len(file_toks)
    len_p = len(pat_toks)
    queue: deque[tuple[int, int]] = deque([(0, 0)])
    visited: set[tuple[int, int]] = {(0, 0)}

    while queue:
        i, j = queue.popleft()
        if i == len_f and j == len_p:
            return True
        if j < len_p and pat_toks[j] is None:
            if (i, j + 1) not in visited:
                visited.add((i, j + 1))
                queue.append((i, j + 1))
            if i < len_f and (i + 1, j) not in visited:
                visited.add((i + 1, j))
                queue.append((i + 1, j))
        if i < len_f and j < len_p and pat_toks[j] is not None:
            if _segments_intersect_tokens(file_toks[i], pat_toks[j]):
                if (i + 1, j + 1) not in visited:
                    visited.add((i + 1, j + 1))
                    queue.append((i + 1, j + 1))
    return False


def detect_out_of_scope_edits(
    partitions: list[dict[str, Any]], results: list[dict[str, Any]]
) -> list[str]:
    """Identify any modified file reported outside a worker's owned_files."""
    violations: list[str] = []
    for part, res in zip(partitions, results):
        pid = part["id"]
        owned = part["owned_files"]
        forbidden = part.get("forbidden_files", [])
        if not isinstance(res, dict):
            violations.append(f"{pid}:<invalid_result>")
            continue
        modified = res.get("modified_files", [])
        if not isinstance(modified, list):
            continue
        for raw_file in modified:
            if not isinstance(raw_file, str) or not raw_file.strip():
                continue
            try:
                norm = _normalize_repo_path(raw_file, f"{pid}.modified_files")
            except ValueError:
                violations.append(f"{pid}:{raw_file}")
                continue
            in_forbidden = any(_matches_pattern(norm, fpat) for fpat in forbidden)
            in_owned = any(_matches_pattern(norm, opat) for opat in owned)
            if in_forbidden or not in_owned:
                violations.append(f"{pid}:{norm}")
    return violations


async def run_implement_spec(raw_args: Any) -> dict[str, Any]:
    """Execute Stage 3 disjoint-partition parallel spec implementation."""
    validated = validate_implement_args(raw_args)
    partitions = validated["partitions"]

    phase("Partition Validation")
    log(
        f"Validated {len(partitions)} disjoint partition(s) for spec "
        f"{validated['spec_path']} (workspace={validated['worker_workspace']})"
    )

    worker_schema = {
        "type": "object",
        "required": ["status", "modified_files", "summary"],
        "properties": {
            "status": {"type": "string", "enum": ["done", "blocked"]},
            "modified_files": {"type": "array", "items": {"type": "string"}},
            "summary": {"type": "string"},
        },
    }

    phase("Parallel Implementation")
    try:
        results = await parallel(
            partitions,
            lambda p: agent(
                prompt=(
                    f"Implement partition '{p['id']}' strictly per locked spec `{validated['spec_path']}`.\n"
                    f"Owned files (ONLY modify these): {json.dumps(p['owned_files'])}\n"
                    f"Forbidden files: {json.dumps(p['forbidden_files'])}\n"
                    f"Instructions: {p['instructions']}\n"
                    "Call `finish` with status, exact modified_files list, and concise summary."
                ),
                schema=worker_schema,
                role=f"{p['id']}: {p['role']}",
                type_name=p["type_name"],
                model=p["model"],
                workspace=validated["worker_workspace"],
            ),
        )
    except Exception as exc:
        if getattr(exc, "denied", False):
            msg = str(getattr(exc, "message", exc))
            log(f"Parallel implementation denied cleanly: {msg}")
            summary_obj = {
                "status": "verification_denied",
                "partition_results": [],
                "out_of_scope_files": [],
                "verification_passed": False,
                "verification_denied": True,
                "verification_output": msg,
            }
            log(json.dumps(summary_obj))
            print(json.dumps(summary_obj))
            return summary_obj
        raise

    out_of_scope = detect_out_of_scope_edits(partitions, results)
    if out_of_scope:
        log(f"Out-of-scope file edits detected: {json.dumps(out_of_scope)}")

    phase("Verification Gate")
    verification_passed = False
    verification_denied = False
    verification_output = ""
    try:
        verification_output = await call_tool(
            "run_command", CommandLine=validated["verify_cmd"]
        )
        verification_passed = True
    except Exception as exc:
        if getattr(exc, "denied", False):
            verification_denied = True
            verification_output = str(getattr(exc, "message", exc))
            log(f"Verification command denied cleanly: {verification_output}")
        else:
            raise

    workers_done = all(
        isinstance(r, dict) and r.get("status") == "done" for r in results
    )
    if verification_passed and not out_of_scope and workers_done:
        status = "ok"
    elif verification_denied and not out_of_scope and workers_done:
        status = "verification_denied"
    else:
        status = "failed"

    summary_obj = {
        "status": status,
        "partition_results": results,
        "out_of_scope_files": out_of_scope,
        "verification_passed": verification_passed,
        "verification_denied": verification_denied,
        "verification_output": verification_output,
    }
    log(json.dumps(summary_obj))
    print(json.dumps(summary_obj))
    return summary_obj


await run_implement_spec(args)  # noqa: F704
