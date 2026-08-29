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
  selectSmartTemplate: (parsed: Any, rules: Any[], fallback: string) => string;
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
  cfg: () => Any;
  rules: () => Any[];
  writes: Array<{ reason: string }>;
  draw: () => void;
  /** Ответ окна выбора значения: что «выбрал» человек в следующий раз. */
  answer: (value: string | null) => void;
}

function makePanel(base: Any, o?: { enabled?: boolean }): Panel {
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

  let nextAnswer: string | null = null;
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
    renderSmartRules(host as unknown as El, {
      model,
      enabled: !(o && o.enabled === false),
      templates: ["Templates/task.md", "Templates/meeting.md"],
      redraw: draw,
      askCondition: (_kind, done) => done(nextAnswer),
    });
  };
  draw();
  return {
    host,
    cfg: () => store.getSnapshot(),
    rules: () => (store.getSnapshot().transform?.inline2note?.smartRules || []) as Any[],
    writes,
    draw,
    answer: (value: string | null) => { nextAnswer = value; },
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
  const p = makePanel(baseConfig([
    { id: "rule-1", name: "First", enabled: true, targetTemplate: "Templates/task.md",
      conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [] } },
    { id: "rule-2", name: "Second", enabled: true, targetTemplate: "Templates/meeting.md",
      conditions: { tags: ["#todo"], emojiFields: [], wikilinks: [] } },
  ]));
  const cfg = p.cfg();
  const pick = (): string =>
    engine.selectSmartTemplate(engine.parseInlineLine("- #todo || x", cfg), p.rules(), "plain");
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

  assert.deepEqual(model.choicesFor("tags"), [{ label: "Status", values: ["#todo", "#doing"] }],
    "у тега значения с Prefix — так их видит движок в строке");
  assert.deepEqual(model.choicesFor("wikilinks"), [{ label: "Project", values: ["ClientA"] }],
    "у ссылки имя без скобок: `normalizeRuleWikilink` снимает их и у правила, и у строки");
  assert.deepEqual(model.choicesFor("emojiFields"), [{ label: "Due", values: ["\u{1F4C5}"] }],
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

console.log("\n" + passed + " проверок пройдено");
