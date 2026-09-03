# プラン: illustration-cutout

作成日: 2026-09-03
ステータス: 完了(レビュー通過)
要件定義書の対応箇所: 5.3(視認性)/ 6章「イラスト」/ アーキテクチャ L110

## 目的

Midjourney が出した白背景の生画像を、**透過・正方形・サイズ正規化済みの漢字イラスト
アセット**(`assets/kanji/<illustrationKey>.png`。英語スラッグ。`docs/architecture.md` の
アセット規約に従う)に変換するローカルスクリプトを用意する。
これにより、どのテーマ背景(ノーマル / 桜 / 東京の夜景)の上でもイラストが
白い矩形を出さずに載る(レビュー指摘「透過が無い」の解消)。

## スコープ外

- **イラストの生成そのもの**(Midjourney 側。手作業)
- **50字ぶんの SUBJECT プロンプト一覧づくり**
- **線の太さ・彩度の統一**(レビュー指摘の2点目)。これはプロンプト側(`--sw` / `--s` /
  画像sref)と選別で寄せる問題。本スクリプトには将来 `--normalize` オプションとして
  彩度クランプを足す余地を残すが、今回は実装しない。別タスクとして `docs/画風プロンプト定義.md`
  に追記のみ
- **アプリ側の描画・カード化**(透過アセットを前提に UI がどう載せるか)
- **Midjourney への投入自動化**
- キャラアイコン3枚(`assets/characters/`)の透過化 — 同じスクリプトで後追いできる形にはするが、
  今回の受け入れ対象は漢字イラストのみ

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `scripts/illustration-cutout/cutout.py` | 新規 | rembg で透過 → alpha bbox で trim → 正方形へ均等パディング → 1024px を書き出し → 圧縮 |
| `scripts/illustration-cutout/geometry.py` | 新規 | trim / pad / resize の純粋関数(テスト対象) |
| `scripts/illustration-cutout/manifest.json` | 新規 | `key`(=illustrationKey)/ `kanji` / `source`(入力ファイル名)/ `figure` の対応表 |
| `scripts/illustration-cutout/pyproject.toml` | 新規 | uv プロジェクト定義。`requires-python = ">=3.12,<3.13"`、依存に `rembg` `onnxruntime` `pillow` `pytest` |
| `scripts/illustration-cutout/uv.lock` | 新規 | `uv lock` が生成する推移的依存まで含むロックファイル。コミット対象 |
| `scripts/illustration-cutout/test_geometry.py` | 新規 | 合成画像で幾何変換を検証する pytest |
| `scripts/illustration-cutout/README.md` | 新規 | `uv` 前提(`brew install uv`)、`uv run` の実行手順、モデル初回DL の注意 |
| `scripts/illustration-cutout/.python-version` | 新規 | `uv` が生成。3.12 を指す |
| `.gitignore` | 変更 | `scripts/illustration-cutout/.venv/` `__pycache__/` `.pytest_cache/` `.python-version` を無視 |
| `eslint.config.js` | 変更 | `scripts/illustration-cutout/.venv/**` を lint 対象外に(uv の `.venv` に JS が混ざるため) |
| `assets/kanji/mountain.png` `assets/kanji/walk.png` | 新規 | 山 / 歩 の透過アセット(コミット対象) |
| `docs/画風プロンプト定義.md` | 変更 | §7「制作フロー」に実際のコマンドを追記。線・彩度の統一は別タスクと明記 |

## データモデルの変更

なし。

## 実装ステップ

1. `uv` を導入(`brew install uv`)。`scripts/illustration-cutout/` に `pyproject.toml` を作り、
   `uv python install 3.12` → `uv lock` → `uv sync` で環境を用意する
   (既定の 3.14 は onnxruntime のホイールが無いので `requires-python` で 3.12 に固定)
2. `geometry.py` に純粋関数を書く:
   - `trim_to_alpha(img)` — 完全透明の外周を落とす
   - `pad_to_square(img, margin_ratio)` — 長辺基準の正方形キャンバスに中央配置し、四辺へ
     `margin_ratio` の透明余白を足す
   - `finalize(img, size)` — 指定 px の正方形へ Lanczos 縮小
