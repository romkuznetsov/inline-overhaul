/**
 * `Color your Tags` — цвета тегов вне Fields (PRD 10.11а, фаза 3c).
 *
 * Что здесь настоящее. Путь записи — плагиновый: `ConfigStore` из `src/core`,
 * `deepMerge` и `cloneJson` из `shared_utils.js`, `migrateConfig` из `main.js`
 * (`tests/harness/plugin_internals.ts`). Это важнее обычного: удаление тега
 * идёт **надгробием** (`null`), а надгробие работает или не работает именно в
 * `deepMerge` — на своём слиянии проверка была бы бессмысленной.
 *
 * Читателя тоже спрашиваем настоящего: цвет токена в строке разрешают
 * `getTagVisualsFromConfig` и `readTagVisualRowByTokenMaps` из `main.js` — те
 * самые функции, которыми плагин решает, каким цветом рисовать тег.
 *
 * Подделан только DOM: блок рисуется в Obsidian, другого способа нажать нет.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals, Setting, Notice, Modal } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import {
  createUserTagsModel,
  renderUserTags,
  HEAD,
  ADD_TAG,
  EMPTY_LIST,
} from "../../src/ui/settings/custom/user_tags.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";
import type { SettingsCtx } from "../../src/ui/settings/types.ts";

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
  all(node, "io-icon").concat(all(node, "io-btn"), all(node, "io-colin"), all(node, "io-select"))
    .find(n => String(n.getAttribute("aria-label") || "").startsWith(prefix));

/* ---- панель на настоящем пути записи ----------------------------------- */

interface Panel {
  host: StubNode;
  tags: () => Record<string, Any>;
  writes: Array<{ reason: string }>;
  draw: () => void;
  plugin: Any;
}

function makePanel(userTags: Record<string, Any>, o?: { enabled?: boolean }): Panel {
  const host = makeNode("div");
  const base = { pkm: { behavior: { tagVisuals: { userTags } } } };
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

  /* Контекст панели: значения вида берутся из конфига, как в панели. */
  const ctx: Any = {
    get: (p: string) => (p === "features.visual.enabled" ? !(o && o.enabled === false) : 100),
    set: async () => {},
    run: async () => {},
    watch: () => () => {},
    platform: {
      Setting,
      Notice,
      Modal,
      setIcon: () => {},
      plugin,
      getConfig: () => store.getSnapshot(),
      normalizePkmOrder: internals.normalizePkmOrder,
      pkmOrderFields: [] as string[],
    },
  };

  const draw = (): void => {
    host.empty();
    const model = createUserTagsModel(plugin);
    renderUserTags(host as unknown as El, {
      rows: model.listTags(),
      ctx: ctx as SettingsCtx,
      enabled: !(o && o.enabled === false),
      onVisual: (row, patch, reason) => { model.setVisual(row.token, patch, reason); draw(); },
      onRemove: row => { model.remove(row.token); draw(); },
      onAdd: raw => { model.add(raw); draw(); },
    });
  };
  draw();

  return {
    host,
    tags: () => {
      const cfg = store.getSnapshot();
      const visuals = cfg?.pkm?.behavior?.tagVisuals;
      return (visuals && visuals.userTags) || {};
    },
    writes,
    draw,
    plugin,
  };
}

const TWO_TAGS = {
  "#urgent": { fillColor: "#b3261e", textColor: "#ffffff", visibility: "default" },
  "#idea": { fillColor: "", textColor: "", visibility: "default" },
};

/* ---- что рисуется ------------------------------------------------------ */

{
  const p = makePanel(TWO_TAGS);
  const head = all(p.host, "io-tablehead")[0];
  assert.ok(head, "шапка таблицы нарисовалась");
  assert.deepEqual(head.children.map(n => n.textContent), Array.from(HEAD),
    "пять колонок: тег, два цвета, показ и кнопки");
  assert.equal(all(p.host, "io-tablerow").length, 2, "по строке на тег");

  /* Имя тега и есть предпросмотр: отдельного чипа рядом нет. */
  assert.deepEqual(texts(p.host, "io-bubble"), ["#urgent", "#idea"],
    "тег нарисован пузырём — тем же, которым рисуют предпросмотры");
  ok("таблица: строка на тег, имя тега и есть предпросмотр");
}

{
  /* Показ бывает только двух видов: `custom` эта ветка конфига не хранит. */
  const p = makePanel(TWO_TAGS);
  const shown = all(p.host, "io-select")[0] as StubNode;
  assert.deepEqual(shown.options.map(n => n.value), ["default", "empty"],
    "третьего значения нет — контрола, который не работает, быть не должно (З8)");
  ok("З8: показ своего тега бывает только `default` или `empty`");
}

