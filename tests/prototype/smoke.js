"use strict";
/* Runs the prototype's script against a minimal DOM stub, so a blank page
   fails here instead of in the browser. Renders every tab, toggles the
   switches, and opens the dialogs. */
const fs = require("fs");
const vm = require("vm");

const target = process.argv[2];
const src = fs.readFileSync(target, "utf8");
const js = /<script>([\s\S]*?)<\/script>/.exec(src)[1];

let nodeCount = 0;
function makeNode(tag) {
  nodeCount++;
  const node = {
    tagName: String(tag || "div").toUpperCase(),
    children: [], attrs: {}, dataset: {},
    _class: "", _text: "", value: "", type: "", checked: false,
    disabled: false, draggable: false, readOnly: false, title: "", placeholder: "",
    rows: 0, min: 0, max: 0, step: 1, tabIndex: 0, listeners: {},
    /* a real property bag, so a checker can read back what the code set */
    style: (() => { const bag = {}; return {
      setProperty(k, v) { bag[k] = String(v); },
      removeProperty(k) { delete bag[k]; },
      getPropertyValue(k) { return bag[k] === undefined ? "" : bag[k]; } }; })(),
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    get className() { return this._class; },
    set className(v) { this._class = String(v || ""); },
    /* like the real thing: reading walks the subtree, and writing replaces it.
       Without the write clearing children, every re-render piled a second copy
       of the pane into the tree and a checker read the stale one. */
    get textContent() { return this._text + this.children.map(c => c.textContent).join(""); },
    set textContent(v) { this._text = v == null ? "" : String(v); this.children.length = 0; },
    get offsetWidth() { return 100; },
    appendChild(c) { this.children.push(c); c.parent = this; return c; },
    insertBefore(c, ref) {
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
      c.parent = this; return c;
    },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    remove() { if (this.parent) this.parent.removeChild(this); },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    removeEventListener() {},
    dispatch(t, ev) { (this.listeners[t] || []).forEach(fn => fn(ev || { preventDefault() {}, target: this, key: "" })); },
    focus() {}, blur() {}, select() {}, scrollIntoView() {}, click() { this.dispatch("click"); },
    closest() { return null },
    get scrollTop() { return 0; }, set scrollTop(_v) {},
    get isConnected() { return true; }
  };
  const walk = (n, out) => { n.children.forEach(c => { out.push(c); walk(c, out); }); return out; };
  node.insertAdjacentElement = function (where, other) {
    if (!this.parent) return other;
    const i = this.parent.children.indexOf(this);
    this.parent.children.splice(where === "afterend" ? i + 1 : i, 0, other);
    other.parent = this.parent;
    return other;
  };
  node.querySelectorAll = function (sel) {
    const all = walk(this, []);
    return all.filter(n => matches(n, sel));
  };
  node.querySelector = function (sel) { return this.querySelectorAll(sel)[0] || null; };
  node.empty = function () { this.children = []; };
  node.createEl = function (t, o) {
    const n = makeNode(t);
    if (o && o.text) n.textContent = o.text;
    if (o && o.cls) n.className = o.cls;
    return this.appendChild(n);
  };
  node.createDiv = function (o) { return this.createEl("div", o); };
  return node;
}
function matches(n, sel) {
  sel = String(sel).trim();
  if (sel.startsWith(".")) {
    const want = sel.slice(1).split(/[.\[]/)[0];
    return (" " + n.className + " ").includes(" " + want + " ") || n.classList.contains(want);
  }
  if (sel.startsWith("[data-")) {
    const m = /\[data-([a-z]+)="?([^"\]]*)"?\]/.exec(sel);
    return m ? n.dataset[m[1]] === m[2] : false;
  }
  return n.tagName === sel.toUpperCase();
}

const document = makeNode("document");
document.body = document.appendChild(makeNode("body"));
document.documentElement = makeNode("html");
const known = {};
["tabs", "content", "proto-hint", "opt-review", "opt-showall", "opt-comment", "opt-export", "opt-count"]
  .forEach(id => { known[id] = makeNode("div"); known[id].dataset.id = id; document.body.appendChild(known[id]); });
document.getElementById = id => known[id] || null;
document.createElement = makeNode;
document.createTextNode = t => { const n = makeNode("#text"); n.textContent = String(t); return n; };
document.addEventListener = () => {};
document.removeEventListener = () => {};
document.execCommand = () => true;

const store = {};
const sandbox = {
  document,
  window: { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } },
  requestAnimationFrame: fn => fn(),
  queueMicrotask: fn => fn(),
  setTimeout: (fn) => { try { fn(); } catch (_) {} return 0; },
  clearTimeout: () => {},
  console
};
sandbox.globalThis = sandbox;

let failures = 0;
const step = (what, fn) => {
  try { fn(); } catch (e) { console.log("  FAIL " + what + ": " + e.message); failures++; }
};

const ctxVm = vm.createContext(sandbox);
step("evaluate the script", () => vm.runInContext(js, ctxVm, { filename: "prototype.js" }));

if (!failures) {
  const run = expr => vm.runInContext(expr, ctxVm);
  const tabs = run("TABS.map(t => t.id)");
  for (const t of tabs) step("render tab " + t, () => run('selectTab("' + t + '")'));

  step("comment mode on", () => run("commentMode = true; renderContent();"));
  step("open the comment export", () => run("renderExport();"));
  step("comment mode off", () => run("commentMode = false; renderContent();"));
  step("show everything", () => run("showAll = true; renderContent(); showAll = false;"));

  step("turn every module off", () => run(
    'for (const p of Object.values(TAB_MODULE)) ctx.set(p, false);' +
    'for (const t of TABS.map(x => x.id)) selectTab(t);' +
    'for (const p of Object.values(TAB_MODULE)) ctx.set(p, true);'));

  step("open the smart-rule dialog", () => run(
    'selectTab("transform"); dialog = { ruleId: RULES[0].id, kind: "tag", op: "or",' +
    ' fieldName: pickValues("tag")[0].name, value: "" }; renderContent();'));

  step("walk the TagWheel", () => run(
    'selectTab("visual");' +
    'for (let i = 0; i < FIELDS.length + 2; i++) { wheelField = i % FIELDS.length; wheelValue = i; renderContent(); }'));

  step("select every field in the editor", () => run(
    'selectTab("pkm"); for (const f of FIELDS) { selectedFieldId = f.id; renderContent(); }'));

  step("every slider at both ends", () => run(
    'for (const g of SCHEMA) for (const it of g.items) if (it.kind === "slider") {' +
    '  ctx.set(it.path, it.min); ctx.set(it.path, it.max); ctx.set(it.path, it.default); }'));

  step("every dropdown through every option", () => run(
    'for (const g of SCHEMA) for (const it of g.items) if (it.kind === "dropdown")' +
    '  for (const o of it.options) ctx.set(it.path, o.value);'));

  step("every toggle both ways", () => run(
    'for (const g of SCHEMA) for (const it of g.items) if (it.kind === "toggle") {' +
    '  ctx.set(it.path, !it.default); ctx.set(it.path, it.default); }'));

  step("follow every seeAlso link", () => run(
    'for (const g of SCHEMA) for (const it of g.items) if (it.seeAlso) jumpTo(it.seeAlso.id);'));
}

console.log(failures
  ? "\n" + failures + " runtime failure(s)"
  : "\nsmoke test passed  (" + nodeCount + " nodes built)");
process.exit(failures ? 1 : 0);
