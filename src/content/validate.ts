/**
 * 学習コンテンツの不変条件を検証する。
 *
 * ルールの根拠は docs/content-decisions.md(方針)と docs/content-spec.md(契約)。
 * 各ルールは純粋関数なので、フィクスチャでテストできる(validate.test.ts)。
 *
 * **error は「差別化機能が壊れる」ものだけに絞ってある。**
 * 未習漢字の使用は決定事項で許容されているため、ここでは検証せず
 * scripts/validate-content.ts が集計として出す(collectUnlearnedKanjiUsage)。
 *
 * このファイルのルールを「通すために」緩めてはいけない。
 * ルール自体が誤っていると考える場合は、先に docs/content-decisions.md を直すこと。
 */

import { ALLOWED_IN_ROMAJI } from './romaji';
import { segmentsToText } from './segments';
import type { ChapterNumber, ContentSet, KanjiEntry, Line, Sentence } from './types';

export type IssueLevel = 'error' | 'warning';

export interface Issue {
  level: IssueLevel;
  /** どのルールが検出したか */
  rule: string;
  message: string;
}

/** 章ごとの構成(docs/content-decisions.md 1章「章テーマ」) */
export const EXPECTED_CHAPTERS: Record<
  ChapterNumber,
  { sentences: number; newKanji: number; stage2: number }
> = {
  1: { sentences: 10, newKanji: 10, stage2: 0 },
  2: { sentences: 15, newKanji: 14, stage2: 1 },
  3: { sentences: 16, newKanji: 13, stage2: 3 },
  4: { sentences: 17, newKanji: 13, stage2: 4 },
};

export const EXPECTED_TOTAL_SENTENCES = 58;

/**
 * 空(猫)が言ってはいけない語。
 *
 * 決定事項 3章「空の発話ルール: 要求・状態・存在のみを言い、挨拶や応答はしない」。
 * 猫がどこまで言葉を解するのかという設定の線引きを守るためのガードであり、
 * 「おかえり」を空に言わせないことが会話文集 #10 のオチを成立させている。
 */
const SORA_FORBIDDEN_PHRASES = [
  // 挨拶
  'おはよう',
  'おはようございます',
  'こんにちは',
  'こんばんは',
  'おやすみ',
  'さようなら',
  'ただいま',
  'おかえり',
  'いってきます',
  'いってらっしゃい',
  // 礼・謝罪
  'ありがとう',
  'どういたしまして',
  'ごめん',
  'ごめんなさい',
  'すみません',
  'いただきます',
  'ごちそうさま',
  // 応答
  'はい',
  'いいえ',
  'うん',
  'ううん',
  'そうです',
];

/**
 * 発話を語の単位に割る。
 *
 * 部分一致で判定すると「はいる」が禁止語「はい」に誤反応する。
 * 空の語彙領域は動作・位置(出る・入る・上・下・外)なので、
 * 「はいる」は設定通りの発話であり弾いてはいけない。
 */
const SPEECH_DELIMITERS = /[、。，．！？!?…・「」\s]+/;

function speechFragments(text: string): string[] {
  return text
    .split(SPEECH_DELIMITERS)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const HAN = /\p{Script=Han}/u;

/** 文字列に含まれる漢字を重複なしで取り出す */
export function extractKanji(text: string): string[] {
  return [...new Set([...text].filter((c) => HAN.test(c)))];
}

const err = (rule: string, message: string): Issue => ({ level: 'error', rule, message });
const warn = (rule: string, message: string): Issue => ({ level: 'warning', rule, message });

const byOrder = <T extends { order: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.order - b.order);

const where = (s: Sentence): string => `文 #${s.order}(${s.id})`;

/** 漢字 ID → その字が導入される会話文の order */
function introductionOrders(content: ContentSet): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of byOrder(content.sentences)) {
    if (s.newKanjiId && !map.has(s.newKanjiId)) map.set(s.newKanjiId, s.order);
  }
  return map;
}

/** ある order の時点で既習になっている漢字(文字)の集合 */
function taughtCharsBefore(content: ContentSet, order: number, inclusive: boolean): Set<string> {
  const charById = new Map(content.kanji.map((k) => [k.id, k.character]));
  const taught = new Set<string>();
  for (const s of byOrder(content.sentences)) {
    if (inclusive ? s.order > order : s.order >= order) break;
    if (s.newKanjiId) {
      const char = charById.get(s.newKanjiId);
      if (char) taught.add(char);
    }
  }
  return taught;
}

