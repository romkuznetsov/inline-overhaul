# readme-tagwheel — анимация tagWheel в README

**Состояние: записан 2026-10-12 по его заказу; ждёт приёмки.**

Его слово 2026-10-12: вместо снимка tagWheel в README — анимация, где видно, как открывается tagWheel на строке, меняются Values и правка применяется.

Заметка — `vault/Inbox.md`. Стартовый набор, светлая тема, заливка tagWheel `#fff3bf`, Scroller включён.

## Что на экране

| Шаг | Что видно |
|---|---|
| `hotkey: tagWheel Left` | tagWheel открывается на `call the bank`, ячейка Status, Scroller сверху и снизу |
| ↑ ↑ ↓ | Status проходит `#todo` → `#doing` → `#todo` |
| → ↓ | шаг на Priority, `#high` |
| Enter | в строке `- [ ] #todo #high \|\| call the bank` |

Заставки, субтитров и полосы этапов нет: в README идёт вырезка строки и Scroller, `docs/media/readme/tagwheel.gif`.

Шаги записи — `steps/readme-tagwheel.steps`.
