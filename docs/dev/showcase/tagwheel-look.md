# tagwheel-look — Visual → tagWheel (Panel, Scroller)

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Visual → tagWheel` в `docs/SETTINGS.md`. Показаны два контрола: `Show tag markers` (Panel) и `Scroller` (Scroller). Цвета панели и скроллера, `Scroller size` — без записи: инструмент пока не умеет ставить цвет и ползунок. `Highlight the tagWheel line` = off снят из записи: с ним открытый tagWheel показывает в строке лишние `**` (похоже на поломку, вопрос в отчёте сессии). Поведение tagWheel (выбор Value) — запись `tagwheel`.

Заметка — `vault/tagWheel look.md`. Команда — `tagWheel Left`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Default look | `Default: tagWheel Left → the picker opens on the line`, `Escape → the line is back as it was` |
| No tag markers | `Show tag markers → off`, `tagWheel Left → Values without the #` |
| Scroller | `Scroller → on`, `tagWheel Left → neighbor Values above and below`, `↓ → the next Value, the Scroller rolls` |

Таблица собрана из `steps/tagwheel-look.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/tagwheel-look.steps` (технические, не согласуются).
