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
    /* Подпись стрелки договаривает, что она делает на краю Block, поэтому
       сверяем начало, а не всю строку: одна подсказка на узел, и она длинная. */
    '    if (String(n.getAttribute && n.getAttribute("aria-label")).indexOf(' + JSON.stringify(label) + ') === 0) {',
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

/* ---- окно Add Field ------------------------------------------------- */
/* Тип Field выбирается один раз и потом не меняется, поэтому кнопка
   спрашивает имя и тип окном, а не заводит Field молча (2026-08-27). */

const check = (what, got, want) => {
  if (String(got) === String(want)) { console.log('  ok   ' + what); return; }
  console.log('  FAIL ' + what + ': ждали ' + want + ', получили ' + got);
  failures++;
};

/* Нажать узел, чей собственный текст равен заданному. */
const clickText = text => run(
  '(() => {'
  + '  let hit = null;'
  + '  const go = n => { if (hit) return;'
  + '    if (String(n._text || "").trim() === ' + JSON.stringify(text) + ') { hit = n; return; }'
  + '    n.children.forEach(go); };'
  + '  go(document.body);'
  + '  if (!hit) return false;'
  + '  hit.dispatch("click", { preventDefault() {}, stopPropagation() {}, target: hit });'
  + '  return true;'
  + '})()');

const scrim = 'document.body.children.filter(n => String(n.className) === "io-scrim")';

console.log('\nокно Add Field:');
check('кнопка Add Field открывает окно', clickText('Add Field'), 'true');
check('окно объявлено диалогом',
  run('(() => { const s = ' + scrim + '[0]; return s ? String(s.children[0].getAttribute("aria-label")) : "окна нет"; })()'),
  'Add a Field');
check('окно спрашивает имя и тип',
  run('(() => { const out = []; const go = n => { if (String(n.className) === "io-item__name") out.push(n._text);'
    + ' n.children.forEach(go); }; go(' + scrim + '[0]); return out.join(","); })()'),
  'Name,Type');
check('пока имя пустое, Add выключена',
  run('(() => { let b = null; const go = n => { if (String(n._text) === "Add") b = n; n.children.forEach(go); };'
    + ' go(' + scrim + '[0]); return b ? b.disabled : "кнопки Add нет"; })()'),
  'true');

/* Имя вводится, тип берётся link — тот, которого без окна не создать. */
run('(() => { let input = null, sel = null;'
  + ' const go = n => { if (n.tagName === "INPUT" && !input) input = n;'
  + '   if (n.tagName === "SELECT" && !sel) sel = n; n.children.forEach(go); };'
  + ' go(' + scrim + '[0]);'
  + ' input.value = "Client"; input.dispatch("input", { target: input });'
  + ' sel.value = "link"; sel.dispatch("change", { target: sel });'
  + ' return true; })()');

check('Add создаёт Field выбранного типа и сразу его выбирает',
  String(clickText('Add')) === 'true'
    ? run('(() => { const f = field(selectedFieldId); return f ? f.name + ":" + f.type : "ничего не выбрано"; })()')
    : 'кнопка Add не нашлась',
  'Client:link');
check('окно закрылось', run(scrim + '.length'), '0');

console.log(failures ? "\n" + failures + " problem(s)" : "\nстрелки работают, включая переход через линию; окно Add Field спрашивает имя и тип");
process.exit(failures ? 1 : 0);
