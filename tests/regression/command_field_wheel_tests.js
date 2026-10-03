"use strict";
/**
 * Command Field в tagWheel (постановка `test-vault/command-field.md`, 4.5; его
 * `💬` к тесту 1 цикла 125: «в tagwheel не появились field=command»).
 *
 * Колесо настоящее: команда из реестра, `pkm_runtime_v2`, CodeMirror с
 * историей (`tests/harness/panel_bench.js`); конфиг — через `migrateConfig`.
 * Подделаны окно и `Notice`, как в `parent_navigator_tests.js`.
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
const ok = (what) => { passed++; console.log("  ok " + what); };

function config(o = {}) {
  /* Версия 2: ветки `commands` в файле версии 1 не бывает, и переезд её не несёт. */
  return configNormalize.migrateConfig({
    schemaVersion: 2,
    pkm: { fields: {
      order: {
        left: o.left ? ["Type", "Fmt"] : ["Type"], right: o.left ? [] : ["Fmt"],
        labels: { Type: "Type", Fmt: "Fmt" }, strictNames: { Type: "Type", Fmt: "Fmt" },
        types: { Type: "tag", Fmt: "command" }, active: { Type: "yes", Fmt: o.active || "yes" },
      },
      tags: { fields: [{ id: "Type", prefix: "#", values: [{ token: "todo" }, { token: "done" }] }] },
      commands: { byField: { Fmt: { categories: [
        { id: "callouts", key: "callouts", presets: [{ name: "Note", type: "note", fold: "" }].concat(o.clone ? [{ name: "Note (copy)", type: "note", fold: "" }] : [],
          [{ name: "Tip", type: "tip", fold: "", hidden: !!o.hideTip }, { name: "Warning", type: "warning", fold: "" }]) },
        { id: "cleanup", key: "cleanup", presets: [{ name: "", keep: [] }] },
      ] } } },
    } },
  });
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

