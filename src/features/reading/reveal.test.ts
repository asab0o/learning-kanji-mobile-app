import type { KanjiEntry, Line, LineSegment, Sentence } from '@/content/types';
import { revealFor } from '@/features/reading/reveal';

// 実データに依存しないフィクスチャを使う(src/content/CLAUDE.md)。
// 実機で見られるのは #17 の1件だけなので、2字同時・語が行の途中・語が2行に出る、
// といった残り7回で必ず起きるケースはここでしか担保できない。

const DAY = '01J0000000000000000000KAN1';
const TIME = '01J0000000000000000000KAN2';
const SPAN = '01J0000000000000000000KAN3';

function kanji(id: string, character: string, overrides: Partial<KanjiEntry> = {}): KanjiEntry {
  return {
    id,
    character,
    meaning: 'meaning',
    order: 1,
    chapter: 1,
    illustrationKey: 'key',
    readings: [
      { kana: 'よみ', romaji: 'yomi', type: 'kun' },
      { kana: 'オン', romaji: 'on', type: 'on' },
    ],
    readingIntroduction: 'kun-first',
    ...overrides,
  };
}

function line(japanese: string, segments?: LineSegment[]): Line {
  return {
    speaker: 'grandma',
    japanese,
    segments: segments ?? [{ text: japanese }],
    romaji: 'Romaji.',
    english: 'english',
  };
}

function sentence(overrides: Partial<Sentence> = {}): Sentence {
  return {
    id: '01J0000000000000000000SEN1',
    chapter: 2,
    order: 17,
    scene: '台所',
    lines: [],
    newKanjiId: null,
    reencounters: [],
    isFree: false,
    ...overrides,
  };
}

/** #17「日曜日」と同じ形 */
const sundayLine = () =>
  line('日曜日だよ。ゆっくりしなさい。', [
    { text: '日', reading: 'にち' },
    { text: '曜', reading: 'よう' },
    { text: '日', reading: 'び' },
    { text: 'だよ。' },
    { text: 'ゆっくりしなさい。' },
  ]);

const dayKanji = kanji(DAY, '日', {
  meaning: 'day, sun',
  readings: [
    { kana: 'ひ', romaji: 'hi', type: 'kun' },
    { kana: 'にち', romaji: 'nichi', type: 'on' },
  ],
});

const sunday = (overrides: Partial<Sentence> = {}) =>
  sentence({
    lines: [line('きょうは、何の日ですか？'), sundayLine()],
    reencounters: [{ word: '日曜日', stage: 2, kanjiIds: [DAY] }],
    ...overrides,
  });