3. `cutout.py`(`uv run --project scripts/illustration-cutout scripts/illustration-cutout/cutout.py ...` で実行):
   - 引数 `--manifest` `--out-root`(既定 `assets/kanji`)`--raw-root`(既定 `assets/temp`)
   - 各エントリで `rembg.remove(data, alpha_matting=True, alpha_matting_foreground_threshold=240,
     alpha_matting_erode_size=10)` → `geometry` で正規化 → `<out>/<key>.png` に **1024px 1枚**を書き出し
   - Pillow の 256色パレット化(FASTOCTREE, dither なし)で圧縮して保存。外部ツールなし
   - 既に出力があっても上書き(冪等)。処理結果を表で標準出力に出す(key・入力・出力サイズ)
4. `manifest.json` に**学習対象50字のうち生画像ができた字**を記入(`key` は
   `src/content/index.ts` の `illustrationKey`)。まず `mountain`(山)/ `walk`(歩)。
   `sky`(空)は生画像を撮り直してから。画風テスト専用の `思` は対象外(illustrationKey が無い)
5. スクリプトを流し、`assets/kanji/*.png` をシミュレータで3テーマ背景に載せて確認
   (暫定の確認画面 or 既存 db-debug に一時表示を足してよい。確認後に剥がす)
6. `README.md` と `docs/画風プロンプト定義.md` §7 を追記
7. `reviewer` に受け入れ条件で判定してもらう

## 受け入れ条件

対象は「学習対象50字のうち生画像ができた字」。今回コミットするのは `mountain`(山)/
`walk`(歩)の2枚。以下は**この2枚について**の判定。

- [x] `uv run ... cutout.py --manifest ...manifest.json` を実行すると
      `assets/kanji/mountain.png` `assets/kanji/walk.png` が生成される
- [x] 生成された PNG は `1024x1024`・透過あり(P モード + tRNS)で、四隅の alpha が 0、
      縁のアルファ階調が3段以上(実測 99〜110 段 ＝ジャギらない)。
      ※当初「RGBA」としたが、フラット絵は 256色パレット化で劣化なく4〜5倍小さくなるため
      P モードで保存する(400KB → 90KB)
- [x] 被写体 bbox の中心が画像中心から縦横 ±2% 以内(実測 ≤0.1%)、四辺の透明マージン
      6% 以上(実測 8.0%)。`test_geometry.py` に保存後の形を検証するテストを追加した
- [x] 各ファイル 200KB 以下(実測 mountain 40 / walk 91 KB)
- [ ] シミュレータで「東京の夜景」相当の暗色背景の上に表示したとき、周囲に白い矩形が見えない
      … **配線タスク完了後に検証**。`assets/kanji/*.png` はまだどこからも `require()` されて
      おらず Metro のグラフに入らないので、今は実機に絵が出ない。透過自体は機械チェック＋
      合成画像で確認済み(白い矩形は出ない)。暗背景で線画の黒が沈む件はアプリ側の
      載せ方(明るいカード等)の課題として別タスク
- [x] 同じ生画像・同じモデル・同じマシンで 2 回実行すると出力 PNG のバイト列が一致する
      (`dither=NONE`。`test_geometry.py` でも検証)
- [x] `rg "illustration-cutout" src/` が 0 件
- [x] `scripts/illustration-cutout/.venv/` が `.gitignore` により `git status` に出ない
- [x] `pnpm run check` が通る(typecheck / lint / test / content すべて ✓)

## テスト方針

- `test_geometry.py`(pytest 21件)。合成 RGBA 画像を入力に:
  - `geometry.py` の3関数 — trim の切り出し位置と閾値、pad の正方形性・中央寄せ・
    マージン下限・一辺の実測値、finalize の px サイズと非正方形拒否
  - `cutout.normalize → save_png` を通した**保存後の PNG** — 1024正方形・中心 ±2%・
    四辺マージン 6% 以上・再実行でバイト一致(受け入れ条件そのものを機械で守る)
- `rembg` のセグメンテーション品質はユニットテスト対象外。シミュレータで
  3テーマ背景に載せた目視で判定する(受け入れ条件の暗色背景項目)
- Python スクリプトなので `*.test.ts` 規約の対象外。`pnpm run check` は
  「壊していないこと」の確認としてのみ回す

## リスク・未確定事項

