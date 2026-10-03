"use strict";

/**
 * Command Field, этап 1 (постановка `test-vault/command-field.md`, разбор и
 * ответы В-272…В-283): реестр категорий и их действия над строками заметки.
 * Чистые функции: на входе строки документа и место каретки, на выходе одна
 * замена отрезка строк — одна транзакция, один шаг `Ctrl+Z` (R-1). `null` —
 * менять нечего, шага отмены нет.
 *
 * Замена: `{ from, to, lines, cursor: { line, ch } }` — строки `from..to`
 * включительно заменяются на `lines`.
 */

const __transform = require("./transform_feature.js");
const __lineFinalize = require("../core/pkm_line_finalize_unified.js");

/* ---- Коллауты (6.1) ------------------------------------------------------ */

const CALLOUT_HEAD_RE = /^((?:[\t ]*>[\t ]?)+)\[!([^\]\s]+)\]([+-]?)(?:[\t ]+(.*))?$/;
const QUOTE_RE = /^(?:[\t ]*>[\t ]?)+/;

/** Сколько уровней цитаты у строки. */
function quoteDepth(line) {
  const m = String(line || "").match(QUOTE_RE);
  return m ? (m[0].match(/>/g) || []).length : 0;
}

/** Снять один уровень цитаты — `depth`-й знак `>` с пробелом за ним. */
function stripQuoteLevel(line, depth) {
  const src = String(line || "");
  let seen = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== ">") {
      if (src[i] === " " || src[i] === "\t") continue;
      break;
    }
    seen += 1;
    if (seen === depth) {
      const end = src[i + 1] === " " ? i + 2 : i + 1;
      return src.slice(0, i) + src.slice(end);
    }
  }
  return src;
}

function indentWidth(line) {
  const m = String(line || "").match(/^[\t ]*/);
  let n = 0;
  for (const c of m ? m[0] : "") n += c === "\t" ? 4 : 1;
  return n;
}

/**
 * Самый внутренний коллаут, в котором стоит каретка (6.1, «вложенный»):
 * `{ head, end, depth, type, fold, title }` или `null`.
 */
function calloutAt(lines, at) {
  const depthHere = quoteDepth(lines[at]);
  if (!depthHere) return null;
  let floor = depthHere;
  for (let i = at; i >= 0; i--) {
    const d = quoteDepth(lines[i]);
    if (!d) return null;
    floor = Math.min(floor, d);
    const m = String(lines[i]).match(CALLOUT_HEAD_RE);
    if (m && d <= floor) {
      let end = i;
      while (end + 1 < lines.length && quoteDepth(lines[end + 1]) >= d) end += 1;
      return { head: i, end, depth: d, quote: m[1], type: m[2], fold: m[3] || "", title: m[4] || "" };
    }
  }
  return null;
}

/** Строка и её дерево: потомки — строки глубже по отступу; пустые — только внутри. */
function treeEnd(lines, at) {
  const base = indentWidth(lines[at]);
  let end = at;
  for (let i = at + 1; i < lines.length; i++) {
    const s = String(lines[i]);
    if (!s.trim()) continue;
    if (indentWidth(s) > base) { end = i; continue; }
    break;
  }
  return end;
}

function calloutHead(quote, preset, title) {
  const fold = preset.fold === "+" || preset.fold === "-" ? preset.fold : "";
  return `${quote}[!${preset.type}]${fold}${title ? " " + title : ""}`;
}

/** Какой пресет стоит: первый совпавший по типу и свёрнутости (В-281, клон — первый). */
function calloutPresetIndex(presets, box) {
  return presets.findIndex((p) => String(p.type).toLowerCase() === box.type.toLowerCase()
    && (p.fold || "") === box.fold);
}

function wrapCallout(lines, from, to, preset, cursor) {
  const body = [];
  for (let i = from; i <= to; i++) body.push(lines[i] === "" ? ">" : "> " + lines[i]);
  const out = [calloutHead("> ", preset, "")].concat(body);
  const line = cursor.line + 1;
  const ch = (lines[cursor.line] === "" ? 1 : cursor.ch + 2);
  return { from, to, lines: out, cursor: { line, ch } };
}

/** Снятие: строка `[!type]` уходит, у тела снимается один уровень `>` (6.1, ручной коллаут). */
function unwrapCallout(lines, box, cursor) {
  const out = [];
  for (let i = box.head + 1; i <= box.end; i++) out.push(stripQuoteLevel(lines[i], box.depth));
  /* Коллаут без тела снимается в пустую строку своего уровня. */
  if (!out.length) out.push(stripQuoteLevel(box.quote, box.depth).trimEnd());
  if (cursor.line <= box.head) return { from: box.head, to: box.end, lines: out, cursor: { line: box.head, ch: 0 } };
  const shift = String(lines[cursor.line]).length - out[cursor.line - box.head - 1].length;
  return { from: box.head, to: box.end, lines: out, cursor: { line: cursor.line - 1, ch: Math.max(0, cursor.ch - shift) } };
}

