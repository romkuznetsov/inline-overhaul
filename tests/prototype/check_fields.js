"use strict";
/* The Fields editor as it actually renders: the two column heads, what can
   be dragged, and which colour each type chip gets. */
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
