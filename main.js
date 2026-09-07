"use strict";

const { Plugin, Notice } = require("obsidian");
const cmState = require("@codemirror/state");


/*
 * Видимый текст сообщения по ключу каталога (PRD 10.13.50, третий кусок).
 *
 * Шов один на весь рантайм — `globalThis.__inlineSay`, его ставит слой
 * настроек. Пока он не поставлен (панель не собралась, старый Obsidian),
 * `say` отдаёт английское, которое стоит вторым аргументом на месте вызова:
 * человек обязан увидеть сообщение, а не ключ. Подстановку `{0}` делает тот
 * же модуль.
 */
const __say = require("./src/core/say.js").say;

/** Ключ сообщения. Строит его одна функция, и её зовут оба конца (У-82). */
function __noticeKey(area, name) {
  return "notice." + area + "." + name;
}

const __sharedUtils = require("./src/core/shared_utils.js");
globalThis.__inlineOverhaulSharedUtils = __sharedUtils;


/*
 * Слой оформления редактора уехал в два модуля (кусок второй разбора A3,
 * 2026-09-07): что об оформлении говорит конфиг — в `editor_visuals_config`,
 * что рисует CodeMirror — в `ui/editor/decorations`. Здесь остались только
 * имена, которые зовёт сам класс плагина, и объявлены они однострочно — тем
 * же способом, каким тут объявлены `isObj` и `cloneJson`.
 */

/*
 * Порядок Fields и нормализация конфига уехали в модули (кусок третий разбора
 * A3, 2026-09-07). Здесь остались имена, которые зовёт сам класс плагина.
 */
const __pkmOrderConfig = require("./src/core/pkm_order_config.js");
const __configNormalize = require("./src/core/config_normalize.js");
const __devLog = require("./src/core/dev_log.js");
const __configWrite = require("./src/core/config_write.js");
const __generatedRules = require("./src/features/generated_rules.js");
const __pluginCommands = require("./src/features/plugin_commands.js");
const __editorMount = require("./src/ui/editor/mount.js");
const __editorStyles = require("./src/ui/editor/styles.js");
const PKM_ORDER_FIELDS = __pkmOrderConfig.PKM_ORDER_FIELDS;
const normalizePkmOrder = __pkmOrderConfig.normalizePkmOrder;
const DEFAULT_CONFIG = __configNormalize.DEFAULT_CONFIG;
const migrateConfig = __configNormalize.migrateConfig;


/**
 * Идентификаторы и имена команд — один модуль на весь плагин (PRD 7.2).
 * Синхронный `require`, как у остальных: заглушка здесь означала бы команды с
 * пустыми идентификаторами, то есть плагин без команд.
 */
const __commandIds = require("./src/features/command_ids.js");
/**
 * Сборщик служебной заметки правил.
 *
 * Единственный модуль, который помнится: у него есть зависимости, и собирается
 * он один раз. Своей копии сборки здесь больше нет — форма документа осталась
 * версии 1, и две копии перекладки значений разошлись бы молча, в заметке,
 * которую человек не читает (У-32).
 */
/** `Ctrl+A` по своим правилам (10.13.31). */
function getEnhancedSelectAllEngine() {
  return require("./src/features/enhanced_select_all_engine.js");
}

/** `Del` и `Backspace` по своим правилам (10.13.32). */
function getSmartDeleteEngine() {
  return require("./src/features/smart_delete_engine.js");
}

/**
 * Хранилище конфига. Встроенной копии `ConfigStore` в `main.js` больше нет:
 * она была вторым объявлением единственного пути записи (A14, У-32).
 */
function getConfigStoreCtor() {
  return require("./src/core/config_store.js").ConfigStore;
}


function cloneJson(x) { return __sharedUtils.cloneJson(x); }
function isObj(x) { return __sharedUtils.isObj(x); }
function deepMerge(base, patch) { return __sharedUtils.deepMerge(base, patch); }


/**
 * Шов макро-рантайма PKM: по нему движки под З3 находят точку входа.
 *
 * Публикуется в `globalThis`, потому что спрашивают его файлы, которых
 * `main.js` не подключает: у них свой загрузчик — мост модулей. Пока мост не
 * снят (пункт 2 фазы 6), шов остаётся, и ставится он один раз, в `onload`.
 */
function publishPkmMacroRuntimeEntry() {
  const mod = require("./src/core/pkm_macro_runtime_entry.js");
  globalThis.__inlinePkmMacroRuntimeEntryMod = mod;
  globalThis.__inlineGetPkmMacroRuntime = (app_, normalizeOrderKeyLocal) => (
    mod.bootstrapMacroRuntime(app_, normalizeOrderKeyLocal)
  );
  return mod;
}

