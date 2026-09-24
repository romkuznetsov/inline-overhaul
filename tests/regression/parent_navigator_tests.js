"use strict";

/**
 * Дочерний Field у ссылки и родительское Value как навигатор (PRD 10.13.269,
 * его заказ 2026-09-24/25: «работающие дочерние fields у Link, работающий
 * навигатор у Tag и Link»).
 *
 * **Чем гоняется.** Той же дорогой, что у плагина: определения команд из
 * реестра, `pkm_runtime_v2.runCommand` и настоящий документ CodeMirror
 * (`tests/harness/panel_bench.js`); конфиг проходит `migrateConfig`. Подделаны
 * окно и `app` Obsidian. У каждого открытия панели — контроль «открылась»
 * (У-152).
 *
 * Ожидания выписаны строками (У-5). Пример — его: `Clients` типа Link, группы
 * `AK` и `IEDT`, у каждой свои клиенты; у тега — `doing` с детьми и `idea`
 * без детей (обычное Value, нюанс 6).
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

function config(opts) {
  const o = opts || {};
  const raw = configNormalize.migrateConfig({});
  raw.pkm.fields.order = {
    left: ["Type", "Clients"],
    right: [],
    types: { Type: "tag", Clients: "wikilink" },
    labels: { Type: "Type", Clients: "Clients" },
    strictNames: { Type: "Type", Clients: "Clients" },
    active: { Type: "yes", Clients: "yes", Type_sub: "yes", Clients_sub: "yes" },
    enabled: { Type: true, Clients: true, Type_sub: true, Clients_sub: true },
    subWithoutParent: { Type_sub: o.always !== false, Clients_sub: o.always !== false },
    subNavigator: { Type_sub: o.navigator !== false, Clients_sub: o.navigator !== false },
  };
  raw.pkm.fields.tags = { fields: [
    { id: "Type", prefix: "#", placeholder: "Type", values: [
      { id: "doing", token: "doing", subtags: ["review", "draft"] },
      { id: "idea", token: "idea" },
    ] },
    { id: "Type_sub", prefix: "#", dependsOn: "Type", placeholder: "sub", values: [
      { id: "review", token: "review", allowedParentValues: ["doing"] },
      { id: "draft", token: "draft", allowedParentValues: ["doing"] },
    ] },
  ] };
  raw.pkm.fields.links = { fields: [
    { id: "Clients", prefix: "#", source: "wikilinks:Clients", placeholder: "Clients", values: [
      { token: "AK", active: true, subtags: ["client1", "client2"] },
      { token: "IEDT", active: true, subtags: ["client3"] },
    ] },
    { id: "Clients_sub", prefix: "#", source: "wikilinks:Clients_sub", dependsOn: "Clients", placeholder: "sub", values: [
      { token: "client1", active: true, allowedParentValues: ["AK"] },
      { token: "client2", active: true, allowedParentValues: ["AK"] },
      { token: "client3", active: true, allowedParentValues: ["IEDT"] },
    ] },
  ] };
  raw.pkm.lineFormat = { separator1: "||", separator2: "||" };
  return configNormalize.migrateConfig(raw);
}

function defs(cfg) {
  return registry.buildPkmCommandDefs(pkmOrder.serializePkmOrderForMacro,
    pkmOrder.serializeDateRuntimeConfigForMacro, pkmOrder.normalizePkmOrder, cfg, []);
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

/** Строка и сказанное — после команд и клавиш; у каждого открытия его выбор. */
async function drive(cfg, line, steps) {
  const editor = bench.makeCmEditor(line);
  editor.setCursor({ line: 0, ch: line.length });
  const app = { workspace: { activeLeaf: { view: { editor } }, activeEditor: { editor } }, vault: {} };
  const said = [];
  const opened = [];
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  global.window = windowMock();
  global.Notice = function Notice(m) { said.push(String(m)); };
  try {
    for (const step of steps) {
      if (step.key) {
        global.window.fire("keydown", { key: step.key, code: step.key, preventDefault() {}, stopPropagation() {} });
        continue;
      }
      const def = defs(cfg).find((d) => d.id === step.run);
      assert.ok(def, "нет команды " + step.run + "; есть: " + defs(cfg).map((d) => d.id).join(", "));
      await runtime.runCommand({
        app, command: def.v2Command,
        settings: Object.assign(bench.paneSettings(cfg), def.makeSettings(cfg)),
      });
      const st = global.window.__tagWheelState;
      opened.push(st && st.active === true
        ? Object.fromEntries(Object.entries(st.session.selected).filter(([, v]) => String(v || "")))
        : null);
    }
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
  return { line: editor.getLine(0), said, opened };
}

const OPEN = { run: "open-tagwheel-left" };
const UP = { key: "ArrowUp" };
const DOWN = { key: "ArrowDown" };
const RIGHT = { key: "ArrowRight" };
const ENTER = { key: "Enter" };

async function run() {
  console.log("Дочерний Field у ссылки и навигатор (PRD 10.13.269)");
  const cfg = config();

  /* ---- панель: навигатор не пишется, обычное Value пишется ------------- */
  {
    const r = await drive(cfg, "- text", [OPEN, UP, RIGHT, UP, ENTER]);
    assert.ok(r.opened[0], "панель открылась");
    assert.equal(r.line, "- #review || text", "навигатор тега на строку не попал: " + r.line);
    ok("тег: выбранный навигатор не пишется, пишется только ребёнок");
  }
  {
    const r = await drive(cfg, "- text", [OPEN, UP, UP, ENTER]);
    assert.ok(r.opened[0], "панель открылась");
    assert.equal(r.line, "- #idea || text", "Value без детей — обычное: " + r.line);
    ok("тег: Value без детей навигатором не считается и пишется");
  }

  /* ---- панель: навигатор сужает детей ссылки --------------------------- */
  {
    /* Clients: последний навигатор IEDT; у него один ребёнок — client3. Без
       сужения первым вверх был бы client1. */
    const r = await drive(cfg, "- text", [OPEN, RIGHT, RIGHT, DOWN, RIGHT, UP, ENTER]);
    assert.ok(r.opened[0], "панель открылась");
    assert.equal(r.line, "- [[client3]] || text", "дочерний Field ссылки сузился навигатором: " + r.line);
    ok("ссылка: навигатор сужает список детей, на строке только ребёнок");
  }

  /* ---- панель: навигатор ставится по ребёнку ---------------------------- */
  {
    const r = await drive(cfg, "- [[client3]] || text", [OPEN]);
    assert.ok(r.opened[0], "панель открылась");
    assert.equal(r.opened[0].Clients_sub, "client3", "ребёнок узнан на строке");
    assert.equal(r.opened[0].Clients, "IEDT", "навигатор выведен из ребёнка: " + JSON.stringify(r.opened[0]));
    ok("ссылка: панель на строке с ребёнком встаёт на его навигатор");
  }

  /* ---- панель: написанный раньше родитель остаётся (правило 107) -------- */
  {
    const r = await drive(cfg, "- [[AK]] [[client1]] || text", [OPEN, RIGHT, RIGHT, RIGHT, UP, ENTER]);
    assert.ok(r.opened[0], "панель открылась");
    assert.equal(r.line, "- [[AK]] [[client2]] || text", "родитель со старой строки не снят: " + r.line);
    ok("ссылка: родитель, стоявший на строке, навигатор не снимает");
  }

  /* ---- команды: дочерний Field листает всех детей (`В-220`) ------------- */
  {
    const seen = [];
    let line = "- text";
    for (let i = 0; i < 4; i++) {
      line = (await drive(cfg, line, [{ run: "clients-sub-next" }])).line;
      seen.push(line);
    }
    assert.deepEqual(seen, [
      "- [[client1]] || text",
      "- [[client2]] || text",
      "- [[client3]] || text",
      "- text",
    ], "круг команды дочернего Field ссылки");
    ok("ссылка: команда дочернего Field листает всех детей подряд и не пишет родителя");
  }

  /* ---- команды: родитель пропускает навигаторы ------------------------- */
  {
    const r = await drive(cfg, "- text", [{ run: "type-next" }]);
    assert.equal(r.line, "- #idea || text", "команда родителя пропустила навигатор doing: " + r.line);
    const all = await drive(cfg, "- text", [{ run: "clients-next" }]);
    assert.equal(all.line, "- text", "листать нечего — строка прежняя");
    assert.ok(all.said.some((m) => /navigator/.test(m)), "отказ сказан вслух: " + JSON.stringify(all.said));
    ok("команда родителя пропускает навигаторы, а если листать нечего — говорит об этом");
  }

  /* ---- `After parent`: команды без родителя работают -------------------- */
  {
    const after = config({ always: false });
    const r = await drive(after, "- text", [{ run: "type-sub-next" }]);
    assert.equal(r.line, "- #review || text", "при навигаторе родитель на строке командам не нужен: "
      + r.line + " " + JSON.stringify(r.said));
    /* Отрицательный контроль: без навигатора то же положение ждёт родителя. */
    const plain = await drive(config({ always: false, navigator: false }), "- text", [{ run: "type-sub-next" }]);
    assert.equal(plain.line, "- text", "без навигатора `After parent` ждёт родителя");
    ok("`After parent` с навигатором: команда дочернего Field не ждёт родителя");
  }

  /* ---- без навигатора родитель пишется, как прежде ---------------------- */
  {
    const r = await drive(config({ navigator: false }), "- text", [OPEN, UP, RIGHT, UP, ENTER]);
    assert.ok(r.opened[0], "панель открылась");
    assert.equal(r.line, "- #doing #review || text", "без навигатора родитель пишется: " + r.line);
    ok("без навигатора родитель и ребёнок пишутся оба");
  }

  console.log("\n" + passed + " проверок пройдено");
}

run().catch((e) => { console.error(e); process.exit(1); });
