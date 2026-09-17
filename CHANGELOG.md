# Changelog

<!-- Сделанное между выпусками копится здесь; в коммите выпуска раздел
     переименовывается в номер версии. Правило — docs/VERSIONING.md. -->

## Unreleased

### Visual

- **`Chosen Value text color` now reaches the note, not just the preview.** The
  color you set was shown in the settings preview and never arrived in the
  editor: the layer that paints the picker over your line listed its colors by
  name and the new one was not among them.
- **`Text size` and the Block opacities now apply to Block values only.** After
  `Inline to note` the link the plugin writes in place of your text was drawn at
  the Block text size, though it is your text and not a value. A token counts as
  a Block value only where the Fields order says values of that kind live - the
  same rule the Block fill already follows.
- **`Quiet time between jumps` is now called `Latency between jumps`.** The old
  name still finds the row in settings search.

- **New: a jump can show you where the cursor landed.** Turn on `Highlight
  where you land` in `Visual → Jump highlight` and a coloured circle appears at
  the caret after a jump and shrinks away on its own, so you do not hunt for a
  thin blinking line on a screen you just moved across. Its color, size and how
  long it lasts are yours to set, and a latency stops it firing on every
  step while you hold the key down - only the jump you stop on is marked.
  `Use inside current line` extends it to `Move cursor left in line` and
  `Move cursor right in line`. Off by default, and it never fires on typing or
  the arrow keys. The preview beside the settings now pulses on its own, so the
  latency is something you can see rather than imagine.

- **The Block fill no longer paints a Block you do not have.** A band belongs to
  a Block, and it now asks the Fields order whether values of that kind live
  there at all. After `Inline to note` the link the plugin writes in place of
  your text sat in the left zone and was painted as a left Block value - on a
  setup whose left Block holds no Fields at all.

- **New: a Field that already has a Value can be told apart at a glance.** In
  `TagWheel`, a Field you are not standing on shows either its own name or the
  Value you gave it, and both were painted the same. `Chosen Value text color`,
  under `Active Field text color`, gives the Value a color of its own. Empty
  means it takes `Non-active Field text color`, as before. The preview beside
  the settings now shows one filled Field, so the control has something to work
  on.
- **The scroller settings now sit under a `Scroller` subheading** inside
  `TagWheel`, instead of running on from the colors above them. Nothing moved
  out of the group and nothing changed but the heading.
- **A subheading inside a group no longer floats between the rows.** It used to
  stand 32 points below the row above it and 16 above the row below, which read
  as belonging to neither; it now sits close to the rows it heads.

### Tags & PKM

- **The link `Inline to note` leaves behind is your text, not a Field value.** A
  link counts as a Field value only when some Field lists it as one; the link
  the plugin writes in place of the text you moved out is listed nowhere. Before
  this, the line kept no room for text at all and the next Field command wrote
  an empty slot into it - `- [[note]] ::  :: #tag`. Commands and TagWheel read
  such a line the same way.
- **TagWheel no longer drops what it did not write.** It rebuilds the right
  Block from what you picked, and anything else standing there - the
  `#processed` mark from `Inline to note`, a tag of your own - disappeared on
  the first step through the picker, while the same Field command kept it.


- **A Field the line does not currently show still owns its Value.** A Field can
  be set to appear only where the line already carries something else; a Value
  written before that condition was met used to sit wherever it was when you
  pressed a command, and move to its Field's Block when you opened `TagWheel`.
  Both now do the same thing: the Value belongs to the Field, and the Fields
  order decides where it goes. A Field you switched off, or took off the wheel,
  is still left alone by both.

### Inline to note

- **New: the notes a line points at can learn about the note it became.** Turn
  on `Links in the notes you mention` and every note this line links to - by a
  Field Value, not by a link inside your own sentence - gets a link to the new
  note. A note that does not exist yet is created empty and gets the link; a
  note that already links to the new one is left alone. Where the link lands is
  yours to set: at the top, at the end, or under a heading you name.
- **A note now gets created in the vault root.** With `New notes folder` empty
  and the line sitting in a note at the root, `Inline to note` created nothing
  at all - it tried to make a folder named after the note, tripped over it, and
  gave up after a thousand tries.
