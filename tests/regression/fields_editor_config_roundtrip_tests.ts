/**
 * Круговой обход редактора Fields на НАСТОЯЩЕМ пути записи (фаза 3b).
 *
 * Зачем ещё один файл проверок. Остальные проверки редактора гоняют записи
 * через самодельную нормализацию Order и самодельное слияние патчей. На них
 * дефект ссылки — «стрелка Level удаляет значение» — зазеленел, а в vault
 * значение всё равно исчезало. Разница не в вёрстке, а в пути записи:
 *
 *   плагин:   setConfigPatch → ConfigStore.patch → deepMerge → migrateConfig
 *   проверка: своё слияние, миграции нет вовсе
 *
 * `migrateConfig` зовётся на КАЖДОМ патче (`src/core/config_store.js`), а
 * внутри него `ensureBehaviorModesFromOrder` пересобирает `leftMode.fields` и
 * `rightMode.fields` по спискам `order.left` / `order.right` — и вправе
 * выбросить Field, которого в них нет.
 *
 * Поэтому здесь всё настоящее: `ConfigStore` из `src/core`, `deepMerge` и
 * `cloneJson` из `shared_utils.js`, `migrateConfig` и `normalizePkmOrder` —
 * из `main.js` (см. `tests/harness/plugin_internals.ts`). Подделан только
 * DOM: панель рисуется в Obsidian, и другого способа её нажать нет.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { createFieldsModel } from "../../src/ui/settings/custom/fields_model.ts";
import { renderFieldsEditor, type FieldsViewState } from "../../src/ui/settings/custom/fields_editor_view.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";
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

/* ---- окружение --------------------------------------------------------- */

