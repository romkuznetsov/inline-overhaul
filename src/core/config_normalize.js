/**
 * Конфиг: умолчания и единственный путь записи. `migrateConfig` прогоняет
 * каждый патч `ConfigStore` тремя ступенями в обязательном порядке (У-13):
 * `normalizeConfigV1` (только файл версии < 2, читает исходный файл, У-14) →
 * `config_migration_v2.migrate` (`ROUTES` + умолчания схемы) →
 * `normalizeConfigV2` (клампы и структура, на каждом патче).
 * Здесь же `DEFAULT_CONFIG`, константы вкладок и строки Binder. Вынесено из
 * `main.js` (разбор A3, PRD раздел 11). Модули — литеральным `require` (У-89).
 */
const __sharedUtils = require("./shared_utils.js");
const __compatProfile = require("./compat_profile.js");
const __pkmOptionKeys = require("./pkm_option_keys.js");
const __priorityStripEngine = require("./priority_strip_engine.js");
const __commandIds = require("../features/command_ids.js");
const __editorVisualsConfig = require("./editor_visuals_config.js");
const __pkmOrderConfig = require("./pkm_order_config.js");
const __selectAllSteps = require("./select_all_steps.js");

/* Те же однострочные обёртки, что были в `main.js`. */
function cloneJson(x) { return __sharedUtils.cloneJson(x); }
function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }
function deepMerge(base, patch) { return __sharedUtils.deepMerge(base, patch); }
function writeCfgPath(root, path, value) { return __sharedUtils.writeCfgPath(root, path, value); }

/* Цвет проверяет тот же разбор, что слой оформления (У-32). */
const normalizeHexColorInput = __editorVisualsConfig.normalizeHexColorInput;

/* Из модуля порядка — поштучно: тела ниже зовут эти имена без префикса. */
const ensureBehaviorModesFromOrder = __pkmOrderConfig.ensureBehaviorModesFromOrder;
const makeDefaultPkmOrder = __pkmOrderConfig.makeDefaultPkmOrder;

/* Ленивые обёртки над модулями; у `getTransformFeature` заглушки нет нарочно (В-7). */
function getTransformFeature() {
  return require("../features/transform_feature.js");
}

function getConfigMigrationModule() {
  return require("./config_migration.js");
}

const SCHEMA_VERSION = 1;

const FEATURE_ORDER = ["navigation", "pkm", "visual", "transform"];

const FEATURE_META = {
  navigation: { label: "Navigation" },
  /* Имя модуля — как у вкладки и в текстах панели (BUGHUNT S19). */
  pkm: { label: "Tags & PKM" },
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
  { id: "pkm", label: "Tags & PKM" },
  { id: "visual", label: "Visual" },
  { id: "transform", label: "Transform" },
  { id: "advanced", label: "Advanced" },
];

/* Списки подвкладок старой панели сняты 2026-09-19. */

const BINDER_SMART_BRACKET_COMMAND_ID = __commandIds.SMART_BRACKET_COMMAND_ID;
/* Описание строки Smart bracket пишется в конфиг на каждом проходе (2026-09-28). */
const SMART_BRACKET_DESCRIPTION = "Cycle the brackets on cursor: text → [text] → [[text]] → text";

/** Идентификатор строки Binder; схема — в `command_ids.js`. */
function makeBinderCommandId(seedText, used) {
  return __commandIds.binderCommandId(seedText, used);
}

/**
 * Строки Binder: форма, идентификаторы команд и системная строка. Старая форма
 * id `inlineOverhaul_Binder_<Suffix>` считается отсутствующей и пересобирается из
 * имени (фаза 2, п. 8; Р3, T7) — хоткей при этом рвётся. Занятые id начинаются с
 * ядра и команд Field (BUGHUNT K1). `order` — Order этого же конфига.
 */
