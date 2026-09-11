"use strict";

/*
 * Разбор блока на токены и длина хвоста элемента берутся у общего модуля —
 * литеральным `require`, по одному на модуль (У-89).
 *
 * Здесь стояло `split(/\s+/)`, и это было **четвёртое** объявление правила «где
 * кончается токен». У Field с форматом `YYYY-MM-DD hh:mm` внутри значения
 * пробел: граф видел `📅2026-09-07` и терял время. Отбор значения по панели
 * верит графу больше, чем образцу, — и в сессию TagWheel приезжала половина
 * даты, а вторая пропадала со строки (замечание заказчика 2026-09-07).
 *
 * Правило `tokenizeSegmentBody` завели по его же замечанию 2026-09-02, когда
 * новые теги вставали **между половинами** даты (двенадцатое исключение к З3).
 * Тогда его применили в одном месте из четырёх.
 */
const __rulesRuntimeHelpers = require("./pkm_rules_runtime_helpers.js");

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

/**
 * Метки правой части и хвост у каждой.
 *
 * Хвост — образец записи значения, выведенный из формата поля. Он собирается
 * здесь же, где и метки, и из тех же двух источников: иначе метка нашлась бы, а
 * длина её значения — нет, и токен снова резался бы по пробелу.
 */
function collectRightMarkers(rules) {
  var out = [];
  var byMarker = {};
  function push(marker, format) {
    var m = String(marker || "").trim();
    if (!m) return;
    var tail = String(__rulesRuntimeHelpers.elementTailPatternFromFormat(format) || "");
    if (!byMarker[m]) {
      byMarker[m] = { marker: m, tail: tail };
      out.push(byMarker[m]);
      return;
    }
    /* Метка уже известна, а хвост — ещё нет: второй источник его знает. */
    if (!byMarker[m].tail && tail) byMarker[m].tail = tail;
  }

  var rightFields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields)
    ? rules.rightMode.fields
    : [];
  var i;
  for (i = 0; i < rightFields.length; i++) {
    var field = rightFields[i];
    push(field && field.marker, field && field.format);
  }

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
    push(row.emoji, row.format);
    push(row.marker, row.format);
  }
  return out;
}

/** Карта «метка → хвост» в том виде, в каком её ждёт общий разборщик. */
function tailByMarkerOf(rightMarkers) {
  var out = {};
  var i;
  for (i = 0; i < rightMarkers.length; i++) {
    var row = rightMarkers[i];
    if (row && row.marker && row.tail) out[row.marker] = row.tail;
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
    var marker = String(rightMarkers[i] && rightMarkers[i].marker || "").trim();
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
  /* Токены, а не куски между пробелами: элемент, у которого в формате есть
     пробел, между пробелами не помещается (Т-14). */
  var parts = __rulesRuntimeHelpers.tokenizeSegmentBody(src, { tailByMarker: tailByMarkerOf(rightMarkers) });
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
