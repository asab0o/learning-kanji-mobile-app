/**
 * DB の公開 API。**画面はここだけを import する。**
 *
 * 生の Drizzle クエリを画面から呼ばない(src/db/CLAUDE.md)。
 * 新しいクエリが要るときは `@/db/queries/` に関数を足してここから公開する。
 */

export { useDatabase } from '@/db/use-database';
export type { DatabaseState, DatabaseStatus } from '@/db/use-database';

// コンテンツ(読み取り専用)
export {
  getKanji,
  getSentence,
  listKanji,
  listSentences,
  listWordsByKanji,
} from '@/db/queries/content';

// SRS のイベントログ。INSERT と SELECT だけを公開する(絶対規則5)
export { insertReviewEvent, listReviewEvents } from '@/db/queries/review-events';
export type { NewReviewEvent, ReviewEvent, ReviewResult } from '@/db/queries/review-events';

// 設定
export { getUserSettings, updateUserSettings } from '@/db/queries/user-settings';
export type { UserSettings } from '@/db/queries/user-settings';

// 読み変化の演出を出したかどうか(絶対規則11)
export { hasRevealShown, markRevealShown } from '@/db/queries/reveal-shown';

// 開発用
export { getContentFingerprint, getTableCounts } from '@/db/queries/diagnostics';
export type { TableCounts } from '@/db/queries/diagnostics';
