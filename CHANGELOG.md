# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Release dates are ISO 8601, `YYYY-MM-DD`.

<!-- Сделанное между выпусками копится в `## Unreleased`; в коммите выпуска раздел
     переименовывается в номер версии, и под заголовок встаёт строка с датой и
     ссылкой на сравнение. Сборка `## Unreleased` намеренно пропускает: у него нет
     номера, с которым его можно сравнить.

     ЗАГОЛОВОК ВЕРСИИ — ОДНО СЛОВО, без скобок и без даты в самой строке.
     `tools/build/gen_release_notes.js` ищет `^##\s+(\S+)\s*$`, и формат Keep a
     Changelog с датой в заголовке сломал бы сборку.

     Форма пункта — его слово 2026-09-19: нумерованный, в одну строку, лаконичный,
     нумерация сквозная через все разделы версии. Держит форму
     `tests/regression/release_notes_tests.js`. -->

## Unreleased

1. 🎨 **`Show callouts` and `Show tips` come first in `Help`,** above `Guide` and `Changelog`.
2. 🎨 **Each release here lists new things first, then visible changes, then bug fixes.**
3. 🐛 **A hotkey on a Field command survives renaming the Field.** The command keeps its address, only its name in the palette changes; a hotkey lost to an earlier rename comes back on the next start.
4. 🐛 **`Inline to note` leaves no lonely Separator on numbered, quoted and heading lines.** `1. #todo :: Buy milk` now keeps `1. Buy milk …`, not `1. :: Buy milk …`.

## 0.14.0

_2026-10-03 · [all changes since 0.13.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.13.0...0.14.0)_

> [!NOTE]
> ✨ **3** new things · 🎨 **3** changes you can see · 🐛 **4** bug fixes
>
> **New in this release**
> - **Smart Enter on `Shift+Enter`**
> - **Autosaves in their own folder, as many as you choose**
> - **tagWheel keeps your selection**

1. ✨ **Smart Enter on `Shift+Enter`.** `Use Shift+Enter instead`, under Smart Enter, moves it to `Shift+Enter` and leaves `Enter` as usual.
2. ✨ **Autosaves in their own folder, as many as you choose.** Autosaves go into `autosave` inside the backup folder, earlier ones move there on the next start, and `Autosaves to keep` sets how many stay — 10 when empty.
3. ✨ **tagWheel keeps your selection.** Start it with lines selected and the selection stays highlighted; `Line for a selection` picks the top line, the bottom one or where you finished selecting, and `Esc` gives the selection back.
4. 🎨 **Help in the panel, in plain words.** Every callout now says what a section is for, and every `?` tip compares the choices and says which to pick — shorter and without the technical wording.
5. 🎨 **Setting ids show the current value.** With `Show option IDs in tips`, the tip ends with `id = value`, such as `backup-autosave = on`.
6. 🎨 **`Separators` starts folded.** The group is rarely needed, so it opens collapsed.
7. 🐛 **tagWheel leaves the cursor where it was.** Closing the panel with `Esc`, or with `Enter` before picking anything, no longer jumps the cursor to the end of the line.
8. 🐛 **Moving a heading no longer breaks the lines around it.** With `Heading only`, a heading steps over a whole list item, blank line or code block, and moving it up and back down restores the note, list numbers included.
9. 🐛 **The new Field preview matches the panel.** Time formats with seconds step by seconds, and the scroller keeps readable text on its own fill.
10. 🐛 **The symbol picker in `Add a Field` puts the symbol at the cursor.** It used to append it to the end of the value, unlike the same picker in the Fields editor.

## 0.13.0

_2026-10-02 · [all changes since 0.12.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.12.0...0.13.0)_

> [!NOTE]
> ✨ **4** new things · 🎨 **6** changes you can see · 🐛 **45** bug fixes
>
> **New in this release**
> - **A mark for a ticked line**
> - **`Move left/right` can take the tree along**
> - **`Bold Field names` in tagWheel**
> - **`Moved lines color`**

