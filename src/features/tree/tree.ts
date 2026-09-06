/**
 * 漢字の樹の「葉 / つぼみ」をユーザー状態から導く純粋ロジック(要件定義書 4.5)。
 *
 * **このファイルは `@/db` を import しない。** `@/db/client` は import しただけで
 * SQLite を開くため(`@/features/srs/lessons` と同じ理由)。
 *
 * 見るのは `lesson_events`(どの回を学び終えたか)だけ。**`review_events` は読まない。**
 * 樹は「出会ったかどうか」の可視化であって成績ではない。復習で間違えても葉は落ちない。
 */

import type { KanjiEntry, ReadingType, Word } from '@/content/types';

/** `@/db` の `LessonEvent` がそのまま渡せる形。DB の型に依存しないための再定義 */
export interface CompletedLesson {
  sentenceId: string;
  /** 第2段階専用の回は新出漢字が無いので null */
  kanjiId: string | null;
}

/** 葉 = 出会い済み(色つき) / つぼみ = 未出会い(灰色) */
export type LeafState = 'leaf' | 'bud';

export interface TreeLeaf {
  wordId: string;
  surface: string;
  kana: string;
  meaning: string;
  /** 枝の色を決める。訓 = 緑 / 音 = 青 */
  readingType: ReadingType;
  state: LeafState;
}

export interface KanjiTree {
  kanji: KanjiEntry;
  /** `words` の入力順を保つ。並べ替えはレイアウト側(`layoutTree`)の仕事 */
  leaves: TreeLeaf[];
  encounteredCount: number;
  totalCount: number;
}

export interface BuildKanjiTreeInput {
  kanji: KanjiEntry;
  /** この字の語だけでも、全語(`listWords()`)でもよい。`kanjiId` で絞る */
  words: Word[];
  lessons: CompletedLesson[];
}

/**
 * 1字ぶんの樹を組む。
 *
 * 判定規則はひとつ: **語の `encounteredInSentenceId` の回を学び終えていれば葉、
 * そうでなければつぼみ。** `null`(コンテンツ上まだどこにも出ない語)は常につぼみ。
 */
export function buildKanjiTree({ kanji, words, lessons }: BuildKanjiTreeInput): KanjiTree {
  const completed = completedSentenceIds(lessons);
  const leaves = words
    .filter((word) => word.kanjiId === kanji.id)
    .map((word) => toLeaf(word, completed));

  return {
    kanji,
    leaves,
    encounteredCount: leaves.filter((leaf) => leaf.state === 'leaf').length,
    totalCount: leaves.length,
  };
}

export interface TreeSummary {
  encounteredCount: number;
  totalCount: number;
}

export interface TreeIndex {
  /** 学習済み(導入回を終えた)字だけ。入力の順序(= 学習順)を保つ */
  met: KanjiEntry[];
  /** `met` の各字のバッジ用。キーは漢字 ID */
  summaries: Map<string, TreeSummary>;
}

export interface BuildTreeIndexInput {
  kanji: KanjiEntry[];
  words: Word[];
  lessons: CompletedLesson[];
}

/**
 * 一覧グリッドの入力を組む。
 *
 * 並べるのは**学習済みの字だけ**。ロックされた章の字は学びようがないので、
 * 課金判定を書かずに課金境界と一致する(docs/plans/kanji-tree.md 確認点2)。
 * 「学習済み」は `kanjiId` を持つ `lesson_events` があること。第2段階専用の回
 * (`kanjiId: null`)は字を導入しないので数えない。
 */
export function buildTreeIndex({ kanji, words, lessons }: BuildTreeIndexInput): TreeIndex {
  const metIds = new Set<string>();
  for (const lesson of lessons) {
    if (lesson.kanjiId !== null) {
      metIds.add(lesson.kanjiId);
    }
  }

  const completed = completedSentenceIds(lessons);
  const summaries = new Map<string, TreeSummary>();
  const met: KanjiEntry[] = [];

  for (const entry of kanji) {
    if (!metIds.has(entry.id)) {
      continue;
    }

    let encounteredCount = 0;
    let totalCount = 0;
    for (const word of words) {
      if (word.kanjiId !== entry.id) {
        continue;
      }
      totalCount += 1;
      if (toLeaf(word, completed).state === 'leaf') {
        encounteredCount += 1;
      }
    }

    met.push(entry);
    summaries.set(entry.id, { encounteredCount, totalCount });
  }

  return { met, summaries };
}

function completedSentenceIds(lessons: CompletedLesson[]): Set<string> {
  return new Set(lessons.map((lesson) => lesson.sentenceId));
}

function toLeaf(word: Word, completed: Set<string>): TreeLeaf {
  const encountered =
    word.encounteredInSentenceId !== null && completed.has(word.encounteredInSentenceId);

  return {
    wordId: word.id,
    surface: word.surface,
    kana: word.kana,
    meaning: word.meaning,
    readingType: word.readingType,
    state: encountered ? 'leaf' : 'bud',
  };
}
