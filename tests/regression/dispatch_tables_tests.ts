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
import { BLOCK_TEXTS } from "../../src/ui/settings/texts_blocks.ts";
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

/*
 * Контекст, законный для проверяемого (У-38).
 *
 * До 2026-09-08 здесь стояло `{} as never`, и блок это переживал: `ctx` он
 * трогал только через `sayIn`, которому хватало отсутствия `t`. С подсказками
 * подписей блок начал спрашивать `ctx.get` — и проверка упала на `ctx.get is
 * not a function`, то есть на своей же подделке. `SettingsCtx` требует `get`
 * с самого начала; подделка была незаконной всё это время и молчала.
 */
const ctxWith = (tips: boolean): never => ({
  get: (path: string) => (path === "general.help.showTips" ? tips : undefined),
  set: async () => {},
  run: async () => {},
  watch: () => () => {},
}) as never;

{
  const host = makeNode("div");
  const close = dispatchTables(host as unknown as El, ctxWith(true));

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

  /*
   * Подсказка у каждой подписи — заказ заказчика 2026-09-08. Проверяется
   * НАЖАТИЕМ, а не наличием кнопки: подделка, выбрасывающая обработчик,
   * доказывает наличие «?» и молчит про то, что он делает (У-43).
   */
  const marks = all(host, "io-help");
  assert.equal(marks.length, 2, "«?» стоит у обеих подписей");
  const slot = all(host, "io-tabletipslot");
  assert.equal(slot.length, 1, "тело раскрывается в один слот под парой, а не внутри колонки");
  for (const mark of marks) mark.click();
  const bodies = all(host, "io-tip--below");
  assert.equal(bodies.length, 2, "нажатие открыло обе подсказки");
  for (const body of bodies) {
    assert.equal(body.parent, slot[0], "тело подсказки лежит в слоте под парой (У-105)");
    assert.ok(String(body.textContent || "").length > 40,
      "подсказка открылась с текстом, а не пустой: " + body.textContent);
  }
  /* Слова берутся из каталога, а не из блока: имя строки останется верным и
     тогда, когда за ним будет написано что угодно (У-56). */
  const tipWords = BLOCK_TEXTS["left-right-order"] as Readonly<Record<string, string>>;
  assert.ok(String(bodies[0]?.textContent || "").includes("top down"),
    "слева открылась именно её подсказка");
  assert.ok(String(bodies[1]?.textContent || "").includes("Cycle in both directions"),
    "справа — своя, и она называет тумблер, который решает последнюю строку");
  assert.ok(String(tipWords["MOVE_RIGHT_TIP"] || "").includes("Cycle in both directions"),
    "и это слово написано в каталоге, а не в блоке");

  close();
  assert.equal(all(host, "io-order").length, 0, "очистка убирает за собой");
  assert.equal(all(host, "io-tip--below").length, 0, "и снимает открытые подсказки");
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
  const body = src.slice(at, end > 0 ? end : src.length);
  /*
   * Комментарии снимаются: проверка про **код**, а не про прозу рядом с ним.
   * Пока они оставались, объяснение правой ветки — оно называет `isBullet`
   * словами — попадало в срез левой и роняло проверку на пустом месте.
   */
  return body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
}

