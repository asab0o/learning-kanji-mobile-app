import type { Theme } from '@/theme/tokens';

/**
 * 桜テーマ。
 *
 * デザイン案「春泥棒」(Claude Design『日本らしいテーマの比較設計』)の配色をそのまま採る。
 * 満開ではなく散りぎわを描く案なので、一般的な桜のピンクより彩度を一段落としてある。
 * 経緯は docs/decisions/ADR-0004-sakura-theme.md を参照。
 */
export const sakura: Theme = {
  id: 'sakura',
  name: 'Sakura',
  dark: false,

  background: '#FBF4F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F6E7EC',
  surfaceVeil: 'rgba(255,255,255,0.72)',
  text: '#453B41',
  textMuted: 'rgba(69,59,65,0.52)',
  accent: '#D2839C',
  onAccent: '#FFFBF3',
  border: 'rgba(210,131,156,0.2)',

  // デザイン案に音訓の枝色が無いため、桜の低彩度に合わせて独自に決めた値。
  // 枝の線とラベル用で、本文サイズの文字色には使わない。
  kunBranch: '#7E9A6B',
  onBranch: '#7F9BBA',

  radius: {
    bubble: 19,
    card: 19,
    pill: 999,
  },

  type: {
    // デザイン指定は Shippori Mincho だが Google Fonts のため iOS には無い。
    // 同梱するとアプリサイズとフォント読込待ちが増えるので、iOS 内蔵の明朝で代用する。
    mincho: 'HiraMinProN-W3',
    minchoBold: 'HiraMinProN-W6',
    jaSize: 17.5,
    // デザインの line-height 2.05 を pt に換算(17.5 × 2.05 ≒ 36)。
    jaLineHeight: 36,
  },

  shadow: {
    bubble: {
      shadowColor: '#453B41',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
    },
  },

  // 背景装飾は画像生成AIで制作中。プロンプトは docs/テーマ背景プロンプト定義.md。
  // 画像ができたら assets/themes/sakura/backdrop.png を置いて
  // { source: require('@/assets/themes/sakura/backdrop.png'), opacity: 1 } に差し替える。
  backdrop: null,
};
