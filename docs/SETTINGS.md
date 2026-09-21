# Settings reference

Every control in the settings panel, tab by tab, in the order the panel puts them.
Looking for a walkthrough instead? Start with the [tutorial](TUTORIAL.md) or the
[README](../README.md).

Open the panel the ordinary way: **Settings → Community plugins → inlineOverhaul**. There
is no command for it.

Each tab opens with a callout saying what the tab is for, and most controls carry a `?`
with a longer explanation. Both are switched off under **General → Help**.

Paths are written the way the panel reads: **Tab → Group → Control**. Defaults are the
values a fresh install starts with, and every dropdown marks its default with `(default)`
next to the value.

## General

Modules, language, and how much the panel explains itself.

### Language

| Control | Default | What it does |
|---|---|---|
| `Language` | `en` | What language the panel and the plugin messages speak |

Every visible line of the panel has a key of its own, and the words behind those keys live
in plain text files inside the plugin folder:

```
<your vault>/.obsidian/plugins/inline-overhaul/texts/default.js
```

That is the only file the plugin puts there, and it keeps it current: a new setting, a new
window and a reworded line all show up in it on their own. Copy it under a new name, change
its first line, and that language appears in the list — nothing has to be registered
anywhere. Name the copy `en.js` and you are rewording the English rather than translating
it.

Your copy is never overwritten, so your edits survive an update, and a line you leave out
keeps the English the plugin ships with.

Command names stay in English whatever you pick. Obsidian takes those from its own command
registry, and translating them here would leave the command palette and the command
reference disagreeing.

### Help

| Control | Default | What it does |
|---|---|---|
| `Guide` → `Read` | — | Writes the guide note into your vault the first time, and opens it every time after. The note is yours from then on; the plugin never writes over it |
| `Changelog` → `Open` | — | Opens `CHANGELOG.md` in your browser: every release, newest first |
| `Show callouts` | on | Keeps the boxes that say what a tab or a block of settings is for |
| `Show tips` | on | Puts a `?` beside anything that needs more explanation |

### Modules

Four toggles: `Navigation`, `Tags & PKM`, `Visual`, `Transform`. All on by default. A
module that is off adds no commands and touches no notes; its settings are hidden until you
turn it back on, and nothing you configured is lost.

Each module also has a command of its own, so an area can be switched off from the command
palette.

## Keyboard

Three keys Obsidian already gives you, your own insert commands, and the command reference.

### Global hotkeys → Expanded 'Ctrl+A'

| Control | Default | What it does |
|---|---|---|
| `Expanded 'Ctrl+A'` | off | Changes what `Ctrl/Cmd+A` does: take the line first, then widen |
| `Selection steps` | `line-note` | How much more gets picked up on each press |
| `Steps to cycle through` | — | Which of the five steps a press stops at, ticked one by one under `Custom` |
| `Count presses by timer` | off | Decides the next step by how quickly you press rather than by what is selected |
| `Time between presses` | `700` | How long you can pause and still be in the middle of a sequence |
| `Last press clears highlighting` | off | After the last step, pressing again drops the selection and returns the cursor |

This is the one place where the plugin takes over a key Obsidian already owns.

