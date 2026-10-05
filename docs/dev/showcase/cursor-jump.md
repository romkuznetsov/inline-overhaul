# cursor-jump — Visual → Cursor jump highlight

**Состояние: записан впервые 2026-10-06 — вынесен из `cursor` (его слово «раздели на разные гифки подсветку прыжка и настройки курсора»); ждёт приёмки.**

Группа `Visual → Cursor jump highlight` в `docs/SETTINGS.md`. Показаны: `Highlight where you land` с `Highlight size` и `How long it lasts`, `Use inside current line`. Не показаны `Highlight color`, `Minimum time between jumps`.

Заметка — `vault/Cursor.md` (общая с `cursor`). Каретку двигают команды `Jump down` и `Jump right`, каретка родная. Круг прыжка на умолчаниях (18 px, 450 мс) в GIF почти не виден — в его этапе он сразу увеличен ползунками: 40 px, 1200 мс. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Default Obsidian | `Default: Jump down → hard to see where the cursor lands` |
| Jump highlight | `Highlight where you land → on`, `Jump down → a circle marks where it lands` |
| Inside the line | `Use inside current line → on`, `Jump right → the circle inside the line too` |

Таблица собрана из `steps/cursor-jump.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/cursor-jump.steps` (технические, не согласуются).
