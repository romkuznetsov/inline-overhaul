/**
 * Smart Rules (PRD 10.8, фаза 3c).
 *
 * Что здесь настоящее. Путь записи — плагиновый: `ConfigStore` из `src/core`,
 * `deepMerge` и `cloneJson` из `shared_utils.js`, `migrateConfig` из `main.js`
 * (`tests/harness/plugin_internals.ts`). Разбор правил — движка:
 * `validateSmartRules` и `selectSmartTemplate` из `transform_feature.js`, то
 * есть ровно те функции, которыми плагин выбирает шаблон.
 *
 * Главная проверка — не список путей, а то, что правило, собранное панелью,
 * **срабатывает у движка**: строка отдаётся `selectSmartTemplate`, и он
 * выбирает тот шаблон, который человек назначил. Форма правила в конфиге при
 * этом не проверяется списком ключей — её проверяет сам движок тем, что
 * понимает написанное.
 *
 * Подделан только DOM: блок рисуется в Obsidian, другого способа нажать нет.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { createFieldsModel } from "../../src/ui/settings/custom/fields_model.ts";
import { createRulesModel } from "../../src/ui/settings/custom/smart_rules_model.ts";
import { renderSmartRules, renderConditionPicker } from "../../src/ui/settings/custom/smart_rules_view.ts";
import * as deepStateModule from "../../src/core/order_deep_editor_state.js";
import type { El } from "../../src/ui/settings/custom/dom.ts";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = createRequire(import.meta.url);

const shared = requireCjs(path.join(root, "src", "core", "shared_utils.js")) as {
  cloneJson: (x: Any) => Any;
  isObj: (x: Any) => boolean;
  deepMerge: (a: Any, b: Any) => Any;
};
const { ConfigStore } = requireCjs(path.join(root, "src", "core", "config_store.js")) as {
  ConfigStore: new (plugin: Any, options: Any) => Any;
};
const engine = requireCjs(path.join(root, "src", "features", "transform_feature.js")) as {
  validateSmartRules: (rules: Any[]) => Any[];
  selectSmartTemplate: (parsed: Any, rules: Any[], fallback: string, cfg?: Any) => string;
  resolveRuleFolder: (rule: Any, i2n: Any) => string;
  normalizeTransformConfig: (cfg: Any) => Any;
  parseInlineLine: (line: string, cfg: Any) => Any;
  collectTemplateOptions: (app: Any, folder: string) => string[];
};
const internals = loadPluginInternals();
const deepState = (deepStateModule as { default?: unknown }).default || deepStateModule;

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

function all(node: StubNode, cls: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (n.classList.contains(cls)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

const texts = (node: StubNode, cls: string): string[] => all(node, cls).map(n => n.textContent);

const byLabel = (node: StubNode, prefix: string): StubNode | undefined =>
  all(node, "io-icon").concat(all(node, "io-btn"))
    .find(n => String(n.getAttribute("aria-label") || "").startsWith(prefix));

/* ---- блок на настоящем пути записи ------------------------------------- */

interface Panel {
  host: StubNode;
  /** Модель того же захода отрисовки: списки выбора считает она. */
  model: () => Any;
  cfg: () => Any;
  rules: () => Any[];
  writes: Array<{ reason: string }>;
  draw: () => void;
  /** Ответ окна выбора значения: что «выбрал» человек в следующий раз. */
  answer: (value: string | null) => void;
  /** Нажатие на имя Field в том же окне: заводит «любое значение» (10.13.14). */
  answerField: (fieldId: string) => void;
}

function makePanel(
  base: Any,
  o?: {
    enabled?: boolean;
    templates?: readonly string[];
    templatesFolder?: string;
    /* Состояние вида блока (З-6): развёрнутые карточки. Передаётся снаружи,
       потому что живёт оно в блоке, а не в конфиге. */
    expanded?: Set<string>;
  },
): Panel {
  const host = makeNode("div");
  const store = new ConfigStore(
    { loadData: async () => base, saveData: async () => {} },
    {
      defaults: internals.migrateConfig(base),
      cloneJson: shared.cloneJson,
      isObj: shared.isObj,
      deepMerge: shared.deepMerge,
      migrateConfig: internals.migrateConfig,
      Notice: class StubNotice { },
    },
  );
  const writes: Array<{ reason: string }> = [];
  const plugin: Any = {
    app: {},
    getConfig: () => store.getSnapshot(),
    setConfigPatch: (patch: Any, reason: string) => {
      writes.push({ reason: reason || "settings" });
      store.patch(patch, reason || "settings");
    },
  };

  /* Что «выберет» человек в окне. С 10.13.14 ответ называет свой вид:
     значение или Field целиком. Строка остаётся сокращением для значения. */
  let nextAnswer: { kind: "value" | "field"; id: string } | null = null;
  let lastModel: Any = null;
  const draw = (): void => {
    host.empty();
    const model = createRulesModel({
      plugin,
      validate: rules => engine.validateSmartRules(rules),
      fieldTokens: () => createFieldsModel({
        plugin: plugin as never,
        normalizePkmOrder: internals.normalizePkmOrder as never,
        pkmOrderFields: [],
        cfg: plugin.getConfig() as never,
        deepState: deepState as never,
      }).listFieldTokens(),
    });
    lastModel = model;
    renderSmartRules(host as unknown as El, {
      model,
      expanded: o && o.expanded ? o.expanded : undefined,
      enabled: !(o && o.enabled === false),
      templates: o && o.templates ? o.templates : ["Templates/task.md", "Templates/meeting.md"],
      templatesFolder: o && o.templatesFolder !== undefined ? o.templatesFolder : "Templates",
      redraw: draw,
      askCondition: (_kind, done) => done(nextAnswer),
    });
  };
  draw();
  return {
    host,
    model: () => lastModel,
    cfg: () => store.getSnapshot(),
    rules: () => (store.getSnapshot().transform?.inline2note?.smartRules || []) as Any[],
    writes,
    draw,
    answer: (value: string | null) => {
      nextAnswer = value === null ? null : { kind: "value", id: value };
    },
    /* Нажатие на имя Field в окне выбора: заводит «любое значение». */
    answerField: (fieldId: string) => { nextAnswer = { kind: "field", id: fieldId }; },
  };
}