function normalizeBinderRows(rawRows, order) {
  const source = Array.isArray(rawRows) ? rawRows : [];
  const out = [];
  const used = __commandIds.pkmCommandIdSet(__pkmOrderConfig.normalizePkmOrder(order || null), FEATURE_ORDER);
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
        description: SMART_BRACKET_DESCRIPTION,
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
      description: SMART_BRACKET_DESCRIPTION,
      commandId: BINDER_SMART_BRACKET_COMMAND_ID,
    });
  }

  return out;
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
      /* Цвет подсветки перенесённых строк: пусто — цвет выделения темы. */
      highlightColor: "",
      keepInView: true,
      jumpNeighborTrees: false,
      viewPosition: "center",
    },
    moveSelection: {
      enabled: true,
      inlineEnabled: true,
      prefixCyclerEnabled: true,
      indentFallbackEnabled: true,
      indentWithChildren: false,
      onCycleEnd: "indent",
      cycleOrder: ["#", "##", "###", "####", "#####", "1. ", "", "- "],
      inlineMoveMode: "auto",
      inlineBoundaryJump: true,
      /* Часть слова уезжает за пределы слова (2026-09-08); умолчание выключено.
       * Читает только режим `auto`. */
      inlineWordEscape: false,
    },
    jumpToHeader: {
      enabled: true,
      centerCursor: true,
      /* Место на экране после перехода (10.13.37); `center` — поведение прежнего `centerCursor`. */
      viewPosition: "center",
      centerDelayMs: 60,
      centerThrottleMs: 200,
      jumpMode: "edge",
      edgeMode: "start-end",
      /* Умолчание `End of your text` (2026-09-04); совпадение со схемой сторожит
       * `settings_paths_v2_tests.ts`. */
      jumpCursorPosition: "section-end",
      /* Подсветка места, куда прыгнул курсор, переехала на вкладку Visual
         его словом 2026-09-17 и живёт теперь в `visual.jumpFlash.*`.
         Умолчания ей досыпает схема — так же, как каретке; своей записи
         здесь у неё быть не должно, иначе у умолчания два дома (У-32). */
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
      /* Умолчание разделителей объявлено один раз — `DEFAULT_SEPARATORS` в
         `shared_utils.js` (У-186). */
      io: Object.assign({}, __sharedUtils.DEFAULT_SEPARATORS),
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
    /* Подвкладки и тумблеры вида (Ф15) сняты 2026-09-19 (мёртвые ветки). */
    /* Высота таблицы Fields: `false` — развёрнутая, `true` — со скроллингом
     * (2026-09-12). Запоминается между открытиями панели. */
    fieldsTableFixedHeight: false,
    binderRows: [
      {
        rowId: "binder-system-smart-bracket",
        insertText: "[]",
        commandName: "Smart bracket",
        description: SMART_BRACKET_DESCRIPTION,
        commandId: BINDER_SMART_BRACKET_COMMAND_ID,
      },
    ],
  },
  devMode: {
    enabled: false,
    /* Выключен по умолчанию — его ответ `В-266` (BUGHUNT D18). */
    generateAiLog: false,
    traceTagVisualLine: false,
    logPath: "InlineOverhaul_DevLog",
  },
};

function normalizePkmTopLevelConfig(cfg) {
  if (!isObj(cfg.pkm)) cfg.pkm = cloneJson(DEFAULT_CONFIG.pkm);
  cfg.pkm.executionBackend = PKM_BACKENDS.internalV2;
  /* Путь служебного файла правил снят (PRD 10.13.52, П-8). */
  delete cfg.pkm.generatedRulesPath;
  const deprecatedPkm = Array.isArray(__compatProfile.DEPRECATED_CONFIG_KEYS?.pkm)
    ? __compatProfile.DEPRECATED_CONFIG_KEYS.pkm
    : ["sourceOfTruth", "autoGenerateRules"];
  for (const key of deprecatedPkm) delete cfg.pkm[key];
}

/**
 * Ступень 1: доводит конфиг версии < 2 до ровной формы версии 1. Только здесь
 * переименования старой формы (`leftToRight` → `cycleOrder`, `tagSizePct` →
 * `tagTextSizePct`, `logSize` → `generateAiLog`). Идёт до миграции: ставит
 * умолчания движка, а досыпка миграции заполняет только отсутствующее (В-7).
 */
