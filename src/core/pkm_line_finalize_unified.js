"use strict";

function resolveSeparatorsOrThrow(rules) {
  const io = rules && typeof rules.io === "object" && !Array.isArray(rules.io) ? rules.io : null;
  const sep1 = io && io.separator1 != null ? String(io.separator1).trim() : "";
  const sep2 = io && io.separator2 != null ? String(io.separator2).trim() : "";
  if (!sep1 || !sep2) {
    throw new Error("pkm_line_finalize_unified: rules.io.separator1 and rules.io.separator2 are required");
  }
  return { sep1, sep2 };
}

function hasListPrefix(line) {
  const body = String(line || "").replace(/^\s*/, "");
  return /^([-*+]|\d+[\.)])(\s|$)/.test(body);
}

function normalizeCheckboxToken(token) {
  const src = String(token || "").trim();
  if (!src) return "";
  const m = src.match(/^\[([\s\S]*)\]$/);
  if (!m) return "";
  const inner = String(m[1] || "").trim();
  if (!inner) return "[ ]";
  return `[${inner}]`;
}

function getPrefixRulesUnified(rules, deps) {
  const isObj = deps && typeof deps.isObj === "function"
    ? deps.isObj
    : (x) => !!x && typeof x === "object" && !Array.isArray(x);

  const behavior = rules && isObj(rules.behavior) ? rules.behavior : {};
  const src = isObj(behavior.prefixRules) ? behavior.prefixRules : {};
  const out = {
    resolver: "priority-first",
    priorityMode: "by-section",
    fieldsOrderMode: "manual",
    tagSubtagPriority: "subtag-over-tag",
    priorityTargets: [],
    priorityCheckboxes: [],
    checkboxByFieldValue: {},
  };
  if (typeof src.resolver === "string" && src.resolver.trim()) out.resolver = src.resolver.trim();
  if (typeof src.priorityMode === "string" && src.priorityMode.trim()) out.priorityMode = src.priorityMode.trim();
  if (typeof src.fieldsOrderMode === "string" && src.fieldsOrderMode.trim()) out.fieldsOrderMode = src.fieldsOrderMode.trim();
  if (typeof src.tagSubtagPriority === "string" && src.tagSubtagPriority.trim()) out.tagSubtagPriority = src.tagSubtagPriority.trim();
  if (Array.isArray(src.priorityTargets)) {
    out.priorityTargets = src.priorityTargets.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (Array.isArray(src.priorityCheckboxes)) {
    out.priorityCheckboxes = src.priorityCheckboxes
      .map((x) => normalizeCheckboxToken(x))
      .filter(Boolean);
  }
  if (isObj(src.checkboxByFieldValue)) {
    const fieldIds = Object.keys(src.checkboxByFieldValue);
    for (let i = 0; i < fieldIds.length; i++) {
      const fid = fieldIds[i];
      const row = src.checkboxByFieldValue[fid];
      if (!isObj(row)) continue;
      out.checkboxByFieldValue[fid] = {};
      const tokens = Object.keys(row);
      for (let j = 0; j < tokens.length; j++) {
        const tok = String(tokens[j] || "").trim();
        const cb = normalizeCheckboxToken(row[tokens[j]]);
        if (!tok || !cb) continue;
        out.checkboxByFieldValue[fid][tok] = cb;
      }
    }
  }
  if (!out.checkboxByFieldValue.type) out.checkboxByFieldValue.type = {};
  if (!out.priorityTargets.length) {
    const lf = rules && rules.leftMode && Array.isArray(rules.leftMode.fields) ? rules.leftMode.fields : [];
    for (let i = 0; i < lf.length; i++) {
      const id = lf[i] && lf[i].id ? String(lf[i].id) : "";
      if (!id) continue;
      if (!out.priorityTargets.includes(id)) out.priorityTargets.push(id);
    }
  }
  return out;
}

function selectedTokenByFieldIdUnified(rules, state, fieldId, deps) {
  const getFieldById = deps && typeof deps.getFieldById === "function"
    ? deps.getFieldById
    : function(fields, id) {
      const src = Array.isArray(fields) ? fields : [];
      for (let i = 0; i < src.length; i++) {
        if (src[i] && src[i].id === id) return src[i];
      }
      return null;
    };
  const mode = rules && rules.leftMode ? rules.leftMode : { fields: [] };
  const field = getFieldById(mode, fieldId);
  if (!field || !state || !state.selected) return "";
  const selectedId = String(state.selected[fieldId] || "");
  if (!selectedId) return "";
  const values = Array.isArray(field.values) ? field.values : [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    if (String(v.id || "") === selectedId || String(v.token || "") === selectedId) {
      return String(v.token || "").trim();
    }
  }
  return selectedId;
}

function resolvePrefixCheckboxUnified(rules, state, deps) {
  const isObj = deps && typeof deps.isObj === "function"
    ? deps.isObj
    : (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const cfg = getPrefixRulesUnified(rules, deps);
  const byField = cfg.checkboxByFieldValue || {};
  const ignoreByField = state && isObj(state.__prefixIgnoreFieldIds) ? state.__prefixIgnoreFieldIds : null;
  const hits = [];
  const hitByField = {};
  for (let i = 0; i < cfg.priorityTargets.length; i++) {
    const fid = cfg.priorityTargets[i];
    if (ignoreByField && ignoreByField[fid] === true) continue;
    if (!isObj(byField[fid])) continue;
    const tok = selectedTokenByFieldIdUnified(rules, state, fid, deps);
    if (!tok) continue;
    const cb = normalizeCheckboxToken(byField[fid][tok]);
    if (!cb) continue;
    if (!hitByField[fid]) hitByField[fid] = cb;
  }

  const applyPair = (parentId, subId) => {
    const p = hitByField[parentId] || "";
    const s = hitByField[subId] || "";
    if (!p || !s) return;
    if (cfg.tagSubtagPriority === "tag-over-subtag") {
      delete hitByField[subId];
      return;
    }
    delete hitByField[parentId];
  };

  const leftFields = rules && rules.leftMode && Array.isArray(rules.leftMode.fields)
    ? rules.leftMode.fields
    : [];
  for (let i = 0; i < leftFields.length; i++) {
    const childField = leftFields[i];
    if (!childField || !childField.id || !childField.dependsOn) continue;
    applyPair(String(childField.dependsOn || ""), String(childField.id || ""));
  }

  for (let i = 0; i < cfg.priorityTargets.length; i++) {
    const ff = cfg.priorityTargets[i];
    if (!hitByField[ff]) continue;
    hits.push(hitByField[ff]);
  }

  if (cfg.resolver === "priority-first") {
    if (cfg.priorityMode === "by-checkbox-list") {
      const ordered = Array.isArray(cfg.priorityCheckboxes) ? cfg.priorityCheckboxes : [];
      for (let i = 0; i < ordered.length; i++) {
        if (hits.includes(ordered[i])) return ordered[i];
      }
    }
    return hits.length ? hits[0] : "";
  }
  if (cfg.resolver === "concat-all" && hits.length) {
    const uniq = [];
    for (let i = 0; i < hits.length; i++) if (!uniq.includes(hits[i])) uniq.push(hits[i]);
    return uniq.join("");
  }
  return "";
}

function buildPrefixUnified(parsedLine, rules, state, deps) {
  if (parsedLine && parsedLine.headingToken) {
    return `${parsedLine.headingToken} `;
  }
  const nextCb = resolvePrefixCheckboxUnified(rules, state, deps);
  const keepCb = (!nextCb && state && state.__preserveCheckboxPrefix === true && parsedLine && parsedLine.checkboxToken)
    ? normalizeCheckboxToken(parsedLine.checkboxToken)
    : "";
  const forceBullet = !!(state && state.__forceBulletPrefix === true);
  let bullet = forceBullet ? "-" : (nextCb ? "-" : (parsedLine.bulletToken || "-"));
  if (!nextCb && keepCb) bullet = "-";
  let out = `${bullet} `;
  if (nextCb) out += `${nextCb} `;
  else if (keepCb) out += `${keepCb} `;
  return out;
}

function hasStandaloneCheckboxPrefix(line) {
  const body = String(line || "").replace(/^\s*/, "");
  return /^\[[^\]]+\](\s|$)/.test(body);
}

function extractOriginalPrefix(line) {
  const src = String(line || "");
  const listMatch = src.match(/^(\s*(?:[-*+]|\d+[\.)])\s+(?:\[[^\]]+\]\s+)*)/);
  if (listMatch && String(listMatch[1] || "").trim()) {
    return String(listMatch[1] || "").replace(/\s+$/g, "");
  }
  const checkboxMatch = src.match(/^(\s*\[[^\]]+\]\s+)/);
  if (checkboxMatch) return String(checkboxMatch[1] || "").replace(/\s+$/g, "");
  return "";
}

function reapplyOriginalPrefix(rawLine, nextLine) {
  const prefix = extractOriginalPrefix(rawLine);
  if (!prefix) return String(nextLine || "");
  let body = String(nextLine || "");
  body = body.replace(/^\s*(?:[-*+]|\d+[\.)])\s+/, "");
  body = body.replace(/^\[[^\]]+\]\s+/, "");
  body = body.trimStart();
  return body ? `${prefix} ${body}` : prefix;
}

function preserveOriginalPrefixShape(rawLine, nextLine) {
  const raw = String(rawLine || "");
  if (hasListPrefix(raw) || hasStandaloneCheckboxPrefix(raw)) {
    return reapplyOriginalPrefix(raw, nextLine);
  }
  const rawIndent = (raw.match(/^(\s*)/) || ["", ""])[1];
  let body = String(nextLine || "").replace(/^\s*/, "");
  body = body.replace(/^([-*+]|\d+[\.)])\s+/, "");
  body = body.replace(/^(\[[^\]]+\])\s+/, "");
  return rawIndent + body.trimStart();
}

function removeSyntheticLeadingPrefix(line) {
  const src = String(line || "");
  const indent = (src.match(/^(\s*)/) || ["", ""])[1];
  let body = src.slice(indent.length);
  body = body.replace(/^([-*+]|\d+[\.)])\s+/, "");
  body = body.replace(/^\[[^\]]+\]\s+/, "");
  return indent + body;
}

