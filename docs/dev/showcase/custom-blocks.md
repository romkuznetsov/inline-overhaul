# custom-blocks — Fields: Add Block

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группа `Tags & PKM → Fields`, кнопка `Add Block` в `docs/SETTINGS.md`. Custom block пишет свои Fields там, где стоит каретка, своей командой `tagWheel <block>`. `Switch custom blocks on Tab` не показан: нужен второй custom block.

Заметка — `vault/Custom blocks.md`, ссылки ведут на пустые `vault/Project A.md` и `vault/Project B.md`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Два этапа — полоса внизу GIF. Первый — поведение по умолчанию; второй начинается заходом в настройки, после выхода — исходная заметка.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | tagWheel Right на `- call the bank about the card`: `→` — Project, `↑` — `[[Project A]]`, `Enter` — ссылка встаёт в конец строки | `Default: a link goes after the text` |
| 2 | в панели `Add Block`, затем стрелка `↓` у Project — Project уезжает в `Custom block 1`; каретка перед `about`, `tagWheel Custom block 1`, `↑`, `Enter` — `[[Project A]]` встаёт на месте каретки | `tagWheel Custom block 1 → the link goes at the cursor` |
| 2 | ещё раз `tagWheel Custom block 1` на ссылке, `↑`, `Enter` — на её месте `[[Project B]]` | `Again on the link → the next Value in its place` |

Светится фиолетовая каретка (фона строки нет — его слово 2026-10-04); у строки — плашка: `hotkey: tagWheel Right`, `hotkey: tagWheel Custom block 1`, затем каждая клавиша.

Шаги записи — `steps/custom-blocks.steps` (технические, не согласуются).
