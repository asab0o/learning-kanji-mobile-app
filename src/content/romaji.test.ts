import { ALLOWED_IN_ROMAJI, kanaToRomaji, segmentsToRomajiDraft } from '@/content/romaji';
import type { LineSegment } from '@/content/types';

// 表記規則の根拠は docs/content-spec.md「ローマ字の書き方」。
// 実データを参照しない(src/content/CLAUDE.md)。

describe('kanaToRomaji', () => {
  it.each([
    // 基本(ヘボン式の要件定義書 5.2 が名指ししている4つ)
    ['つき', 'tsuki'],
    ['ふゆ', 'fuyu'],
    ['しごと', 'shigoto'],
    ['ちかく', 'chikaku'],
    // 拗音
    ['しゃしん', 'shashin'],
    ['じゅう', 'jū'],
    ['きょう', 'kyō'],
    ['りょこう', 'ryokō'],
    // 濁音・半濁音
    ['つづく', 'tsuzuku'],
    ['さんぽ', 'sampo'],
  ])('%s → %s', (kana, expected) => {
    expect(kanaToRomaji(kana)).toBe(expected);
  });

  describe('長音', () => {
    it.each([
      ['とうきょう', 'tōkyō'],
      ['くう', 'kū'],
      ['おかあさん', 'okāsan'],
      ['おねえさん', 'onēsan'],
      ['がっこう', 'gakkō'],
    ])('マクロンに畳む: %s → %s', (kana, expected) => {
      expect(kanaToRomaji(kana)).toBe(expected);
    });

    it.each([
      // JR の駅名標が Iidabashi / Keisei と書くのに合わせ、この2つは畳まない
      ['ちいさい', 'chiisai'],
      ['せんせい', 'sensei'],
      ['えいが', 'eiga'],
    ])('ii と ei は畳まない: %s → %s', (kana, expected) => {
      expect(kanaToRomaji(kana)).toBe(expected);
    });
  });

  describe('撥音', () => {
    it.each([
      ['ほん', 'hon'],
      ['しんぶん', 'shimbun'],
      ['さんぽ', 'sampo'],
      ['あんまり', 'ammari'],
      ['しんいち', "shin'ichi"],
      ['きんようび', "kin'yōbi"],
      ['げんき', 'genki'],
    ])('%s → %s', (kana, expected) => {
      expect(kanaToRomaji(kana)).toBe(expected);
    });
  });

  describe('促音', () => {
    it.each([
      ['がっこう', 'gakkō'],
      ['いっしょ', 'issho'],
      ['まって', 'matte'],
      ['こっち', 'kotchi'],
      ['いらっしゃい', 'irasshai'],
    ])('%s → %s', (kana, expected) => {
      expect(kanaToRomaji(kana)).toBe(expected);
    });

    it('語末の促音は落とす', () => {
      expect(kanaToRomaji('あっ')).toBe('a');
    });
  });

  describe('カタカナ', () => {
    it.each([
      ['コーヒー', 'kōhī'],
      ['テレビ', 'terebi'],
      ['カレー', 'karē'],
      ['ミア', 'mia'],
    ])('%s → %s', (kana, expected) => {
      expect(kanaToRomaji(kana)).toBe(expected);
    });
  });

  describe('語ごとの例外', () => {
    it.each([
      ['こんにちは', 'konnichiwa'],
      // 「b の前の撥音は m」に従う。さんぽ = sampo と同じ扱い
      ['こんばんは', 'kombanwa'],
      ['では', 'dewa'],
    ])('%s → %s', (kana, expected) => {
      expect(kanaToRomaji(kana)).toBe(expected);
    });
  });

  it('を は常に o(現代語では助詞用法しかない)', () => {
    expect(kanaToRomaji('を')).toBe('o');
  });

  it('変換できない文字は落とさずそのまま残す', () => {
    // 握り潰すと、漢字が紛れ込んでいてもそれらしい出力になり検証が拾えなくなる
    expect(kanaToRomaji('あ漢い')).toBe('a漢i');
  });

  it('空文字は空文字を返す', () => {
    expect(kanaToRomaji('')).toBe('');
  });
});

