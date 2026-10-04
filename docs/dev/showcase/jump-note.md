# jump-note — Jump inside a note (up/down)

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Navigation → Jump inside a note (up/down)` в `docs/SETTINGS.md`. Контролы: `Where in the section`, `Jump target`; `Cursor position after jumping` — умолчанием (`Text end`: каретка встаёт в конец текста строки).

Не показаны: `Jump between headings` → off (команды ничего не делают), `Cursor position after jumping` — другие значения, `Follow the jump target` и `Where the target lands` (заметка помещается в окно, прокручивать нечего).

Заметка — `vault/Week notes.md`: три раздела `Monday`, `Tuesday`, `Wednesday` с нумерованными пунктами. Клавиши — `Jump down`, `Jump up`. Команды меняют только место каретки, текст не меняется. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Три этапа — полоса внизу GIF.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | каретка на `## Monday`, вниз — последняя строка раздела, `fix the shelf` | `Default: Jump down stops at the end of a section…` |
| 1 | вниз дважды — `book a table` (начало Tuesday), затем `send the photos` (его конец) | `…then at the start of the next one` |
| 1 | вверх — обратно к `book a table` | `Jump up walks back the same way` |
| 2 | `Where in the section` → `Start only`; с `## Monday` вниз трижды — `call the plumber`, `book a table`, `pay the rent` | `Jump down → only the first line of each section` |
| 3 | `Jump target` → `Lines`; с `## Monday` вниз пять раз — по каждой строке, включая заголовок `## Tuesday` | `Jump down → line by line, headings included` |

Светится фиолетовая каретка (фона строки нет — его слово 2026-10-04); у строки — плашка с командой (`hotkey: Jump down` / `Jump up`), до нажатия.

Шаги записи — `steps/jump-note.steps` (технические, не согласуются).
