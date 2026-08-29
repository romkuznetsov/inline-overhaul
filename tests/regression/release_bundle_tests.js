"use strict";

const assert = require("assert");
const fs = require("fs");
const Module = require("module");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const pluginPrefix = ".obsidian/plugins/inline-overhaul/";

function walkJs(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith(".js") ? [target] : [];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => (
    walkJs(path.join(target, entry.name))
  ));
}

function canonicalPluginPath(value) {
  let out = String(value || "").replace(/\\/g, "/");
  while (out.startsWith("./")) out = out.slice(2);
  if (out.startsWith("plugins/inline-overhaul/")) out = ".obsidian/" + out;
  const marker = out.indexOf(pluginPrefix);
  return marker >= 0 ? out.slice(marker) : out;
}

function collectRuntimeVaultPaths() {
  const files = [
    path.join(root, "main.js"),
    path.join(root, "navigation_runtime.js"),
    path.join(root, "pkm_runtime_v2.js"),
    ...walkJs(path.join(root, "pkm_v2")),
    ...walkJs(path.join(root, "src")),
  ];
  const pattern = /(?:\.\/)?(?:\.obsidian\/)?plugins\/inline-overhaul\/[^"'`\s]+\.js(?=["'`])/g;
  const found = new Set();
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.match(pattern) || []) found.add(canonicalPluginPath(match));
  }
  return found;
}

function collectRegistryPaths() {
  const source = fs.readFileSync(path.join(root, "build", "release_entry.js"), "utf8");
  const pattern = /["'](\.obsidian\/plugins\/inline-overhaul\/[^"']+\.js)["']\s*:/g;
  return new Set(Array.from(source.matchAll(pattern), (match) => match[1]));
}

