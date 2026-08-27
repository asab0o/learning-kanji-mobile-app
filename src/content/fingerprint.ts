/**
 * コンテンツの内容そのものから決まる指紋。
 *
 * 起動のたびにこの値を計算し、DB に記録された値と違えばコンテンツ系テーブルを
 * 入れ替える(`@/db/seed`)。
 *
 * アプリのバージョン(`app.json` の `version`)ではなく内容を見るのは、
 * 開発中に会話文を1文足してもバージョンは上がらず、再シードが走らないため。
 * バージョン方式だと「データを直したのに画面に出ない」が毎回起きる。
 */

import type { ContentSet } from '@/content/types';

/** FNV-1a 32bit の初期値と素数 */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * コンテンツ一式の指紋を返す。
 *
 * 暗号学的な強度は要らない(攻撃者ではなく自分の編集を検出するため)ので、
 * 依存を増やさずに済む FNV-1a を使う。
 * 衝突時の被害は「再シードされない」だけで、コンテンツを1文字変えれば必ず値が変わる。
 */
export function contentFingerprint(content: ContentSet): string {
  const counts = `${content.kanji.length}.${content.words.length}.${content.sentences.length}`;
  const hash = fnv1a(stableStringify(content));

  return `${counts}-${hash}`;
}

function fnv1a(input: string): string {
  let hash = FNV_OFFSET_BASIS;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32bit 幅の乗算。`*` だと倍精度になって桁が落ちる
    hash = Math.imul(hash, FNV_PRIME);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * キーの順序に依存しない JSON 文字列化。
 *
 * 素の `JSON.stringify` はオブジェクトのキーを定義順に出すため、
 * 内容が同じでもキーの並びを書き換えただけで指紋が変わってしまう。
 * 実害は「不要な再シードが1回走る」だけだが、
 * 「指紋が変わった = 内容が変わった」と言い切れる方が後から追いやすい。
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);

  return `{${entries.join(',')}}`;
}
