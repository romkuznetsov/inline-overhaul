"use strict";

const { Plugin, PluginSettingTab, Setting, Notice, Modal, setIcon } = require("obsidian");
const cmView = require("@codemirror/view");
const cmState = require("@codemirror/state");

/*
 * Модули плагина: один статический `require` на модуль (фаза 6, пункт 1;
 * дефекты A1, A2 и A33).
 *
 * **Путь один, и он статический.** Путей было три: `require` по пути в
 * переменной, чтение файла из vault мостом и `new Function` над его текстом.
 * Два сняты 2026-09-06, а третий оказался не путём вовсе: путь в переменной
 * esbuild не разрешает — такой вызов остаётся вызовом `require` хоста, а
 * рядом с установленным плагином лежит один плоский бандл и ни одной папки.
 * Все загрузчики стали отдавать заглушки, и заказчик увидел плагин без единой
 * команды при 51 зелёной проверке (дефект A33). Литерал esbuild разрешает и
 * кладёт модуль в бандл — поэтому здесь литералы, и промахнуться мимо них
 * нельзя.
 *
 * **Заглушек больше нет, и это главное в правке.** Заглушка реестра команд
 * отвечала на свой же вопрос «годен ли модуль» утвердительно — четыре пустые
 * функции, — и синхронная попытка `require` за ней уже не выполнялась: тот же
 * класс, что У-71, утверждение о состоянии зелено именно тогда, когда предмета
 * нет. Модуля в бандле не может не быть; а если его всё же нет, плагин обязан
 * упасть громко, а не работать наполовину.
 *
 * **Кеша нет.** `require` отдаёт один и тот же объект: в бандле его помнит
 * обёртка esbuild, в Node — кеш модулей. Своя карта была третьим кешем поверх
 * двух.
 *
 * Что проверяет это место: `tests/regression/bundle_onload_tests.ts` включает
 * СБОРКУ и спрашивает у неё список команд, а `bootstrap_loader_tests.js` —
 * что ни одного `require` по переменной в `main.js` не осталось.
 */
const __priorityStripEngine = require("./src/core/priority_strip_engine.js");
const __priorityStripCm6Adapter = require("./src/core/priority_strip_cm6_adapter.js");


/*
 * Видимый текст сообщения по ключу каталога (PRD 10.13.50, третий кусок).
 *
 * Шов один на весь рантайм — `globalThis.__inlineSay`, его ставит слой
 * настроек. Пока он не поставлен (панель не собралась, старый Obsidian),
 * `say` отдаёт английское, которое стоит вторым аргументом на месте вызова:
 * человек обязан увидеть сообщение, а не ключ. Подстановку `{0}` делает тот
 * же модуль.
 */
const __say = require("./src/core/say.js").say;

/** Ключ сообщения. Строит его одна функция, и её зовут оба конца (У-82). */
function __noticeKey(area, name) {
  return "notice." + area + "." + name;
}

const __sharedUtils = require("./src/core/shared_utils.js");
globalThis.__inlineOverhaulSharedUtils = __sharedUtils;

const __pkmOptionKeys = require("./src/core/pkm_option_keys.js");
const __pkmDomainRegistry = require("./src/core/pkm_domain_registry.js");
const __compatProfile = require("./src/core/compat_profile.js");
const __transformLineFinalize = require("./src/core/pkm_line_finalize_unified.js");

/*
 * Слой оформления редактора уехал в два модуля (кусок второй разбора A3,
 * 2026-09-07): что об оформлении говорит конфиг — в `editor_visuals_config`,
 * что рисует CodeMirror — в `ui/editor/decorations`. Здесь остались только
 * имена, которые зовёт сам класс плагина, и объявлены они однострочно — тем
 * же способом, каким тут объявлены `isObj` и `cloneJson`.
 */
