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
    /* Прокрутка при перемещении строки (10.13.36). */
    keepInView: typeof c.keepInView === "boolean" ? c.keepInView : true,
    viewPosition: normalizeViewPosition(c.viewPosition),
  };
}

/** Где оказывается перемещённая строка на экране (10.13.36). */
function normalizeViewPosition(value) {
  const v = String(value || "").trim();
  return v === "top" || v === "bottom" ? v : "center";
}

function pickMoveSelectionCfg(cfg, lineFormat) {
  const c = isObj(cfg) ? cfg : {};
  const lf = isObj(lineFormat) ? lineFormat : {};
  const sep = (v, fallback) => (typeof v === "string" && v ? v : fallback);
  const separator1 = sep(lf.separator1, sep(c.separator1, "||"));
  const cycle = Array.isArray(c.cycleOrder) && c.cycleOrder.length
    ? c.cycleOrder.slice()
    : (Array.isArray(c.leftToRight) && c.leftToRight.length ? c.leftToRight.slice() : ["#", "##", "###", "####", "#####", "1. ", "", "- "]);
  return {
    /*
     * `Continue past a Separator` для переноса текста (замечание заказчика
     * 2026-09-04). Полярность та же, что у одноимённого тумблера курсора
     * (`navigateInline.boundaryJump`): выключен — текст остаётся между
     * разделителями, включён — уходит куда угодно.
     *
     * Умолчание, в отличие от тумблера курсора, **включено**: до этой правки
     * перенос ходил через разделитель всегда, и заказчик такое поведение уже
     * принял — его пример 2026-09-02 (`- [ ] #/1 #todo || 123 ||` →
     * `- [ ] #/1 #todo 123 || ||`, одиннадцатое исключение к З3) на нём и
     * стоит. Выключенное умолчание молча отменило бы принятое поведение.
     */
    inlineBoundaryJump: typeof c.inlineBoundaryJump === "boolean" ? c.inlineBoundaryJump : true,
    separator1,
    separator2: sep(lf.separator2, sep(c.separator2, separator1)),
    inlineEnabled: typeof c.inlineEnabled === "boolean" ? c.inlineEnabled : (typeof c.enabled === "boolean" ? c.enabled : true),
    prefixCyclerEnabled: typeof c.prefixCyclerEnabled === "boolean" ? c.prefixCyclerEnabled : true,
    /* `Cycle in both directions` (10.13.11, В-12). Ключ был в конфиге и не
       читался никем: тумблер стоял в панели и ничего не делал. */
    rightCycles: typeof c.rightCycles === "boolean" ? c.rightCycles : true,
    indentFallbackEnabled: typeof c.indentFallbackEnabled === "boolean" ? c.indentFallbackEnabled : true,
    onCycleEnd: c.onCycleEnd === "wrap" ? "wrap" : "indent",
    leftToRight: cycle,
    rightToLeft: cycle.slice().reverse(),
    inlineMoveMode: typeof c.inlineMoveMode === "string" ? c.inlineMoveMode : "auto",
  };
}

/*
 * Настройки перехода по заголовкам.
 *
 * Разделители приходят вторым аргументом — из `pkm.lineFormat`, а не из ветки
 * `navigation.jumpToHeader`: в ней их нет и быть не должно. До 2026-09-04
 * никто их сюда и не передавал, а `lineEndPos` их спрашивала, — поэтому режим
 * `End of your text` молча работал как `Line end` у всех, чей разделитель не
 * `||`. Замечание заказчика 2026-09-04.
 *
 * Собственный список полей здесь не случаен: он отсекает всё, что не спросили.
 * Значит и разделители надо назвать, иначе они не доедут даже если их
 * передать (это и был второй разрыв той же цепочки).
 */