- **A Field whose values the plugin writes itself is recognised on the line.**
  A Field with the `Random characters` command carries a sample in its format
  (`111111`), not a description of its values - so `🤣lYg8U6` was found by
  nobody: it neither left the line when `Fields to keep` said it should, nor
  reached the new note's properties. The pattern now comes from the same place
  the value is written, and it knows the Field's command.
- **A task marker behind a list number no longer becomes the note's name.**
  `1. [!] report` used to create a note called `!`; a callout marker did the
  same (`> [!Guide] …` became `!Guide`). The start of a line is Obsidian's
  markup, and the plugin now reads it the same way everywhere. A name you write
  in brackets yourself is still read, behind any of those.
- **A template you picked no longer outlives the folder it came from.** Change
  `Templates folder` and any template chosen outside the new folder is cleared,
  in the Smart Rules too - a rule used to keep the full path and fail with
  `template not found: old-folder/template.md`. Pick it again in the new folder.
- **With no `Templates folder` set, a Smart Rule no longer offers every note in
  the vault** as a template. Both lists now say the same thing.
- **A heading line gives the note its own words for a name**, not the whole
  line: Field values, element markers and separators stay out of the file name.
- **A heading takes its section along** - everything down to the next heading of
  the same or higher level - when `Sub-lines (tree) behavior` is set to take
  them along. It used to take nothing: what belongs to a line was worked out
  from indentation, and a section has none.
- **The heading you pressed on becomes a list line** once its section has moved
  out.
- **The words that became the note name now leave the line**, and the link takes
  their place - a heading used to keep its own text and grow a link beside it.
- **A line carrying one separator is read the way the rest of the plugin reads
  it**: the words before it are yours, the values after it are the right Block.
  Until now Transform read it the other way round - the new note got no
  properties, `Fields to keep` decided nothing, and the values themselves became
  the note's name.
- **A value standing in the other Block is seen at last.** `Fields to keep`
  decides its fate, and it reaches the new note's properties; until now only a
  value standing in the Block its Field belongs to was noticed at all.
- **A numbered list keeps its number out of the note.** `1. ` is markup, like a
  bullet; the same goes for a quote and a callout.

### TagWheel

- **Asking for an empty Block opens the other one.** Moving every Field into the
  right Block and pressing `Open TagWheel on the left` used to draw an empty bar
  over your line - and show your own text twice while the panel was open.

### Settings

- **A cross clears what you typed** in eight places: both Transform folders,
  `Type name of header`, `Text of the line above`, `Date format`, `Mark
  transformed line`, `Backup folder` and `Log file`. Separators and the naming
  brackets have none: empty is not a value they can take.

### Tag appearance

- **A smaller `Tags text size` no longer sinks the tag to the bottom of the
  line.** The bubble now sits on the middle of the line instead of its baseline.
- **And so does everything else standing in a Block** - a link, an
  emoji-element: they keep the same distance to the top and the bottom of the
  `tags-block-fill` stripe as the bubble does.
- **The stripe itself now measures what it covers.** Its height used to be
  counted from the text of the line - your own words, in the normal size - so a
  smaller `Tags text size` left the height slider nothing to divide and the
  stripe filled the whole line. Its vertical came from the row for the same
  reason. Both now come from the values the stripe is drawn behind.

### Line behaviour

- **Values of the right Block no longer spill into your own words.** With both
  separators written the same way, a line carrying one separator was read as
  "left Block, then text" by one half of the plugin and as "text, then right
  Block" by the other; pressing an element command tore the Block apart.
- **A Field of type link now moves into its Block** when you press its command,
  the way a tag always did.

### On update

- **A window tells you what changed.** After the plugin updates, the section of
  this file for the new version opens once, and only once per version. A fresh
  install shows nothing: there is no previous version to compare with.

## 0.2.0

The first release outside the beta line. It carries everything published as
`0.1.0-beta.7` plus the work of 2026-09-16; if you ran a beta, install this over
it.

### Where the caret lands

