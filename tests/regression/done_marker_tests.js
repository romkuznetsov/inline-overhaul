"use strict";

/**
 * Метка отмеченной строки (`done-marker`, его заказ 2026-09-30).
 *
 * Строка считается настоящим движком (`pkm_runtime_v2.js`) на стартовом наборе,
 * проведённом через `migrateConfig` (правило 2). Ожидания выписаны строками, а
 * не выведены из движка (правило 5). Узнавание щелчка — настоящим изменением
 * CodeMirror, а не подделкой.
 */

const assert = require("assert");
const cmState = require("@codemirror/state");
const rt = require("../../src/pkm_runtime_v2.js");
const normalize = require("../../src/core/config_normalize.js");
const { applyStarterSet } = require("../../src/core/starter_config.ts");
const dm = require("../../src/features/checkbox_done_marker.js");
const doneCfg = require("../../src/core/done_marker_config.js");

let passed = 0;
const ok = (label) => { passed++; console.log("  ok " + label); };

function cfgWith(token, panel, extra) {
  const raw = {};
  applyStarterSet(raw);
  /* Настройка ставится в конфиг версии 2, как её пишет панель: переезд с
     версии 1 несёт только названные ключи, а этого ключа у версии 1 не было. */
  const cfg = normalize.migrateConfig(raw);
  Object.assign(cfg.pkm.behavior, extra || {}, { doneMarker: { token, panel } });
  return normalize.migrateConfig(cfg);
}

if (!global.window) global.window = { __tagWheelState: { active: false }, addEventListener() {}, removeEventListener() {} };

