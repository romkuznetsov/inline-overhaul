# Changelog

## Unreleased

Not published yet: `0.1.0-beta.4` is the newest release and it is broken — the
plugin loads without its commands. Everything below is fixed in the working
copy and waiting for a release.

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
