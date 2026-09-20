"use strict";

/**
 * Стенд нумерации списков: **наш перенос строк, прогнанный через настоящий
 * фильтр нумерации Obsidian**.
 *
 *     node tools/renumber_bench.js
 *     node tools/renumber_bench.js <путь к obsidian-<версия>.asar>
 *
 * **Зачем он есть.** Нумерацию списков правит сама Obsidian, и правит не
 * командой, а фильтром транзакций (`sj` в `app.js`). Пока его не видно, любой
 * ответ на вопрос «что человек увидит после переноса строки» — догадка: за одну
 * ночь 2026-09-20 это стоило двух заходов и одного непринятого теста. Стенд
 * вырезает фильтр из `app.js` вместе с его помощниками, ставит в настоящий
 * CodeMirror (`@codemirror/state` лежит в `node_modules`) и подаёт ему ту самую
 * правку, какую пишет `applyMove` в `navigation_runtime.js`.
 *
 * **Что он показал.** Перенос строки на одну позицию платформа нумерует верно,
 * а перенос в **начало подсписка** — нет: номер первого элемента она считает по
 * старому документу, и строка приносит туда свой прежний номер (`2. 3. 4.`
 * вместо `1. 2. 3.`, его замечание 2026-09-20). И там же измерено лекарство:
 * готовые верные номера фильтр не трогает — поэтому плагин их считает сам
 * (`renumberOrderedWindow` в `shared_utils.js`), а не спорит с платформой.
 *
 * **Чего стенд не заменяет.** Он читает `app.js` **этой** машины: другая
 * версия Obsidian — другой фильтр, и ответ может смениться. Это не слабость, а
 * его предмет: он отвечает на «что сделает та Obsidian, которая стоит».
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/* `window` нужен движку навигации до загрузки: он ставит курсор таймером. */
if (typeof globalThis.window === "undefined") {
  globalThis.window = { setTimeout: (fn, ms) => setTimeout(fn, ms) };
}

const cmState = require("@codemirror/state");
const nav = require(path.join(ROOT, "src", "navigation_runtime.js"));

/** Где лежит сборка Obsidian этой машины. */
function findAsar(explicit) {
  if (explicit) return explicit;
  const dir = path.join(os.homedir(), "AppData", "Roaming", "obsidian");
  const names = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((n) => /^obsidian-.*\.asar$/.test(n)).sort()
    : [];
  if (!names.length) {
    console.error("не нашёл obsidian-<версия>.asar рядом с настройками Obsidian.");
    console.error("укажите путь: node tools/renumber_bench.js <путь к .asar>");
    process.exit(2);
  }
  return path.join(dir, names[names.length - 1]);
}

/** `app.js` из архива сборки: заголовок `asar` — длина, за ней оглавление. */
function readAppJs(asar) {
  const buf = fs.readFileSync(asar);
  const header = JSON.parse(buf.slice(16, 16 + buf.readUInt32LE(12)).toString("utf8"));
  const base = 8 + buf.readUInt32LE(4);
  let found = null;
  const walk = (node) => {
    for (const [name, entry] of Object.entries(node.files || {})) {
      if (entry.files) { walk(entry); continue; }
      if (name === "app.js" && !found) {
        const off = base + Number(entry.offset);
        found = buf.slice(off, off + entry.size).toString("utf8");
      }
    }
  };
  walk(header);
  if (!found) throw new Error("в архиве нет app.js: " + asar);
  return found;
}

/**
 * Фильтр нумерации, вырезанный из `app.js`.
 *
 * Куски берутся **по началу объявления и по началу следующего** — то есть
 * адресуются именем, а не смещением: смещения сменятся на первой же версии.
 * Не нашлось куска — стенд падает громко: молча собранный наполовину фильтр
 * отвечал бы неправдой.
 */
function buildRenumberFilter(app) {
  const slice = (from, to) => {
    const a = app.indexOf(from);
    const b = app.indexOf(to, a);
    if (a < 0 || b < 0) throw new Error("в app.js не нашлось куска фильтра: " + from);
    return app.slice(a, b);
  };
  const out = {};
  const factory = new Function("nt", "tj", "IL", "Ud", "Tw", "exports",
    "var bO=" + slice("var bO=/^([>", ",wO=").slice("var bO=".length) + ";"
    + slice("function rj(e){", "function oj(")
    + slice("function oj(e){", "var aj=")
    + slice("var aj=", "function sj(e){")
    + slice("function sj(e){", "function lj(e){")
    + "\nexports.sj = sj;");
  factory(
    cmState.EditorState,
    cmState.Annotation.define(),
    (e, t, n) => e.from <= n && e.to >= t,
    (e) => Array.from(new Set(e)),
    (e, t) => e - t,
    out,
  );
  return out.sj;
}

