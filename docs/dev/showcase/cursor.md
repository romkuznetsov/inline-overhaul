# cursor — Visual → Text cursor, Cursor jump highlight

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группы `Visual → Text cursor` и `Visual → Cursor jump highlight` в `docs/SETTINGS.md`. Показаны: `Color the text cursor` с `Cursor color`, `Shape the text cursor` с `Cursor width`, `Highlight where you land` с `Highlight size` и `How long it lasts`, `Use inside current line`. Не показаны `Blink speed`, `Highlight color`, `Minimum time between jumps`.

Заметка — `vault/Cursor.md`: три раздела по дням. Каретку двигают команды `Jump down` и `Jump right`; подсветка строки идёт за кареткой. Круг прыжка на умолчаниях (18 px, 450 мс) в GIF почти не виден — в его этапе он сразу увеличен ползунками: 40 px, 1200 мс. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Пять этапов — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка. Настройки копятся.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | `Jump down` дважды: тонкая каретка прыгает к концу разделов, её легко потерять | `Default: Jump down → the thin cursor is easy to lose` |
| 2 | `Color the text cursor` → on, `Cursor color` → красный; `Jump down`: каретка красная | `Jump down → the cursor is red` |
| 3 | `Shape the text cursor` → on, `Cursor width` → 6 px; `Jump down`: каретка толстая | `Jump down → a thick cursor` |
| 4 | `Highlight where you land` → on, размер 40 px, 1200 мс; `Jump down` дважды: на месте посадки — тающий круг | `Jump down → a circle marks where it lands` |
| 5 | `Use inside current line` → on; `Jump right` дважды внутри строки `Buy groceries`: круг и на шаге внутри строки | `Jump right → the circle inside the line too` |

Подсвечивается строка каретки; у строки — плашка с командой (`hotkey: Jump down`, `hotkey: Jump right`), до нажатия.

Шаги записи — `steps/cursor.steps` (технические, не согласуются).
