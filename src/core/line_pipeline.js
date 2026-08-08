"use strict";

function resolveSeparatorsOrThrow(rules) {
  var io = rules && typeof rules.io === "object" && !Array.isArray(rules.io) ? rules.io : null;
  var sep1 = io && io.separator1 != null ? String(io.separator1).trim() : "";
  var sep2 = io && io.separator2 != null ? String(io.separator2).trim() : "";
  if (!sep1 || !sep2) {
    throw new Error("line_pipeline: rules.io.separator1 and rules.io.separator2 are required");
  }
  return { sep1: sep1, sep2: sep2 };
}

function getRightMarkers(rules) {
  const out = [];
  const seen = new Set();
  const behavior = rules && typeof rules.behavior === "object" && !Array.isArray(rules.behavior)
    ? rules.behavior
    : {};
  const dateRuntimeCfg = behavior && typeof behavior.dateRuntimeConfig === "object" && !Array.isArray(behavior.dateRuntimeConfig)
    ? behavior.dateRuntimeConfig
    : {};
  const byField = dateRuntimeCfg && typeof dateRuntimeCfg.byField === "object" && !Array.isArray(dateRuntimeCfg.byField)
    ? dateRuntimeCfg.byField
    : {};
  const canonical = dateRuntimeCfg && typeof dateRuntimeCfg.canonical === "object" && !Array.isArray(dateRuntimeCfg.canonical)
    ? dateRuntimeCfg.canonical
    : {};
  const fields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields)
    ? rules.rightMode.fields
    : [];
  function pushMarker(raw) {
    const mk = String(raw || "").trim();
    if (!mk || seen.has(mk)) return;
    seen.add(mk);
    out.push(mk);
  }
  function markerFromRuntimeCfg(field) {
    const keys = [];
    function pushKey(raw) {
      const key = String(raw || "").trim();
      if (!key || keys.indexOf(key) !== -1) return;
      keys.push(key);
    }
    const fieldId = String(field && field.id || "").trim();
    const orderKey = String(field && field.orderKey || "").trim();
    pushKey(orderKey);
    pushKey(fieldId);
    for (const cKey of Object.keys(canonical)) {
      const cVal = String(canonical[cKey] || "").trim();
      if (!cVal) continue;
      if (cVal === fieldId || cVal === orderKey) {
        pushKey(cKey);
        pushKey(cVal);
      }
    }
    for (let i = 0; i < keys.length; i++) {
      const row = byField && byField[keys[i]] && typeof byField[keys[i]] === "object" ? byField[keys[i]] : null;
      if (!row) continue;
      const marker = String(row.emoji || row.marker || "").trim();
      if (marker) return marker;
    }
    return "";
  }
  for (const f of fields) {
    const mk = String(f && f.marker ? f.marker : "").trim() || markerFromRuntimeCfg(f);
    pushMarker(mk);
  }
  return out;
}

function startsWithAnyMarker(token, markers) {
  const t = String(token || "");
  if (!t) return false;
  for (const mk of markers) {
    if (!mk) continue;
    if (t.startsWith(mk) && t.length > mk.length) return true;
  }
  return false;
}

function isDateLikeBareToken(token) {
  const t = String(token || "");
  if (!t) return false;
  return /^\d{4}-\d{2}(?:-\d{2})?(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(t)
    || /^\d{2}:\d{2}(?::\d{2})?$/.test(t);
}

function isLikelyRightPayloadToken(token, markers) {
  const t = String(token || "");
  if (!t) return false;
  if (/^#\S+$/.test(t)) return true;
  if (/^\[\[[^\]]+\]\]$/.test(t)) return true;
  if (startsWithAnyMarker(t, markers)) return true;
  if (isDateLikeBareToken(t)) return true;
  return false;
}

function isLikelyDatePayloadContinuationToken(token) {
  const t = String(token || "");
  if (!t) return false;
  if (/^\d{2}[-:]\d{2}(?:[-:]\d{2})?$/.test(t)) return true;
  if (/^\d{2}$/.test(t)) return true;
  return false;
}

function stripListPrefixForBody(rawLeft) {
  var left = String(rawLeft || "").trim();
  left = left.replace(/^\s*(?:[-*+]|\d+[\.)])(?:\s+|$)/, "");
  left = left.replace(/^\s*\[[^\]]+\](?:\s+|$)/, "");
  return left.trim();
}

