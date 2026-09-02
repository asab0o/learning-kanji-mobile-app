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

/**
 * n 日後のローカル日の午前0時。
 *
 * **`timestamp + days * 86400000` にしない。** 夏時間のある地域(UIが英語である以上、
 * 学習者の多くは北米・欧州にいる)では、切り替えを跨いだ日の長さが23時間または25時間になり、
 * ミリ秒を足すと境界が1時間ずれて「次に出る日」が1日ずれる。
 * `Date` に日付を渡すと桁上がりを処理してくれるので、月末・年末も自然に跨ぐ。
 */
export function addLocalDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);

  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}
