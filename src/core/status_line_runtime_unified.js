"use strict";

function buildCombinedSelectionSet(options) {
  const opts = options && typeof options === "object" ? options : {};
  const deps = opts.deps && typeof opts.deps === "object" ? opts.deps : {};
  const fields = Array.isArray(opts.fields) ? opts.fields : [];
  const state = opts.state && typeof opts.state === "object" ? opts.state : {};
  const rules = opts.rules;
  const findValueById = deps.findValueById;
  const resolveSelectedValue = deps.resolveSelectedValue;
  const buildOutputTokenForField = deps.buildOutputTokenForField;
  const composeToken = deps.composeToken;
  if (typeof findValueById !== "function" && typeof resolveSelectedValue !== "function") {
    throw new Error("status_line_runtime_unified: value resolver required");
  }
  if (typeof buildOutputTokenForField !== "function") throw new Error("status_line_runtime_unified: buildOutputTokenForField required");
  if (typeof composeToken !== "function") throw new Error("status_line_runtime_unified: composeToken required");

  const byId = {};
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const id = String(f && f.id || "").trim();
    if (!id) continue;
    byId[id] = f;
  }

  const out = [];
  const seen = {};
  for (let i = 0; i < fields.length; i++) {
    const subField = fields[i];
    const subId = String(subField && subField.id || "").trim();
    const parentId = String(subField && subField.dependsOn || "").trim();
    if (!subId || !parentId) continue;
    const parentField = byId[parentId];
    if (!parentField) continue;
    const selectedParentId = String(state?.selected?.[parentId] || "").trim();
    const selectedSubId = String(state?.selected?.[subId] || "").trim();
    if (!selectedParentId || !selectedSubId) continue;

    const parentValue = typeof resolveSelectedValue === "function"
      ? resolveSelectedValue(parentField, selectedParentId, state, rules)
      : findValueById(parentField, selectedParentId);
    const subValue = typeof resolveSelectedValue === "function"
      ? resolveSelectedValue(subField, selectedSubId, state, rules)
      : findValueById(subField, selectedSubId);
    if (!parentValue || !subValue) continue;
    const rawParentToken = String(parentValue.token || "").trim();
    const rawSubToken = String(subValue.token || "").trim();
    if (!rawParentToken || !rawSubToken) continue;

    const parentToken = String(buildOutputTokenForField(parentField, parentValue, rules) || "").trim()
      || composeToken(typeof parentField.prefix === "string" ? parentField.prefix : "#", rawParentToken);
    const subToken = String(buildOutputTokenForField(subField, subValue, rules) || "").trim()
      || composeToken(typeof subField.prefix === "string" ? subField.prefix : "#", rawSubToken);
    if (!parentToken || !subToken) continue;

    const parentPrefix = typeof parentField.prefix === "string" ? parentField.prefix : "#";
    const combinedToken = parentPrefix + rawParentToken + "/" + rawSubToken.replace(/^#/, "");
    const dedupKey = `${parentId}::${subId}::${combinedToken}`;
    if (seen[dedupKey]) continue;
    seen[dedupKey] = true;
    out.push({
      parentId,
      subId,
      parentToken,
      subToken,
      combinedToken,
      parentField,
      subField,
    });
  }
  return out;
}

function applyCombinedToTokenList(tokenList, combinedEntries) {
  const src = Array.isArray(tokenList) ? tokenList.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const entries = Array.isArray(combinedEntries) ? combinedEntries : [];
  if (!entries.length) return src.slice();

  const used = {};
  const out = [];
  const matchEntry = (token) => {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e) continue;
      const p = String(e.parentToken || "").trim();
      const s = String(e.subToken || "").trim();
      const c = String(e.combinedToken || "").trim();
      if (!p || !s || !c) continue;
      if (token === p || token === s || token === c) return { index: i, combined: c };
    }
    return null;
  };

  for (let i = 0; i < src.length; i++) {
    const token = src[i];
    const hit = matchEntry(token);
    if (!hit) {
      out.push(token);
      continue;
    }
    const key = String(hit.index);
    if (!used[key]) {
      out.push(hit.combined);
      used[key] = true;
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const key = String(i);
    if (used[key]) continue;
    const c = String(entries[i] && entries[i].combinedToken || "").trim();
    if (c) out.push(c);
  }
  return out;
}

