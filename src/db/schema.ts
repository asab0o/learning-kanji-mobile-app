/**
 * SQLite のスキーマ定義。設計の根拠は docs/data-model.md。
 *
 * このファイルの最重要の約束は **コンテンツとユーザー状態をテーブルレベルで分ける**
 * こと(絶対規則4)。下のセクション境界を越えて列を足さないこと。
 *
 * 外部キー制約を意図的に一切張っていない。コンテンツ系はアプリ更新のたびに
 * DELETE + INSERT で丸ごと入れ替わる一方、`review_events` は過去のコンテンツの ID を
 * 参照したまま残るのが正しい挙動であり、FK を張ると再シードが失敗するか、
 * ユーザー状態が CASCADE で消える。コンテンツ側の参照整合性は
 * `pnpm run validate:content` が担保する。
 *
 * 変更したら `pnpm run db:generate`。生成物は手で編集しない(絶対規則6)。
 */

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * 全テーブル共通の列(絶対規則3)。UNIX ミリ秒。
 *
 * `$defaultFn` ではなく呼び出し側で `Date.now()` を入れる方針にしていない理由は
 * 特にない。ここで既定値を持たせておくと入れ忘れが構造的に起きなくなるため
 * こちらにしている。
 */
const timestamps = {
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Date.now()),
};

// ─────────────────────────────────────────────────────────
// コンテンツ(アプリに同梱・読み取り専用・将来も同期不要)
// 再シードで丸ごと入れ替わる。ユーザーの学習成果はここに入れない。
// ─────────────────────────────────────────────────────────

