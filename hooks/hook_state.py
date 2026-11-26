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
import socket
import stat
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

# Phase 2: Git-Shadow Checkpoints & Sidecar constants
MAX_CHECKPOINTS_PER_CONV = 200
MAX_CHECKPOINT_FILE_BYTES = 524288
MAX_CHECKPOINT_ID_CHARS = 64
MAX_UNTRACKED_SAMPLE = 25
MAX_UNTRACKED_PATH_CHARS = 200
SHA_RE = re.compile(r"\A[0-9a-f]{7,40}\Z")
ALLOWED_CHECKPOINT_KINDS = frozenset({"pre-turn", "pre-restore-safety"})
ALLOWED_SNAPSHOT_TYPES = frozenset(
    {
        "stash-create",
        "head",
        "unborn",
        "skipped-size-guard",
        "skipped-timeout",
    }
)

ALLOWED_SIDECAR_EVENT_TYPES = frozenset(
    {"hook_event", "memory_note", "ping", "flush"}
)
ALLOWED_SIDECAR_EVENT_NAMES = frozenset(
    {
        "session_start",
        "checkpoint_created",
        "checkpoint_restored",
        "post_tool_lint_error",
        "post_tool_lint_resolved",
        "verification_passed",
        "loop_breaker_triggered",
        "stop_gate_continued",
        "manual_lesson",
    }
)
MAX_SIDECAR_MESSAGE_BYTES = 16384
MAX_SPOOL_BYTES = 1048576
MAX_SUN_PATH_BYTES = 100
DEFAULT_SIDECAR_TIMEOUT_S = 0.008

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
    """Return a fresh Schema v1 state object (with Phase 2 turn/checkpoint fields)."""
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
        "turnEpoch": 0,
        "checkpointedTurnEpoch": -1,
        "lastInitialNumSteps": 0,
        "lastCheckpointSha": "",
        "lastCheckpointId": "",
        "lastCheckpointAt": None,
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

    turn_epoch = raw.get("turnEpoch")
    if isinstance(turn_epoch, int) and not isinstance(turn_epoch, bool) and turn_epoch >= 0:
        base["turnEpoch"] = turn_epoch

    ckpt_epoch = raw.get("checkpointedTurnEpoch")
    if isinstance(ckpt_epoch, int) and not isinstance(ckpt_epoch, bool) and ckpt_epoch >= -1:
        base["checkpointedTurnEpoch"] = ckpt_epoch

    last_steps = raw.get("lastInitialNumSteps")
    if isinstance(last_steps, int) and not isinstance(last_steps, bool) and last_steps >= 0:
        base["lastInitialNumSteps"] = last_steps

    ckpt_sha = raw.get("lastCheckpointSha")
    if isinstance(ckpt_sha, str) and SHA_RE.match(ckpt_sha):
        base["lastCheckpointSha"] = ckpt_sha

    ckpt_id = raw.get("lastCheckpointId")
    if isinstance(ckpt_id, str) and ckpt_id.strip():
        base["lastCheckpointId"] = sanitize_text(
            ckpt_id, max_chars=MAX_CHECKPOINT_ID_CHARS
        )

    ckpt_at = raw.get("lastCheckpointAt")
    if isinstance(ckpt_at, (int, float)) and not isinstance(ckpt_at, bool):
        base["lastCheckpointAt"] = float(ckpt_at)

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


def _acquire_file_lock(lock_path: pathlib.Path) -> int | None:
    """Open an O_NOFOLLOW 0600 advisory lock file and acquire LOCK_EX if supported."""
    if lock_path.is_symlink():
        return None
    flags = os.O_CREAT | os.O_RDWR
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    lock_fd: int | None = None
    try:
        lock_fd = os.open(str(lock_path), flags, 0o600)
        try:
            os.chmod(lock_path, 0o600)
        except OSError:
            pass
        if fcntl is not None:
            fcntl.flock(lock_fd, fcntl.LOCK_EX)
        return lock_fd
    except OSError:
        if lock_fd is not None:
            try:
                os.close(lock_fd)
            except OSError:
                pass
        return None


def _release_file_lock(lock_fd: int | None) -> None:
    if lock_fd is None:
        return
    try:
        if fcntl is not None:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
    except OSError:
        pass
    try:
        os.close(lock_fd)
    except OSError:
        pass


