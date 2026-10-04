"use strict";

/**
 * Настройки, которые слой команд досыпает движкам поверх определения команды.
 * Отдельный модуль, чтобы его брали и продукт, и стенды
 * (`tests/harness/panel_bench.js`) без пакета `obsidian` — одна копия (У-32,
 * В-120). Только общее; своё команда приносит сама, `Rules data` — реестр.
 */

const __sharedUtils = require("./shared_utils.js");
const __pkmOptionKeys = require("./pkm_option_keys.js");
const __pkmOrderConfig = require("./pkm_order_config.js");
const __editorVisuals = require("./editor_visuals_config.js");

const readCfgPath = __sharedUtils.readCfgPath;
const KEYS = __pkmOptionKeys.KEYS;

function runtimeSettingsFromConfig(cfg) {
  return {
    [KEYS.CYCLE_END_BEHAVIOR]: readCfgPath(cfg, "pkm.behavior.cycleEndBehavior") || "keep-bullet",
    [KEYS.CURSOR_POLICY]: readCfgPath(cfg, "pkm.behavior.cursorPolicy") || "text_end",
    [KEYS.ORDER_CONFIG]: __pkmOrderConfig.serializePkmOrderForMacro(cfg),
    [KEYS.DATE_RUNTIME_CONFIG]: __pkmOrderConfig.serializeDateRuntimeConfigForMacro(cfg),
    [KEYS.TAGWHEEL_SCROLLER_ENABLED]: readCfgPath(cfg, "visual.tagWheel.scroller.enabled") === true,
    [KEYS.TAGWHEEL_SCROLLER_DIRECTION]: readCfgPath(cfg, "visual.tagWheel.scroller.direction") || "full",
    [KEYS.TAGWHEEL_SCROLLER_SIZE]: readCfgPath(cfg, "visual.tagWheel.scroller.size") || 3,
    /* Подписи соседних значений в коробке (2026-09-20). Карту своих текстов
       собирает дом правила: её же читает пузырь в заметке. */
    [KEYS.TAGWHEEL_SCROLLER_LABELS]: readCfgPath(cfg, "visual.tagWheel.scroller.labels") || "value",
    /* Подпись выбранного значения в полосе панели (З-38); карта своих
       текстов общая с коробкой. */
    [KEYS.TAGWHEEL_VALUE_NAMES]: readCfgPath(cfg, "visual.tagWheel.valueNames") || "default",
    [KEYS.TAGWHEEL_CUSTOM_VALUE_TEXT]: JSON.stringify(__editorVisuals.buildTagCustomTextMap(cfg)),
    /* Цвета коробки скроллера (10.13.15). Пусто — коробка берёт цвета темы. */
    [KEYS.TAGWHEEL_SCROLLER_FILL]: readCfgPath(cfg, "visual.tagWheel.scroller.fillColor") || "",
    [KEYS.TAGWHEEL_SCROLLER_TEXT]: readCfgPath(cfg, "visual.tagWheel.scroller.textColor") || "",
    /* Край Block: остаться в своём или перейти в соседний (10.13.35). */
    [KEYS.TAGWHEEL_EDGE_MODE]: readCfgPath(cfg, "visual.tagWheel.edgeMode") || "stay",
    /* Строка выделения, на которой открывается панель (цикл 121). */
    [KEYS.TAGWHEEL_SELECTION_LINE]: readCfgPath(cfg, "visual.tagWheel.selectionLine") || "top",
    /* На каком Field открывается панель (10.13.76). */
    [KEYS.TAGWHEEL_ACTIVE_FIELD_MODE]: readCfgPath(cfg, "visual.tagWheel.activeField.mode") || "first",
    [KEYS.TAGWHEEL_ACTIVE_FIELD_LEFT]: readCfgPath(cfg, "visual.tagWheel.activeField.left") || "",
    [KEYS.TAGWHEEL_ACTIVE_FIELD_RIGHT]: readCfgPath(cfg, "visual.tagWheel.activeField.right") || "",
    /* `Tab` между custom block (PRD 10.13.260). Умолчание — прежнее: ничего. */
    [KEYS.TAGWHEEL_CUSTOM_TAB]: readCfgPath(cfg, "visual.tagWheel.customTab") === true,
  };
}

module.exports = {
  runtimeSettingsFromConfig,
};
