# Settings reference

Every control in the settings panel, tab by tab, in the panel's own order and under the panel's own names.
Looking for a walkthrough instead? Start with the [tutorial](TUTORIAL.md) or the [README](../README.md).

## How to read this page

- Open the panel the ordinary way: **Settings → Community plugins → inlineOverhaul**. There is no command for it.
- Paths read the way the panel does: **Tab → Group → Control**.
- Defaults are what a fresh install starts with. In the panel, every dropdown marks its default with `(default)`.
- A control that shows only under a condition says so in its row: "With `Smart Enter` on: …".
- Each tab opens with a `Before you start` callout, and most controls carry a `?` with a longer tip. **General → Help** switches both off.
- Group headings and subheadings fold with the triangle in front of them. The panel remembers what you folded until the plugin reloads or Obsidian restarts; it is not saved with your settings.
- Every change is saved at once. The command `Undo last settings change` rolls back the latest one.

## General

The plugin's parts, the panel's language and how much help you see.

### Help

The language of the panel, where to start, and how much help you want along the way.

| Control | What it does | Default |
|---|---|---|
| `Language` | The language of this panel and of the plugin messages | `English` |
| `Show callouts` | Keeps the boxes that say what a tab or a block of settings is for | on |
| `Show tips` | Puts a `?` beside anything that needs more explanation | on |
| `Guide` → `Read` | Writes the note `inlineOverhaul Guide.md` into your vault on the first press and opens it after that. The note is yours: the plugin never writes over it | — |
| `Changelog` → `Open` | Opens `CHANGELOG.md` in your browser, every release, newest first | — |

A language other than English is a text file in the plugin folder:

- the plugin keeps one file there, `<your vault>/.obsidian/plugins/inline-overhaul/texts/default.js`, and updates it with every new or reworded line
- copy it under a new name and translate it: the copy appears in `Language`
- your copy is never overwritten, and a line you leave out stays in English
- command names stay in English whatever you pick, so the panel matches Obsidian's command palette

### Modules

The plugin has four parts, and each turns off on its own.

| Control | What it does | Default |
|---|---|---|
| `Navigation` | Moving lines, text and the cursor | on |
| `Tags & PKM` | Fields, tagWheel and the Field commands | on |
| `Transform` | `Transform inline to note`, the only part that writes new files | on |
| `Visual` | Tag colors, Tag Bars and the rest of the **Visual** tab | on |

- A part that is off touches no notes, and its commands only say that it is switched off.
- Its tab hides its settings. Turn it back on and everything is as you left it.
- With `Visual` off the editor goes back to your theme's look. The tagWheel colors stay, because the panel needs them to stay readable.
- Each part also has a command, `Toggle <module> module`.

