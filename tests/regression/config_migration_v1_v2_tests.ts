/**
 * Миграция конфига v1 → v2 (МГ1–МГ6, PRD 8.1, 8.1а, 8.2, 8.3).
 *
 * Откуда берётся фикстура. Не из руками написанного объекта: `data.json`
 * пользователя — это не то, что он набрал в панели, а то, что оставил после
 * себя `migrateConfig` плагина. Он нормализует половину веток (`subtagFormat`
 * «inline» становится «separate», подвкладка «bars» — «tags», строка Binder
 * получает пересобранный `commandId`) и досыпает все ветки `DEFAULT_CONFIG`.
 * Поэтому проверка **зовёт ту функцию, с которой работа начинается**:
 * `tests/fixtures/config_v1.json` сначала проходит настоящий `migrateConfig`
 * из `main.js` (загрузчик `tests/harness/plugin_internals.ts`), и только его
 * результат уезжает в `migrate`.
 *
 * Главная проверка здесь — не список путей, а обход. Каждый лист конфига v1
 * ищет себе место в v2: переехал, остался, удалён или лежит в `_unmigrated`.
 * Пятого исхода нет. Ветка, которую забыли в карте маршрутов, обязана уронить
 * проверку, а не тихо исчезнуть — именно так теряются данные при миграции.
 *
 * Подделан только vault: МГ4 и МГ6 работают с файлами в папке плагина, и
 * файловая система тут приходит картой в памяти. Логика миграции при этом
 * настоящая — подделка стоит ровно на границе с миром.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import {
  BACKUP_V1_FILE,
  BROKEN_FILE,
  SCHEMA_VERSION_V2,
  backupV1Once,
  loadConfig,
  migrate,
  type MigrateReport,
  type VaultFiles,
} from "../../src/core/config_migration_v2.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const internals = loadPluginInternals();

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

function getIn(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/** Все листья конфига: массив считается листом, внутрь него не спускаемся. */
function leaves(node: unknown, prefix: string, out: string[]): string[] {
  if (isPlainObject(node)) {
    const keys = Object.keys(node);
    if (!keys.length && prefix) out.push(prefix);
    for (const key of keys) leaves(node[key], prefix ? prefix + "." + key : key, out);
    return out;
  }
  if (prefix) out.push(prefix);
  return out;
}

/* ---- карта 8.1, выписанная отдельно от кода миграции -------------------- */

/*
 * Таблица снята с раздела 8.1 PRD, ответа В9 и решений, записанных в 8.1
 * этой же сессией. Она намеренно повторена здесь руками: если бы проверка
 * читала карту маршрутов из самого модуля, она сверяла бы модуль сам с собой.
 *
 * Сравнение идёт по префиксу пути, поэтому непрозрачные ветки (`order`,
 * `byTag`, `binderRows`) описаны одной строкой, а проверяется каждый их лист.
 */
