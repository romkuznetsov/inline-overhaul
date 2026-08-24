"use strict";
/**
 * Все проверки согласованного прототипа одной командой (PRD Г24).
 *
 * Прототип нормативен, поэтому расхождение видно в тот же день, а не через
 * месяц: гейты схемы и текстов, дымовой рендер, четыре проверки по выводу и
 * перегенерация раздела 9 с Приложением B без diff.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");
const proto = path.join(root, "docs", "prototype", "settings_prototype.html");
const prd = path.join(root, "docs", "PRD_Settings_Overhaul_v1.md");

const CHECKS = [
  ["gates.js", "схема, тексты и CSS"],
  ["smoke.js", "дымовой рендер каждой вкладки и блока"],
  ["check_bars.js", "Bars: текст не меняется, полосы меняются"],
  ["check_wheel.js", "порядок значений в скроллере TagWheel"],
  ["check_rules.js", "разбор Smart Rules"],
  ["check_fields.js", "редактор Fields и стрелки через линию"],
  ["check_reset.js", "сброс группы, контраст, восстановление"],
];

let failed = 0;
for (const [file, what] of CHECKS) {
  const r = spawnSync(process.execPath, [path.join(__dirname, file), proto],
    { cwd: root, encoding: "utf8", timeout: 120000 });
  if (r.status === 0) {
    console.log("ok    " + file.padEnd(18) + what);
  } else {
    failed++;
    console.log("FAIL  " + file.padEnd(18) + what);
    ((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-12)
      .forEach(l => console.log("      " + l));
  }
}

/* Г24: документ и прототип не разошлись. Перегенерация не должна менять PRD. */
const before = fs.readFileSync(prd, "utf8");
const r = spawnSync("python", [path.join(__dirname, "update_prd.py")],
  { cwd: root, encoding: "utf8", timeout: 120000 });
if (r.status !== 0) {
  failed++;
  console.log("FAIL  update_prd.py    перегенерация не запустилась");
  console.log("      " + ((r.stderr || r.stdout || "").trim().split("\n").slice(-4).join("\n      ")));
} else if (fs.readFileSync(prd, "utf8") !== before) {
  failed++;
  console.log("FAIL  update_prd.py    PRD разошёлся с прототипом: перегенерация изменила документ");
  console.log("      это не ошибка скрипта, а расхождение: закоммить перегенерированный PRD");
} else {
  console.log("ok    update_prd.py    раздел 9 и Приложение B совпадают с прототипом");
}

console.log(failed ? "\n" + failed + " problem(s)" : "\nпрототип и документ в согласии");
process.exit(failed ? 1 : 0);
