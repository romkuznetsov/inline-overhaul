"use strict";
/* Read the rendered scroller and the rendered tree, so the order and the
   bars are checked as output rather than as intent. */
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
process.argv[2] = target;
/* Подделка страницы — модулем, без копии файла (ревизия Д-11). */
const h = require("./smoke.js");
if (h.failures) { console.log("smoke harness failed: " + h.failures); process.exit(1); }
const run = e => h.vm.runInContext(e, h.ctxVm);

run('ctx.set("visual.tagBars.fieldId", "status")');
run('ctx.set("visual.tagBars.active", true)');
run('ctx.set("visual.tagBars.stripesToShow", 3)');
/* Без него коробки нет вовсе, и проверка печатала «nothing found» (2026-10-02). */
run('ctx.set("visual.tagWheel.scroller.enabled", true)');
run('ctx.set("visual.tagWheel.showMarkers", false)');
run('ctx.set("visual.tagWheel.scroller.direction", "full")');
run('ctx.set("visual.tagWheel.scroller.size", 3)');
run('selectTab("visual")');

console.log("\nthe field the scroller sits on, in order:");
console.log("  " + run('(() => { const l = fieldsOn("Left"); const f = l[1] || l[0];' +
  ' return f.name + ": " + f.values.map(v => v.token).join(" \\u2192 "); })()'));

const walk =
  '(() => { const out = [];' +
  ' const go = n => { const c = String(n.className || "");' +
  '   if (c.indexOf("io-wheelpanel") >= 0) {' +
  '     out.push((c.indexOf("--up") >= 0 ? "up   " : "down ") + "top to bottom: " +' +
  '       n.children.map(x => x.textContent).join(", "));' +
  '   } else if (c.indexOf("io-bubble--current") >= 0) {' +
  '     out.push("chip  " + n.textContent);' +
  '   }' +
  '   n.children.forEach(go); };' +
  ' go(document.getElementById("content"));' +
  ' return out.join("\\n  "); })()';
console.log("\nrendered scroller:");
const rendered = run(walk) || "nothing found";
console.log("  " + rendered);

/*
 * Круг — как в заметке: пустое место `-` первым, затем Values; активное —
 * среднее Value, вверх следующие, вниз предыдущие (H1.4 прогона 2026-10-02).
 * Ожидание считается здесь из списка Values, а не из отрисовки.
 */
const tokens = JSON.parse(run('(() => { const l = fieldsOn("Left"); const f = l[1] || l[0];' +
  ' return JSON.stringify(f.values.filter(v => v.depth === 0).map(v => v.token)); })()'));
const ring = ["-"].concat(tokens);
const at = 1 + (tokens.length > 2 ? Math.floor(tokens.length / 2) : 0);
const pick = k => ring[((at + k) % ring.length + ring.length) % ring.length];
const want = [
  "up   top to bottom: " + [3, 2, 1].map(pick).join(", "),
  "down top to bottom: " + [-1, -2, -3].map(pick).join(", "),
];
const got = rendered.split("\n  ").filter(s => /^(up|down)/.test(s));
if (JSON.stringify(got) !== JSON.stringify(want)) {
  console.log("\nFAIL scroller ring:\n  want " + want.join("\n       ") + "\n  got  " + got.join("\n       "));
  process.exit(1);
}

console.log("\nrendered tree, with the bars each line carries:");
console.log("  " + run(
  '(() => { const out = [];' +
  ' const go = (n, lanes) => { const c = String(n.className || "");' +
  '   let mine = lanes;' +
  '   if (c.indexOf("io-node--bar") >= 0) mine = lanes.concat([n.style.getPropertyValue("--io-lane") || "?"]);' +
  '   if (c.indexOf("io-line") >= 0) {' +
  '     const t = n.children.map(x => x.textContent).join(" ").replace(/\\s+/g, " ").trim();' +
  '     out.push("[" + (lanes.length ? lanes.join(",") : "-") + "] " + t);' +
  '     return;' +
  '   }' +
  '   n.children.forEach(x => go(x, mine)); };' +
  ' go(document.getElementById("content"), []);' +
  ' return out.join("\\n  "); })()') || "nothing found");
