"use strict";

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

  function getBehaviorRoot(cfg, cloneIt) {
    const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
    return cloneIt ? cloneJson(behavior) : behavior;
  }

  function getBehaviorSlice(cfg, key, cloneIt) {
    const behavior = getBehaviorRoot(cfg, false);
    const raw = isObj(behavior[key]) ? behavior[key] : {};
    return cloneIt ? cloneJson(raw) : raw;
  }

  function buildTagWheelRulesMarkdownFromConfig(cfg) {
    const pkm = isObj(cfg && cfg.pkm) ? cfg.pkm : {};
    const io = getBehaviorSlice(cfg, "io", false);
    const inlineLayout = getBehaviorSlice(cfg, "inlineLayout", false);
    const dateRules = getBehaviorSlice(cfg, "dateRules", false);
    const behavior = getBehaviorRoot(cfg, true);
    const ui = getBehaviorSlice(cfg, "ui", false);
    const leftMode = getBehaviorSlice(cfg, "leftMode", false);
    const rightMode = getBehaviorSlice(cfg, "rightMode", false);
    const projects = getBehaviorSlice(cfg, "projects", false);
    const colors = getBehaviorSlice(cfg, "colors", false);
    const meta = getBehaviorSlice(cfg, "meta", true);

    behavior.subtagFormat = (pkm.behavior && pkm.behavior.subtagFormat === "combined") ? "combined" : "separate";
    behavior.defaultMode = String(behavior.defaultMode || "").trim().toLowerCase() === "right" ? "right" : "left";
    meta.generatedBy = "inline-overhaul";
    meta.generatedAt = new Date().toISOString();

    const blocks = [
      ["tagwheel-meta", meta],
      ["tagwheel-io", io],
      ["tagwheel-inline-layout", inlineLayout],
      ["tagwheel-date-rules", dateRules],
      ["tagwheel-behavior", behavior],
      ["tagwheel-ui", ui],
      ["tagwheel-left-mode", leftMode],
      ["tagwheel-right-mode", rightMode],
      ["tagwheel-projects", projects],
      ["tagwheel-colors", colors],
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
    buildTagWheelRulesMarkdownFromConfig,
  };
}

module.exports = {
  createRulesMarkdownBuilder,
};
