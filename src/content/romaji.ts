/**
 * ヘボン式ローマ字への変換。**執筆時に下書きを作るための道具**であって、
 * 実行時に呼ぶものではない(docs/plans/romaji-converter.md)。
 *
 * 表記規則の一覧と根拠は docs/content-spec.md「ローマ字の書き方」。
 * 基準は要件定義書 5.2 の「駅名標示など日本の街中の実表記と一致」で、
 * 具体的には鉄道掲示基準規程(長音はマクロン / b・m・p の前の撥音は m)に従う。
 *
 * `は`/`へ` が助詞かどうかは文脈依存で機械には解けないので、
 * 解けたものだけ直し、残りは `checks` の印を付けて人に返す。
 */

import { segmentsToText } from '@/content/segments';
import type { LineSegment } from '@/content/types';

// ── かな → ローマ字(1語単位) ─────────────────────────

/** 拗音など2文字で1モーラになるもの。1文字表より先に引く */
const DIGRAPHS: Record<string, string> = {
  きゃ: 'kya',
  きゅ: 'kyu',
  きょ: 'kyo',
  ぎゃ: 'gya',
  ぎゅ: 'gyu',
  ぎょ: 'gyo',
  しゃ: 'sha',
  しゅ: 'shu',
  しょ: 'sho',
  じゃ: 'ja',
  じゅ: 'ju',
  じょ: 'jo',
  ちゃ: 'cha',
  ちゅ: 'chu',
  ちょ: 'cho',
  ぢゃ: 'ja',
  ぢゅ: 'ju',
  ぢょ: 'jo',
  にゃ: 'nya',
  にゅ: 'nyu',
  にょ: 'nyo',
  ひゃ: 'hya',
  ひゅ: 'hyu',
  ひょ: 'hyo',
  びゃ: 'bya',
  びゅ: 'byu',
  びょ: 'byo',
  ぴゃ: 'pya',
  ぴゅ: 'pyu',
  ぴょ: 'pyo',
  みゃ: 'mya',
  みゅ: 'myu',
  みょ: 'myo',
  りゃ: 'rya',
  りゅ: 'ryu',
  りょ: 'ryo',
  // 外来語。N5 の会話文でも「コーヒー」「パーティー」程度は出る
  ふぁ: 'fa',
  ふぃ: 'fi',
  ふぇ: 'fe',
  ふぉ: 'fo',
  てぃ: 'ti',
  でぃ: 'di',
  とぅ: 'tu',
  どぅ: 'du',
  うぃ: 'wi',
  うぇ: 'we',
  うぉ: 'wo',
  ゔぁ: 'va',
  ゔぃ: 'vi',
  ゔぇ: 've',
  ゔぉ: 'vo',
  しぇ: 'she',
  じぇ: 'je',
  ちぇ: 'che',
};

const MONOGRAPHS: Record<string, string> = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  ゐ: 'i',
  ゑ: 'e',
  // 現代語で「を」は助詞にしか使わないので、常に o でよい
  を: 'o',
  ゔ: 'vu',
  // 小書きが単独で残った場合の保険
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
  ゃ: 'ya',
  ゅ: 'yu',
  ょ: 'yo',
};

/**
 * 語全体で覚えるもの。
 *
 * 助詞の `は` を含む挨拶は、分解して規則で解こうとすると
 * 「`は` が助詞かどうか」の判定に逆戻りするため、語ごと表に持つ。
 */
const WORD_EXCEPTIONS: Record<string, string> = {
  こんにちは: 'konnichiwa',
  // 「b の前の撥音は m」に従う(さんぽ = sampo と同じ扱い)
  こんばんは: 'kombanwa',
  では: 'dewa',
};

const SOKUON = 'っ';
const HATSUON = 'ん';
const CHOUON = 'ー';

const VOWELS = 'aiueo';
/** マクロンに畳む組み合わせ。`ii` と `ei` は畳まない(JR 表記 Iidabashi / Keisei に合わせる) */
const LONG_VOWELS: Record<string, string> = {
  aa: 'ā',
  uu: 'ū',
  ee: 'ē',
  ou: 'ō',
  oo: 'ō',
};
/** 母音をマクロン付きに置き換える表 */
const MACRONS: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

interface Mora {
  romaji: string;
  /** あ行のかな(長音に畳む対象)か。`か` の `a` とは区別する */
  bareVowel: boolean;
  /** 変換表に無かった文字(漢字など)。呼び出し側が検出できるよう印を残す */
  unconverted: boolean;
}

