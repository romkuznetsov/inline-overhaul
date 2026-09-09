"use strict";
/**
 * Отвергнутый отрезок оформления больше не теряется молча (Д-4, У-41).
 *
 * **Что было.** `RangeSetBuilder.add` бросает, когда отрезки приходят не по
 * порядку или пересекаются недопустимо, и слой оформления глотал это в
 * **четырёх** местах пустым `catch`: декорация не рисовалась, и узнать об этом
 * было нельзя ни человеку, ни мне. Человек приходит со словами «перестало
 * красить» — и это второй вид отказа по правилу отказов: сломалось невидимое,
 * и журнал разработчика единственное, из чего можно узнать, почему.
 *
 * **Что проверяется.** Не «бросает ли платформа» — это её дело, — а наши три
 * решения:
 *
 *   1. набор всё равно собирается: заметка дороже картинки, и ронять отрисовку
 *      нельзя;
 *   2. об отказе сказано в журнал, с приставкой `[inline-overhaul]`;
 *   3. запись **одна на проход**, а не на отрезок: сбитый порядок роняет
 *      каждый следующий `add`, и запись на каждый залила бы консоль целиком —
 *      то есть спрятала бы ровно то, ради чего её читают.
 *
 * Платформа здесь **настоящая**: `RangeSetBuilder` берётся из
 * `@codemirror/state`, и порядок отрезков ему не нравится по-настоящему.
 * Подделан только `console.error` — иначе проверять было бы нечего.
 */

const path = require("path");
const decorations = require(path.join(__dirname, "..", "..", "src", "ui", "editor", "decorations.js"));
const cmState = require("@codemirror/state");
const cmView = require("@codemirror/view");

let passed = 0;
function ok(what) { passed++; console.log("  ok " + what); }
function assertEq(actual, expected, name) {
  if (actual !== expected) {
    throw new Error(name + ": expected " + JSON.stringify(expected) + " got " + JSON.stringify(actual));
  }
}
function assertTrue(value, name) {
  if (!value) throw new Error(name + ": expected truthy");
}

/** Подделан ровно `console.error`, и она названа (У-1). */
function withCapturedErrors(body) {
  const real = console.error;
  const said = [];
  console.error = (...args) => { said.push(args.map(String).join(" ")); };
  try {
    return body(said);
  } finally {
    console.error = real;
  }
}

const mark = cmView.Decoration.mark({ class: "io-probe" });

/* ---- порядок в порядке: молчит и собирает ------------------------------ */

withCapturedErrors((said) => {
  const set = decorations.buildDecorationSet([
    { from: 0, to: 2, deco: mark },
    { from: 4, to: 6, deco: mark },
  ], "probe");
  assertTrue(set instanceof cmState.RangeSet, "набор собран платформой, а не подделкой");
  assertEq(set.size, 2, "оба отрезка вошли в набор");
  assertEq(said.length, 0, "жаловаться не на что — журнал молчит");
  ok("порядок в порядке: набор собран, журнал пуст");
});

/* ---- порядок сбит: набор всё равно есть, и об отказе сказано ----------- */

withCapturedErrors((said) => {
  /*
   * Отрезки идут назад — ровно то, чего `RangeSetBuilder` не принимает.
   * Положительный контроль к самой фикстуре стоит ниже: без него «журнал
   * что-то сказал» могло бы выполняться и от исправного порядка.
   */
  const set = decorations.buildDecorationSet([
    { from: 10, to: 12, deco: mark },
    { from: 0, to: 2, deco: mark },
    { from: 1, to: 3, deco: mark },
  ], "probe-broken");

  assertTrue(set instanceof cmState.RangeSet, "набор собран, несмотря на отказы: отрисовка не упала");
  assertEq(set.size, 1, "в набор вошёл тот отрезок, который платформа приняла");

  assertEq(said.length, 1, "запись одна на проход, а не на отрезок: " + JSON.stringify(said));
  const line = said[0];
  assertTrue(line.indexOf("[inline-overhaul]") >= 0,
    "у записи приставка плагина: без неё её не найти в консоли Obsidian");
  assertTrue(line.indexOf("probe-broken") >= 0,
    "и имя места: иначе непонятно, какой слой отказал");
  assertTrue(/отвергнуто 2 из 3/.test(line),
    "сказано, сколько отвергнуто и сколько было: " + line);
  ok("порядок сбит: набор есть, отказ ушёл в журнал одной записью");
});

/* ---- положительный контроль к фикстуре --------------------------------- */

{
  /*
   * Платформа и правда отвергает такой порядок. Без этого утверждения
   * проверка выше была бы зелёной и у сборщика, который ничего не отвергает
   * (У-88): «отвергнуто 2 из 3» тогда просто не случилось бы, а «набор
   * собран» выполнилось бы само.
   */
  let threw = false;
  try {
    const builder = new cmState.RangeSetBuilder();
    builder.add(10, 12, mark);
    builder.add(0, 2, mark);
  } catch (_) {
    /* Проба: спросили платформу, не нравится ли ей такой порядок. Ответ «не
       нравится» — это ответ, и он тут ожидаемый. */
    threw = true;
  }
  assertTrue(threw, "настоящий RangeSetBuilder отвергает отрезки, идущие назад: предмет есть");
  ok("положительный контроль: порядок в фикстуре и правда недопустим");
}

/* ---- запись в журнал разработчика не роняет отрисовку ------------------ */

{
  /*
   * Второе правило того же куска: `traceEvent`. Журнал стоит последним в
   * цепочке, и уронить отрисовку ему нечем и незачем — но молчит он **только**
   * про свой собственный отказ.
   */
  let called = 0;
  const angry = {
    devLogEvent() { called += 1; throw new Error("журнал не пишется"); },
  };
  decorations.traceEvent(angry, {}, "probe.event", { a: 1 });
  assertEq(called, 1, "журнал позван");
  ok("отказ журнала не выходит наружу: отрисовка продолжается");

  /* И обратная сторона: журнала нет вовсе — звать нечего, и это не падение. */
  decorations.traceEvent(null, {}, "probe.event", {});
  decorations.traceEvent({}, {}, "probe.event", {});
  ok("журнала нет — запись просто не делается");
}

console.log("\n" + passed + " проверок пройдено");
