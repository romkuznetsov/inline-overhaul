"use strict";

/**
 * **Перестановка значений полей по Order — один дом на все дороги.**
 *
 * Само правило живёт в `src/core/status_line_runtime_unified.js`
 * (`relocateCoreTagsByOrder`), а сюда переехало то, чем его кормят: «какие
 * значения у поля сейчас», «в каком Block оно стоит», «как узнать его значение
 * в строке», «как переложить его набор токенов». Семь зависимостей плюс
 * помощники — 185 строк, и до 2026-09-15 они лежали в `status_tags.js`.
 *
 * **Зачем переехали.** Правило зовут двое из трёх движков: команды тегов и
 * панель. Третий — `status_date.js` — не зовёт, и оттого у заказчика значение
 * чужого поля оставалось в чужой зоне, если он нажал команду элемента, и
 * переезжало в свой Block, если нажал что угодно другое (PRD 10.13.125).
 * Дописать зависимости третьей копией значило бы завести ровно тот долг,
 * который эта сессия разбирает (У-150).
 *
 * **Почему фабрика, а не готовые функции.** Общий рантайм статусных движков
 * (`statusCommon`) у каждого движка **свой**, и различаются они не мелочью:
 * у команд тегов `defaultPanel: "left"`, у команд элементов `"right"`. То
 * есть на вопрос «в каком Block стоит поле без явного Block» два движка
 * отвечают по-разному, и склеить их в один экземпляр значило бы молча сменить
 * поведение одному из них. Здесь эта разница названа вслух: каждый движок
 * строит свой экземпляр и передаёт своего `statusCommon`.
 *
 * **Что здесь не переехало и почему.** Ни одна строка не переписана: тела
 * функций перенесены как есть, а на их прежних именах в `status_tags.js`
 * остались обращения сюда. Проверяется это обходом строки на двух конфигах —
 * он гоняет обе дороги на всех полях заказчика, — и семью шагами.
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
  /* Имя звавшего приезжает аргументом: экземпляров два, и человеку в журнале
     нужен тот, который отказал. Тем же различаются и два коротких построителя
     в движках — иначе это был бы один текст с двумя смыслами. */
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

  /* Правило «как значение поля выглядит в строке» объявлено один раз — в
     `tagwheel_core.js`, и сюда оно приезжает зависимостью (10.13.130). */
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
   * `core` берётся **аргументом**, а не из зависимостей экземпляра: у части
   * вызовов его нет вовсе, и тогда значения читаются прямо у поля. Подставить
   * его здесь значило бы сменить поведение у каждого такого вызова.
   */
  function activeValuesForField(coreArg, rules, state, field) {
    if (!field) return [];
    let vals = [];
    if (coreArg && typeof coreArg.getAllowedValues === "function") {
      const mode = getFieldModeById(rules, field.id);
      try {
        vals = coreArg.getAllowedValues(mode, state || { selected: {} }, field, rules);
      } catch (_) {
        /* Значения поля бывают недоступны — например, у дочернего при пустом
           родителе. Это ответ, а не отказ: читаем то, что у поля записано. */
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
      if (id && token) out.push({ id, token });
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

  /**
   * **Поле, которым дорога сейчас не управляет, она и не переставляет.**
   *
   * Тот же вопрос, что задаёт панель при сборке строки (10.13.129): у поля с
   * невыполненным предусловием, выключенного или спрятанного, значение на
   * строке — текст человека, и трогать его нельзя. Команды спрашивали это не
   * везде: значение дочернего поля при пустом родителе они переставляли по
   * Order, а панель оставляла на месте, и две дороги давали разное.
   *
   * Заметно это стало ровно тогда, когда заказчик перетащил `Category` из
   * левого Block в правый: пока Block совпадал, обе дороги давали одну строку
   * по совпадению (У-147).
   */
  function managedFields(rules, state, fields) {
    const list = Array.isArray(fields) ? fields : [];
    if (typeof core.isFieldEnabled !== "function") return list;
    return list.filter((f) => {
      if (!f || !f.id) return false;
      const mode = getFieldModeById(rules, f.id);
      return core.isFieldEnabled(mode, state || { selected: {} }, f, rules);
    });
  }

  function relocateCoreTagsByOrder(line, rules, orderCfg, state, fields, activeKey, activeFieldId) {
    const runtime = getStatusLineRuntime();
    return runtime.relocateCoreTagsByOrder({
      line,
      rules,
      orderCfg,
      state,
      fields: managedFields(rules, state, fields),
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
