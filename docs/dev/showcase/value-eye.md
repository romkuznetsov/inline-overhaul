# value-eye — Fields: глаз у Value

**Состояние: перезаписан 2026-10-07 по его замечанию «не через field-next, а через tagwheel scroller»; ждёт приёмки.**

Группа `Tags & PKM → Fields`, таблица Values в `docs/SETTINGS.md`. Показан глаз перед Value в tagWheel и Scroller: скрытый Value пропускается, а строка, где он уже стоит, его держит.

Заметка `vault/Value eye.md`: строка tagWheel третьей, чтобы Scroller не закрывал заголовок. Старт: стартовый набор, в панели только Status, Scroller включён, заливка tagWheel `#fff3bf`.

## Что на экране

| Этап | Субтитры |
|---|---|
| Default | `Default: tagWheel walks #todo → #doing → #done` |
| The eye on #doing | `The eye in front of a Value hides it`, `tagWheel goes from #todo straight to #done` |
| A line that has it | `A line with #doing keeps it; the next step is #done` |

Таблица собрана из `steps/value-eye.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/value-eye.steps` (технические, не согласуются).
