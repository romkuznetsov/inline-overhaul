/**
 * Custom block — свой tagWheel у каретки (PRD 10.13.260).
 *
 * **Что проверяется.** Весь путь, по которому блок живёт: конфиг проезжает
 * настоящую миграцию (У-2) и не теряет блок ни в одном из фильтров Order
 * (У-237); Left и Right получают правила без Field блока, а панель блока —
 * только их (пункт 13 постановки); команды и сама панель — ниже, своими
 * разделами.
 *
 * **Ожидания выписаны литералами** (У-5): ключи, имена и строки стоят здесь, а
 * не берутся из того, что проверяется.
 */

import assert from "node:assert/strict";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import rulesShape from "../../src/core/pkm_rules_shape.js";
import registryModule from "../../src/features/command_registry.js";
import orderConfigModule from "../../src/core/pkm_order_config.js";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;

const internals = loadPluginInternals();
const shape = rulesShape as unknown as {
  buildRulesForEngines: (cfg: Any, blockId?: string) => Any;
};

const registry = registryModule as unknown as { buildPkmCommandDefs: (...a: Any[]) => Any[] };
const orderConfig = orderConfigModule as unknown as { serializeDateRuntimeConfigForMacro: (cfg: Any) => string };

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/** Конфиг с тремя Field: `Type` слева, `Due` справа, `Mood` в блоке `b1`. */
function configWithBlock(): Any {
  const raw = internals.migrateConfig({});
  raw.pkm.fields.order = {
    left: ["Type"],
    right: ["Due"],
    types: { Type: "tag", Due: "element", Mood: "tag" },
    labels: { Type: "Type", Due: "Due", Mood: "Mood" },
    strictNames: { Type: "Type", Due: "Due", Mood: "Mood" },
    custom: [{ id: "b1", name: "Custom block 1", keys: ["Mood"] }],
  };
  raw.pkm.fields.tags = { fields: [
    { id: "Type", prefix: "#", placeholder: "Type", values: [{ id: "todo", token: "todo" }] },
    { id: "Mood", prefix: "#", placeholder: "Mood", values: [{ id: "calm", token: "calm" }, { id: "busy", token: "busy" }] },
  ] };
  return internals.migrateConfig(raw);
}

/** Определения команд PKM тем же реестром, которым их заводит плагин. */
function pkmDefs(cfg: Any): Any[] {
  return registry.buildPkmCommandDefs(
    internals.serializePkmOrderForMacro, orderConfig.serializeDateRuntimeConfigForMacro,
    internals.normalizePkmOrder, cfg, ["navigation", "pkm", "transform"]);
}

const ids = (mode: Any): string[] => (mode && Array.isArray(mode.fields) ? mode.fields : []).map((f: Any) => f.id);