const __editorVisualsConfig = require("./src/core/editor_visuals_config.js");
const __editorDecorations = require("./src/ui/editor/decorations.js");
const normalizeHexColorInput = __editorVisualsConfig.normalizeHexColorInput;
const buildCaretStyleCss = __editorVisualsConfig.buildCaretStyleCss;
const caretLookFromConfig = __editorVisualsConfig.caretLookFromConfig;
const STRIP_LINE_STYLE_CSS = __editorVisualsConfig.STRIP_LINE_STYLE_CSS;
const TAGWHEEL_FILL_STYLE_CSS = __editorVisualsConfig.TAGWHEEL_FILL_STYLE_CSS;
const createTagVisualDecorationExtension = __editorDecorations.createTagVisualDecorationExtension;
const createStripDecorationExtension = __editorDecorations.createStripDecorationExtension;
const createCaretLayerExtension = __editorDecorations.createCaretLayerExtension;
const createSourceMarkDecorationExtension = __editorDecorations.createSourceMarkDecorationExtension;
const createTagwheelHeaderDecorationExtension = __editorDecorations.createTagwheelHeaderDecorationExtension;




function reportLoaderFallback(stage, err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return;
    const msg = err && err.message ? String(err.message) : String(err || "");
    console.warn(`[inline-overhaul][loader] ${stage}: ${msg}`);
  } catch (_) {}
}

/** Реестр команд: определения для ядра, навигации, PKM и Binder (PRD 7.2). */
function getCommandRegistry() {
  return require("./src/features/command_registry.js");
}

/**
 * Transform: движок превращения строки в заметку и умолчания его ветки.
 *
 * Заглушки здесь нет, и это важнее, чем кажется. `normalizeTransformConfig`
 * ставит умолчания движка ветки Transform; на заглушке, отдававшей конфиг как
 * есть, умолчания досыпала бы схема — то есть Transform включался бы из
 * коробки, а папкой шаблонов становилась `Templates` (девятнадцать расхождений
 * В-7). Продуктовое решение не должно принимать тот, успел ли загрузиться
 * модуль.
 */
