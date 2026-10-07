# element-steps — Fields: Element, шаг даты, счётчика и списка

**Состояние: записан впервые 2026-10-07 по заказу после ревизии документации; ждёт приёмки.** Прежний `pkm-element-cycle` снят на старой панели.

Группа `Tags & PKM → Fields`, раздел `Value` у Element в `docs/SETTINGS.md`. Показаны `Due next` (дата шагает на день), `Value format` → `001` (счётчик) и `Steps by` → `List of Values` (свой список с эмодзи у каждого Value).

Заметка `vault/Task fields.md`. Старт: стартовый набор без Status, Priority и Project; за кадром заведены два Element: `Count` (`🔢`, формат `1`) и `Mood` (`🙂`, список `🙂‍↕️yes`, `🙂‍↔️no` при шаге `Fixed step`). На камеру меняются только `Value format` и `Steps by`. Как Field заводится окном `Add a Field`, показывает `fields-2`.

В ожиданиях стоит дата записи: перезапись в другой день правит два первых `expect`.

## Что на экране

| Этап | Субтитры |
|---|---|
| A date | `Due next → today`, `Due next again → one day later` |
| A counter | `Count: Value format → 001`, `Count next → 🔢001, then 🔢002` |
| Steps by → List of Values | `Mood: Steps by → List of Values`, `Mood next walks your own list`, `Mood previous → one step back` |

Таблица собрана из `steps/element-steps.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/element-steps.steps` (технические, не согласуются).
