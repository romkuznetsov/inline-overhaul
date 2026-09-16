"use strict";

const __sharedUtils = require("./shared_utils.js");
/* Признак «этот токен — наше значение» объявлен один раз, у доводки строки
   (`makeFieldValueTokenTest`). Своя копия стояла здесь и спрашивала метки у
   `rules.dates.markers` — ключа, которого не пишет никто (10.13.158). */
const __lineFinalize = require("./pkm_line_finalize_unified.js");

function resolveSeparatorsOrThrow(rules) {
  /* Правило одно, и живёт оно в общем доме; сюда приезжает только имя
     звавшего — его человек увидит в тексте отказа. */
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
  /* Правило объявлено один раз — `escapeRe` в `shared_utils.js` (У-32).
     Своя копия стояла здесь и расходилась с ним на `0` и `false`:
     `String(s || "")` отдавала пустую строку, то есть пустую
     альтернативу регулярного выражения, а та совпадает со всем. */
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

/*
 * Где кончается значение элемента — один вопрос и один ответ, общий с
 * уборкой (PRD 10.13.71). Прежде выражение собиралось здесь: при пустом
 * образце оно совпадало с одной меткой, и перенос уносил метку без
 * значения.
 */
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
  /* Цитата приезжает отступом (её снимает `splitSegments`), а наш знак списка
     за ней не появляется — его слово по В-115. */
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

function getTextSlotBounds(lineInput, rules) {
  const line = String(lineInput || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const i1 = line.indexOf(sep1);
  if (i1 === -1) {
    /*
     * **Первого разделителя в строке нет, а второй есть.**
     *
     * Зоны значений Field в такой строке нет вовсе, и слот под текст начинается
     * сразу за знаком списка. Прежде эта ветка возвращала «границ нет», и
     * курсор уезжал в конец строки, за дату: замечание заказчика 2026-09-11,
     * «при активации в пустой строке value из right block курсор прыгает в
     * конец строки, а должен быть до сепаратора 2».
     *
     * У кого оба разделителя одинаковы, случая не бывает: `indexOf` находит
     * тот же знак первым.
     */
    if (!sep2 || sep2 === sep1) return null;
    const only = line.indexOf(sep2);
    if (only === -1) return null;
    /* Длина начала строки — у общего объявления: свой образец знал номер
       только с точкой и не знал ни цитаты, ни каллаута (Д2 ревизии). */
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
         * **Метки спрашиваются у того, кто их собирает** (10.13.158).
         *
         * Здесь стоял тот же пятичленный признак, что у доводки строки, и
         * отличался он одним: список меток брался из `rules.dates.markers`.
         * Этот ключ в продукте не пишет **никто** — три читателя и ноль
         * писателей, — то есть на любых настройках список был пуст, и хвост
         * из значений правого Block признавался словом человека. Курсор
         * уезжал в конец строки — ровно то, на что он приходил 2026-09-11.
         * Видно это только при **совпадающих** разделителях: при разных зону
         * текста закрывает второй разделитель, и сюда не доходит (У-147).
         */
        const isFieldValueToken = __lineFinalize.makeFieldValueTokenTest(rules);
        const tokens = tail.split(/\s+/).filter(Boolean);
        const isRightPayload = tokens.length > 0 && tokens.every(isFieldValueToken);
        if (isRightPayload) {
          let leftEnd = i1;
          while (leftEnd > 0 && line[leftEnd - 1] === " ") leftEnd -= 1;
          /*
           * **И здесь курсор оставляет разделителю его пробел** (10.13.171,
           * его слово 2026-09-16: «при активации в пустой строке value в right
           * block курсор находится не в том месте: `-|  :: 📅…`, ожидалось
           * `- | :: 📅…`»).
           *
           * Отход назад снимает **все** пробелы, а на пустом слоте текста их
           * два: один принадлежит знаку списка, второй — разделителю. Курсор
           * упирался в знак списка, и человеку приходилось жать вправо, чтобы
           * начать писать. Правило «оставить разделителю один пробел» тут не
           * ново: оно объявлено ниже и куплено его же замечанием 2026-09-12 о
           * лишнем нажатии вправо. Новое — что эта ветка его не звала.
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
 * Между концом текста и вторым разделителем оставить **один** пробел, и курсор
 * поставить перед ним.
 *
 * Замечание заказчика 2026-09-12: при прыжке с `End of your text` курсор встал
 * `… || 123 1231|  :: 👤111`, а он ждал `… || 123 1231 | :: 👤111` — «чтобы не
 * приходилось делать дополнительный arrow right на пустое место». Конец текста
 * считается по слоту, а лишние пробелы лежат **за** слотом, и курсор оставался
 * вплотную к последнему слову: следующее набранное слово к нему и приклеивалось.
 *
 * Правило узкое нарочно, и его границы — его же слова «при прыжках не создавать
 * пробел, если его не было изначально»:
 *   - пробелов перед разделителем нет — курсор остаётся там, где стоял;
 *   - пробел один — он принадлежит разделителю, и курсор перед ним, как и был;
 *   - пробелов больше одного — курсор встаёт перед последним.
 *
 * **Пустой слот под текст сюда теперь попадает** (10.13.171). Прежде здесь
 * стояло «не попадает: у него конец равен началу», и это было верно про путь
 * через границы слота — но не про путь правого Block, который считает конец
 * текста отходом назад от разделителя. На пустом слоте пробелов ровно два,
 * знака списка и разделителя, и правило ставит курсор между ними.
 *
 * Имя у правила больше не говорит «второй»: разделитель приезжает доводом, и
 * зовут его теперь оба пути — один со вторым разделителем, другой с первым.
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
   * **И тот же шаг назад** (10.13.171, вторая форма). Курсор бывает уже
   * **вплотную** к разделителю: у цитаты начало строки забирает себе оба
   * пробела пустого слота (`lineStartOf(">  :: …").at === 3`), и слот
   * получается пустым **за** ними. Тогда человек упирается в `::` с другой
   * стороны — `>  |:: 📅…`, — и первое же набранное слово приклеивается к
   * разделителю.
   *
   * Пол у шага назад свой: знаку начала строки его собственный пробел
   * оставляем. Считается он не от `lineStartOf` — тот и есть источник
   * жадности, — а от знака: конец начала строки без хвостовых пробелов плюс
   * один. На `- :: 📅` пробел всего один, он принадлежит знаку, и шага не
   * происходит.
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
 * Правила берут разделитель из настроек **третьим аргументом**.
 *
 * До 2026-09-15 он стоял здесь литеральным `||`, и у человека со своим
 * разделителем строка, от которой остался один знак списка и разделители, не
 * узнавалась вовсе: круг кончался не пустой строкой, а `- :: ::` (У-186).
 * Аргумент обязателен: зовут эту функцию четыре места, и у всех четырёх
 * правила под рукой. Тихо отвечать «нет» без них значило бы вернуть ровно тот
 * дефект, ради которого правило переписано.
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
  /* Скобки без знака списка задачей не являются (В-114), но началом, которое
     написал человек, — да. Форма у вопроса одна, и живёт она в общем доме. */
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
