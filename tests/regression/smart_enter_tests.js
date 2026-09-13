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
    newLinePrefix: "same",
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

/* ---- два условия тихого отказа ------------------------------------------- */

{
  const line = "- #123 || 12313 :: 👤111";
  assert.strictEqual(plan(line, 12, { enabled: false }), null,
    "выключенная функция обязана отдать клавишу платформе");

  /* Обычная заметка: ни одного разделителя плагина, слота текста нет. */
  const plain = "просто строка без наших разделителей";
  assert.strictEqual(bounds(plain), null, "у обычной строки не должно быть слота текста");
  assert.strictEqual(plan(plain, 5), null, "в обычной заметке клавиша не наша");
  ok("два условия тихого отказа: выключено и не наша строка");
}

/*
 * ---- где клавиша работает: вся строка или только слот текста -------------
 *
 * **Третьего условия отказа здесь больше нет, и это починка.** Стояло «курсор
 * за вторым разделителем — клавиша платформенная», с объяснением «там рвать
 * нечего». Заказчик прошёл строку курсором по всем зонам и назвал это
 * неверным: «курсор находился на сепараторе 2, а также в right block — не ок
 * (поведение обычного enter)». Рвать там есть что — саму запись.
 *
 * Поэтому мерится **вся строка, по одному месту курсора на зону**, а не один
 * выбранный случай: именно обход зон и нашёл дефект, которого проверка не
 * видела. Оба положения гоняются на одних и тех же местах, и разница между
 * ними обязана быть ровно в зонах значений.
 */
{
  const line = "- [ ] 📅2026-09-13 10:45 #todo || 13123 :: #/1 👤111";
  const b = bounds(line);
  assert.ok(b, "у строки заказчика нет слота текста — мерить нечего");
  assert.strictEqual(line.slice(b.start, b.end), "13123",
    "слот текста найден не там: " + JSON.stringify(line.slice(b.start, b.end)));

  const spots = [
    ["в левом Block, до первого разделителя", line.indexOf("#todo"), false],
    ["на первом разделителе", line.indexOf("||"), false],
    ["в тексте между разделителями", b.start + 2, true],
    ["на втором разделителе", line.indexOf("::"), false],
    ["в правом Block", line.indexOf("👤"), false],
    ["в самом конце строки", line.length, false],
  ];

  for (const [where, ch, insideText] of spots) {
    assert.ok(ch >= 0, "место курсора не нашлось: " + where);
    assert.strictEqual(
      (ch >= b.start && ch <= b.end), insideText,
      "случай выбран не тот: " + where + " — слот текста " + b.start + "…" + b.end + ", курсор " + ch
    );
    assert.ok(plan(line, ch, { scope: "line" }),
      "`Anywhere in the line`: клавиша обязана работать — " + where);
    assert.strictEqual(!!plan(line, ch, { scope: "text" }), insideText,
      "`Only in your text`: клавиша работает ровно в тексте человека — " + where);
  }

  /*
   * Положительный контроль разницы: между положениями обязано быть расхождение
   * хотя бы на одном месте. Без него оба положения могли бы вести себя
   * одинаково, и всё выше было бы зелёным (У-88).
   */
  const differ = spots.filter(([, ch]) =>
    !!plan(line, ch, { scope: "line" }) !== !!plan(line, ch, { scope: "text" }));
  assert.ok(differ.length > 0, "положения `Where it works` не расходятся ни на одном месте курсора");

  /* Умолчание — «вся строка»: это поведение, которое у заказчика уже стоит. */
  assert.ok(plan(line, line.indexOf("👤")),
    "без указания положения клавиша работает во всей строке");
  ok("Where it works: вся строка против слота текста, шесть мест курсора");
}

