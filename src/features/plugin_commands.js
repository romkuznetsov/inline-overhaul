"use strict";

/**
 * Команды плагина: их регистрация, охрана и запуск движков.
 *
 * **Почему это один модуль** (кусок четвёртый разбора `main.js`, 2026-09-07).
 * Семнадцать команд заводятся пятью проходами по определениям из
 * `command_registry.js`, а тела у них не свои: каждая уходит в охрану —
 * `runNavigationGuard` или `runPkmGuard`, — и охрана делает одно и то же:
 * смотрит тумблер модуля, спрашивает редактор, ловит исключение и говорит
 * человеку словами. Разделять регистрацию и охрану значило бы развести по
 * файлам вызов и его тело.
 *
 * **Определения команд остались в `command_registry.js`**: этот модуль их не
 * придумывает, а раскладывает по `addCommand`. Второй список определений
 * разошёлся бы с первым молча — и разошёлся бы именно в справочнике команд,
 * куда человек приходит узнать правду (У-32).
 *
 * **`plugin` первым аргументом.** Регистрация зовёт `plugin.addCommand`,
 * охрана — `plugin.getConfig()` и активный редактор; состояние заведённых
 * команд (`_registeredPkmCommandIds`) висит на плагине, потому что живёт
 * столько же, сколько он.
 *
 * **Уведомления берут текст у каталога** (`__say`), а английское остаётся
 * здесь же вторым аргументом: слой настроек может не загрузиться, и человек
 * обязан увидеть сообщение, а не ключ.
 */

const { Modal, Notice } = require("obsidian");

const __commandIds = require("./command_ids.js");
const __configNormalize = require("../core/config_normalize.js");
const __pkmOptionKeys = require("../core/pkm_option_keys.js");
const __pkmOrderConfig = require("../core/pkm_order_config.js");
const __sharedUtils = require("../core/shared_utils.js");
const __transformLineFinalize = require("../core/pkm_line_finalize_unified.js");
const __say = require("../core/say.js").say;

const BINDER_SMART_BRACKET_COMMAND_ID = __configNormalize.BINDER_SMART_BRACKET_COMMAND_ID;
const DEFAULT_CONFIG = __configNormalize.DEFAULT_CONFIG;
const FEATURE_META = __configNormalize.FEATURE_META;
const FEATURE_ORDER = __configNormalize.FEATURE_ORDER;
const normalizePkmOrder = __pkmOrderConfig.normalizePkmOrder;
const serializeDateRuntimeConfigForMacro = __pkmOrderConfig.serializeDateRuntimeConfigForMacro;
const serializePkmOrderForMacro = __pkmOrderConfig.serializePkmOrderForMacro;

function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

/** Ключ сообщения. Строит его одна функция, и её зовут оба конца (У-82). */
function __noticeKey(area, name) {
  return "notice." + area + "." + name;
}

/**
 * Тихий отчёт об отказе загрузки — только при включённом флаге отладки.
 *
 * Отказ реестра команд не роняет плагин: справочник покажет пустую таблицу, а
 * человек — увидит плагин без части команд. Молчать об этом совсем нельзя,
 * кричать в консоль каждому — тоже.
 */
function reportLoaderFallback(stage, err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return;
    const msg = err && err.message ? String(err.message) : String(err || "");
    console.warn(`[inline-overhaul][loader] ${stage}: ${msg}`);
  } catch (_) {}
}

/** Реестр команд: определения для ядра, навигации, PKM и Binder (PRD 7.2). */
function getCommandRegistry() {
  return require("./command_registry.js");
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
  return require("./transform_feature.js");
}

/** Движок навигации: переходы, перенос строк, курсор внутри строки. */
function navigationRuntime() {
  return require("../../navigation_runtime.js");
}

/** Движок PKM: команды Fields, TagWheel, даты и системная строка. */
function pkmRuntime() {
  return require("../../pkm_runtime_v2.js");
}

/**
 * Путь служебного файла правил, каким его видит движок **сейчас**.
 *
 * Человек может увести файл в свою папку (`advanced.generatedRulesPath`);
 * пусто — умолчание из схемы. Спрашивается это в одном месте, потому что
 * ответ нужен и командам, и справочнику, и восстановлению копии (У-32).
 */
