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
 * **Как гонять, четыре команды — обе дороги в одну папку** (`Р-7`):
 *
 *   NODE_V8_COVERAGE=<папка> npm test
 *   IO_COVERAGE_OUT=<папка> node tests/browser/check_editor.js
 *   IO_COVERAGE_OUT=<папка> node tests/browser/check_tagwheel.js
 *   node tools/coverage_map.js <папка>
 *
 * Браузерные проверки гоняются **по одной**: страница у них одна на все прогоны
 * (правило про два `gate:browser` разом).
 *
 * **Дорог две, и до 2026-09-19 мерилась одна.** `npm test` — шесть шагов из
 * семи; слой оформления заметки и сессия TagWheel исполняются в Chromium, и их
 * покрытие сюда не попадало: часть «непокрытых» исполнял именно браузер. Цена
 * была измерена — 230 имён против 203, и 18 из разницы лежат в одном файле,
 * `src/ui/editor/decorations.js`. Без браузерной дороги инструмент говорит об
 * этом **строкой в выводе**, а не молчит.
 *
 * **Оговорка, которая осталась.** Функции точки входа исполняются в
 * `dist/main.js`, и по исходнику они выглядят непокрытыми: там сложение идёт
 * по **именам** — одно имя в двух файлах (У-148 в сторону самой меры).
 * Браузерная дорога так не считается: имена методов повторяются, и измерение
 * это показало (семь имён из двадцати имели в странице больше одного носителя,
 * спорили с CodeMirror), — там владелец определяется по **месту** в бандле.
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
function namesFrom(wantUrl) {
  const out = new Set();
  for (const name of fs.readdirSync(COV)) {
    if (!/\.json$/.test(name)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(COV, name), "utf8")); } catch (_) {
      /* Проба: файл покрытия может быть дописан не до конца. */
      continue;
    }
    for (const entry of data.result || []) {
      if (!wantUrl(String(entry.url || ""))) continue;
      for (const fn of entry.functions || []) {
        const r = fn.ranges && fn.ranges[0];
        if (r && r.count > 0 && fn.functionName) out.add(fn.functionName);
      }
    }
  }
  return out;
}

const IN_BUNDLE = namesFrom((url) => url.indexOf("/dist/main.js") >= 0);

/**
 * Что исполнила **браузерная дорога** (`Р-7`).
 *
 * Слой оформления заметки и сессия TagWheel живут в Chromium, и `npm test` их
 * не исполняет вовсе: до этой правки покрытие снималось с одной дороги из двух,
 * и часть «неисполненных» имён исполнял именно браузер
 * (`docs/AUDIT_2026-09-18.md`, 4.8).
 *
 * **Складывается по месту, а не по имени.** Страница — бандл esbuild, файлов
 * `src/**` в ней нет, и первая версия этой правки складывала по именам — как
 * `dist/main.js` рядом. Измерение показало, что так нельзя: из двадцати
 * засчитанных имён **семь** имели в странице больше одного носителя, и спорили
 * они с самим CodeMirror — `toDOM`, `decorations`, `markers`, `clear`,
 * `destroy`, `sync`, `measure`. Кредит по имени записал бы нам исполнение
 * чужого кода.
 *
 * Поэтому обвязка гейта пишет рядом с покрытием **карту страницы**: границы
 * кусков по пометкам esbuild, каждая — ключ из `metafile.inputs`. Смещение
 * функции в бандле переводится в файл, и засчитывается пара «файл + имя».
 *
 * Снимается так:
 *   IO_COVERAGE_OUT=<та же папка> node tests/browser/check_editor.js
 *   IO_COVERAGE_OUT=<та же папка> node tests/browser/check_tagwheel.js
 */
function browserMaps() {
  const byBundle = new Map();
  const files = new Set();
  for (const name of fs.readdirSync(COV)) {
    if (!/^browser-inputs-.*\.json$/.test(name)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(COV, name), "utf8")); } catch (_) {
      /* Проба: файл мог быть дописан не до конца. */
      continue;
    }
    for (const rel of data.inputs || []) files.add(String(rel).replace(/\\/g, "/"));
    const bundle = String(data.bundle || "");
    const sections = (data.sections || []).map((s) => [Number(s[0]), String(s[1])]);
    if (bundle && sections.length) byBundle.set(bundle, sections.sort((a, b) => a[0] - b[0]));
  }
  return { byBundle, files };
}

const BROWSER_MAP = browserMaps();