function isPlainTextSegmentToken(token) {
  var t = String(token || "").trim();
  if (!t) return false;
  if (/^#\S+$/.test(t)) return false;
  if (/^\[\[[^\]]+\]\]$/.test(t)) return false;
  return true;
}

function hasRightPayloadInvariantShape(dates, markers) {
  var payload = String(dates || "").trim();
  if (!payload) return false;
  var parts = payload.split(/\s+/).filter(Boolean);
  if (!parts.length) return false;
  if (startsWithAnyMarker(parts[0], markers)) return true;
  return parts.every(function(tok) {
    return isDateLikeBareToken(tok) || isLikelyDatePayloadContinuationToken(tok);
  });
}

function collapseDuplicateTextForRightPayload(seg, markers) {
  var left = String(seg && seg.left ? seg.left : "").trim();
  var text = String(seg && seg.text ? seg.text : "").trim();
  var dates = String(seg && seg.dates ? seg.dates : "").trim();
  if (!left || !text || !dates) return text;
  if (!hasRightPayloadInvariantShape(dates, markers)) return text;
  var textTokens = text.split(/\s+/).filter(Boolean);
  if (!textTokens.length) return text;
  if (!textTokens.every(isPlainTextSegmentToken)) return text;
  var leftBody = stripListPrefixForBody(left);
  if (!leftBody) return text;
  var leftTokens = leftBody.split(/\s+/).filter(Boolean);
  if (leftTokens.length < textTokens.length) return text;
  var leftTail = leftTokens.slice(leftTokens.length - textTokens.length).join(" ");
  if (leftTail !== text) return text;
  return "";
}

function isMarkerAnchoredDatePayloadTokens(tokens, markers) {
  const list = Array.isArray(tokens) ? tokens : [];
  if (!list.length) return false;
  const first = String(list[0] || "");
  if (!startsWithAnyMarker(first, markers)) return false;
  if (list.length === 1) return true;
  for (let i = 1; i < list.length; i++) {
    const t = String(list[i] || "");
    if (!isLikelyDatePayloadContinuationToken(t)) return false;
  }
  return true;
}

function splitSegments(rawLine, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const raw = String(rawLine || "");
  const indent = (raw.match(/^(\s*)/) || ["", ""])[1];
  const s = raw.trim();
  const markers = getRightMarkers(rules);

  if (sep1 === sep2) {
    const parts = s.split(sep1).map(function(x) { return String(x || "").trim(); });
    if (parts.length <= 1) return { indent: indent, left: s, text: "", dates: "" };
    if (parts.length === 2) {
      let textOnly = parts[1] || "";
      let rightOnly = "";
      if (textOnly) {
        const tokens = textOnly.split(/\s+/).filter(Boolean);
        const isRightPayload = (tokens.length > 0
          && tokens.every(function(t) {
            return isLikelyRightPayloadToken(t, markers);
          }))
          || isMarkerAnchoredDatePayloadTokens(tokens, markers);
        if (isRightPayload) {
          rightOnly = textOnly;
          textOnly = "";
        }
      }
      return { indent: indent, left: parts[0] || "", text: textOnly, dates: rightOnly };
    }
    return {
      indent: indent,
      left: parts[0] || "",
      text: parts[1] || "",
      dates: parts.slice(2).join(" ").trim(),
    };
  }

  const i1 = s.indexOf(sep1);
  const left = i1 === -1 ? s : s.slice(0, i1).trim();
  const after1 = i1 === -1 ? "" : s.slice(i1 + sep1.length).trim();
  const i2 = after1.indexOf(sep2);
  let text = i2 === -1 ? after1.trim() : after1.slice(0, i2).trim();
  let dates = i2 === -1 ? "" : after1.slice(i2 + sep2.length).trim();

  if (i2 === -1 && text) {
    const parts = text.split(/\s+/).filter(Boolean);
    const isRightPayload = (parts.length > 0
      && parts.every(function(t) {
        return isLikelyRightPayloadToken(t, markers);
      }))
      || isMarkerAnchoredDatePayloadTokens(parts, markers);
    if (isRightPayload) {
      dates = text;
      text = "";
    }
  }

  return { indent: indent, left: left, text: text, dates: dates };
}

