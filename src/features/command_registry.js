"use strict";

const __pkmOptionKeys = (() => {
  try {
    if (typeof require === "function") {
      const mod = require("../core/pkm_option_keys.js");
      if (mod && typeof mod === "object" && mod.KEYS && typeof mod.KEYS === "object") return mod;
    }
  } catch (_) {}
  return {
    KEYS: {
      RULES_PATH: "Rules path",
      ACTION_TYPE: "Action type",
      SUBTAG_FORMAT: "Subtag format",
      CYCLE_END_BEHAVIOR: "Cycle end behavior",
      CURSOR_POLICY: "Cursor policy",
      ORDER_CONFIG: "Order config",
      DIRECTION: "Direction",
      DATE_RUNTIME_CONFIG: "Date runtime config",
    },
  };
})();

const __pkmDomainRegistry = (() => {
  try {
    if (typeof require === "function") {
      const mod = require("../core/pkm_domain_registry.js");
      if (mod && typeof mod === "object") return mod;
    }
  } catch (_) {}
  return {
    inferOrderFieldType: () => "tag",
  };
})();

function getBehaviorValue(cfg, key, dflt) {
  if (cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior[key] != null) return cfg.pkm.behavior[key];
  return dflt;
}

/*
 * Разделители строки для перехода по заголовкам.
 *
 * Режим `End of your text` ставит курсор перед вторым Separator, а Separator —
 * настройка вкладки `Tags & PKM`, не `Navigation`. Ветка `jumpToHeader` их не
 * содержит, поэтому они передаются отдельным аргументом. Читаются из конфига,
 * а не из заметки правил: заметка сама пишется из конфига, и лишний разбор
 * файла на каждое нажатие клавиши не нужен.
 */
function getLineFormat(cfg) {
  if (cfg && cfg.pkm && cfg.pkm.lineFormat && typeof cfg.pkm.lineFormat === "object") return cfg.pkm.lineFormat;
  return null;
}

/**
 * Имена макросов рантайма — контракт (`pkm_option_keys.js`), а ключ настройки
 * в конфиге версии 2 у формата дочернего тега другой: `childTagFormat` вместо
 * `subtagFormat` (PRD 8.1). Переводится здесь, одним местом.
 */
function getChildTagFormat(cfg) {
  return getBehaviorValue(cfg, "childTagFormat", "separate");
}

/**
 * Идентификаторы и имена команд живут одним модулем (PRD 7.2). Своей схемы
 * здесь больше нет: из трёх копий уже вырос дефект Б-11.
 */
const __commandIds = require("./command_ids.js");

function normalizeLabelPart(value, dflt) {
  const s = String(value || "").replace(/\s+/g, " ").trim();
  return s || dflt;
}

function buildCoreCommandDefs(plugin, featureOrder, featureMeta) {
  /*
   * Команды `Open settings` здесь больше нет: снята 2026-09-06 вместе с
   * вызовом `plugin.app.setting.open()` (T8, фаза 6 пункт 5). Настройки
   * плагина человек открывает штатным путём Obsidian, а `app.setting` — не
   * объявленное в `obsidian.d.ts` приватное API и типовая причина замечания на
   * community review. **Обратно её не возвращать** (7.2, решение 2026-08-24).
   *
   * Единственное разрешённое место `app.setting` в плагине — колонка хоткея в
   * справочнике команд (`custom/hotkeys.ts`, К-2): там оно за feature-detect и
   * `try/catch`, и без него кнопка просто неактивна.
   */
  const defs = [
    {
      id: "undo-last-settings-change",
      name: __commandIds.commandName("undo-last-settings-change"),
      run: () => {
        const ok = plugin.store.undo("command:undo");
        if (!ok) plugin.notice("InlineOverhaul: nothing to undo");
      },
    },
  ];

  const order = Array.isArray(featureOrder) ? featureOrder : [];
  const meta = featureMeta && typeof featureMeta === "object" ? featureMeta : {};
  for (const feature of order) {
    const label = meta[feature] && meta[feature].label ? meta[feature].label : feature;
    defs.push({
      id: __commandIds.featureToggleCommandId(feature),
      name: `Toggle ${label} module`,
      run: () => {
        const cfg = plugin.store.getSnapshot();
        const cur = !!cfg.features[feature].enabled;
        plugin.store.patch({ features: { [feature]: { enabled: !cur } } }, `toggle:${feature}`);
        plugin.notice(`${label}: ${!cur ? "enabled" : "disabled"}`);
      },
    });
  }

  return defs;
}

