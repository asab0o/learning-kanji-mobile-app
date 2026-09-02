/**
 * 復習セッションの状態遷移。
 *
 * **DB を書かない。** 何を書くかは呼び出し側(`src/app/review.tsx`)が決める。
 * ここが書き込みを持つと、テストが `@/db/client` に到達して SQLite を開く。
 *
 * **推測クイズ(要件4.4)をここに混ぜない**(絶対規則10)。クイズはセッションの
 * 前後に別画面として差し込む形にする。混ぜると「SRSに入れていない」ことを
 * レビューで確認できなくなる。
 */

import type { KanjiEntry } from '@/content/types';
import { buildMeaningChoices } from '@/features/srs/choices';
import type { ReviewQueueItem } from '@/features/srs/scheduler';

export interface ReviewAnswer {
  selected: string;
  correct: boolean;
  /**
   * このセッションで**その字に初めて答えた**回答か。
   *
   * **成績になるのはここが true のときだけ。** 不正解の字はキューの末尾に戻って
   * もう一度出るが、そこでの正解まで記録すると `incorrect` → `correct` が並び、
   * 畳み込みでステージが元に戻る。**降格が一度も効かなくなり、精度に関係なく
   * 全字が最短で Burned に到達する。** 出し直しは復習であって再採点ではない。
   */
  first: boolean;
}

export interface ReviewSession {
  /** まだ答えていない項目。先頭が出題中 */
  queue: ReviewQueueItem[];
  current: ReviewQueueItem | null;
  choices: string[];
  /** 答え合わせ中なら中身が入る。出題中は null */
  answered: ReviewAnswer | null;
  /** 正解して退場した数 */
  answeredCount: number;
  /** このセッションで一度でも答えた字。`ReviewAnswer.first` の判定に使う */
  answeredKanjiIds: string[];
  /** 最初のキュー長で固定。出し直しで分母が動くと進捗表示が壊れる */
  total: number;
}

export interface CreateReviewSessionInput {
  items: ReviewQueueItem[];
  /** 誤答の供給元(`buildMeaningChoices` にそのまま渡す) */
  pool: KanjiEntry[];
  rng?: () => number;
}

export function createReviewSession({
  items,
  pool,
  rng = Math.random,
}: CreateReviewSessionInput): ReviewSession {
  const queue = shuffle(items, rng);

  return {
    queue,
    current: queue[0] ?? null,
    choices:
      queue[0] === undefined ? [] : buildMeaningChoices({ target: queue[0].kanji, pool, rng }),
    answered: null,
    answeredCount: 0,
    answeredKanjiIds: [],
    total: items.length,
  };
}

/** 選択肢を選んだ。**判定するだけで、キューは動かさない**(答え合わせを見せるため) */
export function answerReviewSession(state: ReviewSession, selected: string): ReviewSession {
  if (state.current === null || state.answered !== null) {
    return state;
  }

  const kanjiId = state.current.kanji.id;
  const first = !state.answeredKanjiIds.includes(kanjiId);

  return {
    ...state,
    answered: { selected, correct: selected === state.current.kanji.meaning, first },
    answeredKanjiIds: first ? [...state.answeredKanjiIds, kanjiId] : state.answeredKanjiIds,
  };
}

export interface AdvanceReviewSessionInput {
  state: ReviewSession;
  pool: KanjiEntry[];
  rng?: () => number;
}

/**
 * 答え合わせを閉じて次へ。
 *
 * **不正解ならキューの末尾に戻す。** そのぶん `total` は増やさない。
 * 戻ってきたときの選択肢はその場で作り直す(並びで覚えられないようにする)。
 */
export function advanceReviewSession({
  state,
  pool,
  rng = Math.random,
}: AdvanceReviewSessionInput): ReviewSession {
  if (state.current === null || state.answered === null) {
    return state;
  }

  const rest = state.queue.slice(1);
  const queue = state.answered.correct ? rest : [...rest, state.current];
  const next = queue[0] ?? null;

  return {
    queue,
    current: next,
    choices: next === null ? [] : buildMeaningChoices({ target: next.kanji, pool, rng }),
    answered: null,
    answeredCount: state.answeredCount + (state.answered.correct ? 1 : 0),
    answeredKanjiIds: state.answeredKanjiIds,
    total: state.total,
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
