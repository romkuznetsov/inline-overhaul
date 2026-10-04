# tagwheel-look — Visual → tagWheel (Panel, Scroller)

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Visual → tagWheel` в `docs/SETTINGS.md`. Показаны два контрола: `Show tag markers` (Panel) и `Scroller` (Scroller). Цвета панели и скроллера, `Scroller size` — без записи: инструмент пока не умеет ставить цвет и ползунок. `Highlight the tagWheel line` = off снят из записи: с ним открытый tagWheel показывает в строке лишние `**` (похоже на поломку, вопрос в отчёте сессии). Поведение tagWheel (выбор Value) — запись `tagwheel`.

Заметка — `vault/tagWheel look.md`. Команда — `tagWheel Left`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Три этапа — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка. tagWheel каждый раз закрывается `Escape`, строка возвращается как была.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | На строке `Buy groceries` открывается tagWheel: строка подсвечена, Value `#todo` в скобках | `Default: tagWheel Left → the picker opens on the line` |
| 1 | `Escape` — tagWheel закрыт, строка прежняя | `Escape → the line is back as it was` |
| 2 | `Show tag markers` → off; tagWheel пишет Values без решётки: `[todo] low` | `tagWheel Left → Values without the #` |
| 3 | `Scroller` → on; над строкой и под ней — рамки с соседними Values | `tagWheel Left → neighbor Values above and below` |
| 3 | `↓` — Value сменилось, рамки прокрутились; `Escape` — строка прежняя | `↓ → the next Value, the Scroller rolls` |

Подсвечивается строка, на которой открыт tagWheel; у строки — плашка с командой (`hotkey: tagWheel Left`) или клавишей (`key: Escape`, `key: ↓`), до нажатия.

Шаги записи — `steps/tagwheel-look.steps` (технические, не согласуются).
