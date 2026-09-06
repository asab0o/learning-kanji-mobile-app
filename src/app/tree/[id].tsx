import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { getKanji, listLessonEvents, listWordsByKanji } from '@/db';
import { buildKanjiTree, KanjiTreeView } from '@/features/tree';
import { useTheme } from '@/theme';

/**
 * 1字の樹(要件定義書 4.5)。ルーティングと DB の読み出しだけを持つ。
 *
 * 「見るだけ」で漢字フォーカス画面へ渡す。`lesson` パラメータを付けないので
 * 向こうで完了 CTA は出ない(`src/app/kanji/[id].tsx`)。
 */
export default function TreeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [kanji] = useState(() => (id === undefined ? null : getKanji(id)));
  const [snapshot, setSnapshot] = useState(() => read(kanji?.id));

  // フォーカス画面から戻ったときや、会話文を終えて戻ったときに葉を読み直す
  useFocusEffect(
    useCallback(() => {
      setSnapshot(read(kanji?.id));
    }, [kanji?.id])
  );

  const back = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/trees');
    }
  };

  if (kanji === null) {
    return <NotFound onBack={back} />;
  }

  const tree = buildKanjiTree({ kanji, words: snapshot.words, lessons: snapshot.lessons });

  return (
    <KanjiTreeView
      tree={tree}
      onBack={back}
      onOpenKanji={() => router.push({ pathname: '/kanji/[id]', params: { id: kanji.id } })}
    />
  );
}

function read(kanjiId: string | undefined) {
  return {
    words: kanjiId === undefined ? [] : listWordsByKanji(kanjiId),
    lessons: listLessonEvents(),
  };
}

function NotFound({ onBack }: { onBack: () => void }) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Text style={{ color: theme.text, fontSize: 15 }}>Kanji not found.</Text>
      <Pressable onPress={onBack} accessibilityRole="button" hitSlop={12}>
        <Text style={{ color: theme.accent, fontSize: 14 }}>Back</Text>
      </Pressable>
    </View>
  );
}
