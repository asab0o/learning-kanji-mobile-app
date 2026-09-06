/**
 * 漢字の樹の公開API。`src/app/` からはここだけを import する。
 *
 * ユニットテストからは `@/features/tree/layout` / `@/features/tree/tree` のように
 * 個別のモジュールを import すること(コンポーネント経由で `react-native-svg` に到達させない)。
 */

export { buildKanjiTree, buildTreeIndex } from './tree';
export type {
  BuildKanjiTreeInput,
  BuildTreeIndexInput,
  CompletedLesson,
  KanjiTree,
  LeafState,
  TreeIndex,
  TreeLeaf,
  TreeSummary,
} from './tree';
export { layoutTree, VIEW_BOX } from './layout';
export type {
  LabelPlacement,
  LayoutLeaf,
  LayoutPattern,
  Point,
  TreeBranch,
  TreeLayout,
} from './layout';
export { KanjiTreeView } from './components/kanji-tree-view';
export { TreeGridView } from './components/tree-grid-view';
