"use strict";

/**
 * **Правила, которые зависят от разделителя, спрашиваются с разделителем
 * человека.**
 *
 * Сторож `config_literals_tests.js` отвечает на вопрос «нет ли в коде готового
 * разделителя» — то есть на форму. Эта проверка отвечает на вопрос
 * **поведения**: срабатывает ли правило у того, кто выбрал свой разделитель.
 * Разница между ними — ровно тот дефект, который заказчик принёс 2026-09-14:
 * литерал виден только чтением, а молчит правило на экране.
 *
 * **У каждого утверждения свой контроль, и он противоположный** (У-147):
 * правило обязано срабатывать на разделителе из настроек и **не** срабатывать
 * на чужом знаке. Без второй половины «починка» вида «считать разделителем что
 * угодно» выглядела бы зелёной.
 *
 * **Разделители разводятся нарочно.** Пара `::`/`~~` не совпадает ни с одним
 * умолчанием и ни с одной прежней записью в коде: на паре, где оба одинаковы,
 * правило, спрашивающее только первый, неотличимо от верного.
 */

const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const macroShared = require(path.join(ROOT, "src", "core", "pkm_macro_shared.js"));
const lineFinalize = require(path.join(ROOT, "src", "core", "pkm_line_finalize_unified.js"));
const statusRuntimeCommonMod = require(path.join(ROOT, "src", "core", "status_runtime_common.js"));

/** Разделители человека: свой знак, и оба разные. */
const OWN = { io: { separator1: "::", separator2: "~~" } };
/** Прежнее умолчание — сторона, на которой дефект был не виден. */
const DEFAULT = { io: { separator1: "||", separator2: "||" } };

let checks = 0;

function assertEq(actual, expected, name) {
  checks++;
  if (actual !== expected) {
    throw new Error(name + ": ожидалось " + JSON.stringify(expected) + ", получено " + JSON.stringify(actual));
  }
}

/*
 * Общий рантайм собирается фабрикой, а не подделкой: проверяется та самая
 * функция, которую зовёт движок. Две зависимости фабрика требует вслух, и обе
 * к разделителям отношения не имеют.
 */
const statusCommon = statusRuntimeCommonMod.createStatusRuntimeCommon({
  loadOrderKeyNormalizer: () => ((k) => String(k || "").trim()),
  loadRuntimePreloadFacade: () => ({}),
});

function cycleEnd(line, rules) {
  return lineFinalize.applyCycleEndPostProcessing({
    finalLine: line,
    rules,
    cycleEndBehavior: "clear-prefix",
    parseLine: () => ({}),
  }).finalLine;
}

function run() {
  /* 1. «От строки остался знак списка и разделители» — конец круга обязан
        дать пустую строку. С литеральным `||` у человека с `::` строка
        оставалась `- :: ::`, и он видел её на экране. */
  assertEq(macroShared.isBulletLikeEmptyResult("- :: ~~", null, OWN), true,
    "знак списка и оба разделителя человека — пустой результат");
  assertEq(macroShared.isBulletLikeEmptyResult("1. ::", null, OWN), true,
    "номер списка и разделитель человека — пустой результат");
  assertEq(macroShared.isBulletLikeEmptyResult("- || ||", null, DEFAULT), true,
    "то же правило при разделителе по умолчанию");

  /* Контроль: чужой знак разделителем не считается. Правило, объявившее
     разделителем что угодно, был бы зелёным без него. */
  assertEq(macroShared.isBulletLikeEmptyResult("- || ||", null, OWN), false,
    "контроль: чужой знак разделителем человека не считается");
  assertEq(macroShared.isBulletLikeEmptyResult("- :: ~~", null, DEFAULT), false,
    "контроль: свой знак человека не считается разделителем по умолчанию");
  assertEq(macroShared.isBulletLikeEmptyResult("- :: текст", null, OWN), false,
    "контроль: слово человека между разделителями строку пустой не делает");

  /* 2. Та же строка через доводку: конец круга со снятым началом. */
  assertEq(cycleEnd("- :: ::", OWN), "",
    "конец круга: строка из знака списка и разделителей человека очищается");
  assertEq(cycleEnd("- || ||", DEFAULT), "",
    "конец круга: то же при разделителе по умолчанию");
  assertEq(cycleEnd("- || ||", OWN), "- || ||",
    "контроль: чужой знак конец круга не трогает");

  /* 3. Пробелы вокруг разделителя. Величина мелкая — таб рядом с
        разделителем, — и названа она честно: всё остальное сводит общее
        правило «два пробела и больше — один». Но правило это было написано
        только для `||`, и у человека со своим разделителем не работало вовсе. */
  assertEq(statusCommon.cleanupSpacing("#todo\t:: text", OWN), "#todo :: text",
    "пробел перед разделителем человека приводится к одному");
  assertEq(statusCommon.cleanupSpacing("#todo ::\ttext", OWN), "#todo :: text",
    "пробел после разделителя человека приводится к одному");
  assertEq(statusCommon.cleanupSpacing("#todo\t|| text", DEFAULT), "#todo || text",
    "то же при разделителе по умолчанию");
  assertEq(statusCommon.cleanupSpacing("#todo\t|| text", OWN), "#todo\t|| text",
    "контроль: чужой знак пробелы вокруг себя не правит");

  console.log("  правила с разделителем человека: утверждений " + checks);
  console.log("Separator from settings tests: OK");
}

if (require.main === module) run();

module.exports = { run };
