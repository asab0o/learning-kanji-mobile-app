/**
 * 漢字の樹のレイアウト選択(要件定義書 4.5「実装方針」)。
 *
 * 枝の座標は動的計算しない。**語数ごとのスロット表を当てはめる**だけ。
 * 実データは1字あたり 2〜4 語(133語 / 50字)なので 1〜4 語を個別に持ち、
 * 5語以上は将来コンテンツが増えても落ちないための扇形フォールバックにする。
 *
 * **色を返さない。** 返すのは `readingType` と `state` だけで、色は描画側が
 * `theme.kunBranch` / `theme.onBranch` / `theme.textMuted` から選ぶ(絶対規則1)。
 *
 * 座標はすべて正規化単位(viewBox 100 × 120、左上原点、y は下向き)。
 * 描画側が `containerWidth / 100` を掛けて px に写す。
 *
 * React も theme も `@/db` も import しない。
 */

import type { ReadingType } from '@/content/types';
import type { LeafState } from '@/features/tree/tree';

/** レイアウトに要る最小限。`TreeLeaf` がそのまま渡せる */
export interface LayoutLeaf {
  readingType: ReadingType;
  state: LeafState;
}

export type LayoutPattern = 'single' | 'pair' | 'triple' | 'quad' | 'fan';

export interface Point {
  x: number;
  y: number;
}

/**
 * ラベルは**葉の上**に置く。枝は葉から下へ伸びるので、上に置けばどの葉でも枝と重ならない
 * (下に置くと、真上の葉のラベルが自分の枝の上に乗る)。
 */
export interface LabelPlacement {
  /** ラベル枠の中心 x。枠は `labelWidth` の幅で、viewBox からはみ出さないよう寄せてある */
  x: number;
  /** ラベル枠の**下端** y。枠はここから上へ伸びる */
  y: number;
}

export interface TreeBranch<T extends LayoutLeaf> {
  leaf: T;
  /** 枝の起点。全枝で共通 */
  from: Point;
  /** 二次ベジェの制御点 */
  control: Point;
  /** 葉 / つぼみの中心 */
  to: Point;
  label: LabelPlacement;
}

export interface TreeLayout<T extends LayoutLeaf> {
  pattern: LayoutPattern;
  viewBox: { width: number; height: number };
  /** 中心の漢字を置く位置 */
  center: Point;
  trunk: { from: Point; to: Point };
  /** 訓を先・音を後に並べ替え済み。左のスロットから順に割り当てている */
  branches: TreeBranch<T>[];
  leafRadius: number;
  budRadius: number;
  labelWidth: number;
}

export const VIEW_BOX = { width: 100, height: 120 } as const;
const CENTER: Point = { x: 50, y: 92 };
/** 幹は漢字の下端(100)の少し下で止める。字に食い込ませない */
const TRUNK = { from: { x: 50, y: 120 }, to: { x: 50, y: 102 } } as const;
/** 枝の起点。中心の漢字の上端(84)の少し上。字に触れさせない */
const ORIGIN: Point = { x: 50, y: 82 };
const LEAF_RADIUS = 5;
const BUD_RADIUS = 3.5;
const LABEL_WIDTH = 30;
/** ラベル枠を viewBox の内側に留めるときの余白 */
const LABEL_MARGIN = 2;
/** 葉の縁からラベル枠までの間隔 */
const LABEL_GAP = 2;

/**
 * スロット表(左 → 右)。値は実機を見て調整してよい。
 * テストは座標そのものではなく不変条件(viewBox 内・起点より上・本数)を見る。
 */
const SLOTS: Record<Exclude<LayoutPattern, 'fan'>, Point[]> = {
  single: [{ x: 50, y: 30 }],
  pair: [
    { x: 24, y: 36 },
    { x: 76, y: 36 },
  ],
  triple: [
    { x: 18, y: 46 },
    { x: 50, y: 30 },
    { x: 82, y: 46 },
  ],
  quad: [
    { x: 14, y: 54 },
    { x: 36, y: 32 },
    { x: 64, y: 32 },
    { x: 86, y: 54 },
  ],
};

