"use strict";

/* Общий дом без своих зависимостей: вид ссылки в строке (10.13.277). */
const __sharedUtils = require("../core/shared_utils.js");

/*
 * Перестановка значений полей по Order — один дом на все дороги (10.13.125,
 * У-150). Правило — `relocateCoreTagsByOrder` в
 * `status_line_runtime_unified.js`, здесь его зависимости.
 *
 * Фабрика, а не готовые функции: у каждого движка свой `statusCommon`
 * (`defaultPanel` у тегов `"left"`, у элементов `"right"`), и один экземпляр
 * молча сменил бы поведение одному из них.
 */

/**
 * @param deps.getStatusRuntimeCommon        () => общий рантайм статусных движков
 * @param deps.getStatusLineRuntime   () => `status_line_runtime_unified`
 * @param deps.getDomainRegistry      () => реестр доменных правил PKM
 * @param deps.tokenGraph             модуль графа токенов
 * @param deps.core                   `tagwheel_core` — у него дом правила
 *                                    «как значение выглядит в строке»
 * @param deps.isObj                  признак объекта движка
 */
function createFieldRelocation(deps) {
  const d = deps && typeof deps === "object" ? deps : {};
  /* Имя звавшего — аргументом: экземпляров два, в журнале нужен отказавший. */
  const owner = String(d.owner || "").trim() || "field_relocation";
  const need = (name, fn) => {
    if (typeof fn !== "function") throw new Error(`${owner}: field_relocation missing dependency ${name}`);
    return fn;
  };
  const getStatusRuntimeCommon = need("getStatusRuntimeCommon", d.getStatusRuntimeCommon);
  const getStatusLineRuntime = need("getStatusLineRuntime", d.getStatusLineRuntime);
  const getDomainRegistry = need("getDomainRegistry", d.getDomainRegistry);
  const isObj = need("isObj", d.isObj);
  const tokenGraph = d.tokenGraph;
  if (!tokenGraph || typeof tokenGraph.buildTokenFactsFromLine !== "function") {
    throw new Error(`${owner}: field_relocation missing dependency tokenGraph`);
  }
  const core = d.core;
  if (!core || typeof core.buildOutputToken !== "function") {
    throw new Error(`${owner}: field_relocation missing dependency core.buildOutputToken`);
  }
  /*
   * Второе имя того же дома проверяется на входе, а не в `managedFields`
   * (10.13.166): там «нет» отдавало список без отбора (исключение № 96).
   */
  if (typeof core.isFieldSwitchedOn !== "function") {
    throw new Error(`${owner}: field_relocation missing dependency core.isFieldSwitchedOn`);
  }

  function getField(mode, id) {
    return getStatusRuntimeCommon().getFieldById(mode, id);
  }

  function valueId(v) {
    return getStatusRuntimeCommon().getValueId(v);
  }

  function composeToken(prefix, rawToken) {
    return getStatusRuntimeCommon().composeToken(prefix, rawToken);
  }

  function buildTokenFactsFromLine(rawLine, rules) {
    return tokenGraph.buildTokenFactsFromLine(rawLine, rules);
  }

  /* Вид значения в строке — дом `tagwheel_core.js`, приезжает зависимостью (10.13.130). */
  function buildOutputTokenForField(field, value, rules) {
    return core.buildOutputToken(field, value, rules);
  }

  function getFieldModeById(rules, fieldId) {
    const left = rules && rules.leftMode ? rules.leftMode : null;
    const right = rules && rules.rightMode ? rules.rightMode : null;
    if (getField(left, fieldId)) return left;
    if (getField(right, fieldId)) return right;
    return left || right || { fields: [] };
  }

  /**
   * `core` — аргументом: у части вызовов его нет, и значения читаются у поля.
   */
  function activeValuesForField(coreArg, rules, state, field) {
    if (!field) return [];
    let vals = [];
    if (coreArg && typeof coreArg.getAllowedValues === "function") {
      const mode = getFieldModeById(rules, field.id);
      try {
        vals = coreArg.getAllowedValues(mode, state || { selected: {} }, field, rules);
      } catch (_) {
        /* Значения бывают недоступны (дочернее при пустом родителе) — это ответ:
           читаем записанное у поля. */
        vals = Array.isArray(field.values) ? field.values : [];
      }
    } else {
      vals = Array.isArray(field.values) ? field.values : [];
    }
    return vals
      .filter((v) => isObj(v) && typeof v.token === "string" && v.token && v.active !== false)
      .slice()
      .sort((a, b) => {
        const ao = typeof a.order === "number" ? a.order : 999;
        const bo = typeof b.order === "number" ? b.order : 999;
        return ao - bo;
      });
  }

  function panelForTagKey(orderCfg, key) {
    const k = String(key || "");
    const statusCommon = getStatusRuntimeCommon();
    if (/_sub$/.test(k)) return statusCommon.getPanelForField(orderCfg, k.slice(0, -4));
    return statusCommon.getPanelForField(orderCfg, k);
  }

  function fieldTokenMap(field, rules, state, coreArg) {
    const vals = activeValuesForField(coreArg, rules, state, field);
    const prefix = typeof field?.prefix === "string" ? field.prefix : "#";
    const out = [];
    for (const v of vals) {
      const id = valueId(v);
      const token = buildOutputTokenForField(field, v, rules) || composeToken(prefix, String(v?.token || ""));
      /* Ссылка с подписью и без неё — одно Value (10.13.277). */
      if (id && token) for (const form of __sharedUtils.wikilinkLineForms(token)) out.push({ id, token: form });
    }
    return out;
  }

  function selectedTokenFromState(field, state, rules, coreArg) {
    if (!field || !state || !state.selected) return "";
    const id = String(state.selected[field.id] || "");
    if (!id) return "";
    const vals = activeValuesForField(coreArg, rules, state, field);
    let hit = null;
    for (const v of vals) {
      if (!isObj(v)) continue;
      const vid = valueId(v);
      if (vid === id) { hit = v; break; }
    }
    if (!hit || typeof hit.token !== "string" || !hit.token) return "";
    return buildOutputTokenForField(field, hit, rules) || composeToken(typeof field.prefix === "string" ? field.prefix : "#", String(hit.token));
  }

  function selectedTokenFromLineByPanel(line, rules, panel, tokenMap) {
    const linePipeline = globalThis.__inlineLinePipeline;
    if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
      throw new Error("line_pipeline unavailable: splitSegments");
    }
    const runtime = getStatusLineRuntime();
    if (!runtime || typeof runtime.selectTokenByPanelOrder !== "function") {
      throw new Error("status_line_runtime_unified unavailable: selectTokenByPanelOrder");
    }
    const tokenFacts = buildTokenFactsFromLine(line, rules);
    const hit = runtime.selectTokenByPanelOrder({
      line,
      rules,
      panel,
      tokenMap,
      tokenFacts,
      deps: {
        splitSegments: linePipeline.splitSegments,
      },
    });
    if (hit && hit.token) return hit.token;
    return "";
  }

  function relocateFieldByPanel(line, rules, orderCfg, targetPanel, selectedToken, tokenMap) {
    const shared = globalThis.__inlineLinePipeline;
    if (!shared || typeof shared.relocateTokenSetByPanel !== "function") {
      throw new Error("line_pipeline unavailable: relocateTokenSetByPanel");
    }
    if (typeof shared.removeExactTokens !== "function") {
      throw new Error("line_pipeline unavailable: removeExactTokens");
    }
    const rulesHelpers = globalThis.__inlinePkmRulesHelpers;
    if (!rulesHelpers || typeof rulesHelpers.buildTagTokenKeyMap !== "function" || typeof rulesHelpers.getDefaultTagTokenKeyMapOptions !== "function") {
      throw new Error("pkm_rules_runtime_helpers unavailable: buildTagTokenKeyMap");
    }
    if (typeof rulesHelpers.reorderSegmentTokensByOrder !== "function" || typeof rulesHelpers.getStatusTagReorderOptions !== "function") {
      throw new Error("pkm_rules_runtime_helpers unavailable: reorderSegmentTokensByOrder");
    }
    const tokenToKey = rulesHelpers.buildTagTokenKeyMap(rules, rulesHelpers.getDefaultTagTokenKeyMapOptions());
    const all = tokenMap.map((x) => x.token);
    return shared.relocateTokenSetByPanel({
      line,
      rules,
      targetPanel,
      selectedToken,
      allTokens: all,
      stripTokens: (segment, tokens) => shared.removeExactTokens(segment, tokens),
      reorderLeft: (leftBody) => rulesHelpers.reorderSegmentTokensByOrder(leftBody, orderCfg, "left", tokenToKey, rulesHelpers.getStatusTagReorderOptions()),
      reorderRight: (dates) => rulesHelpers.reorderSegmentTokensByOrder(dates, orderCfg, "right", tokenToKey, rulesHelpers.getStatusTagReorderOptions()),
    });
  }

  function removeCombinedByParentTokens(line, rules, parentTokens) {
    const shared = globalThis.__inlineLinePipeline;
    if (!shared || typeof shared.removeCombinedByParentTokens !== "function") {
      throw new Error("line_pipeline unavailable: removeCombinedByParentTokens");
    }
    return shared.removeCombinedByParentTokens({
      line,
      rules,
      parentTokens,
    });
  }

  function resolveOrderKeyForField(rules, field) {
    const f = field && typeof field === "object" ? field : null;
    if (!f || !f.id) return "";
    const explicit = String(f.orderKey || "").trim();
    if (explicit) return explicit;
    const left = Array.isArray(rules?.leftMode?.fields) ? rules.leftMode.fields : [];
    const right = Array.isArray(rules?.rightMode?.fields) ? rules.rightMode.fields : [];
    const fields = left.concat(right);
    for (let i = 0; i < fields.length; i++) {
      const cur = fields[i];
      if (!cur || String(cur.id || "").trim() !== String(f.id || "").trim()) continue;
      const curOrderKey = String(cur.orderKey || "").trim();
      if (curOrderKey) return curOrderKey;
    }
    const reg = getDomainRegistry();
    if (!reg || typeof reg.resolveOrderKeyFromFieldId !== "function") {
      throw new Error("pkm_domain_registry unavailable: resolveOrderKeyFromFieldId");
    }
    const mapped = String(reg.resolveOrderKeyFromFieldId(String(f.id || "").trim()) || "").trim();
    if (mapped) return mapped;
    const leftOrder = Array.isArray(rules?.behavior?.order?.left) ? rules.behavior.order.left : [];
    const rightOrder = Array.isArray(rules?.behavior?.order?.right) ? rules.behavior.order.right : [];
    const leftIdx = left.findIndex((x) => x && String(x.id || "").trim() === String(f.id || "").trim());
    if (leftIdx >= 0) {
      const k = String(leftOrder[leftIdx] || "").trim();
      if (k) return k;
    }
    const rightIdx = right.findIndex((x) => x && String(x.id || "").trim() === String(f.id || "").trim());
    if (rightIdx >= 0) {
      const k = String(rightOrder[rightIdx] || "").trim();
      if (k) return k;
    }
    return String(f.id || "").trim();
  }

  /**
   * Поле, которым дорога не управляет, не переставляется (10.13.129, У-147).
   * Спрашивается только «поле включено» (В-137): значение скрытого поля —
   * его, место назначает Order; выключенное и спрятанное режимом не
   * переставляется ни одной дорогой (10.13.188).
   */
  function managedFields(rules, state, fields) {
    const list = Array.isArray(fields) ? fields : [];
    return list.filter((f) => {
      if (!f || !f.id) return false;
      const mode = getFieldModeById(rules, f.id);
      return core.isFieldSwitchedOn(mode, state || { selected: {} }, f, rules);
    });
  }

  /**
   * Поле link переставляется по Order наравне с тегом (`G3`, 2026-09-16):
   * теги в `leftMode`, ссылки и элементы в `rightMode`, Block — в `panel` поля.
   * Элементы не добавляются: метку переносит `relocateDateTokenByPanel` в
   * `status_date.js`. Отбор — `isWikilinkSourceField` в
   * `pkm_rules_runtime_helpers.js` (У-201).
   */
  function withLinkFields(rules, fields) {
    const list = Array.isArray(fields) ? fields.slice() : [];
    const rulesHelpers = globalThis.__inlinePkmRulesHelpers;
    if (!rulesHelpers || typeof rulesHelpers.isWikilinkSourceField !== "function") {
      throw new Error(`${owner}: pkm_rules_runtime_helpers unavailable: isWikilinkSourceField`);
    }
    const seen = new Set(list.map((f) => String(f && f.id || "").trim()).filter(Boolean));
    const sides = [rules && rules.leftMode, rules && rules.rightMode];
    for (const side of sides) {
      const sideFields = Array.isArray(side && side.fields) ? side.fields : [];
      for (const f of sideFields) {
        const id = String(f && f.id || "").trim();
        if (!id || seen.has(id)) continue;
        if (!rulesHelpers.isWikilinkSourceField(f)) continue;
        seen.add(id);
        list.push(f);
      }
    }
    return list;
  }

  function relocateCoreTagsByOrder(line, rules, orderCfg, state, fields, activeKey, activeFieldId) {
    const runtime = getStatusLineRuntime();
    return runtime.relocateCoreTagsByOrder({
      line,
      rules,
      orderCfg,
      state,
      fields: managedFields(rules, state, withLinkFields(rules, fields)),
      activeKey,
      activeFieldId,
      deps: {
        panelForTagKey,
        fieldTokenMap,
        selectedTokenFromState,
        selectedTokenFromLineByPanel,
        relocateFieldByPanel,
        removeCombinedByParentTokens,
        resolveFieldOrderKey: (field, runtimeRules) => resolveOrderKeyForField(runtimeRules || rules, field),
      },
    });
  }

  return {
    getField,
    valueId,
    composeToken,
    buildTokenFactsFromLine,
    buildOutputTokenForField,
    getFieldModeById,
    activeValuesForField,
    panelForTagKey,
    fieldTokenMap,
    selectedTokenFromState,
    selectedTokenFromLineByPanel,
    relocateFieldByPanel,
    removeCombinedByParentTokens,
    resolveOrderKeyForField,
    relocateCoreTagsByOrder,
  };
}

module.exports = { createFieldRelocation };
