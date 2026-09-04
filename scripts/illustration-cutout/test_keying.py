"""keying.py の白フラッドフィルのテスト。

    uv run --project scripts/illustration-cutout pytest scripts/illustration-cutout

守りたいのは1点 —— **輪郭線の内側にある白を背景と間違えないこと**。
これを間違えたのが差し替え前の rembg で、塗られていない白い山が丸ごと消えていた。
"""

from __future__ import annotations

import numpy as np
from keying import key_out, paper_mask, paper_level, subject_mask, white_tol
from PIL import Image, ImageDraw

WHITE = (255, 255, 255)
INK = (30, 30, 30)
# 真っ白な紙(255)なら実効しきい値は 250。それを下回る淡い色＝被写体側
WASH = (225, 235, 245)
# 紙が沈んでいる生画像(yama.png 相当。実測の中央値は 241)
DIM_PAPER = (242, 243, 245)


def _paper(size: int = 200, fill=WHITE) -> Image.Image:
    return Image.new("RGB", (size, size), fill)


def _alpha(img: Image.Image, **kw) -> np.ndarray:
    return np.asarray(key_out(img, **kw).getchannel("A"))


def test_white_inside_a_closed_outline_survives():
    """塗られていない白い山 = 枠線の内側の白。ここが残らないと意味が無い。"""
    img = _paper()
    ImageDraw.Draw(img).rectangle((50, 50, 150, 150), outline=INK, width=3)

    a = _alpha(img)
    assert a[100, 100] == 255, "枠の内側の白が抜けている"
    assert a[10, 10] == 0, "外周の白が残っている"


def test_paper_mask_excludes_enclosed_white():
    img = _paper()
    ImageDraw.Draw(img).rectangle((50, 50, 150, 150), outline=INK, width=3)

    paper = paper_mask(np.asarray(img))
    assert paper[10, 10]
    assert not paper[100, 100]


def test_speckles_inside_a_pale_wash_are_filled():
    """淡い色面には白判定に届く粒が散る。穴だらけに切り抜かれないこと。"""
    img = _paper()
    ImageDraw.Draw(img).ellipse((40, 40, 160, 160), fill=WASH)
    for x, y in ((80, 80), (95, 110), (120, 90)):
        img.putpixel((x, y), WHITE)

    a = _alpha(img)
    assert a[80, 80] == 255
    assert a[110, 95] == 255


def test_isolated_grain_dots_in_the_background_are_dropped():
    img = _paper()
    ImageDraw.Draw(img).ellipse((70, 70, 130, 130), fill=WASH)
    img.putpixel((15, 15), INK)
    img.putpixel((15, 16), INK)

    a = _alpha(img)
    assert a[15, 15] < 8, "紙粒の孤立ドットが被写体として残っている"
    assert a[100, 100] == 255


def test_subject_touching_the_image_edge_is_not_eaten():
    """地面が画像の端まで伸びる絵で、端が削れて痩せないこと。"""
    img = _paper()
    ImageDraw.Draw(img).rectangle((0, 120, 199, 199), fill=WASH)

    a = _alpha(img)
    assert a[160, 0] >= 250
    assert a[160, 199] >= 250


def test_same_input_gives_the_same_alpha():
    img = _paper()
    ImageDraw.Draw(img).ellipse((40, 40, 160, 160), fill=WASH)
    assert np.array_equal(_alpha(img), _alpha(img.copy()))


# --- しきい値 -----------------------------------------------------------------


def test_threshold_follows_the_paper_of_this_image():
    """紙の明るさは生画像ごとに 240〜255 と幅がある。固定値だとどちらかで破綻する。"""
    assert white_tol(np.asarray(_paper())) == 250
    assert white_tol(np.asarray(_paper(fill=DIM_PAPER))) == 237


def test_threshold_is_measured_from_the_edge_not_the_middle():
    """中央を被写体が占めていても、外周から測るので紙を見失わない。"""
    img = _paper()
    ImageDraw.Draw(img).ellipse((30, 30, 170, 170), fill=WASH)
    assert paper_level(np.asarray(img)) == 255


def test_threshold_is_clipped_into_a_sane_range():
    """紙が測れないほど暗い生画像でも、しきい値が被写体側まで落ちない。"""
    assert white_tol(np.asarray(_paper(fill=(60, 60, 60)))) == 200
    assert white_tol(np.asarray(_paper(fill=(255, 255, 255)))) <= 253


def test_dim_paper_is_still_removed():
    """紙が 242 の生画像(yama.png 相当)で背景が丸ごと残らない。"""
    img = _paper(fill=DIM_PAPER)
    ImageDraw.Draw(img).ellipse((60, 60, 140, 140), fill=WASH)

    a = _alpha(img)
    assert a[10, 10] == 0
    assert a[100, 100] == 255


# --- 輪郭線の途切れ -----------------------------------------------------------


def test_paper_leaking_through_a_broken_outline_is_filled_back():
    """輪郭線が途切れると紙が内側へ流れ込む。実際に mountain の地面に穴が空いた。"""
    img = _paper(size=400)
    d = ImageDraw.Draw(img)
    d.ellipse((100, 100, 300, 300), fill=WASH)
    # 被写体を外周の紙まで貫く細い白い筋(＝線の途切れから流れ込んだ紙)
    d.line((200, 0, 200, 150), fill=WHITE, width=3)

    a = _alpha(img)
    assert a[140, 200] == 255, "流れ込んだ紙が穴として残っている"


def test_a_large_gap_stays_transparent_even_when_its_neck_is_pinched():
    """細い入口から広がる背景は、closing で入口が塞がっても埋め戻さない。

    埋め戻すのは「輪郭線の途切れから漏れた」程度の小さい穴だけ、という線引き。
    """
    img = _paper(size=400)
    d = ImageDraw.Draw(img)
    d.ellipse((60, 60, 340, 340), fill=WASH)
    d.ellipse((140, 140, 260, 260), fill=WHITE)  # 直径 120px の空洞
    d.line((200, 0, 200, 150), fill=WHITE, width=3)  # 外へ通じる細い首

    a = _alpha(img)
    assert a[200, 200] == 0, "大きな空洞まで埋まっている"
    assert a[100, 200] == 255


def test_fill_does_not_touch_background_that_reaches_the_edge():
    """腕と胴の隙間のように外へ通じている背景は、細くても埋めない。"""
    img = _paper(size=400)
    d = ImageDraw.Draw(img)
    d.rectangle((100, 100, 300, 399), fill=WASH)
    d.rectangle((180, 200, 220, 399), fill=WHITE)  # 下端まで抜けた細い隙間

    subject = subject_mask(np.asarray(img))
    assert not subject[350, 200], "外へ通じている隙間が埋まっている"
