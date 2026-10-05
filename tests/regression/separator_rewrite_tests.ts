/*
 * Замена старых Separators в заметках (его ответ к В-292, 2026-10-05):
 * меняются только знаки на местах разделителей, и строка после замены
 * читается новыми знаками так же, как прежняя — старыми.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { applyStarterSet } from "../../src/core/starter_config.ts";

const require = createRequire(import.meta.url);
const normalize = require("../../src/core/config_normalize.js");
const rewrite = require("../../src/features/separator_rewrite.js");
const rulesShape = require("../../src/core/pkm_rules_shape.js");
const linePipeline = require("../../src/core/line_pipeline.js");

type Any = ReturnType<typeof JSON.parse>;
const fresh = normalize.migrateConfig(null);
assert.equal(applyStarterSet(fresh), true, "стартовый набор не встал");
const base = normalize.migrateConfig(fresh);
const withSepsRaw = (s: string): Any => {
  const c = JSON.parse(JSON.stringify(base));
  c.pkm.lineFormat.separator1 = s;
  return normalize.migrateConfig(c);
};
assert.equal(base.pkm.lineFormat.separator1, "||", "контроль фикстуры: стартовые знаки `||`");
assert.equal(base.pkm.lineFormat.notesSeparator1, "||", "нормализация не завела «чем написаны заметки»");
assert.equal(withSepsRaw("::").pkm.lineFormat.notesSeparator1, "||", "смена знака переписала «чем написаны заметки» — строки замены не будет");

const withSeps = (s1: string, s2: string): Any => {
  const c = JSON.parse(JSON.stringify(base));
  c.pkm.lineFormat.separator1 = s1;
  c.pkm.lineFormat.separator2 = s2;
  return normalize.migrateConfig(c);
};
let passed = 0;
const one = (line: string, to: { s1: string; s2: string }, want: string, title: string): void => {
  const got = rewrite.rewriteNoteSeparators(line, withSeps(to.s1, to.s2), { s1: "||", s2: "||" }, to);
  assert.equal(got.text, want, title + ": " + JSON.stringify(line));
  assert.equal(got.lines, want === line ? 0 : 1, title + ": счёт строк");
  passed++;
};
const BOTH = { s1: "::", s2: "::" };
one("- #todo || call the bank || [[Project A]] 📅2026-09-15", BOTH, "- #todo :: call the bank :: [[Project A]] 📅2026-09-15", "оба знака");
one("- [ ] #todo #high || call Anna", BOTH, "- [ ] #todo #high :: call Anna", "только левый Block");
one("- call Anna || 📅2026-09-30", BOTH, "- call Anna :: 📅2026-09-30", "только правый Block");
one("- compare a || b", BOTH, "- compare a || b", "строка без значений — текст человека");
one("- #todo || a || b || 📅2026-09-30", BOTH, "- #todo || a || b || 📅2026-09-30", "знаков больше двух — строка не трогается");
{
  const amb = rewrite.rewriteNoteSeparators("- #todo || a || b || 📅2026-09-30", withSeps("::", "::"), { s1: "||", s2: "||" }, BOTH);
  assert.equal(amb.skipped, 1, "неоднозначная строка названа числом");
  passed++;
}
one("## #todo || plan", BOTH, "## #todo :: plan", "заголовок");
/* Его заметки: пример строки в обратных кавычках — текст, а не строка плагина. */
one("3. если в исходной записи есть префикс (`- [ ] #todo || text`) при выходе", BOTH, "3. если в исходной записи есть префикс (`- [ ] #todo || text`) при выходе", "знак во встроенном коде");
one("`- [ ] ● || позвонить || [[Project A]] 📅2026-09-15`, где", BOTH, "`- [ ] ● || позвонить || [[Project A]] 📅2026-09-15`, где", "строка-пример целиком в коде");
one("> - #todo || call Anna", BOTH, "> - #todo :: call Anna", "цитата");
one("\t- #todo || call Anna", BOTH, "\t- #todo :: call Anna", "отступ");
one("- #todo :: call Anna", BOTH, "- #todo :: call Anna", "уже новые знаки — без правки");
/* Меняется только первый: правый знак — свой. */
const FIRST = { s1: "::", s2: "||" };
one("- #todo || call || 📅2026-09-30", FIRST, "- #todo :: call || 📅2026-09-30", "первый: два знака");
one("- #todo || call Anna", FIRST, "- #todo :: call Anna", "первый: один знак слева");
one("- call Anna || 📅2026-09-30", FIRST, "- call Anna || 📅2026-09-30", "первый: один знак справа не трогается");
const SECOND = { s1: "||", s2: "::" };
one("- call Anna || 📅2026-09-30", SECOND, "- call Anna :: 📅2026-09-30", "второй: один знак справа");
one("- #todo || call Anna", SECOND, "- #todo || call Anna", "второй: один знак слева не трогается");
console.log("  ok формы строки: меняется ровно знак разделителя");

