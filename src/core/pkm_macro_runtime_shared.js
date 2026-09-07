"use strict";

/*
 * Общая часть макро-рантайма: один статический `require` на модуль (У-89).
 *
 * Мост модулей отсюда ушёл вместе со своим кешем и со своим ключом
 * `globalThis`. Обёртка `loadVaultModule`, которая его звала, осталась ровно
 * потому, что её зовут места в файлах под З3 — по **пути внутри vault**.
 * Путь резолвится таблицей `MODULES_BY_VAULT_PATH`: и таблица, и всё в ней —
 * литеральные `require`, то есть то же, что раньше делал реестр
 * забандленных модулей, но без чтения vault, без `new Function` и без реестра.
 *
 * Таблица тут временная и уйдёт вместе с последним чтением по пути: движки
 * должны требовать модуль сами, литералом. Пока чтения на месте, таблица —
 * единственное место, где путь превращается в модуль, и промахнуться мимо
 * литерала в ней нельзя.
 *
 * Неизвестный путь — не `null`, а исключение: «модуль не приехал» и «модуля не
 * просили» — разные вещи, и первое обязано быть громким (У-90).
 */

const MODULES_BY_VAULT_PATH = {
  ".obsidian/plugins/inline-overhaul/pkm_v2/field_model.js": require("../../pkm_v2/field_model.js"),
  ".obsidian/plugins/inline-overhaul/pkm_v2/status_date.js": require("../../pkm_v2/status_date.js"),
  ".obsidian/plugins/inline-overhaul/pkm_v2/status_tags.js": require("../../pkm_v2/status_tags.js"),
  ".obsidian/plugins/inline-overhaul/pkm_v2/TagWheel/tagwheel.js": require("../../pkm_v2/TagWheel/tagwheel.js"),
  ".obsidian/plugins/inline-overhaul/pkm_v2/TagWheel/tagwheel_core.js": require("../../pkm_v2/TagWheel/tagwheel_core.js"),
  ".obsidian/plugins/inline-overhaul/src/core/date_runtime_shared.js": require("./date_runtime_shared.js"),
  ".obsidian/plugins/inline-overhaul/src/core/line_pipeline.js": require("./line_pipeline.js"),
  ".obsidian/plugins/inline-overhaul/src/core/markdown_json_block_parser.js": require("./markdown_json_block_parser.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_domain_registry.js": require("./pkm_domain_registry.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_line_finalize_unified.js": require("./pkm_line_finalize_unified.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_macro_shared.js": require("./pkm_macro_shared.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_option_keys.js": require("./pkm_option_keys.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_rules_runtime_helpers.js": require("./pkm_rules_runtime_helpers.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_runtime_bootstrap.js": require("./pkm_runtime_bootstrap.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_runtime_preload_facade.js": require("./pkm_runtime_preload_facade.js"),
  ".obsidian/plugins/inline-overhaul/src/core/status_line_runtime_unified.js": require("./status_line_runtime_unified.js"),
  ".obsidian/plugins/inline-overhaul/src/core/status_runtime_common.js": require("./status_runtime_common.js"),
  ".obsidian/plugins/inline-overhaul/src/core/tagwheel_rules_normalizer.js": require("./tagwheel_rules_normalizer.js"),
  ".obsidian/plugins/inline-overhaul/src/core/token_graph_unified.js": require("./token_graph_unified.js"),
  ".obsidian/plugins/inline-overhaul/src/ui/tagwheel_scroller_overlay.js": require("../ui/tagwheel_scroller_overlay.js"),
};

const facade = require("./pkm_runtime_preload_facade.js");
const optionKeys = require("./pkm_option_keys.js");

function normalizeVaultModulePath(vaultPath) {
  let path = String(vaultPath || "").trim().replace(/\\/g, "/");
  while (path.startsWith("./")) path = path.slice(2);
  if (path.startsWith("plugins/inline-overhaul/")) path = ".obsidian/" + path;
  const marker = path.indexOf(".obsidian/plugins/inline-overhaul/");
  return marker >= 0 ? path.slice(marker) : path;
}

async function loadVaultModule(app_, vaultPath) {
  const path = normalizeVaultModulePath(vaultPath);
  if (!Object.prototype.hasOwnProperty.call(MODULES_BY_VAULT_PATH, path)) {
    throw new Error("pkm_macro_runtime_shared: module is not bundled: " + path);
  }
  return MODULES_BY_VAULT_PATH[path];
}

async function loadRuntimePreloadFacade() {
  globalThis.__inlineRuntimePreloadFacade = facade;
  return facade;
}

function normalizeOrderKeyLocal(key) {
  return String(key || "").trim();
}

async function loadOrderKeyNormalizer(app_, fallbackNormalize) {
  const fallback = typeof fallbackNormalize === "function" ? fallbackNormalize : normalizeOrderKeyLocal;
  return facade.loadOrderKeyNormalizer(app_, loadVaultModule, fallback);
}

async function loadLinePipeline() {
  return facade.loadLinePipeline();
}

async function loadMacroShared() {
  return facade.loadMacroShared();
}

async function loadRulesRuntimeHelpers() {
  return facade.loadRulesRuntimeHelpers();
}

async function loadPkmOptionKeys() {
  globalThis.__inlinePkmOptionKeysMod = optionKeys;
  return optionKeys;
}

module.exports = {
  MODULES_BY_VAULT_PATH,
  normalizeVaultModulePath,
  loadVaultModule,
  loadRuntimePreloadFacade,
  normalizeOrderKeyLocal,
  loadOrderKeyNormalizer,
  loadLinePipeline,
  loadMacroShared,
  loadRulesRuntimeHelpers,
  loadPkmOptionKeys,
};
