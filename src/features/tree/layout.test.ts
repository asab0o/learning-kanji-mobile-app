import type { LayoutLeaf, LayoutPattern } from '@/features/tree/layout';
import { layoutTree, VIEW_BOX } from '@/features/tree/layout';

/**
 * 座標そのものを固定値で assert しない。スロット表は実機を見て調整してよい値で、
 * 数値を縛ると調整のたびにテストが壊れるだけになる。見るのは不変条件。
 */
interface Leaf extends LayoutLeaf {
  id: string;
}

const leaf = (id: string, readingType: 'kun' | 'on', state: 'leaf' | 'bud' = 'bud'): Leaf => ({
  id,
  readingType,
  state,
});

const leaves = (count: number): Leaf[] =>
  Array.from({ length: count }, (_, index) => leaf(`w${index}`, index % 2 === 0 ? 'kun' : 'on'));

describe('layoutTree', () => {
  it('訓1・音1を渡すと枝が2本返り、訓が先(= 左のスロット)になる', () => {
    const layout = layoutTree([leaf('kun', 'kun'), leaf('on', 'on')]);

    expect(layout.branches).toHaveLength(2);
    expect(layout.branches[0]?.leaf.id).toBe('kun');
    expect(layout.branches[0]!.to.x).toBeLessThan(layout.branches[1]!.to.x);
  });

  it('入力が音 → 訓の順でも出力は訓が先。同種別内は入力順を保つ', () => {
    // `入` の実データ順を模す: 入る(訓) 入れる(訓) 入学(音) 入り口(訓) を音を先頭に崩したもの
    const layout = layoutTree([
      leaf('nyuugaku', 'on'),
      leaf('hairu', 'kun'),
      leaf('ireru', 'kun'),
      leaf('iriguchi', 'kun'),
    ]);

    expect(layout.branches.map((branch) => branch.leaf.id)).toEqual([
      'hairu',
      'ireru',
      'iriguchi',
      'nyuugaku',
    ]);
  });

  it('state を bud → leaf に変えても枝の座標は動かない(ラベルは半径ぶんだけ上がる)', () => {
    const before = layoutTree([leaf('a', 'kun', 'bud'), leaf('b', 'on', 'bud'), leaf('c', 'on')]);
    const after = layoutTree([leaf('a', 'kun', 'bud'), leaf('b', 'on', 'leaf'), leaf('c', 'on')]);

    expect(after.pattern).toBe(before.pattern);
    after.branches.forEach((branch, index) => {
      const previous = before.branches[index]!;
      expect(branch.from).toEqual(previous.from);
      expect(branch.control).toEqual(previous.control);
      expect(branch.to).toEqual(previous.to);
      expect(branch.label.x).toBe(previous.label.x);
    });
    // 葉のほうがつぼみより大きいので、ラベルだけは少し上がる。位置(x)は変えない
    expect(after.branches[1]!.label.y).toBeLessThan(before.branches[1]!.label.y);
  });

  it('同じ入力で2回呼ぶと完全に同じ結果(乱数・時刻に依存しない)', () => {
    const input = leaves(4);

    expect(layoutTree(input)).toEqual(layoutTree(input));
  });

  it.each<[number, LayoutPattern]>([
    [1, 'single'],
    [2, 'pair'],
    [3, 'triple'],
    [4, 'quad'],
  ])('語数 %i でパターン %s になり、枝の本数が語数と一致する', (count, pattern) => {
    const layout = layoutTree(leaves(count));

    expect(layout.pattern).toBe(pattern);
    expect(layout.branches).toHaveLength(count);
  });

  it.each([5, 8])('語数 %i でも例外を投げず fan になり、枝の本数が語数と一致する', (count) => {
    const layout = layoutTree(leaves(count));

    expect(layout.pattern).toBe('fan');
    expect(layout.branches).toHaveLength(count);
  });

  it.each([1, 2, 3, 4, 5, 8])('語数 %i: すべての葉とラベル枠が viewBox の内側に収まる', (count) => {
    const layout = layoutTree(leaves(count).map((item) => ({ ...item, state: 'leaf' as const })));
    const half = layout.labelWidth / 2;

    for (const branch of layout.branches) {
      expect(branch.to.x - layout.leafRadius).toBeGreaterThanOrEqual(0);
      expect(branch.to.x + layout.leafRadius).toBeLessThanOrEqual(VIEW_BOX.width);
      expect(branch.to.y - layout.leafRadius).toBeGreaterThanOrEqual(0);
      expect(branch.label.x - half).toBeGreaterThanOrEqual(0);
      expect(branch.label.x + half).toBeLessThanOrEqual(VIEW_BOX.width);
      expect(branch.label.y).toBeGreaterThanOrEqual(0);
    }
  });

  it.each([1, 2, 3, 4, 5, 8])(
    '語数 %i: すべての葉が枝の起点より上にあり、幹に重ならない',
    (count) => {
      const layout = layoutTree(leaves(count));

      for (const branch of layout.branches) {
        expect(branch.to.y).toBeLessThan(branch.from.y);
        expect(branch.to.y + layout.leafRadius).toBeLessThan(layout.trunk.to.y);
      }
    }
  );

  it.each([2, 3, 4, 5, 8])('語数 %i: 葉同士が重ならない', (count) => {
    const layout = layoutTree(leaves(count));
    const minGap = layout.leafRadius * 2;

    for (const a of layout.branches) {
      for (const b of layout.branches) {
        if (a === b) {
          continue;
        }
        expect(Math.hypot(a.to.x - b.to.x, a.to.y - b.to.y)).toBeGreaterThanOrEqual(minGap);
      }
    }
  });

  it.each([1, 2, 3, 4, 5, 8])(
    '語数 %i: ラベルは葉の上にあり、枝(葉から下へ伸びる)と重ならない',
    (count) => {
      const layout = layoutTree(leaves(count));

      for (const branch of layout.branches) {
        expect(branch.label.y).toBeLessThan(branch.to.y - layout.budRadius);
      }
    }
  );

  it('制御点は起点と葉の間にあり、真上の葉だけ直線になる', () => {
    const layout = layoutTree(leaves(3));

    for (const branch of layout.branches) {
      expect(branch.control.y).toBeLessThan(branch.from.y);
      expect(branch.control.y).toBeGreaterThan(branch.to.y);
    }
    const top = layout.branches[1]!;
    expect(top.control.x).toBe(top.from.x);
  });

  it('語0件でも落ちず、枝が空で返る', () => {
    const layout = layoutTree([]);

    expect(layout.branches).toEqual([]);
    expect(layout.center).toEqual({ x: 50, y: 92 });
  });

  it('返り値に色を含まない(色は描画側がテーマから選ぶ)', () => {
    expect(JSON.stringify(layoutTree(leaves(3)))).not.toMatch(/#[0-9a-f]{3,8}|rgb|color/i);
  });
});
