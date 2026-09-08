"use strict";

/**
 * Наши расширения редактора: постановка при загрузке и пересборка на живых
 * заметках.
 *
 * **Что здесь.** Шесть расширений — перехват `Ctrl+A`, `Delete` и `Backspace`
 * одним keymap, отрисовка тегов, полос, отметок строки, вид панели TagWheel и
 * слой каретки. Четыре из них живут в компартментах: их надо уметь
 * **пересобрать**, когда человек правит настройку, и не перезагружать при этом
 * заметку.
 *
 * **Почему пересборка ходит по открытым заметкам сама.** Obsidian ставит
 * расширения плагина только тем редакторам, что откроются **после** загрузки;
 * уже открытым их надо досылать своим `dispatch`. Отсюда обход
 * `getLeavesOfType("markdown")` и `WeakSet` уже обслуженных редакторов —
 * второй `appendConfig` тому же редактору положил бы расширение дважды.
 *
 * **Компартменты и признак «уже стоит» висят на плагине**
 * (`_tagVisualCompartment`, `_inlineExtensionMountedEditors` и рядом): их
 * время жизни — время жизни плагина, и второе место для них значило бы второе
 * объявление того, кому досылать (У-32).
 *
 * **Строка курсора трогается нарочно.** После пересборки CodeMirror перерисует
 * то, что считает изменившимся; пустая правка выделения — самый дешёвый способ
 * сказать ему «перерисуй строку», и второй такой же в `requestAnimationFrame`
 * ловит редакторы, которые в этот момент ещё считали ширину.
 */

const cmState = require("@codemirror/state");
const cmView = require("@codemirror/view");
const __sharedUtils = require("../../core/shared_utils.js");
const __editorDecorations = require("./decorations.js");
const __stripDebugApi = require("../../features/strip_debug_api.js");

const createBlockFillLayerExtension = __editorDecorations.createBlockFillLayerExtension;
const createCaretLayerExtension = __editorDecorations.createCaretLayerExtension;
const createSourceMarkDecorationExtension = __editorDecorations.createSourceMarkDecorationExtension;
const createStripDecorationExtension = __editorDecorations.createStripDecorationExtension;
const createTagVisualDecorationExtension = __editorDecorations.createTagVisualDecorationExtension;
const createTagwheelHeaderDecorationExtension = __editorDecorations.createTagwheelHeaderDecorationExtension;

function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

function mountExtensions(plugin) {
  plugin.registerEditorExtension(cmState.Prec.highest(cmView.keymap.of([
    {
      key: "c-a",
      mac: "m-a",
      run: () => plugin.handleEnhancedSelectAllKeymap(),
    },
    /* Smart Delete (10.13.32). Клавиша Obsidian, перехват тем же способом,
       что и `Ctrl+A`: выключенная функция возвращает `false`, и `Del`
       работает так, как работал. */
    {
      key: "Delete",
      run: () => plugin.handleSmartDeleteKeymap(),
    },
    /* Зеркальный случай, свой тумблер (10.13.32 Д9). */
    {
      key: "Backspace",
      run: () => plugin.handleSmartBackspaceKeymap(),
    },
  ])));
  plugin._tagwheelHeaderExtension = createTagwheelHeaderDecorationExtension(plugin);
  plugin._tagVisualExtension = createTagVisualDecorationExtension(plugin);
  plugin._stripExtension = createStripDecorationExtension(plugin);
  plugin._sourceMarksExtension = createSourceMarkDecorationExtension(plugin);
  plugin.registerEditorExtension(plugin._tagwheelHeaderCompartment.of(plugin._tagwheelHeaderExtension));
  plugin.registerEditorExtension(plugin._sourceMarksCompartment.of(plugin._sourceMarksExtension));
  plugin.registerEditorExtension(plugin._tagVisualCompartment.of(cmState.Prec.highest(plugin._tagVisualExtension)));
  plugin.registerEditorExtension(plugin._stripCompartment.of(plugin._stripExtension));
  /* Своя каретка (10.13.33 Ц9). Компартмента у неё нет и не нужно: слой
     спрашивает тумблер на каждой отрисовке, а видимостью правит блок стилей,
     который переписывается сразу за правкой настройки. */
  plugin.registerEditorExtension(createCaretLayerExtension(plugin));
  /* Заливка Left и Right Block (З-7). Компартмента у неё нет и не нужно по
     той же причине, что у каретки: слой спрашивает тумблер на каждой
     отрисовке, а вид правит блок стилей, который переписывается сразу за
     правкой настройки. */
  plugin.registerEditorExtension(createBlockFillLayerExtension(plugin));
  __stripDebugApi.publish(plugin);
}

function refreshOpenEditors(plugin) {
  const cfg = plugin.getConfig();
  const debugLine = !!(readCfgPath(cfg, "advanced.devMode.enabled") === true && readCfgPath(cfg, "advanced.devMode.traceTagVisualLine") === true);
  const leaves = plugin.app && plugin.app.workspace && typeof plugin.app.workspace.getLeavesOfType === "function"
    ? plugin.app.workspace.getLeavesOfType("markdown")
    : [];
  if (debugLine) {
    try {
      plugin.devLogEvent("strip.refresh.dispatch", {
        traceTxId: plugin.getLineTraceTxId(),
        reason: "config-patch",
        leaves: Array.isArray(leaves) ? leaves.length : 0,
        stripFieldId: String(readCfgPath(cfg, "visual.tagBars.fieldId") || "").trim(),
        stripActive: readCfgPath(cfg, "visual.tagBars.active") === true,
      }, "trace", cfg);
    } catch (_) {}
  }
  for (const leaf of leaves) {
    const view = leaf && leaf.view ? leaf.view : null;
    const editor = view && view.editor ? view.editor : null;
    const cm = editor && editor.cm ? editor.cm : null;
    if (!cm || typeof cm.dispatch !== "function") continue;
    try {
      const shouldMount = plugin._inlineExtensionMountedEditors instanceof WeakSet
        ? !plugin._inlineExtensionMountedEditors.has(cm)
        : false;
      if (shouldMount && plugin._tagVisualExtension && plugin._stripExtension && plugin._tagwheelHeaderExtension) {
        cm.dispatch({ effects: cmState.StateEffect.appendConfig.of([
          plugin._tagwheelHeaderCompartment.of(plugin._tagwheelHeaderExtension),
          plugin._tagVisualCompartment.of(cmState.Prec.highest(plugin._tagVisualExtension)),
          plugin._stripCompartment.of(plugin._stripExtension),
          plugin._sourceMarksCompartment.of(plugin._sourceMarksExtension),
        ]) });
        if (plugin._inlineExtensionMountedEditors instanceof WeakSet) plugin._inlineExtensionMountedEditors.add(cm);
      } else if (plugin._tagVisualExtension && plugin._stripExtension && plugin._tagwheelHeaderExtension) {
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
          } catch (_) {}
        });
      }
    } catch (_) {}
  }
}

module.exports = {
  mountExtensions,
  refreshOpenEditors,
};
