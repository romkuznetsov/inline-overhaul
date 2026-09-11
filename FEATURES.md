# inlineOverhaul — what it does

One line of a note can carry more than words: a status, a priority, a due date, a
project link — next to the thought itself, in plain markdown, editable from the
keyboard alone.

```markdown
- [ ] #todo #/1 || call the bank || [[Project A]] 📅 2026-09-15
```

Everything in that line is ordinary markdown in the file. The tags are searchable
by Obsidian, the link is a real link, the date is text your other plugins can
read. Nothing is hidden, nothing is stored in a database of ours.

This page is the list of what the plugin can do. For how to install and configure
it, see [the setup and user guide](instructions.md); for the settings panel tab by
tab, see [README](README.md).

---

## The idea in one paragraph

Most task plugins ask you to leave the sentence you are writing: open a modal,
fill a form, come back. inlineOverhaul does the opposite — it keeps you on the
line. You describe, once, what a line of yours may carry (a Field: its values, its
marker, where it stands in the line), and from then on every one of those Fields
has a pair of commands, a place in the line, and a look. The line stays markdown;
the editing stops being typing.

---

## 1. Fields — your own structure for a line

A **Field** is one slot a line can carry: a status, a priority, a type, a due
date, a project link, an estimate. You define them; the plugin does not ship a
methodology.

- **Four kinds of Field**: tag (`#todo`), wikilink (`[[Project A]]`), emoji
  element (`📅 2026-09-15`), and a YAML property that travels into the note
  Transform creates.
- **Values with their own rules.** Each Field holds an ordered list of Values, and
  each Value can carry its own writing rule, so one Field can cycle
  `#todo → #doing → #done` and another `#/1 → #/2 → #/3`.
- **Child Fields.** A Field can depend on another one and appear only when its
  parent is set — a sub-status under a status, a sub-type under a type.
- **Order.** You lay out the Fields in the order they should stand in the line,
  separately for what comes before your text and what comes after it.
- **A pair of commands per Field, created for you.** Add a Field and two commands
  appear — next Value and previous Value — ready for a hotkey, with no
  configuration step in between.
- **Live preview.** The Fields editor shows the line you are building as you
  build it.

*Where:* `Tags & PKM → Fields`, `Separators`, `Writing rules`, `Placement modes`,
`Prefix priority`.

---

## 2. TagWheel — filling a line without typing

TagWheel turns the line you are standing on into a small keyboard panel: the
Fields you defined appear as choices, you move through them with the arrow keys,
and on exit the line is written back as plain markdown.

- **Two sides, two commands.** `Open TagWheel on the left` starts on the Fields
  that stand before your text, `Open TagWheel on the right` on those after it.
- **Only what applies.** Fields whose precondition is not met are not offered, so
  the panel stays as short as the line deserves.
- **Your text is never retyped.** The panel writes back only what actually
  changed, so `Ctrl+Z` after using it behaves exactly as it does without it — this
  is checked by running Obsidian's own undo history in the test suite, keystroke
  by keystroke.
- **Its own look**: colours, an optional scroller box, and a highlight for the
  line being edited.

*Where:* `Visual → TagWheel`, and the two commands under `Keyboard → Commands &
Hotkeys`.

---

## 3. Navigation — moving without the mouse

Eight commands, all of them aware that your line has structure.

- **`Move line up` / `Move line down`** — move the line, or the whole tree
  indented under it, keeping the indentation sane.
- **`Move left` / `Move right`** — one key that does the right thing by context:
  move the selected text, cycle the line Prefix (bullet, checkbox, heading), or
  indent and unindent.
- **`Jump back` / `Jump next`** — step through the note by headings, or line by
  line; you choose which, and whether the target lands in the middle of the
  screen.
- **`Move cursor left in line` / `Move cursor right in line`** — step the cursor
  through the *parts* of the line — the Prefix, each Field, your text — instead of
  through characters. Optionally step out of a word rather than into the next
  character.

*Where:* `Navigation`, five groups.

---

## 4. Visual — how the line looks while you write it

Everything here is drawing only: the file on disk is untouched.

- **Inline appearance** — size, opacity and spacing of the parts of a tagged
  line, so structure reads at a glance and your text stays dominant.
- **Color your Tags** — a colour per tag, your list, with a live preview.
- **Tag Bars** — a bar drawn under a line from the Values of a Field you pick, so
  a column of tasks shows its priority as a shape, not as text to be read.
- **Text cursor** — caret colour and width, including inside the TagWheel panel.

*Where:* `Visual`, six groups.

---

## 5. Transform — turn a line into a note

`Transform inline to note` takes the line you are on and makes a note of it, or
appends it to one that already exists.

