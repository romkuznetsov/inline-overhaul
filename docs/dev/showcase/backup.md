# backup — Advanced → Backup

**Состояние: перезаписан 2026-10-05 по каркасу после приёмки образцов; ждёт приёмки.**

Группа `Advanced → Backup` в `docs/SETTINGS.md`. Контролы в записи: `Save a backup`, `Restore a backup`, `Autosave`. `Start over` не нажимается: он стирает все настройки (окно подтверждения есть, но показ на GIF — это нажатие красной кнопки, которое легко принять за совет).

Заметка — `vault/Home tasks.md` (только фон до и после панели). Копия пишется во временный vault записи. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

| Этап | Субтитры |
|---|---|
| Save a backup | `Backup: your settings, kept as a note in your vault`, `Pick the tabs to keep, then Save` |
| Restore | `Restore a backup lists them, newest first` |
| Autosave | `Autosave → on: a fresh copy whenever your settings change` |

Таблица собрана из `steps/backup.steps` (этапы — `stage`, субтитры — `say`).

Шаги записи — `steps/backup.steps` (технические, не согласуются).
