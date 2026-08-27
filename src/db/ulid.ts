/**
 * ULID の生成。
 *
 * 絶対規則2「主キーは ULID」を満たすための実装。
 * npm の `ulid` / `ulidx` を使わず自前で書いているのは、どちらも import 時に
 * `crypto.getRandomValues` の有無を検出する作りで、Hermes では
 * `react-native-get-random-values` の polyfill をグローバルに入れる前提になるため。
 * ULID は「48bit の時刻 + 80bit の乱数を Crockford Base32 で26文字」という短い仕様なので、
 * 乱数源と時刻を引数で受ける純粋関数として持つ方が、polyfill を入れるより副作用が小さく、
 * Jest でそのままテストできる(docs/architecture.md「純粋ロジックは React から切り離す」)。
 *
 * ネイティブの乱数を注入した実物は `@/db/id` の `newId()`。
 */

/** Crockford Base32。I・L・O・U を除いて誤読を避ける */
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_BITS = 5;

const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;
/** 80bit = 16文字 × 5bit */
const RANDOM_BYTE_COUNT = 10;

/** 48bit で表せる最大時刻(西暦 10889 年ごろ) */
const MAX_TIME = 2 ** 48 - 1;

/**
 * 乱数のバイト列。
 *
 * `Uint8Array` の型引数を明示しているのは、`expo-crypto` が返すのが
 * `Uint8Array<ArrayBufferLike>` で、`new Uint8Array()` が返すのが
 * `Uint8Array<ArrayBuffer>` と、TypeScript 6 では別物として扱われるため。
 */
type RandomBytes = Uint8Array<ArrayBufferLike>;

export interface UlidSources {
  /** UNIX ミリ秒を返す */
  now: () => number;
  /** 指定バイト数の乱数を返す */
  randomBytes: (byteCount: number) => RandomBytes;
}

/**
 * ULID を生成する関数を作る。
 *
 * 同じミリ秒に連続して呼ばれた場合は乱数部を +1 する(ULID 仕様の monotonic factory 相当)。
 * こうしないと同一ミリ秒内で生成した ID の文字列順が実際の生成順とずれ、
 * 「ID 順に並べれば挿入順」という前提が崩れる。
 *
 * 端末の時計が巻き戻った場合(`time < lastTime`)は巻き戻った時刻でそのまま採番する。
 * 単調性より「ID に入っている時刻が実際の時刻であること」を優先する。
 */
export function createUlidFactory({ now, randomBytes }: UlidSources): () => string {
  let lastTime = -1;
  let lastRandom: RandomBytes = new Uint8Array(RANDOM_BYTE_COUNT);

  return function newUlid(): string {
    const time = now();

    if (!Number.isInteger(time) || time < 0 || time > MAX_TIME) {
      throw new Error(`ULID: 時刻が不正です (${time})。0〜${MAX_TIME} の整数である必要があります`);
    }

    if (time === lastTime) {
      lastRandom = incrementBytes(lastRandom);
    } else {
      lastTime = time;
      lastRandom = takeRandomBytes(randomBytes);
    }

    return encodeTime(time) + encodeRandom(lastRandom);
  };
}

function takeRandomBytes(randomBytes: UlidSources['randomBytes']): RandomBytes {
  const bytes = randomBytes(RANDOM_BYTE_COUNT);

  if (bytes.length !== RANDOM_BYTE_COUNT) {
    throw new Error(
      `ULID: 乱数源が ${RANDOM_BYTE_COUNT} バイト返しませんでした (${bytes.length} バイト)`
    );
  }

  return bytes;
}

/** 48bit の時刻を 10 文字に符号化する */
function encodeTime(time: number): string {
  let remaining = time;
  let encoded = '';

  for (let i = 0; i < TIME_LENGTH; i += 1) {
    const digit = remaining % ENCODING.length;
    encoded = ENCODING[digit] + encoded;
    remaining = (remaining - digit) / ENCODING.length;
  }

  return encoded;
}

/** 80bit(10バイト)の乱数を 16 文字に符号化する。端数が出ない組み合わせ */
function encodeRandom(bytes: RandomBytes): string {
  let encoded = '';
  let accumulator = 0;
  let bits = 0;

  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;

    while (bits >= ENCODING_BITS) {
      bits -= ENCODING_BITS;
      encoded += ENCODING[(accumulator >>> bits) & 0x1f];
    }
  }

  return encoded;
}

/**
 * 80bit のビッグエンディアン整数として +1 する。
 *
 * 元の配列を書き換えないのは、呼び出し側が保持している値を
 * 気づかないうちに変えないため。
 */
function incrementBytes(bytes: RandomBytes): RandomBytes {
  const next = Uint8Array.from(bytes);

  for (let i = next.length - 1; i >= 0; i -= 1) {
    if (next[i] < 0xff) {
      next[i] += 1;
      return next;
    }
    next[i] = 0;
  }

  // 80bit すべてが 1 の状態から繰り上がった。同一ミリ秒に 2^80 回呼ばない限り起きない。
  // ここで黙って 0 に戻すと単調増加が破れるので、気づけるように落とす。
  throw new Error('ULID: 同一ミリ秒内で乱数部が上限に達しました');
}

/** テストと検証で使う。ULID は常にこの長さ */
export const ULID_LENGTH = TIME_LENGTH + RANDOM_LENGTH;
