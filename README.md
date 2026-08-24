# Inline Overhaul

Inline Overhaul adds desktop Obsidian commands for inline-note navigation, PKM field and tag cycling, TagWheel editing, and opt-in inline-to-note transforms.

See the [visual showcase](showcase.md) for animated examples and the [setup and user guide](instructions.md) for installation, configuration, Transform safety, and troubleshooting.

> [!WARNING]
> This is a public beta. Back up your vault before installing or updating. Test important workflows on non-critical notes first.

## Requirements

- Obsidian desktop 1.13.0 or newer (the settings pane uses the declarative settings API added in 1.13)
- Desktop only; mobile is not supported

## Install with BRAT

1. Install and enable the BRAT community plugin.
2. In BRAT, choose **Add Beta plugin**.
3. Enter `romkuznetsov/inline-overhaul`.
4. Enable **Inline Overhaul** in Obsidian's Community plugins settings.

## Feature index

Every workflow below links to its matching animation in the [visual showcase](showcase.md). Command hotkeys are configurable in Obsidian; Enhanced Mod+A uses fixed `Ctrl/Cmd+A`.

### General

- [Open settings and module toggles](showcase.md#open-settings-and-module-toggles) — Open Inline Overhaul settings and guard Navigation, Tag & PKM, Visual, and Transform independently.
- [Settings undo/flush](showcase.md#settings-undoflush) — Undo the latest settings mutation or flush pending autosave immediately.
- [Diagnostics/developer logs](showcase.md#diagnosticsdeveloper-logs) — Inspect diagnostics and optional logs; logs may contain private note content.
- [Enhanced Ctrl+A](showcase.md#enhanced-ctrla) — Expand selection from the current line to its indentation tree and then the whole note.

### Navigation

- [Move lines/trees](showcase.md#move-linestrees) — Move the active line or indentation tree up and down without cut-and-paste.
- [Move selected inline text](showcase.md#move-selected-inline-text) — Shift selected inline text left or right within the current line.
- [Prefix cycle/indent fallback](showcase.md#prefix-cycleindent-fallback) — Cycle configured line prefixes, then apply the selected cycle-end or indentation policy.
- [Header jumps](showcase.md#header-jumps) — Jump between nearby Markdown headers from the editor.
- [Inline PKM zone navigation](showcase.md#inline-pkm-zone-navigation) — Move through configured inline PKM zones on the active line.

### Binder

- [Custom insertion commands](showcase.md#custom-insertion-commands) — Insert user-defined text through dedicated Binder commands.
- [Smart bracket](showcase.md#smart-bracket) — Insert or cycle context-aware bracket forms around text.

### PKM design/config

- [Field schema/order/panels](showcase.md#field-schemaorderpanels) — Define PKM fields, their order, and panel placement from settings.
- [Deep Editor hierarchy](showcase.md#deep-editor-hierarchy) — Edit nested field values and hierarchy in the Deep Editor.
- [Per-value prefixes/dependencies](showcase.md#per-value-prefixesdependencies) — Assign value-specific prefixes and dependency rules.
- [Generic elements/date/time/number](showcase.md#generic-elementsdatetimenumber) — Configure reusable generic, date, time, and number elements.
- [YAML field mapping](showcase.md#yaml-field-mapping) — Map inline PKM fields to YAML properties.
- [Separators/prefix resolver/cursor/free-roam policies](showcase.md#separatorsprefix-resolvercursorfree-roam-policies) — Control line separators, prefix resolution, cursor placement, and free-roam behavior.
- [Generate/apply portable Markdown config](showcase.md#generateapply-portable-markdown-config) — Open editable config or detailed template Markdown, then apply config in this or another vault.

### PKM runtime

- [Direct tag/link field cycle increase/decrease](showcase.md#direct-taglink-field-cycle-increasedecrease) — Cycle configured tag or link field values forward and backward from the editor.
- [Element increment/decrement](showcase.md#element-incrementdecrement) — Increase or decrease supported generic, date, time, and number elements.
- [TagWheel left/right/navigation/apply/cancel](showcase.md#tagwheel-leftrightnavigationapplycancel) — Open TagWheel, navigate fields and values, apply a choice, or cancel.

### Visual

- [Tag bubbles/per-value styles/separator colors](showcase.md#tag-bubblesper-value-stylesseparator-colors) — Style inline tags, individual values, and separators.
- [TagWheel panel/scroller](showcase.md#tagwheel-panelscroller) — Present TagWheel fields and values in a configurable scrolling panel.
- [Hierarchy Strip/token hiding](showcase.md#hierarchy-striptoken-hiding) — Show hierarchy context and optionally hide the configured Strip field token and its separator.

### Transform Inline2Note

- [Synthetic preview/opt-in](showcase.md#synthetic-previewopt-in) — Review the settings-only source-processing example before enabling the execution gate.
- [Current root or selected tree](showcase.md#current-root-or-selected-tree) — Transform the current root tree or an explicitly selected tree.
- [Templates/Smart Rules/auto-manual naming](showcase.md#templatessmart-rulesauto-manual-naming) — Route output through templates and Smart Rules with automatic or manual note names.
- [Collision/body/header policies](showcase.md#collisionbodyheader-policies) — Decide how existing targets, note bodies, and headers are handled.
- [YAML Raw/Clean mapping](showcase.md#yaml-rawclean-mapping) — Map recognized inline fields into template/target YAML using Raw or Clean values.
- [Source cleanup/link/processed token/sublines/open target](showcase.md#source-cleanuplinkprocessed-tokensublinesopen-target) — Configure source replacement, processed markers, subline handling, and target opening.

## Transform opt-in

The Transform module is enabled by default, but the Inline2Note execution gate is off by default. Enable that gate explicitly in **Settings → Inline Overhaul → Transform** before running `Transform: inline2note`. Review the preview, [full instructions](instructions.md), and backup policy before transforming production notes.

## Build and test

```powershell
npm install
npm run test:version
npm run build
npm run test:release
node --check dist/main.js
```

Release assets are written to `dist/`.

## Current beta limitations

- Flying button is unavailable.
- Special processed-token styling is unavailable; other Visual styling remains available.
- Obsidian-only manual cases, including clean-vault startup and Transform workflows, still require verification.
