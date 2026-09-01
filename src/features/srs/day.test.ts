import { isSameLocalDay, startOfLocalDay } from '@/features/srs/day';

/**
 * テストもローカル時刻で組み立てる。`Date.UTC` やタイムスタンプ直書きを使うと、
 * CI と手元のタイムゾーンが違うだけで落ちるテストになる。
 */
const at = (year: number, month: number, day: number, hour = 0, minute = 0): number =>
  new Date(year, month - 1, day, hour, minute).getTime();

describe('startOfLocalDay', () => {
  it('同じ日の 00:00 と 23:59 が同じ値になる', () => {
    expect(startOfLocalDay(at(2026, 9, 2, 0, 0))).toBe(startOfLocalDay(at(2026, 9, 2, 23, 59)));
  });

  it('返る値がその日の午前0時そのものになる', () => {
    expect(startOfLocalDay(at(2026, 9, 2, 14, 30))).toBe(at(2026, 9, 2));
  });

  it('翌日は別の値になる', () => {
    expect(startOfLocalDay(at(2026, 9, 2, 23, 59))).not.toBe(startOfLocalDay(at(2026, 9, 3, 0, 0)));
  });

  it('月をまたいでも日の境界で切れる', () => {
    expect(startOfLocalDay(at(2026, 8, 31, 23, 59))).not.toBe(
      startOfLocalDay(at(2026, 9, 1, 0, 1))
    );
  });
});

describe('isSameLocalDay', () => {
  it('同じ日なら true', () => {
    expect(isSameLocalDay(at(2026, 9, 2, 1, 0), at(2026, 9, 2, 22, 0))).toBe(true);
  });

  it('1分でも日をまたぐと false', () => {
    expect(isSameLocalDay(at(2026, 9, 2, 23, 59), at(2026, 9, 3, 0, 0))).toBe(false);
  });
});
