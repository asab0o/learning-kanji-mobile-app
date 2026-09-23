import { sentences as contentSentences } from '@/content';
import type { Sentence } from '@/content/types';
import type { LessonCompletion, MoreLessonsRequest, TodaysLessons } from '@/features/srs/lessons';
import {
  DAILY_NEW_KANJI_GOAL,
  MORE_NEW_KANJI_STEP,
  planTodaysLessons,
  requestMoreLessons,
} from '@/features/srs/lessons';

/**
 * 抽出規則はフィクスチャで組む。実データ(`@/content`)を入力にすると、会話文を足すたびに
 * 「先頭3件は #1〜#3」のような前提が壊れる。ここで見たいのは規則であって中身ではない。
 *
 * 例外は末尾の「実データの日割り」の1ブロックだけ(理由はそこに書く)。
 */
const sentence = (order: number, newKanjiId: string | null, stageTwo: string[] = []): Sentence => ({
  id: `s${order}`,
  chapter: 1,
  order,
  scene: 'テスト',
  lines: [],
  newKanjiId,
  reencounters: stageTwo.length === 0 ? [] : [{ word: '語', stage: 2, kanjiIds: stageTwo }],
  isFree: true,
});

/** 新出字の回だけ10本 */
const newKanjiOnly: Sentence[] = Array.from({ length: 10 }, (_, i) => sentence(i + 1, `k${i + 1}`));

/** 新出字あり3回 → 第2段階専用(k1 の読みが変わる)→ 新出字あり1回 */
const withStageTwo: Sentence[] = [
  sentence(1, 'k1'),
  sentence(2, 'k2'),
  sentence(3, 'k3'),
  sentence(4, null, ['k1']),
  sentence(5, 'k4'),
];

const at = (year: number, month: number, day: number, hour = 12, minute = 0): number =>
  new Date(year, month - 1, day, hour, minute).getTime();

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

const orders = (lessons: TodaysLessons) => lessons.items.map((item) => item.sentence.order);
const pendingOrders = (lessons: TodaysLessons) =>
  lessons.items.filter((item) => !item.done).map((item) => item.sentence.order);

describe('planTodaysLessons: 目標', () => {
  it('完了記録が空なら先頭から新出字3件を返し、目標は未達', () => {
    const result = planTodaysLessons({ sentences: newKanjiOnly, completions: [], now: TODAY });

    expect(orders(result)).toEqual([1, 2, 3]);
    expect(result.items.every((item) => !item.done && !item.beyondGoal)).toBe(true);
    expect(result.learnedToday).toBe(0);
    expect(result.goal).toBe(DAILY_NEW_KANJI_GOAL);
    expect(result.goalMet).toBe(false);
    expect(result.opened).toBe(DAILY_NEW_KANJI_GOAL);
    expect(result.waitingFor).toBeNull();
    expect(result.allDone).toBe(false);
  });

  it('今日すでに2字ぶん終えていると、未完了の新出字の回は1件になる', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [completion(1, 'k1', TODAY), completion(2, 'k2', TODAY)],
      now: TODAY,
    });

    expect(pendingOrders(result)).toEqual([3]);
    expect(result.learnedToday).toBe(2);
    expect(result.goalMet).toBe(false);
  });

  it('3字終えると目標達成になり、次に「もう」で開く字数は3', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [1, 2, 3].map((order) => completion(order, `k${order}`, TODAY)),
      now: TODAY,
    });

    expect(result.goalMet).toBe(true);
    expect(pendingOrders(result)).toEqual([]);
    expect(result.moreCount).toBe(MORE_NEW_KANJI_STEP);
  });

  it('今日終えた回は done として残り、翌日には消える', () => {
    const completions = [completion(1, 'k1', TODAY)];

    expect(
      planTodaysLessons({ sentences: newKanjiOnly, completions, now: TODAY }).items[0]
    ).toMatchObject({ done: true });

    expect(
      orders(planTodaysLessons({ sentences: newKanjiOnly, completions, now: at(2026, 9, 3) }))
    ).toEqual([2, 3, 4]);
  });

  it('前日に9字学んでいても、今日の目標は3のままで3件返る', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((order) =>
        completion(order, `k${order}`, YESTERDAY)
      ),
      now: TODAY,
    });

    expect(orders(result)).toEqual([10]);
    expect(result.goal).toBe(DAILY_NEW_KANJI_GOAL);
    expect(result.learnedToday).toBe(0);
  });

  it('前日に3字ぶん終えていても、今日また3件返る(前日の追加分を差し引かない)', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [1, 2, 3].map((order) => completion(order, `k${order}`, YESTERDAY)),
      now: TODAY,
    });

    expect(orders(result)).toEqual([4, 5, 6]);
  });
});

