import type { KanjiEntry, Sentence, Word } from '@/content/types';
import {
  parseThemeId,
  toKanjiEntry,
  toKanjiRow,
  toSentence,
  toSentenceLineRow,
  toSentenceRow,
  toUserSettings,
  toWord,
  toWordRow,
} from '@/db/mappers';
import type { kanji, sentenceLines, sentences, userSettings, words } from '@/db/schema';
import { DEFAULT_THEME_ID } from '@/theme/themes';

// `@/db/client` を import しない。テストから DB 接続に到達させないため。

const NOW = 1_700_000_000_000;

/**
 * INSERT 用の行を SELECT 用の行に均す。
 *
 * `$inferInsert` では NULL 可の列が省略可能(`| undefined`)になるため、
 * 往復テストではここで NULL に寄せてから読み戻す。
 */
function asSelectedWord(row: typeof words.$inferInsert): typeof words.$inferSelect {
  return {
    ...row,
    encounteredInSentenceId: row.encounteredInSentenceId ?? null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function asSelectedSentence(row: typeof sentences.$inferInsert): typeof sentences.$inferSelect {
  return {
    ...row,
    newKanjiId: row.newKanjiId ?? null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function asSelectedLine(row: typeof sentenceLines.$inferInsert): typeof sentenceLines.$inferSelect {
  return { ...row, createdAt: NOW, updatedAt: NOW };
}

function kanjiRow(overrides: Partial<typeof kanji.$inferSelect> = {}): typeof kanji.$inferSelect {
  return {
    id: '01J0000000000000000000KANJ',
    character: '空',
    meaning: 'sky, empty',
    orderIndex: 1,
    chapter: 1,
    illustrationKey: 'sora',
    readings: '[{"kana":"そら","romaji":"sora","type":"kun"}]',
    readingIntroduction: 'kun-first',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function wordRow(overrides: Partial<typeof words.$inferSelect> = {}): typeof words.$inferSelect {
  return {
    id: '01J0000000000000000000WORD',
    kanjiId: '01J0000000000000000000KANJ',
    surface: '空気',
    kana: 'くうき',
    meaning: 'air',
    readingType: 'on',
    encounteredInSentenceId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function sentenceRow(
  overrides: Partial<typeof sentences.$inferSelect> = {}
): typeof sentences.$inferSelect {
  return {
    id: '01J0000000000000000000SENT',
    chapter: 1,
    orderIndex: 1,
    scene: '玄関',
    newKanjiId: '01J0000000000000000000KANJ',
    reencounters: '[]',
    isFree: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function lineRow(
  overrides: Partial<typeof sentenceLines.$inferSelect> = {}
): typeof sentenceLines.$inferSelect {
  return {
    id: '01J0000000000000000000LIN0',
    sentenceId: '01J0000000000000000000SENT',
    lineIndex: 0,
    speaker: 'grandma',
    japanese: 'いらっしゃい。',
    furigana: 'いらっしゃい。',
    romaji: 'Irasshai.',
    english: 'Welcome.',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('toKanjiEntry', () => {
  it('readings の JSON を Reading[] に戻す', () => {
    const entry = toKanjiEntry(kanjiRow());

    expect(entry.readings).toHaveLength(1);
    expect(entry.readings[0]).toEqual({ kana: 'そら', romaji: 'sora', type: 'kun' });
  });

  it('order_index を order として返す', () => {
    expect(toKanjiEntry(kanjiRow({ orderIndex: 7 })).order).toBe(7);
  });

  it('readings が壊れた JSON なら列名を含むエラーで落ちる', () => {
    expect(() => toKanjiEntry(kanjiRow({ readings: '{' }))).toThrow(/readings/);
    expect(() => toKanjiEntry(kanjiRow({ readings: '{' }))).toThrow(/01J0000000000000000000KANJ/);
  });

  it('readings が配列でなければ落ちる', () => {
    expect(() => toKanjiEntry(kanjiRow({ readings: '{"kana":"そら"}' }))).toThrow(/readings/);
  });

  it('readings の要素が Reading の形でなければ位置を含むエラーで落ちる', () => {
    expect(() => toKanjiEntry(kanjiRow({ readings: '[{"kana":"そら","type":"kun"}]' }))).toThrow(
      /readings\[0\]/
    );
    expect(() =>
      toKanjiEntry(kanjiRow({ readings: '[{"kana":"そら","romaji":"sora","type":"x"}]' }))
    ).toThrow(/readings\[0\]/);
  });

  it('chapter が 1〜4 でなければ落ちる', () => {
    expect(() => toKanjiEntry(kanjiRow({ chapter: 5 }))).toThrow(/chapter/);
  });
});

describe('toWord', () => {
  it('encountered_in_sentence_id の NULL を null のまま保つ', () => {
    expect(toWord(wordRow()).encounteredInSentenceId).toBeNull();
  });

  it('出会い済みの語は会話文 ID を返す', () => {
    expect(
      toWord(wordRow({ encounteredInSentenceId: '01J0000000000000000000SENT' }))
        .encounteredInSentenceId
    ).toBe('01J0000000000000000000SENT');
  });
});

describe('toSentence', () => {
  it('行を line_index の順に並べ直す', () => {
    const sentence = toSentence(sentenceRow(), [
      lineRow({ id: 'b', lineIndex: 1, english: 'Second.' }),
      lineRow({ id: 'a', lineIndex: 0, english: 'First.' }),
    ]);

    expect(sentence.lines.map((line) => line.english)).toEqual(['First.', 'Second.']);
  });

  it('reencounters の JSON を Reencounter[] に戻す', () => {
    const sentence = toSentence(
      sentenceRow({
        reencounters: '[{"word":"空気","stage":2,"kanjiIds":["01J0000000000000000000KANJ"]}]',
      }),
      [lineRow()]
    );

    expect(sentence.reencounters).toEqual([
      { word: '空気', stage: 2, kanjiIds: ['01J0000000000000000000KANJ'] },
    ]);
  });

  it('reencounters が壊れていれば列名を含むエラーで落ちる', () => {
    expect(() => toSentence(sentenceRow({ reencounters: '{' }), [])).toThrow(/reencounters/);
    expect(() =>
      toSentence(sentenceRow({ reencounters: '[{"word":"空気","stage":3,"kanjiIds":[]}]' }), [])
    ).toThrow(/reencounters\[0\]/);
  });

  it('第2段階専用の回は newKanjiId が null のまま', () => {
    expect(toSentence(sentenceRow({ newKanjiId: null }), []).newKanjiId).toBeNull();
  });
});

describe('行への変換', () => {
  it('KanjiEntry → 行 → KanjiEntry で元に戻る', () => {
    const entry: KanjiEntry = {
      id: '01J0000000000000000000KANJ',
      character: '空',
      meaning: 'sky, empty',
      order: 1,
      chapter: 1,
      illustrationKey: 'sora',
      readings: [
        { kana: 'そら', romaji: 'sora', type: 'kun' },
        { kana: 'くう', romaji: 'kū', type: 'on' },
      ],
      readingIntroduction: 'kun-first',
    };

    const row = toKanjiRow(entry, NOW);

    expect(toKanjiEntry({ ...row, createdAt: NOW, updatedAt: NOW })).toEqual(entry);
  });

  it('Word → 行 → Word で元に戻る(null も保たれる)', () => {
    const word: Word = {
      id: '01J0000000000000000000WORD',
      kanjiId: '01J0000000000000000000KANJ',
      surface: '空気',
      kana: 'くうき',
      meaning: 'air',
      readingType: 'on',
      encounteredInSentenceId: null,
    };

    expect(toWord(asSelectedWord(toWordRow(word, NOW)))).toEqual(word);
  });

  it('Sentence → 行 → Sentence で元に戻る', () => {
    const sentence: Sentence = {
      id: '01J0000000000000000000SENT',
      chapter: 2,
      order: 12,
      scene: '台所',
      lines: [
        {
          speaker: 'mia',
          japanese: 'おはようございます。',
          furigana: 'おはようございます。',
          romaji: 'Ohayō gozaimasu.',
          english: 'Good morning.',
        },
        {
          speaker: 'sora',
          japanese: 'ごはん',
          furigana: 'ごはん',
          romaji: 'Gohan',
          english: 'Food.',
        },
      ],
      newKanjiId: null,
      reencounters: [{ word: '空気', stage: 2, kanjiIds: ['01J0000000000000000000KANJ'] }],
      isFree: false,
    };

    const row = toSentenceRow(sentence, NOW);
    const lineRows = sentence.lines.map((line, index) =>
      toSentenceLineRow(
        { id: `01J000000000000000000LIN${index}`, sentenceId: sentence.id, lineIndex: index, line },
        NOW
      )
    );

    const restored = toSentence(
      asSelectedSentence(row),
      // 行の順序が入れ替わっていても line_index で戻ることを同時に見る
      [...lineRows].reverse().map(asSelectedLine)
    );

    expect(restored).toEqual(sentence);
  });
});

describe('parseThemeId', () => {
  it('定義済みのテーマ ID はそのまま返す', () => {
    expect(parseThemeId('sakura')).toBe('sakura');
  });

  it('定義に無い ID は既定テーマに倒す', () => {
    expect(parseThemeId('tokyo-night')).toBe(DEFAULT_THEME_ID);
    expect(parseThemeId('')).toBe(DEFAULT_THEME_ID);
  });
});

describe('toUserSettings', () => {
  it('ローマ字の既定は OFF', () => {
    const row: typeof userSettings.$inferSelect = {
      id: '01J0000000000000000000SET0',
      romajiEnabled: false,
      themeId: 'sakura',
      createdAt: NOW,
      updatedAt: NOW,
    };

    expect(toUserSettings(row)).toEqual({ romajiEnabled: false, themeId: 'sakura' });
  });

  it('壊れたテーマ ID が入っていても既定に倒して読める', () => {
    const row: typeof userSettings.$inferSelect = {
      id: '01J0000000000000000000SET0',
      romajiEnabled: true,
      themeId: 'nonexistent',
      createdAt: NOW,
      updatedAt: NOW,
    };

    expect(toUserSettings(row)).toEqual({ romajiEnabled: true, themeId: DEFAULT_THEME_ID });
  });
});