function hydrateSelectionFromCombinedTokens(options) {
  const opts = options && typeof options === "object" ? options : {};
  const deps = opts.deps && typeof opts.deps === "object" ? opts.deps : {};
  const fields = Array.isArray(opts.fields) ? opts.fields : [];
  const state = opts.state && typeof opts.state === "object" ? opts.state : null;
  const tags = Array.isArray(opts.tags) ? opts.tags : [];
  const rules = opts.rules;
  const getAllowedValues = deps.getAllowedValues;
  const buildOutputTokenForField = deps.buildOutputTokenForField;
  if (!state || !state.selected || typeof getAllowedValues !== "function" || typeof buildOutputTokenForField !== "function") {
    return 0;
  }

  const byId = {};
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const id = String(f && f.id || "").trim();
    if (!id) continue;
    byId[id] = f;
  }

  function findMatchByOutput(field, sourceValues, wantedToken) {
    const values = Array.isArray(sourceValues) ? sourceValues : [];
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const out = String(buildOutputTokenForField(field, v, rules) || "").trim();
      if (!out) continue;
      if (out === wantedToken) return v;
    }
    return null;
  }

  let hydrated = 0;
  for (let ti = 0; ti < tags.length; ti++) {
    const token = String(tags[ti] || "").trim();
    if (!token) continue;
    const slash = token.indexOf("/");
    if (slash <= 0) continue;
    const parentToken = token.slice(0, slash).trim();
    const childRaw = token.slice(slash + 1).trim();
    if (!parentToken || !childRaw || parentToken.charAt(0) !== "#") continue;
    const childToken = childRaw.charAt(0) === "#" ? childRaw : ("#" + childRaw);

    for (let fi = 0; fi < fields.length; fi++) {
      const childField = fields[fi];
      const childId = String(childField && childField.id || "").trim();
      const parentId = String(childField && childField.dependsOn || "").trim();
      if (!childId || !parentId) continue;
      const parentField = byId[parentId];
      if (!parentField) continue;

      const parentValues = getAllowedValues(fields, state, parentField, rules);
      const parentHit = findMatchByOutput(parentField, parentValues, parentToken);
      if (!parentHit || !String(parentHit.id || "").trim()) continue;
      state.selected[parentField.id] = String(parentHit.id || "").trim();

      const childValues = getAllowedValues(fields, state, childField, rules);
      const childHit = findMatchByOutput(childField, childValues, childToken);
      if (!childHit || !String(childHit.id || "").trim()) continue;
      state.selected[childField.id] = String(childHit.id || "").trim();
      hydrated += 1;
    }
  }
  return hydrated;
}

