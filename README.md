# inlineOverhaul

A line of a note can carry more than words. inlineOverhaul lets you put a status, a
priority, a due date and a link to a project on the same line as the thought, then move,
cycle and edit all of it from the keyboard.

```markdown
- [ ] #todo #high || call the bank || [[Project A]] 📅 2026-09-15
```

Everything above is ordinary markdown in the file. The tags are searchable, the link is a
real link, and nothing is hidden from your other plugins.

See the [visual showcase](showcase.md) for animated examples and the
[setup and user guide](instructions.md) for installation, configuration, Transform safety
and troubleshooting.

> [!WARNING]
> This is a public beta. Back up your vault before installing or updating, and try
> important workflows on notes you can afford to lose.

## Requirements

- Obsidian desktop 1.13.0 or newer. The settings pane uses the declarative settings API
  that arrived in 1.13.
- Desktop only. Mobile is not supported.

## Install with BRAT

1. Install and enable the BRAT community plugin.
2. In BRAT, choose **Add Beta plugin**.
3. Enter `romkuznetsov/inline-overhaul`.
4. Enable **inlineOverhaul** in Obsidian's Community plugins settings.

## What you get on a fresh install

Four Fields, so there is something to press on the first day:

| Field | Type | Where it sits | Values |
|---|---|---|---|
| `Status` | tag | before your text | `#todo`, `#doing`, `#done` |
| `Priority` | tag | before your text | `#low`, `#med`, `#high` |
| `Due` | emoji element | after your text | 📅, format `YYYY-MM-DD` |
| `Project` | link | after your text | `[[Project A]]`, `[[Project B]]` |

They are yours to change or delete in **Tags & PKM → Fields**. They arrive with a fresh
install only: **Advanced → Backup → Start over** wipes them and does not put them
back.

**No command has a key until you give it one.** The plugin assigns no default hotkeys, so
it cannot fight with what you already use. **Keyboard → Commands & Hotkeys** lists every
command with the key it has now and takes you to Obsidian's Hotkeys screen. The single
exception is **Expanded `Ctrl/Cmd+A`**, which takes over a key Obsidian already owns, and
it lives under **Keyboard** too.

> [!WARNING]
> **Command identifiers changed in this version.** Obsidian binds hotkeys to identifiers
> rather than names, so keys you had assigned to inlineOverhaul commands stopped working
> after the update. The old-to-new map is in
> [`docs/command_ids_v1_v2.md`](docs/command_ids_v1_v2.md), and the plugin says so once on
> first load.

## What is on each tab

Every entry names the tab and group you set it in. Links go to the matching animation in
the [visual showcase](showcase.md).

### General

Module switches for Navigation, Tags & PKM, Visual and Transform, so a whole area can be
turned off without uninstalling anything. **General → Help → Read** writes the guide note
into your vault and opens it; **Show callouts** and **Show tips** decide how much the
panel explains itself.

**General → Language** decides what language the panel speaks. Every visible line has a
key of its own, and the words behind those keys live in plain text files inside the plugin
folder:

```
<your vault>/.obsidian/plugins/inline-overhaul/texts/default.js
```

That is the only file the plugin puts there, and it keeps it current: a new setting, a new
window and a reworded line all show up in it on their own. Copy it under a new name, change
its first line, and that language appears in the list on its own — nothing has to be
registered anywhere. Name the copy `en.js` and you are rewording the English instead of
translating it.

Your copy is never overwritten, so your edits survive an update, and a line you leave out
simply keeps the English the plugin ships with. Command names stay in English: Obsidian
takes those from its own command registry, and translating them here would leave the
command palette and the reference table disagreeing.

