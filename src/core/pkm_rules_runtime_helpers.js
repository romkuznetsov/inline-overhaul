"use strict";

const __pkmDomainRegistry = (() => {
  try {
    if (typeof require === "function") {
      const mod = require("./pkm_domain_registry.js");
      if (mod && typeof mod === "object") return mod;
    }
  } catch (_) {}
  try {
    const g = globalThis && globalThis.__inlinePkmDomainRegistry;
    if (g && typeof g === "object") return g;
  } catch (_) {}
  return {
    resolveOrderKeyFromFieldId: (id) => String(id || "").trim(),
    collapseSubOrderKey: (key) => String(key || "").trim(),
  };
})();

function collapseSubOrderKey(key) {
  const raw = String(key || "").trim();
  if (!raw) return "";
  if (typeof __pkmDomainRegistry.collapseSubOrderKey === "function") {
    const collapsed = String(__pkmDomainRegistry.collapseSubOrderKey(raw) || "").trim();
    if (collapsed) {
      if (/_sub$/.test(raw) && collapsed === raw) return raw.slice(0, -4);
      return collapsed;
    }
  }
  return /_sub$/.test(raw) ? raw.slice(0, -4) : raw;
}

function getFieldSourceValue(fieldOrSource) {
  if (typeof fieldOrSource === "string") return String(fieldOrSource || "").trim();
  return String(fieldOrSource && fieldOrSource.source || "").trim();
}

function normalizeFieldSourceKind(fieldOrSource) {
  const source = getFieldSourceValue(fieldOrSource);
  if (!source) return "none";
  if (source === "projects") return "projects";
  if (source.indexOf("wikilinks:") === 0) return "wikilinks";
  return "tag";
}

function isProjectsSourceField(fieldOrSource) {
  return normalizeFieldSourceKind(fieldOrSource) === "projects";
}

function isWikilinkSourceField(fieldOrSource) {
  const kind = normalizeFieldSourceKind(fieldOrSource);
  return kind === "projects" || kind === "wikilinks";
}

function isSourceDrivenField(fieldOrSource) {
  const kind = normalizeFieldSourceKind(fieldOrSource);
  return kind === "projects" || kind === "wikilinks";
}

function buildPathCandidates(pathLike) {
  const src = String(pathLike || "").trim();
  const out = [];
  const push = (p) => {
    const v = String(p || "").trim();
    if (!v || out.includes(v)) return;
    out.push(v);
  };
  push(src);
  if (src.startsWith("./")) push(src.slice(2));
  else push("./" + src);
  if (src.includes("/")) push(src.slice(src.lastIndexOf("/") + 1));
  return out;
}

function normalizeRulesPath(raw, defaultRulesPath) {
  const fallback = String(defaultRulesPath || "").trim();
  if (!fallback) throw new Error("pkm_rules_runtime_helpers: defaultRulesPath is required");
  const src = String(raw || "").trim() || fallback;
  return /\.md$/i.test(src) ? src : (src + ".md");
}

async function readRulesMarkdownWithFallback(app_, rawPath, defaultRulesPath) {
  const normalized = normalizeRulesPath(rawPath, defaultRulesPath);
  const candidates = buildPathCandidates(normalized);
  const fallback = normalizeRulesPath(defaultRulesPath, defaultRulesPath);
  for (const p of buildPathCandidates(fallback)) {
    if (!candidates.includes(p)) candidates.push(p);
  }
  const adapter = app_ && app_.vault ? app_.vault.adapter : null;
  for (const p of candidates) {
    const af = app_.vault.getAbstractFileByPath(p);
    if (af) {
      const md = await app_.vault.read(af);
      return { markdown: md, path: p };
    }
    if (adapter && typeof adapter.read === "function") {
      try {
        const md = await adapter.read(p);
        return { markdown: md, path: p };
      } catch (_) {}
    }
  }
  throw new Error("Rules file not found: " + normalized);
}

