# Каталог GIF для Showcase

Одна строка — одна запись. Источник — группы `docs/SETTINGS.md` (его ответ
2026-09-25: «список по FEATURES.md»). Порядок — сперва пилот, потом по разделам.
Состояния: `—` не начато, `записан`, `принят`, `в Showcase`, `отложен` (с причиной). С 2026-10-04 сценарии не согласуются: пишу, записываю, приёмка общая (навык `showcase-gif`).
«Только панель» — у фичи нет поведения в заметке, запись показывает панель.

Все GIF — `docs/media/showcase/<id>.gif`; что в каждом — `docs/dev/showcase/<id>.md`. Записаны 2026-10-04 на замороженной сборке (≈ 0.15.0); к выпуску — перезапись одной командой на сборке выпуска. В ожиданиях `readme-hero`, `fields`, `tagwheel`, `tagwheel-2` стоит дата записи: в другой день их `expect` правится под дату.

| № | id | Фича (группа SETTINGS.md) | Что показано | Состояние |
|---|---|---|---|---|
| 0 | `readme-hero` | Шапка README: строка через tagWheel | tagWheel Left и Right заполняют строку | записан; вопрос о строке README и длине |
| 1 | `move-lines-before` | «До»: встроенная Move line up Obsidian | три нажатия встроенной команды | записан |
| 1 | `move-lines` | Navigation → Move lines (up/down) | Moving behavior, Jump over neighbor trees, Moving headings, Cross heading boundaries | записан, **образец принят 2026-10-04** |
| 1 | `move-lines-2` | Navigation → Move lines (up/down), вторая часть | Highlight after moving, Where the line lands, Follow the moved line | записан |
| 2 | `move-inline` | Navigation → Move lines (left/right): выделенный текст | Movement step (auto), Continue past Separators | записан; `Character` не показан, вопрос о `Word` |
| 3 | `prefix-cycle` | Navigation → Move lines (left/right): префикс и отступ | After the last one, Cycle in both directions | записан; заменил прежний GIF, на который ссылается SHOWCASE.md |
| 4 | `jump-line` | Navigation → Jump inside a line | Step size, What to do at the end, Continue past Separators | перезаписан 2026-10-05, образец новых правил |
| 5 | `jump-note` | Navigation → Jump inside a note | Where in the section, Jump target | записан |
| 6 | `ctrl-a` | Keyboard → Expanded Ctrl+A | Smart Ctrl+A, Selection steps | записан |
| 6 | `ctrl-a-2` | Keyboard → Expanded Ctrl+A, вторая часть | Custom, Last press clears highlighting | записан |
| 7 | `smart-delete` | Keyboard → Smart Delete\Backspace | Smart Delete, Smart Backspace, Drop the line Prefix | перезаписан 2026-10-05, образец новых правил |
| 8 | `smart-enter` | Keyboard → Smart Enter | Smart Enter, Use Shift+Enter instead, Prefix on the new line | записан; `Text only` не показан — кадр похож на поломку |
| 9 | `smart-paste` | Keyboard → Smart paste | Smart paste | записан |
| 10 | `binder` | Keyboard → Binder, Smart bracket | Smart bracket, Add command | записан |
| 11 | `hotkeys` | Keyboard → Commands & Hotkeys | to hotkeys | записан; только панель |
| 12 | `fields` | Tags & PKM → Fields | один Field, его Values и tagWheel (его сценарий) | перезаписан 2026-10-05, образец новых правил |
| 12 | `fields-2` | Tags & PKM → Fields: Values | Add Value, глаз, Show custom | записан |
| 13 | `child-fields` | Tags & PKM → Fields: дети | Child Field: After parent, Always | записан; On Alt, Parent Value, Navigator — не вошли |
| 14 | `custom-blocks` | Tags & PKM → Fields: Add Block | Add Block, tagWheel Custom block | записан |
| 15 | `separators` | Tags & PKM → Separators, Writing rules | Separators, Mark/Dim ticked line | записан |
| 16 | `tagwheel` | Tags & PKM → tagWheel behavior | navigation behavior, Values in the other Block | записан |
| 16 | `tagwheel-2` | Tags & PKM → tagWheel behavior, вторая часть | Active Field on opening | записан |
| 17 | `placement` | Tags & PKM → Placement modes | Strict: add a bullet, Keep typed tags in text | записан |
| 18 | `transform` | Transform → Inline to note, New note naming, Note content | Inline to note, Line above the text, Note name: Ask | записан |
| 19 | `transform-source` | Transform → Source line | Sub-lines, What happens with current line, Dim transformed line | записан |
| 20 | `auto-moc` | Transform → Auto-MOC in your links | Link the notes you mention | записан; Under heading — дефект в пустой заметке |
| 21 | `smart-rules` | Transform → Smart Rules | — | **отложен**: окно условия показывает HTML-разметку текстом (дефект плагина) |
| 22 | `line-view` | Visual → Line view, Tag view | Tag bubble corners, Stripe, Block text size, Block opacity | записан; панель в кадре дольше обычного |
| 23 | `link-view` | Visual → Link view | цвета ссылок и скобок | записан; Preview on hover, Drag — не показаны |
| 24 | `tag-bars` | Visual → Tag Bars | Tag Bars, толщина, уровни дерева | записан |
| 25 | `tagwheel-look` | Visual → tagWheel (Panel, Scroller) | Show tag markers, Scroller | записан; «подсветка выключена» — вопрос о дефекте |
| 26 | `cursor` | Visual → Text cursor, Cursor jump highlight | цвет и ширина каретки, круг прыжка | записан |
| 27 | `custom-tags` | Visual → Color custom tags | Fill, Text, Show empty | записан |
| 28 | `modules` | General → Modules | Visual, Navigation off | записан |
| 29 | `backup` | Advanced → Backup | Save a backup, Restore, Autosave | записан; только панель |
| 30 | `diagnostics` | Advanced → Diagnostics | Undo last settings change, Show option IDs in tips | записан; только панель |

Язык и Guide (General → Language, Help) — без записи: показывать нечего, кроме
файла в папке плагина. Нужны — скажет.
