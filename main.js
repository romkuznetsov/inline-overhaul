"use strict";

const { Plugin, PluginSettingTab, Setting, Notice, Modal, setIcon } = require("obsidian");
const cmView = require("@codemirror/view");
const cmState = require("@codemirror/state");

let __priorityStripEngine = {
  buildStripSpecs: () => [],
  normalizeStripConfig: (x) => x || {},
};
let __priorityStripCm6Adapter = {
  buildStripDecorationRanges: () => [],
};
let __priorityStripEngineIsStub = true;
let __priorityStripCm6AdapterIsStub = true;

const __sharedUtilsFallback = {
  cloneJson(x) {
    return JSON.parse(JSON.stringify(x));
  },
  isObj(x) {
    return x && typeof x === "object" && !Array.isArray(x);
  },
  deepMerge(base, patch) {
    const isObj = __sharedUtilsFallback.isObj;
    const cloneJson = __sharedUtilsFallback.cloneJson;
    if (!isObj(base)) return cloneJson(patch);
    const out = cloneJson(base);
    if (!isObj(patch)) return out;
    for (const k of Object.keys(patch)) {
      const bv = out[k];
      const pv = patch[k];
      if (isObj(bv) && isObj(pv)) out[k] = __sharedUtilsFallback.deepMerge(bv, pv);
      else out[k] = cloneJson(pv);
    }
    return out;
  },
  parseJsonFence(md, fenceName, required) {
    const src = String(md || "");
    const re = new RegExp("```" + fenceName + "\\s*([\\s\\S]*?)```");
    const m = src.match(re);
    if (!m) {
      if (required) throw new Error("Fence not found: " + fenceName);
      return null;
    }
    try {
      return JSON.parse(String(m[1] || "").trim());
    } catch (e) {
      throw new Error("Invalid JSON in fence `" + fenceName + "`: " + e.message);
    }
  },
  toPrettyJson(x) {
    return JSON.stringify(x, null, 2);
  },
};

let __sharedUtils = __sharedUtilsFallback;
try {
  const mod = require("./src/core/shared_utils.js");
  if (mod && typeof mod === "object") {
    const ok = [
      "cloneJson",
      "isObj",
      "deepMerge",
      "parseJsonFence",
      "toPrettyJson",
      "nz",
      "escapeRe",
      "normalizeFormatMask",
      "buildFormatValueRegexSource",
      "hasFormatTokens",
      "parseNumericLiteralSpec",
      "parseNumericPatternSpec",
      "buildNumericPatternRegexSource",
      "renderNumericPatternValue",
      "parseNumericPatternProgress",
      "renderTokenlessValueByProgress",
      "buildTokenlessValueRegexSource",
      "parseTokenlessProgress",
      "parseHhmm",
      "addMinutesHhmm",
      "formatNowByMask",
      "buildCustomPlanFromIncrement",
      "forwardStepByCurrent",
      "backwardStepByCurrent",
      "getSearchLimitByUnit",
      "detectDateUnit",
    ]
      .every((k) => typeof mod[k] === "function");
    if (ok) __sharedUtils = mod;
  }
} catch (e) {
  // Silent in Obsidian sandbox: fallback helpers are expected in this path.
}
try { globalThis.__inlineOverhaulSharedUtils = __sharedUtils; } catch (_) {}

const __pkmOptionKeys = (() => {
  try {
    const mod = require("./src/core/pkm_option_keys.js");
    if (mod && typeof mod === "object" && mod.KEYS && typeof mod.KEYS === "object") return mod;
  } catch (_) {}
  return {
    DEFAULT_RULES_PATH: "InlineOverhaul_Generated_RULES_TagWheel.md",
    KEYS: {
      RULES_PATH: "Rules path",
      ACTION_TYPE: "Action type",
      SUBTAG_FORMAT: "Subtag format",
      CYCLE_END_BEHAVIOR: "Cycle end behavior",
      CURSOR_POLICY: "Cursor policy",
      ORDER_CONFIG: "Order config",
      DIRECTION: "Direction",
      DATE_RUNTIME_CONFIG: "Date runtime config",
      TAGWHEEL_SCROLLER_ENABLED: "TagWheel scroller enabled",
      TAGWHEEL_SCROLLER_DIRECTION: "TagWheel scroller direction",
      TAGWHEEL_SCROLLER_SIZE: "TagWheel scroller size",
    },
  };
})();

const __pkmDomainRegistry = (() => {
  try {
    const mod = require("./src/core/pkm_domain_registry.js");
    if (mod && typeof mod === "object") return mod;
  } catch (_) {}
  return {
    inferOrderFieldType: () => "tag",
    inferSubFieldKey: (parentKey) => {
      const p = String(parentKey || "").trim();
      return p ? `${p}_sub` : "";
    },
  };
})();

const __compatProfile = (() => {
  try {
    const mod = require("./src/core/compat_profile.js");
    if (mod && typeof mod === "object") return mod;
  } catch (_) {}
  return {
    COMPAT_FLAGS: {
      ENABLE_CONFIG_MIGRATION_SHIMS: true,
    },
    DEPRECATED_CONFIG_KEYS: {
      rules: ["tagWheelPath"],
      pkm: ["sourceOfTruth", "autoGenerateRules"],
      devMode: ["logLevel", "maxFileSizeKb", "maxRecords", "logSize"],
      navigation: ["topRevealOffsetLines"],
    },
    isCompatEnabled(flag) {
      const key = String(flag || "").trim();
      if (!key) return false;
      return this.COMPAT_FLAGS[key] === true;
    },
  };
})();

let __commandRegistry = null;
let __settingsTabRouter = null;
let __settingsSectionsRenderer = null;
let __orderDeepEditorState = null;
let __configNoteOrchestrator = null;
let __tagWheelConfigCodec = null;
let __tagWheelConfigParser = null;
let __rulesMarkdownBuilder = null;
let __configNoteHelpers = null;
let __enhancedSelectAllEngine = null;
let __storeEventsOrchestrator = null;
let __configStoreModule = null;
let __configMigrationModule = null;
let __rulesSyncOrchestrator = null;
let __transformFeature = null;
let __transformLineFinalize = null;
try {
  const mod = require("./src/core/pkm_line_finalize_unified.js");
  if (mod && typeof mod.buildPrefixUnified === "function") __transformLineFinalize = mod;
} catch (_) {}
let __safeModuleCache = new Map();
let __settingsSectionsRendererDiag = "";

function reportLoaderFallback(stage, err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return;
    const msg = err && err.message ? String(err.message) : String(err || "");
    console.warn(`[inline-overhaul][loader] ${stage}: ${msg}`);
  } catch (_) {}
}

function denormTagToken(token) {
  let value = String(token || "").trim();
  if (!value) return "";
  if (value.charAt(0) === "#") value = value.slice(1);
  return String(value || "").trim();
}

function isWikilinkToken(text) {
  const raw = String(text || "").trim();
  return /^\[\[[^\]]+\]\]$/.test(raw);
}

function parseWikilinkLineStrict(text, sectionName, lineNo, allowedFields, options) {
  const raw = String(text || "").trim();
  const m = raw.match(/^(\[\[[^\]]+\]\])(?:\s*-\s*([A-Za-z0-9_-]+))?$/);
  if (!m) {
    throw new Error(`Section #### ${sectionName}, line ${lineNo}: expected wikilink '[[...]] - fieldId'`);
  }
  const token = String(m[1] || "").trim();
  const allowed = Array.isArray(allowedFields)
    ? allowedFields.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const opts = options && typeof options === "object" ? options : {};
  const requireExplicitFieldId = opts.requireExplicitFieldId === true;
  if (!allowed.length) {
    throw new Error(`Section #### ${sectionName}, line ${lineNo}: no wikilink fields are configured`);
  }
  let fieldId = String(m[2] || "").trim();
  if (requireExplicitFieldId && !fieldId) {
    throw new Error(`Section #### ${sectionName}, line ${lineNo}: field id is required for wikilink in mixed tag/wikilink section`);
  }
  if (!fieldId) {
    if (allowed.length === 1) fieldId = allowed[0];
    else if (allowed.length > 1) {
      throw new Error(`Section #### ${sectionName}, line ${lineNo}: field id is required for wikilink when multiple fields are available (${allowed.join(", ")})`);
    }
  }
  if (!fieldId) {
    throw new Error(`Section #### ${sectionName}, line ${lineNo}: missing wikilink field id`);
  }
  if (allowed.length && !allowed.includes(fieldId)) {
    throw new Error(`Section #### ${sectionName}, line ${lineNo}: unknown wikilink field '${fieldId}'`);
  }
  return { token, fieldId };
}

function extractFirstTagToken(text) {
  const raw = String(text || "");
  const m = raw.match(/#[^\s#]+/);
  return m ? String(m[0] || "").trim() : "";
}

function parseCheckboxAndTag(text) {
  const raw = String(text || "");
  const m = raw.match(/^\s*(?:[-*]\s*)?(\[[^\]]+\])\s+/);
  let checkbox = "";
  if (m) {
    const token = String(m[1] || "").trim();
    try {
      const lf = require("./src/core/pkm_line_finalize_unified.js");
      if (lf && typeof lf.normalizeCheckboxToken === "function") checkbox = lf.normalizeCheckboxToken(token);
    } catch (_) {
      checkbox = token;
    }
  }
  return {
    checkbox,
    tag: extractFirstTagToken(raw),
  };
}

async function readVaultText(app, path) {
  const safePath = String(path || "").trim();
  if (!safePath) throw new Error("Vault read failed: empty path");
  const vault = app && app.vault;
  if (!vault || typeof vault.getAbstractFileByPath !== "function" || typeof vault.read !== "function") {
    throw new Error("Vault read failed: vault API unavailable");
  }
  const file = vault.getAbstractFileByPath(safePath);
  if (!file) throw new Error("Vault file not found: " + safePath);
  return await vault.read(file);
}

function extractFieldMetaMap(field) {
  const values = field && Array.isArray(field.values) ? field.values : [];
  const out = {};
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!isObj(v)) continue;
    const token = denormTagToken(v.token);
    if (!token) continue;
    const meta = cloneJson(v);
    delete meta.token;
    out[token] = meta;
  }
  return out;
}

function rebuildTagValues(parentTokens, metaByToken) {
  const tokens = Array.isArray(parentTokens) ? parentTokens : [];
  const metaMap = isObj(metaByToken) ? metaByToken : {};
  const out = [];
  const seen = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const token = denormTagToken(tokens[i]);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    const meta = isObj(metaMap[token]) ? cloneJson(metaMap[token]) : {};
    delete meta.allowedParentValues;
    out.push({
      ...meta,
      token,
      active: typeof meta.active === "boolean" ? meta.active : true,
    });
  }
  return out;
}

function rebuildSubtagValues(parents, metaByToken) {
  const src = Array.isArray(parents) ? parents : [];
  const metaMap = isObj(metaByToken) ? metaByToken : {};
  const byToken = {};
  const order = [];

  for (let i = 0; i < src.length; i++) {
    const parent = isObj(src[i]) ? src[i] : {};
    const parentToken = denormTagToken(parent.token);
    if (!parentToken) continue;
    const subtags = Array.isArray(parent.subtags) ? parent.subtags : [];
    for (let si = 0; si < subtags.length; si++) {
      const subToken = denormTagToken(subtags[si]);
      if (!subToken) continue;
      if (!Object.prototype.hasOwnProperty.call(byToken, subToken)) {
        byToken[subToken] = new Set();
        order.push(subToken);
      }
      byToken[subToken].add(parentToken);
    }
  }

  const out = [];
  for (let i = 0; i < order.length; i++) {
    const token = order[i];
    const meta = isObj(metaMap[token]) ? cloneJson(metaMap[token]) : {};
    const allowedParentValues = Array.from(byToken[token]);
    out.push({
      ...meta,
      token,
      allowedParentValues,
      active: typeof meta.active === "boolean" ? meta.active : true,
    });
  }
  return out;
}

function hasValidCommandRegistry(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.buildCoreCommandDefs === "function"
    && typeof mod.buildNavigationCommandDefs === "function"
    && typeof mod.buildPkmCommandDefs === "function"
    && typeof mod.buildConfigCommandDefs === "function"
    && typeof mod.buildBinderCommandDefs === "function");
}

function hasValidTransformFeature(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.normalizeInline2Note === "function"
    && typeof mod.normalizeTransformConfig === "function"
    && typeof mod.renderTransformSettings === "function"
    && typeof mod.runInline2Note === "function");
}

async function loadCommandRegistrySafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/features/command_registry.js",
    "./.obsidian/plugins/inline-overhaul/src/features/command_registry.js",
    "plugins/inline-overhaul/src/features/command_registry.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/features/command_registry.js",
    candidates,
    cacheKey: "feature:command-registry",
    validate: hasValidCommandRegistry,
  });
  if (loaded.mod) {
    __commandRegistry = loaded.mod;
    return __commandRegistry;
  }

  __commandRegistry = {
    buildCoreCommandDefs: () => [],
    buildNavigationCommandDefs: () => [],
    buildPkmCommandDefs: () => [],
    buildConfigCommandDefs: () => [],
    buildBinderCommandDefs: () => [],
  };
  return __commandRegistry;
}

function getCommandRegistry() {
  if (hasValidCommandRegistry(__commandRegistry)) return __commandRegistry;
  return {
    buildCoreCommandDefs: () => [],
    buildNavigationCommandDefs: () => [],
    buildPkmCommandDefs: () => [],
    buildConfigCommandDefs: () => [],
    buildBinderCommandDefs: () => [],
  };
}

async function loadTransformFeatureSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/features/transform_feature.js",
    "./.obsidian/plugins/inline-overhaul/src/features/transform_feature.js",
    "plugins/inline-overhaul/src/features/transform_feature.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/features/transform_feature.js",
    candidates,
    cacheKey: "feature:transform",
    validate: hasValidTransformFeature,
  });
  if (loaded.mod) {
    __transformFeature = loaded.mod;
    return __transformFeature;
  }
  __transformFeature = {
    normalizeInline2Note: () => ({ enabled: false }),
    normalizeTransformConfig: (cfg) => cfg,
    renderTransformSettings: (ctx) => {
      const { containerEl } = ctx || {};
      if (containerEl && typeof containerEl.createEl === "function") {
        const p = containerEl.createEl("p", { text: "Transform feature module unavailable." });
        p.style.opacity = "0.8";
      }
    },
    runInline2Note: async (plugin) => {
      if (plugin && typeof plugin.notice === "function") plugin.notice("InlineOverhaul: transform module unavailable");
    },
  };
  return __transformFeature;
}

function getTransformFeature() {
  if (hasValidTransformFeature(__transformFeature)) return __transformFeature;
  return {
    normalizeInline2Note: () => ({ enabled: false }),
    normalizeTransformConfig: (cfg) => cfg,
    renderTransformSettings: () => {},
    runInline2Note: async () => {},
  };
}

const BINDER_SMART_BRACKET_COMMAND_ID = "inlineOverhaul_Binder_Smart_bracket";

function makeBinderCommandSuffix(text) {
  const src = String(text || "").trim();
  if (!src) return "item";
  const collapsed = src.replace(/\s+/g, "_");
  const cleaned = collapsed
    .replace(/[^A-Za-z0-9_\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "item";
}

function makeBinderCommandId(seedText, used) {
  const usedSet = used instanceof Set ? used : new Set();
  const base = `inlineOverhaul_Binder_${makeBinderCommandSuffix(seedText)}`;
  let candidate = base;
  let i = 2;
  while (usedSet.has(candidate)) {
    candidate = `${base}_${i}`;
    i += 1;
  }
  usedSet.add(candidate);
  return candidate;
}

function normalizeBinderRows(rawRows) {
  const source = Array.isArray(rawRows) ? rawRows : [];
  const out = [];
  const used = new Set([BINDER_SMART_BRACKET_COMMAND_ID]);
  let hasSmartBracket = false;

  for (const row of source) {
    const obj = isObj(row) ? row : {};
    const insertText = String(obj.insertText || "");
    const commandName = String(obj.commandName || "");
    const description = String(obj.description || "");
    const rowId = String(obj.rowId || "").trim() || `binder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const existingId = String(obj.commandId || "").trim();

    if (existingId === "inlineOverhaul_Binder_InsertBrackets" || existingId === "inlineOverhaul_Binder_Bracket_right" || String(insertText || "").trim() === "InsertBrackets" || String(insertText || "").trim() === "]") continue;

    let normalizedId = "";
    if (existingId === BINDER_SMART_BRACKET_COMMAND_ID || existingId === "inlineOverhaul_Binder_Bracket_left") {
      normalizedId = BINDER_SMART_BRACKET_COMMAND_ID;
      hasSmartBracket = true;
      out.push({
        rowId: "binder-system-smart-bracket",
        insertText: "[]",
        commandName: "Smart bracket",
        description: "Smart bracket",
        commandId: BINDER_SMART_BRACKET_COMMAND_ID,
      });
      continue;
    } else {
      const seed = String(commandName || "").trim() || String(insertText || "").trim() || existingId;
      normalizedId = existingId
        ? (used.has(existingId) ? makeBinderCommandId(seed, used) : (used.add(existingId), existingId))
        : makeBinderCommandId(seed, used);
    }
    out.push({ rowId, insertText, commandName, description, commandId: normalizedId });
  }

  if (!hasSmartBracket) {
    out.unshift({
      rowId: "binder-system-smart-bracket",
      insertText: "[]",
      commandName: "Smart bracket",
      description: "Smart bracket",
      commandId: BINDER_SMART_BRACKET_COMMAND_ID,
    });
  }

  return out;
}

function hasValidSettingsTabRouter(mod) {
  return !!(mod && typeof mod === "object" && typeof mod.renderSettingsTabContent === "function");
}

function hasValidSettingsSectionsRenderer(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.renderSettingsDisplaySection === "function"
    && typeof mod.renderTabBarSection === "function"
    && typeof mod.renderGeneralSection === "function"
    && typeof mod.renderHotkeysTabSection === "function"
    && typeof mod.renderModuleTabSection === "function"
    && typeof mod.renderVisualTabSection === "function"
    && typeof mod.renderPkmOrderBoardSection === "function"
    && typeof mod.renderPkmConfigSections === "function"
    && typeof mod.renderNavigationSettings === "function"
    && typeof mod.renderVisualGeneralSection === "function"
    && typeof mod.renderColorsSection === "function"
    && typeof mod.renderAdvancedSection === "function");
}

function hasValidOrderDeepEditorState(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.buildTagTree === "function"
    && typeof mod.applyTagTreeToFields === "function"
    && typeof mod.createHistory === "function"
    && typeof mod.pushHistory === "function"
    && typeof mod.undoHistory === "function"
    && typeof mod.redoHistory === "function"
    && typeof mod.resetHistory === "function");
}

async function ensureOrderDeepEditorStateSafe(app) {
  if (hasValidOrderDeepEditorState(__orderDeepEditorState)) {
    try { globalThis.__inlineOrderDeepEditorState = __orderDeepEditorState; } catch (_) {}
    return __orderDeepEditorState;
  }
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/core/order_deep_editor_state.js",
    "./.obsidian/plugins/inline-overhaul/src/core/order_deep_editor_state.js",
    "plugins/inline-overhaul/src/core/order_deep_editor_state.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/core/order_deep_editor_state.js",
    candidates,
    cacheKey: "core:order-deep-editor-state",
    validate: hasValidOrderDeepEditorState,
    loadErrorPrefix: "[inline-overhaul] Failed to load order_deep_editor_state from",
  });
  if (loaded.mod) {
    __orderDeepEditorState = loaded.mod;
    try { globalThis.__inlineOrderDeepEditorState = __orderDeepEditorState; } catch (_) {}
    return __orderDeepEditorState;
  }
  if (loaded.requireErr) {
    reportLoaderFallback("main.ensureOrderDeepEditorStateSafe.require", loaded.requireErr);
  }
  return null;
}

function getMissingSettingsSectionsRendererMethods(mod) {
  const required = [
    "renderSettingsDisplaySection",
    "renderTabBarSection",
    "renderGeneralSection",
    "renderHotkeysTabSection",
    "renderModuleTabSection",
    "renderVisualTabSection",
    "renderPkmOrderBoardSection",
    "renderPkmConfigSections",
    "renderNavigationSettings",
    "renderVisualGeneralSection",
    "renderColorsSection",
    "renderAdvancedSection",
  ];
  const target = mod && typeof mod === "object" ? mod : {};
  return required.filter((k) => typeof target[k] !== "function");
}

async function loadSettingsTabRouterSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/ui/settings_tab_router.js",
    "./.obsidian/plugins/inline-overhaul/src/ui/settings_tab_router.js",
    "plugins/inline-overhaul/src/ui/settings_tab_router.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/ui/settings_tab_router.js",
    candidates,
    cacheKey: "ui:settings-tab-router",
    validate: hasValidSettingsTabRouter,
    uiVaultEvalFallback: true,
  });
  if (loaded.mod) {
    __settingsTabRouter = loaded.mod;
    return __settingsTabRouter;
  }

  const fallbackCandidates = [
    ".obsidian/plugins/inline-overhaul/src/ui/settings_tab_router_fallback.js",
    "./.obsidian/plugins/inline-overhaul/src/ui/settings_tab_router_fallback.js",
    "plugins/inline-overhaul/src/ui/settings_tab_router_fallback.js",
  ];
  const fallbackLoaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/ui/settings_tab_router_fallback.js",
    candidates: fallbackCandidates,
    cacheKey: "ui:settings-tab-router-fallback",
    validate: (mod) => !!(mod && typeof mod.createSettingsTabRouterFallback === "function"),
    uiVaultEvalFallback: true,
  });
  if (fallbackLoaded.mod) {
    try {
      const fallback = fallbackLoaded.mod.createSettingsTabRouterFallback();
      if (hasValidSettingsTabRouter(fallback)) {
        __settingsTabRouter = fallback;
        return __settingsTabRouter;
      }
      reportLoaderFallback("main.loadSettingsTabRouterSafe.fallback.invalid", "invalid tab router contract");
    } catch (e) {
      reportLoaderFallback("main.loadSettingsTabRouterSafe.fallback.factory", e);
    }
  }

  __settingsTabRouter = createSettingsTabRouterFallback();
  return __settingsTabRouter;
}

function getSettingsTabRouter() {
  if (hasValidSettingsTabRouter(__settingsTabRouter)) return __settingsTabRouter;
  __settingsTabRouter = createSettingsTabRouterFallback();
  return __settingsTabRouter;
}

function createSettingsTabRouterFallback() {
  return {
    renderSettingsTabContent(tab, activeTab, containerEl, cfg) {
      if (activeTab === "general") tab.renderGeneral(containerEl, cfg);
      else if (activeTab === "hotkeys") tab.renderHotkeysTab(containerEl, cfg);
      else if (activeTab === "navigation") tab.renderModuleTab(containerEl, "navigation", cfg);
      else if (activeTab === "pkm") tab.renderModuleTab(containerEl, "pkm", cfg);
      else if (activeTab === "visual") tab.renderVisualTab(containerEl, cfg);
      else if (activeTab === "transform") tab.renderModuleTab(containerEl, "transform", cfg);
      else if (activeTab === "advanced") tab.renderAdvanced(containerEl, cfg);
    },
  };
}

async function loadSettingsSectionsRendererSafe(app) {
  __settingsSectionsRendererDiag = "";
  await ensureOrderDeepEditorStateSafe(app);
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/ui/settings_sections_renderer.js",
    "./.obsidian/plugins/inline-overhaul/src/ui/settings_sections_renderer.js",
    "plugins/inline-overhaul/src/ui/settings_sections_renderer.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/ui/settings_sections_renderer.js",
    candidates,
    cacheKey: "ui:settings-sections-renderer",
    validate: hasValidSettingsSectionsRenderer,
    uiVaultEvalFallback: true,
  });
  if (loaded.mod) {
    __settingsSectionsRenderer = loaded.mod;
    return __settingsSectionsRenderer;
  }
  if (loaded.requireErr) {
    __settingsSectionsRendererDiag = `primary require failed: ${String(loaded.requireErr && loaded.requireErr.message ? loaded.requireErr.message : loaded.requireErr)}`;
  } else {
    __settingsSectionsRendererDiag = "primary renderer unavailable: load returned no valid module";
  }

  const fallbackCandidates = [
    ".obsidian/plugins/inline-overhaul/src/ui/settings_sections_fallback.js",
    "./.obsidian/plugins/inline-overhaul/src/ui/settings_sections_fallback.js",
    "plugins/inline-overhaul/src/ui/settings_sections_fallback.js",
  ];
  const fallbackLoaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/ui/settings_sections_fallback.js",
    candidates: fallbackCandidates,
    cacheKey: "ui:settings-sections-fallback",
    validate: (mod) => !!(mod && typeof mod.createSettingsSectionsRendererFallback === "function"),
    uiVaultEvalFallback: true,
  });
  if (fallbackLoaded.mod) {
    try {
      const fallback = fallbackLoaded.mod.createSettingsSectionsRendererFallback();
      if (hasValidSettingsSectionsRenderer(fallback)) {
        __settingsSectionsRenderer = fallback;
        return __settingsSectionsRenderer;
      }
      const missing = getMissingSettingsSectionsRendererMethods(fallback);
      __settingsSectionsRendererDiag = `fallback factory invalid contract: missing [${missing.join(", ")}]`;
      reportLoaderFallback("main.loadSettingsSectionsRendererSafe.fallback.invalid", "invalid renderer contract");
    } catch (e) {
      __settingsSectionsRendererDiag = `fallback factory failed: ${String(e && e.message ? e.message : e)}`;
      reportLoaderFallback("main.loadSettingsSectionsRendererSafe.fallback.factory", e);
    }
  } else if (fallbackLoaded.requireErr) {
    __settingsSectionsRendererDiag = `fallback require failed: ${String(fallbackLoaded.requireErr && fallbackLoaded.requireErr.message ? fallbackLoaded.requireErr.message : fallbackLoaded.requireErr)}`;
  }

  __settingsSectionsRenderer = null;
  return getSettingsSectionsRenderer();
}

function getSettingsSectionsRenderer() {
  if (hasValidSettingsSectionsRenderer(__settingsSectionsRenderer)) return __settingsSectionsRenderer;
  __settingsSectionsRenderer = createSettingsSectionsRendererFallback();
  return __settingsSectionsRenderer;
}


function createSettingsSectionsRendererFallback() {
  return {
    renderSettingsDisplaySection(ctx) {
      const { containerEl, cfg, getActiveSettingsTab, renderTabBar, renderSettingsTabContent } = ctx;
      const activeTab = getActiveSettingsTab(cfg);
      containerEl.createEl("h2", { text: "InlineOverhaul" });
      containerEl.createEl("p", { text: "Fallback settings renderer is active." });
      if (__settingsSectionsRendererDiag) {
        const diag = containerEl.createDiv();
        diag.setText(`Renderer diagnostic: ${__settingsSectionsRendererDiag}`);
        diag.style.marginBottom = "8px";
        diag.style.opacity = "0.8";
        diag.style.fontSize = "12px";
      }
      renderTabBar(containerEl, activeTab);
      renderSettingsTabContent(activeTab, containerEl, cfg);
    },
    renderTabBarSection(ctx) {
      const { containerEl, activeTab, settingsTabs, setActiveSettingsTab } = ctx;
      const row = containerEl.createDiv({ cls: "inline-overhaul-tab-row" });
      row.style.display = "flex";
      row.style.flexWrap = "wrap";
      row.style.gap = "8px";
      row.style.marginBottom = "10px";
      for (const t of settingsTabs) {
        const btn = row.createEl("button", { text: t.label, cls: "mod-cta" });
        btn.style.padding = "4px 10px";
        btn.style.opacity = t.id === activeTab ? "1" : "0.8";
        btn.onclick = () => setActiveSettingsTab(t.id);
      }
    },
    renderGeneralSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "General settings are unavailable in fallback mode." });
    },
    renderHotkeysTabSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Hotkeys settings are unavailable in fallback mode." });
    },
    renderModuleTabSection(ctx) {
      const { Setting, containerEl, featureKey, cfg, renderNavigationSettings, renderPkmSettings } = ctx;
      const enabled = !!(cfg && cfg.features && cfg.features[featureKey] && cfg.features[featureKey].enabled);
      if (featureKey === "navigation") {
        renderNavigationSettings(containerEl, cfg, enabled);
      } else if (featureKey === "pkm") {
        renderPkmSettings(containerEl, cfg, enabled);
      } else {
        new Setting(containerEl)
          .setName("Module placeholder")
          .setDesc("Fallback mode")
          .addText((txt) => {
            txt.setValue("Fallback renderer");
            txt.setDisabled(true);
          });
      }
    },
    renderVisualTabSection(ctx) {
      const { containerEl, cfg, renderVisualGeneralSection, renderVisualTagsSection, renderVisualStripSection } = ctx;
      const enabled = !!(cfg && cfg.features && cfg.features.visual && cfg.features.visual.enabled);
      const activeSubTab = (cfg && cfg.ui && cfg.ui.visualSubTab) || "tags";
      if (activeSubTab === "tagwheel") {
        renderVisualGeneralSection(containerEl, enabled);
      } else if (activeSubTab === "strip") {
        renderVisualStripSection(containerEl, enabled);
      } else {
        renderVisualTagsSection(containerEl, enabled);
      }
    },
    renderPkmOrderBoardSection() {},
    renderPkmConfigSections(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "PKM settings are unavailable in fallback mode." });
    },
    renderNavigationSettings(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Navigation settings are unavailable in fallback mode." });
    },
    renderVisualGeneralSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Visual settings fallback mode." });
    },
    renderVisualTagsSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Tags settings fallback mode." });
    },
    renderVisualStripSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Strip settings fallback mode." });
    },
    renderColorsSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Colors settings fallback mode." });
    },
    renderAdvancedSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Advanced settings fallback mode." });
    },
  };
}

function hasValidTagWheelConfigCodec(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.normalizeTagWheelConfigPath === "function"
    && typeof mod.normalizeTagWheelConfigTemplatePath === "function"
    && typeof mod.buildDefaultTagWheelDetailedTemplateMarkdown === "function"
    && typeof mod.renderTagWheelConfigFromTemplate === "function"
    && typeof mod.buildMinimalFromRenderedTemplate === "function"
    && typeof mod.buildTagWheelConfigParts === "function"
    && typeof mod.buildTagWheelConfigMarkdown === "function"
    && typeof mod.parseTagWheelConfigMarkdown === "function");
}

function createTagWheelConfigCodecFallback() {
  try {
    const mod = require("./src/features/tagwheel_config_codec_fallback.js");
    if (mod && typeof mod.createTagWheelConfigCodecFallback === "function") {
      return mod.createTagWheelConfigCodecFallback({
        isObj,
        TAGWHEEL_CONFIG_NOTE_DEFAULT_PATH,
        TAGWHEEL_CONFIG_TEMPLATE_DEFAULT_PATH,
        TAGWHEEL_TECHNICAL_BLOCK_MARKER,
        TAGWHEEL_TECH_MARKER_PREFIX,
        TAGWHEEL_IMPORTANT_LINE,
        CFG_H2_TAGS,
        CFG_H2_ELEMENTS_COMBINED,
        TAGWHEEL_PREFIX_RESOLVER_H3,
      });
    }
  } catch (_) {
    // Silent sandbox fallback.
  }
  return {
    normalizeTagWheelConfigPath() {
      return TAGWHEEL_CONFIG_NOTE_DEFAULT_PATH;
    },
    normalizeTagWheelConfigTemplatePath() {
      return TAGWHEEL_CONFIG_TEMPLATE_DEFAULT_PATH;
    },
    buildDefaultTagWheelDetailedTemplateMarkdown() {
      throw new Error("TagWheel config codec fallback module unavailable: buildDefaultTagWheelDetailedTemplateMarkdown");
    },
    renderTagWheelConfigFromTemplate() {
      throw new Error("TagWheel config codec fallback module unavailable: renderTagWheelConfigFromTemplate");
    },
    buildMinimalFromRenderedTemplate() {
      throw new Error("TagWheel config codec fallback module unavailable: buildMinimalFromRenderedTemplate");
    },
    buildTagWheelConfigParts() {
      throw new Error("TagWheel config codec unavailable: buildTagWheelConfigParts");
    },
    buildTagWheelConfigMarkdown() {
      throw new Error("TagWheel config codec unavailable: buildTagWheelConfigMarkdown");
    },
    parseTagWheelConfigMarkdown() {
      throw new Error("TagWheel config codec unavailable: parseTagWheelConfigMarkdown");
    },
  };
}

function hasValidTagWheelConfigParser(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.createTagWheelConfigParser === "function");
}

async function loadTagWheelConfigParserSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/features/tagwheel_config_parser.js",
    "./.obsidian/plugins/inline-overhaul/src/features/tagwheel_config_parser.js",
    "plugins/inline-overhaul/src/features/tagwheel_config_parser.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/features/tagwheel_config_parser.js",
    candidates,
    cacheKey: "feature:tagwheel-config-parser",
    validate: hasValidTagWheelConfigParser,
  });
  if (loaded.mod) {
    __tagWheelConfigParser = loaded.mod;
    return __tagWheelConfigParser;
  }
  __tagWheelConfigParser = null;
  return null;
}

function getTagWheelConfigParserFactory() {
  if (hasValidTagWheelConfigParser(__tagWheelConfigParser)) {
    return __tagWheelConfigParser.createTagWheelConfigParser;
  }
  return null;
}

async function loadTagWheelConfigCodecSafe(app) {
  await loadConfigNoteHelpersSafe(app);
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/features/tagwheel_config_codec.js",
    "./.obsidian/plugins/inline-overhaul/src/features/tagwheel_config_codec.js",
    "plugins/inline-overhaul/src/features/tagwheel_config_codec.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/features/tagwheel_config_codec.js",
    candidates,
    cacheKey: "feature:tagwheel-config-codec",
    validate: (mod) => !!(mod && typeof mod.createTagWheelConfigCodec === "function"),
  });
  if (loaded.mod && typeof loaded.mod.createTagWheelConfigCodec === "function") {
    const helpers = getConfigNoteHelpers();
    const codec = loaded.mod.createTagWheelConfigCodec({
      isObj,
      getOrderStrictName,
      ORDER_KEY_TO_LEFT_FIELD_ID,
      getFieldById: helpers.getFieldById,
      getLeftFields: helpers.getLeftFields,
      getRightFields: helpers.getRightFields,
      collectTagSections: helpers.collectTagSections,
      collectWikilinkFieldIds: helpers.collectWikilinkFieldIds,
      collectOrderedElementFields: helpers.collectOrderedElementFields,
      getPrefixRulesFromCfg: helpers.getPrefixRulesFromCfg,
      denormTagToken,
      parseCustomPrefixResolverBlock: helpers.parseCustomPrefixResolverBlock,
      isWikilinkToken,
      parseWikilinkLineStrict,
      extractFirstTagToken,
      parseCheckboxAndTag,
      createTagWheelConfigParser: (deps) => {
        const factory = getTagWheelConfigParserFactory();
        if (typeof factory !== "function") throw new Error("TagWheel config parser module unavailable");
        return factory(deps);
      },
      TAGWHEEL_CONFIG_NOTE_DEFAULT_PATH,
      TAGWHEEL_CONFIG_TEMPLATE_DEFAULT_PATH,
      TAGWHEEL_TECHNICAL_BLOCK_MARKER,
      TAGWHEEL_TECH_MARKER_PREFIX,
      TAGWHEEL_IMPORTANT_LINE,
      CFG_H1_SETTINGS,
      CFG_H2_TAGS,
      CFG_H2_ELEMENTS_COMBINED,
      CFG_H2_DATES,
      CFG_H2_ELEMENTS,
      TAGWHEEL_PREFIX_RESOLVER_H3,
      TAGWHEEL_PREFIX_RESOLVER_SECTION,
      TAGWHEEL_WIKILINK_SECTION,
    });
    if (hasValidTagWheelConfigCodec(codec)) {
      __tagWheelConfigCodec = codec;
      return __tagWheelConfigCodec;
    }
  }
  __tagWheelConfigCodec = createTagWheelConfigCodecFallback();
  return __tagWheelConfigCodec;
}

function getTagWheelConfigCodec() {
  if (hasValidTagWheelConfigCodec(__tagWheelConfigCodec)) return __tagWheelConfigCodec;
  __tagWheelConfigCodec = createTagWheelConfigCodecFallback();
  return __tagWheelConfigCodec;
}

function hasValidRulesMarkdownBuilder(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.buildTagWheelRulesMarkdownFromConfig === "function");
}

function createRulesMarkdownBuilderFallback() {
  return {
    buildTagWheelRulesMarkdownFromConfig(cfg) {
      const behaviorRoot = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
      const pkm = isObj(cfg && cfg.pkm) ? cfg.pkm : {};
      const io = isObj(behaviorRoot.io) ? behaviorRoot.io : {};
      const inlineLayout = isObj(behaviorRoot.inlineLayout) ? behaviorRoot.inlineLayout : {};
      const dateRules = isObj(behaviorRoot.dateRules) ? behaviorRoot.dateRules : {};
      const behavior = cloneJson(behaviorRoot);
      const ui = isObj(behaviorRoot.ui) ? behaviorRoot.ui : {};
      const leftMode = isObj(behaviorRoot.leftMode) ? behaviorRoot.leftMode : {};
      const rightMode = isObj(behaviorRoot.rightMode) ? behaviorRoot.rightMode : {};
      const projects = isObj(behaviorRoot.projects) ? behaviorRoot.projects : {};
      const colors = isObj(behaviorRoot.colors) ? behaviorRoot.colors : {};
      const meta = isObj(behaviorRoot.meta) ? cloneJson(behaviorRoot.meta) : {};

      behavior.subtagFormat = (pkm.behavior && pkm.behavior.subtagFormat === "combined") ? "combined" : "separate";
      behavior.defaultMode = String(behavior.defaultMode || "").trim().toLowerCase() === "right" ? "right" : "left";
      meta.generatedBy = "inline-overhaul";
      meta.generatedAt = new Date().toISOString();

      const blocks = [
        ["tagwheel-meta", meta],
        ["tagwheel-io", io],
        ["tagwheel-inline-layout", inlineLayout],
        ["tagwheel-date-rules", dateRules],
        ["tagwheel-behavior", behavior],
        ["tagwheel-ui", ui],
        ["tagwheel-left-mode", leftMode],
        ["tagwheel-right-mode", rightMode],
        ["tagwheel-projects", projects],
        ["tagwheel-colors", colors],
      ];

      const lines = [];
      lines.push("# InlineOverhaul Generated TagWheel Rules");
      lines.push("");
      lines.push("<!-- AUTO-GENERATED. DO NOT EDIT MANUALLY. Source: plugin data.json -->");
      lines.push("");

      for (let i = 0; i < blocks.length; i++) {
        const name = blocks[i][0];
        const payload = blocks[i][1];
        lines.push("```" + name);
        lines.push(toPrettyJson(payload));
        lines.push("```");
        lines.push("");
      }
      return lines.join("\n");
    },
  };
}

async function loadRulesMarkdownBuilderSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/features/rules_markdown_builder.js",
    "./.obsidian/plugins/inline-overhaul/src/features/rules_markdown_builder.js",
    "plugins/inline-overhaul/src/features/rules_markdown_builder.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/features/rules_markdown_builder.js",
    candidates,
    cacheKey: "feature:rules-markdown-builder",
    validate: (mod) => !!(mod && typeof mod.createRulesMarkdownBuilder === "function"),
  });
  if (loaded.mod && typeof loaded.mod.createRulesMarkdownBuilder === "function") {
    const builder = loaded.mod.createRulesMarkdownBuilder({ isObj, cloneJson, toPrettyJson });
    if (hasValidRulesMarkdownBuilder(builder)) {
      __rulesMarkdownBuilder = builder;
      return __rulesMarkdownBuilder;
    }
  }
  __rulesMarkdownBuilder = createRulesMarkdownBuilderFallback();
  return __rulesMarkdownBuilder;
}

function getRulesMarkdownBuilder() {
  if (hasValidRulesMarkdownBuilder(__rulesMarkdownBuilder)) return __rulesMarkdownBuilder;
  __rulesMarkdownBuilder = createRulesMarkdownBuilderFallback();
  return __rulesMarkdownBuilder;
}

function hasValidConfigNoteHelpers(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.getLeftFields === "function"
    && typeof mod.getRightFields === "function"
    && typeof mod.getFieldById === "function"
    && typeof mod.resolveOrderField === "function"
    && typeof mod.collectWikilinkFieldIds === "function"
    && typeof mod.collectTagSections === "function"
    && typeof mod.collectOrderedElementFields === "function"
    && typeof mod.getPrefixRulesFromCfg === "function"
    && typeof mod.collectCheckboxTokensFromMap === "function"
    && typeof mod.parseCustomPrefixResolverBlock === "function"
    && typeof mod.syncCustomPrefixResolverBlock === "function");
}

function createConfigNoteHelpersFallback() {
  const fail = (name) => {
    throw new Error("Config note helpers unavailable: " + name);
  };
  return {
    getLeftFields: (cfg) => fail("getLeftFields") && cfg,
    getRightFields: (cfg) => fail("getRightFields") && cfg,
    getFieldById: (fields, fieldId) => fail("getFieldById") && fields && fieldId,
    resolveOrderField: (cfg, orderKey) => fail("resolveOrderField") && cfg && orderKey,
    collectWikilinkFieldIds: (cfg) => fail("collectWikilinkFieldIds") && cfg,
    collectTagSections: (cfg) => fail("collectTagSections") && cfg,
    collectOrderedElementFields: (cfg) => fail("collectOrderedElementFields") && cfg,
    getPrefixRulesFromCfg: (cfg) => fail("getPrefixRulesFromCfg") && cfg,
    collectCheckboxTokensFromMap: (x) => fail("collectCheckboxTokensFromMap") && x,
    parseCustomPrefixResolverBlock: (md, allowedSections) => fail("parseCustomPrefixResolverBlock") && md && allowedSections,
    syncCustomPrefixResolverBlock: (md, sectionOrder, checkboxOrder, mode, fieldsOrderMode, tagSubtagPriority) => fail("syncCustomPrefixResolverBlock") && md && sectionOrder && checkboxOrder && mode && fieldsOrderMode && tagSubtagPriority,
  };
}

async function loadConfigNoteHelpersSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/features/config_note_helpers.js",
    "./.obsidian/plugins/inline-overhaul/src/features/config_note_helpers.js",
    "plugins/inline-overhaul/src/features/config_note_helpers.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/features/config_note_helpers.js",
    candidates,
    cacheKey: "feature:config-note-helpers",
    validate: (mod) => !!(mod && typeof mod.createConfigNoteHelpers === "function"),
  });
  if (loaded.mod && typeof loaded.mod.createConfigNoteHelpers === "function") {
    const helpers = loaded.mod.createConfigNoteHelpers({
      isObj,
      normalizePkmOrder,
      getOrderStrictName,
      TAGWHEEL_PREFIX_RESOLVER_H3,
    });
    if (hasValidConfigNoteHelpers(helpers)) {
      __configNoteHelpers = helpers;
      return __configNoteHelpers;
    }
  }
  __configNoteHelpers = createConfigNoteHelpersFallback();
  return __configNoteHelpers;
}

function getConfigNoteHelpers() {
  if (hasValidConfigNoteHelpers(__configNoteHelpers)) return __configNoteHelpers;
  __configNoteHelpers = createConfigNoteHelpersFallback();
  return __configNoteHelpers;
}

function hasValidConfigNoteOrchestrator(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.openTagWheelConfigNote === "function"
    && typeof mod.openTagWheelConfigTemplateNote === "function"
    && typeof mod.applyTagWheelConfigNote === "function"
    && typeof mod.renameStrictNameInConfigNote === "function");
}

function hasValidConfigStoreModule(mod) {
  return !!(mod && typeof mod === "object" && typeof mod.ConfigStore === "function");
}

function hasValidConfigMigrationModule(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.normalizePkmBehaviorShape === "function");
}

function hasValidRulesSyncOrchestrator(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.scheduleGeneratedRulesSync === "function"
    && typeof mod.ensureGeneratedRulesNow === "function");
}

function hasValidStoreEventsOrchestrator(mod) {
  return !!(mod && typeof mod === "object" && typeof mod.registerStoreEvents === "function");
}

function hasValidEnhancedSelectAllEngine(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.handleEnhancedSelectAllKeymap === "function");
}

async function loadEnhancedSelectAllEngineSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/features/enhanced_select_all_engine.js",
    "./.obsidian/plugins/inline-overhaul/src/features/enhanced_select_all_engine.js",
    "plugins/inline-overhaul/src/features/enhanced_select_all_engine.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/features/enhanced_select_all_engine.js",
    candidates,
    cacheKey: "feature:enhanced-select-all-engine",
    validate: hasValidEnhancedSelectAllEngine,
  });
  if (loaded.mod) {
    __enhancedSelectAllEngine = loaded.mod;
    return __enhancedSelectAllEngine;
  }
  __enhancedSelectAllEngine = {
    handleEnhancedSelectAllKeymap() {
      return false;
    },
  };
  return __enhancedSelectAllEngine;
}

function getEnhancedSelectAllEngine() {
  if (hasValidEnhancedSelectAllEngine(__enhancedSelectAllEngine)) return __enhancedSelectAllEngine;
  __enhancedSelectAllEngine = {
    handleEnhancedSelectAllKeymap() {
      return false;
    },
  };
  return __enhancedSelectAllEngine;
}

function hasValidPriorityStripEngine(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.buildStripSpecs === "function"
    && typeof mod.normalizeStripConfig === "function");
}

function hasValidPriorityStripAdapter(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.buildStripDecorationRanges === "function");
}

async function loadPriorityStripEngineSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/core/priority_strip_engine.js",
    "./.obsidian/plugins/inline-overhaul/src/core/priority_strip_engine.js",
    "plugins/inline-overhaul/src/core/priority_strip_engine.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/core/priority_strip_engine.js",
    candidates,
    cacheKey: "core:priority-strip-engine",
    validate: hasValidPriorityStripEngine,
  });
  if (loaded.mod) {
    __priorityStripEngine = loaded.mod;
    __priorityStripEngineIsStub = false;
    return __priorityStripEngine;
  }
  __priorityStripEngineIsStub = true;
  if (loaded.requireErr) reportLoaderFallback("main.loadPriorityStripEngineSafe", loaded.requireErr);
  return __priorityStripEngine;
}

async function loadPriorityStripAdapterSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/core/priority_strip_cm6_adapter.js",
    "./.obsidian/plugins/inline-overhaul/src/core/priority_strip_cm6_adapter.js",
    "plugins/inline-overhaul/src/core/priority_strip_cm6_adapter.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/core/priority_strip_cm6_adapter.js",
    candidates,
    cacheKey: "core:priority-strip-adapter",
    validate: hasValidPriorityStripAdapter,
  });
  if (loaded.mod) {
    __priorityStripCm6Adapter = loaded.mod;
    __priorityStripCm6AdapterIsStub = false;
    return __priorityStripCm6Adapter;
  }
  __priorityStripCm6AdapterIsStub = true;
  if (loaded.requireErr) reportLoaderFallback("main.loadPriorityStripAdapterSafe", loaded.requireErr);
  return __priorityStripCm6Adapter;
}

function fallbackConfigNoteOrchestrator() {
  return {
    async openTagWheelConfigNote() {
      throw new Error("Config note orchestrator unavailable");
    },
    async openTagWheelConfigTemplateNote(ctx) {
      const app = ctx && ctx.app;
      const cfg = ctx && ctx.cfg;
      const codec = (ctx && ctx.tagWheelConfigCodec) || {};
      const normalizeTagWheelConfigTemplatePath = typeof codec.normalizeTagWheelConfigTemplatePath === "function"
        ? codec.normalizeTagWheelConfigTemplatePath
        : (ctx && ctx.normalizeTagWheelConfigTemplatePath);
      const buildDefaultTagWheelDetailedTemplateMarkdown = typeof codec.buildDefaultTagWheelDetailedTemplateMarkdown === "function"
        ? codec.buildDefaultTagWheelDetailedTemplateMarkdown
        : (ctx && ctx.buildDefaultTagWheelDetailedTemplateMarkdown);
      const templatePath = normalizeTagWheelConfigTemplatePath(cfg && cfg.pkm ? cfg.pkm.tagWheelConfigTemplatePath : "");
      let file = app.vault.getAbstractFileByPath(templatePath);
      if (!file) {
        await app.vault.create(templatePath, buildDefaultTagWheelDetailedTemplateMarkdown());
        file = app.vault.getAbstractFileByPath(templatePath);
      }
      if (!file) throw new Error("Failed to create/open detailed template note: " + templatePath);
      const leaf = app.workspace.getLeaf(true);
      await leaf.openFile(file);
      return templatePath;
    },
    async applyTagWheelConfigNote() {
      throw new Error("Config note orchestrator unavailable");
    },
    async renameStrictNameInConfigNote(ctx, oldName, newName) {
      const app = ctx && ctx.app;
      const cfg = ctx && ctx.cfg;
      const codec = (ctx && ctx.tagWheelConfigCodec) || {};
      const normalizeTagWheelConfigPath = typeof codec.normalizeTagWheelConfigPath === "function"
        ? codec.normalizeTagWheelConfigPath
        : (ctx && ctx.normalizeTagWheelConfigPath);
      const from = String(oldName || "").trim();
      const to = String(newName || "").trim();
      if (!from || !to || from === to) return;
      const notePath = normalizeTagWheelConfigPath(cfg && cfg.pkm ? cfg.pkm.tagWheelConfigPath : "");
      const file = app.vault.getAbstractFileByPath(notePath);
      if (!file) return;
      const src = await app.vault.read(file);
      let out = String(src || "");
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const fromEsc = esc(from);
      out = out.replace(new RegExp(`(^|\\n)(\\s*#{4,5}\\s+)${fromEsc}(\\s*(?:\\n|$))`, "g"), `$1$2${to}$3`);
      out = out.replace(new RegExp(`(^|\\n)(\\s*[-*]\\s+)${fromEsc}(\\s*(?:\\n|$))`, "g"), `$1$2${to}$3`);
      if (out !== src) await app.vault.modify(file, out);
    },
  };
}

async function loadConfigNoteOrchestratorSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/features/config_note_orchestrator.js",
    "./.obsidian/plugins/inline-overhaul/src/features/config_note_orchestrator.js",
    "plugins/inline-overhaul/src/features/config_note_orchestrator.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/features/config_note_orchestrator.js",
    candidates,
    cacheKey: "feature:config-note-orchestrator",
    validate: hasValidConfigNoteOrchestrator,
  });
  if (loaded.mod) {
    __configNoteOrchestrator = loaded.mod;
    return __configNoteOrchestrator;
  }

  __configNoteOrchestrator = fallbackConfigNoteOrchestrator();
  return __configNoteOrchestrator;
}

function getConfigNoteOrchestrator() {
  if (hasValidConfigNoteOrchestrator(__configNoteOrchestrator)) return __configNoteOrchestrator;
  __configNoteOrchestrator = fallbackConfigNoteOrchestrator();
  return __configNoteOrchestrator;
}

async function loadConfigStoreModuleSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/core/config_store.js",
    "./.obsidian/plugins/inline-overhaul/src/core/config_store.js",
    "plugins/inline-overhaul/src/core/config_store.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/core/config_store.js",
    candidates,
    cacheKey: "core:config-store",
    validate: hasValidConfigStoreModule,
  });
  if (loaded.mod) {
    __configStoreModule = loaded.mod;
    return __configStoreModule;
  }
  __configStoreModule = null;
  return null;
}

function getConfigStoreCtor() {
  if (hasValidConfigStoreModule(__configStoreModule)) return __configStoreModule.ConfigStore;
  return FallbackConfigStore;
}

async function loadConfigMigrationModuleSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/core/config_migration.js",
    "./.obsidian/plugins/inline-overhaul/src/core/config_migration.js",
    "plugins/inline-overhaul/src/core/config_migration.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/core/config_migration.js",
    candidates,
    cacheKey: "core:config-migration",
    validate: hasValidConfigMigrationModule,
  });
  if (loaded.mod) {
    __configMigrationModule = loaded.mod;
    return __configMigrationModule;
  }
  __configMigrationModule = null;
  return null;
}

function getConfigMigrationModule() {
  if (hasValidConfigMigrationModule(__configMigrationModule)) return __configMigrationModule;
  return {
    normalizePkmBehaviorShape(cfg) {
      return cfg;
    },
  };
}

function fallbackRulesSyncOrchestrator() {
  return {
    scheduleGeneratedRulesSync(ctx) {
      const cfg = ctx.getConfig();
      if (!(cfg && cfg.pkm)) return;
      const activeTimer = ctx.getTimer();
      if (activeTimer) clearTimeout(activeTimer);
      const timer = setTimeout(() => {
        ctx.setTimer(null);
        ctx.ensureGeneratedRulesNow("store:update").catch((e) => {
          ctx.onError(e);
        });
      }, ctx.delayMs);
      ctx.setTimer(timer);
    },
    async ensureGeneratedRulesNow(ctx, reason) {
      const cfg = ctx.getConfig();
      if (!(cfg && cfg.pkm)) return;
      const genPath = String((cfg.pkm && cfg.pkm.generatedRulesPath) || ctx.defaultGeneratedRulesPath || "").trim();
      if (!genPath) throw new Error("Generated rules path is empty");
      const md = ctx.buildRulesMarkdown(cfg);
      await ctx.writeText(genPath, md);
      if (reason === "manual") ctx.notice("InlineOverhaul: generated rules updated");
    },
  };
}

async function loadRulesSyncOrchestratorSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/features/rules_sync_orchestrator.js",
    "./.obsidian/plugins/inline-overhaul/src/features/rules_sync_orchestrator.js",
    "plugins/inline-overhaul/src/features/rules_sync_orchestrator.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/features/rules_sync_orchestrator.js",
    candidates,
    cacheKey: "feature:rules-sync-orchestrator",
    validate: hasValidRulesSyncOrchestrator,
  });
  if (loaded.mod) {
    __rulesSyncOrchestrator = loaded.mod;
    return __rulesSyncOrchestrator;
  }
  __rulesSyncOrchestrator = fallbackRulesSyncOrchestrator();
  return __rulesSyncOrchestrator;
}

function getRulesSyncOrchestrator() {
  if (hasValidRulesSyncOrchestrator(__rulesSyncOrchestrator)) return __rulesSyncOrchestrator;
  __rulesSyncOrchestrator = fallbackRulesSyncOrchestrator();
  return __rulesSyncOrchestrator;
}

function fallbackStoreEventsOrchestrator() {
  return {
    registerStoreEvents(ctx) {
      ctx.setUnsubscribe(
        ctx.subscribeStore(() => {
          ctx.renderSettingsTab();
          ctx.scheduleGeneratedRulesSync();
        })
      );

      ctx.registerCleanup(() => {
        const unsubscribe = ctx.getUnsubscribe();
        if (unsubscribe) unsubscribe();
        const timer = ctx.getRulesTimer();
        if (timer) {
          clearTimeout(timer);
          ctx.setRulesTimer(null);
        }
      });
    },
  };
}

async function loadStoreEventsOrchestratorSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/features/store_events_orchestrator.js",
    "./.obsidian/plugins/inline-overhaul/src/features/store_events_orchestrator.js",
    "plugins/inline-overhaul/src/features/store_events_orchestrator.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/features/store_events_orchestrator.js",
    candidates,
    cacheKey: "feature:store-events-orchestrator",
    validate: hasValidStoreEventsOrchestrator,
  });
  if (loaded.mod) {
    __storeEventsOrchestrator = loaded.mod;
    return __storeEventsOrchestrator;
  }
  __storeEventsOrchestrator = fallbackStoreEventsOrchestrator();
  return __storeEventsOrchestrator;
}

function getStoreEventsOrchestrator() {
  if (hasValidStoreEventsOrchestrator(__storeEventsOrchestrator)) return __storeEventsOrchestrator;
  __storeEventsOrchestrator = fallbackStoreEventsOrchestrator();
  return __storeEventsOrchestrator;
}

