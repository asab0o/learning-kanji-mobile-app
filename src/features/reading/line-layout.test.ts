import type { FuriganaSegment } from '@/features/reading/furigana';
import { lineHasBadge, toLayoutLines } from '@/features/reading/line-layout';

/** 塊の中身を文字列にして、行 → 塊 の構造だけを見比べる */
function shape(segments: FuriganaSegment[]): string[][] {
  return toLayoutLines(segments).map((line) =>
    line.map((cluster) => cluster.map((s) => s.text).join(''))
  );
}

describe('toLayoutLines', () => {
  it('breakAfter も禁則も無ければ、1行にセグメントの数だけ塊が並ぶ', () => {
    const segments: FuriganaSegment[] = [
      { text: 'たくさん' },
      { text: '歩', reading: 'ある' },
      { text: 'きましたね' },
    ];

    expect(shape(segments)).toEqual([['たくさん', '歩', 'きましたね']]);
  });

  it('閉じ括弧で始まるセグメントは直前と同じ塊に入る(#30 の「水曜日」)', () => {
    const segments: FuriganaSegment[] = [
      { text: '水', reading: 'すい' },
      { text: '曜', reading: 'よう' },
      { text: '日', reading: 'び' },
      { text: '」、ここでは' },
    ];

    expect(shape(segments)).toEqual([['水', '曜', '日」、ここでは']]);
  });

  it('読点・句点・疑問符で始まるセグメントも直前と同じ塊に入る', () => {
    expect(shape([{ text: 'この' }, { text: '字', reading: 'じ' }, { text: '、' }])).toEqual([
      ['この', '字、'],
    ]);
    expect(shape([{ text: 'おかえり' }, { text: 'は' }, { text: '？' }])).toEqual([
      ['おかえり', 'は？'],
    ]);
  });

  it('連結すると8字を超える場合は連結しない(塊が吹き出しからはみ出すため)', () => {
    const segments: FuriganaSegment[] = [{ text: 'ながいながい' }, { text: '」というのは' }];

    expect(shape(segments)).toEqual([['ながいながい', '」というのは']]);
  });

  it('breakAfter の付いたセグメントで行が分かれる', () => {
    const segments: FuriganaSegment[] = [
      { text: 'これは、' },
      { text: '少', reading: 'すこ' },
      { text: 'し', breakAfter: true },
      { text: '高', reading: 'たか' },
      { text: 'いですね。' },
    ];

    expect(shape(segments)).toEqual([
      ['これは、', '少', 'し'],
      ['高', 'いですね。'],
    ]);
  });

  it('breakAfter の直後が禁則文字で始まっても行を分ける(作者の指定を優先する)', () => {
    const segments: FuriganaSegment[] = [
      { text: 'おしいねえ。', breakAfter: true },
      { text: '、ここでは' },
    ];

    expect(shape(segments)).toEqual([['おしいねえ。'], ['、ここでは']]);
  });

  it('最後のセグメントの breakAfter は空の行を作らない', () => {
    const segments: FuriganaSegment[] = [{ text: 'ねむい。' }, { text: 'また', breakAfter: true }];

    expect(shape(segments)).toEqual([['ねむい。', 'また']]);
  });

  it('空配列なら行も空', () => {
    expect(toLayoutLines([])).toEqual([]);
  });

  it('focus と badge のフラグは畳んだ後も残る', () => {
    const segments: FuriganaSegment[] = [
      { text: '水', reading: 'すい', focus: true, badge: true },
      { text: '」、' },
    ];

    const [[cluster]] = toLayoutLines(segments);
    expect(cluster[0]).toMatchObject({ text: '水', focus: true, badge: true });
    expect(cluster[1]).toMatchObject({ text: '」、' });
  });
});

describe('lineHasBadge', () => {
  it('★を持つセグメントがある行だけ true', () => {
    const segments: FuriganaSegment[] = [
      { text: 'おしいねえ。', breakAfter: true },
      { text: '水', reading: 'すい', badge: true },
      { text: '曜', reading: 'よう' },
    ];

    const [first, second] = toLayoutLines(segments);
    expect(lineHasBadge(first)).toBe(false);
    expect(lineHasBadge(second)).toBe(true);
  });
});
