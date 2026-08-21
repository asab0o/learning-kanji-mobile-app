import type { Theme } from '@/theme/tokens';

/** 読みの文字サイズ。本文に対する比率。 */
const READING_SIZE_RATIO = 0.5;

/** 読みの文字と本文の間に空ける量(pt)。 */
const READING_LEADING = 3;

export type FuriganaMetrics = {
  /**
   * 読みの文字サイズ。
   * これは `fontSize` に渡す値なので**端末の文字サイズ倍率を掛けない**。
   * RN が allowFontScaling で自動的に拡大するため、掛けると二重に効く。
   */
  readingSize: number;
  /** 読みの行に確保する高さ(倍率適用済み)。 */
  readingHeight: number;
  /** 本文の行の高さ(倍率適用済み)。 */
  baseLineHeight: number;
};

/**
 * ふりがな付き1行の内訳を出す。
 *
 * 読みの行と本文の行を足すと、テーマが決めた日本語1行の高さ(`jaLineHeight`)になる。
 * 読みが無いセグメントでも読みの行の高さは確保するので、同じ行のセグメントの高さが揃う。
 *
 * `fontScale` は端末の文字サイズ設定の倍率。`fontSize` は RN が勝手に拡大するのに
 * **`lineHeight` と固定 `height` は拡大しない**ため、ここで掛けておかないと
 * 文字サイズを上げた端末で読みが箱からはみ出して切れる。
 *
 * `baseLineHeight` を `jaSize` で下限クランプしているのは、行の高さが文字サイズを
 * 下回ると本文が潰れるため。ただしこれは保険で、テーマ側が最初から条件を満たしているべき
 * (`furigana-metrics.test.ts` が全テーマについて検査している)。
 */
export function furiganaMetrics(type: Theme['type'], fontScale: number): FuriganaMetrics {
  const readingSize = Math.round(type.jaSize * READING_SIZE_RATIO);
  const readingHeight = (readingSize + READING_LEADING) * fontScale;
  const baseLineHeight = Math.max(
    type.jaSize * fontScale,
    type.jaLineHeight * fontScale - readingHeight
  );

  return { readingSize, readingHeight, baseLineHeight };
}
