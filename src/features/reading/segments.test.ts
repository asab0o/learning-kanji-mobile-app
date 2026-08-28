import type { LineSegment } from '@/content/types';
import { toFuriganaSegments } from '@/features/reading/segments';

// FuriganaText(React)は import しない。ここで見たいのは focus の付け方だけ。

/** 会話文集 #32 の1行目。theme-preview.tsx に手書きされているものと同じ分け方 */
const walkedALot: LineSegment[] = [
  { text: 'たくさん' },
  { text: '歩', reading: 'ある' },
  { text: 'きましたね。' },
];

describe('toFuriganaSegments', () => {
  it('対象の字を含むセグメントにだけ focus を付ける', () => {
    const result = toFuriganaSegments(walkedALot, ['歩']);

    expect(result).toHaveLength(3);
    expect(result.filter((segment) => segment.focus === true)).toEqual([
      { text: '歩', reading: 'ある', focus: true },
    ]);
  });

  it('theme-preview に手書きされている配列と一致する', () => {
    // 既存の画面が求めている形と、導出した形が同じであることを見る。
    // ここがずれると、実データを入れたときに手書きのモックと描画が変わる。
    expect(toFuriganaSegments(walkedALot, ['歩'])).toEqual([
      { text: 'たくさん' },
      { text: '歩', reading: 'ある', focus: true },
      { text: 'きましたね。' },
    ]);
  });

  it('対象が空なら focus が付いたセグメントは 0 件', () => {
    const result = toFuriganaSegments(walkedALot, []);

    expect(result.filter((segment) => segment.focus === true)).toHaveLength(0);
    expect(result).toEqual(walkedALot);
  });

  it('第2段階のように複数字が対象でも、それぞれに付く', () => {
    // 「大学」で 大 と 学 の読みが同時に変わる回(docs/content-decisions.md)
    const segments: LineSegment[] = [
      { text: '来年', reading: 'らいねん' },
      { text: '大学', reading: 'だいがく' },
      { text: 'に' },
      { text: '行', reading: 'い' },
      { text: 'きます。' },
    ];

    const result = toFuriganaSegments(segments, ['大', '学']);

    expect(result.filter((segment) => segment.focus === true)).toEqual([
      { text: '大学', reading: 'だいがく', focus: true },
    ]);
  });

  it('同じ字が複数のセグメントに出るなら、そのすべてに付く', () => {
    const segments: LineSegment[] = [
      { text: '日', reading: 'ひ' },
      { text: 'と' },
      { text: '毎日', reading: 'まいにち' },
    ];

    expect(toFuriganaSegments(segments, ['日']).map((segment) => segment.focus)).toEqual([
      true,
      undefined,
      true,
    ]);
  });

  it('対象の字がどこにも無ければ何も付かない', () => {
    expect(toFuriganaSegments(walkedALot, ['空'])).toEqual(walkedALot);
  });

  it('元の配列を書き換えない', () => {
    const segments: LineSegment[] = [{ text: '歩', reading: 'ある' }];

    toFuriganaSegments(segments, ['歩']);

    expect(segments).toEqual([{ text: '歩', reading: 'ある' }]);
  });

  it('空の配列を渡すと空の配列が返る', () => {
    expect(toFuriganaSegments([], ['歩'])).toEqual([]);
  });
});
