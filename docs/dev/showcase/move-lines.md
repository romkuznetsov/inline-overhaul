# move-lines — Move lines (up/down), основные контролы

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; «до» (`move-lines-before`) влит первым этапом.**

Группа `Navigation → Move lines (up/down)` в `docs/SETTINGS.md`. Контролы: `Move lines`, `Moving behavior`, `Jump over neighbor trees`, `Moving headings`, `Cross heading boundaries`. Остальные — `move-lines-2`.

Заметка — `vault/Weekly plan.md`. `Move lines` выключен до ролика и включается на камеру.

## Что на экране

| Этап | Что показывается | Субтитр |
|---|---|---|
| Default Obsidian | встроенная `Move line up` трижды: `Pay the rent` уходит одна, подпункты остаются, список ломается | `Obsidian: Move line up moves just this one line`, `Its own sub-items stayed behind: the list is broken` |
| Whole tree | `Move lines` → on и `Moving behavior` → `Whole tree`; `Pay the rent` едет с подпунктами, но заходит в подпункты соседа | `Move lines → on, Moving behavior → Whole tree`, `Move up → the line takes its sub-items along` |
| Jump over trees | `Jump over neighbor trees` → on; дерево перескакивает соседнее целиком | `Move up → it jumps over the whole neighbor` |
| Whole section | `Moving headings` → `Whole section`; раздел Work встаёт над Errands | `Move up → the whole section moves` |
| Stop at headings | `Cross heading boundaries` → off; `Review the slides` поднимается до заголовка и дальше не идёт | `Move up → it stops at its heading` |

Подсвечивается строка, которая едет (`mark line`); плашка — имя команды. `Move lines` по умолчанию двигает одну строку, как Obsidian, — поэтому его включение и `Whole tree` — один этап. 55 с.

Шаги записи — `steps/move-lines.steps` (технические, не согласуются).
