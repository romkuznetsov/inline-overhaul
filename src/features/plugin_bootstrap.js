"use strict";

/**
 * Загрузка плагина: что и в каком порядке случается в `onload`.
 *
 * **Почему это модуль, а не тело метода** (кусок четвёртый разбора `main.js`,
 * 2026-09-07). Порядок здесь — не список дел, а требование: сначала
 * подготовка файла конфига (МГ4 и МГ6 — про то, что лежало на диске **до**
 * переезда), потом хранилище, потом всё остальное. Пока это лежало в точке
 * входа, порядок не видел линтер: `main.js` стоит в `ignores`, и про имена вне
 * области видимости в нём не знал никто (PRD 12).
 *
 * **Состояние плагина заводится здесь же** — компартменты расширений, таймеры,
 * признак переезда с версии 1, очередь записи журнала. Это не украшение: у
 * каждого поля есть тот, кто его читает, и заводить их по месту чтения значило
 * бы завести их дважды (У-32).
 *
 * **Ошибка загрузки журнала разработчика не роняет плагин**, а ошибка сборки
 * панели настроек — оставляет плагин без вкладки: команды, движки и оформление
 * важнее вкладки.
 */

const { Notice } = require("obsidian");
const cmState = require("@codemirror/state");

const __commandIds = require("./command_ids.js");
const __configNormalize = require("../core/config_normalize.js");
const __configWrite = require("../core/config_write.js");
const __devLog = require("../core/dev_log.js");
const __editorMount = require("../ui/editor/mount.js");
const __editorStyles = require("../ui/editor/styles.js");
const __generatedRules = require("./generated_rules.js");
const __pkmOrderConfig = require("../core/pkm_order_config.js");
const __pluginCommands = require("./plugin_commands.js");
const __sharedUtils = require("../core/shared_utils.js");
const __say = require("../core/say.js").say;

const DEFAULT_CONFIG = __configNormalize.DEFAULT_CONFIG;
const PKM_ORDER_FIELDS = __pkmOrderConfig.PKM_ORDER_FIELDS;
const migrateConfig = __configNormalize.migrateConfig;
const normalizePkmOrder = __pkmOrderConfig.normalizePkmOrder;

function cloneJson(x) { return __sharedUtils.cloneJson(x); }
function deepMerge(base, patch) { return __sharedUtils.deepMerge(base, patch); }
function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

/** Ключ сообщения. Строит его одна функция, и её зовут оба конца (У-82). */
function __noticeKey(area, name) {
  return "notice." + area + "." + name;
}

/* Хранилище настроек: единственный путь записи, и через него же идёт каждый
   патч из панели (CS10). */
const SAVE_DEBOUNCE_MS = 250;
const UNDO_LIMIT = 20;

function getConfigStoreCtor() {
  return require("../core/config_store.js").ConfigStore;
}

/**
 * Прослойка макро-рантайма публикуется в `globalThis`: это шов, которым
 * движки `pkm_v2/**` берут её, не зная о путях. Ставится один раз, при
 * загрузке.
 */
function publishPkmMacroRuntimeEntry() {
  const mod = require("../core/pkm_macro_runtime_entry.js");
  globalThis.__inlinePkmMacroRuntimeEntryMod = mod;
  globalThis.__inlineGetPkmMacroRuntime = (app_, normalizeOrderKeyLocal) => (
    mod.bootstrapMacroRuntime(app_, normalizeOrderKeyLocal)
  );
  return mod;
}

/**
 * Новая панель настроек на декларативном API (PRD 5.3). Загружается через
 * try/catch: если сборка идёт из исходников без esbuild, файл на TypeScript
 * не разрешится, и плагин останется без вкладки настроек вместо того, чтобы
 * не запуститься.
 */
function getDeclarativeSettingTabCtor() {
  try {
    const mod = require("../ui/settings/obsidian_tab.ts");
    if (mod && typeof mod.InlineOverhaulSettings === "function") return mod.InlineOverhaulSettings;
  } catch (e) {
    console.error("[inline-overhaul] settings pane module failed to load", e && e.message);
  }
  return null;
}

