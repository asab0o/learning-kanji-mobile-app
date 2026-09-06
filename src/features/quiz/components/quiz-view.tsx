/**
 * 推測クイズ「読めるかな?」(要件定義書 4.4 / 5.1-6)。
 *
 * **2段構え。** まず漢字だけを見せて考える時間を作り、押して初めて4択を出す。
 * ふりがなも英訳も第1段では出さない(出したら推測が成立しない)。
 *
 * **答え合わせの種明かしがこの機能の主役。** 「人 = person」「間 = space between」を
 * 1行ずつ並べて、そこから `human being` が出てくるのを見せる。ここで毎回
 * 「漢字が意味の核である」を体感させる。
 *
 * **スコアを一切出さない。** 正答率も連続日数も `n / m` の進捗も無い。
 * 「ご褒美体験であり成績ではない」(要件定義書 4.4)を UI の事実として表す。
 * 復習セッション(`review-session-view.tsx`)が進捗を出しているのと対照的なのは意図的。
 *
 * ルーティングも DB も知らない表示専用コンポーネント。
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import type { QuizComponent, QuizItem } from '@/features/quiz/types';

interface QuizViewProps {
  /** 出題できる語が無ければ null */
  item: QuizItem | null;
  /** 選んだ選択肢。未回答なら null */
  selected: string | null;
  choices: string[];
  /** 第1段(漢字だけ)から第2段(4択)へ進んだか */
  choicesShown: boolean;
  onShowChoices: () => void;
  onSelect: (choice: string) => void;
  onDone: () => void;
}

export function QuizView({
  item,
  selected,
  choices,
  choicesShown,
  onShowChoices,
  onSelect,
  onDone,
}: QuizViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
      ]}
    >
      {/* 文字だけだと当たり判定が細いので Pressable で包んで hitSlop を足す
          (`review-session-view.tsx` と同じ) */}
      <View style={styles.header}>
        <Pressable onPress={onDone} accessibilityRole="button" hitSlop={12}>
          {({ pressed }) => (
            <Text style={[styles.backLabel, { color: theme.accent, opacity: pressed ? 0.6 : 1 }]}>
              Back
            </Text>
          )}
        </Pressable>
      </View>

      {item === null ? (
        <Empty onDone={onDone} />
      ) : (
        <>
          <View style={styles.prompt}>
            <Text
              style={{
                fontFamily: theme.type.minchoBold,
                fontSize: 72,
                lineHeight: 92,
                color: theme.text,
              }}
              accessibilityLanguage="ja-JP"
            >
              {item.surface}
            </Text>
            <Text style={[styles.question, { color: theme.textMuted }]}>
              Can you guess what this means?
            </Text>
          </View>

          {choicesShown ? (
            <View style={styles.choices}>
              {choices.map((choice) => (
                <Choice
                  key={choice}
                  label={choice}
                  state={
                    selected === null
                      ? 'open'
                      : choice === item.meaning
                        ? 'correct'
                        : choice === selected
                          ? 'wrong'
                          : 'muted'
                  }
                  onPress={() => onSelect(choice)}
                />
              ))}
            </View>
          ) : (
            <Pressable
              onPress={onShowChoices}
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
              <Text style={[styles.ctaLabel, { color: theme.onAccent }]}>Show choices</Text>
            </Pressable>
          )}

          {selected === null ? null : (
            <>
              <Reveal item={item} />

              <Pressable
                onPress={onDone}
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
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

/**
 * 種明かし。**この機能の主役**(要件定義書 4.4-3)。
 *
 * 読みは**かなだけ**。ローマ字は出さない(`src/content/romaji.ts` は執筆時専用の道具で、
 * 実行時に呼ぶものではない。`docs/plans/guess-quiz.md` の「リスク・未確定事項」)。
 */
function Reveal({ item }: { item: QuizItem }) {
  const theme = useTheme();

  return (
    <View style={[styles.reveal, { borderColor: theme.border, borderRadius: theme.radius.card }]}>
      <Text
        style={{ fontFamily: theme.type.mincho, fontSize: 19, color: theme.textMuted }}
        accessibilityLanguage="ja-JP"
      >
        {item.kana}
      </Text>

      <View style={styles.components}>
        {item.components.map((component, index) => (
          <ComponentRow
            // 同じ字が2回出る語(日曜日 など)があるので index を混ぜて鍵を一意にする
            key={`${component.character}-${index}`}
            component={component}
          />
        ))}
      </View>

      <Text style={[styles.result, { color: theme.text }]}>{`→ ${item.meaning}`}</Text>
    </View>
  );
}

/** 「人  person」の1行。未習の字は薄くする(既習の字が効いたことを見せたいため) */
function ComponentRow({ component }: { component: QuizComponent }) {
  const theme = useTheme();

  return (
    <View style={[styles.componentRow, { opacity: component.learned ? 1 : 0.55 }]}>
      <Text
        style={{ fontFamily: theme.type.minchoBold, fontSize: 26, color: theme.text }}
        accessibilityLanguage="ja-JP"
      >
        {component.character}
      </Text>
      <Text style={[styles.componentMeaning, { color: theme.text }]}>{component.meaning}</Text>
    </View>
  );
}

/**
 * 出題できる語が無いとき。
 *
 * 候補は最大19語しかないので、進むほどここに来やすくなる。**空の4択やスコアを出さない。**
 */
function Empty({ onDone }: { onDone: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyLabel, { color: theme.text }]}>
        Nothing new to guess right now.
      </Text>
      <Pressable
        onPress={onDone}
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
  );
}

type ChoiceState = 'open' | 'correct' | 'wrong' | 'muted';

/** `review-session-view.tsx` の Choice と同じ見た目にそろえる(学習者には同じ「4択」) */
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
  prompt: {
    alignItems: 'center',
    gap: 8,
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
  reveal: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  components: {
    gap: 8,
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  componentMeaning: {
    fontSize: 15,
  },
  result: {
    fontSize: 17,
  },
  empty: {
    alignItems: 'center',
    gap: 20,
    paddingTop: 40,
  },
  emptyLabel: {
    fontSize: 15,
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
