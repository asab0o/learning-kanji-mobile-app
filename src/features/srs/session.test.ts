import type { KanjiEntry } from '@/content/types';
import type { ReviewQueueItem } from '@/features/srs/scheduler';
import {
  advanceReviewSession,
  answerReviewSession,
  createReviewSession,
} from '@/features/srs/session';

const kanji = (id: string, meaning: string, order: number): KanjiEntry => ({
  id,
  character: '一',
  meaning,
  order,
  chapter: 1,
  illustrationKey: id,
  readings: [{ kana: 'いち', romaji: 'ichi', type: 'kun' }],
  readingIntroduction: 'kun-first',
});

const POOL = [
  kanji('k1', 'person', 1),
  kanji('k2', 'mountain', 2),
  kanji('k3', 'river', 3),
  kanji('k4', 'sky', 4),
  kanji('k5', 'flower', 5),
];

const item = (entry: KanjiEntry): ReviewQueueItem => ({ kanji: entry, stage: 1, dueDay: 0 });

/** 並びを固定するだけの擬似乱数 */
const seeded = (seed: number): (() => number) => {
  let value = seed;

  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;

    return value / 2147483648;
  };
};

const start = (count: number) =>
  createReviewSession({
    items: POOL.slice(0, count).map(item),
    pool: POOL,
    rng: seeded(11),
  });

describe('createReviewSession', () => {
  it('先頭が出題中になり、選択肢に正解が含まれる', () => {
    const session = start(3);

    expect(session.current).not.toBeNull();
    expect(session.total).toBe(3);
    expect(session.answeredCount).toBe(0);
    expect(session.answered).toBeNull();
    expect(session.choices).toContain(session.current?.kanji.meaning);
  });

  it('キューが空なら current が null になる', () => {
    const session = createReviewSession({ items: [], pool: POOL, rng: seeded(1) });

    expect(session.current).toBeNull();
    expect(session.choices).toEqual([]);
    expect(session.total).toBe(0);
  });
});

describe('answerReviewSession', () => {
  it('正解を選ぶと correct になり、キューはまだ動かない', () => {
    const session = start(2);
    const answered = answerReviewSession(session, session.current?.kanji.meaning ?? '');

    expect(answered.answered?.correct).toBe(true);
    expect(answered.queue).toHaveLength(2);
    expect(answered.answeredCount).toBe(0);
  });

  it('別の意味を選ぶと incorrect になる', () => {
    const session = start(2);
    const wrong = session.choices.find((choice) => choice !== session.current?.kanji.meaning);
    const answered = answerReviewSession(session, wrong ?? '');

    expect(answered.answered?.correct).toBe(false);
  });

  it('答え合わせ中に選び直しても状態が変わらない', () => {
    const session = start(2);
    const answered = answerReviewSession(session, session.current?.kanji.meaning ?? '');

    expect(answerReviewSession(answered, 'something else')).toBe(answered);
  });
});

describe('advanceReviewSession', () => {
  it('正解した項目は退場し、answeredCount が1増える', () => {
    const session = start(3);
    const first = session.current;
    const next = advanceReviewSession({
      state: answerReviewSession(session, first?.kanji.meaning ?? ''),
      pool: POOL,
      rng: seeded(12),
    });

    expect(next.answeredCount).toBe(1);
    expect(next.queue).toHaveLength(2);
    expect(next.queue.map((queued) => queued.kanji.id)).not.toContain(first?.kanji.id);
    expect(next.total).toBe(3);
    expect(next.answered).toBeNull();
  });

  it('不正解の項目はキューの末尾に戻り、total は変わらない', () => {
    const session = start(3);
    const first = session.current;
    const wrong = session.choices.find((choice) => choice !== first?.kanji.meaning);
    const next = advanceReviewSession({
      state: answerReviewSession(session, wrong ?? ''),
      pool: POOL,
      rng: seeded(13),
    });

    expect(next.answeredCount).toBe(0);
    expect(next.queue).toHaveLength(3);
    expect(next.queue[next.queue.length - 1].kanji.id).toBe(first?.kanji.id);
    expect(next.total).toBe(3);
  });

  it('戻ってきた項目の選択肢にも正解が含まれる', () => {
    let session = start(1);
    const target = session.current;
    const wrong = session.choices.find((choice) => choice !== target?.kanji.meaning);

    session = advanceReviewSession({
      state: answerReviewSession(session, wrong ?? ''),
      pool: POOL,
      rng: seeded(14),
    });

    expect(session.current?.kanji.id).toBe(target?.kanji.id);
    expect(session.choices).toContain(target?.kanji.meaning);
  });

  it('全項目を正解にすると current が null になり、answeredCount が total と一致する', () => {
    let session = start(3);

    while (session.current !== null) {
      session = advanceReviewSession({
        state: answerReviewSession(session, session.current.kanji.meaning),
        pool: POOL,
        rng: seeded(15),
      });
    }

    expect(session.current).toBeNull();
    expect(session.answeredCount).toBe(3);
    expect(session.answeredCount).toBe(session.total);
  });

  it('出し直しの回答は first が false になる(成績にしない)', () => {
    let session = start(1);
    const target = session.current;
    const wrong = session.choices.find((choice) => choice !== target?.kanji.meaning);

    const firstAnswer = answerReviewSession(session, wrong ?? '');
    expect(firstAnswer.answered?.first).toBe(true);

    session = advanceReviewSession({ state: firstAnswer, pool: POOL, rng: seeded(17) });

    // 同じ字が戻ってきた。ここで正解しても記録の対象にはならない
    expect(session.current?.kanji.id).toBe(target?.kanji.id);
    const retry = answerReviewSession(session, target?.kanji.meaning ?? '');
    expect(retry.answered?.correct).toBe(true);
    expect(retry.answered?.first).toBe(false);
  });

  it('別の字への回答は、前の字を答えたあとでも first が true になる', () => {
    let session = start(2);
    const firstKanji = session.current;

    session = advanceReviewSession({
      state: answerReviewSession(session, firstKanji?.kanji.meaning ?? ''),
      pool: POOL,
      rng: seeded(18),
    });

    expect(session.current?.kanji.id).not.toBe(firstKanji?.kanji.id);
    expect(answerReviewSession(session, session.current?.kanji.meaning ?? '').answered?.first).toBe(
      true
    );
  });

  it('答え合わせ前に進めようとしても何も起きない', () => {
    const session = start(2);

    expect(advanceReviewSession({ state: session, pool: POOL, rng: seeded(16) })).toBe(session);
  });
});