1. ✨ **A mark for a ticked line.** `Mark ticked line`, in `Writing rules`, adds a tag or emoji such as `#done` or `✅` when you tick `- [ ]` into `- [x]` and takes it off when you untick; `Where the tick mark goes` picks the Block, a mark that is a Value of one of your Fields goes where that Field stands, and `Dim ticked line` fades the line, and `Strike through ticked line` crosses it out.
2. ✨ **`Move left/right` can take the tree along.** `Indent the whole tree`, under `Change the indent`, gives the lines indented under the line the same step.
3. ✨ **`Bold Field names` in tagWheel.** On, every Field still showing its name is bold, the ones you are not on too, so the empty Fields stand out from the filled ones.
4. ✨ **`Moved lines color`** under `Highlight after moving` picks the color of the moved lines; unset, or reset, it is your theme's selection color.
5. 🎨 **The tagWheel preview follows `tagWheel Value names` and `Scroller Value names`.** A Value with its own text is printed the way the option says, and a list option already called `Default` no longer reads `Default (default)`.
6. 🎨 **Moving a selected word keeps the punctuation where it was:** `buy bread, [milk]!` moved left becomes `buy [milk], bread!`; a selected comma moves to the next word instead of joining two words, a word alone in quotes or brackets moves with them, and moving back gives the line you had.
7. 🎨 **`Name brackets` takes two different characters only,** and says so when it gets something else.
8. 🎨 **`Machine-readable log` is off for a new install,** and the times in the plain log are marked `UTC`; restoring a backup that matches your settings says nothing changed.
9. 🎨 **The toggle `Insert only: keep the Prefix` is gone.** Insert-only mode always writes the Separators between the Blocks and the text.
10. 🎨 **The scroller in the tagWheel preview walks the same loop as the note,** with the empty place `-` in it.
11. 🐛 **Note properties, divider lines and tables are left alone.** Field commands, tagWheel, `Inline to note`, `Smart Enter`, `Delete` and `Backspace` skip the frontmatter, a `---` line and a table, and a line starting with your separator is an ordinary line again.
12. 🐛 **Navigation skips code and tables.** A `# comment` inside a code block is not a heading for `Jump up/down` and `Whole section`, `Move up/down` jumps over a table as one piece, and `Move left/right` leaves code and table rows as they are.
13. 🐛 **A settings change after restoring an old backup stays.** Before, the next change was undone with “Settings changed on disk”; an old backup also shows its real Fields and Values in the list.
14. 🐛 **`Decide by = Prefix order` lists the Prefixes your Values use,** so there is something to put in order.
15. 🐛 **A tag Value is one word, and a Field holds a Value once.** Adding or renaming into a Value with a space or one the Field already has is refused with a message.
16. 🐛 **`Inline to note` does not do a line twice.** A line that already carries the mark is refused with a message, and the same text in another note makes a new note.
17. 🐛 **Note names from `Inline to note`** no longer start with dots, stay within 100 characters, and ignore footnotes such as `[^1]`; a name in brackets is taken off the line with `Keep first words`.
18. 🐛 **Smart Rules** conflict only when two rules share a Value, a tag inside your text does not pick a rule, and the buttons of each rule name that rule.
19. 🐛 **Editing fixes:** `Ctrl+A` on a heading skips the tree step, `Smart Enter` on a callout title continues the quote, tagWheel colors the active Field with `Show tag markers` off, a child line moved up past its parent becomes the last child, and `Move right` adds spaces to a line indented with spaces.
20. 🐛 **Other fixes:** `Developer logging` starts at once, `Log folder` is a folder, and an empty template frontmatter stays out of the note.
21. 🐛 **tagWheel keeps the `#` of a Value you have already picked.** With `Show tag markers` on, the Field you had just left showed `high` instead of `#high`.
22. 🐛 **Entries filed under a heading stay in the order you wrote them.** An entry heading as deep as the section heading, or less deep, goes one level below it.
23. 🐛 **tagWheel panel fill stays under a tag that shows its `#`, and a Value's own text sits next to it.** With `Custom + default`, `🎯 #todo` is as close as two words.
24. 🐛 **`Highlight after moving` colours the lines instead of selecting them.** The next letter you type no longer replaces what you just moved.
25. 🐛 **tagWheel shows a link Value by its label in the active cell:** `[Shown]`, not `Shown]`.
26. 🐛 **Undo from the command palette redraws the toggle you just clicked** in the settings.
27. 🐛 **`Jump right` by sentence past the Separators stops at the end of your last sentence,** and `Smart Delete` on several cursors is undone with one `Ctrl+Z`.
28. 🐛 **`Inline to note`:** the `Source line` preview keeps the checkbox as the command does, `{{title}}` is the note name, one blank line separates template and text, and `Ask` will not take an empty name.
29. 🐛 **Smart Rules speak the panel's words** — `Rule 2`, Tag, Element, Link — and `Custom` starts from your `Note content` values.
30. 🐛 **A new Element writes its date to YAML without the marker,** as `Due` does.
31. 🐛 **Backups:** restoring a backup of some tabs says so and counts only what it holds, `Start over` keeps the tab you had open, and the update notes window is not undone by `Undo`.
32. 🐛 **`Clear line` leaves an emptied line empty everywhere,** keeping only its indent and quote — the same from a command and from tagWheel.
33. 🐛 **Tag Bars let go of a Field you delete,** and the preview says the Bars need one.
34. 🐛 **Switching the Visual module off switches its look off.** Tag bubbles, Block dimming and size, Block fill, Tag Bars, the text cursor and the jump highlight go back to your theme; the tagWheel colors stay.
35. 🐛 **The `Highlight after moving` color goes away at your next step,** a cursor move included, not only when the cursor leaves the moved lines.
36. 🐛 **A list Value of an Element is one word.** A Value with a space is refused with a message, in the panel and in `Add a Field`, where a tag Value with a space is refused too; before, `✅ done` piled up in the text of the line.
37. 🐛 **A custom block Value does not split your word.** With the cursor inside a word it goes after the word, and taking it off at the end of the line takes its space too.
38. 🐛 **`Smart bracket` inside brackets works on those brackets.** Inside `[[Note]]` it takes the link brackets off, inside `[Note]` it makes a link, and a lone `[` no longer copies the rest of the line.
39. 🐛 **`Jump left` and `Text start` know headings and quotes.** The cursor stops after `> ` and after `# `.
40. 🐛 **`Field order source = Field order` works.** The Field order decides the Prefix; with `Manual`, the Fields missing from the list come after it, as the panel shows.
41. 🐛 **The tagWheel scroller names a link the way the line shows it.** `[[Alias Target|Shown]]` reads `Shown`, and a Value in a folder reads its name without the folder.
42. 🐛 **Insert-only mode keeps your quote and your checkbox.** `> ` and `- [ ]` stay at the start of the line; only the tag changes.
43. 🐛 **Smaller fixes:** a button of a window with the symbol picker open works at the first click, “… is switched off” says where to turn the module on, restoring hotkeys counts the keys, the backup list goes by the date in the backup, and `What changed` names the Binder instead of a settings path.
44. 🐛 **The command of a Field without Values says so** instead of doing nothing.
45. 🐛 **Plugin commands leave your text alone while you type in note properties or the note title,** the way Obsidian’s own editor commands do.
46. 🐛 **tagWheel shows a link with its own text whole** under `Custom + default`: `[PA Project A]`, not `[PA [[Project A]`.
47. 🐛 **A date in tagWheel steps down through today,** as `Due previous` does, and a counter steps down from `099` to `098`.
48. 🐛 **A counter goes on from the number on the line:** with the format `098`, `🔢7` becomes `🔢008` instead of `🔢106`, tagWheel no longer rewrites it when you change another Field, and `🔢999` steps to `🔢1000`.
49. 🐛 **Panel controls reach an open note at once,** `Empty tag bubble width` and `Preview on hover` included, without touching the note first.
50. 🐛 **A Field dropped on the row below it takes that row’s place,** as rules and Binder rows do.
51. 🐛 **A backup of every hotkey in the vault keeps the way back:** the backup taken before restoring it holds the other commands’ keys too, and the restore window says when only hotkeys changed.
52. 🐛 **A command right after typing is its own undo step:** one `Ctrl+Z` takes back the command and leaves what you typed, as `Swap line up` does.
53. 🐛 **tagWheel is readable in a dark theme with its colors left empty:** the Field names take the normal text color and the active one the hover accent, so both stand out from the highlight fill.
54. 🐛 **An empty tag bubble is as tall as the bubbles next to it.**
55. 🐛 **The scroller is readable on its own fill:** with `Scroller background color` set and `Scroller text color` empty, the text is dark on a light fill and light on a dark one, instead of the theme color.

## 0.12.0

_2026-09-30 · [all changes since 0.11.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.11.0...0.12.0)_

> [!NOTE]
> ✨ **4** new things · 🎨 **3** changes you can see · 🐛 **5** bug fixes
>
> **New in this release**
> - **An Element can be a list of your own Values**
> - **Name the child Field in tagWheel**
> - **Smart Enter works on every line**
> - **`Shift+Enter` can be the usual `Enter`**

1. ✨ **An Element can be a list of your own Values.** `Steps by` → `List of Values` (or `Writes` → `List` in `Add Field`) cycles Values that each carry their own emoji, such as `🙂‍↕️yes` and `🙂‍↔️no`, or an emoji alone — by command and in tagWheel, like a tag.
2. ✨ **Name the child Field in tagWheel.** `Child name in tagWheel`, under `Name in tagWheel`, shows up once a Field has child Values; without a name of its own the child is `sub`.
3. ✨ **Smart Enter works on every line.** A plain paragraph or a list item without Separators gets a new line below instead of being split; code, tables, an empty line and an empty list item keep the usual `Enter`.
4. ✨ **`Shift+Enter` can be the usual `Enter`.** `Shift+Enter as usual Enter`, under Smart Enter, makes it split the line and continue the list; off, `Shift+Enter` stays Obsidian’s own.
5. 🎨 **Settings that do not apply are hidden, not greyed out.** `Smart Enter` off hides `Where it works` and `Prefix on the new line`; the same goes for every section with a main switch.
6. 🎨 **Clearer names on the Keyboard tab:** `Smart SelectAll (Ctrl+A)`, `Smart Ctrl+A`, `Smart Paste (Ctrl+V)`. Values of an Element list sit in a frame with a drag handle each.
7. 🎨 **The symbol picker opens on `Emoji`.** Tabs go `Emoji`, `Symbol`, `Kaomoji` in Binder, in the Values of an Element list and in `Add a Field`.
8. 🐛 **A tag or link you type in your text stays your word.** Field commands, tagWheel and `Inline to note` no longer read `- buy #todo milk` as a Value, copy it into a Block or remove it; a Value at the start of a line is still a Value. `Keep typed tags in text` in `Placement modes` turns this off.
9. 🐛 **A tag typed into your text stays there when tagWheel sets a right Block Field.** Before, choosing a Value of such a Field removed the same tag from your phrase.
10. 🐛 **A link typed after the only separator is drawn as text.** `- [[Man1]] :: met [[Man1]] yesterday` no longer gives the second link the fill and size of the right Block.
11. 🐛 **Smart Delete no longer moves the next line into the Block.** `Del` at the end of `#high :: 123` over `💭 123` joins the text: `#high :: 123 💭 123`.
12. 🐛 **A custom block Value at the start of a line goes after the list marker.** With the cursor before `- ` the command or tagWheel wrote `🤡 - note`; now it is `- 🤡 note`, and the same for a checkbox, a quote and a heading.

## 0.11.0

_2026-09-28 · [all changes since 0.10.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.10.0...0.11.0)_

> [!NOTE]
> ✨ **9** new things · 🎨 **3** changes you can see · 🐛 **12** bug fixes
>
> **New in this release**
> - **`Delete` and `Backspace` merge the Fields of two lines**
> - **A link Value follows its note when you rename the note**
> - **`Add Field` asks for the emoji of a new Element**
> - **`Add a Field` sets up the essentials at once, with a live preview**
> - **Renaming a link Value can rename its note too**
> - **`Use as MOC` for a link Field**
> - **`Add empty line before wikilink`**
> - **Adding a link Value suggests your notes**
> - **A Prefix picker for Values**