// --- error: 構造の整合性 ---------------------------------------------------

/** ID の重複がないこと */
export function checkUniqueIds({ kanji, words, sentences }: ContentSet): Issue[] {
  const issues: Issue[] = [];
  const groups: [string, { id: string }[]][] = [
    ['kanji', kanji],
    ['words', words],
    ['sentences', sentences],
  ];
  for (const [label, items] of groups) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) {
        issues.push(err('unique-ids', `${label} の ID が重複しています: ${item.id}`));
      }
      seen.add(item.id);
    }
  }
  return issues;
}

/**
 * 同じ漢字を2度登録していないこと。
 *
 * DB の `kanji` 表は `character` に UNIQUE を張っている(docs/data-model.md)。
 * ここで弾かないと、検証は通るのにシードだけが UNIQUE 制約違反で落ち、
 * 全ユーザーが起動できなくなる。DB の制約とコンテンツ検証を非対称にしないためのルール。
 */
export function checkUniqueKanjiCharacters({ kanji }: ContentSet): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();

  for (const entry of kanji) {
    if (seen.has(entry.character)) {
      issues.push(
        err('unique-kanji-characters', `漢字が重複しています: ${entry.character} (${entry.id})`)
      );
    }
    seen.add(entry.character);
  }

  return issues;
}

/** order が 1..N の重複なし連番であること */
export function checkOrderSequence({ kanji, sentences }: ContentSet): Issue[] {
  const issues: Issue[] = [];
  const groups: [string, { order: number }[]][] = [
    ['kanji', kanji],
    ['sentences', sentences],
  ];
  for (const [label, items] of groups) {
    if (items.length === 0) continue;
    const orders = items.map((i) => i.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        issues.push(
          err(
            'order-sequence',
            `${label} の order が 1..${orders.length} の連番になっていません(${orders[i]} が ${i + 1} の位置にあります)`
          )
        );
        break;
      }
    }
  }
  return issues;
}

/**
 * 1 文につき新出漢字は最大 1 字。
 * newKanjiId が null でよいのは reencounters を持つ特別回だけ。
 */
export function checkNewKanjiPerSentence({ kanji, sentences }: ContentSet): Issue[] {
  const issues: Issue[] = [];
  const kanjiIds = new Set(kanji.map((k) => k.id));
  const introducedBy = new Map<string, number>();

  for (const s of byOrder(sentences)) {
    if (s.newKanjiId === null) {
      if (s.reencounters.length === 0) {
        issues.push(
          err(
            'new-kanji-per-sentence',
            `${where(s)}: 新出漢字も再登場もありません。第2段階専用の特別回だけが newKanjiId: null を許されます`
          )
        );
      }
      continue;
    }
    if (!kanjiIds.has(s.newKanjiId)) {
      issues.push(
        err(
          'new-kanji-per-sentence',
          `${where(s)}: newKanjiId "${s.newKanjiId}" に対応する漢字がありません`
        )
      );
      continue;
    }
    const previous = introducedBy.get(s.newKanjiId);
    if (previous !== undefined) {
      issues.push(
        err(
          'new-kanji-per-sentence',
          `${where(s)}: 漢字 "${s.newKanjiId}" は文 #${previous} で既に導入されています`
        )
      );
    }
    introducedBy.set(s.newKanjiId, s.order);
  }
  return issues;
}

/**
 * 第2段階の対象字が、その回より前に導入済みであること。**唯一ゆずれないルール。**
 *
 * 「読みが変わった!」という驚きは訓読みを知っていることが前提であり、
 * 未習の字の読みが変わっても学習者には何も起きない。ここが崩れると
 * アプリ最大の差別化(段階的再登場)がそのまま空振りする。
 */