async function loadSharedUtilsSafe(app) {
  const required = [
    "cloneJson",
    "isObj",
    "deepMerge",
    "parseJsonFence",
    "toPrettyJson",
    "nz",
    "escapeRe",
    "normalizeFormatMask",
    "buildFormatValueRegexSource",
    "hasFormatTokens",
    "parseNumericLiteralSpec",
    "parseNumericPatternSpec",
    "buildNumericPatternRegexSource",
    "renderNumericPatternValue",
    "parseNumericPatternProgress",
    "renderTokenlessValueByProgress",
    "buildTokenlessValueRegexSource",
    "parseTokenlessProgress",
    "parseHhmm",
    "addMinutesHhmm",
    "formatNowByMask",
    "buildCustomPlanFromIncrement",
    "forwardStepByCurrent",
    "backwardStepByCurrent",
    "getSearchLimitByUnit",
    "detectDateUnit",
  ];
  const hasAll = (obj) => !!(obj && typeof obj === "object" && required.every((k) => typeof obj[k] === "function"));
  if (hasAll(__sharedUtils)) {
    try { globalThis.__inlineOverhaulSharedUtils = __sharedUtils; } catch (_) {}
    return __sharedUtils;
  }

  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/core/shared_utils.js",
    "./.obsidian/plugins/inline-overhaul/src/core/shared_utils.js",
    "plugins/inline-overhaul/src/core/shared_utils.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/core/shared_utils.js",
    candidates,
    cacheKey: "core:shared-utils",
    validate: hasAll,
  });
  if (loaded.mod) {
    __sharedUtils = loaded.mod;
    try { globalThis.__inlineOverhaulSharedUtils = __sharedUtils; } catch (_) {}
    return __sharedUtils;
  }
  try { globalThis.__inlineOverhaulSharedUtils = __sharedUtils; } catch (_) {}
  return __sharedUtils;
}

function cloneJson(x) { return __sharedUtils.cloneJson(x); }
function isObj(x) { return __sharedUtils.isObj(x); }
function deepMerge(base, patch) { return __sharedUtils.deepMerge(base, patch); }
function parseJsonFence(md, fenceName, required) { return __sharedUtils.parseJsonFence(md, fenceName, required); }
function toPrettyJson(x) { return __sharedUtils.toPrettyJson(x); }

async function loadModuleWithVaultFallback(app, opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const requirePath = String(options.requirePath || "");
  const candidates = Array.isArray(options.candidates) ? options.candidates : [];
  const validate = typeof options.validate === "function"
    ? options.validate
    : (mod) => !!(mod && typeof mod === "object");
  const loadErrorPrefix = String(options.loadErrorPrefix || "");
  const cacheKey = String(options.cacheKey || "").trim();
  const allowUiVaultEvalFallback = options.uiVaultEvalFallback === true;

  if (cacheKey && __safeModuleCache.has(cacheKey)) {
    const cached = __safeModuleCache.get(cacheKey);
    if (validate(cached)) return { mod: cached, requireErr: null };
    __safeModuleCache.delete(cacheKey);
  }

  let requireErr = null;
  if (requirePath) {
    try {
      const mod = require(requirePath);
      if (validate(mod)) {
        if (cacheKey) __safeModuleCache.set(cacheKey, mod);
        return { mod, requireErr: null };
      }
    } catch (e) {
      requireErr = e;
    }
  }

  const loadVaultBridgeSafe = async () => {
    let bridge = globalThis.__inlineVaultModuleBridge;
    if (bridge && typeof bridge.loadVaultModule === "function") return bridge;
    try {
      const mod = require("./src/core/vault_module_bridge.js");
      if (mod && typeof mod.loadVaultModule === "function") {
        globalThis.__inlineVaultModuleBridge = mod;
        return mod;
      }
    } catch (e) {
      reportLoaderFallback("main.loadVaultBridgeSafe.require", e);
    }

    const adapter = app && app.vault ? app.vault.adapter : null;
    if (!adapter || typeof adapter.read !== "function") return null;
    const bridgeCandidates = [
      ".obsidian/plugins/inline-overhaul/src/core/vault_module_bridge.js",
      "./.obsidian/plugins/inline-overhaul/src/core/vault_module_bridge.js",
      "plugins/inline-overhaul/src/core/vault_module_bridge.js",
      "src/core/vault_module_bridge.js",
      "./src/core/vault_module_bridge.js",
    ];
    for (const p of bridgeCandidates) {
      try {
        const code = await adapter.read(p);
        const moduleObj = { exports: {} };
        const factory = new Function("module", "exports", String(code || "") + "\n;return module.exports;");
        const out = factory(moduleObj, moduleObj.exports);
        const mod = out && typeof out === "object" ? out : moduleObj.exports;
        if (mod && typeof mod.loadVaultModule === "function") {
          globalThis.__inlineVaultModuleBridge = mod;
          reportLoaderFallback("main.loadVaultBridgeSafe.vaultEval", p);
          return mod;
        }
      } catch (e2) {
        reportLoaderFallback(`main.loadVaultBridgeSafe.vaultEval:${p}`, e2);
      }
    }
    return null;
  };

  const tryLoadWithVaultBridge = async (modulePath) => {
    let bridge = globalThis.__inlineVaultModuleBridge;
    if (!(bridge && typeof bridge.loadVaultModule === "function")) {
      bridge = await loadVaultBridgeSafe();
    }
    if (!(bridge && typeof bridge.loadVaultModule === "function")) return null;
    try {
      return await bridge.loadVaultModule(app, modulePath, false, "__inlineOverhaulMainModuleCache");
    } catch (e) {
      reportLoaderFallback(`main.tryLoadWithVaultBridge.load:${modulePath}`, e);
      return null;
    }
  };

  for (const modulePath of candidates) {
    try {
      const bridgeMod = await tryLoadWithVaultBridge(modulePath);
      if (validate(bridgeMod)) {
        if (cacheKey) __safeModuleCache.set(cacheKey, bridgeMod);
        return { mod: bridgeMod, requireErr };
      }
    } catch (e2) {
      if (loadErrorPrefix) console.error(loadErrorPrefix, modulePath, e2);
    }
  }

  if (allowUiVaultEvalFallback) {
    const adapter = app && app.vault ? app.vault.adapter : null;
    if (adapter && typeof adapter.read === "function") {
      for (const modulePath of candidates) {
        try {
          const code = await adapter.read(modulePath);
          const moduleObj = { exports: {} };
          const factory = new Function("module", "exports", String(code || "") + "\n;return module.exports;");
          const out = factory(moduleObj, moduleObj.exports);
          const mod = out && typeof out === "object" ? out : moduleObj.exports;
          if (validate(mod)) {
            if (cacheKey) __safeModuleCache.set(cacheKey, mod);
            reportLoaderFallback("main.loadModuleWithVaultFallback.uiVaultEval", modulePath);
            return { mod, requireErr };
          }
        } catch (e3) {
          reportLoaderFallback(`main.loadModuleWithVaultFallback.uiVaultEval:${modulePath}`, e3);
        }
      }
    }
  }

  return { mod: null, requireErr };
}

async function loadNavigationRuntimeSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/navigation_runtime.js",
    "./.obsidian/plugins/inline-overhaul/navigation_runtime.js",
    "plugins/inline-overhaul/navigation_runtime.js",
  ];

  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./navigation_runtime.js",
    candidates,
    cacheKey: "runtime:navigation",
    validate: (mod) => !!(mod && typeof mod === "object"),
    loadErrorPrefix: "[inline-overhaul] Failed to load navigation runtime from",
  });

  if (loaded.mod) return loaded.mod;
  if (loaded.requireErr) {
    console.error("[inline-overhaul] Failed to load navigation_runtime.js (require + fallback)", loaded.requireErr);
  }
  return null;
}

async function loadPkmRuntimeV2Safe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/pkm_runtime_v2.js",
    "./.obsidian/plugins/inline-overhaul/pkm_runtime_v2.js",
    "plugins/inline-overhaul/pkm_runtime_v2.js",
  ];

  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./pkm_runtime_v2.js",
    candidates,
    cacheKey: "runtime:pkm-v2",
    validate: (mod) => !!(mod && typeof mod === "object"),
    loadErrorPrefix: "[inline-overhaul] Failed to load PKM runtime v2 from",
  });

  if (loaded.mod) return loaded.mod;
  if (loaded.requireErr) {
    console.error("[inline-overhaul] Failed to load pkm_runtime_v2.js (require + fallback)", loaded.requireErr);
  }
  return null;
}

async function loadPkmMacroRuntimeEntrySafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/core/pkm_macro_runtime_entry.js",
    "./.obsidian/plugins/inline-overhaul/src/core/pkm_macro_runtime_entry.js",
    "plugins/inline-overhaul/src/core/pkm_macro_runtime_entry.js",
  ];

  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/core/pkm_macro_runtime_entry.js",
    candidates,
    cacheKey: "runtime:pkm-macro-entry",
    validate: (mod) => !!(mod && typeof mod === "object" && typeof mod.bootstrapMacroRuntime === "function"),
    loadErrorPrefix: "[inline-overhaul] Failed to load PKM macro runtime entry from",
  });

  if (loaded.mod) {
    try { globalThis.__inlinePkmMacroRuntimeEntryMod = loaded.mod; } catch (_) {}
    try {
      globalThis.__inlineGetPkmMacroRuntime = (app_, normalizeOrderKeyLocal) => loaded.mod.bootstrapMacroRuntime(app_, normalizeOrderKeyLocal);
    } catch (_) {}
    return loaded.mod;
  }
  if (loaded.requireErr) {
    console.error("[inline-overhaul] Failed to load pkm_macro_runtime_entry.js (require + fallback)", loaded.requireErr);
  }
  return null;
}

const SCHEMA_VERSION = 1;
const SAVE_DEBOUNCE_MS = 250;
const UNDO_LIMIT = 20;

const FEATURE_ORDER = ["navigation", "pkm", "visual", "transform"];

const FEATURE_META = {
  navigation: { label: "Navigation" },
  pkm: { label: "Tag & PKM" },
  visual: { label: "Visual" },
  transform: { label: "Transform" },
};

const PKM_BACKENDS = {
  internalV2: "internal-runtime-v2",
};

const SETTINGS_TABS = [
  { id: "general", label: "General" },
  { id: "hotkeys", label: "Hotkeys" },
  { id: "navigation", label: "Navigation" },
  { id: "pkm", label: "Tag & PKM" },
  { id: "visual", label: "Visual" },
  { id: "transform", label: "Transform" },
  { id: "advanced", label: "Advanced" },
];

const VISUAL_SUB_TABS = [
  { id: "tags", label: "Tags" },
  { id: "strip", label: "Strip" },
  { id: "tagwheel", label: "TagWheel" },
];

const HOTKEYS_SUB_TABS = [
  { id: "global", label: "Global" },
  { id: "binder", label: "Binder" },
];

const PKM_ORDER_FIELDS = [];
const DATE_RUNTIME_KEY_NOW = "time_now";
const DATE_RUNTIME_KEY_ESTIMATED = "time_estimated";
const TAGWHEEL_CONFIG_NOTE_DEFAULT_PATH = "InlineOverhaul_Config.md";
const TAGWHEEL_CONFIG_TEMPLATE_DEFAULT_PATH = "InlineOverhaul_Config_template.md";
const TAGWHEEL_TECHNICAL_BLOCK_MARKER = "<!-- INLINE_OVERHAUL:TECHNICAL_BLOCK -->";
const TAGWHEEL_TECH_MARKER_PREFIX = "INLINE_OVERHAUL:TECH:";
const TAGWHEEL_IMPORTANT_LINE = ">!!! **IMPORTANT** - after making changes in this file -> Apply them, or it won't work!";
const TAGWHEEL_WIKILINK_SECTION = "wikilink fields (from Order)";
const TAGWHEEL_PREFIX_RESOLVER_SECTION = "prefix resolver";
const TAGWHEEL_PREFIX_RESOLVER_H3 = "PREFIX RESOLVER";
const TAGWHEEL_CONFIG_MODE_DETAILED = "detailed";
const TAGWHEEL_CONFIG_MODE_MINIMAL = "minimal";
const CFG_H1_SETTINGS = "Settings";
const CFG_H2_TAGS = "`#TAGS/#SUBTAGS` + `WIKILINKS`";
const CFG_H3_TAG_FIELDS = "Tag fields";
const CFG_H2_DATES = "DATES+TIME";
const CFG_H2_ELEMENTS = "ELEMENTS";
const CFG_H2_ELEMENTS_COMBINED = "`DATE/TIME + ELEMENTS`";
const ORDER_KEY_TO_LEFT_FIELD_ID = {};

function normalizeOrderFieldKey(key) {
  const k = String(key || "").trim().replace(/\s+/g, " ");
  if (!k) return "";
  return /^[a-z0-9_\- ]+$/i.test(k) ? k : "";
}

function inferSubFieldKeySafe(parentKey) {
  if (__pkmDomainRegistry && typeof __pkmDomainRegistry.inferSubFieldKey === "function") {
    return __pkmDomainRegistry.inferSubFieldKey(parentKey);
  }
  const p = String(parentKey || "").trim();
  return p ? `${p}_sub` : "";
}

function inferOrderFieldType(key) {
  if (__pkmDomainRegistry && typeof __pkmDomainRegistry.inferOrderFieldType === "function") {
    return __pkmDomainRegistry.inferOrderFieldType(key);
  }
  const k = String(key || "").trim().toLowerCase();
  if (!k) return "tag";
  if (/wikilink|link/i.test(k)) return "wikilink";
  if (/date|time|deadline|due|start/i.test(k)) return "element";
  return "tag";
}

function inferElementDefaultsByKey(key) {
  const lower = String(key || "").trim().toLowerCase();
  const isTimeLike = /time/.test(lower);
  const isDateLike = /date|deadline|due|start/.test(lower);
  const marker = "";
  const format = isTimeLike ? "HH:mm" : (isDateLike ? "YYYY-MM-DD" : "");
  return { marker, format };
}

function inferSubFieldKey(parentKey) {
  if (__pkmDomainRegistry && typeof __pkmDomainRegistry.inferSubFieldKey === "function") {
    const inferred = String(__pkmDomainRegistry.inferSubFieldKey(parentKey) || "").trim();
    if (inferred) return inferred;
  }
  const p = String(parentKey || "").trim();
  return p ? `${p}_sub` : "";
}

function buildLeftFieldDefinition(key, kind) {
  if (kind === "wikilink") {
    return {
      id: key,
      prefix: "#",
      source: `wikilinks:${key}`,
      placeholder: key,
      values: [""],
    };
  }
  return {
    id: key,
    prefix: "#",
    placeholder: key,
    values: [""],
  };
}

function buildRightElementFieldDefinition(key) {
  const dflt = inferElementDefaultsByKey(key);
  return {
    id: key,
    kind: "genericElement",
    marker: dflt.marker,
    placeholder: key,
    values: [""],
  };
}

function ensureBehaviorModesFromOrder(cfg) {
  if (!isObj(cfg && cfg.pkm && cfg.pkm.behavior)) return;
  const behavior = cfg.pkm.behavior;
  const order = normalizePkmOrder(behavior.order);
  behavior.order = order;

  if (!isObj(behavior.leftMode)) behavior.leftMode = { fields: [] };
  if (!Array.isArray(behavior.leftMode.fields)) behavior.leftMode.fields = [];
  if (!isObj(behavior.rightMode)) behavior.rightMode = { fields: [] };
  if (!Array.isArray(behavior.rightMode.fields)) behavior.rightMode.fields = [];

  const leftFields = behavior.leftMode.fields;
  const rightFields = behavior.rightMode.fields;
  const leftById = new Set(leftFields.map((f) => String(f && f.id || "").trim()).filter(Boolean));
  const rightById = new Set(rightFields.map((f) => String(f && f.id || "").trim()).filter(Boolean));

  const keys = [];
  const push = (k) => {
    const id = String(k || "").trim();
    if (!id || /_sub$/.test(id)) return;
    if (!keys.includes(id)) keys.push(id);
  };
  for (const k of order.left || []) push(k);
  for (const k of order.right || []) push(k);

  const builtInLeftIds = new Set();
  const builtInRightIds = new Set();
  const builtInOrderKeys = new Set();
   const allowedCustomTagIds = new Set();
   const allowedCustomWikilinkIds = new Set();
  const allowedCustomSubIds = new Set();
  /*
   * Дочерний Field ссылки. Отдельный набор, а не общий с тегом: тег и его
   * дочерний Field живут в leftMode, ссылка и её дочерний — в rightMode, и
   * один набор пустил бы каждого не на свою сторону.
   *
   * Без него дочерний Field ссылки не переживал ни одной записи: ключа
   * `<name>_sub` нет в `order.left` / `order.right` (`normalizePkmOrder`
   * складывает такие ключи отдельно), в наборы он не попадал, и фильтр ниже
   * выбрасывал его. `migrateConfig` идёт на каждом патче, поэтому дочернее
   * значение ссылки исчезало тут же после нажатия стрелки `Level`.
   */
  const allowedCustomLinkSubIds = new Set();
  const allowedCustomElementIds = new Set();
  for (const key of keys) {
    const kind0 = String(order.types && order.types[key] ? order.types[key] : inferOrderFieldType(key)).trim().toLowerCase();
    if (builtInOrderKeys.has(key)) continue;
    if (kind0 === "element") allowedCustomElementIds.add(key);
    else if (kind0 === "wikilink") {
      allowedCustomWikilinkIds.add(key);
      allowedCustomLinkSubIds.add(inferSubFieldKey(key));
    } else {
      allowedCustomTagIds.add(key);
      if (kind0 === "tag") allowedCustomSubIds.add(inferSubFieldKey(key));
    }
  }
  behavior.leftMode.fields = leftFields.filter((f) => {
    const id = String(f && f.id || "").trim();
    if (!id) return false;
    if (builtInLeftIds.has(id)) return true;
    if (allowedCustomTagIds.has(id)) return true;
    if (allowedCustomSubIds.has(id)) return true;
    return false;
  });
  behavior.rightMode.fields = rightFields.filter((f) => {
    const id = String(f && f.id || "").trim();
    if (!id) return false;
    if (builtInRightIds.has(id)) return true;
    if (allowedCustomWikilinkIds.has(id)) return true;
    if (allowedCustomLinkSubIds.has(id)) return true;
    if (allowedCustomElementIds.has(id)) return true;
    return false;
  });

  const leftFieldsLive = behavior.leftMode.fields;
  const rightFieldsLive = behavior.rightMode.fields;
  const leftByIdLive = new Set(leftFieldsLive.map((f) => String(f && f.id || "").trim()).filter(Boolean));
  const rightByIdLive = new Set(rightFieldsLive.map((f) => String(f && f.id || "").trim()).filter(Boolean));

  for (const key of keys) {
    const kind = String(order.types && order.types[key] ? order.types[key] : inferOrderFieldType(key)).trim().toLowerCase();
    if (builtInOrderKeys.has(key)) continue;
    if (kind === "element") {
      const elemCfg = isObj(behavior.elements && behavior.elements.byField && behavior.elements.byField[key])
        ? behavior.elements.byField[key]
        : {};
      const marker = String(elemCfg.emoji || inferElementDefaultsByKey(key).marker || "").trim();
      const placeholder = String(order.labels && order.labels[key] ? order.labels[key] : (key || "")).trim() || key;
      if (!rightByIdLive.has(key)) {
        const d = buildRightElementFieldDefinition(key);
        rightFieldsLive.push({ ...d, marker, placeholder });
        rightByIdLive.add(key);
      } else {
        const idx = rightFieldsLive.findIndex((f) => String(f && f.id || "").trim() === key);
        if (idx !== -1) {
          rightFieldsLive[idx] = {
            ...rightFieldsLive[idx],
            marker,
            placeholder,
          };
        }
      }
      continue;
    }
    if (kind === "wikilink") {
      if (!rightByIdLive.has(key)) {
        rightFieldsLive.push({
          id: key,
          prefix: "#",
          source: `wikilinks:${key}`,
          placeholder: String(order.labels && order.labels[key] ? order.labels[key] : key).trim() || key,
          values: [""],
        });
        rightByIdLive.add(key);
      }
      continue;
    }
    if (!leftByIdLive.has(key)) {
      leftFieldsLive.push(buildLeftFieldDefinition(key, kind));
      leftByIdLive.add(key);
    }
    if (kind === "tag") {
      const subKey = inferSubFieldKey(key);
      if (subKey && !leftByIdLive.has(subKey)) {
        const parentIdx = leftFieldsLive.findIndex((f) => String(f && f.id || "").trim() === key);
        const subDef = {
          id: subKey,
          prefix: "#",
          enabled: String(order.active && order.active[subKey] || "no").trim().toLowerCase() !== "no",
          dependsOn: key,
          disabledForParentValues: [],
          placeholder: "sub",
          values: [""],
        };
        if (parentIdx !== -1) leftFieldsLive.splice(parentIdx + 1, 0, subDef);
        else leftFieldsLive.push(subDef);
        leftByIdLive.add(subKey);
      }
      const subIdx = leftFieldsLive.findIndex((f) => String(f && f.id || "").trim() === subKey);
      if (subIdx !== -1) {
        const on = String(order.active && order.active[subKey] || "no").trim().toLowerCase() !== "no";
        leftFieldsLive[subIdx] = { ...leftFieldsLive[subIdx], enabled: on, dependsOn: key };
      }
      if (subKey && !Object.prototype.hasOwnProperty.call(order.active, subKey)) {
        order.active[subKey] = "no";
        order.enabled[subKey] = false;
      }
    }
  }

  if (!isObj(behavior.elements)) behavior.elements = { fields: [], byField: {} };
  if (!Array.isArray(behavior.elements.fields)) behavior.elements.fields = [];
  if (!isObj(behavior.elements.byField)) behavior.elements.byField = {};

  // Legacy migration: dates.* -> elements.* (elements-only SoT)
  if (isObj(behavior.dates)) {
    const legacyDates = behavior.dates;
    const legacyFields = Array.isArray(legacyDates.fields) ? legacyDates.fields.map((x) => String(x || "").trim()).filter(Boolean) : [];
    for (const f of legacyFields) {
      if (!behavior.elements.fields.includes(f)) behavior.elements.fields.push(f);
    }
    const legacyByField = isObj(legacyDates.byField) ? legacyDates.byField : {};
    for (const fid of Object.keys(legacyByField)) {
      const id = String(fid || "").trim();
      if (!id) continue;
      const cur = isObj(behavior.elements.byField[id]) ? behavior.elements.byField[id] : {};
      const src = isObj(legacyByField[id]) ? legacyByField[id] : {};
      const merged = {
        ...src,
        ...cur,
        increment: {
          ...(isObj(src.increment) ? src.increment : {}),
          ...(isObj(cur.increment) ? cur.increment : {}),
        },
      };
      if (!String(merged.emoji || "").trim() && String(src.emoji || "").trim()) merged.emoji = String(src.emoji || "").trim();
      if (!String(merged.format || "").trim() && String(src.format || "").trim()) merged.format = String(src.format || "").trim();
      behavior.elements.byField[id] = merged;
    }
    delete behavior.dates;
  }

  const strictNames = isObj(order && order.strictNames) ? order.strictNames : {};

  for (const key of keys) {
    const kind = String(order.types && order.types[key] ? order.types[key] : inferOrderFieldType(key)).trim().toLowerCase();
    if (kind !== "element") continue;
    const strictKey = String(strictNames[key] || key).trim() || key;
    if (!behavior.elements.fields.includes(key)) behavior.elements.fields.push(key);
    const curElem = isObj(behavior.elements.byField[key])
      ? behavior.elements.byField[key]
      : (isObj(behavior.elements.byField[strictKey]) ? behavior.elements.byField[strictKey] : {});
    const cur = curElem;
    const incCur = isObj(cur.increment) ? cur.increment : {};
    const modeRaw = String(incCur.mode || "standard").trim().toLowerCase();
    const mode = modeRaw === "custom" || modeRaw === "command" ? modeRaw : "standard";
    const incrementBy = Math.max(1, Math.trunc(Number(incCur.incrementBy || 1)));
    const command = String(incCur.command || "now").trim() || "now";
    const customRaw = Array.isArray(incCur.customRaw)
      ? incCur.customRaw.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const custom = Array.isArray(incCur.custom)
      ? incCur.custom.map((x) => Math.max(0, Math.trunc(Number(x || 0)))).filter((x) => Number.isFinite(x))
      : [];
    const nextBase = { ...cur };
    delete nextBase.hotkey;
    const normalizedEntry = {
      ...nextBase,
      emoji: Object.prototype.hasOwnProperty.call(cur, "emoji") ? String(cur.emoji || "").trim() : "",
      format: Object.prototype.hasOwnProperty.call(cur, "format") ? String(cur.format ?? "") : "",
      increment: {
        mode,
        incrementBy,
        command,
        customRaw,
        custom,
      },
    };
    behavior.elements.byField[key] = normalizedEntry;
  }

  const activeElementKeys = new Set();
  for (const key of keys) {
    const kind = String(order.types && order.types[key] ? order.types[key] : inferOrderFieldType(key)).trim().toLowerCase();
    if (kind === "element") activeElementKeys.add(String(key || "").trim());
  }
  behavior.elements.fields = (Array.isArray(behavior.elements.fields) ? behavior.elements.fields : [])
    .map((k) => String(k || "").trim())
    .filter((k) => k && activeElementKeys.has(k));
  for (const key of Object.keys(behavior.elements.byField || {})) {
    const normKey = String(key || "").trim();
    if (!activeElementKeys.has(normKey)) delete behavior.elements.byField[key];
  }
  behavior.elements.fields = behavior.elements.fields.filter((k) => activeElementKeys.has(String(k || "").trim()));

  const tax = isObj(cfg.pkm && cfg.pkm.taxonomy && cfg.pkm.taxonomy.tagWheelConfig)
    ? cfg.pkm.taxonomy.tagWheelConfig
    : null;
  if (tax) {
    if (isObj(tax.elements)) {
      tax.elements.fields = (Array.isArray(tax.elements.fields) ? tax.elements.fields : [])
        .map((k) => String(k || "").trim())
        .filter((k) => k && activeElementKeys.has(k));
      if (isObj(tax.elements.byField)) {
        for (const key of Object.keys(tax.elements.byField)) {
          if (!activeElementKeys.has(String(key || "").trim())) delete tax.elements.byField[key];
        }
      }
    }
    if (isObj(tax.dates)) delete tax.dates;
  }
}

function makeDefaultPkmOrder() {
  return {
    left: [],
    right: [],
    lead: {},
    active: {},
    freeRoam: {},
    enabled: {},
    types: {},
    labels: {},
    strictNames: {},
    propertiesByField: {},
  };
}