const SAVE_DEBOUNCE_MS = 250;
const UNDO_LIMIT = 20;

/* Путь к настройке читают и пишут по обе стороны границы слоя
   оформления, поэтому правило живёт в общем модуле (У-32). */
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }


/**
 * Метки элементов, какие завёл человек: `📅`, `⏰` и прочие.
 *
 * Берутся из конфига, а не из списка литералов: элемент — это Field, и его
 * метку человек меняет в панели.
 */
/**
 * Каретка: цвет, толщина и мерцание (10.13.33).
 *
 * **Цвет — три объявления, и это не перестраховка.** Obsidian рисует каретку
 * сам — `.cm-cursor` с `border-left`, — но при выключенном `drawSelection`
 * работает родная каретка браузера, а ею командует `caret-color`. Плюс
 * переменная темы `--caret-color`: её читают собственные правила Obsidian и
 * часть тем.
 *
 * **Толщина — это `border-left-width`, и вместе с ней двигается `margin-left`.**
 * У Obsidian стоит `borderLeft: 1.2px` и парный `marginLeft: -0.6px`, то есть
 * половина толщины: он центрирует каретку на границе символа. Поставить одну
 * толщину и не тронуть сдвиг значит уронить каретку вправо тем сильнее, чем
 * она толще (прочитано в `app.js` 1.13.7, а не выведено из типов — У-44).
 *
 * **И толщина, и мерцание бьют только по нарисованной каретке, а на строке
 * без выделения её нет.** Замечание заказчика 2026-09-06: «работает только
 * когда я выделяю текст». Причина прочитана в `app.js` 1.13.7, а не выведена.
 * В сборке Obsidian лежат **две** копии `drawSelection` CodeMirror, и слой
 * каретки у них разный:
 *
 *   - копия, отданную плагинам (`drawSelection` из `@codemirror/view`), рисует
 *     `.cm-cursor` и для пустого отрезка;
 *   - копия, на которой собран сам редактор заметки, спрашивает
 *     `range.empty ? !isMain : drawRangeCursor` — то есть **главный пустой
 *     отрезок она не рисует вовсе**. Курсор на строке без выделения — родная
 *     каретка браузера, а у неё из CSS настраивается только `caret-color`.
 *
 * Отсюда и «цвет работает, а толщина нет». Поэтому включённая форма заводит
 * **свой слой** (`io-editor-caretlayer`, см. `createCaretLayerExtension`) и гасит
 * родную каретку: `.cm-cursor` остаётся за выделением и за вторыми курсорами,
 * своя каретка — за строкой без выделения. Оба правила описывают одну вещь и
 * стоят рядом.
 *
 * **Мерцание живёт на слое, а не на самой каретке.** CodeMirror пишет
 * длительность прямо в `style` узла `.cm-cursorLayer`
 * (`animationDuration = cursorBlinkRate + "ms"`), а инлайновый стиль правилу
 * не уступает — отсюда `!important`. «Не мигает» — это снятая анимация, а не
 * нулевая длительность: ноль в CSS означает «мгновенно», а не «никогда», и
 * каретка от него замерла бы невидимой.
 *
 * Селекторы прибиты к `.markdown-source-view`: каретка в полях самой панели
 * настроек и в поиске остаётся тем, чем была (Ц4).
 */
/**
 * Своя каретка на строке без выделения (10.13.33 Ц9).
 *
 * **Зачем она вообще нужна** — разбор в комментарии к `buildCaretStyleCss`:
 * редактор заметки собран на копии `drawSelection`, которая главный **пустой**
 * отрезок не рисует, и курсор там родной браузерный. Толщину и мерцание у
 * такого не задать ничем, поэтому включённая форма рисует каретку сама.
 *
 * **Слой берётся у платформы, а не изобретается.** `layer` и
 * `RectangleMarker` есть в `@codemirror/view`, который Obsidian отдаёт
 * плагинам (проверено по карте экспортов `app.js` 1.13.7). Значит и позиция
 * каретки считается тем же кодом, что у самого CodeMirror, — со всеми его
 * поправками на масштаб, направление письма и прокрутку.
 *
 * **Рисуется ровно то, чего не рисует Obsidian:** главный отрезок и только
 * пустой. Непустой отрезок и вторые курсоры — по-прежнему его `.cm-cursor`,
 * иначе на строке стояло бы две каретки.
 *
 * Тумблер читается **на каждой отрисовке**, а не запоминается при загрузке:
 * иначе включение формы доезжало бы до заметки только после перезапуска.
 * `update` отвечает `true` в том числе на смену тумблера — без этого слой
 * не перерисуется, пока человек не тронет курсор.
 */