/** Конфиг с тремя Fields: тег, элемент и ссылка — по одному на вид условия. */
function baseConfig(rules?: Any[]): Any {
  return JSON.parse(JSON.stringify({
    transform: {
      inline2note: {
        enabled: true,
        templatesFolder: "Templates",
        defaultTemplate: "Templates/plain.md",
        smartRules: rules || [],
      },
    },
    pkm: {
      behavior: {
        io: { separator1: "||", separator2: "||" },
        order: {
          left: ["status"],
          right: ["project", "due"],
          labels: { status: "Status", project: "Project", due: "Due" },
          strictNames: { status: "status", project: "project", due: "due" },
          types: { status: "tag", project: "wikilink", due: "element" },
          active: { status: "yes", project: "yes", due: "yes" },
          enabled: { status: true, project: true, due: true },
        },
        leftMode: {
          fields: [
            { id: "status", prefix: "#", values: [{ token: "todo" }, { token: "doing" }] },
          ],
        },
        rightMode: {
          fields: [
            { id: "project", source: "wikilinks:project", values: [{ token: "ClientA" }] },
          ],
        },
        elements: { fields: ["due"], byField: { due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD" } } },
      },
    },
  }));
}

/* ======================================================================
 * 1. Пустой список приглашает, а не молчит.
 * ====================================================================== */

{
  const p = makePanel(baseConfig());
  assert.equal(all(p.host, "io-rule").length, 0, "правил нет");
  assert.equal(all(p.host, "io-side__empty").length, 1, "и на месте приглашение");
  ok("пустой список: приглашение вместо пустоты");
}

/* ======================================================================
 * 2. Правило собирается панелью и срабатывает у движка.
 *
 * Это главная проверка блока: форма правила проверяется не списком ключей, а
 * тем, что движок её понимает.
 * ====================================================================== */

{
  const p = makePanel(baseConfig());
  (byLabel(p.host, "Add rule") as StubNode).click();
  assert.equal(all(p.host, "io-rule").length, 1, "правило добавилось");

  /* Условие: значение выбирается в окне, а не вводится через запятую (С-5). */
  p.answer("#todo");
  (byLabel(p.host, "Add a tag") as StubNode).click();
  p.answer("\u{1F4C5}");
  (byLabel(p.host, "Add a element") as StubNode).click();

  const select = all(p.host, "io-select")[0] as StubNode;
  select.value = "Templates/task.md";
  select.dispatch("change");

  const rules = p.rules();
  assert.equal(rules.length, 1, "правило одно");
  assert.deepEqual(rules[0].conditions.tags, ["#todo"], "тег лёг в свой массив");
  assert.deepEqual(rules[0].conditions.emojiFields, ["\u{1F4C5}"], "маркер элемента — в свой");
  assert.equal(rules[0].targetTemplate, "Templates/task.md",
    "шаблон лёг в ключ, который читает движок");

  /* А теперь спросим сам движок: сработает ли правило на такой строке. */
  const cfg = p.cfg();
  const line = "- #todo \u{1F4C5}2026-08-29 || write the docs";
  const parsed = engine.parseInlineLine(line, cfg);
  assert.equal(
    engine.selectSmartTemplate(parsed, p.rules(), "Templates/plain.md"),
    "Templates/task.md",
    "движок выбрал шаблон правила");
  assert.equal(
    engine.selectSmartTemplate(engine.parseInlineLine("- #doing || other", cfg),
      p.rules(), "Templates/plain.md"),
    "Templates/plain.md",
    "а на чужой строке остаётся шаблон по умолчанию");
  ok("правило, собранное панелью, срабатывает у движка");
}

/* ======================================================================
 * 3. ИЛИ внутри типа, И между типами (С-7).
 * ====================================================================== */

{
  const p = makePanel(baseConfig());
  (byLabel(p.host, "Add rule") as StubNode).click();
  p.answer("#todo");
  (byLabel(p.host, "Add a tag") as StubNode).click();
  p.answer("#doing");
  (byLabel(p.host, "Add a tag") as StubNode).click();
  p.answer("[[ClientA]]");
  (byLabel(p.host, "Add a link") as StubNode).click();
  const select = all(p.host, "io-select")[0] as StubNode;
  select.value = "Templates/task.md";
  select.dispatch("change");

  const cfg = p.cfg();
  const pick = (line: string): string =>
    engine.selectSmartTemplate(engine.parseInlineLine(line, cfg), p.rules(), "plain");

  assert.equal(pick("- #todo [[ClientA]] || x"), "Templates/task.md", "первый тег и ссылка");
  assert.equal(pick("- #doing [[ClientA]] || x"), "Templates/task.md",
    "второй тег и та же ссылка: внутри типа ИЛИ");
  assert.equal(pick("- #todo || x"), "plain",
    "без ссылки правило не срабатывает: между типами И");

  /* И то же самое сказано словами, а не значками. */
  assert.ok(texts(p.host, "io-op").includes("or"), "подпись `or` между значениями одного типа");
  assert.ok(texts(p.host, "io-op").includes("and"), "и `and` между типами");
  const ops = all(p.host, "io-op");
  assert.ok(ops.every(n => n.tagName !== "BUTTON" && n.tagName !== "SELECT"),
    "ни одна из этих подписей не контрол (С-7)");
  ok("ИЛИ внутри типа, И между типами — и это сказано словами");
}

/* ======================================================================
 * 4. Порядок значим: правила читаются сверху вниз (С-6).
 * ====================================================================== */

{
  /*
   * Условия у правил РАЗНЫЕ, и это не украшение фикстуры.
   * `validateSmartRules` выключает оба правила, чьи условия могут совпасть на
   * одной строке, — а совпасть могут любые два, кроме тех, у которых общая
   * размерность заполнена и не пересекается (`rulesCanOverlap`). Два правила
   * на один и тот же тег до движка просто не доходят: он их обесточивает и
   * отвечает шаблоном по умолчанию. Значимость порядка видна только на
   * правилах, которые движок оставил включёнными, — то есть на разных Values,
   * встреченных в одной строке.
   *
   * До 2026-08-31 фикстура держала два правила на `#todo` и проходила: в
   * проверках `normalizeTransformConfig` подменялась заглушкой из `main.js`
   * (`getTransformFeature`), и правила не нормализовались вовсе.
   */
  const p = makePanel(baseConfig([
    { id: "rule-1", name: "First", enabled: true, targetTemplate: "Templates/task.md",
      conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [] } },
    { id: "rule-2", name: "Second", enabled: true, targetTemplate: "Templates/meeting.md",
      conditions: { tags: ["#doing"], emojiFields: [], wikilinks: [] } },
  ]));
  const cfg = p.cfg();
  const pick = (): string =>
    engine.selectSmartTemplate(engine.parseInlineLine("- #todo #doing || x", cfg), p.rules(), "plain");
  assert.equal(pick(), "Templates/task.md", "срабатывает первое подходящее");

  /* Перенос второго правила наверх меняет ответ движка. */
  p.rules();
  const model = createRulesModel({
    plugin: { getConfig: () => p.cfg(), setConfigPatch: () => {} } as never,
    validate: rules => engine.validateSmartRules(rules),
    fieldTokens: () => [],
  });
  assert.deepEqual(model.listRules().map(r => r.name), ["First", "Second"],
    "порядок читается из конфига как есть");

  const host = p.host;
  const grips = all(host, "io-grip");
  assert.equal(grips.length, 2, "у каждого правила своя ручка перетаскивания");
  const cards = all(host, "io-rule");
  (grips[1] as StubNode).dispatch("dragstart", { dataTransfer: { setData: () => {} } });
  (cards[0] as StubNode).dispatch("drop", { preventDefault: () => {} });

  assert.deepEqual(p.rules().map((r: Any) => r.name), ["Second", "First"],
    "перетаскивание переставило правила");
  assert.equal(pick(), "Templates/meeting.md", "и движок теперь отвечает вторым шаблоном");
  ok("порядок правил значим, и перетаскивание его меняет");
}

/* ======================================================================
 * 5. Имя правила переживает запись (С-3).
 *
 * До 2026-08-29 `normalizeSmartRules` пересобирала правило без имени, а
 * `normalizeTransformConfig` идёт внутри `migrateConfig` — то есть на каждом
 * патче. Имя исчезало тем же нажатием, которым его вписали.
 * ====================================================================== */

{
  const p = makePanel(baseConfig());
  (byLabel(p.host, "Add rule") as StubNode).click();
  const name = all(p.host, "io-rule__name")[0] as StubNode;
  assert.equal(name.value, "", "у нового правила имени нет");
  name.value = "Dated tasks";
  name.dispatch("change");

  assert.equal(p.rules()[0].name, "Dated tasks",
    "имя дошло до конфига через настоящий путь записи");
  assert.equal((all(p.host, "io-rule__name")[0] as StubNode).value, "Dated tasks",
    "и видно после перерисовки");
  ok("имя правила переживает настоящий путь записи");
}

/* ======================================================================
 * 6. Спор правил считает движок, а не карточка.
 * ====================================================================== */

{
  /*
   * Разбор обязан переживать конфиг. `normalizeSmartRules` идёт внутри
   * `migrateConfig`, то есть на каждом патче, и до 2026-08-31 она сохраняла
   * вердикт спора в `enabled: false`. Следующий прогон выключенные правила
   * пропускал и вердикт не пересчитывал: предупреждение исчезало, а тумблер
   * оставался снятым — человек получал выключенное правило без объяснения.
   * Проверка этого не видела, потому что `normalizeTransformConfig`
   * подменялась заглушкой из `main.js` (`getTransformFeature`); заглушки
   * больше нет, и вердикт теперь живёт только в `validation`.
   */
  const p = makePanel(baseConfig([
    { id: "rule-1", enabled: true, targetTemplate: "Templates/task.md",
      conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [] } },
    { id: "rule-2", enabled: true, targetTemplate: "Templates/meeting.md",
      conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [] } },
  ]));
  const warns = all(p.host, "io-rule__warn");
  assert.ok(warns.length, "два правила на одну строку — панель предупреждает");
  assert.ok(warns[0]?.textContent.includes("rule-2") || warns[0]?.textContent.length,
    "и текст предупреждения от движка: " + warns[0]?.textContent);
  assert.equal(all(p.host, "io-rule--clash").length, warns.length,
    "спорная карточка помечена");
  assert.deepEqual(p.rules().map((r: Any) => r.enabled), [true, true],
    "и вердикт не записан в конфиг: тумблеры человек не трогал");

  /* Спорное правило шаблон не выбирает, хотя тумблер у него включён. */
  const cfg = p.cfg();
  assert.equal(
    engine.selectSmartTemplate(engine.parseInlineLine("- #todo || x", cfg), p.rules(), "plain"),
    "plain", "спорное правило до выбора шаблона не доходит");

  /* Правило без условий движок выключает сам и говорит, почему. */
  const empty = makePanel(baseConfig([
    { id: "rule-1", enabled: true, targetTemplate: "Templates/task.md",
      conditions: { tags: [], emojiFields: [], wikilinks: [] } },
  ]));
  const note = all(empty.host, "io-rule__warn")[0];
  assert.ok(note && note.textContent.includes("no conditions"),
    "правило без условий названо словами движка: " + note?.textContent);
  ok("спор правил и правило без условий — разбор движка, а не панели");
}

