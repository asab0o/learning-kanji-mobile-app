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
 * 1日の新出漢字の目標(要件定義書 5.1-8 / ADR-0011)。
 *
 * **上限ではない。** 達成したあとは `MORE_NEW_KANJI_STEP` ずつ追加で開ける。
 * 3字という既定の量は ADR-0003 の理由1(1字あたりが会話文1本ぶん重い)のまま。
 * 復習の件数には掛けない。
 */
export const DAILY_NEW_KANJI_GOAL = 3;

/** 目標を達成したあと、「もう」を1回押すと開く新出漢字の数(ADR-0011) */
export const MORE_NEW_KANJI_STEP = 3;

/** `@/db` の `LessonEvent` がそのまま渡せる形。DB の型に依存しないための再定義 */
export interface LessonCompletion {
  sentenceId: string;
  kanjiId: string | null;
  completedAt: number;
}

/**
 * 「もう3字」を押したことの記録。**その日だけの UI 状態**で、永続化しない(ADR-0011)。
 *
 * 押した日でない日に渡されたら無視される。日をまたいで持ち越さないため。
 */
export interface MoreLessonsRequest {
  requestedAt: number;
  /** 押した結果として開いている新出字の枠(目標 + 追加) */
  openedCount: number;
}

export interface TodaysLessonItem {
  sentence: Sentence;
  /** 今日すでに学び終えた回 */
  done: boolean;
  /**
   * 目標の外で開いた回。画面では目標達成カードの**下**に並べ、
   * 「目標は3のまま、その先はおまけ」を位置で伝える
   */
  beyondGoal: boolean;
}

/** 翌日規則で止まった回と、今日学んだ(またはまだ学んでいない)ために待っている字 */
export interface WaitingForStageTwo {
  sentence: Sentence;
  kanjiIds: string[];
}

export interface TodaysLessons {
  items: TodaysLessonItem[];
  /** 今日学んだ新出漢字の字数(異なり) */
  learnedToday: number;
  /** 表示上の目標。**追加で開いても変わらない**(「6 of 6」にしない) */
  goal: number;
  goalMet: boolean;
  /** 今日開いている新出字の枠(目標 + 追加) */
  opened: number;
  /** 次に「もう」を押すと新たに並ぶ新出字の数。0 なら押しても何も増えない */
  moreCount: number;
  /** 第2段階の翌日規則で、その日の並びを止めた回。止まっていなければ null */
  waitingFor: WaitingForStageTwo | null;
  /** 全ての会話文を学び終えているか */
  allDone: boolean;
}

export interface PlanTodaysLessonsInput {
  sentences: Sentence[];
  completions: LessonCompletion[];
  now: number;
  moreRequest?: MoreLessonsRequest | null;
  /** 開発用。目標の枠も翌日規則も外して、未完了の回を全件並べる */
  unrestricted?: boolean;
}

/**
 * 今日出す回を `order` 昇順に選ぶ。
 *
 * 規則は4つ。
 *
 * 1. **今日より前に終えた回は出さない。** 読み返しは開発用一覧から行う
 * 2. **新出漢字のある回は枠を1つ使う。** 枠(目標 + 追加で開いた数)を使い切った状態で
 *    次の新出字の回に当たったら、そこで打ち切る
 * 3. **新出漢字の無い回(第2段階専用)は枠を使わない。** 消費させると最大の差別化要素が
 *    枠に押し出されて後日に流れてしまう(docs/plans/srs-lessons.md)
 * 4. **第2段階の回は、読みが変わる字をすべて前日以前に学び終えているときだけ出す。**
 *    満たさなければ、**その手前でその日を止める**。飛ばして先へ進むと会話文の順番が
 *    入れ替わり、一気に読む人の「何日か後に読みが変わって戻る」時間差も守れない(ADR-0011)
 */
export function planTodaysLessons({
  sentences,
  completions,
  now,
  moreRequest = null,
  unrestricted = false,
}: PlanTodaysLessonsInput): TodaysLessons {
  const firstCompletions = earliestCompletionBySentence(completions);
  const firstLearnedAt = firstLearnedAtByKanji(firstCompletions);

  // 今日の字数は「異なり漢字数」で数える。同じ回の記録が二重に入っていても
  // (`insertLessonEvent` が防ぐが、別端末からの同期では起こりうる)1字は1字。
  const learnedTodayKanji = new Set<string>();
  for (const completion of firstCompletions.values()) {
    if (completion.kanjiId !== null && isSameLocalDay(completion.completedAt, now)) {
      learnedTodayKanji.add(completion.kanjiId);
    }
  }
  const learnedToday = learnedTodayKanji.size;

  const goal = DAILY_NEW_KANJI_GOAL;
  const opened = unrestricted
    ? Number.POSITIVE_INFINITY
    : Math.max(goal, openedFromLearned(learnedToday, goal), requestedToday(moreRequest, now));

  const ordered = [...sentences].sort((a, b) => a.order - b.order);
  const scan = (slots: number) =>
    scanLessons({
      ordered,
      firstCompletions,
      firstLearnedAt,
      now,
      goal,
      learnedToday,
      slots,
      unrestricted,
    });
  const current = scan(opened);

  return {
    items: current.items,
    learnedToday,
    goal,
    goalMet: learnedToday >= goal,
    opened,
    // 「押したら何が増えるか」を同じ走査でもう一度数える。無料枠の残りや翌日規則で
    // 3字に満たないときも、ラベルが実際に開く字数と一致する(`Learn 1 more kanji`)
    moreCount: unrestricted
      ? 0
      : pendingNewCount(scan(opened + MORE_NEW_KANJI_STEP).items) - pendingNewCount(current.items),
    waitingFor: current.waitingFor,
    // 会話文が1本も無いとき(シード前)に「全部終えた」にならないよう長さも見る
    allDone: ordered.length > 0 && ordered.every((sentence) => firstCompletions.has(sentence.id)),
  };
}

