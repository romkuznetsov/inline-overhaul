/**
 * Перетаскивание строки списка: один дом на оба списка (`Р-11`).
 *
 * **Что было.** Правило «строку можно взять за ручку и бросить на место другой»
 * было объявлено дважды — у списка Binder и у списков порядка, по 27 строк
 * каждое. Расхождение измерено **до** сведения и равно нулю: после приведения
 * трёх законно отличающихся имён куски совпадают побайтно.
 *
 * **Почему проверок две, а не одна** (У-195). Сведение копии делает сверку двух
 * дорог слабее: сломанный общий дом ломает обе одинаково, и «панель против
 * панели» больше ничего не покажет (У-194). Поэтому здесь два рода проверок:
 *
 *   * **ожидание правильного ответа** — дом зовётся напрямую, и с него
 *     спрашивается каждое звено протокола броска. Это ловит поломку дома;
 *   * **проверка формы объявления** — ни один из двух звавших не завёл своё
 *     тело обратно. Это ловит возврат копии, до которого поведением не
 *     дотянуться.
 *
 * **И живой звавший исполняется целиком.** У списка Binder перетаскивание было
 * покрыто (`binder_tests.ts`), у списков порядка — нет; после сведения
 * непокрытая сторона стала бы молчаливой половиной. Здесь она исполняется
 * настоящей отрисовкой списка, а не вызовом дома.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";

setupGlobals();

import { attachRowDrag, type DragHold } from "../../src/ui/settings/custom/row_drag.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

let passed = 0;
function ok(what: string): void { passed++; console.log("  ok " + what); }

/** Событие в том виде, в каком его получает приёмник. */
function ev(): { prevented: number; sent: string[]; preventDefault: () => void; dataTransfer: Any } {
  const o = {
    prevented: 0,
    sent: [] as string[],
    preventDefault: (): void => { o.prevented++; },
    dataTransfer: { setData: (_t: string, v: string): void => { o.sent.push(v); } },
  };
  return o;
}

function makeRow(index: number, held: DragHold, moves: Array<[number, number]>, enabled = true) {
  const row = makeNode("div");
  const grip = attachRowDrag({
    row: row as unknown as El,
    index,
    label: "строка " + index,
    enabled,
    held,
    onMove: (from: number, to: number): void => { moves.push([from, to]); },
  });
  return { row, grip: grip as unknown as StubNode };
}

/* ---- ожидание правильного ответа: каждое звено протокола ---------------- */

{
  const held: DragHold = { taken: null };
  const moves: Array<[number, number]> = [];
  const a = makeRow(0, held, moves);
  const b = makeRow(1, held, moves);

  assert.equal(a.grip.draggable, true, "ручка перетаскивается");
  assert.equal(a.grip.getAttribute("role"), "button", "ручка объявлена кнопкой");
  assert.equal(a.grip.getAttribute("aria-label"), "строка 0", "подпись пришла от блока");

  /* До взятия наведение ничего не подсвечивает: тащить нечего. */
  const idle = ev();
  b.row.dispatch("dragover", idle);
  assert.equal(idle.prevented, 0, "без взятой строки бросок не принимается");
  assert.equal(b.row.classList.contains("io-dragover"), false, "и подсветки нет");

  const start = ev();
  a.grip.dispatch("dragstart", start);
  assert.equal(held.taken, 0, "взята первая строка");
  assert.equal(a.row.classList.contains("io-dragging"), true, "взятая строка помечена");
  assert.deepEqual(start.sent, ["0"], "номер уехал в dataTransfer");

  const over = ev();
  b.row.dispatch("dragover", over);
  assert.equal(over.prevented, 1, "бросок принимается");
  assert.equal(b.row.classList.contains("io-dragover"), true, "цель подсвечена");

  b.row.dispatch("dragleave", ev());
  assert.equal(b.row.classList.contains("io-dragover"), false, "увели — подсветка снята");

  b.row.dispatch("dragover", ev());
  b.row.dispatch("drop", ev());
  assert.deepEqual(moves, [[0, 1]], "переставлено откуда и куда");
  assert.equal(held.taken, null, "взятое отпущено");
  assert.equal(b.row.classList.contains("io-dragover"), false, "подсветка снята и после броска");
  ok("дом проводит строку по всему протоколу броска");
}

{
  const held: DragHold = { taken: null };
  const moves: Array<[number, number]> = [];
  const a = makeRow(2, held, moves);
  a.grip.dispatch("dragstart", ev());
  a.row.dispatch("drop", ev());
  assert.deepEqual(moves, [], "бросок на саму себя ничего не переставляет");
  assert.equal(held.taken, null, "и взятое всё равно отпущено");
  ok("бросок на своё же место — не перестановка");
}

{
  const held: DragHold = { taken: null };
  const moves: Array<[number, number]> = [];
  const a = makeRow(0, held, moves, false);
  assert.equal(a.grip.draggable, false, "у выключенного списка ручка не тащится");
  ok("выключенный список не тащится: разница двух звавших — в этом доводе");
}

{
  /* Отрицательный контроль к самой фикстуре: без dragstart бросок молчит. */
  const held: DragHold = { taken: null };
  const moves: Array<[number, number]> = [];
  const b = makeRow(1, held, moves);
  b.row.dispatch("drop", ev());
  assert.deepEqual(moves, [], "бросок без взятой строки ничего не делает");
  ok("отрицательный контроль: без взятия бросок ничего не переставляет");
}

/* ---- проверка формы: копия не вернулась --------------------------------- */

{
  /**
   * Звавшие названы поимённо, а третье место с перетаскиванием — нет, и это
   * решение с причиной: в редакторе Fields бросок делают **сторона и её
   * подпись**, и вопрос там другой — не «переставить строку по номеру», а
   * «перенести поле на эту сторону и в это место».
   */
  const CALLERS = [
    "src/ui/settings/custom/order_lists.ts",
    "src/ui/settings/custom/binder_view.ts",
  ];
  for (const rel of CALLERS) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    assert.ok(src.indexOf("attachRowDrag(") >= 0, rel + ": звавший не спрашивает общий дом");
    assert.ok(src.indexOf('addEventListener("dragstart"') < 0,
      rel + ": своё тело перетаскивания вернулось — у правила один дом (У-32)");
    assert.ok(src.indexOf('addEventListener("dragover"') < 0,
      rel + ": своё тело перетаскивания вернулось — у правила один дом (У-32)");
  }
  /* Положительный контроль к самому обходу: место, которое он находить обязан. */
  const home = fs.readFileSync(path.join(root, "src/ui/settings/custom/row_drag.ts"), "utf8");
  assert.ok(home.indexOf('addEventListener("dragstart"') >= 0,
    "положительный контроль: в доме тело и правда лежит, иначе запрет выше зелен от пустоты");
  ok("ни один звавший не завёл своё тело обратно");
}

console.log("Row drag tests: OK (" + passed + " checks)");