/* ======================================================================
 * 7. Выключенное правило остаётся на месте и не участвует.
 * ====================================================================== */

{
  const p = makePanel(baseConfig([
    { id: "rule-1", name: "Off one", enabled: true, targetTemplate: "Templates/task.md",
      conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [] } },
  ]));
  const cfg = p.cfg();
  const pick = (): string =>
    engine.selectSmartTemplate(engine.parseInlineLine("- #todo || x", cfg), p.rules(), "plain");
  assert.equal(pick(), "Templates/task.md", "включённое правило работает");

  (byLabel(p.host, "Stop using Off one") as StubNode).click();
  assert.equal(p.rules()[0].enabled, false, "правило выключено");
  assert.equal(all(p.host, "io-rule").length, 1, "и осталось на месте, а не исчезло");
  assert.equal(all(p.host, "io-rule--off").length, 1, "карточка помечена выключенной");
  assert.equal(pick(), "plain", "движок его больше не берёт");
  ok("выключенное правило остаётся видимым и не участвует");
}

/* ======================================================================
 * 8. Значения для условий — из настоящих Fields.
 * ====================================================================== */

{
  const p = makePanel(baseConfig());
  const model = createRulesModel({
    plugin: { getConfig: () => p.cfg(), setConfigPatch: () => {} } as never,
    validate: rules => engine.validateSmartRules(rules),
    fieldTokens: () => createFieldsModel({
      plugin: { getConfig: () => p.cfg(), setConfigPatch: () => {} } as never,
      normalizePkmOrder: internals.normalizePkmOrder as never,
      pkmOrderFields: [],
      cfg: p.cfg() as never,
      deepState: deepState as never,
    }).listFieldTokens(),
  });

  /* `fieldId` у группы появился для 10.13.14: по нему имя Field в окне
     становится кнопкой. Значения при этом остались те же. */
  assert.deepEqual(model.choicesFor("tags"),
    [{ label: "Status", fieldId: "status", values: ["#todo", "#doing"] }],
    "у тега значения с Prefix и id самого Field — так их видит движок в строке");
  assert.deepEqual(model.choicesFor("wikilinks"),
    [{ label: "Project", fieldId: "project", values: ["ClientA"] }],
    "у ссылки имя без скобок: `normalizeRuleWikilink` снимает их и у правила, и у строки");
  assert.deepEqual(model.choicesFor("emojiFields"), [{ label: "Due", fieldId: "due", values: ["\u{1F4C5}"] }],
    "у элемента значение одно — его маркер");

  /* Окно выбора рисует то же самое. */
  const dlg = makeNode("div");
  renderConditionPicker(dlg as unknown as El, {
    kind: "tags",
    choices: model.choicesFor("tags"),
    pick: () => {},
  });
  assert.deepEqual(texts(dlg, "io-pickvals__name"), ["Status"], "в окне Field назван");
  assert.deepEqual(texts(dlg, "io-vchip"), ["#todo", "#doing"], "и его значения предложены");
  ok("условия выбираются из настоящих Fields, каждое в своей форме");
}

