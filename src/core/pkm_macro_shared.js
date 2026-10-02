"use strict";

const __sharedUtils = require("./shared_utils.js");
/* Признак «токен — наше значение» — один, у доводки строки (`makeFieldValueTokenTest`, 10.13.158). */
const __lineFinalize = require("./pkm_line_finalize_unified.js");

function resolveSeparatorsOrThrow(rules) {
  /* Правило — в общем доме; имя звавшего попадает в текст отказа. */
  return __sharedUtils.resolveSeparatorsOrThrow(rules, "pkm_macro_shared");
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
  /* `escapeRe` из `shared_utils.js` (У-32): копия на `0`/`false` давала пустую альтернативу, совпадающую со всем. */
  return __sharedUtils.escapeRe(text);
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

/* Конец значения элемента — общий с уборкой ответ (PRD 10.13.71). */
function firstTokenByPattern(segText, marker, valueRx) {
  const mk = String(marker || "");
  return __sharedUtils.firstMarkerValueToken(
    segText,
    mk,
    __sharedUtils.elementValueSources(valueRx, mk)
  );
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
  /* Цитата приезжает отступом (снимает `splitSegments`); наш знак списка за ней не ставится (В-115). */
  const quoteStart = __sharedUtils.lineStartOf(indent);
  const quote = String(parsed && parsed.quoteToken ? parsed.quoteToken : "")
    || (String(quoteStart.quote || "") + String(quoteStart.callout || ""));
  if (!keepParsedPrefix) return indent + (quote ? "" : "- ");
  const bullet = String(parsed && parsed.bulletToken ? parsed.bulletToken : (quote ? "" : "-")).trim();
  const head = indent + (bullet ? bullet + " " : "");
  const checkbox = String(parsed && parsed.checkboxToken ? parsed.checkboxToken : "").trim();
  if (!keepCheckbox) return head;
  return checkbox ? `${head}${checkbox} ` : head;
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

/** Хвост за разделителем — одни значения Field, то есть правый Block. */
function isRightPayloadTail(tail, rules) {
  const isFieldValueToken = __lineFinalize.makeFieldValueTokenTest(rules);
  const tokens = __sharedUtils.lineWords(tail);
  return tokens.length > 0 && tokens.every(isFieldValueToken);
}

function getTextSlotBounds(lineInput, rules) {
  const line = String(lineInput || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const i1 = line.indexOf(sep1);
  if (i1 === -1) {
    /*
     * Первого разделителя нет, второй есть: зоны значений нет, слот текста — сразу
     * за знаком списка (2026-09-11). При одинаковых разделителях случая не бывает.
     */
    if (!sep2 || sep2 === sep1) return null;
    const only = line.indexOf(sep2);
    if (only === -1) return null;
    /* Длина начала строки — у общего объявления: знает номер, цитату и каллаут (Д2 ревизии). */
    const from = __sharedUtils.lineStartOf(line).at;
    let to = only;
    while (to > from && line.charAt(to - 1) === " ") to -= 1;
    return { start: from, end: Math.max(from, to) };
  }
  let start = i1 + sep1.length;
  if (line.charAt(start) === " ") start += 1;
  let end = line.length;
  if (sep2 === sep1) {
    const i2 = line.indexOf(sep2, start);
    if (i2 !== -1) {
      end = i2;
      while (end > start && line.charAt(end - 1) === " ") end -= 1;
    } else if (isRightPayloadTail(line.slice(start), rules)) {
      /*
       * Разделитель один и за ним правый Block — это второй разделитель (BUGHUNT K4,
       * K5), как в `splitSegments` (`В-211`): `- позвонить || 📅2026-09-30` — текст
       * слева. Значения Field слева — зона значений, слот пуст.
       */
      const from = __sharedUtils.lineStartOf(line).at;
      let to = i1;
      while (to > from && line.charAt(to - 1) === " ") to -= 1;
      const head = line.slice(from, to);
      const isFieldValueToken = __lineFinalize.makeFieldValueTokenTest(rules);
      const words = __sharedUtils.lineWords(head);
      if (words.length && words.every(isFieldValueToken)) return { start: to, end: to };
      return { start: from, end: to };
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
        /*
         * Метки — у того, кто их собирает (10.13.158): `rules.dates.markers` не пишет
         * никто. Видно только при совпадающих разделителях (У-147, 2026-09-11).
         */
        if (isRightPayloadTail(tail, rules)) {
          let leftEnd = i1;
          while (leftEnd > 0 && line[leftEnd - 1] === " ") leftEnd -= 1;
          /*
           * Курсор оставляет разделителю его пробел (10.13.171, 2026-09-16): на пустом
           * слоте их два — знака списка и разделителя; ожидалось `- | :: 📅…`.
           */
          return keepOneSpaceBeforeSeparator(line, leftEnd, sep1);
        }
      }
    }
  }
  let ch = Math.max(bounds.start, bounds.end);
  while (ch > bounds.start && /\s/.test(line[ch - 1])) ch--;
  return keepOneSpaceBeforeSeparator(line, ch, sep2);
}

/**
 * Между концом текста и разделителем оставить один пробел, курсор перед ним
 * (2026-09-12: `… || 123 1231 | :: 👤111`). Новых пробелов не создавать:
 *   - пробелов нет — курсор на месте;
 *   - один — он разделителя, курсор перед ним;
 *   - больше — курсор перед последним.
 *
 * Пустой слот сюда попадает (10.13.171): правый Block считает конец текста
 * отходом назад от разделителя. Зовут оба пути — с первым и вторым разделителем.
 */
function keepOneSpaceBeforeSeparator(line, ch, sep) {
  const s = String(line || "");
  const mark = String(sep || "");
  if (!mark) return ch;
  const at = s.indexOf(mark, ch);
  if (at === -1) return ch;
  /* Между курсором и разделителем только пробелы — иначе это чужой текст. */
  if (s.slice(ch, at).trim()) return ch;
  const keep = at - 1;
  if (keep > ch && s[keep] === " ") return keep;
  /*
   * Тот же шаг назад (10.13.171, вторая форма): у цитаты `lineStartOf(">  :: …").at === 3`
   * забирает оба пробела, курсор вплотную к `::`. Пол — конец знака начала строки
   * без хвостовых пробелов плюс один (не `lineStartOf`: он и жаден); на `- :: 📅` шага нет.
   */
  if (at === ch && s.charAt(ch - 1) === " ") {
    let markEnd = __sharedUtils.lineStartOf(s).at;
    while (markEnd > 0 && s.charAt(markEnd - 1) === " ") markEnd -= 1;
    const floor = markEnd > 0 ? markEnd + 1 : 0;
    if (ch - 1 >= floor) return ch - 1;
  }
  return ch;
}

/**
 * Разделитель — из настроек третьим аргументом, не литерал `||` (У-186, 2026-09-15).
 * Обязателен: тихое «нет» без правил вернуло бы дефект.
 */
function isBulletLikeEmptyResult(line, parsed, rules) {
  const s = String(line || "").trim();
  if (/^[-*+]\s*$/.test(s)) return true;
  if (/^\d+\.\s*$/.test(s)) return true;
  if (/^[-*+]\s+\[[^\]]\]\s*$/.test(s)) return true;
  const sepAlt = __sharedUtils.separatorAltSrc(rules, "pkm_macro_shared");
  if (new RegExp("^[-*+]\\s*(?:" + sepAlt + "\\s*)*$").test(s)) return true;
  if (new RegExp("^\\d+\\.\\s*(?:" + sepAlt + "\\s*)*$").test(s)) return true;
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
  return __sharedUtils.hasListPrefix(line);
}

function hasStandaloneCheckboxPrefix(line) {
  /* Скобки без знака списка — не задача (В-114), но начало, написанное человеком. */
  return __sharedUtils.startsWithBracketPair(line);
}

function extractOriginalPrefix(line) {
  return __sharedUtils.lineStartPrefixOf(line);
}

function reapplyOriginalPrefix(rawLine, nextLine) {
  return __sharedUtils.reapplyLineStart(rawLine, nextLine);
}

function preserveOriginalPrefixShape(rawLine, nextLine) {
  return __sharedUtils.preserveLineStartShape(rawLine, nextLine);
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
