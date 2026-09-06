"use strict";
/*
 * Шов к помощникам состояния дерева значений — и ничего больше.
 *
 * **Чем этот файл был.** Доска Order целиком, 2284 строки, перенесённые сюда
 * из `settings_sections_renderer.js` без изменения логики (фаза 3b, пункт 2,
 * Ф12–Ф16). Перенос был честный: код дословно тот же, и это доказывали два
 * пина, снятые до него.
 *
 * **Почему доски здесь больше нет (2026-09-06, фаза 6).** Панель, которая её
 * рисовала, снята фазой 3. С тех пор `renderPkmOrderBoardSection` звали ровно
 * два места, и оба — проверки; в продукте её не звал никто. Но esbuild этого
 * не знает: функция была экспортирована, и все 2284 строки уезжали в бандл к
 * каждому, кто ставил плагин.
 *
 * Мёртвый код не бывает нейтральным. Он был единственной причиной, по которой
 * файл выведен из гейтов слоя настроек Г1–Г5, Г10, Г17–Г19: в доске жили
 * инлайновые стили, цветовые литералы, `createEl("h3")` и тексты старой
 * панели. Исключение снято вместе с ней.
 *
 * **Что осталось и почему именно оно.** `getOrderDeepEditorState` — способ
 * добраться до `src/core/order_deep_editor_state.js`, общего для редактора
 * Fields, списков порядка, предпросмотров и Smart Rules. Все четверо берут
 * его отсюда, а не ищут сами, и это не привычка: у поиска есть откат на
 * заглушку, и два таких отката разошлись бы молча (У-32).
 *
 * **Этот остаток — тот же мост модулей**, что снимается пунктом 1 фазы 6:
 * `globalThis`, `require` по относительному пути и заглушка на случай отказа.
 * Когда мост заменят статическим импортом, файл исчезнет целиком, а его
 * четыре потребителя станут импортировать `order_deep_editor_state.js`
 * напрямую. Имя `..._legacy` до тех пор остаётся: переименовывать файл, у
 * которого назначен срок сноса, — лишний коммит в чужой истории.
 */

let __orderDeepEditorState = null;

let __orderDeepEditorStateDiag = "";

function hasValidOrderDeepEditorState(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.buildTagTree === "function"
    && typeof mod.applyTagTreeToFields === "function"
    && typeof mod.createHistory === "function"
    && typeof mod.pushHistory === "function"
    && typeof mod.undoHistory === "function"
    && typeof mod.redoHistory === "function"
    && typeof mod.resetHistory === "function");
}

function createOrderDeepEditorStateUnavailable(reason) {
  const msg = String(reason || "order_deep_editor_state unavailable");
  return {
    __unavailable: true,
    __unavailableReason: msg,
    IO_BETA_ORDER_DEEP_EDITOR: "IO_BETA_ORDER_DEEP_EDITOR",
    IO_BETA_CONFLICT_DIALOG: "IO_BETA_CONFLICT_DIALOG",
    IO_TEMP_HISTORY_LIMIT: 100,
    normalizeToken(raw) { return String(raw || "").trim(); },
    buildTagTree() { return []; },
    applyTagTreeToFields(_tree, parentField, subField) {
      return { parentField: parentField || { values: [] }, subField: subField || null };
    },
    createHistory() { return { max: 100, past: [], future: [] }; },
    pushHistory(history) { return history && typeof history === "object" ? history : { max: 100, past: [], future: [] }; },
    undoHistory(history, currentSnapshot) { return { changed: false, snapshot: currentSnapshot, history: history || { max: 100, past: [], future: [] } }; },
    redoHistory(history, currentSnapshot) { return { changed: false, snapshot: currentSnapshot, history: history || { max: 100, past: [], future: [] } }; },
    resetHistory(history) {
      const h = history && typeof history === "object" ? history : { max: 100, past: [], future: [] };
      h.past = [];
      h.future = [];
      return h;
    },
  };
}

function getOrderDeepEditorState() {
  if (__orderDeepEditorState) return __orderDeepEditorState;
  try {
    if (hasValidOrderDeepEditorState(globalThis.__inlineOrderDeepEditorState)) {
      __orderDeepEditorState = globalThis.__inlineOrderDeepEditorState;
      __orderDeepEditorStateDiag = "";
      return __orderDeepEditorState;
    }
  } catch (_) {}
  try {
    // IO_BETA_ORDER_DEEP_EDITOR helpers live in shared core for cycle/tagwheel parity safety.
    const local = require("../../../core/order_deep_editor_state.js");
    if (hasValidOrderDeepEditorState(local)) {
      __orderDeepEditorState = local;
      __orderDeepEditorStateDiag = "";
      return __orderDeepEditorState;
    }
    __orderDeepEditorStateDiag = "invalid order_deep_editor_state contract";
  } catch (e) {
    __orderDeepEditorStateDiag = String(e && e.message ? e.message : e || "order_deep_editor_state require failed");
  }
  __orderDeepEditorState = createOrderDeepEditorStateUnavailable(__orderDeepEditorStateDiag);
  return __orderDeepEditorState;
}

module.exports = {
  getOrderDeepEditorState,
};
