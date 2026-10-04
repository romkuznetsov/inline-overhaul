# smart-enter — Smart Enter

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Keyboard → Global hotkeys → Smart Enter` в `docs/SETTINGS.md`. Контролы в записи: `Smart Enter`, `Use Shift+Enter instead`, `Prefix on the new line`. Не показаны: `Where it works → Text only` (разница видна только на строке с Separators и Fields: Enter среди тегов режет строку на `- [ ] #todo` и `- [ ] #high || Fix the shelf…` — на GIF это читается как поломка) и `Shift+Enter as usual Enter`.

Отдельного «до»-GIF нет: по умолчанию `Smart Enter` выключен, и этап 1 и есть встроенный Enter Obsidian.

Заметка — `vault/Shopping list.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Четыре этапа — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка. Номера после новой строки пересчитывает сам Obsidian.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Каретка перед `and` в `Buy milk and bread`, Enter — строка разрезана: `1. Buy milk` / `2. and bread` | `Default: Enter splits the line` |
| 2 | `Smart Enter` → on; та же каретка, Enter — строка цела, под ней новая `2. `, набирается `Call the vet` | `Enter → a new line below, this one stays whole` |
| 3 | `Use Shift+Enter instead` → on; Enter в `Pick up the parcel` режет строку как обычно; Shift+Enter в `Buy milk and bread` — новая строка `2. ` под ней | `Enter splits as usual`, `Shift+Enter → a new line below` |
| 4 | `Prefix on the new line` → `None`; Shift+Enter — новая строка без номера | `Shift+Enter → the new line starts empty` |

Подсвечивается строка, где нажата клавиша; у строки — плашка (`key: Enter`, `key: Shift + Enter`), до нажатия.

Шаги записи — `steps/smart-enter.steps` (технические, не согласуются).
