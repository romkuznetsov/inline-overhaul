/**
 * Живое обновление своих блоков (замечание заказчика 1.4.1.1.3).
 *
 * **Дефект, который здесь закреплён.** Заказчик менял Fields и не видел
 * изменений в `Live preview`, пока не перейдёт по вкладкам и обратно. Причин
 * оказалось две, и каждая по отдельности достаточна:
 *
 *   1. Пробуждение своих блоков висело на шве `setControlValue`, то есть на
 *      записи, которую делает **платформа**. Редактор Fields пишет иначе —
 *      `plugin.setConfigPatch` → `ConfigStore.patch`, — и об этих записях в
 *      панели не знал никто.
 *   2. Ни один предпросмотр не был подписан на ветку Fields, хотя каждый её
 *      читает (`previewFields`). Даже исправное оповещение их бы не разбудило:
 *      они об этих путях не просили.
 *
 * Поэтому проверка идёт **через настоящий путь записи**: настоящий
 * `ConfigStore` из `src/core`, настоящая `migrateConfig` из `main.js`, патч —
 * тот же, что посылает редактор Fields. Подделан только DOM: другого способа
 * посмотреть, что нарисовала панель, нет.
 *
 * Подделывать здесь хранилище нельзя вдвойне: диффом снимков занят
 * `ConfigStoreAdapter`, и проверка на `MemoryStore` прошла бы мимо него.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { SCHEMA, TABS } from "../../src/ui/settings/schema/index.ts";
import { SettingsPane } from "../../src/ui/settings/settings_tab.ts";
import { ConfigStoreAdapter, MemoryStore, changedPaths } from "../../src/ui/settings/store.ts";
import { createFieldsModel } from "../../src/ui/settings/custom/fields_model.ts";
import * as deepStateModule from "../../src/core/order_deep_editor_state.js";

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
const internals = loadPluginInternals();
const deepState = (deepStateModule as { default?: unknown }).default || deepStateModule;

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/* ---- окружение ---------------------------------------------------------- */