const MOVED: ReadonlyArray<readonly [string, string]> = [
  ["globalFunctions.enhancedSelectAll.enabled", "editor.selectAll.enabled"],
  ["globalFunctions.enhancedSelectAll.mode", "editor.selectAll.mode"],
  ["globalFunctions.enhancedSelectAll.useMultiPressDelay", "editor.selectAll.useDelay"],
  ["globalFunctions.enhancedSelectAll.delayMs", "editor.selectAll.delayMs"],
  ["globalFunctions.enhancedSelectAll.clearSelectionOnLastPress", "editor.selectAll.clearOnLast"],
  ["ui.binderRows", "editor.binder.rows"],

  ["pkm.behavior.order", "pkm.fields.order"],
  ["pkm.behavior.leftMode", "pkm.fields.tags"],
  ["pkm.behavior.rightMode", "pkm.fields.links"],
  ["pkm.behavior.elements", "pkm.fields.elements"],
  ["pkm.taxonomy", "pkm.fields.taxonomy"],
  ["pkm.behavior.projects", "pkm.fields.projects"],
  ["pkm.behavior.typeCheckboxByValue", "pkm.fields.checkboxByValue"],
  ["pkm.behavior.defaultMode", "pkm.fields.defaultBlock"],

  ["pkm.behavior.io.separator1", "pkm.lineFormat.separator1"],
  ["pkm.behavior.io.separator2", "pkm.lineFormat.separator2"],
  ["pkm.behavior.subtagFormat", "pkm.behavior.childTagFormat"],

  ["pkm.behavior.freeRoam.minimalSeparator", "pkm.placement.keepPrefixInsertOnly"],
  ["pkm.behavior.freeRoam.minimalPrefix", "pkm.placement.fieldPrefixInsertOnly"],
  ["pkm.behavior.freeRoam.offPrefix", "pkm.placement.bulletInStrict"],
  ["pkm.behavior.freeRoam.fullPlacement", "pkm.placement.freeInsertPosition"],

  ["pkm.behavior.prefixRules.priorityMode", "pkm.prefixPriority.decideBy"],
  ["pkm.behavior.prefixRules.fieldsOrderMode", "pkm.prefixPriority.fieldOrderSource"],
  ["pkm.behavior.prefixRules.tagSubtagPriority", "pkm.prefixPriority.parentOrChild"],
  ["pkm.behavior.prefixRules.resolver", "pkm.prefixRules.resolver"],
  ["pkm.behavior.prefixRules.priorityTargets", "pkm.prefixRules.priorityTargets"],
  ["pkm.behavior.prefixRules.priorityCheckboxes", "pkm.prefixRules.priorityCheckboxes"],
  ["pkm.behavior.prefixRules.checkboxByFieldValue", "pkm.prefixRules.checkboxByFieldValue"],

  ["pkm.tagWheelConfigPath", "pkm.configNote.path"],
  ["pkm.tagWheelConfigTemplatePath", "pkm.configNote.templatePath"],
  ["pkm.configExportMode", "pkm.configNote.detail"],
  ["pkm.generatedRulesPath", "advanced.generatedRulesPath"],

  ["pkm.behavior.tagVisuals.opacity.left", "visual.tags.opacityLeft"],
  ["pkm.behavior.tagVisuals.opacity.right", "visual.tags.opacityRight"],
  ["pkm.behavior.tagVisuals.tagTextSizePct", "visual.tags.textSizePct"],
  ["pkm.behavior.tagVisuals.tagBubbleWidthPct", "visual.tags.bubbleWidthPct"],
  ["pkm.behavior.tagVisuals.tagBubbleHeightPct", "visual.tags.bubbleHeightPct"],
  ["pkm.behavior.tagVisuals.emptyBubbleSizePct", "visual.tags.emptyBubblePct"],
  ["pkm.behavior.tagVisuals.tagShapePct", "visual.tags.cornersPct"],
  ["pkm.behavior.tagVisuals.byField", "visual.tags.byField"],
  ["pkm.behavior.tagVisuals.byTag", "visual.tags.byTag"],
  ["pkm.behavior.tagVisuals.userTags", "visual.tags.userTags"],
  ["pkm.behavior.tagVisuals.showColorSettings", "viewState.fieldOrder.showColors"],

  ["pkm.behavior.tagVisuals.strip.active", "visual.tagBars.active"],
  ["pkm.behavior.tagVisuals.strip.fieldId", "visual.tagBars.fieldId"],
  ["pkm.behavior.tagVisuals.strip.tagVisibility", "visual.tagBars.tagVisibility"],
  ["pkm.behavior.tagVisuals.strip.hideSeparatorWhenOnlyStripToken", "visual.tagBars.hideSeparatorWhenOnlyStripToken"],
  ["pkm.behavior.tagVisuals.strip.mode", "visual.tagBars.mode"],
  ["pkm.behavior.tagVisuals.strip.stripesToShow", "visual.tagBars.stripesToShow"],
  ["pkm.behavior.tagVisuals.strip.spacing", "visual.tagBars.spacing"],
  ["pkm.behavior.tagVisuals.strip.thickness", "visual.tagBars.thickness"],
  ["pkm.behavior.tagVisuals.strip.childOffset", "visual.tagBars.childOffset"],

  ["pkm.behavior.colors.tagwheelHeader.showPrefix", "visual.tagWheel.showMarkers"],
  ["pkm.behavior.colors.tagwheelHeader.defaultTextColor", "visual.tagWheel.textColor"],
  ["pkm.behavior.colors.tagwheelHeader.fillColor", "visual.tagWheel.fillColor"],
  ["pkm.behavior.tagWheelScroller.enabled", "visual.tagWheel.scroller.enabled"],
  ["pkm.behavior.tagWheelScroller.direction", "visual.tagWheel.scroller.direction"],
  ["pkm.behavior.tagWheelScroller.size", "visual.tagWheel.scroller.size"],

  ["transform.inline2note.templateFolder", "transform.inline2note.templatesFolder"],
  ["transform.inline2note.noteName.explicitNameDelimiters", "transform.inline2note.noteName.delimiters"],
  ["transform.inline2note.noteName.autoWordsCount", "transform.inline2note.noteName.wordCount"],
  ["transform.inline2note.placement.customHeaderText", "transform.inline2note.placement.customHeader"],
  ["transform.inline2note.placement.datetimeHeaderFormat", "transform.inline2note.placement.datetimeFormat"],
  ["transform.inline2note.sourceProcessing.processedToken", "transform.inline2note.sourceProcessing.token"],
  ["transform.inline2note.sourceProcessing.processedTokenPanel", "transform.inline2note.sourceProcessing.panel"],
  ["transform.inline2note.sourceProcessing.replacePayloadWithLink", "transform.inline2note.sourceProcessing.replaceWithLink"],
  ["transform.inline2note.openTransformedNote", "transform.inline2note.openTarget"],
  ["transform.inline2note.sublinesBehavior", "transform.inline2note.sublines"],
  ["transform.inline2note.flyingButton.enabled", "transform.inline2note.floatingButton"],

  ["devMode.enabled", "advanced.devMode.enabled"],
  ["devMode.generateAiLog", "advanced.devMode.aiLog"],
  ["devMode.logPath", "advanced.devMode.logPath"],
  ["devMode.traceTagVisualLine", "advanced.devMode.traceTagVisualLine"],
];

