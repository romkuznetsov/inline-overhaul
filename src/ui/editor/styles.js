"use strict";

/**
 * Свои блоки `<style>` в голове документа: заливка панели TagWheel, каретка и
 * полосы тегов.
 *
 * **Почему это отдельный модуль** (кусок четвёртый разбора `main.js`,
 * 2026-09-07). Работа здесь одна и та же у всех трёх: создать узел, положить в
 * него готовый текст правил и снять узел при выгрузке. Сами правила лежат в
 * `editor_visuals_config.js` — этот модуль их только ставит.
 *
 * **Узлы висят на плагине** (`_tagwheelFillStyleEl`, `_caretStyleEl`,
 * `_stripLineStyleEl`): их время жизни — время жизни плагина, и второе место
 * для них значило бы второе объявление того, когда их снимать (У-32). Снимает
 * их `removeAll`, и зовёт её выгрузка плагина.
 *
 * **У каретки правила пересобираются на каждую правку конфига** — своей
 * подпиской на хранилище, а не перерисовкой панели: та откладывается, пока
 * фокус стоит в поле ввода, а цвет должен меняться под рукой (10.13.33 Ц5).
 */

const __editorVisualsConfig = require("../../core/editor_visuals_config.js");

const buildCaretStyleCss = __editorVisualsConfig.buildCaretStyleCss;
const caretLookFromConfig = __editorVisualsConfig.caretLookFromConfig;
const STRIP_LINE_STYLE_CSS = __editorVisualsConfig.STRIP_LINE_STYLE_CSS;
const TAGWHEEL_FILL_STYLE_CSS = __editorVisualsConfig.TAGWHEEL_FILL_STYLE_CSS;

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
  } catch (_) {}
}

/**
 * Свой блок стилей каретки и подписка на хранилище (10.13.33 Ц5).
 *
 * Подписка своя, а не через перерисовку панели: та откладывается, пока
 * фокус стоит в поле ввода (`store_events_orchestrator.js`), а цвет должен
 * меняться под рукой, а не после ухода фокуса.
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
  } catch (_) {}
}

function refreshCaret(plugin) {
  try {
    if (!plugin._caretStyleEl) return;
    const css = buildCaretStyleCss(caretLookFromConfig(plugin.getConfig()));
    if (plugin._caretStyleEl.textContent !== css) plugin._caretStyleEl.textContent = css;
  } catch (_) {}
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
      const cfg = plugin.getConfig();
      plugin.devLogEvent("strip.css.inject", { ok: true }, "trace", cfg);
    } catch (_) {}
  } catch (e) {
    try {
      const cfg = plugin.getConfig();
      plugin.devLogEvent("strip.css.inject", {
        ok: false,
        message: String(e && e.message ? e.message : e || ""),
      }, "error", cfg);
    } catch (_) {}
  }
}

/**
 * Снять все свои блоки правил.
 *
 * Зовёт выгрузка плагина. До переезда эти двенадцать строк стояли в
 * `onunload` — то есть где ставить узел и где его снимать, знали два разных
 * места. Теперь одно (У-32).
 *
 * `register` у Obsidian снимает узлы и сам, при выгрузке плагина; здесь они
 * снимаются **раньше и явно**, и это не дубль: без явного снятия узел живёт до
 * конца текущей отрисовки, а человек в это время уже выключил плагин.
 */
function removeAll(plugin) {
  for (const key of ["_tagwheelFillStyleEl", "_stripLineStyleEl", "_caretStyleEl"]) {
    const el = plugin ? plugin[key] : null;
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (plugin) plugin[key] = null;
  }
}

module.exports = {
  ensureTagwheelFill,
  ensureCaret,
  refreshCaret,
  ensureStripLine,
  removeAll,
};
