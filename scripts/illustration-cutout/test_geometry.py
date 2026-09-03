"""geometry.py の純粋関数と、cutout.normalize→save_png を通した保存後の形のテスト。

    uv run --project scripts/illustration-cutout pytest scripts/illustration-cutout

rembg には触れない(cutout の rembg import は関数ローカルなので import cutout は安全)。
"""

from __future__ import annotations

import math

import pytest
from cutout import normalize, save_png
from geometry import finalize, pad_to_square, trim_to_alpha
from PIL import Image

RED = (255, 0, 0, 255)


def _canvas(w: int, h: int, box: tuple[int, int, int, int], fill=RED) -> Image.Image:
    """透明キャンバスの box 範囲だけ塗った RGBA 画像。"""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for x in range(box[0], box[2]):
        for y in range(box[1], box[3]):
            img.putpixel((x, y), fill)
    return img


# --- trim_to_alpha ------------------------------------------------------------


def test_trim_crops_to_the_opaque_box_and_moves_it_to_origin():
    img = _canvas(100, 80, (10, 20, 40, 60))
    trimmed = trim_to_alpha(img)
    assert trimmed.size == (30, 40)
    # 元 (10,20) の不透明ピクセルが trim 後は (0,0) に来ている
    assert trimmed.getpixel((0, 0))[3] == 255
    assert trimmed.getpixel((29, 39))[3] == 255


def test_trim_keeps_image_when_fully_transparent():
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    assert trim_to_alpha(img).size == (24, 24)


def test_trim_converts_non_rgba():
    img = Image.new("RGB", (10, 10), (255, 255, 255))
    assert trim_to_alpha(img).mode == "RGBA"


def test_trim_default_threshold_treats_faint_halo_as_content():
    img = _canvas(40, 40, (18, 18, 22, 22))  # 中央 4x4 が不透明
    img.putpixel((2, 2), (0, 0, 0, 3))  # 隅に alpha=3 のハロー1画素
    # 既定 threshold=1 はハローも拾うので bbox が (2,2)..(22,22) に広がる
    assert trim_to_alpha(img).size == (20, 20)


def test_trim_high_threshold_ignores_faint_halo():
    img = _canvas(40, 40, (18, 18, 22, 22))
    img.putpixel((2, 2), (0, 0, 0, 3))
    # threshold=8 なら alpha=3 は無視して中央 4x4 だけを切る
    assert trim_to_alpha(img, threshold=8).size == (4, 4)


# --- pad_to_square ----------------------------------------------------------


@pytest.mark.parametrize("w,h", [(40, 20), (20, 40), (30, 30)])
def test_pad_is_square(w: int, h: int):
    out = pad_to_square(_canvas(w, h, (0, 0, w, h)), margin_ratio=0.1)
    assert out.width == out.height


def test_pad_side_is_exact_known_value():
    # 50x30, margin 0.08 -> 一辺 = ceil(50 / 0.84) = 60
    out = pad_to_square(_canvas(50, 30, (0, 0, 50, 30)), margin_ratio=0.08)
    assert out.width == 60
    assert out.width == math.ceil(max(50, 30) / (1 - 2 * 0.08))


def test_pad_centers_content():
    out = pad_to_square(_canvas(50, 30, (0, 0, 50, 30)), margin_ratio=0.08)
    bbox = out.getchannel("A").getbbox()
    assert abs(bbox[0] - (out.width - bbox[2])) <= 1
    assert abs(bbox[1] - (out.height - bbox[3])) <= 1


def test_pad_margin_at_least_ratio():
    out = pad_to_square(_canvas(50, 30, (0, 0, 50, 30)), margin_ratio=0.08)
    bbox = out.getchannel("A").getbbox()
    for gap in (bbox[0], bbox[1], out.width - bbox[2], out.height - bbox[3]):
        assert gap / out.width >= 0.08 - 1e-6


@pytest.mark.parametrize("bad", [-0.1, 0.5, 0.7])
def test_pad_rejects_out_of_range_margin(bad: float):
    with pytest.raises(ValueError):
        pad_to_square(_canvas(10, 10, (0, 0, 10, 10)), margin_ratio=bad)


# --- finalize --------------------------------------------------------------


def test_finalize_resizes_to_exact_square():
    assert finalize(Image.new("RGBA", (600, 600)), 256).size == (256, 256)


def test_finalize_noop_when_already_target():
    src = Image.new("RGBA", (256, 256))
    assert finalize(src, 256) is src


def test_finalize_rejects_non_square():
    with pytest.raises(ValueError):
        finalize(Image.new("RGBA", (256, 200)), 128)


# --- 保存後の形(受け入れ条件そのもの) ------------------------------------------


@pytest.mark.parametrize(
    "box,halo",
    [
        ((0, 0, 300, 120), None),
        ((40, 10, 90, 400), None),
        ((5, 5, 405, 405), None),
        # 隅に薄いハローを1画素置く。cutout.normalize が閾値付き trim を配線していないと
        # bbox がハローまで広がり、被写体が中央から外れてこのテストが落ちる(#3 の回帰ガード)
        ((180, 180, 320, 320), (8, 8)),
    ],
)
def test_saved_png_is_centered_square_with_margin(tmp_path, box, halo):
    """normalize -> save_png を通し、読み戻した PNG が
    「1024 正方形・被写体中心 ±2%・四辺マージン 6% 以上」を満たす。"""
    src = _canvas(500, 500, box)
    if halo is not None:
        src.putpixel(halo, (0, 0, 0, 4))
    dest = tmp_path / "out.png"
    save_png(normalize(src), dest)

    im = Image.open(dest).convert("RGBA")
    assert im.size == (1024, 1024)

    a = im.getchannel("A")
    bbox = a.getbbox()
    cx = (bbox[0] + bbox[2]) / 2
    cy = (bbox[1] + bbox[3]) / 2
    assert abs(cx - 512) / 1024 <= 0.02
    assert abs(cy - 512) / 1024 <= 0.02

    margins = [bbox[0], bbox[1], 1024 - bbox[2], 1024 - bbox[3]]
    assert min(margins) / 1024 >= 0.06


def test_saved_png_is_byte_identical_on_rerun(tmp_path):
    src = _canvas(500, 500, (30, 30, 470, 330))
    a = tmp_path / "a.png"
    b = tmp_path / "b.png"
    save_png(normalize(src), a)
    save_png(normalize(src.copy()), b)
    assert a.read_bytes() == b.read_bytes()