/** 「もう」を押したときの要求を作る。今開いている枠に1回ぶん足す */
export function requestMoreLessons(lessons: TodaysLessons, now: number): MoreLessonsRequest {
  return { requestedAt: now, openedCount: lessons.opened + MORE_NEW_KANJI_STEP };
}

interface ScanInput {
  ordered: Sentence[];
  firstCompletions: Map<string, LessonCompletion>;
  firstLearnedAt: Map<string, number>;
  now: number;
  goal: number;
  learnedToday: number;
  slots: number;
  unrestricted: boolean;
}

function scanLessons({
  ordered,
  firstCompletions,
  firstLearnedAt,
  now,
  goal,
  learnedToday,
  slots,
  unrestricted,
}: ScanInput): { items: TodaysLessonItem[]; waitingFor: WaitingForStageTwo | null } {
  const items: TodaysLessonItem[] = [];
  // 今日の一覧に載った新出字の通し番号。目標を超えた行と、その後ろの第2段階の行が beyondGoal
  let newKanjiSeen = 0;
  // 使った枠は今日学んだ字数から数え始める。一覧の走査中に数えると、打ち切り位置より後ろで
  // 学んだ字(開発用の制限解除で起きる)を取りこぼす
  let used = learnedToday;

  for (const sentence of ordered) {
    const completion = firstCompletions.get(sentence.id);

    if (completion !== undefined) {
      if (isSameLocalDay(completion.completedAt, now)) {
        if (sentence.newKanjiId !== null) {
          newKanjiSeen += 1;
        }
        items.push({ sentence, done: true, beyondGoal: newKanjiSeen > goal });
      }
      continue;
    }

    if (sentence.newKanjiId === null) {
      const waiting = unrestricted ? [] : kanjiNotReadyToday(sentence, firstLearnedAt, now);
      if (waiting.length > 0) {
        return { items, waitingFor: { sentence, kanjiIds: waiting } };
      }
      items.push({ sentence, done: false, beyondGoal: newKanjiSeen > goal });
      continue;
    }

    if (used >= slots) {
      break;
    }

    newKanjiSeen += 1;
    used += 1;
    items.push({ sentence, done: false, beyondGoal: newKanjiSeen > goal });
  }

  return { items, waitingFor: null };
}

/**
 * 第2段階で読みが変わる字のうち、**今日はまだ出せない**もの。
 * 前日以前に学び終えていない字(今日学んだ字と、まだ学んでいない字)を返す。
 */
function kanjiNotReadyToday(
  sentence: Sentence,
  firstLearnedAt: Map<string, number>,
  now: number
): string[] {
  const stageTwo = sentence.reencounters.find((reencounter) => reencounter.stage === 2);
  if (stageTwo === undefined) {
    return [];
  }

  return stageTwo.kanjiIds.filter((kanjiId) => {
    const learnedAt = firstLearnedAt.get(kanjiId);
    return learnedAt === undefined || isSameLocalDay(learnedAt, now);
  });
}

/**
 * 今日学んだ字数から、開いているはずの枠を戻す。押した直後の UI 状態はアプリを落とすと
 * 消えるが、1字でも学んでいればこれで追加の残りが並び直す(ADR-0011)。
 */
function openedFromLearned(learnedToday: number, goal: number): number {
  if (learnedToday <= goal) {
    return goal;
  }
  return goal + MORE_NEW_KANJI_STEP * Math.ceil((learnedToday - goal) / MORE_NEW_KANJI_STEP);
}

function requestedToday(request: MoreLessonsRequest | null, now: number): number {
  if (request === null || !isSameLocalDay(request.requestedAt, now)) {
    return 0;
  }
  return request.openedCount;
}

function pendingNewCount(items: TodaysLessonItem[]): number {
  return items.filter((item) => !item.done && item.sentence.newKanjiId !== null).length;
}

/**
 * 字ごとに**最初に学んだ時刻**。第2段階の翌日規則が「前日以前に学んだか」を見るのに使う。
 * 読み返しの記録は `earliestCompletionBySentence` の段階で落ちている。
 */
function firstLearnedAtByKanji(
  firstCompletions: Map<string, LessonCompletion>
): Map<string, number> {
  const byKanji = new Map<string, number>();

  for (const completion of firstCompletions.values()) {
    if (completion.kanjiId === null) {
      continue;
    }
    const existing = byKanji.get(completion.kanjiId);
    if (existing === undefined || completion.completedAt < existing) {
      byKanji.set(completion.kanjiId, completion.completedAt);
    }
  }

  return byKanji;
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
