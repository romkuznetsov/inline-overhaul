"use strict";

/**
 * Запись настроек: единственный путь от панели до конфига и его последствия,
 * которых `store.patch` не знает:
 *
 *   1. Журнал разработчика: включили / выключили / сменили путь — три перехода.
 *   2. Перерисовка открытых заметок, кроме правок одной панели (`isUiOnlyReason`).
 *   3. Номер правки `_lineTraceTxId` для следа в журнале.
 *
 * `prepareFileForV2` — до первой записи: `store.init()` сразу пишет форму версии 2 (МГ4, МГ6).
 */

const { Notice } = require("obsidian");

const __configNormalize = require("./config_normalize.js");
const __editorMount = require("../ui/editor/mount.js");
const __pkmOptionKeys = require("./pkm_option_keys.js");
const __sharedUtils = require("./shared_utils.js");
const __devLog = require("./dev_log.js");
/* Ключ и подстановку строит общий модуль (У-82, У-32). */
const __sayModule = require("./say.js");
const __say = __sayModule.say;
const __noticeKey = __sayModule.noticeKey;

const getConfigMigrationV2Module = __configNormalize.getConfigMigrationV2Module;

function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

function applyPatch(plugin, patchObj, reason) {
  const before = plugin.getConfig();
  const reasonKey = String(reason || "settings");
  /* Путь версии 2; условие версии 1 отдавало пустоту всегда (Д-13). */
  const stripPatchFieldId = String(readCfgPath(patchObj, "visual.tagBars.fieldId") || "").trim();
  plugin._lineTraceSeq = Math.max(0, Math.trunc(Number(plugin._lineTraceSeq || 0))) + 1;
  plugin._lineTraceTxId = `linecfg-${Date.now()}-${plugin._lineTraceSeq}`;
  const changed = plugin.store.patch(patchObj, reason || "settings") === true;
  if (!changed) return;
  const after = plugin.getConfig();
  const debugLine = !!(readCfgPath(after, "advanced.devMode.enabled") === true && readCfgPath(after, "advanced.devMode.traceTagVisualLine") === true);
  if (debugLine) {
    __devLog.traceQuietly(plugin, after, "strip.config.patch", {
        traceTxId: plugin._lineTraceTxId,
        reason: reasonKey,
        requestedStripFieldId: stripPatchFieldId,
        beforeStripFieldId: String(readCfgPath(before, "visual.tagBars.fieldId") || "").trim(),
        afterStripFieldId: String(readCfgPath(after, "visual.tagBars.fieldId") || "").trim(),
        beforeStripActive: readCfgPath(before, "visual.tagBars.active") === true,
        afterStripActive: readCfgPath(after, "visual.tagBars.active") === true,
      mismatchDetected: !!(stripPatchFieldId && String(readCfgPath(after, "visual.tagBars.fieldId") || "").trim() !== stripPatchFieldId),
    });
  }
  refreshEditorsFor(plugin, reasonKey);
}

/**
 * Три перехода журнала разработчика. Слушают хранилище (`followDevLogOnStore`),
 * а не дорогу записи: панель пишет мимо `applyPatch` (BUGHUNT 2026-09-30, D3).
 * Одна подписка на все дороги, включая внешнюю правку (Р-2).
 */
function followDevLogTransitions(plugin, before, after) {
  const wasEnabled = readCfgPath(before, "advanced.devMode.enabled") === true;
  const isEnabled = readCfgPath(after, "advanced.devMode.enabled") === true;
  const beforePath = String(readCfgPath(before, "advanced.devMode.logPath") || "");
  const afterPath = String(readCfgPath(after, "advanced.devMode.logPath") || "");
  const beforeAi = readCfgPath(before, "advanced.devMode.aiLog") === true;
  const afterAi = readCfgPath(after, "advanced.devMode.aiLog") === true;
  if (!wasEnabled && isEnabled) {
    plugin.initializeDevLogSession(after).catch((e) => {
      console.error("[inline-overhaul][dev-mode-log:toggle-on]", e);
    });
  }
  if (wasEnabled && !isEnabled) {
    plugin.closeDevLogSession(before, true).catch((e) => {
      console.error("[inline-overhaul][dev-mode-log:toggle-off]", e);
    });
  }
  if (wasEnabled && isEnabled && (beforePath !== afterPath || beforeAi !== afterAi)) {
    plugin.closeDevLogSession(before, true)
      .then(() => plugin.initializeDevLogSession(after))
      .catch((e) => {
        console.error("[inline-overhaul][dev-mode-log:reinit]", e);
      });
  }
}

/** Пересобрать оформление на открытых заметках — одно объявление на оба рода правок. */
function refreshEditorsFor(plugin, reasonKey) {
  if (isUiOnlyReason(reasonKey)) return;
  __editorMount.refreshOpenEditors(plugin);
}

function isUiOnlyReason(reasonKey) {
  const key = String(reasonKey || "").trim();
  if (!key) return false;
  if (key === "settings:tab" || key === "settings:visual-subtab" || key === "settings:hotkeys-subtab") return true;
  if (key.startsWith("settings:ui:")) return true;
  if (key.startsWith("settings:binder:")) return true;
  return false;
}

