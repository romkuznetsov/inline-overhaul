/**
 * Раздел `YAML property` редактора Fields (PRD 10.9, фаза 3c).
 *
 * Решение заказчика 2026-08-28: настройки свойства заметки живут у Field, а не
 * своим блоком на вкладке Transform. Здесь проверяются все четыре строки
 * раздела — имя свойства, тип, правило значения и то, что будет записано.
 *
 * Что настоящее. Путь записи — плагиновый: `ConfigStore` из `src/core`,
 * `deepMerge` и `cloneJson` из `shared_utils.js`, `migrateConfig` и
 * `normalizePkmOrder` из `main.js` (`tests/harness/plugin_internals.ts`).
 * Пример считает движок — те же `parseInlineLine`, `buildTransformContext`,
 * `buildYamlMapFromContext` и `renderYamlBlockWithOrder`, которыми пишет
 * команда `Inline to note`.
 *
 * Подделаны два места, и обойтись без этого нечем:
 *   • DOM — редактор рисуется в Obsidian (`tests/harness/dom_stub.ts`);
 *   • `app.metadataTypeManager` — приватное API Obsidian, вне Obsidian его
 *     нет вовсе, а Я4 требует проверить и его наличие, и его отказ.
 *
 * Главная проверка — не список путей, а сверка с движком: ожидание считается
 * из строки, написанной здесь руками, а не из кода панели. Если панель сложит
 * токен иначе или посчитает значение сама, сверка разойдётся.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, focusedNode, clearFocus, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals, Setting, Notice, Modal } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { createFieldsModel } from "../../src/ui/settings/custom/fields_model.ts";
import { renderFieldsEditor, type FieldsViewState } from "../../src/ui/settings/custom/fields_editor_view.ts";
import { vaultProperties } from "../../src/ui/settings/custom/yaml_property.ts";
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
/** Движок YAML: тот самый модуль, что зовёт панель и что грузит плагин. */
const engine = requireCjs(path.join(root, "src", "features", "transform_feature.js")) as {
  parseInlineLine: (line: string, cfg: Any) => Any;
  buildTransformContext: (parsed: Any, cfg: Any) => Any;
  buildYamlMapFromContext: (ctx: Any, cfg: Any) => Any;
  renderYamlBlockWithOrder: (lines: string[], patch: Any, cfg: Any) => string[];
};
const internals = loadPluginInternals();
const deepState = (deepStateModule as { default?: unknown }).default || deepStateModule;

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/* ---- обход дерева ------------------------------------------------------ */