/* ======================================================================
 * 9. Выключенный модуль ничего не пишет.
 * ====================================================================== */

{
  const p = makePanel(baseConfig([
    { id: "rule-1", name: "Kept", enabled: true, targetTemplate: "Templates/task.md",
      conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [] } },
  ]), { enabled: false });
  const before = JSON.stringify(p.rules());
  (byLabel(p.host, "Add rule") as StubNode)?.click();
  (byLabel(p.host, "Remove Kept") as StubNode)?.click();
  const name = all(p.host, "io-rule__name")[0] as StubNode;
  assert.equal(name.disabled, true, "поле имени выключено");
  name.value = "changed";
  name.dispatch("change");
  assert.equal(JSON.stringify(p.rules()), before, "конфиг не изменился");
  assert.equal(p.writes.length, 0, "и ни одной записи не ушло");
  ok("выключенный модуль: блок виден, но ничего не пишет");
}

/* ======================================================================
 * 10. Вывод движка не записывается в конфиг.
 *
 * `validateSmartRules` выключает правило, которое спорит с соседом или
 * осталось без условий, — это его разбор, а не выбор человека. Пока панель
 * читала состояние оттуда же, любая правка записывала этот вывод обратно:
 * перетаскивание молча выключало спорные правила, а новое правило нельзя было
 * включить вовсе — оно рождается пустым, движок его выключал, и первое
 * условие уже ничего не меняло. Найдено проверкой 2026-08-29.
 * ====================================================================== */

{
  /* Два правила с одним условием: движок считает это спором. */
  const p = makePanel(baseConfig([
    { id: "rule-1", name: "One", enabled: true, targetTemplate: "Templates/task.md",
      conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [] } },
    { id: "rule-2", name: "Two", enabled: true, targetTemplate: "Templates/meeting.md",
      conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [] } },
  ]));
  assert.ok(all(p.host, "io-rule--clash").length, "спор виден в карточках");
  assert.equal(all(p.host, "io-rule--off").length, 0,
    "но выключенными они не показаны: человек их не выключал");

  /* Правка, которая к состоянию отношения не имеет. */
  const name = all(p.host, "io-rule__name")[0] as StubNode;
  name.value = "One renamed";
  name.dispatch("change");

  assert.deepEqual(p.rules().map((r: Any) => r.enabled), [true, true],
    "после правки оба правила в конфиге остались включёнными");
  ok("вывод движка остаётся разбором и в конфиг не попадает");
}

{
  /* Новое правило: пустое, движок ругается — но включить его можно. */
  const p = makePanel(baseConfig());
  (byLabel(p.host, "Add rule") as StubNode).click();
  assert.equal(p.rules()[0].enabled, true, "новое правило включено");
  assert.ok(all(p.host, "io-rule__warn").length, "и движок говорит, что условий нет");

  p.answer("#todo");
  (byLabel(p.host, "Add a tag") as StubNode).click();
  const select = all(p.host, "io-select")[0] as StubNode;
  select.value = "Templates/task.md";
  select.dispatch("change");

  assert.equal(p.rules()[0].enabled, true, "первое условие не потребовало включать заново");
  assert.equal(all(p.host, "io-rule__warn").length, 0, "и жалоба ушла");
  assert.equal(
    engine.selectSmartTemplate(engine.parseInlineLine("- #todo || x", p.cfg()),
      p.rules(), "plain"),
    "Templates/task.md",
    "правило сразу работает");
  ok("новое правило работает сразу, как только у него появилось условие");
}

/* ======================================================================
 * 11. Удаление правила удаляет именно его.
 *
 * Проверка добавлена мутационным прогоном: дефект «удаление удаляет не то»
 * выжил — правило нигде не удалялось при включённом модуле.
 * ====================================================================== */

{
  const p = makePanel(baseConfig([
    { id: "rule-1", name: "Keep me", enabled: true, targetTemplate: "Templates/task.md",
      conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [] } },
    { id: "rule-2", name: "Drop me", enabled: true, targetTemplate: "Templates/meeting.md",
      conditions: { tags: ["#doing"], emojiFields: [], wikilinks: [] } },
  ]));
  assert.equal(all(p.host, "io-rule").length, 2, "правила два");
  (byLabel(p.host, "Remove Drop me") as StubNode).click();

  assert.deepEqual(p.rules().map((r: Any) => r.name), ["Keep me"],
    "удалено то правило, у которого нажали крестик");
  assert.equal(all(p.host, "io-rule").length, 1, "и карточка ушла с экрана");
  assert.equal(texts(p.host, "io-rule__n")[0], "1", "оставшееся перенумеровано");
  ok("удаление правила удаляет именно его");
}

