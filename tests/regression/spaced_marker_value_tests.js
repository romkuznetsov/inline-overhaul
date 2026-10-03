"use strict";

/**
 * Дата с пробелом после знака — та же дата (его ответ `В-243`, 2026-09-28:
 * «узнавать обе, писать как сейчас»; F9 прогона с чистого листа).
 *
 * Две половины: общий дом `spacedMarkerValueGaps` в `shared_utils.js` — что
 * считается значением — и шов `joinSpacedElementValues` в
 * `plugin_commands.js`, через который идут все команды полей и открытие
 * tagWheel: строки под каретками приходят к движкам без пробела. Редактор —
 * подделка с отрезочной правкой, как у Obsidian (правило 93: справа налево).
 * Настоящий Obsidian — `node tools/obsidian_bench.js mine M10,M11,M12`.
 */

const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const shared = require(path.join(root, "src", "core", "shared_utils.js"));
/* Шов берётся загрузчиком внутренностей: модуль команд требует `obsidian` (У-1). */
const { loadPluginInternals } = require(path.join(root, "tests", "harness", "plugin_internals.ts"));
const commands = loadPluginInternals();

let passed = 0;
const ok = (what) => { passed++; console.log("  ok   " + what); };

const marks = [{ marker: "📅", format: "YY-MM-DD" }, { marker: "🕒", format: "YYYY-MM-DD HH:mm" }, { marker: "🔢", format: "1" }];
/* Отрезки дома, снятые справа налево, — так их снимает шов команд (Н-16: продукт склейки не зовёт). */
const joinWith = (l, m) => shared.spacedMarkerValueGaps(l, m).reduce((s, g) => s.slice(0, g.from) + s.slice(g.to), l);
const join = (l) => joinWith(l, marks);

/* Общий дом: своё значение и общий вид даты — да, слово — нет. */
assert.equal(join("- задача 📅 26-09-30"), "- задача 📅26-09-30", "формат поля с пробелом");
assert.equal(join("- задача 📅  2026-09-30 далее"), "- задача 📅2026-09-30 далее", "дата Tasks, два пробела");
assert.equal(join("- 🕒 2026-09-28 12:30 x"), "- 🕒2026-09-28 12:30 x", "значение в два слова");
assert.equal(join("- 🔢 5 шт"), "- 🔢5 шт", "счётчик");
assert.equal(join("- 📅 26-09-30 и 📅 26-10-01"), "- 📅26-09-30 и 📅26-10-01", "оба токена строки");
/* Отрицательные контроли: что снимать нельзя. */
assert.equal(join("- задача 📅 встреча"), "- задача 📅 встреча", "знак со словом — текст человека");
assert.equal(join("- a📅 26-09-30"), "- a📅 26-09-30", "знак внутри слова — не наш");
assert.equal(join("- 📅26-09-30"), "- 📅26-09-30", "запись плагина не меняется");
assert.equal(joinWith("- 📅 26-09-30", []), "- 📅 26-09-30", "без Field Element — ничего");
ok("общий дом: значение через пробел узнаётся строго, слово и чужой знак не трогаются");

/* Шов: команды полей видят строку без пробела. */
function editor(lines, sel) {
  const doc = lines.slice();
  const writes = [];
  return {
    doc, writes,
    getLine: (n) => doc[n],
    getCursor: () => sel[0].head,
    listSelections: () => sel,
    replaceRange(text, from, to) {
      writes.push([from.line, from.ch, to.ch]);
      doc[from.line] = doc[from.line].slice(0, from.ch) + text + doc[from.line].slice(to.ch);
    },
  };
}
const cfg = { pkm: { fields: { elements: { byField: { Due: { emoji: "📅", format: "YY-MM-DD" }, Note: { emoji: "", format: "" } } } } } };
const run = (ed) => commands.joinSpacedElementValues({ app: { workspace: { activeEditor: { editor: ed } } } }, cfg);
{
  const at = { line: 1, ch: 0 };
  const ed = editor(["- 📅 26-09-01", "- задача 📅 26-09-30 📅 26-10-01", "- 📅 26-09-02"], [{ anchor: at, head: at }]);
  run(ed);
  assert.deepEqual(ed.doc, ["- 📅 26-09-01", "- задача 📅26-09-30 📅26-10-01", "- 📅 26-09-02"], "снята не та строка: " + JSON.stringify(ed.doc));
  assert.equal(ed.writes.length, 2, "пишется только снятый пробел, отрезком");
  assert.ok(ed.writes[0][1] > ed.writes[1][1], "отрезки идут справа налево");
}
{
  const ed = editor(["- 📅 26-09-01", "x", "- 📅 26-09-02"], [{ anchor: { line: 0, ch: 0 }, head: { line: 2, ch: 3 } }]);
  run(ed);
  assert.deepEqual(ed.doc, ["- 📅26-09-01", "x", "- 📅26-09-02"], "выделение на три строки — снимается на каждой");
}
{
  const ed = editor(["- 📅 встреча"], [{ anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } }]);
  run(ed);
  assert.equal(ed.writes.length, 0, "нечего снимать — ни одной записи");
}
/* Нет редактора — проба, а не отказ. */
commands.joinSpacedElementValues({ app: { workspace: {} } }, cfg);
ok("шов: строки под каретками без пробела, только отрезками и справа налево; без редактора молчит");

console.log(passed + " проверок");
