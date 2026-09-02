/**
 * 「その回を学び終えた」ことの記録。
 *
 * **このファイルには INSERT と SELECT しか書かない**(`review_events` と同じ扱い)。
 * 「今日は何字学んだか」はこのログを畳み込んで求めるものであって、
 * カウンタを1行持って上書きするものではない。
 *
 * SRS のステージはここではなく `review_events` から求める(絶対規則5)。
 * この表は「いつ導入したか」だけを持ち、正解/不正解の概念を持たない。
 */

import { asc, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { newId } from '@/db/id';
import { lessonEvents } from '@/db/schema';

export interface LessonEvent {
  id: string;
  sentenceId: string;
  /** 第2段階専用の回は新出漢字が無いので null */
  kanjiId: string | null;
  completedAt: number;
}

export interface NewLessonEvent {
  sentenceId: string;
  kanjiId: string | null;
  /** 省略時は現在時刻 */
  completedAt?: number;
}

/** この会話文を既に学び終えているか */
export function hasCompletedSentence(sentenceId: string): boolean {
  return (
    db.select().from(lessonEvents).where(eq(lessonEvents.sentenceId, sentenceId)).get() !==
    undefined
  );
}

/**
 * 学習1回分を追記する。既存の行には触れない。
 *
 * 既に記録がある回は**何も書かずに null を返す**。`reveal_shown` と違って UNIQUE が
 * 無いので DB は二重の INSERT を拒まない。読み直しで日々の進捗が増えてしまわないよう、
 * ここで止めるのが1段目の防御(2段目は `planTodaysLessons()` 側の畳み込み)。
 */
export function insertLessonEvent(event: NewLessonEvent): LessonEvent | null {
  if (hasCompletedSentence(event.sentenceId)) {
    return null;
  }

  const now = Date.now();
  const row = {
    id: newId(),
    sentenceId: event.sentenceId,
    kanjiId: event.kanjiId,
    completedAt: event.completedAt ?? now,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(lessonEvents).values(row).run();

  return toLessonEvent(row);
}

/**
 * 学習イベントを古い順に返す。
 *
 * 同じミリ秒に複数入りうるので id を第2キーにする(理由は `review-events.ts` と同じ)。
 */
export function listLessonEvents(): LessonEvent[] {
  return db
    .select()
    .from(lessonEvents)
    .orderBy(asc(lessonEvents.completedAt), asc(lessonEvents.id))
    .all()
    .map(toLessonEvent);
}

function toLessonEvent(row: typeof lessonEvents.$inferSelect): LessonEvent {
  return {
    id: row.id,
    sentenceId: row.sentenceId,
    kanjiId: row.kanjiId,
    completedAt: row.completedAt,
  };
}
