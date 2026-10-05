# auto-moc — Auto-MOC in your links

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Transform → Auto-MOC in your links` в `docs/SETTINGS.md`. Ключевой контрол: `Link the notes you mention`. `Where to put the link`, `Name of the heading`, `If heading not found` и `Add empty line before wikilink` не показываются: заметка `Project B` общего хранилища пустая, а в пустую заметку плагин пишет ссылку с первой строки и заголовок не ставит даже при `Under heading` (находка) — начало, конец и раздел в ней неотличимы. `Link to Navigator` требует дочернего Field-ссылки, которого в стартовом наборе нет.

Заметки — `vault/Book club.md` и общая `vault/Project B.md`.

## Что на экране

| Этап | Субтитры |
|---|---|
| Link the notes you mention | `Link the notes you mention → on`, `The line becomes a note that mentions Project B`, `Project B now links back to the new note` |

Таблица собрана из `steps/auto-moc.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/auto-moc.steps` (технические, не согласуются).
