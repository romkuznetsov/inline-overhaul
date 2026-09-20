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
/* Подсветка места, куда прыгнул курсор (Н5): слой её рисует, а сказать ему,
   что прыжок случился, может только тот, через кого проходят все команды
   навигации, — то есть эта обёртка. */
const __editorDecorations = require("../ui/editor/decorations.js");
const __sayModule = require("../core/say.js");
const __say = __sayModule.say;
/* Ключ сообщения строит общий модуль: своей копии здесь нет (У-82). */
const __noticeKey = __sayModule.noticeKey;

const BINDER_SMART_BRACKET_COMMAND_ID = __configNormalize.BINDER_SMART_BRACKET_COMMAND_ID;
const FEATURE_META = __configNormalize.FEATURE_META;
const FEATURE_ORDER = __configNormalize.FEATURE_ORDER;
const normalizePkmOrder = __pkmOrderConfig.normalizePkmOrder;
const serializeDateRuntimeConfigForMacro = __pkmOrderConfig.serializeDateRuntimeConfigForMacro;
const serializePkmOrderForMacro = __pkmOrderConfig.serializePkmOrderForMacro;

function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

/**
 * Тихий отчёт об отказе загрузки — только при включённом флаге отладки.
 *
 * Отказ реестра команд не роняет плагин: справочник покажет пустую таблицу, а
 * человек — увидит плагин без части команд. Молчать об этом совсем нельзя,
 * кричать в консоль каждому — тоже.
 */
/* След запасного хода загрузки объявлен один раз — `reportLoaderFallback` в
   `shared_utils.js` (10.13.150). */
function reportLoaderFallback(stage, err) {
  return __sharedUtils.reportLoaderFallback(stage, err);
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
  return require("../navigation_runtime.js");
}

/** Движок PKM: команды Fields, TagWheel, даты и системная строка. */
function pkmRuntime() {
  return require("../pkm_runtime_v2.js");
}

/**
 * Область каждой семьи команд — **одно объявление на регистрацию и на
 * справочник** (его решение 2026-09-20).
 *
 * Имя, которым команда зарегистрирована, и имя, которое человек читает в
 * таблице, обязаны совпадать до знака: он ищет ровно то, что увидел (У-240). А
 * область в имени нужна затем, что экран `Hotkeys` Obsidian умеет отбирать
 * только по подстроке — набор команд его языком не выражается, и «покажи
 * команды этого заголовка» работает ровно тогда, когда у них есть общее слово.
 */
const COMMAND_AREAS = {
  core: "General",
  navigation: "Navigation",
  pkm: "Tags & PKM",
  transform: "Transform",
  binder: "Binder",
};

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
        name: __commandIds.commandDisplayName(area, String(d && d.name ? d.name : id)),
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
    push(registry.buildNavigationCommandDefs(plugin), COMMAND_AREAS.navigation, "");
    push(
      registry.buildPkmCommandDefs(
        serializePkmOrderForMacro,
        serializeDateRuntimeConfigForMacro,
        normalizePkmOrder,
        cfg,
        FEATURE_ORDER
      ),
      COMMAND_AREAS.pkm,
      (d) => {
        /* Команды TagWheel — не семья: их всегда ровно две, и в прототипе они
           названы поимённо. */
        if (!String(d && d.strictName ? d.strictName : "").trim()) return "";
        return d.direction === "decrease" ? "field-previous" : "field-next";
      }
    );
    push([{ id: "transform-inline-to-note", name: __commandIds.commandName("transform-inline-to-note") }],
      COMMAND_AREAS.transform, "");
    push(registry.buildBinderCommandDefs(cfg), COMMAND_AREAS.binder,
      (d) => (String(d && d.id ? d.id : "") === BINDER_SMART_BRACKET_COMMAND_ID ? "" : "binder-row"));
    push(registry.buildCoreCommandDefs(plugin, FEATURE_ORDER, FEATURE_META), COMMAND_AREAS.core,
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
        name: __commandIds.commandDisplayName(COMMAND_AREAS.core, d.name),
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
  const defs = registry.buildNavigationCommandDefs(plugin);
  if (!Array.isArray(defs) || !defs.length) {
    console.warn("[inline-overhaul] command registry unavailable: navigation commands skipped");
    return;
  }

  for (const d of defs) {
    plugin.addCommand({
      id: d.id,
      name: __commandIds.commandDisplayName(COMMAND_AREAS.navigation, d.name),
      callback: async () => {
        await runNavigationGuard(plugin, "navigation", d.run, d.jump);
      },
    });
  }
}

