# placement — Placement modes

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Tags & PKM → Placement modes` в `docs/SETTINGS.md`. Два контрола: `Strict: add a bullet`, `Keep typed tags in text`. `Insert only: use Field Prefix` и группа `Prefix priority` не показаны: у Values стартового набора нет своего Prefix, и в заметке они ничего не меняют.

Заметка — `vault/Placement.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Default placement | `Default: Status next → no bullet is added`, `Default: a typed tag stays in the text` |
| Strict: add a bullet | `Strict: add a bullet → on`, `Status next → the line gets a bullet` |
| Typed tags to their Block | `Keep typed tags in text → off`, `Status next → #high moves to its Block` |

Таблица собрана из `steps/placement.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/placement.steps` (технические, не согласуются).
