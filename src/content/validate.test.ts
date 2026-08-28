import {
  checkChapterComposition,
  checkCompoundPartnerTaught,
  checkFreeChapterBoundary,
  checkLineSegments,
  checkNewKanjiPerSentence,
  checkOrderSequence,
  checkReadingIntroduction,
  checkReencounterKanjiTaught,
  checkReencounterLineCleanliness,
  checkReencounterProximity,
  checkSoraInteraction,
  checkSoraSpeechRule,
  checkUniqueIds,
  checkUniqueKanjiCharacters,
  checkWordReferences,
  collectUnlearnedKanjiUsage,
  extractKanji,
  validateContent,
} from './validate';
import type {
  ChapterNumber,
  ContentSet,
  KanjiEntry,
  Line,
  LineSegment,
  Reading,
  Sentence,
  Word,
} from './types';

// --- フィクスチャ ---------------------------------------------------------

const kunAndOn: Reading[] = [
  { kana: 'よみ', romaji: 'yomi', type: 'kun' },
  { kana: 'オン', romaji: 'on', type: 'on' },
];

function kanji(
  id: string,
  character: string,
  order: number,
  chapter: ChapterNumber = 1,
  overrides: Partial<KanjiEntry> = {}
): KanjiEntry {
  return {
    id,
    character,
    meaning: 'meaning',
    order,
    chapter,
    illustrationKey: character,
    readings: kunAndOn,
    readingIntroduction: 'kun-first',
    ...overrides,
  };
}

/**
 * checkLineSegments 以外のルールを対象にしたテストでは、segments の中身までは
 * 検証されない(各 describe が個別のルール関数しか呼ばないため)。
 * 既定は「japanese 全体を1セグメント・reading なし」にし、japanese との
 * 連結一致だけは常に保っておく。segments 自体を検証したいテストは
 * segments を明示的に渡す(下の checkLineSegments の describe を参照)。
 */
function line(japanese: string, speaker: Line['speaker'] = 'mia', segments?: LineSegment[]): Line {
  return {
    speaker,
    japanese,
    segments: segments ?? [{ text: japanese }],
    romaji: 'romaji',
    english: 'english',
  };
}

function sentence(overrides: Partial<Sentence> & Pick<Sentence, 'id' | 'order'>): Sentence {
  return {
    chapter: 1,
    scene: 'kitchen',
    lines: [line('これは何ですか')],
    newKanjiId: null,
    reencounters: [],
    isFree: true,
    ...overrides,
  };
}

function word(overrides: Partial<Word> & Pick<Word, 'id' | 'kanjiId'>): Word {
  return {
    surface: '空',
    kana: 'そら',
    meaning: 'sky',
    readingType: 'kun',
    encounteredInSentenceId: null,
    ...overrides,
  };
}

const content = (overrides: Partial<ContentSet> = {}): ContentSet => ({
  kanji: [],
  words: [],
  sentences: [],
  ...overrides,
});

const errorsOf = (issues: { level: string }[]) => issues.filter((i) => i.level === 'error');
const warningsOf = (issues: { level: string }[]) => issues.filter((i) => i.level === 'warning');

// --- extractKanji ---------------------------------------------------------

describe('extractKanji', () => {
  it('漢字だけを重複なしで取り出す', () => {
    expect(extractKanji('空を見る。空は青い')).toEqual(['空', '見', '青']);
  });

  it('ひらがな・カタカナ・記号は拾わない', () => {
    expect(extractKanji('ミアさん、これは?')).toEqual([]);
  });
});

// --- 第2段階の対象字が既習か(唯一ゆずれないルール) ------------------------

