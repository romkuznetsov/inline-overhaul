/*
 * Модули приезжают литеральным `require` — по одному на модуль (У-89).
 *
 * Было: шесть путей внутри vault и шесть асинхронных `ensure*Loaded`, каждая
 * со своей проверкой годности и своим `let` под кеш. Путь шёл через
 * `callRuntimeApi` в макро-рантайм, оттуда в мост модулей, а мост искал путь в
 * реестре забандленных модулей. У `pkm_domain_registry` рядом лежала запаска
 * литеральным `require` — и в сборке работала именно она, потому что путь в
 * переменной esbuild не разрешает.
 *
 * Стало: `require` с литеральным путём. Проверки годности сняты вместе с
 * загрузкой — они отвечали на «модуль приехал не тот», а приехать не тот
 * модуль из графа сборки не может. Промахнуться мимо литерала нельзя.
 *
 * Функции `get*Unified` и `getStatusRuntimeCommon` оставлены: их зовут больше
 * сорока мест, и подпись у них прежняя.
 */
const __sharedUtils = require("../src/core/shared_utils.js");
const __pkmDomainRegistry = require("../src/core/pkm_domain_registry.js");
const __statusLineRuntimeUnified = require("../src/core/status_line_runtime_unified.js");
const __tokenGraphUnified = require("../src/core/token_graph_unified.js");
const __lineFinalizeUnified = require("../src/core/pkm_line_finalize_unified.js");
const __statusRuntimeCommonMod = require("../src/core/status_runtime_common.js");
const __pkmOptionKeys = require("../src/core/pkm_option_keys.js");
const __tagwheelCore = require("./TagWheel/tagwheel_core.js");
const __sayModule = require("../src/core/say.js");
const __say = __sayModule.say;
const __activeEditorMod = require("../src/core/active_editor.js");

let RULES_DATA = "Rules data";
let ACTION_TYPE = "Action type";
let SUBTAG_FORMAT = "Subtag format";
let CYCLE_END_BEHAVIOR = "Cycle end behavior";
let CURSOR_POLICY = "Cursor policy";
let ORDER_CONFIG = "Order config";
let DATE_RUNTIME_CONFIG = "Date runtime config";
let DIRECTION = "Direction";
let __statusRuntimeCommonFns = null;

function applyPkmOptionKeys(mod) {
  const keys = mod && mod.KEYS && typeof mod.KEYS === "object" ? mod.KEYS : null;
  if (!keys) return;
  RULES_DATA = String(keys.RULES_DATA || RULES_DATA);
  ACTION_TYPE = String(keys.ACTION_TYPE || ACTION_TYPE);
  SUBTAG_FORMAT = String(keys.SUBTAG_FORMAT || SUBTAG_FORMAT);
  CYCLE_END_BEHAVIOR = String(keys.CYCLE_END_BEHAVIOR || CYCLE_END_BEHAVIOR);
  CURSOR_POLICY = String(keys.CURSOR_POLICY || CURSOR_POLICY);
  ORDER_CONFIG = String(keys.ORDER_CONFIG || ORDER_CONFIG);
  DATE_RUNTIME_CONFIG = String(keys.DATE_RUNTIME_CONFIG || DATE_RUNTIME_CONFIG);
  DIRECTION = String(keys.DIRECTION || DIRECTION);
}

applyPkmOptionKeys(__pkmOptionKeys);

function normalizeOrderKeyLocal(key) {
  return String(key || "").trim();
}

/*
 * Макро-рантайм остаётся: через него движок берёт нормализатор ключа Order и
 * прослойку предзагрузки, и он же публикует ключи `globalThis`, которые читает
 * `status_runtime_common`. Модули через него больше не ходят.
 */
async function loadMacroRuntime(app_) {
  const globalGetter = globalThis.__inlineGetPkmMacroRuntime;
  if (typeof globalGetter === "function") {
    return globalGetter(app_, normalizeOrderKeyLocal);
  }
  const entry = globalThis.__inlinePkmMacroRuntimeEntryMod;
  if (entry && typeof entry.bootstrapMacroRuntime === "function") {
    return entry.bootstrapMacroRuntime(app_, normalizeOrderKeyLocal);
  }
  throw new Error("pkm_macro_runtime_entry unavailable: bootstrapMacroRuntime");
}

async function callRuntimeApi(app_, method, ...args) {
  const rt = await loadMacroRuntime(app_);
  const fn = rt && rt[method];
  if (typeof fn !== "function") {
    throw new Error(`pkm_macro_runtime_entry unavailable: ${method}`);
  }
  return fn.apply(rt, args);
}

function getDomainRegistry() {
  return __pkmDomainRegistry;
}

function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function ensureStatusRuntimeCommonLoaded() {
  if (__statusRuntimeCommonFns) return;
  __statusRuntimeCommonFns = __statusRuntimeCommonMod.createStatusRuntimeCommon({
    isObj,
    normalizeOrderKey: normalizeOrderKeyLocal,
    orderConfigKey: ORDER_CONFIG,
    dateRuntimeConfigKey: DATE_RUNTIME_CONFIG,
    defaultPanel: "left",
    loadOrderKeyNormalizer: async (ctxApp) => callRuntimeApi(ctxApp, "loadOrderKeyNormalizer"),
    loadRuntimePreloadFacade: async (ctxApp) => callRuntimeApi(ctxApp, "loadRuntimePreloadFacade"),
  });
}

/*
 * Собирается общая часть один раз и **на тех именах ключей, что уже
 * подставлены**: `ORDER_CONFIG` и `DATE_RUNTIME_CONFIG` уезжают в неё
 * значением, а не ссылкой. Ключи подставлены выше, при загрузке модуля, — то
 * есть раньше первой сборки, и разойтись им не на чем (У-32).
 */
function getStatusRuntimeCommon() {
  ensureStatusRuntimeCommonLoaded();
  return __statusRuntimeCommonFns;
}

function getLineFinalizeUnified() {
  return __lineFinalizeUnified;
}

function getStatusLineRuntimeUnified() {
  return __statusLineRuntimeUnified;
}

function buildTokenFactsFromLine(rawLine, rules) {
  return __tokenGraphUnified.buildTokenFactsFromLine(rawLine, rules);
}

function activeValues(field) {
  return getStatusRuntimeCommon().getActiveValues(field);
}

/*
 * Поиск Field по идентификатору живёт в общем модуле, и здесь его зовут прямо.
 * Прежде рядом лежала копия, сравнивавшая `f.id === id` без приведения к
 * строке и без охраны пустого значения: на пустом `id` она отдавала Field, у
 * которого `id` не задан вовсе. Доставалась копия, только если общая
 * реализация бросила, — то есть отвечала иначе и молча (У-32).
 */
function getField(mode, id) {
  return getStatusRuntimeCommon().getFieldById(mode, id);
}

function findValueById(field, valueId) {
  return getStatusRuntimeCommon().getFieldValueById(field, valueId);
}

function findValueByToken(field, token) {
  return getStatusRuntimeCommon().getFieldValueByToken(field, token);
}

function valueId(v) {
  return getStatusRuntimeCommon().getValueId(v);
}

function getSubtagFormat(rules, settings) {
  return getStatusRuntimeCommon().resolveSubtagFormat(settings?.[SUBTAG_FORMAT], rules);
}

function getAllowedSubValues(subField, parentToken) {
  return getStatusRuntimeCommon().getAllowedSubValues(subField, parentToken);
}

function remapCursorStable(oldLine, newLine, oldCh) {
  return getStatusRuntimeCommon().remapCursorStable(oldLine, newLine, oldCh);
}

function escapeRx(s) {
  return getStatusRuntimeCommon().escapeRx(s);
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

function hydrateCombinedPairFromLine(state, rawLine, rules, panel, parentField, subField) {
  if (!parentField || !subField) return;
  const linePipeline = globalThis.__inlineLinePipeline;
  if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
    throw new Error("line_pipeline unavailable: splitSegments");
  }
  const runtime = getStatusLineRuntimeUnified();
  if (!runtime || typeof runtime.selectTokenByPanelOrder !== "function") {
    throw new Error("status_line_runtime_unified unavailable: selectTokenByPanelOrder");
  }
  const tokenFacts = buildTokenFactsFromLine(rawLine, rules);
  const parentVals = activeValues(parentField);
  const pp = typeof parentField.prefix === "string" ? parentField.prefix : "#";
  const pairByHitId = {};
  const tokenMap = [];
  for (const pv of parentVals) {
    const parentId = valueId(pv);
    const pTok = pp + String(pv?.token || "");
    if (!pTok) continue;
    const subs = getAllowedSubValues(subField, String(pv.token || ""));
    for (const sv of subs) {
      const subId = valueId(sv);
      const combo = pTok + "/" + String(sv?.token || "");
      if (!combo || combo.endsWith("/")) continue;
      const hitId = `${parentId}::${subId}`;
      tokenMap.push({ id: hitId, token: combo });
      pairByHitId[hitId] = { parentId, subId };
    }
  }
  if (!tokenMap.length) return;
  const hit = runtime.selectTokenByPanelOrder({
    line: rawLine,
    rules,
    panel,
    tokenMap,
    tokenFacts,
    deps: {
      splitSegments: linePipeline.splitSegments,
    },
  });
  const pair = hit && hit.id ? pairByHitId[String(hit.id)] : null;
  if (!pair) return;
  state.selected[parentField.id] = String(pair.parentId || "");
  state.selected[subField.id] = String(pair.subId || "");
}

function composeToken(prefix, rawToken) {
  return getStatusRuntimeCommon().composeToken(prefix, rawToken);
}

function getFieldModeById(rules, fieldId) {
  const left = rules && rules.leftMode ? rules.leftMode : null;
  const right = rules && rules.rightMode ? rules.rightMode : null;
  if (getField(left, fieldId)) return left;
  if (getField(right, fieldId)) return right;
  return left || right || { fields: [] };
}

