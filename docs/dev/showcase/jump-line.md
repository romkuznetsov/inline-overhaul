# jump-line — Jump inside a line (left/right)

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Navigation → Jump inside a line (left/right)` в `docs/SETTINGS.md`. Контролы: `Step size`, `What to do at the end`, `Continue past Separators` (тот, что в этой группе).

Не показаны: `What to do at the end` → `Next line`; `Step size` → `Start or end`; `Move cursor inside a line` → off.

Заметка — `vault/Jump in line.md`. Клавиши — `Jump right`, `Jump left`. Разделители стартового набора — `||`. Команды меняют только место каретки, текст не меняется; каретка на GIF тонкая. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Четыре этапа — полоса внизу GIF.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | каретка перед `call`, вправо трижды — `the`, `plumber`, `Ask` | `Default: Jump right hops word by word` |
| 1 | каретка после `Friday`, вправо — обратно к началу текста, перед `call` | `At the end of your text it wraps back to its start` |
| 1 | влево дважды — каретка не уходит в `#todo`: переходит в конец текста, затем к `Friday` | `Jump left → it never steps into the tags` |
| 2 | `Step size` → `Sentence`; от `call` вправо дважды — `plumber.`, затем `Friday` | `Jump right → to the end of each sentence` |
| 3 | `What to do at the end` → `Stop`; после `Friday` вправо дважды — каретка стоит, плашка мигает | `Jump right at the end → the cursor stays put` |
| 4 | `Continue past Separators` → on; от `call` влево дважды — каретка уходит за разделитель к тегу `#todo`, в начало строки, и там стоит (`Stop` с этапа 3) | `Jump left → the cursor walks into the tags` |

Светится фиолетовая каретка (фона строки нет — его слово 2026-10-04); у строки — плашка с командой (`hotkey: Jump right` / `Jump left`), до нажатия.

Шаги записи — `steps/jump-line.steps` (технические, не согласуются).
