"use strict";

/**
 * Сколько правил объявлено в рантайме больше одного раза — и сколько из этих
 * объявлений настоящие, а не делегаты к общему дому.
 *
 * **Зачем в репозитории.** Число копий стареет быстрее всего, что есть в
 * документах (У-145): ревизия 2026-09-14 насчитала «семь мест» там, где их
 * оказалось сорок, потому что мерила одним написанием. Поэтому число живёт в
 * прогоне, а в документе стоит команда.
 *
 * Запуск (из `repo/`):
 *   node tools/rule_copies.js          — только настоящие копии
 *   node tools/rule_copies.js --all    — и делегаты тоже
 *
 * **Что считается копией.** Имя, объявленное в двух файлах рантайма, у
 * которого хотя бы два тела — не делегаты. Делегат — тело из одного `return`
 * с вызовом к модулю (`__sharedUtils.…`): оно спрашивает у того, кто правило
 * держит, и объявлением правила не является. Первая версия этого признака
 * искала делегата по **своему** имени и объявила копиями пять честных
 * делегатов: переименованный делегат зовёт общий дом другим именем.
 */
const fs = require("fs");
const path = require("path");

const ROOT = require("path").resolve(__dirname, "..");
const RUNTIME = ["main.js", "navigation_runtime.js", "pkm_runtime_v2.js", "src", "pkm_v2"];

function files() {
  const out = [];
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) { for (const n of fs.readdirSync(p)) walk(path.join(p, n)); return; }
    if (/\.(ts|js)$/.test(p)) out.push(p);
  };
  for (const e of RUNTIME) walk(path.join(ROOT, e));
  return out;
}

function mask(body) {
  const out = body.split("");
  const blank = (a, b) => { for (let i = a; i < b && i < out.length; i++) if (out[i] !== "\n") out[i] = " "; };
  const lineEnd = (from) => { const nl = body.indexOf("\n", from); return nl < 0 ? body.length : nl; };
  let i = 0;
  while (i < body.length) {
    const two = body.slice(i, i + 2);
    if (two === "//") { const e = lineEnd(i); blank(i, e); i = e; continue; }
    if (two === "/*") { const e = body.indexOf("*/", i + 2); blank(i, e < 0 ? body.length : e + 2); i = e < 0 ? body.length : e + 2; continue; }
    const ch = body[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const stop = lineEnd(i);
      let j = i + 1;
      while (j < stop) { if (body[j] === "\\") { j += 2; continue; } if (body[j] === ch) break; j++; }
      if (j >= stop) { i += 1; continue; }
      blank(i, j + 1); i = j + 1; continue;
    }
    i++;
  }
  return out.join("");
}

/* Тело объявления: от его открывающей скобки до парной, считая по маске. */
function bodyOf(src, masked, at) {
  const open = masked.indexOf("{", at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === "{") depth++;
    else if (masked[i] === "}") {
      depth--;
      if (!depth) return src.slice(at, i + 1);
    }
  }
  return null;
}

function declarations(src) {
  const masked = mask(src);
  const out = {};
  const re = /(?:^|\n)function ([A-Za-z0-9_$]+)\s*\(/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    const at = m.index + (m[0].startsWith("\n") ? 1 : 0);
    out[m[1]] = bodyOf(src, masked, at);
  }
  return out;
}

function norm(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function main() {
  /* Контроль до первого вывода (У-119): на известном куске разборщик обязан
     отдать тело целиком, а не до первой скобки внутри строки. */
  const probe = "function f(a) {\n  const s = \"}\";\n  return s;\n}\n";
  const got = declarations(probe).f;
  if (!got || got.indexOf("return s;") === -1) throw new Error("контроль: разборщик обрезал тело");

  const byName = {};
  for (const f of files()) {
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    const decls = declarations(fs.readFileSync(f, "utf8"));
    for (const name of Object.keys(decls)) {
      (byName[name] = byName[name] || []).push({ rel, body: decls[name] });
    }
  }

  /*
   * **Делегат — не копия.** Тело вида `return X.name(...)` объявлением правила
   * не является: оно спрашивает у того, кто правило держит. Без этого шага
   * обход объявляет расхождением каждую тонкую обёртку — а их здесь
   * большинство (У-142: контроль на каждый шаг обхода, а не на его вывод).
   */
  const isDelegate = (name, body) => {
    /*
     * Контроль на этот шаг был неверен и соврал первым же прогоном: делегат
     * искался по **своему** имени (`.name(`), а переименованный делегат зовёт
     * общий дом другим именем — и пять честных делегатов объявились копиями.
     * Признак делегата не имя, а форма: тело из одного `return` с вызовом.
     */
    const code = mask(String(body || ""));
    const inner = code.replace(/^[^{]*\{/, "").replace(/\}\s*$/, "");
    const stmts = inner.split(";").map((x) => x.trim()).filter(Boolean);
    if (stmts.length !== 1) return false;
    /* И вызов должен быть **к другому модулю**: `return String(s).replace(...)`
       это своя работа, а не делегирование. Модульные имена здесь одни —
       с двух подчёркиваний (`__sharedUtils` и подобные). */
    return /^return\s/.test(stmts[0]) && /(^|[^A-Za-z0-9_$])__[A-Za-z0-9_$]*\./.test(stmts[0]);
  };

  const broken = [];
  const twins = [];
  for (const name of Object.keys(byName)) {
    const rows = byName[name];
    for (const r of rows) if (r.body === null) broken.push(name + " в " + r.rel);
    if (rows.length < 2) continue;
    const real = rows.filter((r) => !isDelegate(name, r.body));
    const same = rows.every((r) => norm(r.body) === norm(rows[0].body));
    twins.push({ name, rows, same, real: real.length, delegates: rows.length - real.length });
  }

  if (broken.length) {
    console.log("!!! скобки не сошлись, эти места решает человек: " + broken.join(", "));
  }
  const SHOW_ALL = process.argv.includes("--all");
  const copies = twins.filter((t) => SHOW_ALL || t.real > 1);
  console.log("имён, объявленных больше одного раза: " + twins.length
    + "; из них с двумя и более настоящими объявлениями: " + copies.length
    + " (остальные — делегаты к общему дому)");
  console.log("");
  copies.sort((a, b) => (a.same === b.same ? 0 : a.same ? -1 : 1));
  for (const t of copies) {
    console.log((t.same ? "ТОЧНАЯ КОПИЯ  " : "расходятся    ") + t.name
      + "   настоящих " + t.real + ", делегатов " + t.delegates
      + "   " + t.rows.map((r) => r.rel).join("  |  "));
  }
}

main();
