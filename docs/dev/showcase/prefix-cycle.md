# prefix-cycle — Move lines (left/right): Prefix и отступ

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Navigation → Move lines (left/right)`, половина `Moving lines (left and right)`, в `docs/SETTINGS.md`. Контролы: `After the last one`, `Cycle in both directions`; `Cycle line Prefixes` и `Change the indent` — умолчанием (on).

Не показаны: `Cycle line Prefixes` → off, `Change the indent` → off, `Indent the whole tree`, сам список Prefix в панели.

Заметка — `vault/Prefix cycle.md` (раздел `Shopping`: `- milk` и три строки простым текстом). Клавиши — `Move right`, `Move left`. Список Prefix стартового набора: `#` … `#####`, `1.`, простой текст, `-`; `Move right` идёт по нему вниз, `Move left` — вверх. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Три этапа — полоса внизу GIF.

| Этап | Что показывается | Субтитр |
|---|---|---|
| — | заставка | `Change the line marker` / `Move left and right cycle bullet, number and heading, then indent` |
| 1 | `bread` вправо — `- bread` | `Move right → plain text becomes a bullet` |
| 1 | вправо ещё — отступ под `milk` | `Move right again → no marker left, so it indents` |
| 1 | влево — отступ снят | `Move left → back out of the indent` |
| 1 | влево — простой текст | `Move left → back to plain text` |
| 1 | влево — `1. bread` | `Move left → a numbered item` |
| 1 | влево — `##### bread` | `Move left → a heading` |
| 2 | `After the last one` → `Start over`; `bread` вправо дважды — `- bread`, затем `# bread` | `Move right → after the bullet it starts over from #` |
| 3 | `Cycle in both directions` → off; вправо дважды — строка стоит | `Move right → plain text stays as it is` |
| 3 | влево — `1. bread` | `Move left still changes the marker` |

Этап 1 — одна строка туда и обратно (его слово 2026-10-04: «нелогично показано»). Подсвечены отступ и Prefix, а не строка (его слово: «акцент на префикс и отступ»); у строки — плашка с командой.

Шаги записи — `steps/prefix-cycle.steps` (технические, не согласуются).