function normalizePkmOrder(rawOrder) {
  const out = makeDefaultPkmOrder();
  if (!isObj(rawOrder)) return out;
  const discovered = new Set();
  const discoveredSub = new Set();
  const collectKey = (k) => {
    const id = normalizeOrderFieldKey(k);
    if (!id) return;
    if (/_sub$/.test(id)) {
      discoveredSub.add(id);
      return;
    }
    discovered.add(id);
  };
  if (Array.isArray(rawOrder.left)) for (const x of rawOrder.left) collectKey(x);
  if (Array.isArray(rawOrder.right)) for (const x of rawOrder.right) collectKey(x);
  if (isObj(rawOrder.labels)) for (const k of Object.keys(rawOrder.labels)) if (rawOrder.labels[k] !== null && rawOrder.labels[k] !== undefined && String(rawOrder.labels[k]).trim()) collectKey(k);
  if (isObj(rawOrder.strictNames)) for (const k of Object.keys(rawOrder.strictNames)) if (rawOrder.strictNames[k] !== null && rawOrder.strictNames[k] !== undefined && String(rawOrder.strictNames[k]).trim()) collectKey(k);
  if (isObj(rawOrder.active)) for (const k of Object.keys(rawOrder.active)) if (rawOrder.active[k] !== null && rawOrder.active[k] !== undefined && String(rawOrder.active[k]).trim()) collectKey(k);
  if (isObj(rawOrder.freeRoam)) for (const k of Object.keys(rawOrder.freeRoam)) if (rawOrder.freeRoam[k] !== null && rawOrder.freeRoam[k] !== undefined && String(rawOrder.freeRoam[k]).trim()) collectKey(k);
  if (isObj(rawOrder.enabled)) for (const k of Object.keys(rawOrder.enabled)) if (typeof rawOrder.enabled[k] === "boolean") collectKey(k);
  if (isObj(rawOrder.types)) for (const k of Object.keys(rawOrder.types)) if (rawOrder.types[k] !== null && rawOrder.types[k] !== undefined && String(rawOrder.types[k]).trim()) collectKey(k);
  if (isObj(rawOrder.propertiesByField)) for (const k of Object.keys(rawOrder.propertiesByField)) if (rawOrder.propertiesByField[k] !== null && rawOrder.propertiesByField[k] !== undefined && String(rawOrder.propertiesByField[k]).trim()) collectKey(k);
  const orderFields = Array.from(discovered);

  const normalizeList = (arr, fallback) => {
    if (!Array.isArray(arr)) return fallback.slice();
    const uniq = [];
    for (const x of arr) {
      const id = normalizeOrderFieldKey(x);
      if (!id || !discovered.has(id)) continue;
      if (uniq.includes(id)) continue;
      uniq.push(id);
    }
    return uniq.length ? uniq : fallback.filter((x) => discovered.has(x)).slice();
  };
  out.left = normalizeList(rawOrder.left, out.left);
  out.right = normalizeList(rawOrder.right, out.right);
  const ordered = new Set(out.left.concat(out.right));
  for (const k of orderFields) {
    if (ordered.has(k)) continue;
    out.right.push(k);
  }
  const orderKeys = orderFields.concat(Array.from(discoveredSub));
  if (isObj(rawOrder.lead)) {
    const leftLead = normalizeOrderFieldKey(rawOrder.lead.left);
    const rightLead = normalizeOrderFieldKey(rawOrder.lead.right);
    if (leftLead && out.left.includes(leftLead)) out.lead.left = leftLead;
    if (rightLead && out.right.includes(rightLead)) out.lead.right = rightLead;
  }
  if (isObj(rawOrder.active)) {
    for (const k of orderKeys) {
      const raw = String(rawOrder.active[k] || "").trim().toLowerCase();
      if (raw === "yes" || raw === "no" || raw === "hotkey_only") out.active[k] = raw;
    }
  }
  if (isObj(rawOrder.enabled)) {
    for (const k of orderKeys) {
      if (typeof rawOrder.enabled[k] !== "boolean") continue;
      if (!isObj(rawOrder.active) || !Object.prototype.hasOwnProperty.call(rawOrder.active, k)) {
        out.active[k] = rawOrder.enabled[k] ? "yes" : "no";
      }
    }
  }
  if (isObj(rawOrder.types)) {
    for (const k of orderFields) {
      const raw = String(rawOrder.types[k] || "").trim().toLowerCase();
      if (raw === "tag" || raw === "wikilink" || raw === "element") out.types[k] = raw;
    }
  }
  if (isObj(rawOrder.freeRoam)) {
    for (const k of orderKeys) {
      const raw = String(rawOrder.freeRoam[k] || "").trim().toLowerCase();
      if (raw === "minimal" || raw === "full") out.freeRoam[k] = raw;
      else if (raw === "off") out.freeRoam[k] = "off";
    }
  }
  for (const k of orderFields) {
    if (typeof out.types[k] !== "string" || !out.types[k]) out.types[k] = inferOrderFieldType(k);
  }

  if (isObj(rawOrder.labels)) {
    for (const k of orderFields) {
      if (typeof rawOrder.labels[k] === "string" && rawOrder.labels[k].trim()) {
        out.labels[k] = rawOrder.labels[k].trim();
      }
    }
  }
  if (isObj(rawOrder.strictNames)) {
    const used = new Set();
    for (const k of orderFields) {
      const v = String(rawOrder.strictNames[k] || "").trim();
      if (!/^[a-z0-9_\- ]+$/i.test(v)) continue;
      if (used.has(v)) continue;
      out.strictNames[k] = v;
      used.add(v);
    }
    const seen = new Set();
    for (const k of orderFields) {
      const v = String(out.strictNames[k] || "").trim() || k;
      if (!/^[a-z0-9_-]+$/.test(v) || seen.has(v)) out.strictNames[k] = k;
      seen.add(out.strictNames[k]);
    }
  }
  if (isObj(rawOrder.propertiesByField)) {
    for (const k of orderFields) {
      const v = String(rawOrder.propertiesByField[k] || "").trim();
      if (!v) continue;
      out.propertiesByField[k] = v;
    }
  }
  for (const k of orderKeys) out.enabled[k] = out.active[k] !== "no";
  for (const k of orderKeys) {
    const raw = String(out.freeRoam && out.freeRoam[k] ? out.freeRoam[k] : "off").trim().toLowerCase();
    out.freeRoam[k] = raw === "minimal" || raw === "full" ? raw : "off";
  }
  return out;
}

function getOrderStrictName(cfg, orderKey) {
  const key = normalizeOrderFieldKey(orderKey);
  if (!key) return "";
  const order = normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.order : null);
  const strict = isObj(order && order.strictNames) ? order.strictNames : {};
  const candidate = String(strict[key] || "").trim();
  if (/^[a-z0-9_-]+$/.test(candidate)) return candidate;
  return key;
}

function serializePkmOrderForMacro(cfg) {
  const order = normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.order : null);
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  const fr = isObj(behavior.freeRoam) ? behavior.freeRoam : {};
  order.freeRoamBehavior = {
    minimalSeparator: fr.minimalSeparator !== false,
    minimalPrefix: fr.minimalPrefix !== false,
    offPrefix: fr.offPrefix === true,
    fullPlacement: ["smart", "left", "right"].includes(String(fr.fullPlacement || "").trim().toLowerCase())
      ? String(fr.fullPlacement || "").trim().toLowerCase()
      : "smart",
  };
  return JSON.stringify(order);
}

function serializeDateRuntimeConfigForMacro(cfg) {
  const elementsCfg = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.elements)
    ? cfg.pkm.behavior.elements
    : {};
  const order = normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.order : null);
  const strict = isObj(order && order.strictNames) ? order.strictNames : {};
  const ORDER_DATE_DUE = `date_${"due"}`;
  const ORDER_DATE_START = `date_${"start"}`;
  const ORDER_TIME = ["ti", "me"].join("");
  const datesCanonical = {
    date_due: String(strict[ORDER_DATE_DUE] || ORDER_DATE_DUE).trim() || ORDER_DATE_DUE,
    date_start: String(strict[ORDER_DATE_START] || ORDER_DATE_START).trim() || ORDER_DATE_START,
    time: String(strict[ORDER_TIME] || ORDER_TIME).trim() || ORDER_TIME,
  };
  const dueName = String(datesCanonical.date_due || "").trim();
  const startName = String(datesCanonical.date_start || "").trim();
  const timeName = String(datesCanonical.time || "").trim();
  const byField = isObj(elementsCfg.byField) ? cloneJson(elementsCfg.byField) : {};
  const elementsByField = isObj(elementsCfg.byField) ? cloneJson(elementsCfg.byField) : {};
  const canonicalKeys = new Set([dueName, startName, timeName, DATE_RUNTIME_KEY_NOW, DATE_RUNTIME_KEY_ESTIMATED].filter(Boolean));
  const nonEmpty = (v) => String(v == null ? "" : v).trim();
  const mergeRuntimeField = (baseRow, incomingRow) => {
    const dst = isObj(baseRow) ? cloneJson(baseRow) : {};
    const src = isObj(incomingRow) ? cloneJson(incomingRow) : {};
    const out = { ...dst, ...src };
    if (!nonEmpty(src.emoji) && Object.prototype.hasOwnProperty.call(dst, "emoji")) out.emoji = String(dst.emoji || "");
    if (!nonEmpty(src.format) && Object.prototype.hasOwnProperty.call(dst, "format")) out.format = String(dst.format ?? "");
    if (isObj(dst.hotkey) || isObj(src.hotkey)) out.hotkey = { ...(isObj(dst.hotkey) ? dst.hotkey : {}), ...(isObj(src.hotkey) ? src.hotkey : {}) };
    if (isObj(dst.increment) || isObj(src.increment)) out.increment = { ...(isObj(dst.increment) ? dst.increment : {}), ...(isObj(src.increment) ? src.increment : {}) };
    return out;
  };
  for (const key of Object.keys(elementsByField)) {
    const normKey = String(key || "").trim();
    if (!normKey || canonicalKeys.has(normKey)) continue;
    byField[normKey] = mergeRuntimeField(byField[normKey], elementsByField[key]);
  }
  return JSON.stringify({
    fields: Array.isArray(elementsCfg.fields) ? elementsCfg.fields.slice() : [],
    byField,
    canonical: {
      date_due: String(dueName || ""),
      date_start: String(startName || ""),
      time: String(timeName || ""),
    },
  });
}

function formatHotkeyBinding(binding) {
  if (!binding || !isObj(binding)) return "";
  const mods = Array.isArray(binding.modifiers) ? binding.modifiers.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const key = String(binding.key || "").trim();
  if (!key) return "";
  return mods.length ? `${mods.join(" + ")} + ${key}` : key;
}

/**
 * Идентификатор команды в менеджере хоткеев -- полный: `<id плагина>:<id
 * команды>`. Раньше спрашивали голым, и менеджер не находил ничего никогда:
 * хоткеи полей-дат в заметке конфигурации всегда были пустыми. Имя плагина
 * приходит снаружи, а при его отсутствии спрашиваем как раньше -- пусть уж
 * лучше не найдёт, чем упадёт.
 */
function getBoundHotkeyForCommand(app, commandId, pluginId) {
  if (!app || !commandId) return "";
  const hm = app.hotkeyManager;
  if (!hm) return "";
  const bare = String(commandId || "").trim();
  const owner = String(pluginId || "").trim();
  const id = owner && bare.indexOf(":") === -1 ? owner + ":" + bare : bare;
  try {
    if (isObj(hm.customKeys) && Array.isArray(hm.customKeys[id]) && hm.customKeys[id].length) {
      return formatHotkeyBinding(hm.customKeys[id][0]);
    }
    if (typeof hm.getHotkeys === "function") {
      const arr = hm.getHotkeys(id);
      if (Array.isArray(arr) && arr.length) return formatHotkeyBinding(arr[0]);
    }
  } catch (_) {}
  return "";
}

function detectDateFieldHotkeys(app, cfg, fieldId, pluginId) {
  const fid = String(fieldId || "").trim();
  if (!fid) return { increase: "", decrease: "" };
  const incCandidates = [];
  const decCandidates = [];
  incCandidates.push(`inlineOverhaul_Hotkey_${fid}_increase`);
  decCandidates.push(`inlineOverhaul_Hotkey_${fid}_decrease`);
  let increase = "";
  let decrease = "";
  for (let i = 0; i < incCandidates.length && !increase; i++) increase = getBoundHotkeyForCommand(app, incCandidates[i], pluginId);
  for (let i = 0; i < decCandidates.length && !decrease; i++) decrease = getBoundHotkeyForCommand(app, decCandidates[i], pluginId);
  return { increase, decrease };
}

const DEFAULT_CONFIG = {
  schemaVersion: SCHEMA_VERSION,
  features: {
    navigation: { enabled: true },
    pkm: { enabled: true },
    visual: { enabled: true },
    transform: { enabled: true },
  },
  navigation: {
    moveLine: {
      enabled: true,
      noSelectionMode: "line-only",
      headerMode: "move-as-line",
      crossSectionAllowed: true,
      highlightMovedLines: false,
    },
    moveSelection: {
      enabled: true,
      inlineEnabled: true,
      prefixCyclerEnabled: true,
      indentFallbackEnabled: true,
      onCycleEnd: "indent",
      cycleOrder: ["#", "##", "###", "####", "#####", "1. ", "", "- "],
      inlineMoveMode: "auto",
    },
    jumpToHeader: {
      enabled: true,
      centerCursor: true,
      centerDelayMs: 60,
      centerThrottleMs: 200,
      jumpMode: "edge",
      edgeMode: "start-end",
      jumpCursorPosition: "start",
    },
    navigateInline: {
      enabled: true,
      stepMode: "word",
      boundaryJump: false,
      onBoundary: "wrap",
    },
  },
  rules: {},
  globalFunctions: {
    enhancedSelectAll: {
      enabled: false,
      mode: "line-note",
      useMultiPressDelay: false,
      delayMs: 700,
      clearSelectionOnLastPress: false,
    },
  },
  pkm: {
    taxonomy: {},
    tagWheelConfigPath: TAGWHEEL_CONFIG_NOTE_DEFAULT_PATH,
    tagWheelConfigTemplatePath: TAGWHEEL_CONFIG_TEMPLATE_DEFAULT_PATH,
    configExportMode: TAGWHEEL_CONFIG_MODE_DETAILED,
    executionBackend: PKM_BACKENDS.internalV2,
    generatedRulesPath: __pkmOptionKeys.DEFAULT_RULES_PATH,
    behavior: {
      subtagFormat: "separate",
      cycleEndBehavior: "keep-bullet",
      cursorPolicy: "text_end",
      tagWheelScroller: {
        enabled: false,
        direction: "full",
        size: 3,
      },
      colors: {
        tagwheelHeader: {
          defaultTextColor: "",
          fillColor: "",
          showPrefix: true,
        },
      },
      tagVisuals: {
        showColorSettings: false,
        tagTextSizePct: 100,
        tagBubbleWidthPct: 100,
        tagBubbleHeightPct: 100,
        emptyBubbleSizePct: 100,
        tagShapePct: 0,
        opacity: {
          left: 1,
          right: 1,
        },
        byField: {},
        byTag: {},
        userTags: {},
        strip: {
          active: false,
          fieldId: "",
          tagVisibility: true,
          hideSeparatorWhenOnlyStripToken: false,
          mode: "default",
          stripesToShow: 2,
          spacing: 20,
          thickness: 2,
          childOffset: 12,
        },
      },
      freeRoam: {
        minimalSeparator: true,
        minimalPrefix: true,
        offPrefix: false,
        fullPlacement: "smart",
      },
      io: {
        separator1: "||",
        separator2: "||",
      },
      order: makeDefaultPkmOrder(),
    },
  },
  visual: {
    displayModes: {},
    colors: {},
  },
  transform: {
    inline2fleet: {},
    inline2note: {},
  },
  backups: {
    tagWheelConfigApplies: [],
  },
  meta: {},
  ui: {
    activeSettingsTab: "general",
    visualSubTab: "tags",
    hotkeysSubTab: "global",
    pkmSubTab: "main",
    orderShowInfoTips: false,
    orderShowDeepEditor: true,
    orderShowColorSettings: true,
    orderActiveCommandsCollapsed: true,
    binderRows: [
      {
        rowId: "binder-system-smart-bracket",
        insertText: "[]",
        commandName: "Smart bracket",
        description: "Smart bracket",
        commandId: BINDER_SMART_BRACKET_COMMAND_ID,
      },
    ],
  },
  devMode: {
    enabled: false,
    generateAiLog: true,
    traceTagVisualLine: false,
    logPath: "InlineOverhaul_DevLog",
  },
};

function normalizePkmTopLevelConfig(cfg) {
  if (!isObj(cfg.pkm)) cfg.pkm = cloneJson(DEFAULT_CONFIG.pkm);
  cfg.pkm.executionBackend = PKM_BACKENDS.internalV2;
  if (typeof cfg.pkm.generatedRulesPath !== "string" || !cfg.pkm.generatedRulesPath.trim()) {
    const allowShim = typeof __compatProfile.isCompatEnabled === "function"
      ? __compatProfile.isCompatEnabled("ENABLE_CONFIG_MIGRATION_SHIMS")
      : true;
    if (allowShim && isObj(cfg.rules) && typeof cfg.rules.tagWheelPath === "string" && cfg.rules.tagWheelPath.trim()) {
      cfg.pkm.generatedRulesPath = String(cfg.rules.tagWheelPath).trim();
    } else {
      cfg.pkm.generatedRulesPath = DEFAULT_CONFIG.pkm.generatedRulesPath;
    }
  }
  if (typeof cfg.pkm.tagWheelConfigPath !== "string" || !cfg.pkm.tagWheelConfigPath.trim()) {
    cfg.pkm.tagWheelConfigPath = DEFAULT_CONFIG.pkm.tagWheelConfigPath;
  }
  if (typeof cfg.pkm.tagWheelConfigTemplatePath !== "string" || !cfg.pkm.tagWheelConfigTemplatePath.trim()) {
    cfg.pkm.tagWheelConfigTemplatePath = DEFAULT_CONFIG.pkm.tagWheelConfigTemplatePath;
  }
  if (![TAGWHEEL_CONFIG_MODE_DETAILED, TAGWHEEL_CONFIG_MODE_MINIMAL].includes(String(cfg.pkm.configExportMode || ""))) {
    cfg.pkm.configExportMode = DEFAULT_CONFIG.pkm.configExportMode;
  }
  const deprecatedPkm = Array.isArray(__compatProfile.DEPRECATED_CONFIG_KEYS?.pkm)
    ? __compatProfile.DEPRECATED_CONFIG_KEYS.pkm
    : ["sourceOfTruth", "autoGenerateRules"];
  for (const key of deprecatedPkm) delete cfg.pkm[key];
}

