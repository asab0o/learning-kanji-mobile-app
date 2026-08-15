/**
 * 学習コンテンツの実データ。
 *
 * 制作方針は docs/content-spec.md、追加手順は /add-content スキルを参照。
 * ここを直接編集する前に `src/content/CLAUDE.md` を読むこと。
 */

import type { ContentSet, KanjiEntry, Sentence, Word } from './types';

/** 対象漢字50字(要件定義書 5.4)。別紙『対象漢字リスト.md』から取り込む */
export const kanji: KanjiEntry[] = [];

/** 漢字の樹の葉になる単語 */
export const words: Word[] = [];

/** 会話文58文(第1章10 / 第2章15 / 第3章16 / 第4章17) */
export const sentences: Sentence[] = [];

export const contentSet: ContentSet = { kanji, words, sentences };
