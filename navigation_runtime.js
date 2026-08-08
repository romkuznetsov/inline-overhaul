"use strict";

function getSharedUtils() {
  try {
    const su = globalThis && globalThis.__inlineOverhaulSharedUtils;
    if (!su || typeof su !== "object") return null;
    if (typeof su.isObj !== "function") return null;
    if (typeof su.nz !== "function") return null;
    return su;
  } catch (_) {
    return null;
  }
}

function isObj(x) {
  const su = getSharedUtils();
  if (su) return su.isObj(x);
  return x && typeof x === "object" && !Array.isArray(x);
}

function nz(v, dflt) {
  const su = getSharedUtils();
  if (su) return su.nz(v, dflt);
  return v === undefined || v === null ? dflt : v;
}

function nInt(v, dflt, min) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  const i = Math.floor(n);
  if (typeof min === "number") return Math.max(min, i);
  return i;
}

function pickMoveLineCfg(cfg) {
  const c = isObj(cfg) ? cfg : {};
  return {
    noSelectionMode: c.noSelectionMode === "with-children" ? "with-children" : "line-only",
    headerMode: c.headerMode === "move-with-section" ? "move-with-section" : "move-as-line",
    crossSectionAllowed: typeof c.crossSectionAllowed === "boolean" ? c.crossSectionAllowed : true,
    highlightMovedLines: typeof c.highlightMovedLines === "boolean" ? c.highlightMovedLines : false,
  };
}

function pickMoveSelectionCfg(cfg) {
  const c = isObj(cfg) ? cfg : {};
  const cycle = Array.isArray(c.cycleOrder) && c.cycleOrder.length
    ? c.cycleOrder.slice()
    : (Array.isArray(c.leftToRight) && c.leftToRight.length ? c.leftToRight.slice() : ["#", "##", "###", "####", "#####", "1. ", "", "- "]);
  return {
    inlineEnabled: typeof c.inlineEnabled === "boolean" ? c.inlineEnabled : (typeof c.enabled === "boolean" ? c.enabled : true),
    prefixCyclerEnabled: typeof c.prefixCyclerEnabled === "boolean" ? c.prefixCyclerEnabled : true,
    indentFallbackEnabled: typeof c.indentFallbackEnabled === "boolean" ? c.indentFallbackEnabled : true,
    onCycleEnd: c.onCycleEnd === "wrap" ? "wrap" : "indent",
    leftToRight: cycle,
    rightToLeft: cycle.slice().reverse(),
    inlineMoveMode: typeof c.inlineMoveMode === "string" ? c.inlineMoveMode : "auto",
  };
}

function pickJumpCfg(cfg) {
  const c = isObj(cfg) ? cfg : {};
  return {
    centerCursor: typeof c.centerCursor === "boolean" ? c.centerCursor : true,
    centerDelayMs: nInt(c.centerDelayMs, 60, 0),
    centerThrottleMs: nInt(c.centerThrottleMs, 200, 0),
    jumpMode: typeof c.jumpMode === "string" ? c.jumpMode : "edge",
    edgeMode: typeof c.edgeMode === "string" ? c.edgeMode : "start-end",
    jumpCursorPosition: typeof c.jumpCursorPosition === "string" ? c.jumpCursorPosition : "start",
  };
}

function pickNavigateInlineCfg(cfg) {
  const c = isObj(cfg) ? cfg : {};
  const stepMode = typeof c.stepMode === "string" ? c.stepMode : "word";
  const onBoundary = typeof c.onBoundary === "string" ? c.onBoundary : "wrap";
  return {
    stepMode: stepMode === "sentence" || stepMode === "begin-end" || stepMode === "word" ? stepMode : "word",
    boundaryJump: typeof c.boundaryJump === "boolean" ? c.boundaryJump : false,
    onBoundary: onBoundary === "stay" || onBoundary === "next-line" || onBoundary === "wrap" ? onBoundary : "wrap",
  };
}

// ---- move-line ----
function moveLine(editor, direction, rawCfg) {
  const cfg = pickMoveLineCfg(rawCfg);
  const total = editor.lastLine() + 1;
  const cursor = editor.getCursor();
  const viewportBefore = getViewportSafe(editor, total);
  const scrollBefore = getScrollStateSafe(editor);

  const selections = (editor && typeof editor.listSelections === "function" ? editor.listSelections() : []) || [];
  const hasSel = selections.length > 0 &&
    !(selections[0].anchor.line === selections[0].head.line && selections[0].anchor.ch === selections[0].head.ch);

  let bSelStart = null;
  let bSelEnd = null;
  let selRestore = null;
  let cursorRestore = null;

  if (hasSel) {
    const { anchor, head } = selections[0];
    const fromLine = Math.min(anchor.line, head.line);
    const toRaw = anchor.line < head.line ? head : anchor;
    const toLine = (toRaw.ch === 0 && toRaw.line > fromLine) ? toRaw.line - 1 : toRaw.line;
    bSelStart = fromLine;
    bSelEnd = toLine;
    selRestore = { anchor: { line: anchor.line, ch: anchor.ch }, head: { line: head.line, ch: head.ch } };
  } else {
    cursorRestore = { line: cursor.line, ch: cursor.ch };
  }

  const anchorLine = hasSel ? bSelStart : cursor.line;
  const yamlEnd = findYamlEnd(editor);
  if (yamlEnd !== -1 && anchorLine <= yamlEnd) return;
  if (isInsideCodeBlock(editor, anchorLine)) return;

  if (isTableLine(editor.getLine(anchorLine))) {
    tableMove(editor, anchorLine, hasSel, bSelStart, bSelEnd, direction, total, viewportBefore, scrollBefore, selRestore, cursorRestore, cfg);
    return;
  }

  const body = getBody(editor, anchorLine, hasSel, bSelStart, bSelEnd, cfg, total);
  if (!body) return;
  const { bStart, bEnd } = body;
  const insertAfter = findInsertAfter(editor, bStart, bEnd, direction, cfg, total, yamlEnd);
  if (insertAfter === null) return;
  applyMove(editor, bStart, bEnd, insertAfter, direction, total, viewportBefore, scrollBefore, selRestore, cursorRestore, cfg);
}

function getBody(editor, anchorLine, hasSel, bSelStart, bSelEnd, cfg, total) {
  if (hasSel) return { bStart: bSelStart, bEnd: bSelEnd };
  const curLine = anchorLine;
  const lineText = nz(editor.getLine(curLine), "");
  if (cfg.headerMode === "move-with-section" && isHeader(lineText)) {
    const level = getHeaderLevel(lineText);
    return { bStart: curLine, bEnd: sectionEnd(editor, curLine, level, total) };
  }
  if (cfg.noSelectionMode === "with-children") {
    const myIndent = indentOf(lineText);
    let end = curLine;
    for (let l = curLine + 1; l < total; l++) {
      const lt = nz(editor.getLine(l), "");
      if (lt.trim() === "") continue;
      if (isHeader(lt)) break;
      if (indentOf(lt) <= myIndent) break;
      end = l;
    }
    return { bStart: curLine, bEnd: end };
  }
  return { bStart: curLine, bEnd: curLine };
}

function findInsertAfter(editor, bStart, bEnd, direction, cfg, total, yamlEnd) {
  return direction === "up"
    ? findInsertAfterUp(editor, bStart, bEnd, cfg, total, yamlEnd)
    : findInsertAfterDown(editor, bStart, bEnd, cfg, total, yamlEnd);
}

