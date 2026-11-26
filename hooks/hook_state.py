#!/usr/bin/env python3
"""Enterprise Code Factory v3.0.0 shared per-conversation hook state store.

Pure Python 3 stdlib module providing atomic, 0600-permissioned JSON state
persistence under $PLUGIN_DATA/conversations/<safe_cid>.json with:
  - Strict conversationId validation (^[A-Za-z0-9_-]{1,128}$ or SHA-256 hash)
  - Symlink rejection and canonical parent containment assertions
  - Best-effort fcntl.flock advisory locking + NamedTemporaryFile -> chmod(0600)
    -> fsync -> os.replace atomic persistence
  - Secret & ANSI sanitization before persisting or injecting diagnostics
  - Bounded payload normalization and 24-hour stale file TTL pruning
"""

from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import tempfile
import time
from typing import Any, Callable

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows fallback
    fcntl = None  # type: ignore[assignment]

SCHEMA_VERSION = 1
MAX_PENDING_FEEDBACK = 8
MAX_FEEDBACK_SUMMARY_CHARS = 600
MAX_EDITED_SOURCE_FILES = 50
MAX_FAILURE_SIGNATURE_CHARS = 256
MAX_CONTEXT_WARNED_THRESHOLDS = 16
DEFAULT_TTL_SECONDS = 86400.0
ORPHAN_TMP_TTL_SECONDS = 3600.0

CID_SAFE_RE = re.compile(r"\A[A-Za-z0-9_-]{1,128}\Z")
ANSI_ESCAPE_RE = re.compile(
    r"\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\))"
)

# Secret redaction patterns applied to all persisted and injected diagnostics.
SECRET_REDACTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"-----BEGIN\s+(?:[A-Z0-9]+\s+)?PRIVATE\s+KEY-----"
        r"[\s\S]*?"
        r"-----END\s+(?:[A-Z0-9]+\s+)?PRIVATE\s+KEY-----"
    ),
    re.compile(r"-----BEGIN\s+(?:[A-Z0-9]+\s+)?PRIVATE\s+KEY-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,}\b"),
    re.compile(r"\b[sr]k_live_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"),
    re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b", re.IGNORECASE),
    re.compile(
        r"\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?)://"
        r"[^:\s\"'`/]+:[^@\s\"'`]+@[^\s\"'`]+",
        re.IGNORECASE,
    ),
)


def _current_uid() -> str:
    if hasattr(os, "getuid"):
        try:
            return str(os.getuid())
        except OSError:
            pass
    return "user"


def sanitize_conversation_id(raw: Any) -> str:
    """Validate or deterministically hash a conversationId into a safe filename stem."""
    if not isinstance(raw, str) or not raw.strip():
        return "default"
    if CID_SAFE_RE.match(raw):
        return raw
    digest = hashlib.sha256(raw.encode("utf-8", "replace")).hexdigest()[:32]
    return f"cid-{digest}"


def sanitize_text(text: Any, max_chars: int = MAX_FEEDBACK_SUMMARY_CHARS) -> str:
    """Strip ANSI codes/null bytes, redact secrets, and bound output length."""
    if not isinstance(text, str) or not text:
        return ""
    cleaned = text.replace("\x00", "")
    cleaned = ANSI_ESCAPE_RE.sub("", cleaned)
    for pattern in SECRET_REDACTION_PATTERNS:
        cleaned = pattern.sub("[REDACTED_SECRET]", cleaned)
    cleaned = cleaned.strip()
    if max_chars > 0 and len(cleaned) > max_chars:
        if max_chars <= 3:
            return cleaned[:max_chars]
        return cleaned[: max_chars - 3].rstrip() + "..."
    return cleaned


def is_within_directory(target: pathlib.Path, root: pathlib.Path) -> bool:
    """Return True iff target resolves inside root (or equals root)."""
    try:
        resolved_target = target.resolve()
        resolved_root = root.resolve()
        resolved_target.relative_to(resolved_root)
        return True
    except (OSError, ValueError):
        return False


