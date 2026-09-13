/**
 * Правила для движков приезжают **только** из настроек (PRD 10.13.52, П-8;
 * решение заказчика 2026-09-11, шаг третий — 2026-09-13).
 *
 * **Что здесь стояло раньше и почему этого больше нет.** До 2026-09-13 файл
 * сверял два хода на одних входах: конфиг → заметка `generated_rules.md` →
 * `parseRulesFromMarkdown` → правила против конфиг → `buildRulesForEngines` →
 * правила. Сверка была первым пунктом порядка снятия файла и своё отработала:
 * по ней переведены навигация, движок тегов и движок элементов. Шагом третьим
 * на неё перешла панель TagWheel, разбор заметки снят из продукта целиком — и
 * сверять стало нечего. Пин, у которого не осталось предмета, зелен именно
 * потому, что искать нечего (У-141), поэтому он не оставлен, а **заменён**.
 *
 * **Что спрашивается вместо него.** То же, что и было предметом, но с другой
 * стороны: движок обязан взять правила из ключа `Rules data` и **не иметь
 * другого хода**.
 *
 *   1. строка, которую движок написал, собрана по правилам из ключа;
 *   2. другой ключ — другая строка (иначе равенство выполнялось бы и тогда,
 *      когда ключ не смотрят вовсе, У-56);
 *   3. vault под движком — ловушка: любое обращение к диску роняет прогон;
 *   4. ключа нет — движок отказывается вслух и строки не трогает;
 *   5. и ключ доезжает от слоя команд, а не только из этой проверки.
 *
 * Движка спрашивается два: теги и элементы. Первый прогон мутаций 2026-09-11
 * показал, что движок тегов не покрыт вовсе, — движков двое, и спросить надо
 * обоих (У-134).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { loadPluginInternals } from "../harness/plugin_internals.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const nodeRequire = Module.createRequire(import.meta.url);

const internals = loadPluginInternals();
const shape = nodeRequire(path.join(root, "src", "core", "pkm_rules_shape.js"));
const runtime = nodeRequire(path.join(root, "pkm_runtime_v2.js"));
const keys = nodeRequire(path.join(root, "src", "core", "pkm_option_keys.js")).KEYS;

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

function makeEditor(line: string, ch: number): Any {
  let cur = { line: 0, ch };
  let text = line;
  return {
    getCursor: () => ({ line: cur.line, ch: cur.ch }),
    getLine: () => text,
    setLine: (_n: number, v: string) => { text = String(v || ""); },
    replaceRange: (v: string) => { text = String(v || ""); },
    setCursor: (next: Any) => { cur = { line: Number(next.line || 0), ch: Number(next.ch || 0) }; },
    snapshot: () => ({ line: text, cursor: cur }),
  };
}

/**
 * `app` Obsidian, у которого vault — **ловушка**.
 *
 * Это и есть проверка «другого хода нет»: пока подделка отдавала заметку
 * правил, равенство строк было зелёным и при движке, который ключ не смотрит
 * (обе стороны шли через диск и равнялись сами себе). Теперь диска под
 * движком нет вовсе.
 */
function makeApp(editor: Any): Any {
  const trap = (p: Any): never => {
    const shown = p && typeof p === "object" ? p.path : p;
    throw new Error("движок полез в vault за '" + String(shown) + "', а правила приезжают ключом");
  };
  return {
    workspace: { activeLeaf: { view: { editor } }, activeEditor: { editor } },
    vault: { getAbstractFileByPath: trap, read: trap, adapter: { read: trap } },
  };
}

const ORDER = JSON.stringify({
  left: ["importance", "priority", "type", "category", "context"],
  right: ["date_due", "due", "project"],
  active: { date_due: "yes", due: "yes" },
  enabled: { date_due: true, due: true },
  strictNames: {},
  types: {},
});

const said: string[] = [];

async function runEngine(before: string, extra: Any, command?: string): Promise<string> {
  const editor = makeEditor(before, before.length);
  const app = makeApp(editor);
  const g = globalThis as Any;
  if (!g.window) g.window = { __tagWheelState: { active: false }, addEventListener() {}, removeEventListener() {} };
  said.length = 0;
  g.Notice = function Notice(message: Any) { said.push(String(message)); };
  await runtime.runCommand({
    app,
    command: command || "statusDate",
    settings: Object.assign({
      [keys.ACTION_TYPE]: "field_inc:date_due",
      [keys.ORDER_CONFIG]: ORDER,
      [keys.CYCLE_END_BEHAVIOR]: "keep-bullet",
      [keys.CURSOR_POLICY]: "line_end",
    }, extra),
  });
  return editor.snapshot().line;
}

/** Конфиг заказчика в той части, которую он назвал, с разведёнными разделителями. */
function configWithSeparators(second: string): Any {
  const cfg = internals.migrateConfig(
    JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "config_v1_realistic.json"), "utf8")));
  cfg.pkm.lineFormat.separator1 = "||";
  cfg.pkm.lineFormat.separator2 = second;
  return cfg;
}

const LINE = "- [ ] #todo || 1244";

/* ---- 1. движок пишет строку по правилам из ключа ------------------------ */

