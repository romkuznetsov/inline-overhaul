"use strict";

/**
 * Шаг по элементу в режиме `Custom`: правила, которые не исполнял ни один прогон.
 *
 * **Зачем эта проверка заведена.** Ревизия 2026-09-14 (строка Д6) сняла мерой
 * V8, что из режима `Custom` не исполняется **ничего**: ни разбор списка шагов
 * (`buildCustomPlanFromIncrement`), ни сам шаг вперёд и назад
 * (`forwardStepByCurrent`, `backwardStepByCurrent`). Причина простая и её надо
 * назвать: у заказчика оба элемента настроены на `standard` и `command`, а
 * стенды гоняются на его конфиге. То есть настройка в панели есть, человек её
 * видит, а поведения за ней не проверял никто.
 *
 * **Проверяются сами правила, а не движок.** Движок (`stepByIncrementCfg` в
 * `tagwheel_core.js`) в режиме `custom` делегирует сюда все три вопроса —
 * это видно в нём же. Его собственная ветка «список кончился, дальше `END`»
 * остаётся непокрытой, и это сказано вслух: экспорта у неё нет, а заводить его
 * ради проверки значило бы менять продукт под набор.
 *
 * Форма списка — та, что человек набирает в панели: числа, `N (повтор)` и
 * слово `END`.
 */

const assert = require("node:assert");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const shared = require(path.join(root, "src", "core", "shared_utils.js"));

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("список шагов разбирается из того, что человек набрал", () => {
  const plan = shared.buildCustomPlanFromIncrement({ customRaw: ["3", "5", "7"] });
  assert.deepEqual(plan.steps, [3, 5, 7], "три шага подряд");
  assert.equal(plan.hasEnd, false, "слова END не было — круг не кончается");
});

test("повтор в скобках разворачивается в столько же шагов", () => {
  const plan = shared.buildCustomPlanFromIncrement({ customRaw: ["2 (3)", "10"] });
  assert.deepEqual(plan.steps, [2, 2, 2, 10],
    "«2 (3)» — это три шага по два, а не один шаг");
});

test("слово END обрывает список и помечает конец круга", () => {
  const plan = shared.buildCustomPlanFromIncrement({ customRaw: ["4", "END", "99"] });
  assert.deepEqual(plan.steps, [4], "после END список кончился");
  assert.equal(plan.hasEnd, true, "и конец круга помечен");
  /* Регистр слова принадлежит человеку, а не нам. */
  assert.equal(shared.buildCustomPlanFromIncrement({ customRaw: ["1", "end"] }).hasEnd, true,
    "END набран строчными — это тот же END");
});

test("мусорная строка пропускается, а не роняет разбор", () => {
  const plan = shared.buildCustomPlanFromIncrement({ customRaw: ["3", "не число", "4"] });
  assert.deepEqual(plan.steps, [3, 4], "человек опечатался — остальные шаги живы");
});

test("старая форма списка читается, когда новой нет", () => {
  /* `custom` — форма до `customRaw`; конфиг человека может быть и таким. */
  const plan = shared.buildCustomPlanFromIncrement({ custom: [1, 2, 3] });
  assert.deepEqual(plan.steps, [1, 2, 3], "старая форма прочитана");
  /* И новая сильнее старой: иначе переезд формы менял бы поведение молча. */
  const both = shared.buildCustomPlanFromIncrement({ customRaw: ["9"], custom: [1, 2, 3] });
  assert.deepEqual(both.steps, [9], "набранное человеком сильнее старой формы");
});

test("шаг вперёд доводит до ближайшей границы, а не прибавляет шаг", () => {
  /*
   * Это главное в правиле, и его легко прочесть неверно: значения стоят на
   * границах 3, 8, 15, и шаг — расстояние **до следующей границы**, а не
   * очередное число списка. Стоя на 5, человек попадает на 8, а не на 10.
   */
  const steps = [3, 5, 7];
  assert.equal(shared.forwardStepByCurrent(steps, 0), 3, "с нуля — на первую границу");
  assert.equal(shared.forwardStepByCurrent(steps, 3), 5, "с границы — на следующую");
  assert.equal(shared.forwardStepByCurrent(steps, 5), 3, "из середины — до ближайшей границы");
  assert.equal(shared.forwardStepByCurrent(steps, 15), 7, "за последней границей шаг хвостовой");
});

test("шаг назад доводит до предыдущей границы", () => {
  const steps = [3, 5, 7];
  assert.equal(shared.backwardStepByCurrent(steps, 8), 5, "с границы — на предыдущую");
  assert.equal(shared.backwardStepByCurrent(steps, 5), 2, "из середины — до ближайшей снизу");
  assert.equal(shared.backwardStepByCurrent(steps, 0), 1, "ниже нуля идти некуда");
});

test("пустой список — это ответ, а не отказ", () => {
  /*
   * Человек завёл режим `Custom` и не набрал ни одного шага. Обе стороны
   * обязаны отдать единицу: движок в этом случае шагает как при `standard`,
   * а не останавливается молча (У-41).
   */
  assert.equal(shared.forwardStepByCurrent([], 5), 1, "вперёд шаг единичный");
  assert.equal(shared.backwardStepByCurrent([], 5), 1, "назад шаг единичный");
  assert.deepEqual(shared.buildCustomPlanFromIncrement({}).steps, [],
    "и плана у пустой настройки нет");
});

test("шаг никогда не нулевой", () => {
  /*
   * Ноль в списке — законный ввод человека, а шаг нулевой длины значит,
   * значение не двигается, и круг не кончается никогда. Положительный
   * контроль к этому — предыдущие проверки: там шаги настоящие.
   */
  assert.equal(shared.forwardStepByCurrent([0, 0], 0), 1, "нулевые шаги не дают нулевого хода");
  assert.equal(shared.backwardStepByCurrent([0, 0], 3), 1, "и назад тоже");
});

let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log("  ok   " + t.name);
  } catch (e) {
    failed += 1;
    console.log("  FAIL " + t.name + ": " + String((e && e.message) || e));
  }
}
if (failed) process.exit(1);
console.log("Custom increment regression tests: OK");