/* ======================================================================
 * 12. Имя правила переживает нормализацию движка.
 *
 * Проверка 5 гоняет запись через `migrateConfig`, но в Node ветка Transform
 * до нормализации не доходит: модуль движка грузится мостом, а вне Obsidian
 * мост отдаёт заглушку `normalizeTransformConfig: cfg => cfg`. Значит правку
 * движка надо проверять на самой функции — иначе пин молчал бы о её потере,
 * что мутационный прогон и показал.
 * ====================================================================== */

{
  const before = {
    transform: {
      inline2note: {
        smartRules: [{
          id: "rule-1",
          name: "Dated tasks",
          enabled: true,
          targetTemplate: "Templates/task.md",
          conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [] },
        }],
      },
    },
  };
  const after = (engine as Any).normalizeTransformConfig(JSON.parse(JSON.stringify(before)));
  const rule = after.transform.inline2note.smartRules[0];
  assert.equal(rule.name, "Dated tasks",
    "нормализация движка сохранила имя правила (С-3): без правки она его выбрасывала");
  assert.equal(rule.targetTemplate, "Templates/task.md", "и всё остальное на месте");
  assert.deepEqual(rule.conditions.tags, ["#todo"]);
  ok("имя правила переживает нормализацию самого движка");
}

/* ---- пустой список шаблонов объясняет себя (замечание 1.6.6.2) ---------- */

{
  /*
   * Раньше при пустом списке в правиле стояло одинокое `None`, и по нему
   * нельзя было понять, кончились ли шаблоны или папка не назначена вовсе.
   * Слова здесь те же, что у `Default template`: два разных ответа на два
   * разных случая, и оба — из одного места (`templates.ts`).
   */
  const noFolder = makePanel(baseConfig([{ id: "r1", name: "one", enabled: true, targetTemplate: "", conditions: { tags: ["#todo"] } }]), { templates: [], templatesFolder: "" });
  const labels = (p: Panel): string[] =>
    all(p.host, "io-select")
      .flatMap(sel => sel.children.map(c => String(c.textContent || "").trim()))
      .filter(Boolean);
  assert.ok(labels(noFolder).includes("Set a Templates folder first"),
    "правило молчит о том, что папка шаблонов не назначена: " + labels(noFolder).join(" | "));

  const emptyFolder = makePanel(baseConfig([{ id: "r1", name: "one", enabled: true, targetTemplate: "", conditions: { tags: ["#todo"] } }]), { templates: [], templatesFolder: "Blueprints" });
  assert.ok(labels(emptyFolder).includes("No templates in Blueprints"),
    "правило не сказало, что папка пуста: " + labels(emptyFolder).join(" | "));

  const full = makePanel(baseConfig([{ id: "r1", name: "one", enabled: true, targetTemplate: "", conditions: { tags: ["#todo"] } }]), { templates: ["Templates/task.md"] });
  assert.ok(labels(full).includes("None"),
    "с непустым списком первой строкой снова обычное None");
  ok("пустой список шаблонов в правиле объясняет, чего не хватает");
}


/* ======================================================================
 * Условие «любое значение Field» (10.13.7, замечания 1.6.6.1 и 1.4.4.1).
 *
 * Заказчик просил добавлять Field целиком, а не накликивать значения по
 * одному, и особо оговорил: значение, добавленное позже, должно ловиться тем
 * же условием. Поэтому проверка не только про запись, но и про то, что список
 * значений читается в момент срабатывания.
 * ====================================================================== */

{
  const p = makePanel(baseConfig([{ id: "r1", enabled: true, targetTemplate: "Templates/task.md" }]));
  /*
   * Своей строки у Field больше нет: он заводится нажатием на имя Field в
   * окне своей строки и встаёт **в эту же строку**, через `or` со значениями
   * (решение заказчика 2026-09-03 по B14).
   */
  assert.ok(!byLabel(p.host, "Add a field to"),
    "отдельной строки Field в карточке нет");

  p.answerField("status");
  const plus = byLabel(p.host, "Add a tag");
  assert.ok(plus, "условие заводится из строки своего типа");
  plus?.click();
  assert.deepEqual(p.rules()[0].conditions.fields, ["status"],
    "условие записалось id Field, а не токеном");
  assert.deepEqual(p.rules()[0].conditions.tags || [], [],
    "и не подменило собой условие на значение");

  /* Чип виден в строке Tag: Field типа tag стоит рядом со значениями. */
  const tagRow = all(p.host, "io-kind").find(
    box => String(box.querySelector(".io-kind__label")?.textContent || "") === "Tag");
  assert.ok(tagRow, "строка Tag нашлась");
  const chips = (tagRow?.querySelectorAll(".io-vchip") || [])
    .map(c => String(c.textContent || "").replace(/✕$/, ""));
  assert.ok(chips.some(t => t.includes("any Value")),
    "и читается словами в строке Tag: " + chips.join(" | "));

  /* Своего окна у Field нет: список для ветки `fields` больше не строится. */
  assert.deepEqual(p.model().choicesFor("fields"), [],
    "отдельного списка Fields в окне выбора нет");
  ok("Field целиком встаёт в строку своего типа, одним условием");
}

{
  /* Конфиг едет через настоящую `migrateConfig`: движок читает форму версии
     2 (`pkm.lineFormat`, `pkm.fields.*`), а фикстура написана формой версии 1. */
  const cfg = internals.migrateConfig(baseConfig([{
    id: "r1", enabled: true, targetTemplate: "Templates/status.md",
    conditions: { tags: [], emojiFields: [], wikilinks: [], fields: ["status"] },
  }]));
  const rules = engine.validateSmartRules(
    (cfg.transform.inline2note.smartRules as Any[]).map((r: Any) => ({ ...r })));
  const pick = (line: string, on: Any): string =>
    engine.selectSmartTemplate(engine.parseInlineLine(line, on), rules, "Templates/plain.md", on);

  assert.equal(pick("- #todo || work", cfg), "Templates/status.md",
    "строка со значением Field ловится условием");
  assert.equal(pick("- #other || work", cfg), "Templates/plain.md",
    "строка без значений этого Field — не ловится");

  /* Значение, добавленное после того, как правило написано (Н3). */
  const later = JSON.parse(JSON.stringify(cfg));
  later.pkm.fields.tags.fields[0].values.push({ token: "later" });
  assert.equal(pick("- #later || work", later), "Templates/status.md",
    "значение, добавленное позже, ловится тем же условием — без правки правила");
  ok("«любое значение Field» ловит и то, чего в правиле нет");
}

