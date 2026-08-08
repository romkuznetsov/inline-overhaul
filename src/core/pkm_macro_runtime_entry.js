"use strict";

const MACRO_RUNTIME_SHARED_PATH = ".obsidian/plugins/inline-overhaul/src/core/pkm_macro_runtime_shared.js";
const RUNTIME_CACHE_KEY = "__inlineOverhaulRuntimeModuleCache";

function reportLoaderFallback(stage, err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return;
    const msg = err && err.message ? String(err.message) : String(err || "");
    console.warn(`[inline-overhaul][loader] ${stage}: ${msg}`);
  } catch (_) {}
}

function ensureVaultBridge() {
  let bridge = globalThis.__inlineVaultModuleBridge;
  if (bridge && typeof bridge.loadVaultModule === "function") return bridge;
  try {
    const mod = require("./vault_module_bridge.js");
    if (mod && typeof mod.loadVaultModule === "function") {
      bridge = mod;
      globalThis.__inlineVaultModuleBridge = mod;
      return mod;
    }
  } catch (e) {
    reportLoaderFallback("pkm_macro_runtime_entry.bridge.require", e);
  }
  return null;
}

async function loadMacroRuntimeShared(app_) {
  const cached = globalThis.__inlinePkmMacroRuntimeSharedMod;
  if (cached && typeof cached.loadVaultModule === "function") return cached;

  const bridge = ensureVaultBridge();
  if (bridge && typeof bridge.loadVaultModule === "function") {
    try {
      const mod = await bridge.loadVaultModule(app_, MACRO_RUNTIME_SHARED_PATH, false, RUNTIME_CACHE_KEY);
      if (mod && typeof mod.loadVaultModule === "function") {
        globalThis.__inlinePkmMacroRuntimeSharedMod = mod;
        return mod;
      }
    } catch (e) {
      reportLoaderFallback("pkm_macro_runtime_entry.bridge.loadMacroRuntimeShared", e);
    }
  }
  throw new Error("pkm_macro_runtime_entry: vault_module_bridge unavailable");
}

function normalizeOrderKeyDefault(key) {
  return String(key || "").trim();
}

async function bootstrapMacroRuntime(app_, normalizeOrderKeyLocal) {
  const shared = await loadMacroRuntimeShared(app_);
  const normalizeKey = typeof normalizeOrderKeyLocal === "function"
    ? normalizeOrderKeyLocal
    : normalizeOrderKeyDefault;
  return {
    loadVaultModule: (vaultPath, forceReload) => shared.loadVaultModule(app_, vaultPath, forceReload),
    loadVaultModuleBridgeShared: () => shared.loadVaultModuleBridgeShared(app_),
    loadRuntimePreloadFacade: () => shared.loadRuntimePreloadFacade(app_),
    loadMacroShared: () => shared.loadMacroShared(app_),
    loadRulesRuntimeHelpers: () => shared.loadRulesRuntimeHelpers(app_),
    loadLinePipeline: () => shared.loadLinePipeline(app_),
    loadOrderKeyNormalizer: () => shared.loadOrderKeyNormalizer(app_, normalizeKey),
    loadPkmOptionKeys: () => shared.loadPkmOptionKeys(app_),
  };
}

module.exports = {
  MACRO_RUNTIME_SHARED_PATH,
  RUNTIME_CACHE_KEY,
  loadMacroRuntimeShared,
  bootstrapMacroRuntime,
};
