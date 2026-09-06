/**
 * 推測クイズの記録。**SRS とは完全に別系統**(絶対規則10)。
 *
 * **このファイルには INSERT と SELECT しか書かない**(`review_events` と同じ扱い)。
 *
 * 記録する理由は「**同じ問題を続けて出さない**」ためだけで、成績評価には使わない。
 * `result` 列は入れるが、**読むのは `itemKey` だけ**。正答率も連続日数も画面に出さない
 * (要件定義書 4.4「ご褒美体験であり成績ではない」)。集計したくなったら、それは
 * クイズを課題に変える変更なので、まず要件に戻ること。
 */

import { desc } from 'drizzle-orm';

import { db } from '@/db/client';
import { newId } from '@/db/id';
import { quizAttempts } from '@/db/schema';

export type QuizResult = 'correct' | 'incorrect';

export interface QuizAttempt {
  id: string;
  /** 出題を一意に指す不透明な文字列。現在は `word:<表記>`(`features/quiz/selection.ts`) */
  itemKey: string;
  result: QuizResult;
  attemptedAt: number;
}

export interface NewQuizAttempt {
  itemKey: string;
  result: QuizResult;
  /** 省略時は現在時刻 */
  attemptedAt?: number;
}

/** 回答1回分を追記する。既存の行には触れない */
export function insertQuizAttempt(attempt: NewQuizAttempt): QuizAttempt {
  const now = Date.now();
  const row = {
    id: newId(),
    itemKey: attempt.itemKey,
    result: attempt.result,
    attemptedAt: attempt.attemptedAt ?? now,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(quizAttempts).values(row).run();

  return toQuizAttempt(row);
}

/**
 * 直近の回答を**新しい順**に返す。
 *
 * 新しい順なのは、呼び出し側が「直近 N 件」の窓として使うため
 * (`features/quiz/selection.ts` の `RECENT_ITEM_MEMORY`)。
 *
 * 同じミリ秒に複数入りうるので id を第2キーにする(理由は `review-events.ts` と同じ)。
 * ULID は同一ミリ秒内でも単調増加するので、id の降順 = 生成の逆順になる。
 */
export function listRecentQuizAttempts(limit: number): QuizAttempt[] {
  return db
    .select()
    .from(quizAttempts)
    .orderBy(desc(quizAttempts.attemptedAt), desc(quizAttempts.id))
    .limit(limit)
    .all()
    .map(toQuizAttempt);
}

function toQuizAttempt(row: typeof quizAttempts.$inferSelect): QuizAttempt {
  return {
    id: row.id,
    itemKey: row.itemKey,
    result: row.result,
    attemptedAt: row.attemptedAt,
  };
}
