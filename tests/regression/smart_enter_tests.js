"use strict";

/**
 * Smart Enter (PRD 10.13.88).
 *
 * Проверяется решение, а не запись: `planSmartEnter` — чистая функция, и её
 * ответ здешний `apply` подставляет в текст. Это не подделка движка: `apply`
 * делает ровно одну вещь — вставляет строку за нынешней (У-4).
 *
 * Границы слота текста считает настоящий `getTextSlotBounds` из
 * `pkm_macro_shared.js` — то же правило, которым их считает курсор после
 * команды. Своего разбора строки здесь нет.
 *
 * Отдельно проверяются **условия тихого отказа**: их три, и каждое возвращает
 * `null`. Тихий отказ неотличим от дефекта, поэтому он выписан поимённо (У-41).
 */

const assert = require("assert");
const engine = require("../../src/features/smart_enter_engine.js");
const macroShared = require("../../src/core/pkm_macro_shared.js");
const sharedUtils = require("../../src/core/shared_utils.js");
const { planSmartEnter, nextMarkerFor, handleSmartEnterKeymap } = engine;

let passed = 0;
const ok = (label) => {
  passed++;
  console.log("  ok " + label);
};

/*
 * Разделители заказчика, и они **разные**. При одинаковых правило «слот текста
 * кончается на втором» верно само собой, и переворот прошёл бы незамеченным
 * (У-147).
 */
const RULES = { io: { separator1: "||", separator2: "::" } };

function bounds(line) {
  return macroShared.getTextSlotBounds(line, RULES);
}

function plan(line, ch, opts) {
  return planSmartEnter(Object.assign({
    enabled: true,
    lineText: line,
    ch,
    textSlot: bounds(line),
    keepPrefix: true,
  }, opts || {}));
}

/** Что увидит человек: две строки вместо одной, прежняя нетронутой. */
function apply(line, result) {
  return [line, result.newLineText];
}

/* ---- главный случай заказчика ------------------------------------------ */

{
  /* Его строка и его курсор: сразу за `12313`, до второго разделителя. */
  const line = "- #123 #work #new || 12313 :: [[test1]] 👤111";
  const ch = line.indexOf(" :: ");
  /*
   * Положительный контроль: у строки обязан быть слот текста. Без него всё
   * ниже было бы зелёным от того, что движок отказывается на каждом вопросе
   * (У-88).
   */
  const b = bounds(line);
  assert.ok(b, "у строки заказчика нет слота текста — мерить нечего");
  assert.strictEqual(line.slice(b.start, b.end), "12313",
    "слот текста найден не там: " + JSON.stringify(line.slice(b.start, b.end)));

  const p = plan(line, ch);
  assert.ok(p, "план не построен на случае, ради которого функция заказана");
  const out = apply(line, p);
  assert.strictEqual(out[0], line, "строка, из которой нажали Enter, обязана остаться прежней");
  assert.strictEqual(out[1], "- ", "новая строка получает тот же знак списка");
  assert.strictEqual(p.cursorCh, 2, "курсор встаёт за знаком списка");
  ok("Enter до второго разделителя добавляет строку, а не рвёт нынешнюю");
}

/* ---- три условия тихого отказа ------------------------------------------ */

{
  const line = "- #123 || 12313 :: 👤111";
  assert.strictEqual(plan(line, 12, { enabled: false }), null,
    "выключенная функция обязана отдать клавишу платформе");

  /* Обычная заметка: ни одного разделителя плагина, слота текста нет. */
  const plain = "просто строка без наших разделителей";
  assert.strictEqual(bounds(plain), null, "у обычной строки не должно быть слота текста");
  assert.strictEqual(plan(plain, 5), null, "в обычной заметке клавиша не наша");

  /* Курсор в правом Block — за концом слота текста. */
  const afterSep = line.indexOf("👤");
  assert.ok(afterSep > bounds(line).end, "курсор для проверки выбран не за слотом");
  assert.strictEqual(plan(line, afterSep), null,
    "за вторым разделителем клавиша остаётся платформенной");
  ok("три условия тихого отказа: выключено, не наша строка, курсор за вторым разделителем");
}

/* ---- знак списка на новой строке ---------------------------------------- */

