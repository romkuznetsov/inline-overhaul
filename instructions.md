# Inline Overhaul: Setup and User Guide

Inline Overhaul is a desktop-only Obsidian beta plugin for structured inline notes. It combines line navigation, configurable PKM fields, TagWheel editing, visual token aids, reusable text-insertion commands, and an opt-in inline-to-note transform.

> [!WARNING]
> This is beta software. Back up the entire vault, including its `.obsidian` folder, before installation, updates, configuration imports, or Transform use. Test important workflows on disposable notes first. `Transform: inline2note` can create, append to, overwrite, and edit notes.

## Requirements

- Obsidian desktop 1.13.0 or newer (the settings pane uses the declarative settings API added in 1.13)
- Desktop vault; mobile is not supported
- BRAT community plugin for beta installation and updates
- A current vault backup

## Install, update, or uninstall with BRAT

### Install

1. In Obsidian, open **Settings → Community plugins**.
2. Install and enable **BRAT**.
3. Open BRAT and choose **Add Beta plugin**.
4. Enter `romkuznetsov/inline-overhaul`.
5. After BRAT downloads the release, open **Settings → Community plugins** and enable **Inline Overhaul**.

### Update

1. Back up the vault.
2. Use BRAT's update check for beta plugins, or wait for its configured update check.
3. Confirm that **Inline Overhaul** remains enabled after the reload.
4. Open a disposable note and run one familiar Navigation or PKM command before using production notes.

### Uninstall

1. Disable **Inline Overhaul** under **Settings → Community plugins**.
2. Remove Inline Overhaul from BRAT's tracked beta-plugin list so BRAT does not reinstall it.
3. Remove the plugin from Obsidian's installed community plugins.
4. Delete generated/config notes only if no other workflow uses them. Uninstalling the plugin does not require deleting user-authored notes.

## First run

1. Enable the plugin.
2. Open **Settings → Inline Overhaul**. You can also run **General: Open settings**.
3. In **General**, leave only modules you intend to test enabled.
4. Open **Tag & PKM → Main** and create at least one field if you plan to use PKM commands.
5. Choose separators and confirm the line preview.
6. Select **Open config** to generate or refresh the editable markdown config note.
7. Edit that note if needed, then select **Apply**.
8. Assign hotkeys in Obsidian's standard **Settings → Hotkeys** screen.
9. Leave **Inline2Note enabled** off until its output, naming, template, collision, and source-cleanup settings are reviewed.

On load, the plugin migrates saved settings and writes a generated rules note used by PKM and inline navigation. That generated rules note is derived output; do not treat it as the editable source of truth.

## Settings model

Settings tabs are **General**, **Hotkeys**, **Navigation**, **Tag & PKM**, **Visual**, **Transform**, and **Advanced**.

- Changes normally save automatically after a short debounce.
- **General: Undo last settings change** or the **Undo last settings change** button rolls back one saved-settings step. Undo history is session-local and limited.
- **Advanced → Flush Settings Now** forces an immediate save.
- A disabled module makes its tab read-only and guards its commands.
- **Advanced → Diagnostics** shows schema version, enabled modules, and last save time.
- **Developer Mode** can write troubleshooting logs to a vault-relative path. Keep it off unless diagnosing a problem; logs may contain note text involved in commands.

### Module toggles

Four global modules exist:

| Module | Purpose | Default |
|---|---|---|
| Navigation | Move lines/selections, cycle prefixes, jump through sections, navigate inline text | On |
| Tag & PKM | Field cycles, TagWheel, config generation/application | On |
| Visual | Tag bubbles, strips, TagWheel panel/scroller appearance | On |
| Transform | Hosts Transform commands/settings | On |

Transform has a second safety gate: **Inline2Note enabled** defaults to **Off**. Both the Transform module and Inline2Note must be enabled before transformation runs.

Each module also has an exact command-palette toggle:

- **General: Toggle Navigation module**
- **General: Toggle Tag & PKM module**
- **General: Toggle Visual module**
- **General: Toggle Transform module**

## Command reference