/*
 * Слот текста бывает и у строки с одним разделителем, и его границы считает то
 * же правило. Его слова: «либо если в строке только один сепаратор — после
 * сепаратора1 или до сепаратора2».
 */
{
  const only2 = "- 13123 :: #/1";
  const b2 = bounds(only2);
  assert.ok(b2, "у строки с одним вторым разделителем обязан быть слот текста");
  assert.strictEqual(only2.slice(b2.start, b2.end), "13123", "слот найден не там: " + only2);
  assert.ok(plan(only2, b2.start + 1, { scope: "text" }),
    "в тексте строки с одним разделителем клавиша наша");
  assert.strictEqual(plan(only2, only2.indexOf("#/1"), { scope: "text" }), null,
    "а в правом Block той же строки — нет");

  const only1 = "- #todo || 13123";
  const b1 = bounds(only1);
  assert.ok(b1, "у строки с одним первым разделителем обязан быть слот текста");
  assert.strictEqual(only1.slice(b1.start, b1.end), "13123", "слот найден не там: " + only1);
  assert.ok(plan(only1, b1.start + 1, { scope: "text" }),
    "после первого разделителя клавиша наша");
  assert.strictEqual(plan(only1, only1.indexOf("#todo"), { scope: "text" }), null,
    "а до него — нет");
  ok("строка с одним разделителем: слот текста с той стороны, где текст");
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
  /* Положение `none`: остаётся только отступ. */
  const cases = [
    ["- #a || текст :: 👤1", ""],
    ["\t\t3. #a || текст :: 👤1", "\t\t"],
    ["  - [x] #a || текст :: 👤1", "  "],
  ];
  for (const [line, want] of cases) {
    const p = plan(line, line.indexOf(" :: "), { newLinePrefix: "none" });
    assert.ok(p, "нет плана для " + JSON.stringify(line));
    assert.strictEqual(p.newLineText, want,
      "без знака для " + JSON.stringify(line) + ": " + JSON.stringify(p.newLineText));
  }
  ok("положение `none` оставляет отступ и снимает знак");
}

