/**
 * SRS の公開API。`src/app/` からはここだけを import する。
 *
 * **`complete-lesson` を経由するので、このファイルは `@/db` に到達する。**
 * ユニットテストからは `@/features/srs/lessons` のように個別のモジュールを
 * import すること(`@/db/client` は import しただけで SQLite を開く)。
 *
 * 推測クイズ(要件4.4)はまだ無い。**復習と混ぜない**(絶対規則10)。
 */

export { completeLesson } from './complete-lesson';
export type { CompleteLessonInput } from './complete-lesson';
export { recordReview } from './record-review';
export type { RecordReviewInput } from './record-review';
export { addLocalDays, isSameLocalDay, startOfLocalDay } from './day';
export { DAILY_NEW_KANJI_LIMIT, planTodaysLessons } from './lessons';
export type {
  LessonCompletion,
  PlanTodaysLessonsInput,
  TodaysLessonItem,
  TodaysLessons,
} from './lessons';
export { BURNED_STAGE, foldKanjiStates, planTodaysReviews, REVIEW_INTERVAL_DAYS } from './scheduler';
export type {
  KanjiReviewState,
  PlanTodaysReviewsInput,
  ReviewQueueItem,
  ReviewRecord,
  TodaysReviews,
} from './scheduler';
export { buildMeaningChoices, MEANING_CHOICE_COUNT } from './choices';
export { advanceReviewSession, answerReviewSession, createReviewSession } from './session';
export type { ReviewAnswer, ReviewSession } from './session';
export { TodayView } from './components/today-view';
export { ReviewSessionView } from './components/review-session-view';