function getTransformFeature() {
  return require("./src/features/transform_feature.js");
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

/**
 * Сборщик служебной заметки правил.
 *
 * Единственный модуль, который помнится: у него есть зависимости, и собирается
 * он один раз. Своей копии сборки здесь больше нет — форма документа осталась
 * версии 1, и две копии перекладки значений разошлись бы молча, в заметке,
 * которую человек не читает (У-32).
 */
let __rulesMarkdownBuilder = null;
function getRulesMarkdownBuilder() {
  if (__rulesMarkdownBuilder) return __rulesMarkdownBuilder;
  const mod = require("./src/features/rules_markdown_builder.js");
  __rulesMarkdownBuilder = mod.createRulesMarkdownBuilder({ isObj, cloneJson, toPrettyJson });
  return __rulesMarkdownBuilder;
}

/** `Ctrl+A` по своим правилам (10.13.31). */
function getEnhancedSelectAllEngine() {
  return require("./src/features/enhanced_select_all_engine.js");
}

/** `Del` и `Backspace` по своим правилам (10.13.32). */
function getSmartDeleteEngine() {
  return require("./src/features/smart_delete_engine.js");
}

/**
 * Хранилище конфига. Встроенной копии `ConfigStore` в `main.js` больше нет:
 * она была вторым объявлением единственного пути записи (A14, У-32).
 */
function getConfigStoreCtor() {
  return require("./src/core/config_store.js").ConfigStore;
}

/** Вторая ступень нормализации: форма ветки поведения PKM. */
function getConfigMigrationModule() {
  return require("./src/core/config_migration.js");
}

/** Запись служебной заметки правил: расписание и разовый вызов. */
function getRulesSyncOrchestrator() {
  return require("./src/features/rules_sync_orchestrator.js");
}

/** Подписка на хранилище и уборка за ней. */
function getStoreEventsOrchestrator() {
  return require("./src/features/store_events_orchestrator.js");
}

function cloneJson(x) { return __sharedUtils.cloneJson(x); }
function isObj(x) { return __sharedUtils.isObj(x); }
function deepMerge(base, patch) { return __sharedUtils.deepMerge(base, patch); }
function toPrettyJson(x) { return __sharedUtils.toPrettyJson(x); }



/**
 * Движок навигации по строкам. Файл под З3, загружается как есть.
 */
function getNavigationRuntime() {
  return require("./navigation_runtime.js");
}

/** Движок инлайновых PKM-тегов. Файл под З3. */
function getPkmRuntimeV2() {
  return require("./pkm_runtime_v2.js");
}

/**
 * Шов макро-рантайма PKM: по нему движки под З3 находят точку входа.
 *
 * Публикуется в `globalThis`, потому что спрашивают его файлы, которых
 * `main.js` не подключает: у них свой загрузчик — мост модулей. Пока мост не
 * снят (пункт 2 фазы 6), шов остаётся, и ставится он один раз, в `onload`.
 */
function publishPkmMacroRuntimeEntry() {
  const mod = require("./src/core/pkm_macro_runtime_entry.js");
  globalThis.__inlinePkmMacroRuntimeEntryMod = mod;
  globalThis.__inlineGetPkmMacroRuntime = (app_, normalizeOrderKeyLocal) => (
    mod.bootstrapMacroRuntime(app_, normalizeOrderKeyLocal)
  );
  return mod;
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

function normalizeOrderFieldKey(key) {
  const k = String(key || "").trim().replace(/\s+/g, " ");
  if (!k) return "";
  return /^[a-z0-9_\- ]+$/i.test(k) ? k : "";
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

/* Путь к настройке читают и пишут по обе стороны границы слоя
   оформления, поэтому правило живёт в общем модуле (У-32). */
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }
function writeCfgPath(root, path, value) { return __sharedUtils.writeCfgPath(root, path, value); }

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

/**
 * Метки элементов, какие завёл человек: `📅`, `⏰` и прочие.
 *
 * Берутся из конфига, а не из списка литералов: элемент — это Field, и его
 * метку человек меняет в панели.
 */
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
class InlineOverhaulPlugin extends Plugin {
  async onload() {
    /*
     * Модули плагина. Ждать было нечего и до правки: единственным путём
     * загрузки остался `require`, а он синхронный. Пятнадцать `await`
     * описывали ту загрузку, которой уже не было (A33).
     */
    publishPkmMacroRuntimeEntry();
    this.navRuntime = getNavigationRuntime();
    this.pkmRuntimeV2 = getPkmRuntimeV2();
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

      this.notice("inlineOverhaul renamed its commands, so hotkeys you had set for them are no longer bound."
        + " Set them again in Settings, Hotkeys, searching for inlineOverhaul."
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

  /**
   * Заново собрать всё, что плагин строит из конфига один раз — при загрузке.
   *
   * Зовётся одним местом — восстановлением копии настроек (10.13.40),
   * потому что только там конфиг меняется целиком и разом. Две вещи:
   *
   *   1. **Команды.** Набор команд PKM строится из Fields конфига (У-79):
   *      новый набор Fields без этого вызова получает команды только после
   *      перезапуска, и хоткей из копии ложится на команду, которой ещё нет.
   *   2. **Место служебного файла.** Копия несёт в себе
   *      `advanced.generatedRulesPath`, и у копии, снятой до переезда В-39, там
   *      стоит корень vault. Переезд живёт в `loadConfig` и идёт только при
   *      загрузке — поэтому после восстановления плагин до конца сеанса писал
   *      этот файл в корень vault, а следующий запуск его оттуда убирал.
   *      Именно это заказчик и видел: файл появился и пропал при перезапуске.
   *      Правило берётся там же, где и при загрузке —
   *      `moveGeneratedRulesIntoPluginFolder`, — а не пишется второй раз (У-32).
   *
   * Ни одна из двух неудач не отменяет восстановления: настройки уже записаны.
   */
  async rebuildFromConfig() {
    try {
      this.registerCommands();
    } catch (e) {
      console.error("[inline-overhaul] команды не перезавелись", e);
    }
    try {
      await this.reapplyGeneratedRulesLocation();
    } catch (e) {
      console.error("[inline-overhaul] место служебного файла не починилось", e);
    }
  }

  /**
   * Переезд служебного файла — ещё раз, после того как конфиг сменился
   * целиком. Своего правила здесь нет: решает та же функция миграции, что и при
   * загрузке, и со всеми теми же швами к файловой системе. Свой путь человека
   * она не трогает — только прежнее место и литеральные умолчания.
   */
  async reapplyGeneratedRulesLocation() {
    const adapter = this.app && this.app.vault ? this.app.vault.adapter : null;
    if (!adapter || typeof adapter.exists !== "function") return;
    const migration = getConfigMigrationV2Module();
    if (!migration || typeof migration.moveGeneratedRulesIntoPluginFolder !== "function") return;
    const files = {
      exists: (p) => adapter.exists(p),
      read: (p) => adapter.read(p),
      write: (p, data) => adapter.write(p, data),
      remove: (p) => adapter.remove(p),
    };
    /* Копия конфига: функция пишет в него прямо, а единственный путь
       записи в хранилище — `store.update` (CS10). */
    const probe = cloneJson(this.getConfig());
    const before = String(readCfgPath(probe, "advanced.generatedRulesPath") || "").trim();
    const move = await migration.moveGeneratedRulesIntoPluginFolder(
      files,
      this.pluginFolderPath(),
      probe,
      [__pkmOptionKeys.DEFAULT_RULES_PATH, __pkmOptionKeys.LEGACY_RULES_PATH],
    );
    if (!move || !move.path || move.path === before) return;
    this.store.update(
      (cfg) => {
        writeCfgPath(cfg, "advanced.generatedRulesPath", move.path);
        return cfg;
      },
      "restore:generated-rules-path",
    );
    await this.ensureGeneratedRulesNow("restore");
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
    this.navRuntime = getNavigationRuntime();
    return this.navRuntime;
  }

  async runNavGuard(moduleKey, action) {
    const cfg = this.getConfig();
    if (!cfg.features.navigation.enabled) {
      new Notice(__say(__noticeKey("navigation", "module-off"), "Navigation is switched off"));
      return;
    }
    const rt = await this.ensureNavRuntime();
    if (!rt) {
      new Notice(__say(__noticeKey("navigation", "runtime-unavailable"), "Navigation could not be loaded"));
      return;
    }
    const ed = this.getActiveEditor();
    if (!ed) {
      new Notice(__say(__noticeKey("navigation", "no-editor"), "Open a note first"));
      return;
    }
    try {
      return await Promise.resolve(action(ed, cfg.navigation || {}, cfg, rt));
    } catch (e) {
      console.error("[inline-overhaul][navigation]", e);
      new Notice(__say(__noticeKey("navigation", "error"), "Navigation error: {0}", e.message || e));
    }
  }

  async runPkmGuard(action) {
    const cfg = this.getConfig();
    if (!cfg.features.pkm.enabled) {
      new Notice(__say(__noticeKey("pkm", "module-off"), "Tags & PKM is switched off"));
      return;
    }
    const ed = this.getActiveEditor();
    if (!ed) {
      new Notice(__say(__noticeKey("pkm", "no-editor"), "Open a note first"));
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
      new Notice(__say(__noticeKey("pkm", "error"), "Tags & PKM error: {0}", e.message || e));
    }
  }

  async ensurePkmRuntimeV2() {
    if (this.pkmRuntimeV2 && typeof this.pkmRuntimeV2 === "object") return this.pkmRuntimeV2;
    this.pkmRuntimeV2 = getPkmRuntimeV2();
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
      this.notice(__say(__noticeKey("transform", "module-off"), "Transform is switched off"));
      return;
    }
    try {
      await Promise.resolve(getTransformFeature().runInline2Note(this, { Modal, lineFinalize: __transformLineFinalize }));
    } catch (e) {
      console.error("[inline-overhaul][transform]", e);
      this.notice(__say(__noticeKey("transform", "error"), "Transform error: {0}", e && e.message ? e.message : e));
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
    this.notice(__say(__noticeKey("plugin", "needs-obsidian"), "inlineOverhaul settings need Obsidian 1.13 or newer"));
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