/** Остаются на своём пути. */
const KEPT: readonly string[] = [
  "schemaVersion",
  "features",
  "navigation",
  "pkm.behavior.cycleEndBehavior",
  "pkm.behavior.cursorPolicy",
  "backups",
  "transform.inline2note.enabled",
  "transform.inline2note.outputFolder",
  "transform.inline2note.defaultTemplate",
  "transform.inline2note.yamlNoteFormat",
  "transform.inline2note.smartRules",
  "transform.inline2note.noteName.mode",
  "transform.inline2note.noteName.preferHeaderTitle",
  "transform.inline2note.nameCollision",
  "transform.inline2note.placement.position",
  "transform.inline2note.placement.headerMode",
  "transform.inline2note.preview",
  "transform.inline2note.sourceProcessing.cleanupFieldIds",
  "transform.inline2note.sourceProcessing.visual",
  /* Состояние старой панели: живёт до фазы 3c (8.1). */
  "ui.activeSettingsTab",
  "ui.visualSubTab",
  "ui.hotkeysSubTab",
  "ui.pkmSubTab",
  "ui.orderShowInfoTips",
  "ui.orderShowDeepEditor",
  "ui.orderShowColorSettings",
  "ui.orderActiveCommandsCollapsed",
  /* Уже написано новой панелью в форме v2: спорные проверяются отдельно. */
  "editor",
  "visual.tags",
  "visual.tagBars",
  "visual.tagWheel",
  "general",
  "advanced",
  "viewState",
];

/** Удаляются (8.1, «Удаляются»). */
const DROPPED: readonly string[] = [
  "visual.displayModes",
  "visual.colors",
  "transform.inline2fleet",
  "pkm.executionBackend",
  "meta",
  "rules",
];

/** Единственный перенос, который меняет значение: доля `0..1` → проценты. */
const CAST: Record<string, (v: unknown) => unknown> = {
  "pkm.behavior.tagVisuals.opacity.left": v => Math.round(Number(v) * 100),
  "pkm.behavior.tagVisuals.opacity.right": v => Math.round(Number(v) * 100),
};

function underAny(dotted: string, list: readonly string[]): string | null {
  let best: string | null = null;
  for (const item of list) {
    if (dotted === item || dotted.startsWith(item + ".")) {
      if (!best || item.length > best.length) best = item;
    }
  }
  return best;
}

