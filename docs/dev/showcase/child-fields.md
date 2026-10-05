# child-fields — Fields: дочерний Field

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Tags & PKM → Fields`, строка `Child Field` в `docs/SETTINGS.md`. Дочерний Value заводится в таблице Values стрелкой уровня: `#review` встаёт под `#done`, и дочерний Field Status предлагает его. Показаны `After parent` и `Always`. `On Alt`, `Parent Value` и `Parent is Navigator` не показаны: при текущем темпе GIF выходит за 60 с; это будет `child-fields-2`.

Заметка — `vault/Child fields.md`. Старт — стартовый набор, светлая тема, английский интерфейс. В стартовом наборе дочерних Value нет, и `Child Field` стоит на `Hide`.

## Что на экране

| Этап | Субтитры |
|---|---|
| Status and Priority | `tagWheel has two Fields: Status and Priority` |
| Child Field: After parent | `Add #review under #done, Child Field → After parent`, `After #done → its child Field offers #review` |
| Child Field: Always | `Child Field → Always`, `Always → the child is offered without a parent` |

Таблица собрана из `steps/child-fields.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/child-fields.steps` (технические, не согласуются).
