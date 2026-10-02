"use strict";

/**
 * Smart paste (`З-31`, `З-32`; имя с 2026-09-21), один выключатель (`В-165`):
 * вставленный нумерованный список считается с 1, а `1. text` в строку `2. `
 * даёт `2. text`. Продолжение счёта под списком пишет фильтр нумерации
 * Obsidian в `app.js` (У-245, правило 167, `tools/renumber_bench.js`) — своего
 * правила нет (правило 101). Поэтому запись — обычная правка, не
 * `Editor.setValue`: на `userEvent: "set"` фильтр молчит. Решение
 * (`planSmartPaste`) отдельно от записи, как у `Smart Enter`.
 */

const __sharedUtils = require("../core/shared_utils.js");

/**
 * Что уйдёт в документ вместо буфера, или `null` — вставка Obsidian: выключено,
 * буфер пуст, блок кода, или посчитанное совпало с буфером (главный случай).
 */
function planSmartPaste(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  if (!o.enabled) return null;

  const pasted = String(o.pasted == null ? "" : o.pasted);
  if (!pasted) return null;
  /* В блоке кода номера — текст программы, а не список (ревизия Д-6). */
  if (o.inCode === true) return null;

  const lineText = String(o.lineText == null ? "" : o.lineText);
  const ch = Math.max(0, Math.min(Number(o.ch) || 0, lineText.length));

  let lines = pasted.split("\n");

  /* `З-32`: курсор за знаком строки — первая строка вставки теряет свой знак
     (иначе `2. 1. text`). Разбор начала тот же, что у `Smart Enter` (У-32). */
  const target = __sharedUtils.lineMarkerOf(lineText);
  let joined = false;
  if (target.marker && ch >= target.at) {
    const head = __sharedUtils.lineMarkerOf(lines[0]);
    if (head.marker) {
      lines[0] = String(lines[0]).slice(head.at);
      joined = true;
    }
  }

  /* `З-31`: пункты с единицы, по уровням — `renumberOrderedWindow`, общий с
     переносом строк. Вставка посреди строки — первая строка не пункт (Д-6). */
  const midLine = !joined && lineText.slice(__sharedUtils.lineStartOf(lineText).at, ch).trim() !== "";
  lines = midLine
    ? (lines.length > 1 ? __sharedUtils.renumberOrderedWindow(lines, 1, lines.length - 1) : lines)
    : __sharedUtils.renumberOrderedWindow(lines, 0, lines.length - 1);

  let insert = lines.join("\n");

  /* Стык: пробел только после непробела слева (`2. aaa` + `1. text` → `2. aaa text`). */
  if (joined && insert) {
    const before = lineText.slice(0, ch);
    if (before && !/\s$/.test(before) && !/^\s/.test(insert)) insert = " " + insert;
  }

  if (insert === pasted) return null;
  return { insert };
}

/**
 * Обработчик вставки: `true` — взял плагин, `false` — вставка Obsidian.
 * `evt.defaultPrevented` первым — так велит `obsidian.d.ts`.
 */
function handleSmartPaste(plugin, evt, editor) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const sp = cfg && cfg.editor && cfg.editor.smartPaste ? cfg.editor.smartPaste : null;
  if (!sp || sp.enabled !== true) return false;
  if (!evt || evt.defaultPrevented) return false;
  if (!editor || typeof editor.replaceSelection !== "function") return false;
  /* Несколько кареток — платформе: она раздаёт строки по кареткам (Г-2). */
  if (typeof editor.listSelections === "function" && editor.listSelections().length > 1) return false;

  try {
    const data = evt.clipboardData;
    /* Проба: буфера может не быть. */
    if (!data || typeof data.getData !== "function") return false;
    /* Картинку и файл не трогаем. */
    const pasted = String(data.getData("text/plain") || "").replace(/\r\n?/g, "\n");
    if (!pasted) return false;

    /* Место вставки — начало выделения. */
    const from = typeof editor.getCursor === "function" ? editor.getCursor("from") : null;
    const line = Number(from && from.line);
    if (!Number.isFinite(line)) return false;

    const plan = planSmartPaste({
      enabled: true,
      pasted,
      lineText: String(editor.getLine(line) || ""),
      ch: Number(from.ch) || 0,
      inCode: __sharedUtils.isInsideFence((n) => editor.getLine(n), line),
    });
    if (!plan) return false;

    evt.preventDefault();
    /* Обычная правка: своя ступень истории, фильтр нумерации продолжает счёт. */
    editor.replaceSelection(plan.insert);
    return true;
  } catch (e) {
    console.error("[inline-overhaul][smart-paste]", e);
    return false;
  }
}

module.exports = {
  planSmartPaste,
  handleSmartPaste,
};