See it in motion: [Modules](SHOWCASE.md#modules).

## Keyboard

Keys that do more inside your lines, your own insert commands, and every command with its hotkey.

### Global hotkeys

Four keys you already use, `Ctrl/Cmd+A`, `Del` and `Backspace`, `Enter` and `Ctrl/Cmd+V`, can do the obvious thing inside your lines. None of them is rebound: each setting changes what a key does in one case only, and all of them start off.

#### Smart SelectAll (Ctrl+A)

| Control | What it does | Default |
|---|---|---|
| `Smart Ctrl+A` | `Ctrl/Cmd+A` takes the line first, then widens | off |
| `Selection steps` | With `Smart Ctrl+A` on: how much more each press picks up (`Line, note`, `Line, tree, note`, `Line, tree, heading, note`, `Word, line, tree, heading, note`, `Custom`) | `Line, note` |
| `Steps to cycle through` | With `Selection steps` = `Custom`: tick where a press stops among `word`, `line`, `tree`, `heading` and `note`. Nothing ticked leaves the key as Obsidian's own | — |
| `Count presses by timer` | With `Smart Ctrl+A` on: a pause longer than the time below starts over from the first step | off |
| `Time between presses` | With `Count presses by timer` on: how long you can pause and still be in the middle of a sequence | `700 ms` |
| `Last press clears highlighting` | With `Smart Ctrl+A` on: after the last step, one more press drops the selection and returns the cursor | off |

See it in motion: [Smart Ctrl+A](SHOWCASE.md#smart-ctrla).

#### Smart Delete\Backspace

| Control | What it does | Default |
|---|---|---|
| `Smart Delete` | `Del` at the end of a line brings up the words of the next line without its indent and Prefix | off |
| `Smart Backspace` | `Backspace` at the start of a line sends it up without its own indent and Prefix. Works without `Smart Delete` | off |
| `Drop the line Prefix` | With either key on: takes the bullet, checkbox, number or quote mark off the arriving line, not only its indent | on |
| `Join with a space` | With either key on: puts one space between your text and the text that arrives | on |

An empty bullet disappears in one press. In the middle of a line, or with text selected, both keys work as usual.

See it in motion: [Smart Delete and Backspace](SHOWCASE.md#smart-delete-and-backspace).

#### Smart Enter

| Control | What it does | Default |
|---|---|---|
| `Smart Enter` | `Enter` adds a line below instead of splitting the one you are on | off |
| `Where it works` | With `Smart Enter` on: `Whole line`, or `Text only` (your text between the Separators) | `Whole line` |
| `Prefix on the new line` | With `Smart Enter` on: `Same as above`, `None`, or `Numbered lines only` | `Same as above` |
| `Use Shift+Enter instead` | With `Smart Enter` on: `Shift+Enter` adds the line and `Enter` splits as usual | off |
| `Shift+Enter as usual Enter` | With `Smart Enter` on and `Use Shift+Enter instead` off: `Shift+Enter` splits the line the way plain `Enter` does | off |

A line without Separators counts as all text. In code, in tables and on empty list items `Enter` works as usual.

See it in motion: [Smart Enter](SHOWCASE.md#smart-enter).

#### Smart Paste (Ctrl+V)

| Control | What it does | Default |
|---|---|---|
| `Smart paste` | A pasted numbered list counts from one, or keeps counting when you paste it right under a list. Pasting `1. text` onto a numbered line drops the doubled number | off |

Anything else you paste comes in as usual.

See it in motion: [Smart paste](SHOWCASE.md#smart-paste).

### Binder (custom insert commands)

For text you type over and over: each row of this table is a command that drops its text in at the cursor.

- **Columns:** `Inserts`, `Command name`, `Description`, `Hotkey`.
- **Built in:** one row, `Smart bracket`, cycles the brackets around the cursor or selection: none, then `[]`, then a wikilink.
- **`Add command`** opens a small window.
  - `Inserts`: type the text, or pick it below from `Emoji`, `Symbol` or `Kaomoji`, with a search by name.
  - `Command name`: fills itself in from what you pick, and you can change it.
  - `Type`: `Text` inserts your text. `Action` runs one category of an `Action` Field (`Insert callout`, `Cleanup`, `Insert codeblock`, `Tree ↔ section`) with a preset of its own.
- **An `Action` row** shows its category in `Inserts` and its preset in a line under the row; the triangle at its name opens it. The preset can change any time.
  - One press applies the preset, the next press on its result takes it off. `Cleanup` only applies.
- **After a row is made**, only `Description` can change. To change its text, delete the row and add it again; its command goes with it.
- **`Hotkey`** opens Obsidian's `Hotkeys` screen at that command.

See it in motion: [Binder: your own insert commands](SHOWCASE.md#binder-your-own-insert-commands).

### Commands & Hotkeys

Every command the plugin has, in one list, with the key it has now. None has a key until you give it one.

- **Columns:** `Command`, `Description`, `Hotkey`. A command with no key reads `not set`.
- **Areas:** Navigation, Tags & PKM, Transform, Binder and General. **Tags & PKM** has two parts: `Main commands` and `Commands from your Fields`.
- **Names** carry their area in Obsidian: `Move up` in this list is `Navigation: Move up` in the palette.
- **`to hotkeys`** beside each heading (an area, one of its parts, or one of your Fields) opens Obsidian's `Hotkeys` screen filtered to exactly those commands.
- **A `Hotkey` cell** opens the same screen at that one command.
- The list follows your setup: each Field and each Binder row adds commands, and a module that is off removes its own.

See it in motion: [Commands and hotkeys](SHOWCASE.md#commands-and-hotkeys).

## Navigation

Moving lines, text and the cursor without the mouse.

### Move lines (up/down)

Move a line up or down with a key, alone or with the lines indented under it. Commands: `Move up`, `Move down`.

| Control | What it does | Default |
|---|---|---|
| `Move lines` | Lets the keys pick up a line and move it | on |
| `Moving behavior` | With `Move lines` on: `Line only`, or `Whole tree` with everything indented under it | `Line only` |
| `Jump over neighbor trees` | With `Moving behavior` = `Whole tree`: one press moves your tree past the whole neighbor tree instead of into its lines | off |
| `Moving headings` | With `Move lines` on: `Heading only`, or `Whole section` with all its text | `Heading only` |
| `Cross heading boundaries` | With `Move lines` on: lets a line travel past a heading into the part of the note below it | on |
| `Highlight after moving` | With `Move lines` on: keeps the lines highlighted once they land | off |
| `Moved lines color` | With `Highlight after moving` on: the color of that highlight. Unset, it is your theme's selection color | unset |
| `Follow the moved line` | With `Move lines` on: scrolls the note to the line you moved | on |
| `Where the line lands` | With `Follow the moved line` on: `Center`, `Top` or `Bottom` of the screen | `Center` |

See it in motion: [Move a line with its tree](SHOWCASE.md#move-a-line-with-its-tree) and [Where the moved line ends up](SHOWCASE.md#where-the-moved-line-ends-up).

### Move lines (left/right)

`Move left` and `Move right` do three jobs: slide selected text along the line, change the marker at the start of the line, or change its indent. Two tables at the top of the group show which job a key does on which line; the first line that fits wins.

#### Move text

| Control | What it does | Default |
|---|---|---|
| `Move selected text` | Slides a highlighted phrase along its line | on |
| `Movement step` | With `Move selected text` on: `Auto`, `Character`, `Word`, or `Off` | `Auto` |
| `Step out of the word` | With `Movement step` = `Auto`: a highlighted part of a word carries on past the word it came from | off |
| `Continue past Separators` | With `Move selected text` on: the highlighted text can leave your text and move into the tags at either end | on |

#### Moving lines (left and right)

| Control | What it does | Default |
|---|---|---|
| `Cycle line Prefixes` | Turns a line with no indent into a heading, a bullet, a numbered item or plain text, one press at a time. The list of Prefixes under it sets the order; an empty row means plain text | on |
| `Cycle in both directions` | With `Cycle line Prefixes` on: `Move right` changes the marker too, on a line with no indent | on |
| `After the last one` | With `Cycle line Prefixes` on: `Indent`, or `Start over` from the top of the list | `Indent` |
| `Change the indent` | `Move right` indents a list item one step, `Move left` takes one step off | on |
| `Indent the whole tree` | With `Change the indent` on: the lines indented under the line take the same step | off |

Plain text is never indented, because Obsidian would show it as a code block.

See it in motion: [Move selected text](SHOWCASE.md#move-selected-text) and [Cycle the line marker](SHOWCASE.md#cycle-the-line-marker).

### Jump inside a line (left/right)

The cursor hops along a line by word, by sentence or to one end of your text, and by default stays between the Separators. Commands: `Jump left`, `Jump right`.

| Control | What it does | Default |
|---|---|---|
| `Move cursor inside a line` | Lets the keys walk the cursor along the line | on |
| `Step size` | With `Move cursor inside a line` on: `Word`, `Sentence`, or `Start or end` | `Word` |
| `Continue past Separators` | With `Move cursor inside a line` on: the cursor can leave your text and walk into the tags at either end | off |
| `What to do at the end` | With `Move cursor inside a line` on: `Stop`, `Wrap around`, or `Next line` | `Wrap around` |

See it in motion: [Jump inside a line](SHOWCASE.md#jump-inside-a-line).

### Jump inside a note (up/down)

Skip through a long note by its headings instead of scrolling. Commands: `Jump up`, `Jump down`.

| Control | What it does | Default |
|---|---|---|
| `Jump between headings` | Turns on the `Jump up` and `Jump down` commands | on |
| `Jump target` | With `Jump between headings` on: `Headings`, or `Lines` (the next written line, skipping empty lines, rules and tables) | `Headings` |
| `Where in the section` | With `Jump target` = `Headings`: `Start and end`, `Start only`, or `End only` | `Start and end` |
| `Cursor position after jumping` | With `Jump between headings` on: `Line start`, `Line end`, `Text start`, or `Text end` | `Text end` |
| `Follow the jump target` | With `Jump between headings` on: scrolls the note so the line you land on is on screen | on |
| `Where the target lands` | With `Follow the jump target` on: `Center`, `Top` or `Bottom` of the screen | `Center` |

See it in motion: [Jump inside a note](SHOWCASE.md#jump-inside-a-note).

## Tags & PKM

Your Fields, the Values they offer, and where on the line they go.

### Fields

A Field is one thing a line can have: a tag, a link to a note, an emoji item such as a date, or an edit of the line. The group holds a live preview of a line and the Fields editor in two columns.

**Live preview**

- One chip per Field, in the order they are written, with your text in the middle and a Separator at each end of it.
- Chips left of your text are the Left Block, chips right of it the Right Block. Your custom blocks sit under the line, at the end of an arrow from your text.
- A Field with a `Prerequisite Field` is drawn paler, with a small `⬑Type` or `⬑#todo` under it: the Field or the Value it waits for.

**Left column: the list of Fields**

- The list is drawn as two halves of a line: `Left Block` is written before your text, `Right Block` after it.
- Drag a Field to reorder it or to move it into another Block, or step it with the arrows.
- `Add Block` adds a custom block under `Right Block`, named `Custom block 1` and so on.
  - Its Fields are written where the cursor is, by its own command `tagWheel <block>`.
  - The pencil renames it, and its command follows the new name.
  - The bin deletes it together with its Fields, after a window that names them.
- `Add Field` opens the `Add a Field` window: `Name`, `Type`, `Block`, and the first Values with a preview. The new Field opens on the right at once.
- The chevron at the right edge of the group header switches the editor between its full height and a fixed height that scrolls.

**Four types of Field**, picked in `Add a Field`:

| Type | Writes | Example |
|---|---|---|
| `Tag` | a tag | `#todo` |
| `Link` | a link to a note | `[[Project A]]` |
| `Element` | an emoji with a date, a time, a count, a random id, or a Value from your own list | `📅2026-09-15`, `🙂‍↕️yes` |
| `Action` | nothing: it edits the line, such as wrapping it in a callout | — |

In the list of Fields each type is marked by a small tile: `#`, `[[`, `☺`, `/`; its name shows on hover.

**Right column: the Field picked on the left**, top to bottom:

| Row or section | What it holds |
|---|---|
| `Name in tagWheel` | A shorter name for the tagWheel row |
| `Child name in tagWheel` | Shown once the Field has child Values: the name of its child Field in tagWheel, `sub` when empty |
| `Values` | `Tag` and `Link`: the ordered list `next` and `previous` walk (see below) |
| `Value` | `Element`: `Emoji prefix`, `Value format`, `Steps by`, and the row that `Steps by` asks for |
| `Categories` | `Action`: the kinds of edit and their presets (see below) |
| `Behavior` | How the Field acts on a line (see below) |
| `YAML property` | Which property of a transformed note the Field becomes (see below). Not for `Action` |
| `Commands` | The Field's own commands and the key each one is on |

`Values`, `Value`, `Categories`, `Behavior`, `YAML property` and `Commands` are sections that fold.

**The `Values` table**

- Columns: `Level`, `Value`, `Prefix`, `Show`, and for tags also `Fill`, `Text`, `Side` and `Preview`.
- `Level` arrows make a Value a child of the one above, or top-level again. A child Field's Values are the ones marked child here.
- `Prefix` is the checkbox the Value puts at the start of the line, such as `[ ]`.
- `Show`: `default` draws the Value as itself, `empty` draws only its colored bubble, `custom` draws your text instead. A shown link still opens its note on click.
- The eye in front of a Value hides it from `next`, `previous` and tagWheel without deleting it. A line that already has it still reads it, and the next step goes on to its neighbor.
- A Value written the same way as a Value of another Field is refused with a message.

**`Steps by`** for an `Element`:

| Choice | Next row | What `next` does |
|---|---|---|
| `Fixed step` | `Amount` | Adds the same amount: `📅2026-12-10` → `📅2026-12-11` |
| `Command` | `Command` | Writes a fresh Value: `Current date and time`, `Random numbers` or `Random characters` |
| `Custom step` | `Steps` | Walks steps you write, one per line; `END` removes the Value |
| `List of Values` | `Values` | Walks your own list, each Value with its emoji: `🙂‍↕️yes`, `🙂‍↔️no`, or an emoji alone such as `💡` |

**`Categories`** of an `Action` Field: `Insert callout`, `Cleanup`, `Insert codeblock` and `Tree ↔ section`.

- Each category has ready-made presets you can rename, hide, clone and reorder, and its own `next` and `previous` commands.
- The settings of a preset sit in the row under its category.

**`Behavior`**, top to bottom:

| Control | What it does | Default |
|---|---|---|
| `Active` | `Yes`, `No`, or `Commands only` (tagWheel hides the Field, its commands still work) | `Yes` |
| `Prefix behavior` | `Strict`: the Value also sets the start of the line, such as its checkbox. `Insert only`: the Value is added and a plain line stays plain. Not shown for a Field in a custom block or a `Command` Field | — |
| `Child Field` | With child Values: `After parent`, `Always`, `On Alt`, or `Hide`. The first child Value sets it to `After parent` | `After parent` |
| `Parent is Navigator` | With child Values: `On` makes parent Values with children only narrow the child list, never written. Not available with `Hide` | `Off` |
| `Parent Value` | With `Child Field` = `Always` and `Parent is Navigator` off: `Child only`, or `Add parent Value` | `Child only` |
| `Child tag format` | `Tag` Fields with child Values: `Separate (#doing #review)` or `Nested (#doing/review)`. Each Field keeps its own choice | `Separate (#doing #review)` |
| `Prerequisite Field` | `Yes` makes the Field wait until another Field has a Value. Then `Choose prerequisite Field` and `Prerequisite Value` (`Any Value`, or one Value) appear. Not for a child Field or a `Command` Field | `No` |

An `Action` Field has only `Active` here.

**`YAML property`**

| Control | What it does | Default |
|---|---|---|
| `Property` | The note property this Field goes into. Empty: the Field is not copied | empty |
| `Property type` | `Auto`, `Single Value`, or `List` | `Auto` |
| `How to show Value in YAML` | `Raw` (`#todo`, `[[Anna]]`) or `Clean` (`todo`, `Anna`), for the whole Field | `Raw` |
| `YAML of navigator values` | With `Parent is Navigator` on: also writes the navigator of a child Value into this property | — |
| `Use as MOC` | `Link` Fields: `Yes` lets `Link the notes you mention` file new notes into the notes of these Values | `Yes` |
| `Preview` | What this Field writes into the note, such as `type: todo` | — |

**`Commands`**: every Field gets `<Field> next` and `<Field> previous`, and a child Field adds its own pair. In a custom block they work on the Value under the cursor; away from a Value they put the first or the last one there.

See it in motion: [One Field and its Values](SHOWCASE.md#one-field-and-its-values), [next and previous](SHOWCASE.md#next-and-previous), [Add a Field](SHOWCASE.md#add-a-field), [Child Fields](SHOWCASE.md#child-fields) and [A Block at the cursor](SHOWCASE.md#a-block-at-the-cursor).

### Separators

Two markers split your line: your own text goes between them, the Fields sit before and after. The group starts folded.

| Control | What it does | Default |
|---|---|---|
| `First Separator` | Goes between the tags at the front and the start of your sentence | `\|\|` |
| `Second Separator` | Goes at the end of your sentence, before the dates and links. It may match the first one | `\|\|` |
| `Old Separators in your notes` | After you change a Separator: `Replace in all notes` puts the new one into lines written before, after showing how many lines and notes. Only the Separator changes, and the row goes away once done | — |

See it in motion: [Blocks and Separators](SHOWCASE.md#blocks-and-separators).

### Writing rules

The small habits: what is left when a line empties, where the cursor waits, and what ticking a checkbox adds.

| Control | What it does | Default |
|---|---|---|
| `When a line empties out` | When stepping takes off the last Value: `Keep bullet`, or `Clear line` | `Keep bullet` |
| `Cursor after an action` | `Text end`, `Don't move`, or `Line end` | `Text end` |
| `Mark ticked line` | A tag or emoji added when you tick a checkbox and taken off when you untick it. A mark that is a Value of one of your Fields takes that Field's place | empty |
| `Where the tick mark goes` | With a mark set: `Left Block` or `Right Block` | `Right Block` |
| `Strike through ticked line` | With a mark set: crosses out the whole line once it carries the mark. Only the look changes | off |
| `Dim ticked line` | With a mark set: fades a line once it carries the mark | off |
| `Opacity of ticked line` | With `Dim ticked line` on: from `0` (the line as it is) to `80` (barely readable) | `35%` |
| `Color of ticked line` | With `Dim ticked line` on: a color of your own for a ticked line. Unset keeps the theme text color | unset |

See it in motion: [A mark for a ticked line](SHOWCASE.md#a-mark-for-a-ticked-line).

### tagWheel behavior

How tagWheel moves: the Field it opens on, the Values it is not picking, and where the arrows go. Its look is under **Visual → tagWheel**.

| Control | What it does | Default |
|---|---|---|
| `Active Field on opening` | `First Field`, `Middle Field`, or `Chosen Field` | `First Field` |
| `Left Block active Field` | With `Chosen Field`: the Field it opens on, on the left | `First Field` |
| `Right Block active Field` | With `Chosen Field`: the Field it opens on, on the right | `First Field` |
| `Values in the other Block` | `Hide`, or `Show` (the line is really changed while the picker is open) | `Hide` |
| `Line for a selection` | Started with lines selected: `Top line`, `Bottom line`, or `Where selecting ended`. Picking a Value changes only that line | `Top line` |
| `tagWheel navigation behavior` | At the last Field on a side: `Stay in Block`, or `Next Block` | `Stay in Block` |
| `Switch custom blocks on Tab` | Once a custom block exists: `Tab` in a custom block's tagWheel moves on to the next custom block | off |

See it in motion: [How it moves](SHOWCASE.md#how-it-moves) and [The Field it opens on](SHOWCASE.md#the-field-it-opens-on).

### Placement modes

Each Field in the Left or Right Block has a `Prefix behavior` mode, `Strict` or `Insert only`; these rows fine-tune both.

| Control | What it does | Default |
|---|---|---|
| `Strict: add a bullet` | Starts the line with a bullet when the Field's Value has no line start of its own. Headings are never changed | off |
| `Insert only: use Field Prefix` | A Value with a Prefix of its own, such as `[ ]` on `#todo`, may change the start of the line after all | on |
| `Keep typed tags in text` | A tag or link you type between words or at the end stays your word. Off, a Value of a Field in your text moves into its Block | on |

See it in motion: [Where Values land](SHOWCASE.md#where-values-land).

### Prefix priority

When two Values both want the start of the line, these rules pick the winner.

| Control | What it does | Default |
|---|---|---|
| `Decide by` | `Field order`, or `Prefix order` (a list of line starts you rank, shown under it) | `Field order` |
| `Field order source` | With `Decide by` = `Field order`: `Field order` of your Blocks, or `Manual` (a list of Fields you arrange, shown under it) | `Manual` |
| `Parent or child wins` | When a tag and its child Value both carry a Prefix: `Parent tag` or `Child tag` | `Child tag` |

In both lists the row nearest the top wins. Drag a row, or use the arrows.

See it in motion: [A Value that brings a checkbox](SHOWCASE.md#a-value-that-brings-a-checkbox).

## Transform

Turning a line you have already written into a note of its own.

> [!CAUTION]
> `Transform inline to note` rewrites the line you are on and writes real files. It is off out of the box. Read [the guide](../INSTRUCTIONS.md#turn-a-line-into-a-note) before turning it on.

Every group below `Inline to note` shows only with `Inline to note` on.

### Inline to note

Press a key and the line becomes a note of its own, or is added to a note you already have. Command: `Transform inline to note`.

| Control | What it does | Default |
|---|---|---|
| `Inline to note` | Allows this to create notes and add to notes you already have | off |
| `Templates folder` | The folder your note templates live in | empty |
| `Default template` | The template used when no Smart Rule applies | empty |
| `New notes folder` | Where new notes go. Empty keeps them next to the note you are in | empty |
| `Floating button` | Puts a small button at the end of the line you are on, with a preview under it | off |
| `Distance from the text` | With `Floating button` on: room between the line and the button | `12 px` |
| `Open note after creation` | Jumps straight to the note once it is written | off |

See it in motion: [A line becomes a note](SHOWCASE.md#a-line-becomes-a-note).

### New note naming

Where the name of a new note comes from.

| Control | What it does | Default |
|---|---|---|
| `Note name` | `From line`, or `Ask` | `From line` |
| `Name brackets` | Two characters; whatever you put between them becomes the name | `[]` |
| `Words to use instead` | How many of the first words to use when there are no brackets | `6` |
| `If the name already taken` | `New note`, `Add to existing`, or `Overwrite` | `New note` |

### Note content

What the note looks like inside: where your text goes and what sits above it.

| Control | What it does | Default |
|---|---|---|
| `Where to put the text` | `Beginning`, `End`, or `Under heading` | `End` |
| `Name of the heading` | With `Under heading`: the heading your text is filed under | empty |
| `If heading not found` | With `Under heading`: where the heading is added, `Beginning` or `End` | `End` |
| `Line above the text` | `Fixed text`, `Date and time`, or `None` | `Date and time` |
| `Line above is a heading` | Unless `None`: `Plain text`, or a heading level `1` to `6` | `3` |
| `Text of the line above` | With `Fixed text`: typed into the note exactly as written | `Captured` |
| `Date format` | With `Date and time`: how the date is written | `YYYY-MM-DD HH:mm` |

Each Field's `YAML property` decides which property of the new note it becomes.

### Source line

What happens to the line you pressed on, after the note is safely saved. A live preview at the top shows the line before and after.

| Control | What it does | Default |
|---|---|---|
| `Sub-lines (tree) behavior` | `Keep` them where they are, or `Move` them into the note | `Keep` |
| `What happens with current line` | `Remove`, `Keep`, `Keep without name`, or `Keep first words` | `Remove` |
| `Words to keep` | With `Keep first words`: how much of the line stays | `3` |
| `Fields to keep` | Which Fields stay on the line, ticked one by one, with `Keep all` and `Keep none` | — |
| `Keep sub-fields` | A Field you keep keeps its child Values on the line too | off |
| `Insert wikilink in current line` | Puts a link to the new note on the line | on |
| `Mark transformed line` | A word or tag added to the line so you can see it was handled | `#processed` |
| `Where the mark goes` | With a mark set: `Left Block` or `Right Block` | `Right Block` |
| `Dim transformed line` | With a mark set: fades a line once it carries the mark | off |
| `Opacity of transformed line` | With `Dim transformed line` on: from `0` (the line as it is) to `80` (barely readable) | `35%` |
| `Color of transformed line` | With `Dim transformed line` on: unset keeps the color your theme gives the text | unset |

See it in motion: [What stays behind](SHOWCASE.md#what-stays-behind).

### Auto-MOC in your links

When a line links to other notes, each of them can get a link back to the new note.

| Control | What it does | Default |
|---|---|---|
| `Link the notes you mention` | Writes a link to the new note into the notes of the link Values on the line, if those notes exist. A link Field with `Use as MOC` = `No` is left out | off |
| `Link to Navigator` | With `Link the notes you mention` on: also writes the link into the navigator note of a child link | off |
| `Add empty line before wikilink` | With `Link the notes you mention` on: keeps a blank line between the links written into a note | on |
| `Where to put the link` | With `Link the notes you mention` on: `Beginning`, `End`, or `Under heading` | `End` |
| `Name of the heading` | With `Under heading`: the heading the link is filed under | empty |
| `If heading not found` | With `Under heading`: `Beginning` or `End` | `End` |
| `Add after the link` | With `Link the notes you mention` on: `Nothing`, `Field Value`, or `Date and time` | `Nothing` |
| `Field after the link` | With `Field Value`: the `Element` Field whose Value follows the link | `None` |
| `Emoji before the date` | With `Date and time`: an optional mark in front of the date | empty |
| `Date format` | With `Date and time`: how the date after the link is written | `YYYY-MM-DD HH:mm` |
| `Place in the list` | With `Under heading`: `Top` or `Bottom` of the links under that heading | `Bottom` |

See it in motion: [Links back to the notes you mention](SHOWCASE.md#links-back-to-the-notes-you-mention).

### Smart Rules

A rule spots a kind of line by the Values it carries and picks the template for it. With no rules, `Default template` is used for every line.

- **`Add rule`** adds a rule card. Its name is optional, `Rule 1` and so on when empty.
- **Conditions:** `when the line has` a `Tag`, an `Element`, a `Link` or a `Field`.
  - Within one kind, any one Value is enough (`or`). Every kind you fill in must be on the line (`and`).
  - A rule with no conditions is not used.
- **The condition window** opens from `Add` beside each kind.
  - A search box on top, `Find a Value`; `Enter` takes the first match.
  - Each Field is listed with its own `Any value` button, which accepts every Value of that Field.
  - The Values sit flat under their Field; click one to add it.
- **`Use template`**: the template for lines this rule matches.
- **`Move to folder`**: `Default`, `Next to note`, or `Other folder…`.
- **`Advanced settings`**: `Default` follows **Transform → Note content**; `Custom` gives the rule its own copy of those rows.
- **Card tools:** drag to reorder, fold the card to a one-line summary, switch the rule off and on, remove it.
- Two rules that can match the same line conflict, and the card says so: neither is used.

See it in motion: [A template per line](SHOWCASE.md#a-template-per-line).

## Visual

How a tagged line looks while you write it. Nothing here changes a character in your file.

### Inline appearance

Tags become small colored bubbles, and links and dates stay ordinary text. A live preview at the top shows real Values.

#### Line view

| Control | What it does | Default |
|---|---|---|
| `Opacity of the Left Block` | Dims everything written before your text | `100%` |
| `Opacity of the Right Block` | Dims everything written after your text | `100%` |
| `Left Block text size` | How big everything before your text is written | `100%` |
| `Right Block text size` | How big everything after your text is written | `100%` |
| `Color the Block with Stripe` | A Stripe behind the Left Block and the Right Block | off |
| `Stripe direction` | With `Color the Block with Stripe` on: `Left`, `Right`, or `Both` | `Both` |
| `Stripe color` | With `Color the Block with Stripe` on: unset follows your theme | unset |
| `Stripe opacity` | With `Color the Block with Stripe` on: how strongly the Stripe shows through | `12%` |
| `Stripe height` | With `Color the Block with Stripe` on: how far it reaches above and below the writing | `60%` |
| `Stripe width` | With `Color the Block with Stripe` on: how far it reaches past the Block on both sides | `50%` |

Your own text between the Separators never changes.

#### Tag view

These rows shape the tag bubble only; dates and links have no bubble.

| Control | What it does | Default |
|---|---|---|
| `Tag bubble width` | Breathing room either side of the word | `100%` |
| `Tag bubble height` | How tall the bubble is around the word | `100%` |
| `Tag bubble corners` | From fully rounded to completely square | `0` |
| `Empty tag bubble width` | Width of a bubble whose `Show` is `empty` | `100%` |

#### Link view

Two rows give a link Value shown as your own text (`Show` = `custom`) what an ordinary link has, and five colors cover wikilinks and hyperlinks.

| Control | What it does | Default |
|---|---|---|
| `Preview on hover` | Hovering a Value shown as your own text opens the page preview; hold `Ctrl` while hovering | off |
| `Drag to move` | A Value shown as your own text can be dragged into another note | off |
| `Link target color` | The name you read in a wikilink, between `[[` and `]]` | unset |
| `Link brackets color` | The markup around it: `[[` and `]]` | unset |
| `Hyperlink target color` | The text of a Markdown link, between the square brackets | unset |
| `Hyperlink brackets color` | The square brackets and the round ones, without the address | unset |
| `Hyperlink address color` | The address, inside the round brackets or written on its own | unset |

A live preview at the foot of the group shows all three kinds of link.

See it in motion: [Tags, Blocks and the Stripe](SHOWCASE.md#tags-blocks-and-the-stripe) and [Link colors](SHOWCASE.md#link-colors).

### Tag Bars

A colored Bar in the margin shows what a line and everything nested under it is about. One tag Field draws them, in the colors of its Values.

| Control | What it does | Default |
|---|---|---|
| `Tag Bars` | Draws the Bars | off |
| `Which Field draws Bars` | With `Tag Bars` on: the one tag Field that draws them | `None` |
| `Number of Bars` | With `Tag Bars` on: how far down the nesting to keep drawing them | `2` |
| `Show the Field’s tag` | With `Tag Bars` on: keeps the tag on the line, or lets the Bar speak for it | on |
| `Hide the leftover marker` | With `Show the Field’s tag` off: tidies away a Separator that has nothing left beside it | off |
| `Bar arrangement` | With `Tag Bars` on: `Parent outside`, or `Rotate` | `Parent outside` |
| `Bar thickness` | With `Tag Bars` on: how wide each Bar is | `2 px` |
| `Space between Bars` | With `Tag Bars` on: the gap between one level and the next | `12 px` |
| `Distance from the text` | With `Tag Bars` on: how far the Bars sit from where your line begins | `20 px` |
| `Vertical gap between Bars` | With `Tag Bars` on: blank left above and below a Bar | `2 px` |
| `Bars for the whole tree` | With `Tag Bars` on: a Bar runs down everything nested under its line | on |
| `Join Bars in a tree` | With `Tag Bars` on: a parent and its own children draw one unbroken Bar | on |

See it in motion: [Tag Bars](SHOWCASE.md#tag-bars).

### tagWheel

tagWheel is a picker over the line: your Fields run across it and the Values of the current Field run down. A live preview at the top shows both parts. Commands: `tagWheel Left`, `tagWheel Right`.

#### Panel

| Control | What it does | Default |
|---|---|---|
| `Show tag markers` | Shows the hash and emoji in the picker, or just the words | on |
| `tagWheel Value names` | For a Field that carries a Value: `Default`, `Custom`, or `Custom + default` | `Default` |
| `Highlight the tagWheel line` | Marks the line while the picker is open | on |
| `Inactive Field text color` | The Field names you are not standing on, while the line is marked | unset |
| `Bold Field names` | Every Field that shows its own name is bold, while the line is marked | off |
| `Active Field text color` | The Field you are on, while the line is marked | unset |
| `Chosen Value text color` | A Field that already carries a Value, while the line is marked | unset |
| `Background color` | Behind the picker, while the line is marked | unset |

#### Scroller

| Control | What it does | Default |
|---|---|---|
| `Scroller` | Shows the next and previous Values around the current one | off |
| `Scroller opening direction` | With `Scroller` on: `Up`, `Down`, or `Both` | `Both` |
| `Scroller Value names` | With `Scroller` on: `Default`, `Custom`, or `Custom + default` | `Default` |
| `Scroller background color` | With `Scroller` on: behind the box of neighboring Values | unset |
| `Scroller text color` | With `Scroller` on: the Values you are not on | unset |
| `Scroller size` | With `Scroller` on: how many neighboring Values stay visible | `3` |

See it in motion: [Its look](SHOWCASE.md#its-look) and [Its colors](SHOWCASE.md#its-colors).

### Text cursor

The blinking line that shows where your typing goes, in a color and shape of your own.

| Control | What it does | Default |
|---|---|---|
| `Color the text cursor` | Draws the caret in a color you pick | off |
| `Cursor color` | With `Color the text cursor` on: the color of the caret | unset |
| `Shape the text cursor` | Sets how thick the caret is and how fast it blinks, instead of taking both from your theme | off |
| `Cursor width` | With `Shape the text cursor` on: thickness in pixels | `2 px` |
| `Blink speed` | With `Shape the text cursor` on: from `0` (no blinking) to `10` | `5` |

A live preview under the rows shows the caret as set.

### Cursor jump highlight

A circle where the cursor lands after a jump, shrinking away by itself. It follows `Jump up` and `Jump down`.

| Control | What it does | Default |
|---|---|---|
| `Highlight where you land` | Draws a fading circle where the cursor lands | off |
| `Highlight color` | With `Highlight where you land` on: unset uses the accent color of your theme | unset |
| `Highlight size` | With `Highlight where you land` on: how wide the circle is when it appears | `18 px` |
| `How long it lasts` | With `Highlight where you land` on: the time the circle takes to shrink away | `450 ms` |
| `Minimum time between jumps` | With `Highlight where you land` on: jumps closer together get no circle | `0 ms` |
| `Use inside current line` | With `Highlight where you land` on: also marks hops between the parts of one line | off |

See it in motion: [The text cursor](SHOWCASE.md#the-text-cursor).

### Color custom tags

Colors for tags you type yourself that are not a Value of any Field in **Tags & PKM → Fields**.

- **Columns:** `Tag`, `Show` (`default` or `empty`), `Fill`, `Text`, `Side`, `Preview`.
- `#urgent` and `urgent` are the same tag.
- `Side` colors the bubble outline; pure white means no outline, and in `Fill` it means no fill.
- `Preview` shows a warning sign when the two colors are too close to read.
- `Add tag` adds a row; the round arrow puts a row's colors back to the theme.

See it in motion: [Colors for your own tags](SHOWCASE.md#colors-for-your-own-tags).

## Advanced

Housekeeping you rarely need: backups and diagnostics.

### Backup

A backup is an ordinary note in your vault that holds all your settings. It travels with the vault, so it also moves a setup to another one.

| Control | What it does | Default |
|---|---|---|
| `Backup folder` | Where in your vault the backups are kept | `inlineOverhaul/Backups` |
| `Autosave` | Each time Obsidian starts, keeps a copy if your settings differ from the last one, in the `autosave` folder inside `Backup folder` | off |
| `Autosaves to keep` | With `Autosave` on: how many stay; the oldest go first. Empty means 10 | empty |
| `Save a backup before restoring` | Writes what you have now before an earlier backup replaces it | on |
| `Your settings` | `Save a backup` of the tabs you tick, or `Restore a backup`. Restoring replaces only the tabs the backup holds | — |
| `Start over` | `Delete all my settings`: every tab goes back to the plugin's defaults, with no Fields at all, and the hotkeys you gave the plugin's commands are cleared. A backup is written first | — |

See it in motion: [Backup](SHOWCASE.md#backup).

### Diagnostics

Setting ids and a log of what the plugin did, for finding out why something goes wrong.

| Control | What it does | Default |
|---|---|---|
| `Show option IDs in tips` | Puts the id of each setting and group at the end of its tip | off |
| `Developer logging` | Records what the plugin did | off |
| `Machine-readable log` | With `Developer logging` on: also keeps a second, denser log meant for tools | off |
| `Log folder` | With `Developer logging` on: where in your vault the logs go | `InlineOverhaul_DevLog` |

- `Show option IDs in tips` names a control exactly when you report something: ids outlive every rewording.
- The log is a note in your vault and holds the text of the lines you edit. Read it before you share it.

See it in motion: [Undo a settings change](SHOWCASE.md#undo-a-settings-change).

## Where to go next

| | |
|---|---|
| [**Tutorial**](TUTORIAL.md) | Fifteen minutes from install to a line that works |
| [**Setup and user guide**](../INSTRUCTIONS.md) | Configuration, Transform safety, troubleshooting |
| [**Feature list**](../FEATURES.md) | Everything the plugin can do, in full |
| [**Visual showcase**](SHOWCASE.md) | Every feature in motion, section by section |
| [**README**](../README.md) | What this plugin is, and how to install it |
