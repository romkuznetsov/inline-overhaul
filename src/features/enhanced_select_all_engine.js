"use strict";

/*
 * Формы начала строки берутся из `src/core/shared_utils.js` — одним
 * объявлением на весь плагин. Своя копия стояла здесь до 2026-09-08, и вместе
 * с копией в `smart_delete_engine.js` они успели разойтись трижды (У-32):
 * знак чекбокса, чекбокс у номера списка и номер со скобкой (`1)`). Разбор —
 * в объяснении самого правила.
 */
const __sharedUtils = require("../core/shared_utils.js");

function isHeaderLineText(text) {
  return /^(#{1,6})\s/.test(String(text || ""));
}

function headerLevelOfText(text) {
  const m = String(text || "").match(/^(#{1,6})\s/);
  return m ? m[1].length : 0;
}

function lineIndentOfText(text) {
  return __sharedUtils.lineIndentLength(text);
}

function isListItemLineText(text) {
  return __sharedUtils.isListItemLine(text);
}

function normPos(a, b) {
  if (a.line < b.line) return { from: a, to: b };
  if (a.line > b.line) return { from: b, to: a };
  if (a.ch <= b.ch) return { from: a, to: b };
  return { from: b, to: a };
}

function rangeEq(r1, r2) {
  if (!r1 || !r2) return false;
  return r1.from.line === r2.from.line && r1.from.ch === r2.from.ch && r1.to.line === r2.to.line && r1.to.ch === r2.to.ch;
}

function lineLen(editor, line) {
  return String(editor.getLine(line) || "").length;
}

function makeLineRange(editor, startLine, endLine) {
  const last = editor.lastLine();
  const s = Math.max(0, Math.min(startLine, endLine, last));
  const e = Math.max(0, Math.min(Math.max(startLine, endLine), last));
  return normPos({ line: s, ch: 0 }, { line: e, ch: lineLen(editor, e) });
}

function getSelectionRange(editor) {
  return normPos(editor.getCursor("from"), editor.getCursor("to"));
}

function selectRange(editor, range) {
  editor.setSelection(range.from, range.to);
}

function wholeNoteRange(editor) {
  const last = editor.lastLine();
  return normPos({ line: 0, ch: 0 }, { line: last, ch: lineLen(editor, last) });
}

function currentLineRange(editor, lineNo) {
  const line = Math.max(0, Math.min(lineNo, editor.lastLine()));
  return normPos({ line, ch: 0 }, { line, ch: lineLen(editor, line) });
}

function findPrevHeaderLine(editor, fromLine) {
  for (let l = Math.min(fromLine, editor.lastLine()); l >= 0; l--) {
    if (isHeaderLineText(editor.getLine(l))) return l;
  }
  return -1;
}

function headerSectionRange(editor, curLine) {
  const h = findPrevHeaderLine(editor, curLine);
  if (h === -1) return null;
  const level = headerLevelOfText(editor.getLine(h));
  let end = editor.lastLine();
  for (let l = h + 1; l <= editor.lastLine(); l++) {
    const t = String(editor.getLine(l) || "");
    if (isHeaderLineText(t) && headerLevelOfText(t) <= level) {
      end = l - 1;
      break;
    }
  }
  if (end < h) end = h;
  return makeLineRange(editor, h, end);
}

function findNearestListItemLine(editor, fromLine) {
  for (let l = fromLine; l >= 0; l--) {
    const t = String(editor.getLine(l) || "");
    if (isHeaderLineText(t) && l < fromLine) break;
    if (isListItemLineText(t)) return l;
  }
  return -1;
}

function findTopParentListItemLine(editor, lineNo) {
  let top = lineNo;
  let topIndent = lineIndentOfText(editor.getLine(top));
  while (true) {
    let found = -1;
    for (let l = top - 1; l >= 0; l--) {
      const t = String(editor.getLine(l) || "");
      if (isHeaderLineText(t)) break;
      if (!isListItemLineText(t)) continue;
      const ind = lineIndentOfText(t);
      if (ind < topIndent) {
        found = l;
        topIndent = ind;
        break;
      }
    }
    if (found === -1) break;
    top = found;
  }
  return top;
}

function findSubtreeEndLine(editor, topLine) {
  const topIndent = lineIndentOfText(editor.getLine(topLine));
  let end = topLine;
  for (let l = topLine + 1; l <= editor.lastLine(); l++) {
    const t = String(editor.getLine(l) || "");
    if (isHeaderLineText(t)) break;
    if (t.trim() === "") {
      end = l;
      continue;
    }
    if (isListItemLineText(t) && lineIndentOfText(t) <= topIndent) break;
    end = l;
  }
  return end;
}

function treeScopeRange(editor, curLine) {
  const anchor = findNearestListItemLine(editor, curLine);
  if (anchor === -1) return null;
  const top = findTopParentListItemLine(editor, anchor);
  const end = findSubtreeEndLine(editor, top);
  return makeLineRange(editor, top, end);
}

function buildSelectAllSequence(editor, mode, contextLine) {
  const seq = [];
  const pushUnique = (r) => {
    if (!r) return;
    if (seq.length && rangeEq(seq[seq.length - 1], r)) return;
    seq.push(r);
  };

  const line = currentLineRange(editor, contextLine);
  const tree = treeScopeRange(editor, contextLine);
  const header = headerSectionRange(editor, contextLine);
  const note = wholeNoteRange(editor);

  pushUnique(line);
  if (mode === "line-tree-note" || mode === "line-tree-header-note") pushUnique(tree);
  if (mode === "line-tree-header-note") pushUnique(header);
  pushUnique(note);

  return seq;
}

function collapseSelectionToCursor(editor, pos) {
  const line = Math.max(0, Math.min(pos.line, editor.lastLine()));
  const ch = Math.max(0, Math.min(pos.ch, lineLen(editor, line)));
  editor.setCursor({ line, ch });
}

function handleEnhancedSelectAllWithDelay(plugin, editor, mode, gf) {
  const now = Date.now();
  const delayMs = Math.max(250, Math.min(2000, Number(gf.delayMs) || 700));
  const cur = getSelectionRange(editor);
  const st = plugin._enhancedSelectAllCycle;
  const valid = !!st
    && st.editor === editor
    && st.mode === mode
    && st.useDelay === true
    && (now - st.ts) <= delayMs
    && rangeEq(cur, st.lastRange);

  if (!valid) {
    const origin = editor.getCursor("from");
    const seq = buildSelectAllSequence(editor, mode, origin.line);
    if (!seq.length) return false;
    selectRange(editor, seq[0]);
    plugin._enhancedSelectAllCycle = {
      editor,
      mode,
      ts: now,
      idx: 0,
      useDelay: true,
      origin: { line: origin.line, ch: origin.ch },
      lastRange: seq[0],
    };
    return true;
  }

  const seq = buildSelectAllSequence(editor, mode, st.origin.line);
  if (!seq.length) return false;
  const clampedIdx = Math.max(0, Math.min(st.idx, seq.length - 1));
  if (gf.clearOnLast && clampedIdx === seq.length - 1) {
    collapseSelectionToCursor(editor, st.origin);
    plugin._enhancedSelectAllCycle = null;
    return true;
  }
  const nextIdx = (clampedIdx + 1) % seq.length;
  selectRange(editor, seq[nextIdx]);
  plugin._enhancedSelectAllCycle = {
    editor,
    mode,
    ts: now,
    idx: nextIdx,
    useDelay: true,
    origin: st.origin,
    lastRange: seq[nextIdx],
  };
  return true;
}

function handleEnhancedSelectAllByContext(plugin, editor, mode, gf) {
  const cur = getSelectionRange(editor);
  const st = plugin._enhancedSelectAllCycle;
  let origin = null;
  if (st && st.editor === editor && st.mode === mode && st.useDelay === false && rangeEq(cur, st.lastRange)) {
    origin = st.origin;
  } else {
    const p = editor.getCursor("from");
    origin = { line: p.line, ch: p.ch };
  }

  const seq = buildSelectAllSequence(editor, mode, origin.line);
  if (!seq.length) return false;

  let idx = -1;
  for (let i = 0; i < seq.length; i++) {
    if (rangeEq(seq[i], cur)) {
      idx = i;
      break;
    }
  }

  if (gf.clearOnLast && idx === seq.length - 1) {
    collapseSelectionToCursor(editor, origin);
    plugin._enhancedSelectAllCycle = null;
    return true;
  }

  const nextIdx = idx === -1 ? 0 : (idx + 1) % seq.length;
  selectRange(editor, seq[nextIdx]);
  plugin._enhancedSelectAllCycle = {
    editor,
    mode,
    ts: Date.now(),
    idx: nextIdx,
    useDelay: false,
    origin,
    lastRange: seq[nextIdx],
  };
  return true;
}

function handleEnhancedSelectAllKeymap(plugin) {
  const cfg = plugin.getConfig();
  const gf = cfg && cfg.editor && cfg.editor.selectAll ? cfg.editor.selectAll : null;
  if (!gf || !gf.enabled) {
    plugin._enhancedSelectAllCycle = null;
    return false;
  }

  const editor = plugin.getActiveEditor();
  if (!editor) {
    plugin._enhancedSelectAllCycle = null;
    return false;
  }

  try {
    const mode = String(gf.mode || "line-note");
    if (gf.useDelay) {
      return handleEnhancedSelectAllWithDelay(plugin, editor, mode, gf);
    }
    return handleEnhancedSelectAllByContext(plugin, editor, mode, gf);
  } catch (e) {
    console.error("[inline-overhaul][enhanced-select-all]", e);
    return false;
  }
}

module.exports = {
  handleEnhancedSelectAllKeymap,
};
