# link-rename — Fields: переименование link Value вместе с заметкой

**Состояние: записан впервые 2026-10-07 по заказу после ревизии документации; ждёт приёмки.**

Группа `Tags & PKM → Fields`, таблица Values у Link Field в `docs/SETTINGS.md`. Показаны: правка Value `[[Project A]]` в таблице, окно `Rename the note too?` с ценой (сколько ссылок в скольких заметках) и кнопка `Rename note and links`.

Заметка `vault/Link rename.md` слева, `vault/Project A.md` справа (`pane`): после переименования у правой заметки новое имя. Старт: стартовый набор, в панели только Project. В его `.obsidian` выключен `Automatically update internal links`, поэтому Obsidian спрашивает сам, и в ролике видно его окно `Update links` → `Just once`. Число ссылок в окне (9 в 7 заметках) считает весь демо-vault.

## Что на экране

| Этап | Субтитры |
|---|---|
| Rename the Value | `Project A → Project Atlas in the Values table` |
| Rename the note too? | `The window counts the links in your notes`, `Obsidian asks first → Just once` |
| The result | `The note is Project Atlas, and every link follows` |

Таблица собрана из `steps/link-rename.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/link-rename.steps` (технические, не согласуются).
