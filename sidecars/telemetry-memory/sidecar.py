#!/usr/bin/env python3
"""Enterprise Code Factory v3.1.0 async telemetry and auto-memory sidecar.

Pure Python 3 stdlib daemon communicating strictly over a 0600-permissioned
AF_UNIX stream socket (never TCP). Provides:
  - Strict NDJSON schema validation (<= 16,384 bytes/message)
  - Secret & ANSI redaction via hooks/hook_state.py
  - Bounded audit log rotation (telemetry-audit.jsonl + .1/.2/.3)
  - Optional opt-in HTTPS webhook forwarding on a bounded queue worker
  - Bounded <= 200-line / <= 3,072-byte .memory/auto-memory.md distillation
  - CLI subcommands: serve, status, flush, distill, stop
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import pathlib
import queue
import random
import signal
import socket
import stat
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows fallback
    fcntl = None  # type: ignore[assignment]

HOOKS_DIR = pathlib.Path(__file__).resolve().parents[2] / "hooks"
if str(HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(HOOKS_DIR))

import hook_state  # noqa: E402

DEFAULT_AUDIT_MAX_BYTES = 1_048_576
AUDIT_BACKUP_COUNT = 3
MAX_WEBHOOK_QUEUE_SIZE = 128
WEBHOOK_TIMEOUT_SECONDS = 3.0
WEBHOOK_MAX_RETRIES = 2

AUTO_MEMORY_START = "<!-- code-factory:auto-memory:start -->"
AUTO_MEMORY_END = "<!-- code-factory:auto-memory:end -->"
MAX_AUTO_MEMORY_LINES = 200
MAX_AUTO_MEMORY_BYTES = 3072
MAX_AUTO_MEMORY_BULLET_CHARS = 240

DISTILLABLE_EVENT_NAMES = frozenset(
    {
        "manual_lesson",
        "post_tool_lint_resolved",
        "verification_passed",
        "loop_breaker_triggered",
        "checkpoint_restored",
    }
)


def _uid_int() -> int:
    if hasattr(os, "getuid"):
        try:
            return int(os.getuid())
        except OSError:
            pass
    return 0


def _atomic_write_private_text(
    target: pathlib.Path, content: str, prefix: str = ".sidecar."
) -> None:
    parent = target.parent
    if target.is_symlink() or parent.is_symlink():
        raise OSError(f"Refusing symlink path: {target}")
    if target.resolve().parent != parent.resolve():
        raise ValueError(f"Path escaped parent directory: {target}")

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


def _acquire_lock(lock_path: pathlib.Path) -> int | None:
    if fcntl is None:
        return None
    if lock_path.is_symlink() or lock_path.parent.is_symlink():
        return None
    flags = os.O_CREAT | os.O_RDWR
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        fd = os.open(str(lock_path), flags, 0o600)
    except OSError:
        return None
    try:
        os.chmod(lock_path, 0o600)
    except OSError:
        pass
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        return fd
    except OSError:
        os.close(fd)
        return None


def _release_lock(fd: int | None) -> None:
    if fd is None or fcntl is None:
        return
    try:
        fcntl.flock(fd, fcntl.LOCK_UN)
    except OSError:
        pass
    try:
        os.close(fd)
    except OSError:
        pass


def get_audit_max_bytes() -> int:
    raw = os.environ.get("CF_TELEMETRY_MAX_BYTES", "").strip()
    if raw:
        try:
            parsed = int(raw)
            if parsed > 0:
                return parsed
        except ValueError:
            pass
    return DEFAULT_AUDIT_MAX_BYTES


def validate_webhook_url(url: str) -> tuple[bool, str]:
    """Validate optional webhook URL: HTTPS only, no credentials, local HTTP opt-in."""
    if not isinstance(url, str):
        return False, "invalid_type"
    cleaned = url.strip()
    if not cleaned:
        return False, "disabled"
    if any(ch.isspace() for ch in cleaned):
        return False, "whitespace_forbidden"

    try:
        parsed = urllib.parse.urlsplit(cleaned)
    except ValueError:
        return False, "malformed_url"

    if parsed.username is not None or parsed.password is not None or "@" in parsed.netloc:
        return False, "embedded_credentials_forbidden"

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return False, "missing_hostname"

    scheme = (parsed.scheme or "").lower()
    if scheme == "https":
        return True, "ok"

    allow_insecure = os.environ.get("CF_ALLOW_INSECURE_LOCAL_WEBHOOK", "").strip() == "1"
    if scheme == "http" and allow_insecure and hostname == "127.0.0.1":
        return True, "ok"

    return False, "insecure_scheme_or_host"


class WebhookDispatcher:
    """Bounded async queue worker forwarding redacted telemetry via HTTPS POST."""

    def __init__(self, url: str) -> None:
        self.url = url.strip()
        ok, reason = validate_webhook_url(self.url)
        self.enabled = ok
        self.disabled_reason = reason
        self._queue: queue.Queue[dict[str, Any] | None] = queue.Queue(
            maxsize=MAX_WEBHOOK_QUEUE_SIZE
        )
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        if self.enabled:
            self._thread = threading.Thread(
                target=self._run_loop, name="cf-sidecar-webhook", daemon=True
            )
            self._thread.start()

    def enqueue(self, event: dict[str, Any]) -> bool:
        if not self.enabled or self._stop_event.is_set():
            return False
        try:
            self._queue.put_nowait(event)
            return True
        except queue.Full:
            return False

    def _send_once(self, event: dict[str, Any]) -> bool:
        payload = json.dumps(event, separators=(",", ":")).encode("utf-8")
        req = urllib.request.Request(
            self.url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "code-factory-sidecar/3.1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=WEBHOOK_TIMEOUT_SECONDS) as resp:
            status = getattr(resp, "status", 200)
            return 200 <= int(status) < 400

    def send_with_retries(self, event: dict[str, Any]) -> bool:
        for attempt in range(WEBHOOK_MAX_RETRIES + 1):
            try:
                if self._send_once(event):
                    return True
            except (urllib.error.URLError, OSError, ValueError):
                pass
            if attempt < WEBHOOK_MAX_RETRIES and not self._stop_event.is_set():
                delay = (0.1 * (2**attempt)) + random.uniform(0.0, 0.05)
                time.sleep(delay)
        return False

    def _run_loop(self) -> None:
        while True:
            item = self._queue.get()
            try:
                if item is None:
                    return
                self.send_with_retries(item)
            finally:
                self._queue.task_done()

    def flush_and_stop(self, timeout_s: float = 5.0) -> None:
        if not self.enabled or self._thread is None:
            return
        self._stop_event.set()
        try:
            self._queue.put(None, timeout=0.5)
        except queue.Full:
            pass
        self._thread.join(timeout=timeout_s)


def validate_and_sanitize_event(raw_obj: Any) -> tuple[dict[str, Any] | None, str | None]:
    """Validate incoming sidecar event schema and redact all text fields."""
    if not isinstance(raw_obj, dict):
        return None, "invalid_json"

    schema_ver = raw_obj.get("schemaVersion")
    if isinstance(schema_ver, bool) or schema_ver != hook_state.SCHEMA_VERSION:
        return None, "invalid_event"

    event_type = raw_obj.get("eventType")
    if (
        not isinstance(event_type, str)
        or event_type not in hook_state.ALLOWED_SIDECAR_EVENT_TYPES
    ):
        return None, "invalid_event"

    event_name = raw_obj.get("eventName")
    if (
        not isinstance(event_name, str)
        or event_name not in hook_state.ALLOWED_SIDECAR_EVENT_NAMES
    ):
        return None, "invalid_event"

    raw_cid = raw_obj.get("conversationId")
    if not isinstance(raw_cid, str) or not raw_cid.strip():
        return None, "invalid_event"
    safe_cid = hook_state.sanitize_conversation_id(raw_cid)
    if not safe_cid:
        return None, "invalid_event"

    raw_project = raw_obj.get("projectDir", "")
    if raw_project is None:
        raw_project = ""
    elif not isinstance(raw_project, str):
        return None, "invalid_event"

    raw_hook = raw_obj.get("hook", "")
    if raw_hook is None:
        raw_hook = ""
    elif not isinstance(raw_hook, str):
        return None, "invalid_event"

    raw_tool = raw_obj.get("toolName", "")
    if raw_tool is None:
        raw_tool = ""
    elif not isinstance(raw_tool, str):
        return None, "invalid_event"

    raw_status = raw_obj.get("status", "ok")
    if raw_status is None:
        raw_status = "ok"
    elif not isinstance(raw_status, str):
        return None, "invalid_event"

    raw_summary = raw_obj.get("summary", "")
    if raw_summary is None:
        raw_summary = ""
    elif not isinstance(raw_summary, str):
        return None, "invalid_event"

    raw_meta = raw_obj.get("metadata")
    if raw_meta is not None and not isinstance(raw_meta, dict):
        return None, "invalid_event"

    sanitized = hook_state.build_sidecar_event(
        event_name=event_name,
        conversation_id=safe_cid,
        project_dir=raw_project,
        hook=raw_hook,
        tool_name=raw_tool,
        status=raw_status,
        summary=raw_summary,
        metadata=raw_meta,
        event_type=event_type,
        timestamp=raw_obj.get("timestamp"),
    )
    return sanitized, None


def _rotate_audit_logs_unlocked(audit_path: pathlib.Path) -> None:
    for idx in range(AUDIT_BACKUP_COUNT, 0, -1):
        src = (
            audit_path
            if idx == 1
            else audit_path.with_name(f"{audit_path.name}.{idx - 1}")
        )
        dst = audit_path.with_name(f"{audit_path.name}.{idx}")
        if dst.is_symlink():
            raise OSError(f"Refusing symlinked backup audit log: {dst}")
        if src.is_symlink():
            raise OSError(f"Refusing symlinked audit log: {src}")
        if idx == AUDIT_BACKUP_COUNT and dst.exists():
            dst.unlink()
        if src.exists() and src.is_file():
            os.replace(src, dst)


def append_audit_event(
    event: dict[str, Any], audit_path: pathlib.Path | None = None
) -> pathlib.Path:
    """Append a redacted event to 0600 telemetry-audit.jsonl with size rotation."""
    target = audit_path or hook_state.resolve_sidecar_paths()["audit_path"]
    if target.is_symlink() or target.parent.is_symlink():
        raise OSError(f"Refusing symlinked audit path: {target}")
    if not hook_state._ensure_private_dir(target.parent):
        raise OSError(f"Unable to secure audit directory: {target.parent}")

    line_bytes = (json.dumps(event, separators=(",", ":")) + "\n").encode("utf-8")
    max_bytes = get_audit_max_bytes()

    lock_fd = _acquire_lock(target.parent / ".telemetry-audit.lock")
    try:
        if target.exists():
            if target.is_symlink() or not target.is_file():
                raise OSError(f"Invalid audit log target: {target}")
            current_size = target.stat().st_size
            if current_size > 0 and current_size + len(line_bytes) > max_bytes:
                _rotate_audit_logs_unlocked(target)

        flags = os.O_CREAT | os.O_WRONLY | os.O_APPEND
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        fd = os.open(str(target), flags, 0o600)
        try:
            os.write(fd, line_bytes)
        finally:
            os.close(fd)
        try:
            os.chmod(target, 0o600)
        except OSError:
            pass
    finally:
        _release_lock(lock_fd)

    return target


def _normalize_bullet_key(line: str) -> str:
    text = line.strip()
    if text.startswith("- "):
        text = text[2:].strip()
    if text.startswith("[") and "]" in text:
        end_idx = text.find("]")
        if end_idx > 1 and end_idx < 24:
            text = text[end_idx + 1 :].strip()
    return " ".join(text.lower().split())


def _format_auto_memory_bullet(note: str, timestamp: float | None = None) -> str:
    cleaned = hook_state.sanitize_text(note, max_chars=MAX_AUTO_MEMORY_BULLET_CHARS)
    cleaned = " ".join(cleaned.splitlines()).strip()
    if cleaned.startswith("- "):
        cleaned = cleaned[2:].strip()
    if not cleaned:
        return ""
    ts = (
        float(timestamp)
        if isinstance(timestamp, (int, float)) and not isinstance(timestamp, bool)
        else time.time()
    )
    date_str = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).strftime(
        "%Y-%m-%d"
    )
    if cleaned.startswith("[") and "]" in cleaned[:16]:
        return f"- {cleaned}"
    return f"- [{date_str}] {cleaned}"


def _render_auto_memory(
    before_lines: list[str], managed_bullets: list[str], after_lines: list[str]
) -> str:
    parts: list[str] = []
    parts.extend(before_lines)
    parts.append(AUTO_MEMORY_START)
    parts.extend(managed_bullets)
    parts.append(AUTO_MEMORY_END)
    parts.extend(after_lines)
    if not parts:
        return ""
    return "\n".join(parts) + "\n"


def distill_auto_memory(
    project_dir: str | pathlib.Path,
    note: str,
    timestamp: float | None = None,
) -> dict[str, Any]:
    """Distill a redacted bullet into bounded <=200-line / <=3KB .memory/auto-memory.md."""
    if os.environ.get("CF_AUTO_MEMORY", "on").strip().lower() == "off":
        return {"ok": False, "reason": "auto_memory_disabled"}

    if not project_dir:
        return {"ok": False, "reason": "missing_project_dir"}

    proj_path = pathlib.Path(project_dir).expanduser()
    try:
        if proj_path.is_symlink() or not proj_path.is_dir():
            return {"ok": False, "reason": "invalid_project_dir"}
    except OSError:
        return {"ok": False, "reason": "invalid_project_dir"}

    mem_dir = proj_path / ".memory"
    try:
        if mem_dir.is_symlink() or not mem_dir.exists() or not mem_dir.is_dir():
            return {"ok": False, "reason": "missing_memory_dir"}
        if not hook_state.is_within_directory(mem_dir, proj_path):
            return {"ok": False, "reason": "memory_dir_outside_project"}
    except OSError:
        return {"ok": False, "reason": "invalid_memory_dir"}

    auto_mem_path = mem_dir / "auto-memory.md"
    try:
        if auto_mem_path.is_symlink():
            return {"ok": False, "reason": "symlink_rejected"}
        if auto_mem_path.exists() and not auto_mem_path.is_file():
            return {"ok": False, "reason": "not_a_regular_file"}
        if auto_mem_path.resolve().parent != mem_dir.resolve():
            return {"ok": False, "reason": "path_escape_rejected"}
    except OSError:
        return {"ok": False, "reason": "path_check_failed"}

    bullet = _format_auto_memory_bullet(note, timestamp=timestamp)
    if not bullet:
        return {"ok": False, "reason": "empty_note"}

    state_root = hook_state.resolve_state_root()
    dir_hash = hashlib.sha256(str(mem_dir.resolve()).encode("utf-8")).hexdigest()[:12]
    lock_fd = _acquire_lock(state_root / f".automem-{dir_hash}.lock")
    try:
        if auto_mem_path.is_symlink():
            return {"ok": False, "reason": "symlink_rejected"}

        existing_lines: list[str] = []
        if auto_mem_path.exists():
            raw_content = auto_mem_path.read_text(encoding="utf-8", errors="replace")
            existing_lines = raw_content.splitlines()

        start_idx = -1
        end_idx = -1
        for idx, line in enumerate(existing_lines):
            stripped = line.strip()
            if stripped == AUTO_MEMORY_START and start_idx == -1:
                start_idx = idx
            elif stripped == AUTO_MEMORY_END and start_idx != -1:
                end_idx = idx
                break

        if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
            before_lines = existing_lines[:start_idx]
            raw_managed = existing_lines[start_idx + 1 : end_idx]
            after_lines = existing_lines[end_idx + 1 :]
        else:
            before_lines = existing_lines
            raw_managed = []
            after_lines = []

        # Deduplicate existing and incoming bullets while preserving FIFO order.
        managed_bullets: list[str] = []
        seen_keys: dict[str, int] = {}
        for line in raw_managed:
            stripped = line.strip()
            if not stripped:
                continue
            redacted = hook_state.sanitize_text(
                stripped, max_chars=MAX_AUTO_MEMORY_BULLET_CHARS
            )
            if not redacted:
                continue
            key = _normalize_bullet_key(redacted)
            if key in seen_keys:
                continue
            seen_keys[key] = len(managed_bullets)
            managed_bullets.append(redacted)

        incoming_key = _normalize_bullet_key(bullet)
        if incoming_key in seen_keys:
            # Refresh duplicate to newest position at the end.
            managed_bullets = [
                b for b in managed_bullets if _normalize_bullet_key(b) != incoming_key
            ]
        managed_bullets.append(bullet)

        rendered = _render_auto_memory(before_lines, managed_bullets, after_lines)
        while managed_bullets and (
            len(rendered.splitlines()) > MAX_AUTO_MEMORY_LINES
            or len(rendered.encode("utf-8")) > MAX_AUTO_MEMORY_BYTES
        ):
            managed_bullets.pop(0)
            rendered = _render_auto_memory(before_lines, managed_bullets, after_lines)

        _atomic_write_private_text(auto_mem_path, rendered, prefix=".automem.")
        return {
            "ok": True,
            "path": str(auto_mem_path),
            "lines": len(rendered.splitlines()),
            "bytes": len(rendered.encode("utf-8")),
            "managedBullets": len(managed_bullets),
        }
    except (OSError, ValueError) as exc:
        return {"ok": False, "reason": str(exc)}
    finally:
        _release_lock(lock_fd)


def _should_distill_event(event: dict[str, Any]) -> bool:
    summary = str(event.get("summary") or "").strip()
    project_dir = str(event.get("projectDir") or "").strip()
    if not summary or not project_dir:
        return False
    if event.get("eventType") == "memory_note":
        return True
    return event.get("eventName") in DISTILLABLE_EVENT_NAMES


def process_valid_event(
    event: dict[str, Any],
    webhook: WebhookDispatcher | None = None,
    audit_path: pathlib.Path | None = None,
) -> dict[str, Any]:
    """Persist redacted event to audit log, optionally distill, and enqueue webhook."""
    event_type = event.get("eventType")
    if event_type == "ping":
        return {"audited": False, "distilled": False, "webhookEnqueued": False}

    append_audit_event(event, audit_path=audit_path)

    distill_result: dict[str, Any] = {"ok": False}
    if _should_distill_event(event):
        distill_result = distill_auto_memory(
            project_dir=str(event.get("projectDir", "")),
            note=str(event.get("summary", "")),
            timestamp=event.get("timestamp"),
        )

    enqueued = False
    if webhook is not None and webhook.enabled:
        enqueued = webhook.enqueue(event)

    return {
        "audited": True,
        "distilled": bool(distill_result.get("ok")),
        "webhookEnqueued": enqueued,
    }


def flush_spool(
    webhook: WebhookDispatcher | None = None,
    max_events: int = 1000,
) -> dict[str, Any]:
    """Drain telemetry-spool.jsonl into audit log, auto-memory, and optional webhook."""
    events = hook_state.drain_spool_events(max_events=max_events)
    flushed = 0
    rejected = 0
    distilled = 0
    for raw_ev in events:
        sanitized, err = validate_and_sanitize_event(raw_ev)
        if err or sanitized is None:
            rejected += 1
            continue
        outcome = process_valid_event(sanitized, webhook=webhook)
        flushed += 1
        if outcome["distilled"]:
            distilled += 1
    return {
        "ok": True,
        "drained": len(events),
        "flushed": flushed,
        "rejected": rejected,
        "distilled": distilled,
    }


class SidecarServer:
    """0600-permissioned AF_UNIX NDJSON server (strictly no TCP sockets)."""

    def __init__(self, webhook: WebhookDispatcher | None = None) -> None:
        self.paths = hook_state.resolve_sidecar_paths()
        self.webhook = webhook
        self._stop_event = threading.Event()
        self._server_sock: socket.socket | None = None
        self._audit_lock = threading.Lock()
        self._bind_sock_path: pathlib.Path = self.paths["bind_socket_path"]

    def _prepare_socket(self) -> socket.socket:
        sock_path = self._bind_sock_path
        if sock_path.parent.is_symlink():
            raise OSError(f"Refusing symlinked socket directory: {sock_path.parent}")
        if not hook_state._ensure_private_dir(sock_path.parent):
            raise OSError(f"Failed to create 0700 socket dir: {sock_path.parent}")

        if sock_path.is_symlink():
            raise OSError(f"Refusing symlinked socket path: {sock_path}")
        if sock_path.exists():
            st = os.lstat(sock_path)
            if not stat.S_ISSOCK(st.st_mode):
                raise OSError(f"Refusing to unlink non-socket path: {sock_path}")
            sock_path.unlink()

        srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        old_umask = os.umask(0o077)
        try:
            srv.bind(str(sock_path))
        finally:
            os.umask(old_umask)
        os.chmod(sock_path, 0o600)
        srv.listen(64)
        srv.settimeout(0.25)
        return srv

    def _write_runtime_metadata(self) -> None:
        endpoint_path: pathlib.Path = self.paths["endpoint_path"]
        pid_path: pathlib.Path = self.paths["pid_path"]
        endpoint_payload = {
            "socketPath": str(self._bind_sock_path),
            "pid": os.getpid(),
            "uid": _uid_int(),
            "startedAt": time.time(),
        }
        _atomic_write_private_text(
            endpoint_path,
            json.dumps(endpoint_payload, indent=2) + "\n",
            prefix=".endpoint.",
        )
        _atomic_write_private_text(pid_path, f"{os.getpid()}\n", prefix=".pid.")

    def _cleanup_runtime_files(self) -> None:
        for path in (
            self._bind_sock_path,
            self.paths["endpoint_path"],
            self.paths["pid_path"],
        ):
            try:
                if path.exists() and not path.is_symlink():
                    path.unlink()
            except OSError:
                pass

    def _send_reply(self, conn: socket.socket, payload: dict[str, Any]) -> None:
        raw = (json.dumps(payload, separators=(",", ":")) + "\n").encode("utf-8")
        try:
            conn.sendall(raw)
        except OSError:
            pass

    def _handle_line(self, line_bytes: bytes) -> dict[str, Any]:
        if len(line_bytes) > hook_state.MAX_SIDECAR_MESSAGE_BYTES:
            return {"ok": False, "error": "payload_too_large"}
        try:
            text = line_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return {"ok": False, "error": "invalid_json"}
        stripped = text.strip()
        if not stripped:
            return {"ok": False, "error": "invalid_json"}
        try:
            raw_obj = json.loads(stripped)
        except json.JSONDecodeError:
            return {"ok": False, "error": "invalid_json"}

        sanitized, err = validate_and_sanitize_event(raw_obj)
        if err or sanitized is None:
            return {"ok": False, "error": err or "invalid_event"}

        with self._audit_lock:
            if sanitized["eventType"] == "flush":
                flush_spool(webhook=self.webhook)
            process_valid_event(sanitized, webhook=self.webhook)
        return {"ok": True}

    def _handle_client(self, conn: socket.socket) -> None:
        conn.settimeout(2.0)
        buf = bytearray()
        max_bytes = hook_state.MAX_SIDECAR_MESSAGE_BYTES
        try:
            while not self._stop_event.is_set():
                try:
                    chunk = conn.recv(4096)
                except socket.timeout:
                    break
                except OSError:
                    break
                if not chunk:
                    if buf:
                        reply = self._handle_line(bytes(buf))
                        self._send_reply(conn, reply)
                    break

                buf.extend(chunk)
                while True:
                    nl_idx = buf.find(b"\n")
                    if nl_idx == -1:
                        if len(buf) > max_bytes:
                            self._send_reply(
                                conn, {"ok": False, "error": "payload_too_large"}
                            )
                            return
                        break
                    line_bytes = bytes(buf[: nl_idx + 1])
                    del buf[: nl_idx + 1]
                    reply = self._handle_line(line_bytes)
                    self._send_reply(conn, reply)
        finally:
            try:
                conn.close()
            except OSError:
                pass

    def start(self) -> None:
        self._server_sock = self._prepare_socket()
        self._write_runtime_metadata()

    def serve_forever(self) -> None:
        if self._server_sock is None:
            self.start()
        assert self._server_sock is not None
        try:
            while not self._stop_event.is_set():
                try:
                    conn, _ = self._server_sock.accept()
                except socket.timeout:
                    continue
                except OSError:
                    break
                worker = threading.Thread(
                    target=self._handle_client, args=(conn,), daemon=True
                )
                worker.start()
        finally:
            self.close()

    def stop(self) -> None:
        self._stop_event.set()
        if self._server_sock is not None:
            try:
                self._server_sock.close()
            except OSError:
                pass

    def close(self) -> None:
        self._stop_event.set()
        if self._server_sock is not None:
            try:
                self._server_sock.close()
            except OSError:
                pass
            self._server_sock = None
        if self.webhook is not None:
            self.webhook.flush_and_stop(timeout_s=3.0)
        self._cleanup_runtime_files()


def _read_pid(pid_path: pathlib.Path) -> int | None:
    try:
        if pid_path.is_symlink() or not pid_path.exists() or not pid_path.is_file():
            return None
        raw = pid_path.read_text(encoding="utf-8", errors="replace").strip()
        pid = int(raw)
        return pid if pid > 0 else None
    except (OSError, ValueError):
        return None


def _is_pid_running(pid: int | None) -> bool:
    if pid is None or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False


def cmd_serve(_args: argparse.Namespace) -> int:
    webhook_url = os.environ.get("CF_TELEMETRY_WEBHOOK_URL", "").strip()
    webhook = WebhookDispatcher(webhook_url) if webhook_url else None
    server = SidecarServer(webhook=webhook)

    def _on_signal(_signum: int, _frame: Any) -> None:
        server.stop()

    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT, _on_signal)

    server.start()
    server.serve_forever()
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    paths = hook_state.resolve_sidecar_paths()
    pid = _read_pid(paths["pid_path"])
    running = _is_pid_running(pid)

    uid_int = _uid_int()
    active_socket: str | None = None
    for cand in paths["discovery_candidates"]:
        if hook_state._is_safe_private_socket(cand, expected_uid=uid_int):
            active_socket = str(cand)
            break

    spool_path: pathlib.Path = paths["spool_path"]
    spool_count = 0
    if spool_path.exists() and not spool_path.is_symlink() and spool_path.is_file():
        try:
            spool_count = sum(
                1
                for ln in spool_path.read_text(
                    encoding="utf-8", errors="replace"
                ).splitlines()
                if ln.strip()
            )
        except OSError:
            spool_count = 0

    audit_path: pathlib.Path = paths["audit_path"]
    audit_bytes = 0
    if audit_path.exists() and not audit_path.is_symlink() and audit_path.is_file():
        try:
            audit_bytes = audit_path.stat().st_size
        except OSError:
            audit_bytes = 0

    payload = {
        "running": running,
        "pid": pid,
        "socketPath": active_socket,
        "bindSocketPath": str(paths["bind_socket_path"]),
        "usesShortSocket": bool(paths["uses_short_socket"]),
        "spoolCount": spool_count,
        "auditBytes": audit_bytes,
    }
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(
            f"running={running} pid={pid} socket={active_socket or 'none'} "
            f"spool={spool_count} audit_bytes={audit_bytes}"
        )
    return 0


def cmd_flush(args: argparse.Namespace) -> int:
    webhook_url = os.environ.get("CF_TELEMETRY_WEBHOOK_URL", "").strip()
    webhook = WebhookDispatcher(webhook_url) if webhook_url else None
    try:
        result = flush_spool(webhook=webhook)
    finally:
        if webhook is not None:
            webhook.flush_and_stop(timeout_s=3.0)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(
            f"drained={result['drained']} flushed={result['flushed']} "
            f"distilled={result['distilled']} rejected={result['rejected']}"
        )
    return 0


def cmd_distill(args: argparse.Namespace) -> int:
    result = distill_auto_memory(project_dir=args.project_dir, note=args.note)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result.get("ok"):
            print(
                f"distilled path={result['path']} lines={result['lines']} bytes={result['bytes']}"
            )
        else:
            print(f"distill skipped: {result.get('reason', 'unknown')}")
    return 0 if result.get("ok") else 1


def cmd_stop(args: argparse.Namespace) -> int:
    paths = hook_state.resolve_sidecar_paths()
    pid = _read_pid(paths["pid_path"])
    if pid is None or not _is_pid_running(pid):
        payload = {"stopped": False, "reason": "not_running", "pid": pid}
        if args.json:
            print(json.dumps(payload, indent=2))
        else:
            print("sidecar is not running")
        return 0

    try:
        os.kill(pid, signal.SIGTERM)
    except OSError as exc:
        payload = {"stopped": False, "reason": str(exc), "pid": pid}
        if args.json:
            print(json.dumps(payload, indent=2))
        else:
            print(f"failed to stop pid={pid}: {exc}")
        return 1

    pid_path: pathlib.Path = paths["pid_path"]
    deadline = time.monotonic() + 2.5
    while time.monotonic() < deadline and _is_pid_running(pid) and pid_path.exists():
        time.sleep(0.05)

    stopped = (not _is_pid_running(pid)) or (not pid_path.exists())
    payload = {"stopped": stopped, "pid": pid}
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"stopped={stopped} pid={pid}")
    return 0 if stopped else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Code Factory v3.1.0 0600 AF_UNIX telemetry & auto-memory sidecar"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("serve", help="Run the 0600 AF_UNIX sidecar daemon")

    p_status = sub.add_parser("status", help="Inspect sidecar socket, PID, and spool")
    p_status.add_argument("--json", action="store_true", help="Output JSON")

    p_flush = sub.add_parser("flush", help="Drain telemetry-spool.jsonl to audit/memory")
    p_flush.add_argument("--json", action="store_true", help="Output JSON")

    p_distill = sub.add_parser("distill", help="Append redacted note to .memory/auto-memory.md")
    p_distill.add_argument("--project-dir", required=True, help="Target workspace path")
    p_distill.add_argument("--note", required=True, help="Lesson or note text")
    p_distill.add_argument("--json", action="store_true", help="Output JSON")

    p_stop = sub.add_parser("stop", help="Stop running sidecar daemon via PID file")
    p_stop.add_argument("--json", action="store_true", help="Output JSON")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    handlers = {
        "serve": cmd_serve,
        "status": cmd_status,
        "flush": cmd_flush,
        "distill": cmd_distill,
        "stop": cmd_stop,
    }
    return handlers[args.command](args)


if __name__ == "__main__":
    raise SystemExit(main())
