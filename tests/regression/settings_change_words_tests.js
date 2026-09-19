"use strict";

/**
 * «Что изменилось» словами человека (его слово 2026-09-19, второй заход).
 *
 * **Что здесь закреплено и почему именно это.**
 *
 *   1. *Его собственный пример.* «В этом примере я переместил field `Cat` из
 *      right block в left block» — и строка обязана говорить именно это, а не
 *      «список из 4 стал списком из 5».
 *   2. *Имя строки панели приходит из схемы*, а не из второго списка: иначе
 *      первое же переименование разведёт отчёт с панелью (У-32). Проверяется
 *      обходом схемы, а не выписанным именем.
 *   3. *У пути без строки в панели честный вид.* Придумать слово хуже, чем
 *      назвать путь путём (У-80).
 *   4. *Ветка, которой не было, разбирается по листьям.* «advanced: changed»
 *      человеку не говорит ничего.
 */

const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const words = require(path.join(root, "src", "features", "settings_change_words.js"));
const schema = require(path.join(root, "src", "ui", "settings", "schema", "index.ts"));

let passed = 0;
function ok(label) { passed++; console.log("  ok " + label); }

/* ---- 1. его пример: перемещение Field между Block ------------------------ */

{
  const labels = { Importance: "Imp", Category: "Cat", test: "test" };
  const before = { pkm: { fields: { order: { left: ["Importance"], right: ["Category", "test"], labels } } } };
  const after = { pkm: { fields: { order: { left: ["Importance", "Category"], right: ["test"], labels } } } };
  const lines = words.describeConfigChange(before, after, 20);
  assert.deepEqual(lines, ["Field «Cat» moved from the Right Block to the Left Block"],
    "его пример читается его же словами: " + lines.join(" | "));

  /* Подпись берётся та, которую он видит в панели, а не ключ поля. */
  const noLabel = { pkm: { fields: { order: { left: ["Category"], right: [], labels: {} } } } };
  const moved = words.describeConfigChange(
    { pkm: { fields: { order: { left: [], right: ["Category"], labels: {} } } } }, noLabel, 20);
  assert.ok(moved[0].indexOf("«Category»") !== -1,
    "подписи нет — называется ключ, и это видно: " + moved[0]);
  ok("перемещение Field между Block названо его словами");
}

/* ---- 2. добавление, снятие и порядок ------------------------------------ */

{
  const labels = { A: "Alpha", B: "Beta", C: "Gamma" };
  const before = { pkm: { fields: { order: { left: ["A", "B"], right: ["C"], labels } } } };
  const added = words.describeConfigChange(before,
    { pkm: { fields: { order: { left: ["A", "B", "D"], right: ["C"], labels: Object.assign({ D: "Delta" }, labels) } } } }, 20);
  assert.deepEqual(added, ["Field «Delta» added to the Left Block"], added.join(" | "));

  const removed = words.describeConfigChange(before,
    { pkm: { fields: { order: { left: ["A"], right: ["C"], labels } } } }, 20);
  assert.deepEqual(removed, ["Field «Beta» removed from the Left Block"], removed.join(" | "));

  const reordered = words.describeConfigChange(before,
    { pkm: { fields: { order: { left: ["B", "A"], right: ["C"], labels } } } }, 20);
  assert.deepEqual(reordered, ["Fields of the Left Block reordered: Beta, Alpha"], reordered.join(" | "));
  ok("добавление, снятие и порядок Fields названы каждый своим словом");
}

/* ---- 3. имя строки панели приходит из схемы ------------------------------ */

{
  /*
   * Предмет проверяется **обходом схемы**: берётся первая её строка с путём,
   * и отчёт обязан назвать её именем оттуда. Выписать имя сюда значило бы
   * завести второй список (У-111).
   */
  let sample = null;
  for (const group of schema.SCHEMA) {
    for (const item of group.items || []) {
      if (item && item.path && item.kind === "toggle") { sample = { group, item }; break; }
    }
    if (sample) break;
  }
  assert.ok(sample, "в схеме не нашлось ни одного тумблера с путём — проверять нечего");

  const setAt = (obj, p, v) => {
    const parts = p.split(".");
    let node = obj;
    for (let i = 0; i < parts.length - 1; i++) node = (node[parts[i]] = node[parts[i]] || {});
    node[parts[parts.length - 1]] = v;
    return obj;
  };
  const before = setAt({}, sample.item.path, false);
  const after = setAt({}, sample.item.path, true);
  const lines = words.describeConfigChange(before, after, 20);
  assert.equal(lines.length, 1, "изменился один лист — и строка одна: " + lines.join(" | "));
  assert.ok(lines[0].indexOf("«" + sample.item.name + "»") === 0,
    "строка начинается с имени из схемы: " + lines[0]);
  assert.ok(lines[0].indexOf(sample.group.heading) !== -1,
    "и называет группу, в которой человек её найдёт: " + lines[0]);
  assert.ok(/off → on$/.test(lines[0]), "тумблер сказан словами, а не true/false: " + lines[0]);
  ok("имя, группа и вкладка строки приходят из схемы панели");
}

/* ---- 4. путь без строки в панели --------------------------------------- */

{
  const lines = words.describeConfigChange(
    { viewStateLike: { unknownKey: 1 } }, { viewStateLike: { unknownKey: 2 } }, 20);
  assert.equal(lines.length, 1, lines.join(" | "));
  assert.ok(lines[0].indexOf("setting `viewStateLike.unknownKey`") === 0,
    "путь назван путём, а не выдан за имя настройки: " + lines[0]);
  ok("у пути без строки в панели честный вид");
}

/* ---- 5. новая ветка разбирается по листьям ------------------------------ */

{
  const lines = words.describeConfigChange({}, { advanced: { backups: { autosave: true } } }, 20);
  assert.equal(lines.length, 1, lines.join(" | "));
  assert.ok(lines[0].indexOf("«Autosave»") === 0,
    "ветка, которой не было, названа листом, а не словом «changed»: " + lines[0]);
  ok("новая ветка разбирается по листьям, а не называется одним словом");
}

/* ---- 6. предел строк ---------------------------------------------------- */

{
  const before = {};
  const after = {};
  for (let i = 0; i < 30; i++) {
    before["k" + i] = i;
    after["k" + i] = i + 1;
  }
  const lines = words.describeConfigChange(before, after, 5);
  assert.equal(lines.length, 6, "пять строк и остаток: " + lines.length);
  assert.ok(/^and 25 more changes$/.test(lines[5]), "остаток назван числом: " + lines[5]);
  ok("предел строк соблюдён, остаток назван числом");
}

console.log("\n" + passed + " проверок пройдено");
