#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOURCES_DIR="${SCRIPT_DIR}/../resources"
TARGET_DIR="${1:-$(pwd)}"

if [[ ! -d "${TARGET_DIR}" ]]; then
  echo "Error: Target directory does not exist: ${TARGET_DIR}" >&2
  exit 1
fi

echo "Bootstrapping Antigravity Code Factory workspace in: ${TARGET_DIR}"

mkdir -p \
  "${TARGET_DIR}/.memory/decisions" \
  "${TARGET_DIR}/plans/templates" \
  "${TARGET_DIR}/.agents/rules"

copy_if_missing() {
  local src="$1"
  local dst="$2"
  if [[ -e "${dst}" ]]; then
    echo "  [skip]   ${dst#${TARGET_DIR}/} (already exists)"
  else
    cp "${src}" "${dst}"
    echo "  [create] ${dst#${TARGET_DIR}/}"
  fi
}

copy_if_missing "${RESOURCES_DIR}/handover-template.md" "${TARGET_DIR}/.memory/handover.md"
copy_if_missing "${RESOURCES_DIR}/tasks-template.md" "${TARGET_DIR}/.memory/tasks.md"
copy_if_missing "${RESOURCES_DIR}/architecture-template.md" "${TARGET_DIR}/.memory/architecture.md"
copy_if_missing "${RESOURCES_DIR}/adr-template.md" "${TARGET_DIR}/.memory/decisions/0001-record-template.md"
copy_if_missing "${RESOURCES_DIR}/feature-spec-template.md" "${TARGET_DIR}/plans/templates/feature-spec-template.md"

echo "Antigravity Code Factory workspace initialized."