function removeStandaloneHeadingMarkers(line) {
  const src = String(line || "");
  if (!src) return src;
  return src.replace(/(^|\s)#{1,6}(?=\s|$)/g, "$1").replace(/\s{2,}/g, " ").trimEnd();
}

function applyPrefixPolicy(rawLine, builtLine, options) {
  const opts = options && typeof options === "object" ? options : {};
  const mode = String(opts.mode || "resolved").trim().toLowerCase();
  if (mode === "preserve-original") return preserveOriginalPrefixShape(rawLine, builtLine);
  if (mode === "reapply-original") return reapplyOriginalPrefix(rawLine, builtLine);
  return String(builtLine || "");
}

function applyResolvedPrefixToLine(options) {
  const opts = options && typeof options === "object" ? options : {};
  const line = String(opts.line || "");
  if (!line) return line;
  const rules = opts.rules;
  const parsedLine = opts.parsedLine;
  const state = opts.state;
  const allowHeadingRewrite = opts.allowHeadingRewrite === true;
  const prefixState = opts.prefixState && typeof opts.prefixState === "object" ? opts.prefixState : state;
  const buildPrefix = typeof opts.buildPrefix === "function" ? opts.buildPrefix : null;
  if (!buildPrefix) throw new Error("applyResolvedPrefixToLine requires buildPrefix dependency");
  if (/^\s*#{1,6}\s+/.test(line) && !allowHeadingRewrite) return line;

  const nextPrefix = String(buildPrefix(parsedLine, rules, prefixState) || "").trim();
  if (!nextPrefix) return line;

  const indent = (line.match(/^(\s*)/) || ["", ""])[1];
  let body = line.slice(indent.length);
  if (allowHeadingRewrite) {
    while (/^#{1,6}(?:\s+|$)/.test(body)) body = body.replace(/^#{1,6}(?:\s+|$)/, "");
    body = body.replace(/(^|\s)#{1,6}(?=\s|$)/g, "$1");
  }
  body = body.replace(/^([-*+]|\d+\.)(?:\s+|$)/, "");
  body = body.replace(/^(\[[^\]]+\])(?:\s+|$)/, "");
  body = body.trim();
  let out = `${indent}${nextPrefix}${body ? (" " + body) : ""}`;

  out = out.replace(/^(\s*[-*+]\s+\[[^\]]+\])\s+\|\|/, "$1  ||");
  out = out.replace(/^(\s*\d+\.\s+\[[^\]]+\])\s+\|\|/, "$1  ||");
  return out;
}

function escapeRx(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRightMarkersUnified(rules) {
  const out = [];
  const seen = new Set();
  function pushMarker(raw) {
    const mk = String(raw || "").trim();
    if (!mk || seen.has(mk)) return;
    seen.add(mk);
    out.push(mk);
  }

  const fields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields)
    ? rules.rightMode.fields
    : [];
  const behavior = rules && typeof rules.behavior === "object" && !Array.isArray(rules.behavior)
    ? rules.behavior
    : {};
  const cfg = behavior && typeof behavior.dateRuntimeConfig === "object" && !Array.isArray(behavior.dateRuntimeConfig)
    ? behavior.dateRuntimeConfig
    : {};
  const byField = cfg && typeof cfg.byField === "object" && !Array.isArray(cfg.byField)
    ? cfg.byField
    : {};
  const canonical = cfg && typeof cfg.canonical === "object" && !Array.isArray(cfg.canonical)
    ? cfg.canonical
    : {};

  let i;
  for (i = 0; i < fields.length; i++) {
    const field = fields[i] || {};
    const fieldId = String(field.id || "").trim();
    const orderKey = String(field.orderKey || "").trim();
    pushMarker(field.marker);

    const candidateKeys = [];
    if (fieldId) candidateKeys.push(fieldId);
    if (orderKey && candidateKeys.indexOf(orderKey) === -1) candidateKeys.push(orderKey);
    const canonicalKeys = Object.keys(canonical);
    let j;
    for (j = 0; j < canonicalKeys.length; j++) {
      const ck = String(canonicalKeys[j] || "").trim();
      const cv = String(canonical[ck] || "").trim();
      if (!cv) continue;
      if (cv === fieldId || cv === orderKey) {
        if (candidateKeys.indexOf(ck) === -1) candidateKeys.push(ck);
        if (candidateKeys.indexOf(cv) === -1) candidateKeys.push(cv);
      }
    }
    for (j = 0; j < candidateKeys.length; j++) {
      const row = byField && byField[candidateKeys[j]] && typeof byField[candidateKeys[j]] === "object"
        ? byField[candidateKeys[j]]
        : null;
      if (!row) continue;
      pushMarker(row.emoji);
      pushMarker(row.marker);
    }
  }

  const datesMarkers = Array.isArray(rules && rules.dates && rules.dates.markers)
    ? rules.dates.markers
    : [];
  for (i = 0; i < datesMarkers.length; i++) pushMarker(datesMarkers[i]);
  return out;
}

function extractHeadingPrefix(line) {
  const src = String(line || "");
  const m = src.match(/^(\s*#{1,6})\s+/);
  return m ? String(m[1] || "") : "";
}

function reapplyHeadingPrefix(rawLine, nextLine) {
  const headingPrefix = extractHeadingPrefix(rawLine);
  if (!headingPrefix) return String(nextLine || "");
  const src = String(nextLine || "");
  const indent = (String(rawLine || "").match(/^(\s*)/) || ["", ""])[1];
  let body = src.replace(/^\s*/, "");
  while (/^#{1,6}(?:\s+|$)/.test(body)) body = body.replace(/^#{1,6}(?:\s+|$)/, "");
  body = body.replace(/^([-*+]|\d+[\.)])\s+/, "");
  body = body.replace(/^\[[^\]]+\]\s+/, "");
  body = body.replace(/(^|\s)#{1,6}(?=\s|$)/g, "$1");
  body = body.replace(/\s{2,}/g, " ").trim();
  return body ? `${indent}${headingPrefix.trim()} ${body}` : `${indent}${headingPrefix.trim()} `;
}

function applyModePrefixImmutability(rawLine, builtLine, options) {
  const opts = options && typeof options === "object" ? options : {};
  const preserveOff = opts.preserveOff === true;
  const preserveMinimalHeading = opts.preserveMinimalHeading === true;
  let out = String(builtLine || "");
  const raw = String(rawLine || "");
  const rawHasHeading = !!extractHeadingPrefix(raw);
  if (preserveOff) {
    if (rawHasHeading) return reapplyHeadingPrefix(raw, out);
    return out;
  }
  if (preserveMinimalHeading && rawHasHeading) {
    return reapplyHeadingPrefix(raw, out);
  }
  return out;
}

function splitThreeSegments(line, rules, sep1, sep2) {
  const src = String(line || "");
  const s1 = String(sep1 == null ? "" : sep1);
  const s2 = String(sep2 == null ? "" : sep2);
  const i1 = s1 ? src.indexOf(s1) : -1;
  if (i1 === -1) {
    return {
      indent: (src.match(/^(\s*)/) || ["", ""])[1],
      left: src,
      text: "",
      dates: "",
    };
  }
  const i2 = s2 ? src.indexOf(s2, i1 + s1.length) : -1;
  if (i2 === -1) {
    return {
      indent: (src.match(/^(\s*)/) || ["", ""])[1],
      left: src.slice(0, i1),
      text: src.slice(i1 + s1.length),
      dates: "",
    };
  }
  return {
    indent: (src.match(/^(\s*)/) || ["", ""])[1],
    left: src.slice(0, i1),
    text: src.slice(i1 + s1.length, i2),
    dates: src.slice(i2 + s2.length),
  };
}

function collapseSeparatorsForMinimalOff(line, rules) {
  const src = String(line || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  if (src.indexOf(sep1) === -1 && src.indexOf(sep2) === -1) return src;
  const seg = splitThreeSegments(src, rules, sep1, sep2);
  const merged = [String(seg.left || "").trim(), String(seg.text || "").trim(), String(seg.dates || "").trim()]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return String(seg.indent || "") + merged;
}

function collapseSeparatorForFullNoSource(line, rules) {
  const src = String(line || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  if (src.indexOf(sep1) === -1) return src;
  const seg = splitThreeSegments(src, rules, sep1, resolveSeparatorsOrThrow(rules).sep2);
  const left = String(seg.left || "").trim();
  const text = String(seg.text || "").trim();
  const dates = String(seg.dates || "").trim();
  if (dates) return src;
  const out = [left, text].filter(Boolean).join(" ").trim();
  return String(seg.indent || "") + out;
}

function applyMixedPostPolicies(rawLine, line, rules, policy) {
  const p = policy && typeof policy === "object" ? policy : {};
  let out = String(line || "");
  if (p.applyMinimalSeparatorCollapse) {
    out = collapseSeparatorsForMinimalOff(out, rules);
  }
  if (p.applyFullNoSourceCollapse) {
    out = collapseSeparatorForFullNoSource(out, rules);
  }
  if (p.applyMinimalPrefixPreserve) {
    out = applyPrefixPolicy(rawLine, out, { mode: "preserve-original" });
  }
  return out;
}

function resolveCursorByPolicy(options) {
  const opts = options && typeof options === "object" ? options : {};
  const finalLine = String(opts.finalLine || "");
  const rules = opts.rules;
  const policy = String(opts.cursorPolicy || "current_position").trim().toLowerCase();
  const getTextEnd = typeof opts.getCursorAtTextEnd === "function"
    ? opts.getCursorAtTextEnd
    : function defaultTextEnd(line) { return String(line || "").length; };
  const remapByDiff = typeof opts.remapCursorByLineDiff === "function"
    ? opts.remapCursorByLineDiff
    : function defaultRemap(_from, to) { return String(to || "").length; };
  if (policy === "text_end") return getTextEnd(finalLine, rules);
  if (policy === "line_end") return finalLine.length;
  if (opts.bootstrapToTextEndWhenSourceEmpty === true && !String(opts.originalLine || "").trim()) {
    return Math.max(0, Math.min(finalLine.length, Number(getTextEnd(finalLine, rules)) || 0));
  }
  let nextCh = remapByDiff(String(opts.originalLine || ""), finalLine, Number(opts.originalCursorCh || 0));
  if (nextCh >= finalLine.length) {
    const textEnd = getTextEnd(finalLine, rules);
    if (textEnd < finalLine.length) nextCh = textEnd;
  }
  return Math.max(0, Math.min(finalLine.length, Number(nextCh) || 0));
}

function normalizeSeparatorTopology(line, rules) {
  const src = String(line || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  if (!sep1 || !sep2) return src;
  let out = src;
  if (sep1 === sep2) {
    const repeatedTail = new RegExp(`(?:\\s*${escapeRx(sep1)}\\s*){2,}$`);
    if (repeatedTail.test(out)) {
      out = out.replace(repeatedTail, ` ${sep1} `);
    }
    return out.replace(/\s+$/g, " ");
  }
  const seg = splitThreeSegments(out, rules, sep1, sep2);
  if (String(seg.dates || "").trim()) return out;
  const trailingSep2 = new RegExp(`\\s*${escapeRx(sep2)}\\s*$`);
  if (trailingSep2.test(out)) {
    out = out.replace(trailingSep2, "");
  }
  return out;
}

function hasAnySeparator(lineInput, rulesInput) {
  const s = String(lineInput || "");
  const sep = resolveSeparatorsOrThrow(rulesInput);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  return (sep1 && s.indexOf(sep1) !== -1) || (sep2 && s.indexOf(sep2) !== -1);
}

function normalizeSingleSeparatorLayout(line, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const s = String(line || "");
  const lead = (s.match(/^(\s*)/) || ["", ""])[1];
  const body = s.slice(lead.length);
  const idx = body.indexOf(sep1);
  if (idx === -1) return s;
  const left = body.slice(0, idx).trim();
  let right = body.slice(idx + sep1.length).trim();
  if (sep1 === sep2 && right.startsWith(sep1)) {
    const rest = right.slice(sep1.length).trim();
    const base = left || "-";
    return lead + (rest ? `${base} ${sep1}  ${sep2} ${rest}` : `${base} ${sep1}  ${sep2} `);
  }
  while (right.startsWith(sep1)) right = right.slice(sep1.length).trim();
  if (!left) return lead + (right ? `- ${sep1} ${right}` : `- ${sep1} `);
  if (left === "-") return lead + (right ? `${left}  ${sep1} ${right}` : `${left}  ${sep1} `);
  return lead + (right ? `${left} ${sep1} ${right}` : `${left} ${sep1} `);
}

function removeConfiguredSeparators(line, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  let out = String(line || "");
  function strip(sep) {
    const s = String(sep || "");
    if (!s) return;
    const rx = new RegExp(`\\s*${escapeRx(s)}\\s*`, "g");
    out = out.replace(rx, " ");
  }
  strip(sep1);
  if (sep2 !== sep1) strip(sep2);
  return out.replace(/\s{2,}/g, " ").trim();
}

function stripTrailingConfiguredSeparators(line, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  let out = String(line || "");
  function trimSep(sep) {
    const s = String(sep || "");
    if (!s) return;
    const rx = new RegExp(`(?:\\s*${escapeRx(s)}\\s*)+$`, "g");
    out = out.replace(rx, "");
  }
  trimSep(sep1);
  if (sep2 !== sep1) trimSep(sep2);
  return out.replace(/\s+$/g, "");
}

function hasCheckboxListPrefix(line) {
  const body = String(line || "").replace(/^\s*/, "");
  return /^([-*+]|\d+[\.)])\s+\[[^\]]+\](\s|$)/.test(body);
}

function splitLeftPrefix(raw) {
  const src = String(raw || "").trim();
  const m = src.match(/^((?:[-*+]|\d+\.)(?:\s+\[[^\]]+\])?)(?:\s+|$)(.*)$/);
  if (!m) return { prefix: "", body: src };
  return { prefix: String(m[1] || "").trim(), body: String(m[2] || "").trim() };
}

function joinLeftPrefix(prefix, body) {
  const p = String(prefix || "").trim();
  const b = String(body || "").trim();
  if (p && b) return `${p} ${b}`;
  if (p) return p;
  return b;
}

function normalizeMinimalOffFinalLine(rawLine, finalLine, rules, options) {
  const raw = String(rawLine || "");
  const opts = options && typeof options === "object" ? options : {};
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const seg = splitThreeSegments(finalLine, rules, sep1, sep2);
  const leftParts = splitLeftPrefix(seg.left);
  const mergedBody = [String(leftParts.body || "").trim(), String(seg.text || "").trim(), String(seg.dates || "").trim()]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  let out = joinLeftPrefix(leftParts.prefix, mergedBody);
  out = removeConfiguredSeparators(out, rules);
  out = stripTrailingConfiguredSeparators(out, rules);
  if (!/^\s*#{1,6}\s+/.test(raw) && (hasListPrefix(raw) || hasStandaloneCheckboxPrefix(raw))) {
    const rawHasList = hasListPrefix(raw);
    const rawHasCheckbox = hasCheckboxListPrefix(raw) || hasStandaloneCheckboxPrefix(raw);
    const outHasList = hasListPrefix(out);
    const outHasCheckbox = hasCheckboxListPrefix(out) || hasStandaloneCheckboxPrefix(out);
    const clearedOwnCheckbox = opts.clearedOwnCheckbox === true;
    const shouldKeepCheckbox = clearedOwnCheckbox
      ? false
      : (typeof opts.shouldKeepCheckbox === "boolean"
        ? opts.shouldKeepCheckbox
        : rawHasCheckbox);
    const rawIndent = (raw.match(/^(\s*)/) || ["", ""])[1];
    const outIndent = (out.match(/^(\s*)/) || ["", ""])[1];
    const shouldReapplyPrefix = !outHasList
      || rawIndent !== outIndent
      || (clearedOwnCheckbox && outHasCheckbox)
      || (shouldKeepCheckbox && !outHasCheckbox);
    if (shouldReapplyPrefix) {
      if (shouldKeepCheckbox) {
        out = reapplyOriginalPrefix(raw, out);
      } else if (rawHasList) {
        const markerMatch = String(raw || "")
          .replace(/^\s*/, "")
          .match(/^((?:[-*+]|\d+[\.)]))(?:\s+\[[^\]]+\])?/);
        const marker = markerMatch ? String(markerMatch[1] || "").trim() : "-";
        const body = String(out || "")
          .replace(/^\s*/, "")
          .replace(/^([-*+]|\d+[\.)])\s+/, "")
          .replace(/^\[[^\]]+\]\s+/, "")
          .trimStart();
        out = body ? `${rawIndent}${marker} ${body}` : `${rawIndent}${marker}`;
      } else {
        out = rawIndent + String(out || "")
          .replace(/^\s*/, "")
          .replace(/^\[[^\]]+\]\s+/, "");
      }
    }
  }
  if (!out.trim() && raw.trim()) {
    const rawIndent = (raw.match(/^(\s*)/) || ["", ""])[1];
    out = rawIndent;
  }
  const normalized = String(out || "");
  const indent = (normalized.match(/^(\s*)/) || ["", ""])[1];
  const body = normalized.slice(indent.length).replace(/\s{2,}/g, " ").trimEnd();
  return indent + body;
}

