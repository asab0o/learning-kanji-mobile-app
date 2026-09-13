import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getKanji } from '@/db';
import { loadQuizInput, pickQuizItem } from '@/features/quiz';
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
   * **今学んだ字を含む語が無ければ、クイズを開かずに Today へ戻す。** 別の字の語で
   * 埋めると `食` の回に `日本語` が出るように唐突に見える(2026-09-13 の実機報告。
   * docs/plans/quiz-and-review-repeats.md)。判定をクイズ画面ではなくここでするのは、
   * クイズ画面が一瞬映ってから畳まれるちらつきを避けるため。
   * クイズ画面は同じ `loadQuizInput` から選び直すので、ここで出せるならあちらでも出せる。
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
          // 先に書く。今学んだ字が既習に入っていないと、下の判定で候補に上がらない
          completeLesson({ sentenceId: lessonSentenceId, kanjiId: kanji.id });

          const quizItem = pickQuizItem(
            loadQuizInput({ slot: 'lesson', focusKanjiId: kanji.id, now: Date.now() })
          );

          if (quizItem === null) {
            // 会話文 → 漢字フォーカスと積まれているので、まとめて畳む(`quiz.tsx` の `done` と同じ)
            if (router.canDismiss()) {
              router.dismissAll();
            } else {
              router.replace('/');
            }

            return;
          }

          // **今学んだ字を渡す。** 渡さないとクイズ画面は出題しない
          // (`features/quiz/selection.ts` の `focusKanjiId`)
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
