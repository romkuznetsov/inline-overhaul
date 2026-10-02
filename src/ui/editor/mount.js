"use strict";

/**
 * Наши расширения редактора: постановка при загрузке и пересборка на живых
 * заметках. Шесть расширений (keymap `Ctrl+A`/`Delete`/`Backspace`, теги,
 * полосы, отметки строки, вид панели TagWheel, каретка); четыре — в
 * компартментах, чтобы пересобрать без перезагрузки заметки. `reconfigure`
 * зовём мы — отсюда обход `getLeavesOfType("markdown")`. Компартменты висят
 * на плагине (У-32). Пустая правка выделения (и вторая в
 * `requestAnimationFrame`) заставляет CodeMirror перерисовать строку.
 */

const cmState = require("@codemirror/state");
const cmView = require("@codemirror/view");
const __sharedUtils = require("../../core/shared_utils.js");
const __editorDecorations = require("./decorations.js");
const __stripDebugApi = require("../../features/strip_debug_api.js");
const __panelMask = require("./panel_mask.js");
const __doneMarker = require("../../features/checkbox_done_marker.js");

const createBlockFillLayerExtension = __editorDecorations.createBlockFillLayerExtension;
const createCaretLayerExtension = __editorDecorations.createCaretLayerExtension;
const createJumpFlashExtension = __editorDecorations.createJumpFlashExtension;
const createSourceMarkDecorationExtension = __editorDecorations.createSourceMarkDecorationExtension;
const createStripDecorationExtension = __editorDecorations.createStripDecorationExtension;
const createTagVisualDecorationExtension = __editorDecorations.createTagVisualDecorationExtension;
const createTagwheelHeaderDecorationExtension = __editorDecorations.createTagwheelHeaderDecorationExtension;

function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

/* Нажатие `Enter` без модификаторов — всё, что `runScopeHandlers` у него спрашивает. */
const PLAIN_ENTER = {
  type: "keydown", key: "Enter", keyCode: 13,
  shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
  preventDefault() { /* уборка: настоящее нажатие гасит внешний keymap */ },
  stopPropagation() { /* уборка: то же */ },
};

function mountExtensions(plugin) {
  plugin.registerEditorExtension(cmState.Prec.highest(cmView.keymap.of([
    {
      key: "c-a",
      mac: "m-a",
      run: () => plugin.handleEnhancedSelectAllKeymap(),
    },
    /* Smart Delete (10.13.32): выключенная функция возвращает `false`, и `Del` работает как обычно. */
    {
      key: "Delete",
      run: () => plugin.handleSmartDeleteKeymap(),
    },
    /* Зеркальный случай, свой тумблер (10.13.32 Д9). */
    {
      key: "Backspace",
      run: () => plugin.handleSmartBackspaceKeymap(),
    },
    /*
     * Smart Enter (10.13.88): выключен или строка не наша — `false`, `Enter`
     * уходит платформе.
     */
    {
      key: "Enter",
      run: () => plugin.handleSmartEnterKeymap(),
    },
    /*
     * Shift+Enter как обычный `Enter` (тумблер `Shift+Enter as usual Enter`):
     * зовутся обработчики платформы тем же keymap, Smart Enter отступает.
     */
    {
      key: "Shift-Enter",
      run: (view) => plugin.handlePlainEnterKeymap(() => cmView.runScopeHandlers(view, PLAIN_ENTER, "editor")),
    },
  ])));
  /*
   * Smart paste (`З-31`, `З-32`) — не keymap: `Ctrl+V` Obsidian отдаёт событием
   * `editor-paste` с буфером. Уборка — `registerEvent`.
   */
  if (plugin.app && plugin.app.workspace && typeof plugin.registerEvent === "function") {
    plugin.registerEvent(plugin.app.workspace.on("editor-paste", (evt, editor) => {
      plugin.handleSmartPaste(evt, editor);
    }));
  }
  plugin._tagwheelHeaderExtension = createTagwheelHeaderDecorationExtension(plugin);
  plugin._tagVisualExtension = createTagVisualDecorationExtension(plugin);
  plugin._stripExtension = createStripDecorationExtension(plugin);
  plugin._sourceMarksExtension = createSourceMarkDecorationExtension(plugin);
  plugin.registerEditorExtension(plugin._tagwheelHeaderCompartment.of(plugin._tagwheelHeaderExtension));
  plugin.registerEditorExtension(plugin._sourceMarksCompartment.of(plugin._sourceMarksExtension));
  plugin.registerEditorExtension(plugin._tagVisualCompartment.of(cmState.Prec.highest(plugin._tagVisualExtension)));
  plugin.registerEditorExtension(plugin._stripCompartment.of(plugin._stripExtension));
  /* Своя каретка (10.13.33 Ц9): без компартмента — тумблер читается на каждой отрисовке, вид правит блок стилей. */
  plugin.registerEditorExtension(createCaretLayerExtension(plugin));
  /* Подсветка прыжка курсора (Н5): без компартмента — настройки читаются в момент прыжка. */
  plugin.registerEditorExtension(createJumpFlashExtension(plugin));
  /* Подсветка перенесённых строк (`В-256`): без компартмента — рисует только по метке переноса. */
  plugin.registerEditorExtension(__editorDecorations.createMovedLinesExtension(plugin));
  /* Заливка Left и Right Block (З-7): без компартмента, как у каретки. */
  plugin.registerEditorExtension(createBlockFillLayerExtension(plugin));
  /*
   * Маска панели TagWheel: закрытое полосой прячется оформлением, не удаляется
   * (2026-09-13, `src/core/panel_line_write.js`). Отрезки — ступенью состояния.
   */
  plugin.registerEditorExtension(__panelMask.createPanelMaskExtension());
  /* Метка отмеченной строки (`done-marker`): настройка читается на каждом изменении. */
  plugin.registerEditorExtension(__doneMarker.createDoneMarkerExtension(plugin));
  __stripDebugApi.publish(plugin);
}

