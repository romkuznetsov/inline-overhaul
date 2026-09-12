"use strict";

/**
 * Стенд отмены: `Ctrl+Z` на настоящей истории CodeMirror.
 *
 * **Зачем отдельно от `line_bench.js`.** Тот спрашивает, какую строку плагин
 * напишет. Здесь вопрос другой: что останется от **истории отмен** человека
 * после того, как плагин по этой строке поработал. Замечание заказчика
 * 2026-09-12: «в процессе тестирования нажимал ctrl+z — за несколько нажатий в
 * строке получил `1231 :: 👤111 🤣… || 1231 :: …`».
 *
 * Подделки здесь нет: история — `@codemirror/commands`, та же реализация, что
 * лежит в сборке Obsidian; команды и панель — настоящие, на настоящем
 * `data.json` заказчика. Редактор поверх документа CodeMirror даёт плагину тот
 * же набор вызовов, что даёт Obsidian: `getLine`, `setLine`, `replaceRange` и
 * `cm` для записи мимо истории.
 *
 * **Мера — не «строка выглядит целой», а равенство эталону.** Те же нажатия
 * человека без плагина дают ряд документов; после работы плагина ряд обязан
 * быть тем же. Иначе `Ctrl+Z` возвращает состояние, которого никогда не было, —
 * ровно то, что заказчик и прислал.
 *
 * Запуск (из `repo/`):
 *   node tools/undo_bench.js                       — набор по умолчанию
 *   node tools/undo_bench.js test3-next panel-left — свой порядок шагов
 *
 * Шаги: идентификатор команды (`node tools/line_bench.js list`) либо
 * `panel-left` / `panel-right` — открыть панель, крутнуть значение, применить.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const bench = require(path.join(ROOT, "tools", "line_bench.js"));
const runtime = require(path.join(ROOT, "pkm_runtime_v2.js"));
const optionKeys = require(path.join(ROOT, "src", "core", "pkm_option_keys.js"));
const shared = require(path.join(ROOT, "src", "core", "shared_utils.js"));
const orderCfg = require(path.join(ROOT, "src", "core", "pkm_order_config.js"));
const normalize = require(path.join(ROOT, "src", "core", "config_normalize.js"));
const cmState = require("@codemirror/state");
const cmCommands = require("@codemirror/commands");

const K = optionKeys.KEYS;
const readCfgPath = shared.readCfgPath;

/*
 * Ключи, которые досыпает `runPkmRuntime`. Копия того, что делает
 * `line_bench.js`: там функция внутренняя, и выносить её ради одного стенда
 * значило бы трогать инструмент, который уже работает.
 */
function paneSettings(cfg) {
  const generated = String(readCfgPath(cfg, "advanced.generatedRulesPath") || "").trim();
  return {
    [K.RULES_PATH]: generated || String(normalize.DEFAULT_CONFIG.pkm.generatedRulesPath),
    [K.CYCLE_END_BEHAVIOR]: readCfgPath(cfg, "pkm.behavior.cycleEndBehavior") || "keep-bullet",
    [K.SUBTAG_FORMAT]: readCfgPath(cfg, "pkm.behavior.childTagFormat") || "separate",
    [K.CURSOR_POLICY]: readCfgPath(cfg, "pkm.behavior.cursorPolicy") || "text_end",
    [K.ORDER_CONFIG]: orderCfg.serializePkmOrderForMacro(cfg),
    [K.DATE_RUNTIME_CONFIG]: orderCfg.serializeDateRuntimeConfigForMacro(cfg),
    [K.TAGWHEEL_SCROLLER_ENABLED]: readCfgPath(cfg, "visual.tagWheel.scroller.enabled") === true,
    [K.TAGWHEEL_SCROLLER_DIRECTION]: readCfgPath(cfg, "visual.tagWheel.scroller.direction") || "full",
    [K.TAGWHEEL_SCROLLER_SIZE]: readCfgPath(cfg, "visual.tagWheel.scroller.size") || 3,
    [K.TAGWHEEL_SCROLLER_FILL]: readCfgPath(cfg, "visual.tagWheel.scroller.fillColor") || "",
    [K.TAGWHEEL_SCROLLER_TEXT]: readCfgPath(cfg, "visual.tagWheel.scroller.textColor") || "",
    [K.TAGWHEEL_EDGE_MODE]: readCfgPath(cfg, "visual.tagWheel.edgeMode") || "stay",
    [K.TAGWHEEL_ACTIVE_FIELD_MODE]: readCfgPath(cfg, "visual.tagWheel.activeField.mode") || "first",
    [K.TAGWHEEL_ACTIVE_FIELD_LEFT]: readCfgPath(cfg, "visual.tagWheel.activeField.left") || "",
    [K.TAGWHEEL_ACTIVE_FIELD_RIGHT]: readCfgPath(cfg, "visual.tagWheel.activeField.right") || "",
  };
}

/**
 * Редактор поверх настоящего документа CodeMirror с историей.
 *
 * Часы двигаются на шаг перед каждым действием: CodeMirror склеивает соседние
 * по времени изменения в одну ступень, и без этого набор человека и запись
 * плагина оказались бы одной ступенью (У-104).
 */
