# link-view — Visual → Inline appearance: Link view

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Visual → Inline appearance → Link view` в `docs/SETTINGS.md`. Показаны пять цветов: `Link target color`, `Link brackets color`, `Hyperlink target color`, `Hyperlink brackets color`, `Hyperlink address color`. Не показаны `Preview on hover` и `Drag to move`: оба — для ссылки-Value, показанной своим текстом (`Show` = `custom`), которой в стартовом наборе нет; перетаскивания у инструмента записи нет.

Заметка — `vault/Link view.md`: ссылки-Value `[[Project A]]`, `[[Project B]]`, Markdown-ссылка и адрес сам по себе. Нажатий нет. Скобки Obsidian показывает только на строке каретки — в этих этапах каретка стоит на ссылке. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Шесть этапов — полоса внизу GIF. Первый — вид по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — та же заметка в новом виде. Цвета копятся.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Все ссылки — цветом темы | `Default: links take the theme's color` |
| 2 | `Link target color` → красный: `Project A`, `Project B` красные | `The note name in a link Value turns red` |
| 3 | `Link brackets color` → зелёный; каретка на строке `Read the brief`: `[[` `]]` зелёные | `On the cursor line: green [[ ]]` |
| 4 | `Hyperlink target color` → оранжевый: `release notes` оранжевый | `The text of a Markdown link turns orange` |
| 5 | `Hyperlink brackets color` → зелёный; каретка на строке ссылки: `[ ]( )` зелёные | `On the cursor line: green [ ] ( )` |
| 6 | `Hyperlink address color` → синий: адрес `https://example.com/docs` синий | `Every web address turns blue` |

Шаги записи — `steps/link-view.steps` (технические, не согласуются).
