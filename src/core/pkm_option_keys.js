"use strict";

const __sharedUtils = require("./shared_utils.js");

/*
 * Служебного файла правил нет (10.13.52, П-8); его имена объявлены один раз —
 * `config_migration_v2.RULES_FILE` и `LEGACY_RULES_FILE`.
 */

const KEYS = {
  /*
   * Правила из настроек (10.13.52, П-8). Ключа нет — движок отказывается
   * вслух, файла не читает; `Rules path` снят вместе с файлом.
   */
  RULES_DATA: "Rules data",
  ACTION_TYPE: "Action type",
  SUBTAG_FORMAT: "Subtag format",
  CYCLE_END_BEHAVIOR: "Cycle end behavior",
  CURSOR_POLICY: "Cursor policy",
  ORDER_CONFIG: "Order config",
  DIRECTION: "Direction",
  DATE_RUNTIME_CONFIG: "Date runtime config",
  TAGWHEEL_SCROLLER_ENABLED: "TagWheel scroller enabled",
  TAGWHEEL_SCROLLER_DIRECTION: "TagWheel scroller direction",
  TAGWHEEL_SCROLLER_SIZE: "TagWheel scroller size",
  TAGWHEEL_SCROLLER_LABELS: "TagWheel scroller labels",
  /* Карта своих текстов у значений: читают коробка скроллера и полоса панели (З-38, У-165). */
  TAGWHEEL_CUSTOM_VALUE_TEXT: "TagWheel custom value text",
  /* Подпись значения в полосе панели: `default`, `custom`, `both` (З-38). */
  TAGWHEEL_VALUE_NAMES: "TagWheel value names",
  /* Цвета коробки скроллера (10.13.15, D6); пустая строка — цвет темы. */
  TAGWHEEL_SCROLLER_FILL: "TagWheel scroller fill color",
  TAGWHEEL_SCROLLER_TEXT: "TagWheel scroller text color",
  /* Стрелка на краю Block: остаться или перейти в соседний (10.13.35). */
  TAGWHEEL_EDGE_MODE: "TagWheel edge mode",
  /* Строка выделения для панели: `top`, `bottom`, `head` (цикл 121). */
  TAGWHEEL_SELECTION_LINE: "TagWheel selection line",
  /* На каком Field панель открывается (10.13.69 Т-5, 10.13.76); едет ключом, не файлом правил. */
  TAGWHEEL_ACTIVE_FIELD_MODE: "TagWheel active field mode",
  TAGWHEEL_ACTIVE_FIELD_LEFT: "TagWheel active field left",
  TAGWHEEL_ACTIVE_FIELD_RIGHT: "TagWheel active field right",
  /* Command Field для колеса (постановка command-field.md, 4.5): только командам tagWheel, № 199. */
  COMMAND_FIELDS: "Command fields",
  /*
   * Custom block (10.13.260): свой `Rules data` и `Order config`, какой блок
   * открыть, все блоки ради `Tab`, правила Left/Right ради `Values in the
   * other Block`, шаг команды поля по месту каретки.
   */
  CUSTOM_BLOCK: "Custom block",
  CUSTOM_BLOCKS: "Custom blocks",
  CUSTOM_CYCLE: "Custom cycle",
  LINE_RULES_DATA: "Line rules data",
  TAGWHEEL_CUSTOM_TAB: "TagWheel custom tab",
};

/**
 * Правила, приехавшие ключом `Rules data`; объявлено здесь, а не у трёх
 * движков (У-32). `null` (ключа нет или не объект) для движка — отказ, а не
 * запасной путь (10.13.52, П-8). Строку разбираем: через макро-слой значение
 * приезжает JSON-текстом, как `Order config`.
 */
function rulesFromSettings(settings, key) {
  const name = String(key || KEYS.RULES_DATA);
  const raw = settings && typeof settings === "object" ? settings[name] : null;
  if (!raw) return null;
  if (isObj(raw)) return raw;
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  const parsed = JSON.parse(text);
  return isObj(parsed) ? parsed : null;
}

function isObj(x) {
  /* Правило объявлено один раз — `isObj` в `shared_utils.js` (10.13.135). */
  return __sharedUtils.isObj(x);
}

module.exports = {
  KEYS,
  rulesFromSettings,
};
