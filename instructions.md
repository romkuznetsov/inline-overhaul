# inlineOverhaul: Setup and User Guide

inlineOverhaul is a desktop-only Obsidian beta plugin for structured inline notes. It combines line navigation, configurable PKM fields, TagWheel editing, visual token aids, reusable text-insertion commands, and an opt-in inline-to-note transform.

> [!WARNING]
> This is beta software. Back up the entire vault, including its `.obsidian` folder, before installation, updates, configuration imports, or Transform use. Test important workflows on disposable notes first. **Transform inline to note** can create, append to, overwrite, and edit notes.

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
5. After BRAT downloads the release, open **Settings → Community plugins** and enable **inlineOverhaul**.

### Update

1. Back up the vault.
2. Use BRAT's update check for beta plugins, or wait for its configured update check.
3. Confirm that **inlineOverhaul** remains enabled after the reload.
4. Open a disposable note and run one familiar Navigation or PKM command before using production notes.

### Uninstall

1. Disable **inlineOverhaul** under **Settings → Community plugins**.
2. Remove inlineOverhaul from BRAT's tracked beta-plugin list so BRAT does not reinstall it.
3. Remove the plugin from Obsidian's installed community plugins.
4. Delete the note the plugin generated for itself, and any settings backups you no longer want. Uninstalling the plugin does not require deleting notes you wrote yourself.

## First run

1. Enable the plugin.
2. Open **Settings → inlineOverhaul**.
3. In **General**, leave only modules you intend to test enabled.
4. Open **Tags & PKM → Fields**. A fresh install already has four: `Status` and
   `Priority` before your text, `Due` and `Project` after it. Change them, delete what
   you do not need, or add your own. They come with a fresh install only, and
   **Advanced → Backup → Start over** does not bring them back.
5. Choose Separators and confirm the live preview.
6. Assign hotkeys in Obsidian's standard **Settings → Hotkeys** screen. **Keyboard → Commands & Hotkeys** lists every command with the key it has now and takes you there.
7. Leave **Transform inline to note** off until its output, naming, template, collision, and source-cleanup settings are reviewed.
8. Once the setup works, save it: **Advanced → Backup → Save a backup** writes everything you have set up into a note in your vault.

On load, the plugin migrates saved settings and writes a generated rules note used by PKM and inline navigation. That generated rules note is derived output; do not treat it as the editable source of truth.

## Settings model

Settings areas are **General**, **Keyboard**, **Navigation**, **Tags & PKM**, **Visual**, **Transform**, and **Advanced**. There are no sub-tabs and no visibility toggles: every setting of an area is on one page, and Obsidian's own settings search finds it by name.

- Changes normally save automatically after a short debounce.
- **Undo last settings change** rolls back one saved-settings step. It is a command only: run it from the command palette or give it a key. Undo history is session-local and limited.
- A disabled module makes its area read-only and guards its commands.
- **Advanced → Diagnostics** shows schema version, enabled modules, and last save time.
- **Developer mode** can write troubleshooting logs to a vault-relative path. Keep it off unless diagnosing a problem; logs may contain note text involved in commands.

### The words the panel uses

**General → Language** decides what language the panel speaks. Every visible line has a key of its own, and the words behind those keys live in plain text files inside the plugin folder, one file per language:

```
<your vault>/.obsidian/plugins/inline-overhaul/texts/default.js
```

That is the only file the plugin puts there. Every other file in that folder is one you
made, and the plugin never touches it.

Left of the colon is the key, right of it is what you see on screen. Edit a line, reload the plugin, and the panel says what you wrote — the English wording included, so rewording a setting is no longer something you have to ask for.

