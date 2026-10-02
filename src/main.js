"use strict";

const { Plugin, Notice, MarkdownView } = require("obsidian");


const __sharedUtils = require("./core/shared_utils.js");
const __activeEditor = require("./core/active_editor.js");
globalThis.__inlineOverhaulSharedUtils = __sharedUtils;


const __devLog = require("./core/dev_log.js");
const __configWrite = require("./core/config_write.js");
const __bootstrap = require("./features/plugin_bootstrap.js");
const __pluginCommands = require("./features/plugin_commands.js");
const __editorStyles = require("./ui/editor/styles.js");


/** `Ctrl+A` по своим правилам (10.13.31). */
function getEnhancedSelectAllEngine() {
  return require("./features/enhanced_select_all_engine.js");
}

/** `Del` и `Backspace` по своим правилам (10.13.32). */
function getSmartDeleteEngine() {
  return require("./features/smart_delete_engine.js");
}

/** `Enter` до второго разделителя по своим правилам (10.13.88). */
function getSmartEnterEngine() {
  return require("./features/smart_enter_engine.js");
}

/** Вставка из буфера по своим правилам — `З-31` и `З-32`. */
function getSmartPasteEngine() {
  return require("./features/smart_paste_engine.js");
}


class InlineOverhaulPlugin extends Plugin {
  /** Загрузка — в `src/features/plugin_bootstrap.js` (A3); здесь вызов, которым Obsidian запускает плагин. */
  async onload() {
    return __bootstrap.load(this);
  }

  getLineTraceTxId() {
    return String(this._lineTraceTxId || "");
  }

  /**
   * Один шаг выгрузки (Д-4): шаги независимы, отказ одного не отменяет остальные,
   * но не молчит — неснятый `keydown` TagWheel отнимал стрелки и Enter (Д-2).
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
    /*
     * Первым — отложенная запись настроек (CS7, `docs/dev/AUDIT_2026-09-18.md` 4.1):
     * `store.unload()` ниже снимает таймер `scheduleSave`. `saveData` асинхронна, и
     * при закрытии окна её не ждут — гарантии на выключение компьютера нет.
     */
    this.__unloadStep("config-flush", () => {
      if (!this.store) return;
      const written = this.store.flushNow();
      if (written && typeof written.catch === "function") {
        written.catch((e) => {
          console.error("[inline-overhaul][unload] отложенная запись настроек не дописалась: "
            + String((e && e.message) || e || ""));
        });
      }
    });
    this.__unloadStep("dev-log", () => this.closeDevLogSession(this.getConfig()));
    /* Открытый TagWheel держит `keydown` на всём окне до перезагрузки (Д-2). */
    this.__unloadStep("tagwheel-session", () => __pluginCommands.closeTagWheelSession());
    /* Подписка панели настроек на хранилище (`docs/dev/AUDIT_2026-09-18.md`, 4.5). */
    this.__unloadStep("settings-pane", () => __bootstrap.disposeSettingTab(this));
    __editorStyles.removeAll(this);
    if (this.store) this.store.unload();
  }

  listOwnCommands() {
    return __pluginCommands.ownCommandList(this);
  }

  /**
   * Пересобрать построенное из конфига при загрузке — зовёт восстановление копии
   * (10.13.40): команды PKM строятся из Fields (У-79), иначе хоткей из копии ляжет
   * на ещё несуществующую команду. Служебный файл правил снят (10.13.52, П-8).
   * Отказ не отменяет восстановления.
   */
  async rebuildFromConfig() {
    try {
      this.registerCommands();
    } catch (e) {
      console.error("[inline-overhaul] команды не перезавелись", e);
    }
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

  /* Без охраны (10.13.166): `false` значит «клавиша не наша» — `Backspace` молча не сработал бы. */
  handleSmartBackspaceKeymap() {
    return getSmartDeleteEngine().handleSmartBackspaceKeymap(this);
  }

  handleSmartEnterKeymap() {
    return getSmartEnterEngine().handleSmartEnterKeymap(this);
  }

  handlePlainEnterKeymap(runEnter) {
    return getSmartEnterEngine().handlePlainEnterKeymap(this, runEnter);
  }

  /* Вход — событие `editor-paste`: `Ctrl+V` до keymap не доходит. `false` — вставка обычная. */
  handleSmartPaste(evt, editor) {
    return getSmartPasteEngine().handleSmartPaste(this, evt, editor);
  }

  getActiveEditor() {
    return __activeEditor.activeEditorFrom(this.app, MarkdownView);
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

  /** Папка плагина: рядом с `data.json` — резерв версии 1 (МГ4) и нечитаемый файл (МГ6). */
  pluginFolderPath() {
    const configDir = String((this.app && this.app.vault && this.app.vault.configDir) || ".obsidian");
    const id = String((this.manifest && this.manifest.id) || "inline-overhaul");
    return configDir + "/plugins/" + id;
  }

  /* Журнал — в `src/core/dev_log.js`; `devLogEvent` зовут слой редактора и TagWheel через плагин. */
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

  /* Запись контрола панели идёт мимо `setConfigPatch`; пересборку заметок она просит здесь (H3 прогона 2026-10-02, `Ф-4`). */
  refreshEditorsFor(reason) {
    return __configWrite.refreshEditorsFor(this, reason);
  }

  /**
   * `data.json` изменён снаружи (Р-2, `docs/dev/AUDIT_2026-09-18.md` 4.2). Имя
   * обязательно: `app.js` 1.13.7 (`loadData`, `_onConfigFileChange`) по наличию
   * метода решает, следить ли за файлом. Работа — `config_write.applyExternalChange`.
   */
  async onExternalSettingsChange() {
    return __configWrite.applyExternalChange(this);
  }

  /*
   * Снятые мёртвые методы (`setActiveSettingsTab`, `setVisualSubTab`,
   * `setHotkeysSubTab`, `isFeatureEnabled`); ключи `ui.*` — Р-4
   * (`docs/dev/AUDIT_2026-09-18.md`). Сторож — `tests/regression/dead_methods_tests.js`.
   */
}


module.exports = InlineOverhaulPlugin;
