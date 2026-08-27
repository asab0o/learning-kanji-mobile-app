/**
 * コンテンツの読み出し。読み取り専用で、ここから書き込みはしない
 * (コンテンツを書くのは `@/db/seed` だけ)。
 */

import { asc, eq, inArray } from 'drizzle-orm';

import type { KanjiEntry, Sentence, Word } from '@/content/types';
import { db } from '@/db/client';
import { toKanjiEntry, toSentence, toWord } from '@/db/mappers';
import { kanji, sentenceLines, sentences, words } from '@/db/schema';

/** 学習順にすべての漢字を返す */
export function listKanji(): KanjiEntry[] {
  return db.select().from(kanji).orderBy(asc(kanji.orderIndex)).all().map(toKanjiEntry);
}

export function getKanji(id: string): KanjiEntry | null {
  const row = db.select().from(kanji).where(eq(kanji.id, id)).get();

  return row ? toKanjiEntry(row) : null;
}

/** 通し順にすべての会話文を返す。行もまとめて引く */
export function listSentences(): Sentence[] {
  const sentenceRows = db.select().from(sentences).orderBy(asc(sentences.orderIndex)).all();

  if (sentenceRows.length === 0) {
    return [];
  }

  // 会話文ごとに行を引くと 58 回のクエリになるので、まとめて引いて JS 側で束ねる
  const lineRows = db
    .select()
    .from(sentenceLines)
    .where(
      inArray(
        sentenceLines.sentenceId,
        sentenceRows.map((row) => row.id)
      )
    )
    .all();

  const linesBySentenceId = new Map<string, typeof lineRows>();
  for (const line of lineRows) {
    const bucket = linesBySentenceId.get(line.sentenceId);
    if (bucket) {
      bucket.push(line);
    } else {
      linesBySentenceId.set(line.sentenceId, [line]);
    }
  }

  return sentenceRows.map((row) => toSentence(row, linesBySentenceId.get(row.id) ?? []));
}

export function getSentence(id: string): Sentence | null {
  const row = db.select().from(sentences).where(eq(sentences.id, id)).get();

  if (!row) {
    return null;
  }

  const lineRows = db
    .select()
    .from(sentenceLines)
    .where(eq(sentenceLines.sentenceId, id))
    .orderBy(asc(sentenceLines.lineIndex))
    .all();

  return toSentence(row, lineRows);
}

/** 漢字の樹の葉。未出会いの語(`encounteredInSentenceId === null`)も含めて返す */
export function listWordsByKanji(kanjiId: string): Word[] {
  return db.select().from(words).where(eq(words.kanjiId, kanjiId)).all().map(toWord);
}