export function checkReencounterKanjiTaught(content: ContentSet): Issue[] {
  const issues: Issue[] = [];
  const kanjiIds = new Set(content.kanji.map((k) => k.id));
  const introduced = introductionOrders(content);

  for (const s of byOrder(content.sentences)) {
    for (const r of s.reencounters) {
      if (r.kanjiIds.length === 0) {
        issues.push(
          err('reencounter-kanji-taught', `${where(s)}: 再登場 "${r.word}" に対象字がありません`)
        );
        continue;
      }
      for (const id of r.kanjiIds) {
        if (!kanjiIds.has(id)) {
          issues.push(
            err(
              'reencounter-kanji-taught',
              `${where(s)}: 再登場 "${r.word}" の対象字 "${id}" が存在しません`
            )
          );
          continue;
        }
        const at = introduced.get(id);
        if (at === undefined) {
          issues.push(
            err(
              'reencounter-kanji-taught',
              `${where(s)}: 第${r.stage}段階 "${r.word}" ですが、漢字 "${id}" はどの回でも導入されていません`
            )
          );
        } else if (at >= s.order) {
          issues.push(
            err(
              'reencounter-kanji-taught',
              `${where(s)}: 第${r.stage}段階 "${r.word}" ですが、漢字 "${id}" の初出は文 #${at} です。初出より後に置いてください`
            )
          );
        }
      }
    }
  }
  return issues;
}

/**
 * 読みの導入方法の整合性(決定事項 4章)。
 *
 * - 訓読みを先、音読みを後(必ずこの順)
 * - 例外字(天・本・語)は最初から音読みで教えるため、第2段階の対象にできない
 */
export function checkReadingIntroduction(content: ContentSet): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map<string, KanjiEntry>(content.kanji.map((k) => [k.id, k]));

  for (const k of content.kanji) {
    const hasKun = k.readings.some((r) => r.type === 'kun');
    const hasOn = k.readings.some((r) => r.type === 'on');
    if (k.readingIntroduction === 'kun-first' && !hasKun) {
      issues.push(
        err(
          'reading-introduction',
          `漢字 "${k.character}": kun-first ですが訓読みが登録されていません。音読みで導入するなら on-only にしてください`
        )
      );
    }
    if (k.readingIntroduction === 'on-only') {
      if (hasKun) {
        issues.push(
          err(
            'reading-introduction',
            `漢字 "${k.character}": on-only ですが訓読みが登録されています。教えない読みをデータに残さないでください`
          )
        );
      }
      if (!hasOn) {
        issues.push(
          err(
            'reading-introduction',
            `漢字 "${k.character}": on-only ですが音読みが登録されていません`
          )
        );
      }
    }
  }

  for (const s of content.sentences) {
    for (const r of s.reencounters) {
      if (r.stage !== 2) continue;
      for (const id of r.kanjiIds) {
        const k = byId.get(id);
        if (!k) continue;
        if (k.readingIntroduction === 'on-only') {
          issues.push(
            err(
              'reading-introduction',
              `${where(s)}: "${r.word}" が例外字 "${k.character}" を第2段階の対象にしています。訓→音の段階を踏まない字なので演出が成立しません`
            )
          );
        } else if (!k.readings.some((reading) => reading.type === 'on')) {
          issues.push(
            err(
              'reading-introduction',
              `${where(s)}: "${r.word}" の対象字 "${k.character}" に音読みが登録されていません`
            )
          );
        }
      }
    }
  }
  return issues;
}

/** isFree は第1章の文だけ true(要件定義書 7章: 課金境界と章の切れ目を一致させる) */
export function checkFreeChapterBoundary({ sentences }: ContentSet): Issue[] {
  return sentences
    .filter((s) => s.isFree !== (s.chapter === 1))
    .map((s) =>
      err(
        'free-chapter-boundary',
        `${where(s)}: 第${s.chapter}章なのに isFree が ${s.isFree} です。無料範囲は第1章のみです`
      )
    );
}

