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
  /*
   * Правила, собранные из настроек, — снятие служебного файла
   * (PRD 10.13.52, П-8; 2026-09-11). Движки, получившие этот ключ, файла не
   * читают вовсе. **С 2026-09-13 (шаг третий) других ходов нет ни у одного
   * движка:** ключа нет — движок отказывается вслух, а не читает файл.
   * Сам ключ `Rules path` остаётся до шага четвёртого: по нему пишется файл.
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
  /* Цвета коробки скроллера (10.13.15, замечание заказчика D6 2026-09-02).
     Пустая строка означает «взять у темы». */
  TAGWHEEL_SCROLLER_FILL: "TagWheel scroller fill color",
  TAGWHEEL_SCROLLER_TEXT: "TagWheel scroller text color",
  /* Что делает стрелка на краю Block: остаться в своём или перейти в
     соседний (10.13.35, заказ заказчика 2026-09-05). */
  TAGWHEEL_EDGE_MODE: "TagWheel edge mode",
  /*
   * На каком Field панель открывается (решение заказчика 2026-09-11,
   * 10.13.69 Т-5; правка 10.13.76). Ключ в модели правил был и раньше —
   * `behavior.order.lead`, — но писать его было некому: функция записи не
   * звалась ниоткуда. Настройка едет к движку тем же путём, что край
   * Block: ключом, а не через служебный файл правил.
   */
  TAGWHEEL_ACTIVE_FIELD_MODE: "TagWheel active field mode",
  TAGWHEEL_ACTIVE_FIELD_LEFT: "TagWheel active field left",
  TAGWHEEL_ACTIVE_FIELD_RIGHT: "TagWheel active field right",
};

/**
 * Правила, приехавшие ключом `Rules data`.
 *
 * **Объявлено здесь, а не у каждого движка.** Движков трое — теги, элементы и
 * панель, — и три одинаковых условия разошлись бы молча (У-32). Дом выбран по
 * предмету: ключ объявлен в этом файле, значит и чтение значения живёт рядом с
 * ним.
 *
 * Отдаёт `null`, когда ключа нет или в нём лежит не объект. Для движка это
 * **отказ**, а не запасной путь: с шага третьего (PRD 10.13.52, П-8) служебный
 * файл не читает никто, и тихо продолжить работу означало бы работать по
 * правилам, которых человек не задавал.
 *
 * Строку разбираем тоже: через макро-слой значение приезжает уже напечатанным
 * в JSON, как приезжает `Order config`.
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
  return !!x && typeof x === "object" && !Array.isArray(x);
}

module.exports = {
  DEFAULT_RULES_PATH,
  LEGACY_RULES_PATH,
  KEYS,
  rulesFromSettings,
};
