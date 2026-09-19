# Changelog

<!-- Сделанное между выпусками копится здесь; в коммите выпуска раздел
     переименовывается в номер версии. Правило — docs/VERSIONING.md.

     Форма — его слово 2026-09-19: пункт нумерованный, в одну строку и
     лаконичный. Нумерация нужна, чтобы было видно, сколько пунктов изменилось;
     одна строка — потому что Obsidian показывает одиночный перенос строки
     переносом, и свёрстанный абзац приезжает человеку лестницей. Держит форму
     `tests/regression/release_notes_tests.js`. -->

## Unreleased

### Added

1. **Block text size is set for each side on its own.** `Text size` under `Inline appearance` became `Left Block text size` and `Right Block text size`; whatever you had is written into both on first run.
2. **New: `Stripe direction`** — which Block gets the Stripe behind it: `Left`, `Right` or `Both`. `Both` by default, so nothing changes until you pick a side.
3. **New: a `Changelog` button** in `General → Help` opens this file on GitHub, every release, newest first.
4. **New: `Autosave`** under `Advanced → Backup` writes a copy of your settings whenever the file differs from the last autosave, checked at every start of Obsidian, and says so. Off by default, ten newest kept, and each copy lists what changed. The tab you left open is not a setting and never triggers a copy.

### Changed

5. **Settings edited outside Obsidian are picked up even when Obsidian says nothing.** Copying a `data.json` in from another vault keeps the source's timestamp, and Obsidian announces only files newer than the plugin's last write — so the plugin now looks at the file before writing its own settings, and the disk wins.
6. **The settings panel is laid out in sections.** `Inline appearance` has `Line view` and `Tag view`; the `Keyboard` groups `Expanded 'Ctrl+A'`, `Smart Delete\Backspace` and `Smart Enter` became sections of one group, `Global hotkeys`. Nothing moved out of reach.
7. **The window title in every dialog has a size of its own** instead of whatever the theme makes of an `h4` — in some themes that was smaller than the headings underneath it. Eight dialogs.
8. **The "what changed" window reads properly.** It renders its Markdown, shows every release you skipped rather than the newest one alone (up to five, newest first), and carries a link to the full changelog.
9. **Five Stripe rows are renamed:** `Color the Block with Stripe`, `Stripe color`, `Stripe opacity`, `Stripe height`, `Stripe width`. The old names still find them in the settings search.
10. **The live preview of a jump highlight no longer promises a press.** The circle has run on a timer since 0.3.1.
11. **A wiki link in the `Inline appearance` preview follows the Block text size**, as everything else in that preview already did.
12. **This file reads as a numbered list**, one line per change, so you can see at a glance how many things a release touched.
13. The plugin author is `Roman Kuznetsov`.

### Internal

14. **The parsed cache of the old TagWheel config note is removed from your settings file.** The note itself went in 0.2.0; its cache stayed and looked like settings — editing it by hand changed nothing, because nothing reads it.

15. **The repository root holds no plugin file.** `main.js`, `navigation_runtime.js`, `pkm_runtime_v2.js`, `pkm_v2/` and `styles.css` live under `src/`, `build/` under `tools/`, `media/` and `showcase.md` under `docs/`; nine old documents moved to `docs/archive/`. Nothing was deleted, and the bundle differs by 28 lines out of 33 000 — all of them the bundler's own labels.

## 0.3.2

### Changed

1. **Settings changed outside Obsidian are picked up instead of being overwritten.** The plugin re-reads the file, redraws the panel, rebuilds the decorations in open notes and says so once. The disk wins, and your own edit in the panel stays silent.
2. **The settings panel opens on the tab you left it on**, and switching tabs does not take up an undo step.

### Performance

3. **TagWheel no longer stalls on a very long line.** Opening the panel on a line of 20 000 characters took about 1.3 seconds and now takes about 50 milliseconds; on an ordinary line the result is identical, checked on 4 737 real pairs.

### Internal

4. Row drag-and-drop is declared once instead of twice, with the one genuine difference as a parameter.
5. Coverage is measured on both roads — the editor layer and the TagWheel session run in a browser, and their coverage was not collected at all.
6. Type checking is switched on for four core files; all thirty errors it found were missing annotations, not defects.
7. The document read in full before every session is a quarter shorter: three growing tables moved to files of their own.

## 0.3.1

### Fixed

1. **A settings change made right before the plugin unloads is no longer lost.** Writes wait a quarter of a second so dragging a slider does not hit the disk on every pixel; unloading used to cancel the pending write without a word. Best effort, not a guarantee.

### Internal

2. A guard for names declared as methods and called by nobody — that is the shape the bug above had: the function to finish the pending write existed from the start and was never called.
3. The order-config loader no longer carries a fallback that could never run. Measured before removing: 2 759 calls, zero entries.
4. A robustness probe for lines from the outside world — very long ones, emoji sequences, right-to-left text, a thousand tags: 468 cases, no crashes.

## 0.3.0

### Added

