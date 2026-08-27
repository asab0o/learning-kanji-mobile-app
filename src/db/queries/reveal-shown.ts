/**
 * 「読みが変わった」演出カード(要件定義書 4.6 ステップ2)を出した記録。
 *
 * 同じ漢字につき1回だけ出す(絶対規則11)。2回目以降はハイライトのみにする判断を
 * `hasRevealShown()` で行う。
 */

import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { newId } from '@/db/id';
import { revealShown } from '@/db/schema';

/** この漢字の演出カードを既に出したか */
export function hasRevealShown(kanjiId: string): boolean {
  return db.select().from(revealShown).where(eq(revealShown.kanjiId, kanjiId)).get() !== undefined;
}

/**
 * 演出カードを出したことを記録する。
 *
 * 既に記録があれば何もしない。`kanji_id` に UNIQUE を張っているので、
 * ここで二重に入れようとすると落ちる。演出は「出したかどうか」だけが意味を持ち、
 * 何回出したかは記録しない。
 */
export function markRevealShown(kanjiId: string): void {
  if (hasRevealShown(kanjiId)) {
    return;
  }

  const now = Date.now();

  db.insert(revealShown)
    .values({
      id: newId(),
      kanjiId,
      shownAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}