/** Документ после команд и клавиш; `cells` — что видно в ячейках колеса после открытия. */
async function drive(cfg, doc, steps, at = { line: 0, ch: 3 }) {
  const editor = bench.makeCmEditor(doc);
  editor.setCursor(at);
  const app = { workspace: { activeLeaf: { view: { editor } }, activeEditor: { editor } }, vault: {} };
  const said = [];
  const seen = [];
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  global.window = windowMock();
  global.Notice = function Notice(m) { said.push(String(m)); };
  try {
    for (const step of steps) {
      if (step.key) {
        global.window.fire("keydown", { key: step.key, code: step.key, preventDefault() {}, stopPropagation() {} });
        const st = global.window.__tagWheelState;
        seen.push(st && st.active ? editor.getLine(at.line) : null);
        continue;
      }
      if (step.undo) { editor.undo(); continue; }
      const def = defs(cfg).find((d) => d.id === step.run);
      assert.ok(def, "нет команды " + step.run);
      await runtime.runCommand({ app, command: def.v2Command, settings: Object.assign(bench.paneSettings(cfg), def.makeSettings(cfg)) });
      seen.push(editor.getLine(at.line));
    }
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
  return { doc: editor.getValue(), said, seen };
}

const OPEN = { run: "open-tagwheel-right" };
const UP = { key: "ArrowUp" };
const DOWN = { key: "ArrowDown" };
const RIGHT = { key: "ArrowRight" };
const ENTER = { key: "Enter" };
const DOC = "- Research plan\n\t- read papers\n- buy bread";

async function run() {
  console.log("Command Field в tagWheel (постановка 4.5)");

  /* 1. Ячейка есть, категория — навигатор, пресет — дочерняя ячейка; Enter — одна правка. */
  {
    const r = await drive(config(), DOC, [OPEN, UP, RIGHT, UP, UP, ENTER]);
    assert.ok(/\[Fmt\]|Fmt/.test(r.seen[0]), "ячейки Command Field нет: " + r.seen[0]);
    assert.ok(r.seen.slice(1, 5).some((l) => /Callouts/.test(String(l))), "категория не видна в ячейке: " + JSON.stringify(r.seen));
    assert.equal(r.doc, "> [!tip]\n> - Research plan\n> \t- read papers\n- buy bread", "Enter на Tip не применил его");
    assert.deepEqual(r.said, []);
    ok("ячейка Command Field: категория → пресет → Enter оборачивает строку с деревом");
  }

  /* 2. Один Ctrl+Z возвращает строки; полоса в историю не попала. */
  {
    const r = await drive(config(), DOC, [OPEN, UP, RIGHT, UP, ENTER, { undo: true }]);
    assert.equal(r.doc, DOC, "Ctrl+Z не вернул исходное");
    ok("один шаг отмены на пресет из колеса");
  }

  /* 3. Пустое значение — результата нет (его 💬 к тесту 1 цикла 125): вне коллаута Enter ничего не создаёт,
        в коллауте снимает его; Escape ничего не пишет. */
  {
    const r = await drive(config(), DOC, [OPEN, UP, ENTER]);
    assert.equal(r.doc, DOC, "категория без пресета создала коллаут");
    const inside = "> [!note]\n> - Research plan\n- buy bread";
    const off = await drive(config(), inside, [OPEN, RIGHT, DOWN, ENTER], { line: 1, ch: 4 });
    assert.equal(off.doc, "- Research plan\n- buy bread", "пустой пресет в коллауте его не снял");
    const offCat = await drive(config(), inside, [OPEN, DOWN, ENTER], { line: 1, ch: 4 });
    assert.equal(offCat.doc, "- Research plan\n- buy bread", "пустая категория в коллауте его не сняла");
    const esc = await drive(config(), DOC, [OPEN, UP, RIGHT, UP, { key: "Escape" }]);
    assert.equal(esc.doc, DOC, "Escape что-то записал");
    ok("пустое значение: вне — ничего, в коллауте — снимает; Escape — без следа");
  }

  /* 4. Enter на обычном Field: выбор Command Field в строку не пишется. */
  {
    const r = await drive(config(), DOC, [OPEN, UP, RIGHT, UP, { key: "Tab" }, UP, ENTER]);
    assert.ok(!/Callouts|Note/.test(r.doc.split("\n")[0]), "Command Field записан в строку: " + r.doc.split("\n")[0]);
    assert.ok(/#todo/.test(r.doc.split("\n")[0]), "обычный Field не записался: " + r.doc.split("\n")[0]);
    /* Повтор команды закрывает колесо как Enter (тот же путь, что печать и щелчок, `В-237`), но пресет не пишет. */
    const typed = await drive(config(), DOC, [OPEN, UP, RIGHT, UP, OPEN]);
    assert.ok(!/Callouts|Note|> \[!/.test(typed.doc), "повтор команды на ячейке Command Field записал его: " + typed.doc.split("\n")[0]);
    /* В левом Block пишутся все выбранные теги — там уборка обязательна. */
    const left = await drive(config({ left: true }), DOC, [{ run: "open-tagwheel-left" }, RIGHT, UP, RIGHT, UP, { run: "open-tagwheel-left" }]);
    assert.ok(!/Callouts|Note|> \[!/.test(left.doc), "в левом Block Command Field записан: " + left.doc.split("\n")[0]);
    ok("выбор Command Field не пишется обычным Enter и повтором команды");
  }

  /* 5. Скрытый пресет в колесе не виден; `Active: No` — ячейки нет; Очистка — из колеса. */
  {
    const hidden = await drive(config({ hideTip: true }), DOC, [OPEN, UP, RIGHT, UP, UP, ENTER]);
    assert.equal(hidden.doc.split("\n")[0], "> [!warning]", "скрытый Tip попал в колесо");
    const off = await drive(config({ active: "no" }), DOC, [OPEN]);
    assert.ok(!/Fmt/.test(off.seen[0]), "выключенный Command Field в колесе");
    const clean = await drive(config(), "- #todo buy milk", [OPEN, DOWN, ENTER]);
    assert.equal(clean.doc, "- buy milk", "Очистка из колеса не сработала");
    ok("скрытое не видно, выключенное не стоит, Очистка применяется из колеса");
  }

  /* 6. Каретка в коллауте — его пресет выбран сразу (его `💬` к тесту 1 цикла 125). */
  {
    const inside = "> [!note]\n> - Research plan\n- buy bread";
    const r = await drive(config(), inside, [OPEN, RIGHT, UP, ENTER], { line: 1, ch: 4 });
    assert.ok(/Callouts/.test(r.seen[0]) && /Note/.test(r.seen[0]), "в коллауте колесо не показало выбранное: " + r.seen[0]);
    assert.equal(r.doc, "> [!tip]\n> - Research plan\n- buy bread", "шаг от выбранного Note не дал Tip");
    ok("в коллауте колесо открывается на его категории и пресете");
  }

  /* 7. Один пресет — ячейки пресетов нет (его `💬` к тесту 2); совпавший клон в скроллере не виден (к тесту 3). */
  {
    const one = await drive(config(), DOC, [OPEN, DOWN]);
    assert.ok(/Cleanup/.test(one.seen[1]) && !/preset/.test(one.seen[1]), "у категории с одним пресетом ячейка пресетов: " + one.seen[1]);
    const clone = await drive(config({ clone: true }), DOC, [OPEN, UP, RIGHT, UP, UP]);
    assert.ok(/\[Tip\]/.test(clone.seen[4]), "совпавший клон в колесе: " + clone.seen[4]);
    ok("один пресет — без ячейки пресетов; совпавший клон не виден");
  }

  console.log(`command_field_wheel: ${passed} passed`);
}

run().catch((e) => { console.error(e); process.exit(1); });
