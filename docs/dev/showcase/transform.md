# transform — Inline to note, New note naming, Note content

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группы `Transform → Inline to note`, `New note naming`, `Note content` в `docs/SETTINGS.md`. Ключевые контролы: `Inline to note`, `Open note after creation`, `Line above the text`, `Note name`. Шаблоны (`Templates folder`, `Default template`) не показываются: при наборе папки в поле панель на миг сбрасывает его и всплывает «Settings changed on disk…» (находка). `If the name already taken` → `Add to existing` не показывается: уведомление при нём говорит «Note created», хотя текст дописан в существующую заметку (находка).

Заметка — `vault/Party plans.md`. Команда `Transform inline to note`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Четыре этапа — полоса внизу GIF. Первый — поведение по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — исходная заметка. С этапа 2 новая заметка открывается своей вкладкой; назад к `Party plans` — щелчок по её вкладке.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Нажатие на `[Garden party] invite the neighbors` — строка стоит, уведомление «Inline to note is switched off» | `Default: Transform is off → the line stays` |
| 2 | `Inline to note` и `Open note after creation` → on; открывается новая заметка `Garden party`, над текстом — дата и время | `The line becomes a note, named from its [brackets]` |
| 2 | Щелчок по вкладке `Party plans` — на месте строки ссылка `Garden party` и метка `#processed` | `The line now links to the note` |
| 3 | `Line above the text` → `Fixed text`; заметка `Bake sale` начинается строкой `Captured` вместо даты | `The note starts with the fixed text, not the date` |
| 4 | `Note name` → `Ask`; окно имени, набирается `Lemon cake`, `Create` — открывается заметка `Lemon cake` | `Ask → you type the name yourself` |

Светится фиолетовая каретка (фона строки нет — его слово 2026-10-04); у строки — плашка `hotkey: Transform inline to note`, до нажатия.

Шаги записи — `steps/transform.steps` (технические, не согласуются).
