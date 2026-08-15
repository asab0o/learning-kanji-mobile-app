#!/usr/bin/env bash
# 単一の合格基準。これが通れば「完了」と言ってよい。
# Stop フックからも呼ばれる。
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}" || exit 1

fail=0

run() {
  local name=$1
  shift
  echo "── $name"
  if output=$("$@" 2>&1); then
    echo "   ✓ $name"
  else
    echo "   ✗ $name"
    echo "$output"
    fail=1
  fi
}

run "typecheck" pnpm exec tsc --noEmit
run "lint"      pnpm exec eslint .
run "test"      pnpm exec jest --silent --passWithNoTests
run "content"   pnpm exec tsx scripts/validate-content.ts

if [ $fail -eq 0 ]; then
  echo "全チェック通過"
else
  echo "チェック失敗"
fi

exit $fail
