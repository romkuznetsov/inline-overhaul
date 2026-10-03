"use strict";

/**
 * Правила PKM из настроек: шов между конфигом версии 2 и формой движков.
 * Потребители — печать `generated_rules.md` (`src/features/rules_markdown_builder.js`)
 * и `navigation_runtime.js` напрямую (PRD 10.13.52, П-8). Имена блоков и ключи —
 * форма версии 1: её читает `pkm_v2/**`, под З3 не правится
 * (`docs/dev/PKM_Runtime_Unified_Contract_v1.md`); значения — из `pkm.fields.*`,
 * `pkm.lineFormat.*`, `pkm.placement.*`, `pkm.prefixRules.*`, `visual.tagWheel.*`.
 */

const __sharedUtils = require("./shared_utils.js");
const __rulesNormalizer = require("./tagwheel_rules_normalizer.js");
const __pkmOrderConfig = require("./pkm_order_config.js");

function isObj(x) {
  return __sharedUtils.isObj(x);
}

function cloneJson(x) {
  return __sharedUtils.cloneJson(x);
}

function slice(node, key) {
  return isObj(node) && isObj(node[key]) ? node[key] : {};
}

/**
 * Определения Fields для одного Block (PRD 10.13.260). Left и Right — без
 * Field из custom block: для них это текст строки (пункт 13). Панель custom
 * block получает свои Field, записанные как левый Block.
 */
function scopeToBlock(behavior, blockId) {
  /* Порядок уже нормализован `migrateConfig`; второй проход менял бы Left и Right. */
  const order = isObj(behavior.order) ? behavior.order : {};
  const blocks = Array.isArray(order.custom) ? order.custom : [];
  const custom = __pkmOrderConfig.customBlockKeys(order);
  const block = blockId ? blocks.find((b) => b && b.id === blockId) : null;
  /* Блоков нет — правила те же, что до custom block, знак в знак. */
  if (!custom.size && !block) return;
  const mine = block ? __pkmOrderConfig.customBlockKeys({ custom: [block] }) : null;
  const keep = (f) => {
    const ids = [String(f && f.id || "").trim(), String(f && f.orderKey || "").trim()];
    const inCustom = ids.some((k) => k && custom.has(k));
    return mine ? ids.some((k) => k && mine.has(k)) : !inCustom;
  };
  for (const side of ["leftMode", "rightMode"]) {
    const mode = behavior[side];
    if (isObj(mode) && Array.isArray(mode.fields)) mode.fields = mode.fields.filter(keep);
  }
  /* Карты порядка теряют ключи чужих блоков; свои у панели блока остаются. */
  const scoped = __pkmOrderConfig.orderWithoutCustom({ ...order, custom: blocks.filter((b) => b !== block) });
  if (block) {
    scoped.left = Array.isArray(block.keys) ? block.keys.slice() : [];
    scoped.right = [];
    scoped.lead = {};
  }
  behavior.order = scoped;
}

