"use strict";

/**
 * Smart paste (`З-31` и `З-32`, его пункт 9 от 2026-09-21).
 *
 * Проверяется решение, а не запись: `planSmartPaste` — чистая функция, и её
 * ответ здешний `apply` подставляет в текст ровно так же, как это делает
 * `editor.replaceSelection`. Подделки движка тут нет: разбор начала строки и
 * пересчёт номеров берутся у настоящего `shared_utils.js` (У-4).
 *
 * **Чего эти проверки не отвечают, и я называю это вслух.** Продолжение счёта
 * под имеющимся списком пишет фильтр нумерации Obsidian, а не плагин (У-245,
 * правило 167). Здесь проверяется то, что плагин **подаёт** платформе;
 * что платформа с этим делает, меряет `node tools/renumber_bench.js` — у него
 * есть раздел вставки, и его случаи сняты с настоящего `app.js`.
 *
 * Условия тихого отказа выписаны поимённо: тихий отказ неотличим от дефекта
 * (У-41).
 */

const assert = require("assert");
const engine = require("../../src/features/smart_paste_engine.js");
const { planSmartPaste, handleSmartPaste } = engine;

let passed = 0;
const ok = (label) => {
  passed++;
  console.log("  ok " + label);
};

function plan(pasted, lineText, ch, opts) {
  return planSmartPaste(Object.assign({
    enabled: true,
    pasted,
    lineText: lineText == null ? "" : lineText,
    ch: ch == null ? 0 : ch,
  }, opts || {}));
}

/** Что увидит человек: вставка легла в строку на место курсора. */
function apply(lineText, ch, result) {
  const src = String(lineText);
  return (src.slice(0, ch) + result.insert + src.slice(ch)).split("\n");
}

/* ---- его случай: вырезанный список начинается с девятки ----------------- */

{
  const pasted = "9. девятый\n10. десятый\n11. одиннадцатый";
  const r = plan(pasted, "", 0);
  assert.ok(r, "его главный случай движок не взял");
  assert.deepStrictEqual(apply("", 0, r),
    ["1. девятый", "2. десятый", "3. одиннадцатый"],
    "список обязан начаться с единицы: " + JSON.stringify(r.insert));
  ok("вырезанный список 9..11 приходит счётом с единицы");
}

{
  /*
   * Подсписок внутри вставки считается **своим** уровнем: у каждого уровня
   * счёт начинается заново. Фикстура нарочно разводит номера — при списке,
   * где все уровни начинаются одинаково, переворот правила «уровень свой»
   * прошёл бы незамеченным (У-147).
   */
  const pasted = "5. пятый\n\t7. седьмой\n\t8. восьмой\n6. шестой";
  const r = plan(pasted, "", 0);
  assert.ok(r, "вложенный список движок не взял");
  assert.deepStrictEqual(apply("", 0, r),
    ["1. пятый", "\t1. седьмой", "\t2. восьмой", "2. шестой"],
    "уровни считаются не по отдельности: " + JSON.stringify(r.insert));
  ok("подсписок внутри вставки тоже начинается с единицы");
}

/* ---- его второй случай: вставка пункта в строку, у которой знак уже есть - */

{
  /* Его пример дословно: `1. text` в `2. ` даёт `2. text`. */
  const line = "2. ";
  const r = plan("1. text", line, line.length);
  assert.ok(r, "вставку пункта в пустой пункт движок не взял");
  assert.deepStrictEqual(apply(line, line.length, r), ["2. text"],
    "получилось не то, что он написал: " + JSON.stringify(r.insert));
  ok("`1. text` в `2. ` даёт `2. text`");
}

{
  /* Его второй пример дословно: `1. text` в `2. aaa` даёт `2. aaa text`. */
  const line = "2. aaa";
  const r = plan("1. text", line, line.length);
  assert.ok(r, "вставку пункта в непустой пункт движок не взял");
  assert.deepStrictEqual(apply(line, line.length, r), ["2. aaa text"],
    "получилось не то, что он написал: " + JSON.stringify(r.insert));
  ok("`1. text` в `2. aaa` даёт `2. aaa text`");
}

{
  /*
   * Пробел ставится по **признаку**, а не всегда: слева от курсора пусто —
   * пробела нет. Без этого случая правило «пробел на стыке» и правило «пробел
   * всегда» неразличимы, а второе портит его первый же пример.
   */
  const line = "- [ ] ";
  const r = plan("- пункт", line, line.length);
  assert.ok(r, "вставку буллита в пустую задачу движок не взял");
  assert.deepStrictEqual(apply(line, line.length, r), ["- [ ] пункт"],
    "лишний пробел на пустом слоте: " + JSON.stringify(r.insert));
  ok("на пустом слоте пробел не приписывается");
}

{
  /*
   * Курсор **до** знака списка — вставка не стыкуется: там человек пишет не в
   * продолжение пункта, а перед ним. Правило спрашивает место курсора, а не
   * только наличие знака (У-177).
   */
  const line = "2. aaa";
  const r = plan("1. text", line, 0);
  assert.strictEqual(r, null,
    "курсор до знака — вставка обязана идти обычным путём: " + JSON.stringify(r && r.insert));
  ok("курсор до знака списка: вставка обычная");
}

{
  /* У строки без знака стыковать нечего, и одиночная строка проходит мимо. */
  assert.strictEqual(plan("1. text", "обычная строка", 7), null,
    "в строке без знака списка вставка обязана идти обычным путём");
  ok("строка без знака списка: вставка обычная");
}

/* ---- условия тихого отказа --------------------------------------------- */