See it in motion: [Expanded Ctrl+A](SHOWCASE.md#enhanced-ctrla).

### Global hotkeys → Smart Delete\Backspace

| Control | Default | What it does |
|---|---|---|
| `Smart Delete` | off | `Del` at the end of a line brings up the words without the indent and the Prefix |
| `Smart backspace` | off | `Backspace` at the start of a line sends it up without its own indent and Prefix |
| `Drop the line Prefix` | on | Takes the bullet, checkbox, number or quote mark off the arriving line, not only its indent |
| `Join with a space` | on | Puts one space between your text and the text that arrives |

The two keys switch on separately: either can do this without the other. A line that holds
nothing but a Prefix goes whole.

### Global hotkeys → Smart Enter

| Control | Default | What it does |
|---|---|---|
| `Smart Enter` | off | `Enter` adds a line instead of splitting the one you are on |
| `Where it works` | `line` | How much of the line counts as one record: the whole line, or your own text between the Separators |
| `Prefix on the new line` | `same` | What the new line starts with: the same marker, nothing, or nothing unless the line is numbered |

On a line without a Separator of yours the key stays Obsidian's own.

### Binder (custom insert commands)

A table. Each row is a piece of text and a command that drops it in at the cursor. One row
ships with the plugin — `Smart bracket`, which cycles `text`, `[text]`, `[[text]]` and
back.

See it in motion: [Smart bracket](SHOWCASE.md#smart-bracket).

### Commands & Hotkeys

Every command the plugin has, the key bound to it now, and a click through to Obsidian's
`Hotkeys` screen. Each heading — an area, a part of an area, or one of your Fields — has a
`to hotkeys` button that opens that screen filtered to exactly its commands.

A command with no key reads as an empty slot: a dashed outline and faint `not set`.

Commands are named after the area they belong to — `Navigation: Move line up`,
`Tags & PKM: Category next` — which is what makes that filter exact.

> [!IMPORTANT]
> Command identifiers changed in `0.2.0`. Obsidian binds hotkeys to identifiers rather than
> names, so keys assigned to inlineOverhaul commands before that release stopped working.
> The old-to-new map is in [`COMMAND_IDS_V1_V2.md`](COMMAND_IDS_V1_V2.md), and the plugin
> says so once on first load.

## Navigation

Moving lines, text and the cursor without reaching for the mouse.

### Moving lines (up and down)

| Control | Default | What it does |
|---|---|---|
| `Move lines` | on | Lets the keys pick up a line and move it |
| `Moving behavior` | `line-only` | Whether the tree under the line travels with it |
| `Moving headers` | `move-as-line` | Whether a whole section moves, or just the header line |
| `Cross heading boundaries` | on | Lets a line travel past a heading into the part of the note below |
| `Highlight after moving` | off | Keeps the lines highlighted once they land |
| `Follow the moved line` | on | Scrolls the note to the line you moved |
| `Where the line lands` | `center` | The place on screen the moved line is scrolled to |

Commands: `Move line up`, `Move line down`.

See it in motion: [Move lines and trees](SHOWCASE.md#move-linestrees).

### Move left and move right

Two keys doing three jobs, decided by what is selected: move the highlighted text, cycle
the line Prefix, or change the indent. The order in which the three are tried is set at the
top of the group.

| Control | Default | What it does |
|---|---|---|
| `Move selected text` | on | Slides a highlighted phrase along its line |
| `Movement step` | `auto` | How far the highlighted text goes on each press |
| `Step out of the word` | off | Lets a highlighted part of a word carry on past the word it came from |
| `Continue past a Separator` | on | Lets the highlighted text leave your text and move into the Blocks at either end |
| `Cycle line Prefixes` | on | Turns a line into a heading, a bullet, a numbered item or plain text |
| `Cycle in both directions` | on | `Move right` changes the marker too, but only on a line with no indent |
| `After the last one` | `indent` | What happens at the bottom of the Prefix list |
| `Change the indent` | on | When neither job above applies, moves the line right or left instead |

Commands: `Move left`, `Move right`.

See it in motion: [Move selected inline text](SHOWCASE.md#move-selected-inline-text) and
[Prefix cycle and indent fallback](SHOWCASE.md#prefix-cycleindent-fallback).

### Moving cursor inside a line

| Control | Default | What it does |
|---|---|---|
| `Move cursor inside a line` | on | Lets the keys walk the cursor along the line |
| `Step size` | `word` | How big a hop the cursor makes each time |
| `Continue past Separators` | off | Lets the cursor leave your text and walk into the Blocks at either end |
| `What to do at the end` | `wrap` | When there is nowhere further to go in the line |

Commands: `Move cursor left in line`, `Move cursor right in line`.

See it in motion: [Inline zone navigation](SHOWCASE.md#inline-pkm-zone-navigation).

### Moving cursor inside a note

| Control | Default | What it does |
|---|---|---|
| `Jump between headings` | on | Turns on the `Jump up` and `Jump down` commands |
| `Jump target` | `edge` | Hop between headings, or crawl from one written line to the next |
| `Where in the section` | `start-end` | Land at the start of the part you jump to, or at its end |
| `Cursor position after jumping` | `section-end` | Where on that line the cursor ends up |
| `Follow the jump target` | on | Scrolls the note so the line you landed on is on screen |
| `Where the target lands` | `center` | The place on screen the line you jump to is scrolled to |

Commands: `Jump up`, `Jump down`.

See it in motion: [Header jumps](SHOWCASE.md#header-jumps).

## Tags & PKM

Fields, the Values they offer, and where on the line they go.

### Fields

One editor, two columns. The left column is the list of Fields, drawn as two halves of a
line: everything in `Left Block` is written before your text, everything in `Right Block`
after it. Drag a Field across the line to change which Block it is written in, or step it
with the arrows.

The right column is everything about the Field picked on the left:

| Row | What it holds |
|---|---|
| `Name in tagWheel` | A shorter name for the tagWheel row, where there is little room |
| `Active` | `Yes`, `No`, or `Commands only` — whether the Field is offered, and where |
| `Prefix behavior` | `Strict`, `Insert only` or `Free`; how the Field affects the line Prefix |
| `Child Field` | `After parent`, `Show always` or `Hide` |
| `Parent Value` | With `Show always`: leave the line alone, or also write the parent Value |
| `Prerequisite Field` | Makes this Field wait until another Field has a Value |
| `Values` | The ordered list the `next` and `previous` commands walk |
| `YAML property` | Which property of a transformed note this Field becomes |
| `Commands` | This Field's own commands and the key each one is on |

`Values`, `Behavior`, `YAML property` and `Commands` are sections, and each folds with the
triangle in front of its heading — the same one the settings headings carry. What you leave
folded stays folded until Obsidian is restarted.

A Field is one of three types, picked when you press `Add Field`: `Tag` (`#todo`), `Link`
(`[[Project A]]`) or `Element` — a marker and a format instead of a list, such as
`📅 2026-09-15`. A Value can hold a child Value, and a child Field's Values are the ones
marked child in that table.

Each Value carries its own writing rule, its own colour, and a `Show` column: at `default`
it is drawn as itself, at `custom` as anything you type instead — an emoji in place of
`[[Project A]]`. A shown link still opens the note when clicked.

**A pair of commands appears for every Field you add** — `<Field> next` and
`<Field> previous` — with no configuration step in between.

The chevron at the right edge of the group header switches the table between its full
height, where every control is on screen at once, and a fixed height that scrolls.

See it in motion: [Cycle a Field from the keyboard](SHOWCASE.md#direct-taglink-field-cycle-increasedecrease)
and [Step an element up or down](SHOWCASE.md#element-incrementdecrement).

### Separators

| Control | Default | What it does |
|---|---|---|
| `First Separator` | `\|\|` | Goes between the Left Block and the start of your sentence |
| `Second Separator` | `\|\|` | Goes at the end of your sentence, before the Right Block |

### Writing rules

| Control | Default | What it does |
|---|---|---|
| `Child tag format` | `separate` | Whether a Value under another one is written as two tags or one |
| `When a line empties out` | `keep-bullet` | What is left behind when cycling removes the last Value |
| `Cursor after an action` | `text_end` | Where the cursor waits once a tag or date has been set |

### Placement modes

Every Field has a `Prefix behavior` mode. These four settings say what each mode means.

| Control | Default | What it does |
|---|---|---|
| `Strict: add a bullet` | off | Starts the line with a bullet when the Field has nothing of its own to put there |
| `Insert only: keep the Prefix` | on | Puts the Value where it belongs and does not touch the start of the line |
| `Insert only: use Field Prefix` | on | Allows a Value with a Prefix of its own to change the start of the line after all |
| `Free: insert position` | `smart` | Which end of the line a Value goes to when the cursor is mid-sentence |

### Prefix priority

When two Values both want to change the start of the line, these rules decide which wins.

| Control | Default | What it does |
|---|---|---|
| `Decide by` | `by-section` | Settle it by the order of your Fields, or by a list of openings you rank yourself |
| `Field order source` | `manual` | Use the order your Fields are already in, or arrange a separate one |
| `Parent or child wins` | `subtag-over-tag` | When a tag and its child Value both carry a Prefix |

## Visual

How a tagged line looks while you write it. Nothing here changes a character in your file.

### Inline appearance → Line view

| Control | Default | What it does |
|---|---|---|
| `Opacity of the Left Block` | `100` | Dims everything written before your text |
| `Opacity of the Right Block` | `100` | Dims everything written after your text |
| `Left Block text size` | `100` | How big everything before your text is written |
| `Right Block text size` | `100` | How big everything after your text is written |
| `Color the Block with Stripe` | off | A Stripe behind the Left Block and the Right Block |
| `Stripe direction` | `both` | Which of the two Blocks gets a Stripe |
| `Stripe color` | unset | Unset follows your theme |
| `Stripe opacity` | `12` | How strongly the Stripe shows through |
| `Stripe height` | `60` | How far the Stripe reaches above and below the writing |
| `Stripe width` | `50` | How far the Stripe reaches past the Block on both sides |

### Inline appearance → Tag view

| Control | Default | What it does |
|---|---|---|
| `Tags bubble width` | `100` | Breathing room either side of the word |
| `Tag bubble height` | `100` | How tall the bubble is around the word |
| `Tags bubble corners` | `0` | From fully rounded to completely square |
| `Empty tags bubble width` | `100` | Width of a bubble whose `Show` is set to `empty` |

### Inline appearance → Link view

Two switches that hand a Value shown as your own text back what an ordinary link gets from
Obsidian.

| Control | Default | What it does |
|---|---|---|
| `Preview on hover` | off | Hovering opens the page preview — hold `Ctrl` while hovering |
| `Drag to move` | off | The Value can be dragged into another note |

### Color your Tags

A list of colours for tags that are not a Value of any Field. A tag you type straight into
a line still gets a bubble, and this is where you say what that bubble looks like.

### Tag Bars

A coloured Bar in the margin, down the side of a line and everything nested under it. One
tag Field draws them.

| Control | Default | What it does |
|---|---|---|
| `Tag Bars` | off | Draws the Bars |
| `Which Field draws Bars` | unset | Bars work with tag Fields only, and only for the one chosen here |
| `Number of Bars` | `2` | How far down the nesting to keep drawing them |
| `Show the Field's tag` | on | Keep the tag on the line, or let the Bar speak for it |
| `Hide the leftover marker` | off | Tidies away a Separator that has nothing left beside it |
| `Bar arrangement` | `default` | Which lane each level of the tree draws its Bar in |
| `Bar thickness` | `2` | How wide each Bar is |
| `Space between Bars` | `12` | The gap between one level and the next |
| `Distance from the text` | `20` | How far the Bars sit from where your line begins |
| `Gap between Bars` | `2` | Blank left above and below a Bar |
| `Bars for the whole tree` | on | A Bar runs down everything nested under its line |
| `Join Bars in a tree` | on | A parent and its own children draw one unbroken Bar |

### tagWheel

The picker opens over the line and lays your Fields out across it, with the Values of the
Field you are on running down.

| Control | Default | What it does |
|---|---|---|
| `Show tag markers` | on | Show the hash and emoji in the picker, or just the words |
| `tagWheel Value names` | `Default name` | Whether the picker prints a chosen Value as written, as the custom text from `Color your tags`, or both |
| `Values in the other Block` | `hide` | What happens to the Values you are not picking while the picker is open |
| `Highlight the tagWheel line` | on | Marks the line while the picker is open |
| `Non-active Field text color` | unset | The Field names you are not standing on |
| `Active Field text color` | unset | The Field you are on |
| `Chosen Value text color` | unset | A Field that already carries a Value |
| `Background color` | unset | Behind the picker |
| `Scroller` | off | Shows the next and previous Values around the current one |
| `Scroller opening direction` | `full` | Which way the Values unroll |
| `Scroller Value names` | `Default name` | Whether the box shows a neighbouring Value as written, as the custom text from `Color your tags`, or both |
| `Scroller background color` | unset | Behind the box of neighbouring Values |
| `Scroller text color` | unset | The Values you are not on, inside the box |
| `Scroller size` | `3` | How many neighbouring Values stay visible |
| `tagWheel navigation behavior` | `stay` | What the arrows do at the end of a Block: stay in it, or step across |

Commands: `tagWheel Left`, `tagWheel Right`.

See it in motion: [tagWheel](SHOWCASE.md#tagwheel-leftrightnavigationapplycancel) and
[tagWheel panel and scroller](SHOWCASE.md#tagwheel-panelscroller).

### tagWheel opening

| Control | Default | What it does |
|---|---|---|
| `Active Field on opening` | `first` | Which Field the picker lands on when it opens |
| `Left Block active Field` | unset | The Field it lands on when it opens on the left |
| `Right Block active Field` | unset | The Field it lands on when it opens on the right |

### Text cursor

| Control | Default | What it does |
|---|---|---|
| `Color the text cursor` | off | Draws the blinking caret in a colour you pick |
| `Cursor color` | unset | The colour of the caret in your notes |
| `Shape the text cursor` | off | Sets how thick the caret is and how fast it blinks |
| `Cursor width` | `2` | How thick the caret is drawn, in pixels |
| `Blink speed` | `5` | From `0`, no blinking at all, to `10` |

With `Shape the text cursor` on, the plugin draws the caret itself. Obsidian draws no caret
of its own on a line with nothing selected, and a caret it does not draw cannot be made
thicker.

### Jump highlight

| Control | Default | What it does |
|---|---|---|
| `Highlight where you land` | off | Draws a fading circle where the cursor lands |
| `Highlight color` | unset | Unset uses the accent colour of your theme |
| `Highlight size` | `18` | How wide the circle is when it appears |
| `How long it lasts` | `450` | The time the circle takes to shrink away |
| `Latency between jumps` | `0` | Jumps closer together than this get no circle |
| `Use inside current line` | off | Also marks the cursor when it hops between the parts of one line |

## Transform

Turning a line you have already written into a note of its own.

> [!CAUTION]
> `Transform inline to note` rewrites the line you are standing on and writes real files.
> It is off out of the box. Read
> [the guide](../INSTRUCTIONS.md#transform-a-line-becomes-a-note) before turning it on.

### Inline to note

| Control | Default | What it does |
|---|---|---|
| `Inline to note` | off | Allows this to create notes and add to notes you already have |
| `Templates folder` | unset | The folder your note templates live in |
| `Default template` | unset | The template used when no rule applies |
| `New notes folder` | unset | Where to put the notes this creates |
| `Floating button` | off | Puts a small button at the end of the line you are on |
| `Distance from the text` | `12` | Room between the line and that button |
| `Open note after creation` | off | Jumps straight to the note once it is written |

Command: `Transform inline to note`.

### New note naming

| Control | Default | What it does |
|---|---|---|
| `Note name` | `auto` | Take the name from the line, or stop and ask you for it |
| `Name placeholders` | `[]` | Two characters; whatever you put between them becomes the name |
| `Words to use instead` | `6` | How many of the first words to use when there are no brackets |
| `If the name already taken` | `new_note` | What to do when a note with that name exists |

### Note content

| Control | Default | What it does |
|---|---|---|
| `Where to put the text` | `end` | At the top of the note, or after whatever is already there |
| `Type name of header` | unset | The heading your text is filed under |
| `If header not found` | `end` | Where the heading is added when the note has none |
| `Line above the text` | `datetime` | Something above your text so entries stay apart |
| `Line above is header` | `3` | Make that line a heading you can fold, or leave it plain |
| `Text of the line above` | `Captured` | Typed into the note exactly as written here |
| `Date format` | `YYYY-MM-DD HH:mm` | Today's date, written the way you set out |

Each Field's `YAML property` row decides which property of the new note it becomes, and
each Value carries the rule for how it is written.

See it in motion: [YAML Raw and Clean mapping](SHOWCASE.md#yaml-rawclean-mapping).

### Source line

| Control | Default | What it does |
|---|---|---|
| `Sub-lines (tree) behavior` | `stay` | Leave them where they are, or take them into the note too |
| `What happens with current line` | `remove` | What is left of the line you pressed on |
| `Words to keep` | `3` | How much of the line stays behind |
| `Fields to keep` | — | Which Fields stay on the line you pressed on |
| `Insert wikilink in current line` | on | Puts a link to the new note on the line you pressed on |
| `Mark transformed line` | `#processed` | A word or tag added so you can see the line was handled |
| `Where the mark goes` | `right` | Before your text, or after it |
| `Dim transformed line` | off | Fades a line once it carries that mark |
| `Opacity of transformed line` | `65` | Zero leaves the line as it is, eighty makes it barely readable |
| `Color of transformed line` | unset | Unset keeps the colour your theme gives the text |

See it in motion: [Current root or selected tree](SHOWCASE.md#current-root-or-selected-tree).

### Links in the notes you mention

| Control | Default | What it does |
|---|---|---|
| `Link the notes you mention` | off | Writes a link to the new note into every note this line points at |
| `Where to put the link` | `end` | At the top of that note, or after whatever is already there |
| `Type name of header` | unset | The heading the link is filed under |
| `If header not found` | `end` | Where the heading is added when that note has none |

### Smart Rules

A list of rules. A rule spots a kind of line — the Values it carries — and picks the
template for it, so a `#meeting` line and a `#bug` line become different notes without you
choosing at the moment of writing. With no rules, the default template is used for every
line.

## Advanced

### Options IDs

| Control | Default | What it does |
|---|---|---|
| `Show option IDs in tips` | off | Puts the id of each setting and group at the end of its tip |

The fastest way to name a control exactly when you report something.

### Backup

A backup is an ordinary note in your vault. It travels with the vault, so restoring it on
another machine is how a setup moves.

| Control | Default | What it does |
|---|---|---|
| `Backup folder` | `inlineOverhaul/Backups` | Where in your vault the backups are kept |
| `Autosave` | off | Writes a copy whenever your settings file differs from the last autosave, checked at every start of Obsidian |
| `Save a backup before restoring` | on | Writes what you have now before an earlier backup replaces it |
| `Your settings` | — | `Save a backup`, or bring back an earlier one, tab by tab |
| `Start over` | — | Deletes everything set up here and returns to the plugin's defaults; always writes a backup first |

`Start over` also removes the four Fields a fresh install arrives with, and does not put
them back.

### Diagnostics

| Control | Default | What it does |
|---|---|---|
| `Developer logging` | off | Records what the plugin did |
| `Machine-readable log` | on | Also keeps a second, denser log meant for tools |
| `Log file` | `InlineOverhaul_DevLog` | Where in your vault the logs are put |

The log is a note in your vault and it records the lines you were working on. Read it before
you share it.

`Undo last settings change` rolls back the most recent change made in the panel. It is a
command, not a button: saving is automatic and there is no manual flush.

## Where to go next

| | |
|---|---|
| [**Tutorial**](TUTORIAL.md) | Fifteen minutes from install to a line that works |
| [**Setup and user guide**](../INSTRUCTIONS.md) | Configuration, Transform safety, troubleshooting |
| [**Feature list**](../FEATURES.md) | Everything the plugin can do, in full |
| [**Visual showcase**](SHOWCASE.md) | Thirty animations, grouped by workflow |
| [**README**](../README.md) | What this plugin is, and how to install it |
