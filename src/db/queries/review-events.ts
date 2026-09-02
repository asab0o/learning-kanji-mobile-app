/**
 * SRS のイベントログ。
 *
 * **このファイルには INSERT と SELECT しか書かない**(絶対規則5)。
 * UPDATE / DELETE を足したくなったら、それは設計を誤読している。
 * 現在のステージはイベントを畳み込んで求めるものであって、上書きするものではない。
 *
 * 推測クイズの結果をここに書かない(絶対規則10)。それは `@/db/queries/quiz-attempts` 側。
 *
 * **会話文の ID は持たない。** 復習の単位は漢字1字で、出題は意味の4択のみ(ADR-0007)。
 * 「どの文で出会った字か」が要るときは `lesson_events` を `kanji_id` で引く。
 */

import { asc, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { newId } from '@/db/id';
import { reviewEvents } from '@/db/schema';

export type ReviewResult = 'correct' | 'incorrect';

export interface ReviewEvent {
  id: string;
  kanjiId: string;
  result: ReviewResult;
  reviewedAt: number;
}

export interface NewReviewEvent {
  kanjiId: string;
  result: ReviewResult;
  /** 省略時は現在時刻 */
  reviewedAt?: number;
}

/** 復習1回分を追記する。既存の行には触れない */
export function insertReviewEvent(event: NewReviewEvent): ReviewEvent {
  const now = Date.now();
  const row = {
    id: newId(),
    kanjiId: event.kanjiId,
    result: event.result,
    reviewedAt: event.reviewedAt ?? now,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(reviewEvents).values(row).run();

  return toReviewEvent(row);
}

/**
 * 復習イベントを古い順に返す。
 *
 * 畳み込み(ステージ計算)は `features/srs/` の担当で、ここではやらない。
 */
export function listReviewEvents(kanjiId?: string): ReviewEvent[] {
  const query = db.select().from(reviewEvents).$dynamic();

  if (kanjiId !== undefined) {
    query.where(eq(reviewEvents.kanjiId, kanjiId));
  }

  // 同じミリ秒に複数のイベントが入りうるので、id を第2キーにして順序を決定的にする。
  // 畳み込み(ステージ計算)の入力順は仕様の一部であり、SQLite 任せにはできない。
  // ULID は同一ミリ秒内でも単調増加する(`@/db/ulid`)ので、id 順 = 生成順になる。
  return query.orderBy(asc(reviewEvents.reviewedAt), asc(reviewEvents.id)).all().map(toReviewEvent);
}

function toReviewEvent(row: typeof reviewEvents.$inferSelect): ReviewEvent {
  return {
    id: row.id,
    kanjiId: row.kanjiId,
    result: row.result,
    reviewedAt: row.reviewedAt,
  };
}