- [Module toggles](showcase.md#open-settings-and-module-toggles): enable or disable each
  feature module from **General**. Open the pane the normal Obsidian way — there is no
  command for it, and there is no longer one to remove.
- [Settings undo](showcase.md#settings-undoflush): **Undo last settings change** rolls back
  the most recent change. It is a command, not a button. Saving is automatic and there is
  no manual flush.
- [Diagnostics and developer logs](showcase.md#diagnosticsdeveloper-logs): **Advanced →
  Diagnostics**. The log is a note in your vault and it records the lines you were working
  on, so read it before you share it.

### Keyboard

- [Expanded Ctrl+A](showcase.md#enhanced-ctrla): grow the selection from the word under
  the cursor to the line, to its indentation tree, then to the whole note. `Custom` lets
  you tick which of those five steps a press stops at.
- **Smart Delete**: **Keyboard → Smart Delete\Backspace** changes what `Del` does at the
  end of a line. It joins the line below without its indent and without its bullet,
  checkbox or quote mark, so you get the words and not the punctuation. A line that
  holds nothing but a Prefix goes whole. `Smart backspace` puts the same behaviour on
  `Backspace` at the start of a line, and switches on separately: either key can do
  this without the other. Both off by default.
- **Commands & Hotkeys**: every command, the key it has now, and a click through to
  Obsidian's Hotkeys screen.
- [Custom insertion commands](showcase.md#custom-insertion-commands): **Binder (custom
  insert commands)** turns a row of text into a command of its own.
- [Smart bracket](showcase.md#smart-bracket): the one Binder row that ships with the
  plugin. It cycles `text`, `[text]`, `[[text]]` and back.

### Navigation

- [Move lines and trees](showcase.md#move-linestrees): **Move line up** and **Move line
  down** carry the line, or its whole tree, past its neighbours.
- [Move selected inline text](showcase.md#move-selected-inline-text): **Move left** and
  **Move right** shift the selection inside the line.
- [Prefix cycle and indent fallback](showcase.md#prefix-cycleindent-fallback): the same two
  commands cycle the line Prefix and change the indent when nothing is selected. What
  happens at the end of the cycle is **Navigation → Move left and move right → When a line
  empties out**.
- [Header jumps](showcase.md#header-jumps): **Jump back** and **Jump next**, tuned in
  **Navigation → Moving cursor inside a note**.
- [Inline zone navigation](showcase.md#inline-pkm-zone-navigation): **Move cursor left in
  line** and **Move cursor right in line** step through the parts of a line rather than
  through characters. Their settings are **Navigation → Moving cursor inside a line**.

### Tags & PKM

- [Fields, Blocks and order](showcase.md#field-schemaorderpanels): **Tags & PKM → Fields**.
  One list holds every Field; drag a Field across the line in it to move it between the
  `Left Block` and the `Right Block`.
- [Value hierarchy](showcase.md#deep-editor-hierarchy): the `Values` table in the right
  column of the same editor. A Value can hold a child Value.
- [Per-Value Prefixes and prerequisites](showcase.md#per-value-prefixesdependencies): the
  `Behavior` block of a Field, where `Prerequisite Field` makes one Field wait for another.
- [Emoji elements, dates and numbers](showcase.md#generic-elementsdatetimenumber): a Field
  of type element carries a marker and a format instead of a list of Values.
- [YAML property mapping](showcase.md#yaml-field-mapping): the `YAML property` row of a
  Field decides which property of a transformed note it becomes.
- [Separators, Prefix priority, cursor and placement
  modes](showcase.md#separatorsprefix-resolvercursorfree-roam-policies): **Tags & PKM →
  Separators**, **Prefix priority**, **Writing rules** and **Placement modes**.
- [Cycle a Field from the keyboard](showcase.md#direct-taglink-field-cycle-increasedecrease):
  every Field gets a pair of commands, `<Field> next` and `<Field> previous`, created for
  it automatically.
- [Step an element up or down](showcase.md#element-incrementdecrement): the same pair for a
  date, a time or a number.
- [TagWheel](showcase.md#tagwheel-leftrightnavigationapplycancel): **Open TagWheel on the
  left** and **Open TagWheel on the right** open a panel over the line, where arrow keys
  pick Values and `Enter` applies them.

### Visual

- [Tag bubbles and per-Value styles](showcase.md#tag-bubblesper-value-stylesseparator-colors):
  **Visual → Inline appearance** for size, opacity, corners and a colored band behind each
  Block; **Color your Tags** for tags of your own that no Field owns.
- [TagWheel panel and scroller](showcase.md#tagwheel-panelscroller): **Visual → TagWheel**,
  where `Scroller` adds a list of neighbouring Values and `Highlight the TagWheel line`
  fills the line you are editing.
- [Tag Bars](showcase.md#hierarchy-striptoken-hiding): **Visual → Tag Bars** draws a
  coloured stripe in the margin down a line and everything nested under it. One tag Field
  draws them, chosen in `Which Field draws Bars`, and the colours come from that Field's
  Values. Off by default.
- **Text cursor**: **Visual → Text cursor** gives the blinking caret a color of its own,
  so it stops disappearing into the page. A second switch sets its width and its
  `Blink speed`, from `0` (no blinking at all) to `10`, with a live preview under both.
  Off by default, and it changes the caret in your notes only. With `Shape the text
  cursor` on, the plugin draws the caret itself: the editor draws no caret of its own on
  a line with nothing selected, and a caret it does not draw cannot be made thicker.
- **Moving lines**: **Navigation → Moving lines** now decides where the view goes after a
  move. `Follow the moved line` off leaves the note exactly where it was; on,
  `Where the line lands` puts the moved line at the center, the top or the bottom of the
  screen — the same place every time.
- **TagWheel edges**: **Visual → TagWheel**, `TagWheel navigation behavior` decides what
  the arrows do at the end of a Block: stay in it, or step across into the other one.
- **Heading jumps**: **Navigation → Moving cursor inside a note** now has the same pair.
  `Follow the jump target` decides whether the note scrolls after a jump, and
  `Where the target lands` puts the line you jumped to at the center, the top or the
  bottom of the screen.

### Transform

**Transform → Inline to note** is off out of the box. Turn it on before running
**Transform inline to note**, and read [the guide](instructions.md) first: this command
rewrites the line you are standing on.

- [Preview before you enable it](showcase.md#synthetic-previewopt-in): the group shows what
  it would do to an example line, without touching a note.
- [Current root or selected tree](showcase.md#current-root-or-selected-tree).
- [Templates, Smart Rules and naming](showcase.md#templatessmart-rulesauto-manual-naming):
  `Templates folder` and `Default template` under **Inline to note**, the rules under
  **Smart Rules**, and the name under **New note naming**.
- [Collision, body and header policies](showcase.md#collisionbodyheader-policies): **Note
  content**, plus `If the name already taken` under **New note naming**. `Where to put the
  text` can also file the entry at the end of a heading you name, and says what to do when
  the note has no such heading.
- [YAML Raw and Clean mapping](showcase.md#yaml-rawclean-mapping): each Field carries the
  rule, set once for the Field in **Tags & PKM → Fields**.
- [What happens to the source
  line](showcase.md#source-cleanuplinkprocessed-tokensublinesopen-target): **Transform →
  Source line**.

### Advanced

- **Backup**: `Save a backup` writes everything you have set up into an ordinary
  note in your vault. It travels with the vault, so restoring it on another machine is how
  a setup moves. `Start over` deletes everything and always writes a backup first.
- **Options IDs**: puts the id of a setting into its tip, which is the fastest way to tell
  us exactly which control you mean.

## Build and test

```powershell
npm install
npm run test:version
npm run build
npm run test:release
node --check dist/main.js
```

Release assets are written to `dist/`, and `dist/` is **not** in the repository: it is
build output, rebuilt by `npm run build`. Every command that needs it builds it first —
`npm test`, `npm run install:test`, and the release workflow — so there is no step you can
forget. What ships is attached to the GitHub release: `main.js`, `manifest.json`,
`styles.css`.

The `main.js` in the repository root is not that file. It is hand-written source, and the
build bundles it into `dist/main.js`.

## Current beta limitations

- The one-off cases still need checking by hand on a real Obsidian: the first start on a
  clean vault, the move of an older config to the new form, and the notice about renamed
  commands.
- Transform writes real notes. It is covered by automated checks, but every vault has its
  own templates, properties and Fields, and those need your eyes.
- The language file covers the whole settings panel — its tips, the tab callouts, the live
  previews, the command reference, the windows it opens, the Fields editor with its
  neighbours, and the messages the plugin shows while you type: 1212 lines. The guide note
  has a file of its own, in `guide/`. Command names stay English whatever you pick:
  Obsidian takes those from its own registry, and translating them here would leave the
  command palette and the reference table disagreeing.
- **No translation ships with the plugin.** The folder holds one file, `default.js`, and
  that one belongs to the plugin: it is rewritten whenever the panel gains a line, so what
  you copy is never out of date. A language appears when you put a file next to it, and
  disappears when you remove it. English is always in the list and has no file at all —
  it lives in the code, which is the only way it stays current.

## Terms

Several mechanisms were renamed so that the interface says what a thing is rather than how
it was built: `Order` became **Fields**, `Strip` became **Tag Bars**, `free roam` became
placement modes, `Prefix Resolver` became **Prefix priority**. Stored config values did not
change. The full table is in the [glossary](instructions.md#glossary).
