import type { Word } from '@/content/types';
import { buildQuizChoices, QUIZ_CHOICE_COUNT } from '@/features/quiz/distractors';
import type { QuizItem } from '@/features/quiz/types';

const word = (id: string, surface: string, meaning: string): Word => ({
  id,
  kanjiId: `k-${id}`,
  surface,
  kana: 'よみ',
  meaning,
  readingType: 'kun',
  encounteredInSentenceId: null,
});

/** 正解。花火 = 花 + 火 */
const TARGET: QuizItem = {
  itemKey: 'word:花火',
  surface: '花火',
  kana: 'はなび',
  meaning: 'fireworks',
  components: [
    { character: '花', meaning: 'flower', learned: true },
    { character: '火', meaning: 'fire', learned: true },
  ],
};

/** 共有1字の語(花 か 火 のどちらか一方だけを含む) */
const SHARING = [
  word('s1', '火山', 'volcano'),
  word('s2', '花見', 'flower viewing'),
  word('s3', '火曜日', 'Tuesday'),
];

/** 共有0字の語 */
const UNRELATED = [
  word('u1', '人間', 'human being'),
  word('u2', '大雨', 'heavy rain'),
  word('u3', '読書', 'reading'),
];

const seeded = (seed: number): (() => number) => {
  let value = seed;

  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;

    return value / 2147483648;
  };
};

describe('buildQuizChoices', () => {
  it('4件を返し、正解の意味がちょうど1件だけ入る', () => {
    const choices = buildQuizChoices({
      target: TARGET,
      words: [...SHARING, ...UNRELATED],
      rng: seeded(1),
    });

    expect(choices).toHaveLength(QUIZ_CHOICE_COUNT);
    expect(choices.filter((choice) => choice === TARGET.meaning)).toHaveLength(1);
    expect(new Set(choices).size).toBe(choices.length);
  });

  it('共有1字の語が3件あるとき、誤答はすべてその意味になる(要件4.4)', () => {
    const choices = buildQuizChoices({
      target: TARGET,
      words: [...SHARING, ...UNRELATED],
      rng: seeded(2),
    });

    const distractors = choices.filter((choice) => choice !== TARGET.meaning);

    expect(distractors.sort()).toEqual(SHARING.map((entry) => entry.meaning).sort());
  });

  it('共有1字の語が2件しかないときは、共有0字の語で4件まで埋める', () => {
    // 実データの `新聞` に当たるケース
    const choices = buildQuizChoices({
      target: TARGET,
      words: [SHARING[0], SHARING[1], ...UNRELATED],
      rng: seeded(3),
    });

    expect(choices).toHaveLength(QUIZ_CHOICE_COUNT);
    expect(choices).toContain('volcano');
    expect(choices).toContain('flower viewing');
  });

  it('構成字を2字とも共有する語は誤答に使わない(答えが2つあるように見える)', () => {
    const choices = buildQuizChoices({
      target: TARGET,
      words: [word('x1', '火花', 'spark'), ...SHARING, ...UNRELATED],
      rng: seeded(4),
    });

    expect(choices).not.toContain('spark');
  });

  it('正解と同じ意味を持つ別の語は誤答に入らない', () => {
    const choices = buildQuizChoices({
      target: TARGET,
      words: [word('x2', '花火大会', 'fireworks'), ...SHARING],
      rng: seeded(5),
    });

    expect(choices.filter((choice) => choice === 'fireworks')).toHaveLength(1);
  });

  it('正解語そのものの行(別の樹の重複行)は誤答に入らない', () => {
    const duplicate = word('dup', '花火', 'fireworks');
    const choices = buildQuizChoices({
      target: TARGET,
      words: [duplicate, ...SHARING],
      rng: seeded(6),
    });

    expect(choices.filter((choice) => choice === 'fireworks')).toHaveLength(1);
  });

  it('プールが足りなければ、届いたぶんだけ返す', () => {
    const choices = buildQuizChoices({ target: TARGET, words: [SHARING[0]], rng: seeded(7) });

    expect(choices).toEqual(expect.arrayContaining(['fireworks', 'volcano']));
    expect(choices).toHaveLength(2);
  });

  it('rng を固定すると並びが決定的になる', () => {
    const words = [...SHARING, ...UNRELATED];
    const first = buildQuizChoices({ target: TARGET, words, rng: seeded(9) });
    const second = buildQuizChoices({ target: TARGET, words, rng: seeded(9) });

    expect(first).toEqual(second);
  });
});
