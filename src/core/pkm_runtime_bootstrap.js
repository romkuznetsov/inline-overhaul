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

const __sharedUtils = require("./shared_utils.js");

/* След запасного хода загрузки объявлен один раз — `reportLoaderFallback` в
   `shared_utils.js` (10.13.150). Здесь и в `plugin_commands.js` стояли две
   побайтно равные копии; та, что признавала себя копией, — эта. */
function reportLoaderFallback(stage, err) {
  return __sharedUtils.reportLoaderFallback(stage, err);
}

/*
 * **Нормализатора ключа Order здесь больше нет, и шва под него тоже**
 * (10.13.168). Было: `loadOrderKeyNormalizer` брал довод, иначе брал
 * `pkm_v2/field_model.js`, клал результат на `globalThis` и больше не
 * пересчитывал — то есть побеждал позвавший первым. Довод приезжал сюда через
 * пять слоёв, и все они, вместе с этим, вели в один дом —
 * `normalizeOrderKey` в `shared_utils.js`. Потребители спрашивают дом сами,
 * и порядок загрузки на ответ больше не влияет ничем.
 */
async function loadOrderConfigFromPluginData(app_) {
  const isObj = __sharedUtils.isObj;
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
  /* Дом один — `normalizeOrderKey` в `shared_utils.js` (10.13.168). Здесь
     стояло безымянное тело того же правила запасным ходом: довод давали все
     звавшие, и ни один прогон в него не заходил. */
  const normalizeKey = typeof opts.normalizeKey === "function" ? opts.normalizeKey : __sharedUtils.normalizeOrderKey;
  if (!parseOrderConfig) throw new Error("pkm_runtime_bootstrap: parseOrderConfig is required");
  const rawSettings = settings && Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : undefined;
  const hasSettingsOrder = rawSettings !== undefined && rawSettings !== null
    && !(typeof rawSettings === "string" && String(rawSettings).trim() === "");
  if (hasSettingsOrder) {
    return parseOrderConfig(rawSettings, normalizeKey);
  }
  const fromPlugin = await loadOrderConfigFromPluginData(app_);
  if (fromPlugin) return parseOrderConfig(fromPlugin, normalizeKey);
  return parseOrderConfig(rawSettings, normalizeKey);
}

module.exports = {
  loadOrderConfigFromPluginData,
  resolveOrderConfig,
};