/** Владелец смещения: последняя пометка, стоящая до него. */
function ownerOf(sections, offset) {
  let lo = 0;
  let hi = sections.length - 1;
  let found = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sections[mid][0] <= offset) { found = sections[mid][1]; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

/** Пары «файл + имя», исполненные в странице. */
function browserRan() {
  const out = new Set();
  for (const name of fs.readdirSync(COV)) {
    if (!/\.json$/.test(name) || /^browser-inputs-/.test(name)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(COV, name), "utf8")); } catch (_) {
      /* Проба: файл мог быть дописан не до конца. */
      continue;
    }
    for (const entry of data.result || []) {
      const url = String(entry.url || "");
      if (!/\.bundle\.js$/.test(url)) continue;
      const sections = BROWSER_MAP.byBundle.get(url.split("/").pop());
      if (!sections) continue;
      for (const fn of entry.functions || []) {
        const r = fn.ranges && fn.ranges[0];
        if (!r || !(r.count > 0) || !fn.functionName) continue;
        const rel = ownerOf(sections, Number(r.startOffset));
        if (rel) out.add(rel + "|" + fn.functionName);
      }
    }
  }
  return out;
}

const RAN_IN_BROWSER = browserRan();
const BROWSER_ROAD_READ = BROWSER_MAP.byBundle.size > 0;

const byFile = load();
const dead = [];
let totalFns = 0;
let inBundleOnly = 0;
let inBrowserOnly = 0;
const browserExplained = [];
for (const [rel, fns] of byFile) {
  const full = path.join(ROOT, rel);
  let src = "";
  try { src = fs.readFileSync(full, "utf8"); } catch (_) { continue; }
  for (const fn of fns.values()) {
    totalFns += 1;
    if (fn.count > 0) continue;
    if (fn.name === "(анонимная)" || !fn.name) continue;
    if (IN_BUNDLE.has(fn.name)) { inBundleOnly += 1; continue; }
    if (RAN_IN_BROWSER.has(rel + "|" + fn.name)) {
      inBrowserOnly += 1;
      browserExplained.push({ rel, name: fn.name, line: lineOf(src, fn.start) });
      continue;
    }
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
  /*
   * Контроль на **свой** шаг (правило 64): пока покрытие браузера не прочитано,
   * весь вывод про него — нули, и эти нули читались бы как «браузер ничего не
   * исполняет». Инструмент говорит об этом вслух и не притворяется, что
   * посчитал обе дороги.
   */
  /*
   * Контроли на **каждый шаг** цепочки, а не на её вывод (правило 64). Шагов
   * три: карта страницы прочитана, покрытие страницы прочитано, и владелец
   * смещения и правда находится. Без первого весь вывод про браузер — нули, и
   * эти нули читались бы как «браузер ничего не исполняет».
   */
  ["карта браузерной страницы прочитана (иначе меряется одна дорога из двух)",
    BROWSER_ROAD_READ ? BROWSER_MAP.files.size > 20 : true],
  ["слой оформления и правда лежит в странице",
    BROWSER_ROAD_READ ? BROWSER_MAP.files.has("src/ui/editor/decorations.js") : true],
  ["владелец смещения находится: слой оформления что-то исполнил",
    BROWSER_ROAD_READ
      ? [...RAN_IN_BROWSER].some((k) => k.startsWith("src/ui/editor/decorations.js|"))
      : true],
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
console.log("\nдороги: Node" + (BROWSER_ROAD_READ ? " и браузер" : " (браузерная дорога не снята — число ниже завышено)"));
console.log("\nименованных функций рантайма в покрытии " + totalFns
  + "; исполнено только в сборке " + inBundleOnly
  + "; исполнено только браузером " + inBrowserOnly
  + "; ни разу не исполнено " + dead.length + "\n");
if (browserExplained.length) {
  const byRelBrowser = new Map();
  for (const d of browserExplained) byRelBrowser.set(d.rel, (byRelBrowser.get(d.rel) || 0) + 1);
  for (const d of browserExplained.sort((a, b) => (a.rel < b.rel ? -1 : 1) || a.line - b.line)) {
    console.log("  Б " + d.rel + ":" + d.line + "  " + d.name);
  }
  console.log("исполняет только браузер:");
  for (const [rel, n] of [...byRelBrowser].sort((a, b) => b[1] - a[1])) {
    console.log("  " + String(n).padStart(3) + "  " + rel);
  }
  console.log("");
}
for (const [rel, n] of [...byRel].sort((a, b) => b[1] - a[1])) console.log("  " + String(n).padStart(3) + "  " + rel);
console.log("");
for (const d of dead.sort((a, b) => (a.rel < b.rel ? -1 : 1) || a.line - b.line)) {
  console.log("  " + d.rel + ":" + d.line + "  " + d.name);
}
