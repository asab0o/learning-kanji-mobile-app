/**
 * 出題の選定(`pickQuizItem`)に渡す入力を DB から組み立てる。
 *
 * クイズ画面と漢字フォーカス画面の2か所で使う。後者は「学習直後に出せる語があるか」を
 * 遷移の前に判定するため(無ければクイズ画面を開かずに Today へ戻す。
 * docs/plans/quiz-and-review-repeats.md)。**組み立てを1か所にしておかないと、
 * 判定した条件と実際の出題の条件がずれて、開いたクイズ画面が空になる。**
 *
 * `@/db` に触るので、`record-attempt.ts` と同じくテストは付けない。
 */

import {
  listKanji,
  listLessonEvents,
  listRecentQuizAttempts,
  listSentences,
  listWords,
} from '@/db';

import { RECENT_ITEM_MEMORY } from './selection';
import type { PickQuizItemInput } from './selection';
import type { QuizSlot } from './types';

export interface LoadQuizInputOptions {
  slot: QuizSlot;
  /** 学習直後だけ付く。たった今学び終えた字 */
  focusKanjiId?: string;
  /** 描画中に `Date.now()` を呼ばせないため、呼び出し側から渡す */
  now: number;
}

export function loadQuizInput({
  slot,
  focusKanjiId,
  now,
}: LoadQuizInputOptions): PickQuizItemInput {
  const sentences = listSentences();
  const lessons = listLessonEvents();

  return {
    words: listWords(),
    kanji: listKanji(),
    // 第2段階の演出語。ここを渡し忘れると、演出回に着く前にクイズが答えを明かす
    // (docs/plans/guess-quiz.md 差分3)
    reencounterWords: sentences.flatMap((sentence) =>
      sentence.reencounters.map((reencounter) => reencounter.word)
    ),
    // 第2段階専用の回は新出漢字が無い(`kanjiId` が null)ので、そこは既習に数えない
    learned: lessons.flatMap((lesson) =>
      lesson.kanjiId === null ? [] : [{ kanjiId: lesson.kanjiId, completedAt: lesson.completedAt }]
    ),
    completedSentenceIds: lessons.map((lesson) => lesson.sentenceId),
    recentItemKeys: listRecentQuizAttempts(RECENT_ITEM_MEMORY).map((attempt) => attempt.itemKey),
    slot,
    focusKanjiId,
    now,
  };
}
