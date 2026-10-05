# diagnostics — Advanced → Diagnostics

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Advanced → Diagnostics` в `docs/SETTINGS.md`. Контролы в записи: команда `Undo last settings change` (у неё есть поведение в заметке) и `Show option IDs in tips`. `Developer logging` не записан: его результат — заметка журнала, показывать её на GIF нечего.

Отмена показана на `Navigation`, а не на `Visual`: после отмены `Visual → off` заметка остаётся без оформления, пока её не правят (см. отчёт среза).

Заметка — `vault/Home tasks.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Move up works | `Default: Move up works` |
| Undo a change | `Navigation → off, by mistake`, `Move up → only a message that Navigation is off`, `Undo last settings change → Move up works again` |
| Option IDs | `Show option IDs in tips → on: a tip ends with its id` |

Таблица собрана из `steps/diagnostics.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/diagnostics.steps` (технические, не согласуются).
