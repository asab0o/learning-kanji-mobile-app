import type { KanjiEntry, Word } from '@/content/types';
import { pickQuizItem, RECENT_ITEM_MEMORY, toItemKey } from '@/features/quiz/selection';
import type { PickQuizItemInput } from '@/features/quiz/selection';

/**
 * フィクスチャで書く。**実データ(`src/content/index.ts`)に依存させない。**
 * 会話文が1本足されるたびにテストが落ちると、落ちた理由が仕様違反なのか
 * コンテンツ追加なのか区別できなくなる。
 */
const kanji = (id: string, character: string, meaning: string): KanjiEntry => ({
  id,
  character,
  meaning,
  order: 1,
  chapter: 1,
  illustrationKey: id,
  readings: [{ kana: 'よみ', romaji: 'yomi', type: 'kun' }],
  readingIntroduction: 'kun-first',
});

const word = (
  id: string,
  kanjiId: string,
  surface: string,
  meaning: string,
  encounteredInSentenceId: string | null = null
): Word => ({
  id,
  kanjiId,
  surface,
  kana: 'よみ',
  meaning,
  readingType: 'kun',
  encounteredInSentenceId,
});

const PERSON = kanji('k-person', '人', 'person');
const SPACE = kanji('k-space', '間', 'space between');
const FIRE = kanji('k-fire', '火', 'fire');
const FLOWER = kanji('k-flower', '花', 'flower');

const MASTER = [PERSON, SPACE, FIRE, FLOWER];

/** 決定的にするための擬似乱数(`srs/choices.test.ts` と同じ) */
const seeded = (seed: number): (() => number) => {
  let value = seed;

  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;

    return value / 2147483648;
  };
};

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 8, 6, 10, 0, 0).getTime();
const YESTERDAY = NOW - DAY;

const input = (overrides: Partial<PickQuizItemInput> = {}): PickQuizItemInput => ({
  words: [word('w1', 'k-person', '人間', 'human being')],
  kanji: MASTER,
  reencounterWords: [],
  learned: [{ kanjiId: 'k-person', completedAt: YESTERDAY }],
  completedSentenceIds: [],
  recentItemKeys: [],
  slot: 'lesson',
  now: NOW,
  rng: seeded(1),
  ...overrides,
});

