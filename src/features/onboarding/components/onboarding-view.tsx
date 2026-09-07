/**
 * 初回オンボーディング(要件定義書 5.1-10)。
 *
 * **3画面を強制しない。** 1・2画面目には常に Skip があり、1回押すだけで入口画面に着く。
 * 最終画面で Skip を出さないのは、主CTA の `Start learning` が同じ行き先だから
 * (同じことをする導線を2つ並べない)。
 *
 * **ページャもアニメーションも使わない**(docs/plans/onboarding.md スコープ外)。
 * 進むのは画面ローカルの `step` だけで、`Back` はルーターを触らずこの state を戻す。
 * ルーティングも DB も知らない表示専用コンポーネント。
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CharacterId } from '@/content/types';
import { ONBOARDING_STEPS, type OnboardingSample } from '@/features/onboarding/steps';
// バレル(`@/features/reading`)は conversation-view 経由で `@/db` に到達し、
// `@/db/client` は import しただけで SQLite を開く。20行目の lessons と同じ理由で深く取る
import { CharacterAvatar } from '@/features/reading/character-avatar';
import { DAILY_NEW_KANJI_LIMIT } from '@/features/srs/lessons';
import { useTheme } from '@/theme';

/** 1画面目に並べる話者。会話文の3人(要件定義書 4.3) */
const CAST: readonly CharacterId[] = ['mia', 'grandma', 'sora'];

const AVATAR_SIZE = 56;

interface OnboardingViewProps {
  /** Skip でも Start learning でも、抜けるときは同じ経路を通る */
  onDone: () => void;
}

export function OnboardingView({ onDone }: OnboardingViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  const step = ONBOARDING_STEPS[index];
  const isLast = index === ONBOARDING_STEPS.length - 1;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <View style={styles.header}>
        <Dots count={ONBOARDING_STEPS.length} current={index} />

        {/* 文字だけだと当たり判定が細いので hitSlop を足す(`quiz-view.tsx` と同じ) */}
        {isLast ? null : (
          <Pressable onPress={onDone} accessibilityRole="button" hitSlop={12}>
            {({ pressed }) => (
              <Text style={[styles.skipLabel, { color: theme.accent, opacity: pressed ? 0.6 : 1 }]}>
                Skip
              </Text>
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.figure}>
        {step.id === 'meet' ? <Cast /> : null}
        {step.id === 'review' ? <DailyLimit /> : null}
        {step.sample === undefined ? null : <ReadingShift sample={step.sample} />}
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]}>{step.title}</Text>
        <Text style={[styles.body, { color: theme.textMuted }]}>{step.body}</Text>
      </View>

      {/* **Back は CTA の上に置く。** 主CTA を画面の最下端に残したいのと、
          下に置くとホームインジケータの帯と重なって押しにくくなるため */}
      <View style={styles.actions}>
        {index === 0 ? null : (
          <Pressable onPress={() => setIndex(index - 1)} accessibilityRole="button" hitSlop={12}>
            {({ pressed }) => (
              <Text
                style={[styles.backLabel, { color: theme.textMuted, opacity: pressed ? 0.6 : 1 }]}
              >
                Back
              </Text>
            )}
          </Pressable>
        )}

        <Pressable
          onPress={() => (isLast ? onDone() : setIndex(index + 1))}
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
          <Text style={[styles.ctaLabel, { color: theme.onAccent }]}>
            {isLast ? 'Start learning' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/** 何枚目かを示す点。現在地だけ accent で塗る */
function Dots({ count, current }: { count: number; current: number }) {
  const theme = useTheme();

  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, { backgroundColor: i === current ? theme.accent : theme.border }]}
        />
      ))}
    </View>
  );
}

/** 1画面目: 会話の相手が3人いること(要件定義書 4.3) */
function Cast() {
  return (
    <View style={styles.cast}>
      {CAST.map((character) => (
        <CharacterAvatar key={character} character={character} size={AVATAR_SIZE} />
      ))}
    </View>
  );
}

/**
 * 2画面目: 1日の上限(ADR-0003)。
 *
 * 数字だけを大きく出す。初日に3字で打ち止めになるのを故障と誤解されないための一画面
 * なので、**上限そのものを図にする**。
 */
function DailyLimit() {
  const theme = useTheme();

  return (
    <View style={styles.limit}>
      <Text style={[styles.limitNumber, { color: theme.accent }]}>{DAILY_NEW_KANJI_LIMIT}</Text>
      <Text style={[styles.limitCaption, { color: theme.textMuted }]}>kanji a day</Text>
    </View>
  );
}

/**
 * 3画面目: 同じ字の読みが変わること(要件定義書 4.6)。
 *
 * **訓=緑 / 音=青は漢字の樹(4.5)と同じ意味づけ**なので、樹と同じトークンを使う。
 * ここで別の色を使うと、樹を開いたときに枝の色が別物に見える。
 */
function ReadingShift({ sample }: { sample: OnboardingSample }) {
  const theme = useTheme();

  return (
    <View style={styles.shift}>
      <Text
        style={{
          fontFamily: theme.type.minchoBold,
          fontSize: 88,
          lineHeight: 108,
          color: theme.text,
        }}
        accessibilityLanguage="ja-JP"
      >
        {sample.kanji}
      </Text>

      <View style={styles.readings}>
        <Text
          style={[styles.reading, { fontFamily: theme.type.mincho, color: theme.kunBranch }]}
          accessibilityLanguage="ja-JP"
        >
          {sample.kun}
        </Text>
        <Text style={[styles.arrow, { color: theme.textMuted }]}>→</Text>
        <Text
          style={[styles.reading, { fontFamily: theme.type.mincho, color: theme.onBranch }]}
          accessibilityLanguage="ja-JP"
        >
          {sample.on}
        </Text>
      </View>

      <Text style={[styles.gloss, { color: theme.text }]}>{sample.gloss}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    gap: 28,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  skipLabel: {
    fontSize: 14,
  },
  figure: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 168,
  },
  cast: {
    flexDirection: 'row',
    gap: 12,
  },
  limit: {
    alignItems: 'center',
    gap: 4,
  },
  limitNumber: {
    fontSize: 96,
    lineHeight: 112,
  },
  limitCaption: {
    fontSize: 15,
  },
  shift: {
    alignItems: 'center',
    gap: 10,
  },
  readings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reading: {
    fontSize: 22,
  },
  arrow: {
    fontSize: 18,
  },
  gloss: {
    fontSize: 15,
  },
  copy: {
    gap: 12,
  },
  title: {
    fontSize: 26,
    lineHeight: 33,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: 18,
  },
  cta: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 15,
  },
  ctaLabel: {
    fontSize: 16,
  },
  backLabel: {
    fontSize: 14,
  },
});
