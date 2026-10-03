"use strict";

/**
 * Команды плагина: регистрация, охрана (`runNavigationGuard` / `runPkmGuard`:
 * тумблер модуля, редактор, исключение, сообщение человеку) и запуск движков —
 * одним модулем, чтобы не разводить вызов и тело (разбор `main.js`, 2026-09-07).
 * Определения — только в `command_registry.js` (У-32). Состояние заведённых
 * команд висит на `plugin`. Уведомления — через каталог (`__say`), английское
 * вторым аргументом: слой настроек может не загрузиться.
 */

const { Modal, Notice } = require("obsidian");
/* `isolateHistory` — с того экземпляра, где история редактора: Obsidian отдаёт
 * плагинам свой `@codemirror/commands` (`app.js` 1.13.7, `c4`). */
const cmCommands = require("@codemirror/commands");

const __commandIds = require("./command_ids.js");
const __commandField = require("./command_field.js");
const __configNormalize = require("../core/config_normalize.js");
const __pkmOptionKeys = require("../core/pkm_option_keys.js");
const __pkmOrderConfig = require("../core/pkm_order_config.js");
const __sharedUtils = require("../core/shared_utils.js");
/* Помощники общего дома — без обёрток-передатчиков (У-9 ревизии 09-26). */
const { isObj } = __sharedUtils;
/* Отказ реестра команд не роняет плагин; след — общего дома, только при флаге отладки (10.13.150). */
const reportLoaderFallback = __sharedUtils.reportLoaderFallback;
const __transformLineFinalize = require("../core/pkm_line_finalize_unified.js");
/* Подсветка прыжка (Н5): о прыжке слою может сказать только эта обёртка. */
const __editorDecorations = require("../ui/editor/decorations.js");
const __runtimeSettings = require("../core/runtime_settings.js");
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

/** Реестр команд: определения для ядра, навигации, PKM и Binder (PRD 7.2). */
function getCommandRegistry() {
  return require("./command_registry.js");
}

/**
 * Transform: движок и умолчания ветки. Заглушки нет намеренно: на ней умолчания
 * досыпала бы схема, и Transform включался бы из коробки (В-7).
 */
function getTransformFeature() {
  return require("./transform_feature.js");
}

/** Движок навигации: переходы, перенос строк, курсор внутри строки. */
function navigationRuntime() {
  return require("../navigation_runtime.js");
}

/** Движок PKM: команды Fields, tagWheel, даты и системная строка. */
function pkmRuntime() {
  return require("../pkm_runtime_v2.js");
}

/**
 * Область каждой семьи команд — одно объявление на регистрацию и справочник
 * (2026-09-20, У-240). Область в имени нужна: `Hotkeys` Obsidian отбирает только
 * по подстроке.
 */
const COMMAND_AREAS = {
  core: "General",
  navigation: "Navigation",
  pkm: "Tags & PKM",
  transform: "Transform",
  binder: "Binder",
};

/**
 * Все команды плагина для справочника 10.5 — из того же реестра, что регистрация;
 * проверка зовёт эту же функцию. `area` — область, `family` — «одна из многих
 * одинаковых» (пара Field, строка Binder, тумблер модуля): по ним справочник
 * разворачивает шаблонные строки прототипа. Отказ реестра — пустой список.
 */
