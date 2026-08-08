"use strict";

function reportLoaderFallback(stage, err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return;
    const msg = err && err.message ? String(err.message) : String(err || "");
    console.warn(`[inline-overhaul][loader] ${stage}: ${msg}`);
  } catch (_) {}
}

const BUNDLED_REGISTRY_KEY = "__inlineOverhaulBundledVaultModules";
const PLUGIN_PATH_PREFIX = ".obsidian/plugins/inline-overhaul/";

function normalizeVaultModulePath(vaultPath) {
  let path = String(vaultPath || "").trim().replace(/\\/g, "/");
  while (path.startsWith("./")) path = path.slice(2);
  if (path.startsWith("plugins/inline-overhaul/")) path = ".obsidian/" + path;
  const marker = path.indexOf(PLUGIN_PATH_PREFIX);
  return marker >= 0 ? path.slice(marker) : path;
}

function getBundledVaultModule(vaultPath) {
  const registry = globalThis[BUNDLED_REGISTRY_KEY];
  const path = normalizeVaultModulePath(vaultPath);
  if (registry instanceof Map && registry.has(path)) {
    return { found: true, value: registry.get(path) };
  }
  if (registry && typeof registry === "object" && Object.prototype.hasOwnProperty.call(registry, path)) {
    return { found: true, value: registry[path] };
  }
  return { found: false, value: undefined };
}

async function loadVaultModule(app_, vaultPath, forceReload, cacheKey) {
  const key = String(cacheKey || "__pkmModuleCache");
  globalThis[key] ??= new Map();
  if (forceReload) globalThis[key].delete(vaultPath);

  const bundled = getBundledVaultModule(vaultPath);
  if (bundled.found) {
    globalThis[key].set(vaultPath, bundled.value);
    return bundled.value;
  }
  if (globalThis[key].has(vaultPath)) return globalThis[key].get(vaultPath);

  const src = String(vaultPath || "").trim();
  const candidates = [];
  const push = (p) => {
    const v = String(p || "").trim();
    if (!v || candidates.includes(v)) return;
    candidates.push(v);
  };
  push(src);
  if (src.startsWith("./")) push(src.slice(2));
  else push("./" + src);
  if (src.includes("/")) push(src.slice(src.lastIndexOf("/") + 1));

  let code = "";
  let found = false;
  const adapter = app_ && app_.vault ? app_.vault.adapter : null;
  for (const p of candidates) {
    const af = app_.vault.getAbstractFileByPath(p);
    if (af) {
      code = await app_.vault.read(af);
      found = true;
      break;
    }
    if (adapter && typeof adapter.read === "function") {
      try {
        code = await adapter.read(p);
        found = true;
        break;
      } catch (e) {
        reportLoaderFallback(`vault_module_bridge.adapter.read:${p}`, e)
      }
    }
  }
  if (!found) throw new Error("Module file not found in vault: " + vaultPath);

  const module = { exports: {} };
  const exports = module.exports;
  const fn = new Function("module", "exports", "app", "Notice", `${code}\n;return module.exports;`);
  const out = fn(module, exports, app_, globalThis.Notice);
  globalThis[key].set(vaultPath, out);
  return out;
}

module.exports = {
  BUNDLED_REGISTRY_KEY,
  normalizeVaultModulePath,
  loadVaultModule,
};