/** 章ごとの総文数・新出字数・第2段階回数(決定事項 1章) */
export function checkChapterComposition({ sentences }: ContentSet): Issue[] {
  if (sentences.length === 0) return [];
  const isComplete = sentences.length === EXPECTED_TOTAL_SENTENCES;
  const make = isComplete ? err : warn;
  const suffix = isComplete ? '' : ' — 制作途中なら想定内';
  const issues: Issue[] = [];

  for (const [key, expected] of Object.entries(EXPECTED_CHAPTERS)) {
    const chapter = Number(key) as ChapterNumber;
    const inChapter = sentences.filter((s) => s.chapter === chapter);
    const newKanji = inChapter.filter((s) => s.newKanjiId !== null).length;
    const stage2 = inChapter.filter((s) => s.reencounters.some((r) => r.stage === 2)).length;

    if (inChapter.length !== expected.sentences) {
      issues.push(
        make(
          'chapter-composition',
          `第${chapter}章の文数が ${inChapter.length} です(想定 ${expected.sentences})${suffix}`
        )
      );
    }
    if (newKanji !== expected.newKanji) {
      issues.push(
        make(
          'chapter-composition',
          `第${chapter}章の新出字数が ${newKanji} です(想定 ${expected.newKanji})${suffix}`
        )
      );
    }
    if (stage2 !== expected.stage2) {
      issues.push(
        make(
          'chapter-composition',
          `第${chapter}章の第2段階の回数が ${stage2} です(想定 ${expected.stage2})${suffix}`
        )
      );
    }
  }
  return issues;
}

/** 日本語本文・英訳の欠落(ローマ字は生成方法が未確定のため検証しない) */
export function checkLineFields({ sentences }: ContentSet): Issue[] {
  const issues: Issue[] = [];
  for (const s of sentences) {
    if (s.lines.length === 0) {
      issues.push(err('line-fields', `${where(s)}: lines が空です`));
      continue;
    }
    s.lines.forEach((line, i) => {
      const at = `${where(s)} の ${i + 1} 行目`;
      if (!line.japanese.trim()) issues.push(err('line-fields', `${at}: japanese が空です`));
      if (!line.english.trim()) issues.push(err('line-fields', `${at}: english が空です`));
    });
  }
  return issues;
}

/** かな(ひらがな・長音符)だけで構成されているか */
const KANA_ONLY = /^[ぁ-ゖゝ-ゟー]+$/;

/**
 * `Line.segments` の形の検証(docs/plans/line-segments.md)。
 *
 * error: 折り返し境界・読みの対応など、崩れると画面が描画できないもの。
 * warning: 演出の質(セグメント幅・新出漢字の埋もれ)。
 */
export function checkLineSegments({ kanji, sentences }: ContentSet): Issue[] {
  const issues: Issue[] = [];
  const charById = new Map(kanji.map((k) => [k.id, k.character]));

  for (const s of sentences) {
    s.lines.forEach((line, i) => {
      const at = `${where(s)} の ${i + 1} 行目`;
      checkOneLineSegments(line, at, s.newKanjiId ? charById.get(s.newKanjiId) : undefined, issues);
    });
  }
  return issues;
}

function checkOneLineSegments(
  line: Line,
  at: string,
  newKanjiChar: string | undefined,
  issues: Issue[]
): void {
  if (line.segments.length === 0) {
    issues.push(err('line-segments', `${at}: segments が空です`));
    return;
  }

  for (const [i, segment] of line.segments.entries()) {
    const segmentAt = `${at} の segments[${i}]("${segment.text}")`;

    if (!segment.text.trim()) {
      issues.push(err('line-segments', `${segmentAt}: text が空です`));
      continue;
    }

    const hasKanji = extractKanji(segment.text).length > 0;

    if (hasKanji && segment.reading === undefined) {
      issues.push(err('line-segments', `${segmentAt}: 漢字を含むのに reading がありません`));
    } else if (segment.reading !== undefined && !KANA_ONLY.test(segment.reading)) {
      issues.push(
        err('line-segments', `${segmentAt}: reading "${segment.reading}" がひらがなではありません`)
      );
    }

    if (!hasKanji && segment.reading !== undefined) {
      issues.push(warn('line-segments', `${segmentAt}: かなだけの text に reading が付いています`));
    }

    if ([...segment.text].length > 10) {
      issues.push(
        warn(
          'line-segments',
          `${segmentAt}: 1セグメントが10字を超えています(吹き出しからはみ出す可能性)`
        )
      );
    }

    if (
      newKanjiChar !== undefined &&
      segment.text.includes(newKanjiChar) &&
      extractKanji(segment.text).some((c) => c !== newKanjiChar)
    ) {
      issues.push(
        warn(
          'line-segments',
          `${segmentAt}: 新出漢字 "${newKanjiChar}" が他の漢字と同じセグメントに入っています。単独のセグメントに分けるとハイライトが効きます`
        )
      );
    }
  }

  const joined = segmentsToText(line.segments);
  if (joined !== line.japanese) {
    issues.push(
      err(
        'line-segments',
        `${at}: segments を連結した文字列("${joined}")が japanese("${line.japanese}")と一致しません`
      )
    );
  }
}

