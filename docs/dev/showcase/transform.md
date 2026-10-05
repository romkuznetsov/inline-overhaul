# transform — Inline to note, New note naming, Note content

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группы `Transform → Inline to note`, `New note naming`, `Note content` в `docs/SETTINGS.md`. Ключевые контролы: `Inline to note`, `Open note after creation`, `Line above the text`, `Note name`. Шаблоны (`Templates folder`, `Default template`) не показываются: при наборе папки в поле панель на миг сбрасывает его и всплывает «Settings changed on disk…» (находка). `If the name already taken` → `Add to existing` не показывается: уведомление при нём говорит «Note created», хотя текст дописан в существующую заметку (находка).

Заметка — `vault/Party plans.md`. Команда `Transform inline to note`. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Inline to note | `Inline to note → on, and its Floating button →`, `Click → : the line becomes a note, named from its [brackets]`, `The line now links to the note` |
| Line above: Fixed text | `Line above the text → Fixed text`, `The note starts with the fixed text, not the date` |
| Note name: Ask | `Note name → Ask`, `Ask → you type the name yourself` |

Таблица собрана из `steps/transform.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/transform.steps` (технические, не согласуются).
