/**
 * Command Field, этап 1: категории Коллауты и Очистка (постановка
 * `test-vault/command-field.md`, разделы 6.1 и 6.2; ответы В-272…В-283).
 *
 * Примеры «до/после» — из постановки и разбора, R-1 (одна замена) и R-2
 * (применение и снятие подряд — байт в байт). Конфиг — через `migrateConfig`
 * (правило 2).
 */

import assert from "node:assert/strict";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

setupGlobals();
type Any = ReturnType<typeof JSON.parse>;
const I = loadPluginInternals();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CF = createRequire(import.meta.url)(path.join(root, "src", "features", "command_field.js")) as Any;

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok " + what); };

/** Применить замену к строкам — так её применит редактор одной транзакцией. */
function apply(lines: string[], r: Any): string[] {
  return lines.slice(0, r.from).concat(r.lines, lines.slice(r.to + 1));
}

const callouts = CF.categoryById("callouts");
const cleanup = CF.categoryById("cleanup");
const presets = callouts.defaults;
const run = (lines: string[], line: number, step: number, list: Any[] = presets, ch = 0, selection: Any = null): Any =>
  callouts.run({ lines, cursor: { line, ch }, selection }, list, step);

/* 1. Пустая строка: пустой коллаут первого пресета, каретка в теле. */
{
  const r = run([""], 0, 1);
  assert.deepEqual(r.lines, ["> [!note]", "> "]);
  assert.deepEqual(r.cursor, { line: 1, ch: 2 });
  ok("пустая строка → пустой коллаут, каретка в теле");
}

/* 2. Строка с деревом уходит в тело целиком (В-272); перебор по кругу и снятие — байт в байт. */
{
  const doc = ["- [ ] Research plan", "  - read papers", "", "\t- interview users", "- buy bread"];
  let lines = doc.slice();
  let r = run(lines, 0, 1, presets, 6);
  lines = apply(lines, r);
  assert.deepEqual(lines, ["> [!note]", "> - [ ] Research plan", ">   - read papers", ">", "> \t- interview users", "- buy bread"]);
  assert.deepEqual(r.cursor, { line: 1, ch: 8 }, "каретка не осталась на своём тексте");
  const seen = ["note"];
  for (let i = 0; i < 3; i++) {
    r = run(lines, 2, 1);
    lines = apply(lines, r);
    seen.push(String(lines[0]).replace(/^> \[!(\w+)\].*$/, "$1"));
  }
  assert.deepEqual(seen, ["note", "tip", "warning", "- [ ] Research plan"], "цикл 0 → 1 → … → n → 0");
  assert.deepEqual(lines, doc, "R-2: после полного круга строка не та");
  ok("строка с деревом в теле коллаута; круг пресетов возвращает текст байт в байт");
}

/* 3. `previous` вне коллаута — последний пресет; на первом — снятие. */
{
  assert.equal(run(["x"], 0, -1).lines[0], "> [!warning]");
  const r = run(["> [!note]", "> x"], 1, -1);
  assert.deepEqual(apply(["> [!note]", "> x"], r), ["x"]);
  assert.deepEqual(r.cursor, { line: 0, ch: 0 });
  ok("previous: вне — последний пресет, на первом — снятие");
}

/* 4. Смена пресета меняет только тип и свёрнутость, свой заголовок остаётся (В-273). */
{
  const r = run(["> [!note] My title", "> body"], 1, 1, [{ type: "note", fold: "" }, { type: "tip", fold: "-" }]);
  assert.deepEqual(r.lines, ["> [!tip]- My title"]);
  assert.equal(r.from, 0);
  assert.equal(r.to, 0, "тело тронуто");
  ok("смена пресета — только тип и свёрнутость");
}

/* 5. Тип не из пресетов: next — первый, previous — последний; ручной коллаут снимается без `>` и строки типа. */
{
  assert.equal(run(["> [!info] T", "> b"], 1, 1).lines[0], "> [!note] T");
  assert.equal(run(["> [!info] T", "> b"], 1, -1).lines[0], "> [!warning] T");
  assert.deepEqual(apply(["> [!note]", "> a", "> > quote", "after"], run(["> [!note]", "> a", "> > quote", "after"], 1, -1)),
    ["a", "> quote", "after"]);
  ok("чужой тип входит в перебор, ручной коллаут снимается без потерь тела");
}

