"use strict";
/**
 * Расширенное `Ctrl+A`: цикл выделения и снятие выделения на последнем нажатии.
 *
 * Проверка на НАСТОЯЩЕЙ функции плагина: `handleEnhancedSelectAllKeymap`
 * берётся у движка. Подделан только **редактор** — команда работает с открытой
 * заметкой, и другого способа позвать её вне Obsidian нет (У-1). Подделка
 * минимальная: строки, курсор, выделение; ни одного решения о том, что должно
 * получиться, она не принимает.
 *
 * Зачем пин. Тумблер `Clear selection on last press` не работал: ключ переехал
 * в `editor.selectAll.clearOnLast`, а движок спрашивал имя версии 1
 * (`clearSelectionOnLastPress`). Соседние ключи того же объекта переехали
 * правильно — значит, это пропуск при переносе, а не задумка (У-15, У-16;
 * замечание заказчика D4, 2026-09-02).
 */

const path = require("path");
const engine = require(path.join(__dirname, "..", "..", "src", "features", "enhanced_select_all_engine.js"));

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

const LINES = [
  "- родительская строка",
  "\t- дочерняя",
  "- следующая",
];

/** Редактор на несколько строк: только то, что зовёт движок. */
function fakeEditor(lines, cursorLine) {
  const state = {
    lines: lines.slice(),
    cursor: { line: cursorLine, ch: 0 },
    sel: null,
  };
  return {
    lastLine: () => state.lines.length - 1,
    getLine: (n) => state.lines[n],
    getCursor: (which) => {
      if (!state.sel) return { ...state.cursor };
      return which === "to" ? { ...state.sel.to } : { ...state.sel.from };
    },
    setCursor: (p) => { state.cursor = { ...p }; state.sel = null; },
    setSelection: (from, to) => { state.sel = { from: { ...from }, to: { ...to } }; },
    /* Читается проверкой, движком — нет. */
    _selection: () => state.sel,
  };
}

/** Плагин в том виде, в каком его зовёт движок. */
function fakePlugin(editor, selectAll) {
  return {
    getConfig: () => ({ editor: { selectAll } }),
    getActiveEditor: () => editor,
    _enhancedSelectAllCycle: null,
  };
}

/* Ожидание выписано отдельно от того, из чего рисуется результат (У-5): здесь
   перечислены нажатия и то, что после них видно, а не пересчитан тот же цикл. */

(function testLastPressClearsSelectionWhenAskedTo() {
  const ed = fakeEditor(LINES, 0);
  const plugin = fakePlugin(ed, {
    enabled: true,
    mode: "line-note",
    useDelay: false,
    delayMs: 700,
    clearOnLast: true,
  });

  assertEq(engine.handleEnhancedSelectAllKeymap(plugin), true, "первое нажатие выделяет строку");
  assertEq(Boolean(ed._selection()), true, "после первого нажатия выделение есть");
  assertEq(ed._selection().from.line, 0, "выделена строка под курсором");
  assertEq(ed._selection().to.line, 0, "и только она");

  assertEq(engine.handleEnhancedSelectAllKeymap(plugin), true, "второе нажатие выделяет заметку");
  assertEq(ed._selection().to.line, LINES.length - 1, "выделена вся заметка");

  assertEq(engine.handleEnhancedSelectAllKeymap(plugin), true, "третье нажатие обрабатывается");
  assertEq(ed._selection(), null, "на последнем нажатии выделение снято");
})();

(function testLastPressWrapsAroundWhenNotAskedTo() {
  const ed = fakeEditor(LINES, 0);
  const plugin = fakePlugin(ed, {
    enabled: true,
    mode: "line-note",
    useDelay: false,
    delayMs: 700,
    clearOnLast: false,
  });

  engine.handleEnhancedSelectAllKeymap(plugin);
  engine.handleEnhancedSelectAllKeymap(plugin);
  assertEq(ed._selection().to.line, LINES.length - 1, "второе нажатие выделяет заметку");

  engine.handleEnhancedSelectAllKeymap(plugin);
  assertEq(Boolean(ed._selection()), true, "выключенный тумблер выделение не снимает");
  assertEq(ed._selection().to.line, 0, "цикл идёт по кругу и возвращается к строке");
})();

/*
 * Тот же тумблер на пути с задержкой: ветка там своя, и до правки старое имя
 * ключа стояло в обеих.
 */
(function testDelayPathHonoursTheSameToggle() {
  const ed = fakeEditor(LINES, 0);
  const plugin = fakePlugin(ed, {
    enabled: true,
    mode: "line-note",
    useDelay: true,
    delayMs: 2000,
    clearOnLast: true,
  });

  engine.handleEnhancedSelectAllKeymap(plugin);
  engine.handleEnhancedSelectAllKeymap(plugin);
  engine.handleEnhancedSelectAllKeymap(plugin);
  assertEq(ed._selection(), null, "путь с задержкой тоже снимает выделение на последнем нажатии");
})();

console.log("Enhanced select all regression tests: OK");
