"use strict";

/**
 * Панель custom block и шаг его Field по месту каретки (PRD 10.13.260).
 *
 * **Чем гоняется.** Той же дорогой, что у плагина: определение команды из
 * реестра (`buildPkmCommandDefs`), настройки рантайма (`runtimeSettingsFromConfig`),
 * `pkm_runtime_v2.runCommand` и настоящий документ CodeMirror с историей
 * (`tests/harness/panel_bench.js`). Подделаны только окно и `app` Obsidian.
 *
 * **Контроль «панель открылась»** стоит у каждого открытия (У-152): пока она
 * не открыта, строка остаётся прежней, и это читалось бы как «ничего не
 * сломано».
 *
 * Ожидания выписаны строками (У-5): что должно стоять в строке после действия.
 */

const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const configNormalize = require(path.join(root, "src/core/config_normalize.js"));
const pkmOrder = require(path.join(root, "src/core/pkm_order_config.js"));
const registry = require(path.join(root, "src/features/command_registry.js"));
const runtime = require(path.join(root, "src/pkm_runtime_v2.js"));
const bench = require(path.join(root, "tests/harness/panel_bench.js"));
const tagwheel = require(path.join(root, "src/pkm_v2/TagWheel/tagwheel.js"));

let passed = 0;
function ok(label) { passed++; console.log("  ok " + label); }

