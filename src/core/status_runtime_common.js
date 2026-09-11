"use strict";

/*
 * Модуль дат приезжает литеральным `require` (У-89). Раньше он приходил
 * через мост модулей по пути внутри vault, и путь этот вместе с самой
 * зависимостью `loadVaultModule` передавал сюда каждый движок.
 */
const dateRuntimeShared = require("./date_runtime_shared.js");

function createStatusRuntimeCommon(deps) {
  const d = deps && typeof deps === "object" ? deps : {};
  const isObj = typeof d.isObj === "function"
    ? d.isObj
    : (x) => x && typeof x === "object" && !Array.isArray(x);
  const normalizeOrderKey = typeof d.normalizeOrderKey === "function"
    ? d.normalizeOrderKey
    : ((k) => String(k || "").trim());
  const orderConfigKey = String(d.orderConfigKey || "Order config");
  const dateRuntimeConfigKey = String(d.dateRuntimeConfigKey || "Date runtime config");
  const defaultPanel = String(d.defaultPanel || "left");

  const need = (name, fn) => {
    if (typeof fn !== "function") throw new Error(`status_runtime_common: missing dependency ${name}`);
    return fn;
  };

  const loadOrderKeyNormalizer = need("loadOrderKeyNormalizer", d.loadOrderKeyNormalizer);
  const loadRuntimePreloadFacade = need("loadRuntimePreloadFacade", d.loadRuntimePreloadFacade);

  function remapCursorByLineDiff(oldLine, newLine, oldCh) {
    const shared = globalThis.__inlinePkmMacroShared;
    if (shared && typeof shared.remapCursorByLineDiff === "function") {
      return shared.remapCursorByLineDiff(oldLine, newLine, oldCh);
    }
    throw new Error("pkm_macro_shared unavailable: remapCursorByLineDiff");
  }

  function remapCursorStable(oldLine, newLine, oldCh) {
    const shared = globalThis.__inlinePkmMacroShared;
    if (shared && typeof shared.remapCursorStable === "function") {
      return shared.remapCursorStable(oldLine, newLine, oldCh);
    }
    return remapCursorByLineDiff(oldLine, newLine, oldCh);
  }

  function normalizeCycleEndBehavior(v) {
    const shared = globalThis.__inlinePkmMacroShared;
    if (shared && typeof shared.normalizeCycleEndBehavior === "function") {
      return shared.normalizeCycleEndBehavior(v);
    }
    throw new Error("pkm_macro_shared unavailable: normalizeCycleEndBehavior");
  }

  function normalizeCursorPolicy(v) {
    const shared = globalThis.__inlinePkmMacroShared;
    if (shared && typeof shared.normalizeCursorPolicy === "function") {
      return shared.normalizeCursorPolicy(v);
    }
    throw new Error("pkm_macro_shared unavailable: normalizeCursorPolicy");
  }

  function parseOrderConfig(raw, normalizeKey) {
    const shared = globalThis.__inlinePkmRulesHelpers;
    if (shared && typeof shared.parseOrderConfig === "function") {
      return shared.parseOrderConfig(raw, normalizeKey);
    }
    throw new Error("pkm_rules_runtime_helpers unavailable: parseOrderConfig");
  }

  async function resolveOrderConfig(app_, settings) {
    const normalize = await loadOrderKeyNormalizer(app_);
    const facade = await loadRuntimePreloadFacade(app_);
    if (facade && typeof facade.resolveOrderConfig === "function") {
      return facade.resolveOrderConfig(app_, settings, {
        orderConfigKey,
        parseOrderConfig,
        normalizeKey: normalize,
        isObj,
      });
    }
    throw new Error("pkm_runtime_bootstrap unavailable: resolveOrderConfig");
  }

  async function resolveDateRuntimeConfig(app_, settings) {
    const raw = String(settings && settings[dateRuntimeConfigKey] || "").trim();
    return dateRuntimeShared.parseDateRuntimeConfigJson(raw);
  }

  function applyDateRuntimeConfigToRules(rules, dateRuntimeCfg) {
    if (!isObj(rules)) return;
    if (!isObj(rules.behavior)) rules.behavior = {};
    rules.behavior.dateRuntimeConfig = isObj(dateRuntimeCfg) ? dateRuntimeCfg : { byField: {}, canonical: {} };
  }

  async function resolveAndApplyDateRuntimeConfig(app_, settings, rules) {
    const dateRuntimeCfg = await resolveDateRuntimeConfig(app_, settings);
    applyDateRuntimeConfigToRules(rules, dateRuntimeCfg);
    return dateRuntimeCfg;
  }

  function getPanelForField(orderCfg, fieldKey) {
    const shared = globalThis.__inlinePkmRulesHelpers;
    if (shared && typeof shared.resolvePanelForField === "function") {
      return shared.resolvePanelForField(orderCfg, fieldKey, {
        normalizeKey: normalizeOrderKey,
        defaultPanel,
      });
    }
    throw new Error("pkm_rules_runtime_helpers unavailable: resolvePanelForField");
  }

  function applyOrderToRules(rules, orderCfg) {
    const shared = globalThis.__inlinePkmRulesHelpers;
    if (shared && typeof shared.applyOrderToRules === "function") {
      return shared.applyOrderToRules(rules, orderCfg, { isObj });
    }
    throw new Error("pkm_rules_runtime_helpers unavailable: applyOrderToRules");
  }

  function isFieldKeyEnabled(orderCfg, fieldKey) {
    const key = String(fieldKey || "").trim();
    if (!key) return true;
    const active = isObj(orderCfg?.active) ? orderCfg.active : {};
    const activeMode = String(active[key] || "").trim().toLowerCase();
    if (activeMode === "no") return false;
    if (activeMode === "hotkey_only") return true;
    const enabled = isObj(orderCfg?.enabled) ? orderCfg.enabled : {};
    return enabled[key] !== false;
  }

  function getFieldActiveMode(orderCfg, fieldKey) {
    const key = String(fieldKey || "").trim();
    if (!key) return "yes";
    const active = isObj(orderCfg?.active) ? orderCfg.active : {};
    const activeMode = String(active[key] || "").trim().toLowerCase();
    if (activeMode === "no" || activeMode === "hotkey_only") return activeMode;
    return "yes";
  }

  function getFieldFreeRoamMode(orderCfg, fieldKey) {
    const shared = globalThis.__inlinePkmRulesHelpers;
    if (shared && typeof shared.resolveFieldFreeRoamMode === "function") {
      return shared.resolveFieldFreeRoamMode(orderCfg, fieldKey);
    }
    return "off";
  }

  function getFreeRoamBehavior(orderCfg) {
    const shared = globalThis.__inlinePkmRulesHelpers;
    if (shared && typeof shared.resolveFreeRoamBehavior === "function") {
      return shared.resolveFreeRoamBehavior(orderCfg);
    }
    return { minimalSeparator: true, minimalPrefix: true, offPrefix: false, fullPlacement: "smart" };
  }

  function getFieldById(mode, id) {
    const targetId = String(id || "").trim();
    if (!targetId) return null;
    const fields = Array.isArray(mode && mode.fields) ? mode.fields : [];
    for (const field of fields) {
      if (field && String(field.id || "") === targetId) return field;
    }
    return null;
  }

  function getActiveValues(field) {
    const values = Array.isArray(field && field.values) ? field.values : [];
    return values
      .filter((v) => isObj(v) && typeof v.token === "string" && v.token && v.active !== false)
      .slice()
      .sort((a, b) => {
        const ao = typeof a.order === "number" ? a.order : 999;
        const bo = typeof b.order === "number" ? b.order : 999;
        return ao - bo;
      });
  }

  function getFieldValueById(field, valueId) {
    const targetId = String(valueId || "");
    const values = Array.isArray(field && field.values) ? field.values : [];
    for (const value of values) {
      if (!isObj(value)) continue;
      const id = typeof value.id === "string" ? value.id : (typeof value.token === "string" ? value.token : "");
      if (id === targetId) return value;
    }
    return null;
  }

  function getFieldValueByToken(field, token) {
    const targetToken = String(token || "");
    const values = Array.isArray(field && field.values) ? field.values : [];
    for (const value of values) {
      if (!isObj(value) || typeof value.token !== "string") continue;
      if (value.token === targetToken) return value;
    }
    return null;
  }

  function getValueId(value) {
    if (!isObj(value)) return "";
    if (typeof value.id === "string" && value.id) return value.id;
    if (typeof value.token === "string" && value.token) return value.token;
    return "";
  }

  function resolveSubtagFormat(settingsValue, rules) {
    const fromSettings = String(settingsValue == null ? "" : settingsValue).trim().toLowerCase();
    if (fromSettings === "combined" || fromSettings === "separate") return fromSettings;
    const behavior = isObj(rules && rules.behavior) ? rules.behavior : {};
    const fromRules = String(behavior.subtagFormat || "separate").trim().toLowerCase();
    return fromRules === "combined" ? "combined" : "separate";
  }

  function getAllowedSubValues(subField, parentToken) {
    const out = [];
    const values = Array.isArray(subField && subField.values) ? subField.values : [];
    for (const value of values) {
      if (!isObj(value) || typeof value.token !== "string" || !value.token || value.active === false) continue;
      const allowed = Array.isArray(value.allowedParentValues) ? value.allowedParentValues : [];
      if (allowed.length && !allowed.includes(parentToken)) continue;
      out.push(value);
    }
    out.sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : 999;
      const bo = typeof b.order === "number" ? b.order : 999;
      return ao - bo;
    });
    return out;
  }

  function setCursorIfChanged(editor, lineNo, ch) {
    if (!editor || typeof editor.setCursor !== "function") return;
    const nextLine = Math.max(0, Number(lineNo || 0));
    const nextCh = Math.max(0, Number(ch || 0));
    try {
      if (typeof editor.getCursor === "function") {
        const cur = editor.getCursor();
        if (cur && Number(cur.line) === nextLine && Number(cur.ch) === nextCh) return;
      }
      editor.setCursor({ line: nextLine, ch: nextCh });
    } catch (_) {
      /*
       * Украшение: строка к этому моменту уже перезаписана, а курсор —
       * последний штрих. Место могло уехать за конец строки или заметку успели
       * закрыть; отменять из-за этого сделанную запись нельзя.
       */
    }
  }

  function parseIsoDateSafe(input) {
    const m = String(input || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  function getTodayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function escapeRx(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getReferenceDateForUnit(unit) {
    if (unit === "second" || unit === "minute" || unit === "hour") return new Date();
    const d = parseIsoDateSafe(getTodayIso());
    return d || new Date(Date.UTC(1970, 0, 1));
  }

  function getSearchLimitByUnit(unit, sharedUtils) {
    const su = sharedUtils && typeof sharedUtils === "object" ? sharedUtils : null;
    if (su && typeof su.getSearchLimitByUnit === "function") return su.getSearchLimitByUnit(unit);
    throw new Error("shared_utils unavailable: getSearchLimitByUnit");
  }

  function addByUnitUtc(base, unit, delta) {
    const dt = new Date(base.getTime());
    const d = Math.trunc(Number(delta || 0));
    if (unit === "second") dt.setUTCSeconds(dt.getUTCSeconds() + d);
    else if (unit === "minute") dt.setUTCMinutes(dt.getUTCMinutes() + d);
    else if (unit === "hour") dt.setUTCHours(dt.getUTCHours() + d);
    else if (unit === "month") dt.setUTCMonth(dt.getUTCMonth() + d);
    else if (unit === "year") dt.setUTCFullYear(dt.getUTCFullYear() + d);
    else dt.setUTCDate(dt.getUTCDate() + d);
    return dt;
  }

  function buildPriorityTokenMapFromLine(line) {
    const src = String(line || "");
    const found = new Set();
    const out = [];
    const rx = /(^|\s)(#\/\S+)(?=\s|$)/g;
    let m;
    while ((m = rx.exec(src)) !== null) {
      const token = String(m[2] || "").trim();
      if (!token || found.has(token)) continue;
      found.add(token);
      out.push({ id: token, token });
    }
    return out;
  }

  function buildPriorityCycleTokens(tokenMap, normalizePriorityToken) {
    const normalize = typeof normalizePriorityToken === "function"
      ? normalizePriorityToken
      : (v) => String(v || "").trim();
    const out = [];
    const seen = new Set();
    for (const x of Array.isArray(tokenMap) ? tokenMap : []) {
      const tok = normalize(x && x.token ? x.token : "");
      if (!tok || seen.has(tok)) continue;
      seen.add(tok);
      out.push(tok);
    }
    return out;
  }

  function buildPriorityCycleTokensFromRules(rules, normalizePriorityToken) {
    const normalize = typeof normalizePriorityToken === "function"
      ? normalizePriorityToken
      : (v) => String(v || "").trim();
    const order = Array.isArray(rules && rules.tags && rules.tags.priority && rules.tags.priority.order)
      ? rules.tags.priority.order
      : [];
    const out = [];
    const seen = new Set();
    for (const raw of order) {
      const tok = normalize(raw);
      if (!tok || seen.has(tok)) continue;
      seen.add(tok);
      out.push(tok);
    }
    return out;
  }

  function resolvePriorityCycleTokens(tokenMap, rules, line, normalizePriorityToken) {
    const fromMap = buildPriorityCycleTokens(tokenMap, normalizePriorityToken);
    const fromRules = buildPriorityCycleTokensFromRules(rules, normalizePriorityToken);
    const lineTokens = Array.from(new Set((String(line || "").match(/#\/\S+/g) || [])
      .map((t) => String(t || "").trim())
      .filter(Boolean)));
    const base = fromMap.length ? fromMap.slice() : fromRules.slice();
    for (const tok of lineTokens) {
      if (base.indexOf(tok) === -1) base.push(tok);
    }
    const allNumeric = base.length > 0 && base.every((t) => /^#\/\d+$/.test(String(t || "")));
    if (allNumeric) {
      base.sort((a, b) => Number(String(a).slice(2)) - Number(String(b).slice(2)));
    }
    return base;
  }

  function normalizePriorityToken(raw) {
    const t = String(raw || "").trim();
    if (!t) return "";
    if (/^#\/\S+/.test(t)) return t.match(/^#\/\S+/)[0];
    if (/^\/\S+/.test(t)) return `#${t}`;
    return t;
  }

  function countPriorityTokens(line) {
    const m = String(line || "").match(/(^|\s)#\/\S+(?=\s|$)/g);
    return Array.isArray(m) ? m.length : 0;
  }

  function stripPriorityTokens(line) {
    return String(line || "")
      .replace(/(^|\s)#\/\S+(?=\s|$)/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function parseDateByFormat(text, format, normalizeFormatMaskFn, escapeRxFn) {
    const t = String(text || "").trim();
    const normalizeMask = typeof normalizeFormatMaskFn === "function"
      ? normalizeFormatMaskFn
      : (x) => String(x == null ? "" : x).trim();
    const esc = typeof escapeRxFn === "function"
      ? escapeRxFn
      : escapeRx;
    const f = normalizeMask(String(format ?? "YYYY-MM-DD"));
    const tokenRe = /(YYYY|MM|DD|HH|mm|ss)/g;
    let pattern = "^";
    const tokens = [];
    let last = 0;
    let m;
    while ((m = tokenRe.exec(f)) !== null) {
      pattern += esc(f.slice(last, m.index));
      const tk = String(m[1]);
      tokens.push(tk);
      pattern += tk === "YYYY" ? "(\\d{4})" : "(\\d{2})";
      last = m.index + tk.length;
    }
    pattern += esc(f.slice(last)) + "$";
    const re = new RegExp(pattern);
    const mm = t.match(re);
    if (!mm) return null;
    let y = 1970;
    let mo = 1;
    let d = 1;
    let hh = 0;
    let mi = 0;
    let ss = 0;
    for (let i = 0; i < tokens.length; i++) {
      const v = Number(mm[i + 1]);
      const tk = tokens[i];
      if (!Number.isFinite(v)) return null;
      if (tk === "YYYY") y = v;
      else if (tk === "MM") mo = v;
      else if (tk === "DD") d = v;
      else if (tk === "HH") hh = v;
      else if (tk === "mm") mi = v;
      else if (tk === "ss") ss = v;
    }
    const dt = new Date(Date.UTC(y, mo - 1, d, hh, mi, ss));
    if (Number.isNaN(dt.getTime())) return null;
    if (
      dt.getUTCFullYear() !== y
      || dt.getUTCMonth() + 1 !== mo
      || dt.getUTCDate() !== d
      || dt.getUTCHours() !== hh
      || dt.getUTCMinutes() !== mi
      || dt.getUTCSeconds() !== ss
    ) {
      return null;
    }
    return dt;
  }

  function formatDateByFormat(dt, format, normalizeFormatMaskFn) {
    if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "";
    const normalizeMask = typeof normalizeFormatMaskFn === "function"
      ? normalizeFormatMaskFn
      : (x) => String(x == null ? "" : x).trim();
    const f = normalizeMask(String(format ?? "YYYY-MM-DD"));
    const YYYY = String(dt.getUTCFullYear());
    const MM = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const DD = String(dt.getUTCDate()).padStart(2, "0");
    const HH = String(dt.getUTCHours()).padStart(2, "0");
    const mm = String(dt.getUTCMinutes()).padStart(2, "0");
    const ss = String(dt.getUTCSeconds()).padStart(2, "0");
    return f
      .replace(/YYYY/g, YYYY)
      .replace(/MM/g, MM)
      .replace(/DD/g, DD)
      .replace(/HH/g, HH)
      .replace(/mm/g, mm)
      .replace(/ss/g, ss);
  }

  function replaceRange(text, start, end, replacement) {
    const src = String(text || "");
    const s = Math.max(0, Math.min(src.length, Number(start) || 0));
    const e = Math.max(s, Math.min(src.length, Number(end) || s));
    const rep = String(replacement || "");
    return src.slice(0, s) + rep + src.slice(e);
  }

  function cleanupSpacing(text) {
    return String(text || "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s+\|\|/g, " ||")
      .replace(/\|\|\s+/g, "|| ")
      .replace(/^\s+/g, "")
      .replace(/\s+$/g, "");
  }

  function normalizeDirection(raw) {
    const v = String(raw || "").trim().toLowerCase();
    return v === "decrease" ? "decrease" : "increase";
  }

  function nextCycleIdByDirection(cycle, currentId, direction) {
    const list = Array.isArray(cycle) ? cycle : [];
    if (!list.length) return "";
    const idx = list.indexOf(currentId);
    if (idx < 0) return list[0];
    return direction === "decrease"
      ? list[(idx - 1 + list.length) % list.length]
      : list[(idx + 1) % list.length];
  }

  function fieldKeyByAction(action, fallbackKey) {
    const actionKey = String(action || "").trim();
    const m = actionKey.match(/^cycle_field:(.+)$/);
    if (m) return String(m[1] || "").trim();
    return String(fallbackKey || "").trim();
  }

  function isMinimalOffNoSeparatorAction(action) {
    const v = String(action || "").trim();
    if (!v) return false;
    return /^cycle_field:/.test(v);
  }

  function hasToken(segText, token) {
    const shared = globalThis.__inlinePkmMacroShared;
    if (shared && typeof shared.segmentHasToken === "function") return shared.segmentHasToken(segText, token);
    throw new Error("pkm_macro_shared unavailable: segmentHasToken");
  }

  function composeToken(prefix, rawToken) {
    const p = typeof prefix === "string" ? prefix : "#";
    const t = String(rawToken || "");
    if (!t) return "";
    if (/^\[\[[^\]]+\]\]$/.test(t)) return t;
    if (!p && /^\//.test(t)) return `#${t}`;
    return `${p}${t}`;
  }

  function normalizeImportanceTokenShape(tokenRaw) {
    const src = String(tokenRaw || "").trim();
    if (!src) return "";
    if (/^#\//.test(src)) return src;
    if (/^\//.test(src)) return `#${src}`;
    if (src.charAt(0) === "#") return src;
    return `#/${src}`;
  }

  /*
   * Двух функций-помощников в подписи больше нет: они кормили свою копию
   * правила, а копия снята 2026-09-11 (В-103). Единица времени по формату
   * объявлена один раз — в `shared_utils.js`, и нормализацию маски делает там
   * же она сама.
   */
  function detectDateUnit(format, sharedUtils) {
    const su = sharedUtils && typeof sharedUtils === "object" ? sharedUtils : null;
    if (su && typeof su.detectDateUnit === "function") return su.detectDateUnit(format);
    throw new Error("shared_utils unavailable: detectDateUnit");
  }

  function getDateProgressForStep(state, fieldId) {
    const cur = String(state && state.selected ? state.selected[fieldId] || "" : "");
    if (!cur) return "";
    const off = Number(cur);
    if (!Number.isFinite(off)) return "";
    return String(Math.max(0, Math.trunc(off)));
  }

  return {
    remapCursorByLineDiff,
    remapCursorStable,
    normalizeCycleEndBehavior,
    normalizeCursorPolicy,
    parseOrderConfig,
    resolveOrderConfig,
    resolveDateRuntimeConfig,
    applyDateRuntimeConfigToRules,
    resolveAndApplyDateRuntimeConfig,
    getPanelForField,
    applyOrderToRules,
    isFieldKeyEnabled,
    getFieldActiveMode,
    getFieldFreeRoamMode,
    getFreeRoamBehavior,
    getFieldById,
    getActiveValues,
    getFieldValueById,
    getFieldValueByToken,
    getValueId,
    resolveSubtagFormat,
    getAllowedSubValues,
    setCursorIfChanged,
    parseIsoDateSafe,
    getTodayIso,
    escapeRx,
    getReferenceDateForUnit,
    getSearchLimitByUnit,
    addByUnitUtc,
    buildPriorityTokenMapFromLine,
    buildPriorityCycleTokens,
    buildPriorityCycleTokensFromRules,
    resolvePriorityCycleTokens,
    normalizePriorityToken,
    countPriorityTokens,
    stripPriorityTokens,
    parseDateByFormat,
    formatDateByFormat,
    replaceRange,
    cleanupSpacing,
    normalizeDirection,
    nextCycleIdByDirection,
    fieldKeyByAction,
    isMinimalOffNoSeparatorAction,
    hasToken,
    composeToken,
    normalizeImportanceTokenShape,
    detectDateUnit,
    getDateProgressForStep,
  };
}

module.exports = {
  createStatusRuntimeCommon,
};
