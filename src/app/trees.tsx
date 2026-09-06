import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { listKanji, listLessonEvents, listWords } from '@/db';
import { buildTreeIndex, TreeGridView } from '@/features/tree';

/**
 * 漢字一覧グリッド(要件定義書 4.5 / 5.1-7)。ルーティングと DB の読み出しだけを持つ。
 *
 * 誰を並べるかは `buildTreeIndex()`(純粋関数)が決める。学習済みの字だけなので、
 * この画面に課金判定は無い(docs/plans/kanji-tree.md 確認点2)。
 */
export default function TreesScreen() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(() => read());

  // 樹 → フォーカス画面 → 戻る、や会話文を終えて戻ったときに葉の数を読み直す
  useFocusEffect(
    useCallback(() => {
      setSnapshot(read());
    }, [])
  );

  const index = buildTreeIndex({
    kanji: snapshot.kanji,
    words: snapshot.words,
    lessons: snapshot.lessons,
  });

  return (
    <TreeGridView
      index={index}
      totalKanjiCount={snapshot.kanji.length}
      onSelect={(id) => router.push({ pathname: '/tree/[id]', params: { id } })}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

function read() {
  return {
    kanji: listKanji(),
    words: listWords(),
    lessons: listLessonEvents(),
  };
}