Command names below match the runtime registry.

### General

- **General: Open settings**
- **General: Undo last settings change**
- Four module-toggle commands listed above

### Navigation

- **Navigation: Move Up**
- **Navigation: Move Down**
- **Navigation: Move Left**
- **Navigation: Move Right**
- **Navigation: Jump Header Up**
- **Navigation: Jump Header Down**
- **Navigation: Inline Left**
- **Navigation: Inline Right**

### Tag & PKM

- **PKM: TagWheel left**
- **PKM: TagWheel right**
- Two commands per configured field: **PKM: `<name_strict>` increase** and **PKM: `<name_strict>` decrease**
- Tag subtags use the generated strict label ending in `-sub`.

Because field commands are generated from current Order configuration, their names are not a fixed built-in list. Adding a field in settings registers its increase/decrease commands immediately. Changes made through config Apply, plus field renames and deletions, require a plugin reload to refresh the command registry. Until reload, obsolete commands may remain visible.

### Config

- **Config: Apply TagWheel config**
- **Config: Open TagWheel template**

The **Open config** action exists in **Tag & PKM → Main** settings; it is not registered as a separate command-palette command.

### Transform

- **Transform: inline2note**

### Binder

- **Binder: Smart bracket**
- User-created commands named **Binder: `<command name>`** or, when no command name was supplied, **Binder: `<insert text>`**

## Navigation features

### Move lines and trees

**Navigation: Move Up/Down** moves selected full lines. With no selection, **No-selection mode** chooses between only the current line and the current line plus indentation-based children. Header handling can move only the header line or its entire section. **Cross-section allowed** controls whether movement crosses headers. **Highlight moved lines** selects normalized moved lines afterward.

Copyable example:

```markdown
## Planning
- Parent
  - Child A
  - Child B
- Sibling
```

With the cursor on `- Parent` and **with-children**, Move Down moves the parent and both children as one tree.

### Move inline text, cycle prefixes, and indent

**Navigation: Move Left/Right** has two roles:

- With a partial single-line selection, move text by character or token according to **Inline move mode**.
- At line level, cycle configured prefixes at indentation level 0; when no cycle applies, optionally fall back to indentation using Obsidian's global **Tab width**.

Default prefix cycle (list markers include their normal following space):

```markdown
#
##
###
####
#####
1.

-
```

The blank entry represents a plain line. Right follows the list; Left mirrors it. At the final entry, **On cycle end** either increases indentation or wraps to the first prefix.

### Jump between headers

**Navigation: Jump Header Up/Down** can:

- jump between section edges or move line-by-line;
- use start/end, start-only, or end-only edge behavior;
- place the cursor at line start, line end, or active text end before the separator zone;
- center the target in the viewport.

The line-start target is immediately after the structural prefix, such as indentation, list marker, or checkbox—not column 0.

### Navigate within inline text

**Navigation: Inline Left/Right** uses the active generated PKM rules and separators. Step mode can move by word, sentence, or directly between zone boundaries. Separator crossing can be strict or allowed. At a boundary, navigation can stay, wrap, or continue on the next/previous line.

Inline navigation is currently reliable when both boundaries use the same separator. A distinct **Separator 2** is supported by the line model but may produce incorrect inline boundary navigation; test that configuration on disposable text before relying on it.

### Enhanced Ctrl/Cmd+A

Under **Hotkeys → Global**, **Enhanced Mod+A** replaces ordinary selection expansion with one of these repeated-press sequences:

- line → whole note;
- line → indentation tree → whole note;
- line → indentation tree → current header section → whole note.

It can infer the next scope from the current selection or use a 250–2000 ms multi-press timer. Optional final press clears the selection and restores the cycle-origin cursor.

## Tag & PKM

### Inline line model

PKM lines can contain a left panel, text payload, and right panel:

```markdown
- [ ] #priority-high #task :: Draft release notes :: [[Project Atlas]] 📅2026-09-15
```

- **Separator 1** divides left fields from text.
- **Separator 2** divides text from right fields.
- Both separators are configurable and may be identical.
- Order determines token placement and sorting inside each panel.