- **`default.js` belongs to the plugin and is always current.** Every update rewrites it, so a new setting, a new window and a reworded line show up there on their own. Do not edit it: copy it instead. There is no English file of your own unless you make one — an English snapshot that is never rewritten would freeze every later rewording, because a file on disk is read before the wording built into the panel.
- **Your file is never overwritten.** The plugin writes a language file only when there is none, so your edits survive an update. A file it wrote and nobody changed is kept in step; the moment you change one line in it, it becomes yours and the plugin stops touching it.
- **A line you leave out falls back.** A key that is missing, or left empty, keeps the wording the plugin ships with, and so does a whole file that fails to load. You never see a key instead of a text.
- **The file is read as JSON**, so keep it plain: no comments between the braces, and no comma after the last line. A file the plugin cannot read is named in a notice, and the panel opens in English.
- **To add a language**, copy one of the files under a new name and change its first line, `"$language"`, to the name of that language. It appears in the list on its own; nothing has to be registered anywhere.
- **Command names stay in English.** Obsidian takes those from its own command registry, so translating them here would leave the command palette and the reference table disagreeing.

### Module toggles

Four global modules exist:

| Module | Purpose | Default |
|---|---|---|
| Navigation | Move lines/selections, cycle prefixes, jump through sections, navigate inline text | On |
| Tags & PKM | Field cycles, TagWheel, Fields and Values | On |
| Visual | Tag bubbles, Tag Bars, TagWheel panel and scroller appearance | On |
| Transform | Hosts Transform commands/settings | On |

Transform has a second safety gate: **Transform inline to note** defaults to **Off**. Both the Transform module and that setting must be on before transformation runs.

Each module also has an exact command-palette toggle:

- **Toggle Navigation module**
- **Toggle PKM module**
- **Toggle Visual module**
- **Toggle Transform module**

## Commands & Hotkeys

The plugin shows this list itself, and there it also shows the key each command has now: **Keyboard → Commands & Hotkeys**. Clicking a key takes you to Obsidian's Hotkeys screen with that command already found. The list below repeats it for reading offline.

> [!WARNING]
> **Command identifiers changed.** Obsidian binds hotkeys to a command's identifier, not to its name, so every key you had assigned to an inlineOverhaul command stopped working after the update to this version. Reassign them under **Settings → Hotkeys**. The full old-to-new map is in [`docs/command_ids_v1_v2.md`](docs/command_ids_v1_v2.md), and the plugin prints it once to the developer console.

### Navigation

- **Move line up**
- **Move line down**
- **Move left**
- **Move right**
- **Jump back**
- **Jump next**
- **Move cursor left in line**
- **Move cursor right in line**

### Tags & PKM

- **Open TagWheel on the left**
- **Open TagWheel on the right**
- Two commands per configured Field, named after it: **`<Field>` next** and **`<Field>` previous**
- A child Field uses its parent's name with `-sub` appended.

Because Field commands are generated from your current Fields, their names are not a fixed built-in list. Adding a Field in settings registers its pair of commands immediately. Field renames and deletions, and restoring a settings backup, require a plugin reload to refresh the command registry. Until reload, obsolete commands may remain visible.

### Transform

- **Transform inline to note**

### Binder

- **Smart bracket**
- One command per row you add under **Keyboard → Binder**, named after the row

### General

- **Undo last settings change**
- Four module-toggle commands listed above

## Navigation features

### Move lines and trees

**Move line up** and **Move line down** move selected full lines. With no selection, **No-selection mode** chooses between only the current line and the current line plus indentation-based children. Header handling can move only the header line or its entire section. **Cross-section allowed** controls whether movement crosses headers. **Highlight moved lines** selects normalized moved lines afterward.

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

**Move left** and **Move right** have two roles:

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

**Jump back** and **Jump next** can:

- jump between section edges or move line-by-line;
- use start/end, start-only, or end-only edge behavior;
- place the cursor at line start, line end, or active text end before the separator zone;
- center the target in the viewport.

The line-start target is immediately after the structural prefix, such as indentation, list marker, or checkbox, and not column 0.

### Navigate within inline text

**Move cursor left in line** and **Move cursor right in line** use the active generated PKM rules and Separators. Step mode can move by word, sentence, or directly between zone boundaries. Separator crossing can be strict or allowed. At a boundary, navigation can stay, wrap, or continue on the next/previous line.

Inline navigation is currently reliable when both boundaries use the same separator. A distinct **Separator 2** is supported by the line model but may produce incorrect inline boundary navigation; test that configuration on disposable text before relying on it.

### Expanded 'Ctrl/Cmd+A'

Under **Keyboard → Expanded 'Ctrl+A'**, this setting replaces ordinary selection expansion with one of these repeated-press sequences:

