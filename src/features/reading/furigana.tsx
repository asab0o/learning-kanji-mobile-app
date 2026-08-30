import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { LineSegment } from '@/content/types';
import { furiganaMetrics } from '@/features/reading/furigana-metrics';
import { useTheme } from '@/theme/theme-context';

/**
 * 表示用のセグメント。
 *
 * 本文と読みはコンテンツが持つ形(`LineSegment`)をそのまま使い、
 * ここでは表示状態の `focus` だけを足す。逆に `LineSegment` 側へ `focus` を
 * 入れないのは、光らせる字が場面によって変わるため(要件定義書 4.6)。
 * ステップ1では新出漢字を、第2段階の演出では読みが変わる字を光らせるので、
 * どの字を光らせるかはデータではなく画面が決める。
 * 付け方は `@/features/reading/segments` の `toFuriganaSegments`。
 */
export type FuriganaSegment = LineSegment & {
  /** いまハイライトする字を含むセグメント。テーマの accent で描く。 */
  focus?: boolean;
  /**
   * 「読みが変わった」演出の合図(要件定義書 4.6 ステップ1)。
   * **押すと種明かしカードが出る場所**を指すので、押せない行には付けない。
   */
  badge?: boolean;
};

type FuriganaTextProps = {
  segments: FuriganaSegment[];
  /**
   * 行全体を1つのアクセシビリティ要素にまとめるか。既定は true。
   *
   * この行を `Pressable` で包むときだけ false にする。true のままだと
   * ボタン(Pressable)とラベル(この View)が二重になり、VoiceOver が
   * 同じ本文を2回読む。
   */
  groupForAccessibility?: boolean;
};

/**
 * ふりがな付きの日本語テキスト。
 *
 * RN には ruby が無いため、セグメントごとに「読み / 本文」を縦に積んだ箱を作り、
 * それを折り返す行として並べる。**折り返しはセグメント境界でしか起きない**ので、
 * 呼び出し側は文節程度の粒度で区切ること。長い一続きのかなを1セグメントにすると
 * 行からはみ出す。
 *
 * 行の高さの内訳は `furigana-metrics.ts` が持つ。
 */
export function FuriganaText({ segments, groupForAccessibility = true }: FuriganaTextProps) {
  const theme = useTheme();
  // 端末の文字サイズ設定。useWindowDimensions は設定変更で再レンダリングされる
  // (PixelRatio.getFontScale() は初回の値を返したままになる)。
  const { fontScale } = useWindowDimensions();
  const { readingSize, readingHeight, baseLineHeight } = furiganaMetrics(theme.type, fontScale);
  const badgeSize = readingSize - 1;

  return (
    <View
      style={styles.row}
      // セグメントごとに Text が分かれているため、そのままだと VoiceOver が
      // 「きょう」「今日」「は」…と読みと本文を交互に読んでしまう。
      // 行全体を1要素にまとめ、本文だけを繋いだラベルを読ませる。
      accessible={groupForAccessibility}
      accessibilityLabel={
        groupForAccessibility ? segments.map((segment) => segment.text).join('') : undefined
      }
      accessibilityLanguage="ja-JP"
    >
      {segments.map((segment, index) => (
        <View
          // 同じ文字列が同じ文に複数回出るため、index を含めないと key が衝突する。
          key={`${segment.text}-${index}`}
          style={styles.segment}
        >
          <Text
            style={{
              height: readingHeight,
              fontFamily: theme.type.mincho,
              fontSize: readingSize,
              lineHeight: readingHeight,
              color: segment.focus === true ? theme.accent : theme.textMuted,
            }}
          >
            {segment.reading ?? ''}
          </Text>
          <View
            style={{
              // 下線は focus のときだけ見せるが、幅は常に確保する。
              // focus の有無で行の高さが変わるとベースラインがずれるため。
              // このぶんセグメントの実寸は jaLineHeight より 2pt 高くなる。
              borderBottomWidth: 2,
              borderBottomColor: segment.focus === true ? theme.accent : 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: segment.focus === true ? theme.type.minchoBold : theme.type.mincho,
                fontSize: theme.type.jaSize,
                lineHeight: baseLineHeight,
                color: segment.focus === true ? theme.accent : theme.text,
              }}
            >
              {segment.text}
            </Text>
          </View>
          {segment.badge === true ? (
            // 絶対配置にするのは行の高さを変えないため。ふりがなの height は
            // furiganaMetrics が決めており、★を通常のテキストとして足すと
            // 段が増えて全文の組みが崩れる。
            // 読み上げからは外す(意味は Pressable 側の accessibilityHint が持つ)。
            <Text
              style={[
                styles.badge,
                {
                  color: theme.accent,
                  fontSize: badgeSize,
                  // 端末の文字サイズ倍率を掛ける。fontSize は RN が自動で拡大するのに
                  // lineHeight と位置は拡大しないので、掛けないと文字サイズを上げた
                  // 端末で★がふりがなに重なる(furigana-metrics.ts と同じ理由)。
                  lineHeight: badgeSize * fontScale,
                  top: -(badgeSize + 2) * fontScale,
                },
              ]}
              accessibilityElementsHidden
            >
              ★
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  segment: {
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    // 読みの**上**に出す。右に逃がすと隣のセグメントの読みに重なる
    // (実機で「にち★うび」となり `曜` の「よ」が隠れた)。
    // top は吹き出しの上側の内側余白に載る想定で、倍率込みの値を描画側で入れる。
    //
    // **既知の制約**: 折り返した2行目のセグメントに★が来ると直上の行に重なる
    // (styles.row に rowGap が無いため)。演出語を折り返しの2行目に落とさないことを
    // 執筆側の制約にしている(docs/content-spec.md「演出行の書き方」)。
    left: 0,
    right: 0,
    textAlign: 'center',
  },
});
