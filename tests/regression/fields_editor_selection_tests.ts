/**
 * Выбранный Field переживает пересборку вкладки (его замечание 2026-09-25:
 * «при добавлении нового value в io-values меня перебрасывает в первый field в
 * Order»).
 *
 * Причина была в двух местах, и закреплены оба:
 *
 *   1. с 10.13.260 списки `Left/Right Block active Field` стоят на той же
 *      вкладке, что редактор Fields, и **любая** запись в `pkm.fields` просила
 *      пересборку вкладки — платформа рисовала редактор заново;
 *   2. выбор жил в замыкании блока, и новый блок начинал с первого Field.
 *
 * Первое спрошено у панели на настоящем хранилище (как в
 * `live_preview_wake_tests.ts`), второе — у самого блока, отрисованного дважды
 * с той же платформой: так его рисует пересборка.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals, Setting, Notice, Modal } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { SCHEMA, TABS } from "../../src/ui/settings/schema/index.ts";
import { SettingsPane } from "../../src/ui/settings/settings_tab.ts";
import { ConfigStoreAdapter } from "../../src/ui/settings/store.ts";
import { createFieldsModel } from "../../src/ui/settings/custom/fields_model.ts";
import { fieldsEditor } from "../../src/ui/settings/custom/fields_editor.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";
import type { SettingsCtx } from "../../src/ui/settings/types.ts";
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

function all(node: StubNode, cls: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (n.classList.contains(cls)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

/** Настоящие хранилище, миграция и модель; фикстура — не рукописный конфиг. */
function makeWorld(): { plugin: Any; store: Any; platform: Any } {
  const raw = JSON.parse(fs.readFileSync(
    path.join(root, "tests", "fixtures", "config_v1_realistic.json"), "utf8")) as Any;
  const base = internals.migrateConfig(raw);
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
  const plugin = {
    app: { workspace: {}, vault: {} },
    getConfig: () => store.getSnapshot(),
    setConfigPatch: (patch: Any, reason: string) => { store.patch(patch, reason || "settings"); },
  };
  const platform = {
    Setting, Notice, Modal,
    setIcon: () => {},
    plugin,
    getConfig: () => store.getSnapshot() as Record<string, unknown>,
    normalizePkmOrder: internals.normalizePkmOrder as never,
    pkmOrderFields: [] as string[],
  };
  return { plugin, store, platform };
}

const modelOf = (w: { plugin: Any }): Any => createFieldsModel({
  plugin: w.plugin as never,
  normalizePkmOrder: internals.normalizePkmOrder as never,
  pkmOrderFields: [],
  cfg: w.plugin.getConfig() as never,
  deepState: deepState as never,
});

/* ---- 1: Value в Field не пересобирает вкладку, имя Field — пересобирает -- */

{
  const w = makeWorld();
  let rebuilds = 0;
  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store: new ConfigStoreAdapter({
      getConfig: () => w.store.config as Record<string, unknown>,
      update: (mutator, reason, opts) => w.store.update(
        (cfg: Any) => { mutator(cfg); return cfg; }, reason, opts,
      ),
      subscribe: listener => w.store.subscribe(listener),
    }),
    actions: {},
    fragments: { createFragment: () => makeNode("fragment") } as never,
    platform: w.platform as never,
    rebuild: () => { rebuilds++; },
  });
  pane.setActiveTab("pkm" as never);
  pane.getSettingDefinitions();

  const model = modelOf(w);
  const row = model.listFields().find((r: Any) => !r.parent && r.kind === "tag");
  assert.ok(row, "в фикстуре нет Field типа tag — проверять нечего");
  rebuilds = 0;
  const res = model.valuesEditor(row.key).addToken("#ioselnew");
  assert.ok(res.ok, "модель не добавила Value: " + String(res.error || ""));
  /* Контроль шага: запись и правда дошла до хранилища. */
  assert.ok(JSON.stringify(w.store.getSnapshot()).includes("ioselnew"), "Value не записалось");
  assert.equal(rebuilds, 0, "новое Value не меняет список Fields и пересобирать вкладку не должно");

  /* Отрицательный контроль: строгое имя Field стоит в списке, и тут пересборка нужна. */
  const renamed = await modelOf(w).setStrictName(row.key, "IoSelRenamed");
  assert.ok(renamed.ok, "модель не переименовала Field");
  assert.ok(rebuilds > 0, "новое имя Field обязано пересобрать список Left Block active Field");
  ok("вкладку Tags & PKM пересобирает только запись, сменившая список Fields");
}

/* ---- 2: выбор Field переживает новый блок на той же платформе ----------- */

{
  const w = makeWorld();
  const ctx = {
    get: (p: string) => (p === "features.pkm.enabled"),
    set: async () => {},
    run: async () => {},
    watch: () => () => {},
    platform: w.platform,
  } as unknown as SettingsCtx;

  const draw = (): { box: StubNode; close: () => void } => {
    const box = makeNode("div");
    return { box, close: fieldsEditor(box as unknown as El, ctx) };
  };
  const currentName = (box: StubNode): string => {
    const item = all(box, "io-fields__item").find(n => n.getAttribute("aria-current") === "true");
    return String(item ? all(item, "io-fields__pick")[0]?.textContent || "" : "");
  };

  const first = draw();
  const picks = all(first.box, "io-fields__pick");
  assert.ok(picks.length >= 2, "в фикстуре меньше двух Fields — выбирать не из чего");
  const was = currentName(first.box);
  (picks[picks.length - 1] as StubNode).click();
  const chosen = currentName(first.box);
  /* Контроль шага: нажатие сменило выбор (У-152). */
  assert.notEqual(chosen, was, "нажатие не сменило выбранный Field");
  first.close();

  const again = draw();
  assert.equal(currentName(again.box), chosen,
    "блок, нарисованный заново, вернулся к первому Field");
  again.close();
  ok("выбранный Field переживает пересборку вкладки");
}

console.log("\n" + passed + " проверок пройдено");