function normalizeMinimalPriorityNoSeparatorLine(line, rules, options) {
  const opts = options && typeof options === "object" ? options : {};
  let out = removeConfiguredSeparators(line, rules);
  if (opts.stripTrailing === true) out = stripTrailingConfiguredSeparators(out, rules);
  return out.replace(/\s{2,}/g, " ").trim();
}

function alignMinimalNoSeparatorPrefix(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const finalLine = String(opts.finalLine || "");
  if (!finalLine) return finalLine;
  if (/^\s*#{1,6}\s+/.test(rawLine)) return finalLine;

  const resolvedPrefix = String(opts.resolvedPrefix || "").trim();
  const targetFieldId = String(opts.targetFieldId || "").trim();
  const selectedToken = String(opts.selectedToken || "").trim();
  const prefixRules = opts.prefixRules && typeof opts.prefixRules === "object" ? opts.prefixRules : {};

  let desiredCheckbox = ((resolvedPrefix.match(/\[[^\]]+\]/) || [""])[0] || "").trim();
  if (!desiredCheckbox && targetFieldId && selectedToken) {
    const byField = prefixRules.checkboxByFieldValue && typeof prefixRules.checkboxByFieldValue === "object"
      ? prefixRules.checkboxByFieldValue
      : {};
    const row = byField[targetFieldId] && typeof byField[targetFieldId] === "object" ? byField[targetFieldId] : null;
    if (row) {
      desiredCheckbox = String(row[selectedToken] || row[selectedToken.replace(/^#/, "")] || "").trim();
    }
  }
  if (!desiredCheckbox) return finalLine;

  const currentCheckbox = ((finalLine.match(/\[[^\]]+\]/) || [""])[0] || "").trim();
  const indent = opts.preserveIndent === true
    ? ((rawLine.match(/^(\s*)/) || ["", ""])[1] || "")
    : "";
  const finalIndent = ((finalLine.match(/^(\s*)/) || ["", ""])[1] || "");
  if (currentCheckbox === desiredCheckbox) {
    if (opts.preserveIndent === true && indent !== finalIndent && /^\s*(?:[-*+]|\d+\.)(?:\s+|$)/.test(finalLine)) {
      return indent + finalLine.replace(/^\s*/, "");
    }
    return finalLine;
  }

  const body = finalLine
    .replace(/^\s*/, "")
    .replace(/^([-*+]|\d+\.)(?:\s+|$)/, "")
    .replace(/^(\[[^\]]+\])(?:\s+|$)/, "")
    .trim();
  return `${indent}- ${desiredCheckbox}${body ? " " + body : ""}`;
}

function relocateOffEntriesToRightPanel(options) {
  const opts = options && typeof options === "object" ? options : {};
  const line = String(opts.line || "");
  if (!line) return line;
  const rules = opts.rules;
  const entries = Array.isArray(opts.offEntries) ? opts.offEntries : [];
  if (!entries.length) return line;

  const buildFromSegments = typeof opts.buildFromSegments === "function"
    ? opts.buildFromSegments
    : null;
  if (!buildFromSegments) throw new Error("pkm_line_finalize_unified: buildFromSegments required");

  const removeTokens = typeof opts.removeTokens === "function"
    ? opts.removeTokens
    : function defaultRemoveTokens(seg, tokens) {
      const src = String(seg || "").trim();
      if (!src) return src;
      const set = {};
      const list = Array.isArray(tokens) ? tokens : [];
      for (let i = 0; i < list.length; i++) {
        const t = String(list[i] || "").trim();
        if (!t) continue;
        set[t] = true;
      }
      if (!Object.keys(set).length) return src;
      return src.split(/\s+/).filter((t) => !set[t]).join(" ").trim();
    };

  const appendToken = typeof opts.appendToken === "function"
    ? opts.appendToken
    : function defaultAppendToken(seg, token) {
      const s = String(seg || "").trim();
      const t = String(token || "").trim();
      if (!t) return s;
      if (!s) return t;
      return `${s} ${t}`;
    };

  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const seg = splitThreeSegments(line, rules, sep1, sep2);
  const leftParts = splitLeftPrefix(seg.left);

  const offTokens = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e) continue;
    const direct = String(e.token || "").trim();
    if (direct) offTokens.push(direct);
    const map = Array.isArray(e.tokens) ? e.tokens : [];
    for (let j = 0; j < map.length; j++) {
      const t = String(map[j] || "").trim();
      if (t) offTokens.push(t);
    }
  }
  const uniq = [];
  const seen = {};
  for (let i = 0; i < offTokens.length; i++) {
    const t = String(offTokens[i] || "").trim();
    if (!t || seen[t]) continue;
    seen[t] = true;
    uniq.push(t);
  }

  const leftBody = removeTokens(leftParts.body, uniq);
  seg.text = removeTokens(seg.text, uniq);
  seg.dates = removeTokens(seg.dates, uniq);
  for (let i = 0; i < entries.length; i++) {
    const tok = String(entries[i] && entries[i].token ? entries[i].token : "").trim();
    if (!tok) continue;
    seg.dates = appendToken(seg.dates, tok);
  }
  seg.left = joinLeftPrefix(leftParts.prefix, leftBody);
  return buildFromSegments(seg, rules, sep1, sep2);
}