describe('checkReencounterKanjiTaught', () => {
  // 会話文集 #38「時間」= 時(#12) + 間(#13) の 2 字同時
  const jikan = content({
    kanji: [kanji('k-toki', '時', 1, 2), kanji('k-aida', '間', 2, 2)],
    sentences: [
      sentence({ id: 's12', order: 12, chapter: 2, isFree: false, newKanjiId: 'k-toki' }),
      sentence({ id: 's13', order: 13, chapter: 2, isFree: false, newKanjiId: 'k-aida' }),
      sentence({
        id: 's38',
        order: 38,
        chapter: 3,
        isFree: false,
        newKanjiId: null,
        reencounters: [{ word: '時間', stage: 2, kanjiIds: ['k-toki', 'k-aida'] }],
        lines: [line('時間がたつのは早いよ', 'grandma')],
      }),
    ],
  });

  it('2字同時の第2段階が表現でき、両方が既習なら通る', () => {
    expect(checkReencounterKanjiTaught(jikan)).toEqual([]);
  });

  it('対象字の片方が未習だと落ちる', () => {
    const broken = content({
      ...jikan,
      sentences: jikan.sentences.map((s) => (s.order === 13 ? { ...s, order: 45 } : s)),
    });
    const issues = checkReencounterKanjiTaught(broken);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('"k-aida" の初出は文 #45 です');
  });

  it('存在しない漢字を対象にすると落ちる', () => {
    const issues = checkReencounterKanjiTaught(
      content({
        kanji: [kanji('k-hi', '日', 1)],
        sentences: [
          sentence({
            id: 's1',
            order: 1,
            reencounters: [{ word: '日曜日', stage: 2, kanjiIds: ['k-missing'] }],
          }),
        ],
      })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('存在しません');
  });
});

// --- 読みの導入方法(例外字 天・本・語) ------------------------------------

describe('checkReadingIntroduction', () => {
  const onOnly = { readingIntroduction: 'on-only' as const, readings: [kunAndOn[1]] };

  it('例外字(天)が音読みだけを持つのは通る', () => {
    expect(
      checkReadingIntroduction(content({ kanji: [kanji('k-ten', '天', 1, 2, onOnly)] }))
    ).toEqual([]);
  });

  it('例外字を第2段階の対象にすると落ちる', () => {
    const issues = checkReadingIntroduction(
      content({
        kanji: [kanji('k-ten', '天', 1, 2, onOnly)],
        sentences: [
          sentence({
            id: 's1',
            order: 1,
            reencounters: [{ word: '天気', stage: 2, kanjiIds: ['k-ten'] }],
          }),
        ],
      })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('訓→音の段階を踏まない字');
  });

  it('kun-first なのに訓読みが無いと落ちる', () => {
    const issues = checkReadingIntroduction(
      content({ kanji: [kanji('k-ten', '天', 1, 2, { readings: [kunAndOn[1]] })] })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('on-only にしてください');
  });

  it('on-only なのに訓読みが残っていると落ちる', () => {
    const issues = checkReadingIntroduction(
      content({ kanji: [kanji('k-hon', '本', 1, 4, { readingIntroduction: 'on-only' })] })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('教えない読みをデータに残さないでください');
  });
});

// --- 空(猫)の発話ルール ---------------------------------------------------

describe('checkSoraSpeechRule', () => {
  const soraSays = (japanese: string) =>
    checkSoraSpeechRule(
      content({ sentences: [sentence({ id: 's1', order: 1, lines: [line(japanese, 'sora')] })] })
    );

  it('決定事項が名指しした「おかえり」を弾く', () => {
    expect(errorsOf(soraSays('おかえり'))).toHaveLength(1);
  });

  it('「ただいま」も弾く', () => {
    expect(errorsOf(soraSays('ただいま'))).toHaveLength(1);
  });

  it('要求だけの発話は通る', () => {
    expect(soraSays('ごはん')).toEqual([]);
    expect(soraSays('ねむい')).toEqual([]);
    expect(soraSays('外')).toEqual([]);
  });

  // 部分一致だと「はい」に誤反応していた。空の語彙領域は動作・位置なので通す必要がある
  it('「はいる」を禁止語「はい」と誤判定しない', () => {
    expect(soraSays('はいる')).toEqual([]);
  });

  it('「うんどう」を禁止語「うん」と誤判定しない', () => {
    expect(soraSays('うんどう')).toEqual([]);
  });

  it('区切られた語としての「うん」は弾く', () => {
    expect(errorsOf(soraSays('うん、ごはん'))).toHaveLength(1);
  });

  it('ミアが挨拶するのは問題ない', () => {
    const issues = checkSoraSpeechRule(
      content({
        sentences: [sentence({ id: 's1', order: 1, lines: [line('おはようございます', 'mia')] })],
      })
    );
    expect(issues).toEqual([]);
  });

  it('空の発話が長いと警告する', () => {
    expect(warningsOf(soraSays('そとにでたいからドアをあけて'))).toHaveLength(1);
  });
});

// --- 空が受け身になっていないか -------------------------------------------

describe('checkSoraInteraction', () => {
  it('ミアと隣接したやりとりがあれば通る', () => {
    const issues = checkSoraInteraction(
      content({
        sentences: [
          sentence({
            id: 's26',
            order: 26,
            lines: [line('外', 'sora'), line('外に行きたいの?', 'mia')],
          }),
        ],
      })
    );
    expect(issues).toEqual([]);
  });

  it('空が言いっぱなしだと警告する(v0.1 の反省)', () => {
    const issues = checkSoraInteraction(
      content({
        sentences: [
          sentence({
            id: 's1',
            order: 1,
            lines: [line('いい天気だねえ', 'grandma'), line('ねむい', 'sora')],
          }),
        ],
      })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('受け身のオチ要員');
  });
});

// --- 第2段階の間隔と演出行 -------------------------------------------------

describe('checkReencounterProximity', () => {
  const build = (introChapter: ChapterNumber, introOrder: number) =>
    content({
      kanji: [kanji('k-sei', '生', 1, 4)],
      sentences: [
        sentence({
          id: 'intro',
          order: introOrder,
          chapter: introChapter,
          isFree: false,
          newKanjiId: 'k-sei',
        }),
        sentence({
          id: 's48',
          order: 48,
          chapter: 4,
          isFree: false,
          reencounters: [{ word: '学生', stage: 2, kanjiIds: ['k-sei'] }],
        }),
      ],
    });

  // 会話文集 #43(生) → #48(学生) は同じ第4章。構造上避けられないので警告に留める
  it('同じ章内の第2段階を警告する', () => {
    const issues = checkReencounterProximity(build(4, 43));
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warning');
    expect(issues[0].message).toContain('5文差');
  });

  it('章をまたいでいれば警告しない', () => {
    expect(checkReencounterProximity(build(3, 26))).toEqual([]);
  });
});

describe('checkReencounterLineCleanliness', () => {
  it('演出行に未習漢字があると警告する', () => {
    const issues = checkReencounterLineCleanliness(
      content({
        kanji: [kanji('k-mizu', '水', 1, 2), kanji('k-yomu', '読', 2, 4)],
        sentences: [
          sentence({ id: 's19', order: 19, chapter: 2, isFree: false, newKanjiId: 'k-mizu' }),
          sentence({
            id: 's30',
            order: 30,
            chapter: 3,
            isFree: false,
            reencounters: [{ word: '水曜日', stage: 2, kanjiIds: ['k-mizu'] }],
            lines: [
              line('ここでは「すい」と読むんだよ。「水曜日」、休みって書いてある', 'grandma'),
            ],
          }),
        ],
      })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('読');
  });

  // 「曜」は熟語そのものの構成字で教えようがない。除外しないと永久に鳴り続ける
  it('熟語自身の構成字(日曜日の「曜」)は警告しない', () => {
    const issues = checkReencounterLineCleanliness(
      content({
        kanji: [kanji('k-hi', '日', 1)],
        sentences: [
          sentence({ id: 's4', order: 4, newKanjiId: 'k-hi' }),
          sentence({
            id: 's17',
            order: 17,
            chapter: 2,
            isFree: false,
            reencounters: [{ word: '日曜日', stage: 2, kanjiIds: ['k-hi'] }],
            lines: [line('日曜日だよ', 'grandma')],
          }),
        ],
      })
    );
    expect(issues).toEqual([]);
  });
});

describe('checkCompoundPartnerTaught', () => {
  it('対象リスト外の字(曜)は警告しない', () => {
    const issues = checkCompoundPartnerTaught(
      content({
        kanji: [kanji('k-hi', '日', 1)],
        sentences: [
          sentence({ id: 's4', order: 4, newKanjiId: 'k-hi' }),
          sentence({
            id: 's17',
            order: 17,
            reencounters: [{ word: '日曜日', stage: 2, kanjiIds: ['k-hi'] }],
          }),
        ],
      })
    );
    expect(issues).toEqual([]);
  });

  // 会話文集 #51(新聞) → #52(新) は意図的な逆順。警告として可視化する
  it('対象リスト内なのに未習の相方は警告する', () => {
    const issues = checkCompoundPartnerTaught(
      content({
        kanji: [kanji('k-kiku', '聞', 1, 4), kanji('k-atarashii', '新', 2, 4)],
        sentences: [
          sentence({ id: 's44', order: 44, chapter: 4, isFree: false, newKanjiId: 'k-kiku' }),
          sentence({
            id: 's51',
            order: 51,
            chapter: 4,
            isFree: false,
            reencounters: [{ word: '新聞', stage: 2, kanjiIds: ['k-kiku'] }],
          }),
          sentence({ id: 's52', order: 52, chapter: 4, isFree: false, newKanjiId: 'k-atarashii' }),
        ],
      })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('"新" がこの時点で未習');
  });
});

describe('checkLineSegments', () => {
  it('segments を連結すると japanese と一致する行はエラーなし', () => {
    const issues = checkLineSegments(
      content({
        kanji: [kanji('k-aruku', '歩', 1)],
        sentences: [
          sentence({
            id: 's1',
            order: 1,
            newKanjiId: 'k-aruku',
            lines: [
              line('たくさん歩きましたね。', 'mia', [
                { text: 'たくさん' },
                { text: '歩', reading: 'ある' },
                { text: 'きましたね。' },
              ]),
            ],
          }),
        ],
      })
    );
    expect(issues).toEqual([]);
  });

  it('segments が japanese と一致しなければエラー', () => {
    const issues = checkLineSegments(
      content({
        sentences: [
          sentence({
            id: 's1',
            order: 1,
            lines: [
              line('たくさん歩きましたね。', 'mia', [
                { text: 'たくさん' },
                { text: '歩', reading: 'ある' },
                // 「きましたね。」が欠けている
              ]),
            ],
          }),
        ],
      })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].message).toContain('一致しません');
    // どの文のどの行かが分からないと直せないので、書式が変わったら気づけるようにする
    expect(issues[0].message).toContain('s1');
    expect(issues[0].message).toContain('1 行目');
  });

  it('漢字を含むのに reading がなければエラー', () => {
    const issues = checkLineSegments(
      content({
        sentences: [
          sentence({
            id: 's1',
            order: 1,
            lines: [line('歩く', 'mia', [{ text: '歩' }, { text: 'く' }])],
          }),
        ],
      })
    );
    expect(
      issues.some((i) => i.level === 'error' && i.message.includes('reading がありません'))
    ).toBe(true);
  });

  it('reading がカタカナだとエラー', () => {
    const issues = checkLineSegments(
      content({
        sentences: [
          sentence({
            id: 's1',
            order: 1,
            lines: [line('歩く', 'mia', [{ text: '歩', reading: 'アル' }, { text: 'く' }])],
          }),
        ],
      })
    );
    expect(
      issues.some((i) => i.level === 'error' && i.message.includes('ひらがなではありません'))
    ).toBe(true);
  });

  it('かなだけの text に reading が付いていると警告(エラーにはしない)', () => {
    const issues = checkLineSegments(
      content({
        sentences: [
          sentence({
            id: 's1',
            order: 1,
            lines: [line('たくさん', 'mia', [{ text: 'たくさん', reading: 'たくさん' }])],
          }),
        ],
      })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warning');
  });

  it('10字を超えるセグメントは警告、10字ちょうどは警告しない', () => {
    const ten = 'あ'.repeat(10);
    const eleven = 'あ'.repeat(11);

    const issuesTen = checkLineSegments(
      content({
        sentences: [sentence({ id: 's1', order: 1, lines: [line(ten, 'mia', [{ text: ten }])] })],
      })
    );
    expect(issuesTen).toEqual([]);

    const issuesEleven = checkLineSegments(
      content({
        sentences: [
          sentence({ id: 's1', order: 1, lines: [line(eleven, 'mia', [{ text: eleven }])] }),
        ],
      })
    );
    expect(issuesEleven).toHaveLength(1);
    expect(issuesEleven[0].level).toBe('warning');
    expect(issuesEleven[0].message).toContain('10字を超えて');
  });

  it('新出漢字が他の漢字と同じセグメントに入っていると警告', () => {
    const issues = checkLineSegments(
      content({
        kanji: [kanji('k-hi', '日', 1)],
        sentences: [
          sentence({
            id: 's1',
            order: 1,
            newKanjiId: 'k-hi',
            lines: [line('今日', 'mia', [{ text: '今日', reading: 'きょう' }])],
          }),
        ],
      })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warning');
    expect(issues[0].message).toContain('他の漢字と同じセグメント');
  });

  it('新出漢字だけの単独セグメントなら警告しない', () => {
    const issues = checkLineSegments(
      content({
        kanji: [kanji('k-hi', '日', 1)],
        sentences: [
          sentence({
            id: 's1',
            order: 1,
            newKanjiId: 'k-hi',
            lines: [line('日', 'mia', [{ text: '日', reading: 'ひ' }])],
          }),
        ],
      })
    );
    expect(issues).toEqual([]);
  });
});

// --- 構造 -----------------------------------------------------------------

describe('checkNewKanjiPerSentence', () => {
  it('再登場のない特別回は落ちる', () => {
    const issues = checkNewKanjiPerSentence(
      content({
        kanji: [kanji('k-hi', '日', 1)],
        sentences: [sentence({ id: 's1', order: 1, newKanjiId: null, reencounters: [] })],
      })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('新出漢字も再登場もありません');
  });

  it('同じ漢字を2回導入すると落ちる', () => {
    const issues = checkNewKanjiPerSentence(
      content({
        kanji: [kanji('k-hi', '日', 1)],
        sentences: [
          sentence({ id: 's1', order: 1, newKanjiId: 'k-hi' }),
          sentence({ id: 's2', order: 2, newKanjiId: 'k-hi' }),
        ],
      })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('既に導入されています');
  });
});

describe('checkFreeChapterBoundary', () => {
  it('第2章が無料になっていると落ちる', () => {
    expect(
      checkFreeChapterBoundary(
        content({ sentences: [sentence({ id: 's1', order: 1, chapter: 2, isFree: true })] })
      )
    ).toHaveLength(1);
  });

  it('境界が一致していれば通る', () => {
    expect(
      checkFreeChapterBoundary(
        content({
          sentences: [
            sentence({ id: 's1', order: 1, chapter: 1, isFree: true }),
            sentence({ id: 's2', order: 2, chapter: 2, isFree: false }),
          ],
        })
      )
    ).toEqual([]);
  });
});

describe('checkChapterComposition', () => {
  it('制作途中は警告に留める', () => {
    const issues = checkChapterComposition(
      content({ sentences: [sentence({ id: 's1', order: 1, newKanjiId: 'k-hi' })] })
    );
    expect(issues.every((i) => i.level === 'warning')).toBe(true);
    expect(issues.some((i) => i.message.includes('第1章の文数が 1 です'))).toBe(true);
  });
});

describe('checkOrderSequence', () => {
  it('order が飛んでいると落ちる', () => {
    expect(
      checkOrderSequence(
        content({ sentences: [sentence({ id: 's1', order: 1 }), sentence({ id: 's3', order: 3 })] })
      )
    ).toHaveLength(1);
  });
});

describe('checkUniqueIds', () => {
  it('ID が重複すると落ちる', () => {
    expect(
      checkUniqueIds(content({ kanji: [kanji('dup', '空', 1), kanji('dup', '見', 2)] }))
    ).toHaveLength(1);
  });
});

describe('checkUniqueKanjiCharacters', () => {
  it('同じ漢字を2度登録すると落ちる', () => {
    // DB 側の kanji.character UNIQUE と対になるルール。
    // ここで弾かないと、検証は通るのにシードだけが落ちて起動できなくなる
    expect(
      checkUniqueKanjiCharacters(content({ kanji: [kanji('k1', '空', 1), kanji('k2', '空', 2)] }))
    ).toHaveLength(1);
  });

  it('別々の漢字なら通る', () => {
    expect(
      checkUniqueKanjiCharacters(content({ kanji: [kanji('k1', '空', 1), kanji('k2', '見', 2)] }))
    ).toHaveLength(0);
  });
});

describe('checkWordReferences', () => {
  it('存在しない漢字を指す単語は落ちる', () => {
    expect(
      checkWordReferences(content({ words: [word({ id: 'w1', kanjiId: 'k-missing' })] }))
    ).toHaveLength(1);
  });

  it('未出会いの単語(つぼみ)は通る', () => {
    expect(
      checkWordReferences(
        content({
          kanji: [kanji('k-sora', '空', 1)],
          words: [word({ id: 'w1', kanjiId: 'k-sora', encounteredInSentenceId: null })],
        })
      )
    ).toEqual([]);
  });
});

// --- 未習漢字の集計(検証ではない) -----------------------------------------

describe('collectUnlearnedKanjiUsage', () => {
  const usages = collectUnlearnedKanjiUsage(
    content({
      kanji: [kanji('k-hi', '日', 1), kanji('k-hana', '花', 2)],
      sentences: [
        sentence({
          id: 's4',
          order: 4,
          newKanjiId: 'k-hi',
          lines: [line('今日は花がきれいですね')],
        }),
        sentence({ id: 's36', order: 36, newKanjiId: 'k-hana' }),
      ],
    })
  );

  it('対象リスト外の字は introducedLaterAt が null', () => {
    expect(usages.find((u) => u.character === '今')?.introducedLaterAt).toBeNull();
  });

  // 「あとで習う字を先に使う」ケース。会話文集では意図的にやっているので警告にはしない
  it('あとで導入される字は導入回を持つ', () => {
    expect(usages.find((u) => u.character === '花')?.introducedLaterAt).toBe(36);
  });

  it('既習の字は集計に入らない', () => {
    expect(usages.some((u) => u.character === '日')).toBe(false);
  });
});

// --- 全体 -----------------------------------------------------------------

describe('validateContent', () => {
  it('空のコンテンツでは何も報告しない(制作開始前の状態)', () => {
    expect(validateContent(content())).toEqual([]);
  });
});
