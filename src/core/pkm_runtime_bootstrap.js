"use strict";

function reportLoaderFallback(stage, err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return;
    const msg = err && err.message ? String(err.message) : String(err || "");
    console.warn(`[inline-overhaul][loader] ${stage}: ${msg}`);
  } catch (_) {}
}

async function loadSharedModule(app_, loadVaultModule, globalKey, modulePath, validate) {
  const key = String(globalKey || "").trim();
  if (!key) throw new Error("pkm_runtime_bootstrap: global key is required");
  if (globalThis[key]) return globalThis[key];
  try {
    const mod = await loadVaultModule(app_, modulePath, false);
    if (mod && typeof validate === "function" && validate(mod)) {
      globalThis[key] = mod;
      return mod;
    }
  } catch (e) {
    reportLoaderFallback(`pkm_runtime_bootstrap.loadSharedModule:${modulePath}`, e);
  }
  return null;
}

async function loadVaultModuleBridgeShared(app_, loadVaultModule) {
  if (globalThis.__inlineVaultModuleBridge && typeof globalThis.__inlineVaultModuleBridge.loadVaultModule === "function") {
    return globalThis.__inlineVaultModuleBridge;
  }
  try {
    const mod = await loadVaultModule(app_, ".obsidian/plugins/inline-overhaul/src/core/vault_module_bridge.js", false);
    if (mod && typeof mod.loadVaultModule === "function") {
      globalThis.__inlineVaultModuleBridge = mod;
      return mod;
    }
  } catch (e) {
    reportLoaderFallback("pkm_runtime_bootstrap.loadVaultModuleBridgeShared", e);
  }
  return null;
}

function normalizeOrderKeyFallback(key) {
  return String(key || "").trim();
}

async function loadOrderKeyNormalizer(app_, loadVaultModule, fallbackNormalize) {
  if (typeof globalThis.__inlineOrderKeyNormalizer === "function") return globalThis.__inlineOrderKeyNormalizer;
  try {
    const fieldModel = await loadVaultModule(app_, ".obsidian/plugins/inline-overhaul/pkm_v2/field_model.js", false);
    if (fieldModel && typeof fieldModel.normalizeOrderKey === "function") {
      globalThis.__inlineOrderKeyNormalizer = fieldModel.normalizeOrderKey;
      return globalThis.__inlineOrderKeyNormalizer;
    }
  } catch (e) {
    reportLoaderFallback("pkm_runtime_bootstrap.loadOrderKeyNormalizer", e);
  }
  globalThis.__inlineOrderKeyNormalizer = typeof fallbackNormalize === "function"
    ? fallbackNormalize
    : normalizeOrderKeyFallback;
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
  loadSharedModule,
  loadVaultModuleBridgeShared,
  normalizeOrderKeyFallback,
  loadOrderKeyNormalizer,
  loadOrderConfigFromPluginData,
  resolveOrderConfig,
};
