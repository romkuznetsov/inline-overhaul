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

/*
 * Порядок Fields и нормализация конфига уехали в модули (кусок третий разбора
 * A3, 2026-09-07). Здесь остались имена, которые зовёт сам класс плагина.
 */
const __pkmOrderConfig = require("./src/core/pkm_order_config.js");
const __configNormalize = require("./src/core/config_normalize.js");
const __devLog = require("./src/core/dev_log.js");
const __editorStyles = require("./src/ui/editor/styles.js");
const PKM_ORDER_FIELDS = __pkmOrderConfig.PKM_ORDER_FIELDS;
const normalizePkmOrder = __pkmOrderConfig.normalizePkmOrder;
const serializePkmOrderForMacro = __pkmOrderConfig.serializePkmOrderForMacro;
const serializeDateRuntimeConfigForMacro = __pkmOrderConfig.serializeDateRuntimeConfigForMacro;
const BINDER_SMART_BRACKET_COMMAND_ID = __configNormalize.BINDER_SMART_BRACKET_COMMAND_ID;
const DEFAULT_CONFIG = __configNormalize.DEFAULT_CONFIG;
const FEATURE_META = __configNormalize.FEATURE_META;
const FEATURE_ORDER = __configNormalize.FEATURE_ORDER;
const getConfigMigrationV2Module = __configNormalize.getConfigMigrationV2Module;
const migrateConfig = __configNormalize.migrateConfig;

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

const SAVE_DEBOUNCE_MS = 250;
const UNDO_LIMIT = 20;

/* Путь к настройке читают и пишут по обе стороны границы слоя
   оформления, поэтому правило живёт в общем модуле (У-32). */
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }
function writeCfgPath(root, path, value) { return __sharedUtils.writeCfgPath(root, path, value); }

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
    __editorStyles.ensureTagwheelFill(this);
    __editorStyles.ensureStripLine(this);
    __editorStyles.ensureCaret(this);
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
    __editorStyles.removeAll(this);
    if (this.store) this.store.unload();
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

  /*
   * Журнал разработчика уехал в `src/core/dev_log.js` (кусок четвёртый разбора
   * `main.js`). Здесь остались три шва, и каждый нужен по своей причине:
   * `devLogEvent` зовут слой редактора и TagWheel через сам объект плагина, а
   * два других — точка входа, выгрузка и запись патча конфига.
   */
  devLogEvent(eventName, payload, level, cfg) {
    return __devLog.event(this, eventName, payload, level, cfg);
  }

  async initializeDevLogSession(cfg) {
    return __devLog.startSession(this, cfg);
  }

  async closeDevLogSession(cfg, forceWrite) {
    return __devLog.closeSession(this, cfg, forceWrite);
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
