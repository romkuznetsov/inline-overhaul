# prerequisite — Fields: Prerequisite Field

**Состояние: записан впервые 2026-10-07 по заказу после ревизии документации; ждёт приёмки.**

Группа `Tags & PKM → Fields`, строки `Prerequisite Field` и `Choose prerequisite Field` раздела `Behavior` в `docs/SETTINGS.md`. Показаны: Priority ждёт Status, в предпросмотре строки Priority бледнее и подписан `⬑Status`; на строке без Status tagWheel предлагает только Status, на строке с Status — и Priority.

Заметка `vault/Prerequisite.md`. Старт: стартовый набор без Due и Project, Scroller и заливка tagWheel.

## Что на экране

| Этап | Субтитры |
|---|---|
| Prerequisite Field | `Priority: Prerequisite Field → Yes, waits for Status`, `Preview: Priority is pale, ⬑Status under it` |
| Before | `A plain line: tagWheel offers Status only` |
| After | `The line has a Status → Priority is offered too` |

Таблица собрана из `steps/prerequisite.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/prerequisite.steps` (технические, не согласуются).
