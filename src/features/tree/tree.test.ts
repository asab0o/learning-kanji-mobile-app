import type { KanjiEntry, Word } from '@/content/types';
import type { CompletedLesson } from '@/features/tree/tree';
import { buildKanjiTree, buildTreeIndex } from '@/features/tree/tree';

/**
 * フィクスチャで組む。実データ(`@/content`)を入力にすると、語を1つ足すたびに
 * 「`空` は3語」のような前提が壊れる。見たいのは判定規則であってコンテンツではない。
 */
const kanji = (id: string, order: number): KanjiEntry => ({
  id,
  character: id,
  meaning: `meaning of ${id}`,
  order,
  chapter: 1,
  illustrationKey: id,
  readings: [],
  readingIntroduction: 'kun-first',
});

const word = (
  id: string,
  kanjiId: string,
  encounteredInSentenceId: string | null,
  readingType: 'kun' | 'on' = 'kun'
): Word => ({
  id,
  kanjiId,
  surface: id,
  kana: id,
  meaning: id,
  readingType,
  encounteredInSentenceId,
});

const lesson = (sentenceId: string, kanjiId: string | null): CompletedLesson => ({
  sentenceId,
  kanjiId,
});

/** `空` を模した1字: 導入回 s35 で `空`、後の回 s40 で `空港`、`空気` はどこにも出ない */
const sky = kanji('sky', 1);
const skyWords: Word[] = [
  word('sora', 'sky', 's35', 'kun'),
  word('kuuki', 'sky', null, 'on'),
  word('kuukou', 'sky', 's40', 'on'),
];

describe('buildKanjiTree', () => {
  it('encounteredInSentenceId が null の語は、どんな lessons を渡してもつぼみ', () => {
    const tree = buildKanjiTree({
      kanji: sky,
      words: skyWords,
      lessons: [lesson('s35', 'sky'), lesson('s40', null), lesson('s99', 'other')],
    });

    expect(tree.leaves.find((leaf) => leaf.wordId === 'kuuki')?.state).toBe('bud');
  });

  it('encounteredInSentenceId の回を終えていれば葉、終えていなければつぼみ', () => {
    const tree = buildKanjiTree({ kanji: sky, words: skyWords, lessons: [lesson('s35', 'sky')] });

    expect(tree.leaves.map((leaf) => [leaf.wordId, leaf.state])).toEqual([
      ['sora', 'leaf'],
      ['kuuki', 'bud'],
      ['kuukou', 'bud'],
    ]);
    expect(tree.encounteredCount).toBe(1);
    expect(tree.totalCount).toBe(3);
  });

  it('第2段階の回(kanjiId: null)を終えても、その回の語は葉になる', () => {
    const tree = buildKanjiTree({
      kanji: sky,
      words: skyWords,
      lessons: [lesson('s35', 'sky'), lesson('s40', null)],
    });

    expect(tree.leaves.find((leaf) => leaf.wordId === 'kuukou')?.state).toBe('leaf');
    expect(tree.encounteredCount).toBe(2);
  });

  it('同じ回の記録が二重に入っていても encounteredCount は増えない', () => {
    const tree = buildKanjiTree({
      kanji: sky,
      words: skyWords,
      lessons: [lesson('s35', 'sky'), lesson('s35', 'sky')],
    });

    expect(tree.encounteredCount).toBe(1);
  });

  it('lessons が空なら葉は全部つぼみ', () => {
    const tree = buildKanjiTree({ kanji: sky, words: skyWords, lessons: [] });

    expect(tree.leaves.every((leaf) => leaf.state === 'bud')).toBe(true);
    expect(tree.encounteredCount).toBe(0);
  });

  it('全語を渡しても、その字の語だけを入力順で返す', () => {
    const other = word('x', 'other', 's1');
    const tree = buildKanjiTree({
      kanji: sky,
      words: [other, ...skyWords],
      lessons: [],
    });

    expect(tree.leaves.map((leaf) => leaf.wordId)).toEqual(['sora', 'kuuki', 'kuukou']);
  });

  it('語が1つも無い字でも落ちず totalCount: 0 を返す', () => {
    const tree = buildKanjiTree({ kanji: kanji('lonely', 9), words: skyWords, lessons: [] });

    expect(tree.leaves).toEqual([]);
    expect(tree.totalCount).toBe(0);
    expect(tree.encounteredCount).toBe(0);
  });

  it('葉の内容(表記・読み・意味・読みの種別)をそのまま持つ', () => {
    const tree = buildKanjiTree({ kanji: sky, words: skyWords, lessons: [] });

    expect(tree.leaves[1]).toEqual({
      wordId: 'kuuki',
      surface: 'kuuki',
      kana: 'kuuki',
      meaning: 'kuuki',
      readingType: 'on',
      state: 'bud',
    });
  });
});

describe('buildTreeIndex', () => {
  const person = kanji('person', 1);
  const day = kanji('day', 2);
  const all = [person, sky, day];
  const words: Word[] = [
    ...skyWords,
    word('hito', 'person', 's1'),
    word('sannin', 'person', 's1'),
    word('gaikokujin', 'person', 's30'),
    word('hi', 'day', 's4'),
  ];

  it('kanjiId を持つ lesson_events がある字だけを、入力の順序で返す', () => {
    const index = buildTreeIndex({
      kanji: all,
      words,
      lessons: [lesson('s35', 'sky'), lesson('s1', 'person')],
    });

    expect(index.met.map((entry) => entry.id)).toEqual(['person', 'sky']);
  });

  it('各字の「出会った語数 / 総語数」を返す', () => {
    const index = buildTreeIndex({ kanji: all, words, lessons: [lesson('s1', 'person')] });

    expect(index.summaries.get('person')).toEqual({ encounteredCount: 2, totalCount: 3 });
    expect(index.summaries.has('sky')).toBe(false);
  });

  it('kanjiId: null の記録(第2段階専用の回)だけでは met は空', () => {
    const index = buildTreeIndex({ kanji: all, words, lessons: [lesson('s40', null)] });

    expect(index.met).toEqual([]);
    expect(index.summaries.size).toBe(0);
  });

  it('lessons が空なら met は空', () => {
    expect(buildTreeIndex({ kanji: all, words, lessons: [] }).met).toEqual([]);
  });

  it('マスタに無い字の記録は無視する', () => {
    const index = buildTreeIndex({ kanji: all, words, lessons: [lesson('s9', 'ghost')] });

    expect(index.met).toEqual([]);
  });
});
