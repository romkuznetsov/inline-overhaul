"use strict";

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSeparators(rules) {
  var io = rules && typeof rules.io === "object" && !Array.isArray(rules.io) ? rules.io : null;
  var sep1 = io && io.separator1 != null ? String(io.separator1).trim() : "";
  var sep2 = io && io.separator2 != null ? String(io.separator2).trim() : "";
  if (!sep1 || !sep2) {
    throw new Error("token_graph_unified: rules.io.separator1 and rules.io.separator2 are required");
  }
  return {
    separator1: sep1,
    separator2: sep2,
  };
}

function splitSegments(rawLine, rules) {
  var line = String(rawLine || "").trim();
  var sep = getSeparators(rules);
  var sep1 = sep.separator1;
  var sep2 = sep.separator2;

  if (sep1 === sep2) {
    var partsEq = line.split(sep1).map(function (x) { return String(x || "").trim(); });
    if (partsEq.length <= 1) return { left: line, text: "", dates: "" };
    if (partsEq.length === 2) return { left: partsEq[0] || "", text: partsEq[1] || "", dates: "" };
    return {
      left: partsEq[0] || "",
      text: partsEq[1] || "",
      dates: partsEq.slice(2).join(" ").trim(),
    };
  }

  var i1 = line.indexOf(sep1);
  if (i1 === -1) return { left: line, text: "", dates: "" };
  var left = line.slice(0, i1).trim();
  var after1 = line.slice(i1 + sep1.length).trim();
  var i2 = after1.indexOf(sep2);
  if (i2 === -1) return { left: left, text: after1, dates: "" };
  return {
    left: left,
    text: after1.slice(0, i2).trim(),
    dates: after1.slice(i2 + sep2.length).trim(),
  };
}

function collectRightMarkers(rules) {
  var out = [];
  var seen = {};
  function push(marker) {
    var m = String(marker || "").trim();
    if (!m || seen[m]) return;
    seen[m] = true;
    out.push(m);
  }

  var rightFields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields)
    ? rules.rightMode.fields
    : [];
  var i;
  for (i = 0; i < rightFields.length; i++) push(rightFields[i] && rightFields[i].marker);

  var behavior = rules && typeof rules.behavior === "object" && !Array.isArray(rules.behavior)
    ? rules.behavior
    : {};
  var dateRuntime = behavior && typeof behavior.dateRuntimeConfig === "object" && !Array.isArray(behavior.dateRuntimeConfig)
    ? behavior.dateRuntimeConfig
    : {};
  var byField = dateRuntime && typeof dateRuntime.byField === "object" && !Array.isArray(dateRuntime.byField)
    ? dateRuntime.byField
    : {};
  var keys = Object.keys(byField);
  for (i = 0; i < keys.length; i++) {
    var row = byField[keys[i]];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    push(row.emoji);
    push(row.marker);
  }
  return out;
}

function classifyToken(raw, rightMarkers) {
  var token = String(raw || "").trim();
  if (!token) return { sourceKind: "unknown", markerKind: "" };
  if (/^#\S+$/.test(token)) return { sourceKind: "tag", markerKind: "" };
  if (/^\[\[[^\]]+\]\]$/.test(token)) return { sourceKind: "wikilink", markerKind: "" };
  var i;
  for (i = 0; i < rightMarkers.length; i++) {
    var marker = String(rightMarkers[i] || "").trim();
    if (!marker) continue;
    if (token.indexOf(marker) === 0 && token.length > marker.length) {
      return { sourceKind: "marker", markerKind: marker };
    }
  }
  return { sourceKind: "unknown", markerKind: "" };
}

function extractFactsFromSegment(segText, panel, rightMarkers, startPosition, includeUnknown) {
  var src = String(segText || "");
  if (!src) return { facts: [], position: startPosition };
  var parts = src.split(/\s+/).filter(Boolean);
  var facts = [];
  var position = Number(startPosition || 0);
  var i;
  for (i = 0; i < parts.length; i++) {
    var token = String(parts[i] || "").trim();
    if (!token) continue;
    var info = classifyToken(token, rightMarkers);
    if (info.sourceKind === "unknown" && !includeUnknown) continue;
    facts.push({
      raw: token,
      fieldId: "",
      orderKey: "",
      panel: panel,
      position: position,
      sourceKind: info.sourceKind,
      markerKind: info.markerKind,
    });
    position += 1;
  }
  return { facts: facts, position: position };
}

function buildTokenFactsFromLine(rawLine, rules, options) {
  var opts = options && typeof options === "object" ? options : {};
  var includeUnknown = opts.includeUnknown === true;
  var seg = splitSegments(rawLine, rules);
  var rightMarkers = collectRightMarkers(rules);
  var position = 0;
  var out = [];

  var leftRes = extractFactsFromSegment(seg.left, "left", rightMarkers, position, includeUnknown);
  out = out.concat(leftRes.facts);
  position = leftRes.position;

  var textRes = extractFactsFromSegment(seg.text, "text", rightMarkers, position, includeUnknown);
  out = out.concat(textRes.facts);
  position = textRes.position;

  var rightRes = extractFactsFromSegment(seg.dates, "right", rightMarkers, position, includeUnknown);
  out = out.concat(rightRes.facts);

  return out;
}

module.exports = {
  buildTokenFactsFromLine: buildTokenFactsFromLine,
  splitSegments: splitSegments,
};
