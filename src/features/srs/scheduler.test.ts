import type { KanjiEntry } from '@/content/types';
import type { LessonCompletion } from '@/features/srs/lessons';
import type { ReviewRecord } from '@/features/srs/scheduler';
import { BURNED_STAGE, foldKanjiStates, planTodaysReviews } from '@/features/srs/scheduler';

/**
 * フィクスチャで組む。実データ(`@/content`)を入力にすると、コンテンツが変わるたびに
 * 前提が壊れる。ここで見たいのはステージ遷移の規則であって漢字の中身ではない。
 */
const kanji = (id: string, order: number): KanjiEntry => ({
  id,
  character: '一',
  meaning: `meaning ${order}`,
  order,
  chapter: 1,
  illustrationKey: `key-${order}`,
  readings: [{ kana: 'いち', romaji: 'ichi', type: 'kun' }],
  readingIntroduction: 'kun-first',
});

const at = (year: number, month: number, day: number, hour = 12): number =>
  new Date(year, month - 1, day, hour).getTime();

const startOf = (year: number, month: number, day: number): number =>
  new Date(year, month - 1, day).getTime();

const lesson = (kanjiId: string | null, completedAt: number): LessonCompletion => ({
  sentenceId: `s-${kanjiId ?? 'none'}`,
  kanjiId,
  completedAt,
});

let seq = 0;
const review = (
  kanjiId: string,
  result: 'correct' | 'incorrect',
  reviewedAt: number
): ReviewRecord => ({
  id: `r${(seq += 1)}`.padStart(6, '0'),
  kanjiId,
  result,
  reviewedAt,
});

const K1 = kanji('k1', 1);
const K2 = kanji('k2', 2);

const DAY1 = at(2026, 9, 2);
const DAY2 = at(2026, 9, 3);
const DAY3 = at(2026, 9, 4);

describe('planTodaysReviews', () => {
  it('今日導入した字は、今日のキューには入らない(当日復習を入れない)', () => {
    const result = planTodaysReviews({
      kanji: [K1],
      lessons: [lesson('k1', DAY1)],
      reviews: [],
      now: DAY1,
    });

    expect(result.items).toEqual([]);
    expect(result.dueCount).toBe(0);
  });

  it('翌日になるとステージ1で出題対象になる', () => {
    const result = planTodaysReviews({
      kanji: [K1],
      lessons: [lesson('k1', DAY1)],
      reviews: [],
      now: DAY2,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].kanji.id).toBe('k1');
    expect(result.items[0].stage).toBe(1);
  });

  it('第2段階専用の回(kanjiId が null)はキューを作らない', () => {
    const result = planTodaysReviews({
      kanji: [K1],
      lessons: [lesson(null, DAY1)],
      reviews: [],
      now: DAY2,
    });

    expect(result.items).toEqual([]);
  });

  it('lesson_events に無い字は、review_events があってもキューに入らない', () => {
    const result = planTodaysReviews({
      kanji: [K1],
      lessons: [],
      reviews: [review('k1', 'correct', DAY1)],
      now: DAY3,
    });

    expect(result.items).toEqual([]);
  });

  it('ステージ1で正解するとステージ2になり、翌日は出ず2日後に出る', () => {
    const input = {
      kanji: [K1],
      lessons: [lesson('k1', DAY1)],
      reviews: [review('k1', 'correct', DAY2)],
    };

    expect(planTodaysReviews({ ...input, now: DAY3 }).items).toEqual([]);

    const twoDaysLater = at(2026, 9, 5);
    expect(planTodaysReviews({ ...input, now: twoDaysLater }).items).toHaveLength(1);
    expect(planTodaysReviews({ ...input, now: twoDaysLater }).items[0].stage).toBe(2);
  });

  it('ステージ2で不正解にするとステージ1に下がり、翌日の対象になる(当日には戻らない)', () => {
    const input = {
      kanji: [K1],
      lessons: [lesson('k1', DAY1)],
      reviews: [review('k1', 'correct', DAY2), review('k1', 'incorrect', DAY3)],
    };

    expect(planTodaysReviews({ ...input, now: DAY3 }).items).toEqual([]);

    const next = at(2026, 9, 5);
    expect(planTodaysReviews({ ...input, now: next }).items[0].stage).toBe(1);
  });

  it('出題日を過ぎたぶんは繰り越して残る', () => {
    const result = planTodaysReviews({
      kanji: [K1],
      lessons: [lesson('k1', DAY1)],
      reviews: [],
      now: at(2026, 9, 10),
    });

    expect(result.items).toHaveLength(1);
  });

  it('並びは出題日の古い順、同じ日なら学習順', () => {
    const result = planTodaysReviews({
      kanji: [K2, K1],
      lessons: [lesson('k1', DAY1), lesson('k2', DAY1)],
      reviews: [],
      now: DAY2,
    });

    expect(result.items.map((item) => item.kanji.order)).toEqual([1, 2]);
  });
});

