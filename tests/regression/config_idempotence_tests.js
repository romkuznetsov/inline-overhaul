"use strict";

/**
 * `migrateConfig` над собственным ответом ничего не меняет (BUGHUNT 2026-09-30,
 * корень Q2, D1).
 *
 * Хранилище сверяет файл на диске с тем, что само записало, прогоном через
 * `migrateConfig`; второй проход, дописавший ключ, читался как «файл изменился
 * под нами», и следующая правка настроек откатывалась. Обходятся **все**
 * фикстуры конфига — список собирается из папки, а не пишется (правило 36).
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const normalize = require("../../src/core/config_normalize.js");
const { applyStarterSet } = require("../../src/core/starter_config.ts");

const dir = path.join(__dirname, "..", "fixtures");
const inputs = fs.readdirSync(dir).filter((f) => /^(config|data).*\.json$/.test(f))
  .map((f) => [f, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))]);
/* Стартовый набор — то, с чем плагин встаёт в пустом vault. */
{ const raw = {}; applyStarterSet(raw); inputs.push(["стартовый набор", raw]); }
/* Положительный контроль: без фикстур версии 1 сторож не видел бы D1. */
assert.ok(inputs.filter(([, raw]) => !(Number(raw.schemaVersion) >= 2)).length >= 3, "фикстур версии 1 меньше трёх");

function diff(a, b, at, out) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) diff(a[k], b[k], at + "." + k, out);
  } else out.push(at + ": " + JSON.stringify(a) + " → " + JSON.stringify(b));
  return out;
}

for (const [name, raw] of inputs) {
  const once = normalize.migrateConfig(JSON.parse(JSON.stringify(raw)));
  const twice = normalize.migrateConfig(JSON.parse(JSON.stringify(once)));
  assert.deepStrictEqual(diff(once, twice, "", []), [], name + ": второй проход migrateConfig меняет конфиг");
}
console.log("config_idempotence_tests: " + inputs.length + " конфигов, второй проход ничего не меняет");
