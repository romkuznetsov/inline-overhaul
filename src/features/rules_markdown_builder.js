"use strict";

const __rulesShape = require("../core/pkm_rules_shape.js");

/**
 * Заметка сгенерированных правил TagWheel: **печать** формы блоками JSON.
 *
 * **Формы здесь больше нет.** Сборка формы из конфига версии 2 переехала в
 * `src/core/pkm_rules_shape.js` 2026-09-11: с этого дня у неё два потребителя —
 * эта печать и `navigation_runtime.js`, который читает правила прямо из
 * настроек, минуя диск (PRD 10.13.52, П-8, шаг 1). Движки подключают только
 * `src/core/**`, поэтому форма живёт там, а печать заметки — здесь.
 *
 * `buildRulesShapeFromConfig` отсюда по-прежнему отдаётся: её зовут проверки и
 * она же — первая половина печати. Это один вызов общего модуля, а не вторая
 * копия правила (У-32).
 */
function createRulesMarkdownBuilder(deps) {
  const toPrettyJson = deps && typeof deps.toPrettyJson === "function"
    ? deps.toPrettyJson
    : function(x) { return JSON.stringify(x, null, 2); };

  function buildRulesShapeFromConfig(cfg) {
    return __rulesShape.buildRulesShapeFromConfig(cfg);
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
