# smart-delete — Smart Delete\Backspace

**Состояние: перезаписан 2026-10-05 по его сценарию; один из трёх образцов новых правил, ждёт приёмки.**

Группа `Keyboard → Smart Delete\Backspace` в `docs/SETTINGS.md`. Его порядок 2026-10-05: выключено → включено без доп. контролов → по одному включаются `Drop the line Prefix` и `Join with a space` → `Smart Backspace` со всем включённым.

Заметка — `vault/Errands.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Что показывается | Субтитр |
|---|---|---|
| Default Obsidian | Delete в конце `Call the plumber` — подпункт приезжает с отступом и маркером: `Call the plumber    - about the kitchen sink` | `Obsidian: Delete pulls up the indent and the bullet too` |
| Smart Delete | `Smart Delete` → on, `Drop the line Prefix` и `Join with a space` → off; Delete — уходит только отступ: `Call the plumber- about the kitchen sink` | `Smart Delete on, its options off`, `Delete → only the indent goes` |
| Drop the line Prefix | → on; Delete — уходит и маркер: `Call the plumberabout the kitchen sink` | `Delete → the bullet goes too` |
| Join with a space | → on; Delete — слова через пробел: `Call the plumber about the kitchen sink` | `Delete → the words join with a space` |
| Smart Backspace | → on; Backspace перед `and envelopes` — `Buy stamps and envelopes` | `Backspace at the start → the words go up the same way` |

Подсвечена строка, к которой приезжает текст (`mark line`); у строки — плашка клавиши, до нажатия.

Шаги записи — `steps/smart-delete.steps` (технические, не согласуются).
