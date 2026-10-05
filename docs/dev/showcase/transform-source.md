# transform-source — Source line

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Transform → Source line` в `docs/SETTINGS.md`. Ключевые контролы: `Sub-lines (tree) behavior`, `What happens with current line`, `Dim transformed line`. `Fields to keep`, `Mark transformed line` и `Where the mark goes` не показываются: GIF и так 49 с — это кандидаты во второй GIF. `Keep without name` и `Keep first words` на строке с именем в скобках дают то же, что `Keep`, и в показ не взяты.

Заметка — `vault/Moving day.md`. Новая заметка не открывается: весь показ — на исходной строке.

## Что на экране

| Этап | Субтитры |
|---|---|
| Inline to note | `Inline to note → on`, `The line becomes a link, its sub-items stay` |
| Sub-lines: Move | `Sub-lines (tree) behavior → Move`, `Move → the sub-items go into the note too` |
| Keep the text | `What happens with current line → Keep`, `Keep → the text stays next to the link` |
| Dim transformed line | `Dim transformed line → on`, `The handled line fades` |

Таблица собрана из `steps/transform-source.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/transform-source.steps` (технические, не согласуются).
