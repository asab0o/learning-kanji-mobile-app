"""白背景の生画像から alpha を作る。学習モデル(rembg)は使わない。

**なぜフラッドフィルなのか。** rembg は顕著性セグメンテーションなので「白い領域＝背景」と
判定する。輪郭線の内側にある白 —— 塗られていない山、白いシャツ、日の白いハイライト ——
まで被写体ごと抜けてしまう(2026-09-04 実測: `mountain-v2.png` の真ん中の白い山は
alpha 0、alpha matting を切っても 15)。

紙の白を **「画像の外周から、白だけを辿って到達できる領域」** と定義すればこれは起きない。
内側の白は定義上ぜったいに背景にならない。おまけにモデルのダウンロードが要らず、
完全に決定論的で、1枚あたり数十msで終わる。

**この方式が前提にすること**: 被写体が紙より暗い輪郭線で閉じていること。線が途切れて
いると、そこから紙の白が内側へ流れ込む(`MAX_HOLE_RATIO` で小さい流れ込みは埋め戻すが、
大きく破れていると救えない)。

**この方式で救えないもの**: 輪郭線が無く、端が白へフェードしていく淡いにじみ
(空のグラデーションなど)。どんなしきい値で切っても境界が決まらず不定形になる。
これは生画像側で直す —— `docs/画風プロンプト定義.md`「切り抜きが通る絵の条件」。
"""

from __future__ import annotations

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import binary_closing, binary_erosion, generate_binary_structure, label

# 白判定のしきい値は画像ごとに測る(`paper_level`)。生画像によって紙の明るさが
# 240〜255 と幅があり、固定値だと「暗い紙の絵は背景が丸ごと残る」「明るい紙の絵は
# 淡い色面が斑に抜ける」のどちらかに必ず倒れるため。紙の代表値からこの数だけ下げる
WHITE_MARGIN = 5
# 測った紙の値がここから外れたら生画像がおかしい。安全側に丸める
WHITE_TOL_RANGE = (200, 253)
# 淡い色面(薄い水色の空、水彩の草地)には白判定に届く粒が散る。背景がこの半径より
# 細く入り込んだ筋は埋める。広い紙の余白は残るので、腕と胴の隙間までは埋まらない
CLOSE_RADIUS = 6
# 背景に散った紙粒の孤立ドットを捨てる(px)。線画のいちばん細い点より小さく
MIN_OBJECT = 64
# 画像のどの端にも接していない背景で、面積がこの割合より小さいものは輪郭線の途切れから
# 紙が流れ込んだ穴とみなして埋め戻す。1024px 角で約 3100px(直径 63px の円)。
# 意図的な抜き(輪の内側など)はこれより大きいはずなので残る
MAX_HOLE_RATIO = 0.003
# alpha の縁をこの px だけ内側に寄せてから、下の feather でぼかす。
# 縁のピクセルは白背景に近い色なので、寄せないと暗いテーマで白いハローになる
EDGE_SHRINK = 1
# 縁のアンチエイリアス(ガウスぼかしの半径 px)
FEATHER = 1.2


def _disk(radius: int) -> np.ndarray:
    y, x = np.ogrid[-radius : radius + 1, -radius : radius + 1]
    return x * x + y * y <= radius * radius


def paper_level(rgb: np.ndarray, ring: float = 0.02) -> int:
    """外周の帯から紙の明るさの代表値を測る。被写体が端に掛かっても中央値なら効く。"""
    band = max(1, int(round(min(rgb.shape[:2]) * ring)))
    v = rgb.min(axis=2)
    edges = np.concatenate(
        [v[:band].ravel(), v[-band:].ravel(), v[:, :band].ravel(), v[:, -band:].ravel()]
    )
    return int(np.median(edges))


def white_tol(rgb: np.ndarray) -> int:
    lo, hi = WHITE_TOL_RANGE
    return int(np.clip(paper_level(rgb) - WHITE_MARGIN, lo, hi))


def paper_mask(rgb: np.ndarray, tol: int | None = None) -> np.ndarray:
    """外周と地続きの白＝紙の背景。内側に閉じた白は含まない。"""
    if tol is None:
        tol = white_tol(rgb)
    white = rgb.min(axis=2) >= tol
    labels, _ = label(white)
    edges = np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])
    outer = np.unique(edges)
    outer = outer[outer != 0]
    if outer.size == 0:
        return np.zeros(white.shape, dtype=bool)
    return np.isin(labels, outer)


def fill_leaks(subject: np.ndarray, max_hole: int) -> np.ndarray:
    """輪郭線の途切れから紙が流れ込んだ穴を埋め戻す。

    埋めるのは **画像のどの端にも接していない** 背景だけ。腕と胴の隙間のように
    外へ通じている背景は、どれだけ細くても端に届くので触らない。
    """
    labels, count = label(~subject)
    if count == 0:
        return subject
    border = np.unique(
        np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])
    )
    sizes = np.bincount(labels.ravel())
    keep = sizes > max_hole
    keep[border] = True
    keep[0] = True  # ラベル0は被写体そのもの
    return subject | ~keep[labels]


def subject_mask(
    rgb: np.ndarray,
    tol: int | None = None,
    close_radius: int = CLOSE_RADIUS,
    min_object: int = MIN_OBJECT,
    max_hole_ratio: float = MAX_HOLE_RATIO,
) -> np.ndarray:
    """紙以外＝被写体。粒を埋め、流れ込みを埋め戻し、孤立した小片を捨てた真偽マスク。"""
    subject = ~paper_mask(rgb, tol)
    if close_radius > 0:
        # closing は縁で erosion 側が外を背景とみなすため、元のマスクと OR して
        # 画像端に接した被写体が削られないようにする(closing は本来 extensive)
        subject |= binary_closing(subject, _disk(close_radius))
    if max_hole_ratio > 0:
        subject = fill_leaks(subject, int(subject.size * max_hole_ratio))
    if min_object > 1:
        labels, count = label(subject, structure=generate_binary_structure(2, 2))
        if count:
            sizes = np.bincount(labels.ravel())
            sizes[0] = 0
            subject = np.isin(labels, np.flatnonzero(sizes >= min_object))
    return subject


def key_out(
    img: Image.Image,
    tol: int | None = None,
    close_radius: int = CLOSE_RADIUS,
    min_object: int = MIN_OBJECT,
    max_hole_ratio: float = MAX_HOLE_RATIO,
    edge_shrink: int = EDGE_SHRINK,
    feather: float = FEATHER,
) -> Image.Image:
    """白背景を抜いた RGBA を返す。色は生画像のまま、alpha だけを作る。"""
    rgb = np.asarray(img.convert("RGB"))
    subject = subject_mask(rgb, tol, close_radius, min_object, max_hole_ratio)
    if edge_shrink > 0:
        # border_value=1 で「画像の外は被写体」と見なし、端に接した被写体を削らない
        subject = binary_erosion(subject, _disk(edge_shrink), border_value=1)
    alpha = Image.fromarray(np.where(subject, 255, 0).astype(np.uint8))
    if feather > 0:
        alpha = alpha.filter(ImageFilter.GaussianBlur(feather))
    out = Image.new("RGBA", img.size)
    out.paste(img.convert("RGB"))
    out.putalpha(alpha)
    return out