async function run(): Promise<void> {
  console.log("Custom block (PRD 10.13.260)");

  /* ---- 1. Order: блок переживает миграцию и все фильтры --------------- */
  {
    const cfg = configWithBlock();
    const order = cfg.pkm.fields.order;
    assert.deepEqual(order.custom, [{ id: "b1", name: "Custom block 1", keys: ["Mood"] }],
      "блок потерялся на пути через migrateConfig");
    assert.ok(!order.right.includes("Mood"),
      "ключ блока дописан в правый Block: normalizePkmOrder не считает его размещённым");
    assert.ok(ids(cfg.pkm.fields.tags).includes("Mood"),
      "определение Field блока выброшено ensureBehaviorModesFromOrder");
    const again = internals.migrateConfig(JSON.parse(JSON.stringify(cfg)));
    assert.deepEqual(again.pkm.fields.order.custom, order.custom, "второй проход миграции меняет блок");
    ok("блок проезжает migrateConfig дважды, ключ не уезжает в right");
  }

  /* ---- 2. Один Field — один блок; имя и id без повторов ---------------- */
  {
    const out = internals.normalizePkmOrder({
      left: ["A"], right: [], labels: { A: "A", B: "B", C: "C" },
      custom: [
        { id: "b1", name: "One", keys: ["A", "B", "B_sub"] },
        { id: "b1", name: "Dup id", keys: ["C"] },
        { id: "b2", name: "one", keys: ["C"] },
        { id: "b3", name: "  ", keys: ["C"] },
        { id: "b4", name: "Two", keys: ["B", "C"] },
      ],
    });
    assert.deepEqual(out.custom, [
      { id: "b1", name: "One", keys: ["B"] },
      { id: "b4", name: "Two", keys: ["C"] },
    ]);
    assert.deepEqual(out.left, ["A"]);
    assert.deepEqual(out.right, [], "ключи блоков дописаны в right");
    ok("ключ Left сильнее блока, повтор id и имени отброшен, пустое имя отброшено");
  }

  /* ---- 3. Free снят: `full` уходит в `off` ---------------------------- */
  {
    const out = internals.normalizePkmOrder({ left: ["A", "B"], freeRoam: { A: "full", B: "minimal" } });
    assert.equal(out.freeRoam.A, "off", "Free остался в нормализации");
    assert.equal(out.freeRoam.B, "minimal", "Insert only потерялся вместе с Free");
    ok("Behavior сужен до Strict и Insert only");
  }

  /* ---- 4. Left и Right не видят Field блока, блок видит только свои --- */
  {
    const cfg = configWithBlock();
    const lr = shape.buildRulesForEngines(cfg);
    assert.ok(!ids(lr.leftMode).includes("Mood") && !ids(lr.leftMode).includes("Mood_sub"),
      "Field блока доехал до правил Left/Right");
    assert.ok(ids(lr.leftMode).includes("Type"), "положительный контроль: Field Left выброшен тоже");
    assert.equal(lr.behavior.order.custom, undefined, "порядок Left/Right несёт блоки");
    assert.equal(lr.behavior.order.labels.Mood, undefined, "подпись Field блока осталась в порядке Left/Right");
    const block = shape.buildRulesForEngines(cfg, "b1");
    assert.deepEqual(ids(block.leftMode).filter(id => !/_sub$/.test(id)), ["Mood"], "в правилах блока чужие Field");
    assert.deepEqual(ids(block.rightMode), [], "в правилах блока Field правого Block");
    assert.deepEqual(block.behavior.order.left, ["Mood"], "порядок блока не записан левым Block");
    assert.deepEqual(block.behavior.order.right, []);
    assert.equal(block.behavior.order.labels.Mood, "Mood", "подпись своего Field блок потерял");
    const macro = JSON.parse(internals.serializePkmOrderForMacro(cfg));
    assert.equal(macro.custom, undefined, "порядок для движков несёт блоки");
    assert.equal(macro.types.Mood, undefined, "порядок для движков знает Field блока");
    ok("правила Left/Right без Field блока, правила блока — только его Field");
  }

  /* ---- 5. Без блоков правила те же, что до custom block --------------- */
  {
    const cfg = configWithBlock();
    cfg.pkm.fields.order.custom = [];
    const before = JSON.stringify(cfg.pkm.fields.order);
    const lr = shape.buildRulesForEngines(cfg);
    assert.equal(JSON.stringify(lr.behavior.order), before, "без блоков порядок в правилах переписан");
    ok("без блоков порядок в правилах знак в знак прежний");
  }

  /* ---- 6. Команды: у блока своя, у Field блока — пара по месту каретки -- */
  {
    const cfg = configWithBlock();
    const defs = pkmDefs(cfg);
    const block = defs.find((d: Any) => d.id === "open-tagwheel-custom-b1");
    assert.ok(block, "у блока нет команды open-tagwheel-custom-b1");
    assert.equal(block.name, "tagWheel Custom block 1");
    const s = block.makeSettings(cfg);
    assert.equal(s["Custom block"], "b1", "команда блока не говорит, какой блок открыть");
    assert.deepEqual(ids(s["Rules data"].leftMode).filter((id: string) => !/_sub$/.test(id)), ["Mood"],
      "панель блока получила чужие правила");
    assert.deepEqual(JSON.parse(s["Order config"]).left, ["Mood"], "порядок панели блока — не её Block");
    assert.deepEqual(s["Custom blocks"].map((b: Any) => b.id), ["b1"], "Tab не знает соседних блоков");
    assert.ok(!ids(s["Line rules data"].leftMode).includes("Mood") && ids(s["Line rules data"].leftMode).includes("Type"),
      "правила Left/Right для Hide не те");
    const mood = defs.filter((d: Any) => d.orderKey === "Mood");
    assert.deepEqual(mood.map((d: Any) => d.v2Command), ["tagWheel", "tagWheel"],
      "пара Field блока ушла в движок Left/Right, который Field блока не видит");
    assert.deepEqual(JSON.parse(mood[0].makeSettings(cfg)["Custom cycle"]), { key: "Mood", direction: "increase" });
    const type = defs.filter((d: Any) => d.orderKey === "Type");
    assert.deepEqual(type.map((d: Any) => d.v2Command), ["statusTags", "statusTags"],
      "положительный контроль: пара Field Left ушла не туда");
    ok("у блока команда tagWheel <имя>, пара Field блока идёт в панель блока со своими правилами");
  }

  /* ---- 7. Регистрация: переименование — то же id, удаление — снятие ----- */
  {
    const cfg = configWithBlock();
    const added: Array<[string, string]> = [];
    const removed: string[] = [];
    const plugin: Any = {
      getConfig: () => cfg,
      addCommand: (c: Any) => { added.push([c.id, c.name]); },
      removeCommand: (id: string) => { removed.push(id); },
    };
    internals.registerPkm(plugin);
    assert.ok(added.some(([id, name]) => id === "open-tagwheel-custom-b1" && name === "Tags & PKM: tagWheel Custom block 1"));
    added.length = 0;
    internals.registerPkm(plugin);
    assert.deepEqual(added, [], "повторная регистрация без изменений заводит команды заново");
    cfg.pkm.fields.order.custom[0].name = "Inbox";
    internals.registerPkm(plugin);
    assert.deepEqual(added, [["open-tagwheel-custom-b1", "Tags & PKM: tagWheel Inbox"]],
      "переименование блока не перезавело команду с тем же id");
    assert.deepEqual(removed, ["open-tagwheel-custom-b1"], "старое имя осталось в палитре");
    removed.length = 0;
    cfg.pkm.fields.order.custom = [];
    internals.registerPkm(plugin);
    assert.ok(removed.includes("open-tagwheel-custom-b1"), "удалённый блок оставил команду");
    ok("переименование перезаводит команду с тем же id, удаление снимает её");
  }

  console.log(passed + " проверок пройдено");
}

run().catch((e) => { console.error(e); process.exit(1); });
