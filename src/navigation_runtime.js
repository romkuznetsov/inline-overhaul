"use strict";

/*
 * Общие помощники приезжают литеральным `require` — так же, как у всякого
 * другого модуля рантайма (У-89), и запасных веток у них нет ни одной.
 *
 * **До 2026-09-11 половина файла спрашивала их у шва**, который ставит точка
 * входа, и за отказом шва стояли живые копии `isObj` и `nz` — при том, что
 * модуль был подключён строкой ниже и просто не спрашивался. У человека
 * работал общий модуль; всюду, где этот файл зовут напрямую — а так его зовут
 * проверки, — выполнялись копии (У-140). Шов снят ревизией, заход 3.
 */
const __sharedUtils = require("./core/shared_utils.js");

/*
 * Правила PKM для навигации собираются из настроек, а не из служебного файла
 * `generated_rules.md` (PRD 10.13.52, П-8, шаг первый; решение заказчика
 * 2026-09-11). Форму отдаёт общий модуль — тот самый, из которого собирается
 * и сама заметка: одно объявление на оба хода (У-32). Разбор — у
 * `buildNavigateRules` ниже.
 */
const __rulesShape = require("./core/pkm_rules_shape.js");

/*
 * Где на строке кончается текст человека — правило **одно**, и живёт оно в
 * `pkm_macro_shared.js` (`getTextSlotBounds` и `getCursorAtTextEnd`). Им же
 * ставят курсор все движки PKM.
 *
 * Здесь было своё объявление того же правила, и оно промахивалось ровно там,
 * где разделители разные: значение элемента считало текстом человека, а
 * пустой слот под текст — местом вплотную к разделителю (замечание `S4`
 * 2026-09-12, шесть случаев с его экрана).
 */
const __macroShared = require("./core/pkm_macro_shared.js");

function isObj(x) {
  return __sharedUtils.isObj(x);
}

function nz(v, dflt) {
  return __sharedUtils.nz(v, dflt);
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
  /* Умолчание — из общего дома, а не рядом с чтением (У-186). */
  const separator1 = sep(lf.separator1, sep(c.separator1, __sharedUtils.DEFAULT_SEPARATORS.separator1));
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
    /*
     * `Step out of the word` (замечание заказчика 2026-09-08, тридцать
     * четвёртое исключение к З3). Имя обязано стоять здесь: сборщик
     * перечисляет поля по одному, и настройка, которую он не назвал, до
     * движка не доезжает молча — этим уже куплен У-56.
     */
    inlineWordEscape: typeof c.inlineWordEscape === "boolean" ? c.inlineWordEscape : false,
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
  /* Умолчание — из общего дома, а не рядом с чтением (У-186). */
  const separator1 = sep(lf.separator1, sep(c.separator1, __sharedUtils.DEFAULT_SEPARATORS.separator1));
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
    /* Метки элементов: по ним общее правило отличает хвост значений от текста
       человека. Приезжают тем же путём, что и разделители. */
    markers: Array.isArray(lf.markers) ? lf.markers.slice() : (Array.isArray(c.markers) ? c.markers.slice() : []),
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
    /*
     * Где курсор оказывается, входя в текст снаружи. Настройка чужой группы —
     * `Cursor position after jumping`, — и это выбор заказчика: одна строка на
     * оба хода. Правило её читает одно, `textEntryAnchor`.
     */
    textEntry: textEntryAnchor(c),
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
  const movedStart = newBodyStart;
  const movedEnd = newBodyStart + (bEnd - bStart);
  /*
   * Запись идёт правкой окна изменившихся строк, а не заменой документа
   * (его замечание 2026-09-20, пункт 11: «при move-lines up\down нумерованного
   * списка нумерация не восстанавливается»).
   *
   * **Нумерацию правит сама Obsidian**, фильтром транзакций `sj(e)` в
   * `app.js` 1.13.7: он смотрит затронутые строки и дописывает изменение с
   * `userEvent: "input.renumber"`. Но первым же условием он **выходит**, если
   * транзакция помечена `userEvent: "set"`, — а `Editor.setValue` отправляет
   * ровно её (`n.dispatch({changes:{…}, userEvent:"set"})` там же). То есть
   * перенос строк говорил платформе «это не правка человека», и нумерация
   * оставалась прежней: у строки, уехавшей под другого родителя, оставался её
   * старый номер.
   *
   * `replaceRange` четвёртым аргументом принимает `userEvent`, и без него
   * транзакция уходит без пометки — фильтр работает. Тем же вызовом и тем же
   * окном пишет перенос строк таблицы (`tableMove`), так что второго правила
   * тут не заводится.
   *
   * Окно — только изменившиеся строки: фильтр нумерует **от затронутых**, и
   * замена документа целиком перенумеровала бы все списки заметки разом.
   */
  if (newDoc !== doc) {
    const from = Math.min(bStart, newBodyStart);
    const to = Math.max(bEnd, movedEnd);
    /*
     * **Номера нумерованного списка приводим в порядок сами** — его второе
     * замечание по тому же тесту 2026-09-20: «после move line up/down
     * нумерация осталась сбитой: `2. третий дочерний`, ожидалось `1. третий
     * дочерний`».
     *
     * Фильтр Obsidian считает номер первого элемента подсписка по **старому**
     * документу, и строка, уехавшая в начало подсписка, приносит туда свой
     * прежний номер. Измерено на её настоящем фильтре, вырезанном из
     * `app.js`: перенос на одну позицию она нумерует верно, а перенос в
     * начало подсписка — нет. Тем же стендом измерено, что готовые верные
     * номера она не трогает — поэтому мы не спорим с ней, а подаём ей
     * посчитанное. Правило живёт одним объявлением в `shared_utils`.
     */
    const numbered = __sharedUtils.renumberOrderedWindow(finalLines, from, to);
    editor.replaceRange(
      numbered.slice(from, to + 1).join("\n"),
      { line: from, ch: 0 },
      { line: to, ch: nz(lines[to], "").length },
    );
  }
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
  } catch (_) {
    /*
     * Украшение: прокрутка не вернулась на прежнее место, а строка, ради
     * которой её запоминали, уже переставлена. Уронить команду перемещения
     * из-за вида — обменять сделанную работу на её оформление.
     */
  }
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
  } catch (_) {
    /*
     * Проба и украшение сразу: окна у редактора может не быть вовсе —
     * `ownerDocument.defaultView` пуст у отсоединённого узла, — и тогда
     * второй записи не будет. Без неё «не прокручивать» сработает через раз,
     * а текст от этого не изменится ни на знак.
     */
  }
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
  } catch (_) {
    /*
     * Проба: эффекта прокрутки у класса представления может не быть — версия
     * платформы другая, класс не тот. Это ответ, а не отказ: следующей
     * строкой стоит обёртка Obsidian, отвечающая на тот же вопрос.
     */
  }
  try {
    editor.scrollIntoView({ from: pos, to: pos }, position === "center");
  } catch (_) {
    /*
     * Украшение, и это последний из двух путей: место на экране не выбралось
     * ни одним. Курсор при этом уже стоит там, куда его вёл переход, — видно
     * будет не то место, а не не то поведение.
     */
  }
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
 * **Стена у оформления строки стоит всегда** — его замечание 2026-09-22
 * («при переносе текста влево, оно втыкается в префикс»). Знак списка, задача,
 * номер, цитата и решётки заголовка тексту не принадлежат: они принадлежат
 * строке, и меняться с ними местами нечему. Измерено до правки: четвёртое
 * нажатие давало `слово3- ( ...`, `- [слово3 ] ...` и `1слово3. ...`, то есть
 * рвало сам знак, а посимвольный шаг с включённым `Step out of the word`
 * уезжал через перевод строки в соседнюю (`- одиндв\n- а`). Конец строки
 * стеной был и раньше — перенос строки токеном не считается, — а начала у
 * стены не было вовсе.
 *
 * Тумблер `Continue past a Separator` эту стену не отменяет: он про
 * разделители, а не про разметку Obsidian. Начало строки спрашивается у
 * общего дома (`lineStartOf` в `shared_utils`), а не считается здесь заново
 * (У-150).
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
 * Границы возвращаются всегда: тумблер решает только, сужать ли их
 * разделителями.
 */
