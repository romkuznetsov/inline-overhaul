# separators — Separators и Writing rules

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группы `Tags & PKM → Separators` и `Writing rules` в `docs/SETTINGS.md`. Контролы: `First Separator`, `Second Separator`, `Mark ticked line`, `Dim ticked line`. Остальные правила записи не показаны: `Child tag format` нужен дочерний Value (в стартовом наборе их нет), `When a line empties out` на строке с текстом ничего не меняет, `Cursor after an action` видно только по каретке.

Заметка — `vault/Separators.md`, ссылка ведёт на пустую `vault/Project A.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Left Block | `Left Block: tags go before your text`, `The First Separator \|\| ends the Left Block` |
| Right Block | `Right Block: links and dates go after your text`, `The Second Separator \|\| starts the Right Block` |
| First Separator | `First Separator → ::` |
| Second Separator | `Second Separator → ::` |

Таблица собрана из `steps/separators.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/separators.steps` (технические, не согласуются).