/**
 * 空(猫)の発話ルール。
 * 決定事項 3章: 要求・状態・存在のみを言い、挨拶や応答はしない。
 */
export function checkSoraSpeechRule({ sentences }: ContentSet): Issue[] {
  const issues: Issue[] = [];
  for (const s of sentences) {
    for (const line of s.lines) {
      if (line.speaker !== 'sora') continue;
      const fragments = speechFragments(line.japanese);
      for (const phrase of SORA_FORBIDDEN_PHRASES) {
        if (fragments.includes(phrase)) {
          issues.push(
            err(
              'sora-speech-rule',
              `${where(s)}: 空が挨拶・応答「${phrase}」を言っています。空は要求・状態・存在のみです(「${line.japanese}」)`
            )
          );
        }
      }
      if ([...line.japanese].length > 10) {
        issues.push(
          warn(
            'sora-speech-rule',
            `${where(s)}: 空の発話が長すぎます。単語だけの雑な話し方が設定です(「${line.japanese}」)`
          )
        );
      }
    }
  }
  return issues;
}

/** 漢字の樹の参照整合性 */
export function checkWordReferences({ kanji, words, sentences }: ContentSet): Issue[] {
  const issues: Issue[] = [];
  const kanjiIds = new Set(kanji.map((k) => k.id));
  const sentenceIds = new Set(sentences.map((s) => s.id));

  for (const w of words) {
    if (!kanjiIds.has(w.kanjiId)) {
      issues.push(
        err(
          'word-references',
          `単語 "${w.surface}"(${w.id}): kanjiId "${w.kanjiId}" が存在しません`
        )
      );
    }
    if (w.encounteredInSentenceId !== null && !sentenceIds.has(w.encounteredInSentenceId)) {
      issues.push(
        err(
          'word-references',
          `単語 "${w.surface}"(${w.id}): encounteredInSentenceId "${w.encounteredInSentenceId}" が存在しません`
        )
      );
    }
  }
  return issues;
}

// --- warning: 演出の質 -----------------------------------------------------

/**
 * 第2段階の対象字の初出が同じ章内にないか(決定事項 4章の配置ルール2)。
 *
 * 間隔が短いと「さっき習ったばかりの字」になり、思い出す努力が要らないぶん驚きが小さい。
 * ただし第4章は17文に新出13字＋第2段階4回を詰め込むため構造的に避けられず、
 * 実データでも 8回中4回が同章内になっている。**error にはしない。**
 */
export function checkReencounterProximity(content: ContentSet): Issue[] {
  const issues: Issue[] = [];
  const introduced = introductionOrders(content);
  const chapterOfOrder = new Map(content.sentences.map((s) => [s.order, s.chapter]));
  const charById = new Map(content.kanji.map((k) => [k.id, k.character]));

  for (const s of byOrder(content.sentences)) {
    for (const r of s.reencounters) {
      if (r.stage !== 2) continue;
      for (const id of r.kanjiIds) {
        const at = introduced.get(id);
        if (at === undefined || at >= s.order) continue; // 順序違反は error 側が報告する
        if (chapterOfOrder.get(at) === s.chapter) {
          issues.push(
            warn(
              'reencounter-proximity',
              `${where(s)}: "${r.word}" の対象字 "${charById.get(id) ?? id}" の初出が同じ第${s.chapter}章(文 #${at}、${s.order - at}文差)です。間隔が短いぶん驚きが小さくなります`
            )
          );
        }
      }
    }
  }
  return issues;
}

/**
 * 第2段階の演出をする行に未習漢字が混ざっていないか(決定事項 4章)。
 *
 * 「読みが変わった」ことに集中させたい行なので、他の未習漢字は注意を散らす。
 * 実データでも #30 が 読・書 で該当するため警告に留める。
 */
