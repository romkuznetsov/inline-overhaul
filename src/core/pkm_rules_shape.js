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
 * (`docs/PKM_Runtime_Unified_Contract_v1.md`). Конфиг при этом переехал на
 * версию 2, поэтому здесь стоит **шов**: значения берутся из `pkm.fields.*`,
 * `pkm.lineFormat.*`, `pkm.placement.*`, `pkm.prefixRules.*` и
 * `visual.tagWheel.*`, а раскладываются по старым именам.
 *
 * Переписать заодно и форму значило бы переписать рантайм TagWheel целиком —
 * ровно то, что раздел 3.2 держит вне границ работ.
 */

const __sharedUtils = require("./shared_utils.js");

function isObj(x) {
  return __sharedUtils.isObj(x);
}

function cloneJson(x) {
  return __sharedUtils.cloneJson(x);
}

function slice(node, key) {
  return isObj(node) && isObj(node[key]) ? node[key] : {};
}

/** Форма правил PKM, собранная из конфига версии 2. */
function buildRulesShapeFromConfig(cfg) {
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

module.exports = {
  buildRulesShapeFromConfig,
};