function findInsertAfterUp(editor, bStart, bEnd, cfg, total, yamlEnd) {
  const myText = nz(editor.getLine(bStart), "");
  if (isHeader(myText)) {
    const myLevel = getHeaderLevel(myText);
    const prevH = prevHeaderOfLevel(editor, bStart - 1, myLevel, yamlEnd);
    if (prevH === null) return null;
    const prevHLevel = getHeaderLevel(nz(editor.getLine(prevH), ""));
    if (prevHLevel === myLevel) return prevH - 1;
    const prevH2 = prevHeaderOfLevel(editor, prevH - 1, myLevel, yamlEnd);
    if (prevH2 === null) return prevH - 1;
    return prevH2 - 1;
  }
  const prev = prevNonBlank(editor, bStart - 1, yamlEnd);
  if (prev === null) return null;
  const prevText = nz(editor.getLine(prev), "");
  if (isHeader(prevText)) {
    if (!cfg.crossSectionAllowed) return null;
    return prevNonBlank(editor, prev - 1, yamlEnd);
  }
  const myIndent = indentOf(myText);
  const prevIndent = indentOf(prevText);
  if (prevIndent < myIndent) {
    const sameLevel = prevNonBlankWithExactIndent(editor, prev - 1, myIndent, yamlEnd);
    if (sameLevel === null) {
      const targetAfter = prev - 1;
      if (yamlEnd !== -1 && targetAfter !== -1 && targetAfter <= yamlEnd) return null;
      return targetAfter;
    }
    const sameLevelText = nz(editor.getLine(sameLevel), "");
    if (isHeader(sameLevelText)) {
      if (!cfg.crossSectionAllowed) return null;
      return prevNonBlank(editor, sameLevel - 1, yamlEnd);
    }
    return sameLevel - 1;
  }
  return prev - 1;
}

function findInsertAfterDown(editor, bStart, bEnd, cfg, total, yamlEnd) {
  const myText = nz(editor.getLine(bStart), "");
  if (isHeader(myText)) {
    const myLevel = getHeaderLevel(myText);
    const nextH = nextHeaderOfLevel(editor, bEnd + 1, myLevel, total);
    if (nextH === null) return null;
    const nextHLevel = getHeaderLevel(nz(editor.getLine(nextH), ""));
    if (nextHLevel === myLevel) return sectionEnd(editor, nextH, myLevel, total);
    const nextH2 = nextHeaderOfLevel(editor, nextH + 1, myLevel, total);
    if (nextH2 === null) return sectionEnd(editor, nextH, nextHLevel, total);
    return nextH2 - 1;
  }
  const next = nextNonBlank(editor, bEnd + 1, total);
  if (next === null) return null;
  const nextText = nz(editor.getLine(next), "");
  if (isHeader(nextText)) {
    if (!cfg.crossSectionAllowed) return null;
    return next;
  }
  const myIndent = indentOf(myText);
  const nextIndent = indentOf(nextText);
  if (nextIndent < myIndent) {
    const sameLevel = nextNonBlankWithExactIndent(editor, next + 1, myIndent, total);
    if (sameLevel === null) return next;
    const sameLevelText = nz(editor.getLine(sameLevel), "");
    if (isHeader(sameLevelText)) {
      if (!cfg.crossSectionAllowed) return null;
      return sameLevel;
    }
    return sameLevel - 1;
  }
  return next;
}

function applyMove(editor, bStart, bEnd, insertAfterLine, direction, total, viewportBefore, scrollBefore, selRestore, cursorRestore, cfg) {
  const doc = editor.getValue();
  const lines = doc.split("\n");
  const bodyLines = lines.slice(bStart, bEnd + 1);
  const rest = [];
  for (let i = 0; i < lines.length; i++) if (!(i >= bStart && i <= bEnd)) rest.push({ origIdx: i, text: lines[i] });
  let insertInRest = -1;
  if (insertAfterLine >= 0) {
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].origIdx <= insertAfterLine) insertInRest = i;
      else break;
    }
  }
  const finalLines = [];
  for (let i = 0; i <= insertInRest; i++) finalLines.push(rest[i].text);
  finalLines.push(...bodyLines);
  for (let i = insertInRest + 1; i < rest.length; i++) finalLines.push(rest[i].text);
  const newDoc = finalLines.join("\n");
  const newBodyStart = insertInRest + 1;
  if (newDoc !== doc) editor.setValue(newDoc);
  const movedStart = newBodyStart;
  const movedEnd = newBodyStart + (bEnd - bStart);
  if (cfg.highlightMovedLines) {
    editor.setSelection({ line: movedStart, ch: 0 }, { line: movedEnd, ch: nz(finalLines[movedEnd], "").length });
  } else if (selRestore) restoreMovedSelection(editor, selRestore, bStart, bEnd, movedStart, movedEnd);
  else if (cursorRestore) restoreMovedCursor(editor, cursorRestore, bStart, bEnd, movedStart, movedEnd);
  else editor.setCursor({ line: movedStart, ch: 0 });
  maybeRevealMovedRange(editor, movedStart, movedEnd, direction, viewportBefore, scrollBefore, cfg);
}

function tableMove(editor, anchorLine, hasSel, bSelStart, bSelEnd, direction, total, viewportBefore, scrollBefore, selRestore, cursorRestore, cfg) {
  if (isTableSep(editor.getLine(anchorLine))) return;
  const { top, bot } = tableBounds(editor, anchorLine, total);
  let bStart, bEnd;
  if (hasSel) {
    bStart = bSelStart; bEnd = bSelEnd;
    if (bStart < top || bEnd > bot) return;
    for (let l = bStart; l <= bEnd; l++) if (isTableSep(editor.getLine(l))) return;
  } else bStart = bEnd = anchorLine;
  const numRows = bEnd - bStart + 1;
  if (direction === "up") {
    const targetLine = bStart - 1;
    if (targetLine < top || isTableSep(editor.getLine(targetLine))) return;
    const movedLines = [];
    for (let l = bStart; l <= bEnd; l++) movedLines.push(editor.getLine(l));
    const targetText = editor.getLine(targetLine);
    editor.replaceRange(movedLines.join("\n") + "\n" + targetText, { line: targetLine, ch: 0 }, { line: bEnd, ch: editor.getLine(bEnd).length });
    const newStart = targetLine;
    const newEnd = targetLine + numRows - 1;
    if (cfg.highlightMovedLines) {
      editor.setSelection({ line: newStart, ch: 0 }, { line: newEnd, ch: editor.getLine(newEnd).length });
    } else if (selRestore) restoreMovedSelection(editor, selRestore, bStart, bEnd, newStart, newEnd);
    else if (cursorRestore) restoreMovedCursor(editor, cursorRestore, bStart, bEnd, newStart, newEnd);
    else editor.setCursor({ line: newStart, ch: 0 });
    maybeRevealMovedRange(editor, newStart, newEnd, direction, viewportBefore, scrollBefore, cfg);
  } else {
    const targetLine = bEnd + 1;
    if (targetLine > bot || isTableSep(editor.getLine(targetLine))) return;
    const movedLines = [];
    for (let l = bStart; l <= bEnd; l++) movedLines.push(editor.getLine(l));
    const targetText = editor.getLine(targetLine);
    editor.replaceRange(targetText + "\n" + movedLines.join("\n"), { line: bStart, ch: 0 }, { line: targetLine, ch: targetText.length });
    const newStart = bStart + 1;
    const newEnd = newStart + numRows - 1;
    if (cfg.highlightMovedLines) {
      editor.setSelection({ line: newStart, ch: 0 }, { line: newEnd, ch: editor.getLine(newEnd).length });
    } else if (selRestore) restoreMovedSelection(editor, selRestore, bStart, bEnd, newStart, newEnd);
    else if (cursorRestore) restoreMovedCursor(editor, cursorRestore, bStart, bEnd, newStart, newEnd);
    else editor.setCursor({ line: newStart, ch: 0 });
    maybeRevealMovedRange(editor, newStart, newEnd, direction, viewportBefore, scrollBefore, cfg);
  }
}

function getViewportSafe(editor, total) {
  try {
    if (!editor || typeof editor.getViewport !== "function") return null;
    const vp = editor.getViewport();
    if (!vp || typeof vp.from !== "number" || typeof vp.to !== "number") return null;
    const from = Math.max(0, vp.from);
    const toIncl = Math.max(from, Math.min(total - 1, vp.to - 1));
    return { from, to: toIncl };
  } catch (_) { return null; }
}

function getScrollStateSafe(editor) {
  try {
    const dom = editor && editor.cm && editor.cm.scrollDOM;
    if (!dom) return null;
    return { top: Number(dom.scrollTop) || 0, left: Number(dom.scrollLeft) || 0 };
  } catch (_) { return null; }
}

