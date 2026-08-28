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