/* Заметка целиком: frontmatter и блок кода не трогаются, перевод строки — свой. */
const note = "---\ntags: a || b\n---\n- #todo || one\n```\n- #todo || code\n```\n- two || 📅2026-09-30\n";
const done = rewrite.rewriteNoteSeparators(note, withSeps("::", "::"), { s1: "||", s2: "||" }, BOTH);
assert.equal(done.text, "---\ntags: a || b\n---\n- #todo :: one\n```\n- #todo || code\n```\n- two :: 📅2026-09-30\n", "заметка");
assert.equal(done.lines, 2, "строк заменено");
const crlf = rewrite.rewriteNoteSeparators(note.replace(/\n/g, "\r\n"), withSeps("::", "::"), { s1: "||", s2: "||" }, BOTH);
assert.equal(crlf.text, done.text.replace(/\n/g, "\r\n"), "CRLF-заметка сохраняет свои переводы строки");
passed += 3;
console.log("  ok заметка: frontmatter и код на месте");

/* Сверка смысла: новая строка новыми знаками читается так же, как прежняя — старыми. */
const oldRules = rulesShape.buildRulesForEngines(base);
const newCfg = withSeps("::", "::");
const newRules = rulesShape.buildRulesForEngines(newCfg);
const seg = (l: string, r: Any): string => {
  const s = linePipeline.splitSegments(l, r);
  return JSON.stringify([String(s.left || "").trim(), String(s.text || "").trim(), String(s.dates || "").trim()]);
};
const corpus = [
  "- #todo || call the bank || [[Project A]] 📅2026-09-15",
  "- [ ] #todo #high || call Anna",
  "- call Anna || 📅2026-09-30",
  "1. #idea || write it down || 📅2026-10-01",
];
for (const l of corpus) {
  const nl = rewrite.rewriteNoteSeparators(l, newCfg, { s1: "||", s2: "||" }, BOTH).text;
  assert.notEqual(nl, l, "контроль: строка заменена: " + l);
  assert.equal(seg(nl, newRules), seg(l, oldRules), "смысл строки разошёлся после замены: " + l + " → " + nl);
  passed++;
}
console.log("  ok смысл строки: Block и текст те же после замены");
/* Кнопка `Replace in all notes`: вхолостую считает, спрашивает числами, пишет, затем строка пропадает. */
{
  const { buildActions } = await import("../../src/ui/settings/actions.ts");
  const cfg = withSeps("::", "::");
  cfg.pkm.lineFormat.notesSeparator1 = "||";
  cfg.pkm.lineFormat.notesSeparator2 = "||";
  const files: Record<string, string> = {
    "a.md": "- #todo || one\n- plain || text\n",
    "b.md": "- two || 📅2026-09-30\n",
    "c.md": "nothing here\n",
  };
  const asked: Any[] = [];
  const said: string[] = [];
  let patched: Any = null;
  let answer = false;
  const run = async (): Promise<void> => {
    const actions = buildActions({
      notify: m => { said.push(m); },
      confirm: async o => { asked.push(o); return answer; },
      config: { get: () => JSON.parse(JSON.stringify(cfg)), replace: () => true, patch: p => { patched = p; } },
      notes: {
        list: () => Object.keys(files),
        read: async p => files[p] || "",
        rewrite: async (p, fn) => { files[p] = fn(files[p] || ""); },
      },
    });
    await (actions["rewrite-separators"] as () => Promise<void>)();
  };
  await run();
  assert.equal(asked.length, 1, "окно не спросило");
  assert.equal(asked[0].body, "Lines with the old Separator: 2 lines in 2 notes. Only the Separator changes", "числа в окне: " + asked[0].body);
  assert.equal(files["a.md"], "- #todo || one\n- plain || text\n", "отказ всё равно записал");
  assert.equal(patched, null, "отказ отметил заметки новыми");
  answer = true;
  await run();
  assert.equal(files["a.md"], "- #todo :: one\n- plain || text\n", "заметка a");
  assert.equal(files["b.md"], "- two :: 📅2026-09-30\n", "заметка b");
  assert.deepEqual(patched, { pkm: { lineFormat: { notesSeparator1: "::", notesSeparator2: "::" } } }, "строка не пропадёт");
  assert.equal(said[said.length - 1], "Separators replaced: 2 lines in 2 notes", "итог не назван");
  passed += 8;
  console.log("  ok кнопка: окно с числами, отказ ничего не пишет, согласие пишет и снимает строку");
}
console.log(`separator_rewrite: ${passed} passed`);
