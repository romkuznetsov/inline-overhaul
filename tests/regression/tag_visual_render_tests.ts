/**
 * Каким цветом плагин рисует токен Value в заметке.
 *
 * Проверка на НАСТОЯЩЕМ виджете отрисовки: `TagVisualTokenWidget` берётся из
 * `main.js` загрузчиком `tests/harness/plugin_internals.ts`. Подделан только
 * DOM — виджет живёт в редакторе Obsidian, и другого способа посмотреть на
 * его узел нет.
 *
 * Что здесь закреплено. Панель рисует пузырь Value цветом
 * `--io-bubble-fg, var(--text-on-accent)` (`styles.css`, `.io-bubble`), то
 * есть при незаданном цвете текста — «текст на цветной подложке». Заметка же
 * брала цвет темы, и одно и то же значение выглядело в двух местах
 * по-разному: в панели белым, в заметке чёрным (замечание заказчика
 * 2026-08-28). Теперь заметка берёт ту же переменную.
 */

import assert from "node:assert/strict";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;
const I = loadPluginInternals();

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok " + what); };

/** Собрать узел так же, как это делает отрисовка строки. */
function paint(fill: string, text: string): Any {
  const w = new I.TagVisualTokenWidget("#todo", fill, text, 1, false, 100, 100, 100, 100, 0, "");
  return w.toDOM();
}

{
  const el = paint("#0008f0", "#f0eaea");
  assert.equal(el.style.color, "#f0eaea", "заданный цвет текста берётся как есть");
  assert.equal(el.style.backgroundColor, "#0008f0", "и заливка тоже");
  ok("цвет текста задан — рисуется он");
}

{
  const el = paint("#0008f0", "");
  assert.equal(el.style.color, "var(--text-on-accent)",
    "цвет не задан, но заливка есть — берётся цвет темы для текста на подложке");
  ok("цвет не задан, заливка есть — текст на подложке, как в панели");
}

{
  /*
   * Без заливки цвет не подставляется, и это не осторожность ради
   * осторожности: `--text-on-accent` в светлой теме белый, и на белом фоне
   * заметки такой текст пропал бы совсем.
   */
  const el = paint("", "");
  assert.ok(!el.style.color, "заливки нет — цвет текста остаётся темы");
  ok("ни цвета, ни заливки — ничего не подставляется");
}

{
  /* Пустой Value рисуется пробелом: цвет ему всё равно не виден, но правило
     одно на все режимы, и подстановка не должна от режима зависеть. */
  const w = new I.TagVisualTokenWidget("#todo", "#0008f0", "", 1, true, 100, 100, 100, 100, 0, "");
  const el = w.toDOM();
  assert.equal(el.style.color, "var(--text-on-accent)", "правило одно на все режимы показа");
  ok("режим показа на подстановку не влияет");
}

console.log("\n" + passed + " проверок пройдено");