When a panel is empty, runtime normalization may omit its separator. Use the live preview in settings to check the exact shape produced by current configuration.

### Order and panels

**Tag & PKM → Main → Order** is the primary field editor.

- Add a field as `tag`, `link`, or `element`.
- Drag a field within or between Left and Right panels.
- Tag parent/subtag rows move together.
- `name_strict` is the stable runtime/config key; `name_display` is only the UI label.
- Assign a vault YAML property to each field.
- Set **Active** to `yes`, `no`, or `hotkey_only`.
- Set **Free roam** per field to `off`, `minimal`, or `full`.
- Enable a generated subtag lane for tag fields.
- Delete removes the field and related configuration after confirmation.

`name_strict` accepts letters, numbers, underscores, hyphens, and spaces. Names ending in `_sub` are reserved for generated child fields.

**Order Deep Editor** exposes field values and detailed behavior. It supports local undo/redo history and validates the draft. Deep Editor changes are already live in plugin settings while the editor is open. If markdown config Apply detects a Deep Editor conflict, **Discard** and **Cancel** do not roll settings back to their pre-editor state. Use settings undo or restore a backup if you must recover earlier settings.

### Tag fields and subtags

Tag fields cycle through configured values. Example values:

```markdown
#task
#idea
#reference
```

Subtags may depend on a parent and may be allowed only for selected parent values. Output format is global:

```markdown
#task #research
```

or:

```markdown
#task/research
```

Choose **Subtag format → separate** or **combined**. Hotkey cycles and TagWheel share this setting.

### Wikilink fields

Wikilink fields cycle configured note names and render them as links:

```markdown
[[Project Atlas]]
[[Project Borealis]]
```

They use the same Order, panel, Active, Free roam, hotkey, and YAML workflows as other fields. Wikilink fields do not receive tag-only token visuals or Strip visualization.

### Elements, date, and time

An element is a generic marker-plus-value field. Date and time are configurations of this generic field type, not separate hardcoded field classes.

Copyable examples:

```markdown
📅2026-09-15
🕒14:30
⏳45
```

In Deep Editor, configure:

- one marker/emoji per field;
- output **Format**, such as `YYYY-MM-DD`, `HH:mm`, or `000-000`;
- **Increment by X** for numeric/date-time stepping;
- **Command Y**: `now`, `randomN`, or `randomE`;
- **Custom increment** sequence.

`now` renders current date/time through the configured format. `randomN` fills numeric format positions with digits. `randomE` fills format positions with random characters/elements. Custom increment rows accept a step and optional repeat count; `END` removes the element at cycle end.

Example custom sequence entered one row per line:

```text
1 (3)
5
END
```

This applies `1` for three presses, then `5`; `END` marks cycle removal.

### Active and Free roam behavior

- `yes`: field participates normally.
- `no`: field is excluded from PKM cycle and TagWheel behavior. Transform can still recognize its exact configured tokens for mapping and cleanup.
- `hotkey_only`: field remains available through its generated command without normal TagWheel participation.
- `off`: normal configured prefix/placement rules apply.
- `minimal`: insert according to Order with optional separators and optional tag-specific prefix replacement.
- `full`: allows insertion away from the normal prefix zone; placement inside text can be Smart, Left, or Right.

Global behavior settings control whether minimal mode inserts separators, whether minimal/off modes rewrite prefixes, and where full mode places an element.

### Cycle behavior and cursor

Every active field has increase/decrease commands. Cycling can add a value, replace it with the next/previous value, or remove it at the terminal state.

**Line prefix after end of cycle**:

- **Keep bullet** preserves `- ` on an otherwise empty result.
- **Clear line** removes the empty prefix-only line.

**Cursor behavior**:

- `text_end`: end of text slot before the right separator; recommended.
- `current_position`: remap near the pre-command cursor.
- `line_end`: end of final line.

### TagWheel

Run **PKM: TagWheel left** or **PKM: TagWheel right** to start in a panel. Runtime field order and dependencies come from Order. Default interaction keys are:

| Key | Action |
|---|---|
| Left/Right arrow | Previous/next field |
| Up/Down arrow | Previous/next value |
| Tab | Switch panel/mode |
| Enter | Apply |
| Escape | Cancel |

TagWheel and direct increase/decrease commands use the same field, ordering, prefix, separator, subtag, cycle-end, and cursor rules.

Optional **Visual → TagWheel → TagWheel Scroller** shows nearby values above editor text. Set direction to `up`, `down`, or `full`, and visible size from 1 to 20 items per side.

### Prefix resolver

Prefix Resolver chooses a line checkbox/prefix when multiple configured values could supply one.

- **Main checkbox priority**: resolve by field order or explicit checkbox order.
- **Fields order mode**: automatic or manual when field priority is selected.
- **Tag/Subtag priority**: parent tag wins or subtag wins.
- Drag field and checkbox rows to set priority.

Example configured outcomes:

```markdown
- [ ] #task :: Write draft
- [I] #idea :: Explore alternate layout
- [R] #research #source-a :: Verify claim
```

Actual checkbox tokens are user configuration; these examples are synthetic.

### YAML mapping

Each Order field can map to a YAML property. Deep Editor can override the property for individual values. Subtag values can use their own property, then field property, then parent property. YAML property suggestions are discovered from frontmatter already present in the vault.

Transform uses these mappings. Example template frontmatter:

```markdown
---
status: draft
projects: []
due: ""
---

# Note body
```

For a matching inline line, Transform updates mapped top-level keys, preserves unrelated template keys and ordering, and appends missing mapped keys in Order sequence. Repeated values for a list-capable/shared property are deduplicated. Invalid or duplicate top-level YAML keys stop the transform rather than silently rewriting ambiguous data.

Preservation is intentionally limited. JSON-quoted scalars and inline arrays receive only limited handling; do not assume exact lexical preservation after replacement. Mapped multiline values and their comments may be replaced rather than preserved. Missing token-only keys are appended after keys produced from field Order. This merger is not a full YAML parser or validator; verify complex frontmatter on disposable notes.

**YAML note format** in Transform controls values:

- `Raw`: retain tag or wikilink syntax, for example `#task` or `[[Project Atlas]]`.
- `Clean`: store normalized values, for example `task` or `Project Atlas`.

Element markers are removed from YAML values in both modes. Clean numeric priority-like tokens are written as numbers when recognized.

### Config Generate/Apply workflow

Use the markdown config note as a portable editing surface:

1. Configure initial fields in **Tag & PKM → Main**.
2. Choose **Config Export Mode**:
   - `detailed`: full instructions and configuration;
   - `minimal`: settings and key alerts only.
3. Select **Open config**. The plugin creates or refreshes the configured markdown note from current plugin settings and opens it.
4. Edit the generated user-editable sections.
5. Select **Apply** in settings or run **Config: Apply TagWheel config**.
6. Confirm the success notice, then test TagWheel and one direct field command.

Important direction:

```text
Plugin settings --Open config--> editable markdown config
Editable markdown config --Apply--> plugin settings --> generated runtime rules
```

Opening the config can refresh its content from current settings. Keep a backup before replacing extensive manual edits. Applying records a small internal history of recent config-apply timestamps, but this is not a full vault-content backup or a user-facing restore system.

#### Portability

- All documented config/template/output/log paths are vault-relative.
- Copy the editable config markdown into the destination vault, not the auto-generated runtime rules note.
- Install and enable the same plugin version in the destination vault.
- Place the config at the configured config-note path, open **Tag & PKM**, then Apply.
- Copy referenced Transform templates separately and preserve their vault-relative paths.
- Reassign hotkeys in the destination vault; Obsidian owns hotkey bindings outside the portable config note.
- Review YAML property names against the destination vault before Transform use.

## Binder

Binder turns small text snippets into Obsidian commands.