1. ✨ **`Delete` and `Backspace` merge the Fields of two lines.** The second line's Values go to their Blocks and the texts join; the same Field on both lines keeps the first line's Value.
2. ✨ **A link Value follows its note when you rename the note.**
3. ✨ **`Add Field` asks for the emoji of a new Element,** and `Enter` confirms a new Field or Value.
4. ✨ **`Add a Field` sets up the essentials at once, with a live preview.** Pick the type, the Block and the YAML property, then Values with fill and text colors, a link's notes from a list of your notes, or what an Element writes and its step. The preview sits next to the buttons: tagWheel walks the Values by itself, the line beside it shows each in its colors.
5. ✨ **Renaming a link Value can rename its note too.** The window opens as soon as you start typing, counts the links to the note in your notes and renames the note with them, or only the Value.
6. ✨ **`Use as MOC` for a link Field.** Set it to `No` and `Link the notes you mention` writes no links into the notes of its Values.
7. ✨ **`Add empty line before wikilink`** in `Auto-MOC in your links`: turn it off and the links are written one under another, with no empty lines.
8. ✨ **Adding a link Value suggests your notes.** Click the box under a link Field's Values and pick a note, or type to filter.
9. ✨ **A Prefix picker for Values.** Click a Value's Prefix to see every checkbox drawn by your theme and pick one, or type your own.
10. 🎨 **`Move left` and `Move right` follow one rule.** The indent goes first, one step per press; at the left edge the line walks your Prefix list, and a task leaves its checkbox behind. With `Cycle line Prefixes` off the keys only change the indent, and the Prefix list is hidden.
11. 🎨 **A link Value is edited without its brackets.** Click it in the Values table and you type the name; the brackets come back when you leave the box.
12. 🎨 **Clicking the open settings tab scrolls it back to the top.**
13. 🐛 **A link Value with a space stays one Value.** `[[Project A]]` is no longer split in two by Field commands, tagWheel, Smart Enter or `Inline to note`, and your text next to it stays in place.
14. 🐛 **tagWheel no longer writes into another note.** Switching notes or closing the tab while the panel is open puts the line back as it was.
15. 🐛 **Typing or clicking another line closes tagWheel** the way `Enter` does, and the key you typed lands in the line.
16. 🐛 **Windows and messages of the settings open in the settings window,** not behind it: `Add Field`, `Rename Field`, `Delete Field`, backups and Smart Rules.
17. 🐛 **New, renamed and deleted Fields and Binder rows update their commands at once,** in the palette and in `Hotkeys`, without restarting the plugin.
18. 🐛 **Moving or changing a line keeps your checkbox and number.** `Move left`, `Move right` and Field commands keep `- [ ]`, `- [x]` and `1.`; `Clear line` empties only a line with nothing left on it.
19. 🐛 **Code blocks and tables are left alone.** Field commands, `Inline to note` and the floating button skip lines inside a code block or a table.
20. 🐛 **`Move up` and `Move down` stop once on a blank line** instead of jumping over it, and never move a line into or out of a code block.
21. 🐛 **`Inline to note` keeps a link in your text as text in the note name,** fills template variables, keeps a checkbox you typed and does not create notes for link Values.
22. 🐛 **Settings survive a broken or interrupted save.** A second broken settings file is kept as a dated copy instead of overwriting the first.
23. 🐛 **A date written with a space after its emoji is read,** such as `📅 2026-09-30` from Tasks: Field commands step it instead of leaving the date behind in your text.
24. 🐛 **A checkbox set in the Prefix of a link Value reaches the line,** such as `- [x] [[Man1]] :: call`; before, it was saved and never used.

## 0.10.0

_2026-09-26 · [all changes since 0.9.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.9.0...0.10.0)_

> [!NOTE]
> ✨ **7** new things · 🎨 **2** changes you can see · 🐛 **4** bug fixes
>
> **New in this release**
> - **Child Fields for links**
> - **`Parent is Navigator`**
> - **`Prerequisite` takes any Field and child Values**
> - **Three navigator options in `Inline to note`**
> - **A child Field waits for what its parent waits for**
> - **`Jump over neighbor trees` in `Move lines`**
> - **Link Values can point into a folder**

1. ✨ **Child Fields for links.** A link Field gets its `Child Field` like a tag: its child Values show up in tagWheel under the parent and have their own `next` and `previous` commands.
2. ✨ **`Parent is Navigator`.** Under `Child Field`: the parent Values become groups that only narrow the child list in tagWheel and are never written to the line, for tags, links and custom blocks alike. A child on the line stands for its parent: a Field waiting for the parent opens, and a Smart Rule asking for the parent matches.
3. ✨ **`Prerequisite` takes any Field and child Values.** A tag Field can wait for a Field of any type, and `Prerequisite Value` lists child Values indented under their parent.
4. ✨ **Three navigator options in `Inline to note`.** `Link to Navigator` also links the new note from the navigator's note, `YAML of navigator values` writes the navigator into the parent property, and `Keep sub-fields` keeps child Values of the Fields you keep.
5. ✨ **A child Field waits for what its parent waits for,** and changing a child Value clears the Field that was waiting for it.
6. ✨ **`Jump over neighbor trees` in `Move lines`.** With `Whole tree`, every press moves the tree past the whole neighbor tree, also with `Highlight moved lines`, and the neighbor keeps its own lines.
7. ✨ **Link Values can point into a folder.** A Value like `Projects/Alpha` is written as `[[Projects/Alpha|Alpha]]`: the line shows `Alpha`, and a click opens the note in `Projects`.
8. 🎨 **Shorter choices in the panel's drop-down lists.** Every choice now says only what it picks — `The line only` is `Line only`, `Center of the screen` is `Center`, `Show when press Alt` is `On Alt`; your settings stay as they were.
9. 🎨 **No floating button on a processed line,** so the line is not sent to a note twice by accident.
10. 🐛 **Adding a Value no longer jumps to the first Field.** The Fields editor keeps the Field you picked while you add Values, rename or add Fields.
11. 🐛 **A navigator child alone on the line reaches the note.** Without `Show always`, `Inline to note` now takes it as a Value: its links and YAML property are written.
12. 🐛 **A child Field stands next to its parent in tagWheel,** also when the parent waits for another Field.
13. 🐛 **`Inline to note` links the note your link opens.** With several notes of the same name, the link goes to the one a click on it opens from your line.

## 0.9.0

