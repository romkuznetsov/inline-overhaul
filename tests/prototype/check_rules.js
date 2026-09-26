"use strict";
/* Read the real values the mapping table computes, rather than trusting
   that the code reads as if it works. */
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
process.argv[2] = target;
/* Подделка страницы — модулем, без копии файла (ревизия Д-11). */
const h = require("./smoke.js");

if (h.failures) { console.log("harness failed"); process.exit(1); }
const run = e => h.vm.runInContext(e, h.ctxVm);

for (const fmt of ["raw"]) {
  
  console.log("\nProperty values = " + fmt);
  for (const rule of ["raw", "clean"]) {
    const out = run(
      'FIELDS.map(f => { const o = f.valueRule; f.valueRule = "' + rule + '";' +
      ' const s = f.name + "=" + yamlValueFor(f); f.valueRule = o; return s; }).join("   ")');
    console.log("  " + rule.padEnd(8) + out);
  }
}

console.log("\nrevolver rows, 6 values, current 2, per side 3");
console.log("  " + run(
  '(() => { const n = 6, at = 2, rows = 3, up = [], dn = [];' +
  ' for (let k = rows; k >= 1; k--) up.push((at + k) % n);' +
  ' for (let k = 1; k <= rows; k++) dn.push(((at - k) % n + n) % n);' +
  ' return "up " + up.join(",") + "  chip " + at + "  down " + dn.join(","); })()'));

console.log("\nlane positions (parent must be leftmost)");
const css = /<style>([\s\S]*?)<\/style>/.exec(fs.readFileSync(target, "utf8"))[1];
const m = /\.io-node--bar::before \{[\s\S]*?\}/.exec(css);
console.log("  " + (m ? m[0].split("\n").find(l => l.includes("left:")).trim() : "rule missing"));
