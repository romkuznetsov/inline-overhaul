"use strict";

/**
 * Таблица исключений к З3 в `CLAUDE.md` и их истории в PRD 3.3 — одно и то же
 * множество.
 *
 * **Зачем.** 2026-09-10 истории тридцати пяти исключений уехали из `CLAUDE.md`
 * (он читается целиком каждую сессию, и они занимали четверть объёма) в PRD 3.3,
 * где уже лежали первые двадцать два. В `CLAUDE.md` осталась таблица «номер,
 * дата, файл, одна строка». С этого дня у одного предмета два дома, и разъехаться
 * им не на чем только пока это кто-то спрашивает (У-32): строка таблицы без
 * истории — это адрес, ведущий в пустоту, а история без строки — исключение,
 * которого не видно перед первой правкой.
 *
 * **Что проверяется.**
 *   1. в таблице ровно тридцать пять строк, номера идут подряд, у каждой дата и
 *      хотя бы один файл;
 *   2. у каждого номера есть свой абзац в PRD 3.3, названный тем же порядковым
 *      числительным;
 *   3. файлы из строки таблицы стоят **в своём** абзаце PRD, а не где-нибудь в
 *      документе (У-134: сверка «выжило хоть где-то» слепа к переезду в чужой
 *      пункт);
 *   4. историй в `CLAUDE.md` больше нет — симптом их возвращения ловится формой
 *      снятого списка (`  N. **<дата>** — …`).
 *
 * **Положительный контроль стоит внутри:** имя функции первого исключения не
 * должно находиться в абзаце тридцать пятого. Без него нарезка PRD, у которой
 * последний абзац тянется до конца файла, была бы зелёной на любом имени — так
 * и случилось на первом прогоне сверки при переезде.
 *
 * **Чего проверка не делает.** Абзац у исключений пятого, шестого и седьмого
 * один на три: в PRD они объявлены одной фразой «Исключения пятое, шестое и
 * седьмое». Для них требование 3 значит «файл стоит в этом общем абзаце».
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const claude = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8");
const prd = fs.readFileSync(
  path.join(root, "docs", "PRD_Settings_Overhaul_v1.md"),
  "utf8"
);

const ORDINALS = [
  "первое", "второе", "третье", "четвёртое", "пятое", "шестое", "седьмое",
  "восьмое", "девятое", "десятое", "одиннадцатое", "двенадцатое",
  "тринадцатое", "четырнадцатое", "пятнадцатое", "шестнадцатое",
  "семнадцатое", "восемнадцатое", "девятнадцатое", "двадцатое",
  "двадцать первое", "двадцать второе", "двадцать третье",
  "двадцать четвёртое", "двадцать пятое", "двадцать шестое",
  "двадцать седьмое", "двадцать восьмое", "двадцать девятое", "тридцатое",
  "тридцать первое", "тридцать второе", "тридцать третье",
  "тридцать четвёртое", "тридцать пятое",
];

/* ---------- 1. таблица в CLAUDE.md ---------- */

const rowRe = /^ {2}\|\s*(\d+)\s*\|([^|]*)\|([^|]*)\|/gm;
const rows = [];
for (let m = rowRe.exec(claude); m; m = rowRe.exec(claude)) {
  rows.push({ n: Number(m[1]), date: m[2].trim(), files: m[3].trim() });
}

assert.strictEqual(
  rows.length,
  ORDINALS.length,
  "в таблице исключений " + rows.length + " строк, а исключений " + ORDINALS.length +
    ": таблицу и этот список правят одним заходом"
);

rows.forEach((row, i) => {
  assert.strictEqual(row.n, i + 1, "номера в таблице идут не подряд: " + row.n);
  assert.match(
    row.date,
    /20\d\d-\d\d-\d\d/,
    "у строки " + row.n + " в таблице нет даты: " + JSON.stringify(row.date)
  );
  assert.match(
    row.files,
    /`[\w./-]+\.(?:js|ts|mjs)`/,
    "у строки " + row.n + " в таблице не назван файл: " + JSON.stringify(row.files)
  );
});

/* ---------- 2. абзацы в PRD 3.3 ---------- */