function movedFor(dotted: string): readonly [string, string] | null {
  let best: readonly [string, string] | null = null;
  for (const pair of MOVED) {
    const from = pair[0];
    if (dotted === from || dotted.startsWith(from + ".")) {
      if (!best || from.length > best[0].length) best = pair;
    }
  }
  return best;
}

/* ---- фикстура ---------------------------------------------------------- */

const fixture = JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "config_v1.json"), "utf8")) as Any;

/* Настоящая нормализация плагина: именно её результат лежит в `data.json`. */
const v1 = internals.migrateConfig(fixture) as Record<string, unknown>;

assert.equal(Number(v1.schemaVersion), 1, "фикстура прошла настоящий migrateConfig и осталась версии 1");
assert.ok(Object.keys(getIn(v1, "pkm.behavior.order.labels") as Any).length, "в фикстуре непустой Order");
assert.ok(Object.keys(getIn(v1, "pkm.behavior.tagVisuals.byTag") as Any).length, "в фикстуре непустой byTag");
assert.ok((getIn(v1, "ui.binderRows") as Any[]).length >= 2, "в фикстуре непустые строки Binder");
ok("фикстура собрана настоящим migrateConfig и содержит данные пользователя");

const report: MigrateReport = { unknown: [], contested: [], migrated: false };
const logged: string[] = [];
const v2 = migrate(v1, { report, log: m => logged.push(m) });

/* ---- МГ2: каждый лист v1 нашёл своё место ------------------------------ */

{
  const unmigrated = (v2._unmigrated || {}) as Record<string, unknown>;
  /*
   * Спорный путь — тот, куда целится и ветка v1, и значение, уже записанное
   * новой панелью до фазы 2. Считается из данных, а не выписан списком:
   * иначе правка фикстуры тихо снимала бы проверку.
   */
  const contested = new Set<string>();
  for (const [from, to] of MOVED) {
    if (getIn(v1, from) !== undefined && getIn(v1, to) !== undefined && from !== to) contested.add(to);
  }

  const accounted = { moved: 0, kept: 0, dropped: 0, unmigrated: 0, contested: 0 };
  for (const leaf of leaves(v1, "", [])) {
    if (leaf === "schemaVersion") continue;

    const droppedUnder = underAny(leaf, DROPPED);
    if (droppedUnder) {
      assert.equal(getIn(v2, leaf), undefined, "удалённая ветка ушла: " + leaf);
      accounted.dropped++;
      continue;
    }

    const pair = movedFor(leaf);
    if (pair && contested.has(pair[1] + leaf.slice(pair[0].length))) {
      assert.deepEqual(unmigrated[leaf], getIn(v1, leaf),
        "проигравшее спор старое значение сохранено в _unmigrated как есть: " + leaf);
      accounted.contested++;
      continue;
    }

    if (pair) {
      const [from, to] = pair;
      const target = to + leaf.slice(from.length);
      const cast = CAST[leaf];
      const expected = cast ? cast(getIn(v1, leaf)) : getIn(v1, leaf);
      assert.deepEqual(getIn(v2, target), expected, "значение переехало без изменений: " + leaf + " → " + target);
      assert.equal(getIn(v2, from), undefined, "источник удалён (МГ2): " + from);
      accounted.moved++;
      continue;
    }

    const keptUnder = underAny(leaf, KEPT);
    if (keptUnder) {
      assert.deepEqual(getIn(v2, leaf), getIn(v1, leaf), "значение осталось на месте: " + leaf);
      accounted.kept++;
      continue;
    }

    assert.ok(Object.prototype.hasOwnProperty.call(unmigrated, leaf),
      "ветка без маршрута сохранена в _unmigrated (МГ3), а не потеряна: " + leaf);
    assert.deepEqual(unmigrated[leaf], getIn(v1, leaf), "и сохранена как есть: " + leaf);
    accounted.unmigrated++;
  }

  assert.ok(accounted.moved > 100, "переездов проверено больше сотни, а не десяток: " + accounted.moved);
  ok("каждый лист конфига v1 нашёл место в v2: переехал " + accounted.moved
    + ", остался " + accounted.kept + ", удалён " + accounted.dropped
    + ", в _unmigrated " + accounted.unmigrated + ", уступил новой панели " + accounted.contested);
}

