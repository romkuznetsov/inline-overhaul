"use strict";

/*
 * Служебный файл правил. С 2026-09-04 он живёт в папке плагина, а не в
 * корне vault (решение заказчика В-39): в vault его правили руками,
 * удаляли и синхронизировали как обычную заметку, а он — чистая проекция
 * `data.json`.
 *
 * Путь **приходит из конфига** (`advanced.generatedRulesPath`), куда его
 * кладёт `moveGeneratedRulesIntoPluginFolder` — она считает папку плагина
 * по `vault.configDir` и потому верна и при нестандартной папке настроек.
 * Здесь только литерал на случай, когда конфига ещё нет; имя самого файла
 * объявлено один раз, в `config_migration_v2.RULES_FILE`, и совпадение
 * держит пин (У-32).
 */
const DEFAULT_RULES_PATH = ".obsidian/plugins/inline-overhaul/generated_rules.md";

/* Прежнее место — корень vault. Нужно двум вещам: признаку «человек путь
   не менял» при переезде и последнему запасному кандидату чтения. */
const LEGACY_RULES_PATH = "InlineOverhaul_Generated_RULES_TagWheel.md";

const KEYS = {
  RULES_PATH: "Rules path",
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
  /* Цвета коробки скроллера (10.13.15, замечание заказчика D6 2026-09-02).
     Пустая строка означает «взять у темы». */
  TAGWHEEL_SCROLLER_FILL: "TagWheel scroller fill color",
  TAGWHEEL_SCROLLER_TEXT: "TagWheel scroller text color",
  /* Что делает стрелка на краю Block: остаться в своём или перейти в
     соседний (10.13.35, заказ заказчика 2026-09-05). */
  TAGWHEEL_EDGE_MODE: "TagWheel edge mode",
};

module.exports = {
  DEFAULT_RULES_PATH,
  LEGACY_RULES_PATH,
  KEYS,
};
