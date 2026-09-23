/**
 * WCAG 2.x のコントラスト比。テーマの色トークンが読める濃さかをテストで確かめるために使う。
 *
 * 実行時には呼ばない(描画のたびに色を計算する理由が無い)。
 * 読める書式はテーマ定義で実際に使っている `#RRGGBB` と `rgba(r,g,b,a)` だけ。
 */

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * 前景を地の上に置いたときのコントラスト比(1〜21)。
 *
 * 半透明の前景は、地に合成した色で測る。`textMuted` のように α で淡くしている色は、
 * 合成前の値で測ると実際より濃い扱いになるため。**地は不透明であること。**
 */
export function contrastRatio(foreground: string, background: string): number {
  const bg = parseColor(background);

  if (bg.a !== 1) {
    throw new Error(`Background must be opaque: ${background}`);
  }

  const fg = composite(parseColor(foreground), bg);
  const lighter = Math.max(luminance(fg), luminance(bg));
  const darker = Math.min(luminance(fg), luminance(bg));

  return (lighter + 0.05) / (darker + 0.05);
}

function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);

  if (hex) {
    return {
      r: parseInt(hex[1], 16),
      g: parseInt(hex[2], 16),
      b: parseInt(hex[3], 16),
      a: 1,
    };
  }

  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(value);

  if (rgba) {
    const a = Number(rgba[4]);

    // 範囲外の α を黙って外挿すると、実在しない色で合否を出してしまう
    if (!(a >= 0 && a <= 1)) {
      throw new Error(`Alpha out of range: ${value}`);
    }

    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a,
    };
  }

  throw new Error(`Unsupported color format: ${value}`);
}

function composite(fg: Rgba, bg: Rgba): Rgba {
  const mix = (front: number, back: number) => front * fg.a + back * (1 - fg.a);

  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

/** 相対輝度。sRGB の各成分を線形化してから重み付けする */
function luminance({ r, g, b }: Rgba): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}
