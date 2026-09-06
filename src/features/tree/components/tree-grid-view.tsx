/**
 * 漢字一覧グリッド(要件定義書 4.5「構造」)。進捗画面を兼ねる(5.1-7)。
 *
 * 並ぶのは**学習済みの字だけ**(`buildTreeIndex()` が絞る)。未学習ぶんは字を見せず
 * 件数だけ出す。ロックされた章の字はここに現れないので、課金判定はこの画面に無い。
 *
 * 開発用の `src/features/reading/kanji-list.tsx`(全50字の検品用)とは別物。
 * 共有しているのは `KanjiIllustration` だけ。
 */

import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { KanjiEntry } from '@/content/types';
import { KanjiIllustration } from '@/features/reading';
import type { TreeIndex, TreeSummary } from '@/features/tree/tree';
import { useTheme } from '@/theme';

const COLUMNS = 3;
const H_PADDING = 16;
const GAP = 10;

interface TreeGridViewProps {
  index: TreeIndex;
  /** 全50字。未学習の件数を出すのに使う */
  totalKanjiCount: number;
  onSelect: (kanjiId: string) => void;
  onBack: () => void;
}

export function TreeGridView({ index, totalKanjiCount, onSelect, onBack }: TreeGridViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // 割り算にしているのは、gap を挟んだ % 指定が端数で3列目を落とすため(`kanji-list.tsx`)
  const cellWidth = (width - H_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const remaining = Math.max(0, totalKanjiCount - index.met.length);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={12}>
          {({ pressed }) => (
            <Text style={[styles.backLabel, { color: theme.accent, opacity: pressed ? 0.6 : 1 }]}>
              Back
            </Text>
          )}
        </Pressable>
        <Text
          style={{
            fontFamily: theme.type.mincho,
            fontSize: 13,
            letterSpacing: 0.78,
            color: theme.text,
            opacity: 0.78,
          }}
        >
          Kanji tree
        </Text>
      </View>

      {index.met.length === 0 ? (
        <Text style={[styles.notice, { color: theme.textMuted }]}>
          You haven&apos;t met any kanji yet.
        </Text>
      ) : (
        <View style={styles.grid}>
          {index.met.map((entry) => (
            <Cell
              key={entry.id}
              kanji={entry}
              summary={index.summaries.get(entry.id) ?? { encounteredCount: 0, totalCount: 0 }}
              width={cellWidth}
              onPress={() => onSelect(entry.id)}
            />
          ))}
        </View>
      )}

      {remaining > 0 ? (
        <Text style={[styles.notice, { color: theme.textMuted }]}>
          {`${remaining} more ${remaining === 1 ? 'kanji is' : 'kanji are'} waiting to be met.`}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function Cell({
  kanji,
  summary,
  width,
  onPress,
}: {
  kanji: KanjiEntry;
  summary: TreeSummary;
  width: number;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${kanji.character} — ${kanji.meaning}, ${summary.encounteredCount} of ${summary.totalCount} words met`}
      style={({ pressed }) => [
        styles.cell,
        {
          width,
          backgroundColor: theme.surfaceVeil,
          borderColor: theme.border,
          borderRadius: theme.radius.card,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <KanjiIllustration illustrationKey={kanji.illustrationKey} size={width - 24} />
      <Text
        style={{ fontFamily: theme.type.minchoBold, fontSize: 22, color: theme.accent }}
        accessibilityLanguage="ja-JP"
      >
        {kanji.character}
      </Text>
      <Text style={[styles.meaning, { color: theme.text }]} numberOfLines={1}>
        {kanji.meaning}
      </Text>
      {/* 「出会った語数 / 総語数」のバッジ(要件4.5)。全部出会えたら強調色に */}
      <View
        style={[
          styles.badge,
          {
            borderRadius: theme.radius.pill,
            backgroundColor:
              summary.totalCount > 0 && summary.encounteredCount === summary.totalCount
                ? theme.accent
                : theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <Text
          style={[
            styles.badgeLabel,
            {
              color:
                summary.totalCount > 0 && summary.encounteredCount === summary.totalCount
                  ? theme.onAccent
                  : theme.textMuted,
            },
          ]}
        >
          {`${summary.encounteredCount}/${summary.totalCount}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: H_PADDING,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backLabel: {
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1,
  },
  meaning: {
    fontSize: 12,
    textAlign: 'center',
  },
  badge: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  badgeLabel: {
    fontSize: 11,
  },
  notice: {
    fontSize: 14,
  },
});
