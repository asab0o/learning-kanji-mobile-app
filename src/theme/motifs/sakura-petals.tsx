import { StyleSheet } from 'react-native';
import Svg, { Defs, Ellipse, Line, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/theme-context';

/**
 * 花びら5〜6枚と、その落下の軌跡を描くベクター装飾。
 *
 * デザイン案「春泥棒」の「花びらではなく落下の軌跡を描く」という方針を、
 * 生成AI画像ではなくコード側で実現している。経緯は ADR-0004 を参照。
 *
 * 生成AIに軌跡を厳密な指示(角度・不透明度・「trailing a streak」のような
 * 直訳されやすい表現)で描かせようとすると、風船の紐のような誤読が繰り返し起きた。
 * 色ズレも避けられないため、色をトークンと厳密に一致させる必要があるこの部分だけ
 * SVGに切り出した。AI画像側は質感(グラデーション・紙の粒感)だけを担当する。
 *
 * **軌跡は一定太さの直線ではなくグラデーションでフェードアウトさせる。**
 * 均一な線は花びらから伸びる紐に見えてしまい、これは生成AIで踏んだのと
 * 同じ失敗を自前のSVGで再現してしまったため(実機確認で発覚し、修正した)。
 *
 * 座標は viewBox 402×874(iPhone のポイント座標に近い比率)に対する固定値。
 * `preserveAspectRatio="xMidYMid slice"` で画面サイズに合わせて引き伸ばす。
 */
export function SakuraPetalsMotif() {
  const theme = useTheme();

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 402 874"
      preserveAspectRatio="xMidYMid slice"
      pointerEvents="none"
    >
      {PETALS.map((p, i) => (
        <PetalWithTrail key={i} index={i} {...p} color={theme.accent} />
      ))}
    </Svg>
  );
}

type PetalSpec = {
  /** 花びらの中心座標。 */
  x: number;
  y: number;
  /** 花びらの向き(度)。軌跡の傾きと揃える。 */
  rotation: number;
  /** 軌跡の長さ。落ちてきた距離の違いを出すため1枚ずつ変える。 */
  trailLength: number;
  /** 花びらの長径。遠近を感じさせるため1枚ずつ変える。 */
  size: number;
};

function PetalWithTrail({
  x,
  y,
  rotation,
  trailLength,
  size,
  color,
  index,
}: PetalSpec & { color: string; index: number }) {
  // 軌跡は花びらから斜め上へ伸ばす。落ちてきた経路を示すため。
  const rad = (rotation * Math.PI) / 180;
  const trailX = x - trailLength * Math.sin(rad);
  const trailY = y - trailLength * Math.cos(rad);
  const gradientId = `sakura-trail-${index}`;

  return (
    <>
      <Defs>
        {/* 花びら側(x2,y2)を不透明に、末端(x1,y1)を透明にして尾を引くように見せる。 */}
        <LinearGradient
          id={gradientId}
          x1={trailX}
          y1={trailY}
          x2={x}
          y2={y}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={color} stopOpacity={0} />
          <Stop offset="1" stopColor={color} stopOpacity={0.32} />
        </LinearGradient>
      </Defs>
      <Line
        x1={trailX}
        y1={trailY}
        x2={x}
        y2={y}
        stroke={`url(#${gradientId})`}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Ellipse
        cx={x}
        cy={y}
        rx={size}
        ry={size * 0.58}
        fill={color}
        opacity={0.45}
        rotation={rotation}
        origin={`${x}, ${y}`}
      />
    </>
  );
}

// 中央(会話文・漢字イラストが載る領域)を避け、左右の端寄りに散らす。
// 元の画像生成プロンプトの構図(docs/テーマ背景プロンプト定義.md)を踏襲。
//
// **角度・軌跡の長さ・大きさは1枚ずつ変える。** 同じ値を並べると、
// 左右で鏡合わせの同じ角度が繰り返されて機械的に見える(実機確認で発覚)。
// 実際に舞い落ちる花びらは向きが揃わないので、値を散らして不揃いにしている。
const PETALS: PetalSpec[] = [
  { x: 28, y: 132, rotation: 34, trailLength: 74, size: 6.5 },
  { x: 370, y: 96, rotation: -13, trailLength: 46, size: 5.2 },
  { x: 20, y: 438, rotation: 9, trailLength: 58, size: 7 },
  { x: 384, y: 512, rotation: -31, trailLength: 88, size: 5.6 },
  { x: 40, y: 742, rotation: 48, trailLength: 40, size: 6 },
  { x: 366, y: 806, rotation: -20, trailLength: 66, size: 5.8 },
];
