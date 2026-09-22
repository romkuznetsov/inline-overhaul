# Feature list

Everything inlineOverhaul does, in full. This page lists; it does not teach.
New here? Start with the [tutorial](docs/TUTORIAL.md) or the [README](README.md).

For the settings panel control by control, see the
[settings reference](docs/SETTINGS.md). For installation, configuration and recovery,
see the [setup and user guide](INSTRUCTIONS.md).

```markdown
- [ ] #todo #/1 || call the bank || [[Project A]] 📅 2026-09-15
```

Everything in that line is ordinary markdown in the file. The tags are searchable by
Obsidian, the link is a real link, the date is text your other plugins can read.

## Fields

A **Field** is one slot a line can carry: a status, a priority, a type, a due date, a
project link, an estimate. You define them; the plugin ships no methodology.

- **Three types of Field**: `Tag` (`#todo`), `Link` (`[[Project A]]`) and `Element` —
  a marker plus a format, such as `📅 2026-09-15`.
- **Values.** Each Field holds an ordered list of Values, and each Value carries its own
  writing rule, so one Field cycles `#todo → #doing → #done` and another `#/1 → #/2 → #/3`.
- **Child Fields.** A Field can depend on another one: `After parent` offers it once the
  parent has a Value, `Show always` offers it on any line, `Hide` keeps it out.
- **Prerequisites.** A Field can stay out of the line until another Field has a Value —
  any Value, or one you name.
- **Blocks.** Fields sit in the `Left Block`, before your text, or the `Right Block`,
  after it. The side is set by dragging a Field across the line in the editor.
- **A pair of commands per Field**, created on the spot: `<Field> next` and
  `<Field> previous`.
- **A Value shown as your own text.** The `Show` column draws a Value as an emoji, as
  anything you type, or as nothing. A shown link still opens the note when clicked.
- **YAML property.** Each Field says which property of a transformed note it becomes.
- **Live preview** of the line you are building, above the editor.
- **Two heights for the editor**, switched by the chevron in the group header.

*Where:* **Tags & PKM → Fields**, `Separators`, `Writing rules`, `Placement modes`,
`Prefix priority`.

## tagWheel

tagWheel lays your Fields out over the line you are standing on. Arrow keys move between
Fields and their Values; on exit the line is written back as plain markdown.

- **Two commands, two sides.** `tagWheel Left` starts on the Fields before
  your text, `tagWheel Right` on those after it.
- **The other Block.** While the picker is open it takes the place of the Block it stands
  in. The other one either leaves the line for as long as you are choosing, or stays
  written where it belongs.
- **Only what applies.** A Field whose prerequisite is not met is not offered.
- **Write-back by difference.** The panel writes only what actually changed, checked
  against Obsidian's own undo history in the test suite, keystroke by keystroke.
- **Appearance**: colours per role, an optional scroller box of neighbouring Values, and
  a highlight for the line being edited.

**One known limit.** While the panel is open it holds its strip in the text of the note,
which takes the Values it stands on out of the line for that moment. Undo steps that
wrote those Values collapse across that gap, so a run of `Ctrl+Z` after a session can
land on a line that never existed. Keeping the other Block in sight removes the case
where only that Block was filled; the case where the Block under the panel was filled too
is open.

*Where:* **Visual → tagWheel**, split into `Panel` and `Scroller`. Every subheading in the settings folds with the triangle beside it.

## Navigation

Eight commands, each aware that a line has structure.

| Command | What it does |
|---|---|
| `Move up` | Move the line you are on, or its whole tree, up |
| `Move down` | The same, downwards |
| `Move left` | Move selected text, cycle the line Prefix, or unindent |
| `Move right` | Move selected text, cycle the line Prefix, or indent |
| `Jump up` | Move the cursor to the heading or line above |
| `Jump down` | Move the cursor to the heading or line below |
| `Jump left` | Step the cursor back through the parts of the line |
| `Jump right` | Step the cursor on through the parts of the line |

A move can carry the indented tree with the line, cross a heading boundary or stop at it,
highlight what landed, and scroll the note so the line is at the centre, the top or the
bottom of the screen. A jump does the same for its target.

*Where:* **Navigation**, four groups.

## Visual

Drawing only: the file on disk is untouched.

- **Inline appearance** — size and opacity of each Block, bubble width, height and
  corners for tags, and a coloured Stripe behind one Block or both.
- **Link view** — the page preview on hover and dragging, for a Value shown as your own
  text; and colours for links: two for a wikilink (the name and the brackets) and three for
  a hyperlink (the text, the brackets and the address).
- **Color your Tags** — a colour per tag for tags no Field owns.
- **Tag Bars** — a Bar in the margin drawn from the Values of one tag Field, down a line
  and everything nested under it.
- **Text cursor** — the caret's colour, width and blink speed.
- **Jump highlight** — a fading circle where the cursor lands after a jump.

*Where:* **Visual**, eight groups.

## Transform

`Transform inline to note` takes the line you are on and makes a note of it, or appends
it to one that already exists. Off out of the box.