1. Open **Settings → Inline Overhaul → Hotkeys → Binder**.
2. Enter an insert token, optional command name, and optional description.
3. Select **Add row**.
4. Open Obsidian **Settings → Hotkeys** and bind the new **Binder: ...** command.

Running a normal Binder command replaces the current selection or inserts at the cursor, then places the cursor after inserted text. Rows can be reordered or deleted. After creation, insert text and command name are read-only; delete and recreate a row to change them. Description remains editable.

Reload the plugin after deleting or recreating Binder rows. Commands are not unregistered during the session, so stale Binder commands may remain visible until reload.

### Smart bracket

**Binder: Smart bracket** cycles bracket forms around a selection:

```markdown
text
[text]
[[text]]
text
```

Without a selection, it inserts or transforms bracket pairs around the cursor so you can continue typing inside them. Unmatched `[` or `[[` input is a known limitation and may transform unexpectedly; test Smart bracket on disposable text before using it near important content.

## Visual features

General Visual functionality is implemented and separate from Transform's disabled processed-token styling.

### Tags

- Independent left/right panel opacity
- Tag text size
- Bubble width and height
- Empty-bubble size
- Rounded-to-square shape
- Per-field/per-tag fill color, text color, visibility, and optional custom display text in Order Deep Editor
- Separator text colors

These are editor decorations: they change display, not stored markdown tokens.

### Strip

Strip visualization draws up to three colored rails for a selected tag field's parent/child hierarchy. Configure field, tag visibility, optional separator hiding when a hidden strip token is the only technical token, default/crossing mode, rail count, thickness, parent/child distance, and text spacing.

### TagWheel panel and scroller

- Show/hide token prefixes visually
- Default placeholder text color
- Panel fill color
- Optional nearby-value scroller with direction and size controls

## Transform: Inline2Note

> [!CAUTION]
> Inline2Note is explicit opt-in and defaults to Off. Enable it only after backing up the vault and reviewing every setting below.

### Destructive defaults on first enable

Before first use, review these initial defaults:

- **Replace payload with note link:** on (`true`)
- **Source cleanup keep-list:** empty; all recognized fields are removed from source
- **Processed token:** `#processed`, placed in the Right panel
- **Sublines behavior:** Stay
- **Name collision:** `new_note` (create a new note, adding a suffix when needed)
- **YAML note format:** Raw
- **Template body placement:** end
- **Inserted block header:** current datetime
- **Open transformed note:** off; target does not auto-open

These defaults can rewrite the source line and create a target note. Use disposable text until preview and output match your workflow.

### Enable and prepare

1. Keep the global **Transform module** enabled.
2. Open **Settings → Inline Overhaul → Transform**.
3. Turn on **Inline2Note enabled**.
4. Set a templates folder if using templates.
5. Set an output folder, or leave it empty to use the current note's folder.
6. Select a default template or leave it blank.
7. Review naming, collisions, placement, YAML, source cleanup, processed token, sublines, and open-note settings.
8. Use the live Before/After preview.
9. Test **Transform: inline2note** on a disposable line.

### Templates and body placement

Templates are markdown files found inside the configured vault folder. A template may contain frontmatter and body text.

```markdown
---
kind: transformed
status: inbox
---

# Working note

## Context
```

For new/overwrite operations, transformed source content is inserted at the beginning or end of the template body. The inserted block header can be:

- custom text;
- current datetime formatted with `YYYY`, `MM`, `DD`, `HH`, `mm`, and `ss`;
- none.

Source indentation common to the root block is removed in the target note while internal parent/child indentation is preserved.

### SmartTransform rules

A smart rule routes a source line to a template based on tags, element markers, and wikilinks.

- Values within one condition group use OR matching.
- Non-empty groups on the same rule all must match.
- Rules are checked in order; first matching enabled rule with a target template wins.
- If no rule matches, the default template is used.
- A rule with no conditions is disabled.
- Rules whose conditions can overlap are marked conflicting and auto-disabled.

Synthetic source:

```markdown
- [ ] #meeting :: Review roadmap :: [[Project Atlas]] 📅2026-09-15
```

Possible rule:

```text
Tags: #meeting
Wikilinks: [[Project Atlas]]
Target template: Templates/Meeting.md
```

### Note naming

**Auto** naming priority:

1. First non-empty text inside configured explicit delimiters, excluding wikilinks and checkbox syntax.
2. Markdown header title when **prefer header title** is active.
3. First configured number of payload words.

Example:

```markdown
- [ ] #task :: [Release checklist] Verify package and notes
```

With delimiters `[]`, title becomes `Release checklist`.

**Manual** mode opens an **Inline2Note: note title** dialog. Cancel or Escape leaves source and target unchanged. File-system-invalid title characters are replaced with spaces before path creation.

### Name collisions

- **New note (+suffix)**: create a new note; if the base name exists, try `-01`, `-02`, and so on.
- **Add to note**: append the selected/root block to the existing note under a generated datetime header. Existing template body/frontmatter is not regenerated for this append.
- **Overwrite**: replace the existing target with newly composed template, merged YAML, and transformed body.

### YAML merge

For new notes and overwrite mode, Transform:

1. reads template frontmatter;
2. maps recognized inline fields through Order YAML settings;
3. replaces matching top-level values while preserving unrelated keys;
4. appends missing mapped keys in Order sequence;
5. writes merged frontmatter before the body.

Transform recognizes exact configured values in their configured panel. Tokens in the wrong panel or payload zone, and aliased or heading wikilinks such as `[[Note|Alias]]` or `[[Note#Heading]]`, may be ignored. A dependent child is included only when its parent is also recognized. In **Add to note** mode, existing note frontmatter is left unchanged because content is appended rather than recomposed.

### Source cleanup and link replacement

Source editing occurs only after target creation/update succeeds.

- In **Source cleanup fields**, checked fields are **kept** in source.
- Unchecked recognized fields are removed from source.
- Indentation is preserved.
- Empty technical zones and dangling separators are normalized.
- **Replace payload with note link** replaces the first payload segment with a link to the actual created target path.
- If replacement is off, original payload remains.

Before:

```markdown
- [ ] #task #research :: Draft release checklist :: [[Project Atlas]] 📅2026-09-15
```

Possible result when `#task` is kept, other recognized fields are removed, link replacement is on, and processed token is placed right:

```markdown
- [ ] #task :: [[Notes/Release checklist]] :: #processed
```

Exact output follows configured field recognition, panels, prefix resolver, separators, and output folder.

### Processed token

After a successful transform, an optional token is inserted in the configured Left or Right panel. Empty value disables insertion. Existing identical token is not duplicated.

```markdown
#processed
```

Token insertion is implemented. Special visual styling for processed source lines is not implemented in this beta; the token remains ordinary markdown and may still receive normal tag visuals.

### Selection and parent/child behavior

- No selection: current line is root; following more-indented descendants and intervening blank lines form its block.
- Selection: partial selections expand to full lines; the first nonblank selected line becomes root; descendants after the selected end are included until indentation returns to root level.
- Target note receives the full derived block.
- **Sublines behavior → Stay** edits only the source root; descendants remain in source.
- **Sublines behavior → Remove** replaces the full source block with the processed root, moving descendants into the target note.

Example tree:

```markdown
- Parent task
  - Child A
  - Child B
- Next task
```

Running Transform on `Parent task` includes both children but not `Next task`.

### Transaction and recovery semantics

Transform verifies that the active editor and source block did not change before writing. If target mutation succeeds but source editing fails, it attempts to roll back only the target mutation. It cannot guarantee restoration of source text after a partial editor mutation. If source editing and target rollback both fail, the error notice reports both failures. Always keep a real vault backup; transactional rollback is not a substitute for one.

### Open transformed note

When enabled, the plugin makes a best-effort attempt to open the created or updated target in a new leaf after the transaction completes. Failure to open the note does not roll back the completed transform; open the target manually and verify both notes.

## Hotkeys

Inline Overhaul does not assign default bindings for its command-palette commands. Use **Settings → Hotkeys**, search for the exact command name, and assign your preferred keys.

