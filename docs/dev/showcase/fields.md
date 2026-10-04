# fields — Fields: три типа и команды next/previous

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Tags & PKM → Fields` в `docs/SETTINGS.md`. Показано то, что стартовый набор даёт без настройки: у каждого Field своя пара команд `<Field> next` / `<Field> previous`, и три типа Field — Tag (`Status`, `Priority`), Element (`Due`) и Link (`Project`) — пишутся каждый в свой Block. Правка Values (`Add Value`, глаз, столбец `Show`) — вторая часть, `fields-2`.

Заметка — `vault/Task fields.md`, ссылки ведут на пустые `vault/Project A.md` и `vault/Project B.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Один этап — поведение по умолчанию; строка `pay the rent` правится подряд.

| Что показывается | Субтитр |
|---|---|
| `Status next` трижды — `#todo`, `#doing`, `#done` перед текстом | `Default: Status next → its Values in turn` |
| `Priority next` — `#low` рядом со `#done`, в том же Block | `Priority next → a second tag, same Block` |
| `Due next` дважды — сегодняшняя дата за текстом, затем следующий день | `Due next → today, then one day later` |
| `Project next` дважды — `[[Project A]]`, затем `[[Project B]]` | `Project next → a link to the note` |
| `Status previous` — `#done` становится `#doing` | `Status previous → one step back` |

Светится фиолетовая каретка (фона строки нет — его слово 2026-10-04); у строки — плашка с командой (`hotkey: Status next`), до нажатия.

Шаги записи — `steps/fields.steps` (технические, не согласуются).