function relocateCoreTagsByOrder(options) {
  const opts = options && typeof options === "object" ? options : {};
  const deps = opts.deps && typeof opts.deps === "object" ? opts.deps : {};
  const panelForTagKey = deps.panelForTagKey;
  const fieldTokenMap = deps.fieldTokenMap;
  const selectedTokenFromState = deps.selectedTokenFromState;
  const selectedTokenFromLineByPanel = deps.selectedTokenFromLineByPanel;
  const relocateFieldByPanel = deps.relocateFieldByPanel;
  const removeCombinedByParentTokens = deps.removeCombinedByParentTokens;
  const resolveFieldOrderKey = deps.resolveFieldOrderKey;
  if (typeof panelForTagKey !== "function") throw new Error("status_line_runtime_unified: panelForTagKey required");
  if (typeof fieldTokenMap !== "function") throw new Error("status_line_runtime_unified: fieldTokenMap required");
  if (typeof selectedTokenFromState !== "function") throw new Error("status_line_runtime_unified: selectedTokenFromState required");
  if (typeof selectedTokenFromLineByPanel !== "function") throw new Error("status_line_runtime_unified: selectedTokenFromLineByPanel required");
  if (typeof relocateFieldByPanel !== "function") throw new Error("status_line_runtime_unified: relocateFieldByPanel required");
  if (typeof removeCombinedByParentTokens !== "function") throw new Error("status_line_runtime_unified: removeCombinedByParentTokens required");

  const line = String(opts.line || "");
  const rules = opts.rules;
  const orderCfg = opts.orderCfg;
  const state = opts.state;
  const fields = opts.fields;
  const activeKey = String(opts.activeKey || "");
  const activeFieldId = String(opts.activeFieldId || "").trim();

  function normalizeFieldList(input, runtimeRules) {
    if (Array.isArray(input)) return input.filter((f) => f && typeof f === "object");
    if (input && typeof input === "object") {
      const out = [];
      const seen = {};
      const keys = Object.keys(input);
      for (let i = 0; i < keys.length; i++) {
        const f = input[keys[i]];
        const id = String(f && f.id || "").trim();
        if (!id || seen[id]) continue;
        seen[id] = true;
        out.push(f);
      }
      if (out.length) return out;
    }
    const left = Array.isArray(runtimeRules?.leftMode?.fields) ? runtimeRules.leftMode.fields : [];
    return left.filter((f) => f && typeof f === "object");
  }

  const relocationFields = normalizeFieldList(fields, rules);
  const byId = {};
  const hasChildren = {};
  const orderKeyById = {};
  for (let i = 0; i < relocationFields.length; i++) {
    const f = relocationFields[i];
    const id = String(f && f.id || "").trim();
    if (!id) continue;
    byId[id] = f;
    const resolvedKey = typeof resolveFieldOrderKey === "function"
      ? String(resolveFieldOrderKey(f, rules) || "").trim()
      : String(f.orderKey || f.id || "").trim();
    orderKeyById[id] = resolvedKey || String(f.id || "").trim();
  }
  for (let i = 0; i < relocationFields.length; i++) {
    const f = relocationFields[i];
    const pid = String(f && f.dependsOn || "").trim();
    if (!pid) continue;
    hasChildren[pid] = true;
  }

  let out = line;
  for (let i = 0; i < relocationFields.length; i++) {
    const field = relocationFields[i];
    if (!field || !field.id) continue;
    const fieldId = String(field.id || "").trim();
    const fieldKey = String(orderKeyById[fieldId] || fieldId).trim();
    if (!fieldKey) continue;
    const panel = panelForTagKey(orderCfg, fieldKey);
    const map = fieldTokenMap(field, rules, state, null);
    const fromState = selectedTokenFromState(field, state, rules);

    const parentId = String(field.dependsOn || "").trim();
    const parent = parentId ? byId[parentId] : null;
    const parentKey = parent ? String(orderKeyById[String(parent.id || "").trim()] || parent.id || "").trim() : "";
    const suppressFallback = activeFieldId === fieldId || activeKey === fieldKey || (parentKey && activeKey === parentKey);
    const selected = fromState || (suppressFallback ? "" : selectedTokenFromLineByPanel(out, rules, panel, map));

    out = relocateFieldByPanel(out, rules, orderCfg, panel, selected, map, field);

    if (hasChildren[fieldId]) {
      const parentTokens = map.map((x) => x.token);
      out = removeCombinedByParentTokens(out, rules, parentTokens);
    }
  }
  return out;
}

