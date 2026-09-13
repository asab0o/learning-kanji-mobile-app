/**
 * クイズ1回分を記録する。表示時と回答時の2段。
 *
 * `selection.ts` / `distractors.ts` から分けているのは、あちらを `@/db` に触れさせないため
 * (`@/db/client` は import しただけで SQLite を開く)。`srs/record-review.ts` と同じ形。
 *
 * **この結果は SRS に入らない**(絶対規則10)。書き先は `quiz_attempts` だけで、
 * 復習の出題日にも `n due` にも一切影響しない。
 */

import { insertQuizShown, updateQuizAttemptResult } from '@/db';
import type { QuizAnswerResult } from '@/db';

export { newQuizAttemptId } from '@/db';

export interface RecordQuizShownInput {
  /** `newQuizAttemptId()` で画面が1回だけ採番したもの */
  id: string;
  itemKey: string;
}

/** 語を表示した。答えずに抜けても「直近に出した」に数えるため、表示の時点で書く */
export function recordQuizShown({ id, itemKey }: RecordQuizShownInput): void {
  insertQuizShown({ id, itemKey });
}

export interface RecordQuizAnswerInput {
  id: string;
  result: QuizAnswerResult;
}

/** 選択肢を選んだ。表示時の行の `result` を1回だけ更新する */
export function recordQuizAnswer({ id, result }: RecordQuizAnswerInput): void {
  updateQuizAttemptResult({ id, result });
}