function moveTextBounds(editor, line, rules) {
  const s = txt(editor, line);
  const lineStart = editor.posToOffset({ line: line, ch: 0 });
  /* Оформление начала строки тексту не принадлежит — стена стоит всегда. */
  let loRel = __sharedUtils.linePrefixLength(s, true);
  let hiRel = s.length;
  if (loRel > hiRel) loRel = hiRel;
  if (rules && rules.inlineBoundaryJump !== true) {
    const sep1 = typeof rules.separator1 === "string" && rules.separator1 ? rules.separator1 : __sharedUtils.DEFAULT_SEPARATORS.separator1;
    const sep2 = typeof rules.separator2 === "string" && rules.separator2 ? rules.separator2 : sep1;
    const first = s.indexOf(sep1);
    if (first !== -1) {
      if (first + sep1.length > loRel) loRel = first + sep1.length;
      const second = s.indexOf(sep2, first + sep1.length);
      if (second !== -1 && second < hiRel) hiRel = second;
    } else if (sep2 !== sep1) {
      /*
       * Та же строка без зоны тегов, что и у курсора на прибытии: первого
       * разделителя нет, второй есть — значит текст кончается на нём, и
       * переносить фразу дальше нельзя (2026-09-11).
       */
      const only = s.indexOf(sep2);
      if (only !== -1 && only < hiRel) hiRel = only;
    }
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
  const mode = decideMoveMode(doc, a, b, direction, rules.inlineMoveMode, rules.inlineWordEscape);
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
  } catch (_) {
    /*
     * Проба: состояния CodeMirror у редактора может не быть — «нет» здесь
     * ответ, а не отказ. Ниже стоит умолчание самой платформы, четыре
     * пробела на шаг.
     */
  }
  return 4;
}