{
  /*
   * Третье положение — решение заказчика 2026-09-13. Его слова: «нет, но
   * кроме как если префикс нумерация, тогда да». Значит нумерованный список
   * не теряет счёт, а всё остальное — включая чекбокс — уходит.
   *
   * Случаи подобраны так, чтобы третье положение **отличалось** от обоих
   * соседних: маркер (отличается от `same`), номер (отличается от `none`) и
   * номер с чекбоксом (отличается от обоих).
   */
  const cases = [
    /* [строка, `same`, `none`, `number-only`] */
    ["- #a || текст :: 👤1", "- ", "", ""],
    ["3. #a || текст :: 👤1", "4. ", "", "4. "],
    ["\t3. [x] #a || текст :: 👤1", "\t4. [ ] ", "\t", "\t4. "],
    ["- [x] #a || текст :: 👤1", "- [ ] ", "", ""],
    ["#a || текст :: 👤1", "", "", ""],
  ];
  let differsFromSame = 0;
  let differsFromNone = 0;
  for (const [line, same, none, only] of cases) {
    const at = line.indexOf(" :: ");
    assert.strictEqual(plan(line, at, { newLinePrefix: "same" }).newLineText, same,
      "`same` для " + JSON.stringify(line));
    assert.strictEqual(plan(line, at, { newLinePrefix: "none" }).newLineText, none,
      "`none` для " + JSON.stringify(line));
    assert.strictEqual(plan(line, at, { newLinePrefix: "number-only" }).newLineText, only,
      "`number-only` для " + JSON.stringify(line));
    if (only !== same) differsFromSame++;
    if (only !== none) differsFromNone++;
  }
  /*
   * Положительный контроль: третье положение обязано отличаться от каждого из
   * двух соседних хотя бы на одном случае. Иначе это не третий режим, а второе
   * имя одного из двух, и проверка выше была бы зелёной у настройки, которая
   * ничего не делает (У-110).
   */
  assert.ok(differsFromSame >= 2,
    "`number-only` совпал с `same` почти везде (" + differsFromSame + ") — это не третий режим");
  assert.ok(differsFromNone >= 2,
    "`number-only` совпал с `none` почти везде (" + differsFromNone + ") — это не третий режим");
  ok("третье положение: счёт нумерованного списка остаётся, всё остальное уходит");
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
  const on = Object.assign({ editor: { smartEnter: { enabled: true, newLinePrefix: "same" } } }, seps);
  const off = Object.assign({ editor: { smartEnter: { enabled: false, newLinePrefix: "same" } } }, seps);

  const line = "- #123 #work #new || 12313 :: [[test1]] 👤111";
  const ch = line.indexOf(" :: ");

  const ed = makeEditor([line, "соседняя"], { line: 0, ch });
  assert.strictEqual(handleSmartEnterKeymap(plugin(on, ed)), true, "обработчик обязан взять клавишу");
  assert.deepStrictEqual(ed.lines, [line, "- ", "соседняя"],
    "новая строка встала не туда: " + ed.lines.join(" | "));
  assert.deepStrictEqual(ed.cursor, { line: 1, ch: 2 }, "курсор не переехал на новую строку");

  /*
   * Настройка обязана доезжать до движка, а не подставляться обработчиком.
   * Без этого случая подмена «обработчик всегда просит `same`» проходит
   * незамеченной: остальные проверки гоняют ровно `same` (У-15).
   */
  const numbered = "3. #123 || 12313 :: 👤111";
  const numberedCh = numbered.indexOf(" :: ");
  const onlyNum = Object.assign(
    { editor: { smartEnter: { enabled: true, newLinePrefix: "number-only" } } }, seps);
  const edNum = makeEditor([numbered], { line: 0, ch: numberedCh });
  assert.strictEqual(handleSmartEnterKeymap(plugin(onlyNum, edNum)), true,
    "обработчик обязан взять клавишу и на нумерованной строке");
  assert.deepStrictEqual(edNum.lines, [numbered, "4. "],
    "положение из настроек до движка не доехало: " + edNum.lines.join(" | "));

  const bare = Object.assign(
    { editor: { smartEnter: { enabled: true, newLinePrefix: "none" } } }, seps);
  const edBare = makeEditor([numbered], { line: 0, ch: numberedCh });
  assert.strictEqual(handleSmartEnterKeymap(plugin(bare, edBare)), true, "то же с `none`");
  assert.deepStrictEqual(edBare.lines, [numbered, ""],
    "положение `none` до движка не доехало: " + edBare.lines.join(" | "));

  /*
   * `Where it works` — такая же настройка, и доезжать до движка она обязана
   * тем же способом. Без этого случая подмена «обработчик всегда просит
   * `line`» проходит незамеченной (У-15). Курсор стоит в правом Block: это
   * единственное место, где положения расходятся видимо.
   */
  const inRight = line.indexOf("👤");
  const scopeText = Object.assign(
    { editor: { smartEnter: { enabled: true, newLinePrefix: "same", scope: "text" } } }, seps);
  const edScope = makeEditor([line], { line: 0, ch: inRight });
  assert.strictEqual(handleSmartEnterKeymap(plugin(scopeText, edScope)), false,
    "`Only in your text` до движка не доехало: клавиша взята в правом Block");
  assert.deepStrictEqual(edScope.lines, [line], "при отказе строка обязана остаться прежней");

  const scopeLine = Object.assign(
    { editor: { smartEnter: { enabled: true, newLinePrefix: "same", scope: "line" } } }, seps);
  const edScope2 = makeEditor([line], { line: 0, ch: inRight });
  assert.strictEqual(handleSmartEnterKeymap(plugin(scopeLine, edScope2)), true,
    "`Anywhere in the line`: в правом Block клавиша наша — это и было замечание заказчика");
  assert.deepStrictEqual(edScope2.lines, [line, "- "],
    "новая строка встала не туда: " + edScope2.lines.join(" | "));

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
  const noSeps = { editor: { smartEnter: { enabled: true, newLinePrefix: "same" } }, pkm: { lineFormat: {} } };
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
  /* Умолчание режима — `same`: вызов без него обязан вести себя как раньше. */
  assert.strictEqual(nextMarkerFor("9. пункт", undefined), "10. ", "без режима работает как `same`");
  assert.strictEqual(nextMarkerFor("9. пункт", "number-only"), "10. ", "счёт остаётся");
  assert.strictEqual(nextMarkerFor("- пункт", "number-only"), "", "маркер уходит");
  assert.strictEqual(nextMarkerFor("### заголовок"), "", "решётки заголовка на новую строку не едут");
  assert.strictEqual(sharedUtils.lineMarkerOf("### заголовок").marker, "",
    "заголовок знаком списка не считается");
  ok("знак новой строки повторяет то, что делает сам Obsidian");
}

console.log("\n" + passed + " проверок пройдено");
