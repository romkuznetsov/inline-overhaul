"use strict";

/**
 * Smart Delete (PRD 10.13.32).
 *
 * Проверяется решение, а не запись: `planSmartDelete` — чистая функция, и то,
 * что она вернула, применяет к тексту здешний `apply`. Это не подделка
 * редактора: `apply` не повторяет правил движка, он делает ровно одну вещь —
 * подставляет строку в диапазон, который движок назвал (У-4).
 *
 * Отдельно проверяются **условия тихого отказа**: их четыре, и каждое
 * возвращает `null`. Тихий отказ неотличим от дефекта, поэтому он выписан
 * проверками поимённо (У-41).
 */

const assert = require("assert");
const engine = require("../../src/features/smart_delete_engine.js");
const {
  planSmartDelete, planSmartBackspace, junkLengthOf,
  handleSmartDeleteKeymap, handleSmartBackspaceKeymap,
} = engine;

let passed = 0;
const ok = (label) => {
  passed++;
  console.log("  ok " + label);
};

/** Применить план к двум строкам так, как это сделает редактор. */
function apply(lineText, nextLineText, plan) {
  const left = lineText.slice(0, plan.fromCh);
  const right = nextLineText.slice(plan.toCh);
  return { text: left + plan.insert + right, cursorCh: plan.cursorCh };
}

const ON = { enabled: true, dropPrefix: true, joinWithSpace: true };

/* ---- главный случай заказчика ------------------------------------------ */

{
  const line = "- задача";
  const next = "\t- [ ] подзадача";
  const plan = planSmartDelete({ ...ON, lineText: line, nextLineText: next, ch: line.length });
  assert.ok(plan, "план не построен на случае, ради которого функция заказана");
  const out = apply(line, next, plan);
  assert.strictEqual(out.text, "- задача подзадача",
    "отступ и Prefix приехали вместе с текстом: " + out.text);
  assert.strictEqual(out.cursorCh, line.length, "курсор ушёл с места стыка");
  ok("отступ и чекбокс следующей строки не приезжают");
}

{
  /* Нумерованный список, цитата и заголовок — тот же мусор. */
  const cases = [
    ["  12. второй", "первый второй"],
    ["> > цитата", "первый цитата"],
    ["### заголовок", "первый заголовок"],
    ["   * пункт", "первый пункт"],
  ];
  for (const [next, expected] of cases) {
    const line = "первый";
    const plan = planSmartDelete({ ...ON, lineText: line, nextLineText: next, ch: line.length });
    assert.ok(plan, "нет плана для " + JSON.stringify(next));
    assert.strictEqual(apply(line, next, plan).text, expected,
      "разбор Prefix: " + JSON.stringify(next));
  }
  ok("номер, цитата, заголовок и звёздочка снимаются наравне с дефисом");
}

/* ---- пустая строка уходит целиком (Д5) --------------------------------- */

{
  for (const next of ["", "   ", "- ", "\t- [ ] ", "#### "]) {
    const line = "текст";
    const plan = planSmartDelete({ ...ON, lineText: line, nextLineText: next, ch: line.length });
    assert.ok(plan, "нет плана для пустой строки " + JSON.stringify(next));
    assert.strictEqual(plan.emptied, true, "строка " + JSON.stringify(next) + " должна уйти целиком");
    const out = apply(line, next, plan);
    assert.strictEqual(out.text, "текст", "от пустой строки что-то осталось: " + out.text);
  }
  ok("строка, в которой один Prefix, исчезает целиком");
}

/* ---- пробел на стыке (Д6) ---------------------------------------------- */