function enforceDependentAdjacencyForStatusLine(options) {
  const opts = options && typeof options === "object" ? options : {};
  const deps = opts.deps && typeof opts.deps === "object" ? opts.deps : {};
  const splitSegments = deps.splitSegments;
  const splitLeftPrefix = deps.splitLeftPrefix;
  const joinLeftPrefix = deps.joinLeftPrefix;
  const buildFromSegments = deps.buildFromSegments;
  const buildOutputTokenForField = deps.buildOutputTokenForField;
  const composeToken = deps.composeToken;
  const selectedTokenFromState = deps.selectedTokenFromState;
  const getAllowedValues = deps.getAllowedValues;
  if (typeof splitSegments !== "function") throw new Error("status_line_runtime_unified: splitSegments required");
  if (typeof splitLeftPrefix !== "function") throw new Error("status_line_runtime_unified: splitLeftPrefix required");
  if (typeof joinLeftPrefix !== "function") throw new Error("status_line_runtime_unified: joinLeftPrefix required");
  if (typeof buildFromSegments !== "function") throw new Error("status_line_runtime_unified: buildFromSegments required");
  if (typeof buildOutputTokenForField !== "function") throw new Error("status_line_runtime_unified: buildOutputTokenForField required");
  if (typeof composeToken !== "function") throw new Error("status_line_runtime_unified: composeToken required");
  if (typeof selectedTokenFromState !== "function") throw new Error("status_line_runtime_unified: selectedTokenFromState required");
  if (typeof getAllowedValues !== "function") throw new Error("status_line_runtime_unified: getAllowedValues required");

  const finalLine = String(opts.finalLine || "");
  const rules = opts.rules;
  const state = opts.state;
  const core = opts.core;
  const src = String(finalLine || "");
  if (!src) return src;
  const leftFields = Array.isArray(rules?.leftMode?.fields) ? rules.leftMode.fields : [];
  if (!leftFields.length) return src;

  const byId = (id) => {
    const target = String(id || "").trim();
    if (!target) return null;
    for (const f of leftFields) {
      if (!f || String(f.id || "") !== target) continue;
      return f;
    }
    return null;
  };

  const seg = splitSegments(src, rules);
  const leftParts = splitLeftPrefix(seg.left);
  let leftTokens = String(leftParts.body || "").trim().split(/\s+/).filter(Boolean);
  let textTokens = String(seg.text || "").trim().split(/\s+/).filter(Boolean);
  let dateTokens = String(seg.dates || "").trim().split(/\s+/).filter(Boolean);

  function tokenCandidatesForField(field) {
    if (!field) return [];
    const out = [];
    const vals = Array.isArray(getAllowedValues(core, rules, state, field))
      ? getAllowedValues(core, rules, state, field)
      : [];
    const pref = typeof field.prefix === "string" ? field.prefix : "#";
    for (const v of vals) {
      if (!v || typeof v !== "object") continue;
      const built = buildOutputTokenForField(field, v, rules);
      if (built) out.push(String(built).trim());
      if (typeof v.token === "string" && v.token) out.push(composeToken(pref, String(v.token || "")));
    }
    const selected = selectedTokenFromState(field, state, rules, core);
    if (selected) out.unshift(String(selected).trim());
    const uniq = [];
    const seen = {};
    for (const tRaw of out) {
      const t = String(tRaw || "").trim();
      if (!t || seen[t]) continue;
      seen[t] = true;
      uniq.push(t);
    }
    return uniq;
  }

  function findTokenInBuckets(candidates) {
    for (const t of candidates) {
      if (leftTokens.indexOf(t) !== -1) return { token: t, bucket: "left" };
      if (textTokens.indexOf(t) !== -1) return { token: t, bucket: "text" };
      if (dateTokens.indexOf(t) !== -1) return { token: t, bucket: "dates" };
    }
    return null;
  }

  function removeTokenEverywhere(token) {
    leftTokens = leftTokens.filter((x) => x !== token);
    textTokens = textTokens.filter((x) => x !== token);
    dateTokens = dateTokens.filter((x) => x !== token);
  }

  function insertAfter(bucket, parentToken, childToken) {
    const arr = bucket === "left" ? leftTokens : (bucket === "text" ? textTokens : dateTokens);
    const pIdx = arr.indexOf(parentToken);
    if (pIdx === -1) return false;
    arr.splice(pIdx + 1, 0, childToken);
    return true;
  }

  let moved = false;
  for (const child of leftFields) {
    if (!child || !child.dependsOn) continue;
    const parent = byId(child.dependsOn);
    if (!parent) continue;
    const parentHit = findTokenInBuckets(tokenCandidatesForField(parent));
    const childHit = findTokenInBuckets(tokenCandidatesForField(child));
    if (!parentHit || !childHit) continue;

    if (parentHit.bucket === childHit.bucket) {
      const arr = parentHit.bucket === "left" ? leftTokens : (parentHit.bucket === "text" ? textTokens : dateTokens);
      const pIdx = arr.indexOf(parentHit.token);
      const cIdx = arr.indexOf(childHit.token);
      if (pIdx !== -1 && cIdx === pIdx + 1) continue;
    }

    removeTokenEverywhere(childHit.token);
    if (!insertAfter(parentHit.bucket, parentHit.token, childHit.token)) continue;
    moved = true;
  }

  if (!moved) return src;
  seg.left = joinLeftPrefix(leftParts.prefix, leftTokens.join(" ").trim());
  seg.text = textTokens.join(" ").trim();
  seg.dates = dateTokens.join(" ").trim();
  return buildFromSegments(seg, rules);
}

function stripFieldTokenSetFromLine(options) {
  const opts = options && typeof options === "object" ? options : {};
  const line = String(opts.line || "");
  const rules = opts.rules;
  const fieldIds = Array.isArray(opts.fieldIds) ? opts.fieldIds : [];
  const deps = opts.deps && typeof opts.deps === "object" ? opts.deps : {};
  const resolveTokensByFieldId = typeof deps.resolveTokensByFieldId === "function"
    ? deps.resolveTokensByFieldId
    : null;
  const removeTokensAcrossSegments = typeof deps.removeTokensAcrossSegments === "function"
    ? deps.removeTokensAcrossSegments
    : null;
  if (!resolveTokensByFieldId || !removeTokensAcrossSegments) {
    throw new Error("status_line_runtime_unified stripFieldTokenSetFromLine: required deps are missing");
  }

  const ids = fieldIds.map((x) => String(x || "").trim()).filter(Boolean);
  if (!ids.length) return line;

  const tokenSet = new Set();
  let i;
  for (i = 0; i < ids.length; i++) {
    const tokens = Array.isArray(resolveTokensByFieldId(ids[i])) ? resolveTokensByFieldId(ids[i]) : [];
    let j;
    for (j = 0; j < tokens.length; j++) {
      const tok = String(tokens[j] || "").trim();
      if (tok) tokenSet.add(tok);
    }
  }
  if (!tokenSet.size) return line;

  return removeTokensAcrossSegments({
    line,
    rules,
    tokens: Array.from(tokenSet),
  });
}