1. **New: a jump can show you where the cursor landed.** `Visual → Jump highlight` draws a circle at the caret after a jump and shrinks it away; color, size, lifetime and a latency are yours to set. Off by default, and it never fires on typing.
2. **New: `Chosen Value text color`** gives the Value of a filled Field a color of its own in TagWheel, so a Field you already filled is told apart at a glance.
3. **New: the notes a line points at can learn about the note it became.** `Links in the notes you mention` writes a link back into every note the line links to by a Field Value; where it lands is yours to set.
4. **New: a window tells you what changed** after the plugin updates, once per version. A fresh install shows nothing.
5. **New: `Leave it, but not the name`** under Transform keeps the rest of your text and lets the link stand where the note name came from.

### Fixed

6. **`Chosen Value text color` reaches the note, not just the preview.** The layer painting the picker over your line listed its colors by name, and the new one was not among them.
7. **`Text size` and the Block opacities apply to Block values only.** The link `Inline to note` leaves behind is your text, not a value, and was drawn at the Block text size.
8. **The Stripe no longer paints a Block you do not have.** It asks the Fields order whether values of that kind live there at all.
9. **The link `Inline to note` leaves behind is your text, not a Field value.** The line used to keep no room for text, and the next Field command wrote an empty slot into it.
10. **TagWheel no longer drops what it did not write** — the `#processed` mark, a tag of your own — when you step through the picker.
11. **A Field the line does not currently show still owns its Value.** Commands and TagWheel now agree: the Value belongs to the Field, and the Fields order decides where it goes.
12. **The `#processed` mark carries the Block styling of the Block it sits in**, by name rather than by kind: a tag of your own standing there still does not get it.
13. **The `#processed` mark in the left Block no longer jumps in front of your line.** It used to be written before the list number or the heading mark, with no separator.
14. **After `Inline to note` the cursor lands at the end of your text**, not at column zero.
15. **A note is created in the vault root at last.** With `New notes folder` empty and the line in a note at the root, `Inline to note` created nothing at all.
16. **A Field whose values the plugin writes itself is recognised on the line.** A `Random characters` Field carries a sample in its format, not a description of its values, so its value was found by nobody.
17. **A task marker behind a list number no longer becomes the note's name.** `1. [!] report` used to create a note called `!`.
18. **A template no longer outlives the folder it came from.** Change `Templates folder` and any template chosen outside it is cleared, in the Smart Rules too.
19. **With no `Templates folder` set, a Smart Rule no longer offers every note in the vault** as a template.
20. **A heading line gives the note its own words for a name**, not the whole line: values, element markers and separators stay out of the file name.
21. **A heading takes its section along** — everything down to the next heading of the same or higher level — when the tree setting says to.
22. **The heading you pressed on becomes a list line** once its section has moved out, and the words that became the note name leave the line.
23. **A line carrying one separator is read the way the rest of the plugin reads it**: your words before it, the right Block after. Transform used to read it the other way round.
24. **A value standing in the other Block is seen at last** — `Fields to keep` decides its fate, and it reaches the new note's properties.
25. **A numbered list keeps its number out of the note**, as a bullet, a quote and a callout already did.
26. **Asking TagWheel for an empty Block opens the other one** instead of drawing an empty bar over your line.
27. **Values of the right Block no longer spill into your own words** when both separators are written the same way.
28. **A Field of type link moves into its Block** when you press its command, the way a tag always did.
29. **A smaller `Tags text size` no longer sinks the tag to the bottom of the line**, and neither does anything else standing in a Block.
30. **The Stripe measures what it covers.** Its height used to be counted from the text of the line, so a smaller `Tags text size` made it fill the whole line.

### Changed

31. **`Quiet time between jumps` is now called `Latency between jumps`.** The old name still finds the row.
32. **The scroller settings sit under a `Scroller` subheading** inside `TagWheel` instead of running on from the colors above them.
33. **A subheading inside a group no longer floats between the rows** — it sits close to the rows it heads.
34. **A cross clears what you typed** in eight places, from both Transform folders to `Backup folder` and `Log file`.

## 0.2.0

The first release outside the beta line. It carries everything published as `0.1.0-beta.7` plus the work of 2026-09-16; if you ran a beta, install this over it.

### Fixed

1. **On an empty line the caret goes into the text slot, not into the list marker.** A right-Block Field on `- ` used to give `-|  :: 📅…`, so the first word you typed landed before the space.
2. **A task stays a task.** A line starting with `- [ ] ` keeps its checkbox when you step a Field, even with no text on it yet. A checkbox that *is* a Field value still goes when that value does.
3. **Any list marker survives, not only the hyphen.** `*`, `+`, `1.` and `1)` keep their marker instead of being replaced by a hyphen and pushed into the line as a value.
4. **The empty text slot is there for every marker**, not only for the hyphen.
5. **Your text of two digits stays text** — `- 12` after `Due` no longer moves the number into the value zone.
6. **A heading line is a heading.** `##` is no longer read as a tag, and no list marker is put in front of the hashes.
7. **One `Ctrl+Z` after the TagWheel panel brings back the line you started from.** The panel puts its bar beside your values instead of over them, so the document only ever gets an insertion.
8. **The separator next to the bar shows on the side the rest of the line is on**, and on an empty line too.
9. **Every tag bubble is drawn by the plugin**, so size and color settings reach the tags that have no color of their own.
10. **The strip under a wrapped line stands on its own row** and no longer runs to the edge of the window.
11. **Controls sit on one line with their description** — the description column gives way instead of pushing the control down.

