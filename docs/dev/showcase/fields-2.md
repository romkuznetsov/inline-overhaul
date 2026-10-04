# fields-2 — Fields: таблица Values

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Tags & PKM → Fields`, таблица Values в `docs/SETTINGS.md`. Показаны `Add Value`, глаз (Value скрыт от `next`, `previous` и tagWheel) и столбец `Show` (`custom` — Value рисуется своим текстом). Первая часть — `fields`: три типа Field и команды `next` / `previous`.

Заметка — `vault/Values.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Четыре этапа — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки, после выхода — исходная заметка.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | `Status next` дважды на `- #todo \|\| call the bank` — `#doing`, затем `#done` | `Default: Status next walks its Values` |
| 2 | в таблице Values Status набрать `waiting`, `Add Value`; `Status next` на `- #done \|\| pay the rent` — `#waiting` | `Status next → the new Value comes after #done` |
| 3 | глаз у `#doing`; `Status next` на `#todo` — сразу `#done`, `#doing` пропущен | `Status next → #doing is skipped` |
| 4 | `Show` у `#todo` → `custom`, текст `🎯`; на строке вместо `#todo` — 🎯; `Priority next` — рядом встаёт `#low`, 🎯 остаётся | `Priority next → 🎯 stays in place of #todo` |

Подсвечивается строка, которую правит команда; у строки — плашка с командой (`hotkey: Status next`), до нажатия.

Шаги записи — `steps/fields-2.steps` (технические, не согласуются).