/**
 * Внешняя правка `data.json` (Р-2). Приводит платформа (правило 101, `app.js`
 * 1.13.7): `PluginManager.onRaw` → `onConfigFileChange()` (50 мс) →
 * `_onConfigFileChange` сравнивает время с `_lastDataModifiedTime` и только у
 * файла новее зовёт `onExternalSettingsChange()`, затем `settingTab?.update()`.
 * Свою запись отсекает содержимое (`adoptExternal`), не `mtime`.
 *
 * Порядок как у записи из панели: журнал, оформление, команды (У-79).
 * Отказ громкий: настройки прежние, запись в журнал.
 */
async function applyExternalChange(plugin, preloaded) {
  if (!plugin || !plugin.store) return false;
  let raw = preloaded === undefined ? null : preloaded;
  if (preloaded === undefined) {
    try {
      raw = await plugin.loadData();
    } catch (e) {
      console.error("[inline-overhaul][config:external] файл настроек не прочитался,"
        + " настройки остались прежними: " + String((e && e.message) || e || ""));
      return false;
    }
  }
  if (!__sharedUtils.isObj(raw)) {
    console.error("[inline-overhaul][config:external] файл настроек пришёл не объектом,"
      + " настройки остались прежними");
    return false;
  }

  if (plugin.store.adoptExternal(raw) !== true) return false;
  refreshEditorsFor(plugin, "external");
  /* Команды PKM строятся из Fields один раз (У-79); тот же шов, что у восстановления копии (10.13.40). */
  if (typeof plugin.rebuildFromConfig === "function") {
    Promise.resolve(plugin.rebuildFromConfig()).catch((e) => {
      console.error("[inline-overhaul][config:external] команды не перезавелись", e);
    });
  }

  new Notice(__say(
    __noticeKey("plugin", "external-reload"),
    "Settings changed on disk, so inlineOverhaul reloaded them",
  ));
  return true;
}

/**
 * Взгляд на диск перед записью: сигнал платформы приходит лишь у файла новее
 * нашей записи, а копия переносит время источника (2026-09-18). Чужое — по
 * содержимому; принимается как по сигналу. `true` — принято, свою отложенную запись бросить.
 */
async function adoptIfDiskChanged(plugin) {
  const store = plugin && plugin.store;
  if (!store || typeof store.diskChangedUnderUs !== "function") return false;
  let raw = null;
  try {
    raw = await plugin.loadData();
  } catch (e) {
    console.error("[inline-overhaul][config:external] файл настроек не прочитался"
      + " перед записью: " + String((e && e.message) || e || ""));
    return false;
  }
  if (!store.diskChangedUnderUs(raw)) return false;
  return await applyExternalChange(plugin, raw);
}

/**
 * МГ4 и МГ6 — до `store.init()`. Работа в `config_migration_v2.loadConfig`,
 * здесь только граница с миром (адаптер vault, `Notice`). Ошибка загрузку не роняет.
 */
async function prepareFileForV2(plugin) {
  const adapter = plugin.app && plugin.app.vault ? plugin.app.vault.adapter : null;
  if (!adapter || typeof adapter.read !== "function" || typeof adapter.write !== "function") return null;
  try {
    const migration = getConfigMigrationV2Module();
    const files = {
      exists: (p) => adapter.exists(p),
      read: (p) => adapter.read(p),
      write: (p, data) => adapter.write(p, data),
      /* Удаление — только для сироты служебного файла в корне vault (В-39). */
      remove: (p) => adapter.remove(p),
    };
    const result = await migration.loadConfig(
      files,
      plugin.pluginFolderPath(),
      (message) => { new Notice(message); },
    );
    /* Пишется сразу: при МГ6 `loadData` отдал бы тот же мусор, при МГ4 копия уже снята. */
    await plugin.saveData(result.config);
    if (result.backupSavedAs) {
      console.info("[inline-overhaul] копия конфига версии 1: " + result.backupSavedAs);
    }
    if (result.generatedRulesRemoved && result.generatedRulesRemoved.length) {
      console.info("[inline-overhaul] служебный файл правил снят и прибран: "
        + result.generatedRulesRemoved.join(", "));
    }
    return result;
  } catch (e) {
    console.error("[inline-overhaul][config:prepare]", e);
    return null;
  }
}

/** Подписка переходов журнала на хранилище; отдаёт отписку. */
function followDevLogOnStore(plugin) {
  let prev = plugin.getConfig();
  return plugin.store.subscribe((payload) => {
    const next = payload && payload.snapshot ? payload.snapshot : plugin.getConfig();
    const was = prev;
    prev = next;
    followDevLogTransitions(plugin, was, next);
  });
}

module.exports = {
  applyPatch,
  refreshEditorsFor,
  followDevLogOnStore,
  applyExternalChange,
  adoptIfDiskChanged,
  isUiOnlyReason,
  prepareFileForV2,
};
