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
| 2 | Keyboard | — | 4 | 16 | 8 |
| 3 | Navigation | `features.navigation.enabled` | 5 | 28 | 5 |
| 4 | Tags & PKM | `features.pkm.enabled` | 7 | 24 | 5 |
| 5 | Transform | `features.transform.enabled` | 7 | 35 | 5 |
| 6 | Visual | `features.visual.enabled` | 7 | 58 | 13 |
| 7 | Advanced | — | 3 | 10 | 1 |

### Группы по порядку


**General** (`general`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 5 | `brand-intro` | inlineOverhaul | — | — | — |
| 10 | `general-intro` | Before you start | — | — | `general.help.showCallouts` |
| 50 | `language` | Language | Choose the language of this panel, its tips and the plugin messages. You can also edit the wording yourself | да | — |
| 100 | `help` | Help | Where to start, and how much help you want along the way | да | — |
| 200 | `modules` | Modules | The plugin has four separate parts. Turn off the ones you don’t want, and they stop adding commands and stop touching your notes | да | — |

**Keyboard** (`keyboard`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `keyboard-intro` | Before you start | — | — | `general.help.showCallouts` |
| 100 | `global-hotkeys` | Global hotkeys | Four keys you already use — <code>Ctrl/Cmd + A</code>, <code>Del</code> and <code>Backspace</code>, <code>Enter</code> and <code>Ctrl/Cmd + V</code> — can do the obvious thing inside your lines | да | — |
| 200 | `binder` | Binder (custom insert commands) | For text you type over and over. Put it in a row here, give that row a key, and one press drops it in wherever your cursor is | да | — |
| 300 | `command-reference` | Commands & Hotkeys | Everything this plugin can do, in one list. None of it has a key until you give it one — click in the <code>Hotkey</code> column to do that | да | — |

**Navigation** (`navigation`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `nav-intro` | Before you start | — | — | `general.help.showCallouts` |
| 100 | `move-lines` | Move lines (up/down) | Reorder a note without cut and paste: move a line up or down with a key | да | — |
| 200 | `left-right` | Move lines (left/right) | Two keys, three jobs: slide selected text along a line, change the marker at the start of a line, or change its indent. What you get depends on what is selected | да | — |
| 400 | `in-line` | Jump inside a line (left/right) | A line can hold tags before your text and dates after it. These keys move the cursor between those parts without leaving the line | да | — |
| 500 | `heading-jumps` | Jump inside a note (up/down) | Skip through a long note by its headings instead of scrolling | да | — |

**Tags & PKM** (`pkm`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `pkm-intro` | Before you start | — | — | `general.help.showCallouts` |
| 100 | `fields` | Fields | A Field is one thing a line can have: a tag, a link to a note, or an emoji item such as a date. Add the Fields you want, the Values each one offers, and where on the line they go | да | — |
| 200 | `line-format` | Separators | Two markers split your line. Your own text goes between them, and the Fields sit before and after. To choose which side a Field goes on, drag it across the line under <code>Fields</code> | да | — |
| 300 | `writing-rules` | Writing rules | The small habits: how nested tags are written, what is left when a line empties, and where the cursor waits afterwards | да | — |
| 350 | `tagwheel-behavior` | tagWheel behavior | How tagWheel behaves: which Field it opens on, what happens to the other Values while it is open, and where the arrow keys take you. Its look is set on the Visual tab | да | — |
| 400 | `placement-modes` | Placement modes | Each Field in the Left or Right Block has a <code>Prefix behavior</code> mode, either <code>Strict</code> or <code>Insert only</code>. Here you fine-tune how these modes work | да | — |
| 500 | `prefix-priority` | Prefix priority | Some Values change the start of the line, like a checkbox from Status or an exclamation mark from Priority. When two of them want it at once, these rules pick the winner | да | — |

**Transform** (`transform`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `transform-intro` | Before you start | — | — | `general.help.showCallouts` |
| 100 | `inline-to-note` | Inline to note | Press a key and the line you wrote becomes a note of its own, or is added to a note you already have. If you want, the line keeps a link to that note | да | — |
| 200 | `naming` | New note naming | Every new note needs a name. Here you choose where that name comes from | да | `transform.inline2note.enabled` |
| 300 | `note-content` | Note content | What the new note looks like inside: where your text goes and what sits above it | да | `transform.inline2note.enabled` |
| 400 | `source-line` | Source line | What happens to the line you pressed on, after the note is safely saved | да | `transform.inline2note.enabled` |
| 450 | `backlinks` | Auto-MOC in your links | When a line links to other notes, each of them can get a link back to the new note | да | `transform.inline2note.enabled` |
| 500 | `smart-rules` | Smart Rules | Different kinds of line deserve different notes. A rule spots a kind of line and picks the template for it | да | `transform.inline2note.enabled` |

**Visual** (`visual`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `visual-intro` | Before you start | — | — | `general.help.showCallouts` |
| 100 | `tag-appearance` | Inline appearance | Makes tagged lines easier to read: tags become small colored bubbles, and links and dates stay ordinary text. Your file stays exactly the same | да | — |
| 200 | `tag-bars` | Tag Bars | A colored Bar in the margin shows at a glance what a line and everything nested under it is about, without reading the tags | да | — |
| 300 | `tagwheel` | tagWheel | tagWheel is a picker that opens over the line. Your Fields run across it and the Values of the current Field run down. You pick a Value by looking instead of remembering a hotkey for each Field | да | — |
| 400 | `text-cursor` | Text cursor | The blinking line that shows where your typing goes. Give it its own color so it stops getting lost on the page | да | — |
| 450 | `jump-highlight` | Cursor jump highlight | After a jump, the cursor is hard to find again. This shows a circle where it lands, and the circle shrinks away by itself | да | — |
| 500 | `user-tag-colors` | Color custom tags | Colors for tags you type yourself that are not a Value of any Field in <code>Tags & PKM → Fields</code>. These tags still get a bubble, and here you choose how it looks | да | — |

**Advanced** (`advanced`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `advanced-intro` | Before you start | — | — | `general.help.showCallouts` |
| 190 | `settings-backup` | Backup | A backup is a regular note in your vault that holds all your settings. Use it to go back to an earlier setup or to move your setup to another vault | да | — |
| 200 | `diagnostics` | Diagnostics | Tools for finding out why something goes wrong: setting ids and a log of what the plugin did. Careful: the log is saved in your vault and contains the text of the lines you edit | да | — |

### Полная опись настроек


#### Before you start — `advanced-intro` (вкладка `advanced`)

- **`advanced-callout`** — свой блок, рендерер `renderTabCallout`

#### Backup — `settings-backup` (вкладка `advanced`)

_Intro:_ A backup is a regular note in your vault that holds all your settings. Use it to go back to an earlier setup or to move your setup to another vault

_Tip:_ Saving adds a new note each time and never overwrites old ones, so the folder fills up and you delete old backups yourself. Restoring replaces <b>everything</b> on every tab, then asks you to restart. To move your setup to another computer, sync your vault and restore the backup there

- **Backup folder** — `backup-folder`, `text`, path `advanced.backups.folder`, default `inlineOverhaul/Backups`
  - desc: Where in your vault the backups are kept
  - tip: Pick any folder. It is created when you save your first backup. Backups are regular notes, so they sync with the rest of your vault
- **Autosave** — `backup-autosave`, `toggle`, path `advanced.backups.autosave`, default `false`
  - desc: Each time Obsidian starts, keep a copy of your settings if they differ from the last one
  - tip: This catches settings that arrive from sync, another device or a copied file, so you can always go back. Each copy holds every tab plus this plugin’s hotkeys, and lists <code>What changed</code>. Copies go to the <code>autosave</code> subfolder. To undo one change, use the command <code>Undo last settings change</code>
- **Autosaves to keep** — `backup-autosave-keep`, `text`, path `advanced.backups.autosaveKeep`, default `""`
  - desc: How many autosaves stay; when there are more, the oldest ones are removed
  - tip: Leave it empty for 10. Only autosaves are removed. Backups you save yourself are always kept
  - видна если: `advanced.backups.autosave`
- **Save a backup before restoring** — `backup-before-restore`, `toggle`, path `advanced.backups.beforeRestore`, default `true`
  - desc: Write what you have now into the folder above before an earlier backup replaces it
  - tip: When on, each restore first saves a copy ending in <code>Autogenerated</code>, so you can go back. When off, restoring writes straight over your settings. Turn it off only if you restore often and the extra copies pile up
- **Your settings** — `settings-backup-actions`, `buttons`
  - desc: Save what you have set up now, or bring back an earlier backup
  - tip: Saving adds a new note each time. Old ones stay until you delete them. Restoring replaces <b>everything</b> on every tab, then asks you to restart. The toggle above decides whether your current settings are saved first, as a copy ending in <code>Autogenerated</code>
  - кнопки: `save-backup` Save a backup · `restore-backup` Restore a backup
- **Start over** — `settings-reset-actions`, `buttons`
  - desc: Delete everything you have set up here and go back to the plugin’s own defaults
  - tip: This deletes every tab, Field, Value, rule, Binder row and the hotkeys of this plugin’s commands. Other plugins’ hotkeys stay. A copy ending in <code>Autogenerated</code> is always saved first, whatever the toggle says, so the restore button next to it brings everything back
  - кнопки: `reset-settings` Delete all my settings

#### Diagnostics — `diagnostics` (вкладка `advanced`)

_Intro:_ Tools for finding out why something goes wrong: setting ids and a log of what the plugin did. Careful: the log is saved in your vault and contains the text of the lines you edit

_Tip:_ Showing ids is harmless. Use an id to name a setting in a bug report, because ids never change. Keep the log off unless you are chasing a problem: it grows with every keypress and records what you type. Turn it on, repeat the problem once, turn it off and read the note

- **Show option IDs in tips** — `show-setting-ids`, `toggle`, path `advanced.showSettingIds`, default `false`
  - desc: Put the id of each setting and group at the end of its tip
  - tip: <code>Show tips</code> on the General tab must be on too. Settings without a tip get one that shows only the id. Use the id to point at a setting in a bug report or a question. It stays the same even when a name changes
- **Developer logging** — `dev-mode`, `toggle`, path `advanced.devMode.enabled`, default `false`
  - desc: Record what the plugin did, to help track down a problem
  - tip: Leave this off day to day. Turn it on, reproduce the problem once, then turn it off and attach the log to a bug report after checking what is in it
  - старые названия для поиска: «Enable Dev Mode»
- **Machine-readable log** — `dev-ai-log`, `toggle`, path `advanced.devMode.aiLog`, default `false`
  - desc: Also keep a second, denser log meant for tools rather than people
  - tip: Only worth turning on if someone has asked you for it. The plain log is the one you can read yourself
  - видна если: `advanced.devMode.enabled`
  - старые названия для поиска: «Generate log for AI?»
- **Log folder** — `dev-log-path`, `text`, path `advanced.devMode.logPath`, default `InlineOverhaul_DevLog`
  - desc: Where in your vault the logs are put
  - tip: Logs are regular notes, so they show up in search and in your graph. If that bothers you, put them in a folder you exclude
  - видна если: `advanced.devMode.enabled`
  - старые названия для поиска: «Log Path»

#### inlineOverhaul — `brand-intro` (вкладка `general`)

- **`brand-mark`** — свой блок, рендерер `renderBrandMark`

#### Before you start — `general-intro` (вкладка `general`)

- **`general-callout`** — свой блок, рендерер `renderTabCallout`

#### Language — `language` (вкладка `general`)

_Intro:_ Choose the language of this panel, its tips and the plugin messages. You can also edit the wording yourself

_Tip:_ Each language is a small text file in the plugin folder. Change a line there, reload the plugin, and the panel shows your words. To add a language, copy the English file under a new name and translate it. Anything you leave untranslated stays in English, so a half-done translation still works

- **Language** — `ui-language`, `dropdown`, path `general.language`, default `en`
  - desc: What language this panel and the plugin messages speak
  - tip: The list shows English plus every language file in the plugin folder. The switch works at once, no reload needed. Lines that are not translated yet show in English, never blank
  - варианты: 

#### Help — `help` (вкладка `general`)

_Intro:_ Where to start, and how much help you want along the way

_Tip:_ <code>Read</code> opens a guide note in your vault; it is yours to change, and the plugin never overwrites it. <code>Show tips</code> and <code>Show callouts</code> hide the help boxes once you know your way around; the one-line descriptions stay

- **Guide** — `howto`, `buttons`
  - desc: Worked examples of the things people set up first
  - tip: The first press creates the guide note in your vault, later presses open it. Inside: which commands are worth a key, how to set up your first Fields, how tagWheel feels, and ready setups to copy. Edit, move or rename it freely — the plugin never writes over it
  - кнопки: `open-howto` Read
- **Changelog** — `changelog`, `buttons`
  - desc: What changed in this version, and in every one before it
  - tip: Opens <code>CHANGELOG.md</code> in your browser: every release, newest first. The window you see after an update shows the same text for the newest release
  - кнопки: `open-changelog` Open
- **Show callouts** — `show-callouts`, `toggle`, path `general.help.showCallouts`, default `true`
  - desc: Keep the boxes that say what a tab or a block of settings is for
  - tip: Callouts are the boxes with a colored edge at the top of each tab and under each block of settings. <code>Show tips</code> is a separate switch for the <code>?</code> marks. Know your way around? Turn both off; the one-line descriptions stay
  - старые названия для поиска: «Show intro boxes»
- **Show tips** — `show-tips`, `toggle`, path `general.help.showTips`, default `true`
  - desc: Put a ? beside anything that needs more explanation
  - tip: Click a <code>?</code> to open a short explanation, usually with an example. Turn this off when you no longer need them; the one-line descriptions stay either way

#### Modules — `modules` (вкладка `general`)

_Intro:_ The plugin has four separate parts. Turn off the ones you don’t want, and they stop adding commands and stop touching your notes

_Tip:_ When a part is off, its commands leave the palette, its hotkeys stop working and its settings are hidden here. Nothing is lost: turn it back on and everything is as it was. Only want the tags? Turn the other three off to keep the palette short

- **Navigation** — `module-navigation`, `toggle`, path `features.navigation.enabled`, default `true`
  - desc: Move lines, text and the cursor without reaching for the mouse
  - tip: It only moves text you already wrote: a line up, a word along, the cursor across. It never adds anything. Safe to leave on
- **Tags & PKM** — `module-pkm`, `toggle`, path `features.pkm.enabled`, default `true`
  - desc: Set up your PKM tags, wikilinks and emoji elements, and insert them inline with one key
  - tip: This part puts tags and dates on a line and steps them forward with a keypress. Turning it off keeps everything you already wrote; only the keys stop working
- **Transform** — `module-transform`, `toggle`, path `features.transform.enabled`, default `true`
  - desc: Turn an inline entry into a note, with templates, YAML properties, rules and more
  - tip: On here alone, nothing happens yet. To make notes you also need the switch on the Transform tab, because this is the only part that writes new files
- **Visual** — `module-visual`, `toggle`, path `features.visual.enabled`, default `true`
  - desc: Customize and beautify your inline text with tag colors, Bars and much more
  - tip: Looks only: your notes keep exactly the same text, and other apps show it plain. Off, the Visual tab goes back to your theme’s look, except the tagWheel colors, which the panel needs to stay readable

#### Before you start — `keyboard-intro` (вкладка `keyboard`)

- **`keyboard-callout`** — свой блок, рендерер `renderTabCallout`

#### Global hotkeys — `global-hotkeys` (вкладка `keyboard`)

_Intro:_ Four keys you already use — <code>Ctrl/Cmd + A</code>, <code>Del</code> and <code>Backspace</code>, <code>Enter</code> and <code>Ctrl/Cmd + V</code> — can do the obvious thing inside your lines

_Tip:_ None of this rebinds a key. Each setting changes what a key does in one case only. All of them start off, and each section works on its own, so turn on only the ones you want

- **`select-all-sub`** — свой блок, рендерер `?`
- **Smart Ctrl+A** — `select-all-enabled`, `toggle`, path `editor.selectAll.enabled`, default `false`
  - desc: Change what <code>Ctrl/Cmd + A</code> does: take the line first, then widen
  - tip: With the default steps, the first press takes the line and the second takes the whole note. Want more stops, like a task with its subtasks? Choose them in <b>Selection steps</b> below. If the last option below is on, one more press puts the cursor back where it was
  - старые названия для поиска: «Enhanced Mod+A», «Expanded select all», «Expanded 'Ctrl+A'»
- **Selection steps** — `select-all-steps`, `dropdown`, path `editor.selectAll.mode`, default `line-note`
  - desc: How much more gets picked up on each press
  - tip: <b>Word</b>: the word at the cursor. <b>Tree</b>: the line plus everything indented under it. <b>Heading</b>: everything under the nearest heading. <b>Custom</b>: tick your own steps below. Pick as few steps as you need, because each extra step is one more press
  - варианты: `line-note` Line, note · `line-tree-note` Line, tree, note · `line-tree-header-note` Line, tree, heading, note · `word-line-tree-header-note` Word, line, tree, heading, note · `custom` Custom
  - видна если: `editor.selectAll.enabled`
  - старые названия для поиска: «Select-all mode»
- **Steps to cycle through** — `select-all-custom-head`, `note`
  - desc: Which of the five a press stops at
  - tip: The order never changes: word, line, tree, heading, note. Your ticks choose where a press stops. For example, tick <b>word</b>, <b>line</b> and <b>note</b> to skip the other two. Tick nothing and the key works as usual: one press selects the whole note
  - видна если: `editor.selectAll.mode`
- **`select-all-custom`** — свой блок, рендерер `renderSelectAllCustom`
- **Count presses by timer** — `select-all-timer`, `toggle`, path `editor.selectAll.useDelay`, default `false`
  - desc: Decide the next step by how quickly you press, rather than by what is selected
  - tip: <b>Off</b>: pause as long as you like and the next press still selects more. <b>On</b>: if you pause longer than the time below, you start over from the line. Not sure? Leave it off
  - видна если: `editor.selectAll.enabled`
  - старые названия для поиска: «Use multi-press delay»
- **Time between presses** — `select-all-delay`, `slider`, path `editor.selectAll.delayMs`, default `700`
  - desc: How long you can pause and still be in the middle of a sequence
  - tip: Only used when the timer above is on. About three quarters of a second suits most people. Raise it if you keep starting over
  - диапазон: 250–2000, шаг 50, ед. ms
  - видна если: `editor.selectAll.enabled, editor.selectAll.useDelay`
  - старые названия для поиска: «Multi-press delay»
- **Last press clears highlighting** — `select-all-clear`, `toggle`, path `editor.selectAll.clearOnLast`, default `false`
  - desc: After the last step, pressing again drops the selection and returns the cursor
  - tip: Get out of a selection with the same key you used to make it, so you don't have to click somewhere else
  - видна если: `editor.selectAll.enabled`
  - старые названия для поиска: «Last press clears selection», «One more press clears it»
- **`smart-delete-sub`** — свой блок, рендерер `?`
- **Smart Delete** — `smart-delete-enabled`, `toggle`, path `editor.smartDelete.enabled`, default `false`
  - desc: Let <code>Del</code> at the end of a line bring up the words without the indent and the Prefix
  - tip: When it's off, <code>Del</code> works as it always has. <code>Smart Backspace</code> below has its own switch and works without this one
  - старые названия для поиска: «Smart Del», «Delete the junk»
- **Smart Backspace** — `smart-delete-backspace`, `toggle`, path `editor.smartDelete.onBackspace`, default `false`
  - desc: Let <code>Backspace</code> at the start of a line send it up without its own indent and Prefix
  - tip: This works even if <code>Smart Delete</code> is off. Normally the line goes up with its indent and bullet. With this on, only the words go up. An empty line just disappears, which is the quickest way to close a gap
  - старые названия для поиска: «Smart Backspace», «Do the same on Backspace»
- **Drop the line Prefix** — `smart-delete-prefix`, `toggle`, path `editor.smartDelete.dropPrefix`, default `true`
  - desc: Take the bullet, checkbox, number or quote mark off the arriving line, not only its indent
  - tip: <b>On</b>: <code>- [ ] read the docs</code> comes up as <code>read the docs</code>. <b>Off</b>: only the indent goes, so leave it off if both lines should stay list items. Works for both keys above
  - видна если: `editor.smartDelete.enabled, editor.smartDelete.onBackspace`
  - старые названия для поиска: «Drop the bullet»
- **Join with a space** — `smart-delete-space`, `toggle`, path `editor.smartDelete.joinWithSpace`, default `true`
  - desc: Put one space between your text and the text that arrives, so the two do not run together
  - tip: No space is added if your line already ends with one. <b>Off</b>: the two texts join with nothing between them, which is handy for putting a split word back together. Works for both keys above
  - видна если: `editor.smartDelete.enabled, editor.smartDelete.onBackspace`
  - старые названия для поиска: «Add a space»
- **`smart-enter-sub`** — свой блок, рендерер `?`
- **Smart Enter** — `smart-enter-enabled`, `toggle`, path `editor.smartEnter.enabled`, default `false`
  - desc: Let <code>Enter</code> add a line instead of splitting the one you are on
  - tip: This doesn't rebind <code>Enter</code>. It only changes what happens inside your lines. When it's off, the key works as it always has
  - старые названия для поиска: «Smart Enter», «Do not split the line»
- **Where it works** — `smart-enter-scope`, `dropdown`, path `editor.smartEnter.scope`, default `line`
  - desc: How much of the line the key treats as one record
  - tip: <b>Whole line</b>: wherever the cursor is, <code>Enter</code> adds a line below. <b>Text only</b>: only in your text between the Separators; among the tags <code>Enter</code> works as usual. Not sure — keep <b>Whole line</b>
  - варианты: `line` Whole line · `text` Text only
  - видна если: `editor.smartEnter.enabled`
  - старые названия для поиска: «Smart Enter scope», «Only in your text»
- **Prefix on the new line** — `smart-enter-prefix`, `dropdown`, path `editor.smartEnter.newLinePrefix`, default `same`
  - desc: What the line <code>Smart Enter</code> adds starts with
  - tip: <b>Same as above</b>: works like Obsidian, so a bullet stays a bullet, a number goes up by one and a checkbox comes empty. <b>None</b>: the new line starts bare. <b>Numbered lines only</b>: bare too, but numbered lists keep counting. All three keep the indent
  - варианты: `same` Same as above · `none` None · `number-only` Numbered lines only
  - видна если: `editor.smartEnter.enabled`
  - старые названия для поиска: «Keep the bullet», «New line Prefix», «Carry the Prefix over»
- **Use Shift+Enter instead** — `smart-enter-use-shift`, `toggle`, path `editor.smartEnter.useShift`, default `false`
  - desc: Make <code>Shift+Enter</code> the Smart Enter key and leave <code>Enter</code> as usual
  - tip: <b>On</b>: <code>Enter</code> splits the line as usual and <code>Shift+Enter</code> adds a line below. <b>Off</b>: it's the other way round
  - видна если: `editor.smartEnter.enabled`
  - старые названия для поиска: «Shift+Enter», «Smart Enter key»
- **Shift+Enter as usual Enter** — `smart-enter-shift`, `toggle`, path `editor.smartEnter.shiftPlainEnter`, default `false`
  - desc: Let <code>Shift+Enter</code> split the line the way <code>Enter</code> does without <code>Smart Enter</code>
  - tip: <b>On</b>: <code>Shift+Enter</code> works like Obsidian's normal <code>Enter</code>. It splits the line at the cursor and continues the list. <b>Off</b>: <code>Shift+Enter</code> works as it always did
  - видна если: `editor.smartEnter.enabled, editor.smartEnter.useShift`
  - старые названия для поиска: «Shift+Enter», «Plain Enter»
- **`smart-paste-sub`** — свой блок, рендерер `?`
- **Smart paste** — `smart-paste-enabled`, `toggle`, path `editor.smartPaste.enabled`, default `false`
  - desc: Count a pasted numbered list from one, and drop a pasted marker where the line has one
  - tip: This doesn't rebind <code>Ctrl/Cmd + V</code>. It only changes pasted numbered lists and list items. Plain text, links and everything else paste as usual, whether this is on or off
  - старые названия для поиска: «Smart insert», «Paste a numbered list», «Renumber on paste»

#### Binder (custom insert commands) — `binder` (вкладка `keyboard`)

_Intro:_ For text you type over and over. Put it in a row here, give that row a key, and one press drops it in wherever your cursor is

_Tip:_ Each Binder row becomes a command. Type your text, then give it a key in <code>Settings → Hotkeys</code>, or click the <code>Hotkey</code> column to get there. Good for arrows, callouts, signatures and table templates. You can't change a row's text later. Delete the row and add it again, and know that deleting a row also deletes its command

- **`binder-table`** — свой блок, рендерер `renderBinder`

#### Commands & Hotkeys — `command-reference` (вкладка `keyboard`)

_Intro:_ Everything this plugin can do, in one list. None of it has a key until you give it one — click in the <code>Hotkey</code> column to do that

_Tip:_ Shows every command and which ones already have a key. Click a <code>Hotkey</code> cell to set the key in Obsidian's hotkey screen. The list changes with your setup: each Field and each Binder row adds commands, and turning a module off removes them. To see them all in Obsidian's hotkey list, search for <b>inlineOverhaul</b>

- **`command-list`** — свой блок, рендерер `renderCommandReference`

#### Before you start — `nav-intro` (вкладка `navigation`)

- **`nav-callout`** — свой блок, рендерер `renderTabCallout`

#### Move lines (up/down) — `move-lines` (вкладка `navigation`)

_Intro:_ Reorder a note without cut and paste: move a line up or down with a key

_Tip:_ A line with other lines indented under it forms a <b>tree</b>. The settings below decide whether those indented lines move with it or stay behind

- **Move lines** — `move-lines-enabled`, `toggle`, path `navigation.moveLine.enabled`, default `true`
  - desc: Let the keys pick up a line and move it
  - tip: Off, the commands do nothing, but your hotkeys and settings are kept. Turn it back on and everything works as before
  - старые названия для поиска: «Enable Move Line»
- **Moving behavior** — `move-lines-no-selection`, `dropdown`, path `navigation.moveLine.noSelectionMode`, default `line-only`
  - desc: Whether the tree under the line travels with it
  - tip: <b>Line only</b> moves just that line, and the lines indented under it stay where they are. <b>Whole tree</b> moves the line together with everything indented under it
  - варианты: `line-only` Line only · `with-children` Whole tree
  - видна если: `navigation.moveLine.enabled`
  - старые названия для поиска: «No-selection mode»
- **Jump over neighbor trees** — `move-lines-jump-trees`, `toggle`, path `navigation.moveLine.jumpNeighborTrees`, default `false`
  - desc: Move the tree past the whole tree next to it instead of into its lines
  - tip: Off, the tree moves one line per press and can slip in among the neighbor's indented lines, taking them along. On, one press moves it past the whole neighbor, and the neighbor keeps its own lines
  - видна если: `navigation.moveLine.enabled, navigation.moveLine.noSelectionMode`
- **Moving headings** — `move-lines-heading`, `dropdown`, path `navigation.moveLine.headerMode`, default `move-as-line`
  - desc: If you are moving a heading, this decides whether the whole section moves or just the heading line
  - tip: <b>Heading with its section</b>: one press swaps two whole sections, content and all. <b>Heading only</b>: just the heading line moves and the text under it stays. Pick it when you only want to reorder headings
  - варианты: `move-as-line` Heading only · `move-with-section` Whole section
  - видна если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Header mode»
- **Cross heading boundaries** — `move-lines-cross`, `toggle`, path `navigation.moveLine.crossSectionAllowed`, default `true`
  - desc: Let a line travel past a heading into the part of the note below it
  - tip: On, a line keeps moving wherever you push it. Off, it stops at the heading — useful when each heading must keep its own contents
  - видна если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Cross-section allowed»
- **Highlight after moving** — `move-lines-select`, `toggle`, path `navigation.moveLine.highlightMovedLines`, default `false`
  - desc: Keep the lines highlighted once they land, so you can see what moved
  - tip: Useful when you move a tree of several lines and want to be sure the whole thing came along
  - видна если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Highlight moved lines», «Select after moving»
- **Moved lines color** — `move-lines-select-color`, `color`, path `navigation.moveLine.highlightColor`, default `""`
  - desc: Leave it unset to use the selection color of your theme
  - tip: Unset, moved lines use your theme's selection color. Pick your own if that is too pale to see; the reset button brings the theme color back
  - видна если: `navigation.moveLine.enabled, navigation.moveLine.highlightMovedLines`
  - старые названия для поиска: «Highlight color after moving»
- **Follow the moved line** — `move-lines-view`, `toggle`, path `navigation.moveLine.keepInView`, default `true`
  - desc: Scroll the note to the line you moved instead of leaving the view where it was
  - tip: Off, the note never scrolls, and a line moved past the edge goes out of sight. On, the view follows the line and places it where the row below says
  - видна если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Scroll on move», «Keep in view», «Screen jumps»
- **Where the line lands** — `move-lines-view-position`, `dropdown`, path `navigation.moveLine.viewPosition`, default `center`
  - desc: The place on screen the moved line is scrolled to
  - tip: The line lands in the same place every time, so the note does not jump around. Near the start or end of a note it gets as close to that place as it can
  - варианты: `center` Center · `top` Top · `bottom` Bottom
  - видна если: `navigation.moveLine.enabled, navigation.moveLine.keepInView`
  - старые названия для поиска: «Scroll position», «Center on move»

#### Move lines (left/right) — `left-right` (вкладка `navigation`)

_Intro:_ Two keys, three jobs: slide selected text along a line, change the marker at the start of a line, or change its indent. What you get depends on what is selected

_Tip:_ Selected text: the keys slide it along the line. Nothing selected: they change the marker at the start of the line or its indent. The line decides which, as the lists at the top of this group show. A task keeps its checkbox. Switch off any job below to keep only the ones you want

- **`left-right-order`** — свой блок, рендерер `renderLeftRightOrder`
- **`move-text-sub`** — свой блок, рендерер `?`
- **Move selected text** — `move-text-enabled`, `toggle`, path `navigation.moveSelection.inlineEnabled`, default `true`
  - desc: Slide a highlighted phrase along its line
  - tip: Highlight two words and press <code>Move right</code>: they swap places with the next word and stay highlighted, so you can keep pressing until they are where you want
  - старые названия для поиска: «Enable inline text move»
- **Movement step** — `move-text-step`, `dropdown`, path `navigation.moveSelection.inlineMoveMode`, default `auto`
  - desc: How far the highlighted text goes on each press
  - tip: <b>Auto</b>: part of a word moves letter by letter, a whole word moves word by word. Pick another option if you want the same step every time
  - варианты: `auto` Auto · `char` Character · `word` Word · `disabled` Off
  - видна если: `navigation.moveSelection.inlineEnabled`
  - старые названия для поиска: «Inline move mode»
- **Step out of the word** — `move-text-word-escape`, `toggle`, path `navigation.moveSelection.inlineWordEscape`, default `false`
  - desc: Let a highlighted part of a word carry on past the word it came from
  - tip: Shown only for <code>Auto</code>. Off, letters selected inside a word stop at the edge of the word. On, they keep going into the next word: <b>te|xt more</b> becomes <b>te xtmore</b>. Off is how it always worked
  - видна если: `navigation.moveSelection.inlineEnabled, navigation.moveSelection.inlineMoveMode`
  - старые названия для поиска: «Leave the word», «Word escape»
- **Continue past Separators** — `move-text-cross`, `toggle`, path `navigation.moveSelection.inlineBoundaryJump`, default `true`
  - desc: Let the highlighted text leave your text and move into the tags at either end
  - tip: Off, selected text stays between the Separators and never slides into the tags at the start or the dates at the end. Turn it on when you want to move a phrase past a tag
  - видна если: `navigation.moveSelection.inlineEnabled`
  - см. также: `in-line-cross` — The cursor has the same setting of its own
- **`move-line-sub`** — свой блок, рендерер `?`
- **Cycle line Prefixes** — `prefix-cycle-enabled`, `toggle`, path `navigation.moveSelection.prefixCyclerEnabled`, default `true`
  - desc: Turn a line into a heading, a bullet, a numbered item or plain text, one press at a time
  - tip: <code>Move right</code> goes down the list below, <code>Move left</code> goes back up; an empty row means plain text. This works on lines with no indent; on an indented line the keys change the indent instead. Whether <code>Move right</code> cycles too is set in the row below
  - старые названия для поиска: «Enable PrefixCycler»
- **`cycle-order`** — свой блок, рендерер `renderCycleOrder`
- **Cycle in both directions** — `right-cycles`, `toggle`, path `navigation.moveSelection.rightCycles`, default `true`
  - desc: On: <code>Move right</code> changes the marker too, but only on a line with no indent
  - tip: On: at the left edge both keys change the marker. Indented lines are not affected — there <code>Move right</code> still indents. <b>The cost</b>: at the left edge <code>Move right</code> no longer indents until the list runs out, and with <b>Start over</b> in <code>After the last one</code> it never does, so indent with <code>Tab</code>. Off: <code>Move left</code> changes the marker, <code>Move right</code> only indents
  - видна если: `navigation.moveSelection.prefixCyclerEnabled`
- **After the last one** — `prefix-cycle-end`, `dropdown`, path `navigation.moveSelection.onCycleEnd`, default `indent`
  - desc: What happens when you reach the bottom of the list below
  - tip: <b>Start over</b> goes back to the top of the list, so you can keep pressing. <b>Indent</b> stops changing the marker and starts indenting the line instead
  - варианты: `indent` Indent · `wrap` Start over
  - видна если: `navigation.moveSelection.prefixCyclerEnabled`
  - старые названия для поиска: «On cycle end»
- **Change the indent** — `indent-fallback`, `toggle`, path `navigation.moveSelection.indentFallbackEnabled`, default `true`
  - desc: <code>Move right</code> indents a list item one step, <code>Move left</code> takes one step off
  - tip: With <code>Cycle line Prefixes</code> on, the keys change the indent and the Prefix in turn: <code>Move left</code> removes the indent first, then changes the Prefix. Plain text is never indented, since that would turn it into a code block. Off, the keys never indent — pick that if you indent with <code>Tab</code>
  - старые названия для поиска: «Indent fallback»
- **Indent the whole tree** — `indent-tree`, `toggle`, path `navigation.moveSelection.indentWithChildren`, default `false`
  - desc: The lines indented under the line take the same step with it
  - tip: Off, <code>Move right</code> indents only the item, and the lines under it end up at its level. On, they all move one step together and stay under it. Changing the Prefix never moves them
  - видна если: `navigation.moveSelection.indentFallbackEnabled`

#### Jump inside a line (left/right) — `in-line` (вкладка `navigation`)

_Intro:_ A line can hold tags before your text and dates after it. These keys move the cursor between those parts without leaving the line

_Tip:_ Arrow keys crawl through tags one character at a time. These keys hop instead — by word, by sentence or straight to one end of your text. By default they stop at the Separators, so the cursor never lands inside a tag by accident

- **Move cursor inside a line** — `in-line-enabled`, `toggle`, path `navigation.navigateInline.enabled`, default `true`
  - desc: Let the keys walk the cursor along the line
  - tip: The keys move the cursor through your own text by word, by sentence or to its start or end, and stop where a Separator begins. Off, the commands stay but do nothing
  - старые названия для поиска: «Enable Navigate Inline»
- **Step size** — `in-line-step`, `dropdown`, path `navigation.navigateInline.stepMode`, default `word`
  - desc: How big a hop the cursor makes each time
  - tip: <b>Word</b> is the everyday choice. <b>Sentence</b> suits long paragraphs. <b>Start or end</b> skips the middle entirely and lands at one end of your text
  - варианты: `word` Word · `sentence` Sentence · `begin-end` Start or end
  - видна если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «Step mode»
- **Continue past Separators** — `in-line-cross`, `toggle`, path `navigation.navigateInline.boundaryJump`, default `false`
  - desc: Let the cursor leave your text and walk into the tags at either end
  - tip: Off is safer while writing: the cursor stays in your text and cannot wander into the tags. Turn it on to reach a tag with the same keys instead of the mouse
  - видна если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «Allow crossing Separators», «Continue past Separators»
- **What to do at the end** — `in-line-boundary`, `dropdown`, path `navigation.navigateInline.onBoundary`, default `wrap`
  - desc: When there is nowhere further to go in the line
  - tip: On the last word before the closing Separator, you press again: <b>Stop</b> does nothing, <b>Wrap around</b> goes back to the first word, <b>Next line</b> moves on to the next line
  - варианты: `stay` Stop · `wrap` Wrap around · `next-line` Next line
  - видна если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «On boundary», «At the far end»

#### Jump inside a note (up/down) — `heading-jumps` (вкладка `navigation`)

_Intro:_ Skip through a long note by its headings instead of scrolling

_Tip:_ Jump through a long note a section at a time — faster than scrolling or the outline once your hands are on the keyboard. Below you choose where the keys stop (headings or lines), where on the line you land, and whether the note scrolls to show it

- **Jump between headings** — `heading-jumps-enabled`, `toggle`, path `navigation.jumpToHeader.enabled`, default `true`
  - desc: Turn on the <code>Jump up</code> and <code>Jump down</code> commands
  - tip: Off, the commands do nothing, but any hotkey you gave them is kept. Walking line by line is a mode of the same commands, set below
  - старые названия для поиска: «Enable Jump To Header»
- **Jump target** — `heading-jumps-mode`, `dropdown`, path `navigation.jumpToHeader.jumpMode`, default `edge`
  - desc: Hop between headings, or crawl from one written line to the next
  - tip: <b>Headings</b>: find your way around a long note. <b>Lines</b>: step from one written line to the next, skipping empty lines, rules and table rows — an alternative to the arrow keys
  - варианты: `edge` Headings · `line` Lines
  - видна если: `navigation.jumpToHeader.enabled`
  - старые названия для поиска: «Jump mode»
- **Where in the section** — `heading-jumps-edge`, `dropdown`, path `navigation.jumpToHeader.edgeMode`, default `start-end`
  - desc: Land at the start of the part you jump to, or at its end
  - tip: <b>Start and end</b>: one press takes you to the start, the next to the end, so you reach both without changing the setting
  - варианты: `start-end` Start and end · `start` Start only · `end` End only
  - видна если: `navigation.jumpToHeader.enabled, navigation.jumpToHeader.jumpMode`
  - старые названия для поиска: «Edge behavior»
- **Cursor position after jumping** — `heading-jumps-cursor`, `dropdown`, path `navigation.jumpToHeader.jumpCursorPosition`, default `section-end`
  - desc: Where on that line the cursor ends up
  - tip: <b>Text end</b>: after your last word, before the tags and dates, so you can keep typing. <b>Text start</b>: right after the tags at the start. This also sets where <code>Jump right</code> lands when you step in from the tags
  - варианты: `start` Line start · `end` Line end · `section-start` Text start · `section-end` Text end
  - видна если: `navigation.jumpToHeader.enabled`
  - см. также: `separator-2` — Where your text ends is set by the second Separator
  - старые названия для поиска: «Jump cursor position», «Cursor on arrival»
- **Follow the jump target** — `heading-jumps-center`, `toggle`, path `navigation.jumpToHeader.centerCursor`, default `true`
  - desc: After a jump, scroll the note so the line you landed on is on screen
  - tip: Off, you often land at the bottom edge of the window with the section still off screen. On, the note scrolls so you can read right away; the row below sets where the line appears
  - видна если: `navigation.jumpToHeader.enabled`
  - старые названия для поиска: «Center the target», «Center the screen on target», «Scroll on jump»
- **Where the target lands** — `heading-jumps-view-position`, `dropdown`, path `navigation.jumpToHeader.viewPosition`, default `center`
  - desc: The place on screen the line you jump to is scrolled to
  - tip: Same choices as in <code>Move lines</code>. The line lands in the same place every time; near the start or end of a note, as close as the note allows
  - варианты: `center` Center · `top` Top · `bottom` Bottom
  - видна если: `navigation.jumpToHeader.enabled, navigation.jumpToHeader.centerCursor`
  - старые названия для поиска: «Scroll position», «Center on jump»

#### Before you start — `pkm-intro` (вкладка `pkm`)

- **`pkm-callout`** — свой блок, рендерер `renderTabCallout`

#### Fields — `fields` (вкладка `pkm`)

_Intro:_ A Field is one thing a line can have: a tag, a link to a note, or an emoji item such as a date. Add the Fields you want, the Values each one offers, and where on the line they go

_Tip:_ There are three kinds of Field: <b>tag</b>, <b>link</b> and <b>Emoji</b> (such as a date). Each Field gets two commands, <code>next</code> and <code>previous</code>, that put a Value on the line and step through the rest. Give a hotkey to the ones you use often. Or open <b>tagWheel</b> to see all your Fields at once and pick with the arrow keys

- **`line-preview`** — свой блок, рендерер `renderLinePreview`
- **`field-editor`** — свой блок, рендерер `renderFieldEditor`

#### Separators — `line-format` (вкладка `pkm`)

_Intro:_ Two markers split your line. Your own text goes between them, and the Fields sit before and after. To choose which side a Field goes on, drag it across the line under <code>Fields</code>

_Tip:_ Pick these once and leave them. Lines you already wrote keep the old Separator, so if you change it the plugin stops recognizing them. Use two or more characters Markdown doesn’t use: <code>||</code> or <code>::</code> are good, but <code>==</code> is not, because Obsidian shows it as a highlight

- **First Separator** — `separator-1`, `text`, path `pkm.lineFormat.separator1`, default `||`
  - desc: Goes between the tags at the front and the start of your sentence
  - tip: Pick something you would never type in a sentence by accident. That is why the default is two pipe characters
- **Second Separator** — `separator-2`, `text`, path `pkm.lineFormat.separator2`, default `||`
  - desc: Goes at the end of your sentence, before the dates and links
  - tip: It may match the first one: the plugin tells them apart by where they stand on the line, not by how they look

#### Writing rules — `writing-rules` (вкладка `pkm`)

_Intro:_ The small habits: how nested tags are written, what is left when a line empties, and where the cursor waits afterwards

_Tip:_ Set these once and forget them. Which Fields you have is set under <code>Fields</code>. Here you choose how things land on the line: <code>#parent #child</code> or <code>#parent/child</code>, what is left when you step past the last Value, and where the cursor ends up

- **Child tag format** — `child-tag-format`, `dropdown`, path `pkm.behavior.childTagFormat`, default `separate`
  - desc: When a Value sits under another one, whether they are written as two tags or one
  - tip: Say <code>doing</code> has <code>review</code> under it. <b>Separate</b> gives <code>#doing #review</code>, so a search for <code>#doing</code> finds the line. <b>Nested</b> gives <code>#doing/review</code>, which keeps the pair together in Obsidian’s tag list, but searching for the parent needs a slash. Previews on the Visual tab follow your choice
  - варианты: `separate` Separate (#doing #review) · `combined` Nested (#doing/review)
  - см. также: `tag-preview` — See it in the tag appearance preview
  - старые названия для поиска: «Subtag format»
- **When a line empties out** — `cycle-end-behavior`, `dropdown`, path `pkm.behavior.cycleEndBehavior`, default `keep-bullet`
  - desc: What is left behind when cycling removes the last Value
  - tip: When the tag comes off and nothing is left but <code>- </code>: <code>Keep bullet</code> leaves an empty list item ready for typing, and <code>Clear line</code> leaves a blank line
  - варианты: `keep-bullet` Keep bullet · `clear-prefix` Clear line
  - старые названия для поиска: «Line Prefix after end of cycle»
- **Cursor after an action** — `cursor-policy`, `dropdown`, path `pkm.behavior.cursorPolicy`, default `text_end`
  - desc: Where the cursor waits once a tag or date has been set
  - tip: Pick <b>end of your text</b>: the cursor lands where you stopped writing, just before the tags, so you can keep typing. With the other two you usually have to move the cursor back
  - варианты: `text_end` Text end · `current_position` Don't move · `line_end` Line end
  - старые названия для поиска: «Cursor behavior»
- **Mark ticked line** — `done-marker`, `text`, path `pkm.behavior.doneMarker.token`, default `""`
  - desc: A tag or emoji added when you tick a checkbox and taken off when you untick it
  - tip: Type a tag or emoji, such as <code>#done</code> or <code>✅</code>. Ticking <code>- [ ]</code> to <code>- [x]</code> adds it, and unticking removes it. If it is a Value of one of your Fields (say <code>#done</code> under <code>Status</code>), it goes where that Field is and replaces its Value. Leave this empty and ticking adds nothing
  - старые названия для поиска: «Done marker», «Checkbox marker», «Mark the line as done»
- **Where the tick mark goes** — `done-marker-position`, `dropdown`, path `pkm.behavior.doneMarker.panel`, default `right`
  - desc: Before your text, or after it
  - tip: Left Block puts the mark with the tags before your text. Right Block keeps your sentence first. If the mark is a Value of one of your Fields, this setting doesn’t apply: the mark goes where that Field is
  - варианты: `left` Left Block · `right` Right Block
  - видна если: `pkm.behavior.doneMarker.token`
  - старые названия для поиска: «Done marker panel»
- **Strike through ticked line** — `done-strike`, `toggle`, path `pkm.behavior.doneMarker.strike`, default `false`
  - desc: Cross out the whole line once it carries the tick mark
  - tip: Only the look changes. Nothing is written into the note, and the strike goes away when the mark comes off the line
  - видна если: `pkm.behavior.doneMarker.token`
  - старые названия для поиска: «Cross out done lines»
- **Dim ticked line** — `done-dim`, `toggle`, path `pkm.behavior.doneMarker.visual.enabled`, default `false`
  - desc: Fade a line once it carries the tick mark, so your eye skips it
  - tip: Ticked lines stay where they are and search still finds them, but they stop catching your eye. Only the look changes. Nothing is written into the note, and unticking brings the line back to full strength
  - видна если: `pkm.behavior.doneMarker.token`
  - старые названия для поиска: «Dim the lines already done»
- **Opacity of ticked line** — `done-dim-opacity`, `slider`, path `pkm.behavior.doneMarker.visual.opacity`, default `65`
  - desc: Zero leaves the line as it is, eighty makes it barely readable
  - tip: How strongly a ticked line fades. Only the look changes: the text stays whole and search still finds it
  - диапазон: 0–80, шаг 5, ед. %
  - видна если: `pkm.behavior.doneMarker.token, pkm.behavior.doneMarker.visual.enabled`
  - старые названия для поиска: «How much of a ticked line is left»
- **Color of ticked line** — `done-dim-color`, `color`, path `pkm.behavior.doneMarker.visual.color`, default `""`
  - desc: Leave it unset to keep the color your theme gives the text
  - tip: Set a color only if fading alone doesn’t make ticked lines easy to spot. Your color replaces the theme’s color, and the fade still applies on top
  - видна если: `pkm.behavior.doneMarker.token, pkm.behavior.doneMarker.visual.enabled`
  - старые названия для поиска: «Color of a done line»

#### tagWheel behavior — `tagwheel-behavior` (вкладка `pkm`)

_Intro:_ How tagWheel behaves: which Field it opens on, what happens to the other Values while it is open, and where the arrow keys take you. Its look is set on the Visual tab

_Tip:_ tagWheel is the picker that opens over your line and shows all your Fields. Here you set how it moves: the Field it opens on, whether the other Block stays visible, and where the arrows go after the last Field. Colors and sizes are under <code>Visual</code> → <code>tagWheel</code>

- **Active Field on opening** — `wheel-active-field`, `dropdown`, path `visual.tagWheel.activeField.mode`, default `first`
  - desc: Which Field the picker lands on when it opens
  - tip: <code>First Field</code> opens on the first Field in your order. <code>Middle Field</code> opens near the middle, so neither end is far away, which helps if you have many Fields. <code>Chosen Field</code> lets you pick one Field for each Block in the two settings below
  - варианты: `first` First Field · `middle` Middle Field · `custom` Chosen Field
  - старые названия для поиска: «Lead Field», «Starting Field», «Active Field»
- **Left Block active Field** — `wheel-active-left`, `dropdown`, path `visual.tagWheel.activeField.left`, default `""`
  - desc: The Field tagWheel lands on when it opens on the left
  - tip: You can only pick Fields that are in the Left Block. If you later move that Field to the right, tagWheel goes back to opening on the first Field on the left
  - варианты: `` First Field
  - видна если: `visual.tagWheel.activeField.mode`
  - старые названия для поиска: «Lead Field left»
- **Right Block active Field** — `wheel-active-right`, `dropdown`, path `visual.tagWheel.activeField.right`, default `""`
  - desc: The Field tagWheel lands on when it opens on the right
  - tip: You can only pick Fields that are in the Right Block. Leave it on <code>First Field</code> to open on the first one
  - варианты: `` First Field
  - видна если: `visual.tagWheel.activeField.mode`
  - старые названия для поиска: «Lead Field right»
- **Values in the other Block** — `wheel-opposite-block`, `dropdown`, path `visual.tagWheel.oppositeBlock`, default `hide`
  - desc: What happens to the Values you are not picking while the picker is open
  - tip: <code>Hide</code> (the usual way): the other Block disappears from the line while you choose. <code>Show</code>: it stays visible, so you can see what the line already has on the other side. With <code>Show</code>, the line is really changed while the picker is open, so a save at that moment writes it to the file. Closing the picker puts the line back
  - варианты: `hide` Hide · `keep` Show
  - старые названия для поиска: «Opposite Block», «Other Block», «Hide values»
- **Line for a selection** — `wheel-selection-line`, `dropdown`, path `visual.tagWheel.selectionLine`, default `top`
  - desc: Which selected line tagWheel opens on when you start it with lines selected
  - tip: The selection stays highlighted while the panel is open. Picking a Value changes only that line, as if nothing were selected, and <code>Esc</code> gives the selection back. <code>Where selecting ended</code> follows the drag: down picks the bottom line, up picks the top one
  - варианты: `top` Top line · `bottom` Bottom line · `head` Where selecting ended
  - старые названия для поиска: «Selection», «Selected lines»
- **tagWheel navigation behavior** — `wheel-edge`, `dropdown`, path `visual.tagWheel.edgeMode`, default `stay`
  - desc: What the arrow keys do when there is no next Field on this side
  - tip: <code>Stay in Block</code>: after the last Field, the arrows go back to the first Field of the same Block. <code>Next Block</code>: the arrows carry on into the other Block, so both Blocks work as one loop. <code>Tab</code> switches Blocks either way. In a custom block the arrows always stay in that block
  - варианты: `stay` Stay in Block · `next-block` Next Block
  - старые названия для поиска: «Edge of a Block», «Wrap around», «Move to the next Block», «At the last Field»
- **Switch custom blocks on Tab** — `wheel-custom-tab`, `toggle`, path `visual.tagWheel.customTab`, default `false`
  - desc: Tab in a custom block’s tagWheel moves on to the next custom block
  - tip: Off: <code>Tab</code> does nothing in a custom block’s tagWheel. On: it moves to the next custom block in the order of your Fields list, and from the last one back to the first. Whatever you picked in the block you leave is lost, because only <code>Enter</code> saves it
  - видна если: `pkm.fields.order.custom`
  - старые названия для поиска: «Custom block», «Tab», «Next custom block»

#### Placement modes — `placement-modes` (вкладка `pkm`)

_Intro:_ Each Field in the Left or Right Block has a <code>Prefix behavior</code> mode, either <code>Strict</code> or <code>Insert only</code>. Here you fine-tune how these modes work

_Tip:_ You pick the mode for each Field under <code>Fields</code>. Here you set the details, mainly whether a mode can change the start of the line, where the bullet or checkbox is

- **Strict: add a bullet** — `placement-bullet-strict`, `toggle`, path `pkm.placement.bulletInStrict`, default `false`
  - desc: Start the line with a bullet when the Field has nothing of its own to put there
  - tip: Headings are never changed. On: a plain line becomes a list item. Off: it stays as it is
  - см. также: `field-editor` — Each Field’s Prefix behavior is set under Fields
  - старые названия для поиска: «OFF mode Prefix»
- **Insert only: use Field Prefix** — `placement-field-prefix`, `toggle`, path `pkm.placement.fieldPrefixInsertOnly`, default `true`
  - desc: Allow a Value to change the start of the line after all, if it has its own
  - tip: Some Values come with their own line start, like <code>- [x]</code> for done. On: choosing that Value ticks the checkbox for you. Off: the line keeps its start and only the tag changes
  - старые названия для поиска: «Minimal mode Prefix»
- **Keep typed tags in text** — `placement-typed-tags`, `toggle`, path `pkm.placement.typedTagsStayText`, default `true`
  - desc: A tag or link you type between words or at the end stays your word
  - tip: This works in both modes. On: <code>- buy #todo milk</code> stays as you wrote it, and the Field command adds its own Value in the Block. Off: a Field’s Value anywhere in your text moves out of the sentence into its Block. Tags at the very start of a line always count as Values
  - старые названия для поиска: «Value in text», «tag in the middle»

#### Prefix priority — `prefix-priority` (вкладка `pkm`)

_Intro:_ Some Values change the start of the line, like a checkbox from Status or an exclamation mark from Priority. When two of them want it at once, these rules pick the winner

_Tip:_ This only matters if two of your Values both want the start of the line. If not, you can skip it. <b>Decide by</b> is the main choice: go by your Field order, or by a list of line starts you rank yourself. The setting below it decides whether a nested Value beats its parent or the other way round

- **Decide by** — `prefix-priority-decide`, `dropdown`, path `pkm.prefixPriority.decideBy`, default `by-section`
  - desc: Settle it by the order of your Fields, or by a list of openings you rank yourself
  - tip: <b>Field order</b> is the simple choice: the Field that comes first in your list wins. <b>Prefix order</b> is for when the line start itself matters, say an urgent mark should always beat a tick, whichever Field asked for it. Not sure? Keep <b>Field order</b>
  - варианты: `by-section` Field order · `by-checkbox-list` Prefix order
  - старые названия для поиска: «Main checkbox priority», «Prefix Resolver»
- **Field order source** — `prefix-priority-source`, `dropdown`, path `pkm.prefixPriority.fieldOrderSource`, default `manual`
  - desc: Use the order your Fields are already in, or arrange a separate one
  - tip: <code>Field order</code> uses the order your Fields are already in, so you only keep one list. <code>Manual</code> gives this its own list, separate from the Blocks. Not sure? Keep <code>Field order</code>
  - варианты: `auto` Field order · `manual` Manual
  - видна если: `pkm.prefixPriority.decideBy`
  - старые названия для поиска: «Field order mode»
- **`field-order-list`** — свой блок, рендерер `renderFieldOrderList`
- **`prefix-order-list`** — свой блок, рендерер `renderPrefixOrderList`
- **Parent or child wins** — `prefix-priority-parent`, `dropdown`, path `pkm.prefixPriority.parentOrChild`, default `subtag-over-tag`
  - desc: When a tag and its child Value both carry a Prefix
  - tip: <code>Parent tag</code>: the broader Value wins. <code>Child tag</code>: the more specific one wins, so a child marked as done beats a parent that is only open
  - варианты: `tag-over-subtag` Parent tag · `subtag-over-tag` Child tag
  - старые названия для поиска: «Tag/Subtag priority»

#### Before you start — `transform-intro` (вкладка `transform`)

- **`transform-callout`** — свой блок, рендерер `renderTabCallout`

#### Inline to note — `inline-to-note` (вкладка `transform`)

_Intro:_ Press a key and the line you wrote becomes a note of its own, or is added to a note you already have. If you want, the line keeps a link to that note

_Tip:_ One press does three things: it picks the note, puts your text into it and tidies up your line. The groups below go in that order. Nothing happens until <code>Inline to note</code> just below is on

- **Inline to note** — `i2n-enabled`, `toggle`, path `transform.inline2note.enabled`, default `false`
  - desc: Allow this to create notes and add to notes you already have
  - tip: This is the main switch that lets the plugin write to your vault. Everything else on this tab only decides how. One press can add a note, change a note and edit your line, so make a backup first
  - старые названия для поиска: «Inline2Note enabled»
- **Templates folder** — `i2n-templates-folder`, `folder`, path `transform.inline2note.templatesFolder`, default `""`
  - desc: The folder your note templates live in
  - tip: A template is a normal note that each new note starts as a copy of. Templates in this folder appear in the lists below. Start typing to pick one of your folders. A new name is fine too: the folder is created the first time it is needed
  - видна если: `transform.inline2note.enabled`
- **Default template** — `i2n-default-template`, `dropdown`, path `transform.inline2note.defaultTemplate`, default `""`
  - desc: The template on creation of new note when no special rules apply (see <code>Smart Rules</code> below)
  - tip: Smart Rules below can pick a different template for certain lines. This one covers everything else. The list shows only notes from <code>Templates folder</code>, so set that first
  - варианты: 
  - видна если: `transform.inline2note.enabled`
- **New notes folder** — `i2n-output-folder`, `folder`, path `transform.inline2note.outputFolder`, default `""`
  - desc: Where to put the notes this creates. Leave it empty to keep them next to the note you are in
  - tip: Start typing to pick one of your folders. A new name is fine too: the folder is created when the first note goes into it
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «Output folder for new notes»
- **Floating button** — `i2n-floating`, `toggle`, path `transform.inline2note.floatingButton`, default `false`
  - desc: Put a small button at the end of the line you are on
  - tip: Clicking it does the same as pressing the key. The button only shows on screen and is never saved into your note
  - видна если: `transform.inline2note.enabled`
  - см. также: `i2n-button-preview` — See where it appears
  - старые названия для поиска: «Flying button»
- **Distance from the text** — `i2n-floating-gap`, `slider`, path `transform.inline2note.floatingButtonGap`, default `12`
  - desc: How much room to leave between the line and the button
  - tip: On a short line the button can sit so close that it looks like part of the text. <code>0</code> puts it right against the text. The widest setting puts it a whole word away
  - диапазон: 0–40, шаг 1, ед. px
  - видна если: `transform.inline2note.enabled, transform.inline2note.floatingButton`
  - см. также: `i2n-button-preview` — The preview below moves with it
  - старые названия для поиска: «Floating button gap», «Button offset»
- **`i2n-button-preview`** — свой блок, рендерер `renderFloatingButton`
- **Open note after creation** — `content-open`, `toggle`, path `transform.inline2note.openTarget`, default `false`
  - desc: Jump straight to the note once it is written
  - tip: Keep it on while you set things up, so you can see the result. Turn it off once you trust it, and you stay where you were writing
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «Open transformed note», «Open the note afterwards»

#### New note naming — `naming` (вкладка `transform`)

_Intro:_ Every new note needs a name. Here you choose where that name comes from

_Tip:_ The plugin tries three sources in order and takes the first that works: the text between your <code>Name brackets</code>, then a heading on the line, then the first few words

- **Note name** — `naming-mode`, `dropdown`, path `transform.inline2note.noteName.mode`, default `auto`
  - desc: Take the name from the line, or stop and ask you for it
  - tip: <b>Ask</b> opens a small box with the suggested name already filled in, so you can accept it or type your own. Pick it if you want to check each name before the note is made
  - варианты: `auto` From line · `manual` Ask
  - старые названия для поиска: «Note name mode»
- **Name brackets** — `naming-delimiters`, `text`, path `transform.inline2note.noteName.delimiters`, default `[]`
  - desc: Two characters. Whatever you put between them becomes the name
  - tip: With <code>()</code> here, the line <code>- call (Anna about the contract) || text</code> gives a note called <b>Anna about the contract</b>. Leave it empty and the name comes from a heading or the first words
  - старые названия для поиска: «Title delimiters», «Explicit name delimiters», «Name brackets»
- **Words to use instead** — `naming-word-count`, `number`, path `transform.inline2note.noteName.wordCount`, default `6`
  - desc: How many of the first words to use when there are no brackets
  - tip: With 3, the line <code>- draft the settings prototype today</code> becomes a note called <b>draft the settings</b>. Too few words and the names all look alike. Too many and they get long
  - диапазон: 1–20, шаг 1
  - старые названия для поиска: «Auto title word count»
- **If the name already taken** — `naming-collision`, `dropdown`, path `transform.inline2note.nameCollision.mode`, default `new_note`
  - desc: What to do when you already have a note with that name
  - tip: <b>New note</b> adds a number to the name and never touches your old note, so it is the safe choice. <b>Add to existing</b> suits a running log. <b>Overwrite</b> deletes the old contents for good, and the plugin cannot bring them back
  - варианты: `new_note` New note · `add_to_note` Add to existing · `overwrite` Overwrite
  - старые названия для поиска: «Name collision mode», «If the name is taken»

#### Note content — `note-content` (вкладка `transform`)

_Intro:_ What the new note looks like inside: where your text goes and what sits above it

_Tip:_ You make two choices here. First, where your text lands: at the top, at the end, or at the end of a section you name. The section option is handy when one note collects many entries. Second, what goes on the line above each entry to keep them apart: a date, a word of your own, or nothing. The rest of the note comes from the template you chose above

- **Where to put the text** — `content-position`, `dropdown`, path `transform.inline2note.placement.position`, default `end`
  - desc: At the top of the note, or after whatever is already there
  - tip: If you add to the same note again and again, like a diary or a call log, pick <b>at the end</b> to keep entries in the order you wrote them. <b>Under heading</b> puts each entry at the end of the section you name below. For a brand new note it makes no difference
  - варианты: `beginning` Beginning · `end` End · `custom-header` Under heading
  - старые названия для поиска: «Where to place inline text?»
- **Name of the heading** — `content-target-header`, `text`, path `transform.inline2note.placement.targetHeader`, default `""`
  - desc: The heading your text is filed under
  - tip: Type the heading as it appears in the note. With hashes, like <code>## Log</code>, only a heading of that level counts. Without them, any level does. Case does not matter, and if two headings match, the first one is used. If the heading is missing, it is created at the level you set here (no hashes means level 1)
  - видна если: `transform.inline2note.placement.position`
- **If heading not found** — `content-header-missing`, `dropdown`, path `transform.inline2note.placement.fallback`, default `end`
  - desc: Where the heading is added when the note has none
  - tip: A new note has no such heading yet, so it is <b>written for you</b> here, exactly as you named it above, and your text goes under it. Later entries find it and join the same section instead of starting a new one
  - варианты: `beginning` Beginning · `end` End
  - видна если: `transform.inline2note.placement.position`
- **Line above the text** — `content-header-mode`, `dropdown`, path `transform.inline2note.placement.headerMode`, default `datetime`
  - desc: Something to put above your text so entries stay apart
  - tip: In a note that collects many entries, a date or a word of your own above each entry keeps them from running together. Whether that line is a heading is set in the row below
  - варианты: `custom` Fixed text · `datetime` Date and time · `none` None
  - старые названия для поиска: «Inserted block header»
- **Line above is a heading** — `content-header-level`, `dropdown`, path `transform.inline2note.placement.headerLevel`, default `3`
  - desc: Make that line a heading you can fold, or leave it as plain text
  - tip: A heading folds and shows in the outline, which suits a note that collects many entries. The number sets the level: <code>1</code> is the biggest. You do not type the hashes because this row adds them
  - варианты: `0` Plain text · `1` 1 · `2` 2 · `3` 3 · `4` 4 · `5` 5 · `6` 6
  - видна если: `transform.inline2note.placement.headerMode`
- **Text of the line above** — `content-header-text`, `text`, path `transform.inline2note.placement.customHeader`, default `Captured`
  - desc: Typed into the note exactly as you write it here
  - tip: Type only the words. The hashes come from <code>Line above is a heading</code>, and any hashes you type here are removed
  - видна если: `transform.inline2note.placement.headerMode`
- **Date format** — `content-datetime`, `text`, path `transform.inline2note.placement.datetimeFormat`, default `YYYY-MM-DD HH:mm`
  - desc: Today’s date, written the way you set out here
  - tip: <code>YYYY</code> is the year, <code>MM</code> the month, <code>DD</code> the day and <code>HH mm ss</code> the time. Anything else stays as you typed it, so <code>YYYY-MM-DD</code> gives <b>2026-08-21</b>
  - видна если: `transform.inline2note.placement.headerMode`
  - старые названия для поиска: «Datetime header format»

#### Source line — `source-line` (вкладка `transform`)

_Intro:_ What happens to the line you pressed on, after the note is safely saved

_Tip:_ Your line changes only after the note is saved, so nothing is lost if saving fails. The plugin can replace your text with a link to the note, and it can add a mark that shows the line is done. Both are optional. With both off, the line looks untouched, and pressing again by mistake makes a second note

- **`source-preview`** — свой блок, рендерер `renderSourcePreview`
- **Sub-lines (tree) behavior** — `content-sublines`, `dropdown`, path `transform.inline2note.sublines`, default `stay`
  - desc: Leave them where they are, or take them into the note too
  - tip: Say the line has three sub-points. <b>Move</b> takes all four lines into the note and removes them from here. <b>Keep</b> copies all four into the note and leaves the sub-points where they are
  - варианты: `stay` Keep · `remove` Move
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «Sublines behavior»
- **What happens with current line** — `source-text`, `dropdown`, path `transform.inline2note.sourceProcessing.text`, default `remove`
  - desc: The text goes into the note either way — this is about the line you pressed on
  - tip: <b>Remove</b>: the line gets short and the link still points to your text. <b>Keep</b>: every word stays, which is good when you add to a note rather than move. <b>Keep without name</b>: the link replaces the words that became the name. <b>Keep first words</b>: the same, trimmed to <code>Words to keep</code>
  - варианты: `remove` Remove · `leave` Keep · `leave_named` Keep without name · `words` Keep first words
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «What happens to your text»
- **Words to keep** — `source-keep-words`, `number`, path `transform.inline2note.sourceProcessing.keepWords`, default `3`
  - desc: How much of the line stays behind
  - tip: Counted after the words that became the note name are gone, since the link takes their place. The rest of the text moves into the note. If the whole text became the name, only the link is left
  - диапазон: 1–20, шаг 1
  - видна если: `transform.inline2note.sourceProcessing.text`
- **Fields to keep** — `source-fields-head`, `note`
  - desc: Which Fields stay on the line you pressed on
  - tip: Ticked Fields stay on the line. Unticked ones go into the note with the text. A kept Field is still copied into the note as well. Tick nothing and the line keeps only your text and the mark
  - видна если: `transform.inline2note.enabled`
- **`source-fields`** — свой блок, рендерер `renderSourceFields`
- **Keep sub-fields** — `source-keep-sub`, `toggle`, path `transform.inline2note.sourceProcessing.keepSubFields`, default `false`
  - desc: A Field you keep keeps its child Values on the line too
  - tip: Child Fields have no row of their own in the list above. They follow their parent. Off: the kept Field stays on the line and its child Values go into the note. On: they stay on the line too, and a copy still goes into the note
  - видна если: `transform.inline2note.enabled`
- **Insert wikilink in current line** — `source-link`, `toggle`, path `transform.inline2note.sourceProcessing.replaceWithLink`, default `true`
  - desc: Put a link to the new note on the line you pressed on
  - tip: On: click the link on the line to open the note. Off, with the text removed: nothing on the line shows where it went, and pressing again by mistake makes a second note. The mark below is the usual way to prevent that
  - старые названия для поиска: «Replace payload with note link», «Leave a link behind»
- **Mark transformed line** — `source-marker`, `text`, path `transform.inline2note.sourceProcessing.token`, default `#processed`
  - desc: A word or tag added to the line so you can see it has been handled
  - tip: Type something like <code>#moved</code>. Then search for it to find everything you have filed, or hide those lines from a to-do list. Leave it empty to add nothing
  - старые названия для поиска: «Processed token», «Mark the line as done»
- **Where the mark goes** — `source-marker-position`, `dropdown`, path `transform.inline2note.sourceProcessing.panel`, default `right`
  - desc: Before your text, or after it
  - tip: The mark shows the line is already a note, so it is not done twice. The Left Block puts the mark with the tags. The Right Block keeps your sentence first. Pick whichever reads better to you
  - варианты: `left` Left Block · `right` Right Block
  - видна если: `transform.inline2note.sourceProcessing.token`
  - старые названия для поиска: «Processed token panel»
- **Dim transformed line** — `source-dim`, `toggle`, path `transform.inline2note.sourceProcessing.visual.enabled`, default `false`
  - desc: Fade a line once it carries the mark above, so your eye skips it
  - tip: Lines that are already notes stand out as much as the rest of the page. When they are faded, they stay in place and you can still search them, but they no longer catch your eye. Only the look changes. If you remove the mark by hand, the line goes back to normal
  - видна если: `transform.inline2note.sourceProcessing.token`
  - старые названия для поиска: «Dim the lines already filed»
- **Opacity of transformed line** — `source-dim-opacity`, `slider`, path `transform.inline2note.sourceProcessing.visual.opacity`, default `65`
  - desc: Zero leaves the line as it is, eighty makes it barely readable
  - tip: Only the look changes: the text stays whole, search still finds it and <code>Undo</code> still works. Use the least fade that lets your eye skip the line. Too much, and you may miss a line you still need to fix
  - диапазон: 0–80, шаг 5, ед. %
  - видна если: `transform.inline2note.sourceProcessing.token, transform.inline2note.sourceProcessing.visual.enabled`
  - старые названия для поиска: «How much is left»
- **Color of transformed line** — `source-dim-color`, `color`, path `transform.inline2note.sourceProcessing.visual.color`, default `""`
  - desc: Leave it unset to keep the color your theme gives the text
  - tip: Set it only if fading alone does not make finished lines easy to spot. Your color replaces the theme’s, and the fade above still applies
  - видна если: `transform.inline2note.sourceProcessing.token, transform.inline2note.sourceProcessing.visual.enabled`
  - старые названия для поиска: «Color of a filed line»

#### Auto-MOC in your links — `backlinks` (вкладка `transform`)

_Intro:_ When a line links to other notes, each of them can get a link back to the new note

_Tip:_ A line often names the notes it belongs to, like a project, a person or a place. With this on, each of them gets a link to the new note, so a project note slowly lists everything filed under it. Only links that are a Value of a Field count. Links inside your own sentence are left alone

- **Link the notes you mention** — `backlink-enabled`, `toggle`, path `transform.inline2note.backlink.enabled`, default `false`
  - desc: Write a link to the new note into the notes of the link Values on this line
  - tip: Links use the full path, so they find the right note even when two notes share a name. Only existing notes get the link. Missing Value notes are not created, but a navigator’s note is. A note that already links to the new one is left as it is
  - старые названия для поиска: «Create wikilink to transformed note in reference notes», «Backlinks into the notes you mention», «Automatic MOC»
- **Link to Navigator** — `backlink-navigator`, `toggle`, path `transform.inline2note.backlink.navigator`, default `false`
  - desc: Also write the link into the navigator note of a child link
  - tip: Normally a child link’s navigator gets nothing. With this on, the navigator note gets the link too, and a child under two navigators gets links from both. A missing navigator note is created empty. A Tag navigator is not a note, so nothing is written for it
  - видна если: `transform.inline2note.backlink.enabled`
- **Add empty line before wikilink** — `backlink-empty-line`, `toggle`, path `transform.inline2note.backlink.emptyLine`, default `true`
  - desc: Keep a blank line between the links written into a note
  - tip: <b>On</b>: each link gets an empty line above it and stands apart. <b>Off</b>: links go one under another as a tight list. This applies wherever the link goes, under a heading too
  - видна если: `transform.inline2note.backlink.enabled`
- **Where to put the link** — `backlink-position`, `dropdown`, path `transform.inline2note.backlink.placement.position`, default `end`
  - desc: At the top of that note, or after whatever is already there
  - tip: <b>End</b> keeps links in the order you filed them, which is best for a growing list. <b>Under heading</b> puts each link at the end of the section you name below
  - варианты: `beginning` Beginning · `end` End · `custom-header` Under heading
  - видна если: `transform.inline2note.backlink.enabled`
  - старые названия для поиска: «Where the backlink goes»
- **Name of the heading** — `backlink-target-header`, `text`, path `transform.inline2note.backlink.placement.targetHeader`, default `""`
  - desc: The heading the link is filed under
  - tip: Type the heading as it appears in the note. With hashes, like <code>## Log</code>, only a heading of that level counts. Without them, any level does. Case does not matter. If the heading is missing, it is created at the level you set here (no hashes means level 1)
  - видна если: `transform.inline2note.backlink.enabled, transform.inline2note.backlink.placement.position`
- **If heading not found** — `backlink-header-missing`, `dropdown`, path `transform.inline2note.backlink.placement.fallback`, default `end`
  - desc: Where the heading is added when that note has none
  - tip: If a note has no such heading, it is written for you here, exactly as you named it above, and the link goes under it. Later links find it and join the same section
  - варианты: `beginning` Beginning · `end` End
  - видна если: `transform.inline2note.backlink.enabled, transform.inline2note.backlink.placement.position`

#### Smart Rules — `smart-rules` (вкладка `transform`)

_Intro:_ Different kinds of line deserve different notes. A rule spots a kind of line and picks the template for it

_Tip:_ Rules are checked from the top and the first match wins. Lines that match no rule get the default template. Put narrow rules above broad ones, or the broad rule will match first. Drag a rule by its handle to change the order

- **`smart-rules-list`** — свой блок, рендерер `renderSmartRules`

#### Before you start — `visual-intro` (вкладка `visual`)

- **`visual-callout`** — свой блок, рендерер `renderTabCallout`

#### Inline appearance — `tag-appearance` (вкладка `visual`)

_Intro:_ Makes tagged lines easier to read: tags become small colored bubbles, and links and dates stay ordinary text. Your file stays exactly the same

_Tip:_ The <b>opacity</b> rows fade the tags, dates and links on each side so your own text stands out. <b>Line view</b> sets how big they are and adds a colored Stripe behind them. <b>Tag view</b> shapes the tag bubble. You set the colors of single Values on each Field, on the <code>Tags & PKM</code> tab

- **`tag-preview`** — свой блок, рендерер `renderTagPreview`
- **`line-view-sub`** — свой блок, рендерер `?`
- **Opacity of the Left Block** — `tags-opacity-left`, `slider`, path `visual.tags.opacityLeft`, default `100`
  - desc: Dims everything written before your text, tags and elements alike
  - tip: Faded is not hidden. Even at 0 the Left Block is still on the line, still searchable and still moved by the commands. Tip: turn it down a little so your sentence comes first
  - диапазон: 0–100, шаг 1, ед. %
  - см. также: `field-editor` — Tag colors are set per Value under Fields
  - старые названия для поиска: «Opacity Left»
- **Opacity of the Right Block** — `tags-opacity-right`, `slider`, path `visual.tags.opacityRight`, default `100`
  - desc: Dims everything written after your text, tags and elements alike
  - tip: This is separate from the left side because dates and links after your text usually need less attention than the tags before it. Even at 0 everything is still there and still works
  - диапазон: 0–100, шаг 1, ед. %
  - старые названия для поиска: «Opacity Right»
- **Left Block text size** — `tags-text-size-left`, `slider`, path `visual.tags.textSizePctLeft`, default `100`
  - desc: How big everything before your text is written, next to the rest of your note
  - tip: Tags, dates and links all change size together. Your own text keeps its size. Below 100 the Block steps back and your sentence leads. Above 100 the Block competes with it
  - диапазон: 50–140, шаг 5, ед. %
  - старые названия для поиска: «Tag text size», «Text size Left»
- **Right Block text size** — `tags-text-size-right`, `slider`, path `visual.tags.textSizePctRight`, default `100`
  - desc: How big everything after your text is written, next to the rest of your note
  - tip: This is separate from the left side because dates and links after your text often read better a size smaller, while the tags before it stay as they are. Your own text keeps its size either way
  - диапазон: 50–140, шаг 5, ед. %
  - старые названия для поиска: «Tag text size», «Text size Right»
- **Color the Block with Stripe** — `tags-block-fill`, `toggle`, path `visual.tags.blockFill.enabled`, default `false`
  - desc: A Stripe behind the Left Block and the Right Block, so the two stand out from your text
  - tip: The Stripe runs from the first Value of a Block to the last one. Your own text and empty Blocks get no Stripe, and everything on the line stays clickable. A single tag bubble can hide the Stripe, so raise <code>Stripe height</code> or <code>Stripe width</code> to make it show
  - старые названия для поиска: «Block background», «Color the Blocks»
- **Stripe direction** — `tags-block-fill-direction`, `dropdown`, path `visual.tags.blockFill.direction`, default `both`
  - desc: Which of the two Blocks gets a Stripe
  - tip: <code>Both</code> is the usual choice. Pick <code>Left</code> or <code>Right</code> when you read one side and the other side is just bookkeeping. Empty Blocks and your own text never get a Stripe
  - варианты: `left` Left · `right` Right · `both` Both
  - видна если: `visual.tags.blockFill.enabled`
- **Stripe color** — `tags-block-fill-color`, `color`, path `visual.tags.blockFill.color`, default `""`
  - desc: Leave it unset and the Stripe follows your theme
  - tip: Unset uses your theme’s accent color, so the Stripe still fits when you switch themes. Pick a color only if you want a specific one
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Block color»
- **Stripe opacity** — `tags-block-fill-opacity`, `slider`, path `visual.tags.blockFill.opacity`, default `12`
  - desc: How strongly the Stripe shows through
  - tip: Keep it low: the Stripe should catch your eye without covering the writing. Around a tenth is enough to see where a Block starts and ends
  - диапазон: 0–100, шаг 1, ед. %
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Block color strength»
- **Stripe height** — `tags-block-fill-height`, `slider`, path `visual.tags.blockFill.heightPct`, default `60`
  - desc: How far the Stripe reaches above and below the writing
  - tip: At <code>0</code> the Stripe is exactly as tall as the writing, so a single tag bubble can hide it. At <code>100</code> it fills the whole line, and the Stripes of neighboring lines meet without overlapping. Every step in between changes the Stripe on any theme
  - диапазон: 0–100, шаг 20, ед. %
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Band height»
- **Stripe width** — `tags-block-fill-width`, `slider`, path `visual.tags.blockFill.widthPct`, default `50`
  - desc: How far the Stripe reaches past the Block on both of its sides
  - tip: At <code>0</code> the Stripe covers only the Values. At <code>50</code> it reaches the Separator next to your text. At <code>100</code> it covers the Separator too. On the Left Block it never covers the bullet or the checkbox
  - диапазон: 0–100, шаг 5, ед. %
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Band width»
- **`tag-view-sub`** — свой блок, рендерер `?`
- **Tag bubble width** — `tags-bubble-width`, `slider`, path `visual.tags.bubbleWidthPct`, default `100`
  - desc: How much breathing room there is either side of the word
  - tip: The word keeps its size, and only the bubble around it grows. Turned down, the word sits almost at the edge of the bubble. Above 100, tags look like separate chips even in a crowded Block
  - диапазон: 20–140, шаг 5, ед. %
  - старые названия для поиска: «Tag bubble size - width», «Bubble width»
- **Tag bubble height** — `tags-bubble-height`, `slider`, path `visual.tags.bubbleHeightPct`, default `100`
  - desc: How tall the bubble is around the word
  - tip: Keep it modest: tall bubbles push the lines of your note apart and make the page harder to read. Turned down, the bubble hugs the word above and below
  - диапазон: 20–140, шаг 5, ед. %
  - старые названия для поиска: «Tag bubble size - height», «Bubble height»
- **Tag bubble corners** — `tags-corners`, `slider`, path `visual.tags.cornersPct`, default `0`
  - desc: Slide from fully rounded to completely square
  - tip: At 0 the bubble is a pill, and at 100 it is a rectangle. The color, padding and text size stay the same. Square corners look denser and go well with narrow bubbles
  - диапазон: 0–100, шаг 1
  - старые названия для поиска: «Tag shape», «Bubble corners»
- **Empty tag bubble width** — `tags-empty-bubble`, `slider`, path `visual.tags.emptyBubblePct`, default `100`
  - desc: Width of a bubble whose <code>Show</code> is set to <code>empty</code>
  - tip: Under <code>Fields</code> you can set a Value to <code>empty</code>. It then shows its color but no text, like a marker. This row sets how wide that marker is
  - диапазон: 10–180, шаг 5, ед. %
  - см. также: `field-editor` — Set a Value to empty under Fields
  - старые названия для поиска: «Empty bubble size», «Empty bubble width»
- **`link-view-sub`** — свой блок, рендерер `?`
- **Preview on hover** — `link-hover-preview`, `toggle`, path `visual.tags.linkShown.hoverPreview`, default `false`
  - desc: Hovering a Value shown as your own text opens the page preview — hold <code>Ctrl</code> while hovering
  - tip: This works like Obsidian’s own <code>Page preview</code>: hold <code>Ctrl</code> (<code>Cmd</code> on macOS) while you hover. To open the preview by hovering alone, turn off the modifier key for <code>Page preview → Source mode</code>. Off by default, because a preview popping up over the line you are writing can get in the way
  - старые названия для поиска: «Link hover preview», «Custom link preview»
- **Drag to move** — `link-draggable`, `toggle`, path `visual.tags.linkShown.draggable`, default `false`
  - desc: Drag a Value shown as your own text into another note
  - tip: Drop the Value into another note and you get a link to the same note, just like with an ordinary link. Off by default because it is easy to grab by accident. While it is on, pressing the Value starts a drag instead of placing the cursor
  - старые названия для поиска: «Link drag», «Custom link drag»
- **Link target color** — `link-target-color`, `color`, path `visual.tags.linkAsWritten.targetColor`, default `""`
  - desc: What you read in a wikilink: the name between <code>[[</code> and <code>]]</code>
  - tip: Colors the note name in a wikilink, which is a link Value with <code>Show</code> = <code>default</code>. Hyperlinks have their own rows below. Leave it empty to keep your theme’s link color
  - старые названия для поиска: «Link color», «Wikilink color», «Link text color»
- **Link brackets color** — `link-brackets-color`, `color`, path `visual.tags.linkAsWritten.bracketsColor`, default `""`
  - desc: The markup around it: <code>[[</code> and <code>]]</code>
  - tip: Colors <code>[[</code> and <code>]]</code> differently from the name. You see it in the previews here and on the line your cursor is on. Everywhere else Obsidian hides the brackets, so there is nothing to color. Leave it empty to keep your theme’s color
  - старые названия для поиска: «Bracket color», «Wikilink brackets»
- **Hyperlink target color** — `hyperlink-target-color`, `color`, path `visual.tags.hyperlink.targetColor`, default `""`
  - desc: The text you read in a Markdown link — what stands between the square brackets
  - tip: Colors the text in <code>[a link](an address)</code>. Addresses use <code>Hyperlink address color</code> below. This works in every note. Links inside backticks and images are not changed. Leave it empty to keep your theme’s link color
  - старые названия для поиска: «Hyperlink color», «External link color», «URL color»
- **Hyperlink brackets color** — `hyperlink-brackets-color`, `color`, path `visual.tags.hyperlink.bracketsColor`, default `""`
  - desc: The markup around it: the square brackets and the round ones, without the address
  - tip: Colors only <code>[</code>, <code>](</code> and <code>)</code>. The address has its own row below. You see it in the preview and on the line your cursor is on. Everywhere else Obsidian hides the brackets. Leave it empty to keep your theme’s color
  - старые названия для поиска: «Hyperlink brackets», «URL markup color», «Address color»
- **Hyperlink address color** — `hyperlink-address-color`, `color`, path `visual.tags.hyperlink.addressColor`, default `""`
  - desc: The address itself — inside the round brackets, or written on its own
  - tip: Colors every address, both inside <code>[a link](an address)</code> and on its own, like <code>https://…</code> or <code>www.…</code>. An address on its own is always colored. An address inside brackets is colored only on the line your cursor is on. Leave it empty to keep your theme’s color
  - старые названия для поиска: «Address color», «URL color», «Link href color»
- **`link-preview`** — свой блок, рендерер `renderLinkPreview`

#### Tag Bars — `tag-bars` (вкладка `visual`)

_Intro:_ A colored Bar in the margin shows at a glance what a line and everything nested under it is about, without reading the tags

_Tip:_ Bars take their colors from the Values of one tag Field, which you choose below. Links and dates have no colors, so they can’t draw Bars. A Bar runs down its line and everything nested under it. A deeper line with its own Value gets its own Bar beside it. Your text does not move, and once the Bar shows the Value you can hide the tag

- **`bars-preview`** — свой блок, рендерер `renderBarsPreview`
- **Tag Bars** — `bars-active`, `toggle`, path `visual.tagBars.active`, default `false`
  - desc: Draw the Bars
  - tip: Bars show without any text which Value a line has and how deep it sits in the list. They use the colors you already gave the Values, so you don’t color anything twice. Turn it off to hide the Bars and keep the settings below
  - старые названия для поиска: «Activate strip», «Strip», «Hierarchy Bars», «Level Bars»
- **Which Field draws Bars** — `bars-field`, `dropdown`, path `visual.tagBars.fieldId`, default `""`
  - desc: Bars work with tag Fields only, and only for the one chosen here
  - tip: Pick the one thing you look for on a page, usually progress or urgency. Only your tag Fields are listed, because a Bar uses the color of a Value
  - варианты: `` None
  - видна если: `visual.tagBars.active`
  - см. также: `field-editor` — Bar colors are the Value colors under Fields
  - старые названия для поиска: «Strip Field»
- **Number of Bars** — `bars-count`, `slider`, path `visual.tagBars.stripesToShow`, default `2`
  - desc: How far down the nesting to keep drawing them
  - tip: At 1 only the parent line gets a Bar. At 2 a child with its own Value gets a second Bar. At 3 a grandchild gets a third. A line without a Value never gets a Bar
  - диапазон: 1–3, шаг 1
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Stripes to show»
- **Show the Field’s tag** — `bars-show-tag`, `toggle`, path `visual.tagBars.tagVisibility`, default `true`
  - desc: Keep the tag on the line, or let the Bar speak for it
  - tip: The Bar already shows the Value by its color, so the tag is often not needed. Hide the tag to free up room on the line. The tag stays in your note and stays searchable
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip tag visibility»
- **Hide the leftover marker** — `bars-hide-separator`, `toggle`, path `visual.tagBars.hideSeparatorWhenOnlyStripToken`, default `false`
  - desc: Tidy away a Separator that has nothing left beside it
  - tip: If the hidden tag was the only thing before your text, a lone Separator is left at the start of the line. This setting hides it
  - видна если: `visual.tagBars.active, visual.tagBars.tagVisibility`
  - старые названия для поиска: «Hide Separator?»
- **Bar arrangement** — `bars-mode`, `dropdown`, path `visual.tagBars.mode`, default `default`
  - desc: Which lane each level of the tree draws its Bar in
  - tip: With <b>parent keeps the outer lane</b>, each level of the list always uses the same lane, so you can count the nesting from the left. With <b>lanes rotate</b>, each level takes the next lane in turn. Deep lists stay narrower, but a lane no longer tells you the level
  - варианты: `default` Parent outside · `crossing` Rotate
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip mode»
- **Bar thickness** — `bars-thickness`, `slider`, path `visual.tagBars.thickness`, default `2`
  - desc: How wide each Bar is
  - tip: One width for all Bars, because Bars of different widths look like a mistake. Thin Bars suit dense notes. Wide Bars are easier to tell apart when your Value colors are similar
  - диапазон: 1–12, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip thickness»
- **Space between Bars** — `bars-gap`, `slider`, path `visual.tagBars.childOffset`, default `12`
  - desc: The gap between one level and the next
  - tip: The space between the lanes of two levels. With little space a deep list looks like one ribbon. With more space the levels stay apart, but there is less room for your text
  - диапазон: 2–20, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Parent/child strip distance»
- **Distance from the text** — `bars-distance`, `slider`, path `visual.tagBars.spacing`, default `20`
  - desc: How far the Bars sit from where your line begins
  - tip: Moves all the Bars together, away from your text. Increase it if your notes are indented and the Bars crowd the list markers
  - диапазон: 8–48, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip spacing»
- **Vertical gap between Bars** — `bars-line-gap`, `slider`, path `visual.tagBars.lineGap`, default `2`
  - desc: Blank left above and below a Bar, so two lines in a row stay apart
  - tip: Without a gap, the Bars of lines one under another merge into one, and you can’t tell which part belongs to which line. A small gap separates them, and a bigger number makes each Bar shorter. At <code>0</code> the Bars touch again
  - диапазон: 0–8, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Bar height»
- **Bars for the whole tree** — `bars-whole-tree`, `toggle`, path `visual.tagBars.drawWholeTree`, default `true`
  - desc: A Bar runs down everything nested under its line, not just the line itself
  - tip: When on, a Bar runs down its line and everything indented under it, so a nested line can carry several Bars. When off, each Bar covers only its own line, lines without their own Value get no Bar, and <code>Join Bars in a tree</code> has no effect
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Draw bars for the whole tree», «Bars for subtree»
- **Join Bars in a tree** — `bars-join-tree`, `toggle`, path `visual.tagBars.joinTree`, default `true`
  - desc: A parent and its own children draw one unbroken Bar
  - tip: The gap between lines also cuts a Bar that runs down through nested lines. With this on, there is no gap where a Bar continues from a parent into its children. Lines that are not related stay apart
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Tree gap»

#### tagWheel — `tagwheel` (вкладка `visual`)

_Intro:_ tagWheel is a picker that opens over the line. Your Fields run across it and the Values of the current Field run down. You pick a Value by looking instead of remembering a hotkey for each Field

_Tip:_ Every Field has its own pair of hotkeys, which is too many to remember. Instead, one command opens the picker over the line. Left and right move between Fields, and up and down move between Values. <code>Tab</code> jumps to the Fields on the other side of your text, and <code>Escape</code> closes it without changing anything. The settings below control how it looks

- **`wheel-preview`** — свой блок, рендерер `renderWheelPreview`
- **`panel-sub`** — свой блок, рендерер `?`
- **Show tag markers** — `panel-markers`, `toggle`, path `visual.tagWheel.showMarkers`, default `true`
  - desc: Show the hash and emoji in the picker, or just the words
  - tip: Words alone are quicker to read than words with hashes in front. What goes into your note is the same either way
  - старые названия для поиска: «Show Prefix»
- **tagWheel Value names** — `panel-value-names`, `dropdown`, path `visual.tagWheel.valueNames`, default `default`
  - desc: What the picker prints for a Field that already carries a Value
  - tip: <code>Default</code> shows the Value as it is written in your line. <code>Custom</code> shows the custom text set for the Value under Fields (<code>Show</code> = <code>custom</code>), such as an emoji or a short word. <code>Custom + default</code> shows both, with the custom text first. If a Value has no custom text, all three show the written Value
  - варианты: `default` Default · `custom` Custom · `both` Custom + default
  - старые названия для поиска: «Value names», «Custom text in the picker», «Printed name»
- **Highlight the tagWheel line** — `panel-highlight`, `toggle`, path `visual.tagWheel.highlightLine`, default `true`
  - desc: Mark the line while the picker is open, so it stands out from the page
  - tip: On a busy page the picker is hard to tell from your note. When on, the line is wrapped in <code>==</code> while the picker is open. <code>Background color</code> below sets the color, and without it Obsidian uses its own highlight. The marks go away when the picker closes, and nothing is left in your note
  - старые названия для поиска: «Highlight the line»
- **Inactive Field text color** — `panel-text-color`, `color`, path `visual.tagWheel.textColor`, default `""`
  - desc: The color of the Field names you are not standing on, while the line is marked
  - tip: Works only while <code>Highlight the tagWheel line</code> is on. The box of neighboring Values below uses your theme’s colors and is not affected
  - старые названия для поиска: «Text color»
- **Bold Field names** — `panel-bold-names`, `toggle`, path `visual.tagWheel.boldFieldNames`, default `false`
  - desc: Print every Field that shows its own name in bold, while the line is marked
  - tip: Off: only the Field you are on is bold. On: every Field that still shows its name is bold, so the Fields without a Value stand out. Fields that have a Value stay regular. Needs <code>Highlight the tagWheel line</code> on
  - старые названия для поиска: «Bold names», «Empty Fields in bold»
- **Active Field text color** — `panel-active-color`, `color`, path `visual.tagWheel.activeTextColor`, default `""`
  - desc: The color of the Field you are on, while the line is marked
  - tip: The up and down keys move through the Field you are on. Without its own color, only bold text tells it apart, which is easy to miss on a line with many Fields. Leave it empty to use <code>Inactive Field text color</code>
  - старые названия для поиска: «Current Field color»
- **Chosen Value text color** — `panel-chosen-color`, `color`, path `visual.tagWheel.chosenValueColor`, default `""`
  - desc: The color of a Field that already carries a Value, while the line is marked
  - tip: Gives Fields that already have a Value their own color, so one glance shows which Fields on the line are filled in. Leave it empty to use <code>Inactive Field text color</code>. The Field you are on has its own row above
  - старые названия для поиска: «Chosen value color», «Picked value color»
- **Background color** — `panel-background`, `color`, path `visual.tagWheel.fillColor`, default `""`
  - desc: The color behind the picker, while the line is marked
  - tip: Pick a color solid enough to read on, since the picker covers your text. Needs <code>Highlight the tagWheel line</code> on
  - старые названия для поиска: «Background»
- **`scroller-sub`** — свой блок, рендерер `?`
- **Scroller** — `scroller-enabled`, `toggle`, path `visual.tagWheel.scroller.enabled`, default `false`
  - desc: Show the next and previous Values around the current one
  - tip: When off, you see only the current Value and step through blindly. When on, you see what is coming, which makes long lists much quicker to go through
  - старые названия для поиска: «tagWheel Scroller»
- **Scroller opening direction** — `scroller-direction`, `dropdown`, path `visual.tagWheel.scroller.direction`, default `full`
  - desc: Which way the Values unroll from the Field you are on
  - tip: <code>Up</code> keeps your line at the bottom of the box, and your note stays visible below it. <code>Down</code> does the opposite. <code>Both</code> puts the current Value in the middle and is easiest to read when a Field has many Values
  - варианты: `up` Up · `down` Down · `full` Both
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller direction», «Opens»
- **Scroller Value names** — `scroller-labels`, `dropdown`, path `visual.tagWheel.scroller.labels`, default `value`
  - desc: What the box shows for each neighboring Value
  - tip: <code>Default</code> shows the Value as it is written in your line. <code>Custom</code> shows the custom text set for the Value under Fields (<code>Show</code> = <code>custom</code>), such as an emoji or a short word. <code>Custom + default</code> shows both, with the custom text first. If a Value has no custom text, all three show the written Value
  - варианты: `value` Default · `custom` Custom · `both` Custom + default
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller names», «Custom text in the scroller», «Printed name», «As written», «Custom text when set»
- **Scroller background color** — `scroller-fill`, `color`, path `visual.tagWheel.scroller.fillColor`, default `""`
  - desc: The color behind the box of neighboring Values
  - tip: Leave it empty to use your theme’s popup color. Set a color to make the box stand out from your note, for example on a pale theme
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller background»
- **Scroller text color** — `scroller-text`, `color`, path `visual.tagWheel.scroller.textColor`, default `""`
  - desc: The color of the Values you are not on, inside the box
  - tip: Leave it empty to use your theme’s text color. The Value you are on is not in the box. It shows in the line, colored by <code>Active Field text color</code>
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller text»
- **Scroller size** — `scroller-size`, `slider`, path `visual.tagWheel.scroller.size`, default `3`
  - desc: How many neighboring Values stay visible around the current one
  - tip: This counts the Values on each side, not in total. A small number keeps the box out of the way. A large number shows every Value of a short Field at once
  - диапазон: 1–20, шаг 1
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Values per side»

#### Text cursor — `text-cursor` (вкладка `visual`)

_Intro:_ The blinking line that shows where your typing goes. Give it its own color so it stops getting lost on the page

_Tip:_ By default the cursor is the same color as your text, so in long notes or one-color themes it is easy to lose. Pick a color you use nowhere else and it stands out at a glance. This changes the cursor in your notes only. This window and the search box keep their usual cursor

- **Color the text cursor** — `caret-enabled`, `toggle`, path `visual.caret.enabled`, default `false`
  - desc: Draw the blinking caret in a color you pick instead of the color of your text
  - tip: When off, your theme decides the cursor color. When on, the color below is used, only in the editor
  - старые названия для поиска: «Caret color», «Cursor color»
- **Cursor color** — `caret-color`, `color`, path `visual.caret.color`, default `""`
  - desc: The color of the blinking caret in your notes
  - tip: Leave it empty to keep your theme’s color. For the cursor to stand out, pick a color your page does not already use
  - видна если: `visual.caret.enabled`
  - старые названия для поиска: «Caret»
- **Shape the text cursor** — `caret-shape`, `toggle`, path `visual.caret.shapeEnabled`, default `false`
  - desc: Set how thick the caret is and how fast it blinks, instead of taking both from your theme
  - tip: This works separately from the color, and you can use either one alone. When off, the cursor keeps the thickness and blinking your theme and Obsidian give it
  - старые названия для поиска: «Caret width», «Cursor blink», «Caret thickness»
- **Cursor width** — `caret-width`, `slider`, path `visual.caret.width`, default `2`
  - desc: How thick the caret is drawn, in pixels
  - tip: Obsidian’s cursor is about one pixel wide, which is easy to miss on a bright background or a large screen. Two or three pixels is easy to find and still doesn’t look like a selection
  - диапазон: 1–8, шаг 1, ед. px
  - видна если: `visual.caret.shapeEnabled`
  - старые названия для поиска: «Caret thickness»
- **Blink speed** — `caret-blink`, `slider`, path `visual.caret.blinkSpeed`, default `5`
  - desc: How fast the caret blinks, from not blinking at all to very fast
  - tip: At <code>0</code> the cursor stops blinking, which is the calmest setting. <code>5</code> is Obsidian’s current speed, and each step above it blinks faster
  - диапазон: 0–10, шаг 1
  - видна если: `visual.caret.shapeEnabled`
  - старые названия для поиска: «Blink rate», «Cursor blinking»
- **`caret-preview`** — свой блок, рендерер `renderCaretPreview`

#### Cursor jump highlight — `jump-highlight` (вкладка `visual`)

_Intro:_ After a jump, the cursor is hard to find again. This shows a circle where it lands, and the circle shrinks away by itself

_Tip:_ The circle only appears on screen for a moment. Nothing is written into your note. It shows only on jumps, not when you type or use the arrow keys. The last row decides whether short hops within one line count as jumps too

- **Highlight where you land** — `jump-flash`, `toggle`, path `visual.jumpFlash.enabled`, default `false`
  - desc: Draw a fading circle where the cursor lands, so you do not hunt for it
  - tip: The circle shows only on jumps, not when you type or use the arrow keys. Nothing is written into your file
  - старые названия для поиска: «Flash on jump», «Highlight the jump target», «Show me where the cursor went»
- **Highlight color** — `jump-flash-color`, `color`, path `visual.jumpFlash.color`, default `""`
  - desc: Leave it unset to use the accent color of your theme
  - tip: Unset uses your theme’s accent color, so the circle matches the editor. Pick your own if the accent color is too faint on your background
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Color of the jump circle»
- **Highlight size** — `jump-flash-radius`, `slider`, path `visual.jumpFlash.radius`, default `18`
  - desc: How wide the circle is at the moment it appears
  - tip: Too small, and it is no easier to spot than the cursor. Too large, and it covers the words you jumped to until it fades
  - диапазон: 6–40, шаг 1, ед. px
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Size of the jump circle»
- **How long it lasts** — `jump-flash-fade`, `slider`, path `visual.jumpFlash.fadeMs`, default `450`
  - desc: The time the circle takes to shrink and disappear
  - tip: A short time just catches the corner of your eye. A long time gets annoying when you jump several times in a row. To skip the circle while you jump quickly, use the row below
  - диапазон: 100–1500, шаг 50, ед. ms
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Fade speed of the jump circle»
- **Minimum time between jumps** — `jump-flash-delay`, `slider`, path `visual.jumpFlash.quietMs`, default `0`
  - desc: Jumps closer together than this get no circle at all
  - tip: If you hold a key down, the circle would flash on every step. Set a minimum time and only the jump you stop on gets a circle. At <code>0</code> every jump gets a circle
  - диапазон: 0–1000, шаг 50, ед. ms
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Do not flash on every jump», «Quiet time»
- **Use inside current line** — `jump-flash-inline`, `toggle`, path `visual.jumpFlash.inLine`, default `false`
  - desc: Also mark the cursor when it hops between the parts of one line
  - tip: <code>Jump left</code> and <code>Jump right</code> move the cursor only a short way, so it usually stays where you are looking. Turn this on if you lose the cursor on long lines too
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Flash on in-line jumps»
- **`jump-flash-preview`** — свой блок, рендерер `renderJumpFlashPreview`

#### Color custom tags — `user-tag-colors` (вкладка `visual`)

_Intro:_ Colors for tags you type yourself that are not a Value of any Field in <code>Tags & PKM → Fields</code>. These tags still get a bubble, and here you choose how it looks

_Tip:_ Each row is one tag. You set the bubble color, the text color, and whether it shows the word, the word with its hash, or nothing. Values of a Field get their colors on <code>Tags & PKM</code>. Use these rows for every other tag, including tags added by other plugins. Leave a color unset and the tag follows your theme

- **`user-tag-list`** — свой блок, рендерер `renderUserTagColors`

### Все пути состояния

| path | kind | default |
|------|------|---------|
| `advanced.backups.autosave` | toggle | `false` |
| `advanced.backups.autosaveKeep` | text | `""` |
| `advanced.backups.beforeRestore` | toggle | `true` |
| `advanced.backups.folder` | text | `inlineOverhaul/Backups` |
| `advanced.devMode.aiLog` | toggle | `false` |
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
| `editor.smartEnter.shiftPlainEnter` | toggle | `false` |
| `editor.smartEnter.useShift` | toggle | `false` |
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
| `navigation.moveLine.highlightColor` | color | `""` |
| `navigation.moveLine.highlightMovedLines` | toggle | `false` |
| `navigation.moveLine.jumpNeighborTrees` | toggle | `false` |
| `navigation.moveLine.keepInView` | toggle | `true` |
| `navigation.moveLine.noSelectionMode` | dropdown | `line-only` |
| `navigation.moveLine.viewPosition` | dropdown | `center` |
| `navigation.moveSelection.indentFallbackEnabled` | toggle | `true` |
| `navigation.moveSelection.indentWithChildren` | toggle | `false` |
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
| `pkm.behavior.doneMarker.panel` | dropdown | `right` |
| `pkm.behavior.doneMarker.strike` | toggle | `false` |
| `pkm.behavior.doneMarker.token` | text | `""` |
| `pkm.behavior.doneMarker.visual.color` | color | `""` |
| `pkm.behavior.doneMarker.visual.enabled` | toggle | `false` |
| `pkm.behavior.doneMarker.visual.opacity` | slider | `65` |
| `pkm.lineFormat.separator1` | text | `||` |
| `pkm.lineFormat.separator2` | text | `||` |
| `pkm.placement.bulletInStrict` | toggle | `false` |
| `pkm.placement.fieldPrefixInsertOnly` | toggle | `true` |
| `pkm.placement.typedTagsStayText` | toggle | `true` |
| `pkm.prefixPriority.decideBy` | dropdown | `by-section` |
| `pkm.prefixPriority.fieldOrderSource` | dropdown | `manual` |
| `pkm.prefixPriority.parentOrChild` | dropdown | `subtag-over-tag` |
| `transform.inline2note.backlink.emptyLine` | toggle | `true` |
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
| `visual.tagWheel.boldFieldNames` | toggle | `false` |
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
| `visual.tagWheel.selectionLine` | dropdown | `top` |
| `visual.tagWheel.showMarkers` | toggle | `true` |
| `visual.tagWheel.textColor` | color | `""` |
| `visual.tagWheel.valueNames` | dropdown | `default` |