function applyFullNoSourceNormalization(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const rules = opts.rules;
  let finalLine = String(opts.finalLine || "");
  if (!finalLine) return finalLine;

  if (!hasListPrefix(rawLine) && hasListPrefix(finalLine)) {
    finalLine = removeSyntheticLeadingPrefix(finalLine);
  }
  const sepRaw = resolveSeparatorsOrThrow(rules).sep1;
  if (rawLine.indexOf(sepRaw) === -1) {
    finalLine = applyMixedPostPolicies(rawLine, finalLine, rules, {
      applyFullNoSourceCollapse: true,
    });
  }
  return finalLine;
}

function applyOffSelectionPostPolicies(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const rules = opts.rules;
  let finalLine = String(opts.finalLine || "");
  if (!finalLine) return finalLine;

  const offEntries = Array.isArray(opts.offEntries) ? opts.offEntries : [];
  const offHasLeft = opts.offHasLeft === true;
  const offHasRight = opts.offHasRight === true;

  if (offHasLeft) {
    const extractOriginalText = typeof opts.extractOriginalText === "function"
      ? opts.extractOriginalText
      : null;
    const enforceTextSegmentForLeftTag = typeof opts.enforceTextSegmentForLeftTag === "function"
      ? opts.enforceTextSegmentForLeftTag
      : null;
    if (!extractOriginalText || !enforceTextSegmentForLeftTag) {
      throw new Error("pkm_line_finalize_unified: off-left policy helpers required");
    }
    const originalText = extractOriginalText(rawLine, rules);
    return enforceTextSegmentForLeftTag(finalLine, rules, originalText);
  }

  if (offHasRight) {
    return relocateOffEntriesToRightPanel({
      line: finalLine,
      rules,
      offEntries,
      removeTokens: opts.removeTokens,
      appendToken: opts.appendToken,
      buildFromSegments: opts.buildFromSegments,
    });
  }

  return finalLine;
}

function applyUnifiedPostFinalize(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const rules = opts.rules;
  const mode = String(opts.mode || "off").trim().toLowerCase();
  let line = String(opts.line || "");

  line = applyMixedPostPolicies(rawLine, line, rules, opts.mixedPolicy || {});
  line = applyModePrefixImmutability(rawLine, line, {
    preserveOff: opts.preserveOff === true,
    preserveMinimalHeading: opts.preserveMinimalHeading === true,
  });
  line = applyFinalLineInvariants({
    rawLine,
    line,
    rules,
    mode,
  });
  return line;
}

function applyCycleEndAndInvariants(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rules = opts.rules;
  const rawLine = String(opts.rawLine || "");
  const mode = String(opts.mode || "off").trim().toLowerCase();
  const cyclePost = applyCycleEndPostProcessing({
    finalLine: String(opts.finalLine || ""),
    rules,
    cycleEndBehavior: opts.cycleEndBehavior,
    parsedLine: opts.parsedLine,
    parseLine: opts.parseLine,
    isBulletLikeEmptyResult: opts.isBulletLikeEmptyResult,
    isOrphanCheckboxBulletLine: opts.isOrphanCheckboxBulletLine,
    buildBulletOnlyLine: opts.buildBulletOnlyLine,
    shouldKeepBulletLine: opts.shouldKeepBulletLine,
    enforceNoContentFinalization: opts.enforceNoContentFinalization,
    isNoContentParsed: opts.isNoContentParsed,
    stripPrefixWhenSourceHasNoPrefix: opts.stripPrefixWhenSourceHasNoPrefix,
    sourceHasPrefix: opts.sourceHasPrefix,
    stripPrefixKeepIndent: opts.stripPrefixKeepIndent,
  });
  const lineAfterCycle = String(cyclePost && cyclePost.finalLine != null ? cyclePost.finalLine : opts.finalLine || "");
  const finalLine = applyFinalLineInvariants({
    rawLine,
    line: lineAfterCycle,
    rules,
    mode,
  });
  return {
    finalLine,
    applyKeepBullet: !!(cyclePost && cyclePost.applyKeepBullet),
  };
}

function isSimplePlainRaw(rawLine, rules, options) {
  const opts = options && typeof options === "object" ? options : {};
  const requireNoSeparator = opts.requireNoSeparator === true;
  const hasStandaloneCheckboxPrefix = typeof opts.hasStandaloneCheckboxPrefix === "function"
    ? opts.hasStandaloneCheckboxPrefix
    : function defaultHasStandaloneCheckboxPrefix(line) {
      return /^\s*\[[^\]]+\](\s|$)/.test(String(line || ""));
    };
  const hasAnySeparatorFn = typeof opts.hasAnySeparator === "function"
    ? opts.hasAnySeparator
    : function defaultHasAnySeparator(lineInput, rulesInput) {
      return hasAnySeparator(lineInput, rulesInput);
    };
  const rawTrim = String(rawLine || "").trim();
  if (!rawTrim) return false;
  if (/^#{1,6}\s+/.test(rawTrim)) return false;
  if (/^([-*+]|\d+[\.)])(\s|$)/.test(rawTrim)) return false;
  if (hasStandaloneCheckboxPrefix(rawTrim)) return false;
  if (requireNoSeparator && hasAnySeparatorFn(rawTrim, rules)) return false;
  return true;
}

function reflowNoContentPanelLine(options) {
  const opts = options && typeof options === "object" ? options : {};
  const parsedFinal = opts.parsedFinal && typeof opts.parsedFinal === "object" ? opts.parsedFinal : {};
  const parsedBase = opts.parsedBase && typeof opts.parsedBase === "object" ? opts.parsedBase : {};
  const rules = opts.rules;
  const panelName = String(opts.panelName || "right").trim().toLowerCase();
  const tags = Array.isArray(parsedFinal.tags) ? parsedFinal.tags : [];
  const text = String(parsedFinal.text || "").trim();
  const dates = String(parsedFinal.dates || "").trim();
  if (tags.length || text || !dates) return null;
  const indent = String(parsedBase.indent || "");
  const bullet = String(parsedBase.bulletToken || "-").trim() || "-";
  const cb = String(parsedBase.checkboxToken || "").trim();
  const leftPrefix = cb ? `${bullet} ${cb}` : `${bullet}`;
  const sep1 = resolveSeparatorsOrThrow(rules).sep1;
  if (panelName === "left") return `${indent}${leftPrefix} ${dates} ${sep1} `;
  return `${indent}${leftPrefix} ${sep1} ${dates}`;
}

function composeMinimalHeadingLine(options) {
  const opts = options && typeof options === "object" ? options : {};
  const indent = String(opts.indent || "");
  const headingToken = String(opts.headingToken || "").trim();
  const left = String(opts.left || "").trim();
  const text = String(opts.text || "").trim();
  const right = String(opts.right || "").trim();
  const sepOn = opts.sepOn !== false;
  const sep1 = String(opts.sep1 || "").trim();
  if (!sep1) throw new Error("pkm_line_finalize_unified: sep1 is required");
  const headingPrefix = headingToken ? `${indent}${headingToken} ` : indent;
  if (sepOn) {
    if (left && right) return `${headingPrefix}${left} ${sep1} ${text}${text ? ` ${sep1} ${right}` : right ? `${sep1} ${right}` : ""}`.trimEnd();
    if (left) return `${headingPrefix}${left}${text ? ` ${sep1} ${text}` : ""}`.trimEnd();
    if (right) return `${headingPrefix}${text}${text ? ` ${sep1} ${right}` : right ? `${sep1} ${right}` : ""}`.trimEnd();
    return `${headingPrefix}${text}`.trimEnd();
  }
  if (left && right) return `${headingPrefix}${left} ${text}${text ? ` ${right}` : right ? right : ""}`.trimEnd();
  if (left) return `${headingPrefix}${left}${text ? ` ${text}` : ""}`.trimEnd();
  if (right) return `${headingPrefix}${text}${text ? ` ${right}` : right}`.trimEnd();
  return `${headingPrefix}${text}`.trimEnd();
}

