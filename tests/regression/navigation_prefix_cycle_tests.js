"use strict";
/**
 * Симметричный цикл Prefix: `Move right` меняет вид строки наравне с
 * `Move left` (В-12, PRD 10.13.11).
 *
 * Проверка на НАСТОЯЩЕЙ функции плагина: `moveSelection` и
 * `pickMoveSelectionCfg` берутся из `navigation_runtime.js`. Подделан только
 * **редактор** — команда работает с открытой заметкой, и другого способа
 * позвать её вне Obsidian нет. Подделка минимальная: одна строка, курсор и
 * запись обратно; ни одного решения о том, что должно получиться, она не
 * принимает.
 *
 * До правки в правой ветке `indentLine` стояло `isBullet(line)`, и оно уводило
 * буллит в отступ: с обычной строки `Move right` циклировал ровно один раз, а
 * `Move left` при нулевом отступе — сколько угодно.
 */

const path = require("path");
const nav = require(path.join(__dirname, "..", "..", "navigation_runtime.js"));

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

/** Редактор на одну строку: только то, что зовёт `moveSelection`. */
function fakeEditor(line) {
  const state = { line, cursor: { line: 0, ch: line.length } };
  return {
    getSelection: () => "",
    getCursor: () => ({ ...state.cursor }),
    getLine: () => state.line,
    setLine: (_no, next) => { state.line = next; },
    setCursor: (pos) => { state.cursor = { ...pos }; },
    setSelection: () => {},
    replaceRange: (text, from, to) => {
      const end = to ? to.ch : from.ch;
      state.line = state.line.slice(0, from.ch) + text + state.line.slice(end);
    },
    posToOffset: (p) => p.ch,
    offsetToPos: (ch) => ({ line: 0, ch }),
    getValue: () => state.line,
    read: () => state.line,
  };
}

/** Одно нажатие на строке и то, что от неё осталось. */
function press(line, direction, over) {
  const ed = fakeEditor(line);
  nav.moveSelection(ed, direction, Object.assign({
    inlineEnabled: true,
    prefixCyclerEnabled: true,
    indentFallbackEnabled: true,
    onCycleEnd: "indent",
    /* Порядок выбран так, что ни буллит, ни обычная строка не стоят
       последними: конец цикла — отдельное правило (`After the last one`), и
       путать его с «строка уже элемент списка» проверка не должна. */
    cycleOrder: ["", "#", "##", "- ", "1. "],
  }, over || {}));
  return ed.getValue();
}

(function testRightCyclesOnAListItem() {
  /* Ради этого всё и затевалось: буллит без отступа меняет вид, а не съезжает. */
  assertEq(press("- text", "right", { rightCycles: true }), "1. text",
    "включённый тумблер: правое направление циклирует и на буллите");
  assertEq(press("- text", "right", { rightCycles: false }), "    - text",
    "выключенный тумблер: правое направление только сдвигает");
})();

(function testPlainLineUnchangedByTheToggle() {
  assertEq(press("text", "right", { rightCycles: true }), "# text",
    "обычная строка циклирует при включённом тумблере");
  assertEq(press("text", "right", { rightCycles: false }), "    text",
    "и сдвигается при выключенном");
})();

(function testEndOfCycleStillIndents() {
  /* Конец списка — по-прежнему конец: `After the last one` = `Increase
     indent` отдаёт управление отступу, и включённый тумблер этого не меняет.
     Это и есть ответ на вопрос, сдвинет ли `Move right` строку когда-нибудь. */
  assertEq(press("1. text", "right", { rightCycles: true }), "    1. text",
    "последнее значение цикла уступает отступу");
  assertEq(press("1. text", "right", { rightCycles: true, onCycleEnd: "wrap" }), "text",
    "а со `Start over` цикл заворачивается, и отступа не будет вовсе");
})();

(function testLeftDirectionIsNotTouched() {
  assertEq(press("- text", "left", { rightCycles: true }),
    press("- text", "left", { rightCycles: false }),
    "левое направление тумблер не трогает вовсе");
  assertEq(press("- text", "left", { rightCycles: true }), "## text",
    "и продолжает идти по списку в обратную сторону");
})();

(function testIndentedLineStillMoves() {
  assertEq(press("    - text", "right", { rightCycles: true }), "        - text",
    "строка с отступом сдвигается в любом случае: цикл только при нулевом отступе");
  assertEq(press("    - text", "left", { rightCycles: true }), "- text",
    "и снимает отступ в обратную сторону");
})();

(function testCyclerOffMeansNoCycleAtAll() {
  assertEq(press("- text", "right", { rightCycles: true, prefixCyclerEnabled: false }), "    - text",
    "выключенный цикл Prefix сильнее тумблера направления");
})();

console.log("Navigation prefix cycle tests: OK");
