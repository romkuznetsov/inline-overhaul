"use strict";

/*
 * Видимый текст по ключу каталога (PRD 10.13.50) — через общий помощник
 * `globalThis.__inlineSay`, своей копии нельзя (Б-11). Литеральный `require`
 * без запасного пути (У-89, У-90, A33): не приехал — падаем громко.
 */
const __sayModule = require("../core/say.js");
const __say = __sayModule.say;
/* Ключ сообщения строит общий модуль: своей копии здесь нет (У-82). */
const __noticeKey = __sayModule.noticeKey;

/*
 * Остальные модули — так же; заглушки на их месте были вторым объявлением
 * правила (У-32): рукописный `KEYS` и `inferOrderFieldType: () => "tag"`.
 */
const __pkmOptionKeys = require("../core/pkm_option_keys.js");

const __pkmDomainRegistry = require("../core/pkm_domain_registry.js");

/* Правила для движков — из настроек, тем же модулем, что служебная заметка (PRD 10.13.52, П-8). */
const __rulesShape = require("../core/pkm_rules_shape.js");
const __pkmOrderConfig = require("../core/pkm_order_config.js");

function getBehaviorValue(cfg, key, dflt) {
  if (cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior[key] != null) return cfg.pkm.behavior[key];
  return dflt;
}

/*
 * Разделители строки для перехода по заголовкам: `End of your text` ставит
 * курсор перед вторым Separator, а он — настройка `Tags & PKM`, не ветки
 * `jumpToHeader`. Из конфига, а не из заметки правил: без разбора файла на
 * каждое нажатие.
 */
function getLineFormat(cfg) {
  if (cfg && cfg.pkm && cfg.pkm.lineFormat && typeof cfg.pkm.lineFormat === "object") return cfg.pkm.lineFormat;
  return null;
}

/*
 * Форма строки для прыжков: разделители и метки элементов — без меток прыжок
 * «в конец текста» уезжал за дату (`S4`, 2026-09-12). Собирает та же функция, что для шага.
 */
function getJumpLineShape(cfg, rt) {
  const lf = getLineFormat(cfg);
  const base = lf && typeof lf === "object" ? { ...lf } : {};
  /*
   * Без меток прыжок молча становится другим (10.13.167, `S4`): не пропускать.
   * Обе команды прыжка спрашивают движок тем же вопросом и говорят `Notice`.
   */
  if (!rt || typeof rt.buildNavigateRules !== "function") {
    throw new Error("navigation_runtime unavailable: buildNavigateRules");
  }
  const rules = rt.buildNavigateRules(cfg);
  if (rules && Array.isArray(rules.trailingMarkers)) base.markers = rules.trailingMarkers.slice();
  return base;
}

/**
 * Имена макросов — контракт (`pkm_option_keys.js`), а ключ в конфиге v2 другой:
 * `childTagFormat` вместо `subtagFormat` (PRD 8.1). Переводится здесь.
 */
function getChildTagFormat(cfg) {
  return getBehaviorValue(cfg, "childTagFormat", "separate");
}

/** Идентификаторы и имена команд — один модуль (PRD 7.2, Б-11). */
const __commandIds = require("./command_ids.js");

function normalizeLabelPart(value, dflt) {
  const s = String(value || "").replace(/\s+/g, " ").trim();
  return s || dflt;
}

/**
 * Шагу внутри строки нужна `Cursor position after jumping` (2026-09-12): одна
 * строка на прыжок и на шаг в текст. Здесь значение только передаётся; смысл —
 * `textEntryAnchor` в движке (У-32).
 */
function withTextEntry(nav) {
  const inline = nav && typeof nav.navigateInline === "object" ? nav.navigateInline : {};
  const jump = nav && typeof nav.jumpToHeader === "object" ? nav.jumpToHeader : {};
  return { ...inline, jumpCursorPosition: jump.jumpCursorPosition };
}