function applyMinimalSelectionNormalization(options) {
  const opts = options && typeof options === "object" ? options : {};
  const deps = opts.deps && typeof opts.deps === "object" ? opts.deps : {};
  const parseLine = typeof deps.parseLine === "function" ? deps.parseLine : null;
  const buildPrefix = typeof deps.buildPrefix === "function" ? deps.buildPrefix : null;
  const resolveFreeRoamBehavior = typeof deps.resolveFreeRoamBehavior === "function" ? deps.resolveFreeRoamBehavior : null;
  const splitThreeSegments = typeof deps.splitThreeSegments === "function" ? deps.splitThreeSegments : null;
  const resolveOrderKeyForField = typeof deps.resolveOrderKeyForField === "function" ? deps.resolveOrderKeyForField : null;
  const resolvePanelKeyForField = typeof deps.resolvePanelKeyForField === "function" ? deps.resolvePanelKeyForField : null;
  const resolveFieldFreeRoamMode = typeof deps.resolveFieldFreeRoamMode === "function" ? deps.resolveFieldFreeRoamMode : null;
  const resolvePanelForField = typeof deps.resolvePanelForField === "function" ? deps.resolvePanelForField : null;
  const selectedTokenForField = typeof deps.selectedTokenForField === "function" ? deps.selectedTokenForField : null;
  const makeFieldById = typeof deps.makeFieldById === "function" ? deps.makeFieldById : null;
  if (!parseLine || !buildPrefix || !resolveFreeRoamBehavior || !splitThreeSegments || !resolveOrderKeyForField || !resolvePanelKeyForField || !resolveFieldFreeRoamMode || !resolvePanelForField || !selectedTokenForField || !makeFieldById) {
    throw new Error("applyMinimalSelectionNormalization requires full dependency set");
  }

  const finalLine = String(opts.line || "");
  const stateRules = opts.rules;
  const parsedBase = opts.parsedBase && typeof opts.parsedBase === "object" ? opts.parsedBase : null;
  if (!parsedBase) return finalLine;
  const orderCfg = opts.orderCfg;
  const session = opts.session && typeof opts.session === "object" ? opts.session : {};
  const preserveExistingTokens = opts.preserveExistingTokens === true;
  const prefixState = opts.prefixState !== undefined ? opts.prefixState : session;
  const behavior = resolveFreeRoamBehavior(orderCfg);
  const sepOn = behavior.minimalSeparator !== false;
  const sep1 = stateRules && stateRules.io && stateRules.io.separator1 != null ? String(stateRules.io.separator1) : "";
  const sep2 = stateRules && stateRules.io && stateRules.io.separator2 != null ? String(stateRules.io.separator2) : "";

  if (hasListPrefix(opts.originalLine)) {
    if (!sep1 || !sep2) return finalLine;
    if (sepOn) return finalLine;
    const segList = splitThreeSegments(finalLine, stateRules, sep1, sep2);
    const mergedList = [String(segList.left || "").trim(), String(segList.text || "").trim(), String(segList.dates || "").trim()]
      .filter(Boolean)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return String(segList.indent || "") + mergedList;
  }

  const leftFields = stateRules && stateRules.leftMode && Array.isArray(stateRules.leftMode.fields)
    ? stateRules.leftMode.fields
    : [];
  const byId = makeFieldById(leftFields);
  const leftTokens = [];
  const rightTokens = [];
  const subFmtNow = stateRules && stateRules.behavior && typeof stateRules.behavior.subtagFormat === "string"
    ? String(stateRules.behavior.subtagFormat).toLowerCase().trim()
    : "separate";
  let i;
  for (i = 0; i < leftFields.length; i++) {
    const field = leftFields[i];
    if (!field || !field.id) continue;
    const orderKey = resolveOrderKeyForField(field);
    if (!orderKey) continue;
    if (subFmtNow === "combined" && field.dependsOn) continue;
    const panelKey = resolvePanelKeyForField(field, byId);
    const mode = resolveFieldFreeRoamMode(orderCfg, panelKey);
    if (mode !== "minimal") continue;
    const panel = resolvePanelForField(orderCfg, panelKey, "right");
    const token = selectedTokenForField(field, session, stateRules, byId);
    if (!token) continue;
    if (panel === "left") leftTokens.push(token);
    else rightTokens.push(token);
  }
  if (!leftTokens.length && !rightTokens.length) return finalLine;

  if (!sepOn && preserveExistingTokens) {
    const segKeep = splitThreeSegments(finalLine, stateRules, sep1, sep2);
    const merged = [String(segKeep.left || "").trim(), String(segKeep.text || "").trim(), String(segKeep.dates || "").trim()]
      .filter(Boolean)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return String(segKeep.indent || "") + merged;
  }

  const parsedFinal = parseLine(finalLine, stateRules);
  let text = String(parsedBase.text || "").trim();
  if (!text) text = String(parsedFinal && parsedFinal.text ? parsedFinal.text : "").trim();
  const indent = String(parsedBase.indent || "");
  let resolvedPrefix = String(buildPrefix(parsedFinal, stateRules, prefixState) || "").trim();
  if (!resolvedPrefix) resolvedPrefix = String(buildPrefix(parsedBase, stateRules, prefixState) || "").trim();

  function withResolvedPrefix(body) {
    const b = String(body || "").trimEnd();
    if (!resolvedPrefix) return (indent + b).trimEnd();
    return (indent + resolvedPrefix + (b ? (" " + b) : "")).trimEnd();
  }

  const left = leftTokens.join(" ").trim();
  const right = rightTokens.join(" ").trim();
  if (String(parsedBase.headingToken || "").trim()) {
    return composeMinimalHeadingLine({
      indent,
      headingToken: String(parsedBase.headingToken || "").trim(),
      left,
      text,
      right,
      sepOn,
      sep1,
    });
  }

  if (sepOn) {
    if (left && right) return withResolvedPrefix(`${left} ${sep1} ${text}${text ? ` ${sep1} ${right}` : right ? `${sep1} ${right}` : ""}`);
    if (left) return withResolvedPrefix(`${left}${text ? ` ${sep1} ${text}` : ""}`);
    if (right) return withResolvedPrefix(`${text}${text ? ` ${sep1} ${right}` : right ? `${sep1} ${right}` : ""}`);
    return withResolvedPrefix(text);
  }
  if (left && right) return withResolvedPrefix(`${left} ${text}${text ? ` ${right}` : right ? right : ""}`);
  if (left) return withResolvedPrefix(`${left}${text ? ` ${text}` : ""}`);
  if (right) return withResolvedPrefix(`${text}${text ? ` ${right}` : right}`);
  return withResolvedPrefix(text);
}

function collapseEmptyLeftSeparatorToText(options) {
  const opts = options && typeof options === "object" ? options : {};
  const line = String(opts.line || "");
  const parsedFinal = opts.parsedFinal && typeof opts.parsedFinal === "object" ? opts.parsedFinal : {};
  const rules = opts.rules;
  const tags = Array.isArray(parsedFinal.tags) ? parsedFinal.tags : [];
  const text = String(parsedFinal.text || "").trim();
  const dates = String(parsedFinal.dates || "").trim();
  if (tags.length || !text || dates) return line;
  const sep1 = resolveSeparatorsOrThrow(rules).sep1;
  if (!sep1) return line;
  const leftEmptyRx = new RegExp(`^\\s*(?:[-*+]|\\d+[\\.)])(?:\\s+\\[[^\\]]+\\])?\\s*${escapeRx(sep1)}\\s+`);
  if (!leftEmptyRx.test(line)) return line;
  if (typeof opts.shouldCollapse === "function" && opts.shouldCollapse(parsedFinal, line) !== true) return line;
  const indent = (line.match(/^(\s*)/) || ["", ""])[1];
  return indent + text;
}

function removeTokenWholeLine(line, token) {
  const src = String(line || "");
  const tok = String(token || "").trim();
  if (!tok) return src;
  const rx = new RegExp(`(^|\\s)${escapeRx(tok)}(?=\\s|$)`, "g");
  return src.replace(rx, "$1").replace(/\s{2,}/g, " ").replace(/\s+$/g, "");
}

function insertTokenAtIndex(src, token, idx) {
  const line = String(src || "");
  const tok = String(token || "").trim();
  if (!tok) return line;
  const at = Math.max(0, Math.min(Number(idx) || 0, line.length));
  const left = line.slice(0, at);
  const right = line.slice(at);
  const needLeft = left.length > 0 && !/\s$/.test(left);
  const needRight = right.length > 0 && !/^\s/.test(right);
  return left + (needLeft ? " " : "") + tok + (needRight ? " " : "") + right;
}

function resolveInsertIndexByPlacement(src, cursorAt, placement) {
  const line = String(src || "");
  const at = Math.max(0, Math.min(Number(cursorAt) || 0, line.length));
  const mode = String(placement || "smart").toLowerCase().trim();
  if (mode === "line_start") return 0;
  if (mode === "line_end") return line.length;
  if (mode === "cursor") return at;
  const isWord = function isWord(ch) { return /\S/.test(ch); };
  if (!line.length) return 0;
  if (at <= 0) return 0;
  if (at >= line.length) return line.length;
  const leftWord = isWord(line.charAt(at - 1));
  const rightWord = isWord(line.charAt(at));
  if (!leftWord && !rightWord) return at;
  let start = at;
  if (leftWord) {
    start = at - 1;
    while (start > 0 && isWord(line.charAt(start - 1))) start -= 1;
  }
  let end = at;
  if (rightWord) {
    while (end < line.length && isWord(line.charAt(end))) end += 1;
  }
  if (mode === "left") return start;
  if (mode === "right") return end;
  const distLeft = at - start;
  const distRight = end - at;
  return distLeft <= distRight ? start : end;
}

