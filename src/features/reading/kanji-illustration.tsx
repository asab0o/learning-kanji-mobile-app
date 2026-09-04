/**
 * 漢字の象徴イラスト(要件定義書 5.1-3)。
 *
 * **50字が揃うのを待たずに成立する形**にしてある(要件定義書 5.4)。
 * 未投入の字はプレースホルダに落ちるので、生成できた字から `ILLUSTRATIONS` に足せばよい。
 * **ここに進捗の数を書かない。** 数は増えるたびに嘘になる。何字入ったかは
 * `cutout.py` が「処理済み N 字 / 残り M 字」で出すので、そちらが唯一の情報源。
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
const ILLUSTRATIONS: Record<string, number> = {
  above: require('@/assets/kanji/above.png'),
  big: require('@/assets/kanji/big.png'),
  book: require('@/assets/kanji/book.png'),
  buy: require('@/assets/kanji/buy.png'),
  cheap: require('@/assets/kanji/cheap.png'),
  come: require('@/assets/kanji/come.png'),
  country: require('@/assets/kanji/country.png'),
  day: require('@/assets/kanji/day.png'),
  eat: require('@/assets/kanji/eat.png'),
  exit: require('@/assets/kanji/exit.png'),
  expensive: require('@/assets/kanji/expensive.png'),
  fire: require('@/assets/kanji/fire.png'),
  go: require('@/assets/kanji/go.png'),
  hear: require('@/assets/kanji/hear.png'),
  heaven: require('@/assets/kanji/heaven.png'),
  house: require('@/assets/kanji/house.png'),
  inside: require('@/assets/kanji/inside.png'),
  interval: require('@/assets/kanji/interval.png'),
  language: require('@/assets/kanji/language.png'),
  learn: require('@/assets/kanji/learn.png'),
  money: require('@/assets/kanji/money.png'),
  moon: require('@/assets/kanji/moon.png'),
  mountain: require('@/assets/kanji/mountain.png'),
  name: require('@/assets/kanji/name.png'),
  outside: require('@/assets/kanji/outside.png'),
  person: require('@/assets/kanji/person.png'),
  rain: require('@/assets/kanji/rain.png'),
  read: require('@/assets/kanji/read.png'),
  rest: require('@/assets/kanji/rest.png'),
  river: require('@/assets/kanji/river.png'),
  see: require('@/assets/kanji/see.png'),
  sky: require('@/assets/kanji/sky.png'),
  small: require('@/assets/kanji/small.png'),
  soil: require('@/assets/kanji/soil.png'),
  speak: require('@/assets/kanji/speak.png'),
  stand: require('@/assets/kanji/stand.png'),
  time: require('@/assets/kanji/time.png'),
  tree: require('@/assets/kanji/tree.png'),
  understand: require('@/assets/kanji/understand.png'),
  walk: require('@/assets/kanji/walk.png'),
  water: require('@/assets/kanji/water.png'),
  write: require('@/assets/kanji/write.png'),
};

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