- **Templates.** A template folder and a default template, listed from the folder itself.
- **Smart Rules.** A rule matches the Values a line carries and picks the template for
  it, so a `#meeting` line and a `#bug` line become different notes.
- **Naming.** Where the name comes from, and what happens when it is taken.
- **Note content.** A header line from a date format or fixed text, the Values carried in
  as YAML properties, and a rule for the lines indented under it.
- **Source line.** What stays behind: the whole line, a few words, a link to the new
  note, a `#processed` mark, the tree carried across.
- **Links back.** Every note the line points at can receive a link to the new note.
- **Floating button** at the end of the line you are on, as an alternative to the key.

*Where:* **Transform**, seven groups.

## Keyboard

- **Expanded `Ctrl+A`** — successive presses widen the selection in steps: the word, the
  part of the line, the line, the block, the note. `Custom` picks which steps a press
  stops at.
- **Smart Delete\Backspace** — `Del` at the end of a line and `Backspace` at the start
  bring up the words without the indent and the Prefix. The two switch on separately.
- **Smart Enter** — `Enter` adds a line below instead of splitting the one you are on.
- **Smart paste** — a pasted numbered list is counted from one, unless it lands under a
  list you already have, and then that count carries on. A pasted `1. text` dropped into a
  line that already starts with a number loses its marker.
- **Binder** — your own insert commands: a row defines a snippet and gets a command.
  `Smart bracket` ships with the plugin and cycles the brackets around the cursor or
  selection.
- **Commands & Hotkeys** — every command with the key bound to it now, and a `to hotkeys`
  button on each heading that opens Obsidian's `Hotkeys` screen filtered to it.

*Where:* **Keyboard**, four groups.

## General and Advanced

- **Four module toggles** — `Navigation`, `Tags & PKM`, `Visual`, `Transform`. Each has a
  command of its own.
- **Language.** Every visible line of the panel has a key, and the words sit in one text
  file per language inside the plugin folder. Copy `default.js` under a new name and the
  panel speaks your language. Command names stay English: Obsidian takes those from its
  own registry.
- **Guide note.** `General → Help → Guide → Read` writes the guide into your vault.
- **Backup.** `Save a backup` writes your setup into a note; `Autosave` keeps a copy
  whenever the settings file changes outside the panel; `Start over` returns to defaults
  and writes a backup first.
- **Diagnostics.** `Show option IDs in tips` puts each setting's identifier into its tip, a
  developer log records what the plugin did, and `Undo last settings change` rolls back the
  most recent change made in the panel.
- **What changed, after an update.** The first time you open a vault on a new version, a
  window shows that version's section of the changelog — once per version, and never on a
  fresh install.

*Where:* **General**, four groups; **Advanced**, four groups.

## The full command list

Commands are named after the area they belong to — `Navigation: Move up`,
`Tags & PKM: Category next` — so Obsidian's `Hotkeys` screen can be filtered to one area.

Thirteen commands exist always:

| Command | Area |
|---|---|
| `Move up` | Navigation |
| `Move down` | Navigation |
| `Move left` | Navigation |
| `Move right` | Navigation |
| `Jump up` | Navigation |
| `Jump down` | Navigation |
| `Jump left` | Navigation |
| `Jump right` | Navigation |
| `tagWheel Left` | Tags & PKM |
| `tagWheel Right` | Tags & PKM |
| `Transform inline to note` | Transform |
| `Smart bracket` | Binder |
| `Undo last settings change` | General |

And these appear from what you configure:

- a pair per Field — next Value and previous Value;
- one per Binder row;
- one per module, to toggle it.

**No hotkey is assigned by default.** Every command arrives unbound.

## What it does not do

- **Desktop only.** Mobile is not supported, and the manifest says so.
- **It ships no translation.** The language folder holds one file, `default.js`, and that
  one belongs to the plugin. A language appears when you put a file next to it.
- **It is a public beta.** Back up your vault before installing or updating, and try
  Transform on notes you can afford to lose: it writes real files.
- **It syncs nothing.** No account, no server, no telemetry, no network requests.
- **It hides none of your markdown.** Everything it writes is text you could have typed
  yourself — which is also the limit: a line is as readable as the Fields you designed.

## Requirements

- Obsidian desktop **1.13.0** or newer — the settings panel is built on the declarative
  settings API that arrived in 1.13.
- Installed through BRAT while the plugin is in beta: `romkuznetsov/inline-overhaul`.

## Where to go next

| | |
|---|---|
| [**Tutorial**](docs/TUTORIAL.md) | Fifteen minutes from install to a line that works |
| [**Settings reference**](docs/SETTINGS.md) | The panel, tab by tab |
| [**Setup and user guide**](INSTRUCTIONS.md) | Configuration, Transform safety, troubleshooting |
| [**Visual showcase**](docs/SHOWCASE.md) | Thirty animations, grouped by workflow |
| [**Changelog**](CHANGELOG.md) | What changed in every release |

---

*This list is checked against the product, not written from memory:
`tests/regression/docs_terms_tests.ts` asserts that every command named here exists, that
every settings area is named, and that no control removed from the panel is still listed.*
