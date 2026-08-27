/**
 * DB の行 ↔ アプリの型(`@/content/types`)の変換。
 *
 * ここを通すことで、DB の行型が UI に漏れないようにする(src/db/CLAUDE.md)。
 * 列名の差(`order` ↔ `order_index`)と JSON 列の出し入れもここで吸収する。
 *
 * このファイルは DB 接続(`@/db/client`)を import しない。純粋な変換だけを置く。
 */

import type {
  ChapterNumber,
  KanjiEntry,
  Line,
  Reading,
  ReadingType,
  Reencounter,
  Sentence,
  Word,
} from '@/content/types';
import type { kanji, sentenceLines, sentences, userSettings, words } from '@/db/schema';
import { DEFAULT_THEME_ID, themes } from '@/theme/themes';
import type { ThemeId } from '@/theme/tokens';

type KanjiRow = typeof kanji.$inferSelect;
type WordRow = typeof words.$inferSelect;
type SentenceRow = typeof sentences.$inferSelect;
type SentenceLineRow = typeof sentenceLines.$inferSelect;
type UserSettingsRow = typeof userSettings.$inferSelect;

/** どの行のどの列で壊れたかを必ず言う。DB の中身は目で見えないため */
class RowError extends Error {
  constructor(table: string, id: string, column: string, detail: string) {
    super(`${table}(${id}).${column}: ${detail}`);
    this.name = 'RowError';
  }
}

// ── コンテンツ: 行 → アプリの型 ───────────────────────────

export function toKanjiEntry(row: KanjiRow): KanjiEntry {
  return {
    id: row.id,
    character: row.character,
    meaning: row.meaning,
    order: row.orderIndex,
    chapter: toChapter('kanji', row.id, row.chapter),
    illustrationKey: row.illustrationKey,
    readings: parseReadings(row.id, row.readings),
    readingIntroduction: row.readingIntroduction,
  };
}

export function toWord(row: WordRow): Word {
  return {
    id: row.id,
    kanjiId: row.kanjiId,
    surface: row.surface,
    kana: row.kana,
    meaning: row.meaning,
    readingType: row.readingType,
    encounteredInSentenceId: row.encounteredInSentenceId,
  };
}

/** 会話文は本体と行が別テーブルなので、行を渡して組み立てる */
export function toSentence(row: SentenceRow, lineRows: SentenceLineRow[]): Sentence {
  return {
    id: row.id,
    chapter: toChapter('sentences', row.id, row.chapter),
    order: row.orderIndex,
    scene: row.scene,
    lines: [...lineRows].sort((a, b) => a.lineIndex - b.lineIndex).map(toLine),
    newKanjiId: row.newKanjiId,
    reencounters: parseReencounters(row.id, row.reencounters),
    isFree: row.isFree,
  };
}

export function toLine(row: SentenceLineRow): Line {
  return {
    speaker: row.speaker,
    japanese: row.japanese,
    furigana: row.furigana,
    romaji: row.romaji,
    english: row.english,
  };
}

// ── コンテンツ: アプリの型 → 行 ───────────────────────────

export function toKanjiRow(entry: KanjiEntry, now: number): typeof kanji.$inferInsert {
  return {
    id: entry.id,
    character: entry.character,
    meaning: entry.meaning,
    orderIndex: entry.order,
    chapter: entry.chapter,
    illustrationKey: entry.illustrationKey,
    readings: JSON.stringify(entry.readings),
    readingIntroduction: entry.readingIntroduction,
    createdAt: now,
    updatedAt: now,
  };
}

export function toWordRow(word: Word, now: number): typeof words.$inferInsert {
  return {
    id: word.id,
    kanjiId: word.kanjiId,
    surface: word.surface,
    kana: word.kana,
    meaning: word.meaning,
    readingType: word.readingType,
    encounteredInSentenceId: word.encounteredInSentenceId,
    createdAt: now,
    updatedAt: now,
  };
}