def resolve_project_dir(payload: dict[str, Any]) -> pathlib.Path | None:
    """Resolve the active workspace directory from hook payload cwd or workspacePaths."""
    candidates: list[str] = []
    cwd = payload.get("cwd")
    if isinstance(cwd, str) and cwd.strip():
        candidates.append(cwd.strip())
    workspace_paths = payload.get("workspacePaths")
    if isinstance(workspace_paths, list):
        for entry in workspace_paths:
            if isinstance(entry, str) and entry.strip():
                candidates.append(entry.strip())

    for raw_path in candidates:
        try:
            candidate = pathlib.Path(raw_path).expanduser()
            if candidate.exists() and candidate.is_dir():
                return candidate.resolve()
        except OSError:
            continue
    return None


def _ensure_private_dir(path: pathlib.Path) -> bool:
    """Create directory with 0700 permissions if needed, rejecting symlinks."""
    if path.is_symlink():
        return False
    try:
        path.mkdir(parents=True, exist_ok=True, mode=0o700)
        if path.is_symlink() or not path.is_dir():
            return False
        try:
            os.chmod(path, 0o700)
        except OSError:
            pass
        return True
    except OSError:
        return False


def _fallback_safe_root() -> pathlib.Path:
    uid = _current_uid()
    return pathlib.Path(tempfile.gettempdir()) / f"code-factory-safe-{uid}-{os.getpid()}"


def resolve_state_root() -> pathlib.Path:
    """Resolve and validate the state root from $PLUGIN_DATA or a UID-scoped temp dir."""
    env_root = os.environ.get("PLUGIN_DATA", "").strip()
    if env_root:
        candidate = pathlib.Path(env_root).expanduser()
    else:
        candidate = pathlib.Path(tempfile.gettempdir()) / f"code-factory-state-{_current_uid()}"

    if candidate.is_symlink() or (candidate.exists() and not candidate.is_dir()):
        candidate = _fallback_safe_root()
    if not _ensure_private_dir(candidate):
        fallback = _fallback_safe_root()
        if not _ensure_private_dir(fallback):
            raise OSError("Unable to initialize safe state root directory.")
        candidate = fallback
    return candidate


def get_conversations_dir() -> pathlib.Path:
    """Return the validated 0700 conversations/ directory, rejecting symlink escapes."""
    root = resolve_state_root()
    conv_dir = root / "conversations"
    if conv_dir.is_symlink() or (conv_dir.exists() and not conv_dir.is_dir()):
        safe_root = _fallback_safe_root()
        if not _ensure_private_dir(safe_root):
            raise OSError("Unable to initialize fallback safe state root.")
        conv_dir = safe_root / "conversations"
    if not _ensure_private_dir(conv_dir):
        raise OSError("Unable to initialize private conversations directory.")
    return conv_dir


def get_state_path(conversation_id: Any) -> tuple[str, pathlib.Path]:
    """Resolve (safe_cid, target_json_path) with strict parent containment."""
    safe_cid = sanitize_conversation_id(conversation_id)
    conv_dir = get_conversations_dir()
    target = conv_dir / f"{safe_cid}.json"
    if target.is_symlink():
        raise OSError(f"Refusing to follow symlinked state file: {target}")
    if target.resolve().parent != conv_dir.resolve():
        raise ValueError("Resolved state path escaped conversations directory.")
    return safe_cid, target


def default_state(conversation_id: str, now: float | None = None) -> dict[str, Any]:
    """Return a fresh Schema v1 state object."""
    ts = float(time.time() if now is None else now)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "conversationId": sanitize_conversation_id(conversation_id),
        "updatedAt": ts,
        "pendingFeedback": [],
        "lastFailureSignature": "",
        "consecutiveFailures": 0,
        "editedSourceFiles": [],
        "needsVerification": False,
        "lastVerifiedAt": None,
        "lastVerificationCommand": None,
        "contextWarnedThresholds": [],
        "stopContinuationCount": 0,
    }


