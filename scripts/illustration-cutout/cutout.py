"""Midjourney の白背景生画像を、透過・正方形・サイズ正規化した漢字イラストにする。

    uv run --project scripts/illustration-cutout \
        scripts/illustration-cutout/cutout.py

- 対象50字は `src/content/index.ts` の `KanjiEntry` から読む(manifest は持たない)。
- 入力は `assets/temp/<illustrationKey>.png`(.gitignore 済みのスクラッチ置き場)。
  対応表は `--list`、または `docs/対象漢字リスト.md`「illustrationKey 対応表」。
- 出力は `assets/kanji/<illustrationKey>.png`。1辺 1024px・P モード PNG(256色 + tRNS)。
  これがアプリ同梱の正(`docs/architecture.md` のアセット規約)。
- **アプリのランタイムからは呼ばない。** 手元で1回動かす開発ツールで、成果の PNG だけが同梱される。
- 背景の抜き方は `keying.py`(外周と地続きの白だけを抜く)。同じ生画像なら出力バイト列は
  毎回同じ(乱数も学習モデルも使わず、量子化は `dither=NONE`、Pillow は tIME を書かない)。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from content import Kanji, markdown_table, read_kanji  # noqa: E402
from geometry import finalize, pad_to_square, trim_to_alpha  # noqa: E402
from keying import key_out  # noqa: E402

OUT_SIZE = 1024
MARGIN_RATIO = 0.08
# 縁の feather が1画素混じっても bbox が暴れないよう、この alpha 未満は背景扱いで trim する。
TRIM_ALPHA_THRESHOLD = 8
# 被写体がこの割合を切ったら、抜きすぎ(ほぼ空のフレーム)を疑って警告する。
MIN_SUBJECT_RATIO = 0.005
# Midjourney からの持ち込みでありうる拡張子。先に見つかったものを使う
RAW_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp")


def find_raw(raw_root: Path, key: str) -> Path | None:
    for suffix in RAW_SUFFIXES:
        candidate = raw_root / f"{key}{suffix}"
        if candidate.exists():
            return candidate
    return None


def cut_out(src: Path) -> Image.Image:
    """白背景を抜く。詳細と、この方式を選んだ理由は `keying.py`。"""
    with Image.open(src) as raw:
        return key_out(raw)


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


def subject_ratio(img: Image.Image) -> float:
    """不透明ピクセルの割合。抜きすぎの検知だけに使う。"""
    return float((np.asarray(img.getchannel("A")) >= 128).mean())


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

    done: list[tuple[Kanji, str, str]] = []
    thin: list[str] = []
    for kanji, raw in found:
        dest = args.out_root / f"{kanji.key}.png"
        cut = cut_out(raw)
        if subject_ratio(cut) < MIN_SUBJECT_RATIO:
            thin.append(kanji.key)
        kb = save_png(normalize(cut), dest) / 1024
        done.append((kanji, raw.name, f"{kb:.0f}KB"))

    report(done, todo, args.out_root)
    if thin:
        print(
            f"\n!! ほぼ全部抜けた: {', '.join(thin)}"
            "\n   生画像の背景が白でないか、被写体の輪郭が閉じていない可能性がある",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
