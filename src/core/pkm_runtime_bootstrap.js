"use strict";

/*
 * Загрузчик, у которого не осталось загрузки: модули приезжают литеральным
 * `require` (У-89), а здесь живёт то, что загрузкой не было никогда, —
 * разрешение конфига порядка Field.
 *
 * Что ушло вместе с мостом модулей: `loadSharedModule` — общая обёртка «позови
 * мост, проверь годность, положи в `globalThis`», и `loadVaultModuleBridgeShared`
 * — прогрев самого моста. Обе умели вернуть `null`, и на этом `null` плагин
 * работал наполовину и молчал (У-90).
 *
 * `normalizeOrderKeyFallback` тоже снята. Она была умолчанием на случай, если
 * `pkm_v2/field_model.js` не приедет, — то есть вторым объявлением правила
 * нормализации ключа (У-32). Модуль лежит в бандле и приезжает всегда.
 */

const fieldModel = require("../../pkm_v2/field_model.js");

function reportLoaderFallback(stage, err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return;
    const msg = err && err.message ? String(err.message) : String(err || "");
    console.warn(`[inline-overhaul][loader] ${stage}: ${msg}`);
  } catch (_) {
    /*
     * Здесь молчать обязательно: это сам отчётчик об отказе, и отчёт о его
     * собственном отказе девать было бы некуда, кроме него же. Уронить
     * загрузку из-за неудавшегося следа — второй отказ вместо одного.
     *
     * Та же четвёрка строк объявлена ещё и в
     * `src/features/plugin_commands.js`: одно правило в двух местах, и
     * сводить их — отдельная правка, не эта (третий кусок В-97).
     */
  }
}

/*
 * Ключ `globalThis` остаётся швом: `status_runtime_common` и движки под З3
 * спрашивают нормализатор через него. Аргумент `fallbackNormalize` больше не
 * умолчание на отказ, а **выбор места вызова**: у TagWheel своя нормализация
 * ключа, и она сильнее общей.
 */
function loadOrderKeyNormalizer(fallbackNormalize) {
  if (typeof globalThis.__inlineOrderKeyNormalizer === "function") {
    return globalThis.__inlineOrderKeyNormalizer;
  }
  if (typeof fieldModel.normalizeOrderKey !== "function") {
    throw new Error("pkm_v2/field_model.js unavailable: normalizeOrderKey");
  }
  globalThis.__inlineOrderKeyNormalizer = typeof fallbackNormalize === "function"
    ? fallbackNormalize
    : fieldModel.normalizeOrderKey;
  return globalThis.__inlineOrderKeyNormalizer;
}

async function loadOrderConfigFromPluginData(app_, options) {
  const opts = options && typeof options === "object" ? options : {};
  const isObj = typeof opts.isObj === "function"
    ? opts.isObj
    : ((x) => !!x && typeof x === "object" && !Array.isArray(x));
  try {
    const af = app_ && app_.vault && typeof app_.vault.getAbstractFileByPath === "function"
      ? app_.vault.getAbstractFileByPath(".obsidian/plugins/inline-overhaul/data.json")
      : null;
    if (!af) return null;
    const txt = await app_.vault.read(af);
    const json = JSON.parse(String(txt || "{}"));
    const order = json && json.pkm && json.pkm.fields ? json.pkm.fields.order : null;
    return isObj(order) ? order : null;
  } catch (e) {
    reportLoaderFallback("pkm_runtime_bootstrap.loadOrderConfigFromPluginData", e);
    return null;
  }
}

async function resolveOrderConfig(app_, settings, options) {
  const opts = options && typeof options === "object" ? options : {};
  const key = String(opts.orderConfigKey || "").trim();
  if (!key) throw new Error("pkm_runtime_bootstrap: orderConfigKey is required");
  const parseOrderConfig = typeof opts.parseOrderConfig === "function" ? opts.parseOrderConfig : null;
  const normalizeKey = typeof opts.normalizeKey === "function" ? opts.normalizeKey : ((k) => String(k || "").trim());
  if (!parseOrderConfig) throw new Error("pkm_runtime_bootstrap: parseOrderConfig is required");
  const rawSettings = settings && Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : undefined;
  const hasSettingsOrder = rawSettings !== undefined && rawSettings !== null
    && !(typeof rawSettings === "string" && String(rawSettings).trim() === "");
  if (hasSettingsOrder) {
    return parseOrderConfig(rawSettings, normalizeKey);
  }
  const fromPlugin = await loadOrderConfigFromPluginData(app_, { isObj: opts.isObj });
  if (fromPlugin) return parseOrderConfig(fromPlugin, normalizeKey);
  return parseOrderConfig(rawSettings, normalizeKey);
}

module.exports = {
  loadOrderKeyNormalizer,
  loadOrderConfigFromPluginData,
  resolveOrderConfig,
};