def normalize_state(
    raw: Any, conversation_id: str, now: float | None = None
) -> dict[str, Any]:
    """Normalize and enforce all Spec Section 3.1 bounds on a state dictionary."""
    safe_cid = sanitize_conversation_id(conversation_id)
    base = default_state(safe_cid, now=now)
    if not isinstance(raw, dict):
        return base

    updated_at = raw.get("updatedAt")
    if isinstance(updated_at, (int, float)) and not isinstance(updated_at, bool):
        base["updatedAt"] = float(updated_at)

    raw_feedback = raw.get("pendingFeedback")
    if isinstance(raw_feedback, list):
        cleaned_feedback: list[dict[str, Any]] = []
        for item in raw_feedback:
            if not isinstance(item, dict):
                continue
            summary = sanitize_text(
                item.get("summary", ""), max_chars=MAX_FEEDBACK_SUMMARY_CHARS
            )
            if not summary:
                continue
            ts_val = item.get("timestamp")
            item_ts = (
                float(ts_val)
                if isinstance(ts_val, (int, float)) and not isinstance(ts_val, bool)
                else base["updatedAt"]
            )
            cleaned_feedback.append(
                {
                    "toolName": sanitize_text(item.get("toolName", ""), max_chars=64),
                    "filePath": sanitize_text(item.get("filePath", ""), max_chars=260),
                    "status": sanitize_text(item.get("status", "error"), max_chars=32)
                    or "error",
                    "checker": sanitize_text(item.get("checker", ""), max_chars=64),
                    "summary": summary,
                    "timestamp": item_ts,
                }
            )
        base["pendingFeedback"] = cleaned_feedback[-MAX_PENDING_FEEDBACK:]

    sig = raw.get("lastFailureSignature")
    if isinstance(sig, str):
        base["lastFailureSignature"] = sanitize_text(
            sig, max_chars=MAX_FAILURE_SIGNATURE_CHARS
        )

    failures = raw.get("consecutiveFailures")
    if isinstance(failures, int) and not isinstance(failures, bool) and failures >= 0:
        base["consecutiveFailures"] = failures

    raw_files = raw.get("editedSourceFiles")
    if isinstance(raw_files, list):
        deduped: list[str] = []
        seen: set[str] = set()
        for entry in raw_files:
            if not isinstance(entry, str):
                continue
            cleaned_path = sanitize_text(entry, max_chars=260)
            if cleaned_path and cleaned_path not in seen:
                seen.add(cleaned_path)
                deduped.append(cleaned_path)
                if len(deduped) >= MAX_EDITED_SOURCE_FILES:
                    break
        base["editedSourceFiles"] = deduped

    if isinstance(raw.get("needsVerification"), bool):
        base["needsVerification"] = raw["needsVerification"]

    last_verified_at = raw.get("lastVerifiedAt")
    if isinstance(last_verified_at, (int, float)) and not isinstance(
        last_verified_at, bool
    ):
        base["lastVerifiedAt"] = float(last_verified_at)

    last_ver_cmd = raw.get("lastVerificationCommand")
    if isinstance(last_ver_cmd, str) and last_ver_cmd.strip():
        base["lastVerificationCommand"] = sanitize_text(last_ver_cmd, max_chars=256)

    raw_thresholds = raw.get("contextWarnedThresholds")
    if isinstance(raw_thresholds, list):
        thresholds: list[int] = []
        seen_t: set[int] = set()
        for val in raw_thresholds:
            if isinstance(val, int) and not isinstance(val, bool) and val > 0:
                if val not in seen_t:
                    seen_t.add(val)
                    thresholds.append(val)
                    if len(thresholds) >= MAX_CONTEXT_WARNED_THRESHOLDS:
                        break
        base["contextWarnedThresholds"] = thresholds

    stop_count = raw.get("stopContinuationCount")
    if isinstance(stop_count, int) and not isinstance(stop_count, bool) and stop_count >= 0:
        base["stopContinuationCount"] = stop_count

    return base


def _read_state_unlocked(
    safe_cid: str, target: pathlib.Path, now: float | None = None
) -> dict[str, Any]:
    if not target.exists():
        return default_state(safe_cid, now=now)
    if target.is_symlink() or not target.is_file():
        return default_state(safe_cid, now=now)
    try:
        raw_text = target.read_text(encoding="utf-8", errors="replace")
        parsed = json.loads(raw_text)
    except (OSError, json.JSONDecodeError, ValueError):
        return default_state(safe_cid, now=now)
    return normalize_state(parsed, safe_cid, now=now)


