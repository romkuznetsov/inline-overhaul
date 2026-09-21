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
    /*
     * Первым шагом — отложенная запись настроек (CS7, разбор
     * `docs/dev/AUDIT_2026-09-18.md` 4.1). `ConfigStore.scheduleSave` откладывает
     * её на четверть секунды, а `store.unload()` ниже тот же таймер снимает:
     * без этого шага правка, сделанная перед выключением плагина, пропадала
     * молча, и сказать об этом человеку было нечем.
     *
     * **Записывается «как получится», и это названо нарочно:** `saveData`
     * асинхронна, и при закрытии окна платформа её не ждёт. Для выключения,
     * обновления и перезагрузки плагина шаг работает; гарантией на выключение
     * компьютера он не является.
     *
     * Отказ здесь молчать не имеет права: это настройки человека, и второй вид
     * отказа — «сломалось невидимое» — ровно про этот случай.
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
    /* Открытая панель TagWheel держит перехват `keydown` на всём окне, и без
       этой строки он живёт до перезагрузки окна (Д-2). */
    this.__unloadStep("tagwheel-session", () => __pluginCommands.closeTagWheelSession());
    /* Подписка панели настроек на хранилище: договор был написан и не
       исполнялся (`docs/dev/AUDIT_2026-09-18.md`, 4.5). */
    this.__unloadStep("settings-pane", () => __bootstrap.disposeSettingTab(this));
    __editorStyles.removeAll(this);
    if (this.store) this.store.unload();
  }

  listOwnCommands() {
    return __pluginCommands.ownCommandList(this);
  }

  /**
   * Заново собрать то, что плагин строит из конфига один раз — при загрузке.
   *
   * Зовётся одним местом — восстановлением копии настроек (10.13.40), потому
   * что только там конфиг меняется целиком и разом. Дело осталось одно: набор
   * команд PKM строится из Fields конфига (У-79), и без этого вызова новый
   * набор Fields получает команды только после перезапуска, а хоткей из копии
   * ложится на команду, которой ещё нет. Второе дело — место служебного файла
   * правил — ушло вместе с самим файлом (PRD 10.13.52, П-8, шаг четвёртый).
   *
   * Отказ не отменяет восстановления: настройки уже записаны.
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

  /*
   * Тот же шов, что у двух соседей выше, и охраны у него быть не должно
   * (10.13.166): `false` отсюда значит «клавиша не наша», то есть
   * `Backspace` просто не срабатывал бы по своим правилам и молча. Модуль
   * приезжает литеральным `require`, и запасного пути у загрузки нет.
   */
  handleSmartBackspaceKeymap() {
    return getSmartDeleteEngine().handleSmartBackspaceKeymap(this);
  }

  handleSmartEnterKeymap() {
    return getSmartEnterEngine().handleSmartEnterKeymap(this);
  }

  /*
   * Тот же шов, но вход у него не клавиша, а событие платформы
   * (`editor-paste`): `Ctrl+V` до keymap не доходит, вставку Obsidian отдаёт
   * своим событием. `false` значит «вставка обычная».
   */
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

  /**
   * `data.json` изменён снаружи — синхронизацией, вторым компьютером, правкой
   * руками (Р-2, разбор `docs/dev/AUDIT_2026-09-18.md` 4.2).
   *
   * **Метод обязан существовать именно с этим именем.** Платформа не просто
   * зовёт его, а по его наличию решает, следить ли за файлом вовсе: в `app.js`
   * 1.13.7 и `loadData`, и `_onConfigFileChange` первым же действием
   * спрашивают `this.onExternalSettingsChange` и без него не делают ничего.
   * Пока метода не было, плагин затирал принесённое ближайшей отложенной
   * записью.
   *
   * Работа — в `config_write.applyExternalChange`; здесь шов, как и у
   * остальных методов точки входа.
   */
  async onExternalSettingsChange() {
    return __configWrite.applyExternalChange(this);
  }

  /*
   * Здесь стояли четыре метода, которых не звал никто, — три записи открытой
   * вкладки настроек (`setActiveSettingsTab`, `setVisualSubTab`,
   * `setHotkeysSubTab`) и `isFeatureEnabled`. Первые три — остаток старой
   * панели, снятой 2026-08-29: новая держит открытую вкладку в себе и в конфиг
   * её не пишет. Сами ключи `ui.*` в конфиге остались — их нормализуют и
   * переносят, и не читает никто; что с ними делать, решает заказчик
   * (`docs/dev/AUDIT_2026-09-18.md`, Р-4). Возвращаться этому классу не даёт
   * `tests/regression/dead_methods_tests.js`.
   */
}


module.exports = InlineOverhaulPlugin;
