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
};

type FuriganaTextProps = {
  segments: FuriganaSegment[];
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
export function FuriganaText({ segments }: FuriganaTextProps) {
  const theme = useTheme();
  // 端末の文字サイズ設定。useWindowDimensions は設定変更で再レンダリングされる
  // (PixelRatio.getFontScale() は初回の値を返したままになる)。
  const { fontScale } = useWindowDimensions();
  const { readingSize, readingHeight, baseLineHeight } = furiganaMetrics(theme.type, fontScale);

  return (
    <View
      style={styles.row}
      // セグメントごとに Text が分かれているため、そのままだと VoiceOver が
      // 「きょう」「今日」「は」…と読みと本文を交互に読んでしまう。
      // 行全体を1要素にまとめ、本文だけを繋いだラベルを読ませる。
      accessible
      accessibilityLabel={segments.map((segment) => segment.text).join('')}
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
});
