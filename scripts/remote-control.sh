#!/usr/bin/env bash
# スマホの Claude アプリからこのリポジトリで作業するための Remote Control 起動。
#
# `claude remote-control`（サーバモード）は --add-dir を受け付けないため、
# 対話セッションのまま Remote Control を有効にする `claude --remote-control` を使う。
# 起動後、下矢印キーでフッターの接続表示を選んで Enter → QR とセッションURLが出る。
# セッションを終えたら Ctrl+C か /exit。
#
# 注意: このプロジェクトはデフォルトがプランモード。スマホから投げたプロンプトも
# 承認なしには実装に入らないので、承認は手元の端末か Remote Control のUIで行う。
set -euo pipefail
cd "$(dirname "$0")/.."
exec claude --remote-control "kanji-app"
