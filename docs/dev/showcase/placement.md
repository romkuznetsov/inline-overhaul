# placement — Placement modes

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Tags & PKM → Placement modes` в `docs/SETTINGS.md`. Два контрола: `Strict: add a bullet`, `Keep typed tags in text`. `Insert only: use Field Prefix` и группа `Prefix priority` не показаны: у Values стартового набора нет своего Prefix, и в заметке они ничего не меняют.

Заметка — `vault/Placement.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Три этапа — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | `Status next` на строке без маркера `call the bank` — `#todo` встаёт, маркера нет | `Default: Status next → no bullet is added` |
| 1 | `Status next` на `- pay the rent #high` — набранный `#high` остаётся в тексте | `Default: a typed tag stays in the text` |
| 2 | `Strict: add a bullet` → on; `Status next` на `call the bank` — строка получает `- ` | `Status next → the line gets a bullet` |
| 3 | `Keep typed tags in text` → off; `Status next` на `- pay the rent #high` — `#high` уходит в Left Block к `#todo` | `Status next → #high moves to its Block` |

Светится фиолетовая каретка (фона строки нет — его слово 2026-10-04); у строки — плашка с командой (`hotkey: Status next`), до нажатия.

Шаги записи — `steps/placement.steps` (технические, не согласуются).
