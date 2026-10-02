"use strict";

/**
 * Что полоса панели закрывает — прячется оформлением, а не удалением
 * (2026-09-13): документ получает только вставку, `Ctrl+Z` возвращает было
 * (`panel_line_write.js`, У-160). Отрезки приносит сессия ступенью
 * состояния (У-32, У-150). Пустая замена `Decoration.replace` без виджета —
 * своей отрисовки нет. Пустой список отрезков — законное значение.
 */

const cmState = require("@codemirror/state");
const cmView = require("@codemirror/view");

/*
 * Ступень и поле — при первом обращении: `@codemirror/state` внешний (даёт
 * Obsidian), вне Obsidian на загрузке модуля там заглушка.
 */
let parts = null;

function ensureParts() {
  if (parts) return parts;
  /** Ступень: «на этой строке спрятать вот эти отрезки». */
  const setPanelMask = cmState.StateEffect.define();
  /** Что спрятано: строка (с нуля) и отрезки столбцами строки — сессия знает строку, не документ. */
  const panelMaskField = cmState.StateField.define({
    create() { return null; },
    update(value, tr) {
      let next = value;
      for (const effect of tr.effects) {
        if (!effect.is(setPanelMask)) continue;
        next = effect.value && Array.isArray(effect.value.hidden) && effect.value.hidden.length
          ? { line: Number(effect.value.line) || 0, hidden: effect.value.hidden }
          : null;
      }
      return next;
    },
  });
  parts = { setPanelMask, panelMaskField };
  return parts;
}

/** Отрезки маски в смещениях документа, с прижимом к границам строки. */
function maskRanges(state) {
  const mask = state.field(ensureParts().panelMaskField, false);
  if (!mask) return [];
  const lineNumber = Number(mask.line) + 1;
  if (!(lineNumber >= 1 && lineNumber <= state.doc.lines)) return [];
  const line = state.doc.line(lineNumber);
  const out = [];
  for (const range of mask.hidden) {
    const from = line.from + Math.max(0, Math.min(line.length, Number(range[0]) || 0));
    const to = line.from + Math.max(0, Math.min(line.length, Number(range[1]) || 0));
    if (to > from) out.push({ from, to });
  }
  out.sort((a, b) => a.from - b.from);
  return out;
}

function buildPanelMaskDecorations(state) {
  const ranges = maskRanges(state);
  if (!ranges.length) return cmView.Decoration.none;
  return cmView.Decoration.set(ranges.map((r) => cmView.Decoration
    .replace({ inclusive: false })
    .range(r.from, r.to)), true);
}

/** Расширение: поле состояния плюс декорации; приоритет не задаётся — маска только убирает. */
function createPanelMaskExtension() {
  const field = ensureParts().panelMaskField;
  return [
    field,
    cmView.EditorView.decorations.compute([field, "doc"], buildPanelMaskDecorations),
  ];
}

/** Сказать редактору, что прятать; `hidden` пуст — маска снимается. Проба: редактора может не быть. */
function applyPanelMask(cm, lineNumber, hidden) {
  if (!cm || typeof cm.dispatch !== "function" || !cm.state) return false;
  if (!cmState || !cmState.StateEffect || typeof cmState.StateEffect.define !== "function") return false;
  try {
    cm.dispatch({
      effects: ensureParts().setPanelMask.of({
        line: Number(lineNumber) || 0,
        hidden: Array.isArray(hidden) ? hidden : [],
      }),
    });
    return true;
  } catch (_) {
    /*
     * Украшение не роняет текст: редактор без ступеней состояния — подделка в
     * проверках или чужая обёртка; человек увидит полосу и закрытое ею.
     */
    return false;
  }
}

module.exports = {
  ensureParts,
  maskRanges,
  buildPanelMaskDecorations,
  createPanelMaskExtension,
  applyPanelMask,
};
