"use strict";
/* The Fields editor as it actually renders: the two column heads, what can
   be dragged, which colour each type chip gets — and what the arrows do,
   including the step across the line at the edge of a Block. */
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
const smoke = fs.readFileSync(path.join(__dirname, "smoke.js"), "utf8");
const tmp = path.join(__dirname, "_h8.js");
fs.writeFileSync(tmp, smoke.replace("process.exit(failures ? 1 : 0);",
  "module.exports = { ctxVm, vm };"), "utf8");
process.argv[2] = target;
const h = require(tmp);
fs.unlinkSync(tmp);
const run = e => h.vm.runInContext(e, h.ctxVm);

run('selectTab("pkm")');

const DUMP = [
  '(() => {',
  '  const NL = String.fromCharCode(10);',
  '  let root = null;',
  '  const find = n => {',
  '    if (root) return;',
  '    const c = String(n.className || "");',
  '    if (c === "io-fields") { root = n; return; }',
  '    n.children.forEach(find);',
  '  };',
  '  find(document.getElementById("content"));',
  '  if (!root) return "no io-fields wrapper found";',
  '  const out = [];',
  '  const go = (n, d) => {',
  '    const c = String(n.className || "");',
  '    if (c) {',
  '      let row = new Array(d + 1).join("  ") + c;',
  '      if (n._text) row += "  [" + n._text + "]";',
  '      if (n.draggable) row += "  <draggable>";',
  '      const bg = n.style.getPropertyValue("--io-chip-bg");',
  '      if (bg) row += "  bg=" + bg;',
  '      out.push(row);',
  '    }',
  '    n.children.forEach(x => go(x, c ? d + 1 : d));',
  '  };',
  '  go(root, 0);',
  '  return out.join(NL);',
  '})()'
].join("\n");

console.log(run(DUMP));

/* ---- what the arrows actually do ---------------------------------- */
const ORDER = 'FIELDS.filter(f => !f.parent).map(f => f.position[0] + ":" + f.name).join("  ")';

/* Press the arrow on a named Field: find its row, then click the button
   whose aria-label says up or down. */
const press = (name, dir) => {
  const label = "Move " + name + " " + (dir < 0 ? "up" : "down");
  const hit = run([
    '(() => {',
    '  let done = false;',
    '  const go = n => {',
    '    if (done) return;',
    '    if (String(n.getAttribute && n.getAttribute("aria-label")) === ' + JSON.stringify(label) + ') {',
    '      n.dispatch("click", { preventDefault() {}, stopPropagation() {}, target: n });',
    '      done = true; return;',
    '    }',
    '    n.children.forEach(go);',
    '  };',
    '  go(document.getElementById("content"));',
    '  return done;',
    '})()'
  ].join("\n"));
  return hit;
};

let failures = 0;
const step = (name, dir, what) => {
  const before = run(ORDER);
  if (!press(name, dir)) { console.log("  MISSING BUTTON: " + name + " " + what); failures++; return; }
  const after = run(ORDER);
  console.log("  " + (name + " " + what + "            ").slice(0, 22) + before + "   ->   " + after);
  if (before === after) { console.log("      nothing moved"); failures++; }
};

console.log("\nчто делают стрелки (L: Left Block, R: Right Block):");
step("Priority", -1, "up");        // внутри стороны
step("Status", 1, "down");         // обратно
step("Status", -1, "up");          // на самом верху Left: уходит на Right
step("Status", 1, "down");         // с конца Right: возвращается на Left

console.log(failures ? "\n" + failures + " problem(s)" : "\nстрелки работают, включая переход через линию");
process.exit(failures ? 1 : 0);