{
  /*
   * Соединение «любого значения Field» с остальным (решение заказчика
   * 2026-09-03 по B14): **ИЛИ внутри своего типа**, а не И рядом с ним.
   *
   * До этого условие было четвёртой группой и соединялось через И: правило
   * `Tag #other` + `Field status` не срабатывало ни на строке с `#other`, ни
   * на строке со значением `status` — нужны были оба. Проверка написана так,
   * чтобы прежнее поведение её краснило: она и есть мутация.
   */
  const cfg = internals.migrateConfig(baseConfig([{
    id: "r1", enabled: true, targetTemplate: "Templates/either.md",
    conditions: { tags: ["#other"], emojiFields: [], wikilinks: [], fields: ["status"] },
  }]));
  const rules = engine.validateSmartRules(
    (cfg.transform.inline2note.smartRules as Any[]).map((r: Any) => ({ ...r })));
  const pick = (line: string): string =>
    engine.selectSmartTemplate(engine.parseInlineLine(line, cfg), rules, "Templates/plain.md", cfg);

  assert.equal(pick("- #other || work"), "Templates/either.md",
    "хватает значения из строки Tag");
  assert.equal(pick("- #todo || work"), "Templates/either.md",
    "хватает и любого значения Field того же типа");
  assert.equal(pick("- #nothing || work"), "Templates/plain.md",
    "а без обоих правило молчит");
  ok("Field соединяется со значениями своего типа через ИЛИ");
}

{
  /*
   * Разные типы по-прежнему соединяются через И: правка не должна была
   * размыть С-7. Field типа tag и условие на ссылку — две группы.
   */
  const cfg = internals.migrateConfig(baseConfig([{
    id: "r1", enabled: true, targetTemplate: "Templates/both.md",
    conditions: { tags: [], emojiFields: [], wikilinks: ["[[test1]]"], fields: ["status"] },
  }]));
  const rules = engine.validateSmartRules(
    (cfg.transform.inline2note.smartRules as Any[]).map((r: Any) => ({ ...r })));
  const pick = (line: string): string =>
    engine.selectSmartTemplate(engine.parseInlineLine(line, cfg), rules, "Templates/plain.md", cfg);

  assert.equal(pick("- #todo [[test1]] || work"), "Templates/both.md",
    "оба типа на месте — правило срабатывает");
  assert.equal(pick("- #todo || work"), "Templates/plain.md",
    "без ссылки не срабатывает");
  assert.equal(pick("- [[test1]] || work"), "Templates/plain.md",
    "и без значения Field тоже");
  ok("между типами соединение осталось И (С-7)");
}

{
  /*
   * Field, которого в конфиге больше нет, правило не блокирует. Прежде такое
   * условие делало правило невыполнимым навсегда, а увидеть его человек не
   * мог: чипа для неизвестного типа в карточке нет.
   */
  const cfg = internals.migrateConfig(baseConfig([{
    id: "r1", enabled: true, targetTemplate: "Templates/ghost.md",
    conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [], fields: ["deleted_field"] },
  }]));
  const rules = engine.validateSmartRules(
    (cfg.transform.inline2note.smartRules as Any[]).map((r: Any) => ({ ...r })));
  const pick = (line: string): string =>
    engine.selectSmartTemplate(engine.parseInlineLine(line, cfg), rules, "Templates/plain.md", cfg);

  assert.equal(pick("- #todo || work"), "Templates/ghost.md",
    "правило решается тем, что видно в карточке");
  ok("удалённый Field в условии правило не блокирует");
}

/* ======================================================================
 * Папка новой заметки у правила (10.13.8, замечания 1.6.6.4 и 1.4.4.2).
 * ====================================================================== */

{
  const folderOf = engine.resolveRuleFolder;
  assert.equal(folderOf({ targetFolderMode: "default" }, { outputFolder: "Notes" }), "Notes",
    "Default — это New notes folder");
  assert.equal(folderOf({ targetFolderMode: "near" }, { outputFolder: "Notes" }), "",
    "Near current note — пусто, и дальше срабатывает та же ветка, что у пустого New notes folder");
  assert.equal(folderOf({ targetFolderMode: "folder", targetFolder: "/Clients/A/" }, { outputFolder: "Notes" }),
    "Clients/A", "своя папка правила побеждает общую, и путь приводится к виду vault");
  assert.equal(folderOf({ targetFolderMode: "folder", targetFolder: "  " }, { outputFolder: "Notes" }), "Notes",
    "своя папка, которую не назвали, — это Default: обещать место, которого нет, нельзя");
  assert.equal(folderOf(null, { outputFolder: "Notes" }), "Notes",
    "правило не сработало — папка общая");
  ok("папка правила выбирается по режиму, а не по имени папки");
}

{
  const p = makePanel(baseConfig([{ id: "r1", enabled: true, targetTemplate: "Templates/task.md" }]));
  const selects = all(p.host, "io-select");
  const where = selects.find(n => String(n.getAttribute("aria-label") || "").startsWith("Move to folder"));
  assert.ok(where, "строка Move to folder есть в карточке правила");
  (where as StubNode).value = "folder";
  (where as StubNode).dispatch("change");
  assert.equal(p.rules()[0].targetFolderMode, "folder", "режим записался");

  const path = all(p.host, "io-text").find(n =>
    String(n.getAttribute("aria-label") || "").startsWith("Move to folder path"));
  assert.ok(path, "и рядом появилось поле пути");
  (path as StubNode).value = "Clients/A";
  (path as StubNode).dispatch("change");
  assert.equal(p.rules()[0].targetFolder, "Clients/A", "путь записался");

  const back = all(p.host, "io-select").find(n =>
    String(n.getAttribute("aria-label") || "").startsWith("Move to folder"));
  (back as StubNode).value = "near";
  (back as StubNode).dispatch("change");
  assert.equal(p.rules()[0].targetFolderMode, "near", "режим сменился");
  assert.equal(p.rules()[0].targetFolder, "", "и путь снят: он значим только у своей папки");
  ok("Move to folder пишет режим и путь на настоящем пути записи");
}

