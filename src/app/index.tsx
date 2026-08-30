import { useState } from 'react';
import { useRouter } from 'expo-router';

import { listKanji, listSentences } from '@/db';
import { ConversationList } from '@/features/reading';

/**
 * 入口画面。会話文の一覧を出す。
 *
 * **暫定**。SRS が入ると「今日の学習(1日3字)」に置き換わる
 * (docs/plans/conversation-screen.md)。
 */
export default function HomeScreen() {
  const router = useRouter();
  // 描画の中で直接クエリを呼ぶと React Compiler にメモ化されるので、
  // 遅延初期化で1回だけ読む。
  const [sentences] = useState(() => listSentences());
  const [kanji] = useState(() => listKanji());

  return (
    <ConversationList
      sentences={sentences}
      kanji={kanji}
      onSelect={(id) => router.push({ pathname: '/conversation/[id]', params: { id } })}
    />
  );
}