/**
 * かな1語をヘボン式にする。**スペースを入れず、大文字にもしない。**
 *
 * `Reading.romaji`(`くう` → `kū`)にそのまま使える単位。
 * 語の切り方と大文字化は `segmentsToRomajiDraft()` の担当。
 *
 * 変換できない文字は落とさずそのまま残す。握り潰すと、漢字が紛れ込んでいても
 * それらしい出力になってしまい、検証(`checkRomaji`)が拾えなくなる。
 */
export function kanaToRomaji(kana: string): string {
  const exception = WORD_EXCEPTIONS[kana];
  if (exception !== undefined) {
    return exception;
  }

  return joinMorae(toMorae(katakanaToHiragana(kana)));
}

/** カタカナを対応するひらがなに寄せる。長音符 `ー` はそのまま残す */
function katakanaToHiragana(input: string): string {
  return [...input]
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      // ァ(30A1)〜ヶ(30F6) だけを 0x60 ずらす。ー(30FC)や記号は触らない
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : char;
    })
    .join('');
}

function toMorae(kana: string): Mora[] {
  const morae: Mora[] = [];
  let pendingSokuon = false;
  let index = 0;

  while (index < kana.length) {
    const char = kana[index];

    if (char === SOKUON) {
      pendingSokuon = true;
      index += 1;
      continue;
    }

    if (char === HATSUON) {
      // 後ろのモーラが決まらないと n / m / n' を選べないので、印だけ置く
      morae.push({ romaji: HATSUON, bareVowel: false, unconverted: false });
      index += 1;
      continue;
    }

    if (char === CHOUON) {
      morae.push({ romaji: CHOUON, bareVowel: false, unconverted: false });
      index += 1;
      continue;
    }

    const pair = kana.slice(index, index + 2);
    const digraph = DIGRAPHS[pair];
    const monograph = MONOGRAPHS[char];
    let romaji: string;
    let consumed: number;
    let unconverted = false;

    if (digraph !== undefined) {
      romaji = digraph;
      consumed = 2;
    } else if (monograph !== undefined) {
      romaji = monograph;
      consumed = 1;
    } else {
      romaji = char;
      consumed = 1;
      unconverted = true;
      // 促音は記号にはかからない。ここで捨てないと
      // 「あっ、また」が a、mmata のように次の子音を重ねてしまう
      pendingSokuon = false;
    }

    if (pendingSokuon && !unconverted) {
      romaji = doubleInitialConsonant(romaji);
      pendingSokuon = false;
    }

    morae.push({
      romaji,
      bareVowel: !unconverted && char in MONOGRAPHS && 'あいうえお'.includes(char),
      unconverted,
    });
    index += consumed;
  }

  // 語末に残った促音は落とす(「あっ」→ a)
  return morae;
}

/** 促音。次の子音を重ねる。`ch` だけは `t` を前に置く(ヘボン式) */
function doubleInitialConsonant(romaji: string): string {
  if (romaji.startsWith('ch')) {
    return `t${romaji}`;
  }
  return `${romaji[0]}${romaji}`;
}

function joinMorae(morae: Mora[]): string {
  const parts: string[] = [];

  for (const [index, mora] of morae.entries()) {
    if (mora.romaji === HATSUON) {
      parts.push(hatsuonFor(morae[index + 1]));
      continue;
    }

    if (mora.romaji === CHOUON) {
      // 長音符は直前の母音をマクロンにする。前が無ければ捨てる
      applyMacron(parts);
      continue;
    }

    if (mora.bareVowel && tryLongVowel(parts, mora.romaji)) {
      continue;
    }

    parts.push(mora.romaji);
  }

  return parts.join('');
}

/**
 * 撥音の綴り。
 *
 * b・m・p の前は `m`(新橋 = Shimbashi)。母音・や行の前は切れ目が要るので
 * アポストロフィを足す(`きんようび` → kin'yōbi)。
 * 鉄道掲示基準規程はここでハイフンを使うが、それは複合固有名詞の構成要素を
 * 切る表記なので、一般語には修正ヘボン式のアポストロフィを採る。
 */
function hatsuonFor(next: Mora | undefined): string {
  if (next === undefined || next.romaji === CHOUON) {
    return 'n';
  }
  const head = next.romaji[0];
  if ('bmp'.includes(head)) {
    return 'm';
  }
  if (VOWELS.includes(head) || head === 'y') {
    return "n'";
  }
  return 'n';
}

