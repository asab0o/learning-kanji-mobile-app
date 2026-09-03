"""`src/content/index.ts` から 漢字 ↔ illustrationKey の対応を読む。

manifest を手で書くと、既にコードにあるデータを50行ぶん転記することになり、
`key` の打ち間違いが規約違反のファイル名を静かに生む。正は `KanjiEntry` 側に一本化し、
ここはそれを読むだけにする。

TypeScript を実行せず正規表現で読むのは、この Python ツールに Node を持ち込まないため。
`KanjiEntry` の並び(`character` → … → `illustrationKey`)に依存しているので、
`src/content/types.ts` のフィールド順を入れ替えたらここも直す。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

# 値はクォート付き文字列か数値。`meaning: 'cheap, at ease'` のように
# 文字列側にはカンマが入りうるので、クォートの中は貪欲に取る
FIELD = re.compile(
    r"^\s*(character|order|chapter|illustrationKey|meaning)\s*:\s*"
    r"(?:'([^']*)'|(\d+))\s*,\s*$"
)


@dataclass(frozen=True)
class Kanji:
    key: str
    character: str
    meaning: str
    order: int
    chapter: int


def read_kanji(content_index: Path) -> list[Kanji]:
    """`KanjiEntry` を出現順に読む。`illustrationKey` 行でひとつ確定させる。"""
    entries: list[Kanji] = []
    pending: dict[str, str] = {}

    for line in content_index.read_text(encoding="utf-8").splitlines():
        m = FIELD.match(line)
        if not m:
            continue
        field = m.group(1)
        value = m.group(2) if m.group(2) is not None else m.group(3)
        if field == "illustrationKey":
            # character が無いまま来たら KanjiEntry ではない(会話文側など)ので捨てる
            if "character" in pending:
                entries.append(
                    Kanji(
                        key=value,
                        character=pending["character"],
                        meaning=pending.get("meaning", ""),
                        order=int(pending.get("order", 0)),
                        chapter=int(pending.get("chapter", 0)),
                    )
                )
            pending = {}
        else:
            pending[field] = value

    if not entries:
        raise ValueError(f"{content_index} から KanjiEntry を1件も読めなかった")
    return entries


def markdown_table(entries: list[Kanji]) -> str:
    """`docs/対象漢字リスト.md` に貼る対応表。`--list` で再生成できるようにしてある。"""
    rows = [
        "| # | 章 | 漢字 | illustrationKey | 意味 | 生画像の置き場所 |",
        "|---|---|---|---|---|---|",
    ]
    for e in sorted(entries, key=lambda k: k.order):
        rows.append(
            f"| {e.order} | {e.chapter} | {e.character} | `{e.key}` | {e.meaning} "
            f"| `assets/temp/{e.key}.png` |"
        )
    return "\n".join(rows)
