/**
 * クイズ1回分を追記する。
 *
 * `selection.ts` / `distractors.ts` から分けているのは、あちらを `@/db` に触れさせないため
 * (`@/db/client` は import しただけで SQLite を開く)。`srs/record-review.ts` と同じ形。
 *
 * **この結果は SRS に入らない**(絶対規則10)。書き先は `quiz_attempts` だけで、
 * 復習の出題日にも `n due` にも一切影響しない。
 */

import { insertQuizAttempt } from '@/db';
import type { QuizAttempt, QuizResult } from '@/db';

export interface RecordQuizAttemptInput {
  itemKey: string;
  result: QuizResult;
}

export function recordQuizAttempt({ itemKey, result }: RecordQuizAttemptInput): QuizAttempt {
  return insertQuizAttempt({ itemKey, result });
}
