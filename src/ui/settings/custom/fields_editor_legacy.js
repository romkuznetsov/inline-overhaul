"use strict";
/*
 * Редактор Fields, перенесённый из `src/ui/settings_sections_renderer.js`
 * БЕЗ ИЗМЕНЕНИЯ ЛОГИКИ (PRD фаза 3b, пункт 2, требования Ф12–Ф16).
 *
 * Что здесь лежит: доска Order целиком (около 3200 строк) и помощники, без
 * которых она не работает. Код дословно тот же, что был: перенос проверяется
 * двумя пинами, снятыми до него, —
 * `tests/regression/order_deep_editor_state_tests.js` и
 * `order_deep_editor_render_tests.ts`. Если после правки здесь падает хоть
 * одна их проверка, это уже не перенос.
 *
 * Почему файл `.js`, а не `.ts`, и почему в нём инлайновые стили и цветовые
 * литералы, запрещённые в слое настроек (Г1, Г2, З6): переписывать его в этом
 * шаге нельзя — иначе нечем отличить перенос от переписывания. Конверсия
 * идёт отдельно: список Fields с Block и перетаскиванием — 3b пункт 4
 * (Ф17–Ф20), тексты — фаза 4, стили — фаза 6. До тех пор файл выведен из
 * проверок слоя настроек по имени, и это записано в разделе 12 PRD.
 *
 * Старая панель зовёт этот же файл (`settings_sections_renderer.js` только
 * пересылает вызов), новая — через `custom/fields_editor.ts`. Двум панелям
 * разойтись не на чем: код один.
 */

const { createFieldsModel } = require("./fields_model.ts");

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
    const local = require("../../../core/order_deep_editor_state.js");
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

