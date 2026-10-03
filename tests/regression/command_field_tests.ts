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
  /* В коллауте — как вне его (его пункт «Новое» 2026-10-03: в коллауте не ушла приставка). */
  for (const l of [line, "- [ ] #todo #high || call"]) {
    assert.deepEqual(clean("> " + l, []).lines, ["> " + clean(l, []).lines[0]], "в коллауте очистка другая: " + l);
  }
  ok("очистка: Values уходят, оставленный Field и текст — на месте, пустая строка шага не заводит");
}

/* 10. Вставка блока (6.3): пример постановки, предусловия, четыре обёртки, перебор, снятие с дописанным (ответ 10). */
{
  const block = CF.categoryById("block");
  const toc = block.defaults[0];
  const runB = (lines: string[], line: number, step: number, list: Any[] = [toc]): Any =>
    block.run({ lines, cursor: { line, ch: 0 }, presets: list }, list, step);
  const doc = ["# Note", "", "tail"];
  const r = runB(doc, 1, 1);
  let lines = apply(doc, r);
  assert.deepEqual(lines, ["# Note", "## Contents", "> [!note]- Contents", "> ```table-of-contents", "> ```", "tail"], "пример 6.3");
  assert.deepEqual(apply(lines, runB(lines, 3, -1)), doc, "R-2: previous на единственном пресете не снял блок");
  assert.deepEqual(runB(["text"], 0, 1), { refuse: "block-not-empty" }, "непустая строка не отказала");
  assert.deepEqual(runB(["## Contents", ""], 1, 1), { refuse: "block-heading-exists", args: ["Contents"] }, "такой же заголовок не отказал");
  /* Четыре обёртки — корректный markdown. */
  const base = { content: "```x\n```", headingText: "H", headingLevel: 3, type: "tip", fold: "", title: "" };
  const shapes = [[false, false], [true, false], [false, true], [true, true]].map(([h, c]) =>
    apply([""], runB([""], 0, 1, [{ ...base, heading: h, callout: c }])).join("|"));
  assert.deepEqual(shapes, ["```x|```", "### H|```x|```", "> [!tip]|> ```x|> ```", "### H|> [!tip]|> ```x|> ```"]);
  /* Правка внутри не мешает распознаванию; снятие оставляет дописанное текстом (его ответ 10). */
  const edited = ["## Contents", "> [!note]- Contents", "> ```table-of-contents", "> my line", "> ```", "after"];
  assert.equal(block.recognize({ lines: edited, cursor: { line: 3, ch: 0 } }, [toc]), 0, "отредактированный блок не узнан");
  assert.deepEqual(apply(edited, runB(edited, 3, 1)), ["my line", "after"], "снятие унесло дописанное");
  /* Два пресета: круг 0 → 1 → 2 → 0; блок без коллаута узнаётся до последней строки содержимого. */
  const two = [{ ...base, heading: false, callout: false, content: "A\nB" }, { ...base, heading: true, callout: false, content: "A\nB" }];
  lines = apply([""], runB([""], 0, 1, two));
  assert.deepEqual(lines, ["A", "B"]);
  lines = apply(lines, runB(lines, 1, 1, two));
  assert.deepEqual(lines, ["### H", "A", "B"]);
  assert.deepEqual(apply(lines, runB(lines, 2, 1, two)), [""], "круг не вернул пустую строку");
  /* Дорога команды: отказ доходит до вызывающего с причиной и текст не трогает; текст уведомления — с подстановкой. */
  let edits = 0;
  const ed = { getValue: () => "## Contents\n", getCursor: () => ({ line: 1, ch: 0 }), somethingSelected: () => false, transaction: () => { edits++; } };
  const cfg = { pkm: { fields: { commands: { byField: { F: { categories: [{ id: "block", key: "block", presets: [toc] }] } } } } } };
  const got = CF.runInEditor(ed, cfg, "F", "block", 1);
  assert.deepEqual(got, { refuse: "block-heading-exists", args: ["Contents"] });
  assert.equal(edits, 0, "отказ всё же правил текст");
  assert.equal(CF.refusalText(got, "F · Insert block"), "F · Insert block: the note already has the heading Contents");
  ok("вставка блока: пример 6.3, отказы, четыре обёртки, правка внутри, снятие с дописанным, круг пресетов, отказ командой");
}

