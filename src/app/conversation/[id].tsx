import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getSentence, listKanji } from '@/db';
import { ConversationView } from '@/features/reading';
import { completeLesson } from '@/features/srs';
import { useTheme } from '@/theme';

/** 会話文1本の画面。ルーティングと DB の読み出しだけを持つ。 */
export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  // useLocalSearchParams は同名パラメータが複数あると配列を返す。
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [sentence] = useState(() => (id === undefined ? null : getSentence(id)));
  // 新出漢字だけでなく、第2段階で読みが変わる字も引けるように全件渡す。
  // 50字なので一覧で持って困る量ではない。
  const [kanji] = useState(() => listKanji());

  const back = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (sentence === null) {
    return <NotFound onBack={back} />;
  }

  const newKanjiId = sentence.newKanjiId;

  /**
   * 読み終えたあとの続き。
   *
   * 新出字がある回は漢字フォーカス画面へ送り、**完了の記録はあちらの CTA で行う**
   * (会話文を読んだだけで学んだことにしない)。第2段階専用の回はフォーカスする字が
   * 無いので、ここで記録して入口に戻す。
   */
  const onContinue =
    newKanjiId === null
      ? () => {
          completeLesson({ sentenceId: sentence.id, kanjiId: null });

          // `replace('/')` にしない。会話文の画面を入口に**差し替える**ので
          // スタックが [入口, 入口] になり、繰り返すたびに1段積み上がる。
          // 新出字のある経路(`kanji/[id].tsx`)と同じ畳み方に揃える。
          if (router.canDismiss()) {
            router.dismissAll();
          } else {
            router.replace('/');
          }
        }
      : () =>
          router.push({
            pathname: '/kanji/[id]',
            // どの回の学習として開いたかを渡す。フォーカス画面は
            // このパラメータがあるときだけ完了 CTA を出す。
            params: { id: newKanjiId, lesson: sentence.id },
          });

  return (
    <ConversationView sentence={sentence} kanji={kanji} onBack={back} onContinue={onContinue} />
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Text style={{ color: theme.text, fontSize: 15 }}>Conversation not found.</Text>
      <Pressable onPress={onBack} accessibilityRole="button" hitSlop={12}>
        <Text style={{ color: theme.accent, fontSize: 14 }}>Back</Text>
      </Pressable>
    </View>
  );
}