function restoreScrollStateSafe(editor, state) {
  if (!state) return;
  try {
    const dom = editor && editor.cm && editor.cm.scrollDOM;
    if (!dom) return;
    dom.scrollTop = state.top;
    dom.scrollLeft = state.left;
  } catch (_) {}
}

function maybeRevealMovedRange(editor, startLine, endLine, direction, viewportBefore, scrollBefore, cfg) {
  if (!viewportBefore) return;
  if (startLine >= viewportBefore.from && endLine <= viewportBefore.to) {
    restoreScrollStateSafe(editor, scrollBefore);
    return;
  }
  const movedUpOutOfView = direction === "up" && startLine < viewportBefore.from;
  const target = movedUpOutOfView ? { line: startLine, ch: 0 } : { line: endLine, ch: 0 };
  try { editor.scrollIntoView(target); } catch (_) {}
}

function restoreMovedSelection(editor, selRestore, oldStart, oldEnd, newStart, newEnd) {
  const delta = newStart - oldStart;
  function clampPos(pos) {
    let line = pos.line;
    if (line === oldEnd + 1 && pos.ch === 0) line = newEnd + 1;
    else {
      line = line + delta;
      if (line < newStart) line = newStart;
      if (line > newEnd) line = newEnd;
    }
    const last = editor.lastLine();
    if (line < 0) line = 0;
    if (line > last) line = last;
    const maxCh = String(nz(editor.getLine(line), "")).length;
    const ch = Math.max(0, Math.min(pos.ch, maxCh));
    return { line, ch };
  }
  editor.setSelection(clampPos(selRestore.anchor), clampPos(selRestore.head));
}

function restoreMovedCursor(editor, cursorRestore, oldStart, oldEnd, newStart, newEnd) {
  const delta = newStart - oldStart;
  let line = cursorRestore.line + delta;
  if (line < newStart) line = newStart;
  if (line > newEnd) line = newEnd;
  const maxLine = editor.lastLine();
  if (line < 0) line = 0;
  if (line > maxLine) line = maxLine;
  const maxCh = String(nz(editor.getLine(line), "")).length;
  const ch = Math.max(0, Math.min(cursorRestore.ch, maxCh));
  editor.setCursor({ line: line, ch: ch });
}