/** Редактор, запоминающий правку отрезком: ровно то, что уедет в CodeMirror. */
function fakeEditor(text, cursor) {
  const state = { lines: String(text).split("\n"), cursor: Object.assign({}, cursor) };
  const edits = [];
  return {
    edits,
    lastLine: () => state.lines.length - 1,
    getLine: (n) => state.lines[n],
    getCursor: () => Object.assign({}, state.cursor),
    setCursor: (p) => { state.cursor = Object.assign({}, p); },
    setValue: (v) => { edits.push({ kind: "setValue" }); state.lines = String(v).split("\n"); },
    replaceRange: (insert, from, to) => {
      edits.push({ kind: "replaceRange", insert: String(insert), from, to });
      const head = state.lines.slice(0, from.line);
      const tail = state.lines.slice(to.line + 1);
      const first = String(state.lines[from.line] || "").slice(0, from.ch);
      const last = String(state.lines[to.line] || "").slice(to.ch);
      state.lines = head.concat((first + String(insert) + last).split("\n"), tail);
    },
    getScrollInfo: () => ({ top: 0, left: 0 }),
    scrollTo: () => {},
    setSelection: () => {},
    getSelection: () => "",
    listSelections: () => [],
    setLine: (n, t) => { state.lines[n] = t; },
    posToOffset: (p) => p.ch,
    offsetToPos: (ch) => ({ line: 0, ch }),
    getValue: () => state.lines.join("\n"),
    focus: () => {},
    scrollIntoView: () => {},
  };
}

const CFG = {
  enabled: true,
  noSelectionMode: "line-only",
  headerMode: "move-as-line",
  crossSectionAllowed: true,
  highlightMovedLines: false,
  keepInView: false,
  viewPosition: "center",
};

function lineStart(lines, n) {
  let at = 0;
  for (let i = 0; i < n; i++) at += lines[i].length + 1;
  return at;
}

/** Перенести строку настоящим движком и показать, что выйдет в редакторе. */
function move(filter, lines, at, dir) {
  const ed = fakeEditor(lines.join("\n"), { line: at, ch: 0 });
  nav.moveLine(ed, dir, CFG);
  if (!ed.edits.length) return { lines, note: "движок промолчал" };
  const edit = ed.edits[0];
  if (edit.kind !== "replaceRange") {
    return { lines: ed.getValue().split("\n"), note: "правка пришла через " + edit.kind };
  }
  const state = cmState.EditorState.create({
    doc: lines.join("\n"),
    extensions: [filter({ tableCell: null, cm: { composing: false } })],
  });
  const tr = state.update({
    changes: {
      from: lineStart(lines, edit.from.line) + edit.from.ch,
      to: lineStart(lines, edit.to.line) + edit.to.ch,
      insert: edit.insert,
    },
  });
  return { lines: tr.state.doc.toString().split("\n"), note: "" };
}

/** Случаи стенда: его замечания и границы правила. */
const CASES = [
  {
    what: "его случай 1: дочерняя уезжает под другого родителя",
    lines: ["1. девятый", "\t1. первый", "\t2. второй", "\t3. третий", "2. десятый", "\t1. свой"],
    steps: [{ at: 3, dir: "down" }],
    expect: ["1. девятый", "\t1. первый", "\t2. второй", "2. десятый", "\t1. третий", "\t2. свой"],
  },
  {
    what: "его случай 2: дочерняя едет в начало своего подсписка",
    lines: ["1. девятый", "\t1. первый", "\t2. второй", "\t3. третий", "2. десятый", "\t1. свой"],
    steps: [{ at: 3, dir: "up" }, { at: 2, dir: "up" }],
    expect: ["1. девятый", "\t1. третий", "\t2. первый", "\t3. второй", "2. десятый", "\t1. свой"],
  },
  {
    what: "внутри одного уровня едет текст, номера стоят",
    lines: ["1. один", "2. два", "3. три", "4. четыре"],
    steps: [{ at: 3, dir: "up" }],
    expect: ["1. один", "2. два", "3. четыре", "4. три"],
  },
  {
    what: "список, начатый с пятого: перенос середины его не трогает",
    lines: ["5. пятый", "6. шестой", "7. седьмой"],
    steps: [{ at: 2, dir: "up" }],
    expect: ["5. пятый", "6. седьмой", "7. шестой"],
  },
  {
    what: "цена правила: перенос ПЕРВОЙ строки такого списка уводит его к единице",
    lines: ["5. пятый", "6. шестой", "7. седьмой"],
    steps: [{ at: 1, dir: "up" }],
    expect: ["1. шестой", "2. пятый", "3. седьмой"],
  },
  {
    what: "строки без номеров перенос не нумерует",
    lines: ["- буллит один", "- буллит два", "обычная строка"],
    steps: [{ at: 0, dir: "down" }],
    expect: ["- буллит два", "- буллит один", "обычная строка"],
  },
];

function main(argv) {
  const asar = findAsar(argv[0]);
  const filter = buildRenumberFilter(readAppJs(asar));
  console.log("фильтр нумерации взят из " + path.basename(asar));

  let bad = 0;
  for (const c of CASES) {
    let cur = c.lines;
    let note = "";
    for (const step of c.steps) {
      const r = move(filter, cur, step.at, step.dir);
      cur = r.lines;
      if (r.note) note = r.note;
    }
    const same = cur.join("\n") === c.expect.join("\n");
    if (!same) bad++;
    console.log((same ? "  ok   " : "  FAIL ") + c.what + (note ? " [" + note + "]" : ""));
    if (!same) {
      console.log("    ждали: " + JSON.stringify(c.expect));
      console.log("    вышло: " + JSON.stringify(cur));
    }
  }
  console.log(bad ? "\nрасхождений " + bad + " из " + CASES.length
    : "\nвсе " + CASES.length + " случаев совпали с ожидаемым");
  process.exit(bad ? 1 : 0);
}

main(process.argv.slice(2));