{
  const p = makePanel({});
  assert.equal(all(p.host, "io-tablerow").length, 0, "строк нет");
  assert.equal(texts(p.host, "io-side__empty")[0], EMPTY_LIST,
    "и пустой список говорит, что здесь бывает (ПЗ2)");
  assert.ok(byLabel(p.host, ADD_TAG), "а завести тег всё равно можно");
  ok("ПЗ2: пустой список подписан");
}

/* ---- записи на настоящем пути ------------------------------------------ */

{
  const p = makePanel(TWO_TAGS);
  const fill = byLabel(p.host, "Fill color for #idea") as StubNode;
  assert.ok(fill, "пикер заливки нашёлся");
  fill.value = "#123456";
  fill.dispatch("change");

  assert.equal(p.tags()["#idea"]?.fillColor, "#123456", "цвет доехал до конфига");
  assert.equal(p.tags()["#urgent"]?.fillColor, "#b3261e", "и соседний тег не пострадал");
  assert.deepEqual(p.writes.map(w => w.reason), ["pkm:visuals:user-tags:fill"],
    "причина записи названа");
  ok("цвет заливки идёт в конфиг настоящим патчем");
}

{
  /*
   * Строка пишется целиком, из текущей: правка одного поля не смеет обнулить
   * соседние. Дыра названа мутацией — проверка «показ не теряет цветов» была,
   * обратной ей не было.
   */
  const p = makePanel({
    "#urgent": { fillColor: "#b3261e", textColor: "#ffffff", visibility: "empty" },
  });
  const fill = byLabel(p.host, "Fill color for #urgent") as StubNode;
  fill.value = "#123456";
  fill.dispatch("change");

  const row = p.tags()["#urgent"];
  assert.equal(row?.fillColor, "#123456", "заливка записана");
  assert.equal(row?.visibility, "empty", "а показ остался прежним");
  assert.equal(row?.textColor, "#ffffff", "и цвет текста тоже");
  ok("правка одного поля не трогает остальные");
}

{
  /*
   * Цвет разбирается, а не пишется как есть: рантайм понимает только
   * `#rrggbb`, и всё остальное значит «цвет темы». Разбор стоит дважды — в
   * модели и в `normalizeTagVisualRow` внутри `migrateConfig`, — и проверка
   * держит результат, а не место разбора: мутация показала, что снятие
   * разбора в модели ничего не меняет, потому что ловит нормализация.
   */
  const p = makePanel(TWO_TAGS);
  const model = createUserTagsModel(p.plugin);
  model.setVisual("#idea", { fillColor: "red" }, "pkm:visuals:user-tags:fill");
  assert.equal(p.tags()["#idea"]?.fillColor, "",
    "непонятный цвет записан как «цвет темы», а не как есть");

  model.setVisual("#idea", { fillColor: "#AABBCC" }, "pkm:visuals:user-tags:fill");
  assert.equal(p.tags()["#idea"]?.fillColor, "#aabbcc",
    "а понятный приведён к тому виду, в каком его хранит конфиг");
  ok("цвет разбирается перед записью, а не пишется как есть");
}

{
  const p = makePanel(TWO_TAGS);
  const shown = byLabel(p.host, "Show, for #urgent") as StubNode;
  shown.value = "empty";
  shown.dispatch("change");

  assert.equal(p.tags()["#urgent"]?.visibility, "empty", "показ записан");
  assert.equal(p.tags()["#urgent"]?.fillColor, "#b3261e",
    "цвета при этом остались: строка пишется целиком, из текущей");
  assert.ok(all(p.host, "io-bubble--empty").length === 1, "и пузырь стал пустым");
  ok("показ пустым записывается, не теряя цветов");
}

{
  /*
   * Кнопка сброса есть только там, где есть что сбрасывать, и возвращает
   * тег к цвету темы. Пикер такого сказать не умеет — это и есть причина
   * кнопки.
   */
  const p = makePanel(TWO_TAGS);
  assert.equal(all(p.host, "io-icon").filter(
    n => String(n.getAttribute("aria-label") || "").startsWith("Reset the colors")).length, 1,
    "кнопка сброса — только у тега со своими цветами");

  (byLabel(p.host, "Reset the colors of #urgent") as StubNode).click();
  assert.equal(p.tags()["#urgent"]?.fillColor, "", "заливка снята");
  assert.equal(p.tags()["#urgent"]?.textColor, "", "и цвет текста тоже");
  assert.deepEqual(p.writes.map(w => w.reason), ["pkm:visuals:user-tags:color-reset"],
    "причина записи названа");
  assert.equal(all(p.host, "io-icon").filter(
    n => String(n.getAttribute("aria-label") || "").startsWith("Reset the colors")).length, 0,
    "и кнопка пропала: сбрасывать больше нечего");
  ok("сброс возвращает тег к цвету темы");
}