function isTableSep(text) { return /^\|[\s\-:|]+\|/.test(String(nz(text, "")).trim()); }
function tableBounds(editor, anchorLine, total) {
  let top = anchorLine;
  while (top > 0 && isTableLine(editor.getLine(top - 1))) top--;
  let bot = anchorLine;
  while (bot < total - 1 && isTableLine(editor.getLine(bot + 1))) bot++;
  return { top, bot };
}
const HEADER_RE = /^(#{1,6})\s/;
function isHeader(text) { return HEADER_RE.test(String(nz(text, ""))); }
function getHeaderLevel(text) { const m = String(nz(text, "")).match(HEADER_RE); return m ? m[1].length : 0; }
function isTableLine(text) { return String(nz(text, "")).trimStart().startsWith("|"); }
function indentOf(text) { const t = String(nz(text, "")); let i = 0; while (i < t.length && (t[i] === " " || t[i] === "\t")) i++; return i; }
function sectionEnd(editor, headerLine, level, total) { for (let l = headerLine + 1; l < total; l++) { const lt = nz(editor.getLine(l), ""); if (isHeader(lt) && getHeaderLevel(lt) <= level) return l - 1; } return total - 1; }
function prevNonBlank(editor, fromLine, yamlEnd) { for (let l = fromLine; l >= 0; l--) { if (yamlEnd !== -1 && l <= yamlEnd) return null; if (String(nz(editor.getLine(l), "")).trim() !== "") return l; } return null; }
function nextNonBlank(editor, fromLine, total) { for (let l = fromLine; l < total; l++) if (String(nz(editor.getLine(l), "")).trim() !== "") return l; return null; }
function prevNonBlankWithExactIndent(editor, fromLine, exactIndent, yamlEnd) { for (let l = fromLine; l >= 0; l--) { if (yamlEnd !== -1 && l <= yamlEnd) return null; const t = nz(editor.getLine(l), ""); if (t.trim() === "") continue; if (isHeader(t)) return null; const ind = indentOf(t); if (ind < exactIndent) return null; if (ind === exactIndent) return l; } return null; }
function nextNonBlankWithExactIndent(editor, fromLine, exactIndent, total) { for (let l = fromLine; l < total; l++) { const t = nz(editor.getLine(l), ""); if (t.trim() === "") continue; if (isHeader(t)) return null; const ind = indentOf(t); if (ind < exactIndent) return null; if (ind === exactIndent) return l; } return null; }
function findYamlEnd(editor) { if (String(nz(editor.getLine(0), "")).trim() !== "---") return -1; const max = editor.lastLine(); for (let l = 1; l <= max; l++) { const t = String(nz(editor.getLine(l), "")).trim(); if (t === "---" || t === "...") return l; } return -1; }
function isInsideCodeBlock(editor, lineNo) { let depth = 0; for (let l = 0; l < lineNo; l++) if (/^(`{3,}|~{3,})/.test(String(nz(editor.getLine(l), "")).trimStart())) depth++; return depth % 2 === 1; }
function prevHeaderOfLevel(editor, fromLine, maxLevel, yamlEnd) { for (let l = fromLine; l >= 0; l--) { if (yamlEnd !== -1 && l <= yamlEnd) return null; const t = nz(editor.getLine(l), ""); if (isHeader(t) && getHeaderLevel(t) <= maxLevel) return l; } return null; }
function nextHeaderOfLevel(editor, fromLine, maxLevel, total) { for (let l = fromLine; l < total; l++) { const t = nz(editor.getLine(l), ""); if (isHeader(t) && getHeaderLevel(t) <= maxLevel) return l; } return null; }

// ---- move-selection ----
function moveSelection(editor, direction, rawCfg) {
  const rules = pickMoveSelectionCfg(rawCfg);
  rules.indentWidth = getEditorTabSize(editor);
  const sel = editor && typeof editor.getSelection === "function" ? nz(editor.getSelection(), "") : "";
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  const hasSelection = sel.length > 0;
  const isMultiLine = from.line !== to.line;

  if (hasSelection && !isMultiLine && isWholeLineSelected(editor, from, to, sel)) {
    indentLine(editor, direction, rules);
    const lineNo = from.line;
    const newLen = String(nz(editor.getLine(lineNo), "")).length;
    editor.setSelection({ line: lineNo, ch: 0 }, { line: lineNo, ch: newLen });
    return;
  }

  if (!hasSelection && !isMultiLine) return indentLine(editor, direction, rules);
  if (isMultiLine) return indentMultipleLines(editor, direction, rules);

  if (!rules.inlineEnabled) return;
  if (rules.inlineMoveMode === "disabled") return;

  const doc = editor.getValue();
  const a = editor.posToOffset(from);
  const b = editor.posToOffset(to);
  const mode = decideMoveMode(doc, a, b, direction, rules.inlineMoveMode);
  if (mode === "noop") return;
  if (mode === "char") bubbleSwapByCodePoint(doc, editor, a, b, direction);
  else jumpByWordToken(doc, editor, a, b, direction);
}

function isWholeLineSelected(editor, from, to, selectedText) {
  if (!editor || !from || !to) return false;
  if (from.line !== to.line) return false;
  const line = String(nz(editor.getLine(from.line), ""));
  const full = from.ch === 0 && to.ch >= line.length;
  if (!full) return false;
  const norm = String(selectedText || "").replace(/\r?\n$/, "");
  return norm === line;
}

function getEditorTabSize(editor) {
  try {
    if (editor && editor.cm && editor.cm.state) {
      const t = Number(editor.cm.state.tabSize);
      if (Number.isFinite(t) && t > 0) return Math.floor(t);
    }
  } catch (_) {}
  return 4;
}

function getIndentStr(rules) { return " ".repeat(rules.indentWidth || 4); }
function decideMoveMode(doc, a, b, direction, inlineMoveMode) {
  const forced = inlineMoveMode === "char" || inlineMoveMode === "word" ? inlineMoveMode : "";
  if (forced) return forced;
  const inside = doc.slice(a, b);
  if (!inside) return "noop";
  const insideAllWord = everyChar(inside, isWordChar);
  const leftIsWord = isWordChar(doc[a - 1]);
  const rightIsWord = isWordChar(doc[b]);
  if (insideAllWord && (leftIsWord || rightIsWord)) {
    const neighborInDirection = direction === "left" ? leftIsWord : rightIsWord;
    if (!neighborInDirection) return "noop";
    return "char";
  }
  return "word";
}
function everyChar(str, fn) { for (let i = 0; i < str.length; i++) if (!fn(str[i])) return false; return true; }
function bubbleSwapByCodePoint(doc, editor, a, b, direction) {
  const sel = doc.slice(a, b); if (!sel) return;
  if (direction === "left") {
    const prevStart = prevCodePointStart(doc, a); if (prevStart == null) return;
    const before = doc.slice(prevStart, a); if (!before) return;
    const newDoc = doc.slice(0, prevStart) + sel + before + doc.slice(b);
    if (newDoc !== doc) editor.setValue(newDoc);
    editor.setSelection(editor.offsetToPos(prevStart), editor.offsetToPos(prevStart + sel.length));
    return;
  }
  const nextEnd = nextCodePointEnd(doc, b); if (nextEnd == null) return;
  const after = doc.slice(b, nextEnd); if (!after) return;
  const newDoc = doc.slice(0, a) + after + sel + doc.slice(nextEnd);
  if (newDoc !== doc) editor.setValue(newDoc);
  const newA = a + after.length;
  editor.setSelection(editor.offsetToPos(newA), editor.offsetToPos(newA + sel.length));
}
function jumpByWordToken(doc, editor, a, b, direction) {
  while (a < b && isHorizSpace(doc[a])) a++;
  while (b > a && isHorizSpace(doc[b - 1])) b--;
  const phrase = doc.slice(a, b); if (!phrase) return;
  if (direction === "left") {
    let i = a; while (i > 0 && isGapChar(doc[i - 1])) i--; const gap = doc.slice(i, a);
    const tEnd = i; while (i > 0 && isWordChar(doc[i - 1])) i--; const tStart = i;
    if (tStart === tEnd) return; const token = doc.slice(tStart, tEnd);
    const newDoc = doc.slice(0, tStart) + phrase + gap + token + doc.slice(b);
    if (newDoc !== doc) editor.setValue(newDoc);
    editor.setSelection(editor.offsetToPos(tStart), editor.offsetToPos(tStart + phrase.length));
    return;
  }
  let i = b; while (i < doc.length && isGapChar(doc[i])) i++; const gap = doc.slice(b, i);
  const tStart = i; while (i < doc.length && isWordChar(doc[i])) i++; const tEnd = i;
  if (tStart === tEnd) return; const token = doc.slice(tStart, tEnd);
  const newDoc = doc.slice(0, a) + token + gap + phrase + doc.slice(tEnd);
  if (newDoc !== doc) editor.setValue(newDoc);
  const newA = a + token.length + gap.length;
  editor.setSelection(editor.offsetToPos(newA), editor.offsetToPos(newA + phrase.length));
}
function getIndent(line) { const m = line.match(/^(\s*)/); return m ? m[1].length : 0; }
function isBullet(line) { const trimmed = line.replace(/^\s*/, ""); return /^[-*]\s/.test(trimmed) || /^[-*]\s\[[ x]\]\s/.test(trimmed); }
function indentLine(editor, direction, rules) {
  const cur = editor.getCursor();
  const lineNo = cur.line;
  const line = editor.getLine(lineNo);
  const currentIndent = getIndent(line);
  const indentWidth = rules.indentWidth || 4;
  const INDENT = getIndentStr(rules);

  if (direction === "left") {
    if (currentIndent > 0) {
      if (rules.indentFallbackEnabled) removeOneIndent(editor, lineNo, currentIndent, rules);
      return;
    }
    if (rules.prefixCyclerEnabled) {
      const result = cycleLineType(editor, lineNo, "left", rules);
      if (result) {
        editor.setLine(lineNo, result.newLine);
        editor.setCursor({ line: lineNo, ch: result.newCh });
      }
    }
    return;
  }

  if (currentIndent > 0 || isBullet(line)) {
    if (rules.indentFallbackEnabled) {
      editor.replaceRange(INDENT, { line: lineNo, ch: 0 });
      editor.setCursor({ line: lineNo, ch: cur.ch + indentWidth });
    }
    return;
  }

  if (rules.prefixCyclerEnabled) {
    const result = cycleLineType(editor, lineNo, "right", rules);
    if (result) {
      editor.setLine(lineNo, result.newLine);
      editor.setCursor({ line: lineNo, ch: result.newCh });
      return;
    }
  }

  if (rules.indentFallbackEnabled) {
    editor.replaceRange(INDENT, { line: lineNo, ch: 0 });
    editor.setCursor({ line: lineNo, ch: cur.ch + indentWidth });
  }
}
function removeOneIndent(editor, lineNo, currentIndent, rules) { const line = editor.getLine(lineNo); const indentWidth = rules.indentWidth || 4; const INDENT = getIndentStr(rules); const delta = Math.min(currentIndent, indentWidth); if (line.startsWith(INDENT)) editor.replaceRange("", { line: lineNo, ch: 0 }, { line: lineNo, ch: indentWidth }); else if (line.startsWith("\t")) editor.replaceRange("", { line: lineNo, ch: 0 }, { line: lineNo, ch: 1 }); else editor.replaceRange("", { line: lineNo, ch: 0 }, { line: lineNo, ch: delta }); }
function indentMultipleLines(editor, direction, rules) {
  const from = editor.getCursor("from"); const to = editor.getCursor("to");
  const startLine = from.line; let endLine = to.line; const indentWidth = rules.indentWidth || 4; const INDENT = getIndentStr(rules);
  if (to.ch === 0 && to.line > from.line) endLine = to.line - 1;
  const changes = []; const lineData = [];
  for (let i = startLine; i <= endLine; i++) {
    const line = editor.getLine(i);
    lineData.push({ line, startOffset: editor.posToOffset({ line: i, ch: 0 }), endOffset: editor.posToOffset({ line: i, ch: line.length }), lineNo: i });
  }
  if (direction === "left") {
    for (const data of lineData) {
      const currentIndent = getIndent(data.line);
      if (currentIndent > 0) {
        if (rules.indentFallbackEnabled) changes.push({ from: data.startOffset, to: data.startOffset + Math.min(currentIndent, indentWidth), insert: "" });
      }
      else {
        if (rules.prefixCyclerEnabled) {
          const result = cycleLineTypeRaw(data.line, "left", rules);
          if (result !== null) changes.push({ from: data.startOffset, to: data.endOffset, insert: result });
        }
      }
    }
  } else {
    for (const data of lineData) {
      const currentIndent = getIndent(data.line);
      if (currentIndent === 0) {
        if (isBullet(data.line)) {
          if (rules.indentFallbackEnabled) changes.push({ from: data.startOffset, to: data.startOffset, insert: INDENT });
        }
        else if (rules.prefixCyclerEnabled) {
          const result = cycleLineTypeRaw(data.line, "right", rules);
          if (result !== null) changes.push({ from: data.startOffset, to: data.endOffset, insert: result });
          else if (rules.indentFallbackEnabled) changes.push({ from: data.startOffset, to: data.startOffset, insert: INDENT });
        } else if (rules.indentFallbackEnabled) changes.push({ from: data.startOffset, to: data.startOffset, insert: INDENT });
      } else if (rules.indentFallbackEnabled) changes.push({ from: data.startOffset, to: data.startOffset, insert: INDENT });
    }
  }
  if (changes.length === 0) return;
  if (editor.cm && typeof editor.cm.dispatch === "function") editor.cm.dispatch({ changes });
  else for (const c of changes) editor.replaceRange(c.insert, editor.offsetToPos(c.from), editor.offsetToPos(c.to));
  editor.setSelection({ line: startLine, ch: 0 }, { line: endLine, ch: editor.getLine(endLine).length });
}
function cycleLineTypeRaw(line, direction, rules, options) {
  const info = detectLineType(line);
  const arr = direction === "left" ? rules.rightToLeft : rules.leftToRight;
  const currentPrefix = getPrefixFromInfo(info);
  let searchPrefix = info.type === "header" ? currentPrefix.trim() : currentPrefix;
  if (info.type === "numbered") searchPrefix = "1. ";
  let idx = arr.indexOf(searchPrefix); if (idx === -1) idx = arr.indexOf(""); if (idx === -1) return null;
  const nextIdx = (idx + 1) % arr.length;
  const wrapped = idx === arr.length - 1;
  if (direction === "right" && rules.onCycleEnd === "indent" && wrapped) return null;
  let newPrefix = arr[nextIdx];
  if (/^#+$/.test(newPrefix)) newPrefix += " ";
  if (/^\d+\.\s$/.test(newPrefix)) {
    if (options && options.editor && options.lineNo != null) newPrefix = getNextNumber(options.editor, options.lineNo) + ". ";
    else newPrefix = "1. ";
  }
  return info.indent + newPrefix + info.content;
}
function cycleLineType(editor, lineNo, direction, rules) { const line = editor.getLine(lineNo); const result = cycleLineTypeRaw(line, direction, rules, { editor, lineNo }); if (result === null) return null; return { newLine: result, newCh: result.length }; }
function detectLineType(line) { const indent = (line.match(/^(\s*)/) || ["", ""])[1]; const trimmed = line.slice(indent.length); let m; if (/^#{1,5}\s/.test(trimmed)) { m = trimmed.match(/^(#{1,5})\s(.*)$/); return { type: "header", level: m[1].length, prefix: m[1] + " ", content: m[2], indent }; } if (/^\d+\.\s/.test(trimmed)) { m = trimmed.match(/^(\d+)\.\s(.*)$/); return { type: "numbered", number: parseInt(m[1], 10), prefix: m[1] + ". ", content: m[2], indent }; } if (/^[-*]\s\[[ x]\]\s/.test(trimmed)) { m = trimmed.match(/^([-*])\s(\[[ x]\])\s(.*)$/); return { type: "checkbox", prefix: m[1] + " " + m[2] + " ", content: m[3], indent }; } if (/^[-*]\s/.test(trimmed)) { m = trimmed.match(/^([-*])\s(.*)$/); return { type: "bullet", prefix: m[1] + " ", content: m[2], indent }; } return { type: "plain", prefix: "", content: trimmed, indent }; }
function getPrefixFromInfo(info) { if (info.type === "header") return info.prefix.trim(); if (info.type === "numbered") return info.number + ". "; if (info.type === "bullet" || info.type === "checkbox") return info.prefix; return ""; }
function getNextNumber(editor, currentLineNo) { for (let i = currentLineNo - 1; i >= 0; i--) { const line = editor.getLine(i); const m = line.match(/^(\d+)\.\s/); if (m) return parseInt(m[1], 10) + 1; if (line.replace(/^\s*/, "").length > 0) break; } return 1; }
function isWordChar(ch) { return /[0-9A-Za-zА-Яа-яЁё_]/.test(ch || ""); }
function isHorizSpace(ch) { return ch === " " || ch === "\t"; }
function isGapChar(ch) { if (ch == null) return false; if (ch === "\n") return false; return !isWordChar(ch); }
function isHighSurrogate(code) { return code >= 0xd800 && code <= 0xdbff; }
function isLowSurrogate(code) { return code >= 0xdc00 && code <= 0xdfff; }
function prevCodePointStart(str, index) { if (index <= 0) return null; let j = index - 1; const c = str.charCodeAt(j); if (isLowSurrogate(c) && j - 1 >= 0) { const p = str.charCodeAt(j - 1); if (isHighSurrogate(p)) j -= 1; } return j; }
function nextCodePointEnd(str, index) { if (index >= str.length) return null; const c = str.charCodeAt(index); if (isHighSurrogate(c) && index + 1 < str.length) { const n = str.charCodeAt(index + 1); if (isLowSurrogate(n)) return index + 2; } return index + 1; }

// ---- jump-to-header ----
function jumpToHeader(editor, direction, rawCfg) {
  const cfg = pickJumpCfg(rawCfg);
  const cur = editor.getCursor();
  const yamlEnd = findYamlEnd(editor);
  if (yamlEnd !== -1 && cur.line >= 0 && cur.line <= yamlEnd) {
    if (direction === "up") return setCursorRobustCentered(editor, { line: 0, ch: 0 }, cfg);
    const firstH = findNextHeader(editor, -1);
    if (firstH !== -1) return setCursorRobustCentered(editor, sectionAnchorsAvoidTables(editor, firstH, cfg).startPos, cfg);
    return;
  }
  let curH = findPrevHeader(editor, cur.line);
  if (curH === -1) {
    curH = findNextHeader(editor, -1);
    if (curH === -1) return;
  }
  const tb = tableBlockInSection(editor, curH, cur.line);
  if (tb) {
    if (direction === "up") {
      const l = findAllowedLineUp(editor, tb.top - 1, tb.a);
      if (l !== -1) return setCursorRobustCentered(editor, { line: l, ch: (editor.getLine(l) || "").length }, cfg);
      return setCursorRobustCentered(editor, sectionAnchorsAvoidTables(editor, curH, cfg).startPos, cfg);
    }
    const l = findAllowedLineDown(editor, tb.bot + 1, tb.b);
    if (l !== -1) return setCursorRobustCentered(editor, { line: l, ch: smartLineStartCh(editor.getLine(l) || "") }, cfg);
    const nextH = findNextHeader(editor, curH);
    if (nextH !== -1) return setCursorRobustCentered(editor, sectionAnchorsAvoidTables(editor, nextH, cfg).startPos, cfg);
    return;
  }

  const a = sectionAnchorsAvoidTables(editor, curH, cfg);
  if (cfg.jumpMode === "line") {
    return jumpByLineMode(editor, cur, curH, direction, cfg, yamlEnd);
  }
  return jumpByEdgeMode(editor, cur, curH, direction, cfg, yamlEnd, a);
}

function jumpByEdgeMode(editor, cur, curH, direction, cfg, yamlEnd, anchors) {
  const curLine = cur.line;
  const atStartLine = curLine === anchors.startPos.line;
  const atEndLine = curLine === anchors.endPos.line;

  if (cfg.edgeMode === "start") {
    if (!atStartLine) return setCursorRobustCentered(editor, anchors.startPos, cfg);
    return jumpToAdjacentSection(editor, curH, direction, cfg, yamlEnd, "start");
  }

  if (cfg.edgeMode === "end") {
    if (!atEndLine) return setCursorRobustCentered(editor, anchors.endPos, cfg);
    return jumpToAdjacentSection(editor, curH, direction, cfg, yamlEnd, "end");
  }

  // start-end toggle (default)
  if (direction === "down") {
    if (!atEndLine) return setCursorRobustCentered(editor, anchors.endPos, cfg);
    return jumpToAdjacentSection(editor, curH, direction, cfg, yamlEnd, "start");
  }
  if (!atStartLine) return setCursorRobustCentered(editor, anchors.startPos, cfg);
  return jumpToAdjacentSection(editor, curH, direction, cfg, yamlEnd, "end");
}

function jumpByLineMode(editor, cur, curH, direction, cfg, yamlEnd) {
  const sec = sectionContentRange(editor, curH);
  const curLine = cur.line;
  if (direction === "down") {
    const nextLine = findNextContentLineInRange(editor, curLine + 1, sec.b);
    if (nextLine !== -1) return setCursorRobustCentered(editor, targetPosForLine(editor, nextLine, cfg), cfg);
    const nextH = findNextHeader(editor, curH);
    if (nextH === -1) return;
    const nextSec = sectionContentRange(editor, nextH);
    const first = findNextContentLineInRange(editor, nextSec.a, nextSec.b);
    const line = first !== -1 ? first : nextH;
    return setCursorRobustCentered(editor, targetPosForLine(editor, line, cfg), cfg);
  }

  const prevLine = findPrevContentLineInRange(editor, curLine - 1, sec.a);
  if (prevLine !== -1) return setCursorRobustCentered(editor, targetPosForLine(editor, prevLine, cfg), cfg);
  const prevH = findPrevHeader(editor, curH - 1);
  if (prevH === -1) {
    if (yamlEnd !== -1) return setCursorRobustCentered(editor, { line: yamlEnd, ch: 0 }, cfg);
    return setCursorRobustCentered(editor, { line: 0, ch: 0 }, cfg);
  }
  const prevSec = sectionContentRange(editor, prevH);
  const last = findPrevContentLineInRange(editor, prevSec.b, prevSec.a);
  const line = last !== -1 ? last : prevH;
  return setCursorRobustCentered(editor, targetPosForLine(editor, line, cfg), cfg);
}

function jumpToAdjacentSection(editor, curH, direction, cfg, yamlEnd, targetKind) {
  if (direction === "down") {
    const nextH = findNextHeader(editor, curH);
    if (nextH === -1) return;
    const nextAnchors = sectionAnchorsAvoidTables(editor, nextH, cfg);
    const target = targetKind === "end" ? nextAnchors.endPos : nextAnchors.startPos;
    return setCursorRobustCentered(editor, target, cfg);
  }

  const prevH = findPrevHeader(editor, curH - 1);
  if (prevH === -1) {
    if (yamlEnd !== -1) return setCursorRobustCentered(editor, { line: yamlEnd, ch: 0 }, cfg);
    return setCursorRobustCentered(editor, { line: 0, ch: 0 }, cfg);
  }
  const prevAnchors = sectionAnchorsAvoidTables(editor, prevH, cfg);
  const target = targetKind === "start" ? prevAnchors.startPos : prevAnchors.endPos;
  return setCursorRobustCentered(editor, target, cfg);
}

function targetPosForLine(ed, line, cfg) {
  const mode = cfg.jumpCursorPosition || "start";
  if (mode === "end") return { line: line, ch: len(ed, line) };
  if (mode === "section-end") return lineEndPos(ed, line, cfg);
  return { line: line, ch: smartLineStartCh(txt(ed, line)) };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function smartLineStartCh(s) { const t = String(s || ""); let i = 0; while (i < t.length && (t[i] === " " || t[i] === "\t")) i++; if (t.slice(i).startsWith("|")) { i += 1; while (i < t.length && t[i] === " ") i++; return i; } let m = t.slice(i).match(/^([-*+])\s+/); if (m) i += m[0].length; else { m = t.slice(i).match(/^(\d+)\.\s+/); if (m) i += m[0].length; } const mCb = t.slice(i).match(/^\[[^\]]\]\s+/); if (mCb) i += mCb[0].length; return i; }
function centerOnCursorOnce(ed, p, cfg) { if (!cfg.centerCursor) return; if (!globalThis.__jumpCenterState) globalThis.__jumpCenterState = { t: 0, line: -1 }; const st = globalThis.__jumpCenterState; const now = Date.now(); if (now - st.t < cfg.centerThrottleMs && st.line === p.line) return; st.t = now; st.line = p.line; setTimeout(() => { try { if (typeof ed.scrollIntoView === "function") ed.scrollIntoView({ from: p, to: p }, true); } catch (_) {} }, cfg.centerDelayMs); }
async function setCursorRobustCentered(ed, p, cfg) { const apply = () => { ed.setCursor(p); if (typeof ed.focus === "function") ed.focus(); }; apply(); await sleep(0); apply(); await sleep(40); apply(); centerOnCursorOnce(ed, p, cfg); }
function txt(ed, l) { return String(nz(ed.getLine(l), "")); }
function len(ed, l) { return txt(ed, l).length; }
function isBlank(ed, l) { return txt(ed, l).trim().length === 0; }
function isTableLineText(s) { return String(nz(s, "")).trimStart().startsWith("|"); }
function isDashSepText(s) { return /^-+$/.test(String(nz(s, "")).trim()); }
function findPrevHeader(ed, fromLine) { for (let l = Math.min(fromLine, ed.lastLine()); l >= 0; l--) if (isHeader(ed.getLine(l))) return l; return -1; }
function findNextHeader(ed, fromLine) { const max = ed.lastLine(); for (let l = Math.max(0, fromLine + 1); l <= max; l++) if (isHeader(ed.getLine(l))) return l; return -1; }
function sectionContentRange(ed, headerLine) { const max = ed.lastLine(); const nextH = findNextHeader(ed, headerLine); return { a: headerLine + 1, b: nextH === -1 ? max : nextH - 1, nextH }; }
function tableBlockInSection(ed, headerLine, curLine) { const { a, b } = sectionContentRange(ed, headerLine); if (curLine < a || curLine > b || !isTableLineText(txt(ed, curLine))) return null; let top = curLine; while (top - 1 >= a && isTableLineText(txt(ed, top - 1)) && !isBlank(ed, top - 1)) top--; let bot = curLine; while (bot + 1 <= b && isTableLineText(txt(ed, bot + 1)) && !isBlank(ed, bot + 1)) bot++; return { top, bot, a, b }; }
function findAllowedLineUp(ed, startLine, a) { for (let l = startLine; l >= a; l--) { const s = txt(ed, l); if (isTableLineText(s) || isDashSepText(s)) continue; return l; } return -1; }
function findAllowedLineDown(ed, startLine, b) { for (let l = startLine; l <= b; l++) { const s = txt(ed, l); if (isTableLineText(s) || isDashSepText(s)) continue; return l; } return -1; }
function isContentLine(ed, l) {
  const s = txt(ed, l);
  if (!s.trim()) return false;
  if (isDashSepText(s) || isTableLineText(s)) return false;
  return true;
}
function findNextContentLineInRange(ed, fromLine, toLine) {
  for (let l = fromLine; l <= toLine; l++) if (isContentLine(ed, l)) return l;
  return -1;
}
function findPrevContentLineInRange(ed, fromLine, toLine) {
  for (let l = fromLine; l >= toLine; l--) if (isContentLine(ed, l)) return l;
  return -1;
}
function sectionAnchorsAvoidTables(ed, headerLine, cfg) {
  const { a, b } = sectionContentRange(ed, headerLine);
  if (a > b) return { startPos: targetPosForLine(ed, headerLine, cfg), endPos: targetPosForLine(ed, headerLine, cfg) };
  let startLine = -1; for (let l = a; l <= b; l++) { const s = txt(ed, l); if (isBlank(ed, l) || isDashSepText(s) || isTableLineText(s)) continue; startLine = l; break; }
  let endLine = -1; for (let l = b; l >= a; l--) { const s = txt(ed, l); if (isBlank(ed, l) || isDashSepText(s) || isTableLineText(s)) continue; endLine = l; break; }
  if (startLine === -1 || endLine === -1) return { startPos: targetPosForLine(ed, headerLine, cfg), endPos: targetPosForLine(ed, headerLine, cfg) };
  return { startPos: targetPosForLine(ed, startLine, cfg), endPos: targetPosForLine(ed, endLine, cfg) };
}

function lineEndPos(ed, line, cfg) {
  const s = txt(ed, line);
  if (!cfg || cfg.jumpCursorPosition !== "section-end") return { line: line, ch: len(ed, line) };
  const sep = typeof (cfg && cfg.separator1) === "string" && cfg.separator1 ? cfg.separator1 : "||";
  const first = s.indexOf(sep);
  if (first === -1) return { line: line, ch: len(ed, line) };
  const second = s.indexOf(sep, first + sep.length);
  if (second === -1) {
    const beforeFirst = s.slice(0, first).replace(/[ \t]+$/, "");
    if (!hasTextPartBeforeFirstSeparator(beforeFirst)) return { line: line, ch: len(ed, line) };
    return { line: line, ch: beforeFirst.length };
  }
  const beforeSecond = s.slice(0, second).replace(/[ \t]+$/, "");
  return { line: line, ch: beforeSecond.length };
}

function hasTextPartBeforeFirstSeparator(before) {
  let s = String(before || "");
  s = s.replace(/^\s*/, "");
  let m = s.match(/^([-*+]|\d+\.)\s+/);
  if (m) s = s.slice(m[0].length);
  m = s.match(/^\[[^\]]\]\s+/);
  if (m) s = s.slice(m[0].length);
  while (true) {
    const mt = s.match(/^#\S+\s*/);
    if (!mt) break;
    s = s.slice(mt[0].length);
  }
  s = s.trim();
  return s.length > 0;
}

function hasInlineTextBeforeSingleSeparator(s, prefixEnd, delimIndex) {
  let left = String(s || "").slice(0, Math.max(0, delimIndex));
  left = left.slice(Math.max(0, prefixEnd));
  left = left.replace(/^\s*/, "");

  while (true) {
    const mt = left.match(/^#\S+\s*/);
    if (!mt) break;
    left = left.slice(mt[0].length);
  }

  while (true) {
    const wl = left.match(/^\[\[[^\]]+\]\]\s*/);
    if (!wl) break;
    left = left.slice(wl[0].length);
  }

  left = left.trim();
  return left.length > 0;
}

function trimRightBeforeIndex(s, endExclusive) {
  let i = Math.max(0, Math.min(String(s || "").length, endExclusive));
  while (i > 0) {
    const c = s[i - 1];
    if (c === " " || c === "\t") {
      i--;
      continue;
    }
    break;
  }
  return i;
}

// ---- navigate-inline ----
function parseJsonFence(md, fenceName) {
  const m = String(md || "").match(new RegExp("```" + fenceName + "\\s*([\\s\\S]*?)```"));
  if (!m) return null;
  return JSON.parse(String(m[1] || "").trim());
}

function tokenOf(v) {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof v.token === "string") return v.token;
  return "";
}

async function loadNavigateRules(app, rulesPath) {
  const src = String(rulesPath || "").trim();
  const candidates = [];
  const pushCandidate = (p) => {
    const v = String(p || "").trim();
    if (!v) return;
    if (candidates.indexOf(v) !== -1) return;
    candidates.push(v);
  };

  pushCandidate(src);
  if (src.startsWith("./")) pushCandidate(src.slice(2));
  if (src.indexOf("/") !== -1) pushCandidate(src.slice(src.lastIndexOf("/") + 1));
  pushCandidate("RULES_TagWheel.md");
  pushCandidate("InlineOverhaul_Generated_RULES_TagWheel.md");

  let f = null;
  let usedPath = "";
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const af = app.vault.getAbstractFileByPath(cand);
    if (af) {
      f = af;
      usedPath = cand;
      break;
    }
  }

  if (!f) {
    throw new Error("Rules file not found: " + src + " (checked: " + candidates.join(", ") + ")");
  }

  const md = await app.vault.read(f);
  const io = parseJsonFence(md, "tagwheel-io") || {};
  const leftMode = parseJsonFence(md, "tagwheel-left-mode") || {};
  const dateRules = parseJsonFence(md, "tagwheel-date-rules") || {};

  const fields = Array.isArray(leftMode.fields) ? leftMode.fields : [];
  const byId = new Map();
  for (const f2 of fields) if (f2 && f2.id) byId.set(f2.id, f2);
  const typeRoots = [];
  const ctxRoots = new Set();
  const typeField = byId.get("type");
  const ctxField = byId.get("context");
  if (typeField && Array.isArray(typeField.values)) {
    const prefix = typeof typeField.prefix === "string" ? typeField.prefix : "#";
    for (const v of typeField.values) {
      const t = tokenOf(v);
      if (!t) continue;
      typeRoots.push(prefix + t);
    }
  }
  if (ctxField && Array.isArray(ctxField.values)) {
    const prefix = typeof ctxField.prefix === "string" ? ctxField.prefix : "#";
    for (const v of ctxField.values) {
      const t = tokenOf(v);
      if (!t) continue;
      ctxRoots.add(prefix + t);
    }
  }

  const markers = [];
  for (const key of ["due", "done", "cancelled", "start"]) {
    const rule = dateRules && dateRules[key];
    if (!rule) continue;
    if (typeof rule.preferredMarker === "string" && rule.preferredMarker) markers.push(rule.preferredMarker);
    if (Array.isArray(rule.markers)) for (const m of rule.markers) if (typeof m === "string" && m) markers.push(m);
  }

  return {
    rulesPathUsed: usedPath,
    delim: typeof io.separator1 === "string" && io.separator1 ? io.separator1 : "||",
    typeRoots,
    ctxRoots,
    trailingMarkers: Array.from(new Set(markers)),
    dateRegexSrc: "\\d{4}-\\d{2}-\\d{2}",
  };
}

function rootOf(tag) {
  const s = String(tag || "");
  const i = s.indexOf("/#");
  return i === -1 ? s : s.slice(0, i);
}

function navigateInline(editor, direction, navRules, rawCfg) {
  const cfg = pickNavigateInlineCfg(rawCfg);
  const delim = navRules && typeof navRules.delim === "string" && navRules.delim ? navRules.delim : "||";
  const trailingMarkers = navRules && Array.isArray(navRules.trailingMarkers) ? navRules.trailingMarkers : [];
  const dateReSrc = navRules && typeof navRules.dateRegexSrc === "string" && navRules.dateRegexSrc
    ? navRules.dateRegexSrc
    : "\\d{4}-\\d{2}-\\d{2}";
  const isWs = (c) => c === " " || c === "\t";
  const isTagToken = (s, idx) => s[idx] === "#" && idx + 1 < s.length && !isWs(s[idx + 1]);
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const parsePrefixEnd = (s) => {
    let i = 0;
    let m = s.match(/^([-*+])\s+/);
    if (m) i = m[0].length;
    else {
      m = s.match(/^(\d+)\.\s+/);
      if (m) i = m[0].length;
    }
    m = s.slice(i).match(/^\[([^\]])\]\s+/);
    if (m) i += m[0].length;
    return i;
  };

  const parseLeadingTagsAndDelim = (s, start, delim_) => {
    let j = start;
    const tags = [];
    let delimIndex = -1;
    while (true) {
      while (j < s.length && isWs(s[j])) j++;
      if (j >= s.length) break;
      if (delim_ && s.startsWith(delim_, j)) {
        delimIndex = j;
        break;
      }
      if (isTagToken(s, j)) {
        const mt = s.slice(j).match(/^#\S+/);
        if (!mt) break;
        const text = mt[0];
        tags.push({ text, start: j, end: j + text.length });
        j += text.length;
        continue;
      }
      break;
    }
    return { tags, delimIndex };
  };

  const skipWs = (s, i) => {
    let j = i;
    while (j < s.length && isWs(s[j])) j++;
    return j;
  };

  const computeContentEnd = (s, minEnd) => {
    if (!trailingMarkers.length) return s.length;
    const markerAlt = trailingMarkers.map(escapeRe).join("|");
    const tailEndRe = new RegExp("\\s*(?:" + markerAlt + ")\\s*" + dateReSrc + "\\s*$", "u");
    let end = s.length;
    while (true) {
      const sub = s.slice(0, end);
      const m = sub.match(tailEndRe);
      if (!m) break;
      end = end - m[0].length;
      if (end <= minEnd) break;
    }
    if (end < minEnd) end = minEnd;
    return end;
  };

  const hasDateTailAfterSingleSeparator = (s, delimIndex) => {
    if (delimIndex < 0) return false;
    let right = String(s || "").slice(delimIndex + delim.length);
    right = right.replace(/^\s*/, "");
    if (!right) return false;

    const bareDateRe = new RegExp("^" + dateReSrc + "(?:\\b|$)", "u");
    if (bareDateRe.test(right)) return true;

    const markers = trailingMarkers.filter((m) => typeof m === "string" && m);
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      const re = new RegExp("^" + escapeRe(marker) + "\\s*" + dateReSrc + "(?:\\b|$)", "u");
      if (re.test(right)) return true;
    }
    return false;
  };

  const uniqueSorted = (arr) => {
    const out = Array.from(new Set(arr.filter((n) => Number.isFinite(n))));
    out.sort((a, b) => a - b);
    return out;
  };

  const getLineInfo = (targetLine) => {
    if (targetLine < 0 || targetLine > editor.lastLine()) return null;
    const rawLine = String(nz(editor.getLine(targetLine), ""));
    const indent = (rawLine.match(/^(\s*)/) || ["", ""])[1];
    const s = rawLine.slice(indent.length);
    const prefixEnd = parsePrefixEnd(s);
    const parsed = parseLeadingTagsAndDelim(s, prefixEnd, delim);
    const tags = parsed.tags;
    let delimIndex = parsed.delimIndex;
    if (delimIndex === -1 && delim) {
      const anyDelim = s.indexOf(delim, prefixEnd);
      if (anyDelim !== -1) delimIndex = anyDelim;
    }

    const textStartNoDelimRel = tags.length ? skipWs(s, tags[tags.length - 1].end) : skipWs(s, prefixEnd);
    let textStartRel;
    if (delimIndex !== -1) textStartRel = skipWs(s, delimIndex + delim.length);
    else textStartRel = textStartNoDelimRel;

    const contentEndRel = computeContentEnd(s, textStartRel);
    let innerDelimRel = -1;
    if (delim) {
      innerDelimRel = s.lastIndexOf(delim, Math.max(0, contentEndRel - 1));
      if (innerDelimRel === delimIndex) innerDelimRel = -1;
      if (innerDelimRel !== -1 && innerDelimRel < textStartRel) innerDelimRel = -1;
    }

    const indentAbs = indent.length;
    const hardStartAbs = indentAbs + prefixEnd;
    const hardEndAbs = rawLine.length;
    let scopeStartAbs = indentAbs + textStartRel;
    let scopeEndAbs = indentAbs + (innerDelimRel !== -1 ? innerDelimRel : contentEndRel);

    const isSingleDelim = delimIndex !== -1 && innerDelimRel === -1;
    const singleSepLooksLikeSep2 = isSingleDelim && (
      hasInlineTextBeforeSingleSeparator(s, prefixEnd, delimIndex) ||
      hasDateTailAfterSingleSeparator(s, delimIndex)
    );
    if (singleSepLooksLikeSep2) {
      scopeStartAbs = indentAbs + textStartNoDelimRel;
      scopeEndAbs = indentAbs + trimRightBeforeIndex(s, delimIndex);
    }
    const zoneStart = cfg.boundaryJump ? hardStartAbs : scopeStartAbs;
    let zoneEnd = cfg.boundaryJump ? hardEndAbs : scopeEndAbs;
    if (zoneEnd < zoneStart) zoneEnd = zoneStart;

    return {
      line: targetLine,
      rawLine,
      zoneStart,
      zoneEnd,
      scopeStartAbs,
      scopeEndAbs,
    };
  };

  const cur = editor.getCursor();
  const lineNo = cur.line;
  const info = getLineInfo(lineNo);
  if (!info) return;
  const rawLine = info.rawLine;
  const zoneStart = info.zoneStart;
  const zoneEnd = info.zoneEnd;
  const scopeStartAbs = info.scopeStartAbs;
  const scopeEndAbs = info.scopeEndAbs;

  const anchors = [zoneStart, zoneEnd];

  const markerMatchers = trailingMarkers
    .filter((m) => typeof m === "string" && m)
    .sort((a, b) => b.length - a.length)
    .map((m) => ({
      marker: m,
      re: new RegExp("^" + escapeRe(m) + "\\s*" + dateReSrc),
    }));

  const collectWordAnchors = (line, startAbs, endAbs) => {
    const res = [];
    if (endAbs <= startAbs) return res;
    let i = startAbs;
    while (i < endAbs) {
      while (i < endAbs && isWs(line[i])) i++;
      if (i >= endAbs) break;

      if (delim && line.startsWith(delim, i)) {
        i += delim.length;
        continue;
      }

      let matched = false;
      for (let m = 0; m < markerMatchers.length; m++) {
        const mm = markerMatchers[m];
        if (!line.startsWith(mm.marker, i)) continue;
        const sub = line.slice(i, endAbs);
        const mt = sub.match(mm.re);
        if (mt && mt.index === 0) {
          res.push(i);
          i += mt[0].length;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      const wl = line.slice(i, endAbs).match(/^\[\[[^\]]+\]\]/);
      if (wl) {
        res.push(i);
        i += wl[0].length;
        continue;
      }

      const tg = line.slice(i, endAbs).match(/^#\S+/);
      if (tg) {
        res.push(i);
        i += tg[0].length;
        continue;
      }

      res.push(i);
      let j = i;
      while (j < endAbs && !isWs(line[j])) {
        if (delim && line.startsWith(delim, j)) break;
        j++;
      }
      if (j <= i) j = i + 1;
      i = j;
    }
    return res;
  };

  if (cfg.stepMode === "word") {
    anchors.push.apply(anchors, collectWordAnchors(rawLine, zoneStart, zoneEnd));
  } else if (cfg.stepMode === "sentence") {
    const sentenceStart = Math.max(scopeStartAbs, zoneStart);
    const sentenceEnd = Math.min(scopeEndAbs, zoneEnd);
    if (sentenceEnd > sentenceStart) {
      const textZone = rawLine.slice(sentenceStart, sentenceEnd);
      const endRe = /(\.\.\.|…|[.!?])(?=\s|$)/g;
      let foundSentenceBoundary = false;
      while (true) {
        const mt = endRe.exec(textZone);
        if (!mt) break;
        foundSentenceBoundary = true;
        anchors.push(sentenceStart + mt.index);
      }
      if (!foundSentenceBoundary) {
        anchors.push.apply(anchors, collectWordAnchors(rawLine, sentenceStart, sentenceEnd));
      }
    }

    if (cfg.boundaryJump) {
      if (zoneStart < scopeStartAbs) anchors.push.apply(anchors, collectWordAnchors(rawLine, zoneStart, Math.min(zoneEnd, scopeStartAbs)));
      if (scopeEndAbs < zoneEnd) anchors.push.apply(anchors, collectWordAnchors(rawLine, Math.max(zoneStart, scopeEndAbs), zoneEnd));
    }
  }

  const ordered = uniqueSorted(anchors);
  if (!ordered.length) return;

  const getBoundaryFallback = (dir) => {
    if (cfg.onBoundary === "stay") return { line: lineNo, ch: dir === "left" ? zoneStart : zoneEnd };
    if (cfg.onBoundary === "wrap") return { line: lineNo, ch: dir === "left" ? zoneEnd : zoneStart };
    const targetLine = dir === "left" ? lineNo - 1 : lineNo + 1;
    const nextInfo = getLineInfo(targetLine);
    if (!nextInfo) return { line: lineNo, ch: dir === "left" ? zoneStart : zoneEnd };
    return { line: nextInfo.line, ch: dir === "left" ? nextInfo.zoneEnd : nextInfo.zoneStart };
  };

  const posAbs = cur.ch;
  let target = null;

  if (cfg.stepMode === "begin-end") {
    if (direction === "left") {
      if (posAbs > zoneStart) target = { line: lineNo, ch: zoneStart };
      else target = getBoundaryFallback("left");
    } else {
      if (posAbs < zoneEnd) target = { line: lineNo, ch: zoneEnd };
      else target = getBoundaryFallback("right");
    }
  } else {
    if (direction === "left") {
      let nextAbs = null;
      for (let i = ordered.length - 1; i >= 0; i--) {
        if (ordered[i] < posAbs) {
          nextAbs = ordered[i];
          break;
        }
      }
      if (nextAbs === null) target = getBoundaryFallback("left");
      else target = { line: lineNo, ch: nextAbs };
    } else {
      let nextAbs = null;
      for (let i = 0; i < ordered.length; i++) {
        if (ordered[i] > posAbs) {
          nextAbs = ordered[i];
          break;
        }
      }
      if (nextAbs === null) target = getBoundaryFallback("right");
      else target = { line: lineNo, ch: nextAbs };
    }
  }
  if (!target) return;
  window.setTimeout(() => editor.setCursor(target), 0);
}

module.exports = {
  pickMoveLineCfg,
  pickMoveSelectionCfg,
  pickJumpCfg,
  pickNavigateInlineCfg,
  moveLine,
  moveSelection,
  jumpToHeader,
  loadNavigateRules,
  navigateInline,
};