function migrateConfig(raw) {
  const source = isObj(raw) ? raw : {};
  let cfg = deepMerge(DEFAULT_CONFIG, source);
  const ver = Number(cfg.schemaVersion) || 0;

  if (ver < 1) {
    cfg.schemaVersion = 1;
  }

  if (!isObj(cfg.features)) cfg.features = cloneJson(DEFAULT_CONFIG.features);
  for (const feature of FEATURE_ORDER) {
    if (!isObj(cfg.features[feature])) cfg.features[feature] = { enabled: true };
    if (typeof cfg.features[feature].enabled !== "boolean") cfg.features[feature].enabled = true;
  }

  if (!isObj(cfg.ui)) cfg.ui = cloneJson(DEFAULT_CONFIG.ui);
  if (cfg.ui.activeSettingsTab === "colors") cfg.ui.activeSettingsTab = "visual";
  if (SETTINGS_TABS.findIndex((t) => t.id === cfg.ui.activeSettingsTab) === -1) {
    cfg.ui.activeSettingsTab = "general";
  }
  if (VISUAL_SUB_TABS.findIndex((t) => t.id === cfg.ui.visualSubTab) === -1) {
    cfg.ui.visualSubTab = "tags";
  }
  if (HOTKEYS_SUB_TABS.findIndex((t) => t.id === cfg.ui.hotkeysSubTab) === -1) {
    cfg.ui.hotkeysSubTab = "global";
  }
  if (!["main", "behavior"].includes(String(cfg.ui.pkmSubTab || "").trim())) {
    cfg.ui.pkmSubTab = "main";
  }
  if (typeof cfg.ui.orderShowInfoTips !== "boolean") cfg.ui.orderShowInfoTips = false;
  if (typeof cfg.ui.orderShowDeepEditor !== "boolean") cfg.ui.orderShowDeepEditor = true;
  if (typeof cfg.ui.orderShowColorSettings !== "boolean") cfg.ui.orderShowColorSettings = true;
  if (typeof cfg.ui.orderActiveCommandsCollapsed !== "boolean") cfg.ui.orderActiveCommandsCollapsed = true;
  cfg.ui.binderRows = normalizeBinderRows(cfg.ui.binderRows);

  if (!isObj(cfg.rules)) cfg.rules = cloneJson(DEFAULT_CONFIG.rules);
  {
    const deprecatedRules = Array.isArray(__compatProfile.DEPRECATED_CONFIG_KEYS?.rules)
      ? __compatProfile.DEPRECATED_CONFIG_KEYS.rules
      : ["tagWheelPath"];
    for (const key of deprecatedRules) delete cfg.rules[key];
  }

  if (!isObj(cfg.globalFunctions)) cfg.globalFunctions = cloneJson(DEFAULT_CONFIG.globalFunctions);
  if (!isObj(cfg.globalFunctions.enhancedSelectAll)) cfg.globalFunctions.enhancedSelectAll = cloneJson(DEFAULT_CONFIG.globalFunctions.enhancedSelectAll);
  if (typeof cfg.globalFunctions.enhancedSelectAll.enabled !== "boolean") {
    cfg.globalFunctions.enhancedSelectAll.enabled = false;
  }
  if (!["line-note", "line-tree-note", "line-tree-header-note"].includes(cfg.globalFunctions.enhancedSelectAll.mode)) {
    cfg.globalFunctions.enhancedSelectAll.mode = "line-note";
  }
  if (typeof cfg.globalFunctions.enhancedSelectAll.useMultiPressDelay !== "boolean") {
    cfg.globalFunctions.enhancedSelectAll.useMultiPressDelay = false;
  }
  const oldDelay = Number(cfg.globalFunctions.enhancedSelectAll.multiPressWindowMs);
  const curDelay = Number(cfg.globalFunctions.enhancedSelectAll.delayMs);
  const pickedDelay = Number.isFinite(curDelay) ? curDelay : (Number.isFinite(oldDelay) ? oldDelay : 700);
  cfg.globalFunctions.enhancedSelectAll.delayMs = Math.max(250, Math.min(2000, Math.floor(pickedDelay)));
  delete cfg.globalFunctions.enhancedSelectAll.multiPressWindowMs;
  if (typeof cfg.globalFunctions.enhancedSelectAll.clearSelectionOnLastPress !== "boolean") {
    cfg.globalFunctions.enhancedSelectAll.clearSelectionOnLastPress = false;
  }

  if (!isObj(cfg.navigation)) cfg.navigation = cloneJson(DEFAULT_CONFIG.navigation);
  {
    const deprecatedNavigation = Array.isArray(__compatProfile.DEPRECATED_CONFIG_KEYS?.navigation)
      ? __compatProfile.DEPRECATED_CONFIG_KEYS.navigation
      : ["topRevealOffsetLines"];
    for (const key of deprecatedNavigation) delete cfg.navigation[key];
  }
  cfg.navigation.moveLine = deepMerge(DEFAULT_CONFIG.navigation.moveLine, isObj(cfg.navigation.moveLine) ? cfg.navigation.moveLine : {});
  delete cfg.navigation.moveLine.topRevealOffsetLines;
  if (typeof cfg.navigation.moveLine.highlightMovedLines !== "boolean") {
    cfg.navigation.moveLine.highlightMovedLines = false;
  }
  cfg.navigation.moveSelection = deepMerge(DEFAULT_CONFIG.navigation.moveSelection, isObj(cfg.navigation.moveSelection) ? cfg.navigation.moveSelection : {});
  if (typeof cfg.navigation.moveSelection.inlineEnabled !== "boolean") {
    cfg.navigation.moveSelection.inlineEnabled = typeof cfg.navigation.moveSelection.enabled === "boolean"
      ? cfg.navigation.moveSelection.enabled
      : true;
  }
  if (typeof cfg.navigation.moveSelection.prefixCyclerEnabled !== "boolean") {
    cfg.navigation.moveSelection.prefixCyclerEnabled = true;
  }
  if (typeof cfg.navigation.moveSelection.indentFallbackEnabled !== "boolean") {
    cfg.navigation.moveSelection.indentFallbackEnabled = true;
  }
  if (!["indent", "wrap"].includes(cfg.navigation.moveSelection.onCycleEnd)) {
    cfg.navigation.moveSelection.onCycleEnd = "indent";
  }
  cfg.navigation.moveSelection.enabled = cfg.navigation.moveSelection.inlineEnabled;
  if (!Array.isArray(cfg.navigation.moveSelection.cycleOrder) || !cfg.navigation.moveSelection.cycleOrder.length) {
    if (Array.isArray(cfg.navigation.moveSelection.leftToRight) && cfg.navigation.moveSelection.leftToRight.length) {
      cfg.navigation.moveSelection.cycleOrder = cfg.navigation.moveSelection.leftToRight.slice();
    } else {
      cfg.navigation.moveSelection.cycleOrder = DEFAULT_CONFIG.navigation.moveSelection.cycleOrder.slice();
    }
  }
  delete cfg.navigation.moveSelection.leftToRight;
  delete cfg.navigation.moveSelection.rightToLeft;
  delete cfg.navigation.moveSelection.indentWidth;
  if (["auto", "char", "word", "disabled"].indexOf(cfg.navigation.moveSelection.inlineMoveMode) === -1) {
    cfg.navigation.moveSelection.inlineMoveMode = "auto";
  }
  cfg.navigation.jumpToHeader = deepMerge(DEFAULT_CONFIG.navigation.jumpToHeader, isObj(cfg.navigation.jumpToHeader) ? cfg.navigation.jumpToHeader : {});
  if (!["edge", "line"].includes(cfg.navigation.jumpToHeader.jumpMode)) {
    cfg.navigation.jumpToHeader.jumpMode = "edge";
  }
  if (!["start-end", "start", "end"].includes(cfg.navigation.jumpToHeader.edgeMode)) {
    let inferredEdge = "start-end";
    if (cfg.navigation.jumpToHeader.insideTarget === "section-start" && cfg.navigation.jumpToHeader.boundaryTarget === "section-start") inferredEdge = "start";
    if (cfg.navigation.jumpToHeader.insideTarget === "section-end" && cfg.navigation.jumpToHeader.boundaryTarget === "section-end") inferredEdge = "end";
    cfg.navigation.jumpToHeader.edgeMode = inferredEdge;
  }
  if (!["start", "end", "section-end"].includes(cfg.navigation.jumpToHeader.jumpCursorPosition)) {
    if (cfg.navigation.jumpToHeader.endAnchorMode === "active-text-end") cfg.navigation.jumpToHeader.jumpCursorPosition = "section-end";
    else cfg.navigation.jumpToHeader.jumpCursorPosition = "start";
  }
  delete cfg.navigation.jumpToHeader.insideTarget;
  delete cfg.navigation.jumpToHeader.boundaryTarget;
  delete cfg.navigation.jumpToHeader.endAnchorMode;
  delete cfg.navigation.jumpToHeader.upInsideTarget;
  delete cfg.navigation.jumpToHeader.upBoundaryTarget;
  delete cfg.navigation.jumpToHeader.downInsideTarget;
  delete cfg.navigation.jumpToHeader.downBoundaryTarget;
  cfg.navigation.navigateInline = deepMerge(DEFAULT_CONFIG.navigation.navigateInline, isObj(cfg.navigation.navigateInline) ? cfg.navigation.navigateInline : {});
  delete cfg.navigation.navigateInline.rulesPath;
  if (!["word", "sentence", "begin-end"].includes(cfg.navigation.navigateInline.stepMode)) {
    cfg.navigation.navigateInline.stepMode = "word";
  }
  if (typeof cfg.navigation.navigateInline.boundaryJump !== "boolean") {
    cfg.navigation.navigateInline.boundaryJump = false;
  }
  if (!["stay", "wrap", "next-line"].includes(cfg.navigation.navigateInline.onBoundary)) {
    cfg.navigation.navigateInline.onBoundary = "wrap";
  }

  normalizePkmTopLevelConfig(cfg);
  cfg = getTransformFeature().normalizeTransformConfig(cfg);
  if (!isObj(cfg.pkm.behavior)) cfg.pkm.behavior = cloneJson(DEFAULT_CONFIG.pkm.behavior);
  if (!["separate", "combined"].includes(cfg.pkm.behavior.subtagFormat)) {
    cfg.pkm.behavior.subtagFormat = "separate";
  }
  cfg.pkm.behavior.cycleEndBehavior = normalizeCycleEndBehaviorLegacy(cfg.pkm.behavior.cycleEndBehavior);
  {
    const cp = String(cfg.pkm.behavior.cursorPolicy || "").trim();
    if (!["text_end", "current_position", "line_end"].includes(cp)) cfg.pkm.behavior.cursorPolicy = "text_end";
  }
  if (!isObj(cfg.pkm.behavior.tagWheelScroller)) cfg.pkm.behavior.tagWheelScroller = cloneJson(DEFAULT_CONFIG.pkm.behavior.tagWheelScroller);
  {
    const tws = cfg.pkm.behavior.tagWheelScroller;
    if (typeof tws.enabled !== "boolean") tws.enabled = DEFAULT_CONFIG.pkm.behavior.tagWheelScroller.enabled;
    const dir = String(tws.direction || "").trim().toLowerCase();
    tws.direction = ["up", "down", "full"].includes(dir)
      ? dir
      : DEFAULT_CONFIG.pkm.behavior.tagWheelScroller.direction;
    const n = Math.trunc(Number(tws.size));
    tws.size = Number.isFinite(n)
      ? Math.max(1, Math.min(20, n))
      : DEFAULT_CONFIG.pkm.behavior.tagWheelScroller.size;
  }
  if (!isObj(cfg.pkm.behavior.colors)) cfg.pkm.behavior.colors = cloneJson(DEFAULT_CONFIG.pkm.behavior.colors);
  if (!isObj(cfg.pkm.behavior.colors.tagwheelHeader)) {
    cfg.pkm.behavior.colors.tagwheelHeader = cloneJson(DEFAULT_CONFIG.pkm.behavior.colors.tagwheelHeader);
  }
  {
    const headerColors = cfg.pkm.behavior.colors.tagwheelHeader;
    const normalizeHex = (value) => {
      const src = String(value || "").trim().toLowerCase();
      if (!src) return "";
      return /^#[0-9a-f]{6}$/.test(src) ? src : "";
    };
    headerColors.defaultTextColor = normalizeHex(headerColors.defaultTextColor);
    headerColors.fillColor = normalizeHex(headerColors.fillColor);
    if (typeof headerColors.showPrefix !== "boolean") headerColors.showPrefix = true;
  }
  if (!isObj(cfg.pkm.behavior.tagVisuals)) cfg.pkm.behavior.tagVisuals = cloneJson(DEFAULT_CONFIG.pkm.behavior.tagVisuals);
  {
    const visuals = isObj(cfg.pkm.behavior.tagVisuals) ? cfg.pkm.behavior.tagVisuals : {};
    if (typeof visuals.showColorSettings !== "boolean") {
      visuals.showColorSettings = DEFAULT_CONFIG.pkm.behavior.tagVisuals.showColorSettings;
    }
    const legacySizeN = Math.trunc(Number(visuals.tagSizePct));
    const legacySize = Number.isFinite(legacySizeN)
      ? Math.max(80, Math.min(140, legacySizeN))
      : 100;
    const textSizeN = Math.trunc(Number(visuals.tagTextSizePct));
    visuals.tagTextSizePct = Number.isFinite(textSizeN)
      ? Math.max(80, Math.min(140, textSizeN))
      : legacySize;
    const legacyBubbleN = Math.trunc(Number(visuals.tagBubbleSizePct));
    const legacyBubble = Number.isFinite(legacyBubbleN)
      ? Math.max(80, Math.min(140, legacyBubbleN))
      : legacySize;
    const bubbleWidthN = Math.trunc(Number(visuals.tagBubbleWidthPct));
    visuals.tagBubbleWidthPct = Number.isFinite(bubbleWidthN)
      ? Math.max(80, Math.min(140, bubbleWidthN))
      : legacyBubble;
    const bubbleHeightN = Math.trunc(Number(visuals.tagBubbleHeightPct));
    visuals.tagBubbleHeightPct = Number.isFinite(bubbleHeightN)
      ? Math.max(80, Math.min(140, bubbleHeightN))
      : legacyBubble;
    const emptyBubbleN = Math.trunc(Number(visuals.emptyBubbleSizePct));
    visuals.emptyBubbleSizePct = Number.isFinite(emptyBubbleN)
      ? Math.max(50, Math.min(180, emptyBubbleN))
      : 100;
    delete visuals.tagSizePct;
    delete visuals.tagBubbleSizePct;
    const shapeN = Math.trunc(Number(visuals.tagShapePct));
    visuals.tagShapePct = Number.isFinite(shapeN)
      ? Math.max(0, Math.min(100, shapeN))
      : DEFAULT_CONFIG.pkm.behavior.tagVisuals.tagShapePct;

    if (!isObj(visuals.opacity)) visuals.opacity = cloneJson(DEFAULT_CONFIG.pkm.behavior.tagVisuals.opacity);
    const normOpacity = (value, fallback) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(0, Math.min(1, n));
    };
    visuals.opacity.left = normOpacity(visuals.opacity.left, DEFAULT_CONFIG.pkm.behavior.tagVisuals.opacity.left);
    visuals.opacity.right = normOpacity(visuals.opacity.right, DEFAULT_CONFIG.pkm.behavior.tagVisuals.opacity.right);

    const normalizeTagToken = (token) => {
      const src = String(token || "").trim();
      if (!src) return "";
      return src.charAt(0) === "#" ? src : "";
    };
    const normalizeVisibility = (value, fallback) => {
      const mode = String(value || "").trim().toLowerCase();
      if (mode === "empty" || mode === "default" || mode === "custom") return mode;
      return fallback;
    };
    const normalizeTagVisualRow = (row, fallbackVisibility) => {
      const src = isObj(row) ? row : {};
      const fillColor = normalizeHexColorInput(src.fillColor);
      const textColor = normalizeHexColorInput(src.textColor);
      const visibility = normalizeVisibility(src.visibility, fallbackVisibility);
      return {
        fillColor,
        textColor,
        visibility,
        customText: String(src.customText || "").trim(),
      };
    };

    const byFieldIn = isObj(visuals.byField) ? visuals.byField : {};
    const byFieldOut = {};
    for (const fieldIdRaw of Object.keys(byFieldIn)) {
      const fieldId = String(fieldIdRaw || "").trim();
      if (!fieldId) continue;
      const fieldRow = isObj(byFieldIn[fieldIdRaw]) ? byFieldIn[fieldIdRaw] : {};
      byFieldOut[fieldId] = {
        visibilityDefault: normalizeVisibility(fieldRow.visibilityDefault, "default"),
      };
    }
    visuals.byField = byFieldOut;

    const byTagIn = isObj(visuals.byTag) ? visuals.byTag : {};
    const byTagOut = {};
    for (const fieldIdRaw of Object.keys(byTagIn)) {
      const fieldId = String(fieldIdRaw || "").trim();
      if (!fieldId) continue;
      const fieldMap = isObj(byTagIn[fieldIdRaw]) ? byTagIn[fieldIdRaw] : {};
      const outFieldMap = {};
      for (const rawToken of Object.keys(fieldMap)) {
        const token = normalizeTagToken(rawToken);
        if (!token || Object.prototype.hasOwnProperty.call(outFieldMap, token)) continue;
        outFieldMap[token] = normalizeTagVisualRow(fieldMap[rawToken], "default");
      }
      byTagOut[fieldId] = outFieldMap;
    }
    visuals.byTag = byTagOut;

    const userTagsIn = isObj(visuals.userTags) ? visuals.userTags : {};
    const userTagsOut = {};
    for (const rawToken of Object.keys(userTagsIn)) {
      const token = normalizeTagToken(rawToken);
      if (!token || Object.prototype.hasOwnProperty.call(userTagsOut, token)) continue;
      /*
       * Надгробие. Единственный шов записи у панели -- setConfigPatch, а он
       * идёт через deepMerge, который ключ карты убрать не умеет: на месте
       * удалённого остаётся null. Раньше null превращался здесь в строку с
       * цветами темы, и удалённый тег возвращался в список на первой же
       * перерисовке -- то есть удаление своего тега не работало вовсе.
       */
      if (userTagsIn[rawToken] === null) continue;
      userTagsOut[token] = normalizeTagVisualRow(userTagsIn[rawToken], "default");
    }
    visuals.userTags = userTagsOut;

    if (isObj(visuals.line)) delete visuals.line;

    if (!isObj(visuals.strip)) visuals.strip = cloneJson(DEFAULT_CONFIG.pkm.behavior.tagVisuals.strip);
    const strip = __priorityStripEngine.normalizeStripConfig(visuals.strip);
    visuals.strip = strip;

    cfg.pkm.behavior.tagVisuals = visuals;
  }
  if (!isObj(cfg.pkm.behavior.io)) cfg.pkm.behavior.io = cloneJson(DEFAULT_CONFIG.pkm.behavior.io);
  {
    const s1 = String(cfg.pkm.behavior.io.separator1 || "").trim();
    const s2 = String(cfg.pkm.behavior.io.separator2 || "").trim();
    cfg.pkm.behavior.io.separator1 = s1 || DEFAULT_CONFIG.pkm.behavior.io.separator1;
    cfg.pkm.behavior.io.separator2 = s2 || DEFAULT_CONFIG.pkm.behavior.io.separator2;
  }
  if (!isObj(cfg.pkm.behavior.freeRoam)) cfg.pkm.behavior.freeRoam = cloneJson(DEFAULT_CONFIG.pkm.behavior.freeRoam);
  {
    const fr = cfg.pkm.behavior.freeRoam;
    if (typeof fr.minimalSeparator !== "boolean") fr.minimalSeparator = DEFAULT_CONFIG.pkm.behavior.freeRoam.minimalSeparator;
    if (typeof fr.minimalPrefix !== "boolean") fr.minimalPrefix = DEFAULT_CONFIG.pkm.behavior.freeRoam.minimalPrefix;
    if (typeof fr.offPrefix !== "boolean") fr.offPrefix = DEFAULT_CONFIG.pkm.behavior.freeRoam.offPrefix;
    const place = String(fr.fullPlacement || "").trim().toLowerCase();
    fr.fullPlacement = ["smart", "left", "right"].includes(place)
      ? place
      : DEFAULT_CONFIG.pkm.behavior.freeRoam.fullPlacement;
  }
  cfg.pkm.behavior.order = normalizePkmOrder(cfg.pkm.behavior.order);
  ensureBehaviorModesFromOrder(cfg);
  cfg = getConfigMigrationModule().normalizePkmBehaviorShape(cfg, { cloneJson, isObj });

  if (!isObj(cfg.backups)) cfg.backups = cloneJson(DEFAULT_CONFIG.backups);
  if (!Array.isArray(cfg.backups.tagWheelConfigApplies)) cfg.backups.tagWheelConfigApplies = [];

  if (!isObj(cfg.meta)) cfg.meta = cloneJson(DEFAULT_CONFIG.meta);

  if (!isObj(cfg.devMode)) cfg.devMode = cloneJson(DEFAULT_CONFIG.devMode);
  if (typeof cfg.devMode.enabled !== "boolean") cfg.devMode.enabled = DEFAULT_CONFIG.devMode.enabled;
  if (typeof cfg.devMode.traceTagVisualLine !== "boolean") cfg.devMode.traceTagVisualLine = DEFAULT_CONFIG.devMode.traceTagVisualLine;
  {
    const p = String(cfg.devMode.logPath || "").trim();
    cfg.devMode.logPath = p || DEFAULT_CONFIG.devMode.logPath;
  }
  {
    const oldLevel = String(cfg.devMode.logLevel || "").trim().toLowerCase();
    const oldSize = String(cfg.devMode.logSize || "").trim();
    if (typeof cfg.devMode.generateAiLog !== "boolean") {
      if (oldSize) cfg.devMode.generateAiLog = oldSize === "for AI";
      else if (oldLevel) cfg.devMode.generateAiLog = ["trace", "info"].includes(oldLevel);
      else cfg.devMode.generateAiLog = DEFAULT_CONFIG.devMode.generateAiLog;
    }
  }
  if (typeof cfg.devMode.generateAiLog !== "boolean") cfg.devMode.generateAiLog = DEFAULT_CONFIG.devMode.generateAiLog;
  {
    const deprecatedDevMode = Array.isArray(__compatProfile.DEPRECATED_CONFIG_KEYS?.devMode)
      ? __compatProfile.DEPRECATED_CONFIG_KEYS.devMode
      : ["logLevel", "maxFileSizeKb", "maxRecords", "logSize"];
    for (const key of deprecatedDevMode) delete cfg.devMode[key];
  }

  cfg.schemaVersion = SCHEMA_VERSION;
  return cfg;
}

function getActiveTagWheelRulesPath(cfg) {
  const pkm = isObj(cfg && cfg.pkm) ? cfg.pkm : {};
  const generated = String(pkm.generatedRulesPath || "").trim();
  if (generated) return generated;
  return String(DEFAULT_CONFIG.pkm.generatedRulesPath);
}

function normalizeHexColorInput(value) {
  const src = String(value || "").trim().toLowerCase();
  if (!src) return "";
  return /^#[0-9a-f]{6}$/.test(src) ? src : "";
}

function getTagwheelHeaderColorsFromConfig(cfg) {
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  const colors = isObj(behavior.colors) ? behavior.colors : {};
  const header = isObj(colors.tagwheelHeader) ? colors.tagwheelHeader : {};
  return {
    defaultTextColor: normalizeHexColorInput(header.defaultTextColor),
    fillColor: normalizeHexColorInput(header.fillColor),
    showPrefix: header.showPrefix !== false,
  };
}

function buildTagwheelPlaceholderSetFromConfig(cfg) {
  const out = new Set();
  const order = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.order)
    ? cfg.pkm.behavior.order
    : {};
  const labels = isObj(order.labels) ? order.labels : {};
  for (const key of Object.keys(labels)) {
    const value = String(labels[key] || "").trim();
    if (value) out.add(value);
  }
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  const modes = [
    isObj(behavior.leftMode) ? behavior.leftMode : {},
    isObj(behavior.rightMode) ? behavior.rightMode : {},
  ];
  for (const mode of modes) {
    const fields = Array.isArray(mode.fields) ? mode.fields : [];
    for (const field of fields) {
      const id = String(field && field.id || "").trim();
      const placeholder = String(field && field.placeholder || "").trim();
      if (id) out.add(id);
      if (placeholder) out.add(placeholder);
    }
  }
  return out;
}

function getTagVisualsFromConfig(cfg) {
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  const visuals = isObj(behavior.tagVisuals) ? behavior.tagVisuals : {};
  const ui = isObj(cfg && cfg.ui) ? cfg.ui : {};
  const opacity = isObj(visuals.opacity) ? visuals.opacity : {};
  const strip = __priorityStripEngine.normalizeStripConfig(isObj(visuals.strip) ? visuals.strip : {});
  const clamp01 = (v, f) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return f;
    return Math.max(0, Math.min(1, n));
  };
  return {
    opacityLeft: clamp01(opacity.left, 1),
    opacityRight: clamp01(opacity.right, 1),
    tagTextSizePct: Number.isFinite(Math.trunc(Number(visuals.tagTextSizePct)))
      ? Math.max(80, Math.min(140, Math.trunc(Number(visuals.tagTextSizePct))))
      : 100,
    tagBubbleWidthPct: Number.isFinite(Math.trunc(Number(visuals.tagBubbleWidthPct)))
      ? Math.max(80, Math.min(140, Math.trunc(Number(visuals.tagBubbleWidthPct))))
      : 100,
    tagBubbleHeightPct: Number.isFinite(Math.trunc(Number(visuals.tagBubbleHeightPct)))
      ? Math.max(80, Math.min(140, Math.trunc(Number(visuals.tagBubbleHeightPct))))
      : 100,
    emptyBubbleSizePct: Number.isFinite(Math.trunc(Number(visuals.emptyBubbleSizePct)))
      ? Math.max(50, Math.min(180, Math.trunc(Number(visuals.emptyBubbleSizePct))))
      : 100,
    tagShapePct: Number.isFinite(Math.trunc(Number(visuals.tagShapePct)))
      ? Math.max(0, Math.min(100, Math.trunc(Number(visuals.tagShapePct))))
      : 0,
    byTag: isObj(visuals.byTag) ? visuals.byTag : {},
    userTags: isObj(visuals.userTags) ? visuals.userTags : {},
    separator1TextColor: normalizeHexColorInput(visuals.separator1TextColor) || normalizeHexColorInput(ui.separator1TextColor),
    separator2TextColor: normalizeHexColorInput(visuals.separator2TextColor) || normalizeHexColorInput(ui.separator2TextColor),
    stripActive: strip.active === true,
    strip,
  };
}

function computeTagVisualStyle(textSizePct, bubbleWidthPct, bubbleHeightPct, shapePct) {
  const textSize = Number.isFinite(Math.trunc(Number(textSizePct))) ? Math.max(80, Math.min(140, Math.trunc(Number(textSizePct)))) : 100;
  const bubbleWidth = Number.isFinite(Math.trunc(Number(bubbleWidthPct))) ? Math.max(80, Math.min(140, Math.trunc(Number(bubbleWidthPct)))) : 100;
  const bubbleHeight = Number.isFinite(Math.trunc(Number(bubbleHeightPct))) ? Math.max(80, Math.min(140, Math.trunc(Number(bubbleHeightPct)))) : 100;
  const shape = Number.isFinite(Math.trunc(Number(shapePct))) ? Math.max(0, Math.min(100, Math.trunc(Number(shapePct)))) : 0;
  const textScale = textSize / 100;
  const bubbleScaleX = bubbleWidth / 100;
  const bubbleScaleY = bubbleHeight / 100;
  const t = shape / 100;
  const eased = t <= 0.5
    ? (t / 0.5) * 0.45
    : (0.45 + ((t - 0.5) / 0.5) * 0.55);
  const radiusPx = Math.max(0, Math.round(16 * (1 - eased)));
  return {
    textSize,
    bubbleWidth,
    bubbleHeight,
    shape,
    borderRadiusPx: radiusPx,
    horizontalPaddingPx: Math.max(2, Math.round(6 * bubbleScaleX)),
    verticalPaddingPx: Math.max(1, Math.round(3 * bubbleScaleY)),
    fontSizePx: Math.max(10, Math.round(14 * textScale)),
    lineHeight: 1.2,
  };
}

