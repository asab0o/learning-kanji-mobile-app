import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

// バレル(@/theme)は自分自身を再エクスポートしているので、循環を避けて直接 import する。
import { useTheme } from '@/theme/theme-context';
import { SakuraPetalsMotif } from '@/theme/motifs/sakura-petals';

/**
 * テーマの背景装飾。
 *
 * 要件5.3 の通り全画面で同じ1枚を敷き回す。画面ごとに違う背景は作らない。
 * ルートレイアウトで1度だけ描画し、その上に透明背景の画面を重ねる。
 *
 * 生成画像(`backdrop`)とベクター装飾(`motif`)は別レイヤーで、独立に null になりうる。
 * 画像だけ先に用意する・モチーフだけ先に有効化する、のどちらも成立する。
 * 描画順は 画像(質感) → モチーフ(桜のモチーフ) の順で、モチーフを上に重ねる。
 */
export function ThemeBackdrop() {
  const theme = useTheme();

  if (theme.backdrop === null && theme.motif === null) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {theme.backdrop !== null && (
        <Image
          source={theme.backdrop.source}
          style={[StyleSheet.absoluteFill, { opacity: theme.backdrop.opacity }]}
          contentFit="cover"
          // 同梱アセットなのでフェードインさせない。画面遷移のたびに明滅して見えるため。
          transition={0}
          accessible={false}
        />
      )}
      {theme.motif === 'sakuraPetals' && <SakuraPetalsMotif />}
    </View>
  );
}
