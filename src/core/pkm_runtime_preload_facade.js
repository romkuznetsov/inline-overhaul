"use strict";

function reportLoaderFallback(stage, err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return;
    const msg = err && err.message ? String(err.message) : String(err || "");
    console.warn(`[inline-overhaul][loader] ${stage}: ${msg}`);
  } catch (_) {}
}

async function loadRuntimeBootstrap(app_, loadVaultModule) {
  globalThis.__inlineRuntimeBootstrap ??= null;
  if (globalThis.__inlineRuntimeBootstrap) return globalThis.__inlineRuntimeBootstrap;
  try {
    const mod = await loadVaultModule(app_, ".obsidian/plugins/inline-overhaul/src/core/pkm_runtime_bootstrap.js", false);
    if (mod && typeof mod.loadSharedModule === "function" && typeof mod.loadOrderKeyNormalizer === "function" && typeof mod.loadVaultModuleBridgeShared === "function") {
      globalThis.__inlineRuntimeBootstrap = mod;
      return mod;
    }
  } catch (e) {
    reportLoaderFallback("pkm_runtime_preload_facade.loadRuntimeBootstrap", e);
  }
  return null;
}

async function loadVaultModuleBridgeShared(app_, loadVaultModule) {
  const bootstrap = await loadRuntimeBootstrap(app_, loadVaultModule);
  if (bootstrap && typeof bootstrap.loadVaultModuleBridgeShared === "function") {
    return bootstrap.loadVaultModuleBridgeShared(app_, loadVaultModule);
  }
  return null;
}

async function loadOrderKeyNormalizer(app_, loadVaultModule, fallbackNormalize) {
  const bootstrap = await loadRuntimeBootstrap(app_, loadVaultModule);
  if (bootstrap && typeof bootstrap.loadOrderKeyNormalizer === "function") {
    return bootstrap.loadOrderKeyNormalizer(app_, loadVaultModule, fallbackNormalize);
  }
  globalThis.__inlineOrderKeyNormalizer = typeof fallbackNormalize === "function" ? fallbackNormalize : ((k) => String(k || "").trim());
  return globalThis.__inlineOrderKeyNormalizer;
}

async function loadLinePipeline(app_, loadVaultModule) {
  const bootstrap = await loadRuntimeBootstrap(app_, loadVaultModule);
  if (bootstrap && typeof bootstrap.loadSharedModule === "function") {
    return bootstrap.loadSharedModule(
      app_,
      loadVaultModule,
      "__inlineLinePipeline",
      ".obsidian/plugins/inline-overhaul/src/core/line_pipeline.js",
      (mod) => typeof mod.splitSegments === "function" && typeof mod.buildFromSegments === "function"
    );
  }
  return null;
}

async function loadMacroShared(app_, loadVaultModule) {
  const bootstrap = await loadRuntimeBootstrap(app_, loadVaultModule);
  if (bootstrap && typeof bootstrap.loadSharedModule === "function") {
    return bootstrap.loadSharedModule(
      app_,
      loadVaultModule,
      "__inlinePkmMacroShared",
      ".obsidian/plugins/inline-overhaul/src/core/pkm_macro_shared.js",
      (mod) => typeof mod.normalizeCycleEndBehavior === "function"
    );
  }
  return null;
}

async function loadRulesRuntimeHelpers(app_, loadVaultModule) {
  const bootstrap = await loadRuntimeBootstrap(app_, loadVaultModule);
  if (bootstrap && typeof bootstrap.loadSharedModule === "function") {
    return bootstrap.loadSharedModule(
      app_,
      loadVaultModule,
      "__inlinePkmRulesHelpers",
      ".obsidian/plugins/inline-overhaul/src/core/pkm_rules_runtime_helpers.js",
      (mod) => typeof mod.parseOrderConfig === "function"
    );
  }
  return null;
}

async function resolveOrderConfig(app_, settings, options, loadVaultModule) {
  const opts = options && typeof options === "object" ? options : {};
  const bootstrap = await loadRuntimeBootstrap(app_, loadVaultModule);
  if (bootstrap && typeof bootstrap.resolveOrderConfig === "function") {
    return bootstrap.resolveOrderConfig(app_, settings, opts);
  }
  throw new Error("pkm_runtime_bootstrap unavailable: resolveOrderConfig");
}

module.exports = {
  loadRuntimeBootstrap,
  loadVaultModuleBridgeShared,
  loadOrderKeyNormalizer,
  loadLinePipeline,
  loadMacroShared,
  loadRulesRuntimeHelpers,
  resolveOrderConfig,
};
