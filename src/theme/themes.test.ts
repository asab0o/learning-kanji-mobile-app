import { DEFAULT_THEME_ID, themes } from './themes';
import type { Theme } from './tokens';

const COLOR_KEYS = [
  'background',
  'surface',
  'surfaceAlt',
  'surfaceVeil',
  'text',
  'textMuted',
  'accent',
  'onAccent',
  'border',
  'kunBranch',
  'onBranch',
] as const satisfies readonly (keyof Theme)[];

const entries = Object.entries(themes);

describe('themes', () => {
  it('少なくとも1テーマある', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('既定テーマが存在する', () => {
    expect(themes[DEFAULT_THEME_ID]).toBeDefined();
  });

  it.each(entries)('%s: レコードのキーと id が一致する', (key, theme) => {
    expect(theme.id).toBe(key);
  });

  it.each(entries)('%s: 色トークンが全て埋まっている', (_key, theme) => {
    for (const colorKey of COLOR_KEYS) {
      expect(typeof theme[colorKey]).toBe('string');
      expect(theme[colorKey]).not.toBe('');
    }
  });

  it.each(entries)('%s: 書体トークンが埋まっている', (_key, theme) => {
    expect(theme.type.mincho).not.toBe('');
    expect(theme.type.minchoBold).not.toBe('');
    expect(theme.type.jaSize).toBeGreaterThan(0);
    // ふりがなを本文の上に載せるため、行の高さは文字サイズより十分広く要る。
    expect(theme.type.jaLineHeight).toBeGreaterThan(theme.type.jaSize);
  });

  it.each(entries)('%s: 角丸が全て正の数', (_key, theme) => {
    expect(theme.radius.bubble).toBeGreaterThan(0);
    expect(theme.radius.card).toBeGreaterThan(0);
    expect(theme.radius.pill).toBeGreaterThan(0);
  });

  it.each(entries)('%s: 背景装飾は未設定か、有効な不透明度を持つ', (_key, theme) => {
    if (theme.backdrop === null) {
      return;
    }

    expect(theme.backdrop.opacity).toBeGreaterThan(0);
    expect(theme.backdrop.opacity).toBeLessThanOrEqual(1);
  });

  it.each(entries)('%s: ベクター装飾は未設定か、既知の識別子', (_key, theme) => {
    expect([null, 'sakuraPetals']).toContain(theme.motif);
  });

  // architecture.md「片方のテーマにしかないキーを作らない」の実行時の担保。
  // 型でも縛っているが、将来テーマを増やしたときに as で押し込むのを防ぐ。
  //
  // 注意: テーマが1つの間は自分自身との比較になるので**必ず通る**。
  // 2つ目のテーマを足して初めて意味を持つ、先回りのテスト。
  it('全テーマが同じキー集合を持つ', () => {
    const [, first] = entries[0];
    const expected = Object.keys(first).sort();

    for (const [, theme] of entries) {
      expect(Object.keys(theme).sort()).toEqual(expected);
    }
  });
});
