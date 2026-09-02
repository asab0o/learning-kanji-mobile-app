import { addLocalDays, isSameLocalDay, startOfLocalDay } from '@/features/srs/day';

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

describe('addLocalDays', () => {
  it('0日を足すとその日の午前0時になる', () => {
    expect(addLocalDays(at(2026, 9, 2, 14, 30), 0)).toBe(at(2026, 9, 2));
  });

  it('1日足すと翌日の午前0時になる', () => {
    expect(addLocalDays(at(2026, 9, 2, 23, 59), 1)).toBe(at(2026, 9, 3));
  });

  it('月をまたぐ(2月28日 + 1日 → 3月1日。2026年は閏年ではない)', () => {
    expect(addLocalDays(at(2026, 2, 28, 10, 0), 1)).toBe(at(2026, 3, 1));
  });

  it('年をまたぐ(12月31日 + 1日 → 翌年1月1日)', () => {
    expect(addLocalDays(at(2026, 12, 31, 10, 0), 1)).toBe(at(2027, 1, 1));
  });

  it('30日足しても月をまたいで正しい日になる', () => {
    expect(addLocalDays(at(2026, 9, 2), 30)).toBe(at(2026, 10, 2));
  });
});
