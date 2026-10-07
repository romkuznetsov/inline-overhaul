# fields-2 — Fields: таблица Values

**Состояние: перезаписан 2026-10-07 по заказу после ревизии документации (цикл 140): окно `Add a Field` предлагает `Tag`, `Link`, `Element`, `Action`, новый Field выбран в списке сразу; ждёт приёмки.** Таблица Values нового Field на кадре пуста до перевыбора — дефект плагина (OPEN_QUESTIONS, 2026-10-07), субтитр о ней молчит; после починки — переснять с «its Values on the right».

Группа `Tags & PKM → Fields`, таблица Values в `docs/SETTINGS.md`. Показаны `Add Value`, глаз (Value скрыт от `next`, `previous` и tagWheel) и столбец `Show` (`custom` — Value рисуется своим текстом). Первая часть — `fields`: три типа Field и команды `next` / `previous`.

Заметка — `vault/Values.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| New Field | `One Field so far — Status`, `Four kinds: Tag, Link, Element, Action`, `A new Field: Energy, with one Value #focus` |
| Picked at once | `Energy is picked in the list at once` |
| tagWheel: two Fields | `tagWheel Left → Status and the new Energy`, `↑ ↓ pick a Value of Status in the Scroller`, `→ steps to Energy; ↓ picks #focus`, `Enter → both Values land in the line` |

Таблица собрана из `steps/fields-2.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/fields-2.steps` (технические, не согласуются).