function all(node: StubNode, cls: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (n.classList.contains(cls)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

/** Строка настройки по её видимому имени. */
function row(host: StubNode, name: string): StubNode {
  for (const item of all(host, "io-item")) {
    const label = all(item, "io-item__name")[0];
    if (label && label.textContent === name) return item;
  }
  throw new Error("не нашлась строка настройки: " + name
    + "; есть " + all(host, "io-item__name").map(n => n.textContent).join(", "));
}

const control = (host: StubNode, name: string): StubNode =>
  all(row(host, name), "io-item__control")[0] as StubNode;

const selectIn = (host: StubNode, name: string): StubNode =>
  all(row(host, name), "io-select")[0] as StubNode;

/* Имена строк заданы заказчиком 2026-08-28 (замечание 3). */
const RULE_ROW = "How to show Value in YAML";
const PREVIEW_ROW = "Preview";

/**
 * Превью стоит справа, в колонке контролов, и той же ширины, что поле свойства
 * над ним (замечание заказчика 2026-08-28). Это не контрол, а вывод в рамке,
 * поэтому читается по своему классу, а не как значение контрола.
 */
const writtenAs = (host: StubNode): string =>
  (all(control(host, PREVIEW_ROW), "io-yamlex__line")[0] as StubNode).textContent;

/* ---- подделка №2: класс подсказки ввода -------------------------------- */

/**
 * Стойка вместо `AbstractInputSuggest`.
 *
 * Настоящий класс живёт в модуле `obsidian`, а его в Node нет вовсе — пакет
 * содержит одни типы. Поэтому подделка, и она названа: повторяет ровно тот
 * договор, который объявлен в `obsidian.d.ts` — конструктор `(app, input)`,
 * `setValue`, `close`, `limit`, а `getSuggestions`, `renderSuggestion` и
 * `selectSuggestion` даёт наследник. Экземпляры собираются в `suggests`, чтобы
 * проверка могла позвать их так, как их зовёт платформа.
 */
interface SuggestLike {
  app: unknown;
  input: Any;
  limit: number;
  setValue(value: string): void;
  close(): void;
  onSelect(cb: (value: Any, ev: unknown) => unknown): unknown;
  getSuggestions?(query: string): Any[];
  renderSuggestion?(value: Any, node: Any): void;
  selectSuggestion?(value: Any, ev?: unknown): void;
}

const suggests: SuggestLike[] = [];

class SuggestStub implements SuggestLike {
  app: unknown;
  input: Any;
  limit = 100;
  closed = false;

  constructor(app: unknown, input: Any) {
    this.app = app;
    this.input = input;
    suggests.push(this as unknown as SuggestLike);
  }

  setValue(value: string): void { this.input.value = value; }
  close(): void { this.closed = true; }
  onSelect(): unknown { return this; }
}

/* ---- редактор на настоящем пути записи -------------------------------- */

interface Panel {
  host: StubNode;
  cfg: () => Any;
  writes: Array<{ patch: Any; reason: string }>;
  draw: () => void;
  cleanup: () => void;
}

function makePanel(base: Any, selected: string, o?: {
  properties?: Any;
  enabled?: boolean;
  showTips?: boolean;
  /** false — платформа класса подсказки не даёт, как старый Obsidian. */
  suggest?: boolean;
  /** Плагин бросает из `setConfigPatch` после записи: см. проверку 14. */
  throwAfterPatch?: boolean;
}): Panel {
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
  const writes: Array<{ patch: Any; reason: string }> = [];
  const plugin: Any = {
    /* Приватное API Obsidian: `undefined` — это отказ, и Я4 требует, чтобы
       раздел его пережил. */
    app: o && o.properties !== undefined ? { metadataTypeManager: o.properties } : {},
    getConfig: () => store.getSnapshot(),
    setConfigPatch: (patch: Any, reason: string) => {
      writes.push({ patch, reason: reason || "settings" });
      store.patch(patch, reason || "settings");
      /*
       * Настоящий `setConfigPatch` после записи делает многое: лог dev-режима,
       * пересборку правил, перерисовку TagWheel. Исключение оттуда — не
       * выдумка, а причина замечания заказчика 2026-08-28.
       */
      if (o && o.throwAfterPatch) throw new Error("plugin exploded after the patch");
    },
  };
  const ctx: Any = {
    get: () => 100,
    set: async () => {},
    run: async () => {},
    watch: () => () => {},
    platform: {
      Setting,
      Notice,
      Modal,
      ...(o && o.suggest === false ? {} : { AbstractInputSuggest: SuggestStub }),
      setIcon: () => {},
      plugin,
      getConfig: () => store.getSnapshot(),
      normalizePkmOrder: internals.normalizePkmOrder,
      pkmOrderFields: [] as string[],
    },
  };
  const state: FieldsViewState = { selected };
  let close: (() => void) | null = null;
  const draw = (): void => {
    if (close) close();
    host.empty();
    close = renderFieldsEditor(host as unknown as El, {
      model: createFieldsModel({
        plugin: plugin as never,
        normalizePkmOrder: internals.normalizePkmOrder as never,
        pkmOrderFields: [],
        cfg: plugin.getConfig() as never,
        deepState: deepState as never,
      }),
      ctx,
      state,
      enabled: !(o && o.enabled === false),
      showTips: !(o && o.showTips === false),
      redraw: draw,
      notice: () => {},
      askNewField: done => done(null),
      confirmDeleteField: (_name, done) => done(false),
    });
  };
  draw();
  return {
    host,
    cfg: () => store.getSnapshot(),
    writes,
    draw,
    cleanup: () => { if (close) close(); },
  };
}

/**
 * Конфиг с тремя Fields: тег, ссылка и элемент, у каждого своё свойство.
 * Значения по два, чтобы было видно, что в пример идёт первое.
 */
function baseConfig(): Any {
  return JSON.parse(JSON.stringify({
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
          propertiesByField: { status: "status", project: "project", due: "due" },
        },
        leftMode: {
          fields: [
            { id: "status", prefix: "#", values: [{ token: "todo", active: true }, { token: "doing", active: true }] },
          ],
        },
        rightMode: {
          fields: [
            {
              id: "project",
              source: "wikilinks:project",
              values: [{ token: "ClientA", active: true }, { token: "ProjectX", active: true }],
            },
          ],
        },
        elements: {
          fields: ["due"],
          byField: { due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD" } },
        },
      },
    },
  }));
}

