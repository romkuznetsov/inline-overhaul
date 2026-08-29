/**
 * Разбор `Move left` / `Move right` (PRD 10.6, Д1–Д3).
 *
 * Таблица — документация поведения, и её ценность ровно в том, что она не
 * врёт. Поэтому проверка не сверяет тексты сами с собой, а читает **исходник
 * рантайма** (`navigation_runtime.js`, функция `indentLine`) и требует, чтобы
 * порядок ветвей в нём совпадал с порядком строк в таблице.
 *
 * Файл рантайма под З3, и проверка его только читает. Если поведение однажды
 * поменяют, эта проверка покраснеет и заставит поправить таблицу тем же
 * коммитом — этого и требует Д3.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { dispatchTables, DISPATCH_TABLES } from "../../src/ui/settings/custom/dispatch_tables.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";

setupGlobals();

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

function all(node: StubNode, cls: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (n.classList.contains(cls)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

/* ---- что рисуется ------------------------------------------------------ */

{
  const host = makeNode("div");
  const close = dispatchTables(host as unknown as El, {} as never);

  const caps = all(host, "io-ordercol__cap").map(n => n.textContent);
  assert.deepEqual(caps, ["Move left", "Move right"], "две таблицы, по одной на команду");

  const lists = all(host, "io-order");
  assert.equal(lists.length, 2, "у каждой команды свой список шагов");
  for (const list of lists) {
    assert.equal(list.children.length, 3, "в каждой таблице три шага");
  }
  const thens = all(host, "io-order__then").map(n => n.textContent);
  assert.deepEqual(thens, [
    "move that text",
    "remove one indent level",
    "cycle the prefix backwards",
    "move that text",
    "add one indent level",
    "cycle the prefix forwards",
  ], "и следствия в том порядке, в каком их пробует рантайм");

  close();
  assert.equal(all(host, "io-order").length, 0, "очистка убирает за собой");
  assert.equal(all(host, "io-dispatch").length, 1,
    "но снимает только своё поддерево: строка настройки принадлежит платформе");
  ok("две таблицы по три шага, и очистка их снимает");
}

/* ---- Д2: таблица совпадает с рантаймом --------------------------------- */

/**
 * Тело `indentLine` из `navigation_runtime.js`. Читается исходником: другого
 * способа увидеть ПОРЯДОК ветвей нет — вызвать функцию можно, но тогда
 * проверка утверждала бы то же самое через мок редактора, а порядок остался бы
 * недоказанным.
 */
function indentLineSource(): string {
  const src = fs.readFileSync(path.join(root, "navigation_runtime.js"), "utf8");
  const at = src.indexOf("function indentLine(");
  assert.ok(at > 0, "не нашлась indentLine в navigation_runtime.js");
  const end = src.indexOf("\nfunction ", at + 10);
  return src.slice(at, end > 0 ? end : src.length);
}

{
  const body = indentLineSource();

  /* Ветка `left`: сперва отступ, потом цикл Prefix. */
  const left = body.slice(body.indexOf('direction === "left"'), body.indexOf("if (currentIndent > 0 || isBullet"));
  const leftIndentAt = left.indexOf("removeOneIndent");
  const leftCycleAt = left.indexOf('cycleLineType(editor, lineNo, "left"');
  assert.ok(leftIndentAt > 0 && leftCycleAt > 0, "в ветке left нашлись обе развилки");
  assert.ok(leftIndentAt < leftCycleAt,
    "Move left: отступ снимается раньше, чем циклируется Prefix — как в таблице");

  /* Ветка `right`: сперва «список или уже с отступом», потом цикл Prefix. */
  const right = body.slice(body.indexOf("if (currentIndent > 0 || isBullet"));
  const rightIndentAt = right.indexOf("isBullet(line)");
  const rightCycleAt = right.indexOf('cycleLineType(editor, lineNo, "right"');
  assert.ok(rightIndentAt >= 0 && rightCycleAt > 0, "в ветке right нашлись обе развилки");
  assert.ok(rightIndentAt < rightCycleAt,
    "Move right: элемент списка получает отступ раньше, чем циклируется Prefix");

  /*
   * Асимметрия, названная в Д2 словами: слева цикл идёт при нулевом отступе
   * всегда, справа — только если строка ещё не элемент списка. Именно это
   * различие и делает таблицы разными, и именно оно проверяется.
   */
  assert.ok(!left.includes("isBullet"),
    "Move left про элемент списка не спрашивает: в таблице слева этого условия нет");
  assert.ok(right.includes("isBullet"),
    "Move right спрашивает: в таблице справа это условие есть");
  ok("Д2: порядок ветвей рантайма совпадает с порядком строк в таблицах");
}

{
  /* Строки таблицы называют то же, что и рантайм: отступ, Prefix, текст. */
  const left = DISPATCH_TABLES[0];
  const right = DISPATCH_TABLES[1];
  assert.ok(left?.steps[1]?.then.includes("indent"), "второй шаг слева про отступ");
  assert.ok(left?.steps[2]?.then.includes("prefix"), "третий — про Prefix");
  assert.ok(right?.steps[1]?.when.includes("list item"),
    "второй шаг справа спрашивает про элемент списка");
  assert.ok(right?.steps[2]?.then.includes("forwards")
    && left?.steps[2]?.then.includes("backwards"),
    "и направления цикла названы разными словами");
  ok("строки таблиц называют те же три вещи, что и рантайм");
}

console.log("\n" + passed + " проверок пройдено");