function formatFieldTokenForVisual(field, rawToken) {
  const tok = String(rawToken || "").trim();
  if (!tok) return "";
  if (/^#\S+/.test(tok)) return tok;
  const pref = typeof field?.prefix === "string" ? field.prefix : "#";
  if (!pref && /^\/\S+/.test(tok)) return `#${tok}`;
  return `${pref}${tok}`;
}

function buildFieldTagVisualMap(cfg) {
  const out = {};
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  const visuals = getTagVisualsFromConfig(cfg);
  const byTag = visuals.byTag;
  const fields = []
    .concat(Array.isArray(behavior.leftMode?.fields) ? behavior.leftMode.fields : [])
    .concat(Array.isArray(behavior.rightMode?.fields) ? behavior.rightMode.fields : []);
  for (const field of fields) {
    const fieldId = String(field && field.id || "").trim();
    if (!fieldId) continue;
    const map = isObj(byTag[fieldId]) ? byTag[fieldId] : {};
    const values = Array.isArray(field && field.values) ? field.values : [];
    for (const row of values) {
      const raw = typeof row === "string" ? row : String(row && row.token || "");
      const token = formatFieldTokenForVisual(field, raw);
      if (!/^#\S+/.test(token)) continue;
      const visual = isObj(map[token]) ? map[token] : null;
      if (!visual) continue;
      const nextRow = normalizeRuntimeTagVisualRow(visual);
      if (!Object.prototype.hasOwnProperty.call(out, token)) {
        out[token] = nextRow;
      } else {
        out[token] = pickStrongerTagVisualRow(out[token], nextRow, 20, 20);
      }
      const tokenNorm = normalizeVisualTokenKey(token);
      if (tokenNorm) {
        if (!Object.prototype.hasOwnProperty.call(out, tokenNorm)) {
          out[tokenNorm] = nextRow;
        } else {
          out[tokenNorm] = pickStrongerTagVisualRow(out[tokenNorm], nextRow, 20, 20);
        }
      }
    }
  }
  return out;
}

function buildGlobalTagVisualMap(cfg) {
  const out = {};
  const visuals = getTagVisualsFromConfig(cfg);
  const byTag = isObj(visuals.byTag) ? visuals.byTag : {};
  const fieldIds = Object.keys(byTag);
  for (let fi = 0; fi < fieldIds.length; fi++) {
    const fieldId = String(fieldIds[fi] || "").trim();
    if (!fieldId) continue;
    const fieldRows = isObj(byTag[fieldId]) ? byTag[fieldId] : {};
    const tokens = Object.keys(fieldRows);
    for (let ti = 0; ti < tokens.length; ti++) {
      const token = String(tokens[ti] || "").trim();
      if (!token || token.charAt(0) !== "#") continue;
      const row = isObj(fieldRows[token]) ? normalizeRuntimeTagVisualRow(fieldRows[token]) : null;
      if (!row) continue;
      if (!Object.prototype.hasOwnProperty.call(out, token)) {
        out[token] = row;
      } else {
        out[token] = pickStrongerTagVisualRow(out[token], row, 15, 15);
      }
      const tokenNorm = normalizeVisualTokenKey(token);
      if (tokenNorm) {
        if (!Object.prototype.hasOwnProperty.call(out, tokenNorm)) {
          out[tokenNorm] = row;
        } else {
          out[tokenNorm] = pickStrongerTagVisualRow(out[tokenNorm], row, 15, 15);
        }
      }
    }
  }
  return out;
}

function readTagVisualRowByTokenMaps(token, fieldMap, userTags, globalMap) {
  const keyExact = String(token || "").trim();
  const keyNorm = normalizeVisualTokenKey(keyExact);
  const fromFieldExact = keyExact && isObj(fieldMap && fieldMap[keyExact]) ? normalizeRuntimeTagVisualRow(fieldMap[keyExact]) : null;
  const fromFieldNorm = keyNorm && isObj(fieldMap && fieldMap[keyNorm]) ? normalizeRuntimeTagVisualRow(fieldMap[keyNorm]) : null;
  const fromField = fromFieldExact || fromFieldNorm || null;

  const fromGlobalExact = keyExact && isObj(globalMap && globalMap[keyExact]) ? normalizeRuntimeTagVisualRow(globalMap[keyExact]) : null;
  const fromGlobalNorm = keyNorm && isObj(globalMap && globalMap[keyNorm]) ? normalizeRuntimeTagVisualRow(globalMap[keyNorm]) : null;
  const fromGlobal = fromGlobalExact || fromGlobalNorm || null;

  const fromUserExact = keyExact && isObj(userTags && userTags[keyExact]) ? normalizeRuntimeTagVisualRow(userTags[keyExact]) : null;
  const fromUserNorm = keyNorm && isObj(userTags && userTags[keyNorm]) ? normalizeRuntimeTagVisualRow(userTags[keyNorm]) : null;
  const fromUser = fromUserExact || fromUserNorm || null;

  const fieldOrGlobal = fromField && fromGlobal
    ? pickStrongerTagVisualRow(fromField, fromGlobal, 20, 15)
    : (fromField || fromGlobal || null);

  if (fieldOrGlobal && fromUser) return pickStrongerTagVisualRow(fieldOrGlobal, fromUser, 20, 10);
  return fieldOrGlobal || fromUser || null;
}

function normalizeRuntimeTagVisualRow(row) {
  const src = isObj(row) ? row : {};
  const visibilityRaw = String(src.visibility || "default").trim().toLowerCase();
  const visibility = ["default", "empty", "custom"].includes(visibilityRaw) ? visibilityRaw : "default";
  return {
    fillColor: normalizeHexColorInput(src.fillColor),
    textColor: normalizeHexColorInput(src.textColor),
    visibility,
    customText: String(src.customText || "").trim(),
  };
}

function scoreTagVisualRow(row, sourceRank) {
  const safe = normalizeRuntimeTagVisualRow(row);
  const effective = resolveEffectiveTagVisualMode(safe);
  let score = effective === "custom" ? 30 : (effective === "empty" ? 20 : 10);
  if (effective === "custom" && safe.customText) score += 5;
  if (safe.fillColor) score += 2;
  if (safe.textColor) score += 1;
  score += Number.isFinite(Number(sourceRank)) ? Number(sourceRank) : 0;
  return score;
}

function pickStrongerTagVisualRow(a, b, sourceRankA, sourceRankB) {
  const ra = normalizeRuntimeTagVisualRow(a);
  const rb = normalizeRuntimeTagVisualRow(b);
  const sa = scoreTagVisualRow(ra, sourceRankA);
  const sb = scoreTagVisualRow(rb, sourceRankB);
  if (sb > sa) return rb;
  return ra;
}

function resolveEffectiveTagVisualMode(row) {
  const mode = ["default", "empty", "custom"].includes(String(row && row.visibility || "default").trim().toLowerCase())
    ? String(row && row.visibility || "default").trim().toLowerCase()
    : "default";
  if (mode !== "custom") return mode;
  return String(row && row.customText || "").trim() ? "custom" : "empty";
}

function buildTagTokenSetForField(cfg, selectedFieldId) {
  const out = new Set();
  const fid = String(selectedFieldId || "").trim();
  if (!fid) return out;
  const pushStrict = (value) => {
    const tok = String(value || "").trim();
    if (!tok || tok.charAt(0) !== "#") return;
    out.add(tok);
  };
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  const fields = []
    .concat(Array.isArray(behavior.leftMode?.fields) ? behavior.leftMode.fields : [])
    .concat(Array.isArray(behavior.rightMode?.fields) ? behavior.rightMode.fields : []);
  for (const field of fields) {
    const id = String(field && field.id || "").trim();
    if (id !== fid && id !== `${fid}_sub`) continue;
    const values = Array.isArray(field && field.values) ? field.values : [];
    for (const row of values) {
      const raw = typeof row === "string" ? row : String(row && row.token || "");
      pushStrict(raw);
      const token = formatFieldTokenForVisual(field, raw);
      pushStrict(token);
    }
  }
  const visuals = isObj(behavior.tagVisuals) ? behavior.tagVisuals : {};
  const byTag = isObj(visuals.byTag) ? visuals.byTag : {};
  const fieldMaps = [];
  if (isObj(byTag[fid])) fieldMaps.push(byTag[fid]);
  if (isObj(byTag[`${fid}_sub`])) fieldMaps.push(byTag[`${fid}_sub`]);
  for (const mp of fieldMaps) {
    for (const token of Object.keys(mp)) pushStrict(token);
  }
  return out;
}

function resolveTagVisualZone(lineText, tokenStart, sep1, sep2) {
  const text = String(lineText || "");
  const s1 = String(sep1 || "").trim();
  const s2 = String(sep2 || "").trim();
  const i1 = s1 ? text.indexOf(s1) : -1;
  const i2 = s2 ? text.lastIndexOf(s2) : -1;
  if (i1 >= 0 && tokenStart < i1) return "left";
  if (i2 >= 0 && tokenStart > i2) return "right";
  return "middle";
}

function normalizeVisualTokenKey(token) {
  const raw = String(token || "").trim();
  if (!raw) return "";
  return raw.toLowerCase();
}

function rangeIntersects(aFrom, aTo, bFrom, bTo) {
  const af = Number(aFrom || 0);
  const at = Number(aTo || 0);
  const bf = Number(bFrom || 0);
  const bt = Number(bTo || 0);
  if (at <= af || bt <= bf) return false;
  return af < bt && bf < at;
}

function escapeRegExp(src) {
  return String(src || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRenderableLineContext(text, sep1, sep2) {
  const src = String(text || "");
  if (!src.trim()) return false;
  const s1 = String(sep1 || "").trim();
  const s2 = String(sep2 || "").trim();
  const hasSep = (s1 && src.includes(s1)) || (s2 && src.includes(s2));
  if (!hasSep) return false;
  const tokenLeadRx = /^\s*(?:[-*+]\s+|\d+\.\s+)?(?:#\S+\s*)+/;
  return tokenLeadRx.test(src);
}

function isRenderableStripContext(text, sep1, sep2, tokenSet) {
  const src = String(text || "");
  const trimmed = src.trim();
  if (!trimmed) return false;
  const listLineRx = /^\s*(?:[-*+]\s+|\d+\.\s+)(?:\[[^\]]+\]\s+)?/;
  if (listLineRx.test(src)) return true;
  const set = tokenSet instanceof Set ? tokenSet : new Set();
  if (!set.size) return false;
  const rx = /#\S+/g;
  let m;
  while ((m = rx.exec(src)) !== null) {
    const token = String(m[0] || "").trim();
    if (token && set.has(token)) return true;
  }
  return false;
}

function isHardLineBlockBoundary(text) {
  const src = String(text || "");
  const trimmed = src.trim();
  if (!trimmed) return true;
  if (/^---+$/.test(trimmed)) return true;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  return false;
}

class TagVisualTokenWidget extends cmView.WidgetType {
  constructor(tokenText, fillColor, textColor, opacity, emptyMode, sizePct, bubbleWidthPct, bubbleHeightPct, emptyBubbleSizePct, shapePct, displayTextOverride) {
    super();
    this.tokenText = String(tokenText || "");
    this.fillColor = String(fillColor || "");
    this.textColor = String(textColor || "");
    this.opacity = Number(opacity);
    this.emptyMode = emptyMode === true;
    this.sizePct = Number(sizePct);
    this.bubbleWidthPct = Number(bubbleWidthPct);
    this.bubbleHeightPct = Number(bubbleHeightPct);
    this.emptyBubbleSizePct = Number(emptyBubbleSizePct);
    this.shapePct = Number(shapePct);
    this.displayTextOverride = String(displayTextOverride || "");
  }
  eq(other) {
    return !!other
      && other.tokenText === this.tokenText
      && other.fillColor === this.fillColor
      && other.textColor === this.textColor
      && other.opacity === this.opacity
      && other.emptyMode === this.emptyMode
      && other.sizePct === this.sizePct
      && other.bubbleWidthPct === this.bubbleWidthPct
      && other.bubbleHeightPct === this.bubbleHeightPct
      && other.emptyBubbleSizePct === this.emptyBubbleSizePct
      && other.shapePct === this.shapePct
      && other.displayTextOverride === this.displayTextOverride;
  }
  toDOM() {
    const el = document.createElement("span");
    const st = computeTagVisualStyle(this.sizePct, this.bubbleWidthPct, this.bubbleHeightPct, this.shapePct);
    const emptyScale = Number.isFinite(this.emptyBubbleSizePct) ? Math.max(50, Math.min(180, Math.trunc(this.emptyBubbleSizePct))) / 100 : 1;
    const renderedText = this.emptyMode ? " " : (this.displayTextOverride || this.tokenText);
    el.textContent = renderedText;
    el.setAttribute("data-io-tag-token", this.tokenText);
    el.setAttribute("data-io-tag-render", renderedText);
    el.style.display = "inline-block";
    el.style.borderRadius = `${st.borderRadiusPx}px`;
    el.style.padding = `${st.verticalPaddingPx}px ${st.horizontalPaddingPx}px`;
    el.style.fontSize = `${st.fontSizePx}px`;
    el.style.lineHeight = String(st.lineHeight);
    if (this.emptyMode) {
      el.style.width = `${Math.max(6, Math.round(st.horizontalPaddingPx * 2 * emptyScale))}px`;
      el.style.minWidth = el.style.width;
      el.style.lineHeight = "1";
    }
    if (this.fillColor) el.style.backgroundColor = this.fillColor;
    /*
     * Цвет текста не задан — берётся тот же, каким рисует пузырь Value в
     * панели: `--text-on-accent`, «текст на цветной подложке»
     * (`styles.css`, `.io-bubble`). Панель показывала его всегда, а заметка
     * брала цвет темы, и одно и то же значение выглядело в двух местах
     * по-разному (замечание заказчика 2026-08-28).
     *
     * Только при заданной заливке, и это не осторожность ради осторожности:
     * без подложки светлый текст лёг бы на светлый фон заметки и пропал.
     * Переменная, а не литерал: в тёмной теме белое пятно было бы не лучше
     * чёрного (З6).
     */
    if (this.textColor) el.style.color = this.textColor;
    else if (this.fillColor) el.style.color = "var(--text-on-accent)";
    if (Number.isFinite(this.opacity)) el.style.opacity = String(this.opacity);
    return el;
  }
}

class ZeroWidthInlineWidget extends cmView.WidgetType {
  eq() { return true; }
  toDOM() {
    const el = document.createElement("span");
    el.className = "io-zero-width-inline";
    el.style.display = "inline-block";
    el.style.width = "0";
    el.style.margin = "0";
    el.style.padding = "0";
    el.style.border = "0";
    el.style.overflow = "hidden";
    el.style.verticalAlign = "baseline";
    return el;
  }
}

class LineLaneWidget extends cmView.WidgetType {
  constructor(lanes) {
    super();
    this.lanes = Array.isArray(lanes) ? lanes : [];
  }
  eq(other) {
    if (!other || !Array.isArray(other.lanes)) return false;
    if (other.lanes.length !== this.lanes.length) return false;
    for (let i = 0; i < this.lanes.length; i++) {
      const a = this.lanes[i] || {};
      const b = other.lanes[i] || {};
      if (a.left !== b.left || a.thickness !== b.thickness || a.color !== b.color) return false;
    }
    return true;
  }
  toDOM() {
    const wrap = document.createElement("span");
    wrap.style.position = "relative";
    wrap.style.display = "inline-block";
    wrap.style.width = "0";
    wrap.style.height = "0";
    wrap.style.overflow = "visible";
    for (let i = 0; i < this.lanes.length; i++) {
      const lane = this.lanes[i] || {};
      const color = String(lane.color || "").trim();
      if (!color) continue;
      const el = document.createElement("span");
      el.style.position = "absolute";
      el.style.pointerEvents = "none";
      el.style.left = `${Math.trunc(Number(lane.left) || 0)}px`;
      el.style.top = "-1.05em";
      el.style.height = "2.3em";
      el.style.width = `${Math.max(1, Math.trunc(Number(lane.thickness) || 1))}px`;
      el.style.background = color;
      el.style.borderRadius = "1px";
      wrap.appendChild(el);
    }
    return wrap;
  }
}

function buildTagVisualDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const debugLine = !!(cfg && cfg.devMode && cfg.devMode.enabled && cfg.devMode.traceTagVisualLine === true);
  const traceTxId = plugin && typeof plugin.getLineTraceTxId === "function"
    ? String(plugin.getLineTraceTxId() || "")
    : "";
  const visuals = getTagVisualsFromConfig(cfg);
  const userTags = visuals.userTags;
  const fieldMap = buildFieldTagVisualMap(cfg);
  const globalMap = buildGlobalTagVisualMap(cfg);
  const io = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.io) ? cfg.pkm.behavior.io : {};
  const sep1 = String(io.separator1 || "").trim();
  const sep2 = String(io.separator2 || "").trim();
  const sep1Color = normalizeHexColorInput(visuals.separator1TextColor);
  const sep2Color = normalizeHexColorInput(visuals.separator2TextColor);
  const ranges = [];
  const stripCfg = visuals.strip || __priorityStripEngine.normalizeStripConfig({});
  const stripFieldId = String(stripCfg.fieldId || "").trim();
  const stripFieldTokenSet = visuals.stripActive ? buildTagTokenSetForField(cfg, stripFieldId) : new Set();
  const stripFieldTokenSetNorm = new Set(Array.from(stripFieldTokenSet).map((t) => normalizeVisualTokenKey(t)).filter(Boolean));
  const cfgStrip = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.tagVisuals && cfg.pkm.behavior.tagVisuals.strip)
    ? cfg.pkm.behavior.tagVisuals.strip
    : {};
  const rawStripTagVisibility = cfgStrip.tagVisibility;
  const hideStripFieldTags = !!stripFieldId && (
    stripCfg.tagVisibility === false || rawStripTagVisibility === false
  );
  const suppressedRanges = [];

  const readRowForToken = (token) => readTagVisualRowByTokenMaps(token, fieldMap, userTags, globalMap);
  for (const vr of view.visibleRanges) {
    let lineNo = view.state.doc.lineAt(vr.from).number;
    const endLineNo = view.state.doc.lineAt(vr.to).number;
    while (lineNo <= endLineNo) {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      const rx = /#\S+/g;
      const scannedTokens = [];
      const hiddenTokens = [];
      const tokenEntries = [];
      let m;
      while ((m = rx.exec(text)) !== null) {
        const token = String(m[0] || "").trim();
        scannedTokens.push(token);
        const zone = resolveTagVisualZone(text, m.index, sep1, sep2);
        const from = line.from + m.index;
        const to = from + token.length;
        const tokenNorm = normalizeVisualTokenKey(token);
        const inStripField = stripFieldTokenSet.has(token) || (tokenNorm && stripFieldTokenSetNorm.has(tokenNorm));
        const row = readRowForToken(token);
        const zoneOpacity = zone === "left" ? visuals.opacityLeft : (zone === "right" ? visuals.opacityRight : 1);
        tokenEntries.push({ token, from, to, zone, inStripField, row, zoneOpacity, index: m.index });
      }

      if (sep1 && sep1Color) {
        const i1 = text.indexOf(sep1);
        if (i1 >= 0) {
          const from = line.from + i1;
          const to = from + sep1.length;
          if (to > from) {
            ranges.push({
              from,
              to,
              deco: cmView.Decoration.mark({ attributes: { style: `color: ${sep1Color};` } }),
            });
          }
        }
      }
      if (sep2 && sep2Color) {
        const i2 = text.lastIndexOf(sep2);
        if (i2 >= 0) {
          const from = line.from + i2;
          const to = from + sep2.length;
          if (to > from) {
            ranges.push({
              from,
              to,
              deco: cmView.Decoration.mark({ attributes: { style: `color: ${sep2Color};` } }),
            });
          }
        }
      }

      const zoneCounts = { left: 0, right: 0, middle: 0 };
      for (let ti = 0; ti < tokenEntries.length; ti++) {
        const z = tokenEntries[ti] && tokenEntries[ti].zone;
        if (z === "left" || z === "right" || z === "middle") zoneCounts[z] += 1;
      }

      for (let ti = 0; ti < tokenEntries.length; ti++) {
        const entry = tokenEntries[ti] || {};
        const token = String(entry.token || "").trim();
        const from = Number(entry.from || 0);
        const to = Number(entry.to || 0);
        if (!token || to <= from) continue;
        if (debugLine && token === "#/1" && plugin && typeof plugin.devLogEvent === "function") {
          try {
            plugin.devLogEvent("tagVisual.resolve.token", {
              traceTxId,
              lineNo,
              lineText: text,
              token,
              from,
              to,
              row: entry.row || null,
              zone: entry.zone,
              inStripField: !!entry.inStripField,
              zoneOpacity: entry.zoneOpacity,
            }, "trace", cfg);
          } catch (_) {}
        }
        if (hideStripFieldTags && entry.inStripField) {
          hiddenTokens.push(token);
          let hideTo = to;
          if (text.charAt(Number(entry.index || 0) + token.length) === " ") hideTo += 1;
          if (hideTo > from) {
            suppressedRanges.push({ from, to: hideTo, token });
            ranges.push({
              from,
              to: hideTo,
              deco: cmView.Decoration.replace({
                widget: new ZeroWidthInlineWidget(),
                inclusive: false,
              }),
            });
          }
          const hideSep = hideStripFieldTags && stripCfg.hideSeparatorWhenOnlyStripToken === true;
          if (hideSep && (entry.zone === "left" || entry.zone === "right") && zoneCounts[entry.zone] === 1) {
            if (entry.zone === "left" && sep1) {
              const p = text.indexOf(sep1);
              if (p >= 0) {
                const sf = line.from + p;
                const st = sf + sep1.length;
                ranges.push({
                  from: sf,
                  to: st,
                  deco: cmView.Decoration.replace({ widget: new ZeroWidthInlineWidget(), inclusive: false }),
                });
              }
            } else if (entry.zone === "right" && sep2) {
              const p = text.lastIndexOf(sep2);
              if (p >= 0) {
                const sf = line.from + p;
                const st = sf + sep2.length;
                ranges.push({
                  from: sf,
                  to: st,
                  deco: cmView.Decoration.replace({ widget: new ZeroWidthInlineWidget(), inclusive: false }),
                });
              }
            }
          }
          continue;
        }
        const row = entry.row;
        if (!row) continue;
        let suppressed = false;
        for (let si = 0; si < suppressedRanges.length; si++) {
          const sr = suppressedRanges[si] || {};
          if (rangeIntersects(from, to, sr.from, sr.to)) {
            suppressed = true;
            break;
          }
        }
        if (suppressed) continue;
        const hasVisualOverride = !!normalizeHexColorInput(row.fillColor)
          || !!normalizeHexColorInput(row.textColor)
          || resolveEffectiveTagVisualMode(row) !== "default";
        if (!hasVisualOverride) continue;
        if (to <= from) continue;
        const effectiveMode = resolveEffectiveTagVisualMode(row);
        if (debugLine && token === "#/1" && plugin && typeof plugin.devLogEvent === "function") {
          try {
            plugin.devLogEvent("tagVisual.apply.token", {
              traceTxId,
              lineNo,
              lineText: text,
              token,
              from,
              to,
              effectiveMode,
              fillColor: String(row.fillColor || ""),
              textColor: String(row.textColor || ""),
              customText: String(row.customText || ""),
              displayTextOverride: effectiveMode === "custom" ? String(row.customText || "").trim() : "",
            }, "trace", cfg);
          } catch (_) {}
        }
        ranges.push({
          from,
          to,
          deco: cmView.Decoration.replace({
            widget: new TagVisualTokenWidget(token, row.fillColor, row.textColor, entry.zoneOpacity, effectiveMode === "empty", visuals.tagTextSizePct, visuals.tagBubbleWidthPct, visuals.tagBubbleHeightPct, visuals.emptyBubbleSizePct, visuals.tagShapePct, effectiveMode === "custom" ? String(row.customText || "").trim() : ""),
            inclusive: false,
          }),
        });
      }
      if (debugLine && hideStripFieldTags && hiddenTokens.length && plugin && typeof plugin.devLogEvent === "function") {
        try {
          plugin.devLogEvent("strip.token.hide", {
            traceTxId,
            lineNo,
            stripFieldId,
            hiddenTokens,
            tokenSetSize: stripFieldTokenSet.size,
            tokenSetSample: Array.from(stripFieldTokenSet).slice(0, 10),
            tokenSetNormSample: Array.from(stripFieldTokenSetNorm).slice(0, 10),
            suppressedVisualDecorationsCount: suppressedRanges.length,
            tagVisibilityNormalized: stripCfg.tagVisibility,
            tagVisibilityRaw: rawStripTagVisibility,
          }, "trace", cfg);
        } catch (_) {}
      }
      lineNo += 1;
    }
  }
  ranges.sort((a, b) => {
    const af = Number(a && a.from || 0);
    const bf = Number(b && b.from || 0);
    if (af !== bf) return af - bf;
    const at = Number(a && a.to || 0);
    const bt = Number(b && b.to || 0);
    return at - bt;
  });
  const builder = new cmState.RangeSetBuilder();
  for (const r of ranges) {
    try { builder.add(r.from, r.to, r.deco); } catch (_) {}
  }
  return builder.finish();
}

function buildStripDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const debugLine = !!(cfg && cfg.devMode && cfg.devMode.enabled && cfg.devMode.traceTagVisualLine === true);
  const traceTxId = plugin && typeof plugin.getLineTraceTxId === "function"
    ? String(plugin.getLineTraceTxId() || "")
    : "";
  const visuals = getTagVisualsFromConfig(cfg);
  if (!visuals.stripActive) return cmView.Decoration.none;

  const io = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.io) ? cfg.pkm.behavior.io : {};
  const sep1 = String(io.separator1 || "").trim();
  const sep2 = String(io.separator2 || "").trim();
  const stripCfg = visuals.strip || __priorityStripEngine.normalizeStripConfig({});
  const stripFieldId = String(stripCfg.fieldId || "").trim();
  const fieldTokenSet = buildTagTokenSetForField(cfg, stripFieldId);
  const fieldMap = buildFieldTagVisualMap(cfg);
  const globalMap = buildGlobalTagVisualMap(cfg);
  const userTags = visuals.userTags;

  const readRowForToken = (token) => readTagVisualRowByTokenMaps(token, fieldMap, userTags, globalMap);

  const stripInputRows = [];
  const docLines = Number(view && view.state && view.state.doc ? view.state.doc.lines : 0);
  const viewportBuffer = 60;
  let minVisible = 1;
  let maxVisible = docLines;
  if (Array.isArray(view.visibleRanges) && view.visibleRanges.length && docLines > 0) {
    minVisible = docLines;
    maxVisible = 1;
    for (let i = 0; i < view.visibleRanges.length; i++) {
      const vr = view.visibleRanges[i] || {};
      const fromNo = view.state.doc.lineAt(vr.from).number;
      const toNo = view.state.doc.lineAt(vr.to).number;
      if (fromNo < minVisible) minVisible = fromNo;
      if (toNo > maxVisible) maxVisible = toNo;
    }
  }
  const startNo = Math.max(1, minVisible - viewportBuffer);
  const endNo = Math.min(docLines, maxVisible + viewportBuffer);
  for (let lineNo = startNo; lineNo <= endNo; lineNo++) {
    const line = view.state.doc.line(lineNo);
    const text = String(line.text || "");
    if (isRenderableStripContext(text, sep1, sep2, fieldTokenSet)) {
      stripInputRows.push({ lineNo, text });
    }
  }

  if (__priorityStripEngineIsStub || __priorityStripCm6AdapterIsStub) {
    if (debugLine && plugin && typeof plugin.devLogEvent === "function") {
      try {
        plugin.devLogEvent("strip.loader.fail", {
          traceTxId,
          stripFieldId,
          stripActive: true,
          engineStub: __priorityStripEngineIsStub,
          adapterStub: __priorityStripCm6AdapterIsStub,
          reason: "loader-unavailable",
        }, "error", cfg);
      } catch (_) {}
    }
    return cmView.Decoration.none;
  }

  const stripSpecs = __priorityStripEngine.buildStripSpecs(stripInputRows, {
    tokenSet: fieldTokenSet,
    readRowForToken,
    isHardBoundary: (text) => isHardLineBlockBoundary(text),
    mode: stripCfg.mode,
    stripesToShow: stripCfg.stripesToShow,
  });
  const stripRanges = __priorityStripCm6Adapter.buildStripDecorationRanges(stripSpecs, view, cmView, stripCfg);

  try {
    const rows = [];
    for (let i = 0; i < stripRanges.length; i++) {
      const rg = stripRanges[i] || {};
      const spec = stripSpecs[i] || {};
      const attrs = rg && rg.deco && rg.deco.spec && rg.deco.spec.attributes ? rg.deco.spec.attributes : {};
      const dbg = rg && rg.debug && typeof rg.debug === "object" ? rg.debug : {};
      rows.push({
        lineNo: Number(spec.lineNo || 0),
        mode: String(spec.mode || ""),
        ownToken: String(spec.ownToken || ""),
        ownColor: String(spec.ownColor || ""),
        inheritColor: String(spec.inheritColor || ""),
        classes: String(dbg.className || attrs.class || ""),
        style: String(dbg.style || attrs.style || ""),
        laneCount: Number(dbg.laneCount || 0),
        laneLefts: Array.isArray(dbg.laneLefts) ? dbg.laneLefts.slice(0, 4) : [],
        gutterInset: Number(dbg.gutterInset || 0),
      });
    }
    if (plugin) {
      plugin._lastStripDebugBatch = {
        ts: Date.now(),
        traceTxId,
        stripFieldId,
        sourceLineCount: stripInputRows.length,
        paintedLineCount: stripSpecs.length,
        decorationCount: stripRanges.length,
        rows,
      };
    }
  } catch (_) {}

  if (debugLine && plugin && typeof plugin.devLogEvent === "function") {
    try {
      plugin.devLogEvent("strip.apply.batch", {
        traceTxId,
        stripFieldId,
        tokenSetSize: fieldTokenSet.size,
        sourceLineCount: stripInputRows.length,
        paintedLineCount: stripSpecs.length,
        decorationCount: stripRanges.length,
        paintedLines: stripSpecs.map((s) => s.lineNo).slice(0, 100),
      }, "trace", cfg);
      plugin.devLogEvent("strip.debug.snapshot", {
        traceTxId,
        stripFieldId,
        decorationCount: stripRanges.length,
        rows: (plugin && plugin._lastStripDebugBatch && Array.isArray(plugin._lastStripDebugBatch.rows))
          ? plugin._lastStripDebugBatch.rows.slice(0, 12)
          : [],
      }, "trace", cfg);
    } catch (_) {}
  }

  const builder = new cmState.RangeSetBuilder();
  for (let i = 0; i < stripRanges.length; i++) {
    const r = stripRanges[i] || {};
    try { builder.add(r.from, r.to, r.deco); } catch (_) {}
  }
  return builder.finish();
}

function createTagVisualDecorationExtension(plugin) {
  return cmView.ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = buildTagVisualDecorations(view, plugin);
    }
    update(update) {
      this.decorations = buildTagVisualDecorations(update.view, plugin);
    }
  }, {
    decorations: (v) => v.decorations,
  });
}

function createStripDecorationExtension(plugin) {
  return cmView.ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = buildStripDecorations(view, plugin);
    }
    update(update) {
      this.decorations = buildStripDecorations(update.view, plugin);
    }
  }, {
    decorations: (v) => v.decorations,
  });
}

function formatTagwheelDisplayToken(token, showPrefix) {
  var src = String(token || "");
  var t = src.trim();
  if (!t) return src;
  var m = t.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  if (m) return m[1];
  if (showPrefix) return src;
  if (/^#\//.test(t)) return t.replace(/^#\//, "");
  if (/^#\S+/.test(t)) return t.replace(/^#/, "");
  if (/^[^A-Za-zА-Яа-я0-9\[]+/.test(t)) {
    var stripped = t.replace(/^[^A-Za-zА-Яа-я0-9\[]+/, "");
    if (/^(\d{4}-\d{2}-\d{2}|\d{2}:\d{2}|\d)/.test(stripped)) return stripped;
  }
  return t;
}

const TAGWHEEL_FILL_STYLE_CSS = [
  ".markdown-source-view.mod-cm6 .inline-overhaul-tw-fill-widget {",
  "  background-color: var(--inline-overhaul-tw-fill) !important;",
  "  border-radius: 4px;",
  "  padding: 0 2px;",
  "}",
].join("\n");

const STRIP_LINE_STYLE_CSS = [
  ".markdown-source-view.mod-cm6 .cm-line.io-strip-line {",
  "  position: relative;",
  "  border-radius: 2px;",
  "  overflow: visible !important;",
  "}",
  ".markdown-source-view.mod-cm6 .cm-line.io-strip-line::before {",
  "  content: \"\";",
  "  position: absolute;",
  "  pointer-events: none;",
  "  top: 0;",
  "  bottom: 0;",
  "  width: var(--io-strip-thickness, 2px);",
  "  left: calc(-1 * var(--io-strip-x1, 20px));",
  "  background: var(--io-strip-c1, transparent);",
  "  box-shadow: var(--io-strip-shadow2, none), var(--io-strip-shadow3, none);",
  "  border-radius: 1px;",
  "}",
  ".markdown-source-view.mod-cm6 .cm-line .io-strip-hidden-token {",
  "  opacity: 0 !important;",
  "  color: transparent !important;",
  "  background: transparent !important;",
  "  border-color: transparent !important;",
  "  text-shadow: none !important;",
  "  font-size: 0 !important;",
  "  line-height: 0 !important;",
  "  letter-spacing: 0 !important;",
  "  margin: 0 !important;",
  "  padding: 0 !important;",
  "}",
  ".markdown-source-view.mod-cm6 .cm-line .io-strip-hidden-space {",
  "  font-size: 0 !important;",
  "  color: transparent !important;",
  "  line-height: 0 !important;",
  "  margin: 0 !important;",
  "  padding: 0 !important;",
  "}",
  ".markdown-source-view.mod-cm6 .cm-line .cm-formatting-hashtag:has(.io-strip-hidden-token),",
  ".markdown-source-view.mod-cm6 .cm-line .cm-hashtag:has(.io-strip-hidden-token),",
  ".markdown-source-view.mod-cm6 .cm-line .cm-tag:has(.io-strip-hidden-token),",
  ".markdown-source-view.mod-cm6 .cm-line .cm-meta:has(.io-strip-hidden-token) {",
  "  background: transparent !important;",
  "  border: 0 !important;",
  "  box-shadow: none !important;",
  "  outline: 0 !important;",
  "}",
].join("\n");

class TagwheelFillWidget extends cmView.WidgetType {
  constructor(fullText, fillColor, textColor, placeholders, showPrefix) {
    super();
    this.fullText = String(fullText || "");
    this.fillColor = String(fillColor || "");
    this.textColor = String(textColor || "");
    this.placeholders = placeholders instanceof Set ? placeholders : new Set();
    this.showPrefix = showPrefix !== false;
  }

  eq(other) {
    return !!(other
      && other.fullText === this.fullText
      && other.fillColor === this.fillColor
      && other.textColor === this.textColor
      && other.placeholders === this.placeholders
      && other.showPrefix === this.showPrefix);
  }

  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "inline-overhaul-tw-fill-widget";
    if (this.fillColor) wrap.style.setProperty("--inline-overhaul-tw-fill", this.fillColor);

    const src = this.fullText;
    const rx = /`([^`]+)`|\*\*\[([^\]]+)\]\*\*/g;
    let last = 0;
    let m;
    while ((m = rx.exec(src)) !== null) {
      if (m.index > last) wrap.appendChild(document.createTextNode(src.slice(last, m.index)));
      const matched = String(m[0] || "");
      const tickToken = String(m[1] || "").trim();
      const activeToken = String(m[2] || "").trim();
      var shownTick = tickToken ? formatTagwheelDisplayToken(tickToken, this.showPrefix) : "";
      var shownActive = activeToken ? formatTagwheelDisplayToken(activeToken, this.showPrefix) : "";
      if (m[1] && this.textColor && tickToken && this.placeholders.has(tickToken)) {
        const colored = document.createElement("span");
        colored.style.color = this.textColor;
        colored.textContent = "`" + shownTick + "`";
        wrap.appendChild(colored);
      } else if (m[1]) {
        wrap.appendChild(document.createTextNode("`" + shownTick + "`"));
      } else if (m[2]) {
        const pre = matched.indexOf("[");
        const post = matched.lastIndexOf("]");
        if (pre >= 0 && post > pre) {
          wrap.appendChild(document.createTextNode(matched.slice(0, pre + 1)));
          const activeSpan = document.createElement("span");
          activeSpan.className = "inline-overhaul-tw-active-anchor";
          activeSpan.textContent = shownActive;
          if (this.textColor && activeToken && this.placeholders.has(activeToken)) {
            activeSpan.style.color = this.textColor;
          }
          wrap.appendChild(activeSpan);
          wrap.appendChild(document.createTextNode(matched.slice(post)));
        } else {
          wrap.appendChild(document.createTextNode(matched));
        }
      } else {
        wrap.appendChild(document.createTextNode(matched));
      }
      last = m.index + matched.length;
    }
    if (last < src.length) wrap.appendChild(document.createTextNode(src.slice(last)));
    return wrap;
  }
}

function buildTagwheelHeaderDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const colors = getTagwheelHeaderColorsFromConfig(cfg);
  const hasTextColor = !!colors.defaultTextColor;
  const hasFillColor = !!colors.fillColor;
  const usePanelWidget = hasFillColor || colors.showPrefix === false;
  if (!hasTextColor && !hasFillColor && colors.showPrefix !== false) return cmView.Decoration.none;

  const placeholders = buildTagwheelPlaceholderSetFromConfig(cfg);
  const ranges = [];
  const textDeco = hasTextColor
    ? cmView.Decoration.mark({ attributes: { style: "color: " + colors.defaultTextColor + ";" } })
    : null;

  for (const vr of view.visibleRanges) {
    let lineNo = view.state.doc.lineAt(vr.from).number;
    const endLineNo = view.state.doc.lineAt(vr.to).number;
    while (lineNo <= endLineNo) {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      const openIdx = text.indexOf("==");
      const closeIdx = openIdx >= 0 ? text.indexOf("==", openIdx + 2) : -1;
      if (openIdx >= 0 && closeIdx > openIdx) {
        const segStart = line.from + openIdx;
        const segEnd = line.from + closeIdx + 2;
        if (usePanelWidget && segEnd > segStart) {
          const fullSeg = text.slice(openIdx, closeIdx + 2);
          const widgetDeco = cmView.Decoration.replace({
            widget: new TagwheelFillWidget(fullSeg, colors.fillColor, colors.defaultTextColor, placeholders, colors.showPrefix),
            inclusive: false,
          });
          ranges.push({ from: segStart, to: segEnd, deco: widgetDeco, rank: 0 });
        }
        if (textDeco && !usePanelWidget) {
          const segment = text.slice(openIdx + 2, closeIdx);
          const tickRe = /`([^`]+)`/g;
          let m;
          while ((m = tickRe.exec(segment)) !== null) {
            const token = String(m[1] || "").trim();
            if (!token) continue;
            const from = line.from + openIdx + 2 + m.index;
            const to = from + String(m[0] || "").length;
            if (to > from) ranges.push({ from, to, deco: textDeco, rank: 1 });
          }
          if (placeholders.size) {
            const activeRe = /\*\*\[([^\]]+)\]\*\*/g;
            while ((m = activeRe.exec(segment)) !== null) {
              const token = String(m[1] || "").trim();
              if (!token || !placeholders.has(token)) continue;
              const full = String(m[0] || "");
              const innerStart = full.indexOf("[") + 1;
              const from = line.from + openIdx + 2 + m.index + innerStart;
              const to = from + token.length;
              if (to > from) ranges.push({ from, to, deco: textDeco, rank: 2 });
            }
          }
        }
      }
      lineNo += 1;
    }
  }

  ranges.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    if (a.to !== b.to) return a.to - b.to;
    return a.rank - b.rank;
  });

  const builder = new cmState.RangeSetBuilder();
  for (const r of ranges) {
    try {
      builder.add(r.from, r.to, r.deco);
    } catch (_) {}
  }
  return builder.finish();
}