/* ---- Field целиком заводится из окна выбора значения (B14) ------------- */

/*
 * Заказчик: «я хотел, чтобы Field добавлялся через «+» в Tag, element, link...
 * я хочу, чтобы fields были кликабельными — при клике этот field добавляется».
 *
 * Условие «любое значение Field» работает с 2026-09-01 (10.13.7); спор был о
 * том, как его завести. Теперь имя Field в окне выбора — кнопка, а строка
 * `Field` со своим `+` осталась: она показывает уже заведённое (10.13.14 Н3).
 *
 * Проверяется настоящая модель на настоящем пути записи; окно подделано, как
 * и раньше, — `Modal` принадлежит платформе.
 */
{
  const p = makePanel(baseConfig());
  (byLabel(p.host, "Add rule") as StubNode).click();

  /* Нажатие на имя Field заводит условие вида `fields`, из какой бы строки
     окно ни открыли: у «любого значения» вида нет (10.13.14 Н5). */
  p.answerField("status");
  (byLabel(p.host, "Add a tag") as StubNode).click();

  const rule = p.rules()[0];
  assert.deepEqual(rule.conditions.fields, ["status"],
    "нажатие на имя Field завело условие «любое значение»: "
    + JSON.stringify(rule.conditions));
  assert.deepEqual(rule.conditions.tags || [], [],
    "и не завело условие на значение");
  ok("B14: имя Field в окне выбора заводит условие «любое значение»");
}

{
  /* Обратная сторона: выбор значения по-прежнему заводит условие на значение,
     а не на Field. Иначе правка подменила бы одно другим. */
  const p = makePanel(baseConfig());
  (byLabel(p.host, "Add rule") as StubNode).click();
  p.answer("#todo");
  (byLabel(p.host, "Add a tag") as StubNode).click();
  const rule = p.rules()[0];
  assert.deepEqual(rule.conditions.tags, ["#todo"], "значение завелось значением");
  assert.deepEqual(rule.conditions.fields || [], [], "и Field целиком не завёлся");
  ok("выбор значения остался выбором значения");
}

{
  /*
   * Имя Field, у которого условие уже есть, в окне неактивно (10.13.14 Н4):
   * повтор ничего не меняет в правиле. Проверяется вёрстка окна — она рисуется
   * на заглушке, и другого способа посмотреть на неё нет.
   */
  const host = makeNode("div");
  renderConditionPicker(host as unknown as El, {
    kind: "tags",
    choices: [
      { label: "Status", fieldId: "status", values: ["#todo"] },
      { label: "Priority", fieldId: "priority", values: ["#high"] },
    ],
    fieldsTaken: ["status"],
    pick: () => {},
    pickField: () => {},
  });
  const names = all(host, "io-pickvals__name");
  assert.equal(names.length, 2, "имена обоих Fields нарисованы");
  assert.equal(names[0]?.disabled, true, "уже заведённый Field неактивен");
  assert.equal(names[1]?.disabled, false, "а свободный нажимается");
  ok("B14: уже заведённый Field в окне неактивен");
}

{
  /* Без обработчика имя остаётся подписью: тот же тихий отказ, что у
     подсказчика папок. */
  const host = makeNode("div");
  renderConditionPicker(host as unknown as El, {
    kind: "tags",
    choices: [{ label: "Status", fieldId: "status", values: ["#todo"] }],
    pick: () => {},
  });
  const names = all(host, "io-pickvals__name");
  assert.equal(names.length, 1, "имя нарисовано");
  /* Признак — класс кнопки, а не поле `disabled`: у заглушки узла оно есть у
     любого узла, и опираться на него значило бы проверять заглушку. */
  assert.equal(names[0]?.classList.contains("io-pickvals__name--pick"), false,
    "и это не кнопка: класса кнопки на узле нет");
  assert.equal(all(host, "io-pickvals__name--pick").length, 0,
    "кнопок-имён в окне нет вовсе");
  ok("без обработчика имя Field остаётся подписью");
}

/* ---- `Advanced settings` у правила (З-5) -------------------------------- */

{
  /*
   * Заказчик 2026-09-08: «под `move to folder` появилась новая строка
   * `Advanced settings`… по умолчанию должно стоять `default`».
   *
   * Проверяется настоящий путь записи: нажатие в карточке идёт через модель и
   * `ConfigStore`, то есть через `migrateConfig` и нормализацию движка.
   */
  const p = makePanel(baseConfig([{ id: "r1", enabled: true, targetTemplate: "Templates/task.md" }]));
  const advOf = (): StubNode => {
    const hit = all(p.host, "io-select").find(n =>
      String(n.getAttribute("aria-label") || "").startsWith("Advanced settings"));
    assert.ok(hit, "строка Advanced settings есть в карточке правила");
    return hit as StubNode;
  };

  assert.equal(advOf().value, "default", "по умолчанию стоит `default` — как в Note content");
  assert.equal(all(p.host, "io-rule__plrow").length, 0,
    "и никаких дополнительных строк при этом не показано");

  advOf().value = "custom";
  advOf().dispatch("change");
  assert.equal(p.rules()[0].placementMode, "custom", "режим ветки записался");
  const rows = all(p.host, "io-rule__plrow");
  assert.ok(rows.length >= 3, "открылись строки ветки, их " + rows.length);

  const rowOf = (prefix: string): StubNode | undefined =>
    all(p.host, "io-select").concat(all(p.host, "io-text"))
      .find(n => String(n.getAttribute("aria-label") || "").startsWith(prefix));

  const position = rowOf("Where to put the text");
  assert.ok(position, "строка `Where to put the text` есть");
  (position as StubNode).value = "custom-header";
  (position as StubNode).dispatch("change");
  assert.equal(p.rules()[0].placement.position, "custom-header", "положение записалось в ветку правила");

  const target = rowOf("Type name of header");
  assert.ok(target, "при `At custom header` появилось поле имени заголовка");
  (target as StubNode).value = "## Log";
  (target as StubNode).dispatch("change");
  assert.equal(p.rules()[0].placement.targetHeader, "## Log", "имя заголовка записалось");
  assert.ok(rowOf("If header not found"), "и строка запасного положения тоже на месте");

  /* Переключение обратно на `Default` не стирает настроенное. */
  advOf().value = "default";
  advOf().dispatch("change");
  assert.equal(p.rules()[0].placementMode, "default", "режим вернулся");
  assert.equal(p.rules()[0].placement.targetHeader, "## Log",
    "а настроенное осталось: переключение туда и обратно не стоит человеку ветки");
  assert.equal(all(p.host, "io-rule__plrow").length, 0, "строки при этом снова скрыты");
  ok("Advanced settings у правила пишет свою ветку на настоящем пути записи");
}

