"""Midjourney の白背景生画像を、透過・正方形・サイズ正規化した漢字イラストにする。

    uv run --project scripts/illustration-cutout \
        scripts/illustration-cutout/cutout.py \
        --manifest scripts/illustration-cutout/manifest.json

- 入力(生画像)は `assets/temp/`(.gitignore 済みのスクラッチ置き場)から読む。
- 出力は `assets/kanji/<illustrationKey>.png`(英語スラッグ。`docs/architecture.md` の
  アセット規約。`KanjiEntry.illustrationKey` と一致させる)。1辺 1024px・
  P モード PNG(256色パレット + tRNS)。これがアプリ同梱の正。
- **アプリのランタイムからは呼ばない。** 手元で1回動かす開発ツールで、成果の PNG だけが同梱される。
- 同じ生画像 + 同じ rembg モデル + 同じマシンなら、出力バイト列は毎回同じ
  (量子化は `dither=NONE`、Pillow は tIME チャンクを書かない)。
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from geometry import finalize, pad_to_square, trim_to_alpha  # noqa: E402

OUT_SIZE = 1024
MARGIN_RATIO = 0.08
# rembg のハローが1画素混じっても bbox が暴れないよう、この alpha 未満は背景扱いで trim する。
TRIM_ALPHA_THRESHOLD = 8
# フラットな線画では u2net より isnet-general-use のほうが細い輪郭を残しやすい。
# 迷ったらここを "u2net" に戻してテスト字で見比べる(plan のリスク欄)。
MODEL = "isnet-general-use"


def cut_out(src: Path, session) -> Image.Image:
    """rembg で背景を抜く。alpha matting で縁の紙粒テクスチャのハローを削る。"""
    from rembg import remove

    out = remove(
        src.read_bytes(),
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10,
    )
    return Image.open(io.BytesIO(out)).convert("RGBA")


def normalize(img: Image.Image) -> Image.Image:
    trimmed = trim_to_alpha(img, threshold=TRIM_ALPHA_THRESHOLD)
    return finalize(pad_to_square(trimmed, MARGIN_RATIO), OUT_SIZE)


def save_png(img: Image.Image, dest: Path) -> int:
    """256色パレットに落として PNG を書き出す。

    フラットな絵なので減色の劣化はほぼ無く、RGBA のまま保存するより 4〜5 倍小さくなる
    (実測: 人物カットで 400KB → 85KB)。FASTOCTREE はアルファを保持する量子化法。
    `dither=NONE` なので入力が同じなら毎回同じバイト列。出力は P モード PNG + tRNS。
    """
    dest.parent.mkdir(parents=True, exist_ok=True)
    palette = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    palette.save(dest, "PNG", optimize=True)
    return dest.stat().st_size


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--raw-root", type=Path, default=Path("assets/temp"))
    ap.add_argument("--out-root", type=Path, default=Path("assets/kanji"))
    args = ap.parse_args()

    entries = json.loads(args.manifest.read_text(encoding="utf-8"))
    missing = [e["source"] for e in entries if not (args.raw_root / e["source"]).exists()]
    if missing:
        print(f"!! 生画像が無い: {', '.join(missing)}  (--raw-root {args.raw_root})", file=sys.stderr)
        return 1

    from rembg import new_session

    session = new_session(MODEL)
    rows: list[tuple[str, str, str]] = []
    for e in entries:
        key, source = e["key"], e["source"]
        dest = args.out_root / f"{key}.png"
        kb = save_png(normalize(cut_out(args.raw_root / source, session)), dest) / 1024
        rows.append((f'{key} ({e["kanji"]})', source, f"{kb:.0f}KB"))

    width = max(len(r[0]) for r in rows)
    src_w = max(len(r[1]) for r in rows)
    print(f"\n{'key':<{width}} {'入力':<{src_w}} {'出力':>8}")
    for key, source, kb in rows:
        print(f"{key:<{width}} {source:<{src_w}} {kb:>8}")
    print(f"\n-> {args.out_root}/<illustrationKey>.png  ({OUT_SIZE}px, P mode PNG + tRNS)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
