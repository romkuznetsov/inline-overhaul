# tagwheel — tagWheel behavior

**Состояние: записан 2026-10-04, двумя GIF (`tagwheel.gif`, `tagwheel-2.gif`): одним выходило 67 с; ждёт приёмки.** `tagwheel.gif` записан поверх прежнего, на который ссылаются `docs/SHOWCASE.md` и `docs/TUTORIAL.md`.

Группа `Tags & PKM → tagWheel behavior` в `docs/SETTINGS.md`. Контролы: `tagWheel navigation behavior`, `Values in the other Block` (первый GIF); `Active Field on opening` вместе с `Left Block active Field` и `Right Block active Field` (второй). `Line for a selection` и `Switch custom blocks on Tab` не показаны (выделение нескольких строк и два custom block — отдельные показы). Вид tagWheel (Scroller, цвета) — `tagwheel-look`.

Заметка — `vault/tagWheel.md`, ссылка ведёт на пустую `vault/Project A.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Полоса внизу GIF — этапы. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка.

### tagwheel.gif

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | tagWheel Left на `- call the bank`: `↑` — `#todo`, `→` — Priority, `→` — снова Status, `Enter` | `Default: → stays inside the Block` |
| 1 | tagWheel Left на `- #todo \|\| pay the rent \|\| [[Project A]]` — `[[Project A]]` пропадает, пока tagWheel открыт; `Esc` | `Default: the other Block is hidden` |
| 2 | `tagWheel navigation behavior` → `Next Block`; на `call the bank`: `→` `→` — переход в Due, `↑` — сегодняшняя дата, `Enter` | `→ walks on into the right Block` |
| 3 | `Values in the other Block` → `Show`; та же строка — `[[Project A]]` остаётся на виду; `Esc` | `The other Block stays in view` |

### tagwheel-2.gif

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | tagWheel Left на `- call the bank` открывается на Status, `↑` — `#todo`, `Enter` | `Default: tagWheel Left opens on the first Field` |
| 1 | tagWheel Right открывается на Due, `↑` — сегодняшняя дата, `Enter` | `Default: tagWheel Right opens on the first Field` |
| 2 | `Active Field on opening` → `Chosen Field`, `Left Block active Field` → `Priority`, `Right Block active Field` → `Project`; tagWheel Left открывается на Priority, `↓` — `#high`, `Enter` | `tagWheel Left opens on Priority` |
| 2 | tagWheel Right открывается на Project, `↑` — `[[Project A]]`, `Enter` | `tagWheel Right opens on Project` |

Подсвечивается строка с кареткой; у строки — плашка: `hotkey: tagWheel Left` / `hotkey: tagWheel Right`, затем каждая клавиша.

Шаги записи — `steps/tagwheel.steps`, `steps/tagwheel-2.steps` (технические, не согласуются).