### Added

12. **New: `Values in the other Block`** keeps the opposite Block visible while the TagWheel panel is open.
13. **New: `Active Field on opening`** — the panel opens on the first Field, the middle one, or one you name.
14. **New: the Fields table has two heights**, switched in its header.
15. **New: `Smart Enter` adds a line instead of tearing the current one**, and where the new line starts is a setting with three positions.

### Changed

16. **The plugin no longer writes `generated_rules.md` into its own folder.** The engines take their rules straight from your settings, so the file had no readers and made your plugin folder sync for no reason. A file left from older versions is removed on the next start — but only if it is the plugin's own.

## 0.1.0-beta.6

1. **New: `FEATURES.md`** — a list of what the plugin can do, in words, kept honest by a guard that fails when a command or a panel area is missing from it.
2. Otherwise internal: rules that were declared in two or three places at once became one each, 23 dead declarations went, and every silent failure in the engines either speaks now or says in place why it is silent.

## 0.1.0-beta.5

1. **The commands are back, and so are five engines.** In the released build the only path to the plugin's own modules used a variable, and the bundler substitutes a module only for a literal path — so the plugin looked switched on and did nothing.
2. **A checkbox is one character.** Brackets with a longer body are your text: `- [test-transform] test1 test2` no longer loses the words in brackets, and Transform no longer eats an explicit note name.
3. **Transform takes the whole value of an emoji Field.** A Field written as `YYYY-MM-DD hh:mm` has a space inside its value, and the time used to stay behind on the line.
4. **TagWheel keeps the right-hand side of your line.** A value that cannot be expressed as an offset from today is kept as it is instead of vanishing.
5. **One `Ctrl+Z` brings the line back, not the panel.** Only the result of a panel session goes into the undo history now.
6. **The link to a new note stands where its name came from** under `Keep the first words`, instead of being left in front of it.
7. Faster and smaller in places: a dead 2 284-line editor left over from an old panel is gone, and so is the module bridge that read the vault at runtime.

## 0.1.0-beta.4

1. **The settings panel can speak another language.** `General → Language` picks it, and the words behind every visible line live in a plain text file inside the plugin folder; a line with no translation keeps its English wording.
2. **`texts/default.js` is written by the plugin and always current.** Copy it under a new name to start a language; that copy is yours and is never overwritten.
3. **The windows the panel opens speak the chosen language too**, including the lines they build as they go.
4. **The text file reads in the order the panel does**: tab, its callout, group, setting, and the window that setting opens.
5. **Restoring a backup no longer moves your backup folder.** The folder is an address in this vault, not a setting.
6. **The restore window always says what it found about hotkeys**: the clashing commands by name, or that there are none.
7. **Hotkey comparison reads `Mod` and the second way a key can be written.** `Mod` is Ctrl on Windows and Cmd on macOS, not letters.
8. **`Save a backup` explains itself**: the long paragraph moved into a tip, and the checkboxes got a heading of their own.
9. `General → Language` sits above `General → Help`, and text in the plugin's own windows is sized for reading.

Known limitations: the Fields editor and its neighbours, the guide note and the messages shown while you type stay English whatever language you pick.

## 0.1.0-beta.3

1. **The plugin is now called `inlineOverhaul`.** Its id is unchanged, so every hotkey you have set keeps working; the guide note was renamed, and the old one still opens instead of a duplicate being made.
2. **`Save a backup` asks what to save**: an optional comment, a checkbox per settings tab, and how much of your hotkeys to keep. Everything is picked by default.
3. **Restoring a partial backup leaves the tabs you did not save alone**, and the confirmation window lists both sides.
4. **Restoring can free up keys other commands are holding** — a checkbox, off by default, with the clashing commands named one by one.
5. **Restoring re-registers the plugin commands**, so hotkeys for Fields that came with the backup show up without a restart.
6. **The generated rules file no longer reappears in the vault root** after restoring an older backup.
7. **A Field added on an empty line leaves room for text**: `-  :: 📅…` instead of `- :: 📅…`, and the in-line cursor jump lands in that slot.

Known limitations: unchanged from 0.1.0-beta.2.

## 0.1.0-beta.2

1. Released from the current code as a normal release with all three assets, so BRAT installs the plugin from one link.
2. Releases are cut by tag from then on: CI builds from the tagged commit, runs the whole suite and attaches the files.

## 0.1.0-beta.1

1. Added BRAT-ready bundled release assets and release regressions.
2. Stabilized shared PKM, TagWheel, and Transform runtime paths for beta testing.
3. Kept Transform explicit opt-in and disabled by default.
4. Documented beta safety, installation, build, testing, and known limitations.

Known limitations: Flying button and visual styling are disabled; Obsidian manual beta cases remain open.
