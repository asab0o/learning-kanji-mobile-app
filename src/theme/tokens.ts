import type { ImageSourcePropType, ViewStyle } from 'react-native';

/**
 * テーマの識別子。
 *
 * 要件定義書 5.3 は3種(ノーマル / 桜 / 東京の夜景)を想定しているが、
 * 配色が確定しているのは桜だけ。残り2種はデザイン確定後に足す。
 */
export type ThemeId = 'sakura';

/**
 * テーマトークン。
 *
 * 色は**フラットに置く**。CLAUDE.md 絶対規則1 と architecture.md が
 * `theme.background` / `theme.text` / `theme.accent` の形を明記しているため、
 * `theme.color.background` のようにネストしない。
 * 色以外(角丸・書体・影・背景装飾)だけをサブオブジェクトにまとめる。
 *
 * 追加するときは全テーマに同じキーを足すこと。片方のテーマにしかないキーを作らない。
 */
export interface Theme {
  id: ThemeId;
  /** 設定画面に出す名前。UI文言は英語(絶対規則7)。 */
  name: string;
  /** 暗色テーマかどうか。StatusBar の文字色などの分岐に使う。 */
  dark: boolean;

  // ── 色 ─────────────────────────────────────────────
  /** 画面の地。背景装飾はこの上に敷く。 */
  background: string;
  /** 不透明な面。相手の吹き出しなど。 */
  surface: string;
  /** もう一方の面。自分側の吹き出しなど、話者を色で分けるために使う。 */
  surfaceAlt: string;
  /** 半透明の面。背景装飾を透かしつつ文字の視認性を確保するカードに使う。 */
  surfaceVeil: string;
  /** 本文。 */
  text: string;
  /** 訳文・読み・ラベルなど、本文より一段弱い文字。 */
  textMuted: string;
  /** 強調色。学習中の漢字のハイライトと主要CTAに使う。 */
  accent: string;
  /** accent を敷いた面の上に載る文字色。 */
  onAccent: string;
  /** 罫線・枠線。 */
  border: string;
  /**
   * 漢字の樹: 訓読みの枝(緑系)。
   * 音訓の色分けは差別化ポイントそのものなので、テーマを変えても意味が壊れないよう
   * トークンとして固定する(architecture.md)。
   */
  kunBranch: string;
  /** 漢字の樹: 音読みの枝(青系)。 */
  onBranch: string;

  // ── 色以外 ─────────────────────────────────────────
  radius: {
    bubble: number;
    card: number;
    /** ピル形。CTA に使う。 */
    pill: number;
  };
  type: {
    /** 日本語の本文。 */
    mincho: string;
    /** 日本語の強調・見出し・大きい漢字。 */
    minchoBold: string;
    jaSize: number;
    /**
     * 日本語本文の行の高さ(pt)。
     * ふりがなが本文の上に載るため、通常の行間より広く取る。
     */
    jaLineHeight: number;
  };
  shadow: {
    /** iOS の shadow* プロパティに展開済みの吹き出しの影。 */
    bubble: ViewStyle;
  };
  /**
   * 全画面に敷く背景装飾(生成画像)。画像が未用意のテーマは null。
   * 要件5.3 の通りテーマにつき1〜2枚まで、薄く敷く。
   */
  backdrop: { source: ImageSourcePropType; opacity: number } | null;
  /**
   * 全画面に敷くベクター装飾(react-native-svg)。テーマ専用の識別子、無ければ null。
   *
   * 座標や角度などの図形データはここに持たせず、対応する
   * `src/theme/motifs/` のコンポーネントにハードコードする。
   * トークンが持つのは「どのモチーフを使うか」の識別子だけ。
   */
  motif: 'sakuraPetals' | null;
}
