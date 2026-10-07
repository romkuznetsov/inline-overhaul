# action-field — Fields: Action Field

**Состояние: перезаписан 2026-10-07 по его замечанию «активацию команд не через field-next, а через tagwheel»; ждёт приёмки.** Длина 59 с — у предела 60 с.

Группа `Tags & PKM → Fields`, раздел `Categories` в `docs/SETTINGS.md`. Показаны: окно `Add a Field` с типом `Action`, категории `Insert callout` (пресеты Note, Tip, Warning) и `Cleanup`, выбор их в `tagWheel Right` (Field `Edit` — в Right Block). Не показаны `Insert codeblock`, `Tree ↔ section` и команды `next` / `previous`.

Заметка `vault/Action field.md`. Старт: стартовый набор без Due и Project, Scroller и заливка tagWheel.

## Что на экране

| Этап | Субтитры |
|---|---|
| New Action Field | `Add Field → Action: edits of the line`, `Insert callout comes with Note, Tip and Warning`, `A second category: Cleanup` |
| tagWheel | `tagWheel Right → Edit: Insert callout, then its preset Note`, `Enter → the line goes into a callout` |
| Tip | `tagWheel opens on Note; ↑ → Tip` |
| Take it off | `The empty slot → the callout is gone` |
| Cleanup | `Cleanup → the Values leave, your text stays` |

Таблица собрана из `steps/action-field.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/action-field.steps` (технические, не согласуются).
