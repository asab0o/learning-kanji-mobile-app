import type { KanjiEntry, Sentence } from '@/content/types';
import { focusCharactersFor } from '@/features/reading/focus';

// 実データに依存しないフィクスチャを使う(src/content/CLAUDE.md)。
// 実データが増えるたびに壊れるテストにしないため。

const PERSON_ID = '01J0000000000000000000KAN1';
const BIG_ID = '01J0000000000000000000KAN2';

function kanjiFixture(overrides: Partial<KanjiEntry> = {}): KanjiEntry {
  return {
    id: PERSON_ID,
    character: '人',
    meaning: 'person',
    order: 1,
    chapter: 1,
    illustrationKey: 'person',
    readings: [{ kana: 'ひと', romaji: 'hito', type: 'kun' }],
    readingIntroduction: 'kun-first',
    ...overrides,
  };
}

function sentenceFixture(overrides: Partial<Sentence> = {}): Sentence {
  return {
    id: '01J0000000000000000000SEN1',
    chapter: 1,
    order: 1,
    scene: '玄関',
    lines: [
      {
        speaker: 'mia',
        japanese: 'この家は、何人ですか？',
        segments: [
          { text: 'この' },
          { text: '家', reading: 'いえ' },
          { text: 'は、' },
          { text: '何', reading: 'なん' },
          { text: '人', reading: 'にん' },
          { text: 'ですか？' },
        ],
        romaji: 'Kono ie wa, nannin desu ka?',
        english: 'How many people live in this house?',
      },
    ],
    newKanjiId: PERSON_ID,
    reencounters: [],
    isFree: true,
    ...overrides,
  };
}

const kanji = [kanjiFixture(), kanjiFixture({ id: BIG_ID, character: '大', order: 2 })];

describe('focusCharactersFor', () => {
  it('新出漢字の1字を返す', () => {
    expect(focusCharactersFor(sentenceFixture(), kanji)).toEqual(['人']);
  });

  it('newKanjiId が指す字だけを返す(他の既習字は含めない)', () => {
    expect(focusCharactersFor(sentenceFixture({ newKanjiId: BIG_ID }), kanji)).toEqual(['大']);
  });

  it('第2段階専用の回(newKanjiId が null)では空を返す', () => {
    const special = sentenceFixture({
      newKanjiId: null,
      reencounters: [{ word: '日曜日', stage: 2, kanjiIds: [PERSON_ID] }],
    });

    expect(focusCharactersFor(special, kanji)).toEqual([]);
  });

  it('newKanjiId に対応する漢字が無くても投げずに空を返す', () => {
    // コンテンツの入れ替え途中に起こりうる。ここで投げると画面ごと落ちる。
    const dangling = sentenceFixture({ newKanjiId: '01J0000000000000000000MISS' });

    expect(focusCharactersFor(dangling, kanji)).toEqual([]);
  });

  it('漢字一覧が空でも投げない', () => {
    expect(focusCharactersFor(sentenceFixture(), [])).toEqual([]);
  });
});