{
  const cases = [
    /* [строка, что ждём при keepPrefix=true] */
    ["- #a || текст :: 👤1", "- "],
    ["* #a || текст :: 👤1", "* "],
    ["3. #a || текст :: 👤1", "4. "],
    /* Чекбокс уезжает пустым: новая строка не может быть сделанной задачей. */
    ["- [x] #a || текст :: 👤1", "- [ ] "],
    ["- [ ] #a || текст :: 👤1", "- [ ] "],
    /* Отступ остаётся при любом положении тумблера. */
    ["\t\t- #a || текст :: 👤1", "\t\t- "],
    /* Знака нет — повторять нечего. */
    ["#a || текст :: 👤1", ""],
    /*
     * Заголовок знаком списка не считается: решётки на новую строку не
     * переносит ни Obsidian, ни мы. Случай стоит здесь потому, что сверка
     * двух читателей начала строки его как раз пропускает — у неё заголовок
     * исключён, и без этой строки правило не держал бы никто.
     */
    ["### заголовок || текст :: 👤1", ""],
  ];
  for (const [line, want] of cases) {
    const p = plan(line, line.indexOf(" :: "));
    assert.ok(p, "нет плана для " + JSON.stringify(line));
    assert.strictEqual(p.newLineText, want,
      "знак новой строки для " + JSON.stringify(line) + ": " + JSON.stringify(p.newLineText));
  }
  ok("знак списка повторяется, номер растёт, чекбокс приходит пустым");
}

{
  /* Выключенный тумблер знака: остаётся только отступ. */
  const cases = [
    ["- #a || текст :: 👤1", ""],
    ["\t\t3. #a || текст :: 👤1", "\t\t"],
    ["  - [x] #a || текст :: 👤1", "  "],
  ];
  for (const [line, want] of cases) {
    const p = plan(line, line.indexOf(" :: "), { keepPrefix: false });
    assert.ok(p, "нет плана для " + JSON.stringify(line));
    assert.strictEqual(p.newLineText, want,
      "без знака для " + JSON.stringify(line) + ": " + JSON.stringify(p.newLineText));
  }
  ok("выключенный тумблер знака оставляет отступ и снимает маркер");
}

/* ---- два читателя одного правила о начале строки ------------------------ */

