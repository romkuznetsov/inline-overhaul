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

/**
 * Редактор на несколько строк: только то, что зовёт движок.
 *
 * Столбец каретки появился вместе со ступенью `word` (З-3): до неё движку
 * хватало номера строки, а слово у каретки без столбца не найти.
 */
function fakeEditor(lines, cursorLine, cursorCh) {
  const state = {
    lines: lines.slice(),
    cursor: { line: cursorLine, ch: Number(cursorCh) || 0 },
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


/* ====================================================================== */
/* Ступени: пятый режим, `Custom` и слово у каретки (задача заказчика З-3) */
/* ====================================================================== */

/*
 * Заметка, на которой все пять ступеней дают **разные** отрезки. Это условие
 * задачи, а не удобство: совпади две, и `pushUnique` выбросил бы одну, а
 * проверка объявила бы это правильным ответом (У-47).
 *
 *   0  # One                  заголовок первого уровня
 *   1  - alpha beta           родительский пункт
 *   2  \t- gamma delta        дочерний, на нём стоит каретка
 *   3  - omega                конец секции первого заголовка
 *   4  # Two                  второй заголовок того же уровня
 *   5  - last
 */
const STEP_LINES = [
  "# One",
  "- alpha beta",
  "\t- gamma delta",
  "- omega",
  "# Two",
  "- last",
];

/* Каретка внутри слова `gamma`: третий знак от начала слова. */
const STEP_CURSOR = { line: 2, ch: 5 };

/*
 * Ожидание выписано числами, а не пересчётом тех же функций (У-5): здесь
 * стоят номера строк и столбцов, которые человек увидит выделенными.
 */
const WORD_RANGE = [2, 3, 2, 8];
const LINE_RANGE = [2, 0, 2, 14];
const TREE_RANGE = [1, 0, 2, 14];
const HEAD_RANGE = [0, 0, 3, 7];
const NOTE_RANGE = [0, 0, 5, 6];

function selectionOf(ed) {
  const s = ed._selection();
  return s ? [s.from.line, s.from.ch, s.to.line, s.to.ch] : null;
}

/** Нажать столько раз, сколько ступеней ждём, и записать, что выделилось. */
function pressTimes(plugin, ed, times) {
  const out = [];
  for (let i = 0; i < times; i++) {
    engine.handleEnhancedSelectAllKeymap(plugin);
    out.push(selectionOf(ed));
  }
  return out;
}

function assertSeq(actual, expected, name) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(name + ": expected " + e + ", got " + a);
}

function stepPlugin(selectAll) {
  const ed = fakeEditor(STEP_LINES, STEP_CURSOR.line, STEP_CURSOR.ch);
  return { ed, plugin: fakePlugin(ed, Object.assign({
    enabled: true,
    useDelay: false,
    delayMs: 700,
    clearOnLast: false,
  }, selectAll)) };
}

(function testEveryModeWalksItsOwnSteps() {
  const expected = {
    "line-note": [LINE_RANGE, NOTE_RANGE],
    "line-tree-note": [LINE_RANGE, TREE_RANGE, NOTE_RANGE],
    "line-tree-header-note": [LINE_RANGE, TREE_RANGE, HEAD_RANGE, NOTE_RANGE],
    "word-line-tree-header-note": [WORD_RANGE, LINE_RANGE, TREE_RANGE, HEAD_RANGE, NOTE_RANGE],
  };
  for (const mode of Object.keys(expected)) {
    const want = expected[mode];
    const { ed, plugin } = stepPlugin({ mode });
    assertSeq(pressTimes(plugin, ed, want.length), want, "режим " + mode);
  }
})();

/*
 * `Custom` с тремя галочками из пяти — ровно пример заказчика: «пользователь
 * может выбрать только word, line, note — тогда цикл должен работать именно в
 * такой последовательности».
 */
(function testCustomTakesOnlyTickedSteps() {
  const { ed, plugin } = stepPlugin({
    mode: "custom",
    customSteps: { word: true, line: true, tree: false, heading: false, note: true },
  });
  assertSeq(pressTimes(plugin, ed, 3), [WORD_RANGE, LINE_RANGE, NOTE_RANGE],
    "`Custom` с тремя галочками идёт word, line, note");
})();

/* Порядок задают не галочки: он один и тот же, чем бы ни отметили. */
(function testCustomKeepsTheDeclaredOrder() {
  const { ed, plugin } = stepPlugin({
    mode: "custom",
    customSteps: { note: true, word: true, heading: false, line: false, tree: true },
  });
  assertSeq(pressTimes(plugin, ed, 3), [WORD_RANGE, TREE_RANGE, NOTE_RANGE],
    "порядок ступеней не зависит от порядка ключей в конфиге");
})();

(function testCustomWithOneTickStaysOnIt() {
  const { ed, plugin } = stepPlugin({
    mode: "custom",
    customSteps: { word: true, line: false, tree: false, heading: false, note: false },
  });
  assertSeq(pressTimes(plugin, ed, 2), [WORD_RANGE, WORD_RANGE],
    "одна галочка — одна ступень, и второе нажатие остаётся на ней");
})();

/*
 * Ни одной галочки — законное состояние: движок отказывается, и клавиша
 * остаётся клавишей Obsidian. Это то, что обещает строка панели.
 */
(function testCustomWithNothingTickedGivesTheKeyBack() {
  const { ed, plugin } = stepPlugin({
    mode: "custom",
    customSteps: { word: false, line: false, tree: false, heading: false, note: false },
  });
  assertEq(engine.handleEnhancedSelectAllKeymap(plugin), false, "движок отказывается");
  assertEq(ed._selection(), null, "и ничего не выделяет");
})();

/*
 * Слово у каретки: края строки, знак препинания и равное расстояние в обе
 * стороны. Строка одна, меняется только столбец каретки.
 *
 *   a l p h a ,   b e t a
 *   0 1 2 3 4 5 6 7 8 9 10
 */
(function testWordAtCaretOnEdgesAndPunctuation() {
  const line = ["alpha, beta"];
  const onlyWord = {
    mode: "custom",
    customSteps: { word: true, line: false, tree: false, heading: false, note: false },
  };
  const cases = [
    { ch: 0, want: [0, 0, 0, 5], why: "каретка в самом начале строки" },
    { ch: 3, want: [0, 0, 0, 5], why: "каретка внутри слова" },
    { ch: 5, want: [0, 0, 0, 5], why: "каретка вплотную к концу слова, перед запятой" },
    { ch: 6, want: [0, 0, 0, 5], why: "между запятой и пробелом расстояние равное, берётся левое" },
    { ch: 7, want: [0, 7, 0, 11], why: "каретка вплотную к началу второго слова" },
    { ch: 11, want: [0, 7, 0, 11], why: "каретка в самом конце строки" },
  ];
  for (const c of cases) {
    const ed = fakeEditor(line, 0, c.ch);
    const plugin = fakePlugin(ed, Object.assign({
      enabled: true, useDelay: false, delayMs: 700, clearOnLast: false,
    }, onlyWord));
    engine.handleEnhancedSelectAllKeymap(plugin);
    assertSeq(selectionOf(ed), c.want, "слово у каретки: " + c.why);
  }
})();

/* Слова в строке нет вовсе — ступень не выделяет пустоту, а не встаёт в цикл. */
(function testWordStepSkipsALineWithoutWords() {
  for (const text of ["", "   ", "-- ... --"]) {
    const ed = fakeEditor([text], 0, 0);
    const plugin = fakePlugin(ed, {
      enabled: true,
      mode: "custom",
      customSteps: { word: true, line: false, tree: false, heading: false, note: false },
      useDelay: false, delayMs: 700, clearOnLast: false,
    });
    assertEq(engine.handleEnhancedSelectAllKeymap(plugin), false,
      "ступень слова на строке " + JSON.stringify(text) + " не находит слова");
    assertEq(ed._selection(), null, "и ничего не выделяет");
  }
})();

/*
 * Тот же пятый режим на пути с задержкой: ветка сборки последовательности там
 * своя, и настройка, которую она не назовёт, до движка не доедет молча (У-56).
 */
(function testDelayPathWalksTheSameSteps() {
  const ed = fakeEditor(STEP_LINES, STEP_CURSOR.line, STEP_CURSOR.ch);
  const plugin = fakePlugin(ed, {
    enabled: true,
    mode: "custom",
    customSteps: { word: true, line: false, tree: true, heading: false, note: true },
    useDelay: true,
    delayMs: 2000,
    clearOnLast: false,
  });
  /*
   * Галочек тут три, и средняя — не `line`. Это не украшение фикстуры:
   * умолчание галочек даёт `line, note`, и на паре `word, note` подмена
   * «настройка до движка не доехала» дала бы **тот же** ответ на каждом
   * нажатии. Мутация была бы применена и ничего не сдвинула (У-110).
   */
  assertSeq(pressTimes(plugin, ed, 3), [WORD_RANGE, TREE_RANGE, NOTE_RANGE],
    "путь с задержкой берёт те же галочки");
})();

/*
 * Умолчание галочек читается из одного места и означает вполне определённое:
 * `Custom` без единой правки ведёт себя как `Line, then note`.
 */
(function testCustomWithoutConfigMeansLineThenNote() {
  const { ed, plugin } = stepPlugin({ mode: "custom" });
  assertSeq(pressTimes(plugin, ed, 2), [LINE_RANGE, NOTE_RANGE],
    "`Custom` без записанных галочек — это `Line, then note`");
})();

console.log("Enhanced select all regression tests: OK");