const FAN_RADIUS = 46;
const FAN_START_DEG = -160;
const FAN_END_DEG = -20;

export function layoutTree<T extends LayoutLeaf>(leaves: T[]): TreeLayout<T> {
  const ordered = sortKunFirst(leaves);
  const pattern = patternFor(ordered.length);
  const slots = pattern === 'fan' ? fanSlots(ordered.length) : SLOTS[pattern];

  const branches = ordered.map((leaf, index) => {
    // スロット表は語数と同じ長さなので index は必ず範囲内。
    // 万一足りなくても落とさず、最後のスロットに重ねる(描画が崩れるだけで済む)。
    const to = slots[index] ?? slots[slots.length - 1] ?? ORIGIN;
    const radius = leaf.state === 'leaf' ? LEAF_RADIUS : BUD_RADIUS;

    return {
      leaf,
      from: ORIGIN,
      control: controlPoint(ORIGIN, to),
      to,
      label: labelFor(to, radius),
    };
  });

  return {
    pattern,
    viewBox: { ...VIEW_BOX },
    center: { ...CENTER },
    trunk: { from: { ...TRUNK.from }, to: { ...TRUNK.to } },
    branches,
    leafRadius: LEAF_RADIUS,
    budRadius: BUD_RADIUS,
    labelWidth: LABEL_WIDTH,
  };
}

/**
 * 訓を先・音を後に。同種別内は入力順を保つ(安定ソート)。
 *
 * `state` はソートキーに使わない。出会って葉になった瞬間に位置が入れ替わると、
 * 「同じ樹が育った」ではなく「別の樹になった」ように見える。
 */
function sortKunFirst<T extends LayoutLeaf>(leaves: T[]): T[] {
  return [...leaves].sort((a, b) => rank(a.readingType) - rank(b.readingType));
}

function rank(type: ReadingType): number {
  return type === 'kun' ? 0 : 1;
}

function patternFor(count: number): LayoutPattern {
  switch (count) {
    case 0:
    case 1:
      return 'single';
    case 2:
      return 'pair';
    case 3:
      return 'triple';
    case 4:
      return 'quad';
    default:
      return 'fan';
  }
}

/** 起点を中心に半径 `FAN_RADIUS` の円弧上を等分する。5語以上の保険 */
function fanSlots(count: number): Point[] {
  const step = (FAN_END_DEG - FAN_START_DEG) / (count - 1);

  return Array.from({ length: count }, (_, index) => {
    const radians = ((FAN_START_DEG + step * index) * Math.PI) / 180;

    return {
      x: round(ORIGIN.x + FAN_RADIUS * Math.cos(radians)),
      y: round(ORIGIN.y + FAN_RADIUS * Math.sin(radians)),
    };
  });
}

/**
 * 起点 → 葉の 55% 地点を外側(幹から離れる向き)へ少しずらす。
 * 直線だと棒に見える。真上の葉はずらす向きが無いので直線のまま。
 */
function controlPoint(from: Point, to: Point): Point {
  const mid = { x: from.x + (to.x - from.x) * 0.55, y: from.y + (to.y - from.y) * 0.55 };
  const side = Math.sign(to.x - from.x);

  return { x: round(mid.x + side * 7), y: round(mid.y + Math.abs(side) * 3) };
}

/** ラベルは葉の真上。枠が viewBox からはみ出す分だけ内側へ寄せる */
function labelFor(to: Point, radius: number): LabelPlacement {
  const half = LABEL_WIDTH / 2;
  const x = Math.min(Math.max(to.x, LABEL_MARGIN + half), VIEW_BOX.width - LABEL_MARGIN - half);

  return { x, y: to.y - radius - LABEL_GAP };
}

/** 浮動小数の桁ノイズを落とす。同じ入力で完全に同じ結果を返すため */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
