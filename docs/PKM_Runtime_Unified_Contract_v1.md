# PKM Runtime Unified Contract v1

## Goal

Unify final output behavior between `cycle_*` commands (`status_tags`, `status_date`) and `tagwheel` apply path.

For equivalent input line, settings, selected target/value and direction, both paths must produce identical:

- final line string
- final cursor position

This contract applies to all free-roam modes: `off`, `minimal`, `full`.

## Unified Pipeline (required order)

1. Transition state (`next selected value` / `remove value` / `cycle end`).
2. Build intermediate line from selected state.
3. Apply prefix policy.
4. Apply separator policy.
5. Apply order relocation and dependent adjacency stabilization.
6. Apply cycle-end and empty-line policy.
7. Apply cursor policy and remap.

No runtime path may skip or reorder these stages.

## Prefix Policy

- `off`: preserve original source prefix shape (prefix-immutable contract).
  - heading remains heading (never rewritten to list/checkbox)
  - list/checkbox source keeps original shape
  - plain source must not synthesize list/checkbox prefix
- `minimal`:
  - `minimalPrefix = ON`: runtime may rewrite prefix to resolved prefix from selected state.
    - heading is immutable and must remain heading even when ON
    - when source has custom checkbox/list prefix, resolver checkbox must win for active selected token (no stale source checkbox carry-over)
    - source indent must be preserved when prefix is rewritten in minimal no-separator flow
  - `minimalPrefix = OFF`: preserve original prefix shape.
    - If raw has list/checkbox prefix, keep it.
    - If raw has no prefix, do not synthesize new list/checkbox prefix.
- `full`: use resolved prefix behavior; do not leave orphan checkbox/bullet lines.

## Separator Policy

- `minimalSeparator = ON`: keep segmented output (`left sep1 text sep2 right`) per current rules.
- `minimalSeparator = OFF`:
  - do not inject separators when raw line has none,
  - preserve existing separators if raw line already contains them,
  - no trailing synthetic separator remains.
- `full`: separator behavior follows full-placement logic and output normalization.
- universal topology invariant:
  - no duplicated trailing separator tokens (e.g. `:: ::` tail) unless explicitly required by non-empty structured slots
  - heading/text/date slot boundaries must remain stable (`left sep1 text sep2 right` when right payload exists)
  - if heading left slot becomes empty at cycle-end, separator is removed (`## :: text` must normalize to `## text`)

## Cycle-End / Empty Policy

- `keep-bullet`: keep bullet-only line by parsed prefix fallback logic.
- `clear-prefix`: remove line for empty terminal states according to runtime rules.
- On token removal at cycle-end, stale checkbox from previous token must not be restored.
- For minimal no-separator clear-step with field-owned checkbox, output must drop the stale checkbox but keep original list marker and indent.
- In `clear-prefix` mode, source-prefix stripping must not run when tagged payload still exists (line with tags/dates is not an empty terminal state).

## Combined Subtag Hydration Policy

- Combined subtag token (`#parent/sub`) hydration must be generic by `dependsOn` graph, not by canonical field ids.
- On re-activation, runtime must restore both parent and child selection from combined token for any valid custom parent/sub pair.
- Cycle and TagWheel paths must consume the same shared combined hydration/normalization APIs.

## Cursor Policy

Cursor parity is mandatory for:

- `text_end`
- `line_end`
- `current_position`

When equivalent actions are executed through `cycle_*` and `tagwheel`, cursor remap results must match.

Bootstrap rule:

- For first activation from empty/no-content source in `current_position` mode, cursor must bootstrap to text-end target position (not stale source index).

## Parity Matrix (minimum required)

### Dimensions

- Modes: `off`, `minimal`, `full`
- Source forms:
  - plain: `111`
  - list: `- 111`
  - checkbox-list: `- [ ] 111`
  - heading: `## 111`
- Actions:
- `cycle_field:<tagOrWikilinkOrderKey>`
  - `cycle_field:importance`
- `field_inc:<elementOrderKey>` / `field_dec:<elementOrderKey>`
  - equivalent `tagwheel` apply cases
- Behavior toggles:
  - `minimalPrefix`: ON/OFF
  - `minimalSeparator`: ON/OFF
  - `fullPlacement`: smart/left/right
  - `cycleEndBehavior`: keep-bullet/clear-prefix

### Mandatory assertions per case

- `line_cycle === line_tagwheel`
- `cursor_cycle === cursor_tagwheel`
- no orphan checkbox/bullet artifacts
- no duplicated separators

## Implementation Constraints

- Shared post-processing logic must live in one module and be reused by both paths.
- Path-specific code may differ only in transition-stage selection logic, not finalization policy.
- Off-mode right-panel relocation and dependsOn adjacency stabilization must delegate to shared core helpers (no local runtime-specific algorithms).
- OFF/full post-policy normalization (off-entry post-pass, full no-source collapse) must delegate to shared finalizer helpers.
- Mixed post-collapse + prefix immutability + final-line invariants should be applied through one shared post-finalize pipeline helper.
- Cycle-end post-processing and final-line invariants should be applied through one shared cycle-end pipeline helper.
- Regression tests should assert contract behavior, not fragile implementation strings.

## Done Gate for UNIFY series

UNIFY work is complete only when:

- unified contract is implemented for `off/minimal/full`,
- parity suite is green,
- legacy regression suites remain green,
- project-local manual smoke matrix confirms parity on key UX scenarios.
