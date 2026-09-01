import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getKanji } from '@/db';
import { KanjiFocus } from '@/features/reading';
import { completeLesson } from '@/features/srs';
import { useTheme } from '@/theme';

/**
 * 漢字フォーカス画面。ルーティングと DB の読み出しだけを持つ。
 *
 * `lesson` にその回の会話文 ID が入っているときだけ「学習として開いた」と見なし、
 * 完了 CTA を出す。無いときは表示だけ(漢字の樹から開く経路が後から乗る)。
 */
export default function KanjiScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; lesson?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const lessonSentenceId = Array.isArray(params.lesson) ? params.lesson[0] : params.lesson;

  const [kanji] = useState(() => (id === undefined ? null : getKanji(id)));

  const back = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (kanji === null) {
    return <NotFound onBack={back} />;
  }

  /**
   * 学習を終えて入口に戻る。
   *
   * `back()` にしないのは、間に会話文の画面が挟まっているため。1枚ずつ戻すと
   * 終えたばかりの回をもう一度見せることになるので、積んだぶんをまとめて畳む。
   */
  const complete =
    lessonSentenceId === undefined
      ? undefined
      : () => {
          completeLesson({ sentenceId: lessonSentenceId, kanjiId: kanji.id });

          if (router.canDismiss()) {
            router.dismissAll();
          } else {
            router.replace('/');
          }
        };

  return <KanjiFocus kanji={kanji} onBack={back} onComplete={complete} />;
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
