/**
 * 復習1回分を追記する。
 *
 * `scheduler.ts` / `choices.ts` / `session.ts` から分けているのは、あちらを `@/db` に
 * 触れさせないため(`@/db/client` は import しただけで SQLite を開く)。
 * `complete-lesson.ts` と同じ理由。
 *
 * **推測クイズの結果をここに通さない**(絶対規則10)。それは `quiz_attempts` 側。
 */

import { insertReviewEvent } from '@/db';
import type { ReviewEvent, ReviewResult } from '@/db';

export interface RecordReviewInput {
  kanjiId: string;
  result: ReviewResult;
}

export function recordReview({ kanjiId, result }: RecordReviewInput): ReviewEvent {
  return insertReviewEvent({ kanjiId, result });
}