function activeValuesForField(core, rules, state, field) {
  if (!field) return [];
  let vals = [];
  if (core && typeof core.getAllowedValues === "function") {
    const mode = getFieldModeById(rules, field.id);
    try {
      vals = core.getAllowedValues(mode, state || { selected: {} }, field, rules);
    } catch (_) {
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

function isPriorityFieldLike(field, rules) {
  if (!field || !Array.isArray(field.values)) return false;
  for (const v of field.values) {
    const token = String(v && v.token || "").trim();
    if (!token) continue;
    if (/^#\//.test(token) || /^\//.test(token)) return true;
  }
  return false;
}

/**
 * **Как значение поля выглядит в строке — одно объявление на все дороги.**
 *
 * Здесь стояло второе, и оба кормили один и тот же общий модуль
 * (`status_line_runtime_unified`, зависимость `buildOutputTokenForField`):
 * панель подавала своё, команды — это. Расхождений между ними не измерял
 * никто, а разойтись им было на чём — вывод проектов, форма важности,
 * приставка, ссылка с подписью.
 *
 * Сверены 2026-09-15 на 189 парах: все значения его конфига и шесть форм
 * полей, которых у него нет вовсе (источник «проекты» с выводом тегом и
 * ссылкой, источник «ссылки», поле без приставки, приставка не решётка,
 * важность). Разошлись на нуле, и мера при этом умеет видеть расхождение:
 * подмена одной ветви дала 16 пар. После сверки копия снята.
 */
function buildOutputTokenForField(field, value, rules) {
  return __tagwheelCore.buildOutputToken(field, value, rules);
}

function fieldTokenMap(field, rules, state, core) {
  const vals = activeValuesForField(core, rules, state, field);
  const prefix = typeof field?.prefix === "string" ? field.prefix : "#";
  const out = [];
  for (const v of vals) {
    const id = valueId(v);
    const token = buildOutputTokenForField(field, v, rules) || composeToken(prefix, String(v?.token || ""));
    if (id && token) out.push({ id, token });
  }
  return out;
}

function allFieldTokens(field, rules) {
  const vals = Array.isArray(field?.values) ? field.values : [];
  const out = [];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (!isObj(v) || v.active === false) continue;
    const token = buildOutputTokenForField(field, v, rules);
    if (token) out.push(token);
  }
  return Array.from(new Set(out));
}

function reorderLineMixedByOrder(line, rules, orderCfg) {
  const linePipeline = globalThis.__inlineLinePipeline;
  if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
    throw new Error("line_pipeline unavailable: splitSegments");
  }
  const seg = linePipeline.splitSegments(line, rules);
  if (!linePipeline || typeof linePipeline.splitLeftPrefix !== "function") {
    throw new Error("line_pipeline unavailable: splitLeftPrefix");
  }
  if (typeof linePipeline.splitSegments !== "function") {
    throw new Error("line_pipeline unavailable: splitSegments");
  }
  if (typeof linePipeline.joinLeftPrefix !== "function") {
    throw new Error("line_pipeline unavailable: joinLeftPrefix");
  }
  if (typeof linePipeline.buildFromSegments !== "function") {
    throw new Error("line_pipeline unavailable: buildFromSegments");
  }
  const rulesHelpers = globalThis.__inlinePkmRulesHelpers;
  if (!rulesHelpers || typeof rulesHelpers.buildTagTokenKeyMap !== "function" || typeof rulesHelpers.getDefaultTagTokenKeyMapOptions !== "function") {
    throw new Error("pkm_rules_runtime_helpers unavailable: buildTagTokenKeyMap");
  }
  if (typeof rulesHelpers.getDateMarkersFromRules !== "function") {
    throw new Error("pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules");
  }
  if (typeof rulesHelpers.reorderSegmentTokensByOrder !== "function" || typeof rulesHelpers.getStatusMixedReorderOptions !== "function") {
    throw new Error("pkm_rules_runtime_helpers unavailable: reorderSegmentTokensByOrder");
  }
  const tokenToKey = rulesHelpers.buildTagTokenKeyMap(rules, rulesHelpers.getDefaultTagTokenKeyMapOptions());
  const markers = rulesHelpers.getDateMarkersFromRules(rules);
  const leftParts = linePipeline.splitLeftPrefix(seg.left);
  const orderedLeftBody = rulesHelpers.reorderSegmentTokensByOrder(leftParts.body, orderCfg, "left", tokenToKey, rulesHelpers.getStatusMixedReorderOptions(markers));
  seg.left = linePipeline.joinLeftPrefix(leftParts.prefix, orderedLeftBody);
  seg.dates = rulesHelpers.reorderSegmentTokensByOrder(seg.dates, orderCfg, "right", tokenToKey, rulesHelpers.getStatusMixedReorderOptions(markers));
  return linePipeline.buildFromSegments(seg, rules);
}

function applyCombinedSubtagsFromState(line, rules, orderCfg, state, fields) {
  if (String(rules?.behavior?.subtagFormat || "").toLowerCase() !== "combined") return line;
  const runtime = getStatusLineRuntimeUnified();
  const allFields = Array.isArray(fields)
    ? fields.filter((f) => f && typeof f === "object")
    : Object.values(fields || {}).filter((f) => f && typeof f === "object");
  const pairs = runtime.buildCombinedSelectionSet({
    fields: allFields,
    state,
    rules,
    deps: {
      findValueById,
      resolveSelectedValue: (field, selectedId) => findValueById(field, selectedId),
      buildOutputTokenForField,
      composeToken,
    },
  });
  if (!Array.isArray(pairs) || !pairs.length) return line;

  let out = String(line || "");
  const linePipeline = globalThis.__inlineLinePipeline;
  if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
    throw new Error("line_pipeline unavailable: splitSegments");
  }
  if (typeof linePipeline.buildFromSegments !== "function") {
    throw new Error("line_pipeline unavailable: buildFromSegments");
  }
  if (typeof linePipeline.removeExactTokens !== "function") {
    throw new Error("line_pipeline unavailable: removeExactTokens");
  }
  for (const pair of pairs) {
    const seg = linePipeline.splitSegments(out, rules);
    const collapsedLeft = runtime.applyCombinedToTokenList(String(seg.left || "").trim().split(/\s+/).filter(Boolean), [pair]).join(" ");
    const collapsedText = runtime.applyCombinedToTokenList(String(seg.text || "").trim().split(/\s+/).filter(Boolean), [pair]).join(" ");
    const collapsedDates = runtime.applyCombinedToTokenList(String(seg.dates || "").trim().split(/\s+/).filter(Boolean), [pair]).join(" ");
    seg.left = collapsedLeft;
    seg.text = collapsedText;
    seg.dates = collapsedDates;

    const parentOrderKey = resolveOrderKeyForField(rules, pair.parentField || {});
    const panel = panelForTagKey(orderCfg, parentOrderKey || String(pair.parentId || ""));
    const cTok = String(pair.combinedToken || "").trim();
    if (cTok) {
      seg.left = linePipeline.removeExactTokens(seg.left, [cTok]);
      seg.text = linePipeline.removeExactTokens(seg.text, [cTok]);
      seg.dates = linePipeline.removeExactTokens(seg.dates, [cTok]);
      if (panel === "right") seg.dates = seg.dates ? `${seg.dates} ${cTok}` : cTok;
      else seg.left = seg.left ? `${seg.left} ${cTok}` : cTok;
    }
    out = linePipeline.buildFromSegments(seg, rules);
  }
  return out;
}

function hydrateFieldFromLine(state, rawLine, rules, targetPanel, stateKey, tokenMap) {
  const linePipeline = globalThis.__inlineLinePipeline;
  if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
    throw new Error("line_pipeline unavailable: splitSegments");
  }
  const runtime = getStatusLineRuntimeUnified();
  if (!runtime || typeof runtime.selectTokenByPanelOrder !== "function") {
    throw new Error("status_line_runtime_unified unavailable: selectTokenByPanelOrder");
  }
  const tokenFacts = buildTokenFactsFromLine(rawLine, rules);
  const hit = runtime.selectTokenByPanelOrder({
    line: rawLine,
    rules,
    panel: targetPanel,
    tokenMap,
    tokenFacts,
    deps: {
      splitSegments: linePipeline.splitSegments,
    },
  });
  if (hit && hit.id) {
    state.selected[stateKey] = hit.id;
    return;
  }
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

function selectedTokenFromState(field, state, rules, core) {
  if (!field || !state || !state.selected) return "";
  const id = String(state.selected[field.id] || "");
  if (!id) return "";
  const vals = activeValuesForField(core, rules, state, field);
  let hit = null;
  for (const v of vals) {
    if (!isObj(v)) continue;
    const vid = valueId(v);
    if (vid === id) { hit = v; break; }
  }
  if (!hit || typeof hit.token !== "string" || !hit.token) return "";
  return buildOutputTokenForField(field, hit, rules) || composeToken(typeof field.prefix === "string" ? field.prefix : "#", String(hit.token));
}

function hasOwnCheckboxForField(rules, state, field, core) {
  if (!field || !isObj(state)) return false;
  const byField = isObj(rules?.behavior?.prefixRules?.checkboxByFieldValue)
    ? rules.behavior.prefixRules.checkboxByFieldValue
    : {};
  const row = isObj(byField[field.id]) ? byField[field.id] : null;
  if (!row) return false;
  const selectedToken = String(selectedTokenFromState(field, state, rules, core) || "").trim();
  if (!selectedToken) return false;
  return !!String(row[selectedToken] || "").trim();
}

/**
 * Наш ли это знак задачи — то есть вид значения именно этого Field.
 *
 * Наш знак стоит в `checkboxByFieldValue` у самого Field (у `type` это `[ ]`,
 * `[N]`, `[!]`): убирая значение, мы обязаны убрать и знак. Любой другой знак
 * задачи принадлежит человеку и действие переживает — его слово 2026-09-13
 * (10.13.92): «буллит должен добавляться только при отсутствии в строке
 * префикса, в противном случае должен оставаться исходный префикс».
 *
 * Вопрос именно о знаке, а не о поле: `fieldHasAnyCheckboxRule` отвечает «у
 * этого Field знаки бывают», и на строке `- [x] ` с полем `type` этого мало —
 * `[x]` не значение `type`, а задача человека.
 */
function checkboxBelongsToField(rules, fieldId, token) {
  return __lineFinalizeUnified.checkboxBelongsToFieldUnified(rules, fieldId, token);
}

function fieldHasAnyCheckboxRule(rules, fieldId) {
  return __lineFinalizeUnified.fieldHasAnyCheckboxRuleUnified(rules, fieldId);
}

function enforceOffModeFinalPrefix(line, rawLine, freeRoamMode, rules, state, fieldForPrefix, core, lineFinalize, cycleEndBehavior, freeRoamBehavior, preserveSyntheticPrefix) {
  if (!lineFinalize || typeof lineFinalize.enforceOffModeFinalPrefixUnified !== "function") {
    throw new Error("pkm_line_finalize_unified unavailable: enforceOffModeFinalPrefixUnified");
  }
  const resolvedPrefix = String(core?.buildPrefix?.(core.parseLine(String(line || ""), rules), rules, state, { prefixShared: lineFinalize }) || "").trim();
  const ownCheckbox = hasOwnCheckboxForField(rules, state, fieldForPrefix, core);
  return lineFinalize.enforceOffModeFinalPrefixUnified({
    line,
    rawLine,
    mode: freeRoamMode,
    freeRoamBehavior,
    hasOwnCheckbox: ownCheckbox,
    resolvedPrefix,
    cycleEndBehavior,
    preserveSyntheticPrefix,
    /* Правила нужны последнему шагу: он возвращает пустой слот текста, а знает
       о слоте единственный сборщик строки. Без них шаг по тегу отдавал
       `- :: [[test1]]` там, где шаг по элементу отдаёт `-  :: [[test1]]`. */
    rules,
  });
}

function selectedTokenFromLineByPanel(line, rules, panel, tokenMap) {
  const linePipeline = globalThis.__inlineLinePipeline;
  if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
    throw new Error("line_pipeline unavailable: splitSegments");
  }
  const runtime = getStatusLineRuntimeUnified();
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

function relocateCoreTagsByOrder(line, rules, orderCfg, state, fields, activeKey, activeFieldId) {
  const runtime = getStatusLineRuntimeUnified();
  return runtime.relocateCoreTagsByOrder({
    line,
    rules,
    orderCfg,
    state,
    fields,
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

function enforceDependentAdjacencyForStatusLine(finalLine, rules, state, core) {
  const runtime = getStatusLineRuntimeUnified();
  const linePipeline = globalThis.__inlineLinePipeline;
  if (!linePipeline || typeof linePipeline.splitLeftPrefix !== "function") {
    throw new Error("line_pipeline unavailable: splitLeftPrefix");
  }
  if (typeof linePipeline.joinLeftPrefix !== "function") {
    throw new Error("line_pipeline unavailable: joinLeftPrefix");
  }
  if (typeof linePipeline.buildFromSegments !== "function") {
    throw new Error("line_pipeline unavailable: buildFromSegments");
  }
  return runtime.enforceDependentAdjacencyForStatusLine({
    finalLine,
    rules,
    state,
    core,
    deps: {
      splitSegments: (lineInput, runtimeRules) => linePipeline.splitSegments(lineInput, runtimeRules),
      splitLeftPrefix: (raw) => linePipeline.splitLeftPrefix(raw),
      joinLeftPrefix: (prefix, body) => linePipeline.joinLeftPrefix(prefix, body),
      buildFromSegments: (seg, runtimeRules) => linePipeline.buildFromSegments(seg, runtimeRules),
      buildOutputTokenForField,
      composeToken,
      selectedTokenFromState,
      getAllowedValues: (runtimeCore, runtimeRules, runtimeState, field) => {
        if (!runtimeCore || typeof runtimeCore.getAllowedValues !== "function") return [];
        return runtimeCore.getAllowedValues(runtimeRules.leftMode, runtimeState, field, runtimeRules);
      },
    },
  });
}

function fieldKeyByAction(action, fallbackKey) {
  return getStatusRuntimeCommon().fieldKeyByAction(action, fallbackKey);
}

function normalizeDirection(raw) {
  return getStatusRuntimeCommon().normalizeDirection(raw);
}

function isMinimalOffNoSeparatorAction(action) {
  return getStatusRuntimeCommon().isMinimalOffNoSeparatorAction(action);
}

function normalizePriorityToken(raw) {
  return getStatusRuntimeCommon().normalizePriorityToken(raw);
}

function countPriorityTokens(line) {
  return getStatusRuntimeCommon().countPriorityTokens(line);
}

function stripPriorityTokens(line) {
  return getStatusRuntimeCommon().stripPriorityTokens(line);
}

function buildPriorityTokenMapFromLine(line) {
  return getStatusRuntimeCommon().buildPriorityTokenMapFromLine(line);
}

function resolvePriorityCycleTokens(tokenMap, rules, line) {
  return getStatusRuntimeCommon().resolvePriorityCycleTokens(tokenMap, rules, line, normalizePriorityToken);
}

function getPriorityField(rules, leftMode, rightMode) {
  const leftFields = Array.isArray(leftMode && leftMode.fields) ? leftMode.fields : [];
  const rightFields = Array.isArray(rightMode && rightMode.fields) ? rightMode.fields : [];
  for (const f of leftFields) if (isPriorityFieldLike(f, rules)) return f;
  for (const f of rightFields) if (isPriorityFieldLike(f, rules)) return f;
  return null;
}

function findPriorityMatchesInLine(line, cycleTokens) {
  const src = String(line || "");
  const out = [];
  const tokens = Array.isArray(cycleTokens) && cycleTokens.length
    ? cycleTokens
    : (Array.from(new Set((src.match(/#\/\S+/g) || []).map((t) => String(t || "").trim()).filter(Boolean))));
  for (const token of tokens) {
    const rx = new RegExp(`(^|\\s)${escapeRx(token)}(?=\\s|$)`, "g");
    let m;
    while ((m = rx.exec(src)) !== null) {
      const leadLen = m[1] ? m[1].length : 0;
      const start = m.index + leadLen;
      const end = start + token.length;
      out.push({ token, start, end });
      if (rx.lastIndex === m.index) rx.lastIndex += 1;
    }
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

function insertTokenAtCursor(line, cursorCh, token, rules) {
  const src = String(line || "");
  const cursor = Math.max(0, Math.min(Number(cursorCh) || 0, src.length));
  const t = String(token || "").trim();
  if (!t) return { line: src, cursorCh: cursor, selectedToken: "" };
  const right = src.slice(cursor);
  const left = src.slice(0, cursor);
  const needLeftSpace = left.length > 0 && !/\s$/.test(left);
  const needRightSpace = right.length > 0 && !/^\s/.test(right);
  const inserted = `${left}${needLeftSpace ? " " : ""}${t}${needRightSpace ? " " : ""}${right}`;
  const cleaned = cleanupSpacing(inserted, rules);
  const next = Math.max(0, Math.min(cleaned.length, remapCursorStable(inserted, cleaned, cursor + t.length)));
  return { line: cleaned, cursorCh: next, selectedToken: t };
}

function findActiveWordBounds(line, cursorCh) {
  const src = String(line || "");
  const cursor = Math.max(0, Math.min(Number(cursorCh) || 0, src.length));
  const rx = /\S+/g;
  let m;
  let prev = null;
  while ((m = rx.exec(src)) !== null) {
    const start = m.index;
    const end = start + String(m[0] || "").length;
    if (cursor >= start && cursor <= end) return { start, end };
    if (start > cursor) return { start, end };
    prev = { start, end };
  }
  return prev;
}

function cyclePriorityTokenInFullMode(line, cursorCh, direction, cycleTokens, fullPlacement, rules) {
  const src = String(line || "");
  const cursor = Math.max(0, Math.min(Number(cursorCh) || 0, src.length));
  const ordered = Array.isArray(cycleTokens) ? cycleTokens.filter(Boolean) : [];
  const matches = findPriorityMatchesInLine(src, ordered);
  const focused = pickFocusedTokenMatch(matches, cursor);
  const activeWord = findActiveWordBounds(src, cursor);
  const smartPlacement = String(fullPlacement || "").toLowerCase() === "smart";
  if (!focused && smartPlacement && activeWord && cursor >= activeWord.end) {
    const seed = direction === "decrease" ? (ordered[ordered.length - 1] || "") : (ordered[0] || "");
    const hasTokenBeforeWord = matches.some((m) => m && m.end <= activeWord.start);
    if (seed && hasTokenBeforeWord) {
      const insertAt = activeWord.end;
      const injected = `${src.slice(0, insertAt)}${insertAt > 0 && !/\s$/.test(src.slice(0, insertAt)) ? " " : ""}${seed}${src.slice(insertAt)}`;
      const cleaned = cleanupSpacing(injected, rules);
      const next = Math.max(0, Math.min(cleaned.length, remapCursorStable(injected, cleaned, cursor + seed.length + 1)));
      return { line: cleaned, cursorCh: next, selectedToken: seed };
    }
  }
  if (!focused && smartPlacement && activeWord && matches.length >= 2) {
    const primary = matches[0];
    const nextPrimary = nextCycleTokenByDirection(ordered, primary.token, direction);
    const secondary = matches.filter((m) => m.start !== primary.start || m.end !== primary.end)
      .filter((m) => m.end <= activeWord.start)
      .slice(-1)[0];
    if (nextPrimary && secondary) {
      let work = src;
      work = replaceRange(work, primary.start, primary.end, nextPrimary);
      const deltaPrimary = nextPrimary.length - (primary.end - primary.start);
      const secStart = secondary.start + (secondary.start > primary.start ? deltaPrimary : 0);
      const secEnd = secondary.end + (secondary.start > primary.start ? deltaPrimary : 0);
      const secToken = String(secondary.token || "");
      work = replaceRange(work, secStart, secEnd, "");
      const activeNow = findActiveWordBounds(work, cursor);
      if (activeNow) {
        const insertAt = activeNow.start;
        const injected = `${work.slice(0, insertAt)}${insertAt > 0 && !/\s$/.test(work.slice(0, insertAt)) ? " " : ""}${secToken} ${work.slice(insertAt)}`;
        const cleaned = cleanupSpacing(injected, rules);
        const next = Math.max(0, Math.min(cleaned.length, remapCursorStable(injected, cleaned, cursor + secToken.length + 1)));
        return { line: cleaned, cursorCh: next, selectedToken: nextPrimary };
      }
    }
  }
  if (!focused && smartPlacement && matches.length > 0 && cursor < matches[0].start) {
    const seed = direction === "decrease" ? (ordered[ordered.length - 1] || "") : (ordered[0] || "");
    return insertTokenAtCursor(src, cursor, seed, rules);
  }
  if (!focused && smartPlacement && activeWord && matches.length === 1) {
    const single = matches[0];
    const seed = direction === "decrease" ? (ordered[ordered.length - 1] || "") : (ordered[0] || "");
    if (seed && activeWord.start >= single.end) {
      const insertAt = cursor >= activeWord.end ? activeWord.end : activeWord.start;
      const injected = `${src.slice(0, insertAt)}${insertAt > 0 && !/\s$/.test(src.slice(0, insertAt)) ? " " : ""}${seed} ${src.slice(insertAt)}`;
      const cleaned = cleanupSpacing(injected, rules);
      const next = Math.max(0, Math.min(cleaned.length, remapCursorStable(injected, cleaned, cursor + seed.length + 1)));
      return { line: cleaned, cursorCh: next, selectedToken: seed };
    }
  }
  const focus = focused || pickClosestTokenMatch(matches, cursor);
  if (focus) {
    const idx = ordered.indexOf(focus.token);
    if (matches.length === 1 && direction === "increase" && idx === ordered.length - 1) {
      const wrapToken = ordered[0] || "";
      if (wrapToken) {
        const right = src.slice(cursor);
        const left = src.slice(0, cursor);
        const needLeftSpace = left.length > 0 && !/\s$/.test(left);
        const needRightSpace = right.length > 0 && !/^\s/.test(right);
        const inserted = `${left}${needLeftSpace ? " " : ""}${wrapToken}${needRightSpace ? " " : ""}${right}`;
        const cleaned = cleanupSpacing(inserted, rules);
        const next = Math.max(0, Math.min(cleaned.length, remapCursorStable(inserted, cleaned, cursor + wrapToken.length)));
        return { line: cleaned, cursorCh: next, selectedToken: wrapToken };
      }
    }
    let nextToken = "";
    if (direction === "decrease") {
      if (idx === -1) nextToken = ordered[ordered.length - 1] || "";
      else if (idx === 0) nextToken = "";
      else nextToken = ordered[idx - 1] || "";
    } else {
      if (idx === -1) nextToken = ordered[0] || "";
      else if (idx >= ordered.length - 1) nextToken = "";
      else nextToken = ordered[idx + 1] || "";
    }
    const replaced = replaceRange(src, focus.start, focus.end, nextToken);
    const cleaned = cleanupSpacing(replaced, rules);
    const rel = Math.max(0, Math.min(cursor - focus.start, focus.end - focus.start));
    const desired = focus.start + Math.min(rel, String(nextToken || "").length);
    const next = Math.max(0, Math.min(cleaned.length, remapCursorStable(replaced, cleaned, desired)));
    return { line: cleaned, cursorCh: next, selectedToken: nextToken };
  }
  const seed = direction === "decrease" ? (ordered[ordered.length - 1] || "") : (ordered[0] || "");
  if (!seed) return { line: src, cursorCh: cursor, selectedToken: "" };
  return applyFullTokenAction(src, seed, ordered.map((t) => ({ id: t, token: t })), cursor, rules);
}

function nextCycleTokenByDirection(tokens, currentToken, direction) {
  const arr = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
  if (!arr.length) return "";
  const idx = arr.indexOf(String(currentToken || ""));
  if (direction === "decrease") {
    if (idx === -1) return arr[arr.length - 1] || "";
    if (idx === 0) return "";
    return arr[idx - 1] || "";
  }
  if (idx === -1) return arr[0] || "";
  if (idx >= arr.length - 1) return "";
  return arr[idx + 1] || "";
}

function extractCurrentPriorityToken(line, cycleTokens, cursorCh) {
  const matches = findPriorityMatchesInLine(line, cycleTokens);
  if (!matches.length) return "";
  const focus = pickFocusedTokenMatch(matches, cursorCh) || pickClosestTokenMatch(matches, cursorCh);
  if (focus && focus.token) return String(focus.token);
  return String(matches[0].token || "");
}

function findTokenMatches(line, tokenMap) {
  const src = String(line || "");
  const out = [];
  for (const entry of Array.isArray(tokenMap) ? tokenMap : []) {
    const tokenRaw = String(entry && entry.token ? entry.token : "").trim();
    const token = tokenRaw.startsWith("/") ? `#${tokenRaw}` : tokenRaw;
    const id = String(entry && entry.id ? entry.id : "").trim();
    if (!token || !id) continue;
    const rx = new RegExp(`(^|\\s)${escapeRx(token)}(?=\\s|$)`, "g");
    let m;
    while ((m = rx.exec(src)) !== null) {
      const leadLen = m[1] ? m[1].length : 0;
      const start = m.index + leadLen;
      const end = start + token.length;
      out.push({ id, token, start, end });
      if (rx.lastIndex === m.index) rx.lastIndex += 1;
    }
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

function pickFocusedTokenMatch(matches, cursorCh) {
  const cursor = Math.max(0, Number(cursorCh) || 0);
  const list = Array.isArray(matches) ? matches : [];
  let best = null;
  let bestRank = 999;
  let bestDist = 999;
  for (const m of list) {
    const inToken = cursor >= m.start && cursor <= m.end;
    const nearRight = cursor > m.end && (cursor - m.end) <= 2;
    const nearLeft = cursor < m.start && (m.start - cursor) <= 2;
    let rank = 999;
    if (inToken) rank = 0;
    else if (nearRight || nearLeft) rank = 1;
    else continue;
    const center = Math.floor((m.start + m.end) / 2);
    const dist = Math.abs(cursor - center);
    if (rank < bestRank || (rank === bestRank && dist < bestDist)) {
      best = m;
      bestRank = rank;
      bestDist = dist;
    }
  }
  return best;
}

function pickClosestTokenMatch(matches, cursorCh) {
  const cursor = Math.max(0, Number(cursorCh) || 0);
  const list = Array.isArray(matches) ? matches : [];
  if (!list.length) return null;
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  let bestRightBias = Number.POSITIVE_INFINITY;
  for (const m of list) {
    const center = (m.start + m.end) / 2;
    const dist = Math.abs(cursor - center);
    const rightBias = m.start >= cursor ? 0 : 1;
    if (dist < bestDist || (dist === bestDist && rightBias < bestRightBias)) {
      best = m;
      bestDist = dist;
      bestRightBias = rightBias;
    }
  }
  return best;
}

function replaceRange(text, start, end, replacement) {
  return getStatusRuntimeCommon().replaceRange(text, start, end, replacement);
}

function cleanupSpacing(text, rules) {
  return getStatusRuntimeCommon().cleanupSpacing(text, rules);
}

function applyFullTokenAction(line, selectedToken, tokenMap, cursorCh, rules) {
  const src = String(line || "");
  const cursor = Math.max(0, Math.min(Number(cursorCh) || 0, src.length));
  const matches = findTokenMatches(src, tokenMap);
  let focus = pickFocusedTokenMatch(matches, cursor);
  if (!focus && matches.length > 1) focus = pickClosestTokenMatch(matches, cursor);
  if (!focus && matches.length === 1) {
    const solo = matches[0];
    if (cursor >= solo.start) focus = solo;
  }
  if (focus) {
    const replaced = replaceRange(src, focus.start, focus.end, selectedToken || "");
    const cleaned = cleanupSpacing(replaced, rules);
    const rel = Math.max(0, Math.min(cursor - focus.start, focus.end - focus.start));
    const desired = focus.start + Math.min(rel, String(selectedToken || "").length);
    const next = Math.max(0, Math.min(cleaned.length, remapCursorStable(replaced, cleaned, desired)));
    return { line: cleaned, cursorCh: next };
  }
  if (!selectedToken) return { line: src, cursorCh: cursor };
  const right = src.slice(cursor);
  const left = src.slice(0, cursor);
  const needLeftSpace = left.length > 0 && !/\s$/.test(left);
  const needRightSpace = right.length > 0 && !/^\s/.test(right);
  const inserted = `${left}${needLeftSpace ? " " : ""}${selectedToken}${needRightSpace ? " " : ""}${right}`;
  const cleaned = cleanupSpacing(inserted, rules);
  const next = Math.max(0, Math.min(cleaned.length, remapCursorStable(inserted, cleaned, cursor + String(selectedToken).length)));
  return { line: cleaned, cursorCh: next };
}

function nextCycleIdByDirection(cycle, currentId, direction) {
  const arr = Array.isArray(cycle) ? cycle : [];
  if (!arr.length) return "";
  const idx = arr.findIndex((v) => valueId(v) === currentId);
  if (direction === "decrease") {
    if (idx === -1) return valueId(arr[arr.length - 1]);
    if (idx === 0) return "";
    return valueId(arr[idx - 1]);
  }
  if (idx === -1) return valueId(arr[0]);
  if (idx === arr.length - 1) return "";
  return valueId(arr[idx + 1]);
}

function resolveFieldIdByOrderKey(rules, orderKey) {
  const key = String(orderKey || "").trim();
  if (!key) return "";
  const left = Array.isArray(rules?.leftMode?.fields) ? rules.leftMode.fields : [];
  const right = Array.isArray(rules?.rightMode?.fields) ? rules.rightMode.fields : [];
  const fields = left.concat(right);
  const reg = getDomainRegistry();
  const isCycleCapableField = (field) => {
    const vals = Array.isArray(field && field.values) ? field.values : [];
    for (const v of vals) {
      const token = String(v && v.token || "").trim();
      if (token && v && v.active !== false) return true;
    }
    return false;
  };
  const byOrderKey = fields.find((x) => x && String(x.orderKey || "").trim() === key);
  if (byOrderKey && byOrderKey.id) return String(byOrderKey.id);
  if (reg && typeof reg.resolveLeftFieldIdByOrderKey === "function") {
    const resolved = String(reg.resolveLeftFieldIdByOrderKey(key) || "").trim();
    if (resolved) {
      const byResolved = fields.find((x) => x && String(x.id || "").trim() === resolved);
      if (byResolved && byResolved.id) return String(byResolved.id || "").trim();
    }
  }
  /*
   * Переименование Field меняет его имя, а ключ Order остаётся прежним:
   * `setStrictName` пишет `strictNames[k]`, ключ `k` в `fields.order.*` не
   * трогает, а в документ правил Field уезжает под новым именем. Значит
   * «ключ → поле» после переименования знает только `strictNames`, и читать
   * надо его, а не догадываться (A17).
   */
  const strictNames = isObj(rules?.behavior?.order?.strictNames) ? rules.behavior.order.strictNames : null;
  if (strictNames) {
    const strictName = String(strictNames[key] || "").trim();
    if (strictName && strictName !== key) {
      const byStrict = fields.find((x) => x && (
        String(x.id || "").trim() === strictName
        || String(x.orderKey || "").trim() === strictName
      ));
      if (byStrict && byStrict.id) return String(byStrict.id || "").trim();
    }
  }
  const leftOrder = Array.isArray(rules?.behavior?.order?.left) ? rules.behavior.order.left : [];
  const rightOrder = Array.isArray(rules?.behavior?.order?.right) ? rules.behavior.order.right : [];
  const priorityLikeFields = fields.filter((x) => {
    if (!x || !Array.isArray(x.values)) return false;
    return x.values.some((v) => {
      const token = String(v && v.token || "").trim();
      return /^#\//.test(token) || /^\//.test(token);
    });
  });
  const isPriorityLikeKey = /(?:^|[_-])(importance|priority)(?:$|[_-])/i.test(key);
  if (isPriorityLikeKey && priorityLikeFields.length === 1 && priorityLikeFields[0] && priorityLikeFields[0].id) {
    return String(priorityLikeFields[0].id || "").trim();
  }
  const resolveByNeighborInOrder = (orderList, fieldList, startIdx) => {
    const arr = Array.isArray(orderList) ? orderList : [];
    const modeFields = Array.isArray(fieldList) ? fieldList : [];
    if (!arr.length || startIdx < 0) return "";
    const maxDist = Math.max(startIdx, arr.length - 1 - startIdx);
    for (let dist = 1; dist <= maxDist; dist++) {
      const rightPos = startIdx + dist;
      if (rightPos < arr.length) {
        const rk = String(arr[rightPos] || "").trim();
        if (rk) {
          const rf = modeFields.find((f) => f && (String(f.orderKey || "").trim() === rk || String(f.id || "").trim() === rk));
          if (rf && rf.id && isCycleCapableField(rf)) return String(rf.id || "").trim();
        }
      }
      const leftPos = startIdx - dist;
      if (leftPos >= 0) {
        const lk = String(arr[leftPos] || "").trim();
        if (lk) {
          const lf = modeFields.find((f) => f && (String(f.orderKey || "").trim() === lk || String(f.id || "").trim() === lk));
          if (lf && lf.id && isCycleCapableField(lf)) return String(lf.id || "").trim();
        }
      }
    }
    return "";
  };
  /*
   * Здесь стояла позиционная догадка: найти номер ключа в списке порядка и
   * взять Field **с тем же номером**. Списки строятся разными проходами, у них
   * разная длина и разный порядок — в фикстуре шесть-восемь ключей против
   * тринадцати Field, — так что индекс из одного в другом не адресует ничего
   * (A17, У-49). В фикстуре она попадала верно по совпадению; стоило сдвинуть
   * поле в другую панель, и команда категории уводила по значениям чужого поля
   * `modal`, у которого цикл значений пуст, — наружу это выходило как полное
   * молчание движка. Разрешение по имени выше отвечает на тот же вопрос
   * честно, а соседа по списку оставляем последним средством: он хотя бы
   * ищется по имени, а не по номеру.
   */
  const leftIdx = leftOrder.findIndex((k) => String(k || "").trim() === key);
  if (leftIdx >= 0) {
    const byNeighborLeft = resolveByNeighborInOrder(leftOrder, left, leftIdx);
    if (byNeighborLeft) return byNeighborLeft;
  }
  const rightIdx = rightOrder.findIndex((k) => String(k || "").trim() === key);
  if (rightIdx >= 0) {
    const byNeighborRight = resolveByNeighborInOrder(rightOrder, right, rightIdx);
    if (byNeighborRight) return byNeighborRight;
  }
  const byId = fields.find((x) => x && String(x.id || "").trim() === key);
  if (byId && byId.id) return String(byId.id);
  if (priorityLikeFields.length === 1 && priorityLikeFields[0] && priorityLikeFields[0].id) {
    return String(priorityLikeFields[0].id || "").trim();
  }
  return "";
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
  if (reg && typeof reg.resolveOrderKeyFromFieldId === "function") {
    const mapped = String(reg.resolveOrderKeyFromFieldId(String(f.id || "").trim()) || "").trim();
    if (mapped) return mapped;
  }
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

function resolveParentFieldForSubAction(rules, orderKey, targetField) {
  const key = String(orderKey || "").trim();
  if (!/_sub$/.test(key)) return null;
  const parentOrderKey = key.slice(0, -4);
  const parentFieldId = resolveFieldIdByOrderKey(rules, parentOrderKey);
  if (!parentFieldId) return null;
  const left = rules && rules.leftMode ? rules.leftMode : null;
  const right = rules && rules.rightMode ? rules.rightMode : null;
  const parentField = getField(left, parentFieldId) || getField(right, parentFieldId);
  if (!parentField) return null;
  if (targetField && typeof targetField.dependsOn === "string" && targetField.dependsOn) {
    if (String(targetField.dependsOn || "").trim() !== String(parentField.id || "").trim()) return null;
  }
  return { parentOrderKey, parentField };
}

function panelForTagKey(orderCfg, key) {
  const k = String(key || "");
  const statusCommon = getStatusRuntimeCommon();
  if (/_sub$/.test(k)) return statusCommon.getPanelForField(orderCfg, k.slice(0, -4));
  return statusCommon.getPanelForField(orderCfg, k);
}

function collectSelectedEntriesForPolicy(rules, state, orderCfg) {
  const out = [];
  const statusCommon = getStatusRuntimeCommon();
  const fields = Array.isArray(rules?.leftMode?.fields) ? rules.leftMode.fields : [];
  for (const field of fields) {
    if (!field || !field.id) continue;
    const selectedId = String(state?.selected?.[field.id] || "").trim();
    if (!selectedId) continue;
    const rawOrderKey = String(field.orderKey || field.id || "").trim();
    const panelKey = /_sub$/.test(rawOrderKey) ? rawOrderKey.slice(0, -4) : rawOrderKey;
    if (!panelKey) continue;
    const mode = statusCommon.getFieldFreeRoamMode(orderCfg, panelKey);
    out.push({ id: String(field.id), mode: String(mode || "off") });
  }
  return out;
}

module.exports = {
  settings: {
    name: "Status: Tags & Context logic",
    author: "you",
    options: {
      [ACTION_TYPE]: {
        type: "dropdown",
        defaultValue: "cycle_field:type",
        options: [
          "cycle_field:type",
          "cycle_field:category",
          "cycle_field:type_sub",
          "cycle_field:category_sub",
        ],
        description: "Action: what to cycle on this hotkey",
      },
      [SUBTAG_FORMAT]: {
        type: "dropdown",
        defaultValue: "",
        options: ["", "separate", "combined"],
        description: "Optional override: separate (#parent #sub) or combined (#parent/sub). Empty = use rules.behavior.subtagFormat",
      },
      [CYCLE_END_BEHAVIOR]: {
        type: "dropdown",
        defaultValue: "keep-bullet",
        options: ["keep-bullet", "clear-prefix"],
        description: "On cycle end for empty-like lines: keep bullet (- ) or clear line",
      },
      [CURSOR_POLICY]: {
        type: "dropdown",
        defaultValue: "text_end",
        options: ["text_end", "current_position", "line_end"],
        description: "Cursor behavior after action",
      },
      [ORDER_CONFIG]: {
        type: "text",
        defaultValue: "",
        description: "Optional JSON order config from plugin",
      },
      [DIRECTION]: {
        type: "dropdown",
        defaultValue: "increase",
        options: ["increase", "decrease"],
        description: "Cycle direction",
      },
    },
  },

  entry: async (QuickAdd, settings) => {
    const app_ = QuickAdd?.app ?? app;
    const editor = __activeEditorMod.activeEditorFrom(app_);
    if (!editor) return;

    /*
     * Свои модули уже приехали `require` при загрузке файла. Здесь
     * остаются только те, что публикуют себя в `globalThis`: их читают
     * оттуда и `status_runtime_common`, и TagWheel.
     */
    await callRuntimeApi(app_, "loadRulesRuntimeHelpers");
    await callRuntimeApi(app_, "loadMacroShared");
    await callRuntimeApi(app_, "loadLinePipeline");
    const lineFinalize = getLineFinalizeUnified();
    if (typeof lineFinalize.resolveOffPrefixFlagsUnified !== "function") {
      throw new Error("pkm_line_finalize_unified unavailable: resolveOffPrefixFlagsUnified");
    }

    const core = __tagwheelCore;
    /*
     * Уведомление спрашивает текст у каталога (PRD 10.13.50, ответ на В-74).
     * Форма: `notice(key, english, ...args)`; английское остаётся здесь, на
     * случай если слой настроек не загрузился. Ключ собирает функция (У-82).
     */
    const noticeKey = (name) => __sayModule.noticeKey('rules', name);
    const notice = (key, english, ...args) => {
      /*
       * Текст спрашивается у общего кода, своей копии здесь нет (В-100,
       * 2026-09-10, тридцать седьмое исключение к З3). Правило «спросить шов,
       * при отказе остаться на английском, подставить `{0}`» живёт в
       * `src/core/say.js` и было объявлено четыре раза: там и в трёх движках.
       */
      const text = __say(key, english, ...args);
      /*
       * Отказ самого показа молчать не имеет права (третий кусок В-97). Через
       * этот помощник идут и отчёты о сбое — файл правил не прочитан, правила
       * не сходятся после применения порядка, — и после них работа
       * прекращается: не показалось, значит человек остался и без результата,
       * и без причины. Это второй вид отказа, и его место — журнал
       * разработчика, а не тишина.
       */
      try {
        new Notice(text);
      } catch (e) {
        console.error("[inline-overhaul] сообщение не показано: " + text, e);
      }
    };
    /* Предусловие Field спрашивается у общего объявления (Н21): движок и
       панель отвечают на этот вопрос одинаково. */
    const rulesHelpers = globalThis.__inlinePkmRulesHelpers;
    if (!rulesHelpers || typeof rulesHelpers.isFieldPrerequisiteMet !== "function") {
      throw new Error("pkm_rules_runtime_helpers unavailable: isFieldPrerequisiteMet");
    }
    const macroShared = globalThis.__inlinePkmMacroShared;
    if (!macroShared || typeof macroShared.isOrphanCheckboxBulletLine !== "function") {
      throw new Error("pkm_macro_shared unavailable: isOrphanCheckboxBulletLine");
    }
    if (typeof macroShared.buildBulletOnlyLine !== "function") {
      throw new Error("pkm_macro_shared unavailable: buildBulletOnlyLine");
    }
    if (typeof macroShared.applyKeepBullet !== "function") {
      throw new Error("pkm_macro_shared unavailable: applyKeepBullet");
    }
    if (typeof macroShared.ensureTrailingSeparatorSpace !== "function") {
      throw new Error("pkm_macro_shared unavailable: ensureTrailingSeparatorSpace");
    }
    if (typeof macroShared.getCursorAtTextEnd !== "function") {
      throw new Error("pkm_macro_shared unavailable: getCursorAtTextEnd");
    }
    if (typeof macroShared.getTextSlotBounds !== "function") {
      throw new Error("pkm_macro_shared unavailable: getTextSlotBounds");
    }
    if (typeof macroShared.isBulletLikeEmptyResult !== "function") {
      throw new Error("pkm_macro_shared unavailable: isBulletLikeEmptyResult");
    }

    const statusCommon = getStatusRuntimeCommon();
    /*
     * **Правила приезжают из настроек** (PRD 10.13.52, П-8; 2026-09-11).
     *
     * **Запасного хода через служебный файл больше нет** (шаг третий,
     * 2026-09-13): файла не читает ни один движок, и разбора заметки в
     * продукте не осталось. Ключа нет — движок отказывается вслух: работать по
     * правилам, которых человек не задавал, хуже, чем не сработать (Д-4).
     */
    const rules = statusCommon.rulesFromSettings(settings, RULES_DATA);
    if (!rules) {
      notice(noticeKey('rules-missing'),
        'No rules came with the command - run it from the command list or its hotkey');
      return;
    }
    const subtagFormat = getSubtagFormat(rules, settings);
    if (!isObj(rules.behavior)) rules.behavior = {};
    rules.behavior.subtagFormat = subtagFormat;
    await statusCommon.resolveAndApplyDateRuntimeConfig(app_, settings, rules);
    const orderCfg = await statusCommon.resolveOrderConfig(app_, settings);
    statusCommon.applyOrderToRules(rules, orderCfg);
    try {
      core.validateRules(rules);
    } catch (e) {
      notice(noticeKey('config-error'),
        'Rules are not valid after applying the order: {0}',
        String(e && e.message ? e.message : e || "validateRules failed"));
      return;
    }

    const action = String(settings?.[ACTION_TYPE] ?? "").trim();
    const direction = normalizeDirection(settings?.[DIRECTION]);
    const fallbackActionFieldKey = (() => {
      const leftKeys = Array.isArray(orderCfg && orderCfg.left) ? orderCfg.left : [];
      const rightKeys = Array.isArray(orderCfg && orderCfg.right) ? orderCfg.right : [];
      for (const key of leftKeys.concat(rightKeys)) {
        const k = String(key || "").trim();
        if (!k) continue;
        if (!statusCommon.isFieldKeyEnabled(orderCfg, k)) continue;
        const fid = String(resolveFieldIdByOrderKey(rules, k) || "").trim();
        if (fid) return k;
      }
      const leftFields = Array.isArray(rules?.leftMode?.fields) ? rules.leftMode.fields : [];
      const first = leftFields.find((f) => f && (String(f.orderKey || "").trim() || String(f.id || "").trim()));
      return String(first && (first.orderKey || first.id) || "").trim();
    })();
    const actionFieldKey = fieldKeyByAction(action, fallbackActionFieldKey);
    const resolvedActionFieldId = String(resolveFieldIdByOrderKey(rules, actionFieldKey) || "").trim();
    const actionIsCycleField = /^cycle_field:/.test(action);
    if (!statusCommon.isFieldKeyEnabled(orderCfg, actionFieldKey)) return;
    const targetPanel = panelForTagKey(orderCfg, actionFieldKey);
    const freeRoamMode = statusCommon.getFieldFreeRoamMode(orderCfg, actionFieldKey);
    const freeRoamBehavior = statusCommon.getFreeRoamBehavior(orderCfg);

    const cur = editor.getCursor();
    const lineNo = cur.line;
    const rawLine = String(editor.getLine(lineNo) ?? "").replace(/\n$/, "");
    const parsed = core.parseLine(rawLine, rules);
    const cycleEndBehavior = statusCommon.normalizeCycleEndBehavior(settings?.[CYCLE_END_BEHAVIOR]);
    const cursorPolicy = statusCommon.normalizeCursorPolicy(settings?.[CURSOR_POLICY]);
    /*
     * **Строка идёт дальше со своим знаком задачи.**
     *
     * Здесь стояло стирание: на строке без содержимого чекбокс снимался, если у
     * поля действия своих знаков нет. Гидратация знака не читает вовсе (она
     * работает корзинами `tags` и `dates`), и единственным читателем стёртого
     * был построитель префикса — то есть всё, что стирание делало, это
     * отнимало у строки знак задачи. Замечание заказчика 2026-09-13: `- [ ] `
     * после `importance next` давала `-  :: #/1`.
     *
     * Прошлая починка того же правила (10.13.92) закрыла случай со строкой, у
     * которой есть текст, и не могла закрыть этот: до флагов `preserve` предмет
     * уже не доезжал (У-164).
     */
    let parsedWork = parsed;

    const state = core.makeInitialState(rules, "left");
    state.mode = "left";
    core.hydrateStateFromParsedLine(rules, state, parsedWork);
    core.sanitizeState(rules, state);

    /*
     * **Предусловие Field спрашивают все три дороги.** Правило записано в PRD
     * 10.13.4, Н21, и слово там сказано прямо: Field с предусловием не
     * показывается «ни в TagWheel, ни в своих командах». Панель его
     * спрашивала, команды — нет: на пустой строке `Project next` писал
     * значение, хотя панель в том же месте этого Field не показывает вовсе
     * (обход строки 2026-09-12). Объявление одно —
     * `isFieldPrerequisiteMet` в `pkm_rules_runtime_helpers.js`.
     *
     * Отказ громкий: человек сам позвал команду, и молчание он прочтёт как
     * поломку (правило отказов, PRD 15.2).
     */
    if (resolvedActionFieldId) {
      const actionFieldAny = getField(rules.leftMode, resolvedActionFieldId)
        || getField(rules.rightMode, resolvedActionFieldId);
      if (actionFieldAny && !rulesHelpers.isFieldPrerequisiteMet(actionFieldAny, state.selected)) {
        notice(noticeKey("prerequisite-unmet"),
          "{0} waits for {1}: set it on this line first",
          String(actionFieldAny.placeholder || actionFieldAny.id || ""),
          String(actionFieldAny.dependsOn || ""));
        return;
      }
    }
    if (
      !lineFinalize
      || typeof lineFinalize.resolveEffectiveSelectionPolicy !== "function"
      || typeof lineFinalize.hasAnySeparator !== "function"
      || typeof lineFinalize.normalizeMinimalOffFinalLine !== "function"
    ) {
      throw new Error("pkm_line_finalize_unified unavailable: required api");
    }
    const resolveMixedPolicy = () => {
      const entries = collectSelectedEntriesForPolicy(rules, state, orderCfg);
      const activeMode = String(freeRoamMode || "off").trim().toLowerCase();
      return lineFinalize.resolveEffectiveSelectionPolicy({
        selectedEntries: entries,
        freeRoamBehavior,
        activeMode,
      });
    };
    let mixedPolicy = resolveMixedPolicy();
    let prefixState = (freeRoamBehavior.minimalPrefix === false && mixedPolicy.hasMinimalSelected)
      ? { ...state, __prefixIgnoreFieldIds: { ...(mixedPolicy.minimalPrefixIgnoreFieldIds || {}) } }
      : state;

    const left = rules.leftMode;
    let customRelocation = null;
    let customParentRelocation = null;
    let directImportanceFullResult = null;
    let clearedDependentFieldIds = [];
    let targetFieldForPrefix = null;
    let targetSelectionClearedByAction = false;

    if (!actionIsCycleField && !/_sub$/.test(actionFieldKey) && resolvedActionFieldId) {
      const parentField = getField(left, resolvedActionFieldId);
      if (!parentField) return;
      targetFieldForPrefix = parentField;
      const parentSelectedKey = String(parentField.id || "");
      if (!parentSelectedKey) return;
      const cycle = activeValues(parentField);
      if (!cycle.length) return;
      const map = fieldTokenMap(parentField, rules, state, core);
      if (!state.selected[parentSelectedKey]) hydrateFieldFromLine(state, rawLine, rules, targetPanel, parentSelectedKey, map);

      let currentId = String(state.selected[parentSelectedKey] || "");
      const hasParentTag = !!currentId;
      const parentCheckboxMap = isObj(rules?.behavior?.prefixRules?.checkboxByFieldValue?.[parentSelectedKey])
        ? rules.behavior.prefixRules.checkboxByFieldValue[parentSelectedKey]
        : {};
      if (!currentId && parsed.checkboxToken && isObj(parentCheckboxMap)) {
        const cbMap = parentCheckboxMap;
        for (const token of Object.keys(cbMap)) {
          if (cbMap[token] !== parsed.checkboxToken) continue;
          const vv = findValueByToken(parentField, token);
          if (vv) currentId = valueId(vv);
          break;
        }
      }
      if (!state.selected[parentSelectedKey] && currentId) {
        state.selected[parentSelectedKey] = currentId;
      }
      const nextId = nextCycleIdByDirection(cycle, currentId, direction);
      let nextVal = nextId ? (cycle.find((v) => valueId(v) === nextId) || null) : null;
      if (parsed.checkboxToken && !hasParentTag) {
        if (currentId) {
          nextVal = cycle.find((v) => valueId(v) === currentId) || (direction === "decrease" ? cycle[cycle.length - 1] : cycle[0]) || null;
        } else {
          nextVal = direction === "decrease" ? cycle[cycle.length - 1] : cycle[0];
        }
      }

      const childField = left?.fields?.find((f) => f && String(f.dependsOn || "").trim() === parentSelectedKey) || null;
      if ((nextVal ? valueId(nextVal) : "") !== currentId && childField && childField.id) {
        state.selected[childField.id] = "";
      }
      if (currentId && !(nextVal && valueId(nextVal))) {
        targetSelectionClearedByAction = true;
      }
      state.selected[parentSelectedKey] = nextVal ? valueId(nextVal) : "";
      /* Значение ушло — уходит и его знак, но только его: чужой знак задачи
         на этой же строке человек ставил сам (10.13.92). */
      if (!state.selected[parentSelectedKey]
        && checkboxBelongsToField(rules, parentSelectedKey, parsed.checkboxToken)) {
        parsedWork = { ...parsedWork, checkboxToken: "" };
      }
    } else if (actionIsCycleField || /_sub$/.test(actionFieldKey)) {
      const targetFieldId = resolveFieldIdByOrderKey(rules, actionFieldKey);
      const targetField = getField(left, targetFieldId) || getField(rules.rightMode, targetFieldId);
      if (!targetField) return;
      targetFieldForPrefix = targetField;
      const parentInfo = resolveParentFieldForSubAction(rules, actionFieldKey, targetField);
      if (parentInfo) {
        const parentField = parentInfo.parentField;
        const parentPanel = panelForTagKey(orderCfg, parentInfo.parentOrderKey);
        const parentMap = fieldTokenMap(parentField, rules, state, core);
        const subPanel = panelForTagKey(orderCfg, actionFieldKey);
        const subMap = fieldTokenMap(targetField, rules, state, core);
        hydrateCombinedPairFromLine(state, rawLine, rules, parentPanel, parentField, targetField);
        if (!state.selected[parentField.id]) {
          hydrateFieldFromLine(state, rawLine, rules, parentPanel, parentField.id, parentMap);
        }
        if (!state.selected[targetField.id]) {
          hydrateFieldFromLine(state, rawLine, rules, subPanel, targetField.id, subMap);
        }
        const parentCycle = activeValuesForField(core, rules, state, parentField);
        let parentId = state.selected[parentField.id] || "";
        if (!parentId) {
          const seed = direction === "decrease" ? parentCycle[parentCycle.length - 1] : parentCycle[0];
          if (!seed) return;
          parentId = valueId(seed);
          state.selected[parentField.id] = parentId;
        }
        const parentVal = findValueById(parentField, parentId);
        if (!parentVal || !parentVal.token) return;
        const allowedSubs = getAllowedSubValues(targetField, parentVal.token || "");
        if (!allowedSubs.length) return;
        const currentSubId = state.selected[targetField.id] || "";
        const nextSubId = nextCycleIdByDirection(allowedSubs, currentSubId, direction);
        state.selected[parentField.id] = parentId;
        state.selected[targetField.id] = nextSubId;
        customParentRelocation = {
          field: parentField,
          panel: parentPanel,
          map: parentMap,
        };
        customRelocation = {
          field: targetField,
          panel: subPanel,
          map: subMap,
        };
      } else {
      const map = fieldTokenMap(targetField, rules, state, core);
      if (!state.selected[targetField.id]) hydrateFieldFromLine(state, rawLine, rules, targetPanel, targetField.id, map);
      const cycle = activeValuesForField(core, rules, state, targetField);
      if (!cycle.length) return;
      let currentId = state.selected[targetField.id] || "";
      const isPriorityField = isPriorityFieldLike(targetField);
      const isPriorityFull = isPriorityField && (freeRoamMode === "full" || countPriorityTokens(rawLine) >= 2);
      if (isPriorityFull && /#\/\S+/.test(String(rawLine || ""))) {
        const matches = findTokenMatches(rawLine, map);
        const focus = pickFocusedTokenMatch(matches, cur.ch) || pickClosestTokenMatch(matches, cur.ch);
        if (focus && focus.id) currentId = String(focus.id);
      }
      if (!state.selected[targetField.id] && currentId) {
        state.selected[targetField.id] = currentId;
      }
      const nextId = nextCycleIdByDirection(cycle, currentId, direction);
      state.selected[targetField.id] = nextId;
      if (currentId && !nextId) {
        targetSelectionClearedByAction = true;
      }
      if (nextId !== currentId) {
        clearedDependentFieldIds = getStatusLineRuntimeUnified().clearDependentSelections({
          rules,
          state,
          parentFieldId: targetField.id,
        });
      }
      const selectedToken = selectedTokenFromState(targetField, state, rules);
      if (isPriorityFull) {
        const priorityCycleTokens = resolvePriorityCycleTokens(map, rules, rawLine);
        const fullResult = cyclePriorityTokenInFullMode(rawLine, cur.ch, direction, priorityCycleTokens, freeRoamBehavior.fullPlacement, rules);
        directImportanceFullResult = {
          line: String(fullResult.line || ""),
          cursorCh: Number(fullResult.cursorCh) || 0,
        };
        const chosen = normalizePriorityToken(fullResult.selectedToken || selectedToken);
        if (chosen) {
          const hit = map.find((x) => normalizePriorityToken(x && x.token ? x.token : "") === chosen);
          if (hit && hit.id) state.selected[targetField.id] = String(hit.id);
        }
      }
      customRelocation = isPriorityFull ? null : {
        field: targetField,
        panel: targetPanel,
        map,
      };
      }
    }

    let skipPrefixRewrite = false;
    let skipTrailingSeparatorNormalization = false;
    let priorityCursorOverride = null;
    let finalLine = directImportanceFullResult
      ? String(directImportanceFullResult.line || "")
      : relocateCoreTagsByOrder(
        rawLine,
        rules,
        orderCfg,
        state,
        Array.isArray(left?.fields) ? left.fields : [],
        actionFieldKey,
        resolvedActionFieldId
      );
    if (directImportanceFullResult) {
      skipPrefixRewrite = true;
      skipTrailingSeparatorNormalization = true;
    }
    if (!directImportanceFullResult) {
      finalLine = applyCombinedSubtagsFromState(finalLine, rules, orderCfg, state, Array.isArray(left?.fields) ? left.fields : []);
      if (customParentRelocation && customParentRelocation.field && customParentRelocation.map) {
        finalLine = relocateFieldByPanel(
          finalLine,
          rules,
          orderCfg,
          customParentRelocation.panel,
          selectedTokenFromState(customParentRelocation.field, state, rules),
          customParentRelocation.map
        );
        finalLine = applyCombinedSubtagsFromState(finalLine, rules, orderCfg, state, Array.isArray(left?.fields) ? left.fields : []);
      }
      if (customRelocation && customRelocation.field && customRelocation.map) {
        finalLine = relocateFieldByPanel(
          finalLine,
          rules,
          orderCfg,
          customRelocation.panel,
          selectedTokenFromState(customRelocation.field, state, rules),
          customRelocation.map
        );
        finalLine = applyCombinedSubtagsFromState(finalLine, rules, orderCfg, state, Array.isArray(left?.fields) ? left.fields : []);
      }
      if (clearedDependentFieldIds.length) {
        finalLine = getStatusLineRuntimeUnified().stripFieldTokenSetFromLine({
          line: finalLine,
          rules,
          fieldIds: clearedDependentFieldIds,
          deps: {
            resolveTokensByFieldId: (fieldId) => {
              const fid = String(fieldId || "").trim();
              if (!fid) return [];
              const field = getField(rules.leftMode, fid) || getField(rules.rightMode, fid);
              if (!field) return [];
              return allFieldTokens(field, rules);
            },
            removeTokensAcrossSegments: ({ line: runtimeLine, rules: runtimeRules, tokens }) => {
              const shared = globalThis.__inlineLinePipeline;
              if (!shared || typeof shared.removeTokensAcrossSegments !== "function") {
                throw new Error("line_pipeline unavailable: removeTokensAcrossSegments");
              }
              return shared.removeTokensAcrossSegments({
                line: runtimeLine,
                rules: runtimeRules,
                tokens,
              });
            },
          },
        });
      }
    }

    const priorityField = getPriorityField(rules, left, rules.rightMode);
    const importanceFieldId = String(priorityField && priorityField.id || "").trim();
    const importanceOrderKey = String(resolveOrderKeyForField(rules, priorityField) || "").trim();
    const isImportanceOrderAction = !!(importanceOrderKey && String(actionFieldKey || "") === importanceOrderKey);
    const isPriorityAction =
      (importanceFieldId && String(customRelocation?.field?.id || "") === importanceFieldId)
      || (importanceFieldId && resolvedActionFieldId === importanceFieldId);
    const priorityLikeAction = isPriorityAction || isImportanceOrderAction;
    const isGenericCycleFieldAction = actionIsCycleField;
    const hasAnySeparatorFn = lineFinalize.hasAnySeparator;
    const rawHasSeparator = hasAnySeparatorFn(rawLine, rules);
    const simplePlainRawNoSep = lineFinalize.isSimplePlainRaw(rawLine, rules, {
      requireNoSeparator: true,
      hasStandaloneCheckboxPrefix: lineFinalize.hasStandaloneCheckboxPrefix,
      hasAnySeparator: hasAnySeparatorFn,
    });

    if (priorityLikeAction && freeRoamMode === "minimal" && freeRoamBehavior.minimalSeparator === false && !rawHasSeparator) {
      const importancePanel = panelForTagKey(orderCfg, resolveOrderKeyForField(rules, priorityField));
      const importanceField = priorityField;
      let selectedImportanceToken = normalizePriorityToken(selectedTokenFromState(importanceField, state, rules));
      if (!selectedImportanceToken) {
        const m = String(finalLine || "").match(/#\/\S+/);
        selectedImportanceToken = m ? String(m[0]) : "#/1";
      }
      if (simplePlainRawNoSep) {
        const plain = stripPriorityTokens(lineFinalize.removeConfiguredSeparators(rawLine, rules));
        finalLine = importancePanel === "left"
          ? `${selectedImportanceToken}${plain ? " " + plain : ""}`
          : `${plain}${selectedImportanceToken ? " " + selectedImportanceToken : ""}`;
        finalLine = String(finalLine || "").trim();
        skipPrefixRewrite = true;
        skipTrailingSeparatorNormalization = true;
      } else {
        finalLine = lineFinalize.removeConfiguredSeparators(finalLine, rules);
      }
    }
    if (!isPriorityAction && isGenericCycleFieldAction && freeRoamMode === "minimal" && freeRoamBehavior.minimalSeparator === false && !rawHasSeparator) {
      if (simplePlainRawNoSep) {
        const rawIndent = (String(rawLine || "").match(/^(\s*)/) || ["", ""])[1];
        const tokenMap = Array.isArray(customRelocation?.map) ? customRelocation.map : [];
        let selected = String(selectedTokenFromState(customRelocation?.field, state, rules) || "").trim();
        if (!selected) {
          const fromLine = String(selectedTokenFromLineByPanel(finalLine, rules, targetPanel, tokenMap) || "").trim();
          selected = targetSelectionClearedByAction ? "" : fromLine;
        }
        const linePipeline = globalThis.__inlineLinePipeline;
        if (!linePipeline || typeof linePipeline.removeExactTokens !== "function") {
          throw new Error("line_pipeline unavailable: removeExactTokens");
        }
        const plain = lineFinalize.removeConfiguredSeparators(linePipeline.removeExactTokens(rawLine, tokenMap.map((x) => String(x && x.token ? x.token : "").trim()).filter(Boolean)), rules)
          .replace(/\s{2,}/g, " ")
          .trim();
        const plainBody = targetPanel === "left"
          ? `${selected}${plain ? " " + plain : ""}`
          : `${plain}${selected ? " " + selected : ""}`;
        finalLine = rawIndent + String(plainBody || "").trim();
        const allowPrefixPass = freeRoamBehavior.minimalPrefix !== false;
        skipPrefixRewrite = !allowPrefixPass;
        skipTrailingSeparatorNormalization = !allowPrefixPass;
      }
    }
    if (priorityLikeAction && freeRoamMode === "minimal" && freeRoamBehavior.minimalSeparator === false && !rawHasSeparator) {
      if (simplePlainRawNoSep) {
        const importanceField = priorityField;
        const importanceMap = importanceField ? fieldTokenMap(importanceField, rules, state, core) : [];
        const cycleTokens = resolvePriorityCycleTokens(importanceMap, rules, rawLine);
        const currentToken = extractCurrentPriorityToken(rawLine, cycleTokens, cur.ch);
        const nextToken = nextCycleTokenByDirection(cycleTokens, currentToken, direction);
        const plain = stripPriorityTokens(rawLine);
        finalLine = nextToken ? `${plain} ${nextToken}`.trim() : plain;
      }
    }
    mixedPolicy = resolveMixedPolicy();
    prefixState = (freeRoamBehavior.minimalPrefix === false && mixedPolicy.hasMinimalSelected)
      ? { ...state, __prefixIgnoreFieldIds: { ...(mixedPolicy.minimalPrefixIgnoreFieldIds || {}) } }
      : state;
    if (freeRoamMode === "off") {
      const targetHasOwnCheckbox = hasOwnCheckboxForField(rules, state, targetFieldForPrefix, core);
      const targetFieldIdForPrefix = String(targetFieldForPrefix?.id || "").trim();
      const offFlags = lineFinalize.resolveOffPrefixFlagsUnified({
        mode: freeRoamMode,
        freeRoamBehavior,
        hasOwnCheckbox: targetHasOwnCheckbox,
        clearedOwnCheckbox: targetSelectionClearedByAction && checkboxBelongsToField(rules, targetFieldIdForPrefix, parsed.checkboxToken),
      });
      prefixState = {
        ...prefixState,
        __preserveCheckboxPrefix: offFlags.preserveCheckboxPrefix,
        __forceBulletPrefix: offFlags.forceBulletPrefix,
      };
    }

    if (!skipPrefixRewrite) {
      finalLine = lineFinalize.applyResolvedPrefixToLine({
        line: finalLine,
        rules,
        parsedLine: parsedWork,
        state,
        allowHeadingRewrite: freeRoamMode === "full",
        prefixState,
        buildPrefix: (parsedInput, runtimeRules, runtimePrefixState) => core?.buildPrefix?.(parsedInput, runtimeRules, runtimePrefixState, { prefixShared: lineFinalize }),
      });
      if (freeRoamMode === "full" && /^\s*#{1,6}\s+/.test(String(rawLine || "")) && !/^\s*#{1,6}\s+/.test(String(finalLine || ""))) {
        finalLine = lineFinalize.removeStandaloneHeadingMarkers(finalLine);
      }
      finalLine = reorderLineMixedByOrder(finalLine, rules, orderCfg);
      finalLine = enforceDependentAdjacencyForStatusLine(finalLine, rules, state, core);
    }

    finalLine = enforceOffModeFinalPrefix(finalLine, rawLine, freeRoamMode, rules, prefixState, targetFieldForPrefix, core, lineFinalize, cycleEndBehavior, freeRoamBehavior, mixedPolicy.hasMinimalSelected);

    if (priorityLikeAction) {
        const importanceField = getPriorityField(rules, left, rules.rightMode);
      const importanceMap = importanceField ? fieldTokenMap(importanceField, rules, state, core) : [];
      const rawPriorityCount = countPriorityTokens(rawLine);
      const outPriorityCount = countPriorityTokens(finalLine);
      let selectedImportanceToken = normalizePriorityToken(selectedTokenFromState(importanceField, state, rules));
      if (!selectedImportanceToken) {
        const m = String(finalLine || "").match(/#\/\S+/);
        selectedImportanceToken = m ? String(m[0]) : "";
      }
      if (rawPriorityCount > 0 && outPriorityCount > rawPriorityCount && selectedImportanceToken) {
        const priorityMap = buildPriorityTokenMapFromLine(rawLine);
        const corrected = applyFullTokenAction(rawLine, selectedImportanceToken, priorityMap.length ? priorityMap : importanceMap, cur.ch, rules);
        finalLine = String(corrected.line || "");
        if (Number.isFinite(corrected.cursorCh)) {
          priorityCursorOverride = Math.max(0, Number(corrected.cursorCh) || 0);
        }
      }
      if (freeRoamMode === "off" && outPriorityCount > 1 && selectedImportanceToken) {
        const shared = globalThis.__inlineLinePipeline;
        if (!shared || typeof shared.splitSegments !== "function" || typeof shared.buildFromSegments !== "function" || typeof shared.removeExactTokens !== "function") {
          throw new Error("line_pipeline unavailable: priority duplicate collapse helpers required");
        }
        const collapsedBase = stripPriorityTokens(finalLine);
        const seg = shared.splitSegments(collapsedBase, rules);
        const importancePanel = panelForTagKey(orderCfg, resolveOrderKeyForField(rules, importanceField));
        if (importancePanel === "right") {
          seg.dates = seg.dates ? `${selectedImportanceToken} ${seg.dates}` : selectedImportanceToken;
        } else {
          seg.left = seg.left ? `${seg.left} ${selectedImportanceToken}` : selectedImportanceToken;
        }
        finalLine = shared.buildFromSegments(seg, rules);
      }
    }
    const linePipeline = globalThis.__inlineLinePipeline;
    if (!linePipeline || typeof linePipeline.extractOriginalTextFromRawLine !== "function") {
      throw new Error("line_pipeline unavailable: extractOriginalTextFromRawLine");
    }
    if (typeof linePipeline.enforceTextSegmentForLeftTag !== "function") {
      throw new Error("line_pipeline unavailable: enforceTextSegmentForLeftTag");
    }
    if (targetPanel === "left" && freeRoamMode === "off" && !/^\s*#{1,6}\s+/.test(String(rawLine || ""))) {
      const originalText = linePipeline.extractOriginalTextFromRawLine(rawLine, rules);
      finalLine = linePipeline.enforceTextSegmentForLeftTag(finalLine, rules, originalText);
    }
    if (targetPanel === "left" && freeRoamMode === "minimal" && freeRoamBehavior.minimalSeparator !== false && !/^\s*#{1,6}\s+/.test(String(rawLine || ""))) {
      const originalText = linePipeline.extractOriginalTextFromRawLine(rawLine, rules);
      finalLine = linePipeline.enforceTextSegmentForLeftTag(finalLine, rules, originalText);
    }
    if (targetPanel === "left" && freeRoamMode === "minimal" && freeRoamBehavior.minimalSeparator === false && !isPriorityAction && !/^\s*#{1,6}\s+/.test(String(rawLine || ""))) {
      const originalText = linePipeline.extractOriginalTextFromRawLine(rawLine, rules);
      finalLine = linePipeline.enforceTextSegmentForLeftTag(finalLine, rules, originalText);
    }
    if (
      !/^\s*#{1,6}\s+/.test(String(rawLine || "")) &&
      !lineFinalize.hasListPrefix(rawLine) &&
      lineFinalize.hasListPrefix(finalLine) &&
      freeRoamMode !== "off" &&
      !(isPriorityAction && mixedPolicy.hasOffSelected) &&
      !lineFinalize.hasCheckboxListPrefix(finalLine)
    ) {
      finalLine = lineFinalize.removeSyntheticLeadingPrefix(finalLine);
    }
    const finalParsed0 = core.parseLine(finalLine, rules);
    const mixedMinimalSeparatorOff = isPriorityAction && mixedPolicy.applyMinimalSeparatorCollapse;
    finalLine = lineFinalize.applyTrailingSeparatorPolicy({
      line: finalLine,
      rules,
      parsedFinal: finalParsed0,
      freeRoamMode,
      mixedMinimalSeparatorOff,
      skipNormalization: skipTrailingSeparatorNormalization,
      ensureTrailingSeparatorSpace: (line, runtimeRules, parsedFinal) => macroShared.ensureTrailingSeparatorSpace(line, runtimeRules, parsedFinal),
    });
    const cyclePost = lineFinalize.applyCycleEndAndInvariants({
      rawLine,
      finalLine,
      rules,
      mode: freeRoamMode,
      cycleEndBehavior,
      parsedLine: parsedWork,
      parseLine: core.parseLine,
      isBulletLikeEmptyResult: (line, parsedLine, rulesArg) => macroShared.isBulletLikeEmptyResult(line, parsedLine, rulesArg),
      isOrphanCheckboxBulletLine: (line) => macroShared.isOrphanCheckboxBulletLine(line),
      sourceHasPrefix: !!String(parsed?.bulletToken || "").trim() || !!String(parsed?.checkboxToken || "").trim(),
      stripPrefixWhenSourceHasNoPrefix: freeRoamMode !== "off",
      stripPrefixKeepIndent: (line, removeCheckbox) => {
        const linePipeline = globalThis.__inlineLinePipeline;
        if (!linePipeline || typeof linePipeline.stripPrefixKeepIndent !== "function") {
          throw new Error("line_pipeline unavailable: stripPrefixKeepIndent");
        }
        return linePipeline.stripPrefixKeepIndent(line, removeCheckbox);
      },
      shouldClearToEmptyLine: (line) => /^\s*\[[^\]]\]\s*$/.test(String(line || "")),
      /* `keepCheckbox` считается, а не стоит литералом: строка, свёрнутая
         концом цикла, теряет знак значения и сохраняет знак человека. */
      buildBulletOnlyLine: (p) => macroShared.buildBulletOnlyLine(p, {
        keepParsedPrefix: true,
        keepCheckbox: !checkboxBelongsToField(rules, String(targetFieldForPrefix?.id || ""), parsed.checkboxToken),
      }),
      shouldKeepBulletLine: (line) => /^\s*(?:-|\d+\.)\s*$/.test(String(line || "")),
    });
    finalLine = String(cyclePost?.finalLine ?? finalLine);
    if (!String(finalLine || "").trim()) {
      editor.replaceRange("", { line: lineNo, ch: 0 }, { line: lineNo, ch: rawLine.length });
      editor.setCursor({ line: lineNo, ch: 0 });
      return;
    }
    if (targetPanel === "right") {
      /* Слот под текст возвращает одно объявление, и разделитель оно
         спрашивает у настроек: здесь стоял литеральный `||`. */
      finalLine = lineFinalize.restoreEmptyTextSlotAfterPrefix(finalLine, rules);
    }
    if (priorityLikeAction && freeRoamMode === "minimal" && !rawHasSeparator) {
      if (simplePlainRawNoSep) {
        finalLine = lineFinalize.normalizeMinimalPriorityNoSeparatorLine(finalLine, rules);
      }
    }
    if (priorityLikeAction && freeRoamMode === "minimal" && freeRoamBehavior.minimalSeparator === false && !rawHasSeparator) {
      const rawTrim = String(rawLine || "").trim();
      if (simplePlainRawNoSep) {
        const m = String(finalLine || "").match(/#\/\S+/);
        if (m) {
          finalLine = `${rawTrim} ${String(m[0])}`.replace(/\s{2,}/g, " ").trim();
          finalLine = reorderLineMixedByOrder(finalLine, rules, orderCfg);
          finalLine = lineFinalize.normalizeMinimalPriorityNoSeparatorLine(finalLine, rules);
        }
      }
    }
    if (priorityLikeAction && (freeRoamMode === "full" || countPriorityTokens(rawLine) >= 2) && /#\/\S+/.test(String(rawLine || ""))) {
        const importanceField = getPriorityField(rules, left, rules.rightMode);
      const importanceMap = importanceField ? fieldTokenMap(importanceField, rules, state, core) : [];
      const priorityCycleTokens = resolvePriorityCycleTokens(importanceMap, rules, rawLine);
      const forcedFull = cyclePriorityTokenInFullMode(rawLine, cur.ch, direction, priorityCycleTokens, freeRoamBehavior.fullPlacement, rules);
      finalLine = String(forcedFull.line || "");
      if (Number.isFinite(forcedFull.cursorCh)) {
        priorityCursorOverride = Math.max(0, Number(forcedFull.cursorCh) || 0);
      }
    }
    if (priorityLikeAction && freeRoamMode === "minimal" && freeRoamBehavior.minimalSeparator === false && !rawHasSeparator) {
      if (simplePlainRawNoSep) {
        const importanceField = priorityField;
        const importanceMap = importanceField ? fieldTokenMap(importanceField, rules, state, core) : [];
        const cycleTokens = resolvePriorityCycleTokens(importanceMap, rules, rawLine);
        const currentToken = extractCurrentPriorityToken(rawLine, cycleTokens, cur.ch);
        const nextToken = nextCycleTokenByDirection(cycleTokens, currentToken, direction);
        const plain = stripPriorityTokens(rawLine);
        finalLine = nextToken
          ? `${plain} ${nextToken}`.trim()
          : plain;
        finalLine = reorderLineMixedByOrder(finalLine, rules, orderCfg);
        finalLine = lineFinalize.normalizeMinimalPriorityNoSeparatorLine(finalLine, rules);
      }
    }

    if (priorityLikeAction && freeRoamMode === "minimal") {
      const simplePlainRaw = lineFinalize.isSimplePlainRaw(rawLine, rules, {
        hasStandaloneCheckboxPrefix: lineFinalize.hasStandaloneCheckboxPrefix,
        hasAnySeparator: hasAnySeparatorFn,
      });
      const hadSeparatorInRaw = rawHasSeparator;
      if (freeRoamBehavior.minimalSeparator === false && simplePlainRaw) {
        finalLine = lineFinalize.normalizeMinimalPriorityNoSeparatorLine(finalLine, rules, { stripTrailing: true });
      }
      if (lineFinalize.hasListPrefix(rawLine) || lineFinalize.hasStandaloneCheckboxPrefix(rawLine)) {
        finalLine = lineFinalize.applyPrefixPolicy(rawLine, finalLine, { mode: "reapply-original" });
      }
      if (freeRoamBehavior.minimalSeparator === false && !hadSeparatorInRaw) {
        finalLine = lineFinalize.stripTrailingConfiguredSeparators(finalLine, rules);
      }
    }

    if (
      freeRoamMode === "minimal"
      && freeRoamBehavior.minimalSeparator === false
      && !rawHasSeparator
      && isMinimalOffNoSeparatorAction(action)
    ) {
      const resolvedPrefix = String(core?.buildPrefix?.(parsedWork, rules, prefixState, { prefixShared: lineFinalize }) || "").trim();
      const targetFieldIdForCycleEnd = String(targetFieldForPrefix?.id || "").trim();
      finalLine = lineFinalize.normalizeMinimalOffFinalLine(rawLine, finalLine, rules, {
        shouldKeepCheckbox: /\[[^\]]\]/.test(resolvedPrefix)
          || lineFinalize.hasCheckboxListPrefix(rawLine)
          || lineFinalize.hasStandaloneCheckboxPrefix(rawLine),
        clearedOwnCheckbox: targetSelectionClearedByAction && fieldHasAnyCheckboxRule(rules, targetFieldIdForCycleEnd),
      });
      finalLine = enforceDependentAdjacencyForStatusLine(finalLine, rules, state, core);
    }

    if (
      freeRoamMode === "minimal"
      && freeRoamBehavior.minimalSeparator !== false
      && targetPanel === "left"
      && /^\s*#{1,6}\s+/.test(String(rawLine || ""))
      && !hasAnySeparatorFn(rawLine, rules)
    ) {
      const headingMatch = String(rawLine || "").match(/^(\s*#{1,6}\s+)(.*)$/);
      const headingPrefix = headingMatch ? String(headingMatch[1] || "") : "";
      const headingText = headingMatch ? String(headingMatch[2] || "").trim() : "";
      const selectedHeadingToken = String(selectedTokenFromState(targetFieldForPrefix, state, rules, core) || "").trim();
      if (headingPrefix && selectedHeadingToken) {
        const sep = String(rules && rules.io && rules.io.separator1 || "").trim();
        finalLine = sep
          ? `${headingPrefix}${selectedHeadingToken} ${sep} ${headingText}`.replace(/\s{2,}/g, " ").trimEnd()
          : `${headingPrefix}${selectedHeadingToken}${headingText ? " " + headingText : ""}`.trimEnd();
      }
    }

    const mixedPostPolicy = {
      applyMinimalSeparatorCollapse: mixedMinimalSeparatorOff && !rawHasSeparator,
      applyMinimalPrefixPreserve: freeRoamMode === "minimal" && freeRoamBehavior.minimalPrefix === false,
    };
    const targetHasOwnCheckbox = hasOwnCheckboxForField(rules, state, targetFieldForPrefix, core);
    const targetFieldIdForPrefix = String(targetFieldForPrefix?.id || "").trim();
    const offFlags = lineFinalize.resolveOffPrefixFlagsUnified({
      mode: freeRoamMode,
      freeRoamBehavior,
      hasOwnCheckbox: targetHasOwnCheckbox,
      clearedOwnCheckbox: targetSelectionClearedByAction && fieldHasAnyCheckboxRule(rules, targetFieldIdForPrefix),
    });
    finalLine = lineFinalize.applyUnifiedPostFinalize({
      rawLine,
      line: finalLine,
      rules,
      mode: freeRoamMode,
      mixedPolicy: mixedPostPolicy,
      preserveOff: offFlags.preserveOffImmutability || /^\s*#{1,6}\s+/.test(String(rawLine || "")),
      preserveMinimalHeading: freeRoamMode === "minimal",
    });
    if (String(cycleEndBehavior || "") === "clear-prefix") {
      const parsedAfterUnified = core.parseLine(finalLine, rules);
      const tagsAfterUnified = Array.isArray(parsedAfterUnified && parsedAfterUnified.tags) ? parsedAfterUnified.tags : [];
      const datesAfterUnified = String(parsedAfterUnified && parsedAfterUnified.dates ? parsedAfterUnified.dates : "").trim();
      const textAfterUnified = String(parsedAfterUnified && parsedAfterUnified.text ? parsedAfterUnified.text : "").trim();
      if (!tagsAfterUnified.length && !datesAfterUnified && textAfterUnified) {
        const indentKeep = (String(finalLine || "").match(/^(\s*)/) || ["", ""])[1];
        finalLine = indentKeep + textAfterUnified;
      }
    }

    if (
      priorityLikeAction
      && freeRoamMode === "minimal"
      && freeRoamBehavior.minimalSeparator === false
      && rawHasSeparator
    ) {
      const importanceField = getPriorityField(rules, left, rules.rightMode);
      const priorityOrderKey = String(resolveOrderKeyForField(rules, importanceField) || importanceOrderKey || actionFieldKey || "").trim();
      const priorityPanel = panelForTagKey(orderCfg, priorityOrderKey);
      let selectedImportanceToken = normalizePriorityToken(selectedTokenFromState(importanceField, state, rules));
      if (!selectedImportanceToken) {
        const m = String(finalLine || "").match(/#\/\S+/);
        selectedImportanceToken = m ? String(m[0]) : "";
      }
      const linePipeline = globalThis.__inlineLinePipeline;
      if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
        throw new Error("line_pipeline unavailable: splitSegments");
      }
      if (typeof linePipeline.buildFromSegments !== "function") {
        throw new Error("line_pipeline unavailable: buildFromSegments");
      }
      const seg = linePipeline.splitSegments(finalLine, rules);
      seg.left = stripPriorityTokens(seg.left);
      seg.text = stripPriorityTokens(seg.text);
      seg.dates = stripPriorityTokens(seg.dates);
      if (selectedImportanceToken) {
        if (priorityPanel === "right") {
          seg.dates = String(seg.dates || "").trim();
          seg.dates = seg.dates ? `${seg.dates} ${selectedImportanceToken}` : selectedImportanceToken;
        } else {
          seg.left = String(seg.left || "").trim();
          seg.left = seg.left ? `${seg.left} ${selectedImportanceToken}` : selectedImportanceToken;
        }
      }
      finalLine = linePipeline.buildFromSegments(seg, rules);
      finalLine = reorderLineMixedByOrder(finalLine, rules, orderCfg);
    }

    if (
      freeRoamMode === "minimal"
      && freeRoamBehavior.minimalSeparator === false
      && freeRoamBehavior.minimalPrefix !== false
      && !rawHasSeparator
      && isMinimalOffNoSeparatorAction(action)
      && targetFieldForPrefix
    ) {
      const resolvedPrefix = String(core?.buildPrefix?.(parsedWork, rules, prefixState, { prefixShared: lineFinalize }) || "").trim();
      finalLine = lineFinalize.alignMinimalNoSeparatorPrefix({
        rawLine,
        finalLine,
        resolvedPrefix,
        targetFieldId: String(targetFieldForPrefix?.id || "").trim(),
        selectedToken: String(selectedTokenFromState(targetFieldForPrefix, state, rules) || "").trim(),
        prefixRules: rules?.behavior?.prefixRules,
        preserveIndent: true,
      });
    }

    if (priorityLikeAction && freeRoamMode === "minimal" && freeRoamBehavior.minimalSeparator === false) {
      const simplePlainRaw = lineFinalize.isSimplePlainRaw(rawLine, rules, {
        hasStandaloneCheckboxPrefix: lineFinalize.hasStandaloneCheckboxPrefix,
        hasAnySeparator: hasAnySeparatorFn,
      });
      if (simplePlainRaw) {
        finalLine = lineFinalize.removeSyntheticLeadingPrefix(finalLine);
      }
    }

    if (
      priorityLikeAction
      && freeRoamMode === "minimal"
      && freeRoamBehavior.minimalSeparator === false
      && rawHasSeparator
    ) {
      let selectedImportanceToken = "";
      const mFinal = String(finalLine || "").match(/#\/\S+/);
      if (mFinal) selectedImportanceToken = String(mFinal[0] || "");
      const mRaw = String(rawLine || "").match(/#\/\S+/);
      if (!selectedImportanceToken && mRaw) selectedImportanceToken = String(mRaw[0] || "");

      const rawBase = String(stripPriorityTokens(rawLine) || "");
      const indent = (rawBase.match(/^(\s*)/) || ["", ""])[1];
      const body = rawBase.slice(indent.length);
      /* Граница зон — первый разделитель человека, любой из двух: `indexOf`
         одного литерального `||` отвечал верно только у того, кто его и
         выбрал (У-186). */
      const sepIdx = __sharedUtils.firstSeparatorIndex(body, rules, "status_tags");
      if (sepIdx >= 0) {
        const leftBody = body.slice(0, sepIdx).replace(/\s+$/g, "");
        const rightBody = body.slice(sepIdx).replace(/^\s+/g, "");
        const withPriority = selectedImportanceToken
          ? `${leftBody} ${selectedImportanceToken} ${rightBody}`
          : `${leftBody} ${rightBody}`;
        finalLine = indent + withPriority.replace(/\s{2,}/g, " ").trim();
      }
    }

    if (
      priorityLikeAction
      && freeRoamMode === "minimal"
      && freeRoamBehavior.minimalSeparator === false
      && !rawHasSeparator
    ) {
      const linePipeline = globalThis.__inlineLinePipeline;
      if (!linePipeline || typeof linePipeline.splitLeftPrefix !== "function") {
        throw new Error("line_pipeline unavailable: splitLeftPrefix");
      }
      if (typeof linePipeline.joinLeftPrefix !== "function") {
        throw new Error("line_pipeline unavailable: joinLeftPrefix");
      }
      const mFinal = String(finalLine || "").match(/#\/\S+/);
      const selectedImportanceToken = mFinal ? String(mFinal[0] || "") : "";
      if (selectedImportanceToken) {
        const importanceField = getPriorityField(rules, left, rules.rightMode);
        const priorityOrderKey = String(resolveOrderKeyForField(rules, importanceField) || importanceOrderKey || actionFieldKey || "").trim();
        const priorityPanel = panelForTagKey(orderCfg, priorityOrderKey);
        const parts = linePipeline.splitLeftPrefix(stripPriorityTokens(finalLine));
        const bodyTokens = String(parts.body || "").trim().split(/\s+/).filter(Boolean);
        let leadingTagCount = 0;
        while (leadingTagCount < bodyTokens.length) {
          const tok = String(bodyTokens[leadingTagCount] || "");
          if (!__sharedUtils.startsWithTagToken(tok) && !__sharedUtils.isWikilinkToken(tok)) break;
          leadingTagCount += 1;
        }
        const insertAt = leadingTagCount > 0
          ? leadingTagCount
          : (priorityPanel === "left" ? 0 : bodyTokens.length);
        bodyTokens.splice(insertAt, 0, selectedImportanceToken);
        finalLine = linePipeline.joinLeftPrefix(parts.prefix, bodyTokens.join(" "));
        if (lineFinalize.hasListPrefix(rawLine) || lineFinalize.hasStandaloneCheckboxPrefix(rawLine)) {
          finalLine = lineFinalize.applyPrefixPolicy(rawLine, finalLine, { mode: "reapply-original" });
        }
      }
    }
    if (
      priorityLikeAction
      && freeRoamMode === "minimal"
      && freeRoamBehavior.minimalSeparator === false
      && !rawHasSeparator
      && (lineFinalize.hasListPrefix(rawLine) || lineFinalize.hasStandaloneCheckboxPrefix(rawLine))
    ) {
      finalLine = lineFinalize.applyPrefixPolicy(rawLine, finalLine, { mode: "reapply-original" });
    }

    const skipKeepBulletForHeadingPriorityCleanup = (
      importanceFieldId && String(resolvedActionFieldId || "") === importanceFieldId
      && /^\s*#{1,6}\s+/.test(String(rawLine || ""))
      && /#\/\S+/.test(String(rawLine || ""))
    );
    /*
     * **Здесь стояла пересборка строки-заголовка, и она уносила значение**
     * (10.13.119). Условие — «шаг по Importance на строке-заголовке, где
     * значение уже стоит», — выполняется на **каждом** шаге, а не в конце
     * цикла: `## #/1 :: текст` давала `## текст`, `## #/2 :: текст` тоже.
     * И уносила она не только значение: строка собиралась заново из сырой,
     * с вычеркнутыми разделителями, и `## #/1 #todo :: текст :: 📅…`
     * превращалась в `## #todo текст 📅…` — зоны строки пропадали целиком.
     * Разделители вдобавок стояли тут литералами (`||`, `::`, `~~`), а у
     * человека они свои.
     *
     * Объяснения у пересборки не было ни одного: она пришла первым же
     * релизом и ни разу не названа ни в одном документе. Признак, по которому
     * она снята: на строке списка и на строке-цитате то же поле циклится
     * верно, и шаг по другому полю на заголовке — тоже.
     *
     * Сам признак остаётся: он гасит `applyKeepBullet`, а тот поставил бы
     * заголовку знак списка.
     */

    if (priorityLikeAction && freeRoamMode === "off" && countPriorityTokens(finalLine) > 1) {
      const linePipeline = globalThis.__inlineLinePipeline;
      if (!linePipeline || typeof linePipeline.splitSegments !== "function" || typeof linePipeline.buildFromSegments !== "function") {
        throw new Error("line_pipeline unavailable: final priority collapse helpers required");
      }
      const importanceField = getPriorityField(rules, left, rules.rightMode);
      let selectedImportanceToken = normalizePriorityToken(selectedTokenFromState(importanceField, state, rules));
      if (!selectedImportanceToken) {
        const m = String(finalLine || "").match(/#\/\S+/);
        selectedImportanceToken = m ? String(m[0] || "") : "";
      }
      if (selectedImportanceToken) {
        const priorityOrderKey = String(resolveOrderKeyForField(rules, importanceField) || importanceOrderKey || actionFieldKey || "").trim();
        const priorityPanel = panelForTagKey(orderCfg, priorityOrderKey);
        const seg = linePipeline.splitSegments(stripPriorityTokens(finalLine), rules);
        if (priorityPanel === "right") {
          seg.dates = String(seg.dates || "").trim();
          seg.dates = seg.dates ? `${seg.dates} ${selectedImportanceToken}` : selectedImportanceToken;
        } else {
          seg.left = String(seg.left || "").trim();
          seg.left = seg.left ? `${seg.left} ${selectedImportanceToken}` : selectedImportanceToken;
        }
        finalLine = linePipeline.buildFromSegments(seg, rules);
      }
    }

    if (targetPanel === "right" && !(freeRoamMode === "minimal" && freeRoamBehavior.minimalSeparator === false)) {
      const linePipeline = globalThis.__inlineLinePipeline;
      if (!linePipeline || typeof linePipeline.normalizeRightPayloadTailToDates !== "function") {
        throw new Error("line_pipeline unavailable: normalizeRightPayloadTailToDates");
      }
      finalLine = linePipeline.normalizeRightPayloadTailToDates({ line: finalLine, rules });
    }

    finalLine = enforceOffModeFinalPrefix(finalLine, rawLine, freeRoamMode, rules, prefixState, targetFieldForPrefix, core, lineFinalize, cycleEndBehavior, freeRoamBehavior, mixedPolicy.hasMinimalSelected);

    if (finalLine !== rawLine) {
      editor.replaceRange(finalLine, { line: lineNo, ch: 0 }, { line: lineNo, ch: rawLine.length });
    }
    if (cyclePost?.applyKeepBullet && !skipKeepBulletForHeadingPriorityCleanup) {
      macroShared.applyKeepBullet(editor, lineNo, parsedWork, {
        keepParsedPrefix: true,
        keepCheckbox: !checkboxBelongsToField(rules, String(targetFieldForPrefix?.id || ""), parsed.checkboxToken),
      });
      return;
    }
    let nextCh;
    if (Number.isFinite(priorityCursorOverride)) {
      nextCh = Math.max(0, Math.min(String(finalLine || "").length, Number(priorityCursorOverride) || 0));
    } else if (directImportanceFullResult && Number.isFinite(directImportanceFullResult.cursorCh)) {
      nextCh = Math.max(0, Math.min(String(finalLine || "").length, Number(directImportanceFullResult.cursorCh) || 0));
    } else {
      nextCh = lineFinalize.resolveCursorByPolicy({
        finalLine,
        rules,
        cursorPolicy,
        originalLine: rawLine,
        originalCursorCh: cur.ch,
        bootstrapToTextEndWhenSourceEmpty: true,
        getCursorAtTextEnd: (line, runtimeRules) => macroShared.getCursorAtTextEnd(line, runtimeRules),
        remapCursorByLineDiff: (fromLine, toLine, ch) => {
          const oldBounds = macroShared.getTextSlotBounds(fromLine, rules);
          const newBounds = macroShared.getTextSlotBounds(toLine, rules);
          if (oldBounds && newBounds && ch >= oldBounds.start && ch <= oldBounds.end) {
            const rel = ch - oldBounds.start;
            const candidate = newBounds.start + rel;
            return Math.max(newBounds.start, Math.min(candidate, newBounds.end));
          }
          return remapCursorStable(fromLine, toLine, ch);
        },
      });
    }
    editor.setCursor({ line: lineNo, ch: nextCh });
  },
};