function parseOrderConfig(raw, normalizeKey) {
  let src = raw;
  const normalize = typeof normalizeKey === "function" ? normalizeKey : ((k) => String(k || "").trim());
  if (typeof src === "string") {
    const s = src.trim();
    if (!s) src = null;
    else {
      try { src = JSON.parse(s); }
      catch (_) { src = null; }
    }
  }
  const leftDefault = [];
  const rightDefault = [];
  const activeDefault = {};
  const enabledDefault = {};
  const out = {
    left: leftDefault.slice(),
    right: rightDefault.slice(),
    lead: {},
    active: { ...activeDefault },
    freeRoam: {},
    freeRoamBehavior: {
      minimalSeparator: true,
      minimalPrefix: true,
      offPrefix: false,
      fullPlacement: "smart",
    },
    enabled: { ...enabledDefault },
    labels: {},
    strictNames: {},
    propertiesByField: {},
    types: {},
  };
  if (!src || typeof src !== "object" || Array.isArray(src)) return out;
  const discover = new Set(Object.keys(activeDefault));
  const collect = (k) => {
    const key = normalize(String(k || "").trim());
    if (!key) return;
    discover.add(key);
  };
  if (Array.isArray(src.left)) for (const k of src.left) collect(k);
  if (Array.isArray(src.right)) for (const k of src.right) collect(k);
  if (src.active && typeof src.active === "object" && !Array.isArray(src.active)) {
    for (const k of Object.keys(src.active)) collect(k);
  }
  if (src.enabled && typeof src.enabled === "object" && !Array.isArray(src.enabled)) {
    for (const k of Object.keys(src.enabled)) collect(k);
  }
  for (const k of Array.from(discover)) {
    if (!Object.prototype.hasOwnProperty.call(out.active, k)) out.active[k] = "yes";
    if (!Object.prototype.hasOwnProperty.call(out.freeRoam, k)) out.freeRoam[k] = "off";
    if (!Object.prototype.hasOwnProperty.call(out.enabled, k)) out.enabled[k] = true;
  }
  const normArr = (arr) => arr.map((x) => normalize(String(x || "").trim())).filter(Boolean);
  if (Array.isArray(src.left)) out.left = normArr(src.left);
  if (Array.isArray(src.right)) out.right = normArr(src.right);
  if (src.lead && typeof src.lead === "object" && !Array.isArray(src.lead)) {
    const leftLead = normalize(src.lead.left);
    const rightLead = normalize(src.lead.right);
    if (leftLead && out.left.includes(leftLead)) out.lead.left = leftLead;
    if (rightLead && out.right.includes(rightLead)) out.lead.right = rightLead;
  }
  if (src.active && typeof src.active === "object" && !Array.isArray(src.active)) {
    for (const rawKey of Object.keys(src.active)) {
      const key = normalize(rawKey);
      if (!(key in out.active)) continue;
      const raw = String(src.active[rawKey] || "").trim().toLowerCase();
      if (raw === "yes" || raw === "no" || raw === "hotkey_only") out.active[key] = raw;
    }
  }
  if (src.freeRoam && typeof src.freeRoam === "object" && !Array.isArray(src.freeRoam)) {
    for (const rawKey of Object.keys(src.freeRoam)) {
      const key = normalize(rawKey);
      if (!(key in out.freeRoam)) continue;
      const raw = String(src.freeRoam[rawKey] || "").trim().toLowerCase();
      out.freeRoam[key] = raw === "minimal" || raw === "full" ? raw : "off";
    }
  }
  if (src.freeRoamBehavior && typeof src.freeRoamBehavior === "object" && !Array.isArray(src.freeRoamBehavior)) {
    if (typeof src.freeRoamBehavior.minimalSeparator === "boolean") {
      out.freeRoamBehavior.minimalSeparator = src.freeRoamBehavior.minimalSeparator;
    }
    if (typeof src.freeRoamBehavior.minimalPrefix === "boolean") {
      out.freeRoamBehavior.minimalPrefix = src.freeRoamBehavior.minimalPrefix;
    }
    if (typeof src.freeRoamBehavior.offPrefix === "boolean") {
      out.freeRoamBehavior.offPrefix = src.freeRoamBehavior.offPrefix;
    }
    const placement = String(src.freeRoamBehavior.fullPlacement || "").trim().toLowerCase();
    if (placement === "smart" || placement === "left" || placement === "right") {
      out.freeRoamBehavior.fullPlacement = placement;
    }
  }
  if (src.enabled && typeof src.enabled === "object" && !Array.isArray(src.enabled)) {
    for (const rawKey of Object.keys(src.enabled)) {
      const key = normalize(rawKey);
      if (!(key in out.enabled)) continue;
      if (typeof src.enabled[rawKey] !== "boolean") continue;
      if (!(src.active && typeof src.active === "object" && !Array.isArray(src.active)
        && (Object.prototype.hasOwnProperty.call(src.active, rawKey) || Object.prototype.hasOwnProperty.call(src.active, key)))) {
        out.active[key] = src.enabled[rawKey] ? "yes" : "no";
      }
    }
  }
  if (src.labels && typeof src.labels === "object" && !Array.isArray(src.labels)) {
    for (const rawKey of Object.keys(src.labels)) {
      const key = normalize(rawKey);
      if (!key) continue;
      const v = String(src.labels[rawKey] || "").trim();
      if (!v) continue;
      out.labels[key] = v;
    }
  }
  if (src.strictNames && typeof src.strictNames === "object" && !Array.isArray(src.strictNames)) {
    for (const rawKey of Object.keys(src.strictNames)) {
      const key = normalize(rawKey);
      if (!key) continue;
      const v = String(src.strictNames[rawKey] || "").trim();
      if (!v) continue;
      out.strictNames[key] = v;
    }
  }
  if (src.types && typeof src.types === "object" && !Array.isArray(src.types)) {
    for (const rawKey of Object.keys(src.types)) {
      const key = normalize(rawKey);
      if (!key) continue;
      const v = String(src.types[rawKey] || "").trim().toLowerCase();
      if (v !== "tag" && v !== "wikilink" && v !== "element") continue;
      out.types[key] = v;
    }
  }
  if (src.propertiesByField && typeof src.propertiesByField === "object" && !Array.isArray(src.propertiesByField)) {
    for (const rawKey of Object.keys(src.propertiesByField)) {
      const key = normalize(rawKey);
      if (!key) continue;
      const v = String(src.propertiesByField[rawKey] || "").trim();
      if (!v) continue;
      out.propertiesByField[key] = v;
    }
  }
  for (const k of Object.keys(out.enabled)) out.enabled[k] = out.active[k] !== "no";
  for (const k of Object.keys(out.active)) {
    if (!Object.prototype.hasOwnProperty.call(out.labels, k)) out.labels[k] = k;
    if (!Object.prototype.hasOwnProperty.call(out.strictNames, k)) out.strictNames[k] = k;
    if (!Object.prototype.hasOwnProperty.call(out.freeRoam, k)) out.freeRoam[k] = "off";
  }
  return out;
}

function resolveFieldFreeRoamMode(orderCfg, fieldKey) {
  const key = String(fieldKey || "").trim();
  if (!key) return "off";
  const src = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.freeRoam && typeof orderCfg.freeRoam === "object"
    ? orderCfg.freeRoam
    : {};
  const raw = String(src[key] || "").trim().toLowerCase();
  if (raw === "minimal" || raw === "full") return raw;
  return "off";
}

function resolveFreeRoamBehavior(orderCfg) {
  const src = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.freeRoamBehavior && typeof orderCfg.freeRoamBehavior === "object"
    ? orderCfg.freeRoamBehavior
    : {};
  const placement = String(src.fullPlacement || "").trim().toLowerCase();
  const sepRaw = src.minimalSeparator;
  const sepStr = String(sepRaw == null ? "" : sepRaw).trim().toLowerCase();
  const minimalSeparator = !(sepRaw === false || sepStr === "false" || sepStr === "off" || sepStr === "no" || sepStr === "0");
  const prefixRaw = src.minimalPrefix;
  const prefixStr = String(prefixRaw == null ? "" : prefixRaw).trim().toLowerCase();
  const minimalPrefix = !(prefixRaw === false || prefixStr === "false" || prefixStr === "off" || prefixStr === "no" || prefixStr === "0");
  const offPrefixRaw = src.offPrefix;
  const offPrefixStr = String(offPrefixRaw == null ? "" : offPrefixRaw).trim().toLowerCase();
  const offPrefix = !!(offPrefixRaw === true || offPrefixStr === "true" || offPrefixStr === "on" || offPrefixStr === "yes" || offPrefixStr === "1");
  return {
    minimalSeparator,
    minimalPrefix,
    offPrefix,
    fullPlacement: placement === "left" || placement === "right" ? placement : "smart",
  };
}

