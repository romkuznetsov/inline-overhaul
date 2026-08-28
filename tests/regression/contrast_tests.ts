/**
 * Контраст пары цветов (PRD 10.13.3, Н19).
 *
 * Пары взяты из требования, а не придуманы: белое на чёрном — 21:1, белое на
 * белом — 1:1, `#767676` на белом — 4.54:1. Последняя пара и есть граница,
 * ради которой функция существует: она проходит порог с запасом в сотые.
 */

import assert from "node:assert/strict";
import { CONTRAST_FLOOR, contrastRatio, contrastWarning } from "../../src/ui/settings/custom/contrast.ts";

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok   " + what); };

const near = (got: number, want: number, what: string): void => {
  assert.ok(Math.abs(got - want) < 0.01, what + ": ждали " + want + ", получили " + got.toFixed(3));
};

near(contrastRatio("#ffffff", "#000000"), 21, "белое на чёрном");
near(contrastRatio("#000000", "#ffffff"), 21, "порядок цветов не важен");
ok("белое и чёрное дают 21:1 в обе стороны");

near(contrastRatio("#ffffff", "#ffffff"), 1, "белое на белом");
ok("одинаковые цвета дают 1:1");

near(contrastRatio("#ffffff", "#767676"), 4.54, "серый на белом");
assert.ok(contrastRatio("#ffffff", "#767676") >= CONTRAST_FLOOR,
  "именно эта пара проходит порог: на ней держится граница");
ok("#767676 на белом даёт 4.54:1 и проходит порог");

/*
 * Порог 3:1 (решение заказчика 2026-08-28): белое на красном читается и значка
 * не получает, белое на жёлтом и зелёном — получает. Это ровно те три цвета, на
 * которых заказчик и заметил, что проверка работает странно.
 */
assert.ok(contrastRatio("#ff0000", "#ffffff") >= CONTRAST_FLOOR,
  "белое на красном (4.0:1) проходит порог 3:1");
assert.ok(contrastRatio("#e6c700", "#ffffff") < CONTRAST_FLOOR,
  "белое на жёлтом (1.7:1) не проходит");
assert.ok(contrastRatio("#00d118", "#ffffff") < CONTRAST_FLOOR,
  "белое на зелёном (2.1:1) не проходит");
ok("порог 3:1 разводит настоящие цвета заказчика так же, как глаз");

/* Цвет из темы приходит от `getComputedStyle` именно в этой записи. */
near(contrastRatio("rgb(255, 255, 255)", "#000000"), 21, "rgb() из темы");
near(contrastRatio("rgba(255, 255, 255, 0.9)", "#000000"), 21, "rgba() из темы");
ok("цвет темы в записи rgb() разбирается наравне с hex");

near(contrastRatio("#fff", "#000"), 21, "короткая запись цвета");
ok("короткая запись #rgb читается как полная");

/*
 * Цвет из темы посчитать нечем, и это не повод для значка: неизвестное
 * возвращает «претензий нет», иначе панель пугала бы предупреждением всюду,
 * где цвет не задан.
 */
assert.equal(contrastRatio("var(--text-normal)", "#000000"), 21, "неразобранный цвет не жалуется");
assert.equal(contrastRatio("", ""), 21, "пустой цвет не жалуется");
ok("неизвестный цвет не поднимает предупреждение");

assert.equal(contrastWarning(2.84), "This Value may be hard to read: contrast 2.8:1, aim for 3:1");
ok("подсказка называет и текущее отношение, и нужное");

console.log("\n" + passed + " проверок пройдено");