export const kanji = sqliteTable(
  'kanji',
  {
    id: text('id').primaryKey(),
    /** 漢字1字 */
    character: text('character').notNull(),
    /** 英語の意味 */
    meaning: text('meaning').notNull(),
    /**
     * 学習順。`order` は SQL の予約語なので列名を `order_index` にしている。
     * アプリ側の型(`KanjiEntry.order`)とは `@/db/mappers` で対応させる。
     */
    orderIndex: integer('order_index').notNull(),
    chapter: integer('chapter').notNull(),
    illustrationKey: text('illustration_key').notNull(),
    /**
     * `Reading[]` の JSON。表に分けていないのは、常に漢字1件と一緒に丸ごと読む値で、
     * SQL で読みだけを検索する用途が要件に無いため(docs/plans/db-foundation.md)。
     * 検索したくなったら `kanji_readings` 表を足すマイグレーションを後から積む。
     */
    readings: text('readings').notNull(),
    readingIntroduction: text('reading_introduction', {
      enum: ['kun-first', 'on-only'],
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('kanji_character_unique').on(table.character),
    index('kanji_order_index').on(table.orderIndex),
  ]
);

export const words = sqliteTable(
  'words',
  {
    id: text('id').primaryKey(),
    kanjiId: text('kanji_id').notNull(),
    /** 表記(例: 歩道) */
    surface: text('surface').notNull(),
    kana: text('kana').notNull(),
    meaning: text('meaning').notNull(),
    /** 枝の色を決める(訓=緑 / 音=青) */
    readingType: text('reading_type', { enum: ['kun', 'on'] }).notNull(),
    /** null なら未出会い = 灰色のつぼみ(要件定義書 4.5) */
    encounteredInSentenceId: text('encountered_in_sentence_id'),
    ...timestamps,
  },
  (table) => [index('words_kanji_id_index').on(table.kanjiId)]
);

export const sentences = sqliteTable(
  'sentences',
  {
    id: text('id').primaryKey(),
    chapter: integer('chapter').notNull(),
    orderIndex: integer('order_index').notNull(),
    /** シーン名(玄関、台所 など) */
    scene: text('scene').notNull(),
    /** 第2段階専用の特別回のみ null */
    newKanjiId: text('new_kanji_id'),
    /** `Reencounter[]` の JSON。理由は kanji.readings と同じ */
    reencounters: text('reencounters').notNull(),
    /** 第1章のみ true。課金境界と章の切れ目を一致させる(要件定義書 7章) */
    isFree: integer('is_free', { mode: 'boolean' }).notNull(),
    ...timestamps,
  },
  (table) => [index('sentences_order_index').on(table.orderIndex)]
);

export const sentenceLines = sqliteTable(
  'sentence_lines',
  {
    /** コンテンツ側の `Line` は id を持たないので、シード時に採番する */
    id: text('id').primaryKey(),
    sentenceId: text('sentence_id').notNull(),
    /** 会話文の中での並び。0 始まり */
    lineIndex: integer('line_index').notNull(),
    speaker: text('speaker', { enum: ['mia', 'grandma', 'sora'] }).notNull(),
    /** segments を連結したものと一致する(検証は content 側の checkLineSegments) */
    japanese: text('japanese').notNull(),
    /**
     * `LineSegment[]` の JSON。理由は kanji.readings と同じ(docs/plans/line-segments.md)。
     *
     * 既定値 `'[]'` は**マイグレーションのため**に付けている。SQLite は行が入っている表に
     * 既定値なしの NOT NULL 列を追加できず(`Cannot add a NOT NULL column with default
     * value NULL`)、0001 が適用できない端末が出るため。
     * シードは常に値を明示的に入れるので、この既定値が実際に使われる経路は無い
     * (`toSentenceLineRow` の往復テストが入れ忘れを捕まえる)。
     */
    segments: text('segments').notNull().default('[]'),
    romaji: text('romaji').notNull(),
    english: text('english').notNull(),
    ...timestamps,
  },
  (table) => [index('sentence_lines_sentence_id_index').on(table.sentenceId, table.lineIndex)]
);

/**
 * どの版のコンテンツを流し込んだかの記録。常に1行だけ。
 *
 * 端末ローカルの作業記録であってユーザーの学習成果ではないため、
 * コンテンツ側に置いている(同期対象にしない)。
 */
export const contentMeta = sqliteTable('content_meta', {
  id: text('id').primaryKey(),
  /** `@/content/fingerprint` の値 */
  fingerprint: text('fingerprint').notNull(),
  seededAt: integer('seeded_at').notNull(),
  ...timestamps,
});

// ─────────────────────────────────────────────────────────
// ユーザー状態(端末で生成される・将来のクラウド同期対象)
// 再シードで消してはいけない。
// ─────────────────────────────────────────────────────────

/**
 * 「その回を学び終えた」ことの記録。**INSERT のみ**(`review_events` と同じ扱い)。
 *
 * `review_events` に `correct` を入れて代用していない。あれは結果が2値の復習ログで
 * 「導入した」を表せず、混ぜるとステージ計算が最初から1段ずれる。
 *
 * `sentence_id` に UNIQUE を張っていないのは、これがフラグではなく履歴だから。
 * 同じ回を読み直したときに制約違反で落ちるより、追記が積まれるほうがログの意図に合う。
 * 二重計上は書き込み側(既存記録があれば INSERT しない)と
 * 読み出し側(文ごとに最も古い1件だけを採る)の2段で防ぐ。
 */
export const lessonEvents = sqliteTable(
  'lesson_events',
  {
    id: text('id').primaryKey(),
    sentenceId: text('sentence_id').notNull(),
    /** 第2段階専用の回(要件定義書 4.1-5)は新出漢字が無いので null */
    kanjiId: text('kanji_id'),
    completedAt: integer('completed_at').notNull(),
    ...timestamps,
  },
  (table) => [
    index('lesson_events_sentence_id_index').on(table.sentenceId),
    index('lesson_events_completed_at_index').on(table.completedAt),
  ]
);

/**
 * SRS の唯一の真実。**INSERT のみ。UPDATE / DELETE 禁止**(絶対規則5)。
 *
 * 現在のステージはこのログを時系列に畳み込んで求める。1行上書き型にしないのは、
 * 将来2台目の端末が入ってもイベントを時系列にマージするだけで正しい状態になるため。
 *
 * **`sentence_id` は 0003 で削除した。** 復習の単位は漢字1字で、出題は意味の4択のみ。
 * 会話文を再表示しないので、復習イベントに入れるべき文が存在しない(ADR-0007)。
 * 「どの文で出会った字か」は `lesson_events` が持っている。
 */
export const reviewEvents = sqliteTable(
  'review_events',
  {
    id: text('id').primaryKey(),
    kanjiId: text('kanji_id').notNull(),
    result: text('result', { enum: ['correct', 'incorrect'] }).notNull(),
    reviewedAt: integer('reviewed_at').notNull(),
    ...timestamps,
  },
  (table) => [index('review_events_kanji_id_index').on(table.kanjiId, table.reviewedAt)]
);

/**
 * 推測クイズ「読めるかな?」の記録。**SRS とは完全に別系統**(絶対規則10)。
 *
 * 記録する理由は「同じ問題を続けて出さない」ためだけで、成績評価には使わない。
 * クイズ項目のデータ型がまだ `@/content/types` に無いため、`itemKey` は
 * 出題を一意に指す不透明な文字列として持つ。クイズ実装時に列が増える可能性がある。
 */
export const quizAttempts = sqliteTable('quiz_attempts', {
  id: text('id').primaryKey(),
  itemKey: text('item_key').notNull(),
  result: text('result', { enum: ['correct', 'incorrect'] }).notNull(),
  attemptedAt: integer('attempted_at').notNull(),
  ...timestamps,
});

/**
 * 「読みが変わった」演出カードを出した漢字(要件定義書 4.6)。
 *
 * 同じ漢字につき1回だけ出すため(絶対規則11)、`kanji_id` に UNIQUE を張る。
 */
export const revealShown = sqliteTable(
  'reveal_shown',
  {
    id: text('id').primaryKey(),
    kanjiId: text('kanji_id').notNull(),
    shownAt: integer('shown_at').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('reveal_shown_kanji_id_unique').on(table.kanjiId)]
);

/**
 * 設定。常に1行だけ。ここだけは UPDATE してよい(イベントログにする意味がないため)。
 */
export const userSettings = sqliteTable('user_settings', {
  id: text('id').primaryKey(),
  /** 既定 OFF(要件定義書 5.2) */
  romajiEnabled: integer('romaji_enabled', { mode: 'boolean' }).notNull(),
  themeId: text('theme_id').notNull(),
  ...timestamps,
});