function readTagVisualsConfig(cfg) {
  const behavior = cfg && cfg.pkm && cfg.pkm.fields ? cfg.pkm.fields : {};
  const visuals = cfg && cfg.visual && cfg.visual.tags ? cfg.visual.tags : {};
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

function renderPkmOrderBoardSection(ctx) {
  /*
   * `refreshSettings` добавлен в контекст 2026-08-26 и это единственная правка
   * логики в перенесённом файле. Причина: тремя строками ниже доска зовёт
   * `deferRefreshSettings(refreshSettings)`, а имени в области видимости не
   * было ни у одной панели — дефект A14. Значение тумблеров вида записывалось,
   * а перерисовка падала с ReferenceError. Оба пина после правки проходят.
   */
  const { Setting, Notice, Modal, containerEl, cfg, enabled, plugin, normalizePkmOrder, pkmOrderFields, setIcon, refreshSettings } = ctx;
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

  /*
   * Записи в конфиг собирает модель `fields_model.ts`: доска и новая
   * вёрстка обязаны писать одно и то же, иначе карта записей перестаёт
   * проверять переписывание вёрстки (фаза 3b пункт 4). Вынос дословный,
   * и доказывает это та же карта: она обязана остаться посимвольно той
   * же. Здесь остались вёрстка, диалоги и уведомления.
   */
  const model = createFieldsModel({ plugin, normalizePkmOrder, pkmOrderFields, cfg, deepState });
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

  const orderState = model.orderState;
  const getOrderKeys = model.getOrderKeys;
  const typeLabelByKind = {
    tag: "#tag",
    wikilink: "[[link]]",
    element: "element",
  };
  const getFieldKind = model.getFieldKind;
  const getTagVisualRuntime = () => readTagVisualsConfig(plugin.getConfig());
  /* Цвет и видимость Value тоже собирает модель. */
  const getTagVisualRow = model.getValueVisual;
  const setTagVisualRow = model.setValueVisual;
  const getSubKeyForParent = model.getSubKeyForParent;
  const ensureAllKeys = model.ensureAllKeys;
  ensureAllKeys();

  const getPanelLeadCandidates = model.getPanelLeadCandidates;

  const captureSnapshot = model.captureSnapshot;

  const applySnapshot = model.applySnapshot;

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
        const byField = live && live.pkm && live.pkm.fields && live.pkm.fields.elements && live.pkm.fields.elements.byField
          ? live.pkm.fields.elements.byField
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
  addBtn.onclick = () => {
    if (!enabled) return;
    const res = model.addField(addStrict.value, addType.value);
    if (!res.ok) {
      new Notice(res.error);
      return;
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
    model.moveKey(toPanel, key, beforeKey);
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
        const res = await model.setStrictName(k, strictInput.value);
        if (!res.ok) {
          new Notice(res.error);
          strictInput.value = oldName;
          return;
        }
        if (res.changed === false) return;
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
        model.setLabel(k, v);
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
        model.setProperty(k, yamlInput.value);
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
          model.toggleSub(subKey);
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
        model.setFreeRoam(k, freeRoamSelect.value);
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
        model.setActive(k, activeSelect.value);
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
        model.deleteField(k);
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


          if (kind === "element") {
            /* Записи Field типа element тоже собирает модель. */
            const elemEditor = model.elementEditor(k);
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
            addCell("Emoji", elemEditor.emoji, (v) => elemEditor.setEmoji(v));
            addCell("Format", elemEditor.format, (v) => elemEditor.setFormat(v));
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
            modeSelect.value = elemEditor.mode;
            modeSelect.disabled = !enabled;
            modeSelect.onchange = () => {
              if (!enabled) return;
              markSnapshot(captureSnapshot());
              elemEditor.setMode(modeSelect.value);
              renderOrderBoard();
            };
            const cmdWrap = details.createDiv();
            cmdWrap.style.display = "flex";
            cmdWrap.style.gap = "6px";
            cmdWrap.style.marginTop = "6px";
            const incInput = cmdWrap.createEl("input");
            incInput.type = "number";
            incInput.value = String(elemEditor.incrementBy);
            incInput.style.width = "86px";
            const behaviorHint = cmdWrap.createEl("small");
            behaviorHint.style.opacity = "0.85";
            behaviorHint.style.alignSelf = "center";
            const cmdSelect = cmdWrap.createEl("select");
            for (const opt of ["now", "randomN", "randomE"]) cmdSelect.createEl("option", { text: opt, value: opt });
            cmdSelect.value = elemEditor.command;
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
            customArea.value = elemEditor.customRaw.join("\n");
            customArea.placeholder = "1. X (Y)\n- X - increment number\n- Y - how many hotkey taps before moving to the next step\n- i.e. 1 (3) -> for next 3 taps the element will increase at 1\n\n2. X\n- if it's not clear - it's just only X without (Y)\n- it works only for 1 tap before moving next (but if it is the last item - it will work for every next press on hotkey till the end of times)\n\n3. END\n- end of cycle, it deletes the element and next press will start from (1)";
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
            incInput.onchange = () => {
              if (!enabled) return;
              markSnapshot(captureSnapshot());
              elemEditor.setIncrementBy(Number(incInput.value || 1));
            };
            cmdSelect.onchange = () => {
              if (!enabled) return;
              markSnapshot(captureSnapshot());
              elemEditor.setCommand(cmdSelect.value);
              syncModeVis();
            };
            const commitCustomRaw = () => {
              if (!enabled) return;
              markSnapshot(captureSnapshot());
              syncCustomNums();
              elemEditor.setCustomRaw(customArea.value || "");
            };
            customArea.onchange = () => {
              commitCustomRaw();
            };
            customArea.oninput = () => {
              syncCustomNums();
            };
          } else {
            /*
             * Значения Field ведёт модель — та же, что и новая вёрстка
             * (фаза 3b пункт 4). Здесь остались разметка и перетаскивание.
             */
            const values = model.valuesEditor(k);
            const parentField = values.parentField;
            const subField = values.subField;
            const parentFieldId = values.parentFieldId;
            const normalizeCheckbox = values.normalizeCheckbox;
            const tree = values.tree;
            const wikilinkParentChoices = values.linkParents;
            const inferWikilinkBindingValue = values.inferLinkBinding;
            const reorderTreeByDrag = values.reorder;
            const listWrap = details.createDiv();
            listWrap.style.marginTop = "6px";
            let dragMeta = null;
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
                const res = values.saveTree(nextTree, reason);
                if (res.error) {
                  new Notice(res.error);
                  return;
                }
                if (!res.ok) return;
                renderOrderBoard();
              };
              inpt.onchange = () => {
                const nextToken = typeof deepState.normalizeToken === "function"
                  ? deepState.normalizeToken(inpt.value, kind)
                  : String(inpt.value || "");
                const nextTree = values.editRow(tree, { level, token, parentToken }, { token: nextToken });
                saveTree(nextTree, "pkm:behavior:order:deep:rename:" + k);
              };
              del.onclick = () => {
                const nextTree = values.removeRow(tree, { level, token, parentToken });
                saveTree(nextTree, "pkm:behavior:order:deep:delete-token:" + k);
              };
              indentBtn.onclick = () => {
                if (kind === "wikilink") return;
                const nextTree = values.toggleLevel(tree, { level, token, parentToken });
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
              if (kind !== "wikilink") {
                if (typeof deepState.applyTagTreeToFields !== "function") return;
                markSnapshot(captureSnapshot());
              }
              const res = values.addToken(addInput.value);
              if (res.error) {
                new Notice(res.error);
                return;
              }
              if (!res.ok) return;
              if (kind === "wikilink") addInput.value = "";
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

    const sep1 = String((cfg && cfg.pkm && cfg.pkm.lineFormat && cfg.pkm.lineFormat.separator1) || "||").trim() || "||";
    const sep2 = String((cfg && cfg.pkm && cfg.pkm.lineFormat && cfg.pkm.lineFormat.separator2) || "||").trim() || "||";

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
      const behaviorNow = cfg && cfg.pkm && cfg.pkm.fields ? cfg.pkm.fields : {};
      const fields = []
        .concat(Array.isArray(behaviorNow.tags && behaviorNow.tags.fields) ? behaviorNow.tags.fields : [])
        .concat(Array.isArray(behaviorNow.links && behaviorNow.links.fields) ? behaviorNow.links.fields : []);
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
        model.setLead(panelKey, select.value);
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
    const visualsNow = cfgNow && cfgNow.visual && cfgNow.visual.tags
      ? cfgNow.visual.tags
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
      plugin.setConfigPatch({ visual: { tags: { userTags: { [tok]: next } } } }, reason || "pkm:visuals:user-tags");
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
        plugin.setConfigPatch({ visual: { tags: { userTags: { [token]: null } } } }, "pkm:visuals:user-tags:delete");
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
      plugin.setConfigPatch({ visual: { tags: { userTags: { [token]: { fillColor: "", textColor: "", visibility: "default" } } } } }, "pkm:visuals:user-tags:add");
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

module.exports = {
  computeTagVisualStyle,
  /* Новой панели нужен тот же объект помощников, что и доске: искать его
     дважды нельзя — у поиска есть откат на заглушку, и две заглушки разошлись
     бы молча. */
  getOrderDeepEditorState,
  deferRefreshSettings,
  getContrastTextHex,
  normalizeHexColorInput,
  readTagVisualsConfig,
  renderPkmOrderBoardSection,
};
