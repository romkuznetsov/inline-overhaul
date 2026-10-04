# tag-bars — Visual → Tag Bars

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Visual → Tag Bars` в `docs/SETTINGS.md`. Показаны: `Tag Bars` с `Which Field draws Bars`, `Bar thickness`, `Show the Field’s tag`, `Hide the leftover marker`, `Number of Bars`. Не показаны: `Bar arrangement`, промежутки и отступы, `Bars for the whole tree`, `Join Bars in a tree` — оттенки того же вида.

Заметка — `vault/Tag bars.md`: дерево задач с тегами Status в три уровня. Нажатий нет. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Шесть этапов — полоса внизу GIF. Первый — вид по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — та же заметка в новом виде. Настройки копятся.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Дерево с тегами `#doing`, `#todo`, `#done`, полос нет | `Default: no Bars, only the tags` |
| 2 | `Tag Bars` → on, `Which Field draws Bars` → Status: слева от каждого дерева полоса цвета его тега | `A Bar in the tag's color runs down each tree` |
| 3 | `Bar thickness` → 6 px: полосы толще | `The Bars are easier to see` |
| 4 | `Show the Field’s tag` → off: теги ушли со строк, цвет остался на полосе | `The Bar speaks for the tag` |
| 5 | `Hide the leftover marker` → on: одинокий разделитель `||` в начале строки убран | `The lonely || goes away` |
| 6 | `Number of Bars` → 3: третий уровень (`Tomatoes`, `Herbs`) получил свою полосу | `The third level gets its own Bar` |

Шаги записи — `steps/tag-bars.steps` (технические, не согласуются).