/* ---- МГ2: ветки-источники исчезли целиком ------------------------------ */

{
  for (const dead of ["globalFunctions", "devMode", "meta", "rules", "pkm.taxonomy",
    "pkm.behavior.tagVisuals", "pkm.behavior.colors", "pkm.behavior.freeRoam", "pkm.behavior.io",
    "pkm.behavior.order", "pkm.behavior.leftMode", "pkm.behavior.rightMode", "pkm.behavior.elements",
    "pkm.behavior.prefixRules", "pkm.behavior.subtagFormat", "pkm.behavior.defaultMode",
    "pkm.behavior.typeCheckboxByValue", "pkm.behavior.tagWheelScroller", "pkm.executionBackend",
    "pkm.generatedRulesPath", "pkm.tagWheelConfigPath", "ui.binderRows",
    "visual.displayModes", "visual.colors", "transform.inline2fleet"]) {
    assert.equal(getIn(v2, dead), undefined, "ветки v1 больше нет: " + dead);
  }
  assert.deepEqual(Object.keys(v2.pkm as Any).sort(),
    ["behavior", "configNote", "fields", "lineFormat", "placement", "prefixPriority", "prefixRules"],
    "у pkm остались только ветки v2");
  assert.deepEqual(Object.keys(getIn(v2, "pkm.behavior") as Any).sort(),
    ["childTagFormat", "cursorPolicy", "cycleEndBehavior"],
    "в pkm.behavior остались три настройки, которые 8.1 оставила на месте");
  ok("ветки-источники удалены целиком, а не наполовину");
}

/* ---- МГ1: идемпотентность ---------------------------------------------- */

{
  const silent = { log: () => {} };
  const once = migrate(v1, silent);
  const twice = migrate(migrate(v1, silent), silent);
  assert.deepEqual(twice, once, "migrate(migrate(x)) совпадает с migrate(x)");
  assert.equal(Number(once.schemaVersion), SCHEMA_VERSION_V2, "версия схемы стала 2");

  const second: MigrateReport = { unknown: [], contested: [], migrated: false };
  migrate(once, { report: second, log: () => { throw new Error("второй проход не должен ничего сообщать"); } });
  assert.equal(second.migrated, false, "второй проход не выполняет ветку 1 → 2");
  ok("МГ1: миграция идемпотентна и второй раз молчит");
}

/* ---- МГ3: неизвестное сохранено и сообщено один раз --------------------- */

{
  assert.deepEqual(report.unknown, ["pkm.behavior.somethingFromTheFuture.keptSomewhere"],
    "незнакомая ветка названа поимённо");
  assert.deepEqual((v2._unmigrated as Any)["pkm.behavior.somethingFromTheFuture.keptSomewhere"], 1,
    "и сохранена со своим значением");
  assert.equal(logged.length, 1, "сообщение в консоль одно, а не по ветке на строку");
  assert.ok(logged[0]!.includes("somethingFromTheFuture"), "и в нём назван путь");
  ok("МГ3: незнакомые ветки сохранены в _unmigrated и объявлены одним сообщением");
}

/* ---- МГ7: спор старой формы и того, что записано новой панелью ---------- */

