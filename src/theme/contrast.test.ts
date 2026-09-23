import { contrastRatio } from '@/theme/contrast';

describe('contrastRatio', () => {
  it('白地に黒は 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('同じ色どうしは 1:1', () => {
    expect(contrastRatio('#453B41', '#453B41')).toBeCloseTo(1, 5);
  });

  it('前景と地を入れ替えても同じ値になる', () => {
    expect(contrastRatio('#FFFFFF', '#453B41')).toBeCloseTo(contrastRatio('#453B41', '#FFFFFF'), 5);
  });

  it('半透明の前景は地に合成してから測る', () => {
    // 黒の α 0.5 を白に合成すると #808080(に近い灰色)。単体の #808080 と同じ比になる
    expect(contrastRatio('rgba(0,0,0,0.5)', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#7F7F7F', '#FFFFFF'),
      1
    );
  });

  it('α 0 の前景は地そのものになり 1:1', () => {
    expect(contrastRatio('rgba(0,0,0,0)', '#FBF4F4')).toBeCloseTo(1, 5);
  });

  it('半透明の地は受け付けない', () => {
    expect(() => contrastRatio('#000000', 'rgba(255,255,255,0.72)')).toThrow();
  });

  it('範囲外の α は受け付けない', () => {
    expect(() => contrastRatio('rgba(0,0,0,1.5)', '#FFFFFF')).toThrow();
    expect(() => contrastRatio('rgba(0,0,0,..)', '#FFFFFF')).toThrow();
  });

  it('読めない書式は受け付けない', () => {
    expect(() => contrastRatio('red', '#FFFFFF')).toThrow();
  });
});
