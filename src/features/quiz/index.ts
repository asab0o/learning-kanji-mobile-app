/**
 * 推測クイズの公開API。`src/app/` からはここだけを import する。
 *
 * **`record-attempt` を経由するので、このファイルは `@/db` に到達する。**
 * ユニットテストからは `@/features/quiz/selection` のように個別のモジュールを
 * import すること(`@/db/client` は import しただけで SQLite を開く。`srs/index.ts` と同じ)。
 *
 * **SRS とは相互に import しない**(絶対規則10)。`boundaries.test.ts` が見張っている。
 */

export { pickQuizItem, RECENT_ITEM_MEMORY, toItemKey } from './selection';
export type { PickQuizItemInput } from './selection';
export { buildQuizChoices, QUIZ_CHOICE_COUNT } from './distractors';
export type { BuildQuizChoicesInput } from './distractors';
export { newQuizAttemptId, recordQuizAnswer, recordQuizShown } from './record-attempt';
export type { RecordQuizAnswerInput, RecordQuizShownInput } from './record-attempt';
export { loadQuizInput } from './load-quiz-input';
export type { LoadQuizInputOptions } from './load-quiz-input';
export type { LearnedKanji, QuizComponent, QuizItem, QuizItemKey, QuizSlot } from './types';
export { QuizView } from './components/quiz-view';