function normalizeFullTagLineByEntries(options) {
  const opts = options && typeof options === "object" ? options : {};
  const entries = Array.isArray(opts.entries) ? opts.entries : [];
  const removeTokenWholeLineFn = typeof opts.removeTokenWholeLine === "function"
    ? opts.removeTokenWholeLine
    : removeTokenWholeLine;
  const resolveInsertIndexByPlacementFn = typeof opts.resolveInsertIndexByPlacement === "function"
    ? opts.resolveInsertIndexByPlacement
    : resolveInsertIndexByPlacement;
  const insertTokenAtIndexFn = typeof opts.insertTokenAtIndex === "function"
    ? opts.insertTokenAtIndex
    : insertTokenAtIndex;
  const remapCursorByLineDiff = typeof opts.remapCursorByLineDiff === "function"
    ? opts.remapCursorByLineDiff
    : function defaultRemap(_from, to) { return String(to || "").length; };

  let out = String(opts.line || "");
  let cursor = Math.max(0, Number(opts.cursorCh || 0));
  const placement = String(opts.placement || "smart").toLowerCase().trim();

  let i;
  for (i = 0; i < entries.length; i++) {
    const item = entries[i] && typeof entries[i] === "object" ? entries[i] : {};
    const tok = String(item.token || "").trim();
    if (!tok) continue;
    const allTokens = Array.isArray(item.tokens) ? item.tokens : [];
    let cleaned = out;
    let j;
    for (j = 0; j < allTokens.length; j++) cleaned = removeTokenWholeLineFn(cleaned, allTokens[j]);
    cleaned = removeTokenWholeLineFn(cleaned, tok);
    cursor = remapCursorByLineDiff(out, cleaned, cursor);
    out = cleaned;
    const idx = resolveInsertIndexByPlacementFn(out, cursor, placement);
    const inserted = insertTokenAtIndexFn(out, tok, idx);
    const posAfter = idx + tok.length + ((idx > 0 && !/\s$/.test(out.slice(0, idx))) ? 1 : 0);
    cursor = remapCursorByLineDiff(inserted, inserted, posAfter);
    out = inserted;
  }

  return {
    line: (function normalizeWithIndent(src, originalLine) {
      const raw = String(src || "");
      const baseIndent = (String(originalLine || "").match(/^(\s*)/) || ["", ""])[1];
      const body = raw.replace(/^\s*/, "").replace(/\s{2,}/g, " ").replace(/\s+$/g, "");
      return baseIndent + body;
    })(out, opts.line),
    cursorCh: Math.max(0, Math.trunc(Number(cursor) || 0)),
  };
}

function normalizeStructuredSlots(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const line = String(opts.line || "");
  const rules = opts.rules;
  const mode = String(opts.mode || "off").trim().toLowerCase();
  if (mode !== "off" && mode !== "minimal" && mode !== "full") return line;
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  if (!sep1 || line.indexOf(sep1) === -1) return line;

  const seg = splitThreeSegments(line, rules, sep1, sep2);
  const headingFromRaw = extractHeadingPrefix(rawLine);
  const headingFromLine = extractHeadingPrefix(line);
  const leftWithoutList = String(seg.left || "")
    .replace(/^\s*(?:[-*+]|\d+[\.)])\s+/, "")
    .replace(/^\s*\[[^\]]+\]\s+/, "");
  const headingFromLeft = extractHeadingPrefix(leftWithoutList);
  const headingPrefix = headingFromRaw || headingFromLine || headingFromLeft;
  if (!headingPrefix) return line;

  let left = String(seg.left || "").replace(/\s+$/g, "");
  let text = String(seg.text || "").trim();
  const dates = String(seg.dates || "").trim();

  const leftBody = left
    .replace(/^\s*#{1,6}(?:\s+|$)/, "")
    .replace(/^\s*(?:[-*+]|\d+[\.)])\s+/, "")
    .replace(/^\s*\[[^\]]+\]\s+/, "")
    .replace(/(^|\s)#{1,6}(?=\s|$)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (text && !leftBody && !dates) {
    return `${headingPrefix} ${text}`.replace(/\s{2,}/g, " ").trimEnd();
  }

  if (text) return line;

  const tokens = leftBody ? leftBody.split(/\s+/).filter(Boolean) : [];
  if (!tokens.length) return line;

  const markers = getRightMarkersUnified(rules);
  const markerAlt = markers.length ? markers.map(escapeRx).join("|") : "(?!)";
  const markerRe = new RegExp("^(?:" + markerAlt + ")");

  function isControlToken(token) {
    const t = String(token || "").trim();
    if (!t) return false;
    return /^#\S+$/.test(t)
      || /^\[\[[^\]]+\]\]$/.test(t)
      || markerRe.test(t)
      || /^\d{4}-\d{2}-\d{2}$/.test(t)
      || /^\d{2}:\d{2}$/.test(t);
  }

  let splitAt = tokens.length;
  while (splitAt > 0 && !isControlToken(tokens[splitAt - 1])) splitAt -= 1;
  if (splitAt === tokens.length) return line;

  const leftTokens = tokens.slice(0, splitAt);
  const textTokens = tokens.slice(splitAt);
  text = textTokens.join(" ").trim();
  left = headingPrefix + (leftTokens.length ? (" " + leftTokens.join(" ")) : "");

  let out = left;
  out += ` ${sep1}`;
  if (text) out += ` ${text}`;
  if (dates) out += ` ${sep2} ${dates}`;
  return out.replace(/\s{2,}/g, " ").trimEnd();
}

function splitLeftDecorators(rawLeft) {
  const src = String(rawLeft || "");
  const indent = (src.match(/^(\s*)/) || ["", ""])[1];
  let body = src.slice(indent.length);
  let headingToken = "";
  let listToken = "";
  let checkboxToken = "";

  const mh = body.match(/^(#{1,6})\s+/);
  if (mh) {
    headingToken = String(mh[1] || "").trim();
    body = body.slice(mh[0].length);
  }

  const ml = body.match(/^([-*+]|\d+[\.)])\s+/);
  if (ml) {
    listToken = String(ml[1] || "").trim();
    body = body.slice(ml[0].length);
  }

  const mc = body.match(/^(\[[^\]]+\])\s+/);
  if (mc) {
    checkboxToken = String(mc[1] || "").trim();
    body = body.slice(mc[0].length);
  }

  return {
    indent,
    headingToken,
    listToken,
    checkboxToken,
    body: String(body || "").trim(),
  };
}

function joinLeftDecorators(parts, body) {
  const p = parts && typeof parts === "object" ? parts : {};
  const indent = String(p.indent || "");
  const tokens = [];
  if (p.headingToken) tokens.push(String(p.headingToken));
  if (p.listToken) tokens.push(String(p.listToken));
  if (p.checkboxToken) tokens.push(String(p.checkboxToken));
  const tail = String(body || "").trim();
  if (tail) tokens.push(tail);
  return indent + tokens.join(" ").trim();
}

function enforceSourcePrefixInvariant(rawLine, line) {
  const raw = String(rawLine || "");
  const out = String(line || "");
  if (!out.trim()) return out;
  const rawHasPrefix = hasListPrefix(raw) || hasStandaloneCheckboxPrefix(raw);
  if (!rawHasPrefix) return out;
  const outHasPrefix = hasListPrefix(out) || hasStandaloneCheckboxPrefix(out);
  if (outHasPrefix) return out;
  return reapplyOriginalPrefix(raw, out);
}

function stripSyntheticPrefixForPlainSource(rawLine, line) {
  const raw = String(rawLine || "");
  const out = String(line || "");
  if (!out.trim()) return out;
  const rawHasPrefix = hasListPrefix(raw) || hasStandaloneCheckboxPrefix(raw) || /^\s*#{1,6}\s+/.test(raw);
  if (rawHasPrefix) return out;
  if (!hasListPrefix(out) && !hasStandaloneCheckboxPrefix(out)) return out;
  const rawIndent = (raw.match(/^(\s*)/) || ["", ""])[1];
  let body = out.replace(/^\s*/, "");
  body = body.replace(/^([-*+]|\d+[\.)])\s+/, "");
  body = body.replace(/^\[[^\]]+\]\s+/, "");
  return rawIndent + body;
}

function normalizeLeftTextSpill(options) {
  const opts = options && typeof options === "object" ? options : {};
  const line = String(opts.line || "");
  const rules = opts.rules;
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  if (!sep1 || line.indexOf(sep1) === -1) return line;

  const seg = splitThreeSegments(line, rules, sep1, sep2);
  if (String(seg.text || "").trim()) return line;

  const leftParts = splitLeftDecorators(seg.left);
  const body = String(leftParts.body || "").trim();
  if (!body) return line;
  const tokens = body.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return line;

  const markers = getRightMarkersUnified(rules);
  const markerAlt = markers.length ? markers.map(escapeRx).join("|") : "(?!)";
  const markerRe = new RegExp("^(?:" + markerAlt + ")");
  function isControlToken(token) {
    const t = String(token || "").trim();
    if (!t) return false;
    return /^#\S+$/.test(t)
      || /^\[\[[^\]]+\]\]$/.test(t)
      || markerRe.test(t)
      || /^\d{4}-\d{2}-\d{2}$/.test(t)
      || /^\d{2}:\d{2}$/.test(t);
  }

  let lastControlIdx = -1;
  let i;
  for (i = 0; i < tokens.length; i++) {
    if (isControlToken(tokens[i])) lastControlIdx = i;
  }
  if (lastControlIdx < 0 || lastControlIdx >= tokens.length - 1) return line;

  const spill = tokens.slice(lastControlIdx + 1);
  if (!spill.length || spill.some(isControlToken)) return line;
  const controlTokens = tokens.slice(0, lastControlIdx + 1);
  if (!controlTokens.length) return line;

  const nextLeft = joinLeftDecorators(leftParts, controlTokens.join(" "));
  const nextText = spill.join(" ").trim();
  if (!nextText) return line;

  let out = nextLeft + " " + sep1;
  out += " " + nextText;
  if (String(seg.dates || "").trim()) out += " " + sep2 + " " + String(seg.dates || "").trim();
  return out.trimEnd();
}

