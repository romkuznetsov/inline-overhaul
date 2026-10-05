# move-inline — Move lines (left/right): выделенный текст

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Navigation → Move lines (left/right)`, половина `Move text`, в `docs/SETTINGS.md`. Показан контрол `Continue past Separators`; `Movement step` — только умолчанием `Auto` (слово идёт по словам, часть слова — по буквам).

Не показаны: `Movement step` → `Character` (целое слово идёт по одной букве: `buy milk bread` → `buy  milkbread` → `buy  bmilkread`; на GIF это выглядит как порча текста — вопрос заказчику), `Movement step` → `Word` (на части слова на стенде дал тот же результат, что `Auto`), `Move selected text` → off (ничего не происходит — та же картинка, что этап 2), `Step out of the word`.

Заметка — `vault/Inline move.md`. Клавиши — `Move right`, `Move left`. Разделители стартового набора — `||`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Move selected text | `Move selected text → on`, `A selected word moves word by word`, `A part of a word moves by letter`, `…and stays inside its word`, `A word can jump past the Separator` |
| Step out of the word | `Step out of the word → on`, `Move right → the letter leaves its word` |
| Stay between Separators | `Continue past Separators → off`, `Move left → it stays between the Separators` |

Таблица собрана из `steps/move-inline.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/move-inline.steps` (технические, не согласуются).
