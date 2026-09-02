/**
 * SRS のステージ計算と「今日の復習」の抽出(要件定義書 5.1-4 / ADR-0007)。
 *
 * **このファイルは `@/db` を import しない。** `@/db/client` は import しただけで
 * SQLite を開くため、ここから触るとテストがネイティブモジュールに到達する。
 * DB への書き込みは `@/features/srs/record-review` の担当。
 *
 * **現在のステージはイベントの畳み込みで求める**(絶対規則5)。どこにも保存しない。
 */

import type { KanjiEntry } from '@/content/types';
import { addLocalDays, startOfLocalDay } from '@/features/srs/day';
import type { LessonCompletion } from '@/features/srs/lessons';

/**
 * 各ステージから次に出るまでの日数(要件定義書 9章。2026-09-02 に確定)。
 *
 * ステージ1 = 導入直後。**当日復習は入れない。** 学んだ直後に同じ字が出る作業感を
 * 避けるため、復習は翌日から始まる(開発者判断)。デモや初回起動で復習を見せたく
 * なったら先頭を `0` にするだけでよく、他の設計は動かない。
 *
 * 定常状態では 3字/日(ADR-0003)× 6ステージ ≒ 18件/日。1問8秒として3分弱で、
 * ADR-0003 が防ごうとした「復習の雪崩による離脱」の範囲に収まる。
 * 1字につき現在ステージは1つなので、**放置しても学習済みの字数(最大50)で頭打ちになる**。
 */
export const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 14, 30] as const;

/** ここに達した字は二度と出題しない(6回連続正解。最短で導入から58日) */
export const BURNED_STAGE = REVIEW_INTERVAL_DAYS.length + 1;

/** `@/db` の `ReviewEvent` がそのまま渡せる形。DB の型に依存しないための再定義 */
export interface ReviewRecord {
  id: string;
  kanjiId: string;
  result: 'correct' | 'incorrect';
  reviewedAt: number;
}

export interface KanjiReviewState {
  /** 1..BURNED_STAGE */
  stage: number;
  /** 次に出題する日(ローカル日の午前0時) */
  dueDay: number;
  burned: boolean;
}

export interface ReviewQueueItem {
  kanji: KanjiEntry;
  stage: number;
  dueDay: number;
}

export interface TodaysReviews {
  items: ReviewQueueItem[];
  dueCount: number;
}

export interface FoldKanjiStatesInput {
  lessons: LessonCompletion[];
  reviews: ReviewRecord[];
}

/**
 * 学習済みの字ごとに、現在のステージと次回出題日を求める。
 *
 * **起点は `lesson_events`。** 導入されていない字は、`review_events` に行があっても
 * 対象にしない(不整合なデータで落ちないようにする)。
 */
export function foldKanjiStates({
  lessons,
  reviews,
}: FoldKanjiStatesInput): Map<string, KanjiReviewState> {
  const states = new Map<string, KanjiReviewState>();

  // 導入日を起点にステージ1で始める。同じ字が複数の回で完了していても最初の1件を採る
  for (const lesson of lessons) {
    if (lesson.kanjiId === null) {
      continue;
    }

    const existing = states.get(lesson.kanjiId);
    const dueDay = addLocalDays(lesson.completedAt, REVIEW_INTERVAL_DAYS[0]);

    if (existing === undefined || dueDay < existing.dueDay) {
      states.set(lesson.kanjiId, { stage: 1, dueDay, burned: false });
    }
  }

  // 入力順に依存しないよう並べ直してから畳み込む。同じミリ秒に複数入りうるので
  // id を第2キーにする(ULID は同一ミリ秒内でも単調増加する)。
  // ここを崩すと、複数端末のイベントをマージしたときにステージが端末ごとにずれる。
  const ordered = [...reviews].sort(
    (a, b) => a.reviewedAt - b.reviewedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );

  for (const review of ordered) {
    const state = states.get(review.kanjiId);

    if (state === undefined) {
      continue;
    }

    const stage =
      review.result === 'correct'
        ? Math.min(state.stage + 1, BURNED_STAGE)
        : Math.max(state.stage - 1, 1);
    const burned = stage === BURNED_STAGE;

    states.set(review.kanjiId, {
      stage,
      // 正解でも不正解でも同じ規則。例外を作らない(ADR-0007 の議論と同じ理由で、
      // 「不正解は当日に戻す」案は入口画面が 0 件にならなくなるので却下した)
      burned,
      dueDay: burned
        ? Number.POSITIVE_INFINITY
        : addLocalDays(review.reviewedAt, intervalFor(stage)),
    });
  }

  return states;
}

export interface PlanTodaysReviewsInput {
  kanji: KanjiEntry[];
  lessons: LessonCompletion[];
  reviews: ReviewRecord[];
  now: number;
}

/**
 * 今日出す復習を選ぶ。
 *
 * 出題日を過ぎたぶんは繰り越して溜まる(件数の上限は掛けない)。
 * 並びは決定的にしておき、**シャッフルはセッション側の仕事**にする。
 */
export function planTodaysReviews({
  kanji,
  lessons,
  reviews,
  now,
}: PlanTodaysReviewsInput): TodaysReviews {
  const states = foldKanjiStates({ lessons, reviews });
  const today = startOfLocalDay(now);
  const items: ReviewQueueItem[] = [];

  for (const entry of kanji) {
    const state = states.get(entry.id);

    if (state === undefined || state.burned || state.dueDay > today) {
      continue;
    }

    items.push({ kanji: entry, stage: state.stage, dueDay: state.dueDay });
  }

  items.sort((a, b) => a.dueDay - b.dueDay || a.kanji.order - b.kanji.order);

  return { items, dueCount: items.length };
}

/** ステージ(1..BURNED_STAGE)から次に出るまでの日数 */
function intervalFor(stage: number): number {
  return REVIEW_INTERVAL_DAYS[Math.min(stage, REVIEW_INTERVAL_DAYS.length) - 1];
}
