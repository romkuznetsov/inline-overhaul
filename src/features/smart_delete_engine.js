"use strict";

/**
 * Smart Delete (PRD 10.13.32). Родной `Del` в конце строки приклеивает
 * следующую с отступом, маркером и чекбоксом; здесь мусор снимается сразу.
 *
 * Формы Prefix — одни на плагин, в `src/core/shared_utils.js` (У-32).
 * `planSmartDelete` — чистая функция; каждый тихий отказ — `null`, клавиша
 * уходит платформе (У-41).
 */

const __sharedUtils = require("../core/shared_utils.js");
const __linePipeline = require("../core/line_pipeline.js");
const __rulesHelpers = require("../core/pkm_rules_runtime_helpers.js");
const __rulesShape = require("../core/pkm_rules_shape.js");

/**
 * Сегменты строки для склейки. Строку без Prefix и разделителей разбор движков
 * отдаёт Block целиком (`demoteLeftBodyToText` — только при Prefix, `В-211`,
 * `В-249`), и `💭 123` уезжало в Block (2026-09-29). Поэтому разбор с условным
 * `- `, который снимается с левого сегмента.
 */
function segmentsOf(line, rules) {
  const start = __sharedUtils.lineStartOf(String(line || ""));
  /* `prefix` у `lineStartOf` включает отступ: спрашивается сам знак. */
  if (start.marker || start.checkbox || start.heading || !String(start.body || "").trim()) return __linePipeline.splitSegments(line, rules);
  const seg = __linePipeline.splitSegments("- " + start.body, rules);
  return { ...seg, indent: start.indent + start.quote + start.callout, left: String(__sharedUtils.lineStartOf(String(seg.left || "")).body || "") };
}

/**
 * Склейка двух строк с полями сливает поля в блоки (`В-242`, BUGHUNT K2):
 * текст склеивается, значения второй встают в блоки первой; одинаковое поле —
 * побеждает первая. Разбор и сборка — движков (`splitSegments`,
 * `buildFromSegments`), чьё значение — `buildTagTokenKeyMap` и метки
 * элементов. `null` — у второй строки полей нет, склейка обычная.
 */
function mergeLinesWithFields(upper, lower, rules) {
  if (!rules || !rules.io) return null;
  const a = segmentsOf(upper, rules);
  const b = segmentsOf(lower, rules);
  const bLeft = String(__sharedUtils.lineStartOf(String(b.left || "")).body || "").trim();
  const bDates = String(b.dates || "").trim();
  if (!bLeft && !bDates) return null;
  const keyMap = __rulesHelpers.buildTagTokenKeyMap(rules, __rulesHelpers.getDefaultTagTokenKeyMapOptions()) || {};
  const markers = [].concat(rules.leftMode && rules.leftMode.fields || [], rules.rightMode && rules.rightMode.fields || [])
    .filter((f) => f && f.marker).map((f) => ({ marker: String(f.marker), id: String(f.id || "") }));
  const fieldOf = (t) => {
    const hit = markers.find((m) => t.startsWith(m.marker));
    if (hit) return hit.id;
    return keyMap[t] || null;
  };
  const merge = (mine, theirs) => {
    const own = __sharedUtils.lineWords(mine);
    const taken = new Set(own.map(fieldOf).filter(Boolean));
    const add = __sharedUtils.lineWords(theirs).filter((t) => { const f = fieldOf(t); return !f || !taken.has(f); });
    return own.concat(add).join(" ");
  };
  const aStart = __sharedUtils.lineStartOf(String(a.left || ""));
  const left = __linePipeline.joinLeftPrefix(String(aStart.prefix || "").trimEnd(), merge(String(aStart.body || ""), bLeft));
  const text = [String(a.text || "").trim(), String(b.text || "").trim()].filter(Boolean).join(" ");
  const dates = merge(String(a.dates || ""), bDates);
  const line = __linePipeline.buildFromSegments({ indent: a.indent, left: left.trim(), text, dates }, rules);
  return { line, textEnd: String(a.text || "").trim() };
}