- **On an empty line the caret goes into the text slot, not into the list
  marker.** Running a right-Block Field on `- ` gave `-|  :: 📅…`, so the first
  word you typed landed before the space; it now gives `- | :: 📅…` and you can
  type straight away. The same holds for a task line (`- [ ] `), a numbered one
  and a quote.

### Your line keeps what you typed

- **A task stays a task.** A line that starts with `- [ ] ` keeps its checkbox
  when you step a Field, even when there is no text on it yet: `- [ ] ` used to
  come back as `-  :: #/1`. The same holds when a step empties the last value
  and the line folds back to its start. A checkbox that *is* a Field value
  (`[N]` for `#note`, say) still goes when that value does.
- **Any list marker survives, not only the hyphen.** `* text`, `+ text`,
  `1. text` and `1) text` keep their marker when you step an element Field; the
  marker used to be replaced by a hyphen and pushed into the line as if it were
  a value. `1) text` is now read as a list at all — Obsidian reads it as one.
- **The empty text slot is there for every marker.** Two spaces between the
  start of the line and the separator are the place your word will go; lines
  starting with `*`, `+` or a number had no such place.
- **Your text of two digits stays text.** `- 12` after `Due` no longer moves the
  number into the value zone.
- **A heading line is a heading.** `##` is no longer read as a tag, the strip
  sits on the written text rather than on the indent, and no list marker is put
  in front of the hashes.

### TagWheel

- **One `Ctrl+Z` after the panel brings back the line you started from.** The
  panel puts its bar *beside* your values instead of over them, so the document
  only ever gets an insertion, and what the bar covers is hidden by styling.
- **Values in the other Block can stay visible** while the panel is open —
  `Values in the other Block`.
- **The panel opens on the Field you choose**: the first, the middle or one you
  name — `Active Field on opening`.
- **The separator next to the bar shows on the side the rest of the line is on**,
  and on an empty line too.

### Appearance

- **Every tag bubble is drawn by the plugin**, so size and colour settings reach
  the tags that have no colour of their own instead of stopping at the ones that
  do.
- **The strip under a wrapped line stands on its own row** and no longer runs to
  the edge of the window.
- **Controls sit on one line with their description** — the description column
  gives way instead of pushing the control onto the next row.
- **The Fields table has two heights**, switched in its header.

### Keyboard

- **`Smart Enter` adds a line instead of tearing the current one**, and where
  the new line starts is a setting with three positions.

### Under the hood, and you may notice one thing

- **The plugin no longer writes `generated_rules.md` into its own folder.** The
  engines take their rules straight from your settings, so the file had no
  readers left; it used to be rewritten on every start of Obsidian on every
  device, which made your plugin folder sync for no reason. The file left from
  older versions is removed on the next start — but only if it is the plugin's
  own: a note of yours at the same path is left alone.

## 0.1.0-beta.6

- **`FEATURES.md`** — a list of what the plugin can do, in words, kept honest by
  a guard that fails when a command or a panel area is missing from it.
- Otherwise internal: the same rule stopped being declared in two or three
  places at once (where a value ends, where the active editor comes from, how a
  message is built), 23 dead declarations went, and every silent failure in the
  engines either speaks now or says in place why it is silent.

## 0.1.0-beta.5

- **The commands are back, and so are five engines.** In the released build the
  only working path to the plugin's own modules used a variable, and the bundler
  substitutes a module only for a literal path. Navigation, Tags & PKM, `Ctrl+A`
  by your own rules, Smart Delete and the priority strip were all dead in that
  build, and the plugin looked switched on and did nothing.
- **A checkbox is one character.** Brackets with a longer body are your text and
  stay on the line: `- [test-transform] test1 test2` no longer loses the words
  in brackets, and `Transform` no longer eats an explicit note name.
- **`Transform` takes the whole value of an emoji Field.** A Field written as
  `YYYY-MM-DD hh:mm` has a space inside its value; the time used to stay behind
  on the line and the note property arrived without it.
- **TagWheel keeps the right-hand side of your line.** A value that cannot be
  expressed as an offset from today — a time already in the past, say — is kept
  as it is instead of vanishing.
- **One `Ctrl+Z` brings the line back, not the panel.** While the panel is open
  the line is rewritten on every keystroke, and each rewrite used to be its own
  undo step. Only the result goes into the history now.
