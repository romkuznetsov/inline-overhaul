"use strict";

const __sharedUtils = require("./shared_utils.js");

/*
 * Служебного файла правил больше нет (PRD 10.13.52, П-8, шаг четвёртый), и
 * литералов его адреса здесь тоже: убирает его за собой сама миграция, а имена
 * файла и прежнего места объявлены один раз — `config_migration_v2.RULES_FILE`
 * и `LEGACY_RULES_FILE`.
 */

const KEYS = {
  /*
   * Правила, собранные из настроек, — снятие служебного файла
   * (PRD 10.13.52, П-8; 2026-09-11). Движки, получившие этот ключ, файла не
   * читают вовсе. **С 2026-09-13 (шаг третий) других ходов нет ни у одного
   * движка:** ключа нет — движок отказывается вслух, а не читает файл.
   * Ключ `Rules path` снят шагом четвёртым вместе с самим файлом: возить
   * адрес того, чего нет, значит обещать движку ход, которого у него больше
   * не бывает.
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
  /* Правило объявлено один раз — `isObj` в `shared_utils.js`. Копия здесь
     возвращала «да/нет» (10.13.135). */
  return __sharedUtils.isObj(x);
}

module.exports = {
  KEYS,
  rulesFromSettings,
};
