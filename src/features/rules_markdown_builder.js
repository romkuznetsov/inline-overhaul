"use strict";

/**
 * Заметка сгенерированных правил TagWheel.
 *
 * **Важное про форму.** Документ правил — отдельный контракт
 * (`docs/PKM_Runtime_Unified_Contract_v1.md`), который читает `pkm_v2/**`, а
 * тот под З3 не правится. Поэтому имена блоков (`tagwheel-behavior`,
 * `tagwheel-left-mode`, …) и ключи внутри них остались формой версии 1.
 * Конфиг при этом переехал на версию 2, и здесь стоит **шов**: значения
 * берутся из `pkm.fields.*`, `pkm.lineFormat.*`, `pkm.placement.*`,
 * `pkm.prefixRules.*` и `visual.tagWheel.*`, а раскладываются по старым
 * именам документа.
 *
 * Переписать заодно и документ значило бы переписать рантайм TagWheel целиком —
 * ровно то, что раздел 3.2 держит вне границ работ.
 */
function createRulesMarkdownBuilder(deps) {
  const isObj = deps && typeof deps.isObj === "function"
    ? deps.isObj
    : function(x) { return x && typeof x === "object" && !Array.isArray(x); };
  const cloneJson = deps && typeof deps.cloneJson === "function"
    ? deps.cloneJson
    : function(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); };
  const toPrettyJson = deps && typeof deps.toPrettyJson === "function"
    ? deps.toPrettyJson
    : function(x) { return JSON.stringify(x, null, 2); };

  function slice(node, key) {
    return isObj(node) && isObj(node[key]) ? node[key] : {};
  }

  /** Форма документа правил, собранная из конфига версии 2. */
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
     * Блок `tagwheel-ui`: подсветка строки, пока открыт TagWheel (10.13.6).
     *
     * Движок обёртку в `==` умел с самого начала — `renderControlLine` ставит
     * её при `rules.ui.activePanel.useHighlight`, — но ветки `pkm.behavior.ui`
     * нет в умолчаниях, и блок уезжал в заметку правил пустым. Значение
     * приходит из настройки версии 2, а имена ключей внутри блока остаются
     * формой версии 1: документ правил — отдельный контракт (см. шапку файла).
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

  function buildTagWheelRulesMarkdownFromConfig(cfg) {
    const shape = buildRulesShapeFromConfig(cfg);

    const blocks = [
      ["tagwheel-meta", shape.meta],
      ["tagwheel-io", shape.io],
      ["tagwheel-inline-layout", shape.inlineLayout],
      ["tagwheel-date-rules", shape.dateRules],
      ["tagwheel-behavior", shape.behavior],
      ["tagwheel-ui", shape.ui],
      ["tagwheel-left-mode", shape.leftMode],
      ["tagwheel-right-mode", shape.rightMode],
      ["tagwheel-projects", shape.projects],
      ["tagwheel-colors", shape.colors],
    ];

    const lines = [];
    lines.push("# InlineOverhaul Generated TagWheel Rules");
    lines.push("");
    lines.push("<!-- AUTO-GENERATED. DO NOT EDIT MANUALLY. Source: plugin data.json -->");
    lines.push("");

    for (let i = 0; i < blocks.length; i++) {
      const name = blocks[i][0];
      const payload = blocks[i][1];
      lines.push("```" + name);
      lines.push(toPrettyJson(payload));
      lines.push("```");
      lines.push("");
    }
    return lines.join("\n");
  }

  return {
    buildRulesShapeFromConfig,
    buildTagWheelRulesMarkdownFromConfig,
  };
}

module.exports = {
  createRulesMarkdownBuilder,
};