function getIndentStr(rules) { return " ".repeat(rules.indentWidth || 4); }
/*
 * Каким шагом поедет выделенное: посимвольно, словами или никак.
 *
 * Режимы `char` и `word` решают всё сами; выбирать есть что только у
 * `auto`, и правило у него такое: выделена часть слова — шаг посимвольный,
 * выделено что-то ещё — шаг словами.
 *
 * **Отказ на краю слова — не ограничение шага, а запрет.** Он стоял здесь с
 * самого начала и молча: выделенная часть слова доезжала до края и
 * останавливалась, потому что следующее нажатие унесло бы буквы в соседнее
 * слово. Заказчик 2026-09-08 попросил разрешить именно это, и теперь запрет
 * снимается тумблером `Step out of the word` (умолчание — выключен, его
 * решение). Переключением режима на `char` та же цель не достигается: тогда
 * и целое выделенное слово поедет посимвольно.
 */
function decideMoveMode(doc, a, b, direction, inlineMoveMode, wordEscape) {
  const forced = inlineMoveMode === "char" || inlineMoveMode === "word" ? inlineMoveMode : "";
  if (forced) return forced;
  const inside = doc.slice(a, b);
  if (!inside) return "noop";
  const insideAllWord = everyChar(inside, isWordChar);
  const leftIsWord = isWordChar(doc[a - 1]);
  const rightIsWord = isWordChar(doc[b]);
  if (insideAllWord && (leftIsWord || rightIsWord)) {
    const neighborInDirection = direction === "left" ? leftIsWord : rightIsWord;
    if (!neighborInDirection) return wordEscape === true ? "char" : "noop";
    return "char";
  }
  return "word";
}
function everyChar(str, fn) { for (let i = 0; i < str.length; i++) if (!fn(str[i])) return false; return true; }

/**
 * Запись переноса текста: **только изменившееся окно**, а не документ целиком.
 *
 * Его замечание 2026-09-22: «при переносе выделенного текста move left\right
 * прыгает экран — так быть не должно, он должен оставаться где и был».
 *
 * `Editor.setValue` в `app.js` 1.13.7 — это
 * `dispatch({changes:{from:0,to:doc.length,insert:e}})`, то есть замена
 * **всего** документа. Сама по себе прокрутку она не двигает — это измерено, а
 * не выведено: на заметке без свёрнутых кусков экран стоит на месте при любой
 * из двух записей. Двигает её то, что через такое изменение **нечего
 * перенести**: всё, что живёт отрезками документа, схлопывается, и первой —
 * свёртка. Свёрнутый кусок выше рабочей строки от одного нажатия
 * разворачивался весь, заметка вырастала, и экран уезжал на его высоту.
 * Измерено стендом `node tools/move_scroll_bench.js`: свёрток 1 → 0, прокрутка
 * 1006 → 2840.
 *
 * Окно пишется `replaceRange`, и это тот же вызов и то же правило, каким с
 * 2026-09-20 пишет перенос строк (исключение № 135): изменение внутри строки
 * переносить свёртку не мешает, а `scrollIntoView` «ближайшее» на строке,
 * которая уже на экране, значит «никуда».
 *
 * Перенос текста живёт в одной строке — стену ставит `moveTextBounds`, — так
 * что окно никогда не шире строки.
 */
function writeMovedWindow(editor, doc, from, to, insert) {
  if (doc.slice(from, to) === insert) return;
  editor.replaceRange(insert, editor.offsetToPos(from), editor.offsetToPos(to));
}

