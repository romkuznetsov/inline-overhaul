"use strict";

/**
 * Smart bracket: круг скобок у выделения и у каретки (BUGHUNT 2026-09-30,
 * B15). Команда берётся из определений Binder — той же дорогой, какой её
 * заводит плагин; редактор — подделка с одной строкой.
 */

const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const registry = require(path.join(root, "src/features/command_registry.js"));
const ids = require(path.join(root, "src/features/command_ids.js"));

const def = registry.buildBinderCommandDefs({ editor: { binder: { rows: [{ rowId: "r1", commandId: ids.SMART_BRACKET_COMMAND_ID }] } } })
  .find((d) => d.id === ids.SMART_BRACKET_COMMAND_ID);
assert.ok(def, "контроль: команда Smart bracket собрана");

function press(line, ch, selTo) {
  let text = line;
  let head = { line: 0, ch };
  let anchor = { line: 0, ch: selTo === undefined ? ch : selTo };
  const lo = () => (anchor.ch <= head.ch ? anchor : head);
  const hi = () => (anchor.ch <= head.ch ? head : anchor);
  const ed = {
    getCursor: (w) => (w === "from" ? lo() : w === "to" ? hi() : head),
    getSelection: () => text.slice(lo().ch, hi().ch),
    getLine: () => text,
    replaceRange: (ins, a, b) => { const e = b || a; text = text.slice(0, a.ch) + ins + text.slice(e.ch); },
    setCursor: (p) => { head = p; anchor = p; },
    setSelection: (a, b) => { anchor = a; head = b; },
  };
  def.run({ getActiveEditor: () => ed });
  return { text, ch: head.ch };
}

assert.equal(press("- [[Note]] x", 5).text, "- Note x", "B15: каретка внутри ссылки — скобки ссылки снимаются");
assert.equal(press("- [[Note]] x", 4).text, "- Note x", "B15: каретка у начала ссылки — то же");
assert.equal(press("- [[Note]] x", 8).text, "- Note x", "B15: каретка у конца ссылки — то же");
assert.equal(press("- [Note] x", 4).text, "- [[Note]] x", "B15: каретка внутри скобок — ссылка");
assert.equal(press("- [ ] task", 10).text, "- [ ] task[]", "пара, закрытая до каретки, не её пара");
assert.equal(press("- [ab", 3).text, "- [[ab", "открывающая без пары растёт, остаток строки не удваивается");
assert.equal(press("- [[ab", 4).text, "- [ab", "двойная без пары сжимается, остаток строки не удваивается");
assert.equal(press("- word x", 2, 6).text, "- [word] x", "выделение — по-прежнему в скобки");
assert.equal(press("- a b", 3).text, "- a[] b", "каретка вне пары — пустые скобки");
{
  // Его замечание к тесту 3 цикла 113: каретка внутри слова берёт слово в скобки, и круг замыкается
  let s = press("с Man1 x", 4);
  assert.equal(s.text, "с [Man1] x", "каретка внутри слова — слово в скобки");
  s = press(s.text, s.ch);
  assert.equal(s.text, "с [[Man1]] x", "второе нажатие — ссылка");
  s = press(s.text, s.ch);
  assert.equal(s.text, "с Man1 x", "третье — скобки сняты, круг замкнулся");
  assert.equal(press("с Man1 x", 6).text, "с Man1[] x", "у края слова — по-прежнему пустые скобки");
}
console.log("ok smart bracket: круг скобок у каретки внутри пары, остаток строки не удваивается");