function makeCmEditor(initial) {
  const view = {
    state: cmState.EditorState.create({
      doc: String(initial || ""),
      extensions: [cmCommands.history()],
    }),
  };
  view.dispatch = function (spec) { view.state = view.state.update(spec).state; };
  let clock = 1000;
  let cur = { line: 0, ch: 0 };
  const lineAt = (n) => view.state.doc.line(Number(n || 0) + 1);
  return {
    cm: view,
    doc() { return view.state.doc.toString(); },
    getCursor() { return { line: cur.line, ch: cur.ch }; },
    setCursor(next) { cur = { line: Number((next && next.line) || 0), ch: Number((next && next.ch) || 0) }; },
    getLine(n) { return lineAt(n === undefined ? cur.line : n).text; },
    lastLine() { return view.state.doc.lines - 1; },
    lineCount() { return view.state.doc.lines; },
    setLine(n, v) {
      const line = lineAt(n);
      clock += 1000;
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: String(v == null ? "" : v) },
        userEvent: "input", annotations: cmState.Transaction.time.of(clock),
      });
    },
    replaceRange(v, from, to) {
      const line = lineAt(from && from.line !== undefined ? from.line : cur.line);
      const a = line.from + Math.max(0, Math.min(line.length, Number((from && from.ch) || 0)));
      const b = to && to.ch !== undefined
        ? line.from + Math.max(0, Math.min(line.length, Number(to.ch)))
        : a;
      clock += 1000;
      view.dispatch({
        changes: { from: a, to: Math.max(a, b), insert: String(v == null ? "" : v) },
        userEvent: "input", annotations: cmState.Transaction.time.of(clock),
      });
    },
    /** Нажатия человека: настоящая вставка, своей ступенью. */
    type(text, at) {
      clock += 1000;
      view.dispatch({
        changes: { from: at, insert: String(text) },
        userEvent: "input.type", annotations: cmState.Transaction.time.of(clock),
      });
    },
    undo() {
      return cmCommands.undo({ state: view.state, dispatch: (tr) => { view.state = tr.state; } });
    },
  };
}

function makeWindowMock() {
  const listeners = {};
  return {
    __tagWheelState: { active: false },
    addEventListener(t, h) { (listeners[t] = listeners[t] || []).push(h); },
    removeEventListener(t, h) { listeners[t] = (listeners[t] || []).filter((x) => x !== h); },
    fire(t, e) { (listeners[t] || []).slice().forEach((h) => h(e)); },
  };
}

function makeApp(editor) {
  const toAbs = (p) => path.resolve(bench.VAULT, String(p || ""));
  return {
    workspace: { activeLeaf: { view: { editor } }, activeEditor: { editor } },
    vault: {
      getAbstractFileByPath(p) { return fs.existsSync(toAbs(p)) ? { path: p } : null; },
      async read(f) { return fs.promises.readFile(toAbs(f && f.path ? f.path : f), "utf8"); },
      adapter: { async read(p) { return fs.promises.readFile(toAbs(p), "utf8"); } },
    },
  };
}

/** Прогон: напечатать слово, выполнить шаги, нажать Ctrl+Z до упора. */
async function runSteps(cfg, steps, word, withPlugin) {
  const editor = makeCmEditor("");
  const pane = paneSettings(cfg);
  const defs = bench.defsFor(cfg);
  const defById = (id) => defs.filter((d) => d.id === id)[0];
  const seen = [];
  const note = () => seen.push(editor.doc());

  const prevWindow = global.window;
  const prevNotice = global.Notice;
  global.window = makeWindowMock();
  global.Notice = function Notice() {};
  const app = makeApp(editor);
  try {
    note();
    editor.type(word, 0);
    editor.setCursor({ line: 0, ch: word.length });
    note();
    if (withPlugin) {
      for (const step of steps) {
        if (step === "panel-left" || step === "panel-right") {
          const side = step === "panel-right" ? "right" : "left";
          const def = defById(side === "right" ? "open-tagwheel-right" : "open-tagwheel-left");
          const settings = Object.assign({}, pane, def.makeSettings(cfg));
          await runtime.runCommand({ app, command: "tagWheel", settings });
          global.window.fire("keydown", {
            key: "ArrowUp", code: "ArrowUp",
            preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {},
          });
          await runtime.runCommand({ app, command: "tagWheel", settings });
          note();
          continue;
        }
        const def = defById(step);
        if (!def) throw new Error("нет команды " + JSON.stringify(step));
        await runtime.runCommand({
          app, command: def.v2Command,
          settings: Object.assign({}, pane, def.makeSettings(cfg)),
        });
        note();
      }
    }
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }

  const undone = [];
  for (let i = 0; i < 8; i++) {
    const ok = editor.undo();
    undone.push(editor.doc());
    if (!ok) break;
  }
  return { seen, undone };
}

async function main() {
  const cfg = bench.loadCfg();
  const steps = process.argv.slice(2);
  const plan = steps.length ? steps : ["test3-next", "random-next", "panel-left"];
  const word = "1231";

  const withPlugin = await runSteps(cfg, plan, word, true);

  console.log("шаги: " + plan.join(" → "));
  console.log("что было на строке:");
  withPlugin.seen.forEach((d, i) => console.log("  " + i + " " + JSON.stringify(d)));

  /*
   * Мера: каждое состояние после Ctrl+Z обязано быть тем, которое на строке
   * когда-то стояло. Состояние, которого не было, и есть дефект — «плагин
   * вернул то, чего человек не набирал».
   */
  const past = new Set(withPlugin.seen);
  let bad = 0;
  console.log("Ctrl+Z:");
  withPlugin.undone.forEach((d, i) => {
    const known = past.has(d);
    if (!known) bad++;
    console.log("  " + (i + 1) + " " + (known ? "ok       " : "НЕ БЫЛО  ") + JSON.stringify(d));
  });

  console.log("");
  console.log("состояний, которых на строке никогда не было: " + bad);
  if (bad) process.exitCode = 1;
}

module.exports = { makeCmEditor, runSteps, paneSettings };

if (require.main === module) {
  main().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
