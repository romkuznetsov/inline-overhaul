# Feature list

Everything inlineOverhaul does, in one list. This page lists; it does not teach.
New here? Start with the [tutorial](docs/TUTORIAL.md) or the [README](README.md).

| You want | Go to |
|---|---|
| Every control of the panel | [Settings reference](docs/SETTINGS.md) |
| Step-by-step tasks, install, recovery | [Setup and user guide](INSTRUCTIONS.md) |
| Each feature in motion | [Showcase](docs/SHOWCASE.md) |

A line written with the plugin:

```markdown
- [ ] #todo #/1 || call the bank || [[Project A]] 📅2026-09-15
```

Every part of it is ordinary markdown. Obsidian finds the tags, the link is a real link, and the date is text other plugins can read.

## Contents

- [Tags & PKM](#tags--pkm): Fields, Values, Blocks
- [tagWheel](#tagwheel): the picker over the line
- [Navigation](#navigation): moving lines and the cursor
- [Keyboard](#keyboard): smarter everyday keys and Binder
- [Transform](#transform): a line becomes a note
- [Visual](#visual): how the line is drawn
- [General and Advanced](#general-and-advanced): modules, language, backups
- [The full command list](#the-full-command-list)
- [What it does not do](#what-it-does-not-do)

## Tags & PKM

A **Field** is one slot a line can carry: a status, a priority, a project, a due date. You define the Fields; the plugin ships no methodology.

### Four types of Field

| Type | Writes | Example |
|---|---|---|
| `Tag` | a tag | `#todo` |
| `Link` | a link to a note | `[[Project A]]` |
| `Element` | an emoji marker plus a format | `📅2026-09-15` |
| `Command` | nothing: it edits the line | wraps the line in a callout |

The `Add a Field` window uses these four names. The list of Fields labels the last two `Emoji` and `Action`.

- **Element**
  - steps a date, a time, a counter or a random id
  - a date written with a space, `📅 2026-09-15`, is read too
  - can be a list of your own Values, each with its own emoji: `🙂‍↕️yes`, `🙂‍↔️no`, or an emoji alone, such as `💡`
- **Command**
  - holds categories instead of Values: `Insert callout`, `Cleanup`, `Insert codeblock`, `Tree ↔ section`
  - each category comes with ready-made presets you can rename, hide or clone
  - each category gets its own `next` and `previous` commands

### Values

- Each Field holds an ordered list of Values, and each Value has its own writing rule.
  - one Field cycles `#todo → #doing → #done`, another `#/1 → #/2 → #/3`
- **The eye** in front of a Value hides it from `next`, `previous` and tagWheel.
  - a line that already has the Value still reads it
  - works for tags, links and the list Values of an Element
- **One spelling, one Field.** A Value written the same way as a Value of another Field is refused, so the plugin never has to guess whose `#todo` it is.
- **A Value shown as your own text.** The `Show` column draws a Value as an emoji, as text you type, or as nothing. A shown link still opens its note on click.
- **Link Values follow their notes.**
  - renaming a note updates the Value
  - renaming the Value can rename the note and every link to it
- **A Prefix per Value.** A Value can bring a checkbox or another line marker with it, such as `[ ]` with `#todo`.

### Child Fields and prerequisites

- **Child Field** depends on its parent:

  | Setting | The child is offered |
  |---|---|
  | `After parent` | once the parent has a Value |
  | `Always` | on any line |
  | `On Alt` | in tagWheel after you press `Alt` on the parent |
  | `Hide` | never |

- **`Child tag format`**, per tag Field: `Separate` writes `#note #meeting`, `Nested` writes `#note/meeting`.
- **`Parent is Navigator`** turns parent Values into groups: they narrow the child list in tagWheel and are never written.
- **Prerequisites.** A Field can stay out of the line until another Field has a Value: any Value, or one you name.
  - the line preview draws such a Field paler, with `⬑Type` or `⬑#todo` under it

### Blocks and Separators

- **`Left Block`** is written before your text, **`Right Block`** after it.
- **Separators** close the Blocks off: `#todo || call the bank || [[Project A]]`.
  - after you change a Separator, `Old Separators in your notes` replaces the old one in every note
- **Custom blocks.** `Add Block` makes a Block of your own that writes where the cursor is, inside your text.
  - its own command, `tagWheel <block>`
  - `next` and `previous` of its Fields work on the Value under the cursor

### Writing rules

- **Commands per Field**, created as soon as the Field exists: `<Field> next` and `<Field> previous`.
- **Placement modes.** Whether a list bullet is added, and whether a tag you typed in your text moves into its Block.
- **Prefix priority.** Which Value decides the line marker when several bring one.
- **A ticked line**
  - `Mark ticked line` adds a tag or emoji, such as `#done` or `✅`, when you tick `- [ ]` into `- [x]`, and takes it off when you untick
  - `Dim ticked line` fades the line, `Strike through ticked line` crosses it out
- **YAML property.** Each Field names the property it becomes in a transformed note.

### The Fields editor

- A live preview of the line you are building, above the editor.
- Two heights for the editor, switched by the chevron in the group header.
- A new Field is picked as soon as you add it, with its settings on the right.

*Where:* **Tags & PKM**: `Fields`, `Separators`, `Writing rules`, `tagWheel behavior`, `Placement modes`, `Prefix priority`.

## tagWheel

tagWheel opens over the line you are on. Arrow keys move between Fields and their Values; `Enter` writes the line back as plain markdown.

| Command | Opens on |
|---|---|
| `tagWheel Left` | the Fields before your text |
| `tagWheel Right` | the Fields after your text |
| `tagWheel <block>` | the Fields of a custom block, at the cursor |

- **Only what applies.** A Field whose prerequisite is not met is not offered.
- **The other Block** either leaves the line while you choose, or stays in view.
- **Moving between Blocks.** `→` at the edge of a Block stays or walks on into the next one; with `Switch custom blocks on Tab`, `Tab` moves to the next custom block.
- **Where it opens.** The first Field, or a Field you choose for each side.
- **A selection.** Start it with lines selected and the selection stays; `Line for a selection` picks the top line, the bottom one, or where you finished selecting.
- **Write-back by difference.** Only what changed is written, checked against Obsidian's own undo history in the test suite, keystroke by keystroke.
- **Look.** Colors for the panel and its Fields, tag markers on or off, and a Scroller of neighbor Values.

> [!NOTE]
> While tagWheel is open it holds its strip in the text of the note. Undo steps that wrote those Values collapse across that gap, so a run of `Ctrl+Z` after a session can land on a line that never existed. Keeping the other Block in sight removes the case where only that Block was filled.

*Where:* behavior in **Tags & PKM → tagWheel behavior**; look in **Visual → tagWheel**, split into `Panel` and `Scroller`.

## Navigation

Eight commands that know a line has structure.

| Command | What it does |
|---|---|
| `Move up` | Move the line, or its whole tree, up |
| `Move down` | The same, downwards |
| `Move left` | Move selected text, cycle the line Prefix, or unindent |
| `Move right` | Move selected text, cycle the line Prefix, or indent |
| `Jump up` | Move the cursor to the heading or line above |
| `Jump down` | Move the cursor to the heading or line below |
| `Jump left` | Step the cursor back through the parts of the line |
| `Jump right` | Step the cursor on through the parts of the line |

- **A move** can
  - carry the indented tree with the line, or jump over a neighbor tree
  - move a heading alone or with its whole section
  - cross a heading boundary or stop at it
  - highlight what landed, in a color you pick
  - keep the line at the centre, the top or the bottom of the screen, or leave the note where it is
- **A jump** steps by word, by sentence, or to the start and end; at the end of the line it stops, wraps around, or goes on to the next line.

*Where:* **Navigation**, four groups.

## Keyboard

- **Smart `Ctrl+A`.** Each press widens the selection: word, line, tree, section, note. `Custom` picks where a press stops.
- **Smart Delete\Backspace.** `Delete` at the end of a line and `Backspace` at the start pull up the words without the indent and the Prefix, and merge the Fields of the two lines.
- **Smart Enter.** `Enter` adds a line below instead of splitting the one you are on. `Shift+Enter` can be the usual `Enter`, or Smart Enter itself.
- **Smart paste.** A pasted numbered list is counted from one, or carries on the count of a list right above it.
- **Binder.** Your own insert commands: each row is a snippet with a command of its own.
  - `Smart bracket` ships with it and cycles brackets around the cursor or selection
  - a row of type `Command` runs one category of a Command Field with its own preset: one press applies it, the next takes it off
- **Commands & Hotkeys.** Every command with the key bound to it, and a `to hotkeys` button that opens Obsidian's `Hotkeys` filtered to that group.

*Where:* **Keyboard**: `Global hotkeys`, `Binder`, `Commands & Hotkeys`.

## Transform

`Transform inline to note` turns the line you are on into a note, or appends it to a note that exists. Off out of the box.

| Part | What you set |
|---|---|
| Inline to note | the command and a floating button at the end of the line |
| New note naming | where the name comes from, and what happens when it is taken |
| Note content | templates, a line above the text, the Values carried in as YAML properties |
| Source line | what stays behind: the text, a link, a mark, the sub-lines |
| Auto-MOC in your links | a link back from the notes the line mentions |
| Smart Rules | a template picked by the Values of the line |

- **Smart Rules.** A `#meeting` line and a `#bug` line become different notes. The condition window has a search box and an `Any value` choice for each Field.
- **Auto-MOC**
  - the notes of the link Values on the line get a link to the new note; a missing note is not created
  - the link goes to the beginning, the end, or under a heading, at the top or the bottom of its list
  - after the link it can carry the Value of an Element or the date and time
  - `Use as MOC` turns this off for one link Field

*Where:* **Transform**, six groups.

## Visual

Drawing only: the file on disk stays the same.

| Group | What it draws |
|---|---|
| Inline appearance | text size and opacity of each Block, tag bubbles, a Stripe behind a Block, link colors |
| Tag Bars | a Bar in the margin, in a tag's color, down a line and its tree |
| tagWheel | the colors and the Scroller of the picker |
| Text cursor | the caret's color, width and blink |
| Cursor jump highlight | a fading circle where the cursor lands after a jump |
| Color custom tags | a color for each tag that is not a Value of a Field |

- **Link colors:** two for a wikilink (the name and the brackets), three for a Markdown link (the text, the brackets, the address).
- **Link view:** the page preview on hover for a Value shown as your own text.

*Where:* **Visual**, six groups.

## General and Advanced

- **Modules.** `Navigation`, `Tags & PKM`, `Transform`, `Visual` switch on and off separately, each with a command of its own.
- **Language.** Every visible line of the panel has a key, and the words live in one text file per language in the plugin folder. Copy `default.js` under a new name and the panel speaks your language. Command names stay English: Obsidian reads them from its own registry.
- **Guide note.** **General → Help → Guide → Read** writes the guide into your vault.
- **Backup**
  - `Save a backup` writes your setup into a note, all tabs or the ones you pick
  - `Autosave` keeps a copy whenever Obsidian starts with changed settings, in its own folder, as many as you choose
  - `Start over` returns to defaults and saves a backup first
- **Diagnostics.** `Show option IDs in tips` puts each setting's id and value into its tip; a developer log records what the plugin did.
- **Undo for settings.** `Undo last settings change` takes back the last change made in the panel.
- **What changed, after an update.** The first time you open a vault on a new version, a window shows what changed in each release since your last one, up to five releases at a time. It opens once per version and never on a fresh install.

*Where:* **General**: `Help`, `Modules`. **Advanced**: `Backup`, `Diagnostics`.

## The full command list

Each command is named after its area, such as `Navigation: Move up`, so Obsidian's `Hotkeys` screen can be filtered to one area.

<details>

<summary>Commands that always exist</summary>

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
| `Toggle Navigation module`, `Toggle Tags & PKM module`, `Toggle Transform module`, `Toggle Visual module` | General |

</details>

Commands that come from your setup:

| You add | You get |
|---|---|
| a Field | `<Field> next`, `<Field> previous` |
| a category of a Command Field | `<Field> · <category> next`, `… previous` |
| a custom block | `tagWheel <block>` |
| a Binder row | a command named after the row |

**No hotkey is assigned by default.** Every command arrives unbound.

## What it does not do

- **Desktop only.** Mobile is not supported, and the manifest says so.
- **No translation ships.** The language folder holds one file, `default.js`. A language appears when you put a file next to it.
- **It is a public beta.** Back up your vault before installing or updating, and try Transform on notes you can afford to lose: it writes real files.
- **It syncs nothing.** No account, no server, no telemetry, no network requests.
- **It hides none of your markdown.** Everything it writes is text you could have typed yourself.

## Requirements

- Obsidian desktop **1.13.0** or newer: the settings panel uses the settings API that arrived in 1.13.
- Installed through BRAT while the plugin is in beta: `romkuznetsov/inline-overhaul`.

## Where to go next

| | |
|---|---|
| [**Tutorial**](docs/TUTORIAL.md) | Fifteen minutes from install to a line that works |
| [**Settings reference**](docs/SETTINGS.md) | The panel, tab by tab |
| [**Setup and user guide**](INSTRUCTIONS.md) | Configuration, Transform safety, troubleshooting |
| [**Visual showcase**](docs/SHOWCASE.md) | Every feature in motion, section by section |
| [**Changelog**](CHANGELOG.md) | What changed in every release |