/** 直前の母音とくっついて長音になるなら畳む。畳んだら true */
function tryLongVowel(parts: string[], vowel: string): boolean {
  const previous = parts.at(-1);
  if (previous === undefined) {
    return false;
  }

  const previousVowel = previous.at(-1);
  if (previousVowel === undefined || !VOWELS.includes(previousVowel)) {
    return false;
  }

  const merged = LONG_VOWELS[previousVowel + vowel];
  if (merged === undefined) {
    return false;
  }

  parts[parts.length - 1] = previous.slice(0, -1) + merged;
  return true;
}

function applyMacron(parts: string[]): void {
  const previous = parts.at(-1);
  if (previous === undefined) {
    return;
  }
  const previousVowel = previous.at(-1);
  if (previousVowel === undefined || !VOWELS.includes(previousVowel)) {
    return;
  }
  parts[parts.length - 1] = previous.slice(0, -1) + MACRONS[previousVowel];
}

// ── セグメント → 行の下書き ───────────────────────────

export type RomajiCheckKind = 'particle' | 'proper-noun' | 'unconverted';

export interface RomajiCheck {
  kind: RomajiCheckKind;
  /** 何を確認してほしいかを日本語で。CLI がそのまま出す */
  detail: string;
}

export interface RomajiDraft {
  draft: string;
  checks: RomajiCheck[];
}

/** 句読点・記号の対応。ここに無い記号はそのまま残す */
const PUNCTUATION: Record<string, string> = {
  '。': '.',
  '、': ',',
  '，': ',',
  '？': '?',
  '?': '?',
  '！': '!',
  '!': '!',
  '…': '...',
  '‥': '..',
  '「': '',
  '」': '',
  '『': '',
  '』': '',
  '・': ' ',
  '　': ' ',
};

/**
 * 語末から切り出す表。
 *
 * `ます` / `ました` を入れていないのは、`あるきました` を
 * `aruki mashita` と割ってしまうため。動詞の活用は語の一部として扱う。
 */
const SUFFIX_WORDS = ['ございました', 'ございます', 'でしょう', 'でした', 'です', 'だった'];

/**
 * 1文字で切り出す語。**読みを持つセグメントの直後のかなセグメントでだけ**適用する。
 * かなだけの行に当てると `なに` を `na ni` と割ってしまう。
 */
const SUFFIX_PARTICLES = [
  // 長いものを先に置く。`ねえ` を `ね` と取り違えないため
  'ねえ',
  'なあ',
  'は',
  'へ',
  'を',
  'が',
  'に',
  'で',
  'と',
  'も',
  'ね',
  'よ',
  'か',
];

/** 助詞として切り出せたときだけ、字義どおりでない読みに直す */
const PARTICLE_ROMAJI: Record<string, string> = { は: 'wa', へ: 'e' };

/**
 * ローマ字として出てよい文字。
 *
 * **許すものを並べる形にしてある。** 「日本語が残っていたら」という否定形で書くと、
 * `、` `。` `「` `…` `？` が Script=Common なので網から漏れる(実際に漏れていた)。
 * マクロン付き母音とアポストロフィはヘボン式で使うので含める。
 * 空白は半角のみ、数字も半角のみ。全角が混ざるのは貼り間違いなので弾く。
 *
 * **検証(`checkRomaji`)もこれを import して使う。**
 * 網を2箇所に手書きすると、片方だけ直して穴が空く。
 */
