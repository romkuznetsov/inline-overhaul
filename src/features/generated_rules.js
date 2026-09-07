"use strict";

/**
 * Служебный файл правил: когда он пересобирается и где лежит.
 *
 * **Что это за файл.** `generated_rules.md` — заметка, которую плагин пишет
 * сам: панель пишет настройки в `data.json`, а движки `pkm_v2/**` читают эту
 * заметку. Форма у неё осталась версии 1, и перекладку значений делает
 * `rules_markdown_builder`.
 *
 * **Почему модулем** (кусок четвёртый разбора `main.js`, 2026-09-07). Работа
 * здесь одна: собрать заметку и положить её туда, куда смотрит движок. Само
 * решение «когда пересобирать» живёт в двух оркестраторах
 * (`rules_sync_orchestrator`, `store_events_orchestrator`), а этот модуль —
 * тот шов, которым они дотягиваются до плагина: хранилище, адаптер vault,
 * таймер и панель настроек.
 *
 * **Таймер и отписка висят на плагине** (`_rulesGenTimer`,
 * `_unsubscribeStore`): их время жизни — время жизни плагина.
 *
 * **`rebuildFromConfig` — вход для восстановления копии настроек** (10.13.40).
 * Там конфиг меняется целиком и разом, и обе вещи, которые плагин строит из
 * конфига один раз при загрузке, надо построить заново: набор команд PKM
 * (У-79) и место служебного файла. Правило переезда файла берётся у той же
 * функции миграции, что и при загрузке, — второй раз оно не пишется (У-32).
 */

const { Notice } = require("obsidian");

const __configNormalize = require("../core/config_normalize.js");
const __pkmOptionKeys = require("../core/pkm_option_keys.js");
const __rulesSyncOrchestrator = require("./rules_sync_orchestrator.js");
const __storeEventsOrchestrator = require("./store_events_orchestrator.js");
const __sharedUtils = require("../core/shared_utils.js");

const DEFAULT_CONFIG = __configNormalize.DEFAULT_CONFIG;
const getConfigMigrationV2Module = __configNormalize.getConfigMigrationV2Module;

function cloneJson(x) { return __sharedUtils.cloneJson(x); }
function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }
function toPrettyJson(x) { return __sharedUtils.toPrettyJson(x); }
function writeCfgPath(root, path, value) { return __sharedUtils.writeCfgPath(root, path, value); }

function getStoreEventsOrchestrator() {
  return __storeEventsOrchestrator;
}

function getRulesSyncOrchestrator() {
  return __rulesSyncOrchestrator;
}

/**
 * Сборщик служебной заметки правил.
 *
 * Единственный модуль, который помнится: у него есть зависимости, и собирается
 * он один раз. Своей копии сборки здесь больше нет — форма документа осталась
 * версии 1, и две копии перекладки значений разошлись бы молча, в заметке,
 * которую человек не читает (У-32).
 */
let __rulesMarkdownBuilder = null;
function getRulesMarkdownBuilder() {
  if (__rulesMarkdownBuilder) return __rulesMarkdownBuilder;
  const mod = require("./rules_markdown_builder.js");
  __rulesMarkdownBuilder = mod.createRulesMarkdownBuilder({ isObj, cloneJson, toPrettyJson });
  return __rulesMarkdownBuilder;
}

function registerStoreEvents(plugin) {
  const orch = getStoreEventsOrchestrator();
  return orch.registerStoreEvents({
    subscribeStore: (listener) => plugin.store.subscribe(listener),
    setUnsubscribe: (fn) => {
      plugin._unsubscribeStore = fn;
    },
    getUnsubscribe: () => plugin._unsubscribeStore,
    renderSettingsTab: () => {
      const tab = plugin._settingsTab;
      if (!tab) return;
      /*
       * Декларативная панель пересобирает определения методом `update`;
       * `display` у неё -- объяснение для Obsidian старше 1.13.
       */
      if (typeof tab.update === "function") tab.update();
      else if (typeof tab.display === "function") tab.display();
    },
    scheduleGeneratedRulesSync: () => scheduleSync(plugin),
    getRulesTimer: () => plugin._rulesGenTimer,
    setRulesTimer: (timer) => {
      plugin._rulesGenTimer = timer;
    },
    registerCleanup: (fn) => plugin.register(fn),
  });
}

