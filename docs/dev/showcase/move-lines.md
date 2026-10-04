# move-lines — Move lines (up/down), основные контролы

**Состояние: записан 2026-10-04, вторая версия по его замечаниям; ждёт приёмки.**

Группа `Navigation → Move lines (up/down)` в `docs/SETTINGS.md`. Четыре ключевых
контрола: `Moving behavior`, `Jump over neighbor trees`, `Moving headings`,
`Cross heading boundaries`. Остальные четыре — `move-lines-2`. «До» (встроенный
перенос Obsidian) — `move-lines-before`.

Заметка — `vault/Weekly plan.md`. Клавиши: `Move up` = `Ctrl+Shift+↑`. Старт —
стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Пять этапов — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка. Внутри этапа заметка правится подряд, отката на экране нет.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | `Pay the rent` вверх — едет одна строка, подпункты остаются | `Default: Move up → only the line moves` |
| 1 | `## Work` вверх — едет одна строка заголовка, `Buy groceries` оказывается в разделе Work | `Default: a heading moves on its own` |
| 1 | `Write the report` вверх дважды — поднимается внутри раздела, затем уходит в Errands | `Default: a line can leave its section` |
| 2 | `Moving behavior` → `Whole tree`; `Pay the rent` едет с подпунктами, но заходит в подпункты соседа | `Move up → the line takes its sub-items along` |
| 3 | `Jump over neighbor trees` → on; дерево перескакивает соседнее целиком | `Move up → it jumps over the whole neighbor` |
| 4 | `Moving headings` → `Whole section`; раздел Work встаёт над Errands | `Move up → the whole section moves` |
| 5 | `Cross heading boundaries` → off; `Review the slides` снизу поднимается до заголовка и дальше не идёт | `Move up → it stops at its heading` |

Подсвечивается строка, которая едет; у строки — плашка с командой (`hotkey: Move up`), до нажатия. Список нумерованный: номера после переноса пересчитывает сам Obsidian.

Шаги записи — `steps/move-lines.steps` (технические, не согласуются).
