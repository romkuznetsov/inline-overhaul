"use strict";

/**
 * Дочерний Field в `After parent` не открывается у родителя, чьи дочерние
 * Values все спрятаны глазом (его пункт «Новое» 2026-10-15: «Sub field должен
 * появляться… только для выбранных values, в которых есть видимые sub values»).
 *
 * Гоняется дорогой плагина: команда из реестра, `pkm_runtime_v2.runCommand`,
 * настоящий документ CodeMirror (`tests/harness/panel_bench.js`), конфиг через
 * `migrateConfig`. Ожидания выписаны строками (У-5).
 */

const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const configNormalize = require(path.join(root, "src/core/config_normalize.js"));
const pkmOrder = require(path.join(root, "src/core/pkm_order_config.js"));
const registry = require(path.join(root, "src/features/command_registry.js"));
const runtime = require(path.join(root, "src/pkm_runtime_v2.js"));
const bench = require(path.join(root, "tests/harness/panel_bench.js"));

let passed = 0;
function ok(label) { passed++; console.log("  ok " + label); }

/** `doing` — дети спрятаны, `plan` — ребёнок виден; за ними `Stage`. */
function config() {
  const raw = configNormalize.migrateConfig({});
  raw.pkm.fields.order = {
    left: ["Type", "Stage"],
    right: [],
    types: { Type: "tag", Stage: "tag" },
    labels: { Type: "Type", Stage: "Stage" },
    strictNames: { Type: "Type", Stage: "Stage" },
    active: { Type: "yes", Type_sub: "yes", Stage: "yes" },
    enabled: { Type: true, Type_sub: true, Stage: true },
  };
  raw.pkm.fields.tags = { fields: [
    { id: "Type", prefix: "#", placeholder: "Type", values: [
      { id: "doing", token: "doing", subtags: ["review"] },
      { id: "plan", token: "plan", subtags: ["draft"] },
    ] },
    { id: "Type_sub", prefix: "#", dependsOn: "Type", placeholder: "sub", values: [
      { id: "review", token: "review", allowedParentValues: ["doing"], hidden: true },
      { id: "draft", token: "draft", allowedParentValues: ["plan"] },
    ] },
    { id: "Stage", prefix: "#", placeholder: "Stage", values: [{ id: "early", token: "early" }] },
  ] };
  raw.pkm.lineFormat = { separator1: "||", separator2: "||" };
  return configNormalize.migrateConfig(raw);
}

function windowMock() {
  const listeners = {};
  return {
    __tagWheelState: { active: false },
    addEventListener(t, h) { (listeners[t] = listeners[t] || []).push(h); },
    removeEventListener(t, h) { listeners[t] = (listeners[t] || []).filter((x) => x !== h); },
    fire(t, e) { (listeners[t] || []).slice().forEach((h) => h(e)); },
  };
}

async function drive(cfg, line, keys) {
  const defs = registry.buildPkmCommandDefs(pkmOrder.serializePkmOrderForMacro,
    pkmOrder.serializeDateRuntimeConfigForMacro, pkmOrder.normalizePkmOrder, cfg, []);
  const def = defs.find((d) => d.id === "open-tagwheel-left");
  assert.ok(def, "нет команды open-tagwheel-left");
  const editor = bench.makeCmEditor(line);
  editor.setCursor({ line: 0, ch: line.length });
  const app = { workspace: { activeLeaf: { view: { editor } }, activeEditor: { editor } }, vault: {} };
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  global.window = windowMock();
  global.Notice = function Notice() {};
  let opened = false;
  try {
    await runtime.runCommand({ app, command: def.v2Command,
      settings: Object.assign(bench.paneSettings(cfg), def.makeSettings(cfg)) });
    opened = global.window.__tagWheelState.active === true;
    for (const key of keys) {
      global.window.fire("keydown", { key, code: key, preventDefault() {}, stopPropagation() {} });
    }
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
  return { opened, line: editor.getLine(0) };
}

async function run() {
  console.log("Спрятанные дочерние Values не открывают дочерний Field");
  const cfg = config();
  {
    /* `doing` → вправо: дочернего поля нет, курсор на `Stage`. */
    const r = await drive(cfg, "- text", ["ArrowUp", "ArrowRight", "ArrowUp", "Enter"]);
    assert.ok(r.opened, "панель открылась");
    assert.equal(r.line, "- #doing #early || text", "дочерний Field без видимых детей пропущен: " + r.line);
    ok("родитель со спрятанными детьми: дочерний Field не выводится");
  }
  {
    /* Контроль: у `plan` ребёнок виден — вправо ведёт в дочерний Field. */
    const r = await drive(cfg, "- text", ["ArrowUp", "ArrowUp", "ArrowRight", "ArrowUp", "Enter"]);
    assert.ok(r.opened, "панель открылась");
    assert.equal(r.line, "- #plan #draft || text", "у видимого ребёнка дочерний Field есть: " + r.line);
    ok("родитель с видимым ребёнком: дочерний Field выводится");
  }
  console.log("\n" + passed + " проверок пройдено");
}

run().catch((e) => { console.error(e); process.exit(1); });