export function checkReencounterLineCleanliness(content: ContentSet): Issue[] {
  const issues: Issue[] = [];

  for (const s of byOrder(content.sentences)) {
    const stage2 = s.reencounters.filter((r) => r.stage === 2);
    if (stage2.length === 0) continue;
    const taught = taughtCharsBefore(content, s.order, true);

    for (const r of stage2) {
      // 熟語そのものの構成字(日曜日の「曜」など)は除外する。
      // 教えようがない字で永久に鳴り続けるうえ、相方の既習判定は
      // checkCompoundPartnerTaught が担当している。
      const inWord = new Set(extractKanji(r.word));
      for (const line of s.lines) {
        if (!line.japanese.includes(r.word)) continue;
        const unlearned = extractKanji(line.japanese).filter(
          (c) => !taught.has(c) && !inWord.has(c)
        );
        if (unlearned.length > 0) {
          issues.push(
            warn(
              'reencounter-line-cleanliness',
              `${where(s)}: "${r.word}" の演出行に未習漢字 ${unlearned.join('・')} があります(${line.speaker}: ${line.japanese})`
            )
          );
        }
      }
    }
  }
  return issues;
}

/**
 * 熟語のもう一方の漢字も既習か(決定事項 4章の配置ルール3「望ましい」)。
 *
 * 対象50字に入っていない字(日曜日の「曜」など)は構造的に既習にできないため対象外。
 */
export function checkCompoundPartnerTaught(content: ContentSet): Issue[] {
  const issues: Issue[] = [];
  const charById = new Map(content.kanji.map((k) => [k.id, k.character]));
  const inCurriculum = new Set(content.kanji.map((k) => k.character));

  for (const s of byOrder(content.sentences)) {
    const stage2 = s.reencounters.filter((r) => r.stage === 2);
    if (stage2.length === 0) continue;
    const taught = taughtCharsBefore(content, s.order, true);

    for (const r of stage2) {
      const targets = new Set(r.kanjiIds.map((id) => charById.get(id) ?? ''));
      for (const char of extractKanji(r.word)) {
        if (targets.has(char)) continue;
        if (!inCurriculum.has(char)) continue; // 曜 など、そもそも教えない字
        if (!taught.has(char)) {
          issues.push(
            warn(
              'compound-partner-taught',
              `${where(s)}: "${r.word}" のもう一方の字 "${char}" がこの時点で未習です。両方を知っているほうが語の組み立てが見えます`
            )
          );
        }
      }
    }
  }
  return issues;
}

/**
 * 空が登場する回に、空とミアのやりとりが1往復以上あるか。
 * 決定事項 3章「空を受け身のオチ要員にしない」(v0.1 の反省)。
 */
export function checkSoraInteraction({ sentences }: ContentSet): Issue[] {
  const issues: Issue[] = [];
  for (const s of sentences) {
    const hasSora = s.lines.some((l) => l.speaker === 'sora');
    if (!hasSora) continue;
    const interacts = s.lines.some(
      (l, i) =>
        l.speaker === 'sora' &&
        (s.lines[i - 1]?.speaker === 'mia' || s.lines[i + 1]?.speaker === 'mia')
    );
    if (!interacts) {
      issues.push(
        warn(
          'sora-interaction',
          `${where(s)}: 空が登場しますが、ミアとのやりとりがありません。空が受け身のオチ要員になっています`
        )
      );
    }
  }
  return issues;
}

// --- 集計(検証ではなく可視化) ---------------------------------------------

export interface UnlearnedUsage {
  sentenceOrder: number;
  sentenceId: string;
  chapter: ChapterNumber;
  character: string;
  /** 対象漢字リストに含まれるが、この文より後で導入される字 */
  introducedLaterAt: number | null;
}

/**
 * 未習漢字の使用箇所を集める。**これは検証ではない。**
 *
 * 決定事項 4章で未習漢字の使用は許容されている(ふりがな＋英訳があるため読める)。
 * ただし「なるべく使わない」方針は変わらないため、密度を数値で見えるようにする。
 * 特に第1章は無料範囲であり離脱が最も起きる場所なので、章別に出す。
 */
