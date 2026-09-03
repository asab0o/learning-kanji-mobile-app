"""Midjourney の白背景生画像を、透過・正方形・サイズ正規化した漢字イラストにする。

    uv run --project scripts/illustration-cutout \
        scripts/illustration-cutout/cutout.py

- 対象50字は `src/content/index.ts` の `KanjiEntry` から読む(manifest は持たない)。
- 入力は `assets/temp/<illustrationKey>.png`(.gitignore 済みのスクラッチ置き場)。
  対応表は `--list`、または `docs/対象漢字リスト.md`「illustrationKey 対応表」。
- 出力は `assets/kanji/<illustrationKey>.png`。1辺 1024px・P モード PNG(256色 + tRNS)。
  これがアプリ同梱の正(`docs/architecture.md` のアセット規約)。
- **アプリのランタイムからは呼ばない。** 手元で1回動かす開発ツールで、成果の PNG だけが同梱される。
- 同じ生画像 + 同じ rembg モデル + 同じマシンなら、出力バイト列は毎回同じ
  (量子化は `dither=NONE`、Pillow は tIME チャンクを書かない)。
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from content import Kanji, markdown_table, read_kanji  # noqa: E402
from geometry import finalize, pad_to_square, trim_to_alpha  # noqa: E402

OUT_SIZE = 1024
MARGIN_RATIO = 0.08
# rembg のハローが1画素混じっても bbox が暴れないよう、この alpha 未満は背景扱いで trim する。
TRIM_ALPHA_THRESHOLD = 8
# フラットな線画では u2net より isnet-general-use のほうが細い輪郭を残しやすい。
# 迷ったらここを "u2net" に戻してテスト字で見比べる(plan のリスク欄)。
MODEL = "isnet-general-use"
# Midjourney からの持ち込みでありうる拡張子。先に見つかったものを使う
RAW_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp")


def find_raw(raw_root: Path, key: str) -> Path | None:
    for suffix in RAW_SUFFIXES:
        candidate = raw_root / f"{key}{suffix}"
        if candidate.exists():
            return candidate
    return None


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


def report(done: list[tuple[Kanji, str, str]], todo: list[Kanji], out_root: Path) -> None:
    if done:
        width = max(len(f"{k.key} ({k.character})") for k, _, _ in done)
        print(f"\n{'key':<{width}} {'入力':<24} {'出力':>8}")
        for k, source, kb in done:
            print(f"{f'{k.key} ({k.character})':<{width}} {source:<24} {kb:>8}")
        print(f"\n-> {out_root}/<illustrationKey>.png  ({OUT_SIZE}px, P mode PNG + tRNS)")

    print(f"\n処理済み {len(done)} 字 / 残り {len(todo)} 字")
    if todo:
        print("生画像がまだ無い字(assets/temp/<key>.png として置く):")
        for chapter in sorted({k.chapter for k in todo}):
            keys = [f"{k.key}({k.character})" for k in todo if k.chapter == chapter]
            print(f"  第{chapter}章: {' '.join(keys)}")


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--content", type=Path, default=Path("src/content/index.ts"))
    ap.add_argument("--raw-root", type=Path, default=Path("assets/temp"))
    ap.add_argument("--out-root", type=Path, default=Path("assets/kanji"))
    ap.add_argument("--only", nargs="+", metavar="KEY", help="この illustrationKey だけ処理する")
    ap.add_argument("--list", action="store_true", help="漢字と illustrationKey の対応表を出して終わる")
    args = ap.parse_args()

    entries = read_kanji(args.content)
    if args.list:
        print(markdown_table(entries))
        return 0

    if args.only:
        known = {k.key for k in entries}
        unknown = [key for key in args.only if key not in known]
        if unknown:
            print(f"!! 対象50字に無い key: {', '.join(unknown)}", file=sys.stderr)
            return 1
        entries = [k for k in entries if k.key in set(args.only)]

    found = [(k, raw) for k in entries if (raw := find_raw(args.raw_root, k.key))]
    todo = [k for k in entries if find_raw(args.raw_root, k.key) is None]

    if not found:
        print(f"!! {args.raw_root}/<illustrationKey>.png が1つも見つからない", file=sys.stderr)
        report([], todo, args.out_root)
        return 1

    from rembg import new_session

    session = new_session(MODEL)
    done: list[tuple[Kanji, str, str]] = []
    for kanji, raw in found:
        dest = args.out_root / f"{kanji.key}.png"
        kb = save_png(normalize(cut_out(raw, session)), dest) / 1024
        done.append((kanji, raw.name, f"{kb:.0f}KB"))

    report(done, todo, args.out_root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
