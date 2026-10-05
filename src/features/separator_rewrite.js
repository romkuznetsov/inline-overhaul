"use strict";

/**
 * Замена старых Separators в заметках (его ответ к В-292, 2026-10-05): строку
 * читает тот же разбор, которым её рисует слой оформления, по старым знакам.
 * Меняются ровно знаки на местах разделителей; текст, код и свойства — нет.
 */

const __sharedUtils = require("../core/shared_utils.js");
const __visuals = require("../core/editor_visuals_config.js");
const __macroShared = require("../core/pkm_macro_shared.js");
const __rulesShape = require("../core/pkm_rules_shape.js");

/** Конфиг, в котором строки читаются старыми знаками. */
function withSeparators(cfg, s1, s2) {
  const out = __sharedUtils.cloneJson(cfg || {});
  if (!out.pkm || typeof out.pkm !== "object") out.pkm = {};
  out.pkm.lineFormat = { ...(out.pkm.lineFormat || {}), separator1: s1, separator2: s2 };
  return out;
}

/** Сколько раз знак стоит в строке. */
function countOf(line, sep) {
  if (!sep) return 0;
  let n = 0;
  for (let at = line.indexOf(sep); at !== -1; at = line.indexOf(sep, at + sep.length)) n++;
  return n;
}

/** Отрезки встроенного кода: знак в нём — пример в тексте, а не разделитель. */
function inCode(line, start, end) {
  const rx = /`[^`]*`/g;
  let m;
  while ((m = rx.exec(line)) !== null) {
    if (start < m.index + m[0].length && end > m.index) return true;
  }
  return false;
}

/**
 * Знаков больше, чем разделителей: движки и оформление читают такую строку
 * по-разному (первый-второй против первого-последнего) — она не трогается.
 */
function isAmbiguous(line, from) {
  if (from.s1 === from.s2) return countOf(line, from.s1) > 2;
  return countOf(line, from.s1) > 1 || countOf(line, from.s2) > 1;
}

/**
 * Читатель строк по старым знакам: отвечает, какие отрезки строки — разделители
 * и чьи. `null` — строка не плагина (нет знака или нет значений в Block).
 */
function makeReader(cfg, from) {
  const old = withSeparators(cfg, from.s1, from.s2);
  const markers = __visuals.buildElementMarkersFromConfig(old);
  const kinds = __visuals.buildBlockKindsFromConfig(old);
  const isLink = __visuals.buildWikilinkValueTestFromConfig(old);
  const split = __visuals.buildLineSplitFromConfig(old);
  const rules = __rulesShape.buildRulesForEngines(old);
  return function read(line) {
    const at = __visuals.lineSeparatorBounds(line, from.s1, from.s2);
    if (at.first < 0 && at.last < 0) return null;
    const tokens = __visuals.scanLineVisualTokens(line, from.s1, from.s2, markers, kinds, isLink, split);
    if (!tokens.some((t) => t.zone === "left" || t.zone === "right")) return null;
    if (inCode(line, Math.max(at.first, 0), Math.max(at.lastEnd, at.firstEnd))) return null;
    if (isAmbiguous(line, from)) return "ambiguous";
    const out = [];
    if (at.first >= 0 && at.last >= 0 && at.first !== at.last) {
      out.push({ role: 1, start: at.first, end: at.firstEnd });
      out.push({ role: 2, start: at.last, end: at.lastEnd });
      return out;
    }
    /* Один знак: чей он, решает слот текста, как у движков (K4). */
    const one = at.first >= 0 ? { start: at.first, end: at.firstEnd } : { start: at.last, end: at.lastEnd };
    const slot = __macroShared.getTextSlotBounds(line, rules);
    const role = slot && one.start >= slot.end ? 2 : 1;
    out.push({ role, start: one.start, end: one.end });
    return out;
  };
}

/**
 * Текст заметки с новыми знаками. `from`/`to` — `{ s1, s2 }`; меняется только
 * знак, у которого старое и новое расходятся. Frontmatter и блоки кода не трогаются.
 */
function makeNoteRewriter(cfg, from, to) {
  /* Правила собираются один раз на все заметки. */
  const read = makeReader(cfg, from);
  const next = { 1: String(to.s1), 2: String(to.s2) };
  const prev = { 1: String(from.s1), 2: String(from.s2) };
  return (text) => rewriteWith(read, prev, next, text);
}

function rewriteNoteSeparators(text, cfg, from, to) {
  return makeNoteRewriter(cfg, from, to)(text);
}

function rewriteWith(read, prev, next, text) {
  const src = String(text == null ? "" : text);
  const nl = src.includes("\r\n") ? "\r\n" : "\n";
  const lines = src.split(/\r?\n/);
  let changed = 0;
  let skipped = 0;
  let i = 0;
  if (lines[0] === "---") {
    for (i = 1; i < lines.length && lines[i] !== "---"; i++) { /* frontmatter */ }
    i++;
  }
  let fence = false;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (__sharedUtils.isFenceLine(line)) { fence = !fence; continue; }
    if (fence) continue;
    const seps = read(line);
    if (!seps) continue;
    if (seps === "ambiguous") {
      /* Строку, где важен знак, но неясно какой, человек правит сам — и знает об этом. */
      if (prev[1] !== next[1] || prev[2] !== next[2]) skipped++;
      continue;
    }
    let out = line;
    /* Справа налево: левые отрезки не сдвигаются. */
    for (const s of seps.slice().sort((a, b) => b.start - a.start)) {
      if (prev[s.role] === next[s.role]) continue;
      if (out.slice(s.start, s.end) !== prev[s.role]) continue;
      out = out.slice(0, s.start) + next[s.role] + out.slice(s.end);
    }
    if (out !== line) {
      lines[i] = out;
      changed++;
    }
  }
  return { text: lines.join(nl), lines: changed, skipped };
}

module.exports = { rewriteNoteSeparators, makeNoteRewriter };
