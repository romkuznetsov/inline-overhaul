"use strict";

/**
 * Заголовок, размер которого задаёт тема.
 *
 * **Замечание заказчика 2026-09-19, пункт 7:** «в settings-backup-actions при
 * нажатии на save a backup в модальном окне хедер save a backup меньше по
 * размеру чем субхедеры Choose modules you want to backup и Hotkeys to keep».
 *
 * **Причина измерена, а не выведена из вида.** Заголовок окна рисуется тегом
 * `h4`, а размер `h4` объявляет тема: `--h4-size` — `1.188em` у Obsidian
 * (`app.css` 1.13.7) и `0.90em` у Minimal из его vault (`theme.css`), плюс
 * `--h4-weight` 500 против 600. Подзаголовки же — наши `div` с нашим весом и
 * размером строки. То есть на его теме заголовок окна выходил и мельче, и
 * легче собственных подзаголовков, а на моей — крупнее: правила не было ни
 * одного, был ответ темы.
 *
 * **Свойство, а не образец** (У-201): у каждого заголовка, который рисует
 * плагин, размер обязан быть объявлен нами. Обход ищет по **форме вызова** —
 * тег `h1`…`h6` литералом, — а не по списку мест, потому что заголовок
 * заводится в любом файле панели (У-111).
 *
 * У обхода отрицательные контроли (У-204): строка, где тег приезжает
 * выражением, и упоминание тега в рассказе о коде — ни то, ни другое находкой
 * быть не должно.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
let passed = 0;
function ok(label) { passed++; console.log("  ok " + label); }

/** Все файлы рантайма, где может завестись заголовок. */
function sources(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) { sources(p, out); continue; }
    if (/\.(js|ts)$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * Маска: комментарии и строковые литералы этот обход не читает **как код**,
 * но сами строки ему нужны — в них лежит имя класса. Поэтому стираются только
 * комментарии, и кавычка не ищет пару дальше конца строки (У-139).
 */
function withoutComments(src) {
  let out = "";
  for (const line of src.split("\n")) {
    const at = line.indexOf("//");
    out += (at >= 0 && !/["'`]/.test(line.slice(0, at)) ? line.slice(0, at) : line) + "\n";
  }
  return out.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

const HEAD_EL = /\bel\(\s*[A-Za-z0-9_.$]+\s*,\s*"(h[1-6])"\s*,\s*([^,]*),/g;
const HEAD_CREATE = /\.createEl\(\s*"(h[1-6])"\s*(,\s*\{[^}]*\})?/g;

/**
 * Заголовок без своего класса законен ровно там, где размер ему объявляет
 * правило по родителю, и такое место одно. Список **печатается вслух** и
 * проверяется сам: у названного правила спрашивается `font-size`. Молчаливое
 * исключение — это способ превратить «проверено автоматически» в «проверено
 * ничего».
 */
const BY_PARENT = {
  'src/ui/settings/custom/fields_editor_view.ts: el(title, "h4", undefined,':
    ".io-fields__title h4",
};

const found = [];
const nameless = [];
const byParent = [];
for (const file of sources(path.join(root, "src"), []).concat([path.join(root, "main.js")])) {
  const code = withoutComments(fs.readFileSync(file, "utf8"));
  const rel = path.relative(root, file).replace(/\\/g, "/");
  let m;
  while ((m = HEAD_EL.exec(code))) {
    const cls = m[2].trim();
    const site = rel + ": " + m[0].trim();
    if (!cls || cls === "undefined" || cls === "null" || cls === '""') {
      if (BY_PARENT[site]) byParent.push(site);
      else nameless.push(site);
    } else found.push({ rel, cls });
  }
  while ((m = HEAD_CREATE.exec(code))) {
    const opts = (m[2] || "");
    if (!/\bcls\s*:/.test(opts)) nameless.push(rel + ": " + m[0].trim());
    else found.push({ rel, cls: (opts.match(/\bcls\s*:\s*("[^"]*")/) || [])[1] || "" });
  }
}

assert.ok(found.length > 0,
  "обход не нашёл ни одного заголовка — значит он ищет не то (У-200)");
assert.deepEqual(nameless, [],
  "заголовок без своего класса берёт размер у темы: " + nameless.join("; "));
ok("заголовков плагина найдено " + found.length + ", и у каждого свой класс");

const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");

/* Исключения: размер объявлен правилом по родителю, и это проверяется. */
assert.deepEqual(byParent.slice().sort(), Object.keys(BY_PARENT).sort(),
  "список исключений разошёлся с тем, что нашёл обход");
for (const site of byParent) {
  const sel = BY_PARENT[site];
  const at = css.indexOf(sel + " {");
  assert.ok(at >= 0, "правило " + sel + " не нашлось в styles.css");
  assert.ok(/font-size\s*:/.test(css.slice(at, css.indexOf("}", at))),
    "правило " + sel + " размера не объявляет — значит его задаёт тема");
  console.log("  —  " + site + " размер берёт у " + sel);
}

/* Классы, названные литералом, обязаны иметь объявленный размер. */
function declaresSize(cls) {
  const re = new RegExp("\\." + cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b[^{}]*\\{([^}]*)\\}", "g");
  let m;
  while ((m = re.exec(css))) if (/font-size\s*:/.test(m[1])) return true;
  return false;
}
const silent = [];
for (const item of found) {
  const literal = item.cls.startsWith('"') && item.cls.endsWith('"');
  if (!literal) continue;
  for (const cls of item.cls.slice(1, -1).split(/\s+/).filter(Boolean)) {
    if (!declaresSize(cls)) silent.push(item.rel + ": ." + cls);
  }
}
assert.deepEqual(silent, [],
  "у класса заголовка не объявлен размер, и его задаёт тема: " + silent.join("; "));
ok("у каждого такого класса размер объявлен в styles.css");

/*
 * Отрицательные контроли: обход обязан молчать там, где заголовка нет.
 * Без них широкий признак назвал бы долгом чужое (У-204).
 */
{
  const quiet = [
    'el(row, o.tag || "div", "io-dlg__head-name", o.text);',
    '/** `h4` у заголовка окна, `div` у заголовка раздела внутри него. */',
    '// el(box, "h4", undefined, o.title);',
    'const label = "h4";',
  ].join("\n");
  const masked = withoutComments(quiet);
  HEAD_EL.lastIndex = 0;
  HEAD_CREATE.lastIndex = 0;
  assert.equal(HEAD_EL.exec(masked), null, "тег выражением и рассказ о коде находкой не являются");
  assert.equal(HEAD_CREATE.exec(masked), null, "и через createEl тоже");
}
{
  /* И положительный: на прежнем виде этой строки обход обязан краснеть. */
  const broken = withoutComments('el(box, "h4", undefined, o.title);');
  HEAD_EL.lastIndex = 0;
  const hit = HEAD_EL.exec(broken);
  assert.ok(hit && hit[2].trim() === "undefined",
    "заголовок без класса обходом находится — иначе запрет не сторожит ничего");
}
ok("контроли обхода: безымянный заголовок находится, чужое не находится");

console.log("\n" + passed + " проверок пройдено");
