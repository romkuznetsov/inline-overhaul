# smart-enter — Smart Enter

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Keyboard → Global hotkeys → Smart Enter` в `docs/SETTINGS.md`. Контролы в записи: `Smart Enter`, `Use Shift+Enter instead`, `Prefix on the new line`. Не показаны: `Where it works → Text only` (разница видна только на строке с Separators и Fields: Enter среди тегов режет строку на `- [ ] #todo` и `- [ ] #high || Fix the shelf…` — на GIF это читается как поломка) и `Shift+Enter as usual Enter`.

Отдельного «до»-GIF нет: по умолчанию `Smart Enter` выключен, и этап 1 и есть встроенный Enter Obsidian.

Заметка — `vault/Shopping list.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Default Obsidian | `Obsidian: Enter splits the line` |
| Smart Enter | `Smart Enter → on`, `Enter → a new line below, this one stays whole`, `The new line takes the same marker` |
| Prefix: None | `Prefix on the new line → None`, `Enter → the new line starts bare` |
| Prefix: Numbered lines only | `Prefix on the new line → Numbered lines only`, `A numbered line → the next number`, `A bullet line → the new line starts bare` |
| Use Shift+Enter | `Use Shift+Enter instead → on`, `Enter splits as usual`, `Shift+Enter → a new line below` |

Таблица собрана из `steps/smart-enter.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/smart-enter.steps` (технические, не согласуются).
