/**
 * 「読みが変わった」種明かしカード(要件定義書 4.6 ステップ2)。
 *
 * **伝えるべき核心は「読みは変わるが、意味の核は変わらない」。** 差別化ポイントそのものなので、
 * 文言はここに集中させる(要件4.6)。
 *
 * ナビゲーションを知らない表示専用コンポーネントにしてある。ステップ3(樹への反映)が
 * 入るときは `onClose` の中身を差し替えるだけで済む。
 *
 * RN の `Modal` を使わず画面内のオーバーレイにしているのは、`Modal` が別のネイティブ
 * ルートに描かれて `useSafeAreaInsets()` が効かないため(下端の余白がカードで最も効く)。
 * 代償として、カードを開いたまま端からスワイプすると画面ごと戻れる。壊れはしない。
 */

import { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Reveal, RevealKanji } from '@/features/reading/reveal';
import { useTheme } from '@/theme';

const SCRIM_OPACITY = 0.4;
const OPEN_MS = 220;
const CLOSE_MS = 160;
/** せり上がりの距離。カードの実寸を測らずに済ませるための固定値 */
const SLIDE_DISTANCE = 320;

export function RevealCard({ reveal, onClose }: { reveal: Reveal; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // useState の遅延初期化で1回だけ作る。useRef(...).current は render 中の
  // ref 参照になり react-hooks/refs が禁じている。
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: OPEN_MS,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const close = useCallback(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_MS,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [progress, onClose]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SLIDE_DISTANCE, 0],
  });

  return (
    // Modal を使っていないので、VoiceOver が暗幕の裏の会話文まで辿れてしまう。
    // Modal なら自動で得られていた閉じ込めを明示的に足す。
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {/*
        暗幕。scrim トークンを足すと要件5.3 の表まで書き換えることになるので、
        本文色に透明度を掛けて作る(絶対規則1: 色はトークン経由)。
      */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.text,
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, SCRIM_OPACITY] }),
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderTopLeftRadius: theme.radius.card,
            borderTopRightRadius: theme.radius.card,
            paddingBottom: insets.bottom + 20,
            opacity: progress,
            transform: [{ translateY }],
          },
        ]}
      >
        <Word reveal={reveal} />

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.readings}>
          {reveal.kanji.map((entry) => (
            <ReadingChange key={entry.character} entry={entry} />
          ))}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* 要件4.6 の文言。ここがこのアプリの差別化の核 */}
        <Text style={[styles.headline, { color: theme.text }]}>Same kanji, different reading!</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>The meaning stays the same.</Text>

        <Pressable
          onPress={close}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: theme.accent,
              borderRadius: theme.radius.pill,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={[styles.ctaLabel, { color: theme.onAccent }]}>Got it</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** 語そのもの。読みが変わる字だけをアクセント色にして、どこが変わったかを見せる */
function Word({ reveal }: { reveal: Reveal }) {
  const theme = useTheme();
  const targets = new Set(reveal.kanji.map((entry) => entry.character));

  return (
    <View style={styles.word}>
      <Text accessibilityLanguage="ja-JP">
        {[...reveal.word].map((char, index) => (
          <Text
            key={`${char}-${index}`}
            style={{
              fontFamily: theme.type.minchoBold,
              fontSize: 30,
              lineHeight: 40,
              color: targets.has(char) ? theme.accent : theme.text,
            }}
          >
            {char}
          </Text>
        ))}
      </Text>
      <Text
        style={{ fontFamily: theme.type.mincho, fontSize: 13, color: theme.textMuted }}
        accessibilityLanguage="ja-JP"
      >
        {reveal.wordKana}
      </Text>
    </View>
  );
}

/**
 * 1字ぶんの「変わる前 → 変わった後」。
 *
 * ラベルが `Kun` / `On` なのは絶対規則7(UI文言は英語)。要件4.6 の絵は
 * `[訓読み]` `[音読み]` だが、規則7 を優先している(開発者承認済み)。
 */
function ReadingChange({ entry }: { entry: RevealKanji }) {
  const theme = useTheme();

  return (
    <View style={styles.change}>
      <View style={styles.changeHead}>
        <Text
          style={{ fontFamily: theme.type.minchoBold, fontSize: 20, color: theme.accent }}
          accessibilityLanguage="ja-JP"
        >
          {entry.character}
        </Text>
        <Text style={[styles.meaning, { color: theme.textMuted }]}>{entry.meaning}</Text>
      </View>

      <View style={styles.arrowRow}>
        <ReadingSide kana={entry.from} label="Kun" />
        <Text style={[styles.arrow, { color: theme.textMuted }]}>→</Text>
        {/* 語中で読みが2回変わる字(日曜日の 日)があるので中点で並べる */}
        <ReadingSide kana={entry.to.join('・')} label="On" />
      </View>
    </View>
  );
}

function ReadingSide({ kana, label }: { kana: string; label: string }) {
  const theme = useTheme();

  return (
    <View style={styles.side}>
      <Text
        style={{ fontFamily: theme.type.mincho, fontSize: 19, color: theme.text }}
        accessibilityLanguage="ja-JP"
      >
        {kana}
      </Text>
      <Text style={[styles.sideLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 22,
    borderWidth: 1,
    gap: 12,
  },
  word: {
    alignItems: 'center',
    gap: 2,
  },
  divider: {
    height: 1,
  },
  readings: {
    gap: 16,
  },
  change: {
    alignItems: 'center',
    gap: 6,
  },
  changeHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  meaning: {
    fontSize: 13,
  },
  arrowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  side: {
    alignItems: 'center',
  },
  sideLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  arrow: {
    fontSize: 17,
    lineHeight: 26,
  },
  headline: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    textAlign: 'center',
  },
  cta: {
    marginTop: 4,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ctaLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.56,
  },
});