- **Templates.** Pick a template folder and a default template; the list offers
  what is actually in that folder.
- **Naming.** Decide what the new note is called and what happens if the name is
  taken.
- **Note content.** A header line built from a date format or from fixed text, the
  Values of the line carried in as YAML properties, and a rule for the lines
  indented under it.
- **The source line.** Decide what stays behind: keep it, strip it to a link,
  carry the whole tree across.
- **Smart Rules.** A rule says «if this line carries these Values, use that
  template» — so a `#meeting` line and a `#bug` line become different notes
  without you choosing anything at the moment of writing.

*Where:* `Transform`, six groups.

---

## 6. Keyboard — three things that are not about tags

- **Expanded `Ctrl+A` (`⌘+A`)** — successive presses widen the selection in
  steps: the word, the part of the line, the line, the block, the note.
- **Smart Delete / Backspace** — deletion that knows about the structure of the
  line, so a backspace at the start of a tagged line does not scatter it.
- **Binder** — your own insert commands: a row defines a snippet and gets a
  command of its own, hotkey included. Plus `Smart bracket`, which cycles the
  brackets around the cursor or selection: none, then `[]`, then a wikilink.
- **Commands & Hotkeys** — a table of every command the plugin has, standard and
  generated, with the hotkey currently bound to it, so you can see conflicts
  without leaving the panel.

*Where:* `Keyboard`, five groups.

---

## 7. General and Advanced

- **Four module toggles** — `Navigation`, `Tags & PKM`, `Visual`, `Transform`.
  Each has a command of its own, so a whole area can be switched off from the
  command palette while you work on something else.
- **Language.** The settings panel is fully translatable: a single file holds
  every visible string — tips, tab callouts, live previews, the command
  reference, the windows the panel opens, and the messages the plugin shows while
  you type. Copy `default.js` under your own name and the panel speaks your
  language. Command names stay English: Obsidian takes those from its own
  registry.
- **Guide note.** The plugin can write a guide into your vault, so the
  instructions live where you read notes.
- **Backup.** Settings can be saved and restored, tab by tab, with hotkeys
  included.
- **Options IDs.** Turn on and every setting shows its identifier in its tip —
  useful when you are asking for help or reporting something.
- **Diagnostics.** A developer log you can switch on, and `Undo last settings
  change`, which rolls back the most recent change you made in the panel.

*Where:* `General` (four groups), `Advanced` (four groups).

---

## The full command list

Thirteen commands exist always:

| Command | What it does |
|---|---|
| `Move line up` | Move the line you are on, or its whole tree, up |
| `Move line down` | The same, downwards |
| `Move left` | Move selected text, cycle the line Prefix, or unindent |
| `Move right` | Move selected text, cycle the line Prefix, or indent |
| `Jump back` | Move the cursor to the heading or line above |
| `Jump next` | Move the cursor to the heading or line below |
| `Move cursor left in line` | Step the cursor back through the parts of the line |
| `Move cursor right in line` | Step the cursor on through the parts of the line |
| `Open TagWheel on the left` | Open TagWheel on the Fields before your text |
| `Open TagWheel on the right` | Open TagWheel on the Fields after your text |
| `Transform inline to note` | Turn the current line into a note, or append it to one |
| `Smart bracket` | Cycle the brackets around the cursor or selection |
| `Undo last settings change` | Roll back the most recent change made in the settings |

And these appear from what you configure:

- a pair per Field — next Value and previous Value;
- one per Binder row;
- one per module, to toggle it.

**No hotkey is assigned by default.** Every command arrives unbound, so nothing
you already use is taken away.

---

## What it does not do

Said plainly, so the list above can be trusted.

- **Desktop only.** Mobile is not supported, and the manifest says so.
- **It ships no translation.** The language folder holds one file, `default.js`,
  and that one belongs to the plugin. A language appears when you put a file next
  to it.
- **It is a public beta.** Back up your vault before installing or updating, and
  try Transform on notes you can afford to lose: it writes real files, and every
  vault has its own templates and properties.
- **It does not sync anything anywhere.** There is no account, no server, no
  telemetry. Your notes stay files.
- **It does not hide your markdown.** Everything it writes is text you could have
  typed yourself — which is the point, and also the limit: a line is as readable
  as the Fields you designed.

---

## Requirements

- Obsidian desktop **1.13.0** or newer — the settings panel is built on the
  declarative settings API that arrived in 1.13.
- Installed through BRAT while the plugin is in beta:
  `romkuznetsov/inline-overhaul`.

---

*This list is checked against the product, not written from memory: a regression
test asserts that every command named here exists, that every settings area is
named, and that no control removed from the panel is still advertised. If the
panel changes and this page does not, the test suite goes red.*