function buildCoreCommandDefs(plugin, featureOrder, featureMeta) {
  /*
   * Команды `Open settings` нет: `app.setting` — приватное API, повод замечания
   * community review (T8; 7.2, решение 2026-08-24). Не возвращать. Единственное
   * место `app.setting` — колонка хоткея (`custom/hotkeys.ts`, К-2).
   */
  const defs = [
    {
      id: "undo-last-settings-change",
      name: __commandIds.commandName("undo-last-settings-change"),
      run: () => {
        const ok = plugin.store.undo("command:undo");
        /* Удача тоже говорит вслух (BUGHUNT S20). */
        if (!ok) plugin.notice(__say(__noticeKey("plugin", "nothing-to-undo"), "Nothing to undo"));
        else plugin.notice(__say(__noticeKey("plugin", "undone"), "Last settings change undone"));
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

/* Пути файла правил нет: курсор внутри строки берёт правила из настроек — `rt.buildNavigateRules(fullCfg)` (PRD 10.13.52, П-8). */
function buildNavigationCommandDefs(plugin) {
  return [
    {
      id: "move-line-up",
      name: __commandIds.commandName("move-line-up"),
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.moveLine.enabled) return plugin.notice("MoveLine disabled in settings");
        if (!rt || typeof rt.moveLine !== "function") return plugin.notice(__say(__noticeKey("navigation", "runtime-unavailable"), "Navigation could not be loaded"));
        rt.moveLine(ed, "up", nav.moveLine);
      },
    },
    {
      id: "move-line-down",
      name: __commandIds.commandName("move-line-down"),
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.moveLine.enabled) return plugin.notice("MoveLine disabled in settings");
        if (!rt || typeof rt.moveLine !== "function") return plugin.notice(__say(__noticeKey("navigation", "runtime-unavailable"), "Navigation could not be loaded"));
        rt.moveLine(ed, "down", nav.moveLine);
      },
    },
    {
      id: "move-left",
      name: __commandIds.commandName("move-left"),
      run: (ed, nav, fullCfg, rt) => {
        if (!rt || typeof rt.moveSelection !== "function") return plugin.notice(__say(__noticeKey("navigation", "runtime-unavailable"), "Navigation could not be loaded"));
        rt.moveSelection(ed, "left", nav.moveSelection, getLineFormat(fullCfg));
      },
    },
    {
      id: "move-right",
      name: __commandIds.commandName("move-right"),
      run: (ed, nav, fullCfg, rt) => {
        if (!rt || typeof rt.moveSelection !== "function") return plugin.notice(__say(__noticeKey("navigation", "runtime-unavailable"), "Navigation could not be loaded"));
        rt.moveSelection(ed, "right", nav.moveSelection, getLineFormat(fullCfg));
      },
    },
    {
      id: "jump-back",
      name: __commandIds.commandName("jump-back"),
      /* Прыжок: подсветка Н5 спрашивает об этом здесь, а не по идентификатору. */
      jump: "jump",
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.jumpToHeader.enabled) return plugin.notice("JumpToHeader disabled in settings");
        if (!rt || typeof rt.jumpToHeader !== "function" || typeof rt.buildNavigateRules !== "function") {
          return plugin.notice(__say(__noticeKey("navigation", "runtime-unavailable"), "Navigation could not be loaded"));
        }
        rt.jumpToHeader(ed, "up", nav.jumpToHeader, getJumpLineShape(fullCfg, rt));
      },
    },
    {
      id: "jump-next",
      name: __commandIds.commandName("jump-next"),
      /* Прыжок: подсветка Н5 спрашивает об этом здесь, а не по идентификатору. */
      jump: "jump",
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.jumpToHeader.enabled) return plugin.notice("JumpToHeader disabled in settings");
        if (!rt || typeof rt.jumpToHeader !== "function" || typeof rt.buildNavigateRules !== "function") {
          return plugin.notice(__say(__noticeKey("navigation", "runtime-unavailable"), "Navigation could not be loaded"));
        }
        rt.jumpToHeader(ed, "down", nav.jumpToHeader, getJumpLineShape(fullCfg, rt));
      },
    },
    {
      id: "move-cursor-left-in-line",
      name: __commandIds.commandName("move-cursor-left-in-line"),
      /* Прыжок: подсветка Н5 спрашивает об этом здесь, а не по идентификатору. */
      jump: "inline",
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.navigateInline.enabled) return plugin.notice("NavigateInline disabled in settings");
        if (!rt || typeof rt.buildNavigateRules !== "function" || typeof rt.navigateInline !== "function") {
          return plugin.notice(__say(__noticeKey("navigation", "runtime-unavailable"), "Navigation could not be loaded"));
        }
        rt.navigateInline(ed, "left", rt.buildNavigateRules(fullCfg), withTextEntry(nav));
      },
    },
    {
      id: "move-cursor-right-in-line",
      name: __commandIds.commandName("move-cursor-right-in-line"),
      /* Прыжок: подсветка Н5 спрашивает об этом здесь, а не по идентификатору. */
      jump: "inline",
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.navigateInline.enabled) return plugin.notice("NavigateInline disabled in settings");
        if (!rt || typeof rt.buildNavigateRules !== "function" || typeof rt.navigateInline !== "function") {
          return plugin.notice(__say(__noticeKey("navigation", "runtime-unavailable"), "Navigation could not be loaded"));
        }
        rt.navigateInline(ed, "right", rt.buildNavigateRules(fullCfg), withTextEntry(nav));
      },
    },
  ];
}

