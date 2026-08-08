"use strict";

function normalizePkmBehaviorShape(cfg, deps) {
  const isObj = deps && typeof deps.isObj === "function"
    ? deps.isObj
    : (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const cloneJson = deps && typeof deps.cloneJson === "function"
    ? deps.cloneJson
    : (x) => JSON.parse(JSON.stringify(x));

  const out = isObj(cfg) ? cfg : {};
  if (!isObj(out.pkm)) out.pkm = {};
  if (!isObj(out.pkm.behavior)) out.pkm.behavior = {};

  const behavior = isObj(out.pkm.behavior) ? out.pkm.behavior : {};
  const normalizeCheckbox = (token) => {
    try {
      const lf = require("./pkm_line_finalize_unified.js");
      if (lf && typeof lf.normalizeCheckboxToken === "function") return lf.normalizeCheckboxToken(token);
    } catch (_) {}
    const src = String(token || "").trim();
    if (!src) return "";
    const m = src.match(/^\[([\s\S]*)\]$/);
    if (!m) return "";
    const inner = String(m[1] || "").trim();
    return inner ? `[${inner}]` : "[ ]";
  };

  {
    const behaviorDefaultMode = String(behavior.defaultMode || "").trim().toLowerCase();
    if (behaviorDefaultMode === "left" || behaviorDefaultMode === "right") {
      behavior.defaultMode = behaviorDefaultMode;
    } else {
      behavior.defaultMode = "left";
    }
  }

  if (!isObj(behavior.typeCheckboxByValue)
    && isObj(behavior.prefixRules)
    && isObj(behavior.prefixRules.checkboxByFieldValue)
    && isObj(behavior.prefixRules.checkboxByFieldValue.type)) {
    behavior.typeCheckboxByValue = cloneJson(behavior.prefixRules.checkboxByFieldValue.type);
  }

  if (isObj(behavior.prefixRules)) {
    if (Array.isArray(behavior.prefixRules.priorityCheckboxes)) {
      behavior.prefixRules.priorityCheckboxes = Array.from(new Set(behavior.prefixRules.priorityCheckboxes
        .map((x) => normalizeCheckbox(x))
        .filter(Boolean)));
    }
    if (isObj(behavior.prefixRules.checkboxByFieldValue)) {
      const byField = behavior.prefixRules.checkboxByFieldValue;
      for (const fid of Object.keys(byField)) {
        if (!isObj(byField[fid])) continue;
        for (const tok of Object.keys(byField[fid])) {
          const norm = normalizeCheckbox(byField[fid][tok]);
          if (!norm) {
            delete byField[fid][tok];
            continue;
          }
          byField[fid][tok] = norm;
        }
      }
    }
  }

  out.pkm.behavior = behavior;
  return out;
}

module.exports = {
  normalizePkmBehaviorShape,
};