function activeRulesPath(cfg) {
  const generated = String(readCfgPath(cfg, "advanced.generatedRulesPath") || "").trim();
  if (generated) return generated;
  return String(DEFAULT_CONFIG.pkm.generatedRulesPath);
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
    push(registry.buildNavigationCommandDefs(plugin, activeRulesPath), "Navigation", "");
    push(
      registry.buildPkmCommandDefs(
        activeRulesPath,
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
    reportLoaderFallback("commands.buildOwnCommandList", e);
    return [];
  }
  return out;
}

/**
 * Все команды плагина: справочнику 10.5 и никому больше. Работа — в
 * `buildOwnCommandList`, чтобы проверка могла позвать её без Obsidian и без
 * своей копии тех же правил.
 */
function ownCommandList(plugin) {
  return buildOwnCommandList(plugin);
}

function registerAll(plugin) {
  const registry = getCommandRegistry();
  const coreDefs = registry.buildCoreCommandDefs(plugin, FEATURE_ORDER, FEATURE_META);
  if (!Array.isArray(coreDefs) || !coreDefs.length) {
    console.warn("[inline-overhaul] command registry unavailable: core commands skipped");
  } else {
    for (const d of coreDefs) {
      plugin.addCommand({
        id: d.id,
        name: d.name,
        callback: async () => {
          await d.run(plugin);
        },
      });
    }
  }

  registerNavigation(plugin);
  registerPkm(plugin);
  registerBinder(plugin);
  registerTransform(plugin);
}

function registerNavigation(plugin) {
  const registry = getCommandRegistry();
  const defs = registry.buildNavigationCommandDefs(plugin, activeRulesPath);
  if (!Array.isArray(defs) || !defs.length) {
    console.warn("[inline-overhaul] command registry unavailable: navigation commands skipped");
    return;
  }

  for (const d of defs) {
    plugin.addCommand({
      id: d.id,
      name: d.name,
      callback: async () => {
        await runNavigationGuard(plugin, "navigation", d.run);
      },
    });
  }
}

function registerPkm(plugin) {
  const registry = getCommandRegistry();
  const cfgNow = plugin.getConfig();
  const defs = registry.buildPkmCommandDefs(
    activeRulesPath,
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

  plugin._registeredPkmCommandIds = plugin._registeredPkmCommandIds || new Set();

  for (const d of defs) {
    const id = String(d && d.id ? d.id : "").trim();
    if (!id) continue;
    if (plugin._registeredPkmCommandIds.has(id)) continue;
    plugin.addCommand({
      id,
      name: d.name,
      callback: async () => {
        await runPkmGuard(plugin, async (cfg) => {
          const macroSettings = d.makeSettings(cfg);
          await runPkmRuntime(plugin, d.v2Command, cfg, macroSettings);
        });
      },
    });
    plugin._registeredPkmCommandIds.add(id);
  }
}

function registerBinder(plugin) {
  const registry = getCommandRegistry();
  const cfgNow = plugin.getConfig();
  const defs = registry.buildBinderCommandDefs(cfgNow);
  if (!Array.isArray(defs) || !defs.length) {
    console.warn("[inline-overhaul] command registry unavailable: binder commands skipped");
    return;
  }

  plugin._registeredBinderCommandIds = plugin._registeredBinderCommandIds || new Set();
  for (const d of defs) {
    const id = String(d && d.id ? d.id : "").trim();
    if (!id) continue;
    if (plugin._registeredBinderCommandIds.has(id)) continue;
    plugin.addCommand({
      id,
      name: String(d && d.name ? d.name : id),
      callback: async () => {
        await Promise.resolve(d.run(plugin));
      },
    });
    plugin._registeredBinderCommandIds.add(id);
  }
}

function registerTransform(plugin) {
  plugin.addCommand({
    id: "transform-inline-to-note",
    name: __commandIds.commandName("transform-inline-to-note"),
    callback: async () => { await runInlineToNote(plugin); },
  });
}

/**
 * Превратить строку в заметку.
 *
 * Метод, а не тело обработчика команды: то же самое делает `Floating button`
 * (10.13.12 Н9), и два входа в одну работу однажды разошлись бы — проверка
 * модуля есть у одного, обработка ошибки у другого. Здесь один вход.
 */
async function runInlineToNote(plugin) {
  const cfg = plugin.getConfig();
  if (!cfg.features.transform.enabled) {
    plugin.notice(__say(__noticeKey("transform", "module-off"), "Transform is switched off"));
    return;
  }
  try {
    await Promise.resolve(getTransformFeature().runInline2Note(plugin, { Modal, lineFinalize: __transformLineFinalize }));
  } catch (e) {
    console.error("[inline-overhaul][transform]", e);
    plugin.notice(__say(__noticeKey("transform", "error"), "Transform error: {0}", e && e.message ? e.message : e));
  }
}

async function ensureNavigationRuntime(plugin) {
  if (plugin.navRuntime && typeof plugin.navRuntime === "object") return plugin.navRuntime;
  plugin.navRuntime = navigationRuntime();
  return plugin.navRuntime;
}

async function runNavigationGuard(plugin, moduleKey, action) {
  const cfg = plugin.getConfig();
  if (!cfg.features.navigation.enabled) {
    new Notice(__say(__noticeKey("navigation", "module-off"), "Navigation is switched off"));
    return;
  }
  const rt = await ensureNavigationRuntime(plugin);
  if (!rt) {
    new Notice(__say(__noticeKey("navigation", "runtime-unavailable"), "Navigation could not be loaded"));
    return;
  }
  const ed = plugin.getActiveEditor();
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

async function runPkmGuard(plugin, action) {
  const cfg = plugin.getConfig();
  if (!cfg.features.pkm.enabled) {
    new Notice(__say(__noticeKey("pkm", "module-off"), "Tags & PKM is switched off"));
    return;
  }
  const ed = plugin.getActiveEditor();
  if (!ed) {
    new Notice(__say(__noticeKey("pkm", "no-editor"), "Open a note first"));
    return;
  }
  try {
    return await Promise.resolve(action(cfg));
  } catch (e) {
    plugin.devLogEvent("pkm.guard.error", {
      message: String(e && e.message ? e.message : e || ""),
      stack: e && e.stack ? String(e.stack) : "",
    }, "error", cfg);
    console.error("[inline-overhaul][pkm]", e);
    new Notice(__say(__noticeKey("pkm", "error"), "Tags & PKM error: {0}", e.message || e));
  }
}

async function ensurePkmRuntime(plugin) {
  if (plugin.pkmRuntimeV2 && typeof plugin.pkmRuntimeV2 === "object") return plugin.pkmRuntimeV2;
  plugin.pkmRuntimeV2 = pkmRuntime();
  return plugin.pkmRuntimeV2;
}

async function runPkmRuntime(plugin, command, cfg, extraSettings) {
  const rt = await ensurePkmRuntime(plugin);
  if (!rt) throw new Error("PKM runtime v2 is unavailable");
  if (typeof rt.runCommand !== "function") throw new Error("PKM runtime v2 has no runCommand");

  const settings = {
    [__pkmOptionKeys.KEYS.RULES_PATH]: activeRulesPath(cfg),
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
    app: plugin.app,
    command,
    settings,
    Notice,
    devLog: (event, payload) => plugin.devLogEvent(event, payload, "info", cfg),
  }));
}

/**
 * Закрыть открытую сессию TagWheel — при выгрузке плагина (Д-2 разбора
 * готовности, 2026-09-08).
 *
 * **Зачем это здесь.** Панель TagWheel вешает `keydown` на этап перехвата, а
 * снимает обработчик только её собственное закрытие. `onunload` про сессию не
 * знал ничего: человек выключал плагин с открытой панелью — и перехват
 * продолжал съедать стрелки и Enter до перезагрузки окна. Строка при этом
 * оставалась с видом панели в тексте заметки.
 *
 * **Своего правила закрытия здесь нет.** Функция спрашивает у самой сессии её
 * `cancel` — тот же ход, которым панель закрывает `Esc`. Написать закрытие
 * вторым объявлением («снять обработчик и вернуть строку») значило бы завести
 * второй ответ на вопрос «как закрывается панель», и он разошёлся бы с первым
 * молча (У-32).
 *
 * **Живость спрашивается у флага сессии**, а не у наличия объекта: шов
 * `window.__tagWheelState` живёт с первого открытия панели и после закрытия
 * остаётся на месте с `active: false` — так его и читает сама панель, решая,
 * открыта она уже или нет.
 *
 * Отвечает `true`, если сессию закрыли: по этому и проверяется.
 */
function closeTagWheelSession() {
  const holder = typeof window !== "undefined" ? window : globalThis;
  const state = holder && holder.__tagWheelState ? holder.__tagWheelState : null;
  if (!state || state.active !== true) return false;
  if (typeof state.cancel !== "function") return false;
  state.cancel();
  return true;
}

module.exports = {
  activeRulesPath,
  closeTagWheelSession,
  navigationRuntime,
  pkmRuntime,
  buildOwnCommandList,
  ownCommandList,
  registerAll,
  registerNavigation,
  registerPkm,
  registerBinder,
  registerTransform,
  runInlineToNote,
  ensureNavigationRuntime,
  runNavigationGuard,
  runPkmGuard,
  ensurePkmRuntime,
  runPkmRuntime,
};