Recommended setup pattern:

| Workflow | Suggested binding strategy |
|---|---|
| Navigation | Arrow-like combinations that do not conflict with editor defaults |
| Field increase/decrease | Paired keys per field |
| TagWheel | One key for Left and one for Right |
| Binder | Mnemonic keys for frequently inserted tokens |
| Transform | Deliberate multi-key binding to avoid accidental execution |

Do not bind Transform to a single easy-to-press key during beta testing.

## Troubleshooting and recovery

### Command says module is disabled

Open **General** and enable the named module. For Inline2Note, also enable **Transform → Inline2Note enabled**.

### PKM command is missing

1. Confirm the field exists in Order and has a valid unique `name_strict`.
2. Confirm Tag & PKM module is enabled.
3. Search Obsidian Hotkeys for `PKM:` and the strict field name.
4. If the field came from config Apply, or was renamed or deleted, disable and re-enable Inline Overhaul or reload Obsidian to refresh the command registry.
5. Apply the markdown config if it was edited outside settings.

Adding a field directly in settings registers its commands immediately. Registry changes from config Apply, field rename/delete, or Binder delete/recreate need plugin disable/re-enable or Obsidian reload. Stale commands may remain until that reload.

### TagWheel or inline navigation uses stale values

1. Apply the editable config note.
2. In **Advanced**, confirm **Active Rules Path** is a non-empty vault-relative path.
3. Select **Regenerate Rules Now**.
4. Disable and re-enable Inline Overhaul.

Do not manually edit the generated rules note; it is rewritten from plugin settings.

### Config Apply fails

- Read the error notice; validation is intentionally fail-fast for ambiguous field bindings and malformed configuration.
- Restore the last known-good config note from vault backup/version history.
- Reopen settings and use **Open config** to regenerate a fresh note from current plugin settings.
- Reapply changes in small batches.

### Settings changed unexpectedly

- Immediately run **General: Undo last settings change**.
- Use **Advanced → Flush Settings Now** after restoring the intended state.
- If reopening a config note would overwrite useful manual edits, copy that note first.

### Transform created the wrong result

1. Stop transforming further lines.
2. Use Obsidian undo for the source edit when still available.
3. Restore affected source/target notes from backup or version history.
4. Check collision mode, source cleanup checkboxes, payload-link replacement, sublines behavior, YAML format, separators, and template.
5. Reproduce on a disposable synthetic line before retrying production content.

### Missing template or empty payload

Transform stops before target mutation when a selected template cannot be read or source payload is empty. Correct the vault-relative template path or use a line with text in the configured payload zone.

### Startup or runtime failure

1. Disable Inline Overhaul.
2. Restart Obsidian.
3. Update through BRAT.
4. Re-enable the plugin and test a disposable note.
5. If failure persists, enable Developer Mode only long enough to reproduce it, then review logs for private note content before sharing them.

## Beta limitations

### Disabled, not implemented for use

- **Flying button**: setting is disabled. Run **Transform: inline2note** from command palette or a hotkey.
- **Processed-token visual styling**: config normalization exists, but no user-facing control or runtime decoration applies special color/opacity to transformed source lines. Processed-token insertion itself works.

### Implemented but still beta

- BRAT clean-vault startup and Obsidian-only command workflows still require broader manual verification across environments.
- Transform performs real note mutations; behavior is automated-tested but still requires user verification with each vault's templates, YAML, and field taxonomy.
- General Visual features—tag bubbles, strips, separator colors, and TagWheel panel/scroller appearance—are implemented. They are not the disabled processed-token styling feature.

## Safe copyable test

Use synthetic notes, tags, links, and dates:

```markdown
## Inline Overhaul sandbox

- [ ] #task #research :: Draft a synthetic release checklist :: [[Project Atlas]] 📅2026-09-15
  - Verify package
  - Verify guide

- [I] #idea :: Compare two fictional layouts :: [[Project Borealis]]
```

Test one feature at a time, compare stored markdown before/after, then restore the sandbox from backup before testing the next destructive configuration.