function normalizeConfigV1(raw) {
  const source = isObj(raw) ? raw : {};
  let cfg = deepMerge(DEFAULT_CONFIG, source);
  const ver = Number(cfg.schemaVersion) || 0;

  /**
   * Значение из исходного файла, а не слитого с умолчаниями: `deepMerge` кладёт
   * новый ключ раньше, и проверка «нового нет» на слитом не срабатывает никогда
   * (найдено 2026-08-31).
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
  if (typeof cfg.ui.fieldsTableFixedHeight !== "boolean") cfg.ui.fieldsTableFixedHeight = false;

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
    if (!["start", "end", "section-start", "section-end"].includes(ownCursor) && legacyAnchor === "active-text-end") {
      cfg.navigation.jumpToHeader.jumpCursorPosition = "section-end";
    } else if (!["start", "end", "section-start", "section-end"].includes(cfg.navigation.jumpToHeader.jumpCursorPosition)) {
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
    /* Старое и новое имя — из файла: иначе умолчание `deepMerge` выигрывает у выбора. */
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

    /* `byField`, `byTag`, `userTags` и полоса нормализуются ступенью 3
     * (`normalizeTagVisualMapsV2`): на каждом патче. */
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
  /* Order, Fields и чекбоксы Prefix нормализуются ступенью 3: их пути
   * (`pkm.fields.*`, `pkm.prefixRules.*`) есть только в версии 2. */

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
 * Миграция `1 → 2` — синхронным `require`, без заглушки: заглушка дала бы
 * немигрированный конфиг. Путь `.ts` работает в Node 24 и в esbuild
 * (`resolveExtensions` в `build/release.js`).
 */
let __configMigrationV2 = null;

/* Литерал пути остаётся литералом — иначе esbuild модуль не найдёт (У-89). */
function getConfigMigrationV2Module() {
  if (__configMigrationV2) return __configMigrationV2;
  __configMigrationV2 = require("./config_migration_v2.ts");
  return __configMigrationV2;
}

let __engineDefaultsV2 = null;

/**
 * Умолчания движка в форме версии 2: прогон ступеней 1–2 на пустом конфиге, не
 * второй список. Схема сюда не заглядывает намеренно (В-7).
 */
function getEngineDefaultsV2() {
  if (__engineDefaultsV2) return __engineDefaultsV2;
  const migrated = getConfigMigrationV2Module().migrate(normalizeConfigV1({}), { log: () => {} });
  __engineDefaultsV2 = migrated;
  return __engineDefaultsV2;
}

/** Карты вида тегов на путях версии 2 (`visual.tags.byField`, `.byTag`, `.userTags`) — в
 * ступени 3: панель правит их на каждом патче. */
/**
 * Высота подложки блоков: `heightPx` → `heightPct` (2026-09-09, S7). Здесь, а не
 * в `ROUTES`: файл версии 2 карту маршрутов не проходит. Условие — наличие
 * старого ключа: новый всегда заполнен умолчанием (У-55); старый снимается, и
 * перевод однократный. Множитель 20: пять делений старой шкалы → сто новой.
 */
function renameBlockFillHeightToPercent(cfg) {
  const fill = readCfgPath(cfg, "visual.tags.blockFill");
  if (!isObj(fill) || fill.heightPx === undefined) return;
  const px = Number(fill.heightPx);
  delete fill.heightPx;
  if (!Number.isFinite(px)) return;
  const pct = Math.max(0, Math.min(100, Math.round(px) * 20));
  writeCfgPath(cfg, "visual.tags.blockFill.heightPct", pct);
}

function normalizeTagVisualMapsV2(cfg) {
  const tags = isObj(readCfgPath(cfg, "visual.tags")) ? readCfgPath(cfg, "visual.tags") : {};
  writeCfgPath(cfg, "visual.tags", tags);

  /**
   * Ключ карты видов значений — тег или ссылка: вопрос объявлен один раз,
   * `isVisualTokenKey` у слоя оформления (2026-09-20, тест 7; У-237).
   */
  const normalizeTagToken = (token) => {
    const src = String(token || "").trim();
    return __editorVisualsConfig.isVisualTokenKey(src) ? src : "";
  };
  /* У своих тегов ключом бывает только тег: ссылка не тег человека. */
  const normalizeUserTagToken = (token) => {
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
      borderColor: normalizeHexColorInput(src.borderColor),
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
    const token = normalizeUserTagToken(rawToken);
    if (!token || Object.prototype.hasOwnProperty.call(userTagsOut, token)) continue;
    /*
     * Надгробие: `setConfigPatch` идёт через `deepMerge`, который ключ убрать не
     * умеет — на месте удалённого остаётся null. Без этой строки удалённый тег
     * возвращался бы в список.
     */
    if (userTagsIn[rawToken] === null) continue;
    userTagsOut[token] = normalizeTagVisualRow(userTagsIn[rawToken], "default");
  }
  tags.userTags = userTagsOut;
}

/**
 * Ступень 3: клампы, перечисления и структура на путях версии 2, на каждом
 * патче. Испорченное значение заменяется умолчанием движка
 * (`getEngineDefaultsV2`), не схемы (В-7).
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
  /* `done-marker`: шкала панели «насколько погасить» 0…80, хранится «сколько
   * осталось» — 20…100. */
  text("pkm.behavior.doneMarker.token");
  oneOf("pkm.behavior.doneMarker.panel", ["left", "right"]);
  bool("pkm.behavior.doneMarker.strike");
  bool("pkm.behavior.doneMarker.visual.enabled");
  int("pkm.behavior.doneMarker.visual.opacity", 20, 100);
  hex("pkm.behavior.doneMarker.visual.color");
  bool("pkm.placement.fieldPrefixInsertOnly");
  bool("pkm.placement.bulletInStrict");
  bool("pkm.placement.typedTagsStayText");
  oneOf("pkm.placement.freeInsertPosition", ["smart", "left", "right"]);
  text("pkm.lineFormat.separator1");
  text("pkm.lineFormat.separator2");

  /* --- навигация -------------------------------------------------------- */
  oneOf("navigation.moveLine.noSelectionMode", ["line-only", "with-children"]);
  oneOf("navigation.moveLine.headerMode", ["move-as-line", "move-with-section"]);
  bool("navigation.moveLine.crossSectionAllowed");
  bool("navigation.moveLine.highlightMovedLines");
  hex("navigation.moveLine.highlightColor");
  /* Прокрутка при перемещении строки (10.13.36). */
  bool("navigation.moveLine.keepInView");
  /* Дерево перескакивает соседнее дерево целиком (10.13.275). */
  bool("navigation.moveLine.jumpNeighborTrees");
  oneOf("navigation.moveLine.viewPosition", ["center", "top", "bottom"]);
  bool("navigation.moveSelection.inlineEnabled");
  bool("navigation.moveSelection.prefixCyclerEnabled");
  bool("navigation.moveSelection.indentFallbackEnabled");
  /* Move left/right двигает и дерево строки (В-257). */
  bool("navigation.moveSelection.indentWithChildren");
  oneOf("navigation.moveSelection.onCycleEnd", ["indent", "wrap"]);
  oneOf("navigation.moveSelection.inlineMoveMode", ["auto", "char", "word", "disabled"]);
  bool("navigation.moveSelection.inlineBoundaryJump");
  writeCfgPath(cfg, "navigation.moveSelection.enabled",
    readCfgPath(cfg, "navigation.moveSelection.inlineEnabled") === true);
  list("navigation.moveSelection.cycleOrder");
  oneOf("navigation.jumpToHeader.jumpMode", ["edge", "line"]);
  oneOf("navigation.jumpToHeader.edgeMode", ["start-end", "start", "end"]);
  oneOf("navigation.jumpToHeader.jumpCursorPosition", ["start", "end", "section-start", "section-end"]);
  bool("navigation.jumpToHeader.centerCursor");
  /* Место после перехода по заголовкам (10.13.37): три положения, как у строки. */
  oneOf("navigation.jumpToHeader.viewPosition", ["center", "top", "bottom"]);
  int("navigation.jumpToHeader.centerDelayMs", 0, 2000);
  int("navigation.jumpToHeader.centerThrottleMs", 0, 5000);
  oneOf("navigation.navigateInline.stepMode", ["word", "sentence", "begin-end"]);
  bool("navigation.navigateInline.boundaryJump");
  oneOf("navigation.navigateInline.onBoundary", ["stay", "wrap", "next-line"]);

  /* --- «выделить всё» и Binder ------------------------------------------ */
  bool("editor.selectAll.enabled");
  /* Режимы и ступени — из `select_all_steps.js` (У-32). */
  oneOf("editor.selectAll.mode", __selectAllSteps.SELECT_ALL_MODE_IDS);
  /* Галочки `Custom` (З-3): умолчания у схемы нет — строку рисует свой блок. */
  writeCfgPath(cfg, "editor.selectAll.customSteps",
    __selectAllSteps.normalizeCustomSteps(readCfgPath(cfg, "editor.selectAll.customSteps")));
  bool("editor.selectAll.useDelay");
  int("editor.selectAll.delayMs", 250, 2000);
  bool("editor.selectAll.clearOnLast");
  /* Smart Delete (10.13.32). Клавиша Obsidian, поэтому умолчание выключено. */
  bool("editor.smartDelete.enabled");
  bool("editor.smartDelete.dropPrefix");
  bool("editor.smartDelete.onBackspace");
  bool("editor.smartDelete.joinWithSpace");
  /* Smart Enter (10.13.88): клавиша Obsidian, умолчание выключено. */
  bool("editor.smartEnter.enabled");
  /* Знак на новой строке (10.13.88); `same` — как у Obsidian. */
  oneOf("editor.smartEnter.newLinePrefix", ["same", "none", "number-only"]);
  /* Где работает клавиша (10.13.91); умолчание `line`. */
  oneOf("editor.smartEnter.scope", ["line", "text"]);
  bool("editor.smartEnter.shiftPlainEnter");
  bool("editor.smartEnter.useShift");
  /* Smart paste (`З-31`, `З-32`): клавиша Obsidian, умолчание выключено. */
  bool("editor.smartPaste.enabled");
  writeCfgPath(cfg, "editor.binder.rows", normalizeBinderRows(readCfgPath(cfg, "editor.binder.rows"), readCfgPath(cfg, "pkm.fields.order")));

  /* --- вид тегов -------------------------------------------------------- */
  int("visual.tags.opacityLeft", 0, 100);
  int("visual.tags.opacityRight", 0, 100);
  int("visual.tags.textSizePctLeft", 50, 140);
  int("visual.tags.textSizePctRight", 50, 140);
  int("visual.tags.bubbleWidthPct", 20, 140);
  int("visual.tags.bubbleHeightPct", 20, 140);
  int("visual.tags.emptyBubblePct", 10, 180);
  int("visual.tags.cornersPct", 0, 100);
  /* Заливка Left и Right Block (З-7). Пустой цвет — у темы; `hex` даёт пусто для
   * непохожего. */
  bool("visual.tags.blockFill.enabled");
  hex("visual.tags.blockFill.color");
  /* Два цвета ссылки как написано (`З-37`); пусто — у темы (У-60). */
  hex("visual.tags.linkAsWritten.targetColor");
  hex("visual.tags.linkAsWritten.bracketsColor");
  /* Та же пара у гиперссылки (2026-09-22, тест 4); перенос — `seedSplitKeys` (У-17). */
  hex("visual.tags.hyperlink.targetColor");
  hex("visual.tags.hyperlink.bracketsColor");
  hex("visual.tags.hyperlink.addressColor");
  int("visual.tags.blockFill.opacity", 0, 100);
  /* Выход подложки за написанное (S7): высота и ширина — доли измеренного.
   * Границы держит нормализация, иначе рукописный `data.json` уедет за шкалу. */
  renameBlockFillHeightToPercent(cfg);
  int("visual.tags.blockFill.heightPct", 0, 100);
  int("visual.tags.blockFill.widthPct", 0, 100);
  /* Какой Block получает полосу (З-12): имена зон разбора строки. */
  oneOf("visual.tags.blockFill.direction", ["left", "right", "both"]);
  normalizeTagVisualMapsV2(cfg);

  /* --- каретка: цвет, толщина, мерцание (10.13.33) ---------------------- */
  bool("visual.caret.enabled");
  /* Пусто — у темы; `hex` даёт пусто для непохожего на цвет. */
  hex("visual.caret.color");
  /* Форма — своя половина группы, со своим тумблером (Ц6). */
  bool("visual.caret.shapeEnabled");
  int("visual.caret.width", 1, 8);
  /* 0 — «не мигает», поэтому нижняя граница 0 (Ц7). */
  int("visual.caret.blinkSpeed", 0, 10);

  /* Подсветка прыжка (Н5): границы как у ползунков панели. Здесь, не в ступени
   * 1 — та не идёт для версии 2 и патча (У-13). */
  bool("visual.jumpFlash.enabled");
  bool("visual.jumpFlash.inLine");
  hex("visual.jumpFlash.color");
  int("visual.jumpFlash.radius", 6, 40);
  int("visual.jumpFlash.fadeMs", 100, 1500);
  int("visual.jumpFlash.quietMs", 0, 1000);

  /* --- Tag Bars: форму задаёт сам движок полосы -------------------------- */
  writeCfgPath(cfg, "visual.tagBars", __priorityStripEngine.normalizeStripConfig(
    isObj(readCfgPath(cfg, "visual.tagBars")) ? readCfgPath(cfg, "visual.tagBars") : {}));

  /* --- TagWheel ---------------------------------------------------------- */
  hex("visual.tagWheel.textColor");
  hex("visual.tagWheel.fillColor");
  bool("visual.tagWheel.showMarkers");
  bool("visual.tagWheel.highlightLine");
  bool("visual.tagWheel.boldFieldNames");
  /* Подпись значения в полосе панели (2026-09-21, `З-38`); `default` — прежнее. */
  oneOf("visual.tagWheel.valueNames", ["default", "custom", "both"]);
  bool("visual.tagWheel.scroller.enabled");
  oneOf("visual.tagWheel.scroller.direction", ["up", "down", "full"]);
  /* Подписи соседних значений в коробке (2026-09-20; `both` — 2026-09-21). */
  oneOf("visual.tagWheel.scroller.labels", ["value", "custom", "both"]);
  int("visual.tagWheel.scroller.size", 1, 20);
  /* Цвета скроллера (10.13.15); пусто — у темы. */
  hex("visual.tagWheel.scroller.fillColor");
  hex("visual.tagWheel.scroller.textColor");
  /* Стрелка на краю Block (10.13.35); умолчание — прежнее поведение. */
  oneOf("visual.tagWheel.edgeMode", ["stay", "next-block"]);
  /* Значения противоположного Block при открытой панели (10.13.87); `hide` — прежнее. */
  oneOf("visual.tagWheel.oppositeBlock", ["hide", "keep"]);
  /* На каком Field открывается панель (10.13.76). Имя — текстом: его проверяет движок. */
  oneOf("visual.tagWheel.activeField.mode", ["first", "middle", "custom"]);
  text("visual.tagWheel.activeField.left");
  text("visual.tagWheel.activeField.right");
  /*
   * Выбор Field из другого Block снимается (В-134; тот же класс, что В-127) — в
   * нормализации, то есть на каждой дороге. Это обещает и текст настройки (У-64).
   */
  for (const side of ["left", "right"]) {
    const chosen = String(readCfgPath(cfg, "visual.tagWheel.activeField." + side) || "").trim();
    if (!chosen) continue;
    const order = readCfgPath(cfg, "pkm.fields.order." + side);
    const keys = Array.isArray(order) ? order.map((k) => String(k || "").trim()) : [];
    if (keys.indexOf(chosen) === -1) writeCfgPath(cfg, "visual.tagWheel.activeField." + side, "");
  }
  /* Цвет активного Field: он на строке, а не в коробке скроллера (10.13.15). */
  hex("visual.tagWheel.activeTextColor");
  hex("visual.tagWheel.chosenValueColor");

  /* --- запомненное состояние панели -------------------------------------- */
  /* Высота таблицы Fields: ступень 3 — патч из панели ступень 1 не проходит (У-13, У-40). */
  bool("ui.fieldsTableFixedHeight");

  /* Снятый `advanced.generatedRulesPath` (PRD 10.13.52, П-8): миграция выбрасывает
   * его только у версии 1, здесь — у версии 2. */
  if (isObj(cfg.advanced)) delete cfg.advanced.generatedRulesPath;

  /* --- режим разработчика ------------------------------------------------ */
  /* Предел автокопий: ввод чистит плагин (В-118) — только цифры, без ведущих
   * нулей, ноль — пусто. */
  writeCfgPath(cfg, "advanced.backups.autosaveKeep",
    String(readCfgPath(cfg, "advanced.backups.autosaveKeep") ?? "").replace(/\D/g, "").replace(/^0+/, ""));
  bool("advanced.devMode.enabled");
  bool("advanced.devMode.aiLog");
  bool("advanced.devMode.traceTagVisualLine");
  text("advanced.devMode.logPath");


  /* Ветка Transform — в ступени 3, на каждом патче (У-13): иначе решётки
   * 1.6.4.1 не снимались у версии 2 (B16). */
  cfg = getTransformFeature().normalizeTransformConfig(cfg);

  /* Tag Bars на удалённом Field — выбор снимается (`В-265`, BUGHUNT D13), здесь —
   * на каждом патче (У-13). Ключи Field при переименовании не меняются. */
  const barsField = String(readCfgPath(cfg, "visual.tagBars.fieldId") || "").trim();
  const tagDefs = readCfgPath(cfg, "pkm.fields.tags.fields");
  if (barsField && Array.isArray(tagDefs)
    && !tagDefs.some((f) => isObj(f) && String(f.id || "").trim() === barsField)) {
    writeCfgPath(cfg, "visual.tagBars.fieldId", "");
  }

  cfg.schemaVersion = getConfigMigrationV2Module().SCHEMA_VERSION_V2;
  return cfg;
}

