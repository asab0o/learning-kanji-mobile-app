import { contentFingerprint } from '@/content/fingerprint';
import type { ContentSet, KanjiEntry, Sentence, Word } from '@/content/types';

// 実データに依存しないフィクスチャを使う(src/content/CLAUDE.md)。
// 実データが増えるたびに壊れるテストにしないため。

function kanjiFixture(overrides: Partial<KanjiEntry> = {}): KanjiEntry {
  return {
    id: '01J0000000000000000000KANJ',
    character: '空',
    meaning: 'sky, empty',
    order: 1,
    chapter: 1,
    illustrationKey: 'sora',
    readings: [{ kana: 'そら', romaji: 'sora', type: 'kun' }],
    readingIntroduction: 'kun-first',
    ...overrides,
  };
}

function wordFixture(overrides: Partial<Word> = {}): Word {
  return {
    id: '01J0000000000000000000WORD',
    kanjiId: '01J0000000000000000000KANJ',
    surface: '空気',
    kana: 'くうき',
    meaning: 'air',
    readingType: 'on',
    encounteredInSentenceId: null,
    ...overrides,
  };
}

function sentenceFixture(overrides: Partial<Sentence> = {}): Sentence {
  return {
    id: '01J0000000000000000000SENT',
    chapter: 1,
    order: 1,
    scene: '玄関',
    lines: [
      {
        speaker: 'grandma',
        japanese: 'いらっしゃい。',
        segments: [{ text: 'いらっしゃい。' }],
        romaji: 'Irasshai.',
        english: 'Welcome.',
      },
    ],
    newKanjiId: '01J0000000000000000000KANJ',
    reencounters: [],
    isFree: true,
    ...overrides,
  };
}

function contentFixture(overrides: Partial<ContentSet> = {}): ContentSet {
  return {
    kanji: [kanjiFixture()],
    words: [wordFixture()],
    sentences: [sentenceFixture()],
    ...overrides,
  };
}

describe('contentFingerprint', () => {
  it('同一内容には同じ値を返す', () => {
    expect(contentFingerprint(contentFixture())).toBe(contentFingerprint(contentFixture()));
  });

  it('会話文を1文字変えると別の値になる', () => {
    const before = contentFingerprint(contentFixture());
    const after = contentFingerprint(
      contentFixture({
        sentences: [
          sentenceFixture({
            lines: [{ ...sentenceFixture().lines[0], english: 'Welcome!' }],
          }),
        ],
      })
    );

    expect(after).not.toBe(before);
  });

  it('漢字の読みを足すと別の値になる', () => {
    const before = contentFingerprint(contentFixture());
    const after = contentFingerprint(
      contentFixture({
        kanji: [
          kanjiFixture({
            readings: [
              { kana: 'そら', romaji: 'sora', type: 'kun' },
              { kana: 'くう', romaji: 'kū', type: 'on' },
            ],
          }),
        ],
      })
    );

    expect(after).not.toBe(before);
  });

  it('空のコンテンツでも値を返す', () => {
    const empty = contentFingerprint({ kanji: [], words: [], sentences: [] });

    expect(typeof empty).toBe('string');
    expect(empty.length).toBeGreaterThan(0);
    expect(empty).not.toBe(contentFingerprint(contentFixture()));
  });

  it('件数が先頭に入るので、指紋を見ればデータ量が分かる', () => {
    expect(contentFingerprint({ kanji: [], words: [], sentences: [] })).toMatch(/^0\.0\.0-/);
    expect(contentFingerprint(contentFixture())).toMatch(/^1\.1\.1-/);
  });

  it('キーの並び順が違っても内容が同じなら同じ値になる', () => {
    // オブジェクトリテラルの記述順を入れ替えただけの同内容
    const reordered: ContentSet = {
      sentences: [sentenceFixture()],
      kanji: [kanjiFixture()],
      words: [wordFixture()],
    };

    expect(contentFingerprint(reordered)).toBe(contentFingerprint(contentFixture()));
  });
});
