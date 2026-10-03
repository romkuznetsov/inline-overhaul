"use strict";

/**
 * Загрузка плагина: что и в каком порядке случается в `onload` (вынесено из
 * `main.js` 2026-09-07, PRD 12). Порядок — требование: сначала подготовка
 * файла конфига (МГ4, МГ6), потом хранилище, потом остальное.
 *
 * Состояние плагина заводится здесь же, один раз (У-32). Ошибка журнала
 * разработчика не роняет плагин; не собралась панель — плагин без вкладки.
 */

const { Modal, Notice, Component, MarkdownRenderer } = require("obsidian");
const cmState = require("@codemirror/state");

const __commandIds = require("./command_ids.js");
const __configNormalize = require("../core/config_normalize.js");
const __configWrite = require("../core/config_write.js");
const __devLog = require("../core/dev_log.js");
const __editorMount = require("../ui/editor/mount.js");
const __editorStyles = require("../ui/editor/styles.js");
const __pkmOrderConfig = require("../core/pkm_order_config.js");
const __pluginCommands = require("./plugin_commands.js");
const __linkValueRename = require("./link_value_rename.js");
const __releaseNotes = require("./release_notes.js");
const __settingsAutosave = require("./settings_autosave.js");
const __sharedUtils = require("../core/shared_utils.js");
/* Помощники общего дома — без обёрток-передатчиков (У-9 ревизии 09-26). */
const { cloneJson } = __sharedUtils;
const deepMerge = __sharedUtils.deepMerge;
const isObj = __sharedUtils.isObj;
const readCfgPath = __sharedUtils.readCfgPath;
const __sayModule = require("../core/say.js");
const __say = __sayModule.say;
/* Ключ сообщения — общий модуль (У-82). */
const __noticeKey = __sayModule.noticeKey;

const DEFAULT_CONFIG = __configNormalize.DEFAULT_CONFIG;
const PKM_ORDER_FIELDS = __pkmOrderConfig.PKM_ORDER_FIELDS;
const migrateConfig = __configNormalize.migrateConfig;
const normalizePkmOrder = __pkmOrderConfig.normalizePkmOrder;


/**
 * Команды PKM и Binder идут за настройками (BUGHUNT R3: K1, S6, S7; Д-1):
 * каждая запись в хранилище сверяет набор, заводит и снимает только
 * изменившееся; хоткей держится за id. Панель будит себя сама
 * (`SettingsPane.wakeFor`, У-1).
 */
function followConfigWithCommands(plugin) {
  const unsubscribe = plugin.store.subscribe((payload) => {
    try {
      plugin.registerPkmCommands();
      plugin.registerBinderCommands();
    } catch (e) {
      console.error("[inline-overhaul] commands refresh", e);
    }
    /*
     * Запись не из панели — панель пересобирает определения (BUGHUNT S19, S20):
     * контролы платформы берут значение при отрисовке. Свои записи панели
     * будят блоки сами (`wakeFor`): пересборка сбила бы фокус поля.
     */
    const reason = String(payload && payload.reason || "");
    const tab = plugin._settingTab;
    if (tab && typeof tab.update === "function" && (reason === "command:undo" || reason === "external" || /^toggle:/.test(reason))) {
      try {
        /*
         * Строку с фокусом платформа при пересборке пропускает (`app.js` 1.13.7:
         * `a.contains(l) && a !== l`, `l = listEl.doc.activeElement`): `Undo`
         * оставлял тумблер отменённым (BUGHUNT 2026-09-30, D22). Фокус снимается.
         */
        const box = tab.containerEl;
        const doc = box && (box.doc || box.ownerDocument);
        const active = doc ? doc.activeElement : null;
        if (active && box.contains(active) && typeof active.blur === "function") active.blur();
        tab.update();
      } catch (e) { console.error("[inline-overhaul] settings refresh", e); }
    }
  });
  plugin.register(unsubscribe);
}