function hasMarkerAnchoredRightPayload(raw, rules) {
  const payload = String(raw || "").trim();
  if (!payload) return false;
  const parts = payload.split(/\s+/).filter(Boolean);
  if (!parts.length) return false;
  const markers = getRightMarkersUnified(rules);
  const first = String(parts[0] || "");
  const hasMarkerStart = markers.some((m) => m && first.startsWith(m) && first.length > m.length);
  if (!hasMarkerStart) return false;
  if (parts.length === 1) return true;
  let i;
  for (i = 1; i < parts.length; i++) {
    const t = String(parts[i] || "").trim();
    if (!t) return false;
    if (!/^\d{2}[-:]\d{2}(?:[-:]\d{2})?$/.test(t) && !/^\d{2}$/.test(t)) return false;
  }
  return true;
}

function stripListDecoratorsForPlainText(raw) {
  let out = String(raw || "").trim();
  out = out.replace(/^\s*(?:[-*+]|\d+[\.)])(?:\s+|$)/, "");
  out = out.replace(/^\s*\[[^\]]+\](?:\s+|$)/, "");
  return out.trim();
}

function extractTrailingMarkerPayloadFromText(rawText, rules) {
  const src = String(rawText || "").trim();
  if (!src) return { text: "", payload: "" };
  const parts = src.split(/\s+/).filter(Boolean);
  if (!parts.length) return { text: "", payload: "" };
  let start = -1;
  let i;
  for (i = 0; i < parts.length; i++) {
    const tail = parts.slice(i).join(" ").trim();
    if (hasMarkerAnchoredRightPayload(tail, rules)) {
      start = i;
      break;
    }
  }
  if (start === -1) return { text: src, payload: "" };
  const text = parts.slice(0, start).join(" ").trim();
  const payload = parts.slice(start).join(" ").trim();
  return { text, payload };
}

function startsWithAnyDateMarker(token, rules) {
  const t = String(token || "").trim();
  if (!t) return false;
  const markers = getRightMarkersUnified(rules);
  let i;
  for (i = 0; i < markers.length; i++) {
    const mk = markers[i];
    if (mk && t.startsWith(mk) && t.length > mk.length) return true;
  }
  return false;
}

function enforceRightPayloadSeparatorInvariant(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rules = opts.rules;
  const rawLine = String(opts.rawLine || "");
  const line = String(opts.line || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  if (!sep1 || line.indexOf(sep1) === -1) return line;

  const seg = splitThreeSegments(line, rules, sep1, sep2);
  let left = String(seg.left || "").trimEnd();
  let text = String(seg.text || "").trim();
  let dates = String(seg.dates || "").trim();

  if (!dates && text) {
    const extracted = extractTrailingMarkerPayloadFromText(text, rules);
    if (extracted.payload) {
      text = extracted.text;
      dates = extracted.payload;
    }
  }

  if (!dates && text && hasMarkerAnchoredRightPayload(text, rules)) {
    dates = text;
    text = "";
  }

  if (!dates && text) {
    const leftParts = splitLeftPrefix(left);
    const leftBody = String(leftParts.body || "").trim();
    const leftTokens = leftBody ? leftBody.split(/\s+/).filter(Boolean) : [];
    const textTokens = text.split(/\s+/).filter(Boolean);
    let markerIdx = -1;
    let i;
    for (i = leftTokens.length - 1; i >= 0; i--) {
      if (startsWithAnyDateMarker(leftTokens[i], rules)) {
        markerIdx = i;
        break;
      }
    }
    if (markerIdx >= 0) {
      const candidate = leftTokens.slice(markerIdx).concat(textTokens).join(" ").trim();
      if (hasMarkerAnchoredRightPayload(candidate, rules)) {
        dates = candidate;
        text = "";
        left = joinLeftPrefix(leftParts.prefix, leftTokens.slice(0, markerIdx).join(" ").trim());
      }
    }
  }

  if (!dates && !text) {
    const leftParts = splitLeftPrefix(left);
    const leftBody = String(leftParts.body || "").trim();
    if (leftBody) {
      const extractedLeft = extractTrailingMarkerPayloadFromText(leftBody, rules);
      if (extractedLeft.payload) {
        dates = extractedLeft.payload;
        left = joinLeftPrefix(leftParts.prefix, extractedLeft.text || "");
      }
    }
  }
  if (!dates) return line;

  const rawPlain = stripListDecoratorsForPlainText(rawLine);
  if (rawPlain) {
    const leftPlain = stripListDecoratorsForPlainText(left);
    if (leftPlain === (rawPlain + " " + rawPlain)) {
      const prefix = splitLeftPrefix(left).prefix;
      left = joinLeftPrefix(prefix, rawPlain);
    }
  }

  const indent = String(seg.indent || "");
  const baseLeft = String(left || "").trim() || "-";
  if (text && dates) {
    if (sep1 === sep2) return `${indent}${baseLeft} ${sep1} ${text} ${sep2} ${dates}`;
    return `${indent}${baseLeft} ${sep1} ${text} ${sep2} ${dates}`;
  }
  if (dates) {
    /*
     * Текста нет, а справа что-то есть. Тогда пустое место между
     * разделителями — это слот под текст, и заводить его надо (10.13.34,
     * заказ заказчика 2026-09-05).
     *
     * Правило то же, по которому его заводит `line_pipeline.buildFromSegments`:
     * два разделителя ставятся, когда слева **тег, ссылка или элемент**, и не
     * ставятся, когда слева обычный текст — там писать уже написано. До этой
     * правки здесь стояло второе объявление того же правила, и разошлись они
     * молча ровно на паре одинаковых разделителей (У-32).
     *
     * При одинаковых разделителях между ними два пробела: так их различает
     * разбор строки, и так же делает `buildFromSegments`.
     */
    const leftTech = /(^|\s)(#\S+|\[\[[^\]]+\]\])/.test(baseLeft)
      || baseLeft.split(/\s+/).some(function(t) { return startsWithAnyDateMarker(t, rules); });
    if (!leftTech) return `${indent}${baseLeft} ${sep1} ${dates}`;
    if (sep1 === sep2) return `${indent}${baseLeft} ${sep1}  ${sep2} ${dates}`;
    return `${indent}${baseLeft} ${sep1} ${sep2} ${dates}`;
  }
  return line;
}

function applyFinalLineInvariants(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const rules = opts.rules;
  const mode = String(opts.mode || "off").trim().toLowerCase();
  let out = String(opts.line || "");
  out = enforceSourcePrefixInvariant(rawLine, out);
  out = normalizeLeftTextSpill({ line: out, rules });
  out = enforceRightPayloadSeparatorInvariant({ rawLine, line: out, rules });
  out = normalizeStructuredSlots({ rawLine, line: out, rules, mode });
  out = normalizeSeparatorTopology(out, rules);
  out = enforceSourcePrefixInvariant(rawLine, out);
  out = stripSyntheticPrefixForPlainSource(rawLine, out);
  return out;
}

function applyCycleEndPostProcessing(options) {
  const opts = options && typeof options === "object" ? options : {};
  const parseLine = typeof opts.parseLine === "function" ? opts.parseLine : function noParse() { return {}; };
  const isBulletLike = typeof opts.isBulletLikeEmptyResult === "function"
    ? opts.isBulletLikeEmptyResult
    : function noBullet() { return false; };
  const isOrphanCheckbox = typeof opts.isOrphanCheckboxBulletLine === "function"
    ? opts.isOrphanCheckboxBulletLine
    : function noOrphan() { return false; };
  const buildBullet = typeof opts.buildBulletOnlyLine === "function"
    ? opts.buildBulletOnlyLine
    : function noBuild() { return "- "; };
  const stripPrefixKeepIndent = typeof opts.stripPrefixKeepIndent === "function"
    ? opts.stripPrefixKeepIndent
    : null;
  const shouldClearToEmptyLine = typeof opts.shouldClearToEmptyLine === "function"
    ? opts.shouldClearToEmptyLine
    : function defaultShouldClear() { return false; };
  const shouldKeepBulletLine = typeof opts.shouldKeepBulletLine === "function"
    ? opts.shouldKeepBulletLine
    : function defaultKeepBulletLine(line) {
      return /^\s*(?:[-*+]|\d+[\.\)])\s*$/.test(String(line || ""));
    };
  const isNoContent = typeof opts.isNoContentParsed === "function"
    ? opts.isNoContentParsed
    : function defaultNoContent(parsed) {
      if (!parsed || parsed.headingToken) return false;
      const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
      if (tags.length) return false;
      if (String(parsed.text || "").trim()) return false;
      if (String(parsed.dates || "").trim()) return false;
      return true;
    };
  const parsedLine = opts.parsedLine;
  const rules = opts.rules;
  const cycleEndRaw = String(opts.cycleEndBehavior || "").trim().toLowerCase();
  const cycleEndBehavior = (
    cycleEndRaw === "clear-prefix"
    || cycleEndRaw === "off"
    || cycleEndRaw === "of"
    || cycleEndRaw === "none"
    || cycleEndRaw.indexOf("clear") !== -1
    || cycleEndRaw.indexOf("empty") !== -1
  )
    ? "clear-prefix"
    : "keep-bullet";
  let finalLine = String(opts.finalLine || "");
  let parsedAfter = parseLine(finalLine, rules);

  if (cycleEndBehavior === "clear-prefix" && /^-\s*(\|\|\s*)*$/.test(String(finalLine || "").trim())) {
    finalLine = "";
    parsedAfter = parseLine(finalLine, rules);
  }

  if (cycleEndBehavior === "clear-prefix") {
    const tagsAfter = Array.isArray(parsedAfter && parsedAfter.tags) ? parsedAfter.tags : [];
    const textAfter = String(parsedAfter && parsedAfter.text ? parsedAfter.text : "").trim();
    const datesAfter = String(parsedAfter && parsedAfter.dates ? parsedAfter.dates : "").trim();
    if (!tagsAfter.length && !datesAfter && textAfter) {
      const indentKeep = (String(finalLine || "").match(/^(\s*)/) || ["", ""])[1];
      finalLine = indentKeep + textAfter;
      parsedAfter = parseLine(finalLine, rules);
    }
    if (!tagsAfter.length && !datesAfter && /^\s*[-*+]\s+\[[^\]]+\]\s+\S/.test(String(finalLine || ""))) {
      const indentKeep = (String(finalLine || "").match(/^(\s*)/) || ["", ""])[1];
      const textOnly = String(finalLine || "")
        .replace(/^\s*[-*+]\s+\[[^\]]+\]\s+/, "")
        .trim();
      finalLine = indentKeep + textOnly;
      parsedAfter = parseLine(finalLine, rules);
    }
  }

  if (cycleEndBehavior === "clear-prefix" && shouldClearToEmptyLine(finalLine, parsedAfter)) {
    finalLine = "";
    parsedAfter = parseLine(finalLine, rules);
  }

  if (
    cycleEndBehavior === "clear-prefix"
    && opts.stripPrefixWhenSourceHasNoPrefix === true
    && !opts.sourceHasPrefix
    && (!Array.isArray(parsedAfter && parsedAfter.tags) || !parsedAfter.tags.length)
    && !String(parsedAfter && parsedAfter.dates ? parsedAfter.dates : "").trim()
    && stripPrefixKeepIndent
  ) {
    finalLine = stripPrefixKeepIndent(finalLine, false);
    parsedAfter = parseLine(finalLine, rules);
  }

  if (opts.enforceNoContentFinalization === true && isNoContent(parsedAfter)) {
    finalLine = cycleEndBehavior === "clear-prefix" ? "" : buildBullet(parsedLine);
    parsedAfter = parseLine(finalLine, rules);
  }

  if (isBulletLike(finalLine, parsedAfter) || isOrphanCheckbox(finalLine)) {
    finalLine = cycleEndBehavior === "clear-prefix" ? "" : buildBullet(parsedLine);
    parsedAfter = parseLine(finalLine, rules);
  }

  const applyKeepBullet = cycleEndBehavior !== "clear-prefix" && shouldKeepBulletLine(finalLine);

  return { finalLine, parsedAfter, cycleEndBehavior, applyKeepBullet };
}

