"use strict";

/**
 * Что из рантайма не исполняет ни один прогон набора.
 *
 * **Зачем.** Семь шагов отвечают на «работает ли то, что проверяют», и молчат
 * про то, чего не исполняют вовсе. Мёртвый экспорт видит `dead_exports_tests`,
 * но живое имя, до которого не доходит ни одна фикстура, оно считает живым
 * (У-148). Здесь мера снимается **V8**, а не разбором кода: свой разборщик на
 * этом уже врал (У-139).
 *
 * **Как гонять, две команды:**
 *
 *   NODE_V8_COVERAGE=<папка> npm test
 *   node tools/coverage_map.js <папка>
 *
 * **Оговорка, без которой число врёт.** «Набор» тут — `npm test`, шесть шагов
 * из семи. Браузерный шаг поднимает слой редактора в Chromium, и его покрытие
 * сюда не попадает: часть непокрытых исполняется **там**. И функции точки
 * входа исполняются в `dist/main.js` — по исходнику они выглядят непокрытыми,
 * это одно имя в двух файлах (У-148 в сторону самой меры).
 *
 * Гейтом не является и числа не стережёт: число это растёт и падает от обычной
 * работы, а порог на нём был бы порогом на чужой машине (У-145). Это
 * инструмент ревизии — разбор 2026-09-14 в `docs/CODE_REVIEW_2026-09-14.md`.
 */

const fs = require("fs");
const path = require("path");
/* `URL` берётся у модуля, а не у глобали: `no-undef` здесь ошибка (A42). */
const { URL } = require("url");

const COV = process.argv[2];
const ROOT = require("path").resolve(__dirname, "..");

/** Все записи покрытия по файлам рантайма. */
function load() {
  const byFile = new Map();
  for (const name of fs.readdirSync(COV)) {
    if (!/\.json$/.test(name)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(COV, name), "utf8")); } catch (_) { continue; }
    for (const entry of data.result || []) {
      const url = String(entry.url || "");
      if (!url.startsWith("file:")) continue;
      let file;
      try { file = decodeURIComponent(new URL(url).pathname).replace(/^\//, ""); } catch (_) { continue; }
      file = file.replace(/\\/g, "/");
      if (file.indexOf("/node_modules/") >= 0) continue;
      if (file.indexOf("/tests/") >= 0) continue;
      const rel = file.startsWith(ROOT.replace(/\\/g, "/") + "/")
        ? file.slice(ROOT.replace(/\\/g, "/").length + 1)
        : null;
      if (!rel) continue;
      if (!/^(src\/|pkm_v2\/|[A-Za-z_]+\.js$)/.test(rel)) continue;
      if (!byFile.has(rel)) byFile.set(rel, new Map());
      const fns = byFile.get(rel);
      for (const fn of entry.functions || []) {
        const name2 = fn.functionName || "(анонимная)";
        const range = fn.ranges && fn.ranges[0] ? fn.ranges[0] : null;
        if (!range) continue;
        const key = name2 + "@" + range.startOffset;
        const prev = fns.get(key) || { name: name2, start: range.startOffset, end: range.endOffset, count: 0 };
        prev.count += Number(range.count) || 0;
        fns.set(key, prev);
      }
    }
  }
  return byFile;
}

function lineOf(src, offset) { return src.slice(0, offset).split("\n").length; }

/**
 * Имена, исполненные в **сборке**.
 *
 * `bundle_onload_tests.ts` зовёт `onload` у `dist/main.js`, и функции точки
 * входа работают там. По исходнику они выглядят непокрытыми — это одно имя в
 * двух файлах, У-148 в сторону самой меры. Первая версия этого обхода насчитала
 * так 88 лишних, и поймал её не разбор, а контроль ниже.
 */
function bundleNames() {
  const out = new Set();
  for (const name of fs.readdirSync(COV)) {
    if (!/\.json$/.test(name)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(COV, name), "utf8")); } catch (_) {
      /* Проба: файл покрытия может быть дописан не до конца. */
      continue;
    }
    for (const entry of data.result || []) {
      if (String(entry.url || "").indexOf("/dist/main.js") < 0) continue;
      for (const fn of entry.functions || []) {
        const r = fn.ranges && fn.ranges[0];
        if (r && r.count > 0 && fn.functionName) out.add(fn.functionName);
      }
    }
  }
  return out;
}

const IN_BUNDLE = bundleNames();
const byFile = load();
const dead = [];
let totalFns = 0;
let inBundleOnly = 0;
for (const [rel, fns] of byFile) {
  const full = path.join(ROOT, rel);
  let src = "";
  try { src = fs.readFileSync(full, "utf8"); } catch (_) { continue; }
  for (const fn of fns.values()) {
    totalFns += 1;
    if (fn.count > 0) continue;
    if (fn.name === "(анонимная)" || !fn.name) continue;
    if (IN_BUNDLE.has(fn.name)) { inBundleOnly += 1; continue; }
    dead.push({ rel, name: fn.name, line: lineOf(src, fn.start) });
  }
}

/* ---- КОНТРОЛЬ ------------------------------------------------------- */
const covered = (rel, name) => {
  const fns = byFile.get(rel);
  if (!fns) return null;
  for (const fn of fns.values()) if (fn.name === name) return fn.count > 0;
  return null;
};
const controls = [
  ["покрытие вообще снято", totalFns > 200],
  ["заведомо живое покрыто: migrateConfig", covered("src/core/config_normalize.js", "migrateConfig") === true],
  ["заведомо живое покрыто: linePrefixLength", covered("src/core/shared_utils.js", "linePrefixLength") === true],
  /* Без этого «исполнено только в сборке» было бы нулём от того, что покрытие
     сборки не прочитано вовсе, — и число непокрытых выросло бы на 88 молча. */
  ["покрытие сборки прочитано", IN_BUNDLE.size > 100],
];
console.log("КОНТРОЛЬ:");
let ok = true;
for (const [name, pass] of controls) {
  console.log("  " + (pass ? "ok  " : "FAIL") + " " + name + (pass ? "" : " (получено " + JSON.stringify(pass) + ")"));
  if (!pass) ok = false;
}
if (!ok) { console.log("\nконтроль не прошёл — выводам верить нельзя"); process.exit(1); }

const byRel = new Map();
for (const d of dead) byRel.set(d.rel, (byRel.get(d.rel) || 0) + 1);
console.log("\nименованных функций рантайма в покрытии " + totalFns
  + "; исполнено только в сборке " + inBundleOnly
  + "; ни разу не исполнено " + dead.length + "\n");
for (const [rel, n] of [...byRel].sort((a, b) => b[1] - a[1])) console.log("  " + String(n).padStart(3) + "  " + rel);
console.log("");
for (const d of dead.sort((a, b) => (a.rel < b.rel ? -1 : 1) || a.line - b.line)) {
  console.log("  " + d.rel + ":" + d.line + "  " + d.name);
}
