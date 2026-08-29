"use strict";

const bundledVaultModules = new Map(Object.entries({
  ".obsidian/plugins/inline-overhaul/navigation_runtime.js": require("../navigation_runtime.js"),
  ".obsidian/plugins/inline-overhaul/pkm_runtime_v2.js": require("../pkm_runtime_v2.js"),
  ".obsidian/plugins/inline-overhaul/pkm_v2/field_model.js": require("../pkm_v2/field_model.js"),
  ".obsidian/plugins/inline-overhaul/pkm_v2/status_date.js": require("../pkm_v2/status_date.js"),
  ".obsidian/plugins/inline-overhaul/pkm_v2/status_tags.js": require("../pkm_v2/status_tags.js"),
  ".obsidian/plugins/inline-overhaul/pkm_v2/TagWheel/tagwheel.js": require("../pkm_v2/TagWheel/tagwheel.js"),
  ".obsidian/plugins/inline-overhaul/pkm_v2/TagWheel/tagwheel_core.js": require("../pkm_v2/TagWheel/tagwheel_core.js"),
  ".obsidian/plugins/inline-overhaul/src/core/compat_profile.js": require("../src/core/compat_profile.js"),
  ".obsidian/plugins/inline-overhaul/src/core/config_migration.js": require("../src/core/config_migration.js"),
  ".obsidian/plugins/inline-overhaul/src/core/config_store.js": require("../src/core/config_store.js"),
  ".obsidian/plugins/inline-overhaul/src/core/date_runtime_shared.js": require("../src/core/date_runtime_shared.js"),
  ".obsidian/plugins/inline-overhaul/src/core/line_pipeline.js": require("../src/core/line_pipeline.js"),
  ".obsidian/plugins/inline-overhaul/src/core/markdown_json_block_parser.js": require("../src/core/markdown_json_block_parser.js"),
  ".obsidian/plugins/inline-overhaul/src/core/order_deep_editor_state.js": require("../src/core/order_deep_editor_state.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_domain_registry.js": require("../src/core/pkm_domain_registry.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_line_finalize_unified.js": require("../src/core/pkm_line_finalize_unified.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_macro_runtime_entry.js": require("../src/core/pkm_macro_runtime_entry.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_macro_runtime_shared.js": require("../src/core/pkm_macro_runtime_shared.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_macro_shared.js": require("../src/core/pkm_macro_shared.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_option_keys.js": require("../src/core/pkm_option_keys.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_rules_runtime_helpers.js": require("../src/core/pkm_rules_runtime_helpers.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_runtime_bootstrap.js": require("../src/core/pkm_runtime_bootstrap.js"),
  ".obsidian/plugins/inline-overhaul/src/core/pkm_runtime_preload_facade.js": require("../src/core/pkm_runtime_preload_facade.js"),
  ".obsidian/plugins/inline-overhaul/src/core/priority_strip_cm6_adapter.js": require("../src/core/priority_strip_cm6_adapter.js"),
  ".obsidian/plugins/inline-overhaul/src/core/priority_strip_engine.js": require("../src/core/priority_strip_engine.js"),
  ".obsidian/plugins/inline-overhaul/src/core/shared_utils.js": require("../src/core/shared_utils.js"),
  ".obsidian/plugins/inline-overhaul/src/core/status_line_runtime_unified.js": require("../src/core/status_line_runtime_unified.js"),
  ".obsidian/plugins/inline-overhaul/src/core/status_runtime_common.js": require("../src/core/status_runtime_common.js"),
  ".obsidian/plugins/inline-overhaul/src/core/tagwheel_rules_normalizer.js": require("../src/core/tagwheel_rules_normalizer.js"),
  ".obsidian/plugins/inline-overhaul/src/core/token_graph_unified.js": require("../src/core/token_graph_unified.js"),
  ".obsidian/plugins/inline-overhaul/src/core/vault_module_bridge.js": require("../src/core/vault_module_bridge.js"),
  ".obsidian/plugins/inline-overhaul/src/features/command_registry.js": require("../src/features/command_registry.js"),
  ".obsidian/plugins/inline-overhaul/src/features/config_note_helpers.js": require("../src/features/config_note_helpers.js"),
  ".obsidian/plugins/inline-overhaul/src/features/config_note_orchestrator.js": require("../src/features/config_note_orchestrator.js"),
  ".obsidian/plugins/inline-overhaul/src/features/enhanced_select_all_engine.js": require("../src/features/enhanced_select_all_engine.js"),
  ".obsidian/plugins/inline-overhaul/src/features/rules_markdown_builder.js": require("../src/features/rules_markdown_builder.js"),
  ".obsidian/plugins/inline-overhaul/src/features/rules_sync_orchestrator.js": require("../src/features/rules_sync_orchestrator.js"),
  ".obsidian/plugins/inline-overhaul/src/features/store_events_orchestrator.js": require("../src/features/store_events_orchestrator.js"),
  ".obsidian/plugins/inline-overhaul/src/features/tagwheel_config_codec.js": require("../src/features/tagwheel_config_codec.js"),
  ".obsidian/plugins/inline-overhaul/src/features/tagwheel_config_codec_fallback.js": require("../src/features/tagwheel_config_codec_fallback.js"),
  ".obsidian/plugins/inline-overhaul/src/features/tagwheel_config_parser.js": require("../src/features/tagwheel_config_parser.js"),
  ".obsidian/plugins/inline-overhaul/src/features/transform_feature.js": require("../src/features/transform_feature.js"),
  ".obsidian/plugins/inline-overhaul/src/ui/tagwheel_scroller_overlay.js": require("../src/ui/tagwheel_scroller_overlay.js"),
}));

globalThis.__inlineOverhaulBundledVaultModules = bundledVaultModules;
globalThis.__inlineVaultModuleBridge = bundledVaultModules.get(".obsidian/plugins/inline-overhaul/src/core/vault_module_bridge.js");
for (const cacheKey of [
  "__pkmModuleCache",
  "__inlineOverhaulMainModuleCache",
  "__inlineOverhaulPkmV2ModuleCache",
  "__inlineOverhaulRuntimeModuleCache",
]) {
  if (globalThis[cacheKey] instanceof Map) globalThis[cacheKey].clear();
}

module.exports = require("../main.js");
