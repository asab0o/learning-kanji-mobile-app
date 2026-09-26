# store-screenshot

シミュレータで撮ったスクリーンショットに、桜テーマの背景と2行の見出しを付けて、
App Store Connect にそのまま上げられる **1284 × 2778** の PNG にする開発ツール。
アプリのランタイムからは呼ばない。

寸法・色・並べる順と見出しの文言は `docs/store-listing.md`「スクリーンショット」が正。

## 使い方

1. **iPhone 17 Pro Max** のシミュレータで撮る(1320 × 2868 になる。それ以外の寸法は弾く)

   ```
   xcrun simctl io <UDID> screenshot raw.png
   ```

2. 見出しを2行に分けて渡す

   ```
   uv run --project scripts/store-screenshot \
     python scripts/store-screenshot/compose.py raw.png 1-conversation.png "Meet kanji inside" "a conversation"
   ```

見出しのフォントは macOS 同梱の Georgia(`/System/Library/Fonts/Supplemental/Georgia.ttf`)。
macOS 以外では動かない。

## なぜ 1320 × 2868 で組んでから縮めるのか

撮影に使う Pro Max の画面がちょうど 1320 × 2868 で、ASC の iPhone の枠は 6.5インチ
(1242 × 2688 / 1284 × 2778)しか受け付けない。縦横比がわずかに違うので、引き伸ばさずに
幅 1284 へ等倍縮小し、下端の背景 12px を切っている。スクショ本体は切れない。