/**
 * Отрезок строки, который слой TagWheel **заменит своим виджетом**.
 *
 * `null` — не заменит: либо на строке нет обособления `==…==`, либо у TagWheel
 * не задана заливка и маркеры не спрятаны, и тогда слой ограничивается
 * покраской текста.
 *
 * Функция одна на два слоя, и это главное в ней. Правило «панель заменяется
 * целиком» раньше жило только внутри слоя TagWheel, а слой пузырей о нём не
 * знал: он к тому времени уже спрятал токены строки своими нулевой ширины, и
 * на один и тот же отрезок приходились две замены. На экране это выглядело
 * так, как заказчик и написал: «вся строка tagwheel пропадает, я вижу только
 * selector, но fields невидимы и не занимают места» (B2, 2026-09-02). Второе
 * объявление того же правила разошлось бы снова (У-32).
 */
class InlineOverhaulPlugin extends Plugin {
  async onload() {
    /*
     * Модули плагина. Ждать было нечего и до правки: единственным путём
     * загрузки остался `require`, а он синхронный. Пятнадцать `await`
     * описывали ту загрузку, которой уже не было (A33).
     */
    publishPkmMacroRuntimeEntry();
    /* Прогрев движков: дальше их спрашивает охрана команд, и она же
       положит их сюда, если прогрев не случился. */
    this.navRuntime = __pluginCommands.navigationRuntime();
    this.pkmRuntimeV2 = __pluginCommands.pkmRuntime();
    this._devLogWriteQueue = Promise.resolve();
    this._enhancedSelectAllCycle = null;
    this._rulesGenTimer = null;
    this._tagwheelFillStyleEl = null;
    this._lineTraceTxId = "";
    this._lineTraceSeq = 0;
    this._tagVisualExtension = null;
    this._stripExtension = null;
    this._tagwheelHeaderExtension = null;
    this._tagVisualCompartment = new cmState.Compartment();
    this._stripCompartment = new cmState.Compartment();
    this._tagwheelHeaderCompartment = new cmState.Compartment();
    /* Отметки на строке (10.13.12): подсветка обработанной и `Floating button`. */
    this._sourceMarksExtension = null;
    this._sourceMarksCompartment = new cmState.Compartment();
    this._inlineExtensionMountedEditors = typeof WeakSet !== "undefined" ? new WeakSet() : null;

    const ConfigStoreCtor = getConfigStoreCtor();
    this.store = new ConfigStoreCtor(this, {
      defaults: DEFAULT_CONFIG,
      undoLimit: UNDO_LIMIT,
      saveDebounceMs: SAVE_DEBOUNCE_MS,
      cloneJson,
      isObj,
      deepMerge,
      migrateConfig,
      Notice,
    });

    /* МГ4 и МГ6 — до первой записи формы версии 2, а не после. */
    const prepared = await __configWrite.prepareFileForV2(this);
    /* Переезд с версии 1 виден ровно здесь: копия снимается один раз, и
       именно она означает, что хоткеи человека были привязаны к старым ID. */
    this._migratedFromV1 = !!(prepared && prepared.backupSavedAs);
    await this.store.init();
    try {
      await this.initializeDevLogSession(this.getConfig());
    } catch (e) {
      console.error("[inline-overhaul][dev-mode-log:init]", e);
    }

    {
      /* Панели может не быть (старый Obsidian, не загрузившийся модуль), и
         тогда плагин работает без вкладки настроек, а не падает. */
      const tab = this.createSettingTab();
      if (tab) this.addSettingTab(tab);
    }

    this.registerCommands();
    this.noticeCommandIdsChangedOnce();
    __editorStyles.ensureTagwheelFill(this);
    __editorStyles.ensureStripLine(this);
    __editorStyles.ensureCaret(this);
    __editorMount.mountExtensions(this);
    __generatedRules.registerStoreEvents(this);

    await this.ensureGeneratedRulesNow("onload");

    const devEnabled = !!(readCfgPath(this.getConfig && this.getConfig(), "advanced.devMode.enabled") === true);
    if (devEnabled) {
      console.info("[inline-overhaul] loaded");
    }
  }