export const ALLOWED_IN_ROMAJI = /[\p{Script=Latin}0-9 \t.,?!'\u2019:;()"–—-]/u;

/** 大文字化を機械で判定しない固有名詞。CLI が印を出して人に確認させる */
const PROPER_NOUNS = ['ミア', '空'];

interface Chunk {
  kana: string;
  fromReading: boolean;
}

/**
 * 会話文1行分のローマ字の下書きを作る。
 *
 * **完璧を狙わない。** `は`/`へ` の助詞判定と語境界は原理的に解けないので、
 * 直しやすい形で出して人に渡すことを優先する(docs/plans/romaji-converter.md)。
 */
export function segmentsToRomajiDraft(segments: LineSegment[]): RomajiDraft {
  const groups = groupIntoWords(segments);
  const words: string[] = [];

  groups.forEach((group, index) => {
    words.push(...renderWord(group, index === groups.length - 1));
  });

  const draft = tidy(replaceRemainingPunctuation(words.join(' ')));
  const japanese = segmentsToText(segments);
  const checks: RomajiCheck[] = [];

  if (/[はへ]/.test(japanese)) {
    checks.push({
      kind: 'particle',
      detail: `「は」「へ」が助詞かどうかは機械では判定できません(${japanese})`,
    });
  }

  const properNoun = PROPER_NOUNS.find((noun) => japanese.includes(noun));
  if (properNoun !== undefined) {
    checks.push({
      kind: 'proper-noun',
      detail: `固有名詞かもしれません。大文字にするか確認してください(${properNoun})`,
    });
  }

  const leftover = [...draft].find((char) => !ALLOWED_IN_ROMAJI.test(char));
  if (leftover !== undefined) {
    checks.push({
      kind: 'unconverted',
      detail: `変換できない文字「${leftover}」が残っています(${draft})`,
    });
  }

  return { draft, checks };
}

/**
 * セグメントを語のまとまりに束ねる。
 *
 * **直前が読みを持つセグメントなら繋げる。** これで
 * 漢字＋送り仮名(歩(ある)+きました)も、熟語(何(なん)+人(にん))も1語になる。
 * かなの後に漢字が来たら、そこは語の切れ目とみなす。
 */
function groupIntoWords(segments: LineSegment[]): Chunk[][] {
  const groups: Chunk[][] = [];

  for (const segment of segments) {
    const chunk: Chunk = {
      kana: normalizeEllipsis(segment.reading ?? segment.text),
      fromReading: segment.reading !== undefined,
    };

    const previous = groups.at(-1);
    if (previous !== undefined && previous.at(-1)?.fromReading === true) {
      previous.push(chunk);
    } else {
      groups.push([chunk]);
    }
  }

  return groups;
}

/**
 * 「……」「……。」を1つの三点リーダに畳む。
 *
 * 1文字ずつ置き換えると `......`(6点)や `.......`(7点)になってしまう。
 * 原稿の英訳も3点で書かれているので、そちらに揃える。
 */
function normalizeEllipsis(text: string): string {
  return text.replace(/[…‥]+。?/gu, '…');
}

/**
 * 変換の単位に割る。
 *
 * **連続する読みは1つに畳む。** 熟語は語として読むので、
 * 今(きょ)+日(う) は `kyō`、何(なん)+人(にん) は `nannin` になってほしい。
 * 一方で読み→送り仮名の境界は畳まない。思(おも)+う を `omō` にしないため
 * (ここは動詞の語幹と語尾であって長音ではない)。
 */
function toUnits(group: Chunk[]): string[] {
  const units: Chunk[] = [];

  for (const chunk of group) {
    const last = units.at(-1);
    if (last !== undefined && last.fromReading && chunk.fromReading) {
      last.kana += chunk.kana;
    } else {
      units.push({ ...chunk });
    }
  }

  return carrySokuon(units.map((unit) => unit.kana));
}

/**
 * 単位の末尾に残った促音を次の単位の頭へ送る。
 *
 * 一(いっ)+匹(ぴき) のように読みが促音で終わると、単位ごとに変換したときに
 * 促音が落ちて `ipiki` になってしまう。
 */
function carrySokuon(units: string[]): string[] {
  const moved = [...units];

  for (let i = 0; i < moved.length - 1; i += 1) {
    if (moved[i].endsWith(SOKUON)) {
      moved[i] = moved[i].slice(0, -1);
      moved[i + 1] = SOKUON + moved[i + 1];
    }
  }

  return moved;
}

/**
 * 語のまとまり1つを、ローマ字の語の配列にする。
 *
 * `isFinal` は行の最後のまとまりかどうか。助詞の切り出しを
 * 「行末か句読点の前」に限るために要る(子(こ)+ども+がいます を
 * `kodo mo` と割らないため)。
 */
function renderWord(group: Chunk[], isFinal: boolean): string[] {
  const units = toUnits(group);
  const lastIndex = units.length - 1;
  if (lastIndex < 0) {
    return [];
  }

  const { leading, kana: lastKana, trailing } = splitPunctuation(units[lastIndex]);
  // 1文字の助詞を切り出すのは、漢字に続くかなセグメントで、かつ語の切れ目が
  // はっきりしているとき(行末か句読点の前)だけにする
  const allowParticles = group.length > 1 && (isFinal || trailing !== '');
  const [head, ...suffixes] = splitSuffixes(lastKana, allowParticles);

  const stem = units.slice(0, lastIndex).map(kanaToRomaji).join('');
  const headRomaji = kanaToRomaji(head);
  const words: string[] = [];

  if (leading === '') {
    const combined = stem + headRomaji;
    if (combined !== '') {
      words.push(combined);
    }
  } else {
    // 最終ユニットの前に付いた記号は、**直前の語の終わり**を示す。
    // 語頭にまとめて貼ると「ねこが。いっぴき」が ".nekogaippiki" のように融合し、
    // 文の切れ目が消えて大文字化も効かなくなる
    words.push(stem === '' ? leading : stem + leading);
    if (headRomaji !== '') {
      words.push(headRomaji);
    }
  }

  for (const suffix of suffixes) {
    words.push(PARTICLE_ROMAJI[suffix] ?? kanaToRomaji(suffix));
  }

  if (words.length === 0) {
    return trailing === '' ? [] : [trailing];
  }

  words[words.length - 1] += trailing;

  return words;
}

/** 語の前後に付いた句読点・括弧を剥がす。語中のものは後段が一括で置き換える */
function splitPunctuation(kana: string): { leading: string; kana: string; trailing: string } {
  let start = 0;
  let end = kana.length;
  let leading = '';
  let trailing = '';

  while (start < end && PUNCTUATION[kana[start]] !== undefined) {
    leading += PUNCTUATION[kana[start]];
    start += 1;
  }

  while (end > start && PUNCTUATION[kana[end - 1]] !== undefined) {
    trailing = PUNCTUATION[kana[end - 1]] + trailing;
    end -= 1;
  }

  return { leading: leading.trim(), kana: kana.slice(start, end), trailing: trailing.trimEnd() };
}

/**
 * 語末から既知の語を貪欲に剥がす。返り値の先頭が残り、以降が剥がした語。
 *
 * `なんにんですか` → `なんにん` / `です` / `か` のように、複数回剥がす。
 */
function splitSuffixes(kana: string, allowParticles: boolean): string[] {
  const suffixes: string[] = [];
  let rest = kana;

  for (;;) {
    const particle = findParticle(rest, allowParticles);
    // 長い語を先に見る。`ございました` を `ございます` と取り違えない
    const word = SUFFIX_WORDS.find((w) => rest.endsWith(w));

    if (particle !== undefined && (word === undefined || particle.length >= word.length)) {
      suffixes.unshift(particle);
      rest = rest.slice(0, -particle.length);
      continue;
    }

    if (word !== undefined) {
      suffixes.unshift(word);
      rest = rest.slice(0, -word.length);
      continue;
    }

    break;
  }

  return [rest, ...suffixes];
}

function findParticle(rest: string, allowParticles: boolean): string | undefined {
  // `を` だけは位置を問わず切り出す。現代語では助詞用法しかなく曖昧さが無いので、
  // 「行末か句読点の前だけ」に絞る理由がない(何(なに)+を+学(まな)+... のように
  // 漢字に挟まれた `を` は、セグメントを独立させる以外に書きようがない)
  const candidates = allowParticles ? SUFFIX_PARTICLES : ['を'];
  const particle = candidates.find((p) => rest.endsWith(p));
  if (particle === undefined) {
    return undefined;
  }

  // 直前が撥音・促音なら助詞ではなく活用語尾とみなす。
  // 読(よ)+んで を `yon de` と割らないため(て形・で形の動詞は頻出する)。
  // ただし `を` は活用語尾になり得ないので対象外にする
  // (このガードを当てると「ごはんを」が gohan'o になり、仕様表の「を は常に o」に反する)
  const before = rest.at(-particle.length - 1);
  if (particle !== 'を' && (before === HATSUON || before === SOKUON)) {
    return undefined;
  }

  return particle;
}

/**
 * 語中に残った全角記号を置き換える。
 *
 * `すみません、かばんが` のように読みの途中に句読点があると、
 * 語の前後を剥がすだけでは取り切れない。
 */
function replaceRemainingPunctuation(text: string): string {
  return [...text]
    .map((char) => {
      const mapped = PUNCTUATION[char];
      if (mapped === undefined) {
        return char;
      }
      // 置き換えた記号の後ろは語の切れ目なので空白を入れる(後段で整える)
      return mapped === '' ? '' : `${mapped} `;
    })
    .join('');
}

/** 空白と句読点の位置を整え、文頭を大文字にする */
function tidy(text: string): string {
  const spaced = text
    .replace(/\s+([.,?!])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return capitalizeSentences(spaced);
}

/** 行頭と `.` `?` `!` の直後を大文字にする。固有名詞は判定しない */
function capitalizeSentences(text: string): string {
  return text.replace(/(^|[.?!]\s+)(\p{Ll})/gu, (_match, prefix: string, letter: string) => {
    return prefix + letter.toUpperCase();
  });
}
