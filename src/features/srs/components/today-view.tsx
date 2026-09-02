/**
 * 入口画面「今日の学習」(要件定義書 4.1 / 5.1-8)。
 *
 * 出すのは**今日ぶんだけ**。全58文を並べると「1日3字」の意味が伝わらず、
 * 先を読み進める遊びになってしまう(ADR-0003 が防ごうとしているのがそれ)。
 *
 * 何を出すかは `planTodaysLessons()` が決める。ここは描くだけで、
 * ルーティングも DB も知らない。
 */

import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { KanjiEntry } from '@/content/types';
import type { TodaysLessonItem, TodaysLessons } from '@/features/srs/lessons';
import { useTheme } from '@/theme';

interface TodayViewProps {
  lessons: TodaysLessons;
  /** 新出漢字を引くためのマスタ */
  kanji: KanjiEntry[];
  onSelect: (sentenceId: string) => void;
  /** 開発ビルドの上限解除。`__DEV__` のときだけ渡す */
  ignoreLimit?: boolean;
  onChangeIgnoreLimit?: (value: boolean) => void;
}

export function TodayView({
  lessons,
  kanji,
  onSelect,
  ignoreLimit,
  onChangeIgnoreLimit,
}: TodayViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const kanjiById = new Map(kanji.map((entry) => [entry.id, entry]));
  const pending = lessons.items.filter((item) => !item.done);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <View style={styles.header}>
        <Text
          style={{
            fontFamily: theme.type.mincho,
            fontSize: 13,
            letterSpacing: 0.78,
            color: theme.text,
            opacity: 0.78,
          }}
        >
          Today
        </Text>
        {/*
          上限を外している間は「n of 3」が嘘になるので出さない。
          Infinity を数字として描かないための分岐でもある。
        */}
        {Number.isFinite(lessons.remaining) ? (
          <Text style={[styles.progress, { color: theme.textMuted }]}>
            {`${lessons.learnedToday} of ${lessons.learnedToday + lessons.remaining} kanji today`}
          </Text>
        ) : null}
      </View>

      {lessons.items.length === 0 ? null : (
        <View style={styles.rows}>
          {lessons.items.map((item) => (
            <Row
              key={item.sentence.id}
              item={item}
              newKanji={
                item.sentence.newKanjiId === null
                  ? null
                  : (kanjiById.get(item.sentence.newKanjiId) ?? null)
              }
              onPress={() => onSelect(item.sentence.id)}
            />
          ))}
        </View>
      )}

      {/*
        未完了が無いときに出す一言。今日ぶんを終えた直後はカードが残ったままなので、
        「カードが消える」ことではなく**この一文**が終わりの合図になる。
        カードを消さないのは、今日やったことが見えているほうが続くため。
      */}
      {pending.length === 0 ? <Notice lessons={lessons} hasKanji={kanji.length > 0} /> : null}

      {onChangeIgnoreLimit === undefined ? null : (
        <View style={styles.debugRow}>
          <Text style={[styles.debugLabel, { color: theme.textMuted }]}>Ignore daily limit</Text>
          <Switch
            value={ignoreLimit ?? false}
            onValueChange={onChangeIgnoreLimit}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={theme.surface}
            ios_backgroundColor={theme.border}
            accessibilityLabel="Ignore daily limit"
          />
        </View>
      )}
    </ScrollView>
  );
}

function Row({
  item,
  newKanji,
  onPress,
}: {
  item: TodaysLessonItem;
  newKanji: KanjiEntry | null;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: item.done }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.surfaceVeil,
          borderColor: theme.border,
          borderRadius: theme.radius.card,
          // 終えた回は沈める。消さないのは、今日やったことが見えているほうが続くため
          opacity: pressed ? 0.6 : item.done ? 0.55 : 1,
        },
      ]}
    >
      {/*
        分岐は `newKanjiId`(生のID)で行う。引けた実体で分けると、ID はあるのに
        マスタから引けなかった回が「第2段階の回」と同じ見た目になり、実機で気づけない。
        引けないこと自体は `validate:content` が防いでいるので、下の fallback は出ない。
      */}
      {item.sentence.newKanjiId === null ? (
        // 第2段階専用の回。新出字が無いので語のほうを見出しにする
        <>
          <Text style={[styles.stageTwo, { color: theme.accent }]} accessibilityLanguage="ja-JP">
            {item.sentence.reencounters[0]?.word ?? '—'}
          </Text>
          <Text style={[styles.meaning, { color: theme.textMuted }]}>A reading changes</Text>
        </>
      ) : (
        <>
          <Text
            style={{ fontFamily: theme.type.minchoBold, fontSize: 24, color: theme.accent }}
            accessibilityLanguage="ja-JP"
          >
            {newKanji?.character ?? '?'}
          </Text>
          <Text style={[styles.meaning, { color: theme.text }]}>
            {newKanji?.meaning ?? 'Missing kanji data'}
          </Text>
        </>
      )}

      <Text style={[styles.state, { color: theme.textMuted }]}>{item.done ? 'Done' : ''}</Text>
    </Pressable>
  );
}

function Notice({ lessons, hasKanji }: { lessons: TodaysLessons; hasKanji: boolean }) {
  const theme = useTheme();

  // シード前(コンテンツが1件も無い)を「全部終えた」と言わない
  const message = !hasKanji
    ? 'No conversations yet.'
    : lessons.allDone
      ? "You've finished every conversation for now."
      : "You're done for today. Come back tomorrow.";

  return <Text style={[styles.notice, { color: theme.textMuted }]}>{message}</Text>;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progress: {
    fontSize: 12,
  },
  rows: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
  },
  stageTwo: {
    fontSize: 18,
  },
  meaning: {
    fontSize: 15,
    flexShrink: 1,
  },
  state: {
    marginLeft: 'auto',
    fontSize: 11,
  },
  notice: {
    fontSize: 14,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  debugLabel: {
    fontSize: 11.5,
  },
});
