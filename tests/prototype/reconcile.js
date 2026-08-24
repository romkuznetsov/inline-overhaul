"use strict";
/* The PRD's old inventory and the approved prototype have to agree. Match them
   on the config path, which is the one key both sides carry, and report every
   row that exists on only one side. */
const fs = require("fs");
const path = require("path");

const protoPath = process.argv[3];
const out = process.argv[4];

/* ---- the prototype side ---- */
const src = fs.readFileSync(protoPath, "utf8");
const js = /<script>([\s\S]*?)<\/script>/.exec(src)[1];
const cut = js.indexOf("/* ============================================================ State */");
const stubs = [...new Set((js.match(/render:\s*([A-Za-z0-9_]+)/g) || [])
  .map(s => s.replace(/render:\s*/, "")))].map(n => "function " + n + "(){}").join("\n");
const tmp = path.join(__dirname, "_rec_mod.js");
fs.writeFileSync(tmp, stubs + "\n" + js.slice(0, cut) + "\nmodule.exports={SCHEMA};\n", "utf8");
const { SCHEMA } = require(tmp);
fs.unlinkSync(tmp);

const proto = new Map();
for (const g of SCHEMA) {
  for (const it of g.items) {
    if (it.path) proto.set(it.path, { id: it.id, name: it.name, group: g.heading, tab: g.tab, terms: it.searchTerms || [] });
  }
}

/* ---- the version 1 side: the frozen extract of the PRD 1.0 inventory ----
   PRD 1.1 no longer carries those tables, so the rows live in a data file
   next to this script. It records the past and is not edited. */
const tsv = fs.readFileSync(path.join(__dirname, "v1_inventory.tsv"), "utf8");
const rows = [];
for (const line of tsv.split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const [heading, v1, was, becameName, becameDesc, pathCell] = line.split("\t");
  rows.push({ heading, v1, was, becameName, becameDesc, pathCell });
}

const clean = c => c.replace(/`/g, "").trim();

/* Renames the prototype settled after the PRD was written. Left side is the
   path the PRD v1.0 planned, right side is the path the prototype uses. */
const RENAMED = {
  "visual.hierarchyBars.": "visual.tagBars."
};
/* Rows with no path in the PRD, or a path the prototype dropped on purpose. */
const BY_HAND = {
  "Main checkbox priority": "pkm.prefixPriority.decideBy",
  "Fields order mode": "pkm.prefixPriority.fieldOrderSource",
  "Tag/Subtag priority": "pkm.prefixPriority.parentOrChild",
  "TagWheel Note Editor": "pkm.configNote.path"
};
const DROPPED = {
  "YAML note format": "снято сознательно: заменено правилом Raw/Clean у каждого Value (10.2)",
  "Active Rules Path": "снято из UI сознательно: путь остаётся внутренним (9.24)",
  "Regenerate Rules Now": "остаётся кнопкой без path в группе Generated files",
  "Open Detailed Template": "остаётся кнопкой без path в группе Note content",
  "Prefix Cycle Order": "переехало в свой блок renderCycleOrder, path сохраняется"
};

const kept = [], gone = [], deleted = [];
for (const r of rows) {
  let p = clean(r.pathCell);
  for (const [from, to] of Object.entries(RENAMED)) {
    if (p.startsWith(from)) p = to + p.slice(from.length);
  }
  if (/^DELETE/.test(p) || r.becameName === "—") { deleted.push(r); continue; }
  const wasName = clean(r.was).split(" / ")[0].replace(/ \(.*$/, "").trim();
  if (BY_HAND[wasName]) p = BY_HAND[wasName];
  if (proto.has(p)) { kept.push({ ...r, p, hit: proto.get(p) }); continue; }
  /* second try: the old name is in searchTerms, which is how a user finds it */
  let byTerm = null;
  for (const [pp, v] of proto.entries()) {
    if (v.terms.some(t => t.toLowerCase() === wasName.toLowerCase())) { byTerm = [pp, v]; break; }
  }
  if (byTerm) { kept.push({ ...r, p: byTerm[0], hit: byTerm[1], viaTerm: true }); continue; }
  gone.push({ ...r, p, note: DROPPED[wasName] || "" });
}
const seen = new Set(kept.map(r => r.p));
const added = [...proto.entries()].filter(([p]) => !seen.has(p));

const L = [];
const esc = t => String(t).replace(/\|/g, "\\|");
L.push("## Сверка описи PRD v1.0 с согласованным прототипом\n");
L.push("Ключ сверки — путь в конфиге. Строк в старой описи: " + rows.length +
  "; из них помечено к удалению: " + deleted.length + ".\n");
L.push("| итог | v1 | было | путь | стало в прототипе |");
L.push("|------|----|------|------|--------------------|");
kept.forEach(r => L.push("| перенесено" + (r.viaTerm ? " (по searchTerms)" : "") + " | " + r.v1 + " | " +
  esc(r.was) + " | `" + r.p + "` | " + esc(r.hit.name) + " (`" + r.hit.id + "`, " + esc(r.hit.group) + ") |"));
gone.forEach(r => L.push("| " + (r.note ? "снято" : "**требует решения**") + " | " + r.v1 + " | " +
  esc(r.was) + " | `" + r.p + "` | " + (r.note || "**нет соответствия в прототипе**") + " |"));
deleted.forEach(r => L.push("| удалено | " + r.v1 + " | " + esc(r.was) + " | " + esc(r.pathCell) + " | — |"));

L.push("\n### Пути, которых не было в описи v1.0 (" + added.length + ")\n");
L.push("| путь | настройка | группа |");
L.push("|------|-----------|--------|");
added.forEach(([p, v]) => L.push("| `" + p + "` | " + esc(v.name) + " (`" + v.id + "`) | " + esc(v.group) + " |"));

fs.writeFileSync(out, L.join("\n") + "\n", "utf8");
console.log("старых строк: " + rows.length + "  перенесено: " + kept.length +
  "  помечено удалить: " + deleted.length + "  потерялось: " + gone.length +
  "  новых путей: " + added.length);
