/**
 * コンテンツのセグメントに、いまハイライトする字の印(`focus`)を付ける。
 *
 * `focus` をコンテンツデータに持たせない理由は要件定義書 4.6 にある。
 * 同じ会話文でも、出会った瞬間(ステップ1)は新出漢字を光らせ、第2段階の演出では
 * 読みが変わる字(「大学」なら `大` と `学` の2字)を光らせる。対象が場面で変わるので、
 * データに焼くとどちらか一方の場面でしか正しく描けない。
 */

import type { LineSegment } from '@/content/types';
import type { FuriganaSegment } from '@/features/reading/furigana';

/**
 * 対象の漢字を含むセグメントに `focus` を付けて返す。
 *
 * 対象が空なら1つも付けない(ハイライト無しで素の文を見せたい場面がある)。
 * 同じ字が複数のセグメントに現れる場合は、そのすべてに付く。
 *
 * `badgeIndex` を渡すと、**その位置のセグメントにだけ** `badge` を付ける。
 * ★は「押すとカードが出る場所」を1つ指すものなので、`focus` と違って複数に付けない
 * (どこを押せばよいか分からなくなる)。範囲外の添字は無視する。
 *
 * 元の配列は書き換えない。呼び出し側が持っているコンテンツを汚さないため。
 */
export function toFuriganaSegments(
  segments: LineSegment[],
  focusCharacters: readonly string[],
  badgeIndex?: number
): FuriganaSegment[] {
  return segments.map((segment, index) => {
    const next: FuriganaSegment = { ...segment };

    // focus: false / badge: false を置かない。既定値と同じ意味なので、
    // 付けないほうが差分を読むときに「光る所」だけが目に入る。
    if (focusCharacters.some((character) => segment.text.includes(character))) {
      next.focus = true;
    }
    if (index === badgeIndex) {
      next.badge = true;
    }

    return next;
  });
}