describe('segmentsToRomajiDraft', () => {
  const draftOf = (segments: LineSegment[]) => segmentsToRomajiDraft(segments).draft;

  describe('既にドキュメント・テストに書かれている実例との一致', () => {
    it('docs/content-spec.md の例', () => {
      expect(
        draftOf([{ text: 'たくさん' }, { text: '歩', reading: 'ある' }, { text: 'きましたね。' }])
      ).toBe('Takusan arukimashita ne.');
    });

    it('src/db/mappers.test.ts の例(1)', () => {
      expect(draftOf([{ text: 'おはようございます。' }])).toBe('Ohayō gozaimasu.');
    });

    it('src/db/mappers.test.ts の例(2)', () => {
      expect(draftOf([{ text: 'いらっしゃい。' }])).toBe('Irasshai.');
    });
  });

  it('漢字に続くかなから助詞を切り出す', () => {
    expect(
      draftOf([
        { text: 'この' },
        { text: '家', reading: 'いえ' },
        { text: 'は、' },
        { text: '何人', reading: 'なんにん' },
        { text: 'ですか?' },
      ])
    ).toBe('Kono ie wa, nannin desu ka?');
  });

  it('長音はセグメント境界を越えない', () => {
    // 思(おも)+う を omō にしない。これが分かち書きで一番効く規則
    expect(draftOf([{ text: '思', reading: 'おも' }, { text: 'う。' }])).toBe('Omou.');
  });

  it('促音は境界をまたいだ語の中でも働く', () => {
    expect(draftOf([{ text: '言', reading: 'い' }, { text: 'って。' }])).toBe('Itte.');
  });

  it('です・ね を順に切り出す', () => {
    expect(draftOf([{ text: '小', reading: 'ちい' }, { text: 'さいですね。' }])).toBe(
      'Chiisai desu ne.'
    );
  });

  it('文頭のマクロンを大文字にし、… を変換する', () => {
    expect(draftOf([{ text: '大', reading: 'おお' }, { text: 'きくて…' }])).toBe('Ōkikute...');
  });

  it('2文目以降も大文字で始める', () => {
    expect(draftOf([{ text: 'はじめまして。' }, { text: 'よろしく。' }])).toBe(
      'Hajimemashite. Yoroshiku.'
    );
  });

  it('かなだけのセグメントは割らない', () => {
    // 「なに」を na ni と誤分割しないことを優先し、その代償は人が直す
    expect(draftOf([{ text: 'なに?' }])).toBe('Nani?');
  });

  it('同じ入力を2回渡しても同じ結果になる', () => {
    const segments: LineSegment[] = [{ text: '空', reading: 'そら' }, { text: 'を見て。' }];

    expect(draftOf(segments)).toBe(draftOf(segments));
  });
});

describe('segmentsToRomajiDraft の要確認フラグ', () => {
  it('は・へ が残っていれば particle を立てる', () => {
    const { checks } = segmentsToRomajiDraft([{ text: 'はじめまして。' }, { text: 'よろしく。' }]);

    expect(checks.filter((check) => check.kind === 'particle')).toHaveLength(1);
  });

  it('は・へ が無ければ particle を立てない', () => {
    const { checks } = segmentsToRomajiDraft([{ text: 'いらっしゃい。' }]);

    expect(checks.filter((check) => check.kind === 'particle')).toHaveLength(0);
  });

  it('固有名詞らしき語があれば proper-noun を立てる', () => {
    const { checks } = segmentsToRomajiDraft([{ text: 'ミアさん。' }]);

    expect(checks.filter((check) => check.kind === 'proper-noun')).toHaveLength(1);
  });

  it('固有名詞が無ければ proper-noun を立てない', () => {
    const { checks } = segmentsToRomajiDraft([{ text: 'いらっしゃい。' }]);

    expect(checks.filter((check) => check.kind === 'proper-noun')).toHaveLength(0);
  });

  it('変換できない文字が残れば unconverted を立てる', () => {
    // 読みを付け忘れた漢字セグメント。検証をすり抜けた場合の保険
    const { checks } = segmentsToRomajiDraft([{ text: '歩' }]);

    expect(checks.filter((check) => check.kind === 'unconverted')).toHaveLength(1);
  });

  it('正しく変換できていれば unconverted を立てない', () => {
    const { checks } = segmentsToRomajiDraft([{ text: '歩', reading: 'ある' }, { text: 'く。' }]);

    expect(checks.filter((check) => check.kind === 'unconverted')).toHaveLength(0);
  });
});