function buildFromSegments(seg, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const indent = String(seg && seg.indent ? seg.indent : "");
  let left = String(seg && seg.left ? seg.left : "").trim();
  let text = String(seg && seg.text ? seg.text : "").trim();
  const dates = String(seg && seg.dates ? seg.dates : "").trim();
  const markers = getRightMarkers(rules);

  if (!left) left = "-";
  const leftTokens = left.split(/\s+/).filter(Boolean);
  const hasLeftTech = /(^|\s)(#\S+|\[\[[^\]]+\]\])/.test(left)
    || leftTokens.some(function(t) { return startsWithAnyMarker(t, markers); });
  const hasListPrefix = /^(-|\*|\+)(\s|$)|^\d+\.(?:\s|$)/.test(left);
  if (hasLeftTech && !hasListPrefix) {
    left = ("- " + left).trim();
  }

  if (dates) {
    text = collapseDuplicateTextForRightPayload({ left: left, text: text, dates: dates }, markers);
  }

  if (dates && text) {
    if (hasLeftTech) return indent + left + " " + sep1 + " " + text + " " + sep2 + " " + dates;
    return indent + left + " " + text + " " + sep1 + " " + dates;
  }
  if (dates) {
    if (hasLeftTech) {
      if (sep1 === sep2) return indent + left + " " + sep1 + "  " + sep2 + " " + dates;
      return indent + left + " " + sep1 + " " + sep2 + " " + dates;
    }
    if (/^[-*+]\s+\[[^\]]\]$/.test(left)) return indent + left + "  " + sep1 + " " + dates;
    if (left === "-") return indent + left + "  " + sep1 + " " + dates;
    return indent + left + " " + sep1 + " " + dates;
  }
  if (text) {
    if (hasLeftTech) return indent + left + " " + sep1 + " " + text;
    return indent + left + " " + text;
  }
  return hasLeftTech ? (indent + left + " " + sep1 + " ") : (indent + left);
}

function splitLeftPrefix(raw) {
  var src = String(raw || "").trim();
  var m = src.match(/^((?:[-*+]|\d+\.)(?:\s+\[[^\]]+\])?)(?:\s+|$)(.*)$/);
  if (!m) return { prefix: "", body: src };
  return { prefix: String(m[1] || "").trim(), body: String(m[2] || "").trim() };
}

function joinLeftPrefix(prefix, body) {
  var p = String(prefix || "").trim();
  var b = String(body || "").trim();
  if (p && b) return p + " " + b;
  if (p) return p;
  return b;
}

function stripPrefixKeepIndent(line, removeCheckbox) {
  const s = String(line || "");
  const indent = (s.match(/^(\s*)/) || ["", ""])[1];
  let body = s.slice(indent.length);
  body = body.replace(/^[-*+](?:\s+|$)/, "");
  body = body.replace(/^\d+\.(?:\s+|$)/, "");
  if (removeCheckbox) body = body.replace(/^\[[^\]]\]\s+/, "");
  return indent + body;
}

