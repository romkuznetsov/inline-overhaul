# smart-delete — Smart Delete\Backspace

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Keyboard → Global hotkeys → Smart Delete\Backspace` в `docs/SETTINGS.md`. Контролы в записи: `Smart Delete`, `Smart Backspace`, `Drop the line Prefix`. `Join with a space` не показан: выключенный, он склеивает `table- for` — на GIF это читается как поломка.

Отдельного «до»-GIF нет: по умолчанию обе клавиши выключены, и этап 1 и есть встроенный Delete Obsidian.

Заметка — `vault/Errands.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Четыре этапа — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Каретка в конце `Call the plumber`, Delete — подпункт приезжает вместе с отступом и маркером: `Call the plumber    - about the kitchen sink` | `Default: Delete pulls up the indent and the bullet too` |
| 2 | `Smart Delete` → on; Delete в конце `Book a table` — приезжают только слова: `Book a table for Friday evening` | `Delete at the end → only the words come up` |
| 3 | `Smart Backspace` → on; Backspace перед `and envelopes` — слова уходят наверх: `Buy stamps and envelopes` | `Backspace at the start → the words go up` |
| 4 | `Drop the line Prefix` → off; Delete в конце `Call the plumber` — приезжает маркер, отступ нет: `Call the plumber - about the kitchen sink` | `Delete → the bullet comes along, the indent does not` |

Светится фиолетовая каретка (фона строки нет — его слово 2026-10-04); у строки — плашка клавиши (`key: Delete`, `key: Backspace`), до нажатия.

Шаги записи — `steps/smart-delete.steps` (технические, не согласуются).
