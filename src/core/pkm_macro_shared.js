"use strict";

function resolveSeparatorsOrThrow(rules) {
  const io = rules && typeof rules.io === "object" && !Array.isArray(rules.io) ? rules.io : null;
  const sep1 = io && io.separator1 != null ? String(io.separator1).trim() : "";
  const sep2 = io && io.separator2 != null ? String(io.separator2).trim() : "";
  if (!sep1 || !sep2) {
    throw new Error("pkm_macro_shared: rules.io.separator1 and rules.io.separator2 are required");
  }
  return { sep1, sep2 };
}

function normalizeCycleEndBehavior(v) {
  const s = String(v || "").trim().toLowerCase();
  if (
    s === "off"
    || s === "of"
    || s === "none"
    || s.includes("clear")
    || s.includes("empty")
  ) return "clear-prefix";
  if (s === "on" || s.includes("keep") || s.includes("bullet")) return "keep-bullet";
  return "keep-bullet";
}

function normalizeCursorPolicy(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "line_end" || s === "line-end") return "line_end";
  if (s === "current_position") return "current_position";
  return "text_end";
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function segmentHasToken(segText, token) {
  if (!token) return false;
  const rx = new RegExp(`(^|\\s)${escapeRegex(token)}(?=\\s|$)`);
  return rx.test(String(segText || ""));
}

