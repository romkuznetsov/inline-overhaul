"use strict";

/**
 * План записи панели: два свойства и цена (`Р-12`).
 *
 * **Что это за план.** Панель пишет в строку человека не целиком, а вставками:
 * снять прежний вид точными отрезками, поставить новый точными вставками, и ни
 * в одном шаге не тронуть ни знака человека. Отсюда два свойства, и они
 * проверяются в самом модуле: убрать спрятанное — получить вид панели; убрать
 * вставленное — получить строку человека знак в знак.
 *
 * **Почему появилась эта проверка.** Профиль V8 на строке в 20 000 знаков
 * назвал место, где панель теряет время: наибольшая общая подпоследовательность
 * слов считалась сеткой по **всей** строке — 1009 мс против 13 мс на строке в
 * 2 000, то есть рост в восемьдесят раз при длине в десять. Совпавшие начало и
 * конец теперь в сетку не попадают.
 *
 * **Цена сторожится отношением, а не миллисекундами.** Порог в миллисекундах —
 * это порог на чужой машине (У-78, У-176): он зелен на быстрой и красен на
 * медленной. Здесь обе величины снимаются в одном прогоне, и спрашивается
 * отношение цены к отношению длин. До правки оно было x89 при длине x10; порог
 * — три длины, и он проверен в обе стороны: новая версия проходит, прежняя
 * краснеет.
 */

const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const { planPanelLineWrite, withoutRanges } = require(
  path.join(root, "src", "core", "panel_line_write.js"));

let passed = 0;
function ok(what) { passed += 1; console.log("  ok " + what); }

/** Вид панели: та же строка с полосой, вставленной в середину. */
function viewOf(src, bar) {
  const at = Math.floor(src.length / 2);
  const cut = src.indexOf(" ", at);
  const where = cut < 0 ? src.length : cut;
  return src.slice(0, where) + " " + bar + src.slice(where);
}

function invariants(src, view, what) {
  const plan = planPanelLineWrite(src, view);
  assert.ok(plan, what + ": плана нет вовсе");
  assert.strictEqual(withoutRanges(plan.text, plan.hidden), view,
    what + ": убрали спрятанное — получился не вид панели");
  assert.strictEqual(withoutRanges(plan.text, plan.inserted), src,
    what + ": убрали вставленное — получилась не строка человека");
  return plan;
}

/* ---- свойства плана ----------------------------------------------------- */

{
  const src = "- 📅2026-09-18 :: разобрать входящие :: #проект/дом";
  const plan = invariants(src, viewOf(src, "==**[Importance]**=="), "обычная строка");
  assert.ok(plan.inserted.length > 0, "контроль: вставка и правда есть");
  ok("на обычной строке оба свойства плана держатся");
}

{
  /* Длинная строка — тот самый случай, ради которого правка и делалась. */
  const src = "- " + "слово ".repeat(3333) + ":: #проект/дом";
  invariants(src, viewOf(src, "==**[Importance]**=="), "длинная строка");
  ok("на строке в 20 000 знаков оба свойства держатся");
}

{
  /* Вид, равный строке: вставлять нечего, и план обязан быть пустым по обеим. */
  const src = "- текст :: #проект/дом";
  const plan = invariants(src, src, "вид равен строке");
  assert.deepStrictEqual(plan.inserted, [], "вставлять было нечего");
  assert.deepStrictEqual(plan.hidden, [], "прятать было нечего");
  ok("отрицательный контроль: одинаковые строки дают пустой план");
}

/* ---- цена: отношение, а не миллисекунды --------------------------------- */

{
  const make = (n) => "- " + "слово ".repeat(Math.max(1, Math.round((n - 20) / 6))) + ":: #проект/дом";
  const bar = "==**[Importance]**==";
  const timeIt = (src) => {
    const view = viewOf(src, bar);
    planPanelLineWrite(src, view);            // прогрев
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 5; i++) planPanelLineWrite(src, view);
    return Number(process.hrtime.bigint() - t0) / 1e6 / 5;
  };

  const short = make(2000);
  const long = make(20000);
  const tShort = timeIt(short);
  const tLong = timeIt(long);
  const lenRatio = long.length / short.length;
  const costRatio = tLong / Math.max(tShort, 0.05);

  /* Контроль на саму меру: короткий случай обязан хоть что-то стоить, иначе
     отношение считается от нуля и любое значение проходит (У-88). */
  assert.ok(tShort > 0, "контроль: короткий случай измерим, " + tShort.toFixed(3) + " мс");

  /*
   * **Порог проверен в обе стороны, и первый был слишком широк.** Квадрат
   * (x100 при длине x10) прежняя версия проходила: она давала x89. То есть
   * сторож не краснел ровно на том, ради чего заведён (У-88). Порог — три
   * длины: новая версия даёт около x9 (то есть линейно), прежняя x89.
   */
  const limit = lenRatio * 3;
  assert.ok(costRatio < limit,
    "цена растёт круче линейного: длина x" + lenRatio.toFixed(1)
    + ", цена x" + costRatio.toFixed(1) + " при пороге x" + limit.toFixed(0)
    + " (" + tShort.toFixed(2) + " мс против " + tLong.toFixed(2) + " мс)"
    + " — похоже, сетка снова считается по всей строке");
  ok("цена на длинной строке растёт почти линейно: длина x" + lenRatio.toFixed(1)
    + ", цена x" + costRatio.toFixed(1) + " при пороге x" + limit.toFixed(0));
}

console.log("Panel line write tests: OK (" + passed + " checks)");
