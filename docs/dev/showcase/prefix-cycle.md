# prefix-cycle — Move lines (left/right): Prefix и отступ

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Navigation → Move lines (left/right)`, половина `Moving lines (left and right)`, в `docs/SETTINGS.md`. Контролы: `After the last one`, `Cycle in both directions`; `Cycle line Prefixes` и `Change the indent` — умолчанием (on).

Не показаны: `Cycle line Prefixes` → off, `Change the indent` → off, `Indent the whole tree`, сам список Prefix в панели.

Заметка — `vault/Prefix cycle.md` (раздел `Shopping`: `- milk` и три строки простым текстом). Клавиши — `Move right`, `Move left`. Список Prefix стартового набора: `#` … `#####`, `1.`, простой текст, `-`; `Move right` идёт по нему вниз, `Move left` — вверх. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Три этапа — полоса внизу GIF.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | `bread` вправо — становится пунктом `- bread` | `Default: Move right turns plain text into a bullet…` |
| 1 | `- bread` вправо ещё раз — список кончился, строка уходит с отступом под `milk` | `…and after the last marker it indents the line` |
| 1 | `eggs` влево дважды — `1. eggs`, затем заголовок `##### eggs` | `Move left goes the other way: numbered, then a heading` |
| 2 | `After the last one` → `Start over`; `bread` вправо дважды — `- bread`, затем список с начала: `# bread` | `Move right → after the bullet it starts over from #` |
| 3 | `Cycle in both directions` → off; `bread` вправо дважды — строка стоит, плашка мигает | `Move right → plain text stays as it is` |
| 3 | `bread` влево — `1. bread` | `Move left still changes the marker` |

Подсвечивается строка, которую меняет нажатие; у строки — плашка с командой (`hotkey: Move right` / `Move left`), до нажатия.

Шаги записи — `steps/prefix-cycle.steps` (технические, не согласуются).
