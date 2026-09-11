/**
 * Правила для движков приезжают из настроек: сверка двух ходов
 * (PRD 10.13.52, П-8, шаг второй; решение заказчика 2026-09-11).
 *
 * **Что сверяется.** Один конфиг, два хода:
 *
 *   1. сегодняшний: конфиг → заметка `generated_rules.md` →
 *      `parseRulesFromMarkdown` → правила;
 *   2. завтрашний: конфиг → `buildRulesForEngines` → правила.
 *
 * Сверка идёт на **двух уровнях**, и второй важнее первого: сначала формы
 * целиком, потом — что делает движок на настоящей строке, заведённый обоими
 * ходами. Равенство форм говорит «перекладка та же»; равенство строки говорит
 * «человек не заметит разницы», а это и есть предмет (У-4).
 *
 * **Чего эта сверка не доказывает.** Обе стороны первого уровня растут из
 * одного места: заметка печатается из той же формы. Ошибка в самой перекладке
 * уедет в обе стороны сразу и останется незамеченной (У-92) — ровно как в
 * `navigate_rules_direct_tests.ts`. Ловит такую поведение движка, и оно здесь
 * второй половиной.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { loadPluginInternals } from "../harness/plugin_internals.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const nodeRequire = Module.createRequire(import.meta.url);

const internals = loadPluginInternals();
const builder = nodeRequire(path.join(root, "src", "features", "rules_markdown_builder.js"))
  .createRulesMarkdownBuilder({});
const shape = nodeRequire(path.join(root, "src", "core", "pkm_rules_shape.js"));
const core = nodeRequire(path.join(root, "pkm_v2", "TagWheel", "tagwheel_core.js"));
const runtime = nodeRequire(path.join(root, "pkm_runtime_v2.js"));
const keys = nodeRequire(path.join(root, "src", "core", "pkm_option_keys.js")).KEYS;

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

const FIXTURES = ["config_v1_full.json", "config_v1_realistic.json"];

/* ---- 1. формы обоих ходов совпадают ------------------------------------ */