def _write_state_unlocked(
    safe_cid: str,
    target: pathlib.Path,
    state: dict[str, Any],
    now: float | None = None,
) -> dict[str, Any]:
    conv_dir = target.parent
    if target.is_symlink():
        raise OSError(f"Refusing to overwrite symlinked state file: {target}")
    if target.resolve().parent != conv_dir.resolve():
        raise ValueError("Target state file escaped conversations directory.")

    ts = float(time.time() if now is None else now)
    normalized = normalize_state(state, safe_cid, now=ts)
    normalized["updatedAt"] = ts
    serialized = json.dumps(normalized, indent=2, sort_keys=False) + "\n"

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=str(conv_dir),
            prefix=f".{safe_cid}.",
            suffix=".tmp",
            mode="w",
            encoding="utf-8",
            delete=False,
        ) as tmp_file:
            tmp_path = tmp_file.name
            tmp_file.write(serialized)
            tmp_file.flush()
            try:
                os.fsync(tmp_file.fileno())
            except OSError:
                pass
        try:
            os.chmod(tmp_path, 0o600)
        except OSError:
            pass
        os.replace(tmp_path, target)
        tmp_path = None
    finally:
        if tmp_path is not None:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return normalized


def load_state(conversation_id: Any, now: float | None = None) -> dict[str, Any]:
    """Load and normalize state for conversation_id, failing gracefully to defaults."""
    safe_cid = sanitize_conversation_id(conversation_id)
    try:
        safe_cid, target = get_state_path(safe_cid)
        return _read_state_unlocked(safe_cid, target, now=now)
    except (OSError, ValueError):
        return default_state(safe_cid, now=now)


def save_state(
    conversation_id: Any, state: dict[str, Any], now: float | None = None
) -> dict[str, Any]:
    """Atomically write normalized 0600 state for conversation_id."""
    safe_cid, target = get_state_path(conversation_id)
    return _write_state_unlocked(safe_cid, target, state, now=now)


def update_state(
    conversation_id: Any,
    mutator: Callable[[dict[str, Any]], Any],
    now: float | None = None,
) -> tuple[dict[str, Any], Any]:
    """Atomically read-modify-write conversation state under an advisory file lock."""
    safe_cid = sanitize_conversation_id(conversation_id)
    try:
        safe_cid, target = get_state_path(safe_cid)
    except (OSError, ValueError):
        fallback = default_state(safe_cid, now=now)
        result = mutator(fallback)
        return normalize_state(fallback, safe_cid, now=now), result

    lock_path = target.parent / f"{safe_cid}.lock"
    lock_fd: int | None = None
    try:
        if not lock_path.is_symlink():
            flags = os.O_CREAT | os.O_RDWR
            if hasattr(os, "O_NOFOLLOW"):
                flags |= os.O_NOFOLLOW
            try:
                lock_fd = os.open(str(lock_path), flags, 0o600)
                if fcntl is not None:
                    fcntl.flock(lock_fd, fcntl.LOCK_EX)
            except OSError:
                if lock_fd is not None:
                    try:
                        os.close(lock_fd)
                    except OSError:
                        pass
                    lock_fd = None

        state = _read_state_unlocked(safe_cid, target, now=now)
        result = mutator(state)
        try:
            saved = _write_state_unlocked(safe_cid, target, state, now=now)
        except (OSError, ValueError):
            saved = normalize_state(state, safe_cid, now=now)
        return saved, result
    finally:
        if lock_fd is not None:
            try:
                if fcntl is not None:
                    fcntl.flock(lock_fd, fcntl.LOCK_UN)
            except OSError:
                pass
            try:
                os.close(lock_fd)
            except OSError:
                pass


def prune_stale_states(
    max_age_seconds: float = DEFAULT_TTL_SECONDS,
    now: float | None = None,
    max_scan: int = 200,
) -> int:
    """Remove stale .json/.lock (>24h) and orphan .tmp (>1h) files from conversations/."""
    try:
        conv_dir = get_conversations_dir()
    except OSError:
        return 0

    current_time = float(time.time() if now is None else now)
    tmp_ttl = min(ORPHAN_TMP_TTL_SECONDS, max_age_seconds)
    removed = 0
    scanned = 0

    try:
        entries = list(os.scandir(conv_dir))
    except OSError:
        return 0

    for entry in entries:
        if scanned >= max_scan:
            break
        scanned += 1
        try:
            if entry.is_symlink() or not entry.is_file(follow_symlinks=False):
                continue
            name = entry.name
            if name.endswith(".tmp"):
                ttl = tmp_ttl
            elif name.endswith(".json") or name.endswith(".lock"):
                ttl = max_age_seconds
            else:
                continue
            st = entry.stat(follow_symlinks=False)
            age = current_time - st.st_mtime
            if age > ttl:
                os.unlink(entry.path)
                removed += 1
        except OSError:
            continue

    return removed