const defOf = (cfg: Any, side: "leftMode" | "rightMode", id: string): Any =>
  (cfg.pkm.behavior[side].fields as Any[]).find((f: Any) => String(f && f.id || "") === id) || null;

/**
 * Что запишет движок в заметку по этой строке. Строка приходит аргументом и
 * пишется в проверке руками: иначе ожидание считалось бы тем же кодом, что
 * проверяется, и сверка ничего бы не значила.
 */
function engineYaml(line: string, cfg: Any): string[] {
  const ctx = engine.buildTransformContext(engine.parseInlineLine(line, cfg), cfg);
  return engine.renderYamlBlockWithOrder([], engine.buildYamlMapFromContext(ctx, cfg), cfg);
}

/**
 * Строка выдуманного примера: маркер элемента вплотную к значению — так его
 * пишет рантайм (`${marker}${value}` в `status_date.js`), а форма даты
 * подставлена маской, как её показывает прототип.
 */
const LINE = "- #todo [[ClientA]] \u{1F4C5}YYYY-MM-DD";

/* ======================================================================
 * 1. Четыре строки раздела, и все на месте.
 * ====================================================================== */

{
  const p = makePanel(baseConfig(), "status");
  const names = all(p.host, "io-item__name").map(n => n.textContent);
  for (const want of ["Property", "Property type", RULE_ROW, PREVIEW_ROW]) {
    assert.ok(names.includes(want), "нет строки " + want + "; есть: " + names.join(", "));
  }
  assert.equal((all(control(p.host, "Property"), "io-text")[0] as StubNode).value, "status",
    "имя свойства прочитано из Order");
  assert.equal(selectIn(p.host, "Property type").value, "auto");
  /*
   * Текст описания задан заказчиком 2026-08-28, как и место превью: рамка
   * стоит в колонке контролов, а не под строкой.
   */
  assert.equal(
    (all(row(p.host, PREVIEW_ROW), "io-item__desc")[0] as StubNode).textContent,
    "How this Value will look like in YAML",
    "описание строки превью — то, которое назвал заказчик");
  assert.equal(all(control(p.host, PREVIEW_ROW), "io-yamlex").length, 1,
    "рамка превью стоит в колонке контролов, справа от опции");
  assert.equal(selectIn(p.host, RULE_ROW).value, "raw",
    "правила у Field нет — показано то, что возьмёт движок");
  ok("раздел YAML property: четыре строки и их текущие значения");
  p.cleanup();
}

/* ======================================================================
 * 2. `Written as` — то, что запишет движок, а не то, что посчитала панель.
 * ====================================================================== */

{
  const expected = engineYaml(LINE, makePanel(baseConfig(), "status").cfg());
  assert.deepEqual(expected, [
    'status: "#todo"',
    'project: "[[ClientA]]"',
    'due: "\u{1F4C5}YYYY-MM-DD"',
  ], "движок пишет значения в кавычках, а элемент — с маркером");

  for (const [key, line] of [["status", expected[0]], ["project", expected[1]], ["due", expected[2]]] as const) {
    const p = makePanel(baseConfig(), key);
    assert.equal(writtenAs(p.host), line, "строка примера у Field " + key);
    p.cleanup();
  }
  ok("Written as совпадает с тем, что запишет движок (Я1, Я2)");
}

/* ======================================================================
 * 3. Тип свойства: пишется в Field и переживает настоящий путь записи.
 * ====================================================================== */

