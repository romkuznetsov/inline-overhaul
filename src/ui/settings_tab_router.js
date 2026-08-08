"use strict";

function renderSettingsTabContent(tab, activeTab, containerEl, cfg) {
  if (activeTab === "general") tab.renderGeneral(containerEl, cfg);
  else if (activeTab === "hotkeys") tab.renderHotkeysTab(containerEl, cfg);
  else if (activeTab === "navigation") tab.renderModuleTab(containerEl, "navigation", cfg);
  else if (activeTab === "pkm") tab.renderModuleTab(containerEl, "pkm", cfg);
  else if (activeTab === "visual") tab.renderVisualTab(containerEl, cfg);
  else if (activeTab === "transform") tab.renderModuleTab(containerEl, "transform", cfg);
  else if (activeTab === "advanced") tab.renderAdvanced(containerEl, cfg);
}

module.exports = {
  renderSettingsTabContent,
};