{
  const same = (line, next, opts) =>
    apply(line, next, planSmartDelete({ ...ON, ...opts, lineText: line, nextLineText: next, ch: line.length })).text;

  assert.strictEqual(same("- слово", "- ещё"), "- слово ещё", "пробел на стыке не поставлен");
  assert.strictEqual(same("- слово ", "- ещё"), "- слово ещё", "второй пробел там, где уже был первый");
  assert.strictEqual(same("- слово", "- ещё", { joinWithSpace: false }), "- словоещё",
    "тумблер выключен, а пробел всё равно поставлен");
  assert.strictEqual(same("", "- ещё"), "ещё", "пустая строка слева получила ведущий пробел");
  ok("пробел на стыке ставится один и только когда есть что разделять");
}

/* ---- тумблер Prefix (Д7) ----------------------------------------------- */

{
  const line = "первый";
  const next = "    - [x] второй";
  const kept = planSmartDelete({ ...ON, dropPrefix: false, lineText: line, nextLineText: next, ch: line.length });
  assert.strictEqual(apply(line, next, kept).text, "первый - [x] второй",
    "с выключенным тумблером Prefix обязан остаться");
  const dropped = planSmartDelete({ ...ON, lineText: line, nextLineText: next, ch: line.length });
  assert.strictEqual(apply(line, next, dropped).text, "первый второй", "включённый тумблер Prefix не снял");
  ok("тумблер Prefix решает, снимать его или один отступ");
}

/* ---- четыре условия тихого отказа (Д3, У-41) --------------------------- */

{
  const base = { ...ON, lineText: "- задача", nextLineText: "\t- ещё", ch: 8 };
  assert.strictEqual(planSmartDelete({ ...base, enabled: false }), null,
    "выключенная функция обязана отдать клавишу платформе");
  assert.strictEqual(planSmartDelete({ ...base, ch: 3 }), null,
    "курсор в середине строки: `Del` должен остаться прежним");
  assert.strictEqual(planSmartDelete({ ...base, nextLineText: undefined }), null,
    "ниже нет строки: склеивать нечего");
  assert.ok(planSmartDelete({ ...base, lineText: "- задача   ", ch: 8 }),
    "хвостовые пробелы справа от курсора концом строки считаться должны");
  ok("четыре условия отказа названы поимённо и каждое возвращает null");
}

/* ---- смещение мусора считается одним разбором -------------------------- */

{
  assert.strictEqual(junkLengthOf("    текст", true), 4, "отступ");
  assert.strictEqual(junkLengthOf("    - текст", true), 6, "отступ и маркер");
  assert.strictEqual(junkLengthOf("    - текст", false), 4, "без снятия Prefix остаётся отступ");
  assert.strictEqual(junkLengthOf("1. текст", true), 3, "номер");
  assert.strictEqual(junkLengthOf("текст", true), 0, "чистой строке снимать нечего");
  ok("разбор мусора считает смещение, а не переписывает строку");
}

/* ---- зеркальный случай: Backspace (Д9) --------------------------------- */

{
  /** Применить план Backspace: диапазон идёт от верхней строки к нижней. */
  const applyBack = (prevText, lineText, plan) =>
    prevText.slice(0, plan.fromCh) + plan.insert + lineText.slice(plan.toCh);

  const back = (prev, line, ch, over) => planSmartBackspace({
    ...ON, prevLineText: prev, lineText: line, ch, ...(over || {}),
  });

  const top = "- задача";
  const bottom = "\t- [ ] подзадача";
  const p1 = back(top, bottom, 0);
  assert.ok(p1, "план не построен на главном случае Backspace");
  assert.strictEqual(applyBack(top, bottom, p1), "- задача подзадача",
    "наверх уехал отступ или Prefix");
  assert.strictEqual(p1.cursorCh, "- задача ".length, "курсор встал не перед приехавшим текстом");

  /* Оформление верхней строки снимать нельзя: она никуда не едет. */
  const keepTop = "\t- [ ] верхняя";
  const p2 = back(keepTop, "- нижняя", 0);
  assert.strictEqual(applyBack(keepTop, "- нижняя", p2), "\t- [ ] верхняя нижняя",
    "у верхней строки сняли её собственное оформление");

  /* Курсор внутри Prefix — тоже начало строки: слева один мусор. */
  assert.ok(back("верх", "  - низ", 4), "курсор внутри Prefix должен считаться началом");
  assert.strictEqual(back("верх", "  - низ", 5), null, "курсор в тексте: Backspace не наш");
  assert.strictEqual(back(undefined, "- низ", 0), null, "выше нет строки: склеивать нечего");
  assert.strictEqual(back("верх", "- низ", 0, { enabled: false }), null,
    "выключенная функция обязана отдать клавишу");

  /* Пустая строка уходит целиком, хвост верхней не трогается. */
  const p3 = back("верх ", "   ", 0);
  assert.strictEqual(p3.emptied, true, "пустая строка обязана уйти целиком");
  assert.strictEqual(applyBack("верх ", "   ", p3), "верх ", "хвост верхней строки подстригли без нужды");
  ok("Backspace в начале строки отправляет наверх слова, а не оформление");
}

