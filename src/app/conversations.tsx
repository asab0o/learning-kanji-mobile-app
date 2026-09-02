import { useState } from 'react';
import { useRouter } from 'expo-router';

import { listKanji, listSentences } from '@/db';
import { ConversationList } from '@/features/reading';

/**
 * 開発用の会話文一覧。**本番の導線からは辿れない。**
 *
 * 入口画面が「今日の学習」になり、1日3字の上限が掛かったので、
 * 任意の回をすぐ開く手段が無くなった。第4章17文の検品と、
 * 演出・折り返しの実機確認に要るので残している。
 * `learningkanjimobileapp://conversations` で直接開く(`paywall-debug` と同じ作り)。
 */
export default function ConversationsScreen() {
  const router = useRouter();
  const [sentences] = useState(() => (__DEV__ ? listSentences() : []));
  const [kanji] = useState(() => (__DEV__ ? listKanji() : []));

  if (!__DEV__) {
    return null;
  }

  return (
    <ConversationList
      sentences={sentences}
      kanji={kanji}
      onSelect={(id) => router.push({ pathname: '/conversation/[id]', params: { id } })}
    />
  );
}
