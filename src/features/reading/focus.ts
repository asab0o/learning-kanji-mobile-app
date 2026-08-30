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
import { revealFor } from '@/features/reading/reveal';

/**
 * ハイライトする字を返す。
 *
 * 新出漢字がある回はその1字、**第2段階専用の回(`newKanjiId` が null)では
 * 読みが変わる字**を返す。この関数の doc コメントが元から予告していた分岐で、
 * 演出の実装(`revealFor`)が入ったことで埋まった。
 *
 * 対象字を含むセグメントは**すべて**光る(`toFuriganaSegments` の既定の挙動)。
 * 会話文 #1 のように同じ字が1つの回に別の読みで複数回出るとき、一部だけ光らせると
 * 光る `人` と光らない `人` が並んで別の字に見えるため、意図的に全部光らせている。
 * #17 で `日` が3箇所(ひ / にち / び)光るのも同じ理由。
 *
 * ID に対応する漢字が見つからない場合と、演出が成立しない場合は空を返す。
 * ハイライト無しで素の文が出るだけで、画面は壊れない。
 */
export function focusCharactersFor(sentence: Sentence, kanji: readonly KanjiEntry[]): string[] {
  if (sentence.newKanjiId === null) {
    return revealFor(sentence, kanji)?.kanji.map((k) => k.character) ?? [];
  }

  const entry = kanji.find((k) => k.id === sentence.newKanjiId);

  return entry === undefined ? [] : [entry.character];
}