function buildNavigationCommandDefs(plugin, getActiveTagWheelRulesPath) {
  return [
    {
      id: "move-line-up",
      name: __commandIds.commandName("move-line-up"),
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.moveLine.enabled) return plugin.notice("MoveLine disabled in settings");
        if (!rt || typeof rt.moveLine !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.moveLine(ed, "up", nav.moveLine);
      },
    },
    {
      id: "move-line-down",
      name: __commandIds.commandName("move-line-down"),
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.moveLine.enabled) return plugin.notice("MoveLine disabled in settings");
        if (!rt || typeof rt.moveLine !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.moveLine(ed, "down", nav.moveLine);
      },
    },
    {
      id: "move-left",
      name: __commandIds.commandName("move-left"),
      run: (ed, nav, fullCfg, rt) => {
        if (!rt || typeof rt.moveSelection !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.moveSelection(ed, "left", nav.moveSelection, getLineFormat(fullCfg));
      },
    },
    {
      id: "move-right",
      name: __commandIds.commandName("move-right"),
      run: (ed, nav, fullCfg, rt) => {
        if (!rt || typeof rt.moveSelection !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.moveSelection(ed, "right", nav.moveSelection, getLineFormat(fullCfg));
      },
    },
    {
      id: "jump-back",
      name: __commandIds.commandName("jump-back"),
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.jumpToHeader.enabled) return plugin.notice("JumpToHeader disabled in settings");
        if (!rt || typeof rt.jumpToHeader !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.jumpToHeader(ed, "up", nav.jumpToHeader, getLineFormat(fullCfg));
      },
    },
    {
      id: "jump-next",
      name: __commandIds.commandName("jump-next"),
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.jumpToHeader.enabled) return plugin.notice("JumpToHeader disabled in settings");
        if (!rt || typeof rt.jumpToHeader !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.jumpToHeader(ed, "down", nav.jumpToHeader, getLineFormat(fullCfg));
      },
    },
    {
      id: "move-cursor-left-in-line",
      name: __commandIds.commandName("move-cursor-left-in-line"),
      run: async (ed, nav, fullCfg, rt) => {
        if (!nav.navigateInline.enabled) return plugin.notice("NavigateInline disabled in settings");
        if (!rt || typeof rt.loadNavigateRules !== "function" || typeof rt.navigateInline !== "function") {
          return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        }
        const rules = await rt.loadNavigateRules(plugin.app, getActiveTagWheelRulesPath(fullCfg));
        rt.navigateInline(ed, "left", rules, nav.navigateInline);
      },
    },
    {
      id: "move-cursor-right-in-line",
      name: __commandIds.commandName("move-cursor-right-in-line"),
      run: async (ed, nav, fullCfg, rt) => {
        if (!nav.navigateInline.enabled) return plugin.notice("NavigateInline disabled in settings");
        if (!rt || typeof rt.loadNavigateRules !== "function" || typeof rt.navigateInline !== "function") {
          return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        }
        const rules = await rt.loadNavigateRules(plugin.app, getActiveTagWheelRulesPath(fullCfg));
        rt.navigateInline(ed, "right", rules, nav.navigateInline);
      },
    },
  ];
}

