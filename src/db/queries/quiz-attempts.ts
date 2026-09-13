/**
 * 推測クイズの記録。**SRS とは完全に別系統**(絶対規則10)。
 *
 * **1回の出題につき1行。表示した時点で `result = 'shown'` で INSERT し、回答したら
 * その行の `result` を1回だけ UPDATE する。** DELETE は書かない。
 *
 * 表示時点で入れるのは、答えずに Back やスワイプで抜けた語も「直近に出した」に数えるため。
 * 回答時にしか入れていなかったころは、抜けた語が次の回にまた出た(2026-09-13 の実機報告)。
 *
 * **追記のみにしない理由。** 表示と回答で2行にすると、直近 N 行の窓が実質 N/2 語に縮む。
 * `quiz_attempts` は SRS ではないので絶対規則5(追記のみ)の対象外。遷移は
 * `shown` → `correct` / `incorrect` の1方向・1回だけなので、将来の同期も `updated_at` の
 * 後勝ちで状態が戻らない(docs/plans/quiz-and-review-repeats.md)。
 *
 * 記録する理由は「**同じ問題を続けて出さない**」ためだけで、成績評価には使わない。
 * `result` 列は入れるが、**読むのは `itemKey` だけ**。正答率も連続日数も画面に出さない
 * (要件定義書 4.4「ご褒美体験であり成績ではない」)。集計したくなったら、それは
 * クイズを課題に変える変更なので、まず要件に戻ること。
 */

import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { newId } from '@/db/id';
import { quizAttempts } from '@/db/schema';

export type QuizResult = 'shown' | 'correct' | 'incorrect';

/** 回答時に書ける値。`shown` へ戻す書き込み口を作らないために分ける */
export type QuizAnswerResult = Exclude<QuizResult, 'shown'>;

export interface QuizAttempt {
  id: string;
  /** 出題を一意に指す不透明な文字列。現在は `word:<表記>`(`features/quiz/selection.ts`) */
  itemKey: string;
  result: QuizResult;
  /** 表示した時刻。回答しても変えない */
  attemptedAt: number;
}

/**
 * 出題1回分の ID を先に採番する。
 *
 * 表示時の INSERT と回答時の UPDATE が同じ行を指すため、画面が1回だけ決めて持つ。
 * `@/db/id` を DB の外から import させないためにここから出す。
 */
export function newQuizAttemptId(): string {
  return newId();
}

export interface NewQuizShown {
  id: string;
  itemKey: string;
  /** 省略時は現在時刻 */
  shownAt?: number;
}

/**
 * 表示したことを記録する。**同じ `id` で2回呼んでも1行しか入らない。**
 *
 * 画面は `useEffect` から呼ぶので、StrictMode では2回走る。ref のフラグではなく
 * 主キーの一意性で冪等にしてあり、React の内部挙動に依存しない。
 */
export function insertQuizShown({ id, itemKey, shownAt }: NewQuizShown): void {
  const now = Date.now();

  db.insert(quizAttempts)
    .values({
      id,
      itemKey,
      result: 'shown',
      attemptedAt: shownAt ?? now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: quizAttempts.id })
    .run();
}

export interface QuizAnswerUpdate {
  id: string;
  result: QuizAnswerResult;
}

/**
 * 回答を記録する。**まだ `shown` の行だけを更新する**ので、2回目以降の呼び出しは効かない。
 */
export function updateQuizAttemptResult({ id, result }: QuizAnswerUpdate): void {
  db.update(quizAttempts)
    .set({ result, updatedAt: Date.now() })
    .where(and(eq(quizAttempts.id, id), eq(quizAttempts.result, 'shown')))
    .run();
}

/**
 * 直近の出題を**新しい順**に返す。未回答(`shown`)の行も含む。
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