- line → whole note;
- line → indentation tree → whole note;
- line → indentation tree → current header section → whole note;
- word → line → indentation tree → current header section → whole note;
- `Custom`: the steps you tick, in the order above.

**Word** is the word nearest the cursor: the one it stands in or beside, and otherwise the closest, with the left one taken when both are equally far. A line with no word in it skips the step rather than selecting nothing.

Picking `Custom` opens a list of five tick boxes — `word`, `line`, `tree`, `heading`, `note` — under the sequence. The ticks choose which steps a press stops at; the order is always the one shown above. Tick nothing and the key belongs to Obsidian again: one press, the whole note.

It can infer the next scope from the current selection or use a 250–2000 ms multi-press timer. Optional final press clears the selection and restores the cycle-origin cursor.

### Smart Delete\Backspace

Under **Keyboard → Smart Delete\Backspace**, `Del` at the end of a line stops dragging the next line up as it is written. The indent goes, and so do the bullet, the checkbox, the number, the quote mark and the heading marks, so what lands after your cursor is the text. A line that holds nothing but a Prefix is removed whole, which is how a run of empty bullets clears one press at a time.

`Smart backspace` is the same thing from the other side: `Backspace` at the start of a line sends that line up to the one above without its own indent and Prefix, while the line above keeps the way it is written. It has a switch of its own and answers to nobody — `Smart Delete` can stay off while this one works, and the other way round.

Two more toggles belong to both keys. `Drop the line Prefix` off leaves the Prefix and removes only the indent. `Join with a space` puts one space at the joint, and only when both sides have something on them.

Both keys are **off** by default: `Del` and `Backspace` belong to Obsidian, and until you turn one on the key does exactly what it always did. Everywhere except the end of a line for `Del` and the start of one for `Backspace` — with a selection, or with more than one cursor — the keys are untouched.

### Where the view goes when a line moves

Under **Navigation → Moving lines**, `Follow the moved line` decides whether the note scrolls after a move at all, and `Where the line lands` decides where the line ends up: the center, the top or the bottom of the screen. Before this the note scrolled by whatever the editor thought was nearest, so one press centered the line and the next threw it to the top. Turn the toggle off and the view does not move at all, which also means a line pushed past the edge goes on moving out of sight.

### Where the view goes when you jump to a heading

Under **Navigation → Moving cursor inside a note**, `Follow the jump target` decides whether the note scrolls after a jump at all, and `Where the target lands` decides where the line you jumped to ends up: the center, the top or the bottom of the screen. It is the same pair `Moving lines` has, and it works the same way.

### The edge of a Block in TagWheel

Under **Visual → TagWheel**, `TagWheel navigation behavior` decides what the arrow keys do when there is no next Field on the side you are on. `Stay in the same Block` is the way it has always worked: past the last Field you land back on the first. `Move to the next Block` makes the two Blocks into one ring, so stepping off the end of one takes you to the near end of the other. `Tab` switches Blocks either way.

### The shape of the text cursor

Under **Visual → Text cursor**, `Color the text cursor` gives the caret a color of its own, and `Shape the text cursor` sets how thick it is and how fast it blinks. The two are separate switches and neither needs the other. `Blink speed` runs from `0`, where the caret stops blinking and simply stays put, to `10`; `5` is the speed Obsidian uses on its own. A live preview under them shows all three at once and follows the sliders as you drag.

With `Shape the text cursor` on the plugin draws the caret itself. It has to: on a line with nothing selected the editor draws no caret of its own — what you see there is the browser's, and a browser caret takes a color from CSS but not a width and not a blink rate. That is why the color worked on its own and the other two only showed up while text was selected.

## Tags & PKM

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

**Tags & PKM → Fields** is the primary Field editor. The list on the left holds Fields split into Left Block and Right Block by a dotted line; the column on the right holds everything about the Field you selected.