function buildPkmCommandDefs(getActiveTagWheelRulesPath, serializePkmOrderForMacro, serializeDateRuntimeConfigForMacro, normalizePkmOrder, cfgNow, featureOrder) {
  const O = __pkmOptionKeys.KEYS;
  const cfg = cfgNow && typeof cfgNow === "object" ? cfgNow : {};
  const order = typeof normalizePkmOrder === "function"
    ? normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.fields ? cfg.pkm.fields.order : null)
    : { left: [], right: [], strictNames: {}, types: {} };
  const keys = [];
  const pushKey = (k) => {
    const key = String(k || "").trim();
    if (!key) return;
    if (/_sub$/.test(key)) {
      if (!keys.includes(key)) keys.push(key);
      return;
    }
    if (!keys.includes(key)) keys.push(key);
  };
  for (const k of (order.left || [])) pushKey(k);
  for (const k of (order.right || [])) pushKey(k);
  for (const k of Object.keys(order.strictNames || {})) pushKey(k);
  const subKeys = Object.keys(order.active || {}).filter((k) => /_sub$/.test(String(k || "").trim()));
  for (const k of subKeys) pushKey(k);

  const strictNameForKey = (key) => {
    const v = String(order && order.strictNames ? order.strictNames[key] || "" : "").trim();
    return v || key;
  };
  const commandStrictForKey = (key) => {
    const k = String(key || "").trim();
    if (!/_sub$/.test(k)) return strictNameForKey(k);
    const parent = k.slice(0, -4);
    const parentStrict = strictNameForKey(parent);
    const base = String(parentStrict || parent || k).trim();
    return `${base}-sub`;
  };
  const typeForKey = (key) => {
    const raw = String(order && order.types ? order.types[key] || "" : "").trim().toLowerCase();
    if (raw === "tag" || raw === "wikilink" || raw === "element") return raw;
    if (__pkmDomainRegistry && typeof __pkmDomainRegistry.inferOrderFieldType === "function") {
      return String(__pkmDomainRegistry.inferOrderFieldType(key) || "tag").trim() || "tag";
    }
    return "tag";
  };

  const buildActionSpec = (key, kind, dir) => {
    const direction = dir === "decrease" ? "decrease" : "increase";
    if (kind === "element") {
      return {
        v2Command: "statusDate",
        settings: {
          [O.ACTION_TYPE]: `${direction === "increase" ? "field_inc" : "field_dec"}:${key}`,
        },
      };
    }
    return {
      v2Command: "statusTags",
      settings: {
        [O.ACTION_TYPE]: `cycle_field:${key}`,
        [O.DIRECTION]: direction,
      },
    };
  };

  const makeBase = (cfgInner) => ({
    [O.RULES_PATH]: getActiveTagWheelRulesPath(cfgInner),
    [O.CYCLE_END_BEHAVIOR]: getBehaviorValue(cfgInner, "cycleEndBehavior", "keep-bullet"),
    [O.CURSOR_POLICY]: getBehaviorValue(cfgInner, "cursorPolicy", "text_end"),
    [O.ORDER_CONFIG]: serializePkmOrderForMacro(cfgInner),
  });

  const defs = [];
  /*
   * Идентификаторы команд полей разводятся между собой: `date_due` и
   * `date-due` дают один kebab, и без разводки вторая команда затёрла бы
   * первую. Набор занятых начинается с идентификаторов ядра — своя команда
   * поля не должна затенять навигацию.
   */
  const usedIds = __commandIds.reservedCommandIds(featureOrder);
  const pushDef = (strict, dir, orderKey, v2Command, makeExtra) => {
    const id = __commandIds.pkmFieldCommandId(strict, dir, usedIds);
    /*
     * В имени команды — **строгое имя Field** (`Name`), а не короткое имя для
     * TagWheel (`Name in TagWheel`).
     *
     * Так было не всегда: до 2026-09-04 имя собиралось из `labels`, то есть из
     * короткого имени, и заказчик написал ровно это — «название хедера fields
     * и название команд изменения родительского тега используются как в
     * io-field-short, но это неправильно: они должны быть как name-strict;
     * io-field-short должен влиять только на отображение field в TagWheel».
     * Команды дочернего Field при этом выглядели верно, и это не совпадение:
     * своего короткого имени у дочки нет, и `labels` для её ключа не
     * заполнялся — она и падала на строгое имя.
     *
     * Идентификатор команды строится из того же строгого имени и не меняется,
     * поэтому назначенный хоткей переименование по-прежнему переживает.
     */
    const shown = normalizeLabelPart(strict, "field");
    const strictLabel = shown;
    /*
     * Подпись и тип Field, под которым команду показывает справочник
     * (замечание заказчика 2026-08-31). Берётся РОДИТЕЛЬСКИЙ ключ: команды
     * дочернего Field стоят под тем же подзаголовком, что и родительские,
     * и тип у него тот же. Подпись — то же строгое имя, что и в самой
     * команде: иначе заголовок и строки под ним звали бы Field по-разному.
     */
    const parentKey = String(orderKey || "").replace(/_sub$/, "");
    const groupLabel = normalizeLabelPart(strictNameForKey(parentKey), "")
      || normalizeLabelPart(parentKey, "field");
    const dirLabel = __commandIds.directionLabel(dir);
    defs.push({
      id,
      /* Поле, из которого команда выросла: по нему её находит поиск хоткея
         (`detectDateFieldHotkeys`), а не по пересобранной строке. */
      orderKey: String(orderKey || ""),
      strictName: String(strict || ""),
      /* Для подзаголовка справочника: подпись Field и его тип. */
      groupLabel: String(groupLabel || ""),
      kind: String(typeForKey(parentKey) || ""),
      direction: dir === "decrease" ? "decrease" : "increase",
      name: `${strictLabel} ${dirLabel}`,
      v2Command,
      makeSettings: (cfgInner) => ({
        ...makeBase(cfgInner),
        ...(typeof makeExtra === "function" ? makeExtra(cfgInner) : {}),
      }),
    });
  };

  for (const key of keys) {
    const strict = commandStrictForKey(key);
    const kind = typeForKey(key);
    if (!strict) continue;
    const incSpec = buildActionSpec(key, kind, "increase");
    const decSpec = buildActionSpec(key, kind, "decrease");
    pushDef(strict, "increase", key, incSpec.v2Command, (cfgInner) => ({
      ...incSpec.settings,
      [O.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfgInner),
      ...(incSpec.v2Command === "statusDate" ? {} : { [O.SUBTAG_FORMAT]: getChildTagFormat(cfgInner) }),
    }));
    pushDef(strict, "decrease", key, decSpec.v2Command, (cfgInner) => ({
      ...decSpec.settings,
      [O.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfgInner),
      ...(decSpec.v2Command === "statusDate" ? {} : { [O.SUBTAG_FORMAT]: getChildTagFormat(cfgInner) }),
    }));
  }

  defs.push({
    id: "open-tagwheel-left",
    name: __commandIds.commandName("open-tagwheel-left"),
    v2Command: "tagWheel",
    makeSettings: (cfgInner) => ({
      ...makeBase(cfgInner),
      "Start setting": "left",
      "Start mode override": "left",
      [O.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfgInner),
      [O.SUBTAG_FORMAT]: getChildTagFormat(cfgInner),
    }),
  });
  defs.push({
    id: "open-tagwheel-right",
    name: __commandIds.commandName("open-tagwheel-right"),
    v2Command: "tagWheel",
    makeSettings: (cfgInner) => ({
      ...makeBase(cfgInner),
      "Start setting": "right",
      "Start mode override": "right",
      [O.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfgInner),
      [O.SUBTAG_FORMAT]: getChildTagFormat(cfgInner),
    }),
  });

  return defs;
}

