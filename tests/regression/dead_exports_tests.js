"use strict";

/**
 * Экспортированное имя, которого не зовёт никто — ни снаружи, ни внутри.
 *
 * **Зачем отдельная проверка.** Линтер к такому слеп по устройству: имя
 * «используется» тем, что стоит в `module.exports`, и `no-unused-vars` о нём
 * молчит. А цена мёртвого кода — не байты, а то, что его читают как живое
 * (У-95): 2026-09-11 так нашлись `runtimeEnglish` с комментарием «нужен ровно
 * одному месту» при нуле вызовов и два флага беты, которых не спрашивает
 * никто.
 *
 * **Три шага, и у каждого свой контроль** — потому что врёт обычно не поиск, а
 * разбор (У-119):
 *   1. что файл экспортирует — границы объекта считаются скобками, а не первой
 *      скобкой в нулевом столбце (У-96);
 *   2. зовут ли имя в другом файле — поиск по коду, из которого стёрты
 *      комментарии и строковые литералы: имя в объяснении вызовом не является
 *      (У-138);
 *   3. зовут ли его внутри своего файла — из всех упоминаний вычитается
 *      объявление и строка перечисления в `module.exports`. Первая версия
 *      считала «упоминаний не больше двух — мёртвое» и объявила мёртвыми пять
 *      живых `export function`: отдельной строки экспорта у них нет.
 *
 * Списка исключений здесь нет и быть не должно: мёртвых экспортов ноль.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
let passed = 0;
const ok = (label) => { passed++; console.log("  ok " + label); };

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) { walk(abs, out); continue; }
    if (/\.(?:js|ts|mjs)$/.test(name)) out.push(abs);
  }
  return out;
}

/** Код без комментариев и строковых литералов; кавычка не переживает строку (У-139). */
function codeOnly(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "//") { const nl = src.indexOf("\n", i); i = nl < 0 ? src.length : nl; continue; }
    if (two === "/*") { const end = src.indexOf("*/", i + 2); i = end < 0 ? src.length : end + 2; continue; }
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const lineEnd = src.indexOf("\n", i);
      const limit = ch === "`" ? src.length : (lineEnd < 0 ? src.length : lineEnd);
      let j = i + 1;
      while (j < limit) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === ch) { j += 1; break; }
        j += 1;
      }
      i = j;
      out += " ";
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Границы объекта — счётом скобок. */
function objectAfter(code, from) {
  const open = code.indexOf("{", from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") {
      depth -= 1;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  return null;
}

function exportsOf(code) {
  const names = new Set();
  const at = code.indexOf("module.exports");
  if (at >= 0) {
    const eq = code.indexOf("=", at);
    const between = code.slice(at + "module.exports".length, eq < 0 ? at : eq);
    if (/^\s*$/.test(between)) {
      const body = objectAfter(code, eq);
      if (body !== null) {
        let depth = 0;
        let entry = "";
        const entries = [];
        for (const ch of body) {
          if (ch === "{" || ch === "[" || ch === "(") depth += 1;
          if (ch === "}" || ch === "]" || ch === ")") depth -= 1;
          if (ch === "," && depth === 0) { entries.push(entry); entry = ""; continue; }
          entry += ch;
        }
        entries.push(entry);
        for (const one of entries) {
          const m = one.match(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::|$)/);
          if (m) names.add(m[1]);
        }
      }
    }
  }
  for (const m of code.matchAll(/module\.exports\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g)) names.add(m[1]);
  for (const m of code.matchAll(/^export function ([A-Za-z_$][A-Za-z0-9_$]*)/gm)) names.add(m[1]);
  for (const m of code.matchAll(/^export const ([A-Za-z_$][A-Za-z0-9_$]*)/gm)) names.add(m[1]);
  return names;
}

const all = walk(root, []);
const bodies = new Map();
for (const abs of all) bodies.set(abs, codeOnly(fs.readFileSync(abs, "utf8")));

const runtime = all.filter((abs) => {
  const rel = path.relative(root, abs).replace(/\\/g, "/");
  return !(rel.startsWith("tests/") || rel.startsWith("tools/")
    || rel.startsWith("build/") || rel.startsWith("docs/"));
});