{
  const p = makePanel(baseConfig(), "status");
  const holds = selectIn(p.host, "Property type");
  holds.value = "list";
  holds.dispatch("change");

  const cfg = p.cfg();
  assert.equal(String(defOf(cfg, "leftMode", "status").yamlCardinality), "list",
    "тип свойства лёг в определение Field — оттуда его и читает движок");
  /*
   * Ловушка, которую эта строка держит: в `pkm.behavior.order` записать тип
   * нельзя. `normalizePkmOrder` собирает Order из своих десяти ключей, а
   * `migrateConfig` идёт на каждом патче — значение исчезло бы тем же
   * нажатием, и контрол выглядел бы работающим (З8).
   */
  assert.equal(cfg.pkm.behavior.order.yamlCardinalityByField, undefined,
    "в Order тип свойства не пишется: его там стирает normalizePkmOrder");
  assert.ok(p.writes.some(w => w.reason === "pkm:behavior:yaml:cardinality:status"),
    "запись прошла своей причиной: " + p.writes.map(w => w.reason).join(", "));
  /*
   * После перерисовки список показывает то, что записано, а не умолчание.
   * Проверка добавлена мутационным прогоном: дефект «тип свойства всегда
   * Auto» выжил, потому что начальное значение и умолчание совпадали.
   */
  assert.equal(selectIn(p.host, "Property type").value, "list",
    "выбранный тип виден после перерисовки");
  assert.equal(writtenAs(p.host), 'status: ["#todo"]',
    "пример пересчитался движком и стал списком");
  assert.deepEqual(engineYaml(LINE, cfg)[0], 'status: ["#todo"]', "и это ровно его ответ");
  ok("тип свойства: запись в Field, список в примере, ничего в Order");
  p.cleanup();
}

/* ======================================================================
 * 4. Правило значения: Field целиком, и движок его читает (Я3, Я7).
 * ====================================================================== */

{
  const p = makePanel(baseConfig(), "status");
  const rule = selectIn(p.host, RULE_ROW);
  rule.value = "clean";
  rule.dispatch("change");

  const cfg = p.cfg();
  assert.equal(String(defOf(cfg, "leftMode", "status").yamlValueRule), "clean",
    "правило лёг в определение Field");
  assert.ok(p.writes.some(w => w.reason === "pkm:behavior:yaml:value-rule:status"),
    "запись прошла своей причиной");
  assert.equal(writtenAs(p.host), 'status: "todo"', "у тега снялась решётка");
  const lines = engineYaml(LINE, cfg);
  assert.ok(lines.includes('project: "[[ClientA]]"'),
    "а у соседнего Field правило своё и осталось прежним: " + lines.join(" | "));
  ok("правило значения: у Field, применяется ко всем его значениям, соседей не трогает");
  p.cleanup();
}

/* ======================================================================
 * 5. Элемент: под Raw маркер остаётся, под Clean снимается.
 *
 * До правки 2026-08-28 движок срезал маркер в обоих режимах, и выбор
 * Raw/Clean на элемент не влиял вовсе. Решение заказчика — привести движок к
 * Я3, и это единственное место, где оно проверяется.
 * ====================================================================== */

{
  const p = makePanel(baseConfig(), "due");
  assert.equal(writtenAs(p.host), 'due: "\u{1F4C5}YYYY-MM-DD"', "под Raw маркер на месте");
  const rule = selectIn(p.host, RULE_ROW);
  rule.value = "clean";
  rule.dispatch("change");
  assert.equal(writtenAs(p.host), 'due: "YYYY-MM-DD"', "Clean снял маркер элемента");
  ok("элемент: Raw держит маркер, Clean его снимает (правка движка по Я3)");
  p.cleanup();
}

/* ======================================================================
 * 6. Правило доходит до дочерних значений через `dependsOn`.
 *
 * Дочерний Field — отдельная запись `<name>_sub`, своей строки в списке
 * Fields у неё нет (решение заказчика 2026-08-28, вопрос В7). Без
 * наследования правило Field не дошло бы до дочерних значений, и одно и то же
 * свойство писалось бы двумя разными формами.
 * ====================================================================== */

