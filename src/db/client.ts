import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

/**
 * アプリで唯一の DB 接続。
 *
 * `openDatabaseSync` は同期に開くので、画面側で「接続待ち」の状態を持たずに済む。
 * 待つ必要があるのはマイグレーションとシードの方で、それは `@/db/use-database` が扱う。
 *
 * `drizzle()` に `{ schema }` を渡していないのは、リレーショナルクエリ API
 * (`db.query.kanji.findMany()`)を使わないため。使う予定ができたら渡す。
 *
 * このファイルはネイティブモジュールを読むため、テストからは import しない。
 */
const client = openDatabaseSync('kanji.db');

export const db = drizzle(client);

export type Database = typeof db;
