# move-lines-2 — Move lines (up/down), вторая часть

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Navigation → Move lines (up/down)` в `docs/SETTINGS.md`. Контролы: `Highlight after moving`, `Where the line lands`, `Follow the moved line`. Первая часть группы — `move-lines`.

Не показаны: `Move lines` (главный переключатель: выключенный — нажатие ничего не делает, та же картинка, что на последнем этапе) и `Moved lines color` (цвет подсветки; без своего цвета — цвет выделения темы).

Заметка — `vault/Packing list.md`: нумерованный список из 36 пунктов, длиннее окна, чтобы было видно, идёт ли экран за строкой. Клавиша — `Move down`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| The note follows | `Default: the note follows the moved line` |
| Highlight after moving | `Highlight after moving → on`, `Move down → the moved line stays highlighted` |
| Lands at the top | `Where the line lands → Top`, `Move down → the line is kept at the top` |
| The note stays put | `Follow the moved line → off`, `Move down → the note stays put` |

Таблица собрана из `steps/move-lines-2.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/move-lines-2.steps` (технические, не согласуются).
