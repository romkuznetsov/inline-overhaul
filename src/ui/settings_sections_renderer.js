"use strict";

/*
 * Редактор Fields и его помощники переехали в слой настроек:
 * `settings/custom/fields_editor_legacy.js` (PRD 5.1, фаза 3b, пункт 2).
 * Здесь остались только ссылки на них — старая панель зовёт ровно тот же
 * код, что и новая, поэтому расхождения между панелями быть не может.
 */
const __fieldsEditor = require("./settings/custom/fields_editor_legacy.js");
const {
  computeTagVisualStyle,
  deferRefreshSettings,
  getContrastTextHex,
  normalizeHexColorInput,
  readTagVisualsConfig,
  renderPkmOrderBoardSection,
} = __fieldsEditor;


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