function pickJumpCfg(cfg, lineFormat) {
  const c = isObj(cfg) ? cfg : {};
  const lf = isObj(lineFormat) ? lineFormat : {};
  const sep = (v, fallback) => (typeof v === "string" && v ? v : fallback);
  const separator1 = sep(lf.separator1, sep(c.separator1, "||"));
  return {
    centerCursor: typeof c.centerCursor === "boolean" ? c.centerCursor : true,
    /* Место на экране после перехода (10.13.37). Разбор один и тот же, что у
       перемещения строки, поэтому и функция одна — `normalizeViewPosition`. */
    viewPosition: normalizeViewPosition(c.viewPosition),
    centerDelayMs: nInt(c.centerDelayMs, 60, 0),
    centerThrottleMs: nInt(c.centerThrottleMs, 200, 0),
    jumpMode: typeof c.jumpMode === "string" ? c.jumpMode : "edge",
    edgeMode: typeof c.edgeMode === "string" ? c.edgeMode : "start-end",
    jumpCursorPosition: typeof c.jumpCursorPosition === "string" ? c.jumpCursorPosition : "start",
    separator1,
    /* Второй разделитель по умолчанию равен первому: у заказчика оба `::`, и
       в панели это обычная настройка. */
    separator2: sep(lf.separator2, sep(c.separator2, separator1)),
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
    tableMove(editor, anchorLine, hasSel, bSelStart, bSelEnd, direction, total, scrollBefore, selRestore, cursorRestore, cfg);
    return;
  }

  const body = getBody(editor, anchorLine, hasSel, bSelStart, bSelEnd, cfg, total);
  if (!body) return;
  const { bStart, bEnd } = body;
  const insertAfter = findInsertAfter(editor, bStart, bEnd, direction, cfg, total, yamlEnd);
  if (insertAfter === null) return;
  applyMove(editor, bStart, bEnd, insertAfter, direction, total, scrollBefore, selRestore, cursorRestore, cfg);
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
  /*
   * Заголовок ищет цель за соседним заголовком того же уровня **только** при
   * `Headers with their sections`: там переезжает секция, и переезд от секции
   * к секции и есть замысел.
   *
   * При `Headers only` переносится одна строка, и цель обязана считаться как у
   * обычной строки. До 2026-09-02 условие не читалось здесь вовсе: тело
   * бралось из одной строки (`getBody`), а цель — за целую секцию, и заголовок
   * перелетал через неё. Заказчик: «при move-lines-heading = Headers only я
   * хочу, чтобы хедеры вели себя как обычные строки; сейчас перемещается
   * как-то непонятно» (D1, 2026-09-02). Название значения — `move as line` —
   * обещало ровно то, чего код не делал.
   *
   * Одиннадцатое исключение к З3, разрешение заказчика 2026-09-02.
   */
  if (cfg.headerMode === "move-with-section" && isHeader(myText)) {
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
  /* То же условие, что и вверх: за соседний заголовок цель ищется только при
     переносе заголовка вместе с секцией (D1, 2026-09-02). */
  if (cfg.headerMode === "move-with-section" && isHeader(myText)) {
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

function applyMove(editor, bStart, bEnd, insertAfterLine, direction, total, scrollBefore, selRestore, cursorRestore, cfg) {
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
  maybeRevealMovedRange(editor, movedStart, movedEnd, direction, scrollBefore, cfg);
}

function tableMove(editor, anchorLine, hasSel, bSelStart, bSelEnd, direction, total, scrollBefore, selRestore, cursorRestore, cfg) {
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
    maybeRevealMovedRange(editor, newStart, newEnd, direction, scrollBefore, cfg);
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
    maybeRevealMovedRange(editor, newStart, newEnd, direction, scrollBefore, cfg);
  }
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

/**
 * Прокрутка после перемещения строки (10.13.36).
 *
 * **Что здесь было и почему не работало.** Прежняя версия сперва спрашивала
 * `editor.getViewport()` и выходила, если его нет. У редактора Obsidian такого
 * метода нет вовсе — список его методов снят из `app.js` 1.13.7, — значит
 * функция выходила первой же строкой **всегда и у всех**. Второй разрыв той
 * же цепочки стоял ниже: `editor.scrollIntoView({line, ch})` получает
 * **точку**, а Obsidian ждёт **отрезок** и внутри читает `range.from`; на
 * `undefined` он падает, и падение съедал `catch`. Оба — тихий отказ (У-41).
 *
 * Прокруткой поэтому распоряжалась платформа: `replaceRange`, `setSelection`
 * и `setCursor` шлют транзакцию с `scrollIntoView: true` и режимом
 * «ближайшее». «Ближайшее» кладёт строку к верхнему краю, если она была выше
 * экрана, и к нижнему, если ниже, — отсюда и «прыгает произвольно».
 *
 * **Что здесь теперь.** Выключено — экран остаётся на месте. Включено —
 * строка встаёт туда, куда просили: по центру, к верху или к низу.
 */
function maybeRevealMovedRange(editor, startLine, endLine, direction, scrollBefore, cfg) {
  if (!cfg.keepInView) {
    holdScrollState(editor, scrollBefore);
    return;
  }
  const line = direction === "up" ? startLine : endLine;
  revealLineAt(editor, line, cfg.viewPosition);
}

/**
 * Удержать прокрутку на месте.
 *
 * Одной синхронной записи мало: платформа уже назначила свою прокрутку и
 * применяет её в своём проходе измерения, то есть **после** нашей записи.
 * Поэтому та же запись повторяется в следующем кадре, когда проход уже
 * прошёл. Без второй записи «выключено» работало бы через раз — а «через раз»
 * это ровно то, на что заказчик и жалуется.
 */
function holdScrollState(editor, state) {
  if (!state) return;
  restoreScrollStateSafe(editor, state);
  try {
    const win = editor && editor.cm && editor.cm.dom && editor.cm.dom.ownerDocument
      ? editor.cm.dom.ownerDocument.defaultView
      : null;
    const raf = win && typeof win.requestAnimationFrame === "function"
      ? win.requestAnimationFrame.bind(win)
      : null;
    if (raf) raf(() => restoreScrollStateSafe(editor, state));
  } catch (_) {}
}

/**
 * Поставить строку в названное место экрана.
 *
 * Считает не сам: у CodeMirror для этого есть `y: "center" | "start" | "end"`,
 * и оно уже умеет и края документа, и строки любой высоты. Обёртка Obsidian
 * наружу отдаёт только `center` и `nearest`, поэтому эффект берётся у самого
 * класса представления — он же конструктор живого редактора.
 *
 * Запасной путь — обёртка Obsidian, и ей передаётся **отрезок** `{from, to}`,
 * а не точка: точку она не понимает, и на этом здесь уже обжигались.
 */
function revealLineAt(editor, line, position, ch) {
  const pos = { line, ch: Number.isFinite(ch) ? ch : 0 };
  try {
    const view = editor && editor.cm;
    const ViewClass = view && view.constructor;
    if (view && typeof view.dispatch === "function"
      && ViewClass && typeof ViewClass.scrollIntoView === "function"
      && typeof editor.posToOffset === "function") {
      const y = position === "top" ? "start" : (position === "bottom" ? "end" : "center");
      view.dispatch({ effects: ViewClass.scrollIntoView(editor.posToOffset(pos), { y }) });
      return;
    }
  } catch (_) {}
  try { editor.scrollIntoView({ from: pos, to: pos }, position === "center"); } catch (_) {}
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

/*
 * Границы, за которые перенос выделенного текста не выходит.
 *
 * Замечание заказчика 2026-09-04: у курсора внутри строки такая опция есть
 * (`Continue past a Separator`), а у переноса текста не было, и выделенная
 * фраза уезжала за первый разделитель в теги и за второй в даты.
 *
 * Зона считается тем же правилом, что у курсора на прибытии
 * (`lineEndPos`): первый разделитель ищется первым, второй — вторым и после
 * первого. Разделителя нет — с этой стороны границей становится сама строка:
 * за её край перенос всё равно не ходит.
 *
 * `null` значит «границ нет» — тумблер включён, и поведение то же, что было
 * до правки.
 */
function moveTextBounds(editor, line, rules) {
  if (!rules || rules.inlineBoundaryJump === true) return null;
  const s = txt(editor, line);
  const lineStart = editor.posToOffset({ line: line, ch: 0 });
  const sep1 = typeof rules.separator1 === "string" && rules.separator1 ? rules.separator1 : "||";
  const sep2 = typeof rules.separator2 === "string" && rules.separator2 ? rules.separator2 : sep1;
  let loRel = 0;
  let hiRel = s.length;
  const first = s.indexOf(sep1);
  if (first !== -1) {
    loRel = first + sep1.length;
    const second = s.indexOf(sep2, first + sep1.length);
    if (second !== -1) hiRel = second;
  }
  /*
   * Зазор у разделителя в зону не входит. Иначе посимвольный шаг менял текст
   * местами с этим пробелом: `:: купить` превращалось в `::купить `, — фраза
   * формально оставалась внутри зоны, а зазор съедала. Правило то же, каким
   * `lineEndPos` подрезает хвост перед вторым разделителем.
   */
  while (loRel < hiRel && isHorizSpace(s[loRel])) loRel++;
  while (hiRel > loRel && isHorizSpace(s[hiRel - 1])) hiRel--;
  return { lo: lineStart + loRel, hi: lineStart + hiRel };
}

// ---- move-selection ----
function moveSelection(editor, direction, rawCfg, lineFormat) {
  const rules = pickMoveSelectionCfg(rawCfg, lineFormat);
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
  /*
   * Границы считаются по строке курсора: перенос текста живёт в одной строке,
   * многострочное выделение сюда не доходит (проверено выше).
   */
  const bounds = moveTextBounds(editor, from.line, rules);
  if (mode === "char") bubbleSwapByCodePoint(doc, editor, a, b, direction, bounds);
  else jumpByWordToken(doc, editor, a, b, direction, bounds);
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
function bubbleSwapByCodePoint(doc, editor, a, b, direction, bounds) {
  const sel = doc.slice(a, b); if (!sel) return;
  if (direction === "left") {
    const prevStart = prevCodePointStart(doc, a); if (prevStart == null) return;
    /* Тумблер `Continue past a Separator` выключен: за разделитель не ходим. */
    if (bounds && prevStart < bounds.lo) return;
    const before = doc.slice(prevStart, a); if (!before) return;
    const newDoc = doc.slice(0, prevStart) + sel + before + doc.slice(b);
    if (newDoc !== doc) editor.setValue(newDoc);
    editor.setSelection(editor.offsetToPos(prevStart), editor.offsetToPos(prevStart + sel.length));
    return;
  }
  const nextEnd = nextCodePointEnd(doc, b); if (nextEnd == null) return;
  if (bounds && nextEnd > bounds.hi) return;
  const after = doc.slice(b, nextEnd); if (!after) return;
  const newDoc = doc.slice(0, a) + after + sel + doc.slice(nextEnd);
  if (newDoc !== doc) editor.setValue(newDoc);
  const newA = a + after.length;
  editor.setSelection(editor.offsetToPos(newA), editor.offsetToPos(newA + sel.length));
}
/**
 * Единица перескока — **целый токен строки**, а не буквенная его часть.
 *
 * Раньше токеном считался подряд идущий набор «символов слова», а всё
 * остальное между ним и переносимым текстом объявлялось зазором. У тега
 * `#todo` в единицу попадало `todo`, решётка оставалась на месте — и текст
 * встраивался внутрь тега: заказчик прислал `- [ ] #/1 #123 || todo`,
 * ожидая `- [ ] #/1 #todo 123 ||` (свободное замечание, 2026-09-02). Со
 * ссылкой то же: `[[` и `]]` символами слова не являются, и текст уезжал
 * внутрь скобок.
 *
 * Теперь токен — то, что стоит **между пробелами**, а зазор — только сами
 * пробелы. Это не новое правило, а то же самое, каким живёт весь движок
 * (`split(/\s+/)` в разборе строки), и потому оно не разойдётся с ним: тег,
 * ссылка, эмодзи-элемент и разделитель переставляются целиком. В обычном
 * тексте единица остаётся словом.
 *
 * Одиннадцатое исключение к З3, разрешение заказчика 2026-09-02.
 *
 * Чего это **не** лечит: эмодзи-элемент из двух слов (`📅2026-09-02 20:43`)
 * между пробелами не помещается, и здесь он по-прежнему два токена. Это то же
 * допущение движка, что и в Т-14; починка там.
 */
function isTokenChar(ch) {
  if (ch == null) return false;
  /* Перенос строки токеном не бывает: иначе набор перешёл бы на соседнюю. */
  if (ch === "\n") return false;
  return !isHorizSpace(ch);
}

function jumpByWordToken(doc, editor, a, b, direction, bounds) {
  while (a < b && isHorizSpace(doc[a])) a++;
  while (b > a && isHorizSpace(doc[b - 1])) b--;
  const phrase = doc.slice(a, b); if (!phrase) return;
  if (direction === "left") {
    let i = a; while (i > 0 && isHorizSpace(doc[i - 1])) i--; const gap = doc.slice(i, a);
    const tEnd = i; while (i > 0 && isTokenChar(doc[i - 1])) i--; const tStart = i;
    if (tStart === tEnd) return; const token = doc.slice(tStart, tEnd);
    /* Соседний токен лежит за разделителем — меняться с ним нечем. */
    if (bounds && tStart < bounds.lo) return;
    const newDoc = doc.slice(0, tStart) + phrase + gap + token + doc.slice(b);
    if (newDoc !== doc) editor.setValue(newDoc);
    editor.setSelection(editor.offsetToPos(tStart), editor.offsetToPos(tStart + phrase.length));
    return;
  }
  let i = b; while (i < doc.length && isHorizSpace(doc[i])) i++; const gap = doc.slice(b, i);
  const tStart = i; while (i < doc.length && isTokenChar(doc[i])) i++; const tEnd = i;
  if (tStart === tEnd) return; const token = doc.slice(tStart, tEnd);
  if (bounds && tEnd > bounds.hi) return;
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

  /*
   * Симметричный цикл (В-12, разрешение заказчика 2026-09-01 — восьмое
   * исключение к З3).
   *
   * Здесь стояло `currentIndent > 0 || isBullet(line)`, и второе слагаемое
   * уводило буллит в отступ: с обычной строки `Move right` циклировал ровно
   * один раз — строка становилась буллитом, — а дальше только сдвигал её.
   * `Move left` при нулевом отступе циклировал сколько угодно.
   *
   * Чем это управляется, решает `Cycle in both directions`: включён — правое
   * направление циклирует наравне с левым, выключен — правое только сдвигает,
   * и смена вида строки остаётся за `Move left`.
   */
  const rightMayCycle = rules.prefixCyclerEnabled && rules.rightCycles;
  if (currentIndent > 0 || (isBullet(line) && !rightMayCycle)) {
    if (rules.indentFallbackEnabled) {
      editor.replaceRange(INDENT, { line: lineNo, ch: 0 });
      editor.setCursor({ line: lineNo, ch: cur.ch + indentWidth });
    }
    return;
  }

  if (rightMayCycle) {
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
function isHighSurrogate(code) { return code >= 0xd800 && code <= 0xdbff; }
function isLowSurrogate(code) { return code >= 0xdc00 && code <= 0xdfff; }
function prevCodePointStart(str, index) { if (index <= 0) return null; let j = index - 1; const c = str.charCodeAt(j); if (isLowSurrogate(c) && j - 1 >= 0) { const p = str.charCodeAt(j - 1); if (isHighSurrogate(p)) j -= 1; } return j; }
function nextCodePointEnd(str, index) { if (index >= str.length) return null; const c = str.charCodeAt(index); if (isHighSurrogate(c) && index + 1 < str.length) { const n = str.charCodeAt(index + 1); if (isLowSurrogate(n)) return index + 2; } return index + 1; }

// ---- jump-to-header ----
function jumpToHeader(editor, direction, rawCfg, lineFormat) {
  const cfg = pickJumpCfg(rawCfg, lineFormat);
  const cur = editor.getCursor();
  const yamlEnd = findYamlEnd(editor);
  if (yamlEnd !== -1 && cur.line >= 0 && cur.line <= yamlEnd) {
    /*
     * Курсор внутри свойств заметки. Вверх идти некуда: выше frontmatter
     * ничего нет, и раньше переход уводил на нулевую строку — внутрь тех же
     * свойств. Вниз — в начало безымянной секции, то есть на первую строку
     * после frontmatter (решение заказчика В-20 от 2026-09-02).
     */
    if (direction === "up") return;
    return setCursorRobustCentered(editor, sectionAnchorsAvoidTables(editor, -1, cfg).startPos, cfg);
  }
  /*
   * Заголовка выше курсора нет — значит, курсор в **безымянной секции**:
   * тексте от первой строки после frontmatter до первого заголовка. Она
   * участвует в переходах наравне с остальными (решение заказчика В-20 от
   * 2026-09-02, D2).
   *
   * Здесь стояло `findNextHeader`: курсор из этого текста считался стоящим в
   * ПЕРВОЙ секции, то есть ниже себя, и переход назад уводил его в начало
   * заметки. Заметка без заголовков вовсе тогда не двигалась совсем; теперь
   * она — одна безымянная секция, и переходы работают внутри неё.
   */
  const curH = findPrevHeader(editor, cur.line);
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
    return jumpByLineMode(editor, cur, direction, cfg);
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

/*
 * «Строка за строкой»: заголовок — такая же строка, как остальные
 * (замечание заказчика 2026-09-04, вечер; PRD 10.13.24).
 *
 * Раньше режим ходил по секциям, а `sectionContentRange` начинает со строки
 * **после** заголовка. Дойдя до конца секции, переход брал следующий
 * заголовок и вставал на первую строку под ним — сам заголовок оставался
 * пропущен. Секции этому режиму не нужны вовсе: они предмет режима
 * `Heading to heading`.
 *
 * Поэтому обход идёт по всей заметке, а что считать остановкой — решает
 * `isContentLine`: пустые строки, линейки и строки таблиц она пропускает, а
 * заголовок остановкой считает без единого условия. Верхняя граница —
 * первая строка после свойств заметки: выше неё переход не идёт (решение
 * заказчика В-20 от 2026-09-02).
 */
function jumpByLineMode(editor, cur, direction, cfg) {
  const curLine = cur.line;
  const line = direction === "down"
    ? findNextContentLineInRange(editor, curLine + 1, editor.lastLine())
    : findPrevContentLineInRange(editor, curLine - 1, unnamedSectionStart(editor));
  if (line === -1) return;
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

  /*
   * Выше первого заголовка лежит **безымянная секция**, а не «начало
   * заметки»: решение заказчика В-20 от 2026-09-02. Раньше здесь стоял откат
   * на нулевую строку, и переход назад из первой секции уезжал в самое начало
   * — заказчик прочёл это как промах (D2).
   *
   * Из безымянной секции наверх идти некуда: она первая. Курсор остаётся на
   * месте, как у обычной строки на первой строке заметки.
   */
  if (curH < 0) return;
  const prevH = findPrevHeader(editor, curH - 1);
  const prevAnchors = sectionAnchorsAvoidTables(editor, prevH === -1 ? -1 : prevH, cfg);
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
/**
 * Прокрутка после перехода по заголовкам (10.13.37).
 *
 * Тумблер прежний (`centerCursor`), а вот «по центру» стало одним из трёх
 * положений — заказ заказчика 2026-09-06 «такая же опция, как у перемещения
 * строки». Само место на экране считает `revealLineAt` — та же функция, что и
 * у перемещения: одно правило живёт в одном месте (У-32). Прежняя строка
 * звала обёртку Obsidian с `center = true`, и это ровно её `center`.
 */
function centerOnCursorOnce(ed, p, cfg) { if (!cfg.centerCursor) return; if (!globalThis.__jumpCenterState) globalThis.__jumpCenterState = { t: 0, line: -1 }; const st = globalThis.__jumpCenterState; const now = Date.now(); if (now - st.t < cfg.centerThrottleMs && st.line === p.line) return; st.t = now; st.line = p.line; setTimeout(() => { try { revealLineAt(ed, p.line, cfg.viewPosition, p.ch); } catch (_) {} }, cfg.centerDelayMs); }
async function setCursorRobustCentered(ed, p, cfg) { const apply = () => { ed.setCursor(p); if (typeof ed.focus === "function") ed.focus(); }; apply(); await sleep(0); apply(); await sleep(40); apply(); centerOnCursorOnce(ed, p, cfg); }
function txt(ed, l) { return String(nz(ed.getLine(l), "")); }
function len(ed, l) { return txt(ed, l).length; }
function isBlank(ed, l) { return txt(ed, l).trim().length === 0; }
function isTableLineText(s) { return String(nz(s, "")).trimStart().startsWith("|"); }
function isDashSepText(s) { return /^-+$/.test(String(nz(s, "")).trim()); }
function findPrevHeader(ed, fromLine) { for (let l = Math.min(fromLine, ed.lastLine()); l >= 0; l--) if (isHeader(ed.getLine(l))) return l; return -1; }
function findNextHeader(ed, fromLine) { const max = ed.lastLine(); for (let l = Math.max(0, fromLine + 1); l <= max; l++) if (isHeader(ed.getLine(l))) return l; return -1; }
/*
 * Начало безымянной секции — текста выше первого заголовка.
 *
 * Решение заказчика В-20 от 2026-09-02: этот текст считается такой же
 * секцией, только без строки-заголовка. Выше первой строки после frontmatter
 * переход не идёт: свойства заметки — не место, куда прыгают.
 */
function unnamedSectionStart(ed) { const yamlEnd = findYamlEnd(ed); return yamlEnd === -1 ? 0 : yamlEnd + 1; }
/*
 * Содержимое секции. `headerLine === -1` — безымянная секция: у неё нет
 * строки-заголовка, и начинается она сразу после frontmatter.
 */
function sectionContentRange(ed, headerLine) { const max = ed.lastLine(); const nextH = findNextHeader(ed, headerLine); const a = headerLine < 0 ? unnamedSectionStart(ed) : headerLine + 1; return { a, b: nextH === -1 ? max : nextH - 1, nextH }; }
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
  /* Секция пуста: у обычной остаётся её заголовок, у безымянной — её первая
     строка. Строки с номером -1 не существует, и прыгать туда нельзя. */
  const fallback = headerLine < 0 ? unnamedSectionStart(ed) : headerLine;
  if (a > b) return { startPos: targetPosForLine(ed, fallback, cfg), endPos: targetPosForLine(ed, fallback, cfg) };
  let startLine = -1; for (let l = a; l <= b; l++) { const s = txt(ed, l); if (isBlank(ed, l) || isDashSepText(s) || isTableLineText(s)) continue; startLine = l; break; }
  let endLine = -1; for (let l = b; l >= a; l--) { const s = txt(ed, l); if (isBlank(ed, l) || isDashSepText(s) || isTableLineText(s)) continue; endLine = l; break; }
  if (startLine === -1 || endLine === -1) return { startPos: targetPosForLine(ed, fallback, cfg), endPos: targetPosForLine(ed, fallback, cfg) };
  return { startPos: targetPosForLine(ed, startLine, cfg), endPos: targetPosForLine(ed, endLine, cfg) };
}

function lineEndPos(ed, line, cfg) {
  const s = txt(ed, line);
  if (!cfg || cfg.jumpCursorPosition !== "section-end") return { line: line, ch: len(ed, line) };
  const sep = typeof (cfg && cfg.separator1) === "string" && cfg.separator1 ? cfg.separator1 : "||";
  /* Второй разделитель ищется вторым разделителем, а не первым: у заказчика
     оба `::` и разницы не видно, но в панели это две разные настройки. */
  const sep2 = typeof (cfg && cfg.separator2) === "string" && cfg.separator2 ? cfg.separator2 : sep;
  const first = s.indexOf(sep);
  if (first === -1) return { line: line, ch: len(ed, line) };
  const second = s.indexOf(sep2, first + sep.length);
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
  /*
   * Прежнее место служебного файла — корень vault. Остаётся последним
   * кандидатом, а не новым умолчанием: новый путь приходит сюда первым
   * аргументом из конфига, и объявить его здесь во второй раз значило бы
   * развести два объявления одного пути (У-32). Эта строка нужна тому, у
   * кого файл ещё лежит в корне (переезд 2026-09-04, решение В-39).
   */
  pushCandidate("InlineOverhaul_Generated_RULES_TagWheel.md");

  let md = null;
  let usedPath = "";
  const adapter = app && app.vault ? app.vault.adapter : null;
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const af = app.vault.getAbstractFileByPath(cand);
    if (af) {
      md = await app.vault.read(af);
      usedPath = cand;
      break;
    }
    /*
     * Запасной путь через адаптер — единственный работающий для файла в папке
     * плагина: `.obsidian/**` vault не индексирует, и `getAbstractFileByPath`
     * такой путь не находит вовсе. У общего чтения правил
     * (`readRulesMarkdownWithFallback`) эта ветка есть с самого начала, у
     * навигации её не было — и переезд файла погасил бы обе команды курсора
     * внутри строки целиком (решение В-39 от 2026-09-04).
     */
    if (adapter && typeof adapter.read === "function") {
      try {
        md = await adapter.read(cand);
        usedPath = cand;
        break;
      } catch (_) {}
    }
  }

  if (md === null) {
    throw new Error("Rules file not found: " + src + " (checked: " + candidates.join(", ") + ")");
  }

  const io = parseJsonFence(md, "tagwheel-io") || {};
  const leftMode = parseJsonFence(md, "tagwheel-left-mode") || {};
  const rightMode = parseJsonFence(md, "tagwheel-right-mode") || {};
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
  /*
   * Метки берутся ещё и у самих Field (замечание заказчика 2026-09-06).
   *
   * Блок `tagwheel-date-rules` описывает четыре именованных правила дат, и у
   * заказчика он пуст: его поле-дата называется `date_due` и приезжает не
   * оттуда, а из списка Field — со своим `marker`, тем же эмодзи. Навигация
   * про эту метку не знала вовсе, и единственный `::` на строке читался как
   * первый разделитель, а не как второй: зоной текста становился сам хвост с
   * датой, и курсор вставал **после** разделителя. Признак был ровно такой,
   * как в У-56: значение до функции не доезжает, а пин на неё зелёный.
   *
   * Field с меткой бывает в обоих блоках — элемент можно поставить и слева, —
   * поэтому читаются оба, а `Set` ниже снимает повторы.
   */
  for (const block of [leftMode, rightMode]) {
    const list = block && Array.isArray(block.fields) ? block.fields : [];
    for (const f3 of list) {
      if (f3 && typeof f3.marker === "string" && f3.marker) markers.push(f3.marker);
    }
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

  /*
   * Конец списочного знака. Пробел после знака **один**, и это не мелочь
   * (замечание заказчика 2026-09-06): `\s+` съедал и второй пробел, а второй
   * пробел — это и есть пустой слот под текст в строке `-  :: 📅…`. Съеденный
   * слот уезжал в «границу строки», ниже которой курсор не опускают, и курсор
   * вставал вплотную к разделителю вместо того места, где слово начнётся.
   */
  const parsePrefixEnd = (s) => {
    let i = 0;
    let m = s.match(/^([-*+])\s/);
    if (m) i = m[0].length;
    else {
      m = s.match(/^(\d+)\.\s/);
      if (m) i = m[0].length;
    }
    m = s.slice(i).match(/^\[([^\]])\]\s/);
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
    let zoneStart = cfg.boundaryJump ? hardStartAbs : scopeStartAbs;
    let zoneEnd = cfg.boundaryJump ? hardEndAbs : scopeEndAbs;
    /*
     * Слот под текст пуст — начало обгоняет конец (замечание заказчика
     * 2026-09-06). Так выглядит строка, у которой Field завели на пустой:
     * `-  :: 📅…`. Начало считается пропуском пробелов вперёд от списочного
     * знака и уезжает на сам разделитель, конец — обрезкой пробелов назад от
     * него и встаёт сразу за знаком. Схлопывать надо к **концу**: там текст и
     * начался бы, и напечатанное туда слово не слипнется с разделителем. До
     * этой правки схлопывалось к началу, и курсор вставал вплотную к `::`.
     * Ниже `hardStartAbs` не опускаемся — до списочного знака зоны нет.
     */
    if (zoneEnd < zoneStart) {
      zoneStart = Math.max(hardStartAbs, zoneEnd);
      zoneEnd = zoneStart;
    }

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
      /*
       * Конца предложения в зоне нет — шаг идёт в её начало и конец, а не
       * пересобирается по словам.
       *
       * Здесь стояло `collectWordAnchors`, и `sentence` на строке без точки
       * вёл себя как `word`: заказчик ждал прыжка в начало и конец, как при
       * `straight to the start or end` (D3, решение В-17 от 2026-09-02,
       * девятое исключение к З3). Причина замены, а не добавления: со словами
       * в списке остановок начало и конец зоны терялись среди них, и разницы
       * между двумя режимами не было вовсе.
       */
      if (!foundSentenceBoundary) {
        anchors.push(sentenceStart);
        anchors.push(sentenceEnd);
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
