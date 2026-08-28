import { segmentsToKana, segmentsToText } from '@/content/segments';
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
