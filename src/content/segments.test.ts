import { segmentsToKana, segmentsToText, startsWithForbiddenLineStart } from '@/content/segments';
import type { LineSegment } from '@/content/types';

describe('segmentsToText', () => {
  it('reading の有無に関わらず text だけを連結する', () => {
    const segments: LineSegment[] = [
      { text: 'たくさん' },
      { text: '歩', reading: 'ある' },
      { text: 'きましたね。' },
    ];

    expect(segmentsToText(segments)).toBe('たくさん歩きましたね。');
  });

  it('句読点を含むセグメントもそのまま連結する', () => {
    const segments: LineSegment[] = [
      { text: 'すみません、かばんが' },
      { text: '大', reading: 'おお' },
      { text: 'きくて…' },
    ];

    expect(segmentsToText(segments)).toBe('すみません、かばんが大きくて…');
  });

  it('カタカナのセグメントもそのまま連結する', () => {
    const segments: LineSegment[] = [
      { text: 'カフェへ' },
      { text: '行', reading: 'い' },
      { text: 'く。' },
    ];

    expect(segmentsToText(segments)).toBe('カフェへ行く。');
  });

  it('空配列なら空文字列', () => {
    expect(segmentsToText([])).toBe('');
  });
});

describe('segmentsToKana', () => {
  it('reading があればそれを、無ければ text を使って連結する', () => {
    const segments: LineSegment[] = [
      { text: 'たくさん' },
      { text: '歩', reading: 'ある' },
      { text: 'きましたね。' },
    ];

    expect(segmentsToKana(segments)).toBe('たくさんあるきましたね。');
  });

  it('reading を持つセグメントが複数あっても正しく連結する', () => {
    const segments: LineSegment[] = [
      { text: '毎日', reading: 'まいにち' },
      { text: '歩', reading: 'ある' },
      { text: 'くのが、' },
      { text: '元気', reading: 'げんき' },
      { text: 'のもとだよ。' },
    ];

    expect(segmentsToKana(segments)).toBe('まいにちあるくのが、げんきのもとだよ。');
  });

  it('空配列なら空文字列', () => {
    expect(segmentsToKana([])).toBe('');
  });
});

describe('startsWithForbiddenLineStart', () => {
  it.each(['、ここでは', '。', '」は、', '」、ここでは', '）と', '？', '！', '…同じ字'])(
    '%s は行頭に来てはいけない',
    (text) => {
      expect(startsWithForbiddenLineStart(text)).toBe(true);
    }
  );

  it.each(['きれいですね。', '「みず」ですよね？', '今日', 'もらえますか？', 'あいだ'])(
    '%s は行頭に来てよい',
    (text) => {
      expect(startsWithForbiddenLineStart(text)).toBe(false);
    }
  );

  it('長音符と小書きかなで始まるセグメントも行頭に来てはいけない', () => {
    expect(startsWithForbiddenLineStart('ーん')).toBe(true);
    expect(startsWithForbiddenLineStart('っと')).toBe(true);
    expect(startsWithForbiddenLineStart('ょっと')).toBe(true);
  });

  it('空文字列は false', () => {
    expect(startsWithForbiddenLineStart('')).toBe(false);
  });
});
