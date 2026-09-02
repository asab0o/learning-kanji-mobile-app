/**
 * 漢字の象徴イラスト(要件定義書 5.1-3)。
 *
 * **画像はまだ1枚も無い。** 50字ぶんを AI生成 → 手動選別する作業が別に走っており
 * (要件定義書 5.4)、それを待つと画面が作れないので、
 * **1枚も無い状態で成立する形**にしてある。生成できた字から `ILLUSTRATIONS` に足す。
 *
 * `require()` を動的に組み立てられない(Metro が静的解析で解決するため)ので、
 * ここは手書きのマップにするしかない。`KanjiEntry.illustrationKey` が鍵になる。
 */

import { Image, StyleSheet, Text, View } from 'react-native';

// バレル(@/theme)は背景装飾(expo-image)まで引き込むので、直接 import する。
// このファイルは `illustrationSource()` をユニットテストから読むため、
// ネイティブモジュールに到達させたくない(`backdrop.tsx` と同じ理由)。
import { useTheme } from '@/theme/theme-context';

/**
 * `illustrationKey` → 画像。
 *
 * 例: `mountain: require('@/assets/kanji/mountain.png')`
 * `assets/temp/` の試作は `.gitignore` されているので参照しない。
 */
const ILLUSTRATIONS: Record<string, number> = {};

/** 画像があれば `require()` の戻り値、無ければ null */
export function illustrationSource(illustrationKey: string): number | null {
  return ILLUSTRATIONS[illustrationKey] ?? null;
}

interface KanjiIllustrationProps {
  illustrationKey: string;
  size: number;
}

export function KanjiIllustration({ illustrationKey, size }: KanjiIllustrationProps) {
  const theme = useTheme();
  const source = illustrationSource(illustrationKey);

  if (source !== null) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        // 絵は意味の補助で、意味は下にテキストで出ている。読み上げでは飛ばす。
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          backgroundColor: theme.surfaceVeil,
          borderColor: theme.border,
          borderRadius: theme.radius.card,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/*
        鍵の名前は開発ビルドでだけ出す。どの字の絵が未投入かを実機で見分けるためで、
        学習者に「準備中」の中身を見せる意味は無い。
      */}
      {__DEV__ ? (
        <Text style={[styles.placeholderLabel, { color: theme.textMuted }]}>{illustrationKey}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    // 絵が入っていないことが分かるように、実線ではなく破線にする
    borderStyle: 'dashed',
  },
  placeholderLabel: {
    fontSize: 11,
  },
});
