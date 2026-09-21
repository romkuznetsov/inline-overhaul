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
 * **Почему пересборка ходит по открытым заметкам сама.** Расширения ставит
 * платформа, а вот **пересобрать** их после правки настройки она не обязана:
 * компартмент — наш, и `reconfigure` зовём мы. Отсюда обход
 * `getLeavesOfType("markdown")`. Досылать расширения при этом не надо и
 * нельзя: разбор — в теле `refreshOpenEditors`.
 *
 * **Компартменты висят на плагине** (`_tagVisualCompartment` и рядом): их
 * время жизни — время жизни плагина, и второе место для них значило бы второе
 * объявление того, кого пересобирать (У-32).
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
const __panelMask = require("./panel_mask.js");

const createBlockFillLayerExtension = __editorDecorations.createBlockFillLayerExtension;
const createCaretLayerExtension = __editorDecorations.createCaretLayerExtension;
const createJumpFlashExtension = __editorDecorations.createJumpFlashExtension;
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
    /*
     * Smart Enter (10.13.88). Тот же уклад: выключенная функция возвращает
     * `false`, и `Enter` работает так, как работал. Отдаётся он платформе и
     * во всех случаях, где строка не наша, — у строки без разделителей
     * плагина слота текста нет вовсе, и движок отказывается первым же
     * вопросом.
     */
    {
      key: "Enter",
      run: () => plugin.handleSmartEnterKeymap(),
    },
  ])));
  /*
   * Smart paste (`З-31`, `З-32`). Единственный из перехватов, который стоит
   * **не** в keymap: `Ctrl+V` до него не доходит вовсе — вставку Obsidian
   * отдаёт событием `editor-paste`, и оно же несёт содержимое буфера, до
   * которого из keymap не дотянуться.
   *
   * Подписка снимается вместе с плагином: `registerEvent` — шов платформы,
   * и своя уборка тут была бы вторым объявлением того же правила.
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
  /* Своя каретка (10.13.33 Ц9). Компартмента у неё нет и не нужно: слой
     спрашивает тумблер на каждой отрисовке, а видимостью правит блок стилей,
     который переписывается сразу за правкой настройки. */
  plugin.registerEditorExtension(createCaretLayerExtension(plugin));
  /* Подсветка места, куда прыгнул курсор (Н5). Компартмента нет и не
     нужно: слой ничего не рисует, пока его не позовёт прыжок, а настройки
     читаются в момент прыжка, а не при загрузке. */
  plugin.registerEditorExtension(createJumpFlashExtension(plugin));
  /* Заливка Left и Right Block (З-7). Компартмента у неё нет и не нужно по
     той же причине, что у каретки: слой спрашивает тумблер на каждой
     отрисовке, а вид правит блок стилей, который переписывается сразу за
     правкой настройки. */
  plugin.registerEditorExtension(createBlockFillLayerExtension(plugin));
  /*
   * Маска панели TagWheel: что её полоса закрывает собой, прячется
   * оформлением, а не удаляется из заметки (решение заказчика 2026-09-13,
   * разбор — `src/core/panel_line_write.js`). Компартмента у неё нет и не
   * нужно: отрезки приезжают ступенью состояния, а не настройкой.
   */
  plugin.registerEditorExtension(__panelMask.createPanelMaskExtension());
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
       * **Досылать расширения редактору не надо: их ставит сама платформа.**
       *
       * Здесь стояла ветка «этот редактор мы ещё не обслуживали — дошлём
       * `appendConfig`», и написана она была по предположению, что Obsidian
       * ставит расширения плагина только тем редакторам, которые откроются
       * **после** загрузки. Предположение неверно, и спрошено это у её кода
       * (У-44): `registerEditorExtension` кладёт расширение в
       * `workspace.editorExtensions` и зовёт `updateOptions()`, а тот обходит
       * **все** листы и пересобирает свой компартмент
       * (`NJ.reconfigure(getDynamicExtensions())`, `app.js` 1.13.7); список
       * плагинных расширений входит в `getDynamicExtensions` целиком. Редактор,
       * созданный позже, берёт его там же при своей сборке.
       *
       * Цена ошибки была не в лишней работе. Наши компартменты лежат внутри
       * компартмента платформы, и второй `Compartment.of` того же компартмента
       * — это `RangeError: Duplicate use of compartment in extensions`:
       * `dispatch` падал, до `reconfigure` и до толчка к перерисовке дело не
       * доходило **ни разу**, а в журнал на каждый патч настроек летела
       * ошибка по строке на каждую открытую заметку.
       *
       * `reconfigure` на компартменте, которого в сборке нет, — пустая
       * операция, поэтому запасной ветки тут не нужно.
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
             * Уборка: толчок к пересчёту прилетает кадром позже, и за этот
             * кадр человек успевает закрыть заметку. Отказ здесь значит
             * «редактора больше нет», а цель — перерисовать его — достигнута
             * тем, что рисовать нечего. Отчёт тут шёл бы на каждое закрытие
             * заметки.
             */
          }
        });
      }
    } catch (e) {
      /*
       * **Самый дорогой отказ в этом файле, и до 2026-09-09 он молчал**
       * (Д-4). Здесь расширения оформления встают в редактор или
       * пересобираются в нём; отказ значит, что именно эта заметка не
       * красится вовсе — ни пузырей, ни полос, ни подложки. Человек
       * придёт со словами «перестало красить», и журнал — единственное,
       * из чего можно будет узнать, почему (правило отказов, второй вид).
       *
       * Обход при этом продолжается: одна закрывшаяся заметка не должна
       * лишать оформления все остальные.
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
