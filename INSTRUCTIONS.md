# inlineOverhaul: Setup and User Guide

Step-by-step instructions for people who have already installed the plugin, one task per section. New here? Start with the [tutorial](docs/TUTORIAL.md) or the [README](README.md). For every control of the panel, see the [settings reference](docs/SETTINGS.md).

> [!WARNING]
> inlineOverhaul is a beta plugin. Back up the whole vault, its `.obsidian` folder included, before you install, update, restore settings or use Transform. `Transform inline to note` creates notes, adds to them and can overwrite them.

## Contents

| Area | Tasks |
|---|---|
| Start | [Install, update or uninstall](#install-update-or-uninstall-with-brat) · [Set up the plugin on first run](#set-up-the-plugin-on-first-run) · [Give commands a hotkey](#give-commands-a-hotkey) · [Turn a module on or off](#turn-a-module-on-or-off) · [Change the panel language](#change-the-panel-language) |
| Navigation | [Move lines and trees up or down](#move-lines-and-trees-up-or-down) · [Change the line Prefix or indent](#change-the-line-prefix-or-indent) · [Move selected text along a line](#move-selected-text-along-a-line) · [Jump between headings](#jump-between-headings) · [Move the cursor inside a line](#move-the-cursor-inside-a-line) |
| Keyboard | [Choose what Ctrl+A selects](#choose-what-ctrla-selects) · [Join lines cleanly with Del and Backspace](#join-lines-cleanly-with-del-and-backspace) · [Add a line with Enter without splitting yours](#add-a-line-with-enter-without-splitting-yours) · [Paste numbered lists cleanly](#paste-numbered-lists-cleanly) · [Make your own insert commands with Binder](#make-your-own-insert-commands-with-binder) |
| Tags & PKM | [Add and arrange Fields](#add-and-arrange-fields) · [Set up tag Values and child tags](#set-up-tag-values-and-child-tags) · [Set up link Values](#set-up-link-values) · [Set up a date, time or counter](#set-up-a-date-time-or-counter) · [Edit the line with an Action Field](#edit-the-line-with-an-action-field) · [Write Values where the cursor is](#write-values-where-the-cursor-is) · [Change the Separators](#change-the-separators) · [Choose what is left after a cycle](#choose-what-is-left-after-a-cycle) · [Mark a ticked line](#mark-a-ticked-line) · [Pick Values with tagWheel](#pick-values-with-tagwheel) · [Decide which Prefix wins](#decide-which-prefix-wins) · [Copy Fields into note properties](#copy-fields-into-note-properties) |
| Transform | [Turn a line into a note](#turn-a-line-into-a-note) · [Link new notes from the notes you mention](#link-new-notes-from-the-notes-you-mention) · [Pick a template by the kind of line](#pick-a-template-by-the-kind-of-line) |
| Visual | [Change how tagged lines look](#change-how-tagged-lines-look) · [Draw Tag Bars in the margin](#draw-tag-bars-in-the-margin) · [Change the look of tagWheel](#change-the-look-of-tagwheel) · [Color and shape the text cursor](#color-and-shape-the-text-cursor) · [Show where the cursor lands](#show-where-the-cursor-lands) · [Color tags that are not Values](#color-tags-that-are-not-values) |
| Advanced | [Save, restore or move your settings](#save-restore-or-move-your-settings) · [Undo a settings change](#undo-a-settings-change) · [Collect a log for a bug report](#collect-a-log-for-a-bug-report) |
| Help | [Fix a problem](#fix-a-problem) · [Beta limitations](#beta-limitations) · [Try it on a safe test note](#try-it-on-a-safe-test-note) · [Glossary](#glossary) |

## Install, update or uninstall with BRAT

You need:

- Obsidian desktop 1.13.0 or newer; mobile is not supported
- the BRAT community plugin, which installs and updates beta plugins
- a current backup of your vault

### Install

1. Open **Settings → Community plugins**, install **BRAT** and enable it.
2. In BRAT, choose `Add Beta plugin` and enter `romkuznetsov/inline-overhaul`.
3. When BRAT has downloaded the release, enable **inlineOverhaul** under **Settings → Community plugins**.

### Update

1. Back up the vault.
2. Run BRAT's update check, or wait for its scheduled one.
3. Confirm **inlineOverhaul** is still enabled after the reload.
4. Run one familiar command on a disposable note before you touch real notes.

After an update, a window lists what changed in every release since your last one. The same text is in `CHANGELOG.md`; **General → Help → Changelog** → `Open` shows it in your browser at any time.

### Uninstall

1. Disable **inlineOverhaul** under **Settings → Community plugins**.
2. Remove it from BRAT's list of beta plugins, so BRAT does not install it again.
3. Uninstall it from Obsidian's installed community plugins.
4. Delete the backups and the guide note you no longer want. Your own notes stay as they are.

## Set up the plugin on first run

1. Open **Settings → inlineOverhaul**.
2. On **General**, under `Modules`, leave on only the parts you want to try.
3. Open **Tags & PKM → Fields**. A fresh install has four Fields:

   | Field | Values | Block |
   |---|---|---|
   | `Status` | `#todo`, `#doing`, `#done` | Left Block, before your text |
   | `Priority` | `#low`, `#med`, `#high` | Left Block |
   | `Due` | 📅 and a date | Right Block, after your text |
   | `Project` | `[[Project A]]`, `[[Project B]]` | Right Block |

   Change them, delete them or add your own. They come with a fresh install only: `Delete all my settings` does not bring them back.
4. Check the line preview at the top of `Fields`, and the Separators under `Separators`.
5. Give the commands you use a hotkey: see [Give commands a hotkey](#give-commands-a-hotkey).
6. Leave `Inline to note` on the **Transform** tab off until you have read [Turn a line into a note](#turn-a-line-into-a-note).
7. Once the setup works, save it: **Advanced → Backup** → `Save a backup`.

The panel has seven tabs: **General**, **Keyboard**, **Navigation**, **Tags & PKM**, **Transform**, **Visual** and **Advanced**. Every setting of a tab is on one page, settings save on their own, and Obsidian's settings search finds a setting by its name.

**General → Help** also has `Guide` → `Read`: it writes the note `inlineOverhaul Guide.md` into your vault with worked examples. The note is yours to edit, and the plugin never writes over it.

## Give commands a hotkey

The plugin assigns no keys to any command. Two ways to give one:

- **Keyboard → Commands & Hotkeys** lists every command with its key. Click a cell in the `Hotkey` column, and Obsidian's `Hotkeys` screen opens at that command. The `to hotkeys` button in a heading opens it filtered by that heading.
- In Obsidian's **Settings → Hotkeys**, search for `inlineOverhaul` to see the whole set.

In the palette every name starts with the plugin and its area, such as `inlineOverhaul: Navigation: Move up`. The table below drops that start.

<details>

<summary>Every command that comes with the plugin</summary>

| Area | Command | What it does |
|---|---|---|
| Navigation | `Move up`, `Move down` | Move the line or the selected lines |
| Navigation | `Move left`, `Move right` | Move selected text, change the line Prefix or the indent |
| Navigation | `Jump up`, `Jump down` | Jump between headings or lines of a note |
| Navigation | `Jump left`, `Jump right` | Move the cursor between the parts of a line |
| Tags & PKM | `tagWheel Left`, `tagWheel Right` | Open tagWheel on the Left Block or the Right Block |
| Transform | `Transform inline to note` | Turn the line into a note |
| Binder | `Smart bracket` | Cycle brackets around a selection |
| General | `Undo last settings change` | Take back the last settings change |
| General | `Toggle Navigation module`, `Toggle Tags & PKM module`, `Toggle Transform module`, `Toggle Visual module` | Turn a module on or off |

</details>

Other commands come from your setup, and they follow it at once: add, rename or delete a Field, a custom block or a Binder row, or restore a backup, and the palette and `Hotkeys` change without a reload.

| Made from | Commands |
|---|---|
| Each Tag, Link or Element Field | `<Field> next` and `<Field> previous`, such as `Status next` |
| A child Field | its own pair, the parent name with `-sub`, such as `Status-sub next` |
| Each category of an Action Field | `<Field> · <category> next` and `<Field> · <category> previous` |
| Each custom block | `tagWheel <block name>` |
| Each Binder row | one command named after the row |

Renaming a Field keeps its hotkeys: the command keeps its identifier and changes only its name.

Suggested keys: paired keys for each Field, one key for each side of tagWheel, mnemonic keys for Binder rows. Give `Transform inline to note` a deliberate combination of keys, never a single key that is easy to hit by accident.

See it in motion: [Commands and hotkeys](docs/SHOWCASE.md#commands-and-hotkeys)

## Turn a module on or off

The plugin has four modules, all on by default. Turn them on or off under **General → Modules**, or with the commands `Toggle Navigation module`, `Toggle Tags & PKM module`, `Toggle Transform module` and `Toggle Visual module`.

| Module | What it does |
|---|---|
| Navigation | Moves lines, text and the cursor |
| Tags & PKM | Writes Fields on the line: tagWheel and the Field commands |
| Transform | Turns a line into a note; also needs `Inline to note` on the Transform tab |
| Visual | Tag colors, the Stripe, Tag Bars, the text cursor |

A module that is off keeps its settings. Its commands only show a message such as `Navigation is switched off`, and its tab shows just the switch. Turn it back on, and everything is as it was.

See it in motion: [Modules](docs/SHOWCASE.md#modules)

## Change the panel language

**General → Help → Language** picks the language of the panel and of the plugin messages. English is always in the list.

Every line of the panel has a key, and the words behind the keys live in one text file per language. To add a language:

1. Open `<your vault>/.obsidian/plugins/inline-overhaul/texts/`.
2. Copy `default.js` under a new name, such as `de.js`.
3. Change its first line, `"$language"`, to the name you want to see in the list.
4. Translate the right-hand side of the lines you want, and reload the plugin.

- Do not edit `default.js` itself: the plugin rewrites it on every update. Your copy is never overwritten.
- A line you leave out or empty keeps its English text, so a half-finished translation works.
- The file is read as JSON: no comments and no comma after the last line. A file the plugin cannot read is named in a message, and the panel opens in English.
- Command names stay English: Obsidian takes them from its own command list.

The guide note works the same way. Copy `guide/default.md` in the plugin folder under a language name and change `language:` in its property block. `Read` then writes `inlineOverhaul Guide (<language>).md` next to the English one.

## Move lines and trees up or down

`Move up` and `Move down` move the line you are on, or every line you selected. Set them under **Navigation → Move lines (up/down)**.

| Control | What it decides | Choices |
|---|---|---|
| `Moving behavior` | Whether the lines indented under the line travel with it | `Line only` (default), `Whole tree` |
| `Jump over neighbor trees` | With `Whole tree`: hop over the whole tree next to it | off by default |
| `Moving headings` | A heading moves alone, or with its section | `Heading only` (default), `Whole section` |
| `Cross heading boundaries` | Whether a line can travel past a heading | on by default |
| `Highlight after moving` | Keep the moved lines selected; `Moved lines color` sets the color | off by default |
| `Follow the moved line` | Scroll the note to the moved line | on by default |
| `Where the line lands` | Where on screen the line ends up | `Center` (default), `Top`, `Bottom` |

With the cursor on `- Parent` and `Whole tree`, `Move down` moves the parent and both children:

```markdown
## Planning
- Parent
  - Child A
  - Child B
- Sibling
```

See it in motion: [Move a line with its tree](docs/SHOWCASE.md#move-a-line-with-its-tree), [Where the moved line ends up](docs/SHOWCASE.md#where-the-moved-line-ends-up)

## Change the line Prefix or indent

With nothing selected, `Move left` and `Move right` change the Prefix of the line (its marker, such as `#`, `-` or `1.`) or its indent. Set them under **Navigation → Move lines (left/right)**; the tables at the top of that group show which press does what.

- `Cycle line Prefixes` turns a line into a heading, a bullet, a numbered item or plain text, one press at a time. The list under it sets the order.
- `Cycle in both directions` lets `Move right` change the marker too, on a line with no indent.
- `After the last one` decides what happens at the end of the list: `Indent` (default) or `Start over`.
- `Change the indent` makes `Move right` indent a list item one step and `Move left` take one step off. `Indent the whole tree` takes the lines under it along.

With `Cycle line Prefixes` off, the keys only change the indent.

See it in motion: [Cycle the line marker](docs/SHOWCASE.md#cycle-the-line-marker)

## Move selected text along a line

Select part of one line, and `Move left` and `Move right` slide it along. The settings sit under **Navigation → Move lines (left/right)**, in the `Move text` part.

| Control | Choices |
|---|---|
| `Move selected text` | on by default |
| `Movement step` | `Auto` (default), `Character`, `Word`, `Off` |
| `Step out of the word` | with `Auto`: let a part of a word carry on past it; off by default |
| `Continue past Separators` | let the text move into the Fields at either end; on by default |

See it in motion: [Move selected text](docs/SHOWCASE.md#move-selected-text)

## Jump between headings

`Jump up` and `Jump down` skip through a note by its headings. Set them under **Navigation → Jump inside a note (up/down)**.

| Control | Choices |
|---|---|
| `Jump target` | `Headings` (default) or `Lines`, one written line at a time |
| `Where in the section` | `Start and end` (default), `Start only`, `End only` |
| `Cursor position after jumping` | `Line start`, `Line end`, `Text start`, `Text end` (default) |
| `Follow the jump target` | scroll the note to the line; on by default |
| `Where the target lands` | `Center` (default), `Top`, `Bottom` |

`Text start` puts the cursor after the line's Prefix (indent, marker, checkbox). `Text end` stops before the Second Separator.

See it in motion: [Jump inside a note](docs/SHOWCASE.md#jump-inside-a-note)

## Move the cursor inside a line

`Jump left` and `Jump right` move the cursor between the parts of a line: the Left Block, your text, the Right Block. Set them under **Navigation → Jump inside a line (left/right)**.

| Control | Choices |
|---|---|
| `Step size` | `Word` (default), `Sentence`, `Start or end` |
| `Continue past Separators` | let the cursor walk into the Fields at either end; off by default |
| `What to do at the end` | `Stop`, `Wrap around` (default), `Next line` |

See it in motion: [Jump inside a line](docs/SHOWCASE.md#jump-inside-a-line)

## Choose what Ctrl+A selects

Turn on `Smart Ctrl+A` under **Keyboard → Smart SelectAll (Ctrl+A)**, and each press of `Ctrl/Cmd + A` selects a bit more.

1. Pick `Selection steps`: `Line, note` (default), `Line, tree, note`, `Line, tree, heading, note`, `Word, line, tree, heading, note`, or `Custom`.
2. With `Custom`, tick the steps a press stops at: `word`, `line`, `tree`, `heading`, `note`. The order is always that one. Tick nothing, and one press selects the whole note again.
3. Optional: `Count presses by timer` starts over after a pause longer than `Time between presses` (250 to 2000 ms, 700 by default).
4. Optional: `Last press clears highlighting` drops the selection after the last step and puts the cursor back.

`word` takes the word the cursor is in or next to, otherwise the nearest one. A line without words skips that step.

See it in motion: [Smart Ctrl+A](docs/SHOWCASE.md#smart-ctrla)

## Join lines cleanly with Del and Backspace

Under **Keyboard → Smart Delete\Backspace**, two switches change what happens when two lines join. Both are off by default.

| Switch | Key and place | Result with it on |
|---|---|---|
| `Smart Delete` | `Del` at the end of a line | the next line comes up without its indent and Prefix |
| `Smart Backspace` | `Backspace` at the start of a line | the line goes up without its indent and Prefix |

Each switch works without the other. Two more apply to both keys:

- `Drop the line Prefix` (on): off, only the indent goes.
- `Join with a space` (on): one space between the two texts. Off, they join directly, handy for a split word.

A line that holds only a Prefix, such as an empty bullet, disappears in one press. With a selection, with several cursors, or anywhere else in a line, both keys work as usual.

See it in motion: [Smart Delete and Backspace](docs/SHOWCASE.md#smart-delete-and-backspace)

## Add a line with Enter without splitting yours

Turn on `Smart Enter` under **Keyboard → Smart Enter**. `Enter` then adds a line below and leaves the line you are on as it is, so its Fields stay together.

| Control | Choices |
|---|---|
| `Where it works` | `Whole line` (default) or `Text only`, between your Separators |
| `Prefix on the new line` | `Same as above` (default), `None`, `Numbered lines only` |
| `Use Shift+Enter instead` | `Shift+Enter` adds the line, `Enter` splits as usual |
| `Shift+Enter as usual Enter` | `Shift+Enter` splits the line as Obsidian's `Enter` does |

- `Same as above` repeats the marker: the next number, a bullet, an empty checkbox. All three choices keep the indent.
- In code, in a table, on an empty line or an empty list item, `Enter` works as usual, so it still takes you out of a list.

See it in motion: [Smart Enter](docs/SHOWCASE.md#smart-enter)

## Paste numbered lists cleanly

Turn on `Smart paste` under **Keyboard → Smart Paste (Ctrl+V)**.

- A pasted numbered list starts from one. Pasted right under a list, it keeps that list's count.
- A pasted marker is dropped where the line already has one: `1. milk` pasted after `2. ` gives `2. milk`.
- Plain text, links and tables paste as usual.

See it in motion: [Smart paste](docs/SHOWCASE.md#smart-paste)

## Make your own insert commands with Binder

Binder turns text you type often into commands.

1. Open **Keyboard → Binder (custom insert commands)** and press `Add command`.
2. Pick the `Type`:
   - `Text` puts your text in at the cursor, or over the selection.
   - `Action` runs a category of an Action Field with a preset of its own (see [Edit the line with an Action Field](#edit-the-line-with-an-action-field)).
3. Fill `Inserts` and, if you like, `Command name` and `Description`.
4. Click the row's `Hotkey` cell and set a key in Obsidian's `Hotkeys` screen.

You cannot change a row's text afterwards: delete the row and add it again. Deleting a row deletes its command at once. `Description` stays editable, and so does the preset of an `Action` row.

The built-in row `Smart bracket` cycles brackets around a selection: `text` → `[text]` → `[[text]]` → `text`. With the cursor inside `[[Note]]` it takes the link brackets off; inside `[Note]` it makes a link.

See it in motion: [Binder: your own insert commands](docs/SHOWCASE.md#binder-your-own-insert-commands)

## Add and arrange Fields

A Field is one thing a line can carry. You set Fields up under **Tags & PKM → Fields**: the list on the left, the settings of the selected Field on the right.

```markdown
- [ ] #todo #high || call the bank || [[Project A]] 📅2026-09-15
```

The line has three parts: the Left Block before the First Separator, your text, and the Right Block after the Second Separator.

**Add a Field.** Press `Add a Field`, name it and pick one of four types:

- `Tag` writes a tag: `#todo`
- `Link` writes a link to a note: `[[Project A]]`
- `Element` writes an emoji with a Value after it: `📅2026-09-15`
  - a date written with a space, `📅 2026-09-15`, is read too
  - an Element can also walk a list of emoji Values, such as `💡`
- `Action` writes nothing; it edits the line, such as wrapping it in a callout

In the list of Fields each type is marked by a small tile: `#`, `[[`, `☺`, `/`.

**Arrange Fields.** Drag a Field by its handle to reorder it, or across the dotted line into the other Block. The arrows move it one place, and at the edge of a Block into the next one. The order in the list is the order on the line.

**The `Behavior` block** of each Field holds:

| Control | Choices |
|---|---|
| `Active` | `Yes`: everywhere; `No`: off everywhere; `Commands only`: commands work, tagWheel hides it |
| `Prefix behavior` | `Strict`: a Value may set the start of the line, such as its checkbox; `Insert only`: a plain line stays plain |
| `Child Field` | when a child Field comes into play: `After parent`, `Always`, `On Alt`, `Hide` |
| `Prerequisite Field` | `Yes`: the Field waits until another Field has a Value; pick it and, if you like, one Value of it |

Fine-tune both `Prefix behavior` modes under **Tags & PKM → Placement modes**: `Strict: add a bullet`, `Insert only: use Field Prefix`, `Keep typed tags in text`.

The line preview draws a Field that waits for another one paler, with a small `⬑Type` or `⬑#todo` under it.

**Hide a Value.** The eye in front of a Value hides it from `next`, `previous` and tagWheel. The Value stays in the Field, and a line that already has it still reads it.

**Delete or rename a Field** from its heading in the right column. Its commands follow at once.

The chevron at the right of the `Fields` header switches the editor to a fixed height with its own scrollbar; the choice is remembered.

See it in motion: [One Field and its Values](docs/SHOWCASE.md#one-field-and-its-values), [Add a Field](docs/SHOWCASE.md#add-a-field), [Blocks and Separators](docs/SHOWCASE.md#blocks-and-separators), [Where Values land](docs/SHOWCASE.md#where-values-land)

## Set up tag Values and child tags

A Tag Field cycles through its Values in order: `next` on `#idea` gives `#mem`, and one step past the last Value takes the tag off.

1. Select the Field under **Tags & PKM → Fields** and type a Value under `Values`: `#todo` and `todo` are the same Value.
2. Set its colors, its `Show` (`default`, `empty`, `custom` with `Custom text`) and, if it should set a checkbox, its Prefix.
3. Mark a Value as a child of another one, such as `#work/report` under `#work`, to make a child Field.

Each Tag Field picks how a child Value is written, with `Child tag format` in its `Behavior` block:

| Choice | Result |
|---|---|
| `Separate` | `- #doing #review :: fix bug` |
| `Nested` | `- #doing/review :: fix bug` |

`Parent is Navigator` turns the parent Values into groups: in tagWheel a parent only narrows the child list, and only the child is written.

See it in motion: [Child Fields](docs/SHOWCASE.md#child-fields), [A Value that brings a checkbox](docs/SHOWCASE.md#a-value-that-brings-a-checkbox)

## Set up link Values

A Link Field cycles through notes and writes them as links: `[[Project Atlas]]`. Adding a Value suggests your notes as you type. Link Fields get no tag bubbles and no Tag Bars.

- **Rename a Value** and, if the Value has its own note, a window offers `Rename note and links` or `Only the Value`. It counts the links Obsidian would rewrite.
- **Rename a note** in Obsidian, and the link Value that points to it follows the new name.
- **`Use as MOC`** decides whether `Link the notes you mention` files new notes into the notes of these Values (see [Link new notes from the notes you mention](#link-new-notes-from-the-notes-you-mention)).

## Set up a date, time or counter

An Element writes an emoji followed by a Value:

```markdown
📅2026-09-15
🕒1430
🔢007
```

In the right column of **Tags & PKM → Fields**, set:

- `Emoji prefix`: one emoji per Field; the plugin finds the Field by it
- `Value format`, such as `YYYY-MM-DD`, `HHmm`, `001`
- `Steps by`, what `next` and `previous` do:

| Choice | What a press does |
|---|---|
| `Fixed step` | adds or takes away `Amount`, in the smallest unit of the format: `📅2026-12-10` → `📅2026-12-11` |
| `Command` | `next` writes a fresh Value: `Current date and time`, `Random numbers` or `Random characters`; `previous` removes it |
| `Custom step` | walks the `Steps` you write, one per line |
| `List of Values` | walks your own emoji Values, then removes the Value |

`Custom step` example: `1 (2)`, `5`, `END` makes `next` write `🔢1`, `🔢2`, `🔢3`, `🔢8`, then remove the Value. A number in brackets repeats a step; `END` removes the Value.

## Edit the line with an Action Field

An Action Field edits the line instead of writing a Value. Add a Field of type `Action`, then add categories to it under `Categories`.

| Category | What it does |
|---|---|
| `Insert callout` | wraps the line and its tree, or the selected lines, in a callout; inside one, steps through the presets, then takes the callout off |
| `Cleanup` | takes the Values of your Fields off the line, except the Fields you keep |
| `Insert codeblock` | on an empty line, inserts your text, such as a code block of another plugin, as it is, under a heading or in a callout |
| `Tree ↔ section` | turns a list item and its tree into a section under a heading, and back |

Each category has ready-made presets, such as a `Note`, `Tip` or `Warning` callout, and you can add your own. Each category gets its own pair of commands:

```text
<Field> · <category> next
<Field> · <category> previous
```

Outside the result of a category, `next` applies the first preset and `previous` the last. Inside it, they step through the presets.

## Write Values where the cursor is

A custom block holds Fields that are written where the cursor is, instead of in the Left Block or Right Block.

1. Press `Add Block` under the Fields list and drag Fields into it.
2. Give the block's command, `tagWheel <block name>`, a hotkey.
3. Optional: `Switch custom blocks on Tab` under **Tags & PKM → tagWheel behavior** lets `Tab` move to the next custom block.

Renaming a block renames its command; deleting it deletes its Fields too.

See it in motion: [A Block at the cursor](docs/SHOWCASE.md#a-block-at-the-cursor)

## Change the Separators

The two Separators fence your text off from the Fields. Both are `||` by default and may be the same.

1. Open **Tags & PKM → Separators**.
2. Change `First Separator` and `Second Separator`.
3. Lines written earlier keep the old ones. `Old Separators in your notes` then appears: press `Replace in all notes`. It shows how many lines will change and touches only the Separators.

When a Block is empty, its Separator may be left out. The line preview shows the exact shape.

## Choose what is left after a cycle

Two controls under **Tags & PKM → Writing rules** decide what happens after a Field command or tagWheel.

| Control | Choices |
|---|---|
| `When a line empties out` | `Keep bullet` (default): `- #done ::` → `- `; `Clear line`: a blank line |
| `Cursor after an action` | `Text end` (default), `Don't move`, `Line end` |

Your own text always stays: `- #done :: call Anna` → `- call Anna`.

## Mark a ticked line

`Mark ticked line` under **Tags & PKM → Writing rules** adds a tag or emoji when you tick a checkbox, and takes it off when you untick it.

1. Type the mark, such as `✅` or `#done`. A Value of one of your Fields takes that Field's place.
2. `Where the tick mark goes`: `Left Block` or `Right Block` (default).
3. Optional: `Strike through ticked line` crosses the line out.
4. Optional: `Dim ticked line` fades it; `Opacity of ticked line` and `Color of ticked line` set how.

See it in motion: [A mark for a ticked line](docs/SHOWCASE.md#a-mark-for-a-ticked-line)

## Pick Values with tagWheel

tagWheel is a picker that opens over the line: Fields run across it, Values of the current Field run down. Run `tagWheel Left` or `tagWheel Right`, then steer with keys:

| Key | Action |
|---|---|
| `Left` / `Right` arrow | previous or next Field |
| `Up` / `Down` arrow | step through the Values of the Field |
| `Tab` | switch to the other Block; in a custom block, see `Switch custom blocks on Tab` |
| `Alt` | show a child Field set to `On Alt` |
| `Enter` | apply |
| `Escape` | cancel and put the line back as it was |

Typing a character or clicking another line applies the choice too. tagWheel follows the same Fields, order, Prefix and cursor rules as the Field commands.

Set its behavior under **Tags & PKM → tagWheel behavior**:

| Control | Choices |
|---|---|
| `Active Field on opening` | `First Field` (default), `Middle Field`, `Chosen Field` with `Left Block active Field` and `Right Block active Field` |
| `Values in the other Block` | `Hide` (default) or `Show` while the picker is open |
| `Line for a selection` | `Top line` (default), `Bottom line`, `Where selecting ended` |
| `tagWheel navigation behavior` | past the last Field: `Stay in Block` (default) or `Next Block` |

See it in motion: [How it moves](docs/SHOWCASE.md#how-it-moves), [The Field it opens on](docs/SHOWCASE.md#the-field-it-opens-on)

## Decide which Prefix wins

Some Values change the start of the line, such as a checkbox from `Status`. When two want it at once, **Tags & PKM → Prefix priority** picks the winner.

| Control | Choices |
|---|---|
| `Decide by` | `Field order` (default) or `Prefix order`, a list you rank |
| `Field order source` | `Field order`, as in the Fields list, or `Manual` (default), a list you drag |
| `Parent or child wins` | `Parent tag` or `Child tag` (default) |

## Copy Fields into note properties

`Inline to note` can copy each Field into a property of the new note. In the right column of **Tags & PKM → Fields**, under `YAML property`:

1. `Property`: the property name. The box suggests names your vault already uses. Empty means the Field is not copied.
2. `Property type`: `Auto`, `Single Value` or `List`.
3. `How to show Value in YAML`, for the whole Field and all its Values:
   - `Raw` copies the Value as it is in the line: `#todo`, `[[Anna]]`, `📅2026-10-10`
   - `Clean` copies it bare: `todo`, `Anna`, `2026-10-10`

`Preview` shows what this Field writes. A numeric tag such as `#/1` stays text under `Clean` and is written as `"1"`.

When Transform writes a new note, or overwrites one, it:

1. reads the template's frontmatter;
2. replaces the values of matching top-level keys and keeps the other keys and their order;
3. adds missing mapped keys in Field order, without repeating a value in a shared list property;
4. stops, without writing, when the template has invalid or duplicate top-level keys.

The merge is not a full YAML parser. Quoted values, inline arrays and multiline values may be rewritten rather than kept as typed, so check complex frontmatter on a disposable note.

## Turn a line into a note

`Transform inline to note` turns the line you are on into a note of its own, or adds it to a note you already have. It is off until you turn it on.

> [!CAUTION]
> Transform writes files. Back up the vault and try every setting on disposable text before you use it on real notes.

### Turn it on

1. Keep the `Transform` module on under **General → Modules**.
2. Open **Transform → Inline to note** and turn on `Inline to note`.
3. Set `Templates folder` and `Default template`, or leave the template empty.
4. Set `New notes folder`, or leave it empty to put new notes next to the current one.
5. Read the defaults below and the preview under `Source line`.
6. Run `Transform inline to note` on a disposable line.

<details>

<summary>What happens with the defaults</summary>

| Control | Default | Effect |
|---|---|---|
| `Note name` | `From line` | the name comes from the line |
| `If the name already taken` | `New note` | a second note gets `-01`, `-02` and so on |
| `Where to put the text` | `End` | your text goes after the template body |
| `Line above the text` | `Date and time` | a heading with the date above your text |
| `What happens with current line` | `Remove` | the line keeps only the link |
| `Insert wikilink in current line` | on | the line gets a link to the new note |
| `Fields to keep` | none ticked | every Field is taken off the line |
| `Mark transformed line` | `#processed` | added to the Right Block |
| `Sub-lines (tree) behavior` | `Keep` | the lines under it stay where they are |
| `Open note after creation` | off | the new note does not open |
| `Floating button` | off | no button at the end of the line |

</details>

### Name the new note

`Note name` is `From line` or `Ask`. With `From line`, the name is:

1. the text between `Name brackets` (`[]` by default): `- call [Anna] today` → note `Anna`;
2. otherwise the heading text, when the line is a heading;
3. otherwise the first `Words to use instead` words (6 by default).

With `Ask`, a window asks for the name; `Escape` leaves both notes as they were. Characters a file name cannot hold become spaces.

`If the name already taken`:

| Choice | Result |
|---|---|
| `New note` | keeps the old note and makes `call Anna-01`, then `call Anna-02` |
| `Add to existing` | adds your text to the note, where `Where to put the text` says |
| `Overwrite` | replaces everything in the note; the old text cannot be brought back |

### Choose what goes into the note

Under **Transform → Note content**:

- `Where to put the text`: `Beginning`, `End` (default) or `Under heading`.
  - With `Under heading`, write `Name of the heading`, such as `## Log`. With the hashes, only a heading of that level counts; without them, any level does.
  - `If heading not found`: `Beginning` or `End`. The plugin adds the heading there and files the text under it.
  - The text goes to the end of the section, so entries stay in the order you wrote them.
- `Line above the text`: `Fixed text` (`Text of the line above`), `Date and time` (`Date format`, `YYYY-MM-DD HH:mm` by default) or `None`.
- `Line above is a heading`: `Plain text` or a heading level, `3` by default.

The note gets the whole tree: the line and the more-indented lines after it. With a selection, it gets the selected lines, widened to full lines, plus the children of the last one. The indent common to the block is removed; the nesting inside it stays.

```markdown
- Parent task
  - Child A
  - Child B
- Next task
```

Transform on `Parent task` takes both children, but not `Next task`.

### Choose what stays on the line

Under **Transform → Source line**, the preview shows the line before and after.

| Control | Choices |
|---|---|
| `Sub-lines (tree) behavior` | `Keep` (default): children stay; `Move`: children go into the note |
| `What happens with current line` | `Remove` (default), `Keep`, `Keep without name`, `Keep first words` with `Words to keep` |
| `Fields to keep` | ticked Fields stay on the line; `Keep sub-fields` keeps their child Values too |
| `Insert wikilink in current line` | a link to the new note; on by default |
| `Mark transformed line` | a word or tag added to the line, `#processed` by default; empty adds nothing |
| `Where the mark goes` | `Left Block` or `Right Block` (default) |
| `Dim transformed line` | fade a line that carries the mark; `Opacity of transformed line` and `Color of transformed line` set how |

Before and after, with `#task` kept and the defaults otherwise:

```markdown
- [ ] #task #research :: Draft release checklist :: [[Project Atlas]] 📅2026-09-15
- [ ] #task :: [[Notes/Release checklist]] :: #processed
```

The exact result depends on your Fields, Separators and output folder.

### Open the note and use the button

- `Open note after creation` opens the note in a new tab once it is written. If it fails to open, the transform still counts; open the note yourself.
- `Floating button` puts a small button at the end of the line you are on; `Distance from the text` sets the gap (12 px by default).

### What Transform does when something fails

- The source line changes only after the note is written.
- Before writing, Transform checks that the note and the line did not change under it.
- If the note is written but the line cannot be changed, it tries to undo the note change. It cannot promise to restore the line.
- It stops before writing when the template cannot be read or the line has no text.

None of this replaces a backup.

See it in motion: [A line becomes a note](docs/SHOWCASE.md#a-line-becomes-a-note), [What stays behind](docs/SHOWCASE.md#what-stays-behind)

## Link new notes from the notes you mention

Auto-MOC writes a link to the new note into the notes of the link Values on the line. `- call Anna [[Project X]]` turns into a note, and note `Project X` gets `- [[call Anna]]`.

1. Open **Transform → Auto-MOC in your links** and turn on `Link the notes you mention`.
2. `Where to put the link`: `Beginning`, `End` (default) or `Under heading`.
   - With `Under heading`: `Name of the heading`, `If heading not found` (`Beginning` or `End`) and `Place in the list` (`Top` or `Bottom`).
3. `Add after the link`: `Nothing`, `Field Value` (pick an Emoji Field) or `Date and time` (an optional emoji and a `Date format`).
4. `Add empty line before wikilink` (on) keeps a blank line between the links.
5. `Link to Navigator` also writes the link into the navigator note of a child link.

Set `Use as MOC` to `No` on a link Field whose notes should stay untouched, such as people.

See it in motion: [Links back to the notes you mention](docs/SHOWCASE.md#links-back-to-the-notes-you-mention)

## Pick a template by the kind of line

Smart Rules pick a template by the Values a line carries, so a `#meeting` line and a `#bug` line become different notes.

1. Open **Transform → Smart Rules** and press `Add rule`.
2. Add conditions: a Tag, Element, Link or Field. The window has a search box, and each Field has an `Any value` button.
3. Pick `Use template` and `Move to folder`: `Default`, `Next to note` or `Other folder…`.
4. Optional: `Advanced settings` → `Custom` gives the rule its own `Note content` rows. Back on `Default`, your custom rows are kept.

How rules match:

- Within one kind, any one Value is enough; every kind you filled in must be on the line.
- Rules are checked in order, and the first enabled match wins. Drag rules to reorder them.
- No rule matches: the default template is used.
- A rule without conditions is not used.
- Two rules that share a Value conflict, and neither is used until you fix one.

Rules fold to two lines: the name, then one summary line with conditions, template and folder.

```text
Tags: #meeting
Links: [[Project Atlas]]
Template: Templates/Meeting.md
```

See it in motion: [A template per line](docs/SHOWCASE.md#a-template-per-line)

## Change how tagged lines look

Everything on the **Visual** tab changes the look only; the text of your notes stays the same. Start with **Visual → Inline appearance**.

**Line view**

- `Opacity of the Left Block`, `Opacity of the Right Block`
- `Left Block text size`, `Right Block text size`
- `Color the Block with Stripe`: a Stripe behind each Block that has Values, with `Stripe direction` (`Left`, `Right`, `Both`), `Stripe color`, `Stripe opacity`, `Stripe height` and `Stripe width`

**Tag view**: `Tag bubble width`, `Tag bubble height`, `Tag bubble corners`, `Empty tag bubble width`. The colors and `Show` of each Value are set under **Tags & PKM → Fields**.

**Link view**, for links in your notes and link Values:

- `Link target color`, `Link brackets color`
- `Hyperlink target color`, `Hyperlink brackets color`, `Hyperlink address color`
- for link Values shown as your own text: `Preview on hover` (hold `Ctrl`) and `Drag to move`

See it in motion: [Tags, Blocks and the Stripe](docs/SHOWCASE.md#tags-blocks-and-the-stripe), [Link colors](docs/SHOWCASE.md#link-colors)

## Draw Tag Bars in the margin

Tag Bars draw a colored Bar in the margin for a line and the lines nested under it. They are off by default.

1. Open **Visual → Tag Bars** and turn on `Tag Bars`.
2. Pick `Which Field draws Bars` (tag Fields only). The Bar colors are the Value colors.
3. Adjust `Number of Bars`, `Show the Field’s tag`, `Hide the leftover marker`, `Bar arrangement` (`Parent outside` or `Rotate`), `Bar thickness`, `Space between Bars`, `Distance from the text`, `Vertical gap between Bars`, `Bars for the whole tree` and `Join Bars in a tree`.

See it in motion: [Tag Bars](docs/SHOWCASE.md#tag-bars)

## Change the look of tagWheel

Under **Visual → tagWheel**:

- `Show tag markers`: the hash and emoji, or just the words
- `tagWheel Value names`: `Default`, `Custom` or `Custom + default`
- `Highlight the tagWheel line`, then its colors: `Inactive Field text color`, `Active Field text color`, `Chosen Value text color`, `Background color`, and `Bold Field names`
- `Scroller`: a box of neighboring Values, with `Scroller opening direction` (`Up`, `Down`, `Both`), `Scroller Value names`, `Scroller background color`, `Scroller text color` and `Scroller size` (1 to 20 Values on each side)

See it in motion: [Its look](docs/SHOWCASE.md#its-look), [Its colors](docs/SHOWCASE.md#its-colors)

## Color and shape the text cursor

Under **Visual → Text cursor**, both switches are off by default and work apart.

- `Color the text cursor` with `Cursor color`. An empty color is your theme's.
- `Shape the text cursor` with `Cursor width` and `Blink speed`, from `0` (no blinking) to `10`; `5` is Obsidian's own speed.

The preview below them follows the sliders. Only the cursor in your notes changes; the settings window and the search box keep theirs.

See it in motion: [The text cursor](docs/SHOWCASE.md#the-text-cursor)

## Show where the cursor lands

Turn on `Highlight where you land` under **Visual → Cursor jump highlight**. After `Jump up`, `Jump down` and the other jumps, a circle shows where the cursor landed and shrinks away.

- `Highlight color`, `Highlight size`, `How long it lasts`
- `Minimum time between jumps`: jumps closer together get no circle
- `Use inside current line`: also mark hops between the parts of one line

Typing and the arrow keys never show it.

## Color tags that are not Values

Tags you type yourself, or that other plugins add, still get a bubble. Give them colors under **Visual → Color custom tags**: one row per tag, with its bubble color, text color, side color and `Show`. Leave a color empty to follow your theme.

See it in motion: [Colors for your own tags](docs/SHOWCASE.md#colors-for-your-own-tags)

## Save, restore or move your settings

A backup is an ordinary note that holds all your settings. Everything is under **Advanced → Backup**.

| Control | What it does |
|---|---|
| `Backup folder` | where backups go, `inlineOverhaul/Backups` by default; made on the first save |
| `Save a backup` | writes a new note each time, never over an old one |
| `Autosave` | off by default; when Obsidian starts and your settings changed, writes a copy into the `autosave` subfolder |
| `Autosaves to keep` | how many autosaves stay, 10 when empty; older ones go to the vault trash |
| `Save a backup before restoring` | on by default: a restore first saves what you have, ending in `Autogenerated` |
| `Restore a backup` | lists backups, newest first; replaces everything, then asks you to restart |
| `Delete all my settings` | back to the plugin's defaults; a copy is always saved first |

**What a backup holds.** Every tab: Fields and Values, Prefixes, Separators, colors, Tag Bars, tagWheel, Navigation, Binder, Transform with its Smart Rules. It leaves out which tab was open, which Fields were expanded and the notices you have seen. Hotkeys are Obsidian's and stay per vault; an autosave holds this plugin's hotkeys too, and lists `What changed`.

**Restoring replaces, it does not merge.** A backup from an older version still restores: it goes through the same upgrade as your settings file.

### Move your setup to another vault or computer

1. Save a backup.
2. In the other vault, install the same plugin version.
3. Copy the backup note into that vault's backup folder, or let your sync carry it.
4. Press `Restore a backup` there, pick the note and confirm.
5. Copy the templates your Transform settings use, keeping their paths, and check the YAML property names.

See it in motion: [Backup](docs/SHOWCASE.md#backup)

## Undo a settings change

Run `Undo last settings change` from the command palette, or give it a key. It takes back one settings change at a time, and its history lasts for the session. For anything older, restore a backup.

See it in motion: [Undo a settings change](docs/SHOWCASE.md#undo-a-settings-change)

## Collect a log for a bug report

**Advanced → Diagnostics** has four controls:

| Control | What it does |
|---|---|
| `Show option IDs in tips` | adds the id of each setting to its tip, to name it in a report |
| `Developer logging` | writes a log note of what the plugin did, with the text of the lines you edit |
| `Machine-readable log` | with logging on: a second, denser log for tools; off by default |
| `Log folder` | where the logs go |

Turn `Developer logging` on, repeat the problem once, turn it off, and read the log for private text before you share it.

## Fix a problem

<details>

<summary>A command says its module is switched off</summary>

Turn the module on under **General → Modules**. For Transform, also turn on `Inline to note` on the **Transform** tab.

</details>

<details>

<summary>A Field command is missing</summary>

1. Check that the Field is in the Fields list and its `Active` is `Yes` or `Commands only`.
2. Check that the `Tags & PKM` module is on.
3. Look for the Field's name in **Keyboard → Commands & Hotkeys**, or search `inlineOverhaul` in Obsidian's `Hotkeys`.
4. If it is still missing, disable and enable the plugin.

</details>

<details>

<summary>Settings look wrong after an update or an experiment</summary>

Run `Undo last settings change` for the last step. For more, press `Restore a backup` under **Advanced → Backup**. With `Save a backup before restoring` on, what you have now is saved first, so you can go back either way.

</details>

<details>

<summary>Transform made the wrong note</summary>

1. Stop transforming further lines.
2. Undo the source edit with `Ctrl+Z` while you still can.
3. Restore the affected notes from your backup or version history.
4. Check `If the name already taken`, `Fields to keep`, `Insert wikilink in current line`, `Sub-lines (tree) behavior`, `How to show Value in YAML`, the Separators and the template.
5. Try again on a disposable line.

</details>

<details>

<summary>Transform stops with a missing template or empty text</summary>

Transform stops before writing when the template cannot be read or the line has no text between its Separators. Fix the template path, relative to the vault, or use a line with text.

</details>

<details>

<summary>The plugin fails to start or breaks while you work</summary>

1. Disable inlineOverhaul and restart Obsidian.
2. Update through BRAT.
3. Enable the plugin and test on a disposable note.
4. If it still fails, collect a log: see [Collect a log for a bug report](#collect-a-log-for-a-bug-report).

</details>

## Beta limitations

- Transform writes real notes. It is covered by automated tests, but check it with your own templates, YAML and Fields.
- The first start on a clean vault and the upgrade of an older settings file are checked by hand only.
- No translation ships with the plugin: the `texts` folder holds `default.js` alone, for you to copy.

## Try it on a safe test note

Use made-up notes, tags, links and dates:

```markdown
## inlineOverhaul sandbox

- [ ] #task #research || Draft a synthetic release checklist || [[Project Atlas]] 📅2026-09-15
  - Verify package
  - Verify guide

- [I] #idea || Compare two fictional layouts || [[Project Borealis]]
```

Test one feature at a time and compare the text before and after. Restore the sandbox before you try the next setting that writes files.

## Glossary

The plugin renamed several of its mechanisms so that the panel says what a thing is. Older notes, videos and issues may use the left column.

| You may have seen | Now called | What it is |
|---|---|---|
| Order | **Fields** | The list of what a line can carry; position is set by dragging in the list |
| — | **Field** | One thing a line carries. Four types: `Tag`, `Link`, `Element`, `Action` |
| — | **Value** | One choice inside a Field |
| zone, segment | **Left Block** / **Right Block** | Fields before your text and Fields after it |
| — | **Block** | The Left Block, the Right Block, or a custom block made with `Add Block` |
| Strip, rails, stripes | **Tag Bars**, **Bar** | The colored bar in the margin for a line and its nested lines |
| Deep Editor | the right column of the Fields editor | It has no name of its own |
| free roam (`off` / `minimal`) | `Prefix behavior`: `Strict` / `Insert only` | Stored values are unchanged; the former `full` mode was replaced by custom blocks |
| hotkey_only | `Active`: `Commands only` | Commands work, tagWheel hides the Field |
| Prefix Resolver | **Prefix priority** | Which Value's Prefix wins when two carry one |
| subtag, Subtag format `separate` / `combined` | **child Value**, `Child tag format`: `Separate` / `Nested` | Now set per tag Field, in its `Behavior` block |
| separator1, separator2 | **First Separator**, **Second Separator** | The two markers that fence your text off from the Fields |
| payload | transferred text | The part of the line Transform carries into the new note |
| processed token, Processed marker | `Mark transformed line` | What Transform leaves on the source line |
| Replace payload with note link | `Insert wikilink in current line` | The link Transform leaves on the line |
| Source cleanup fields | `Fields to keep` | Fields that stay on the line after Transform |
| Sublines behavior: Stay / Remove | `Sub-lines (tree) behavior`: `Keep` / `Move` | What happens to the lines under the source line |
| SmartTransform rules | **Smart Rules** | Rules that pick a Transform template by the look of a line |
| Flying button | **Floating button** | A small button at the end of the line you are on |
| Inline2Note | **Transform**, `Transform inline to note` | Turning a line into a note of its own |
| No-selection mode: with-children | `Moving behavior`: `Whole tree` | Move a line with the lines under it |
| Cross-section allowed | `Cross heading boundaries` | Let a moved line pass a heading |
| Inline move mode | `Movement step` | How far selected text moves per press |
| On cycle end | `After the last one`: `Indent` / `Start over` | The end of the Prefix list |
| Line prefix after end of cycle | `When a line empties out` | What is left when the last Value goes |
| Cursor behavior | `Cursor after an action` | Where the cursor waits after a Field command |
| tagWheel Scroller | `Scroller` | The box of neighboring Values in tagWheel |
| Developer mode | `Developer logging` | The troubleshooting log |
| Toggle PKM module | `Toggle Tags & PKM module` | The command that turns Tags & PKM on or off |
| Active Rules Path | — | Removed; the path stays internal |
| YAML note format | — | Removed; replaced by `Raw` or `Clean` on each Field |
| Execution Backend, Flush Settings Now | — | Removed; settings save on their own |
| Undo last settings change (a button) | `Undo last settings change` (a command) | The button is gone; the command keeps the name |
| — | **tagWheel** | The picker above the line, steered with the arrow keys |
| — | **Binder** | Your own insert commands |
| — | **Prefix** | The start of a line: list marker, checkbox, heading hashes |
