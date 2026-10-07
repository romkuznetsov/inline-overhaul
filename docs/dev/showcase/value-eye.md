# value-eye — Fields: глаз у Value

**Состояние: записан впервые 2026-10-07 по заказу после ревизии документации; ждёт приёмки.**

Группа `Tags & PKM → Fields`, таблица Values в `docs/SETTINGS.md`. Показан глаз перед Value: скрытый Value пропускают `Status next`, `Status previous` и tagWheel, а строка, где он уже стоит, его держит.

Заметка `vault/Value eye.md`: строка для команд третьей, чтобы Scroller не закрывал заголовок. Старт: стартовый набор, в панели только Status, Scroller включён, заливка tagWheel `#fff3bf`.

## Что на экране

| Этап | Субтитры |
|---|---|
| Default | `Default: Status next walks #todo → #doing → #done` |
| The eye on #doing | `The eye in front of a Value hides it`, `Status next → from #todo straight to #done`, `tagWheel no longer lists #doing` |
| A line that has it | `A line with #doing keeps it`, `Status next goes on to #done` |

Таблица собрана из `steps/value-eye.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/value-eye.steps` (технические, не согласуются).
