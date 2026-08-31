"use strict";

/**
 * Карта чтений настроек в движках: где рантайм читает пути версии 1.
 *
 * Зачем скрипт, а не список файлом: замороженный текст через неделю разойдётся
 * с кодом и будет врать молча. Тот же довод, что у карты записей в В-5.
 *
 * Источник маршрутов — сама миграция (`ROUTES` в `config_migration_v2.ts`),
 * второй копии карты в проекте нет и быть не должно (М-2).
 *
 * Ищется не путь целиком — в коде он разорван опциональными цепочками и
 * скобками, — а связка «родительский сегмент + лист».
 *
 *   node tools/read_map_v1.js . read_map.md
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2] || ".";
const DEST = process.argv[3] || path.join(ROOT, "read_map.md");
const MIG = path.join(ROOT, "src", "core", "config_migration_v2.ts");

const src = fs.readFileSync(MIG, "utf8");

/* --- маршруты, у которых путь меняется -------------------------------- */

const moves = [];
const reMove = /move\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
let m;
while ((m = reMove.exec(src))) moves.push({ from: m[1], to: m[2] });

const drops = [];
const reDrop = /\bdrop\(\s*"([^"]+)"\s*\)/g;
while ((m = reDrop.exec(src))) drops.push(m[1]);

/* --- где искать -------------------------------------------------------- */

const AREAS = [
  "pkm_v2",
  "navigation_runtime.js",
  "pkm_runtime_v2.js",
  "src/core",
  "src/features",
  "main.js",
];

const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build"]);
const files = [];

function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (SKIP_DIR.has(path.basename(p))) return;
    for (const e of fs.readdirSync(p)) walk(path.join(p, e));
    return;
  }
  if (!/\.(js|ts|mjs|cjs)$/.test(p)) return;
  /* Сама карта маршрутов — не чтение, а источник списка. */
  if (/config_migration_v2\.ts$/.test(p)) return;
  files.push(p);
}

for (const area of AREAS) {
  const p = path.join(ROOT, area);
  if (fs.existsSync(p)) walk(p);
}

const texts = new Map();
for (const f of files) texts.set(f, fs.readFileSync(f, "utf8").split(/\r?\n/));

/**
 * Признак чтения пути в коде. `pkm.behavior.io.separator1` встречается как
 * `pkm.behavior.io.separator1`, `?.io?.separator1`, `["separator1"]`,
 * `io: { separator1 }`. Берутся два последних сегмента, между ними
 * допускается любой разделитель доступа.
 */
function probes(dotted) {
  const seg = dotted.split(".");
  const leaf = seg[seg.length - 1];
  const parent = seg.length > 1 ? seg[seg.length - 2] : "";
  const acc = "\\s*[?.\\[\"']*\\s*";
  const strict = parent ? new RegExp(parent + acc + leaf) : null;
  const loose = new RegExp("[.\\[\"'`]\\s*" + leaf + "\\b");
  return { leaf, parent, strict, loose };
}

const rows = [];
const all = moves.map((x) => ({ from: x.from, to: x.to, kind: "move" }))
  .concat(drops.map((x) => ({ from: x, to: "—", kind: "drop" })));

for (const r of all) {
  const { leaf, parent, strict, loose } = probes(r.from);
  const hitsStrict = [];
  const hitsLoose = [];
  for (const [f, lines] of texts) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (strict && strict.test(line)) {
        hitsStrict.push([f, i + 1, line.trim().slice(0, 160)]);
        continue;
      }
      if (loose.test(line)) hitsLoose.push([f, i + 1, line.trim().slice(0, 160)]);
    }
  }
  rows.push({ from: r.from, to: r.to, kind: r.kind, leaf, parent, hitsStrict, hitsLoose });
}

/* --- отчёт -------------------------------------------------------------- */

const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");

const withStrict = rows.filter((r) => r.hitsStrict.length);
const onlyLoose = rows.filter((r) => !r.hitsStrict.length && r.hitsLoose.length);
const clean = rows.filter((r) => !r.hitsStrict.length && !r.hitsLoose.length);

let out = "";
out += "# Карта чтений: пути версии 1 в движках\n\n";
out += "Собрано `tools/read_map_v1.js` из `ROUTES` миграции. Правится не этот файл, а код.\n\n";
out += "Маршрутов со сменой пути: " + moves.length + ". Удаляемых веток: " + drops.length + ".\n";
out += "Просмотрено файлов: " + files.length + ".\n\n";

out += "## Сводка\n\n";
out += "- точных совпадений (родитель+лист): **" + withStrict.length + "** маршрутов\n";
out += "- только по имени листа, смотреть глазами: **" + onlyLoose.length + "**\n";
out += "- ни одного совпадения: **" + clean.length + "**\n\n";

const perFile = new Map();
for (const r of withStrict) {
  for (const [f] of r.hitsStrict) perFile.set(rel(f), (perFile.get(rel(f)) || 0) + 1);
}
out += "## Файлы по числу чтений\n\n";
for (const [f, c] of [...perFile].sort((a, b) => b[1] - a[1])) {
  out += "- `" + f + "` — " + c + "\n";
}
out += "\n";

out += "## Точные совпадения\n\n";
for (const r of withStrict) {
  out += "### `" + r.from + "` → `" + r.to + "` (" + r.kind + ", " + r.hitsStrict.length + ")\n\n";
  const byFile = new Map();
  for (const [f, n, t] of r.hitsStrict) {
    if (!byFile.has(f)) byFile.set(f, []);
    byFile.get(f).push([n, t]);
  }
  for (const [f, hs] of byFile) {
    out += "- `" + rel(f) + "` — " + hs.map((h) => h[0]).join(", ") + "\n";
    for (const [n, t] of hs.slice(0, 4)) out += "  - :" + n + " `" + t + "`\n";
    if (hs.length > 4) out += "  - …и ещё " + (hs.length - 4) + "\n";
  }
  out += "\n";
}

out += "## Только по имени листа\n\n";
for (const r of onlyLoose) {
  const byFile = new Map();
  for (const [f] of r.hitsLoose) byFile.set(rel(f), (byFile.get(rel(f)) || 0) + 1);
  out += "- `" + r.from + "` → `" + r.to + "` — лист `" + r.leaf + "`: "
    + [...byFile].map(([f, c]) => f + " (" + c + ")").join(", ") + "\n";
}
out += "\n";

out += "## Ни одного совпадения\n\n";
for (const r of clean) out += "- `" + r.from + "` → `" + r.to + "`\n";

fs.writeFileSync(DEST, out, "utf8");
console.log("маршрутов: " + rows.length + ", файлов: " + files.length);
console.log("точных: " + withStrict.length
  + ", только лист: " + onlyLoose.length
  + ", пусто: " + clean.length);
console.log("отчёт: " + DEST);