function resolveFieldActiveMode(orderCfg, fieldKey) {
  const key = String(fieldKey || "").trim();
  if (!key) return "yes";
  const active = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.active && typeof orderCfg.active === "object"
    ? orderCfg.active
    : {};
  const raw = String(active[key] || "").trim().toLowerCase();
  if (raw === "no" || raw === "hotkey_only") return raw;
  return "yes";
}

function resolvePanelForField(orderCfg, fieldKey, options) {
  const opts = options && typeof options === "object" ? options : {};
  const fallback = String(opts.defaultPanel || "left").trim().toLowerCase() === "right" ? "right" : "left";
  const normalize = typeof opts.normalizeKey === "function"
    ? opts.normalizeKey
    : ((k) => String(k || "").trim());
  const key = String(normalize(fieldKey) || "").trim();
  if (!key) return fallback;
  const enabled = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.enabled && typeof orderCfg.enabled === "object"
    ? orderCfg.enabled
    : {};
  const panelMap = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.panel && typeof orderCfg.panel === "object"
    ? orderCfg.panel
    : {};
  const activeMode = resolveFieldActiveMode(orderCfg, key);
  if (activeMode === "no" || activeMode === "hotkey_only") return fallback;
  if (enabled[key] === false) return fallback;
  if (Object.prototype.hasOwnProperty.call(panelMap, key)) {
    const panelRaw = String(panelMap[key] || "").trim().toLowerCase();
    if (panelRaw === "left" || panelRaw === "right") return panelRaw;
  }
  if (fallback === "left") {
    const right = Array.isArray(orderCfg && orderCfg.right) ? orderCfg.right : [];
    if (right.includes(key)) return "right";
    return "left";
  }
  const left = Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left : [];
  if (left.includes(key)) return "left";
  return "right";
}

function buildPanelOrderKeys(orderCfg, panelName, options) {
  const opts = options && typeof options === "object" ? options : {};
  const panel = String(panelName || "left").trim().toLowerCase() === "right" ? "right" : "left";
  const src = panel === "right"
    ? (Array.isArray(orderCfg && orderCfg.right) ? orderCfg.right : [])
    : (Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left : []);
  const enabled = orderCfg && typeof orderCfg === "object" && !Array.isArray(orderCfg) && orderCfg.enabled && typeof orderCfg.enabled === "object"
    ? orderCfg.enabled
    : {};
  const include = new Set(Array.isArray(opts.includeKeys) ? opts.includeKeys : []);
  const useInclude = include.size > 0;
  const collapseSubs = !!opts.collapseSubToParent;
  const out = [];
  const push = (k) => {
    if (!k) return;
    const activeMode = resolveFieldActiveMode(orderCfg, k);
    if (activeMode === "no" || activeMode === "hotkey_only") return;
    if (enabled[k] === false) return;
    if (useInclude && !include.has(k)) return;
    let key = k;
    if (collapseSubs) key = collapseSubOrderKey(key);
    if (!out.includes(key)) out.push(key);
  };

  for (const rawKey of src) {
    const k = String(rawKey || "").trim();
    if (!k) continue;
    push(k);
    const subCandidates = Object.keys(enabled).filter((cand) => {
      const ck = String(cand || "").trim();
      if (!ck || ck === k || !/_sub$/.test(ck)) return false;
      return collapseSubOrderKey(ck) === k;
    });
    for (const subKey of subCandidates) {
      if (enabled[subKey] === false) continue;
      push(subKey);
    }
  }
  return out;
}

function buildDateMarkers(timeMarker, startMarker, dueMarker) {
  const due = String(dueMarker || "").trim();
  const start = String(startMarker || "").trim();
  const time = String(timeMarker || "").trim();
  return {
    due: due ? [due] : [],
    start: start ? [start] : [],
    time: time ? [time] : [],
  };
}

function getDateFieldsFromRules(rules, options) {
  const opts = options && typeof options === "object" ? options : {};
  const strict = opts.strict === true;
  const rightFields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : [];
  const behavior = rules && typeof rules.behavior === "object" && !Array.isArray(rules.behavior) ? rules.behavior : {};
  const dateRuntimeCfg = behavior && typeof behavior.dateRuntimeConfig === "object" && !Array.isArray(behavior.dateRuntimeConfig)
    ? behavior.dateRuntimeConfig
    : {};
  const canonical = dateRuntimeCfg && typeof dateRuntimeCfg.canonical === "object" && !Array.isArray(dateRuntimeCfg.canonical)
    ? dateRuntimeCfg.canonical
    : {};
  let due = null;
  let start = null;
  let timeNow = null;
  const dateOffset = [];
  const fieldByKey = {};
  const bindFieldKey = (key, field) => {
    const k = String(key || "").trim();
    if (!k || !field || fieldByKey[k]) return;
    fieldByKey[k] = field;
  };
  const resolveByAnyKey = (key) => {
    const k = String(key || "").trim();
    if (!k) return null;
    return fieldByKey[k] || null;
  };

  for (const field of rightFields) {
    if (!field || typeof field !== "object" || Array.isArray(field)) continue;
    const kind = String(field.kind || "").trim();
    bindFieldKey(String(field.id || "").trim(), field);
    bindFieldKey(String(field.orderKey || "").trim(), field);
    if (!timeNow && (kind === "nowTime" || kind === "estimatedCycle")) {
      timeNow = field;
      continue;
    }
    if (kind === "dateOffset") {
      dateOffset.push(field);
    }
  }

  due = resolveByAnyKey(canonical.due);
  start = resolveByAnyKey(canonical.start);
  if (!timeNow) timeNow = resolveByAnyKey(canonical.time);

  const dueKey = String(canonical.due || "").trim();
  const startKey = String(canonical.start || "").trim();
  const timeKey = String(canonical.time || "").trim();
  if (strict && dueKey && !due) throw new Error(`pkm_rules_runtime_helpers getDateFieldsFromRules: canonical.due unresolved (${dueKey})`);
  if (strict && startKey && !start) throw new Error(`pkm_rules_runtime_helpers getDateFieldsFromRules: canonical.start unresolved (${startKey})`);
  if (strict && timeKey && !timeNow) throw new Error(`pkm_rules_runtime_helpers getDateFieldsFromRules: canonical.time unresolved (${timeKey})`);

  if (dateOffset.length) {
    if (dateOffset.length === 1 && !due) due = dateOffset[0] || null;
    if (strict && dateOffset.length > 1 && (!due || !start)) {
      throw new Error("pkm_rules_runtime_helpers getDateFieldsFromRules: ambiguous dateOffset mapping; set dateRuntimeConfig.canonical.due/start")
    }
  }

  return { due, start, timeNow };
}

