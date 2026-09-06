/**
 * 1字の樹(要件定義書 4.5)。
 *
 * 描くのは `layoutTree()` が返した座標そのままで、ここに配置の判断は無い。
 * SVG が受け持つのは幹・枝・節点だけ。**ラベルは RN の `Text` を絶対配置で重ねる。**
 * SVG の `Text` は折り返せず、`junior high school` のような意味が枠から出るため。
 *
 * 色はすべてテーマから(絶対規則1)。訓 = `kunBranch`、音 = `onBranch`、つぼみ = `textMuted`。
 *
 * ナビゲーションを知らない表示専用コンポーネント。「与えられた状態を静的に描く」だけにして、
 * 4.6 ステップ3(枝が生えるアニメーション)を後から被せられる形にしておく。
 */

import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { layoutTree } from '@/features/tree/layout';
import type { LabelPlacement, TreeBranch } from '@/features/tree/layout';
import type { KanjiTree, TreeLeaf } from '@/features/tree/tree';
import { useTheme } from '@/theme';

const H_PADDING = 16;
/** 中心の漢字の大きさ(正規化単位)。枝の起点(82)と幹の上端(102)の間に収める */
const KANJI_SIZE = 16;

interface KanjiTreeViewProps {
  tree: KanjiTree;
  onBack: () => void;
  /** 漢字フォーカス画面を「見るだけ」で開く。学習の導線ではないので完了 CTA は出ない */
  onOpenKanji?: () => void;
}

export function KanjiTreeView({ tree, onBack, onOpenKanji }: KanjiTreeViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={12}>
          {({ pressed }) => (
            <Text style={[styles.backLabel, { color: theme.accent, opacity: pressed ? 0.6 : 1 }]}>
              Back
            </Text>
          )}
        </Pressable>
        <Text style={[styles.count, { color: theme.textMuted }]}>
          {`${tree.encounteredCount} of ${tree.totalCount} words met`}
        </Text>
      </View>

      <TreeCanvas tree={tree} />

      <View style={styles.footer}>
        <Text style={[styles.meaning, { color: theme.text }]}>{tree.kanji.meaning}</Text>
        {onOpenKanji === undefined ? null : (
          <Pressable onPress={onOpenKanji} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.link, { color: theme.accent }]}>See the illustration</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function TreeCanvas({ tree }: { tree: KanjiTree }) {
  const theme = useTheme();
  // 回転しても崩れないように幅は毎回ウィンドウから割り出す(`kanji-list.tsx` と同じ)
  const { width } = useWindowDimensions();
  const canvasWidth = width - H_PADDING * 2;
  const layout = layoutTree(tree.leaves);
  // 正規化座標 → px
  const scale = canvasWidth / layout.viewBox.width;
  const canvasHeight = layout.viewBox.height * scale;

  return (
    <View
      style={{ width: canvasWidth, height: canvasHeight }}
      accessibilityLabel={`${tree.kanji.character} tree, ${tree.encounteredCount} of ${tree.totalCount} words met`}
    >
      <Svg
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
      >
        <Path
          d={`M${layout.trunk.from.x} ${layout.trunk.from.y} L${layout.trunk.to.x} ${layout.trunk.to.y}`}
          stroke={theme.textMuted}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        {layout.branches.map((branch) => (
          <Branch key={branch.leaf.wordId} branch={branch} radius={radiusFor(branch, layout)} />
        ))}
      </Svg>

      {/* 中心の漢字。SVG の Text は明朝フォントの指定が効きにくいので RN の Text で重ねる */}
      <Text
        style={{
          position: 'absolute',
          left: 0,
          width: canvasWidth,
          top: (layout.center.y - KANJI_SIZE / 2) * scale,
          textAlign: 'center',
          fontFamily: theme.type.minchoBold,
          fontSize: KANJI_SIZE * scale * 0.8,
          lineHeight: KANJI_SIZE * scale,
          color: theme.text,
        }}
        accessibilityLanguage="ja-JP"
      >
        {tree.kanji.character}
      </Text>

      {layout.branches.map((branch) => (
        <Label
          key={branch.leaf.wordId}
          leaf={branch.leaf}
          placement={branch.label}
          width={layout.labelWidth * scale}
          scale={scale}
          canvasHeight={canvasHeight}
        />
      ))}
    </View>
  );
}

function radiusFor(
  branch: TreeBranch<TreeLeaf>,
  layout: { leafRadius: number; budRadius: number }
): number {
  return branch.leaf.state === 'leaf' ? layout.leafRadius : layout.budRadius;
}

function Branch({ branch, radius }: { branch: TreeBranch<TreeLeaf>; radius: number }) {
  const theme = useTheme();
  const isLeaf = branch.leaf.state === 'leaf';
  const branchColor = branch.leaf.readingType === 'kun' ? theme.kunBranch : theme.onBranch;
  const color = isLeaf ? branchColor : theme.textMuted;
  const { from, control, to } = branch;

  return (
    <>
      <Path
        d={`M${from.x} ${from.y} Q${control.x} ${control.y} ${to.x} ${to.y}`}
        stroke={color}
        strokeWidth={isLeaf ? 1.6 : 1}
        strokeLinecap="round"
        fill="none"
        // つぼみへの枝は薄く。「まだ先がある」ことが分かればよい
        opacity={isLeaf ? 1 : 0.55}
      />
      <Circle
        cx={to.x}
        cy={to.y}
        r={radius}
        fill={isLeaf ? color : theme.surface}
        stroke={color}
        strokeWidth={isLeaf ? 0 : 1}
        opacity={isLeaf ? 1 : 0.7}
      />
    </>
  );
}

/**
 * 葉には表記・読み・意味、つぼみには表記だけ。
 * つぼみの読みと意味を伏せるのは、「まだ先がある」という動機と
 * 後の推測クイズの種明かしを先に潰さないため(docs/plans/kanji-tree.md 確認点3)。
 */
function Label({
  leaf,
  placement,
  width,
  scale,
  canvasHeight,
}: {
  leaf: TreeLeaf;
  placement: LabelPlacement;
  width: number;
  scale: number;
  canvasHeight: number;
}) {
  const theme = useTheme();
  const isLeaf = leaf.state === 'leaf';

  return (
    // 枠は葉の上に「下端を揃えて」置く。`bottom` で留めるので、意味が2行に折り返しても上へ伸びる
    <View
      style={{
        position: 'absolute',
        left: placement.x * scale - width / 2,
        bottom: canvasHeight - placement.y * scale,
        width,
        alignItems: 'center',
      }}
      accessibilityLanguage="ja-JP"
    >
      <Text
        style={{
          fontFamily: theme.type.minchoBold,
          fontSize: 17,
          color: isLeaf ? theme.text : theme.textMuted,
          textAlign: 'center',
        }}
        accessibilityLanguage="ja-JP"
      >
        {leaf.surface}
      </Text>
      {isLeaf ? (
        <>
          <Text style={[styles.kana, { color: theme.textMuted }]} accessibilityLanguage="ja-JP">
            {leaf.kana}
          </Text>
          <Text style={[styles.leafMeaning, { color: theme.text }]}>{leaf.meaning}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: H_PADDING,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backLabel: {
    fontSize: 14,
  },
  count: {
    fontSize: 12,
  },
  footer: {
    alignItems: 'center',
    gap: 8,
  },
  meaning: {
    fontSize: 17,
  },
  link: {
    fontSize: 14,
  },
  kana: {
    fontSize: 12,
    textAlign: 'center',
  },
  leafMeaning: {
    fontSize: 11.5,
    lineHeight: 15,
    textAlign: 'center',
  },
});