function bubbleSwapByCodePoint(doc, editor, a, b, direction, bounds) {
  const sel = doc.slice(a, b); if (!sel) return;
  if (direction === "left") {
    const prevStart = prevCodePointStart(doc, a); if (prevStart == null) return;
    /* Тумблер `Continue past a Separator` выключен: за разделитель не ходим. */
    if (bounds && prevStart < bounds.lo) return;
    const before = doc.slice(prevStart, a); if (!before) return;
    writeMovedWindow(editor, doc, prevStart, b, sel + before);
    editor.setSelection(editor.offsetToPos(prevStart), editor.offsetToPos(prevStart + sel.length));
    return;
  }
  const nextEnd = nextCodePointEnd(doc, b); if (nextEnd == null) return;
  if (bounds && nextEnd > bounds.hi) return;
  const after = doc.slice(b, nextEnd); if (!after) return;
  writeMovedWindow(editor, doc, a, nextEnd, after + sel);
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

/*
 * Знаки, которые не едут вместе со словом.
 *
 * Его пункт 7, 2026-09-22: «если в предложении `(слово1 слово2 слово3)`
 * выделить `слово2` и move right, то получается `(слово1 слово3) слово2`, а я
 * бы хотел, чтобы перенос был до символа». Причина была ровно в мере соседа:
 * соседом считалось всё до пробела, и закрывающая скобка уезжала со словом.
 *
 * **Список закрытый и короткий нарочно.** В нём только скобки, кавычки и
 * знаки конца предложения. Ни `#`, ни `/`, ни `-`, ни `|` в него не входят:
 * они стоят внутри того, что пишет плагин, — `#todo`, `#/1`, `📅2026-09-02`,
 * разделитель `::` из его настроек, — и разбить их значило бы починить одно и
 * сломать принятое (У-218).
 */
const EDGE_MARKS = "()[]{}\u00ab\u00bb\u201c\u201d\u201e" + String.fromCharCode(34) + "'" + ",.;:!?\u2026";
function isEdgeMark(ch) { return ch != null && EDGE_MARKS.indexOf(ch) >= 0; }
function allEdgeMarks(str) {
  if (!str) return false;
  for (let i = 0; i < str.length; i++) if (!isEdgeMark(str[i])) return false;
  return true;
}

/** Парный знак: `(` закрывается `)`, кавычка сама собой. */
const EDGE_PAIRS = { "(": ")", "[": "]", "{": "}", "\u00ab": "\u00bb", "\u201c": "\u201d", "\u201e": "\u201c" };
function edgeMirrors(head, tail) {
  if (!head || head.length !== tail.length) return false;
  for (let i = 0; i < head.length; i++) {
    const open = head[i];
    const want = Object.prototype.hasOwnProperty.call(EDGE_PAIRS, open) ? EDGE_PAIRS[open] : open;
    if (tail[tail.length - 1 - i] !== want) return false;
  }
  return true;
}

/**
 * Сколько знаков соседа берёт один шаг.
 *
 * Сосед — по-прежнему всё до пробела, и это **не** разбор языка: от него
 * отделяется только край из знаков выше, и только тот край, который к
 * выделенному ближе. `[[test1]]` при этом остаётся целым — его края парные, —
 * и целым остаётся `(слово)`: человек написал скобки вокруг слова, а не рядом
 * с ним.
 */
function edgeStep(token, direction) {
  const src = String(token || "");
  if (!src || allEdgeMarks(src)) return src.length;
  let h = 0; while (h < src.length && isEdgeMark(src[h])) h++;
  let t = src.length; while (t > h && isEdgeMark(src[t - 1])) t--;
  const head = src.slice(0, h);
  const tail = src.slice(t);
  if (!head && !tail) return src.length;
  if (edgeMirrors(head, tail)) return src.length;
  if (direction === "right") return head ? head.length : t;
  return tail ? tail.length : src.length - h;
}

/**
 * С какой стороны знак держится за текст.
 *
 * Скобка, кавычка и точка стоят вплотную к тому, что обрамляют, и сторона у
 * каждой своя: `)` `,` `.` держатся за текст **слева**, `(` `[` `«` — за текст
 * **справа**. Пока сторона была одна на всех, открывающая скобка уводила
 * пробел не туда, и слово прилипало к соседу слева: `- (слово3 слово1)` шагом
 * влево давало `-слово3 ( слово1)` — его замечание 2026-09-22, «при переносе
 * текста влево, оно втыкается в префикс».
 *
 * Кавычки `"` и `'` стороны не имеют, и им оставлена прежняя — левая: менять
 * принятое поведение там, где замечания не было, значило бы чинить не
 * спрошенное.
 */
const OPEN_MARKS = "([{«„";
function edgeSide(str) {
  if (!allEdgeMarks(str)) return "";
  return OPEN_MARKS.indexOf(str[0]) >= 0 ? "open" : "close";
}

/**
 * Куда встанут три промежутка, когда фраза и сосед поменяются местами.
 *
 * Промежутков у пары ровно три — до неё, между её половинами и после неё, — и
 * правило их **переставляет**, не добавляя и не убирая ни одного. Знак уносит
 * с собой тот промежуток, которым держится за текст:
 *
 *   * левой стороной — `(слово1 слово2 слово3)` шагом `)` влево даёт
 *     `(слово1 слово2) слово3`;
 *   * правой — `- (слово3 слово1)` шагом `слово3` влево даёт
 *     `- слово3 (слово1)`.
 *
 * В обычном тексте знака нет, промежутки остаются на своих местах, и перенос
 * слова со словом не меняется — это и есть отрицательный контроль правила.
 *
 * Его слова: «я хочу испытывать комфорт от этой команды, чтобы мне не
 * приходилось руками корректировать текст».
 */
function planGaps(before, gap, after, token, phrase) {
  /* Решает тот, кто целиком из знаков; когда оба — сосед, через которого шаг. */
  const side = edgeSide(token) || edgeSide(phrase);
  if (side === "close") return [gap, before, after];
  if (side === "open") return [before, after, gap];
  return [before, gap, after];
}

function jumpByWordToken(doc, editor, a, b, direction, bounds) {
  /* Стена строки: ниже её начала и выше её конца перенос не ходит. */
  const lo = bounds && Number.isFinite(bounds.lo) ? bounds.lo : 0;
  const hi = bounds && Number.isFinite(bounds.hi) ? bounds.hi : doc.length;
  while (a < b && isHorizSpace(doc[a])) a++;
  while (b > a && isHorizSpace(doc[b - 1])) b--;
  const phrase = doc.slice(a, b); if (!phrase) return;
  if (direction === "left") {
    let i = a; while (i > lo && isHorizSpace(doc[i - 1])) i--; const gap = doc.slice(i, a);
    const tEnd = i; while (i > lo && isTokenChar(doc[i - 1])) i--; let tStart = i;
    if (tStart === tEnd) return;
    tStart = tEnd - edgeStep(doc.slice(tStart, tEnd), "left");
    const token = doc.slice(tStart, tEnd);
    /* Соседний токен лежит за разделителем или в оформлении строки. */
    if (tStart < lo) return;
    let p = tStart; while (p > lo && isHorizSpace(doc[p - 1])) p--;
    const before = doc.slice(p, tStart);
    let q = b; while (q < hi && isHorizSpace(doc[q])) q++;
    const after = doc.slice(b, q);
    const slots = planGaps(before, gap, after, token, phrase);
    writeMovedWindow(editor, doc, p, q, slots[0] + phrase + slots[1] + token + slots[2]);
    const at = p + slots[0].length;
    editor.setSelection(editor.offsetToPos(at), editor.offsetToPos(at + phrase.length));
    return;
  }
  let i = b; while (i < hi && isHorizSpace(doc[i])) i++; const gap = doc.slice(b, i);
  const tStart = i; while (i < hi && isTokenChar(doc[i])) i++; let tEnd = i;
  if (tStart === tEnd) return;
  tEnd = tStart + edgeStep(doc.slice(tStart, tEnd), "right");
  const token = doc.slice(tStart, tEnd);
  if (tEnd > hi) return;
  let p = a; while (p > lo && isHorizSpace(doc[p - 1])) p--;
  const before = doc.slice(p, a);
  let q = tEnd; while (q < hi && isHorizSpace(doc[q])) q++;
  const after = doc.slice(tEnd, q);
  const slots = planGaps(before, gap, after, token, phrase);
  writeMovedWindow(editor, doc, p, q, slots[0] + token + slots[1] + phrase + slots[2]);
  const newA = p + slots[0].length + token.length + slots[1].length;
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
/* Правило одно на весь плагин и живёт в `shared_utils.js` (У-32, З-3). */
function isWordChar(ch) { return __sharedUtils.isWordChar(ch); }
function isHorizSpace(ch) { return ch === " " || ch === "\t"; }
function isHighSurrogate(code) { return __sharedUtils.isHighSurrogate(code); }
function isLowSurrogate(code) { return __sharedUtils.isLowSurrogate(code); }
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

/**
 * Куда настройка `Cursor position after jumping` сажает курсор в тексте
 * человека — в начало или в конец.
 *
 * **Одно правило на два хода**, и это решение заказчика 2026-09-12: «два режима
 * будут определять, в начало или конец моего текста курсор должен попадать», и
 * на вопрос «где этот выбор действует» он ответил «на оба места, одной
 * строкой». Ходов действительно два: прыжок по заголовкам ставит курсор сам, а
 * шаг вправо внутри строки входит в зону текста снаружи — из зоны значений.
 * Написать ответ дважды значило бы завести два места, которые разойдутся молча
 * (У-32).
 *
 * `Line start` и `Line end` тоже отвечают: строка называет конец, к которому
 * человек тянется, и зона текста у него та же.
 */
function textEntryAnchor(cfg) {
  /* Значения нет — берётся умолчание схемы (`section-end`), а не умолчание
     соседней функции: у настройки один дом, и он в панели. */
  const mode = String((cfg && cfg.jumpCursorPosition) || "section-end");
  return (mode === "start" || mode === "section-start") ? "start" : "end";
}

function targetPosForLine(ed, line, cfg) {
  const mode = cfg.jumpCursorPosition || "start";
  if (mode === "end") return { line: line, ch: len(ed, line) };
  if (mode === "section-end") return lineEndPos(ed, line, cfg);
  if (mode === "section-start") return lineTextStartPos(ed, line, cfg);
  return { line: line, ch: smartLineStartCh(txt(ed, line)) };
}

/**
 * «Начало вашего текста» — то же общее правило, что знает и его конец.
 *
 * Своего разбора здесь нет нарочно: начало слота под текст знает
 * `getTextSlotBounds`, и оно же учитывает пустой слот между разделителями. Без
 * разделителей спрашивать нечего, и тогда остаётся обычное начало строки —
 * после списочного знака и чекбокса.
 */
function lineTextStartPos(ed, line, cfg) {
  const s = txt(ed, line);
  const sep1 = typeof (cfg && cfg.separator1) === "string" && cfg.separator1 ? cfg.separator1 : "";
  if (sep1) {
    const sep2 = typeof (cfg && cfg.separator2) === "string" && cfg.separator2 ? cfg.separator2 : sep1;
    const markers = Array.isArray(cfg && cfg.markers) ? cfg.markers.filter((m) => typeof m === "string" && m) : [];
    const bounds = __macroShared.getTextSlotBounds(s, {
      io: { separator1: sep1, separator2: sep2 },
      dates: { markers },
    });
    if (bounds && Number.isFinite(bounds.start)) return { line: line, ch: bounds.start };
  }
  return { line: line, ch: smartLineStartCh(s) };
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
function centerOnCursorOnce(ed, p, cfg) { if (!cfg.centerCursor) return; if (!globalThis.__jumpCenterState) globalThis.__jumpCenterState = { t: 0, line: -1 }; const st = globalThis.__jumpCenterState; const now = Date.now(); if (now - st.t < cfg.centerThrottleMs && st.line === p.line) return; st.t = now; st.line = p.line; setTimeout(() => { try { revealLineAt(ed, p.line, cfg.viewPosition, p.ch); } catch (_) { /* Украшение: заметку к этому моменту могли закрыть, и тогда ставить место на экране некуда. Переход уже случился, курсор стоит. */ } }, cfg.centerDelayMs); }
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
  /*
   * «Конец вашего текста» спрашивается у общего правила: оно знает и пустой
   * слот между разделителями, и строку без первого разделителя, и значение
   * элемента, которое текстом человека не является.
   */
  const shared = sharedTextEndCh(s, cfg);
  if (shared !== null) return { line: line, ch: shared };
  const sep = typeof (cfg && cfg.separator1) === "string" && cfg.separator1 ? cfg.separator1 : __sharedUtils.DEFAULT_SEPARATORS.separator1;
  /* Второй разделитель ищется вторым разделителем, а не первым: у заказчика
     оба `::` и разницы не видно, но в панели это две разные настройки. */
  const sep2 = typeof (cfg && cfg.separator2) === "string" && cfg.separator2 ? cfg.separator2 : sep;
  const first = s.indexOf(sep);
  if (first === -1) {
    /*
     * **Первого разделителя в строке нет, а второй есть** — замечание
     * заказчика 2026-09-11: «переход прыгает в конец строки, а не встаёт до
     * сепаратора». Зоны тегов в такой строке просто нет, и её текст кончается
     * вторым разделителем ровно так же, как в полной строке. Прежде эта ветка
     * не искала второй вовсе и уводила курсор за край текста, в хвост с
     * датой. У кого оба разделителя одинаковы, случая не бывает: `first`
     * находит тот же знак.
     */
    if (sep2 !== sep) {
      const only = s.indexOf(sep2);
      if (only !== -1) {
        const beforeOnly = s.slice(0, only).replace(/[ \t]+$/, "");
        if (hasTextPartBeforeFirstSeparator(beforeOnly)) {
          return { line: line, ch: beforeOnly.length };
        }
      }
    }
    return { line: line, ch: len(ed, line) };
  }
  const second = s.indexOf(sep2, first + sep.length);
  if (second === -1) {
    const beforeFirst = s.slice(0, first).replace(/[ \t]+$/, "");
    if (!hasTextPartBeforeFirstSeparator(beforeFirst)) return { line: line, ch: len(ed, line) };
    return { line: line, ch: beforeFirst.length };
  }
  const beforeSecond = s.slice(0, second).replace(/[ \t]+$/, "");
  return { line: line, ch: beforeSecond.length };
}

/*
 * Ответ общего правила про конец текста, или `null`, если спросить нечем.
 *
 * Разделители у навигации свои (`separator1`/`separator2` из формата строки),
 * метки элементов приезжают тем же путём, что и в шаг внутри строки. Форма
 * `rules` здесь — ровно то, что читает общий модуль.
 */
function sharedTextEndCh(lineText, cfg) {
  const sep1 = typeof (cfg && cfg.separator1) === "string" && cfg.separator1 ? cfg.separator1 : "";
  if (!sep1) return null;
  const sep2 = typeof (cfg && cfg.separator2) === "string" && cfg.separator2 ? cfg.separator2 : sep1;
  const markers = Array.isArray(cfg && cfg.markers) ? cfg.markers.filter((m) => typeof m === "string" && m) : [];
  const rules = { io: { separator1: sep1, separator2: sep2 }, dates: { markers } };
  const ch = __macroShared.getCursorAtTextEnd(String(lineText || ""), rules);
  return Number.isFinite(ch) ? ch : null;
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
    /* Форма ссылки — общий дом; текст образца совпадает с прежним до знака
       (10.13.141). */
    const wl = left.match(new RegExp("^" + __sharedUtils.WIKILINK_TOKEN_SRC + "\\s*"));
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
/*
 * Правила навигации собираются **из настроек**, а не из служебного файла
 * (PRD 10.13.52, П-8, шаг первый; решение заказчика 2026-09-11).
 *
 * **Что было.** `loadNavigateRules` читала `generated_rules.md`: перебирала
 * четыре кандидата пути, спрашивала индекс vault, потом адаптер, разбирала
 * четыре блока JSON и выводила из них правила. То есть настройка доезжала до
 * курсора внутри строки через файл на диске, который плагин сам же и пишет.
 *
 * **Что стало.** Форму правил отдаёт общий модуль `pkm_rules_shape.js` — тот
 * самый, из которого собирается и сама заметка. Одно объявление на оба хода
 * (У-32), а равенство ходов на одних входах держат два пина:
 * `rules_document_roundtrip_tests.ts` — форма целиком,
 * `navigate_rules_direct_tests.ts` — четыре блока, которые нужны навигации, и
 * выведенные из них правила.
 *
 * **Три следствия, и каждое надо назвать вслух.**
 *   - файла может не быть, он может отстать от настроек или быть правлен
 *     руками — курсора внутри строки это больше не касается. Прежде такой
 *     случай кончался уведомлением `Rules file not found`;
 *   - правка настроек действует сразу, а не после отложенной перезаписи
 *     заметки;
 *   - работы стало меньше, а не больше: чтение файла с диска и разбор всей
 *     заметки на каждое нажатие заменились сборкой формы в памяти.
 */
function buildNavigateRules(cfg) {
  const shape = __rulesShape.buildRulesShapeFromConfig(cfg);
  const io = isObj(shape.io) ? shape.io : {};
  const dateRules = isObj(shape.dateRules) ? shape.dateRules : {};

  const markers = [];
  for (const key of ["due", "done", "cancelled", "start"]) {
    const rule = dateRules[key];
    if (!rule) continue;
    if (typeof rule.preferredMarker === "string" && rule.preferredMarker) markers.push(rule.preferredMarker);
    if (Array.isArray(rule.markers)) for (const m of rule.markers) if (typeof m === "string" && m) markers.push(m);
  }

  /*
   * Метки берутся ещё и у самих Field (замечание заказчика 2026-09-06).
   *
   * Четыре именованных правила дат у заказчика пусты: его поле-дата
   * называется `date_due` и приезжает не оттуда, а из списка Field — со своим
   * `marker`, тем же эмодзи. Навигация про эту метку не знала вовсе, и
   * единственный `::` на строке читался как первый разделитель, а не как
   * второй: зоной текста становился сам хвост с датой, и курсор вставал
   * **после** разделителя. Признак был ровно такой, как в У-56: значение до
   * функции не доезжает, а пин на неё зелёный.
   *
   * Field с меткой бывает в обоих блоках — элемент можно поставить и слева, —
   * поэтому читаются оба, а `Set` ниже снимает повторы.
   */
  for (const block of [shape.leftMode, shape.rightMode]) {
    const list = block && Array.isArray(block.fields) ? block.fields : [];
    for (const f of list) {
      if (f && typeof f.marker === "string" && f.marker) markers.push(f.marker);
    }
  }

  /*
   * Ключей в ответе три, и это всё, что спрашивает `navigateInline`.
   *
   * Прежний ответ нёс ещё `typeRoots`, `ctxRoots` и `rulesPathUsed`. Первые
   * два собирались из Field с именами `type` и `context` — именами версии 1,
   * зашитыми здесь литералами, — и **их не читал никто**: сплошной поиск по
   * репозиторию давал только это объявление и сборку. Третий называл путь, по
   * которому файл прочли, и спрашивала его одна проверка. Перенести мёртвое в
   * новый ход значило бы написать код, чей единственный потребитель — чтение
   * его же (У-95).
   */
  const sep1 = typeof io.separator1 === "string" && io.separator1 ? io.separator1 : __sharedUtils.DEFAULT_SEPARATORS.separator1;
  /*
   * **Второй разделитель доезжает сюда с 2026-09-11, и до этого дня не доезжал
   * ни одного** (замечание заказчика: «при `Move cursor right in line` курсор
   * прыгает в конец строки»). Правила навигации несли ровно один разделитель,
   * и зона текста угадывалась эвристикой по метке даты. У кого оба
   * разделителя одинаковы — угадывалось верно; у кого `||` и `::` — курсор
   * уходил за второй разделитель, в хвост с датой. Признак ровно тот, что в
   * У-56: значение до функции не доезжает, а пин на неё зелёный.
   */
  const sep2 = typeof io.separator2 === "string" && io.separator2 ? io.separator2 : sep1;
  return {
    delim: sep1,
    delim2: sep2,
    trailingMarkers: Array.from(new Set(markers)),
    dateRegexSrc: "\\d{4}-\\d{2}-\\d{2}",
  };
}

function navigateInline(editor, direction, navRules, rawCfg) {
  const cfg = pickNavigateInlineCfg(rawCfg);
  const delim = navRules && typeof navRules.delim === "string" && navRules.delim ? navRules.delim : __sharedUtils.DEFAULT_SEPARATORS.separator1;
  /* Второй разделитель: не задан — считаем, что он равен первому (прежний ход). */
  const delim2 = navRules && typeof navRules.delim2 === "string" && navRules.delim2 ? navRules.delim2 : delim;
  const trailingMarkers = navRules && Array.isArray(navRules.trailingMarkers) ? navRules.trailingMarkers : [];
  const dateReSrc = navRules && typeof navRules.dateRegexSrc === "string" && navRules.dateRegexSrc
    ? navRules.dateRegexSrc
    : "\\d{4}-\\d{2}-\\d{2}";
  const isWs = (c) => c === " " || c === "\t";
  const isTagToken = (s, idx) => s[idx] === "#" && idx + 1 < s.length && !isWs(s[idx + 1]);
  /* Правило объявлено один раз — `escapeRe` в `shared_utils.js` (У-32). Своя
     копия стояла здесь и расходилась с ним на `0` и `false`. */
  const escapeRe = (s) => __sharedUtils.escapeRe(s);

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
    /*
     * Конец зоны текста — **второй** разделитель. Когда он совпадает с первым,
     * ищется следующее его вхождение, и это прежний ход; когда разведён —
     * ищется он сам, и угадывать больше нечего.
     */
    let innerDelimRel = -1;
    const innerSep = delim2 || delim;
    if (innerSep) {
      innerDelimRel = s.lastIndexOf(innerSep, Math.max(0, contentEndRel - 1));
      if (innerSep === delim && innerDelimRel === delimIndex) innerDelimRel = -1;
      if (innerDelimRel !== -1 && innerDelimRel < textStartRel) innerDelimRel = -1;
    }

    const indentAbs = indent.length;
    const hardStartAbs = indentAbs + prefixEnd;
    const hardEndAbs = rawLine.length;
    let scopeStartAbs = indentAbs + textStartRel;
    let scopeEndAbs = indentAbs + (innerDelimRel !== -1 ? innerDelimRel : contentEndRel);

    const isSingleDelim = delimIndex !== -1 && innerDelimRel === -1;
    /*
     * Догадка «единственный знак на строке — на самом деле второй
     * разделитель» нужна только там, где **оба записаны одинаково**: тогда их
     * не различить ничем. Когда они разные, вопрос решён самим знаком, и
     * догадка только мешала: значение элемента перед `||` она читала как текст
     * человека и объявляла зоной текста левую часть строки (`S4` 2026-09-12).
     */
    const singleSepLooksLikeSep2 = isSingleDelim && delim2 === delim && (
      hasInlineTextBeforeSingleSeparator(s, prefixEnd, delimIndex) ||
      hasDateTailAfterSingleSeparator(s, delimIndex)
    );
    if (singleSepLooksLikeSep2) {
      scopeStartAbs = indentAbs + textStartNoDelimRel;
      scopeEndAbs = indentAbs + trimRightBeforeIndex(s, delimIndex);
    }

    /*
     * **Зона текста спрашивается у общего правила** — того же, которым ставят
     * курсор движки PKM. Своё объявление выше оставлено запасным: оно
     * отвечает там, где разделителей в строке нет вовсе и спрашивать общее
     * правило не о чем.
     *
     * Чем это куплено: шесть случаев заказчика 2026-09-12 (`S4`). Свой ход
     * останавливал шаг на конце зоны значений, объявляя её текстом человека, а
     * пустой слот считал местом вплотную к разделителю. Общее правило знает и
     * то и другое.
     */
    /*
     * Когда оба разделителя записаны одинаково, отличить первый от второго
     * нельзя ни одним правилом — за это отвечает догадка выше, и она остаётся
     * сильнее: общее правило в таком случае читает единственный знак как
     * первый разделитель (У-147).
     */
    const sharedEnd = singleSepLooksLikeSep2 ? null : sharedTextEndCh(rawLine, {
      separator1: delim,
      separator2: delim2,
      markers: trailingMarkers,
    });
    if (sharedEnd !== null) {
      const sharedBounds = __macroShared.getTextSlotBounds(rawLine, {
        io: { separator1: delim, separator2: delim2 },
        dates: { markers: trailingMarkers },
      });
      if (sharedBounds && sharedEnd >= sharedBounds.start) {
        scopeStartAbs = sharedBounds.start;
        scopeEndAbs = Math.max(sharedBounds.start, sharedEnd);
      } else {
        /* Конец текста оказался **до** первого разделителя: значит текст
           человека стоит в левой части строки, а хвост за разделителем — это
           значения. Начало берётся там же, где оно у такой строки и было. */
        scopeStartAbs = indentAbs + textStartNoDelimRel;
        scopeEndAbs = Math.max(scopeStartAbs, sharedEnd);
      }
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

      /* Форма ссылки — общий дом (10.13.141). */
      const wl = line.slice(i, endAbs).match(new RegExp("^" + __sharedUtils.WIKILINK_TOKEN_SRC));
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
  /*
   * Шаг, входящий в зону текста снаружи, слушается настройки.
   *
   * Замечание заказчика `S4` 2026-09-12: стоя среди значений, он нажал шаг
   * вправо и ждал, что курсор окажется **в конце** его текста, а тот вставал в
   * начало — вторым нажатием доходил до конца. Правило режима `sentence` тут ни
   * при чём: остановки у него начало и конец зоны, а человек начинал шаг вне
   * зоны, и ближайшей остановкой оказывалось её начало.
   *
   * Теперь у этого случая есть ответ, и даёт его та самая строка панели,
   * которой человек уже сказал, где он любит курсор (В-107, решение заказчика
   * 2026-09-12). Условие узкое: курсор **снаружи** зоны, и шаг привёл ровно на
   * её край. Шаг внутри зоны и остановки по словам не трогаются.
   */
  /*
   * **Почему только `sentence`.** В режиме `word` остановки — сами слова, и
   * первое из них и есть то место, куда человек шагает: увести его сразу в
   * конец значило бы отменить ход по словам. В `begin-end` конец называет само
   * направление шага. Остаётся `sentence`, где остановками служат ровно края
   * зоны, — и замечание пришло именно оттуда: у заказчика выбран он.
   */
  if (cfg.stepMode === "sentence" && target && target.line === lineNo && zoneEnd > zoneStart) {
    const wants = cfg.textEntry === "start" ? zoneStart : zoneEnd;
    const enteringRight = direction === "right" && posAbs < zoneStart && target.ch === zoneStart;
    const enteringLeft = direction === "left" && posAbs > zoneEnd && target.ch === zoneEnd;
    if (enteringRight || enteringLeft) target = { line: lineNo, ch: wants };
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
  buildNavigateRules,
  navigateInline,
};