def _atomic_write_text(
    target: pathlib.Path, content: str, prefix: str = ".tmp."
) -> None:
    """Atomically write UTF-8 text to target with 0600 permissions, rejecting symlinks."""
    parent = target.parent
    if target.is_symlink():
        raise OSError(f"Refusing to overwrite symlinked file: {target}")
    if target.resolve().parent != parent.resolve():
        raise ValueError("Target file escaped parent directory.")

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=str(parent),
            prefix=prefix,
            suffix=".tmp",
            mode="w",
            encoding="utf-8",
            delete=False,
        ) as tmp_file:
            tmp_path = tmp_file.name
            tmp_file.write(content)
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


# ---------------------------------------------------------------------------
# Phase 2: Git-Shadow Checkpoints JSONL Storage
# ---------------------------------------------------------------------------


def get_checkpoints_dir() -> pathlib.Path:
    """Return the validated 0700 checkpoints/ directory, rejecting symlink escapes."""
    root = resolve_state_root()
    ckpt_dir = root / "checkpoints"
    if ckpt_dir.is_symlink() or (ckpt_dir.exists() and not ckpt_dir.is_dir()):
        safe_root = _fallback_safe_root()
        if not _ensure_private_dir(safe_root):
            raise OSError("Unable to initialize fallback safe state root.")
        ckpt_dir = safe_root / "checkpoints"
    if not _ensure_private_dir(ckpt_dir):
        raise OSError("Unable to initialize private checkpoints directory.")
    return ckpt_dir


def get_checkpoint_log_path(conversation_id: Any) -> tuple[str, pathlib.Path]:
    """Resolve (safe_cid, target_jsonl_path) with strict parent containment."""
    safe_cid = sanitize_conversation_id(conversation_id)
    ckpt_dir = get_checkpoints_dir()
    target = ckpt_dir / f"{safe_cid}.jsonl"
    if target.is_symlink():
        raise OSError(f"Refusing to follow symlinked checkpoint log: {target}")
    if target.resolve().parent != ckpt_dir.resolve():
        raise ValueError("Resolved checkpoint log path escaped checkpoints directory.")
    return safe_cid, target


def _normalize_checkpoint_record(
    safe_cid: str, record: dict[str, Any]
) -> dict[str, Any]:
    raw_kind = record.get("kind")
    kind = raw_kind if raw_kind in ALLOWED_CHECKPOINT_KINDS else "pre-turn"

    raw_snap_type = record.get("snapshotType")
    if isinstance(raw_snap_type, str) and raw_snap_type in ALLOWED_SNAPSHOT_TYPES:
        snapshot_type = raw_snap_type
    else:
        snapshot_type = sanitize_text(raw_snap_type, max_chars=32) or "unborn"

    raw_turn_epoch = record.get("turnEpoch")
    turn_epoch = (
        raw_turn_epoch
        if isinstance(raw_turn_epoch, int)
        and not isinstance(raw_turn_epoch, bool)
        and raw_turn_epoch >= 0
        else 0
    )

    raw_step_idx = record.get("stepIdx")
    step_idx = (
        raw_step_idx
        if isinstance(raw_step_idx, int)
        and not isinstance(raw_step_idx, bool)
        and raw_step_idx >= 0
        else 0
    )

    raw_ts = record.get("timestamp")
    ts = (
        float(raw_ts)
        if isinstance(raw_ts, (int, float)) and not isinstance(raw_ts, bool)
        else float(time.time())
    )

    raw_head = record.get("headSha")
    head_sha = raw_head if isinstance(raw_head, str) and SHA_RE.match(raw_head) else ""

    raw_snap_sha = record.get("snapshotSha")
    snapshot_sha = (
        raw_snap_sha
        if isinstance(raw_snap_sha, str) and SHA_RE.match(raw_snap_sha)
        else ""
    )

    raw_untracked = record.get("untrackedSample")
    untracked_sample: list[str] = []
    if isinstance(raw_untracked, list):
        for item in raw_untracked:
            if not isinstance(item, str):
                continue
            cleaned = sanitize_text(item, max_chars=MAX_UNTRACKED_PATH_CHARS)
            if cleaned:
                untracked_sample.append(cleaned)
                if len(untracked_sample) >= MAX_UNTRACKED_SAMPLE:
                    break

    raw_untracked_count = record.get("untrackedCount")
    untracked_count = (
        raw_untracked_count
        if isinstance(raw_untracked_count, int)
        and not isinstance(raw_untracked_count, bool)
        and raw_untracked_count >= len(untracked_sample)
        else len(untracked_sample)
    )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "checkpointId": sanitize_text(
            record.get("checkpointId", ""), max_chars=MAX_CHECKPOINT_ID_CHARS
        ),
        "conversationId": safe_cid,
        "kind": kind,
        "turnEpoch": turn_epoch,
        "stepIdx": step_idx,
        "timestamp": ts,
        "projectDir": sanitize_text(record.get("projectDir", ""), max_chars=400),
        "branch": sanitize_text(record.get("branch", ""), max_chars=128),
        "headSha": head_sha,
        "snapshotSha": snapshot_sha,
        "snapshotType": snapshot_type,
        "toolName": sanitize_text(record.get("toolName", ""), max_chars=64),
        "targetSummary": sanitize_text(
            record.get("targetSummary", ""), max_chars=MAX_UNTRACKED_PATH_CHARS
        ),
        "untrackedSample": untracked_sample,
        "untrackedCount": untracked_count,
    }


