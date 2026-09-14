"use strict";
/*
 * **Разбор остатка долга копий: что за род у каждого имени.**
 *
 * Число без списка — оценка, а не вывод (У-109). Этот обход печатает у
 * каждого имени из списка `rule_copies` первые значащие строки **каждого**
 * тела: по ним видно, правило это, переходник, доставалка модуля или
 * совпадение имён. Классификация от 2026-09-15 — PRD 10.13.149.
 *
 * Запуск (из `repo/`): node tools/rule_copy_shapes.js
 *
 * Прежний разбор остатка: у каждого имени из списка копий печатается первая значащая
 * строка каждого тела. По ней видно, что это — правило, переходник или
 * доставалка модуля.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ROOT = process.cwd();

const out = execSync("node tools/rule_copies.js", { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 24 });
const rows = out.split("\n").filter((l) => /^(расходятся|совпадают)/.test(l));

function bodyFirstLines(rel, name) {
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const head = new RegExp("(^|\\n)function " + name + "\\s*\\(");
  const m = text.match(head);
  if (!m) return "(не найдено)";
  const at = text.indexOf(m[0]) + m[0].length;
  const open = text.indexOf("{", at);
  const lines = text.slice(open + 1).split("\n");
  const sig = [];
  for (const l of lines) {
    const t = l.trim();
    if (!t || t.startsWith("*") || t.startsWith("//") || t.startsWith("/*")) continue;
    sig.push(t);
    if (sig.length >= 2) break;
  }
  return sig.join(" ⏎ ").slice(0, 118);
}

for (const row of rows) {
  const parts = row.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean);
  const name = parts[1];
  const files = parts.slice(3).join(" ").split("|").map((x) => x.trim()).filter(Boolean);
  console.log("\n" + name + "   [" + parts[2] + "]");
  for (const f of files) console.log("   " + f.padEnd(44) + " " + bodyFirstLines(f, name));
}
