import { useMemo } from 'react';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import { contentSet } from '@/content';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { seedContentIfChanged } from '@/db/seed';

/**
 * DB が使える状態になるまでの段階。
 *
 * `migrating` の間は画面を出さない。マイグレーション前のテーブルに
 * クエリを投げると落ちるため。
 */
export type DatabaseStatus = 'migrating' | 'ready' | 'error';

export interface DatabaseState {
  status: DatabaseStatus;
  error: Error | null;
}

/**
 * マイグレーションとシードをまとめて面倒を見る。
 *
 * シードを `useEffect` + `setState` ではなく `useMemo` で回しているのは、
 * `seedContentIfChanged` が同期関数で、結果を次のレンダリングまで待つ必要がないため。
 * 効果の中で setState すると、その1フレーム分だけ「マイグレーション済みだが
 * シード前」という中間状態が描かれてしまう。
 *
 * `useMemo` の中で副作用を起こすのは行儀が良くないが、シードは指紋が同じなら
 * 何もしない冪等な処理なので、React が memo を捨てて再実行しても害がない。
 */
export function useDatabase(): DatabaseState {
  const { success, error: migrationError } = useMigrations(db, migrations);

  const seed = useMemo<{ done: boolean; error: Error | null }>(() => {
    if (!success) {
      return { done: false, error: null };
    }

    try {
      seedContentIfChanged(db, contentSet);
      return { done: true, error: null };
    } catch (caught) {
      // シードに失敗したまま画面を出すと、空の学習画面が出て原因が分からなくなる。
      // 起動を止めて理由を見せる方がまだ直しやすい。
      return { done: false, error: caught instanceof Error ? caught : new Error(String(caught)) };
    }
  }, [success]);

  const error = migrationError ?? seed.error;

  if (error) {
    return { status: 'error', error };
  }

  return { status: seed.done ? 'ready' : 'migrating', error: null };
}