describe('レビューで見つかった取りこぼし', () => {
  const draftOf = (segments: LineSegment[]) => segmentsToRomajiDraft(segments).draft;

  it('語の途中の句読点も変換する', () => {
    // 会話文集 #2 の1行目。語末しか剥がしていないと「、」が残っていた
    expect(
      draftOf([
        { text: 'すみません、かばんが' },
        { text: '大', reading: 'おお' },
        { text: 'きくて…' },
      ])
    ).toBe('Sumimasen, kabanga ōkikute...');
  });

  it('括弧を落とし、囲まれていても定型句の例外表が効く', () => {
    expect(draftOf([{ text: '「こんにちは。」' }])).toBe('Konnichiwa.');
  });

  it('読みの末尾の促音が次のセグメントに届く', () => {
    // 一匹・八匹などの助数詞。N5 で頻出する
    expect(draftOf([{ text: '一', reading: 'いっ' }, { text: '匹', reading: 'ぴき' }])).toBe(
      'Ippiki'
    );
  });

  it('読みを持つセグメントが連続したら1語として変換する', () => {
    // 熟語。content-spec が「新出漢字は単独のセグメントに」と勧めるので必ず起きる形
    expect(
      draftOf([{ text: '何', reading: 'なん' }, { text: '人', reading: 'にん' }, { text: 'ですか?' }])
    ).toBe('Nannin desu ka?');
    expect(draftOf([{ text: '大', reading: 'だい' }, { text: '学', reading: 'がく' }])).toBe(
      'Daigaku'
    );
    expect(draftOf([{ text: '学', reading: 'がっ' }, { text: '校', reading: 'こう' }])).toBe(
      'Gakkō'
    );
  });

  it('熟語の中では長音が畳まれる', () => {
    // 今(きょ)+日(う) は語なので kyō。思(おも)+う の送り仮名とは扱いが違う
    expect(draftOf([{ text: '今', reading: 'きょ' }, { text: '日', reading: 'う' }])).toBe('Kyō');
  });

  it('行末でも句読点の前でもなければ助詞を切り出さない', () => {
    expect(
      draftOf([{ text: '子', reading: 'こ' }, { text: 'ども' }, { text: 'がいます。' }])
    ).toBe('Kodomo gaimasu.');
  });

  it('て形・で形の動詞を助詞で割らない', () => {
    // 直前が撥音・促音なら活用語尾とみなす
    expect(draftOf([{ text: '読', reading: 'よ' }, { text: 'んで。' }])).toBe('Yonde.');
    expect(draftOf([{ text: '飲', reading: 'の' }, { text: 'んで。' }])).toBe('Nonde.');
  });

  it('全角記号が残っていれば unconverted を立てる', () => {
    // Script=Common なので「日本語が混ざっていたら」という網では拾えなかった
    const { checks } = segmentsToRomajiDraft([{ text: 'あ', reading: 'あ' }, { text: '〜' }]);

    expect(checks.filter((check) => check.kind === 'unconverted')).toHaveLength(1);
  });
});

