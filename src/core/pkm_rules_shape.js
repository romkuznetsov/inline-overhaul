"use strict";

/**
 * Правила PKM, собранные **из настроек**: один шов между конфигом версии 2 и
 * той формой, которую ждут движки.
 *
 * **Почему это отдельный модуль, а не часть сборщика заметки.** Пока правила
 * доезжали до движков только через служебный файл `generated_rules.md`, эта
 * функция была первой половиной сборщика: собрать форму и напечатать её
 * блоками JSON. С 2026-09-11 у неё второй потребитель — `navigation_runtime.js`
 * читает правила **прямо отсюда**, минуя диск (PRD 10.13.52, П-8, шаг 1).
 * Движки подключают только `src/core/**`; печать заметки — работа слоя
 * возможностей и остаётся в `src/features/rules_markdown_builder.js`.
 *
 * **Важное про форму.** Имена блоков (`behavior`, `leftMode`, `io`, …) и ключи
 * внутри них — форма версии 1: их читает `pkm_v2/**`, а тот под З3 не правится
 * (`docs/dev/PKM_Runtime_Unified_Contract_v1.md`). Конфиг при этом переехал на
 * версию 2, поэтому здесь стоит **шов**: значения берутся из `pkm.fields.*`,
 * `pkm.lineFormat.*`, `pkm.placement.*`, `pkm.prefixRules.*` и
 * `visual.tagWheel.*`, а раскладываются по старым именам.
 *
 * Переписать заодно и форму значило бы переписать рантайм TagWheel целиком —
 * ровно то, что раздел 3.2 держит вне границ работ.
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
 * Определения Fields для одного Block: Left и Right или один custom block
 * (PRD 10.13.260).
 *
 * Шов один на все движки: Left и Right получают правила **без** Field из
 * custom block — для них это текст строки, и переставлять или снимать его они
 * не вправе (пункт 13). Панель custom block получает только свои Field, а её
 * порядок — это её Block, записанный как левый: ядро панели умеет ходить по
 * одному Block, и второго правила «как ходить по полям» заводить незачем.
 */
function scopeToBlock(behavior, blockId) {
  /* Порядок в конфиге уже нормализован `migrateConfig`; второй проход здесь
     менял бы правила Left и Right там, где custom block ни при чём. */
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
  behavior.order = cloneJson(slice(fields, "order"));
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
  };

  /*
   * Блок `ui`: подсветка строки, пока открыт TagWheel (10.13.6).
   *
   * Движок обёртку в `==` умел с самого начала — `renderControlLine` ставит
   * её при `rules.ui.activePanel.useHighlight`, — но ветки `pkm.behavior.ui`
   * нет в умолчаниях, и блок уезжал пустым. Значение приходит из настройки
   * версии 2, а имена ключей внутри блока остаются формой версии 1: правила
   * движков — отдельный контракт (см. шапку файла).
   *
   * **`showMarkers` здесь не тот, что в панели.** Внутри `activePanel` это
   * текстовые обёртки `{TW} … {/TW}` вокруг строки, а не тумблер
   * `Show tag markers`, который решает судьбу решёток в самом списке. Имена
   * совпали случайно, и запись сюда значения из `visual.tagWheel.showMarkers`
   * вписала бы человеку в строку скобки. Ключ остаётся невыставленным.
   */
  const ui = cloneJson(slice(behaviorCfg, "ui"));
  const activePanel = isObj(ui.activePanel) ? cloneJson(ui.activePanel) : {};
  activePanel.enabled = true;
  activePanel.useHighlight = wheel.highlightLine === true;
  /*
   * **Значения противоположного Block, пока панель открыта** (10.13.87, заказ
   * заказчика 2026-09-12). Полоса панели встаёт на место своего Block, а
   * противоположный уходил из строки на всё время выбора — его слова: «визуально
   * исчезают все элементы из противоположного block, даже если они уже были
   * выбраны».
   *
   * Ключ живёт рядом с `useHighlight`, потому что отвечает на тот же вопрос —
   * как выглядит строка, пока панель открыта, — а читает его тот же
   * `renderControlLine`. Умолчание `hide` прежнее: «первый прятать (текущий)».
   */
  activePanel.keepOppositeBlock = String(wheel.oppositeBlock || "") === "keep";
  ui.activePanel = activePanel;

  const meta = cloneJson(slice(behaviorCfg, "meta"));
  meta.generatedBy = "inline-overhaul";
  /*
   * **Времени сборки здесь больше нет** (Д-1 разбора готовности, 2026-09-08).
   *
   * Стояло `meta.generatedAt = new Date().toISOString()`, и от этого файл
   * `generated_rules.md` менялся при **каждом** запуске Obsidian на каждом
   * устройстве: содержимое всегда разное, значит запись всегда новая. Платил
   * за это человек — Obsidian Sync, git и любая папочная синхронизация
   * видели изменившийся файл на старте, а с двумя устройствами это конфликт
   * на ровном месте.
   *
   * Поле не читает никто: сплошной поиск давал два места — эту запись и
   * проверку кругового обхода, которая его **явно исключает** из сверки
   * (`rules_document_roundtrip_tests.ts`). То есть у времени сборки не было
   * ни одного потребителя, а цена была у каждого.
   *
   * Снятие поля — половина починки, и без второй половины оно бесполезно:
   * содержимое стало устойчивым, и теперь `ensureGeneratedRulesNow` читает
   * файл перед записью и не пишет, если там уже то же самое.
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
 * Правила в том виде, в каком их ждут движки PKM.
 *
 * **Это второй ход из двух** (PRD 10.13.52, П-5). Первый — сегодняшний: конфиг
 * → заметка `generated_rules.md` → `parseRulesFromMarkdown` → правила. Второй
 * — этот: конфиг → форма → `normalizeMode` на двух блоках → правила. Что ходы
 * равны, держит сверка на фикстурах (`rules_document_roundtrip_tests.ts` по
 * блокам, `rules_from_settings_tests.ts` целиком и по поведению движка).
 *
 * **Блока дат здесь нет, и это не забывчивость.** `parseRulesFromMarkdown` его
 * не читает, значит и второй ход не должен: лишний ключ сделал бы формы
 * разными, а разница обязана быть нулевой.
 *
 * `normalizeMode` — единственное, что ход через диск добавлял к записанному:
 * досыпка формы списка Fields. Она вынесена в свой модуль и зовётся отсюда,
 * а не переписывается (У-32).
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
