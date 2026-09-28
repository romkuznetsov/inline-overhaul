/**
 * Строка на стартовом наборе Fields чистого vault (BUGHUNT 2026-09-26).
 *
 * **Зачем отдельный файл.** Прогон с чистого листа нашёл дефекты, которых не
 * было ни на его `data.json`, ни на синтетических фикстурах: у стартового
 * набора Value ссылки с пробелом (`Project A`, `Project B`), а у его конфига
 * таких нет. Фикстура здесь — не выписанный конфиг, а тот же путь, которым его
 * получает человек: `migrateConfig` пустого файла, `applyStarterSet`, снова
 * `migrateConfig` (правило 2). Команды идут через те же определения и тот же
 * рантайм, что у плагина (`tools/line_bench.js`, правило 1).
 *
 * Каждая строка таблицы — случай перечня; номер в имени — строка BUGHUNT.
 * Тот же случай стоит в `tools/obsidian_cases.js` и гоняется настоящим
 * Obsidian: там отвечает платформа, здесь — быстро и в семи шагах.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { applyStarterSet } from "../../src/core/starter_config.ts";

const require = createRequire(import.meta.url);
const bench = require("../../tools/line_bench.js");
const normalize = require("../../src/core/config_normalize.js");
const rulesShape = require("../../src/core/pkm_rules_shape.js");
const macroShared = require("../../src/core/pkm_macro_shared.js");

type Any = ReturnType<typeof JSON.parse>;

function starterConfig(): Any {
  const fresh = normalize.migrateConfig(null);
  assert.equal(applyStarterSet(fresh), true, "стартовый набор не встал — фикстура не та, что у человека");
  return normalize.migrateConfig(fresh);
}

const cfg = starterConfig();
/* Контроль фикстуры (У-147): Value с пробелом в ней есть — ради него файл и заведён. */
const projectValues = JSON.stringify(cfg.pkm.fields.links);
assert.ok(projectValues.includes("Project A"), "в стартовом наборе нет Value с пробелом");

let passed = 0;

async function cmd(id: string, line: string, want: string, ch?: number, title?: string): Promise<void> {
  const got = await bench.runCommandById(cfg, id, line, ch == null ? line.length : ch);
  assert.equal(got.line, want, (title || id) + ": " + JSON.stringify(line));
  passed++;
  console.log("  ok " + (title || id) + " — " + JSON.stringify(line) + " → " + JSON.stringify(want));
}