- Add a field as `tag`, `link`, or `element`.
- Drag a field within or between Left and Right panels.
- Tag parent/subtag rows move together.
- `name_strict` is the stable runtime/config key; `name_display` is only the UI label.
- Assign a vault YAML property to each field.
- Set **Active** to `yes`, `no`, or `hotkey_only`.
- Set the placement mode per Field to `Strict`, `Insert only`, or `Free` (stored as `off`, `minimal`, and `full`).
- Enable a generated subtag lane for tag fields.
- Delete removes the field and related configuration after confirmation.

`name_strict` accepts letters, numbers, underscores, hyphens, and spaces. Names ending in `_sub` are reserved for generated child fields.

The right column of the Fields editor exposes Values and detailed behavior. It supports local undo/redo history and validates the draft. Its changes are already live in plugin settings while it is open. If markdown config Apply detects a conflict with it, **Discard** and **Cancel** do not roll settings back to their earlier state. Use the undo command or restore a backup if you must recover earlier settings.

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

They use the same Fields list, Block, Active, placement-mode, hotkey, and YAML workflows as other Fields. Link Fields do not receive tag-only token visuals or Tag Bars.

### Elements, date, and time

An element is a generic marker-plus-value field. Date and time are configurations of this generic field type, not separate hardcoded field classes.

Copyable examples:

```markdown
📅2026-09-15
🕒14:30
⏳45
```

In the right column, configure:

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

### Active and placement-mode behavior

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

Run **Open TagWheel on the left** or **Open TagWheel on the right** to start in a Block. Runtime Field order and dependencies come from the Fields list. Default interaction keys are:

| Key | Action |
|---|---|
| Left/Right arrow | Previous/next field |
| Up/Down arrow | Previous/next value |
| Tab | Switch panel/mode |
| Enter | Apply |
| Escape | Cancel |

TagWheel and direct increase/decrease commands use the same field, ordering, prefix, separator, subtag, cycle-end, and cursor rules.

Optional **Visual → TagWheel → TagWheel Scroller** shows nearby values above editor text. Set direction to `up`, `down`, or `full`, and visible size from 1 to 20 items per side.

### Prefix priority

Prefix priority chooses a line checkbox or Prefix when several configured Values could supply one.

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

Each Field can map to a YAML property. The right column can override the property for individual Values. Child Values can use their own property, then the Field property, then the parent property. YAML property suggestions are discovered from frontmatter already present in the vault.

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

Each Value carries its own `Raw` or `Clean` rule, set in the right column of the Fields editor. It controls what reaches YAML:

- `Raw`: retain tag or wikilink syntax, for example `#task` or `[[Project Atlas]]`.
- `Clean`: store normalized values, for example `task` or `Project Atlas`.

Element markers are removed from YAML values in both modes. Clean numeric priority-like tokens are written as numbers when recognized.

### Carrying your setup to another vault

Everything you set up here lives in one place, and one button writes it out:

1. Open **Advanced → Backup**.
2. Select **Save a backup**. The plugin writes a note into the backup folder. It is
   an ordinary note, so it syncs with the vault and can be copied anywhere.
3. In the destination vault, install and enable the same plugin version.
4. Copy the backup note into that vault's backup folder.
5. Select **Restore a backup**, pick the note, and confirm. What you had there is
   saved as a backup first, so a wrong pick is recoverable.
6. Restart Obsidian so every part of the plugin picks the settings up.

A backup holds every tab, not a part of one: Fields and Values, colours, Bars,
TagWheel, Navigation, Binder and Transform. Two things stay behind on purpose:

- window state: which tab was open, which Fields were expanded, which one-time
  notices you have already seen;
- hotkeys: Obsidian owns those, and they are assigned per vault.

#### Paths and templates

- Every path the plugin stores is vault-relative.
- Copy the Transform templates a rule refers to separately, keeping their
  vault-relative paths.
- Review YAML property names against the destination vault before Transform use.
- The plugin also keeps a compiled copy of your Field setup inside the vault for
  its own use. Do not copy that one: the destination vault writes its own from
  the settings you restored.

## Binder

Binder turns small text snippets into Obsidian commands.

1. Open **Settings → inlineOverhaul → Keyboard → Binder**.
2. Enter an insert token, optional command name, and optional description.
3. Select **Add row**.
4. Open Obsidian **Settings → Hotkeys** and bind the new command, named after the row. **Keyboard → Commands & Hotkeys** takes you straight to it.

