import { furiganaMetrics } from './furigana-metrics';
import { themes } from '@/theme/themes';
import type { Theme } from '@/theme/tokens';

const type: Theme['type'] = {
  mincho: 'HiraMinProN-W3',
  minchoBold: 'HiraMinProN-W6',
  jaSize: 17.5,
  jaLineHeight: 36,
};

describe('furiganaMetrics', () => {
  it('読みの行と本文の行を足すと日本語1行の高さになる', () => {
    const { readingHeight, baseLineHeight } = furiganaMetrics(type, 1);

    expect(readingHeight + baseLineHeight).toBe(type.jaLineHeight);
  });

  it('読みは本文の約半分の大きさになる', () => {
    const { readingSize } = furiganaMetrics(type, 1);

    expect(readingSize).toBe(9);
  });

  it('読みの文字サイズには倍率を掛けない(RN が fontSize を自動で拡大するため)', () => {
    expect(furiganaMetrics(type, 2).readingSize).toBe(furiganaMetrics(type, 1).readingSize);
  });

  it('行の高さには倍率を掛ける(RN が lineHeight を拡大しないため)', () => {
    const single = furiganaMetrics(type, 1);
    const doubled = furiganaMetrics(type, 2);

    expect(doubled.readingHeight).toBe(single.readingHeight * 2);
    expect(doubled.baseLineHeight).toBe(single.baseLineHeight * 2);
  });

  it('行の高さが足りないテーマでも本文の行が文字サイズを下回らない', () => {
    // jaLineHeight 26 - 読みの行 13 = 13 で、本文 20pt が潰れる組み合わせ。
    const cramped: Theme['type'] = { ...type, jaSize: 20, jaLineHeight: 26 };

    expect(furiganaMetrics(cramped, 1).baseLineHeight).toBe(20);
  });
});

// クランプは保険であって、通常の経路であってはならない。
// テーマ側の jaLineHeight が最初から足りていることをここで担保する。
describe('各テーマの行の高さ', () => {
  it.each(Object.entries(themes))('%s: クランプに頼らず1行に収まる', (_id, theme) => {
    const { readingHeight, baseLineHeight } = furiganaMetrics(theme.type, 1);

    expect(readingHeight + baseLineHeight).toBe(theme.type.jaLineHeight);
    expect(baseLineHeight).toBeGreaterThanOrEqual(theme.type.jaSize);
  });
});
