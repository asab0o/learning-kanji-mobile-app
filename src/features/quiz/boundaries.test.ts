/**
 * 絶対規則10「推測クイズの結果を SRS に入れない」を**機械で見張る**。
 *
 * レビューでの目視だけに頼ると、あとから「ついでに」1行 import が足されたときに
 * 静かに破られる。壊れ方も最悪で、画面には何も異常が出ず、復習の出題日だけが狂う。
 * そこで `src/features/quiz/` から SRS 側へ伸びる依存を**文字列の有無**で禁じる。
 *
 * コメントは剥がしてから見る。このディレクトリのコメントは「なぜ srs を import しないか」を
 * 説明していて、そこに禁止語が出てくるため。
 *
 * 禁止語をつなぎ合わせて作っているのは、**このテストファイル自身も走査対象**だから。
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** `@/features/srs`(SRS のモジュール全体) */
const SRS_MODULE = ['@', 'features', 'srs'].join('/');
/** `recordReview`(features 側の書き込み口) */
const RECORD_REVIEW = 'record' + 'Review';
/**
 * `insertReviewEvent`(**DB 側の書き込み口**)。
 *
 * ここが一番通りやすい抜け道。`@/db` は画面から普通に import するものなので、
 * `import { insertReviewEvent } from '@/db';` を1行足すだけで SRS に書けてしまい、
 * `@/features/srs` を経由しないので上の2つには引っかからない。
 */
const INSERT_REVIEW_EVENT = 'insert' + 'ReviewEvent';
/** `reviewEvents`(Drizzle のテーブルオブジェクト。`@/db/schema` を直接叩く経路) */
const REVIEW_TABLE = 'review' + 'Events';

const FORBIDDEN = [SRS_MODULE, RECORD_REVIEW, INSERT_REVIEW_EVENT, REVIEW_TABLE];

function sourceFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      found.push(path);
    }
  }

  return found;
}

/** コメントを剥がす。禁止語の説明そのものに反応させないため */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('推測クイズの依存境界', () => {
  /**
   * `src/features/quiz/` 一式に加えて、**クイズ画面そのもの**も見る。
   *
   * 実際に DB へ書いているのは `src/app/quiz.tsx` なので、そこを外すと
   * 「画面に `recordReview()` を1行足す」変更を誰も止められない。
   */
  const files = [...sourceFiles(__dirname), join(__dirname, '..', '..', 'app', 'quiz.tsx')];

  it('走査対象のファイルが見つかっている(空振りで緑にならないこと)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN)('どのファイルも %s に触れない(絶対規則10)', (forbidden) => {
    const offenders = files.filter((file) =>
      stripComments(readFileSync(file, 'utf8')).includes(forbidden)
    );

    expect(offenders).toEqual([]);
  });
});