async function main(): Promise<void> {
  /* R1: пробел в Value-ссылке не рвёт её надвое. */
  await cmd("project-next", "- x", "- x || [[Project A]]", undefined, "F1.a Project встаёт за разделителем");
  await cmd("status-next", "- x || [[Project A]]", "- #todo || x || [[Project A]]", undefined, "F1.b правый Block со ссылкой узнаётся");
  await cmd("project-next", "- x || [[Project A]]", "- x || [[Project B]]", undefined, "F1.c круг идёт дальше");
  await cmd("priority-next", "- позвонить в банк || 📅2026-09-30 [[Project B]]", "- #low || позвонить в банк || 📅2026-09-30 [[Project B]]", 5, "F3.a текст на месте");
  await cmd("status-next", "- позвонить в банк || 📅2026-09-30 [[Project B]]", "- #todo || позвонить в банк || 📅2026-09-30 [[Project B]]", 5, "F3.b ссылка не удваивается");
  /* F15 = S14: `Clear line` чистит только опустевшую строку — задача и номер
     с текстом остаются собой. Отрицательный контроль — строка без текста. */
  const clear = JSON.parse(JSON.stringify(cfg));
  clear.pkm.behavior.cycleEndBehavior = "clear-prefix";
  const clearCfg = normalize.migrateConfig(clear);
  const viaClear = async (line: string, want: string, title: string): Promise<void> => {
    const got = await bench.runCommandById(clearCfg, "status-previous", line, line.length);
    assert.equal(got.line, want, title);
    passed++;
    console.log("  ok " + title);
  };
  await viaClear("- [ ] #todo || купить", "- [ ] купить", "F15 чекбокс остаётся, когда текст есть");
  await viaClear("1. #todo || пункт", "1. пункт", "F15 номер остаётся, когда текст есть");
  await viaClear("- [ ] #todo", "", "F15 опустевшая строка чистится");
  /* K4, K5: одиночный разделитель, за которым правый Block, — второй; слот
     текста слева (так же отвечает разбор строки). Smart Enter `Text only`
     спрашивает именно его. */
  const rules = rulesShape.buildRulesForEngines(cfg);
  const slot = (l: string) => JSON.stringify(macroShared.getTextSlotBounds(l, rules));
  assert.equal(slot("- позвонить || 📅2026-09-30"), JSON.stringify({ start: 2, end: 11 }), "K4 слот текста слева от единственного разделителя");
  assert.equal(slot("- позвонить || [[Project A]]"), JSON.stringify({ start: 2, end: 11 }), "K4 то же со ссылкой с пробелом");
  assert.equal(slot("- #todo || 📅2026-09-30"), JSON.stringify({ start: 7, end: 7 }), "K4 слева значения — слот пуст");
  assert.equal(slot("- #todo || позвонить"), JSON.stringify({ start: 11, end: 20 }), "K4 отрицательный контроль: за разделителем текст");
  passed += 4;
  console.log("  ok K4 слот текста при одном разделителе");
  /* S13: Value, заведённое панелью, хранится с решёткой (`#todo`), стартовое —
     без. При `Nested` вид собирался склейкой, и выходило `##todo/kitchen`. */
  const nested = JSON.parse(JSON.stringify(cfg));
  const tagFields = nested.pkm.fields.tags.fields;
  const status = tagFields.find((f: Any) => f.id === "Status");
  status.values = status.values.map((v: Any) => ({ ...v, token: "#" + String(v.token).replace(/^#/, "") }));
  const sub = tagFields.find((f: Any) => f.id === "Status_sub");
  sub.values = [{ token: "#kitchen", allowedParentValues: ["#todo"], active: true }];
  sub.enabled = true;
  nested.pkm.fields.order.enabled.Status_sub = true;
  nested.pkm.fields.order.active.Status_sub = "yes";
  nested.pkm.behavior.childTagFormat = "combined";
  const nestedCfg = normalize.migrateConfig(nested);
  const got = await bench.runCommandById(nestedCfg, "status-sub-next", "- #todo || x", 12);
  assert.equal(got.line, "- #todo/kitchen || x", "S13: Nested с Value панели");
  passed++;
  /* Второе нажатие читает написанное (У-157): пара узнаётся, круг идёт дальше. */
  const again = await bench.runCommandById(nestedCfg, "status-sub-next", got.line, got.line.length);
  assert.equal(again.line, "- #todo || x", "S13: написанное Nested не узнаётся вторым нажатием");
  passed++;
  console.log("  ok S13 Nested: Value с решёткой не удваивает её");
  /* K2 (`В-242`): склейка строк с полями сливает поля в блоки, одинаковое поле —
     побеждает первая строка; без полей во второй — склейка обычная (null). */
  const sd = require("../../src/features/smart_delete_engine.js");
  const m = (a: string, b: string): string | null => { const r = sd.mergeLinesWithFields(a, b, rules); return r ? r.line : null; };
  assert.equal(m("- #todo || a", "- #low || b"), "- #todo #low || a b", "K2: поля второй строки не встали в блоки");
  assert.equal(m("- #todo || a", "- #done || b"), "- #todo || a b", "K2: одинаковое поле — не первая строка");
  assert.equal(m("- a", "- #low || b || 📅2026-09-30"), "- #low || a b || 📅2026-09-30", "K2: правый Block второй строки потерян");
  assert.equal(m("- #todo || a", "- b"), null, "отрицательный контроль: у второй строки полей нет");
  passed += 4;
  console.log("  ok K2 склейка строк с полями сливает поля в блоки");
  /* F4: план записи полосы режет строку словами, и ссылка с пробелом — одно
     слово; иначе ` B]]` прятался посреди ссылки и Obsidian рисовал хвост. */
  const plw = require("../../src/core/panel_line_write.js");
  const src = "- #todo || позвонить || 📅2026-09-30 [[Project B]]";
  const words = plw.splitWords(src);
  assert.equal(words.join(""), src, "F4 склейка слов не даёт исходную строку");
  assert.ok(words.includes(" [[Project B]]"), "F4 ссылка с пробелом разрезана: " + JSON.stringify(words));
  passed += 2;
  console.log("  ok F4 ссылка с пробелом — одно слово плана записи полосы");
  /* В-248: чекбокс из Prefix у Value-ссылки встаёт в строку, как у тега. Ключ —
     в том написании, в каком его пишет панель (`[[Project A]]`). */
  {
    const raw = JSON.parse(JSON.stringify(cfg));
    const proj = (raw.pkm.fields.links.fields as Any[]).find(f => JSON.stringify(f.values).includes("Project A"));
    assert.ok(proj, "контроль фикстуры: Field со Value `Project A` есть");
    raw.pkm.prefixRules = raw.pkm.prefixRules || {};
    raw.pkm.prefixRules.checkboxByFieldValue = { ...(raw.pkm.prefixRules.checkboxByFieldValue || {}), [proj.id]: { "[[Project A]]": "[x]" } };
    const cbCfg = normalize.migrateConfig(raw);
    const plain = await bench.runCommandById(cfg, "project-next", "- x", 3);
    assert.equal(plain.line, "- x || [[Project A]]", "контроль: без правила чекбокса нет");
    const got = await bench.runCommandById(cbCfg, "project-next", "- x", 3);
    assert.equal(got.line, "- [x] x || [[Project A]]", "В-248: чекбокс Value-ссылки не встал");
    passed++;
    console.log("  ok В-248 чекбокс из Prefix у Value-ссылки встаёт в строку");
  }
  console.log(passed + " проверок");
}

main().catch((e) => { console.error(e); process.exit(1); });
