# auto-moc — Auto-MOC in your links: куда ставится ссылка

**Состояние: перезаписан 2026-10-06 по его слову «почему ты не показал дополнительные контролы autoMOC… возможно сделать 2 gif»: этот — куда ставится ссылка, `auto-moc-2` — что пишется рядом с ней; ждёт приёмки.**

Группа `Transform → Auto-MOC in your links` в `docs/SETTINGS.md`. Показаны: `Link the notes you mention`, `Where to put the link` (End, Beginning, Under heading), `Name of the heading`, `If heading not found`. `Link to Navigator` не показан: ему нужен дочерний Field-ссылка, которого в стартовом наборе нет.

Заметки — `vault/Book club.md` слева, где идёт Transform, и `vault/Project B.md` справа (шаг `pane`): ссылка появляется в ней в момент Transform. В Project B два раздела, Meetings и Notes — у каждого значения своё место. Transform — плавающей кнопкой → в конце строки; Inline to note выставлен заранее, новая заметка не открывается.

## Что на экране

| Этап | Субтитры |
|---|---|
| Link the notes you mention | `Link the notes you mention → on`, `Transform: the line becomes a note that mentions Project B`, `Project B gets a link to it, at the end` |
| Where to put the link | `Where to put the link → Beginning`, `Transform another line`, `The link goes to the top of Project B` |
| Under heading | `Where to put the link → Under heading ## Meetings`, `Transform another line`, `The link joins the Meetings section` |
| If heading not found | `No ## Plans heading → If heading not found: Beginning`, `Transform another line`, `The heading is added at the top, the link under it` |

Таблица собрана из `steps/auto-moc.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/auto-moc.steps` (технические, не согласуются).