/**
 * Единственный путь записи: каждый патч `ConfigStore`. Ступени:
 * 1. `normalizeConfigV1` — только для файла версии < 2: патч из панели уже во
 *    второй форме, и приёмник стравил бы его с ветками `DEFAULT_CONFIG`.
 * 2. миграция `1 → 2` — `ROUTES` плюс досыпка умолчаний.
 * 3. `normalizeConfigV2` — клампы, перечисления, структура.
 * Ступень 1 до 2: переставь — и на свежей установке победит схема (В-7).
 * Порядок закреплён `tests/regression/migrate_stage_order_tests.ts`.
 */
function migrateConfig(raw) {
  const source = isObj(raw) ? raw : {};
  const version = Number(source.schemaVersion) || 0;
  const accepted = version >= getConfigMigrationV2Module().SCHEMA_VERSION_V2
    ? source
    : normalizeConfigV1(source);
  return normalizeConfigV2(getConfigMigrationV2Module().migrate(accepted));
}

/** Старое написание «что делать в конце цикла» — в нынешнее; читают обе ступени. */
function normalizeCycleEndBehaviorLegacy(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "keep-bullet";
  if (s === "off" || s === "of" || s === "none" || s.includes("clear") || s.includes("empty")) return "clear-prefix";
  if (s === "on" || s.includes("keep") || s.includes("bullet")) return "keep-bullet";
  return "keep-bullet";
}

module.exports = {
  SCHEMA_VERSION,
  FEATURE_ORDER,
  FEATURE_META,
  PKM_BACKENDS,
  SETTINGS_TABS,
  BINDER_SMART_BRACKET_COMMAND_ID,
  makeBinderCommandId,
  normalizeBinderRows,
  DEFAULT_CONFIG,
  normalizePkmTopLevelConfig,
  normalizeConfigV1,
  __configMigrationV2,
  getConfigMigrationV2Module,
  __engineDefaultsV2,
  getEngineDefaultsV2,
  normalizeTagVisualMapsV2,
  normalizeConfigV2,
  migrateConfig,
};