/* Хранилище настроек — единственный путь записи, и патчей панели тоже (CS10). */
const SAVE_DEBOUNCE_MS = 250;
const UNDO_LIMIT = 20;

function getConfigStoreCtor() {
  return require("../core/config_store.js").ConfigStore;
}

/**
 * Прослойка макро-рантайма — в `globalThis`: шов, которым движки `pkm_v2/**`
 * берут её без путей. Ставится один раз.
 */
function publishPkmMacroRuntimeEntry() {
  const mod = require("../core/pkm_macro_runtime_entry.js");
  globalThis.__inlinePkmMacroRuntimeEntryMod = mod;
  globalThis.__inlineGetPkmMacroRuntime = (app_) => mod.bootstrapMacroRuntime(app_);
  return mod;
}

/**
 * Новая панель настроек (PRD 5.3). try/catch: из исходников без esbuild
 * TypeScript не разрешится — плагин останется без вкладки, но запустится.
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
  /* Модули — синхронным `require`, ждать нечего (A33). */
  publishPkmMacroRuntimeEntry();
  /* Прогрев движков; не случился — их положит охрана команд. */
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
    /* Диск сильнее и тогда, когда платформа промолчала: перед отложенной
       записью плагин смотрит на файл сам (`C1`, 2026-09-18). */
    beforeWrite: async () => !(await __configWrite.adoptIfDiskChanged(plugin)),
  });

  /* МГ4 и МГ6 — до первой записи формы версии 2, а не после. */
  const prepared = await __configWrite.prepareFileForV2(plugin);
  /* Переезд с версии 1 виден только здесь: копия снимается один раз и значит,
     что хоткеи человека привязаны к старым ID. */
  plugin._migratedFromV1 = !!(prepared && prepared.backupSavedAs);
  await plugin.store.init();
  try {
    await plugin.initializeDevLogSession(plugin.getConfig());
  } catch (e) {
    console.error("[inline-overhaul][dev-mode-log:init]", e);
  }

  {
    /* Панели может не быть (старый Obsidian, модуль не загрузился) — работаем без вкладки. */
    const tab = createSettingTab(plugin);
    if (tab) {
      /* Вкладка — чтобы отпустить подписку при выгрузке (`disposeSettingTab`). */
      plugin._settingTab = tab;
      plugin.addSettingTab(tab);
    }
  }

  plugin.registerCommands();
  noticeCommandIdsChanged(plugin);
  /*
   * Окно «что изменилось» (Р14) — после вкладки и команд, ничего не
   * задерживает. `absent` — файла не было, свежая установка: рассказывать нечего.
   */
  await __releaseNotes.showReleaseNotesOnUpdate(plugin, {
    version: String((plugin.manifest && plugin.manifest.version) || ""),
    freshInstall: String((prepared && prepared.state) || "") === "absent",
    Modal,
    Component,
    MarkdownRenderer,
  });
  /*
   * Автокопия настроек (З-11, `В-147`): конфиг прочитан, рисование не
   * началось. Шов к vault — здесь: адаптер видит файлы вне дерева заметок.
   * Отказ — в журнал, загрузку не роняет.
   */
  await __settingsAutosave.autosaveOnLoad(plugin, autosaveVaultSeam(plugin));
  __editorStyles.ensureTagwheelFill(plugin);
  __editorStyles.ensureStripLine(plugin);
  __editorStyles.ensureCaret(plugin);
  /* Заливка Left и Right Block (З-7): свой блок правил, своя подписка. */
  __editorStyles.ensureBlockFill(plugin);
  __editorMount.mountExtensions(plugin);
  followConfigWithCommands(plugin);
  plugin.register(__configWrite.followDevLogOnStore(plugin));
  /* Value-ссылка идёт за переименованной заметкой (`В-238`). */
  __linkValueRename.followNoteRenames(plugin);

  const devEnabled = !!(readCfgPath(plugin.getConfig && plugin.getConfig(), "advanced.devMode.enabled") === true);
  if (devEnabled) {
    console.info("[inline-overhaul] loaded");
  }
}

