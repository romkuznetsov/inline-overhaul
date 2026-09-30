"use strict";

/**
 * Признак «это не строка текста» — `isCodeOrTableLine` (BUGHUNT 2026-09-26 R4,
 * 2026-09-30 Q1). Его спрашивают команды полей, tagWheel, Transform, плавающая
 * кнопка, Smart Enter и Smart Delete. Ожидания выписаны строками (правило 5);
 * у каждого рода — отрицательный контроль, строка, которую путать нельзя.
 */

const assert = require("assert");
const { isCodeOrTableLine } = require("../../src/core/shared_utils.js");

/* Геттер как у CodeMirror: за концом документа бросает. */
const ask = (doc, n) => {
  const lines = doc.split("\n");
  return isCodeOrTableLine((i) => { if (i < 0 || i >= lines.length) throw new RangeError("нет строки " + i); return lines[i]; }, n);
};
const cases = [
  /* frontmatter — обе черты и свойства; тело после неё — текст */
  ["---\ntitle: a\n---\nbody", [true, true, true, false]],
  ["---\ntitle: a\n...\nbody", [true, true, true, false]],
  /* незакрытая черта в начале — линия, а строки под ней текст */
  ["---\ntext", [true, false]],
  /* горизонтальная линия трёх видов; список и слово с дефисами — текст */
  ["a\n\n---\n\n***\n_ _ _\n- - x\n-- x", [false, false, true, false, true, true, false, false]],
  /* таблица — с рядом-разделителем; строка `|| …` без него — текст */
  ["| a | b |\n|---|:-:|\n| 1 | 2 |\n\n|| 📅2026-10-01\n|| x", [true, true, true, false, false, false]],
  /* код и ограда */
  ["```js\ncode\n```\ntext", [true, true, true, false]],
];
for (const [doc, want] of cases) {
  want.forEach((w, n) => assert.strictEqual(ask(doc, n), w, JSON.stringify(doc) + " строка " + n));
}
console.log("not_text_line_tests: " + cases.length + " документов, признак отвечает построчно");
