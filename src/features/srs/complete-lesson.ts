/**
 * 学習の完了を追記する。
 *
 * `lessons.ts` から分けているのは、あちらを `@/db` に触れさせないため
 * (`@/db/client` は import しただけで SQLite を開く)。
 *
 * DB への書き込みの入口を srs に1つだけ置いておくと、
 * **`review_events` に書いていないこと**(絶対規則5)をレビューで一目で確認できる。
 */

import { insertLessonEvent } from '@/db';
import type { LessonEvent } from '@/db';

export interface CompleteLessonInput {
  sentenceId: string;
  /** 第2段階専用の回は null */
  kanjiId: string | null;
}

/**
 * その回を学び終えたことを記録する。
 *
 * 既に記録がある回では何も書かず null を返す(読み返しで進捗が増えないように)。
 */
export function completeLesson({ sentenceId, kanjiId }: CompleteLessonInput): LessonEvent | null {
  return insertLessonEvent({ sentenceId, kanjiId });
}
