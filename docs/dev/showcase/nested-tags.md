# nested-tags — Fields: Child tag format

**Состояние: перезаписан 2026-10-07 по его замечанию «inline2note… активировать нажатием на floating button»; ждёт приёмки.**

Группа `Tags & PKM → Fields`, строка `Child tag format` раздела `Behavior` в `docs/SETTINGS.md`. Показаны `Separate` (два тега `#done #review`), `Nested` (один тег `#done/review`) и плавающую кнопку `→` (Inline to note), после которой `#done/review` стоит в свойстве заметки одним тегом.

Заметка `vault/Nested tags.md`. Старт: стартовый набор без Priority, Due и Project, Scroller и заливка tagWheel; за кадром включены `Inline to note`, `Floating button` и открытие новой заметки, у Status свойство `tags`. Дочерний `#review` под `#done` заводится на камеру, как в `child-fields`. В заготовке Showcase стояли `#note` и `#meeting`; ролик идёт на Values стартового набора, и таблица Showcase поправлена под него.

## Что на экране

| Этап | Субтитры |
|---|---|
| A child Value | `#review under #done, Child Field → After parent` |
| Separate | `Default Separate: parent and child are two tags` |
| Nested | `Child tag format → Nested`, `Nested: one tag #done/review` |
| Into a note | `Click → : Inline to note, the property gets one tag`, `The new note: tags → done/review, one tag` |

Таблица собрана из `steps/nested-tags.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/nested-tags.steps` (технические, не согласуются).