{
  /* Модуль выключен — строка видна и ничего не меняет (тот же приём, что у
     остальных контролов карточки). */
  const p = makePanel(baseConfig([{ id: "r1", enabled: true }]), { enabled: false });
  const adv = all(p.host, "io-select").find(n =>
    String(n.getAttribute("aria-label") || "").startsWith("Advanced settings"));
  assert.ok(adv, "строка на месте и при выключенном модуле");
  assert.equal((adv as StubNode).disabled, true, "но она не нажимается");
  ok("при выключенном модуле Advanced settings ничего не меняет");
}

/* ---- свёрнутая карточка правила (З-6) ----------------------------------- */

{
  /*
   * Заказчик 2026-09-08: «rules достаточно объёмные… хочу, чтобы была
   * возможность сворачивать их, чтобы в свёрнутом состоянии они занимали мало
   * места (1-2 строки с ключевой информацией… и управлением (stop using,
   * remove)). После создания и настройки smart rule оно должно по умолчанию
   * быть в свёрнутом состоянии».
   *
   * Состояние вида приходит блоку снаружи и в конфиг не пишется (О0): здесь
   * это тот же набор, который держит у себя `smart_rules.ts`.
   */
  const expanded = new Set<string>();
  const p = makePanel(baseConfig([{
    id: "r1",
    enabled: true,
    name: "Tasks",
    targetTemplate: "Templates/task.md",
    targetFolderMode: "folder",
    targetFolder: "Clients/A",
    conditions: { tags: ["#todo"] },
  }]), { expanded });

  /* Свёрнуто по умолчанию: набор пуст. */
  assert.equal(all(p.host, "io-rule--folded").length, 1, "карточка свёрнута");
  assert.equal(all(p.host, "io-rule__conds").length, 0, "условий в свёрнутом виде не рисуется");
  assert.equal(all(p.host, "io-rule__out").length, 0, "и строк шаблона с папкой тоже");

  /* Ключевая информация — одной строкой, и вся, что он назвал. */
  const summary = all(p.host, "io-rule__sumpart").map(n => n.textContent);
  assert.deepEqual(summary, ["#todo", "Templates/task.md", "Clients/A"],
    "в сводке условия, шаблон и папка");
  const nameInput = all(p.host, "io-rule__name")[0];
  assert.equal(nameInput?.value, "Tasks", "имя правила видно в шапке");

  /* Управление на месте: остановить и удалить. */
  assert.ok(byLabel(p.host, "Stop using"), "`stop using` есть у свёрнутой карточки");
  assert.ok(byLabel(p.host, "Remove"), "и `remove` тоже");

  /* Нажатие разворачивает. */
  const openBtn = byLabel(p.host, "Expand");
  assert.ok(openBtn, "у свёрнутой карточки есть кнопка развернуть");
  (openBtn as StubNode).dispatch("click");
  assert.equal(all(p.host, "io-rule--folded").length, 0, "карточка развернулась");
  assert.ok(all(p.host, "io-rule__conds").length > 0, "и условия вернулись");
  assert.equal(expanded.has("r1"), true, "состояние вида запомнилось в наборе блока");
  assert.equal(p.rules()[0].collapsed, undefined,
    "и в конфиг оно не поехало: вид панели не настройка человека");

  /* И сворачивает обратно. */
  const closeBtn = byLabel(p.host, "Collapse");
  assert.ok(closeBtn, "а у развёрнутой — свернуть");
  (closeBtn as StubNode).dispatch("click");
  assert.equal(all(p.host, "io-rule--folded").length, 1, "карточка свернулась обратно");
  assert.equal(expanded.has("r1"), false, "и набор это запомнил");
  ok("З-6: карточка правила сворачивается, и вид в конфиг не пишется");
}

{
  /* Условий нет вовсе — сводка говорит это словами, а не пустым местом. */
  const p = makePanel(baseConfig([{ id: "r1", enabled: true }]), { expanded: new Set<string>() });
  const summary = all(p.host, "io-rule__sumpart").map(n => n.textContent);
  assert.equal(summary[0], "any line", "правило без условий смотрит на любую строку");
  assert.equal(summary[2], "Default", "папка по умолчанию названа словом");
  ok("сводка свёрнутого правила объясняет пустоту, а не молчит");
}

{
  /* Новое правило рождается развёрнутым: его надо настроить. */
  const expanded = new Set<string>();
  const p = makePanel(baseConfig([]), { expanded });
  const add = byLabel(p.host, "Add rule");
  assert.ok(add, "кнопка добавления есть");
  (add as StubNode).dispatch("click");
  assert.equal(p.rules().length, 1, "правило заведено");
  assert.equal(expanded.has(String(p.rules()[0].id)), true, "и оно развёрнуто");
  assert.equal(all(p.host, "io-rule--folded").length, 0, "на экране тоже");
  ok("новое правило рождается развёрнутым");
}

{
  /* Свернуть можно и при выключенном модуле: это про вид, а не про правило. */
  const expanded = new Set<string>(["r1"]);
  const p = makePanel(baseConfig([{ id: "r1", enabled: true }]), { enabled: false, expanded });
  const closeBtn = byLabel(p.host, "Collapse");
  assert.ok(closeBtn, "кнопка есть");
  assert.equal((closeBtn as StubNode).disabled, false, "и она живая");
  (closeBtn as StubNode).dispatch("click");
  assert.equal(all(p.host, "io-rule--folded").length, 1, "карточка свернулась");
  assert.deepEqual(p.writes, [], "и в конфиг при этом ничего не записано");
  ok("сворачивание работает и при выключенном модуле, ничего не записывая");
}

console.log("\n" + passed + " проверок пройдено");
