/**
 * 開発用の行数集計。
 *
 * `db-debug` の退役(会話文画面の実装)で呼び出し元が一時的に 0 になった。
 * 消さずに残しているのは、「コンテンツを再シードしてもユーザー状態が消えていないか」を
 * 確かめる唯一の手段で、SRS が review_events を書き始める回にまた要るため。
 *
 * 本番の画面ロジックからは呼ばない。シードとユーザー状態の保全を
 * 目で確かめるためだけのもの。
 */

import { count } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { db } from '@/db/client';
import {
  contentMeta,
  kanji,
  quizAttempts,
  revealShown,
  reviewEvents,
  sentenceLines,
  sentences,
  userSettings,
  words,
} from '@/db/schema';

/** コンテンツ系とユーザー状態を分けて数える。境界が守られているかを目で見るため */
export interface TableCounts {
  content: {
    kanji: number;
    words: number;
    sentences: number;
    sentenceLines: number;
    contentMeta: number;
  };
  userState: {
    reviewEvents: number;
    quizAttempts: number;
    revealShown: number;
    userSettings: number;
  };
}

export function getTableCounts(): TableCounts {
  return {
    content: {
      kanji: countRows(kanji),
      words: countRows(words),
      sentences: countRows(sentences),
      sentenceLines: countRows(sentenceLines),
      contentMeta: countRows(contentMeta),
    },
    userState: {
      reviewEvents: countRows(reviewEvents),
      quizAttempts: countRows(quizAttempts),
      revealShown: countRows(revealShown),
      userSettings: countRows(userSettings),
    },
  };
}

/** 現在の指紋。シードが走ったかどうかを画面で確認するため */
export function getContentFingerprint(): string | null {
  return db.select().from(contentMeta).limit(1).get()?.fingerprint ?? null;
}

function countRows(table: SQLiteTable): number {
  return db.select({ value: count() }).from(table).get()?.value ?? 0;
}
