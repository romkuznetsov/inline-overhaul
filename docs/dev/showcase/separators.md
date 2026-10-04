# separators — Separators и Writing rules

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группы `Tags & PKM → Separators` и `Writing rules` в `docs/SETTINGS.md`. Контролы: `First Separator`, `Second Separator`, `Mark ticked line`, `Dim ticked line`. Остальные правила записи не показаны: `Child tag format` нужен дочерний Value (в стартовом наборе их нет), `When a line empties out` на строке с текстом ничего не меняет, `Cursor after an action` видно только по каретке.

Заметка — `vault/Separators.md`, ссылка ведёт на пустую `vault/Project A.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Три этапа — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | `Status next` на `- call the bank` — `#todo` и `\|\|` перед текстом | `Default: Status next → \|\| before the text` |
| 1 | `Project next` — `\|\| [[Project A]]` за текстом | `Default: Project next → \|\| after the text` |
| 1 | галочка в `- [ ] book a table` (`Toggle checkbox status` Obsidian) — тега не добавляется (зачёркивает строку сама Obsidian) | `Default: a ticked box gets no tag` |
| 2 | `First Separator` и `Second Separator` → `::` (группа Separators раскрывается щелчком по треугольнику); те же две команды — `- #todo :: call the bank :: [[Project A]]` | `Status next, Project next → :: on both sides` |
| 3 | `Mark ticked line` → `#done`, `Dim ticked line` → on; галочка в `book a table` — строка получает `#done` и бледнеет | `Tick the box → #done is added, the line fades` |

Светится фиолетовая каретка (фона строки нет — его слово 2026-10-04); у строки — плашка с командой (`hotkey: Status next`, `hotkey: Toggle checkbox status`), до нажатия.

Шаги записи — `steps/separators.steps` (технические, не согласуются).