- **rembg の誤爆**: 空の生画像に描き込まれたフレーム(囲み線)や、山・歩の地面の緑パッチを
  被写体として残す可能性がある。第一義的にはプロンプト側で消す(`--no border, frame` /
  地面を描かせない)。本スクリプトでは、残った場合に画像編集で alpha を手直しする運用を許容
  (50枚以下なので現実的)。この判断はプランに含める。
  → 実装中に `sky-v2.png` で現実化(下記「実装後の記録」)。trim の alpha 閾値も
  `1 → 8` に上げてハロー1画素で bbox が暴れないようにした
- **ファイル名の規約**: 出力は漢字ではなく `illustrationKey`(英語スラッグ)。
  `docs/architecture.md` のアセット規約、`src/content/types.ts` の `KanjiEntry.illustrationKey`、
  `src/features/reading/kanji-illustration.tsx` の `ILLUSTRATIONS` が同じ契約。
  当初プランが `<漢字>.png` と書いていたのは誤り(レビュー指摘で修正)
- **粒テクスチャのにじみ**: Midjourney の背景に乗る紙粒テクスチャが縁のハローになりうる。
  `alpha_matting_erode_size` と foreground threshold で詰める。詰めきれなければプロンプトの
  `pure solid white background` 指定を強める(別タスク)
- **onnxruntime の導入**: `pyproject.toml` の `requires-python` で 3.12 系に固定し、
  `uv.lock` で `rembg` / `onnxruntime` を推移的依存ごとピンする(`uv` が Python 3.12 を
  自動取得)。初回実行時にモデル(u2net 系、約170MB)をダウンロードするためネットワークが
  要る点を README に明記
- **モデル選択**: 既定 `u2net` か `isnet-general-use`。フラットな線画では後者が縁を拾いやすい
  ことがある。実装ステップ5の目視で決め、`cutout.py` の既定に反映する
- **線の太さ・彩度の統一(レビュー指摘2点目)は本プラン外**。プロンプト(`--sw 180 --s 50`、
  4字ロック後に乱数sref→画像sref)と選別で対応し、必要なら後続タスクで `--normalize` を足す
- **ブランチ**: 現在の作業ツリーは `feat/paywall-gate`。`/implement` は `git fetch` 後の
  最新 `main` から `feat/illustration-cutout` を切って始める

## 実装後の記録

### 2026-09-03 実装

- **出力を2サイズ(1024マスター＋768同梱)から 1024 の1枚に変えた。** 当初案は
  `assets/kanji/@768/` も出す想定だったが、二重に持つ理由が薄い。1024 でも1枚 40〜90KB に
  収まり(50枚で 2〜5MB、要件 5〜10MB 枠内)、表示側の縮小で足りる。マスターを別に残す案も
  `assets/` 外の場所を新設することになるので見送り、再生成が要るときは
  生画像(`assets/temp/`)から回し直す運用にした。受け入れ条件の `@768` 項目は
  「各ファイル 200KB 以下」に統合。
  ※当初の記録に「`assets/` 配下は Metro が丸ごとバンドルする」と書いたが**誤り**。
  `app.json` に `assetBundlePatterns` は無く、Metro は `require()` で到達したアセットだけを
  グラフに入れる(レビュー指摘)。1枚に絞る結論は変わらないが、理由は「二重に持つ意味が
  無い・ツリーを単純に保つ」。
- **圧縮を pngquant → Pillow の 256 色パレット化(FASTOCTREE)に変えた。** 当初は
  pngquant があれば使う設計だったが、未インストールだと人物カットが 400KB 超で
  受け入れ条件を割った。Pillow の量子化は外部ツール不要・`uv.lock` だけで再現でき、
  `dither=NONE` でバイト決定的。実測 400KB → 84KB、アルファ階調 100 段で縁も滑らか。
  出力は RGBA ではなく P モード PNG(＋ tRNS)になる。受け入れ条件の「RGBA」は
  「透過あり」に読み替え。
- **rembg のモデル既定を `isnet-general-use` にした**(リスク欄の未確定を解消)。u2net も
  試すため `cutout.py` の `MODEL` 定数1行で切り替えられるようにしてある。
- **テスト字のうち 空 は不合格。** 生画像 `sky-v2.png` が「囲み枠＋塗りなしの線画」
  だったため、rembg は枠と雲の輪郭だけを抜き、中央がスカスカ・上下非対称になった
  (bbox 内平均アルファ 6、y ズレ 8.9%)。プランのリスク「空のフレーム」が現実化した形。
  空 はフレーム無し・塗りありで撮り直したら manifest に `sky` エントリを足して再実行する。
