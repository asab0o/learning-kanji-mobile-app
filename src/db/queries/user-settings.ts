/**
 * 設定の読み書き。常に1行だけ持つ。
 *
 * ここはユーザー状態の中で唯一 UPDATE してよい表。設定は履歴に意味がなく、
 * イベントログにしても畳み込む価値が無いため。
 */

import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { newId } from '@/db/id';
import type { UserSettings } from '@/db/mappers';
import { toUserSettings } from '@/db/mappers';
import { userSettings } from '@/db/schema';
import { DEFAULT_THEME_ID } from '@/theme/themes';

export type { UserSettings };

/**
 * 設定を返す。まだ無ければ既定値の行を作って返す。
 *
 * 「無ければ作る」をここに閉じ込めることで、呼ぶ側が null を扱わずに済む。
 */
export function getUserSettings(): UserSettings {
  const existing = db.select().from(userSettings).limit(1).get();

  if (existing) {
    return toUserSettings(existing);
  }

  const now = Date.now();
  const created = {
    id: newId(),
    // ローマ字は既定 OFF(要件定義書 5.2)
    romajiEnabled: false,
    themeId: DEFAULT_THEME_ID,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(userSettings).values(created).run();

  return toUserSettings(created);
}

/** 変更したい項目だけ渡す。行が無ければ既定値の行を作ってから更新する */
export function updateUserSettings(changes: Partial<UserSettings>): UserSettings {
  const current = getUserSettings();
  const next: UserSettings = { ...current, ...changes };
  const row = db.select().from(userSettings).limit(1).get();

  if (row) {
    db.update(userSettings)
      .set({
        romajiEnabled: next.romajiEnabled,
        themeId: next.themeId,
        updatedAt: Date.now(),
      })
      .where(eq(userSettings.id, row.id))
      .run();
  }

  return next;
}
