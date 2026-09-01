/**
 * 会話文の一覧。
 *
 * **開発用。** 入口画面は「今日の学習」(`@/features/srs` の `TodayView`)に置き換わり、
 * これは `src/app/conversations.tsx` からだけ開く画面になった
 * (docs/plans/srs-lessons.md)。1日3字の上限を跨いで任意の回をすぐ開けるので、
 * 会話文の検品と、演出・折り返しの実機確認に使う。作り込まない。
 *
 * 課金判定はまだ無いので `isFree` を読んでいない。章のロックは paywall の回の担当。
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { KanjiEntry, Sentence } from '@/content/types';
import { useTheme } from '@/theme';

interface ConversationListProps {
  sentences: Sentence[];
  kanji: KanjiEntry[];
  onSelect: (sentenceId: string) => void;
}

export function ConversationList({ sentences, kanji, onSelect }: ConversationListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const kanjiById = new Map(kanji.map((entry) => [entry.id, entry]));

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <Text
        style={{
          fontFamily: theme.type.mincho,
          fontSize: 13,
          letterSpacing: 0.78,
          color: theme.text,
          opacity: 0.78,
        }}
      >
        Conversations
      </Text>

      {sentences.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>No conversations yet.</Text>
      ) : (
        <View style={styles.rows}>
          {[...sentences]
            .sort((a, b) => a.order - b.order)
            .map((sentence) => (
              <Row
                key={sentence.id}
                sentence={sentence}
                newKanji={
                  sentence.newKanjiId === null ? null : (kanjiById.get(sentence.newKanjiId) ?? null)
                }
                onPress={() => onSelect(sentence.id)}
              />
            ))}
        </View>
      )}
    </ScrollView>
  );
}

function Row({
  sentence,
  newKanji,
  onPress,
}: {
  sentence: Sentence;
  newKanji: KanjiEntry | null;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.surfaceVeil,
          borderColor: theme.border,
          borderRadius: theme.radius.card,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[styles.order, { color: theme.textMuted }]}>{sentence.order}</Text>
      {newKanji === null ? (
        // 第2段階専用の回。新出字が無いので語のほうを見出しにする
        <Text style={[styles.meaning, { color: theme.textMuted }]}>
          {sentence.reencounters[0]?.word ?? '—'}
        </Text>
      ) : (
        <>
          <Text style={{ fontFamily: theme.type.minchoBold, fontSize: 17, color: theme.accent }}>
            {newKanji.character}
          </Text>
          <Text style={[styles.meaning, { color: theme.text }]}>{newKanji.meaning}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  rows: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  order: {
    fontSize: 12,
    minWidth: 18,
  },
  meaning: {
    fontSize: 14,
    flexShrink: 1,
  },
  empty: {
    fontSize: 14,
  },
});
