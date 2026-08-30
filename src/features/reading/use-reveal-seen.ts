/**
 * 「読みが変わった」演出を、同じ漢字につき1回だけ出すための状態(絶対規則11)。
 *
 * **記録するのはカードを開いた瞬間で、閉じた時ではない。** 閉じる経路が3つ
 * (`Got it` / 暗幕タップ / 画面ごとスワイプで戻る)あるのに対し、開く経路は1つしかない。
 * 見た直後にアプリを強制終了しても「初めて」に戻らないほうが規則の意図に合う。
 */

import { useCallback, useState } from 'react';

import { hasRevealShown, markRevealShown } from '@/db';

interface RevealSeen {
  /** ★を出し、吹き出しを押せるようにしてよいか */
  canShow: boolean;
  /** カードを開いたときに呼ぶ。対象字をすべて記録する */
  markSeen: () => void;
}

/**
 * @param kanjiIds 演出の対象字。第2段階では2字のことがある(時間 = 時 + 間)
 */
export function useRevealSeen(kanjiIds: readonly string[]): RevealSeen {
  // 画面のマウント時に1回だけ読む。描画の中で直接クエリを呼ぶと
  // React Compiler にメモ化され、更新しても表示が古いままになる。
  //
  // 2字同時の回は「カード1枚 = 1単位」として扱う。カードの中身は語の組み立て
  // (とき＋あいだ→じかん)で分割できないので、**どれか1つでも未記録なら出す**。
  const [canShow] = useState(() => kanjiIds.some((id) => !hasRevealShown(id)));

  // 開くたびに呼ばれるが `markRevealShown` は冪等。**`canShow` は落とさない**ので、
  // 同じ画面にいる間は誤って閉じても開き直せる。規則11 が禁じているのは
  // 「毎回勝手に出る」ことで、次にこの回を開いたときはマウント時の読みが false になる。
  const markSeen = useCallback(() => {
    for (const id of kanjiIds) {
      markRevealShown(id);
    }
  }, [kanjiIds]);

  return { canShow, markSeen };
}