const secStart = prd.indexOf("### 3.3 Запреты");
assert.ok(secStart > 0, "раздел 3.3 в PRD не найден");
const secEnd = prd.indexOf("\n## ", secStart);
assert.ok(secEnd > secStart, "конец раздела 3.3 в PRD не найден");
const section = prd.slice(secStart, secEnd);

/* Нарезка по пометкам «Исключение …» / «Исключения …, … и …». Границей служит
   следующая пометка, а у последней — конец раздела: без этой границы абзац
   тридцать пятого тянулся бы до конца файла и «содержал» бы любое имя. */
const markRe = /\*\*Исключени[ея][^*]*\*\*/g;
const marks = [];
for (let m = markRe.exec(section); m; m = markRe.exec(section)) {
  marks.push({ at: m.index, text: m[0] });
}
assert.ok(marks.length >= 20, "пометок «Исключение …» в PRD 3.3 слишком мало: " + marks.length);

/* Числительные вкладываются друг в друга: «двадцать первое» содержит «первое»,
   и наивный поиск подстрокой отдал бы абзац двадцать первого исключения
   первому. Поэтому составные снимаются с текста пометки до того, как в остатке
   ищутся одиночные. */
function ordinalsIn(text) {
  let rest = text;
  const found = [];
  ORDINALS.forEach((word, idx) => {
    if (word.includes(" ") && rest.includes(word)) {
      found.push(idx + 1);
      rest = rest.split(word).join(" ");
    }
  });
  ORDINALS.forEach((word, idx) => {
    if (!word.includes(" ") && rest.includes(word)) found.push(idx + 1);
  });
  return found;
}

assert.deepStrictEqual(
  ordinalsIn("**Исключение двадцать первое, разрешённое**"),
  [21],
  "разбор числительных считает «двадцать первое» ещё и первым"
);

const blockOf = new Map();
marks.forEach((mark, i) => {
  const to = i + 1 < marks.length ? marks[i + 1].at : section.length;
  const body = section.slice(mark.at, to);
  for (const n of ordinalsIn(mark.text)) blockOf.set(n, body);
});

const missing = [];
for (let n = 1; n <= ORDINALS.length; n++) {
  if (!blockOf.has(n)) missing.push(n + " (" + ORDINALS[n - 1] + ")");
}
assert.deepStrictEqual(
  missing,
  [],
  "у этих исключений нет своего абзаца в PRD 3.3: " + missing.join(", ")
);

/* Положительный контроль нарезки: имя первого исключения не должно находиться
   в абзаце тридцать пятого. */
assert.ok(
  blockOf.get(1).includes("reconcileModeDependencies"),
  "нарезка PRD сломана: в абзаце первого исключения нет его функции"
);
assert.ok(
  !blockOf.get(35).includes("reconcileModeDependencies"),
  "нарезка PRD не ограничена: абзац тридцать пятого исключения содержит функцию первого"
);

/* ---------- 3. файлы строки стоят в своём абзаце ---------- */

const fileRe = /`([\w./-]+\.(?:js|ts|mjs))`/g;
const wrong = [];
rows.forEach((row) => {
  const body = blockOf.get(row.n);
  const names = new Set();
  for (let m = fileRe.exec(row.files); m; m = fileRe.exec(row.files)) {
    names.add(m[1].split("/").pop());
  }
  for (const name of names) {
    if (!body.includes(name)) wrong.push(row.n + ": " + name);
  }
});
assert.deepStrictEqual(
  wrong,
  [],
  "файл назван в таблице, но не в абзаце своего исключения в PRD 3.3: " + wrong.join("; ")
);

/* ---------- 4. историй в CLAUDE.md больше нет ---------- */

const historyRe = /^ {2}\d+\. \*\*20\d\d-\d\d-\d\d/gm;
const back = claude.match(historyRe) || [];
assert.deepStrictEqual(
  back,
  [],
  "истории исключений снова стоят в CLAUDE.md (" + back.length + " пунктов): их дом — PRD 3.3"
);

console.log(
  "ok: исключений к З3 " + rows.length + ", у каждого строка таблицы в CLAUDE.md и " +
    "абзац в PRD 3.3; файлы строк стоят в своих абзацах"
);