describe('再レビューで見つかった取りこぼし', () => {
  const draftOf = (segments: LineSegment[]) => segmentsToRomajiDraft(segments).draft;

  it('促音が記号を飛び越えて次の子音を重ねない', () => {
    // 会話文集 #6「あっ、また棚の上にいる。」
    expect(kanaToRomaji('あっ、また')).toBe('a、mata');
    expect(
      draftOf([
        { text: 'あっ、また' },
        { text: '棚', reading: 'たな' },
        { text: 'の' },
        { text: '上', reading: 'うえ' },
        { text: 'にいる。' },
      ])
    ).toBe('A, mata tanano ueniiru.');
  });

  it('語の前に付いた記号が直前の語の終わりとして置かれる', () => {
    // 会話文集 #1 の3行目。語頭に貼ると文の切れ目が消えて大文字化も効かなくなる
    expect(
      draftOf([
        { text: '一', reading: 'いっ' },
        { text: '匹', reading: 'ぴき' },
        { text: '。あなたで' },
      ])
      // 記号が stem の後ろに置かれ、文の切れ目と大文字化が生きていることを見る。
      // 「で」は助詞なので切り出されるのが正しい
    ).toBe('Ippiki. Anata de');
  });

  it('行頭が記号でも本文が大文字で始まる', () => {
    expect(draftOf([{ text: '空', reading: 'そら' }, { text: '、こっちへ。' }])).toBe(
      'Sora, kotchi e.'
    );
  });

  it('を は行末でなくても切り出す', () => {
    // 漢字に挟まれた を は、セグメントを独立させる以外に書きようがない
    expect(
      draftOf([
        { text: '何', reading: 'なに' },
        { text: 'を' },
        { text: '学', reading: 'まな' },
        { text: 'んでるんだい?' },
      ])
    ).toBe('Nani o mananderundai?');

    expect(
      draftOf([
        { text: '本', reading: 'ほん' },
        { text: 'を' },
        { text: '読', reading: 'よ' },
        { text: 'みます。' },
      ])
    ).toBe('Hon o yomimasu.');
  });

  it('全角スペース・全角数字は許可しない', () => {
    // 「日本語の貼り間違いを拾う」目的なので、半角だけを通す
    expect(ALLOWED_IN_ROMAJI.test('\u3000')).toBe(false);
    expect(ALLOWED_IN_ROMAJI.test('１')).toBe(false);
    expect(ALLOWED_IN_ROMAJI.test(' ')).toBe(true);
    expect(ALLOWED_IN_ROMAJI.test('1')).toBe(true);
  });

  it('ヘボン式で使う文字は許可する', () => {
    for (const char of ['ō', 'ū', 'ā', 'ē', 'ī', "'", '.', ',', '?', '!']) {
      expect(ALLOWED_IN_ROMAJI.test(char)).toBe(true);
    }
  });
});

describe('3回目のレビューで見つかった取りこぼし', () => {
  const draftOf = (segments: LineSegment[]) => segmentsToRomajiDraft(segments).draft;

  it('三点リーダが連続しても3点に畳む', () => {
    // 1文字ずつ置き換えると ...... や ....... になる。会話文集に12行ある
    expect(draftOf([{ text: '……' }, { text: '分', reading: 'わ' }, { text: 'かった。' }])).toBe(
      '... Wakatta.'
    );
    expect(draftOf([{ text: '聞', reading: 'き' }, { text: 'いてないな……。' }])).toBe(
      'Kiitenaina...'
    );
  });

  it('撥音のあとの を も切り出す', () => {
    // 「を は常に o」が仕様(docs/content-spec.md)。を は活用語尾になり得ない
    expect(
      draftOf([{ text: 'ごはんを' }, { text: '食', reading: 'た' }, { text: 'べる。' }])
    ).toBe('Gohan o taberu.');
  });

  it('て形・で形の動詞は引き続き割らない', () => {
    // を の例外を足しても、こちらのガードは効いたままであること
    expect(draftOf([{ text: '読', reading: 'よ' }, { text: 'んで。' }])).toBe('Yonde.');
  });
});
