/**
 * `src/content/` の静的データをコンテンツ系テーブルへ流し込む。
 *
 * **ユーザー状態テーブル(`review_events` / `quiz_attempts` / `reveal_shown` /
 * `user_settings`)には一切触れない**(絶対規則4)。ここを破ると、コンテンツを直すたびに
 * ユーザーの学習履歴が消える。
 */

import type { ContentSet } from '@/content/types';
import { contentFingerprint } from '@/content/fingerprint';
import type { Database } from '@/db/client';
import { newId } from '@/db/id';
import { toKanjiRow, toSentenceLineRow, toSentenceRow, toWordRow } from '@/db/mappers';
import { contentMeta, kanji, sentenceLines, sentences, words } from '@/db/schema';

/**
 * 1回の INSERT に載せる行数。
 *
 * SQLite の変数上限(既定 999)に対し、最も列の多い表でも 10 列なので
 * 50 行なら 500 変数で収まる。
 */
const CHUNK_SIZE = 50;

export interface SeedResult {
  /** 実際に入れ替えたか。指紋が同じなら false */
  seeded: boolean;
  fingerprint: string;
}

/**
 * コンテンツの指紋が前回と違うときだけ、コンテンツ系テーブルを入れ替える。
 *
 * 空のコンテンツ(`src/content/index.ts` が空配列のまま)でも成立する。
 * その場合は「0件で入れ替えた」という記録が残るだけで、2回目以降は走らない。
 */
export function seedContentIfChanged(database: Database, content: ContentSet): SeedResult {
  const fingerprint = contentFingerprint(content);
  const current = database.select().from(contentMeta).limit(1).all();

  if (current[0]?.fingerprint === fingerprint) {
    return { seeded: false, fingerprint };
  }

  const now = Date.now();

  database.transaction((tx) => {
    // 差分更新にしないのは、コンテンツが読み取り専用のマスタデータであり、
    // 「同梱されているものが全て」だから。消えた行が残り続ける方が危ない。
    tx.delete(sentenceLines).run();
    tx.delete(sentences).run();
    tx.delete(words).run();
    tx.delete(kanji).run();
    tx.delete(contentMeta).run();

    for (const chunk of chunked(content.kanji.map((entry) => toKanjiRow(entry, now)))) {
      tx.insert(kanji).values(chunk).run();
    }

    for (const chunk of chunked(content.words.map((word) => toWordRow(word, now)))) {
      tx.insert(words).values(chunk).run();
    }

    for (const chunk of chunked(
      content.sentences.map((sentence) => toSentenceRow(sentence, now))
    )) {
      tx.insert(sentences).values(chunk).run();
    }

    // `Line` は id を持たないので、ここで採番する(docs/plans/db-foundation.md)。
    // 行 ID はどのユーザー状態からも参照しないため、再シードで変わって構わない。
    const lineRows = content.sentences.flatMap((sentence) =>
      sentence.lines.map((line, lineIndex) =>
        toSentenceLineRow({ id: newId(), sentenceId: sentence.id, lineIndex, line }, now)
      )
    );

    for (const chunk of chunked(lineRows)) {
      tx.insert(sentenceLines).values(chunk).run();
    }

    tx.insert(contentMeta)
      .values({
        id: newId(),
        fingerprint,
        seededAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  return { seeded: true, fingerprint };
}

function chunked<T>(rows: T[]): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + CHUNK_SIZE));
  }

  return chunks;
}
