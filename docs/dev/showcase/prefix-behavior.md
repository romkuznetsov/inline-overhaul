# prefix-behavior — Prefix behavior у Field

**Состояние: записан впервые 2026-10-06 по его слову к placement: «нужно добавить этап, где показывается, где меняется Prefix behavior и чем они различаются, возможно нужна отдельная gif»; ждёт приёмки.**

Контрол `Prefix behavior` живёт в редакторе Fields, раздел `Behavior` выбранного Field (`docs/SETTINGS.md`, Fields). Чтобы режимы различались, у `#todo` на камеру ставится свой Prefix `[ ]`. Что даёт `Status next` (снято на стенде):

| Режим | простая строка | строка списка |
|---|---|---|
| Strict | `- [ ] #todo` | `- [ ] #todo` |
| Insert only | `#todo` | `- [ ] #todo` |
| Insert only, `Insert only: use Field Prefix` off | `#todo` | `- #todo` |

Заметка — `vault/Prefix behavior.md`. Подсветки нет (его слово к placement: «убери подсветку вообще»).

## Что на экране

| Этап | Субтитры |
|---|---|
| Where it is | `Prefix behavior lives in each Field, under Behavior`, `This is the Status Field`, `Prefix behavior: Strict or Insert only`, `#todo brings the checkbox [ ] as its Prefix` |
| Strict | `Strict: Status next on a plain line`, `Even a plain line gets the checkbox` |
| Insert only | `Prefix behavior → Insert only`, `Insert only: Status next on a plain line`, `A plain line stays plain`, `Status next on a list line`, `A list line still gets the checkbox` |
| Without Field Prefix | `Insert only: use Field Prefix → off`, `Status next on a list line`, `The bullet stays, no checkbox` |

Таблица собрана из `steps/prefix-behavior.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/prefix-behavior.steps` (технические, не согласуются).
