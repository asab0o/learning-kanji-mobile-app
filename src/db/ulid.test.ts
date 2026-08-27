import { createUlidFactory, ULID_LENGTH } from '@/db/ulid';

// `@/db/id` は expo-crypto(ネイティブモジュール)を読むので、ここからは import しない。
// テストの対象はあくまで乱数源と時刻を注入した純粋なファクトリ。

/** Crockford Base32。I・L・O・U を含まない */
const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]+$/;

/** 呼ばれるたびに 0,1,2... と埋まった配列を返す決定的な乱数源 */
function countingRandomBytes(): (byteCount: number) => Uint8Array {
  let counter = 0;
  return (byteCount) => {
    const bytes = new Uint8Array(byteCount);
    bytes[byteCount - 1] = counter % 256;
    counter += 1;
    return bytes;
  };
}

function fixedRandomBytes(fill: number): (byteCount: number) => Uint8Array {
  return (byteCount) => new Uint8Array(byteCount).fill(fill);
}

describe('createUlidFactory', () => {
  it('26文字・Crockford Base32のみ・重複なしの ID を1000件返す', () => {
    let calls = 0;
    const newUlid = createUlidFactory({
      // 3件ごとに 1ms 進める。同一ミリ秒の連番と時刻またぎを両方通す
      now: () => 1_700_000_000_000 + Math.floor(calls++ / 3),
      randomBytes: countingRandomBytes(),
    });

    const ids = Array.from({ length: 1000 }, () => newUlid());

    expect(new Set(ids).size).toBe(1000);
    for (const id of ids) {
      expect(id).toHaveLength(ULID_LENGTH);
      expect(id).toHaveLength(26);
      expect(id).toMatch(CROCKFORD);
    }
  });

  it('同じミリ秒で連続生成すると文字列比較で狭義単調増加する', () => {
    const newUlid = createUlidFactory({
      now: () => 1_700_000_000_000,
      randomBytes: fixedRandomBytes(0),
    });

    const ids = Array.from({ length: 50 }, () => newUlid());

    for (let i = 1; i < ids.length; i += 1) {
      expect(ids[i] > ids[i - 1]).toBe(true);
    }
  });

  it('1ms 進むと前の ID より文字列比較で大きくなる', () => {
    let clock = 1_700_000_000_000;
    const newUlid = createUlidFactory({
      now: () => clock,
      // 時刻が進んだときは乱数が引き直される。乱数を最小にしても
      // 時刻部だけで大小が決まることを見る
      randomBytes: fixedRandomBytes(0),
    });

    const first = newUlid();
    clock += 1;
    const second = newUlid();

    expect(second > first).toBe(true);
    expect(second.slice(0, 10)).not.toBe(first.slice(0, 10));
  });

  it('同じ時刻・同じ乱数源なら決定的に同じ ID を返す', () => {
    const sources = () => ({
      now: () => 1_700_000_000_000,
      randomBytes: fixedRandomBytes(0xab),
    });

    expect(createUlidFactory(sources())()).toBe(createUlidFactory(sources())());
  });

  it('時刻部が時刻を、乱数部が乱数を符号化している', () => {
    const newUlid = createUlidFactory({
      now: () => 0,
      randomBytes: fixedRandomBytes(0),
    });

    // 時刻 0・乱数 0 は全ビットが 0 なので、Crockford Base32 では '0' が26個になる
    expect(newUlid()).toBe('0'.repeat(26));
  });

  it('乱数源が指定バイト数を返さなければ落とす', () => {
    const newUlid = createUlidFactory({
      now: () => 1_700_000_000_000,
      randomBytes: () => new Uint8Array(4),
    });

    expect(newUlid).toThrow(/10 バイト/);
  });

  it('時刻が整数でなければ落とす', () => {
    const newUlid = createUlidFactory({
      now: () => 1_700_000_000_000.5,
      randomBytes: fixedRandomBytes(0),
    });

    expect(newUlid).toThrow(/時刻が不正/);
  });
});
