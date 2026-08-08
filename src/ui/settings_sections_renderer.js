"use strict";

let __orderDeepEditorState = null;
let __orderDeepEditorStateDiag = "";

function hasValidOrderDeepEditorState(mod) {
  return !!(mod
    && typeof mod === "object"
    && typeof mod.buildTagTree === "function"
    && typeof mod.applyTagTreeToFields === "function"
    && typeof mod.createHistory === "function"
    && typeof mod.pushHistory === "function"
    && typeof mod.undoHistory === "function"
    && typeof mod.redoHistory === "function"
    && typeof mod.resetHistory === "function");
}

function createOrderDeepEditorStateUnavailable(reason) {
  const msg = String(reason || "order_deep_editor_state unavailable");
  return {
    __unavailable: true,
    __unavailableReason: msg,
    IO_BETA_ORDER_DEEP_EDITOR: "IO_BETA_ORDER_DEEP_EDITOR",
    IO_BETA_CONFLICT_DIALOG: "IO_BETA_CONFLICT_DIALOG",
    IO_TEMP_HISTORY_LIMIT: 100,
    normalizeToken(raw) { return String(raw || "").trim(); },
    buildTagTree() { return []; },
    applyTagTreeToFields(_tree, parentField, subField) {
      return { parentField: parentField || { values: [] }, subField: subField || null };
    },
    createHistory() { return { max: 100, past: [], future: [] }; },
    pushHistory(history) { return history && typeof history === "object" ? history : { max: 100, past: [], future: [] }; },
    undoHistory(history, currentSnapshot) { return { changed: false, snapshot: currentSnapshot, history: history || { max: 100, past: [], future: [] } }; },
    redoHistory(history, currentSnapshot) { return { changed: false, snapshot: currentSnapshot, history: history || { max: 100, past: [], future: [] } }; },
    resetHistory(history) {
      const h = history && typeof history === "object" ? history : { max: 100, past: [], future: [] };
      h.past = [];
      h.future = [];
      return h;
    },
  };
}

function getOrderDeepEditorState() {
  if (__orderDeepEditorState) return __orderDeepEditorState;
  try {
    if (hasValidOrderDeepEditorState(globalThis.__inlineOrderDeepEditorState)) {
      __orderDeepEditorState = globalThis.__inlineOrderDeepEditorState;
      __orderDeepEditorStateDiag = "";
      return __orderDeepEditorState;
    }
  } catch (_) {}
  try {
    // IO_BETA_ORDER_DEEP_EDITOR helpers live in shared core for cycle/tagwheel parity safety.
    const local = require("../core/order_deep_editor_state.js");
    if (hasValidOrderDeepEditorState(local)) {
      __orderDeepEditorState = local;
      __orderDeepEditorStateDiag = "";
      return __orderDeepEditorState;
    }
    __orderDeepEditorStateDiag = "invalid order_deep_editor_state contract";
  } catch (e) {
    __orderDeepEditorStateDiag = String(e && e.message ? e.message : e || "order_deep_editor_state require failed");
  }
  __orderDeepEditorState = createOrderDeepEditorStateUnavailable(__orderDeepEditorStateDiag);
  return __orderDeepEditorState;
}

function getOrderDeepEditorDebounceStore(plugin) {
  if (!plugin || typeof plugin !== "object") return {};
  if (!plugin._orderDeepEditorDebounce || typeof plugin._orderDeepEditorDebounce !== "object") {
    plugin._orderDeepEditorDebounce = {};
  }
  return plugin._orderDeepEditorDebounce;
}

function scheduleOrderDeepCommit(plugin, key, fn, delayMs) {
  const k = String(key || "").trim();
  if (!k || typeof fn !== "function") return;
  const store = getOrderDeepEditorDebounceStore(plugin);
  const prev = store[k];
  if (prev && prev.timer) {
    try { clearTimeout(prev.timer); } catch (_) {}
  }
  const delay = Number.isFinite(Number(delayMs)) ? Math.max(0, Math.trunc(Number(delayMs))) : 180;
  const run = () => {
    delete store[k];
    try { fn(); } catch (_) {}
  };
  store[k] = { fn, timer: setTimeout(run, delay) };
}

function flushOrderDeepCommit(plugin, key) {
  const k = String(key || "").trim();
  const store = getOrderDeepEditorDebounceStore(plugin);
  const entry = k ? store[k] : null;
  if (!entry) return;
  try { if (entry.timer) clearTimeout(entry.timer); } catch (_) {}
  delete store[k];
  try { if (typeof entry.fn === "function") entry.fn(); } catch (_) {}
}

function flushAllDeepCommits(plugin) {
  const store = getOrderDeepEditorDebounceStore(plugin);
  const keys = Object.keys(store);
  for (let i = 0; i < keys.length; i++) flushOrderDeepCommit(plugin, keys[i]);
}

function deferRefreshSettings(refreshSettings) {
  if (typeof refreshSettings !== "function") return;
  const run = () => {
    try { refreshSettings(); } catch (_) {}
  };
  setTimeout(() => {
    run();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        setTimeout(run, 0);
      });
    }
  }, 0);
}

function onNodeDetachedOnce(node, cb) {
  if (!node || typeof cb !== "function") return () => {};
  let done = false;
  let obs = null;
  const finish = () => {
    if (done) return;
    done = true;
    try { if (obs) obs.disconnect(); } catch (_) {}
    try { cb(); } catch (_) {}
  };
  if (!node.isConnected) {
    finish();
    return () => {};
  }
  obs = new MutationObserver(() => {
    if (!node.isConnected) finish();
  });
  try {
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {
    return () => {};
  }
  return () => {
    if (done) return;
    done = true;
    try { obs.disconnect(); } catch (_) {}
  };
}

function normalizeSettingsTypography(rootEl) {
  if (!rootEl || typeof rootEl.querySelectorAll !== "function") return;
  const MAIN_HEADERS = new Set([
    "Order",
    "Color your Tags",
    "Config in markdown",
    "Separators",
    "Active commands",
    "Visual",
    "Hotkeys",
    "Global Modules",
    "PKM Other settings",
    "Developer Mode",
    "Diagnostics",
    "Colors",
  ]);
  const SUB_HEADERS = new Set([
    "Left panel",
    "Right panel",
    "Preview of your Order",
    "Order Main Table",
    "Order Settings",
    "Move Line",
    "Move Selection",
    "Move Selection (Inline Text)",
    "Prefix Cycler",
    "Jump To Header",
    "Navigate Inline",
    "Behavior",
    "Free roam",
    "TagWheel",
    "Tags",
    "Strip",
    "Panel",
    "Scroller",
  ]);
  const nodes = rootEl.querySelectorAll("h3,h4,h5,h6,div,small");
  for (const node of nodes) {
    const text = String(node.textContent || "").trim();
    if (!text) continue;
    if (MAIN_HEADERS.has(text)) {
      node.style.fontSize = "14px";
      node.style.fontWeight = "600";
      node.style.lineHeight = "1.25";
      node.style.marginTop = "0";
      node.style.marginBottom = "2px";
      continue;
    }
    if (SUB_HEADERS.has(text)) {
      node.style.fontSize = "12px";
      node.style.fontWeight = "600";
      node.style.lineHeight = "1.25";
      node.style.marginTop = "0";
      node.style.marginBottom = "2px";
    }
  }
}

function normalizeSettingsVisualSystem(rootEl) {
  if (!rootEl || typeof rootEl.querySelectorAll !== "function") return;

  rootEl.style.maxWidth = "100%";
  rootEl.style.overflowX = "hidden";

  const settingRows = rootEl.querySelectorAll(".setting-item");
  for (const row of settingRows) {
    const inOrderArea = !!(row && typeof row.closest === "function" && row.closest(".io-order-wrap"));
    const inOrderSettingsCard = !!(row && typeof row.closest === "function" && row.closest(".io-order-settings-card"));
    row.style.marginTop = "0";
    row.style.marginBottom = (inOrderArea && !inOrderSettingsCard) ? "0" : "8px";
    row.style.paddingTop = "6px";
    row.style.paddingBottom = "6px";
    row.style.boxSizing = "border-box";
    row.style.maxWidth = "100%";
  }

  const settingControls = rootEl.querySelectorAll(".setting-item-control");
  for (const ctl of settingControls) {
    ctl.style.maxWidth = "100%";
    ctl.style.overflowX = "auto";
  }

  const controls = rootEl.querySelectorAll("button,select,input[type='text'],input[type='number']");
  for (const c of controls) {
    c.style.boxSizing = "border-box";
    if (c.tagName === "BUTTON") {
      if (!c.style.minHeight) c.style.minHeight = "24px";
      if (!c.style.borderRadius) c.style.borderRadius = "6px";
      if (!c.style.padding) c.style.padding = "2px 8px";
      c.style.lineHeight = "1.2";
    }
    if (c.tagName === "SELECT") {
      if (!c.style.minHeight) c.style.minHeight = "24px";
      if (!c.style.borderRadius) c.style.borderRadius = "6px";
    }
    if (c.tagName === "INPUT") {
      const t = String(c.getAttribute("type") || "text").toLowerCase();
      if (t === "text" || t === "number") {
        if (!c.style.minHeight) c.style.minHeight = "24px";
        if (!c.style.borderRadius) c.style.borderRadius = "6px";
      }
    }
  }

  const subtabRows = rootEl.querySelectorAll(".inline-overhaul-subtab-row");
  for (const row of subtabRows) {
    row.style.gap = "6px";
    row.style.marginBottom = "8px";
    const buttons = row.querySelectorAll("button");
    for (const btn of buttons) {
      btn.style.padding = "3px 8px";
      btn.style.minHeight = "24px";
      btn.style.lineHeight = "1.2";
      btn.style.borderRadius = "6px";
    }
  }

  const warningButtons = rootEl.querySelectorAll("button.mod-warning");
  for (const btn of warningButtons) {
    btn.style.minHeight = "24px";
    btn.style.borderRadius = "6px";
  }

  const disabledBanners = rootEl.querySelectorAll(".inline-overhaul-disabled-banner");
  for (const banner of disabledBanners) {
    banner.style.padding = "8px 10px";
    banner.style.border = "1px solid var(--background-modifier-border)";
    banner.style.borderRadius = "8px";
    banner.style.background = "var(--background-secondary)";
    banner.style.opacity = "0.9";
    banner.style.marginBottom = "8px";
    banner.style.boxSizing = "border-box";
    banner.style.maxWidth = "100%";
  }

  const cardLikeDivs = rootEl.querySelectorAll("div");
  for (const el of cardLikeDivs) {
    const b = String(el.style.border || "");
    if (!b || b.indexOf("background-modifier-border") === -1) continue;
    const cls = String(el.className || "");
    const isOrderArea = cls.includes("inline-overhaul-order-board")
      || cls.includes("inline-overhaul-order-panel")
      || cls.includes("inline-overhaul-order-row")
      || cls.includes("inline-overhaul-deep");
    const text = String(el.textContent || "").trim();
    const isOrderSpecific = text === "Order"
      || text === "Order Main Table"
      || text === "Order Settings"
      || text === "Left panel"
      || text === "Right panel"
      || text === "Preview of your Order";
    if (!el.style.borderRadius) el.style.borderRadius = "8px";
    if (!el.style.boxSizing) el.style.boxSizing = "border-box";
    if (!el.style.padding && (b.includes("solid") || b.includes("dashed"))) {
      el.style.padding = "8px";
    }
    if (!isOrderArea && !isOrderSpecific && !el.style.marginBottom) {
      el.style.marginBottom = "8px";
    }
  }

  const detailsNodes = rootEl.querySelectorAll("details");
  for (const d of detailsNodes) {
    if (!d.style.marginTop) d.style.marginTop = "2px";
    if (!d.style.marginBottom) d.style.marginBottom = "4px";
    d.style.maxWidth = "100%";
    d.style.overflowX = "hidden";
  }

  const previewLike = rootEl.querySelectorAll("div,span");
  for (const el of previewLike) {
    if (!el || !el.style) continue;
    const ws = String(el.style.whiteSpace || "").toLowerCase();
    if (ws !== "nowrap" && ws !== "pre" && ws !== "pre-wrap") continue;
    const hasScrollableIntent = String(el.style.overflowX || "").toLowerCase() === "auto";
    if (hasScrollableIntent) {
      el.style.maxWidth = "100%";
      el.style.boxSizing = "border-box";
    }
  }

  const summaryNodes = rootEl.querySelectorAll("summary");
  for (const s of summaryNodes) {
    s.style.fontSize = "12px";
    s.style.lineHeight = "1.25";
  }

  const smallBadges = rootEl.querySelectorAll("small");
  for (const sm of smallBadges) {
    const hasBorder = String(sm.style.border || "").includes("background-modifier-border");
    if (!hasBorder) continue;
    sm.style.fontSize = "11px";
    sm.style.lineHeight = "1.2";
    sm.style.padding = "1px 6px";
    sm.style.borderRadius = "6px";
    sm.style.display = sm.style.display || "inline-block";
    sm.style.boxSizing = "border-box";
  }
}

function normalizeHexColorInput(value) {
  const src = String(value || "").trim().toLowerCase();
  if (!src) return "";
  return /^#[0-9a-f]{6}$/.test(src) ? src : "";
}

function getContrastTextHex(bgHex) {
  const hex = normalizeHexColorInput(bgHex);
  if (!hex) return "#111111";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#111111" : "#ffffff";
}

function computeTagVisualStyle(textSizePct, bubbleWidthPct, bubbleHeightPct, shapePct) {
  const size = Number.isFinite(Math.trunc(Number(textSizePct))) ? Math.max(80, Math.min(140, Math.trunc(Number(textSizePct)))) : 100;
  const bubbleW = Number.isFinite(Math.trunc(Number(bubbleWidthPct))) ? Math.max(80, Math.min(140, Math.trunc(Number(bubbleWidthPct)))) : 100;
  const bubbleH = Number.isFinite(Math.trunc(Number(bubbleHeightPct))) ? Math.max(80, Math.min(140, Math.trunc(Number(bubbleHeightPct)))) : 100;
  const shape = Number.isFinite(Math.trunc(Number(shapePct))) ? Math.max(0, Math.min(100, Math.trunc(Number(shapePct)))) : 0;
  const scale = size / 100;
  const bubbleScaleX = bubbleW / 100;
  const bubbleScaleY = bubbleH / 100;
  const t = shape / 100;
  const eased = t <= 0.5
    ? (t / 0.5) * 0.45
    : (0.45 + ((t - 0.5) / 0.5) * 0.55);
  const radiusPx = Math.max(0, Math.round(16 * (1 - eased)));
  return {
    borderRadiusPx: radiusPx,
    horizontalPaddingPx: Math.max(2, Math.round(6 * bubbleScaleX)),
    verticalPaddingPx: Math.max(1, Math.round(3 * bubbleScaleY)),
    fontSizePx: Math.max(10, Math.round(14 * scale)),
    lineHeight: 1.2,
  };
}

function readTagwheelHeaderColorConfig(cfg) {
  const behavior = cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior : {};
  const colors = behavior && behavior.colors ? behavior.colors : {};
  const header = colors && colors.tagwheelHeader ? colors.tagwheelHeader : {};
  return {
    defaultTextColor: normalizeHexColorInput(header.defaultTextColor),
    fillColor: normalizeHexColorInput(header.fillColor),
    showPrefix: header.showPrefix !== false,
  };
}

function readTagVisualsConfig(cfg) {
  const behavior = cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior : {};
  const visuals = behavior && behavior.tagVisuals ? behavior.tagVisuals : {};
  const opacity = visuals && visuals.opacity ? visuals.opacity : {};
  const strip = visuals && visuals.strip ? visuals.strip : {};
  const toOpacity = (value, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
  };
  const toInt = (value, fallback, min, max) => {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
  const toShapePct = (value, fallback) => {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, n));
  };
  return {
    showColorSettings: visuals.showColorSettings === true,
    opacityLeft: toOpacity(opacity.left, 1),
    opacityRight: toOpacity(opacity.right, 1),
    stripActive: strip.active === true,
    stripFieldId: String(strip.fieldId || "").trim(),
    stripTagVisibility: strip.tagVisibility !== false,
    stripHideSeparatorWhenOnlyStripToken: strip.hideSeparatorWhenOnlyStripToken === true,
    stripMode: String(strip.mode || "default").trim().toLowerCase() === "crossing" ? "crossing" : "default",
    stripStripesToShow: toInt(strip.stripesToShow, 2, 1, 3),
    stripThickness: toInt(strip.thickness, 2, 1, 12),
    stripChildOffset: toInt(strip.childOffset, 12, 2, 20),
    stripSpacing: toInt(strip.spacing, 20, 8, 48),
    tagTextSizePct: toInt(visuals.tagTextSizePct, toInt(visuals.tagSizePct, 100, 80, 140), 80, 140),
    tagBubbleWidthPct: toInt(visuals.tagBubbleWidthPct, toInt(visuals.tagBubbleSizePct, 100, 80, 140), 80, 140),
    tagBubbleHeightPct: toInt(visuals.tagBubbleHeightPct, toInt(visuals.tagBubbleSizePct, 100, 80, 140), 80, 140),
    emptyBubbleSizePct: toInt(visuals.emptyBubbleSizePct, 100, 50, 180),
    tagShapePct: toShapePct(visuals.tagShapePct, 0),
  };
}

function renderShowColorSettingsControl(containerEl, Setting, plugin, enabled, cfg, reasonPrefix) {
  const tagVisuals = readTagVisualsConfig(cfg);
  new Setting(containerEl)
    .setName("Show Color Settings")
    .setDesc("Show/hide per-tag visual controls in Order Deep Editor.")
    .addToggle((t) => {
      t.setValue(tagVisuals.showColorSettings).onChange((v) => {
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { showColorSettings: v === true } } } }, reasonPrefix || "visual:tags:show-color-settings");
      });
      if (!enabled) t.setDisabled(true);
    });
}

function collectTagOrderFieldOptions(cfg, normalizePkmOrder) {
  const out = [];
  const seen = new Set();
  const behavior = cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior : {};
  const order = typeof normalizePkmOrder === "function"
    ? normalizePkmOrder(behavior.order)
    : (behavior.order || { left: [], right: [], types: {}, labels: {} });
  const types = order && order.types && typeof order.types === "object" ? order.types : {};
  const labels = order && order.labels && typeof order.labels === "object" ? order.labels : {};
  const strictNames = order && order.strictNames && typeof order.strictNames === "object" ? order.strictNames : {};
  const orderedKeys = []
    .concat(Array.isArray(order.left) ? order.left : [])
    .concat(Array.isArray(order.right) ? order.right : []);
  for (const rawKey of orderedKeys) {
    const key = String(rawKey || "").trim();
    if (!key || /_sub$/.test(key) || seen.has(key)) continue;
    const type = String(types[key] || "").trim().toLowerCase();
    if (type !== "tag") continue;
    seen.add(key);
    const display = String(labels[key] || "").trim() || key;
    const strict = String(strictNames[key] || key).trim() || key;
    out.push({ key, label: `${display} (${strict})` });
  }
  return out;
}

function buildTagwheelColorPreview(containerEl, colors, enabled) {
  const demo = containerEl.createDiv();
  demo.style.marginTop = "8px";
  demo.style.padding = "8px 10px";
  demo.style.border = "1px solid var(--background-modifier-border)";
  demo.style.borderRadius = "8px";
  demo.style.opacity = enabled ? "1" : "0.7";

  const sample = demo.createEl("span", { text: "importance [type] category project client topic" });
  sample.style.padding = "2px 4px";
  sample.style.borderRadius = "4px";
  if (colors.defaultTextColor) sample.style.color = colors.defaultTextColor;
  if (colors.fillColor) sample.style.backgroundColor = colors.fillColor;
}

function addTagwheelHeaderColorSetting(containerEl, Setting, plugin, enabled, key, name, desc, currentValue, reason, resetReason) {
  new Setting(containerEl)
    .setName(name)
    .setDesc(desc)
    .addColorPicker((picker) => {
      picker
        .setValue(currentValue || "#f1e596")
        .onChange((v) => {
          const next = normalizeHexColorInput(v);
          if (!next) return;
          plugin.setConfigPatch({ pkm: { behavior: { colors: { tagwheelHeader: { [key]: next } } } } }, reason);
        });
      if (!enabled) picker.setDisabled(true);
    })
    .addText((txt) => {
      txt.setPlaceholder("#ffffff");
      txt.setValue(currentValue || "");
      txt.onChange((v) => {
        const next = normalizeHexColorInput(v);
        if (next === "" && String(v || "").trim()) return;
        plugin.setConfigPatch({ pkm: { behavior: { colors: { tagwheelHeader: { [key]: next } } } } }, reason);
      });
      if (!enabled) txt.setDisabled(true);
    })
    .addExtraButton((btn) => {
      btn.setIcon("reset");
      btn.setTooltip("Reset");
      btn.onClick(() => {
        plugin.setConfigPatch({ pkm: { behavior: { colors: { tagwheelHeader: { [key]: "" } } } } }, resetReason);
      });
      if (!enabled) btn.setDisabled(true);
    });
}

function renderVisualGeneralSection(ctx) {
  const { Setting, containerEl, enabled, cfg, plugin } = ctx;
  containerEl.createEl("h4", { text: "TagWheel" });
  containerEl.createEl("h5", { text: "Scroller" });

  const behavior = cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior : {};
  const scroller = behavior && behavior.tagWheelScroller ? behavior.tagWheelScroller : {};
  const currentEnabled = scroller.enabled === true;
  const currentDirection = ["up", "down", "full"].includes(String(scroller.direction || "").trim().toLowerCase())
    ? String(scroller.direction).trim().toLowerCase()
    : "full";
  const rawSize = Math.trunc(Number(scroller.size));
  const currentSize = Number.isFinite(rawSize) ? Math.max(1, Math.min(20, rawSize)) : 3;

  let scrollerEnabledEl = null;
  let scrollerDirectionEl = null;
  let scrollerSizeEl = null;

  const readScrollerState = () => {
    const liveCfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : cfg;
    const liveBehavior = liveCfg && liveCfg.pkm && liveCfg.pkm.behavior ? liveCfg.pkm.behavior : {};
    const liveScroller = liveBehavior && liveBehavior.tagWheelScroller ? liveBehavior.tagWheelScroller : {};
    const enabledState = liveScroller.enabled === true;
    const directionRaw = String(liveScroller.direction || "").trim().toLowerCase();
    const directionState = ["up", "down", "full"].includes(directionRaw) ? directionRaw : "full";
    const sizeRaw = Math.trunc(Number(liveScroller.size));
    const sizeState = Number.isFinite(sizeRaw) ? Math.max(1, Math.min(20, sizeRaw)) : 3;
    return { enabledState, directionState, sizeState };
  };

  const scrollerEnabledSetting = new Setting(containerEl)
    .setName("TagWheel Scroller")
    .setDesc("Render active field values as overlay scroller above editor text.")
    .addToggle((t) => {
      t.setValue(currentEnabled).onChange((v) => {
        plugin.setConfigPatch({ pkm: { behavior: { tagWheelScroller: { enabled: v } } } }, "visual:tagwheel:scroller:enabled");
        applyScrollerPreview();
      });
      if (!enabled) t.setDisabled(true);
    });
  scrollerEnabledEl = scrollerEnabledSetting.controlEl.querySelector('input[type="checkbox"]');

  const scrollerDirectionSetting = new Setting(containerEl)
    .setName("Scroller direction")
    .setDesc("Where scroller opens relative to active field.")
    .addDropdown((d) => {
      d.addOption("up", "up");
      d.addOption("down", "down");
      d.addOption("full", "full");
      d.setValue(currentDirection);
      d.onChange((v) => {
        const next = ["up", "down", "full"].includes(String(v || "").trim().toLowerCase())
          ? String(v).trim().toLowerCase()
          : "full";
        plugin.setConfigPatch({ pkm: { behavior: { tagWheelScroller: { direction: next } } } }, "visual:tagwheel:scroller:direction");
        applyScrollerPreview();
      });
      if (!enabled || !currentEnabled) d.setDisabled(true);
    });
  scrollerDirectionEl = scrollerDirectionSetting.controlEl.querySelector("select");

  const scrollerSizeSetting = new Setting(containerEl)
    .setName("Scroller size")
    .setDesc("Visible item count per side (1..20).")
    .addText((txt) => {
      txt.setValue(String(currentSize));
      txt.setPlaceholder("3");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const next = Math.max(1, Math.min(20, n));
        plugin.setConfigPatch({ pkm: { behavior: { tagWheelScroller: { size: next } } } }, "visual:tagwheel:scroller:size");
        applyScrollerPreview();
      });
      if (!enabled || !currentEnabled) txt.setDisabled(true);
    });
  scrollerSizeEl = scrollerSizeSetting.controlEl.querySelector('input[type="text"]');

  const scrollerPreview = containerEl.createDiv();
  scrollerPreview.style.marginTop = "8px";
  scrollerPreview.style.padding = "10px";
  scrollerPreview.style.border = "1px solid var(--background-modifier-border)";
  scrollerPreview.style.borderRadius = "8px";
  scrollerPreview.style.background = "var(--background-secondary)";
  scrollerPreview.createEl("small", { text: "Scroller preview" });
  const scrollerFrame = scrollerPreview.createDiv();
  scrollerFrame.style.marginTop = "6px";
  scrollerFrame.style.padding = "8px";
  scrollerFrame.style.border = "1px dashed var(--background-modifier-border)";
  scrollerFrame.style.borderRadius = "6px";
  const scrollerHint = scrollerFrame.createDiv();
  scrollerHint.style.fontSize = "12px";
  scrollerHint.style.opacity = "0.75";
  scrollerHint.style.marginBottom = "6px";
  const scrollerLine = scrollerFrame.createDiv();
  scrollerLine.style.display = "flex";
  scrollerLine.style.flexDirection = "column";
  scrollerLine.style.alignItems = "flex-start";
  scrollerLine.style.gap = "2px";
  scrollerLine.style.minHeight = "112px";
  scrollerLine.style.paddingLeft = "8px";

  const applyScrollerPreview = () => {
    const live = readScrollerState();
    const enabledNow = live.enabledState;
    const directionNowRaw = scrollerDirectionEl ? String(scrollerDirectionEl.value || "") : live.directionState;
    const directionNow = ["up", "down", "full"].includes(directionNowRaw) ? directionNowRaw : "full";
    const sizeNowRaw = scrollerSizeEl ? Math.trunc(Number(scrollerSizeEl.value)) : live.sizeState;
    const sizeNow = Number.isFinite(sizeNowRaw) ? Math.max(1, Math.min(20, sizeNowRaw)) : live.sizeState;
    const beforeCount = directionNow === "down" ? 0 : sizeNow;
    const afterCount = directionNow === "up" ? 0 : sizeNow;

    scrollerLine.empty();
    if (!enabledNow) {
      scrollerHint.setText("Scroller is disabled.");
      const off = scrollerLine.createEl("span", { text: "(disabled)" });
      off.style.opacity = "0.6";
      off.style.marginTop = "40px";
      return;
    }

    scrollerHint.setText(`direction=${directionNow}; size=${sizeNow}`);
    const mkChip = (text, isActive) => {
      const chip = scrollerLine.createEl("span", { text });
      chip.style.display = "inline-block";
      chip.style.minWidth = "74px";
      chip.style.textAlign = "center";
      chip.style.padding = "1px 6px";
      chip.style.fontSize = "10px";
      chip.style.borderRadius = "999px";
      chip.style.border = isActive
        ? "1px solid var(--text-accent)"
        : "1px solid var(--background-modifier-border)";
      chip.style.color = isActive ? "var(--text-accent)" : "var(--text-normal)";
      chip.style.fontWeight = isActive ? "700" : "500";
      chip.style.opacity = isActive ? "1" : "0.8";
      return chip;
    };
    for (let i = beforeCount; i >= 1; i--) {
      mkChip(`next-${i}`, false);
    }
    mkChip("ACTIVE", true);
    for (let i = 1; i <= afterCount; i++) {
      mkChip(`prev-${i}`, false);
    }
  };

  applyScrollerPreview();
  if (scrollerEnabledEl) scrollerEnabledEl.addEventListener("change", applyScrollerPreview);
  if (scrollerDirectionEl) scrollerDirectionEl.addEventListener("change", applyScrollerPreview);
  if (scrollerSizeEl) scrollerSizeEl.addEventListener("input", applyScrollerPreview);
  if (scrollerSizeEl) scrollerSizeEl.addEventListener("change", applyScrollerPreview);

  containerEl.createEl("h5", { text: "Panel" });
  const colorCfg = readTagwheelHeaderColorConfig(cfg);
  const showPrefixSetting = new Setting(containerEl)
    .setName("Show prefix")
    .setDesc("On: show # and marker prefixes in the TagWheel panel/scroller. Off: hide prefixes visually only.")
    .addToggle((t) => {
      t.setValue(colorCfg.showPrefix).onChange((v) => {
        plugin.setConfigPatch({ pkm: { behavior: { colors: { tagwheelHeader: { showPrefix: v } } } } }, "visual:tagwheel:colors:show-prefix");
        applyShowPrefixPreview(v === true);
      });
      if (!enabled) t.setDisabled(true);
    });
  const showPrefixPreviewWrap = showPrefixSetting.controlEl.createEl("span");
  showPrefixPreviewWrap.style.display = "inline-flex";
  showPrefixPreviewWrap.style.flexDirection = "column";
  showPrefixPreviewWrap.style.gap = "2px";
  showPrefixPreviewWrap.style.marginLeft = "10px";
  showPrefixPreviewWrap.style.padding = "2px 6px";
  showPrefixPreviewWrap.style.width = "110px";
  showPrefixPreviewWrap.style.boxSizing = "border-box";
  showPrefixPreviewWrap.style.border = "1px solid var(--background-modifier-border)";
  showPrefixPreviewWrap.style.borderRadius = "6px";
  showPrefixPreviewWrap.style.fontSize = "11px";
  showPrefixPreviewWrap.style.lineHeight = "1.2";
  const showPrefixPreviewLine1 = showPrefixPreviewWrap.createEl("span");
  const showPrefixPreviewLine2 = showPrefixPreviewWrap.createEl("span");
  const applyShowPrefixPreview = (on) => {
    const isOn = on === true;
    showPrefixPreviewLine1.setText(isOn ? "#example" : "example");
    showPrefixPreviewLine2.setText(isOn ? "📅 2026-01-01" : "2026-01-01");
  };
  applyShowPrefixPreview(colorCfg.showPrefix);

  addTagwheelHeaderColorSetting(
    containerEl,
    Setting,
    plugin,
    enabled,
    "defaultTextColor",
    "Default text color",
    "HEX color for all default placeholders in TagWheel header.",
    colorCfg.defaultTextColor,
    "visual:tagwheel:colors:default-text",
    "visual:tagwheel:colors:default-text:reset"
  );

  addTagwheelHeaderColorSetting(
    containerEl,
    Setting,
    plugin,
    enabled,
    "fillColor",
    "Filling color",
    "HEX color for TagWheel header filling area.",
    colorCfg.fillColor,
    "visual:tagwheel:colors:fill",
    "visual:tagwheel:colors:fill:reset"
  );

  buildTagwheelColorPreview(containerEl, colorCfg, enabled);
}

