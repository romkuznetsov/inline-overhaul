# core

Core domain layer placeholders for Sprint 0.

- schema
- migrations
- config_store.js (AC-RF1-003 extraction: ConfigStore lifecycle + undo/save wiring)
- config_migration.js (AC-RF1-006 PHASE-4 extraction: legacy-shape normalization layer for pkm config)
- line_pipeline.js (AC-RF1-008 extraction: shared split/assemble pipeline with strict leading-whitespace preservation contract)
- pkm_macro_shared.js (AC-RF1-009..015 extraction: shared macro postprocess/cursor/cycle + token/regex segment helpers for status modules and TagWheel)
- pkm_rules_runtime_helpers.js (AC-RF1-009..019 extraction: shared order parsing/apply + panel/order resolver + marker/segment reorder + token-key map + rules path/read fallback helpers)
- pkm_runtime_bootstrap.js (AC-RF1-021..026 extraction: shared runtime bootstrap loader for line/macro/rules modules, vault bridge loader, order-key fallback and order-config resolver)
- vault_module_bridge.js (AC-RF1-009 extraction: shared vault module loader bridge with unified cache policy)
- compat_profile.js (de-legacy transition: centralized compatibility flags and deprecated-config-key map)
- token_graph_unified.js (BUILD-ENGINE-P2: canonical token-fact extraction for unified hydrate/resolve paths)
- events
- shared_utils.js (phase-1 extraction: JSON/object/fence helpers + `nz`/`escapeRe` + date-format/tokenless/time helpers + custom increment progression helpers + date search-limit helper)

## Universal Order Engine v2 contract freeze (P0)

- Raw token identity is exact (`raw-exact`): runtime never transliterates or canonicalizes token content.
- Hydration conflict resolution is deterministic per field: last token occurrence in line order wins.
- Assembly order is driven only by active runtime `Order` data; no heuristic right-slot guessing.
- Panel (`left`/`right`) controls grouping/navigation UX only, not semantic token identity.