function usedOutside(name, ownFile) {
  const rx = new RegExp("\\b" + name.replace(/[$]/g, "\\$") + "\\b");
  for (const [abs, code] of bodies) {
    if (abs === ownFile) continue;
    if (rx.test(code)) return path.relative(root, abs).replace(/\\/g, "/");
  }
  return null;
}

/*
 * Строка перечисления в `module.exports` ищется тем же счётом скобок, что и
 * сами имена. Первая версия искала объект выражением, которое требовало
 * перевода строки перед закрывающей скобкой, — и на однострочном
 * `module.exports = { say, noticeKey };` не находила ничего: имя без единого
 * вызова получало счёт «один» и в мёртвые не попадало. Поймал это контроль
 * ниже, а не чтение.
 */
function exportListOf(code) {
  const at = code.indexOf("module.exports");
  if (at < 0) return "";
  const eq = code.indexOf("=", at);
  if (eq < 0) return "";
  const between = code.slice(at + "module.exports".length, eq);
  if (!/^\s*$/.test(between)) return "";
  return objectAfter(code, eq) || "";
}

function usesInside(name, file) {
  const code = bodies.get(file);
  const rx = new RegExp("\\b" + name.replace(/[$]/g, "\\$") + "\\b", "g");
  const total = (code.match(rx) || []).length;
  const declared = new RegExp(
    "(?:^|\\n)\\s*(?:export\\s+)?(?:function|const|let|var|class)\\s+" + name + "\\b",
  ).test(code) ? 1 : 0;
  const listed = new RegExp("(?:^|[\\n,{\\s])" + name + "\\s*[,:}]|(?:^|[\\n,{\\s])" + name + "\\s*$")
    .test(exportListOf(code)) ? 1 : 0;
  return Math.max(0, total - declared - listed);
}

/* ---- контроль разбора --------------------------------------------------- */
{
  const probe = exportsOf(bodies.get(path.join(root, "src", "core", "active_editor.js")));
  assert.deepStrictEqual(Array.from(probe).sort(), ["activeEditorFrom", "markdownViewCtorFrom"],
    "контроль: разбор экспорта у active_editor.js даёт не те имена");
  const tags = exportsOf(bodies.get(path.join(root, "pkm_v2", "status_tags.js")));
  assert.ok(!tags.has("finalParsed") && !tags.has("cycleTokens"),
    "контроль: локальная переменная принята за экспортированное имя");
  ok("контроль разбора: границы объекта экспорта считаются скобками");
}

/* ---- контроль поиска ---------------------------------------------------- */
{
  assert.ok(usedOutside("activeEditorFrom", path.join(root, "src", "core", "active_editor.js")),
    "контроль: живой экспорт объявлен ничьим");
  assert.ok(!usedOutside("__imeniKotorogoNet", ""),
    "контроль: выдуманное имя найдено использованным");
  ok("контроль поиска: живое имя находится, выдуманное — нет");
}

/* ---- контроль счёта вызовов --------------------------------------------- */
{
  const view = path.join(root, "src", "ui", "settings", "custom", "fields_editor_view.ts");
  assert.strictEqual(usesInside("renderFieldList", view), 1,
    "контроль: у живого `export function` с одним вызовом счёт другой");
  const sample = path.join(root, "src", "core", "say.js");
  assert.strictEqual(usesInside("noticeKey", sample), 0,
    "контроль: имя, которое в своём файле только объявлено и экспортировано, считается незваным");
  ok("контроль счёта: объявление и строка экспорта вызовом не считаются");
}

/* ---- сам запрет --------------------------------------------------------- */
{
  const dead = [];
  let overExported = 0;
  let total = 0;
  for (const abs of runtime) {
    for (const name of exportsOf(bodies.get(abs))) {
      total += 1;
      if (usedOutside(name, abs)) continue;
      if (usesInside(name, abs) === 0) {
        dead.push(path.relative(root, abs).replace(/\\/g, "/") + " :: " + name);
      } else {
        overExported += 1;
      }
    }
  }
  assert.ok(total > 300,
    "положительный контроль: обход нашёл экспортированные имена (" + total + ")");
  assert.deepStrictEqual(dead, [],
    "экспортировано и не зовётся ни снаружи, ни внутри:\n  " + dead.join("\n  "));
  ok("мёртвых экспортов нет: имён " + total + ", из них наружу не спрашивают "
    + overExported + " — но внутри своего файла их зовут");
}

console.log("\n" + passed + " проверок пройдено");
