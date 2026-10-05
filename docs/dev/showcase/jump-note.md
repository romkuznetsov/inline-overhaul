# jump-note — Jump inside a note (up/down)

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Navigation → Jump inside a note (up/down)` в `docs/SETTINGS.md`. Контролы: `Where in the section`, `Jump target`; `Cursor position after jumping` — умолчанием (`Text end`: каретка встаёт в конец текста строки).

Не показаны: `Jump between headings` → off (команды ничего не делают), `Cursor position after jumping` — другие значения, `Follow the jump target` и `Where the target lands` (заметка помещается в окно, прокручивать нечего).

Заметка — `vault/Week notes.md`: три раздела `Monday`, `Tuesday`, `Wednesday` с нумерованными пунктами. Клавиши — `Jump down`, `Jump up`. Команды меняют только место каретки, текст не меняется. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Default Obsidian | `Obsidian: ↓ walks through every line` |
| Jump between headings | `Jump between headings → on`, `Jump down stops at the end of a section…`, `…then at the start of the next one`, `Jump up walks back the same way` |
| Start only | `Where in the section → Start only`, `Jump down → only the first line of each section` |
| Jump target: Lines | `Jump target → Lines`, `Jump down → line by line, headings included` |

Таблица собрана из `steps/jump-note.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/jump-note.steps` (технические, не согласуются).
