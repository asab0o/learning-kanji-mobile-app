import type { KanjiEntry } from '@/content/types';
import { buildMeaningChoices, MEANING_CHOICE_COUNT } from '@/features/srs/choices';

const kanji = (id: string, meaning: string, order = 1): KanjiEntry => ({
  id,
  character: '一',
  meaning,
  order,
  chapter: 1,
  illustrationKey: id,
  readings: [{ kana: 'いち', romaji: 'ichi', type: 'kun' }],
  readingIntroduction: 'kun-first',
});

const NOUNS = [
  kanji('n1', 'person', 1),
  kanji('n2', 'mountain', 2),
  kanji('n3', 'river', 3),
  kanji('n4', 'sky', 4),
];

const VERBS = [
  kanji('v1', 'to eat', 5),
  kanji('v2', 'to walk', 6),
  kanji('v3', 'to read', 7),
  kanji('v4', 'to write', 8),
];

/** 決定的にするための擬似乱数。並びを固定したいだけなので品質は問わない */
const seeded = (seed: number): (() => number) => {
  let value = seed;

  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;

    return value / 2147483648;
  };
};

describe('buildMeaningChoices', () => {
  it('4件を返し、正解の意味がちょうど1件だけ入る', () => {
    const target = NOUNS[0];
    const choices = buildMeaningChoices({ target, pool: [...NOUNS, ...VERBS], rng: seeded(1) });

    expect(choices).toHaveLength(MEANING_CHOICE_COUNT);
    expect(choices.filter((choice) => choice === target.meaning)).toHaveLength(1);
  });

  it('正解の字自身は、プールに別の意味で入っていても誤答に混ざらない', () => {
    const target = NOUNS[0];
    // 同じ id で意味だけ違うエントリ。id による除外が効いていないと誤答に現れる
    const pool = [{ ...target, meaning: 'something else' }, ...NOUNS.slice(1), ...VERBS];
    const choices = buildMeaningChoices({ target, pool, rng: seeded(2) });

    expect(choices).not.toContain('something else');
    expect(new Set(choices).size).toBe(choices.length);
  });

  it('対象が動詞なら、誤答もすべて動詞になる(形をそろえる)', () => {
    const target = VERBS[0];
    const choices = buildMeaningChoices({ target, pool: [...NOUNS, ...VERBS], rng: seeded(3) });

    expect(choices.every((choice) => choice.startsWith('to '))).toBe(true);
  });

  it('同じ形が足りなければ別の形から補う', () => {
    const target = VERBS[0];
    const choices = buildMeaningChoices({ target, pool: [VERBS[1], ...NOUNS], rng: seeded(4) });

    expect(choices).toHaveLength(MEANING_CHOICE_COUNT);
    expect(choices).toContain('to eat');
    expect(choices).toContain('to walk');
  });

  it('意味が重複する字がプールにあっても、選択肢は重複しない', () => {
    const target = NOUNS[0];
    const pool = [kanji('dup', 'mountain', 9), ...NOUNS];
    const choices = buildMeaningChoices({ target, pool, rng: seeded(5) });

    expect(new Set(choices).size).toBe(choices.length);
  });

  it('プールが足りないときは例外を投げず、届いたぶんだけ返す', () => {
    const target = NOUNS[0];
    const choices = buildMeaningChoices({ target, pool: [NOUNS[1]], rng: seeded(6) });

    expect(choices).toHaveLength(2);
    expect(choices).toContain(target.meaning);
  });

  it('rng を固定すると出力が決定的になる', () => {
    const target = NOUNS[0];
    const args = { target, pool: [...NOUNS, ...VERBS] };

    expect(buildMeaningChoices({ ...args, rng: seeded(7) })).toEqual(
      buildMeaningChoices({ ...args, rng: seeded(7) })
    );
  });

  it('正解が常に先頭に来るわけではない', () => {
    const target = NOUNS[0];
    const positions = new Set<number>();

    for (let seed = 1; seed <= 40; seed += 1) {
      const choices = buildMeaningChoices({
        target,
        pool: [...NOUNS, ...VERBS],
        rng: seeded(seed),
      });
      positions.add(choices.indexOf(target.meaning));
    }

    expect(positions.size).toBeGreaterThan(1);
  });
});