function clearDependentSelections(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rules = opts.rules;
  const state = opts.state && typeof opts.state === "object" ? opts.state : {};
  const parentFieldId = String(opts.parentFieldId || "").trim();
  if (!parentFieldId || !state.selected || typeof state.selected !== "object") return [];

  const left = Array.isArray(rules && rules.leftMode && rules.leftMode.fields) ? rules.leftMode.fields : [];
  const right = Array.isArray(rules && rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : [];
  const all = left.concat(right);
  const cleared = [];

  function clearChildren(pid) {
    let i;
    for (i = 0; i < all.length; i++) {
      const f = all[i];
      if (!f) continue;
      if (String(f.dependsOn || "").trim() !== String(pid || "").trim()) continue;
      if (f.id) state.selected[f.id] = "";
      if (f.id && cleared.indexOf(f.id) === -1) cleared.push(f.id);
      clearChildren(f.id);
    }
  }

  clearChildren(parentFieldId);
  return cleared;
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getLastTokenMatchIndex(segText, token) {
  var src = String(segText || "");
  var tok = String(token || "").trim();
  if (!src || !tok) return -1;
  var rx = new RegExp("(^|\\s)" + escapeRegex(tok) + "(?=\\s|$)", "g");
  var best = -1;
  var m;
  while ((m = rx.exec(src)) !== null) {
    var leadLen = String(m[1] || "").length;
    var pos = Number(m.index || 0) + leadLen;
    if (pos > best) best = pos;
  }
  return best;
}

function selectTokenByPanelOrder(options) {
  var opts = options && typeof options === "object" ? options : {};
  var deps = opts.deps && typeof opts.deps === "object" ? opts.deps : {};
  var splitSegments = deps.splitSegments;
  if (typeof splitSegments !== "function") {
    throw new Error("status_line_runtime_unified: splitSegments required");
  }
  var line = String(opts.line || "");
  var rules = opts.rules;
  var panel = String(opts.panel || "left").trim().toLowerCase() === "right" ? "right" : "left";
  var tokenMap = Array.isArray(opts.tokenMap) ? opts.tokenMap : [];
  var tokenFacts = Array.isArray(opts.tokenFacts) ? opts.tokenFacts : [];
  if (!tokenMap.length) return null;

  if (tokenFacts.length) {
    var panelRank = panel === "right"
      ? { right: 0, text: 1, left: 2 }
      : { left: 0, right: 1, text: 2 };
    var bestFactHit = null;
    var tiFacts;
    for (tiFacts = 0; tiFacts < tokenMap.length; tiFacts++) {
      var rowFact = tokenMap[tiFacts];
      var tokenFact = String(rowFact && rowFact.token || "").trim();
      if (!tokenFact) continue;
      var fi;
      for (fi = 0; fi < tokenFacts.length; fi++) {
        var fact = tokenFacts[fi];
        var raw = String(fact && fact.raw || "").trim();
        if (!raw || raw !== tokenFact) continue;
        var factPanel = String(fact && fact.panel || "").trim() || "text";
        var rank = Object.prototype.hasOwnProperty.call(panelRank, factPanel) ? panelRank[factPanel] : 9;
        var pos = Number(fact && fact.position || -1);
        if (!bestFactHit || rank < bestFactHit.rank || (rank === bestFactHit.rank && pos >= bestFactHit.position)) {
          bestFactHit = {
            token: tokenFact,
            id: String(rowFact && rowFact.id || ""),
            position: pos,
            rank: rank,
            panel: factPanel,
          };
        }
      }
    }
    if (bestFactHit && bestFactHit.id) return bestFactHit;
  }

  var seg = splitSegments(line, rules);
  var orderedSegments = panel === "right"
    ? [String(seg.dates || ""), String(seg.text || ""), String(seg.left || "")]
    : [String(seg.left || ""), String(seg.dates || ""), String(seg.text || "")];

  var si;
  for (si = 0; si < orderedSegments.length; si++) {
    var body = orderedSegments[si];
    if (!String(body || "").trim()) continue;
    var bestHit = null;
    var ti;
    for (ti = 0; ti < tokenMap.length; ti++) {
      var row = tokenMap[ti];
      var token = String(row && row.token || "").trim();
      if (!token) continue;
      var pos = getLastTokenMatchIndex(body, token);
      if (pos < 0) continue;
      if (!bestHit || pos > bestHit.position) {
        bestHit = {
          token: token,
          id: String(row && row.id || ""),
          position: pos,
          segmentIndex: si,
        };
      }
    }
    if (bestHit) return bestHit;
  }
  return null;
}

function selectMarkerValueByPanelOrder(options) {
  var opts = options && typeof options === "object" ? options : {};
  var deps = opts.deps && typeof opts.deps === "object" ? opts.deps : {};
  var splitSegments = deps.splitSegments;
  if (typeof splitSegments !== "function") {
    throw new Error("status_line_runtime_unified: splitSegments required");
  }
  var line = String(opts.line || "");
  var rules = opts.rules;
  var panel = String(opts.panel || "left").trim().toLowerCase() === "right" ? "right" : "left";
  var marker = String(opts.marker || "").trim();
  var valueRxSource = String(opts.valueRxSource || "").trim();
  var validateValue = typeof opts.validateValue === "function" ? opts.validateValue : null;
  var tokenFacts = Array.isArray(opts.tokenFacts) ? opts.tokenFacts : [];
  if (!marker) return null;

  if (tokenFacts.length) {
    var panelRankFact = panel === "right"
      ? { right: 0, text: 1, left: 2 }
      : { left: 0, right: 1, text: 2 };
    var bestFact = null;
    var fi;
    for (fi = 0; fi < tokenFacts.length; fi++) {
      var fact = tokenFacts[fi];
      var sourceKind = String(fact && fact.sourceKind || "").trim();
      var markerKind = String(fact && fact.markerKind || "").trim();
      if (sourceKind !== "marker") continue;
      if (!markerKind || markerKind !== marker) continue;
      var raw = String(fact && fact.raw || "").trim();
      if (!raw || raw.indexOf(marker) !== 0 || raw.length <= marker.length) continue;
      var value = raw.slice(marker.length).trim();
      if (!value) continue;
      if (validateValue && !validateValue(value)) continue;
      var factPanel = String(fact && fact.panel || "").trim() || "text";
      var rank = Object.prototype.hasOwnProperty.call(panelRankFact, factPanel) ? panelRankFact[factPanel] : 9;
      var pos = Number(fact && fact.position || -1);
      if (!bestFact || rank < bestFact.rank || (rank === bestFact.rank && pos >= bestFact.position)) {
        bestFact = {
          value: value,
          position: pos,
          marker: marker,
          panel: factPanel,
          rank: rank,
        };
      }
    }
    if (bestFact) return bestFact;
  }

  var seg = splitSegments(line, rules);
  var orderedSegments = panel === "right"
    ? [String(seg.dates || ""), String(seg.text || ""), String(seg.left || "")]
    : [String(seg.left || ""), String(seg.dates || ""), String(seg.text || "")];

  var mkRx = escapeRegex(marker);
  var valueSrc = valueRxSource || "[^\\s]+";
  var rx = new RegExp("(^|\\s)" + mkRx + "(" + valueSrc + ")(?=\\s|$)", "g");

  var si;
  for (si = 0; si < orderedSegments.length; si++) {
    var body = orderedSegments[si];
    if (!String(body || "").trim()) continue;
    var best = null;
    var m;
    while ((m = rx.exec(body)) !== null) {
      var value = String(m[2] || "").trim();
      if (!value) continue;
      if (validateValue && !validateValue(value)) continue;
      var leadLen = String(m[1] || "").length;
      var pos = Number(m.index || 0) + leadLen;
      if (!best || pos > best.position) {
        best = {
          value: value,
          position: pos,
          segmentIndex: si,
          marker: marker,
        };
      }
    }
    if (best) return best;
  }
  return null;
}

module.exports = {
  buildCombinedSelectionSet,
  applyCombinedToTokenList,
  hydrateSelectionFromCombinedTokens,
  relocateCoreTagsByOrder,
  enforceDependentAdjacencyForStatusLine,
  stripFieldTokenSetFromLine,
  clearDependentSelections,
  selectTokenByPanelOrder,
  selectMarkerValueByPanelOrder,
};