function scheduleSync(plugin) {
  const orch = getRulesSyncOrchestrator();
  return orch.scheduleGeneratedRulesSync({
    delayMs: 250,
    getConfig: () => plugin.getConfig(),
    getTimer: () => plugin._rulesGenTimer,
    setTimer: (timer) => {
      plugin._rulesGenTimer = timer;
    },
    ensureGeneratedRulesNow: (reason) => syncNow(plugin, reason),
    onError: (e) => {
      console.error("[inline-overhaul][rules-gen]", e);
    },
  });
}

async function syncNow(plugin, reason) {
  const orch = getRulesSyncOrchestrator();
  return await orch.ensureGeneratedRulesNow({
    getConfig: () => plugin.getConfig(),
    defaultGeneratedRulesPath: DEFAULT_CONFIG.pkm.generatedRulesPath,
    buildRulesMarkdown: (cfg) => getRulesMarkdownBuilder().buildTagWheelRulesMarkdownFromConfig(cfg),
    writeText: (p, md) => plugin.app.vault.adapter.write(p, md),
    notice: (msg) => new Notice(msg),
  }, reason);
}

/**
 * Заново собрать всё, что плагин строит из конфига один раз — при загрузке.
 *
 * Зовётся одним местом — восстановлением копии настроек (10.13.40),
 * потому что только там конфиг меняется целиком и разом. Две вещи:
 *
 *   1. **Команды.** Набор команд PKM строится из Fields конфига (У-79):
 *      новый набор Fields без этого вызова получает команды только после
 *      перезапуска, и хоткей из копии ложится на команду, которой ещё нет.
 *   2. **Место служебного файла.** Копия несёт в себе
 *      `advanced.generatedRulesPath`, и у копии, снятой до переезда В-39, там
 *      стоит корень vault. Переезд живёт в `loadConfig` и идёт только при
 *      загрузке — поэтому после восстановления плагин до конца сеанса писал
 *      этот файл в корень vault, а следующий запуск его оттуда убирал.
 *      Именно это заказчик и видел: файл появился и пропал при перезапуске.
 *      Правило берётся там же, где и при загрузке —
 *      `moveGeneratedRulesIntoPluginFolder`, — а не пишется второй раз (У-32).
 *
 * Ни одна из двух неудач не отменяет восстановления: настройки уже записаны.
 */
async function rebuildFromConfig(plugin) {
  try {
    plugin.registerCommands();
  } catch (e) {
    console.error("[inline-overhaul] команды не перезавелись", e);
  }
  try {
    await reapplyLocation(plugin);
  } catch (e) {
    console.error("[inline-overhaul] место служебного файла не починилось", e);
  }
}

/**
 * Переезд служебного файла — ещё раз, после того как конфиг сменился
 * целиком. Своего правила здесь нет: решает та же функция миграции, что и при
 * загрузке, и со всеми теми же швами к файловой системе. Свой путь человека
 * она не трогает — только прежнее место и литеральные умолчания.
 */
async function reapplyLocation(plugin) {
  const adapter = plugin.app && plugin.app.vault ? plugin.app.vault.adapter : null;
  if (!adapter || typeof adapter.exists !== "function") return;
  const migration = getConfigMigrationV2Module();
  if (!migration || typeof migration.moveGeneratedRulesIntoPluginFolder !== "function") return;
  const files = {
    exists: (p) => adapter.exists(p),
    read: (p) => adapter.read(p),
    write: (p, data) => adapter.write(p, data),
    remove: (p) => adapter.remove(p),
  };
  /* Копия конфига: функция пишет в него прямо, а единственный путь
     записи в хранилище — `store.update` (CS10). */
  const probe = cloneJson(plugin.getConfig());
  const before = String(readCfgPath(probe, "advanced.generatedRulesPath") || "").trim();
  const move = await migration.moveGeneratedRulesIntoPluginFolder(
    files,
    plugin.pluginFolderPath(),
    probe,
    [__pkmOptionKeys.DEFAULT_RULES_PATH, __pkmOptionKeys.LEGACY_RULES_PATH],
  );
  if (!move || !move.path || move.path === before) return;
  plugin.store.update(
    (cfg) => {
      writeCfgPath(cfg, "advanced.generatedRulesPath", move.path);
      return cfg;
    },
    "restore:generated-rules-path",
  );
  await syncNow(plugin, "restore");
}

module.exports = {
  registerStoreEvents,
  scheduleSync,
  syncNow,
  rebuildFromConfig,
  reapplyLocation,
};
