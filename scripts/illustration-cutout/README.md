# illustration-cutout

Midjourney が出した白背景の生画像を、**透過・正方形・1024px** の漢字イラスト
アセット(`assets/kanji/<illustrationKey>.png`)に変換する開発ツール。ファイル名は
漢字ではなく英語スラッグ(`docs/architecture.md` のアセット規約。`KanjiEntry.illustrationKey`
と一致させる。例: 山 → `mountain.png`、歩 → `walk.png`)。

アプリのランタイムからは呼ばない。手元で1回動かし、成果の PNG だけが同梱される
(絶対規則8「ライブAI生成をしない」に抵触しない)。

出力は同じ生画像なら毎回同じバイト列(乱数も学習モデルも使わず、量子化は `dither=NONE`、
Pillow は tIME チャンクを書かない)。浮動小数は使うが、演算順序が固定なので結果は動かない
(Pillow / numpy のビルドを跨いだ一致までは保証していない)。

## 背景の抜き方

**紙の白 = 「画像の外周から、白だけを辿って到達できる領域」**。この定義だと
輪郭線の内側にある白 —— 塗られていない山、白いシャツ、日の白いハイライト ——
は定義上ぜったいに背景にならない。

2026-09-04 まではここで `rembg`(顕著性セグメンテーション)を使っていたが、
rembg は「白い領域＝背景」と判定するので、**被写体の中の白が丸ごと抜けていた**
(実測: 3つ並んだ山のうち塗られていない真ん中の山が alpha 0)。詳細と閾値の意味は
`keying.py` の docstring に書いてある。

白判定のしきい値は画像ごとに外周から測る。生画像によって紙の明るさに
240〜255 の幅があり、固定値だとどちらかの絵で必ず破綻するため。

**前提**: 被写体が紙より暗い輪郭線で閉じていること。線が途切れていると、そこから紙の白が
内側へ流れ込む。小さい流れ込みは埋め戻す(`MAX_HOLE_RATIO`。実際 `mountain` の地面右端に
19×17px の穴が空いていた)が、大きく破れている絵は救えない。

**この方式で救えない絵**: 輪郭線が無く、端が白へフェードしていく淡いにじみ
(空のグラデーションなど)。境界が決まらず不定形の塊になる。生画像側で直す
(`docs/画風プロンプト定義.md`「切り抜きが通る絵の条件」)。

## 必要なもの

- [`uv`](https://docs.astral.sh/uv/) … `brew install uv`

ネットワークは依存のインストール時だけ。モデルのダウンロードは無い。

圧縮は Pillow の 256 色パレット化(FASTOCTREE)で完結する。外部ツールは不要。
フラットな絵なので減色の劣化はほぼ無く、RGBA PNG のまま保存するより 4〜5 倍小さくなる
(実測: 人物カットで 400KB → 85KB)。

## セットアップ

```
uv sync --project scripts/illustration-cutout
```

`requires-python` が `>=3.12,<3.13` なので、`uv` が必要なら Python 3.12 を勝手に取ってくる
(システムの既定が 3.14 でも動く)。依存は `uv.lock` で固定。

## 使い方

**manifest は無い。**対象50字は `src/content/index.ts` の `KanjiEntry` から読み、
生画像はファイル名で紐付ける。既にコードにあるデータを手で複製しないため。

1. 対応表を見て、その字の `illustrationKey` を確認する
   ```
   uv run --project scripts/illustration-cutout \
     scripts/illustration-cutout/cutout.py --list
   ```
   (同じ表が `docs/対象漢字リスト.md`「illustrationKey 対応表」にも貼ってある)
2. Midjourney の生画像を **`assets/temp/<illustrationKey>.png`** として置く
   (`.gitignore` 済み。`.jpg` / `.jpeg` / `.webp` も可)。例: 山 → `assets/temp/mountain.png`
3. 実行(リポジトリ直下から):
   ```
   uv run --project scripts/illustration-cutout \
     scripts/illustration-cutout/cutout.py
   ```
   `assets/temp/` にある字だけを処理して `assets/kanji/<key>.png` を出し、
   **まだ生画像が無い字を章ごとに一覧**で出す。既存の出力は上書き(冪等)
4. 生成後、`src/features/reading/kanji-illustration.tsx` の `ILLUSTRATIONS` に
   `key: require('@/assets/kanji/<key>.png')` を1行足すと画面に出る(このスクリプトの範囲外)

1字だけ焼き直したいときは `--only`:

```
uv run --project scripts/illustration-cutout \
  scripts/illustration-cutout/cutout.py --only sky
```

## テスト

```
uv run --project scripts/illustration-cutout pytest scripts/illustration-cutout
```

自動テストは `geometry.py` の純粋関数、`content.py` の `index.ts` 読み取り、
`keying.py` の抜き(輪郭線の内側の白が残る・外周の白が抜ける・淡い色面の粒が埋まる・
画像端に接した被写体が削れない・紙の明るさに追従する・線の途切れからの流れ込みを埋め戻す)、そして `normalize → save_png` を通した保存後の形
(1024正方形・中心 ±2%・四辺マージン 6% 以上・再実行でバイト一致)。
最終的な絵の善し悪しはシミュレータで3テーマ背景に載せて目視で判断する。

## 効きが悪いとき

まず `keying.py` の定数を1つずつ動かして、テスト字で見比べる。

- **淡い色面が斑に抜ける**(草地や空に穴が空く) … `CLOSE_RADIUS` を上げる。
  ただし上げすぎると腕と胴の隙間のような**細い背景も埋まって白く残る**
- **背景が広く残る** … 紙が白くない生画像。`WHITE_MARGIN` を上げると紙判定が緩む。
  実行時に `!! ほぼ全部抜けた` ではなく背景が残るケースは自動検知していないので目視で
- **被写体の内側に穴が空く** … 輪郭線の途切れから紙が流れ込んでいる。`MAX_HOLE_RATIO` を
  上げると大きい流れ込みまで埋まるが、上げすぎると**意図した抜けも埋まる**
- **背景に黒い点が散る** … 紙粒テクスチャの濃い粒。`MIN_OBJECT` を上げて捨てる。
  上げすぎると小さな描き込み(点、細かい飾り)も一緒に消えるので、テスト字で見比べる
- **暗テーマで縁に白いハローが出る** … `EDGE_SHRINK` を上げる(1 → 2)
- **輪郭線の内側にあるはずの白が抜ける** … 輪郭線が閉じていない。生画像側の問題

## スコープ外

線の太さ・彩度のばらつき(レビュー指摘2点目)はここでは直さない。
Midjourney のプロンプト(`--sw` / `--s` / 画像sref)と選別で寄せる。
`docs/画風プロンプト定義.md` を参照。
