/**
 * 「読みが変わった」演出に必要な情報を、会話文と漢字から組み立てる(要件定義書 4.6)。
 *
 * **この関数がこの機能の判断のすべて。** 演出行の特定・語のかなの組み立て・
 * 字ごとの変化前後の読み・★の位置を、ここ1箇所で決める。
 *
 * 読みの出所は2つに分かれている。
 *
 * - **変わる前**: `KanjiEntry.readings` の訓読み。その字が「もともと何と読むか」
 * - **変わった後**: 演出行のセグメントの `reading`。「この語ではこう読む」
 *
 * こう分けているのは、`日曜日` のように**1字が語中で2回別の読みになる**からで
 * (`日`=にち と `日`=び)、`readings` に音読みを1つ登録するだけでは表せない。
 * セグメントから引けば画面に出ている読みと定義上ずれない
 * (docs/content-spec.md「演出行の書き方」)。
 *
 * **壊れたデータでは例外を投げず `null` を返す。** 画面を落とさないため。
 * その代わり、壊れたデータは `checkReencounterRevealLine`(error)が止める。
 */

import type { KanjiEntry, Reencounter, Sentence } from '@/content/types';

/** カードに出す、1字ぶんの読みの変化 */
export interface RevealKanji {
  /** 漢字1字 */
  character: string;
  /** 英語の意味。カードで字の横に出る */
  meaning: string;
  /** 変わる前の読み(訓読み) */
  from: string;
  /**
   * この語での読み。`日曜日` の `日` のように語中で2回別読みになる字があるので配列。
   * 出現順で、同じ読みが続く場合は重複を除く
   */
  to: string[];
}

export interface Reveal {
  /** 提示する語(例: 日曜日) */
  word: string;
  /** 語全体のかな。セグメントの読みを連結したもの */
  wordKana: string;
  /** 演出を起こす行。`Sentence.lines` の添字 */
  lineIndex: number;
  /** ★を載せるセグメント。演出行のセグメント配列の添字 */
  badgeSegmentIndex: number;
  /** 読みが変わる字。第2段階では2字のことがある(時間 = 時 + 間) */
  kanji: RevealKanji[];
  /** 演出を出したことを記録する対象。`markRevealShown` に渡す */
  kanjiIds: string[];
}

export function revealFor(sentence: Sentence, kanji: readonly KanjiEntry[]): Reveal | null {
  const reencounter = sentence.reencounters.find((r) => r.stage === 2);
  if (reencounter === undefined) {
    return null;
  }

  const line = singleLineContaining(sentence, reencounter.word);
  if (line === null) {
    return null;
  }

  const chars = [...reencounter.word];
  const start = line.segments.findIndex((_, i) =>
    chars.every((c, k) => line.segments[i + k]?.text === c)
  );
  if (start === -1) {
    return null;
  }

  const wordSegments = line.segments.slice(start, start + chars.length);
  if (wordSegments.some((segment) => segment.reading === undefined)) {
    return null;
  }

  const entries = revealKanji(reencounter, kanji, chars, wordSegments);
  if (entries === null) {
    return null;
  }

  return {
    word: reencounter.word,
    wordKana: wordSegments.map((segment) => segment.reading ?? '').join(''),
    lineIndex: line.index,
    // ★は語の先頭(=読みが変わり始める場所)に置く。行の中で他の場所に置くと
    // 「どこが変わったのか」を指せない
    badgeSegmentIndex: start,
    kanji: entries,
    kanjiIds: reencounter.kanjiIds,
  };
}

/** 語を含む行がちょうど1つならそれを返す。0行でも2行以上でも null */
function singleLineContaining(
  sentence: Sentence,
  word: string
): { index: number; segments: Sentence['lines'][number]['segments'] } | null {
  const hits = sentence.lines
    .map((line, index) => ({ index, segments: line.segments, japanese: line.japanese }))
    .filter((line) => line.japanese.includes(word));

  return hits.length === 1 ? hits[0] : null;
}

/**
 * 対象字ごとに、変わる前(訓読み)と変わった後(語中の読み)を集める。
 *
 * 1つでも組み立てられない字があれば `null` を返す。片方だけのカードを出すと
 * 「読みは変わるが意味の核は変わらない」という核心が伝わらないため。
 */
function revealKanji(
  reencounter: Reencounter,
  kanji: readonly KanjiEntry[],
  chars: string[],
  wordSegments: { text: string; reading?: string }[]
): RevealKanji[] | null {
  const entries: RevealKanji[] = [];

  for (const id of reencounter.kanjiIds) {
    const entry = kanji.find((k) => k.id === id);
    if (entry === undefined) {
      return null;
    }

    const from = entry.readings.find((reading) => reading.type === 'kun');
    if (from === undefined) {
      return null;
    }

    // 語の**範囲内**の出現だけを見る。同じ行の語の外に同じ字があっても拾わない
    const to = chars
      .map((char, i) => (char === entry.character ? wordSegments[i].reading : undefined))
      .filter((reading): reading is string => reading !== undefined);

    if (to.length === 0) {
      return null;
    }

    entries.push({
      character: entry.character,
      meaning: entry.meaning,
      from: from.kana,
      to: [...new Set(to)],
    });
  }

  return entries.length === 0 ? null : entries;
}
