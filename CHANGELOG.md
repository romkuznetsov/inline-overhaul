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

## 0.6.0

_2026-09-21 · [all changes since 0.5.1](https://github.com/romkuznetsov/inline-overhaul/compare/0.5.1...0.6.0)_

> [!NOTE]
> Five new controls and a key that learns about lists. `Smart paste` counts a pasted numbered list from one; a link Value can be coloured in two halves; the picker and its scroller can print a Value the way you named it rather than the way it is written; and every Field now lists its own commands with the keys they carry. Two things moved: a tag is drawn the size Obsidian draws it, so the editor and reading mode agree at last, and the picker's opening Field sits with the rest of the picker instead of in a heading of its own.

1. ✨ **The scroller can label Values the way you print them.** `Visual → tagWheel → Scroller Value names` chooses between the Value as it is written in the line, the custom text you gave it in `Color your tags`, or both at once — so the box shows `🎯`, `#todo`, or `🎯 #todo`. Where no custom text is set, the written Value is shown, so a Value never goes blank.
2. 🐛 **A two-digit year is a year again — from the tagWheel too.** A Field whose `Value format` is `yy-mm-dd` wrote the letters `yy` into the line and then failed to recognise its own value. `YY` is now a token like `YYYY`, and the picker writes it the same way the commands do.
3. 🐛 **The tagWheel no longer draws a bubble over its own markup.** On a fresh install, where none of the panel colors had been set, the picker drawn over your line got a Value bubble on top of it.
4. 🎨 **The README links to the showcase instead of embedding recordings.** The animations stay in [`docs/SHOWCASE.md`](docs/SHOWCASE.md), and the page above them loads at once.
5. 🐛 **The tagWheel keeps the words you wrote before your Fields.** A link or a plain word standing in the left Block — anything the plugin does not recognise as a Value — disappeared from the line as soon as you picked a Value there. The commands always kept it; the picker now keeps it too.
6. 🐛 **No `====` around the picker on the right.** The strip is wrapped in a highlight so it gets a fill, and Obsidian shows the raw `==` whenever the caret sits inside one — which is exactly where the caret landed for the right Block. It now rests outside the strip, on an empty line as well, so both sides look the same.
7. ✨ **The picker can label a chosen Value the way you print it.** `Visual → tagWheel → tagWheel Value names` chooses between the Value as it is written, the custom text you gave it in `Color your tags`, or both at once. Where no custom text is set, the written Value is shown, so a Field never goes blank.
8. 🎨 **Four commands read the way they work.** `Jump back` and `Jump next` are now `Jump up` and `Jump down`; the two that open the picker are now `tagWheel Left` and `tagWheel Right`. The picker is written `tagWheel` everywhere you see it, the way `inlineOverhaul` is. Names only — the command identifiers are the same, so your hotkeys stay put.
9. ✨ **Every Field lists its own commands, with the keys they are on.** The right-hand column of `Tags & PKM → Fields` ends with `Commands`: the Field's own `next` and `previous`, its child Field's pair, and the key each one carries. Press a key cell and Obsidian's `Hotkeys` screen opens at that command. Rename a Field and the list follows at once.
10. ✨ **The sections of that column fold.** `Values`, `Behavior`, `YAML property` and `Commands` each carry the same triangle the settings headings do, and each remembers whether you left it open.
11. 🐛 **A word of yours no longer sits among the Values.** `Importance next` on `- [[a note]] :: your text` left the link where it was; now it moves into your text, the way the picker has always moved it: `- #high :: [[a note]] your text`. Any word the plugin does not recognise as a Value is yours, and it belongs on your side of the Separator.
12. 🎨 **A tag is drawn the size Obsidian draws it.** In the editor a tag used to take the size of the text beside it, which made it larger than the same tag in reading mode. It now takes the size your theme gives a tag, so both modes agree. Inside a Block it still sits centred on the line; in your own text it sits on the baseline, the way a tag does everywhere else.
13. ✨ **New: `Smart paste`.** A numbered list you paste is counted from one instead of carrying the numbers it had where you cut it — unless it lands under a list you already have, and then that list's count carries on. Pasting `1. text` into a line that already starts with a number drops the pasted marker: `2. text`, not `2. 1. text`. Off by default.
14. 🎨 **The picker's opening Field moved in with the rest of it.** `Visual → tagWheel opening` was a heading of its own; its three settings now stand at the foot of `Visual → tagWheel` under a subheading of the same name, the way the scroller settings stand under `Scroller`. Nothing changed but where they are.
15. ✨ **A link Value can be coloured in two halves.** `Visual → Link view` adds `Link target color` and `Link brackets color`: the name inside `[[the note name]]` and the brackets around it. Values of a link Field only — links you typed yourself are untouched. Obsidian hides the brackets unless your cursor is on that line.
16. 🎨 **One label, one answer.** `Tags & PKM → Cursor after an action` offered `End of your text (recommended) (default)` — the panel's own mark for the standard choice, and mine for the same thing, read one after the other. Mine is gone; the row's tip still says which one you usually want.

## 0.5.1

_2026-09-20 · [all changes since 0.5.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.5.0...0.5.1)_

> [!NOTE]
> Nothing changed inside the plugin: this release is about what you read. The README is a landing page now — the mark, the badges and a recording of the plugin at work before any prose — while the walk through the settings panel moved into a reference of its own, and a new tutorial takes you from install to a working line in about fifteen minutes. Every document written for you is named in capitals from this release on, so a link you saved to a lower-case name needs updating.

1. ✨ **New: a tutorial** — [`docs/TUTORIAL.md`](docs/TUTORIAL.md) walks from install to a working line in about fifteen minutes, one path and no choices to make.
2. ✨ **New: a settings reference** — [`docs/SETTINGS.md`](docs/SETTINGS.md) lists every control of the panel, tab by tab, in the panel's own order, with the value each one starts at.
3. ✨ **New: `CONTRIBUTING.md`, `SECURITY.md`, and issue and pull request templates** — what makes a bug report actionable, and how to report a security problem privately instead of in a public issue.
4. 🎨 **The README is a landing page.** The wordmark, four badges and a recording of the plugin at work come before any prose; the tab-by-tab walk through the settings panel it used to carry moved into the settings reference.
5. 🎨 **`FEATURES.md` reads as a list again**: the opening pitch moved to the README, and what is left is what the plugin does, without adjectives.
6. 🎨 **This changelog carries the release date** under every version heading, and a link to the full comparison between that release and the one before it.
7. 🐛 **The command id map is in English**, and it no longer says these commands dropped the area from their names: since `0.5.0` they carry it again, and the map said the opposite.
8. 🐛 **The guide no longer promises a rules note in your vault.** The rules the engines work from are built from your settings as the plugin loads, and the note itself was removed several releases ago.
9. 🎨 **Every document written for you is named in capitals**, the way `README.md` always was: `INSTRUCTIONS.md`, `docs/TUTORIAL.md`, `docs/SETTINGS.md`, `docs/SHOWCASE.md` and `docs/COMMAND_IDS_V1_V2.md`. GitHub tells capitals apart in a file address, so a link you saved to one of the old names returns 404 — the new name is the same page.

## 0.5.0

_2026-09-20 · [all changes since 0.4.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.4.0...0.5.0)_

> [!NOTE]
> A Field of type link can show its Values as an emoji — or as anything else — and a click still opens the note, while the cursor and the mouse treat what you see as one piece. Every command now carries the name of its area, so the command reference can hand you over to Obsidian's `Hotkeys` screen with one heading of it filtered in. An unassigned key reads as an empty slot, every dropdown says which value is the standard one, and moving a line in a numbered list renumbers it again.

1. ✨ **Every heading in `Commands & Hotkeys` has a `to hotkeys` button** — an area, a part of it, or one of your Fields — and it opens Obsidian's `Hotkeys` screen filtered to exactly that heading's commands.
2. 🎨 **Each command is named after its area now**: `Navigation: Move line up`, `Tags & PKM: Category next`. That is what makes the filter above exact — Obsidian's `Hotkeys` search matches words in a name. Identifiers did not change, so every hotkey you have set keeps working.
3. 🎨 **`not set` in the `Hotkey` column reads as an empty slot**: no button fill, a dashed outline and faint italic text, so an unassigned command is told from an assigned one at a glance.
4. ✨ **A dropdown says which of its values is the standard one**: the value the plugin starts with carries `(default)` after its label, in every settings row that offers a list. A list with a single line — `Set a Templates folder first`, say — is left alone: there is no choice to point at.
5. 🐛 **A numbered list keeps counting after you move a line in it.** A sub-line moved under another parent, or to the top of its own sub-list, used to keep the number it came with — `3.` where `1.` belongs. Moved lines are now numbered from the nearest item above them at the same level. A list started at another number keeps it, unless you move its first line.
6. ✨ **A Field of type link can show its Values as anything you like.** Its Values table has the `Show` column now: pick `custom`, type an emoji, and `[[Project A]]` is drawn as that emoji — a click on it still opens the note, in a new tab with `Ctrl`. At `default` it stays the link Obsidian draws.
7. ✨ **New: `Link view`** under `Visual → Inline appearance` — two switches that hand a shown link back what an ordinary link gets from Obsidian: the preview on hover and dragging. Both off by default.
8. 🐛 **A Value shown as your own text is one step for the cursor.** Arrow keys and `Shift+→` used to walk the hidden characters of `[[Project A]]` behind a single emoji; the replaced piece is now crossed in one step, and selected whole. The same goes for a tag shown as `custom` or `empty`.
9. 🐛 **A shown link can be dragged at last.** Pressing it used to be swallowed by the plugin, and a press that is swallowed never becomes a drag. The press is now left to the browser and the note is opened on click — which is also how an ordinary link behaves.
10. 🐛 **`Inline to note` no longer leaves a separator with nothing to separate.** A line whose Values all stood before your text — `- #work [[Project A]] :: 12` — came back as `- :: [[note]] :: #processed`. The empty slot goes with its Values; a line that still has a right Block keeps it.
11. 🔧 **The `docs` folder shows only what a reader needs**: the showcase, its media, the old-to-new map of command ids and the settings prototype. Everything written for whoever develops the plugin moved into `docs/dev/`; nothing was deleted.
12. 🎨 **This changelog opens each release with a one-paragraph summary** and marks every line with what it is: ✨ new, 🐛 fix, 🎨 visible change, 🚀 speed, 🔧 internal.

## 0.4.0

_2026-09-20 · [all changes since 0.3.2](https://github.com/romkuznetsov/inline-overhaul/compare/0.3.2...0.4.0)_

> [!NOTE]
> Five new things in the settings panel — Block text size split per side, `Stripe direction`, a child Field that works without its parent, `Parent Value` and `Autosave` for your settings — and the panel itself laid out in sections. Plus the TagWheel and Block fixes you reported, and a repository root with no plugin file in it.

### Added

1. ✨ **Block text size is set for each side on its own.** `Text size` under `Inline appearance` became `Left Block text size` and `Right Block text size`; whatever you had is written into both on first run.
2. ✨ **New: `Stripe direction`** — which Block gets the Stripe behind it: `Left`, `Right` or `Both`. `Both` by default, so nothing changes until you pick a side.
3. ✨ **New: a `Changelog` button** in `General → Help` opens this file on GitHub, every release, newest first.
4. ✨ **New: a child Field can work without its parent.** `Child Field` in the Fields editor became a choice of three — `Show always`, `After parent` (what it always did) and `Hide` — and `Show always` adds a second row, `Parent Value`: leave the line alone, or also write the parent Value the picked one belongs to. Per Field, and nothing changes until you pick it.
5. ✨ **New: `Autosave`** under `Advanced → Backup` writes a copy of your settings whenever the file differs from the last autosave, checked at every start of Obsidian, and says so. Off by default, ten newest kept, and each copy lists what changed. The tab you left open is not a setting and never triggers a copy.

### Changed

6. 🐛 **TagWheel no longer writes a value twice.** A line carrying the value of a child Field whose parent is not on the line got that value again in the Right Block; it now stays as it is.
7. 🐛 **Everything written in a Block is the size of the line it sits on, and on the same level.** The size used to come from a number in the code rather than from your text, and the bubble sat a point above the writing next to it.
8. 🐛 **Settings edited outside Obsidian are picked up even when Obsidian says nothing.** Copying a `data.json` in from another vault keeps the source's timestamp, and Obsidian announces only files newer than the plugin's last write — so the plugin now looks at the file before writing its own settings, and the disk wins.
9. 🎨 **The settings panel is laid out in sections.** `Inline appearance` has `Line view` and `Tag view`; the `Keyboard` groups `Expanded 'Ctrl+A'`, `Smart Delete\Backspace` and `Smart Enter` became sections of one group, `Global hotkeys`. Nothing moved out of reach.
10. 🎨 **The window title in every dialog has a size of its own** instead of whatever the theme makes of an `h4` — in some themes that was smaller than the headings underneath it. Eight dialogs.
11. 🐛 **The "what changed" window reads properly.** It renders its Markdown, shows every release you skipped rather than the newest one alone (up to five, newest first), and carries a link to the full changelog.
12. 🎨 **Five Stripe rows are renamed:** `Color the Block with Stripe`, `Stripe color`, `Stripe opacity`, `Stripe height`, `Stripe width`. The old names still find them in the settings search.
13. 🐛 **The live preview of a jump highlight no longer promises a press.** The circle has run on a timer since 0.3.1.
14. 🐛 **A wiki link in the `Inline appearance` preview follows the Block text size**, as everything else in that preview already did.
15. 🎨 **This file reads as a numbered list**, one line per change, so you can see at a glance how many things a release touched.
16. 🔧 The plugin author is `Roman Kuznetsov`.
17. 🐛 **A child Field set to `Show always` with `Add the parent Value` now cycles through every one of its Values.** The parent the plugin writes for you is no longer read back as your own pick, so the ring no longer collapses to the first Value; the parent follows the Value you land on and leaves the line with it. A parent you put there yourself still narrows the ring, as before.
18. 🎨 **The `What changed` list in an autosave note names the controls and nests them the way the panel does.** A Value sits under its Field and its colors sit under the Value, every row is called by the name it carries in the settings panel instead of a config path, and rows the panel merely rewrote with their defaults are left out.
19. 🐛 **A field command no longer writes over an open TagWheel.** While the panel is up its view lives in the line itself, so a command invoked by hotkey edited that view instead of your text and the work was lost when the panel closed. Now such a command does nothing and says so; pressing the panel's own command still applies it as before.

### Internal

20. 🔧 **The parsed cache of the old TagWheel config note is removed from your settings file.** The note itself went in 0.2.0; its cache stayed and looked like settings — editing it by hand changed nothing, because nothing reads it.

21. 🔧 **The repository root holds no plugin file.** `main.js`, `navigation_runtime.js`, `pkm_runtime_v2.js`, `pkm_v2/` and `styles.css` live under `src/`, `build/` under `tools/`, `media/` and `SHOWCASE.md` under `docs/`; nine old documents moved to `docs/dev/archive/`. Nothing was deleted, and the bundle differs by 28 lines out of 33 000 — all of them the bundler's own labels.

## 0.3.2

_2026-09-18 · [all changes since 0.3.1](https://github.com/romkuznetsov/inline-overhaul/compare/0.3.1...0.3.2)_

> [!NOTE]
> A small release about settings that change behind the plugin's back: it re-reads the file, redraws everything and says so. The panel also opens on the tab you left it on, and TagWheel no longer stalls on a very long line.

### Changed

1. 🐛 **Settings changed outside Obsidian are picked up instead of being overwritten.** The plugin re-reads the file, redraws the panel, rebuilds the decorations in open notes and says so once. The disk wins, and your own edit in the panel stays silent.
2. 🎨 **The settings panel opens on the tab you left it on**, and switching tabs does not take up an undo step.

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
> One fix worth a release: a setting changed a moment before Obsidian closes is no longer lost. The rest is guards for exactly the shape that bug had.

### Fixed

1. 🐛 **A settings change made right before the plugin unloads is no longer lost.** Writes wait a quarter of a second so dragging a slider does not hit the disk on every pixel; unloading used to cancel the pending write without a word. Best effort, not a guarantee.

### Internal

2. 🔧 A guard for names declared as methods and called by nobody — that is the shape the bug above had: the function to finish the pending write existed from the start and was never called.
3. 🔧 The order-config loader no longer carries a fallback that could never run. Measured before removing: 2 759 calls, zero entries.
4. 🔧 A robustness probe for lines from the outside world — very long ones, emoji sequences, right-to-left text, a thousand tags: 468 cases, no crashes.

## 0.3.0

_2026-09-17 · [all changes since 0.2.0](https://github.com/romkuznetsov/inline-overhaul/compare/0.2.0...0.3.0)_

> [!NOTE]
> The largest release so far: five new things, among them a jump highlight and a link written back into the notes your line mentions, and twenty-five fixes — most of them about what counts as a Field Value and which Block it belongs to.

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

31. 🎨 **`Quiet time between jumps` is now called `Latency between jumps`.** The old name still finds the row.
32. 🎨 **The scroller settings sit under a `Scroller` subheading** inside `TagWheel` instead of running on from the colors above them.
33. 🎨 **A subheading inside a group no longer floats between the rows** — it sits close to the rows it heads.
34. ✨ **A cross clears what you typed** in eight places, from both Transform folders to `Backup folder` and `Log file`.

## 0.2.0

_2026-09-16 · [all changes since 0.1.0-beta.6](https://github.com/romkuznetsov/inline-overhaul/compare/0.1.0-beta.6...0.2.0)_

> [!NOTE]
> The first release outside the beta line. It carries everything published as `0.1.0-beta.7` plus the work of 2026-09-16; if you ran a beta, install this over it.

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
> Almost nothing to see: one list of what the plugin can do, written for people, and a lot of rules that were declared in two or three places at once became one each.

1. ✨ **New: `FEATURES.md`** — a list of what the plugin can do, in words, kept honest by a guard that fails when a command or a panel area is missing from it.
2. 🔧 Otherwise internal: rules that were declared in two or three places at once became one each, 23 dead declarations went, and every silent failure in the engines either speaks now or says in place why it is silent.

## 0.1.0-beta.5

_2026-09-10 · [all changes since 0.1.0-beta.4](https://github.com/romkuznetsov/inline-overhaul/compare/0.1.0-beta.4...0.1.0-beta.5)_

> [!NOTE]
> The released build had no working commands at all — they are back, and five engines with them. Four more fixes about text the plugin used to eat.

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
> The settings panel can speak your language: every visible line lives in a plain text file you copy and edit. Backups got the rest of the attention.

1. ✨ **The settings panel can speak another language.** `General → Language` picks it, and the words behind every visible line live in a plain text file inside the plugin folder; a line with no translation keeps its English wording.
2. ✨ **`texts/default.js` is written by the plugin and always current.** Copy it under a new name to start a language; that copy is yours and is never overwritten.
3. ✨ **The windows the panel opens speak the chosen language too**, including the lines they build as they go.
4. 🎨 **The text file reads in the order the panel does**: tab, its callout, group, setting, and the window that setting opens.
5. 🐛 **Restoring a backup no longer moves your backup folder.** The folder is an address in this vault, not a setting.
6. 🐛 **The restore window always says what it found about hotkeys**: the clashing commands by name, or that there are none.
7. 🐛 **Hotkey comparison reads `Mod` and the second way a key can be written.** `Mod` is Ctrl on Windows and Cmd on macOS, not letters.
8. 🎨 **`Save a backup` explains itself**: the long paragraph moved into a tip, and the checkboxes got a heading of their own.
9. 🎨 `General → Language` sits above `General → Help`, and text in the plugin's own windows is sized for reading.

Known limitations: the Fields editor and its neighbours, the guide note and the messages shown while you type stay English whatever language you pick.

## 0.1.0-beta.3

_2026-09-06 · [all changes since 0.1.0-beta.2](https://github.com/romkuznetsov/inline-overhaul/compare/0.1.0-beta.2...0.1.0-beta.3)_

> [!NOTE]
> The plugin is now called `inlineOverhaul`, with its id unchanged so your hotkeys keep working. Backups learned to ask what to save and what to restore.

1. 🎨 **The plugin is now called `inlineOverhaul`.** Its id is unchanged, so every hotkey you have set keeps working; the guide note was renamed, and the old one still opens instead of a duplicate being made.
2. ✨ **`Save a backup` asks what to save**: an optional comment, a checkbox per settings tab, and how much of your hotkeys to keep. Everything is picked by default.
3. 🐛 **Restoring a partial backup leaves the tabs you did not save alone**, and the confirmation window lists both sides.
4. ✨ **Restoring can free up keys other commands are holding** — a checkbox, off by default, with the clashing commands named one by one.
5. 🐛 **Restoring re-registers the plugin commands**, so hotkeys for Fields that came with the backup show up without a restart.
6. 🐛 **The generated rules file no longer reappears in the vault root** after restoring an older backup.
7. 🐛 **A Field added on an empty line leaves room for text**: `-  :: 📅…` instead of `- :: 📅…`, and the in-line cursor jump lands in that slot.

Known limitations: unchanged from 0.1.0-beta.2.

## 0.1.0-beta.2

_2026-09-06 · [all changes since 0.1.0-beta.1](https://github.com/romkuznetsov/inline-overhaul/compare/0.1.0-beta.1...0.1.0-beta.2)_

> [!NOTE]
> A release made the way every later one is: cut by tag, built by CI, with all three assets attached.

1. 🔧 Released from the current code as a normal release with all three assets, so BRAT installs the plugin from one link.
2. 🔧 Releases are cut by tag from then on: CI builds from the tagged commit, runs the whole suite and attaches the files.

## 0.1.0-beta.1

_2026-08-08_

> [!NOTE]
> The first beta: a BRAT-ready release of the shared PKM, TagWheel and Transform runtime, with Transform off until you ask for it.

1. 🔧 Added BRAT-ready bundled release assets and release regressions.
2. 🔧 Stabilized shared PKM, TagWheel, and Transform runtime paths for beta testing.
3. 🔧 Kept Transform explicit opt-in and disabled by default.
4. 🔧 Documented beta safety, installation, build, testing, and known limitations.

Known limitations: Flying button and visual styling are disabled; Obsidian manual beta cases remain open.
