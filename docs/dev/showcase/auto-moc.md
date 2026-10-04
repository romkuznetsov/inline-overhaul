# auto-moc — Auto-MOC in your links

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Transform → Auto-MOC in your links` в `docs/SETTINGS.md`. Ключевой контрол: `Link the notes you mention`. `Where to put the link`, `Name of the heading`, `If heading not found` и `Add empty line before wikilink` не показываются: заметка `Project B` общего хранилища пустая, а в пустую заметку плагин пишет ссылку с первой строки и заголовок не ставит даже при `Under heading` (находка) — начало, конец и раздел в ней неотличимы. `Link to Navigator` требует дочернего Field-ссылки, которого в стартовом наборе нет.

Заметки — `vault/Book club.md` и общая `vault/Project B.md`.

## Что на экране

Два этапа — полоса внизу GIF.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Заметка как есть, без нажатия: Transform по умолчанию выключен | `Transform is off by default` |
| 2 | `Inline to note`, `Open note after creation`, `Link the notes you mention` → on; открывается новая заметка `Pick the next book`, в её строке — ссылка `Project B` | `The line becomes a note that mentions Project B` |
| 2 | Щелчок по `Project B` — в заметке `Project B` появилась ссылка на `Pick the next book` | `Project B now links back to the new note` |

Светится фиолетовая каретка (фона строки нет — его слово 2026-10-04); у строки — плашка `hotkey: Transform inline to note`, до нажатия.

Шаги записи — `steps/auto-moc.steps` (технические, не согласуются).