  /**
   * Одноразовое уведомление о смене ID команд (фаза 2, пункт 8; Р3).
   *
   * **Почему уведомление, а не миграция.** Хоткеи живут не в нашем конфиге, а
   * в настройках Obsidian, и привязаны к идентификатору команды. Переименование
   * их не переносит, и перенести их нам нечем: чужой файл настроек плагин не
   * правит. Значит, единственное честное — сказать об этом один раз и показать,
   * что во что превратилось.
   *
   * **Флаг живёт в `viewState`, а не в настройках** (пункт 8): это состояние
   * плагина, а не выбор человека, и контрола у него нет.
   *
   * **Показывается только тому, у кого был конфиг версии 1.** На свежей
   * установке хоткеев на старые ID быть не могло, и уведомление было бы
   * сообщением, адресованным разработчику (З8).
   *
   * **Ни `app.setting`, ни `app.hotkeyManager` здесь нет.** 7.2 разрешает
   * приватное API одним исключением — колонкой хоткея в справочнике команд, — и
   * это исключение не здесь. Поэтому путь к настройкам сказан словами, а карта
   * печатается в консоль и лежит в репозитории.
   */
  noticeCommandIdsChangedOnce() {
    try {
      if (!this._migratedFromV1) return;
      const cfg = this.getConfig();
      if (String(readCfgPath(cfg, "viewState.commandIdsNotice") || "") === "shown") return;

      const lines = ["[inline-overhaul] команды переименованы, старый ID → новый:"];
      for (const [was, now] of __commandIds.RENAMED) lines.push("  " + was + " → " + now);
      for (const [was, now] of __commandIds.RENAME_RULES) lines.push("  " + was + " → " + now);
      console.info(lines.join("\n"));

      this.notice("inlineOverhaul renamed its commands, so hotkeys you had set for them are no longer bound."
        + " Set them again in Settings, Hotkeys, searching for inlineOverhaul."
        + " The full old-to-new map is printed in the developer console and in docs/command_ids_v1_v2.md");

      this.store.patch({ viewState: { commandIdsNotice: "shown" } }, "commands:ids:notice", { undoable: false });
    } catch (e) {
      console.error("[inline-overhaul][commands:ids:notice]", e);
    }
  }

  getLineTraceTxId() {
    return String(this._lineTraceTxId || "");
  }

  onunload() {
    try { this.closeDevLogSession(this.getConfig()); } catch (_) {}
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

  /**
   * Панель настроек: одна, на схеме и декларативном API Obsidian 1.13.
   *
   * Старая панель удалена 2026-08-29 решением заказчика: паритет достигнут
   * во всём, кроме справочника команд, который ждёт имён из фазы 2. Флага
   * выбора панели больше нет: выбирать не из чего.
   *
   * Не собралась -- отдаётся `null`, и вкладки настроек просто не будет.
   * Ронять загрузку нельзя: `addSettingTab` стоит внутри `onload`, и
   * исключение оттуда унесло бы с собой команды, рантайм и подсветку строк.
   * Панель важна, но не настолько.
   */
  createSettingTab() {
    const Declarative = getDeclarativeSettingTabCtor();
    if (Declarative) {
      try {
        /*
         * Третий аргумент — мост для перенесённого редактора Fields: он ждёт
         * нормализацию Order и список заранее известных ключей, а они живут
         * здесь и из слоя настроек недостижимы (фаза 3b).
         */
        return new Declarative(this.app, this, {
          normalizePkmOrder,
          pkmOrderFields: PKM_ORDER_FIELDS,
        });
      } catch (e) {
        console.error("[inline-overhaul] declarative settings pane failed to build", e);
      }
    }
    console.error("[inline-overhaul] settings pane unavailable: needs Obsidian 1.13 or newer");
    this.notice(__say(__noticeKey("plugin", "needs-obsidian"), "inlineOverhaul settings need Obsidian 1.13 or newer"));
    return null;
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

/**
 * Новая панель настроек на декларативном API (PRD 5.3). Загружается через
 * try/catch, как и остальные модули в этом файле: если сборка идёт из
 * исходников без esbuild, файл на TypeScript не разрешится, и плагин
 * останется на старой панели вместо того, чтобы не запуститься.
 *
 * Оба пути уходят в фазе 6, когда весь этот механизм заменят статические
 * импорты (дефект A2).
 */
function getDeclarativeSettingTabCtor() {
  try {
    const mod = require("./src/ui/settings/obsidian_tab.ts");
    if (mod && typeof mod.InlineOverhaulSettings === "function") return mod.InlineOverhaulSettings;
  } catch (e) {
    console.error("[inline-overhaul] settings pane module failed to load", e && e.message);
  }
  return null;
}

module.exports = InlineOverhaulPlugin;
