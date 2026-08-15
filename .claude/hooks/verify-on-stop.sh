#!/usr/bin/env bash
# Stop フック — 自己修正ループの心臓部。
#
# Claude がターンを終えようとしたときに pnpm run check を回す。
# 失敗したら exit 2 で停止をブロックし、stderr のエラーを Claude に返す。
# Claude はそれを読んで直し、また終了しようとする…を最大 MAX_ATTEMPTS 周繰り返す。
#
# 打ち切りを入れている理由: 直せないエラーで無限にトークンを消費させないため。
# 上限に達したら停止を許可し、Claude には未解決として報告させる。
set -uo pipefail

MAX_ATTEMPTS=3

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

input=$(cat)

session_id=$(printf '%s' "$input" | node -e '
let s = "";
process.stdin.on("data", d => (s += d)).on("end", () => {
  try {
    const j = JSON.parse(s);
    process.stdout.write(String(j.session_id ?? "default"));
  } catch {
    process.stdout.write("default");
  }
})' 2>/dev/null)
[ -n "$session_id" ] || session_id="default"

state_dir=".claude/.state"
mkdir -p "$state_dir"
counter_file="$state_dir/check-attempts-${session_id}"

# --- 検証が不要なターンは即座に抜ける -------------------------------------
# コード・設定・コンテンツに一切変更がないターン(質問への回答だけ等)で
# 数十秒待たせないため。
if git rev-parse --git-dir >/dev/null 2>&1; then
  changed=$(git status --porcelain -- \
    '*.ts' '*.tsx' '*.js' '*.jsx' '*.json' 'package.json' 2>/dev/null)
  if [ -z "$changed" ]; then
    rm -f "$counter_file"
    exit 0
  fi
fi

# --- 検証 -----------------------------------------------------------------
output=$(bash scripts/check.sh 2>&1)
status=$?

if [ $status -eq 0 ]; then
  rm -f "$counter_file"
  exit 0
fi

attempts=0
[ -f "$counter_file" ] && attempts=$(cat "$counter_file" 2>/dev/null || echo 0)
attempts=$((attempts + 1))
printf '%s' "$attempts" > "$counter_file"

if [ "$attempts" -gt "$MAX_ATTEMPTS" ]; then
  rm -f "$counter_file"
  echo "pnpm run check が ${MAX_ATTEMPTS} 回の自己修正でも通らなかったため、自動ループを打ち切りました。未解決のまま終了します。" >&2
  exit 0
fi

cat >&2 <<EOF
pnpm run check が失敗しました(自己修正 ${attempts}/${MAX_ATTEMPTS} 回目)。

以下のエラーを直してから終了してください。

$output

--- 直すときの禁止事項 ---
- テストの削除 / it.skip
- @ts-ignore / eslint-disable による黙らせ
- scripts/validate-content.ts のルールを緩める
これらはチェックを通すのではなくチェックを壊す行為です。
ルール側が誤っていると考えるなら、勝手に変えず開発者に相談してください。
EOF

exit 2