function renderVisualTagsSection(ctx) {
  const { Setting, containerEl, enabled, cfg, plugin } = ctx;
  const tagVisuals = readTagVisualsConfig(cfg);
  containerEl.createEl("h4", { text: "Tags" });

  let opacityLeftSliderEl = null;
  let opacityLeftTextEl = null;
  const opacityLeftSetting = new Setting(containerEl)
    .setName("Opacity Left")
    .setDesc("Global tag visual opacity for tokens left of separator1 (0..100%).")
    .addSlider((s) => {
      s.setLimits(0, 100, 1);
      s.setDynamicTooltip();
      s.setValue(Math.round(tagVisuals.opacityLeft * 100));
      s.onChange((v) => {
        const nextPct = Math.max(0, Math.min(100, Math.trunc(Number(v))));
        if (opacityLeftTextEl) opacityLeftTextEl.value = String(nextPct);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { opacity: { left: nextPct / 100 } } } } }, "visual:tags:opacity:left");
      });
      if (!enabled) s.setDisabled(true);
    })
    .addText((txt) => {
      opacityLeftTextEl = txt.inputEl;
      txt.setValue(String(Math.round(tagVisuals.opacityLeft * 100)));
      txt.inputEl.style.width = "52px";
      txt.setPlaceholder("100");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const nextPct = Math.max(0, Math.min(100, n));
        if (opacityLeftSliderEl) opacityLeftSliderEl.value = String(nextPct);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { opacity: { left: nextPct / 100 } } } } }, "visual:tags:opacity:left:text");
      });
      if (!enabled) txt.setDisabled(true);
    });
  for (const el of opacityLeftSetting.controlEl.querySelectorAll("input")) {
    if (el.type === "range") opacityLeftSliderEl = el;
    if (el.type === "text") opacityLeftTextEl = el;
  }
  const opacityLeftPreviewWrap = opacityLeftSetting.controlEl.createEl("span");
  opacityLeftPreviewWrap.style.display = "inline-flex";
  opacityLeftPreviewWrap.style.width = "110px";
  opacityLeftPreviewWrap.style.justifyContent = "center";
  const opacityLeftPreview = opacityLeftPreviewWrap.createEl("span", { text: "#example" });
  opacityLeftPreview.style.display = "inline-block";
  opacityLeftPreview.style.opacity = String(tagVisuals.opacityLeft);
  opacityLeftPreview.style.background = "#ffffff";
  opacityLeftPreview.style.color = "#111111";
  opacityLeftPreview.style.border = "1px solid var(--background-modifier-border)";
  if (opacityLeftSliderEl) {
    opacityLeftSliderEl.addEventListener("input", () => {
      const v = Math.max(0, Math.min(100, Math.trunc(Number(opacityLeftSliderEl.value))));
      if (opacityLeftTextEl) opacityLeftTextEl.value = String(v);
      opacityLeftPreview.style.opacity = String(v / 100);
    });
  }
  if (opacityLeftTextEl) {
    opacityLeftTextEl.addEventListener("input", () => {
      const n = Math.trunc(Number(opacityLeftTextEl.value));
      if (!Number.isFinite(n)) return;
      const v = Math.max(0, Math.min(100, n));
      if (opacityLeftSliderEl) opacityLeftSliderEl.value = String(v);
      opacityLeftPreview.style.opacity = String(v / 100);
    });
  }

  let opacityRightSliderEl = null;
  let opacityRightTextEl = null;
  const opacityRightSetting = new Setting(containerEl)
    .setName("Opacity Right")
    .setDesc("Global tag visual opacity for tokens right of separator2 (0..100%).")
    .addSlider((s) => {
      s.setLimits(0, 100, 1);
      s.setDynamicTooltip();
      s.setValue(Math.round(tagVisuals.opacityRight * 100));
      s.onChange((v) => {
        const nextPct = Math.max(0, Math.min(100, Math.trunc(Number(v))));
        if (opacityRightTextEl) opacityRightTextEl.value = String(nextPct);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { opacity: { right: nextPct / 100 } } } } }, "visual:tags:opacity:right");
      });
      if (!enabled) s.setDisabled(true);
    })
    .addText((txt) => {
      opacityRightTextEl = txt.inputEl;
      txt.setValue(String(Math.round(tagVisuals.opacityRight * 100)));
      txt.inputEl.style.width = "52px";
      txt.setPlaceholder("100");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const nextPct = Math.max(0, Math.min(100, n));
        if (opacityRightSliderEl) opacityRightSliderEl.value = String(nextPct);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { opacity: { right: nextPct / 100 } } } } }, "visual:tags:opacity:right:text");
      });
      if (!enabled) txt.setDisabled(true);
    });
  for (const el of opacityRightSetting.controlEl.querySelectorAll("input")) {
    if (el.type === "range") opacityRightSliderEl = el;
    if (el.type === "text") opacityRightTextEl = el;
  }
  const opacityRightPreviewWrap = opacityRightSetting.controlEl.createEl("span");
  opacityRightPreviewWrap.style.display = "inline-flex";
  opacityRightPreviewWrap.style.width = "110px";
  opacityRightPreviewWrap.style.justifyContent = "center";
  const opacityRightPreview = opacityRightPreviewWrap.createEl("span", { text: "#example" });
  opacityRightPreview.style.display = "inline-block";
  opacityRightPreview.style.opacity = String(tagVisuals.opacityRight);
  opacityRightPreview.style.background = "#ffffff";
  opacityRightPreview.style.color = "#111111";
  opacityRightPreview.style.border = "1px solid var(--background-modifier-border)";
  if (opacityRightSliderEl) {
    opacityRightSliderEl.addEventListener("input", () => {
      const v = Math.max(0, Math.min(100, Math.trunc(Number(opacityRightSliderEl.value))));
      if (opacityRightTextEl) opacityRightTextEl.value = String(v);
      opacityRightPreview.style.opacity = String(v / 100);
    });
  }
  if (opacityRightTextEl) {
    opacityRightTextEl.addEventListener("input", () => {
      const n = Math.trunc(Number(opacityRightTextEl.value));
      if (!Number.isFinite(n)) return;
      const v = Math.max(0, Math.min(100, n));
      if (opacityRightSliderEl) opacityRightSliderEl.value = String(v);
      opacityRightPreview.style.opacity = String(v / 100);
    });
  }

  let tagTextSizeSliderEl = null;
  let tagTextSizeTextEl = null;
  const tagTextSizeSetting = new Setting(containerEl)
    .setName("Tag text size")
    .setDesc("Scale tag text size (80%..140%).")
    .addSlider((s) => {
      s.setLimits(80, 140, 5);
      s.setDynamicTooltip();
      s.setValue(tagVisuals.tagTextSizePct);
      s.onChange((v) => {
        const next = Math.max(80, Math.min(140, Math.trunc(Number(v))));
        if (tagTextSizeTextEl) tagTextSizeTextEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { tagTextSizePct: next } } } }, "visual:tags:text-size");
      });
      if (!enabled) s.setDisabled(true);
    })
    .addText((txt) => {
      tagTextSizeTextEl = txt.inputEl;
      txt.inputEl.style.width = "52px";
      txt.setValue(String(tagVisuals.tagTextSizePct));
      txt.setPlaceholder("100");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const next = Math.max(80, Math.min(140, n));
        if (tagTextSizeSliderEl) tagTextSizeSliderEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { tagTextSizePct: next } } } }, "visual:tags:text-size:text");
      });
      if (!enabled) txt.setDisabled(true);
    });
  for (const el of tagTextSizeSetting.controlEl.querySelectorAll("input")) {
    if (el.type === "range") tagTextSizeSliderEl = el;
    if (el.type === "text") tagTextSizeTextEl = el;
  }
  const tagTextSizePreviewWrap = tagTextSizeSetting.controlEl.createEl("span");
  tagTextSizePreviewWrap.style.display = "inline-flex";
  tagTextSizePreviewWrap.style.width = "110px";
  tagTextSizePreviewWrap.style.justifyContent = "center";
  const tagTextSizePreview = tagTextSizePreviewWrap.createEl("span", { text: "#example" });
  {
    const applyTextSizePreview = (textSizePct) => {
      const st = computeTagVisualStyle(textSizePct, tagVisuals.tagBubbleWidthPct, tagVisuals.tagBubbleHeightPct, tagVisuals.tagShapePct);
      tagTextSizePreview.style.padding = `${st.verticalPaddingPx}px ${st.horizontalPaddingPx}px`;
      tagTextSizePreview.style.borderRadius = `${st.borderRadiusPx}px`;
      tagTextSizePreview.style.fontSize = `${st.fontSizePx}px`;
      tagTextSizePreview.style.lineHeight = String(st.lineHeight);
    };
    applyTextSizePreview(tagVisuals.tagTextSizePct);
    tagTextSizePreview.style.display = "inline-block";
    tagTextSizePreview.style.border = "1px solid var(--background-modifier-border)";
    tagTextSizePreview.style.background = "#ffffff";
    tagTextSizePreview.style.color = "#111111";
    if (tagTextSizeSliderEl) tagTextSizeSliderEl.addEventListener("input", () => {
      const size = Math.max(80, Math.min(140, Math.trunc(Number(tagTextSizeSliderEl.value))));
      if (tagTextSizeTextEl) tagTextSizeTextEl.value = String(size);
      applyTextSizePreview(size);
    });
    if (tagTextSizeTextEl) tagTextSizeTextEl.addEventListener("input", () => {
      const n = Math.trunc(Number(tagTextSizeTextEl.value));
      if (!Number.isFinite(n)) return;
      const size = Math.max(80, Math.min(140, n));
      if (tagTextSizeSliderEl) tagTextSizeSliderEl.value = String(size);
      applyTextSizePreview(size);
    });
  }

  let tagBubbleWidthSliderEl = null;
  let tagBubbleWidthTextEl = null;
  const tagBubbleWidthSetting = new Setting(containerEl)
    .setName("Tag bubble size - width")
    .setDesc("Scale tag bubble width (80%..140%).")
    .addSlider((s) => {
      s.setLimits(80, 140, 5);
      s.setDynamicTooltip();
      s.setValue(tagVisuals.tagBubbleWidthPct);
      s.onChange((v) => {
        const next = Math.max(80, Math.min(140, Math.trunc(Number(v))));
        if (tagBubbleWidthTextEl) tagBubbleWidthTextEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { tagBubbleWidthPct: next } } } }, "visual:tags:bubble-width");
      });
      if (!enabled) s.setDisabled(true);
    })
    .addText((txt) => {
      tagBubbleWidthTextEl = txt.inputEl;
      txt.inputEl.style.width = "52px";
      txt.setValue(String(tagVisuals.tagBubbleWidthPct));
      txt.setPlaceholder("100");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const next = Math.max(80, Math.min(140, n));
        if (tagBubbleWidthSliderEl) tagBubbleWidthSliderEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { tagBubbleWidthPct: next } } } }, "visual:tags:bubble-width:text");
      });
      if (!enabled) txt.setDisabled(true);
    });
  for (const el of tagBubbleWidthSetting.controlEl.querySelectorAll("input")) {
    if (el.type === "range") tagBubbleWidthSliderEl = el;
    if (el.type === "text") tagBubbleWidthTextEl = el;
  }
  const tagBubbleWidthPreviewWrap = tagBubbleWidthSetting.controlEl.createEl("span");
  tagBubbleWidthPreviewWrap.style.display = "inline-flex";
  tagBubbleWidthPreviewWrap.style.width = "110px";
  tagBubbleWidthPreviewWrap.style.justifyContent = "center";
  const tagBubbleWidthPreview = tagBubbleWidthPreviewWrap.createEl("span", { text: "#example" });
  {
    const applyBubbleWidthPreview = (bubbleWidthPct) => {
      const st = computeTagVisualStyle(tagVisuals.tagTextSizePct, bubbleWidthPct, tagVisuals.tagBubbleHeightPct, tagVisuals.tagShapePct);
      tagBubbleWidthPreview.style.padding = `${st.verticalPaddingPx}px ${st.horizontalPaddingPx}px`;
      tagBubbleWidthPreview.style.borderRadius = `${st.borderRadiusPx}px`;
      tagBubbleWidthPreview.style.fontSize = `${st.fontSizePx}px`;
      tagBubbleWidthPreview.style.lineHeight = String(st.lineHeight);
    };
    applyBubbleWidthPreview(tagVisuals.tagBubbleWidthPct);
    tagBubbleWidthPreview.style.display = "inline-block";
    tagBubbleWidthPreview.style.border = "1px solid var(--background-modifier-border)";
    tagBubbleWidthPreview.style.background = "#ffffff";
    tagBubbleWidthPreview.style.color = "#111111";
    if (tagBubbleWidthSliderEl) tagBubbleWidthSliderEl.addEventListener("input", () => {
      const size = Math.max(80, Math.min(140, Math.trunc(Number(tagBubbleWidthSliderEl.value))));
      if (tagBubbleWidthTextEl) tagBubbleWidthTextEl.value = String(size);
      applyBubbleWidthPreview(size);
    });
    if (tagBubbleWidthTextEl) tagBubbleWidthTextEl.addEventListener("input", () => {
      const n = Math.trunc(Number(tagBubbleWidthTextEl.value));
      if (!Number.isFinite(n)) return;
      const size = Math.max(80, Math.min(140, n));
      if (tagBubbleWidthSliderEl) tagBubbleWidthSliderEl.value = String(size);
      applyBubbleWidthPreview(size);
    });
  }

  let tagBubbleHeightSliderEl = null;
  let tagBubbleHeightTextEl = null;
  const tagBubbleHeightSetting = new Setting(containerEl)
    .setName("Tag bubble size - height")
    .setDesc("Scale tag bubble height (80%..140%).")
    .addSlider((s) => {
      s.setLimits(80, 140, 5);
      s.setDynamicTooltip();
      s.setValue(tagVisuals.tagBubbleHeightPct);
      s.onChange((v) => {
        const next = Math.max(80, Math.min(140, Math.trunc(Number(v))));
        if (tagBubbleHeightTextEl) tagBubbleHeightTextEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { tagBubbleHeightPct: next } } } }, "visual:tags:bubble-height");
      });
      if (!enabled) s.setDisabled(true);
    })
    .addText((txt) => {
      tagBubbleHeightTextEl = txt.inputEl;
      txt.inputEl.style.width = "52px";
      txt.setValue(String(tagVisuals.tagBubbleHeightPct));
      txt.setPlaceholder("100");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const next = Math.max(80, Math.min(140, n));
        if (tagBubbleHeightSliderEl) tagBubbleHeightSliderEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { tagBubbleHeightPct: next } } } }, "visual:tags:bubble-height:text");
      });
      if (!enabled) txt.setDisabled(true);
    });
  for (const el of tagBubbleHeightSetting.controlEl.querySelectorAll("input")) {
    if (el.type === "range") tagBubbleHeightSliderEl = el;
    if (el.type === "text") tagBubbleHeightTextEl = el;
  }
  const tagBubbleHeightPreviewWrap = tagBubbleHeightSetting.controlEl.createEl("span");
  tagBubbleHeightPreviewWrap.style.display = "inline-flex";
  tagBubbleHeightPreviewWrap.style.width = "110px";
  tagBubbleHeightPreviewWrap.style.justifyContent = "center";
  const tagBubbleHeightPreview = tagBubbleHeightPreviewWrap.createEl("span", { text: "#example" });
  {
    const applyBubbleHeightPreview = (bubbleHeightPct) => {
      const st = computeTagVisualStyle(tagVisuals.tagTextSizePct, tagVisuals.tagBubbleWidthPct, bubbleHeightPct, tagVisuals.tagShapePct);
      tagBubbleHeightPreview.style.padding = `${st.verticalPaddingPx}px ${st.horizontalPaddingPx}px`;
      tagBubbleHeightPreview.style.borderRadius = `${st.borderRadiusPx}px`;
      tagBubbleHeightPreview.style.fontSize = `${st.fontSizePx}px`;
      tagBubbleHeightPreview.style.lineHeight = String(st.lineHeight);
    };
    applyBubbleHeightPreview(tagVisuals.tagBubbleHeightPct);
    tagBubbleHeightPreview.style.display = "inline-block";
    tagBubbleHeightPreview.style.border = "1px solid var(--background-modifier-border)";
    tagBubbleHeightPreview.style.background = "#ffffff";
    tagBubbleHeightPreview.style.color = "#111111";
    if (tagBubbleHeightSliderEl) tagBubbleHeightSliderEl.addEventListener("input", () => {
      const size = Math.max(80, Math.min(140, Math.trunc(Number(tagBubbleHeightSliderEl.value))));
      if (tagBubbleHeightTextEl) tagBubbleHeightTextEl.value = String(size);
      applyBubbleHeightPreview(size);
    });
    if (tagBubbleHeightTextEl) tagBubbleHeightTextEl.addEventListener("input", () => {
      const n = Math.trunc(Number(tagBubbleHeightTextEl.value));
      if (!Number.isFinite(n)) return;
      const size = Math.max(80, Math.min(140, n));
      if (tagBubbleHeightSliderEl) tagBubbleHeightSliderEl.value = String(size);
      applyBubbleHeightPreview(size);
    });
  }

  let emptyBubbleSliderEl = null;
  let emptyBubbleTextEl = null;
  const emptyBubbleSetting = new Setting(containerEl)
    .setName("Empty bubble size")
    .setDesc("Scale empty bubble width (50%..180%).")
    .addSlider((s) => {
      s.setLimits(50, 180, 5);
      s.setDynamicTooltip();
      s.setValue(tagVisuals.emptyBubbleSizePct);
      s.onChange((v) => {
        const next = Math.max(50, Math.min(180, Math.trunc(Number(v))));
        if (emptyBubbleTextEl) emptyBubbleTextEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { emptyBubbleSizePct: next } } } }, "visual:tags:empty-bubble-size");
      });
      if (!enabled) s.setDisabled(true);
    })
    .addText((txt) => {
      emptyBubbleTextEl = txt.inputEl;
      txt.inputEl.style.width = "52px";
      txt.setValue(String(tagVisuals.emptyBubbleSizePct));
      txt.setPlaceholder("100");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const next = Math.max(50, Math.min(180, n));
        if (emptyBubbleSliderEl) emptyBubbleSliderEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { emptyBubbleSizePct: next } } } }, "visual:tags:empty-bubble-size:text");
      });
      if (!enabled) txt.setDisabled(true);
    });
  for (const el of emptyBubbleSetting.controlEl.querySelectorAll("input")) {
    if (el.type === "range") emptyBubbleSliderEl = el;
    if (el.type === "text") emptyBubbleTextEl = el;
  }
  const emptyBubblePreviewWrap = emptyBubbleSetting.controlEl.createEl("span");
  emptyBubblePreviewWrap.style.display = "inline-flex";
  emptyBubblePreviewWrap.style.width = "110px";
  emptyBubblePreviewWrap.style.justifyContent = "center";
  const emptyBubblePreview = emptyBubblePreviewWrap.createEl("span", { text: "\u00a0" });
  emptyBubblePreview.style.display = "inline-block";
  emptyBubblePreview.style.border = "1px solid var(--background-modifier-border)";
  emptyBubblePreview.style.background = "#ffffff";
  emptyBubblePreview.style.color = "#111111";
  const applyEmptyPreview = (emptyPct) => {
    const st = computeTagVisualStyle(tagVisuals.tagTextSizePct, tagVisuals.tagBubbleWidthPct, tagVisuals.tagBubbleHeightPct, tagVisuals.tagShapePct);
    emptyBubblePreview.style.padding = `${st.verticalPaddingPx}px ${st.horizontalPaddingPx}px`;
    emptyBubblePreview.style.width = `${Math.max(8, Math.round(st.horizontalPaddingPx * 2 * (emptyPct / 100)))}px`;
    emptyBubblePreview.style.borderRadius = `${st.borderRadiusPx}px`;
  };
  applyEmptyPreview(tagVisuals.emptyBubbleSizePct);
  if (emptyBubbleSliderEl) emptyBubbleSliderEl.addEventListener("input", () => {
    const n = Math.max(50, Math.min(180, Math.trunc(Number(emptyBubbleSliderEl.value))));
    if (emptyBubbleTextEl) emptyBubbleTextEl.value = String(n);
    applyEmptyPreview(n);
  });
  if (emptyBubbleTextEl) emptyBubbleTextEl.addEventListener("input", () => {
    const n = Math.trunc(Number(emptyBubbleTextEl.value));
    if (!Number.isFinite(n)) return;
    const v = Math.max(50, Math.min(180, n));
    if (emptyBubbleSliderEl) emptyBubbleSliderEl.value = String(v);
    applyEmptyPreview(v);
  });

  let tagShapeSliderEl = null;
  let tagShapeTextEl = null;
  const tagShapeSetting = new Setting(containerEl)
    .setName("Tag shape")
    .setDesc("Round <-> Square")
    .addSlider((s) => {
      s.setLimits(0, 100, 1);
      s.setDynamicTooltip();
      s.setValue(tagVisuals.tagShapePct);
      s.onChange((v) => {
        const next = Math.max(0, Math.min(100, Math.trunc(Number(v))));
        if (tagShapeTextEl) tagShapeTextEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { tagShapePct: next } } } }, "visual:tags:shape");
      });
      if (!enabled) s.setDisabled(true);
    })
    .addText((txt) => {
      tagShapeTextEl = txt.inputEl;
      txt.inputEl.style.width = "52px";
      txt.setValue(String(tagVisuals.tagShapePct));
      txt.setPlaceholder("0");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const next = Math.max(0, Math.min(100, n));
        if (tagShapeSliderEl) tagShapeSliderEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { tagShapePct: next } } } }, "visual:tags:shape:text");
      });
      if (!enabled) txt.setDisabled(true);
    });
  for (const el of tagShapeSetting.controlEl.querySelectorAll("input")) {
    if (el.type === "range") tagShapeSliderEl = el;
    if (el.type === "text") tagShapeTextEl = el;
  }
  const tagShapePreviewWrap = tagShapeSetting.controlEl.createEl("span");
  tagShapePreviewWrap.style.display = "inline-flex";
  tagShapePreviewWrap.style.width = "110px";
  tagShapePreviewWrap.style.justifyContent = "center";
  const tagShapePreview = tagShapePreviewWrap.createEl("span", { text: "#example" });
  {
    const applyShapePreview = (shapePct) => {
      const st = computeTagVisualStyle(tagVisuals.tagTextSizePct, tagVisuals.tagBubbleWidthPct, tagVisuals.tagBubbleHeightPct, shapePct);
      tagShapePreview.style.padding = `${st.verticalPaddingPx}px ${st.horizontalPaddingPx}px`;
      tagShapePreview.style.borderRadius = `${st.borderRadiusPx}px`;
      tagShapePreview.style.fontSize = `${st.fontSizePx}px`;
      tagShapePreview.style.lineHeight = String(st.lineHeight);
    };
    applyShapePreview(tagVisuals.tagShapePct);
    tagShapePreview.style.display = "inline-block";
    tagShapePreview.style.border = "1px solid var(--background-modifier-border)";
    tagShapePreview.style.background = "#ffffff";
    tagShapePreview.style.color = "#111111";
    if (tagShapeSliderEl) tagShapeSliderEl.addEventListener("input", () => {
      const shape = Math.max(0, Math.min(100, Math.trunc(Number(tagShapeSliderEl.value))));
      if (tagShapeTextEl) tagShapeTextEl.value = String(shape);
      applyShapePreview(shape);
    });
    if (tagShapeTextEl) tagShapeTextEl.addEventListener("input", () => {
      const n = Math.trunc(Number(tagShapeTextEl.value));
      if (!Number.isFinite(n)) return;
      const shape = Math.max(0, Math.min(100, n));
      if (tagShapeSliderEl) tagShapeSliderEl.value = String(shape);
      applyShapePreview(shape);
    });
  }

}

function renderVisualStripSection(ctx) {
  const { Setting, containerEl, enabled, cfg, plugin, normalizePkmOrder } = ctx;
  const tagVisuals = readTagVisualsConfig(cfg);
  containerEl.createEl("h4", { text: "Strip" });
  new Setting(containerEl)
    .setName("Activate strip")
    .setDesc("Enable independent strip visualization for selected field.")
    .addToggle((t) => {
      t.setValue(tagVisuals.stripActive).onChange((v) => {
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { active: v === true } } } } }, "visual:tags:strip:active");
      });
      if (!enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Strip field")
    .setDesc("Single tag field from Order used to resolve parent/child strip colors.")
    .addDropdown((d) => {
      const options = collectTagOrderFieldOptions(cfg, normalizePkmOrder);
      d.addOption("", "(not selected)");
      for (const opt of options) d.addOption(opt.key, opt.label);
      const selected = options.some((x) => x.key === tagVisuals.stripFieldId) ? tagVisuals.stripFieldId : "";
      d.setValue(selected);
      d.onChange((v) => {
        const next = String(v || "").trim();
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { fieldId: next } } } } }, "visual:tags:strip:field");
      });
      if (!enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Strip tag visibility")
    .setDesc("On: show the strip-field tag token. Off: hide the strip-field token visually.")
    .addToggle((t) => {
      t.setValue(tagVisuals.stripTagVisibility).onChange((v) => {
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { tagVisibility: v === true } } } } }, "visual:tags:strip:tag-visibility");
        try {
          const tab = plugin && plugin._settingsTab;
          if (tab && typeof tab.display === "function") {
            requestAnimationFrame(() => {
              try { tab.display(); } catch (_) {}
            });
          }
        } catch (_) {}
      });
      if (!enabled) t.setDisabled(true);
    });

  if (tagVisuals.stripTagVisibility === false) {
    new Setting(containerEl)
      .setName("Hide separator?")
      .setDesc("When Off mode hides the only strip-field token in a technical zone, hide the separator in that zone too.")
      .addToggle((t) => {
        t.setValue(tagVisuals.stripHideSeparatorWhenOnlyStripToken).onChange((v) => {
          plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { hideSeparatorWhenOnlyStripToken: v === true } } } } }, "visual:tags:strip:hide-separator");
        });
        if (!enabled) t.setDisabled(true);
      });
  }

  new Setting(containerEl)
    .setName("Strip mode")
    .setDesc("Default: fixed parent rail. Crossing: rotate lower rails.")
    .addDropdown((d) => {
      d.addOption("default", "default");
      d.addOption("crossing", "crossing");
      d.setValue(tagVisuals.stripMode);
      d.onChange((v) => {
        const next = String(v || "default").trim().toLowerCase() === "crossing" ? "crossing" : "default";
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { mode: next } } } } }, "visual:tags:strip:mode");
      });
      if (!enabled) d.setDisabled(true);
    });

  let stripStripesSliderEl = null;
  let stripStripesTextEl = null;
  const stripStripesSetting = new Setting(containerEl)
    .setName("Stripes to show")
    .setDesc("1..3 rails: parent / child / grandchild.")
    .addSlider((s) => {
      s.setLimits(1, 3, 1);
      s.setDynamicTooltip();
      s.setValue(tagVisuals.stripStripesToShow);
      s.onChange((v) => {
        const next = Math.max(1, Math.min(3, Math.trunc(Number(v))));
        if (stripStripesTextEl) stripStripesTextEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { stripesToShow: next } } } } }, "visual:tags:strip:stripes");
      });
      if (!enabled) s.setDisabled(true);
    })
    .addText((txt) => {
      stripStripesTextEl = txt.inputEl;
      txt.inputEl.style.width = "52px";
      txt.setValue(String(tagVisuals.stripStripesToShow));
      txt.setPlaceholder("2");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const next = Math.max(1, Math.min(3, n));
        if (stripStripesSliderEl) stripStripesSliderEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { stripesToShow: next } } } } }, "visual:tags:strip:stripes:text");
      });
      if (!enabled) txt.setDisabled(true);
    });
  for (const el of stripStripesSetting.controlEl.querySelectorAll("input")) {
    if (el.type === "range") stripStripesSliderEl = el;
    if (el.type === "text") stripStripesTextEl = el;
  }

  let stripThicknessSliderEl = null;
  let stripThicknessTextEl = null;
  const stripThicknessSetting = new Setting(containerEl)
    .setName("Strip thickness")
    .setDesc("Strip stroke width in px (1..12).")
    .addSlider((s) => {
      s.setLimits(1, 12, 1);
      s.setDynamicTooltip();
      s.setValue(tagVisuals.stripThickness);
      s.onChange((v) => {
        const next = Math.max(1, Math.min(12, Math.trunc(Number(v))));
        if (stripThicknessTextEl) stripThicknessTextEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { thickness: next } } } } }, "visual:tags:strip:thickness");
      });
      if (!enabled) s.setDisabled(true);
    })
    .addText((txt) => {
      stripThicknessTextEl = txt.inputEl;
      txt.inputEl.style.width = "52px";
      txt.setValue(String(tagVisuals.stripThickness));
      txt.setPlaceholder("2");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const next = Math.max(1, Math.min(12, n));
        if (stripThicknessSliderEl) stripThicknessSliderEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { thickness: next } } } } }, "visual:tags:strip:thickness:text");
      });
      if (!enabled) txt.setDisabled(true);
    });
  for (const el of stripThicknessSetting.controlEl.querySelectorAll("input")) {
    if (el.type === "range") stripThicknessSliderEl = el;
    if (el.type === "text") stripThicknessTextEl = el;
  }

  let stripChildSliderEl = null;
  let stripChildTextEl = null;
  const stripChildSetting = new Setting(containerEl)
    .setName("Parent/child strip distance")
    .setDesc("Horizontal offset between adjacent strip rails (2..20 px).")
    .addSlider((s) => {
      s.setLimits(2, 20, 1);
      s.setDynamicTooltip();
      s.setValue(tagVisuals.stripChildOffset);
      s.onChange((v) => {
        const next = Math.max(2, Math.min(20, Math.trunc(Number(v))));
        if (stripChildTextEl) stripChildTextEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { childOffset: next } } } } }, "visual:tags:strip:child-offset");
      });
      if (!enabled) s.setDisabled(true);
    })
    .addText((txt) => {
      stripChildTextEl = txt.inputEl;
      txt.inputEl.style.width = "52px";
      txt.setValue(String(tagVisuals.stripChildOffset));
      txt.setPlaceholder("12");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const next = Math.max(2, Math.min(20, n));
        if (stripChildSliderEl) stripChildSliderEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { childOffset: next } } } } }, "visual:tags:strip:child-offset:text");
      });
      if (!enabled) txt.setDisabled(true);
    });
  for (const el of stripChildSetting.controlEl.querySelectorAll("input")) {
    if (el.type === "range") stripChildSliderEl = el;
    if (el.type === "text") stripChildTextEl = el;
  }

  let stripSpacingSliderEl = null;
  let stripSpacingTextEl = null;
  const stripSpacingSetting = new Setting(containerEl)
    .setName("Strip spacing")
    .setDesc("Distance from text to parent strip lane (8..48 px).")
    .addSlider((s) => {
      s.setLimits(8, 48, 1);
      s.setDynamicTooltip();
      s.setValue(tagVisuals.stripSpacing);
      s.onChange((v) => {
        const next = Math.max(8, Math.min(48, Math.trunc(Number(v))));
        if (stripSpacingTextEl) stripSpacingTextEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { spacing: next } } } } }, "visual:tags:strip:spacing");
      });
      if (!enabled) s.setDisabled(true);
    })
    .addText((txt) => {
      stripSpacingTextEl = txt.inputEl;
      txt.inputEl.style.width = "52px";
      txt.setValue(String(tagVisuals.stripSpacing));
      txt.setPlaceholder("20");
      txt.onChange((v) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return;
        const next = Math.max(8, Math.min(48, n));
        if (stripSpacingSliderEl) stripSpacingSliderEl.value = String(next);
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { strip: { spacing: next } } } } }, "visual:tags:strip:spacing:text");
      });
      if (!enabled) txt.setDisabled(true);
    });
  for (const el of stripSpacingSetting.controlEl.querySelectorAll("input")) {
    if (el.type === "range") stripSpacingSliderEl = el;
    if (el.type === "text") stripSpacingTextEl = el;
  }

  const stripPreview = containerEl.createDiv();
  stripPreview.style.marginTop = "8px";
  stripPreview.style.padding = "10px";
  stripPreview.style.border = "1px solid var(--background-modifier-border)";
  stripPreview.style.borderRadius = "8px";
  stripPreview.style.background = "var(--background-secondary)";
  stripPreview.createEl("small", { text: "Strip preview" });
  const stripCanvas = stripPreview.createDiv();
  stripCanvas.style.position = "relative";
  stripCanvas.style.height = "94px";
  stripCanvas.style.marginTop = "6px";
  stripCanvas.style.border = "1px dashed var(--background-modifier-border)";
  stripCanvas.style.borderRadius = "6px";
  const colors = ["#ef4444", "#f59e0b", "#22c55e"];
  const rows = [
    { label: "parent", depth: 1, y: 10, textIndent: 0 },
    { label: "child", depth: 2, y: 36, textIndent: 14 },
    { label: "grandchild", depth: 3, y: 62, textIndent: 28 },
  ];
  const rowLaneEls = [];
  const rowTextEls = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const textEl = stripCanvas.createDiv();
    textEl.style.position = "absolute";
    textEl.style.left = `${188 + Number(row.textIndent || 0)}px`;
    textEl.style.top = `${row.y}px`;
    textEl.style.fontSize = "12px";
    textEl.style.opacity = "0.85";
    textEl.setText(row.label);
    rowTextEls.push(textEl);

    const lanes = [];
    for (let i = 0; i < 3; i++) {
      const lane = stripCanvas.createDiv();
      lane.style.position = "absolute";
      lane.style.top = `${row.y - 2}px`;
      lane.style.height = "18px";
      lane.style.background = colors[i] || "#3b82f6";
      lane.style.borderRadius = "1px";
      lanes.push(lane);
    }
    rowLaneEls.push(lanes);
  }
  const applyStripPreview = () => {
    const spacing = stripSpacingSliderEl ? Math.max(8, Math.min(48, Math.trunc(Number(stripSpacingSliderEl.value)))) : tagVisuals.stripSpacing;
    const dist = stripChildSliderEl ? Math.max(2, Math.min(20, Math.trunc(Number(stripChildSliderEl.value)))) : tagVisuals.stripChildOffset;
    const thick = stripThicknessSliderEl ? Math.max(1, Math.min(12, Math.trunc(Number(stripThicknessSliderEl.value)))) : tagVisuals.stripThickness;
    const stripes = stripStripesSliderEl ? Math.max(1, Math.min(3, Math.trunc(Number(stripStripesSliderEl.value)))) : tagVisuals.stripStripesToShow;
    const railBase = Math.max(2, thick);
    const baseTextX = 172;
    const sharedRowBaseX = Math.max(8, baseTextX - (spacing + thick));
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || {};
      const rowDepthMax = rows[r].depth;
      const rowRails = Math.max(1, Math.min(stripes, rowDepthMax));
      const lanes = rowLaneEls[r] || [];
      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        if (!lane) continue;
        if (i < rowRails) {
          lane.style.display = "block";
          lane.style.left = `${sharedRowBaseX + (dist * i)}px`;
          lane.style.width = `${thick}px`;
        } else {
          lane.style.display = "none";
        }
      }
    }
    for (let r = 0; r < rowTextEls.length; r++) {
      const t = rowTextEls[r];
      const row = rows[r] || {};
      if (!t) continue;
      t.style.left = `${baseTextX + Number(row.textIndent || 0)}px`;
    }
  };
  applyStripPreview();
  if (stripSpacingSliderEl) stripSpacingSliderEl.addEventListener("input", applyStripPreview);
  if (stripSpacingTextEl) stripSpacingTextEl.addEventListener("input", applyStripPreview);
  if (stripChildSliderEl) stripChildSliderEl.addEventListener("input", applyStripPreview);
  if (stripChildTextEl) stripChildTextEl.addEventListener("input", applyStripPreview);
  if (stripThicknessSliderEl) stripThicknessSliderEl.addEventListener("input", applyStripPreview);
  if (stripThicknessTextEl) stripThicknessTextEl.addEventListener("input", applyStripPreview);
  if (stripStripesSliderEl) stripStripesSliderEl.addEventListener("input", applyStripPreview);
  if (stripStripesTextEl) stripStripesTextEl.addEventListener("input", applyStripPreview);

}

function renderColorsSection(ctx) {
  const { containerEl, enabled } = ctx;
  containerEl.createEl("h3", { text: "Colors" });

  if (!enabled) {
    const banner = containerEl.createDiv();
    banner.setText("Visual module disabled. Colors settings are read-only.");
    banner.style.padding = "8px 10px";
    banner.style.border = "1px solid var(--background-modifier-border)";
    banner.style.borderRadius = "8px";
    banner.style.marginBottom = "10px";
  }

  const line = containerEl.createDiv();
  line.setText("Colors editor placeholder (HEX + preview) will be added in Sprint 4.");
  line.style.opacity = "0.85";

  const demo = containerEl.createDiv();
  demo.style.marginTop = "8px";
  const chip = demo.createEl("span", { text: "#demo" });
  chip.style.display = "inline-block";
  chip.style.padding = "2px 8px";
  chip.style.borderRadius = "999px";
  chip.style.background = "#1D4ED8";
  chip.style.color = "#ffffff";
  chip.style.opacity = enabled ? "1" : "0.6";
}

