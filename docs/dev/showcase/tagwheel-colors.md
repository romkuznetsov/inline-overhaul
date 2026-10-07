# tagwheel-colors — Visual → tagWheel (Panel): цвета

**Состояние: перезаписан 2026-10-07 по заказу после ревизии документации (цикл 140): без своего цвета строка залита цветом темы, первый этап — «цвет темы → свой цвет»; ждёт приёмки.** Свой цвет здесь голубой (`#d0ebff`): жёлтый `#fff3bf` остальных GIF на кадре почти не отличим от цвета темы.

Группа `Visual → tagWheel → Panel` в `docs/SETTINGS.md`. Показаны: `Background color`, `Active Field text color`, `Inactive Field text color`, `Chosen Value text color`. Не показаны `Bold Field names`, `Highlight the tagWheel line`, цвета Scroller.

Заметка — `vault/tagWheel colors.md`: строка tagWheel третьей, чтобы Scroller не закрывал заголовок. Старт — стартовый набор, Scroller включён, светлая тема, английский интерфейс. Без своего цвета заливки строка залита цветом выделения темы — это и показывает первый этап.

## Что на экране

| Этап | Субтитры |
|---|---|
| Theme color | `Default: the open line takes your theme's highlight color` |
| Background color | `Background color → your own blue`, `The open line stands out` |
| Active Field text color | `Active Field text color → red`, `The Field you are on is red` |
| Inactive Field text color | `Inactive Field text color → gray`, `The other Fields fade to gray` |
| Chosen Value text color | `Chosen Value text color → green`, `A Field that already has a Value is green` |

Таблица собрана из `steps/tagwheel-colors.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/tagwheel-colors.steps` (технические, не согласуются).
