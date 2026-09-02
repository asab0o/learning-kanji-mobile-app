/**
 * 「今日」の境界。
 *
 * **端末ローカルの午前0時**を境にする。UTC でも「最後の学習から24時間」でもないのは、
 * `Come back tomorrow.` が学習者にとって「寝て起きたら」を意味するから。
 * 24時間制にすると、昨日23時に学んだ人は今日の23時まで次に進めず、説明できない。
 *
 * サーバーを持たない構成(絶対規則9)なので端末の時計が正。時計を巻き戻せば
 * 上限は回避できるが、MVP では検出しない(docs/plans/srs-lessons.md)。
 */

/** その時刻が属するローカル日の午前0時(UNIX ミリ秒) */
export function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);

  // ローカルのメソッドだけで組み立てる。UTC のメソッドを混ぜると、
  // タイムゾーンによって境界が前後の日にずれる。
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** 2つの時刻が同じローカル日に属するか */
export function isSameLocalDay(a: number, b: number): boolean {
  return startOfLocalDay(a) === startOfLocalDay(b);
}
