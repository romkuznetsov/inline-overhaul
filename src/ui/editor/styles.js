"use strict";

/**
 * Свои блоки `<style>`: заливка панели TagWheel, каретка, полосы тегов.
 * Правила — в `editor_visuals_config.js`, здесь только постановка и снятие.
 * Узлы висят на плагине (`_tagwheelFillStyleEl`, `_caretStyleEl`,
 * `_stripLineStyleEl`), снимает их `removeAll` при выгрузке (У-32).
 * Каретка пересобирается своей подпиской на хранилище: перерисовка панели
 * откладывается, пока фокус в поле ввода (10.13.33 Ц5).
 */

const __editorVisualsConfig = require("../../core/editor_visuals_config.js");

const buildCaretStyleCss = __editorVisualsConfig.buildCaretStyleCss;
const buildBlockFillStyleCss = __editorVisualsConfig.buildBlockFillStyleCss;
const blockFillLookFromConfig = __editorVisualsConfig.blockFillLookFromConfig;
const caretLookFromConfig = __editorVisualsConfig.caretLookFromConfig;
const STRIP_LINE_STYLE_CSS = __editorVisualsConfig.STRIP_LINE_STYLE_CSS;
const TAGWHEEL_FILL_STYLE_CSS = __editorVisualsConfig.TAGWHEEL_FILL_STYLE_CSS;

/**
 * Блок правил не встал — в журнал разработчика (Д-4): ставится при загрузке,
 * человек этого не начинал. Одно место на все постановки (У-32).
 */
function reportStyleFailure(plugin, what, error) {
  try {
    plugin.devLogEvent("styles.inject", {
      ok: false,
      what: String(what || ""),
      message: String(error && error.message ? error.message : error || ""),
    }, "error", plugin.getConfig());
  } catch (_) {
    /* журнал не роняет постановку стилей: второй отказ ничего не добавит */
  }
}

function ensureTagwheelFill(plugin) {
  try {
    if (plugin._tagwheelFillStyleEl && plugin._tagwheelFillStyleEl.parentNode) return;
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-inline-overhaul", "tagwheel-fill");
    styleEl.textContent = TAGWHEEL_FILL_STYLE_CSS;
    document.head.appendChild(styleEl);
    plugin._tagwheelFillStyleEl = styleEl;
    plugin.register(() => {
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    });
  } catch (e) {
    reportStyleFailure(plugin, "tagwheel-fill", e);
  }
}

/**
 * Блок стилей каретки и своя подписка на хранилище (10.13.33 Ц5): перерисовка
 * панели откладывается при фокусе в поле (`store_events_orchestrator.js`).
 */
function ensureCaret(plugin) {
  try {
    if (!plugin._caretStyleEl || !plugin._caretStyleEl.parentNode) {
      const styleEl = document.createElement("style");
      styleEl.setAttribute("data-inline-overhaul", "caret");
      document.head.appendChild(styleEl);
      plugin._caretStyleEl = styleEl;
      plugin.register(() => {
        if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      });
    }
    refreshCaret(plugin);
    if (plugin.store && typeof plugin.store.subscribe === "function") {
      plugin.register(plugin.store.subscribe(() => refreshCaret(plugin)));
    }
  } catch (e) {
    reportStyleFailure(plugin, "caret", e);
  }
}

function refreshCaret(plugin) {
  try {
    if (!plugin._caretStyleEl) return;
    const css = buildCaretStyleCss(caretLookFromConfig(plugin.getConfig()));
    if (plugin._caretStyleEl.textContent !== css) plugin._caretStyleEl.textContent = css;
  } catch (_) {
    /*
     * Молчит нарочно: пересборка зовётся на каждую правку конфига (каждое
     * движение ползунка) и залила бы журнал. Правила остаются прежними.
     */
  }
}

/**
 * Заливка Left и Right Block (З-7), устроено как у каретки. Тумблер выключен —
 * правил нет.
 */
function ensureBlockFill(plugin) {
  try {
    if (!plugin._blockFillStyleEl || !plugin._blockFillStyleEl.parentNode) {
      const styleEl = document.createElement("style");
      styleEl.setAttribute("data-inline-overhaul", "block-fill");
      document.head.appendChild(styleEl);
      plugin._blockFillStyleEl = styleEl;
      plugin.register(() => {
        if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      });
    }
    refreshBlockFill(plugin);
    if (plugin.store && typeof plugin.store.subscribe === "function") {
      plugin.register(plugin.store.subscribe(() => refreshBlockFill(plugin)));
    }
  } catch (e) {
    reportStyleFailure(plugin, "block-fill", e);
  }
}

function refreshBlockFill(plugin) {
  try {
    if (!plugin._blockFillStyleEl) return;
    const css = buildBlockFillStyleCss(blockFillLookFromConfig(plugin.getConfig()));
    if (plugin._blockFillStyleEl.textContent !== css) plugin._blockFillStyleEl.textContent = css;
  } catch (_) {
    /* Молчит, как пересборка каретки: зовётся на каждую правку конфига. */
  }
}

function ensureStripLine(plugin) {
  try {
    if (plugin._stripLineStyleEl && plugin._stripLineStyleEl.parentNode) return;
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-inline-overhaul", "strip-line");
    styleEl.textContent = STRIP_LINE_STYLE_CSS;
    document.head.appendChild(styleEl);
    plugin._stripLineStyleEl = styleEl;
    plugin.register(() => {
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    });
    try {
      plugin.devLogEvent("strip.css.inject", { ok: true }, "trace", plugin.getConfig());
    } catch (_) {
      /* журнал не роняет постановку: блок уже встал */
    }
  } catch (e) {
    /* Своё событие у полос — по нему ищут в журнале; не переименовывать. */
    try {
      plugin.devLogEvent("strip.css.inject", {
        ok: false,
        message: String(e && e.message ? e.message : e || ""),
      }, "error", plugin.getConfig());
    } catch (_) {
      /* см. выше: журнал молчит последним */
    }
  }
}

/**
 * Снять все свои блоки правил; зовёт выгрузка плагина (У-32). Снятие явное и
 * раньше `register`: иначе узел живёт до конца отрисовки после выключения.
 */
function removeAll(plugin) {
  for (const key of ["_tagwheelFillStyleEl", "_stripLineStyleEl", "_caretStyleEl", "_blockFillStyleEl"]) {
    const el = plugin ? plugin[key] : null;
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (plugin) plugin[key] = null;
  }
}

module.exports = {
  ensureTagwheelFill,
  ensureCaret,
  refreshCaret,
  ensureBlockFill,
  refreshBlockFill,
  ensureStripLine,
  removeAll,
};
