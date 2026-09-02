import type { Sentence } from '@/content/types';
import type { LessonCompletion } from '@/features/srs/lessons';
import { planTodaysLessons } from '@/features/srs/lessons';

/**
 * フィクスチャで組む。実データ(`@/content`)を入力にすると、第4章が入るたびに
 * 「先頭3件は #1〜#3」のような前提が壊れる。ここで見たいのは抽出規則であって
 * コンテンツの中身ではない。
 */
const sentence = (order: number, newKanjiId: string | null): Sentence => ({
  id: `s${order}`,
  chapter: 1,
  order,
  scene: 'テスト',
  lines: [],
  newKanjiId,
  reencounters: [],
  isFree: true,
});

/** 新出字あり4回 + 3番目と4番目の間に第2段階専用回 */
const withStageTwo: Sentence[] = [
  sentence(1, 'k1'),
  sentence(2, 'k2'),
  sentence(3, 'k3'),
  sentence(4, null),
  sentence(5, 'k4'),
];

/**
 * 新出字あり7回だけ。**5回だと足りない** —
 * 「昨日3字ぶん終えても今日また3件返る」を検証するのに、残りが3件以上要る。
 */
const newKanjiOnly: Sentence[] = [
  sentence(1, 'k1'),
  sentence(2, 'k2'),
  sentence(3, 'k3'),
  sentence(4, 'k4'),
  sentence(5, 'k5'),
  sentence(6, 'k6'),
  sentence(7, 'k7'),
];

const at = (year: number, month: number, day: number, hour = 12): number =>
  new Date(year, month - 1, day, hour).getTime();

const TODAY = at(2026, 9, 2);
const YESTERDAY = at(2026, 9, 1);

const completion = (
  order: number,
  kanjiId: string | null,
  completedAt: number
): LessonCompletion => ({
  sentenceId: `s${order}`,
  kanjiId,
  completedAt,
});

describe('planTodaysLessons', () => {
  it('完了記録が空なら先頭から新出字3件を返す', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [],
      now: TODAY,
    });

    expect(result.items.map((item) => item.sentence.order)).toEqual([1, 2, 3]);
    expect(result.items.every((item) => !item.done)).toBe(true);
    expect(result.learnedToday).toBe(0);
    expect(result.remaining).toBe(3);
    expect(result.allDone).toBe(false);
  });

  it('今日すでに2字ぶん終えていると、未完了の新出字の回は1件になる', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [completion(1, 'k1', TODAY), completion(2, 'k2', TODAY)],
      now: TODAY,
    });

    expect(result.items.filter((item) => !item.done).map((item) => item.sentence.order)).toEqual([
      3,
    ]);
    expect(result.learnedToday).toBe(2);
    expect(result.remaining).toBe(1);
  });

  it('今日終えた回は done として残り、翌日には消える', () => {
    const completions = [completion(1, 'k1', TODAY)];

    expect(
      planTodaysLessons({ sentences: newKanjiOnly, completions, now: TODAY }).items[0]
    ).toMatchObject({ done: true });

    const tomorrow = at(2026, 9, 3);
    expect(
      planTodaysLessons({ sentences: newKanjiOnly, completions, now: tomorrow }).items.map(
        (item) => item.sentence.order
      )
    ).toEqual([2, 3, 4]);
  });

  it('昨日3字ぶん終えていても、今日また3件返る', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [
        completion(1, 'k1', YESTERDAY),
        completion(2, 'k2', YESTERDAY),
        completion(3, 'k3', YESTERDAY),
      ],
      now: TODAY,
    });

    expect(result.items.map((item) => item.sentence.order)).toEqual([4, 5, 6]);
    expect(result.learnedToday).toBe(0);
    expect(result.remaining).toBe(3);
  });

  it('第2段階専用の回は枠を使わず、3字と一緒に4件目として並ぶ', () => {
    const result = planTodaysLessons({
      sentences: withStageTwo,
      completions: [],
      now: TODAY,
    });

    expect(result.items).toHaveLength(4);
    expect(result.items.map((item) => item.sentence.order)).toEqual([1, 2, 3, 4]);
    expect(result.items.filter((item) => item.sentence.newKanjiId !== null)).toHaveLength(3);
  });

  it('第2段階専用の回を終えても、その日の枠は減らない', () => {
    const result = planTodaysLessons({
      sentences: withStageTwo,
      completions: [completion(4, null, TODAY)],
      now: TODAY,
    });

    expect(result.learnedToday).toBe(0);
    expect(result.remaining).toBe(3);
    expect(result.items.filter((item) => !item.done).map((item) => item.sentence.order)).toEqual([
      1, 2, 3,
    ]);
  });

  it('同じ回の完了記録が2件あっても learnedToday は1しか増えない', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [completion(1, 'k1', TODAY), completion(1, 'k1', TODAY + 1000)],
      now: TODAY,
    });

    expect(result.learnedToday).toBe(1);
    expect(result.items.filter((item) => item.done)).toHaveLength(1);
  });

  it('読み返しの記録が後日に付いても、学んだ日は最初の1件で決まる', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [completion(1, 'k1', YESTERDAY), completion(1, 'k1', TODAY)],
      now: TODAY,
    });

    expect(result.learnedToday).toBe(0);
    expect(result.items.map((item) => item.sentence.order)).toEqual([2, 3, 4]);
  });

  it('すべて終えていると allDone が true になり、items が空になる', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: newKanjiOnly.map((s) => completion(s.order, s.newKanjiId, YESTERDAY)),
      now: TODAY,
    });

    expect(result.allDone).toBe(true);
    expect(result.items).toEqual([]);
  });

  it('limit に Infinity を渡すと未完了の回がすべて並ぶ(開発用の上限解除)', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [],
      now: TODAY,
      limit: Number.POSITIVE_INFINITY,
    });

    expect(result.items).toHaveLength(7);
  });
});
