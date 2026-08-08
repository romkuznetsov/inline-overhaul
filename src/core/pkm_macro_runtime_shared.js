"use strict";

const SHARED_PATH = ".obsidian/plugins/inline-overhaul/src/core/pkm_macro_runtime_shared.js";
const PRELOAD_FACADE_PATH = ".obsidian/plugins/inline-overhaul/src/core/pkm_runtime_preload_facade.js";
const OPTION_KEYS_PATH = ".obsidian/plugins/inline-overhaul/src/core/pkm_option_keys.js";
const RUNTIME_CACHE_KEY = "__inlineOverhaulRuntimeModuleCache";

function reportLoaderFallback(stage, err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return;
    const msg = err && err.message ? String(err.message) : String(err || "");
    console.warn(`[inline-overhaul][loader] ${stage}: ${msg}`);
  } catch (_) {}
}

async function loadVaultModule(app_, vaultPath, forceReload) {
  let bridge = globalThis.__inlineVaultModuleBridge;
  if (!(bridge && typeof bridge.loadVaultModule === "function")) {
    try {
      const mod = require("./vault_module_bridge.js");
      if (mod && typeof mod.loadVaultModule === "function") {
        bridge = mod;
        globalThis.__inlineVaultModuleBridge = mod;
      }
    } catch (e) {
      reportLoaderFallback("pkm_macro_runtime_shared.bridge.require", e);
    }
  }
  if (!(bridge && typeof bridge.loadVaultModule === "function")) {
    throw new Error("pkm_macro_runtime_shared: vault_module_bridge unavailable");
  }
  try {
    return await bridge.loadVaultModule(app_, vaultPath, forceReload, RUNTIME_CACHE_KEY);
  } catch (e) {
    reportLoaderFallback(`pkm_macro_runtime_shared.bridge.load:${vaultPath}`, e);
    throw e;
  }
}

async function loadRuntimePreloadFacade(app_) {
  globalThis.__inlineRuntimePreloadFacade ??= null;
  if (globalThis.__inlineRuntimePreloadFacade) return globalThis.__inlineRuntimePreloadFacade;
  try {
    const mod = await loadVaultModule(app_, PRELOAD_FACADE_PATH, false);
    if (mod && typeof mod.loadRuntimeBootstrap === "function" && typeof mod.loadRulesRuntimeHelpers === "function" && typeof mod.loadMacroShared === "function") {
      globalThis.__inlineRuntimePreloadFacade = mod;
      return mod;
    }
  } catch (e) {
    reportLoaderFallback("pkm_macro_runtime_shared.loadRuntimePreloadFacade", e);
  }
  return null;
}

function normalizeOrderKeyLocal(key) {
  return String(key || "").trim();
}

async function loadVaultModuleBridgeShared(app_) {
  const facade = await loadRuntimePreloadFacade(app_);
  if (facade && typeof facade.loadVaultModuleBridgeShared === "function") {
    return facade.loadVaultModuleBridgeShared(app_, loadVaultModule);
  }
  return null;
}

async function loadOrderKeyNormalizer(app_, fallbackNormalize) {
  const facade = await loadRuntimePreloadFacade(app_);
  const fallback = typeof fallbackNormalize === "function" ? fallbackNormalize : normalizeOrderKeyLocal;
  if (facade && typeof facade.loadOrderKeyNormalizer === "function") {
    return facade.loadOrderKeyNormalizer(app_, loadVaultModule, fallback);
  }
  globalThis.__inlineOrderKeyNormalizer = fallback;
  return globalThis.__inlineOrderKeyNormalizer;
}

async function loadLinePipeline(app_) {
  const facade = await loadRuntimePreloadFacade(app_);
  if (facade && typeof facade.loadLinePipeline === "function") {
    return facade.loadLinePipeline(app_, loadVaultModule);
  }
  return null;
}

async function loadMacroShared(app_) {
  const facade = await loadRuntimePreloadFacade(app_);
  if (facade && typeof facade.loadMacroShared === "function") {
    return facade.loadMacroShared(app_, loadVaultModule);
  }
  return null;
}

async function loadRulesRuntimeHelpers(app_) {
  const facade = await loadRuntimePreloadFacade(app_);
  if (facade && typeof facade.loadRulesRuntimeHelpers === "function") {
    return facade.loadRulesRuntimeHelpers(app_, loadVaultModule);
  }
  return null;
}

async function loadPkmOptionKeys(app_) {
  globalThis.__inlinePkmOptionKeysMod ??= null;
  if (globalThis.__inlinePkmOptionKeysMod) return globalThis.__inlinePkmOptionKeysMod;
  try {
    const mod = await loadVaultModule(app_, OPTION_KEYS_PATH, false);
    if (mod && typeof mod === "object" && mod.KEYS && typeof mod.KEYS === "object") {
      globalThis.__inlinePkmOptionKeysMod = mod;
      return mod;
    }
  } catch (e) {
    reportLoaderFallback("pkm_macro_runtime_shared.loadPkmOptionKeys", e);
  }
  return null;
}

module.exports = {
  SHARED_PATH,
  OPTION_KEYS_PATH,
  RUNTIME_CACHE_KEY,
  loadVaultModule,
  loadRuntimePreloadFacade,
  normalizeOrderKeyLocal,
  loadVaultModuleBridgeShared,
  loadOrderKeyNormalizer,
  loadLinePipeline,
  loadMacroShared,
  loadRulesRuntimeHelpers,
  loadPkmOptionKeys,
};
