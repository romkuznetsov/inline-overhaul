"use strict";

/**
 * Что полоса панели закрывает собой — прячется оформлением, а не удалением.
 *
 * **Зачем.** Решение заказчика 2026-09-13: полоса встаёт **рядом** со
 * значениями, а не вместо них, — тогда документ получает только вставку, и
 * `Ctrl+Z` после сессии возвращает то, что было (разбор — `panel_line_write.js`
 * и У-160). Но на экране всё должно остаться как было: значения, которые полоса
 * собой закрывает, человек видеть не должен. Этим и занят этот слой.
 *
 * **Отрезки сюда приносит сессия, а не вычисляет слой.** Что показывает
 * полоса, решает движок панели; слой, который решал бы это второй раз, был бы
 * вторым объявлением одного правила и разошёлся бы с первым молча (У-32,
 * У-150). Поэтому отрезки приезжают ступенью состояния, а слой только рисует.
 *
 * **Прячется пустой заменой, а не своим узлом.** `Decoration.replace` без
 * виджета убирает кусок с экрана, ничего не рисуя взамен: своей отрисовки у
 * этого слоя нет ни одной, и потому спорить с разметкой Obsidian ему нечем —
 * ровно этого и стоило избежать (у панели вид рисует Obsidian, а мы
 * перекрашиваем).
 *
 * **Уходит маска вместе с сессией.** Строка, на которой панели больше нет,
 * прячет ноль отрезков: пустой список — законное значение, а не «нет данных».
 */

const cmState = require("@codemirror/state");
const cmView = require("@codemirror/view");

/*
 * **Ступень и поле заводятся при первом обращении, а не при загрузке модуля.**
 *
 * `@codemirror/state` в сборке объявлен внешним: пакет даёт сам Obsidian.
 * Работа на уровне модуля означала бы, что модуль обязан получить настоящий
 * пакет **в момент загрузки плагина**, — и проверка сборки уронила набор той же
 * минутой, потому что вне Obsidian на этом месте заглушка. Внутри функции
 * пакет нужен только тому, кто и правда открывает редактор.
 */
let parts = null;

function ensureParts() {
  if (parts) return parts;
  /** Ступень: «на этой строке спрятать вот эти отрезки». */
  const setPanelMask = cmState.StateEffect.define();
  /**
   * Что спрятано сейчас: номер строки (с нуля) и отрезки внутри неё.
   *
   * Отрезки хранятся **столбцами строки**, а не смещениями документа: сессия
   * знает строку, а не документ, и пересчёт смещений при каждой правке строки
   * был бы третьим местом, где живёт одно и то же знание.
   */
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

/**
 * Расширение редактора: поле состояния плюс декорации по нему.
 *
 * Приоритет здесь не задаётся: маска ничего не красит и ни с кем не спорит за
 * вид — она только убирает с экрана кусок текста.
 */
function createPanelMaskExtension() {
  const field = ensureParts().panelMaskField;
  return [
    field,
    cmView.EditorView.decorations.compute([field, "doc"], buildPanelMaskDecorations),
  ];
}

/**
 * Сказать редактору, что прятать. `hidden` пуст — маска снимается.
 *
 * Проба, а не требование: редактора может не быть вовсе (выгрузка, чужое
 * окно), и тогда прятать некому. Ответ «нет» здесь — ответ.
 */
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
     * Украшение: маска только убирает кусок с экрана и права уронить текст
     * человека не имеет. Редактор, который не умеет ступени состояния, — это
     * не Obsidian: так выглядят подделки редактора в проверках и чужие обёртки.
     * Человек в этом случае видит и полосу, и то, что она закрывает, — хуже,
     * чем задумано, но лучше, чем оборванная сессия.
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