def _trim_jsonl_lines(
    lines: list[str], max_records: int, max_bytes: int
) -> list[str]:
    kept = lines[-max_records:] if max_records > 0 else []
    if max_bytes <= 0:
        return []
    encoded = [line.encode("utf-8") for line in kept]
    total = sum(len(b) for b in encoded)
    idx = 0
    while total > max_bytes and idx < len(kept) - 1:
        total -= len(encoded[idx])
        idx += 1
    trimmed = kept[idx:]
    if trimmed and sum(len(line.encode("utf-8")) for line in trimmed) > max_bytes:
        return []
    return trimmed


def append_checkpoint_record(
    conversation_id: Any, record: dict[str, Any]
) -> pathlib.Path:
    """Append a normalized 0600 checkpoint JSONL record under flock with size/count caps."""
    safe_cid, target = get_checkpoint_log_path(conversation_id)
    normalized = _normalize_checkpoint_record(safe_cid, dict(record or {}))
    new_line = json.dumps(normalized, separators=(",", ":")) + "\n"

    lock_path = target.parent / f"{safe_cid}.ckpt.lock"
    lock_fd = _acquire_file_lock(lock_path)
    try:
        existing_lines: list[str] = []
        if target.exists():
            if target.is_symlink() or not target.is_file():
                raise OSError(f"Invalid checkpoint log target: {target}")
            try:
                raw_text = target.read_text(encoding="utf-8", errors="replace")
                for line in raw_text.splitlines():
                    stripped = line.strip()
                    if not stripped:
                        continue
                    try:
                        parsed = json.loads(stripped)
                        if isinstance(parsed, dict):
                            existing_lines.append(
                                json.dumps(parsed, separators=(",", ":")) + "\n"
                            )
                    except json.JSONDecodeError:
                        continue
            except OSError:
                existing_lines = []

        existing_lines.append(new_line)
        bounded = _trim_jsonl_lines(
            existing_lines, MAX_CHECKPOINTS_PER_CONV, MAX_CHECKPOINT_FILE_BYTES
        )
        _atomic_write_text(target, "".join(bounded), prefix=f".{safe_cid}.ckpt.")
        return target
    finally:
        _release_file_lock(lock_fd)


def read_checkpoint_records(
    conversation_id: Any, limit: int = 20
) -> list[dict[str, Any]]:
    """Read up to the latest `limit` checkpoint records (chronological order) for conversation_id."""
    if limit <= 0:
        return []
    try:
        _, target = get_checkpoint_log_path(conversation_id)
    except (OSError, ValueError):
        return []

    if not target.exists() or target.is_symlink() or not target.is_file():
        return []

    records: list[dict[str, Any]] = []
    try:
        raw_text = target.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []

    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            records.append(parsed)

    return records[-limit:]