Running a normal Binder command replaces the current selection or inserts at the cursor, then places the cursor after inserted text. Rows can be reordered or deleted. After creation, insert text and command name are read-only; delete and recreate a row to change them. Description remains editable.

Reload the plugin after deleting or recreating Binder rows. Commands are not unregistered during the session, so stale Binder commands may remain visible until reload.

### Smart bracket

**Smart bracket** cycles bracket forms around a selection:

```markdown
text
[text]
[[text]]
text
```

Without a selection, it inserts or transforms bracket pairs around the cursor so you can continue typing inside them. Unmatched `[` or `[[` input is a known limitation and may transform unexpectedly; test Smart bracket on disposable text before using it near important content.

## Visual features

General Visual functionality is implemented and separate from Transform's disabled Processed-marker styling.

### Tags

- Independent left/right panel opacity
- A colored band behind each Block (`Color the Blocks`), with its own color, strength, height and width. It runs from the first Value of a Block to its last one, never touches your text between the Separators, and does not appear for a Block with nothing in it. The band is drawn behind the writing, so everything on the line stays selectable and clickable.
- `Band height` is how far the band reaches above and below the writing, in points. It matters more than it sounds: a tag bubble carries its own color, so at zero a Block of one tag would hide the band completely. The band never grows past the line it belongs to, so the bands of two neighbouring lines can meet but never overlap, and its height is the same on every line whatever the Block holds.
- `Band width` is how far the band reaches past the Block, and it reaches equally on both sides. The scale has three landmarks: at 0 the band starts on the first Value and ends on the last one; at 50 it touches the Separator on the inner side and steps out by the same distance on the other; at 100 it takes the Separator in as well. The Left Block is the one exception — it never reaches onto the bullet or the checkbox, whatever the number says. When a Block wraps onto the next line the band wraps with it, ending on the last Value of each line rather than running to the edge of the window.
- Tag text size
- Tags bubble width and `Tag bubble height`
- Empty-bubble size
- Rounded-to-square shape
- Per-Field and per-Value fill color, text color, visibility, and optional custom display text in the right column of the Fields editor
- Separator text colors

These are editor decorations: they change display, not stored markdown tokens.

### Tag Bars

Tag Bars draw up to three colored bars in the editor margin for a selected tag Field's parent and child hierarchy. Configure the Field, tag visibility, optional Separator hiding when a hidden Bar token is the only technical token, default or crossing mode, bar count, thickness, child offset, and distance to the text. Tag Bars are **off** by default: on a fresh install lines look as they always did until you turn them on.

### TagWheel panel and scroller

- Show/hide token prefixes visually
- Default placeholder text color
- Panel fill color
- Optional nearby-value scroller with direction and size controls

### Text cursor

Under **Visual → Text cursor**, the blinking caret can take a color of its own instead of the color of your text. Turn on `Color the text cursor` and pick one in `Cursor color`; an empty color means the color your theme gives it. This paints the caret in your notes only, and leaves the caret in the settings window and in the search box alone. It is **off** by default.

## Transform: a line becomes a note

> [!CAUTION]
> Transform is explicit opt-in and defaults to Off. Enable it only after backing up the vault and reviewing every setting below.

### Destructive defaults on first enable

Before first use, review these initial defaults:

- **Replace payload with note link:** on (`true`)
- **Source cleanup keep-list:** empty; all recognized fields are removed from source
- **Processed token:** `#processed`, placed in the Right panel
- **Sublines behavior:** Stay
- **Name collision:** `new_note` (create a new note, adding a suffix when needed)
- **Value YAML rule:** Raw
- **Template body placement:** end (`At custom header` is off until you pick it)
- **Inserted block header:** current datetime
- **Open transformed note:** off; target does not auto-open

These defaults can rewrite the source line and create a target note. Use disposable text until preview and output match your workflow.

### Enable and prepare

1. Keep the global **Transform module** enabled.
2. Open **Settings → inlineOverhaul → Transform**.
3. Turn on **Transform inline to note**.
4. Set a templates folder if using templates.
5. Set an output folder, or leave it empty to use the current note's folder.
6. Select a default template or leave it blank.
7. Review naming, collisions, placement, YAML, source cleanup, Processed marker, sublines, and open-note settings.
8. Use the live Before/After preview.
9. Test **Transform inline to note** on a disposable line.

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