/**
 * Одноразовое уведомление о смене ID команд (фаза 2, п. 8; Р3). Не миграция:
 * хоткеи — в настройках Obsidian, чужой файл плагин не правит. Флаг — в
 * `viewState`, контрола нет. Только тем, у кого был конфиг версии 1 (З8).
 * Без `app.setting`/`app.hotkeyManager`: приватное API разрешено одним
 * исключением (7.2), и оно не здесь.
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
      + " The full old-to-new map is printed in the developer console and in docs/COMMAND_IDS_V1_V2.md");

    plugin.store.patch({ viewState: { commandIdsNotice: "shown" } }, "commands:ids:notice", { undoable: false });
  } catch (e) {
    console.error("[inline-overhaul][commands:ids:notice]", e);
  }
}

/**
 * Панель настроек на схеме и декларативном API Obsidian 1.13 (старая удалена
 * 2026-08-29). Не собралась — `null`, без вкладки: исключение из
 * `addSettingTab` в `onload` унесло бы команды, рантайм и подсветку.
 */
function createSettingTab(plugin) {
  const Declarative = getDeclarativeSettingTabCtor();
  if (Declarative) {
    try {
      /*
       * Третий аргумент — мост для редактора Fields: нормализация Order и
       * известные ключи недостижимы из слоя настроек (фаза 3b).
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

/**
 * Отпустить подписку панели на хранилище при выгрузке. Вкладки нет — нечего
 * отпускать; уборка, молчание законно.
 */
function disposeSettingTab(plugin) {
  const tab = plugin ? plugin._settingTab : null;
  if (tab && typeof tab.disposePane === "function") tab.disposePane();
}

/**
 * Шов автокопии к vault (З-11): свой, потому что при загрузке панели ещё нет.
 * `adapter` видит файлы вне дерева заметок.
 */
function autosaveVaultSeam(plugin) {
  const app = plugin && plugin.app ? plugin.app : null;
  if (!app || !app.vault || !app.vault.adapter) return {};
  const vault = app.vault;
  const adapter = vault.adapter;
  return {
    list: async (folder) => {
      const path = String(folder || "").replace(/\/+$/, "");
      if (!path || !(await adapter.exists(path))) return [];
      const found = await adapter.list(path);
      return (found && found.files ? found.files : []).map((file) => ({ path: file }));
    },
    read: async (path) => await adapter.read(path),
    create: async (path, text) => { await vault.create(path, text); },
    ensureFolder: async (folder) => {
      const path = String(folder || "").replace(/\/+$/, "");
      if (!path || (await adapter.exists(path))) return;
      try {
        await vault.createFolder(path);
      } catch (e) {
        /* Папку создал кто-то другой между проверкой и созданием: цель достигнута. */
        if (!(await adapter.exists(path))) throw e;
      }
    },
    move: async (from, to) => {
      const file = vault.getAbstractFileByPath(from);
      if (file) await vault.rename(file, to);
      else await adapter.rename(from, to);
    },
    remove: async (path) => {
      const file = vault.getAbstractFileByPath(path);
      if (file && typeof vault.trash === "function") {
        /* В корзину, а не насовсем: заметка лежит в vault человека. */
        await vault.trash(file, true);
        return;
      }
      await adapter.remove(path);
    },
    hotkeys: () => {
      const manager = app.hotkeyManager;
      /* Проба: у старого Obsidian реестра может не быть, и «нет» — это ответ. */
      return manager && manager.customKeys ? manager.customKeys : {};
    },
    /* Сказать человеку о снятой автокопии (2026-09-19). */
    notify: (message) => { new Notice(message); },
  };
}

module.exports = {
  load,
  /* Наружу ради проверки: единственный звавший — загрузка плагина (правило 124). */
  autosaveVaultSeam,
  /* Подписка набора команд на конфиг — ради проверки: её звавший — загрузка. */
  followConfigWithCommands,
  noticeCommandIdsChanged,
  createSettingTab,
  disposeSettingTab,
};
