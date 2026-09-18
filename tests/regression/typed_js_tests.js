"use strict";

/**
 * Какие файлы на JavaScript уже проверяются компилятором (`Р-6`).
 *
 * **Зачем сторож, если есть сам `npm run typecheck`.** Проверка типов на
 * JavaScript включается **пофайлово**, пометкой `// @ts-check`: `checkJs` в
 * `tsconfig.json` выключен, потому что весь рантайм разом даёт больше четырёх
 * тысяч ошибок, и почти все — ненаписанные аннотации, а не дефекты. Значит
 * пометка — и есть граница проверенного. Снимут её — прогон типов останется
 * зелёным, и никто не заметит: это тот самый запрет, который молчит, когда
 * искать стало нечего (У-94).
 *
 * **Список только растёт.** Файл, который уже проверяется, обратно не
 * выключается; новый добавляется сюда тем же заходом, каким получает пометку.
 *
 * **И второе: пометка ничего не значит, если файл не в программе.** Это
 * измерено, а не предположено: до 2026-09-19 в `include` стояли одни `*.ts`, и
 * `// @ts-check` на файлах ядра не делал **ничего** — нарочная ошибка в них не
 * попадала в вывод. Поэтому здесь спрашивается и то, и другое.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");

/**
 * Файлы, у которых проверка типов уже включена.
 *
 * Порядок был такой: сначала те, что читают все, — их и оказалось дешевле
 * всего разметить. Остальное названо числами в `docs/REMAINING_WORK.md`.
 */
const CHECKED = [
  "src/core/active_editor.js",
  "src/core/config_migration.js",
  "src/core/config_store.js",
  "src/core/say.js",
];

for (const rel of CHECKED) {
  const full = path.join(root, rel);
  assert.ok(fs.existsSync(full), rel + ": файла нет — снимите его из списка проверяемых");
  const head = fs.readFileSync(full, "utf8").split("\n", 3).join("\n");
  assert.ok(/^\/\/ @ts-check\s*$/m.test(head),
    rel + ": пометка `// @ts-check` снята — проверка типов этого файла выключена молча");
}

/* ---- пометка работает только внутри программы компилятора ---------------- */

const tsconfig = JSON.parse(
  fs.readFileSync(path.join(root, "tsconfig.json"), "utf8").replace(/^\s*\/\/.*$/gm, ""));
const include = tsconfig.include || [];

/**
 * Попадает ли путь под хоть один образец `include`.
 *
 * **Подстановки идут через метки, а не одна за другой.** Первая версия
 * подставляла регулярное выражение на месте двойной звёздочки с косой чертой,
 * а следующая замена звёздочек портила уже подставленное: в нём тоже есть
 * звёздочка. Поймал это контроль ниже — образцы перестали находить даже файлы
 * слоя настроек (У-142: контроль на каждый шаг обхода, а не на его вывод).
 */
function included(rel) {
  const ANY_DIRS = String.fromCharCode(1);
  const ANY_NAME = String.fromCharCode(2);
  return include.some((glob) => {
    const marked = String(glob)
      .split("**/").join(ANY_DIRS)
      .split("*").join(ANY_NAME);
    const body = marked
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .split(ANY_DIRS).join("(?:[^/]+/)*")
      .split(ANY_NAME).join("[^/]*");
    return new RegExp("^" + body + "$").test(rel);
  });
}

/* Контроль на сам разборщик образцов: то, что в программе точно есть. */
assert.ok(included("src/ui/settings/settings_tab.ts"),
  "контроль: разбор образцов include сломан — он не видит даже файлов слоя настроек");
assert.ok(!included("dist/main.js"),
  "контроль: разбор образцов include берёт лишнее");

for (const rel of CHECKED) {
  assert.ok(included(rel),
    rel + ": файл не попадает в `include` tsconfig — пометка `// @ts-check` на нём"
    + " не делает ничего, и проверка его молчит");
}

/* ---- сколько всего проверяется сегодня ---------------------------------- */

let marked = 0;
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.js$/.test(name)) continue;
    if (/^\/\/ @ts-check/.test(fs.readFileSync(p, "utf8"))) marked += 1;
  }
};
walk(path.join(root, "src"));

assert.ok(marked >= CHECKED.length,
  "помеченных файлов " + marked + ", а в списке " + CHECKED.length + ": список отстал от кода");

console.log("ok: проверкой типов накрыто " + marked + " файлов на JavaScript, "
  + "и каждый из них лежит внутри программы компилятора");