function buildOwnCommandList(plugin) {
  const registry = getCommandRegistry();
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : {};
  const out = [];
  const push = (defs, area, family) => {
    for (const d of Array.isArray(defs) ? defs : []) {
      const id = String(d && d.id ? d.id : "").trim();
      if (!id) continue;
      /* `group` и `sub` — для справочника: команды Field рядом, дочерние за
       * родительскими (1.2.3.4.3); только у определений со `strictName`. */
      /* Подпись дочернего Field — через ДЕФИС (`type-sub`, `commandStrictForKey`), а
       * ключ Order оканчивается на `_sub`. */
      const strict = String(d && d.strictName ? d.strictName : "").trim();
      const isSub = /[-_]sub$/.test(strict);
      const display = __commandIds.commandDisplayName(area, String(d && d.name ? d.name : id));
      out.push({
        id,
        name: display,
        /* Имя без области (2026-09-22, п. 6) — здесь, рядом с приписыванием (У-32). */
        short: __commandIds.commandShortName(area, display),
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
        /* Команды tagWheel Left и Right названы в прототипе поимённо; у
           custom block своя семья — их столько, сколько блоков (10.13.260). */
        if (d && d.customBlock) return "tagwheel-custom";
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

/** Все команды плагина для справочника 10.5; работа — в `buildOwnCommandList`. */
function ownCommandList(plugin) {
  return buildOwnCommandList(plugin);
}

/**
 * Фокус в свойствах или заголовке заметки, а не в тексте. Платформа не даёт
 * исполниться `editorCallback` (`app.js` 1.13.7: `inlineTitleEl`, `titleEl`,
 * `.metadata-container`), а наши команды заведены через `callback` (H3.1).
 * Ответ как у платформы: команда молчит.
 */
function focusOutsideNoteText() {
  /* `activeDocument` — документ окна, где фокус (у вынесенного окна свой). */
  const doc = globalThis.activeDocument || globalThis.document || null;
  const el = doc ? doc.activeElement : null;
  return !!(el && typeof el.closest === "function" && el.closest(".metadata-container, .inline-title, .view-header-title"));
}

/**
 * Вход команды текста: фокус вне текста — молчит; иначе своя ступень отмены.
 * История CM склеивает правку без `userEvent` с набором быстрее `newGroupDelay`
 * (`addChanges`), и `Ctrl+Z` снимал и набранное (H2.3). Пустая транзакция с
 * `isolateHistory` = `before` закрывает группу набора. Стенд — `undo-after-typing`
 * в `tools/obsidian_bench.js`.
 */
function textCommandBlocked(plugin) {
  if (focusOutsideNoteText()) return true;
  const ws = plugin && plugin.app ? plugin.app.workspace : null;
  const view = ws && ws.activeEditor && ws.activeEditor.editor ? ws.activeEditor.editor.cm : null;
  if (view && typeof view.dispatch === "function") view.dispatch({ annotations: cmCommands.isolateHistory.of("before") });
  return false;
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
        if (textCommandBlocked(plugin)) return;
        await runNavigationGuard(plugin, "navigation", d.run, d.jump);
      },
    });
  }
}

/**
 * Адрес команды Field строился из имени, теперь из ключа (В-275): у Field,
 * переименованного раньше, хоткей переезжает со старого адреса — один раз, при
 * загрузке. Служебное API хоткеев — как у восстановления копии (Б18).
 */
function carryRenamedFieldHotkeys(plugin, defs) {
  const hm = plugin && plugin.app ? plugin.app.hotkeyManager : null;
  /* Проба: служебного API может не быть — переносить нечем. */
  if (!hm || typeof hm.setHotkeys !== "function" || typeof hm.removeHotkeys !== "function" || !hm.customKeys) return;
  const prefix = (plugin.manifest && plugin.manifest.id ? plugin.manifest.id : "inline-overhaul") + ":";
  const live = new Set(defs.map((d) => String(d && d.id ? d.id : "")));
  let moved = false;
  for (const d of defs) {
    if (!d || !d.orderKey || !d.strictName) continue;
    const oldId = __commandIds.kebab(d.strictName) + "-" + __commandIds.directionLabel(d.direction);
    if (live.has(oldId)) continue;
    const keys = hm.customKeys[prefix + oldId];
    /* Назначенное после переименования — его последнее слово: сильнее мёртвого на адресе ключа. */
    if (!Array.isArray(keys) || !keys.length) continue;
    hm.setHotkeys(prefix + d.id, keys);
    hm.removeHotkeys(prefix + oldId);
    moved = true;
  }
  if (moved && typeof hm.save === "function") {
    Promise.resolve(hm.save()).catch((e) => console.error("[inline-overhaul] hotkeys.json not saved", e));
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

  if (!plugin._registeredPkmCommandIds) carryRenamedFieldHotkeys(plugin, defs);
  plugin._registeredPkmCommandIds = plugin._registeredPkmCommandIds || new Set();
  plugin._registeredPkmCommandNames = plugin._registeredPkmCommandNames || new Map();

  /* Снятые команды уходят (PRD 10.13.260): `removeCommand` с 1.7.2. Хоткей в
   * `hotkeys.json` остаётся мёртвым, как у любой снятой команды Obsidian. */
  const live = new Set(defs.map((d) => String(d && d.id ? d.id : "").trim()).filter(Boolean));
  for (const id of Array.from(plugin._registeredPkmCommandIds)) {
    if (live.has(id)) continue;
    if (typeof plugin.removeCommand === "function") plugin.removeCommand(id);
    plugin._registeredPkmCommandIds.delete(id);
    plugin._registeredPkmCommandNames.delete(id);
  }

  for (const d of defs) {
    const id = String(d && d.id ? d.id : "").trim();
    if (!id) continue;
    const name = __commandIds.commandDisplayName(COMMAND_AREAS.pkm, d.name);
    if (plugin._registeredPkmCommandIds.has(id)) {
      /* Имя сменилось — заводится заново с тем же id, хоткей остаётся. */
      if (plugin._registeredPkmCommandNames.get(id) === name) continue;
      if (typeof plugin.removeCommand === "function") plugin.removeCommand(id);
    }
    plugin.addCommand({
      id,
      name,
      callback: async () => {
        if (textCommandBlocked(plugin)) return;
        await runPkmGuard(plugin, async (cfg) => {
          /* Определение — из нынешнего конфига: Field мог переехать в custom block. */
          const fresh = registry.buildPkmCommandDefs(
            serializePkmOrderForMacro, serializeDateRuntimeConfigForMacro, normalizePkmOrder, cfg, FEATURE_ORDER
          ).find((x) => x && x.id === id) || d;
          if (fresh.commandField) {
            runCommandField(plugin, cfg, fresh);
            return;
          }
          if (fresh.orderKey && fresh.kind !== "element" && !registry.fieldHasValues(cfg, fresh.orderKey)) {
            new Notice(__say(__noticeKey("pkm", "no-values"), "{0} has no Values yet: add them in Tags & PKM → Fields", fresh.strictName || fresh.orderKey));
            return;
          }
          const macroSettings = fresh.makeSettings(cfg);
          await runPkmRuntime(plugin, fresh.v2Command, cfg, macroSettings);
        });
      },
    });
    plugin._registeredPkmCommandIds.add(id);
    plugin._registeredPkmCommandNames.set(id, name);
  }
}

/** Пара категории Command Field (4.4): правка текста одной транзакцией, без движков. */
function runCommandField(plugin, cfg, def) {
  const { key, category } = def.commandField;
  const got = __commandField.runInEditor(plugin.getActiveEditor(), cfg, key, category, def.direction === "decrease" ? -1 : 1);
  const name = def.name.replace(/ (next|previous)$/, "");
  if (got === "no-presets") {
    new Notice(__say(__noticeKey("pkm", "no-presets"), "{0} has no visible presets: add them in Tags & PKM → Fields", name));
  } else if (got === "nothing") {
    new Notice(__say(__noticeKey("pkm", "nothing-to-do"), "{0}: nothing to change on this line", name));
  } else if (got && got.refuse) {
    new Notice(__commandField.refusalText(got, name));
  }
}

function registerBinder(plugin) {
  const registry = getCommandRegistry();
  const cfgNow = plugin.getConfig();
  const defs = registry.buildBinderCommandDefs(cfgNow);
  if (!Array.isArray(defs)) {
    console.warn("[inline-overhaul] command registry unavailable: binder commands skipped");
    return;
  }

  plugin._registeredBinderCommandIds = plugin._registeredBinderCommandIds || new Set();
  plugin._registeredBinderCommandNames = plugin._registeredBinderCommandNames || new Map();
  /* Набор Binder идёт за настройками, как PKM (Д-1, BUGHUNT R3): текст вставки —
   * из нынешнего конфига, иначе после восстановления копии вставлялся прежний. */
  const live = new Set(defs.map((d) => String(d && d.id ? d.id : "").trim()).filter(Boolean));
  for (const id of Array.from(plugin._registeredBinderCommandIds)) {
    if (live.has(id)) continue;
    if (typeof plugin.removeCommand === "function") plugin.removeCommand(id);
    plugin._registeredBinderCommandIds.delete(id);
    plugin._registeredBinderCommandNames.delete(id);
  }
  for (const d of defs) {
    const id = String(d && d.id ? d.id : "").trim();
    if (!id) continue;
    const name = __commandIds.commandDisplayName(COMMAND_AREAS.binder, String(d && d.name ? d.name : id));
    if (plugin._registeredBinderCommandIds.has(id)) {
      if (plugin._registeredBinderCommandNames.get(id) === name) continue;
      if (typeof plugin.removeCommand === "function") plugin.removeCommand(id);
    }
    plugin.addCommand({
      id,
      name,
      callback: async () => {
        if (textCommandBlocked(plugin)) return;
        const fresh = registry.buildBinderCommandDefs(plugin.getConfig()).find((x) => x && x.id === id);
        if (fresh) await Promise.resolve(fresh.run(plugin));
      },
    });
    plugin._registeredBinderCommandIds.add(id);
    plugin._registeredBinderCommandNames.set(id, name);
  }
}

function registerTransform(plugin) {
  plugin.addCommand({
    id: "transform-inline-to-note",
    name: __commandIds.commandDisplayName(COMMAND_AREAS.transform,
      __commandIds.commandName("transform-inline-to-note")),
    callback: async () => { if (textCommandBlocked(plugin)) return; await runInlineToNote(plugin); },
  });
}

/** Превратить строку в заметку. Один вход и для `Floating button` (10.13.12 Н9). */
async function runInlineToNote(plugin) {
  const cfg = plugin.getConfig();
  if (!cfg.features.transform.enabled) {
    plugin.notice(__say(__noticeKey("transform", "module-off"), "Transform is switched off: turn it on in General → Modules"));
    return;
  }
  /* Ограда кода, код и таблица в заметку не превращаются (BUGHUNT T20). */
  const ed = plugin.getActiveEditor();
  if (ed && onCodeOrTableLine(ed)) {
    plugin.notice(__say(__noticeKey("transform", "code-line"), "Transform does not work in a code block, a table, note properties or a divider line"));
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

/** Курсор редактора в сравнимом виде; пусто — курсора нет (проба: «нет» — ответ). */
function cursorMarkOf(ed) {
  if (!ed || typeof ed.getCursor !== "function") return "";
  const cur = ed.getCursor();
  if (!cur) return "";
  return String(cur.line) + ":" + String(cur.ch);
}

/**
 * Дождаться, пока шаг доедет до курсора, и только тогда просить круг (Н5,
 * 2026-09-17). Шаг внутри строки ставит курсор отложенным `setCursor`, поэтому
 * вопрос «переехал ли» сразу за вызовом видит прежний экран (У-130). Спрашиваем
 * сразу и ещё раз следующим тактом: отложенный таймер заведён раньше нашего.
 */
async function flashWhenCursorMoved(plugin, ed, before, jumpKind) {
  if (cursorMarkOf(ed) === before) {
    await new Promise((done) => { setTimeout(done, 0); });
    if (cursorMarkOf(ed) === before) return false;
  }
  return __editorDecorations.fireJumpFlash(plugin, jumpKind);
}

/**
 * Обёртка всех команд навигации и подсветки прыжка. `jumpKind` — из списка
 * объявления команд: `"jump"`, `"inline"` или пусто; своего списка id нет
 * (У-32, У-201). Круг — только если курсор и правда переехал.
 */
async function runNavigationGuard(plugin, moduleKey, action, jumpKind) {
  const cfg = plugin.getConfig();
  if (!cfg.features.navigation.enabled) {
    new Notice(__say(__noticeKey("navigation", "module-off"), "Navigation is switched off: turn it on in General → Modules"));
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

/** Строка каретки — код или таблица (общее объявление, BUGHUNT R4). */
function onCodeOrTableLine(ed) {
  if (!ed || typeof ed.getCursor !== "function" || typeof ed.getLine !== "function") return false;
  return __sharedUtils.isCodeOrTableLine((n) => ed.getLine(n), ed.getCursor().line);
}

async function runPkmGuard(plugin, action) {
  const cfg = plugin.getConfig();
  if (!cfg.features.pkm.enabled) {
    new Notice(__say(__noticeKey("pkm", "module-off"), "Tags & PKM is switched off: turn it on in General → Modules"));
    return;
  }
  const ed = plugin.getActiveEditor();
  if (!ed) {
    new Notice(__say(__noticeKey("pkm", "no-editor"), "Open a note first"));
    return;
  }
  /* Блок кода и таблица — не строка текста: значения туда не пишутся (BUGHUNT F8). */
  if (onCodeOrTableLine(ed)) {
    new Notice(__say(__noticeKey("pkm", "code-line"), "Tags & PKM does not work in a code block, a table, note properties or a divider line"));
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

/**
 * Дата с пробелом после знака — та же дата (`В-243`). Движки под З3 знают только
 * `📅2026-09-30`, поэтому строки под каретками приходят к ним без пробела (F9):
 * шов один на команды полей и открытие tagWheel. Значение решает
 * `spacedMarkerValueGaps`; пишутся только снятые пробелы.
 */
function joinSpacedElementValues(plugin, cfg) {
  const byField = __sharedUtils.readCfgPath(cfg, "pkm.fields.elements.byField");
  if (!isObj(byField)) return;
  const marks = Object.values(byField).filter(isObj)
    .map((r) => ({ marker: String(r.emoji || "").trim(), format: String(r.format || "") }))
    .filter((m) => m.marker);
  if (!marks.length) return;
  const ws = plugin && plugin.app && plugin.app.workspace;
  const ed = ws && ws.activeEditor && ws.activeEditor.editor;
  /* Проба: редактора может не быть (панель, другое окно) — тогда и писать некуда. */
  if (!ed || typeof ed.getLine !== "function" || typeof ed.replaceRange !== "function") return;
  const sels = typeof ed.listSelections === "function" ? ed.listSelections() : [{ anchor: ed.getCursor(), head: ed.getCursor() }];
  const lines = new Set();
  for (const s of sels || []) {
    const a = Math.min(s.anchor.line, s.head.line);
    const b = Math.max(s.anchor.line, s.head.line);
    for (let n = a; n <= b; n++) lines.add(n);
  }
  for (const n of lines) {
    for (const g of __sharedUtils.spacedMarkerValueGaps(ed.getLine(n), marks)) {
      ed.replaceRange("", { line: n, ch: g.from }, { line: n, ch: g.to });
    }
  }
}

async function runPkmRuntime(plugin, command, cfg, extraSettings) {
  /*
   * Пока панель открыта, строкой распоряжается она: её вид лежит в документе
   * (исключение 30 к З3), и команда правила бы картинку (2026-09-20). Хоткей
   * команды панель не перехватывает, поэтому отказ здесь, громкий. Открытие
   * панели исключено: второе нажатие той же команды — её `Enter`.
   */
  if (String(command || "") !== "tagWheel" && openTagWheelSession()) {
    new Notice(__say(__noticeKey("pkm", "tagwheel-open"),
      "tagWheel is open on this line: finish it with Enter or close it with Escape first"));
    return;
  }
  const rt = await ensurePkmRuntime(plugin);
  if (!rt) throw new Error("PKM runtime v2 is unavailable");
  if (typeof rt.runCommand !== "function") throw new Error("PKM runtime v2 has no runCommand");
  joinSpacedElementValues(plugin, cfg);

  const settings = Object.assign(
    __runtimeSettings.runtimeSettingsFromConfig(cfg),
    isObj(extraSettings) ? extraSettings : {}
  );
  return await Promise.resolve(rt.runCommand({
    app: plugin.app,
    command,
    settings,
    Notice,
    devLog: (event, payload) => plugin.devLogEvent(event, payload, "info", cfg),
  }));
}

/**
 * Закрыть открытую сессию TagWheel при выгрузке (Д-2): иначе её `keydown` на
 * перехвате ест стрелки до перезагрузки окна. Закрытие — её же `cancel` (как
 * `Esc`), не своё (У-32). Живость — по флагу `active` у `window.__tagWheelState`:
 * объект остаётся после закрытия. `true` — сессию закрыли.
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
  textCommandBlocked,
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
  joinSpacedElementValues,
};
