import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';

// バレル(@/theme)は自分自身を再エクスポートしているので、循環を避けて直接 import する。
import { useTheme } from '@/theme/theme-context';

/**
 * テーマの背景装飾。
 *
 * 要件5.3 の通り全画面で同じ1枚を敷き回す。画面ごとに違う背景は作らない。
 * ルートレイアウトで1度だけ描画し、その上に透明背景の画面を重ねる。
 *
 * 画像が未用意のテーマでは何も描かない。
 */
export function ThemeBackdrop() {
  const theme = useTheme();

  if (theme.backdrop === null) {
    return null;
  }

  return (
    <Image
      source={theme.backdrop.source}
      style={[StyleSheet.absoluteFill, { opacity: theme.backdrop.opacity }]}
      contentFit="cover"
      pointerEvents="none"
      // 同梱アセットなのでフェードインさせない。画面遷移のたびに明滅して見えるため。
      transition={0}
      accessible={false}
    />
  );
}