function normalizeBinderRows(rawRows) {
  const src = Array.isArray(rawRows) ? rawRows : [];
  const out = [];
  for (const row of src) {
    if (!row || typeof row !== "object") continue;
    const rowId = String(row.rowId || "").trim();
    const insertText = String(row.insertText || "");
    const commandName = String(row.commandName || "");
    const description = String(row.description || "");
    const commandId = String(row.commandId || "").trim();
    if (!rowId || !commandId) continue;
    out.push({ rowId, insertText, commandName, description, commandId });
  }
  return out;
}

function runInsertTextCommand(plugin, insertText) {
  const ed = plugin && typeof plugin.getActiveEditor === "function" ? plugin.getActiveEditor() : null;
  if (!ed) return plugin && typeof plugin.notice === "function" ? plugin.notice("InlineOverhaul: no active editor") : null;
  const text = String(insertText || "");
  if (!text) return;
  const from = ed.getCursor("from");
  const to = ed.getCursor("to");
  ed.replaceRange(text, from, to);
  ed.setCursor({ line: from.line, ch: from.ch + text.length });
}

function runInsertBracketsCommand(plugin) {
  const ed = plugin && typeof plugin.getActiveEditor === "function" ? plugin.getActiveEditor() : null;
  if (!ed) return plugin && typeof plugin.notice === "function" ? plugin.notice("InlineOverhaul: no active editor") : null;

  const from = ed.getCursor("from");
  const to = ed.getCursor("to");
  const sel = ed.getSelection();

  if (sel) {
    if (sel.startsWith("[[") && sel.endsWith("]]")) {
      const inner = sel.slice(2, -2);
      ed.replaceRange(inner, from, to);
      ed.setSelection(from, { line: from.line, ch: from.ch + inner.length });
    } else if (sel.startsWith("[") && sel.endsWith("]")) {
      const inner = sel.slice(1, -1);
      ed.replaceRange("[[" + inner + "]]", from, to);
      ed.setSelection(from, { line: from.line, ch: from.ch + sel.length + 2 });
    } else {
      ed.replaceRange("[" + sel + "]", from, to);
      ed.setSelection(from, { line: from.line, ch: from.ch + sel.length + 2 });
    }
    return;
  }

  const line = ed.getLine(from.line);
  const before = line.slice(0, from.ch);
  const after = line.slice(from.ch);

  if (before.endsWith("[[") && after.startsWith("]]")) {
    const start = from.ch - 2;
    ed.replaceRange("", { line: from.line, ch: start }, { line: from.line, ch: from.ch + 2 });
    ed.setCursor({ line: from.line, ch: start });
  } else if (before.endsWith("[") && after.startsWith("]")) {
    const start = from.ch - 1;
    ed.replaceRange("[[]]", { line: from.line, ch: start }, { line: from.line, ch: from.ch + 1 });
    ed.setCursor({ line: from.line, ch: start + 2 });
  } else if (before.endsWith("[") && !after.startsWith("]")) {
    const start = from.ch - 1;
    const rest = after;
    ed.replaceRange("[[" + rest, { line: from.line, ch: start }, { line: from.line, ch: from.ch });
    ed.setCursor({ line: from.line, ch: start + 2 });
  } else if (before.endsWith("[[") && !after.startsWith("]")) {
    const start = from.ch - 2;
    const rest = after;
    ed.replaceRange("[" + rest, { line: from.line, ch: start }, { line: from.line, ch: from.ch });
    ed.setCursor({ line: from.line, ch: start + 1 });
  } else {
    ed.replaceRange("[]", from);
    ed.setCursor({ line: from.line, ch: from.ch + 1 });
  }
}

function buildBinderCommandDefs(cfgNow) {
  const cfg = cfgNow && typeof cfgNow === "object" ? cfgNow : {};
  const rows = normalizeBinderRows(cfg && cfg.editor && cfg.editor.binder ? cfg.editor.binder.rows : null);
  const defs = [];
  for (const row of rows) {
    const commandId = String(row.commandId || "").trim();
    if (!commandId) continue;
    if (commandId === __commandIds.SMART_BRACKET_COMMAND_ID) {
      defs.push({
        id: commandId,
        name: __commandIds.commandName(__commandIds.SMART_BRACKET_COMMAND_ID),
        run: (plugin) => runInsertBracketsCommand(plugin),
      });
      continue;
    }
    const binderNameSeed = normalizeLabelPart(row.commandName, "") || normalizeLabelPart(row.insertText, "item");
    defs.push({
      id: commandId,
      name: `${binderNameSeed}`,
      run: (plugin) => runInsertTextCommand(plugin, row.insertText),
    });
  }
  return defs;
}

module.exports = {
  buildCoreCommandDefs,
  buildNavigationCommandDefs,
  buildPkmCommandDefs,
  buildBinderCommandDefs,
};
