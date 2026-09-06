# Карта ID команд: версия 1 → версия 2

**Файл сгенерирован** `node tools/command_ids_doc.js --write` из
`src/features/command_ids.js`. Руками не правится: правится модуль.

Зачем эта карта. Хоткеи в Obsidian привязаны к **идентификатору** команды, а не
к её имени. В фазе 2 идентификаторы переехали в kebab-case без префикса плагина
(T7), и все назначенные хоткеи после обновления перестали работать. Миграция
конфига этого не покрывает — хоткеи живут в настройках Obsidian, а чужой файл
настроек плагин не правит. Поэтому плагин один раз показывает уведомление и
печатает эту карту в консоль (Р3, фаза 2, пункт 8).

**Что делать.** Откройте `Settings` → `Hotkeys`, найдите `inlineOverhaul` и
назначьте клавиши заново по таблице ниже. Полный идентификатор в менеджере
хоткеев выглядит как `inline-overhaul:<id>`.

## Переименованные команды

| Было | Стало | Имя в списке команд |
|---|---|---|
| `inlineOverhaul_Navigation_MoveUp` | `move-line-up` | `Move line up` |
| `inlineOverhaul_Navigation_MoveDown` | `move-line-down` | `Move line down` |
| `inlineOverhaul_Navigation_MoveLeft` | `move-left` | `Move left` |
| `inlineOverhaul_Navigation_MoveRight` | `move-right` | `Move right` |
| `inlineOverhaul_Navigation_JumpHeaderUp` | `jump-back` | `Jump back` |
| `inlineOverhaul_Navigation_JumpHeaderDown` | `jump-next` | `Jump next` |
| `inlineOverhaul_Navigation_InlineLeft` | `move-cursor-left-in-line` | `Move cursor left in line` |
| `inlineOverhaul_Navigation_InlineRight` | `move-cursor-right-in-line` | `Move cursor right in line` |
| `inlineOverhaul_Hotkey_tagwheel_left` | `open-tagwheel-left` | `Open TagWheel on the left` |
| `inlineOverhaul_Hotkey_tagwheel_right` | `open-tagwheel-right` | `Open TagWheel on the right` |
| `inlineOverhaul_Transform_inline2note` | `transform-inline-to-note` | `Transform inline to note` |
| `inlineOverhaul_Binder_Smart_bracket` | `smart-bracket` | `Smart bracket` |

## Команды, идентификатор которых не менялся

Эти идентификаторы уже отвечали T7 — kebab-case без префикса плагина, — и
переименовывать их значило бы ломать работающий хоткей ради красоты. Р3 даёт
один разрыв, а не два. У них изменилось только **имя**, а имя к хоткею не
привязано.

| Идентификатор | Было имя | Стало имя |
|---|---|---|
| `undo-last-settings-change` | `General: Undo last settings change` | `Undo last settings change` |
| `toggle-feature-<module>` | `General: Toggle <Module> module` | `Toggle <Module> module` |
| `open-inline-overhaul-settings` | `General: Open settings` | `Open settings` |

Команда `Open settings` удаляется вместе с вызовом `app.setting.open()` в
фазе 6, пункт 5 (T8). До тех пор она живёт, и имя ей тоже приведено к T6.

## Команды, которых нет в таблице: они собираются из ваших данных

**Команды полей.** У каждого Field есть пара команд — вперёд и назад по его
Values. Идентификатор собирается из **строгого имени** Field:

| Было | Стало |
|---|---|
| `inlineOverhaul_Hotkey_<field>_increase` | `<field>-next` |
| `inlineOverhaul_Hotkey_<field>_decrease` | `<field>-previous` |

Строгое имя приводится к kebab-case: `date_due` даёт `date-due-next` и
`date-due-previous`. Имя команды в списке — `<Field> next` и
`<Field> previous`.

**Строки Binder.** Идентификатор собирается из имени строки:
`inlineOverhaul_Binder_<Name>` → `<name>` в kebab-case. Идентификатор строки
хранится в конфиге (`editor.binder.rows[].commandId`), и старая форма там
считается отсутствующей: она пересобирается из имени строки на первой же
загрузке.

**Совпадения разводятся.** Два Field, чьи строгие имена дают один kebab
(`date_due` и `date-due`), получают `date-due-next` и `date-due-2-next`.
Строка Binder, названная как команда ядра, тоже получает суффикс: затенить
навигацию своей строкой нельзя.
