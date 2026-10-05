# link-view — Visual → Inline appearance: Link view

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Visual → Inline appearance → Link view` в `docs/SETTINGS.md`. Показаны пять цветов: `Link target color`, `Link brackets color`, `Hyperlink target color`, `Hyperlink brackets color`, `Hyperlink address color`. Не показаны `Preview on hover` и `Drag to move`: оба — для ссылки-Value, показанной своим текстом (`Show` = `custom`), которой в стартовом наборе нет; перетаскивания у инструмента записи нет.

Заметка — `vault/Link view.md`: ссылки-Value `[[Project A]]`, `[[Project B]]`, Markdown-ссылка и адрес сам по себе. Нажатий нет. Скобки Obsidian показывает только на строке каретки — в этих этапах каретка стоит на ссылке. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Default look | `Default: links take the theme's color` |
| Link target | `Link target color → red`, `The note name in a link Value turns red` |
| Link brackets | `Link brackets color → green`, `On the cursor line: green [[ ]]` |
| Hyperlink text | `Hyperlink target color → orange`, `The text of a Markdown link turns orange` |
| Hyperlink brackets | `Hyperlink brackets color → green`, `On the cursor line: green [ ] ( )` |
| Hyperlink address | `Hyperlink address color → blue`, `Every web address turns blue` |

Таблица собрана из `steps/link-view.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/link-view.steps` (технические, не согласуются).