async function load(plugin) {
  /*
   * Модули плагина. Ждать было нечего и до правки: единственным путём
   * загрузки остался `require`, а он синхронный. Пятнадцать `await`
   * описывали ту загрузку, которой уже не было (A33).
   */
  publishPkmMacroRuntimeEntry();
  /* Прогрев движков: дальше их спрашивает охрана команд, и она же
     положит их сюда, если прогрев не случился. */
  plugin.navRuntime = __pluginCommands.navigationRuntime();
  plugin.pkmRuntimeV2 = __pluginCommands.pkmRuntime();
  plugin._devLogWriteQueue = Promise.resolve();
  plugin._enhancedSelectAllCycle = null;
  plugin._rulesGenTimer = null;
  plugin._tagwheelFillStyleEl = null;
  plugin._lineTraceTxId = "";
  plugin._lineTraceSeq = 0;
  plugin._tagVisualExtension = null;
  plugin._stripExtension = null;
  plugin._tagwheelHeaderExtension = null;
  plugin._tagVisualCompartment = new cmState.Compartment();
  plugin._stripCompartment = new cmState.Compartment();
  plugin._tagwheelHeaderCompartment = new cmState.Compartment();
  /* Отметки на строке (10.13.12): подсветка обработанной и `Floating button`. */
  plugin._sourceMarksExtension = null;
  plugin._sourceMarksCompartment = new cmState.Compartment();
  plugin._inlineExtensionMountedEditors = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  const ConfigStoreCtor = getConfigStoreCtor();
  plugin.store = new ConfigStoreCtor(plugin, {
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
  const prepared = await __configWrite.prepareFileForV2(plugin);
  /* Переезд с версии 1 виден ровно здесь: копия снимается один раз, и
     именно она означает, что хоткеи человека были привязаны к старым ID. */
  plugin._migratedFromV1 = !!(prepared && prepared.backupSavedAs);
  await plugin.store.init();
  try {
    await plugin.initializeDevLogSession(plugin.getConfig());
  } catch (e) {
    console.error("[inline-overhaul][dev-mode-log:init]", e);
  }

  {
    /* Панели может не быть (старый Obsidian, не загрузившийся модуль), и
       тогда плагин работает без вкладки настроек, а не падает. */
    const tab = createSettingTab(plugin);
    if (tab) plugin.addSettingTab(tab);
  }

  plugin.registerCommands();
  noticeCommandIdsChanged(plugin);
  __editorStyles.ensureTagwheelFill(plugin);
  __editorStyles.ensureStripLine(plugin);
  __editorStyles.ensureCaret(plugin);
  __editorMount.mountExtensions(plugin);
  __generatedRules.registerStoreEvents(plugin);

  await plugin.ensureGeneratedRulesNow("onload");

  const devEnabled = !!(readCfgPath(plugin.getConfig && plugin.getConfig(), "advanced.devMode.enabled") === true);
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
function noticeCommandIdsChanged(plugin) {
  try {
    if (!plugin._migratedFromV1) return;
    const cfg = plugin.getConfig();
    if (String(readCfgPath(cfg, "viewState.commandIdsNotice") || "") === "shown") return;

    const lines = ["[inline-overhaul] команды переименованы, старый ID → новый:"];
    for (const [was, now] of __commandIds.RENAMED) lines.push("  " + was + " → " + now);
    for (const [was, now] of __commandIds.RENAME_RULES) lines.push("  " + was + " → " + now);
    console.info(lines.join("\n"));

    plugin.notice("inlineOverhaul renamed its commands, so hotkeys you had set for them are no longer bound."
      + " Set them again in Settings, Hotkeys, searching for inlineOverhaul."
      + " The full old-to-new map is printed in the developer console and in docs/command_ids_v1_v2.md");

    plugin.store.patch({ viewState: { commandIdsNotice: "shown" } }, "commands:ids:notice", { undoable: false });
  } catch (e) {
    console.error("[inline-overhaul][commands:ids:notice]", e);
  }
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
function createSettingTab(plugin) {
  const Declarative = getDeclarativeSettingTabCtor();
  if (Declarative) {
    try {
      /*
       * Третий аргумент — мост для перенесённого редактора Fields: он ждёт
       * нормализацию Order и список заранее известных ключей, а они живут
       * здесь и из слоя настроек недостижимы (фаза 3b).
       */
      return new Declarative(plugin.app, plugin, {
        normalizePkmOrder,
        pkmOrderFields: PKM_ORDER_FIELDS,
      });
    } catch (e) {
      console.error("[inline-overhaul] declarative settings pane failed to build", e);
    }
  }
  console.error("[inline-overhaul] settings pane unavailable: needs Obsidian 1.13 or newer");
  plugin.notice(__say(__noticeKey("plugin", "needs-obsidian"), "inlineOverhaul settings need Obsidian 1.13 or newer"));
  return null;
}

module.exports = {
  load,
  noticeCommandIdsChanged,
  createSettingTab,
};