/* 11. Дерево ↔ раздел (6.4): переключатель (ответ 7), пример постановки, уровень, три положения, обратный путь. */
{
  const sec = CF.categoryById("section");
  const def = sec.defaults[0];
  const go = (lines: string[], line: number, preset: Any = def, cfg: Any = null): Any =>
    sec.run({ lines, cursor: { line, ch: 0 }, cfg }, [preset], 1);
  const doc = ["## Log", "- [ ] #todo || Research plan || [[Project A]]", "  - read papers", "  - interview users", "- buy bread"];
  const r = go(doc, 1);
  const out = apply(doc, r);
  assert.deepEqual(out, ["## Log", "- buy bread", "", "### #todo || Research plan || [[Project A]]", "- read papers", "- interview users"], "пример 6.4");
  assert.equal(out[r.cursor.line], "### #todo || Research plan || [[Project A]]", "каретка не на новом заголовке");
  /* Уровень: без заголовков выше — H1; под H6 — H6 (ответ 8); фиксированный — свой. */
  assert.equal(apply(["- a"], go(["- a"], 0))[0], "# a");
  assert.equal(apply(["###### deep", "- a"], go(["###### deep", "- a"], 1)).slice(-1)[0], "###### a");
  assert.equal(apply(["# t", "- a"], go(["# t", "- a"], 1, { ...def, level: "4", place: "in-place" }))[1], "#### a");
  /* На месте: строки после дерева становятся телом раздела (ограничение 8). */
  assert.deepEqual(apply(["- a", "\t- b", "- c"], go(["- a", "\t- b", "- c"], 0, { ...def, place: "in-place" })), ["# a", "- b", "- c"]);
  /* В конец раздела: до следующего заголовка того же уровня; список вне дерева остаётся списком. */
  const sd = ["## A", "- x", "\t- y", "- z", "", "text", "## B"];
  assert.deepEqual(apply(sd, go(sd, 1, { ...def, place: "section-end" })), ["## A", "- z", "", "text", "", "### x", "- y", "", "## B"]);
  const gap = ["## A", "- x", "- z", "", "## B"];
  assert.deepEqual(apply(gap, go(gap, 1, { ...def, place: "section-end" })), ["## A", "- z", "", "### x", "", "## B"], "пустых строк подряд две");
  /* Раздел → дерево: строка `#` в блоке кода — не заголовок; абзац, код с отступом, таблица после дерева, подзаголовок — пунктом. */
  const src = ["### Research plan", "Short intro.", "- read papers", "```js", "# not a heading", "```", "| a | b |", "|---|---|", "#### Sub", "deep", "## Next"];
  const t = apply(src, go(src, 0));
  assert.deepEqual(t, ["- Research plan", "\tShort intro.", "\t- read papers", "\t```js", "\t# not a heading", "\t```", "\t- Sub", "\t\tdeep", "", "| a | b |", "|---|---|", "## Next"]);
  assert.deepEqual(apply(src, go(src, 0, { ...def, code: "after", tables: "keep" })).slice(0, 7),
    ["- Research plan", "\tShort intro.", "\t- read papers", "| a | b |", "|---|---|", "\t- Sub", "\t\tdeep"]);
  /* R-2 «на месте»: дерево → раздел → дерево байт в байт; маркер выполненной возвращает `- [x]` (ответ 11). */
  const tree = ["- Research plan", "\t- read papers", "\t- interview users"];
  const inPlace = { ...def, place: "in-place" };
  assert.deepEqual(apply(apply(tree, go(tree, 0, inPlace)), go(apply(tree, go(tree, 0, inPlace)), 0, inPlace)), tree, "R-2 на месте");
  const doneCfg = { pkm: { behavior: { doneMarker: { token: "#done" } } } };
  const doneTree = ["- [x] call bank #done"];
  const asSection = apply(doneTree, go(doneTree, 0, inPlace));
  assert.deepEqual(asSection, ["# call bank #done"]);
  assert.deepEqual(apply(asSection, go(asSection, 0, inPlace, doneCfg)), doneTree, "маркер не вернул отметку");
  /* Круг «после списка» пустых строк не копит (его `💬` к тесту 5 цикла 126). */
  const round = (d: string[]): string[] => { const s = apply(d, go(d, 1)); return apply(s, go(s, 2)); };
  const his = ["### В", "- #todo :: Research plan", "\t- read papers", "", "## 6"];
  assert.deepEqual(round(his), his, "круг дерево → раздел → дерево не вернул строки");
  assert.deepEqual(round(round(his)), his, "второй круг добавил строку");
  ok("дерево ↔ раздел: пример 6.4, уровень, три положения, код и таблицы, подзаголовки, R-2 на месте, отметка по маркеру");
}

console.log(passed + " проверок пройдено");
