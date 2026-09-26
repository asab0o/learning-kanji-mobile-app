"""シミュレータの生スクショに見出しと背景を付け、ASC に上げられる 1284 × 2778 の PNG にする。

使い方(iPhone 17 Pro Max で撮った 1320 × 2868 の PNG を渡す):

    uv run --project scripts/store-screenshot \
        python scripts/store-screenshot/compose.py raw.png out.png "Meet kanji inside" "a conversation"

寸法と色の根拠は docs/store-listing.md「スクリーンショット」。
"""

import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# 1320 × 2868 で組んでから最後に縮める。位置の数値は 1.0.0 の ASC サムネイルから測ったもの
W, H = 1320, 2868
OUT_W, OUT_H = 1284, 2778
TOP, BOTTOM = (0xF6, 0xE7, 0xEC), (0xFB, 0xF4, 0xF4)
TEXT, ACCENT = (0x45, 0x3B, 0x41), (0xD2, 0x83, 0x9C)
SHADOW = (0x6B, 0x4A, 0x55)
FONT_PATH = "/System/Library/Fonts/Supplemental/Georgia.ttf"
LINE_CENTERS = (210, 325)
RULE_Y, RULE_W = 425, 120
SHOT_TOP, SHOT_W, RADIUS = 500, 1056, 56
STATUS_BAR = 190


def compose(raw: Image.Image, lines: tuple[str, str]) -> Image.Image:
    if raw.size != (W, H):
        raise ValueError(f"expected a {W}x{H} screenshot (iPhone 17 Pro Max), got {raw.size[0]}x{raw.size[1]}")

    canvas = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(canvas)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)))

    font = ImageFont.truetype(FONT_PATH, 92)
    for text, cy in zip(lines, LINE_CENTERS):
        d.text((W / 2, cy), text, font=font, fill=TEXT, anchor="mm")
    d.line([((W - RULE_W) / 2, RULE_Y), ((W + RULE_W) / 2, RULE_Y)], fill=ACCENT, width=3)

    # 時刻がショットごとに違うのでステータスバーは落とす
    shot = raw.convert("RGB").crop((0, STATUS_BAR, W, H))
    sh = round(SHOT_W * shot.height / shot.width)
    shot = shot.resize((SHOT_W, sh), Image.LANCZOS)
    x = (W - SHOT_W) // 2

    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, SHOT_W - 1, sh - 1], RADIUS, fill=255)

    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle([x, SHOT_TOP + 24, x + SHOT_W, SHOT_TOP + 24 + sh], RADIUS, fill=70)
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    canvas.paste(Image.new("RGB", (W, H), SHADOW), (0, 0), shadow)
    canvas.paste(shot, (x, SHOT_TOP), mask)

    # 縦横比がわずかに違うので、引き伸ばさずに等倍で縮めて下端の背景を切る
    scaled_h = round(H * OUT_W / W)
    return canvas.resize((OUT_W, scaled_h), Image.LANCZOS).crop((0, 0, OUT_W, OUT_H))


def main(argv: list[str]) -> None:
    if len(argv) != 5:
        sys.exit("usage: compose.py <raw.png> <out.png> <headline line 1> <headline line 2>")
    _, src, out, line1, line2 = argv
    compose(Image.open(src), (line1, line2)).save(out)


if __name__ == "__main__":
    main(sys.argv)
