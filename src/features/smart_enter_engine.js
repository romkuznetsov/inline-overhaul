"use strict";

/**
 * Smart Enter (PRD 10.13.88): `Enter` не рвёт строку-запись, а добавляет
 * следующую, оставляя нынешнюю как есть.
 * `planSmartEnter` — чистая функция; каждый тихий отказ — `null`, клавиша
 * уходит платформе (У-41). Слот текста считает только `getTextSlotBounds`
 * (`pkm_macro_shared.js`) — своего разбора строки здесь быть не должно (У-32).
 * `scope` (10.13.91): `line` — вся строка, `text` — только слот текста.
 */

const __sharedUtils = require("../core/shared_utils.js");
const __macroShared = require("../core/pkm_macro_shared.js");
const __rulesShape = require("../core/pkm_rules_shape.js");

/**
 * Знак списка для новой строки — как у Obsidian (У-91): маркер повторяется,
 * номер +1, чекбокс пустой. Режимы: `same` (умолчание), `none`, `number-only`
 * (только номер; чекбокс уходит с маркером). Пусто — знака нет.
 */
function nextMarkerFor(lineText, mode) {
  const how = String(mode == null ? "same" : mode);
  if (how === "none") return "";
  const p = __sharedUtils.lineMarkerOf(lineText);
  if (!p.marker) return "";
  if (how === "number-only" && !p.ordered) return "";
  let marker = p.marker;
  if (p.ordered) {
    marker = marker.replace(/^(\d+)/, function (whole) {
      const n = Number(whole);
      return Number.isFinite(n) ? String(n + 1) : whole;
    });
  }
  if (how === "number-only") {
    /* Остаётся только счёт: чекбокс уходит вместе с остальным знаком. */
    return marker.replace(/\s*\[[^\]]\]\s*/, " ");
  }
  /* Чекбокс уезжает пустым: знак внутри скобок ровно один (A34, У-91). */
  marker = marker.replace(/\[[^\]]\]/, "[ ]");
  return marker;
}

/**
 * Решение о нажатии `Enter`; `null` — не наш случай. Отказы: функция выключена;
 * строка пуста или в ней один знак списка; при `scope = "text"` курсор вне слота
 * текста; несколько кареток или выделение (отсекает обработчик выше).
 * Отказа «курсор за вторым разделителем» нет намеренно — это решает `scope`.
 */
function planSmartEnter(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  if (!o.enabled) return null;

  const text = String(o.lineText || "");
  const p = __sharedUtils.lineMarkerOf(text);
  /* Строка без разделителей — целиком слот текста (2026-09-29). Пустая строка и
   * пустой пункт списка остаются платформе: `Enter` выходит из списка. */
  let bounds = o.textSlot;
  if (!bounds || typeof bounds.end !== "number") {
    if (!text.slice(p.at).trim()) return null;
    bounds = { start: p.at, end: text.length };
  }

  const ch = Math.max(0, Math.min(Number(o.ch) || 0, text.length));
  if (String(o.scope || "line") === "text") {
    const from = typeof bounds.start === "number" ? bounds.start : 0;
    if (ch < from || ch > bounds.end) return null;
  }

  /* Отступ сохраняется при любом режиме знака: вложенная строка не прыгает к краю. */
  const marker = nextMarkerFor(text, o.newLinePrefix);
  /* Цитата повторяется, имя каллаута нет: второй `[!note]` подряд — новый
     каллаут, а не продолжение (BUGHUNT 2026-09-30, B14). */
  const newLineText = p.indent + __sharedUtils.lineStartOf(text).quote + marker;
  return { newLineText, cursorCh: newLineText.length };
}

/**
 * Обработчик клавиши. Всё, что связано с редактором, живёт здесь; решение —
 * в чистой функции выше.
 */
function handleSmartEnterKeymap(plugin, viaShift) {
  if (plainEnter) return false;
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const se = cfg && cfg.editor && cfg.editor.smartEnter ? cfg.editor.smartEnter : null;
  if (!se || se.enabled !== true) return false;
  /* Клавиша Smart Enter — `Enter`, а с `Use Shift+Enter instead` — `Shift+Enter`. */
  if ((se.useShift === true) !== (viaShift === true)) return false;

  const editor = plugin && typeof plugin.getActiveEditor === "function" ? plugin.getActiveEditor() : null;
  if (!editor) return false;

  try {
    if (typeof editor.somethingSelected === "function" && editor.somethingSelected()) return false;
    if (typeof editor.listSelections === "function") {
      const sels = editor.listSelections();
      if (Array.isArray(sels) && sels.length > 1) return false;
    }

    const cursor = editor.getCursor();
    const line = Number(cursor && cursor.line);
    if (!Number.isFinite(line)) return false;

    const lineText = String(editor.getLine(line) || "");
    /* Код и таблица — не запись: там `Enter` рвёт строку (R4). */
    if (__sharedUtils.isCodeOrTableLine((n) => editor.getLine(n), line)) return false;
    /* Правила — как у движков (`buildRulesForEngines`), с Fields: без них
     * одиночный разделитель не признать вторым (BUGHUNT K4). */
    const lf = cfg.pkm && cfg.pkm.lineFormat ? cfg.pkm.lineFormat : {};
    if (!lf.separator1 || !lf.separator2) return false;
    const rules = __rulesShape.buildRulesForEngines(cfg);

    const plan = planSmartEnter({
      enabled: true,
      lineText,
      ch: Number(cursor.ch) || 0,
      textSlot: __macroShared.getTextSlotBounds(lineText, rules),
      newLinePrefix: se.newLinePrefix,
      scope: se.scope,
    });
    if (!plan) return false;

    /* Вставка нулевым диапазоном в конце строки: в истории отмен одна ступень, строка
     * человека не тронута. */
    const end = { line, ch: lineText.length };
    editor.replaceRange("\n" + plan.newLineText, end, end);
    editor.setCursor({ line: line + 1, ch: plan.cursorCh });
    return true;
  } catch (e) {
    console.error("[inline-overhaul][smart-enter]", e);
    return false;
  }
}

/* Идёт проход обычного `Enter` за `Shift+Enter` — Smart Enter в нём не участвует. */
let plainEnter = false;

/**
 * `Shift+Enter` — обычный `Enter` платформы при Smart Enter и `Shift+Enter as
 * usual Enter` (2026-09-30). `runEnter` прогоняет обработчики `Enter` без Shift.
 */
function handlePlainEnterKeymap(plugin, runEnter) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const se = cfg && cfg.editor && cfg.editor.smartEnter ? cfg.editor.smartEnter : null;
  if (se && se.enabled === true && se.useShift === true) return handleSmartEnterKeymap(plugin, true);
  if (!se || se.enabled !== true || se.shiftPlainEnter !== true || typeof runEnter !== "function") return false;
  plainEnter = true;
  try {
    return runEnter() === true;
  } finally {
    plainEnter = false;
  }
}

module.exports = {
  nextMarkerFor,
  planSmartEnter,
  handleSmartEnterKeymap,
  handlePlainEnterKeymap,
};
