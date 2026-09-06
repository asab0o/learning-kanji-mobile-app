/**
 * 漢字の一覧。
 *
 * **開発用。** 50字のイラストと意味を1画面に並べて、検品を目でまとめて済ませるためのもの。
 * `src/app/kanji-list.tsx` からだけ開く(`conversations` と同じ作り)。作り込まない。
 *
 * **課金ゲートを掛けていない。** 一覧だけ絞られない `ConversationList` とは非対称だが、
 * これは開いた先の `src/app/kanji/[id].tsx` が entitlement を見ていないため。
 * 会話文と違って漢字フォーカス画面には元からゲートが無いので、一覧をそちらに揃えている
 * (第2章以降の字を見るのに Test Store での購入が要らないのはこの理由)。
 *
 * イラストが未投入の字は `KanjiIllustration` のプレースホルダ(破線 + `illustrationKey`)に
 * 落ちるので、残りが何字でどれかはこの一覧を見れば分かる。
 */

import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChapterNumber, KanjiEntry } from '@/content/types';
import { KanjiIllustration } from '@/features/reading/kanji-illustration';
import { useTheme } from '@/theme';

const COLUMNS = 3;
const H_PADDING = 16;
const GAP = 10;

interface KanjiListProps {
  kanji: KanjiEntry[];
  onSelect: (kanjiId: string) => void;
}

export function KanjiList({ kanji, onSelect }: KanjiListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 回転しても崩れないように、幅は毎回ウィンドウから割り出す。
  // 割り算にしているのは、gap を挟んだ % 指定が端数で3列目を落とすため。
  const { width } = useWindowDimensions();
  const cellWidth = (width - H_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

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
        Kanji
      </Text>

      {kanji.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>No kanji yet.</Text>
      ) : (
        groupByChapter(kanji).map(([chapter, entries]) => (
          <View key={chapter} style={styles.section}>
            <Text style={[styles.chapter, { color: theme.textMuted }]}>
              Chapter {chapter} · {entries.length}
            </Text>
            <View style={styles.grid}>
              {entries.map((entry) => (
                <Cell
                  key={entry.id}
                  kanji={entry}
                  width={cellWidth}
                  onPress={() => onSelect(entry.id)}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

/**
 * 章ごとに切る。入力は学習順に並んでいる前提で、その順を保つ
 * (`listKanji()` が `orderIndex` 昇順で返す)。
 */
function groupByChapter(kanji: KanjiEntry[]): [ChapterNumber, KanjiEntry[]][] {
  const groups: [ChapterNumber, KanjiEntry[]][] = [];

  for (const entry of kanji) {
    const last = groups.at(-1);

    if (last !== undefined && last[0] === entry.chapter) {
      last[1].push(entry);
    } else {
      groups.push([entry.chapter, [entry]]);
    }
  }

  return groups;
}

function Cell({
  kanji,
  width,
  onPress,
}: {
  kanji: KanjiEntry;
  width: number;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${kanji.character} — ${kanji.meaning}`}
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
      <View style={styles.caption}>
        <Text style={[styles.order, { color: theme.textMuted }]}>{kanji.order}</Text>
        <Text style={{ fontFamily: theme.type.minchoBold, fontSize: 20, color: theme.accent }}>
          {kanji.character}
        </Text>
      </View>
      <Text style={[styles.meaning, { color: theme.text }]} numberOfLines={2}>
        {kanji.meaning}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: H_PADDING,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  chapter: {
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  order: {
    fontSize: 11,
  },
  meaning: {
    fontSize: 12,
    textAlign: 'center',
  },
  empty: {
    fontSize: 14,
  },
});
