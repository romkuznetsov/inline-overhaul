"use strict";
/**
 * Перенос строк и нумерация списка (его замечание 2026-09-20, пункт 11:
 * «при move-lines up\down нумерованного списка нумерация не восстанавливается…
 * я двигал sub-lines и у меня нумерация под п.10 у дочерней строки начинается
 * с .3, а должна с 1»).
 *
 * **Нумерацию списков Obsidian правит сам** — и правит фильтром транзакций, а
 * не командой: `sj(e)` в `app.js` 1.13.7 объявляет `transactionFilter`, который
 * на каждое изменение документа смотрит затронутые строки и дописывает
 * изменение с `userEvent: "input.renumber"`. У фильтра есть выход в самом
 * начале, и среди условий выхода стоит `t.isUserEvent("set")`.
 *
 * **А `Editor.setValue` в Obsidian отправляет именно `userEvent: "set"`**
 * (`n.dispatch({changes:{…}, userEvent:"set"})` там же). То есть перенос
 * строк, записанный через `setValue`, выключал нумерацию не тем, что считал её
 * неправильно, а тем, что говорил платформе «это не правка человека». Ровно
 * это и видел заказчик.
 *
 * `Editor.replaceRange(text, from, to)` четвёртым аргументом принимает
 * `userEvent`, и без него транзакция уходит без пометки — фильтр работает.
 *
 * Поэтому проверяется **форма записи**, а не сама нумерация: нумерацию делает
 * платформа, и повторять её правило у себя означало бы завести второе
 * объявление чужой разметки (У-168). Здесь спрашивается то, что в нашей власти:
 *
 *   1. документ после переноса тот же, что и был (правка формы записи ничего
 *      не двигает в тексте);
 *   2. запись идёт `replaceRange`, а не `setValue`;
 *   3. переписывается ровно окно изменившихся строк, а не весь документ:
 *      фильтр нумерует от затронутых строк, и переписать документ целиком
 *      значило бы перенумеровать все списки заметки разом.
 */

const path = require("path");
const assert = require("node:assert/strict");

if (typeof globalThis.window === "undefined") {
  globalThis.window = { setTimeout: (fn, ms) => setTimeout(fn, ms) };
}

const nav = require(path.join(__dirname, "..", "..", "src", "navigation_runtime.js"));

let passed = 0;
function ok(what) { passed++; console.log("  ok " + what); }

/**
 * Редактор, который **запоминает, чем его правили**.
 *
 * Подделка тут только у редактора: перенос строк работает с открытой заметкой,
 * и другого способа позвать его вне Obsidian нет (У-1). Решений она не
 * принимает — держит строки, курсор и то, каким вызовом пришла правка.
 */
function fakeEditor(text, cursor) {
  const state = { lines: String(text).split("\n"), cursor: Object.assign({}, cursor) };
  const writes = [];
  const editor = {
    writes,
    lastLine: () => state.lines.length - 1,
    getLine: (n) => state.lines[n],
    getCursor: () => Object.assign({}, state.cursor),
    setCursor: (p) => { state.cursor = Object.assign({}, p); },
    setValue: (v) => {
      writes.push({ kind: "setValue" });
      state.lines = String(v).split("\n");
    },
    replaceRange: (insert, from, to) => {
      writes.push({ kind: "replaceRange", from: from.line, to: to.line });
      const head = state.lines.slice(0, from.line);
      const tail = state.lines.slice(to.line + 1);
      const first = String(state.lines[from.line] || "").slice(0, from.ch);
      const last = String(state.lines[to.line] || "").slice(to.ch);
      const middle = (first + String(insert) + last).split("\n");
      state.lines = head.concat(middle, tail);
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
  return editor;
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

/** Первая и последняя разошедшиеся строки двух документов. */
function changedWindow(before, after) {
  const a = before.split("\n");
  const b = after.split("\n");
  let first = -1;
  let last = -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) { if (first === -1) first = i; last = i; }
  }
  return { first, last };
}

function move(text, line, direction, over) {
  const ed = fakeEditor(text, { line, ch: 0 });
  nav.moveLine(ed, direction, Object.assign({}, CFG, over || {}));
  return { text: ed.getValue(), writes: ed.writes };
}

/* Его случай: дочерние строки нумерованного списка под двумя родителями. */
const LIST = [
  "9. девятый",
  "\t1. первый дочерний",
  "\t2. второй дочерний",
  "\t3. третий дочерний",
  "10. десятый",
  "\t1. свой дочерний",
].join("\n");

{
  /* Третий дочерний уезжает вниз, под родителя `10.`. */
  const r = move(LIST, 3, "down");
  assert.equal(r.text, [
    "9. девятый",
    "\t1. первый дочерний",
    "\t2. второй дочерний",
    "10. десятый",
    "\t3. третий дочерний",
    "\t1. свой дочерний",
  ].join("\n"), "перенос вниз переставил не те строки");
  ok("перенос вниз двигает строку через соседнюю");
}

{
  const r = move(LIST, 4, "up");
  assert.equal(r.text, [
    "9. девятый",
    "\t1. первый дочерний",
    "\t2. второй дочерний",
    "10. десятый",
    "\t3. третий дочерний",
    "\t1. свой дочерний",
  ].join("\n"), "перенос вверх переставил не те строки");
  ok("перенос вверх двигает строку через соседнюю");
}

{
  /*
   * **Главное утверждение** (пункт 11): ни одна правка переноса не идёт через
   * `setValue`. Такая правка приезжает в Obsidian с `userEvent: "set"`, а
   * фильтр нумерации на этой пометке выходит первым же условием — и список
   * остаётся с теми номерами, какие были у строк до переноса.
   */
  const cases = [
    { text: LIST, line: 3, dir: "down" },
    { text: LIST, line: 4, dir: "up" },
    { text: LIST, line: 1, dir: "down" },
    { text: LIST, line: 5, dir: "up" },
    { text: ["первая", "вторая", "третья"].join("\n"), line: 1, dir: "down" },
    { text: ["9. девятый", "\t1. дочерний", "10. десятый"].join("\n"), line: 0, dir: "down", over: { noSelectionMode: "with-children" } },
  ];
  const bySetValue = [];
  const wide = [];
  let wrote = 0;
  for (const c of cases) {
    const r = move(c.text, c.line, c.dir, c.over);
    if (r.text === c.text) continue;
    wrote++;
    for (const w of r.writes) {
      if (w.kind === "setValue") { bySetValue.push(c.dir + " со строки " + c.line); continue; }
      const win = changedWindow(c.text, r.text);
      if (w.from !== win.first || w.to !== win.last) {
        wide.push(c.dir + " со строки " + c.line + ": переписано " + w.from + "–" + w.to
          + ", а разошлись строки " + win.first + "–" + win.last);
      }
    }
  }
  assert.ok(wrote >= 5, "переносов, изменивших текст, оказалось " + wrote + " — проверка гоняет не то (У-200)");
  assert.deepEqual(bySetValue, [],
    "эти переносы записаны через `setValue`, а он приезжает в Obsidian с `userEvent: \"set\"`"
    + " — на этой пометке фильтр нумерации выходит, и список остаётся с прежними номерами:\n  "
    + bySetValue.join("\n  "));
  assert.deepEqual(wide, [],
    "переписано больше, чем изменилось: фильтр нумерации пройдёт по лишним строкам и"
    + " перенумерует чужие списки:\n  " + wide.join("\n  "));
  ok("перенос записан правкой окна изменившихся строк, а не заменой документа");
}

console.log("\n" + passed + " проверок пройдено");