{
  const base = baseConfig();
  base.pkm.behavior.order.active.status_sub = "yes";
  base.pkm.behavior.order.enabled.status_sub = true;
  base.pkm.behavior.leftMode.fields.push({
    id: "status_sub",
    prefix: "#",
    dependsOn: "status",
    enabled: true,
    placeholder: "sub",
    values: [{ token: "#review", active: true, allowedParentValues: ["#todo"] }],
  });
  /*
   * Строка несёт и значение родителя: `buildTransformContext` выбрасывает
   * совпадение дочернего Field, если родитель в строке не нашёлся, — и без
   * `#todo` проверять было бы нечего.
   */
  const SUB_LINE = "- #todo #review";

  /* Контрольный случай: правила нет — оба значения пишутся как есть. */
  const before = makePanel(base, "status");
  const plain = engineYaml(SUB_LINE, before.cfg());
  assert.equal(plain.length, 1, "оба значения ушли в одно свойство: " + plain.join(" | "));
  assert.ok(plain[0]?.includes("#todo") && plain[0]?.includes("#review"),
    "правила нет — решётки на месте: " + plain.join(" | "));
  before.cleanup();

  const p = makePanel(base, "status");
  const rule = selectIn(p.host, RULE_ROW);
  rule.value = "clean";
  rule.dispatch("change");

  const cfg = p.cfg();
  assert.ok(defOf(cfg, "leftMode", "status_sub"), "дочерний Field на месте");
  assert.equal(defOf(cfg, "leftMode", "status_sub").yamlValueRule, undefined,
    "своего правила у дочернего Field нет — оно берётся у родителя");
  const lines = engineYaml(SUB_LINE, cfg);
  assert.equal(lines.length, 1, "свойство одно: " + lines.join(" | "));
  assert.ok(lines[0]?.includes('"todo"') && !lines[0]?.includes("#todo"),
    "у родителя правило сработало: " + lines.join(" | "));
  assert.ok(lines[0]?.includes('"review"') && !lines[0]?.includes("#review"),
    "и дошло до дочернего значения: " + lines.join(" | "));
  ok("правило Field наследуется дочерним Field по dependsOn");
  p.cleanup();
}

/* ======================================================================
 * 7. Auto: одно свойство на два Fields — список.
 * ====================================================================== */

{
  const base = baseConfig();
  base.pkm.behavior.order.propertiesByField.project = "status";
  const p = makePanel(base, "status");
  const line = writtenAs(p.host);
  assert.ok(line.startsWith("status: [") && line.includes("#todo") && line.includes("[[ClientA]]"),
    "свойство делят два Fields — в строке оба значения: " + line);
  assert.deepEqual(engineYaml(LINE, p.cfg())[0], line, "и это ответ движка целиком");
  p.cleanup();

  /*
   * Второй Field показывает ту же строку: он пишет в то же свойство, и это
   * единственное место в панели, где видно, что они его делят.
   */
  const other = makePanel(base, "project");
  assert.equal(writtenAs(other.host), line, "у соседа по свойству строка та же");
  other.cleanup();
  ok("Auto делает список, когда свойство собирает два Fields, и это видно у обоих");
}

/* ======================================================================
 * 8. Свойства нет — Field не копируется.
 * ====================================================================== */

{
  const base = baseConfig();
  delete base.pkm.behavior.order.propertiesByField.project;
  const p = makePanel(base, "project");
  assert.equal(writtenAs(p.host), "not written", "у Field без свойства примера нет");
  assert.ok(!engineYaml(LINE, p.cfg()).some(l => l.startsWith("project:")),
    "и движок его не пишет");
  ok("Field без свойства в заметку не попадает");
  p.cleanup();
}

/* ======================================================================
 * 9. Имя свойства пишется через модель, тем же путём, что и раньше.
 * ====================================================================== */