{
  assert.deepEqual(report.contested.slice().sort(),
    ["globalFunctions.enhancedSelectAll.delayMs", "globalFunctions.enhancedSelectAll.enabled",
      "pkm.behavior.tagVisuals.opacity.left"],
    "спорные пути названы своими исходными именами");
  assert.equal(getIn(v2, "editor.selectAll.enabled"), getIn(v1, "editor.selectAll.enabled"),
    "победило то, что записано новой панелью: это единственный след нажатия человека");
  assert.equal((v2._unmigrated as Any)["globalFunctions.enhancedSelectAll.enabled"], true,
    "а старое значение сохранено, а не выброшено");
  assert.equal((v2._unmigrated as Any)["pkm.behavior.tagVisuals.opacity.left"], 0.8,
    "и сохранено как было в конфиге, до пересчёта единиц");

  /*
   * И то же самое в обоих порядках ключей. Без этого проверка зеленела бы
   * по случайности: «побеждает первый» дал бы на фикстуре тот же ответ, что
   * и правило. Мутация, подменившая правило спора на «первый выигрывает»,
   * прошла мимо проверки именно так.
   */
  for (const [label, raw] of [
    ["v2 записан раньше v1", { editor: { selectAll: { enabled: true } }, schemaVersion: 1, globalFunctions: { enhancedSelectAll: { enabled: false } } }],
    ["v1 записан раньше v2", { schemaVersion: 1, globalFunctions: { enhancedSelectAll: { enabled: false } }, editor: { selectAll: { enabled: true } } }],
  ] as ReadonlyArray<readonly [string, Any]>) {
    const out = migrate(raw, { log: () => {} });
    assert.equal(getIn(out, "editor.selectAll.enabled"), true,
      "спор решает правило, а не порядок ключей (" + label + ")");
    assert.equal((out._unmigrated as Any)["globalFunctions.enhancedSelectAll.enabled"], false,
      "проигравшее значение сохранено (" + label + ")");
  }
  ok("МГ7: побеждает значение новой панели в любом порядке ключей, старое не теряется");
}

/* ---- 8.3: умолчания приоритета Prefix берутся у движка ------------------ */

{
  const bare = migrate({ schemaVersion: 1 });
  assert.equal(getIn(bare, "pkm.prefixPriority.decideBy"), "by-section", "Decide by — by-section");
  assert.equal(getIn(bare, "pkm.prefixPriority.fieldOrderSource"), "manual",
    "Field order source — manual, как у getPrefixRulesFromCfg, а не auto из схемы");
  assert.equal(getIn(bare, "pkm.prefixPriority.parentOrChild"), "subtag-over-tag",
    "Parent or child — subtag-over-tag, как у движка, а не tag-over-subtag из схемы");
  assert.equal(getIn(bare, "pkm.fields.defaultBlock"), "left", "Block по умолчанию — левый");
  ok("8.3: умолчания приоритета Prefix взяты у движка, а не у схемы");
}

/* ---- прозрачность меняет единицы --------------------------------------- */

{
  assert.equal(getIn(v1, "pkm.behavior.tagVisuals.opacity.right"), 0.45, "в v1 прозрачность — доля");
  assert.equal(getIn(v2, "visual.tags.opacityRight"), 45, "в v2 — проценты");
  /* Левую в фикстуре перебивает запись новой панели (МГ7), поэтому пересчёт
     проверяется на конфиге без спора — иначе проверка мерила бы не то. */
  const onlyV1 = migrate({ schemaVersion: 1, pkm: { behavior: { tagVisuals: { opacity: { left: 0.8, right: 0.05 } } } } }, { log: () => {} });
  assert.equal(getIn(onlyV1, "visual.tags.opacityLeft"), 80, "0.8 стало 80 %");
  assert.equal(getIn(onlyV1, "visual.tags.opacityRight"), 5, "0.05 стало 5 %");
  ok("прозрачность переехала с пересчётом доли в проценты");
}

/* ---- переходник rules.tagWheelPath ------------------------------------- */

{
  /*
   * Настоящий `migrateConfig` до этой ветки не доходит: `deepMerge` с
   * `DEFAULT_CONFIG` всегда кладёт непустой `pkm.generatedRulesPath`, и шим
   * внутри него не срабатывает. Поэтому переходник проверяется на конфиге,
   * который через него не проходил, — на обновлении со старой версии.
   */
  const old = migrate({ schemaVersion: 1, rules: { tagWheelPath: "Rules/Legacy.md" } });
  assert.equal(getIn(old, "advanced.generatedRulesPath"), "Rules/Legacy.md",
    "путь со старой версии не потерян");
  assert.equal(getIn(old, "rules"), undefined, "а сама ветка rules удалена");

  const own = migrate({ schemaVersion: 1, rules: { tagWheelPath: "Rules/Legacy.md" }, pkm: { generatedRulesPath: "Rules/Own.md" } });
  assert.equal(getIn(own, "advanced.generatedRulesPath"), "Rules/Own.md", "свой путь сильнее переходника");
  ok("переходник rules.tagWheelPath → advanced.generatedRulesPath жив");
}

