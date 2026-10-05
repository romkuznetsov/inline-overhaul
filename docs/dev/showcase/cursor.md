# cursor — Visual → Text cursor, Cursor jump highlight

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группы `Visual → Text cursor` и `Visual → Cursor jump highlight` в `docs/SETTINGS.md`. Показаны: `Color the text cursor` с `Cursor color`, `Shape the text cursor` с `Cursor width`, `Highlight where you land` с `Highlight size` и `How long it lasts`, `Use inside current line`. Не показаны `Blink speed`, `Highlight color`, `Minimum time between jumps`.

Заметка — `vault/Cursor.md`: три раздела по дням. Каретку двигают команды `Jump down` и `Jump right`; подсветка строки идёт за кареткой. Круг прыжка на умолчаниях (18 px, 450 мс) в GIF почти не виден — в его этапе он сразу увеличен ползунками: 40 px, 1200 мс. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Default cursor | `Default: Jump down → the thin cursor is easy to lose` |
| Cursor color | `Color the text cursor → red`, `Jump down → the cursor is red` |
| Cursor width | `Shape the text cursor → 6 px`, `Jump down → a thick cursor` |
| Jump highlight | `Highlight where you land → on`, `Jump down → a circle marks where it lands` |
| Inside the line | `Use inside current line → on`, `Jump right → the circle inside the line too` |

Таблица собрана из `steps/cursor.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/cursor.steps` (технические, не согласуются).
