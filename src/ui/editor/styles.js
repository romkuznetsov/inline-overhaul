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
const buildBlockFillStyleCss = __editorVisualsConfig.buildBlockFillStyleCss;
const blockFillLookFromConfig = __editorVisualsConfig.blockFillLookFromConfig;
const caretLookFromConfig = __editorVisualsConfig.caretLookFromConfig;
const STRIP_LINE_STYLE_CSS = __editorVisualsConfig.STRIP_LINE_STYLE_CSS;
const TAGWHEEL_FILL_STYLE_CSS = __editorVisualsConfig.TAGWHEEL_FILL_STYLE_CSS;

/**
 * Блок правил не встал — сказать журналу разработчика (Д-4, правило отказов).
 *
 * **Одно место на все четыре постановки.** До 2026-09-09 их было четыре, и
 * вели они себя по-разному: `ensureStripLine` писала в журнал и удачу, и
 * отказ, а три соседки молчали. Операция при этом одна и та же — создать узел
 * `<style>` и положить в него готовый текст, — то есть правило «что делать,
 * когда не вышло» было объявлено трижды и разошлось (У-32).
 *
 * **Почему журнал, а не `Notice`.** Человек этого не начинал: блоки правил
 * ставятся при загрузке. Сломалось невидимое — значит второй вид отказа, и
 * придёт человек со словами «оформление перестало работать». Журнал —
 * единственное, из чего можно будет узнать, почему.
 *
 * Сама запись в журнал молчит: она последняя в цепочке, и уронить постановку
 * стилей ей нечем и незачем.
 */
function reportStyleFailure(plugin, what, error) {
  try {
    plugin.devLogEvent("styles.inject", {
      ok: false,
      what: String(what || ""),
      message: String(error && error.message ? error.message : error || ""),
    }, "error", plugin.getConfig());
  } catch (_) {
    /* журнал не имеет права уронить постановку стилей: цель уже не достигнута,
       и второй отказ ничего к первому не добавит */
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
     * Украшение, и молчит нарочно — в отличие от постановки выше. Пересборка
     * зовётся на **каждую** правку конфига, то есть на каждое движение
     * ползунка: запись в журнал отсюда залила бы его целиком и спрятала бы
     * ровно то, ради чего журнал читают. Правила остаются прежними, каретку
     * рисует браузер, текст человека не трогается.
     */
  }
}

/**
 * Правила заливки Left и Right Block (З-7).
 *
 * Устроено как у каретки, и по той же причине: цвет и густота должны меняться
 * под рукой, а перерисовка панели откладывается, пока фокус стоит в поле
 * ввода. Тумблер выключен — правил нет вовсе, и слой ничего не красит.
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
    /* Украшение, и молчит по той же причине, что пересборка каретки: зовётся
       на каждую правку конфига, и журнал отсюда залило бы движением
       ползунка. Правила остаются прежними, заметка цела. */
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
      /* журнал не имеет права уронить постановку стилей: блок уже встал, и
         молчание отнимает запись об удаче, а не саму удачу */
    }
  } catch (e) {
    /* Своё событие у полос осталось: по нему в журнале ищут именно их, и
       переименовать его значило бы порвать чужой поиск. Причина отказа при
       этом называется тем же помощником, что у трёх соседок. */
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
