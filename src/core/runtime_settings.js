"use strict";

/**
 * Настройки, которые слой команд досыпает движкам поверх определения команды.
 *
 * **Почему это отдельный модуль.** Список жил в двух местах: в
 * `plugin_commands.js` — у продукта — и в `tests/harness/panel_bench.js` — у
 * трёх стендов, которые гоняют настоящую панель. Копия в стендах завелась не
 * от лени: `plugin_commands.js` подключает `obsidian`, а этого пакета нет ни в
 * прогоне набора, ни на странице браузерного гейта.
 *
 * Расхождение между копиями видно только тем, что панель на стенде ведёт себя
 * иначе, чем у человека, — то есть не видно вовсе (У-32). Один раз они уже
 * разъехались на строку, а 2026-09-20 разъехались бы на две: новая настройка
 * скроллера доехала бы до человека и не доехала бы ни до одного стенда.
 * Расхождение перед сведением измерено и равно нулю: обе копии перечисляли
 * одни и те же четырнадцать ключей одними и теми же выражениями (В-120).
 *
 * Здесь только **общее**. Своё каждая команда приносит сама, а `Rules data`
 * кладёт реестр команд: этот список к нему отношения не имеет.
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
    [KEYS.SUBTAG_FORMAT]: readCfgPath(cfg, "pkm.behavior.childTagFormat") || "separate",
    [KEYS.CURSOR_POLICY]: readCfgPath(cfg, "pkm.behavior.cursorPolicy") || "text_end",
    [KEYS.ORDER_CONFIG]: __pkmOrderConfig.serializePkmOrderForMacro(cfg),
    [KEYS.DATE_RUNTIME_CONFIG]: __pkmOrderConfig.serializeDateRuntimeConfigForMacro(cfg),
    [KEYS.TAGWHEEL_SCROLLER_ENABLED]: readCfgPath(cfg, "visual.tagWheel.scroller.enabled") === true,
    [KEYS.TAGWHEEL_SCROLLER_DIRECTION]: readCfgPath(cfg, "visual.tagWheel.scroller.direction") || "full",
    [KEYS.TAGWHEEL_SCROLLER_SIZE]: readCfgPath(cfg, "visual.tagWheel.scroller.size") || 3,
    /* Чем подписаны соседние значения в коробке и чем их подписывать, если
       выбран свой текст (его заказ 2026-09-20). Карту собирает дом правила
       («у этого значения есть свой текст»), а не это место: тот же ответ
       читает пузырь в заметке. */
    [KEYS.TAGWHEEL_SCROLLER_LABELS]: readCfgPath(cfg, "visual.tagWheel.scroller.labels") || "value",
    [KEYS.TAGWHEEL_SCROLLER_CUSTOM_TEXT]: JSON.stringify(__editorVisuals.buildTagCustomTextMap(cfg)),
    /* Цвета коробки скроллера (10.13.15). Пусто — коробка берёт цвета темы. */
    [KEYS.TAGWHEEL_SCROLLER_FILL]: readCfgPath(cfg, "visual.tagWheel.scroller.fillColor") || "",
    [KEYS.TAGWHEEL_SCROLLER_TEXT]: readCfgPath(cfg, "visual.tagWheel.scroller.textColor") || "",
    /* Край Block: остаться в своём или перейти в соседний (10.13.35). */
    [KEYS.TAGWHEEL_EDGE_MODE]: readCfgPath(cfg, "visual.tagWheel.edgeMode") || "stay",
    /* На каком Field открывается панель (10.13.76). */
    [KEYS.TAGWHEEL_ACTIVE_FIELD_MODE]: readCfgPath(cfg, "visual.tagWheel.activeField.mode") || "first",
    [KEYS.TAGWHEEL_ACTIVE_FIELD_LEFT]: readCfgPath(cfg, "visual.tagWheel.activeField.left") || "",
    [KEYS.TAGWHEEL_ACTIVE_FIELD_RIGHT]: readCfgPath(cfg, "visual.tagWheel.activeField.right") || "",
  };
}

module.exports = {
  runtimeSettingsFromConfig,
};
