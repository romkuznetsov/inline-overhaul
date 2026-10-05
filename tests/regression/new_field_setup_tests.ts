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
  assert.equal(m.configureNewField("mood", { side: "left", values: [{ token: "calm", fill: "#44aa66", text: "#112233" }, { token: "#busy" }], property: "mood" }).ok, true);
  const cfg = p.cfg();
  assert.ok(cfg.pkm.fields.order.left.includes("mood"), "Field не в левом Block: " + JSON.stringify(cfg.pkm.fields.order));
  assert.ok(!cfg.pkm.fields.order.right.includes("mood"), "Field остался и в правом Block");
  const f = cfg.pkm.fields.tags.fields.find((x: Any) => x.id === "mood");
  const tokens = f.values.map((v: Any) => String(v.token || v).replace(/^#/, "")).filter(Boolean);
  assert.deepEqual(tokens, ["calm", "busy"], "Values не те: " + JSON.stringify(f.values));
  const byTag = cfg.visual.tags.byTag.mood;
  const colored = Object.keys(byTag).find((t) => t.replace(/^#/, "") === "calm");
  assert.ok(colored && byTag[colored].fillColor === "#44aa66", "цвет Value не записан: " + JSON.stringify(byTag));
  assert.equal(byTag[colored!].textColor, "#112233", "цвет текста Value не записан (его замечание к тесту 3 цикла 98)");
  assert.equal(cfg.pkm.fields.order.propertiesByField.mood, "mood", "свойство YAML не записано");
  assert.ok(!Object.keys(byTag).some((t) => t.replace(/^#/, "") === "busy"), "отрицательный контроль: цвет без выбора не пишется");
  ok("Tag: Block, Values, заливка и цвет текста, свойство YAML одним нажатием");
}

/* Ссылка: Values — заметки, Block по умолчанию правый. */
{
  const p = panel();
  const m = p.model();
  assert.equal(m.addField("client", "wikilink").ok, true);
  assert.equal(m.configureNewField("client", { values: [{ token: "[[Acme]]" }, { token: "Work/Globex" }], moc: false }).ok, true);
  const cfg = p.cfg();
  assert.equal(cfg.pkm.fields.order.useAsMoc && cfg.pkm.fields.order.useAsMoc.client, false,
    "`Use as MOC: No` не дожил до конфига после migrateConfig: " + JSON.stringify(cfg.pkm.fields.order.useAsMoc));
  assert.equal(p.model().getUseAsMoc("client"), false, "модель не читает `Use as MOC`");
  assert.equal(p.model().getUseAsMoc("status"), true, "нет ключа — MOC, как было");
  assert.ok(cfg.pkm.fields.order.right.includes("client"), "Field ссылки не в правом Block");
  const all = JSON.stringify([cfg.pkm.fields.tags.fields, cfg.pkm.fields.links && cfg.pkm.fields.links.fields]);
  assert.ok(all.includes("Acme") && all.includes("Work/Globex"), "Values ссылки не записаны: " + all);
  ok("Link: Values-заметки, Block справа");
}

/* Element: способ шага, формат и шаг (его замечание: «не хватает настройки шага инкремента»). */
/* «Шаг на величину» конфиг хранит словом `standard` — так записан и его `Due`. */
for (const [id, element, mode, extra] of [
  ["now", { mode: "command", command: "now", format: "YYYY-MM-DD HH:mm" }, "command", { command: "now" }],
  ["date", { mode: "increment", incrementBy: 7, format: "YYYY-MM-DD" }, "standard", { incrementBy: 7 }],
  ["id", { mode: "command", command: "randomE", format: "0000" }, "command", { command: "randomE" }],
] as const) {
  const p = panel();
  const m = p.model();
  assert.equal(m.addField("when_" + id, "element", "⏰").ok, true);
  m.configureNewField("when_" + id, { element });
  const row = p.cfg().pkm.fields.elements.byField["when_" + id];
  assert.equal(row.emoji, "⏰", "знак потерян");
  assert.equal(row.format, element.format, id + ": формат не записан");
  assert.equal(row.increment.mode, mode, id + ": способ шага " + JSON.stringify(row.increment));
  for (const [k, v] of Object.entries(extra)) assert.equal(row.increment[k], v, id + ": " + k + " " + JSON.stringify(row.increment));
  /* C12 перечня 2026-09-30: в YAML без знака, как стартовый Due. */
  const linkDef = (p.cfg().pkm.fields.links.fields as Any[]).concat(p.cfg().pkm.fields.tags.fields).find((f: Any) => f.id === "when_" + id);
  assert.equal(linkDef && linkDef.yamlValueRule, "clean", id + ": правило YAML не Clean: " + JSON.stringify(linkDef));
  ok("Element " + id + ": формат " + JSON.stringify(element.format) + ", шаг " + mode + " " + JSON.stringify(extra));
}

/* `В-247`: Element-список — без знака; Values строками, определение среди тегов. */
{
  const p = panel();
  const m = p.model();
  const res = m.addField("mood", "element");
  assert.equal(res.ok, true, "Element без знака не заводится: " + JSON.stringify(res));
  m.configureNewField("mood", { side: "left", element: { mode: "list", format: "", list: ["\u{1F642}‍↕️yes", "\u{1F4A1}"] } });
  const cfg = p.cfg();
  const row = cfg.pkm.fields.elements.byField.mood;
  assert.deepEqual([row.increment.mode, row.list], ["list", ["\u{1F642}‍↕️yes", "\u{1F4A1}"]], "режим и Values списка не записаны: " + JSON.stringify(row));
  const def = cfg.pkm.fields.tags.fields.find((f: Any) => f.id === "mood");
  assert.ok(def && def.prefix === "" && def.values.map((v: Any) => v.token).join(" ") === "\u{1F642}‍↕️yes \u{1F4A1}", "определение для движков не среди тегов: " + JSON.stringify(def));
  assert.ok(cfg.pkm.fields.order.left.includes("mood"), "Block не записан");
  assert.equal(def.yamlValueRule, undefined, "у списка знак — само значение, своего правила YAML нет: " + JSON.stringify(def));
  ok("Element-список: без знака, Values строками, определение среди тегов");
}

/* Его `💬` к тесту 5 цикла 135: первое дочернее Value — `Child Field` = `After parent`, а не `Hide`. */
{
  const p = panel();
  assert.equal(p.model().addField("mood", "tag").ok, true);
  assert.equal(p.model().configureNewField("mood", { side: "left", values: [{ token: "calm" }, { token: "busy" }, { token: "late" }] }).ok, true);
  assert.equal(p.model().getSubMode("mood_sub"), "hide", "новый Field без дочерних — Hide, как было");
  const child = (token: string): void => {
    const ed = p.model().valuesEditor("mood");
    const row = ed.tree.find((r: Any) => String(r.token).replace(/^#/, "") === token);
    assert.equal(ed.saveTree(ed.toggleLevel(ed.tree, { level: 0, token: row.token }), "test:child").ok, true);
  };
  child("busy");
  assert.equal(p.model().getSubMode("mood_sub"), "after-parent", "первое дочернее Value оставило Child Field в Hide");
  p.model().setSubMode("mood_sub", "hide");
  child("late");
  assert.equal(p.model().getSubMode("mood_sub"), "hide", "отрицательный контроль: второе дочернее Value перебило выбор человека");
  ok("первое дочернее Value включает Child Field в After parent, выбор человека потом не трогается");
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
