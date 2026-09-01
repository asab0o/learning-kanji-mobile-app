import { illustrationSource } from '@/features/reading/kanji-illustration';

/**
 * 画像が1枚も無い状態で画面が成立することの担保。
 * `ILLUSTRATIONS` が埋まり始めても、未投入の字はここを通り続ける。
 */
describe('illustrationSource', () => {
  it('未登録のキーでは null を返す(= プレースホルダ経路に落ちる)', () => {
    expect(illustrationSource('mountain')).toBeNull();
  });

  it('空文字でも落ちない', () => {
    expect(illustrationSource('')).toBeNull();
  });
});