describe('revealFor', () => {
  it('#17 と同じ形から演出の材料を組み立てる', () => {
    const reveal = revealFor(sunday(), [dayKanji]);

    expect(reveal).not.toBeNull();
    expect(reveal?.word).toBe('日曜日');
    expect(reveal?.wordKana).toBe('にちようび');
    expect(reveal?.lineIndex).toBe(1);
    expect(reveal?.badgeSegmentIndex).toBe(0);
    expect(reveal?.kanjiIds).toEqual([DAY]);
  });

  it('1字が語中で2回別読みになるとき、両方を出現順に返す', () => {
    const reveal = revealFor(sunday(), [dayKanji]);

    expect(reveal?.kanji).toEqual([
      { character: '日', meaning: 'day, sun', from: 'ひ', to: ['にち', 'び'] },
    ]);
  });

  it('2字同時の回では字ごとに分かれる', () => {
    // #38「時間」。とき + あいだ → じかん
    const jikan = sentence({
      lines: [
        line('時間がたつのは早いよ。', [
          { text: '時', reading: 'じ' },
          { text: '間', reading: 'かん' },
          { text: 'がたつのは' },
          { text: '早', reading: 'はや' },
          { text: 'いよ。' },
        ]),
      ],
      reencounters: [{ word: '時間', stage: 2, kanjiIds: [TIME, SPAN] }],
    });
    const entries = [
      kanji(TIME, '時', {
        meaning: 'time',
        readings: [{ kana: 'とき', romaji: 'toki', type: 'kun' }],
      }),
      kanji(SPAN, '間', {
        meaning: 'interval',
        readings: [{ kana: 'あいだ', romaji: 'aida', type: 'kun' }],
      }),
    ];

    const reveal = revealFor(jikan, entries);

    expect(reveal?.wordKana).toBe('じかん');
    expect(reveal?.kanji).toEqual([
      { character: '時', meaning: 'time', from: 'とき', to: ['じ'] },
      { character: '間', meaning: 'interval', from: 'あいだ', to: ['かん'] },
    ]);
  });

  it('語が行の途中にあっても ★ の位置が語の先頭になる', () => {
    const midLine = sentence({
      lines: [
        line('あれは日曜日だよ。', [
          { text: 'あれは' },
          { text: '日', reading: 'にち' },
          { text: '曜', reading: 'よう' },
          { text: '日', reading: 'び' },
          { text: 'だよ。' },
        ]),
      ],
      reencounters: [{ word: '日曜日', stage: 2, kanjiIds: [DAY] }],
    });

    expect(revealFor(midLine, [dayKanji])?.badgeSegmentIndex).toBe(1);
  });

  it('語の範囲外にある同じ字の読みは拾わない', () => {
    const extra = sunday({
      lines: [
        line('日曜日だよ。いい日だね。', [
          { text: '日', reading: 'にち' },
          { text: '曜', reading: 'よう' },
          { text: '日', reading: 'び' },
          { text: 'だよ。いい' },
          { text: '日', reading: 'ひ' },
          { text: 'だね。' },
        ]),
      ],
    });

    expect(revealFor(extra, [dayKanji])?.kanji[0].to).toEqual(['にち', 'び']);
  });

  it('語中で同じ読みが2回出たら重複を除く', () => {
    const repeated = sentence({
      lines: [
        line('日日だよ。', [
          { text: '日', reading: 'にち' },
          { text: '日', reading: 'にち' },
          { text: 'だよ。' },
        ]),
      ],
      reencounters: [{ word: '日日', stage: 2, kanjiIds: [DAY] }],
    });

    expect(revealFor(repeated, [dayKanji])?.kanji[0].to).toEqual(['にち']);
  });

  it('第2段階の再登場が無ければ null', () => {
    expect(revealFor(sunday({ reencounters: [] }), [dayKanji])).toBeNull();
  });

  it('第1段階の再登場には反応しない', () => {
    const stage1 = sunday({ reencounters: [{ word: '日曜日', stage: 1, kanjiIds: [DAY] }] });

    expect(revealFor(stage1, [dayKanji])).toBeNull();
  });

  it('演出語がどの行にも無ければ null(例外を投げない)', () => {
    expect(revealFor(sunday({ lines: [line('きょうは、何の日ですか？')] }), [dayKanji])).toBeNull();
  });

  it('演出語が2行に現れたら null(どちらで演出するか決められない)', () => {
    const twice = sunday({ lines: [sundayLine(), line('日曜日ですね。')] });

    expect(revealFor(twice, [dayKanji])).toBeNull();
  });

  it('語が1セグメントにまとまっていたら null(字ごとの読みを取り出せない)', () => {
    const merged = sunday({
      lines: [
        line('日曜日だよ。', [{ text: '日曜日', reading: 'にちようび' }, { text: 'だよ。' }]),
      ],
    });

    expect(revealFor(merged, [dayKanji])).toBeNull();
  });

  it('語の範囲に reading の無いセグメントがあれば null', () => {
    const missing = sunday({
      lines: [
        line('日曜日だよ。', [
          { text: '日', reading: 'にち' },
          { text: '曜' },
          { text: '日', reading: 'び' },
          { text: 'だよ。' },
        ]),
      ],
    });

    expect(revealFor(missing, [dayKanji])).toBeNull();
  });

  it('対象字の漢字が見つからなければ null', () => {
    expect(revealFor(sunday(), [])).toBeNull();
  });

  it('対象字に訓読みが登録されていなければ null(変わる前の読みを出せない)', () => {
    const onOnly = kanji(DAY, '日', {
      readings: [{ kana: 'にち', romaji: 'nichi', type: 'on' }],
      readingIntroduction: 'on-only',
    });

    expect(revealFor(sunday(), [onOnly])).toBeNull();
  });

  it('対象字が演出語に含まれていなければ null', () => {
    const wrong = sunday({ reencounters: [{ word: '日曜日', stage: 2, kanjiIds: [TIME] }] });
    const entries = [dayKanji, kanji(TIME, '時')];

    expect(revealFor(wrong, entries)).toBeNull();
  });
});