export function toSentenceRow(sentence: Sentence, now: number): typeof sentences.$inferInsert {
  return {
    id: sentence.id,
    chapter: sentence.chapter,
    orderIndex: sentence.order,
    scene: sentence.scene,
    newKanjiId: sentence.newKanjiId,
    reencounters: JSON.stringify(sentence.reencounters),
    isFree: sentence.isFree,
    createdAt: now,
    updatedAt: now,
  };
}

export function toSentenceLineRow(
  params: { id: string; sentenceId: string; lineIndex: number; line: Line },
  now: number
): typeof sentenceLines.$inferInsert {
  return {
    id: params.id,
    sentenceId: params.sentenceId,
    lineIndex: params.lineIndex,
    speaker: params.line.speaker,
    japanese: params.line.japanese,
    furigana: params.line.furigana,
    romaji: params.line.romaji,
    english: params.line.english,
    createdAt: now,
    updatedAt: now,
  };
}

// ── ユーザー状態 ─────────────────────────────────────────

export interface UserSettings {
  romajiEnabled: boolean;
  themeId: ThemeId;
}

export function toUserSettings(row: UserSettingsRow): UserSettings {
  return {
    romajiEnabled: row.romajiEnabled,
    themeId: parseThemeId(row.themeId),
  };
}

/**
 * 保存されているテーマ ID を検証する。
 *
 * テーマは後から増減する予定があり(要件定義書 5.3 のノーマル / 東京の夜景)、
 * 増やしたテーマを選んだ端末でアプリを巻き戻すと、定義に無い ID が残る。
 * 設定が壊れているだけで起動できなくなるのは割に合わないので、既定値に倒す。
 */
export function parseThemeId(value: string): ThemeId {
  // `in` はプロトタイプチェーンも辿るので 'toString' などが通ってしまう。
  // 壊れた値を弾くための関数がテーマ以外を返したら本末転倒なので自前の鍵だけ見る。
  return Object.hasOwn(themes, value) ? (value as ThemeId) : DEFAULT_THEME_ID;
}

// ── JSON 列と数値の検証 ──────────────────────────────────

function toChapter(table: string, id: string, value: number): ChapterNumber {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  throw new RowError(table, id, 'chapter', `1〜4 ではありません (${value})`);
}

function parseJson(table: string, id: string, column: string, raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new RowError(table, id, column, `JSON として読めません (${truncate(raw)})`);
  }
}

function parseReadings(id: string, raw: string): Reading[] {
  const parsed = parseJson('kanji', id, 'readings', raw);

  if (!Array.isArray(parsed)) {
    throw new RowError('kanji', id, 'readings', '配列ではありません');
  }

  return parsed.map((item, index) => {
    if (!isReading(item)) {
      throw new RowError('kanji', id, `readings[${index}]`, `Reading の形ではありません`);
    }
    return item;
  });
}

function parseReencounters(id: string, raw: string): Reencounter[] {
  const parsed = parseJson('sentences', id, 'reencounters', raw);

  if (!Array.isArray(parsed)) {
    throw new RowError('sentences', id, 'reencounters', '配列ではありません');
  }

  return parsed.map((item, index) => {
    if (!isReencounter(item)) {
      throw new RowError(
        'sentences',
        id,
        `reencounters[${index}]`,
        'Reencounter の形ではありません'
      );
    }
    return item;
  });
}

function isReading(value: unknown): value is Reading {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.kana === 'string' && typeof value.romaji === 'string' && isReadingType(value.type)
  );
}

function isReencounter(value: unknown): value is Reencounter {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.word === 'string' &&
    (value.stage === 1 || value.stage === 2) &&
    Array.isArray(value.kanjiIds) &&
    value.kanjiIds.every((kanjiId) => typeof kanjiId === 'string')
  );
}

function isReadingType(value: unknown): value is ReadingType {
  return value === 'kun' || value === 'on';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function truncate(raw: string): string {
  return raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
}
