/**
 * 出題する語を1つ選ぶ(要件定義書 4.4)。
 *
 * `@/db` を import しない(純粋。理由は `srs/scheduler.ts` と同じ)。
 * `@/features/srs` も import しない(絶対規則10。`boundaries.test.ts` が見張る)。
 *
 * **1回の入場につき1問しか返さない。** 連続で解けるようにすると「ご褒美体験」ではなく
 * 課題になる(要件定義書 4.4)。
 */

import type { KanjiEntry, Word } from '@/content/types';

import type { LearnedKanji, QuizItem, QuizSlot } from './types';

/**
 * 直前に出した語を何件覚えておくか。
 *
 * 候補が最大19語しかないので、大きくすると「出せる語が無い」に倒れる。
 * 全候補がここに入ったときは条件を落として1問返す(黙って止まらせない)。
 */
export const RECENT_ITEM_MEMORY = 10;

/** 漢字1字かどうか。ひらがな・カタカナ・記号を除くために使う */
const KANJI = /\p{Script=Han}/u;

export interface PickQuizItemInput {
  /** 語マスタ。**同じ語が複数の樹に別 ID で入っている**ので surface で畳む */
  words: Word[];
  /** 漢字マスタ全件。構成字の意味を引くのに使う */
  kanji: KanjiEntry[];
  /**
   * 第2段階の演出語(例: 時間 / 大学)。**これを含む語は出題しない。**
   *
   * クイズは未習の語を出す仕様なので、放っておくと演出回に着く前に読みと意味を
   * 先に見せてしまい、最大の差別化(要件定義書 3.3)が消える
   * (`docs/plans/guess-quiz.md` 差分3。2026-09-06 承認)。
   *
   * **判定は部分一致。** 完全一致だと `外国人`(初日に出題可)が `外国` の演出を、
   * `見学` `入学` が `大学` の演出を先に潰す。
   */
  reencounterWords: string[];
  /** 導入済みの字。`lesson_events` 由来 */
  learned: LearnedKanji[];
  /** 学び終えた会話文の ID。「もう出会った語」の判定に使う */
  completedSentenceIds: string[];
  /** 直近に出題した `itemKey`(新しい順)。`quiz_attempts` 由来 */
  recentItemKeys: string[];
  slot: QuizSlot;
  /**
   * `slot: 'lesson'` で**たった今学び終えた漢字**の ID。
   *
   * **lesson では必須。渡さなければ出題しない**(`pickQuizItem` の 7a)。
   * 別の字の語で埋めると、`食` の回に `日本語` が出るように唐突に見える。
   * `slot: 'review'` では使わない。
   */
  focusKanjiId?: string;
  now: number;
  /** テストから固定するための注入点(`srs/choices.ts` と同じ形) */
  rng?: () => number;
}