def list_checkpoint_files() -> list[pathlib.Path]:
    """List valid non-symlink checkpoint JSONL files sorted by modification time (newest first)."""
    try:
        ckpt_dir = get_checkpoints_dir()
    except OSError:
        return []

    items: list[tuple[float, pathlib.Path]] = []
    try:
        for entry in os.scandir(ckpt_dir):
            if entry.is_symlink() or not entry.is_file(follow_symlinks=False):
                continue
            if not entry.name.endswith(".jsonl"):
                continue
            try:
                st = entry.stat(follow_symlinks=False)
                items.append((st.st_mtime, pathlib.Path(entry.path)))
            except OSError:
                continue
    except OSError:
        return []

    items.sort(key=lambda pair: pair[0], reverse=True)
    return [path for _, path in items]


def prune_checkpoint_logs(
    max_age_hours: float = 168.0,
    max_per_conv: int = MAX_CHECKPOINTS_PER_CONV,
    dry_run: bool = False,
    now: float | None = None,
) -> dict[str, Any]:
    """Prune expired checkpoint JSONL logs and trim oversized logs."""
    summary: dict[str, Any] = {
        "dryRun": bool(dry_run),
        "scannedFiles": 0,
        "removedFiles": 0,
        "trimmedFiles": 0,
        "trimmedRecords": 0,
        "keptFiles": 0,
    }
    try:
        ckpt_dir = get_checkpoints_dir()
    except OSError:
        return summary

    current_time = float(time.time() if now is None else now)
    max_age_seconds = max(0.0, float(max_age_hours)) * 3600.0
    cap = max(1, min(int(max_per_conv), MAX_CHECKPOINTS_PER_CONV))

    try:
        entries = list(os.scandir(ckpt_dir))
    except OSError:
        return summary

    for entry in entries:
        try:
            if entry.is_symlink() or not entry.is_file(follow_symlinks=False):
                continue
            name = entry.name
            st = entry.stat(follow_symlinks=False)
            age = current_time - st.st_mtime
            if name.endswith(".tmp") and age > ORPHAN_TMP_TTL_SECONDS:
                if not dry_run:
                    os.unlink(entry.path)
                continue
            if name.endswith(".ckpt.lock") and age > max_age_seconds:
                if not dry_run:
                    os.unlink(entry.path)
                continue
            if not name.endswith(".jsonl"):
                continue

            summary["scannedFiles"] += 1
            file_path = pathlib.Path(entry.path)
            if age > max_age_seconds:
                summary["removedFiles"] += 1
                if not dry_run:
                    os.unlink(file_path)
                    stem = name[: -len(".jsonl")]
                    lock_candidate = ckpt_dir / f"{stem}.ckpt.lock"
                    if lock_candidate.exists() and not lock_candidate.is_symlink():
                        try:
                            os.unlink(lock_candidate)
                        except OSError:
                            pass
                continue

            raw_text = file_path.read_text(encoding="utf-8", errors="replace")
            valid_lines: list[str] = []
            for line in raw_text.splitlines():
                stripped = line.strip()
                if not stripped:
                    continue
                try:
                    parsed = json.loads(stripped)
                    if isinstance(parsed, dict):
                        valid_lines.append(
                            json.dumps(parsed, separators=(",", ":")) + "\n"
                        )
                except json.JSONDecodeError:
                    continue

            bounded = _trim_jsonl_lines(valid_lines, cap, MAX_CHECKPOINT_FILE_BYTES)
            if len(bounded) < len(valid_lines):
                summary["trimmedFiles"] += 1
                summary["trimmedRecords"] += len(valid_lines) - len(bounded)
                if not dry_run:
                    stem = name[: -len(".jsonl")]
                    lock_fd = _acquire_file_lock(ckpt_dir / f"{stem}.ckpt.lock")
                    try:
                        _atomic_write_text(
                            file_path, "".join(bounded), prefix=f".{stem}.ckpt."
                        )
                    finally:
                        _release_file_lock(lock_fd)
            summary["keptFiles"] += 1
        except OSError:
            continue

    return summary


# ---------------------------------------------------------------------------
# Phase 2: 0600 Unix-Socket Sidecar Paths & Fail-Open Event Emitter
# ---------------------------------------------------------------------------


def _uid_int() -> int | None:
    if hasattr(os, "getuid"):
        try:
            return int(os.getuid())
        except OSError:
            pass
    return None


def _is_safe_private_dir(
    path: pathlib.Path, expected_uid: int | None = None
) -> bool:
    try:
        if path.is_symlink():
            return False
        st = os.lstat(path)
    except OSError:
        return False
    if not stat.S_ISDIR(st.st_mode):
        return False
    if stat.S_IMODE(st.st_mode) != 0o700:
        return False
    if expected_uid is not None and st.st_uid != expected_uid:
        return False
    return True


