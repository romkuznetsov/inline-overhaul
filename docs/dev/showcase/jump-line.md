# jump-line — Jump inside a line (left/right)

**Состояние: перезаписан 2026-10-05 по новым правилам; один из трёх образцов, ждёт приёмки.**

Группа `Navigation → Jump inside a line (left/right)` в `docs/SETTINGS.md`. Контролы: `Step size`, `What to do at the end`, `Continue past Separators` (тот, что в этой группе). Не показаны: `Next line`, `Start or end`, `Move cursor inside a line` → off.

Заметка — `vault/Jump in line.md`. Разделители стартового набора — `||`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Что показывается | Субтитр |
|---|---|---|
| Default Obsidian | без команд плагина: от `Friday` Ctrl+→ трижды — каретка уходит в `\|\|` и дату | `Obsidian: Ctrl+→ walks on into the separator and the date` |
| Jump by word | Jump right от `call` трижды — по словам; после `Friday` — обратно к началу текста | `Plugin: Jump right hops word by word`, `At the end of your text it wraps back to its start` |
| Step size: Sentence | `Step size` → `Sentence`; вправо дважды — `plumber.`, затем `Friday` | `Jump right → to the end of each sentence` |
| At the end: Stop | `What to do at the end` → `Stop`; после `Friday` вправо дважды — каретка стоит | `Jump right at the end → the cursor stays put` |
| Into the tags | `Continue past Separators` → on; от `call` влево дважды — к тегу `#todo` | `Jump left → the cursor walks into the tags` |

Светится каретка (`mark caret` — суть в её месте); у строки — плашка, до нажатия. 61 с.

Шаги записи — `steps/jump-line.steps` (технические, не согласуются).
