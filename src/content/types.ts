/**
 * 学習コンテンツの型定義。
 *
 * 契約の説明は docs/content-spec.md、方針の根拠は docs/content-decisions.md を参照。
 */

export type CharacterId = 'mia' | 'grandma' | 'sora';

/** 訓読み(緑の枝) / 音読み(青の枝) — 漢字の樹の色分けに直結する */
export type ReadingType = 'kun' | 'on';

export type ChapterNumber = 1 | 2 | 3 | 4;

/**
 * その漢字をどう導入するか。
 *
 * - `kun-first`: 訓読みで導入し、後の回で音読みに出会わせる(通常)
 * - `on-only`: 最初から音読みで教える。訓読みがほぼ使われない字(天・本・語)。
 *   訓→音の段階を踏まないため、第2段階の対象にはできない
 *
 * docs/content-decisions.md 4章「例外扱いの字(3字)」
 */
export type ReadingIntroduction = 'kun-first' | 'on-only';

export interface Reading {
  /** ひらがな表記の読み */
  kana: string;
  /** ヘボン式ローマ字 */
  romaji: string;
  type: ReadingType;
}

export interface KanjiEntry {
  /** ULID */
  id: string;
  /** 漢字1字 */
  character: string;
  /** 英語の意味。UI に出るため英語 */
  meaning: string;
  /** 学習順。1 から始まる連番 */
  order: number;
  chapter: ChapterNumber;
  /** assets/kanji/<illustrationKey>.png */
  illustrationKey: string;
  readings: Reading[];
  readingIntroduction: ReadingIntroduction;
}

/** 漢字の樹の葉。1 つの漢字から伸びる単語 */
export interface Word {
  /** ULID */
  id: string;
  /** どの漢字の樹に属するか */
  kanjiId: string;
  /** 表記(例: 歩道) */
  surface: string;
  /** ひらがな読み */
  kana: string;
  /** 英語の意味 */
  meaning: string;
  /** この語での読みの種類。枝の色を決める */
  readingType: ReadingType;
  /**
   * この語に出会った会話文の ID。
   * null なら未出会い = 灰色のつぼみとして表示される(要件定義書 4.5)
   */
  encounteredInSentenceId: string | null;
}

/**
 * ふりがな付き本文の最小単位。折り返しはこの境界でしか起きない
 * (`src/features/reading/furigana.tsx` の制約)。
 *
 * `src/content/` 側に置いているのは、`FuriganaSegment`(features 側の型)を
 * ここが import すると `content → features` という逆方向の依存になるため
 * (docs/architecture.md のレイヤ順は `app → features → {db, content}`)。
 * `FuriganaSegment` はこちらを取り込んで `focus` を足す形にする。
 */
export interface LineSegment {
  /** 表示する本文(japanese の一部) */
  text: string;
  /** text 全体に乗る読み。かなだけのセグメントでは省略する */
  reading?: string;
}

export interface Line {
  speaker: CharacterId;
  /**
   * 日本語本文。`segments` を連結したものと一致すること
   * (`checkLineSegments` が機械的に検証する)。
   */
  japanese: string;
  /** ふりがな付き本文。画面はこれをそのまま FuriganaText に渡す */
  segments: LineSegment[];
  /** ヘボン式ローマ字 */
  romaji: string;
  english: string;
}

/**
 * 段階的再登場(要件定義書 4.1-5)。最大の差別化要素。
 *
 * 1 つの語につき 1 件。第2段階は 1 語で複数字の読みが同時に変わることがあるため
 * (時間 = 時 + 間 / 大学 = 大 + 学 / 外国 = 外 + 国)、`kanjiIds` は配列。
 */
export interface Reencounter {
  /** 提示する語(例: "時間")。演出カードと漢字の樹に出る */
  word: string;
  /** 1 = 同じ単語・同じ読みで別シーン / 2 = 別の単語・別の読み */
  stage: 1 | 2;
  /** この語で読みが変わる漢字。第2段階では複数字のことがある */
  kanjiIds: string[];
}

/** 会話文 1 本 */
export interface Sentence {
  /** ULID */
  id: string;
  chapter: ChapterNumber;
  /** 通し順。1 から始まる連番 */
  order: number;
  /** シーン名(カフェ、台所 など) */
  scene: string;
  lines: Line[];
  /**
   * この回で導入する新出漢字。1 文につき最大 1 字。
   * 第2段階専用の特別回のみ null(docs/content-decisions.md 1章)
   */
  newKanjiId: string | null;
  /** 既習漢字の再登場。無ければ空配列 */
  reencounters: Reencounter[];
  /** 第 1 章のみ true。課金境界と章の切れ目を一致させる(要件定義書 7章) */
  isFree: boolean;
}

/** 検証対象のコンテンツ一式 */
export interface ContentSet {
  kanji: KanjiEntry[];
  words: Word[];
  sentences: Sentence[];
}