/** Длина мусора в начале строки (отступ и, если просили, Prefix) — смещение для диапазона. */
function junkLengthOf(text, dropPrefix) {
  return __sharedUtils.linePrefixLength(text, dropPrefix);
}

/**
 * Решение о нажатии `Del`. `null` — не наш случай, клавиша платформе:
 *
 *   1. функция выключена;
 *   2. справа от курсора не только пробелы;
 *   3. ниже нет строки;
 *   4. несколько кареток или выделение (решается в обработчике);
 *   5. своя строка пуста — снимать Prefix у приезжающей незачем.
 */
function planSmartDelete(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  if (!o.enabled) return null;

  const text = String(o.lineText || "");
  const ch = Math.max(0, Math.min(Number(o.ch) || 0, text.length));
  if (String(text.slice(ch)).trim() !== "") return null;
  if (typeof o.nextLineText !== "string") return null;
  /*
   * Пустая строка: следующая приезжает как написана, с отступом и номером
   * (`1. text`, пустая, `2. text` → `2. text`; 2026-09-08).
   */
  if (text.slice(0, ch).trim() === "") return null;

  const next = o.nextLineText;
  const junk = junkLengthOf(next, o.dropPrefix !== false);
  const arriving = next.slice(junk);

  /*
   * От следующей строки после снятия ничего не осталось (пустая, голый буллит,
   * решётка): уходит целиком, курсор на месте.
   */
  if (arriving.trim() === "") {
    return { fromCh: ch, toCh: next.length, insert: "", cursorCh: ch, emptied: true };
  }

  const left = text.slice(0, ch);
  const needsSpace = o.joinWithSpace !== false
    && left.trim() !== ""
    && !/[ \t]$/.test(left);

  return {
    fromCh: ch,
    toCh: junk,
    insert: needsSpace ? " " : "",
    cursorCh: ch,
    emptied: false,
  };
}

/**
 * `Backspace` в начале строки (10.13.32 Д9), свой тумблер и умолчание. Наверх
 * едет эта строка — и мусор снимается у неё; оформление предыдущей не мусор.
 */
function planSmartBackspace(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  if (!o.enabled) return null;
  if (typeof o.prevLineText !== "string") return null;

  const text = String(o.lineText || "");
  const ch = Math.max(0, Math.min(Number(o.ch) || 0, text.length));
  const junk = junkLengthOf(text, o.dropPrefix !== false);

  /* Слева от курсора есть настоящий текст — клавиша не наша. */
  if (ch > junk) return null;

  const prev = o.prevLineText;
  const arriving = text.slice(junk);

  /* От этой строки ничего не осталось: уходит целиком, курсор в конец предыдущей, её хвост не трогается. */
  if (arriving.trim() === "") {
    return { fromCh: prev.length, toCh: text.length, insert: "", cursorCh: prev.length, emptied: true };
  }

  const kept = prev.replace(/[ \t]+$/, "");
  const needsSpace = o.joinWithSpace !== false && kept.trim() !== "";
  const insert = needsSpace ? " " : "";

  return {
    fromCh: kept.length,
    toCh: junk,
    insert,
    /* Курсор встаёт вплотную к приехавшему тексту, а не перед пробелом. */
    cursorCh: kept.length + insert.length,
    emptied: false,
  };
}

