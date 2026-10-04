# backup — Advanced → Backup

**Состояние: записан 2026-10-04; ждёт приёмки. Только панель.**

Группа `Advanced → Backup` в `docs/SETTINGS.md`. Контролы в записи: `Save a backup`, `Restore a backup`, `Autosave`. `Start over` не нажимается: он стирает все настройки (окно подтверждения есть, но показ на GIF — это нажатие красной кнопки, которое легко принять за совет).

Заметка — `vault/Home tasks.md` (только фон до и после панели). Копия пишется во временный vault записи. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Два этапа — полоса внизу GIF: заметка, затем панель.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Заметка | `Backup: your settings, kept as a note in your vault` |
| 2 | Вкладка Advanced, щелчок `Save a backup` — окно: строка описания, галочки вкладок, выбор хоткеев | `Pick the tabs to keep, then Save` |
| 2 | Щелчок `Save` — сообщение `Settings saved: inlineOverhaul/Backups/Settings <дата>.md` | `Pick the tabs to keep, then Save` |
| 2 | Щелчок `Restore a backup` — окно со списком копий, новая сверху; `Cancel` | `Restore a backup lists them, newest first` |
| 2 | `Autosave` → on, панель закрывается | `Autosave → on: a fresh copy whenever your settings change` |

Шаги записи — `steps/backup.steps` (технические, не согласуются).
