/**
 * Дымовой прогон панели на настоящем конфиге.
 *
 * Зачем отдельно от гейта Г16. Г16 рисует блоки на выдуманном конфиге, и после
 * фазы 2 этот конфиг оказался формой версии 1: блоки читают `pkm.fields.*` и
 * `visual.tags.*`, а в заглушке лежало `pkm.behavior.*`. Блоки рисовались
 * пустыми, проверка «нарисовал хоть что-то» проходила, и половина панели —
 * редактор Fields с настоящими Fields, таблица Values, предупреждение о
 * контрасте, предпросмотры — дымом не проверялась вовсе.
 *
 * Здесь конфиг настоящий: он проезжает через `migrateConfig` из `main.js`, а не
 * собирается руками. Дальше строятся определения всех семи вкладок, рисуется
 * каждый свой блок, открывается каждая подсказка, и всё это снимается.
 *
 * Запуск:
 *   node tools/panel_dry_run.mjs                       — на замороженной фикстуре
 *   node tools/panel_dry_run.mjs <путь к data.json>     — на своём конфиге
 *
 * Своего конфига в отчёте нет: печатаются числа и имена блоков, но не значения.
 * Файл заказчика содержит его собственные Fields и теги, и в вывод они не идут.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const given = process.argv[2];
const fallback = path.join(root, "tests", "fixtures", "config_v1_full.json");
const source = given ? path.resolve(given) : fallback;

if (!fs.existsSync(source)) {
  console.error("нет файла: " + source);
  process.exit(2);
}

const { setupGlobals, Setting, Modal, Notice } = await import("../tests/harness/obsidian_stub.ts");
setupGlobals();

const { makeNode } = await import("../tests/harness/dom_stub.ts");
const { loadPluginInternals } = await import("../tests/harness/plugin_internals.ts");
const { MemoryStore } = await import("../src/ui/settings/store.ts");
const { SettingsPane } = await import("../src/ui/settings/settings_tab.ts");
const { SCHEMA, TABS } = await import("../src/ui/settings/schema/index.ts");

const internals = loadPluginInternals();

/* Конфиг проезжает настоящую миграцию: так же, как при загрузке плагина. */
const raw = JSON.parse(fs.readFileSync(source, "utf8"));
const cfg = internals.migrateConfig(raw);

/* ---- сколько в конфиге того, что панель обязана показать --------------- */

const fields = cfg?.pkm?.fields?.order || {};
const own = [...(fields.left || []), ...(fields.right || [])].filter(id => id && !/_sub$/.test(String(id)));
const values = ["tags", "links", "elements"].reduce((sum, kind) => {
  const map = cfg?.pkm?.fields?.[kind] || {};
  return sum + Object.keys(map).reduce((n, key) => {
    const list = map[key];
    return n + (Array.isArray(list) ? list.length : (list && typeof list === "object" ? Object.keys(list).length : 0));
  }, 0);
}, 0);
const binderRows = Array.isArray(cfg?.editor?.binder?.rows) ? cfg.editor.binder.rows.length : 0;
const userTags = Object.keys(cfg?.visual?.tags?.userTags || {}).length;

console.log("конфиг: " + path.basename(source));
console.log("  версия схемы: " + cfg.schemaVersion);
console.log("  Fields: " + own.length + ", Values: " + values
  + ", строк Binder: " + binderRows + ", своих цветов тегов: " + userTags);
if (!own.length) {
  console.log("  ВНИМАНИЕ: Fields нет — редактор Fields нарисуется пустым, и прогон почти ничего не проверит");
}

/* ---- плагин в том виде, в каком его ждут перенесённые блоки ------------ */

const plugin = {
  app: { workspace: {}, vault: {}, metadataTypeManager: undefined },
  manifest: { id: "inline-overhaul", version: "dry-run", dir: ".obsidian/plugins/inline-overhaul" },
  getConfig: () => cfg,
  setConfigPatch: () => {},
  listOwnCommands: () => internals.buildOwnCommandList(plugin),
};

const platform = {
  Setting,
  Notice,
  Modal,
  setIcon: () => {},
  plugin,
  getConfig: () => cfg,
  normalizePkmOrder: internals.normalizePkmOrder,
  pkmOrderFields: [],
};

/* ---- прогон ------------------------------------------------------------ */

let blocks = 0;
let tips = 0;
let cleanups = 0;
const problems = [];

/**
 * Текст ошибки в отчёт: только первая строка и не длиннее двухсот знаков.
 * Сообщение может нести значение из конфига, а конфиг здесь чужой.
 */
function shortError(e) {
  const message = e && e.message ? String(e.message) : String(e);
  return message.split("\n")[0].slice(0, 200);
}

for (const showTips of [true, false]) {
  /* Хранилище на настоящем конфиге: определения читают значения через него. */
  const store = new MemoryStore(JSON.parse(JSON.stringify(cfg)));
  await store.set("general.help.showTips", showTips);

  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store,
    actions: {},
    fragments: { createFragment: () => makeNode("fragment") },
    platform,
  });

  for (const tab of TABS) {
    pane.setActiveTab(tab.id);
    let defs;
    try {
      defs = pane.getSettingDefinitions();
    } catch (e) {
      problems.push("вкладка " + tab.id + " (подсказки " + showTips + "): определения не собрались — " + shortError(e));
      continue;
    }

    const rows = [];
    for (const def of defs) {
      if (Array.isArray(def.items)) rows.push(...def.items);
      else rows.push(def);
    }

    for (const row of rows) {
      if (typeof row.render !== "function") continue;
      const host = makeNode("div");
      const setting = new Setting(host);
      const name = String(row.name || row.id || "без имени");
      try {
        const cleanup = row.render(setting, {});
        blocks++;
        if (!setting.settingEl.children.length) {
          problems.push("блок «" + name + "» на вкладке " + tab.id + " ничего не нарисовал");
        }
        for (const mark of setting.settingEl.querySelectorAll(".io-help")) {
          mark.click();
          tips++;
          mark.click();
        }
        /* Очистку возвращает свой блок — он подписан на хранилище. Строка с
           кнопками рисуется тем же `render`, но подписки у неё нет; отличает
           их класс `io-block`, который ставит `SettingsPane.renderCustom`. */
        const ownBlock = setting.settingEl.classList.contains("io-block");
        if (typeof cleanup === "function") { cleanup(); cleanups++; }
        else if (ownBlock) problems.push("блок «" + name + "» на вкладке " + tab.id + " не вернул функцию очистки");
      } catch (e) {
        problems.push("блок «" + name + "» на вкладке " + tab.id + " упал: " + shortError(e));
      }
    }
  }
}

console.log("\nотрисовано своих блоков: " + blocks
  + ", открыто подсказок: " + tips + ", снято: " + cleanups);

if (!blocks) {
  console.log("\nни одного блока не нарисовано — прогон ничего не проверил");
  process.exit(1);
}

if (problems.length) {
  console.log("\nнашлось " + problems.length + ":");
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}

console.log("\nпанель собралась и нарисовалась на этом конфиге без единой ошибки");