(async () => {
  const cases = [
    /* маркер не из Fields — временный Field в выбранном Block */
    ["✅", "right", "- [x] text", true, "- [x] text || ✅"],
    ["✅", "right", "- [ ] text || ✅", false, "- [ ] text"],
    ["✅", "right", "- [x] #todo || text || 📅2026-09-30", true, "- [x] #todo || text || 📅2026-09-30 ✅"],
    ["#completed", "left", "- [x] #high || text", true, "- [x] #high #completed || text"],
    ["#completed", "left", "- [ ] #high #completed || text", false, "- [ ] #high || text"],
    ["#completed", "left", "\t1. [x] child", true, "\t1. [x] #completed || child"],
    ["#completed", "left", "> - [x] quoted", true, "> - [x] #completed || quoted"],
    /* маркер — Value поля Status: место поля, прежнее Value уступает */
    ["#done", "right", "- [x] #doing #high || text", true, "- [x] #done #high || text"],
    ["#done", "right", "- [ ] #done #high || text", false, "- [ ] #high || text"],
    /* маркер уже стоит / уже снят — писать нечего */
    ["✅", "right", "- [x] text || ✅", true, null],
    ["#done", "right", "- [ ] #doing || text", false, null],
  ];
  for (const [token, panel, line, checked, want] of cases) {
    const got = await dm.lineAfterToggle(rt, cfgWith(token, panel), line, checked);
    assert.strictEqual(got, want, `${token} ${panel} ${checked ? "tick" : "untick"} ${JSON.stringify(line)}`);
  }
  ok("маркер встаёт и снимается движком на всех формах начала строки");

  /*
   * Галочку ставит человек, и шаги `next` её не трогают: путь к маркеру идёт через
   * Value с Prefix `[ ]` (его конфиг — Prefix у `#todo`; тест 7 цикла 126:
   * `- [x] принято` становилось `- [ ] #done :: принято`, снятие давало `- принято`).
   */
  {
    const cfg = cfgWith("#done", "right");
    cfg.pkm.prefixRules = Object.assign({}, cfg.pkm.prefixRules, { checkboxByFieldValue: { Status: { "#todo": "[ ]" } } });
    const run = normalize.migrateConfig(cfg);
    const pairs = [
      ["- [x] text", true, "- [x] #done || text"],
      ["- [ ] #done || text", false, "- [ ] text"],
      ["\t- [x] #high || text", true, "\t- [x] #done #high || text"],
    ];
    for (const [line, checked, want] of pairs) {
      assert.strictEqual(await dm.lineAfterToggle(rt, run, line, checked), want, `${checked ? "tick" : "untick"} ${JSON.stringify(line)}`);
    }
    ok("галочку человека Prefix Values по пути к маркеру не переписывает");
  }

  /* `Clear line` не снимает саму задачу: строка из галочки и маркера остаётся задачей. */
  {
    const got = await dm.lineAfterToggle(rt, cfgWith("✅", "left", { cycleEndBehavior: "clear-prefix" }), "- [ ] ✅", false);
    assert.strictEqual(got, "- [ ] ", "Clear line стёр задачу: " + JSON.stringify(got));
    ok("опустевшая строка остаётся задачей при Clear line");
  }

  /* Чей это Value: написание в строке, а custom block места не имеет. */
  {
    const cfg = { pkm: { fields: {
      order: { enabled: { Off: false }, custom: [{ id: "b1", keys: ["Tech"] }] },
      tags: { fields: [
        { id: "Status", prefix: "#", values: [{ token: "done" }] },
        { id: "Panel", prefix: "#", values: [{ token: "#ready" }] },
        { id: "Tech", prefix: "", values: [{ token: "💡" }] },
        { id: "Mood", prefix: "", values: ["🙂"] },
        { id: "Off", prefix: "#", values: [{ token: "gone" }] },
      ] },
      links: { fields: [{ id: "People", values: [{ token: "Man1" }] }] },
    } } };
    const of = (t) => { const f = doneCfg.fieldOfMarker(cfg, t); return f && f.id; };
    assert.strictEqual(of("#done"), "Status");
    assert.strictEqual(of("done"), null, "тег узнан без решётки");
    assert.strictEqual(of("#ready"), "Panel", "Value, заведённое панелью с решёткой");
    assert.strictEqual(of("🙂"), "Mood");
    assert.strictEqual(of("💡"), null, "Field custom block назван местом маркера");
    assert.strictEqual(of("#gone"), null, "выключенный Field назван местом маркера");
    assert.strictEqual(of("[[Man1]]"), "People");
    assert.strictEqual(of("Man1"), null, "ссылка узнана без скобок");
    ok("Value маркера узнаётся по написанию в строке");
  }

  /* Зачёркивание (`done-strike`) доходит через нормализацию и не зависит от
     затемнения; пустой маркер выключает и его. */
  {
    const marks = (token, dmExtra) => {
      const cfg = cfgWith(token, "right");
      Object.assign(cfg.pkm.behavior.doneMarker, dmExtra);
      return require("../../src/core/editor_visuals_config.js").getSourceMarksFromConfig(normalize.migrateConfig(cfg));
    };
    const on = marks("✅", { strike: true });
    assert.strictEqual(on.doneStrike, true, "зачёркивание не дошло");
    assert.strictEqual(on.doneHighlight, false, "зачёркивание включило затемнение");
    assert.strictEqual(marks("✅", {}).doneStrike, false, "умолчание зачёркивает");
    assert.strictEqual(marks("", { strike: true }).doneStrike, false, "пустой маркер зачёркивает");
    ok("зачёркивание отмеченной строки читается отдельно от затемнения");
  }

  /* Пустой маркер — функция выключена. */
  assert.strictEqual(await dm.lineAfterToggle(rt, cfgWith("", "right"), "- [x] text", true), null);
  ok("пустой маркер ничего не пишет");

  /* Узнавание: щелчок по галочке — да; набор новой строки и правка текста — нет. */
  {
    const seen = (doc, spec) => {
      const st = cmState.EditorState.create({ doc });
      const tr = st.update(spec);
      return dm.toggledLines({ startState: st, state: tr.state, changes: tr.changes });
    };
    const tick = seen("- a\n- [ ] b", { changes: { from: 7, to: 8, insert: "x" } });
    assert.deepStrictEqual(tick, [{ number: 2, text: "- [x] b", checked: true }]);
    const untick = seen("- [x] b", { changes: { from: 3, to: 4, insert: " " } });
    assert.deepStrictEqual(untick, [{ number: 1, text: "- [ ] b", checked: false }]);
    assert.deepStrictEqual(seen("- [ ] b", { changes: { from: 7, insert: "c" } }), [], "правка текста принята за галочку");
    assert.deepStrictEqual(seen("- b", { changes: { from: 2, insert: "[x] " } }), [], "набор галочки принят за щелчок");
    assert.deepStrictEqual(seen("- [ ] b", { changes: { from: 3, to: 7, insert: "x] c" } }), [], "галочка вместе с текстом принята за щелчок");
    ok("узнаётся только смена галочки");
  }

  console.log(`done_marker_tests: ${passed} ok`);
})().catch((e) => { console.error(e); process.exit(1); });
