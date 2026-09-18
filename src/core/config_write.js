"use strict";

/**
 * Запись настроек: единственный путь от панели до конфига — и то, что за ней
 * следует.
 *
 * **Почему это не просто `store.patch`.** Записать значение мало: у трёх правок
 * есть последствия, и они наступают ровно здесь.
 *
 *   1. **Журнал разработчика.** Включили — начинается сессия записи; выключили
 *      — закрывается; сменили путь или машинную запись при включённом — сессия
 *      начинается заново. Три перехода, и все три надо отличить: `store.patch`
 *      о них ничего не знает.
 *   2. **Перерисовка открытых заметок.** Настройка оформления меняет то, что
 *      нарисовано, а не то, что записано. Пересборка расширений идёт по всем
 *      открытым редакторам — кроме правок, которые видит одна панель
 *      (`isUiOnlyReason`): переключение вкладки перерисовкой заметок не
 *      сопровождается, иначе каждый щелчок по вкладке дёргал бы редактор.
 *   3. **След в журнале.** У правки есть свой номер (`_lineTraceTxId`), и по
 *      нему в журнале видно, какая правка вызвала какую отрисовку. Номер
 *      растёт здесь, потому что здесь правка и начинается.
 *
 * **`prepareFileForV2` стоит до первой записи.** МГ4 и МГ6 — про то, что лежало
 * на диске **до** переезда: `store.init()` первым же действием пишет конфиг
 * обратно уже в форме версии 2. Своей логики у неё нет намеренно — граница с
 * миром: файлы адаптера vault и `Notice`. У `loadConfig` есть проверка, у
 * обвязки поверх Obsidian её быть не может.
 */

const { Notice } = require("obsidian");

const __configNormalize = require("./config_normalize.js");
const __editorMount = require("../ui/editor/mount.js");
const __pkmOptionKeys = require("./pkm_option_keys.js");
const __sharedUtils = require("./shared_utils.js");
const __devLog = require("./dev_log.js");
/* Ключ сообщения и подстановка строит общий модуль: своих копий здесь нет
   (У-82, У-32). */
const __sayModule = require("./say.js");
const __say = __sayModule.say;
const __noticeKey = __sayModule.noticeKey;

const getConfigMigrationV2Module = __configNormalize.getConfigMigrationV2Module;

function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

function applyPatch(plugin, patchObj, reason) {
  const before = plugin.getConfig();
  const reasonKey = String(reason || "settings");
  const stripPatchFieldId = String(
    patchObj
    && patchObj.pkm
    && patchObj.visual
    && patchObj.visual.tagBars
    && patchObj.visual.tagBars.fieldId
    || ""
  ).trim();
  plugin._lineTraceSeq = Math.max(0, Math.trunc(Number(plugin._lineTraceSeq || 0))) + 1;
  plugin._lineTraceTxId = `linecfg-${Date.now()}-${plugin._lineTraceSeq}`;
  const changed = plugin.store.patch(patchObj, reason || "settings") === true;
  if (!changed) return;
  const after = plugin.getConfig();
  followDevLogTransitions(plugin, before, after);
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
 * Три перехода журнала разработчика: включили, выключили, сменили путь или
 * машинную запись при включённом.
 *
 * Объявлено один раз на обоих, кто меняет конфиг: запись из панели и приём
 * внешней правки (Р-2). Второе объявление разошлось бы с первым молча — и
 * разошлось бы именно там, где журнал единственный способ узнать причину.
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

/**
 * Пересобрать оформление на открытых заметках. Объявлено один раз по той же
 * причине, что и переходы журнала: правок конфига теперь два рода.
 */
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
 * Внешняя правка `data.json` доехала до плагина (Р-2).
 *
 * **Кто сюда приводит.** Платформа, и прочитано это в её коде, а не по памяти
 * (правило 101). `app.js` Obsidian 1.13.7: `PluginManager.onRaw` ловит сырое
 * событие файловой системы под `configDir`, узнаёт по пути `data.json` своего
 * включённого плагина и зовёт `plugin.onConfigFileChange()` — отложенный на
 * 50 мс `_onConfigFileChange`. Тот сравнивает время файла с `_lastDataModified
 * Time`, и **только если файл новее**, зовёт `onExternalSettingsChange()`, а
 * следом сам пересобирает вкладку настроек (`this.settingTab?.update()`). Своё
 * время платформа ставит в `saveData`, поэтому наша запись сигнала не даёт.
 *
 * **Но время файла — не наш отрицательный контроль, а её.** Точность `mtime`
 * принадлежит файловой системе, и полагаться на неё нельзя: своя запись,
 * вернувшаяся сюда сигналом, отсекается **содержимым** — `adoptExternal`
 * сравнивает принесённое с тем, что уже в памяти, и на равном не делает
 * ничего. Без этого перерисовка ходила бы по кругу.
 *
 * **Порядок здесь тот же, что у записи из панели**, и по той же причине:
 * сначала журнал разработчика (он мог быть включён или выключен снаружи),
 * потом оформление на открытых заметках, потом набор команд — Fields могли
 * приехать другие, а команды строятся из конфига один раз (У-79).
 *
 * **Отказ громкий.** Файл не прочитался или пришёл не объектом — настройки
 * остаются прежними, и об этом пишется в журнал: молчание здесь неотличимо от
 * «принял и потерял».
 */
async function applyExternalChange(plugin) {
  if (!plugin || !plugin.store) return false;
  let raw = null;
  try {
    raw = await plugin.loadData();
  } catch (e) {
    console.error("[inline-overhaul][config:external] файл настроек не прочитался,"
      + " настройки остались прежними: " + String((e && e.message) || e || ""));
    return false;
  }
  if (!__sharedUtils.isObj(raw)) {
    console.error("[inline-overhaul][config:external] файл настроек пришёл не объектом,"
      + " настройки остались прежними");
    return false;
  }

  const before = plugin.getConfig();
  if (plugin.store.adoptExternal(raw) !== true) return false;
  const after = plugin.getConfig();

  followDevLogTransitions(plugin, before, after);
  refreshEditorsFor(plugin, "external");
  /*
   * Набор команд PKM строится из Fields конфига и заводится один раз (У-79).
   * Внешняя правка меняет конфиг целиком — ровно как восстановление копии,
   * которое зовёт этот же шов (10.13.40).
   */
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
 * МГ4 и МГ6. Идут **до** `store.init()`, потому что обе про то, что лежало
 * на диске до переезда: `store.init()` первым же действием пишет конфиг
 * обратно уже в форме версии 2.
 *
 * Работа вынесена в `config_migration_v2.loadConfig`, а сюда приходит только
 * граница с миром — файловые операции адаптера vault и `Notice`. Своей
 * логики здесь нет намеренно: у `loadConfig` есть проверка, а у обвязки
 * поверх Obsidian её быть не может.
 *
 * Ошибка не роняет загрузку плагина: без копии плагин работает, без плагина
 * — нет.
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
      /* Удаление нужно одному месту: сироте служебного файла в корне
         vault после переезда в папку плагина (В-39). */
      remove: (p) => adapter.remove(p),
    };
    const result = await migration.loadConfig(
      files,
      plugin.pluginFolderPath(),
      (message) => { new Notice(message); },
    );
    /*
     * Конфиг записывается на диск сразу: при нечитаемом файле (МГ6) `loadData`
     * Obsidian отдал бы тот же мусор, а при переезде с версии 1 (МГ4) копия
     * уже снята и терять исходник больше нечем.
     */
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

module.exports = {
  applyPatch,
  applyExternalChange,
  isUiOnlyReason,
  prepareFileForV2,
};
