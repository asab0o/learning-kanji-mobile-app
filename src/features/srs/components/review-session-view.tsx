/**
 * 復習セッション(要件定義書 5.1-4 / ADR-0007)。
 *
 * 出すのは**漢字1字と意味の4択だけ**。会話文は再表示しない。答えが本文に
 * 書いてあることになり、推測が成立しなくなるため(ADR-0007)。
 *
 * **自動送りにしない。** 正解でも一度読みを見せる。「読みは変わっても意味の核は同じ」が
 * このアプリの主張なので、当たった瞬間に飛ばすとその1秒が消える。
 *
 * ルーティングも DB も知らない表示専用コンポーネント。
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Reading } from '@/content/types';
import type { ReviewSession } from '@/features/srs/session';
import { useRomajiEnabled } from '@/features/settings';
import { useTheme } from '@/theme';

interface ReviewSessionViewProps {
  session: ReviewSession;
  onSelect: (choice: string) => void;
  onNext: () => void;
  onQuit: () => void;
}

export function ReviewSessionView({ session, onSelect, onNext, onQuit }: ReviewSessionViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { current, answered } = session;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <View style={styles.header}>
        {/* 文字だけだと当たり判定が細いので Pressable で包んで hitSlop を足す */}
        <Pressable onPress={onQuit} accessibilityRole="button" hitSlop={12}>
          {({ pressed }) => (
            <Text style={[styles.backLabel, { color: theme.accent, opacity: pressed ? 0.6 : 1 }]}>
              Back
            </Text>
          )}
        </Pressable>
        <Text style={[styles.progress, { color: theme.textMuted }]}>
          {`${session.answeredCount} / ${session.total}`}
        </Text>
      </View>

      {current === null ? (
        <View style={styles.done}>
          <Text style={[styles.doneLabel, { color: theme.text }]}>All reviews done.</Text>
          <Pressable
            onPress={onQuit}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: theme.accent,
                borderRadius: theme.radius.pill,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.ctaLabel, { color: theme.onAccent }]}>Back to today</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.prompt}>
            <Text
              style={{
                fontFamily: theme.type.minchoBold,
                fontSize: 96,
                lineHeight: 116,
                color: theme.text,
              }}
              accessibilityLanguage="ja-JP"
            >
              {current.kanji.character}
            </Text>
            <Text style={[styles.question, { color: theme.textMuted }]}>What does this mean?</Text>
          </View>

          <View style={styles.choices}>
            {session.choices.map((choice) => (
              <Choice
                key={choice}
                label={choice}
                // 答え合わせ中は色で正誤を示し、押せなくする
                state={
                  answered === null
                    ? 'open'
                    : choice === current.kanji.meaning
                      ? 'correct'
                      : choice === answered.selected
                        ? 'wrong'
                        : 'muted'
                }
                onPress={() => onSelect(choice)}
              />
            ))}
          </View>

          {answered === null ? null : (
            <>
              <View style={styles.readings}>
                {current.kanji.readings.map((reading) => (
                  <ReadingRow key={`${reading.type}-${reading.kana}`} reading={reading} />
                ))}
              </View>

              <Pressable
                onPress={onNext}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: theme.accent,
                    borderRadius: theme.radius.pill,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.ctaLabel, { color: theme.onAccent }]}>Next</Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

type ChoiceState = 'open' | 'correct' | 'wrong' | 'muted';

function Choice({
  label,
  state,
  onPress,
}: {
  label: string;
  state: ChoiceState;
  onPress: () => void;
}) {
  const theme = useTheme();
  const border =
    state === 'correct' ? theme.positive : state === 'wrong' ? theme.negative : theme.border;
  const color =
    state === 'correct' ? theme.positive : state === 'wrong' ? theme.negative : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={state !== 'open'}
      accessibilityRole="button"
      accessibilityState={{ disabled: state !== 'open' }}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: theme.surfaceVeil,
          borderColor: border,
          borderRadius: theme.radius.card,
          opacity: pressed ? 0.6 : state === 'muted' ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.choiceLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** ラベルが `Kun` / `On` なのは絶対規則7(UI文言は英語)。`kanji-focus.tsx` と同じ */
function ReadingRow({ reading }: { reading: Reading }) {
  const theme = useTheme();
  const romajiEnabled = useRomajiEnabled();
  const branch = reading.type === 'kun' ? theme.kunBranch : theme.onBranch;

  return (
    <View style={styles.readingRow}>
      <View style={[styles.badge, { backgroundColor: branch, borderRadius: theme.radius.pill }]}>
        <Text style={[styles.badgeLabel, { color: theme.onAccent }]}>
          {reading.type === 'kun' ? 'Kun' : 'On'}
        </Text>
      </View>
      <Text
        style={{ fontFamily: theme.type.mincho, fontSize: 19, color: theme.text }}
        accessibilityLanguage="ja-JP"
      >
        {reading.kana}
      </Text>
      {romajiEnabled ? (
        <Text style={[styles.romaji, { color: theme.textMuted }]}>{reading.romaji}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backLabel: {
    fontSize: 14,
  },
  progress: {
    fontSize: 12,
  },
  prompt: {
    alignItems: 'center',
    gap: 4,
  },
  question: {
    fontSize: 13,
  },
  choices: {
    gap: 10,
  },
  choice: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
  },
  choiceLabel: {
    fontSize: 15,
  },
  readings: {
    gap: 10,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 44,
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  romaji: {
    fontSize: 12,
  },
  done: {
    alignItems: 'center',
    gap: 20,
    paddingTop: 40,
  },
  doneLabel: {
    fontSize: 17,
  },
  cta: {
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  ctaLabel: {
    fontSize: 15,
  },
});
