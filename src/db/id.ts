import { getRandomBytes } from 'expo-crypto';

import { createUlidFactory } from '@/db/ulid';

/**
 * 主キー用の ULID を1つ返す(絶対規則2)。
 *
 * `expo-crypto` の `getRandomBytes` は名前に反して同期関数なので、
 * ID 採番のために await を伝播させずに済む。
 *
 * このファイルはネイティブモジュールを読むため、テストからは import しない。
 * 生成ロジックのテストは `@/db/ulid` 側で行う。
 */
export const newId = createUlidFactory({
  now: Date.now,
  randomBytes: getRandomBytes,
});
