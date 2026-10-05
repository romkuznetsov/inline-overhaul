# Каталог GIF для Showcase

Одна строка — одна запись. Источник — группы `docs/SETTINGS.md` (его ответ
2026-09-25: «список по FEATURES.md»). Порядок — сперва пилот, потом по разделам.
Состояния: `—` не начато, `записан`, `принят`, `в Showcase`, `отложен` (с причиной). С 2026-10-04 сценарии не согласуются: пишу, записываю, приёмка общая (навык `showcase-gif`).
«Только панель» — у фичи нет поведения в заметке, запись показывает панель.

Все GIF — `docs/media/showcase/<id>.gif`; что в каждом — `docs/dev/showcase/<id>.md`. Перезаписаны 2026-10-05 на сборке 0.16.1 по каркасу после приёмки трёх образцов; к выпуску — перезапись одной командой на сборке выпуска. В ожиданиях `readme-hero`, `fields`, `tagwheel`, `tagwheel-2` стоит дата записи: в другой день их `expect` правится под дату.

| № | id | Фича (группа SETTINGS.md) | Что показано | Состояние |
|---|---|---|---|---|
| 0 | `readme-hero` | Шапка README: строка через tagWheel | tagWheel Left и Right заполняют строку | записан 2026-10-05 днём; его слово — переделать последним |
| 1 | `move-lines` | Navigation → Move lines (up/down) | Default Obsidian, Whole tree, Jump over trees, Whole section, Stop at headings | перезаписан 2026-10-05, ждёт приёмки; «до» влит первым этапом |
| 1 | `move-lines-2` | Navigation → Move lines (up/down), вторая часть | Highlight after moving, Where the line lands, Follow the moved line | перезаписан 2026-10-05, ждёт приёмки |
| 2 | `move-inline` | Navigation → Move lines (left/right): выделенный текст | Move selected text, Step out of the word, Continue past Separators | перезаписан 2026-10-05, ждёт приёмки; Movement step не показан |
| 3 | `prefix-cycle` | Navigation → Move lines (left/right): префикс и отступ | Cycle line Prefixes, After the last one, Cycle in both directions | перезаписан 2026-10-05, ждёт приёмки |
| 4 | `jump-line` | Navigation → Jump inside a line | Default Obsidian, Move cursor inside a line, Step size, What to do at the end, Continue past Separators | принят 2026-10-05 (образец) |
| 5 | `jump-note` | Navigation → Jump inside a note | Default Obsidian, Jump between headings, Where in the section, Jump target | перезаписан 2026-10-05, ждёт приёмки |
| 6 | `ctrl-a` | Keyboard → Expanded Ctrl+A | Default Obsidian, Smart Ctrl+A, Selection steps | перезаписан 2026-10-05, ждёт приёмки |
| 6 | `ctrl-a-2` | Keyboard → Expanded Ctrl+A, вторая часть | Default Obsidian, Custom, Last press clears highlighting | перезаписан 2026-10-05, ждёт приёмки |
| 7 | `smart-delete` | Keyboard → Smart Delete\Backspace | Default Obsidian, Smart Delete, Drop the line Prefix, Join with a space, Smart Backspace | принят 2026-10-05 (образец) |
| 8 | `smart-enter` | Keyboard → Smart Enter | Default Obsidian, Smart Enter, все три Prefix on the new line, Use Shift+Enter instead | перезаписан 2026-10-05, ждёт приёмки |
| 9 | `smart-paste` | Keyboard → Smart paste | Default Obsidian и Smart paste: две строки в два раздела | перезаписан 2026-10-05, ждёт приёмки; Obsidian сам считает вставку под списком — оставлено честно (В-295) |
| 10 | `binder` | Keyboard → Binder, Smart bracket | новая команда →, её клавиша в строке, Smart bracket | перезаписан 2026-10-05, ждёт приёмки |
| 11 | `hotkeys` | Keyboard → Commands & Hotkeys | Hotkey settings, Obsidian's Hotkeys | перезаписан 2026-10-05, ждёт приёмки; только панель |
| 12 | `fields` | Tags & PKM → Fields | один Field, его Values и tagWheel (его сценарий) | принят 2026-10-05 (образец) |
| 12 | `fields-2` | Tags & PKM → Fields: новый Field | Add Field с одним Value, tagWheel с двумя Fields | перезаписан 2026-10-05, ждёт приёмки |
| 12 | `fields-next` | Tags & PKM → Fields: next/previous | Status next и previous против tagWheel | записан впервые 2026-10-05, ждёт приёмки |
| 13 | `child-fields` | Tags & PKM → Fields: дети | Child Field: After parent, Always | перезаписан 2026-10-05, ждёт приёмки |
| 14 | `custom-blocks` | Tags & PKM → Fields: Add Block | Right Block, Custom block | перезаписан 2026-10-05, ждёт приёмки |
| 15 | `separators` | Tags & PKM → Separators | Left Block, Right Block, First и Second Separator | перезаписан 2026-10-05, ждёт приёмки |
| 15 | `ticked-line` | Tags & PKM → Writing rules: ticked line | Default Obsidian, Mark ticked line, Dim ticked line | записан впервые 2026-10-05, ждёт приёмки |
| 16 | `tagwheel` | Tags & PKM → tagWheel behavior | navigation behavior, Values in the other Block | перезаписан 2026-10-05, ждёт приёмки |
| 16 | `tagwheel-2` | Tags & PKM → tagWheel behavior, вторая часть | Active Field on opening | перезаписан 2026-10-05, ждёт приёмки |
| 17 | `placement` | Tags & PKM → Placement modes | Strict: add a bullet, Keep typed tags in text | перезаписан 2026-10-05, ждёт приёмки |
| 18 | `transform` | Transform → Inline to note, New note naming, Note content | Inline to note, Line above the text, Note name: Ask | перезаписан 2026-10-05, ждёт приёмки |
| 19 | `transform-source` | Transform → Source line | Sub-lines, What happens with current line, Dim transformed line | перезаписан 2026-10-05, ждёт приёмки |
| 20 | `auto-moc` | Transform → Auto-MOC in your links | Link the notes you mention | перезаписан 2026-10-05, ждёт приёмки |
| 21 | `smart-rules` | Transform → Smart Rules | шаблон по умолчанию, правило для Project A | записан впервые 2026-10-05, ждёт приёмки |
| 22 | `line-view` | Visual → Line view, Tag view | Tag bubble corners, Block text size, Block opacity, Stripe, Stripe opacity | перезаписан 2026-10-05, ждёт приёмки |
| 23 | `link-view` | Visual → Link view | цвета ссылок и скобок | перезаписан 2026-10-05, ждёт приёмки |
| 24 | `tag-bars` | Visual → Tag Bars | Tag Bars, Number of Bars, Hide the tag, Bars for the whole tree, Join Bars | перезаписан 2026-10-05, ждёт приёмки |
| 24 | `tag-bars-look` | Visual → Tag Bars: вид | Bar thickness, Distance from the text, Space between Bars, Vertical gap | записан впервые 2026-10-05, ждёт приёмки |
| 25 | `tagwheel-look` | Visual → tagWheel (Panel, Scroller) | Show tag markers, Scroller | перезаписан 2026-10-05, ждёт приёмки |
| 26 | `cursor` | Visual → Text cursor, Cursor jump highlight | цвет и ширина каретки, круг прыжка | перезаписан 2026-10-05, ждёт приёмки |
| 27 | `custom-tags` | Visual → Color custom tags | свои теги, Fill, Show empty | перезаписан 2026-10-05, ждёт приёмки |
| 28 | `modules` | General → Modules | Visual, Navigation off | перезаписан 2026-10-05, ждёт приёмки |
| 29 | `backup` | Advanced → Backup | Save a backup, Restore, Autosave | перезаписан 2026-10-05, ждёт приёмки; только панель |
| 30 | `diagnostics` | Advanced → Diagnostics | Undo last settings change, Show option IDs in tips | перезаписан 2026-10-05, ждёт приёмки |

Язык и Guide (General → Language, Help) — без записи: показывать нечего, кроме
файла в папке плагина. Нужны — скажет.