function registerPkm(plugin) {
  const registry = getCommandRegistry();
  const cfgNow = plugin.getConfig();
  const defs = registry.buildPkmCommandDefs(
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
      name: __commandIds.commandDisplayName(COMMAND_AREAS.pkm, d.name),
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
      name: __commandIds.commandDisplayName(COMMAND_AREAS.binder, String(d && d.name ? d.name : id)),
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
    name: __commandIds.commandDisplayName(COMMAND_AREAS.transform,
      __commandIds.commandName("transform-inline-to-note")),
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

/**
 * Курсор у этого редактора — в одном виде, чтобы его можно было сравнить.
 *
 * Пустота — законный ответ: редактор мог не отдать курсор вовсе, и тогда
 * сравнивать нечего, а не «курсор в начале». Это проба (правило отказов,
 * третий вид: ответ «нет» — это ответ).
 */
function cursorMarkOf(ed) {
  if (!ed || typeof ed.getCursor !== "function") return "";
  const cur = ed.getCursor();
  if (!cur) return "";
  return String(cur.line) + ":" + String(cur.ch);
}

/**
 * Дождаться, пока шаг доедет до курсора, и только тогда просить круг (Н5).
 *
 * **Замечание заказчика 2026-09-17:** «`jump-flash-inline` = on, не посвечивает
 * при прыжках в строке (`move cursor left/right in line`)». Переходы по
 * заголовкам при этом светились.
 *
 * Причина в том, что курсор ставят **двумя разными способами**. Переход по
 * заголовкам ставит его сразу и повторяет ещё дважды, а шаг внутри строки
 * кончается отложенным `setCursor` — иначе Obsidian возвращает каретку на
 * место после возврата из команды. Вопрос «переехал ли курсор», заданный
 * сразу за вызовом, описывает прежний экран (У-130), и ответ у шага внутри
 * строки был всегда «нет».
 *
 * Поэтому вопрос задаётся дважды: сразу — и, если курсор ещё стоит, ещё раз
 * следующим тактом. Отложенная постановка курсора заводится **внутри** вызова,
 * то есть раньше нашего такта, и порядок таймеров с одинаковым сроком задан.
 * Ждать дольше нечего: шаг, не сдвинувший курсор ни сразу, ни тактом позже,
 * его не сдвинул — и круга не получает.
 */
async function flashWhenCursorMoved(plugin, ed, before, jumpKind) {
  if (cursorMarkOf(ed) === before) {
    await new Promise((done) => { setTimeout(done, 0); });
    if (cursorMarkOf(ed) === before) return false;
  }
  return __editorDecorations.fireJumpFlash(plugin, jumpKind);
}

/**
 * Обёртка **всех** команд навигации, и через неё же проходит подсветка прыжка.
 *
 * `jumpKind` приходит из того же списка, где команды объявлены: `"jump"` у
 * переходов по заголовкам, `"inline"` у шагов внутри строки, пусто у
 * остальных. Своего списка идентификаторов здесь нет — он был бы вторым
 * объявлением того же правила (У-32), и признак по образцу ловил бы ровно те
 * имена, на которых его писали (У-201).
 *
 * **Круг рисуется только там, где курсор и правда переехал.** Команда,
 * упёршаяся в край или отказавшаяся, ничего не двигает, и подсвечивать ей
 * нечего: человек увидел бы вспышку там, где ничего не случилось.
 */
async function runNavigationGuard(plugin, moduleKey, action, jumpKind) {
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
  const before = jumpKind ? cursorMarkOf(ed) : "";
  try {
    const out = await Promise.resolve(action(ed, cfg.navigation || {}, cfg, rt));
    if (jumpKind) await flashWhenCursorMoved(plugin, ed, before, jumpKind);
    return out;
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
  /*
   * **Пока панель открыта, строкой распоряжается она, и больше никто.**
   *
   * Его замечание 2026-09-20: «при активации field-sub previous в строке у меня
   * не меняется sub на предыдущий, вместо этого курсор прыгает вниз и возникает
   * странный артефакт — визуально у меня на странице несколько кареток
   * курсора». Причина не в команде и не в панели по отдельности, а в том, что
   * они встретились: панель на время сессии держит **свой вид в самом
   * документе** (исключение 30 к З3), и команда правит не строку человека, а
   * эту картинку. Измерено стендом: при открытой панели `Cat_sub previous`
   * превращает `- ==**[Imp]** …==` в `- #elder :: текст`, панель остаётся
   * живой, а `Esc` возвращает исходную строку — то есть работа команды
   * пропадает целиком, и человек видит ровно то, что он описал.
   *
   * Панель перехватывает **свои** клавиши и только их; хоткей команды в её
   * раскладке не значится, поэтому до сюда он доходит. Отказ здесь громкий:
   * человек позвал команду сам, и молчание было бы неотличимо от дефекта
   * (правило отказов, вид первый).
   *
   * **Открытие панели из-под этого правила выведено**: второе нажатие той же
   * команды — это её `Enter`, им сессия и применяется.
   */
  if (String(command || "") !== "tagWheel" && openTagWheelSession()) {
    new Notice(__say(__noticeKey("pkm", "tagwheel-open"),
      "TagWheel is open on this line: finish it with Enter or close it with Escape first"));
    return;
  }
  const rt = await ensurePkmRuntime(plugin);
  if (!rt) throw new Error("PKM runtime v2 is unavailable");
  if (typeof rt.runCommand !== "function") throw new Error("PKM runtime v2 has no runCommand");

  const settings = {
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
    /* На каком Field открывается панель (10.13.76). */
    [__pkmOptionKeys.KEYS.TAGWHEEL_ACTIVE_FIELD_MODE]: readCfgPath(cfg, "visual.tagWheel.activeField.mode") || "first",
    [__pkmOptionKeys.KEYS.TAGWHEEL_ACTIVE_FIELD_LEFT]: readCfgPath(cfg, "visual.tagWheel.activeField.left") || "",
    [__pkmOptionKeys.KEYS.TAGWHEEL_ACTIVE_FIELD_RIGHT]: readCfgPath(cfg, "visual.tagWheel.activeField.right") || "",
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
function openTagWheelSession() {
  const holder = typeof window !== "undefined" ? window : globalThis;
  const state = holder && holder.__tagWheelState ? holder.__tagWheelState : null;
  return state && state.active === true ? state : null;
}

function closeTagWheelSession() {
  const state = openTagWheelSession();
  if (!state) return false;
  if (typeof state.cancel !== "function") return false;
  state.cancel();
  return true;
}

module.exports = {
  closeTagWheelSession,
  openTagWheelSession,
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
