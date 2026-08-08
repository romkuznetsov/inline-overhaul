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

function normalizeLabelPart(value, dflt) {
  const s = String(value || "").replace(/\s+/g, " ").trim();
  return s || dflt;
}

function buildCoreCommandDefs(plugin, featureOrder, featureMeta) {
  const defs = [
    {
      id: "open-inline-overhaul-settings",
      name: "General: Open settings",
      run: () => {
        plugin.app.setting.open();
        plugin.app.setting.openTabById(plugin.manifest.id);
      },
    },
    {
      id: "undo-last-settings-change",
      name: "General: Undo last settings change",
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
      id: `toggle-feature-${feature}`,
      name: `General: Toggle ${label} module`,
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
      id: "inlineOverhaul_Navigation_MoveUp",
      name: "Navigation: Move Up",
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.moveLine.enabled) return plugin.notice("MoveLine disabled in settings");
        if (!rt || typeof rt.moveLine !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.moveLine(ed, "up", nav.moveLine);
      },
    },
    {
      id: "inlineOverhaul_Navigation_MoveDown",
      name: "Navigation: Move Down",
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.moveLine.enabled) return plugin.notice("MoveLine disabled in settings");
        if (!rt || typeof rt.moveLine !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.moveLine(ed, "down", nav.moveLine);
      },
    },
    {
      id: "inlineOverhaul_Navigation_MoveLeft",
      name: "Navigation: Move Left",
      run: (ed, nav, fullCfg, rt) => {
        if (!rt || typeof rt.moveSelection !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.moveSelection(ed, "left", nav.moveSelection);
      },
    },
    {
      id: "inlineOverhaul_Navigation_MoveRight",
      name: "Navigation: Move Right",
      run: (ed, nav, fullCfg, rt) => {
        if (!rt || typeof rt.moveSelection !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.moveSelection(ed, "right", nav.moveSelection);
      },
    },
    {
      id: "inlineOverhaul_Navigation_JumpHeaderUp",
      name: "Navigation: Jump Header Up",
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.jumpToHeader.enabled) return plugin.notice("JumpToHeader disabled in settings");
        if (!rt || typeof rt.jumpToHeader !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.jumpToHeader(ed, "up", nav.jumpToHeader);
      },
    },
    {
      id: "inlineOverhaul_Navigation_JumpHeaderDown",
      name: "Navigation: Jump Header Down",
      run: (ed, nav, fullCfg, rt) => {
        if (!nav.jumpToHeader.enabled) return plugin.notice("JumpToHeader disabled in settings");
        if (!rt || typeof rt.jumpToHeader !== "function") return plugin.notice("InlineOverhaul: navigation runtime unavailable");
        rt.jumpToHeader(ed, "down", nav.jumpToHeader);
      },
    },
    {
      id: "inlineOverhaul_Navigation_InlineLeft",
      name: "Navigation: Inline Left",
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
      id: "inlineOverhaul_Navigation_InlineRight",
      name: "Navigation: Inline Right",
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

function buildPkmCommandDefs(getActiveTagWheelRulesPath, serializePkmOrderForMacro, serializeDateRuntimeConfigForMacro, normalizePkmOrder, cfgNow) {
  const O = __pkmOptionKeys.KEYS;
  const cfg = cfgNow && typeof cfgNow === "object" ? cfgNow : {};
  const order = typeof normalizePkmOrder === "function"
    ? normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.order : null)
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
  const pushDef = (strict, dir, _name, v2Command, makeExtra) => {
    const id = `inlineOverhaul_Hotkey_${strict}_${dir}`;
    const strictLabel = normalizeLabelPart(strict, "field");
    const dirLabel = dir === "decrease" ? "decrease" : "increase";
    defs.push({
      id,
      name: `PKM: ${strictLabel} ${dirLabel}`,
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
    pushDef(strict, "increase", `PKM: ${strict} increase`, incSpec.v2Command, (cfgInner) => ({
      ...incSpec.settings,
      [O.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfgInner),
      ...(incSpec.v2Command === "statusDate" ? {} : { [O.SUBTAG_FORMAT]: getBehaviorValue(cfgInner, "subtagFormat", "separate") }),
    }));
    pushDef(strict, "decrease", `PKM: ${strict} decrease`, decSpec.v2Command, (cfgInner) => ({
      ...decSpec.settings,
      [O.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfgInner),
      ...(decSpec.v2Command === "statusDate" ? {} : { [O.SUBTAG_FORMAT]: getBehaviorValue(cfgInner, "subtagFormat", "separate") }),
    }));
  }

  defs.push({
    id: "inlineOverhaul_Hotkey_tagwheel_left",
    name: "PKM: TagWheel left",
    v2Command: "tagWheel",
    makeSettings: (cfgInner) => ({
      ...makeBase(cfgInner),
      "Start setting": "left",
      "Start mode override": "left",
      [O.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfgInner),
      [O.SUBTAG_FORMAT]: getBehaviorValue(cfgInner, "subtagFormat", "separate"),
    }),
  });
  defs.push({
    id: "inlineOverhaul_Hotkey_tagwheel_right",
    name: "PKM: TagWheel right",
    v2Command: "tagWheel",
    makeSettings: (cfgInner) => ({
      ...makeBase(cfgInner),
      "Start setting": "right",
      "Start mode override": "right",
      [O.DATE_RUNTIME_CONFIG]: serializeDateRuntimeConfigForMacro(cfgInner),
      [O.SUBTAG_FORMAT]: getBehaviorValue(cfgInner, "subtagFormat", "separate"),
    }),
  });

  return defs;
}

function buildConfigCommandDefs() {
  return [
    {
      id: "inlineOverhaul_Rules_apply",
      name: "Config: Apply TagWheel config",
      run: async (plugin) => {
        const cfg = plugin.getConfig();
        if (!cfg.features.pkm.enabled) {
          plugin.notice("InlineOverhaul: Tag & PKM module disabled");
          return;
        }
        try {
          await plugin.applyTagWheelConfigNote();
          plugin.notice("InlineOverhaul: TagWheel config applied");
        } catch (e) {
          console.error("[inline-overhaul][tagwheel-config-apply:command]", e);
          plugin.notice("InlineOverhaul: " + (e && e.message ? e.message : e));
        }
      },
    },
    {
      id: "inlineOverhaul_Rules_open_detailed_template",
      name: "Config: Open TagWheel template",
      run: async (plugin) => {
        const cfg = plugin.getConfig();
        if (!cfg.features.pkm.enabled) {
          plugin.notice("InlineOverhaul: Tag & PKM module disabled");
          return;
        }
        try {
          const p = await plugin.openTagWheelConfigTemplateNote();
          plugin.notice("Detailed template opened: " + p);
        } catch (e) {
          console.error("[inline-overhaul][tagwheel-config-template-open:command]", e);
          plugin.notice("InlineOverhaul: " + (e && e.message ? e.message : e));
        }
      },
    },
  ];
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
  const rows = normalizeBinderRows(cfg && cfg.ui && cfg.ui.binderRows);
  const defs = [];
  for (const row of rows) {
    const commandId = String(row.commandId || "").trim();
    if (!commandId) continue;
    if (commandId === "inlineOverhaul_Binder_Smart_bracket") {
      defs.push({
        id: commandId,
        name: "Binder: Smart bracket",
        run: (plugin) => runInsertBracketsCommand(plugin),
      });
      continue;
    }
    const binderNameSeed = normalizeLabelPart(row.commandName, "") || normalizeLabelPart(row.insertText, "item");
    defs.push({
      id: commandId,
      name: `Binder: ${binderNameSeed}`,
      run: (plugin) => runInsertTextCommand(plugin, row.insertText),
    });
  }
  return defs;
}

module.exports = {
  buildCoreCommandDefs,
  buildNavigationCommandDefs,
  buildPkmCommandDefs,
  buildConfigCommandDefs,
  buildBinderCommandDefs,
};
