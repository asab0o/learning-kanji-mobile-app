/**
 * 復習の意味4択を作る。
 *
 * **要件4.4 の推測クイズの誤答生成とは別物。** あちらは「片方の漢字だけ合っている
 * 紛らわしい熟語訳」(歩道 → sidewalk / walking speed / roadside)を作るもので、
 * 推測の質を上げるのが目的。こちらは既習の字の意味を思い出せるかを見るだけ。
 * **共通化しない。**
 *
 * `@/db` を import しない(純粋。理由は `scheduler.ts` と同じ)。
 */

import type { KanjiEntry } from '@/content/types';

/** 4択。プールが足りなければ届いたぶんだけ返す */
export const MEANING_CHOICE_COUNT = 4;

export interface BuildMeaningChoicesInput {
  target: KanjiEntry;
  /**
   * 誤答の供給元。**マスタ全件を渡す。**
   *
   * 学習済みの字だけに絞らないのは、初日は学習済みが3字しかなく4択が組めないため。
   * 未習の字の意味が誤答に混ざるが、問われているのは出題された字の意味なので、
   * 誤答を知っているかどうかは正解できるかに影響しない。
   *
   * **並び順は結果に影響しない**(下で丸ごとシャッフルしてから切り出すため)。
   */
  pool: KanjiEntry[];
  /** テストから固定するための注入点 */
  rng?: () => number;
}

/**
 * 正解1件＋誤答3件をシャッフルして返す。
 *
 * **誤答は品詞の形をそろえる。** 正解が `to eat` なのに誤答が名詞3つだと、
 * 字を知らなくても `to ...` を選べば当たってしまう。
 */
export function buildMeaningChoices({
  target,
  pool,
  rng = Math.random,
}: BuildMeaningChoicesInput): string[] {
  const targetIsVerb = isVerb(target.meaning);
  const seen = new Set([target.meaning]);
  const sameShape: string[] = [];
  const otherShape: string[] = [];

  for (const entry of pool) {
    if (entry.id === target.id || seen.has(entry.meaning)) {
      continue;
    }

    seen.add(entry.meaning);
    (isVerb(entry.meaning) === targetIsVerb ? sameShape : otherShape).push(entry.meaning);
  }

  const distractors = shuffle(sameShape, rng)
    .concat(shuffle(otherShape, rng))
    .slice(0, MEANING_CHOICE_COUNT - 1);

  return shuffle([target.meaning, ...distractors], rng);
}

/** `to eat` のような動詞の訳かどうか。`src/content/index.ts` は動詞を `to ...` でそろえている */
function isVerb(meaning: string): boolean {
  return meaning.startsWith('to ');
}

/** Fisher-Yates。`rng` を注入できるようにしてあるのはテストで並びを固定するため */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
