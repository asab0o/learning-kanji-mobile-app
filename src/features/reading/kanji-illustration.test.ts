import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { kanji } from '@/content';
import { illustrationSource } from '@/features/reading/kanji-illustration';

/**
 * 画像が1枚も無い状態でも画面が成立することの担保。
 * `ILLUSTRATIONS` が埋まり切っても、未投入の字はここを通り続ける。
 */
describe('illustrationSource', () => {
  it('未登録のキーでは null を返す(= プレースホルダ経路に落ちる)', () => {
    // 実在の illustrationKey を使わない。その字に画像が入った瞬間、このテストが
    // 「その字の絵が出ないこと」を正常系として固定してしまう。
    // 2026-09-05 に mountain → person と付け替えて同じ罠を1周した。
    expect(illustrationSource('__not_a_real_key__')).toBeNull();
  });

  it('空文字でも落ちない', () => {
    expect(illustrationSource('')).toBeNull();
  });
});

/**
 * `require()` を動的に組み立てられない以上 `ILLUSTRATIONS` は手書きになる。
 * 手書きなので「画像を足して登録を忘れる」事故が起きる —— 2026-09-05 に2回起きた。
 * 型検査もリントもこれを捕まえない(登録側が減るだけなので何も壊れない)ので、
 * ここでディスクと突き合わせる。
 *
 * 逆方向(登録したのにファイルが無い)は Metro / jest のモジュール解決が落ちるため、
 * 改めて見る必要はない。
 */
describe('ILLUSTRATIONS と assets/kanji/', () => {
  const assetKeys = readdirSync(join(process.cwd(), 'assets/kanji'))
    .filter((name) => name.endsWith('.png'))
    .map((name) => name.replace(/\.png$/, ''));

  it('画像はすべて ILLUSTRATIONS に登録されている', () => {
    expect(assetKeys.filter((key) => illustrationSource(key) === null)).toEqual([]);
  });

  it('画像のファイル名はすべて実在の illustrationKey', () => {
    const known = new Set(kanji.map((entry) => entry.illustrationKey));
    expect(assetKeys.filter((key) => !known.has(key))).toEqual([]);
  });
});