/* ---- обработчик клавиши ------------------------------------------------ */

{
  /*
   * Подделан здесь только редактор Obsidian: DOM и его editor в Node нет.
   * Сам движок настоящий, и решение принимает он.
   */
  const makeEditor = (lines, cursor) => ({
    lines: lines.slice(),
    cursor: { ...cursor },
    getLine(n) { return this.lines[n]; },
    lastLine() { return this.lines.length - 1; },
    getCursor() { return { ...this.cursor }; },
    setCursor(pos) { this.cursor = { ...pos }; },
    somethingSelected() { return this.selected === true; },
    listSelections() { return this.selections || [{}]; },
    replaceRange(text, from, to) {
      const left = this.lines[from.line].slice(0, from.ch);
      const right = this.lines[to.line].slice(to.ch);
      this.lines.splice(from.line, to.line - from.line + 1, left + text + right);
    },
  });

  const plugin = (cfg, editor) => ({
    getConfig: () => cfg,
    getActiveEditor: () => editor,
  });

  const on = { editor: { smartDelete: { enabled: true, dropPrefix: true, joinWithSpace: true } } };

  const ed = makeEditor(["- задача", "\t- [ ] подзадача"], { line: 0, ch: 8 });
  assert.strictEqual(handleSmartDeleteKeymap(plugin(on, ed)), true, "обработчик обязан взять клавишу");
  assert.deepStrictEqual(ed.lines, ["- задача подзадача"], "строки склеились не так: " + ed.lines.join(" | "));
  assert.deepStrictEqual(ed.cursor, { line: 0, ch: 8 }, "курсор ушёл с места стыка");

  const off = { editor: { smartDelete: { enabled: false } } };
  const ed2 = makeEditor(["- задача", "\t- [ ] подзадача"], { line: 0, ch: 8 });
  assert.strictEqual(handleSmartDeleteKeymap(plugin(off, ed2)), false, "выключенная функция взяла клавишу");
  assert.deepStrictEqual(ed2.lines, ["- задача", "\t- [ ] подзадача"], "выключенная функция тронула текст");

  const ed3 = makeEditor(["- задача", "\t- ещё"], { line: 0, ch: 8 });
  ed3.selected = true;
  assert.strictEqual(handleSmartDeleteKeymap(plugin(on, ed3)), false, "при выделении клавиша не наша");

  const ed4 = makeEditor(["- задача", "\t- ещё"], { line: 0, ch: 8 });
  ed4.selections = [{}, {}];
  assert.strictEqual(handleSmartDeleteKeymap(plugin(on, ed4)), false, "при двух курсорах клавиша не наша");

  const ed5 = makeEditor(["последняя"], { line: 0, ch: 9 });
  assert.strictEqual(handleSmartDeleteKeymap(plugin(on, ed5)), false, "на последней строке склеивать нечего");

  /* Без конфига и без редактора обработчик обязан молчать, а не падать. */
  assert.strictEqual(handleSmartDeleteKeymap({}), false, "без конфига обработчик упал");
  assert.strictEqual(handleSmartDeleteKeymap(plugin(on, null)), false, "без редактора обработчик упал");
  ok("обработчик берёт клавишу только в своём случае и не падает без окружения");

  /*
   * Отдельный тумблер: заказчик выбрал именно это, отказавшись от общего на
   * обе клавиши. Включённый Smart Delete `Backspace` сам по себе не трогает.
   */
  const ed6 = makeEditor(["верх", "\t- [ ] низ"], { line: 1, ch: 0 });
  assert.strictEqual(handleSmartBackspaceKeymap(plugin(on, ed6)), false,
    "без своего тумблера Backspace остаётся обычным");
  assert.deepStrictEqual(ed6.lines, ["верх", "\t- [ ] низ"], "текст тронут без разрешения");

  const bothOn = { editor: { smartDelete: {
    enabled: true, dropPrefix: true, joinWithSpace: true, onBackspace: true,
  } } };
  const ed7 = makeEditor(["верх", "\t- [ ] низ"], { line: 1, ch: 0 });
  assert.strictEqual(handleSmartBackspaceKeymap(plugin(bothOn, ed7)), true,
    "со своим тумблером клавиша наша");
  assert.deepStrictEqual(ed7.lines, ["верх низ"], "склейка вверх вышла не так: " + ed7.lines.join(" | "));
  assert.deepStrictEqual(ed7.cursor, { line: 0, ch: 5 }, "курсор после Backspace встал не туда");

  const ed8 = makeEditor(["первая"], { line: 0, ch: 0 });
  assert.strictEqual(handleSmartBackspaceKeymap(plugin(bothOn, ed8)), false,
    "на первой строке склеивать нечего");
  ok("Backspace включается своим тумблером, а не общим");

  /*
   * Тумблеры независимы (заказчик 2026-09-05, поздний вечер, 10.13.32 Д11).
   *
   * Сперва `Backspace` был подчинён `Smart Delete`: сначала спрашивался
   * `enabled`, и только потом `onBackspace`. Заказчик попросил включать их
   * врозь, и здесь проверяется именно это — не «оба включены работают», а
   * **одна включённая клавиша при выключенной второй**, в обе стороны.
   * Возврат прежнего порядка условий красит первую же строку.
   */
  const backOnly = { editor: { smartDelete: {
    enabled: false, onBackspace: true, dropPrefix: true, joinWithSpace: true,
  } } };
  const ed9 = makeEditor(["верх", "\t- [ ] низ"], { line: 1, ch: 0 });
  assert.strictEqual(handleSmartBackspaceKeymap(plugin(backOnly, ed9)), true,
    "Smart backspace обязан работать при выключенном Smart Delete");
  assert.deepStrictEqual(ed9.lines, ["верх низ"],
    "склейка вверх без Smart Delete вышла не так: " + ed9.lines.join(" | "));

  const ed10 = makeEditor(["- задача", "\t- [ ] подзадача"], { line: 0, ch: 8 });
  assert.strictEqual(handleSmartDeleteKeymap(plugin(backOnly, ed10)), false,
    "включённый Smart backspace не даёт прав клавише Del");
  assert.deepStrictEqual(ed10.lines, ["- задача", "\t- [ ] подзадача"],
    "Del тронул текст, не имея своего тумблера");

  const delOnly = { editor: { smartDelete: {
    enabled: true, onBackspace: false, dropPrefix: true, joinWithSpace: true,
  } } };
  const ed11 = makeEditor(["верх", "\t- [ ] низ"], { line: 1, ch: 0 });
  assert.strictEqual(handleSmartBackspaceKeymap(plugin(delOnly, ed11)), false,
    "включённый Smart Delete не даёт прав клавише Backspace");
  ok("каждая клавиша спрашивает только свой тумблер, в обе стороны");
}

console.log("\n" + passed + " проверок пройдено");
