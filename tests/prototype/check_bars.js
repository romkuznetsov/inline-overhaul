"use strict";
/* The owner's rule for the Bars preview: switching which Field draws the
   Bars must change the Bars and nothing else. Read both renders and diff. */
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
const smoke = fs.readFileSync(path.join(__dirname, "smoke.js"), "utf8");
const tmp = path.join(__dirname, "_h4.js");
fs.writeFileSync(tmp, smoke.replace("process.exit(failures ? 1 : 0);",
  "module.exports = { ctxVm, vm };"), "utf8");
process.argv[2] = target;
const h = require(tmp);
fs.unlinkSync(tmp);
const run = e => h.vm.runInContext(e, h.ctxVm);

/* Only the tree inside the Bars preview, so the other previews on the tab
   do not turn up in the comparison. */
const WALK = [
  '(() => {',
  '  const lines = [], bars = [];',
  '  let root = null;',
  '  const find = n => {',
  '    if (root) return;',
  '    if (String(n.className || "").indexOf("io-tree") >= 0) { root = n; return; }',
  '    n.children.forEach(find);',
  '  };',
  '  find(document.getElementById("content"));',
  '  if (!root) return JSON.stringify({ lines: ["no io-tree found"], bars: [] });',
  '  const deep = n => (n._text || "") + " " + n.children.map(deep).join(" ");',
'  const lane = n => (n.style.getPropertyValue("--io-lane") || "?") +',
  '    ":" + (n.style.getPropertyValue("--io-bar-color") || "?");',
  '  const go = (n, lanes) => {',
  '    const c = String(n.className || "");',
  '    let mine = lanes;',
  '    if (c.indexOf("io-node--bar") >= 0) mine = lanes.concat([lane(n)]);',
  '    if (c.indexOf("io-line") >= 0 && c.indexOf("io-line__") < 0) {',
  '      const t = deep(n);',
  '      lines.push(t.split(SPACES).join(" ").trim());',
  '      bars.push(lanes.join(" ") || "no bar");',
  '      return;',
  '    }',
  '    n.children.forEach(x => go(x, mine));',
  '  };',
  '  go(root, []);',
  '  return JSON.stringify({ lines: lines, bars: bars });',
  '})()'
].join("\n");

/* built here rather than inside the source string, because a backslash does
   not survive the trip through the shell into this file */
h.vm.runInContext("var SPACES = new RegExp('[' + String.fromCharCode(32,9,10) + ']+', 'g');", h.ctxVm);

const shot = (fieldId, showTag) => {
  run('ctx.set("visual.tagBars.active", true)');
  run('ctx.set("visual.tagBars.stripesToShow", 3)');
  run('ctx.set("visual.tagBars.tagVisibility", ' + showTag + ')');
  run('ctx.set("visual.tagBars.fieldId", "' + fieldId + '")');
  run('selectTab("visual")');
  return JSON.parse(run(WALK));
};

const show = s => s.lines.forEach((l, i) => {
  console.log("  " + (s.bars[i] + "                                        ").slice(0, 40) + "  " + l);
});

const a = shot("status", true);
const b = shot("priority", true);
console.log("\nStatus draws the Bars:");   show(a);
console.log("\nPriority draws the Bars:"); show(b);

const sameText = JSON.stringify(a.lines) === JSON.stringify(b.lines);
const barsMoved = JSON.stringify(a.bars) !== JSON.stringify(b.bars);
console.log("\ntext identical either way : " + sameText + "   (must be true)");
console.log("bars differ either way    : " + barsMoved + "   (must be true)");

console.log("\nand with Show the Field's tag off, Status driving:");
show(shot("status", false));
process.exit(sameText && barsMoved ? 0 : 1);