function renderAdvancedSection(ctx) {
  const { Setting, Notice, containerEl, cfg, featureOrder, store, flushSettingsNow, plugin, pkmBackends, getActiveTagWheelRulesPath } = ctx;
  containerEl.createEl("h3", { text: "Diagnostics" });

  const diag = containerEl.createDiv();
  diag.style.whiteSpace = "pre-wrap";
  diag.style.fontFamily = "var(--font-monospace)";
  diag.style.fontSize = "12px";
  diag.style.padding = "10px";
  diag.style.border = "1px solid var(--background-modifier-border)";
  diag.style.borderRadius = "8px";

  const enabled = featureOrder.filter((f) => !!cfg.features[f].enabled);
  const disabled = featureOrder.filter((f) => !cfg.features[f].enabled);
  const lastSavedAt = store.getLastSavedAt();
  const lastSavedText = lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "not saved yet";

  diag.setText(
    [
      `schemaVersion: ${cfg.schemaVersion}`,
      `enabledModules: ${enabled.join(", ") || "none"}`,
      `disabledModules: ${disabled.join(", ") || "none"}`,
      `lastSavedAt: ${lastSavedText}`,
    ].join("\n")
  );

  new Setting(containerEl)
    .setName("Flush Settings Now")
    .setDesc("Force immediate save without waiting for debounce.")
    .addButton((b) =>
      b.setButtonText("Flush").onClick(async () => {
        await store.flushNow();
        new Notice("InlineOverhaul: settings saved");
        flushSettingsNow();
      })
    );

  const importNote = containerEl.createDiv();
  importNote.style.marginTop = "10px";
  importNote.style.fontSize = "12px";
  importNote.style.opacity = "0.85";
  importNote.setText("Old import workflow is removed. Plugin runs internal runtime v2 only.");

  containerEl.createEl("h3", { text: "Developer Mode" });

  new Setting(containerEl)
    .setName("Enable Dev Mode")
    .setDesc("Enable session logs for troubleshooting.")
    .addToggle((t) => {
      const cur = cfg && cfg.devMode ? cfg.devMode : {};
      t.setValue(cur.enabled === true).onChange((v) => {
        plugin.setConfigPatch({ devMode: { enabled: v } }, "advanced:devMode:enabled");
      });
    });

  new Setting(containerEl)
    .setName("Generate log for AI?")
    .setDesc("Yes: in addition to human `.md` log, generate detailed AI `.ndjson` log.")
    .addToggle((t) => {
      const cur = cfg && cfg.devMode ? cfg.devMode : {};
      t.setValue(cur.generateAiLog === true).onChange((v) => {
        plugin.setConfigPatch({ devMode: { generateAiLog: v } }, "advanced:devMode:generateAiLog");
      });
      if (!(cur.enabled === true)) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Log Path")
    .setDesc("Base vault-relative path. Plugin writes `<path>.new.*` and `<path>.old.*`.")
    .addText((txt) => {
      const cur = cfg && cfg.devMode ? cfg.devMode : {};
      let pendingPath = String(cur.logPath || "InlineOverhaul_DevLog");
      const commitPath = () => {
        const p = String(pendingPath || "").trim();
        if (!p) return;
        if (p === String(cur.logPath || "InlineOverhaul_DevLog")) return;
        plugin.setConfigPatch({ devMode: { logPath: p } }, "advanced:devMode:logPath");
      };
      txt
        .setPlaceholder("InlineOverhaul_DevLog")
        .setValue(pendingPath)
        .onChange((v) => {
          pendingPath = String(v || "");
        });
      if (txt && txt.inputEl) {
        txt.inputEl.addEventListener("blur", commitPath);
        txt.inputEl.addEventListener("keydown", (evt) => {
          if (!evt || evt.key !== "Enter") return;
          commitPath();
        });
      }
      if (!(cur.enabled === true)) txt.setDisabled(true);
    });

  const pkmEnabled = !!(cfg && cfg.features && cfg.features.pkm && cfg.features.pkm.enabled);
  containerEl.createEl("h3", { text: "PKM Other Settings" });
  new Setting(containerEl)
    .setName("Execution Backend")
    .setDesc("Internal runtime v2 only. Previous backend is removed.")
    .addText((t) => {
      t.setValue(pkmBackends.internalV2);
      t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Active Rules Path")
    .setDesc("Effective generated rules file used by PKM commands and navigation inline.")
    .addText((t) => {
      t
        .setPlaceholder("InlineOverhaul_Generated_RULES_TagWheel.md")
        .setValue(getActiveTagWheelRulesPath(cfg))
        .onChange((v) => {
          const next = String(v || "").trim();
          if (!next) return;
          plugin.setConfigPatch({ pkm: { generatedRulesPath: next } }, "pkm:generatedRulesPath");
        });
      if (!pkmEnabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Regenerate Rules Now")
    .setDesc("Force rewrite generated rules markdown from plugin JSON.")
    .addButton((b) => {
      b.setButtonText("Regenerate").onClick(async () => {
        try {
          await plugin.ensureGeneratedRulesNow("manual");
        } catch (e) {
          console.error("[inline-overhaul][rules-gen]", e);
          new Notice("InlineOverhaul: failed to generate rules");
        }
      });
      if (!pkmEnabled) b.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Open Detailed Template")
    .setDesc("Open detailed markdown template for TagWheel config authoring.")
    .addButton((b) => {
      b.setButtonText("Open detailed template").onClick(async () => {
        try {
          const p = await plugin.openTagWheelConfigTemplateNote();
          new Notice("Detailed template opened: " + p);
        } catch (e) {
          console.error("[inline-overhaul][tagwheel-config-template-open]", e);
          new Notice("InlineOverhaul: " + e.message);
        }
      });
      if (!pkmEnabled) b.setDisabled(true);
    });
}

function renderNavigationSettings(ctx) {
  const { Setting, containerEl, cfg, enabled, plugin } = ctx;
  const nav = cfg.navigation || {};

  containerEl.createEl("h5", { text: "Move Line" });
  new Setting(containerEl)
    .setName("Enable Move Line")
    .setDesc("Command IDs: inlineOverhaul_Navigation_MoveUp / inlineOverhaul_Navigation_MoveDown.")
    .addToggle((t) => {
      t.setValue(!!nav.moveLine.enabled).onChange((v) => {
        plugin.setConfigPatch({ navigation: { moveLine: { enabled: v } } }, "nav:moveLine:enabled");
      });
      if (!enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("No-selection mode")
    .setDesc("When nothing is selected: move only current line, or move line with children by indent.")
    .addDropdown((d) => {
      d.addOption("line-only", "line-only");
      d.addOption("with-children", "with-children");
      d.setValue(nav.moveLine.noSelectionMode || "line-only");
      d.onChange((v) => plugin.setConfigPatch({ navigation: { moveLine: { noSelectionMode: v } } }, "nav:moveLine:noSelectionMode"));
      if (!enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Header mode")
    .setDesc("When cursor is on header: move just header line or whole section.")
    .addDropdown((d) => {
      d.addOption("move-as-line", "move-as-line");
      d.addOption("move-with-section", "move-with-section");
      d.setValue(nav.moveLine.headerMode || "move-as-line");
      d.onChange((v) => plugin.setConfigPatch({ navigation: { moveLine: { headerMode: v } } }, "nav:moveLine:headerMode"));
      if (!enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Cross-section allowed")
    .setDesc("Allow crossing between header sections while moving lines.")
    .addToggle((t) => {
      t.setValue(!!nav.moveLine.crossSectionAllowed).onChange((v) => {
        plugin.setConfigPatch({ navigation: { moveLine: { crossSectionAllowed: v } } }, "nav:moveLine:crossSectionAllowed");
      });
      if (!enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Highlight moved lines")
    .setDesc("When enabled, selection is normalized to full moved lines after Move Up/Down.")
    .addToggle((t) => {
      t.setValue(!!nav.moveLine.highlightMovedLines).onChange((v) => {
        plugin.setConfigPatch({ navigation: { moveLine: { highlightMovedLines: v } } }, "nav:moveLine:highlightMovedLines");
      });
      if (!enabled) t.setDisabled(true);
    });

  containerEl.createEl("h5", { text: "Move Selection" });

  const inlineSection = containerEl.createDiv();
  inlineSection.style.marginLeft = "12px";
  inlineSection.createEl("h4", { text: "Move Selection (Inline Text)" });

  new Setting(inlineSection)
    .setName("Enable inline text move")
    .setDesc("Move selected text inside a single line. Command IDs: inlineOverhaul_Navigation_MoveLeft / inlineOverhaul_Navigation_MoveRight.")
    .addToggle((t) => {
      t.setValue(!!nav.moveSelection.inlineEnabled).onChange((v) => plugin.setConfigPatch({ navigation: { moveSelection: { inlineEnabled: v, enabled: v } } }, "nav:moveSelection:inlineEnabled"));
      if (!enabled) t.setDisabled(true);
    });

  new Setting(inlineSection)
    .setName("Inline move mode")
    .setDesc("For partial single-line selection: auto, force char-swap, force token-jump, or disable inline move.")
    .addDropdown((d) => {
      d.addOption("auto", "auto");
      d.addOption("char", "char");
      d.addOption("word", "word");
      d.addOption("disabled", "disabled");
      d.setValue(nav.moveSelection.inlineMoveMode || "auto");
      d.onChange((v) => plugin.setConfigPatch({ navigation: { moveSelection: { inlineMoveMode: v } } }, "nav:moveSelection:inlineMoveMode"));
      if (!enabled || !nav.moveSelection.inlineEnabled) d.setDisabled(true);
    });

  const prefixSection = containerEl.createDiv();
  prefixSection.style.marginLeft = "12px";
  prefixSection.createEl("h4", { text: "Prefix Cycler" });

  new Setting(prefixSection)
    .setName("Enable PrefixCycler")
    .setDesc("Enable prefix cycling for line-level actions at indent = 0.")
    .addToggle((t) => {
      t.setValue(!!nav.moveSelection.prefixCyclerEnabled).onChange((v) => plugin.setConfigPatch({ navigation: { moveSelection: { prefixCyclerEnabled: v } } }, "nav:moveSelection:prefixCyclerEnabled"));
      if (!enabled) t.setDisabled(true);
    });

  new Setting(prefixSection)
    .setName("Prefix Cycle Order")
    .setDesc("One prefix per line. Works only from the extreme left position (without indent). Right follows this list; Left is mirrored automatically. After the last item, next Right increases indent when 'On cycle end' is set to 'increase indent'.")
    .addTextArea((ta) => {
      ta.setValue((nav.moveSelection.cycleOrder || []).join("\n")).onChange((v) => {
        const arr = String(v || "").split(/\r?\n/);
        plugin.setConfigPatch({ navigation: { moveSelection: { cycleOrder: arr } } }, "nav:moveSelection:cycleOrder");
      });
      ta.inputEl.rows = 6;
      if (!enabled || !nav.moveSelection.prefixCyclerEnabled) ta.setDisabled(true);
    });

  new Setting(prefixSection)
    .setName("On cycle end")
    .setDesc("Action when Right reaches the last prefix in cycle order at indent = 0.")
    .addDropdown((d) => {
      d.addOption("indent", "increase indent");
      d.addOption("wrap", "wrap to first prefix");
      d.setValue(nav.moveSelection.onCycleEnd || "indent");
      d.onChange((v) => plugin.setConfigPatch({ navigation: { moveSelection: { onCycleEnd: v } } }, "nav:moveSelection:onCycleEnd"));
      if (!enabled || !nav.moveSelection.prefixCyclerEnabled) d.setDisabled(true);
    });

  new Setting(prefixSection)
    .setName("Indent fallback")
    .setDesc("If PrefixCycler is off (or no cycle action is applied), hotkeys still change indent level.")
    .addToggle((t) => {
      t.setValue(!!nav.moveSelection.indentFallbackEnabled).onChange((v) => plugin.setConfigPatch({ navigation: { moveSelection: { indentFallbackEnabled: v } } }, "nav:moveSelection:indentFallbackEnabled"));
      if (!enabled) t.setDisabled(true);
    });

  const indentHint = containerEl.createDiv();
  indentHint.setText("Indent width is synced with Obsidian global setting 'Tab width'.");
  indentHint.style.fontSize = "12px";
  indentHint.style.opacity = "0.8";
  indentHint.style.marginBottom = "8px";

  containerEl.createEl("h5", { text: "Jump To Header" });
  new Setting(containerEl)
    .setName("Enable Jump To Header")
    .setDesc("Command IDs: inlineOverhaul_Navigation_JumpHeaderUp / inlineOverhaul_Navigation_JumpHeaderDown.")
    .addToggle((t) => {
      t.setValue(!!nav.jumpToHeader.enabled).onChange((v) => plugin.setConfigPatch({ navigation: { jumpToHeader: { enabled: v } } }, "nav:jump:enabled"));
      if (!enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Center cursor")
    .setDesc("Keep target section around viewport center after jump.")
    .addToggle((t) => {
      t.setValue(!!nav.jumpToHeader.centerCursor).onChange((v) => plugin.setConfigPatch({ navigation: { jumpToHeader: { centerCursor: v } } }, "nav:jump:center"));
      if (!enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Jump mode")
    .setDesc("`edge`: jump between section edges; `line`: jump line-by-line across content.")
    .addDropdown((d) => {
      d.addOption("edge", "jump to edge");
      d.addOption("line", "jump to line");
      d.setValue(nav.jumpToHeader.jumpMode || "edge");
      d.onChange((v) => plugin.setConfigPatch({ navigation: { jumpToHeader: { jumpMode: v } } }, "nav:jump:mode"));
      if (!enabled) d.setDisabled(true);
    });

  if ((nav.jumpToHeader.jumpMode || "edge") === "edge") {
    new Setting(containerEl)
      .setName("Edge behavior")
      .setDesc("Used in `jump to edge` mode only: start/end toggle, start-only, or end-only.")
      .addDropdown((d) => {
        d.addOption("start-end", "start/end");
        d.addOption("start", "start only");
        d.addOption("end", "end only");
        d.setValue(nav.jumpToHeader.edgeMode || "start-end");
        d.onChange((v) => plugin.setConfigPatch({ navigation: { jumpToHeader: { edgeMode: v } } }, "nav:jump:edgeMode"));
        if (!enabled) d.setDisabled(true);
      });
  }

  new Setting(containerEl)
    .setName("Jump cursor position")
    .setDesc("Where cursor lands on target line: start, end, or active text end (before separator zone).")
    .addDropdown((d) => {
      d.addOption("start", "start");
      d.addOption("end", "end");
      d.addOption("section-end", "section end (before separator)");
      d.setValue(nav.jumpToHeader.jumpCursorPosition || "start");
      d.onChange((v) => plugin.setConfigPatch({ navigation: { jumpToHeader: { jumpCursorPosition: v } } }, "nav:jump:cursorPos"));
      if (!enabled) d.setDisabled(true);
    });

  containerEl.createEl("h5", { text: "Navigate Inline" });
  new Setting(containerEl)
    .setName("Enable Navigate Inline")
    .setDesc("Command IDs: inlineOverhaul_Navigation_InlineLeft / inlineOverhaul_Navigation_InlineRight.")
    .addToggle((t) => {
      t.setValue(!!nav.navigateInline.enabled).onChange((v) => plugin.setConfigPatch({ navigation: { navigateInline: { enabled: v } } }, "nav:inline:enabled"));
      if (!enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Step mode")
    .setDesc("word: next token; sentence: next sentence boundary; begin-end: jump directly to zone start/end.")
    .addDropdown((d) => {
      d.addOption("word", "word");
      d.addOption("sentence", "sentence");
      d.addOption("begin-end", "begin/end");
      d.setValue(nav.navigateInline.stepMode || "word");
      d.onChange((v) => plugin.setConfigPatch({ navigation: { navigateInline: { stepMode: v } } }, "nav:inline:stepMode"));
      if (!enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Allow crossing separators")
    .setDesc("Off: strict zone between separators only. On: after boundary, continue navigating through the rest of the line.")
    .addToggle((t) => {
      t.setValue(!!nav.navigateInline.boundaryJump).onChange((v) => plugin.setConfigPatch({ navigation: { navigateInline: { boundaryJump: v } } }, "nav:inline:boundaryJump"));
      if (!enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("On boundary")
    .setDesc("What to do when no next target exists in current direction.")
    .addDropdown((d) => {
      d.addOption("stay", "stay at boundary");
      d.addOption("wrap", "wrap to opposite boundary");
      d.addOption("next-line", "move to next/prev line");
      d.setValue(nav.navigateInline.onBoundary || "wrap");
      d.onChange((v) => plugin.setConfigPatch({ navigation: { navigateInline: { onBoundary: v } } }, "nav:inline:onBoundary"));
      if (!enabled) d.setDisabled(true);
    });

  const hotkeyMap = containerEl.createEl("pre");
  hotkeyMap.style.whiteSpace = "pre-wrap";
  hotkeyMap.style.fontSize = "12px";
  hotkeyMap.style.padding = "8px";
  hotkeyMap.style.border = "1px solid var(--background-modifier-border)";
  hotkeyMap.style.borderRadius = "8px";
  hotkeyMap.setText([
    "Hotkey command ids:",
    "- inlineOverhaul_Navigation_MoveUp",
    "- inlineOverhaul_Navigation_MoveDown",
    "- inlineOverhaul_Navigation_MoveLeft",
    "- inlineOverhaul_Navigation_MoveRight",
    "- inlineOverhaul_Navigation_JumpHeaderUp",
    "- inlineOverhaul_Navigation_JumpHeaderDown",
    "- inlineOverhaul_Navigation_InlineLeft",
    "- inlineOverhaul_Navigation_InlineRight",
  ].join("\n"));
}

function renderModuleTabSection(ctx) {
  const {
    Setting,
    containerEl,
    featureKey,
    cfg,
    featureMeta,
    renderNavigationSettings,
    renderTransformSettings,
    renderPkmSettings,
  } = ctx;

  const enabled = !!cfg.features[featureKey].enabled;

  if (!enabled) {
    const banner = containerEl.createDiv({ cls: "inline-overhaul-disabled-banner" });
    banner.setText("Module disabled. Settings are read-only.");
    banner.style.padding = "8px 10px";
    banner.style.border = "1px solid var(--background-modifier-border)";
    banner.style.borderRadius = "8px";
    banner.style.marginBottom = "10px";
    banner.style.opacity = "0.9";
  }

  if (featureKey === "navigation") {
    renderNavigationSettings(containerEl, cfg, enabled);
  } else if (featureKey === "pkm") {
    renderPkmSettings(containerEl, cfg, enabled);
  } else if (featureKey === "transform") {
    if (typeof renderTransformSettings === "function") {
      renderTransformSettings(containerEl, cfg, enabled);
    } else {
      new Setting(containerEl)
        .setName("Transform module unavailable")
        .setDesc("Transform settings renderer is not loaded.")
        .addText((txt) => {
          txt.setValue("Fallback active");
          txt.setDisabled(true);
        });
    }
  } else {
    new Setting(containerEl)
      .setName("Module placeholder")
      .setDesc("Implementation arrives in next sprint.")
      .addText((txt) => {
        txt.setValue("Sprint scaffold");
        txt.setDisabled(true);
      });
  }
}

function renderGeneralSection(ctx) {
  const { Setting, Notice, containerEl, cfg, featureOrder, featureMeta, plugin } = ctx;

  containerEl.createEl("h3", { text: "Global Modules" });

  for (const feature of featureOrder) {
    new Setting(containerEl)
      .setName(`${featureMeta[feature].label} module`)
      .setDesc(`Enable/disable ${featureMeta[feature].label.toLowerCase()} functionality globally.`)
      .addToggle((t) =>
        t
          .setValue(!!cfg.features[feature].enabled)
          .onChange((v) => plugin.setConfigPatch({ features: { [feature]: { enabled: v } } }, `toggle:${feature}`))
      );
  }

  new Setting(containerEl)
    .setName("Undo last settings change")
    .setDesc("Rollback one step from settings undo stack.")
    .addButton((b) =>
      b.setButtonText("Undo").onClick(() => {
        const ok = plugin.store.undo("settings:undo");
        if (!ok) new Notice("InlineOverhaul: nothing to undo");
      })
    );
}

function renderEnhancedSelectAllSection(ctx) {
  const { Setting, containerEl, cfg, plugin, includeSubheader } = ctx;

  if (includeSubheader) {
    const enhanceSubheader = containerEl.createDiv({ text: "Enhance Ctrl/Cmd + A" });
    enhanceSubheader.style.fontSize = "var(--font-ui-small)";
    enhanceSubheader.style.fontWeight = "600";
    enhanceSubheader.style.opacity = "0.85";
    enhanceSubheader.style.marginTop = "4px";
    enhanceSubheader.style.marginBottom = "4px";
  }

  new Setting(containerEl)
    .setName("Enhanced Mod+A")
    .setDesc("Enhance Ctrl+A / Cmd+A with multi-press selection scopes.")
    .addToggle((t) => {
      t.setValue(!!cfg.globalFunctions.enhancedSelectAll.enabled).onChange((v) => {
        plugin.setConfigPatch({ globalFunctions: { enhancedSelectAll: { enabled: v } } }, "general:enhancedSelectAll:enabled");
      });
    });

  new Setting(containerEl)
    .setName("Select-all mode")
    .setDesc("Choose selection sequence by repeated Ctrl+A / Cmd+A presses.")
    .addDropdown((d) => {
      d.addOption("line-note", "1x line -> 2x whole note");
      d.addOption("line-tree-note", "1x line -> 2x tree -> 3x whole note");
      d.addOption("line-tree-header-note", "1x line -> 2x tree -> 3x current header -> 4x whole note");
      d.setValue(cfg.globalFunctions.enhancedSelectAll.mode || "line-note");
      d.onChange((v) => {
        plugin.setConfigPatch({ globalFunctions: { enhancedSelectAll: { mode: v } } }, "general:enhancedSelectAll:mode");
      });
      if (!cfg.globalFunctions.enhancedSelectAll.enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Use multi-press delay")
    .setDesc("When on, repeated presses are tracked by delay timer. When off, next scope is inferred from current selection context.")
    .addToggle((t) => {
      t.setValue(!!cfg.globalFunctions.enhancedSelectAll.useMultiPressDelay).onChange((v) => {
        plugin.setConfigPatch({ globalFunctions: { enhancedSelectAll: { useMultiPressDelay: v } } }, "general:enhancedSelectAll:useDelay");
      });
      if (!cfg.globalFunctions.enhancedSelectAll.enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Multi-press delay")
    .setDesc("Delay threshold for timer-based cycle mode.")
    .addSlider((s) => {
      s.setLimits(250, 2000, 50);
      s.setValue(Number(cfg.globalFunctions.enhancedSelectAll.delayMs) || 700);
      s.setDynamicTooltip();
      s.onChange((v) => {
        plugin.setConfigPatch({ globalFunctions: { enhancedSelectAll: { delayMs: Math.max(250, Math.min(2000, Math.floor(v))) } } }, "general:enhancedSelectAll:delayMs");
      });
      if (!cfg.globalFunctions.enhancedSelectAll.enabled || !cfg.globalFunctions.enhancedSelectAll.useMultiPressDelay) s.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Last press clears selection")
    .setDesc("After reaching the last scope, next press collapses selection and restores cursor to cycle origin.")
    .addToggle((t) => {
      t.setValue(!!cfg.globalFunctions.enhancedSelectAll.clearSelectionOnLastPress).onChange((v) => {
        plugin.setConfigPatch({ globalFunctions: { enhancedSelectAll: { clearSelectionOnLastPress: v } } }, "general:enhancedSelectAll:clearOnLast");
      });
      if (!cfg.globalFunctions.enhancedSelectAll.enabled) t.setDisabled(true);
    });
}

function renderHotkeysTabSection(ctx) {
  const { containerEl, cfg, hotkeysSubTabs, setHotkeysSubTab, Setting, plugin } = ctx;
  const activeSubTab = cfg.ui.hotkeysSubTab || "global";

  const row = containerEl.createDiv({ cls: "inline-overhaul-subtab-row" });
  row.style.display = "flex";
  row.style.flexWrap = "wrap";
  row.style.gap = "6px";
  row.style.marginBottom = "10px";

  for (const st of hotkeysSubTabs) {
    const btn = row.createEl("button", { text: st.label, cls: "mod-cta" });
    btn.style.padding = "3px 8px";
    btn.style.opacity = st.id === activeSubTab ? "1" : "0.8";
    btn.onclick = () => setHotkeysSubTab(st.id);
  }

  if (activeSubTab === "binder") {
    const binderRows = Array.isArray(cfg && cfg.ui && cfg.ui.binderRows) ? cfg.ui.binderRows : [];
    const holder = containerEl.createDiv({ cls: "inline-overhaul-binder" });
    holder.style.display = "grid";
    holder.style.gap = "10px";

    const card = holder.createDiv();
    card.style.border = "1px solid var(--background-modifier-border)";
    card.style.borderRadius = "10px";
    card.style.background = "var(--background-secondary)";
    card.style.overflow = "hidden";

    const tip = holder.createEl("small", { text: "Bind commands via Obsidian Settings -> Hotkeys." });
    tip.style.opacity = "0.9";
    const roTip = holder.createEl("small", { text: "Only Description is editable. To change Insert text or Command name: delete row and add a new one." });
    roTip.style.opacity = "0.75";

    const head = card.createDiv();
    head.style.display = "grid";
    head.style.gridTemplateColumns = "26px minmax(130px, 0.75fr) minmax(130px, 0.75fr) minmax(170px, 0.95fr) minmax(170px, 1.25fr) 30px";
    head.style.gap = "8px";
    head.style.padding = "8px 10px";
    head.style.borderBottom = "1px solid var(--background-modifier-border)";
    head.style.fontSize = "12px";
    head.style.opacity = "0.85";
    head.createEl("div");
    head.createEl("div", { text: "Token" });
    head.createEl("div", { text: "Command name" });
    head.createEl("div", { text: "Description" });
    const cmdHead = head.createDiv();
    cmdHead.createEl("div", { text: "Command ID" });
    const cmdHeadPrefix = cmdHead.createEl("small", { text: "inlineOverhaul_Binder_*" });
    cmdHeadPrefix.style.display = "block";
    cmdHeadPrefix.style.opacity = "0.75";
    head.createEl("div");

    const list = card.createDiv();
    const rows = Array.isArray(binderRows) ? binderRows : [];
    const formatCommandIdDisplay = (commandId) => {
      const full = String(commandId || "").trim();
      const prefix = "inlineOverhaul_Binder_";
      const suffix = full.startsWith(prefix) ? full.slice(prefix.length) : full;
      return `*_${suffix || "item"}`;
    };
    const styleReadonly = (el) => {
      if (!el) return;
      el.style.background = "var(--background-modifier-border-hover)";
      el.style.opacity = "0.82";
      el.style.cursor = "not-allowed";
      el.style.filter = "saturate(0.7)";
      el.style.color = "var(--text-muted)";
      el.style.borderColor = "var(--background-modifier-border)";
    };
    const persistRows = (nextRows, reason, opts) => {
      const options = opts && typeof opts === "object" ? opts : {};
      const shouldRegisterCommands = options.registerCommands !== false;
      plugin.setConfigPatch({ ui: { binderRows: nextRows } }, reason || "settings:binder:rows");
      if (shouldRegisterCommands && plugin && typeof plugin.registerBinderCommands === "function") {
        try { plugin.registerBinderCommands(); } catch (_) {}
      }
      deferRefreshSettings(refreshSettings);
    };
    const renderRow = (row, idx) => {
      const current = row && typeof row === "object" ? row : {};
      const rowId = String(current.rowId || "").trim();
      const insertText = String(current.insertText || "");
      const commandName = String(current.commandName || "");
      const description = String(current.description || "");
      const commandId = String(current.commandId || "").trim();

      const line = list.createDiv();
      line.style.display = "grid";
      line.style.gridTemplateColumns = "26px minmax(130px, 0.75fr) minmax(130px, 0.75fr) minmax(170px, 0.95fr) minmax(170px, 1.25fr) 30px";
      line.style.gap = "8px";
      line.style.padding = "8px 10px";
      if (idx < rows.length - 1) line.style.borderBottom = "1px solid var(--background-modifier-border)";
      line.setAttr("draggable", "true");
      line.dataset.ioBinderRowId = rowId;

      line.addEventListener("dragstart", (ev) => {
        try {
          if (ev && ev.dataTransfer) {
            ev.dataTransfer.effectAllowed = "move";
            ev.dataTransfer.setData("text/plain", rowId);
          }
        } catch (_) {}
        line.style.opacity = "0.5";
      });
      line.addEventListener("dragend", () => {
        line.style.opacity = "1";
      });
      line.addEventListener("dragover", (ev) => {
        if (ev) ev.preventDefault();
        line.style.background = "var(--background-modifier-hover)";
      });
      line.addEventListener("dragleave", () => {
        line.style.background = "";
      });
      line.addEventListener("drop", (ev) => {
        if (ev) ev.preventDefault();
        line.style.background = "";
        let dragged = "";
        try {
          dragged = ev && ev.dataTransfer ? String(ev.dataTransfer.getData("text/plain") || "").trim() : "";
        } catch (_) {
          dragged = "";
        }
        const target = rowId;
        if (!dragged || !target || dragged === target) return;
        const next = rows.slice();
        const fromIdx = next.findIndex((r) => String(r && r.rowId || "").trim() === dragged);
        const toIdx = next.findIndex((r) => String(r && r.rowId || "").trim() === target);
        if (fromIdx === -1 || toIdx === -1) return;
        const moved = next.splice(fromIdx, 1)[0];
        next.splice(toIdx, 0, moved);
        persistRows(next, "settings:binder:reorder");
      });

      const handle = line.createEl("div", { text: "⋮⋮" });
      handle.style.cursor = "grab";
      handle.style.userSelect = "none";
      handle.style.opacity = "0.75";
      handle.style.display = "flex";
      handle.style.alignItems = "center";
      handle.style.justifyContent = "center";

      const textInput = line.createEl("input");
      textInput.type = "text";
      textInput.value = insertText;
      textInput.disabled = true;
      textInput.style.width = "100%";
      textInput.style.minWidth = "0";
      styleReadonly(textInput);

      const nameInput = line.createEl("input");
      nameInput.type = "text";
      nameInput.value = commandName;
      nameInput.disabled = true;
      nameInput.style.width = "100%";
      nameInput.style.minWidth = "0";
      styleReadonly(nameInput);

      const descInput = line.createEl("input");
      descInput.type = "text";
      descInput.value = description;
      descInput.placeholder = "Optional description";
      descInput.style.width = "100%";
      descInput.style.minWidth = "0";
      descInput.onchange = () => {
        const nextDesc = String(descInput.value || "");
        const next = rows.map((r) => {
          const rid = String(r && r.rowId || "").trim();
          if (rid !== rowId) return r;
          return { ...r, description: nextDesc };
        });
        persistRows(next, "settings:binder:description", { registerCommands: false });
      };

      const idCode = line.createEl("code", { text: formatCommandIdDisplay(commandId) });
      idCode.setAttr("title", commandId);
      idCode.style.alignSelf = "center";
      idCode.style.userSelect = "text";
      idCode.style.whiteSpace = "nowrap";
      idCode.style.display = "block";
      idCode.style.padding = "6px 8px";
      idCode.style.borderRadius = "6px";
      idCode.style.minWidth = "0";
      idCode.style.maxWidth = "100%";
      idCode.style.textOverflow = "ellipsis";
      idCode.style.overflow = "hidden";
      styleReadonly(idCode);

      const delBtn = line.createEl("button", { text: "🗑" });
      delBtn.setAttr("aria-label", "Delete binder row");
      delBtn.style.width = "26px";
      delBtn.style.height = "28px";
      delBtn.style.padding = "0";
      delBtn.style.lineHeight = "1";
      delBtn.style.justifySelf = "center";
      delBtn.onclick = () => {
        const next = rows.filter((r) => String(r && r.rowId || "").trim() !== rowId);
        persistRows(next, "settings:binder:delete");
      };
    };
    rows.forEach(renderRow);

    const addRow = holder.createDiv();
    addRow.style.display = "grid";
    addRow.style.gridTemplateColumns = "minmax(130px, 0.75fr) minmax(130px, 0.75fr) minmax(170px, 0.95fr) auto";
    addRow.style.gap = "8px";
    const input = addRow.createEl("input");
    input.type = "text";
    input.placeholder = "Insert token (symbol/emoji/letter)";
    const nameInput = addRow.createEl("input");
    nameInput.type = "text";
    nameInput.placeholder = "Command name (optional)";
    const descInput = addRow.createEl("input");
    descInput.type = "text";
    descInput.placeholder = "Description (optional)";
    const addBtn = addRow.createEl("button", { text: "Add row", cls: "mod-cta" });
    const buildId = (text, usedSet) => {
      const source = String(text || "").trim();
      const collapsed = source.replace(/\s+/g, "_");
      const clean = collapsed.replace(/[^A-Za-z0-9_\-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      const base = `inlineOverhaul_Binder_${clean || "item"}`;
      let id = base;
      let n = 2;
      while (usedSet.has(id)) {
        id = `${base}_${n}`;
        n += 1;
      }
      return id;
    };
    addBtn.onclick = () => {
      const text = String(input.value || "");
      if (!text.trim()) return;
      const cmdName = String(nameInput.value || "");
      const desc = String(descInput.value || "");
      const used = new Set(rows.map((r) => String(r && r.commandId || "").trim()).filter(Boolean));
      const seed = cmdName.trim() || text;
      const commandId = buildId(seed, used);
      const rowId = `binder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next = rows.concat([{ rowId, insertText: text, commandName: cmdName, description: desc, commandId }]);
      persistRows(next, "settings:binder:add");
    };
    return;
  }

  renderEnhancedSelectAllSection({
    Setting,
    containerEl,
    cfg,
    plugin,
    includeSubheader: false,
  });
}

function renderTabBarSection(ctx) {
  const { containerEl, activeTab, settingsTabs, setActiveSettingsTab } = ctx;
  const row = containerEl.createDiv({ cls: "inline-overhaul-tab-row" });
  row.style.display = "flex";
  row.style.flexWrap = "wrap";
  row.style.gap = "8px";
  row.style.marginBottom = "10px";

  for (const t of settingsTabs) {
    const btn = row.createEl("button", { text: t.label, cls: "mod-cta" });
    btn.style.padding = "4px 10px";
    btn.style.opacity = t.id === activeTab ? "1" : "0.8";
    btn.onclick = () => setActiveSettingsTab(t.id);
  }
}

function renderSettingsDisplaySection(ctx) {
  const {
    containerEl,
    cfg,
    getActiveSettingsTab,
    renderTabBar,
    renderSettingsTabContent,
  } = ctx;

  const activeTab = getActiveSettingsTab(cfg);

  containerEl.createEl("h2", { text: "InlineOverhaul" });

  renderTabBar(containerEl, activeTab);
  renderSettingsTabContent(activeTab, containerEl, cfg);
  normalizeSettingsTypography(containerEl);
  normalizeSettingsVisualSystem(containerEl);
}

function renderVisualTabSection(ctx) {
  const {
    containerEl,
    cfg,
    visualSubTabs,
    setVisualSubTab,
    renderVisualGeneralSection,
    renderVisualTagsSection,
    renderVisualStripSection,
    Setting,
    plugin,
    normalizePkmOrder,
  } = ctx;

  const enabled = !!cfg.features.visual.enabled;
  const activeSubTab = cfg.ui.visualSubTab || "tags";

  if (!enabled) {
    const banner = containerEl.createDiv({ cls: "inline-overhaul-disabled-banner" });
    banner.setText("Module disabled. Settings are read-only.");
    banner.style.padding = "8px 10px";
    banner.style.border = "1px solid var(--background-modifier-border)";
    banner.style.borderRadius = "8px";
    banner.style.marginBottom = "10px";
    banner.style.opacity = "0.9";
  }

  const row = containerEl.createDiv({ cls: "inline-overhaul-subtab-row" });
  row.style.display = "flex";
  row.style.flexWrap = "wrap";
  row.style.gap = "6px";
  row.style.marginBottom = "10px";

  for (const st of visualSubTabs) {
    const btn = row.createEl("button", { text: st.label, cls: "mod-cta" });
    btn.style.padding = "3px 8px";
    btn.style.opacity = st.id === activeSubTab ? "1" : "0.8";
    btn.onclick = () => setVisualSubTab(st.id);
  }

  if (activeSubTab === "tagwheel") {
    renderVisualGeneralSection({ Setting, containerEl, enabled, cfg, plugin });
    return;
  }
  if (activeSubTab === "strip") {
    renderVisualStripSection({ Setting, containerEl, enabled, cfg, plugin, normalizePkmOrder });
    return;
  }
  renderVisualTagsSection({ Setting, containerEl, enabled, cfg, plugin });
}

function renderPkmOrderBoardSection(ctx) {
  const { Setting, Notice, Modal, containerEl, cfg, enabled, plugin, normalizePkmOrder, pkmOrderFields, setIcon } = ctx;
  const activePkmSubTab = String(cfg && cfg.ui && cfg.ui.pkmSubTab || "main").trim() === "behavior" ? "behavior" : "main";
  const pkmSubTabs = [
    { id: "main", label: "Main" },
    { id: "behavior", label: "Behavior" },
  ];
  const pkmSubRow = containerEl.createDiv({ cls: "inline-overhaul-subtab-row" });
  pkmSubRow.style.display = "flex";
  pkmSubRow.style.flexWrap = "wrap";
  pkmSubRow.style.gap = "6px";
  pkmSubRow.style.marginBottom = "10px";
  for (const st of pkmSubTabs) {
    const btn = pkmSubRow.createEl("button", { text: st.label, cls: "mod-cta" });
    btn.style.padding = "3px 8px";
    btn.style.opacity = st.id === activePkmSubTab ? "1" : "0.8";
    btn.disabled = !enabled || st.id === activePkmSubTab;
    btn.onclick = () => {
      if (!enabled) return;
      plugin.setConfigPatch({ ui: { pkmSubTab: st.id } }, "settings:pkm-subtab");
    };
  }
  if (activePkmSubTab !== "main") return;
  const deepState = getOrderDeepEditorState();
  const CONFLICT_FLAG = String(deepState.IO_BETA_CONFLICT_DIALOG || "IO_BETA_CONFLICT_DIALOG");
  const historyLimit = Number.isFinite(Number(deepState.IO_TEMP_HISTORY_LIMIT)) ? Number(deepState.IO_TEMP_HISTORY_LIMIT) : 100;
  if (!plugin._orderDeepEditorSession) {
    plugin._orderDeepEditorSession = {
      enabled: true,
      dirty: false,
      expanded: {},
      history: typeof deepState.createHistory === "function" ? deepState.createHistory(historyLimit) : { past: [], future: [] },
    };
  }
  const deepSession = plugin._orderDeepEditorSession;
  const setDirty = (v) => {
    deepSession.dirty = v === true;
  };
  const markSnapshot = (snapshot) => {
    if (typeof deepState.pushHistory !== "function") return;
    deepSession.history = deepState.pushHistory(deepSession.history, snapshot);
    setDirty(true);
  };
  const resetHistory = () => {
    if (typeof deepState.resetHistory === "function") {
      deepSession.history = deepState.resetHistory(deepSession.history);
    } else {
      deepSession.history = { past: [], future: [] };
    }
    setDirty(false);
  };

  const order = normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.order : null);
  const setOrderPatch = (patchObj, reason, opts) => {
    const live = plugin.getConfig();
    const current = normalizePkmOrder(live && live.pkm && live.pkm.behavior ? live.pkm.behavior.order : null);
    const replace = !!(opts && opts.replace === true);
    const next = replace
      ? normalizePkmOrder(patchObj)
      : normalizePkmOrder({
        ...current,
        ...patchObj,
        lead: { ...current.lead, ...(patchObj && patchObj.lead ? patchObj.lead : {}) },
        active: { ...current.active, ...(patchObj && patchObj.active ? patchObj.active : {}) },
        freeRoam: { ...current.freeRoam, ...(patchObj && patchObj.freeRoam ? patchObj.freeRoam : {}) },
        enabled: { ...current.enabled, ...(patchObj && patchObj.enabled ? patchObj.enabled : {}) },
        types: { ...current.types, ...(patchObj && patchObj.types ? patchObj.types : {}) },
        labels: { ...current.labels, ...(patchObj && patchObj.labels ? patchObj.labels : {}) },
        strictNames: { ...current.strictNames, ...(patchObj && patchObj.strictNames ? patchObj.strictNames : {}) },
      });
    const withTombstones = (nextMap, curMap) => {
      const out = { ...(nextMap || {}) };
      const cur = curMap || {};
      for (const k of Object.keys(cur)) {
        if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = null;
      }
      return out;
    };
    if (!replace) {
      const orderPatch = {
        ...next,
        lead: withTombstones(next.lead, current.lead),
      };
      plugin.setConfigPatch({ pkm: { behavior: { order: orderPatch } } }, reason);
      return;
    }
    const orderPatch = {
      ...next,
      lead: withTombstones(next.lead, current.lead),
      labels: withTombstones(next.labels, current.labels),
      strictNames: withTombstones(next.strictNames, current.strictNames),
      types: withTombstones(next.types, current.types),
      active: withTombstones(next.active, current.active),
      freeRoam: withTombstones(next.freeRoam, current.freeRoam),
      enabled: withTombstones(next.enabled, current.enabled),
    };
    plugin.setConfigPatch({ pkm: { behavior: { order: orderPatch } } }, reason);
  };
  const inferSubKey = (parentKey) => {
    const p = String(parentKey || "").trim();
    if (!p) return "";
    return `${p}_sub`;
  };
  const confirmDeleteModal = (fieldKey) => new Promise((resolve) => {
    if (typeof Modal !== "function" || !plugin || !plugin.app) {
      resolve(window.confirm(`InlineOverhaul: delete field '${fieldKey}'?`));
      return;
    }
    class DeleteFieldModal extends Modal {
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h3", { text: "Delete field" });
        contentEl.createEl("p", { text: `Delete field '${fieldKey}' from Order and config?` });
        const row = contentEl.createDiv();
        row.style.display = "flex";
        row.style.justifyContent = "flex-end";
        row.style.gap = "8px";
        row.style.marginTop = "12px";
        const cancelBtn = row.createEl("button", { text: "Cancel" });
        const delBtn = row.createEl("button", { text: "Delete", cls: "mod-warning" });
        cancelBtn.onclick = () => {
          resolve(false);
          this.close();
        };
        delBtn.onclick = () => {
          resolve(true);
          this.close();
        };
      }
      onClose() {
        this.contentEl.empty();
      }
    }
    const modal = new DeleteFieldModal(plugin.app);
    modal.open();
  });

  const uiCfg = cfg && cfg.ui && typeof cfg.ui === "object" ? cfg.ui : {};
  const showInfoTips = uiCfg.orderShowInfoTips === true;
  const showDeepEditor = uiCfg.orderShowDeepEditor !== false;
  const showColorSettingsUi = uiCfg.orderShowColorSettings !== false;

  const orderWrap = containerEl.createDiv();
  orderWrap.classList.add("io-order-wrap");
  orderWrap.style.border = "1px solid var(--background-modifier-border)";
  orderWrap.style.borderRadius = "8px";
  orderWrap.style.padding = "8px 9px";
  orderWrap.style.marginBottom = "8px";
  const orderHeader = orderWrap.createEl("div", { text: "Order" });
  orderHeader.style.fontSize = "14px";
  orderHeader.style.fontWeight = "600";
  orderHeader.style.lineHeight = "1.25";
  orderHeader.style.margin = "0 0 2px 0";
  if (showInfoTips) {
    const tipsBlock = orderWrap.createEl("details");
    tipsBlock.style.margin = "2px 0 6px";
    const sm = tipsBlock.createEl("summary", { text: "Info & Tips" });
    sm.style.cursor = "pointer";
    tipsBlock.createEl("div", { text: "Drag rows inside panels. Left/Right panels are stacked for compact view. Display affects panel label only; strict is system key for config/runtime. Active: yes/no/hotkey_only. Free roam controls non-prefix insertion policy per field." });
  }
  deepSession.enabled = true;

  const tableSettings = orderWrap.createDiv();
  tableSettings.classList.add("io-order-settings-card");
  tableSettings.style.border = "1px solid var(--background-modifier-border)";
  tableSettings.style.borderRadius = "8px";
  tableSettings.style.padding = "6px 8px";
  tableSettings.style.marginBottom = "6px";
  const tableSettingsTitle = tableSettings.createEl("div", { text: "Order Settings" });
  tableSettingsTitle.style.fontSize = "12px";
  tableSettingsTitle.style.fontWeight = "600";
  tableSettingsTitle.style.lineHeight = "1.25";
  tableSettingsTitle.style.margin = "0 0 2px 0";
  new Setting(tableSettings)
    .setName("Show Info & Tips")
    .addToggle((t) => {
      t.setValue(showInfoTips).onChange((v) => {
        plugin.setConfigPatch({ ui: { orderShowInfoTips: v === true } }, "settings:ui:orderShowInfoTips");
        deferRefreshSettings(refreshSettings);
      });
      if (!enabled) t.setDisabled(true);
    });
  new Setting(tableSettings)
    .setName("Show DeepEditor")
    .addToggle((t) => {
      t.setValue(showDeepEditor).onChange((v) => {
        plugin.setConfigPatch({ ui: { orderShowDeepEditor: v === true } }, "settings:ui:orderShowDeepEditor");
        deferRefreshSettings(refreshSettings);
      });
      if (!enabled) t.setDisabled(true);
    });
  const colorSettingRow = new Setting(tableSettings)
    .setName("Show Color Settings")
    .addToggle((t) => {
      t.setValue(showColorSettingsUi).onChange((v) => {
        plugin.setConfigPatch({ ui: { orderShowColorSettings: v === true } }, "settings:ui:orderShowColorSettings");
        deferRefreshSettings(refreshSettings);
      });
      if (!enabled || !showDeepEditor) t.setDisabled(true);
    });
  if (!showDeepEditor && colorSettingRow && colorSettingRow.settingEl) colorSettingRow.settingEl.style.opacity = "0.55";

  const historyRow = orderWrap.createDiv();
  historyRow.style.display = "flex";
  historyRow.style.alignItems = "center";
  historyRow.style.gap = "6px";
  historyRow.style.margin = "4px 0 8px";
  const mainTableSubHeader = historyRow.createEl("div", { text: "Order Main Table" });
  mainTableSubHeader.style.fontSize = "12px";
  mainTableSubHeader.style.fontWeight = "600";
  mainTableSubHeader.style.lineHeight = "1.25";
  const applyDraftBtn = historyRow.createEl("button", { text: "Apply Draft", cls: "mod-cta" });
  const historyRight = historyRow.createDiv();
  historyRight.style.marginLeft = "auto";
  historyRight.style.display = "flex";
  historyRight.style.alignItems = "center";
  historyRight.style.justifyContent = "flex-end";
  historyRight.style.gap = "6px";
  const undoBtn = historyRight.createEl("button", { text: "↶" });
  const redoBtn = historyRight.createEl("button", { text: "↷" });
  const draftInfo = historyRight.createEl("small", { text: "" });
  const refreshDraftInfo = () => {
    const cnt = Array.isArray(deepSession.history && deepSession.history.past) ? deepSession.history.past.length : 0;
    const dirty = deepSession.dirty === true;
    draftInfo.setText(dirty ? `| ${cnt}` : "| -");
    undoBtn.disabled = !enabled || cnt === 0;
    redoBtn.disabled = !enabled || !(Array.isArray(deepSession.history && deepSession.history.future) && deepSession.history.future.length);
    applyDraftBtn.disabled = !enabled || !dirty;
  };

  const orderState = normalizePkmOrder(order);
  const getOrderKeys = () => {
    const out = [];
    const push = (k) => {
      const key = String(k || "").trim();
      if (!key || /_sub$/.test(key)) return;
      if (!out.includes(key)) out.push(key);
    };
    for (const k of pkmOrderFields) push(k);
    for (const k of (orderState.left || [])) push(k);
    for (const k of (orderState.right || [])) push(k);
    for (const k of Object.keys(orderState.labels || {})) push(k);
    for (const k of Object.keys(orderState.strictNames || {})) push(k);
    for (const k of Object.keys(orderState.active || {})) push(k);
    for (const k of Object.keys(orderState.freeRoam || {})) push(k);
    for (const k of Object.keys(orderState.types || {})) push(k);
    return out;
  };
  const typeLabelByKind = {
    tag: "#tag",
    wikilink: "[[link]]",
    element: "element",
  };
  const getFieldKind = (k) => {
    const raw = String(orderState.types && orderState.types[k] ? orderState.types[k] : "").trim().toLowerCase();
    if (raw === "tag" || raw === "wikilink" || raw === "element") return raw;
    return "tag";
  };
  const getTagVisualRuntime = () => readTagVisualsConfig(plugin.getConfig());
  const getTagVisualRow = (fieldId, token) => {
    const fid = String(fieldId || "").trim();
    const tok = String(token || "").trim();
    const visuals = plugin.getConfig() && plugin.getConfig().pkm && plugin.getConfig().pkm.behavior
      ? plugin.getConfig().pkm.behavior.tagVisuals
      : {};
    const byTag = visuals && visuals.byTag && typeof visuals.byTag === "object" ? visuals.byTag : {};
    const fm = fid && byTag[fid] && typeof byTag[fid] === "object" ? byTag[fid] : {};
    const row = tok && fm[tok] && typeof fm[tok] === "object" ? fm[tok] : {};
    return {
      fillColor: normalizeHexColorInput(row.fillColor),
      textColor: normalizeHexColorInput(row.textColor),
      visibility: ["default", "empty", "custom"].includes(String(row.visibility || "default").trim().toLowerCase())
        ? String(row.visibility || "default").trim().toLowerCase()
        : "default",
      customText: String(row.customText || "").trim(),
    };
  };
  const setTagVisualRow = (fieldId, token, patch, reason) => {
    const fid = String(fieldId || "").trim();
    const tok = String(token || "").trim();
    if (!fid || !tok || tok.charAt(0) !== "#") return;
    const cfgNow = plugin.getConfig();
    const visuals = cfgNow && cfgNow.pkm && cfgNow.pkm.behavior && cfgNow.pkm.behavior.tagVisuals
      ? cfgNow.pkm.behavior.tagVisuals
      : {};
    const byTag = visuals && visuals.byTag && typeof visuals.byTag === "object" ? visuals.byTag : {};
    const fieldMap = byTag[fid] && typeof byTag[fid] === "object" ? byTag[fid] : {};
    const current = fieldMap[tok] && typeof fieldMap[tok] === "object" ? fieldMap[tok] : {};
    const next = {
      fillColor: Object.prototype.hasOwnProperty.call(patch, "fillColor") ? normalizeHexColorInput(patch.fillColor) : normalizeHexColorInput(current.fillColor),
      textColor: Object.prototype.hasOwnProperty.call(patch, "textColor") ? normalizeHexColorInput(patch.textColor) : normalizeHexColorInput(current.textColor),
      visibility: Object.prototype.hasOwnProperty.call(patch, "visibility")
        ? (["default", "empty", "custom"].includes(String(patch.visibility || "default").trim().toLowerCase()) ? String(patch.visibility || "default").trim().toLowerCase() : "default")
        : (["default", "empty", "custom"].includes(String(current.visibility || "default").trim().toLowerCase()) ? String(current.visibility || "default").trim().toLowerCase() : "default"),
      customText: Object.prototype.hasOwnProperty.call(patch, "customText")
        ? String(patch.customText || "").trim()
        : String(current.customText || "").trim(),
    };
    plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { byTag: { [fid]: { [tok]: next } } } } } }, reason || "pkm:visuals:tag");
  };
  const getSubKeyForParent = (k) => {
    const kind = getFieldKind(k);
    if (kind !== "tag") return "";
    return inferSubKey(k);
  };
  const ensureAllKeys = () => {
    for (const k of getOrderKeys()) {
      if (orderState.left.includes(k) || orderState.right.includes(k)) continue;
      orderState.right.push(k);
    }
  };
  ensureAllKeys();

  const getPanelLeadCandidates = (panelKey) => {
    const arr = panelKey === "right" ? orderState.right : orderState.left;
    const seen = new Set();
    const out = [];
    for (const k of arr) {
      const key = String(k || "").trim();
      if (!key || /_sub$/.test(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: String((orderState.labels && orderState.labels[key]) || key) });
    }
    return out;
  };

  const captureSnapshot = () => {
    const live = plugin.getConfig();
    const behavior = live && live.pkm && live.pkm.behavior ? live.pkm.behavior : {};
    return {
      order: normalizePkmOrder(behavior ? behavior.order : null),
      leftMode: behavior && behavior.leftMode && Array.isArray(behavior.leftMode.fields) ? behavior.leftMode.fields : [],
      rightMode: behavior && behavior.rightMode && Array.isArray(behavior.rightMode.fields) ? behavior.rightMode.fields : [],
      elements: behavior && behavior.elements ? behavior.elements : {},
      dates: {},
    };
  };

  const applySnapshot = (snap, reason) => {
    const s = snap && typeof snap === "object" ? snap : captureSnapshot();
    plugin.setConfigPatch({
      pkm: {
        behavior: {
          order: s.order,
          leftMode: { fields: Array.isArray(s.leftMode) ? s.leftMode : [] },
          rightMode: { fields: Array.isArray(s.rightMode) ? s.rightMode : [] },
          elements: s.elements || {},
        },
      },
    }, reason || "pkm:behavior:order:deep-draft-apply");
  };

  undoBtn.onclick = () => {
    if (!enabled || typeof deepState.undoHistory !== "function") return;
    const cur = captureSnapshot();
    const rs = deepState.undoHistory(deepSession.history, cur);
    deepSession.history = rs.history;
    if (!rs.changed) {
      refreshDraftInfo();
      return;
    }
    applySnapshot(rs.snapshot, "pkm:behavior:order:deep-undo");
    setDirty(true);
    renderOrderBoard();
  };
  redoBtn.onclick = () => {
    if (!enabled || typeof deepState.redoHistory !== "function") return;
    const cur = captureSnapshot();
    const rs = deepState.redoHistory(deepSession.history, cur);
    deepSession.history = rs.history;
    if (!rs.changed) {
      refreshDraftInfo();
      return;
    }
    applySnapshot(rs.snapshot, "pkm:behavior:order:deep-redo");
    setDirty(true);
    renderOrderBoard();
  };

  applyDraftBtn.onclick = () => {
    if (!enabled || !deepSession.dirty) return;
    const rows = getOrderKeys().filter((k) => !/_sub$/.test(k)).map((k) => {
      const kind = getFieldKind(k);
      const out = { key: k, kind };
      if (kind === "element") {
        const live = plugin.getConfig();
        const byField = live && live.pkm && live.pkm.behavior && live.pkm.behavior.elements && live.pkm.behavior.elements.byField
          ? live.pkm.behavior.elements.byField
          : {};
        const ec = byField && byField[k] ? byField[k] : {};
        const inc = ec && ec.increment ? ec.increment : {};
        out.emoji = String(ec.emoji || "").trim();
        out.format = String(ec.format || "").trim();
        const modeRaw = String(inc.mode || "").trim().toLowerCase();
        out.behaviorMode = modeRaw === "custom" ? "custom" : (modeRaw === "command" ? "command" : "increment");
        out.incrementBy = inc.incrementBy;
        out.command = String(inc.command || "").trim();
        out.customRaw = Array.isArray(inc.customRaw) ? inc.customRaw.slice() : [];
      }
      return out;
    });
    const vr = typeof deepState.validateDraft === "function"
      ? deepState.validateDraft({ rows })
      : { ok: true, errors: [] };
    if (!vr.ok) {
      new Notice(`[${CONFLICT_FLAG}] apply blocked: ` + String(vr.errors[0] || "validation error"));
      return;
    }
    resetHistory();
    new Notice("Order draft applied");
    refreshDraftInfo();
  };
  try {
    applyDraftBtn.style.display = "none";
  } catch (_) {}

  const addRow = orderWrap.createDiv();
  addRow.style.display = "grid";
  addRow.style.gridTemplateColumns = "1fr 120px 120px";
  addRow.style.gap = "6px";
  addRow.style.margin = "8px 0";
  const addStrict = addRow.createEl("input");
  addStrict.type = "text";
  addStrict.placeholder = "name_strict";
  if (!enabled) addStrict.disabled = true;
  const addType = addRow.createEl("select");
  addType.createEl("option", { text: "tag", value: "tag" });
  addType.createEl("option", { text: "link", value: "wikilink" });
  addType.createEl("option", { text: "element", value: "element" });
  if (!enabled) addType.disabled = true;
  const addBtn = addRow.createEl("button", { text: "+ Add field", cls: "mod-cta" });
  if (!enabled) addBtn.disabled = true;
  const buildLeftFieldDefinition = (key, kind) => {
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
  };
  const inferElementDefaults = (key) => {
    void key;
    const marker = "";
    const format = "";
    return { marker, format };
  };
  const buildRightElementFieldDefinition = (key) => {
    const dflt = inferElementDefaults(key);
    return {
      id: key,
      kind: "genericElement",
      marker: dflt.marker,
      placeholder: key,
      values: [""],
    };
  };
  addBtn.onclick = () => {
    if (!enabled) return;
    const key = String(addStrict.value || "").replace(/\s+/g, " ").trim();
    if (!/^[a-z0-9_\- ]+$/i.test(key)) {
      new Notice("InlineOverhaul: name_strict must match [a-z0-9_- ]+");
      return;
    }
    const all = getOrderKeys();
    if (/_sub$/.test(key)) {
      new Notice("InlineOverhaul: name_strict ending with _sub is reserved for generated child keys");
      return;
    }
    if (all.includes(key)) {
      new Notice("InlineOverhaul: field already exists");
      return;
    }
    const strictValues = new Set(all.map((kk) => String((orderState.strictNames && orderState.strictNames[kk]) || kk).trim()).filter(Boolean));
    if (strictValues.has(key)) {
      new Notice("InlineOverhaul: name_strict already exists");
      return;
    }
    const kindRaw = String(addType.value || "tag").trim().toLowerCase();
    const kind = kindRaw === "wikilink" || kindRaw === "element" ? kindRaw : "tag";
    const subKey = kind === "tag" ? inferSubKey(key) : "";
    const subStrict = kind === "tag" ? `${key}_sub` : "";
    if (subStrict && strictValues.has(subStrict)) {
      new Notice("InlineOverhaul: auto sub name_strict already exists");
      return;
    }
    orderState.right = (orderState.right || []).concat([key]);
    orderState.labels = { ...(orderState.labels || {}), [key]: key };
    orderState.strictNames = { ...(orderState.strictNames || {}), [key]: key };
    orderState.types = { ...(orderState.types || {}), [key]: kind };
    orderState.active = { ...(orderState.active || {}), [key]: "yes" };
    orderState.freeRoam = { ...(orderState.freeRoam || {}), [key]: "off" };
    orderState.enabled = { ...(orderState.enabled || {}), [key]: true };
    if (subKey) {
      orderState.active[subKey] = "no";
      orderState.freeRoam[subKey] = "off";
      orderState.enabled[subKey] = false;
      orderState.types[subKey] = "tag";
      orderState.labels[subKey] = `${key} sub`;
      orderState.strictNames[subKey] = subStrict;
    }
    setOrderPatch({
      right: orderState.right.slice(),
      labels: { [key]: key },
      strictNames: { [key]: key },
      types: { [key]: kind },
      active: { [key]: "yes" },
      freeRoam: { [key]: "off" },
      enabled: { [key]: true },
      ...(subKey ? {
        labels: { [key]: key, [subKey]: `${key} sub` },
        strictNames: { [key]: key, [subKey]: subStrict },
        types: { [key]: kind, [subKey]: "tag" },
        active: { [key]: "yes", [subKey]: "no" },
        freeRoam: { [key]: "off", [subKey]: "off" },
        enabled: { [key]: true, [subKey]: false },
      } : {}),
    }, "pkm:behavior:order:add-field:" + key);

    const live = plugin.getConfig();
    const behavior = live && live.pkm && live.pkm.behavior ? live.pkm.behavior : {};
    const leftMode = behavior && behavior.leftMode && Array.isArray(behavior.leftMode.fields)
      ? behavior.leftMode.fields.slice()
      : [];
    const rightMode = behavior && behavior.rightMode && Array.isArray(behavior.rightMode.fields)
      ? behavior.rightMode.fields.slice()
      : [];
    if (kind === "element") {
      if (!rightMode.find((f) => f && String(f.id || "").trim() === key)) {
        rightMode.push(buildRightElementFieldDefinition(key));
      }
    } else {
      if (!leftMode.find((f) => f && String(f.id || "").trim() === key)) {
        leftMode.push(buildLeftFieldDefinition(key, kind));
      }
      if (kind === "tag") {
        if (!leftMode.find((f) => f && String(f.id || "").trim() === subKey)) {
          leftMode.push({
            id: subKey,
            prefix: "#",
            enabled: false,
            dependsOn: key,
            disabledForParentValues: [],
            placeholder: "sub",
            values: [""],
          });
        }
      }
    }
    plugin.setConfigPatch({ pkm: { behavior: { leftMode: { fields: leftMode }, rightMode: { fields: rightMode } } } }, "pkm:behavior:modes:add-field:" + key);

    try {
      if (plugin && typeof plugin.registerPkmCommands === "function") plugin.registerPkmCommands();
    } catch (_) {}
    if (kind === "element") {
      const liveAfterMode = plugin.getConfig();
      const behaviorAfterMode = liveAfterMode && liveAfterMode.pkm && liveAfterMode.pkm.behavior ? liveAfterMode.pkm.behavior : {};
      const elementsCfg = behaviorAfterMode && behaviorAfterMode.elements ? behaviorAfterMode.elements : {};
      const fields = Array.isArray(elementsCfg.fields) ? elementsCfg.fields.slice() : [];
      if (!fields.includes(key)) fields.push(key);
      const byField = elementsCfg && elementsCfg.byField && typeof elementsCfg.byField === "object"
        ? { ...elementsCfg.byField }
        : {};
      const cur = byField[key] && typeof byField[key] === "object" ? byField[key] : {};
      byField[key] = {
        ...cur,
        emoji: Object.prototype.hasOwnProperty.call(cur, "emoji") ? String(cur.emoji || "").trim() : "",
        format: Object.prototype.hasOwnProperty.call(cur, "format") ? String(cur.format ?? "") : "",
        hotkey: {
          increase: String(cur?.hotkey?.increase || "").trim(),
          decrease: String(cur?.hotkey?.decrease || "").trim(),
        },
        increment: {
          mode: "standard",
          incrementBy: 1,
          command: "now",
          customRaw: Array.isArray(cur?.increment?.customRaw) ? cur.increment.customRaw : [],
          custom: Array.isArray(cur?.increment?.custom) ? cur.increment.custom : [1],
        },
      };
      plugin.setConfigPatch({ pkm: { behavior: { elements: { fields, byField } } } }, "pkm:behavior:elements:add-field:" + key);
    }
    addStrict.value = "";
    renderOrderBoard();
  };

  const row = orderWrap.createDiv();
  row.style.display = "grid";
  row.style.gridTemplateColumns = "1fr";
  row.style.gap = "6px";
  row.style.border = "1px solid var(--background-modifier-border-hover)";
  row.style.borderRadius = "6px";
  row.style.padding = "6px";
  row.style.background = "var(--background-primary)";

  const panelCols = {
    left: row.createDiv(),
    right: row.createDiv(),
  };

  let dragKey = "";
  const orderTipsRegistry = {
    type: "Field kind: tag, link, or element.",
    strict: "System key used in config/runtime.",
    display: "UI label shown in panels.",
    subtags: "Enable or disable subtag lane for this field.",
    roam: "Controls non-prefix insertion behavior.",
    active: "yes/no/hotkey_only runtime participation.",
  };
  const addTipIcon = (host, tipKey) => {
    if (!showInfoTips) return;
    const tipText = String(orderTipsRegistry[tipKey] || "").trim();
    if (!tipText) return;
    const icon = host.createEl("span", { text: " ⓘ" });
    icon.style.opacity = "0.7";
    icon.style.cursor = "help";
    let timer = null;
    let popup = null;
    const hide = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (popup && popup.remove) popup.remove();
      popup = null;
    };
    icon.onmouseleave = hide;
    icon.onmouseenter = () => {
      hide();
      timer = setTimeout(() => {
        popup = document.createElement("div");
        popup.textContent = tipText;
        popup.style.position = "fixed";
        popup.style.zIndex = "10000";
        popup.style.maxWidth = "260px";
        popup.style.padding = "6px 8px";
        popup.style.borderRadius = "6px";
        popup.style.border = "1px solid var(--background-modifier-border)";
        popup.style.background = "var(--background-primary)";
        popup.style.fontSize = "12px";
        const r = icon.getBoundingClientRect();
        popup.style.left = `${Math.round(r.left)}px`;
        popup.style.top = `${Math.round(r.bottom + 6)}px`;
        document.body.appendChild(popup);
      }, 300);
    };
  };

  const moveKey = (toPanel, key, beforeKey) => {
    if (!key) return;
    const moveKeys = [key];
    const subKey = getSubKeyForParent(key);
    if (subKey && (orderState.left.includes(subKey) || orderState.right.includes(subKey))) {
      moveKeys.push(subKey);
    }
    orderState.left = orderState.left.filter((x) => !moveKeys.includes(x));
    orderState.right = orderState.right.filter((x) => !moveKeys.includes(x));
    const target = toPanel === "right" ? orderState.right : orderState.left;
    let idx = target.length;
    if (beforeKey) {
      const bi = target.indexOf(beforeKey);
      if (bi !== -1) idx = bi;
    }
    target.splice(idx, 0, ...moveKeys);
    setOrderPatch(orderState, "pkm:behavior:order:dnd");
    renderOrderBoard();
  };

  const getOrderTypeBubblePalette = (kindRaw) => {
    const kind = String(kindRaw || "").trim().toLowerCase();
    if (kind === "tag") {
      return {
        bg: "rgba(70, 130, 180, 0.16)",
        border: "rgba(70, 130, 180, 0.42)",
      };
    }
    if (kind === "wikilink" || kind === "link") {
      return {
        bg: "rgba(46, 139, 87, 0.16)",
        border: "rgba(46, 139, 87, 0.42)",
      };
    }
    return {
      bg: "rgba(205, 133, 63, 0.16)",
      border: "rgba(205, 133, 63, 0.42)",
    };
  };

  const collectYamlSuggestionKeys = () => {
    try {
      const app = plugin && plugin.app ? plugin.app : null;
      if (!app || !app.vault || !app.metadataCache || typeof app.vault.getMarkdownFiles !== "function") return [];
      const files = app.vault.getMarkdownFiles();
      const out = [];
      const seen = new Set();
      for (let i = 0; i < files.length; i++) {
        const path = String(files[i] && files[i].path || "").trim();
        if (!path) continue;
        const cache = typeof app.metadataCache.getCache === "function" ? app.metadataCache.getCache(path) : null;
        const fm = cache && cache.frontmatter && typeof cache.frontmatter === "object" ? cache.frontmatter : null;
        if (!fm) continue;
        for (const key of Object.keys(fm)) {
          const k = String(key || "").trim();
          if (!k || seen.has(k.toLowerCase())) continue;
          seen.add(k.toLowerCase());
          out.push(k);
        }
      }
      out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      return out;
    } catch (_) {
      return [];
    }
  };
  let yamlSuggestionKeysCache = collectYamlSuggestionKeys();
  const getYamlSuggestionKeys = () => {
    const fresh = collectYamlSuggestionKeys();
    if (Array.isArray(fresh) && fresh.length) {
      yamlSuggestionKeysCache = fresh;
      return fresh;
    }
    return Array.isArray(yamlSuggestionKeysCache) ? yamlSuggestionKeysCache : [];
  };
  const attachYamlSuggestionDropdown = (inputEl, onPick) => {
    if (!inputEl || typeof document === "undefined" || !document.body) return () => {};
    const popup = document.createElement("div");
    document.body.appendChild(popup);
    popup.style.position = "absolute";
    popup.style.display = "none";
    popup.style.maxHeight = "160px";
    popup.style.overflowY = "auto";
    popup.style.zIndex = "10000";
    popup.style.background = "var(--background-primary)";
    popup.style.border = "1px solid var(--background-modifier-border)";
    popup.style.borderRadius = "6px";
    popup.style.padding = "4px";
    popup.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";
    popup.style.fontSize = "12px";
    popup.style.lineHeight = "1.35";
    let activeIndex = -1;
    let visibleRows = [];
    const hidePopup = () => {
      activeIndex = -1;
      popup.style.display = "none";
    };
    const applyActiveStyles = () => {
      for (let i = 0; i < visibleRows.length; i++) {
        const rowEl = visibleRows[i];
        if (!rowEl) continue;
        if (i === activeIndex) {
          rowEl.style.background = "var(--background-modifier-hover)";
          rowEl.style.outline = "1px solid var(--background-modifier-border)";
        } else {
          rowEl.style.background = "transparent";
          rowEl.style.outline = "none";
        }
      }
    };
    const placePopup = () => {
      const r = inputEl.getBoundingClientRect();
      popup.style.left = `${Math.round(r.left)}px`;
      popup.style.top = `${Math.round(r.bottom + 2)}px`;
      popup.style.minWidth = `${Math.round(r.width)}px`;
    };
    const render = (showAll) => {
      popup.replaceChildren();
      visibleRows = [];
      activeIndex = -1;
      const q = String(inputEl.value || "").trim().toLowerCase();
      const keys = getYamlSuggestionKeys();
      const rows = showAll && !q
        ? keys.slice(0, 30)
        : keys.filter((x) => String(x || "").toLowerCase().includes(q)).slice(0, 30);
      if (!rows.length) {
        const empty = document.createElement("div");
        empty.textContent = keys.length ? "No matches" : "No YAML properties found in vault";
        empty.style.padding = "4px 8px";
        empty.style.opacity = "0.7";
        popup.appendChild(empty);
        placePopup();
        popup.style.display = "block";
        return;
      }
      for (let i = 0; i < rows.length; i++) {
        const opt = document.createElement("div");
        opt.textContent = rows[i];
        opt.style.padding = "4px 8px";
        opt.style.borderRadius = "4px";
        opt.style.cursor = "pointer";
        opt.onmouseenter = () => {
          activeIndex = i;
          applyActiveStyles();
        };
        opt.onmousedown = (ev) => {
          ev.preventDefault();
          inputEl.value = rows[i];
          hidePopup();
          if (typeof onPick === "function") onPick(rows[i]);
          inputEl.dispatchEvent(new Event("change"));
        };
        visibleRows.push(opt);
        popup.appendChild(opt);
      }
      activeIndex = 0;
      applyActiveStyles();
      placePopup();
      popup.style.display = "block";
    };
    const onFocus = () => render(true);
    const onInput = () => render(false);
    const onClick = () => render(true);
    const onBlur = () => { setTimeout(() => hidePopup(), 120); };
    const onKeydown = (ev) => {
      if (popup.style.display === "none") {
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
          ev.preventDefault();
          render(true);
        }
        return;
      }
      if (ev.key === "Escape") {
        hidePopup();
        return;
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        if (visibleRows.length) {
          activeIndex = Math.min(visibleRows.length - 1, activeIndex + 1);
          applyActiveStyles();
        }
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        if (visibleRows.length) {
          activeIndex = Math.max(0, activeIndex - 1);
          applyActiveStyles();
        }
        return;
      }
      if (ev.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < visibleRows.length) {
          ev.preventDefault();
          const selected = String(visibleRows[activeIndex].textContent || "").trim();
          if (selected && selected !== "No matches" && selected !== "No YAML properties found in vault") {
            inputEl.value = selected;
            hidePopup();
            if (typeof onPick === "function") onPick(selected);
            inputEl.dispatchEvent(new Event("change"));
          }
        }
      }
    };
    const onDocMouseDown = (ev) => {
      const t = ev && ev.target ? ev.target : null;
      if (t === inputEl || popup.contains(t)) return;
      hidePopup();
    };
    const onWindowResize = () => {
      if (popup.style.display !== "none") placePopup();
    };
    inputEl.addEventListener("focus", onFocus);
    inputEl.addEventListener("input", onInput);
    inputEl.addEventListener("click", onClick);
    inputEl.addEventListener("blur", onBlur);
    inputEl.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", onWindowResize);
    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      try { inputEl.removeEventListener("focus", onFocus); } catch (_) {}
      try { inputEl.removeEventListener("input", onInput); } catch (_) {}
      try { inputEl.removeEventListener("click", onClick); } catch (_) {}
      try { inputEl.removeEventListener("blur", onBlur); } catch (_) {}
      try { inputEl.removeEventListener("keydown", onKeydown); } catch (_) {}
      try { window.removeEventListener("resize", onWindowResize); } catch (_) {}
      try { document.removeEventListener("mousedown", onDocMouseDown); } catch (_) {}
      try { popup.remove(); } catch (_) {}
    };
  };

  const renderPanel = (panelKey, title) => {
    const host = panelCols[panelKey];
    host.empty();
    host.style.border = "none";
    host.style.borderRadius = "0";
    host.style.padding = "0";
    host.style.marginBottom = panelKey === "left" ? "4px" : "0";

    const panelWidth = Math.max(0, Math.round((host.getBoundingClientRect && host.getBoundingClientRect().width) || host.clientWidth || 0));
    const compactCols = panelWidth > 0 && panelWidth < 920;
    const ORDER_COL_HANDLE = compactCols ? "32px" : "34px";
    const ORDER_COL_TYPE = compactCols ? "58px" : "62px";
    const ORDER_COL_EQ = compactCols ? "minmax(94px, 1.5fr)" : "minmax(128px, 1.75fr)";
    const ORDER_COL_STRICT = ORDER_COL_EQ;
    const ORDER_COL_DISPLAY = ORDER_COL_EQ;
    const ORDER_COL_PREFIX = compactCols ? "minmax(80px, 1.1fr)" : "minmax(96px, 1.2fr)";
    const ORDER_COL_YAML = ORDER_COL_EQ;
    const ORDER_COL_SUB = compactCols ? "40px" : "44px";
    const ORDER_COL_ROAM = compactCols ? "54px" : "58px";
    const ORDER_COL_ACTIVE = compactCols ? "50px" : "54px";
    const ORDER_COL_DELETE = "28px";
    const cols = `${ORDER_COL_HANDLE} ${ORDER_COL_TYPE} ${ORDER_COL_STRICT} ${ORDER_COL_DISPLAY} ${ORDER_COL_PREFIX} ${ORDER_COL_YAML} ${ORDER_COL_SUB} ${ORDER_COL_ROAM} ${ORDER_COL_ACTIVE} ${ORDER_COL_DELETE}`;
    if (panelKey === "left") {
      const head = host.createDiv();
      head.style.display = "grid";
      head.style.gridTemplateColumns = cols;
      head.style.gap = "8px";
      head.style.padding = "0 6px 4px";
      head.style.opacity = "0.85";
      head.createEl("small", { text: "" });
      const typeHead = head.createEl("small", { text: "type" });
      typeHead.style.marginLeft = "4px";
      addTipIcon(typeHead, "type");
      head.createEl("small", { text: "name_strict" });
      addTipIcon(head.lastChild, "strict");
      head.createEl("small", { text: "name_display" });
      addTipIcon(head.lastChild, "display");
      head.createEl("small", { text: "" });
      head.createEl("small", { text: "YAML" });
      head.createEl("small", { text: "subtags on/off" });
      addTipIcon(head.lastChild, "subtags");
      head.createEl("small", { text: "Free roam" });
      addTipIcon(head.lastChild, "roam");
      head.createEl("small", { text: "Active" });
      addTipIcon(head.lastChild, "active");
      head.createEl("small", { text: "" });
      const titleEl = host.createEl("div", { text: title });
      titleEl.style.fontSize = "12px";
      titleEl.style.fontWeight = "600";
      titleEl.style.lineHeight = "1.25";
      titleEl.style.margin = "1px 0 2px 0";
    } else {
      const titleEl = host.createEl("div", { text: title });
      titleEl.style.fontSize = "12px";
      titleEl.style.fontWeight = "600";
      titleEl.style.lineHeight = "1.25";
      titleEl.style.margin = "1px 0 2px 0";
    }

    const list = host.createDiv();
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "4px";
    list.style.marginTop = "0";
    const addDropZone = (beforeKey) => {
      const dz = list.createDiv();
      dz.style.height = "6px";
      dz.style.borderRadius = "4px";
      dz.style.border = "1px dashed transparent";
      dz.ondragover = (e) => {
        e.preventDefault();
        if (!enabled || !dragKey) return;
        dz.style.border = "1px dashed var(--text-accent)";
        dz.style.background = "var(--background-modifier-hover)";
      };
      dz.ondragleave = () => {
        dz.style.border = "1px dashed transparent";
        dz.style.background = "transparent";
      };
      dz.ondrop = (e) => {
        e.preventDefault();
        dz.style.border = "1px dashed transparent";
        dz.style.background = "transparent";
        if (!enabled || !dragKey) return;
        moveKey(panelKey, dragKey, beforeKey || "");
      };
    };

    const arr = panelKey === "right" ? orderState.right : orderState.left;
    for (const k of arr) {
      try {
      addDropZone(k);
      const item = list.createDiv();
      item.style.display = "grid";
      item.style.gridTemplateColumns = cols;
      item.style.alignItems = "center";
      item.style.gap = "8px";
      item.style.padding = "4px 6px";
      item.style.border = "1px solid var(--background-modifier-border)";
      item.style.borderRadius = "6px";
      item.style.background = "var(--background-secondary)";
      const handleCell = item.createDiv();
      handleCell.style.display = "flex";
      handleCell.style.alignItems = "center";
      handleCell.style.gap = "4px";
      const handle = handleCell.createEl("span", { text: "⋮⋮" });
      handle.style.cursor = enabled ? "grab" : "default";
      handle.style.opacity = enabled ? "0.85" : "0.45";
      handle.style.userSelect = "none";
      handle.draggable = !!enabled;
      handle.ondragstart = () => {
        dragKey = k;
        handle.style.cursor = "grabbing";
      };
      handle.ondragend = () => {
        dragKey = "";
        handle.style.cursor = enabled ? "grab" : "default";
      };

      const expandBtnInline = handleCell.createEl("button", { text: deepSession.expanded[k] ? "▾" : "▸" });
      expandBtnInline.style.minWidth = "18px";
      expandBtnInline.style.padding = "0 2px";
      expandBtnInline.style.lineHeight = "1";
      expandBtnInline.style.border = "none";
      expandBtnInline.style.background = "transparent";
      expandBtnInline.style.opacity = "0.9";
      expandBtnInline.style.cursor = enabled ? "pointer" : "default";
      expandBtnInline.disabled = !enabled || !showDeepEditor;
      if (!showDeepEditor) expandBtnInline.style.display = "none";
      expandBtnInline.onclick = () => {
        deepSession.expanded[k] = !deepSession.expanded[k];
        renderOrderBoard();
      };

      const kindPill = item.createEl("small", { text: typeLabelByKind[getFieldKind(k)] || "#tag" });
      kindPill.style.padding = "1px 6px";
      kindPill.style.border = "1px solid var(--background-modifier-border)";
      kindPill.style.borderRadius = "999px";
      kindPill.style.opacity = "0.85";
      kindPill.style.textAlign = "center";
      kindPill.style.marginLeft = "4px";
      const kindNow = getFieldKind(k);
      const kindPalette = getOrderTypeBubblePalette(kindNow);
      kindPill.style.background = kindPalette.bg;
      kindPill.style.borderColor = kindPalette.border;

      const strictInput = item.createEl("input");
      strictInput.type = "text";
      const strictName = String((orderState.strictNames && orderState.strictNames[k]) || k);
      strictInput.value = strictName;
      strictInput.style.minWidth = "0";
      strictInput.style.width = "100%";
      strictInput.style.boxSizing = "border-box";
      strictInput.style.fontSize = "11px";
      strictInput.disabled = !enabled;
      strictInput.title = "System key used by config/runtime/config note.";
      strictInput.onchange = async () => {
        if (!enabled) return;
        const oldName = String((orderState.strictNames && orderState.strictNames[k]) || k);
        const next = String(strictInput.value || "").replace(/\s+/g, " ").trim();
        if (next === oldName) return;
        if (!/^[a-z0-9_\- ]+$/i.test(next)) {
          new Notice("InlineOverhaul: name_strict must match [a-z0-9_- ]+");
          strictInput.value = oldName;
          return;
        }
        const taken = new Set();
        for (const kk of getOrderKeys()) {
          const vv = String((orderState.strictNames && orderState.strictNames[kk]) || kk).trim();
          if (kk === k) continue;
          if (vv) taken.add(vv);
        }
        if (taken.has(next)) {
          new Notice("InlineOverhaul: name_strict already exists");
          strictInput.value = oldName;
          return;
        }
        orderState.strictNames = { ...(orderState.strictNames || {}), [k]: next };
        setOrderPatch({ strictNames: { [k]: next } }, "pkm:behavior:order:strict:" + k);
        try {
          await plugin.renameStrictNameInConfigNote(oldName, next);
        } catch (e) {
          console.error("[inline-overhaul][strict-rename:config-note]", e);
        }
        renderOrderBoard();
      };

      const labelInput = item.createEl("input");
      labelInput.type = "text";
      labelInput.value = (orderState.labels && orderState.labels[k]) || k;
      labelInput.style.minWidth = "0";
      labelInput.style.width = "100%";
      labelInput.style.boxSizing = "border-box";
      labelInput.style.fontSize = "11px";
      if (!enabled) labelInput.disabled = true;
      labelInput.onchange = () => {
        const v = String(labelInput.value || "").trim();
        if (!v || !enabled) return;
        orderState.labels = { ...(orderState.labels || {}), [k]: v };
        setOrderPatch(orderState, "pkm:behavior:order:label:" + k);
        renderOrderBoard();
      };
      const prefixSpacer = item.createDiv();
      prefixSpacer.style.width = "100%";
      prefixSpacer.style.minWidth = "0";
      const yamlInput = item.createEl("input");
      yamlInput.type = "text";
      yamlInput.style.minWidth = "0";
      yamlInput.style.width = "100%";
      yamlInput.style.boxSizing = "border-box";
      yamlInput.style.fontSize = "11px";
      yamlInput.value = String((orderState.propertiesByField && orderState.propertiesByField[k]) || "").trim();
      yamlInput.placeholder = "yaml property";
      if (!enabled) yamlInput.disabled = true;
      if (showInfoTips) yamlInput.title = "YAML property used for this field.";
      const detachYamlDropdown = attachYamlSuggestionDropdown(yamlInput);
      yamlInput.onchange = () => {
        if (!enabled) return;
        const prev = String((orderState.propertiesByField && orderState.propertiesByField[k]) || "").trim();
        const next = String(yamlInput.value || "").trim();
        orderState.propertiesByField = { ...(orderState.propertiesByField || {}) };
        if (next) orderState.propertiesByField[k] = next;
        else delete orderState.propertiesByField[k];
        setOrderPatch({ propertiesByField: { [k]: next || null } }, "pkm:behavior:order:yaml:" + k);
        const liveNow = plugin.getConfig();
        const behaviorNow = liveNow && liveNow.pkm && liveNow.pkm.behavior ? liveNow.pkm.behavior : {};
        const leftFieldsNow = behaviorNow && behaviorNow.leftMode && Array.isArray(behaviorNow.leftMode.fields) ? behaviorNow.leftMode.fields.slice() : [];
        const rightFieldsNow = behaviorNow && behaviorNow.rightMode && Array.isArray(behaviorNow.rightMode.fields) ? behaviorNow.rightMode.fields.slice() : [];
        const strictNameNow = String((orderState.strictNames && orderState.strictNames[k]) || k).trim() || k;
        const subKeyNow = getSubKeyForParent(k) || "";
        const findByOrderKey = (arr, key) => {
          const kk = String(key || "").trim();
          if (!kk || !Array.isArray(arr)) return null;
          const strict = String((orderState.strictNames && orderState.strictNames[kk]) || kk).trim() || kk;
          for (let i = 0; i < arr.length; i++) {
            const row = arr[i] && typeof arr[i] === "object" ? arr[i] : null;
            if (!row) continue;
            const id = String(row.id || "").trim();
            const ok = String(row.orderKey || "").trim();
            if (ok === kk || ok === strict || id === kk || id === strict) return row;
          }
          return null;
        };
        const parentFieldNow = findByOrderKey(leftFieldsNow, k) || findByOrderKey(rightFieldsNow, k);
        const subFieldNow = subKeyNow ? (findByOrderKey(leftFieldsNow, subKeyNow) || findByOrderKey(rightFieldsNow, subKeyNow)) : null;
        const patchFieldValues = (field) => {
          if (!field || !Array.isArray(field.values)) return field;
          const values = field.values.map((v) => {
            const row = v && typeof v === "object" ? { ...v } : v;
            if (!row || typeof row !== "object") return row;
            const cur = String(row.yamlProperty || "").trim();
            const inheritedBefore = !cur || cur === prev;
            if (!inheritedBefore) return row;
            if (next) row.yamlProperty = next;
            else delete row.yamlProperty;
            return row;
          });
          return { ...field, values };
        };
        const parentPatched = patchFieldValues(parentFieldNow);
        const subPatched = patchFieldValues(subFieldNow);
        const upsertById = (arr, field) => {
          if (!field || !field.id || !Array.isArray(arr)) return arr;
          const id = String(field.id || "").trim();
          const out = arr.slice();
          const idx = out.findIndex((x) => String(x && x.id || "").trim() === id);
          if (idx === -1) out.push(field);
          else out[idx] = field;
          return out;
        };
        const nextLeft = upsertById(upsertById(leftFieldsNow, parentPatched), subPatched);
        const nextRight = upsertById(upsertById(rightFieldsNow, parentPatched), subPatched);
        plugin.setConfigPatch({ pkm: { behavior: { leftMode: { fields: nextLeft }, rightMode: { fields: nextRight } } } }, "pkm:behavior:order:yaml-propagate:" + strictNameNow);
      };
      const detachHandler = () => detachYamlDropdown();
      onNodeDetachedOnce(item, detachHandler);
      const subKey = getSubKeyForParent(k) || "";
      if (subKey) {
        const subBtn = item.createEl("button");
        subBtn.ariaLabel = "toggle sub " + k;
        subBtn.style.width = "100%";
        subBtn.style.minWidth = "0";
        subBtn.style.boxSizing = "border-box";
        subBtn.style.padding = "2px 4px";
        subBtn.style.cursor = enabled ? "pointer" : "default";
        const subActive = String((orderState.active && orderState.active[subKey]) || (orderState.enabled && orderState.enabled[subKey] !== false ? "yes" : "no")).trim().toLowerCase();
        setIcon(subBtn, subActive === "no" ? "unlink-2" : "link-2");
        if (!enabled) subBtn.disabled = true;
        subBtn.onclick = () => {
          if (!enabled) return;
          const cur = String((orderState.active && orderState.active[subKey]) || "yes").trim().toLowerCase();
          const next = cur === "no" ? "yes" : "no";
          orderState.active = { ...(orderState.active || {}), [subKey]: next };
          orderState.enabled = { ...(orderState.enabled || {}), [subKey]: next !== "no" };
          const live = plugin.getConfig();
          const behavior = live && live.pkm && live.pkm.behavior ? live.pkm.behavior : {};
          const leftMode = behavior && behavior.leftMode && Array.isArray(behavior.leftMode.fields)
            ? behavior.leftMode.fields.slice()
            : [];
          const idx = leftMode.findIndex((f) => f && String(f.id || "").trim() === subKey);
          if (idx !== -1) leftMode[idx] = { ...leftMode[idx], enabled: next !== "no" };
          plugin.setConfigPatch({ pkm: { behavior: { leftMode: { fields: leftMode } } } }, "pkm:behavior:leftmode:subtoggle:" + subKey);
          setOrderPatch({ active: { [subKey]: next }, enabled: { [subKey]: next !== "no" } }, "pkm:behavior:order:sub:" + subKey);
          renderOrderBoard();
        };
      } else {
        const gapCell = item.createDiv();
        gapCell.setText("-");
        gapCell.style.opacity = "0.45";
        gapCell.style.textAlign = "center";
      }
      const freeRoamSelect = item.createEl("select");
      freeRoamSelect.style.width = "100%";
      freeRoamSelect.style.minWidth = "0";
      freeRoamSelect.style.boxSizing = "border-box";
      freeRoamSelect.style.padding = "2px 4px";
      freeRoamSelect.createEl("option", { text: "off", value: "off" });
      freeRoamSelect.createEl("option", { text: "minimal", value: "minimal" });
      freeRoamSelect.createEl("option", { text: "full", value: "full" });
      const freeRoamMode = String((orderState.freeRoam && orderState.freeRoam[k]) || "off").trim().toLowerCase();
      freeRoamSelect.value = freeRoamMode === "minimal" || freeRoamMode === "full" ? freeRoamMode : "off";
      if (!enabled) freeRoamSelect.disabled = true;
      freeRoamSelect.onchange = () => {
        if (!enabled) return;
        const nextMode = String(freeRoamSelect.value || "off").trim().toLowerCase();
        const normalizedMode = nextMode === "minimal" || nextMode === "full" ? nextMode : "off";
        orderState.freeRoam = { ...(orderState.freeRoam || {}), [k]: normalizedMode };
        setOrderPatch({ freeRoam: { [k]: normalizedMode } }, "pkm:behavior:order:freeroam:" + k);
      };

      const activeSelect = item.createEl("select");
      activeSelect.style.width = "100%";
      activeSelect.style.minWidth = "0";
      activeSelect.style.boxSizing = "border-box";
      activeSelect.style.padding = "2px 4px";
      const activeMode = String((orderState.active && orderState.active[k]) || (orderState.enabled && orderState.enabled[k] !== false ? "yes" : "no")).trim().toLowerCase();
      activeSelect.createEl("option", { text: "yes", value: "yes" });
      activeSelect.createEl("option", { text: "no", value: "no" });
      activeSelect.createEl("option", { text: "hotkey_only", value: "hotkey_only" });
      activeSelect.value = (activeMode === "no" || activeMode === "hotkey_only") ? activeMode : "yes";
      if (!enabled) activeSelect.disabled = true;
      activeSelect.onchange = () => {
        if (!enabled) return;
        const nextActive = String(activeSelect.value || "yes").trim().toLowerCase();
        const normalized = nextActive === "no" || nextActive === "hotkey_only" ? nextActive : "yes";
        orderState.active = { ...(orderState.active || {}), [k]: normalized };
        orderState.enabled = { ...(orderState.enabled || {}), [k]: normalized !== "no" };
        setOrderPatch({ active: { [k]: normalized }, enabled: { [k]: normalized !== "no" } }, "pkm:behavior:order:active:" + k);
        renderOrderBoard();
      };

      const delBtn = item.createEl("button");
      delBtn.ariaLabel = "delete " + k;
      setIcon(delBtn, "trash-2");
      delBtn.style.minWidth = "28px";
      delBtn.style.maxWidth = "28px";
      delBtn.style.width = "28px";
      delBtn.style.height = "24px";
      delBtn.style.padding = "2px 4px";
      delBtn.style.background = "#d32f2f";
      delBtn.style.color = "#ffffff";
      delBtn.style.border = "none";
      delBtn.style.display = "inline-flex";
      delBtn.style.alignItems = "center";
      delBtn.style.justifyContent = "center";
      if (!enabled) delBtn.disabled = true;
      delBtn.onclick = async () => {
        if (!enabled) return;
        const ok = await confirmDeleteModal(k);
        if (!ok) return;

        const sub = getSubKeyForParent(k);
        const targets = [k].concat(sub ? [sub] : []);
        const liveOrder = normalizePkmOrder(plugin.getConfig() && plugin.getConfig().pkm && plugin.getConfig().pkm.behavior ? plugin.getConfig().pkm.behavior.order : null);
        const nextOrder = {
          ...liveOrder,
          left: (liveOrder.left || []).filter((x) => !targets.includes(String(x || "").trim())),
          right: (liveOrder.right || []).filter((x) => !targets.includes(String(x || "").trim())),
          lead: { ...(liveOrder.lead || {}) },
          labels: { ...(liveOrder.labels || {}) },
          strictNames: { ...(liveOrder.strictNames || {}) },
          types: { ...(liveOrder.types || {}) },
          active: { ...(liveOrder.active || {}) },
          freeRoam: { ...(liveOrder.freeRoam || {}) },
          enabled: { ...(liveOrder.enabled || {}) },
        };
        for (const t of targets) {
          delete nextOrder.labels[t];
          delete nextOrder.strictNames[t];
          delete nextOrder.types[t];
          delete nextOrder.active[t];
          delete nextOrder.freeRoam[t];
          delete nextOrder.enabled[t];
        }
        const leftLead = String(nextOrder.lead && nextOrder.lead.left ? nextOrder.lead.left : "").trim();
        const rightLead = String(nextOrder.lead && nextOrder.lead.right ? nextOrder.lead.right : "").trim();
        if (targets.includes(leftLead)) nextOrder.lead.left = "";
        if (targets.includes(rightLead)) nextOrder.lead.right = "";
        orderState.left = nextOrder.left.slice();
        orderState.right = nextOrder.right.slice();
        orderState.lead = { ...(nextOrder.lead || {}) };
        orderState.labels = { ...nextOrder.labels };
        orderState.strictNames = { ...nextOrder.strictNames };
        orderState.types = { ...nextOrder.types };
        orderState.active = { ...nextOrder.active };
        orderState.freeRoam = { ...nextOrder.freeRoam };
        orderState.enabled = { ...nextOrder.enabled };
        setOrderPatch(nextOrder, "pkm:behavior:order:delete:" + k, { replace: true });

        const live = plugin.getConfig();
        const behavior = live && live.pkm && live.pkm.behavior ? live.pkm.behavior : {};
        const leftFields = behavior && behavior.leftMode && Array.isArray(behavior.leftMode.fields)
          ? behavior.leftMode.fields.filter((f) => {
            const id = String(f && f.id || "").trim();
            return id !== k && (!sub || id !== sub);
          })
          : [];
        const rightFields = behavior && behavior.rightMode && Array.isArray(behavior.rightMode.fields)
          ? behavior.rightMode.fields.filter((f) => String(f && f.id || "").trim() !== k)
          : [];
        const elementsCfg = behavior && behavior.elements ? behavior.elements : {};
        const elementsFields = Array.isArray(elementsCfg.fields) ? elementsCfg.fields.filter((x) => String(x || "").trim() !== k) : [];
        const elementsByField = elementsCfg && elementsCfg.byField && typeof elementsCfg.byField === "object" ? { ...elementsCfg.byField } : {};
        delete elementsByField[k];
        plugin.setConfigPatch({
          pkm: {
            behavior: {
              leftMode: { fields: leftFields },
              rightMode: { fields: rightFields },
              elements: { ...elementsCfg, fields: elementsFields, byField: elementsByField },
            },
          },
        }, "pkm:behavior:delete-field:" + k);
        renderOrderBoard();
      };

      if (showDeepEditor && deepSession.expanded[k]) {
          const details = list.createDiv();
          details.style.margin = "-2px 0 4px 20px";
          details.style.padding = "6px";
          details.style.border = "1px dashed var(--background-modifier-border)";
          details.style.borderRadius = "6px";
          details.style.background = "var(--background-primary)";
          const kind = getFieldKind(k);
          if (kind === "tag") details.style.margin = "-2px 0 4px 0";
          if (deepState && deepState.__unavailable === true) {
            const warn = details.createDiv();
            warn.style.marginTop = "6px";
            warn.style.padding = "6px 8px";
            warn.style.border = "1px solid var(--text-error)";
            warn.style.borderRadius = "6px";
            warn.style.background = "var(--background-primary-alt)";
            warn.style.fontSize = "12px";
            warn.style.whiteSpace = "pre-wrap";
            warn.setText(`Order Deep Editor unavailable: ${String(deepState.__unavailableReason || __orderDeepEditorStateDiag || "unknown")}`);
          }

          const liveCfg = plugin.getConfig();
          const behavior = liveCfg && liveCfg.pkm && liveCfg.pkm.behavior ? liveCfg.pkm.behavior : {};
          const leftMode = behavior && behavior.leftMode && Array.isArray(behavior.leftMode.fields) ? behavior.leftMode.fields : [];
          const rightMode = behavior && behavior.rightMode && Array.isArray(behavior.rightMode.fields) ? behavior.rightMode.fields : [];
          const strictName = String((orderState.strictNames && orderState.strictNames[k]) || k).trim() || k;
          const findFieldByOrderKey = (arr, orderKey) => {
            const key = String(orderKey || "").trim();
            if (!key) return null;
            const strict = String((orderState.strictNames && orderState.strictNames[key]) || key).trim() || key;
            for (const row of arr) {
              if (!row || typeof row !== "object") continue;
              const rid = String(row.id || "").trim();
              const rkey = String(row.orderKey || "").trim();
              if (rkey && (rkey === key || rkey === strict)) return row;
              if (rid && (rid === key || rid === strict)) return row;
            }
            return null;
          };
          const upsertField = (arr, id, valueObj) => {
            const listNext = Array.isArray(arr) ? arr.slice() : [];
            const idx = listNext.findIndex((x) => x && String(x.id || "").trim() === String(id || "").trim());
            if (idx === -1) listNext.push(valueObj);
            else listNext[idx] = valueObj;
            return listNext;
          };

          if (kind === "element") {
            const elem = behavior && behavior.elements ? behavior.elements : {};
            const byField = elem && elem.byField ? elem.byField : {};
            const elementField = findFieldByOrderKey(rightMode, k) || findFieldByOrderKey(rightMode, strictName);
            const elementFieldId = String(elementField && elementField.id || "").trim() || String(k || "").trim();
            const curElem = byField && (byField[elementFieldId] || byField[k] || byField[strictName])
              ? (byField[elementFieldId] || byField[k] || byField[strictName])
              : {};
            const cur = {
              ...curElem,
              increment: {
                ...(curElem && curElem.increment && typeof curElem.increment === "object" ? curElem.increment : {}),
              },
            };
            const inc = cur && cur.increment ? cur.increment : {};
            const grid = details.createDiv();
            grid.style.display = "grid";
            grid.style.gridTemplateColumns = "80px 1fr";
            grid.style.gap = "6px";
            const addCell = (label, init, onSave) => {
              grid.createEl("small", { text: label });
              const i = grid.createEl("input");
              i.type = "text";
              i.value = init;
              i.placeholder = label === "Emoji"
                ? "place any emoji you want, only one per field"
                : "write any format you want, i.e. YYYY-MM-DD hh:mm, 000-000";
              i.disabled = !enabled;
              const commit = () => {
                if (!enabled) return;
                markSnapshot(captureSnapshot());
                onSave(String(i.value || ""));
                renderOrderBoard();
              };
              i.onchange = () => {
                commit();
              };
              return i;
            };
            addCell("Emoji", String(cur.emoji || ""), (v) => {
              const nextRow = { ...cur, emoji: v };
              plugin.setConfigPatch({ pkm: { behavior: { elements: { byField: { [elementFieldId]: nextRow } } } } }, "pkm:behavior:order:deep:emoji:" + k);
            });
            addCell("Format", String(cur.format || ""), (v) => {
              const nextRow = { ...cur, format: v };
              plugin.setConfigPatch({ pkm: { behavior: { elements: { byField: { [elementFieldId]: nextRow } } } } }, "pkm:behavior:order:deep:format:" + k);
            });
            grid.createEl("small", { text: "Behavior" });
            const modeSelect = grid.createEl("select");
            modeSelect.style.appearance = "none";
            modeSelect.style.paddingRight = "18px";
            modeSelect.style.backgroundImage = "linear-gradient(45deg, transparent 50%, var(--text-muted) 50%), linear-gradient(135deg, var(--text-muted) 50%, transparent 50%)";
            modeSelect.style.backgroundPosition = "calc(100% - 12px) calc(50% - 2px), calc(100% - 7px) calc(50% - 2px)";
            modeSelect.style.backgroundSize = "5px 5px, 5px 5px";
            modeSelect.style.backgroundRepeat = "no-repeat";
            modeSelect.createEl("option", { text: "Increment by X", value: "increment" });
            modeSelect.createEl("option", { text: "Command Y", value: "command" });
            modeSelect.createEl("option", { text: "Custom increment", value: "custom" });
            const modeRaw = String(inc.mode || "increment").trim().toLowerCase();
            modeSelect.value = ["increment", "command", "custom"].includes(modeRaw) ? modeRaw : "increment";
            modeSelect.disabled = !enabled;
            modeSelect.onchange = () => {
              if (!enabled) return;
              markSnapshot(captureSnapshot());
              const mode = String(modeSelect.value || "increment").trim().toLowerCase();
              const nextInc = { ...inc, mode };
              const nextRow = { ...cur, increment: nextInc };
              plugin.setConfigPatch({ pkm: { behavior: { elements: { byField: { [elementFieldId]: nextRow } } } } }, "pkm:behavior:order:deep:mode:" + k);
              renderOrderBoard();
            };
            const cmdWrap = details.createDiv();
            cmdWrap.style.display = "flex";
            cmdWrap.style.gap = "6px";
            cmdWrap.style.marginTop = "6px";
            const incInput = cmdWrap.createEl("input");
            incInput.type = "number";
            incInput.value = String(Number.isFinite(Number(inc.incrementBy)) ? Number(inc.incrementBy) : 1);
            incInput.style.width = "86px";
            const behaviorHint = cmdWrap.createEl("small");
            behaviorHint.style.opacity = "0.85";
            behaviorHint.style.alignSelf = "center";
            const cmdSelect = cmdWrap.createEl("select");
            for (const opt of ["now", "randomN", "randomE"]) cmdSelect.createEl("option", { text: opt, value: opt });
            cmdSelect.value = ["now", "randomN", "randomE"].includes(String(inc.command || "")) ? String(inc.command) : "now";
            const customIntro = details.createEl("small", { text: "hotkey will behave as you set it up below from top to bottom. Follow the format below and create powerful automatizations!" });
            customIntro.style.display = "none";
            customIntro.style.opacity = "0.9";
            customIntro.style.marginTop = "6px";
            const customWrap = details.createDiv();
            customWrap.style.display = "none";
            customWrap.style.gridTemplateColumns = "32px 1fr";
            customWrap.style.gap = "6px";
            customWrap.style.marginTop = "6px";
            const customNums = customWrap.createEl("pre");
            customNums.style.margin = "0";
            customNums.style.padding = "7px 4px";
            customNums.style.border = "1px solid var(--background-modifier-border)";
            customNums.style.borderRadius = "6px";
            customNums.style.background = "var(--background-secondary)";
            customNums.style.userSelect = "none";
            customNums.style.opacity = "0.75";
            customNums.style.fontSize = "12px";
            customNums.style.lineHeight = "1.45";
            customNums.style.textAlign = "right";
            const customArea = customWrap.createEl("textarea");
            customArea.rows = 3;
            customArea.style.width = "100%";
            customArea.style.fontSize = "12px";
            customArea.style.lineHeight = "1.45";
            customArea.value = Array.isArray(inc.customRaw) ? inc.customRaw.join("\n") : "";
            customArea.placeholder = "1. X (Y)\n- X - increment number\n- Y - how many hotkey taps before moving to the next step\n- i.e. 1 (3) -> for next 3 taps the element will increase at 1\n\n2. X\n- if it's not clear - it's just only X without (Y)\n- it works only for 1 tap before moving next (but if it is the last item - it will work for every next press on hotkey till the end of times)\n\n3. END\n- end of cycle, it deletes the element and next press will start from (1)";
            const normalizeCustomRaw = (text) => {
              const rows = String(text || "").split(/\r?\n/).map((x) => String(x || "").trim()).filter(Boolean);
              const out = [];
              for (let i = 0; i < rows.length; i++) {
                const src = rows[i].trim();
                if (!src) continue;
                out.push(src);
              }
              return out;
            };
            const formatCustomNumbered = (rows) => {
              const src = Array.isArray(rows) ? rows : [];
              const out = [];
              for (let i = 0; i < src.length; i++) out.push(`${i + 1}.`);
              return out.join("\n");
            };
            const syncCustomNums = () => {
              const rows = String(customArea.value || "").split(/\r?\n/);
              const count = Math.max(1, rows.length);
              const nums = [];
              for (let i = 0; i < count; i++) nums.push(`${i + 1}.`);
              customNums.setText(nums.join("\n"));
            };
            syncCustomNums();
            const syncModeVis = () => {
              const m = String(modeSelect.value || "increment");
              incInput.style.display = m === "increment" ? "" : "none";
              cmdSelect.style.display = m === "command" ? "" : "none";
              customWrap.style.display = m === "custom" ? "grid" : "none";
              customIntro.style.display = m === "custom" ? "block" : "none";
              if (m === "command") {
                if (cmdWrap.firstChild !== cmdSelect) {
                  cmdWrap.insertBefore(cmdSelect, behaviorHint);
                }
              }
              if (m === "increment") {
                behaviorHint.setText("write a number, each press will increment current value by it");
              } else if (m === "command") {
                const c = String(cmdSelect.value || "now");
                if (c === "randomN") behaviorHint.setText("will input random numbers (0-9) in Format you enter above");
                else if (c === "randomE") behaviorHint.setText("will input random elements (i.e. af3A#-1z-cv) in Format you enter above");
                else behaviorHint.setText("will input current date and time in Format you enter above");
              } else {
                behaviorHint.setText("custom increment sequence");
              }
            };
            syncModeVis();
            modeSelect.addEventListener("change", syncModeVis);
            const toNormalizedCustomIncrement = (rawList, fallbackList) => {
              const src = Array.isArray(rawList) ? rawList : [];
              const out = [];
              for (let i = 0; i < src.length; i++) {
                const row = String(src[i] || "").trim();
                if (!row || /^END$/i.test(row)) continue;
                const m = row.match(/^(-?\d+)(?:\s*\(\s*(\d+)\s*\))?$/);
                if (!m) continue;
                const step = Math.max(0, Math.trunc(Number(m[1] || 0)));
                const repeat = Math.max(1, Math.trunc(Number(m[2] || 1)));
                for (let r = 0; r < repeat; r++) out.push(step);
              }
              if (out.length) return out;
              const fb = Array.isArray(fallbackList) ? fallbackList : [];
              return fb.map((x) => Math.max(0, Math.trunc(Number(x || 0)))).filter((x) => Number.isFinite(x));
            };
            incInput.onchange = () => {
              if (!enabled) return;
              markSnapshot(captureSnapshot());
              const nextInc = { ...inc, mode: "increment", incrementBy: Number(incInput.value || 1) };
              const nextRow = { ...cur, increment: nextInc };
              plugin.setConfigPatch({ pkm: { behavior: { elements: { byField: { [elementFieldId]: nextRow } } } } }, "pkm:behavior:order:deep:inc:" + k);
            };
            cmdSelect.onchange = () => {
              if (!enabled) return;
              markSnapshot(captureSnapshot());
              const nextInc = { ...inc, mode: "command", command: String(cmdSelect.value || "now") };
              const nextRow = { ...cur, increment: nextInc };
              plugin.setConfigPatch({ pkm: { behavior: { elements: { byField: { [elementFieldId]: nextRow } } } } }, "pkm:behavior:order:deep:command:" + k);
              syncModeVis();
            };
            const commitCustomRaw = () => {
              if (!enabled) return;
              markSnapshot(captureSnapshot());
              const raw = normalizeCustomRaw(customArea.value || "");
              const nextInc = {
                ...inc,
                mode: "custom",
                customRaw: raw,
                custom: toNormalizedCustomIncrement(raw, inc.custom),
              };
              syncCustomNums();
              const nextRow = { ...cur, increment: nextInc };
              plugin.setConfigPatch({ pkm: { behavior: { elements: { byField: { [elementFieldId]: nextRow } } } } }, "pkm:behavior:order:deep:custom:" + k);
            };
            customArea.onchange = () => {
              commitCustomRaw();
            };
            customArea.oninput = () => {
              syncCustomNums();
            };
          } else {
            const parentField = findFieldByOrderKey(leftMode, k) || findFieldByOrderKey(rightMode, k);
            const subKey = `${k}_sub`;
            const subField = findFieldByOrderKey(leftMode, subKey) || findFieldByOrderKey(rightMode, subKey);
            const hasFieldById = (arr, fieldId) => {
              const fid = String(fieldId || "").trim();
              if (!fid || !Array.isArray(arr)) return false;
              for (let i = 0; i < arr.length; i++) {
                const row = arr[i];
                if (!row || typeof row !== "object") continue;
                if (String(row.id || "").trim() === fid) return true;
              }
              return false;
            };
            const parentFieldIdResolved = String(parentField && parentField.id || "").trim();
            const subFieldIdResolved = String(subField && subField.id || "").trim();
            const parentInRight = hasFieldById(rightMode, parentFieldIdResolved);
            const subInRight = hasFieldById(rightMode, subFieldIdResolved);
            const prefixRules = behavior && behavior.prefixRules && typeof behavior.prefixRules === "object"
              ? behavior.prefixRules
              : {};
            const checkboxByFieldValue = prefixRules && prefixRules.checkboxByFieldValue && typeof prefixRules.checkboxByFieldValue === "object"
              ? prefixRules.checkboxByFieldValue
              : {};
            const parentFieldId = String(parentField && parentField.id || "").trim();
            const subFieldId = String(subField && subField.id || "").trim();
            const parentCheckboxRaw = parentFieldId && checkboxByFieldValue[parentFieldId] && typeof checkboxByFieldValue[parentFieldId] === "object"
              ? checkboxByFieldValue[parentFieldId]
              : {};
            const subCheckboxRaw = subFieldId && checkboxByFieldValue[subFieldId] && typeof checkboxByFieldValue[subFieldId] === "object"
              ? checkboxByFieldValue[subFieldId]
              : {};
            const normalizeCheckbox = (raw) => (typeof deepState.normalizeCheckboxToken === "function"
              ? deepState.normalizeCheckboxToken(raw)
              : String(raw || "").trim());
            const fieldCheckboxByToken = {};
            for (const rawToken of Object.keys(parentCheckboxRaw || {})) {
              const normToken = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(rawToken, kind) : String(rawToken || "").trim();
              const cb = normalizeCheckbox(parentCheckboxRaw[rawToken]);
              if (normToken && cb) fieldCheckboxByToken[normToken] = cb;
            }
            for (const rawToken of Object.keys(subCheckboxRaw || {})) {
              const normToken = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(rawToken, kind) : String(rawToken || "").trim();
              const cb = normalizeCheckbox(subCheckboxRaw[rawToken]);
              if (normToken && cb) fieldCheckboxByToken[normToken] = cb;
            }
            const tree = typeof deepState.buildTagTree === "function"
              ? deepState.buildTagTree(parentField, subField, kind, { checkboxByToken: fieldCheckboxByToken })
              : [];
            if (kind === "wikilink") {
              const vals = parentField && Array.isArray(parentField.values) ? parentField.values : [];
              const byTok = {};
              for (let vi = 0; vi < vals.length; vi++) {
                const row = vals[vi] && typeof vals[vi] === "object" ? vals[vi] : {};
                const tok = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(row.token, "wikilink") : String(row.token || "").trim();
                if (!tok) continue;
                byTok[tok] = row;
              }
              for (let ti = 0; ti < tree.length; ti++) {
                const trow = tree[ti] || {};
                const tok = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(trow.token, "wikilink") : String(trow.token || "").trim();
                const meta = byTok[tok] && typeof byTok[tok] === "object" ? byTok[tok] : {};
                tree[ti] = {
                  ...trow,
                  __ioParentBinding: String(meta.__ioParentBinding || "").trim(),
                  __ioParentFieldId: String(meta.__ioParentFieldId || "").trim(),
                  prefixMode: String(meta.prefixMode || "bullet").trim().toLowerCase() === "checkbox" ? "checkbox" : "bullet",
                  checkboxToken: String(meta.checkboxToken || "").trim(),
                };
              }
            }
            const buildWikilinkParentChoices = () => {
              const choices = [];
              const seenField = new Set();
              const orderKeys = getOrderKeys().filter((kk) => !/_sub$/.test(kk));
              const getFieldByOrderKeyAny = (orderKey) => findFieldByOrderKey(leftMode, orderKey) || findFieldByOrderKey(rightMode, orderKey);
              for (let oi = 0; oi < orderKeys.length; oi++) {
                const kk = String(orderKeys[oi] || "").trim();
                if (!kk || kk === k) continue;
                const fk = getFieldByOrderKeyAny(kk);
                if (!fk || !fk.id) continue;
                const source = String(fk.source || "").trim();
                if (source === "projects" || /^wikilinks:/.test(source)) continue;
                const fid = String(fk.id || "").trim();
                if (!fid || seenField.has(fid)) continue;
                seenField.add(fid);
                const strict = String(orderState && orderState.strictNames && orderState.strictNames[kk] ? orderState.strictNames[kk] : kk).trim() || kk;
                const vals = Array.isArray(fk.values) ? fk.values : [];
                const tokens = [];
                const subByOrder = getFieldByOrderKeyAny(`${kk}_sub`);
                const subFieldLocal = subByOrder && String(subByOrder.dependsOn || "").trim() === fid ? subByOrder : null;
                const subVals = subFieldLocal && Array.isArray(subFieldLocal.values) ? subFieldLocal.values : [];
                for (let vi = 0; vi < vals.length; vi++) {
                  const row = vals[vi] && typeof vals[vi] === "object" ? vals[vi] : {};
                  const ptok = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(row.token, "tag") : String(row.token || "").trim();
                  if (!ptok) continue;
                  tokens.push({ value: `p:${ptok}|f:${fid}`, label: ptok });
                  for (let si = 0; si < subVals.length; si++) {
                    const srow = subVals[si] && typeof subVals[si] === "object" ? subVals[si] : {};
                    const allowed = Array.isArray(srow.allowedParentValues) ? srow.allowedParentValues : [];
                    const hasParent = allowed.some((av) => {
                      const at = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(av, "tag") : String(av || "").trim();
                      return at === ptok;
                    });
                    if (!hasParent) continue;
                    const stok = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(srow.token, "tag") : String(srow.token || "").trim();
                    if (!stok) continue;
                    tokens.push({ value: `s:${stok}|p:${ptok}|f:${fid}`, label: `└ ${stok} (${ptok})` });
                  }
                }
                if (!tokens.length) continue;
                choices.push({ fieldId: fid, strictName: strict, tokens });
              }
              return choices;
            };
            const wikilinkParentChoices = kind === "wikilink" ? buildWikilinkParentChoices() : [];
            const inferWikilinkBindingValue = (token) => {
              const vals = parentField && Array.isArray(parentField.values) ? parentField.values : [];
              const normTarget = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(token, "wikilink") : String(token || "").trim();
              for (let i = 0; i < vals.length; i++) {
                const row = vals[i] && typeof vals[i] === "object" ? vals[i] : {};
                const rt = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(row.token, "wikilink") : String(row.token || "").trim();
                if (!rt || rt !== normTarget) continue;
                const explicit = String(row.__ioParentBinding || "").trim();
                if (explicit) return explicit;
                return "";
              }
              return "";
            };
            const listWrap = details.createDiv();
            listWrap.style.marginTop = "6px";
            let dragMeta = null;
            const buildCheckboxPatch = (nextTree, merged) => {
              const mergedMap = merged && merged.checkboxByToken && typeof merged.checkboxByToken === "object"
                ? merged.checkboxByToken
                : {};
              const parentOut = {};
              const subOut = {};
              const list = Array.isArray(nextTree) ? nextTree : [];
              for (let i = 0; i < list.length; i++) {
                const p = list[i] || {};
                const pTok = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(p.token, kind) : String(p.token || "").trim();
                const pCb = normalizeCheckbox(mergedMap[pTok]);
                if (pTok && pCb) parentOut[pTok] = pCb;
                const children = Array.isArray(p.children) ? p.children : [];
                for (let j = 0; j < children.length; j++) {
                  const c = children[j] || {};
                  const cTok = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(c.token, kind) : String(c.token || "").trim();
                  const cCb = normalizeCheckbox(mergedMap[cTok]);
                  if (cTok && cCb) subOut[cTok] = cCb;
                }
              }
              const patch = { pkm: { behavior: { prefixRules: { checkboxByFieldValue: {} } } } };
              if (parentFieldId) patch.pkm.behavior.prefixRules.checkboxByFieldValue[parentFieldId] = parentOut;
              if (subFieldId) patch.pkm.behavior.prefixRules.checkboxByFieldValue[subFieldId] = subOut;
              if (parentFieldId && parentCheckboxRaw && typeof parentCheckboxRaw === "object") {
                for (const prevTok of Object.keys(parentCheckboxRaw)) {
                  const normTok = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(prevTok, kind) : String(prevTok || "").trim();
                  if (normTok && !Object.prototype.hasOwnProperty.call(parentOut, normTok)) {
                    patch.pkm.behavior.prefixRules.checkboxByFieldValue[parentFieldId][normTok] = null;
                  }
                }
              }
              if (subFieldId && subCheckboxRaw && typeof subCheckboxRaw === "object") {
                for (const prevTok of Object.keys(subCheckboxRaw)) {
                  const normTok = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(prevTok, kind) : String(prevTok || "").trim();
                  if (normTok && !Object.prototype.hasOwnProperty.call(subOut, normTok)) {
                    patch.pkm.behavior.prefixRules.checkboxByFieldValue[subFieldId][normTok] = null;
                  }
                }
              }
              return patch;
            };
            const cloneTree = () => tree.map((p) => ({ ...p, children: (p.children || []).map((c) => ({ ...c })) }));
            const reorderTreeByDrag = (srcLevel, srcParentToken, srcToken, dstLevel, dstParentToken, dstToken) => {
              const nextTree = cloneTree();
              if (srcLevel === 0 && dstLevel === 0) {
                const fromIdx = nextTree.findIndex((x) => x.token === srcToken);
                const toIdx = nextTree.findIndex((x) => x.token === dstToken);
                if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return null;
                const picked = nextTree.splice(fromIdx, 1)[0];
                const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
                nextTree.splice(insertIdx, 0, picked);
                return nextTree;
              }
              if (srcLevel === 1 && dstLevel === 1 && srcParentToken && srcParentToken === dstParentToken) {
                const parent = nextTree.find((x) => x.token === srcParentToken);
                if (!parent) return null;
                const arr = Array.isArray(parent.children) ? parent.children : [];
                const fromIdx = arr.findIndex((x) => x.token === srcToken);
                const toIdx = arr.findIndex((x) => x.token === dstToken);
                if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return null;
                const picked = arr.splice(fromIdx, 1)[0];
                const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
                arr.splice(insertIdx, 0, picked);
                parent.children = arr;
                return nextTree;
              }
              return null;
            };
            const renderTokenRow = (token, level, parentToken) => {
              const rowWrap = listWrap.createDiv();
              rowWrap.style.display = "flex";
              rowWrap.style.flexDirection = "column";
              rowWrap.style.gap = "4px";
              rowWrap.style.marginBottom = "10px";
              rowWrap.style.width = "100%";
              rowWrap.style.maxWidth = "100%";
              rowWrap.style.boxSizing = "border-box";
              rowWrap.style.overflowX = "hidden";
              rowWrap.style.position = "relative";
              if (kind === "tag") {
                rowWrap.style.display = "flex";
                rowWrap.style.flexDirection = "column";
                rowWrap.style.gap = "4px";
                rowWrap.style.position = "relative";
                rowWrap.style.marginBottom = "8px";
              }
              const rr = rowWrap.createDiv();
              rr.style.display = "flex";
              rr.style.alignItems = "center";
              rr.style.gap = "4px";
              rr.style.marginLeft = level === 1 ? "29px" : "16px";
              rr.style.width = level === 1 ? "calc(100% - 29px)" : "calc(100% - 16px)";
              rr.style.minWidth = "0";
              rr.style.maxWidth = "100%";
              rr.style.overflow = "hidden";
              if (kind === "tag") {
                rr.style.display = "grid";
                rr.style.gridTemplateColumns = cols;
                rr.style.columnGap = "6px";
                rr.style.rowGap = "0";
                rr.style.alignItems = "center";
                rr.style.gridAutoRows = "28px";
                rr.style.marginLeft = level === 1 ? "20px" : "10px";
                rr.style.width = level === 1 ? "calc(100% - 20px)" : "calc(100% - 10px)";
              }
              if (level === 1 && kind === "tag") {
                rr.style.background = "var(--background-modifier-hover)";
                rr.style.border = "1px solid var(--background-modifier-border)";
                rr.style.borderRadius = "6px";
                rr.style.padding = "4px 0";
              }
              const setDeepTip = (el, text) => {
                if (!showInfoTips || !el) return;
                const tip = String(text || "").trim();
                if (!tip) return;
                try { el.title = tip; } catch (_) {}
              };
              const dragHandleHost = rowWrap;
              const dragHandle = dragHandleHost.createEl("span", { text: "⋮⋮" });
              dragHandle.style.opacity = "0.75";
              dragHandle.style.cursor = enabled ? "grab" : "default";
              dragHandle.style.userSelect = "none";
              dragHandle.style.position = "absolute";
              dragHandle.style.left = level === 1 ? "8px" : "0px";
              dragHandle.style.top = "50%";
              dragHandle.style.transform = "translateY(-50%)";
              dragHandle.style.display = "inline-flex";
              dragHandle.style.alignItems = "center";
              dragHandle.style.justifyContent = "center";
              dragHandle.style.zIndex = "1";
              dragHandle.style.flex = "0 0 14px";
              dragHandle.style.minWidth = "14px";
              dragHandle.style.width = "14px";
              dragHandle.style.whiteSpace = "pre";
              dragHandle.style.lineHeight = "1";
              dragHandle.style.textAlign = "center";
              dragHandle.draggable = !!enabled;
              if (kind === "tag") {
                dragHandle.style.position = "absolute";
                dragHandle.style.left = "-4px";
                dragHandle.style.top = "50%";
                dragHandle.style.transform = "translateY(-50%)";
                dragHandle.style.gridColumn = "";
                dragHandle.style.gridRow = "";
                dragHandle.style.alignSelf = "";
                dragHandle.style.justifySelf = "";
                dragHandle.style.margin = "0";
              }
              let resolveDragAnchorY = null;
              const syncDragHandlePos = () => {
                if (kind === "tag") {
                  const y = Math.max(0, Number(rr && rr.offsetTop || 0) + Number(rr && rr.offsetHeight || 0) + 3);
                  dragHandle.style.top = `${y}px`;
                  dragHandle.style.transform = "translateY(-50%)";
                  return;
                }
                const hasColorBlock = kind === "tag" && showDeepEditor && showColorSettingsUi;
                if (hasColorBlock) {
                  let y = NaN;
                  try {
                    y = typeof resolveDragAnchorY === "function" ? Number(resolveDragAnchorY()) : NaN;
                  } catch (_) {
                    y = NaN;
                  }
                  if (!Number.isFinite(y) || y <= 0) {
                    y = Math.max(0, Number(rr && rr.offsetTop || 0) + Number(rr && rr.offsetHeight || 0) + 2);
                  }
                  dragHandle.style.top = `${Math.max(0, y)}px`;
                  dragHandle.style.transform = "translateY(-50%)";
                  return;
                }
                dragHandle.style.top = "50%";
                dragHandle.style.transform = "translateY(-50%)";
              };
              dragHandle.ondragstart = (e) => {
                if (!enabled) return;
                dragMeta = { level, parentToken: String(parentToken || ""), token: String(token || "") };
                dragHandle.style.cursor = "grabbing";
                try {
                  if (e && e.dataTransfer) {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", JSON.stringify(dragMeta));
                  }
                } catch (_) {}
              };
              dragHandle.ondragend = () => {
                dragMeta = null;
                dragHandle.style.cursor = enabled ? "grab" : "default";
              };

              rr.ondragover = (e) => {
                if (!enabled || !dragMeta) return;
                const sameLevel = dragMeta.level === level;
                const sameParent = level === 0 || String(dragMeta.parentToken || "") === String(parentToken || "");
                if (!sameLevel || !sameParent) return;
                e.preventDefault();
                rr.style.outline = "1px dashed var(--text-accent)";
                rr.style.background = "var(--background-modifier-hover)";
              };
              rr.ondragleave = () => {
                rr.style.outline = "";
                rr.style.background = "";
              };
              rr.ondrop = (e) => {
                rr.style.outline = "";
                rr.style.background = "";
                if (!enabled || !dragMeta) return;
                e.preventDefault();
                const nextTree = reorderTreeByDrag(
                  Number(dragMeta.level || 0),
                  String(dragMeta.parentToken || ""),
                  String(dragMeta.token || ""),
                  level,
                  String(parentToken || ""),
                  String(token || "")
                );
                if (!nextTree) return;
                saveTree(nextTree, "pkm:behavior:order:deep:drag-reorder:" + k);
              };

              const indentBtn = rr.createEl("button", { text: level === 0 ? "→" : "←" });
              indentBtn.style.height = "28px";
              if (kind === "tag") {
                indentBtn.style.gridColumn = "1";
                indentBtn.style.gridRow = "1";
                indentBtn.style.justifySelf = "start";
                indentBtn.style.marginLeft = "2px";
                indentBtn.style.marginRight = "0";
              }
              setDeepTip(indentBtn, "Move token between parent and child levels.");
              indentBtn.disabled = !enabled || kind === "wikilink";
              if (kind === "wikilink") {
                indentBtn.style.opacity = "0.45";
                indentBtn.title = "Hierarchy move is disabled for wikilink rows";
              }
              const inpt = rr.createEl("input");
              inpt.type = "text";
              const uiToken = kind === "wikilink"
                ? String(token || "").replace(/^\[\[/, "").replace(/\]\]$/, "")
                : token;
              inpt.value = uiToken;
              const tokenInputWidth = kind === "wikilink"
                ? (level === 0 ? "144px" : "132px")
                : "126px";
              inpt.style.flex = `0 1 ${tokenInputWidth}`;
              inpt.style.minWidth = "0";
              inpt.style.maxWidth = tokenInputWidth;
              inpt.style.height = "28px";
              if (kind === "tag") {
                inpt.style.width = "100%";
                inpt.style.minWidth = "0";
                inpt.style.maxWidth = "100%";
                inpt.style.flex = "1 1 auto";
                inpt.style.boxSizing = "border-box";
                inpt.style.gridColumn = "2 / span 2";
                inpt.style.gridRow = "1";
              }
              inpt.disabled = !enabled;
              setDeepTip(inpt, kind === "wikilink" ? "Edit link token value." : "Edit tag token value.");
              let modeSelect = null;
              let checkboxInput = null;
              if (kind === "tag") {
                const prefixWrap = rr.createDiv();
                prefixWrap.style.display = "grid";
                prefixWrap.style.gridTemplateColumns = "104px 64px";
                prefixWrap.style.columnGap = "8px";
                prefixWrap.style.alignItems = "center";
                prefixWrap.style.width = "100%";
                prefixWrap.style.minWidth = "0";
                prefixWrap.style.boxSizing = "border-box";
                prefixWrap.style.gridColumn = "4 / span 2";
                prefixWrap.style.gridRow = "1";
                modeSelect = prefixWrap.createEl("select");
                modeSelect.createEl("option", { text: "bullet", value: "bullet" });
                modeSelect.createEl("option", { text: "checkbox", value: "checkbox" });
                modeSelect.style.width = "104px";
                modeSelect.style.minWidth = "104px";
                modeSelect.style.maxWidth = "104px";
                modeSelect.style.height = "28px";
                modeSelect.style.justifySelf = "start";
                setDeepTip(modeSelect, "Choose bullet or checkbox prefix mode.");
                checkboxInput = prefixWrap.createEl("input");
                checkboxInput.type = "text";
                checkboxInput.style.width = "64px";
                checkboxInput.style.minWidth = "64px";
                checkboxInput.style.maxWidth = "64px";
                checkboxInput.style.height = "28px";
                checkboxInput.style.justifySelf = "start";
                checkboxInput.placeholder = "- [ ]";
                setDeepTip(checkboxInput, "Checkbox token format: [ ] or [X].");
              } else {
                modeSelect = rr.createEl("select");
                modeSelect.createEl("option", { text: "bullet", value: "bullet" });
                modeSelect.createEl("option", { text: "checkbox", value: "checkbox" });
                const modeWidth = "76px";
                modeSelect.style.width = modeWidth;
                modeSelect.style.minWidth = modeWidth;
                modeSelect.style.maxWidth = modeWidth;
                modeSelect.style.flex = "0 0 auto";
                modeSelect.style.height = "28px";
                setDeepTip(modeSelect, "Choose bullet or checkbox prefix mode.");
                checkboxInput = rr.createEl("input");
                checkboxInput.type = "text";
                checkboxInput.style.width = "52px";
                checkboxInput.style.minWidth = "52px";
                checkboxInput.style.maxWidth = "52px";
                checkboxInput.style.flex = "0 0 auto";
                checkboxInput.style.height = "28px";
                checkboxInput.placeholder = "- [ ]";
                setDeepTip(checkboxInput, "Checkbox token format: [ ] or [X].");
              }
              const yamlTokenInput = rr.createEl("input");
              yamlTokenInput.type = "text";
              const deepYamlWidth = compactCols ? "94px" : "128px";
              yamlTokenInput.style.width = kind === "tag" ? deepYamlWidth : "100%";
              yamlTokenInput.style.minWidth = kind === "tag" ? deepYamlWidth : "0";
              yamlTokenInput.style.maxWidth = kind === "tag" ? deepYamlWidth : "100%";
              yamlTokenInput.style.flex = "1 1 auto";
              yamlTokenInput.style.boxSizing = "border-box";
              if (kind === "tag") yamlTokenInput.style.gridColumn = "6";
              if (kind === "tag") yamlTokenInput.style.gridRow = "1";
              if (kind === "tag") yamlTokenInput.style.marginLeft = "-4px";
              if (kind === "tag") yamlTokenInput.style.justifySelf = "start";
              yamlTokenInput.style.height = "28px";
              yamlTokenInput.style.fontSize = "11px";
              yamlTokenInput.placeholder = "yaml property";
              if (kind !== "tag") yamlTokenInput.style.display = "none";
              setDeepTip(yamlTokenInput, "Optional token-level YAML override.");
              let detachDeepYamlDropdown = () => {};
              if (kind === "tag") {
                detachDeepYamlDropdown = attachYamlSuggestionDropdown(yamlTokenInput);
              }
              let parentFieldSelect = null;
              let parentTokenSelect = null;
              if (kind === "wikilink") {
                parentFieldSelect = rr.createEl("select");
                parentFieldSelect.style.width = "104px";
                parentFieldSelect.style.minWidth = "104px";
                parentFieldSelect.style.maxWidth = "104px";
                parentFieldSelect.style.flex = "0 0 auto";
                parentFieldSelect.createEl("option", { text: "parent field", value: "" });
                setDeepTip(parentFieldSelect, "Choose parent field for link binding.");
                for (let pi = 0; pi < wikilinkParentChoices.length; pi++) {
                  const row = wikilinkParentChoices[pi];
                  parentFieldSelect.createEl("option", { text: row.strictName, value: row.fieldId });
                }
                parentTokenSelect = rr.createEl("select");
                parentTokenSelect.style.width = "186px";
                parentTokenSelect.style.minWidth = "186px";
                parentTokenSelect.style.maxWidth = "186px";
                parentTokenSelect.style.flex = "0 0 auto";
                parentTokenSelect.createEl("option", { text: "parent token", value: "" });
                setDeepTip(parentTokenSelect, "Choose parent token for link binding.");
                parentFieldSelect.disabled = !enabled;
                parentTokenSelect.disabled = !enabled;
              }
              const del = rr.createEl("button");
              del.ariaLabel = "delete " + token;
              setIcon(del, "trash-2");
              del.style.background = "#d32f2f";
              del.style.color = "#ffffff";
              del.style.width = "28px";
              del.style.minWidth = "28px";
              del.style.maxWidth = "28px";
              del.style.height = "28px";
              del.style.padding = "2px 4px";
              del.style.border = "none";
              del.style.display = "inline-flex";
              del.style.alignItems = "center";
              del.style.justifyContent = "center";
              del.style.marginLeft = kind === "tag" ? "0" : "auto";
              if (kind === "tag") del.style.gridColumn = "10";
              if (kind === "tag") del.style.gridRow = "1";
              if (kind === "tag") del.style.justifySelf = "end";
              if (kind === "tag") del.style.marginRight = "0";
              del.disabled = !enabled;
              setDeepTip(del, "Delete token row.");
              const currentRow = level === 0
                ? (tree.find((x) => x.token === token) || {})
                : (((tree.find((x) => x.token === parentToken) || {}).children || []).find((x) => x.token === token) || {});
              const resolveTokenYamlFromFields = () => {
                if (kind !== "tag") return "";
                const wanted = typeof deepState.denormToken === "function" ? deepState.denormToken(token) : String(token || "").trim().replace(/^#/, "");
                const list = level === 0
                  ? (parentField && Array.isArray(parentField.values) ? parentField.values : [])
                  : (subField && Array.isArray(subField.values) ? subField.values : []);
                for (let i = 0; i < list.length; i++) {
                  const row = list[i] && typeof list[i] === "object" ? list[i] : null;
                  if (!row) continue;
                  const rowTok = typeof deepState.denormToken === "function"
                    ? deepState.denormToken(row.token)
                    : String(row.token || "").trim().replace(/^#/, "");
                  if (!rowTok || rowTok !== wanted) continue;
                  return String(row.yamlProperty || "").trim();
                }
                return "";
              };
              const modeNow = String(currentRow.prefixMode || "bullet").trim().toLowerCase() === "checkbox" ? "checkbox" : "bullet";
              modeSelect.value = modeNow;
              yamlTokenInput.value = String(currentRow.yamlProperty || resolveTokenYamlFromFields() || "").trim();
              checkboxInput.value = modeNow === "checkbox"
                ? (String(currentRow.checkboxToken || "").trim() ? `- ${String(currentRow.checkboxToken || "").trim()}` : "- [ ]")
                : "";
              checkboxInput.style.visibility = modeNow === "checkbox" ? "visible" : "hidden";
              checkboxInput.style.pointerEvents = modeNow === "checkbox" ? "auto" : "none";
              modeSelect.disabled = !enabled;
              checkboxInput.disabled = !enabled;
              let bindingValue = kind === "wikilink" ? inferWikilinkBindingValue(token) : "";
              const fillParentTokens = () => {
                if (kind !== "wikilink" || !parentFieldSelect || !parentTokenSelect) return;
                const fieldId = String(parentFieldSelect.value || "").trim();
                parentTokenSelect.empty();
                parentTokenSelect.createEl("option", { text: "parent token", value: "" });
                if (!fieldId) {
                  parentTokenSelect.value = "";
                  return;
                }
                const row = wikilinkParentChoices.find((x) => x.fieldId === fieldId);
                const toks = row && Array.isArray(row.tokens) ? row.tokens : [];
                for (let i = 0; i < toks.length; i++) {
                  const t = toks[i];
                  parentTokenSelect.createEl("option", { text: t.label, value: t.value });
                }
                if (bindingValue && toks.some((x) => x.value === bindingValue)) parentTokenSelect.value = bindingValue;
                const sel = toks.find((x) => x.value === String(parentTokenSelect.value || "").trim());
                parentTokenSelect.title = sel ? String(sel.label || "") : "";
              };
              if (kind === "wikilink" && parentFieldSelect && parentTokenSelect) {
                const fieldFromBinding = (() => {
                  const m = String(bindingValue || "").match(/\|f:([^|]+)$/);
                  return m ? String(m[1] || "").trim() : "";
                })();
                if (fieldFromBinding) parentFieldSelect.value = fieldFromBinding;
                fillParentTokens();
              }
              const saveTree = (nextTree, reason) => {
                if (typeof deepState.applyTagTreeToFields !== "function") return;
                markSnapshot(captureSnapshot());
                if (kind === "wikilink") {
                  const prevVals = parentField && Array.isArray(parentField.values) ? parentField.values : [];
                  const metaByToken = {};
                  for (let i = 0; i < prevVals.length; i++) {
                    const row = prevVals[i] && typeof prevVals[i] === "object" ? prevVals[i] : {};
                    const tok = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(row.token, "wikilink") : String(row.token || "").trim();
                    if (!tok) continue;
                    metaByToken[tok] = row;
                  }
                  const nextValues = [];
                  for (let i = 0; i < nextTree.length; i++) {
                    const row = nextTree[i] || {};
                    const tok = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(row.token, "wikilink") : String(row.token || "").trim();
                    if (!tok) continue;
                    const prev = metaByToken[tok] && typeof metaByToken[tok] === "object" ? metaByToken[tok] : {};
                    const b = String(row.__ioParentBinding || prev.__ioParentBinding || "").trim();
                    let allowedParentValues = [];
                    let parentFieldId = "";
                    if (b) {
                      const mField = b.match(/\|f:([^|]+)$/);
                      parentFieldId = mField ? String(mField[1] || "").trim() : "";
                      const mSub = b.match(/^s:([^|]+)\|p:([^|]+)/);
                      const mParent = b.match(/^p:([^|]+)/);
                      if (mSub) allowedParentValues = [String(mSub[2] || "").trim().replace(/^#/, ""), String(mSub[1] || "").trim().replace(/^#/, "")];
                      else if (mParent) allowedParentValues = [String(mParent[1] || "").trim().replace(/^#/, "")];
                    }
                    nextValues.push({
                      ...prev,
                      token: tok.replace(/^\[\[|\]\]$/g, ""),
                      prefixMode: String(row.prefixMode || prev.prefixMode || "bullet").trim().toLowerCase() === "checkbox" ? "checkbox" : "bullet",
                      checkboxToken: String(row.checkboxToken || prev.checkboxToken || "").trim(),
                      allowedParentValues,
                      __ioParentBinding: b,
                      __ioParentFieldId: parentFieldId,
                      active: typeof prev.active === "boolean" ? prev.active : true,
                    });
                  }
                  const fidParent = String(parentField && parentField.id || "").trim() || String(strictName || k || "").trim();
                  let nextLeft = leftMode.slice();
                  let nextRight = rightMode.slice();
                  if (!fidParent) {
                    new Notice("InlineOverhaul: cannot resolve target link field for Deep Editor save");
                    return;
                  }
                  const sourceId = String((parentField && parentField.source) || `wikilinks:${fidParent}`).trim();
                  const nextParent = {
                    ...(parentField || {}),
                    id: fidParent,
                    prefix: String(parentField && parentField.prefix || "#").trim() || "#",
                    source: sourceId,
                    placeholder: String(parentField && parentField.placeholder || fidParent).trim() || fidParent,
                    values: nextValues,
                  };
                  if (parentInRight || hasFieldById(rightMode, fidParent)) nextRight = upsertField(nextRight, fidParent, nextParent);
                  else nextLeft = upsertField(nextLeft, fidParent, nextParent);
                  plugin.setConfigPatch({ pkm: { behavior: { leftMode: { fields: nextLeft }, rightMode: { fields: nextRight } } } }, reason);
                  renderOrderBoard();
                  return;
                }
                const merged = deepState.applyTagTreeToFields(nextTree, parentField || { id: k, prefix: "#", values: [] }, subField || { id: subKey, values: [] }, kind);
                if (kind === "tag") {
                  const fieldYaml = String((orderState.propertiesByField && orderState.propertiesByField[k]) || "").trim();
                  const parentYamlByToken = {};
                  const subYamlByToken = {};
                  for (let i = 0; i < nextTree.length; i++) {
                    const row = nextTree[i] || {};
                    const pTok = typeof deepState.denormToken === "function" ? deepState.denormToken(row.token) : String(row.token || "").trim().replace(/^#/, "");
                    if (!pTok) continue;
                    const py = String(row.yamlProperty || "").trim();
                    if (py && py !== fieldYaml) parentYamlByToken[pTok] = py;
                    const ch = Array.isArray(row.children) ? row.children : [];
                    for (let j = 0; j < ch.length; j++) {
                      const crow = ch[j] || {};
                      const sTok = typeof deepState.denormToken === "function" ? deepState.denormToken(crow.token) : String(crow.token || "").trim().replace(/^#/, "");
                      if (!sTok) continue;
                      const sy = String(crow.yamlProperty || "").trim();
                      if (sy && sy !== fieldYaml) subYamlByToken[sTok] = sy;
                    }
                  }
                  const applyYamlMeta = (fieldObj, map) => {
                    if (!fieldObj || !Array.isArray(fieldObj.values)) return fieldObj;
                    const vals = fieldObj.values.map((v) => {
                      const row = v && typeof v === "object" ? { ...v } : v;
                      if (!row || typeof row !== "object") return row;
                      const tok = typeof deepState.denormToken === "function" ? deepState.denormToken(row.token) : String(row.token || "").trim().replace(/^#/, "");
                      if (!tok) {
                        delete row.yamlProperty;
                        return row;
                      }
                      const yy = String(map[tok] || "").trim();
                      if (yy) row.yamlProperty = yy;
                      else delete row.yamlProperty;
                      return row;
                    });
                    return { ...fieldObj, values: vals };
                  };
                  merged.parentField = applyYamlMeta(merged.parentField, parentYamlByToken);
                  if (merged.subField) merged.subField = applyYamlMeta(merged.subField, subYamlByToken);
                }
                const fidParent = String(parentField && parentField.id || "").trim();
                const fidSub = String(subField && subField.id || "").trim();
                let nextLeft = leftMode.slice();
                let nextRight = rightMode.slice();
                if (merged.parentField) {
                  if (fidParent) {
                    if (parentInRight) nextRight = upsertField(nextRight, fidParent, merged.parentField);
                    else nextLeft = upsertField(nextLeft, fidParent, merged.parentField);
                  } else {
                    nextRight = upsertField(nextRight, merged.parentField.id, merged.parentField);
                  }
                }
                if (merged.subField) {
                  if (fidSub) {
                    if (subInRight) nextRight = upsertField(nextRight, fidSub, merged.subField);
                    else nextLeft = upsertField(nextLeft, fidSub, merged.subField);
                  } else {
                    const dependsOnParentId = String(merged.subField.dependsOn || "").trim();
                    if (dependsOnParentId && hasFieldById(nextRight, dependsOnParentId)) nextRight = upsertField(nextRight, merged.subField.id, merged.subField);
                    else nextLeft = upsertField(nextLeft, merged.subField.id, merged.subField);
                  }
                }
                plugin.setConfigPatch({ pkm: { behavior: { leftMode: { fields: nextLeft }, rightMode: { fields: nextRight } } } }, reason);
                plugin.setConfigPatch(buildCheckboxPatch(nextTree, merged), reason + ":prefix");
                renderOrderBoard();
              };
              inpt.onchange = () => {
                const nextToken = typeof deepState.normalizeToken === "function"
                  ? deepState.normalizeToken(inpt.value, kind)
                  : String(inpt.value || "");
                const nextTree = tree.map((p) => ({ ...p, children: (p.children || []).map((c) => ({ ...c })) }));
                if (level === 0) {
                  const row = nextTree.find((x) => x.token === token);
                  if (row) row.token = nextToken;
                } else {
                  const prow = nextTree.find((x) => x.token === parentToken);
                  if (prow) {
                    const crow = (prow.children || []).find((x) => x.token === token);
                    if (crow) crow.token = nextToken;
                  }
                }
                saveTree(nextTree, "pkm:behavior:order:deep:rename:" + k);
              };
              del.onclick = () => {
                const nextTree = tree.map((p) => ({ ...p, children: (p.children || []).map((c) => ({ ...c })) }));
                if (level === 0) {
                  const idx = nextTree.findIndex((x) => x.token === token);
                  if (idx !== -1) nextTree.splice(idx, 1);
                } else {
                  const prow = nextTree.find((x) => x.token === parentToken);
                  if (prow) prow.children = (prow.children || []).filter((x) => x.token !== token);
                }
                saveTree(nextTree, "pkm:behavior:order:deep:delete-token:" + k);
              };
              indentBtn.onclick = () => {
                if (kind === "wikilink") return;
                const nextTree = tree.map((p) => ({ ...p, children: (p.children || []).map((c) => ({ ...c })) }));
                if (level === 0) {
                  const idx = nextTree.findIndex((x) => x.token === token);
                  if (idx > 0) {
                    const picked = nextTree.splice(idx, 1)[0];
                    nextTree[idx - 1].children = (nextTree[idx - 1].children || []).concat([{ token: picked.token }]);
                  }
                } else {
                  const prow = nextTree.find((x) => x.token === parentToken);
                  if (prow) {
                    const childIdx = (prow.children || []).findIndex((x) => x.token === token);
                    if (childIdx !== -1) {
                      prow.children.splice(childIdx, 1);
                      const pIdx = nextTree.findIndex((x) => x.token === parentToken);
                      nextTree.splice(pIdx + 1, 0, { token, prefix: prow.prefix || "#", children: [] });
                    }
                  }
                }
                saveTree(nextTree, "pkm:behavior:order:deep:indent:" + k);
              };
              modeSelect.onchange = () => {
                if (!enabled) return;
                const nextTree = tree.map((p) => ({ ...p, children: (p.children || []).map((c) => ({ ...c })) }));
                const mode = String(modeSelect.value || "bullet").trim().toLowerCase() === "checkbox" ? "checkbox" : "bullet";
                if (level === 0) {
                    const row = nextTree.find((x) => x.token === token);
                    if (row) {
                      row.prefixMode = mode;
                      row.checkboxToken = mode === "checkbox" ? normalizeCheckbox(row.checkboxToken || checkboxInput.value || "- [ ]") : "";
                      row.yamlProperty = String(row.yamlProperty || yamlTokenInput.value || "").trim();
                    }
                } else {
                  const prow = nextTree.find((x) => x.token === parentToken);
                  if (prow) {
                    const crow = (prow.children || []).find((x) => x.token === token);
                    if (crow) {
                      crow.prefixMode = mode;
                      crow.checkboxToken = mode === "checkbox" ? normalizeCheckbox(crow.checkboxToken || checkboxInput.value || "- [ ]") : "";
                      crow.yamlProperty = String(crow.yamlProperty || yamlTokenInput.value || "").trim();
                    }
                  }
                }
                checkboxInput.style.visibility = mode === "checkbox" ? "visible" : "hidden";
                checkboxInput.style.pointerEvents = mode === "checkbox" ? "auto" : "none";
                if (mode === "checkbox") {
                  const preview = level === 0
                    ? (nextTree.find((x) => x.token === token) || {})
                    : (((nextTree.find((x) => x.token === parentToken) || {}).children || []).find((x) => x.token === token) || {});
                  const cbNorm = normalizeCheckbox(preview.checkboxToken || "- [ ]") || "[ ]";
                  checkboxInput.value = `- ${cbNorm}`;
                }
                saveTree(nextTree, "pkm:behavior:order:deep:prefix-mode:" + k);
              };
              checkboxInput.onchange = () => {
                if (!enabled) return;
                const nextTree = tree.map((p) => ({ ...p, children: (p.children || []).map((c) => ({ ...c })) }));
                const cb = normalizeCheckbox(checkboxInput.value || "");
                if (!cb) {
                  new Notice("InlineOverhaul: checkbox token must be like [ ] or [I]");
                  checkboxInput.value = String(currentRow.checkboxToken || "- [ ]");
                  return;
                }
                if (level === 0) {
                    const row = nextTree.find((x) => x.token === token);
                    if (row) {
                      row.prefixMode = "checkbox";
                      row.checkboxToken = cb;
                      row.yamlProperty = String(row.yamlProperty || yamlTokenInput.value || "").trim();
                    }
                } else {
                  const prow = nextTree.find((x) => x.token === parentToken);
                  if (prow) {
                    const crow = (prow.children || []).find((x) => x.token === token);
                    if (crow) {
                      crow.prefixMode = "checkbox";
                      crow.checkboxToken = cb;
                      crow.yamlProperty = String(crow.yamlProperty || yamlTokenInput.value || "").trim();
                    }
                  }
                }
                modeSelect.value = "checkbox";
                checkboxInput.value = `- ${cb}`;
                saveTree(nextTree, "pkm:behavior:order:deep:checkbox:" + k);
              };
              yamlTokenInput.onchange = () => {
                if (!enabled || kind !== "tag") return;
                const nextTree = tree.map((p) => ({ ...p, children: (p.children || []).map((c) => ({ ...c })) }));
                const nextYaml = String(yamlTokenInput.value || "").trim();
                if (level === 0) {
                  const row = nextTree.find((x) => x.token === token);
                  if (row) row.yamlProperty = nextYaml;
                } else {
                  const prow = nextTree.find((x) => x.token === parentToken);
                  if (prow) {
                    const crow = (prow.children || []).find((x) => x.token === token);
                    if (crow) crow.yamlProperty = nextYaml;
                  }
                }
                saveTree(nextTree, "pkm:behavior:order:deep:yaml:" + k);
              };
              if (kind === "wikilink" && parentFieldSelect && parentTokenSelect) {
                parentFieldSelect.onchange = () => {
                  const fid = String(parentFieldSelect.value || "").trim();
                  bindingValue = "";
                  fillParentTokens();
                  if (!fid) {
                    const nextTree = tree.map((p) => ({ ...p, children: (p.children || []).map((c) => ({ ...c })) }));
                    const row = nextTree.find((x) => x.token === token);
                    if (row) row.__ioParentBinding = "";
                    saveTree(nextTree, "pkm:behavior:order:deep:wikilink-parent-field:" + k);
                  }
                };
                parentTokenSelect.onchange = () => {
                  bindingValue = String(parentTokenSelect.value || "").trim();
                  const opt = parentTokenSelect.options[parentTokenSelect.selectedIndex];
                  parentTokenSelect.title = opt ? String(opt.text || "") : "";
                  const nextTree = tree.map((p) => ({ ...p, children: (p.children || []).map((c) => ({ ...c })) }));
                  const row = nextTree.find((x) => x.token === token);
                  if (row) row.__ioParentBinding = bindingValue;
                  saveTree(nextTree, "pkm:behavior:order:deep:wikilink-parent-token:" + k);
                };
              }
              onNodeDetachedOnce(rowWrap, () => {
                try { detachDeepYamlDropdown(); } catch (_) {}
              });

              if (kind === "tag" && showDeepEditor && showColorSettingsUi) {
                let livePreviewToken = String(token || "").trim();
                const visualFieldId = parentFieldId || String(parentField && parentField.id || "").trim();
                const visualRow = getTagVisualRow(visualFieldId, token);
                const visualWrap = rowWrap.createDiv();
                visualWrap.style.display = "flex";
                visualWrap.style.flexDirection = "column";
                visualWrap.style.gap = "0";
                visualWrap.style.width = "100%";
                visualWrap.style.maxWidth = "100%";
                visualWrap.style.boxSizing = "border-box";
                visualWrap.style.minWidth = "0";
                visualWrap.style.overflowX = "hidden";
                visualWrap.style.marginLeft = level === 1 ? "29px" : "16px";
                visualWrap.style.width = level === 1 ? "calc(100% - 29px)" : "calc(100% - 16px)";
                if (kind === "tag") {
                  visualWrap.style.marginLeft = level === 1 ? "20px" : "10px";
                  visualWrap.style.width = level === 1 ? "calc(100% - 20px)" : "calc(100% - 10px)";
                }
                const visualCard = visualWrap.createDiv();
                visualCard.style.display = "grid";
                visualCard.style.gap = "2px";
                visualCard.style.width = "100%";
                visualCard.style.maxWidth = "100%";
                visualCard.style.minWidth = "0";
                visualCard.style.boxSizing = "border-box";
                visualCard.style.border = "1px solid var(--background-modifier-border)";
                visualCard.style.borderRadius = "6px";
                visualCard.style.background = level === 1 ? "var(--background-modifier-hover)" : "var(--background-primary)";
                visualCard.style.padding = "4px 6px";
                if (level === 1) {
                  visualCard.style.boxShadow = "inset 2px 0 0 var(--background-modifier-border)";
                }
                const vHead = visualCard.createDiv();
                vHead.style.display = "grid";
                vHead.style.gridTemplateColumns = "minmax(72px, 0.76fr) minmax(142px, 1.24fr) 8px minmax(156px, 1fr) 8px minmax(156px, 1fr)";
                vHead.style.gap = "6px";
                vHead.style.alignItems = "center";
                vHead.style.justifyContent = "start";
                vHead.style.width = "100%";
                vHead.style.minWidth = "0";
                vHead.style.boxSizing = "border-box";
                vHead.style.marginLeft = "0";
                vHead.style.marginBottom = "0";
                const hExample = vHead.createEl("small", { text: "Preview" });
                const hSize = vHead.createEl("small", { text: "Size (full/empty/custom)" });
                vHead.createEl("span", { text: "" });
                const hText = vHead.createEl("small", { text: "Text color" });
                vHead.createEl("span", { text: "" });
                const hFill = vHead.createEl("small", { text: "Filling color" });
                hExample.style.opacity = hSize.style.opacity = hText.style.opacity = hFill.style.opacity = "0.82";
                const vRow = visualCard.createDiv();
                vRow.style.display = "grid";
                vRow.style.gridTemplateColumns = "minmax(72px, 0.76fr) minmax(142px, 1.24fr) 8px minmax(156px, 1fr) 8px minmax(156px, 1fr)";
                vRow.style.gap = "4px";
                vRow.style.alignItems = "center";
                vRow.style.justifyContent = "start";
                vRow.style.width = "100%";
                vRow.style.minWidth = "0";
                vRow.style.boxSizing = "border-box";
                vRow.style.marginLeft = "0";
                const buildColorBlock = (currentColor, fallbackColor, titleForTips) => {
                  const block = vRow.createDiv();
                  block.style.display = "grid";
                  block.style.gridTemplateColumns = "48px minmax(56px, 1fr) 28px";
                  block.style.gap = "4px";
                  block.style.alignItems = "center";
                  block.style.padding = "2px 0";
                  block.style.minWidth = "0";
                  const pickWrap = block.createDiv();
                  pickWrap.style.position = "relative";
                  pickWrap.style.height = "28px";
                  const pickBtn = pickWrap.createEl("button", { text: "Click" });
                  if (showInfoTips) pickBtn.title = `Pick ${titleForTips.toLowerCase()} color`;
                  pickBtn.type = "button";
                  pickBtn.style.width = "48px";
                  pickBtn.style.height = "28px";
                  pickBtn.style.padding = "0";
                  pickBtn.style.display = "inline-flex";
                  pickBtn.style.alignItems = "center";
                  pickBtn.style.justifyContent = "center";
                  pickBtn.style.background = currentColor || "";
                  pickBtn.style.color = getContrastTextHex(currentColor || "#999999");
                  const picker = pickWrap.createEl("input");
                  picker.type = "color";
                  picker.value = currentColor || fallbackColor;
                  picker.style.position = "absolute";
                  picker.style.inset = "0";
                  picker.style.opacity = "0";
                  picker.style.cursor = "pointer";
                  picker.style.width = "48px";
                  picker.style.height = "28px";
                  const hex = block.createEl("input");
                  hex.type = "text";
                  hex.value = currentColor || "";
                  hex.placeholder = fallbackColor;
                  hex.style.width = "100%";
                  hex.style.height = "28px";
                  hex.style.minWidth = "0";
                  if (showInfoTips) hex.title = `Enter ${titleForTips.toLowerCase()} color hex (#rrggbb)`;
                  const reset = block.createEl("button", { text: "X" });
                  reset.ariaLabel = `reset ${titleForTips}`;
                  reset.classList.add("mod-warning");
                  reset.style.borderColor = "var(--text-error)";
                  reset.style.color = "var(--text-error)";
                  reset.style.padding = "0";
                  reset.style.width = "28px";
                  reset.style.height = "28px";
                  if (showInfoTips) reset.title = `Reset ${titleForTips.toLowerCase()} color`;
                  return { picker, hex, reset };
                };
                const preview = vRow.createEl("span", { text: visualRow.visibility === "empty" ? "\u00a0" : livePreviewToken });
                preview.style.display = "inline-flex";
                preview.style.alignItems = "center";
                preview.style.justifyContent = "center";
                preview.style.alignSelf = "center";
                preview.style.justifySelf = "start";
                resolveDragAnchorY = () => {
                  try {
                    const rowRect = rowWrap.getBoundingClientRect();
                    const previewRect = preview.getBoundingClientRect();
                    if (!rowRect || !previewRect) return NaN;
                    return (previewRect.top - rowRect.top) + (previewRect.height / 2);
                  } catch (_) {
                    return NaN;
                  }
                };
                const sizeCell = vRow.createDiv();
                sizeCell.style.display = "grid";
                sizeCell.style.gridTemplateColumns = "1fr";
                sizeCell.style.gap = "4px";
                sizeCell.style.minWidth = "0";
                const visSel = sizeCell.createEl("select");
                visSel.title = "Size (full/empty/custom)";
                visSel.createEl("option", { text: "full", value: "default" });
                visSel.createEl("option", { text: "empty", value: "empty" });
                visSel.createEl("option", { text: "custom", value: "custom" });
                visSel.value = visualRow.visibility;
                visSel.style.width = "100%";
                visSel.style.height = "28px";
                const customInput = sizeCell.createEl("input");
                customInput.type = "text";
                customInput.placeholder = "print";
                customInput.value = String(visualRow.customText || "");
                customInput.style.width = "100%";
                customInput.style.height = "28px";
                customInput.style.minWidth = "0";
                customInput.style.display = visSel.value === "custom" ? "block" : "none";
                sizeCell.style.gridTemplateColumns = visSel.value === "custom" ? "1fr 1fr" : "1fr";
                vRow.createEl("span", { text: "" });
                const textUi = buildColorBlock(visualRow.textColor, "#ffffff", "Text");
                vRow.createEl("span", { text: "" });
                const fillUi = buildColorBlock(visualRow.fillColor, "#111111", "Filling");
                const textPicker = textUi.picker;
                textPicker.type = "color";
                const textHex = textUi.hex;
                const fillPicker = fillUi.picker;
                fillPicker.type = "color";
                const fillHex = fillUi.hex;
                const resetBtnLegacy = fillUi.reset;
                resetBtnLegacy.onclick = () => {
                  fillPicker.value = "#111111";
                  fillHex.value = "";
                  setTagVisualRow(visualFieldId, token, { fillColor: "" }, "pkm:visuals:tag:fill-reset:" + visualFieldId);
                  applyPreview();
                };
                textUi.reset.onclick = () => {
                  textPicker.value = "#ffffff";
                  textHex.value = "";
                  setTagVisualRow(visualFieldId, token, { textColor: "" }, "pkm:visuals:tag:text-reset:" + visualFieldId);
                  applyPreview();
                };
                const vCfg = getTagVisualRuntime();
                const vst = computeTagVisualStyle(vCfg.tagTextSizePct, vCfg.tagBubbleWidthPct, vCfg.tagBubbleHeightPct, vCfg.tagShapePct);
                const previewPaddingY = Math.max(1, Math.round(vst.verticalPaddingPx * 0.55));
                const previewPaddingX = Math.max(3, Math.round(vst.horizontalPaddingPx * 0.55));
                preview.style.padding = `${previewPaddingY}px ${previewPaddingX}px`;
                preview.style.borderRadius = `${vst.borderRadiusPx}px`;
                preview.style.fontSize = `${vst.fontSizePx}px`;
                preview.style.lineHeight = String(vst.lineHeight);
                preview.style.border = "1px solid var(--background-modifier-border-hover)";
                preview.style.alignSelf = "center";
                if (visualRow.fillColor) preview.style.background = visualRow.fillColor;
                if (visualRow.textColor) preview.style.color = visualRow.textColor;
                const applyPreview = () => {
                  const fill = normalizeHexColorInput(fillHex.value);
                  const text = normalizeHexColorInput(textHex.value);
                  const visRaw = String(visSel.value || "default").trim().toLowerCase();
                  const vis = ["default", "empty", "custom"].includes(visRaw) ? visRaw : "default";
                  const customText = String(customInput.value || "").trim();
                  const effectiveVis = vis === "custom" && !customText ? "empty" : vis;
                  const fullBubbleHeightPx = Math.max(10, Math.round(vst.fontSizePx * vst.lineHeight + vst.verticalPaddingPx * 2));
                  preview.setText(effectiveVis === "empty" ? " " : (effectiveVis === "custom" ? customText : livePreviewToken));
                  if (effectiveVis === "empty") {
                    preview.style.minWidth = "0";
                    preview.style.width = `${Math.max(6, Math.round(vst.horizontalPaddingPx * 2 / 5))}px`;
                    preview.style.lineHeight = String(vst.lineHeight);
                    preview.style.height = `${fullBubbleHeightPx}px`;
                    preview.style.boxSizing = "border-box";
                    preview.style.color = "transparent";
                  } else {
                    preview.style.minWidth = "0";
                    preview.style.width = "fit-content";
                    preview.style.maxWidth = "100%";
                    preview.style.height = "auto";
                    preview.style.lineHeight = String(vst.lineHeight);
                    preview.style.whiteSpace = "nowrap";
                    preview.style.color = text || visualRow.textColor || "";
                  }
                  if (fill) preview.style.background = fill;
                  else preview.style.background = visualRow.fillColor || "var(--background-primary)";
                  if (effectiveVis !== "empty") {
                    if (text) preview.style.color = text;
                    else preview.style.color = visualRow.textColor || "";
                  }
                  const txtBtn = textUi.picker && textUi.picker.previousSibling;
                  const fillBtn = fillUi.picker && fillUi.picker.previousSibling;
                  if (txtBtn && txtBtn.style) {
                    txtBtn.style.background = text || "";
                    txtBtn.style.color = getContrastTextHex(text || "#999999");
                  }
                  if (fillBtn && fillBtn.style) {
                    fillBtn.style.background = fill || "";
                    fillBtn.style.color = getContrastTextHex(fill || "#999999");
                  }
                };
                const commitText = () => {
                  const norm = normalizeHexColorInput(textHex.value);
                  if (!norm) return;
                  textHex.value = norm;
                  textPicker.value = norm;
                  setTagVisualRow(visualFieldId, token, { textColor: norm }, "pkm:visuals:tag:text:" + visualFieldId);
                  applyPreview();
                };
                const commitFill = () => {
                  const norm = normalizeHexColorInput(fillHex.value);
                  if (!norm) return;
                  fillHex.value = norm;
                  fillPicker.value = norm;
                  setTagVisualRow(visualFieldId, token, { fillColor: norm }, "pkm:visuals:tag:fill:" + visualFieldId);
                  applyPreview();
                };
                textPicker.onchange = () => { textHex.value = textPicker.value; commitText(); };
                fillPicker.onchange = () => { fillHex.value = fillPicker.value; commitFill(); };
                textHex.onkeydown = (e) => { if (e.key === "Enter") commitText(); };
                fillHex.onkeydown = (e) => { if (e.key === "Enter") commitFill(); };
                textHex.onblur = () => commitText();
                fillHex.onblur = () => commitFill();
                visSel.onchange = () => {
                  const isCustom = String(visSel.value || "default") === "custom";
                  sizeCell.style.gridTemplateColumns = isCustom ? "1fr 1fr" : "1fr";
                  customInput.style.display = isCustom ? "block" : "none";
                  setTagVisualRow(visualFieldId, token, { visibility: visSel.value }, "pkm:visuals:tag:visibility:" + visualFieldId);
                  applyPreview();
                };
                const commitCustomText = () => {
                  setTagVisualRow(visualFieldId, token, { customText: customInput.value }, "pkm:visuals:tag:custom-text:" + visualFieldId);
                };
                customInput.oninput = () => {
                  applyPreview();
                };
                customInput.onblur = () => {
                  commitCustomText();
                };
                customInput.onkeydown = (e) => {
                  if (e && e.key === "Enter") {
                    e.preventDefault();
                    commitCustomText();
                    try { customInput.blur(); } catch (_) {}
                  }
                };
                inpt.oninput = () => {
                  livePreviewToken = String(inpt.value || "").trim() || String(token || "").trim();
                  applyPreview();
                };
                applyPreview();
                const rowDivider = rowWrap.createDiv();
                rowDivider.style.borderBottom = "2px solid var(--background-modifier-border-hover)";
                rowDivider.style.marginTop = "4px";
                rowDivider.style.opacity = "1";
              }
              setTimeout(syncDragHandlePos, 0);
            };
            for (const p of tree) {
              renderTokenRow(p.token, 0, "");
              const ch = Array.isArray(p.children) ? p.children : [];
              for (const c of ch) renderTokenRow(c.token, 1, p.token);
            }
            const addRow = details.createDiv();
            addRow.style.display = "flex";
            addRow.style.gap = "6px";
            addRow.style.marginTop = "6px";
            const addInput = addRow.createEl("input");
            addInput.type = "text";
              addInput.placeholder = kind === "wikilink" ? "wikilink" : "#tag";
            addInput.style.flex = "1";
            const addBtn2 = addRow.createEl("button", { text: "+ element" });
            addBtn2.disabled = !enabled;
            addBtn2.onclick = () => {
              if (!enabled) return;
              const token = typeof deepState.normalizeToken === "function" ? deepState.normalizeToken(addInput.value, kind) : String(addInput.value || "").trim();
              if (!token) return;
              if (kind === "wikilink") {
                const liveNow = plugin.getConfig();
                const behaviorNow = liveNow && liveNow.pkm && liveNow.pkm.behavior ? liveNow.pkm.behavior : {};
                const leftNow = behaviorNow && behaviorNow.leftMode && Array.isArray(behaviorNow.leftMode.fields) ? behaviorNow.leftMode.fields : [];
                const rightNow = behaviorNow && behaviorNow.rightMode && Array.isArray(behaviorNow.rightMode.fields) ? behaviorNow.rightMode.fields : [];
                const keyNorm = String(k || "").trim();
                const strictNorm = String(strictName || keyNorm).trim();
                const findWikilinkField = (arr) => {
                  if (!Array.isArray(arr)) return null;
                  for (let i = 0; i < arr.length; i++) {
                    const f = arr[i] && typeof arr[i] === "object" ? arr[i] : null;
                    if (!f) continue;
                    const fid = String(f.id || "").trim();
                    const fkey = String(f.orderKey || "").trim();
                    const src = String(f.source || "").trim();
                    if (!fid && !fkey && !src) continue;
                    if (fid === keyNorm || fid === strictNorm || fkey === keyNorm || fkey === strictNorm || src === `wikilinks:${keyNorm}` || src === `wikilinks:${strictNorm}`) {
                      return f;
                    }
                  }
                  return null;
                };
                const rightField = findWikilinkField(rightNow);
                const leftField = findWikilinkField(leftNow);
                const target = rightField || leftField;
                if (!target) {
                  new Notice("InlineOverhaul: cannot resolve target link field for Deep Editor add");
                  return;
                }
                const targetId = String(target.id || strictNorm || keyNorm).trim();
                if (!targetId) {
                  new Notice("InlineOverhaul: target link field id is empty");
                  return;
                }
                const valuesNow = Array.isArray(target.values) ? target.values.slice() : [];
                const tokenPlain = String(token).replace(/^\[\[|\]\]$/g, "").trim();
                if (!tokenPlain) {
                  new Notice("InlineOverhaul: empty link token");
                  return;
                }
                const exists = valuesNow.some((row) => {
                  const tok = String(row && typeof row === "object" ? row.token : row || "").trim();
                  return tok === tokenPlain;
                });
                if (!exists) {
                  valuesNow.push({ token: tokenPlain, active: true, allowedParentValues: [], prefixMode: "bullet", checkboxToken: "" });
                }
                const nextTarget = {
                  ...target,
                  id: targetId,
                  source: String(target.source || `wikilinks:${targetId}`).trim(),
                  prefix: String(target.prefix || "#").trim() || "#",
                  placeholder: String(target.placeholder || targetId).trim() || targetId,
                  values: valuesNow,
                };
                const toRight = !!rightField || String(nextTarget.source || "").indexOf("wikilinks:") === 0;
                const nextLeft = toRight ? leftNow : upsertField(leftNow, targetId, nextTarget);
                const nextRight = toRight ? upsertField(rightNow, targetId, nextTarget) : rightNow;
                plugin.setConfigPatch({ pkm: { behavior: { leftMode: { fields: nextLeft }, rightMode: { fields: nextRight } } } }, "pkm:behavior:order:deep:add-token:" + k);
                addInput.value = "";
                renderOrderBoard();
                return;
              }
              const nextTree = tree.map((p) => ({ ...p, children: (p.children || []).map((c) => ({ ...c })) }));
              nextTree.push({ token, prefix: "#", children: [] });
              if (typeof deepState.applyTagTreeToFields !== "function") return;
              markSnapshot(captureSnapshot());
              const merged = deepState.applyTagTreeToFields(nextTree, parentField || { id: strictName, orderKey: k, prefix: "#", values: [] }, subField || { id: `${strictName}_sub`, orderKey: `${k}_sub`, values: [] }, kind);
              let nextLeft = leftMode.map((f) => {
                const id = String(f && f.id || "").trim();
                const fidParent = String(parentField && parentField.id || "").trim();
                const fidSub = String(subField && subField.id || "").trim();
                if (fidParent && id === fidParent) return merged.parentField;
                if (fidSub && id === fidSub && merged.subField) return merged.subField;
                return f;
              });
              if (!parentField && merged.parentField) nextLeft = upsertField(nextLeft, merged.parentField.id, merged.parentField);
              if (!subField && merged.subField) nextLeft = upsertField(nextLeft, merged.subField.id, merged.subField);
              plugin.setConfigPatch({ pkm: { behavior: { leftMode: { fields: nextLeft } } } }, "pkm:behavior:order:deep:add-token:" + k);
              plugin.setConfigPatch(buildCheckboxPatch(nextTree, merged), "pkm:behavior:order:deep:add-token:" + k + ":prefix");
              renderOrderBoard();
            };
          }
        }
      } catch (e) {
        console.error("[inline-overhaul][order-row-render]", k, e);
        const errorRow = list.createDiv();
        errorRow.style.padding = "4px 6px";
        errorRow.style.border = "1px solid var(--text-error)";
        errorRow.style.borderRadius = "6px";
        errorRow.style.background = "var(--background-primary-alt)";
        errorRow.style.fontSize = "12px";
        errorRow.style.color = "var(--text-error)";
        errorRow.setText(`Render error for field '${String(k || "")}'`);
      }
    }
    addDropZone("");
  };

  const leadRow = orderWrap.createDiv();
  leadRow.style.display = "none";
  try {
    if (addRow && addRow.parentElement === orderWrap) orderWrap.insertBefore(addRow, leadRow);
  } catch (_) {}
  const orderPreviewRow = orderWrap.createDiv();
  orderPreviewRow.style.margin = "6px 0 8px";
  try {
    if (leadRow && leadRow.parentElement === orderWrap) orderWrap.insertBefore(orderPreviewRow, leadRow);
  } catch (_) {}
  const colorHintRow = orderWrap.createDiv();
  colorHintRow.style.margin = "6px 0 2px";
  const userTagsRow = containerEl.createDiv();
  userTagsRow.style.margin = "6px 0 10px";

  const renderOrderPreview = () => {
    orderPreviewRow.empty();
    if (!showDeepEditor) return;
    const card = orderPreviewRow.createDiv();
    card.style.border = "1px solid var(--background-modifier-border)";
    card.style.borderRadius = "8px";
    card.style.padding = "8px 10px";
    card.style.background = "var(--background-secondary)";
    const subHeader = card.createEl("div", { text: "Preview of your Order" });
    subHeader.style.fontSize = "12px";
    subHeader.style.fontWeight = "600";
    subHeader.style.lineHeight = "1.25";
    subHeader.style.marginBottom = "4px";

    const previewViewport = card.createDiv();
    previewViewport.style.width = "100%";
    previewViewport.style.maxWidth = "100%";
    previewViewport.style.overflowX = "auto";
    previewViewport.style.overflowY = "hidden";

    const layoutGrid = previewViewport.createDiv();
    layoutGrid.style.display = "grid";
    layoutGrid.style.gridTemplateColumns = "max-content minmax(120px,1fr) max-content";
    layoutGrid.style.alignItems = "center";
    layoutGrid.style.columnGap = "8px";
    layoutGrid.style.width = "max-content";
    layoutGrid.style.minWidth = "100%";

    const labelsRow = layoutGrid.createDiv();
    labelsRow.style.display = "contents";
    const leftBadge = layoutGrid.createEl("small", { text: "Left panel" });
    leftBadge.style.gridColumn = "1";
    const middleSpacer = layoutGrid.createEl("small", { text: "" });
    middleSpacer.style.gridColumn = "2";
    const rightBadge = layoutGrid.createEl("small", { text: "Right panel" });
    rightBadge.style.gridColumn = "3";
    for (const el of [leftBadge, rightBadge]) {
      el.style.border = "1px solid var(--background-modifier-border)";
      el.style.borderRadius = "6px";
      el.style.padding = "1px 6px";
      el.style.opacity = "0.82";
      el.style.display = "block";
      el.style.width = "100%";
      el.style.textAlign = "center";
    }
    leftBadge.style.marginBottom = "4px";
    rightBadge.style.marginBottom = "4px";

    const leftLine = layoutGrid.createDiv();
    leftLine.style.gridColumn = "1";
    leftLine.style.whiteSpace = "nowrap";
    const middleLine = layoutGrid.createDiv();
    middleLine.style.gridColumn = "2";
    middleLine.style.whiteSpace = "nowrap";
    middleLine.style.overflow = "hidden";
    const rightLine = layoutGrid.createDiv();
    rightLine.style.gridColumn = "3";
    rightLine.style.whiteSpace = "nowrap";

    for (const line of [leftLine, middleLine, rightLine]) {
      line.style.fontFamily = "var(--font-text)";
      line.style.fontSize = "var(--font-text-size)";
      line.style.lineHeight = "var(--line-height-normal)";
      line.style.padding = "2px 0";
    }

    const sep1 = String((cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.io && cfg.pkm.behavior.io.separator1) || "||").trim() || "||";
    const sep2 = String((cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.io && cfg.pkm.behavior.io.separator2) || "||").trim() || "||";

    const toType = (key) => {
      const k = String(key || "").trim();
      const strict = String(orderState && orderState.strictNames && orderState.strictNames[k] || "").trim();
      const candidates = [k, strict].map((x) => String(x || "").trim()).filter(Boolean);
      const readType = (id) => String(orderState && orderState.types && orderState.types[id] || "").trim().toLowerCase();
      for (let i = 0; i < candidates.length; i++) {
        const t = readType(candidates[i]);
        if (t === "wikilink") return "wikilink";
        if (t === "element") return "element";
        if (t === "tag") return "tag";
      }
      const behaviorNow = cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior : {};
      const fields = []
        .concat(Array.isArray(behaviorNow.leftMode && behaviorNow.leftMode.fields) ? behaviorNow.leftMode.fields : [])
        .concat(Array.isArray(behaviorNow.rightMode && behaviorNow.rightMode.fields) ? behaviorNow.rightMode.fields : []);
      const field = fields.find((f) => {
        const id = String(f && f.id || "").trim();
        const orderKey = String(f && f.orderKey || "").trim();
        const source = String(f && f.source || "").trim();
        for (let i = 0; i < candidates.length; i++) {
          const c = candidates[i];
          if (id === c || orderKey === c || source === `wikilinks:${c}`) return true;
        }
        return false;
      }) || null;
      const source = String(field && field.source || "").trim();
      if (source === "projects" || /^wikilinks:/.test(source)) return "wikilink";
      const kind = String(field && field.kind || "").trim().toLowerCase();
      if (kind === "dateoffset" || kind === "nowtime" || kind === "estimatedcycle" || kind === "genericelement") return "element";
      return "tag";
    };
    const getDisplay = (key) => {
      const k = String(key || "").trim();
      const label = String(orderState && orderState.labels && orderState.labels[k] || "").trim();
      const strict = String(orderState && orderState.strictNames && orderState.strictNames[k] || k).trim();
      return label || strict || k;
    };
    const activeState = (key) => {
      const k = String(key || "").trim();
      const raw = String(orderState && orderState.active && orderState.active[k] || "yes").trim().toLowerCase();
      if (raw === "no") return "no";
      if (raw === "hotkey_only") return "hotkey_only";
      return "yes";
    };
    const panelTokens = (keys) => {
      const out = [];
      const list = Array.isArray(keys) ? keys : [];
      for (let i = 0; i < list.length; i++) {
        const key = String(list[i] || "").trim();
        if (!key || /_sub$/.test(key)) continue;
        const st = activeState(key);
        if (st === "no") continue;
        out.push({
          text: getDisplay(key),
          type: toType(key),
          state: st,
        });
      }
      return out;
    };

    const leftTokens = panelTokens(orderState && orderState.left ? orderState.left : []);
    const rightTokens = panelTokens(orderState && orderState.right ? orderState.right : []);
    const renderTokenList = (host, tokens) => {
      const open = host.createEl("span", { text: "[" });
      open.style.opacity = "0.9";
      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        const el = host.createEl("span", { text: tok.text });
        const st = getOrderTypeBubblePalette(tok.type);
        el.style.display = "inline-flex";
        el.style.alignItems = "center";
        el.style.padding = "1px 6px";
        el.style.fontSize = "11px";
        el.style.lineHeight = "1.2";
        el.style.borderRadius = "999px";
        el.style.border = "1px solid var(--background-modifier-border)";
        el.style.background = st.bg;
        el.style.color = "var(--text-normal)";
        el.style.borderColor = st.border;
        if (tok.state === "hotkey_only") el.style.opacity = "0.45";
        if (i < tokens.length - 1) host.appendText(" ");
      }
      const close = host.createEl("span", { text: "]" });
      close.style.opacity = "0.9";
    };

    renderTokenList(leftLine, leftTokens);
    middleLine.setText(`${sep1}  user's text  ${sep2}`);
    renderTokenList(rightLine, rightTokens);
  };

  const renderLeadFieldSelectors = () => {
    leadRow.empty();
    const card = leadRow.createDiv();
    card.style.border = "1px solid var(--background-modifier-border)";
    card.style.borderRadius = "8px";
    card.style.padding = "8px";
    card.style.background = "var(--background-secondary)";
    const title = card.createEl("div", { text: "TagWheel Lead Field" });
    title.style.fontWeight = "600";
    title.style.marginBottom = "6px";
    title.style.fontSize = "12px";
    const grid = card.createDiv();
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gap = "8px";
    const createLeadSelect = (panelKey, labelText) => {
      const box = grid.createDiv();
      const label = box.createEl("small", { text: labelText });
      label.style.display = "block";
      label.style.marginBottom = "4px";
      label.style.opacity = "0.9";
      const select = box.createEl("select");
      select.style.width = "100%";
      if (!enabled) select.disabled = true;
      const candidates = getPanelLeadCandidates(panelKey);
      select.createEl("option", { text: "default", value: "" });
      for (const row of candidates) {
        select.createEl("option", { text: `${row.label} (${row.key})`, value: row.key });
      }
      const currentLead = String(orderState && orderState.lead && orderState.lead[panelKey] ? orderState.lead[panelKey] : "").trim();
      select.value = candidates.some((row) => row.key === currentLead) ? currentLead : "";
      select.onchange = () => {
        if (!enabled) return;
        const next = String(select.value || "").trim();
        const patchLead = { [panelKey]: next || "" };
        orderState.lead = { ...(orderState.lead || {}), [panelKey]: next || "" };
        setOrderPatch({ lead: patchLead }, `pkm:behavior:order:lead:${panelKey}`);
      };
    };
    createLeadSelect("left", "Left field");
    createLeadSelect("right", "Right field");
  };

  const renderUserTagsEditor = () => {
    userTagsRow.empty();
    if (!showDeepEditor || !showColorSettingsUi) return;
    const titleRow = userTagsRow.createDiv();
    titleRow.style.margin = "0 0 4px";
    const colorTagsTitle = titleRow.createEl("div", { text: "Color your Tags" });
  colorTagsTitle.style.fontSize = "14px";
  colorTagsTitle.style.fontWeight = "600";
  colorTagsTitle.style.lineHeight = "1.25";
  colorTagsTitle.style.margin = "0 0 2px 0";
    const card = userTagsRow.createDiv();
    card.style.border = "1px solid var(--background-modifier-border)";
    card.style.borderRadius = "8px";
    card.style.padding = "8px";
    card.style.background = "var(--background-secondary)";
    if (showInfoTips) {
      const tips = card.createEl("details");
      const sm = tips.createEl("summary", { text: "Info & Tips" });
      sm.style.cursor = "pointer";
      tips.createEl("div", { text: "Use this section to color tags that are not currently present in Order rows." });
    }

    const cfgNow = plugin.getConfig();
    const visualsNow = cfgNow && cfgNow.pkm && cfgNow.pkm.behavior && cfgNow.pkm.behavior.tagVisuals
      ? cfgNow.pkm.behavior.tagVisuals
      : {};
    const userTagsMap = visualsNow && visualsNow.userTags && typeof visualsNow.userTags === "object"
      ? visualsNow.userTags
      : {};
    const tokens = Object.keys(userTagsMap).filter((x) => /^#\S+/.test(String(x || "").trim()));
    if (tokens.length > 300) {
      const warn = card.createDiv();
      warn.style.margin = "6px 0";
      warn.style.padding = "6px 8px";
      warn.style.border = "1px solid var(--text-warning)";
      warn.style.borderRadius = "6px";
      warn.setText("Soft warning: User tags count exceeded 300.");
    }
    const list = card.createDiv();
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "6px";

    const setUserTagRow = (token, patch, reason) => {
      const tok = String(token || "").trim();
      if (!tok || tok.charAt(0) !== "#") return;
      const cur = userTagsMap[tok] && typeof userTagsMap[tok] === "object" ? userTagsMap[tok] : {};
      const next = {
        fillColor: Object.prototype.hasOwnProperty.call(patch, "fillColor") ? normalizeHexColorInput(patch.fillColor) : normalizeHexColorInput(cur.fillColor),
        textColor: Object.prototype.hasOwnProperty.call(patch, "textColor") ? normalizeHexColorInput(patch.textColor) : normalizeHexColorInput(cur.textColor),
        visibility: Object.prototype.hasOwnProperty.call(patch, "visibility")
          ? (String(patch.visibility || "default").trim().toLowerCase() === "empty" ? "empty" : "default")
          : (String(cur.visibility || "default").trim().toLowerCase() === "empty" ? "empty" : "default"),
      };
      plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { userTags: { [tok]: next } } } } }, reason || "pkm:visuals:user-tags");
    };

    for (const token of tokens) {
      const row = list.createDiv();
      row.style.display = "grid";
      row.style.gridTemplateColumns = "minmax(120px,1fr) 36px 92px 36px 92px 88px minmax(120px,1fr) 28px";
      row.style.gap = "6px";
      row.style.alignItems = "center";
      const tokenInput = row.createEl("input");
      tokenInput.type = "text";
      tokenInput.value = token;
      tokenInput.disabled = true;
      const state = userTagsMap[token] && typeof userTagsMap[token] === "object" ? userTagsMap[token] : {};
      const textPicker = row.createEl("input");
      textPicker.type = "color";
      textPicker.value = normalizeHexColorInput(state.textColor) || "#ffffff";
      const textHex = row.createEl("input");
      textHex.type = "text";
      textHex.value = normalizeHexColorInput(state.textColor) || "#ffffff";
      const fillPicker = row.createEl("input");
      fillPicker.type = "color";
      fillPicker.value = normalizeHexColorInput(state.fillColor) || "#111111";
      const fillHex = row.createEl("input");
      fillHex.type = "text";
      fillHex.value = normalizeHexColorInput(state.fillColor) || "#111111";
      const visSel = row.createEl("select");
      visSel.createEl("option", { text: "full", value: "default" });
      visSel.createEl("option", { text: "empty", value: "empty" });
      visSel.value = String(state.visibility || "default").trim().toLowerCase() === "empty" ? "empty" : "default";
      const preview = row.createEl("span", { text: visSel.value === "empty" ? "   " : token });
      preview.style.display = "inline-block";
      preview.style.padding = "2px 8px";
      preview.style.borderRadius = "999px";
      preview.style.border = "1px solid var(--background-modifier-border)";
      if (normalizeHexColorInput(state.fillColor)) preview.style.background = normalizeHexColorInput(state.fillColor);
      if (normalizeHexColorInput(state.textColor)) preview.style.color = normalizeHexColorInput(state.textColor);
      const del = row.createEl("button", { text: "x" });
      del.onclick = () => {
        plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { userTags: { [token]: null } } } } }, "pkm:visuals:user-tags:delete");
        renderOrderBoard();
      };
      const applyPreview = () => {
        const fill = normalizeHexColorInput(fillHex.value || fillPicker.value);
        const text = normalizeHexColorInput(textHex.value || textPicker.value);
        const vis = String(visSel.value || "default").trim().toLowerCase() === "empty" ? "empty" : "default";
        preview.setText(vis === "empty" ? "   " : token);
        preview.style.background = fill || "";
        preview.style.color = text || "";
        fillHex.style.background = fill || "";
        fillHex.style.color = getContrastTextHex(fill || "#111111");
      };
      const commitText = () => {
        const norm = normalizeHexColorInput(textHex.value);
        if (!norm) return;
        textHex.value = norm;
        textPicker.value = norm;
        setUserTagRow(token, { textColor: norm }, "pkm:visuals:user-tags:text");
        applyPreview();
      };
      const commitFill = () => {
        const norm = normalizeHexColorInput(fillHex.value);
        if (!norm) return;
        fillHex.value = norm;
        fillPicker.value = norm;
        setUserTagRow(token, { fillColor: norm }, "pkm:visuals:user-tags:fill");
        applyPreview();
      };
      textPicker.onchange = () => { textHex.value = textPicker.value; commitText(); };
      fillPicker.onchange = () => { fillHex.value = fillPicker.value; commitFill(); };
      textHex.onkeydown = (e) => { if (e.key === "Enter") commitText(); };
      fillHex.onkeydown = (e) => { if (e.key === "Enter") commitFill(); };
      textHex.onblur = () => commitText();
      fillHex.onblur = () => commitFill();
      visSel.onchange = () => {
        setUserTagRow(token, { visibility: visSel.value }, "pkm:visuals:user-tags:visibility");
        applyPreview();
      };
      applyPreview();
    }

    const add = card.createDiv();
    add.style.display = "flex";
    add.style.gap = "6px";
    add.style.marginTop = "8px";
    const addInput = add.createEl("input");
    addInput.type = "text";
    addInput.placeholder = "#tag";
    addInput.style.flex = "1";
    const addBtn = add.createEl("button", { text: "+ user tag" });
    addBtn.onclick = () => {
      const raw = String(addInput.value || "").trim();
      const token = raw ? (raw.charAt(0) === "#" ? raw : `#${raw}`) : "";
      if (!/^#\S+/.test(token)) return;
      plugin.setConfigPatch({ pkm: { behavior: { tagVisuals: { userTags: { [token]: { fillColor: "", textColor: "", visibility: "default" } } } } } }, "pkm:visuals:user-tags:add");
      addInput.value = "";
      renderOrderBoard();
    };
  };

  const renderColorSettingsHint = () => {
    colorHintRow.empty();
    if (showDeepEditor && showColorSettingsUi) return;
    const hint = colorHintRow.createDiv();
    hint.style.padding = "6px 8px";
    hint.style.border = "1px dashed var(--background-modifier-border)";
    hint.style.borderRadius = "6px";
    hint.style.opacity = "0.9";
    hint.setText("Color settings are hidden. Enable: Tag & PKM > Order > Show color settings.");
  };

  const renderOrderBoard = () => {
    if (!showDeepEditor) deepSession.expanded = {};
    ensureAllKeys();
    renderPanel("left", "Left panel");
    renderPanel("right", "Right panel");
    renderOrderPreview();
    renderColorSettingsHint();
    renderUserTagsEditor();
    refreshDraftInfo();
  };

  renderOrderBoard();
}

function renderPkmConfigSections(ctx) {
  const {
    Setting,
    Notice,
    Modal,
    containerEl,
    cfg,
    enabled,
    plugin,
    normalizePkmOrder,
    tagwheelConfigModeDetailed,
    tagwheelConfigModeMinimal,
    pkmBackends,
    getActiveTagWheelRulesPath,
    refreshSettings,
  } = ctx;

  const behavior = cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior : {};
  const prefixRules = behavior && behavior.prefixRules && typeof behavior.prefixRules === "object"
    ? behavior.prefixRules
    : {};
  const leftFields = behavior && behavior.leftMode && Array.isArray(behavior.leftMode.fields)
    ? behavior.leftMode.fields
    : [];
  const rightFields = behavior && behavior.rightMode && Array.isArray(behavior.rightMode.fields)
    ? behavior.rightMode.fields
    : [];
  const allFields = leftFields.concat(rightFields);
  const getFieldByOrderKey = (orderKey) => {
    const key = String(orderKey || "").trim();
    if (!key) return null;
    for (let i = 0; i < allFields.length; i++) {
      const row = allFields[i];
      if (!row || typeof row !== "object") continue;
      const id = String(row.id || "").trim();
      const rowKey = String(row.orderKey || "").trim();
      if (id === key || rowKey === key) return row;
    }
    return null;
  };
  const isWikilinkField = (field) => {
    const source = String(field && field.source || "").trim();
    return source === "projects" || /^wikilinks:/.test(source);
  };
  const isElementOrderKey = (order, orderKey, field) => {
    const types = order && order.types && typeof order.types === "object" ? order.types : {};
    const kind = String(types[orderKey] || "").trim().toLowerCase();
    if (kind === "element") return true;
    const fieldKind = String(field && field.kind || "").trim();
    return fieldKind === "dateOffset" || fieldKind === "nowTime" || fieldKind === "estimatedCycle" || fieldKind === "genericElement";
  };
  const normalizePrefixRules = (raw, sectionRows) => {
    const src = raw && typeof raw === "object" ? raw : {};
    const out = {
      resolver: "priority-first",
      priorityMode: "by-section",
      fieldsOrderMode: "manual",
      tagSubtagPriority: "subtag-over-tag",
      priorityTargets: [],
      priorityCheckboxes: [],
      checkboxByFieldValue: {},
    };
    if (typeof src.resolver === "string" && src.resolver.trim()) out.resolver = src.resolver.trim();
    const mode = String(src.priorityMode || "").trim();
    out.priorityMode = mode === "by-checkbox-list" ? "by-checkbox-list" : "by-section";
    const fieldsMode = String(src.fieldsOrderMode || "").trim();
    out.fieldsOrderMode = fieldsMode === "auto" ? "auto" : "manual";
    const tagMode = String(src.tagSubtagPriority || "").trim();
    out.tagSubtagPriority = tagMode === "tag-over-subtag" ? "tag-over-subtag" : "subtag-over-tag";
    const rows = Array.isArray(sectionRows) ? sectionRows : [];
    const allowedFieldIds = new Set(rows.map((x) => String(x.fieldId || "").trim()).filter(Boolean));
    const sectionToFieldId = {};
    for (let i = 0; i < rows.length; i++) {
      const sid = String(rows[i] && rows[i].sectionId || "").trim();
      const fid = String(rows[i] && rows[i].fieldId || "").trim();
      if (sid && fid) sectionToFieldId[sid] = fid;
    }
    const targetsRaw = Array.isArray(src.priorityTargets) ? src.priorityTargets : [];
    const targetsNorm = [];
    for (let i = 0; i < targetsRaw.length; i++) {
      const raw = String(targetsRaw[i] || "").trim();
      if (!raw) continue;
      const fid = allowedFieldIds.has(raw) ? raw : String(sectionToFieldId[raw] || "").trim();
      if (!fid || !allowedFieldIds.has(fid) || targetsNorm.includes(fid)) continue;
      targetsNorm.push(fid);
    }
    for (let i = 0; i < rows.length; i++) {
      const fid = String(rows[i] && rows[i].fieldId || "").trim();
      if (fid && !targetsNorm.includes(fid)) targetsNorm.push(fid);
    }
    out.priorityTargets = targetsNorm;
    const checksRaw = Array.isArray(src.priorityCheckboxes) ? src.priorityCheckboxes : [];
    out.priorityCheckboxes = Array.from(new Set(checksRaw.map((x) => String(x || "").trim()).filter(Boolean)));
    const cbMap = src.checkboxByFieldValue && typeof src.checkboxByFieldValue === "object" ? src.checkboxByFieldValue : {};
    for (const fid of Object.keys(cbMap)) {
      const id = String(fid || "").trim();
      const row = cbMap[fid];
      if (!id || !row || typeof row !== "object") continue;
      out.checkboxByFieldValue[id] = {};
      for (const tok of Object.keys(row)) {
        const token = String(tok || "").trim();
        const cb = String(row[tok] || "").trim();
        if (token && cb) out.checkboxByFieldValue[id][token] = cb;
      }
    }
    return out;
  };
  const collectSectionRows = () => {
    const order = typeof normalizePkmOrder === "function"
      ? normalizePkmOrder(behavior && behavior.order ? behavior.order : null)
      : { left: [], right: [], strictNames: {}, types: {} };
    const keys = (Array.isArray(order.left) ? order.left : []).concat(Array.isArray(order.right) ? order.right : []);
    const out = [];
    const seen = new Set();
    for (let i = 0; i < keys.length; i++) {
      const key = String(keys[i] || "").trim();
      if (!key || /_sub$/.test(key)) continue;
      const field = getFieldByOrderKey(key);
      if (!field || !field.id) continue;
      if (isElementOrderKey(order, key, field)) continue;
      const isTagLike = String(field && field.prefix || "") === "#";
      if (!isTagLike && !isWikilinkField(field)) continue;
      const sectionId = String(order && order.strictNames && order.strictNames[key] ? order.strictNames[key] : key).trim() || key;
      if (!sectionId || seen.has(sectionId)) continue;
      seen.add(sectionId);
      out.push({ sectionId, fieldId: String(field.id || "").trim() });
    }
    return out;
  };
  const collectCheckboxTokens = (checkboxByFieldValue) => {
    const src = checkboxByFieldValue && typeof checkboxByFieldValue === "object" ? checkboxByFieldValue : {};
    const out = [];
    for (const fid of Object.keys(src)) {
      const row = src[fid];
      if (!row || typeof row !== "object") continue;
      for (const tok of Object.keys(row)) {
        const cb = String(row[tok] || "").trim();
        if (!cb || out.includes(cb)) continue;
        out.push(cb);
      }
    }
    return out;
  };
  const sectionRows = collectSectionRows();
  const normalizedPrefix = normalizePrefixRules(prefixRules, sectionRows);
  const activePkmSubTab = String(cfg && cfg.ui && cfg.ui.pkmSubTab || "main").trim() === "behavior" ? "behavior" : "main";
  const showInfoTips = !!(cfg && cfg.ui && cfg.ui.orderShowInfoTips === true);
  const patchPrefixRules = (nextPartial, reason) => {
    const next = {
      ...normalizedPrefix,
      ...(nextPartial && typeof nextPartial === "object" ? nextPartial : {}),
    };
    plugin.setConfigPatch({ pkm: { behavior: { prefixRules: next } } }, reason);
    deferRefreshSettings(refreshSettings);
  };

  if (activePkmSubTab === "main") {
  const configHeader = containerEl.createEl("div", { text: "Config in markdown" });
  configHeader.style.fontSize = "14px";
  configHeader.style.fontWeight = "600";
  configHeader.style.lineHeight = "1.25";
  configHeader.style.margin = "0 0 2px 0";
  if (showInfoTips) {
    const cfgTips = containerEl.createEl("details");
    const cfgSm = cfgTips.createEl("summary", { text: "Info & Tips" });
    cfgSm.style.cursor = "pointer";
    cfgTips.createEl("div", { text: "You can edit your Order config in friendly markdown format." });
    cfgTips.createEl("div", { text: "DON'T FORGET TO APPLY CHANGES AFTER EDITING CONFIG MD" });
  }
  new Setting(containerEl)
    .setName("Config Export Mode")
    .setDesc(showInfoTips ? "detailed: full instructions; minimal: only settings and key alerts." : "")
    .addDropdown((d) => {
      d.addOption(tagwheelConfigModeDetailed, "detailed");
      d.addOption(tagwheelConfigModeMinimal, "minimal");
      d.setValue(String((cfg.pkm && cfg.pkm.configExportMode) || tagwheelConfigModeDetailed));
      d.onChange((v) => {
        const next = String(v || tagwheelConfigModeDetailed).trim() === tagwheelConfigModeMinimal
          ? tagwheelConfigModeMinimal
          : tagwheelConfigModeDetailed;
        plugin.setConfigPatch({ pkm: { configExportMode: next } }, "pkm:configExportMode");
        deferRefreshSettings(refreshSettings);
      });
      if (!enabled) d.setDisabled(true);
    });
  new Setting(containerEl)
    .setName("TagWheel Note Editor")
    .setDesc(showInfoTips ? "Open/create config note and apply parsed changes to plugin settings." : "")
    .addButton((b) => {
      b.setButtonText("Open config").onClick(async () => {
        try {
          flushAllDeepCommits(plugin);
          const p = await plugin.openTagWheelConfigNote();
          new Notice("Config opened: " + p);
        } catch (e) {
          console.error("[inline-overhaul][tagwheel-config-open]", e);
          new Notice("InlineOverhaul: " + e.message);
        }
      });
      if (!enabled) b.setDisabled(true);
    })
    .addButton((b) => {
      b.setButtonText("Apply").setCta().onClick(async () => {
        try {
          flushAllDeepCommits(plugin);
          const deep = plugin && plugin._orderDeepEditorSession ? plugin._orderDeepEditorSession : null;
          if (deep && deep.enabled === true && deep.dirty === true) {
            let choice = "cancel";
            if (typeof Modal === "function" && plugin && plugin.app) {
              choice = await new Promise((resolve) => {
                class ConflictModal extends Modal {
                  onOpen() {
                    const { contentEl } = this;
                    contentEl.empty();
                    contentEl.createEl("h3", { text: "Unsaved Order draft" });
                    contentEl.createEl("p", { text: "[IO_BETA_CONFLICT_DIALOG] You have unsaved Order Deep Editor changes." });
                    const row = contentEl.createDiv();
                    row.style.display = "flex";
                    row.style.gap = "8px";
                    row.style.justifyContent = "flex-end";
                    row.style.marginTop = "12px";
                    const applyBtn = row.createEl("button", { text: "Apply draft" });
                    const discardBtn = row.createEl("button", { text: "Discard draft" });
                    const cancelBtn = row.createEl("button", { text: "Cancel", cls: "mod-warning" });
                    applyBtn.onclick = () => { resolve("apply"); this.close(); };
                    discardBtn.onclick = () => { resolve("discard"); this.close(); };
                    cancelBtn.onclick = () => { resolve("cancel"); this.close(); };
                  }
                  onClose() { this.contentEl.empty(); }
                }
                new ConflictModal(plugin.app).open();
              });
            }
            if (choice === "cancel") return;
            if (choice === "discard") {
              deep.dirty = false;
              if (deep.history && typeof deep.history === "object") {
                deep.history.past = [];
                deep.history.future = [];
              }
            }
            if (choice === "apply") {
              deep.dirty = false;
              if (deep.history && typeof deep.history === "object") {
                deep.history.past = [];
                deep.history.future = [];
              }
            }
          }
          await plugin.applyTagWheelConfigNote();
          new Notice("InlineOverhaul: TagWheel config applied");
          deferRefreshSettings(refreshSettings);
        } catch (e) {
          console.error("[inline-overhaul][tagwheel-config-apply]", e);
          new Notice("InlineOverhaul: " + e.message);
        }
      });
      if (!enabled) b.setDisabled(true);
    });

  const separatorsHeader = containerEl.createEl("div", { text: "Separators" });
  separatorsHeader.style.fontSize = "14px";
  separatorsHeader.style.fontWeight = "600";
  separatorsHeader.style.lineHeight = "1.25";
  separatorsHeader.style.margin = "0 0 2px 0";
  if (showInfoTips) {
    const sepTips = containerEl.createEl("details");
    const sepSm = sepTips.createEl("summary", { text: "Info & Tips" });
    sepSm.style.cursor = "pointer";
    sepTips.createEl("div", { text: "Separators define boundaries between left tags, middle text, and right elements in generated PKM lines." });
    sepTips.createEl("div", { text: "Use short, visually distinctive values so your note remains readable in both editing and reading flows." });
    sepTips.createEl("div", { text: "Separator 1 splits left tags from text; Separator 2 splits text from right panel elements." });
    sepTips.createEl("div", { text: "Preview below updates live and helps validate that your chosen separators remain unambiguous." });
  }
  const sep1Setting = new Setting(containerEl)
    .setName("Separator 1")
    .setDesc(showInfoTips ? "Primary separator between left and text segments." : "")
    .addText((t) => {
      const cur = String((cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.io && cfg.pkm.behavior.io.separator1) || "").trim();
      t.setPlaceholder("separator1").setValue(cur).onChange((v) => {
        const next = String(v || "").trim();
        if (!next) return;
        plugin.setConfigPatch({ pkm: { behavior: { io: { separator1: next } } } }, "pkm:behavior:io:separator1");
        deferRefreshSettings(refreshSettings);
      });
      if (!enabled) t.setDisabled(true);
    });
  const sep1ColorHost = containerEl.createDiv();
  sep1ColorHost.style.display = "flex";
  sep1ColorHost.style.justifyContent = "flex-end";
  sep1ColorHost.style.margin = "-2px 0 6px";
  sep1ColorHost.style.paddingLeft = "220px";

  const sep2Setting = new Setting(containerEl)
    .setName("Separator 2")
    .setDesc(showInfoTips ? "Secondary separator between text and right segments." : "")
    .addText((t) => {
      const cur = String((cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.io && cfg.pkm.behavior.io.separator2) || "").trim();
      t.setPlaceholder("separator2").setValue(cur).onChange((v) => {
        const next = String(v || "").trim();
        if (!next) return;
        plugin.setConfigPatch({ pkm: { behavior: { io: { separator2: next } } } }, "pkm:behavior:io:separator2");
        deferRefreshSettings(refreshSettings);
      });
      if (!enabled) t.setDisabled(true);
    });
  const sep2ColorHost = containerEl.createDiv();
  sep2ColorHost.style.display = "flex";
  sep2ColorHost.style.justifyContent = "flex-end";
  sep2ColorHost.style.margin = "-2px 0 6px";
  sep2ColorHost.style.paddingLeft = "220px";

  const liveCfgForSep = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : cfg;
  const s1Live = String((liveCfgForSep.pkm && liveCfgForSep.pkm.behavior && liveCfgForSep.pkm.behavior.io && liveCfgForSep.pkm.behavior.io.separator1) || "||").trim() || "||";
  const s2Live = String((liveCfgForSep.pkm && liveCfgForSep.pkm.behavior && liveCfgForSep.pkm.behavior.io && liveCfgForSep.pkm.behavior.io.separator2) || "||").trim() || "||";
  const liveTagVisuals = liveCfgForSep && liveCfgForSep.pkm && liveCfgForSep.pkm.behavior && liveCfgForSep.pkm.behavior.tagVisuals
    ? liveCfgForSep.pkm.behavior.tagVisuals
    : {};
  const s1Color = normalizeHexColorInput(
    (liveTagVisuals && liveTagVisuals.separator1TextColor)
      || (liveCfgForSep && liveCfgForSep.ui ? liveCfgForSep.ui.separator1TextColor : "")
  );
  const s2Color = normalizeHexColorInput(
    (liveTagVisuals && liveTagVisuals.separator2TextColor)
      || (liveCfgForSep && liveCfgForSep.ui ? liveCfgForSep.ui.separator2TextColor : "")
  );

  const createSeparatorColorSetting = (host, key, currentColor) => {
    const row = host.createDiv();
    row.style.width = "100%";
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr 62px 10px 48px 10px 72px 10px 48px";
    row.style.gap = "6px";
    row.style.alignItems = "center";
    row.style.margin = "4px 0";
    row.createEl("span", { text: "" });
    const lbl = row.createEl("small", { text: "Text color" });
    lbl.style.opacity = "0.85";
    row.createEl("small", { text: "|" });
    const clickWrap = row.createDiv();
    clickWrap.style.position = "relative";
    const clickBtn = clickWrap.createEl("button", { text: "Click" });
    clickBtn.style.width = "48px";
    clickBtn.style.height = "22px";
    clickBtn.style.padding = "0";
    if (currentColor) {
      clickBtn.style.background = currentColor;
      clickBtn.style.color = getContrastTextHex(currentColor);
    }
    const picker = clickWrap.createEl("input");
    picker.type = "color";
    picker.value = currentColor || "#8a8a8a";
    picker.style.position = "absolute";
    picker.style.inset = "0";
    picker.style.opacity = "0";
    picker.style.width = "48px";
    picker.style.cursor = "pointer";
    row.createEl("small", { text: "|" });
    const hex = row.createEl("input");
    hex.type = "text";
    hex.placeholder = "#rrggbb";
    hex.value = currentColor || "";
    hex.style.width = "72px";
    row.createEl("small", { text: "|" });
    const reset = row.createEl("button", { text: "Reset" });
    reset.classList.add("mod-warning");
    reset.style.borderColor = "var(--text-error)";
    reset.style.color = "var(--text-error)";
    const apply = (next) => {
      const payload = { pkm: { behavior: { tagVisuals: { [key]: next || null } } } };
      if (key === "separator1TextColor" || key === "separator2TextColor") {
        payload.ui = { [key]: next || null };
      }
      plugin.setConfigPatch(payload, `settings:tagVisuals:${key}`);
      deferRefreshSettings(refreshSettings);
    };
    picker.onchange = () => {
      const norm = normalizeHexColorInput(picker.value || "");
      if (!norm) return;
      apply(norm);
    };
    const commitHex = () => {
      const norm = normalizeHexColorInput(hex.value || "");
      if (!norm) return;
      apply(norm);
    };
    hex.onblur = commitHex;
    hex.onkeydown = (e) => { if (e.key === "Enter") commitHex(); };
    reset.onclick = () => apply("");
  };
  createSeparatorColorSetting(sep1ColorHost, "separator1TextColor", s1Color);
  createSeparatorColorSetting(sep2ColorHost, "separator2TextColor", s2Color);

  const sepPreviewFrame = containerEl.createDiv();
  sepPreviewFrame.style.marginBottom = "8px";
  sepPreviewFrame.style.padding = "8px 10px";
  sepPreviewFrame.style.border = "1px solid var(--background-modifier-border)";
  sepPreviewFrame.style.borderRadius = "8px";
  sepPreviewFrame.style.background = "var(--background-secondary)";

  const labelsRow = sepPreviewFrame.createDiv();
  labelsRow.style.position = "relative";
  labelsRow.style.display = "flex";
  labelsRow.style.justifyContent = "flex-start";
  labelsRow.style.alignItems = "center";
  labelsRow.style.marginBottom = "4px";
  const leftLabel = labelsRow.createEl("small", { text: "Left panel" });
  const rightLabel = labelsRow.createEl("small", { text: "Right panel" });
  rightLabel.style.position = "absolute";
  for (const el of [leftLabel, rightLabel]) {
    el.style.border = "1px solid var(--background-modifier-border)";
    el.style.borderRadius = "6px";
    el.style.padding = "1px 6px";
    el.style.opacity = "0.82";
  }

  const previewLine = sepPreviewFrame.createEl("div");
  previewLine.style.fontFamily = "var(--font-text)";
  previewLine.style.fontSize = "var(--font-text-size)";
  previewLine.style.lineHeight = "var(--line-height-normal)";
  previewLine.style.whiteSpace = "pre-wrap";
  previewLine.style.padding = "2px 0";
  const bullet = previewLine.createEl("span", { text: "- " });
  bullet.style.opacity = "0.9";
  previewLine.createEl("span", { text: "#tag1 #tag2" });
  previewLine.appendText("  ");
  const sep1El = previewLine.createEl("span", { text: s1Live });
  if (s1Color) sep1El.style.color = s1Color;
  previewLine.appendText("  your text here  ");
  const sep2El = previewLine.createEl("span", { text: s2Live });
  if (s2Color) sep2El.style.color = s2Color;
  previewLine.appendText("  ");
  const dateTokenEl = previewLine.createEl("span", { text: "📅 2026-01-01" });

  const alignProbe = sepPreviewFrame.createDiv();
  alignProbe.style.position = "relative";
  alignProbe.style.height = "0";
  alignProbe.style.overflow = "visible";
  alignProbe.style.pointerEvents = "none";

  const rightAnchor = alignProbe.createEl("span", { text: "📅 2026-01-01" });
  rightAnchor.style.visibility = "hidden";
  rightAnchor.style.whiteSpace = "pre";
  rightAnchor.style.fontFamily = "var(--font-text)";
  rightAnchor.style.fontSize = "var(--font-text-size)";
  rightAnchor.style.lineHeight = "var(--line-height-normal)";
  rightAnchor.style.position = "absolute";
  rightAnchor.style.right = "0";
  rightAnchor.style.top = "0";

  const syncRightLabel = () => {
    try {
      const frameRect = sepPreviewFrame.getBoundingClientRect();
      const labelRect = labelsRow.getBoundingClientRect();
      const dateRect = dateTokenEl.getBoundingClientRect();
      const targetLeft = Math.max(0, Math.round(dateRect.right - frameRect.left - rightLabel.offsetWidth));
      rightLabel.style.left = `${Math.max(0, targetLeft - Math.round(labelRect.left - frameRect.left))}px`;
      rightLabel.style.transform = "";
    } catch (_) {
      rightLabel.style.transform = "";
      rightLabel.style.left = "";
    }
  };
  setTimeout(syncRightLabel, 0);

  const cmd = containerEl.createDiv();
  cmd.style.marginBottom = "10px";
  const activeCommandsHeader = cmd.createEl("div", { text: "Active commands" });
  activeCommandsHeader.style.fontSize = "14px";
  activeCommandsHeader.style.fontWeight = "600";
  activeCommandsHeader.style.lineHeight = "1.25";
  activeCommandsHeader.style.margin = "0 0 2px 0";
  cmd.createEl("small", { text: "You could bind them to hotkeys via default Obsidian-Hotkeys menu" });
  const cmdDetails = cmd.createEl("details");
  const collapsed = !!(cfg && cfg.ui && cfg.ui.orderActiveCommandsCollapsed === true);
  let suppressTogglePatch = true;
  cmdDetails.open = !collapsed;
  cmdDetails.style.marginTop = "4px";
  cmdDetails.addEventListener("toggle", () => {
    if (suppressTogglePatch) return;
    const nextCollapsed = !cmdDetails.open;
    const currentCollapsed = !!(plugin.getConfig && plugin.getConfig() && plugin.getConfig().ui && plugin.getConfig().ui.orderActiveCommandsCollapsed === true);
    if (nextCollapsed === currentCollapsed) return;
    plugin.setConfigPatch({ ui: { orderActiveCommandsCollapsed: nextCollapsed } }, "settings:ui:orderActiveCommandsCollapsed");
  });
  setTimeout(() => {
    suppressTogglePatch = false;
  }, 0);
  const cmdSummary = cmdDetails.createEl("summary", { text: "Command list" });
  cmdSummary.style.cursor = "pointer";
  const cmdList = cmdDetails.createDiv();
  const order = typeof normalizePkmOrder === "function"
    ? normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.order : null)
    : { left: [], right: [], strictNames: {} };
  const keys = [];
  const push = (k) => {
    const v = String(k || "").trim();
    if (!v || keys.includes(v)) return;
    keys.push(v);
  };
  for (const k of (order.left || [])) push(k);
  for (const k of (order.right || [])) push(k);
  if (order.active && typeof order.active === "object") {
    for (const k of Object.keys(order.active)) {
      if (/_sub$/.test(String(k || ""))) push(k);
    }
  }
  const ids = [];
  for (const k of keys) {
    const strict = String(order.strictNames && order.strictNames[k] ? order.strictNames[k] : k).trim() || k;
    ids.push(`inlineOverhaul_Hotkey_${strict}_increase`);
    ids.push(`inlineOverhaul_Hotkey_${strict}_decrease`);
  }
  ids.push("inlineOverhaul_Hotkey_tagwheel_left");
  ids.push("inlineOverhaul_Hotkey_tagwheel_right");
  const binderRows = Array.isArray(cfg && cfg.ui && cfg.ui.binderRows) ? cfg.ui.binderRows : [];
  for (const row of binderRows) {
    const commandId = String(row && row.commandId ? row.commandId : "").trim();
    if (!commandId || ids.includes(commandId)) continue;
    ids.push(commandId);
  }
  ids.push("inlineOverhaul_Rules_apply");
  ids.push("inlineOverhaul_Rules_open_detailed_template");
  for (let i = 0; i < ids.length; i++) {
    const rowId = cmdList.createEl("code", { text: ids[i] });
    rowId.style.display = "block";
    rowId.style.marginTop = "4px";
    rowId.style.userSelect = "text";
  }
  return;
  }

  containerEl.createEl("h5", { text: "Prefix Resolver" });
  new Setting(containerEl)
    .setName("Main checkbox priority")
    .setDesc("Choose precedence source: section order or checkbox order.")
    .addDropdown((d) => {
      d.addOption("by-section", "by Fields Order");
      d.addOption("by-checkbox-list", "by Checkbox Order");
      d.setValue(normalizedPrefix.priorityMode);
      d.onChange((v) => {
        const nextMode = String(v || "by-section").trim() === "by-checkbox-list" ? "by-checkbox-list" : "by-section";
        patchPrefixRules({ priorityMode: nextMode }, "pkm:prefixRules:priorityMode");
      });
      if (!enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Fields order mode")
    .setDesc("Used only for 'by Fields Order' mode.")
    .addDropdown((d) => {
      d.addOption("auto", "Automatically");
      d.addOption("manual", "Manually");
      d.setValue(normalizedPrefix.fieldsOrderMode);
      d.onChange((v) => {
        const nextMode = String(v || "manual").trim() === "auto" ? "auto" : "manual";
        patchPrefixRules({ fieldsOrderMode: nextMode }, "pkm:prefixRules:fieldsOrderMode");
      });
      if (!enabled || normalizedPrefix.priorityMode !== "by-section") d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Tag/Subtag priority")
    .setDesc("When both tag and subtag have checkboxes, choose which one wins.")
    .addDropdown((d) => {
      d.addOption("tag-over-subtag", "Tag > Subtag");
      d.addOption("subtag-over-tag", "Subtag > Tag");
      d.setValue(normalizedPrefix.tagSubtagPriority);
      d.onChange((v) => {
        const nextMode = String(v || "subtag-over-tag").trim() === "tag-over-subtag" ? "tag-over-subtag" : "subtag-over-tag";
        patchPrefixRules({ tagSubtagPriority: nextMode }, "pkm:prefixRules:tagSubtagPriority");
      });
      if (!enabled) d.setDisabled(true);
    });

  const prefixOrderWrap = containerEl.createDiv();
  prefixOrderWrap.style.border = "1px solid var(--background-modifier-border)";
  prefixOrderWrap.style.borderRadius = "10px";
  prefixOrderWrap.style.padding = "8px 9px";
  prefixOrderWrap.style.margin = "6px 0 8px";
  prefixOrderWrap.style.background = "var(--background-secondary)";
  const prefixHead = prefixOrderWrap.createEl("h6", { text: "Prefix Resolver / Order" });
  prefixHead.style.margin = "0 0 4px 0";
  const prefixHint = prefixOrderWrap.createEl("small", { text: "Drag rows to define priority used by prefix resolver modes." });
  prefixHint.style.display = "block";
  prefixHint.style.opacity = "0.8";
  prefixHint.style.marginBottom = "4px";
  const densityMode = String(cfg && cfg.ui && cfg.ui.prefixResolverDensity || "comfortable").trim() === "compact"
    ? "compact"
    : "comfortable";
  const rowPadding = densityMode === "compact" ? "2px 5px" : "4px 6px";
  const rowGap = densityMode === "compact" ? "4px" : "6px";
  const rowFontSize = densityMode === "compact" ? "12px" : "13px";
  const rowMarginBottom = densityMode === "compact" ? "2px" : "4px";
  const handleMinWidth = densityMode === "compact" ? "12px" : "14px";
  const controlsRow = prefixOrderWrap.createDiv();
  controlsRow.style.display = "flex";
  controlsRow.style.gap = "6px";
  controlsRow.style.marginBottom = "4px";
  controlsRow.style.alignItems = "center";
  controlsRow.createEl("small", { text: "Density:" });
  const compactBtn = controlsRow.createEl("button", { text: "Compact" });
  compactBtn.style.padding = "2px 8px";
  compactBtn.style.opacity = densityMode === "compact" ? "1" : "0.8";
  compactBtn.disabled = !enabled || densityMode === "compact";
  compactBtn.onclick = () => {
    if (!enabled) return;
    plugin.setConfigPatch({ ui: { prefixResolverDensity: "compact" } }, "settings:prefix-resolver-density");
  };
  const comfyBtn = controlsRow.createEl("button", { text: "Comfortable" });
  comfyBtn.style.padding = "2px 8px";
  comfyBtn.style.opacity = densityMode === "comfortable" ? "1" : "0.8";
  comfyBtn.disabled = !enabled || densityMode === "comfortable";
  comfyBtn.onclick = () => {
    if (!enabled) return;
    plugin.setConfigPatch({ ui: { prefixResolverDensity: "comfortable" } }, "settings:prefix-resolver-density");
  };

  const fieldsWrap = prefixOrderWrap.createDiv();
  fieldsWrap.style.marginBottom = "6px";
  fieldsWrap.style.padding = "6px 8px";
  fieldsWrap.style.border = "1px solid var(--background-modifier-border)";
  fieldsWrap.style.borderRadius = "6px";
  fieldsWrap.style.background = "var(--background-primary)";
  const fieldsTitle = fieldsWrap.createEl("div", { text: "Fields Order" });
  fieldsTitle.style.fontWeight = "600";
  fieldsTitle.style.marginBottom = "4px";
  const fieldsDesc = fieldsWrap.createEl("small", { text: "Used when Main checkbox priority = by Fields Order." });
  fieldsDesc.style.display = "block";
  fieldsDesc.style.opacity = "0.78";
  fieldsDesc.style.marginBottom = "6px";
  const sectionLabelByFieldId = {};
  for (let i = 0; i < sectionRows.length; i++) {
    const row = sectionRows[i];
    sectionLabelByFieldId[row.fieldId] = row.sectionId;
  }
  const currentTargets = Array.isArray(normalizedPrefix.priorityTargets) ? normalizedPrefix.priorityTargets.slice() : [];
  const listTargets = fieldsWrap.createEl("ol");
  listTargets.style.margin = densityMode === "compact" ? "4px 0" : "6px 0";
  listTargets.style.paddingLeft = "18px";
  listTargets.style.maxHeight = "280px";
  listTargets.style.overflowY = "auto";
  let dragTargetIdx = -1;
  let dragTargetDropSide = "before";
  const moveInList = (arr, from, to) => {
    const out = arr.slice();
    if (from < 0 || to < 0 || from >= out.length || to >= out.length || from === to) return out;
    const row = out.splice(from, 1)[0];
    out.splice(to, 0, row);
    return out;
  };
  const DROP_LINE_COLOR = "var(--interactive-accent, var(--color-accent))";
  const isDarkTheme = !!(document && document.body && document.body.classList && document.body.classList.contains("theme-dark"));
  const ROW_BG = isDarkTheme ? "var(--background-primary-alt)" : "var(--background-primary)";
  const ROW_BORDER = isDarkTheme ? "var(--background-modifier-border-hover)" : "var(--background-modifier-border)";
  const DROP_LINE_WIDTH = isDarkTheme ? "3px" : "2px";
  const flashDropSettle = (rowEl) => {
    if (!rowEl) return;
    rowEl.style.transition = "background 120ms ease, outline-color 120ms ease, transform 140ms ease, box-shadow 140ms ease";
    rowEl.style.transform = "scale(1.01)";
    rowEl.style.boxShadow = "0 2px 10px rgba(0,0,0,0.12)";
    setTimeout(() => {
      rowEl.style.transform = "";
      rowEl.style.boxShadow = "";
    }, 150);
  };
  const toastReordered = () => {
    try {
      if (plugin && typeof plugin.__prefixResolverReorderToastTimer === "number") {
        clearTimeout(plugin.__prefixResolverReorderToastTimer);
      }
      plugin.__prefixResolverReorderToastTimer = setTimeout(() => {
        try { new Notice("Prefix Resolver order updated", 900); } catch (_) {}
      }, 40);
    } catch (_) {}
  };
  const autoScrollList = (listEl, ev) => {
    if (!listEl || !ev || typeof ev.clientY !== "number") return;
    const rect = listEl.getBoundingClientRect();
    const threshold = 28;
    const step = 8;
    if (ev.clientY < rect.top + threshold) listEl.scrollTop -= step;
    else if (ev.clientY > rect.bottom - threshold) listEl.scrollTop += step;
  };
  const renderTargetRows = () => {
    listTargets.empty();
    for (let i = 0; i < currentTargets.length; i++) {
      const fid = String(currentTargets[i] || "").trim();
      if (!fid) continue;
      const li = listTargets.createEl("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.gap = rowGap;
      li.style.marginBottom = rowMarginBottom;
      li.style.padding = rowPadding;
      li.style.fontSize = rowFontSize;
      li.style.borderRadius = "6px";
      li.style.border = `1px solid ${ROW_BORDER}`;
      li.style.background = ROW_BG;
      li.style.transition = "background 120ms ease, outline-color 120ms ease, transform 120ms ease, box-shadow 120ms ease";
      const rank = li.createEl("small", { text: `#${i + 1}` });
      rank.style.opacity = "0.75";
      rank.style.minWidth = "24px";
      const handle = li.createEl("span", { text: "⋮⋮" });
      handle.title = "Drag to reorder";
      handle.style.opacity = "0.75";
      handle.style.cursor = enabled ? "grab" : "default";
      handle.style.userSelect = "none";
      handle.style.letterSpacing = "-1px";
      handle.style.minWidth = handleMinWidth;
      handle.style.textAlign = "center";
      handle.draggable = !!enabled;
      li.draggable = !!enabled;
      const title = li.createEl("span", { text: String(sectionLabelByFieldId[fid] || fid) });
      title.title = fid;
      title.style.flex = "1 1 auto";
      title.style.minWidth = "0";
      title.style.whiteSpace = "nowrap";
      title.style.overflow = "hidden";
      title.style.textOverflow = "ellipsis";
      const startDrag = (e) => {
        if (!enabled) return;
        dragTargetIdx = i;
        dragTargetDropSide = "before";
        handle.style.cursor = "grabbing";
        li.style.opacity = "0.78";
        li.style.transform = "scale(0.995)";
        li.style.boxShadow = "0 4px 14px rgba(0,0,0,0.16)";
        try {
          if (e && e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(i));
          }
        } catch (_) {}
      };
      const endDrag = () => {
        dragTargetIdx = -1;
        dragTargetDropSide = "before";
        handle.style.cursor = enabled ? "grab" : "default";
        li.style.opacity = "";
        li.style.transform = "";
        li.style.boxShadow = "";
        li.style.outline = "";
        li.style.borderTop = `1px solid ${ROW_BORDER}`;
        li.style.borderBottom = `1px solid ${ROW_BORDER}`;
      };
      handle.ondragstart = startDrag;
      li.ondragstart = startDrag;
      handle.ondragend = endDrag;
      li.ondragend = endDrag;
      li.ondragover = (e) => {
        if (!enabled || dragTargetIdx < 0 || dragTargetIdx === i) return;
        e.preventDefault();
        const rect = li.getBoundingClientRect();
        const midpoint = rect.top + (rect.height / 2);
        dragTargetDropSide = (e && typeof e.clientY === "number" && e.clientY >= midpoint) ? "after" : "before";
        autoScrollList(listTargets, e);
        li.style.outline = "";
        li.style.background = "var(--background-modifier-hover)";
        li.style.borderTop = dragTargetDropSide === "before"
          ? `${DROP_LINE_WIDTH} solid ${DROP_LINE_COLOR}`
          : `1px solid ${ROW_BORDER}`;
        li.style.borderBottom = dragTargetDropSide === "after"
          ? `${DROP_LINE_WIDTH} solid ${DROP_LINE_COLOR}`
          : `1px solid ${ROW_BORDER}`;
      };
      li.ondragleave = () => {
        li.style.outline = "";
        li.style.background = "";
        li.style.borderTop = `1px solid ${ROW_BORDER}`;
        li.style.borderBottom = `1px solid ${ROW_BORDER}`;
      };
      li.ondrop = (e) => {
        li.style.outline = "";
        li.style.background = "";
        li.style.borderTop = `1px solid ${ROW_BORDER}`;
        li.style.borderBottom = `1px solid ${ROW_BORDER}`;
        if (!enabled || dragTargetIdx < 0 || dragTargetIdx === i) return;
        e.preventDefault();
        const dropIndex = dragTargetDropSide === "after" ? i + 1 : i;
        let targetIndex = dropIndex;
        if (dragTargetIdx < dropIndex) targetIndex = dropIndex - 1;
        if (targetIndex < 0) targetIndex = 0;
        if (targetIndex > currentTargets.length - 1) targetIndex = currentTargets.length - 1;
        if (targetIndex === dragTargetIdx) return;
        flashDropSettle(li);
        toastReordered();
        patchPrefixRules({ priorityTargets: moveInList(currentTargets, dragTargetIdx, targetIndex) }, "pkm:prefixRules:priorityTargets:drag");
      };
    }
    if (!currentTargets.length) {
      const empty = listTargets.createEl("li", { text: "(empty)" });
      empty.style.opacity = "0.7";
    }
  };
  renderTargetRows();

  const targetsMeta = fieldsWrap.createEl("small", { text: `${currentTargets.length} priority item(s)` });
  targetsMeta.style.display = "block";
  targetsMeta.style.opacity = "0.72";
  targetsMeta.style.marginTop = "4px";

  const checksWrap = prefixOrderWrap.createDiv();
  checksWrap.style.padding = "6px 8px";
  checksWrap.style.border = "1px solid var(--background-modifier-border)";
  checksWrap.style.borderRadius = "6px";
  checksWrap.style.background = "var(--background-primary)";
  const checksTitle = checksWrap.createEl("div", { text: "Checkbox Order" });
  checksTitle.style.fontWeight = "600";
  checksTitle.style.marginBottom = "4px";
  const checksDesc = checksWrap.createEl("small", { text: "Used when Main checkbox priority = by Checkbox Order." });
  checksDesc.style.display = "block";
  checksDesc.style.opacity = "0.78";
  checksDesc.style.marginBottom = "6px";
  const discoveredChecks = collectCheckboxTokens(normalizedPrefix.checkboxByFieldValue);
  const currentChecks = Array.isArray(normalizedPrefix.priorityCheckboxes) ? normalizedPrefix.priorityCheckboxes.slice() : [];
  const listChecks = checksWrap.createEl("ol");
  listChecks.style.margin = densityMode === "compact" ? "4px 0" : "6px 0";
  listChecks.style.paddingLeft = "18px";
  listChecks.style.maxHeight = "280px";
  listChecks.style.overflowY = "auto";
  let dragCheckIdx = -1;
  let dragCheckDropSide = "before";
  const renderCheckRows = () => {
    listChecks.empty();
    for (let i = 0; i < currentChecks.length; i++) {
      const cb = String(currentChecks[i] || "").trim();
      if (!cb) continue;
      const li = listChecks.createEl("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.gap = rowGap;
      li.style.marginBottom = rowMarginBottom;
      li.style.padding = rowPadding;
      li.style.fontSize = rowFontSize;
      li.style.borderRadius = "6px";
      li.style.border = `1px solid ${ROW_BORDER}`;
      li.style.background = ROW_BG;
      li.style.transition = "background 120ms ease, outline-color 120ms ease, transform 120ms ease, box-shadow 120ms ease";
      const rank = li.createEl("small", { text: `#${i + 1}` });
      rank.style.opacity = "0.75";
      rank.style.minWidth = "24px";
      const handle = li.createEl("span", { text: "⋮⋮" });
      handle.title = "Drag to reorder";
      handle.style.opacity = "0.75";
      handle.style.cursor = enabled ? "grab" : "default";
      handle.style.userSelect = "none";
      handle.style.letterSpacing = "-1px";
      handle.style.minWidth = handleMinWidth;
      handle.style.textAlign = "center";
      handle.draggable = !!enabled;
      li.draggable = !!enabled;
      const code = li.createEl("code", { text: cb });
      code.style.flex = "1 1 auto";
      code.style.minWidth = "0";
      const del = li.createEl("button", { text: "Remove" });
      del.style.padding = "3px 8px";
      del.disabled = !enabled;
      del.style.fontSize = "12px";
      del.onclick = () => patchPrefixRules({ priorityCheckboxes: currentChecks.filter((_, idx) => idx !== i) }, "pkm:prefixRules:priorityCheckboxes:remove");
      const startDrag = (e) => {
        if (!enabled) return;
        dragCheckIdx = i;
        dragCheckDropSide = "before";
        handle.style.cursor = "grabbing";
        li.style.opacity = "0.78";
        li.style.transform = "scale(0.995)";
        li.style.boxShadow = "0 4px 14px rgba(0,0,0,0.16)";
        try {
          if (e && e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(i));
          }
        } catch (_) {}
      };
      const endDrag = () => {
        dragCheckIdx = -1;
        dragCheckDropSide = "before";
        handle.style.cursor = enabled ? "grab" : "default";
        li.style.opacity = "";
        li.style.transform = "";
        li.style.boxShadow = "";
        li.style.outline = "";
        li.style.borderTop = `1px solid ${ROW_BORDER}`;
        li.style.borderBottom = `1px solid ${ROW_BORDER}`;
      };
      handle.ondragstart = startDrag;
      li.ondragstart = startDrag;
      handle.ondragend = endDrag;
      li.ondragend = endDrag;
      li.ondragover = (e) => {
        if (!enabled || dragCheckIdx < 0 || dragCheckIdx === i) return;
        e.preventDefault();
        const rect = li.getBoundingClientRect();
        const midpoint = rect.top + (rect.height / 2);
        dragCheckDropSide = (e && typeof e.clientY === "number" && e.clientY >= midpoint) ? "after" : "before";
        autoScrollList(listChecks, e);
        li.style.outline = "";
        li.style.background = "var(--background-modifier-hover)";
        li.style.borderTop = dragCheckDropSide === "before"
          ? `${DROP_LINE_WIDTH} solid ${DROP_LINE_COLOR}`
          : `1px solid ${ROW_BORDER}`;
        li.style.borderBottom = dragCheckDropSide === "after"
          ? `${DROP_LINE_WIDTH} solid ${DROP_LINE_COLOR}`
          : `1px solid ${ROW_BORDER}`;
      };
      li.ondragleave = () => {
        li.style.outline = "";
        li.style.background = "";
        li.style.borderTop = `1px solid ${ROW_BORDER}`;
        li.style.borderBottom = `1px solid ${ROW_BORDER}`;
      };
      li.ondrop = (e) => {
        li.style.outline = "";
        li.style.background = "";
        li.style.borderTop = `1px solid ${ROW_BORDER}`;
        li.style.borderBottom = `1px solid ${ROW_BORDER}`;
        if (!enabled || dragCheckIdx < 0 || dragCheckIdx === i) return;
        e.preventDefault();
        const dropIndex = dragCheckDropSide === "after" ? i + 1 : i;
        let targetIndex = dropIndex;
        if (dragCheckIdx < dropIndex) targetIndex = dropIndex - 1;
        if (targetIndex < 0) targetIndex = 0;
        if (targetIndex > currentChecks.length - 1) targetIndex = currentChecks.length - 1;
        if (targetIndex === dragCheckIdx) return;
        flashDropSettle(li);
        toastReordered();
        patchPrefixRules({ priorityCheckboxes: moveInList(currentChecks, dragCheckIdx, targetIndex) }, "pkm:prefixRules:priorityCheckboxes:drag");
      };
    }
    if (!currentChecks.length) {
      const empty = listChecks.createEl("li", { text: "(empty)" });
      empty.style.opacity = "0.7";
    }
  };
  renderCheckRows();

  const checksToolbar = checksWrap.createDiv();
  checksToolbar.style.display = "flex";
  checksToolbar.style.gap = "6px";
  checksToolbar.style.margin = "6px 0";
  const resetChecksBtn = checksToolbar.createEl("button", { text: "Reset to detected" });
  resetChecksBtn.disabled = !enabled;
  resetChecksBtn.onclick = () => {
    if (!enabled) return;
    patchPrefixRules({ priorityCheckboxes: discoveredChecks.slice() }, "pkm:prefixRules:priorityCheckboxes:reset-detected");
  };
  const clearChecksBtn = checksToolbar.createEl("button", { text: "Clear" });
  clearChecksBtn.disabled = !enabled;
  clearChecksBtn.onclick = () => {
    if (!enabled) return;
    patchPrefixRules({ priorityCheckboxes: [] }, "pkm:prefixRules:priorityCheckboxes:clear");
  };

  const addCheckRow = checksWrap.createDiv();
  addCheckRow.style.display = "flex";
  addCheckRow.style.flexWrap = "wrap";
  addCheckRow.style.alignItems = "center";
  addCheckRow.style.gap = "6px";
  const addCheckSelect = addCheckRow.createEl("select");
  addCheckSelect.createEl("option", { text: "Add checkbox", value: "" });
  const checkPool = Array.from(new Set(discoveredChecks.concat(currentChecks))).filter((x) => x && !currentChecks.includes(x));
  for (let i = 0; i < checkPool.length; i++) {
    addCheckSelect.createEl("option", { text: checkPool[i], value: checkPool[i] });
  }
  const addCheckInput = addCheckRow.createEl("input");
  addCheckInput.type = "text";
  addCheckInput.placeholder = "[ ]";
  addCheckInput.style.width = "120px";
  addCheckInput.style.fontSize = "12px";
  const addCheckHint = checksWrap.createEl("small", { text: "Type checkbox token or pick from list. Press Enter to add." });
  addCheckHint.style.display = "block";
  addCheckHint.style.opacity = "0.72";
  addCheckHint.style.marginTop = "4px";
  const addCheckBtn = addCheckRow.createEl("button", { text: "Add" });
  addCheckSelect.disabled = !enabled;
  addCheckInput.disabled = !enabled;
  addCheckBtn.disabled = !enabled;
  addCheckBtn.onclick = () => {
    const fromSelect = String(addCheckSelect.value || "").trim();
    const fromInput = String(addCheckInput.value || "").trim();
    const cb = fromInput || fromSelect;
    if (!cb || currentChecks.includes(cb)) return;
    patchPrefixRules({ priorityCheckboxes: currentChecks.concat([cb]) }, "pkm:prefixRules:priorityCheckboxes:add");
  };
  addCheckInput.addEventListener("keydown", (e) => {
    if (!enabled) return;
    if (e && e.key === "Enter") {
      e.preventDefault();
      addCheckBtn.click();
    }
  });
  
  containerEl.createEl("h5", { text: "Behavior" });
  {
    const leadWrap = containerEl.createDiv();
    leadWrap.style.border = "1px solid var(--background-modifier-border)";
    leadWrap.style.borderRadius = "8px";
    leadWrap.style.padding = "8px";
    leadWrap.style.background = "var(--background-secondary)";
    leadWrap.style.marginBottom = "8px";
    const leadTitle = leadWrap.createEl("div", { text: "TagWheel lead field" });
    leadTitle.style.fontWeight = "600";
    leadTitle.style.marginBottom = "6px";
    const leadOrder = typeof normalizePkmOrder === "function"
      ? normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.order : null)
      : { left: [], right: [], labels: {}, lead: {} };
    const byId = {};
    for (let i = 0; i < allFields.length; i++) {
      const f = allFields[i];
      const id = String(f && f.id || "").trim();
      if (id) byId[id] = f;
    }
    const makeCandidates = (panelKey) => {
      const arr = panelKey === "right" ? (leadOrder.right || []) : (leadOrder.left || []);
      const out = [];
      const seen = new Set();
      for (let i = 0; i < arr.length; i++) {
        const key = String(arr[i] || "").trim();
        if (!key || /_sub$/.test(key) || seen.has(key)) continue;
        seen.add(key);
        const id = String(leadOrder.strictNames && leadOrder.strictNames[key] ? leadOrder.strictNames[key] : key).trim() || key;
        const field = byId[id] || byId[key] || null;
        const source = String(field && field.source || "").trim();
        if (source === "projects" || /^wikilinks:/.test(source)) continue;
        out.push({ key, label: String(leadOrder.labels && leadOrder.labels[key] ? leadOrder.labels[key] : key) });
      }
      return out;
    };
    const grid = leadWrap.createDiv();
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gap = "8px";
    const createLeadSelect = (panelKey, labelText) => {
      const box = grid.createDiv();
      const label = box.createEl("small", { text: labelText });
      label.style.display = "block";
      label.style.marginBottom = "4px";
      const select = box.createEl("select");
      select.style.width = "100%";
      if (!enabled) select.disabled = true;
      const candidates = makeCandidates(panelKey);
      select.createEl("option", { text: "default", value: "" });
      for (let i = 0; i < candidates.length; i++) {
        const row = candidates[i];
        select.createEl("option", { text: `${row.label} (${row.key})`, value: row.key });
      }
      const currentLead = String(leadOrder && leadOrder.lead && leadOrder.lead[panelKey] ? leadOrder.lead[panelKey] : "").trim();
      select.value = candidates.some((row) => row.key === currentLead) ? currentLead : "";
      select.onchange = () => {
        if (!enabled) return;
        plugin.setConfigPatch({ pkm: { behavior: { order: { lead: { [panelKey]: String(select.value || "").trim() } } } } }, `pkm:behavior:order:lead:${panelKey}`);
        deferRefreshSettings(refreshSettings);
      };
    };
    createLeadSelect("left", "Left field");
    createLeadSelect("right", "Right field");
  }

  new Setting(containerEl)
    .setName("Subtag format")
    .setDesc("Single format for both TagWheel and status_tags commands.")
    .addDropdown((d) => {
      d.addOption("separate", "separate: #parent #subtag");
      d.addOption("combined", "combined: #parent/subtag");
      d.setValue((cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.subtagFormat) || "separate");
      d.onChange((v) => {
        plugin.setConfigPatch({ pkm: { behavior: { subtagFormat: v } } }, "pkm:behavior:subtagFormat");
      });
      if (!enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Line prefix after end of cycle")
    .setDesc("When cycle exits to empty on an empty-like line: keep bullet '- ' or clear the line.")
    .addDropdown((d) => {
      d.addOption("keep-bullet", "Keep bullet (- )");
      d.addOption("clear-prefix", "Clear line");
      d.setValue((cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.cycleEndBehavior) || "keep-bullet");
      d.onChange((v) => {
        plugin.setConfigPatch({ pkm: { behavior: { cycleEndBehavior: v } } }, "pkm:behavior:cycleEndBehavior");
      });
      if (!enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Cursor behavior")
    .setDesc("Where cursor lands after PKM actions. text_end keeps focus in the text slot before the separator zone.")
    .addDropdown((d) => {
      d.addOption("text_end", "text_end (recommended)");
      d.addOption("current_position", "current_position");
      d.addOption("line_end", "line_end");
      d.setValue((cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.cursorPolicy) || "text_end");
      d.onChange((v) => {
        plugin.setConfigPatch({ pkm: { behavior: { cursorPolicy: v } } }, "pkm:behavior:cursorPolicy");
      });
      if (!enabled) d.setDisabled(true);
    });

  containerEl.createEl("h6", { text: "Free roam" });
  new Setting(containerEl)
    .setName("Minimal mode separators")
    .setDesc("Minimal mode: insert the element according to Order without changing the line prefix.")
    .addToggle((t) => {
      const on = cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.freeRoam
        ? cfg.pkm.behavior.freeRoam.minimalSeparator !== false
        : true;
      t.setValue(on).onChange((v) => {
        plugin.setConfigPatch({ pkm: { behavior: { freeRoam: { minimalSeparator: !!v } } } }, "pkm:behavior:freeRoam:minimalSeparator");
      });
      if (!enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("OFF mode prefix")
    .setDesc("Applies only when field Free roam = off. On: if the selected field has no own checkbox in config, runtime rewrites prefix to bullet (except headings). Off: keep source prefix when the field has no own checkbox.")
    .addToggle((t) => {
      const on = cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.freeRoam
        ? cfg.pkm.behavior.freeRoam.offPrefix === true
        : false;
      t.setValue(on).onChange((v) => {
        plugin.setConfigPatch({ pkm: { behavior: { freeRoam: { offPrefix: !!v } } } }, "pkm:behavior:freeRoam:offPrefix");
      });
      if (!enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Minimal mode prefix")
    .setDesc("Applies only when field Free roam = minimal. On: tag-specific checkbox/prefix can replace the line prefix. Off: keep the original line prefix unchanged.")
    .addToggle((t) => {
      const on = cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.freeRoam
        ? cfg.pkm.behavior.freeRoam.minimalPrefix !== false
        : true;
      t.setValue(on).onChange((v) => {
        plugin.setConfigPatch({ pkm: { behavior: { freeRoam: { minimalPrefix: !!v } } } }, "pkm:behavior:freeRoam:minimalPrefix");
      });
      if (!enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Full mode: where to input element if cursor inside text?")
    .setDesc("Choose full mode placement: Smart / Left / Right.")
    .addDropdown((d) => {
      d.addOption("smart", "Smart");
      d.addOption("left", "Left");
      d.addOption("right", "Right");
      const curPlacement = String((cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.freeRoam && cfg.pkm.behavior.freeRoam.fullPlacement) || "smart").trim().toLowerCase();
      d.setValue(["smart", "left", "right"].includes(curPlacement) ? curPlacement : "smart");
      d.onChange((v) => {
        const next = String(v || "smart").trim().toLowerCase();
        plugin.setConfigPatch({ pkm: { behavior: { freeRoam: { fullPlacement: ["smart", "left", "right"].includes(next) ? next : "smart" } } } }, "pkm:behavior:freeRoam:fullPlacement");
      });
      if (!enabled) d.setDisabled(true);
    });
}

module.exports = {
  renderSettingsDisplaySection,
  renderTabBarSection,
  renderGeneralSection,
  renderHotkeysTabSection,
  renderModuleTabSection,
  renderVisualTabSection,
  renderPkmOrderBoardSection,
  renderPkmConfigSections,
  renderNavigationSettings,
  renderVisualGeneralSection,
  renderVisualTagsSection,
  renderVisualStripSection,
  renderColorsSection,
  renderAdvancedSection,
};
