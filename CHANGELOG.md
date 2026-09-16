# Changelog

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
