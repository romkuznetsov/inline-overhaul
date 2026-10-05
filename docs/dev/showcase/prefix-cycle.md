# prefix-cycle — Move lines (left/right): Prefix и отступ

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Navigation → Move lines (left/right)`, половина `Moving lines (left and right)`, в `docs/SETTINGS.md`. Контролы: `After the last one`, `Cycle in both directions`; `Cycle line Prefixes` и `Change the indent` — умолчанием (on).

Не показаны: `Cycle line Prefixes` → off, `Change the indent` → off, `Indent the whole tree`, сам список Prefix в панели.

Заметка — `vault/Prefix cycle.md` (раздел `Shopping`: `- milk` и три строки простым текстом). Клавиши — `Move right`, `Move left`. Список Prefix стартового набора: `#` … `#####`, `1.`, простой текст, `-`; `Move right` идёт по нему вниз, `Move left` — вверх. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Cycle line Prefixes | `Cycle line Prefixes → on`, `Move right → plain text becomes a bullet`, `Move right again → no marker left, so it indents`, `Move left → back out of the indent`, `Move left → back to plain text`, `Move left → a numbered item`, `Move left → a heading` |
| Start over | `After the last one → Start over`, `Move right → after the bullet it starts over from #` |
| Only Move left cycles | `Cycle in both directions → off`, `Move right → plain text stays as it is`, `Move left still changes the marker` |

Таблица собрана из `steps/prefix-cycle.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/prefix-cycle.steps` (технические, не согласуются).
