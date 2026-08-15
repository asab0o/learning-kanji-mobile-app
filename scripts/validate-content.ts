/**
 * コンテンツ検証の CLI。`pnpm run check` から呼ばれる。
 *
 * ルール本体は src/content/validate.ts にある(そちらは純粋関数なのでテスト可能)。
 * このファイルは実データを読んでルールに掛け、結果を人間が読める形で出すだけ。
 */

import { contentSet } from '../src/content';
import type { ChapterNumber } from '../src/content/types';
import { collectUnlearnedKanjiUsage, validateContent } from '../src/content/validate';

const CHAPTER_LABELS: Record<ChapterNumber, string> = {
  1: '第1章 家の中(無料)',
  2: '第2章 一日の暮らし',
  3: '第3章 外に出る',
  4: '第4章 学びと世界',
};

const { kanji, words, sentences } = contentSet;
console.log(`漢字 ${kanji.length} 字 / 単語 ${words.length} 語 / 会話文 ${sentences.length} 文`);

// --- 未習漢字の密度(検証ではなく可視化) ------------------------------------
// 決定事項 4章で未習漢字の使用は許容されている。ただし「なるべく使わない」方針は
// 変わらないため密度を出す。第1章は無料範囲で離脱が最も起きるので章別に見せる。
if (sentences.length > 0) {
  const usages = collectUnlearnedKanjiUsage(contentSet);
  console.log('\n未習漢字の密度(許容されているが、なるべく少ないほうがよい)');

  for (const key of [1, 2, 3, 4] as ChapterNumber[]) {
    const total = sentences.filter((s) => s.chapter === key).length;
    if (total === 0) continue;
    const inChapter = usages.filter((u) => u.chapter === key);
    const affected = new Set(inChapter.map((u) => u.sentenceOrder)).size;
    const perSentence = (inChapter.length / total).toFixed(1);
    console.log(
      `  ${CHAPTER_LABELS[key].padEnd(20)} ${affected}/${total} 文  延べ ${inChapter.length} 字  1文あたり ${perSentence}`
    );
  }

  const later = usages.filter((u) => u.introducedLaterAt !== null);
  if (later.length > 0) {
    const list = later
      .map((u) => `${u.character}(#${u.sentenceOrder}→#${u.introducedLaterAt})`)
      .join(' ');
    console.log(`  あとで習う字を先に使用: ${list}`);
  }

  const frequency = new Map<string, number>();
  for (const u of usages) {
    if (u.introducedLaterAt !== null) continue;
    frequency.set(u.character, (frequency.get(u.character) ?? 0) + 1);
  }
  const top = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([char, count]) => `${char}(${count})`)
    .join(' ');
  if (top) console.log(`  対象50字の外で頻出: ${top}`);
}

// --- 検証 -----------------------------------------------------------------
const issues = validateContent(contentSet);
const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');

if (warnings.length > 0) {
  console.log(`\n警告 ${warnings.length} 件`);
  for (const issue of warnings) {
    console.log(`  [${issue.rule}] ${issue.message}`);
  }
}

if (errors.length > 0) {
  console.log(`\nエラー ${errors.length} 件`);
  for (const issue of errors) {
    console.log(`  [${issue.rule}] ${issue.message}`);
  }
  console.log(
    '\nルールの根拠は docs/content-decisions.md にあります。' +
      'ルールを緩めて通すのではなく、コンテンツ側を直してください。'
  );
  process.exit(1);
}

console.log(warnings.length === 0 ? '\nコンテンツ検証: 問題なし' : '\nコンテンツ検証: エラーなし');
