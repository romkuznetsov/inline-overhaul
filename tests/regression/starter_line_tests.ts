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
  /* F4: план записи полосы режет строку словами, и ссылка с пробелом — одно
     слово; иначе ` B]]` прятался посреди ссылки и Obsidian рисовал хвост. */
  const plw = require("../../src/core/panel_line_write.js");
  const src = "- #todo || позвонить || 📅2026-09-30 [[Project B]]";
  const words = plw.splitWords(src);
  assert.equal(words.join(""), src, "F4 склейка слов не даёт исходную строку");
  assert.ok(words.includes(" [[Project B]]"), "F4 ссылка с пробелом разрезана: " + JSON.stringify(words));
  passed += 2;
  console.log("  ok F4 ссылка с пробелом — одно слово плана записи полосы");
  console.log(passed + " проверок");
}

main().catch((e) => { console.error(e); process.exit(1); });