function createTagwheelHeaderDecorationExtension(plugin) {
  return cmView.ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = buildTagwheelHeaderDecorations(view, plugin);
    }
    update(update) {
      if (!update.docChanged && !update.viewportChanged && !update.selectionSet) return;
      this.decorations = buildTagwheelHeaderDecorations(update.view, plugin);
    }
  }, {
    decorations: (v) => v.decorations,
  });
}

class FallbackConfigStore {
  constructor(plugin, options) {
    this.plugin = plugin;
    this.defaults = options.defaults;
    this.undoLimit = options.undoLimit || 20;
    this.saveDebounceMs = options.saveDebounceMs || 250;
    this.config = cloneJson(this.defaults);
    this.undoStack = [];
    this.listeners = new Set();
    this.saveTimer = null;
    this.lastSavedAt = null;
  }

  async init() {
    const raw = await this.plugin.loadData();
    this.config = migrateConfig(raw);
    await this.plugin.saveData(this.config);
    this.lastSavedAt = Date.now();
  }

  getSnapshot() {
    return cloneJson(this.config);
  }

  getLastSavedAt() {
    return this.lastSavedAt;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(reason) {
    const payload = { reason: reason || "update", snapshot: this.getSnapshot() };
    for (const l of this.listeners) {
      try {
        l(payload);
      } catch (e) {
        console.error("[inline-overhaul] Config listener failed", e);
      }
    }
  }

  update(mutator, reason) {
    const before = this.getSnapshot();
    const next = mutator(this.getSnapshot());
    if (!isObj(next)) return;

    this.undoStack.push(before);
    if (this.undoStack.length > this.undoLimit) this.undoStack.shift();

    this.config = migrateConfig(next);
    this.emit(reason || "update");
    this.scheduleSave();
  }

  patch(patchObj, reason) {
    this.update((prev) => deepMerge(prev, patchObj), reason || "patch");
  }

  undo(reason) {
    if (!this.undoStack.length) return false;
    this.config = migrateConfig(this.undoStack.pop());
    this.emit(reason || "undo");
    this.scheduleSave();
    return true;
  }

  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        await this.plugin.saveData(this.config);
        this.lastSavedAt = Date.now();
      } catch (e) {
        console.error("[inline-overhaul] Save failed", e);
        new Notice("InlineOverhaul: failed to save settings");
      }
    }, this.saveDebounceMs);
  }

  async flushNow() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.plugin.saveData(this.config);
    this.lastSavedAt = Date.now();
  }

  unload() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
}

class InlineOverhaulPlugin extends Plugin {
  async onload() {
    await loadSharedUtilsSafe(this.app);
    await loadPkmMacroRuntimeEntrySafe(this.app);
    await loadConfigMigrationModuleSafe(this.app);
    await loadConfigStoreModuleSafe(this.app);
    await loadCommandRegistrySafe(this.app);
    await loadSettingsTabRouterSafe(this.app);
    await loadSettingsSectionsRendererSafe(this.app);
    await loadConfigNoteHelpersSafe(this.app);
    await loadTagWheelConfigCodecSafe(this.app);
    await loadRulesMarkdownBuilderSafe(this.app);
    await loadEnhancedSelectAllEngineSafe(this.app);
    await loadConfigNoteOrchestratorSafe(this.app);
    await loadStoreEventsOrchestratorSafe(this.app);
    await loadRulesSyncOrchestratorSafe(this.app);
    await loadTransformFeatureSafe(this.app);
    await loadPriorityStripEngineSafe(this.app);
    await loadPriorityStripAdapterSafe(this.app);
    this.navRuntime = await loadNavigationRuntimeSafe(this.app);
    this.pkmRuntimeV2 = await loadPkmRuntimeV2Safe(this.app);
    this._devLogWriteQueue = Promise.resolve();
    this._enhancedSelectAllCycle = null;
    this._rulesGenTimer = null;
    this._tagwheelFillStyleEl = null;
    this._lineTraceTxId = "";
    this._lineTraceSeq = 0;
    this._tagVisualExtension = null;
    this._stripExtension = null;
    this._tagwheelHeaderExtension = null;
    this._tagVisualCompartment = new cmState.Compartment();
    this._stripCompartment = new cmState.Compartment();
    this._tagwheelHeaderCompartment = new cmState.Compartment();
    this._inlineExtensionMountedEditors = typeof WeakSet !== "undefined" ? new WeakSet() : null;

    const ConfigStoreCtor = getConfigStoreCtor();
    this.store = new ConfigStoreCtor(this, {
      defaults: DEFAULT_CONFIG,
      undoLimit: UNDO_LIMIT,
      saveDebounceMs: SAVE_DEBOUNCE_MS,
      cloneJson,
      isObj,
      deepMerge,
      migrateConfig,
      Notice,
    });

    await this.store.init();
    try {
      await this.initializeDevLogSession(this.getConfig());
    } catch (e) {
      console.error("[inline-overhaul][dev-mode-log:init]", e);
    }

    this.addSettingTab(this.createSettingTab());

    this.registerCommands();
    this.ensureTagwheelFillStyles();
    this.ensureStripLineStyles();
    this.registerGlobalFunctions();
    this.registerStoreEvents();

    await this.ensureGeneratedRulesNow("onload");

    const devEnabled = !!(this.getConfig && this.getConfig() && this.getConfig().devMode && this.getConfig().devMode.enabled);
    if (devEnabled) {
      console.info("[inline-overhaul] loaded");
    }
  }

  getLineTraceTxId() {
    return String(this._lineTraceTxId || "");
  }

  onunload() {
    try { this.closeDevLogSession(this.getConfig()); } catch (_) {}
    if (this._tagwheelFillStyleEl && this._tagwheelFillStyleEl.parentNode) {
      this._tagwheelFillStyleEl.parentNode.removeChild(this._tagwheelFillStyleEl);
    }
    this._tagwheelFillStyleEl = null;
    if (this._stripLineStyleEl && this._stripLineStyleEl.parentNode) {
      this._stripLineStyleEl.parentNode.removeChild(this._stripLineStyleEl);
    }
    this._stripLineStyleEl = null;
    if (this.store) this.store.unload();
    if (__safeModuleCache && typeof __safeModuleCache.clear === "function") __safeModuleCache.clear();
  }

  ensureTagwheelFillStyles() {
    try {
      if (this._tagwheelFillStyleEl && this._tagwheelFillStyleEl.parentNode) return;
      const styleEl = document.createElement("style");
      styleEl.setAttribute("data-inline-overhaul", "tagwheel-fill");
      styleEl.textContent = TAGWHEEL_FILL_STYLE_CSS;
      document.head.appendChild(styleEl);
      this._tagwheelFillStyleEl = styleEl;
      this.register(() => {
        if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      });
    } catch (_) {}
  }

  ensureStripLineStyles() {
    try {
      if (this._stripLineStyleEl && this._stripLineStyleEl.parentNode) return;
      const styleEl = document.createElement("style");
      styleEl.setAttribute("data-inline-overhaul", "strip-line");
      styleEl.textContent = STRIP_LINE_STYLE_CSS;
      document.head.appendChild(styleEl);
      this._stripLineStyleEl = styleEl;
      this.register(() => {
        if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      });
      try {
        const cfg = this.getConfig();
        this.devLogEvent("strip.css.inject", { ok: true }, "trace", cfg);
      } catch (_) {}
    } catch (e) {
      try {
        const cfg = this.getConfig();
        this.devLogEvent("strip.css.inject", {
          ok: false,
          message: String(e && e.message ? e.message : e || ""),
        }, "error", cfg);
      } catch (_) {}
    }
  }

  registerStoreEvents() {
    const orch = getStoreEventsOrchestrator();
    return orch.registerStoreEvents({
      subscribeStore: (listener) => this.store.subscribe(listener),
      setUnsubscribe: (fn) => {
        this._unsubscribeStore = fn;
      },
      getUnsubscribe: () => this._unsubscribeStore,
      renderSettingsTab: () => {
        if (this._settingsTab) this._settingsTab.display();
      },
      scheduleGeneratedRulesSync: () => this.scheduleGeneratedRulesSync(),
      getRulesTimer: () => this._rulesGenTimer,
      setRulesTimer: (timer) => {
        this._rulesGenTimer = timer;
      },
      registerCleanup: (fn) => this.register(fn),
    });
  }

  scheduleGeneratedRulesSync() {
    const orch = getRulesSyncOrchestrator();
    return orch.scheduleGeneratedRulesSync({
      delayMs: 250,
      getConfig: () => this.getConfig(),
      getTimer: () => this._rulesGenTimer,
      setTimer: (timer) => {
        this._rulesGenTimer = timer;
      },
      ensureGeneratedRulesNow: (reason) => this.ensureGeneratedRulesNow(reason),
      onError: (e) => {
        console.error("[inline-overhaul][rules-gen]", e);
      },
    });
  }

  async ensureGeneratedRulesNow(reason) {
    const orch = getRulesSyncOrchestrator();
    return await orch.ensureGeneratedRulesNow({
      getConfig: () => this.getConfig(),
      defaultGeneratedRulesPath: DEFAULT_CONFIG.pkm.generatedRulesPath,
      buildRulesMarkdown: (cfg) => getRulesMarkdownBuilder().buildTagWheelRulesMarkdownFromConfig(cfg),
      writeText: (p, md) => this.app.vault.adapter.write(p, md),
      notice: (msg) => new Notice(msg),
    }, reason);
  }

  registerCommands() {
    const registry = getCommandRegistry();
    const coreDefs = registry.buildCoreCommandDefs(this, FEATURE_ORDER, FEATURE_META);
    if (!Array.isArray(coreDefs) || !coreDefs.length) {
      console.warn("[inline-overhaul] command registry unavailable: core commands skipped");
    } else {
      for (const d of coreDefs) {
        this.addCommand({
          id: d.id,
          name: d.name,
          callback: async () => {
            await d.run(this);
          },
        });
      }
    }

    this.registerNavigationCommands();
    this.registerPkmCommands();
    this.registerBinderCommands();
    this.registerTransformCommands();

    const defs = registry.buildConfigCommandDefs();
    if (!Array.isArray(defs) || !defs.length) {
      console.warn("[inline-overhaul] command registry unavailable: config commands skipped");
      return;
    }
    for (const d of defs) {
      this.addCommand({
        id: d.id,
        name: d.name,
        callback: async () => {
          await d.run(this);
        },
      });
    }

  }

  registerGlobalFunctions() {
    this.registerEditorExtension(cmState.Prec.highest(cmView.keymap.of([
      {
        key: "c-a",
        mac: "m-a",
        run: () => this.handleEnhancedSelectAllKeymap(),
      },
    ])));
    this._tagwheelHeaderExtension = createTagwheelHeaderDecorationExtension(this);
    this._tagVisualExtension = createTagVisualDecorationExtension(this);
    this._stripExtension = createStripDecorationExtension(this);
    this.registerEditorExtension(this._tagwheelHeaderCompartment.of(this._tagwheelHeaderExtension));
    this.registerEditorExtension(this._tagVisualCompartment.of(cmState.Prec.highest(this._tagVisualExtension)));
    this.registerEditorExtension(this._stripCompartment.of(this._stripExtension));
    this.registerStripDebugApi();
  }

  registerStripDebugApi() {
    const plugin = this;
    try {
      globalThis.__ioStripDebug = {
        dumpLatest() {
          const batch = plugin._lastStripDebugBatch || null;
          console.log("[io-strip-debug] latest", batch);
          return batch;
        },
        scanVisible() {
          const batch = plugin._lastStripDebugBatch || {};
          const rows = Array.isArray(batch.rows) ? batch.rows : [];
          const mapped = rows.map((r) => ({
            lineNo: r.lineNo,
            mode: r.mode,
            classes: r.classes,
            style: r.style,
            ownToken: r.ownToken,
            ownColor: r.ownColor,
            inheritColor: r.inheritColor,
          }));
          console.table(mapped);
          return mapped;
        },
        dumpLine(lineNo) {
          const ln = Number(lineNo || 0);
          const batch = plugin._lastStripDebugBatch || {};
          const rows = Array.isArray(batch.rows) ? batch.rows : [];
          const row = rows.find((r) => Number(r.lineNo || 0) === ln) || null;
          console.log("[io-strip-debug] line", ln, row);
          return row;
        },
        dumpGeometry(lineNo) {
          const ln = Number(lineNo || 0);
          const batch = plugin._lastStripDebugBatch || {};
          const rows = Array.isArray(batch.rows) ? batch.rows : [];
          const row = rows.find((r) => Number(r.lineNo || 0) === ln) || null;
          if (!row) {
            console.log("[io-strip-debug] geometry", ln, null);
            return null;
          }
          const payload = {
            lineNo: row.lineNo,
            mode: row.mode,
            laneCount: row.laneCount,
            laneLefts: row.laneLefts,
            gutterInset: row.gutterInset,
            thickness: row.style,
          };
          console.log("[io-strip-debug] geometry", payload);
          return payload;
        },
        dumpMixed(lineNo) {
          const ln = Number(lineNo || 0);
          const batch = plugin._lastStripDebugBatch || {};
          const rows = Array.isArray(batch.rows) ? batch.rows : [];
          const row = rows.find((r) => Number(r.lineNo || 0) === ln) || null;
          if (!row) {
            console.log("[io-strip-debug] mixed", ln, null);
            return null;
          }
          const payload = {
            lineNo: row.lineNo,
            mode: row.mode,
            ownToken: row.ownToken,
            ownColor: row.ownColor,
            inheritColor: row.inheritColor,
            classes: row.classes,
            style: row.style,
          };
          console.log("[io-strip-debug] mixed", payload);
          return payload;
        },
        css() {
          const styleEl = plugin._stripLineStyleEl || null;
          const payload = {
            attached: !!(styleEl && styleEl.parentNode),
            textLength: styleEl && styleEl.textContent ? String(styleEl.textContent).length : 0,
            selectorCount: styleEl && styleEl.sheet && styleEl.sheet.cssRules ? styleEl.sheet.cssRules.length : 0,
          };
          console.log("[io-strip-debug] css", payload);
          return payload;
        },
      };
    } catch (_) {}
  }

  handleEnhancedSelectAllKeymap() {
    return getEnhancedSelectAllEngine().handleEnhancedSelectAllKeymap(this);
  }

  getActiveEditor() {
    return this.app.workspace.getActiveViewOfType(require("obsidian").MarkdownView)?.editor ?? this.app.workspace.activeEditor?.editor;
  }

  notice(message) {
    new Notice(String(message || ""));
  }

  async ensureNavRuntime() {
    if (this.navRuntime && typeof this.navRuntime === "object") return this.navRuntime;
    this.navRuntime = await loadNavigationRuntimeSafe(this.app);
    return this.navRuntime;
  }

  async runNavGuard(moduleKey, action) {
    const cfg = this.getConfig();
    if (!cfg.features.navigation.enabled) {
      new Notice("InlineOverhaul: Navigation module disabled");
      return;
    }
    const rt = await this.ensureNavRuntime();
    if (!rt) {
      new Notice("InlineOverhaul: navigation runtime unavailable");
      return;
    }
    const ed = this.getActiveEditor();
    if (!ed) {
      new Notice("InlineOverhaul: no active editor");
      return;
    }
    try {
      return await Promise.resolve(action(ed, cfg.navigation || {}, cfg, rt));
    } catch (e) {
      console.error("[inline-overhaul][navigation]", e);
      new Notice("InlineOverhaul navigation error: " + (e.message || e));
    }
  }

  async runPkmGuard(action) {
    const cfg = this.getConfig();
    if (!cfg.features.pkm.enabled) {
      new Notice("InlineOverhaul: Tag & PKM module disabled");
      return;
    }
    const ed = this.getActiveEditor();
    if (!ed) {
      new Notice("InlineOverhaul: no active editor");
      return;
    }
    try {
      return await Promise.resolve(action(cfg));
    } catch (e) {
      this.devLogEvent("pkm.guard.error", {
        message: String(e && e.message ? e.message : e || ""),
        stack: e && e.stack ? String(e.stack) : "",
      }, "error", cfg);
      console.error("[inline-overhaul][pkm]", e);
      new Notice("InlineOverhaul PKM error: " + (e.message || e));
    }
  }

  async ensurePkmRuntimeV2() {
    if (this.pkmRuntimeV2 && typeof this.pkmRuntimeV2 === "object") return this.pkmRuntimeV2;
    this.pkmRuntimeV2 = await loadPkmRuntimeV2Safe(this.app);
    return this.pkmRuntimeV2;
  }

  async runPkmRuntimeV2(command, cfg, extraSettings) {
    const rt = await this.ensurePkmRuntimeV2();
    if (!rt) throw new Error("PKM runtime v2 is unavailable");
    if (typeof rt.runCommand !== "function") throw new Error("PKM runtime v2 has no runCommand");

    const settings = {
      [__pkmOptionKeys.KEYS.RULES_PATH]: getActiveTagWheelRulesPath(cfg),
      [__pkmOptionKeys.KEYS.CYCLE_END_BEHAVIOR]: cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.cycleEndBehavior : "keep-bullet",
      [__pkmOptionKeys.KEYS.SUBTAG_FORMAT]: cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.subtagFormat : "separate",
      [__pkmOptionKeys.KEYS.CURSOR_POLICY]: cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.cursorPolicy : "text_end",
      [__pkmOptionKeys.KEYS.ORDER_CONFIG]: serializePkmOrderForMacro(cfg),
      [__pkmOptionKeys.KEYS.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfg),
      [__pkmOptionKeys.KEYS.TAGWHEEL_SCROLLER_ENABLED]: !!(cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.tagWheelScroller && cfg.pkm.behavior.tagWheelScroller.enabled),
      [__pkmOptionKeys.KEYS.TAGWHEEL_SCROLLER_DIRECTION]: (cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.tagWheelScroller && cfg.pkm.behavior.tagWheelScroller.direction) || "full",
      [__pkmOptionKeys.KEYS.TAGWHEEL_SCROLLER_SIZE]: (cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.tagWheelScroller && cfg.pkm.behavior.tagWheelScroller.size) || 3,
      ...(isObj(extraSettings) ? extraSettings : {}),
    };
    return await Promise.resolve(rt.runCommand({
      app: this.app,
      command,
      settings,
      Notice,
      devLog: (event, payload) => this.devLogEvent(event, payload, "info", cfg),
    }));
  }

  registerNavigationCommands() {
    const registry = getCommandRegistry();
    const defs = registry.buildNavigationCommandDefs(this, getActiveTagWheelRulesPath);
    if (!Array.isArray(defs) || !defs.length) {
      console.warn("[inline-overhaul] command registry unavailable: navigation commands skipped");
      return;
    }

    for (const d of defs) {
      this.addCommand({
        id: d.id,
        name: d.name,
        callback: async () => {
          await this.runNavGuard("navigation", d.run);
        },
      });
    }
  }

  registerPkmCommands() {
    const registry = getCommandRegistry();
    const cfgNow = this.getConfig();
    const defs = registry.buildPkmCommandDefs(
      getActiveTagWheelRulesPath,
      serializePkmOrderForMacro,
      serializeDateRuntimeConfigForMacro,
      normalizePkmOrder,
      cfgNow
    );
    if (!Array.isArray(defs) || !defs.length) {
      console.warn("[inline-overhaul] command registry unavailable: PKM commands skipped");
      return;
    }

    this._registeredPkmCommandIds = this._registeredPkmCommandIds || new Set();

    for (const d of defs) {
      const id = String(d && d.id ? d.id : "").trim();
      if (!id) continue;
      if (this._registeredPkmCommandIds.has(id)) continue;
      this.addCommand({
        id,
        name: d.name,
        callback: async () => {
          await this.runPkmGuard(async (cfg) => {
            const macroSettings = d.makeSettings(cfg);
            await this.runPkmRuntimeV2(d.v2Command, cfg, macroSettings);
          });
        },
      });
      this._registeredPkmCommandIds.add(id);
    }
  }

  registerBinderCommands() {
    const registry = getCommandRegistry();
    const cfgNow = this.getConfig();
    const defs = registry.buildBinderCommandDefs(cfgNow);
    if (!Array.isArray(defs) || !defs.length) {
      console.warn("[inline-overhaul] command registry unavailable: binder commands skipped");
      return;
    }

    this._registeredBinderCommandIds = this._registeredBinderCommandIds || new Set();
    for (const d of defs) {
      const id = String(d && d.id ? d.id : "").trim();
      if (!id) continue;
      if (this._registeredBinderCommandIds.has(id)) continue;
      this.addCommand({
        id,
        name: String(d && d.name ? d.name : id),
        callback: async () => {
          await Promise.resolve(d.run(this));
        },
      });
      this._registeredBinderCommandIds.add(id);
    }
  }

  registerTransformCommands() {
    this.addCommand({
      id: "inlineOverhaul_Transform_inline2note",
      name: "Transform: inline2note",
      callback: async () => {
        const cfg = this.getConfig();
        if (!cfg.features.transform.enabled) {
          this.notice("InlineOverhaul: Transform module disabled");
          return;
        }
        try {
          await Promise.resolve(getTransformFeature().runInline2Note(this, { Modal, lineFinalize: __transformLineFinalize }));
        } catch (e) {
          console.error("[inline-overhaul][transform]", e);
          this.notice("InlineOverhaul transform error: " + (e && e.message ? e.message : e));
        }
      },
    });
  }

  getConfig() {
    return this.store.getSnapshot();
  }

  /**
   * Панель настроек. Новая — на схеме и декларативном API; старая остаётся
   * запасным путём до фазы 3, когда её код удаляется целиком.
   */
  createSettingTab() {
    /*
     * Новая панель включается только флагом advanced.newSettingsPane, пока в
     * ней нет редактора Fields, живых предпросмотров, Binder, Smart Rules и
     * справочника команд (фаза 3). До паритета старая панель остаётся
     * рабочей: переключать человека на панель без половины инструментов
     * нельзя, даже если новая устроена лучше.
     */
    const cfg = this.getConfig();
    const wantNew = !!(cfg && cfg.advanced && cfg.advanced.newSettingsPane === true);
    const Declarative = wantNew ? getDeclarativeSettingTabCtor() : null;
    if (Declarative) {
      try {
        /*
         * Третий аргумент — мост для перенесённого редактора Fields: он ждёт
         * нормализацию Order и список заранее известных ключей, а они живут
         * здесь и из слоя настроек недостижимы (фаза 3b).
         */
        return new Declarative(this.app, this, {
          normalizePkmOrder,
          pkmOrderFields: PKM_ORDER_FIELDS,
        });
      } catch (e) {
        console.error("[inline-overhaul] declarative settings pane failed to build", e);
      }
    }
    return new InlineOverhaulSettingTab(this.app, this);
  }

  getDevModeConfig(cfg) {
    const snapshot = isObj(cfg) ? cfg : this.getConfig();
    const raw = isObj(snapshot && snapshot.devMode) ? snapshot.devMode : {};
    const genAi = raw.generateAiLog === true;
    return {
      enabled: raw.enabled === true,
      logPath: String(raw.logPath || DEFAULT_CONFIG.devMode.logPath).trim() || DEFAULT_CONFIG.devMode.logPath,
      generateAiLog: genAi,
      humanRetentionMinutes: 20,
      humanMaxRecords: 300,
      aiRetentionMinutes: 45,
      aiMaxRecords: 1200,
    };
  }

  shouldWriteDevLog(cfg) {
    const dm = this.getDevModeConfig(cfg);
    return dm.enabled === true;
  }

  formatLogTimestamp(d) {
    const dt = d instanceof Date ? d : new Date();
    const y = String(dt.getFullYear());
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    const ss = String(dt.getSeconds()).padStart(2, "0");
    return `${y}${m}${day}-${hh}${mm}${ss}`;
  }

  getLogPathParts(dm) {
    const extHint = arguments.length > 1 ? arguments[1] : undefined;
    const raw = String(dm && dm.logPath ? dm.logPath : DEFAULT_CONFIG.devMode.logPath).trim() || DEFAULT_CONFIG.devMode.logPath;
    const ext = String(extHint || "md").trim().toLowerCase() === "ndjson" ? "ndjson" : "md";
    const asForward = raw.replace(/\\/g, "/");
    const maybeDir = /\/$/.test(asForward);
    const withDefault = maybeDir ? `${asForward}InlineOverhaul_DevLog` : asForward;
    const noExt = withDefault.replace(/\.(?:ndjson|md)$/i, "");
    const noRole = noExt.replace(/\.(?:new|old)(?:\.\d{8}-\d{6})?$/i, "");
    const i = noRole.lastIndexOf("/");
    const dir = i >= 0 ? noRole.slice(0, i) : "";
    const baseName = (i >= 0 ? noRole.slice(i + 1) : noRole) || "InlineOverhaul_DevLog";
    return { dir, baseName, ext };
  }

  buildLogFilePath(parts, role, ts) {
    const r = role === "old" ? "old" : "new";
    const safeTs = String(ts || this.formatLogTimestamp(new Date()));
    const file = `${parts.baseName}.${r}.${safeTs}.${parts.ext}`;
    return parts.dir ? `${parts.dir}/${file}` : file;
  }

  async listMatchingLogFiles(adapter, parts) {
    const prefix = `${parts.baseName}.`;
    const suffix = `.${parts.ext}`;
    const out = [];
    const dir = parts.dir || "";
    try {
      let files = [];
      if (typeof adapter.list === "function") {
        const listed = await adapter.list(dir || "/");
        files = Array.isArray(listed && listed.files) ? listed.files : [];
      }
      for (const f of files) {
        const p = String(f || "").replace(/\\/g, "/");
        const fileName = p.split("/").pop() || "";
        if (!fileName.startsWith(prefix) || !fileName.endsWith(suffix)) continue;
        const m = fileName.match(/^(.+)\.(new|old)(?:\.(\d{8}-\d{6}))?\.(md|ndjson)$/i);
        if (!m) continue;
        out.push({ path: p, role: String(m[2] || "").toLowerCase(), ts: String(m[3] || "") });
      }
    } catch (_) {}
    out.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    return out;
  }

  sanitizeHumanPayload(eventName, payload) {
    const p = isObj(payload) ? payload : { value: payload };
    const out = {
      command: p.command || "",
      actionType: p.actionType || "",
      direction: p.direction || "",
      lineNo: Number.isFinite(Number(p.lineNo)) ? Number(p.lineNo) : -1,
      changed: p.changed === true,
      durationMs: Number.isFinite(Number(p.durationMs)) ? Number(p.durationMs) : 0,
      beforeLine: typeof p.beforeLine === "string" ? p.beforeLine : "",
      afterLine: typeof p.afterLine === "string" ? p.afterLine : "",
      message: typeof p.message === "string" ? p.message : "",
    };
    return out;
  }