- **出力ファイル名を漢字から `illustrationKey` に直した(レビューで発覚した blocking)。**
  当初プラン(実装担当が architect 無しで起草)が `assets/kanji/<漢字>.png` と書いており、
  そのまま実装して `山.png` `歩.png` `思.png` をコミットしていた。しかし
  `docs/architecture.md` のアセット規約は「英語スラッグ(`illustrationKey`)」で、
  `src/content/index.ts` の実データ(`mountain` / `walk` …)と
  `src/features/reading/kanji-illustration.tsx` の `ILLUSTRATIONS` map がその契約に依存している。
  漢字ファイル名のままだとアセットを登録できず成果が使えない。`manifest.json` に `key` を
  持たせ、出力名を `<key>.png` に変更。コミット済みだった3枚を作り直し。
- **`思` はコミット対象外。** 学習対象50字の `KanjiEntry` に `思` は無い
  (画風テスト専用の字。`docs/requirements.md` 5.4)。`illustrationKey` が無いので
  `assets/kanji/` に置き場所が無い。今回コミットするのは `mountain` / `walk` の2枚。
- **暗テーマでの視認性は別課題。** 透過は機械チェック済みだが、黒い線画は「東京の夜景」の
  暗背景で沈む。イラスト側では解けない(色を変えると桜・ノーマルで浮く)。アプリ側で
  明るいカードに載せる等の対応が要る。要件 5.3 の視認性の注意に関わるので、
  別タスクとして起票する想定。
- `architect` の起動が却下されたため、プランは実装担当が直接起草した。
- ブランチは `feat/paywall-gate` に未コミットの作業が大量にあったため、`git worktree` で
  `feat/illustration-cutout` を切って作業した(並行セッションの stash 事故を避ける既知の方針)。
- **`pnpm run check` は通過**(typecheck / lint / test / content すべて ✓)。ただし初回は
  ESLint が uv の `.venv` 内の JS(urllib3 の emscripten worker)を拾って `no-var` で
  落ちたため、`eslint.config.js` の `ignores` に `scripts/illustration-cutout/.venv/**` を
  追加した(当初 `/*` で広く切ったのをレビュー指摘で `.venv/**` に絞った)。
- `.gitignore` の `__pycache__` / `.pytest_cache` は `scripts/illustration-cutout/` 配下に
  スコープした(レビュー指摘。リポジトリ全体に効かせない)。
- **レビュー2周(reviewer サブエージェント)。** 1周目: blocking 1件(ファイル名規約)＋
  要修正5件 ＋ 気になる点(決定性の但し書き / eslint・gitignore のスコープ /
  「Metro が assets を丸ごとバンドル」の誤り)。すべて対応。
  2周目: **合格**。修正を全項目 reviewer 自身が実行・実測して確認(pnpm check ✓ /
  pytest 21件 ✓ / mountain 40KB・walk 91KB で中心 ≤0.1%・マージン 8%)。
  追加で `test_saved_png_is_centered_square_with_margin` にハロー1画素のケースを足し、
  閾値配線の回帰をテストで押さえた(threshold=1 に戻すと落ちることを確認、22件パス)。
- コミットするのは `mountain` / `walk` の2枚。`sky` はフレーム無しで撮り直してから。
- **受け入れ条件1(実行すると生成される)は実装者の実行記録**。生画像が `assets/temp/`
  (gitignore)にしか無いため他マシンでは再現不能。生画像を repo に入れない設計の裏返し。

## 後続タスク

1. **`ILLUSTRATIONS` 配線＋暗背景の実機確認** — `src/features/reading/kanji-illustration.tsx`
   の `ILLUSTRATIONS` に `mountain` / `walk` の `require()` を足す(2行、README:52-53 に手順)。
   そのうえでシミュレータ3テーマで白い矩形が出ないことを確認する。
2. **`sky` のフレーム無し再生成** — §2 プロンプトに `--no border, frame` を効かせ、
   塗りのある雲で撮り直し。`manifest.json` に `sky` エントリを足して再実行。
3. **暗テーマでの線画の載せ方** — 黒い線が「東京の夜景」で沈む。明るいカードに載せる等。
   要件 5.3(視認性)。イラスト側では解けない。