{
  /*
   * Удаление — надгробием. Пустая строка вместо `null` оставила бы тег в
   * конфиге, и он вернулся бы в список на следующей перерисовке; проверка
   * идёт через настоящий `deepMerge`, где это и решается.
   */
  const p = makePanel(TWO_TAGS);
  (byLabel(p.host, "Remove #idea") as StubNode).click();

  assert.deepEqual(Object.keys(p.tags()), ["#urgent"], "тег ушёл из конфига");
  assert.equal(all(p.host, "io-tablerow").length, 1, "и из таблицы");
  assert.deepEqual(p.writes.map(w => w.reason), ["pkm:visuals:user-tags:delete"],
    "причина записи названа");
  ok("удаление уносит тег надгробием, а не пустыми цветами");
}

{
  const p = makePanel(TWO_TAGS);
  const add = all(p.host, "io-text")[0] as StubNode;
  add.value = "later";
  (byLabel(p.host, ADD_TAG) as StubNode).click();

  assert.ok(Object.prototype.hasOwnProperty.call(p.tags(), "#later"),
    "решётка не обязательна: тег заведён как #later — " + Object.keys(p.tags()).join(", "));
  const later = p.tags()["#later"];
  assert.equal(later?.fillColor, "", "заводится без заливки, то есть с цветом темы");
  assert.equal(later?.textColor, "", "и без своего цвета текста");
  assert.equal(later?.visibility, "default", "и показывается целиком");
  assert.deepEqual(p.writes.map(w => w.reason), ["pkm:visuals:user-tags:add"],
    "причина записи названа");
  ok("тег заводится с решёткой и без неё");
}

{
  const p = makePanel(TWO_TAGS);
  const add = all(p.host, "io-text")[0] as StubNode;
  add.value = "#urgent";
  (byLabel(p.host, ADD_TAG) as StubNode).click();
  assert.equal(p.tags()["#urgent"]?.fillColor, "#b3261e",
    "второй раз тот же тег не затирает цвета первого");
  assert.deepEqual(p.writes, [], "и патча не было вовсе");

  add.value = "   ";
  (byLabel(p.host, ADD_TAG) as StubNode).click();
  assert.deepEqual(Object.keys(p.tags()).sort(), ["#idea", "#urgent"],
    "пустая строка тега не заводит");
  ok("повтор и пустая строка тег не заводят");
}

/* ---- читатель конфига видит записанное --------------------------------- */

/**
 * Главная проверка блока: не сверка ключей, а вопрос читателю. Каким цветом
 * рисовать токен в строке, решают три функции `main.js` —
 * `getTagVisualsFromConfig`, `buildFieldTagVisualMap`, `buildGlobalTagVisualMap`
 * и `readTagVisualRowByTokenMaps`. Их и спрашиваем: они обязаны увидеть то,
 * что записала панель, и перестать видеть удалённое.
 */
function runtimeRow(cfg: Any, token: string): Any {
  const visuals = internals.getTagVisualsFromConfig(cfg);
  return internals.readTagVisualRowByTokenMaps(
    token,
    internals.buildFieldTagVisualMap(cfg),
    visuals.userTags,
    internals.buildGlobalTagVisualMap(cfg),
  );
}

{
  const p = makePanel(TWO_TAGS);
  const fill = byLabel(p.host, "Fill color for #idea") as StubNode;
  fill.value = "#123456";
  fill.dispatch("change");

  const row = runtimeRow(p.plugin.getConfig(), "#idea");
  assert.ok(row, "рантайм нашёл свой тег");
  assert.equal(row.fillColor, "#123456",
    "и красит его тем цветом, который выбрали в панели");
  ok("рантайм видит цвет, записанный панелью");
}

{
  /*
   * И перестаёт видеть удалённый. Это же и проверка надгробия целиком: если
   * `null` в этой ветке снова начнёт превращаться в строку с цветами темы,
   * удалённый тег вернётся, и здесь это будет видно.
   */
  const p = makePanel(TWO_TAGS);
  assert.ok(runtimeRow(p.plugin.getConfig(), "#idea"), "до удаления тег рантайму виден");

  (byLabel(p.host, "Remove #idea") as StubNode).click();

  assert.equal(runtimeRow(p.plugin.getConfig(), "#idea"), null,
    "после удаления рантайм его не находит");
  assert.ok(runtimeRow(p.plugin.getConfig(), "#urgent"), "а соседний тег на месте");
  ok("удалённый тег исчезает и для рантайма");
}

/* ---- модуль выключен --------------------------------------------------- */

{
  const p = makePanel(TWO_TAGS, { enabled: false });
  const fill = byLabel(p.host, "Fill color for #idea") as StubNode;
  assert.equal(fill.disabled, true, "с выключенным модулем Visual цвет не правится");
  fill.value = "#123456";
  fill.dispatch("change");
  assert.deepEqual(p.writes, [], "и нажатие ничего не записывает");
  ok("выключенный модуль Visual выключает и блок");
}

console.log("\n" + passed + " проверок пройдено");
