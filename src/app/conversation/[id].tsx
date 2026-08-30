import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getKanji, getSentence } from '@/db';
import { ConversationView } from '@/features/reading';
import { useTheme } from '@/theme';

/** 会話文1本の画面。ルーティングと DB の読み出しだけを持つ。 */
export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  // useLocalSearchParams は同名パラメータが複数あると配列を返す。
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [sentence] = useState(() => (id === undefined ? null : getSentence(id)));
  const [newKanji] = useState(() =>
    sentence === null || sentence.newKanjiId === null ? null : getKanji(sentence.newKanjiId)
  );

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

  return <ConversationView sentence={sentence} newKanji={newKanji} onBack={back} />;
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