/** Форма правил PKM, собранная из конфига версии 2. */
function buildRulesShapeFromConfig(cfg, blockId) {
  const pkm = isObj(cfg && cfg.pkm) ? cfg.pkm : {};
  const fields = slice(pkm, "fields");
  const placement = slice(pkm, "placement");
  const behaviorCfg = slice(pkm, "behavior");
  const wheel = slice(slice(cfg, "visual"), "tagWheel");

  const behavior = cloneJson(behaviorCfg);
  delete behavior.childTagFormat;
  behavior.subtagFormat = behaviorCfg.childTagFormat === "combined" ? "combined" : "separate";
  behavior.defaultMode = String(fields.defaultBlock || "").trim().toLowerCase() === "right" ? "right" : "left";
  /* Command Field в строку не пишется: движки его не видят (№ 198). */
  behavior.order = __pkmOrderConfig.withoutCommandFields(cloneJson(slice(fields, "order")));
  behavior.elements = cloneJson(slice(fields, "elements"));
  behavior.leftMode = cloneJson(slice(fields, "tags"));
  behavior.rightMode = cloneJson(slice(fields, "links"));
  behavior.projects = cloneJson(slice(fields, "projects"));
  scopeToBlock(behavior, String(blockId || ""));
  behavior.typeCheckboxByValue = cloneJson(slice(fields, "checkboxByValue"));
  behavior.prefixRules = Object.assign(cloneJson(slice(pkm, "prefixRules")), {
    priorityMode: slice(pkm, "prefixPriority").decideBy,
    fieldsOrderMode: slice(pkm, "prefixPriority").fieldOrderSource,
    tagSubtagPriority: slice(pkm, "prefixPriority").parentOrChild,
  });
  behavior.freeRoam = {
    minimalSeparator: placement.keepPrefixInsertOnly !== false,
    minimalPrefix: placement.fieldPrefixInsertOnly !== false,
    offPrefix: placement.bulletInStrict === true,
    fullPlacement: String(placement.freeInsertPosition || "smart"),
    /* `Keep typed tags in text` (`В-235`): выключен — Value из текста переезжает в свой Block. */
    typedTagsStayText: placement.typedTagsStayText !== false,
  };

  /*
   * Блок `ui`: подсветка строки при открытом TagWheel (10.13.6) —
   * `rules.ui.activePanel.useHighlight` читает `renderControlLine`.
   * `activePanel.showMarkers` — обёртки `{TW} … {/TW}`, не `visual.tagWheel.showMarkers`:
   * имена совпали случайно, ключ остаётся невыставленным.
   */
  const ui = cloneJson(slice(behaviorCfg, "ui"));
  const activePanel = isObj(ui.activePanel) ? cloneJson(ui.activePanel) : {};
  activePanel.enabled = true;
  activePanel.useHighlight = wheel.highlightLine === true;
  /*
   * Значения противоположного Block при открытой панели (10.13.87): читает
   * `renderControlLine`, умолчание `hide`.
   */
  activePanel.keepOppositeBlock = String(wheel.oppositeBlock || "") === "keep";
  ui.activePanel = activePanel;

  const meta = cloneJson(slice(behaviorCfg, "meta"));
  meta.generatedBy = "inline-overhaul";
  /*
   * Времени сборки нет (Д-1, 2026-09-08): `meta.generatedAt` менял
   * `generated_rules.md` на каждом запуске и будил синхронизацию. Пара —
   * `ensureGeneratedRulesNow` не пишет совпавший файл.
   */

  return {
    meta,
    io: slice(pkm, "lineFormat"),
    inlineLayout: slice(behaviorCfg, "inlineLayout"),
    dateRules: slice(behaviorCfg, "dateRules"),
    behavior,
    ui,
    leftMode: behavior.leftMode,
    rightMode: behavior.rightMode,
    projects: behavior.projects,
    colors: {
      tagwheelHeader: {
        defaultTextColor: String(wheel.textColor || ""),
        fillColor: String(wheel.fillColor || ""),
        showPrefix: wheel.showMarkers !== false,
      },
    },
  };
}

/**
 * Правила в форме движков PKM — второй ход (PRD 10.13.52, П-5): конфиг → форма
 * → `normalizeMode` → правила; первый — через `generated_rules.md` и
 * `parseRulesFromMarkdown`. Равенство держат `rules_document_roundtrip_tests.ts`
 * и `rules_from_settings_tests.ts`. Блока дат нет: `parseRulesFromMarkdown`
 * его не читает. `normalizeMode` — из своего модуля (У-32).
 */
function buildRulesForEngines(cfg, blockId) {
  const shape = buildRulesShapeFromConfig(cfg, blockId);
  const deps = {
    isObj: isObj,
    err: function(message) { throw new Error(String(message || "normalizeMode failed")); },
  };
  return {
    meta: shape.meta,
    io: shape.io,
    inlineLayout: shape.inlineLayout,
    behavior: shape.behavior,
    ui: shape.ui,
    leftMode: __rulesNormalizer.normalizeMode(cloneJson(shape.leftMode), "leftMode", deps),
    rightMode: __rulesNormalizer.normalizeMode(cloneJson(shape.rightMode), "rightMode", deps),
    projects: shape.projects,
    colors: shape.colors,
  };
}

module.exports = {
  buildRulesShapeFromConfig,
  buildRulesForEngines,
};
