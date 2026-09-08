"use strict";

/**
 * Карта старых и новых ID команд — `docs/command_ids_v1_v2.md`.
 *
 * Документ **выводится** из `src/features/command_ids.js`, а не пишется руками:
 * карта, набранная во второй раз, разойдётся с кодом, а расходиться ей нельзя —
 * на неё ссылается уведомление, которое человек увидит один раз и больше не
 * увидит никогда.
 *
 *   node tools/command_ids_doc.js            проверить (падает на расхождении)
 *   node tools/command_ids_doc.js --write    перезаписать документ
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEST = path.join(ROOT, "docs", "command_ids_v1_v2.md");
const ids = require(path.join(ROOT, "src", "features", "command_ids.js"));

/*
 * Правила для команд, собираемых из данных человека, **берутся у модуля**
 * (`RENAME_RULES`), а не переписываются здесь.
 *
 * Ревизия 2026-09-09: две строки этой таблицы были набраны в инструменте
 * литералами — то есть вторым объявлением того же правила (У-32), и это ровно
 * то, что запрещает шапка этого файла двумя абзацами выше. Разойтись им было
 * на чём: те же строки печатает человеку уведомление о смене хоткеев
 * (`plugin_bootstrap.js`), и печатает уже из модуля. Документ и печать
 * разошлись бы молча, а увидеть это человек может один раз в жизни — при
 * обновлении.
 */
const TICK = String.fromCharCode(96);
const RULE_ROWS = ids.RENAME_RULES
  .map(([was, now]) => "| " + TICK + was + TICK + " | " + TICK + now + TICK + " |")
  .join("\n");

const HEAD = `# Карта ID команд: версия 1 → версия 2

**Файл сгенерирован** \`node tools/command_ids_doc.js --write\` из
\`src/features/command_ids.js\`. Руками не правится: правится модуль.

Зачем эта карта. Хоткеи в Obsidian привязаны к **идентификатору** команды, а не
к её имени. В фазе 2 идентификаторы переехали в kebab-case без префикса плагина
(T7), и все назначенные хоткеи после обновления перестали работать. Миграция
конфига этого не покрывает — хоткеи живут в настройках Obsidian, а чужой файл
настроек плагин не правит. Поэтому плагин один раз показывает уведомление и
печатает эту карту в консоль (Р3, фаза 2, пункт 8).

**Что делать.** Откройте \`Settings\` → \`Hotkeys\`, найдите \`inlineOverhaul\` и
назначьте клавиши заново по таблице ниже. Полный идентификатор в менеджере
хоткеев выглядит как \`inline-overhaul:<id>\`.

## Переименованные команды

| Было | Стало | Имя в списке команд |
|---|---|---|
`;

const KEPT_SECTION = `
## Команды, идентификатор которых не менялся

Эти идентификаторы уже отвечали T7 — kebab-case без префикса плагина, — и
переименовывать их значило бы ломать работающий хоткей ради красоты. Р3 даёт
один разрыв, а не два. У них изменилось только **имя**, а имя к хоткею не
привязано.

| Идентификатор | Было имя | Стало имя |
|---|---|---|
| \`undo-last-settings-change\` | \`General: Undo last settings change\` | \`Undo last settings change\` |
| \`toggle-feature-<module>\` | \`General: Toggle <Module> module\` | \`Toggle <Module> module\` |

## Одна команда удалена

\`open-inline-overhaul-settings\`, она же \`General: Open settings\`, **снята
2026-09-06** вместе с вызовом \`app.setting.open()\` (T8, фаза 6 пункт 5). В
палитре команд её больше нет, и назначенный на неё хоткей ни на что не
действует — его можно снять.

Причина не в удобстве: \`app.setting\` не объявлен в типах Obsidian, это
приватное API и типовая причина замечания на community review. Настройки
плагина открываются штатным путём — **Settings → Community plugins →
inlineOverhaul**.

## Команды, которых нет в таблице: они собираются из ваших данных

**Команды полей.** У каждого Field есть пара команд — вперёд и назад по его
Values. Идентификатор собирается из **строгого имени** Field:

| Было | Стало |
|---|---|
${RULE_ROWS}

Строгое имя приводится к kebab-case: \`date_due\` даёт \`date-due-next\` и
\`date-due-previous\`. Имя команды в списке — \`<Field> next\` и
\`<Field> previous\`.

**Строки Binder.** Идентификатор собирается из имени строки по последнему
правилу таблицы выше, в kebab-case. Идентификатор строки
хранится в конфиге (\`editor.binder.rows[].commandId\`), и старая форма там
считается отсутствующей: она пересобирается из имени строки на первой же
загрузке.

**Совпадения разводятся.** Два Field, чьи строгие имена дают один kebab
(\`date_due\` и \`date-due\`), получают \`date-due-next\` и \`date-due-2-next\`.
Строка Binder, названная как команда ядра, тоже получает суффикс: затенить
навигацию своей строкой нельзя.
`;

function build() {
  const rows = [];
  for (const [was, now] of ids.RENAMED) {
    const name = ids.commandName(now);
    rows.push("| `" + was + "` | `" + now + "` | `" + name + "` |");
  }
  return HEAD + rows.join("\n") + "\n" + KEPT_SECTION;
}

const text = build();

if (process.argv.includes("--write")) {
  fs.writeFileSync(DEST, text, "utf8");
  console.log("карта записана: " + path.relative(ROOT, DEST));
  process.exit(0);
}

const current = fs.existsSync(DEST) ? fs.readFileSync(DEST, "utf8") : "";
if (current === text) {
  console.log("карта ID команд совпадает с модулем");
  process.exit(0);
}
console.error("карта ID команд разошлась с `src/features/command_ids.js`.");
console.error("перезаписать: node tools/command_ids_doc.js --write");
process.exit(1);