{
  const body = indentLineSource();

  /* Ветка `left`: сперва отступ, потом цикл Prefix. */
  /* Срез левой ветки кончается на первом условии правой: комментарий к правой
     стоит перед ним и называет `isBullet` словами. */
  const left = body.slice(body.indexOf('direction === "left"'), body.indexOf("if (currentIndent > 0 ||"));
  const leftIndentAt = left.indexOf("removeOneIndent");
  const leftCycleAt = left.indexOf('cycleLineType(editor, lineNo, "left"');
  assert.ok(leftIndentAt > 0 && leftCycleAt > 0, "в ветке left нашлись обе развилки");
  assert.ok(leftIndentAt < leftCycleAt,
    "Move left: отступ снимается раньше, чем циклируется Prefix — как в таблице");

  /* Ветка `right`: сперва «список или уже с отступом», потом цикл Prefix. */
  const right = body.slice(body.indexOf("if (currentIndent > 0 ||"));
  const rightIndentAt = right.indexOf("currentIndent > 0");
  const rightCycleAt = right.indexOf('cycleLineType(editor, lineNo, "right"');
  assert.ok(rightIndentAt >= 0 && rightCycleAt > 0, "в ветке right нашлись обе развилки");
  assert.ok(rightIndentAt < rightCycleAt,
    "Move right: элемент списка получает отступ раньше, чем циклируется Prefix");

  /*
   * Зеркальность, названная в Д2 словами (В-12, 2026-09-01). Раньше здесь
   * пинилась обратная вещь — что справа стоит `isBullet`, — и это было
   * верно: `Move right` циклировал только на строке, которая ещё не элемент
   * списка. Теперь этим управляет тумблер, и проверяется именно связь с ним,
   * а не сам факт условия.
   */
  assert.ok(!left.includes("isBullet"),
    "Move left про элемент списка не спрашивает: в таблице слева этого условия нет");
  assert.ok(right.includes("isBullet(line) && !rightMayCycle"),
    "Move right спрашивает про элемент списка только когда тумблер выключен");
  assert.ok(/const rightMayCycle = rules\.prefixCyclerEnabled && rules\.rightCycles;/.test(body),
    "и берёт ответ у настройки, а не решает сам");
  ok("Д2: порядок ветвей рантайма совпадает с порядком строк в таблицах");
}

{
  /* Выключенные подсказки: «?» не остаётся. Блок, падающий только с
     выключенными подсказками, в этом проекте уже был. */
  const host = makeNode("div");
  const close = dispatchTables(host as unknown as El, ctxWith(false));
  assert.equal(all(host, "io-help").length, 0, "подсказки выключены — «?» нет ни у одной подписи");
  assert.equal(all(host, "io-ordercol__cap").length, 2, "а сами подписи на месте");
  close();
  ok("«?» подписей появляется и исчезает вместе с тумблером Show tips");
}

{
  /*
   * Строки таблицы называют то же, что и рантайм: отступ, Prefix, текст.
   *
   * Таблица держит **имена** строк каталога, а сами слова живут в
   * `texts_blocks.ts` (10.13.47), поэтому пин идёт за текстом туда. Читать
   * имена вместо слов значило бы потерять предмет утверждения: имя `THEN_INDENT`
   * останется верным и тогда, когда за ним будет написано что угодно (У-56).
   */
  const words = BLOCK_TEXTS["left-right-order"] as Readonly<Record<string, string>>;
  const said = (name: string): string => {
    const text = words[name];
    assert.ok(text, "строки каталога нет: " + name);
    return String(text);
  };
  const left = DISPATCH_TABLES[0];
  const right = DISPATCH_TABLES[1];
  assert.ok(said(String(left?.steps[1]?.then)).includes("indent"), "второй шаг слева про отступ");
  assert.ok(said(String(left?.steps[2]?.then)).includes("prefix"), "третий — про Prefix");
  /* Таблицы стали зеркальными (В-12): второй шаг справа спрашивает про отступ,
     как и слева, а не про элемент списка. */
  assert.ok(said(String(right?.steps[1]?.when)).includes("indent"),
    "второй шаг справа спрашивает про отступ");
  assert.equal(right?.steps[1]?.when, left?.steps[1]?.when,
    "и спрашивает ровно то же, что слева: направления зеркальны");
  assert.ok(said(String(right?.steps[1]?.then)).includes("add")
    && said(String(left?.steps[1]?.then)).includes("remove"),
    "а делают противоположное");
  assert.ok(said(String(right?.steps[2]?.then)).includes("forwards")
    && said(String(left?.steps[2]?.then)).includes("backwards"),
    "и направления цикла названы разными словами");
  ok("строки таблиц называют те же три вещи, что и рантайм");
}

console.log("\n" + passed + " проверок пройдено");
