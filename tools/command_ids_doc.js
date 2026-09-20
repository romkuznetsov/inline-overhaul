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

/*
 * **Документ английский, потому что его читает человек снаружи** (бренд-бук,
 * `.claude/skills/repo-docs/references/voice.md`): на него ведёт `README.md` и
 * уведомление, которое плагин показывает один раз после обновления. Рабочие
 * документы остаются русскими, этот — нет.
 */
const NAME_UNDO = ids.commandDisplayName("General", ids.commandName("undo-last-settings-change"));
const NAME_TOGGLE = ids.commandDisplayName("General", "Toggle <Module> module");

const HEAD = `# Command id map: version 1 to version 2

**Generated** by \`node tools/command_ids_doc.js --write\` from
\`src/features/command_ids.js\`. Do not edit it by hand — edit the module.

Obsidian binds a hotkey to a command's **identifier**, not to its name. In \`0.2.0\`
the identifiers moved to kebab-case without the plugin prefix, so every key you had
assigned to an inlineOverhaul command stopped working after that update. Migrating the
plugin's own settings does not cover it: hotkeys live in Obsidian's settings, and the
plugin does not edit another plugin's files. So it shows a notice once and prints this
map to the developer console.

**What to do.** Open \`Settings\` → \`Hotkeys\`, search for \`inlineOverhaul\` and assign
the keys again from the table below. The full identifier in the hotkey manager reads
\`inline-overhaul:<id>\`.

## Renamed commands

Names below are written without the area in front. In the command palette and in
Obsidian's \`Hotkeys\` screen each one carries it — \`Navigation: Move line up\` — and
Obsidian puts the plugin name before that.

| Was | Now | Name |
|---|---|---|
`;

const KEPT_SECTION = `
## Commands whose identifier did not change

These identifiers were already kebab-case without the plugin prefix, and renaming them
would have broken a working hotkey for nothing, so they were left alone. What changed for
them is the **name**, and a name is not what a hotkey is bound to.

| Identifier | Name in version 1 | Name now |
|---|---|---|
| \`undo-last-settings-change\` | \`${NAME_UNDO}\` | \`${NAME_UNDO}\` |
| \`toggle-feature-<module>\` | \`${NAME_TOGGLE}\` | \`${NAME_TOGGLE}\` |

Both columns say the same thing, and that is not a mistake. Between \`0.2.0\` and
\`0.4.0\` these commands were listed without the area in front — \`Undo last settings
change\` — and since \`0.5.0\` every command carries the name of its area again, so that
Obsidian's \`Hotkeys\` search can be narrowed to one area at a time.

## One command was removed

\`open-inline-overhaul-settings\`, listed as \`General: Open settings\`, was **removed on
2026-09-06**. It is no longer in the command palette, and a hotkey assigned to it does
nothing — you can drop it.

The reason is not taste: it called an Obsidian API that is not declared in the public
types, which is a standard objection in a community review. Open the plugin's settings
the ordinary way — **Settings → Community plugins → inlineOverhaul**.

## Commands that are not in the table: they are built from your own data

**Field commands.** Every Field has a pair of commands, forward and back through its
Values. The identifier is built from the Field's strict name:

| Was | Now |
|---|---|
${RULE_ROWS}

The strict name is lowered to kebab-case: \`date_due\` gives \`date-due-next\` and
\`date-due-previous\`. In the command list they read \`Tags & PKM: <Field> next\` and
\`Tags & PKM: <Field> previous\`.

**Binder rows.** The identifier is built from the row's name by the last rule in the
table above, in kebab-case. It is stored in the plugin's settings
(\`editor.binder.rows[].commandId\`), and the old form there counts as absent: it is
rebuilt from the row name on the next load.

**Clashes are separated.** Two Fields whose strict names give the same kebab
(\`date_due\` and \`date-due\`) get \`date-due-next\` and \`date-due-2-next\`. A Binder row
named after a core command gets a suffix too: your own row cannot shadow navigation.
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