describe('pickQuizItem', () => {
  it('既習字を含む未出会いの熟語を返し、構成字の内訳を詰めて返す', () => {
    const item = pickQuizItem(input());

    expect(item).not.toBeNull();
    expect(item?.surface).toBe('人間');
    expect(item?.itemKey).toBe('word:人間');
    expect(item?.components).toEqual([
      { character: '人', meaning: 'person', learned: true },
      { character: '間', meaning: 'space between', learned: false },
    ]);
  });

  it('構成字がマスタに無い語は選ばれない(種明かしの英語を引く先が無いため)', () => {
    // `道` はマスタに無い。要件4.4 の例(歩道)がこれに当たる
    const item = pickQuizItem(input({ words: [word('w1', 'k-person', '人道', 'humanity')] }));

    expect(item).toBeNull();
  });

  it('既習字を1字も含まない語は選ばれない', () => {
    const item = pickQuizItem(
      input({
        words: [word('w1', 'k-fire', '花火', 'fireworks')],
        learned: [{ kanjiId: 'k-person', completedAt: YESTERDAY }],
      })
    );

    expect(item).toBeNull();
  });

  it('1字の語は選ばれない(構成字の種明かしが成立しない)', () => {
    const item = pickQuizItem(input({ words: [word('w1', 'k-person', '人', 'person')] }));

    expect(item).toBeNull();
  });

  it('学び終えた回で出会った語は選ばれない', () => {
    const item = pickQuizItem(
      input({
        words: [word('w1', 'k-person', '人間', 'human being', 's-10')],
        completedSentenceIds: ['s-10'],
      })
    );

    expect(item).toBeNull();
  });

  it('まだ学んでいない回で出会う語は選ばれる', () => {
    const item = pickQuizItem(
      input({
        words: [word('w1', 'k-person', '人間', 'human being', 's-10')],
        completedSentenceIds: ['s-9'],
      })
    );

    expect(item?.surface).toBe('人間');
  });

  it('同じ語の2行のうち片方だけが既読でも選ばれない(樹ごとに別の回を指すため)', () => {
    // `新聞` のように、2つの樹の行が別々の回を指すことがある
    const item = pickQuizItem(
      input({
        words: [
          word('w1', 'k-person', '人間', 'human being', null),
          word('w2', 'k-space', '人間', 'human being', 's-10'),
        ],
        completedSentenceIds: ['s-10'],
      })
    );

    expect(item).toBeNull();
  });

  it('第2段階の演出語は、ほかに候補が無くても選ばれない', () => {
    const item = pickQuizItem(
      input({
        words: [word('w1', 'k-person', '人間', 'human being')],
        reencounterWords: ['人間'],
      })
    );

    expect(item).toBeNull();
  });

  it('演出語を部分文字列として含む語も選ばれない(種明かしが演出を先に潰すため)', () => {
    // 実データの `外国人`(初日に出題可)と `外国`(#55 の演出)の関係
    const item = pickQuizItem(
      input({
        words: [word('w1', 'k-person', '人間人', 'people')],
        reencounterWords: ['人間'],
      })
    );

    expect(item).toBeNull();
  });

  it('直近に出した語は選ばれない', () => {
    const item = pickQuizItem(
      input({
        words: [
          word('w1', 'k-person', '人間', 'human being'),
          word('w2', 'k-fire', '花火', 'fireworks'),
        ],
        learned: [
          { kanjiId: 'k-person', completedAt: YESTERDAY },
          { kanjiId: 'k-flower', completedAt: YESTERDAY },
        ],
        recentItemKeys: [toItemKey('人間')],
      })
    );

    expect(item?.surface).toBe('花火');
  });

  it('候補が全部 recent に入っていたら、その条件だけ落として1問返す', () => {
    const item = pickQuizItem(input({ recentItemKeys: [toItemKey('人間')] }));

    expect(item?.surface).toBe('人間');
  });

  it(`recent は先頭 ${RECENT_ITEM_MEMORY} 件しか見ない`, () => {
    const older = Array.from({ length: RECENT_ITEM_MEMORY }, (_, index) => `word:filler${index}`);
    const item = pickQuizItem(input({ recentItemKeys: [...older, toItemKey('人間')] }));

    // 窓の外に出た語は「直近ではない」ので出してよい
    expect(item?.surface).toBe('人間');
  });

  it('slot=lesson は、その日に学んだ字を含む語を優先する', () => {
    const item = pickQuizItem(
      input({
        words: [
          word('w1', 'k-person', '人間', 'human being'),
          word('w2', 'k-fire', '花火', 'fireworks'),
        ],
        learned: [
          { kanjiId: 'k-person', completedAt: YESTERDAY },
          { kanjiId: 'k-fire', completedAt: NOW },
          { kanjiId: 'k-flower', completedAt: NOW },
        ],
        slot: 'lesson',
      })
    );

    expect(item?.surface).toBe('花火');
  });

  it('slot=lesson は、たった今学んだ字を含む語を最優先にする', () => {
    // `小` を学び終えた直後に、同じ日に学んだ `人` の語が出ると唐突に見える
    const item = pickQuizItem(
      input({
        words: [
          word('w1', 'k-person', '人間', 'human being'),
          word('w2', 'k-fire', '花火', 'fireworks'),
        ],
        learned: [
          // どちらも「今日」学んでいるので、focusKanjiId が無いと両方が候補になる
          { kanjiId: 'k-person', completedAt: NOW },
          { kanjiId: 'k-fire', completedAt: NOW },
          { kanjiId: 'k-flower', completedAt: NOW },
        ],
        slot: 'lesson',
        focusKanjiId: 'k-fire',
      })
    );

    expect(item?.surface).toBe('花火');
  });

  it('今学んだ字を含む語が無ければ、その日に学んだ字の語に落ちる', () => {
    const item = pickQuizItem(
      input({
        words: [word('w1', 'k-person', '人間', 'human being')],
        learned: [
          { kanjiId: 'k-person', completedAt: NOW },
          // 学び終えたばかりの字。これを含む候補語は1つも無い
          { kanjiId: 'k-flower', completedAt: NOW },
        ],
        slot: 'lesson',
        focusKanjiId: 'k-flower',
      })
    );

    expect(item?.surface).toBe('人間');
  });

  it('focusKanjiId は slot=review では効かない(復習は記憶から引き出させる枠)', () => {
    const item = pickQuizItem(
      input({
        words: [
          word('w1', 'k-person', '人間', 'human being'),
          word('w2', 'k-fire', '花火', 'fireworks'),
        ],
        learned: [
          { kanjiId: 'k-person', completedAt: YESTERDAY },
          { kanjiId: 'k-fire', completedAt: NOW },
          { kanjiId: 'k-flower', completedAt: NOW },
        ],
        slot: 'review',
        focusKanjiId: 'k-fire',
      })
    );

    // 今日学んだ `火` ではなく、前に学んだ `人` の語が出る
    expect(item?.surface).toBe('人間');
  });

  it('slot=review は、既習字を今日より前に学んでいる語を優先する', () => {
    const item = pickQuizItem(
      input({
        words: [
          word('w1', 'k-person', '人間', 'human being'),
          word('w2', 'k-fire', '花火', 'fireworks'),
        ],
        learned: [
          { kanjiId: 'k-person', completedAt: YESTERDAY },
          { kanjiId: 'k-fire', completedAt: NOW },
          { kanjiId: 'k-flower', completedAt: NOW },
        ],
        slot: 'review',
      })
    );

    expect(item?.surface).toBe('人間');
  });

  it('優先条件に合う語が無ければ、寄せずに候補から返す(空にしない)', () => {
    // 今日学んだ字しか無いのに slot=review。**null ではなく1問返す**
    const item = pickQuizItem(
      input({
        words: [word('w1', 'k-person', '人間', 'human being')],
        learned: [{ kanjiId: 'k-person', completedAt: NOW }],
        slot: 'review',
      })
    );

    expect(item?.surface).toBe('人間');
  });

  it('候補が無ければ null を返す', () => {
    expect(pickQuizItem(input({ words: [] }))).toBeNull();
  });

  it('rng を固定すると同じ入力から同じ語が返る', () => {
    const words = [
      word('w1', 'k-person', '人間', 'human being'),
      word('w2', 'k-fire', '花火', 'fireworks'),
      word('w3', 'k-flower', '花見', 'flower viewing'),
    ];
    const learned = [
      { kanjiId: 'k-person', completedAt: YESTERDAY },
      { kanjiId: 'k-fire', completedAt: YESTERDAY },
      { kanjiId: 'k-flower', completedAt: YESTERDAY },
    ];

    const first = pickQuizItem(input({ words, learned, rng: seeded(7) }));
    const second = pickQuizItem(input({ words, learned, rng: seeded(7) }));

    expect(first?.surface).toBe(second?.surface);
  });
});
