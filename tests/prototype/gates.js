"use strict";
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
const src = fs.readFileSync(target, "utf8");
const js = /<script>([\s\S]*?)<\/script>/.exec(src)[1];
const css = /<style>([\s\S]*?)<\/style>/.exec(src)[1];

// evaluate the schema half only: stub the renderers, cut before State
const cut = js.indexOf("/* ============================================================ State */");
const stubs = [
  "renderLinePreview", "renderFieldEditor", "renderTagPreview", "renderBarsPreview",
  "renderWheelPreview", "renderBinder", "renderSmartRules", "renderCommandReference",
  "renderNavCallout", "renderLeftRightOrder", "renderFieldOrderList", "renderPrefixOrderList",
  "renderCycleOrder", "renderYamlMapping", "renderFloatingButton", "renderTabCallout"
].map(n => "function " + n + "(){}").join("\n");

const tmp = path.resolve(path.dirname(path.resolve(target)), "_gate_mod.js");
fs.writeFileSync(tmp,
  stubs + "\n" + js.slice(0, cut) +
  "\nmodule.exports={SCHEMA,TABS,TAB_MODULE};\n", "utf8");

const { SCHEMA, TABS, TAB_MODULE } = require(tmp);
fs.unlinkSync(tmp);

let fail = 0;
const bad = m => { console.log("  FAIL " + m); fail++; };

/* Sentence case, with one exception the owner set: anything InlineOverhaul
   itself defines is a proper noun, so a reader can tell the Bar the plugin
   draws from a bar in general. Obsidian's words and plain English are not. */
const ENTITIES = ["Field","Fields","Value","Values","Bar","Bars","Prefix","Prefixes",
  "Separator","Separators","Block","Blocks","TagWheel","Binder","Transform","Wheel"];
const PROPER = new Set(["Obsidian","Markdown","YAML","Ctrl","Cmd","Inline","Dataview",
  "Status","Priority","Strict","Free","Behavior","Position","PKM","I","Smart","Rules","Level"]);
const CASE_OK = new Set([...ENTITIES, ...PROPER]);

/* The same rule read backwards: an entity written in lower case is the bug
   this convention exists to prevent, so catch it too. */
