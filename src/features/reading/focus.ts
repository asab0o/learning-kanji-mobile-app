/**
 * その回でハイライトする漢字を決める。
 *
 * 要件4.6 のステップ1(出会った瞬間)は**新出漢字**を光らせる。第2段階の演出では
 * 読みが変わる字に変わるので、対象を決めるのはデータではなくこの層の仕事
 * (`focus` をコンテンツに持たせない理由は docs/content-spec.md「`focus` は持たない」)。
 *
 * 戻り値はそのまま `toFuriganaSegments()` の第2引数に渡す。
 */

import type { KanjiEntry, Sentence } from '@/content/types';

/**
 * 新出漢字1字を返す。
 *
 * 対象字を含むセグメントは**すべて**光る(`toFuriganaSegments` の既定の挙動)。
 * 会話文 #1 のように同じ字が1つの回に別の読みで複数回出るとき、一部だけ光らせると
 * 光る `人` と光らない `人` が並んで別の字に見えるため、意図的に全部光らせている。
 *
 * `newKanjiId` が null の回(第2段階専用の特別回)と、ID に対応する漢字が
 * 見つからない場合は空を返す。ハイライト無しで素の文が出るだけで、画面は壊れない。
 */
export function focusCharactersFor(sentence: Sentence, kanji: readonly KanjiEntry[]): string[] {
  if (sentence.newKanjiId === null) {
    return [];
  }

  const entry = kanji.find((k) => k.id === sentence.newKanjiId);

  return entry === undefined ? [] : [entry.character];
}