function all(root: StubNode, cls: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (n.classList.contains(cls)) out.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

function one(root: StubNode, cls: string): StubNode {
  const found = all(root, cls);
  assert.ok(found.length, "не нашёлся узел ." + cls);
  return found[0] as StubNode;
}

/** Ячейка уровня у строки таблицы значений: стрелка в ней одна. */
const levelArrow = (row: StubNode): StubNode => one(row, "io-depthcell").children[0] as StubNode;

/**
 * Панель, подключённая к настоящему хранилищу.
 *
 * `getConfig` и `setConfigPatch` повторяют плагин дословно (`main.js`):
 * первый отдаёт снимок хранилища, второй зовёт `store.patch`.
 */
function makePanel(base: Any, selected: string): {
  host: StubNode;
  cfg: () => Any;
  store: Any;
  draw: () => void;
  model: () => Any;
  writes: Array<{ patch: Any; reason: string }>;
} {
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
  /* Патчи записываются по дороге: часть проверок должна видеть, что пишет
     САМА модель, а не только чем всё кончилось после migrateConfig. */
  const writes: Array<{ patch: Any; reason: string }> = [];
  const plugin = {
    getConfig: () => store.getSnapshot(),
    setConfigPatch: (patch: Any, reason: string) => {
      writes.push({ patch, reason: reason || "settings" });
      store.patch(patch, reason || "settings");
    },
  };
  const state: FieldsViewState = { selected };
  let cleanup: (() => void) | null = null;
  /* Последняя собранная модель: её зовут проверки, которым нужна не кнопка,
     а сама запись — удаление Field кнопкой идёт через диалог. */
  let lastModel: Any = null;
  const draw = (): void => {
    if (cleanup) cleanup();
    host.empty();
    lastModel = createFieldsModel({
      plugin: plugin as never,
      normalizePkmOrder: internals.normalizePkmOrder as never,
      pkmOrderFields: [],
      cfg: plugin.getConfig() as never,
      deepState: deepState as never,
    });
    cleanup = renderFieldsEditor(host as unknown as El, {
      model: lastModel,
      ctx: { get: () => 100, set: async () => {}, run: async () => {}, watch: () => () => {} } as never,
      state,
      enabled: true,
      showTips: false,
      redraw: draw,
      notice: () => {},
      askNewField: done => done(null),
      confirmDeleteField: (_name, done) => done(false),
    });
  };
  draw();
  return { host, cfg: () => store.getSnapshot(), store, draw, model: () => lastModel, writes };
}

/** Конфиг с одним тегом и одной ссылкой, у каждого по два значения. */
function baseConfig(): Any {
  return JSON.parse(JSON.stringify({
    pkm: {
      behavior: {
        order: {
          left: ["status"],
          right: ["project"],
          labels: { status: "Status", project: "Project" },
          strictNames: { status: "status", project: "project" },
          types: { status: "tag", project: "wikilink" },
          active: { status: "yes", project: "yes" },
          freeRoam: { status: "off", project: "off" },
          enabled: { status: true, project: true },
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
      },
    },
  }));
}

const fieldById = (cfg: Any, side: "leftMode" | "rightMode", id: string): Any =>
  (cfg.pkm.behavior[side].fields as Any[]).find((f: Any) => String(f && f.id || "") === id) || null;

/* ======================================================================
 * Тег: контрольный случай. Он в vault работает, и здесь обязан работать.
 * ====================================================================== */

{
  const p = makePanel(baseConfig(), "status");
  const rows = all(p.host, "io-vals__row");
  assert.equal(rows.length, 2, "у тега два значения");
  levelArrow(rows[1] as StubNode).click();

  const after = all(p.host, "io-vals__row");
  assert.equal(after.length, 2, "тег: значение не исчезло после настоящей записи");
  assert.ok((after[1] as StubNode).classList.contains("io-vals__row--child"),
    "тег: второе значение стало дочерним");
  const sub = fieldById(p.cfg(), "leftMode", "status_sub");
  assert.ok(sub, "тег: дочерний Field пережил migrateConfig");
  assert.deepEqual((sub.values as Any[]).map((v: Any) => v.token), ["#doing"],
    "тег: дочернее значение лежит в дочернем Field");
  ok("тег: стрелка Level переживает настоящий путь записи");
}

/* ======================================================================
 * Ссылка: тот самый дефект.
 * ====================================================================== */

{
  const p = makePanel(baseConfig(), "project");
  const rows = all(p.host, "io-vals__row");
  assert.equal(rows.length, 2, "у ссылки два значения");
  levelArrow(rows[1] as StubNode).click();

  const cfg = p.cfg();
  const sub = fieldById(cfg, "rightMode", "project_sub");
  assert.ok(sub, "ссылка: дочерний Field ссылки пережил migrateConfig — "
    + "именно его выбрасывал ensureBehaviorModesFromOrder, и значение исчезало");
  assert.deepEqual((sub.values as Any[]).map((v: Any) => v.token), ["ProjectX"],
    "ссылка: дочернее значение лежит в дочернем Field");
  assert.deepEqual((sub.values as Any[])[0].allowedParentValues, ["ClientA"],
    "ссылка: и знает, под каким родителем показываться");
  assert.equal(String(sub.dependsOn || ""), "project",
    "ссылка: дочерний Field зависит от родителя");
  assert.equal(String(sub.source || ""), "wikilinks:project_sub",
    "ссылка: и остаётся ссылкой, а не тегом");
  ok("ссылка: дочерний Field переживает migrateConfig");
}

{
  const p = makePanel(baseConfig(), "project");
  levelArrow(all(p.host, "io-vals__row")[1] as StubNode).click();

  const after = all(p.host, "io-vals__row");
  assert.equal(after.length, 2, "ссылка: значение не исчезло — строк по-прежнему две");
  assert.ok((after[1] as StubNode).classList.contains("io-vals__row--child"),
    "ссылка: второе значение стало дочерним");
  assert.equal(String(one(after[1] as StubNode, "io-valcell").children[0]?.value || ""),
    "[[ProjectX]]", "ссылка: и это то же значение, что было");
  ok("ссылка: стрелка Level делает значение дочерним, а не удаляет его");
}

{
  /* Обратный ход: значение возвращается наверх и не теряется по дороге. */
  const p = makePanel(baseConfig(), "project");
  levelArrow(all(p.host, "io-vals__row")[1] as StubNode).click();
  const back = all(p.host, "io-vals__row")[1] as StubNode;
  assert.equal(String(levelArrow(back).textContent || "").trim(), "←",
    "ссылка: у дочернего значения стрелка ведёт обратно");
  levelArrow(back).click();
  const rows = all(p.host, "io-vals__row");
  assert.equal(rows.length, 2, "ссылка: значение вернулось наверх");
  assert.ok(!(rows[1] as StubNode).classList.contains("io-vals__row--child"),
    "ссылка: и дочерним больше не считается");
  ok("ссылка: значение возвращается на верхний уровень через настоящую запись");
}

{
  /*
   * Вторая запись подряд по тому же Field. Миграция идёт на каждом патче, и
   * одного лишнего её прогона достаточно, чтобы потеря вернулась незаметно.
   */
  const p = makePanel(baseConfig(), "project");
  levelArrow(all(p.host, "io-vals__row")[1] as StubNode).click();
  const prefix = (all(p.host, "io-vals__row")[0] as StubNode).children
    .find(c => String(c.getAttribute("aria-label") || "").startsWith("Prefix for")) as StubNode;
  assert.ok(prefix, "у значения ссылки есть Prefix");
  prefix.value = "[x]";
  prefix.dispatch("change");
  const sub = fieldById(p.cfg(), "rightMode", "project_sub");
  assert.ok(sub, "ссылка: дочерний Field на месте и после второй записи");
  assert.deepEqual((sub.values as Any[]).map((v: Any) => v.token), ["ProjectX"],
    "ссылка: и значение в нём то же");
  ok("ссылка: дочерний Field переживает вторую запись подряд");
}

/* ======================================================================
 * Предусловие Field (10.13.4) на настоящем пути записи.
 * ====================================================================== */

{
  /*
   * Предусловие ложится в конфиг двумя ключами самого Field — `dependsOn` и
   * `enabledForParentValues`. Оба обязаны пережить `migrateConfig`: он идёт на
   * каждом патче, и ровно на этом месте уже терялся дочерний Field ссылки.
   */
  const p = makePanel(baseConfig(), "project");
  const set = p.store.getSnapshot();
  const before = (set.pkm.behavior.rightMode.fields as Any[]).find((f: Any) => f.id === "project");
  assert.ok(before, "ссылка на месте");

  p.store.patch({
    pkm: {
      behavior: {
        rightMode: {
          fields: (set.pkm.behavior.rightMode.fields as Any[]).map((f: Any) =>
            (f.id === "project" ? { ...f, dependsOn: "status", enabledForParentValues: ["#todo"] } : f)),
        },
      },
    },
  }, "pkm:behavior:order:prerequisite:project");

  const after = p.cfg();
  const field = (after.pkm.behavior.rightMode.fields as Any[]).find((f: Any) => f.id === "project");
  assert.ok(field, "ссылка не потерялась");
  assert.equal(field.dependsOn, "status", "`dependsOn` пережил migrateConfig");
  assert.deepEqual(field.enabledForParentValues, ["#todo"],
    "и список значений вместе с ним");
  ok("предусловие: оба ключа переживают настоящий путь записи");
}

/* ======================================================================
 * Удаление Field с дочерним Field — вторая половина той же правки.
 *
 * Дочерний Field тега лежит в `leftMode`, дочерний Field ссылки — в
 * `rightMode`: списки определений делятся по типу, а не по Block. Поэтому
 * удаление снимает дочернего с ОБЕИХ сторон. Проверен был только тег, и
 * половина правки стояла без проверки.
 * ====================================================================== */

{
  /* Ссылка с дочерним Field: сначала он должен появиться. */
  const p = makePanel(baseConfig(), "project");
  levelArrow(all(p.host, "io-vals__row")[1] as StubNode).click();
  assert.ok(fieldById(p.cfg(), "rightMode", "project_sub"), "дочерний Field ссылки есть");

  p.writes.length = 0;
  p.model().deleteField("project");

  const cfg = p.cfg();
  assert.equal(fieldById(cfg, "rightMode", "project"), null, "ссылка удалена");
  assert.equal(fieldById(cfg, "rightMode", "project_sub"), null,
    "и дочерний Field ушёл вместе с ней, а не остался сиротой в rightMode");
  assert.ok(!(cfg.pkm.behavior.order.right as string[]).includes("project"),
    "ключ ссылки убран из Right Block — этим и уносится дочерний");

  /*
   * Что здесь на самом деле держит гарантию — выяснено мутацией, а не
   * прочитано по коду.
   *
   * `deleteField` сначала пишет патч Order, и уже он уносит дочерний Field:
   * `ensureBehaviorModesFromOrder` держит `<name>_sub` только пока ключ
   * родителя стоит в Order. К моменту, когда модель собирает второй патч,
   * `rightMode` в конфиге пуст — отсев дочернего по правой стороне внутри
   * модели до дела не доходит вовсе.
   *
   * Поэтому пин стоит на итоге и на связке «ключ ушёл из Order → дочернего
   * нет», а не на патче модели: патч этого не показывает, и проверка на нём
   * зеленела бы при любой правке модели. Проверено: с вырезанным отсевом
   * итог тот же.
   */
  const del = p.writes.find(w => w.reason.startsWith("pkm:behavior:delete-field:"));
  assert.ok(del, "патч удаления написан");
  assert.deepEqual((del.patch.pkm.behavior.rightMode.fields as Any[]).map((f: Any) => String(f && f.id || "")), [],
    "и правый список в нём уже пуст: дочернего убрал патч Order до него");
  ok("удаление ссылки уносит её дочерний Field (правая сторона)");
}

{
  /* Тот же путь у тега — контрольный случай, он и был покрыт. */
  const p = makePanel(baseConfig(), "status");
  levelArrow(all(p.host, "io-vals__row")[1] as StubNode).click();
  assert.ok(fieldById(p.cfg(), "leftMode", "status_sub"), "дочерний Field тега есть");

  p.model().deleteField("status");

  const cfg = p.cfg();
  assert.equal(fieldById(cfg, "leftMode", "status"), null, "тег удалён");
  assert.equal(fieldById(cfg, "leftMode", "status_sub"), null,
    "и дочерний Field ушёл вместе с ним");
  ok("удаление тега уносит его дочерний Field (левая сторона)");
}

{
  /*
   * Удаление ссылки, которую ждёт другой Field: предусловие снимается, иначе
   * `reconcileModeDependencies` выключит ждущего молча (Н28). Здесь это
   * проверяется на настоящем пути записи, а не на снимке патча.
   */
  const p = makePanel(baseConfig(), "status");
  const snap = p.store.getSnapshot();
  p.store.patch({
    pkm: {
      behavior: {
        rightMode: {
          fields: (snap.pkm.behavior.rightMode.fields as Any[]).map((f: Any) =>
            (f.id === "project" ? { ...f, dependsOn: "status", enabledForParentValues: ["#todo"] } : f)),
        },
      },
    },
  }, "pkm:behavior:order:prerequisite:project");
  assert.equal(fieldById(p.cfg(), "rightMode", "project").dependsOn, "status", "предусловие стоит");

  p.model().deleteField("status");

  const link = fieldById(p.cfg(), "rightMode", "project");
  assert.ok(link, "ссылка осталась: удаляли не её");
  assert.equal(String(link.dependsOn || ""), "",
    "а предусловие на удалённый тег снято");
  assert.ok(!link.enabledForParentValues || !link.enabledForParentValues.length,
    "и список значений вместе с ним: без `dependsOn` рантайм его не читает");
  ok("удаление Field снимает чужое предусловие на него — на настоящем пути записи");
}

console.log("\n" + passed + " проверок пройдено");



