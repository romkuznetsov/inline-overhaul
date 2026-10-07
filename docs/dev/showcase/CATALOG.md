# Каталог GIF для Showcase

Одна строка — одна запись. Источник — группы `docs/SETTINGS.md` (его ответ
2026-09-25: «список по FEATURES.md»). Порядок — сперва пилот, потом по разделам.
Состояния: `—` не начато, `записан`, `принят`, `в Showcase`, `отложен` (с причиной). С 2026-10-04 сценарии не согласуются: пишу, записываю, приёмка общая (навык `showcase-gif`).
«Только панель» — у фичи нет поведения в заметке, запись показывает панель.

Все GIF — `docs/media/showcase/<id>.gif`; что в каждом — `docs/dev/showcase/<id>.md`. Перезаписаны 2026-10-05 на сборке 0.16.1 по каркасу после приёмки трёх образцов; к выпуску — перезапись одной командой на сборке выпуска. В ожиданиях `readme-hero`, `fields`, `tagwheel`, `tagwheel-2` стоит дата записи: в другой день их `expect` правится под дату.

| № | id | Фича (группа SETTINGS.md) | Что показано | Состояние |
|---|---|---|---|---|
| 0 | `readme-hero` | Шапка README: строка через tagWheel | tagWheel Left и Right заполняют строку | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 1 | `move-lines` | Navigation → Move lines (up/down) | Default Obsidian, Whole tree, Jump over trees, Whole section, Stop at headings | принят 2026-10-06 |
| 1 | `move-lines-2` | Navigation → Move lines (up/down), вторая часть | Highlight after moving, Where the line lands, Follow the moved line | принят 2026-10-06 |
| 2 | `move-inline` | Navigation → Move lines (left/right): выделенный текст | Move selected text, Step out of the word, Continue past Separators | принят 2026-10-06 |
| 3 | `prefix-cycle` | Navigation → Move lines (left/right): префикс и отступ | Cycle line Prefixes, After the last one, Cycle in both directions | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 4 | `jump-line` | Navigation → Jump inside a line | Default Obsidian, Move cursor inside a line, Step size, What to do at the end, Continue past Separators | принят 2026-10-05 (образец) |
| 5 | `jump-note` | Navigation → Jump inside a note | Default Obsidian, Jump between headings, Where in the section, Jump target | принят 2026-10-06 |
| 6 | `ctrl-a` | Keyboard → Expanded Ctrl+A | Default Obsidian, Smart Ctrl+A, Selection steps | принят 2026-10-06 |
| 6 | `ctrl-a-2` | Keyboard → Expanded Ctrl+A, вторая часть | Default Obsidian, Custom, Last press clears highlighting | принят 2026-10-06 |
| 7 | `smart-delete` | Keyboard → Smart Delete\Backspace | Default Obsidian, Smart Delete, Drop the line Prefix, Join with a space, Smart Backspace | принят 2026-10-05 (образец) |
| 8 | `smart-enter` | Keyboard → Smart Enter | Default Obsidian, Smart Enter, все три Prefix on the new line, Use Shift+Enter instead | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 9 | `smart-paste` | Keyboard → Smart paste | Default Obsidian и Smart paste: две строки в два раздела | принят 2026-10-06 |
| 10 | `binder` | Keyboard → Binder, Smart bracket | новая команда →, её клавиша в строке, Smart bracket | принят 2026-10-07 |
| 11 | `hotkeys` | Keyboard → Commands & Hotkeys | Hotkey settings, Obsidian's Hotkeys | принят 2026-10-06 |
| 12 | `fields` | Tags & PKM → Fields | один Field, его Values и tagWheel (его сценарий) | принят 2026-10-05 (образец); перезаписан 2026-10-06 с заливкой tagWheel |
| 12 | `fields-2` | Tags & PKM → Fields: новый Field | окно Add a Field (Tag, Link, Element, Action), Field выбран сразу, tagWheel с двумя Fields | перезаписан 2026-10-07 по его замечанию, ждёт приёмки |
| 12 | `fields-next` | Tags & PKM → Fields: next/previous | Status next и previous против tagWheel | принят 2026-10-06; перезаписан 2026-10-06 с заливкой tagWheel |
| 12 | `value-eye` | Tags & PKM → Fields: глаз у Value | через tagWheel и Scroller: Default, глаз на #doing, строка с ним | перезаписан 2026-10-07 по его замечанию, ждёт приёмки |
| 12 | `element-steps` | Tags & PKM → Fields: Element | дата, Value format → 001, Steps by → List of Values | принят 2026-10-07 |
| 12 | `action-field` | Tags & PKM → Fields: Action Field | Add Field → Action, через tagWheel: коллаут Note, Tip, снять, Cleanup | перезаписан 2026-10-07 по его замечанию, ждёт приёмки |
| 12 | `link-rename` | Tags & PKM → Fields: переименование link Value | Value в таблице, окно Rename the note too?, итог; Project A открыта рядом | принят 2026-10-07 |
| 13 | `child-fields` | Tags & PKM → Fields: дети | Child Field: After parent, Always | принят 2026-10-06; перезаписан 2026-10-06 с заливкой tagWheel |
| 13 | `nested-tags` | Tags & PKM → Fields: Child tag format | дочерний Value, Separate, Nested, Inline to note плавающей кнопкой | перезаписан 2026-10-07 по его замечанию, ждёт приёмки |
| 13 | `prerequisite` | Tags & PKM → Fields: Prerequisite Field | Prerequisite Field и ⬑Status, до и после | принят 2026-10-07 |
| 14 | `custom-blocks` | Tags & PKM → Fields: Add Block | Right Block, Custom block | перезаписан 2026-10-06 с заливкой tagWheel, ждёт приёмки |
| 15 | `separators` | Tags & PKM → Separators | Left Block, Right Block, First и Second Separator | принят 2026-10-06 |
| 15 | `separator-rewrite` | Tags & PKM → Separators: Old Separators in your notes | смена Separator, Replace in all notes, итог; вторая заметка рядом | принят 2026-10-07 |
| 15 | `ticked-line` | Tags & PKM → Writing rules: ticked line | Default Obsidian, Mark ticked line, Dim ticked line | принят 2026-10-06 |
| 16 | `tagwheel` | Tags & PKM → tagWheel behavior | navigation behavior, Values in the other Block | перезаписан 2026-10-06 с заливкой tagWheel, ждёт приёмки |
| 16 | `tagwheel-2` | Tags & PKM → tagWheel behavior, вторая часть | Active Field on opening | перезаписан 2026-10-06 с заливкой tagWheel, ждёт приёмки |
| 17 | `placement` | Tags & PKM → Placement modes | Strict: add a bullet, Keep typed tags in text | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 17 | `prefix-behavior` | Tags & PKM → Fields: Prefix behavior | где контрол, Strict, Insert only, Insert only без Field Prefix | записан впервые 2026-10-06 по его замечанию к placement, ждёт приёмки |
| 18 | `transform` | Transform → Inline to note, New note naming, Note content | Inline to note, Line above the text, Note name: Ask | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 19 | `transform-source` | Transform → Source line | Sub-lines, What happens with current line, Dim transformed line | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 20 | `auto-moc` | Transform → Auto-MOC in your links | Link the notes you mention, Where to put the link, Under heading, If heading not found; Project B открыта рядом | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 20 | `auto-moc-2` | Transform → Auto-MOC in your links, вторая часть | Add empty line before wikilink, Field Value, Date and time, Emoji before the date, Place in the list | записан впервые 2026-10-06 по его замечанию, ждёт приёмки |
| 21 | `smart-rules` | Transform → Smart Rules | шаблон по умолчанию, правило для Project A | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 22 | `line-view` | Visual → Line view, Tag view | Tag bubble corners, Block text size, Block opacity, Stripe, Stripe opacity | принят 2026-10-06 |
| 23 | `link-view` | Visual → Link view | цвета ссылок и скобок | принят 2026-10-06 |
| 24 | `tag-bars` | Visual → Tag Bars | Tag Bars, Number of Bars, Hide the tag, Bars for the whole tree, Join Bars; заметка и панель рядом | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 24 | `tag-bars-look` | Visual → Tag Bars: вид | Bar thickness, Distance from the text, Space between Bars, Vertical gap; заметка и панель рядом | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 25 | `tagwheel-colors` | Visual → tagWheel (Panel): цвета | цвет темы, Background color, цвета Field и Value | принят 2026-10-07 |
| 25 | `tagwheel-look` | Visual → tagWheel (Panel, Scroller) | Show tag markers, Scroller | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 26 | `cursor` | Visual → Text cursor | цвет и ширина каретки | перезаписан 2026-10-06 по его замечаниям, ждёт приёмки |
| 26 | `cursor-jump` | Visual → Cursor jump highlight | Default Obsidian, круг прыжка, внутри строки | записан впервые 2026-10-06, ждёт приёмки |
| 27 | `custom-tags` | Visual → Color custom tags | свои теги, Fill, Show empty | принят 2026-10-06 |
| 28 | `modules` | General → Modules | Visual, Navigation off | принят 2026-10-06 |
| 29 | `backup` | Advanced → Backup | Save a backup, Restore, Autosave | принят 2026-10-06 |
| 30 | `diagnostics` | Advanced → Diagnostics | Undo last settings change, Show option IDs in tips | принят 2026-10-06 |

Язык и Guide (General → Language, Help) — без записи: показывать нечего, кроме
файла в папке плагина. Нужны — скажет.
