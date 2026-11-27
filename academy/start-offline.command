#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3112}"
URL="http://localhost:${PORT}"

if lsof -iTCP:"${PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Antigravity Academy is already running at ${URL}"
  open "${URL}"
  exit 0
fi

echo "Starting Antigravity Academy (100% Offline Local Server) at ${URL} ..."
echo "Keep this window open while reviewing. Press Ctrl+C to stop."
(sleep 1.5 && open "${URL}") &
exec ./node_modules/.bin/next start -p "${PORT}"
