"""content.py(`src/content/index.ts` の読み取り)のテスト。"""

from __future__ import annotations

import pytest
from content import markdown_table, read_kanji

SAMPLE = """
export const KANJI: KanjiEntry[] = [
  {
    id: K.person,
    character: '人',
    meaning: 'person',
    order: 1,
    chapter: 1,
    illustrationKey: 'person',
    readings: [{ kana: 'ひと', romaji: 'hito', type: 'kun' }],
  },
  {
    id: K.cheap,
    character: '安',
    meaning: 'cheap, at ease',
    order: 49,
    chapter: 4,
    illustrationKey: 'cheap',
    readings: [],
  },
];
"""


@pytest.fixture
def content_file(tmp_path):
    p = tmp_path / "index.ts"
    p.write_text(SAMPLE, encoding="utf-8")
    return p


def test_reads_every_entry(content_file):
    assert [k.key for k in read_kanji(content_file)] == ["person", "cheap"]


def test_pairs_character_with_its_own_key(content_file):
    by_key = {k.key: k.character for k in read_kanji(content_file)}
    assert by_key == {"person": "人", "cheap": "安"}


def test_keeps_commas_inside_meaning(content_file):
    """`meaning: 'cheap, at ease'` を途中で切らない(値のカンマで壊れた実バグの回帰)。"""
    cheap = next(k for k in read_kanji(content_file) if k.key == "cheap")
    assert cheap.meaning == "cheap, at ease"


def test_reads_order_and_chapter_as_ints(content_file):
    cheap = next(k for k in read_kanji(content_file) if k.key == "cheap")
    assert (cheap.order, cheap.chapter) == (49, 4)


def test_raises_when_nothing_parsed(tmp_path):
    empty = tmp_path / "index.ts"
    empty.write_text("export const KANJI = [];\n", encoding="utf-8")
    with pytest.raises(ValueError):
        read_kanji(empty)


def test_markdown_table_is_sorted_by_order(content_file):
    entries = list(reversed(read_kanji(content_file)))  # わざと逆順で渡す
    lines = markdown_table(entries).splitlines()
    assert lines[2].startswith("| 1 |")
    assert lines[3].startswith("| 49 |")
    assert "`assets/temp/person.png`" in lines[2]