_2026-09-24 · [all changes since 0.8.1](https://github.com/romkuznetsov/inline-overhaul/compare/0.8.1...0.9.0)_

> [!NOTE]
> ✨ **4** new things · 🎨 **8** changes you can see · 🐛 **2** bug fixes
>
> **New in this release**
> - **Custom blocks write where the cursor is**
> - **A custom block's Fields step on the Value under the cursor**
> - **`Tab` can move between custom blocks**
> - **`Side` colours the outline of a tag**

1. ✨ **Custom blocks write where the cursor is.** `Add Block` under the Fields list makes a Block of your own with its command `tagWheel <block>`: it opens at the cursor, splits the text there, and `Enter` writes the picked Values between your words. On a Value of the block it opens on that Value and replaces it.
2. ✨ **A custom block's Fields step on the Value under the cursor.** Their `next` and `previous` change that Value; away from one they put the first or the last Value at the cursor.
3. ✨ **`Tab` can move between custom blocks.** `Switch custom blocks on Tab` under **Tags & PKM → tagWheel behavior**; off, `Tab` there does nothing.
4. ✨ **`Side` colours the outline of a tag.** A new column in the Values table and in `Color custom tags`; pure white means no outline, and the reset button takes it back to the theme.
5. 🎨 **tagWheel settings about how it moves have their own group.** `Active Field on opening`, `Values in the other Block` and `tagWheel navigation behavior` moved to **Tags & PKM → tagWheel behavior**; your values stay as they were, and a backup takes them with the `Tags & PKM` tick.
6. 🎨 **`Prefix behavior` has two modes, `Strict` and `Insert only`.** A Field that writes at the cursor belongs in a custom block; `Free: insert position` is gone with `Free`.
7. 🎨 **A Value cannot share its spelling with another Field's Value.** The editor refuses it with a message.
8. 🎨 **Every tag you edit gets the same bubble.** `Tag view` now shapes all tags in the editor, in any note, and only their colours differ; a tag inside code stays as Obsidian draws it, and reading view is unchanged.
9. 🎨 **A tag with no colours of its own looks like a tag of your theme.** Fill, text and outline come from the theme until you pick your own; pure white in `Fill` means no fill.
10. 🎨 **Clearer panel texts.** `Standard commands` is now `Main commands`, headings are called headings, and the tips name settings the way the panel shows them.
11. 🎨 **`Add Block` and `Add Field` fill the width of the Fields column.**
12. 🎨 **The line preview in the panel is smaller and has no Block band.**
13. 🐛 **A tag in the middle of your text stays in your text.** On a line without separators, `tagWheel Left` no longer copies it into its Block, and a Right Block command no longer splits your text around it.
14. 🐛 **A tag in your text keeps its size after `next` on a Right Block Field.** A line with one separator and a date after it no longer draws the text before it as Left Block, and neither does a line where `tagWheel Right` is open.

## 0.8.1

_2026-09-24 · [all changes since 0.8.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.8.0...0.8.1)_

> [!NOTE]
> 🎨 **3** changes you can see · 🐛 **1** bug fix

1. 🎨 **Two Visual groups have clearer names.** `Jump highlight` is now `Cursor jump highlight`, and `Color your Tags` is now `Color custom tags`: it colours the tags that are not a Value of any Field in `Tags & PKM → Fields`, and says so.
2. 🎨 **`Color custom tags` moved to the bottom of `Visual`.**
3. 🎨 **The tagWheel and line previews write Fields at the size of the text around them.** `Left Block text size` and `Right Block text size` now change only the tag preview.
4. 🐛 **The scroller stays with the picker when you scroll the note.** It used to stay put on the screen while the line moved away; now it moves with the line and hides once the line leaves the note area.

## 0.8.0

_2026-09-23 · [all changes since 0.7.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.7.0...0.8.0)_

> [!NOTE]
> ✨ **3** new things · 🎨 **5** changes you can see · 🐛 **1** bug fix
>
> **New in this release**
> - **Pick what Binder inserts instead of hunting for it**
> - **A Field's emoji has the same picker**
> - **A child Field can wait for `Alt`**

1. ✨ **Pick what Binder inserts instead of hunting for it.** Press `Inserts` in the new-command window: `Symbol`, `Emoji` and `Kaomoji` open under it — every emoji of the Windows 11 panel and over three hundred and fifty symbols that stay plain text in a note, under headings, with a search by name. The command name fills itself in — `→` becomes `Arrow right` — and stays yours to change.
2. ✨ **A Field's emoji has the same picker.** Press `Emoji-prefix` and choose from the same emoji under the same headings, or paste your own character as before.
3. ✨ **A child Field can wait for `Alt`.** `Child Field` has a fourth setting, `Show when press Alt`: tagWheel shows the child only after you press `Alt` on its parent, with or without a parent Value. Press `Alt` again or step to another Field, and it hides; the picked Value stays. With `After parent`, `Alt` opens the child early. `Alt` with another key stays your hotkey.
4. 🎨 **Field types wear the brand colours.** A Tag chip is amber with dark text, a Link chip is steel — in the Fields list, in each Field's heading and in the line preview. Emoji keeps its green.
5. 🎨 **The General tab opens with the plugin's wordmark.** Its caret blinks, unless your system turns animations off; it scrolls away with the page and stays off a phone screen, where it would have to shrink.
6. 🎨 **Tips speak in the present.** Twenty-two lines lost their `you will`, passive `can be` and one exclamation mark; what they say is unchanged.
7. 🎨 **`Transform` comes before `Visual`** in the settings tabs and among the module switches on `General`.
8. 🎨 **New-command and new-Field windows explain themselves.** Each of their fields has a `?`; in the Binder window it carries the same tip as the column in the table.
9. 🐛 **A required field is red from the start.** The red border no longer turns grey while the cursor sits in the empty field.

## 0.7.0

_2026-09-22 · [all changes since 0.6.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.6.0...0.7.0)_

> [!NOTE]
> ✨ **5** new things · 🎨 **6** changes you can see · 🐛 **7** bug fixes
>
> **New in this release**
> - **Every subheading in the settings folds**
> - **A setting nothing works without is outlined in red until you fill it**
> - **A link takes your colours anywhere in a note**
> - **A hyperlink has its own two colours**
> - **Addresses have a colour of their own**

1. ✨ **Every subheading in the settings folds.** `Line view`, `Tag view`, `Link view`, `Panel`, `Scroller`, `Move text` and the rest carry the same triangle the group headings do, and each remembers whether you left it open. It is what makes a long group readable: fold what you are not changing and the preview at the top of it stays in view.
2. ✨ **A setting nothing works without is outlined in red until you fill it.** `Emoji-prefix` of an `Emoji` Field is one: leave it empty and the picker refuses to open at all, with `these fields need an Emoji`. The outline goes the moment you type. The same goes for the text a Binder row inserts.
3. ✨ **A link takes your colours anywhere in a note.** `Link target color` paints what you read — the name in `[[…]]`, the text of `[a link](…)`, a bare `www.…` — and `Link brackets color` paints the markup around it. Leave a colour unset and nothing is painted, as before.
4. ✨ **A hyperlink has its own two colours.** `Link target color` and `Link brackets color` now paint a wikilink only; the new `Hyperlink target color` and `Hyperlink brackets color` paint a markdown link and a bare address, in any note. Had the first pair set? The new one starts out the same. A live preview at the foot of `Link view` shows all three forms.
5. ✨ **Addresses have a colour of their own.** `Hyperlink address color` paints every address — the one inside the round brackets of a markdown link and one written on its own. `Hyperlink target color` is left with the text between the square brackets. Had `Hyperlink brackets color` set? The new row starts out the same.
6. 🎨 **The tagWheel group is two halves now.** What the picker draws stands under `Panel`, the box of neighbouring Values under `Scroller`. The opening-Field rows moved into `Panel` under `Show tag markers`, `tagWheel opening` is gone, and so is the arrow behaviour's stay in the scroller half. No setting changed its value.
7. 🎨 **Four commands and five headings read the way you say them.** `Move up`, `Move down`, `Jump left` and `Jump right` replace their longer names, and the four `Navigation` headings plus `Auto-MOC in your Links` follow suit. Names only — the identifiers are the same, so your hotkeys stay put.
8. 🎨 **`Show option IDs in tips` moved to `Advanced → Diagnostics`.** It had a heading to itself for one row; ids and the developer log answer the same question, so they now stand together.
9. 🎨 **A command list no longer repeats its own heading.** Under `Command reference` and in the `Commands` section of a Field the area stood in front of every row — `Navigation: Move left` under a heading that already said `Navigation`. The column shows `Move left` now; the command itself keeps its full name, and pressing a key cell still opens Obsidian's `Hotkeys` screen at it.
10. 🎨 **The child-Field list opens on `After parent`.** That is what it has always done by default; the list simply opened on another line, which reads as though that one were standard.
11. 🎨 **The "what changed" window opens with a count, not a paragraph.** Each release now starts with how many fixes, visible changes and new things it carries, and a bulleted list of what is new — instead of one block of prose. The counts are built from the entries themselves, so they cannot drift.
12. 🐛 **`not set` in a hotkey column is grey again.** Obsidian paints every button of its own, and its rule was stronger than ours: an unassigned key was drawn in ordinary text on an ordinary button fill, and only the italics told it apart. It is now grey on nothing, the way it was meant to be — in `Command reference`, in `Binder` and in the `Commands` section of a Field.
13. 🐛 **`Restore default` on a color no longer gives you black.** The plugin read your theme's colour as text, and `hsl(0, calc(0% - 20%), …)` is not something it could parse — so it declared no default and the picker fell to `#000000`. It asks the browser for the computed colour now: on `Minimal` that was eleven fields of twelve.
14. 🐛 **Moving a word past a bracket steps onto the bracket, not over it.** The closing bracket used to travel with the neighbouring word. A step now takes a bracket or a sentence mark on its own, and the space between the two moves with it: `(слово1 слово3) слово2`. Nothing is added or removed — two gaps trade places.
15. 🐛 **The picker's preview shows the picker's own stripe.** The Block stripe was painted over the same line and won the cascade, so `Background color` never reached the screen there. The line carries one stripe now: on with `Highlight the tagWheel line`, in the colour you set, and gone when the toggle is off.
16. 🐛 **Moving text stops where your line's markup begins.** A bullet, a checkbox or a list number is not a word to trade places with: text stuck to it and, one press on, tore it in half. An opening bracket keeps its side too, so a word leaving one reads `- слово3 (слово1 слово2)`.
17. 🐛 **Moving text no longer scrolls the note away.** The command used to write the whole document back for a change inside one line, and anything anchored to a range of the note went with it — a folded section above your line sprang open, the note grew, and the screen jumped. It writes only the part of the line that changed now, so folds stay folded and the view stays put.
18. 🐛 **A bracket is a step of its own now.** Moving selected text past `(a word)` used to jump the whole group in one press. It steps onto the bracket, into the group and out again — three presses, the way you laid them out. A link is the exception and stays whole: `[[a note]]`, and now `[a link](an address)` too, which a step used to tear in half.

## 0.6.0

_2026-09-21 · [all changes since 0.5.1](https://github.com/romkuznetsov/inline-overhaul/compare/0.5.1...0.6.0)_

> [!NOTE]
> ✨ **6** new things · 🎨 **5** changes you can see · 🐛 **5** bug fixes
>
> **New in this release**
> - **The scroller can label Values the way you print them**
> - **The picker can label a chosen Value the way you print it**
> - **Every Field lists its own commands, with the keys they are on**
> - **The sections of that column fold**
> - **New: `Smart paste`**
> - **A link Value can be coloured in two halves**

1. ✨ **The scroller can label Values the way you print them.** `Visual → tagWheel → Scroller Value names` chooses between the Value as it is written in the line, the custom text you gave it in `Color your tags`, or both at once — so the box shows `🎯`, `#todo`, or `🎯 #todo`. Where no custom text is set, the written Value is shown, so a Value never goes blank.
2. ✨ **The picker can label a chosen Value the way you print it.** `Visual → tagWheel → tagWheel Value names` chooses between the Value as it is written, the custom text you gave it in `Color your tags`, or both at once. Where no custom text is set, the written Value is shown, so a Field never goes blank.
3. ✨ **Every Field lists its own commands, with the keys they are on.** The right-hand column of `Tags & PKM → Fields` ends with `Commands`: the Field's own `next` and `previous`, its child Field's pair, and the key each one carries. Press a key cell and Obsidian's `Hotkeys` screen opens at that command. Rename a Field and the list follows at once.
4. ✨ **The sections of that column fold.** `Values`, `Behavior`, `YAML property` and `Commands` each carry the same triangle the settings headings do, and each remembers whether you left it open.
5. ✨ **New: `Smart paste`.** A numbered list you paste is counted from one instead of carrying the numbers it had where you cut it — unless it lands under a list you already have, and then that list's count carries on. Pasting `1. text` into a line that already starts with a number drops the pasted marker: `2. text`, not `2. 1. text`. Off by default.
6. ✨ **A link Value can be coloured in two halves.** `Visual → Link view` adds `Link target color` and `Link brackets color`: the name inside `[[the note name]]` and the brackets around it. Values of a link Field only — links you typed yourself are untouched. Obsidian hides the brackets unless your cursor is on that line.
7. 🎨 **The README links to the showcase instead of embedding recordings.** The animations stay in [`docs/SHOWCASE.md`](docs/SHOWCASE.md), and the page above them loads at once.
8. 🎨 **Four commands read the way they work.** `Jump back` and `Jump next` are now `Jump up` and `Jump down`; the two that open the picker are now `tagWheel Left` and `tagWheel Right`. The picker is written `tagWheel` everywhere you see it, the way `inlineOverhaul` is. Names only — the command identifiers are the same, so your hotkeys stay put.
9. 🎨 **A tag is drawn the size Obsidian draws it.** In the editor a tag used to take the size of the text beside it, which made it larger than the same tag in reading mode. It now takes the size your theme gives a tag, so both modes agree. Inside a Block it still sits centred on the line; in your own text it sits on the baseline, the way a tag does everywhere else.
10. 🎨 **The picker's opening Field moved in with the rest of it.** `Visual → tagWheel opening` was a heading of its own; its three settings now stand at the foot of `Visual → tagWheel` under a subheading of the same name, the way the scroller settings stand under `Scroller`. Nothing changed but where they are.
11. 🎨 **One label, one answer.** `Tags & PKM → Cursor after an action` offered `End of your text (recommended) (default)` — the panel's own mark for the standard choice, and mine for the same thing, read one after the other. Mine is gone; the row's tip still says which one you usually want.
12. 🐛 **A two-digit year is a year again — from the tagWheel too.** A Field whose `Value format` is `yy-mm-dd` wrote the letters `yy` into the line and then failed to recognise its own value. `YY` is now a token like `YYYY`, and the picker writes it the same way the commands do.
13. 🐛 **The tagWheel no longer draws a bubble over its own markup.** On a fresh install, where none of the panel colors had been set, the picker drawn over your line got a Value bubble on top of it.
14. 🐛 **The tagWheel keeps the words you wrote before your Fields.** A link or a plain word standing in the left Block — anything the plugin does not recognise as a Value — disappeared from the line as soon as you picked a Value there. The commands always kept it; the picker now keeps it too.
15. 🐛 **No `====` around the picker on the right.** The strip is wrapped in a highlight so it gets a fill, and Obsidian shows the raw `==` whenever the caret sits inside one — which is exactly where the caret landed for the right Block. It now rests outside the strip, on an empty line as well, so both sides look the same.
16. 🐛 **A word of yours no longer sits among the Values.** `Importance next` on `- [[a note]] :: your text` left the link where it was; now it moves into your text, the way the picker has always moved it: `- #high :: [[a note]] your text`. Any word the plugin does not recognise as a Value is yours, and it belongs on your side of the Separator.

## 0.5.1

_2026-09-20 · [all changes since 0.5.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.5.0...0.5.1)_

> [!NOTE]
> ✨ **3** new things · 🎨 **4** changes you can see · 🐛 **2** bug fixes
>
> **New in this release**
> - **New: a tutorial**
> - **New: a settings reference**
> - **New: `CONTRIBUTING.md`, `SECURITY.md`, and issue and pull request templates**

1. ✨ **New: a tutorial** — [`docs/TUTORIAL.md`](docs/TUTORIAL.md) walks from install to a working line in about fifteen minutes, one path and no choices to make.
2. ✨ **New: a settings reference** — [`docs/SETTINGS.md`](docs/SETTINGS.md) lists every control of the panel, tab by tab, in the panel's own order, with the value each one starts at.
3. ✨ **New: `CONTRIBUTING.md`, `SECURITY.md`, and issue and pull request templates** — what makes a bug report actionable, and how to report a security problem privately instead of in a public issue.
4. 🎨 **The README is a landing page.** The wordmark, four badges and a recording of the plugin at work come before any prose; the tab-by-tab walk through the settings panel it used to carry moved into the settings reference.
5. 🎨 **`FEATURES.md` reads as a list again**: the opening pitch moved to the README, and what is left is what the plugin does, without adjectives.
6. 🎨 **This changelog carries the release date** under every version heading, and a link to the full comparison between that release and the one before it.
7. 🎨 **Every document written for you is named in capitals**, the way `README.md` always was: `INSTRUCTIONS.md`, `docs/TUTORIAL.md`, `docs/SETTINGS.md`, `docs/SHOWCASE.md` and `docs/COMMAND_IDS_V1_V2.md`. GitHub tells capitals apart in a file address, so a link you saved to one of the old names returns 404 — the new name is the same page.
8. 🐛 **The command id map is in English**, and it no longer says these commands dropped the area from their names: since `0.5.0` they carry it again, and the map said the opposite.
9. 🐛 **The guide no longer promises a rules note in your vault.** The rules the engines work from are built from your settings as the plugin loads, and the note itself was removed several releases ago.

## 0.5.0

_2026-09-20 · [all changes since 0.4.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.4.0...0.5.0)_

> [!NOTE]
> ✨ **4** new things · 🎨 **3** changes you can see · 🐛 **4** bug fixes · 🔧 **1** internal change
>
> **New in this release**
> - **Every heading in `Commands & Hotkeys` has a `to hotkeys` button**
> - **A dropdown says which of its values is the standard one**
> - **A Field of type link can show its Values as anything you like**
> - **New: `Link view`**

1. ✨ **Every heading in `Commands & Hotkeys` has a `to hotkeys` button** — an area, a part of it, or one of your Fields — and it opens Obsidian's `Hotkeys` screen filtered to exactly that heading's commands.
2. ✨ **A dropdown says which of its values is the standard one**: the value the plugin starts with carries `(default)` after its label, in every settings row that offers a list. A list with a single line — `Set a Templates folder first`, say — is left alone: there is no choice to point at.
3. ✨ **A Field of type link can show its Values as anything you like.** Its Values table has the `Show` column now: pick `custom`, type an emoji, and `[[Project A]]` is drawn as that emoji — a click on it still opens the note, in a new tab with `Ctrl`. At `default` it stays the link Obsidian draws.
4. ✨ **New: `Link view`** under `Visual → Inline appearance` — two switches that hand a shown link back what an ordinary link gets from Obsidian: the preview on hover and dragging. Both off by default.
5. 🎨 **Each command is named after its area now**: `Navigation: Move line up`, `Tags & PKM: Category next`. That is what makes the filter above exact — Obsidian's `Hotkeys` search matches words in a name. Identifiers did not change, so every hotkey you have set keeps working.
6. 🎨 **`not set` in the `Hotkey` column reads as an empty slot**: no button fill, a dashed outline and faint italic text, so an unassigned command is told from an assigned one at a glance.
7. 🎨 **This changelog opens each release with a one-paragraph summary** and marks every line with what it is: ✨ new, 🐛 fix, 🎨 visible change, 🚀 speed, 🔧 internal.
8. 🐛 **A numbered list keeps counting after you move a line in it.** A sub-line moved under another parent, or to the top of its own sub-list, used to keep the number it came with — `3.` where `1.` belongs. Moved lines are now numbered from the nearest item above them at the same level. A list started at another number keeps it, unless you move its first line.
9. 🐛 **A Value shown as your own text is one step for the cursor.** Arrow keys and `Shift+→` used to walk the hidden characters of `[[Project A]]` behind a single emoji; the replaced piece is now crossed in one step, and selected whole. The same goes for a tag shown as `custom` or `empty`.
10. 🐛 **A shown link can be dragged at last.** Pressing it used to be swallowed by the plugin, and a press that is swallowed never becomes a drag. The press is now left to the browser and the note is opened on click — which is also how an ordinary link behaves.
11. 🐛 **`Inline to note` no longer leaves a separator with nothing to separate.** A line whose Values all stood before your text — `- #work [[Project A]] :: 12` — came back as `- :: [[note]] :: #processed`. The empty slot goes with its Values; a line that still has a right Block keeps it.
12. 🔧 **The `docs` folder shows only what a reader needs**: the showcase, its media, the old-to-new map of command ids and the settings prototype. Everything written for whoever develops the plugin moved into `docs/dev/`; nothing was deleted.

## 0.4.0

_2026-09-20 · [all changes since 0.3.2](https://github.com/romkuznetsov/inline-overhaul/compare/0.3.2...0.4.0)_

> [!NOTE]
> ✨ **5** new things · 🎨 **5** changes you can see · 🐛 **8** bug fixes · 🔧 **3** internal changes
>
> **New in this release**
> - **Block text size is set for each side on its own**
> - **New: `Stripe direction`**
> - **New: a `Changelog` button**
> - **New: a child Field can work without its parent**
> - **New: `Autosave`**

### Added

1. ✨ **Block text size is set for each side on its own.** `Text size` under `Inline appearance` became `Left Block text size` and `Right Block text size`; whatever you had is written into both on first run.
2. ✨ **New: `Stripe direction`** — which Block gets the Stripe behind it: `Left`, `Right` or `Both`. `Both` by default, so nothing changes until you pick a side.
3. ✨ **New: a `Changelog` button** in `General → Help` opens this file on GitHub, every release, newest first.
4. ✨ **New: a child Field can work without its parent.** `Child Field` in the Fields editor became a choice of three — `Show always`, `After parent` (what it always did) and `Hide` — and `Show always` adds a second row, `Parent Value`: leave the line alone, or also write the parent Value the picked one belongs to. Per Field, and nothing changes until you pick it.
5. ✨ **New: `Autosave`** under `Advanced → Backup` writes a copy of your settings whenever the file differs from the last autosave, checked at every start of Obsidian, and says so. Off by default, ten newest kept, and each copy lists what changed. The tab you left open is not a setting and never triggers a copy.

### Changed

6. 🎨 **The settings panel is laid out in sections.** `Inline appearance` has `Line view` and `Tag view`; the `Keyboard` groups `Expanded 'Ctrl+A'`, `Smart Delete\Backspace` and `Smart Enter` became sections of one group, `Global hotkeys`. Nothing moved out of reach.
7. 🎨 **The window title in every dialog has a size of its own** instead of whatever the theme makes of an `h4` — in some themes that was smaller than the headings underneath it. Eight dialogs.
8. 🎨 **Five Stripe rows are renamed:** `Color the Block with Stripe`, `Stripe color`, `Stripe opacity`, `Stripe height`, `Stripe width`. The old names still find them in the settings search.
9. 🎨 **This file reads as a numbered list**, one line per change, so you can see at a glance how many things a release touched.
10. 🎨 **The `What changed` list in an autosave note names the controls and nests them the way the panel does.** A Value sits under its Field and its colors sit under the Value, every row is called by the name it carries in the settings panel instead of a config path, and rows the panel merely rewrote with their defaults are left out.
11. 🐛 **TagWheel no longer writes a value twice.** A line carrying the value of a child Field whose parent is not on the line got that value again in the Right Block; it now stays as it is.
12. 🐛 **Everything written in a Block is the size of the line it sits on, and on the same level.** The size used to come from a number in the code rather than from your text, and the bubble sat a point above the writing next to it.
13. 🐛 **Settings edited outside Obsidian are picked up even when Obsidian says nothing.** Copying a `data.json` in from another vault keeps the source's timestamp, and Obsidian announces only files newer than the plugin's last write — so the plugin now looks at the file before writing its own settings, and the disk wins.
14. 🐛 **The "what changed" window reads properly.** It renders its Markdown, shows every release you skipped rather than the newest one alone (up to five, newest first), and carries a link to the full changelog.
15. 🐛 **The live preview of a jump highlight no longer promises a press.** The circle has run on a timer since 0.3.1.
16. 🐛 **A wiki link in the `Inline appearance` preview follows the Block text size**, as everything else in that preview already did.
17. 🐛 **A child Field set to `Show always` with `Add the parent Value` now cycles through every one of its Values.** The parent the plugin writes for you is no longer read back as your own pick, so the ring no longer collapses to the first Value; the parent follows the Value you land on and leaves the line with it. A parent you put there yourself still narrows the ring, as before.
18. 🐛 **A field command no longer writes over an open TagWheel.** While the panel is up its view lives in the line itself, so a command invoked by hotkey edited that view instead of your text and the work was lost when the panel closed. Now such a command does nothing and says so; pressing the panel's own command still applies it as before.
19. 🔧 The plugin author is `Roman Kuznetsov`.

### Internal

20. 🔧 **The parsed cache of the old TagWheel config note is removed from your settings file.** The note itself went in 0.2.0; its cache stayed and looked like settings — editing it by hand changed nothing, because nothing reads it.

21. 🔧 **The repository root holds no plugin file.** `main.js`, `navigation_runtime.js`, `pkm_runtime_v2.js`, `pkm_v2/` and `styles.css` live under `src/`, `build/` under `tools/`, `media/` and `SHOWCASE.md` under `docs/`; nine old documents moved to `docs/dev/archive/`. Nothing was deleted, and the bundle differs by 28 lines out of 33 000 — all of them the bundler's own labels.

## 0.3.2

_2026-09-18 · [all changes since 0.3.1](https://github.com/romkuznetsov/inline-overhaul/compare/0.3.1...0.3.2)_

> [!NOTE]
> 🎨 **1** change you can see · 🐛 **1** bug fix · 🚀 **1** speed-up · 🔧 **4** internal changes

### Changed

1. 🎨 **The settings panel opens on the tab you left it on**, and switching tabs does not take up an undo step.
2. 🐛 **Settings changed outside Obsidian are picked up instead of being overwritten.** The plugin re-reads the file, redraws the panel, rebuilds the decorations in open notes and says so once. The disk wins, and your own edit in the panel stays silent.

### Performance

3. 🚀 **TagWheel no longer stalls on a very long line.** Opening the panel on a line of 20 000 characters took about 1.3 seconds and now takes about 50 milliseconds; on an ordinary line the result is identical, checked on 4 737 real pairs.

### Internal

4. 🔧 Row drag-and-drop is declared once instead of twice, with the one genuine difference as a parameter.
5. 🔧 Coverage is measured on both roads — the editor layer and the TagWheel session run in a browser, and their coverage was not collected at all.
6. 🔧 Type checking is switched on for four core files; all thirty errors it found were missing annotations, not defects.
7. 🔧 The document read in full before every session is a quarter shorter: three growing tables moved to files of their own.

## 0.3.1

_2026-09-18 · [all changes since 0.3.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.3.0...0.3.1)_

> [!NOTE]
> 🐛 **1** bug fix · 🔧 **3** internal changes

### Fixed

1. 🐛 **A settings change made right before the plugin unloads is no longer lost.** Writes wait a quarter of a second so dragging a slider does not hit the disk on every pixel; unloading used to cancel the pending write without a word. Best effort, not a guarantee.

### Internal

2. 🔧 A guard for names declared as methods and called by nobody — that is the shape the bug above had: the function to finish the pending write existed from the start and was never called.
3. 🔧 The order-config loader no longer carries a fallback that could never run. Measured before removing: 2 759 calls, zero entries.
4. 🔧 A robustness probe for lines from the outside world — very long ones, emoji sequences, right-to-left text, a thousand tags: 468 cases, no crashes.

## 0.3.0

_2026-09-17 · [all changes since 0.2.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.2.0...0.3.0)_

> [!NOTE]
> ✨ **6** new things · 🎨 **3** changes you can see · 🐛 **25** bug fixes
>
> **New in this release**
> - **New: a jump can show you where the cursor landed**
> - **New: `Chosen Value text color`**
> - **New: the notes a line points at can learn about the note it became**
> - **New: a window tells you what changed**
> - **New: `Leave it, but not the name`**
> - **A cross clears what you typed**

### Added

1. ✨ **New: a jump can show you where the cursor landed.** `Visual → Jump highlight` draws a circle at the caret after a jump and shrinks it away; color, size, lifetime and a latency are yours to set. Off by default, and it never fires on typing.
2. ✨ **New: `Chosen Value text color`** gives the Value of a filled Field a color of its own in TagWheel, so a Field you already filled is told apart at a glance.
3. ✨ **New: the notes a line points at can learn about the note it became.** `Links in the notes you mention` writes a link back into every note the line links to by a Field Value; where it lands is yours to set.
4. ✨ **New: a window tells you what changed** after the plugin updates, once per version. A fresh install shows nothing.
5. ✨ **New: `Leave it, but not the name`** under Transform keeps the rest of your text and lets the link stand where the note name came from.

### Fixed

6. 🐛 **`Chosen Value text color` reaches the note, not just the preview.** The layer painting the picker over your line listed its colors by name, and the new one was not among them.
7. 🐛 **`Text size` and the Block opacities apply to Block values only.** The link `Inline to note` leaves behind is your text, not a value, and was drawn at the Block text size.
8. 🐛 **The Stripe no longer paints a Block you do not have.** It asks the Fields order whether values of that kind live there at all.
9. 🐛 **The link `Inline to note` leaves behind is your text, not a Field value.** The line used to keep no room for text, and the next Field command wrote an empty slot into it.
10. 🐛 **TagWheel no longer drops what it did not write** — the `#processed` mark, a tag of your own — when you step through the picker.
11. 🐛 **A Field the line does not currently show still owns its Value.** Commands and TagWheel now agree: the Value belongs to the Field, and the Fields order decides where it goes.
12. 🐛 **The `#processed` mark carries the Block styling of the Block it sits in**, by name rather than by kind: a tag of your own standing there still does not get it.
13. 🐛 **The `#processed` mark in the left Block no longer jumps in front of your line.** It used to be written before the list number or the heading mark, with no separator.
14. 🐛 **After `Inline to note` the cursor lands at the end of your text**, not at column zero.
15. 🐛 **A note is created in the vault root at last.** With `New notes folder` empty and the line in a note at the root, `Inline to note` created nothing at all.
16. 🐛 **A Field whose values the plugin writes itself is recognised on the line.** A `Random characters` Field carries a sample in its format, not a description of its values, so its value was found by nobody.
17. 🐛 **A task marker behind a list number no longer becomes the note's name.** `1. [!] report` used to create a note called `!`.
18. 🐛 **A template no longer outlives the folder it came from.** Change `Templates folder` and any template chosen outside it is cleared, in the Smart Rules too.
19. 🐛 **With no `Templates folder` set, a Smart Rule no longer offers every note in the vault** as a template.
20. 🐛 **A heading line gives the note its own words for a name**, not the whole line: values, element markers and separators stay out of the file name.
21. 🐛 **A heading takes its section along** — everything down to the next heading of the same or higher level — when the tree setting says to.
22. 🐛 **The heading you pressed on becomes a list line** once its section has moved out, and the words that became the note name leave the line.
23. 🐛 **A line carrying one separator is read the way the rest of the plugin reads it**: your words before it, the right Block after. Transform used to read it the other way round.
24. 🐛 **A value standing in the other Block is seen at last** — `Fields to keep` decides its fate, and it reaches the new note's properties.
25. 🐛 **A numbered list keeps its number out of the note**, as a bullet, a quote and a callout already did.
26. 🐛 **Asking TagWheel for an empty Block opens the other one** instead of drawing an empty bar over your line.
27. 🐛 **Values of the right Block no longer spill into your own words** when both separators are written the same way.
28. 🐛 **A Field of type link moves into its Block** when you press its command, the way a tag always did.
29. 🐛 **A smaller `Tags text size` no longer sinks the tag to the bottom of the line**, and neither does anything else standing in a Block.
30. 🐛 **The Stripe measures what it covers.** Its height used to be counted from the text of the line, so a smaller `Tags text size` made it fill the whole line.

### Changed

31. ✨ **A cross clears what you typed** in eight places, from both Transform folders to `Backup folder` and `Log file`.
32. 🎨 **`Quiet time between jumps` is now called `Latency between jumps`.** The old name still finds the row.
33. 🎨 **The scroller settings sit under a `Scroller` subheading** inside `TagWheel` instead of running on from the colors above them.
34. 🎨 **A subheading inside a group no longer floats between the rows** — it sits close to the rows it heads.

## 0.2.0

_2026-09-16 · [all changes since 0.1.0-beta.6](https://github.com/romkuznetsov/inline-overhaul/compare/0.1.0-beta.6...0.2.0)_

> [!NOTE]
> ✨ **4** new things · 🐛 **11** bug fixes · 🔧 **1** internal change
>
> **New in this release**
> - **New: `Values in the other Block`**
> - **New: `Active Field on opening`**
> - **New: the Fields table has two heights**
> - **New: `Smart Enter` adds a line instead of tearing the current one**

### Fixed

1. 🐛 **On an empty line the caret goes into the text slot, not into the list marker.** A right-Block Field on `- ` used to give `-|  :: 📅…`, so the first word you typed landed before the space.
2. 🐛 **A task stays a task.** A line starting with `- [ ] ` keeps its checkbox when you step a Field, even with no text on it yet. A checkbox that *is* a Field value still goes when that value does.
3. 🐛 **Any list marker survives, not only the hyphen.** `*`, `+`, `1.` and `1)` keep their marker instead of being replaced by a hyphen and pushed into the line as a value.
4. 🐛 **The empty text slot is there for every marker**, not only for the hyphen.
5. 🐛 **Your text of two digits stays text** — `- 12` after `Due` no longer moves the number into the value zone.
6. 🐛 **A heading line is a heading.** `##` is no longer read as a tag, and no list marker is put in front of the hashes.
7. 🐛 **One `Ctrl+Z` after the TagWheel panel brings back the line you started from.** The panel puts its bar beside your values instead of over them, so the document only ever gets an insertion.
8. 🐛 **The separator next to the bar shows on the side the rest of the line is on**, and on an empty line too.
9. 🐛 **Every tag bubble is drawn by the plugin**, so size and color settings reach the tags that have no color of their own.
10. 🐛 **The strip under a wrapped line stands on its own row** and no longer runs to the edge of the window.
11. 🐛 **Controls sit on one line with their description** — the description column gives way instead of pushing the control down.

### Added

12. ✨ **New: `Values in the other Block`** keeps the opposite Block visible while the TagWheel panel is open.
13. ✨ **New: `Active Field on opening`** — the panel opens on the first Field, the middle one, or one you name.
14. ✨ **New: the Fields table has two heights**, switched in its header.
15. ✨ **New: `Smart Enter` adds a line instead of tearing the current one**, and where the new line starts is a setting with three positions.

### Changed

16. 🔧 **The plugin no longer writes `generated_rules.md` into its own folder.** The engines take their rules straight from your settings, so the file had no readers and made your plugin folder sync for no reason. A file left from older versions is removed on the next start — but only if it is the plugin's own.

## 0.1.0-beta.6

_2026-09-11 · [all changes since 0.1.0-beta.5](https://github.com/romkuznetsov/inline-overhaul/compare/0.1.0-beta.5...0.1.0-beta.6)_

> [!NOTE]
> ✨ **1** new thing · 🔧 **1** internal change
>
> **New in this release**
> - **New: `FEATURES.md`**

1. ✨ **New: `FEATURES.md`** — a list of what the plugin can do, in words, kept honest by a guard that fails when a command or a panel area is missing from it.
2. 🔧 Otherwise internal: rules that were declared in two or three places at once became one each, 23 dead declarations went, and every silent failure in the engines either speaks now or says in place why it is silent.

## 0.1.0-beta.5

_2026-09-10 · [all changes since 0.1.0-beta.4](https://github.com/romkuznetsov/inline-overhaul/compare/0.1.0-beta.4...0.1.0-beta.5)_

> [!NOTE]
> 🐛 **6** bug fixes · 🚀 **1** speed-up

1. 🐛 **The commands are back, and so are five engines.** In the released build the only path to the plugin's own modules used a variable, and the bundler substitutes a module only for a literal path — so the plugin looked switched on and did nothing.
2. 🐛 **A checkbox is one character.** Brackets with a longer body are your text: `- [test-transform] test1 test2` no longer loses the words in brackets, and Transform no longer eats an explicit note name.
3. 🐛 **Transform takes the whole value of an emoji Field.** A Field written as `YYYY-MM-DD hh:mm` has a space inside its value, and the time used to stay behind on the line.
4. 🐛 **TagWheel keeps the right-hand side of your line.** A value that cannot be expressed as an offset from today is kept as it is instead of vanishing.
5. 🐛 **One `Ctrl+Z` brings the line back, not the panel.** Only the result of a panel session goes into the undo history now.
6. 🐛 **The link to a new note stands where its name came from** under `Keep the first words`, instead of being left in front of it.
7. 🚀 Faster and smaller in places: a dead 2 284-line editor left over from an old panel is gone, and so is the module bridge that read the vault at runtime.

## 0.1.0-beta.4

_2026-09-06 · [all changes since 0.1.0-beta.3](https://github.com/romkuznetsov/inline-overhaul/compare/0.1.0-beta.3...0.1.0-beta.4)_

> [!NOTE]
> ✨ **3** new things · 🎨 **3** changes you can see · 🐛 **3** bug fixes
>
> **New in this release**
> - **The settings panel can speak another language**
> - **`texts/default.js` is written by the plugin and always current**
> - **The windows the panel opens speak the chosen language too**

1. ✨ **The settings panel can speak another language.** `General → Language` picks it, and the words behind every visible line live in a plain text file inside the plugin folder; a line with no translation keeps its English wording.
2. ✨ **`texts/default.js` is written by the plugin and always current.** Copy it under a new name to start a language; that copy is yours and is never overwritten.
3. ✨ **The windows the panel opens speak the chosen language too**, including the lines they build as they go.
4. 🎨 **The text file reads in the order the panel does**: tab, its callout, group, setting, and the window that setting opens.
5. 🎨 **`Save a backup` explains itself**: the long paragraph moved into a tip, and the checkboxes got a heading of their own.
6. 🎨 `General → Language` sits above `General → Help`, and text in the plugin's own windows is sized for reading.
7. 🐛 **Restoring a backup no longer moves your backup folder.** The folder is an address in this vault, not a setting.
8. 🐛 **The restore window always says what it found about hotkeys**: the clashing commands by name, or that there are none.
9. 🐛 **Hotkey comparison reads `Mod` and the second way a key can be written.** `Mod` is Ctrl on Windows and Cmd on macOS, not letters.

Known limitations: the Fields editor and its neighbours, the guide note and the messages shown while you type stay English whatever language you pick.

## 0.1.0-beta.3

_2026-09-06 · [all changes since 0.1.0-beta.2](https://github.com/romkuznetsov/inline-overhaul/compare/0.1.0-beta.2...0.1.0-beta.3)_

> [!NOTE]
> ✨ **2** new things · 🎨 **1** change you can see · 🐛 **4** bug fixes
>
> **New in this release**
> - **`Save a backup` asks what to save**
> - **Restoring can free up keys other commands are holding**

1. ✨ **`Save a backup` asks what to save**: an optional comment, a checkbox per settings tab, and how much of your hotkeys to keep. Everything is picked by default.
2. ✨ **Restoring can free up keys other commands are holding** — a checkbox, off by default, with the clashing commands named one by one.
3. 🎨 **The plugin is now called `inlineOverhaul`.** Its id is unchanged, so every hotkey you have set keeps working; the guide note was renamed, and the old one still opens instead of a duplicate being made.
4. 🐛 **Restoring a partial backup leaves the tabs you did not save alone**, and the confirmation window lists both sides.
5. 🐛 **Restoring re-registers the plugin commands**, so hotkeys for Fields that came with the backup show up without a restart.
6. 🐛 **The generated rules file no longer reappears in the vault root** after restoring an older backup.
7. 🐛 **A Field added on an empty line leaves room for text**: `-  :: 📅…` instead of `- :: 📅…`, and the in-line cursor jump lands in that slot.

Known limitations: unchanged from 0.1.0-beta.2.

## 0.1.0-beta.2

_2026-09-06 · [all changes since 0.1.0-beta.1](https://github.com/romkuznetsov/inline-overhaul/compare/0.1.0-beta.1...0.1.0-beta.2)_

> [!NOTE]
> 🔧 **2** internal changes

1. 🔧 Released from the current code as a normal release with all three assets, so BRAT installs the plugin from one link.
2. 🔧 Releases are cut by tag from then on: CI builds from the tagged commit, runs the whole suite and attaches the files.

## 0.1.0-beta.1

_2026-08-08_

> [!NOTE]
> 🔧 **4** internal changes

1. 🔧 Added BRAT-ready bundled release assets and release regressions.
2. 🔧 Stabilized shared PKM, TagWheel, and Transform runtime paths for beta testing.
3. 🔧 Kept Transform explicit opt-in and disabled by default.
4. 🔧 Documented beta safety, installation, build, testing, and known limitations.

Known limitations: Flying button and visual styling are disabled; Obsidian manual beta cases remain open.