For new/overwrite operations, transformed source content is inserted at the beginning of the template body, at its end, or at the end of a section you name.

**At custom header** asks for two more things. **Type name of header** is the heading the text is filed under, written as it stands in the note: put the hashes in (`## Log`) and only a heading of that depth counts, leave them out and a heading of any depth with those words will do. Case does not matter, and two headings with the same name mean the first one. **If header not found** is where the heading gets written when the note has none, at the beginning or at the end: the plugin adds the heading for you, at the depth you typed (no hashes means one), and files the text under it, so the next entry finds that heading and joins the same section. The block lands at the *end* of the section, so entries stay in the order you wrote them, and the same rule applies when the note already exists and you chose to add to it.

The inserted block header can be:

- custom text;
- current datetime formatted with `YYYY`, `MM`, `DD`, `HH`, `mm`, and `ss`;
- none.

Source indentation common to the root block is removed in the target note while internal parent/child indentation is preserved.

### SmartTransform rules

A smart rule routes a source line to a template based on tags, element markers, and wikilinks.

- Values within one condition group use OR matching.
- Non-empty groups on the same rule all must match.
- **Advanced settings** on a rule decides where the text lands for that rule alone. `Default` follows **Note content**; `Set for this rule` opens the same rows and keeps them with the rule. Switching back to `Default` does not erase what you set.
- Rules fold. The mark in the card header collapses a rule to two lines — its name and one summary line with the conditions, the template and the folder — and the controls stay in the header. The panel opens with rules folded; a rule you have just added stays open until you fold it. Folding is a view, not a setting: it is not written into your configuration.
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

**Manual** mode opens a **note title** dialog. Cancel or Escape leaves source and target unchanged. File-system-invalid title characters are replaced with spaces before path creation.

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

Transform recognizes exact configured values in their configured panel. Tokens in the wrong panel or transferred-text zone, and aliased or heading wikilinks such as `[[Note|Alias]]` or `[[Note#Heading]]`, may be ignored. A dependent child is included only when its parent is also recognized. In **Add to note** mode, existing note frontmatter is left unchanged because content is appended rather than recomposed.

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

Possible result when `#task` is kept, other recognized fields are removed, link replacement is on, and Processed marker is placed right:

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

## Glossary

The plugin renamed several of its own mechanisms so that the interface says what a
thing is rather than how it was built. Older notes, videos and issue threads may
still use the left column.

| You may have seen | Now called | What it is |
|---|---|---|
| Order | **Fields** | The list of slots a line can carry. There is no separate idea of "order": position is set by dragging in the list |
| — | **Field** | One slot: a tag, a link, or an element such as a date. Three types, no others |
| — | **Value** | One of the choices inside a Field. Values are stored without the Field name |
| zone, segment | **Left Block** / **Right Block** | Fields before your text and Fields after it. The side is set by dragging a Field across the dotted line |
| — | **Block** | A Field together with its child Fields: they stay on one side and move together |
| Strip, rails, stripes | **Tag Bars**, **Bar** | The colored bar in the editor margin showing a line's Value and everything nested under it |
| Deep Editor | the right column of the Fields editor | Has no separate name of its own |
| free roam (`off` / `minimal` / `full`) | placement modes **Strict** / **Insert only** / **Free** | Stored values are unchanged |
| Prefix Resolver | **Prefix priority** | Which Field's checkbox wins when two carry one |
| subtag | **child Value** | Stored values `separate` and `combined` are unchanged |
| separator1, separator2 | **First Separator**, **Second Separator** | The two markers that fence your text off from the Fields |
| payload | **transferred text** | The part of the line Transform carries into the new note |
| processed token | **Processed marker** | What Transform leaves on the source line |
| Flying button | **Floating button** | A small arrow at the end of the line you are on; `Distance from the text` sets how far from it |
| Inline2Note | **Transform**, **Transform inline to note** | Turning a line into a note of its own |
| Active Rules Path | — | Removed from the interface; the path stays internal |
| YAML note format | — | Removed; replaced by a `Raw` or `Clean` rule on each Value |
| Execution Backend, Flush Settings Now | — | Removed. Settings save on their own |
| Undo last settings change (a button in settings) | **Undo last settings change** (a command) | The button is gone; the command keeps the name |
| — | **TagWheel** | The panel with all Fields above the line, steered with the arrow keys |
| — | **Binder** | Your own text-insertion commands |
| — | **Prefix** | The start of a line: list marker, checkbox, heading hashes |
| — | **Smart Rules** | Rules that pick a Transform template by the look of a line |

