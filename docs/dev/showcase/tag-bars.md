# tag-bars — Visual → Tag Bars

**Состояние: перезаписан 2026-10-06 по его слову: заметка и настройки на экране одновременно — каждая смена контрола сразу видна в заметке; каретки нет; ждёт приёмки.**

Группа `Visual → Tag Bars` в `docs/SETTINGS.md`. Показаны: `Tag Bars` с `Which Field draws Bars`, `Number of Bars`, `Show the Field’s tag` с `Hide the leftover marker`, `Bars for the whole tree`, `Join Bars in a tree`. Не показан `Bar arrangement`; промежутки и отступы — в `tag-bars-look`.

Заметка — `vault/Tag bars.md`: дерево задач с тегами Status в три уровня. Нажатий нет: заметка слева, панель `Visual` справа и не закрывается (шаг `split`). Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Default look | `Default: no Bars, only the tags` |
| Tag Bars | `Tag Bars → on, drawn by Status`, `A Bar in the tag's color runs down each tree` |
| Number of Bars | `Number of Bars → 3`, `The third level gets its own Bar` |
| Hide the tag | `Show the Field’s tag → off`, `The Bar speaks for the tag, the lonely \|\| goes too` |
| Not the whole tree | `Bars for the whole tree → off`, `Each Bar covers only its own line` |
| Separate Bars | `Bars for the whole tree → on, Join Bars in a tree → off`, `Parent and child Bars break apart` |

Таблица собрана из `steps/tag-bars.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/tag-bars.steps` (технические, не согласуются).