function getDateValuePatterns() {
  return {
    dateIso: "\\d{4}-\\d{2}-\\d{2}",
    timeHm: "\\d{2}:\\d{2}",
  };
}

function getDefaultDateLikeMarkers() {
  return [];
}

function isDateLikeToken(token, options) {
  const opts = options && typeof options === "object" ? options : {};
  const markers = Array.isArray(opts.markers) && opts.markers.length
    ? opts.markers
    : getDefaultDateLikeMarkers();
  const src = String(token || "").trim();
  if (!src) return false;
  for (const marker of markers) {
    const mk = String(marker || "");
    if (mk && src.startsWith(mk) && src.length > mk.length) return true;
  }
  return false;
}

function hasDateLikeMarkerInText(text, options) {
  const opts = options && typeof options === "object" ? options : {};
  const markers = Array.isArray(opts.markers) && opts.markers.length
    ? opts.markers
    : getDefaultDateLikeMarkers();
  const src = String(text || "");
  if (!src) return false;
  for (const marker of markers) {
    const mk = String(marker || "");
    if (mk && src.includes(mk)) return true;
  }
  return false;
}

function removeMarkerTokensFromSegment(segText, marker, valueRx) {
  const src = String(segText || "");
  const mk = String(marker || "");
  if (!mk) return src;
  let out = src;
  const value = String(valueRx || "").trim();
  if (value) {
    const rxValue = new RegExp(`(^|\\s)${escapeRegex(mk)}${value}(?=\\s|$)`, "gu");
    out = out.replace(rxValue, "$1");
  }
  const rxFallback = new RegExp(`(^|\\s)${escapeRegex(mk)}[^\\s]+(?=\\s|$)`, "g");
  out = out.replace(rxFallback, "$1");
  const rxEmpty = new RegExp(`(^|\\s)${escapeRegex(mk)}(?:${escapeRegex(mk)})*(?=\\s|$)`, "gu");
  out = out.replace(rxEmpty, "$1");
  return out.replace(/\s+/g, " ").trim();
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getDateMarkersFromRules(rules, options) {
  const opts = options && typeof options === "object" ? options : {};
  const dateFields = getDateFieldsFromRules(rules);
  const rightFields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : [];
  const behavior = rules && typeof rules.behavior === "object" && !Array.isArray(rules.behavior) ? rules.behavior : {};
  const dateRuntimeCfg = behavior && typeof behavior.dateRuntimeConfig === "object" && !Array.isArray(behavior.dateRuntimeConfig)
    ? behavior.dateRuntimeConfig
    : {};
  const byField = dateRuntimeCfg && typeof dateRuntimeCfg.byField === "object" && !Array.isArray(dateRuntimeCfg.byField)
    ? dateRuntimeCfg.byField
    : {};
  const canonical = dateRuntimeCfg && typeof dateRuntimeCfg.canonical === "object" && !Array.isArray(dateRuntimeCfg.canonical)
    ? dateRuntimeCfg.canonical
    : {};
  let due = String(opts.defaultDue || "").trim();
  let start = String(opts.defaultStart || "").trim();
  let time = String(opts.defaultTime || "").trim();
  if (dateFields.due && dateFields.due.marker) due = String(dateFields.due.marker);
  if (dateFields.start && dateFields.start.marker) start = String(dateFields.start.marker);
  if (dateFields.timeNow && dateFields.timeNow.marker) time = String(dateFields.timeNow.marker);
  const out = buildDateMarkers(time, start, due);
  const markerOrderPairs = [];
  const seenPairs = new Set();

  const runtimeKeysForField = (field) => {
    const outKeys = [];
    const push = (v) => {
      const k = String(v || "").trim();
      if (!k || outKeys.includes(k)) return;
      outKeys.push(k);
    };
    const orderKey = String(field && field.orderKey || "").trim();
    const fieldId = String(field && field.id || "").trim();
    push(orderKey);
    push(fieldId);
    for (const ck of Object.keys(canonical)) {
      const cv = String(canonical[ck] || "").trim();
      if (cv && (cv === orderKey || cv === fieldId)) {
        push(ck);
        push(cv);
      }
    }
    return outKeys;
  };

  const runtimeMarkerForField = (field) => {
    const keys = runtimeKeysForField(field);
    for (const key of keys) {
      const row = byField && typeof byField[key] === "object" && byField[key] ? byField[key] : null;
      if (!row) continue;
      const marker = String(row.emoji || row.marker || "").trim();
      if (marker) return marker;
    }
    return "";
  };

  for (const field of rightFields) {
    if (!field || typeof field !== "object" || Array.isArray(field)) continue;
    const kind = String(field.kind || "").trim();
    if (kind !== "dateOffset" && kind !== "nowTime" && kind !== "estimatedCycle" && kind !== "genericElement") continue;
    const marker = String(field.marker || "").trim() || runtimeMarkerForField(field);
    const orderKey = String(field.orderKey || "").trim();
    if (!marker || !orderKey) continue;
    const dedup = `${marker}::${orderKey}`;
    if (seenPairs.has(dedup)) continue;
    seenPairs.add(dedup);
    markerOrderPairs.push({ marker, orderKey });
  }
  out.all = Array.from(new Set(markerOrderPairs.map((x) => String(x.marker || "").trim()).filter(Boolean)));
  out.orderKeysByMarker = {};
  for (const pair of markerOrderPairs) {
    const marker = String(pair.marker || "").trim();
    const orderKey = String(pair.orderKey || "").trim();
    if (!marker || !orderKey) continue;
    if (!out.orderKeysByMarker[marker]) out.orderKeysByMarker[marker] = orderKey;
  }
  out.orderKeys = {
    time: String(dateFields.timeNow && dateFields.timeNow.orderKey || "").trim(),
    start: String(dateFields.start && dateFields.start.orderKey || "").trim(),
    due: String(dateFields.due && dateFields.due.orderKey || "").trim(),
  };
  return out;
}

function reorderSegmentTokensByOrder(segText, orderCfg, panelName, tokenToKey, options) {
  const opts = options && typeof options === "object" ? options : {};
  const source = String(segText || "").trim();
  const match = source.match(/^(-\s+(?:\[[^\]]\]\s+)?)(.*)$/);
  const lead = match ? match[1] : "";
  const body = match ? String(match[2] || "").trim() : source;
  const parts = body.split(/\s+/).filter(Boolean);
  if (!parts.length) return lead ? String(lead).trim() : "";

  const orderKeys = buildPanelOrderKeys(orderCfg, panelName, {
    includeKeys: opts.includeKeys,
    collapseSubToParent: !!opts.collapseSubToParent,
  });
  if (!orderKeys.length) return source;

  const rank = {};
  for (let i = 0; i < orderKeys.length; i++) rank[orderKeys[i]] = i;
  const map = tokenToKey && typeof tokenToKey === "object" ? tokenToKey : {};
  const markers = opts.markers && typeof opts.markers === "object" ? opts.markers : null;

  const keyOf = (tokenInput) => {
    let token = String(tokenInput || "");
    if (opts.normalizeSlashToken && /^\/\S+/.test(token)) token = `#${token}`;

    let key = map[token] || "";
    if (opts.collapseSubToParent) {
      key = collapseSubOrderKey(key);
    }

    if (!key && typeof opts.resolveTokenKey === "function") {
      key = String(opts.resolveTokenKey(token, { orderCfg, panelName, tokenToKey: map, options: opts }) || "").trim();
      if (opts.collapseSubToParent) key = collapseSubOrderKey(key);
    }
    if (!key && markers) {
      const markerMap = markers.orderKeysByMarker && typeof markers.orderKeysByMarker === "object" ? markers.orderKeysByMarker : {};
      const markerList = Array.isArray(markers.all) && markers.all.length
        ? markers.all
        : Object.keys(markerMap);
      for (const mk of markerList) {
        const marker = String(mk || "").trim();
        if (!marker) continue;
        if (!token.startsWith(marker)) continue;
        const mapped = String(markerMap[marker] || "").trim();
        if (!mapped) continue;
        key = mapped;
        break;
      }
      const markerKeys = markers.orderKeys && typeof markers.orderKeys === "object" ? markers.orderKeys : {};
      if (!key) for (const mk of (markers.time || [])) if (mk && token.startsWith(mk)) { key = String(markerKeys.time || "").trim(); break; }
      if (!key) for (const mk of (markers.start || [])) if (mk && token.startsWith(mk)) { key = String(markerKeys.start || "").trim(); break; }
      if (!key) for (const mk of (markers.due || [])) if (mk && token.startsWith(mk)) { key = String(markerKeys.due || "").trim(); break; }
    }
    return { key, token };
  };

  const buckets = {};
  const unknown = [];
  for (const part of parts) {
    const resolved = keyOf(part);
    if (!resolved.key || rank[resolved.key] === undefined) {
      unknown.push(resolved.token);
      continue;
    }
    (buckets[resolved.key] ||= []).push(resolved.token);
  }

  const out = [];
  for (const key of orderKeys) {
    const arr = buckets[key] || [];
    for (const token of arr) out.push(token);
  }
  for (const token of unknown) out.push(token);

  const joined = out.join(" ").trim();
  if (!lead) return joined;
  const merged = joined ? `${lead}${joined}` : lead;
  return String(merged).replace(/\s+$/, "");
}

