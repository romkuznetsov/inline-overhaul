"use strict";

/*
 * Формы начала строки берутся из `src/core/shared_utils.js` — одним
 * объявлением на весь плагин. Своя копия стояла здесь до 2026-09-08, и вместе
 * с копией в `smart_delete_engine.js` они успели разойтись трижды (У-32):
 * знак чекбокса, чекбокс у номера списка и номер со скобкой (`1)`). Разбор —
 * в объяснении самого правила.
 */
const __sharedUtils = require("../core/shared_utils.js");

/*
 * Какие ступени бывают и какие из них берёт режим — одним объявлением на
 * движок, нормализацию конфига и панель (У-32).
 */
const __selectAllSteps = require("../core/select_all_steps.js");

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

/**
 * Слово у каретки (ступень `word`, задача заказчика З-3).
 *
 * Каретка стоит **между** знаками, поэтому вопросов два. Первый — стоит ли она
 * внутри слова или вплотную к нему: тогда берётся это слово, и неважно, с
 * какой стороны оно оказалось. Второй — если вокруг пусто, какое слово ближе:
 * считается, сколько знаков до него, и при равенстве берётся левое — то, от
 * которого человек только что ушёл.
 *
 * `null` значит «слова в строке нет»: пустая строка, одни пробелы, одна
 * пунктуация. Ступень тогда просто не встаёт в цикл, а не выделяет пустоту.
 */
function wordRangeAt(editor, pos) {
  const isWordChar = __sharedUtils.isWordChar;
  const line = Math.max(0, Math.min(Number(pos && pos.line) || 0, editor.lastLine()));
  const text = String(editor.getLine(line) || "");
  const len = text.length;
  const ch = Math.max(0, Math.min(Number(pos && pos.ch) || 0, len));

  const expand = (at) => {
    let start = at;
    let end = at + 1;
    while (start > 0 && isWordChar(text[start - 1])) start--;
    while (end < len && isWordChar(text[end])) end++;
    return normPos({ line, ch: start }, { line, ch: end });
  };

  if (isWordChar(text[ch])) return expand(ch);
  if (ch > 0 && isWordChar(text[ch - 1])) return expand(ch - 1);

  let left = -1;
  for (let i = ch - 1; i >= 0; i--) {
    if (isWordChar(text[i])) { left = i; break; }
  }
  let right = -1;
  for (let i = ch; i < len; i++) {
    if (isWordChar(text[i])) { right = i; break; }
  }
  if (left === -1 && right === -1) return null;
  if (left === -1) return expand(right);
  if (right === -1) return expand(left);
  return (ch - left) <= (right - ch + 1) ? expand(left) : expand(right);
}

/** Отрезок одной ступени. Каждая ступень — одна строка этой таблицы. */
function rangeForStep(editor, step, origin) {
  if (step === "word") return wordRangeAt(editor, origin);
  if (step === "line") return currentLineRange(editor, origin.line);
  if (step === "tree") return treeScopeRange(editor, origin.line);
  if (step === "heading") return headerSectionRange(editor, origin.line);
  if (step === "note") return wholeNoteRange(editor);
  return null;
}

/**
 * Последовательность нажатий: ступени режима по порядку, без повторов подряд.
 *
 * Ступени и их порядок решает `src/core/select_all_steps.js`, здесь — только
 * отрезки. У режима `Custom` список бывает пустым: человек снял все галочки, и
 * тогда движок не делает ничего, а клавиша остаётся клавишей Obsidian.
 */
function buildSelectAllSequence(editor, mode, origin, customSteps) {
  const seq = [];
  const pushUnique = (r) => {
    if (!r) return;
    if (seq.length && rangeEq(seq[seq.length - 1], r)) return;
    seq.push(r);
  };

  for (const step of __selectAllSteps.stepsForMode(mode, customSteps)) {
    pushUnique(rangeForStep(editor, step, origin));
  }

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
    const seq = buildSelectAllSequence(editor, mode, origin, gf.customSteps);
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

  const seq = buildSelectAllSequence(editor, mode, st.origin, gf.customSteps);
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

  const seq = buildSelectAllSequence(editor, mode, origin, gf.customSteps);
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