{
  const p = makePanel(baseConfig(), "status");
  const input = all(control(p.host, "Property"), "io-text")[0] as StubNode;
  input.value = "state";
  input.dispatch("change");

  const cfg = p.cfg();
  assert.equal(cfg.pkm.behavior.order.propertiesByField.status, "state",
    "имя свойства ушло в Order");
  const reasons = p.writes.map(w => w.reason);
  assert.ok(reasons.includes("pkm:behavior:order:yaml:status"),
    "той же причиной, что и до переноса: " + reasons.join(", "));
  assert.ok(reasons.includes("pkm:behavior:order:yaml-propagate:status"),
    "и второй записью значение разошлось по Values, которые его унаследовали");
  assert.equal(writtenAs(p.host), 'state: "#todo"', "пример пересчитался");
  ok("имя свойства идёт через setProperty модели, а не собирает патч заново");
  p.cleanup();
}

/* ======================================================================
 * 10. Я4: `app.metadataTypeManager` может не ответить.
 * ====================================================================== */

{
  /* Отказ первый: API нет вовсе. */
  const none = makePanel(baseConfig(), "status");
  const input = all(control(none.host, "Property"), "io-text")[0] as StubNode;
  input.dispatch("focus");
  assert.equal(all(none.host, "io-pick2__opt").length, 0, "подсказывать нечего");
  assert.equal(all(none.host, "io-pick2__type").length, 0, "и тип не показывается");
  assert.equal(writtenAs(none.host), 'status: "#todo"', "а раздел работает");
  none.cleanup();

  /*
   * Отказ второй: API есть, но бросает. Сообщение в консоль тут ожидаемое —
   * приватное API имеет право пропасть, и панель обязана сказать об этом
   * разработчику, а не человеку (З8). В выводе проверки оно только мешает.
   */
  const realError = console.error;
  console.error = () => {};
  let broken: Panel;
  try {
    broken = makePanel(baseConfig(), "status", {
      properties: { getAllProperties: () => { throw new Error("private API gone"); } },
    });
  } finally {
    console.error = realError;
  }
  assert.equal(writtenAs(broken.host), 'status: "#todo"', "раздел пережил исключение");
  broken.cleanup();

  /* Отказ третий: API есть, но отдаёт не то. */
  assert.deepEqual(vaultProperties({ metadataTypeManager: { getAllProperties: () => 42 } }), []);
  assert.deepEqual(vaultProperties(null), []);
  assert.deepEqual(vaultProperties({}), []);

  /* И рабочий случай: имена с типами, как их отдаёт Obsidian. */
  const livePanel = makePanel(baseConfig(), "status", {
    properties: {
      getAllProperties: () => ({
        status: { name: "status", type: "text" },
        tags: { name: "tags", type: "list" },
        due: { name: "due", type: "date" },
      }),
    },
  });
  /*
   * Подсказку рисует платформа, поэтому проверяется договор с ней: что ей
   * отдали поле, что она фильтрует по набранному, что рисует имя и тип и что
   * выбор пишет в конфиг.
   */
  const live = suggests[suggests.length - 1] as SuggestLike;
  assert.ok(live, "подсказка подключена к полю");
  assert.equal(live.input.getAttribute("aria-label"), "YAML property for status",
    "и именно к полю имени свойства");

  const hits = (live.getSuggestions as (q: string) => Any[])("st");
  assert.deepEqual(hits.map((p: Any) => p.name), ["status"],
    "подсказка отфильтрована по набранному");
  assert.equal((live.getSuggestions as (q: string) => Any[])("").length, 3,
    "пустое поле — весь список свойств vault");

  const node = makeNode("div");
  (live.renderSuggestion as (p: Any, n: Any) => void)(hits[0], node);
  assert.equal(node.textContent, "statustext", "строка подсказки: имя и тип из vault");
  assert.equal(all(node, "io-suggest__type").length, 1, "тип — своей подписью");

  /*
   * Выбор — это запись, а не только подстановка в поле. Выбирается имя,
   * которого в конфиге НЕТ: с `status` проверка была пустой — оно там и так
   * стояло, и мутация «выбор ничего не пишет» её переживала.
   */
  const other = (live.getSuggestions as (q: string) => Any[])("tag");
  assert.deepEqual(other.map((x: Any) => x.name), ["tags"], "в vault есть и другое имя");
  (live.selectSuggestion as (p: Any) => void)(other[0]);
  assert.equal(livePanel.cfg().pkm.behavior.order.propertiesByField.status, "tags",
    "выбор из подсказки записан в конфиг");
  assert.equal(live.input.value, "tags", "и подставлен в поле");
  livePanel.cleanup();

  /* Класса нет — поле остаётся рабочим полем ввода, просто без подсказок. */
  const before = suggests.length;
  const old = makePanel(baseConfig(), "status", { suggest: false, properties: {} });
  assert.equal(suggests.length, before, "без класса подсказка не заводится");
  const plainInput = all(control(old.host, "Property"), "io-text")[0] as StubNode;
  plainInput.value = "kept";
  plainInput.dispatch("change");
  assert.equal(old.cfg().pkm.behavior.order.propertiesByField.status, "kept",
    "и поле по-прежнему пишет");
  old.cleanup();
  ok("Я4: подсказку рисует платформа, и без неё поле работает");
}

