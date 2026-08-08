"use strict";

function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function parseDateRuntimeConfigJson(raw) {
  const src = String(raw || "").trim();
  if (!src) return { byField: {}, canonical: {} };
  try {
    const j = JSON.parse(src);
    return {
      byField: isObj(j && j.byField) ? j.byField : {},
      canonical: isObj(j && j.canonical) ? j.canonical : {},
    };
  } catch (_) {
    return { byField: {}, canonical: {} };
  }
}

function resolveDateRuntimeKeyFromField(field, canonical, resolveOrderKeyFromFieldId) {
  const f = isObj(field) ? field : {};
  const id = String(f.id || "").trim();
  const orderKey = String(f.orderKey || "").trim();
  const keyByResolver = typeof resolveOrderKeyFromFieldId === "function"
    ? String(resolveOrderKeyFromFieldId(id) || "").trim()
    : "";
  if (keyByResolver) return keyByResolver;
  if (orderKey) return orderKey;
  if (id) return id;
  throw new Error("date_runtime_shared resolveDateRuntimeKeyFromField: unresolved key for date-like field");
}

function collectMissingEmojiFieldsFromRules(rules, dateRuntimeCfg, options) {
  const out = [];
  const seen = new Set();
  const opts = isObj(options) ? options : {};
  const resolveOrderKeyFromFieldId = typeof opts.resolveOrderKeyFromFieldId === "function"
    ? opts.resolveOrderKeyFromFieldId
    : null;
  const rt = isObj(dateRuntimeCfg) ? dateRuntimeCfg : {};
  const byField = isObj(rt.byField) ? rt.byField : {};
  const canonical = isObj(rt.canonical) ? rt.canonical : {};
  const right = Array.isArray(rules && rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : [];

  const addMissing = (fieldKey) => {
    const key = String(fieldKey || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };

  const hasEmoji = (row) => {
    const src = isObj(row) ? row : {};
    return String(src.emoji == null ? "" : src.emoji).trim().length > 0;
  };

  for (let i = 0; i < right.length; i++) {
    const f = right[i];
    if (!f) continue;
    const kind = String(f.kind || "");
    if (kind !== "dateOffset" && kind !== "nowTime" && kind !== "estimatedCycle" && kind !== "genericElement") continue;
    const key = resolveDateRuntimeKeyFromField(f, canonical, resolveOrderKeyFromFieldId);
    if (!key) continue;
    if (!hasEmoji(byField[key])) addMissing(key);
  }
  return out;
}

module.exports = {
  parseDateRuntimeConfigJson,
  resolveDateRuntimeKeyFromField,
  collectMissingEmojiFieldsFromRules,
};
