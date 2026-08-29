/**
 * ローマ字の下書きを出す執筆用 CLI。
 *
 * 変換そのものは src/content/romaji.ts にある(純粋関数なのでテスト可能)。
 * このファイルは実データを読んで変換に掛け、人が読める形で出すだけ。
 *
 * **出力を貼るのは人の仕事。** このスクリプトはファイルを書き換えない。
 * `は`/`へ` の助詞判定と語境界は機械では解けないので、
 * 「確認」印が付いた行は必ず目で見て直すこと(docs/content-spec.md)。
 *
 *   pnpm run romaji                    未記入の行と読みだけ下書きを出す
 *   pnpm run romaji -- --all           記入済みも含めて出す(見直し用)
 *   pnpm run romaji -- --sentence 3    会話文 #3 だけ
 *   pnpm run romaji -- --kana とうきょう  かな1語を変換して終わり
 */

import { contentSet } from '../src/content';
import { kanaToRomaji, segmentsToRomajiDraft } from '../src/content/romaji';

const args = process.argv.slice(2);

function optionValue(name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

// --- かな1語モード ---------------------------------------------------------
// Reading.romaji を埋めるとき用。語単位なので小文字のまま使う
const kana = optionValue('--kana');
if (kana !== undefined) {
  console.log(kanaToRomaji(kana));
  process.exit(0);
}

const showAll = args.includes('--all');
const onlySentence = optionValue('--sentence');

const { kanji, sentences } = contentSet;
let printed = 0;

// --- 漢字の読み ------------------------------------------------------------
for (const entry of kanji) {
  entry.readings.forEach((reading, index) => {
    if (!showAll && reading.romaji.trim() !== '') return;
    if (onlySentence !== undefined) return;

    const draft = kanaToRomaji(reading.kana);
    console.log(`漢字 ${entry.character}(${entry.id})の readings[${index}]`);
    console.log(`  kana  : ${reading.kana}`);
    console.log(`  draft : ${draft}`);
    if (reading.romaji.trim() !== '') {
      console.log(`  現在  : ${reading.romaji}`);
    }
    console.log('');
    printed += 1;
  });
}

// --- 会話文の行 ------------------------------------------------------------
for (const sentence of [...sentences].sort((a, b) => a.order - b.order)) {
  if (onlySentence !== undefined && String(sentence.order) !== onlySentence) continue;

  sentence.lines.forEach((line, index) => {
    if (!showAll && line.romaji.trim() !== '') return;

    const { draft, checks } = segmentsToRomajiDraft(line.segments);

    console.log(`文 #${sentence.order}(${sentence.id})の ${index + 1} 行目`);
    console.log(`  ja    : ${line.japanese}`);
    console.log(`  draft : ${draft}`);
    if (line.romaji.trim() !== '') {
      console.log(`  現在  : ${line.romaji}`);
    }
    for (const check of checks) {
      console.log(`  確認  : ${check.detail}`);
    }
    console.log('');
    printed += 1;
  });
}

if (printed === 0) {
  console.log(
    showAll
      ? '対象がありません(コンテンツが空です)'
      : '未記入の romaji はありません(--all で記入済みも出せます)'
  );
} else {
  console.log(`${printed} 件の下書きを出しました。確認印の付いた行は目で見て直してください。`);
}
