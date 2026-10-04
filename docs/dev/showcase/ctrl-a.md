# ctrl-a — Smart SelectAll (Ctrl+A)

**Состояние: записан 2026-10-04, вторая версия (подсветка строки снята); ждёт приёмки.**

Группа `Keyboard → Global hotkeys → Smart SelectAll (Ctrl+A)` в `docs/SETTINGS.md`. Контролы в записи: `Smart Ctrl+A`, `Selection steps`. `Selection steps → Custom` и `Last press clears highlighting` — `ctrl-a-2`. `Count presses by timer` и `Time between presses` не показаны: на GIF нажатия по таймеру неотличимы от обычных.

Отдельного «до»-GIF нет (его решение 2026-10-04): этап 1 и есть встроенный Ctrl+A Obsidian.

Заметка — `vault/Trip plan.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Три этапа — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола. Текст заметки не меняется — показывается выделение.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Каретка в `Day 1: train to the coast`, Ctrl+A — выделена вся заметка | `Default: Ctrl+A selects the whole note` |
| 2 | `Smart Ctrl+A` → on; первое нажатие берёт строку, второе — всю заметку | `Ctrl+A → the line first, then the whole note` |
| 3 | `Selection steps` → `Word, line, tree, heading, note`; каретка в `Clothes`, пять нажатий: слово, строка, строка с подпунктами, раздел `Packing`, вся заметка | `Ctrl+A → word, line, tree, section, note` |

Фона подсветки у строки нет — он сливался с выделением; у строки — плашка `key: Ctrl + A`, до нажатия.

Шаги записи — `steps/ctrl-a.steps` (технические, не согласуются).