{
  assert.strictEqual(plan("9. девятый\n10. десятый", "", 0, { enabled: false }), null,
    "выключенная функция вмешалась");
  assert.strictEqual(plan("", "2. ", 3), null, "пустой буфер");
  assert.strictEqual(planSmartPaste(null), null, "вызов без аргументов уронил движок");
  assert.strictEqual(plan("просто текст", "", 0), null,
    "обычный текст трогать нечем, и вставка обязана остаться платформенной");
  assert.strictEqual(plan("1. один\n2. два", "", 0), null,
    "список уже с единицы: вмешиваться не во что");
  ok("четыре условия тихого отказа и вызов без аргументов");
}

/* ---- обработчик события ------------------------------------------------- */

{
  const makeEditor = (lines, from) => ({
    lines: lines.slice(),
    from: Object.assign({}, from),
    inserted: null,
    getLine(n) { return this.lines[n]; },
    getCursor(which) {
      assert.strictEqual(which, "from",
        "место вставки спрашивается у начала выделения, а не у его конца");
      return Object.assign({}, this.from);
    },
    replaceSelection(text) {
      this.inserted = text;
      const src = this.lines[this.from.line];
      const merged = src.slice(0, this.from.ch) + text + src.slice(this.from.ch);
      this.lines.splice(this.from.line, 1, ...merged.split("\n"));
    },
  });

  const plugin = (cfg) => ({ getConfig: () => cfg });
  const on = { editor: { smartPaste: { enabled: true } } };
  const off = { editor: { smartPaste: { enabled: false } } };

  const evt = (text, prevented) => ({
    defaultPrevented: prevented === true,
    prevented: false,
    preventDefault() { this.prevented = true; },
    clipboardData: { getData: () => text },
  });

  {
    const ed = makeEditor(["2. "], { line: 0, ch: 3 });
    const e = evt("1. text");
    assert.strictEqual(handleSmartPaste(plugin(on), e, ed), true, "обработчик обязан взять вставку");
    assert.strictEqual(e.prevented, true, "событие не погашено: вставка ляжет дважды");
    assert.deepStrictEqual(ed.lines, ["2. text"], "в документ ушло не то: " + JSON.stringify(ed.inserted));
  }

  {
    /* Выключенная функция не трогает ни событие, ни документ. */
    const ed = makeEditor(["2. "], { line: 0, ch: 3 });
    const e = evt("1. text");
    assert.strictEqual(handleSmartPaste(plugin(off), e, ed), false, "выключенная функция взяла вставку");
    assert.strictEqual(e.prevented, false, "выключенная функция погасила событие");
    assert.deepStrictEqual(ed.lines, ["2. "], "выключенная функция тронула текст");
  }

  {
    /*
     * Событие, которое уже забрали, — так велит сам тип в `obsidian.d.ts`:
     * «Check for `evt.defaultPrevented` before attempting to handle this
     * event». Вторая вставка поверх первой была бы дефектом, а не функцией.
     */
    const ed = makeEditor(["2. "], { line: 0, ch: 3 });
    assert.strictEqual(handleSmartPaste(plugin(on), evt("1. text", true), ed), false,
      "обработчик полез в уже погашенное событие");
    assert.deepStrictEqual(ed.lines, ["2. "], "уже погашенное событие тронуло текст");
  }

  {
    /* Буфера без текста — проба платформы, а не отказ. */
    const ed = makeEditor(["2. "], { line: 0, ch: 3 });
    assert.strictEqual(handleSmartPaste(plugin(on), evt(""), ed), false, "пустой буфер взят");
    const noData = { defaultPrevented: false, preventDefault() {}, clipboardData: null };
    assert.strictEqual(handleSmartPaste(plugin(on), noData, ed), false, "буфера нет вовсе");
  }

  assert.strictEqual(handleSmartPaste({}, evt("1. text"), null), false, "без конфига обработчик упал");
  assert.strictEqual(handleSmartPaste(plugin(on), null, null), false, "без события обработчик упал");
  assert.strictEqual(handleSmartPaste(plugin(on), evt("1. text"), {}), false,
    "редактор без `replaceSelection` обязан отдавать вставку платформе");
  ok("обработчик берёт вставку только в своём случае и не падает без окружения");
}

/* ---- запись идёт обычной правкой, а не `setValue` ----------------------- */

{
  /*
   * Форма записи — правило платформы (У-245, правило 167): `Editor.setValue`
   * ставит `userEvent: "set"`, а на нём фильтр нумерации Obsidian из себя
   * выходит и счёт под имеющимся списком не продолжает. Проверяется поведением
   * обработчика, а не чтением: редактор, у которого есть **обе** двери,
   * запоминает, в какую вошли.
   */
  const ed = {
    lines: ["2. "],
    used: [],
    getLine(n) { return this.lines[n]; },
    getCursor() { return { line: 0, ch: 3 }; },
    replaceSelection(t) { this.used.push("replaceSelection"); this.lines = [this.lines[0] + t]; },
    setValue(v) { this.used.push("setValue"); this.lines = String(v).split("\n"); },
  };
  const e = { defaultPrevented: false, preventDefault() {}, clipboardData: { getData: () => "1. text" } };
  assert.strictEqual(handleSmartPaste({ getConfig: () => ({ editor: { smartPaste: { enabled: true } } }) }, e, ed),
    true, "обработчик не взял вставку");
  assert.deepStrictEqual(ed.used, ["replaceSelection"],
    "запись пошла не обычной правкой: " + ed.used.join(", "));
  ok("вставка пишется обычной правкой, и фильтр нумерации Obsidian её видит");
}

console.log("\n" + passed + " проверок пройдено");