describe('planTodaysLessons: もう3字', () => {
  const doneThree = [1, 2, 3].map((order) => completion(order, `k${order}`, TODAY));

  it('当日の押下要求で3件増え、増えた行に beyondGoal が付く。目標は3のまま', () => {
    const base = planTodaysLessons({ sentences: newKanjiOnly, completions: doneThree, now: TODAY });
    const request = requestMoreLessons(base, TODAY);

    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: doneThree,
      now: TODAY,
      moreRequest: request,
    });

    expect(pendingOrders(result)).toEqual([4, 5, 6]);
    expect(
      result.items.filter((item) => item.beyondGoal).map((item) => item.sentence.order)
    ).toEqual([4, 5, 6]);
    expect(result.goal).toBe(DAILY_NEW_KANJI_GOAL);
    expect(result.opened).toBe(DAILY_NEW_KANJI_GOAL + MORE_NEW_KANJI_STEP);
  });

  it('前日の押下要求は無視する(日をまたいで持ち越さない)', () => {
    const staleRequest: MoreLessonsRequest = { requestedAt: YESTERDAY, openedCount: 6 };

    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [],
      now: TODAY,
      moreRequest: staleRequest,
    });

    expect(orders(result)).toEqual([1, 2, 3]);
    expect(result.opened).toBe(DAILY_NEW_KANJI_GOAL);
  });

  it('押下要求が無くても、今日5字学んでいれば追加の残り1件が並ぶ(学んだ字数から導出)', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [1, 2, 3, 4, 5].map((order) => completion(order, `k${order}`, TODAY)),
      now: TODAY,
    });

    expect(pendingOrders(result)).toEqual([6]);
    expect(result.opened).toBe(6);
  });

  it('目標の外で学び終えた行も beyondGoal のまま残る(画面ではカードの下に並ぶ)', () => {
    const result = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: [1, 2, 3, 4, 5].map((order) => completion(order, `k${order}`, TODAY)),
      now: TODAY,
    });

    expect(result.items.map((item) => [item.sentence.order, item.done, item.beyondGoal])).toEqual([
      [1, true, false],
      [2, true, false],
      [3, true, false],
      [4, true, true],
      [5, true, true],
      [6, false, true],
    ]);
  });

  it('目標の外に並ぶ第2段階の行にも beyondGoal が付く', () => {
    // 4字目(目標の外)の直後に、前日に学んだ k1 の第2段階が来る並び
    const result = planTodaysLessons({
      sentences: [
        ...[1, 2, 3, 4, 5].map((order) => sentence(order, `k${order}`)),
        sentence(6, null, ['k1']),
      ],
      completions: [
        completion(1, 'k1', YESTERDAY),
        ...[2, 3, 4, 5].map((order) => completion(order, `k${order}`, TODAY)),
      ],
      now: TODAY,
    });

    expect(result.items.find((item) => item.sentence.order === 6)?.beyondGoal).toBe(true);
  });

  it('入力の残りが1字なら moreCount は1、使い切ると0で allDone', () => {
    const nine = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((order) => completion(order, `k${order}`, TODAY));
    const beforeLast = planTodaysLessons({
      sentences: newKanjiOnly,
      completions: nine,
      now: TODAY,
    });

    expect(beforeLast.moreCount).toBe(1);

    const all = [...nine, completion(10, 'k10', TODAY)];
    const finished = planTodaysLessons({ sentences: newKanjiOnly, completions: all, now: TODAY });

    expect(finished.moreCount).toBe(0);
    expect(finished.allDone).toBe(true);
  });

  it('requestMoreLessons は開いている枠に3を足し、押した時刻を持つ', () => {
    const lessons = planTodaysLessons({ sentences: newKanjiOnly, completions: [], now: TODAY });

    expect(requestMoreLessons(lessons, TODAY)).toEqual({
      requestedAt: TODAY,
      openedCount: DAILY_NEW_KANJI_GOAL + MORE_NEW_KANJI_STEP,
    });
  });
});