/* ======================================================================
 * 11. Одна подсказка на узел, и подсказки раздела раскрываются.
 * ====================================================================== */

{
  const p = makePanel(baseConfig(), "status");
  const bad: string[] = [];
  const walk = (n: StubNode): void => {
    const aria = n.getAttribute("aria-label");
    const title = n.title || n.getAttribute("title");
    if (aria && title && aria !== title) bad.push(n.tagName + ": " + aria + " / " + title);
    n.children.forEach(walk);
  };
  walk(p.host);
  assert.deepEqual(bad, [], "две разные подсказки на одном узле");

  /*
   * У строки `Property` своей «?» нет и быть не должно: подсказка раздела
   * стоит прямо над ней, и два знака оказались бы рядом (замечание заказчика
   * 2026-08-27, третий круг). Всё про имя свойства сказано в подсказке
   * заголовка — её и открываем вместе с остальными.
   */
  assert.equal(all(row(p.host, "Property"), "io-help").length, 0,
    "у строки Property своей «?" + "» быть не должно");
  for (const name of ["Property type", RULE_ROW, PREVIEW_ROW]) {
    const help = all(row(p.host, name), "io-help")[0];
    assert.ok(help, "у строки " + name + " нет «?»");
    (help as StubNode).click();
  }
  const head = all(p.host, "io-sub").find(n => n.textContent.startsWith("YAML property")) as StubNode;
  assert.ok(head, "заголовок раздела на месте");
  (all(head, "io-help")[0] as StubNode).click();
  assert.equal(all(p.host, "io-tip--below").length, 4,
    "раскрылись три подсказки строк и подсказка заголовка");
  p.cleanup();

  /* С выключенными подсказками «?» нет вовсе, и раздел всё равно рисуется. */
  const quiet = makePanel(baseConfig(), "status", { showTips: false });
  assert.equal(all(row(quiet.host, RULE_ROW), "io-help").length, 0);
  assert.equal(writtenAs(quiet.host), 'status: "#todo"');
  quiet.cleanup();
  ok("одна подсказка на узел, и все четыре раскрываются");
}

/* ======================================================================
 * 12. Перерисовка возвращает скролл и фокус (A8).
 * ====================================================================== */

{
  const p = makePanel(baseConfig(), "status");
  ok("перерисовка раздела идёт через redraw редактора — её возврат скролла "
    + "закреплён в fields_editor_keepview_tests.ts");
  /* Здесь проверяется только то, что перерисовка не теряет выбранный Field. */
  const rule = selectIn(p.host, RULE_ROW);
  rule.focus();
  rule.value = "clean";
  rule.dispatch("change");
  assert.equal(selectIn(p.host, RULE_ROW).value, "clean",
    "после перерисовки виден тот же Field и его новое правило");
  clearFocus();
  assert.equal(focusedNode(), null);
  p.cleanup();
}

/* ======================================================================
 * 13. Выключенный модуль ничего не пишет.
 * ====================================================================== */

