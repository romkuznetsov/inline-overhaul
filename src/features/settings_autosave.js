"use strict";

/**
 * Автокопия `data.json` при загрузке плагина, если файл разошёлся с последней
 * автокопией (З-11, В-147). Ловит файл, пришедший снаружи; шаг назад внутри
 * сессии — `Undo last settings change`. Правила копий — `settings_backup.js`,
 * здесь шов с vault. Отказ — в журнал, загрузку не роняет.
 */

const __sharedUtils = require("../core/shared_utils.js");
const __backup = require("./settings_backup.js");
/* Видимый текст по ключу каталога: свой литерал здесь был бы вторым домом. */
const __changeWords = require("./settings_change_words.js");
const __sayModule = require("../core/say.js");
const __say = __sayModule.say;
const __noticeKey = __sayModule.noticeKey;

/** Путь тумблера. Умолчание — в схеме панели, выводимой из прототипа. */
const AUTOSAVE_KEY = "advanced.backups.autosave";

/** Предел автокопий при пустом `Autosaves to keep` (10.13.304). */
const AUTOSAVE_KEEP = 10;
const AUTOSAVE_KEEP_KEY = "advanced.backups.autosaveKeep";

/** Предел из поля; пусто или не число — `AUTOSAVE_KEEP`. */
function autosaveKeep(cfg) {
  const n = parseInt(String(readCfgPath(cfg, AUTOSAVE_KEEP_KEY) ?? ""), 10);
  return n >= 1 ? n : AUTOSAVE_KEEP;
}

/** Сколько строк «что изменилось» попадает в заметку; остаток — числом. */
const AUTOSAVE_DETAIL_LINES = 20;

function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

/** Включена ли автокопия. Ответ «нет» — это ответ, а не отказ. */
function autosaveEnabled(cfg) {
  return readCfgPath(cfg, AUTOSAVE_KEY) === true;
}

/**
 * Сравниваемое — только ветки вкладок (`PART_BRANCHES`), без состояния панели
 * (`ui`): смена вкладки копию не снимает (2026-09-19, У-201). Заметка пишется
 * полной.
 */
function comparableConfig(cfg) {
  const src = isObj(cfg) ? cfg : {};
  const out = {};
  for (const key of Object.keys(__backup.PART_BRANCHES)) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return JSON.parse(JSON.stringify(out));
}

/**
 * `deps` — шов с vault: `list`, `read`, `create`, `ensureFolder`, `move`, `remove`.
 * Ответ: `off`, `no-vault`, `same`, `saved` или `failed` (уже в журнале).
 */
async function autosaveOnLoad(plugin, deps) {
  const d = isObj(deps) ? deps : {};
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  if (!autosaveEnabled(cfg)) return { decision: "off" };
  if (typeof d.list !== "function" || typeof d.create !== "function") {
    console.error("[inline-overhaul][autosave] нет шва к vault: копия не снята");
    return { decision: "no-vault" };
  }
  try {
    const root = __backup.backupFolder(cfg);
    const folder = __backup.autosaveFolder(cfg);
    const autosavesIn = async (dir) => {
      const found = await d.list(dir);
      return (Array.isArray(found) ? found : [])
        .map((x) => (typeof x === "string" ? x : String((x && x.path) || "")))
        .filter((x) => x.slice(0, x.lastIndexOf("/")) === dir && __backup.isAutosavePath(x));
    };
    /* Автокопии, снятые до 2026-10-03 в корень папки копий, переезжают в подпапку. */
    const legacy = await autosavesIn(root);
    if (legacy.length && typeof d.move === "function") {
      if (typeof d.ensureFolder === "function") await d.ensureFolder(folder);
      for (const old of legacy) {
        try {
          await d.move(old, folder + "/" + old.split("/").pop());
        } catch (e) {
          /* Не переехала — остаётся на месте, в корне; заметка человека цела. */
          console.error("[inline-overhaul][autosave] прежняя копия не переехала: " + old, e);
        }
      }
    }
    const paths = (await autosavesIn(folder)).sort();
    const now = comparableConfig(cfg);
    let previous = null;
    const newest = paths.length ? paths[paths.length - 1] : "";
    if (newest && typeof d.read === "function") {
      try {
        previous = __backup.parseBackupNote(await d.read(newest));
      } catch (e) {
        /* Не прочиталась — повод снять новую: сравнивать не с чем. */
        console.error("[inline-overhaul][autosave] последняя копия не прочиталась: " + newest, e);
        previous = null;
      }
    }
    if (previous && JSON.stringify(comparableConfig(previous)) === JSON.stringify(now)) {
      return { decision: "same", newest, kept: paths.length };
    }
    /* Словами панели, а не путями (2026-09-19). */
    const details = previous
      ? __changeWords.describeConfigChange(comparableConfig(previous), now, AUTOSAVE_DETAIL_LINES)
      : ["first autosave in this folder, so there is nothing to compare with"];
    const when = d.now instanceof Date ? d.now : new Date();
    const path = __backup.autosavePath(folder, when);
    if (typeof d.ensureFolder === "function") await d.ensureFolder(folder);
    let hotkeys = {};
    if (typeof d.hotkeys === "function") {
      try {
        hotkeys = d.hotkeys() || {};
      } catch (e) {
        /* Заметка пишется и без хоткеев. */
        console.error("[inline-overhaul][autosave] хоткеи для копии не прочитались", e);
      }
    }
    await d.create(path, __backup.buildBackupNote({
      config: cfg,
      /* Копия максимальная: все вкладки и хоткеи. */
      parts: __backup.allPartIds(),
      hotkeyScope: "own",
      hotkeys,
      pluginVersion: String((plugin && plugin.manifest && plugin.manifest.version) || ""),
      savedAt: when,
      comment: "Saved by Autosave, because the settings on disk were not the ones in the last autosave",
      details,
    }));
    /* Старые копии снимаются тем же заходом: предел объявлен один раз. */
    let removed = [];
    if (typeof d.remove === "function") {
      removed = __backup.pickStaleAutosaves(paths.concat([path]), autosaveKeep(cfg));
      for (const stale of removed) {
        try {
          await d.remove(stale);
        } catch (e) {
          /* Не снялась — не беда: предел мягкий, а заметка человека дороже. */
          console.error("[inline-overhaul][autosave] старая копия не снялась: " + stale, e);
        }
      }
    }
    /* Человеку сказать, где копия (2026-09-19). */
    if (typeof d.notify === "function") {
      d.notify(__say(__noticeKey("plugin", "autosave-saved"),
        "Settings autosaved to {0}", path));
    }
    return { decision: "saved", path, details, removed, kept: paths.length + 1 - removed.length };
  } catch (e) {
    console.error("[inline-overhaul][autosave]", e);
    return { decision: "failed" };
  }
}

module.exports = {
  AUTOSAVE_KEY,
  AUTOSAVE_KEEP,
  AUTOSAVE_KEEP_KEY,
  autosaveKeep,
  AUTOSAVE_DETAIL_LINES,
  autosaveEnabled,
  comparableConfig,
  autosaveOnLoad,
};
