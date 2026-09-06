import { useState } from 'react';
import { useRouter } from 'expo-router';

import { listKanji } from '@/db';
import { KanjiList } from '@/features/reading';

/**
 * 開発用の漢字一覧。**本番の導線からは辿れない。**
 *
 * 50字のイラストを1画面で見比べるための検品用。deep link で直接開く
 * (`learningkanjimobileapp://kanji-list`)。`conversations` と同じ作り。
 */
export default function KanjiListScreen() {
  const router = useRouter();
  const [kanji] = useState(() => (__DEV__ ? listKanji() : []));

  if (!__DEV__) {
    return null;
  }

  return (
    <KanjiList
      kanji={kanji}
      onSelect={(id) => router.push({ pathname: '/kanji/[id]', params: { id } })}
    />
  );
}