## Hotkeys

inlineOverhaul assigns **no** default keys to any of its commands. Two ways to give them one:

- **Keyboard → Commands & Hotkeys** in the plugin's settings: every command with the key it has now, and a click takes you to Obsidian's Hotkeys screen with that command already found;
- Obsidian's own **Settings → Hotkeys**: type `inlineOverhaul` in its search box to bring up the whole set at once.

TagWheel is the exception worth knowing: once it is open you steer it with the arrow keys, so it needs only the one command that opens it.

Recommended setup pattern:

| Workflow | Suggested binding strategy |
|---|---|
| Navigation | Arrow-like combinations that do not conflict with editor defaults |
| Field next/previous | Paired keys per Field |
| TagWheel | One key for the left Block and one for the right |
| Binder | Mnemonic keys for frequently inserted tokens |
| Transform | Deliberate multi-key binding to avoid accidental execution |

Do not bind Transform to a single easy-to-press key during beta testing.

## Backup

Everything you set up here lives in one file inside your vault, and the plugin can
write a copy of it as an ordinary note. Open **Advanced → Backup**.

- **Backup folder**: where in your vault the copies go. The folder is made when
  you save the first backup, not before.
- **Save a backup**: writes a new note. It never overwrites an earlier one, so
  saving twice gives you two copies; delete the ones you no longer want the way
  you delete any note.
- **Save a backup before restoring**: on by default. Restoring replaces
  everything, so the plugin writes what you have at that moment into the folder
  above first, and names that copy with `Autogenerated` at the end so you can
  tell it from the ones you saved yourself. Turn it off if you restore often and
  would rather not collect copies you never asked for.
- **Restore a backup**: lists the copies it finds, newest first, with the date
  each was saved and what is inside. Picking one asks you to confirm, and the
  question says whether what you have now is being saved first.

**What a backup holds.** Fields and their Values, Prefixes, Separators, Tag Bars,
tag colours, Binder rows, Transform with its Smart Rules, navigation modes: every
setting on every tab. What it deliberately leaves out is the state of this
computer: which tab you had open, which Fields you had expanded, and notices you
have already been shown once. Those stay as they are on each device.

**Carrying your setup to another vault or computer.** A backup is a note, so it
travels the way notes travel: it syncs with the vault, it is visible in the file
explorer, and you can send it to yourself. Open the other vault, put the note in
its backup folder, then press **Restore a backup** there.

**Restoring replaces, it does not merge.** Everything you have set up is replaced
by what the backup says. After restoring, restart Obsidian: several parts of the
plugin read the settings once when they load.

**A backup written by an older version still works.** It goes through the same
upgrade path as your own settings file, so old names inside it are translated
rather than dropped. The copy the plugin kept when it upgraded your settings shows
up in the same list, as **Before the update to this version**.

## Troubleshooting and recovery

### Command says module is disabled

Open **General** and enable the named module. For Transform, also turn on **Transform → Transform inline to note**.

### PKM command is missing

1. Confirm the Field exists in the Fields list and has a valid unique system name.
2. Confirm the PKM module is enabled.
3. Open **Keyboard → Commands & Hotkeys** and look for the Field's name, or search Obsidian Hotkeys for `inlineOverhaul`.
4. If the Field was renamed or deleted, or you restored a settings backup, disable and re-enable inlineOverhaul or reload Obsidian to refresh the command registry.

Adding a Field directly in settings registers its commands immediately. Registry changes from a Field rename or delete, a restored backup, or a Binder delete and recreate need plugin disable/re-enable or an Obsidian reload. Stale commands may remain until that reload.

