/**
 * Счётчик с числом ниже начала своего формата (его ответ `В-268`, 2026-10-02:
 * «продолжать от числа»; прогон 2026-10-02, H2.1).
 *
 * **Что было.** Формат `098` — число: начало 98 и три цифры. Значение `7`
 * разбор не узнавал, и обе дороги брали сырые цифры за прогресс: команда
 * `next` давала `🔢106`, а панель переписывала `🔢7` в `🔢105` при правке
 * **любого** поля строки. Четырёхзначное значение резалось до трёх цифр.
 *
 * **Что закреплено.** Обе дороги — команда и панель — на конфиге из фикстуры
 * через `migrateConfig` (правило 2), тем же рантаймом, что у плагина
 * (`tools/line_bench.js`, правило 1). Контроль — значение не ниже начала и
 * снятие у начала: прежнее поведение.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const bench = require("../../tools/line_bench.js");
const normalize = require("../../src/core/config_normalize.js");

type Any = ReturnType<typeof JSON.parse>;
let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok " + what); };

const cfg: Any = normalize.migrateConfig(JSON.parse(
  fs.readFileSync(path.join(here, "..", "fixtures", "config_v2_elements.json"), "utf8"),
));
/* Контроль фикстуры (У-147): у счётчика формат-число, а начало выше значений проверки. */
const cnt = cfg.pkm.fields.elements.byField.Cnt;
assert.equal(cnt && cnt.format, "098", "в фикстуре нет счётчика с форматом 098");

const cmd = async (id: string, line: string): Promise<string> => (await bench.runCommandById(cfg, id, line, line.length)).line;

/* 1. Команда: счёт от числа на строке. */
{
  const want: Array<[string, string, string]> = [
    ["cnt-next", "- b || 🔢7", "- b || 🔢008"],
    ["cnt-previous", "- b || 🔢7", "- b || 🔢006"],
    ["cnt-next", "- a || 🔢050", "- a || 🔢051"],
    ["cnt-previous", "- f || 🔢000", "- f"],
    ["cnt-next", "- g || 🔢999", "- g || 🔢1000"],
    ["cnt-previous", "- h || 🔢1000", "- h || 🔢999"],
    /* Контроль: от начала и выше — как было, у начала шаг вниз снимает. */
    ["cnt-next", "- c || 🔢200", "- c || 🔢201"],
    ["cnt-previous", "- d || 🔢098", "- d"],
    ["cnt-next", "- e", "- e || 🔢098"],
  ];
  for (const [id, line, expected] of want) assert.equal(await cmd(id, line), expected, id + " на " + JSON.stringify(line));
  ok("команда: число ниже начала формата считается от себя, у начала и выше — как было");
}

/* 2. Панель: Field счётчика ищется по значку, а не по месту в полосе. */
{
  const to = (n: number): string[] => Array(n).fill("ArrowRight");
  let hops = -1;
  for (let n = 0; n < 6 && hops < 0; n++) {
    const probe = await bench.runTagWheel(cfg, "right", "- x", 3, to(n).concat(["ArrowUp", "Enter"]));
    if (/🔢\d/.test(probe.line)) hops = n;
  }
  assert.ok(hops >= 0, "контроль: счётчик не нашёлся в правой полосе");
  const panel = async (line: string, keys: string[]): Promise<string> => (await bench.runTagWheel(cfg, "right", line, line.length, keys)).line;
  assert.ok((await panel("- b || 🔢7", to(hops).concat(["ArrowUp", "Enter"]))).includes("🔢008"), "панель вверх от 7");
  assert.ok((await panel("- b || 🔢7", to(hops).concat(["ArrowDown", "Enter"]))).includes("🔢006"), "панель вниз от 7");
  /* Правка другого поля не трогает число счётчика: прежде `🔢7` становилось `🔢105`. */
  const other = hops === 0 ? 1 : 0;
  const kept = await panel("- b || 🔢7", to(other).concat(["ArrowUp", "Enter"]));
  assert.ok(kept.includes("🔢007") && !kept.includes("🔢105"), "панель переписала счётчик при правке другого поля: " + JSON.stringify(kept));
  assert.ok((await panel("- c || 🔢200", to(hops).concat(["ArrowUp", "Enter"]))).includes("🔢201"), "контроль: панель от 200");
  ok("панель: тот же счёт, и правка другого поля не меняет число");
}

console.log(passed + " проверок пройдено");