{
  /*
   * `linePrefixLength` и `lineMarkerOf` читают одни и те же выражения, но
   * ходят по строке порознь. Расхождение двух читателей — тот самый класс,
   * которым формы Prefix расходились трижды (У-32), поэтому оно спрашивается
   * прямо.
   */
  const lines = [
    "- пункт", "* пункт", "+ пункт", "12. пункт", "3) пункт",
    "- [ ] задача", "- [x] задача", "\t\t- вложенный", "  12. с отступом",
    "> цитата", "> > дважды", "### заголовок", "просто текст", "",
  ];
  let withMarker = 0;
  for (const line of lines) {
    const p = sharedUtils.lineMarkerOf(line);
    const full = sharedUtils.linePrefixLength(line, true);
    if (p.marker) withMarker++;
    /* Заголовок `linePrefixLength` снимает, а знаком списка не считает никто:
       на новую строку решётки не переносятся ни здесь, ни в Obsidian. */
    if (/^\s*#{1,6}\s/.test(line)) continue;
    assert.strictEqual(p.at, full,
      "два читателя начала строки разошлись на " + JSON.stringify(line)
      + ": " + p.at + " против " + full);
  }
  assert.ok(withMarker >= 8,
    "положительный контроль: знаков списка в примерах " + withMarker + " — сверять нечего");
  ok("`lineMarkerOf` и `linePrefixLength` сходятся на всех формах начала строки");
}

/* ---- обработчик клавиши ------------------------------------------------- */

{
  /*
   * Подделан здесь только редактор Obsidian: DOM и его editor в Node нет.
   * Сам движок настоящий, и решение принимает он.
   */
  const makeEditor = (lines, cursor) => ({
    lines: lines.slice(),
    cursor: Object.assign({}, cursor),
    getLine(n) { return this.lines[n]; },
    lastLine() { return this.lines.length - 1; },
    getCursor() { return Object.assign({}, this.cursor); },
    setCursor(pos) { this.cursor = Object.assign({}, pos); },
    somethingSelected() { return this.selected === true; },
    listSelections() { return this.selections || [{}]; },
    replaceRange(text, from, to) {
      const left = this.lines[from.line].slice(0, from.ch);
      const right = this.lines[to.line].slice(to.ch);
      const merged = (left + text + right).split("\n");
      this.lines.splice(from.line, to.line - from.line + 1, ...merged);
    },
  });

  const plugin = (cfg, editor) => ({
    getConfig: () => cfg,
    getActiveEditor: () => editor,
  });

  const seps = { pkm: { lineFormat: { separator1: "||", separator2: "::" } } };
  const on = Object.assign({ editor: { smartEnter: { enabled: true, keepPrefix: true } } }, seps);
  const off = Object.assign({ editor: { smartEnter: { enabled: false, keepPrefix: true } } }, seps);

  const line = "- #123 #work #new || 12313 :: [[test1]] 👤111";
  const ch = line.indexOf(" :: ");

  const ed = makeEditor([line, "соседняя"], { line: 0, ch });
  assert.strictEqual(handleSmartEnterKeymap(plugin(on, ed)), true, "обработчик обязан взять клавишу");
  assert.deepStrictEqual(ed.lines, [line, "- ", "соседняя"],
    "новая строка встала не туда: " + ed.lines.join(" | "));
  assert.deepStrictEqual(ed.cursor, { line: 1, ch: 2 }, "курсор не переехал на новую строку");

  const ed2 = makeEditor([line], { line: 0, ch });
  assert.strictEqual(handleSmartEnterKeymap(plugin(off, ed2)), false, "выключенная функция взяла клавишу");
  assert.deepStrictEqual(ed2.lines, [line], "выключенная функция тронула текст");

  const ed3 = makeEditor([line], { line: 0, ch });
  ed3.selected = true;
  assert.strictEqual(handleSmartEnterKeymap(plugin(on, ed3)), false, "при выделении клавиша не наша");

  const ed4 = makeEditor([line], { line: 0, ch });
  ed4.selections = [{}, {}];
  assert.strictEqual(handleSmartEnterKeymap(plugin(on, ed4)), false, "при двух курсорах клавиша не наша");

  const ed5 = makeEditor(["обычная строка заметки"], { line: 0, ch: 5 });
  assert.strictEqual(handleSmartEnterKeymap(plugin(on, ed5)), false,
    "в заметке без наших разделителей клавиша остаётся обычной");
  assert.deepStrictEqual(ed5.lines, ["обычная строка заметки"], "обычная заметка тронута");

  /* Разделителей в настройках нет — движок обязан молчать, а не гадать. */
  const noSeps = { editor: { smartEnter: { enabled: true, keepPrefix: true } }, pkm: { lineFormat: {} } };
  const ed6 = makeEditor([line], { line: 0, ch });
  assert.strictEqual(handleSmartEnterKeymap(plugin(noSeps, ed6)), false,
    "без разделителей в настройках клавиша не наша");

  assert.strictEqual(handleSmartEnterKeymap({}), false, "без конфига обработчик упал");
  assert.strictEqual(handleSmartEnterKeymap(plugin(on, null)), false, "без редактора обработчик упал");
  ok("обработчик берёт клавишу только в своём случае и не падает без окружения");
}

/* ---- знак новой строки спрашивается у платформы -------------------------- */

{
  assert.strictEqual(nextMarkerFor("9. пункт"), "10. ", "номер растёт через десяток");
  assert.strictEqual(nextMarkerFor("- [X] задача"), "- [ ] ", "чекбокс с любой буквой приходит пустым");
  assert.strictEqual(nextMarkerFor("текст"), "", "у строки без знака повторять нечего");
  assert.strictEqual(nextMarkerFor("### заголовок"), "", "решётки заголовка на новую строку не едут");
  assert.strictEqual(sharedUtils.lineMarkerOf("### заголовок").marker, "",
    "заголовок знаком списка не считается");
  ok("знак новой строки повторяет то, что делает сам Obsidian");
}

console.log("\n" + passed + " проверок пройдено");
