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

/*
 * Движок полосы берётся синхронным `require` сразу, а заглушки выше — только
 * последний рубеж.
 *
 * Причина та же, что у Transform: `normalizeStripConfig` задаёт форму ветки
 * `visual.tagBars` и отсекает значения по краям, и делает это третья ступень
 * `migrateConfig` на каждом патче. Заглушка `(x) => x || {}` на её месте
 * означала бы ветку без формы и без клампов — то есть полосу, нарисованную по
 * тому, что пришло в патче. Асинхронный загрузчик остаётся: в vault-варианте
 * `require` не находит модуль, и его находит он.
 */
try {
  const mod = require("./src/core/priority_strip_engine.js");
  if (hasValidPriorityStripEngine(mod)) {
    __priorityStripEngine = mod;
    __priorityStripEngineIsStub = false;
  }
} catch (_e) { /* модуль приедет асинхронным загрузчиком */ }

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
      TAGWHEEL_SCROLLER_FILL: "TagWheel scroller fill color",
      TAGWHEEL_SCROLLER_TEXT: "TagWheel scroller text color",
      TAGWHEEL_EDGE_MODE: "TagWheel edge mode",
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
let __orderDeepEditorState = null;
let __rulesMarkdownBuilder = null;
let __enhancedSelectAllEngine = null;
let __smartDeleteEngine = null;
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
    buildBinderCommandDefs: () => [],
  };
  return __commandRegistry;
}

function getCommandRegistry() {
  if (hasValidCommandRegistry(__commandRegistry)) return __commandRegistry;
  /*
   * Синхронная попытка перед заглушкой. Заглушка отдаёт пустые списки, то есть
   * плагин без команд — и, что незаметнее, поиск хоткея поля-даты без
   * определений: он спрашивает идентификатор у реестра (корень Б-11), и на
   * заглушке нашёл бы пустоту. Правило то же, что у Transform и полосы.
   */
  try {
    const mod = require("./src/features/command_registry.js");
    if (hasValidCommandRegistry(mod)) {
      __commandRegistry = mod;
      return __commandRegistry;
    }
  } catch (_e) { /* модуль приедет асинхронным загрузчиком */ }
  return {
    buildCoreCommandDefs: () => [],
    buildNavigationCommandDefs: () => [],
    buildPkmCommandDefs: () => [],
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
  /*
   * Синхронная попытка перед заглушкой, и она здесь не для удобства.
   * `normalizeTransformConfig` ставит **умолчания движка** ветки Transform, а
   * заглушка ниже отдаёт конфиг как есть. Если бы дело кончалось заглушкой,
   * умолчания досыпала бы схема — то есть Transform включался бы из коробки, а
   * папкой шаблонов становилась `Templates` (девятнадцать расхождений В-7).
   * Продуктовое решение не должно приниматься тем, успел ли загрузиться модуль.
   */
  try {
    const mod = require("./src/features/transform_feature.js");
    if (hasValidTransformFeature(mod)) {
      __transformFeature = mod;
      return __transformFeature;
    }
  } catch (_e) { /* в vault-варианте загрузки модуль приедет асинхронно */ }
  return {
    normalizeInline2Note: () => ({ enabled: false }),
    normalizeTransformConfig: (cfg) => cfg,
    renderTransformSettings: () => {},
    runInline2Note: async () => {},
  };
}

/**
 * Идентификаторы и имена команд — один модуль на весь плагин (PRD 7.2).
 * Синхронный `require`, как у остальных: заглушка здесь означала бы команды с
 * пустыми идентификаторами, то есть плагин без команд.
 */
const __commandIds = require("./src/features/command_ids.js");
const BINDER_SMART_BRACKET_COMMAND_ID = __commandIds.SMART_BRACKET_COMMAND_ID;

/**
 * Идентификатор строки Binder. Схема живёт в `command_ids.js`: своей копии
 * здесь больше нет, потому что она уже разошлась однажды с копией в реестре.
 */
function makeBinderCommandId(seedText, used) {
  return __commandIds.binderCommandId(seedText, used);
}

/**
 * Строки Binder: форма, идентификаторы команд и системная строка.
 *
 * **Про перевод идентификаторов (фаза 2, пункт 8).** Идентификатор строки лежит
 * в конфиге, а не только в памяти, и после перехода на kebab-case старая форма
 * `inlineOverhaul_Binder_<Suffix>` в нём остаётся. Такой идентификатор считается
 * **отсутствующим** и пересобирается из имени строки: это тот самый разрыв
 * хоткеев, о котором Р3 предупреждает и о котором плагин один раз сообщает.
 * Оставить старую форму было нельзя — команда с префиксом плагина не отвечает
 * T7, а держать две формы одновременно значит держать две схемы.
 *
 * Набор занятых начинается с идентификаторов ядра: строка Binder, названная
 * `Move left`, не должна затенять команду навигации.
 */
function normalizeBinderRows(rawRows) {
  const source = Array.isArray(rawRows) ? rawRows : [];
  const out = [];
  const used = __commandIds.reservedCommandIds(FEATURE_ORDER);
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
    if (existingId === BINDER_SMART_BRACKET_COMMAND_ID
      || existingId === "inlineOverhaul_Binder_Smart_bracket"
      || existingId === "inlineOverhaul_Binder_Bracket_left") {
      normalizedId = BINDER_SMART_BRACKET_COMMAND_ID;
      hasSmartBracket = true;
      out.push({
        rowId: "binder-system-smart-bracket",
        insertText: "[]",
        commandName: "Smart bracket",
        description: "Cycle the brackets at the cursor: none, then [], then a wikilink",
        commandId: BINDER_SMART_BRACKET_COMMAND_ID,
      });
      continue;
    } else {
      const seed = String(commandName || "").trim() || String(insertText || "").trim() || existingId;
      /* Старая форма и занятый идентификатор — оба повод пересобрать. */
      const reusable = existingId
        && !__commandIds.isLegacyCommandId(existingId)
        && __commandIds.isCompliantCommandId(existingId)
        && !used.has(existingId);
      normalizedId = reusable
        ? (used.add(existingId), existingId)
        : makeBinderCommandId(seed, used);
    }
    out.push({ rowId, insertText, commandName, description, commandId: normalizedId });
  }

  if (!hasSmartBracket) {
    out.unshift({
      rowId: "binder-system-smart-bracket",
      insertText: "[]",
      commandName: "Smart bracket",
      description: "Cycle the brackets at the cursor: none, then [], then a wikilink",
      commandId: BINDER_SMART_BRACKET_COMMAND_ID,
    });
  }

  return out;
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

function hasValidRulesMarkdownBuilder(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.buildTagWheelRulesMarkdownFromConfig === "function");
}

/**
 * Заглушка сборщика заметки правил. Своей копии сборки здесь больше нет.
 *
 * Раньше копия была, и после перехода конфига на версию 2 её пришлось бы
 * править дважды: форма документа правил осталась версии 1, и перекладка
 * значений — работа тонкая. Одна копия из двух неизбежно разошлась бы, а
 * разошлась бы она молча — в заметке правил, которую человек не читает.
 * Поэтому синхронный `require` того же модуля: он работает и в Node, и в
 * сборке, а vault-вариант загрузки к этому времени уже положил модуль в
 * `__rulesMarkdownBuilder`.
 */