function refreshOpenEditors(plugin) {
  const cfg = plugin.getConfig();
  const debugLine = !!(readCfgPath(cfg, "advanced.devMode.enabled") === true && readCfgPath(cfg, "advanced.devMode.traceTagVisualLine") === true);
  const leaves = plugin.app && plugin.app.workspace && typeof plugin.app.workspace.getLeavesOfType === "function"
    ? plugin.app.workspace.getLeavesOfType("markdown")
    : [];
  if (debugLine) {
    __editorDecorations.traceEvent(plugin, cfg, "strip.refresh.dispatch", {
        traceTxId: plugin.getLineTraceTxId(),
        reason: "config-patch",
        leaves: Array.isArray(leaves) ? leaves.length : 0,
        stripFieldId: String(readCfgPath(cfg, "visual.tagBars.fieldId") || "").trim(),
      stripActive: readCfgPath(cfg, "visual.tagBars.active") === true,
    });
  }
  for (const leaf of leaves) {
    const view = leaf && leaf.view ? leaf.view : null;
    const editor = view && view.editor ? view.editor : null;
    const cm = editor && editor.cm ? editor.cm : null;
    if (!cm || typeof cm.dispatch !== "function") continue;
    try {
      /*
       * Досылать расширения не надо (У-44): `registerEditorExtension` кладёт их в
       * `workspace.editorExtensions`, `updateOptions()` пересобирает все листы
       * (`NJ.reconfigure(getDynamicExtensions())`, `app.js` 1.13.7). Второй
       * `Compartment.of` даёт `RangeError: Duplicate use of compartment in extensions`.
       * `reconfigure` отсутствующего компартмента — пустая операция.
       */
      if (plugin._tagVisualExtension && plugin._stripExtension && plugin._tagwheelHeaderExtension) {
        cm.dispatch({ effects: [
          plugin._tagwheelHeaderCompartment.reconfigure(plugin._tagwheelHeaderExtension),
          plugin._tagVisualCompartment.reconfigure(cmState.Prec.highest(plugin._tagVisualExtension)),
          plugin._stripCompartment.reconfigure(plugin._stripExtension),
          plugin._sourceMarksCompartment.reconfigure(plugin._sourceMarksExtension),
        ] });
      }
      const head = cm.state && cm.state.selection && cm.state.selection.main
        ? cm.state.selection.main.head
        : 0;
      cm.dispatch({ effects: cmState.StateEffect.appendConfig.of([]), selection: { anchor: head, head } });
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
          try {
            const h2 = cm.state && cm.state.selection && cm.state.selection.main
              ? cm.state.selection.main.head
              : head;
            cm.dispatch({ effects: cmState.StateEffect.appendConfig.of([]), selection: { anchor: h2, head: h2 } });
          } catch (_) {
            /*
             * Уборка: толчок прилетает кадром позже, заметку успели закрыть — рисовать
             * нечего. Отчёт шёл бы на каждое закрытие.
             */
          }
        });
      }
    } catch (e) {
      /*
       * Самый дорогой отказ (Д-4): заметка не красится вовсе — журнал единственный
       * след. Обход продолжается для остальных заметок.
       */
      console.error("[inline-overhaul][editor-mount] расширения оформления не встали"
        + " в редактор: " + String((e && e.message) || e || ""));
    }
  }
}

module.exports = {
  mountExtensions,
  refreshOpenEditors,
};