  parseIsoDateSafe(text) {
    const t = String(text || "").trim();
    const d = new Date(t);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  trimAiLogContent(content, dm) {
    const src = String(content || "");
    const rows = src.split("\n").filter((x) => String(x || "").trim());
    const now = Date.now();
    const maxAgeMs = Math.max(1, Math.floor(Number(dm.retentionMinutes || 45))) * 60 * 1000;
    const kept = [];
    for (const row of rows) {
      try {
        const obj = JSON.parse(row);
        const dt = this.parseIsoDateSafe(obj && obj.ts ? obj.ts : "");
        if (dt && now - dt.getTime() > maxAgeMs) continue;
        kept.push(row);
      } catch (_) {
        kept.push(row);
      }
    }
    const limited = kept.slice(Math.max(0, kept.length - Math.max(1, Number(dm.maxRecords || 1200))));
    return limited.length ? (limited.join("\n") + "\n") : "";
  }

  trimHumanLogContent(content, dm) {
    const src = String(content || "");
    const lines = src.split("\n");
    const header = lines.length && /^#\s+InlineOverhaul\s+Dev\s+Log/i.test(lines[0]) ? (lines[0] + "\n") : "";
    const body = header ? src.slice(header.length) : src;
    const chunks = body.split(/\n(?=###\s+\d{4}-\d{2}-\d{2}T)/g).filter((x) => String(x || "").trim());
    const now = Date.now();
    const maxAgeMs = Math.max(1, Math.floor(Number(dm.retentionMinutes || 20))) * 60 * 1000;
    const kept = [];
    for (const chunk of chunks) {
      const m = String(chunk || "").match(/^###\s+(\d{4}-\d{2}-\d{2}T[^\n\r]+)/);
      const dt = this.parseIsoDateSafe(m ? m[1] : "");
      if (dt && now - dt.getTime() > maxAgeMs) continue;
      kept.push(String(chunk || "").replace(/^\n+/, ""));
    }
    const limited = kept.slice(Math.max(0, kept.length - Math.max(1, Number(dm.maxRecords || 300))));
    const merged = limited.join("\n");
    if (!merged) return header || "";
    return (header ? header : "") + merged + (merged.endsWith("\n") ? "" : "\n");
  }

  getParentDirPath(filePath) {
    const p = String(filePath || "").replace(/\\/g, "/");
    const i = p.lastIndexOf("/");
    if (i <= 0) return "";
    return p.slice(0, i);
  }

  async ensureDirectoryForFilePath(adapter, filePath) {
    const dir = this.getParentDirPath(filePath);
    if (!dir) return;
    const parts = String(dir).split("/").filter(Boolean);
    if (!parts.length) return;
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      try {
        if (typeof adapter.exists === "function") {
          const ok = await adapter.exists(acc);
          if (!ok && typeof adapter.mkdir === "function") await adapter.mkdir(acc);
        } else if (typeof adapter.mkdir === "function") {
          await adapter.mkdir(acc);
        }
      } catch (_) {
        // best effort; continue trying nested segments
      }
    }
  }

  buildDevLogLine(ext, eventName, payload) {
    const ts = new Date().toISOString();
    const event = String(eventName || "event");
    const p = isObj(payload) ? payload : { value: payload };
    if (String(ext || "md") === "md") {
      const hp = this.sanitizeHumanPayload(event, p);
      if (event === "pkm.run.start") {
        return `### ${ts}\n- event: ${event}\n- command: ${hp.command}\n- action: ${hp.actionType || "n/a"}\n- direction: ${hp.direction || "n/a"}\n- line: ${hp.lineNo}\n`;
      }
      if (event === "pkm.run.result") {
        return `### ${ts}\n- event: ${event}\n- command: ${hp.command || "n/a"}\n- changed: ${hp.changed ? "yes" : "no"}\n- durationMs: ${hp.durationMs}\n- before: ${hp.beforeLine}\n- after: ${hp.afterLine}\n`;
      }
      if (event === "pkm.run.error" || event === "pkm.guard.error") {
        return `### ${ts}\n- event: ${event}\n- command: ${hp.command || "n/a"}\n- error: ${hp.message || "unknown"}\n`;
      }
      if (event === "session.start" || event === "session.end") {
        return `### ${ts}\n- event: ${event}\n- session: ${this._devLogSessionId || ""}\n`;
      }
      return "";
    }
    const record = {
      ts,
      sessionId: this._devLogSessionId || "",
      seq: Number(this._devLogSeq || 0),
      event,
      payload: p,
    };
    return JSON.stringify(record) + "\n";
  }

  devLogEvent(eventName, payload, level, cfg) {
    if (!this.shouldWriteDevLog(cfg)) return;
    const dm = this.getDevModeConfig(cfg);
    this._devLogSeq = Number(this._devLogSeq || 0) + 1;
    const mdLine = this.buildDevLogLine("md", eventName, payload);
    const aiLine = dm.generateAiLog ? this.buildDevLogLine("ndjson", eventName, payload) : "";
    if (!mdLine && !aiLine) return;
    this._devLogWriteQueue = this._devLogWriteQueue.then(async () => {
      if (mdLine) await this.writeDevLogLine(dm, "md", mdLine);
      if (aiLine) await this.writeDevLogLine(dm, "ndjson", aiLine);
    }).catch((e) => {
      console.error("[inline-overhaul][dev-mode-log]", e);
    });
  }

  async initializeDevLogSession(cfg) {
    const dm = this.getDevModeConfig(cfg);
    if (!dm.enabled) return;
    const adapter = this.app && this.app.vault ? this.app.vault.adapter : null;
    if (!adapter || typeof adapter.read !== "function" || typeof adapter.write !== "function") return;
    const partsMd = this.getLogPathParts(dm, "md");
    const partsAi = this.getLogPathParts(dm, "ndjson");
    this._devLogSessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this._devLogSeq = 0;
    const rotateByParts = async (parts) => {
      const existing = await this.listMatchingLogFiles(adapter, parts);
      const prevNew = existing.find((x) => x.role === "new") || null;
      const allOld = existing.filter((x) => x.role === "old");
      for (const o of allOld) {
        try { if (typeof adapter.remove === "function") await adapter.remove(o.path); } catch (_) {}
      }
      if (prevNew) {
        let previous = "";
        try { previous = await adapter.read(prevNew.path); } catch (_) { previous = ""; }
        if (previous) {
          const oldPath = this.buildLogFilePath(parts, "old", prevNew.ts || this.formatLogTimestamp(new Date()));
          try {
            await this.ensureDirectoryForFilePath(adapter, oldPath);
            await adapter.write(oldPath, previous);
          } catch (_) {}
        }
        try { if (typeof adapter.remove === "function") await adapter.remove(prevNew.path); } catch (_) {}
      }
    };
    await rotateByParts(partsMd);
    if (dm.generateAiLog) await rotateByParts(partsAi);
    const ts = this.formatLogTimestamp(new Date());
    const newPathMd = this.buildLogFilePath(partsMd, "new", ts);
    await this.ensureDirectoryForFilePath(adapter, newPathMd);
    await adapter.write(newPathMd, "# InlineOverhaul Dev Log (Human)\n");
    this._devLogActivePathMd = newPathMd;
    if (dm.generateAiLog) {
      const newPathAi = this.buildLogFilePath(partsAi, "new", ts);
      await this.ensureDirectoryForFilePath(adapter, newPathAi);
      await adapter.write(newPathAi, "");
      this._devLogActivePathAi = newPathAi;
    } else {
      this._devLogActivePathAi = "";
    }
    this.devLogEvent("session.start", {
      sessionId: this._devLogSessionId,
      logPathResolvedHuman: newPathMd,
      logPathResolvedAi: this._devLogActivePathAi,
      generateAiLog: dm.generateAiLog,
    }, "info", cfg);
  }

  async closeDevLogSession(cfg, forceWrite) {
    if (!forceWrite && !this.shouldWriteDevLog(cfg)) return;
    this.devLogEvent("session.end", { sessionId: this._devLogSessionId }, "info", cfg);
    try {
      await (this._devLogWriteQueue || Promise.resolve());
    } catch (_) {}
    this._devLogActivePathMd = "";
    this._devLogActivePathAi = "";
  }

  async writeDevLogLine(dm, ext, line) {
    const adapter = this.app && this.app.vault ? this.app.vault.adapter : null;
    if (!adapter || typeof adapter.read !== "function" || typeof adapter.write !== "function") return;
    const logPath = String(ext === "ndjson" ? (this._devLogActivePathAi || "") : (this._devLogActivePathMd || "")).trim();
    if (!logPath) return;
    let prev = "";
    try {
      prev = await adapter.read(logPath);
    } catch (_) {
      prev = "";
    }
    const rawOut = String(prev || "") + String(line || "");
    const out = ext === "ndjson"
      ? this.trimAiLogContent(rawOut, { retentionMinutes: dm.aiRetentionMinutes, maxRecords: dm.aiMaxRecords })
      : this.trimHumanLogContent(rawOut, { retentionMinutes: dm.humanRetentionMinutes, maxRecords: dm.humanMaxRecords });
    await this.ensureDirectoryForFilePath(adapter, logPath);
    await adapter.write(logPath, out);
  }

  setConfigPatch(patchObj, reason) {
    const before = this.getConfig();
    const reasonKey = String(reason || "settings");
    const stripPatchFieldId = String(
      patchObj
      && patchObj.pkm
      && patchObj.pkm.behavior
      && patchObj.pkm.behavior.tagVisuals
      && patchObj.pkm.behavior.tagVisuals.strip
      && patchObj.pkm.behavior.tagVisuals.strip.fieldId
      || ""
    ).trim();
    this._lineTraceSeq = Math.max(0, Math.trunc(Number(this._lineTraceSeq || 0))) + 1;
    this._lineTraceTxId = `linecfg-${Date.now()}-${this._lineTraceSeq}`;
    const changed = this.store.patch(patchObj, reason || "settings") === true;
    if (!changed) return;
    const after = this.getConfig();
    const debugLine = !!(after && after.devMode && after.devMode.enabled && after.devMode.traceTagVisualLine === true);
    const wasEnabled = !!(before && before.devMode && before.devMode.enabled);
    const isEnabled = !!(after && after.devMode && after.devMode.enabled);
    const beforePath = String(before && before.devMode && before.devMode.logPath ? before.devMode.logPath : "");
    const afterPath = String(after && after.devMode && after.devMode.logPath ? after.devMode.logPath : "");
    const beforeAi = !!(before && before.devMode && before.devMode.generateAiLog);
    const afterAi = !!(after && after.devMode && after.devMode.generateAiLog);
    if (!wasEnabled && isEnabled) {
      this.initializeDevLogSession(after).catch((e) => {
        console.error("[inline-overhaul][dev-mode-log:toggle-on]", e);
      });
    }
    if (wasEnabled && !isEnabled) {
      this.closeDevLogSession(before, true).catch((e) => {
        console.error("[inline-overhaul][dev-mode-log:toggle-off]", e);
      });
    }
    if (wasEnabled && isEnabled && (beforePath !== afterPath || beforeAi !== afterAi)) {
      this.closeDevLogSession(before, true)
        .then(() => this.initializeDevLogSession(after))
        .catch((e) => {
          console.error("[inline-overhaul][dev-mode-log:reinit]", e);
        });
    }
    if (debugLine && typeof this.devLogEvent === "function") {
      try {
        this.devLogEvent("strip.config.patch", {
          traceTxId: this._lineTraceTxId,
          reason: reasonKey,
          requestedStripFieldId: stripPatchFieldId,
          beforeStripFieldId: String(before && before.pkm && before.pkm.behavior && before.pkm.behavior.tagVisuals && before.pkm.behavior.tagVisuals.strip && before.pkm.behavior.tagVisuals.strip.fieldId || "").trim(),
          afterStripFieldId: String(after && after.pkm && after.pkm.behavior && after.pkm.behavior.tagVisuals && after.pkm.behavior.tagVisuals.strip && after.pkm.behavior.tagVisuals.strip.fieldId || "").trim(),
          beforeStripActive: !!(before && before.pkm && before.pkm.behavior && before.pkm.behavior.tagVisuals && before.pkm.behavior.tagVisuals.strip && before.pkm.behavior.tagVisuals.strip.active === true),
          afterStripActive: !!(after && after.pkm && after.pkm.behavior && after.pkm.behavior.tagVisuals && after.pkm.behavior.tagVisuals.strip && after.pkm.behavior.tagVisuals.strip.active === true),
          mismatchDetected: !!(stripPatchFieldId && String(after && after.pkm && after.pkm.behavior && after.pkm.behavior.tagVisuals && after.pkm.behavior.tagVisuals.strip && after.pkm.behavior.tagVisuals.strip.fieldId || "").trim() !== stripPatchFieldId),
        }, "trace", after);
      } catch (_) {}
    }
    if (!this.isUiOnlyPatchReason(reasonKey)) {
      this.refreshLivePreviewDecorations();
    }
  }

  isUiOnlyPatchReason(reasonKey) {
    const key = String(reasonKey || "").trim();
    if (!key) return false;
    if (key === "settings:tab" || key === "settings:visual-subtab" || key === "settings:hotkeys-subtab") return true;
    if (key.startsWith("settings:ui:")) return true;
    if (key.startsWith("settings:binder:")) return true;
    return false;
  }

  refreshLivePreviewDecorations() {
    const cfg = this.getConfig();
    const debugLine = !!(cfg && cfg.devMode && cfg.devMode.enabled && cfg.devMode.traceTagVisualLine === true);
    const leaves = this.app && this.app.workspace && typeof this.app.workspace.getLeavesOfType === "function"
      ? this.app.workspace.getLeavesOfType("markdown")
      : [];
    if (debugLine) {
      try {
        this.devLogEvent("strip.refresh.dispatch", {
          traceTxId: this.getLineTraceTxId(),
          reason: "config-patch",
          leaves: Array.isArray(leaves) ? leaves.length : 0,
          stripFieldId: String(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.tagVisuals && cfg.pkm.behavior.tagVisuals.strip && cfg.pkm.behavior.tagVisuals.strip.fieldId || "").trim(),
          stripActive: !!(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.tagVisuals && cfg.pkm.behavior.tagVisuals.strip && cfg.pkm.behavior.tagVisuals.strip.active === true),
        }, "trace", cfg);
      } catch (_) {}
    }
    for (const leaf of leaves) {
      const view = leaf && leaf.view ? leaf.view : null;
      const editor = view && view.editor ? view.editor : null;
      const cm = editor && editor.cm ? editor.cm : null;
      if (!cm || typeof cm.dispatch !== "function") continue;
      try {
        const shouldMount = this._inlineExtensionMountedEditors instanceof WeakSet
          ? !this._inlineExtensionMountedEditors.has(cm)
          : false;
        if (shouldMount && this._tagVisualExtension && this._stripExtension && this._tagwheelHeaderExtension) {
          cm.dispatch({ effects: cmState.StateEffect.appendConfig.of([
            this._tagwheelHeaderCompartment.of(this._tagwheelHeaderExtension),
            this._tagVisualCompartment.of(cmState.Prec.highest(this._tagVisualExtension)),
            this._stripCompartment.of(this._stripExtension),
          ]) });
          if (this._inlineExtensionMountedEditors instanceof WeakSet) this._inlineExtensionMountedEditors.add(cm);
        } else if (this._tagVisualExtension && this._stripExtension && this._tagwheelHeaderExtension) {
          cm.dispatch({ effects: [
            this._tagwheelHeaderCompartment.reconfigure(this._tagwheelHeaderExtension),
            this._tagVisualCompartment.reconfigure(cmState.Prec.highest(this._tagVisualExtension)),
            this._stripCompartment.reconfigure(this._stripExtension),
          ] });
        }
        const head = cm.state && cm.state.selection && cm.state.selection.main
          ? cm.state.selection.main.head
          : 0;
        cm.dispatch({ effects: cmState.StateEffect.appendConfig.of([]), selection: { anchor: head, head } });
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => {
            try {
              const h2 = cm.state && cm.state.selection && cm.state.selection.main
                ? cm.state.selection.main.head
                : head;
              cm.dispatch({ effects: cmState.StateEffect.appendConfig.of([]), selection: { anchor: h2, head: h2 } });
            } catch (_) {}
          });
        }
      } catch (_) {}
    }
  }

  setActiveSettingsTab(tabId) {
    this.setConfigPatch({ ui: { activeSettingsTab: tabId } }, "settings:tab");
  }

  setVisualSubTab(subTabId) {
    this.setConfigPatch({ ui: { visualSubTab: subTabId } }, "settings:visual-subtab");
  }

  setHotkeysSubTab(subTabId) {
    this.setConfigPatch({ ui: { hotkeysSubTab: subTabId } }, "settings:hotkeys-subtab");
  }

  async openTagWheelConfigNote() {
    const cfg = this.getConfig();
    const orch = getConfigNoteOrchestrator();
    if (!orch) throw new Error("Config note orchestrator unavailable");
    return await orch.openTagWheelConfigNote({
      app: this.app,
      cfg,
      tagWheelConfigCodec: getTagWheelConfigCodec(),
      cloneJson,
      isObj,
      readVaultText,
      detectDateFieldHotkeys: (fid, cfgForDetect) =>
        detectDateFieldHotkeys(this.app, cfgForDetect, fid, this.manifest && this.manifest.id),
      normalizePkmOrder,
      TAGWHEEL_CONFIG_MODE_DETAILED,
      TAGWHEEL_CONFIG_MODE_MINIMAL,
    });
  }

  async openTagWheelConfigTemplateNote() {
    const cfg = this.getConfig();
    const orch = getConfigNoteOrchestrator();
    if (!orch) throw new Error("Config note orchestrator unavailable");
    return await orch.openTagWheelConfigTemplateNote({
      app: this.app,
      cfg,
      tagWheelConfigCodec: getTagWheelConfigCodec(),
    });
  }

  async applyTagWheelConfigNote() {
    try {
      if (__safeModuleCache && typeof __safeModuleCache.delete === "function") {
        __safeModuleCache.delete("feature:config-note-orchestrator");
        __safeModuleCache.delete("feature:tagwheel-config-codec");
        __safeModuleCache.delete("feature:tagwheel-config-parser");
      }
    } catch (_) {}
    __configNoteOrchestrator = null;
    __tagWheelConfigCodec = null;
    __tagWheelConfigParser = null;
    await loadConfigNoteOrchestratorSafe(this.app);
    await loadTagWheelConfigParserSafe(this.app);
    await loadTagWheelConfigCodecSafe(this.app);
    const cfg = this.getConfig();
    const orch = getConfigNoteOrchestrator();
    const helpers = getConfigNoteHelpers();
    if (!orch) throw new Error("Config note orchestrator unavailable");
    return await orch.applyTagWheelConfigNote({
      app: this.app,
      cfg,
      tagWheelConfigCodec: getTagWheelConfigCodec(),
      store: this.store,
      readVaultText,
      getOrderStrictName,
      isObj,
      cloneJson,
      collectTagSections: helpers.collectTagSections,
      getFieldById: helpers.getFieldById,
      extractFieldMetaMap,
      rebuildTagValues,
      rebuildSubtagValues,
      denormTagToken,
      getPrefixRulesFromCfg: helpers.getPrefixRulesFromCfg,
      collectCheckboxTokensFromMap: helpers.collectCheckboxTokensFromMap,
      deepMerge,
      syncCustomPrefixResolverBlock: helpers.syncCustomPrefixResolverBlock,
      normalizePkmOrder,
      CFG_H2_DATES,
    });
  }

  async renameStrictNameInConfigNote(oldName, newName) {
    const cfg = this.getConfig();
    const orch = getConfigNoteOrchestrator();
    if (!orch) throw new Error("Config note orchestrator unavailable");
    return await orch.renameStrictNameInConfigNote(
      {
        app: this.app,
        cfg,
        tagWheelConfigCodec: getTagWheelConfigCodec(),
      },
      oldName,
      newName
    );
  }

  isFeatureEnabled(featureKey) {
    const cfg = this.getConfig();
    return !!(cfg.features && cfg.features[featureKey] && cfg.features[featureKey].enabled);
  }

}

/**
 * Новая панель настроек на декларативном API (PRD 5.3). Загружается через
 * try/catch, как и остальные модули в этом файле: если сборка идёт из
 * исходников без esbuild, файл на TypeScript не разрешится, и плагин
 * останется на старой панели вместо того, чтобы не запуститься.
 *
 * Оба пути уходят в фазе 6, когда весь этот механизм заменят статические
 * импорты (дефект A2).
 */
function getDeclarativeSettingTabCtor() {
  try {
    const mod = require("./src/ui/settings/obsidian_tab.ts");
    if (mod && typeof mod.InlineOverhaulSettings === "function") return mod.InlineOverhaulSettings;
  } catch (e) {
    console.warn("[inline-overhaul] declarative settings pane unavailable, using the old one", e && e.message);
  }
  return null;
}

class InlineOverhaulSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    plugin._settingsTab = this;
    this._displayRefreshScheduled = false;
    this._displayRefreshRendering = false;
    this._storeUnsub = null;
    try {
      if (plugin && plugin.store && typeof plugin.store.subscribe === "function") {
        this._storeUnsub = plugin.store.subscribe(() => {
          this.scheduleDisplayRefresh("store:update");
        });
        if (typeof plugin.register === "function") {
          plugin.register(() => {
            try {
              if (typeof this._storeUnsub === "function") this._storeUnsub();
            } catch (_) {}
            this._storeUnsub = null;
          });
        }
      }
    } catch (_) {}
  }

  isSettingsTabVisible() {
    return !!(this.containerEl && this.containerEl.isConnected);
  }

  scheduleDisplayRefresh(reason) {
    void reason;
    if (!this.isSettingsTabVisible()) return;
    if (this._displayRefreshScheduled || this._displayRefreshRendering) return;
    this._displayRefreshScheduled = true;
    const run = () => {
      this._displayRefreshScheduled = false;
      if (!this.isSettingsTabVisible()) return;
      if (this._displayRefreshRendering) return;
      this._displayRefreshRendering = true;
      try {
        this.display();
      } finally {
        this._displayRefreshRendering = false;
      }
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        setTimeout(run, 0);
      });
      return;
    }
    setTimeout(run, 0);
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    const cfg = this.plugin.getConfig();
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderSettingsDisplaySection({
      containerEl,
      cfg,
      getActiveSettingsTab: (cfgValue) => cfgValue.ui.activeSettingsTab || "general",
      renderTabBar: (el, activeTab) => this.renderTabBar(el, activeTab),
      renderSettingsTabContent: (activeTab, el, cfgValue) => {
        const router = getSettingsTabRouter();
        router.renderSettingsTabContent(this, activeTab, el, cfgValue);
      },
    });
  }

  renderTabBar(containerEl, activeTab) {
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderTabBarSection({
      containerEl,
      activeTab,
      settingsTabs: SETTINGS_TABS,
      setActiveSettingsTab: (tabId) => this.plugin.setActiveSettingsTab(tabId),
    });
  }

  renderGeneral(containerEl, cfg) {
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderGeneralSection({
      Setting,
      Notice,
      containerEl,
      cfg,
      featureOrder: FEATURE_ORDER,
      featureMeta: FEATURE_META,
      plugin: this.plugin,
    });

  }

  renderHotkeysTab(containerEl, cfg) {
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderHotkeysTabSection({
      containerEl,
      cfg,
      Setting,
      plugin: this.plugin,
      hotkeysSubTabs: HOTKEYS_SUB_TABS,
      setHotkeysSubTab: (tabId) => this.plugin.setHotkeysSubTab(tabId),
    });
  }

  renderModuleTab(containerEl, featureKey, cfg) {
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderModuleTabSection({
      Setting,
      containerEl,
      featureKey,
      cfg,
      featureMeta: FEATURE_META,
      renderNavigationSettings: (el, cfgValue, enabled) => this.renderNavigationSettings(el, cfgValue, enabled),
      renderTransformSettings: (el, cfgValue, enabled) => {
        return getTransformFeature().renderTransformSettings({
          Setting,
          containerEl: el,
          cfg: cfgValue,
          plugin: this.plugin,
          enabled,
        });
      },
      renderPkmSettings: (el, cfgValue, enabled) => {
        renderer.renderPkmOrderBoardSection({
          Setting,
          Notice,
          Modal,
          containerEl: el,
          cfg: cfgValue,
          enabled,
          plugin: this.plugin,
          normalizePkmOrder,
          pkmOrderFields: PKM_ORDER_FIELDS,
          setIcon,
          /* Тумблеры вида доски перерисовывают вкладку (дефект A14). */
          refreshSettings: () => this.scheduleDisplayRefresh("settings:order-view-toggle"),
        });
        return renderer.renderPkmConfigSections({
          Setting,
          Notice,
          Modal,
          containerEl: el,
          cfg: cfgValue,
          enabled,
          plugin: this.plugin,
          normalizePkmOrder,
          tagwheelConfigModeDetailed: TAGWHEEL_CONFIG_MODE_DETAILED,
          tagwheelConfigModeMinimal: TAGWHEEL_CONFIG_MODE_MINIMAL,
          pkmBackends: PKM_BACKENDS,
          getActiveTagWheelRulesPath,
          refreshSettings: () => this.scheduleDisplayRefresh("renderer:refresh"),
        });
      },
    });
  }

  renderVisualTab(containerEl, cfg) {
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderVisualTabSection({
      containerEl,
      cfg,
      Setting,
      plugin: this.plugin,
      visualSubTabs: VISUAL_SUB_TABS,
      setVisualSubTab: (tabId) => this.plugin.setVisualSubTab(tabId),
      renderVisualGeneralSection: (arg1, arg2) => {
        if (arg1 && typeof arg1 === "object" && arg1.containerEl) return this.renderVisualGeneralSection(arg1.containerEl, arg1.enabled, arg1.cfg);
        return this.renderVisualGeneralSection(arg1, arg2, cfg);
      },
      renderVisualTagsSection: (arg1, arg2) => {
        if (arg1 && typeof arg1 === "object" && arg1.containerEl) return this.renderVisualTagsSection(arg1.containerEl, arg1.enabled, arg1.cfg);
        return this.renderVisualTagsSection(arg1, arg2, cfg);
      },
      renderVisualStripSection: (arg1, arg2) => {
        if (arg1 && typeof arg1 === "object" && arg1.containerEl) return this.renderVisualStripSection(arg1.containerEl, arg1.enabled, arg1.cfg);
        return this.renderVisualStripSection(arg1, arg2, cfg);
      },
      normalizePkmOrder,
    });
  }

  renderNavigationSettings(containerEl, cfg, enabled) {
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderNavigationSettings({
      Setting,
      containerEl,
      cfg,
      enabled,
      plugin: this.plugin,
    });
  }

  renderVisualGeneralSection(containerEl, enabled, cfg) {
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderVisualGeneralSection({
      Setting,
      containerEl,
      enabled,
      cfg,
      plugin: this.plugin,
    });
  }

  renderVisualTagsSection(containerEl, enabled, cfg) {
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderVisualTagsSection({
      Setting,
      containerEl,
      enabled,
      cfg,
      plugin: this.plugin,
    });
  }

  renderVisualStripSection(containerEl, enabled, cfg) {
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderVisualStripSection({
      Setting,
      containerEl,
      enabled,
      cfg,
      plugin: this.plugin,
      normalizePkmOrder,
    });
  }

  renderColorsSection(containerEl, cfg, enabled) {
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderColorsSection({
      containerEl,
      cfg,
      enabled,
    });
  }

  renderAdvanced(containerEl, cfg) {
    const renderer = getSettingsSectionsRenderer();
    return renderer.renderAdvancedSection({
      Setting,
      Notice,
      containerEl,
      cfg,
      featureOrder: FEATURE_ORDER,
      plugin: this.plugin,
      store: this.plugin.store,
      pkmBackends: PKM_BACKENDS,
      getActiveTagWheelRulesPath,
      flushSettingsNow: () => this.scheduleDisplayRefresh("advanced:flush"),
    });
  }
}

module.exports = InlineOverhaulPlugin;
  function normalizeCycleEndBehaviorLegacy(value) {
    const s = String(value || "").trim().toLowerCase();
    if (!s) return "keep-bullet";
    if (s === "off" || s === "of" || s === "none" || s.includes("clear") || s.includes("empty")) return "clear-prefix";
    if (s === "on" || s.includes("keep") || s.includes("bullet")) return "keep-bullet";
    return "keep-bullet";
  }
