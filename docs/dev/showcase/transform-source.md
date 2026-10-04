# transform-source — Source line

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Transform → Source line` в `docs/SETTINGS.md`. Ключевые контролы: `Sub-lines (tree) behavior`, `What happens with current line`, `Dim transformed line`. `Fields to keep`, `Mark transformed line` и `Where the mark goes` не показываются: GIF и так 49 с — это кандидаты во второй GIF. `Keep without name` и `Keep first words` на строке с именем в скобках дают то же, что `Keep`, и в показ не взяты.

Заметка — `vault/Moving day.md`. Новая заметка не открывается: весь показ — на исходной строке.

## Что на экране

Пять этапов — полоса внизу GIF. Первый — заметка по умолчанию, без нажатия; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Заметка как есть, без нажатия: Transform по умолчанию выключен | `Transform is off by default` |
| 2 | `Inline to note` → on (субтитр входа `Inline to note → on`); строка становится ссылкой `Pack the kitchen` с меткой `#processed`, теги и дата уходят, подпункты остаются | `The line becomes a link, its sub-items stay` |
| 3 | `Sub-lines (tree) behavior` → `Move`; та же строка — подпункты уходят вместе с ней | `Move → the sub-items go into the note too` |
| 4 | `What happens with current line` → `Keep`; у `[Book the van] call two rental places` текст остаётся рядом со ссылкой | `Keep → the text stays next to the link` |
| 5 | `Dim transformed line` → on; обработанная строка бледнеет | `The handled line fades` |

Светится фиолетовая каретка (фона строки нет — его слово 2026-10-04); у строки — плашка `hotkey: Transform inline to note`, до нажатия.

Шаги записи — `steps/transform-source.steps` (технические, не согласуются).