function getDefaultTagTokenKeyMapOptions() {
  return {
    projectTagWhenWikilink: true,
    activeFlagKeys: ["active", "enabled"],
  };
}

function getStatusTagReorderOptions() {
  return {
    includeKeys: null,
    collapseSubToParent: false,
    normalizeSlashToken: true,
    projectFromWikilink: false,
  };
}

function getStatusMixedReorderOptions(markers) {
  return {
    includeKeys: null,
    collapseSubToParent: false,
    normalizeSlashToken: true,
    projectFromWikilink: false,
    markers,
  };
}

function getUnifiedMixedReorderOptions(markers) {
  return getStatusMixedReorderOptions(markers);
}

function getTagWheelMixedReorderOptions(markers) {
  return getUnifiedMixedReorderOptions(markers);
}

function collectSourceCatalogValues(sourceConfig) {
  const out = [];
  const seen = new Set();
  const visited = new Set();

  const pushRaw = (raw) => {
    const text = String(raw || "").trim();
    if (!text) return;
    let token = text;
    let link = text;
    if (/^\[\[[^\]]+\]\]$/.test(text)) {
      const body = text.slice(2, -2).trim();
      if (!body) return;
      token = body;
      link = body;
    } else if (/^#\S+/.test(text)) {
      token = text.replace(/^#/, "");
      link = token;
    }
    const dedupe = `${token}::${link}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push({ id: token, token, link });
  };

  const pushObj = (obj) => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
    const tokenRaw = String(obj.token || obj.id || obj.link || "").trim();
    if (!tokenRaw) return;
    let token = tokenRaw;
    let link = String(obj.link || tokenRaw).trim();
    if (/^\[\[[^\]]+\]\]$/.test(token)) token = token.slice(2, -2).trim();
    if (/^\[\[[^\]]+\]\]$/.test(link)) link = link.slice(2, -2).trim();
    token = token.replace(/^#/, "").trim();
    if (!token) return;
    if (!link) link = token;
    const dedupe = `${token}::${link}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push({ ...obj, id: String(obj.id || token), token, link });
  };

  const walk = (node) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === "string") pushRaw(item);
        else walk(item);
      }
      return;
    }
    if (typeof node === "string") {
      pushRaw(node);
      return;
    }
    if (typeof node !== "object") return;
    if (visited.has(node)) return;
    visited.add(node);
    pushObj(node);
    for (const key of Object.keys(node)) {
      walk(node[key]);
    }
  };

  walk(sourceConfig);
  return out;
}