function escapeRx(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function enforceTextSegmentForLeftTag(line, rules, originalText) {
  const textRaw = String(originalText || "").trim();
  if (!textRaw) return String(line || "");
  const seg = splitSegments(line, rules);
  let left = seg.left;
  let text = seg.text;
  let dates = seg.dates;
  const esc = escapeRx(textRaw);
  const rxWhole = new RegExp("(^|\\s)" + esc + "(?=\\s|$)", "g");
  left = String(left || "").replace(rxWhole, " ").replace(/\s+/g, " ").trim();
  text = String(text || "").replace(rxWhole, " ").replace(/\s+/g, " ").trim();
  dates = String(dates || "").replace(rxWhole, " ").replace(/\s+/g, " ").trim();
  text = textRaw;
  return buildFromSegments({ indent: seg.indent, left: left, text: text, dates: dates }, rules);
}

function extractOriginalTextFromRawLine(rawLine, rules) {
  const seg = splitSegments(rawLine, rules);
  if (String(seg.text || "").trim()) return String(seg.text || "").trim();
  let left = String(seg.left || "").trim();
  left = left.replace(/^\s*[-*+](?:\s+|$)/, "");
  left = left.replace(/^\s*\d+\.(?:\s+|$)/, "");
  left = left.replace(/^\[[^\]]\](?:\s+|$)/, "");
  const markers = getRightMarkers(rules);
  while (true) {
    const mTag = left.match(/^(#\S+)\s*/);
    if (mTag) { left = left.slice(mTag[0].length).trim(); continue; }
    const mWiki = left.match(/^(\[\[[^\]]+\]\])\s*/);
    if (mWiki) { left = left.slice(mWiki[0].length).trim(); continue; }
    let consumedMarker = false;
    for (const mk of markers) {
      const rx = new RegExp("^(" + escapeRx(mk) + "\\S+)\\s*");
      const mDate = left.match(rx);
      if (!mDate) continue;
      left = left.slice(mDate[0].length).trim();
      consumedMarker = true;
      break;
    }
    if (consumedMarker) continue;
    const mDateLike = left.match(/^(\d{4}-\d{2}(?:-\d{2})?(?:[ T]\d{2}:\d{2}(?::\d{2})?)?|\d{2}:\d{2}(?::\d{2})?)\s*/);
    if (mDateLike) { left = left.slice(mDateLike[0].length).trim(); continue; }
    break;
  }
  left = left.trim();
  if (left === "-") return "";
  return left;
}

function relocateMarkerTokenByPanel(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var marker = String(opts.marker || "").trim();
  var targetPanel = String(opts.targetPanel || "right").trim().toLowerCase() === "left" ? "left" : "right";
  if (!marker) return line;
  var removeMarkerTokens = typeof opts.removeMarkerTokens === "function" ? opts.removeMarkerTokens : null;
  var takeFirstToken = typeof opts.takeFirstToken === "function" ? opts.takeFirstToken : null;
  if (!removeMarkerTokens) throw new Error("line_pipeline relocateMarkerTokenByPanel: removeMarkerTokens required");
  if (!takeFirstToken) throw new Error("line_pipeline relocateMarkerTokenByPanel: takeFirstToken required");

  var seg = splitSegments(line, rules);
  var indent = String(seg.indent || "");
  var left = String(seg.left || "");
  var text = String(seg.text || "");
  var dates = String(seg.dates || "");

  var canFallback = opts.useFallbackFromLine !== false;
  var hasOverride = Object.prototype.hasOwnProperty.call(opts, "tokenOverride");
  var token = hasOverride ? String(opts.tokenOverride || "") : "";
  if (!token && canFallback && !hasOverride) {
    token =
      String(takeFirstToken(left, marker) || "")
      || String(takeFirstToken(text, marker) || "")
      || String(takeFirstToken(dates, marker) || "");
  }

  left = String(removeMarkerTokens(left, marker) || "").trim();
  text = String(removeMarkerTokens(text, marker) || "").trim();
  dates = String(removeMarkerTokens(dates, marker) || "").trim();
  if (!left) left = "-";

  if (token) {
    if (targetPanel === "left") left = left === "-" ? `- ${token}` : `${left} ${token}`.trim();
    else dates = dates ? `${token} ${dates}` : token;
  }

  return buildFromSegments({ indent: indent, left: left, text: text, dates: dates }, rules);
}

function clearMarkerFromLine(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var marker = String(opts.marker || "").trim();
  if (!marker) return line;
  var removeMarkerTokens = typeof opts.removeMarkerTokens === "function" ? opts.removeMarkerTokens : null;
  if (!removeMarkerTokens) throw new Error("line_pipeline clearMarkerFromLine: removeMarkerTokens required");
  var seg = splitSegments(line, rules);
  return buildFromSegments({
    indent: String(seg.indent || ""),
    left: String(removeMarkerTokens(seg.left, marker) || "").trim(),
    text: String(removeMarkerTokens(seg.text, marker) || "").trim(),
    dates: String(removeMarkerTokens(seg.dates, marker) || "").trim(),
  }, rules);
}

function clearMarkersFromLine(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var markers = Array.isArray(opts.markers) ? opts.markers : [];
  var out = line;
  var uniq = [];
  var seen = {};
  var i;
  for (i = 0; i < markers.length; i++) {
    var mk = String(markers[i] || "").trim();
    if (!mk || seen[mk]) continue;
    seen[mk] = true;
    uniq.push(mk);
  }
  for (i = 0; i < uniq.length; i++) {
    out = clearMarkerFromLine({
      line: out,
      rules: opts.rules,
      marker: uniq[i],
      removeMarkerTokens: opts.removeMarkerTokens,
    });
  }
  return out;
}

function removeExactTokens(text, tokens) {
  var out = String(text || "");
  var list = Array.isArray(tokens) ? tokens : [];
  var i;
  for (i = 0; i < list.length; i++) {
    var tok = String(list[i] || "").trim();
    if (!tok) continue;
    var rx = new RegExp("(^|\\s)" + escapeRx(tok) + "(?=\\s|$)", "g");
    out = out.replace(rx, " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

function detectMarkerPanel(options) {
  var opts = options && typeof options === "object" ? options : {};
  var rawLine = String(opts.line || "");
  var rules = opts.rules;
  var marker = String(opts.marker || "").trim();
  if (!marker) return "none";
  var seg = splitSegments(rawLine, rules);
  var leftPart = String(seg && seg.left ? seg.left : "");
  var rightPart = [String(seg && seg.text ? seg.text : "").trim(), String(seg && seg.dates ? seg.dates : "").trim()]
    .filter(Boolean)
    .join(" ");
  var rx = new RegExp(escapeRx(marker) + "(?:[^\\s]+)?");
  var hasLeft = rx.test(leftPart);
  var hasRight = rx.test(rightPart);
  if (hasLeft && hasRight) return "both";
  if (hasLeft) return "left";
  if (hasRight) return "right";
  return "none";
}

function resolvePanelByMarkerPresence(options) {
  var opts = options && typeof options === "object" ? options : {};
  var panelByOrder = String(opts.panelByOrder || "right").trim().toLowerCase() === "left" ? "left" : "right";
  return panelByOrder;
}

function getPanelSearchText(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var panel = String(opts.panel || "left").trim().toLowerCase() === "right" ? "right" : "left";
  var seg = splitSegments(line, rules);
  if (panel === "left") return String(seg && seg.left ? seg.left : "");
  return [String(seg && seg.text ? seg.text : "").trim(), String(seg && seg.dates ? seg.dates : "").trim()]
    .filter(Boolean)
    .join(" ");
}

function removeDateTimeMarkers(options) {
  var opts = options && typeof options === "object" ? options : {};
  var text = String(opts.text || "");
  var markers = Array.isArray(opts.markers) ? opts.markers : [];
  var dateIso = String(opts.dateIso || "\\d{4}-\\d{2}-\\d{2}");
  var timeHm = String(opts.timeHm || "\\d{2}:\\d{2}");
  var out = text;
  var i;
  for (i = 0; i < markers.length; i++) {
    var mk = String(markers[i] || "").trim();
    if (!mk) continue;
    var rx = new RegExp("(^|\\s)" + escapeRx(mk) + "(?:" + dateIso + "|" + timeHm + "|[^\\s]+)(?=\\s|$)", "g");
    out = out.replace(rx, " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

function collectDateLikeMarkersFromRules(options) {
  var opts = options && typeof options === "object" ? options : {};
  var rules = opts.rules;
  var fields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : [];
  var kinds = Array.isArray(opts.kinds) ? opts.kinds.map(function(k) { return String(k || "").trim(); }) : [];
  var allowed = {};
  var i;
  for (i = 0; i < kinds.length; i++) {
    var kk = kinds[i];
    if (!kk) continue;
    allowed[kk] = true;
  }
  var out = [];
  var seen = {};
  for (i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (!f) continue;
    var marker = String(f.marker || "").trim();
    if (!marker || seen[marker]) continue;
    if (kinds.length) {
      var kind = String(f.kind || "").trim();
      if (!allowed[kind]) continue;
    }
    seen[marker] = true;
    out.push(marker);
  }
  if (out.length) return out;
  var fallback = Array.isArray(opts.defaultMarkers)
    ? opts.defaultMarkers.map(function(m) { return String(m || "").trim(); }).filter(Boolean)
    : [];
  return fallback;
}

function removeTokensAcrossSegments(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var tokens = Array.isArray(opts.tokens) ? opts.tokens : [];
  if (!tokens.length) return line;
  var seg = splitSegments(line, rules);
  var leftParts = splitLeftPrefix(seg.left);
  var leftBody = removeExactTokens(leftParts.body, tokens);
  var text = removeExactTokens(seg.text, tokens);
  var dates = removeExactTokens(seg.dates, tokens);
  return buildFromSegments({
    indent: seg.indent,
    left: joinLeftPrefix(leftParts.prefix, leftBody),
    text: text,
    dates: dates,
  }, rules);
}

function normalizeRightPayloadTailToDates(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var seg = splitSegments(line, rules);
  var leftParts = splitLeftPrefix(seg.left);
  var body = String(leftParts.body || "").trim();
  if (!body) return line;
  var tokens = body.split(/\s+/).filter(Boolean);
  if (!tokens.length) return line;
  var markers = getRightMarkers(rules);
  var cut = tokens.length;
  while (cut > 0) {
    var tok = String(tokens[cut - 1] || "").trim();
    var isDateTail = startsWithAnyMarker(tok, markers) || isDateLikeBareToken(tok);
    if (!isDateTail) break;
    cut -= 1;
  }
  if (cut === tokens.length) return line;
  if (cut === 0 && !String(leftParts.prefix || "").trim()) return line;

  var leftKeep = tokens.slice(0, cut).join(" ").trim();
  var tail = tokens.slice(cut).join(" ").trim();
  if (!tail) return line;

  var nextLeft = joinLeftPrefix(leftParts.prefix, leftKeep);
  var nextDates = [tail, String(seg.dates || "").trim()].filter(Boolean).join(" ").trim();
  if (!String(nextLeft || "").trim()) return line;
  return buildFromSegments({
    indent: seg.indent,
    left: nextLeft,
    text: seg.text,
    dates: nextDates,
  }, rules);
}

function cleanOriginalTextForLeftDate(options) {
  var opts = options && typeof options === "object" ? options : {};
  var rawLine = String(opts.rawLine || "");
  var rules = opts.rules;
  var parsedText = String(opts.parsedText || "");
  var isDateLikeToken = typeof opts.isDateLikeToken === "function"
    ? opts.isDateLikeToken
    : function defaultIsDateLikeToken(token) {
      var t = String(token || "");
      return /^\d{4}-\d{2}(?:-\d{2})?(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(t)
        || /^\d{2}:\d{2}(?::\d{2})?$/.test(t);
    };
  var dateIso = String(opts.dateIso || "\\d{4}-\\d{2}-\\d{2}");
  var timeHm = String(opts.timeHm || "\\d{2}:\\d{2}");
  var kinds = Array.isArray(opts.kinds) ? opts.kinds : ["dateOffset", "nowTime", "estimatedCycle", "genericElement"];
  var defaultMarkers = Array.isArray(opts.defaultMarkers) ? opts.defaultMarkers : [];

  var segRaw = splitSegments(rawLine, rules);
  var out = String(segRaw && segRaw.text ? segRaw.text : "").trim();
  if (!out) {
    var left = String(segRaw && segRaw.left ? segRaw.left : "").trim();
    left = left.replace(/^\s*[-*+](?:\s+|$)/, "");
    left = left.replace(/^\s*\d+\.\s+/, "");
    left = left.replace(/^\[[^\]]\](?:\s+|$)/, "");
    while (true) {
      var mTag = left.match(/^(#\S+)\s*/);
      if (mTag) { left = left.slice(mTag[0].length).trim(); continue; }
      var mWiki = left.match(/^(\[\[[^\]]+\]\])\s*/);
      if (mWiki) { left = left.slice(mWiki[0].length).trim(); continue; }
      var firstToken = String(left || "").split(/\s+/).filter(Boolean)[0] || "";
      if (isDateLikeToken(firstToken)) { left = left.slice(firstToken.length).trim(); continue; }
      break;
    }
    out = left.trim();
    if (!out || out === "-") return "";
  }

  var rightTokens = String(segRaw && segRaw.dates ? segRaw.dates : "").split(/\s+/).filter(Boolean);
  out = removeExactTokens(out, rightTokens);
  var markers = collectDateLikeMarkersFromRules({
    rules: rules,
    kinds: kinds,
    defaultMarkers: defaultMarkers,
  });
  out = removeDateTimeMarkers({
    text: out,
    markers: markers,
    dateIso: dateIso,
    timeHm: timeHm,
  });
  if (!parsedText) return out;
  return out;
}

function relocateTokenSetByPanel(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var targetPanel = String(opts.targetPanel || "left").trim().toLowerCase() === "right" ? "right" : "left";
  var selectedToken = String(opts.selectedToken || "").trim();
  var allTokens = Array.isArray(opts.allTokens) ? opts.allTokens.map(function(t) { return String(t || "").trim(); }).filter(Boolean) : [];
  var stripTokens = typeof opts.stripTokens === "function" ? opts.stripTokens : null;
  var removeCombinedByParentToken = typeof opts.removeCombinedByParentToken === "function"
    ? opts.removeCombinedByParentToken
    : null;
  var rightToText = opts.rightToText === true;
  if (!stripTokens) throw new Error("line_pipeline relocateTokenSetByPanel: stripTokens required");
  var reorderLeft = typeof opts.reorderLeft === "function" ? opts.reorderLeft : function passthrough(v) { return String(v || "").trim(); };
  var reorderRight = typeof opts.reorderRight === "function" ? opts.reorderRight : function passthrough(v) { return String(v || "").trim(); };

  var seg = splitSegments(line, rules);
  var leftParts = splitLeftPrefix(seg.left);
  var leftBody = stripTokens(leftParts.body, allTokens);
  var text = stripTokens(seg.text, allTokens);
  var dates = stripTokens(seg.dates, allTokens);

  if (selectedToken && selectedToken.indexOf("/") !== -1 && removeCombinedByParentToken) {
    var parentTok = String(selectedToken).split("/")[0];
    leftBody = removeCombinedByParentToken(leftBody, parentTok);
    text = removeCombinedByParentToken(text, parentTok);
    dates = removeCombinedByParentToken(dates, parentTok);
  }

  if (selectedToken) {
    if (targetPanel === "right") {
      if (rightToText) text = text ? (text + " " + selectedToken) : selectedToken;
      else dates = dates ? (dates + " " + selectedToken) : selectedToken;
    }
    else leftBody = leftBody ? (leftBody + " " + selectedToken) : selectedToken;
  }

  var orderedLeft = reorderLeft(leftBody);
  var orderedRight = reorderRight(dates);
  return buildFromSegments({
    indent: seg.indent,
    left: joinLeftPrefix(leftParts.prefix, orderedLeft),
    text: text,
    dates: orderedRight,
  }, rules);
}

function relocateMarkerSetByFieldOrder(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var fields = Array.isArray(opts.fields) ? opts.fields : [];
  var getOrderKey = typeof opts.getOrderKey === "function" ? opts.getOrderKey : null;
  var getPanelForKey = typeof opts.getPanelForKey === "function" ? opts.getPanelForKey : null;
  var getValueRx = typeof opts.getValueRx === "function" ? opts.getValueRx : null;
  var removeMarkerTokens = typeof opts.removeMarkerTokens === "function" ? opts.removeMarkerTokens : null;
  var takeFirstToken = typeof opts.takeFirstToken === "function" ? opts.takeFirstToken : null;
  if (!getOrderKey) throw new Error("line_pipeline relocateMarkerSetByFieldOrder: getOrderKey required");
  if (!getPanelForKey) throw new Error("line_pipeline relocateMarkerSetByFieldOrder: getPanelForKey required");
  if (!getValueRx) throw new Error("line_pipeline relocateMarkerSetByFieldOrder: getValueRx required");
  if (!removeMarkerTokens) throw new Error("line_pipeline relocateMarkerSetByFieldOrder: removeMarkerTokens required");
  if (!takeFirstToken) throw new Error("line_pipeline relocateMarkerSetByFieldOrder: takeFirstToken required");

  var out = line;
  var seen = {};
  var i;
  for (i = 0; i < fields.length; i++) {
    var field = fields[i];
    if (!field || !field.marker) continue;
    var marker = String(field.marker || "").trim();
    if (!marker) continue;
    var key = String(getOrderKey(field) || "").trim();
    if (!key) continue;
    var dedup = key + "::" + marker;
    if (seen[dedup]) continue;
    seen[dedup] = true;
    var valueRx = String(getValueRx(field) || "").trim();
    if (!valueRx) continue;
    var panel = String(getPanelForKey(key) || "right").trim().toLowerCase() === "left" ? "left" : "right";
    out = relocateMarkerTokenByPanel({
      line: out,
      rules: rules,
      marker: marker,
      targetPanel: panel,
      removeMarkerTokens: function(segLine, mk) {
        return removeMarkerTokens(segLine, mk, valueRx);
      },
      takeFirstToken: function(segLine, mk) {
        return takeFirstToken(segLine, mk, valueRx);
      },
    });
  }
  return out;
}

function removeCombinedByParentTokens(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var parentTokens = Array.isArray(opts.parentTokens)
    ? opts.parentTokens.map(function(t) { return String(t || "").trim(); }).filter(Boolean)
    : [];
  if (!parentTokens.length) return line;

  var seg = splitSegments(line, rules);
  var leftParts = splitLeftPrefix(seg.left);

  function stripCombined(src) {
    var out = String(src || "");
    var i;
    for (i = 0; i < parentTokens.length; i++) {
      var p = parentTokens[i];
      if (!p) continue;
      var rx = new RegExp("(^|\\s)" + escapeRx(p) + "\\/\\S+(?=\\s|$)", "g");
      out = out.replace(rx, " ");
    }
    return out.replace(/\s+/g, " ").trim();
  }

  seg.left = joinLeftPrefix(leftParts.prefix, stripCombined(leftParts.body));
  seg.text = stripCombined(seg.text);
  seg.dates = stripCombined(seg.dates);
  return buildFromSegments(seg, rules);
}

module.exports = {
  splitSegments,
  buildFromSegments,
  splitLeftPrefix,
  joinLeftPrefix,
  stripPrefixKeepIndent,
  enforceTextSegmentForLeftTag,
  extractOriginalTextFromRawLine,
  relocateMarkerTokenByPanel,
  clearMarkerFromLine,
  clearMarkersFromLine,
  removeExactTokens,
  detectMarkerPanel,
  resolvePanelByMarkerPresence,
  getPanelSearchText,
  removeDateTimeMarkers,
  collectDateLikeMarkersFromRules,
  removeTokensAcrossSegments,
  normalizeRightPayloadTailToDates,
  cleanOriginalTextForLeftDate,
  relocateTokenSetByPanel,
  relocateMarkerSetByFieldOrder,
  removeCombinedByParentTokens,
};