const LOWER = /(?<![A-Za-z#\/-])(fields?|values?|bars?|prefix(?:es)?|separators?|tagwheel)(?![A-Za-z-])/g;
const outsideCode = t => t.replace(/<code>[\s\S]*?<\/code>/g, "");
const lowerEntities = t => [...new Set((outsideCode(t).match(LOWER) || []))];


/* Two definitions of the same function is worse than none: the file parses,
   the gate passes, and the later one silently wins. */
{
  const seen = {};
  const re = /^function ([A-Za-z0-9_]+)\s*\(/gm;
  let m;
  while ((m = re.exec(js))) {
    const line = js.slice(0, m.index).split("\n").length;
    (seen[m[1]] = seen[m[1]] || []).push(line);
  }
  for (const [name, lines] of Object.entries(seen)) {
    if (lines.length > 1) bad(name + " is defined " + lines.length + " times, at lines " + lines.join(", "));
  }
}

/* The renderers are stubbed above so the schema can be evaluated, which means
   a deleted renderer would pass unnoticed. Check each one really exists. */
for (const name of js.match(/render:\s*([A-Za-z0-9_]+)/g) || []) {
  const fn = name.replace(/render:\s*/, "");
  if (!new RegExp("function\\s+" + fn + "\\s*\\(").test(js)) {
    bad("schema points at render: " + fn + ", which is not defined in the file");
  }
}
/* Same for every other bare call the renderers rely on. */
for (const fn of ["moveIn", "sortableList", "hotkeyCell", "commentAffordance", "helpButton",
                  "fieldValue", "structuralLine", "fieldChip", "bubble", "applyTagVars",
                  "valuesTable", "elementRows", "placementRows", "renderDialog", "renderExport"]) {
  if (new RegExp("[^A-Za-z0-9_]" + fn + "\\s*\\(").test(js) &&
      !new RegExp("function\\s+" + fn + "\\s*\\(").test(js)) {
    bad(fn + " is called but never defined");
  }
}

const KINDS = new Set(["toggle","dropdown","slider","number","text","textarea","color","buttons","custom"]);
const ids = new Set();
for (const g of SCHEMA) {
  if (ids.has(g.id)) bad("duplicate group id " + g.id); else ids.add(g.id);
  for (const it of g.items) {
    if (ids.has(it.id)) bad("duplicate id " + it.id); else ids.add(it.id);
    if (!KINDS.has(it.kind)) bad(it.id + " unknown kind " + it.kind);
  }
}
const tabIds = new Set(TABS.map(t => t.id));
for (const g of SCHEMA) if (!tabIds.has(g.tab)) bad("group " + g.id + " unknown tab " + g.tab);
for (const t of TABS) if (!SCHEMA.some(g => g.tab === t.id)) bad("tab " + t.id + " has no groups");

// Г7: every path has a default, every predicate dep is a real path
const defaults = {};
const setIn = (o, p, v) => {
  const k = p.split("."); let c = o;
  for (let i = 0; i < k.length - 1; i++) c = (c[k[i]] = c[k[i]] || {});
  c[k[k.length - 1]] = v;
};
const getIn = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
for (const g of SCHEMA) for (const it of g.items) if (it.path) setIn(defaults, it.path, it.default);
setIn(defaults, "general.help.showTips", true);
const known = new Set();
for (const g of SCHEMA) for (const it of g.items) if (it.path) known.add(it.path);
for (const p of known) if (getIn(defaults, p) === undefined) bad("path has no default: " + p);
const checkPred = (owner, pr) => {
  if (!pr) return;
  if (!Array.isArray(pr.deps) || !pr.deps.length) bad(owner + " predicate has no deps");
  for (const d of pr.deps || []) if (!known.has(d)) bad(owner + " depends on unknown path " + d);
};
for (const g of SCHEMA) {
  checkPred("group " + g.id, g.visible);
  for (const it of g.items) { checkPred(it.id, it.visible); checkPred(it.id, it.disabled); }
}
for (const [t, p] of Object.entries(TAB_MODULE)) if (!known.has(p)) bad("tab gate " + t + " unknown path " + p);

// seeAlso targets must exist
for (const g of SCHEMA) for (const it of g.items) {
  if (it.seeAlso && !ids.has(it.seeAlso.id)) bad(it.id + " seeAlso points at unknown id " + it.seeAlso.id);
}

// Г11 group size, Г12 every group has an intro
for (const g of SCHEMA) {
  if (g.intro) {
    const low = lowerEntities(g.intro);
    if (low.length) bad("group " + g.id + " intro leaves an entity in lower case: " + low.join(", "));
  }
  if (g.tip) {
    const low = lowerEntities(g.tip);
    if (low.length) bad("group " + g.id + " tip leaves an entity in lower case: " + low.join(", "));
  }
  const n = g.items.filter(i => i.kind !== "custom").length;
  if (n > 12) bad("group " + g.id + " has " + n + " settings");
  if (!g.intro && !/-intro$/.test(g.id)) bad("group " + g.id + " has no intro");
}

// Г10 copy lint
const FORBIDDEN = ["inlineOverhaul_", "Command ID", "debounce", "undo stack", "runtime", "backend",
  "sprint", "status_tags", ".js", "free roam", " zone", "Segment", "Marker priority"];
let total = 0, custom = 0, tips = 0, described = 0;
const perTab = {};
for (const g of SCHEMA) for (const it of g.items) {
  if (it.kind === "custom") { custom++; continue; }
  total++; perTab[g.tab] = (perTab[g.tab] || 0) + 1;
  const words = it.name.split(" ");
  if (words.length > 5) bad(it.id + " name over 5 words: " + it.name);
  words.slice(1).forEach(w => {
    const c = w.replace(/[^A-Za-z]/g, "");
    if (c && c[0] === c[0].toUpperCase() && c[0] !== c[0].toLowerCase() && !CASE_OK.has(c)) {
      bad(it.id + " name not sentence case: " + it.name);
    }
  });
  if (it.desc) {
    described++;
    if (it.desc.length > 140) bad(it.id + " desc " + it.desc.length + " chars");
    /* the owner's rule: a visible string does not end in a full stop */
    if (/\.$/.test(it.desc)) bad(it.id + " desc ends in a full stop: " + it.desc.slice(-40));
    for (const f of FORBIDDEN) if (it.desc.includes(f)) bad(it.id + " desc contains: " + f);
    const lowDesc = lowerEntities(it.desc);
    if (lowDesc.length) bad(it.id + " desc leaves an entity in lower case: " + lowDesc.join(", "));
    if (it.desc.toLowerCase() === it.name.toLowerCase()) bad(it.id + " desc repeats name");
  }
  if (it.tip) {
    tips++;
    for (const f of FORBIDDEN) if (it.tip.includes(f)) bad(it.id + " tip contains: " + f);
    const lowTip = lowerEntities(it.tip);
    if (lowTip.length) bad(it.id + " tip leaves an entity in lower case: " + lowTip.join(", "));
  }
  if (it.options) it.options.forEach(o => {
    if (/_/.test(o.label)) bad(it.id + " option label has an underscore: " + o.label);
  });
}

/* Appending a new rule instead of editing the old one is how a stylesheet
   ends up with four blocks fighting over one class. Two is a warning sign,
   three is a bug waiting to surface. */
{
  const counts = {};
  /* a responsive override inside @media is deliberate, not accretion, so
     those blocks come out before counting */
  const flat = css.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, "");
  for (const m of flat.matchAll(/^\s*(\.[a-zA-Z0-9_-]+(?:::?[a-zA-Z-]+)?)\s*(?:,|\{)/gm)) {
    counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  for (const [sel, n] of Object.entries(counts)) {
    if (n > 2) bad("the selector " + sel + " is declared " + n + " times; collapse it into one rule");
  }
}

// Г1-Г5 on the stylesheet and the script
const styleAssignments = (js.match(/\.style\.setProperty/g) || []).length;
// only setProperty is allowed; anything else is a direct style write
const otherStyle = (js.match(/\.style\.(?!setProperty)[a-zA-Z]/g) || []).length;
if (otherStyle > 0) bad("script sets " + otherStyle + " style properties directly (only setProperty is allowed)");
const hexInJs = (js.match(/#[0-9a-fA-F]{6}\b/g) || []);
const hexAllowed = 42;   // mock vault colors, the three type colors, and TagWheel defaults
if (hexInJs.length > hexAllowed) bad("script has " + hexInJs.length + " hex colours, over the " + hexAllowed + " mock-data budget");
if (/innerHTML|outerHTML|insertAdjacentHTML/.test(js)) bad("script uses raw HTML insertion");
if (/new Function|eval\(/.test(js)) bad("script evaluates code");
if (/createEl\(["']h[1-6]["']/.test(js)) bad("script creates a raw heading element");
// as a class, not as a mention in a comment
if (/["']mod-cta["']|\.mod-cta\s*[{,]/.test(js + css)) bad("mod-cta is used as a class");
if (/cfg\.ui\./.test(js)) bad("script reads cfg.ui");

console.log("settings: " + total + " (+" + custom + " custom blocks)");
console.log("described: " + described + ", with tips: " + tips);
console.log("groups: " + SCHEMA.length + ", tabs: " + TABS.length);
console.log("per tab: " + JSON.stringify(perTab));
console.log("setProperty calls: " + styleAssignments + ", hex colours in mock data: " + hexInJs.length);
console.log(fail ? ("\n" + fail + " problem(s)") : "\nall gates passed");
process.exit(fail ? 1 : 0);