function buildTagTokenKeyMap(rules, options) {
  const opts = options && typeof options === "object" ? options : {};
  const activeFlagKeys = Array.isArray(opts.activeFlagKeys) && opts.activeFlagKeys.length
    ? opts.activeFlagKeys
    : ["active", "enabled"];
  const projectTagWhenWikilink = opts.projectTagWhenWikilink !== false;

  const isActiveValue = (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    for (const flag of activeFlagKeys) {
      if (v[flag] === false) return false;
    }
    return true;
  };
  const activeValues = (field) => {
    const vals = Array.isArray(field && field.values) ? field.values : [];
    const source = String(field && field.source ? field.source : "").trim();
    const srcCfg = source && rules && typeof rules[source] === "object" && rules[source] ? rules[source] : null;
    const out = [];
    const seen = new Set();

    const pushVal = (v) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return;
      const token = String(v.token || "").trim();
      if (!token) return;
      const link = String(v.link || token).trim();
      const id = String(v.id || token).trim();
      const dedupe = `${id}::${token}::${link}`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);
      out.push({ ...v, id, token, link });
    };

    for (const v of vals) pushVal(v);
    if (srcCfg) {
      const sourceVals = collectSourceCatalogValues(srcCfg);
      for (const sv of sourceVals) pushVal(sv);
    }

    return out.filter(isActiveValue);
  };
  const composeToken = (prefix, rawToken) => {
    const p = typeof prefix === "string" ? prefix : "#";
    const t = String(rawToken || "").trim();
    if (!t) return "";
    if (/^\[\[[^\]]+\]\]$/.test(t)) return t;
    if (/^#\S+/.test(t)) return t;
    if (p && t.startsWith(p)) return t;
    if (!p && /^\/\S+/.test(t)) return `#${t}`;
    return `${p}${t}`;
  };

  const leftFields = rules && rules.leftMode && Array.isArray(rules.leftMode.fields) ? rules.leftMode.fields : [];
  const fieldById = (id) => leftFields.find((f) => f && f.id === id) || null;
  const out = {};

  const normalizeOrderKey = (field) => {
    if (!field) return "";
    const explicit = String(field.orderKey || "").trim();
    if (explicit) return explicit;
    if (typeof __pkmDomainRegistry.resolveOrderKeyFromFieldId === "function") {
      const mapped = String(__pkmDomainRegistry.resolveOrderKeyFromFieldId(field.id || "") || "").trim();
      if (mapped) return mapped;
    }
    const source = String(field.source || "").trim();
    const id = String(field.id || "").trim();
    if (id) return id;
    if (source.endsWith("s") && source.length > 1) return source.slice(0, -1);
    return source;
  };

  const resolveFieldOutputMode = (field) => {
    if (field && typeof field.outputMode === "string") {
      const local = String(field.outputMode).trim().toLowerCase();
      if (local) return local;
    }
    const source = String(field && field.source ? field.source : "").trim();
    if (source === "projects" || source.indexOf("wikilinks:") === 0) return "wikilink";
    if (source && rules && rules[source] && typeof rules[source].output === "string") {
      return String(rules[source].output).trim().toLowerCase() || "tag";
    }
    return "tag";
  };

  const addFieldTokens = (key, field) => {
    if (!field) return;
    const vals = activeValues(field);
    const outputMode = resolveFieldOutputMode(field);
    for (const v of vals) {
      const rawToken = String(v && v.token ? v.token : "");
      if (!rawToken) continue;
      const link = String(v && v.link ? v.link : rawToken).trim();
      if (outputMode === "wikilink" && link) out[`[[${link}]]`] = key;
      if (outputMode !== "wikilink" || projectTagWhenWikilink) {
        const pref = typeof field.prefix === "string" ? field.prefix : "#";
        const tok = composeToken(pref, rawToken);
        if (tok) out[tok] = key;
      }
    }
  };

  for (const field of leftFields) {
    const key = normalizeOrderKey(field);
    if (!key) continue;
    addFieldTokens(key, field);
  }

  const pairEntries = [];
  const pushPair = (parentField, subField) => {
    if (!parentField || !parentField.id || !subField || !subField.id) return;
    const dedupeKey = `${parentField.id}::${subField.id}`;
    if (pairEntries.some((p) => p.key === dedupeKey)) return;
    pairEntries.push({ key: dedupeKey, parentField, subField });
  };

  for (const subField of leftFields) {
    if (!subField || !subField.id) continue;
    const parentId = String(subField.dependsOn || "").trim();
    if (!parentId) continue;
    const parentField = fieldById(parentId);
    if (!parentField) continue;
    pushPair(parentField, subField);
  }

  for (const pair of pairEntries) {
    const parentField = pair.parentField;
    const subField = pair.subField;
    const parentKey = normalizeOrderKey(parentField);
    if (!parentKey) continue;
    const pref = typeof parentField.prefix === "string" ? parentField.prefix : "#";
    for (const pv of activeValues(parentField)) {
      const pTok = String(pv && pv.token ? pv.token : "");
      if (!pTok) continue;
      for (const sv of activeValues(subField)) {
        const sTok = String(sv && sv.token ? sv.token : "");
        if (!sTok) continue;
        out[composeToken(pref, `${pTok}/${sTok}`)] = parentKey;
      }
    }
  }
  return out;
}

