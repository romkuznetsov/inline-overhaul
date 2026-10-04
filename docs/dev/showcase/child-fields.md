# child-fields — Fields: дочерний Field

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Tags & PKM → Fields`, строка `Child Field` в `docs/SETTINGS.md`. Дочерний Value заводится в таблице Values стрелкой уровня: `#review` встаёт под `#done`, и дочерний Field Status предлагает его. Показаны `After parent` и `Always`. `On Alt`, `Parent Value` и `Parent is Navigator` не показаны: при текущем темпе GIF выходит за 60 с; это будет `child-fields-2`.

Заметка — `vault/Child fields.md`. Старт — стартовый набор, светлая тема, английский интерфейс. В стартовом наборе дочерних Value нет, и `Child Field` стоит на `Hide`.

## Что на экране

Три этапа — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | tagWheel Left на `- #done \|\| call the bank`: `→` `→` — только Status и Priority; `Esc` | `Default: tagWheel has Status and Priority` |
| 2 | в таблице Values Status: набрать `review`, `Add Value`, стрелка уровня — `#review` под `#done`; `Child Field` → `After parent`. tagWheel Left на той же строке: после Status появляется `sub`, `→` `↑` — `#review`, `Enter` — `- #done #review \|\| call the bank` | `After #done → its child Field offers #review` |
| 3 | `Child Field` → `Always`; tagWheel Left на `- pay the rent` без Status: `sub` есть и так, `→` `↑` — `#review`, `Enter` — `- #review \|\| pay the rent` | `Always → the child is offered without a parent` |

Светится фиолетовая каретка (фона строки нет — его слово 2026-10-04); у строки — плашка: `hotkey: tagWheel Left`, затем каждая клавиша.

Шаги записи — `steps/child-fields.steps` (технические, не согласуются).
