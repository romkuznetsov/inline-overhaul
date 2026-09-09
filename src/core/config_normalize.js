/**
 * Конфиг: умолчания и единственный путь записи.
 *
 * `migrateConfig` — та самая функция, через которую `ConfigStore` прогоняет
 * **каждый** патч. Ступеней три, и порядок обязателен (У-13):
 *
 *   1. `normalizeConfigV1` — приём файла версии ниже второй. Только здесь
 *      живут переименования старой формы, и читают они исходный файл, а не
 *      слитый (У-14). Для патча из панели не выполняется.
 *   2. `config_migration_v2.migrate` — перенос по карте `ROUTES` плюс досыпка
 *      умолчаний из схемы.
 *   3. `normalizeConfigV2` — клампы, перечисления и структура на путях версии
 *      2. Идёт на каждом патче.
 *
 * Здесь же `DEFAULT_CONFIG`, константы вкладок панели и нормализация строк
 * Binder: всё это форма конфига, а не поведение плагина.
 *
 * **Откуда взялось.** Вынесено из `main.js` 2026-09-07, кусок третий разбора
 * A3 (PRD, раздел 11). Тела функций при переезде не правились.
 *
 * Модули — литеральным `require`, по одному на модуль (У-89).
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

/* Цвет проверяет тот же разбор, которым его читает слой оформления: два
   объявления «что такое законный HEX» разошлись бы молча (У-32). */
const normalizeHexColorInput = __editorVisualsConfig.normalizeHexColorInput;

/* Из модуля порядка — поштучно: тела ниже зовут эти имена без префикса. */
const ensureBehaviorModesFromOrder = __pkmOrderConfig.ensureBehaviorModesFromOrder;
const makeDefaultPkmOrder = __pkmOrderConfig.makeDefaultPkmOrder;

/* Ленивые обёртки над модулями — ровно те же, что стояли в `main.js`: у
   `getTransformFeature` заглушки нет нарочно (умолчания ветки Transform
   ставит движок, а не схема — расхождения В-7). */
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
      /*
       * Часть слова уезжает за пределы своего слова (замечание заказчика
       * 2026-09-08). Умолчание **выключено** — его решение: тумблер даёт
       * разрешение, а не меняет поведение всем. Читает ключ только режим
       * `auto`: у `char` и `word` такого отказа нет вовсе.
       */
      inlineWordEscape: false,
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

/* Единственная правка тела на переезде: путь считался от `main.js`.
   Литерал остаётся литералом — иначе esbuild модуль не найдёт (У-89). */
function getConfigMigrationV2Module() {
  if (__configMigrationV2) return __configMigrationV2;
  __configMigrationV2 = require("./config_migration_v2.ts");
  return __configMigrationV2;
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
  /* Список режимов и список ступеней объявлены один раз — в
     `select_all_steps.js`; второй перечень здесь разошёлся бы с движком
     молча (У-32). */
  oneOf("editor.selectAll.mode", __selectAllSteps.SELECT_ALL_MODE_IDS);
  /* Галочки режима `Custom` (З-3). Умолчания у схемы нет: строку рисует свой
     блок, а у записи `kind: "custom"` ни пути, ни умолчания не бывает. */
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
  writeCfgPath(cfg, "editor.binder.rows", normalizeBinderRows(readCfgPath(cfg, "editor.binder.rows")));

  /* --- вид тегов -------------------------------------------------------- */
  int("visual.tags.opacityLeft", 0, 100);
  int("visual.tags.opacityRight", 0, 100);
  int("visual.tags.textSizePct", 50, 140);
  int("visual.tags.bubbleWidthPct", 20, 140);
  int("visual.tags.bubbleHeightPct", 20, 140);
  int("visual.tags.emptyBubblePct", 10, 180);
  int("visual.tags.cornersPct", 0, 100);
  /* Заливка Left и Right Block (З-7). Цвет пустой значит «взять у темы»,
     и `hex` возвращает пустую строку для чего угодно непохожего. */
  bool("visual.tags.blockFill.enabled");
  hex("visual.tags.blockFill.color");
  int("visual.tags.blockFill.opacity", 0, 100);
  /* На сколько подложка выходит за написанное (замечание по S7). Высота — в
     точках, ширина — в долях расстояния до разделителя. Границы держит
     нормализация, а не панель: рукописный `data.json` иначе уехал бы за шкалу
     и слой получил бы прямоугольник в пол-экрана. */
  int("visual.tags.blockFill.heightPx", 0, 5);
  int("visual.tags.blockFill.widthPct", 0, 100);
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
 * Старое написание «что делать в конце цикла» — в нынешнее.
 *
 * Читают её обе ступени нормализации, и обе — здесь. **Где она лежала до
 * 2026-09-07:** в самом конце `main.js`, ниже `module.exports`, с отступом в
 * два пробела — то есть выглядела вложенной, а была объявлением верхнего
 * уровня, и работала только на подъёме объявлений. Позвать её из модуля было
 * нельзя вовсе: `module.exports` уже отдан.
 */
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
  VISUAL_SUB_TABS,
  HOTKEYS_SUB_TABS,
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