function applyOrderToRules(rules, orderCfg, options) {
  const opts = options && typeof options === "object" ? options : {};
  const isObj = typeof opts.isObj === "function"
    ? opts.isObj
    : (x) => x && typeof x === "object" && !Array.isArray(x);

  if (!isObj(rules)) return;
  if (!isObj(rules.behavior)) rules.behavior = {};
  rules.behavior.order = {
    left: Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left.slice() : [],
    right: Array.isArray(orderCfg && orderCfg.right) ? orderCfg.right.slice() : [],
    lead: isObj(orderCfg && orderCfg.lead) ? { ...orderCfg.lead } : {},
    active: isObj(orderCfg && orderCfg.active) ? { ...orderCfg.active } : {},
    enabled: isObj(orderCfg && orderCfg.enabled) ? { ...orderCfg.enabled } : {},
    labels: isObj(orderCfg && orderCfg.labels) ? { ...orderCfg.labels } : {},
    strictNames: isObj(orderCfg && orderCfg.strictNames) ? { ...orderCfg.strictNames } : {},
    types: isObj(orderCfg && orderCfg.types) ? { ...orderCfg.types } : {},
  };
  const leftFields = Array.isArray(rules && rules.leftMode && rules.leftMode.fields) ? rules.leftMode.fields : [];
  const rightFields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : [];
  const allFields = leftFields.concat(rightFields);
  const byId = (arr, id) => arr.find((f) => f && String(f.id || "").trim() === String(id || "").trim());

  const dynamicKeys = [];
  const pushDyn = (k) => {
    const key = String(k || "").trim();
    if (!key || dynamicKeys.includes(key)) return;
    dynamicKeys.push(key);
  };
  for (const k of (orderCfg.left || [])) pushDyn(k);
  for (const k of (orderCfg.right || [])) pushDyn(k);
  for (const k of Object.keys(orderCfg.active || {})) pushDyn(k);
  for (const k of Object.keys(orderCfg.enabled || {})) pushDyn(k);
  for (const k of Object.keys(orderCfg.labels || {})) pushDyn(k);
  for (const k of Object.keys(orderCfg.strictNames || {})) pushDyn(k);
  for (const k of Object.keys(orderCfg.types || {})) pushDyn(k);

  const ids = {};
  const resolveIdByOrderKey = (key, visited) => {
    const k = String(key || "").trim();
    if (!k) return "";
    const seen = visited instanceof Set ? visited : new Set();
    if (seen.has(k)) return "";
    seen.add(k);
    const byOrder = allFields.find((f) => f && String(f.orderKey || "").trim() === k);
    if (byOrder && byOrder.id) return String(byOrder.id || "").trim();
    const byExactId = allFields.find((f) => f && String(f.id || "").trim() === k);
    if (byExactId && byExactId.id) return String(byExactId.id || "").trim();
    if (/_sub$/.test(k)) {
      const parentKey = collapseSubOrderKey(k);
      if (!parentKey || parentKey === k) return "";
      const parentId = ids[parentKey] || resolveIdByOrderKey(parentKey, seen);
      if (parentId) {
        const sub = leftFields.find((f) => f && String(f.dependsOn || "").trim() === String(parentId || "").trim());
        if (sub && sub.id) return String(sub.id || "").trim();
      }
    }
    return "";
  };

  for (const k of dynamicKeys) {
    const resolvedId = resolveIdByOrderKey(k);
    if (resolvedId) ids[k] = resolvedId;
  }

  const reorderModeFields = (mode, orderedIds) => {
    const fields = Array.isArray(mode && mode.fields) ? mode.fields : [];
    const byIdMap = new Map(fields.map((f) => [f && f.id, f]));
    const out = [];
    for (const id of orderedIds) if (byIdMap.has(id)) out.push(byIdMap.get(id));
    for (const f of fields) {
      if (!f || !f.id) continue;
      if (!orderedIds.includes(f.id)) out.push(f);
    }
    mode.fields = out;
  };

  const leftOrder = [];
  const rightOrder = [];
  for (const k of orderCfg.left || []) if (ids[k]) leftOrder.push(ids[k]);
  for (const k of orderCfg.right || []) if (ids[k]) rightOrder.push(ids[k]);
  reorderModeFields(rules.leftMode, leftOrder);
  reorderModeFields(rules.rightMode, rightOrder);

  const keyById = Object.fromEntries(Object.entries(ids).filter(([, v]) => v).map(([k, v]) => [v, k]));
  const leftOrderSet = new Set(Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left : []);
  const rightOrderSet = new Set(Array.isArray(orderCfg && orderCfg.right) ? orderCfg.right : []);

  const runtimeExcludedIds = new Set();
  const reconcileModeDependencies = (mode) => {
    const fields = Array.isArray(mode && mode.fields) ? mode.fields.slice() : [];
    const byId = new Map();
    for (const f of fields) {
      const fid = String(f && f.id || "").trim();
      if (!fid) continue;
      byId.set(fid, f);
    }
    const runtimeEligible = new Set();
    for (const f of fields) {
      const fid = String(f && f.id || "").trim();
      if (!fid) continue;
      const dep = String(f && f.dependsOn || "").trim();
      if (!dep) runtimeEligible.add(fid);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of fields) {
        const fid = String(f && f.id || "").trim();
        if (!fid || runtimeEligible.has(fid)) continue;
        const dep = String(f && f.dependsOn || "").trim();
        if (!dep || !byId.has(dep)) continue;
        if (!runtimeEligible.has(dep)) continue;
        runtimeEligible.add(fid);
        changed = true;
      }
    }

    const childrenByParent = new Map();
    const childIds = new Set();
    for (const f of fields) {
      const fid = String(f && f.id || "").trim();
      if (!fid) continue;
      const dep = String(f && f.dependsOn || "").trim();
      if (!dep) continue;
      childIds.add(fid);
      if (!childrenByParent.has(dep)) childrenByParent.set(dep, []);
      childrenByParent.get(dep).push(f);
    }

    const ordered = [];
    const used = new Set();
    const pushWithChildren = (parent) => {
      const pid = String(parent && parent.id || "").trim();
      if (!pid || used.has(pid)) return;
      ordered.push(parent);
      used.add(pid);
      const children = childrenByParent.get(pid) || [];
      for (const ch of children) {
        const cid = String(ch && ch.id || "").trim();
        if (!cid || used.has(cid)) continue;
        ordered.push(ch);
        used.add(cid);
      }
    };

    for (const f of fields) {
      const fid = String(f && f.id || "").trim();
      if (!fid || childIds.has(fid)) continue;
      pushWithChildren(f);
    }
    for (const f of fields) {
      const fid = String(f && f.id || "").trim();
      if (!fid || used.has(fid)) continue;
      ordered.push(f);
      used.add(fid);
    }

    for (const f of ordered) {
      const fid = String(f && f.id || "").trim();
      if (!fid) continue;
      const dep = String(f && f.dependsOn || "").trim();
      if (!dep) continue;
      const parentExists = byId.has(dep);
      if (!parentExists || !runtimeEligible.has(fid)) {
        f.enabled = false;
        runtimeExcludedIds.add(fid);
      }
      if (!parentExists) {
        f.dependsOn = "";
      }
    }
    mode.fields = ordered;
  };

  reconcileModeDependencies(rules.leftMode);
  reconcileModeDependencies(rules.rightMode);

  for (const f of allFields) {
    const k = keyById[f.id];
    const fid = String(f && f.id || "").trim();
    if (!k) {
      if (f && f.enabled !== false) f.enabled = false;
      continue;
    }
    const activeMode = resolveFieldActiveMode(orderCfg, k);
    if (activeMode === "no" || activeMode === "hotkey_only") f.enabled = false;
    else if (orderCfg.enabled && orderCfg.enabled[k] === false) f.enabled = false;
    else if (f.enabled === false && !runtimeExcludedIds.has(fid)) f.enabled = true;
    if (rightOrderSet.has(k)) f.panel = "right";
    else if (leftOrderSet.has(k)) f.panel = "left";
    f.orderKey = k;
    const label = String(orderCfg.labels && orderCfg.labels[k] ? orderCfg.labels[k] : "").trim();
    if (label) f.placeholder = label;
  }

  const prevTechOrder = Array.isArray(rules && rules.inlineLayout && rules.inlineLayout.techOrder)
    ? rules.inlineLayout.techOrder
    : [];
  const outTechOrder = [];
  const left = Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left : [];
  const pushUniq = (v) => { if (v && !outTechOrder.includes(v)) outTechOrder.push(v); };
  for (const k of left) {
    const id = String(ids[k] || "").trim();
    if (!id) continue;
    const field = byId(leftFields, id);
    if (!field) continue;
    if (isWikilinkSourceField(field)) {
      pushUniq(id);
      continue;
    }
    const dep = String(field.dependsOn || "").trim();
    if (dep) {
      pushUniq(dep);
      continue;
    }
    pushUniq(id);
  }
  if (!outTechOrder.length) {
    for (const slot of prevTechOrder) pushUniq(slot);
  }
  if (!outTechOrder.includes("otherTags")) {
    const hasWikilink = leftFields.some((f) => f && isWikilinkSourceField(f));
    if (hasWikilink) pushUniq("otherTags");
  }
  if (!isObj(rules.inlineLayout)) rules.inlineLayout = {};
  rules.inlineLayout.techOrder = outTechOrder;

  if (!isObj(rules.ui)) rules.ui = {};
  const allById = new Map();
  for (const f of leftFields) if (f && f.id) allById.set(f.id, f);
  for (const f of rightFields) if (f && f.id && !allById.has(f.id)) allById.set(f.id, f);
  const leftGroups = [];
  const seenLeftGroupFieldIds = new Set();
  const pushLeftGroup = (id, placeholder, fieldId, hideWhenDisabled) => {
    if (!fieldId || seenLeftGroupFieldIds.has(fieldId)) return;
    leftGroups.push({
      id,
      placeholder,
      fields: [fieldId],
      hideWhenDisabled: hideWhenDisabled === true,
    });
    seenLeftGroupFieldIds.add(fieldId);
  };
  const leftOrderArr = Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left : [];
  const resolveLeftDisplay = (k, field) => {
    const fromOrder = String(orderCfg.labels && orderCfg.labels[k] ? orderCfg.labels[k] : "").trim();
    if (fromOrder) return fromOrder;
    const fromField = String(field && field.placeholder ? field.placeholder : "").trim();
    if (fromField) return fromField;
    return String(k || "").trim();
  };
  for (const k of leftOrderArr) {
    const fieldId = ids[k] || "";
    if (!fieldId) continue;
    const field = allById.get(fieldId) || null;
    pushLeftGroup(`${k}Group`, resolveLeftDisplay(k, field), fieldId, !!(field && field.dependsOn));
    for (const cand of leftFields) {
      if (!cand || !cand.id) continue;
      if (String(cand.dependsOn || "").trim() !== String(fieldId || "").trim()) continue;
      const childKey = String(keyById[cand.id] || "").trim();
      if (childKey && rightOrderSet.has(childKey)) continue;
      pushLeftGroup(
        `${cand.id}Group`,
        resolveLeftDisplay(childKey || cand.id, cand),
        cand.id,
        true
      );
    }
  }
  rules.ui.leftPanelOrderMode = "manual";
  rules.ui.leftGroups = leftGroups;
}

module.exports = {
  buildPathCandidates,
  normalizeRulesPath,
  readRulesMarkdownWithFallback,
  parseOrderConfig,
  resolveFieldActiveMode,
  resolveFieldFreeRoamMode,
  resolveFreeRoamBehavior,
  resolvePanelForField,
  buildPanelOrderKeys,
  buildDateMarkers,
  getDateFieldsFromRules,
  getDateValuePatterns,
  getDefaultDateLikeMarkers,
  isDateLikeToken,
  hasDateLikeMarkerInText,
  removeMarkerTokensFromSegment,
  getDateMarkersFromRules,
  reorderSegmentTokensByOrder,
  getDefaultTagTokenKeyMapOptions,
  getStatusTagReorderOptions,
  getStatusMixedReorderOptions,
  getUnifiedMixedReorderOptions,
  getTagWheelMixedReorderOptions,
  buildTagTokenKeyMap,
  applyOrderToRules,
  normalizeFieldSourceKind,
  isProjectsSourceField,
  isWikilinkSourceField,
  isSourceDrivenField,
};
