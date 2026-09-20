# PKM Config Contract Audit (Cycle A / S1-T01)

Date: 2026-04-18
Scope: Runtime + Settings + Migration contract review for production hardening.

## Contract Matrix

| Config key | Read in runtime | Written in runtime/migration | Exposed in UI | Status | Decision |
| --- | --- | --- | --- | --- | --- |
| `rules.tagWheelPath` | No (not used by active runtime path) | Yes (`migrateConfig`, compatibility shim) | Yes (`General -> TagWheel rules path`) | Contradictory / write-only for runtime | Keep migration-only shim, deprecate as runtime source in S1-T02 |
| `pkm.generatedRulesPath` | Yes (`rules sync`, active rules resolver) | Yes (`defaults + migrate`) | Yes (`PKM -> Active rules path`) | Valid source of truth | Keep as canonical rules path |
| `pkm.sourceOfTruth` | No | Yes (`migrateConfig` forced value) | No | Dead field | Remove from active schema in S1-T02 |
| `pkm.autoGenerateRules` | No | Yes (`migrateConfig` forced value) | No | Dead field | Remove from active schema in S1-T02 |
| `pkm.executionBackend` | No (runtime effectively hardwired to internal v2) | Yes (`defaults + migrate`) | Read-only text in UI | Legacy compatibility marker | Keep temporary as compatibility-only, plan deprecation after Cycle B |

## Ownership Rules (locked for Cycle A)

- Canonical generated rules path for PKM and navigation inline: `pkm.generatedRulesPath`.
- `rules.tagWheelPath` must not be treated as active runtime source.
- Backward-compat shim: if legacy config contains only `rules.tagWheelPath`, migration may copy it into `pkm.generatedRulesPath` under compat guards; runtime still reads only canonical path.
- Migration must remain backward compatible with existing `data.json` payloads.
- Any removed/deprecated key must be safely ignored on load and not required by runtime.

## S1-T02 Acceptance Targets

- No ambiguity between settings labels and actual runtime path resolution.
- No write-only fields left in active schema (except explicitly documented compatibility key).
- Existing user configs migrate without behavior drift.
