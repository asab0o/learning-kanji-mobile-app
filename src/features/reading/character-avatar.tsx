import { Image } from 'expo-image';
import { View } from 'react-native';

import type { CharacterId } from '@/content/types';
import { useTheme } from '@/theme/theme-context';

/**
 * 話者のアバター。
 *
 * 元絵はバストアップ(胸から上)なので、そのまま円に入れると顔が小さすぎて
 * 誰だか分からない。**顔の位置に寄せて切り抜く**ため、キャラごとに
 * 「顔が画像のどこにあるか」と「どれだけ拡大するか」を持つ。
 *
 * 拡大率は**顔が枠いっぱいになる値より一段引いてある**。ぴったり顔で埋めると
 * 距離が近すぎて窮屈に見え、髪型や襟元といった見分けの手がかりも消える。
 * 実機で見ながら決めた値(30pt の円で確認)。
 *
 * 絵を差し替えたらこの表も見直すこと。数値は目視で合わせたもので、
 * 元絵の構図が変わると顔が枠から外れる。
 */
interface FaceCrop {
  source: number;
  /** 顔の中心が画像のどこにあるか(0〜1)。左上が原点 */
  centerX: number;
  centerY: number;
  /** 円の直径に対して画像を何倍で描くか。顔が枠いっぱいになる値 */
  scale: number;
}

const FACES: Record<CharacterId, FaceCrop> = {
  mia: {
    source: require('@/assets/characters/mia.png'),
    centerX: 0.55,
    centerY: 0.42,
    scale: 2.5,
  },
  grandma: {
    source: require('@/assets/characters/grandma.png'),
    centerX: 0.5,
    centerY: 0.39,
    scale: 2.4,
  },
  sora: {
    // 空だけは元絵が顔で埋まっているので拡大は控えめ。
    // 耳まで入れると円の上に元絵の地(ベージュ)が少し入るが、
    // **猫のシルエットは耳が作っている**ので切らない。地は紙の質感として桜テーマに馴染む
    source: require('@/assets/characters/sora.png'),
    centerX: 0.5,
    centerY: 0.45,
    scale: 1.3,
  },
};

interface CharacterAvatarProps {
  character: CharacterId;
  /** 円の直径(pt) */
  size: number;
}

export function CharacterAvatar({ character, size }: CharacterAvatarProps) {
  const theme = useTheme();
  const face = FACES[character];

  const imageSize = size * face.scale;
  // 顔の中心が円の中心に来るよう、画像を左上方向にずらす
  const left = size / 2 - face.centerX * imageSize;
  const top = size / 2 - face.centerY * imageSize;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        // 元絵の地の色がテーマと違うので、はみ出しを切って円の中だけ見せる
        overflow: 'hidden',
        backgroundColor: theme.surfaceAlt,
      }}
    >
      <Image
        source={face.source}
        style={{ position: 'absolute', width: imageSize, height: imageSize, left, top }}
        contentFit="cover"
        // 同梱画像なので毎回デコードし直す必要がない
        cachePolicy="memory-disk"
      />
    </View>
  );
}
