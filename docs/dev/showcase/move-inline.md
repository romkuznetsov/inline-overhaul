# move-inline — Move lines (left/right): выделенный текст

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Navigation → Move lines (left/right)`, половина `Move text`, в `docs/SETTINGS.md`. Показан контрол `Continue past Separators`; `Movement step` — только умолчанием `Auto` (слово идёт по словам, часть слова — по буквам).

Не показаны: `Movement step` → `Character` (целое слово идёт по одной букве: `buy milk bread` → `buy  milkbread` → `buy  bmilkread`; на GIF это выглядит как порча текста — вопрос заказчику), `Movement step` → `Word` (на части слова на стенде дал тот же результат, что `Auto`), `Move selected text` → off (ничего не происходит — та же картинка, что этап 2), `Step out of the word`.

Заметка — `vault/Inline move.md`. Клавиши — `Move right`, `Move left`. Разделители стартового набора — `||`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Два этапа — полоса внизу GIF.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | в `buy milk bread and eggs` выделено `milk`, вправо дважды — `buy bread and milk eggs` | `Default: a selected word moves word by word` |
| 1 | в `fix teh typo` выделена `e`, вправо — `fix the typo` | `Default: a part of a word moves by letter` |
| 1 | в строке `#todo`, `call the plumber`, дата выделено `call`, влево — слово перескакивает разделитель к тегу | `Default: it can jump past the Separator` |
| 2 | `Continue past Separators` → off; то же `call` влево дважды — слово стоит, плашка мигает | `Move left → it stays between the Separators` |

Подсвечивается строка, в которой едет выделение; у строки — плашка с командой (`hotkey: Move right` / `Move left`), до нажатия.

Шаги записи — `steps/move-inline.steps` (технические, не согласуются).