{
  const cfg = configWithSeparators("::");
  const rules = shape.buildRulesForEngines(cfg);

  /*
   * Положительный контроль (У-88): у правил есть чему доезжать — порядок
   * Fields и разделители строки. На пустой форме утверждения ниже прошли бы
   * сами собой.
   */
  assert.ok(Object.keys((rules.behavior && rules.behavior.order) || {}).length > 0,
    "в правилах из настроек есть порядок Fields");
  assert.ok(Object.keys(rules.io || {}).length > 0, "и разделители строки");

  const written = await runEngine(LINE, { [keys.RULES_DATA]: JSON.stringify(rules) });
  assert.notEqual(written, LINE, "положительный контроль: движок строку не тронул — мерить нечего");
  assert.match(written, /\|\| 1244 :: /, "движок отделил правый Block вторым разделителем из настроек");
  ok("движок пишет строку по правилам, приехавшим ключом `Rules data`");
}

/* ---- 2. другой ключ — другая строка ------------------------------------- */

{
  /*
   * Пин на то, **какой источник читают** (У-56, У-92). Равенство «строка та
   * же» выполняется и у движка, который ключ игнорирует; различение —
   * единственное, что на это отвечает. Второй разделитель здесь другой, и в
   * строке обязан оказаться он.
   */
  const other = configWithSeparators("~~");
  const written = await runEngine(LINE, { [keys.RULES_DATA]: JSON.stringify(shape.buildRulesForEngines(other)) });
  assert.match(written, /\|\| 1244 ~~ /, "движок взял разделитель не из ключа: " + written);
  ok("движок элементов читает именно тот ключ, который ему дали");

  const TAGGED = "- [ ] #todo || 1244 :: \u{1F4C5}2026-09-04";
  const cycled = await runEngine(TAGGED, {
    [keys.ACTION_TYPE]: "cycle_field:type",
    [keys.DIRECTION]: "increase",
    [keys.RULES_DATA]: JSON.stringify(shape.buildRulesForEngines(other)),
  }, "statusTags");
  assert.match(cycled, /~~/, "движок тегов взял разделитель не из ключа: " + cycled);
  ok("движок тегов — тоже");
}

/* ---- 3. ключа нет — отказ вслух, строка цела ---------------------------- */

{
  /*
   * **Запасного хода через файл больше нет** (шаг третий). Прежде движок в
   * этом случае читал заметку правил с диска; теперь диска под ним нет, и
   * тихо продолжить означало бы работать по правилам, которых человек не
   * задавал. Отказ громкий: команду позвал человек (PRD 15.2).
   */
  const written = await runEngine(LINE, {});
  assert.equal(written, LINE, "без правил движок строку трогать не должен");
  assert.ok(said.some((m) => /No rules came with the command/.test(m)),
    "и обязан сказать, почему ничего не произошло: " + JSON.stringify(said));
  ok("ключа нет — движок отказывается вслух и строку не трогает");
}

/* ---- 4. ключ доезжает от слоя команд, а не только из проверки ----------- */

{
  /*
   * Пин на подачу (У-56): правила можно сколько угодно уметь читать из
   * настроек, но если слой команд их туда не кладёт, у человека не сработает
   * ни одна команда, а все проверки выше останутся зелёными.
   */
  const registry = nodeRequire(path.join(root, "src", "features", "command_registry.js"));
  const cfg = internals.migrateConfig(
    JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "config_v1_realistic.json"), "utf8")));
  const defs = registry.buildPkmCommandDefs(
    () => "InlineOverhaul_Generated_RULES_TagWheel.md",
    () => ORDER,
    () => "{}",
    (raw: Any) => (raw && typeof raw === "object" ? raw : { left: [], right: [], strictNames: {}, types: {} }),
    cfg,
    ["navigation", "pkm"],
  );
  assert.ok(Array.isArray(defs) && defs.length > 0, "положительный контроль: команды PKM собрались");
  /* Настройки команда строит сама, из конфига: список их не хранит. */
  const settingsOf = (d: Any): Any => (typeof d.makeSettings === "function" ? d.makeSettings(cfg) : d.settings);
  const withRules = defs.filter((d: Any) => {
    const st = settingsOf(d);
    return st && st[keys.RULES_DATA];
  });
  assert.equal(withRules.length, defs.length,
    `правила из настроек приезжают не во все команды PKM: ${withRules.length} из ${defs.length}`);
  const sample = settingsOf(withRules[0])[keys.RULES_DATA];
  const parsed = typeof sample === "string" ? JSON.parse(sample) : sample;
  assert.ok(parsed && parsed.io && parsed.behavior,
    "в ключе `Rules data` лежат не правила: нет ни разделителей, ни поведения");
  ok("слой команд кладёт правила в каждую команду PKM");

  /*
   * И панель TagWheel — тоже команда PKM, но собирается она отдельными
   * определениями (`open-tagwheel-left` / `-right`), а `defs.length` выше
   * посчитал бы их и не заметил, если бы ключ у них пропал вместе с обоими.
   * Спрашиваются они поимённо (У-134).
   */
  for (const id of ["open-tagwheel-left", "open-tagwheel-right"]) {
    const def: Any = defs.find((d: Any) => String(d.id) === id);
    assert.ok(def, `команда ${id} собрана`);
    const st = settingsOf(def);
    assert.ok(st && st[keys.RULES_DATA], `команде ${id} правила из настроек не приезжают`);
  }
  ok("обе команды TagWheel получают правила тем же ключом");
}

console.log(`Rules from settings tests: OK (${passed} checks)`);