function removeTokensFromSegment(segText, tokens) {
  let out = String(segText || "");
  for (const token of Array.isArray(tokens) ? tokens : []) {
    if (!token) continue;
    const rx = new RegExp(`(^|\\s)${escapeRegex(token)}(?=\\s|$)`, "g");
    out = out.replace(rx, " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

function removePatternFromSegment(segText, marker, valueRx) {
  const rx = new RegExp(`(^|\\s)${escapeRegex(marker)}${String(valueRx || "")}(?=\\s|$)`, "g");
  return String(segText || "").replace(rx, " ").replace(/\s+/g, " ").trim();
}

function firstTokenByPattern(segText, marker, valueRx) {
  const rx = new RegExp(`${escapeRegex(marker)}${String(valueRx || "")}`);
  const hit = String(segText || "").match(rx);
  return hit ? String(hit[0]) : "";
}

function remapCursorByLineDiff(oldLine, newLine, oldCh) {
  const before = String(oldLine || "");
  const after = String(newLine || "");
  const oldLen = before.length;
  const newLen = after.length;
  const ch = Math.max(0, Math.min(Number(oldCh || 0), oldLen));

  let pre = 0;
  while (pre < oldLen && pre < newLen && before[pre] === after[pre]) pre++;
  let oi = oldLen - 1;
  let ni = newLen - 1;
  while (oi >= pre && ni >= pre && before[oi] === after[ni]) {
    oi--;
    ni--;
  }
  const oldMidStart = pre;
  const oldMidEnd = oi + 1;
  const newMidEnd = ni + 1;

  let mapped;
  if (ch <= oldMidStart) mapped = ch;
  else if (ch >= oldMidEnd) mapped = ch + (newMidEnd - oldMidEnd);
  else mapped = newMidEnd;
  return Math.max(0, Math.min(mapped, newLen));
}

function remapCursorStable(oldLine, newLine, oldCh) {
  return remapCursorByLineDiff(oldLine, newLine, oldCh);
}

function isOrphanCheckboxBulletLine(line) {
  return /^\s*-\s+\[[^\]]\]\s*$/.test(String(line || ""));
}

function buildBulletOnlyLine(parsed, options) {
  const opts = options && typeof options === "object" ? options : {};
  const indent = String(parsed && parsed.indent ? parsed.indent : "");
  const keepParsedPrefix = !!opts.keepParsedPrefix;
  const keepCheckbox = opts.keepCheckbox === true;
  if (!keepParsedPrefix) return indent + "- ";
  const bullet = String(parsed && parsed.bulletToken ? parsed.bulletToken : "-").trim() || "-";
  const checkbox = String(parsed && parsed.checkboxToken ? parsed.checkboxToken : "").trim();
  if (!keepCheckbox) return `${indent}${bullet} `;
  return checkbox ? `${indent}${bullet} ${checkbox} ` : `${indent}${bullet} `;
}

function applyKeepBullet(editor, lineNo, parsed, options) {
  const bulletOnly = buildBulletOnlyLine(parsed, options);
  if (typeof editor.setLine === "function") {
    editor.setLine(lineNo, bulletOnly);
  } else {
    const curLine = String(editor.getLine(lineNo) || "");
    editor.replaceRange(bulletOnly, { line: lineNo, ch: 0 }, { line: lineNo, ch: curLine.length });
  }
  editor.setCursor({ line: lineNo, ch: bulletOnly.length });
  const ensure = () => {
    const curLine = String(editor.getLine(lineNo) || "");
    if (curLine === "-" || /^\s*-\s*$/.test(curLine)) {
      if (typeof editor.setLine === "function") editor.setLine(lineNo, bulletOnly);
      else editor.replaceRange(bulletOnly, { line: lineNo, ch: 0 }, { line: lineNo, ch: curLine.length });
    }
    editor.setCursor({ line: lineNo, ch: bulletOnly.length });
  };
  setTimeout(ensure, 0);
  setTimeout(ensure, 30);
}

function ensureTrailingSeparatorSpace(line, rules, parsed) {
  const p = parsed || {};
  const tags = Array.isArray(p.tags) ? p.tags : [];
  if (!tags.length) return line;
  if (String(p.text || "").trim()) return line;
  if (String(p.dates || "").trim()) return line;
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const trimmed = String(line || "").replace(/\s+$/, "");
  if (!trimmed.endsWith(sep1)) return line;
  return trimmed + " ";
}

function getCursorForPanel(finalLine, rules, panelName, options) {
  const opts = options && typeof options === "object" ? options : {};
  const line = String(finalLine || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const idx = line.indexOf(sep1);
  if (idx === -1) return line.length;
  if (panelName !== "right") return Math.min(line.length, idx + sep1.length + 1);

  const rightMode = String(opts.rightMode || "before_sep1").trim().toLowerCase();
  if (rightMode === "after_sep1") {
    return Math.min(line.length, idx + sep1.length + 1);
  }
  if (rightMode === "tag_slot") {
    if (sep1 === sep2) {
      const second = line.indexOf(sep2, idx + sep1.length);
      if (second !== -1) return Math.max(idx + sep1.length + 1, second - 1);
    }
    return idx > 0 && line.charAt(idx - 1) === " " ? (idx - 1) : idx;
  }
  return idx > 0 && line.charAt(idx - 1) === " " ? (idx - 1) : idx;
}

function getTextSlotBounds(lineInput, rules) {
  const line = String(lineInput || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const i1 = line.indexOf(sep1);
  if (i1 === -1) return null;
  let start = i1 + sep1.length;
  if (line.charAt(start) === " ") start += 1;
  let end = line.length;
  if (sep2 === sep1) {
    const i2 = line.indexOf(sep2, start);
    if (i2 !== -1) {
      end = i2;
      while (end > start && line.charAt(end - 1) === " ") end -= 1;
    }
  } else {
    const i2 = line.indexOf(sep2, start);
    if (i2 !== -1) {
      end = i2;
      while (end > start && line.charAt(end - 1) === " ") end -= 1;
    }
  }
  return { start, end: Math.max(start, end) };
}

function getCursorAtTextEnd(finalLine, rules) {
  const bounds = getTextSlotBounds(finalLine, rules);
  if (!bounds) return String(finalLine || "").length;
  const line = String(finalLine || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const i1 = line.indexOf(sep1);
  if (i1 !== -1) {
    const textStart = bounds.start;
    const i2 = sep2 === sep1 ? line.indexOf(sep2, textStart) : line.indexOf(sep2, textStart);
    if (i2 === -1) {
      const tail = String(line.slice(textStart) || "").trim();
      if (tail) {
        const markerList = Array.isArray(rules && rules.dates && rules.dates.markers)
          ? rules.dates.markers.map((x) => String(x || "").trim()).filter(Boolean)
          : [];
        const markerAlt = markerList.length ? markerList.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") : "(?!)";
        const markerRe = new RegExp("^(?:" + markerAlt + ")");
        const tokens = tail.split(/\s+/).filter(Boolean);
        const isRightPayload = tokens.length > 0 && tokens.every((t) => (
          /^#\S+$/.test(t)
          || /^\[\[[^\]]+\]\]$/.test(t)
          || markerRe.test(t)
          || /^\d{4}-\d{2}-\d{2}$/.test(t)
          || /^\d{2}:\d{2}$/.test(t)
        ));
        if (isRightPayload) {
          let leftEnd = i1;
          while (leftEnd > 0 && line[leftEnd - 1] === " ") leftEnd -= 1;
          return leftEnd;
        }
      }
    }
  }
  let ch = Math.max(bounds.start, bounds.end);
  while (ch > bounds.start && /\s/.test(line[ch - 1])) ch--;
  return ch;
}

function isBulletLikeEmptyResult(line, parsed) {
  const s = String(line || "").trim();
  if (/^[-*+]\s*$/.test(s)) return true;
  if (/^\d+\.\s*$/.test(s)) return true;
  if (/^[-*+]\s+\[[^\]]\]\s*$/.test(s)) return true;
  if (/^[-*+]\s*(\|\|\s*)*$/.test(s)) return true;
  if (/^\d+\.\s*(\|\|\s*)*$/.test(s)) return true;
  if (!parsed || parsed.headingToken) return false;
  const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
  if (tags.length) return false;
  if (String(parsed.text || "").trim()) return false;
  if (String(parsed.dates || "").trim()) return false;
  return /^[-*+\d]/.test(s);
}

function isNoContentParsed(parsed, options) {
  const opts = options && typeof options === "object" ? options : {};
  const includeTags = opts.includeTags !== false;
  if (!parsed || parsed.headingToken) return false;
  const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
  if (includeTags && tags.length) return false;
  if (String(parsed.text || "").trim()) return false;
  if (String(parsed.dates || "").trim()) return false;
  return true;
}

function hasListPrefix(line) {
  const body = String(line || "").replace(/^\s*/, "");
  return /^([-*+]|\d+[\.)])(\s|$)/.test(body);
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
  const next = String(nextLine || "");
  if (hasListPrefix(raw) || hasStandaloneCheckboxPrefix(raw)) {
    return reapplyOriginalPrefix(raw, next);
  }
  const rawIndent = (raw.match(/^(\s*)/) || ["", ""])[1];
  let body = String(next || "").replace(/^\s*/, "");
  body = body.replace(/^([-*+]|\d+[\.)])\s+/, "");
  body = body.replace(/^(\[[^\]]+\])\s+/, "");
  return rawIndent + body.trimStart();
}

module.exports = {
  resolveSeparatorsOrThrow,
  normalizeCycleEndBehavior,
  normalizeCursorPolicy,
  escapeRegex,
  segmentHasToken,
  removeTokensFromSegment,
  removePatternFromSegment,
  firstTokenByPattern,
  remapCursorByLineDiff,
  remapCursorStable,
  isOrphanCheckboxBulletLine,
  buildBulletOnlyLine,
  applyKeepBullet,
  ensureTrailingSeparatorSpace,
  getCursorForPanel,
  getTextSlotBounds,
  getCursorAtTextEnd,
  isBulletLikeEmptyResult,
  isNoContentParsed,
  hasListPrefix,
  hasStandaloneCheckboxPrefix,
  extractOriginalPrefix,
  reapplyOriginalPrefix,
  preserveOriginalPrefixShape,
};