describe('planTodaysLessons: 第2段階の翌日規則', () => {
  it('読みが変わる字を前日に学んでいれば、枠を使わずに並ぶ', () => {
    const result = planTodaysLessons({
      sentences: withStageTwo,
      completions: [completion(1, 'k1', YESTERDAY)],
      now: TODAY,
    });

    expect(orders(result)).toEqual([2, 3, 4, 5]);
    expect(result.waitingFor).toBeNull();
  });

  it('その字を今日学んだなら並ばず、waitingFor が立ち、後ろの新出字の回も並ばない', () => {
    const result = planTodaysLessons({
      sentences: withStageTwo,
      completions: [1, 2, 3].map((order) => completion(order, `k${order}`, TODAY)),
      now: TODAY,
      moreRequest: { requestedAt: TODAY, openedCount: 6 },
    });

    expect(orders(result)).toEqual([1, 2, 3]);
    expect(result.waitingFor?.sentence.order).toBe(4);
    expect(result.waitingFor?.kanjiIds).toEqual(['k1']);
    expect(result.moreCount).toBe(0);
  });

  it('その字が「今日並んでいるが未完了」でも待ちになる', () => {
    const result = planTodaysLessons({ sentences: withStageTwo, completions: [], now: TODAY });

    expect(orders(result)).toEqual([1, 2, 3]);
    expect(result.waitingFor?.kanjiIds).toEqual(['k1']);
  });

  it('2字のうち1字だけ今日なら待ちになり、kanjiIds は今日の1字だけ', () => {
    const twoKanji = [sentence(1, 'k1'), sentence(2, 'k2'), sentence(3, null, ['k1', 'k2'])];

    const result = planTodaysLessons({
      sentences: twoKanji,
      completions: [completion(1, 'k1', YESTERDAY), completion(2, 'k2', TODAY)],
      now: TODAY,
    });

    expect(result.waitingFor?.sentence.order).toBe(3);
    expect(result.waitingFor?.kanjiIds).toEqual(['k2']);
  });

  it('23:59 に学んだ字の第2段階は、翌 00:01 には並ぶ', () => {
    const result = planTodaysLessons({
      sentences: withStageTwo,
      completions: [1, 2, 3].map((order) => completion(order, `k${order}`, at(2026, 9, 1, 23, 59))),
      now: at(2026, 9, 2, 0, 1),
    });

    expect(orders(result)).toEqual([4, 5]);
    expect(result.waitingFor).toBeNull();
  });

  it('目標に届く前に待ちで止まると、目標未達のままで moreCount は0', () => {
    const shortDay = [
      sentence(1, 'k1'),
      sentence(2, 'k2'),
      sentence(3, null, ['k2']),
      sentence(4, 'k3'),
    ];

    const result = planTodaysLessons({
      sentences: shortDay,
      completions: [completion(1, 'k1', TODAY), completion(2, 'k2', TODAY)],
      now: TODAY,
    });

    expect(pendingOrders(result)).toEqual([]);
    expect(result.goalMet).toBe(false);
    expect(result.moreCount).toBe(0);
    expect(result.waitingFor?.kanjiIds).toEqual(['k2']);
  });

  it('moreCount は途中の待ちで頭打ちになる(新出1字 → 待ち → 新出2字なら1)', () => {
    const capped = [
      ...[1, 2, 3].map((order) => sentence(order, `k${order}`)),
      sentence(4, 'k4'),
      sentence(5, null, ['k4']),
      sentence(6, 'k5'),
      sentence(7, 'k6'),
    ];

    const result = planTodaysLessons({
      sentences: capped,
      completions: [1, 2, 3].map((order) => completion(order, `k${order}`, TODAY)),
      now: TODAY,
    });

    expect(result.moreCount).toBe(1);
  });

  it('第2段階の行が目標の3字の直後に来るなら、目標内の行として並ぶ', () => {
    const result = planTodaysLessons({
      sentences: withStageTwo,
      completions: [completion(1, 'k1', YESTERDAY)],
      now: TODAY,
    });

    expect(result.items.find((item) => item.sentence.order === 4)?.beyondGoal).toBe(false);
  });

  it('第2段階専用の回を終えても、その日の目標の字数は増えない', () => {
    const result = planTodaysLessons({
      sentences: withStageTwo,
      completions: [completion(1, 'k1', YESTERDAY), completion(4, null, TODAY)],
      now: TODAY,
    });

    expect(result.learnedToday).toBe(0);
    expect(pendingOrders(result)).toEqual([2, 3, 5]);
  });
});