### TagWheel or inline navigation uses stale values

1. Change any setting on **Tags & PKM**, anything at all. The plugin rewrites the
   compiled copy of your setup on every change, and that is what the commands read.
2. Disable and re-enable inlineOverhaul.

Do not edit that compiled note by hand: it is rewritten from your settings, and
your edits do not survive.

### Settings look wrong after an update or an experiment

Open **Advanced → Backup** and press **Restore a backup**. If you have
never saved one, the list still offers the copy the plugin kept when it upgraded
your settings. With **Save a backup before restoring** on, restoring saves what you
have now first, so you can go back either way.

### Settings changed unexpectedly

- Immediately run **Undo last settings change**.
- Settings save on their own shortly after a change; there is no manual flush.
- If that is not enough, restore a backup: **Advanced → Backup → Restore a backup**.

### Transform created the wrong result

1. Stop transforming further lines.
2. Use Obsidian undo for the source edit when still available.
3. Restore affected source/target notes from backup or version history.
4. Check collision mode, source cleanup checkboxes, transferred-text link replacement, sublines behavior, YAML format, separators, and template.
5. Reproduce on a disposable synthetic line before retrying production content.

### Missing template or empty transferred text

Transform stops before target mutation when a selected template cannot be read or transferred text is empty. Correct the vault-relative template path or use a line with text in the configured transferred-text zone.

### Startup or runtime failure

1. Disable inlineOverhaul.
2. Restart Obsidian.
3. Update through BRAT.
4. Re-enable the plugin and test a disposable note.
5. If failure persists, enable Developer Mode only long enough to reproduce it, then review logs for private note content before sharing them.

## Beta limitations

### Disabled, not implemented for use

- Nothing is disabled at the moment. **Floating button** and the styling of a transformed line both work: the button is switched on under `Transform`, and `Distance from the text` under it decides how far from your last character it sits.

### Implemented but still beta

- The one-off cases still need checking by hand on a real Obsidian: the first start on
  a clean vault, the move of an older config to the new form, and the notice about
  renamed commands.
- Transform performs real note mutations; behavior is automated-tested but still requires user verification with each vault's templates, YAML, and field taxonomy.
- General Visual features are implemented: tag bubbles, Tag Bars, Separator colors, and the TagWheel panel and scroller appearance. They are not the disabled Processed-marker styling feature.
- The language file covers the whole settings panel — its tips, the tab callouts, the live previews, the command reference, the windows it opens, the Fields editor with its neighbours, and the messages the plugin shows while you type: 1212 lines in all. Command names stay English whatever you pick: Obsidian takes those from its own registry, and translating them here would leave the command palette and the reference table disagreeing.
- **No translation ships with the plugin, and that is deliberate.** The `texts` folder holds one file, `default.js`, and it belongs to the plugin: it is rewritten whenever the panel gains a line or a line is reworded, so what you copy is never out of date. To add a language, copy it under a name of your own, change the first line `"$language"` to the name you want to see in the list, and translate the right-hand side. Anything you leave alone keeps its English wording, so a half-finished translation is worth using. English is always in the list and has no file at all: it lives in the code, which is the only way it stays current.
- **This guide note has a translation mechanism of its own.** The `guide` folder holds `default.md` — this same guide, with a small property block at the top. Copy it under a language name, change `language:` in that block, translate the prose, and the `Read` button writes your version into the vault instead of the English one. Two things are worth knowing. Your copy is yours from the moment it appears: the plugin never rewrites it and never reads it back, because there is no way to tell a translated paragraph from an untranslated one. And each language gets its own note — `inlineOverhaul Guide (Русский).md` sits beside the English one rather than replacing it, so switching language never costs you the notes you wrote in the margins.

## Safe copyable test

Use synthetic notes, tags, links, and dates:

```markdown
## inlineOverhaul sandbox

- [ ] #task #research || Draft a synthetic release checklist || [[Project Atlas]] 📅2026-09-15
  - Verify package
  - Verify guide

- [I] #idea || Compare two fictional layouts || [[Project Borealis]]
```

Test one feature at a time, compare stored markdown before/after, then restore the sandbox from backup before testing the next destructive configuration.
