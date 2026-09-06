/**
 * 推測クイズの4択を作る(要件定義書 4.4「誤答選択肢の作り方」)。
 *
 * 要件は「**片方の漢字だけ合っている紛らわしい選択肢**を混ぜる」と指定している
 * (歩道 → sidewalk / walking speed / roadside)。手で書くとコンテンツが増えるので、
 * **既存の語マスタから機械的に作る**: 正解語と漢字をちょうど1字だけ共有する別の語の意味を
 * 誤答に使う(花火 → 火山 volcano / 花見 flower viewing / 火曜日 Tuesday)。
 *
 * **`srs/choices.ts` とは共通化しない。** あちらのファイル冒頭が既にそう宣言している。
 * 入力(あちらは `KanjiEntry`、こちらは語の関係)も、誤答の選び方(品詞の形をそろえる vs
 * 構成字を1字だけ共有させる)も別物で、共通化すると両方に効く分岐が増える。
 * 重なるのは Fisher-Yates の十数行だけで、**その重複は許す**。
 *
 * `@/db` も `@/features/srs` も import しない(純粋。絶対規則10)。
 */

import type { Word } from '@/content/types';

import type { QuizItem } from './types';

/** 正解1＋誤答3。プールが足りなければ届いたぶんだけ返す(`srs/choices.ts` と同じ扱い) */
export const QUIZ_CHOICE_COUNT = 4;

/** 漢字1字かどうか。`selection.ts` と同じ判定 */
const KANJI = /\p{Script=Han}/u;

export interface BuildQuizChoicesInput {
  target: QuizItem;
  /**
   * 誤答の供給元。**語マスタ全件を渡す。**
   *
   * 既習の語だけに絞らないのは、序盤は候補が数語しかなく4択が組めないため
   * (`srs/choices.ts` が未習の字を誤答に混ぜているのと同じ理由)。問われているのは
   * 出題された語の意味なので、誤答を知っているかは正解できるかに影響しない。
   */
  words: Word[];
  /** テストから固定するための注入点 */
  rng?: () => number;
}

/**
 * 正解を1つ含む4択を返す。
 *
 * 誤答は「共有1字の語の意味」を優先し、足りなければ共有0字の語で埋める。
 * 実データでは候補25語のうち `新聞` だけが共有1字の語を2件しか持たず、そこだけ1件を
 * 無関係な語で埋める(2026-09-06 に実測)。
 */
export function buildQuizChoices({
  target,
  words,
  rng = Math.random,
}: BuildQuizChoicesInput): string[] {
  const targetCharacters = new Set(
    [...target.surface].filter((character) => KANJI.test(character))
  );

  // 同じ意味の語が複数の樹に入っている(同じ語の重複行)ので、意味で畳んで1回だけ見る
  const seen = new Set([target.meaning]);
  const sharing: string[] = [];
  const unrelated: string[] = [];

  for (const word of words) {
    if (word.surface === target.surface || seen.has(word.meaning)) {
      continue;
    }

    seen.add(word.meaning);

    const shared = [...word.surface].filter(
      (character) => KANJI.test(character) && targetCharacters.has(character)
    );

    // **ちょうど1字**。2字とも共有する語(同じ構成字の別語)は、正解と紛らわしいのではなく
    // 正解そのものに近く、答えが2つあるように見えてしまう
    if (shared.length === 1) {
      sharing.push(word.meaning);
    } else if (shared.length === 0) {
      unrelated.push(word.meaning);
    }
  }

  const distractors = shuffle(sharing, rng)
    .concat(shuffle(unrelated, rng))
    .slice(0, QUIZ_CHOICE_COUNT - 1);

  return shuffle([target.meaning, ...distractors], rng);
}

/** Fisher-Yates。`rng` を注入できるのはテストで並びを固定するため */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