/** `Type` слева, `Due` справа, `Mood` в блоке `b1`, `Tone` в блоке `b2`. */
function config(extra) {
  const raw = configNormalize.migrateConfig({});
  raw.pkm.fields.order = {
    left: ["Type"],
    right: ["Due"],
    types: { Type: "tag", Due: "element", Mood: "tag", Tone: "tag" },
    labels: { Type: "Type", Due: "Due", Mood: "Mood", Tone: "Tone" },
    strictNames: { Type: "Type", Due: "Due", Mood: "Mood", Tone: "Tone" },
    custom: [
      { id: "b1", name: "Custom block 1", keys: ["Mood"] },
      { id: "b2", name: "Custom block 2", keys: ["Tone"] },
    ],
  };
  raw.pkm.fields.tags = { fields: [
    { id: "Type", prefix: "#", placeholder: "Type", values: [{ id: "todo", token: "todo" }] },
    { id: "Mood", prefix: "#", placeholder: "Mood", values: [{ id: "calm", token: "calm" }, { id: "busy", token: "busy" }] },
    { id: "Tone", prefix: "#", placeholder: "Tone", values: [{ id: "soft", token: "soft" }] },
  ] };
  raw.pkm.lineFormat = { separator1: "||", separator2: "||" };
  /* У элемента обязан быть знак — иначе панель Left/Right отказывает вслух. */
  raw.pkm.fields.elements = { fields: ["Due"], byField: { Due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD" } } };
  if (extra) extra(raw);
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

/** Строка, каретка и что сказали человеку — после команд и клавиш. */
async function drive(cfg, line, ch, steps) {
  const editor = bench.makeCmEditor(line);
  editor.setCursor({ line: 0, ch });
  const app = { workspace: { activeLeaf: { view: { editor } }, activeEditor: { editor } }, vault: {} };
  const said = [];
  const opened = [];
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  global.window = windowMock();
  global.Notice = function Notice(m) { said.push(String(m)); };
  try {
    for (const step of steps) {
      if (step.type) {
        const at = editor.posToOffset(editor.getCursor());
        editor.type(step.type, at);
        editor.setCursor(editor.offsetToPos(at + step.type.length));
        continue;
      }
      if (step.caret !== undefined) { editor.setCursor({ line: 0, ch: step.caret }); continue; }
      if (step.key) {
        global.window.fire("keydown", { key: step.key, code: step.key, preventDefault() {}, stopPropagation() {} });
        continue;
      }
      const def = defs(cfg).find((d) => d.id === step.run);
      assert.ok(def, "нет команды " + step.run);
      await runtime.runCommand({
        app, command: def.v2Command,
        settings: Object.assign(bench.paneSettings(cfg), def.makeSettings(cfg)),
      });
      const st = global.window.__tagWheelState;
      opened.push(st && st.active === true ? {
        block: st.custom ? st.custom.blockId : "",
        /* Только выбранное: пустые ключи у сессии заведены на каждый Field. */
        selected: Object.fromEntries(Object.entries(st.session.selected).filter(([, v]) => String(v || ""))),
        active: String(st.session.activeFieldId || ""),
        line: editor.getLine(0),
        /* Что видно на экране: записанное минус то, что прячет маска. */
        visible: (() => {
          const plan = st.panelPlan;
          if (!plan) return editor.getLine(0);
          let out = "";
          let at = 0;
          for (const [from, to] of plan.hidden) { out += plan.text.slice(at, from); at = to; }
          return out + plan.text.slice(at);
        })(),
      } : null);
    }
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
  return { line: editor.getLine(0), cursor: editor.getCursor().ch, said, opened, editor };
}

const OPEN = { run: "open-tagwheel-custom-b1" };
const OPEN2 = { run: "open-tagwheel-custom-b2" };
const UP = { key: "ArrowUp" };
const ENTER = { key: "Enter" };

async function run() {
  console.log("Панель custom block (PRD 10.13.260)");

  /* ---- чистые помощники: слово под кареткой и форма вставки ------------ */
  {
    const w = tagwheel.customWordSpan;
    assert.deepEqual(w("x aaa y", 2), { from: 2, to: 5, text: "aaa" }, "|aaa");
    assert.deepEqual(w("x aaa y", 3), { from: 2, to: 5, text: "aaa" }, "aa|a");
    assert.deepEqual(w("x aaa y", 5), { from: 2, to: 5, text: "aaa" }, "aaa|");
    assert.equal(w("x aaa  y", 6), null, "aaa | — не на значении");
    assert.deepEqual(w("a [[My note]] b", 6), { from: 2, to: 13, text: "[[My note]]" }, "ссылка с пробелом целиком");
    const p = tagwheel.customInsertPlan;
    assert.deepEqual(p("abc def", 3, 3, "#x"), { from: 3, to: 3, insert: " #x", caret: 6 });
    assert.deepEqual(p("abcdef", 3, 3, "#x"), { from: 3, to: 3, insert: " #x ", caret: 6 });
    assert.deepEqual(p("", 0, 0, "#x"), { from: 0, to: 0, insert: "#x", caret: 2 });
    assert.deepEqual(p("a #x b", 2, 4, ""), { from: 2, to: 5, insert: "", caret: 2 }, "снятое значение оставляет один пробел");
    assert.equal(p("abc", 1, 1, ""), null);
    ok("слово под кареткой: |aaa, aa|a, aaa| — да, aaa | — нет; пробелы вокруг вставки");
  }

  /* ---- вставка у каретки, текст слева и справа на месте ---------------- */
  {
    const cfg = config();
    const out = await drive(cfg, "- abc def", 5, [OPEN, UP, ENTER]);
    assert.ok(out.opened[0], "панель блока не открылась");
    assert.equal(out.opened[0].block, "b1");
    assert.ok(/abc .*==.*\*\*\[.*\]\*\*.*== def|abc \*\*\[.*\]\*\* def/.test(out.opened[0].line),
      "полоса не встала у каретки: " + out.opened[0].line);
    assert.equal(out.line, "- abc #calm def", "Enter записал не вставку у каретки");
    assert.equal(out.cursor, 11, "каретка не за вставкой");
    assert.deepEqual(out.said, [], "успешная работа что-то сказала");
    ok("панель открывается у каретки, Enter пишет `#calm` между словами, каретка за вставкой");
  }

  /* ---- второй вызов — пустой, новая копия ------------------------------ */
  {
    const cfg = config();
    const out = await drive(cfg, "abc", 3, [OPEN, UP, ENTER, { type: " x" }, OPEN, ENTER]);
    assert.deepEqual(out.opened[1] && out.opened[1].selected, {}, "второй вызов не пустой");
    const out2 = await drive(cfg, "abc", 3, [OPEN, UP, ENTER, { type: " " }, OPEN, UP, ENTER]);
    assert.equal(out2.line, "abc #calm #calm", "вторая копия не встала рядом с первой");
    ok("каждый вызов вне значения пустой, и вставка встаёт новой копией");
  }

  /* ---- панель на стоящем значении: |aaa, aa|a, aaa| — и граница -------- */
  {
    const cfg = config();
    for (const ch of [4, 6, 9]) {
      const out = await drive(cfg, "abc #calm def", ch, [OPEN, UP, ENTER]);
      assert.deepEqual(out.opened[0] && out.opened[0].selected, { Mood: "calm" },
        "каретка " + ch + " на `#calm`, а панель не показала его выбранным");
      assert.equal(out.line, "abc #busy def", "Enter не заменил значение на месте (каретка " + ch + ")");
    }
    const edge = await drive(cfg, "abc #calm def", 10, [OPEN]);
    assert.deepEqual(edge.opened[0] && edge.opened[0].selected, {}, "`#calm |` — панель не пустая");
    ok("каретка на значении — панель на нём, Enter меняет его на месте; `aaa |` — пусто");
  }

  /* ---- next/previous Field блока по месту каретки ---------------------- */
  {
    const cfg = config();
    const nextId = defs(cfg).find((d) => d.orderKey === "Mood" && d.direction === "increase").id;
    const prevId = defs(cfg).find((d) => d.orderKey === "Mood" && d.direction === "decrease").id;
    const two = await drive(cfg, "#calm x #calm", 11, [{ run: nextId }]);
    assert.equal(two.line, "#calm x #busy", "next поменял не ту копию");
    const fresh = await drive(cfg, "ab cd", 2, [{ run: nextId }]);
    assert.equal(fresh.line, "ab #calm cd", "next вне значения не поставил первое значение");
    const last = await drive(cfg, "ab cd", 2, [{ run: prevId }]);
    assert.equal(last.line, "ab #busy cd", "previous вне значения не поставил последнее значение");
    ok("next/previous на значении меняют одну копию, вне значения ставят первое и последнее");
  }

  /* ---- Tab: выключен — ничего, включён — следующий блок, по кругу ------ */
  {
    const off = await drive(config(), "abc", 3, [OPEN, UP, { key: "Tab" }, ENTER]);
    assert.equal(off.line, "abc #calm", "Tab при выключенном контроле что-то сделал");
    const cfgOn = config((raw) => { raw.visual.tagWheel.customTab = true; });
    const on = await drive(cfgOn, "abc", 3, [OPEN, UP, { key: "Tab" }, UP, ENTER]);
    assert.equal(on.line, "abc #soft", "Tab не перевёл в следующий блок или не выбросил выбранное");
    const ring = await drive(cfgOn, "abc", 3, [OPEN2, { key: "Tab" }, UP, ENTER]);
    assert.equal(ring.line, "abc #calm", "с последнего блока Tab не ушёл на первый");
    ok("Tab: выключен — ничего; включён — следующий блок, выбранное выброшено, с последнего на первый");
  }

  /* ---- блоки не видят друг друга, Left не трогает вставленное ---------- */
  {
    const cfg = config();
    const busy = await drive(cfg, "abc", 3, [OPEN, OPEN2]);
    assert.equal(busy.said.length, 1, "команда чужого блока при открытой панели не отказала вслух");
    const lr = await drive(cfg, "#todo || abc #calm", 18, [{ run: "open-tagwheel-left" }, ENTER]);
    assert.ok(lr.opened[0], "положительный контроль: панель Left не открылась: " + lr.said.join(" | "));
    assert.equal(lr.line, "#todo || abc #calm", "панель Left сдвинула значение custom block");
    ok("команда чужого блока отказывает, Enter панели Left не двигает вставленное");
  }

  /* ---- Values in the other Block: Hide прячет Left/Right, Keep оставляет -- */
  {
    const line = "#todo || abc #busy || \u{1F4C5}2026-01-01";
    const hide = await drive(config(), line, 12, [OPEN]);
    assert.ok(hide.opened[0], "панель блока не открылась");
    const seen = hide.opened[0].visible;
    assert.ok(!/#todo|2026-01-01/.test(seen), "Hide не спрятал значения Left/Right: " + seen);
    assert.ok(/abc/.test(seen) && /#busy/.test(seen), "Hide спрятал текст или значение custom block: " + seen);
    const keep = await drive(config((raw) => { raw.visual.tagWheel.oppositeBlock = "keep"; }), line, 12, [OPEN]);
    assert.ok(/#todo/.test(keep.opened[0].visible) && /2026-01-01/.test(keep.opened[0].visible),
      "Keep спрятал значения Left/Right: " + keep.opened[0].visible);
    ok("Hide прячет значения Left и Right и не прячет текст и значения custom block; Keep оставляет всё");
  }

  console.log(passed + " проверок пройдено");
}

run().catch((e) => { console.error(e); process.exit(1); });
