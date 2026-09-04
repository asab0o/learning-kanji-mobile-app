"""trim / pad / resize の純粋関数。抜き方(keying.py)に依存しないのでテストしやすい。

ここが illustration-cutout で唯一の自動テスト対象(test_geometry.py)。
"""

from __future__ import annotations

import math

from PIL import Image


def trim_to_alpha(img: Image.Image, threshold: int = 1) -> Image.Image:
    """外周の(ほぼ)透明な帯を落とす。

    alpha が `threshold` 未満のピクセルは背景扱い。既定の 1 は「完全透明だけ落とす」。
    縁の feather は alpha=1〜5 の薄い帯を残し、それを 1 画素でも被写体とみなすと
    bbox が大きく暴れる(被写体が実効数分の1に縮む)。呼び出し側は
    `threshold=8` 程度を渡してこの帯を無視する。

    RGBA 以外は変換する。閾値以上のピクセルが1つも無ければ切り詰めず元画像を返す
    (真っ白＝背景として全部抜けた、などの異常ケースで落とさないため)。
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    mask = img.getchannel("A")
    if threshold > 1:
        mask = mask.point(lambda v: 255 if v >= threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
        return img
    return img.crop(bbox)


def pad_to_square(img: Image.Image, margin_ratio: float = 0.08) -> Image.Image:
    """正方形の透明キャンバスに中央配置し、四辺へ margin_ratio ぶんの透明余白を足す。

    出力の一辺 = ceil(max(w, h) / (1 - 2 * margin_ratio))。
    これで「被写体の長辺 : 余白」がどの絵でも一定になる(縦長の人物も横長の山も揃う)。
    """
    if not 0.0 <= margin_ratio < 0.5:
        raise ValueError(f"margin_ratio must be in [0, 0.5): {margin_ratio}")
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size
    side = math.ceil(max(w, h) / (1.0 - 2.0 * margin_ratio))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((side - w) // 2, (side - h) // 2))
    return canvas


def finalize(img: Image.Image, size: int) -> Image.Image:
    """指定 px の正方形へ Lanczos で縮小(必要なら拡大)。入力は正方形前提。"""
    if img.width != img.height:
        raise ValueError(f"expected a square image, got {img.size}")
    if img.size == (size, size):
        return img
    return img.resize((size, size), Image.LANCZOS)
