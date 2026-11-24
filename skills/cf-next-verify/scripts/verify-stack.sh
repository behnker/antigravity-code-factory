#!/usr/bin/env bash
# Enterprise Code Factory — Deterministic Next.js / TypeScript / Zod / Vitest Verifier
# Usage: bash verify-stack.sh [target-dir] [--skip-build] [--coverage]

set -uo pipefail

TARGET_DIR="."
SKIP_BUILD=0
WITH_COVERAGE=0

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    --coverage) WITH_COVERAGE=1 ;;
    -h|--help)
      echo "Usage: bash verify-stack.sh [target-dir] [--skip-build] [--coverage]"
      exit 0
      ;;
    *)
      TARGET_DIR="$arg"
      ;;
  esac
done

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "Error: target directory does not exist: $TARGET_DIR" >&2
  exit 1
fi

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

if [[ ! -f "$TARGET_DIR/package.json" ]]; then
  echo "Error: no package.json found in $TARGET_DIR" >&2
  exit 1
fi

cd "$TARGET_DIR"

# Detect package manager
if [[ -f "pnpm-lock.yaml" ]] && command -v pnpm >/dev/null 2>&1; then
  PM="pnpm"
  PM_RUN="pnpm run"
  PM_EXEC="pnpm exec"
elif [[ -f "yarn.lock" ]] && command -v yarn >/dev/null 2>&1; then
  PM="yarn"
  PM_RUN="yarn"
  PM_EXEC="yarn"
elif { [[ -f "bun.lock" ]] || [[ -f "bun.lockb" ]]; } && command -v bun >/dev/null 2>&1; then
  PM="bun"
  PM_RUN="bun run"
  PM_EXEC="bunx"
else
  PM="npm"
  PM_RUN="npm run"
  PM_EXEC="npx --no-install"
fi

has_script() {
  node -e "
    const pkg = require('./package.json');
    process.exit(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, process.argv[1]) ? 0 : 1);
  " "$1" 2>/dev/null
}

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
SUMMARY_LINES=()

record_step() {
  local name="$1"
  local status="$2"
  local detail="$3"
  SUMMARY_LINES+=("  [$status] $name — $detail")
  case "$status" in
    PASS) PASS_COUNT=$((PASS_COUNT + 1)) ;;
    FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
    SKIP) SKIP_COUNT=$((SKIP_COUNT + 1)) ;;
  esac
}

run_step() {
  local name="$1"
  local cmd="$2"
  echo ""
  echo "==> [$name] $cmd"
  if bash -c "$cmd"; then
    record_step "$name" "PASS" "$cmd"
  else
    record_step "$name" "FAIL" "$cmd"
  fi
}

echo "================================================================"
echo " Code Factory Stack Verifier"
echo " Target: $TARGET_DIR (package manager: $PM)"
echo "================================================================"

# 1. TypeScript typecheck
if [[ -f "tsconfig.json" ]]; then
  if has_script "typecheck"; then
    run_step "TypeScript" "$PM_RUN typecheck"
  else
    run_step "TypeScript" "$PM_EXEC tsc --noEmit"
  fi
else
  record_step "TypeScript" "SKIP" "no tsconfig.json"
fi

# 2. Linter
if has_script "lint"; then
  run_step "Lint" "$PM_RUN lint"
else
  record_step "Lint" "SKIP" "no lint script in package.json"
fi

# 3. Tests (Vitest / npm test)
if has_script "test"; then
  if [[ "$WITH_COVERAGE" -eq 1 ]]; then
    if [[ "$PM" == "npm" ]]; then
      run_step "Tests (Coverage)" "$PM_RUN test -- --coverage"
    else
      run_step "Tests (Coverage)" "$PM_RUN test --coverage"
    fi
  else
    run_step "Tests" "$PM_RUN test"
  fi
elif [[ -f "vitest.config.ts" || -f "vitest.config.mts" || -f "vitest.config.js" ]]; then
  if [[ "$WITH_COVERAGE" -eq 1 ]]; then
    run_step "Vitest (Coverage)" "$PM_EXEC vitest run --coverage"
  else
    run_step "Vitest" "$PM_EXEC vitest run"
  fi
else
  record_step "Tests" "SKIP" "no test script or vitest.config.* found"
fi

# 4. Fast static boundary & leak scan (NEXT_PUBLIC_* secrets + service_role in client components)
echo ""
echo "==> [Static Boundary Scan] Checking for NEXT_PUBLIC_* secret vars & client service_role leaks"
if python3 - "$TARGET_DIR" <<'PY'
import pathlib, re, sys

root = pathlib.Path(sys.argv[1])
skip_dirs = {"node_modules", ".next", ".git", "dist", "build", "coverage", ".turbo", ".vercel"}
code_exts = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}

next_pub_secret = re.compile(
    r"\b(?:NEXT_PUBLIC_|VITE_)[A-Z0-9_]*(?:SECRET|PRIVATE_KEY|SERVICE_ROLE|DATABASE_URL|DB_PASSWORD|ADMIN_KEY|SIGNING_KEY|WEBHOOK_SECRET|ACCESS_TOKEN)[A-Z0-9_]*\b"
)
use_client_re = re.compile(r"^\s*[\x27\x22]use client[\x27\x22]\s*;?", re.MULTILINE)
service_role_re = re.compile(r"\b(?:SUPABASE_SERVICE_ROLE_KEY|service_role)\b")

issues = []
for p in root.rglob("*"):
    if any(part in skip_dirs for part in p.parts):
        continue
    if not p.is_file() or p.suffix not in code_exts:
        continue
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        continue
    rel = p.relative_to(root)
    for m in next_pub_secret.finditer(text):
        issues.append(f"{rel}: exposed secret-like client env var '{m.group(0)}'")
    if use_client_re.search(text):
        for m in service_role_re.finditer(text):
            issues.append(f"{rel}: '{m.group(0)}' referenced inside a 'use client' module")

if issues:
    print("\n".join(issues))
    sys.exit(1)
PY
then
  record_step "Static Boundary Scan" "PASS" "0 NEXT_PUBLIC_* secret or client service_role leaks"
else
  record_step "Static Boundary Scan" "FAIL" "client secret/service_role exposure detected"
fi

# 5. Production build
if [[ "$SKIP_BUILD" -eq 1 ]]; then
  record_step "Build" "SKIP" "--skip-build specified"
elif has_script "build"; then
  run_step "Build" "$PM_RUN build"
else
  record_step "Build" "SKIP" "no build script in package.json"
fi

# 6. Platform readiness hints (non-blocking informational checks)
echo ""
echo "==> [Platform Context]"
[[ -f "next.config.ts" || -f "next.config.mjs" || -f "next.config.js" ]] && echo "  • Next.js config detected (verify maxDuration & Edge runtime compatibility)."
[[ -f "wrangler.jsonc" || -f "wrangler.toml" || -f "wrangler.json" ]] && echo "  • Cloudflare Wrangler detected (run: npx wrangler types && npx wrangler deploy --dry-run)."
[[ -d "supabase" ]] && echo "  • Supabase directory detected (run: npx supabase db diff and verify RLS policies)."

echo ""
echo "================================================================"
echo " Verification Summary: $PASS_COUNT passed, $FAIL_COUNT failed, $SKIP_COUNT skipped"
echo "================================================================"
for line in "${SUMMARY_LINES[@]}"; do
  echo "$line"
done

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
exit 0
