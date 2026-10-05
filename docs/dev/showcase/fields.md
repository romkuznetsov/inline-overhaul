# fields — Field и его Values через tagWheel

**Состояние: перезаписан 2026-10-05 по его сценарию; один из трёх образцов новых правил, ждёт приёмки.**

Группа `Tags & PKM → Fields` в `docs/SETTINGS.md`. Его сценарий 2026-10-05: в настройках один Field и его Values → tagWheel ставит Value в строку → tagWheel ещё раз, Value назад на пустое — тег уходит. Команды `next`/`previous` против tagWheel — отдельный GIF (его слово к `fields-2`).

Заметка — `vault/Task fields.md`. За кадром из стартового набора убраны Priority, Due, Project (в панели один Field) и включён `Scroller`. Светлая тема, английский интерфейс.

## Что на экране

| Этап | Что показывается | Субтитр |
|---|---|---|
| Status Field and its Values | панель открывается сразу на редакторе Fields: слева один Field `Status`, справа его Values `#todo`, `#doing`, `#done` | `One Field: Status, with Values todo, doing, done` |
| Pick a Value in tagWheel | на `- call the bank` tagWheel Left — `[Status]` и окно Values (Scroller); ↑ `#todo`, ↑ `#doing`, Enter — `- #doing \|\| call the bank` | `tagWheel Left → Status and its Values` |
| Back to empty | tagWheel Left ещё раз — открывается на `#doing`; ↓ `#todo`, ↓ пустое `[ - ]`, Enter — тег уходит: `- call the bank` | `tagWheel Left again → it opens on #doing`, `Enter on the empty slot → the tag leaves the line` |

Каретки в открытом tagWheel нет; у строки — плашка (`hotkey: tagWheel Left`, `key: ↑`, `key: Enter`), до нажатия.

Шаги записи — `steps/fields.steps` (технические, не согласуются).
