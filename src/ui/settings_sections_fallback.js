"use strict";

function normalizeHexColorInput(value) {
  const src = String(value || "").trim().toLowerCase();
  if (!src) return "";
  return /^#[0-9a-f]{6}$/.test(src) ? src : "";
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

function createSettingsSectionsRendererFallback() {
  return {
    renderSettingsDisplaySection(ctx) {
      const { containerEl, cfg, getActiveSettingsTab, renderTabBar, renderSettingsTabContent } = ctx;
      const activeTab = getActiveSettingsTab(cfg);
      containerEl.createEl("h2", { text: "InlineOverhaul" });
      containerEl.createEl("p", { text: "Fallback settings renderer is active." });
      renderTabBar(containerEl, activeTab);
      renderSettingsTabContent(activeTab, containerEl, cfg);
    },
    renderTabBarSection(ctx) {
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
    },
    renderGeneralSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "General settings are unavailable in fallback mode." });
    },
    renderHotkeysTabSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Hotkeys settings are unavailable in fallback mode." });
    },
    renderModuleTabSection(ctx) {
      const { Setting, containerEl, featureKey, cfg, renderNavigationSettings, renderPkmSettings } = ctx;
      const enabled = !!(cfg && cfg.features && cfg.features[featureKey] && cfg.features[featureKey].enabled);
      if (featureKey === "navigation") {
        renderNavigationSettings(containerEl, cfg, enabled);
      } else if (featureKey === "pkm") {
        renderPkmSettings(containerEl, cfg, enabled);
      } else {
        new Setting(containerEl)
          .setName("Module placeholder")
          .setDesc("Fallback mode")
          .addText((txt) => {
            txt.setValue("Fallback renderer");
            txt.setDisabled(true);
          });
      }
    },
    renderVisualTabSection(ctx) {
      const { containerEl, cfg, renderVisualGeneralSection, renderVisualTagsSection, renderVisualStripSection, Setting, plugin } = ctx;
      const enabled = !!(cfg && cfg.features && cfg.features.visual && cfg.features.visual.enabled);
      const activeSubTab = (cfg && cfg.ui && cfg.ui.visualSubTab) || "tags";
      if (activeSubTab === "tagwheel") {
        renderVisualGeneralSection({ Setting, containerEl, enabled, cfg, plugin });
      } else if (activeSubTab === "strip") {
        renderVisualStripSection({ Setting, containerEl, enabled, cfg, plugin });
      } else {
        renderVisualTagsSection({ Setting, containerEl, enabled, cfg, plugin });
      }
    },
    renderPkmOrderBoardSection() {},
    renderPkmConfigSections(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "PKM settings are unavailable in fallback mode." });
    },
    renderNavigationSettings(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Navigation settings are unavailable in fallback mode." });
    },
    renderVisualGeneralSection(ctx) {
      const { containerEl, Setting, cfg, plugin, enabled } = ctx;
      containerEl.createEl("h4", { text: "TagWheel" });
      containerEl.createEl("h5", { text: "Scroller" });
      if (typeof Setting !== "function" || !plugin) {
        containerEl.createEl("p", { text: "Visual settings fallback mode." });
        return;
      }
      const behavior = cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior : {};
      const scroller = behavior && behavior.tagWheelScroller ? behavior.tagWheelScroller : {};
      const currentEnabled = scroller.enabled === true;
      const currentDirection = ["up", "down", "full"].includes(String(scroller.direction || "").trim().toLowerCase())
        ? String(scroller.direction).trim().toLowerCase()
        : "full";
      const rawSize = Math.trunc(Number(scroller.size));
      const currentSize = Number.isFinite(rawSize) ? Math.max(1, Math.min(20, rawSize)) : 3;

      new Setting(containerEl)
        .setName("TagWheel scroller")
        .setDesc("Render active field values as overlay scroller above editor text.")
        .addToggle((t) => {
          t.setValue(currentEnabled).onChange((v) => {
            plugin.setConfigPatch({ pkm: { behavior: { tagWheelScroller: { enabled: v } } } }, "visual:tagwheel:scroller:enabled");
          });
          if (!enabled) t.setDisabled(true);
        });

      new Setting(containerEl)
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
          });
          if (!enabled || !currentEnabled) d.setDisabled(true);
        });

      new Setting(containerEl)
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
          });
          if (!enabled || !currentEnabled) txt.setDisabled(true);
        });

      containerEl.createEl("h5", { text: "Panel" });
      const colors = readTagwheelHeaderColorConfig(cfg);
      containerEl.createEl("p", {
        text: `Default text color: ${colors.defaultTextColor || "theme default"}; Filling color: ${colors.fillColor || "theme default"}; Show prefix: ${colors.showPrefix ? "ON" : "OFF"}`,
      });
    },
    renderVisualTagsSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Tags settings fallback mode." });
    },
    renderVisualStripSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Strip settings fallback mode." });
    },
    renderColorsSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Colors settings fallback mode." });
    },
    renderAdvancedSection(ctx) {
      const { containerEl } = ctx;
      containerEl.createEl("p", { text: "Advanced settings fallback mode." });
    },
  };
}

module.exports = {
  createSettingsSectionsRendererFallback,
};
