"use strict";

/**
 * Объяснение без предмета: блок комментария, у которого функция уехала.
 *
 * **Почему это проверка, а не разовый прогон.** Такого сироту оставляет
 * **переезд**: функция уходит в модуль, а объяснение, купленное дефектом,
 * остаётся в прежнем файле. Симптом назван 2026-09-07 куском третьим разбора
 * `main.js` (У-96) — и разовым прогоном тогда нашёлся один. Кусок четвёртый
 * нашёл ещё **четыре**, прожившие в точке входа целую сессию: правила каретки
 * (44 строки про две копии `drawSelection` в `app.js`), свой слой каретки,
 * отрезок панели TagWheel и метки элементов. Ни один прогон набора об этом не
 * сказал, потому что проверки не было.
 *
 * **Признак — два условия сразу, и второе главное.**
 *
 *   1. За блоком комментария не стоит объявления: следующая непустая строка —
 *      начало другого блока комментария.
 *   2. Блок **называет имя**, которого в этом файле нет ни в одном объявлении.
 *      Имя берётся из обратных кавычек — так их пишет весь репозиторий.
 *
 * Второе условие и отличает сироту от **вводного** комментария к разделу: тот
 * объясняет группу объявлений и по имени никого не зовёт. Без него проверка
 * ловила пять законных вводных на шесть настоящих сирот — то есть мерила
 * стиль, а не дефект.
 *
 * **Чего проверка не ищет.** Объяснение, стоящее над **не тем** объявлением,
 * когда имя всё-таки есть в файле: буквами это не отличить. Ловится оно
 * чтением — и именно так 2026-09-07 нашлись два случая в слое настроек, где
 * между объяснением и его функцией со временем встала другая.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

/* Рантайм плагина: то, что уезжает в сборку, и то, откуда уезжает код. */
const ROOTS = [
  "main.js",
  "navigation_runtime.js",
  "pkm_runtime_v2.js",
  "src",
  "pkm_v2",
];

function collect(rel, out) {
  const full = path.join(ROOT, rel);
  const st = fs.statSync(full);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(full)) collect(path.join(rel, name), out);
    return out;
  }
  if (/\.(js|ts)$/.test(rel) && !/\.d\.ts$/.test(rel)) out.push(rel.replace(/\\/g, "/"));
  return out;
}

/** Имена, объявленные в файле: функции, классы, `const`, поля объектов, методы. */
function declaredNames(src) {
  const out = new Set();
  const patterns = [
    /\bfunction\s+([A-Za-z_$][\w$]*)/g,
    /\bclass\s+([A-Za-z_$][\w$]*)/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /^\s*([A-Za-z_$][\w$]*)\s*[:(]/gm,
    /\bexports\.([A-Za-z_$][\w$]*)/g,
  ];
  for (const rx of patterns) {
    let m;
    while ((m = rx.exec(src)) !== null) out.add(m[1]);
  }
  return out;
}

/** Имена, которые блок комментария зовёт обратными кавычками. */
function mentionedNames(block) {
  const out = [];
  const rx = /`([A-Za-z_$][\w$]*)`/g;
  let m;
  while ((m = rx.exec(block)) !== null) out.push(m[1]);
  return out;
}

function findOrphans(src) {
  const lines = src.split("\n");
  const declared = declaredNames(src);
  const out = [];
  let i = 0;
  /* Первый блок файла — его шапка, а не объяснение объявления. */
  let seenBlock = false;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith("/*")) {
      i += 1;
      continue;
    }
    let end = i;
    if (!trimmed.slice(2).includes("*/")) {
      while (end < lines.length && !lines[end].includes("*/")) end += 1;
    }
    if (end >= lines.length) break;
    let next = end + 1;
    while (next < lines.length && !lines[next].trim()) next += 1;
    const after = next < lines.length ? lines[next].trim() : "";
    const block = lines.slice(i, end + 1).join("\n");
    const stacked = seenBlock && trimmed.startsWith("/**")
      && after.startsWith("/**") && end - i >= 3;
    if (stacked) {
      const missing = mentionedNames(block).filter((n) => !declared.has(n));
      if (missing.length) {
        out.push({
          line: i + 1,
          head: String(lines[i + 1] || "").trim().slice(0, 60),
          missing: Array.from(new Set(missing)),
        });
      }
    }
    seenBlock = true;
    i = end + 1;
  }
  return out;
}

const files = [];
for (const rel of ROOTS) collect(rel, files);
if (files.length < 40) {
  throw new Error("файлов рантайма нашлось подозрительно мало: " + files.length);
}

let blocks = 0;
const orphans = [];
for (const rel of files) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  blocks += (src.match(/^\s*\/\*/gm) || []).length;
  for (const o of findOrphans(src)) {
    orphans.push(rel + ":" + o.line + "  «" + o.head + "…» зовёт " + o.missing.join(", "));
  }
}

/*
 * Положительный контроль: блоки комментариев в рантайме есть, и их много. Без
 * него проверка была бы зелёной от того, что разбор перестал их находить
 * (У-88).
 */
if (blocks < 500) {
  throw new Error("блоков комментариев нашлось подозрительно мало: " + blocks
    + ". Разбор перестал их находить — правьте признак выше");
}

if (orphans.length) {
  throw new Error("объяснение зовёт имя, которого в файле нет, и за ним не стоит объявления:\n  "
    + orphans.join("\n  "));
}

console.log("  ok объяснений без предмета нет: осмотрено файлов " + files.length
  + ", блоков комментариев " + blocks);
console.log("Orphan comments tests: OK");
