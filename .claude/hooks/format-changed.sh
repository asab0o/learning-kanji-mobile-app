#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit)
# 変更されたファイルだけを整形する。プロジェクト全体は触らないので1秒未満で終わる。
# 失敗しても編集そのものは妨げない(常に exit 0)。
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# フック入力(JSON)から file_path を取り出す。jq に依存しないよう node を使う。
file=$(node -e '
let s = "";
process.stdin.on("data", d => (s += d)).on("end", () => {
  try {
    const j = JSON.parse(s);
    process.stdout.write(j.tool_input?.file_path ?? "");
  } catch {
    process.stdout.write("");
  }
})' 2>/dev/null)

[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

case "$file" in
  */node_modules/*|*/.expo/*|*/dist/*) exit 0 ;;
esac

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.css)
    pnpm exec prettier --write "$file" >/dev/null 2>&1
    ;;
esac

case "$file" in
  *.ts|*.tsx|*.js|*.jsx)
    pnpm exec eslint --fix "$file" >/dev/null 2>&1
    ;;
esac

exit 0
