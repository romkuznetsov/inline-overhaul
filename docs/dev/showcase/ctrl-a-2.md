# ctrl-a-2 — Smart SelectAll (Ctrl+A), вторая часть

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Keyboard → Global hotkeys → Smart SelectAll (Ctrl+A)` в `docs/SETTINGS.md`. Контролы в записи: `Selection steps → Custom` с галочками `Steps to cycle through`, `Last press clears highlighting`. Первая часть — `ctrl-a`.

Заметка — `vault/Trip plan.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Три этапа — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола. Текст заметки не меняется — показывается выделение.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Ctrl+A — выделена вся заметка | `Default: Ctrl+A selects the whole note` |
| 2 | `Smart Ctrl+A` → on, `Selection steps` → `Custom`; к стоящим `line` и `note` ставятся галочки `word` и `heading`; каретка в `Clothes`, четыре нажатия: слово, строка, раздел `Packing`, вся заметка | `Selection steps → Custom: tick where a press stops`, `Ctrl+A → word, line, section, note` |
| 3 | `Last press clears highlighting` → on; те же четыре нажатия и пятое — выделение снято, каретка вернулась в `Clothes` | `After the note, one more press lets go` |

Фона подсветки у строки нет — он сливался с выделением; у строки — плашка `key: Ctrl + A`, до нажатия.

Шаги записи — `steps/ctrl-a-2.steps` (технические, не согласуются).