/* ---- МГ4 и МГ6: границы с vault ---------------------------------------- */

/** Файловая система в памяти. Подделка стоит на границе с миром и названа. */
function memoryVault(seed: Record<string, string>): VaultFiles & { files: Record<string, string>; writes: string[] } {
  const files: Record<string, string> = { ...seed };
  const writes: string[] = [];
  return {
    files,
    writes,
    async exists(p: string): Promise<boolean> { return Object.prototype.hasOwnProperty.call(files, p); },
    async read(p: string): Promise<string> { return files[p] as string; },
    async write(p: string, data: string): Promise<void> { files[p] = data; writes.push(p); },
  };
}

const DIR = ".obsidian/plugins/inline-overhaul";

{
  const text = JSON.stringify(v1);
  const vault = memoryVault({ [DIR + "/" + "data.json"]: text });
  const first = await backupV1Once(vault, DIR, text);
  assert.equal(first, "created", "копия сделана");
  assert.equal(vault.files[DIR + "/" + BACKUP_V1_FILE], text, "и совпадает с исходником");

  vault.files[DIR + "/" + BACKUP_V1_FILE] = "{}";
  const second = await backupV1Once(vault, DIR, text);
  assert.equal(second, "kept", "вторая миграция копию не трогает");
  assert.equal(vault.files[DIR + "/" + BACKUP_V1_FILE], "{}", "и не перезаписывает её");
  ok("МГ4: копия data.json делается один раз и не переписывается");
}

{
  const text = JSON.stringify(v1);
  const vault = memoryVault({ [DIR + "/data.json"]: text });
  const result = await loadConfig(vault, DIR, undefined, { log: () => {} });
  assert.equal(result.state, "read", "файл прочитан");
  assert.equal(result.backupSavedAs, DIR + "/" + BACKUP_V1_FILE, "и копия v1 сделана при загрузке");
  assert.equal(Number(result.config.schemaVersion), SCHEMA_VERSION_V2, "конфиг переехал на v2");
  assert.equal(getIn(result.config, "pkm.fields.defaultBlock"), "right", "с данными пользователя");

  const again = await loadConfig(vault, DIR, undefined, { log: () => {} });
  assert.equal(again.backupSavedAs, undefined, "повторная загрузка копию не делает");
  ok("МГ4: загрузка v1 делает копию один раз");
}

{
  const broken = "{ это не JSON ";
  const notices: string[] = [];
  const vault = memoryVault({ [DIR + "/data.json"]: broken });
  const result = await loadConfig(vault, DIR, m => notices.push(m), { log: () => {} });

  assert.equal(result.state, "broken", "файл объявлен нечитаемым");
  assert.equal(vault.files[DIR + "/data.json"], broken, "и не перезаписан молча (МГ6)");
  assert.equal(vault.files[DIR + "/" + BROKEN_FILE], broken, "копия лежит рядом");
  assert.equal(result.brokenSavedAs, DIR + "/" + BROKEN_FILE, "и путь к ней назван");
  assert.equal(notices.length, 1, "сообщение одно");
  assert.ok(notices[0]!.includes(BROKEN_FILE), "и в нём сказано, где копия");
  assert.equal(Number(result.config.schemaVersion), SCHEMA_VERSION_V2, "плагин стартует на значениях по умолчанию");
  assert.equal(getIn(result.config, "pkm.prefixPriority.decideBy"), "by-section", "и они настоящие");
  assert.equal(vault.files[DIR + "/" + BACKUP_V1_FILE], undefined,
    "копии v1 нет: копировать нечего, файл не разобрался");
  ok("МГ6: нечитаемый data.json сохранён рядом, не перезаписан, о нём сообщено");
}

{
  const vault = memoryVault({});
  const result = await loadConfig(vault, DIR, undefined, { log: () => {} });
  assert.equal(result.state, "absent", "чистый vault");
  assert.equal(Number(result.config.schemaVersion), SCHEMA_VERSION_V2, "конфиг собран из умолчаний");
  assert.deepEqual(vault.writes, [], "и ни одного файла не написано");
  ok("чистый vault: миграция ничего не пишет и отдаёт умолчания");
}

console.log("\n" + passed + " проверок пройдено");