export function collectUnlearnedKanjiUsage(content: ContentSet): UnlearnedUsage[] {
  const usages: UnlearnedUsage[] = [];
  const charById = new Map(content.kanji.map((k) => [k.id, k.character]));
  const introducedAtByChar = new Map<string, number>();
  for (const s of byOrder(content.sentences)) {
    if (s.newKanjiId) {
      const char = charById.get(s.newKanjiId);
      if (char && !introducedAtByChar.has(char)) introducedAtByChar.set(char, s.order);
    }
  }

  const taught = new Set<string>();
  for (const s of byOrder(content.sentences)) {
    if (s.newKanjiId) {
      const char = charById.get(s.newKanjiId);
      if (char) taught.add(char);
    }
    const seen = new Set<string>();
    for (const line of s.lines) {
      for (const char of extractKanji(line.japanese)) {
        if (taught.has(char) || seen.has(char)) continue;
        seen.add(char);
        usages.push({
          sentenceOrder: s.order,
          sentenceId: s.id,
          chapter: s.chapter,
          character: char,
          introducedLaterAt: introducedAtByChar.get(char) ?? null,
        });
      }
    }
  }
  return usages;
}

/** ローマ字に混ざってはいけない文字を1つ返す。許可リストは変換器と共有する */
const findForeignChar = (romaji: string): string | undefined =>
  [...romaji].find((char) => !ALLOWED_IN_ROMAJI.test(char));

/**
 * ローマ字欄の検証(docs/plans/romaji-converter.md)。
 *
 * ローマ字は `pnpm run romaji` が出した下書きを人が直して貼るもので、
 * 助詞と語境界は人の判断が入る。そのため**中身の正しさは機械で判定できない**。
 * ここで見るのは「明らかに事故っている」形だけに絞る。
 */
export function checkRomaji({ kanji, sentences }: ContentSet): Issue[] {
  const issues: Issue[] = [];
  let missing = 0;

  for (const entry of kanji) {
    entry.readings.forEach((reading, i) => {
      const foreign = findForeignChar(reading.romaji);
      if (foreign !== undefined) {
        issues.push(
          err(
            'romaji',
            `漢字 ${entry.character}(${entry.id})の readings[${i}]: romaji に「${foreign}」が混ざっています("${reading.romaji}")`
          )
        );
      } else if (!reading.romaji.trim()) {
        missing += 1;
      }
    });
  }

  for (const s of sentences) {
    s.lines.forEach((line, i) => {
      const at = `${where(s)} の ${i + 1} 行目`;

      const foreign = findForeignChar(line.romaji);
      if (foreign !== undefined) {
        issues.push(
          err('romaji', `${at}: romaji に「${foreign}」が混ざっています("${line.romaji}")`)
        );
        return;
      }

      if (!line.romaji.trim()) {
        missing += 1;
        return;
      }

      // 語単位の出力(小文字)を行にそのまま貼った事故を拾う
      const firstLetter = [...line.romaji].find((c) => /\p{Letter}/u.test(c));
      if (firstLetter !== undefined && firstLetter !== firstLetter.toUpperCase()) {
        issues.push(warn('romaji', `${at}: romaji が小文字で始まっています("${line.romaji}")`));
      }
    });
  }

  // 制作途中は必ず空になるので、行ごとに出さず1件にまとめる。
  // 145 行分の警告で他のルールの指摘が埋もれるのを避ける
  if (missing > 0) {
    issues.push(
      warn('romaji', `romaji 未記入が ${missing} 件あります — pnpm run romaji で下書きが出せます`)
    );
  }

  return issues;
}

/**
 * 第2段階の演出行の形(要件定義書 4.6 ステップ2)。
 *
 * `Reencounter` は「どの行で演出するか」を持たない。演出行は `word` を含む行として
 * 引き当てる(`checkReencounterLineCleanliness` と同じ引き方)ため、
 * **語がちょうど1行に現れること**が前提になる。2行に出ると、どちらで演出するかが
 * 決まらないまま画面が黙って素の会話文になる。
 *
 * さらにカードは「字ごとに読みがどう変わったか」を出すので、演出語の範囲は
 * **1字1セグメントに割れていて、全てに `reading` が付いている**必要がある。
 * `{ text: '日曜日', reading: 'にちようび' }` だと `日` の読みだけを取り出せない。
 *
 * ここを緩めると `revealFor()` が null を返し、演出が**エラーも出さずに消える**。
 * 気づける場所がここしかないので error にしている。
 */