describe('planTodaysLessons: 開発用の制限解除', () => {
  it('unrestricted なら枠も翌日規則も外れて全件並び、moreCount は0', () => {
    const result = planTodaysLessons({
      sentences: withStageTwo,
      completions: [],
      now: TODAY,
      unrestricted: true,
    });

    expect(orders(result)).toEqual([1, 2, 3, 4, 5]);
    expect(result.waitingFor).toBeNull();
    expect(result.moreCount).toBe(0);
  });
});

describe('planTodaysLessons: 記録の畳み込み(既存の規則)', () => {
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
    expect(orders(result)).toEqual([2, 3, 4]);
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
});

/**
 * **実データの日割り。** このブロックだけ `@/content` を入力にする。
 *
 * ここで守りたいのは抽出規則ではなく、**会話文の並びと翌日規則が噛み合って生まれる日程**そのもの
 * (ADR-0011: 一気読みでも最短5日、3字/日なら D16 だけ2字で止まる)。会話文を書き換えて
 * この日程が変わったら、それは意図して見直すべき変化なので、落ちて知らせてほしい。
 */
describe('実データの日割り(ADR-0011)', () => {
  const dayStart = (day: number) => at(2026, 10, day, 9);

  /**
   * 1日ぶん学ぶ。`all` は「もう」を押せる限り押して全部学ぶ人、`goal` は押さずに
   * Today に並んだ行だけを学ぶ人。学んだ回の order と、1日の最後の計画を返す。
   */
  function studyDay(completions: LessonCompletion[], day: number, mode: 'all' | 'goal') {
    const learned: number[] = [];
    let now = dayStart(day);
    let request: MoreLessonsRequest | null = null;

    for (;;) {
      const plan = planTodaysLessons({
        sentences: contentSentences,
        completions,
        now,
        moreRequest: request,
      });
      const next = plan.items.find((item) => !item.done);

      if (next !== undefined) {
        completions.push({
          sentenceId: next.sentence.id,
          kanjiId: next.sentence.newKanjiId,
          completedAt: now,
        });
        learned.push(next.sentence.order);
        now += 60_000;
        continue;
      }

      if (mode === 'all' && plan.moreCount > 0) {
        request = requestMoreLessons(plan, now);
        continue;
      }

      return { learned, plan };
    }
  }

  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

  it('毎日全部学ぶ人は5日で終わり、どの日も第2段階の手前で止まる', () => {
    const completions: LessonCompletion[] = [];
    const days = [1, 2, 3, 4, 5].map((day) => studyDay(completions, day, 'all').learned);

    expect(days).toEqual([
      range(1, 16),
      range(17, 29),
      range(30, 44),
      range(45, 54),
      range(55, 58),
    ]);
  });

  it('毎日3字だけ学ぶ人は、16日目だけ2字で止まり、17日目に終わる', () => {
    const completions: LessonCompletion[] = [];
    const results = Array.from({ length: 17 }, (_, i) => studyDay(completions, i + 1, 'goal'));
    const day16 = results[15];
    const day17 = results[16];

    expect(day16.learned).toEqual([53, 54]);
    expect(day16.plan.goalMet).toBe(false);
    expect(day16.plan.waitingFor?.sentence.order).toBe(55);
    expect(day17.learned).toEqual(range(55, 58));
    expect(day17.plan.allDone).toBe(true);
  });
});