/* 6. Вложенный: действует самый внутренний. */
{
  const doc = ["> [!note]", "> > [!tip]", "> > inner", "> outer"];
  assert.deepEqual(apply(doc, run(doc, 2, 1)), ["> [!note]", "> > [!warning]", "> > inner", "> outer"]);
  assert.deepEqual(apply(doc, run(doc, 2, -1)), ["> [!note]", "> > [!note]", "> > inner", "> outer"]);
  assert.deepEqual(apply(doc, run(doc, 3, 1)), ["> [!tip]", "> > [!tip]", "> > inner", "> outer"]);
  const off = apply(doc, run(doc, 2, -1));
  assert.deepEqual(apply(off, run(off, 2, -1)), ["> [!note]", "> inner", "> outer"]);
  /* Уровни записаны по-разному — снимается именно внутренний. */
  const tight = ["> [!note]", "> >[!note]", "> >inner"];
  assert.deepEqual(apply(tight, run(tight, 2, -1)), ["> [!note]", "> inner"]);
  ok("вложенный коллаут: перебор и снятие у самого внутреннего");
}

/* 7. Выделение: все затронутые строки целиком. */
{
  const r = run(["a", "b", "c"], 0, 1, presets, 0, { from: 0, to: 1 });
  assert.deepEqual(apply(["a", "b", "c"], r), ["> [!note]", "> a", "> b", "c"]);
  ok("выделение оборачивается по строкам");
}

/* 8. Один видимый пресет — вкл/выкл; скрытый пропускается. */
{
  const one = [{ type: "note", fold: "-" }, { type: "tip", fold: "", hidden: true }];
  const on = apply(["x"], run(["x"], 0, 1, one));
  assert.deepEqual(on, ["> [!note]-", "> x"]);
  assert.deepEqual(apply(on, run(on, 1, 1, one)), ["x"]);
  assert.equal(run(["x"], 0, -1, one).lines[0], "> [!note]-", "скрытый пресет не пропущен");
  ok("один видимый пресет — вкл/выкл, скрытый не участвует");
}

/* 9. Очистка (6.2) дорогой Transform (В-274). */
{
  const cfg = I.migrateConfig({
    schemaVersion: 2,
    pkm: {
      lineFormat: { separator1: "||", separator2: "||" },
      fields: {
        order: {
          left: ["Status", "Prio"], right: ["Project"],
          strictNames: { Status: "Status", Prio: "Prio", Project: "Project" },
          types: { Status: "tag", Prio: "tag", Project: "wikilink" },
        },
        tags: { fields: [
          { id: "Status", prefix: "#", values: [{ token: "todo" }, { token: "done" }] },
          { id: "Prio", prefix: "#", values: [{ token: "high" }, { token: "low" }] },
        ] },
        links: { fields: [{ id: "Project", values: [{ token: "Project A" }] }] },
      },
    },
  });
  const clean = (line: string, keep: string[], selection: Any = null, lines: string[] = [line]): Any =>
    cleanup.run({ lines, cursor: { line: 0, ch: 2 }, cfg, selection }, [{ keep }], 1);
  const line = "- [ ] #todo #high || call the bank about the card || [[Project A]]";
  assert.deepEqual(clean(line, ["Project"]).lines, ["- [ ] call the bank about the card || [[Project A]]"]);
  assert.deepEqual(clean(line, []).lines, ["- [ ] call the bank about the card"]);
  assert.deepEqual(clean("- text #idea in text", []), null, "строка без Values создала шаг отмены");
  assert.deepEqual(clean("- #todo || text #idea", []).lines, ["- text #idea"], "тег в тексте, не Value, удалён");
  const tree = ["- #todo || a", "  - #high || b", "- #low || c"];
  assert.deepEqual(clean("", [], null, tree).lines, ["- a"], "без выделения тронуты потомки");
  const r = clean("", [], { from: 0, to: 2 }, tree);
  assert.deepEqual(apply(tree, r), ["- a", "  - b", "- c"]);
  ok("очистка: Values уходят, оставленный Field и текст — на месте, пустая строка шага не заводит");
}

console.log(passed + " проверок пройдено");
