"use strict";
/* The prototype is the source of truth for the copy and the structure, so the
   PRD's inventory is generated from it rather than retyped. */
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
const out = process.argv[3];
const src = fs.readFileSync(target, "utf8");
const js = /<script>([\s\S]*?)<\/script>/.exec(src)[1];

const cut = js.indexOf("/* ============================================================ State */");
const stubNames = (js.match(/render:\s*([A-Za-z0-9_]+)/g) || [])
  .map(s => s.replace(/render:\s*/, ""));
const stubs = [...new Set(stubNames)].map(n => "function " + n + "(){}").join("\n");

const tmp = path.join(__dirname, "_dump_mod.js");
fs.writeFileSync(tmp, stubs + "\n" + js.slice(0, cut) +
  "\nmodule.exports={SCHEMA,TABS,TAB_MODULE,FIELDS};\n", "utf8");
const { SCHEMA, TABS, TAB_MODULE } = require(tmp);
fs.unlinkSync(tmp);

const L = [];
const esc = t => String(t).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const def = v => {
  if (v === undefined) return "—";
  if (typeof v === "string") return v === "" ? '`""`' : "`" + v + "`";
  return "`" + JSON.stringify(v) + "`";
};
const pred = p => p ? "`" + p.deps.join(", ") + "`" : "";

/* ---- 1. the tabs and groups, in the order the pane renders them ---- */
L.push("### Вкладки и группы (снято с прототипа)\n");
L.push("| # | Вкладка | Тумблер модуля | Групп | Настроек | Своих блоков |");
L.push("|---|---------|----------------|-------|----------|--------------|");
TABS.forEach((t, i) => {
  const gs = SCHEMA.filter(g => g.tab === t.id);
  const items = gs.flatMap(g => g.items);
  L.push("| " + (i + 1) + " | " + t.label + " | " +
    (TAB_MODULE[t.id] ? "`" + TAB_MODULE[t.id] + "`" : "—") + " | " +
    gs.length + " | " + items.filter(x => x.kind !== "custom").length + " | " +
    items.filter(x => x.kind === "custom").length + " |");
});

L.push("\n### Группы по порядку\n");
TABS.forEach(t => {
  L.push("\n**" + t.label + "** (`" + t.id + "`)\n");
  L.push("| order | id | Заголовок | Intro | Tip | Видимость зависит от |");
  L.push("|-------|----|-----------|-------|-----|----------------------|");
  SCHEMA.filter(g => g.tab === t.id)
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach(g => {
      L.push("| " + g.order + " | `" + g.id + "` | " + esc(g.heading || "—") + " | " +
        (g.intro ? esc(g.intro) : "—") + " | " + (g.tip ? "да" : "—") + " | " +
        (pred(g.visible) || "—") + " |");
    });
});

/* ---- 2. every setting, with its copy ---- */
L.push("\n### Полная опись настроек\n");
SCHEMA.slice().sort((a, b) => (a.tab + String(a.order).padStart(4, "0"))
  .localeCompare(b.tab + String(b.order).padStart(4, "0"))).forEach(g => {
  L.push("\n#### " + g.heading + " — `" + g.id + "` (вкладка `" + g.tab + "`)\n");
  if (g.intro) L.push("_Intro:_ " + g.intro + "\n");
  if (g.tip) L.push("_Tip:_ " + g.tip + "\n");
  g.items.forEach(it => {
    if (it.kind === "custom") {
      L.push("- **`" + it.id + "`** — свой блок, рендерер `" + (it.render && it.render.name || "?") + "`");
      return;
    }
    const bits = [];
    bits.push("- **" + it.name + "** — `" + it.id + "`, `" + it.kind + "`");
    if (it.path) bits.push("path `" + it.path + "`, default " + def(it.default));
    L.push(bits.join(", "));
    if (it.desc) L.push("  - desc: " + it.desc);
    if (it.tip) L.push("  - tip: " + it.tip);
    if (it.options) L.push("  - варианты: " + it.options.map(o => "`" + o.value + "` " + o.label).join(" · "));
    if (it.min !== undefined) L.push("  - диапазон: " + it.min + "–" + it.max + ", шаг " + (it.step || 1) +
      (it.unit ? ", ед. " + it.unit : ""));
    if (it.buttons) L.push("  - кнопки: " + it.buttons.map(b => "`" + b.action + "` " + b.label).join(" · "));
    if (it.visible) L.push("  - видна если: `" + it.visible.deps.join(", ") + "`");
    if (it.disabled) L.push("  - выключена если: `" + it.disabled.deps.join(", ") + "`");
    if (it.seeAlso) L.push("  - см. также: `" + it.seeAlso.id + "` — " + it.seeAlso.label);
    if (it.searchTerms) L.push("  - старые названия для поиска: " + it.searchTerms.map(s => "«" + s + "»").join(", "));
  });
});

/* ---- 3. the paths, as a flat contract ---- */
L.push("\n### Все пути состояния\n");
L.push("| path | kind | default |");
L.push("|------|------|---------|");
SCHEMA.flatMap(g => g.items).filter(it => it.path)
  .sort((a, b) => a.path.localeCompare(b.path))
  .forEach(it => L.push("| `" + it.path + "` | " + it.kind + " | " + def(it.default) + " |"));

fs.writeFileSync(out, L.join("\n") + "\n", "utf8");
const items = SCHEMA.flatMap(g => g.items);
console.log("dumped " + SCHEMA.length + " groups, " +
  items.filter(i => i.kind !== "custom").length + " settings, " +
  items.filter(i => i.kind === "custom").length + " custom blocks to " + out);