{
  const off = makePanel(baseConfig(), "status", { enabled: false });
  const holds = selectIn(off.host, "Property type");
  assert.equal(holds.disabled, true, "контрол выключен");
  holds.value = "list";
  holds.dispatch("change");
  const rule = selectIn(off.host, RULE_ROW);
  rule.value = "clean";
  rule.dispatch("change");
  const cfg = off.cfg();
  assert.equal(defOf(cfg, "leftMode", "status").yamlCardinality, undefined);
  assert.equal(defOf(cfg, "leftMode", "status").yamlValueRule, undefined);
  assert.equal(off.writes.length, 0, "и ни одной записи не ушло");
  off.cleanup();
  ok("выключенный модуль: раздел виден, но ничего не пишет");
}

/* ======================================================================
 * 14. Экран обновляется, даже если плагин бросил ПОСЛЕ записи.
 *
 * Замечание заказчика 2026-08-28: «в Preview ничего не меняется, а при
 * переключении вкладок изменится». Значение при этом сохранялось — то есть
 * запись проходила, а перерисовка не наступала. Настоящий `setConfigPatch`
 * после записи делает многое: лог dev-режима, пересборку правил, перерисовку
 * TagWheel, — и исключение оттуда уносило с собой вызов `redraw`.
 *
 * Теперь перерисовка идёт в `finally`, и это проверяется в обе стороны.
 * ====================================================================== */

{
  const realError = console.error;
  const said: string[] = [];
  console.error = (...args: unknown[]) => { said.push(String(args[0] ?? "")); };
  let p: Panel;
  try {
    p = makePanel(baseConfig(), "status", { throwAfterPatch: true });
    assert.equal(writtenAs(p.host), 'status: "#todo"', "на старте правило raw");
    const rule = selectIn(p.host, RULE_ROW);
    rule.value = "clean";
    rule.dispatch("change");
  } finally {
    console.error = realError;
  }

  assert.equal(defOf(p.cfg(), "leftMode", "status").yamlValueRule, "clean",
    "запись прошла, несмотря на исключение плагина");
  assert.equal(writtenAs(p.host), 'status: "todo"',
    "и экран обновился: без этого человек видел прежнюю строку до смены вкладки");
  assert.equal(selectIn(p.host, RULE_ROW).value, "clean", "и список показывает записанное");
  assert.ok(said.some(m => m.includes("запись свойства заметки не удалась")),
    "а сбой назван в консоли, а не в интерфейсе (З8): " + said.join(" | "));
  p.cleanup();
  ok("экран обновляется, даже если плагин бросил после записи");
}

/* ======================================================================
 * 15. Стёртое имя свойства действительно стирается.
 *
 * Замечание заказчика 2026-08-28: «назначил свойство, потом удалил значение —
 * а в Preview прежнее». Превью не врало: имя свойства не стиралось вовсе.
 *
 * `setOrderPatch` в ветке без `replace` ставил надгробия только для `lead`, а
 * карту свойств заменял целиком — и пустая карта при `deepMerge` не меняет
 * ничего, прежнее значение оставалось в конфиге. Дефект был и у старой доски:
 * стереть свойство там тоже не получалось.
 *
 * Проверяется в обе стороны: стёртое уходит, соседнее остаётся.
 * ====================================================================== */

{
  const base = baseConfig();
  base.pkm.behavior.order.propertiesByField = { status: "tags", project: "kind" };
  const p = makePanel(base, "status");
  assert.equal(writtenAs(p.host), 'tags: "#todo"', "свойство на месте");

  const input = all(control(p.host, "Property"), "io-text")[0] as StubNode;
  input.value = "";
  input.dispatch("change");

  const order = p.cfg().pkm.behavior.order;
  assert.equal(order.propertiesByField.status, undefined,
    "стёртое имя свойства ушло из конфига");
  assert.equal(order.propertiesByField.project, "kind",
    "а соседнее осталось: карта свойств сливается, а не заменяется целиком");
  assert.equal(writtenAs(p.host), "not written", "и превью это показывает");

  /* Значения Field при этом целы: стёрли имя свойства, а не Values. */
  assert.deepEqual(
    (defOf(p.cfg(), "leftMode", "status").values as Any[]).map((v: Any) => v.token),
    ["todo", "doing"],
    "значения Field не тронуты: стёрли имя свойства, а не Values");
  p.cleanup();
  ok("стёртое имя свойства стирается, соседнее и значения целы");
}

console.log("\n" + passed + " проверок пройдено");