for (const name of FIXTURES) {
  const cfg = internals.migrateConfig(
    JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", name), "utf8")));
  const viaDisk = core.parseRulesFromMarkdown(builder.buildTagWheelRulesMarkdownFromConfig(cfg));
  const direct = shape.buildRulesForEngines(cfg);

  /*
   * Положительный контроль (У-88): сверка пустых форм проходит сама собой.
   * У обеих сторон обязан быть хотя бы порядок Fields и разделители строки.
   */
  assert.ok(Object.keys((viaDisk.behavior && viaDisk.behavior.order) || {}).length > 0,
    `${name}: в правилах есть порядок Fields — сверять есть что`);
  assert.ok(Object.keys(viaDisk.io || {}).length > 0, `${name}: в правилах есть разделители строки`);

  assert.deepStrictEqual(Object.keys(direct).sort(), Object.keys(viaDisk).sort(),
    `${name}: у прямого чтения другой набор блоков, чем у хода через документ`);
  assert.deepStrictEqual(direct, viaDisk,
    `${name}: правила из настроек разошлись с правилами из документа`);
  ok(`${name}: правила из настроек равны правилам из документа`);
}

/* ---- 2. движок на настоящей строке: оба хода дают одно и то же ---------- */

/**
 * Заметка правил кладётся во временный файл, и путь к ней движку подаётся —
 * это и есть «сегодняшний ход». Второй ход тот же движок получает тем же
 * вызовом, только правила приезжают ключом `Rules data`.
 */
const tmpRules = path.join(os.tmpdir(), "io-rules-from-settings.md");

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

function makeApp(editor: Any): Any {
  const read = async (): Promise<string> => fs.readFileSync(tmpRules, "utf8");
  return {
    workspace: { activeLeaf: { view: { editor } }, activeEditor: { editor } },
    vault: {
      getAbstractFileByPath: (p: string) => ({ path: p }),
      read,
      adapter: { read },
    },
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

async function runEngine(before: string, extra: Any, command?: string): Promise<string> {
  const editor = makeEditor(before, before.length);
  const app = makeApp(editor);
  const g = globalThis as Any;
  if (!g.window) g.window = { __tagWheelState: { active: false }, addEventListener() {}, removeEventListener() {} };
  if (typeof g.Notice !== "function") g.Notice = function Notice() {};
  await runtime.runCommand({
    app,
    command: command || "statusDate",
    settings: Object.assign({
      [keys.RULES_PATH]: "InlineOverhaul_Generated_RULES_TagWheel.md",
      [keys.ACTION_TYPE]: "field_inc:date_due",
      [keys.ORDER_CONFIG]: ORDER,
      [keys.CYCLE_END_BEHAVIOR]: "keep-bullet",
      [keys.CURSOR_POLICY]: "line_end",
    }, extra),
  });
  return editor.snapshot().line;
}

{
  /*
   * Конфиг заказчика в той части, которую он назвал: разделители разведены
   * (`||` и `::`). На одинаковых разделителях половина правил неразличима
   * (У-147), и сверка двух ходов прошла бы, не увидев подмены.
   */
  const cfg = internals.migrateConfig(
    JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "config_v1_realistic.json"), "utf8")));
  cfg.pkm.lineFormat.separator1 = "||";
  cfg.pkm.lineFormat.separator2 = "::";
  fs.writeFileSync(tmpRules, builder.buildTagWheelRulesMarkdownFromConfig(cfg));

  const LINE = "- [ ] #todo || 1244";
  const viaDisk = await runEngine(LINE, {});
  const viaSettings = await runEngine(LINE, { [keys.RULES_DATA]: JSON.stringify(shape.buildRulesForEngines(cfg)) });

  /* Положительный контроль: движок и правда что-то сделал со строкой. */
  assert.notEqual(viaDisk, LINE, "положительный контроль: ход через документ строку не изменил — сверять нечего");
  assert.match(viaDisk, /\|\| 1244 :: /, "ход через документ отделил правый Block вторым разделителем");
  assert.equal(viaSettings, viaDisk, "движок на правилах из настроек дал другую строку, чем на правилах из документа");
  ok("движок: правила из настроек дают ту же строку, что правила из документа");

  /*
   * **И пин на то, какой источник читают** (У-56, У-92). Равенство выше
   * выполняется и тогда, когда ключ `Rules data` движок не смотрит вовсе: оба
   * хода идут через файл, и обе стороны равны сами себе. Поэтому здесь
   * источники **разведены нарочно**: в настройках второй разделитель другой,
   * чем в заметке на диске, и в строке обязан оказаться он.
   */
  const other = internals.migrateConfig(
    JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "config_v1_realistic.json"), "utf8")));
  other.pkm.lineFormat.separator1 = "||";
  other.pkm.lineFormat.separator2 = "~~";
  const viaOther = await runEngine(LINE, { [keys.RULES_DATA]: JSON.stringify(shape.buildRulesForEngines(other)) });
  assert.match(viaOther, /\|\| 1244 ~~ /,
    "движок взял разделитель из файла, а не из настроек: " + viaOther);
  assert.notEqual(viaOther, viaDisk, "контроль: разведённые источники обязаны давать разные строки");
  ok("движок читает правила из настроек, а не из файла");

  /*
   * **И то же самое у второго движка.** Первый прогон мутаций показал, что
   * движок тегов не покрыт вовсе: подмена «игнорировать правила из настроек»
   * его не роняла ни здесь, ни в проверке поведения. Движка два, и спросить
   * надо оба (У-134).
   */
  const TAGGED = "- [ ] #todo || 1244 :: \u{1F4C5}2026-09-04";
  const cycled = await runEngine(TAGGED, {
    [keys.ACTION_TYPE]: "cycle_field:type",
    [keys.DIRECTION]: "increase",
    [keys.RULES_DATA]: JSON.stringify(shape.buildRulesForEngines(other)),
  }, "statusTags");
  assert.match(cycled, /~~/, "движок тегов взял разделители из файла, а не из настроек: " + cycled);
  ok("движок тегов тоже читает правила из настроек");
}

/* ---- 3. ключ доезжает от слоя команд, а не только из проверки ----------- */

{
  /*
   * Пин на подачу (У-56): правила можно сколько угодно уметь читать из
   * настроек, но если слой команд их туда не кладёт, движок продолжит читать
   * файл, и все проверки выше останутся зелёными.
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
}

console.log(`Rules from settings tests: OK (${passed} checks)`);