function createRulesMarkdownBuilderFallback() {
  try {
    const mod = require("./src/features/rules_markdown_builder.js");
    if (mod && typeof mod.createRulesMarkdownBuilder === "function") {
      const builder = mod.createRulesMarkdownBuilder({ isObj, cloneJson, toPrettyJson });
      if (hasValidRulesMarkdownBuilder(builder)) return builder;
    }
  } catch (_e) { /* модуль приедет асинхронным загрузчиком */ }
  return {
    buildTagWheelRulesMarkdownFromConfig() {
      throw new Error("rules_markdown_builder unavailable");
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

function hasValidSmartDeleteEngine(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.handleSmartDeleteKeymap === "function");
}

async function loadSmartDeleteEngineSafe(app) {
  const candidates = [
    ".obsidian/plugins/inline-overhaul/src/features/smart_delete_engine.js",
    "./.obsidian/plugins/inline-overhaul/src/features/smart_delete_engine.js",
    "plugins/inline-overhaul/src/features/smart_delete_engine.js",
  ];
  const loaded = await loadModuleWithVaultFallback(app, {
    requirePath: "./src/features/smart_delete_engine.js",
    candidates,
    cacheKey: "feature:smart-delete-engine",
    validate: hasValidSmartDeleteEngine,
  });
  if (loaded.mod) {
    __smartDeleteEngine = loaded.mod;
    return __smartDeleteEngine;
  }
  __smartDeleteEngine = {
    handleSmartDeleteKeymap() {
      return false;
    },
  };
  return __smartDeleteEngine;
}

function getSmartDeleteEngine() {
  if (hasValidSmartDeleteEngine(__smartDeleteEngine)) return __smartDeleteEngine;
  __smartDeleteEngine = {
    handleSmartDeleteKeymap() {
      return false;
    },
  };
  return __smartDeleteEngine;
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
      const genPath = String(readCfgPath(cfg, "advanced.generatedRulesPath") || ctx.defaultGeneratedRulesPath || "").trim();
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
  if (!isObj(cfg && cfg.pkm)) return;
  if (!isObj(cfg.pkm.fields)) cfg.pkm.fields = {};
  const fields = cfg.pkm.fields;
  const order = normalizePkmOrder(fields.order);
  fields.order = order;

  if (!isObj(fields.tags)) fields.tags = { fields: [] };
  if (!Array.isArray(fields.tags.fields)) fields.tags.fields = [];
  if (!isObj(fields.links)) fields.links = { fields: [] };
  if (!Array.isArray(fields.links.fields)) fields.links.fields = [];

  const leftFields = fields.tags.fields;
  const rightFields = fields.links.fields;
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
  fields.tags.fields = leftFields.filter((f) => {
    const id = String(f && f.id || "").trim();
    if (!id) return false;
    if (builtInLeftIds.has(id)) return true;
    if (allowedCustomTagIds.has(id)) return true;
    if (allowedCustomSubIds.has(id)) return true;
    return false;
  });
  fields.links.fields = rightFields.filter((f) => {
    const id = String(f && f.id || "").trim();
    if (!id) return false;
    if (builtInRightIds.has(id)) return true;
    if (allowedCustomWikilinkIds.has(id)) return true;
    if (allowedCustomLinkSubIds.has(id)) return true;
    if (allowedCustomElementIds.has(id)) return true;
    return false;
  });

  const leftFieldsLive = fields.tags.fields;
  const rightFieldsLive = fields.links.fields;
  const leftByIdLive = new Set(leftFieldsLive.map((f) => String(f && f.id || "").trim()).filter(Boolean));
  const rightByIdLive = new Set(rightFieldsLive.map((f) => String(f && f.id || "").trim()).filter(Boolean));

  for (const key of keys) {
    const kind = String(order.types && order.types[key] ? order.types[key] : inferOrderFieldType(key)).trim().toLowerCase();
    if (builtInOrderKeys.has(key)) continue;
    if (kind === "element") {
      const elemCfg = isObj(fields.elements && fields.elements.byField && fields.elements.byField[key])
        ? fields.elements.byField[key]
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

  if (!isObj(fields.elements)) fields.elements = { fields: [], byField: {} };
  if (!Array.isArray(fields.elements.fields)) fields.elements.fields = [];
  if (!isObj(fields.elements.byField)) fields.elements.byField = {};

  /* Легаси-ветка `pkm.fields.dates` сворачивается в `pkm.fields.elements`:
     единственный источник истины по элементам — `elements`. Маршрут
     `pkm.behavior.dates` заведён в миграции ровно ради этой ступени. */
  if (isObj(fields.dates)) {
    const legacyDates = fields.dates;
    const legacyFields = Array.isArray(legacyDates.fields) ? legacyDates.fields.map((x) => String(x || "").trim()).filter(Boolean) : [];
    for (const f of legacyFields) {
      if (!fields.elements.fields.includes(f)) fields.elements.fields.push(f);
    }
    const legacyByField = isObj(legacyDates.byField) ? legacyDates.byField : {};
    for (const fid of Object.keys(legacyByField)) {
      const id = String(fid || "").trim();
      if (!id) continue;
      const cur = isObj(fields.elements.byField[id]) ? fields.elements.byField[id] : {};
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
      fields.elements.byField[id] = merged;
    }
    delete fields.dates;
  }

  const strictNames = isObj(order && order.strictNames) ? order.strictNames : {};

  for (const key of keys) {
    const kind = String(order.types && order.types[key] ? order.types[key] : inferOrderFieldType(key)).trim().toLowerCase();
    if (kind !== "element") continue;
    const strictKey = String(strictNames[key] || key).trim() || key;
    if (!fields.elements.fields.includes(key)) fields.elements.fields.push(key);
    const curElem = isObj(fields.elements.byField[key])
      ? fields.elements.byField[key]
      : (isObj(fields.elements.byField[strictKey]) ? fields.elements.byField[strictKey] : {});
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
    fields.elements.byField[key] = normalizedEntry;
  }

  const activeElementKeys = new Set();
  for (const key of keys) {
    const kind = String(order.types && order.types[key] ? order.types[key] : inferOrderFieldType(key)).trim().toLowerCase();
    if (kind === "element") activeElementKeys.add(String(key || "").trim());
  }
  fields.elements.fields = (Array.isArray(fields.elements.fields) ? fields.elements.fields : [])
    .map((k) => String(k || "").trim())
    .filter((k) => k && activeElementKeys.has(k));
  for (const key of Object.keys(fields.elements.byField || {})) {
    const normKey = String(key || "").trim();
    if (!activeElementKeys.has(normKey)) delete fields.elements.byField[key];
  }
  fields.elements.fields = fields.elements.fields.filter((k) => activeElementKeys.has(String(k || "").trim()));

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

/**
 * Что можно написать в имени Field.
 *
 * Та же строка стоит в панели — `STRICT_NAME_RE` в
 * `src/ui/settings/custom/fields_model.ts` — и то же говорит окно
 * переименования. Три места, одно правило: расхождение двух из них уже стоило
 * заказчику молча несработавшего переименования (1.3.1).
 */
const STRICT_FIELD_NAME_RE = /^[a-z0-9_\- ]+$/i;

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
    /*
     * Правило имени Field — одно на оба прохода.
     *
     * Раньше их было два: первый принимал имя с заглавными и пробелами,
     * второй требовал `^[a-z0-9_-]+$` и всё остальное **молча** возвращал к
     * исходному ключу. Панель разрешает то же, что первый проход, — и
     * переименование через карандаш не срабатывало никак: окно закрывалось,
     * имя оставалось прежним, сообщения не было (замечание заказчика 1.3.1).
     *
     * Верным признано мягкое правило: в идентификатор команды имя всё равно
     * идёт через `kebab()` (`src/features/command_ids.js`), а он и заглавные,
     * и пробелы переводит сам. То, что панель и конфиг говорят об имени одно
     * и то же, держит пин в `bootstrap_loader_tests.js`.
     */
    const used = new Set();
    for (const k of orderFields) {
      const v = String(rawOrder.strictNames[k] || "").trim();
      if (!STRICT_FIELD_NAME_RE.test(v)) continue;
      if (used.has(v)) continue;
      out.strictNames[k] = v;
      used.add(v);
    }
    const seen = new Set();
    for (const k of orderFields) {
      const v = String(out.strictNames[k] || "").trim() || k;
      if (!STRICT_FIELD_NAME_RE.test(v) || seen.has(v)) out.strictNames[k] = k;
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
  const order = normalizePkmOrder(readCfgPath(cfg, "pkm.fields.order"));
  const strict = isObj(order && order.strictNames) ? order.strictNames : {};
  const candidate = String(strict[key] || "").trim();
  /*
   * Третье место, где стояло то же строгое правило, и с тем же следствием:
   * имя с заглавной или пробелом здесь молча подменялось ключом, и в заметке
   * конфигурации Field назывался по-старому даже после успешного
   * переименования. Нашлось не чтением, а пином на совпадение правил (1.3.1).
   */
  if (STRICT_FIELD_NAME_RE.test(candidate)) return candidate;
  return key;
}

function serializePkmOrderForMacro(cfg) {
  const order = normalizePkmOrder(readCfgPath(cfg, "pkm.fields.order"));
  const placement = isObj(readCfgPath(cfg, "pkm.placement")) ? readCfgPath(cfg, "pkm.placement") : {};
  /* Имена внутри `freeRoamBehavior` — часть контракта макросов рантайма
     (`docs/PKM_Runtime_Unified_Contract_v1.md`), поэтому меняются только
     источники значений, а не ключи. */
  order.freeRoamBehavior = {
    minimalSeparator: placement.keepPrefixInsertOnly !== false,
    minimalPrefix: placement.fieldPrefixInsertOnly !== false,
    offPrefix: placement.bulletInStrict === true,
    fullPlacement: ["smart", "left", "right"].includes(String(placement.freeInsertPosition || "").trim().toLowerCase())
      ? String(placement.freeInsertPosition || "").trim().toLowerCase()
      : "smart",
  };
  return JSON.stringify(order);
}

function serializeDateRuntimeConfigForMacro(cfg) {
  const elementsCfg = isObj(readCfgPath(cfg, "pkm.fields.elements"))
    ? readCfgPath(cfg, "pkm.fields.elements")
    : {};
  const order = normalizePkmOrder(readCfgPath(cfg, "pkm.fields.order"));
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
      keepInView: true,
      viewPosition: "center",
    },
    moveSelection: {
      enabled: true,
      inlineEnabled: true,
      prefixCyclerEnabled: true,
      indentFallbackEnabled: true,
      onCycleEnd: "indent",
      cycleOrder: ["#", "##", "###", "####", "#####", "1. ", "", "- "],
      inlineMoveMode: "auto",
      inlineBoundaryJump: true,
    },
    jumpToHeader: {
      enabled: true,
      centerCursor: true,
      /* Место на экране после перехода (10.13.37). Умолчание `center` — это
         ровно то, что делал прежний `centerCursor`, поэтому у тех, кто ничего
         не трогал, поведение не меняется. */
      viewPosition: "center",
      centerDelayMs: 60,
      centerThrottleMs: 200,
      jumpMode: "edge",
      edgeMode: "start-end",
      /* Умолчание `End of your text` — заказ заказчика 2026-09-04, вечер.
         Совпадение с умолчанием схемы сторожит `settings_paths_v2_tests.ts`. */
      jumpCursorPosition: "section-end",
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
  backups: {},
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
        description: "Cycle the brackets at the cursor: none, then [], then a wikilink",
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
  const deprecatedPkm = Array.isArray(__compatProfile.DEPRECATED_CONFIG_KEYS?.pkm)
    ? __compatProfile.DEPRECATED_CONFIG_KEYS.pkm
    : ["sourceOfTruth", "autoGenerateRules"];
  for (const key of deprecatedPkm) delete cfg.pkm[key];
}

/**
 * Приёмник старой формы: доводит любой конфиг, написанный до версии 2, до
 * ровной формы версии 1.
 *
 * Раньше это и был `migrateConfig` целиком. После пункта 4 фазы 2 он стал
 * первой из трёх ступеней (`migrateConfig` ниже), и у него осталась ровно
 * одна работа — принять старый файл: переименования вида `leftToRight` →
 * `cycleOrder`, `tagSizePct` → `tagTextSizePct`, `logSize` → `generateAiLog`
 * живут только здесь, и без них обновление со старой версии теряло бы
 * настройки молча.
 *
 * **Ступень обязана идти до миграции, а не после.** Она же ставит умолчания
 * движка — те самые девятнадцать, которыми умолчание схемы отличается от
 * умолчания движка (В-7). Досыпка умолчаний в миграции заполняет только
 * отсутствующее, поэтому пока эта ступень идёт первой, продуктовый вопрос
 * «Transform включён из коробки?» остаётся открытым, а не решается молча
 * порядком вызовов. Пин на этот порядок приезжает вместе с подключением
 * миграции: пока её нет, закреплять нечего.
 */
function normalizeConfigV1(raw) {
  const source = isObj(raw) ? raw : {};
  let cfg = deepMerge(DEFAULT_CONFIG, source);
  const ver = Number(cfg.schemaVersion) || 0;

  /**
   * Значение из **исходного файла**, а не из слитого с умолчаниями.
   *
   * Без этого переименования старой формы были мертвы, и это не догадка:
   * `deepMerge(DEFAULT_CONFIG, source)` кладёт новый ключ раньше, чем код
   * успевает спросить старый. Проверка «нового значения нет» на слитом конфиге
   * никогда не срабатывала — умолчание уже стояло на месте. Человек,
   * обновившийся с версии до переименования, терял свой цикл Prefix, размер
   * тегов, задержку и режим прыжка: молча, на первой же загрузке.
   *
   * Найдено 2026-08-31 при попытке закрепить порядок ступеней пином: пин не
   * встал, и оказалось, что закреплять было нечего.
   */
  const fromFile = (dotted) => {
    let node = source;
    for (const key of String(dotted).split(".")) {
      if (!isObj(node)) return undefined;
      node = node[key];
    }
    return node;
  };

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
  const oldDelay = Number(fromFile("globalFunctions.enhancedSelectAll.multiPressWindowMs"));
  const ownDelay = Number(fromFile("globalFunctions.enhancedSelectAll.delayMs"));
  const curDelay = Number.isFinite(ownDelay)
    ? ownDelay
    : (Number.isFinite(oldDelay) ? oldDelay : Number(cfg.globalFunctions.enhancedSelectAll.delayMs));
  const pickedDelay = Number.isFinite(curDelay) ? curDelay : 700;
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
  {
    const ownCycle = fromFile("navigation.moveSelection.cycleOrder");
    const legacyCycle = fromFile("navigation.moveSelection.leftToRight");
    const hasOwn = Array.isArray(ownCycle) && ownCycle.length;
    if (!hasOwn && Array.isArray(legacyCycle) && legacyCycle.length) {
      cfg.navigation.moveSelection.cycleOrder = legacyCycle.slice();
    } else if (!Array.isArray(cfg.navigation.moveSelection.cycleOrder) || !cfg.navigation.moveSelection.cycleOrder.length) {
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
  {
    const ownEdge = fromFile("navigation.jumpToHeader.edgeMode");
    const inside = fromFile("navigation.jumpToHeader.insideTarget");
    const boundary = fromFile("navigation.jumpToHeader.boundaryTarget");
    const legacyEdge = inside === "section-start" && boundary === "section-start"
      ? "start"
      : (inside === "section-end" && boundary === "section-end" ? "end" : "");
    if (!["start-end", "start", "end"].includes(ownEdge) && legacyEdge) {
      cfg.navigation.jumpToHeader.edgeMode = legacyEdge;
    } else if (!["start-end", "start", "end"].includes(cfg.navigation.jumpToHeader.edgeMode)) {
      cfg.navigation.jumpToHeader.edgeMode = "start-end";
    }
  }
  {
    const ownCursor = fromFile("navigation.jumpToHeader.jumpCursorPosition");
    const legacyAnchor = fromFile("navigation.jumpToHeader.endAnchorMode");
    if (!["start", "end", "section-end"].includes(ownCursor) && legacyAnchor === "active-text-end") {
      cfg.navigation.jumpToHeader.jumpCursorPosition = "section-end";
    } else if (!["start", "end", "section-end"].includes(cfg.navigation.jumpToHeader.jumpCursorPosition)) {
      cfg.navigation.jumpToHeader.jumpCursorPosition = "start";
    }
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
    /* Старое имя берётся из файла, новое — тоже: иначе умолчание, которое уже
       положил `deepMerge`, всегда выигрывает у выбора человека. */
    const clampPct = (n) => Math.max(80, Math.min(140, n));
    const pickPct = (ownPath, legacyPaths, fallback) => {
      const own = Math.trunc(Number(fromFile(ownPath)));
      if (Number.isFinite(own)) return clampPct(own);
      for (const legacyPath of legacyPaths) {
        const old = Math.trunc(Number(fromFile(legacyPath)));
        if (Number.isFinite(old)) return clampPct(old);
      }
      const merged = Math.trunc(Number(fallback));
      return Number.isFinite(merged) ? clampPct(merged) : 100;
    };
    const B = "pkm.behavior.tagVisuals.";
    visuals.tagTextSizePct = pickPct(B + "tagTextSizePct", [B + "tagSizePct"], visuals.tagTextSizePct);
    visuals.tagBubbleWidthPct = pickPct(B + "tagBubbleWidthPct",
      [B + "tagBubbleSizePct", B + "tagSizePct"], visuals.tagBubbleWidthPct);
    visuals.tagBubbleHeightPct = pickPct(B + "tagBubbleHeightPct",
      [B + "tagBubbleSizePct", B + "tagSizePct"], visuals.tagBubbleHeightPct);
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

    /* Карты `byField`, `byTag` и `userTags` вместе с полосой нормализуются
       третьей ступенью на путях версии 2 (`normalizeTagVisualMapsV2`): они
       обязаны отрабатывать на каждом патче, а первая ступень идёт только для
       файла версии ниже второй. */
    if (isObj(visuals.line)) delete visuals.line;

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
  /* Order, определения Fields и формы чекбоксов Prefix нормализуются
     третьей ступенью на путях версии 2: `normalizePkmOrder`,
     `ensureBehaviorModesFromOrder` и `normalizePkmBehaviorShape` читают
     `pkm.fields.*` и `pkm.prefixRules.*`, которых в форме версии 1 нет. */

  if (!isObj(cfg.backups)) cfg.backups = cloneJson(DEFAULT_CONFIG.backups);

  if (!isObj(cfg.meta)) cfg.meta = cloneJson(DEFAULT_CONFIG.meta);

  if (!isObj(cfg.devMode)) cfg.devMode = cloneJson(DEFAULT_CONFIG.devMode);
  if (typeof cfg.devMode.enabled !== "boolean") cfg.devMode.enabled = DEFAULT_CONFIG.devMode.enabled;
  if (typeof cfg.devMode.traceTagVisualLine !== "boolean") cfg.devMode.traceTagVisualLine = DEFAULT_CONFIG.devMode.traceTagVisualLine;
  {
    const p = String(cfg.devMode.logPath || "").trim();
    cfg.devMode.logPath = p || DEFAULT_CONFIG.devMode.logPath;
  }
  {
    const oldLevel = String(fromFile("devMode.logLevel") || "").trim().toLowerCase();
    const oldSize = String(fromFile("devMode.logSize") || "").trim();
    const own = fromFile("devMode.generateAiLog");
    if (typeof own !== "boolean") {
      if (oldSize) cfg.devMode.generateAiLog = oldSize === "for AI";
      else if (oldLevel) cfg.devMode.generateAiLog = ["trace", "info"].includes(oldLevel);
      else if (typeof cfg.devMode.generateAiLog !== "boolean") cfg.devMode.generateAiLog = DEFAULT_CONFIG.devMode.generateAiLog;
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

/**
 * Миграция `1 → 2` берётся синхронным `require`, а не ленивым загрузчиком с
 * заглушкой. Заглушка здесь означала бы конфиг, не прошедший миграцию, — то
 * есть половину настроек, которых движок не найдёт. Путь с расширением `.ts`
 * работает и в Node 24 (стирание типов), и в сборке esbuild
 * (`resolveExtensions` в `build/release.js`).
 */
let __configMigrationV2 = null;
function getConfigMigrationV2Module() {
  if (__configMigrationV2) return __configMigrationV2;
  __configMigrationV2 = require("./src/core/config_migration_v2.ts");
  return __configMigrationV2;
}

/** Прочитать значение по точечному пути. */
function readCfgPath(root, path) {
  let node = root;
  for (const key of String(path || "").split(".")) {
    if (!isObj(node)) return undefined;
    node = node[key];
  }
  return node;
}

/** Записать значение по точечному пути, создавая объекты по дороге. */
function writeCfgPath(root, path, value) {
  const parts = String(path || "").split(".");
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isObj(node[parts[i]])) node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
  return root;
}

let __engineDefaultsV2 = null;
/**
 * Умолчания **движка** в форме версии 2.
 *
 * Считаются один раз прогоном первых двух ступеней на пустом конфиге, а не
 * выписываются рядом списком: второй список умолчаний разошёлся бы с первым на
 * первой же правке. Схема сюда не заглядывает намеренно — девятнадцать
 * расхождений умолчаний схемы и движка (В-7) остаются продуктовым вопросом
 * заказчика, и порядок вызовов их не решает.
 */
function getEngineDefaultsV2() {
  if (__engineDefaultsV2) return __engineDefaultsV2;
  const migrated = getConfigMigrationV2Module().migrate(normalizeConfigV1({}), { log: () => {} });
  __engineDefaultsV2 = migrated;
  return __engineDefaultsV2;
}

/**
 * Карты вида тегов на путях версии 2: `visual.tags.byField`, `.byTag`,
 * `.userTags`.
 *
 * Живут в третьей ступени, а не в первой, потому что панель правит их на
 * каждом патче, а первая ступень идёт только для файла версии ниже второй.
 */
function normalizeTagVisualMapsV2(cfg) {
  const tags = isObj(readCfgPath(cfg, "visual.tags")) ? readCfgPath(cfg, "visual.tags") : {};
  writeCfgPath(cfg, "visual.tags", tags);

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
    return {
      fillColor: normalizeHexColorInput(src.fillColor),
      textColor: normalizeHexColorInput(src.textColor),
      visibility: normalizeVisibility(src.visibility, fallbackVisibility),
      customText: String(src.customText || "").trim(),
    };
  };

  const byFieldIn = isObj(tags.byField) ? tags.byField : {};
  const byFieldOut = {};
  for (const fieldIdRaw of Object.keys(byFieldIn)) {
    const fieldId = String(fieldIdRaw || "").trim();
    if (!fieldId) continue;
    const fieldRow = isObj(byFieldIn[fieldIdRaw]) ? byFieldIn[fieldIdRaw] : {};
    byFieldOut[fieldId] = {
      visibilityDefault: normalizeVisibility(fieldRow.visibilityDefault, "default"),
    };
  }
  tags.byField = byFieldOut;

  const byTagIn = isObj(tags.byTag) ? tags.byTag : {};
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
  tags.byTag = byTagOut;

  const userTagsIn = isObj(tags.userTags) ? tags.userTags : {};
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
  tags.userTags = userTagsOut;
}

/**
 * Третья ступень: клампы, перечисления и структура на путях версии 2.
 *
 * Идёт на **каждом** патче, в том числе на записи из панели. Первая ступень
 * (`normalizeConfigV1`) в это время молчит: её работа — принять файл, который
 * лежал на диске в старой форме, и она выполняется один раз за обновление.
 *
 * Умолчание, которым здесь заменяется испорченное значение, берётся у
 * **движка** (`getEngineDefaultsV2`), а не у схемы. Иначе третья ступень тихо
 * решила бы девятнадцать расхождений В-7 в пользу прототипа.
 */
function normalizeConfigV2(cfg) {
  if (!isObj(cfg)) return cfg;
  const defaults = getEngineDefaultsV2();
  const def = (path) => cloneJson(readCfgPath(defaults, path));

  const bool = (path) => {
    if (typeof readCfgPath(cfg, path) !== "boolean") writeCfgPath(cfg, path, def(path));
  };
  const oneOf = (path, values) => {
    const value = String(readCfgPath(cfg, path) ?? "").trim();
    if (!values.includes(value)) writeCfgPath(cfg, path, def(path));
    else writeCfgPath(cfg, path, value);
  };
  const int = (path, min, max) => {
    const n = Math.trunc(Number(readCfgPath(cfg, path)));
    if (!Number.isFinite(n)) {
      writeCfgPath(cfg, path, def(path));
      return;
    }
    writeCfgPath(cfg, path, Math.max(min, Math.min(max, n)));
  };
  const text = (path) => {
    const value = String(readCfgPath(cfg, path) ?? "").trim();
    writeCfgPath(cfg, path, value || def(path));
  };
  const hex = (path) => {
    writeCfgPath(cfg, path, normalizeHexColorInput(readCfgPath(cfg, path)));
  };
  const list = (path) => {
    if (!Array.isArray(readCfgPath(cfg, path))) writeCfgPath(cfg, path, def(path) || []);
  };
  const map = (path) => {
    if (!isObj(readCfgPath(cfg, path))) writeCfgPath(cfg, path, {});
  };

  /* --- модули ---------------------------------------------------------- */
  for (const feature of FEATURE_ORDER) bool("features." + feature + ".enabled");

  /* --- Fields: Order, определения, элементы ---------------------------- */
  map("pkm.fields");
  ensureBehaviorModesFromOrder(cfg);
  map("pkm.fields.taxonomy");
  map("pkm.fields.checkboxByValue");
  map("pkm.fields.projects");
  oneOf("pkm.fields.defaultBlock", ["left", "right"]);

  /* --- Prefix: формы чекбоксов и списки приоритета ---------------------- */
  cfg = getConfigMigrationModule().normalizePkmBehaviorShape(cfg, { cloneJson, isObj });
  oneOf("pkm.prefixPriority.decideBy", ["by-section", "by-checkbox-list"]);
  oneOf("pkm.prefixPriority.fieldOrderSource", ["manual", "auto"]);
  oneOf("pkm.prefixPriority.parentOrChild", ["subtag-over-tag", "tag-over-subtag"]);

  /* --- как Field встаёт в строку --------------------------------------- */
  oneOf("pkm.behavior.childTagFormat", ["separate", "combined"]);
  writeCfgPath(cfg, "pkm.behavior.cycleEndBehavior",
    normalizeCycleEndBehaviorLegacy(readCfgPath(cfg, "pkm.behavior.cycleEndBehavior")));
  oneOf("pkm.behavior.cursorPolicy", ["text_end", "current_position", "line_end"]);
  bool("pkm.placement.keepPrefixInsertOnly");
  bool("pkm.placement.fieldPrefixInsertOnly");
  bool("pkm.placement.bulletInStrict");
  oneOf("pkm.placement.freeInsertPosition", ["smart", "left", "right"]);
  text("pkm.lineFormat.separator1");
  text("pkm.lineFormat.separator2");

  /* --- заметки PKM ------------------------------------------------------ */
  text("advanced.generatedRulesPath");

  /* --- навигация -------------------------------------------------------- */
  oneOf("navigation.moveLine.noSelectionMode", ["line-only", "with-children"]);
  oneOf("navigation.moveLine.headerMode", ["move-as-line", "move-with-section"]);
  bool("navigation.moveLine.crossSectionAllowed");
  bool("navigation.moveLine.highlightMovedLines");
  /* Прокрутка при перемещении строки (10.13.36). До этого её не было вовсе:
     свой код до платформы не доезжал, и прыжок решала она. */
  bool("navigation.moveLine.keepInView");
  oneOf("navigation.moveLine.viewPosition", ["center", "top", "bottom"]);
  bool("navigation.moveSelection.inlineEnabled");
  bool("navigation.moveSelection.prefixCyclerEnabled");
  bool("navigation.moveSelection.indentFallbackEnabled");
  oneOf("navigation.moveSelection.onCycleEnd", ["indent", "wrap"]);
  oneOf("navigation.moveSelection.inlineMoveMode", ["auto", "char", "word", "disabled"]);
  bool("navigation.moveSelection.inlineBoundaryJump");
  writeCfgPath(cfg, "navigation.moveSelection.enabled",
    readCfgPath(cfg, "navigation.moveSelection.inlineEnabled") === true);
  list("navigation.moveSelection.cycleOrder");
  oneOf("navigation.jumpToHeader.jumpMode", ["edge", "line"]);
  oneOf("navigation.jumpToHeader.edgeMode", ["start-end", "start", "end"]);
  oneOf("navigation.jumpToHeader.jumpCursorPosition", ["start", "end", "section-end"]);
  bool("navigation.jumpToHeader.centerCursor");
  /* Место на экране после перехода по заголовкам (10.13.37): те же три
     положения, что у перемещения строки. */
  oneOf("navigation.jumpToHeader.viewPosition", ["center", "top", "bottom"]);
  int("navigation.jumpToHeader.centerDelayMs", 0, 2000);
  int("navigation.jumpToHeader.centerThrottleMs", 0, 5000);
  oneOf("navigation.navigateInline.stepMode", ["word", "sentence", "begin-end"]);
  bool("navigation.navigateInline.boundaryJump");
  oneOf("navigation.navigateInline.onBoundary", ["stay", "wrap", "next-line"]);

  /* --- «выделить всё» и Binder ------------------------------------------ */
  bool("editor.selectAll.enabled");
  oneOf("editor.selectAll.mode", ["line-note", "line-tree-note", "line-tree-header-note"]);
  bool("editor.selectAll.useDelay");
  int("editor.selectAll.delayMs", 250, 2000);
  bool("editor.selectAll.clearOnLast");
  /* Smart Delete (10.13.32). Клавиша Obsidian, поэтому умолчание выключено. */
  bool("editor.smartDelete.enabled");
  bool("editor.smartDelete.dropPrefix");
  bool("editor.smartDelete.onBackspace");
  bool("editor.smartDelete.joinWithSpace");
  writeCfgPath(cfg, "editor.binder.rows", normalizeBinderRows(readCfgPath(cfg, "editor.binder.rows")));

  /* --- вид тегов -------------------------------------------------------- */
  int("visual.tags.opacityLeft", 0, 100);
  int("visual.tags.opacityRight", 0, 100);
  int("visual.tags.textSizePct", 80, 140);
  int("visual.tags.bubbleWidthPct", 80, 140);
  int("visual.tags.bubbleHeightPct", 80, 140);
  int("visual.tags.emptyBubblePct", 50, 180);
  int("visual.tags.cornersPct", 0, 100);
  normalizeTagVisualMapsV2(cfg);

  /* --- каретка: цвет, толщина, мерцание (10.13.33) ---------------------- */
  bool("visual.caret.enabled");
  /* Пусто = взять у темы, и `hex` возвращает пустую строку для чего угодно,
     что не похоже на цвет (то же правило, что у цветов TagWheel). */
  hex("visual.caret.color");
  /* Форма — своя половина группы, со своим тумблером (Ц6). */
  bool("visual.caret.shapeEnabled");
  int("visual.caret.width", 1, 8);
  /* Ноль — законное значение и значит «не мигает вовсе», поэтому нижняя
     граница здесь 0, а не 1 (Ц7). */
  int("visual.caret.blinkSpeed", 0, 10);

  /* --- Tag Bars: форму задаёт сам движок полосы -------------------------- */
  writeCfgPath(cfg, "visual.tagBars", __priorityStripEngine.normalizeStripConfig(
    isObj(readCfgPath(cfg, "visual.tagBars")) ? readCfgPath(cfg, "visual.tagBars") : {}));

  /* --- TagWheel ---------------------------------------------------------- */
  hex("visual.tagWheel.textColor");
  hex("visual.tagWheel.fillColor");
  bool("visual.tagWheel.showMarkers");
  bool("visual.tagWheel.highlightLine");
  bool("visual.tagWheel.scroller.enabled");
  oneOf("visual.tagWheel.scroller.direction", ["up", "down", "full"]);
  int("visual.tagWheel.scroller.size", 1, 20);
  /* Цвета скроллера (10.13.15). Пустое значение — «взять у темы», и `hex`
     оставляет его пустым: второго смысла у пустоты в панели быть не должно. */
  hex("visual.tagWheel.scroller.fillColor");
  hex("visual.tagWheel.scroller.textColor");
  /* Что делает стрелка на краю Block (10.13.35). Умолчание прежнее
     поведение: менять его всем без спроса нельзя. */
  oneOf("visual.tagWheel.edgeMode", ["stay", "next-block"]);
  /* Цвет активного Field: он на строке, а не в коробке скроллера (10.13.15). */
  hex("visual.tagWheel.activeTextColor");

  /* --- режим разработчика ------------------------------------------------ */
  bool("advanced.devMode.enabled");
  bool("advanced.devMode.aiLog");
  bool("advanced.devMode.traceTagVisualLine");
  text("advanced.devMode.logPath");


  /*
   * Ветка Transform: клампы, перечисления и снятие решёток с текстбоксов.
   *
   * Этот вызов стоял **только** в первой ступени, то есть работал ровно для
   * файла версии ниже второй. Для файла версии 2 и для любого патча из панели
   * ветка Transform не нормализовалась вовсе — а третья ступень обязана идти
   * на каждом патче (У-13). Видно это стало на решётках: решение 1.6.4.1 от
   * 2026-08-31 убирает `#` из `Text of the line above` в пользу
   * `Line above is header`, снятие написано в `normalizeInline2Note`, а в
   * конфиге заказчика по-прежнему лежало `### Inline transformed`
   * (замечание B16, 2026-09-02).
   */
  cfg = getTransformFeature().normalizeTransformConfig(cfg);

  cfg.schemaVersion = getConfigMigrationV2Module().SCHEMA_VERSION_V2;
  return cfg;
}

/**
 * Единственный путь записи: `ConfigStore` прогоняет через него **каждый**
 * патч, а не только загрузку.
 *
 * Ступеней три, и порядок у них обязательный:
 *
 * 1. `normalizeConfigV1` — приём старой формы. Идёт только для файла версии
 *    ниже второй: у патча из панели форма уже вторая, и гнать его через
 *    приёмник значило бы каждый раз заново создавать ветки версии 1 из
 *    `DEFAULT_CONFIG` и стравливать их с тем, что человек только что нажал.
 * 2. миграция `1 → 2` — перенос по карте `ROUTES` плюс досыпка умолчаний.
 * 3. `normalizeConfigV2` — клампы, перечисления и структура на путях версии 2.
 *
 * **Почему первая ступень идёт до второй, а не после.** Умолчания движка
 * ставит первая ступень; досыпка умолчаний внутри миграции берёт значения из
 * схемы и заполняет только отсутствующее. Пока порядок такой, девятнадцать
 * расхождений схемы и движка (В-7) остаются продуктовым вопросом заказчика.
 * Переставь ступени местами — и на свежей установке победит прототип: Transform
 * включится из коробки, папка шаблонов станет `Templates`, созданная заметка
 * начнёт открываться сама. То есть продуктовое решение примет порядок вызовов.
 * Закреплено проверкой `tests/regression/migrate_stage_order_tests.ts`.
 */
function migrateConfig(raw) {
  const source = isObj(raw) ? raw : {};
  const version = Number(source.schemaVersion) || 0;
  const accepted = version >= getConfigMigrationV2Module().SCHEMA_VERSION_V2
    ? source
    : normalizeConfigV1(source);
  return normalizeConfigV2(getConfigMigrationV2Module().migrate(accepted));
}

/**
 * Все определения Fields подряд: сперва теги (`pkm.fields.tags`), затем ссылки
 * и элементы (`pkm.fields.links`).
 *
 * Имена веток названы по **типу** Field, а не по стороне панели (ответ В9):
 * ловушка `leftMode` / `rightMode` стоила проекту трёх правок подряд.
 */
function collectPkmFieldDefinitions(cfg) {
  const fields = isObj(readCfgPath(cfg, "pkm.fields")) ? readCfgPath(cfg, "pkm.fields") : {};
  return []
    .concat(Array.isArray(fields.tags && fields.tags.fields) ? fields.tags.fields : [])
    .concat(Array.isArray(fields.links && fields.links.fields) ? fields.links.fields : []);
}

/**
 * Все команды плагина одним списком — для справочника 10.5.
 *
 * Собирается из **того же реестра**, которым команды регистрируются. Выписать
 * список во второй раз значило бы завести таблицу, которая разойдётся с набором
 * команд на первом же новом Field — и разойдётся молча, в том самом месте, куда
 * человек приходит узнать правду. Своей копии этих правил не должно быть и в
 * проверке: она зовёт эту же функцию.
 *
 * `area` — область справочника, `family` — признак «команда одна из многих
 * одинаковых»: у Field пара команд, у строки Binder своя, у модуля тумблер. По
 * ним справочник разворачивает шаблонные строки прототипа в настоящие.
 *
 * Отказ реестра — пустой список, а не исключение: справочник покажет пустую
 * таблицу, панель не упадёт.
 */
function buildOwnCommandList(plugin) {
  const registry = getCommandRegistry();
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : {};
  const out = [];
  const push = (defs, area, family) => {
    for (const d of Array.isArray(defs) ? defs : []) {
      const id = String(d && d.id ? d.id : "").trim();
      if (!id) continue;
      /*
       * `group` и `sub` нужны справочнику: команды одного Field обязаны
       * стоять рядом, а дочерние — сразу за родительскими (замечание
       * заказчика 1.2.3.4.3). Заполняются только там, где у определения есть
       * `strictName`, то есть у пары команд Field.
       */
      /*
       * Подпись дочернего Field в имени команды — через ДЕФИС (`type-sub`):
       * её ставит `commandStrictForKey` в реестре, а ключ Order при этом
       * оканчивается на `_sub`. Первая версия этой строки резала `_sub`, и
       * дочерние команды уезжали в конец списка отдельными семьями.
       */
      const strict = String(d && d.strictName ? d.strictName : "").trim();
      const isSub = /[-_]sub$/.test(strict);
      out.push({
        id,
        name: String(d && d.name ? d.name : id),
        area,
        family: typeof family === "function" ? family(d) : (family || ""),
        group: strict ? strict.replace(/[-_]sub$/, "") : "",
        sub: isSub,
        /* Подзаголовок справочника: подпись Field и его тип (2026-08-31). */
        groupLabel: String(d && d.groupLabel ? d.groupLabel : ""),
        kind: String(d && d.kind ? d.kind : ""),
      });
    }
  };

  try {
    push(registry.buildNavigationCommandDefs(plugin, getActiveTagWheelRulesPath), "Navigation", "");
    push(
      registry.buildPkmCommandDefs(
        getActiveTagWheelRulesPath,
        serializePkmOrderForMacro,
        serializeDateRuntimeConfigForMacro,
        normalizePkmOrder,
        cfg,
        FEATURE_ORDER
      ),
      "Tags & PKM",
      (d) => {
        /* Команды TagWheel — не семья: их всегда ровно две, и в прототипе они
           названы поимённо. */
        if (!String(d && d.strictName ? d.strictName : "").trim()) return "";
        return d.direction === "decrease" ? "field-previous" : "field-next";
      }
    );
    push([{ id: "transform-inline-to-note", name: __commandIds.commandName("transform-inline-to-note") }],
      "Transform", "");
    push(registry.buildBinderCommandDefs(cfg), "Binder",
      (d) => (String(d && d.id ? d.id : "") === BINDER_SMART_BRACKET_COMMAND_ID ? "" : "binder-row"));
    push(registry.buildCoreCommandDefs(plugin, FEATURE_ORDER, FEATURE_META), "General",
      (d) => (/^toggle-feature-/.test(String(d && d.id ? d.id : "")) ? "module-toggle" : ""));
  } catch (e) {
    reportLoaderFallback("main.buildOwnCommandList", e);
    return [];
  }
  return out;
}

function getActiveTagWheelRulesPath(cfg) {
  const generated = String(readCfgPath(cfg, "advanced.generatedRulesPath") || "").trim();
  if (generated) return generated;
  return String(DEFAULT_CONFIG.pkm.generatedRulesPath);
}

function normalizeHexColorInput(value) {
  const src = String(value || "").trim().toLowerCase();
  if (!src) return "";
  return /^#[0-9a-f]{6}$/.test(src) ? src : "";
}

function getTagwheelHeaderColorsFromConfig(cfg) {
  const wheel = isObj(readCfgPath(cfg, "visual.tagWheel")) ? readCfgPath(cfg, "visual.tagWheel") : {};
  return {
    defaultTextColor: normalizeHexColorInput(wheel.textColor),
    /* Цвет активного Field: пусто — он красится как остальные (10.13.15). */
    activeTextColor: normalizeHexColorInput(wheel.activeTextColor),
    fillColor: normalizeHexColorInput(wheel.fillColor),
    showPrefix: wheel.showMarkers !== false,
  };
}

function buildTagwheelPlaceholderSetFromConfig(cfg) {
  const out = new Set();
  const order = isObj(readCfgPath(cfg, "pkm.fields.order")) ? readCfgPath(cfg, "pkm.fields.order") : {};
  const labels = isObj(order.labels) ? order.labels : {};
  for (const key of Object.keys(labels)) {
    const value = String(labels[key] || "").trim();
    if (value) out.add(value);
  }
  const fields = isObj(readCfgPath(cfg, "pkm.fields")) ? readCfgPath(cfg, "pkm.fields") : {};
  const modes = [
    isObj(fields.tags) ? fields.tags : {},
    isObj(fields.links) ? fields.links : {},
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

/**
 * Вид тегов на путях версии 2 (`visual.tags.*`, `visual.tagBars.*`).
 *
 * Имена возвращаемых полей — контракт с виджетами и с проверками, поэтому
 * остались прежними; поменялось только то, откуда берутся значения.
 *
 * **Прозрачность меняет единицы.** В версии 1 это доля `0..1`, в версии 2 —
 * проценты `0..100` (PRD 8.1в). Наружу отдаётся по-прежнему доля: её кладут
 * прямо в CSS.
 */
function getTagVisualsFromConfig(cfg) {
  const tags = isObj(readCfgPath(cfg, "visual.tags")) ? readCfgPath(cfg, "visual.tags") : {};
  const ui = isObj(cfg && cfg.ui) ? cfg.ui : {};
  const strip = __priorityStripEngine.normalizeStripConfig(
    isObj(readCfgPath(cfg, "visual.tagBars")) ? readCfgPath(cfg, "visual.tagBars") : {});
  const pctToShare = (v, f) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return f;
    return Math.max(0, Math.min(1, n / 100));
  };
  return {
    opacityLeft: pctToShare(tags.opacityLeft, 1),
    opacityRight: pctToShare(tags.opacityRight, 1),
    tagTextSizePct: Number.isFinite(Math.trunc(Number(tags.textSizePct)))
      ? Math.max(80, Math.min(140, Math.trunc(Number(tags.textSizePct))))
      : 100,
    tagBubbleWidthPct: Number.isFinite(Math.trunc(Number(tags.bubbleWidthPct)))
      ? Math.max(80, Math.min(140, Math.trunc(Number(tags.bubbleWidthPct))))
      : 100,
    tagBubbleHeightPct: Number.isFinite(Math.trunc(Number(tags.bubbleHeightPct)))
      ? Math.max(80, Math.min(140, Math.trunc(Number(tags.bubbleHeightPct))))
      : 100,
    emptyBubbleSizePct: Number.isFinite(Math.trunc(Number(tags.emptyBubblePct)))
      ? Math.max(50, Math.min(180, Math.trunc(Number(tags.emptyBubblePct))))
      : 100,
    tagShapePct: Number.isFinite(Math.trunc(Number(tags.cornersPct)))
      ? Math.max(0, Math.min(100, Math.trunc(Number(tags.cornersPct))))
      : 0,
    byTag: isObj(tags.byTag) ? tags.byTag : {},
    userTags: isObj(tags.userTags) ? tags.userTags : {},
    separator1TextColor: normalizeHexColorInput(tags.separator1TextColor) || normalizeHexColorInput(ui.separator1TextColor),
    separator2TextColor: normalizeHexColorInput(tags.separator2TextColor) || normalizeHexColorInput(ui.separator2TextColor),
    stripActive: strip.active === true,
    strip,
  };
}

/**
 * Ширина пустого пузыря при 100 %.
 *
 * То же число стоит в панели: `.io-bubble--empty` в `styles.css` считает
 * `calc(30px * var(--io-empty-x))`. Два места, одно число — за их сходством
 * следит `tag_visual_render_tests.ts`, потому что разъехавшиеся формулы уже
 * стоили заказчику настройки, которая «ни на что не влияет» (И-2.3).
 */
const TAG_EMPTY_BUBBLE_BASE_PX = 30;

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
  const visuals = getTagVisualsFromConfig(cfg);
  const byTag = visuals.byTag;
  const fields = collectPkmFieldDefinitions(cfg);
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
  const fields = collectPkmFieldDefinitions(cfg);
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
  const byTag = isObj(readCfgPath(cfg, "visual.tags.byTag")) ? readCfgPath(cfg, "visual.tags.byTag") : {};
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
      /*
       * Ширина пустого пузыря считается так же, как в панели:
       * `.io-bubble--empty { width: calc(30px * var(--io-empty-x)) }`
       * (`styles.css`), горизонтальные поля при этом снимаются.
       *
       * Раньше здесь стояла своя формула — от горизонтального поля пузыря, —
       * и вся шкала настройки 50…180 % умещалась в заметке в 6…18 px, причём
       * нижняя треть упиралась в предел и не двигалась вовсе. Настройка
       * работала, но увидеть её было нельзя (замечание И-2.3). Панель по Р8
       * нормативна, поэтому равняется заметка.
       */
      el.style.width = `${Math.round(TAG_EMPTY_BUBBLE_BASE_PX * emptyScale)}px`;
      el.style.minWidth = el.style.width;
      el.style.paddingLeft = "0px";
      el.style.paddingRight = "0px";
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

/**
 * Метки элементов, какие завёл человек: `📅`, `⏰` и прочие.
 *
 * Берутся из конфига, а не из списка литералов: элемент — это Field, и его
 * метку человек меняет в панели.
 */
/**
 * Хвост токена эмодзи-элемента, выведенный из ФОРМАТА поля.
 *
 * Зачем не «всё до пробела». Сканер искал элемент именно так, и формат из
 * нескольких слов обрывался на первом же: у `📅YYYY-MM-DD hh:mm` оформлялась
 * только дата, а `hh:mm` оставалось без прозрачности блока и без размера
 * текста (замечание заказчика C35, 2026-09-02).
 *
 * Формат разбирается буквами: подряд идущие буквы образца (`YYYY`, `MM`, `hh`)
 * становятся столькими же цифрами, пробел — пробелом, остальное — собой. Так
 * хвост знает свою длину и не съедает следующий токен: жадное «до пробела»
 * съело бы и `#work`, если бы тот стоял без пробела.
 */
function elementTailPatternFromFormat(format) {
  const src = String(format || "").trim();
  if (!src) return "";
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/[A-Za-z]/.test(ch)) {
      let n = 0;
      while (i < src.length && /[A-Za-z]/.test(src[i])) { i += 1; n += 1; }
      out += "\\d{" + n + "}";
      continue;
    }
    if (ch === " ") { out += "[ ]"; i += 1; continue; }
    out += escapeRegExp(ch);
    i += 1;
  }
  return out;
}

/**
 * Эмодзи-элементы: метка и то, чем записан её хвост.
 *
 * Отдаются пары, а не одни метки: без формата длину хвоста посчитать нечем, а
 * формат живёт у поля.
 */
function buildElementMarkersFromConfig(cfg) {
  const byField = isObj(readCfgPath(cfg, "pkm.fields.elements.byField"))
    ? readCfgPath(cfg, "pkm.fields.elements.byField")
    : {};
  const out = [];
  const seen = new Set();
  for (const key of Object.keys(byField)) {
    const row = isObj(byField[key]) ? byField[key] : {};
    const marker = String(row.emoji || "").trim();
    if (!marker || seen.has(marker)) continue;
    seen.add(marker);
    out.push({ marker, tail: elementTailPatternFromFormat(row.format) });
  }
  /* Длинные метки первыми: короткая не должна откусывать начало длинной. */
  out.sort((a, b) => b.marker.length - a.marker.length);
  return out;
}

/**
 * Всё, что плагин сам поставил в строку: теги, ссылки и элементы.
 *
 * До этого сканер искал только `#\S+`, и настройки блока — прозрачность и
 * размер текста — доставались одним тегам: эмодзи-элемент `📅2026-09-01` и
 * ссылка `[[Note]]` в разбор не попадали вовсе (замечание И-2.2).
 *
 * Пересечения снимаются: `#` внутри ссылки (`[[#heading]]`) — часть ссылки, а
 * не отдельный тег. Побеждает тот, кто начался раньше, а при равном начале —
 * тот, кто длиннее.
 */
function scanLineVisualTokens(text, sep1, sep2, elementMarkers) {
  const src = String(text || "");
  const found = [];
  const pushAll = (rx, kind) => {
    let m;
    while ((m = rx.exec(src)) !== null) {
      const raw = String(m[0] || "");
      const token = raw.trim();
      if (!token) continue;
      found.push({ token, kind, index: m.index, end: m.index + token.length });
    }
  };
  pushAll(/\[\[[^\][\n]+\]\]/g, "link");
  const markers = Array.isArray(elementMarkers) ? elementMarkers : [];
  for (const entry of markers) {
    /* Метка бывает и строкой: так её отдавала прежняя форма списка. */
    const marker = typeof entry === "string" ? entry : String(entry && entry.marker || "");
    const tail = typeof entry === "string" ? "" : String(entry && entry.tail || "");
    if (!marker) continue;
    /*
     * Хвост берётся из формата поля, а не «всё до пробела»: формат из
     * нескольких слов иначе обрывается на первом (C35). Формата нет —
     * остаётся прежнее правило: гадать о длине честнее, чем выдумать её.
     */
    pushAll(new RegExp(escapeRegExp(marker) + (tail || "\\S+"), "g"), "element");
  }
  pushAll(/#\S+/g, "tag");

  found.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return (b.end - b.index) - (a.end - a.index);
  });

  const out = [];
  let claimedTo = -1;
  for (const entry of found) {
    if (entry.index < claimedTo) continue;
    out.push({
      token: entry.token,
      kind: entry.kind,
      index: entry.index,
      end: entry.end,
      zone: resolveTagVisualZone(src, entry.index, sep1, sep2),
    });
    claimedTo = entry.end;
  }
  return out;
}

/**
 * Прозрачность блока и размер текста для токена, у которого нет своего цвета.
 *
 * Токен со своим цветом получает и то и другое через пузырь
 * (`TagVisualTokenWidget`); всем остальным нужна декорация **стилем**, а не
 * подменой: заменить `[[Note]]` своим узлом значит забрать у ссылки клик.
 *
 * Текст между разделителями не трогается — это ваш текст, а не запись
 * плагина (решение заказчика 2026-09-01).
 */
function buildBlockStyleCss(entry, visuals) {
  const zone = String(entry && entry.zone || "");
  if (zone !== "left" && zone !== "right") return "";
  const opacity = Number(entry && entry.zoneOpacity);
  const sizePct = Number(visuals && visuals.tagTextSizePct);
  const parts = [];
  if (Number.isFinite(opacity) && opacity < 1) parts.push("opacity: " + opacity + ";");
  if (Number.isFinite(sizePct) && sizePct !== 100) {
    /* Размер берётся той же функцией, что и у пузыря: иначе текст в блоке
       разъедется с текстом в пузыре при одной и той же настройке. */
    parts.push("font-size: " + computeTagVisualStyle(sizePct, 100, 100, 0).fontSizePx + "px;");
  }
  return parts.join(" ");
}

function buildBlockStyleDecoration(entry, visuals) {
  const style = buildBlockStyleCss(entry, visuals);
  if (!style) return null;
  return cmView.Decoration.mark({ attributes: { style } });
}

function buildTagVisualDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const debugLine = !!(readCfgPath(cfg, "advanced.devMode.enabled") === true && readCfgPath(cfg, "advanced.devMode.traceTagVisualLine") === true);
  const traceTxId = plugin && typeof plugin.getLineTraceTxId === "function"
    ? String(plugin.getLineTraceTxId() || "")
    : "";
  const visuals = getTagVisualsFromConfig(cfg);
  const userTags = visuals.userTags;
  const fieldMap = buildFieldTagVisualMap(cfg);
  const globalMap = buildGlobalTagVisualMap(cfg);
  const io = isObj(readCfgPath(cfg, "pkm.lineFormat")) ? readCfgPath(cfg, "pkm.lineFormat") : {};
  const sep1 = String(io.separator1 || "").trim();
  const sep2 = String(io.separator2 || "").trim();
  const sep1Color = normalizeHexColorInput(visuals.separator1TextColor);
  const sep2Color = normalizeHexColorInput(visuals.separator2TextColor);
  const ranges = [];
  const stripCfg = visuals.strip || __priorityStripEngine.normalizeStripConfig({});
  const stripFieldId = String(stripCfg.fieldId || "").trim();
  const stripFieldTokenSet = visuals.stripActive ? buildTagTokenSetForField(cfg, stripFieldId) : new Set();
  const stripFieldTokenSetNorm = new Set(Array.from(stripFieldTokenSet).map((t) => normalizeVisualTokenKey(t)).filter(Boolean));
  const cfgStrip = isObj(readCfgPath(cfg, "visual.tagBars")) ? readCfgPath(cfg, "visual.tagBars") : {};
  const rawStripTagVisibility = cfgStrip.tagVisibility;
  const hideStripFieldTags = !!stripFieldId && (
    stripCfg.tagVisibility === false || rawStripTagVisibility === false
  );
  const suppressedRanges = [];
  const elementMarkers = buildElementMarkersFromConfig(cfg);
  /* Цвета TagWheel нужны здесь ровно затем, чтобы узнать его отрезок (B2). */
  const tagwheelColors = getTagwheelHeaderColorsFromConfig(cfg);

  const readRowForToken = (token) => readTagVisualRowByTokenMaps(token, fieldMap, userTags, globalMap);
  for (const vr of view.visibleRanges) {
    let lineNo = view.state.doc.lineAt(vr.from).number;
    const endLineNo = view.state.doc.lineAt(vr.to).number;
    while (lineNo <= endLineNo) {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      const scannedTokens = [];
      const hiddenTokens = [];
      const tokenEntries = [];
      /*
       * Отрезок, который забирает себе слой TagWheel: там мы не рисуем ничего.
       *
       * Два слоя претендовали на одни и те же символы: этот прятал токены
       * своими заменами нулевой ширины, а слой TagWheel заменял весь отрезок
       * `==…==` одним виджетом. Токены оказывались спрятаны, а виджет их не
       * рисовал — «fields невидимы и не занимают места» (B2, 2026-09-02).
       * Правило про отрезок объявлено один раз, в `tagwheelPanelSpanInLine`.
       */
      const wheelSpan = tagwheelPanelSpanInLine(text, tagwheelColors);
      for (const hit of scanLineVisualTokens(text, sep1, sep2, elementMarkers)) {
        const token = hit.token;
        if (wheelSpan && hit.index >= wheelSpan.start && hit.index < wheelSpan.end) continue;
        scannedTokens.push(token);
        const from = line.from + hit.index;
        const to = from + token.length;
        const tokenNorm = normalizeVisualTokenKey(token);
        const inStripField = stripFieldTokenSet.has(token) || (tokenNorm && stripFieldTokenSetNorm.has(tokenNorm));
        const row = readRowForToken(token);
        const zoneOpacity = hit.zone === "left" ? visuals.opacityLeft : (hit.zone === "right" ? visuals.opacityRight : 1);
        tokenEntries.push({ token, kind: hit.kind, from, to, zone: hit.zone, inStripField, row, zoneOpacity, index: hit.index });
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
        let suppressed = false;
        for (let si = 0; si < suppressedRanges.length; si++) {
          const sr = suppressedRanges[si] || {};
          if (rangeIntersects(from, to, sr.from, sr.to)) {
            suppressed = true;
            break;
          }
        }
        if (suppressed) continue;
        const hasVisualOverride = !!row && (!!normalizeHexColorInput(row.fillColor)
          || !!normalizeHexColorInput(row.textColor)
          || resolveEffectiveTagVisualMode(row) !== "default");
        /*
         * Свой цвет — свой пузырь; всем остальным токенам блока достаётся
         * прозрачность и размер стилем, без подмены узла (И-2.2). Ссылка,
         * элемент и тег без цвета до этого не получали ничего.
         */
        if (!hasVisualOverride) {
          if (to <= from) continue;
          const styleDeco = buildBlockStyleDecoration(entry, visuals);
          if (styleDeco) ranges.push({ from, to, deco: styleDeco });
          continue;
        }
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
  const debugLine = !!(readCfgPath(cfg, "advanced.devMode.enabled") === true && readCfgPath(cfg, "advanced.devMode.traceTagVisualLine") === true);
  const traceTxId = plugin && typeof plugin.getLineTraceTxId === "function"
    ? String(plugin.getLineTraceTxId() || "")
    : "";
  const visuals = getTagVisualsFromConfig(cfg);
  if (!visuals.stripActive) return cmView.Decoration.none;

  const io = isObj(readCfgPath(cfg, "pkm.lineFormat")) ? readCfgPath(cfg, "pkm.lineFormat") : {};
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
    drawWholeTree: stripCfg.drawWholeTree,
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

/*
 * Фон панели рисуется пометкой на самом отрезке, поэтому правила для него
 * здесь больше нет. Осталось одно: токен, у которого спрятана приставка,
 * должен читаться как обычный текст строки.
 */
const TAGWHEEL_FILL_STYLE_CSS = [
  ".markdown-source-view.mod-cm6 .inline-overhaul-tw-token {",
  "  font: inherit;",
  "  color: inherit;",
  "  background: transparent;",
  "}",
].join("\n");

/**
 * Каретка: цвет, толщина и мерцание (10.13.33).
 *
 * **Цвет — три объявления, и это не перестраховка.** Obsidian рисует каретку
 * сам — `.cm-cursor` с `border-left`, — но при выключенном `drawSelection`
 * работает родная каретка браузера, а ею командует `caret-color`. Плюс
 * переменная темы `--caret-color`: её читают собственные правила Obsidian и
 * часть тем.
 *
 * **Толщина — это `border-left-width`, и вместе с ней двигается `margin-left`.**
 * У Obsidian стоит `borderLeft: 1.2px` и парный `marginLeft: -0.6px`, то есть
 * половина толщины: он центрирует каретку на границе символа. Поставить одну
 * толщину и не тронуть сдвиг значит уронить каретку вправо тем сильнее, чем
 * она толще (прочитано в `app.js` 1.13.7, а не выведено из типов — У-44).
 *
 * **И толщина, и мерцание бьют только по нарисованной каретке, а на строке
 * без выделения её нет.** Замечание заказчика 2026-09-06: «работает только
 * когда я выделяю текст». Причина прочитана в `app.js` 1.13.7, а не выведена.
 * В сборке Obsidian лежат **две** копии `drawSelection` CodeMirror, и слой
 * каретки у них разный:
 *
 *   - копия, отданную плагинам (`drawSelection` из `@codemirror/view`), рисует
 *     `.cm-cursor` и для пустого отрезка;
 *   - копия, на которой собран сам редактор заметки, спрашивает
 *     `range.empty ? !isMain : drawRangeCursor` — то есть **главный пустой
 *     отрезок она не рисует вовсе**. Курсор на строке без выделения — родная
 *     каретка браузера, а у неё из CSS настраивается только `caret-color`.
 *
 * Отсюда и «цвет работает, а толщина нет». Поэтому включённая форма заводит
 * **свой слой** (`io-editor-caretlayer`, см. `createCaretLayerExtension`) и гасит
 * родную каретку: `.cm-cursor` остаётся за выделением и за вторыми курсорами,
 * своя каретка — за строкой без выделения. Оба правила описывают одну вещь и
 * стоят рядом.
 *
 * **Мерцание живёт на слое, а не на самой каретке.** CodeMirror пишет
 * длительность прямо в `style` узла `.cm-cursorLayer`
 * (`animationDuration = cursorBlinkRate + "ms"`), а инлайновый стиль правилу
 * не уступает — отсюда `!important`. «Не мигает» — это снятая анимация, а не
 * нулевая длительность: ноль в CSS означает «мгновенно», а не «никогда», и
 * каретка от него замерла бы невидимой.
 *
 * Селекторы прибиты к `.markdown-source-view`: каретка в полях самой панели
 * настроек и в поиске остаётся тем, чем была (Ц4).
 */
/*
 * Имена своего слоя каретки и её метки — **одно объявление на оба места**.
 * Их называют блок стилей и сам слой, и разойдись они, слой получил бы класс,
 * которого нет ни в одном правиле: каретки не видно, а обе проверки зелёные
 * (У-32, У-56). `io-caret` тут занят — так называется каретка предпросмотра в
 * панели, и её глобальное правило накрыло бы метки слоя своей высотой и своим
 * мерцанием (У-65).
 */
const CARET_LAYER_CLASS = "io-editor-caretlayer";
const CARET_MARKER_CLASS = "io-editor-caret";

function buildCaretStyleCss(look) {
  const cfg = isObj(look) ? look : {};
  const value = String(cfg.color || "").trim();
  const width = Number(cfg.width);
  const blinkMs = Number(cfg.blinkMs);
  const out = [];

  if (value) {
    out.push(
      ".markdown-source-view.mod-cm6 {",
      "  --caret-color: " + value + ";",
      "}",
      ".markdown-source-view.mod-cm6 .cm-content {",
      "  caret-color: " + value + ";",
      "}"
    );
  }
  if (value || Number.isFinite(width)) {
    out.push(
      ".markdown-source-view.mod-cm6 .cm-cursor,",
      ".markdown-source-view.mod-cm6 .cm-cursor-primary,",
      ".markdown-source-view.mod-cm6 .cm-dropCursor {"
    );
    if (value) out.push("  border-left-color: " + value + ";");
    if (Number.isFinite(width)) {
      out.push("  border-left-width: " + width + "px;");
      out.push("  margin-left: " + (-width / 2) + "px;");
    }
    out.push("}");
  }
  if (Number.isFinite(blinkMs)) {
    out.push(".markdown-source-view.mod-cm6 .cm-cursorLayer {");
    out.push(blinkMs > 0
      ? "  animation-duration: " + blinkMs + "ms !important;"
      : "  animation: none !important;");
    out.push("}");
  }
  if (Number.isFinite(width) || Number.isFinite(blinkMs)) {
    const w = Number.isFinite(width) ? width : 2;
    out.push(
      /* Родная каретка гасится ровно тогда, когда её заменяет своя: ширина и
         мерцание у неё браузерные, и CSS их не задаёт. */
      ".markdown-source-view.mod-cm6 .cm-content {",
      "  caret-color: transparent;",
      "}",
      ".markdown-source-view.mod-cm6 ." + CARET_LAYER_CLASS + " {",
      "  pointer-events: none;",
      "  display: none;",
      "}",
      ".markdown-source-view.mod-cm6 ." + CARET_LAYER_CLASS + " ." + CARET_MARKER_CLASS + " {",
      /* Цвет берётся переменной, а не литералом: за цвет отвечает первая
         половина группы, и объявлять его тут значило бы объявить одно правило
         дважды (У-32). Своей переменной нет — берётся тема Obsidian. */
      "  border-left: " + w + "px solid var(--caret-color);",
      "  margin-left: " + (-w / 2) + "px;",
      "  pointer-events: none;",
      "}",
      ".markdown-source-view.mod-cm6 .cm-focused > .cm-scroller > ." + CARET_LAYER_CLASS + " {",
      "  display: block;",
      Number.isFinite(blinkMs) && blinkMs > 0
        ? "  animation: steps(1) io-caret-blink " + blinkMs + "ms infinite;"
        : "  animation: none;",
      "}"
    );
  }
  return out.join("\n");
}

/**
 * Скорость мерцания 1..10 в миллисекунды (Ц7).
 *
 * Пятёрка — ровно то, чем Obsidian мерцает сейчас (`cursorBlinkRate` 1200),
 * поэтому она же умолчание слайдера: включённый тумблер сам по себе мерцание
 * не меняет, пока человек не подвинул ползунок. Ноль сюда не доходит — он
 * значит «не мигает вовсе» и решается снятием анимации.
 */
function caretBlinkMsFromSpeed(speed) {
  const s = Number.isFinite(speed) ? Math.max(1, Math.min(10, speed)) : 5;
  return 2200 - s * 200;
}

/**
 * Вид каретки из конфига. Две половины группы независимы: цвет включает
 * `enabled`, толщину и мерцание — `shapeEnabled` (Ц6). Выключенная половина
 * не объявляет ничего, и тогда своё берёт тема.
 */
function caretLookFromConfig(cfg) {
  const caret = isObj(readCfgPath(cfg, "visual.caret")) ? readCfgPath(cfg, "visual.caret") : {};
  const look = { color: "", width: NaN, blinkMs: NaN };
  if (caret.enabled === true) look.color = normalizeHexColorInput(caret.color);
  if (caret.shapeEnabled === true) {
    const width = Number(caret.width);
    look.width = Number.isFinite(width) ? width : 2;
    const speed = Number(caret.blinkSpeed);
    look.blinkMs = Number.isFinite(speed) && speed <= 0 ? 0 : caretBlinkMsFromSpeed(speed);
  }
  return look;
}

/**
 * Своя каретка на строке без выделения (10.13.33 Ц9).
 *
 * **Зачем она вообще нужна** — разбор в комментарии к `buildCaretStyleCss`:
 * редактор заметки собран на копии `drawSelection`, которая главный **пустой**
 * отрезок не рисует, и курсор там родной браузерный. Толщину и мерцание у
 * такого не задать ничем, поэтому включённая форма рисует каретку сама.
 *
 * **Слой берётся у платформы, а не изобретается.** `layer` и
 * `RectangleMarker` есть в `@codemirror/view`, который Obsidian отдаёт
 * плагинам (проверено по карте экспортов `app.js` 1.13.7). Значит и позиция
 * каретки считается тем же кодом, что у самого CodeMirror, — со всеми его
 * поправками на масштаб, направление письма и прокрутку.
 *
 * **Рисуется ровно то, чего не рисует Obsidian:** главный отрезок и только
 * пустой. Непустой отрезок и вторые курсоры — по-прежнему его `.cm-cursor`,
 * иначе на строке стояло бы две каретки.
 *
 * Тумблер читается **на каждой отрисовке**, а не запоминается при загрузке:
 * иначе включение формы доезжало бы до заметки только после перезапуска.
 * `update` отвечает `true` в том числе на смену тумблера — без этого слой
 * не перерисуется, пока человек не тронет курсор.
 */
/** Включена ли форма каретки: тот же тумблер, что и у блока стилей (У-32). */
function caretShapeActive(plugin) {
  try {
    return Number.isFinite(caretLookFromConfig(plugin.getConfig()).width);
  } catch (_) {
    return false;
  }
}

/**
 * Стоит ли каретка в конце строки, за которой может стоять виджет.
 *
 * **Замечание заказчика 2026-09-06, критичный дефект:** «при heading-jumps и
 * просто при печати каретка смещена вправо, приклеена к началу
 * `i2n-floating button`, текст возникает слева от неё; при выключенной кнопке
 * поведение нормальное».
 *
 * Причина прочитана в `app.js` 1.13.7, а не выведена (У-44). `forRange` меряет
 * пустой отрезок как `coordsAtPos(head, assoc || 1)`, то есть по умолчанию
 * **справа** от позиции. Справа от конца строки стоит не текст, а виджет
 * `Floating button`: он объявлен `side: 1` на `line.to`, и разбор строки при
 * положительной стороне выбирает именно его (`p > l || 32 & flags && t <= 1` в
 * `resolveInline`). Меряется левая граница кнопки, а она отстоит от текста на
 * `Distance from the text`, — отсюда и сдвиг ровно в этот отступ, и текст,
 * появляющийся слева от каретки.
 *
 * Поэтому на конце непустой строки каретка меряется **слева**: там последний
 * символ текста, то есть то самое место, где стоит родная каретка браузера.
 * Виджета за строкой может и не быть — тогда обе стороны дают одно и то же и
 * правка не меняет ничего.
 *
 * Дефект видит только тот, у кого включены обе функции: без своего слоя
 * каретку рисует браузер по позиции в DOM, а не по измерению.
 */
function caretSitsAtLineEnd(state, head) {
  try {
    const line = state.doc.lineAt(head);
    return line.to === head && line.to > line.from;
  } catch (_) {
    /* Разбор строки — дело состояния редактора. Нет его — меряем как раньше. */
    return false;
  }
}

/**
 * Что рисует свой слой: главный **пустой** отрезок и только он.
 *
 * Решение вынесено отдельно, потому что оно и есть предмет: непустой отрезок и
 * вторые курсоры Obsidian рисует сам, и нарисовать их ещё раз значит поставить
 * на строку две каретки. Проверяется без окна — окна тут и не будет.
 */
function caretLayerRangeFor(plugin, state) {
  if (!caretShapeActive(plugin)) return null;
  const main = state && state.selection ? state.selection.main : null;
  if (!main || main.empty !== true) return null;
  if (!caretSitsAtLineEnd(state, main.head)) return main;
  /*
   * Отрезку меняется только сторона измерения. Пустой отрезок `forRange`
   * читает тремя полями — `empty`, `head` и `assoc`, — и объявлять тут второй
   * курсор нечем и незачем: `EditorSelection` живёт в копии состояния,
   * отданной плагинам, а меряет по этим полям копия, на которой собран
   * редактор заметки. Остальные поля курсора выписаны, чтобы отрезок остался
   * отрезком для любого читателя.
   */
  return { empty: true, head: main.head, anchor: main.head, from: main.head, to: main.head, assoc: -1 };
}

function createCaretLayerExtension(plugin) {
  if (typeof cmView.layer !== "function" || typeof cmView.RectangleMarker !== "function") {
    /* Громко: тихий отказ здесь неотличим от дефекта (У-41, У-73). */
    console.warn("[inline-overhaul][caret] @codemirror/view без layer/RectangleMarker: своя каретка не рисуется");
    return [];
  }
  return cmView.layer({
    above: true,
    class: CARET_LAYER_CLASS,
    markers(view) {
      try {
        const range = caretLayerRangeFor(plugin, view.state);
        if (!range) return [];
        return cmView.RectangleMarker.forRange(view, CARET_MARKER_CLASS, range);
      } catch (_) {
        return [];
      }
    },
    update(update, dom) {
      const now = caretShapeActive(plugin);
      const flipped = dom.__ioCaretActive !== now;
      dom.__ioCaretActive = now;
      return flipped || update.docChanged || update.selectionSet || update.viewportChanged;
    },
  });
}

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
  /*
   * Полоса не занимает высоту строки целиком: у двух строк подряд полосы
   * стыкуются без зазора и читаются как одна — «не видно, к какой строке
   * относится какой bar» (замечание B22, 2026-09-02). Зазор сверху и снизу
   * делает границу видимой.
   *
   * Величина больше не литерал: её задаёт слайдер `Gap between Bars`, а у
   * строки внутри дерева зазор снимает тумблер `Join Bars in a tree`
   * (PRD 10.13.16). Число приходит переменной от адаптера, и та же
   * переменная читается предпросмотром полос — одно правило, одно место
   * (У-32). Запасное значение здесь равно умолчанию настройки.
   */
  "  top: var(--io-strip-line-gap, 2px);",
  "  bottom: var(--io-strip-line-gap, 2px);",
  "  width: var(--io-strip-thickness, 2px);",
  "  left: calc(-1 * var(--io-strip-x1, 20px));",
  "  background: var(--io-strip-c1, transparent);",
  "  box-shadow: var(--io-strip-shadow2, none), var(--io-strip-shadow3, none);",
  "  border-radius: 1px;",
  "}",
  /*
   * Правила для классов `io-strip-hidden-token` и `io-strip-hidden-space`
   * сняты 2026-09-03. Классы не ставил никто: тег Field слой полос прячет
   * заменой нулевой ширины, а не пометкой, — то есть правила обещали
   * поведение, которого нет. Записано это было в
   * `docs/AWAITING_OWNER_CHECK.md`, раздел 8, с оговоркой «снять при
   * следующей правке слоя полос».
   */
].join("\n");

/**
 * Один токен панели без своей приставки.
 *
 * Нужен ровно там, где `Show tag markers` выключен: текст токена меняется, и
 * пометкой этого не сделать. Виджет закрывает **один токен** — в отличие от
 * прежнего `TagwheelFillWidget`, который закрывал весь отрезок `==…==` вместе
 * со всем, что Obsidian оформляет сам (B2, 2026-09-02).
 */
class TagwheelTokenWidget extends cmView.WidgetType {
  constructor(text) {
    super();
    this.text = String(text || "");
  }

  eq(other) {
    return !!(other && other.text === this.text);
  }

  toDOM() {
    const node = document.createElement("span");
    node.className = "inline-overhaul-tw-token";
    node.textContent = this.text;
    return node;
  }
}

/**
 * Отрезок строки, который слой TagWheel **заменит своим виджетом**.
 *
 * `null` — не заменит: либо на строке нет обособления `==…==`, либо у TagWheel
 * не задана заливка и маркеры не спрятаны, и тогда слой ограничивается
 * покраской текста.
 *
 * Функция одна на два слоя, и это главное в ней. Правило «панель заменяется
 * целиком» раньше жило только внутри слоя TagWheel, а слой пузырей о нём не
 * знал: он к тому времени уже спрятал токены строки своими нулевой ширины, и
 * на один и тот же отрезок приходились две замены. На экране это выглядело
 * так, как заказчик и написал: «вся строка tagwheel пропадает, я вижу только
 * selector, но fields невидимы и не занимают места» (B2, 2026-09-02). Второе
 * объявление того же правила разошлось бы снова (У-32).
 */
/**
 * Метка панели TagWheel на строке.
 *
 * **Отрезок `==…==` сам по себе панелью не является.** `==` — разметка
 * выделения Obsidian, и её человек ставит себе сам. До 2026-09-04 слой брал
 * первый такой отрезок на любой строке, и заливка панели доставалась любому
 * выделенному тексту, а слой пузырей внутри него ничего не рисовал — то есть
 * `==#todo==` человека терял пузырь. Красили мы, выходит, чужую разметку.
 *
 * Своя метка у панели одна и та же с самого начала: активную ячейку движок
 * пишет как `**[текст]**` (`renderControlLine` в `tagwheel_core.js`), и другой
 * пометки активности на строке нет. Её и спрашиваем — **тем же** выражением,
 * которым ниже красится сама активная ячейка (У-32).
 *
 * Признак читается из текста строки, а не из состояния окна, и это выбор:
 * состояние может устареть — окно закрылось, заметка открыта во второй
 * панели, отрисовка случилась раньше, — а метка в строке либо есть, либо нет,
 * и в редакторе и в повторной отрисовке она одна и та же.
 *
 * Чего признак не покрывает: панель без активной ячейки. Такой не бывает —
 * `buildGroupDisplay` помечает активной ту группу, в которой стоит человек, —
 * но если она однажды появится, красить её слой не станет.
 */
const TAGWHEEL_ACTIVE_CELL_RE = /\*\*\[([\s\S]+?)\]\*\*/;

/**
 * Отрезок панели на строке: границы, внутренность и признак. Одно объявление
 * на оба слоя — пузырей и панели.
 */
function tagwheelPanelSegmentInLine(text) {
  const src = String(text || "");
  const openIdx = src.indexOf("==");
  const closeIdx = openIdx >= 0 ? src.indexOf("==", openIdx + 2) : -1;
  if (openIdx < 0 || closeIdx <= openIdx) return null;
  const innerAt = openIdx + 2;
  if (closeIdx <= innerAt) return null;
  const segment = src.slice(innerAt, closeIdx);
  if (!TAGWHEEL_ACTIVE_CELL_RE.test(segment)) return null;
  return { start: openIdx, end: closeIdx + 2, innerAt, closeIdx, segment };
}

function tagwheelPanelSpanInLine(text, colors) {
  const usePanelWidget = Boolean(colors && colors.fillColor) || (colors && colors.showPrefix === false);
  if (!usePanelWidget) return null;
  const seg = tagwheelPanelSegmentInLine(text);
  if (!seg) return null;
  return { start: seg.start, end: seg.end };
}

/**
 * Что оформляется в панели TagWheel на одной строке.
 *
 * Чистая функция: на входе текст строки, цвета и набор плейсхолдеров, на
 * выходе список отрезков с видом оформления. CodeMirror здесь не участвует —
 * и это главное в ней.
 *
 * Зачем так. Слой панели раньше заменял весь отрезок `==…==` **одним
 * виджетом**, и это был класс поломки, а не настройка: внутри отрезка живут
 * вещи, которые Obsidian оформляет сам — ссылка `[[…]]`, полужирный `**…**`,
 * тег, — и что получится, когда наши замены сложатся с его, из кода не видно.
 * Заказчик видел итог: «вся панель tagwheel невидима и безразмерна… только у
 * tagwheel left — у right всё нормально» (B2, 2026-09-02). Слева у него в
 * панели стоит ссылка, справа нет.
 *
 * Проверить это в живом редакторе нечем: DOM Obsidian из проверок
 * недостижим, библиотеки DOM в проекте нет. Поэтому утверждение выписано про
 * **механизм**: `kind: "replace"` появляется здесь ровно на одном случае —
 * когда решётки в панели просят спрятать, и тогда заменяется один токен.
 * Остальное — пометки, а пометка ничего не закрывает собой.
 *
 * Виды отрезков:
 *   `fill`    — фон панели;
 *   `text`    — цвет неактивных ячеек, на весь отрезок;
 *   `active`  — цвет и начертание активной ячейки;
 *   `replace` — один токен без приставки (только при спрятанных решётках).
 */
/**
 * Есть ли вообще что оформлять в панели. Одно объявление на два места: и на
 * расчёт отрезков, и на раннее «красить нечего» в сборке украшений (У-32).
 */
function tagwheelPanelPaints(colors) {
  if (!colors) return false;
  return Boolean(colors.fillColor) || Boolean(colors.defaultTextColor)
    || Boolean(colors.activeTextColor) || colors.showPrefix === false;
}

function tagwheelPanelSpans(text, colors, placeholders) {
  const out = [];
  /* Ни одного цвета и решётки на месте — оформлять нечего: полужирное
     начертание активной ячейки рисует сам Obsidian, по звёздочкам. */
  if (!tagwheelPanelPaints(colors)) return out;
  /* Панель узнаётся по своей метке, а не по разметке выделения Obsidian:
     правило объявлено один раз, в `tagwheelPanelSegmentInLine`. */
  const seg = tagwheelPanelSegmentInLine(text);
  if (!seg) return out;

  const innerAt = seg.innerAt;
  const closeIdx = seg.closeIdx;
  const segment = seg.segment;
  const known = placeholders instanceof Set ? placeholders : new Set();
  const fillColor = String(colors && colors.fillColor || "");
  const textColor = String(colors && colors.defaultTextColor || "");
  const activeColor = String(colors && colors.activeTextColor || "") || textColor;
  const showPrefix = !(colors && colors.showPrefix === false);

  /*
   * Пометка на всю строку панели — и цвет заливки, приезжающий на ней же
   * переменной `--io-twfill`.
   *
   * **Почему заливка не рисуется своим отрезком.** Рисовалась — и это был
   * дефект. Отрезок `mark` CodeMirror режет по своим же границам: тег
   * (`cm-hashtag`), плейсхолдер в обратных кавычках (`cm-inline-code`),
   * спрятанные `**` — каждый рвёт отрезок на куски. Куски получали фон
   * поштучно, пробелы между ячейками оставались незакрашенными, а поля тега
   * и кода делали соседние куски разной высоты. Заказчик 2026-09-05 по
   * скриншоту `12.png`: «по прежнему различается высота элементов, теперь
   * ещё пустоты стали белого цвета, а активный field вообще с непонятной
   * прыгающей рамкой».
   *
   * Сплошной слой на этом месте **уже есть** — подсветка `==…==` самой
   * Obsidian, и она ровно одна на весь отрезок вместе с метками. Спорить с
   * ней было нечем (её `--text-highlight-bg` полупрозрачен и ложился **на**
   * наш цвет), а вот заменить ей цвет — можно: правило в `styles.css` красит
   * `span.cm-highlight` и `span.cm-formatting-highlight` на помеченной строке
   * значением этой переменной. Чужой слой перестаёт быть чужим, и рвать
   * нечего (У-68).
   *
   * Той же пометкой гасятся фон и рамка тегов Obsidian и вставок кода внутри
   * панели: там они ничего не значат — пузыри Value слой внутрь панели не
   * рисует (`tagwheelPanelSpanInLine` отдаёт отрезок слою пузырей), — а вот
   * высоту строки рвут своими полями. Различать ячейки — работа
   * `Non-active Field text color` и `Active Field text color`.
   */
  out.push({
    kind: "line",
    start: seg.start,
    end: seg.end,
    style: fillColor ? "--io-twfill: " + fillColor + ";" : "",
  });
  /*
   * Цвет неактивных ячеек — на весь отрезок: ячейкой здесь может быть и
   * плейсхолдер в обратных кавычках, и готовое значение, и элемент из двух
   * слов. Резать отрезок на ячейки значило бы завести второй разбор панели
   * рядом с движком (У-4).
   */
  if (textColor) {
    out.push({ kind: "text", start: seg.start, end: seg.end, style: "color: " + textColor + ";" });
  }

  /*
   * Активная ячейка. Движок пишет её как `**[текст]**` (`renderControlLine` в
   * `tagwheel_core.js`) — это единственная пометка активности на строке.
   *
   * Цвет ставится **всегда**, а не только когда значение ещё не выбрано.
   * Прежнее условие требовало, чтобы текст ячейки был в наборе
   * плейсхолдеров, — то есть цвет пропадал, стоило выбрать значение:
   * «panel-active-color применяется только для исходного положения field, а
   * когда я начинаю прокручивать — подсветка слетает» (B2, 2026-09-02).
   * Отличать исходное состояние теперь начертание: плейсхолдер полужирный,
   * значение обычное — так и просил заказчик. `!important` нужен потому, что
   * полужирным ячейку делает и сам Obsidian, по звёздочкам вокруг неё.
   */
  const active = TAGWHEEL_ACTIVE_CELL_RE.exec(segment);
  if (active) {
    const inner = String(active[1] || "");
    const bracketAt = String(active[0] || "").indexOf("[");
    const start = innerAt + active.index + bracketAt + 1;
    const end = start + inner.length;
    if (end > start) {
      const bold = known.has(inner.trim());
      out.push({
        kind: "active",
        start,
        end,
        style: (activeColor ? "color: " + activeColor + ";" : "")
          + "font-weight: " + (bold ? "700" : "400") + " !important;",
      });
    }
  }

  /*
   * Спрятанные решётки (`Show tag markers` выключен). Здесь без подмены не
   * обойтись — меняется сам текст, — но подменяется **один токен**, а не
   * отрезок: внутри токена чужого оформления нет.
   */
  if (!showPrefix) {
    const tokenRe = /`([^`]+)`|(#\S+)/g;
    let m;
    while ((m = tokenRe.exec(segment)) !== null) {
      const raw = String(m[1] || m[2] || "");
      const shown = formatTagwheelDisplayToken(raw, false);
      if (!shown || shown === raw) continue;
      const start = innerAt + m.index + String(m[0] || "").indexOf(raw);
      const end = start + raw.length;
      if (end > start) out.push({ kind: "replace", start, end, text: shown });
    }
  }

  return out;
}

/** Порядок наложения: строка, общий цвет, активная ячейка, подмена токена. */
const TAGWHEEL_SPAN_RANK = { line: -1, text: 1, active: 2, replace: 3 };

/**
 * Переменные темы, которыми красится панель TagWheel, пока цвет не задан
 * (PRD 10.13.23 Ц2, замечание заказчика H4 от 2026-09-04).
 *
 * **То же объявление живёт в панели** — `src/ui/settings/custom/theme_colors.ts`,
 * где эти же переменные показываются в поле выбора цвета. Два объявления
 * одного правила разошлись бы молча, и первым это увидел бы человек: поле
 * показывало бы одно, строка — другое. Совпадение держит пин на литералы
 * (У-32), `tag_visual_render_tests.ts`.
 *
 * Пары взяты у самой Obsidian, а не собраны на глаз: `--text-highlight-bg` —
 * ровно то, чем она красит `==…==`, а панель обособлена именно им.
 */
const TAGWHEEL_THEME_COLOR_VARS = {
  defaultTextColor: "--text-muted",
  activeTextColor: "--text-accent",
  fillColor: "--text-highlight-bg",
};

/**
 * Цвета, которыми панель и правда красится: пустое значение заменяется
 * переменной темы (10.13.23 Ц2). Цвет, заданный человеком, сильнее темы
 * всегда (Ц6).
 *
 * Отдельная функция, а не правка `getTagwheelHeaderColorsFromConfig`: та
 * отвечает на вопрос «что сказано в конфиге», и её «пусто» означает «человек
 * не задал». Смешать эти два ответа значило бы потерять признак, по которому
 * панель показывает поле незаполненным.
 */
function resolveTagwheelPaintColors(colors) {
  const src = isObj(colors) ? colors : {};
  const themed = (value, variable) => {
    const own = String(value || "").trim();
    return own || ("var(" + variable + ")");
  };
  return {
    defaultTextColor: themed(src.defaultTextColor, TAGWHEEL_THEME_COLOR_VARS.defaultTextColor),
    activeTextColor: themed(src.activeTextColor, TAGWHEEL_THEME_COLOR_VARS.activeTextColor),
    fillColor: themed(src.fillColor, TAGWHEEL_THEME_COLOR_VARS.fillColor),
    showPrefix: src.showPrefix !== false,
  };
}

function buildTagwheelHeaderDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  /*
   * Красить всегда есть чем: незаданный цвет берётся у темы (10.13.23 Ц2).
   * Прежняя ранняя отбивка «ни одного цвета — не рисуем» снята вместе с
   * причиной: панель на чистом vault была нечитаемой ровно из-за неё.
   */
  const colors = resolveTagwheelPaintColors(getTagwheelHeaderColorsFromConfig(cfg));

  const placeholders = buildTagwheelPlaceholderSetFromConfig(cfg);
  const ranges = [];

  for (const vr of view.visibleRanges) {
    let lineNo = view.state.doc.lineAt(vr.from).number;
    const endLineNo = view.state.doc.lineAt(vr.to).number;
    while (lineNo <= endLineNo) {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      for (const span of tagwheelPanelSpans(text, colors, placeholders)) {
        /*
         * Пометка на всю строку: по ней стили красят подсветку Obsidian
         * цветом панели и гасят фон её тегов внутри неё. Цвет приезжает сюда
         * же переменной `--io-twfill` — заливка живёт **одним** слоем на всю
         * строку, а не отрезком, который платформа порежет на куски.
         * Декорация строки, поэтому `start`/`end` отрезка ей не нужны и она
         * разбирается отдельно.
         */
        if (span.kind === "line") {
          const spec = { class: "io-twline" };
          if (span.style) spec.attributes = { style: span.style };
          ranges.push({
            from: line.from,
            to: line.from,
            rank: TAGWHEEL_SPAN_RANK.line,
            deco: cmView.Decoration.line(spec),
          });
          continue;
        }
        const from = line.from + span.start;
        const to = line.from + span.end;
        if (to <= from) continue;
        const deco = span.kind === "replace"
          ? cmView.Decoration.replace({ widget: new TagwheelTokenWidget(span.text), inclusive: false })
          : cmView.Decoration.mark({ attributes: { style: span.style } });
        ranges.push({ from, to, rank: TAGWHEEL_SPAN_RANK[span.kind] || 0, deco });
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

/**
 * Отметки на строке (10.13.12): подсветка обработанной и `Floating button`.
 *
 * Один проход и одно расширение на две функции: обе рисуются поверх строки,
 * обе включаются в Transform и обе живут только на экране. Второй проход по
 * тем же строкам ради второй из них был бы работой на ровном месте.
 */
function getSourceMarksFromConfig(cfg) {
  const i2n = isObj(readCfgPath(cfg, "transform.inline2note")) ? readCfgPath(cfg, "transform.inline2note") : {};
  const sp = isObj(i2n.sourceProcessing) ? i2n.sourceProcessing : {};
  const visual = isObj(sp.visual) ? sp.visual : {};
  const token = String(sp.token || "").trim();
  const moduleOn = readCfgPath(cfg, "features.transform.enabled") === true
    && readCfgPath(cfg, "transform.inline2note.enabled") === true;
  const pct = Number(visual.opacity);
  return {
    moduleOn,
    /* Метка — единственный признак обработанной строки (Н2). Нет метки —
       нечего искать, и подсветка не рисуется вовсе (Н3). */
    token,
    highlight: moduleOn && !!token && visual.enabled === true,
    color: normalizeHexColorInput(visual.color),
    /* Доля для CSS. В конфиге процент, как у остальной прозрачности (Н5). */
    opacity: Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.trunc(pct))) / 100 : 0.65,
    button: moduleOn && i2n.floatingButton === true,
    /*
     * Отступ кнопки от текста (замечание заказчика 2026-09-04: «кнопка
     * находится слишком близко к тексту»). Клампит и досыпает умолчание
     * `transform_feature.js` — тот же код, что нормализует остальной
     * Transform, — поэтому здесь число уже законное, и второго объявления
     * границ не появляется (У-32).
     */
    buttonGap: Number(i2n.floatingButtonGap),
  };
}

/** Кнопка `Inline to note` в конце строки. Только на экране (Н8). */
class FloatingTransformButtonWidget extends cmView.WidgetType {
  constructor(plugin, gap) {
    super();
    this.plugin = plugin;
    /* Отступ от текста: слайдер `Distance from the text`. */
    this.gap = Number.isFinite(Number(gap)) ? Number(gap) : 12;
  }
  eq(other) {
    /*
     * Кнопка одна и та же на любой строке — но не при разном отступе.
     * Здесь стояло `return true`, и это было бы ровно тем дефектом, о
     * котором предупреждает У-24: CodeMirror оставляет прежний узел, человек
     * двигает слайдер и не видит ничего.
     */
    return !!other && other.gap === this.gap;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "io-flybtn";
    el.textContent = "\u2192";
    /* Единственное, что виджет задаёт стилем, — своя переменная: саму
       геометрию держит `styles.css` (правило З6 и Г1 по духу). */
    el.style.setProperty("--io-flybtn-gap", this.gap + "px");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", __commandIds.commandName("transform-inline-to-note"));
    el.title = __commandIds.commandName("transform-inline-to-note");
    /*
     * `mousedown`, а не `click`: до `click` редактор успевает поставить
     * каретку по месту нажатия, и перенесена была бы не та строка (Н11).
     */
    el.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      Promise.resolve(this.plugin.runInlineToNote()).catch((e) => {
        console.error("[inline-overhaul][floating-button]", e);
      });
    });
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

function buildSourceMarkDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const marks = getSourceMarksFromConfig(cfg);
  if (!marks.highlight && !marks.button) return cmView.Decoration.none;

  const cursorLine = marks.button && view.state.selection && view.state.selection.main
    ? view.state.doc.lineAt(view.state.selection.main.head).number
    : -1;
  const style = [
    "opacity: " + marks.opacity + ";",
    marks.color ? "color: " + marks.color + ";" : "",
  ].filter(Boolean).join(" ");
  const lineDeco = cmView.Decoration.line({ attributes: { style, class: "io-done-line" } });

  const ranges = [];
  for (const vr of view.visibleRanges) {
    let lineNo = view.state.doc.lineAt(vr.from).number;
    const endLineNo = view.state.doc.lineAt(vr.to).number;
    while (lineNo <= endLineNo) {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      if (marks.highlight && lineHasProcessedToken(text, marks.token)) {
        ranges.push({ from: line.from, to: line.from, deco: lineDeco, side: -1 });
      }
      if (lineNo === cursorLine && text.trim()) {
        ranges.push({
          from: line.to,
          to: line.to,
          side: 1,
          deco: cmView.Decoration.widget({
            widget: new FloatingTransformButtonWidget(plugin, marks.buttonGap),
            side: 1,
          }),
        });
      }
      lineNo += 1;
    }
  }

  ranges.sort((a, b) => (a.from !== b.from ? a.from - b.from : a.side - b.side));
  const builder = new cmState.RangeSetBuilder();
  for (const r of ranges) {
    try { builder.add(r.from, r.to, r.deco); } catch (_) {}
  }
  return builder.finish();
}

/**
 * Метка стоит в строке отдельным токеном, а не куском слова: `#processed`
 * не должен зажигать строку со словом `#processed-later`.
 */
function lineHasProcessedToken(text, token) {
  const needle = String(token || "").trim();
  if (!needle) return false;
  const rx = new RegExp("(^|\\s)" + escapeRegExp(needle) + "(?=$|\\s)");
  return rx.test(String(text || ""));
}

function createSourceMarkDecorationExtension(plugin) {
  return cmView.ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = buildSourceMarkDecorations(view, plugin);
    }
    update(update) {
      if (!update.docChanged && !update.viewportChanged && !update.selectionSet) return;
      this.decorations = buildSourceMarkDecorations(update.view, plugin);
    }
  }, {
    decorations: (v) => v.decorations,
  });
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
    await loadRulesMarkdownBuilderSafe(this.app);
    await loadEnhancedSelectAllEngineSafe(this.app);
    await loadSmartDeleteEngineSafe(this.app);
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
    /* Отметки на строке (10.13.12): подсветка обработанной и `Floating button`. */
    this._sourceMarksExtension = null;
    this._sourceMarksCompartment = new cmState.Compartment();
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

    /* МГ4 и МГ6 — до первой записи формы версии 2, а не после. */
    const prepared = await this.prepareConfigFileForV2();
    /* Переезд с версии 1 виден ровно здесь: копия снимается один раз, и
       именно она означает, что хоткеи человека были привязаны к старым ID. */
    this._migratedFromV1 = !!(prepared && prepared.backupSavedAs);
    await this.store.init();
    try {
      await this.initializeDevLogSession(this.getConfig());
    } catch (e) {
      console.error("[inline-overhaul][dev-mode-log:init]", e);
    }

    {
      /* Панели может не быть (старый Obsidian, не загрузившийся модуль), и
         тогда плагин работает без вкладки настроек, а не падает. */
      const tab = this.createSettingTab();
      if (tab) this.addSettingTab(tab);
    }

    this.registerCommands();
    this.noticeCommandIdsChangedOnce();
    this.ensureTagwheelFillStyles();
    this.ensureStripLineStyles();
    this.ensureCaretStyles();
    this.registerGlobalFunctions();
    this.registerStoreEvents();

    await this.ensureGeneratedRulesNow("onload");

    const devEnabled = !!(readCfgPath(this.getConfig && this.getConfig(), "advanced.devMode.enabled") === true);
    if (devEnabled) {
      console.info("[inline-overhaul] loaded");
    }
  }

  /**
   * Одноразовое уведомление о смене ID команд (фаза 2, пункт 8; Р3).
   *
   * **Почему уведомление, а не миграция.** Хоткеи живут не в нашем конфиге, а
   * в настройках Obsidian, и привязаны к идентификатору команды. Переименование
   * их не переносит, и перенести их нам нечем: чужой файл настроек плагин не
   * правит. Значит, единственное честное — сказать об этом один раз и показать,
   * что во что превратилось.
   *
   * **Флаг живёт в `viewState`, а не в настройках** (пункт 8): это состояние
   * плагина, а не выбор человека, и контрола у него нет.
   *
   * **Показывается только тому, у кого был конфиг версии 1.** На свежей
   * установке хоткеев на старые ID быть не могло, и уведомление было бы
   * сообщением, адресованным разработчику (З8).
   *
   * **Ни `app.setting`, ни `app.hotkeyManager` здесь нет.** 7.2 разрешает
   * приватное API одним исключением — колонкой хоткея в справочнике команд, — и
   * это исключение не здесь. Поэтому путь к настройкам сказан словами, а карта
   * печатается в консоль и лежит в репозитории.
   */
  noticeCommandIdsChangedOnce() {
    try {
      if (!this._migratedFromV1) return;
      const cfg = this.getConfig();
      if (String(readCfgPath(cfg, "viewState.commandIdsNotice") || "") === "shown") return;

      const lines = ["[inline-overhaul] команды переименованы, старый ID → новый:"];
      for (const [was, now] of __commandIds.RENAMED) lines.push("  " + was + " → " + now);
      for (const [was, now] of __commandIds.RENAME_RULES) lines.push("  " + was + " → " + now);
      console.info(lines.join("\n"));

      this.notice("Inline Overhaul renamed its commands, so hotkeys you had set for them are no longer bound."
        + " Set them again in Settings, Hotkeys, searching for Inline Overhaul."
        + " The full old-to-new map is printed in the developer console and in docs/command_ids_v1_v2.md");

      this.store.patch({ viewState: { commandIdsNotice: "shown" } }, "commands:ids:notice", { undoable: false });
    } catch (e) {
      console.error("[inline-overhaul][commands:ids:notice]", e);
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
    if (this._caretStyleEl && this._caretStyleEl.parentNode) {
      this._caretStyleEl.parentNode.removeChild(this._caretStyleEl);
    }
    this._caretStyleEl = null;
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

  /**
   * Свой блок стилей каретки и подписка на хранилище (10.13.33 Ц5).
   *
   * Подписка своя, а не через перерисовку панели: та откладывается, пока
   * фокус стоит в поле ввода (`store_events_orchestrator.js`), а цвет должен
   * меняться под рукой, а не после ухода фокуса.
   */
  ensureCaretStyles() {
    try {
      if (!this._caretStyleEl || !this._caretStyleEl.parentNode) {
        const styleEl = document.createElement("style");
        styleEl.setAttribute("data-inline-overhaul", "caret");
        document.head.appendChild(styleEl);
        this._caretStyleEl = styleEl;
        this.register(() => {
          if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
        });
      }
      this.refreshCaretStyles();
      if (this.store && typeof this.store.subscribe === "function") {
        this.register(this.store.subscribe(() => this.refreshCaretStyles()));
      }
    } catch (_) {}
  }

  refreshCaretStyles() {
    try {
      if (!this._caretStyleEl) return;
      const css = buildCaretStyleCss(caretLookFromConfig(this.getConfig()));
      if (this._caretStyleEl.textContent !== css) this._caretStyleEl.textContent = css;
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
        const tab = this._settingsTab;
        if (!tab) return;
        /*
         * Декларативная панель пересобирает определения методом `update`;
         * `display` у неё -- объяснение для Obsidian старше 1.13.
         */
        if (typeof tab.update === "function") tab.update();
        else if (typeof tab.display === "function") tab.display();
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

  /**
   * Все команды плагина: справочнику 10.5 и никому больше. Работа — в
   * `buildOwnCommandList`, чтобы проверка могла позвать её без Obsidian и без
   * своей копии тех же правил.
   */
  listOwnCommands() {
    return buildOwnCommandList(this);
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
  }

  registerGlobalFunctions() {
    this.registerEditorExtension(cmState.Prec.highest(cmView.keymap.of([
      {
        key: "c-a",
        mac: "m-a",
        run: () => this.handleEnhancedSelectAllKeymap(),
      },
      /* Smart Delete (10.13.32). Клавиша Obsidian, перехват тем же способом,
         что и `Ctrl+A`: выключенная функция возвращает `false`, и `Del`
         работает так, как работал. */
      {
        key: "Delete",
        run: () => this.handleSmartDeleteKeymap(),
      },
      /* Зеркальный случай, свой тумблер (10.13.32 Д9). */
      {
        key: "Backspace",
        run: () => this.handleSmartBackspaceKeymap(),
      },
    ])));
    this._tagwheelHeaderExtension = createTagwheelHeaderDecorationExtension(this);
    this._tagVisualExtension = createTagVisualDecorationExtension(this);
    this._stripExtension = createStripDecorationExtension(this);
    this._sourceMarksExtension = createSourceMarkDecorationExtension(this);
    this.registerEditorExtension(this._tagwheelHeaderCompartment.of(this._tagwheelHeaderExtension));
    this.registerEditorExtension(this._sourceMarksCompartment.of(this._sourceMarksExtension));
    this.registerEditorExtension(this._tagVisualCompartment.of(cmState.Prec.highest(this._tagVisualExtension)));
    this.registerEditorExtension(this._stripCompartment.of(this._stripExtension));
    /* Своя каретка (10.13.33 Ц9). Компартмента у неё нет и не нужно: слой
       спрашивает тумблер на каждой отрисовке, а видимостью правит блок стилей,
       который переписывается сразу за правкой настройки. */
    this.registerEditorExtension(createCaretLayerExtension(this));
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

  handleSmartDeleteKeymap() {
    return getSmartDeleteEngine().handleSmartDeleteKeymap(this);
  }

  handleSmartBackspaceKeymap() {
    const engine = getSmartDeleteEngine();
    if (typeof engine.handleSmartBackspaceKeymap !== "function") return false;
    return engine.handleSmartBackspaceKeymap(this);
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
      [__pkmOptionKeys.KEYS.CYCLE_END_BEHAVIOR]: readCfgPath(cfg, "pkm.behavior.cycleEndBehavior") || "keep-bullet",
      [__pkmOptionKeys.KEYS.SUBTAG_FORMAT]: readCfgPath(cfg, "pkm.behavior.childTagFormat") || "separate",
      [__pkmOptionKeys.KEYS.CURSOR_POLICY]: readCfgPath(cfg, "pkm.behavior.cursorPolicy") || "text_end",
      [__pkmOptionKeys.KEYS.ORDER_CONFIG]: serializePkmOrderForMacro(cfg),
      [__pkmOptionKeys.KEYS.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfg),
      [__pkmOptionKeys.KEYS.TAGWHEEL_SCROLLER_ENABLED]: readCfgPath(cfg, "visual.tagWheel.scroller.enabled") === true,
      [__pkmOptionKeys.KEYS.TAGWHEEL_SCROLLER_DIRECTION]: readCfgPath(cfg, "visual.tagWheel.scroller.direction") || "full",
      [__pkmOptionKeys.KEYS.TAGWHEEL_SCROLLER_SIZE]: readCfgPath(cfg, "visual.tagWheel.scroller.size") || 3,
      /* Цвета коробки скроллера (10.13.15). Пусто — коробка берёт цвета темы. */
      [__pkmOptionKeys.KEYS.TAGWHEEL_SCROLLER_FILL]: readCfgPath(cfg, "visual.tagWheel.scroller.fillColor") || "",
      [__pkmOptionKeys.KEYS.TAGWHEEL_SCROLLER_TEXT]: readCfgPath(cfg, "visual.tagWheel.scroller.textColor") || "",
      /* Край Block: остаться в своём или перейти в соседний (10.13.35). */
      [__pkmOptionKeys.KEYS.TAGWHEEL_EDGE_MODE]: readCfgPath(cfg, "visual.tagWheel.edgeMode") || "stay",
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
      cfgNow,
      FEATURE_ORDER
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

  /**
   * Превратить строку в заметку.
   *
   * Метод, а не тело обработчика команды: то же самое делает `Floating button`
   * (10.13.12 Н9), и два входа в одну работу однажды разошлись бы — проверка
   * модуля есть у одного, обработка ошибки у другого. Здесь один вход.
   */
  async runInlineToNote() {
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
  }

  registerTransformCommands() {
    this.addCommand({
      id: "transform-inline-to-note",
      name: __commandIds.commandName("transform-inline-to-note"),
      callback: async () => { await this.runInlineToNote(); },
    });
  }

  getConfig() {
    return this.store.getSnapshot();
  }

  /**
   * Панель настроек: одна, на схеме и декларативном API Obsidian 1.13.
   *
   * Старая панель удалена 2026-08-29 решением заказчика: паритет достигнут
   * во всём, кроме справочника команд, который ждёт имён из фазы 2. Флага
   * выбора панели больше нет: выбирать не из чего.
   *
   * Не собралась -- отдаётся `null`, и вкладки настроек просто не будет.
   * Ронять загрузку нельзя: `addSettingTab` стоит внутри `onload`, и
   * исключение оттуда унесло бы с собой команды, рантайм и подсветку строк.
   * Панель важна, но не настолько.
   */
  createSettingTab() {
    const Declarative = getDeclarativeSettingTabCtor();
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
    console.error("[inline-overhaul] settings pane unavailable: needs Obsidian 1.13 or newer");
    this.notice("Inline Overhaul settings need Obsidian 1.13 or newer");
    return null;
  }

  /**
   * Папка плагина в vault. Нужна только для двух файлов рядом с `data.json`:
   * резервной копии версии 1 (МГ4) и нечитаемого файла (МГ6).
   */
  pluginFolderPath() {
    const configDir = String((this.app && this.app.vault && this.app.vault.configDir) || ".obsidian");
    const id = String((this.manifest && this.manifest.id) || "inline-overhaul");
    return configDir + "/plugins/" + id;
  }

  /**
   * МГ4 и МГ6. Идут **до** `store.init()`, потому что обе про то, что лежало
   * на диске до переезда: `store.init()` первым же действием пишет конфиг
   * обратно уже в форме версии 2.
   *
   * Работа вынесена в `config_migration_v2.loadConfig`, а сюда приходит только
   * граница с миром — файловые операции адаптера vault и `Notice`. Своей
   * логики здесь нет намеренно: у `loadConfig` есть проверка, а у обвязки
   * поверх Obsidian её быть не может.
   *
   * Ошибка не роняет загрузку плагина: без копии плагин работает, без плагина
   * — нет.
   */
  async prepareConfigFileForV2() {
    const adapter = this.app && this.app.vault ? this.app.vault.adapter : null;
    if (!adapter || typeof adapter.read !== "function" || typeof adapter.write !== "function") return null;
    try {
      const migration = getConfigMigrationV2Module();
      const files = {
        exists: (p) => adapter.exists(p),
        read: (p) => adapter.read(p),
        write: (p, data) => adapter.write(p, data),
        /* Удаление нужно одному месту: сироте служебного файла в корне
           vault после переезда в папку плагина (В-39). */
        remove: (p) => adapter.remove(p),
      };
      const result = await migration.loadConfig(
        files,
        this.pluginFolderPath(),
        (message) => { new Notice(message); },
        {
          /*
           * Признак «человек путь служебного файла не менял»: оба литеральных
           * умолчания — нынешнее и прежнее. Приходят швом, потому что у модуля
           * миграции обращений к движку нет и быть не должно.
           */
          legacyRulesDefaults: [
            __pkmOptionKeys.DEFAULT_RULES_PATH,
            __pkmOptionKeys.LEGACY_RULES_PATH,
          ],
        },
      );
      /*
       * Конфиг записывается на диск сразу: при нечитаемом файле (МГ6) `loadData`
       * Obsidian отдал бы тот же мусор, а при переезде с версии 1 (МГ4) копия
       * уже снята и терять исходник больше нечем.
       */
      await this.saveData(result.config);
      if (result.backupSavedAs) {
        console.info("[inline-overhaul] копия конфига версии 1: " + result.backupSavedAs);
      }
      if (result.rulesPathMovedTo) {
        console.info("[inline-overhaul] служебный файл правил уехал в папку плагина: "
          + result.rulesPathMovedTo);
      }
      if (result.legacyRulesRemoved) {
        console.info("[inline-overhaul] прежний служебный файл в корне vault удалён: "
          + result.legacyRulesRemoved);
      }
      return result;
    } catch (e) {
      console.error("[inline-overhaul][config:prepare]", e);
      return null;
    }
  }

  getDevModeConfig(cfg) {
    const snapshot = isObj(cfg) ? cfg : this.getConfig();
    const raw = isObj(readCfgPath(snapshot, "advanced.devMode")) ? readCfgPath(snapshot, "advanced.devMode") : {};
    const genAi = raw.aiLog === true;
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
      && patchObj.visual
      && patchObj.visual.tagBars
      && patchObj.visual.tagBars.fieldId
      || ""
    ).trim();
    this._lineTraceSeq = Math.max(0, Math.trunc(Number(this._lineTraceSeq || 0))) + 1;
    this._lineTraceTxId = `linecfg-${Date.now()}-${this._lineTraceSeq}`;
    const changed = this.store.patch(patchObj, reason || "settings") === true;
    if (!changed) return;
    const after = this.getConfig();
    const debugLine = !!(readCfgPath(after, "advanced.devMode.enabled") === true && readCfgPath(after, "advanced.devMode.traceTagVisualLine") === true);
    const wasEnabled = readCfgPath(before, "advanced.devMode.enabled") === true;
    const isEnabled = readCfgPath(after, "advanced.devMode.enabled") === true;
    const beforePath = String(readCfgPath(before, "advanced.devMode.logPath") || "");
    const afterPath = String(readCfgPath(after, "advanced.devMode.logPath") || "");
    const beforeAi = readCfgPath(before, "advanced.devMode.aiLog") === true;
    const afterAi = readCfgPath(after, "advanced.devMode.aiLog") === true;
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
          beforeStripFieldId: String(readCfgPath(before, "visual.tagBars.fieldId") || "").trim(),
          afterStripFieldId: String(readCfgPath(after, "visual.tagBars.fieldId") || "").trim(),
          beforeStripActive: readCfgPath(before, "visual.tagBars.active") === true,
          afterStripActive: readCfgPath(after, "visual.tagBars.active") === true,
          mismatchDetected: !!(stripPatchFieldId && String(readCfgPath(after, "visual.tagBars.fieldId") || "").trim() !== stripPatchFieldId),
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
    const debugLine = !!(readCfgPath(cfg, "advanced.devMode.enabled") === true && readCfgPath(cfg, "advanced.devMode.traceTagVisualLine") === true);
    const leaves = this.app && this.app.workspace && typeof this.app.workspace.getLeavesOfType === "function"
      ? this.app.workspace.getLeavesOfType("markdown")
      : [];
    if (debugLine) {
      try {
        this.devLogEvent("strip.refresh.dispatch", {
          traceTxId: this.getLineTraceTxId(),
          reason: "config-patch",
          leaves: Array.isArray(leaves) ? leaves.length : 0,
          stripFieldId: String(readCfgPath(cfg, "visual.tagBars.fieldId") || "").trim(),
          stripActive: readCfgPath(cfg, "visual.tagBars.active") === true,
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
            this._sourceMarksCompartment.of(this._sourceMarksExtension),
          ]) });
          if (this._inlineExtensionMountedEditors instanceof WeakSet) this._inlineExtensionMountedEditors.add(cm);
        } else if (this._tagVisualExtension && this._stripExtension && this._tagwheelHeaderExtension) {
          cm.dispatch({ effects: [
            this._tagwheelHeaderCompartment.reconfigure(this._tagwheelHeaderExtension),
            this._tagVisualCompartment.reconfigure(cmState.Prec.highest(this._tagVisualExtension)),
            this._stripCompartment.reconfigure(this._stripExtension),
            this._sourceMarksCompartment.reconfigure(this._sourceMarksExtension),
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
    console.error("[inline-overhaul] settings pane module failed to load", e && e.message);
  }
  return null;
}

module.exports = InlineOverhaulPlugin;
  function normalizeCycleEndBehaviorLegacy(value) {
    const s = String(value || "").trim().toLowerCase();
    if (!s) return "keep-bullet";
    if (s === "off" || s === "of" || s === "none" || s.includes("clear") || s.includes("empty")) return "clear-prefix";
    if (s === "on" || s.includes("keep") || s.includes("bullet")) return "keep-bullet";
    return "keep-bullet";
  }
