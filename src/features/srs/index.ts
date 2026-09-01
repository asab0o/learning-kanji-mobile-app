/**
 * SRS の公開API。`src/app/` からはここだけを import する。
 *
 * **`complete-lesson` を経由するので、このファイルは `@/db` に到達する。**
 * ユニットテストからは `@/features/srs/lessons` のように個別のモジュールを
 * import すること(`@/db/client` は import しただけで SQLite を開く)。
 *
 * 復習(ステージ計算・間隔テーブル・出題キュー)はまだここに無い。
 * 次プラン `docs/plans/srs-reviews.md` の担当。
 */

export { completeLesson } from './complete-lesson';
export type { CompleteLessonInput } from './complete-lesson';
export { isSameLocalDay, startOfLocalDay } from './day';
export { DAILY_NEW_KANJI_LIMIT, planTodaysLessons } from './lessons';
export type {
  LessonCompletion,
  PlanTodaysLessonsInput,
  TodaysLessonItem,
  TodaysLessons,
} from './lessons';
export { TodayView } from './components/today-view';