- **The link to a new note stands where its name came from.** Under
  `Keep the first words`, the words that became the note name are replaced by
  the link rather than left in front of it; `Words to keep` counts what is left.
  `Leave it` is unchanged and keeps every word, and a new choice sits between
  the two: **`Leave it, but not the name`** keeps the rest of your text and lets
  the link stand where the name came from. The swap needs the link: with it off,
  `Keep the first words` counts the first words of your text as it always did.
- Faster and smaller in places: a dead 2284-line editor left over from an old
  panel is gone, and so is the module bridge that read the vault at runtime.

## 0.1.0-beta.4

- **The settings panel can speak another language.** `General → Language` picks it, and the words behind every visible line live in a plain text file inside the plugin folder. Switching takes effect at once, and a line with no translation keeps its English wording rather than showing a blank.
- **`texts/default.js` is written by the plugin and always current.** A new setting, a new window and a reworded line all show up in it on their own. Copy it under a new name to start a language; that copy is yours and is never overwritten.
- **The windows the panel opens speak the chosen language too** — `Save a backup`, `Restore a backup` and `Delete all your settings`, including the lines they build as they go.
- **The file reads in the order the panel does**: tab, its callout, group, setting, and the window that setting opens.
- `General → Language` sits above `General → Help`.
- **Restoring a backup no longer moves your backup folder.** The folder is an address in this vault, not a setting, so a backup taken elsewhere leaves it alone — and so does `Start over`.
- **The restore window always says what it found about hotkeys**: the clashing commands by name, or that there are none, or that a vault-wide backup sets other commands' keys itself.
- **Hotkey comparison now reads `Mod` and the second way a key can be written.** `Mod` is Ctrl on Windows and Cmd on macOS, not letters; a binding recorded through `code` used to be dropped on the way in.
- **`Save a backup` explains itself**: the long paragraph moved into a tip, and the checkboxes got a heading of their own. Every heading in that window has a `?`, and they follow `Show tips`.
- Text in the plugin's own windows is sized for reading, and the line about restarting Obsidian is bold.

Known limitations: the Fields editor and its neighbours, the guide note and the messages shown while you type stay English whatever language you pick.

## 0.1.0-beta.3

- **The plugin is now called `inlineOverhaul`.** Its id is unchanged, so every hotkey you have set keeps working. The backup folder default moved to `inlineOverhaul/Backups` for fresh installs only; the guide note was renamed, and the old one still opens instead of a duplicate being made.
- **`Save a backup` now asks what to save**: an optional comment, a checkbox per settings tab, and how much of your hotkeys to keep. Everything is picked by default, so pressing the button straight away does what it always did.
- **Restoring a partial backup leaves the tabs you did not save alone**, and the confirmation window lists both sides: what comes back and what stays.
- **Restoring can free up keys other commands are holding** — a checkbox, off by default, with the clashing commands named one by one.
- **Restoring re-registers the plugin commands**, so hotkeys for Fields that came with the backup show up on Obsidian’s `Hotkeys` screen without a restart, and a window afterwards says what came back.
- **The generated rules file no longer reappears in the vault root** after restoring a backup taken before it moved into the plugin folder.
- **A Field added on an empty line now leaves room for text**: `-  :: 📅…` instead of `- :: 📅…`.
- **The in-line cursor jump lands in that empty text slot** instead of behind the separator. Field markers are now read from your Fields, not only from the four named date rules.

Known limitations: unchanged from 0.1.0-beta.2.

## 0.1.0-beta.2

- Released from the current code as a normal release with all three assets, so BRAT installs the plugin from one link.
- Releases are cut by tag from then on: CI builds from the tagged commit, runs the whole suite and attaches the files.

## 0.1.0-beta.1

- Added BRAT-ready bundled release assets and release regressions.
- Stabilized shared PKM, TagWheel, and Transform runtime paths for beta testing.
- Kept Transform explicit opt-in and disabled by default.
- Documented beta safety, installation, build, testing, and known limitations.

Known limitations: Flying button and visual styling are disabled; Obsidian manual beta cases remain open.
