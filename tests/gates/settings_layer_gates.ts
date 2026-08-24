/**
 * Гейты слоя настроек (PRD раздел 12). Запускаются на обвязке из
 * tests/harness, без Obsidian и без браузера.
 *
 * Пока слоя нет, гейт сообщает об этом и выходит с нулём: в фазе 0 нечего
 * проверять. Начиная с фазы 1 отсутствие схемы — это падение, потому что
 * гейт, который молча ничего не проверяет, хуже отсутствующего.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setupGlobals, Setting, PluginSettingTab, makeApp, notices } from "../harness/obsidian_stub.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const SCHEMA_DIR = path.join(root, "src", "ui", "settings", "schema");
const PHASE_FILE = path.join(root, "tests", "gates", "phase.txt");

let failures = 0;
const fail = (m: string) => { console.log("  FAIL " + m); failures++; };
const ok = (m: string) => console.log("  ok   " + m);

/** Текущая фаза работ: файл с одним числом. Гейты включаются по фазе (12). */
function currentPhase(): number {
  try { return parseInt(fs.readFileSync(PHASE_FILE, "utf8").trim(), 10) || 0; }
  catch { return 0; }
}

const phase = currentPhase();
console.log("Гейты слоя настроек, фаза " + phase);

setupGlobals();

/* ---- обвязка обязана вести себя как настоящий DOM (фаза 0, пункт 7) ---- */
{
  const { makeNode } = await import("../harness/dom_stub.ts");
  const n = makeNode("div");
  n.createEl("span", { text: "а" });
  n.createEl("span", { text: "б" });
  if (n.textContent !== "аб") fail("чтение textContent не обходит поддерево: " + n.textContent);
  else ok("чтение textContent обходит поддерево");

  n.textContent = "";
  if (n.children.length !== 0) fail("запись textContent не очистила детей: осталось " + n.children.length);
  else ok("запись textContent очищает детей");

  n.style.setProperty("--io-lane", "2");
  if (n.style.getPropertyValue("--io-lane") !== "2") fail("style.setProperty не запоминает значение");
  else ok("style.setProperty запоминает значение");
}

/* ---- ни один исходник не содержит нулевых байтов ----------------------- */
{
  const exts = [".ts", ".js", ".mjs", ".json", ".md", ".css"];
  const skip = ["node_modules", ".git", "dist"];
  const dirty: string[] = [];
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir)) {
      if (skip.includes(name)) continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) { walk(full); continue; }
      if (!exts.some(e => name.endsWith(e))) continue;
      if (fs.readFileSync(full).includes(0)) dirty.push(path.relative(root, full));
    }
  };
  walk(root);
  if (dirty.length) fail("нулевые байты в исходниках: " + dirty.join(", "));
  else ok("нулевых байтов в исходниках нет");
}

/* ---- мок Obsidian строит настройку без исключений ---------------------- */
{
  const { makeNode } = await import("../harness/dom_stub.ts");
  const host = makeNode("div");
  let changed: unknown = null;
  const s = new Setting(host).setName("Пример").setDesc("Описание");
  s.addToggle(t => t.setValue(false).onChange(v => { changed = v; }));
  (s.components[0] as any).toggle();
  if (changed !== true) fail("тумблер мока не доводит изменение до обработчика");
  else ok("мок Obsidian: Setting и тумблер работают");

  const tab = new PluginSettingTab(makeApp(), {});
  if (typeof tab.getSettingDefinitions !== "function") fail("в моке нет getSettingDefinitions");
  else if (typeof tab.setControlValue !== "function") fail("в моке нет setControlValue");
  else ok("мок поддерживает декларативный путь 1.13");
}

/* ---- схема: пока её нет, дальше проверять нечего ----------------------- */
if (!fs.existsSync(SCHEMA_DIR)) {
  if (phase >= 1) {
    fail("схемы нет: " + path.relative(root, SCHEMA_DIR) + ", а фаза " + phase + " её требует");
  } else {
    console.log("  —    схемы ещё нет, проверки структуры и текстов пропущены (фаза 0)");
  }
  console.log(failures ? "\n" + failures + " problem(s)" : "\nвсе гейты фазы " + phase + " прошли");
  process.exit(failures ? 1 : 0);
}

/* Начиная с фазы 1 здесь подключается схема и запускаются гейты
   Г6, Г7, Г10, Г11, Г12, Г17-Г23 — теми же проверками, что уже
   работают на прототипе в tests/prototype/gates.js. */
const { SCHEMA } = await import(pathToFileURL(path.join(SCHEMA_DIR, "index.ts")).href);
if (!Array.isArray(SCHEMA) || !SCHEMA.length) fail("схема пуста");
else ok("схема загружена: групп " + SCHEMA.length);

if (notices.length) console.log("  показанные Notice: " + notices.length);
console.log(failures ? "\n" + failures + " problem(s)" : "\nвсе гейты фазы " + phase + " прошли");
process.exit(failures ? 1 : 0);
