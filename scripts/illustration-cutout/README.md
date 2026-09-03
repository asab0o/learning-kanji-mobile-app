# illustration-cutout

Midjourney が出した白背景の生画像を、**透過・正方形・1024px** の漢字イラスト
アセット(`assets/kanji/<illustrationKey>.png`)に変換する開発ツール。ファイル名は
漢字ではなく英語スラッグ(`docs/architecture.md` のアセット規約。`KanjiEntry.illustrationKey`
と一致させる。例: 山 → `mountain.png`、歩 → `walk.png`)。

アプリのランタイムからは呼ばない。手元で1回動かし、成果の PNG だけが同梱される
(絶対規則8「ライブAI生成をしない」に抵触しない)。

出力は同じ生画像・同じ rembg モデル・同じマシンなら毎回同じバイト列
(量子化は `dither=NONE`、Pillow は tIME チャンクを書かない)。CPU やスレッド数が
変わると alpha matting の末尾ビットが動きうる。

## 必要なもの

- [`uv`](https://docs.astral.sh/uv/) … `brew install uv`
- ネットワーク(初回のみ)。rembg のモデル(isnet-general-use, 約180MB)を
  `~/.u2net/` にダウンロードする

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

1. Midjourney の生画像をリポジトリ直下の `assets/temp/`(.gitignore 済み)に置く
2. `scripts/illustration-cutout/manifest.json` に処理する字を1エントリずつ書く。
   `key` はその字の `illustrationKey`(`src/content/index.ts` の `KanjiEntry` から引く)
   ```json
   [{ "key": "mountain", "kanji": "山", "source": "mountain-v2.png", "figure": false }]
   ```
   `figure` は人物が写っているか(いまは記録のみ。将来の彩度ノーマライズで使う想定。
   `cutout.py` からは読んでいない)。**学習対象50字にある字だけ**書く
   (`思` のような画風テスト専用の字は `assets/kanji/` に置き場所が無い)
3. 実行(リポジトリ直下から):
   ```
   uv run --project scripts/illustration-cutout \
     scripts/illustration-cutout/cutout.py \
     --manifest scripts/illustration-cutout/manifest.json
   ```
   `assets/kanji/<key>.png` が出る。既存は上書き(冪等)。
4. 生成後、`src/features/reading/kanji-illustration.tsx` の `ILLUSTRATIONS` に
   `key: require('@/assets/kanji/<key>.png')` を1行足すと画面に出る(このスクリプトの範囲外)

## テスト

```
uv run --project scripts/illustration-cutout pytest scripts/illustration-cutout
```

自動テストは `geometry.py` の純粋関数と、`normalize → save_png` を通した保存後の形
(1024正方形・中心 ±2%・四辺マージン 6% 以上・再実行でバイト一致)。rembg の抜きの
善し悪しはシミュレータで3テーマ背景に載せて目視で判断する。

実行時に pymatting の `PERFORMANCE WARNING: ... incomplete Cholesky ...` が出ることが
あるが、これは前処理器が別方式にフォールバックしただけで、結果には影響しない。

## 効きが悪いとき

- **フレームや地面が残る / 逆に中身が抜ける**(例: 4字テストの `sky-v2.png` は
  囲み枠＋塗りなしの線画だったため、枠だけ残って中央がスカスカになった)… これは
  生画像側の問題。Midjourney のプロンプトで枠と地面を描かせず(`--no border, frame` /
  地面なし)、`pure solid white background` を効かせて撮り直す
- **白い塗りが暗テーマでうっすら透ける** … 白 on 白の alpha matting で内側が
  alpha 230〜249 になるため。`cutout.py` の `alpha_matting_foreground_threshold` を
  240 → 210 くらいに下げると内側が締まる(ハローも出やすくなるのでテスト4字で見比べる)
- **縁に白いハローが出る** … `alpha_matting_erode_size` を上げる、または `MODEL` を
  `u2net` に変えて見比べる

## スコープ外

線の太さ・彩度のばらつき(レビュー指摘2点目)はここでは直さない。
Midjourney のプロンプト(`--sw` / `--s` / 画像sref)と選別で寄せる。
`docs/画風プロンプト定義.md` を参照。
