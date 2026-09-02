/**
 * 「今日の学習」に何を出すかを決める純粋ロジック。
 *
 * **このファイルは `@/db` を import しない。** `@/db/client` は import しただけで
 * SQLite を開くため、ここから触るとテストがネイティブモジュールに到達する。
 * DB への書き込みは `@/features/srs/complete-lesson` の担当。
 */

import type { Sentence } from '@/content/types';
import { isSameLocalDay } from '@/features/srs/day';

/**
 * 1日に導入する新出漢字の上限(要件定義書 5.1-8 / ADR-0003)。
 *
 * 5字から3字に下げた根拠は ADR-0003。復習の雪崩を防ぐのが主目的なので、
 * **上限が掛かるのは新出漢字だけ**で、復習の件数には掛けない。
 */
export const DAILY_NEW_KANJI_LIMIT = 3;

/** `@/db` の `LessonEvent` がそのまま渡せる形。DB の型に依存しないための再定義 */
export interface LessonCompletion {
  sentenceId: string;
  kanjiId: string | null;
  completedAt: number;
}

export interface TodaysLessonItem {
  sentence: Sentence;
  /** 今日すでに学び終えた回 */
  done: boolean;
}

export interface TodaysLessons {
  items: TodaysLessonItem[];
  /** 今日学んだ新出漢字の字数(異なり) */
  learnedToday: number;
  /** 今日あと何字学べるか */
  remaining: number;
  /** 全ての会話文を学び終えているか */
  allDone: boolean;
}

export interface PlanTodaysLessonsInput {
  sentences: Sentence[];
  completions: LessonCompletion[];
  now: number;
  /** 既定は `DAILY_NEW_KANJI_LIMIT`。開発用に上限を外すときだけ Infinity を渡す */
  limit?: number;
}

/**
 * 今日出す回を `order` 昇順に選ぶ。
 *
 * 規則は3つ。
 *
 * 1. **今日より前に終えた回は出さない。** 読み返しは開発用一覧から行う
 * 2. **新出漢字のある回は枠を1つ使う。** 枠を使い切った状態で次の新出字の回に
 *    当たったら、そこで打ち切る
 * 3. **新出漢字の無い回(第2段階専用)は枠を使わない。** 消費させると最大の差別化要素が
 *    枠に押し出されて後日に流れてしまう(docs/plans/srs-lessons.md)
 */
export function planTodaysLessons({
  sentences,
  completions,
  now,
  limit = DAILY_NEW_KANJI_LIMIT,
}: PlanTodaysLessonsInput): TodaysLessons {
  const firstCompletions = earliestCompletionBySentence(completions);

  // 今日の枠の消費は「異なり漢字数」で数える。同じ回の記録が二重に入っていても
  // (`insertLessonEvent` が防ぐが、別端末からの同期では起こりうる)1字は1字。
  const learnedTodayKanji = new Set<string>();
  for (const completion of firstCompletions.values()) {
    if (completion.kanjiId !== null && isSameLocalDay(completion.completedAt, now)) {
      learnedTodayKanji.add(completion.kanjiId);
    }
  }

  const learnedToday = learnedTodayKanji.size;
  let used = learnedToday;

  const items: TodaysLessonItem[] = [];
  const ordered = [...sentences].sort((a, b) => a.order - b.order);

  for (const sentence of ordered) {
    const completion = firstCompletions.get(sentence.id);

    if (completion !== undefined) {
      if (isSameLocalDay(completion.completedAt, now)) {
        items.push({ sentence, done: true });
      }
      continue;
    }

    if (sentence.newKanjiId === null) {
      items.push({ sentence, done: false });
      continue;
    }

    if (used >= limit) {
      break;
    }

    items.push({ sentence, done: false });
    used += 1;
  }

  return {
    items,
    learnedToday,
    remaining: Math.max(0, limit - learnedToday),
    // 会話文が1本も無いとき(シード前)に「全部終えた」にならないよう長さも見る
    allDone: ordered.length > 0 && ordered.every((sentence) => firstCompletions.has(sentence.id)),
  };
}

/**
 * 会話文ごとに**最も古い1件**だけを残す。
 *
 * 二重計上を防ぐ2段目(1段目は `insertLessonEvent` が既存記録のある回を弾く)。
 * 「いつ学んだか」は最初に学んだ日であって、読み返した日ではない。
 */
function earliestCompletionBySentence(
  completions: LessonCompletion[]
): Map<string, LessonCompletion> {
  const byId = new Map<string, LessonCompletion>();

  for (const completion of completions) {
    const existing = byId.get(completion.sentenceId);

    if (existing === undefined || completion.completedAt < existing.completedAt) {
      byId.set(completion.sentenceId, completion);
    }
  }

  return byId;
}