/** Смена пресета: только тип и свёрнутость, заголовок как есть (В-273). */
function recastCallout(lines, box, preset, cursor) {
  const head = calloutHead(box.quote, preset, box.title);
  const ch = cursor.line === box.head ? Math.min(cursor.ch, head.length) : cursor.ch;
  return { from: box.head, to: box.head, lines: [head], cursor: { line: cursor.line, ch } };
}

const callouts = {
  id: "callouts",
  name: "Callouts",
  defaults: [
    { name: "Note", type: "note", fold: "" },
    { name: "Tip", type: "tip", fold: "" },
    { name: "Warning", type: "warning", fold: "" },
  ],
  hasRevert: true,
  /**
   * `step`: +1 — `next`, −1 — `previous`. Вне коллаута `next` ставит первый
   * пресет, `previous` — последний; внутри — цикл 0 → 1 → … → n → 0 (4.4).
   */
  run(ctx, presets, step) {
    const list = presets.filter((p) => p && !p.hidden);
    if (!list.length) return null;
    const { lines, cursor } = ctx;
    const box = calloutAt(lines, cursor.line);
    if (!box) {
      const preset = step < 0 ? list[list.length - 1] : list[0];
      const sel = ctx.selection;
      if (sel && sel.from !== sel.to) return wrapCallout(lines, sel.from, sel.to, preset, cursor);
      if (lines[cursor.line].trim() === "") {
        return { from: cursor.line, to: cursor.line, lines: [calloutHead("> ", preset, ""), "> "], cursor: { line: cursor.line + 1, ch: 2 } };
      }
      return wrapCallout(lines, cursor.line, treeEnd(lines, cursor.line), preset, cursor);
    }
    const index = calloutPresetIndex(list, box);
    /* Тип не из пресетов — как вне цикла: `next` первый, `previous` последний. */
    const next = index < 0 ? (step < 0 ? list.length - 1 : 0) : index + step;
    if (next < 0 || next >= list.length) return unwrapCallout(lines, box, cursor);
    return recastCallout(lines, box, list[next], cursor);
  },
};

/* ---- Очистка (6.2) ------------------------------------------------------- */

/** Очистка одной строки дорогой Transform (В-274): уборка Values, затем приставка. */
function cleanLine(line, cfg, keep) {
  const parsed = __transform.parseInlineLine(line, cfg);
  const tctx = __transform.buildTransformContext(parsed, cfg);
  if (!tctx || !Array.isArray(tctx.matches) || !tctx.matches.length) return line;
  const separators = __transform.resolveIoSeparators(cfg);
  const plan = __transform.planSourceCleanup(line, tctx, keep, separators);
  return __transform.applySourcePrefixResolution(plan.line, line, tctx, keep, cfg, __lineFinalize);
}

const cleanup = {
  id: "cleanup",
  name: "Cleanup",
  defaults: [{ name: "Clear all", keep: [] }],
  hasRevert: false,
  /** Обратного нет: `next` ставит первый видимый пресет, `previous` — последний (В-276). */
  run(ctx, presets, step) {
    const list = presets.filter((p) => p && !p.hidden);
    if (!list.length) return null;
    const preset = step < 0 ? list[list.length - 1] : list[0];
    const keep = Array.isArray(preset.keep) ? preset.keep : [];
    const { lines, cursor } = ctx;
    const sel = ctx.selection;
    const from = sel ? sel.from : cursor.line;
    const to = sel ? sel.to : cursor.line;
    const out = [];
    let changed = false;
    for (let i = from; i <= to; i++) {
      const next = cleanLine(lines[i], ctx.cfg, keep);
      if (next !== lines[i]) changed = true;
      out.push(next);
    }
    /* Строка без Values не меняется и шага отмены не заводит (6.2). */
    if (!changed) return null;
    const ch = Math.min(cursor.ch, out[cursor.line - from].length);
    return { from, to, lines: out, cursor: { line: cursor.line, ch } };
  },
};

/** Реестр: picker, перебор и команды строятся по нему (4.3). */
const CATEGORIES = [callouts, cleanup];

function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

module.exports = {
  CATEGORIES,
  categoryById,
  calloutAt,
  stripQuoteLevel,
};