describe('foldKanjiStates', () => {
  it('ステージ1で不正解にしてもステージ0にならない(下限1)', () => {
    const states = foldKanjiStates({
      lessons: [lesson('k1', DAY1)],
      reviews: [review('k1', 'incorrect', DAY2)],
    });

    expect(states.get('k1')?.stage).toBe(1);
    // 次回は翌日。当日には戻らない
    expect(states.get('k1')?.dueDay).toBe(startOf(2026, 9, 4));
  });

  it('6回連続で正解すると Burned になり、以後どの日のキューにも入らない', () => {
    const reviews = [
      review('k1', 'correct', at(2026, 9, 3)),
      review('k1', 'correct', at(2026, 9, 5)),
      review('k1', 'correct', at(2026, 9, 9)),
      review('k1', 'correct', at(2026, 9, 16)),
      review('k1', 'correct', at(2026, 9, 30)),
      review('k1', 'correct', at(2026, 10, 30)),
    ];
    const states = foldKanjiStates({ lessons: [lesson('k1', DAY1)], reviews });

    expect(states.get('k1')?.stage).toBe(BURNED_STAGE);
    expect(states.get('k1')?.burned).toBe(true);

    const far = planTodaysReviews({
      kanji: [K1],
      lessons: [lesson('k1', DAY1)],
      reviews,
      now: at(2030, 1, 1),
    });
    expect(far.items).toEqual([]);
  });

  it('Burned から不正解が入るとステージが下がって復帰する', () => {
    const reviews = [
      review('k1', 'correct', at(2026, 9, 3)),
      review('k1', 'correct', at(2026, 9, 5)),
      review('k1', 'correct', at(2026, 9, 9)),
      review('k1', 'correct', at(2026, 9, 16)),
      review('k1', 'correct', at(2026, 9, 30)),
      review('k1', 'correct', at(2026, 10, 30)),
      review('k1', 'incorrect', at(2026, 11, 1)),
    ];
    const states = foldKanjiStates({ lessons: [lesson('k1', DAY1)], reviews });

    expect(states.get('k1')?.burned).toBe(false);
    expect(states.get('k1')?.stage).toBe(BURNED_STAGE - 1);
  });

  it('イベントを時系列と逆順に渡しても畳み込み結果が同じになる', () => {
    const reviews = [
      review('k1', 'correct', at(2026, 9, 3)),
      review('k1', 'incorrect', at(2026, 9, 5)),
      review('k1', 'correct', at(2026, 9, 6)),
    ];
    const forward = foldKanjiStates({ lessons: [lesson('k1', DAY1)], reviews });
    const backward = foldKanjiStates({
      lessons: [lesson('k1', DAY1)],
      reviews: [...reviews].reverse(),
    });

    expect(backward.get('k1')).toEqual(forward.get('k1'));
  });
});