function all(node: StubNode, cls: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (n.classList.contains(cls)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

const texts = (node: StubNode, cls: string): string[] =>
  all(node, cls).map(n => String(n.textContent || "").trim());

const fragments = {
  createFragment(): StubNode {
    return makeNode("fragment");
  },
};

/**
 * Конфиг берётся из фикстуры и прогоняется через `migrateConfig` — правило
 * проекта: конфиг для проверки не пишется в проверке (гейт Г16 однажды на
 * этом и ослеп).
 */
function realConfig(): Any {
  const raw = JSON.parse(
    fs.readFileSync(path.join(root, "tests", "fixtures", "config_v1_realistic.json"), "utf8"),
  ) as Any;
  return internals.migrateConfig(raw);
}

/** Панель на настоящем хранилище, с тем же швом, что в `obsidian_tab.ts`. */
function makePanel(): {
  pane: SettingsPane;
  store: Any;
  /** Патч тем же путём, каким его посылает свой блок (`setConfigPatch`). */
  patch: (obj: Any, reason: string) => void;
  /** Переименовать первое Value первого Field — руками редактора. */
  renameFirstValue: (to: string) => string;
  /** Переименовать первый Field — тем же способом, что поле ввода в редакторе. */
  renameFirstLabel: (to: string) => string;
  /** Переименовать первое Value Field заданного типа; пусто — такого нет. */
  renameValueOfKind: (kind: string, to: string) => string;
} {
  const base = realConfig();
  const store = new ConfigStore(
    { loadData: async () => base, saveData: async () => {} },
    {
      defaults: base,
      cloneJson: shared.cloneJson,
      isObj: shared.isObj,
      deepMerge: shared.deepMerge,
      migrateConfig: internals.migrateConfig,
      Notice: class StubNotice { },
    },
  );
  store.config = shared.cloneJson(base);

  /* Плагин в терминах панели: снимок конфига и запись патчем — как в `main.js`. */
  const plugin = {
    getConfig: () => store.getSnapshot(),
    setConfigPatch: (patch: Any, reason: string) => { store.patch(patch, reason || "settings"); },
  };

  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store: new ConfigStoreAdapter({
      getConfig: () => store.config as Record<string, unknown>,
      update: (mutator, reason, opts) => store.update(
        (cfg: Any) => { mutator(cfg); return cfg; }, reason, opts,
      ),
      subscribe: listener => store.subscribe(listener),
    }),
    actions: {},
    fragments: fragments as never,
    /*
     * Без платформы предпросмотр показывает ПРИМЕРНЫЕ Fields и говорит об этом
     * (ПЗ2) — и тогда проверка гоняла бы не то: пример от конфига не зависит.
     * Настоящие Fields читает модель редактора, ей нужны снимок конфига и
     * нормализация Order из `main.js`.
     */
    platform: {
      plugin,
      getConfig: () => store.getSnapshot() as Record<string, unknown>,
      normalizePkmOrder: internals.normalizePkmOrder as never,
      pkmOrderFields: [],
    } as never,
  });

  /**
   * Правку делает модель редактора, а не проверка: заказчик менял Values
   * руками, и путь записи у этого действия свой — `saveTree` → `setConfigPatch`
   * → `store.patch`. Своя сборка патча прошла бы мимо него.
   */
  const renameFirstValue = (to: string): string => {
    const model = createFieldsModel({
      plugin: plugin as never,
      normalizePkmOrder: internals.normalizePkmOrder as never,
      pkmOrderFields: [],
      cfg: plugin.getConfig() as never,
      deepState: deepState as never,
    });
    const row = model.listFields().find((r: Any) => !r.parent && r.kind !== "element");
    assert.ok(row, "в фикстуре нет Field со значениями — проверять нечего");
    const ve = model.valuesEditor(row.key);
    assert.ok(ve.tree.length, "у Field нет ни одного Value");
    const tree = ve.tree.map((t: Any) => ({ ...t, children: (t.children || []).map((c: Any) => ({ ...c })) }));
    tree[0].token = to;
    const res = ve.saveTree(tree, "pkm:behavior:order:deep:values:" + row.key);
    assert.ok(res.ok, "модель не записала Value: " + String(res.error || ""));
    return to.replace(/^#/, "");
  };

  /**
   * Переименовать первое Value Field заданного типа. Нужно, чтобы отличить
   * тег от ссылки в предпросмотре полос: полосы рисуются только по тегам
   * (замечание заказчика 1.5.3.2, пункт 2).
   */
  const renameValueOfKind = (kind: string, to: string): string => {
    const model = createFieldsModel({
      plugin: plugin as never,
      normalizePkmOrder: internals.normalizePkmOrder as never,
      pkmOrderFields: [],
      cfg: plugin.getConfig() as never,
      deepState: deepState as never,
    });
    const row = model.listFields().find((r: Any) => !r.parent && r.kind === kind);
    if (!row) return "";
    const ve = model.valuesEditor(row.key);
    if (!ve.tree.length) return "";
    const tree = ve.tree.map((t: Any) => ({ ...t, children: (t.children || []).map((c: Any) => ({ ...c })) }));
    tree[0].token = to;
    const res = ve.saveTree(tree, "pkm:behavior:order:deep:values:" + row.key);
    assert.ok(res.ok, "модель не записала Value: " + String(res.error || ""));
    return to.replace(/^#/, "").replace(/^\[\[|\]\]$/g, "");
  };

  /** Переименовать первый Field — тем же `setLabel`, что зовёт поле ввода. */
  const renameFirstLabel = (to: string): string => {
    const model = createFieldsModel({
      plugin: plugin as never,
      normalizePkmOrder: internals.normalizePkmOrder as never,
      pkmOrderFields: [],
      cfg: plugin.getConfig() as never,
      deepState: deepState as never,
    });
    const row = model.listFields().find((r: Any) => !r.parent);
    assert.ok(row, "в фикстуре нет ни одного Field — проверять нечего");
    const res = model.setLabel(row.key, to);
    assert.ok(res.ok, "модель не записала имя Field: " + String(res.error || ""));
    return to;
  };

  return {
    pane,
    store,
    patch: (obj, reason) => { store.patch(obj, reason); },
    renameFirstValue,
    renameFirstLabel,
    renameValueOfKind,
  };
}

/**
 * Свой блок группы: первым в группе идёт вводная строка, блок следующим.
 *
 * Вводная строка тоже рисует себя через `render` — иначе платформа не рисовала
 * бы её вовсе (B7, 2026-09-02), — поэтому она пропускается по схеме, а не по
 * догадке о содержимом.
 */
function drawBlock(pane: SettingsPane, tab: string, heading: string): StubNode {
  pane.setActiveTab(tab as never);
  const defs = pane.getSettingDefinitions() as unknown as Any[];
  const group = defs.find((d: Any) => d.heading === heading);
  assert.ok(group, heading + ": группа не нашлась");
  /* Вводной строки в группе больше нет: с 2026-09-04 фраза едет коллаутом
     между заголовком и карточкой, а не первой строкой внутри неё. */
  const rows = (group.items || []).slice();
  const block = rows.find((it: Any) => typeof it.render === "function");
  assert.ok(block, heading + ": в группе нет своего блока");
  const host = makeNode("div");
  const cleanup = block.render({ settingEl: host }, {});
  assert.equal(typeof cleanup, "function", "свой блок обязан вернуть функцию очистки (С5)");
  return host;
}

/** Имя первого Field в конфиге: с него и начинаем переименование. */
function firstFieldKey(cfg: Any): string {
  const names = cfg?.pkm?.fields?.order?.strictNames as Record<string, string> | undefined;
  const keys = names ? Object.keys(names) : [];
  assert.ok(keys.length, "в фикстуре нет ни одного Field — проверять нечего");
  return String(keys[0]);
}

/* ---- 1: запись из своего блока доходит до предпросмотра ----------------- */

{
  const p = makePanel();
  const host = drawBlock(p.pane, "pkm", "Fields");

  const before = texts(host, "io-chip__name").join("|") + "//" + host.textContent;
  const key = firstFieldKey(p.store.config);
  const renamed = "io_wake_probe";

  /*
   * Патч дословно такой, какой посылает редактор Fields при переименовании:
   * короткое имя Field лежит в `labels`, и через шов `setControlValue` он не
   * идёт никогда — у него нет своей строки в схеме.
   */
  p.patch({ pkm: { fields: { order: { labels: { [key]: renamed } } } } },
    "pkm:behavior:order:deep:rename:" + key);

  const after = texts(host, "io-chip__name").join("|") + "//" + host.textContent;
  assert.notEqual(after, before,
    "предпросмотр не заметил записи из своего блока: именно это заказчик и видел "
    + "как «не обновляется на лету»");
  assert.ok(host.textContent.includes(renamed),
    "и заметил её не как угодно, а показав новое имя Field: " + host.textContent.slice(0, 200));
  ok("предпросмотр строки обновляется от записи, пришедшей не через шов панели");
}

/* ---- 2: подписки хватает всем предпросмотрам, читающим Fields ----------- */

{
  /*
   * Проверяются все четыре, а не один: подписка и список путей — разные
   * половины дефекта, и добавить ветку Fields в один список, забыв остальные,
   * ровно та правка, которую легко сделать наполовину.
   */
  /*
   * У каждого предпросмотра свой пробой, и это не удобство, а условие: они
   * рисуют разное. Предпросмотр строки и TagWheel показывают **имена** Fields,
   * оформление тегов и полосы — **значения**. Один пробой на всех молчал бы
   * там, где смотрит не туда, и проверка выглядела бы зелёной.
   */
  const places: Array<[string, string, "label" | "value"]> = [
    ["pkm", "Fields", "label"],
    /* Заголовок берётся у схемы: группу переименовали в `Inline appearance`
       (замечание заказчика 2026-09-04), и переписанный литерал разошёлся бы. */
    ["visual", String(SCHEMA.find(g => g.id === "tag-appearance")?.heading || ""), "value"],
    ["visual", "Tag Bars", "value"],
    ["visual", "TagWheel", "label"],
  ];
  const deaf: string[] = [];
  for (const [tab, heading, probe] of places) {
    const p = makePanel();
    const host = drawBlock(p.pane, tab, heading);
    const before = host.textContent;
    assert.ok(before.length, heading + ": блок не нарисовался вовсе");
    const mark = "iowake" + tab.slice(0, 3) + heading.replace(/[^A-Za-z]/g, "").slice(0, 4);
    const shown = probe === "label"
      ? p.renameFirstLabel(mark)
      : p.renameFirstValue("#" + mark);
    if (host.textContent === before || !host.textContent.includes(shown)) {
      deaf.push(tab + " → " + heading);
    }
  }
  assert.deepEqual(deaf, [],
    "эти предпросмотры читают Fields, но на изменение Fields не отвечают:\n  "
    + deaf.join("\n  "));
  ok("на ветку Fields подписаны все предпросмотры, которые её читают");
}

/* ---- 3: один подписчик — одна перерисовка ------------------------------- */

{
  /*
   * Переименование Field задевает десятки путей одним патчем. Без сборки
   * подписчиков в множество блок перерисовался бы столько раз, сколько путей
   * задел патч, — и вернулся бы дефект A8 в новом виде: скролл и каретка
   * восстанавливаются на каждой перерисовке.
   */
  const store = new MemoryStore({ pkm: { fields: { order: { labels: {} } } } });
  const pane = new SettingsPane({
    schema: SCHEMA, tabs: TABS, store, actions: {}, fragments: fragments as never,
  });
  let draws = 0;
  const stop = (pane as unknown as {
    watch: (paths: readonly string[], redraw: () => void) => () => void;
  }).watch(["pkm.fields"], () => { draws++; });

  const before = JSON.parse(JSON.stringify(store.config)) as Any;
  const labels = ((store.config["pkm"] as Any).fields.order.labels) as Record<string, string>;
  for (const name of ["a", "b", "c", "d", "e"]) labels[name] = name + "!";
  store.emit(before);

  assert.ok(changedPaths(before, store.config).length >= 5,
    "патч и правда задел много путей, иначе проверять нечего");
  assert.equal(draws, 1,
    "блок перерисовался " + draws + " раз вместо одного: подписчики не сведены в множество");
  stop();
  assert.equal(pane.watcherCount(), 0, "отписка снимает подписчика");
  ok("одна запись — одна перерисовка, сколько бы путей она ни задела");
}

/* ---- 4: пути считаются, а не берутся из причины записи ------------------ */

{
  const before = { a: { b: 1, c: 2 }, list: [1, 2], gone: true } as Any;
  const after = { a: { b: 1, c: 3 }, list: [1, 2, 3], added: "x" } as Any;
  assert.deepEqual(changedPaths(before, after).sort(),
    ["added", "a.c", "gone", "list"].sort(),
    "изменение, появление, исчезновение и массив целиком");
  assert.deepEqual(changedPaths(before, before), [],
    "одинаковые снимки не будят никого: иначе панель перерисовывалась бы на "
    + "каждом сохранении");
  ok("сравнение снимков даёт точные пути, включая появившиеся и исчезнувшие");
}

/* ---- 5: запись через шов панели по-прежнему будит блок ------------------ */

{
  /*
   * Шов больше не будит блоки сам, и это легко сломать наполовину: убрать
   * старый вызов и не завести подписку. Тогда бы «поехало» уже не только
   * от записи своего блока, но и от обычного контрола.
   */
  const store = new MemoryStore({});
  const pane = new SettingsPane({
    schema: SCHEMA, tabs: TABS, store, actions: {}, fragments: fragments as never,
  });
  let draws = 0;
  const stop = (pane as unknown as {
    watch: (paths: readonly string[], redraw: () => void) => () => void;
  }).watch(["pkm.lineFormat.separator1"], () => { draws++; });
  await pane.setControlValue("pkm.lineFormat.separator1", "//");
  assert.equal(draws, 1, "запись из панели тоже обязана будить блок");
  await pane.setControlValue("visual.tags.textSizePct", 120);
  assert.equal(draws, 1, "и только тех, чьи пути изменились");
  stop();
  ok("запись через шов панели будит блок ровно один раз, и только нужный");
}

/* ---- 6: список Fields у полос — настоящий (Д-2, Д-3) -------------------- */

{
  /*
   * Заказчик включил `Tag Bars` и не увидел ничего. Причин было две, и обе
   * закреплены здесь.
   *
   *   Д-3. Список `Which Field draws Bars` предлагал `status` и `priority` —
   *        мокданные прототипа (Р8). У человека Fields свои, выбрать в этом
   *        списке было нечего, а значение по умолчанию (пустое) в списке даже
   *        не значилось: select показывал `Status`, будто он выбран.
   *   Д-2. Предпросмотр на пустом значении подставлял `status` и искал Field с
   *        таким id. Не находил — и молча рисовал дерево без полос.
   */
  const p = makePanel();
  p.pane.setActiveTab("visual" as never);
  const defs = p.pane.getSettingDefinitions() as unknown as Any[];
  const group = defs.find((d: Any) => d.heading === "Tag Bars");
  assert.ok(group, "группа Tag Bars не нашлась");
  const item = (group.items || []).find((it: Any) => it?.control?.key === "visual.tagBars.fieldId");
  assert.ok(item, "строки Which Field draws Bars нет");
  const options = item.control.options as Record<string, string>;

  /* Мокданных прототипа в панели быть не должно (Р8). */
  const real = ((p.store.config as Any).pkm.fields.order.strictNames || {}) as Record<string, string>;
  const mock = ["status", "priority"].filter(id => id in options && !(id in real));
  assert.deepEqual(mock, [],
    "список предлагает Fields, которых у человека нет: " + mock.join(", "));

  /* Значение по умолчанию обязано быть в списке, иначе select врёт. */
  assert.ok("" in options,
    "у пустого значения нет своей строки: select покажет первый Field как выбранный");

  /* И настоящие Fields в списке есть — те же, что видит движок. */
  const offered = Object.keys(options).filter(k => k !== "");
  assert.ok(offered.length, "список пуст, хотя Fields в конфиге есть");
  const alien = offered.filter(id => !(id in real));
  assert.deepEqual(alien, [],
    "в списке есть id, которого нет среди Fields: " + alien.join(", "));
  ok("список Which Field draws Bars собран из Fields человека, с пустой строкой");
}

{
  /*
   * Пустота обязана объясниться. Полосы включены, Field не выбран — и раньше
   * на экране было просто дерево без полос, из которого не следовало ничего.
   */
  const p = makePanel();
  await p.pane.setControlValue("visual.tagBars.active", true);
  await p.pane.setControlValue("visual.tagBars.fieldId", "");
  const host = drawBlock(p.pane, "visual", "Tag Bars");
  assert.ok(host.textContent.includes("Bars need a Field"),
    "предпросмотр не сказал, почему полос нет: " + host.textContent.slice(0, 160));

  /* Выбран Field, которого больше нет, — причина другая, и слова другие. */
  await p.pane.setControlValue("visual.tagBars.fieldId", "io_field_that_left");
  const gone = drawBlock(p.pane, "visual", "Tag Bars");
  assert.ok(gone.textContent.includes("is gone"),
    "исчезнувший Field назван так же, как невыбранный: " + gone.textContent.slice(0, 160));

  /* С настоящим Field полосы появляются, и объяснения больше нет. */
  const first = Object.keys(((p.store.config as Any).pkm.fields.order.strictNames) || {})[0];
  assert.ok(first, "в фикстуре нет Field — проверять нечего");
  await p.pane.setControlValue("visual.tagBars.fieldId", String(first));
  const drawn = drawBlock(p.pane, "visual", "Tag Bars");
  assert.ok(!drawn.textContent.includes("Bars need a Field"),
    "объяснение осталось, хотя Field выбран");
  assert.ok(all(drawn, "io-node--bar").length > 0,
    "полосы так и не нарисовались с настоящим Field — это и был дефект");
  ok("полосы рисуются с настоящим Field, а без него сказано, чего не хватает");
}

/* ---- 8: в предпросмотре полос — Values Fields типа tag ------------------ */

{
  /*
   * Второй пункт замечания заказчика по Tag Bars: в предпросмотре должны стоять
   * Values Fields **типа tag**, а не первые Fields по порядку. Места выдуманного
   * дерева раскладывались на любые Fields, и в строке оказывалась то ссылка, то
   * дата — а полосу для них нарисовать нечем: цвет полосы это цвет Value, и он
   * есть только у тега.
   */
  const p = makePanel();
  const tagShown = p.renameValueOfKind("tag", "#iobarstag");
  assert.ok(tagShown, "в фикстуре нет Field типа tag — проверять нечего");
  const linkShown = p.renameValueOfKind("wikilink", "[[iobarslink]]");

  const host = drawBlock(p.pane, "visual", "Tag Bars");
  const chips = texts(host, "io-bubble");
  assert.ok(chips.some(t => t.includes(tagShown)),
    "Value тега в предпросмотре полос не появилось: " + chips.join(" | "));
  if (linkShown) {
    assert.ok(!chips.some(t => t.includes(linkShown)),
      "в предпросмотре полос стоит Value ссылки, для которой полосу рисовать нечем: "
      + chips.join(" | "));
  }
  ok("предпросмотр полос собран из Values Fields типа tag, и только из них");
}

console.log("\n" + passed + " проверок пройдено");