def _is_safe_private_socket(
    path: pathlib.Path, expected_uid: int | None = None
) -> bool:
    if not _is_safe_private_dir(path.parent, expected_uid=expected_uid):
        return False
    try:
        if path.is_symlink():
            return False
        st = os.lstat(path)
    except OSError:
        return False
    if not stat.S_ISSOCK(st.st_mode):
        return False
    if stat.S_IMODE(st.st_mode) != 0o600:
        return False
    if expected_uid is not None and st.st_uid != expected_uid:
        return False
    return True


def _read_endpoint_socket(
    endpoint_path: pathlib.Path, expected_uid: int | None
) -> pathlib.Path | None:
    try:
        if endpoint_path.is_symlink() or not endpoint_path.exists():
            return None
        st = os.lstat(endpoint_path)
        if not stat.S_ISREG(st.st_mode):
            return None
        if expected_uid is not None and st.st_uid != expected_uid:
            return None
        data = json.loads(endpoint_path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    if expected_uid is not None and data.get("uid") != expected_uid:
        return None
    sock_str = data.get("socketPath")
    if isinstance(sock_str, str) and sock_str.strip():
        return pathlib.Path(sock_str.strip())
    return None


def _short_socket_path(state_root: pathlib.Path) -> pathlib.Path:
    uid_str = _current_uid()
    sha8 = hashlib.sha256(str(state_root).encode("utf-8", "replace")).hexdigest()[:8]
    bases: list[pathlib.Path] = []
    for raw_base in ("/tmp", tempfile.gettempdir()):
        try:
            p = pathlib.Path(raw_base).resolve()
            if p.exists() and p.is_dir():
                bases.append(p)
        except OSError:
            continue
    bases.sort(key=lambda b: len(str(b).encode("utf-8")))
    short_base = bases[0] if bases else pathlib.Path(tempfile.gettempdir())
    short_dir = short_base / f"cf-sc-{uid_str}"
    return short_dir / f"cf-sc-{uid_str}-{sha8}.sock"


def resolve_sidecar_paths() -> dict[str, Any]:
    """Resolve sidecar socket, endpoint metadata, spool, audit, pid, and discovery paths."""
    state_root = resolve_state_root()
    uid_int = _uid_int()

    primary_sock = state_root / "cf-sidecar.sock"
    endpoint_path = state_root / "cf-sidecar.endpoint.json"
    spool_path = state_root / "telemetry-spool.jsonl"
    audit_path = state_root / "telemetry-audit.jsonl"
    pid_path = state_root / "cf-sidecar.pid"

    env_sock = os.environ.get("CF_SIDECAR_SOCKET", "").strip()
    uses_short_socket = False
    if env_sock:
        socket_path = pathlib.Path(env_sock).expanduser()
        bind_socket_path = socket_path
        candidates: list[pathlib.Path] = [socket_path]
    else:
        socket_path = primary_sock
        if len(str(primary_sock).encode("utf-8")) > MAX_SUN_PATH_BYTES:
            bind_socket_path = _short_socket_path(state_root)
            uses_short_socket = True
        else:
            bind_socket_path = primary_sock

        raw_candidates: list[pathlib.Path] = []
        ep_sock = _read_endpoint_socket(endpoint_path, uid_int)
        if ep_sock is not None:
            raw_candidates.append(ep_sock)
        raw_candidates.append(primary_sock)
        if bind_socket_path != primary_sock:
            raw_candidates.append(bind_socket_path)

        # Cross-environment discovery fallback (sidecar.json may see
        # ANTIGRAVITY_EXECUTABLE_DATA_DIR or temp state dir rather than $PLUGIN_DATA).
        extra_roots: list[pathlib.Path] = []
        exec_data = os.environ.get("ANTIGRAVITY_EXECUTABLE_DATA_DIR", "").strip()
        if exec_data:
            extra_roots.append(pathlib.Path(exec_data).expanduser())
        extra_roots.append(
            pathlib.Path(tempfile.gettempdir())
            / f"code-factory-state-{_current_uid()}"
        )
        for extra_root in extra_roots:
            try:
                if extra_root.resolve() == state_root.resolve():
                    continue
            except OSError:
                pass
            if extra_root.is_symlink():
                continue
            extra_ep = _read_endpoint_socket(
                extra_root / "cf-sidecar.endpoint.json", uid_int
            )
            if extra_ep is not None:
                raw_candidates.append(extra_ep)
            raw_candidates.append(extra_root / "cf-sidecar.sock")

        seen: set[str] = set()
        candidates = []
        for cand in raw_candidates:
            key = str(cand)
            if key not in seen:
                seen.add(key)
                candidates.append(cand)

    return {
        "state_root": state_root,
        "socket_path": socket_path,
        "primary_socket_path": primary_sock,
        "bind_socket_path": bind_socket_path,
        "uses_short_socket": uses_short_socket,
        "endpoint_path": endpoint_path,
        "spool_path": spool_path,
        "audit_path": audit_path,
        "pid_path": pid_path,
        "discovery_candidates": candidates,
    }


def _sanitize_metadata(raw: Any, depth: int = 0) -> dict[str, Any]:
    if not isinstance(raw, dict) or depth > 3:
        return {}
    cleaned: dict[str, Any] = {}
    for idx, (key, val) in enumerate(raw.items()):
        if idx >= 24:
            break
        clean_key = sanitize_text(str(key), max_chars=64)
        if not clean_key:
            continue
        if isinstance(val, str):
            cleaned[clean_key] = sanitize_text(val, max_chars=256)
        elif isinstance(val, (bool, int, float)) or val is None:
            cleaned[clean_key] = val
        elif isinstance(val, list):
            cleaned[clean_key] = [
                sanitize_text(item, max_chars=128)
                if isinstance(item, str)
                else item
                for item in val[:16]
                if isinstance(item, (str, int, float, bool)) or item is None
            ]
        elif isinstance(val, dict):
            cleaned[clean_key] = _sanitize_metadata(val, depth=depth + 1)
    return cleaned


def build_sidecar_event(
    event_name: str,
    conversation_id: Any,
    project_dir: str = "",
    hook: str = "",
    tool_name: str = "",
    status: str = "ok",
    summary: str = "",
    metadata: dict[str, Any] | None = None,
    event_type: str = "hook_event",
    timestamp: float | None = None,
) -> dict[str, Any]:
    """Validate and construct a redacted Spec §3.3 sidecar NDJSON event payload."""
    if event_type not in ALLOWED_SIDECAR_EVENT_TYPES:
        raise ValueError(f"Unsupported sidecar eventType: {event_type!r}")
    if event_name not in ALLOWED_SIDECAR_EVENT_NAMES:
        raise ValueError(f"Unsupported sidecar eventName: {event_name!r}")

    ts = (
        float(timestamp)
        if isinstance(timestamp, (int, float)) and not isinstance(timestamp, bool)
        else float(time.time())
    )
    clean_status = sanitize_text(status, max_chars=32) or "ok"

    return {
        "schemaVersion": SCHEMA_VERSION,
        "eventType": event_type,
        "eventName": event_name,
        "conversationId": sanitize_conversation_id(conversation_id),
        "projectDir": sanitize_text(project_dir, max_chars=400),
        "timestamp": ts,
        "hook": sanitize_text(hook, max_chars=64),
        "toolName": sanitize_text(tool_name, max_chars=64),
        "status": clean_status,
        "summary": sanitize_text(summary, max_chars=MAX_FEEDBACK_SUMMARY_CHARS),
        "metadata": _sanitize_metadata(metadata),
    }


def spool_sidecar_event(event: dict[str, Any]) -> bool:
    """Fail-open append of a redacted NDJSON event to bounded 0600 telemetry-spool.jsonl."""
    try:
        paths = resolve_sidecar_paths()
        spool_path: pathlib.Path = paths["spool_path"]
        if spool_path.is_symlink() or spool_path.parent.is_symlink():
            return False
        if spool_path.resolve().parent != spool_path.parent.resolve():
            return False

        line = json.dumps(event, separators=(",", ":")) + "\n"
        line_bytes = line.encode("utf-8")
        if len(line_bytes) > MAX_SIDECAR_MESSAGE_BYTES:
            return False

        lock_fd = _acquire_file_lock(spool_path.parent / ".telemetry-spool.lock")
        try:
            current_size = 0
            if spool_path.exists():
                if spool_path.is_symlink() or not spool_path.is_file():
                    return False
                current_size = spool_path.stat().st_size

            if current_size + len(line_bytes) > MAX_SPOOL_BYTES:
                existing_lines: list[str] = []
                if current_size > 0:
                    raw_text = spool_path.read_text(encoding="utf-8", errors="replace")
                    existing_lines = [
                        ln + "\n" for ln in raw_text.splitlines() if ln.strip()
                    ]
                existing_lines.append(line)
                bounded = _trim_jsonl_lines(
                    existing_lines, max_records=5000, max_bytes=MAX_SPOOL_BYTES
                )
                _atomic_write_text(spool_path, "".join(bounded), prefix=".spool.")
            else:
                flags = os.O_CREAT | os.O_WRONLY | os.O_APPEND
                if hasattr(os, "O_NOFOLLOW"):
                    flags |= os.O_NOFOLLOW
                fd = os.open(str(spool_path), flags, 0o600)
                try:
                    os.write(fd, line_bytes)
                finally:
                    os.close(fd)
                try:
                    os.chmod(spool_path, 0o600)
                except OSError:
                    pass
            return True
        finally:
            _release_file_lock(lock_fd)
    except (OSError, ValueError, TypeError):
        return False


def drain_spool_events(max_events: int = 1000) -> list[dict[str, Any]]:
    """Atomically read and drain up to `max_events` from telemetry-spool.jsonl."""
    if max_events <= 0:
        return []
    try:
        spool_path: pathlib.Path = resolve_sidecar_paths()["spool_path"]
    except (OSError, ValueError):
        return []
    if not spool_path.exists() or spool_path.is_symlink() or not spool_path.is_file():
        return []

    lock_fd = _acquire_file_lock(spool_path.parent / ".telemetry-spool.lock")
    try:
        if not spool_path.exists() or spool_path.is_symlink() or not spool_path.is_file():
            return []
        raw_text = spool_path.read_text(encoding="utf-8", errors="replace")
        events: list[dict[str, Any]] = []
        remaining: list[str] = []
        for line in raw_text.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if len(events) >= max_events:
                remaining.append(stripped + "\n")
                continue
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                events.append(parsed)
        _atomic_write_text(spool_path, "".join(remaining), prefix=".spool.")
        return events
    except (OSError, ValueError):
        return []
    finally:
        _release_file_lock(lock_fd)


def emit_sidecar_event(
    event_name: str,
    conversation_id: Any,
    project_dir: str = "",
    hook: str = "",
    tool_name: str = "",
    status: str = "ok",
    summary: str = "",
    metadata: dict[str, Any] | None = None,
    event_type: str = "hook_event",
    timeout_s: float = DEFAULT_SIDECAR_TIMEOUT_S,
) -> bool:
    """Emit a redacted event over 0600 AF_UNIX socket (<10ms), failing open to spool."""
    disabled = os.environ.get("CF_DISABLE_SIDECAR", "").strip().lower()
    if disabled in {"1", "true", "off", "yes"}:
        return False

    try:
        event = build_sidecar_event(
            event_name=event_name,
            conversation_id=conversation_id,
            project_dir=project_dir,
            hook=hook,
            tool_name=tool_name,
            status=status,
            summary=summary,
            metadata=metadata,
            event_type=event_type,
        )
        payload_bytes = (json.dumps(event, separators=(",", ":")) + "\n").encode(
            "utf-8"
        )
    except (ValueError, TypeError):
        return False

    if len(payload_bytes) > MAX_SIDECAR_MESSAGE_BYTES:
        return False

    try:
        paths = resolve_sidecar_paths()
    except (OSError, ValueError):
        return False

    uid_int = _uid_int()
    bounded_timeout = max(0.001, min(float(timeout_s), DEFAULT_SIDECAR_TIMEOUT_S))

    for candidate in paths["discovery_candidates"]:
        if not _is_safe_private_socket(candidate, expected_uid=uid_int):
            continue
        sock: socket.socket | None = None
        try:
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.settimeout(bounded_timeout)
            sock.connect(str(candidate))
            sock.sendall(payload_bytes)
            try:
                sock.shutdown(socket.SHUT_WR)
            except OSError:
                pass
            return True
        except OSError:
            continue
        finally:
            if sock is not None:
                try:
                    sock.close()
                except OSError:
                    pass

    spool_sidecar_event(event)
    return False
