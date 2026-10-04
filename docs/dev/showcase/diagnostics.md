# diagnostics — Advanced → Diagnostics

**Состояние: записан 2026-10-04, вторая версия (добавлены id в подсказках); ждёт приёмки.**

Группа `Advanced → Diagnostics` в `docs/SETTINGS.md`. Контролы в записи: команда `Undo last settings change` (у неё есть поведение в заметке) и `Show option IDs in tips`. `Developer logging` не записан: его результат — заметка журнала, показывать её на GIF нечего.

Отмена показана на `Navigation`, а не на `Visual`: после отмены `Visual → off` заметка остаётся без оформления, пока её не правят (см. отчёт среза).

Заметка — `vault/Home tasks.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Три этапа — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Move up поднимает `Water the plants` | `Default: Move up works` |
| 2 | `Navigation` → off; Move up — строка стоит, сообщение, что Navigation выключен | `Navigation → off, by mistake`, `Move up → only a message that Navigation is off` |
| 2 | `Undo last settings change` — сообщение `Last settings change undone`; Move up снова поднимает строку | `Undo last settings change → Move up works again` |
| 3 | Вкладка Advanced: `Show option IDs in tips` → on; открыта подсказка `?` у `Your settings` — последней строкой в ней `settings-backup-actions` | `Show option IDs in tips → on: a tip ends with its id` |

Подсвечивается строка, на которой нажимается команда; у строки — плашка с командой (`hotkey: Move up`, `hotkey: Undo last settings change`), до нажатия.

Шаги записи — `steps/diagnostics.steps` (технические, не согласуются).
