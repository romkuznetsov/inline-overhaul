# smart-rules — Smart Rules

**Состояние: отложен 2026-10-04 — показ выглядит поломкой плагина. Шагов записи нет.**

Группа `Transform → Smart Rules` в `docs/SETTINGS.md`. Правило выбирает шаблон по Values строки; условие правила добавляется кнопкой `+` в карточке, и она открывает окно `Add a tag` / `Add a link`.

## Почему отложен

В окне `Add a tag` / `Add a link` текст подсказки показывает разметку как есть: `<code>#todo</code> or <code>#idea</code>…`. Окно стоит в кадре, пока выбирается Value, — на GIF это читается как поломка. Источник текста — `CONDITION_TIP` в `src/ui/settings/texts_blocks.ts`.

Всё остальное для показа у инструмента теперь есть: шаблоны в подпапке `vault/`, `pick` для списка `Template for Rule 1`, `click` для `+` и Value в окне. Оговорка: папка шаблонов набирается в поле `Templates folder` по букве, и в записи `transform` при этом всплывало «Settings changed on disk…» — для этой записи папку придётся проверить на кадрах заново.

## Задуманный показ

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Заметка как есть, без нажатия | `Transform is off by default` |
| 2 | `Inline to note`, `Open note after creation`, папка шаблонов и шаблон по умолчанию `Errand`; строка `#todo` становится заметкой по нему | `Every line uses the default template` |
| 3 | Правило «link `Project A` → шаблон `Project task`»; строка с `[[Project A]]` становится заметкой по другому шаблону | `A rule picks the template by the line's link` |