function applyTrailingSeparatorPolicy(options) {
  const opts = options && typeof options === "object" ? options : {};
  const ensureTrailing = typeof opts.ensureTrailingSeparatorSpace === "function"
    ? opts.ensureTrailingSeparatorSpace
    : null;
  const freeRoamMode = String(opts.freeRoamMode || "off").trim().toLowerCase();
  const mixedMinimalSeparatorOff = opts.mixedMinimalSeparatorOff === true;
  const skipNormalization = opts.skipNormalization === true;
  const line = String(opts.line || "");
  const rules = opts.rules;
  const parsedFinal = opts.parsedFinal;
  if (!ensureTrailing) return line;
  if (skipNormalization) return line;
  if (freeRoamMode === "full" || mixedMinimalSeparatorOff) return line;
  return ensureTrailing(line, rules, parsedFinal);
}

function resolveMixedSelectionPolicy(selectedEntries, freeRoamBehavior) {
  const entries = Array.isArray(selectedEntries) ? selectedEntries : [];
  const fr = freeRoamBehavior && typeof freeRoamBehavior === "object" ? freeRoamBehavior : {};
  const hasOffSelected = entries.some((e) => e && e.mode === "off");
  const hasFullSelected = entries.some((e) => e && e.mode === "full");
  const hasMinimalSelected = entries.some((e) => e && e.mode === "minimal");
  const isMinimalOnlySelected = hasMinimalSelected && !hasOffSelected && !hasFullSelected;
  const minimalPrefixIgnoreFieldIds = {};
  if (fr.minimalPrefix === false && hasMinimalSelected) {
    entries.forEach((e) => {
      if (!e || e.mode !== "minimal") return;
      const fid = String(e.id || "").trim();
      if (!fid) return;
      minimalPrefixIgnoreFieldIds[fid] = true;
    });
  }
  return {
    hasOffSelected,
    hasFullSelected,
    hasMinimalSelected,
    isMinimalOnlySelected,
    applyMinimalSeparatorCollapse: hasMinimalSelected && !hasFullSelected && fr.minimalSeparator === false,
    applyMinimalPrefixPreserve: isMinimalOnlySelected && fr.minimalPrefix === false,
    minimalPrefixIgnoreFieldIds,
  };
}

function resolveEffectiveSelectionPolicy(options) {
  const opts = options && typeof options === "object" ? options : {};
  const selectedEntries = Array.isArray(opts.selectedEntries) ? opts.selectedEntries : [];
  const freeRoamBehavior = opts.freeRoamBehavior && typeof opts.freeRoamBehavior === "object"
    ? opts.freeRoamBehavior
    : {};
  const activeModeRaw = String(opts.activeMode || "").trim().toLowerCase();
  const activeMode = (activeModeRaw === "off" || activeModeRaw === "minimal" || activeModeRaw === "full")
    ? activeModeRaw
    : "";
  const entries = selectedEntries.slice();
  if (activeMode) {
    const hasMode = entries.some((e) => e && String(e.mode || "").trim().toLowerCase() === activeMode);
    if (!hasMode) entries.push({ id: "__active__", mode: activeMode });
  }
  return resolveMixedSelectionPolicy(entries, freeRoamBehavior);
}

function resolveOffPrefixFlagsUnified(options) {
  const opts = options && typeof options === "object" ? options : {};
  const mode = String(opts.mode || "off").trim().toLowerCase();
  const hasOwnCheckbox = opts.hasOwnCheckbox === true;
  const clearedOwnCheckbox = opts.clearedOwnCheckbox === true;
  const freeRoamBehavior = opts.freeRoamBehavior && typeof opts.freeRoamBehavior === "object"
    ? opts.freeRoamBehavior
    : {};

  if (mode !== "off") {
    return { preserveCheckboxPrefix: false, forceBulletPrefix: false, preserveOffImmutability: false };
  }
  if (hasOwnCheckbox) {
    return { preserveCheckboxPrefix: false, forceBulletPrefix: false, preserveOffImmutability: false };
  }
  if (clearedOwnCheckbox) {
    return { preserveCheckboxPrefix: false, forceBulletPrefix: true, preserveOffImmutability: false };
  }
  const offPrefixOn = !!(freeRoamBehavior && freeRoamBehavior.offPrefix === true);
  if (offPrefixOn) {
    return { preserveCheckboxPrefix: false, forceBulletPrefix: true, preserveOffImmutability: false };
  }
  return { preserveCheckboxPrefix: true, forceBulletPrefix: false, preserveOffImmutability: true };
}

function enforceOffModeFinalPrefixUnified(options) {
  const opts = options && typeof options === "object" ? options : {};
  const mode = String(opts.mode || "off").trim().toLowerCase();
  const line = String(opts.line || "");
  const rawLine = String(opts.rawLine || "");
  if (mode !== "off" || /^\s*#{1,6}\s+/.test(rawLine)) return line;
  if (String(opts.cycleEndBehavior || "").trim().toLowerCase() === "clear-prefix" && typeof opts.parseLine === "function") {
    const parsed = opts.parseLine(line, opts.rules);
    const tags = Array.isArray(parsed && parsed.tags) ? parsed.tags : [];
    const dates = String(parsed && parsed.dates ? parsed.dates : "").trim();
    const text = String(parsed && parsed.text ? parsed.text : "").trim();
    if (!tags.length && !dates && text) return line;
  }
  const flags = resolveOffPrefixFlagsUnified(opts);
  if (opts.preserveSyntheticPrefix === true) {
    if (hasListPrefix(line)) return line;
    const prefix = String(opts.resolvedPrefix || "").trim();
    if (!prefix) return line;
    const indent = (line.match(/^(\s*)/) || ["", ""])[1];
    const body = line.trimStart();
    return `${indent}${prefix}${body ? " " + body : ""}`;
  }
  if (flags.preserveOffImmutability && !hasListPrefix(rawLine)) {
    return removeSyntheticLeadingPrefix(line);
  }
  if (hasListPrefix(line)) return line;
  const resolvedPrefix = String(opts.resolvedPrefix || "").trim();
  const fallbackPrefix = resolvedPrefix || (opts.hasOwnCheckbox === true ? "- [ ]" : (flags.forceBulletPrefix ? "-" : ""));
  if (!fallbackPrefix) return line;
  const indent = (line.match(/^(\s*)/) || ["", ""])[1];
  const body = line.trimStart();
  return `${indent}${fallbackPrefix}${body ? " " + body : ""}`;
}

module.exports = {
  normalizeCheckboxToken,
  getPrefixRulesUnified,
  selectedTokenByFieldIdUnified,
  resolvePrefixCheckboxUnified,
  buildPrefixUnified,
  hasListPrefix,
  hasStandaloneCheckboxPrefix,
  hasCheckboxListPrefix,
  extractOriginalPrefix,
  reapplyOriginalPrefix,
  preserveOriginalPrefixShape,
  removeSyntheticLeadingPrefix,
  removeStandaloneHeadingMarkers,
  applyPrefixPolicy,
  applyResolvedPrefixToLine,
  applyModePrefixImmutability,
  applyMixedPostPolicies,
  normalizeSeparatorTopology,
  hasAnySeparator,
  normalizeSingleSeparatorLayout,
  removeConfiguredSeparators,
  stripTrailingConfiguredSeparators,
  normalizeMinimalOffFinalLine,
  normalizeMinimalPriorityNoSeparatorLine,
  alignMinimalNoSeparatorPrefix,
  relocateOffEntriesToRightPanel,
  applyFullNoSourceNormalization,
  applyOffSelectionPostPolicies,
  applyUnifiedPostFinalize,
  applyCycleEndAndInvariants,
  isSimplePlainRaw,
  normalizeStructuredSlots,
  applyFinalLineInvariants,
  reflowNoContentPanelLine,
  composeMinimalHeadingLine,
  applyMinimalSelectionNormalization,
  collapseEmptyLeftSeparatorToText,
  normalizeFullTagLineByEntries,
  removeTokenWholeLine,
  insertTokenAtIndex,
  resolveInsertIndexByPlacement,
  resolveCursorByPolicy,
  applyCycleEndPostProcessing,
  applyTrailingSeparatorPolicy,
  resolveMixedSelectionPolicy,
  resolveEffectiveSelectionPolicy,
  resolveOffPrefixFlagsUnified,
  enforceOffModeFinalPrefixUnified,
};
