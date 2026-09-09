"use strict";

const { Plugin, Notice } = require("obsidian");


const __sharedUtils = require("./src/core/shared_utils.js");
globalThis.__inlineOverhaulSharedUtils = __sharedUtils;


const __devLog = require("./src/core/dev_log.js");
const __configWrite = require("./src/core/config_write.js");
const __bootstrap = require("./src/features/plugin_bootstrap.js");
const __generatedRules = require("./src/features/generated_rules.js");
const __pluginCommands = require("./src/features/plugin_commands.js");
const __editorStyles = require("./src/ui/editor/styles.js");


/** `Ctrl+A` по своим правилам (10.13.31). */
function getEnhancedSelectAllEngine() {
  return require("./src/features/enhanced_select_all_engine.js");
}

/** `Del` и `Backspace` по своим правилам (10.13.32). */
function getSmartDeleteEngine() {
  return require("./src/features/smart_delete_engine.js");
}


class InlineOverhaulPlugin extends Plugin {
  /**
   * Загрузка: порядок и состояние живут в `src/features/plugin_bootstrap.js`
   * (кусок четвёртый разбора A3). Здесь остался вызов — им Obsidian и
   * запускает плагин.
   */
  async onload() {
    return __bootstrap.load(this);
  }

  getLineTraceTxId() {
    return String(this._lineTraceTxId || "");
  }

  /**
   * Один шаг выгрузки — одно правило на все шаги (Д-4, 2026-09-09).
   *
   * Шаги выгрузки независимы, и отказ одного не должен отменять
   * остальные: иначе одна сломанная уборка оставит висеть остальные.
   *
   * **Но молчать об отказе тут нельзя.** Неснятый перехват `keydown`
   * панели TagWheel — тот самый дефект Д-2, из-за которого человек терял
   * стрелки и Enter до перезагрузки окна. Тихий отказ здесь возвращал бы
   * его обратно и невидимо (правило отказов, второй вид: сломалось
   * невидимое).
   */
  __unloadStep(what, step) {
    try {
      step();
    } catch (e) {
      console.error("[inline-overhaul][unload] шаг выгрузки " + String(what)
        + " не выполнился: " + String((e && e.message) || e || ""));
    }
  }

  onunload() {
    this.__unloadStep("dev-log", () => this.closeDevLogSession(this.getConfig()));
    /* Открытая панель TagWheel держит перехват `keydown` на всём окне, и без
       этой строки он живёт до перезагрузки окна (Д-2). */
    this.__unloadStep("tagwheel-session", () => __pluginCommands.closeTagWheelSession());
    __editorStyles.removeAll(this);
    if (this.store) this.store.unload();
  }

  async ensureGeneratedRulesNow(reason) {
    return __generatedRules.syncNow(this, reason);
  }

  listOwnCommands() {
    return __pluginCommands.ownCommandList(this);
  }

  async rebuildFromConfig() {
    return __generatedRules.rebuildFromConfig(this);
  }

  registerCommands() {
    return __pluginCommands.registerAll(this);
  }

  handleEnhancedSelectAllKeymap() {
    return getEnhancedSelectAllEngine().handleEnhancedSelectAllKeymap(this);
  }

  handleSmartDeleteKeymap() {
    return getSmartDeleteEngine().handleSmartDeleteKeymap(this);
  }

  handleSmartBackspaceKeymap() {
    const engine = getSmartDeleteEngine();
    if (typeof engine.handleSmartBackspaceKeymap !== "function") return false;
    return engine.handleSmartBackspaceKeymap(this);
  }

  getActiveEditor() {
    return this.app.workspace.getActiveViewOfType(require("obsidian").MarkdownView)?.editor ?? this.app.workspace.activeEditor?.editor;
  }

  notice(message) {
    new Notice(String(message || ""));
  }

  registerPkmCommands() {
    return __pluginCommands.registerPkm(this);
  }

  registerBinderCommands() {
    return __pluginCommands.registerBinder(this);
  }

  async runInlineToNote() {
    return __pluginCommands.runInlineToNote(this);
  }

  getConfig() {
    return this.store.getSnapshot();
  }

  createSettingTab() {
    return __bootstrap.createSettingTab(this);
  }

  /**
   * Папка плагина в vault. Нужна только для двух файлов рядом с `data.json`:
   * резервной копии версии 1 (МГ4) и нечитаемого файла (МГ6).
   */
  pluginFolderPath() {
    const configDir = String((this.app && this.app.vault && this.app.vault.configDir) || ".obsidian");
    const id = String((this.manifest && this.manifest.id) || "inline-overhaul");
    return configDir + "/plugins/" + id;
  }

  /*
   * Журнал разработчика уехал в `src/core/dev_log.js` (кусок четвёртый разбора
   * `main.js`). Здесь остались три шва, и каждый нужен по своей причине:
   * `devLogEvent` зовут слой редактора и TagWheel через сам объект плагина, а
   * два других — точка входа, выгрузка и запись патча конфига.
   */
  devLogEvent(eventName, payload, level, cfg) {
    return __devLog.event(this, eventName, payload, level, cfg);
  }

  async initializeDevLogSession(cfg) {
    return __devLog.startSession(this, cfg);
  }

  async closeDevLogSession(cfg, forceWrite) {
    return __devLog.closeSession(this, cfg, forceWrite);
  }

  setConfigPatch(patchObj, reason) {
    return __configWrite.applyPatch(this, patchObj, reason);
  }

  setActiveSettingsTab(tabId) {
    this.setConfigPatch({ ui: { activeSettingsTab: tabId } }, "settings:tab");
  }

  setVisualSubTab(subTabId) {
    this.setConfigPatch({ ui: { visualSubTab: subTabId } }, "settings:visual-subtab");
  }

  setHotkeysSubTab(subTabId) {
    this.setConfigPatch({ ui: { hotkeysSubTab: subTabId } }, "settings:hotkeys-subtab");
  }

  isFeatureEnabled(featureKey) {
    const cfg = this.getConfig();
    return !!(cfg.features && cfg.features[featureKey] && cfg.features[featureKey].enabled);
  }

}


module.exports = InlineOverhaulPlugin;