/** 出題できる語が無ければ null。画面はそれを「今日は無い」と出す */
export function pickQuizItem({
  words,
  kanji,
  reencounterWords,
  learned,
  completedSentenceIds,
  recentItemKeys,
  slot,
  focusKanjiId,
  now,
  rng = Math.random,
}: PickQuizItemInput): QuizItem | null {
  const master = new Map(kanji.map((entry) => [entry.character, entry]));
  const learnedAt = foldLearnedAt(learned);
  const completed = new Set(completedSentenceIds);
  // 部分一致で見るので Set にしない(下のふるい5)
  const excludedWords = [...new Set(reencounterWords)];
  const recent = new Set(recentItemKeys.slice(0, RECENT_ITEM_MEMORY));

  /** 構成字 → その字を導入した時刻。復習直後の寄せ方(下の `preferForReview`)で使う */
  const learnedAtByCharacter = new Map<string, number>();

  for (const entry of kanji) {
    const completedAt = learnedAt.get(entry.id);

    if (completedAt !== undefined) {
      learnedAtByCharacter.set(entry.character, completedAt);
    }
  }

  const candidates: QuizItem[] = [];

  for (const [surface, rows] of groupBySurface(words)) {
    const characters = [...surface].filter((character) => KANJI.test(character));

    // 1. 熟語であること。1字の語は「構成字の種明かし」が成立しない
    if (characters.length < 2) {
      continue;
    }

    // 2. 構成字がすべてマスタにあること。要件4.4 の例(歩道・空気)は `道` `気` が
    //    対象50字に無く、種明かしの英語を引く先が無い(差分1。2026-09-06 承認)
    const entries: KanjiEntry[] = [];

    for (const character of characters) {
      const entry = master.get(character);

      if (entry !== undefined) {
        entries.push(entry);
      }
    }

    if (entries.length !== characters.length) {
      continue;
    }

    // 3. 1字以上が既習であること(要件4.4「既習漢字を含む」)
    const components = entries.map((entry) => ({
      character: entry.character,
      meaning: entry.meaning,
      learned: learnedAt.has(entry.id),
    }));

    if (!components.some((component) => component.learned)) {
      continue;
    }

    // 4. まだ会話文で出会っていないこと(要件4.4「未習の単語」)。
    //    同じ語の行が別々の回を指すことがある(`Word.encounteredInSentenceId` の注釈)ので、
    //    **どれか1行でも既読なら出さない**。片方の樹だけ見て「未読」と誤判定すると、
    //    答えが本文に書いてある問題を出すことになる
    if (
      rows.some(
        (row) => row.encounteredInSentenceId !== null && completed.has(row.encounteredInSentenceId)
      )
    ) {
      continue;
    }

    // 5. 第2段階の演出語を含まないこと(差分3)。
    //
    //    **完全一致では足りない。** `外国人` は初日から出題できてしまい、その種明かし
    //    (がいこくじん / 外 outside / 国 country)を見た学習者にとって、#55 の
    //    「`外国` の読みが変わった」カードはもう驚きではない。`見学` `入学` と #45 の
    //    `大学` も同じ関係。**演出語を部分文字列として含む語ごと外す**
    //    (2026-09-06 のレビュー指摘。実データで漏れる3語を確認して決めた)
    if (excludedWords.some((word) => surface.includes(word))) {
      continue;
    }

    candidates.push({
      itemKey: toItemKey(surface),
      surface,
      kana: rows[0].kana,
      meaning: rows[0].meaning,
      components,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  // 6. 直近に出した語を避ける
  const fresh = candidates.filter((candidate) => !recent.has(candidate.itemKey));

  // 7a. 学習直後は**たった今学んだ字を含む語だけ**。無ければ出さない。
  //
  //     条件を落として別の字の語を出すと、`食` の回に `日本語` が出るように唐突に見える
  //     (要件4.4 が学習直後の枠を「今さっき絵と意味を見た字なので推測が効く」と
  //     説明している意図から外れる)。直近回避も落とさない。`外出` しか候補の無い
  //     `外` → `出` の回で、同じ語が2回続くため
  //     (docs/plans/quiz-and-review-repeats.md。`guess-quiz.md` 差分2 の取り下げ)
  if (slot === 'lesson') {
    const focusCharacter = kanji.find((entry) => entry.id === focusKanjiId)?.character;

    if (focusCharacter === undefined) {
      return null;
    }

    const focused = fresh.filter((item) =>
      item.components.some((component) => component.character === focusCharacter)
    );

    return focused.length === 0 ? null : shuffle(focused, rng)[0];
  }

  // 7b. 復習直後は、直近回避が全滅したら**この条件だけ**落とし、時間軸で寄せる。
  //     同点は rng で選ぶ
  const preferred = preferForReview({
    pool: fresh.length > 0 ? fresh : candidates,
    learnedAtByCharacter,
    now,
  });

  return shuffle(preferred, rng)[0];
}

/**
 * `quiz_attempts.item_key` の形式。
 *
 * **行 ID ではなく surface で作る。** `words` は漢字の樹の葉なので、2字の語は両方の字の
 * 樹に別 ID で入っている(`時間` は 時 と 間 の2行)。行 ID を鍵にすると同じ語が2回
 * 出せてしまい、この表を持つ唯一の目的(同じ問題を続けて出さない)が果たせない。
 */
export function toItemKey(surface: string): string {
  return `word:${surface}`;
}

/** 同じ語を1つに畳む(理由は `toItemKey` の注釈) */
function groupBySurface(words: Word[]): Map<string, Word[]> {
  const grouped = new Map<string, Word[]>();

  for (const word of words) {
    const rows = grouped.get(word.surface);

    if (rows === undefined) {
      grouped.set(word.surface, [word]);
    } else {
      rows.push(word);
    }
  }

  return grouped;
}

/** 同じ字に複数の記録があれば**最初の導入**を採る(`srs/scheduler.ts` と同じ扱い) */
function foldLearnedAt(learned: LearnedKanji[]): Map<string, number> {
  const folded = new Map<string, number>();

  for (const entry of learned) {
    const existing = folded.get(entry.kanjiId);

    if (existing === undefined || entry.completedAt < existing) {
      folded.set(entry.kanjiId, entry.completedAt);
    }
  }

  return folded;
}

/**
 * 復習直後の難易度を時間軸で寄せる(`guess-quiz.md` 差分2)。
 *
 * **既習字を今日より前に学んでいる**語を優先する。記憶から引き出させる枠なので。
 *
 * **寄せるだけで、絞り込んで空にはしない。** 該当が無ければ候補全体から出す。
 * 該当ゼロで null を返すと、初日の復習のように「条件は満たすのに何も出ない」が起きる。
 * 学習直後(`lesson`)はこの関数を通らない。そちらは空なら出さない(`pickQuizItem` の 7a)。
 */
function preferForReview({
  pool,
  learnedAtByCharacter,
  now,
}: {
  pool: QuizItem[];
  learnedAtByCharacter: Map<string, number>;
  now: number;
}): QuizItem[] {
  const today = startOfLocalDay(now);

  const matched = pool.filter((item) => {
    const learnedDays: number[] = [];

    for (const component of item.components) {
      const completedAt = learnedAtByCharacter.get(component.character);

      if (completedAt !== undefined) {
        learnedDays.push(startOfLocalDay(completedAt));
      }
    }

    // ふるい3を通っているので空にはならないが、空なら寄せる根拠が無いので外す
    if (learnedDays.length === 0) {
      return false;
    }

    return learnedDays.every((day) => day < today);
  });

  return matched.length > 0 ? matched : pool;
}

/**
 * その時刻が属するローカル日の午前0時。
 *
 * `@/features/srs/day` に同じものがあるが、**あちらを import しない**。
 * `src/features/quiz/` から `@/features/srs` に伸びる依存を1本も作らないことで、
 * 「クイズの結果を SRS に入れていない」を `boundaries.test.ts` が文字列で機械的に
 * 保証できる(絶対規則10)。十数行の重複はその保証の対価として払う。
 */
function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);

  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Fisher-Yates。`rng` を注入できるのはテストで並びを固定するため(`srs/choices.ts` と同じ) */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
