/**
 * `LineSegment[]` から平文を導出する純粋関数。
 *
 * 平坦なふりがな文字列(旧 `Line.furigana`)は持たなくなったので、
 * 必要な箇所はここを通して都度復元する(docs/plans/line-segments.md)。
 */

import type { LineSegment } from '@/content/types';

/** セグメントの `text` を連結した本文。`Line.japanese` と一致するはずの値 */
export function segmentsToText(segments: LineSegment[]): string {
  return segments.map((segment) => segment.text).join('');
}

/** セグメントの読みだけを連結した、ひらがな全文相当の文字列 */
export function segmentsToKana(segments: LineSegment[]): string {
  return segments.map((segment) => segment.reading ?? segment.text).join('');
}

/**
 * 行頭に置いてはいけない文字(禁則処理の対象)。
 *
 * 折り返しはセグメント境界でしか起きないので、**これで始まるセグメントを
 * 直前のセグメントと同じ「折り返さない塊」に入れる**ことで行頭に落ちるのを防ぐ
 * (docs/plans/line-break-control.md)。
 *
 * 句読点・閉じ括弧・長音符・小書きかなだけに絞ってある。開き括弧(行末に残ってはいけない字)は
 * 入れない。前後どちらにもくっつきたいセグメントが連鎖して塊が吹き出し幅を超え、
 * 本文がはみ出すため。
 */
const FORBIDDEN_LINE_START = new Set([
  ...'、。，．・？！…',
  ...'）］｝」』】〕》〉',
  ...'ー',
  ...'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ',
]);

/** そのセグメントが、行頭に来てはいけない文字で始まるか */
export function startsWithForbiddenLineStart(text: string): boolean {
  const first = [...text][0];
  return first !== undefined && FORBIDDEN_LINE_START.has(first);
}
