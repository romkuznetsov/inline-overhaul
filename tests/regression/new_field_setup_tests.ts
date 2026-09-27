/**
 * Окно `Add a Field` задаёт главное сразу (его заказ 2026-09-27): Block, Values
 * с цветом, вид значения Element. Проверяется запись **модели** на настоящем
 * хранилище и `migrateConfig`, тем же путём, что у панели (правило 2): что
 * человек увидит в конфиге после одного нажатия `Add`.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { createFieldsModel } from "../../src/ui/settings/custom/fields_model.ts";
import * as deepStateModule from "../../src/core/order_deep_editor_state.js";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = createRequire(import.meta.url);
const shared = requireCjs(path.join(root, "src", "core", "shared_utils.js"));
const { ConfigStore } = requireCjs(path.join(root, "src", "core", "config_store.js"));
const internals = loadPluginInternals();
const deepState = (deepStateModule as { default?: unknown }).default || deepStateModule;

let passed = 0;
const ok = (label: string): void => { passed++; console.log("  ok " + label); };

function base(): Any {
  return {
    pkm: {
      fields: {
        order: {
          left: ["status"], right: [], labels: { status: "Status" }, strictNames: { status: "status" },
          types: { status: "tag" }, active: { status: "yes" }, freeRoam: { status: "off" }, enabled: { status: true },
        },
        tags: { fields: [{ id: "status", prefix: "#", values: [{ token: "todo", active: true }] }] },
      },
    },
  };
}

function panel(): { model: () => Any; cfg: () => Any } {
  const b = base();
  const store = new ConfigStore(
    { loadData: async () => b, saveData: async () => {} },
    { defaults: internals.migrateConfig(b), cloneJson: shared.cloneJson, isObj: shared.isObj, deepMerge: shared.deepMerge, migrateConfig: internals.migrateConfig, Notice: class {} },
  );
  const plugin = { getConfig: () => store.getSnapshot(), setConfigPatch: (patch: Any, reason: string) => store.patch(patch, reason) };
  const model = (): Any => createFieldsModel({
    plugin: plugin as never, normalizePkmOrder: internals.normalizePkmOrder as never, pkmOrderFields: [],
    cfg: plugin.getConfig() as never, deepState: deepState as never,
  });
  return { model, cfg: () => store.getSnapshot() };
}

/* Тег: Block, два Values, цвет у одного. */
{
  const p = panel();
  const m = p.model();
  const res = m.addField("mood", "tag");
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(m.configureNewField("mood", { side: "left", values: [{ token: "calm", fill: "#44aa66" }, { token: "#busy" }] }).ok, true);
  const cfg = p.cfg();
  assert.ok(cfg.pkm.fields.order.left.includes("mood"), "Field не в левом Block: " + JSON.stringify(cfg.pkm.fields.order));
  assert.ok(!cfg.pkm.fields.order.right.includes("mood"), "Field остался и в правом Block");
  const f = cfg.pkm.fields.tags.fields.find((x: Any) => x.id === "mood");
  const tokens = f.values.map((v: Any) => String(v.token || v).replace(/^#/, "")).filter(Boolean);
  assert.deepEqual(tokens, ["calm", "busy"], "Values не те: " + JSON.stringify(f.values));
  const byTag = cfg.visual.tags.byTag.mood;
  const colored = Object.keys(byTag).find((t) => t.replace(/^#/, "") === "calm");
  assert.ok(colored && byTag[colored].fillColor === "#44aa66", "цвет Value не записан: " + JSON.stringify(byTag));
  assert.ok(!Object.keys(byTag).some((t) => t.replace(/^#/, "") === "busy"), "отрицательный контроль: цвет без выбора не пишется");
  ok("Tag: Block, Values и цвет одним нажатием");
}

/* Ссылка: Values — заметки, Block по умолчанию правый. */
{
  const p = panel();
  const m = p.model();
  assert.equal(m.addField("client", "wikilink").ok, true);
  assert.equal(m.configureNewField("client", { values: [{ token: "[[Acme]]" }, { token: "Work/Globex" }] }).ok, true);
  const cfg = p.cfg();
  assert.ok(cfg.pkm.fields.order.right.includes("client"), "Field ссылки не в правом Block");
  const all = JSON.stringify([cfg.pkm.fields.tags.fields, cfg.pkm.fields.links && cfg.pkm.fields.links.fields]);
  assert.ok(all.includes("Acme") && all.includes("Work/Globex"), "Values ссылки не записаны: " + all);
  ok("Link: Values-заметки, Block справа");
}

/* Element: вид значения выбирает формат и способ шага. */
/* «Шаг на величину» конфиг хранит словом `standard` — так записан и его `Due`. */
for (const [preset, format, mode] of [["datetime", "YYYY-MM-DD HH:mm", "command"], ["date", "YYYY-MM-DD", "standard"], ["list", "", "custom"]] as const) {
  const p = panel();
  const m = p.model();
  assert.equal(m.addField("when_" + preset, "element", "⏰").ok, true);
  m.configureNewField("when_" + preset, { element: { preset, format, customRaw: "low\nmid\nhigh" } });
  const row = p.cfg().pkm.fields.elements.byField["when_" + preset];
  assert.equal(row.emoji, "⏰", "знак потерян");
  assert.equal(row.format, format, preset + ": формат не записан");
  assert.equal(row.increment.mode, mode, preset + ": способ шага " + JSON.stringify(row.increment));
  if (preset === "datetime") assert.equal(row.increment.command, "now");
  if (preset === "list") assert.deepEqual(row.increment.customRaw, ["low", "mid", "high"]);
  ok("Element " + preset + ": формат " + JSON.stringify(format) + ", шаг " + mode);
}

/* Имя: то же правило, что у заведения. */
{
  const m = panel().model();
  assert.equal(m.fieldNameError("mood"), "", "законное имя названо ошибкой");
  assert.notEqual(m.fieldNameError("status"), "", "занятое имя не узнано");
  assert.notEqual(m.fieldNameError("mood_sub"), "", "имя с `_sub` не узнано");
  ok("имя проверяется до нажатия тем же правилом");
}

console.log(passed + " проверок");
