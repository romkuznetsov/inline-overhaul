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

assert.equal(contrastWarning(2.84), "This Value may be hard to read: contrast 2.8:1, aim for 4.5:1");
ok("подсказка называет и текущее отношение, и нужное");

console.log("\n" + passed + " проверок пройдено");