/** Обработчик клавиши: редактор — здесь, решение — в чистой функции выше. */
function handleSmartKeymap(plugin, back) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const sd = cfg && cfg.editor && cfg.editor.smartDelete ? cfg.editor.smartDelete : null;
  if (!sd) return false;
  /* У каждой клавиши свой независимый тумблер (Д11). */
  if (back ? sd.onBackspace !== true : sd.enabled !== true) return false;

  const editor = plugin && typeof plugin.getActiveEditor === "function" ? plugin.getActiveEditor() : null;
  if (!editor) return false;

  try {
    if (typeof editor.somethingSelected === "function" && editor.somethingSelected()) return false;
    /*
     * Несколько кареток — каждая своим шагом (BUGHUNT K15): план у каждой,
     * правки снизу вверх, каретки — куда поставил план с поправкой на
     * склеенные выше. Хоть один план не сложился — клавиша вся платформе.
     */
    const sels = typeof editor.listSelections === "function" && Array.isArray(editor.listSelections())
      ? editor.listSelections() : [{ head: editor.getCursor() }];
    const heads = sels.map((x) => (x && (x.head || x.anchor)) || editor.getCursor())
      .map((h) => ({ line: Number(h.line), ch: Number(h.ch) || 0 }));
    if (!heads.length || heads.some((h) => !Number.isFinite(h.line))) return false;
    if (new Set(heads.map((h) => h.line)).size !== heads.length) return false;

    /* Правила движков — ради склейки строк с полями (`В-242`). */
    let rules = null;
    try { rules = __rulesShape.buildRulesForEngines(cfg); } catch (_) { rules = null; /* проба: полуготовый конфиг — склейка обычная */ }
    const plans = [];
    const getLine = (n) => editor.getLine(n);
    for (const h of heads) {
      const line = h.line;
      if (back ? line <= 0 : line >= editor.lastLine()) return false;
      /* Код, ограда, таблица, frontmatter, линия — клавиша родная, иначе строка
         прилипает к `---` или ` ``` ` (BUGHUNT 2026-09-30, B11, B12). */
      const upperNo = back ? line - 1 : line;
      if (__sharedUtils.isCodeOrTableLine(getLine, upperNo) || __sharedUtils.isCodeOrTableLine(getLine, upperNo + 1)) return false;
      const common = {
        enabled: true,
        lineText: String(editor.getLine(line) || ""),
        ch: h.ch,
        dropPrefix: sd.dropPrefix !== false,
        joinWithSpace: sd.joinWithSpace !== false,
      };
      const plan = back
        ? planSmartBackspace({ ...common, prevLineText: String(editor.getLine(line - 1) || "") })
        : planSmartDelete({ ...common, nextLineText: String(editor.getLine(line + 1) || "") });
      if (!plan) return false;
      /* Диапазон всегда идёт от верхней строки к нижней, чем бы его ни считали. */
      const top = back ? line - 1 : line;
      if (!plan.emptied && rules) {
        const upper = String(editor.getLine(top) || "");
        const lower = String(editor.getLine(top + 1) || "");
        const merged = mergeLinesWithFields(upper, lower, rules);
        if (merged) {
          const slot = merged.line.indexOf(merged.textEnd);
          const caret = merged.textEnd && slot >= 0 ? slot + merged.textEnd.length : merged.line.length;
          plans.push({ top, plan: { fromCh: 0, toCh: lower.length, insert: merged.line, cursorCh: caret, whole: upper.length } });
          continue;
        }
      }
      plans.push({ top, plan });
    }
    plans.sort((x, y) => y.top - x.top);
    const carets = plans.slice().reverse().map(({ top, plan }, i) => ({ line: top - i, ch: plan.cursorCh }));
    /*
     * Одна транзакция — одна ступень отмены (BUGHUNT 2026-09-30, B13). Изменения
     * транзакции — в координатах исходного документа, выделения — в новом,
     * прокрутка к каретке — та же, что у `replaceRange` (`transaction` в `app.js` 1.13.7).
     */
    editor.transaction({
      changes: plans.slice().reverse().map(({ top, plan }) => ({
        from: { line: top, ch: plan.fromCh }, to: { line: top + 1, ch: plan.toCh }, text: plan.insert,
      })),
      selections: carets.map((c) => ({ from: c })),
    });
    return true;
  } catch (e) {
    console.error("[inline-overhaul][smart-delete]", e);
    return false;
  }
}

function handleSmartDeleteKeymap(plugin) {
  return handleSmartKeymap(plugin, false);
}

function handleSmartBackspaceKeymap(plugin) {
  return handleSmartKeymap(plugin, true);
}

module.exports = {
  mergeLinesWithFields,
  junkLengthOf,
  planSmartDelete,
  planSmartBackspace,
  handleSmartDeleteKeymap,
  handleSmartBackspaceKeymap,
};