export function checkReencounterRevealLine({ kanji, sentences }: ContentSet): Issue[] {
  const issues: Issue[] = [];
  const charById = new Map(kanji.map((k) => [k.id, k.character]));

  for (const s of byOrder(sentences)) {
    const stage2 = s.reencounters.filter((r) => r.stage === 2);

    // 画面側(`revealFor`)は 1 文につき第2段階を1件しか見ない。2件書くと
    // 2件目は★もカードもハイライトも出ず、記録もされない。
    // 2字同時は `kanjiIds` の配列で表す設計なので、1件に収まるはず。
    if (stage2.length > 1) {
      issues.push(
        err(
          'reencounter-reveal-line',
          `${where(s)}: 第2段階が ${stage2.length} 件あります。1文につき1件にしてください(2字同時は kanjiIds の配列で表す)`
        )
      );
    }

    // 要件定義書 5.4「第2段階の回のみ新出漢字なしの特別回とする」。
    // `focus.ts` はこの不変条件に依存していて、新出字があると
    // **★は出てカードも開くのに読みが変わる字が光らない**という壊れ方をする。
    if (stage2.length > 0 && s.newKanjiId !== null) {
      issues.push(
        err(
          'reencounter-reveal-line',
          `${where(s)}: 第2段階の回に新出漢字があります。演出の回は newKanjiId: null にしてください(そうしないと読みが変わる字にハイライトが付きません)`
        )
      );
    }

    for (const r of stage2) {
      const hits = s.lines.filter((line) => line.japanese.includes(r.word));
      if (hits.length !== 1) {
        issues.push(
          err(
            'reencounter-reveal-line',
            `${where(s)}: 第2段階 "${r.word}" が ${hits.length} 行に現れます。演出行を一意に決められないので、ちょうど1行にしてください(復唱する行は仮名で書く)`
          )
        );
        continue;
      }

      const segments = hits[0].segments;
      const chars = [...r.word];
      // 語の範囲を、セグメントを連結しながら探す。1字1セグメントなら
      // 語の先頭に一致する位置から chars.length 個が語の範囲になる。
      const start = segments.findIndex((seg, i) =>
        chars.every((c, k) => segments[i + k]?.text === c)
      );

      if (start === -1) {
        issues.push(
          err(
            'reencounter-reveal-line',
            `${where(s)}: 第2段階 "${r.word}" が1字1セグメントに割れていません。カードが字ごとの読みを取り出せません(例: { text: '日', reading: 'にち' } を字の数だけ並べる)`
          )
        );
        continue;
      }

      for (const seg of segments.slice(start, start + chars.length)) {
        if (seg.reading === undefined) {
          issues.push(
            err(
              'reencounter-reveal-line',
              `${where(s)}: 第2段階 "${r.word}" のセグメント "${seg.text}" に reading がありません。演出はここから変化後の読みを取ります`
            )
          );
        }
      }

      for (const id of r.kanjiIds) {
        const char = charById.get(id);
        if (char !== undefined && !r.word.includes(char)) {
          issues.push(
            err(
              'reencounter-reveal-line',
              `${where(s)}: 第2段階 "${r.word}" の対象字 "${char}" が語に含まれていません`
            )
          );
        }
      }
    }
  }
  return issues;
}

const RULES = [
  // error — 壊れると差別化機能が成立しない
  checkUniqueIds,
  checkUniqueKanjiCharacters,
  checkOrderSequence,
  checkNewKanjiPerSentence,
  checkReencounterKanjiTaught,
  checkReencounterRevealLine,
  checkReadingIntroduction,
  checkFreeChapterBoundary,
  checkChapterComposition,
  checkLineFields,
  checkLineSegments,
  checkRomaji,
  checkSoraSpeechRule,
  checkWordReferences,
  // warning — 演出の質
  checkReencounterProximity,
  checkReencounterLineCleanliness,
  checkCompoundPartnerTaught,
  checkSoraInteraction,
] satisfies ((content: ContentSet) => Issue[])[];

export function validateContent(content: ContentSet): Issue[] {
  return RULES.flatMap((rule) => rule(content));
}
