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
   * 学習を終えて推測クイズへ送る(要件定義書 4.4「学習直後」)。
   *
   * `push` ではなく `replace` にするのは、クイズで `Back` を押したときに、
   * 終えたばかりの漢字フォーカスへ戻さないため。入口まで畳む処理はクイズ画面が持つ
   * (`src/app/quiz.tsx` の `done`。間に会話文が挟まっているので1枚ずつは戻さない)。
   *
   * **クイズは SRS に何も足さない**(絶対規則10)。復習キューへの登録は直前の
   * `completeLesson()` で済んでいて、この先のクイズの正誤は出題日に影響しない。
   */
  const complete =
    lessonSentenceId === undefined
      ? undefined
      : () => {
          completeLesson({ sentenceId: lessonSentenceId, kanjiId: kanji.id });

          // **今学んだ字を渡す。** 渡さないとクイズは「その日に学んだ字」までしか
          // 絞れず、1日3字learnedのうち別の字の語が出て唐突に見える
          // (`features/quiz/selection.ts` の `preferForSlot`)
          router.replace(`/quiz?slot=lesson&kanji=${kanji.id}`);
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