async function run() {
  const runtimePaths = collectRuntimeVaultPaths();
  const registryPaths = collectRegistryPaths();
  const missing = Array.from(runtimePaths).filter((item) => !registryPaths.has(item)).sort();
  assert.deepStrictEqual(missing, [], `release registry missing runtime vault paths:\n${missing.join("\n")}`);

  const bridge = require(path.join(root, "src", "core", "vault_module_bridge.js"));
  const previousRegistry = globalThis.__inlineOverhaulBundledVaultModules;
  const sentinel = { bundled: true };
  globalThis.__inlineOverhaulBundledVaultModules = new Map([
    [`${pluginPrefix}src/core/shared_utils.js`, sentinel],
  ]);
  try {
    globalThis.__releaseBundleTestCache = new Map([
      ["./plugins/inline-overhaul/src/core/shared_utils.js", { stale: true }],
    ]);
    const loaded = await bridge.loadVaultModule({
      vault: {
        getAbstractFileByPath() { throw new Error("vault fallback must not run"); },
      },
    }, "./plugins/inline-overhaul/src/core/shared_utils.js", true, "__releaseBundleTestCache");
    assert.strictEqual(loaded, sentinel, "bundled registry wins over stale global module cache");

    const reloadedSentinel = { bundled: "reloaded" };
    globalThis.__inlineOverhaulBundledVaultModules.set(`${pluginPrefix}src/core/shared_utils.js`, reloadedSentinel);
    const reloaded = await bridge.loadVaultModule({
      vault: {
        getAbstractFileByPath() { throw new Error("vault fallback must not run on hot reload"); },
      },
    }, "./plugins/inline-overhaul/src/core/shared_utils.js", false, "__releaseBundleTestCache");
    assert.strictEqual(reloaded, reloadedSentinel, "updated bundled registry wins without forceReload");
  } finally {
    globalThis.__inlineOverhaulBundledVaultModules = previousRegistry;
    delete globalThis.__releaseBundleTestCache;
  }

  const dist = path.join(root, "dist");
  const distMain = path.join(dist, "main.js");
  assert.ok(fs.existsSync(distMain), "dist/main.js exists");
  assert.ok(fs.existsSync(path.join(dist, "manifest.json")), "dist/manifest.json exists");
  assert.ok(!fs.existsSync(path.join(dist, "data.json")), "dist excludes data.json");
  assert.ok(fs.readFileSync(path.join(root, ".gitignore"), "utf8").split(/\r?\n/).includes("data.json"), ".gitignore excludes local data.json");
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(path.join(dist, "manifest.json"), "utf8")),
    JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")),
    "release manifest matches source manifest"
  );
  const sourceStyles = path.join(root, "styles.css");
  assert.strictEqual(fs.existsSync(path.join(dist, "styles.css")), fs.existsSync(sourceStyles), "styles.css copied only when source exists");
  const expectedAssets = sourceStyles && fs.existsSync(sourceStyles)
    ? ["main.js", "manifest.json", "styles.css"]
    : ["main.js", "manifest.json"];
  assert.deepStrictEqual(fs.readdirSync(dist).sort(), expectedAssets.sort(), "dist contains only BRAT release assets");

  const bundledSource = fs.readFileSync(distMain, "utf8");
  assert.ok(!/PrivateTaxonomySentinel/.test(bundledSource), "bundle contains no hardcoded private taxonomy sentinel");
  assert.ok(!/require\(["']\.\.?\//.test(bundledSource), "bundle has no local runtime require calls");
  const allowedExternals = new Set(["obsidian", "@codemirror/view", "@codemirror/state"]);
  const bundledRequires = Array.from(bundledSource.matchAll(/require\(["']([^"']+)["']\)/g), (match) => match[1]);
  const unexpectedRequires = Array.from(new Set(bundledRequires.filter((item) => !allowedExternals.has(item)))).sort();
  assert.deepStrictEqual(unexpectedRequires, [], `bundle has unexpected external requires: ${unexpectedRequires.join(", ")}`);

  /*
   * Панель настроек теперь одна: старая удалена 2026-08-29. Значит собранный
   * файл обязан её содержать — иначе у человека не будет настроек вовсе, а
   * гейты этого не увидят: они гоняют исходники на заглушке, а не сборку.
   *
   * Признаки выбраны такие, которых больше нигде нет: заголовок группы из
   * схемы, фраза панели про версию Obsidian и класс своей вёрстки.
   */
  const paneMarks = [
    "Binder (custom insert commands)",
    "settings need Obsidian 1.13 or newer",
    "io-fieldsblock",
  ];
  for (const mark of paneMarks) {
    assert.ok(bundledSource.includes(mark), `bundle contains the settings pane: ${mark}`);
  }

  /*
   * И наоборот: старой панели в сборке остаться не должно. Признаки — только
   * имена из кода: её видимые тексты живут дальше в `searchTerms` новой схемы
   * (С4), и искать по ним значило бы искать не то.
   */
  const goneMarks = [
    "renderPkmConfigSections",
    "renderSettingsDisplaySection",
    "createSettingsSectionsRendererFallback",
    "hasValidSettingsSectionsRenderer",
  ];
  for (const mark of goneMarks) {
    assert.ok(!bundledSource.includes(mark), `bundle no longer contains the old pane: ${mark}`);
  }

  const originalLoad = Module._load;
  const baseClass = class {};
  Module._load = function (request, parent, isMain) {
    if (request === "obsidian") {
      return {
        Plugin: baseClass,
        PluginSettingTab: baseClass,
        Setting: baseClass,
        Notice: baseClass,
        Modal: baseClass,
        MarkdownView: baseClass,
        setIcon() {},
      };
    }
    if (request === "@codemirror/view") return { WidgetType: baseClass };
    if (request === "@codemirror/state") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve(distMain)];
    const PluginExport = require(distMain);
    assert.strictEqual(typeof PluginExport, "function", "bundle exports plugin class");
    assert.ok(globalThis.__inlineOverhaulBundledVaultModules instanceof Map, "bundle initializes vault-module registry");
    for (const runtimePath of runtimePaths) {
      assert.ok(globalThis.__inlineOverhaulBundledVaultModules.has(runtimePath), `bundle registry contains ${runtimePath}`);
    }
    const staleBridge = { loadVaultModule() { return { stale: true }; } };
    globalThis.__inlineVaultModuleBridge = staleBridge;
    globalThis.__inlineOverhaulMainModuleCache = new Map([["stale", true]]);
    delete require.cache[require.resolve(distMain)];
    require(distMain);
    assert.notStrictEqual(globalThis.__inlineVaultModuleBridge, staleBridge, "bundle reload replaces stale global bridge");
    assert.strictEqual(
      globalThis.__inlineVaultModuleBridge,
      globalThis.__inlineOverhaulBundledVaultModules.get(`${pluginPrefix}src/core/vault_module_bridge.js`),
      "bundle reload publishes current bundled bridge"
    );
    assert.strictEqual(globalThis.__inlineOverhaulMainModuleCache.size, 0, "bundle reload clears stale global module cache");
  } finally {
    Module._load = originalLoad;
  }

  console.log(`Release bundle regression tests: OK (${runtimePaths.size} runtime vault paths covered)`);
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
