# separator-rewrite — Separators: замена старого во всех заметках

**Состояние: записан впервые 2026-10-07 по заказу после ревизии документации; ждёт приёмки.**

Группа `Tags & PKM → Separators`, строка `Old Separators in your notes` в `docs/SETTINGS.md`. Показаны: оба Separator `||` → `::`, старые строки остаются с `||`, появляется строка `Old Separators in your notes`, окно `Replace old Separators` с числом строк и заметок, итог в двух заметках.

Заметка `vault/Separator rewrite.md` слева, `vault/Home tasks.md` справа (`pane`): видно, что замена идёт во всех заметках. Старт: стартовый набор. Число в окне (60 строк в 24 заметках) считает весь демо-vault. Окно панели с окном внутри поднято запасом `room 400`, поэтому под заметкой пусто.

## Что на экране

| Этап | Субтитры |
|---|---|
| Change a Separator | `Both Separators \|\| → ::`, `Lines written before still read \|\|` |
| Old Separators in your notes | `A new row: Old Separators in your notes`, `The window counts the lines and notes` |
| The result | `Every old line now reads ::` |

Таблица собрана из `steps/separator-rewrite.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/separator-rewrite.steps` (технические, не согласуются).
