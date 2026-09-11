/**
 * 会話文1行のセグメント列を、描画する形(行 → 折り返さない塊 → セグメント)に畳む。
 *
 * **折り返しはセグメント境界でしか起きない**(`furigana.tsx`)。位置は吹き出しの幅で決まるので、
 * 放っておくと「`」` だけが次の行の頭に落ちる」「作者が切りたい所と違う所で切れる」が起きる。
 * ここで2つの制御を入れる(docs/plans/line-break-control.md)。
 *
 * - **禁則(自動)**: 行頭に来てはいけない字で始まるセグメントを、直前と同じ塊に入れて離さない
 * - **強制改行(明示)**: `breakAfter` の付いたセグメントで行を閉じる
 *
 * React を import しない。**折り返しの判断はすべてここに集める**(CLAUDE.md のコード規約)。
 */

import { startsWithForbiddenLineStart } from '@/content/segments';
import type { FuriganaSegment } from '@/features/reading/furigana';

/**
 * 折り返さない最小単位。
 *
 * 禁則で連結したセグメントがここに並ぶ。ほとんどの塊は要素1つ。
 */
export type NoBreakCluster = FuriganaSegment[];

/** `breakAfter` で区切った1行。**中身はさらに幅で折り返す** */
export type LayoutLine = NoBreakCluster[];

/**
 * 禁則で連結する塊の上限(文字数)。
 *
 * 上限が無いと `」と「` のように前後どちらにもくっつきたい並びが連鎖し、
 * 塊が吹き出しの幅(全角で約11.7字)を超えて**本文がはみ出す**。
 * 上限に当たったら連結しない。結果は連結しなかった場合と同じなので、目視で気づける。
 */
const MAX_CLUSTER_LENGTH = 8;

/** セグメント列を、行と「折り返さない塊」に畳む */
export function toLayoutLines(segments: FuriganaSegment[]): LayoutLine[] {
  const lines: LayoutLine[] = [];
  let line: LayoutLine = [];
  let cluster: NoBreakCluster = [];

  const closeCluster = (): void => {
    if (cluster.length > 0) {
      line.push(cluster);
      cluster = [];
    }
  };
  const closeLine = (): void => {
    closeCluster();
    if (line.length > 0) {
      lines.push(line);
      line = [];
    }
  };

  segments.forEach((segment, index) => {
    // 直前のセグメントに breakAfter があると、この時点で cluster は空。
    // **作者が明示した改行を禁則より優先する**ので、連結の判定はそこを見なくてよい。
    const clusterLength = cluster.reduce((total, s) => total + [...s.text].length, 0);
    const joinable =
      cluster.length > 0 &&
      startsWithForbiddenLineStart(segment.text) &&
      clusterLength + [...segment.text].length <= MAX_CLUSTER_LENGTH;

    if (!joinable) {
      closeCluster();
    }
    cluster.push(segment);

    if (segment.breakAfter === true) {
      // 最後のセグメントの breakAfter は空の行を作らない(closeLine が空行を捨てる)。
      closeLine();
    } else if (index === segments.length - 1) {
      closeLine();
    }
  });

  return lines;
}

/** その行に★(種明かしカードの合図)を持つセグメントがあるか */
export function lineHasBadge(line: LayoutLine): boolean {
  return line.some((cluster) => cluster.some((segment) => segment.badge === true));
}
