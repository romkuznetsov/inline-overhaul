## Приложение B. Опись целевого состояния

Сгенерировано из `docs/prototype/settings_prototype.html` командой:

```
python tests/prototype/update_prd.py
```

Руками не правится. При изменении прототипа опись перегенерируется, и её diff показывает, что именно изменилось в текстах.

### Вкладки и группы (снято с прототипа)

| # | Вкладка | Тумблер модуля | Групп | Настроек | Своих блоков |
|---|---------|----------------|-------|----------|--------------|
| 1 | General | — | 5 | 9 | 2 |
| 2 | Keyboard | — | 4 | 14 | 8 |
| 3 | Navigation | `features.navigation.enabled` | 5 | 25 | 5 |
| 4 | Tags & PKM | `features.pkm.enabled` | 7 | 17 | 5 |
| 5 | Transform | `features.transform.enabled` | 7 | 34 | 5 |
| 6 | Visual | `features.visual.enabled` | 7 | 57 | 13 |
| 7 | Advanced | — | 3 | 9 | 1 |

### Группы по порядку


**General** (`general`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 5 | `brand-intro` | inlineOverhaul | — | — | — |
| 10 | `general-intro` | Before you start | — | — | `general.help.showCallouts` |
| 50 | `language` | Language | The panel, its tips and the messages this plugin shows can speak another language, and the words behind them live in a file you can edit yourself | да | — |
| 100 | `help` | Help | Where to start, and how much hand-holding you want along the way | да | — |
| 200 | `modules` | Modules | Four separate things live in this plugin. Turn off the ones you do not want and they stop adding commands and stop touching your notes | да | — |

**Keyboard** (`keyboard`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `keyboard-intro` | Before you start | — | — | `general.help.showCallouts` |
| 100 | `global-hotkeys` | Global hotkeys | Four keys Obsidian already gives you — <code>Ctrl/Cmd + A</code>, <code>Del</code> with <code>Backspace</code>, <code>Enter</code> and <code>Ctrl/Cmd + V</code> — taught to do the obvious thing inside a line of yours | да | — |
| 200 | `binder` | Binder (custom insert commands) | For text you type over and over. Put it in a row here, give that row a key, and one press drops it in wherever your cursor is | да | — |
| 300 | `command-reference` | Commands & Hotkeys | Everything this plugin can do, in one list. None of it has a key until you give it one — click in the <code>Hotkey</code> column to do that | да | — |

**Navigation** (`navigation`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `nav-intro` | Before you start | — | — | `general.help.showCallouts` |
| 100 | `move-lines` | Move lines (up/down) | Reorder a note without cutting and pasting: pick up a line and walk it up or down | да | — |
| 200 | `left-right` | Move lines (left/right) | Two keys, one for left and one for right, and between them they do three jobs: nudge a piece of text along a line, change the marker at the start of a line, or change how far the line is indented. Which one you get depends on what is selected — the two lists below spell it out | да | — |
| 400 | `in-line` | Jump inside a line (left/right) | A line can hold tags before your text and dates after it. These keys walk the cursor between those parts without leaving the line | да | — |
| 500 | `heading-jumps` | Jump inside a note (up/down) | Skip through a long note by its headings instead of scrolling | да | — |

**Tags & PKM** (`pkm`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `pkm-intro` | Before you start | — | — | `general.help.showCallouts` |
| 100 | `fields` | Fields | A Field is one slot a line can hold: a tag, a link to another note, or an element such as a date. Set out the slots you want, the Values each one offers, and where on the line they go | да | — |
| 200 | `line-format` | Separators | Two markers of your choosing carve out the middle of a line. Whatever you write goes between them; the Fields sit outside. Which Fields land on which side is set under <code>Fields</code>, by dragging one across the line | да | — |
| 300 | `writing-rules` | Writing rules | The small habits: how a tag is written when it has a Value underneath it, what is left when you clear a line, and where the cursor waits for you afterwards | да | — |
| 350 | `tagwheel-behavior` | tagWheel behavior | Where tagWheel lands when it opens, what happens to the Values it is not picking, and what the arrow keys do at the edge of a Block. How it looks is set on the Visual tab | да | — |
| 400 | `placement-modes` | Placement modes | Every Field in Left or Right Block has a <code>Prefix behavior</code> mode: <code>Strict</code> or <code>Insert only</code>. These options define how exactly those modes work | да | — |
| 500 | `prefix-priority` | Prefix priority | Some Values want to change the start of the line — a checkbox from Status, an exclamation mark from Priority. When two of them ask at once, only one can win. These rules decide who | да | — |

**Transform** (`transform`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `transform-intro` | Before you start | — | — | `general.help.showCallouts` |
| 100 | `inline-to-note` | Inline to note | You write a thought on one line. Press the key, and that line becomes a note of its own — or gets added to a note you already have. The line stays where it was, with a link to the new note in its place if you want one | да | — |
| 200 | `naming` | New note naming | The new note needs a name. This block defines how the name of a new note is chosen | да | `transform.inline2note.enabled` |
| 300 | `note-content` | Note content | What the note looks like inside: where your text goes, and what sits above it | да | `transform.inline2note.enabled` |
| 400 | `source-line` | Source line | What happens to the line you pressed on, once the note is safely written | да | `transform.inline2note.enabled` |
| 450 | `backlinks` | Auto-MOC in your links | A line that points at other notes can leave a pointer back in each of them | да | `transform.inline2note.enabled` |
| 500 | `smart-rules` | Smart Rules | Different kinds of line deserve different notes. A rule spots a kind of line and picks the template for it | да | `transform.inline2note.enabled` |

**Visual** (`visual`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `visual-intro` | Before you start | — | — | `general.help.showCallouts` |
| 100 | `tag-appearance` | Inline appearance | How a tagged line looks while you write. Tags are drawn as small colored bubbles; links and dates stay ordinary text. Nothing here changes a single character in your file | да | — |
| 200 | `tag-bars` | Tag Bars | A colored Bar in the margin, so you can see at a glance what a whole block of lines is about without reading their tags. The Bar runs down the side of the line and everything nested under it | да | — |
| 300 | `tagwheel` | tagWheel | tagWheel opens over the line and lays your Fields out across it, with the Values of the Field you are on running down | да | — |
| 400 | `text-cursor` | Text cursor | The blinking line that shows where your typing will land. Give it a color of its own and it stops disappearing into the page | да | — |
| 450 | `jump-highlight` | Cursor jump highlight | A jump throws the caret across the screen, and a thin blinking line is hard to find again. This draws a circle where it lands and lets it shrink away on its own | да | — |
| 500 | `user-tag-colors` | Color custom tags | Colors for tags that are not a Value of any Field in <code>Tags & PKM → Fields</code>. A tag you type straight into a line still gets a bubble, and this is where you say what that bubble looks like | да | — |

**Advanced** (`advanced`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `advanced-intro` | Before you start | — | — | `general.help.showCallouts` |
| 190 | `settings-backup` | Backup | A backup is an ordinary note in your vault. It holds everything you have set up here, so you can come back to it later or carry your setup to another vault | да | — |
| 200 | `diagnostics` | Diagnostics | What helps work out why something misbehaves: the id every setting carries, and a log of what the plugin did. Be aware the log is saved into your vault and will contain the text of the lines you were working on | да | — |

### Полная опись настроек


#### Before you start — `advanced-intro` (вкладка `advanced`)

- **`advanced-callout`** — свой блок, рендерер `renderTabCallout`

#### Backup — `settings-backup` (вкладка `advanced`)

_Intro:_ A backup is an ordinary note in your vault. It holds everything you have set up here, so you can come back to it later or carry your setup to another vault

_Tip:_ Saving writes a new note every time and never overwrites an earlier one, so the folder fills up and it is on you to delete what you no longer want. Restoring replaces <b>everything</b> on every tab and asks you to restart afterwards; whether the plugin saves what you have now before it writes is the toggle below. Because a backup is an ordinary note, syncing your vault carries it to your other machine, and restoring it there is how a setup travels

- **Backup folder** — `backup-folder`, `text`, path `advanced.backups.folder`, default `inlineOverhaul/Backups`
  - desc: Where in your vault the backups are kept
  - tip: Any folder you like. It is made when you save the first backup, not before. Backups are ordinary notes, so they travel with the vault and sync along with the rest of it
- **Autosave** — `backup-autosave`, `toggle`, path `advanced.backups.autosave`, default `false`
  - desc: Keep a copy of your settings whenever they change outside the panel
  - tip: On every start of Obsidian the plugin compares your settings file with the last autosave it made, and writes a new one when the two differ — so a file arriving from another device, from your sync or from a copy has a way back. The copy is full: every tab and the hotkeys of this plugin. Under the heading <code>What changed</code> in each note is the list of settings that differ from the previous autosave. The ten newest copies are kept and older ones are removed. This is not the same thing as undo: to step back one change inside the panel, use the command <code>Undo last settings change</code>
- **Save a backup before restoring** — `backup-before-restore`, `toggle`, path `advanced.backups.beforeRestore`, default `true`
  - desc: Write what you have now into the folder above before an earlier backup replaces it
  - tip: On, every restore leaves you a way back, and that copy is named with <code>Autogenerated</code> at the end so you can tell it from the ones you saved yourself. Off, restoring writes straight over what you have and the confirmation says so — pick that if you restore often and the folder fills up with copies you never asked for
- **Your settings** — `settings-backup-actions`, `buttons`
  - desc: Save what you have set up now, or bring back an earlier backup
  - tip: Saving writes a new note every time and never overwrites an earlier one — delete the ones you no longer want yourself. Restoring replaces <b>everything</b> on every tab and asks you to restart afterwards. Whether what you have now is saved first is the toggle above, and a copy taken that way is named with <code>Autogenerated</code> at the end
  - кнопки: `save-backup` Save a backup · `restore-backup` Restore a backup
- **Start over** — `settings-reset-actions`, `buttons`
  - desc: Delete everything you have set up here and go back to the plugin’s own defaults
  - tip: Everything means everything: every tab, every Field, every Value, every rule, every Binder row, and the hotkeys you gave to plugin commands. Hotkeys of other plugins are left alone. A backup of what you have now is written first, into the folder above, named with <code>Autogenerated</code> at the end, so the way back is the button next to this one — which is also what this is for: a way to check that a backup really brings everything back. This button always writes that copy, whatever the toggle above says: here it is the only way back there is
  - кнопки: `reset-settings` Delete all my settings

#### Diagnostics — `diagnostics` (вкладка `advanced`)

_Intro:_ What helps work out why something misbehaves: the id every setting carries, and a log of what the plugin did. Be aware the log is saved into your vault and will contain the text of the lines you were working on

_Tip:_ Leave the log off unless you are chasing a problem. It is an ordinary note in your vault, it grows with every keypress the plugin handles, and it records the lines you were on — so it carries whatever you happened to be writing. Turn it on, reproduce the problem once, turn it off, and read the note. The row above it is quieter and costs nothing: ids are what the plugin’s own notes, reports and issues call settings by, and they never change when a name or a description is reworded

- **Show option IDs in tips** — `show-setting-ids`, `toggle`, path `advanced.showSettingIds`, default `false`
  - desc: Put the id of each setting and group at the end of its tip
  - tip: The id goes into the tip, so <code>Show tips</code> on the General tab has to be on as well. Settings without a tip of their own get one with just the id in it. Ids are the safe way to point at a setting — in a bug report, in a question, or when someone walks you through a fix — because they outlive every rewording of a name
- **Developer logging** — `dev-mode`, `toggle`, path `advanced.devMode.enabled`, default `false`
  - desc: Record what the plugin did, to help track down a problem
  - tip: Leave this off day to day. Turn it on, reproduce the problem once, then turn it off and attach the log to a bug report after checking what is in it
  - старые названия для поиска: «Enable Dev Mode»
- **Machine-readable log** — `dev-ai-log`, `toggle`, path `advanced.devMode.aiLog`, default `true`
  - desc: Also keep a second, denser log meant for tools rather than people
  - tip: Only worth turning on if someone has asked you for it. The plain log is the one you can read yourself
  - видна если: `advanced.devMode.enabled`
  - старые названия для поиска: «Generate log for AI?»
- **Log folder** — `dev-log-path`, `text`, path `advanced.devMode.logPath`, default `InlineOverhaul_DevLog`
  - desc: Where in your vault the logs are put
  - tip: They are ordinary notes, so they show up in search and in your graph. Keep them in a folder you exclude if that bothers you
  - видна если: `advanced.devMode.enabled`
  - старые названия для поиска: «Log Path»

#### inlineOverhaul — `brand-intro` (вкладка `general`)

- **`brand-mark`** — свой блок, рендерер `renderBrandMark`

#### Before you start — `general-intro` (вкладка `general`)

- **`general-callout`** — свой блок, рендерер `renderTabCallout`

#### Language — `language` (вкладка `general`)

_Intro:_ The panel, its tips and the messages this plugin shows can speak another language, and the words behind them live in a file you can edit yourself

_Tip:_ Every visible line of this panel has a name of its own, and the words behind those names sit in a small text file inside the plugin folder — one file per language. Change a line there, reload the plugin, and the panel says what you wrote: rewording a setting is no longer something you have to ask for. To add a language, copy the English file under a new name and translate the right-hand side. Anything you leave alone keeps its English wording, so a half-finished translation is still worth using

- **Language** — `ui-language`, `dropdown`, path `general.language`, default `en`
  - desc: What language this panel and the plugin messages speak
  - tip: The list holds English plus every language file found in the plugin folder, and it is built from the files themselves — nothing has to be registered anywhere. Switching takes effect at once, without a reload. A line that has no translation yet keeps its English wording rather than showing you a blank
  - варианты: 

#### Help — `help` (вкладка `general`)

_Intro:_ Where to start, and how much hand-holding you want along the way

_Tip:_ <code>Read</code> writes a guide into your vault the first time you press it and opens it every time after, and the note is yours from then on — the plugin never overwrites it. <code>Show tips</code> controls these very boxes: off, the panel keeps only the one-line descriptions, which is what you want once you know your way around

- **Guide** — `howto`, `buttons`
  - desc: Worked examples of the things people set up first
  - tip: <code>Read</code> writes the guide into your vault the first time you press it, and opens it every time after that. Inside is the practical side: which commands are worth a key, how to lay out your first few Fields, what tagWheel feels like once it is set up, and a couple of complete setups you can copy. From then on the note is yours — scribble in it, move it, rename it. The plugin never writes over it again, so pressing this button never loses anything you add there
  - кнопки: `open-howto` Read
- **Changelog** — `changelog`, `buttons`
  - desc: What changed in this version, and in every one before it
  - tip: Opens <code>CHANGELOG.md</code> of the plugin repository in your browser: every release, newest first, with a numbered line per change. The same text for the newest release is what the window after an update shows you — there is one story about a release, not two
  - кнопки: `open-changelog` Open
- **Show callouts** — `show-callouts`, `toggle`, path `general.help.showCallouts`, default `true`
  - desc: Keep the boxes that say what a tab or a block of settings is for
  - tip: The boxes are the ones with a colored edge: one at the top of every tab saying what the tab is for, and one under each block of settings saying what that block does. Turn this off once you know your way around and the panel keeps the settings and the one-line descriptions under their names. It is a separate switch from <code>Show tips</code>: that one hides the <code>?</code> marks, this one hides the boxes
  - старые названия для поиска: «Show intro boxes»
- **Show tips** — `show-tips`, `toggle`, path `general.help.showTips`, default `true`
  - desc: Put a ? beside anything that needs more explanation
  - tip: Click a ? and a short explanation opens underneath, usually with an example. Turn this off once you no longer need them: the one-line descriptions stay either way

#### Modules — `modules` (вкладка `general`)

_Intro:_ Four separate things live in this plugin. Turn off the ones you do not want and they stop adding commands and stop touching your notes

_Tip:_ Turning an area off is not the same as leaving it alone. Its commands disappear from the palette, so a hotkey you gave them stops doing anything, and its settings are hidden here until you turn it back on. Nothing you configured is lost — the settings come back exactly as they were. Use this to keep the palette short: if you only ever wanted the tags, three of the four can go

- **Navigation** — `module-navigation`, `toggle`, path `features.navigation.enabled`, default `true`
  - desc: Move lines, text and the cursor without reaching for the mouse
  - tip: Nothing here writes anything new. It only moves text you have already written — a line up, a word along, the cursor across. Safe to leave on
- **Tags & PKM** — `module-pkm`, `toggle`, path `features.pkm.enabled`, default `true`
  - desc: Set up your PKM tags, wikilinks and emoji elements, and insert them inline with one key
  - tip: This is the part that puts tags and dates onto a line for you, and steps them forward with a keypress. Turning it off changes nothing you have already written — those keys simply stop working
- **Transform** — `module-transform`, `toggle`, path `features.transform.enabled`, default `true`
  - desc: Turn an inline entry into a note, with templates, YAML properties, rules and more
  - tip: Leaving this on does not let anything happen yet. Making notes needs one more switch, on the Transform tab, because it is the one thing here that writes new files
- **Visual** — `module-visual`, `toggle`, path `features.visual.enabled`, default `true`
  - desc: Customize and beautify your inline text with tag colors, Bars and much more
  - tip: Appearance only. Your notes contain exactly the same text either way — this decides how it looks on screen. Anyone opening the file elsewhere sees the plain text

#### Before you start — `keyboard-intro` (вкладка `keyboard`)

- **`keyboard-callout`** — свой блок, рендерер `renderTabCallout`

#### Global hotkeys — `global-hotkeys` (вкладка `keyboard`)

_Intro:_ Four keys Obsidian already gives you — <code>Ctrl/Cmd + A</code>, <code>Del</code> with <code>Backspace</code>, <code>Enter</code> and <code>Ctrl/Cmd + V</code> — taught to do the obvious thing inside a line of yours

_Tip:_ Nothing here rebinds a key: all four stay Obsidian’s own, and each setting changes what happens in one case and leaves the rest alone. That is also why every one of them starts switched off — a key that belongs to the editor should not change its mind without being asked. The sections below are independent: switch on the one you want and the others stay as they were

- **`select-all-sub`** — свой блок, рендерер `?`
- **Expanded 'Ctrl+A'** — `select-all-enabled`, `toggle`, path `editor.selectAll.enabled`, default `false`
  - desc: Change what <code>Ctrl/Cmd + A</code> does: take the line first, then widen
  - tip: On a task list the first press takes just the task you are on, the second the task and its tree, and the last the whole note. Press <code>Ctrl/Cmd + A</code> once more with the last option below on, and the cursor goes back where it started
  - старые названия для поиска: «Enhanced Mod+A», «Expanded select all»
- **Selection steps** — `select-all-steps`, `dropdown`, path `editor.selectAll.mode`, default `line-note`
  - desc: How much more gets picked up on each press
  - tip: <b>Word</b> is the word nearest the cursor, so the first press takes one word instead of the whole line. <b>Tree</b> means the line plus everything indented under it. <b>Heading</b> means everything under the nearest heading. <b>Custom</b> opens the list of all five steps below and cycles through the ones you tick, in the order they are shown. Pick the shortest sequence you actually use — every extra step is one more press before you reach the whole note
  - варианты: `line-note` Line, note · `line-tree-note` Line, tree, note · `line-tree-header-note` Line, tree, heading, note · `word-line-tree-header-note` Word, line, tree, heading, note · `custom` Custom
  - выключена если: `editor.selectAll.enabled`
  - старые названия для поиска: «Select-all mode»
- **Steps to cycle through** — `select-all-custom-head`, `note`
  - desc: Which of the five a press stops at
  - tip: The order is fixed — word, line, tree, heading, note — and the ticks decide which of them a press stops at. Tick <b>word</b>, <b>line</b> and <b>note</b>, and the key goes from the word under the cursor to the whole line to the whole note, skipping the two in between. Tick nothing and the key stays Obsidian’s own: one press, the whole note
  - видна если: `editor.selectAll.mode`
- **`select-all-custom`** — свой блок, рендерер `renderSelectAllCustom`
- **Count presses by timer** — `select-all-timer`, `toggle`, path `editor.selectAll.useDelay`, default `false`
  - desc: Decide the next step by how quickly you press, rather than by what is selected
  - tip: Off is the forgiving setting: pause as long as you like, and the next press still widens the selection. On, pausing longer than the time below means you start again from the line — handy if you often select something, walk away, and come back
  - выключена если: `editor.selectAll.enabled`
  - старые названия для поиска: «Use multi-press delay»
- **Time between presses** — `select-all-delay`, `slider`, path `editor.selectAll.delayMs`, default `700`
  - desc: How long you can pause and still be in the middle of a sequence
  - tip: Only used when the timer above is on. Around three quarters of a second suits most people; raise it if you keep losing your place
  - диапазон: 250–2000, шаг 50, ед. ms
  - видна если: `editor.selectAll.useDelay`
  - выключена если: `editor.selectAll.enabled`
  - старые названия для поиска: «Multi-press delay»
- **Last press clears highlighting** — `select-all-clear`, `toggle`, path `editor.selectAll.clearOnLast`, default `false`
  - desc: After the last step, pressing again drops the selection and returns the cursor
  - tip: Lets you get out of a selection with the same key you got into it, instead of clicking somewhere to deselect
  - выключена если: `editor.selectAll.enabled`
  - старые названия для поиска: «Last press clears selection», «One more press clears it»
- **`smart-delete-sub`** — свой блок, рендерер `?`
- **Smart Delete** — `smart-delete-enabled`, `toggle`, path `editor.smartDelete.enabled`, default `false`
  - desc: Let <code>Del</code> at the end of a line bring up the words without the indent and the Prefix
  - tip: Nothing here rebinds the key: <code>Del</code> stays Obsidian’s, and this only changes what happens in the one case where it joins two lines. Off, the key behaves as it always has. <code>Smart Backspace</code> below is a switch of its own and does not need this one
  - старые названия для поиска: «Smart Del», «Delete the junk»
- **Smart Backspace** — `smart-delete-backspace`, `toggle`, path `editor.smartDelete.onBackspace`, default `false`
  - desc: Let <code>Backspace</code> at the start of a line send it up without its own indent and Prefix
  - tip: The same thing from the other side, and it stands on its own: <code>Smart Delete</code> above can stay off and this still works. <code>Backspace</code> at the start of a line joins it to the line above, and by default it takes the indent and the bullet along. On, they stay behind and only the words go up. A line with nothing on it disappears, which is the quickest way to close a gap
  - старые названия для поиска: «Smart Backspace», «Do the same on Backspace»
- **Drop the line Prefix** — `smart-delete-prefix`, `toggle`, path `editor.smartDelete.dropPrefix`, default `true`
  - desc: Take the bullet, checkbox, number or quote mark off the arriving line, not only its indent
  - tip: On, <code>- [ ] read the docs</code> arrives as <code>read the docs</code>. Off, only the indent goes and the line keeps its Prefix, which is what you want when the two lines are meant to stay two list items. This one answers to both keys above
  - выключена если: `editor.smartDelete.enabled, editor.smartDelete.onBackspace`
  - старые названия для поиска: «Drop the bullet»
- **Join with a space** — `smart-delete-space`, `toggle`, path `editor.smartDelete.joinWithSpace`, default `true`
  - desc: Put one space between your text and the text that arrives, so the two do not run together
  - tip: Only when both sides have something on them and your line does not already end in a space. Off, the two pieces of text meet with nothing between them, which is what you want when you are joining a word that got split. This one answers to both keys above
  - выключена если: `editor.smartDelete.enabled, editor.smartDelete.onBackspace`
  - старые названия для поиска: «Add a space»
- **`smart-enter-sub`** — свой блок, рендерер `?`
- **Smart Enter** — `smart-enter-enabled`, `toggle`, path `editor.smartEnter.enabled`, default `false`
  - desc: Let <code>Enter</code> add a line instead of splitting the one you are on
  - tip: Nothing here rebinds the key: <code>Enter</code> stays Obsidian’s, and this only changes what happens inside a line of yours. Off, the key behaves as it always has
  - старые названия для поиска: «Smart Enter», «Do not split the line»
- **Where it works** — `smart-enter-scope`, `dropdown`, path `editor.smartEnter.scope`, default `line`
  - desc: How much of the line the key treats as one record
  - tip: <b>Whole line</b> keeps the whole line together: wherever the cursor stands — in a Block, on a Separator or in your text — the key adds a line below. <b>Text only</b> narrows it to the text slot, the part between your Separators, so <code>Enter</code> inside a Block goes back to being Obsidian’s own. If a line carries only one Separator, the text slot is whatever lies after the first or before the second
  - варианты: `line` Whole line · `text` Text only
  - выключена если: `editor.smartEnter.enabled`
  - старые названия для поиска: «Smart Enter scope», «Only in your text»
- **Prefix on the new line** — `smart-enter-prefix`, `dropdown`, path `editor.smartEnter.newLinePrefix`, default `same`
  - desc: What the line <code>Smart Enter</code> adds starts with
  - tip: <b>Same as above</b> repeats the marker exactly as Obsidian does it on its own: a bullet stays a bullet, a numbered item gets the next number, and a checkbox arrives empty, because a line you have not written yet is not a task you have done. <b>None</b> starts the new line bare. <b>Numbered lines only</b> does the same but keeps the count going, so a numbered list does not lose its place — a checkbox still goes. The indent is kept by all three: a line three levels deep has no business jumping to the left margin
  - варианты: `same` Same as above · `none` None · `number-only` Numbered lines only
  - выключена если: `editor.smartEnter.enabled`
  - старые названия для поиска: «Keep the bullet», «New line Prefix», «Carry the Prefix over»
- **`smart-paste-sub`** — свой блок, рендерер `?`
- **Smart paste** — `smart-paste-enabled`, `toggle`, path `editor.smartPaste.enabled`, default `false`
  - desc: Count a pasted numbered list from one, and drop a pasted marker where the line has one
  - tip: Nothing here rebinds the key: <code>Ctrl/Cmd + V</code> stays Obsidian’s, and this only changes what arrives when what you paste is a numbered list or a list item. Off, the key behaves as it always has. A paste that neither starts a numbered list nor lands on a line with a marker is not touched at all, whatever this is set to
  - старые названия для поиска: «Smart insert», «Paste a numbered list», «Renumber on paste»

#### Binder (custom insert commands) — `binder` (вкладка `keyboard`)

_Intro:_ For text you type over and over. Put it in a row here, give that row a key, and one press drops it in wherever your cursor is

_Tip:_ Binder turns a snippet into a command of its own. Add a row, type the text you want dropped in, and the plugin registers a command for that row; give the command a key in <code>Settings → Hotkeys</code>, and from then on one press inserts the text wherever the cursor is. An arrow, a callout opener, a signature, a table skeleton — anything you retype often is worth a row. The <code>Hotkey</code> column shows the key a row has now, and clicking it takes you to Obsidian’s list to change it. Afterwards you change only the description — to change the text a row inserts, delete the row and add it again, because the command is created from the row and disappears with it

- **`binder-table`** — свой блок, рендерер `renderBinder`

#### Commands & Hotkeys — `command-reference` (вкладка `keyboard`)

_Intro:_ Everything this plugin can do, in one list. None of it has a key until you give it one — click in the <code>Hotkey</code> column to do that

_Tip:_ One row per command this build actually registers, so the list answers two questions at once: what the plugin can do, and which of it you have already put on a key. The <code>Hotkey</code> column is the only thing you set here — click a cell and Obsidian’s own hotkey screen opens on that command. Rows appear and disappear with your setup: every Field adds a pair of cycle commands, every Binder row adds one, and turning a module off takes its commands away. In Obsidian’s own hotkey list these all appear under <b>inlineOverhaul</b>, so typing that in its search box brings up the whole set at once. tagWheel is the exception: once it is open you steer it with the arrow keys, so it needs only the one command that opens it

- **`command-list`** — свой блок, рендерер `renderCommandReference`

#### Before you start — `nav-intro` (вкладка `navigation`)

- **`nav-callout`** — свой блок, рендерер `renderTabCallout`

#### Move lines (up/down) — `move-lines` (вкладка `navigation`)

_Intro:_ Reorder a note without cutting and pasting: pick up a line and walk it up or down

_Tip:_ When a line has other lines indented beneath it, the whole bundle is called its <b>tree</b>. That word turns up in a few places here. The setting below is where you decide whether the bundle travels with the line or stays behind

- **Move lines** — `move-lines-enabled`, `toggle`, path `navigation.moveLine.enabled`, default `true`
  - desc: Let the keys pick up a line and move it
  - tip: Off, the two commands stay in the palette and do nothing: nothing is deleted and no hotkey is lost. Turn it back on and everything is where you left it. What the keys do with a selection, and whether they carry the whole line or only the text, is set by the rows below
  - старые названия для поиска: «Enable Move Line»
- **Moving behavior** — `move-lines-no-selection`, `dropdown`, path `navigation.moveLine.noSelectionMode`, default `line-only`
  - desc: Whether the tree under the line travels with it
  - tip: Say a line has three lines indented under it. <b>Line only</b> lifts that one line out and leaves the three where they are, so the order changes around them. <b>Whole tree</b> keeps the four together and moves them as one block
  - варианты: `line-only` Line only · `with-children` Whole tree
  - выключена если: `navigation.moveLine.enabled`
  - старые названия для поиска: «No-selection mode»
- **Moving headings** — `move-lines-heading`, `dropdown`, path `navigation.moveLine.headerMode`, default `move-as-line`
  - desc: If you are moving a heading, this decides whether the whole section moves or just the heading line
  - tip: With <b>heading with its section</b>, one press swaps two whole sections of a note, content and all. With <b>heading only</b> the heading text moves on its own and the paragraphs under it stay put, which is what you want when you are only reordering the headings
  - варианты: `move-as-line` Heading only · `move-with-section` Whole section
  - выключена если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Header mode»
- **Cross heading boundaries** — `move-lines-cross`, `toggle`, path `navigation.moveLine.crossSectionAllowed`, default `true`
  - desc: Let a line travel past a heading into the part of the note below it
  - tip: Leave it on and a line keeps going wherever you push it. Turn it off and it stops at the heading, which is what you want in a note where each heading has to keep its own contents
  - выключена если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Cross-section allowed»
- **Highlight after moving** — `move-lines-select`, `toggle`, path `navigation.moveLine.highlightMovedLines`, default `false`
  - desc: Keep the lines highlighted once they land, so you can see what moved
  - tip: Useful when you move a tree of several lines and want to be sure the whole thing came along
  - выключена если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Highlight moved lines», «Select after moving»
- **Follow the moved line** — `move-lines-view`, `toggle`, path `navigation.moveLine.keepInView`, default `true`
  - desc: Scroll the note to the line you moved instead of leaving the view where it was
  - tip: Off, the note does not scroll at all: what you see stays exactly where it was, and a line pushed past the edge goes on moving out of sight. On, the view follows the line and puts it where the setting below says
  - выключена если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Scroll on move», «Keep in view», «Screen jumps»
- **Where the line lands** — `move-lines-view-position`, `dropdown`, path `navigation.moveLine.viewPosition`, default `center`
  - desc: The place on screen the moved line is scrolled to
  - tip: The same place every time, so the note does not jump: one press does not center the line while the next throws it to the top. Near the start or the end of a note there is nothing left to scroll, and the line sits as close to the chosen place as the note allows
  - варианты: `center` Center · `top` Top · `bottom` Bottom
  - видна если: `navigation.moveLine.keepInView`
  - выключена если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Scroll position», «Center on move»

#### Move lines (left/right) — `left-right` (вкладка `navigation`)

_Intro:_ Two keys, one for left and one for right, and between them they do three jobs: nudge a piece of text along a line, change the marker at the start of a line, or change how far the line is indented. Which one you get depends on what is selected — the two lists below spell it out

_Tip:_ Two keys, three jobs, and the line decides which one you get. Highlight some text and they slide it along the line. On a plain line with nothing highlighted they change the marker at the start of it, walking down the list below. On a list item, <code>Move right</code> indents instead, because that is what you almost always mean there. The two lists at the top of this group show the order the checks run in, and you switch each job below off on its own, so you can narrow the keys down to the one thing you want them to do

- **`left-right-order`** — свой блок, рендерер `renderLeftRightOrder`
- **`move-text-sub`** — свой блок, рендерер `?`
- **Move selected text** — `move-text-enabled`, `toggle`, path `navigation.moveSelection.inlineEnabled`, default `true`
  - desc: Slide a highlighted phrase along its line
  - tip: Highlight two words in the middle of a sentence and press <code>Move right</code>: they trade places with the word after them, and stay highlighted, so you can keep pressing until they are where you want
  - старые названия для поиска: «Enable inline text move»
- **Movement step** — `move-text-step`, `dropdown`, path `navigation.moveSelection.inlineMoveMode`, default `auto`
  - desc: How far the highlighted text goes on each press
  - tip: <b>Auto</b> reads what you highlighted: part of a word moves letter by letter, a whole word hops over whole words. Pick one of the others if you would rather it always behave the same way
  - варианты: `auto` Auto · `char` Character · `word` Word · `disabled` Off
  - выключена если: `navigation.moveSelection.inlineEnabled`
  - старые названия для поиска: «Inline move mode»
- **Step out of the word** — `move-text-word-escape`, `toggle`, path `navigation.moveSelection.inlineWordEscape`, default `false`
  - desc: Let a highlighted part of a word carry on past the word it came from
  - tip: Only <code>Auto</code> has anything to decide here, which is why this row shows up for that step alone. Highlight two letters inside a word and <code>Auto</code> moves them letter by letter — but at the edge of the word it stops, because the next press would carry the letters into the word next door. On, it carries them: <b>te|xt more</b> becomes <b>te xtmore</b>, and that is the point — the highlighted piece goes wherever you press. Off is the way it has always worked
  - видна если: `navigation.moveSelection.inlineMoveMode`
  - выключена если: `navigation.moveSelection.inlineEnabled`
  - старые названия для поиска: «Leave the word», «Word escape»
- **Continue past Separators** — `move-text-cross`, `toggle`, path `navigation.moveSelection.inlineBoundaryJump`, default `true`
  - desc: Let the highlighted text leave your text and move into the tags at either end
  - tip: Off, a highlighted phrase stays between the Separators: it will not slide back into the tags at the start of the line, nor forward into the dates at the end. Turn it on when you do want to shuffle a tag and a phrase past each other
  - выключена если: `navigation.moveSelection.inlineEnabled`
  - см. также: `in-line-cross` — The cursor has the same setting of its own
- **`move-line-sub`** — свой блок, рендерер `?`
- **Cycle line Prefixes** — `prefix-cycle-enabled`, `toggle`, path `navigation.moveSelection.prefixCyclerEnabled`, default `true`
  - desc: Turn a line into a heading, a bullet, a numbered item or plain text, one press at a time
  - tip: <code>Move right</code> walks down the list below, <code>Move left</code> walks back up, and an empty row in it means plain text with no Prefix at all. Both cycle whenever the line has no indent; on an indented line they change the indent instead. Whether the right key cycles at all is the row below
  - старые названия для поиска: «Enable PrefixCycler»
- **`cycle-order`** — свой блок, рендерер `renderCycleOrder`
- **Cycle in both directions** — `right-cycles`, `toggle`, path `navigation.moveSelection.rightCycles`, default `true`
  - desc: On: <code>Move right</code> changes the marker too, but only on a line with no indent
  - tip: On, both keys change the marker while the line sits at the left edge: <code>Move right</code> walks down the list below and <code>Move left</code> walks back up. <b>An indented line is not part of this</b> — there <code>Move right</code> indents as it always did, and cycling stays a <code>Move left</code> job. <b>The price is at the left edge</b>: a line with no indent is no longer pushed by <code>Move right</code> while the list still has somewhere to go, and what happens when it runs out is <code>After the last one</code> — with <b>Start over</b> the key never pushes at all, and indenting is left to <code>Tab</code>. Switch this off and the two keys split the work: <code>Move left</code> changes the marker, <code>Move right</code> only ever indents
  - выключена если: `navigation.moveSelection.prefixCyclerEnabled`
- **After the last one** — `prefix-cycle-end`, `dropdown`, path `navigation.moveSelection.onCycleEnd`, default `indent`
  - desc: What happens when you reach the bottom of the list below
  - tip: <b>Start over</b> loops back to the top, so you can keep pressing until you find what you want. <b>Indent</b> stops cycling and starts pushing the line to the right instead
  - варианты: `indent` Indent · `wrap` Start over
  - выключена если: `navigation.moveSelection.prefixCyclerEnabled`
  - старые названия для поиска: «On cycle end»
- **Change the indent** — `indent-fallback`, `toggle`, path `navigation.moveSelection.indentFallbackEnabled`, default `true`
  - desc: When neither of the two jobs above applies, move the line right or left instead
  - tip: On, the keys always do something. Off, they sit quiet unless there is text to move or a marker to change — pick that if you indent with Tab and would rather these keys never touched it
  - старые названия для поиска: «Indent fallback»

#### Jump inside a line (left/right) — `in-line` (вкладка `navigation`)

_Intro:_ A line can hold tags before your text and dates after it. These keys walk the cursor between those parts without leaving the line

_Tip:_ A tagged line has three parts: what comes before your text, your text, and what comes after. The arrow keys treat all of it as one long string and walk through the tags character by character. These two keys hop instead — word, sentence, or straight to one end of your text — and by default they stop at the Separators, so the cursor stays in the sentence you are writing and never lands inside a tag by accident

- **Move cursor inside a line** — `in-line-enabled`, `toggle`, path `navigation.navigateInline.enabled`, default `true`
  - desc: Let the keys walk the cursor along the line
  - tip: This is the cursor walking your own sentence, not the note: it steps by word, by sentence or straight to the start or end, and it knows where your text ends and a Separator begins. Off, the commands stay and do nothing
  - старые названия для поиска: «Enable Navigate Inline»
- **Step size** — `in-line-step`, `dropdown`, path `navigation.navigateInline.stepMode`, default `word`
  - desc: How big a hop the cursor makes each time
  - tip: <b>Word</b> is the everyday choice. <b>Sentence</b> suits long paragraphs. <b>Start or end</b> skips the middle entirely and lands at one end of your text
  - варианты: `word` Word · `sentence` Sentence · `begin-end` Start or end
  - выключена если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «Step mode»
- **Continue past Separators** — `in-line-cross`, `toggle`, path `navigation.navigateInline.boundaryJump`, default `false`
  - desc: Let the cursor leave your text and walk into the tags at either end
  - tip: Off is the safer setting while you are writing: the cursor stays in your sentence and cannot wander into the tags. Turn it on when you want to reach a tag with the same keys instead of the mouse
  - выключена если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «Allow crossing Separators», «Continue past Separators»
- **What to do at the end** — `in-line-boundary`, `dropdown`, path `navigation.navigateInline.onBoundary`, default `wrap`
  - desc: When there is nowhere further to go in the line
  - tip: Say the cursor is on the last word before the closing Separator and you press again. <b>Stop</b> does nothing. <b>Wrap around</b> sends it back to the first word of the same stretch. <b>Next line</b> leaves the line entirely
  - варианты: `stay` Stop · `wrap` Wrap around · `next-line` Next line
  - выключена если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «On boundary», «At the far end»

#### Jump inside a note (up/down) — `heading-jumps` (вкладка `navigation`)

_Intro:_ Skip through a long note by its headings instead of scrolling

_Tip:_ In a note with headings these two keys move you a section at a time, which beats scrolling and beats the outline sidebar once your hands are on the keyboard. The settings below decide what counts as a stop — every heading, or every line — where on the line you land, and whether the note scrolls so that what you jumped to is actually on screen

- **Jump between headings** — `heading-jumps-enabled`, `toggle`, path `navigation.jumpToHeader.enabled`, default `true`
  - desc: Turn on the <code>Jump up</code> and <code>Jump down</code> commands
  - tip: Both commands move between headings only; walking line by line is a mode inside them, not a separate feature. Off, they stay in the palette and do nothing, and any hotkey you gave them is kept
  - старые названия для поиска: «Enable Jump To Header»
- **Jump target** — `heading-jumps-mode`, `dropdown`, path `navigation.jumpToHeader.jumpMode`, default `edge`
  - desc: Hop between headings, or crawl from one written line to the next
  - tip: <b>Headings</b> is for finding your way around a long note. <b>Lines</b> turns the same keys into a slow walk through the text, which some people prefer to the arrow keys. It steps from one written line to the next and does not stop on the empty ones, nor on rules and table rows: those are spacing, not places to be
  - варианты: `edge` Headings · `line` Lines
  - выключена если: `navigation.jumpToHeader.enabled`
  - старые названия для поиска: «Jump mode»
- **Where in the section** — `heading-jumps-edge`, `dropdown`, path `navigation.jumpToHeader.edgeMode`, default `start-end`
  - desc: Land at the start of the part you jump to, or at its end
  - tip: <b>Alternate</b> means one press takes you to the start, the next to the end, so you can reach both without changing the setting
  - варианты: `start-end` Start and end · `start` Start only · `end` End only
  - видна если: `navigation.jumpToHeader.jumpMode`
  - выключена если: `navigation.jumpToHeader.enabled`
  - старые названия для поиска: «Edge behavior»
- **Cursor position after jumping** — `heading-jumps-cursor`, `dropdown`, path `navigation.jumpToHeader.jumpCursorPosition`, default `section-end`
  - desc: Where on that line the cursor ends up
  - tip: <b>Text end</b> puts the cursor after the last word you wrote but before the tags and dates at the end of the line, so you can carry on typing without having to step back over them. <b>Text start</b> is the same place at the other end, just after the tags. This row also decides where <code>Jump right</code> drops you when you step in from the tags
  - варианты: `start` Line start · `end` Line end · `section-start` Text start · `section-end` Text end
  - выключена если: `navigation.jumpToHeader.enabled`
  - см. также: `separator-2` — Where your text ends is set by the second Separator
  - старые названия для поиска: «Jump cursor position», «Cursor on arrival»
- **Follow the jump target** — `heading-jumps-center`, `toggle`, path `navigation.jumpToHeader.centerCursor`, default `true`
  - desc: After a jump, scroll the note so the line you landed on is on screen
  - tip: Without it you often arrive at the very bottom of the window, with the section you jumped to still off screen below — so you have to scroll anyway. With it on, you can read straight away, and the row below says where on the screen you land
  - выключена если: `navigation.jumpToHeader.enabled`
  - старые названия для поиска: «Center the target», «Center the screen on target», «Scroll on jump»
- **Where the target lands** — `heading-jumps-view-position`, `dropdown`, path `navigation.jumpToHeader.viewPosition`, default `center`
  - desc: The place on screen the line you jump to is scrolled to
  - tip: The same place every time, and the same three choices <code>Moving behavior</code> has. Near the start or the end of a note there is nothing left to scroll, and the line sits as close to the chosen place as the note allows
  - варианты: `center` Center · `top` Top · `bottom` Bottom
  - видна если: `navigation.jumpToHeader.centerCursor`
  - выключена если: `navigation.jumpToHeader.enabled`
  - старые названия для поиска: «Scroll position», «Center on jump»

#### Before you start — `pkm-intro` (вкладка `pkm`)

- **`pkm-callout`** — свой блок, рендерер `renderTabCallout`

#### Fields — `fields` (вкладка `pkm`)

_Intro:_ A Field is one slot a line can hold: a tag, a link to another note, or an element such as a date. Set out the slots you want, the Values each one offers, and where on the line they go

_Tip:_ A <b>Field</b> is one slot on a line. There are three kinds of Field: <b>tag</b>, <b>link</b> (wikilink), and <b>Emoji</b> — such as a date or a time. Each Field automatically gets two <b>cycle commands</b>, <code>next</code> and <code>previous</code>, which insert the Value and cycle it back or forth — it is worth a hotkey for the ones you use often, so a <code>#todo</code> tag is one keypress away. <b>tagWheel</b> opens all of your Fields over the line at once, so you can pick with the arrow keys instead of remembering which key does what

- **`line-preview`** — свой блок, рендерер `renderLinePreview`
- **`field-editor`** — свой блок, рендерер `renderFieldEditor`

#### Separators — `line-format` (вкладка `pkm`)

_Intro:_ Two markers of your choosing carve out the middle of a line. Whatever you write goes between them; the Fields sit outside. Which Fields land on which side is set under <code>Fields</code>, by dragging one across the line

_Tip:_ Choose these carefully and then leave them alone. Lines you have already written keep their old Separator, so changing it later means the plugin no longer recognizes them. Use two or more characters that Markdown does not already claim: <code>||</code> and <code>::</code> are good, <code>==</code> is not, because Obsidian reads it as a highlight

- **First Separator** — `separator-1`, `text`, path `pkm.lineFormat.separator1`, default `||`
  - desc: Goes between the tags at the front and the start of your sentence
  - tip: Pick something you would never type on purpose in a sentence. Two pipe characters are the default for exactly that reason — nobody writes them by accident
- **Second Separator** — `separator-2`, `text`, path `pkm.lineFormat.separator2`, default `||`
  - desc: Goes at the end of your sentence, before the dates and links
  - tip: Using exactly the same one as the first is fine. Which is which is decided by where it sits on the line, not by what it looks like

#### Writing rules — `writing-rules` (вкладка `pkm`)

_Intro:_ The small habits: how a tag is written when it has a Value underneath it, what is left when you clear a line, and where the cursor waits for you afterwards

_Tip:_ These are the settings you set once and forget. They do not decide which Fields you have or what they offer — that is the <code>Fields</code> block above. They decide the shape of what lands on the line: whether a nested Value is written as <code>#parent #child</code> or <code>#parent/child</code>, what a Field leaves behind when you step it past its last Value, and where the cursor ends up so you can keep typing

- **Child tag format** — `child-tag-format`, `dropdown`, path `pkm.behavior.childTagFormat`, default `separate`
  - desc: When a Value sits under another one, whether they are written as two tags or one
  - tip: Say <code>doing</code> has <code>review</code> under it. Two separate tags give you <code>#doing #review</code>, and searching for <code>#doing</code> finds the line. One combined tag gives <code>#doing/review</code>, which keeps the pair together in Obsidian’s tag list but means a search for the parent needs a slash. Every preview on the Visual tab follows whichever you pick
  - варианты: `separate` Separate (#doing #review) · `combined` Nested (#doing/review)
  - см. также: `tag-preview` — See it in the tag appearance preview
  - старые названия для поиска: «Subtag format»
- **When a line empties out** — `cycle-end-behavior`, `dropdown`, path `pkm.behavior.cycleEndBehavior`, default `keep-bullet`
  - desc: What is left behind when cycling removes the last Value
  - tip: Step a Field back past its first Value and the tag comes off the line. If that was the only thing on it, you are left with <code>- </code> and nothing else. <code>Keep bullet</code> leaves it as a list item ready for typing; <code>Clear line</code> leaves a blank line
  - варианты: `keep-bullet` Keep bullet · `clear-prefix` Clear line
  - старые названия для поиска: «Line Prefix after end of cycle»
- **Cursor after an action** — `cursor-policy`, `dropdown`, path `pkm.behavior.cursorPolicy`, default `text_end`
  - desc: Where the cursor waits once a tag or date has been set
  - tip: Almost always what you want is <b>end of your text</b>: the cursor lands right where you stopped writing, in front of the tags, so you can carry straight on. The other two put it somewhere you usually have to move it from
  - варианты: `text_end` Text end · `current_position` Don't move · `line_end` Line end
  - старые названия для поиска: «Cursor behavior»

#### tagWheel behavior — `tagwheel-behavior` (вкладка `pkm`)

_Intro:_ Where tagWheel lands when it opens, what happens to the Values it is not picking, and what the arrow keys do at the edge of a Block. How it looks is set on the Visual tab

_Tip:_ tagWheel is the picker that opens over your line with your Fields laid out across it. These settings decide how it moves, not how it looks: the Field it opens on, whether the Values of the other Block stay in sight, and where the arrows take you past the last Field. Colors, sizes and the scroller live under <code>Visual</code> → <code>tagWheel</code>

- **Active Field on opening** — `wheel-active-field`, `dropdown`, path `visual.tagWheel.activeField.mode`, default `first`
  - desc: Which Field the picker lands on when it opens
  - tip: tagWheel opens on one of the Fields of the Block, and the up and down keys start moving through that Field’s Values. <code>First Field</code> lands on the one standing first in your order. <code>Middle Field</code> lands nearer the middle, so neither end is far: with two Fields it is the first, with three the second, with four the second, with five the third. <code>Chosen Field</code> opens two more settings, one per Block. A custom block opens on its first or its middle Field the same way, and with <code>Chosen Field</code> on its first; with the cursor on one of its Values it opens on that Value’s Field
  - варианты: `first` First Field · `middle` Middle Field · `custom` Chosen Field
  - старые названия для поиска: «Lead Field», «Starting Field», «Active Field»
- **Left Block active Field** — `wheel-active-left`, `dropdown`, path `visual.tagWheel.activeField.left`, default `""`
  - desc: The Field tagWheel lands on when it opens on the left
  - tip: Only Fields standing in the Left Block are offered. A Field you later move to the other Block stops being the one it lands on, and the Left Block falls back to its first
  - варианты: `` First Field
  - видна если: `visual.tagWheel.activeField.mode`
  - старые названия для поиска: «Lead Field left»
- **Right Block active Field** — `wheel-active-right`, `dropdown`, path `visual.tagWheel.activeField.right`, default `""`
  - desc: The Field tagWheel lands on when it opens on the right
  - tip: Only Fields standing in the Right Block are offered. Leave it on <code>First Field</code> and the right side opens on its first Field
  - варианты: `` First Field
  - видна если: `visual.tagWheel.activeField.mode`
  - старые названия для поиска: «Lead Field right»
- **Values in the other Block** — `wheel-opposite-block`, `dropdown`, path `visual.tagWheel.oppositeBlock`, default `hide`
  - desc: What happens to the Values you are not picking while the picker is open
  - tip: tagWheel draws itself over the line, and the Block it is standing in gives up its place to the picker. <code>Hide</code> is how it has always worked: the other Block leaves the line for as long as you are choosing. <code>Show</code> leaves it written where it belongs, so you can see what the line already carries on the other side of your text. Either way nothing is written or removed — what you pick lands on the line when the picker closes. A custom block hides or keeps the Values of Left and Right Block the same way; the Values it has already written always stay in sight, as part of your text
  - варианты: `hide` Hide · `keep` Show
  - старые названия для поиска: «Opposite Block», «Other Block», «Hide values»
- **tagWheel navigation behavior** — `wheel-edge`, `dropdown`, path `visual.tagWheel.edgeMode`, default `stay`
  - desc: What the arrow keys do when there is no next Field on this side
  - tip: The left and right Blocks each hold their own Fields, and the arrows walk along one of them. <code>Stay in Block</code> keeps you there: past the last Field you land back on the first. <code>Next Block</code> makes the two into one ring — step right off the end of the Left Block and you arrive at the first Field of the right one, step left off its start and you arrive at the last. <code>Tab</code> switches Blocks either way. A custom block is not part of the ring: there the arrows always stay in the same Block
  - варианты: `stay` Stay in Block · `next-block` Next Block
  - старые названия для поиска: «Edge of a Block», «Wrap around», «Move to the next Block», «At the last Field»
- **Switch custom blocks on Tab** — `wheel-custom-tab`, `toggle`, path `visual.tagWheel.customTab`, default `false`
  - desc: Tab in a custom block’s tagWheel moves on to the next custom block
  - tip: Off, <code>Tab</code> does nothing while a custom block’s tagWheel is open. On, it moves on to the next custom block in the order of the Fields list, and from the last one back to the first; the picker stays where the cursor is, and what you picked in the block you leave is dropped — only <code>Enter</code> writes. The tagWheel of Left and Right Block never moves into a custom block
  - видна если: `pkm.fields.order.custom`
  - старые названия для поиска: «Custom block», «Tab», «Next custom block»

#### Placement modes — `placement-modes` (вкладка `pkm`)

_Intro:_ Every Field in Left or Right Block has a <code>Prefix behavior</code> mode: <code>Strict</code> or <code>Insert only</code>. These options define how exactly those modes work

_Tip:_ You choose the mode for each Field over in <code>Fields</code>. What you set here is the fine print of each mode — mainly whether it is allowed to change the very start of the line, the part that makes it a bullet or a checkbox

- **Strict: add a bullet** — `placement-bullet-strict`, `toggle`, path `pkm.placement.bulletInStrict`, default `false`
  - desc: Start the line with a bullet when the Field has nothing of its own to put there
  - tip: Headings are always left alone. This only decides what happens to a plain line: on, it becomes a list item; off, it stays as it is
  - см. также: `field-editor` — Each Field’s Prefix behavior is set under Fields
  - старые названия для поиска: «OFF mode Prefix»
- **Insert only: keep the Prefix** — `placement-keep-prefix`, `toggle`, path `pkm.placement.keepPrefixInsertOnly`, default `true`
  - desc: Put the Value where it belongs and do not touch the start of the line
  - tip: A Value may carry a Prefix of its own — a checkbox, for instance — and normally it replaces what stands at the start of the line. With this on, the line keeps the marker you typed and the Value goes to its place in the Block anyway. Useful when your lists already carry markers you care about
  - старые названия для поиска: «Minimal mode Separators»
- **Insert only: use Field Prefix** — `placement-field-prefix`, `toggle`, path `pkm.placement.fieldPrefixInsertOnly`, default `true`
  - desc: Allow a Value to change the start of the line after all, if it has its own
  - tip: Some Values carry their own opening, like <code>- [x]</code> for done. On, choosing that Value ticks the checkbox for you. Off, the line keeps whatever it started with and only the tag changes
  - старые названия для поиска: «Minimal mode Prefix»

#### Prefix priority — `prefix-priority` (вкладка `pkm`)

_Intro:_ Some Values want to change the start of the line — a checkbox from Status, an exclamation mark from Priority. When two of them ask at once, only one can win. These rules decide who

_Tip:_ This block matters only if two of your Values both want the start of the line. If none of them do, or only one ever does, nothing here changes anything. <b>Decide by</b> is the main choice: settle it by where the Fields stand in your own order, or by a list of openings you rank yourself. The row below it decides whether a nested Value outranks its parent or the other way round

- **Decide by** — `prefix-priority-decide`, `dropdown`, path `pkm.prefixPriority.decideBy`, default `by-section`
  - desc: Settle it by the order of your Fields, or by a list of openings you rank yourself
  - tip: <b>Field order</b> is the simple answer: whichever Field comes first in your list gets its way. <b>Prefix order</b> is for when you care about the openings themselves — say an urgent mark should always beat a tick, no matter which Field asked for it
  - варианты: `by-section` Field order · `by-checkbox-list` Prefix order
  - старые названия для поиска: «Main checkbox priority», «Prefix Resolver»
- **Field order source** — `prefix-priority-source`, `dropdown`, path `pkm.prefixPriority.fieldOrderSource`, default `manual`
  - desc: Use the order your Fields are already in, or arrange a separate one
  - tip: Two Values may both want to change the start of the line, and then one of them has to win. <code>Field order</code> settles it by the order your Fields already stand in, so there is one list to keep. <code>Manual</code> gives this question its own list, independent of the Blocks
  - варианты: `auto` Field order · `manual` Manual
  - видна если: `pkm.prefixPriority.decideBy`
  - старые названия для поиска: «Field order mode»
- **`field-order-list`** — свой блок, рендерер `renderFieldOrderList`
- **`prefix-order-list`** — свой блок, рендерер `renderPrefixOrderList`
- **Parent or child wins** — `prefix-priority-parent`, `dropdown`, path `pkm.prefixPriority.parentOrChild`, default `subtag-over-tag`
  - desc: When a tag and its child Value both carry a Prefix
  - tip: A child Value stands under its parent, and both may carry a Prefix. <code>Parent tag</code> keeps the line marked by the wider meaning; <code>Child tag</code> lets the narrower one speak, so a child marked as done wins over a parent that is merely open
  - варианты: `tag-over-subtag` Parent tag · `subtag-over-tag` Child tag
  - старые названия для поиска: «Tag/Subtag priority»

#### Before you start — `transform-intro` (вкладка `transform`)

- **`transform-callout`** — свой блок, рендерер `renderTabCallout`

#### Inline to note — `inline-to-note` (вкладка `transform`)

_Intro:_ You write a thought on one line. Press the key, and that line becomes a note of its own — or gets added to a note you already have. The line stays where it was, with a link to the new note in its place if you want one

_Tip:_ One keypress does three things in a row: it works out which note to use, it puts your text into that note, and it tidies up the line you pressed on. The groups below follow that order, so you can read down the page and see the whole journey. Nothing runs until <code>Inline to note</code> just below is switched on

- **Inline to note** — `i2n-enabled`, `toggle`, path `transform.inline2note.enabled`, default `false`
  - desc: Allow this to create notes and add to notes you already have
  - tip: This is the switch that lets the plugin write to your vault. Everything else on this tab only decides how. Make a backup and try it on a note you do not mind breaking: one keypress can add a note, change a note, and edit the line you were on
  - старые названия для поиска: «Inline2Note enabled»
- **Templates folder** — `i2n-templates-folder`, `folder`, path `transform.inline2note.templatesFolder`, default `""`
  - desc: The folder your note templates live in
  - tip: A template is an ordinary note that a new note starts out as a copy of. Whatever you keep in this folder shows up in the lists below. Start typing and Obsidian suggests the folders you already have; a name it does not know is kept as it is, and the folder is made the first time it is needed
  - видна если: `transform.inline2note.enabled`
- **Default template** — `i2n-default-template`, `dropdown`, path `transform.inline2note.defaultTemplate`, default `""`
  - desc: The template on creation of new note when no special rules apply (see <code>Smart Rules</code> below)
  - tip: You can set up rules further down that pick a different template for certain lines. This one is used for everything else. The list holds the notes from the folder above and nothing else — set that folder first, and the list fills itself
  - варианты: 
  - видна если: `transform.inline2note.enabled`
- **New notes folder** — `i2n-output-folder`, `folder`, path `transform.inline2note.outputFolder`, default `""`
  - desc: Where to put the notes this creates. Leave it empty to keep them next to the note you are in
  - tip: Start typing and Obsidian suggests the folders you already have; a name it does not know is kept as it is, and the folder is made the first time a note goes into it. Left empty, a new note lands beside the note you pressed the key in
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «Output folder for new notes»
- **Floating button** — `i2n-floating`, `toggle`, path `transform.inline2note.floatingButton`, default `false`
  - desc: Put a small button at the end of the line you are on
  - tip: Click it and the line turns into a note, the same as pressing the key would. The button is only drawn on screen — it is never saved into your note, so nothing changes if you open the file elsewhere
  - видна если: `transform.inline2note.enabled`
  - см. также: `i2n-button-preview` — See where it appears
  - старые названия для поиска: «Flying button»
- **Distance from the text** — `i2n-floating-gap`, `slider`, path `transform.inline2note.floatingButtonGap`, default `12`
  - desc: How much room to leave between the line and the button
  - tip: The button is drawn after the last character of the line you are on, and on a short line it can sit close enough to read as part of the text. This is how much room to leave between them. At <code>0</code> it sits right against the text; the widest setting puts it a whole word away
  - диапазон: 0–40, шаг 1, ед. px
  - видна если: `transform.inline2note.enabled, transform.inline2note.floatingButton`
  - см. также: `i2n-button-preview` — The preview below moves with it
  - старые названия для поиска: «Floating button gap», «Button offset»
- **`i2n-button-preview`** — свой блок, рендерер `renderFloatingButton`
- **Open note after creation** — `content-open`, `toggle`, path `transform.inline2note.openTarget`, default `false`
  - desc: Jump straight to the note once it is written
  - tip: Handy while you are still setting this up, so you can see what came out. Turn it off once you trust it and you can keep writing without losing your place
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «Open transformed note», «Open the note afterwards»

#### New note naming — `naming` (вкладка `transform`)

_Intro:_ The new note needs a name. This block defines how the name of a new note is chosen

_Tip:_ Three ways of finding one are tried in turn, and the first that works wins: the text between your chosen brackets, then a heading on the line, then simply the first few words

- **Note name** — `naming-mode`, `dropdown`, path `transform.inline2note.noteName.mode`, default `auto`
  - desc: Take the name from the line, or stop and ask you for it
  - tip: <b>Ask</b> opens a small box with the suggested name already filled in, so you can accept it or type your own
  - варианты: `auto` From line · `manual` Ask
  - старые названия для поиска: «Note name mode»
- **Name brackets** — `naming-delimiters`, `text`, path `transform.inline2note.noteName.delimiters`, default `[]`
  - desc: Two characters. Whatever you put between them becomes the name
  - tip: Put <code>()</code> here, write the line <code>- call (Anna about the contract) || text</code>, and you get a note called <b>Anna about the contract</b>. Leave this box empty and the name comes from the heading or the first words instead
  - старые названия для поиска: «Title delimiters», «Explicit name delimiters», «Name brackets»
- **Words to use instead** — `naming-word-count`, `number`, path `transform.inline2note.noteName.wordCount`, default `6`
  - desc: How many of the first words to use when there are no brackets
  - tip: Set this to 3 and the line <code>- draft the settings prototype today</code> becomes a note called <b>draft the settings</b>. Too few and the names all look alike; too many and they get unwieldy
  - диапазон: 1–20, шаг 1
  - старые названия для поиска: «Auto title word count»
- **If the name already taken** — `naming-collision`, `dropdown`, path `transform.inline2note.nameCollision.mode`, default `new_note`
  - desc: What to do when you already have a note with that name
  - tip: <b>New note</b> adds a number to the name and never touches what you already wrote — the safe choice. <b>Add to existing</b> is what you want for a running log. <b>Overwrite</b> throws the old contents away, and this plugin cannot give them back
  - варианты: `new_note` New note · `add_to_note` Add to existing · `overwrite` Overwrite
  - старые названия для поиска: «Name collision mode», «If the name is taken»

#### Note content — `note-content` (вкладка `transform`)

_Intro:_ What the note looks like inside: where your text goes, and what sits above it

_Tip:_ Two decisions live here. The first is where in the note your line lands — at the top, after whatever is already there, or at the end of a section you name, which is what you want when one note collects many entries. The second is what goes on the line above it, so entries in a collecting note do not run together: a date, a fixed word of your own, or nothing at all. The rest of the note comes from the template, and the template is chosen further up

- **Where to put the text** — `content-position`, `dropdown`, path `transform.inline2note.placement.position`, default `end`
  - desc: At the top of the note, or after whatever is already there
  - tip: If you are adding to a note over and over — a diary, a log of calls — pick <b>at the end</b> so the entries stay in the order you wrote them. For a brand new note it makes no difference. <b>Under heading</b> is for a note laid out in sections: name the heading below and every entry lands at the end of that section, whatever else the note gains over time
  - варианты: `beginning` Beginning · `end` End · `custom-header` Under heading
  - старые названия для поиска: «Where to place inline text?»
- **Name of the heading** — `content-target-header`, `text`, path `transform.inline2note.placement.targetHeader`, default `""`
  - desc: The heading your text is filed under
  - tip: Write the heading as it stands in the note. Put the hashes in — <code>## Log</code> — and only a heading of that depth counts; leave them out and a heading of any depth with those words will do. Upper and lower case do not matter. Two headings with the same name: the first one wins, because this box holds a name and not a place. When a note has no such heading it gets written for you, at the depth you put here — no hashes means one
  - видна если: `transform.inline2note.placement.position`
- **If heading not found** — `content-header-missing`, `dropdown`, path `transform.inline2note.placement.fallback`, default `end`
  - desc: Where the heading is added when the note has none
  - tip: A brand new note, or one you have not laid out yet, has no such heading — so the heading is <b>written for you</b> here, and your text goes under it. It is written exactly as you named it above, hashes and all, so the next entry finds it and joins the same section instead of starting a second one
  - варианты: `beginning` Beginning · `end` End
  - видна если: `transform.inline2note.placement.position`
- **Line above the text** — `content-header-mode`, `dropdown`, path `transform.inline2note.placement.headerMode`, default `datetime`
  - desc: Something to put above your text so entries stay apart
  - tip: Useful when a note collects many entries: a date, or a word of your own, keeps them from running together. Whether that line is a heading is a separate question, and the row below answers it
  - варианты: `custom` Fixed text · `datetime` Date and time · `none` None
  - старые названия для поиска: «Inserted block header»
- **Line above is a heading** — `content-header-level`, `dropdown`, path `transform.inline2note.placement.headerLevel`, default `3`
  - desc: Make that line a heading you can fold, or leave it as plain text
  - tip: A heading folds, shows up in the outline, and is what you want when one note collects many entries. The number is how deep the heading sits: <code>1</code> is the biggest. You do not type the hashes yourself — this row puts them in, so the boxes below hold only the text
  - варианты: `0` Plain text · `1` 1 · `2` 2 · `3` 3 · `4` 4 · `5` 5 · `6` 6
  - видна если: `transform.inline2note.placement.headerMode`
- **Text of the line above** — `content-header-text`, `text`, path `transform.inline2note.placement.customHeader`, default `Captured`
  - desc: Typed into the note exactly as you write it here
  - tip: Just the words — hashes are added by <code>Line above is a heading</code> above, and any you type here are taken back out
  - видна если: `transform.inline2note.placement.headerMode`
- **Date format** — `content-datetime`, `text`, path `transform.inline2note.placement.datetimeFormat`, default `YYYY-MM-DD HH:mm`
  - desc: Today’s date, written the way you set out here
  - tip: <code>YYYY</code> is the year, <code>MM</code> the month, <code>DD</code> the day, and <code>HH mm ss</code> the time. Anything else you type is kept as it is, so <code>YYYY-MM-DD</code> gives you <b>2026-08-21</b>. Whether that line is a heading is decided by <code>Line above is a heading</code> above
  - видна если: `transform.inline2note.placement.headerMode`
  - старые названия для поиска: «Datetime header format»

#### Source line — `source-line` (вкладка `transform`)

_Intro:_ What happens to the line you pressed on, once the note is safely written

_Tip:_ The note is written first, and only then is your line touched, so nothing is lost if the writing fails. Two things can happen to it: the plugin swaps your text for a link to the new note and adds a marker of your choosing so you can see at a glance that this line has already been filed. Both are optional, but leaving both off means the line looks untouched and you can press again by mistake and get a second note

- **`source-preview`** — свой блок, рендерер `renderSourcePreview`
- **Sub-lines (tree) behavior** — `content-sublines`, `dropdown`, path `transform.inline2note.sublines`, default `stay`
  - desc: Leave them where they are, or take them into the note too
  - tip: Say the line has three sub-points under it. <b>Move</b> moves all four into the note and leaves the place they came from empty. <b>Keep</b> moves only the line you pressed on
  - варианты: `stay` Keep · `remove` Move
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «Sublines behavior»
- **What happens with current line** — `source-text`, `dropdown`, path `transform.inline2note.sourceProcessing.text`, default `remove`
  - desc: The text goes into the note either way — this is about the line you pressed on
  - tip: <b>Remove</b> leaves the line short and tidy, and with the link below it still points at what you wrote. <b>Keep</b> keeps the line readable on its own — useful when the note is an addition, not a move, and it is the one choice that keeps every word, including the words the name was made of. <b>Keep without name</b> keeps the rest of your text and lets the link stand where the name came from, so nothing is said twice. <b>Keep first words</b> does the same and trims what is left to the number of words below. Sub-lines are a separate question, and the row above answers it
  - варианты: `remove` Remove · `leave` Keep · `leave_named` Keep without name · `words` Keep first words
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «What happens to your text»
- **Words to keep** — `source-keep-words`, `number`, path `transform.inline2note.sourceProcessing.keepWords`, default `3`
  - desc: How much of the line stays behind
  - tip: Counted from what is left of your text once the words that became the note name are gone — the link to the note stands where they were. The rest goes into the note and leaves the line. A line whose whole text became the name keeps the link alone: there is nothing left to count
  - диапазон: 1–20, шаг 1
  - видна если: `transform.inline2note.sourceProcessing.text`
- **Fields to keep** — `source-fields-head`, `note`
  - desc: Which Fields stay on the line you pressed on
  - tip: Everything you tick here is left behind on the line; everything you do not goes into the note with the text. A Field you keep is still written into the note as well — keeping it does not take it away from the note, it only leaves a copy where you were. Ticking nothing leaves the line with your text and the marker and nothing else
  - видна если: `transform.inline2note.enabled`
- **`source-fields`** — свой блок, рендерер `renderSourceFields`
- **Keep sub-fields** — `source-keep-sub`, `toggle`, path `transform.inline2note.sourceProcessing.keepSubFields`, default `false`
  - desc: A Field you keep keeps its child Values on the line too
  - tip: A child Field has no row of its own in the list above: it follows its parent. Off, a kept Field stays on the line and its child Values go into the note. On, they stay on the line with it, and a copy still goes into the note, the same as the kept Field itself
  - видна если: `transform.inline2note.enabled`
- **Insert wikilink in current line** — `source-link`, `toggle`, path `transform.inline2note.sourceProcessing.replaceWithLink`, default `true`
  - desc: Put a link to the new note on the line you pressed on
  - tip: On, the line keeps a pointer: click the link and you are in the note. Off with the text taken away, nothing on the line says where it went — and you can press again by mistake and get a second note. The marker below is the usual way to guard against that
  - старые названия для поиска: «Replace payload with note link», «Leave a link behind»
- **Mark transformed line** — `source-marker`, `text`, path `transform.inline2note.sourceProcessing.token`, default `#processed`
  - desc: A word or tag added to the line so you can see it has been handled
  - tip: Type something like <code>#moved</code>. Afterwards you can search for it to find everything you have filed, or hide those lines from a list of things still to do. Leave the box empty and nothing is added
  - старые названия для поиска: «Processed token», «Mark the line as done»
- **Where the mark goes** — `source-marker-position`, `dropdown`, path `transform.inline2note.sourceProcessing.panel`, default `right`
  - desc: Before your text, or after it
  - tip: The mark says the line has already been turned into a note, so the next run does not do it twice. Which end it goes to is a matter of reading: the Left Block puts it with the tags, the Right Block keeps your sentence first
  - варианты: `left` Left Block · `right` Right Block
  - видна если: `transform.inline2note.sourceProcessing.token`
  - старые названия для поиска: «Processed token panel»
- **Dim transformed line** — `source-dim`, `toggle`, path `transform.inline2note.sourceProcessing.visual.enabled`, default `false`
  - desc: Fade a line once it carries the mark above, so your eye skips it
  - tip: A page you have worked through fills up with lines that <code>Inline to note</code> has already taken, and they still read as loudly as the rest. Faded, they stay where they are — you can find them, search them, undo them — but stop competing for attention. Only the look changes: nothing is written into the note, and taking the mark off a line by hand brings it back to full strength
  - видна если: `transform.inline2note.sourceProcessing.token`
  - старые названия для поиска: «Dim the lines already filed»
- **Opacity of transformed line** — `source-dim-opacity`, `slider`, path `transform.inline2note.sourceProcessing.visual.opacity`, default `65`
  - desc: Zero leaves the line as it is, eighty makes it barely readable
  - tip: How far the line fades. It is only a look: the text stays whole, search still finds it, and <code>Undo</code> still works. Pick as little as lets your eye skip the line — too much and you stop noticing a line you still have to fix
  - диапазон: 0–80, шаг 5, ед. %
  - видна если: `transform.inline2note.sourceProcessing.token, transform.inline2note.sourceProcessing.visual.enabled`
  - старые названия для поиска: «How much is left»
- **Color of transformed line** — `source-dim-color`, `color`, path `transform.inline2note.sourceProcessing.visual.color`, default `""`
  - desc: Leave it unset to keep the color your theme gives the text
  - tip: Set this only if fading alone is not enough to tell a taken line at a glance. A color of your own is read instead of the theme one, and the fade above still applies to it
  - видна если: `transform.inline2note.sourceProcessing.token, transform.inline2note.sourceProcessing.visual.enabled`
  - старые названия для поиска: «Color of a filed line»

#### Auto-MOC in your links — `backlinks` (вкладка `transform`)

_Intro:_ A line that points at other notes can leave a pointer back in each of them

_Tip:_ A line often names the notes it belongs to — a project, a person, a place. Turn it into a note and those notes learn nothing about it. With this on, each of them gets a link to the new note, so the project note slowly becomes a list of everything filed under it without you keeping that list by hand. Only a link that is a Value of a Field counts: a link you typed inside your own sentence is your word, and nothing is written into it

- **Link the notes you mention** — `backlink-enabled`, `toggle`, path `transform.inline2note.backlink.enabled`, default `false`
  - desc: Write a link to the new note into every note this line points at
  - tip: The link is written with the full path, so it points at the right note even when two notes share a name. A note that does not exist yet is created empty and gets the link. Nothing is written twice: a note that already links to the new one is left alone
  - старые названия для поиска: «Create wikilink to transformed note in reference notes», «Backlinks into the notes you mention», «Automatic MOC»
- **Link to Navigator** — `backlink-navigator`, `toggle`, path `transform.inline2note.backlink.navigator`, default `false`
  - desc: Also write the link into the navigator note of a child link
  - tip: A child link whose parent is a navigator stands on the line alone: the navigator is never written there. With this on, the navigator note gets the link too, and a child under two navigators links from both. A navigator note that does not exist yet is created empty. A Tag navigator is not a note, so nothing is written for it
  - видна если: `transform.inline2note.backlink.enabled`
- **Where to put the link** — `backlink-position`, `dropdown`, path `transform.inline2note.backlink.placement.position`, default `end`
  - desc: At the top of that note, or after whatever is already there
  - tip: <b>End</b> keeps the links in the order you filed them, which is what a growing list wants. <b>Under heading</b> is for a note laid out in sections: name the heading below and every link lands at the end of that section
  - варианты: `beginning` Beginning · `end` End · `custom-header` Under heading
  - видна если: `transform.inline2note.backlink.enabled`
  - старые названия для поиска: «Where the backlink goes»
- **Name of the heading** — `backlink-target-header`, `text`, path `transform.inline2note.backlink.placement.targetHeader`, default `""`
  - desc: The heading the link is filed under
  - tip: Write the heading as it stands in the note. Put the hashes in — <code>## Log</code> — and only a heading of that depth counts; leave them out and a heading of any depth with those words will do. Upper and lower case do not matter. When a note has no such heading it gets written for you, at the depth you put here — no hashes means one
  - видна если: `transform.inline2note.backlink.enabled, transform.inline2note.backlink.placement.position`
- **If heading not found** — `backlink-header-missing`, `dropdown`, path `transform.inline2note.backlink.placement.fallback`, default `end`
  - desc: Where the heading is added when that note has none
  - tip: A note that has not been laid out yet has no such heading — so the heading is written for you here, and the link goes under it. It is written exactly as you named it above, hashes and all, so the next link finds it and joins the same section
  - варианты: `beginning` Beginning · `end` End
  - видна если: `transform.inline2note.backlink.enabled, transform.inline2note.backlink.placement.position`

#### Smart Rules — `smart-rules` (вкладка `transform`)

_Intro:_ Different kinds of line deserve different notes. A rule spots a kind of line and picks the template for it

_Tip:_ Rules are read from the top, the first one that fits is used, and anything that fits none of them gets the default template. So put your narrow rules above your broad ones, or the broad one will answer first. Drag a rule by its handle to change which one is tried first

- **`smart-rules-list`** — свой блок, рендерер `renderSmartRules`

#### Before you start — `visual-intro` (вкладка `visual`)

- **`visual-callout`** — свой блок, рендерер `renderTabCallout`

#### Inline appearance — `tag-appearance` (вкладка `visual`)

_Intro:_ How a tagged line looks while you write. Tags are drawn as small colored bubbles; links and dates stay ordinary text. Nothing here changes a single character in your file

_Tip:_ Everything in this block is drawing only: the file on disk is the same either way, and the line reads normally anywhere else. The two <b>opacity</b> rows fade the Blocks on each side of your text so the text itself stands out — they reach the tags, the dates and the links, and stop at the text between the Separators, because that part is yours. <b>Line view</b> below them is about the Blocks as a whole — how big each one is written, and the Stripe behind it; <b>Tag view</b> is about the bubble a tag is drawn in. <b>Color the Block with Stripe</b> puts a Stripe behind each of them, from its first Value to its last, so the two are visible at a glance. Colors of individual Values live with the Field that offers them, on the <code>Tags & PKM</code> tab

- **`tag-preview`** — свой блок, рендерер `renderTagPreview`
- **`line-view-sub`** — свой блок, рендерер `?`
- **Opacity of the Left Block** — `tags-opacity-left`, `slider`, path `visual.tags.opacityLeft`, default `100`
  - desc: Dims everything written before your text, tags and elements alike
  - tip: Dimming is not hiding: at 0 the Left Block is still on the line, still searchable and still moved by the commands — it just steps out of the way while you read. Most people take it down a little so the sentence leads and the tags follow
  - диапазон: 0–100, шаг 1, ед. %
  - см. также: `field-editor` — Tag colors are set per Value under Fields
  - старые названия для поиска: «Opacity Left»
- **Opacity of the Right Block** — `tags-opacity-right`, `slider`, path `visual.tags.opacityRight`, default `100`
  - desc: Dims everything written after your text, tags and elements alike
  - tip: The same dial for the other end of the line, and it is separate on purpose: dates and links after your text are usually worth less attention than the tags before it. At 0 everything after your text is still there and still works
  - диапазон: 0–100, шаг 1, ед. %
  - старые названия для поиска: «Opacity Right»
- **Left Block text size** — `tags-text-size-left`, `slider`, path `visual.tags.textSizePctLeft`, default `100`
  - desc: How big everything before your text is written, next to the rest of your note
  - tip: This reaches the whole of the Left Block, not the tags alone: the writing in the bubbles, the dates and the links all change together. Your own text between the Separators keeps its size. Below 100 the Block steps back and your sentence leads; above 100 it competes with it. Whatever the number, what is written in the Block stays in the middle of the line rather than sinking to its bottom
  - диапазон: 50–140, шаг 5, ед. %
  - старые названия для поиска: «Tag text size», «Text size Left»
- **Right Block text size** — `tags-text-size-right`, `slider`, path `visual.tags.textSizePctRight`, default `100`
  - desc: How big everything after your text is written, next to the rest of your note
  - tip: The same dial for the other end of the line, and it is separate on purpose: dates and links after your text usually read better a size down, while the tags before it stay as they are. Your own text between the Separators keeps its size either way, and what is written in the Block stays in the middle of the line
  - диапазон: 50–140, шаг 5, ед. %
  - старые названия для поиска: «Tag text size», «Text size Right»
- **Color the Block with Stripe** — `tags-block-fill`, `toggle`, path `visual.tags.blockFill.enabled`, default `false`
  - desc: A Stripe behind the Left Block and the Right Block, so the two stand out from your text
  - tip: The Stripe runs from the first Value of a Block to its last one, and stops there: your own text between the Separators keeps the page background. A Block with nothing in it gets no Stripe. The Stripe sits <b>behind</b> the writing, so everything on the line stays selectable and clickable. Tag bubbles carry their own color, so a Block of one tag would hide the Stripe completely — the two rows at the bottom are how far it reaches past the writing, and that is what makes it show at all
  - старые названия для поиска: «Block background», «Color the Blocks»
- **Stripe direction** — `tags-block-fill-direction`, `dropdown`, path `visual.tags.blockFill.direction`, default `both`
  - desc: Which of the two Blocks gets a Stripe
  - tip: <code>Both</code> puts a Stripe behind each Block, and that is the usual choice. <code>Left</code> and <code>Right</code> leave it on one side only — useful when one of the two Blocks is the one you read and the other is bookkeeping. A Block with nothing in it gets no Stripe whatever is chosen here, and your own text between the Separators is never touched
  - варианты: `left` Left · `right` Right · `both` Both
  - видна если: `visual.tags.blockFill.enabled`
- **Stripe color** — `tags-block-fill-color`, `color`, path `visual.tags.blockFill.color`, default `""`
  - desc: Leave it unset and the Stripe follows your theme
  - tip: Unset means the accent color of whatever theme you are using, so the Stripe keeps looking right when you change themes. Pick a color here only when you want a particular one
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Block color»
- **Stripe opacity** — `tags-block-fill-opacity`, `slider`, path `visual.tags.blockFill.opacity`, default `12`
  - desc: How strongly the Stripe shows through
  - tip: Low numbers are the point: the Stripe is there to catch the eye, not to be read. Around a tenth is enough to see where a Block begins and ends without fighting the writing on top of it
  - диапазон: 0–100, шаг 1, ед. %
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Block color strength»
- **Stripe height** — `tags-block-fill-height`, `slider`, path `visual.tags.blockFill.heightPct`, default `60`
  - desc: How far the Stripe reaches above and below the writing
  - tip: The scale has two landmarks. At <code>0</code> the Stripe is exactly as tall as the writing — and a tag bubble has its own color, so a Block of one tag would hide it. At <code>100</code> it fills the line it belongs to, so the Stripes of two neighboring lines meet and never overlap. In between it takes that much of the room the line has left, which is why every step moves the Stripe on any theme, whatever its line spacing
  - диапазон: 0–100, шаг 20, ед. %
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Band height»
- **Stripe width** — `tags-block-fill-width`, `slider`, path `visual.tags.blockFill.widthPct`, default `50`
  - desc: How far the Stripe reaches past the Block on both of its sides
  - tip: The scale has three landmarks. At <code>0</code> the Stripe starts on the first Value of the Block and ends on the last one. At <code>50</code> it touches the Separator on the inner side, and steps out by the same distance on the other. At <code>100</code> it takes the Separator in as well. The Left Block is the one exception: it never reaches onto the bullet or the checkbox, whatever the number says
  - диапазон: 0–100, шаг 5, ед. %
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Band width»
- **`tag-view-sub`** — свой блок, рендерер `?`
- **Tag bubble width** — `tags-bubble-width`, `slider`, path `visual.tags.bubbleWidthPct`, default `100`
  - desc: How much breathing room there is either side of the word
  - tip: This is the padding either side of the word, not the word itself: the writing keeps its size, the bubble around it grows. At the bottom of the scale the word starts almost at the edge of the bubble; above 100 the bubbles read as separate chips even in a crowded Block
  - диапазон: 20–140, шаг 5, ед. %
  - старые названия для поиска: «Tag bubble size - width», «Bubble width»
- **Tag bubble height** — `tags-bubble-height`, `slider`, path `visual.tags.bubbleHeightPct`, default `100`
  - desc: How tall the bubble is around the word
  - tip: Keep this modest: a tall bubble pushes the lines of your note apart and the page starts to feel airy in a way that is hard to read. At the bottom of the scale the bubble closes in on the word from above and below
  - диапазон: 20–140, шаг 5, ед. %
  - старые названия для поиска: «Tag bubble size - height», «Bubble height»
- **Tag bubble corners** — `tags-corners`, `slider`, path `visual.tags.cornersPct`, default `0`
  - desc: Slide from fully rounded to completely square
  - tip: At 0 the bubble is a pill, at 100 a rectangle. Nothing else changes — the same color, the same padding, the same size of writing. Square corners read as denser and pair well with narrow bubbles
  - диапазон: 0–100, шаг 1
  - старые названия для поиска: «Tag shape», «Bubble corners»
- **Empty tag bubble width** — `tags-empty-bubble`, `slider`, path `visual.tags.emptyBubblePct`, default `100`
  - desc: Width of a bubble whose <code>Show</code> is set to <code>empty</code>
  - tip: Under <code>Fields</code> you can set a Value to <code>empty</code>, which draws its color but no text — a marker instead of a word. This is how wide that marker gets
  - диапазон: 10–180, шаг 5, ед. %
  - см. также: `field-editor` — Set a Value to empty under Fields
  - старые названия для поиска: «Empty bubble size», «Empty bubble width»
- **`link-view-sub`** — свой блок, рендерер `?`
- **Preview on hover** — `link-hover-preview`, `toggle`, path `visual.tags.linkShown.hoverPreview`, default `false`
  - desc: Hovering a Value shown as your own text opens the page preview — hold <code>Ctrl</code> while hovering
  - tip: <b>Hold <code>Ctrl</code></b> (<code>Cmd</code> on macOS) while the pointer rests on the Value: that is how Obsidian’s own <code>Page preview</code> is set up for the editor out of the box, and the plugin opens the preview the same way, so that setting decides here too. Turn off the modifier for <code>Page preview → Source mode</code> and hovering alone opens the preview here too. Off by default, because the Value was replaced to be short — and a preview opening over a line you are writing is not always welcome
  - старые названия для поиска: «Link hover preview», «Custom link preview»
- **Drag to move** — `link-draggable`, `toggle`, path `visual.tags.linkShown.draggable`, default `false`
  - desc: Drag a Value shown as your own text into another note
  - tip: Press the Value and drag it where you want it: the drop makes a link to the same note, because the plugin hands Obsidian the same link text an ordinary link would. Off by default — a draggable Value is easy to pick up by accident while selecting a line — and while it is on, a press on the Value starts a drag rather than putting the cursor there
  - старые названия для поиска: «Link drag», «Custom link drag»
- **Link target color** — `link-target-color`, `color`, path `visual.tags.linkAsWritten.targetColor`, default `""`
  - desc: What you read in a wikilink: the name between <code>[[</code> and <code>]]</code>
  - tip: This paints the name you read between the brackets of a wikilink — a Value of a link Field left on <code>Show</code> = <code>default</code>. Hyperlinks have their own two rows below. Empty means the color your theme gives a link, and nothing is painted at all
  - старые названия для поиска: «Link color», «Wikilink color», «Link text color»
- **Link brackets color** — `link-brackets-color`, `color`, path `visual.tags.linkAsWritten.bracketsColor`, default `""`
  - desc: The markup around it: <code>[[</code> and <code>]]</code>
  - tip: The markup is the other half of a wikilink, and this colors it apart from the name you read: <code>[[</code> and <code>]]</code>. <b>Where you see it:</b> in the previews of this group, and in your note on the line the cursor is on. Everywhere else Obsidian takes that markup off the screen itself while you are not editing that line, and a color has nothing to paint. Empty means the color your theme gives it
  - старые названия для поиска: «Bracket color», «Wikilink brackets»
- **Hyperlink target color** — `hyperlink-target-color`, `color`, path `visual.tags.hyperlink.targetColor`, default `""`
  - desc: The text you read in a Markdown link — what stands between the square brackets
  - tip: A hyperlink is any link that is not a wikilink: <code>[a link](an address)</code> and an address written on its own. This paints the text of the first kind — what stands between the square brackets. <b>Addresses are the row below:</b> both the one inside the round brackets and one written on its own take <code>Hyperlink address color</code>. It works in every note, not only in lines the plugin looks after. A link inside backticks is code, not a link, and an image is not one either. Empty means the color your theme gives a link, and nothing is painted at all
  - старые названия для поиска: «Hyperlink color», «External link color», «URL color»
- **Hyperlink brackets color** — `hyperlink-brackets-color`, `color`, path `visual.tags.hyperlink.bracketsColor`, default `""`
  - desc: The markup around it: the square brackets and the round ones, without the address
  - tip: The brackets of <code>[a link](an address)</code> and nothing else: <code>[</code>, <code>](</code> and <code>)</code>. The address between the round ones has a row of its own below. A bare address has no markup at all, so this leaves it alone. <b>Where you see it:</b> in the preview below and in your note on the line the cursor is on — everywhere else Obsidian takes the markup off the screen itself. Empty means the color your theme gives it
  - старые названия для поиска: «Hyperlink brackets», «URL markup color», «Address color»
- **Hyperlink address color** — `hyperlink-address-color`, `color`, path `visual.tags.hyperlink.addressColor`, default `""`
  - desc: The address itself — inside the round brackets, or written on its own
  - tip: Every address takes this one: the one inside <code>[a link](an address)</code> and one written on its own — <code>https://…</code> or <code>www.…</code>. Painted apart from the brackets around it and from the text you read. <b>Where you see it:</b> in the preview below, and in your note — an address of its own always, the one in round brackets on the line the cursor is on. Empty means the color your theme gives it
  - старые названия для поиска: «Address color», «URL color», «Link href color»
- **`link-preview`** — свой блок, рендерер `renderLinkPreview`

#### Tag Bars — `tag-bars` (вкладка `visual`)

_Intro:_ A colored Bar in the margin, so you can see at a glance what a whole block of lines is about without reading their tags. The Bar runs down the side of the line and everything nested under it

_Tip:_ Bars are drawn from the colors of one Field, and you pick which one below. Only a tag Field can do it: the color of a Bar is the color of a Value, and links and dates have none. A Bar belongs to the line that carries the Value and runs the full height of that line and everything nested under it; a deeper line with a Value of its own gets its own Bar in the next lane along, so the number of lanes follows how deep your lists go. Bars sit in the margin, so the text column never moves, and you can hide the tag itself once its Bar says the same thing

- **`bars-preview`** — свой блок, рендерер `renderBarsPreview`
- **Tag Bars** — `bars-active`, `toggle`, path `visual.tagBars.active`, default `false`
  - desc: Draw the Bars
  - tip: The Bars are drawn to the left of the line and say, without a word of text, which Value it carries and how deep it sits in the list. They read the colors you gave the Values of one Field — the row below picks which — so nothing has to be colored twice. Off, nothing is drawn and the settings under it are kept
  - старые названия для поиска: «Activate strip», «Strip», «Hierarchy Bars», «Level Bars»
- **Which Field draws Bars** — `bars-field`, `dropdown`, path `visual.tagBars.fieldId`, default `""`
  - desc: Bars work with tag Fields only, and only for the one chosen here
  - tip: Pick the one thing you scan a page for — usually how far along something is, or how urgent it is. The list is your own tag Fields: a Field of another type has no Value color, and a Bar is drawn in the color of the Value. Switch between Fields and the Bars in the preview above change shape, not just color, because different lines carry different Fields
  - варианты: `` None
  - видна если: `visual.tagBars.active`
  - см. также: `field-editor` — Bar colors are the Value colors under Fields
  - старые названия для поиска: «Strip Field»
- **Number of Bars** — `bars-count`, `slider`, path `visual.tagBars.stripesToShow`, default `2`
  - desc: How far down the nesting to keep drawing them
  - tip: At 1 only the parent line gets a Bar, however deep the tree goes. At 2 a child with a Value of its own gets a second Bar beside the first. At 3 a grandchild gets a third. A line with no Value never gets one
  - диапазон: 1–3, шаг 1
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Stripes to show»
- **Show the Field’s tag** — `bars-show-tag`, `toggle`, path `visual.tagBars.tagVisibility`, default `true`
  - desc: Keep the tag on the line, or let the Bar speak for it
  - tip: With the Bar already showing you the Value by color, the tag itself is often redundant. Hiding it buys back room on the line; the text stays in your note and stays searchable
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip tag visibility»
- **Hide the leftover marker** — `bars-hide-separator`, `toggle`, path `visual.tagBars.hideSeparatorWhenOnlyStripToken`, default `false`
  - desc: Tidy away a Separator that has nothing left beside it
  - tip: If the hidden tag was the only thing in front of your text, the line is left starting with a bare Separator and nothing before it. This clears that up
  - видна если: `visual.tagBars.active, visual.tagBars.tagVisibility`
  - старые названия для поиска: «Hide Separator?»
- **Bar arrangement** — `bars-mode`, `dropdown`, path `visual.tagBars.mode`, default `default`
  - desc: Which lane each level of the tree draws its Bar in
  - tip: Bars are drawn in lanes, one per level, left to right. With <b>parent keeps the outer lane</b> the top line of a tree always owns the leftmost lane, its child the next one in, and so on — so a lane always means the same depth, and you can read nesting by counting from the left. With <b>lanes rotate</b> each new level takes the next lane round in turn, which keeps deep trees narrower but means a lane no longer tells you the depth
  - варианты: `default` Parent outside · `crossing` Rotate
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip mode»
- **Bar thickness** — `bars-thickness`, `slider`, path `visual.tagBars.thickness`, default `2`
  - desc: How wide each Bar is
  - tip: One number for every Bar: they are read as a group, and a group of different widths reads as a mistake. Thin lines suit a dense note; wide ones are easier to tell apart when your Values are close in color
  - диапазон: 1–12, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip thickness»
- **Space between Bars** — `bars-gap`, `slider`, path `visual.tagBars.childOffset`, default `12`
  - desc: The gap between one level and the next
  - tip: Each level of the list gets its own lane, and this is the empty space between two lanes. Tight spacing makes a deep list read as one ribbon; wide spacing keeps the levels apart but takes room from the text
  - диапазон: 2–20, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Parent/child strip distance»
- **Distance from the text** — `bars-distance`, `slider`, path `visual.tagBars.spacing`, default `20`
  - desc: How far the Bars sit from where your line begins
  - tip: The whole group of Bars moves together, away from where your text begins. Give it room if your notes are indented and the Bars crowd the list markers
  - диапазон: 8–48, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip spacing»
- **Vertical gap between Bars** — `bars-line-gap`, `slider`, path `visual.tagBars.lineGap`, default `2`
  - desc: Blank left above and below a Bar, so two lines in a row stay apart
  - tip: Without a gap, two lines one under the other give one unbroken Bar, and there is no telling which line owns which part of it. A small gap draws that boundary. The number is the blank above and below, so a bigger number means a shorter Bar; at <code>0</code> the Bars meet again
  - диапазон: 0–8, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Bar height»
- **Bars for the whole tree** — `bars-whole-tree`, `toggle`, path `visual.tagBars.drawWholeTree`, default `true`
  - desc: A Bar runs down everything nested under its line, not just the line itself
  - tip: On, a line with a Value draws its Bar down its own line and everything indented under it, and a deeper line with a Value of its own adds a Bar in the next lane along — so a nested line can carry several. Off, a Bar belongs to one line and nothing is inherited: a line without a Value of its own gets none at all, and <code>Join Bars in a tree</code> below has nothing left to join
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Draw bars for the whole tree», «Bars for subtree»
- **Join Bars in a tree** — `bars-join-tree`, `toggle`, path `visual.tagBars.joinTree`, default `true`
  - desc: A parent and its own children draw one unbroken Bar
  - tip: The gap that keeps two neighboring lines apart also cuts the Bar of a tree, where it stands for one thing running down through the nesting. With this on, the gap is dropped wherever a Bar carries on from a parent into its own children, and kept between lines that have nothing to do with each other
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Tree gap»

#### tagWheel — `tagwheel` (вкладка `visual`)

_Intro:_ tagWheel opens over the line and lays your Fields out across it, with the Values of the Field you are on running down

_Tip:_ Every Field has its own pair of cycle commands, and one key each adds up to more keys than anyone remembers. tagWheel is the way round that: one command opens a picker over the line, with your Fields laid out across it and the Values of the Field you are on running down it, so you choose by looking instead of by memory. Steer it with the arrow keys: left and right move between Fields, up and down between that Field’s Values. <code>Tab</code> jumps across to the Fields on the other side of your text, and <code>Escape</code> closes it without changing anything. The settings below decide how the picker looks, and whether the neighboring Values stay in sight as you move

- **`wheel-preview`** — свой блок, рендерер `renderWheelPreview`
- **`panel-sub`** — свой блок, рендерер `?`
- **Show tag markers** — `panel-markers`, `toggle`, path `visual.tagWheel.showMarkers`, default `true`
  - desc: Show the hash and emoji in the picker, or just the words
  - tip: A column of words reads faster than a column of words with hashes in front. What actually goes into your note is the same either way
  - старые названия для поиска: «Show Prefix»
- **tagWheel Value names** — `panel-value-names`, `dropdown`, path `visual.tagWheel.valueNames`, default `default`
  - desc: What the picker prints for a Field that already carries a Value
  - tip: A Field that already carries a Value shows that Value in the picker. <code>Default</code> shows it the way it goes into your line, marks and all. <code>Custom</code> shows the custom text set for the Value under Fields (<code>Show</code> = <code>custom</code>) — an emoji, a short word. <code>Custom + default</code> shows both, the custom text first. Where no custom text is given, all three print the written Value, so a Field never goes blank
  - варианты: `default` Default · `custom` Custom · `both` Custom + default
  - старые названия для поиска: «Value names», «Custom text in the picker», «Printed name»
- **Highlight the tagWheel line** — `panel-highlight`, `toggle`, path `visual.tagWheel.highlightLine`, default `true`
  - desc: Mark the line while the picker is open, so it stands out from the page
  - tip: tagWheel draws itself over the line you are on, and on a busy page it is not always clear where the picker ends and your note begins. On, the line is wrapped in <code>==</code> for as long as the picker is open, and that is what paints it: <code>Background color</code> below gives the color, and without one Obsidian uses its own highlight. The marks belong to the picker, not to your line — they leave with it, and nothing stays behind in the note
  - старые названия для поиска: «Highlight the line»
- **Inactive Field text color** — `panel-text-color`, `color`, path `visual.tagWheel.textColor`, default `""`
  - desc: The color of the Field names you are not standing on, while the line is marked
  - tip: This paints the picker drawn over your line, and only while <code>Highlight the tagWheel line</code> is on: without the marks there is nothing to paint. The scroller box below takes its colors from your theme and is not affected
  - старые названия для поиска: «Text color»
- **Active Field text color** — `panel-active-color`, `color`, path `visual.tagWheel.activeTextColor`, default `""`
  - desc: The color of the Field you are on, while the line is marked
  - tip: The Field you are standing in is the one the up and down keys move through. Without its own color it differs from the rest only by weight, and on a line with many Fields that is easy to lose. Empty means it takes <code>Inactive Field text color</code> like the others
  - старые названия для поиска: «Current Field color»
- **Chosen Value text color** — `panel-chosen-color`, `color`, path `visual.tagWheel.chosenValueColor`, default `""`
  - desc: The color of a Field that already carries a Value, while the line is marked
  - tip: A Field you are not standing on shows either its own name or the Value you gave it, and without this color both are painted the same. Give the Value a color of its own and one glance tells you which Fields on this line are already filled in. Empty means it takes <code>Inactive Field text color</code>. The Field you are standing on has its own row above
  - старые названия для поиска: «Chosen value color», «Picked value color»
- **Background color** — `panel-background`, `color`, path `visual.tagWheel.fillColor`, default `""`
  - desc: The color behind the picker, while the line is marked
  - tip: Pick something solid enough to read against your note, since the picker is drawn on top of your text. Like <code>Inactive Field text color</code>, it needs <code>Highlight the tagWheel line</code> on: the marks are what carry the color
  - старые названия для поиска: «Background»
- **`scroller-sub`** — свой блок, рендерер `?`
- **Scroller** — `scroller-enabled`, `toggle`, path `visual.tagWheel.scroller.enabled`, default `false`
  - desc: Show the next and previous Values around the current one
  - tip: Off, you see only where you are and step blindly. On, you see what is coming, which makes a long list much quicker to work through
  - старые названия для поиска: «tagWheel Scroller»
- **Scroller opening direction** — `scroller-direction`, `dropdown`, path `visual.tagWheel.scroller.direction`, default `full`
  - desc: Which way the Values unroll from the Field you are on
  - tip: The scroller shows the Values around the one you are on. <code>Up</code> keeps your line at the bottom of it and your note visible below; <code>Down</code> does the opposite. <code>Both</code> centers the current Value and is easiest to read when a Field has many Values
  - варианты: `up` Up · `down` Down · `full` Both
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller direction», «Opens»
- **Scroller Value names** — `scroller-labels`, `dropdown`, path `visual.tagWheel.scroller.labels`, default `value`
  - desc: What the box shows for each neighboring Value
  - tip: <code>Default</code> shows the Value the way it goes into your line, marks and all. <code>Custom</code> shows the custom text set for the Value under Fields (<code>Show</code> = <code>custom</code>) — an emoji, a short word. <code>Custom + default</code> shows both, the custom text first. Where no custom text is given, all three print the written Value, so a Value never goes blank
  - варианты: `value` Default · `custom` Custom · `both` Custom + default
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller names», «Custom text in the scroller», «Printed name», «As written», «Custom text when set»
- **Scroller background color** — `scroller-fill`, `color`, path `visual.tagWheel.scroller.fillColor`, default `""`
  - desc: The color behind the box of neighboring Values
  - tip: Leave it empty and the box takes the color your theme gives a popover. Set it and the box stands out from the note even where the theme is pale
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller background»
- **Scroller text color** — `scroller-text`, `color`, path `visual.tagWheel.scroller.textColor`, default `""`
  - desc: The color of the Values you are not on, inside the box
  - tip: Empty means the color your theme gives ordinary text. The Value you are standing on is not in the box at all — it is drawn in the line itself, and <code>Active Field text color</code> above is what paints it
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller text»
- **Scroller size** — `scroller-size`, `slider`, path `visual.tagWheel.scroller.size`, default `3`
  - desc: How many neighboring Values stay visible around the current one
  - tip: How many neighbors are shown on each side, not in total. A small number keeps the scroller out of the way; a large one lets you see the whole set of a short Field at once. It never shows more than the Field has
  - диапазон: 1–20, шаг 1
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Values per side»

#### Text cursor — `text-cursor` (вкладка `visual`)

_Intro:_ The blinking line that shows where your typing will land. Give it a color of its own and it stops disappearing into the page

_Tip:_ Obsidian draws the caret in the color of your text, which is the color everything else on the page already is. In a long note, or in a theme built on one shade, that makes it easy to lose and easy to leave behind. Pick a color that appears nowhere else in your writing and you can find the caret at a glance. This is the caret in your notes only: the boxes in this window and in the search box keep the one they had

- **Color the text cursor** — `caret-enabled`, `toggle`, path `visual.caret.enabled`, default `false`
  - desc: Draw the blinking caret in a color you pick instead of the color of your text
  - tip: Off, the caret is whatever your theme makes it. On, the color below takes over, and only in the editor
  - старые названия для поиска: «Caret color», «Cursor color»
- **Cursor color** — `caret-color`, `color`, path `visual.caret.color`, default `""`
  - desc: The color of the blinking caret in your notes
  - tip: Empty means the color your theme gives the caret. A color that stands well apart from your text is the whole point of this: something the page does not already use
  - видна если: `visual.caret.enabled`
  - старые названия для поиска: «Caret»
- **Shape the text cursor** — `caret-shape`, `toggle`, path `visual.caret.shapeEnabled`, default `false`
  - desc: Set how thick the caret is and how fast it blinks, instead of taking both from your theme
  - tip: Separate from the color above, and neither needs the other. Off, the caret keeps the thickness and the blinking your theme and Obsidian give it
  - старые названия для поиска: «Caret width», «Cursor blink», «Caret thickness»
- **Cursor width** — `caret-width`, `slider`, path `visual.caret.width`, default `2`
  - desc: How thick the caret is drawn, in pixels
  - tip: Obsidian draws it a little over one pixel wide, which disappears on a bright background and on a large screen. Two or three is enough to find it without it reading as a selection
  - диапазон: 1–8, шаг 1, ед. px
  - видна если: `visual.caret.shapeEnabled`
  - старые названия для поиска: «Caret thickness»
- **Blink speed** — `caret-blink`, `slider`, path `visual.caret.blinkSpeed`, default `5`
  - desc: How fast the caret blinks, from not blinking at all to very fast
  - tip: At <code>0</code> the caret stops blinking and simply stays where it is, which is the quietest a cursor gets. <code>5</code> is the speed Obsidian uses now, and every step up from there is quicker
  - диапазон: 0–10, шаг 1
  - видна если: `visual.caret.shapeEnabled`
  - старые названия для поиска: «Blink rate», «Cursor blinking»
- **`caret-preview`** — свой блок, рендерер `renderCaretPreview`

#### Cursor jump highlight — `jump-highlight` (вкладка `visual`)

_Intro:_ A jump throws the caret across the screen, and a thin blinking line is hard to find again. This draws a circle where it lands and lets it shrink away on its own

_Tip:_ Nothing is written into your note: the circle is drawn over it for a moment and leaves nothing behind. It marks jumps only — typing and the arrow keys are not jumps — and the last row decides whether the short hops inside one line count as jumps too

- **Highlight where you land** — `jump-flash`, `toggle`, path `visual.jumpFlash.enabled`, default `false`
  - desc: Draw a fading circle where the cursor lands, so you do not hunt for it
  - tip: A jump moves the caret somewhere else on the screen, and a thin blinking line is hard to find again. The circle is drawn over the note for a moment and shrinks away on its own: nothing is written into your file, and nothing is left behind. It appears on jumps only — typing and the arrow keys are not jumps
  - старые названия для поиска: «Flash on jump», «Highlight the jump target», «Show me where the cursor went»
- **Highlight color** — `jump-flash-color`, `color`, path `visual.jumpFlash.color`, default `""`
  - desc: Leave it unset to use the accent color of your theme
  - tip: Unset, the circle takes the accent color your theme already uses for selection and links, so it reads as part of the editor. Pick your own if the accent is too quiet against your background
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Color of the jump circle»
- **Highlight size** — `jump-flash-radius`, `slider`, path `visual.jumpFlash.radius`, default `18`
  - desc: How wide the circle is at the moment it appears
  - tip: Measured from the caret outwards. Small enough and it is no easier to spot than the caret itself; large enough and it covers the words you jumped to for as long as it lasts
  - диапазон: 6–40, шаг 1, ед. px
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Size of the jump circle»
- **How long it lasts** — `jump-flash-fade`, `slider`, path `visual.jumpFlash.fadeMs`, default `450`
  - desc: The time the circle takes to shrink and disappear
  - tip: Short is a blink that only catches the corner of your eye; long enough to read is long enough to annoy when you jump several times in a row. The row below is the other answer to that — it stops the circle appearing at all while you are jumping quickly
  - диапазон: 100–1500, шаг 50, ед. ms
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Fade speed of the jump circle»
- **Minimum time between jumps** — `jump-flash-delay`, `slider`, path `visual.jumpFlash.quietMs`, default `0`
  - desc: Jumps closer together than this get no circle at all
  - tip: Hold the key down and the circle would otherwise fire on every step, which is the opposite of helping. Set a latency and only the jump you stop on is marked. At <code>0</code> every jump gets its circle
  - диапазон: 0–1000, шаг 50, ед. ms
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Do not flash on every jump», «Quiet time»
- **Use inside current line** — `jump-flash-inline`, `toggle`, path `visual.jumpFlash.inLine`, default `false`
  - desc: Also mark the cursor when it hops between the parts of one line
  - tip: <code>Jump left</code> and <code>Jump right</code> move the caret a short way, and it is usually still where your eye is. Turn this on if you lose it on long lines too
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Flash on in-line jumps»
- **`jump-flash-preview`** — свой блок, рендерер `renderJumpFlashPreview`

#### Color custom tags — `user-tag-colors` (вкладка `visual`)

_Intro:_ Colors for tags that are not a Value of any Field in <code>Tags & PKM → Fields</code>. A tag you type straight into a line still gets a bubble, and this is where you say what that bubble looks like

_Tip:_ Every tag in a note is drawn as a bubble, whether the plugin put it there or you typed it. Each row below is one tag: the fill behind it, the color of the writing on it, and whether the bubble shows the word, the word with its hash, or nothing at all. Values of a Field take their colors from the Field, under <code>Tags & PKM</code>. Everything else — a tag you typed once, a tag another plugin put there — has no Field to belong to, and this is where it gets its look. Leave a color unset and the tag follows your theme, and keeps following it when the theme changes

- **`user-tag-list`** — свой блок, рендерер `renderUserTagColors`

### Все пути состояния

| path | kind | default |
|------|------|---------|
| `advanced.backups.autosave` | toggle | `false` |
| `advanced.backups.beforeRestore` | toggle | `true` |
| `advanced.backups.folder` | text | `inlineOverhaul/Backups` |
| `advanced.devMode.aiLog` | toggle | `true` |
| `advanced.devMode.enabled` | toggle | `false` |
| `advanced.devMode.logPath` | text | `InlineOverhaul_DevLog` |
| `advanced.showSettingIds` | toggle | `false` |
| `editor.selectAll.clearOnLast` | toggle | `false` |
| `editor.selectAll.delayMs` | slider | `700` |
| `editor.selectAll.enabled` | toggle | `false` |
| `editor.selectAll.mode` | dropdown | `line-note` |
| `editor.selectAll.useDelay` | toggle | `false` |
| `editor.smartDelete.dropPrefix` | toggle | `true` |
| `editor.smartDelete.enabled` | toggle | `false` |
| `editor.smartDelete.joinWithSpace` | toggle | `true` |
| `editor.smartDelete.onBackspace` | toggle | `false` |
| `editor.smartEnter.enabled` | toggle | `false` |
| `editor.smartEnter.newLinePrefix` | dropdown | `same` |
| `editor.smartEnter.scope` | dropdown | `line` |
| `editor.smartPaste.enabled` | toggle | `false` |
| `features.navigation.enabled` | toggle | `true` |
| `features.pkm.enabled` | toggle | `true` |
| `features.transform.enabled` | toggle | `true` |
| `features.visual.enabled` | toggle | `true` |
| `general.help.showCallouts` | toggle | `true` |
| `general.help.showTips` | toggle | `true` |
| `general.language` | dropdown | `en` |
| `navigation.jumpToHeader.centerCursor` | toggle | `true` |
| `navigation.jumpToHeader.edgeMode` | dropdown | `start-end` |
| `navigation.jumpToHeader.enabled` | toggle | `true` |
| `navigation.jumpToHeader.jumpCursorPosition` | dropdown | `section-end` |
| `navigation.jumpToHeader.jumpMode` | dropdown | `edge` |
| `navigation.jumpToHeader.viewPosition` | dropdown | `center` |
| `navigation.moveLine.crossSectionAllowed` | toggle | `true` |
| `navigation.moveLine.enabled` | toggle | `true` |
| `navigation.moveLine.headerMode` | dropdown | `move-as-line` |
| `navigation.moveLine.highlightMovedLines` | toggle | `false` |
| `navigation.moveLine.keepInView` | toggle | `true` |
| `navigation.moveLine.noSelectionMode` | dropdown | `line-only` |
| `navigation.moveLine.viewPosition` | dropdown | `center` |
| `navigation.moveSelection.indentFallbackEnabled` | toggle | `true` |
| `navigation.moveSelection.inlineBoundaryJump` | toggle | `true` |
| `navigation.moveSelection.inlineEnabled` | toggle | `true` |
| `navigation.moveSelection.inlineMoveMode` | dropdown | `auto` |
| `navigation.moveSelection.inlineWordEscape` | toggle | `false` |
| `navigation.moveSelection.onCycleEnd` | dropdown | `indent` |
| `navigation.moveSelection.prefixCyclerEnabled` | toggle | `true` |
| `navigation.moveSelection.rightCycles` | toggle | `true` |
| `navigation.navigateInline.boundaryJump` | toggle | `false` |
| `navigation.navigateInline.enabled` | toggle | `true` |
| `navigation.navigateInline.onBoundary` | dropdown | `wrap` |
| `navigation.navigateInline.stepMode` | dropdown | `word` |
| `pkm.behavior.childTagFormat` | dropdown | `separate` |
| `pkm.behavior.cursorPolicy` | dropdown | `text_end` |
| `pkm.behavior.cycleEndBehavior` | dropdown | `keep-bullet` |
| `pkm.lineFormat.separator1` | text | `||` |
| `pkm.lineFormat.separator2` | text | `||` |
| `pkm.placement.bulletInStrict` | toggle | `false` |
| `pkm.placement.fieldPrefixInsertOnly` | toggle | `true` |
| `pkm.placement.keepPrefixInsertOnly` | toggle | `true` |
| `pkm.prefixPriority.decideBy` | dropdown | `by-section` |
| `pkm.prefixPriority.fieldOrderSource` | dropdown | `manual` |
| `pkm.prefixPriority.parentOrChild` | dropdown | `subtag-over-tag` |
| `transform.inline2note.backlink.enabled` | toggle | `false` |
| `transform.inline2note.backlink.navigator` | toggle | `false` |
| `transform.inline2note.backlink.placement.fallback` | dropdown | `end` |
| `transform.inline2note.backlink.placement.position` | dropdown | `end` |
| `transform.inline2note.backlink.placement.targetHeader` | text | `""` |
| `transform.inline2note.defaultTemplate` | dropdown | `""` |
| `transform.inline2note.enabled` | toggle | `false` |
| `transform.inline2note.floatingButton` | toggle | `false` |
| `transform.inline2note.floatingButtonGap` | slider | `12` |
| `transform.inline2note.nameCollision.mode` | dropdown | `new_note` |
| `transform.inline2note.noteName.delimiters` | text | `[]` |
| `transform.inline2note.noteName.mode` | dropdown | `auto` |
| `transform.inline2note.noteName.wordCount` | number | `6` |
| `transform.inline2note.openTarget` | toggle | `false` |
| `transform.inline2note.outputFolder` | folder | `""` |
| `transform.inline2note.placement.customHeader` | text | `Captured` |
| `transform.inline2note.placement.datetimeFormat` | text | `YYYY-MM-DD HH:mm` |
| `transform.inline2note.placement.fallback` | dropdown | `end` |
| `transform.inline2note.placement.headerLevel` | dropdown | `3` |
| `transform.inline2note.placement.headerMode` | dropdown | `datetime` |
| `transform.inline2note.placement.position` | dropdown | `end` |
| `transform.inline2note.placement.targetHeader` | text | `""` |
| `transform.inline2note.sourceProcessing.keepSubFields` | toggle | `false` |
| `transform.inline2note.sourceProcessing.keepWords` | number | `3` |
| `transform.inline2note.sourceProcessing.panel` | dropdown | `right` |
| `transform.inline2note.sourceProcessing.replaceWithLink` | toggle | `true` |
| `transform.inline2note.sourceProcessing.text` | dropdown | `remove` |
| `transform.inline2note.sourceProcessing.token` | text | `#processed` |
| `transform.inline2note.sourceProcessing.visual.color` | color | `""` |
| `transform.inline2note.sourceProcessing.visual.enabled` | toggle | `false` |
| `transform.inline2note.sourceProcessing.visual.opacity` | slider | `65` |
| `transform.inline2note.sublines` | dropdown | `stay` |
| `transform.inline2note.templatesFolder` | folder | `""` |
| `visual.caret.blinkSpeed` | slider | `5` |
| `visual.caret.color` | color | `""` |
| `visual.caret.enabled` | toggle | `false` |
| `visual.caret.shapeEnabled` | toggle | `false` |
| `visual.caret.width` | slider | `2` |
| `visual.jumpFlash.color` | color | `""` |
| `visual.jumpFlash.enabled` | toggle | `false` |
| `visual.jumpFlash.fadeMs` | slider | `450` |
| `visual.jumpFlash.inLine` | toggle | `false` |
| `visual.jumpFlash.quietMs` | slider | `0` |
| `visual.jumpFlash.radius` | slider | `18` |
| `visual.tagBars.active` | toggle | `false` |
| `visual.tagBars.childOffset` | slider | `12` |
| `visual.tagBars.drawWholeTree` | toggle | `true` |
| `visual.tagBars.fieldId` | dropdown | `""` |
| `visual.tagBars.hideSeparatorWhenOnlyStripToken` | toggle | `false` |
| `visual.tagBars.joinTree` | toggle | `true` |
| `visual.tagBars.lineGap` | slider | `2` |
| `visual.tagBars.mode` | dropdown | `default` |
| `visual.tagBars.spacing` | slider | `20` |
| `visual.tagBars.stripesToShow` | slider | `2` |
| `visual.tagBars.tagVisibility` | toggle | `true` |
| `visual.tagBars.thickness` | slider | `2` |
| `visual.tags.blockFill.color` | color | `""` |
| `visual.tags.blockFill.direction` | dropdown | `both` |
| `visual.tags.blockFill.enabled` | toggle | `false` |
| `visual.tags.blockFill.heightPct` | slider | `60` |
| `visual.tags.blockFill.opacity` | slider | `12` |
| `visual.tags.blockFill.widthPct` | slider | `50` |
| `visual.tags.bubbleHeightPct` | slider | `100` |
| `visual.tags.bubbleWidthPct` | slider | `100` |
| `visual.tags.cornersPct` | slider | `0` |
| `visual.tags.emptyBubblePct` | slider | `100` |
| `visual.tags.hyperlink.addressColor` | color | `""` |
| `visual.tags.hyperlink.bracketsColor` | color | `""` |
| `visual.tags.hyperlink.targetColor` | color | `""` |
| `visual.tags.linkAsWritten.bracketsColor` | color | `""` |
| `visual.tags.linkAsWritten.targetColor` | color | `""` |
| `visual.tags.linkShown.draggable` | toggle | `false` |
| `visual.tags.linkShown.hoverPreview` | toggle | `false` |
| `visual.tags.opacityLeft` | slider | `100` |
| `visual.tags.opacityRight` | slider | `100` |
| `visual.tags.textSizePctLeft` | slider | `100` |
| `visual.tags.textSizePctRight` | slider | `100` |
| `visual.tagWheel.activeField.left` | dropdown | `""` |
| `visual.tagWheel.activeField.mode` | dropdown | `first` |
| `visual.tagWheel.activeField.right` | dropdown | `""` |
| `visual.tagWheel.activeTextColor` | color | `""` |
| `visual.tagWheel.chosenValueColor` | color | `""` |
| `visual.tagWheel.customTab` | toggle | `false` |
| `visual.tagWheel.edgeMode` | dropdown | `stay` |
| `visual.tagWheel.fillColor` | color | `""` |
| `visual.tagWheel.highlightLine` | toggle | `true` |
| `visual.tagWheel.oppositeBlock` | dropdown | `hide` |
| `visual.tagWheel.scroller.direction` | dropdown | `full` |
| `visual.tagWheel.scroller.enabled` | toggle | `false` |
| `visual.tagWheel.scroller.fillColor` | color | `""` |
| `visual.tagWheel.scroller.labels` | dropdown | `value` |
| `visual.tagWheel.scroller.size` | slider | `3` |
| `visual.tagWheel.scroller.textColor` | color | `""` |
| `visual.tagWheel.showMarkers` | toggle | `true` |
| `visual.tagWheel.textColor` | color | `""` |
| `visual.tagWheel.valueNames` | dropdown | `default` |