function buildPkmCommandDefs(serializePkmOrderForMacro, serializeDateRuntimeConfigForMacro, normalizePkmOrder, cfgNow, featureOrder) {
  const O = __pkmOptionKeys.KEYS;
  const cfg = cfgNow && typeof cfgNow === "object" ? cfgNow : {};
  const order = typeof normalizePkmOrder === "function"
    ? normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.fields ? cfg.pkm.fields.order : null)
    : { left: [], right: [], strictNames: {}, types: {} };
  /* Ключи и строгие имена — у `command_ids`: тот же список нужен Binder (BUGHUNT K1). */
  const seeds = __commandIds.pkmCommandSeeds(order);

  const strictNameForKey = (key) => {
    const v = String(order && order.strictNames ? order.strictNames[key] || "" : "").trim();
    return v || key;
  };
  const typeForKey = (key) => {
    const raw = String(order && order.types ? order.types[key] || "" : "").trim().toLowerCase();
    if (raw === "tag" || raw === "wikilink" || raw === "element") return raw;
    /* Тот же вопрос, что у `pkm_order_config.js`; запасное «всегда тег» перепутало
       бы тип каждого Field типа link (У-159). */
    if (!__pkmDomainRegistry || typeof __pkmDomainRegistry.inferOrderFieldType !== "function") {
      throw new Error("pkm_domain_registry unavailable: inferOrderFieldType");
    }
    return __pkmDomainRegistry.inferOrderFieldType(key);
  };

  /* Custom block, в котором стоит Field (или родитель дочернего Field). */
  const blockOfKey = (key) => {
    const parent = String(key || "").replace(/_sub$/, "");
    return (order.custom || []).find((b) => Array.isArray(b.keys) && b.keys.includes(parent)) || null;
  };

  const elementCfgOf = (key) => {
    const byField = cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.elements ? cfg.pkm.fields.elements.byField : null;
    return byField && typeof byField === "object" ? byField[key] : null;
  };

  const buildActionSpec = (key, kind, dir) => {
    const direction = dir === "decrease" ? "decrease" : "increase";
    /*
     * Field custom block шагает по месту каретки (PRD 10.13.260): это работа
     * панели блока, движки Left/Right Field блока не видят.
     */
    if (blockOfKey(key)) {
      return {
        v2Command: "tagWheel",
        settings: { [O.CUSTOM_CYCLE]: JSON.stringify({ key, direction }) },
      };
    }
    /* Element в режиме списка шагает как тег (`В-247`). */
    const listElement = kind === "element"
      && __pkmOrderConfig.elementListValues(elementCfgOf(key)) !== null;
    if (kind === "element" && !listElement) {
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
    /*
     * Правила — из настроек, а не через файл (PRD 10.13.52, П-8): файла нет.
     */
    [O.RULES_DATA]: __rulesShape.buildRulesForEngines(cfgInner),
    [O.CYCLE_END_BEHAVIOR]: getBehaviorValue(cfgInner, "cycleEndBehavior", "keep-bullet"),
    [O.CURSOR_POLICY]: getBehaviorValue(cfgInner, "cursorPolicy", "text_end"),
    [O.ORDER_CONFIG]: serializePkmOrderForMacro(cfgInner),
  });

  /*
   * Настройки панели custom block: правила и порядок — только Field блока,
   * записанные левым Block (`scopeToBlock`); все блоки — ради `Tab`; правила
   * Left/Right — ради `Values in the other Block`. Блок — из конфига вызова.
   */
  const customBase = (cfgInner, blockOf) => {
    const orderNow = typeof normalizePkmOrder === "function"
      ? normalizePkmOrder(cfgInner && cfgInner.pkm && cfgInner.pkm.fields ? cfgInner.pkm.fields.order : null)
      : { custom: [] };
    const block = blockOf(orderNow);
    const blockId = block ? block.id : "";
    const rules = __rulesShape.buildRulesForEngines(cfgInner, blockId);
    return {
      ...makeBase(cfgInner),
      [O.RULES_DATA]: rules,
      [O.ORDER_CONFIG]: JSON.stringify(rules.behavior.order),
      [O.CUSTOM_BLOCK]: blockId,
      [O.CUSTOM_BLOCKS]: (orderNow.custom || []).map((b) => ({
        id: b.id,
        name: b.name,
        rules: __rulesShape.buildRulesForEngines(cfgInner, b.id),
      })),
      [O.LINE_RULES_DATA]: __rulesShape.buildRulesForEngines(cfgInner),
    };
  };

  const defs = [];
  /*
   * Идентификаторы команд полей разводятся: `date_due` и `date-due` дают один
   * kebab. Занятые начинаются с ядра — команда поля не затеняет навигацию.
   */
  const usedIds = __commandIds.reservedCommandIds(featureOrder);
  const pushDef = (strict, dir, orderKey, v2Command, makeExtra) => {
    const id = __commandIds.pkmFieldCommandId(strict, dir, usedIds);
    /*
     * В имени команды — строгое имя Field (`Name`), а не `Name in TagWheel`
     * (2026-09-04). Идентификатор — из того же строгого имени и не меняется:
     * хоткей переживает переименование.
     */
    const shown = normalizeLabelPart(strict, "field");
    const strictLabel = shown;
    /*
     * Подпись и тип Field для справочника (2026-08-31) — по родительскому
     * ключу: команды дочернего стоят под тем же подзаголовком. Подпись — то же
     * строгое имя, что в команде.
     */
    const parentKey = String(orderKey || "").replace(/_sub$/, "");
    const groupLabel = normalizeLabelPart(strictNameForKey(parentKey), "")
      || normalizeLabelPart(parentKey, "field");
    const dirLabel = __commandIds.directionLabel(dir);
    defs.push({
      id,
      /* По нему команду находит поиск хоткея (`detectDateFieldHotkeys`). */
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

  for (const { key, strict } of seeds) {
    const kind = typeForKey(key);
    if (!strict) continue;
    const incSpec = buildActionSpec(key, kind, "increase");
    const decSpec = buildActionSpec(key, kind, "decrease");
    if (blockOfKey(key)) {
      const parent = String(key).replace(/_sub$/, "");
      const inBlock = (o) => (o.custom || []).find((b) => Array.isArray(b.keys) && b.keys.includes(parent)) || null;
      for (const spec of [[incSpec, "increase"], [decSpec, "decrease"]]) {
        pushDef(strict, spec[1], key, spec[0].v2Command, (cfgInner) => ({
          ...customBase(cfgInner, inBlock),
          ...spec[0].settings,
          [O.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfgInner),
          [O.SUBTAG_FORMAT]: getChildTagFormat(cfgInner),
        }));
      }
      continue;
    }
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
  /*
   * Команда custom block — по одной на блок (PRD 10.13.260): `tagWheel <имя>`.
   * Идентификатор от `id`, имя от имени — хоткей переживает переименование.
   */
  for (const block of order.custom || []) {
    const blockId = String(block && block.id || "");
    if (!blockId) continue;
    defs.push({
      id: __commandIds.customBlockCommandId(blockId),
      name: `tagWheel ${normalizeLabelPart(block.name, blockId)}`,
      v2Command: "tagWheel",
      customBlock: blockId,
      makeSettings: (cfgInner) => ({
        ...customBase(cfgInner, (o) => (o.custom || []).find((b) => b.id === blockId) || null),
        [O.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfgInner),
        [O.SUBTAG_FORMAT]: getChildTagFormat(cfgInner),
      }),
    });
  }

  return defs;
}

/**
 * Строки Binder, готовые стать командами: только отбор (без `rowId` или
 * `commandId` — нечего заводить). Не нормализация из `config_normalize.js` —
 * та выдумывает идентификаторы и заводит системную строку (10.13.137).
 */
function binderRowsReadyForCommands(rawRows) {
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
  if (!ed) return plugin && typeof plugin.notice === "function" ? plugin.notice(__say(__noticeKey("pkm", "no-editor"), "Open a note first")) : null;
  const text = String(insertText || "");
  if (!text) return;
  const from = ed.getCursor("from");
  const to = ed.getCursor("to");
  ed.replaceRange(text, from, to);
  ed.setCursor({ line: from.line, ch: from.ch + text.length });
}

/**
 * Пара скобок вокруг каретки: `[[…]]` или `[…]` на этой строке, каретка между
 * открывающей и закрывающей (у края — тоже).
 */
function bracketPairAt(line, ch) {
  const src = String(line || "");
  const open2 = src.lastIndexOf("[[", ch);
  if (open2 !== -1) {
    const close2 = src.indexOf("]]", open2 + 2);
    if (close2 !== -1 && close2 + 2 >= ch && src.lastIndexOf("]]", ch - 1) < open2) {
      return { from: open2, to: close2 + 2, text: src.slice(open2, close2 + 2) };
    }
  }
  const open = src.lastIndexOf("[", ch - 1);
  if (open === -1 || src[open - 1] === "[") return null;
  const close = src.indexOf("]", open + 1);
  if (close === -1 || close < ch - 1 || src.slice(open + 1, close).includes("[") || src[close + 1] === "]") return null;
  return { from: open, to: close + 1, text: src.slice(open, close + 1) };
}

function runInsertBracketsCommand(plugin) {
  const ed = plugin && typeof plugin.getActiveEditor === "function" ? plugin.getActiveEditor() : null;
  if (!ed) return plugin && typeof plugin.notice === "function" ? plugin.notice(__say(__noticeKey("pkm", "no-editor"), "Open a note first")) : null;

  const from = ed.getCursor("from");
  const to = ed.getCursor("to");
  const sel = ed.getSelection();

  /*
   * Каретка внутри пары скобок листает скобки этой пары, как выделение
   * (BUGHUNT 2026-09-30, B15: `[[No¦te]]` давало `[[No[]te]]`).
   */
  if (!sel) {
    const pair = bracketPairAt(ed.getLine(from.line), from.ch);
    if (pair) {
      const at = { line: from.line, ch: pair.from };
      const next = pair.text.startsWith("[[") ? pair.text.slice(2, -2) : "[" + pair.text + "]";
      ed.replaceRange(next, at, { line: from.line, ch: pair.to });
      const shift = (next.length - pair.text.length) / 2;
      ed.setCursor({ line: from.line, ch: Math.max(pair.from, Math.min(pair.from + next.length, from.ch + shift)) });
      return;
    }
    /*
     * Каретка внутри слова берёт слово в скобки (тест 3 цикла 113: `Ma¦n1`).
     * Слово — без пробелов, как `customWordSpan`, и без скобок: скобку у
     * каретки листают ветки ниже. У края слова — пустые скобки.
     */
    const text = ed.getLine(from.line);
    const edge = /[\s[\]]/;
    let a = from.ch;
    let b = from.ch;
    while (a > 0 && !edge.test(text.charAt(a - 1))) a--;
    while (b < text.length && !edge.test(text.charAt(b))) b++;
    if (a < from.ch && from.ch < b) {
      ed.replaceRange("[" + text.slice(a, b) + "]", { line: from.line, ch: a }, { line: from.line, ch: b });
      ed.setCursor({ line: from.line, ch: from.ch + 1 });
      return;
    }
  }

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
  } else if (before.endsWith("[") && !before.endsWith("[[") && !after.startsWith("]")) {
    const start = from.ch - 1;
    ed.replaceRange("[[", { line: from.line, ch: start }, { line: from.line, ch: from.ch });
    ed.setCursor({ line: from.line, ch: start + 2 });
  } else if (before.endsWith("[[") && !after.startsWith("]")) {
    const start = from.ch - 2;
    ed.replaceRange("[", { line: from.line, ch: start }, { line: from.line, ch: from.ch });
    ed.setCursor({ line: from.line, ch: start + 1 });
  } else {
    ed.replaceRange("[]", from);
    ed.setCursor({ line: from.line, ch: from.ch + 1 });
  }
}

function buildBinderCommandDefs(cfgNow) {
  const cfg = cfgNow && typeof cfgNow === "object" ? cfgNow : {};
  const rows = binderRowsReadyForCommands(cfg && cfg.editor && cfg.editor.binder ? cfg.editor.binder.rows : null);
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

/**
 * Есть ли у Field Value, которое команда может написать: иначе тихий отказ
 * (У-41). Element строит значение сам. Спрашиваются правила движков.
 */
function fieldHasValues(cfg, key) {
  const rules = __rulesShape.buildRulesForEngines(cfg);
  const fields = [].concat((rules.leftMode || {}).fields || [], (rules.rightMode || {}).fields || []);
  const field = fields.find((x) => x && x.id === key);
  if (!field) return true;
  return (field.values || []).some((v) => String(v && v.token || "").trim() !== "");
}

module.exports = {
  fieldHasValues,
  buildCoreCommandDefs,
  buildNavigationCommandDefs,
  buildPkmCommandDefs,
  buildBinderCommandDefs,
};
