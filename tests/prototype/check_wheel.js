"use strict";
/* Read the rendered scroller and the rendered tree, so the order and the
   bars are checked as output rather than as intent. */
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
const smoke = fs.readFileSync(path.join(__dirname, "smoke.js"), "utf8");
const tmp = path.join(__dirname, "_h3.js");
fs.writeFileSync(tmp, smoke.replace("process.exit(failures ? 1 : 0);",
  "module.exports = { ctxVm, vm, failures };"), "utf8");
process.argv[2] = target;
const h = require(tmp);
fs.unlinkSync(tmp);
const run = e => h.vm.runInContext(e, h.ctxVm);

run('ctx.set("visual.tagBars.fieldId", "status")');
run('ctx.set("visual.tagBars.active", true)');
run('ctx.set("visual.tagBars.stripesToShow", 3)');
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
console.log("  " + (run(walk) || "nothing found"));

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
