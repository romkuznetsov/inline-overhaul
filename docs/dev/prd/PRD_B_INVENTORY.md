## Приложение B. Опись целевого состояния

Сгенерировано из `docs/prototype/settings_prototype.html` командой:

```
python tests/prototype/update_prd.py
```

Руками не правится. При изменении прототипа опись перегенерируется, и её diff показывает, что именно изменилось в текстах.

### Вкладки и группы (снято с прототипа)

| # | Вкладка | Тумблер модуля | Групп | Настроек | Своих блоков |
|---|---------|----------------|-------|----------|--------------|
| 1 | General | — | 4 | 9 | 2 |
| 2 | Keyboard | — | 4 | 16 | 8 |
| 3 | Navigation | `features.navigation.enabled` | 5 | 28 | 5 |
| 4 | Tags & PKM | `features.pkm.enabled` | 7 | 23 | 5 |
| 5 | Transform | `features.transform.enabled` | 7 | 35 | 5 |
| 6 | Visual | `features.visual.enabled` | 7 | 58 | 13 |
| 7 | Advanced | — | 3 | 10 | 1 |

### Группы по порядку


**General** (`general`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 5 | `brand-intro` | inlineOverhaul | — | — | — |
| 10 | `general-intro` | Before you start | — | — | `general.help.showCallouts` |
| 100 | `help` | Help | The language of the panel, where to start, and how much help you want along the way | да | — |
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
| 300 | `writing-rules` | Writing rules | The small habits: what is left when a line empties, and where the cursor waits afterwards | да | — |
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

_Tip:_ A backup is a note with all your settings, such as <code>Settings 2026-10-04 14-30-05.md</code> ⏎ - <b>Save a backup</b> — adds a new note each time and never overwrites old ones. You delete old backups yourself ⏎ - <b>Restore a backup</b> — replaces <b>everything</b> on every tab, then asks you to restart ⏎ To move your setup to another computer, sync your vault and restore the backup there

- **Backup folder** — `backup-folder`, `text`, path `advanced.backups.folder`, default `inlineOverhaul/Backups`
  - desc: Where in your vault the backups are kept
  - tip: Pick any folder. It is created when you save your first backup. Backups are regular notes, so they sync with the rest of your vault ⏎ - <b>Backups</b> — <code>Backups/Settings 2026-10-04 14-30-05.md</code> ⏎ - <b>Empty</b> — <code>inlineOverhaul/Backups/Settings 2026-10-04 14-30-05.md</code>
- **Autosave** — `backup-autosave`, `toggle`, path `advanced.backups.autosave`, default `false`
  - desc: Each time Obsidian starts, keep a copy of your settings if they differ from the last one
  - tip: Catches settings that arrive from sync, another device or a copied file, so you can always go back ⏎ - <b>On</b> — when Obsidian starts and your settings changed, a copy goes to the <code>autosave</code> subfolder: <code>autosave/Settings 2026-10-04 14-30-05_autosave.md</code>. It holds every tab plus this plugin’s hotkeys and lists <code>What changed</code> ⏎ - <b>Off</b> — no copies ⏎ To undo one change, use the command <code>Undo last settings change</code>
- **Autosaves to keep** — `backup-autosave-keep`, `text`, path `advanced.backups.autosaveKeep`, default `""`
  - desc: How many autosaves stay; when there are more, the oldest ones are removed
  - tip: When there are more autosaves than this, the oldest ones are removed. Backups you save yourself are always kept ⏎ - <b>3</b> — a fourth autosave removes the oldest, so 3 stay ⏎ - <b>Empty</b> — 10 stay
  - видна если: `advanced.backups.autosave`
- **Save a backup before restoring** — `backup-before-restore`, `toggle`, path `advanced.backups.beforeRestore`, default `true`
  - desc: Write what you have now into the folder above before an earlier backup replaces it
  - tip: - <b>On</b> — each restore first saves what you have now, as <code>Settings 2026-10-04 14-30-05 Autogenerated.md</code>, so you can go back ⏎ - <b>Off</b> — restoring writes straight over your settings, with no way back ⏎ Turn it off only if you restore often and the extra copies pile up
- **Your settings** — `settings-backup-actions`, `buttons`
  - desc: Save what you have set up now, or bring back an earlier backup
  - tip: - <b>Save a backup</b> — adds a new note each time: <code>Settings 2026-10-04 14-30-05.md</code>. Old ones stay until you delete them ⏎ - <b>Restore a backup</b> — replaces <b>everything</b> on every tab, then asks you to restart ⏎ The toggle above decides whether your current settings are saved first, as a copy ending in <code>Autogenerated</code>
  - кнопки: `save-backup` Save a backup · `restore-backup` Restore a backup
- **Start over** — `settings-reset-actions`, `buttons`
  - desc: Delete everything you have set up here and go back to the plugin’s own defaults
  - tip: - <b>Delete all my settings</b> — deletes every tab, Field, Value, rule, Binder row and the hotkeys of this plugin’s commands. Other plugins’ hotkeys stay ⏎ A copy like <code>Settings 2026-10-04 14-30-05 Autogenerated.md</code> is always saved first, whatever the toggle says, so <code>Restore a backup</code> brings everything back
  - кнопки: `reset-settings` Delete all my settings

#### Diagnostics — `diagnostics` (вкладка `advanced`)

_Intro:_ Tools for finding out why something goes wrong: setting ids and a log of what the plugin did. Careful: the log is saved in your vault and contains the text of the lines you edit

_Tip:_ - <b>Ids</b> — harmless. An id names a setting in a bug report and never changes ⏎ - <b>Log</b> — keep it off unless you are chasing a problem. It records what you type ⏎ Turn the log on, repeat the problem once, turn it off and read the note

- **Show option IDs in tips** — `show-setting-ids`, `toggle`, path `advanced.showSettingIds`, default `false`
  - desc: Put the id of each setting and group at the end of its tip
  - tip: Puts the id and the current state at the end of each tip, such as <code>show-setting-ids = on</code>. Settings without a tip get a tip with just this line ⏎ - <b>On</b> — use the id to point at a setting in a bug report. It stays the same even when a name changes ⏎ - <b>Off</b> — no ids ⏎ <code>Show tips</code> on the General tab must be on too
- **Developer logging** — `dev-mode`, `toggle`, path `advanced.devMode.enabled`, default `false`
  - desc: Record what the plugin did, to help track down a problem
  - tip: - <b>On</b> — the plugin writes a log note of what it did, and the text of the lines you edit ⏎ - <b>Off</b> — no log. Keep it so day to day ⏎ To report a problem: turn it on, repeat the problem once, turn it off, check what is in the log and attach it
  - старые названия для поиска: «Enable Dev Mode»
- **Machine-readable log** — `dev-ai-log`, `toggle`, path `advanced.devMode.aiLog`, default `false`
  - desc: Also keep a second, denser log meant for tools rather than people
  - tip: - <b>On</b> — a second, denser log file is kept next to the plain one, meant for tools ⏎ - <b>Off</b> — only the plain log, the one you can read yourself ⏎ Only worth turning on if someone has asked you for it
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

#### Help — `help` (вкладка `general`)

_Intro:_ The language of the panel, where to start, and how much help you want along the way

_Tip:_ Where to start and how much help you see ⏎ - <code>Read</code> — opens the guide note <code>inlineOverhaul Guide.md</code> in your vault. It is yours to change, and the plugin never writes over it ⏎ - <code>Show tips</code>, <code>Show callouts</code> — hide the help boxes once you know your way around. The one-line descriptions stay

- **Language** — `ui-language`, `dropdown`, path `general.language`, default `en`
  - desc: Of this panel and the plugin messages
  - tip: The language of this panel and of the plugin messages. The switch works at once ⏎ - <b>English</b> — always in the list ⏎ - <b>Other languages</b> — one small text file each in the plugin folder. Change a line there, reload the plugin, and the panel shows your words ⏎ To add a language, copy the English file under a new name and translate it. Lines you leave untranslated stay in English, never blank
  - варианты: 
- **Show callouts** — `show-callouts`, `toggle`, path `general.help.showCallouts`, default `true`
  - desc: Keep the boxes that say what a tab or a block of settings is for
  - tip: Callouts are the boxes with a colored edge at the top of each tab and under each block of settings ⏎ - <b>On</b> — the boxes show ⏎ - <b>Off</b> — all of them hide, the one at the top of each tab too. The one-line descriptions stay ⏎ The <code>?</code> marks have their own switch, <code>Show tips</code>
  - старые названия для поиска: «Show intro boxes»
- **Show tips** — `show-tips`, `toggle`, path `general.help.showTips`, default `true`
  - desc: Put a ? beside anything that needs more explanation
  - tip: - <b>On</b> — a <code>?</code> stands beside settings that need more explanation. Click it for a short tip, usually with an example ⏎ - <b>Off</b> — no <code>?</code> marks. The one-line descriptions stay
- **Guide** — `howto`, `buttons`
  - desc: Worked examples of the things people set up first
  - tip: - <code>Read</code> — the first press creates the note <code>inlineOverhaul Guide.md</code> in your vault, later presses open it ⏎ Inside: which commands are worth a key, how to set up your first Fields, how tagWheel feels, and ready setups to copy ⏎ Edit it freely, the plugin never writes over it. If you move or rename it, the next press makes a fresh copy
  - кнопки: `open-howto` Read
- **Changelog** — `changelog`, `buttons`
  - desc: What changed in this version, and in every one before it
  - tip: - <code>Open</code> — opens <code>CHANGELOG.md</code> in your browser: every release, newest first ⏎ The window you see after an update shows the same text for the newest release
  - кнопки: `open-changelog` Open

#### Modules — `modules` (вкладка `general`)

_Intro:_ The plugin has four separate parts. Turn off the ones you don’t want, and they stop adding commands and stop touching your notes

_Tip:_ Each part turns on and off on its own ⏎ - <b>On</b> — its commands and hotkeys work, and its tab shows all its settings ⏎ - <b>Off</b> — a command or hotkey only shows a message such as <code>Navigation is switched off</code>, and its tab shows just the switch. Nothing is lost: turn it back on and everything is as it was

- **Navigation** — `module-navigation`, `toggle`, path `features.navigation.enabled`, default `true`
  - desc: Move lines, text and the cursor without reaching for the mouse
  - tip: It only moves text you already wrote: a line up, a word along, the cursor across. It never adds anything ⏎ - <b>On</b> — the Navigation commands and their hotkeys work ⏎ - <b>Off</b> — a press only shows <code>Navigation is switched off</code> ⏎ Safe to leave on
- **Tags & PKM** — `module-pkm`, `toggle`, path `features.pkm.enabled`, default `true`
  - desc: Set up your PKM tags, wikilinks and emoji elements, and insert them inline with one key
  - tip: This part puts tags, links and dates on a line and steps them forward with a keypress ⏎ - <b>On</b> — tagWheel and the Field commands write on the line ⏎ - <b>Off</b> — a press only shows <code>Tags & PKM is switched off</code>. Everything you already wrote stays as it is
- **Transform** — `module-transform`, `toggle`, path `features.transform.enabled`, default `true`
  - desc: Turn an inline entry into a note, with templates, YAML properties, rules and more
  - tip: This is the only part that writes new files ⏎ - <b>On</b> — still nothing happens until you also turn on <code>Inline to note</code> on the Transform tab ⏎ - <b>Off</b> — <code>Transform inline to note</code> only shows <code>Transform is switched off</code>
- **Visual** — `module-visual`, `toggle`, path `features.visual.enabled`, default `true`
  - desc: Customize and beautify your inline text with tag colors, Bars and much more
  - tip: Looks only: your notes keep exactly the same text, and other apps show it plain ⏎ - <b>On</b> — tag colors, Bars and the rest of the Visual tab show while you write ⏎ - <b>Off</b> — the editor goes back to your theme’s look. The tagWheel colors stay, because the panel needs them to stay readable

#### Before you start — `keyboard-intro` (вкладка `keyboard`)

- **`keyboard-callout`** — свой блок, рендерер `renderTabCallout`

#### Global hotkeys — `global-hotkeys` (вкладка `keyboard`)

_Intro:_ Four keys you already use — <code>Ctrl/Cmd + A</code>, <code>Del</code> and <code>Backspace</code>, <code>Enter</code> and <code>Ctrl/Cmd + V</code> — can do the obvious thing inside your lines

_Tip:_ None of this rebinds a key. Each setting changes what a key does in one case only. All of them start off, and each section works on its own, so turn on only the ones you want

- **`select-all-sub`** — свой блок, рендерер `?`
- **Smart Ctrl+A** — `select-all-enabled`, `toggle`, path `editor.selectAll.enabled`, default `false`
  - desc: Change what <code>Ctrl/Cmd + A</code> does: take the line first, then widen
  - tip: - <b>On</b> — the first press selects the line <code>- call Anna #todo</code>, the next press the whole note ⏎ - <b>Off</b> — one press selects the whole note, as in Obsidian ⏎ Want more stops, like a task with its subtasks? Pick them in <b>Selection steps</b> below
  - старые названия для поиска: «Enhanced Mod+A», «Expanded select all», «Expanded 'Ctrl+A'»
- **Selection steps** — `select-all-steps`, `dropdown`, path `editor.selectAll.mode`, default `line-note`
  - desc: How much more gets picked up on each press
  - tip: Each press selects the next step. Say the cursor is on <code>milk</code> in a subtask of <code>- shopping</code> ⏎ - <b>Line, note</b> — the line, then the whole note ⏎ - <b>Line, tree, note</b> — the line, then <code>- shopping</code> with all its subtasks, then the note ⏎ - <b>Line, tree, heading, note</b> — adds everything under the heading above before the note ⏎ - <b>Word, line, tree, heading, note</b> — starts with just <code>milk</code> ⏎ - <b>Custom</b> — tick your own steps below
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
  - tip: - <b>Off</b> — pause as long as you like and the next press still selects more ⏎ - <b>On</b> — pause longer than the time below and the next press starts over from the first step ⏎ Not sure? Leave it off
  - видна если: `editor.selectAll.enabled`
  - старые названия для поиска: «Use multi-press delay»
- **Time between presses** — `select-all-delay`, `slider`, path `editor.selectAll.delayMs`, default `700`
  - desc: How long you can pause and still be in the middle of a sequence
  - tip: Only used when <b>Count presses by timer</b> is on. Raise it if you keep starting over ⏎ - <b>700 ms</b> — the default, suits most people ⏎ - <b>1200 ms</b> — for a slower hand: you may pause over a second between presses
  - диапазон: 250–2000, шаг 50, ед. ms
  - видна если: `editor.selectAll.enabled, editor.selectAll.useDelay`
  - старые названия для поиска: «Multi-press delay»
- **Last press clears highlighting** — `select-all-clear`, `toggle`, path `editor.selectAll.clearOnLast`, default `false`
  - desc: After the last step, pressing again drops the selection and returns the cursor
  - tip: Get out of a selection with the same key you used to make it ⏎ - <b>On</b> — after the whole note is selected, one more press drops the selection and puts the cursor back where it was ⏎ - <b>Off</b> — one more press starts over from the first step
  - видна если: `editor.selectAll.enabled`
  - старые названия для поиска: «Last press clears selection», «One more press clears it»
- **`smart-delete-sub`** — свой блок, рендерер `?`
- **Smart Delete** — `smart-delete-enabled`, `toggle`, path `editor.smartDelete.enabled`, default `false`
  - desc: Let <code>Del</code> at the end of a line bring up the words without the indent and the Prefix
  - tip: The cursor is at the end of <code>- call Anna|</code> and the next line is <code>- [ ] buy milk</code>. You press <code>Del</code> ⏎ - <b>On</b> — only the words come up: <code>- call Anna buy milk</code> ⏎ - <b>Off</b> — the line comes up whole: <code>- call Anna- [ ] buy milk</code> ⏎ <code>Smart Backspace</code> below has its own switch
  - старые названия для поиска: «Smart Del», «Delete the junk»
- **Smart Backspace** — `smart-delete-backspace`, `toggle`, path `editor.smartDelete.onBackspace`, default `false`
  - desc: Let <code>Backspace</code> at the start of a line send it up without its own indent and Prefix
  - tip: The cursor is at the start of <code>- [ ] buy milk</code> and the line above is <code>- call Anna</code>. You press <code>Backspace</code> ⏎ - <b>On</b> — only the words go up: <code>- call Anna buy milk</code>. An empty bullet just disappears ⏎ - <b>Off</b> — <code>Backspace</code> works as usual ⏎ Works even if <code>Smart Delete</code> is off
  - старые названия для поиска: «Smart Backspace», «Do the same on Backspace»
- **Drop the line Prefix** — `smart-delete-prefix`, `toggle`, path `editor.smartDelete.dropPrefix`, default `true`
  - desc: Take the bullet, checkbox, number or quote mark off the arriving line, not only its indent
  - tip: Joining <code>- call Anna</code> and <code>- [ ] buy milk</code> ⏎ - <b>On</b> — <code>- call Anna buy milk</code> ⏎ - <b>Off</b> — only the indent goes: <code>- call Anna - [ ] buy milk</code> ⏎ Works for both keys above
  - видна если: `editor.smartDelete.enabled, editor.smartDelete.onBackspace`
  - старые названия для поиска: «Drop the bullet»
- **Join with a space** — `smart-delete-space`, `toggle`, path `editor.smartDelete.joinWithSpace`, default `true`
  - desc: Put one space between your text and the text that arrives, so the two do not run together
  - tip: - <b>On</b> — <code>- call Anna</code> and <code>- buy milk</code> join as <code>- call Anna buy milk</code> ⏎ - <b>Off</b> — nothing goes between them, handy for a split word: <code>- inter</code> and <code>- view</code> join as <code>- interview</code> ⏎ Works for both keys above
  - видна если: `editor.smartDelete.enabled, editor.smartDelete.onBackspace`
  - старые названия для поиска: «Add a space»
- **`smart-enter-sub`** — свой блок, рендерер `?`
- **Smart Enter** — `smart-enter-enabled`, `toggle`, path `editor.smartEnter.enabled`, default `false`
  - desc: Let <code>Enter</code> add a line instead of splitting the one you are on
  - tip: The cursor is in <code>- call| Anna #todo</code> and you press <code>Enter</code> ⏎ - <b>On</b> — your line stays as it is and a new line <code>- </code> starts below ⏎ - <b>Off</b> — the line splits in two: <code>- call</code> and <code>- Anna #todo</code> ⏎ Code, tables and empty list items always work as usual
  - старые названия для поиска: «Smart Enter», «Do not split the line»
- **Where it works** — `smart-enter-scope`, `dropdown`, path `editor.smartEnter.scope`, default `line`
  - desc: How much of the line the key treats as one record
  - tip: On the line <code>- #todo :: call Anna</code> ⏎ - <b>Whole line</b> — wherever the cursor is, even in <code>#todo</code>, <code>Enter</code> adds a line below ⏎ - <b>Text only</b> — only in <code>call Anna</code>. In <code>#todo</code> the line splits as usual ⏎ A line without Separators counts as all text. Not sure? Keep <b>Whole line</b>
  - варианты: `line` Whole line · `text` Text only
  - видна если: `editor.smartEnter.enabled`
  - старые названия для поиска: «Smart Enter scope», «Only in your text»
- **Prefix on the new line** — `smart-enter-prefix`, `dropdown`, path `editor.smartEnter.newLinePrefix`, default `same`
  - desc: What the line <code>Smart Enter</code> adds starts with
  - tip: What the new line below starts with ⏎ - <b>Same as above</b> — like Obsidian: <code>3. call Anna</code> → <code>4. </code>, <code>- [x] call Anna</code> → <code>- [ ] </code> ⏎ - <b>None</b> — bare: <code>3. call Anna</code> → empty line ⏎ - <b>Numbered lines only</b> — <code>3. call Anna</code> → <code>4. </code>, <code>- call Anna</code> → empty line ⏎ All three keep the indent
  - варианты: `same` Same as above · `none` None · `number-only` Numbered lines only
  - видна если: `editor.smartEnter.enabled`
  - старые названия для поиска: «Keep the bullet», «New line Prefix», «Carry the Prefix over»
- **Use Shift+Enter instead** — `smart-enter-use-shift`, `toggle`, path `editor.smartEnter.useShift`, default `false`
  - desc: Make <code>Shift+Enter</code> the Smart Enter key and leave <code>Enter</code> as usual
  - tip: - <b>On</b> — <code>Enter</code> splits the line as usual and <code>Shift+Enter</code> adds a line below ⏎ - <b>Off</b> — <code>Enter</code> adds a line below and <code>Shift+Enter</code> works as it always did
  - видна если: `editor.smartEnter.enabled`
  - старые названия для поиска: «Shift+Enter», «Smart Enter key»
- **Shift+Enter as usual Enter** — `smart-enter-shift`, `toggle`, path `editor.smartEnter.shiftPlainEnter`, default `false`
  - desc: Let <code>Shift+Enter</code> split the line the way <code>Enter</code> does without <code>Smart Enter</code>
  - tip: The cursor is in <code>- call| Anna</code> ⏎ - <b>On</b> — <code>Shift+Enter</code> splits it like Obsidian's normal <code>Enter</code>: <code>- call</code> and <code>- Anna</code> ⏎ - <b>Off</b> — <code>Shift+Enter</code> works as it always did
  - видна если: `editor.smartEnter.enabled, editor.smartEnter.useShift`
  - старые названия для поиска: «Shift+Enter», «Plain Enter»
- **`smart-paste-sub`** — свой блок, рендерер `?`
- **Smart paste** — `smart-paste-enabled`, `toggle`, path `editor.smartPaste.enabled`, default `false`
  - desc: Count a pasted numbered list from one, and drop a pasted marker where the line has one
  - tip: - <b>On</b> — a copied <code>5. milk</code>, <code>6. bread</code> pastes as <code>1. milk</code>, <code>2. bread</code>. <code>1. milk</code> pasted after <code>2. </code> gives <code>2. milk</code> ⏎ - <b>Off</b> — numbers stay as copied, and <code>1. milk</code> pasted after <code>2. </code> gives <code>2. 1. milk</code> ⏎ Plain text, links and everything else paste as usual either way
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

_Tip:_ A line with other lines indented under it is a <b>tree</b>. Say <code>- ask about Friday</code> sits indented under <code>- call Anna</code>. The settings below decide if <code>ask about Friday</code> moves with its parent line or stays behind

- **Move lines** — `move-lines-enabled`, `toggle`, path `navigation.moveLine.enabled`, default `true`
  - desc: Let the keys pick up a line and move it
  - tip: - <b>On</b> — <code>Move down</code> swaps the line with the one below: <code>- call Anna</code>, <code>- buy milk</code> → <code>- buy milk</code>, <code>- call Anna</code> ⏎ - <b>Off</b> — the commands do nothing. Your hotkeys and settings are kept for when you turn it back on
  - старые названия для поиска: «Enable Move Line»
- **Moving behavior** — `move-lines-no-selection`, `dropdown`, path `navigation.moveLine.noSelectionMode`, default `line-only`
  - desc: Whether the tree under the line travels with it
  - tip: Say <code>- ask about Friday</code> is indented under <code>- call Anna</code>, and you press <code>Move down</code> on <code>call Anna</code>: ⏎ - <b>Line only</b> — <code>call Anna</code> moves alone and drops below <code>ask about Friday</code> ⏎ - <b>Whole tree</b> — both lines move together, below the next line
  - варианты: `line-only` Line only · `with-children` Whole tree
  - видна если: `navigation.moveLine.enabled`
  - старые названия для поиска: «No-selection mode»
- **Jump over neighbor trees** — `move-lines-jump-trees`, `toggle`, path `navigation.moveLine.jumpNeighborTrees`, default `false`
  - desc: Move the tree past the whole tree next to it instead of into its lines
  - tip: The next tree is <code>- buy milk</code> with <code>- oat milk</code> under it. You press <code>Move down</code> on your tree: ⏎ - <b>On</b> — one press puts your tree below the whole <code>buy milk</code> tree. <code>oat milk</code> stays with <code>buy milk</code> ⏎ - <b>Off</b> — your tree moves one line, right below <code>buy milk</code>. <code>oat milk</code> ends up under your tree
  - видна если: `navigation.moveLine.enabled, navigation.moveLine.noSelectionMode`
- **Moving headings** — `move-lines-heading`, `dropdown`, path `navigation.moveLine.headerMode`, default `move-as-line`
  - desc: If you are moving a heading, this decides whether the whole section moves or just the heading line
  - tip: You press <code>Move down</code> on <code>## Plans</code>, and <code>## Ideas</code> comes next: ⏎ - <b>Heading only</b> — just the heading line moves, one step per press. The text under it stays where it was ⏎ - <b>Whole section</b> — <code>## Plans</code> and all its text jump below the whole <code>## Ideas</code> section
  - варианты: `move-as-line` Heading only · `move-with-section` Whole section
  - видна если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Header mode»
- **Cross heading boundaries** — `move-lines-cross`, `toggle`, path `navigation.moveLine.crossSectionAllowed`, default `true`
  - desc: Let a line travel past a heading into the part of the note below it
  - tip: <code>- call Anna</code> is the last line under <code>## Plans</code>, and you press <code>Move down</code>: ⏎ - <b>On</b> — the line goes past <code>## Ideas</code> and lands right under it ⏎ - <b>Off</b> — nothing happens. The line stays under its own heading
  - видна если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Cross-section allowed»
- **Highlight after moving** — `move-lines-select`, `toggle`, path `navigation.moveLine.highlightMovedLines`, default `false`
  - desc: Keep the lines highlighted once they land, so you can see what moved
  - tip: - <b>On</b> — after a move the lines stay tinted, so you can see the whole tree came along ⏎ - <b>Off</b> — only the cursor shows where the line went
  - видна если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Highlight moved lines», «Select after moving»
- **Moved lines color** — `move-lines-select-color`, `color`, path `navigation.moveLine.highlightColor`, default `""`
  - desc: Leave it unset to use the selection color of your theme
  - tip: Unset, moved lines use your theme's selection color. Pick your own if that is too pale to see; the reset button brings the theme color back
  - видна если: `navigation.moveLine.enabled, navigation.moveLine.highlightMovedLines`
  - старые названия для поиска: «Highlight color after moving»
- **Follow the moved line** — `move-lines-view`, `toggle`, path `navigation.moveLine.keepInView`, default `true`
  - desc: Scroll the note to the line you moved instead of leaving the view where it was
  - tip: - <b>On</b> — the note scrolls with the line, so it never goes out of sight. Where it sits is set in the row below ⏎ - <b>Off</b> — the note never scrolls. Move a line past the bottom edge and it goes out of sight
  - видна если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Scroll on move», «Keep in view», «Screen jumps»
- **Where the line lands** — `move-lines-view-position`, `dropdown`, path `navigation.moveLine.viewPosition`, default `center`
  - desc: The place on screen the moved line is scrolled to
  - tip: Where the moved line sits on screen after each press: ⏎ - <b>Center</b> — in the middle of the window ⏎ - <b>Top</b> — at the top edge ⏎ - <b>Bottom</b> — at the bottom edge ⏎ Near the start or end of a note it gets as close as it can
  - варианты: `center` Center · `top` Top · `bottom` Bottom
  - видна если: `navigation.moveLine.enabled, navigation.moveLine.keepInView`
  - старые названия для поиска: «Scroll position», «Center on move»

#### Move lines (left/right) — `left-right` (вкладка `navigation`)

_Intro:_ Two keys, three jobs: slide selected text along a line, change the marker at the start of a line, or change its indent. What you get depends on what is selected

_Tip:_ <code>Move left</code> and <code>Move right</code> do three jobs: ⏎ - <b>Text selected</b> — it slides along the line: <code>call Anna</code> → <code>Anna call</code> ⏎ - <b>Line with no indent</b> — its marker changes: <code>call Anna</code> → <code>- call Anna</code> ⏎ - <b>Indented line</b> — its indent changes ⏎ Switch off any job below to keep only the ones you want

- **`left-right-order`** — свой блок, рендерер `renderLeftRightOrder`
- **`move-text-sub`** — свой блок, рендерер `?`
- **Move selected text** — `move-text-enabled`, `toggle`, path `navigation.moveSelection.inlineEnabled`, default `true`
  - desc: Slide a highlighted phrase along its line
  - tip: - <b>On</b> — select <code>call</code> in <code>call Anna today</code> and press <code>Move right</code>: <code>Anna call today</code>. The word stays selected, so you can keep pressing ⏎ - <b>Off</b> — selected text does not move
  - старые названия для поиска: «Enable inline text move»
- **Movement step** — `move-text-step`, `dropdown`, path `navigation.moveSelection.inlineMoveMode`, default `auto`
  - desc: How far the highlighted text goes on each press
  - tip: How far selected text goes on one press of <code>Move right</code>: ⏎ - <b>Auto</b> — part of a word moves by letter: <code>e</code> in <code>teh</code> → <code>the</code>. A whole word moves by word: <code>call</code> → <code>Anna call</code> ⏎ - <b>Character</b> — always one letter, even for a whole word ⏎ - <b>Word</b> — always one word: <code>call Anna</code> → <code>Anna call</code> ⏎ - <b>Off</b> — selected text does not move
  - варианты: `auto` Auto · `char` Character · `word` Word · `disabled` Off
  - видна если: `navigation.moveSelection.inlineEnabled`
  - старые названия для поиска: «Inline move mode»
- **Step out of the word** — `move-text-word-escape`, `toggle`, path `navigation.moveSelection.inlineWordEscape`, default `false`
  - desc: Let a highlighted part of a word carry on past the word it came from
  - tip: Only for <code>Auto</code>. You select <code>ll</code> at the end of <code>call</code> in <code>call Anna</code> and press <code>Move right</code>: ⏎ - <b>On</b> — the letters step out of the word: <code>call Anna</code> → <code>ca llAnna</code> ⏎ - <b>Off</b> — nothing happens. Letters stop at the edge of their word, as it always worked
  - видна если: `navigation.moveSelection.inlineEnabled, navigation.moveSelection.inlineMoveMode`
  - старые названия для поиска: «Leave the word», «Word escape»
- **Continue past Separators** — `move-text-cross`, `toggle`, path `navigation.moveSelection.inlineBoundaryJump`, default `true`
  - desc: Let the highlighted text leave your text and move into the tags at either end
  - tip: You select <code>call</code> in <code>- #todo :: call Anna :: 📅2026-10-06</code> and press <code>Move left</code>: ⏎ - <b>On</b> — the word jumps over the Separator: <code>- #todo call :: Anna :: 📅2026-10-06</code> ⏎ - <b>Off</b> — nothing happens. Selected text stays between the Separators
  - видна если: `navigation.moveSelection.inlineEnabled`
  - см. также: `in-line-cross` — The cursor has the same setting of its own
- **`move-line-sub`** — свой блок, рендерер `?`
- **Cycle line Prefixes** — `prefix-cycle-enabled`, `toggle`, path `navigation.moveSelection.prefixCyclerEnabled`, default `true`
  - desc: Turn a line into a heading, a bullet, a numbered item or plain text, one press at a time
  - tip: - <b>On</b> — on a line with no indent the keys change the marker. <code>Move right</code>: <code>call Anna</code> → <code>- call Anna</code>. <code>Move left</code>: <code>call Anna</code> → <code>1. call Anna</code> ⏎ - <b>Off</b> — the keys never change the marker ⏎ The order is the list below; an empty row means plain text. A task loses its checkbox: <code>- [ ] call Anna</code> → <code>call Anna</code>
  - старые названия для поиска: «Enable PrefixCycler»
- **`cycle-order`** — свой блок, рендерер `renderCycleOrder`
- **Cycle in both directions** — `right-cycles`, `toggle`, path `navigation.moveSelection.rightCycles`, default `true`
  - desc: On: <code>Move right</code> changes the marker too, but only on a line with no indent
  - tip: - <b>On</b> — <code>Move right</code> changes the marker too: <code>call Anna</code> → <code>- call Anna</code>. Indented lines still get indented ⏎ - <b>Off</b> — only <code>Move left</code> changes the marker. <code>Move right</code> only indents list items ⏎ The cost of On: <code>Move right</code> indents only once the list runs out. With <b>Start over</b> in <code>After the last one</code> it never does, so indent with <code>Tab</code>
  - видна если: `navigation.moveSelection.prefixCyclerEnabled`
- **After the last one** — `prefix-cycle-end`, `dropdown`, path `navigation.moveSelection.onCycleEnd`, default `indent`
  - desc: What happens when you reach the bottom of the list below
  - tip: The line has the last marker of the list, <code>- </code> by default, and you press <code>Move right</code>: ⏎ - <b>Indent</b> — the line moves one indent step right: <code>- call Anna</code> becomes a nested item ⏎ - <b>Start over</b> — the list starts again from the top: <code>- call Anna</code> → <code># call Anna</code>
  - варианты: `indent` Indent · `wrap` Start over
  - видна если: `navigation.moveSelection.prefixCyclerEnabled`
  - старые названия для поиска: «On cycle end»
- **Change the indent** — `indent-fallback`, `toggle`, path `navigation.moveSelection.indentFallbackEnabled`, default `true`
  - desc: <code>Move right</code> indents a list item one step, <code>Move left</code> takes one step off
  - tip: - <b>On</b> — <code>Move right</code> indents a list item one step, <code>Move left</code> takes one step off. On an indented line <code>Move left</code> removes the indent first, then changes the marker ⏎ - <b>Off</b> — the keys never indent. Pick it if you indent with <code>Tab</code> ⏎ Plain text is never indented, since Obsidian would show it as a code block
  - старые названия для поиска: «Indent fallback»
- **Indent the whole tree** — `indent-tree`, `toggle`, path `navigation.moveSelection.indentWithChildren`, default `false`
  - desc: The lines indented under the line take the same step with it
  - tip: <code>- ask about Friday</code> is indented under <code>- call Anna</code>, and you press <code>Move right</code> on <code>call Anna</code>: ⏎ - <b>On</b> — both lines move one step right. <code>ask about Friday</code> stays under <code>call Anna</code> ⏎ - <b>Off</b> — only <code>call Anna</code> moves. <code>ask about Friday</code> ends up at its level ⏎ Changing the marker never moves the lines under it
  - видна если: `navigation.moveSelection.indentFallbackEnabled`

#### Jump inside a line (left/right) — `in-line` (вкладка `navigation`)

_Intro:_ A line can hold tags before your text and dates after it. These keys move the cursor between those parts without leaving the line

_Tip:_ Arrow keys crawl through a line one letter at a time. <code>Jump left</code> and <code>Jump right</code> hop instead: by word, by sentence or straight to one end of your text. By default they stay between the Separators, so in <code>- #todo :: call Anna :: 📅2026-10-06</code> the cursor never lands in <code>#todo</code> or the date by accident

- **Move cursor inside a line** — `in-line-enabled`, `toggle`, path `navigation.navigateInline.enabled`, default `true`
  - desc: Let the keys walk the cursor along the line
  - tip: - <b>On</b> — <code>Jump right</code> hops through your own text: <code>|call Anna</code> → <code>call |Anna</code>. How far is set below ⏎ - <b>Off</b> — the commands stay but do nothing
  - старые названия для поиска: «Enable Navigate Inline»
- **Step size** — `in-line-step`, `dropdown`, path `navigation.navigateInline.stepMode`, default `word`
  - desc: How big a hop the cursor makes each time
  - tip: Where one press of <code>Jump right</code> takes the cursor <code>|</code>: ⏎ - <b>Word</b> — to the next word: <code>|call Anna. Ask Bob</code> → <code>call |Anna. Ask Bob</code> ⏎ - <b>Sentence</b> — to the end of the sentence: <code>|call Anna. Ask Bob</code> → <code>call Anna|. Ask Bob</code> ⏎ - <b>Start or end</b> — to the end of your text: <code>|call Anna. Ask Bob</code> → <code>call Anna. Ask Bob|</code>
  - варианты: `word` Word · `sentence` Sentence · `begin-end` Start or end
  - видна если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «Step mode»
- **Continue past Separators** — `in-line-cross`, `toggle`, path `navigation.navigateInline.boundaryJump`, default `false`
  - desc: Let the cursor leave your text and walk into the tags at either end
  - tip: The cursor is at <code>- #todo :: |call Anna :: 📅2026-10-06</code> and you press <code>Jump left</code>: ⏎ - <b>On</b> — it walks into the tags: <code>- |#todo :: call Anna</code>. Handy to reach a tag without the mouse ⏎ - <b>Off</b> — it never leaves your text, so it cannot land in a tag by accident. Safer while writing
  - видна если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «Allow crossing Separators», «Continue past Separators»
- **What to do at the end** — `in-line-boundary`, `dropdown`, path `navigation.navigateInline.onBoundary`, default `wrap`
  - desc: When there is nowhere further to go in the line
  - tip: The cursor is at the end of your text, <code>call Anna|</code>, and you press <code>Jump right</code>: ⏎ - <b>Stop</b> — nothing happens: <code>call Anna|</code> ⏎ - <b>Wrap around</b> — back to the start: <code>|call Anna</code> ⏎ - <b>Next line</b> — to the start of the text on the next line: <code>|buy milk</code>
  - варианты: `stay` Stop · `wrap` Wrap around · `next-line` Next line
  - видна если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «On boundary», «At the far end»

#### Jump inside a note (up/down) — `heading-jumps` (вкладка `navigation`)

_Intro:_ Skip through a long note by its headings instead of scrolling

_Tip:_ Jump through a long note a section at a time — faster than scrolling or the outline once your hands are on the keyboard. Below you choose where the keys stop (headings or lines), where on the line you land, and whether the note scrolls to show it

- **Jump between headings** — `heading-jumps-enabled`, `toggle`, path `navigation.jumpToHeader.enabled`, default `true`
  - desc: Turn on the <code>Jump up</code> and <code>Jump down</code> commands
  - tip: - <b>On</b> — <code>Jump up</code> and <code>Jump down</code> take the cursor through the note section by section ⏎ - <b>Off</b> — the commands do nothing, but any hotkey you gave them is kept ⏎ The same commands can also walk line by line, see <code>Jump target</code> below
  - старые названия для поиска: «Enable Jump To Header»
- **Jump target** — `heading-jumps-mode`, `dropdown`, path `navigation.jumpToHeader.jumpMode`, default `edge`
  - desc: Hop between headings, or crawl from one written line to the next
  - tip: - <b>Headings</b> — hops section by section, so a long note goes by in a few presses. Where it stops is set below ⏎ - <b>Lines</b> — steps to the next written line, skipping empty lines, rules and tables. A heading counts as a line. An alternative to the arrow keys
  - варианты: `edge` Headings · `line` Lines
  - видна если: `navigation.jumpToHeader.enabled`
  - старые названия для поиска: «Jump mode»
- **Where in the section** — `heading-jumps-edge`, `dropdown`, path `navigation.jumpToHeader.edgeMode`, default `start-end`
  - desc: Land at the start of the part you jump to, or at its end
  - tip: <code>## Plans</code> and <code>## Ideas</code> have two lines each. Pressing <code>Jump down</code> from <code>## Plans</code> stops at: ⏎ - <b>Start and end</b> — the last line of Plans, then the first of Ideas, then the last of Ideas ⏎ - <b>Start only</b> — the first line of Plans, then the first of Ideas ⏎ - <b>End only</b> — the last line of Plans, then the last of Ideas
  - варианты: `start-end` Start and end · `start` Start only · `end` End only
  - видна если: `navigation.jumpToHeader.enabled, navigation.jumpToHeader.jumpMode`
  - старые названия для поиска: «Edge behavior»
- **Cursor position after jumping** — `heading-jumps-cursor`, `dropdown`, path `navigation.jumpToHeader.jumpCursorPosition`, default `section-end`
  - desc: Where on that line the cursor ends up
  - tip: Where the cursor lands on <code>- #todo :: call Anna :: 📅2026-10-06</code>: ⏎ - <b>Line start</b> — after the list marker: <code>- |#todo</code> ⏎ - <b>Line end</b> — after the date: <code>📅2026-10-06|</code> ⏎ - <b>Text start</b> — after the tags: <code>:: |call Anna</code> ⏎ - <b>Text end</b> — after your last word, ready to type: <code>call Anna| ::</code>
  - варианты: `start` Line start · `end` Line end · `section-start` Text start · `section-end` Text end
  - видна если: `navigation.jumpToHeader.enabled`
  - см. также: `separator-2` — Where your text ends is set by the second Separator
  - старые названия для поиска: «Jump cursor position», «Cursor on arrival»
- **Follow the jump target** — `heading-jumps-center`, `toggle`, path `navigation.jumpToHeader.centerCursor`, default `true`
  - desc: After a jump, scroll the note so the line you landed on is on screen
  - tip: - <b>On</b> — the note scrolls so the line you land on is on screen. Where it sits is set in the row below ⏎ - <b>Off</b> — the note does not scroll. You often land at the bottom edge with the section still out of sight
  - видна если: `navigation.jumpToHeader.enabled`
  - старые названия для поиска: «Center the target», «Center the screen on target», «Scroll on jump»
- **Where the target lands** — `heading-jumps-view-position`, `dropdown`, path `navigation.jumpToHeader.viewPosition`, default `center`
  - desc: The place on screen the line you jump to is scrolled to
  - tip: Where the line you jump to sits on screen, as in <code>Move lines</code>: ⏎ - <b>Center</b> — in the middle of the window ⏎ - <b>Top</b> — at the top edge, with the section below it in view ⏎ - <b>Bottom</b> — at the bottom edge ⏎ Near the start or end of a note it gets as close as it can
  - варианты: `center` Center · `top` Top · `bottom` Bottom
  - видна если: `navigation.jumpToHeader.enabled, navigation.jumpToHeader.centerCursor`
  - старые названия для поиска: «Scroll position», «Center on jump»

#### Before you start — `pkm-intro` (вкладка `pkm`)

- **`pkm-callout`** — свой блок, рендерер `renderTabCallout`

#### Fields — `fields` (вкладка `pkm`)

_Intro:_ A Field is one thing a line can have: a tag, a link to a note, or an emoji item such as a date. Add the Fields you want, the Values each one offers, and where on the line they go

_Tip:_ Each Field gets two commands, <code>next</code> and <code>previous</code>, that put a Value on the line and step through the rest: ⏎ - <b>next</b> — <code>- call Anna</code> → <code>- [ ] #todo :: call Anna</code> → <code>- #idea :: call Anna</code> ⏎ - <b>previous</b> — the same list from the end: <code>- call Anna</code> → <code>- [x] #done :: call Anna</code> ⏎ A Field is a tag, a link or an Emoji such as a date. Give a hotkey to the ones you use often, or open <b>tagWheel</b> to pick with the arrow keys

- **`line-preview`** — свой блок, рендерер `renderLinePreview`
- **`field-editor`** — свой блок, рендерер `renderFieldEditor`

#### Separators — `line-format` (вкладка `pkm`)

_Intro:_ Two markers split your line. Your own text goes between them, and the Fields sit before and after. To choose which side a Field goes on, drag it across the line under <code>Fields</code>

_Tip:_ Pick these once and leave them. With <code>::</code> on both sides a line looks like <code>- #high :: call Anna :: 📅2026-10-04</code> ⏎ - <b>Good</b> — <code>||</code> or <code>::</code>, characters Markdown doesn’t use ⏎ - <b>Bad</b> — <code>==</code>, because Obsidian shows it as a highlight ⏎ Lines you already wrote keep the old Separator, so if you change it the plugin stops recognizing them

- **First Separator** — `separator-1`, `text`, path `pkm.lineFormat.separator1`, default `||`
  - desc: Goes between the tags at the front and the start of your sentence
  - tip: Pick something you would never type in a sentence by accident. That is why the default is two pipe characters ⏎ - <b>||</b> — <code>- #high || call Anna</code> ⏎ - <b>::</b> — <code>- #high :: call Anna</code>
- **Second Separator** — `separator-2`, `text`, path `pkm.lineFormat.separator2`, default `||`
  - desc: Goes at the end of your sentence, before the dates and links
  - tip: It may match the first one: the plugin tells them apart by where they stand on the line, not by how they look. With <code>::</code> for both: ⏎ <code>- #high :: call Anna :: 📅2026-10-04</code>

#### Writing rules — `writing-rules` (вкладка `pkm`)

_Intro:_ The small habits: what is left when a line empties, and where the cursor waits afterwards

_Tip:_ Set these once and forget them. Which Fields you have is set under <code>Fields</code>, and each Field there chooses <code>#parent #child</code> or <code>#parent/child</code> for itself. Here you choose what is left when you step past the last Value, and where the cursor ends up

- **When a line empties out** — `cycle-end-behavior`, `dropdown`, path `pkm.behavior.cycleEndBehavior`, default `keep-bullet`
  - desc: What is left behind when cycling removes the last Value
  - tip: When stepping takes off the last tag and nothing else is left on the line: ⏎ - <b>Keep bullet</b> — <code>- #done ::</code> → <code>- </code>, an empty list item ready for typing ⏎ - <b>Clear line</b> — <code>- #done ::</code> → a blank line ⏎ Your own text always stays: <code>- #done :: call Anna</code> → <code>- call Anna</code>
  - варианты: `keep-bullet` Keep bullet · `clear-prefix` Clear line
  - старые названия для поиска: «Line Prefix after end of cycle»
- **Cursor after an action** — `cursor-policy`, `dropdown`, path `pkm.behavior.cursorPolicy`, default `text_end`
  - desc: Where the cursor waits once a tag or date has been set
  - tip: Where the cursor <code>|</code> waits after a command. Say it stands in <code>- ca|ll Anna</code> and you add a date: ⏎ - <b>Text end</b> — <code>- call Anna| :: 📅2026-10-04</code>, ready to keep typing ⏎ - <b>Don't move</b> — <code>- ca|ll Anna :: 📅2026-10-04</code> ⏎ - <b>Line end</b> — <code>- call Anna :: 📅2026-10-04|</code> ⏎ Not sure? Keep <b>Text end</b>
  - варианты: `text_end` Text end · `current_position` Don't move · `line_end` Line end
  - старые названия для поиска: «Cursor behavior»
- **Mark ticked line** — `done-marker`, `text`, path `pkm.behavior.doneMarker.token`, default `""`
  - desc: A tag or emoji added when you tick a checkbox and taken off when you untick it
  - tip: Type a tag or emoji. Ticking the checkbox adds it, unticking takes it off: ⏎ - <b>✅</b> — <code>- [x] call Anna</code> → <code>- [x] call Anna :: ✅</code> ⏎ - <b>#done</b> — a Value of <code>Type</code>, so it takes that Field’s place: <code>- [x] #todo :: call Anna</code> → <code>- [x] #done :: call Anna</code> ⏎ - <b>Empty</b> — ticking adds nothing
  - старые названия для поиска: «Done marker», «Checkbox marker», «Mark the line as done»
- **Where the tick mark goes** — `done-marker-position`, `dropdown`, path `pkm.behavior.doneMarker.panel`, default `right`
  - desc: Before your text, or after it
  - tip: Say the mark is <code>✅</code> and you tick <code>- [x] call Anna</code>: ⏎ - <b>Left Block</b> — with the tags before your text: <code>- [x] ✅ :: call Anna</code> ⏎ - <b>Right Block</b> — after your sentence: <code>- [x] call Anna :: ✅</code> ⏎ If the mark is a Value of one of your Fields, this setting doesn’t apply: the mark goes where that Field is
  - варианты: `left` Left Block · `right` Right Block
  - видна если: `pkm.behavior.doneMarker.token`
  - старые названия для поиска: «Done marker panel»
- **Strike through ticked line** — `done-strike`, `toggle`, path `pkm.behavior.doneMarker.strike`, default `false`
  - desc: Cross out the whole line once it carries the tick mark
  - tip: Only the look changes. Nothing is written into the note ⏎ - <b>On</b> — <code>- [x] #done :: call Anna</code> shows crossed out ⏎ - <b>Off</b> — the line looks like any other ⏎ Unticking takes the mark off, and the strike goes with it
  - видна если: `pkm.behavior.doneMarker.token`
  - старые названия для поиска: «Cross out done lines»
- **Dim ticked line** — `done-dim`, `toggle`, path `pkm.behavior.doneMarker.visual.enabled`, default `false`
  - desc: Fade a line once it carries the tick mark, so your eye skips it
  - tip: Only the look changes. Nothing is written into the note, and search still finds the line ⏎ - <b>On</b> — <code>- [x] #done :: call Anna</code> fades, so your eye skips it ⏎ - <b>Off</b> — it stays at full strength ⏎ Unticking brings a faded line back
  - видна если: `pkm.behavior.doneMarker.token`
  - старые названия для поиска: «Dim the lines already done»
- **Opacity of ticked line** — `done-dim-opacity`, `slider`, path `pkm.behavior.doneMarker.visual.opacity`, default `65`
  - desc: Zero leaves the line as it is, eighty makes it barely readable
  - tip: How strongly a ticked line fades. Only the look changes: the text stays whole and search still finds it ⏎ - <b>0</b> — the line looks as usual ⏎ - <b>35</b> — clearly faded, the default ⏎ - <b>80</b> — barely readable
  - диапазон: 0–80, шаг 5, ед. %
  - видна если: `pkm.behavior.doneMarker.token, pkm.behavior.doneMarker.visual.enabled`
  - старые названия для поиска: «How much of a ticked line is left»
- **Color of ticked line** — `done-dim-color`, `color`, path `pkm.behavior.doneMarker.visual.color`, default `""`
  - desc: Leave it unset to keep the color your theme gives the text
  - tip: Set a color only if fading alone doesn’t make ticked lines easy to spot ⏎ - <b>Unset</b> — <code>- [x] #done :: call Anna</code> keeps your theme’s text color, only faded ⏎ - <b>A color</b> — the line takes your color instead, and the fade still applies on top
  - видна если: `pkm.behavior.doneMarker.token, pkm.behavior.doneMarker.visual.enabled`
  - старые названия для поиска: «Color of a done line»

#### tagWheel behavior — `tagwheel-behavior` (вкладка `pkm`)

_Intro:_ How tagWheel behaves: which Field it opens on, what happens to the other Values while it is open, and where the arrow keys take you. Its look is set on the Visual tab

_Tip:_ tagWheel is the picker that opens over your line and shows all your Fields. Here you set how it moves: the Field it opens on, whether the other Block stays visible, and where the arrows go after the last Field. Colors and sizes are under <code>Visual</code> → <code>tagWheel</code>

- **Active Field on opening** — `wheel-active-field`, `dropdown`, path `visual.tagWheel.activeField.mode`, default `first`
  - desc: Which Field the picker lands on when it opens
  - tip: Say your Left Block has <code>Imp</code>, <code>Type</code>, <code>People</code>, <code>Project</code>, <code>Due</code>: ⏎ - <b>First Field</b> — opens on <code>Imp</code> ⏎ - <b>Middle Field</b> — opens on <code>People</code>, so neither end is far away. Handy with many Fields ⏎ - <b>Chosen Field</b> — opens on the Field you pick for each Block in the two settings below
  - варианты: `first` First Field · `middle` Middle Field · `custom` Chosen Field
  - старые названия для поиска: «Lead Field», «Starting Field», «Active Field»
- **Left Block active Field** — `wheel-active-left`, `dropdown`, path `visual.tagWheel.activeField.left`, default `""`
  - desc: The Field tagWheel lands on when it opens on the left
  - tip: You can only pick Fields that are in the Left Block ⏎ - <b>First Field</b> — opens on the first Field on the left, say <code>Imp</code> ⏎ - <b>People</b> — opens on <code>People</code> instead ⏎ If you later move the chosen Field to the right, tagWheel goes back to opening on the first Field on the left
  - варианты: `` First Field
  - видна если: `visual.tagWheel.activeField.mode`
  - старые названия для поиска: «Lead Field left»
- **Right Block active Field** — `wheel-active-right`, `dropdown`, path `visual.tagWheel.activeField.right`, default `""`
  - desc: The Field tagWheel lands on when it opens on the right
  - tip: You can only pick Fields that are in the Right Block ⏎ - <b>First Field</b> — opens on the first Field on the right ⏎ - <b>Due</b> — opens on <code>Due</code> instead
  - варианты: `` First Field
  - видна если: `visual.tagWheel.activeField.mode`
  - старые названия для поиска: «Lead Field right»
- **Values in the other Block** — `wheel-opposite-block`, `dropdown`, path `visual.tagWheel.oppositeBlock`, default `hide`
  - desc: What happens to the Values you are not picking while the picker is open
  - tip: Say the line is <code>- #high :: call Anna :: 📅2026-10-04</code> and you open tagWheel on the left: ⏎ - <b>Hide</b> — the usual way: <code>:: 📅2026-10-04</code> disappears while you choose ⏎ - <b>Show</b> — the date stays in view. The line is really changed while the picker is open, so a save at that moment writes it to the file ⏎ Closing the picker puts the line back
  - варианты: `hide` Hide · `keep` Show
  - старые названия для поиска: «Opposite Block», «Other Block», «Hide values»
- **Line for a selection** — `wheel-selection-line`, `dropdown`, path `visual.tagWheel.selectionLine`, default `top`
  - desc: Which selected line tagWheel opens on when you start it with lines selected
  - tip: Say lines 2 to 5 are selected when you open tagWheel: ⏎ - <b>Top line</b> — it opens on line 2 ⏎ - <b>Bottom line</b> — it opens on line 5 ⏎ - <b>Where selecting ended</b> — line 5 if you dragged down, line 2 if you dragged up ⏎ Picking a Value changes only that one line. The selection stays, and <code>Esc</code> gives it back
  - варианты: `top` Top line · `bottom` Bottom line · `head` Where selecting ended
  - старые названия для поиска: «Selection», «Selected lines»
- **tagWheel navigation behavior** — `wheel-edge`, `dropdown`, path `visual.tagWheel.edgeMode`, default `stay`
  - desc: What the arrow keys do when there is no next Field on this side
  - tip: Say you are on the last Field on the left and move on: ⏎ - <b>Stay in Block</b> — you go back to the first Field on the left, say <code>Imp</code> ⏎ - <b>Next Block</b> — you go on to the first Field on the right, so both Blocks work as one loop ⏎ <code>Tab</code> switches Blocks either way. In a custom block the arrows always stay in that block
  - варианты: `stay` Stay in Block · `next-block` Next Block
  - старые названия для поиска: «Edge of a Block», «Wrap around», «Move to the next Block», «At the last Field»
- **Switch custom blocks on Tab** — `wheel-custom-tab`, `toggle`, path `visual.tagWheel.customTab`, default `false`
  - desc: Tab in a custom block’s tagWheel moves on to the next custom block
  - tip: Say you have two custom blocks, <code>Tasks</code> and <code>Notes</code>: ⏎ - <b>On</b> — <code>Tab</code> goes <code>Tasks</code> → <code>Notes</code> → <code>Tasks</code>, in the order of your Fields list ⏎ - <b>Off</b> — <code>Tab</code> does nothing in a custom block’s tagWheel ⏎ Whatever you picked in the block you leave is lost, because only <code>Enter</code> saves it
  - видна если: `pkm.fields.order.custom`
  - старые названия для поиска: «Custom block», «Tab», «Next custom block»

#### Placement modes — `placement-modes` (вкладка `pkm`)

_Intro:_ Each Field in the Left or Right Block has a <code>Prefix behavior</code> mode, either <code>Strict</code> or <code>Insert only</code>. Here you fine-tune how these modes work

_Tip:_ You pick the mode for each Field under <code>Fields</code>. Here you set the details, mainly whether a mode can change the start of the line, where the bullet or checkbox is

- **Strict: add a bullet** — `placement-bullet-strict`, `toggle`, path `pkm.placement.bulletInStrict`, default `false`
  - desc: Start the line with a bullet when the Field has nothing of its own to put there
  - tip: For a Field in <code>Strict</code> mode whose Value has no line start of its own: ⏎ - <b>On</b> — a plain line becomes a list item: <code>call Anna</code> → <code>- #high :: call Anna</code> ⏎ - <b>Off</b> — it stays as it is: <code>call Anna</code> → <code>#high :: call Anna</code> ⏎ Headings are never changed: <code>## Plan</code> → <code>## #high :: Plan</code>
  - см. также: `field-editor` — Each Field’s Prefix behavior is set under Fields
  - старые названия для поиска: «OFF mode Prefix»
- **Insert only: use Field Prefix** — `placement-field-prefix`, `toggle`, path `pkm.placement.fieldPrefixInsertOnly`, default `true`
  - desc: Allow a Value to change the start of the line after all, if it has its own
  - tip: Some Values come with their own line start, like <code>[ ]</code> on <code>#todo</code>. For a Field in <code>Insert only</code> mode: ⏎ - <b>On</b> — <code>- call Anna</code> → <code>- [ ] #todo :: call Anna</code> ⏎ - <b>Off</b> — <code>- call Anna</code> → <code>- #todo :: call Anna</code>, the line start stays as it was
  - старые названия для поиска: «Minimal mode Prefix»
- **Keep typed tags in text** — `placement-typed-tags`, `toggle`, path `pkm.placement.typedTagsStayText`, default `true`
  - desc: A tag or link you type between words or at the end stays your word
  - tip: Say <code>#idea</code> is a Value of <code>Type</code> and you add <code>#high</code> to <code>- call Anna #idea</code>: ⏎ - <b>On</b> — <code>#idea</code> stays your word: <code>- #high :: call Anna #idea</code> ⏎ - <b>Off</b> — it moves into its Block: <code>- #high #idea :: call Anna</code> ⏎ This works in both modes. Tags at the very start of a line always count as Values
  - старые названия для поиска: «Value in text», «tag in the middle»

#### Prefix priority — `prefix-priority` (вкладка `pkm`)

_Intro:_ Some Values change the start of the line, like a checkbox from Status or an exclamation mark from Priority. When two of them want it at once, these rules pick the winner

_Tip:_ This only matters if two of your Values both want the start of the line, say <code>#todo</code> gives <code>[ ]</code> and <code>#high</code> gives <code>[!]</code>. If not, you can skip it ⏎ <b>Decide by</b> is the main choice. The setting at the bottom decides whether a nested Value beats its parent or the other way round

- **Decide by** — `prefix-priority-decide`, `dropdown`, path `pkm.prefixPriority.decideBy`, default `by-section`
  - desc: Settle it by the order of your Fields, or by a list of openings you rank yourself
  - tip: Say <code>#high</code> gives <code>[!]</code>, <code>#todo</code> gives <code>[ ]</code>, and you add <code>#high</code> to <code>- [ ] #todo :: call Anna</code>: ⏎ - <b>Field order</b> — <code>Imp</code> comes before <code>Type</code>, so you get <code>- [!] #high #todo :: call Anna</code> ⏎ - <b>Prefix order</b> — your list of line starts decides. With <code>[ ]</code> above <code>[!]</code>: <code>- [ ] #high #todo :: call Anna</code> ⏎ Not sure? Keep <b>Field order</b>
  - варианты: `by-section` Field order · `by-checkbox-list` Prefix order
  - старые названия для поиска: «Main checkbox priority», «Prefix Resolver»
- **Field order source** — `prefix-priority-source`, `dropdown`, path `pkm.prefixPriority.fieldOrderSource`, default `manual`
  - desc: Use the order your Fields are already in, or arrange a separate one
  - tip: Which list of Fields decides. Say <code>#high</code> gives <code>[!]</code> and <code>#todo</code> gives <code>[ ]</code>: ⏎ - <b>Field order</b> — the order of your Blocks. <code>Imp</code> comes before <code>Type</code>, so <code>[!]</code> wins ⏎ - <b>Manual</b> — its own list below. Put <code>Type</code> on top and <code>[ ]</code> wins ⏎ Not sure? Keep <b>Field order</b>
  - варианты: `auto` Field order · `manual` Manual
  - видна если: `pkm.prefixPriority.decideBy`
  - старые названия для поиска: «Field order mode»
- **`field-order-list`** — свой блок, рендерер `renderFieldOrderList`
- **`prefix-order-list`** — свой блок, рендерер `renderPrefixOrderList`
- **Parent or child wins** — `prefix-priority-parent`, `dropdown`, path `pkm.prefixPriority.parentOrChild`, default `subtag-over-tag`
  - desc: When a tag and its child Value both carry a Prefix
  - tip: Say <code>#task</code> gives <code>[ ]</code> and its child <code>#ready</code> gives <code>[x]</code>: ⏎ - <b>Parent tag</b> — the broader Value wins: <code>- [ ] #task #ready :: call Anna</code> ⏎ - <b>Child tag</b> — the more specific one wins: <code>- [x] #task #ready :: call Anna</code>
  - варианты: `tag-over-subtag` Parent tag · `subtag-over-tag` Child tag
  - старые названия для поиска: «Tag/Subtag priority»

#### Before you start — `transform-intro` (вкладка `transform`)

- **`transform-callout`** — свой блок, рендерер `renderTabCallout`

#### Inline to note — `inline-to-note` (вкладка `transform`)

_Intro:_ Press a key and the line you wrote becomes a note of its own, or is added to a note you already have. If you want, the line keeps a link to that note

_Tip:_ One press of <code>Transform inline to note</code> turns your line into a note. It picks a name, writes your text into the note and tidies up your line. The groups below go in that order ⏎ <code>- call Anna</code> → <code>- [[call Anna]] :: #processed</code>, and the new note <b>call Anna</b> holds your text ⏎ Nothing happens until <code>Inline to note</code> just below is on

- **Inline to note** — `i2n-enabled`, `toggle`, path `transform.inline2note.enabled`, default `false`
  - desc: Allow this to create notes and add to notes you already have
  - tip: The main switch that lets the plugin write to your vault ⏎ - <b>On</b> — <code>Transform inline to note</code> works: it can make a note, add to a note and edit your line ⏎ - <b>Off</b> — the command only tells you it is switched off ⏎ One press can change a note and your line, so make a backup first
  - старые названия для поиска: «Inline2Note enabled»
- **Templates folder** — `i2n-templates-folder`, `folder`, path `transform.inline2note.templatesFolder`, default `""`
  - desc: The folder your note templates live in
  - tip: A template is a normal note that each new note starts as a copy of. Templates from this folder appear in the lists below ⏎ Inside a template, <code>{{title}}</code> becomes the note name and <code>{{date}}</code> the date of the press, such as <code>2026-08-21</code> ⏎ Pick a folder or type a new name: the folder is created the first time it is needed
  - видна если: `transform.inline2note.enabled`
- **Default template** — `i2n-default-template`, `dropdown`, path `transform.inline2note.defaultTemplate`, default `""`
  - desc: The template on creation of new note when no special rules apply (see <code>Smart Rules</code> below)
  - tip: Smart Rules below can pick a different template for certain lines. This one covers everything else. The list shows only notes from <code>Templates folder</code>, so set that first
  - варианты: 
  - видна если: `transform.inline2note.enabled`
- **New notes folder** — `i2n-output-folder`, `folder`, path `transform.inline2note.outputFolder`, default `""`
  - desc: Where to put the notes this creates. Leave it empty to keep them next to the note you are in
  - tip: Where new notes go ⏎ - <b>Empty</b> — next to the note you are in ⏎ - <b>Inbox</b> — into that folder: <code>- call Anna</code> → <code>- [[Inbox/call Anna]]</code> ⏎ A new folder name is fine too: the folder is created with the first note
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «Output folder for new notes»
- **Floating button** — `i2n-floating`, `toggle`, path `transform.inline2note.floatingButton`, default `false`
  - desc: Put a small button at the end of the line you are on
  - tip: - <b>On</b> — a small button sits at the end of the line you are on. Clicking it does the same as <code>Transform inline to note</code> ⏎ - <b>Off</b> — no button: use the command or its hotkey ⏎ The button only shows on screen and is never saved into your note
  - видна если: `transform.inline2note.enabled`
  - см. также: `i2n-button-preview` — See where it appears
  - старые названия для поиска: «Flying button»
- **Distance from the text** — `i2n-floating-gap`, `slider`, path `transform.inline2note.floatingButtonGap`, default `12`
  - desc: How much room to leave between the line and the button
  - tip: Room between the end of the line and the button ⏎ - <b>0</b> — the button touches the last letter ⏎ - <b>40</b> — the widest gap ⏎ On a short line, a bigger gap keeps the button from looking like part of the text
  - диапазон: 0–40, шаг 1, ед. px
  - видна если: `transform.inline2note.enabled, transform.inline2note.floatingButton`
  - см. также: `i2n-button-preview` — The preview below moves with it
  - старые названия для поиска: «Floating button gap», «Button offset»
- **`i2n-button-preview`** — свой блок, рендерер `renderFloatingButton`
- **Open note after creation** — `content-open`, `toggle`, path `transform.inline2note.openTarget`, default `false`
  - desc: Jump straight to the note once it is written
  - tip: - <b>On</b> — the new note opens in a new tab, so you can check the result ⏎ - <b>Off</b> — you stay on your line, and a short message names the new note ⏎ Keep it on while you set things up, then turn it off once you trust it
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «Open transformed note», «Open the note afterwards»

#### New note naming — `naming` (вкладка `transform`)

_Intro:_ Every new note needs a name. Here you choose where that name comes from

_Tip:_ The name comes from the first of these that the line has: ⏎ - <b>Brackets</b> — <code>- call [Anna] today</code> → note <b>Anna</b> ⏎ - <b>Heading</b> — <code>## Weekly report</code> → note <b>Weekly report</b> ⏎ - <b>First words</b> — <code>- call Anna today</code> → note <b>call Anna today</b>

- **Note name** — `naming-mode`, `dropdown`, path `transform.inline2note.noteName.mode`, default `auto`
  - desc: Take the name from the line, or stop and ask you for it
  - tip: - <b>From line</b> — names the note at once, from brackets, a heading or the first words ⏎ - <b>Ask</b> — opens a small box first. Type a name and press <code>Enter</code>, or press <code>Escape</code> to cancel and leave the line as it was
  - варианты: `auto` From line · `manual` Ask
  - старые названия для поиска: «Note name mode»
- **Name brackets** — `naming-delimiters`, `text`, path `transform.inline2note.noteName.delimiters`, default `[]`
  - desc: Two characters. Whatever you put between them becomes the name
  - tip: Two characters: one opens the name, one closes it. The name leaves the text that goes into the note ⏎ - <b>[]</b> — <code>- call [Anna] today</code> → note <b>Anna</b> with the text <code>- call today</code> ⏎ - <b>()</b> — <code>- call (Anna about the contract) today</code> → note <b>Anna about the contract</b> ⏎ Left empty, it works as <code>[]</code>
  - старые названия для поиска: «Title delimiters», «Explicit name delimiters», «Name brackets»
- **Words to use instead** — `naming-word-count`, `number`, path `transform.inline2note.noteName.wordCount`, default `6`
  - desc: How many of the first words to use when there are no brackets
  - tip: Used when the line has no brackets and no heading ⏎ - <b>3</b> — <code>- draft the settings prototype today</code> → note <b>draft the settings</b> ⏎ - <b>6</b> — the same line → note <b>draft the settings prototype today</b> ⏎ Few words make names that look alike. Many words make long names
  - диапазон: 1–20, шаг 1
  - старые названия для поиска: «Auto title word count»
- **If the name already taken** — `naming-collision`, `dropdown`, path `transform.inline2note.nameCollision.mode`, default `new_note`
  - desc: What to do when you already have a note with that name
  - tip: What happens when the note <b>call Anna</b> already exists and you press on <code>- call Anna</code>: ⏎ - <b>New note</b> — keeps the old note and makes <b>call Anna-01</b>, next time <b>call Anna-02</b>: <code>- call Anna</code> → <code>- [[call Anna-01]]</code> ⏎ - <b>Add to existing</b> — adds your text to <b>call Anna</b>, where <code>Where to put the text</code> says. Good for a running log ⏎ - <b>Overwrite</b> — replaces everything in <b>call Anna</b> with your text. The plugin cannot bring the old text back
  - варианты: `new_note` New note · `add_to_note` Add to existing · `overwrite` Overwrite
  - старые названия для поиска: «Name collision mode», «If the name is taken»

#### Note content — `note-content` (вкладка `transform`)

_Intro:_ What the new note looks like inside: where your text goes and what sits above it

_Tip:_ Two choices here: where your text lands in the note, and what line goes above it to keep entries apart. With the usual settings a new note gets: ⏎ <code>### 2026-08-21 09:05</code> ⏎ <code>- call Anna</code> ⏎ The rest of the note comes from the template you chose above

- **Where to put the text** — `content-position`, `dropdown`, path `transform.inline2note.placement.position`, default `end`
  - desc: At the top of the note, or after whatever is already there
  - tip: Matters when the note already has text, from a template or from earlier entries. Say it holds <code>old entry</code> and you add <code>- call Anna</code>: ⏎ - <b>Beginning</b> — <code>- call Anna</code> goes above <code>old entry</code> ⏎ - <b>End</b> — it goes below, so entries keep the order you wrote them ⏎ - <b>Under heading</b> — it goes to the end of the section you name below, such as <code>## Log</code>
  - варианты: `beginning` Beginning · `end` End · `custom-header` Under heading
  - старые названия для поиска: «Where to place inline text?»
- **Name of the heading** — `content-target-header`, `text`, path `transform.inline2note.placement.targetHeader`, default `""`
  - desc: The heading your text is filed under
  - tip: Type the heading as it is in the note. Case does not matter, and if two match, the first one is used ⏎ - <code>## Log</code> — only a level 2 heading <code>Log</code> counts ⏎ - <code>Log</code> — a heading <code>Log</code> of any level counts ⏎ If the note has no such heading, it gets one: <code>## Log</code> stays as typed, and <code>Log</code> becomes <code># Log</code>
  - видна если: `transform.inline2note.placement.position`
- **If heading not found** — `content-header-missing`, `dropdown`, path `transform.inline2note.placement.fallback`, default `end`
  - desc: Where the heading is added when the note has none
  - tip: When the note has no heading by that name, the plugin writes it for you, with your text under it: ⏎ - <b>Beginning</b> — at the top of the note ⏎ - <b>End</b> — at the bottom: <code>old entry</code>, then <code>## Log</code> and <code>- call Anna</code> ⏎ Later entries find that heading and join its section
  - варианты: `beginning` Beginning · `end` End
  - видна если: `transform.inline2note.placement.position`
- **Line above the text** — `content-header-mode`, `dropdown`, path `transform.inline2note.placement.headerMode`, default `datetime`
  - desc: Something to put above your text so entries stay apart
  - tip: The line written above each entry, so entries do not run together: ⏎ - <b>Fixed text</b> — your own words, such as <code>### Call</code> ⏎ - <b>Date and time</b> — the moment you pressed, such as <code>### 2026-08-21 09:05</code> ⏎ - <b>None</b> — no line, the entry follows the one before it ⏎ Whether that line is a heading is set in the row below
  - варианты: `custom` Fixed text · `datetime` Date and time · `none` None
  - старые названия для поиска: «Inserted block header»
- **Line above is a heading** — `content-header-level`, `dropdown`, path `transform.inline2note.placement.headerLevel`, default `3`
  - desc: Make that line a heading you can fold, or leave it as plain text
  - tip: - <b>Plain text</b> — <code>2026-08-21 09:05</code>, a plain line ⏎ - <b>1</b> to <b>6</b> — a heading of that level: <b>3</b> gives <code>### 2026-08-21 09:05</code> ⏎ A heading folds and shows in the outline. <code>1</code> is the biggest. This row adds the hashes, so you do not type them
  - варианты: `0` Plain text · `1` 1 · `2` 2 · `3` 3 · `4` 4 · `5` 5 · `6` 6
  - видна если: `transform.inline2note.placement.headerMode`
- **Text of the line above** — `content-header-text`, `text`, path `transform.inline2note.placement.customHeader`, default `Captured`
  - desc: Typed into the note exactly as you write it here
  - tip: Type only the words. The hashes come from <code>Line above is a heading</code> ⏎ - <code>Call</code> with <b>3</b> there — <code>### Call</code> ⏎ - <code>## Call</code> with <b>3</b> there — still <code>### Call</code>, because hashes typed here are removed
  - видна если: `transform.inline2note.placement.headerMode`
- **Date format** — `content-datetime`, `text`, path `transform.inline2note.placement.datetimeFormat`, default `YYYY-MM-DD HH:mm`
  - desc: Today’s date, written the way you set out here
  - tip: Letters stand for parts of the date. Everything else stays as you typed it ⏎ - <code>YYYY</code>, <code>YY</code> — the year, or its last two digits ⏎ - <code>MM</code>, <code>DD</code> — the month, the day ⏎ - <code>HH</code>, <code>mm</code>, <code>ss</code> — the hour, the minute, the second ⏎ <code>DD.MM.YYYY HH:mm</code> → <code>21.08.2026 09:05</code>
  - видна если: `transform.inline2note.placement.headerMode`
  - старые названия для поиска: «Datetime header format»

#### Source line — `source-line` (вкладка `transform`)

_Intro:_ What happens to the line you pressed on, after the note is safely saved

_Tip:_ Your line changes only after the note is saved, so nothing is lost if saving fails. With the usual settings: ⏎ <code>- call Anna</code> → <code>- [[call Anna]] :: #processed</code> ⏎ The link and the mark are both optional. With both off and the text kept, the line looks untouched, and a second press files it twice

- **`source-preview`** — свой блок, рендерер `renderSourcePreview`
- **Sub-lines (tree) behavior** — `content-sublines`, `dropdown`, path `transform.inline2note.sublines`, default `stay`
  - desc: Leave them where they are, or take them into the note too
  - tip: Say <code>- call Anna</code> has two sub-points under it, <code>- ask about the price</code> and <code>- send the contract</code>. The note gets all three lines either way ⏎ - <b>Keep</b> — the sub-points stay here, under <code>- [[call Anna]]</code> ⏎ - <b>Move</b> — they leave, and only <code>- [[call Anna]]</code> stays here
  - варианты: `stay` Keep · `remove` Move
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «Sublines behavior»
- **What happens with current line** — `source-text`, `dropdown`, path `transform.inline2note.sourceProcessing.text`, default `remove`
  - desc: The text goes into the note either way — this is about the line you pressed on
  - tip: Your text goes into the note either way. Say the line is <code>- call Anna about the contract</code> and the note is named <b>call Anna</b>: ⏎ - <b>Remove</b> — <code>- [[call Anna]]</code> ⏎ - <b>Keep</b> — <code>- call Anna about the contract [[call Anna]]</code> ⏎ - <b>Keep without name</b> — <code>- [[call Anna]] about the contract</code> ⏎ - <b>Keep first words</b> — with <b>2</b> in <code>Words to keep</code>: <code>- [[call Anna]] about the</code>
  - варианты: `remove` Remove · `leave` Keep · `leave_named` Keep without name · `words` Keep first words
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «What happens to your text»
- **Words to keep** — `source-keep-words`, `number`, path `transform.inline2note.sourceProcessing.keepWords`, default `3`
  - desc: How much of the line stays behind
  - tip: How many words stay after the link. The words that became the note name do not count, since the link takes their place. With the note <b>call Anna</b> from <code>- call Anna about the contract</code>: ⏎ - <b>1</b> — <code>- [[call Anna]] about</code> ⏎ - <b>2</b> — <code>- [[call Anna]] about the</code> ⏎ The rest moves into the note
  - диапазон: 1–20, шаг 1
  - видна если: `transform.inline2note.sourceProcessing.text`
- **Fields to keep** — `source-fields-head`, `note`
  - desc: Which Fields stay on the line you pressed on
  - tip: Ticked Fields stay on the line. The rest leave with the text. The note always gets the whole line. With <code>- [ ] #todo :: call Anna</code> and the mark <code>#moved</code>: ⏎ - <b>Type ticked</b> — <code>- [ ] #todo :: [[call Anna]] :: #moved</code> ⏎ - <b>Nothing ticked</b> — <code>- [[call Anna]] :: #moved</code>
  - видна если: `transform.inline2note.enabled`
- **`source-fields`** — свой блок, рендерер `renderSourceFields`
- **Keep sub-fields** — `source-keep-sub`, `toggle`, path `transform.inline2note.sourceProcessing.keepSubFields`, default `false`
  - desc: A Field you keep keeps its child Values on the line too
  - tip: Child Fields have no row of their own in the list above. They follow their parent: ⏎ - <b>Off</b> — the kept Field stays on the line and its child Values go into the note ⏎ - <b>On</b> — they stay on the line too, and a copy still goes into the note
  - видна если: `transform.inline2note.enabled`
- **Insert wikilink in current line** — `source-link`, `toggle`, path `transform.inline2note.sourceProcessing.replaceWithLink`, default `true`
  - desc: Put a link to the new note on the line you pressed on
  - tip: Examples with <b>Remove</b> above: ⏎ - <b>On</b> — <code>- call Anna</code> → <code>- [[call Anna]]</code>. Click the link to open the note ⏎ - <b>Off</b> — <code>- call Anna</code> → <code>-</code>, and nothing shows where the text went ⏎ The mark below tells you the line is done, link or not
  - старые названия для поиска: «Replace payload with note link», «Leave a link behind»
- **Mark transformed line** — `source-marker`, `text`, path `transform.inline2note.sourceProcessing.token`, default `#processed`
  - desc: A word or tag added to the line so you can see it has been handled
  - tip: A word or tag added to the line once it is a note. Search for it to find everything you filed, or hide those lines from a to-do list ⏎ - <code>#moved</code> — <code>- call Anna</code> → <code>- [[call Anna]] :: #moved</code> ⏎ - <b>Empty</b> — nothing is added ⏎ A line with the mark is never filed twice: a second press only shows a message
  - старые названия для поиска: «Processed token», «Mark the line as done»
- **Where the mark goes** — `source-marker-position`, `dropdown`, path `transform.inline2note.sourceProcessing.panel`, default `right`
  - desc: Before your text, or after it
  - tip: From <code>- call Anna</code>: ⏎ - <b>Left Block</b> — <code>- #moved :: [[call Anna]]</code>, next to the tags ⏎ - <b>Right Block</b> — <code>- [[call Anna]] :: #moved</code>, after your text ⏎ Pick whichever reads better to you
  - варианты: `left` Left Block · `right` Right Block
  - видна если: `transform.inline2note.sourceProcessing.token`
  - старые названия для поиска: «Processed token panel»
- **Dim transformed line** — `source-dim`, `toggle`, path `transform.inline2note.sourceProcessing.visual.enabled`, default `false`
  - desc: Fade a line once it carries the mark above, so your eye skips it
  - tip: - <b>On</b> — lines with the mark fade, such as <code>- [[call Anna]] :: #processed</code>, so your eye skips them ⏎ - <b>Off</b> — they look like any other line ⏎ Only the look changes: the text stays and search finds it. Remove the mark by hand, and the line looks normal again
  - видна если: `transform.inline2note.sourceProcessing.token`
  - старые названия для поиска: «Dim the lines already filed»
- **Opacity of transformed line** — `source-dim-opacity`, `slider`, path `transform.inline2note.sourceProcessing.visual.opacity`, default `65`
  - desc: Zero leaves the line as it is, eighty makes it barely readable
  - tip: How much a marked line fades ⏎ - <b>0</b> — no fade at all ⏎ - <b>80</b> — barely readable ⏎ Only the look changes: search still finds the line and <code>Undo</code> still works. Use the least fade that lets your eye skip it
  - диапазон: 0–80, шаг 5, ед. %
  - видна если: `transform.inline2note.sourceProcessing.token, transform.inline2note.sourceProcessing.visual.enabled`
  - старые названия для поиска: «How much is left»
- **Color of transformed line** — `source-dim-color`, `color`, path `transform.inline2note.sourceProcessing.visual.color`, default `""`
  - desc: Leave it unset to keep the color your theme gives the text
  - tip: - <b>Unset</b> — the line keeps the text color of your theme and only fades ⏎ - <b>Set</b> — the line takes your color, and the fade above still applies ⏎ Set it only if fading alone does not make finished lines easy to spot
  - видна если: `transform.inline2note.sourceProcessing.token, transform.inline2note.sourceProcessing.visual.enabled`
  - старые названия для поиска: «Color of a filed line»

#### Auto-MOC in your links — `backlinks` (вкладка `transform`)

_Intro:_ When a line links to other notes, each of them can get a link back to the new note

_Tip:_ A line often links to the notes it belongs to: a project, a person, a place. With this on, each of them gets a link to the new note, so a project note slowly lists everything filed under it ⏎ <code>- [ ] #todo [[Anna]] :: call about the price</code> → the note <b>Anna</b> gets <code>- [[call about the price]]</code> ⏎ Only links that are a Value of a Field count. A link in your sentence, like <code>call [[Bob]]</code>, is left alone

- **Link the notes you mention** — `backlink-enabled`, `toggle`, path `transform.inline2note.backlink.enabled`, default `false`
  - desc: Write a link to the new note into the notes of the link Values on this line
  - tip: - <b>On</b> — each note this line links to as a Value gets a link to the new note, such as <code>- [[call about the price]]</code> ⏎ - <b>Off</b> — no other note is touched ⏎ The link uses the full path, so it finds the right note when two share a name. Only notes that exist get it, and a note that already links there is skipped
  - старые названия для поиска: «Create wikilink to transformed note in reference notes», «Backlinks into the notes you mention», «Automatic MOC»
- **Link to Navigator** — `backlink-navigator`, `toggle`, path `transform.inline2note.backlink.navigator`, default `false`
  - desc: Also write the link into the navigator note of a child link
  - tip: Normally a child link’s navigator gets nothing. With this on, the navigator note gets the link too, and a child under two navigators gets links from both. A missing navigator note is created empty. A Tag navigator is not a note, so nothing is written for it
  - видна если: `transform.inline2note.backlink.enabled`
- **Add empty line before wikilink** — `backlink-empty-line`, `toggle`, path `transform.inline2note.backlink.emptyLine`, default `true`
  - desc: Keep a blank line between the links written into a note
  - tip: - <b>On</b> — an empty line between links: <code>- [[old note]]</code>, empty line, <code>- [[new note]]</code> ⏎ - <b>Off</b> — links stand one under another as a tight list ⏎ This applies wherever the link goes, under a heading too
  - видна если: `transform.inline2note.backlink.enabled`
- **Where to put the link** — `backlink-position`, `dropdown`, path `transform.inline2note.backlink.placement.position`, default `end`
  - desc: At the top of that note, or after whatever is already there
  - tip: Say the note <b>Anna</b> already lists <code>- [[old note]]</code>: ⏎ - <b>Beginning</b> — the new link goes above it, below the note properties ⏎ - <b>End</b> — it goes below, so links keep the order you filed them ⏎ - <b>Under heading</b> — it goes to the end of the section you name below, such as <code>## Calls</code>
  - варианты: `beginning` Beginning · `end` End · `custom-header` Under heading
  - видна если: `transform.inline2note.backlink.enabled`
  - старые названия для поиска: «Where the backlink goes»
- **Name of the heading** — `backlink-target-header`, `text`, path `transform.inline2note.backlink.placement.targetHeader`, default `""`
  - desc: The heading the link is filed under
  - tip: Type the heading as it is in the note. Case does not matter ⏎ - <code>## Calls</code> — only a level 2 heading <code>Calls</code> counts ⏎ - <code>Calls</code> — a heading <code>Calls</code> of any level counts ⏎ If the note has no such heading, it gets one: <code>## Calls</code> stays as typed, and <code>Calls</code> becomes <code># Calls</code>
  - видна если: `transform.inline2note.backlink.enabled, transform.inline2note.backlink.placement.position`
- **If heading not found** — `backlink-header-missing`, `dropdown`, path `transform.inline2note.backlink.placement.fallback`, default `end`
  - desc: Where the heading is added when that note has none
  - tip: When a note has no heading by that name, the plugin writes it for you, with the link under it: ⏎ - <b>Beginning</b> — at the top of the note ⏎ - <b>End</b> — at the bottom: <code>## Calls</code>, then <code>- [[call about the price]]</code> ⏎ Later links find that heading and join its section
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

_Tip:_ - <b>Opacity</b> — the rows fade the tags, dates and links on each side so your own text stands out ⏎ - <b>Line view</b> — sets how big they are and adds a colored Stripe behind them ⏎ - <b>Tag view</b> — shapes the tag bubble ⏎ You set the colors of single Values on each Field, on the <code>Tags & PKM</code> tab

- **`tag-preview`** — свой блок, рендерер `renderTagPreview`
- **`line-view-sub`** — свой блок, рендерер `?`
- **Opacity of the Left Block** — `tags-opacity-left`, `slider`, path `visual.tags.opacityLeft`, default `100`
  - desc: Dims everything written before your text, tags and elements alike
  - tip: Fades everything before your text. Faded is not hidden: it stays on the line, in search and in the commands ⏎ - <b>100</b> — <code>#todo :: call Anna</code> looks as usual ⏎ - <b>40</b> — <code>#todo</code> turns pale and <code>call Anna</code> stands out ⏎ - <b>0</b> — the Left Block is invisible but still there
  - диапазон: 0–100, шаг 1, ед. %
  - см. также: `field-editor` — Tag colors are set per Value under Fields
  - старые названия для поиска: «Opacity Left»
- **Opacity of the Right Block** — `tags-opacity-right`, `slider`, path `visual.tags.opacityRight`, default `100`
  - desc: Dims everything written after your text, tags and elements alike
  - tip: Fades everything after your text, apart from the left side. Things there usually need less attention ⏎ - <b>100</b> — <code>call Anna :: [[Meeting]]</code> looks as usual ⏎ - <b>40</b> — <code>[[Meeting]]</code> turns pale and <code>call Anna</code> stands out ⏎ - <b>0</b> — the Right Block is invisible but still there and still works
  - диапазон: 0–100, шаг 1, ед. %
  - старые названия для поиска: «Opacity Right»
- **Left Block text size** — `tags-text-size-left`, `slider`, path `visual.tags.textSizePctLeft`, default `100`
  - desc: How big everything before your text is written, next to the rest of your note
  - tip: Changes the size of the tags, dates and links before your text. Your own text keeps its size ⏎ - <b>100</b> — <code>#todo</code> in <code>#todo :: call Anna</code> has its usual size ⏎ - <b>70</b> — <code>#todo</code> is smaller, so your sentence leads ⏎ - <b>130</b> — <code>#todo</code> is bigger and competes with your text
  - диапазон: 50–140, шаг 5, ед. %
  - старые названия для поиска: «Tag text size», «Text size Left»
- **Right Block text size** — `tags-text-size-right`, `slider`, path `visual.tags.textSizePctRight`, default `100`
  - desc: How big everything after your text is written, next to the rest of your note
  - tip: Changes the size of the tags, dates and links after your text, apart from the left side. Your own text keeps its size ⏎ - <b>100</b> — <code>[[Meeting]]</code> in <code>call Anna :: [[Meeting]]</code> has its usual size ⏎ - <b>80</b> — <code>[[Meeting]]</code> is a size smaller and reads as a side note
  - диапазон: 50–140, шаг 5, ед. %
  - старые названия для поиска: «Tag text size», «Text size Right»
- **Color the Block with Stripe** — `tags-block-fill`, `toggle`, path `visual.tags.blockFill.enabled`, default `false`
  - desc: A Stripe behind the Left Block and the Right Block, so the two stand out from your text
  - tip: - <b>On</b> — in <code>#todo :: call Anna :: [[Meeting]]</code> a colored Stripe runs behind <code>#todo</code> and behind <code>[[Meeting]]</code> ⏎ - <b>Off</b> — no Stripe ⏎ Your own text and empty Blocks never get a Stripe, and everything stays clickable. A single tag bubble can hide the Stripe: raise <code>Stripe height</code> or <code>Stripe width</code>
  - старые названия для поиска: «Block background», «Color the Blocks»
- **Stripe direction** — `tags-block-fill-direction`, `dropdown`, path `visual.tags.blockFill.direction`, default `both`
  - desc: Which of the two Blocks gets a Stripe
  - tip: Example line: <code>#todo :: call Anna :: [[Meeting]]</code> ⏎ - <b>Left</b> — a Stripe only behind <code>#todo</code> ⏎ - <b>Right</b> — a Stripe only behind <code>[[Meeting]]</code> ⏎ - <b>Both</b> — a Stripe on each side. The usual choice ⏎ Your own text never gets a Stripe
  - варианты: `left` Left · `right` Right · `both` Both
  - видна если: `visual.tags.blockFill.enabled`
- **Stripe color** — `tags-block-fill-color`, `color`, path `visual.tags.blockFill.color`, default `""`
  - desc: Leave it unset and the Stripe follows your theme
  - tip: - <b>Unset</b> — the Stripe takes your theme’s accent color and still fits when you switch themes ⏎ - <b>A color</b> — the Stripe is always that color, for example pale yellow behind <code>#todo</code>
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Block color»
- **Stripe opacity** — `tags-block-fill-opacity`, `slider`, path `visual.tags.blockFill.opacity`, default `12`
  - desc: How strongly the Stripe shows through
  - tip: How strongly the Stripe shows. Keep it low so the writing stays easy to read ⏎ - <b>0</b> — the Stripe is invisible ⏎ - <b>12</b> — a light tint that shows where a Block starts and ends ⏎ - <b>50</b> — a strong color behind the Values
  - диапазон: 0–100, шаг 1, ед. %
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Block color strength»
- **Stripe height** — `tags-block-fill-height`, `slider`, path `visual.tags.blockFill.heightPct`, default `60`
  - desc: How far the Stripe reaches above and below the writing
  - tip: - <b>0</b> — the Stripe is exactly as tall as the writing, so a single tag bubble can hide it ⏎ - <b>60</b> — it reaches a good way above and below the writing ⏎ - <b>100</b> — it fills the whole line. Stripes of lines one under another meet without overlapping
  - диапазон: 0–100, шаг 20, ед. %
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Band height»
- **Stripe width** — `tags-block-fill-width`, `slider`, path `visual.tags.blockFill.widthPct`, default `50`
  - desc: How far the Stripe reaches past the Block on both of its sides
  - tip: Example line: <code>#todo :: call Anna</code> ⏎ - <b>0</b> — the Stripe covers only <code>#todo</code> ⏎ - <b>50</b> — it reaches up to the Separator <code>::</code> ⏎ - <b>100</b> — it covers <code>::</code> too ⏎ On the Left Block it never covers the bullet or the checkbox
  - диапазон: 0–100, шаг 5, ед. %
  - видна если: `visual.tags.blockFill.enabled`
  - старые названия для поиска: «Band width»
- **`tag-view-sub`** — свой блок, рендерер `?`
- **Tag bubble width** — `tags-bubble-width`, `slider`, path `visual.tags.bubbleWidthPct`, default `100`
  - desc: How much breathing room there is either side of the word
  - tip: Sets the room on each side of the word. The word keeps its size ⏎ - <b>20</b> — the word sits almost at the edge of the bubble ⏎ - <b>100</b> — the usual bubble ⏎ - <b>140</b> — wide bubbles, so <code>#todo #urgent</code> look like separate chips
  - диапазон: 20–140, шаг 5, ед. %
  - старые названия для поиска: «Tag bubble size - width», «Bubble width»
- **Tag bubble height** — `tags-bubble-height`, `slider`, path `visual.tags.bubbleHeightPct`, default `100`
  - desc: How tall the bubble is around the word
  - tip: Sets the room above and below the word. Keep it modest: tall bubbles push the lines of your note apart ⏎ - <b>20</b> — the bubble hugs the word ⏎ - <b>100</b> — the usual bubble ⏎ - <b>140</b> — a taller bubble around the word
  - диапазон: 20–140, шаг 5, ед. %
  - старые названия для поиска: «Tag bubble size - height», «Bubble height»
- **Tag bubble corners** — `tags-corners`, `slider`, path `visual.tags.cornersPct`, default `0`
  - desc: Slide from fully rounded to completely square
  - tip: Changes only the corners. The color, the room around the word and the text size stay the same ⏎ - <b>0</b> — <code>#todo</code> sits in a round pill ⏎ - <b>50</b> — rounded corners, less round than a pill ⏎ - <b>100</b> — a sharp rectangle, which looks denser and suits narrow bubbles
  - диапазон: 0–100, шаг 1
  - старые названия для поиска: «Tag shape», «Bubble corners»
- **Empty tag bubble width** — `tags-empty-bubble`, `slider`, path `visual.tags.emptyBubblePct`, default `100`
  - desc: Width of a bubble whose <code>Show</code> is set to <code>empty</code>
  - tip: Under <code>Fields</code> you can set a Value’s <code>Show</code> to <code>empty</code>. Then <code>#urgent</code> shows only its color, as a bubble with no text. This row sets how wide it is ⏎ - <b>50</b> — half the usual width ⏎ - <b>100</b> — the usual width ⏎ - <b>180</b> — almost twice as wide
  - диапазон: 10–180, шаг 5, ед. %
  - см. также: `field-editor` — Set a Value to empty under Fields
  - старые названия для поиска: «Empty bubble size», «Empty bubble width»
- **`link-view-sub`** — свой блок, рендерер `?`
- **Preview on hover** — `link-hover-preview`, `toggle`, path `visual.tags.linkShown.hoverPreview`, default `false`
  - desc: Hovering a Value shown as your own text opens the page preview — hold <code>Ctrl</code> while hovering
  - tip: For link Values shown as your own text, for example <code>[[Project Alpha]]</code> shown as <code>Alpha</code> ⏎ - <b>On</b> — hold <code>Ctrl</code> (<code>Cmd</code> on macOS) and hover <code>Alpha</code> to see the note, like Obsidian’s <code>Page preview</code> ⏎ - <b>Off</b> — hovering shows nothing. A click still opens the note ⏎ To preview without <code>Ctrl</code>, turn off the modifier key for <code>Page preview → Source mode</code>
  - старые названия для поиска: «Link hover preview», «Custom link preview»
- **Drag to move** — `link-draggable`, `toggle`, path `visual.tags.linkShown.draggable`, default `false`
  - desc: Drag a Value shown as your own text into another note
  - tip: For link Values shown as your own text, for example <code>[[Project Alpha]]</code> shown as <code>Alpha</code> ⏎ - <b>On</b> — drag <code>Alpha</code> into another note and you get the link <code>[[Project Alpha]]</code> there. Pressing the Value starts a drag instead of placing the cursor ⏎ - <b>Off</b> — the Value cannot be dragged. Off by default because it is easy to grab by accident
  - старые названия для поиска: «Link drag», «Custom link drag»
- **Link target color** — `link-target-color`, `color`, path `visual.tags.linkAsWritten.targetColor`, default `""`
  - desc: What you read in a wikilink: the name between <code>[[</code> and <code>]]</code>
  - tip: Colors the note name in a link Value written as <code>[[Meeting]]</code> (<code>Show</code> = <code>default</code>) ⏎ - <b>Empty</b> — <code>Meeting</code> keeps your theme’s link color ⏎ - <b>A color</b> — <code>Meeting</code> takes that color, the brackets do not ⏎ Hyperlinks have their own rows below
  - старые названия для поиска: «Link color», «Wikilink color», «Link text color»
- **Link brackets color** — `link-brackets-color`, `color`, path `visual.tags.linkAsWritten.bracketsColor`, default `""`
  - desc: The markup around it: <code>[[</code> and <code>]]</code>
  - tip: Colors <code>[[</code> and <code>]]</code> around <code>[[Meeting]]</code>, apart from the name ⏎ - <b>Empty</b> — the brackets keep your theme’s color ⏎ - <b>A color</b> — the brackets take that color ⏎ You see it only in the previews here and on the line your cursor is on. Everywhere else Obsidian hides the brackets
  - старые названия для поиска: «Bracket color», «Wikilink brackets»
- **Hyperlink target color** — `hyperlink-target-color`, `color`, path `visual.tags.hyperlink.targetColor`, default `""`
  - desc: The text you read in a Markdown link — what stands between the square brackets
  - tip: Colors the text you read in a Markdown link, in every note ⏎ - <b>Empty</b> — <code>Docs</code> in <code>[Docs](https://example.com)</code> keeps your theme’s link color ⏎ - <b>A color</b> — <code>Docs</code> takes that color ⏎ Links inside backticks and images are not changed. The address has its own row below
  - старые названия для поиска: «Hyperlink color», «External link color», «URL color»
- **Hyperlink brackets color** — `hyperlink-brackets-color`, `color`, path `visual.tags.hyperlink.bracketsColor`, default `""`
  - desc: The markup around it: the square brackets and the round ones, without the address
  - tip: Colors only <code>[</code>, <code>](</code> and <code>)</code> in <code>[Docs](https://example.com)</code> ⏎ - <b>Empty</b> — they keep your theme’s color ⏎ - <b>A color</b> — they take that color. <code>Docs</code> and the address do not ⏎ You see them only in the preview and on the line your cursor is on. Everywhere else Obsidian hides them
  - старые названия для поиска: «Hyperlink brackets», «URL markup color», «Address color»
- **Hyperlink address color** — `hyperlink-address-color`, `color`, path `visual.tags.hyperlink.addressColor`, default `""`
  - desc: The address itself — inside the round brackets, or written on its own
  - tip: Colors every web address. Leave it empty to keep your theme’s color ⏎ - <b>On its own</b> — <code>https://example.com</code> or <code>www.example.com</code> is always colored ⏎ - <b>Inside a link</b> — the address in <code>[Docs](https://example.com)</code> is colored only on the line your cursor is on
  - старые названия для поиска: «Address color», «URL color», «Link href color»
- **`link-preview`** — свой блок, рендерер `renderLinkPreview`

#### Tag Bars — `tag-bars` (вкладка `visual`)

_Intro:_ A colored Bar in the margin shows at a glance what a line and everything nested under it is about, without reading the tags

_Tip:_ Bars take their colors from the Values of one tag Field, which you choose below. Links and dates have no colors, so they can’t draw Bars. A Bar runs down its line and everything nested under it. A deeper line with its own Value gets its own Bar beside it. Your text does not move, and once the Bar shows the Value you can hide the tag

- **`bars-preview`** — свой блок, рендерер `renderBarsPreview`
- **Tag Bars** — `bars-active`, `toggle`, path `visual.tagBars.active`, default `false`
  - desc: Draw the Bars
  - tip: - <b>On</b> — a colored Bar in the margin runs along <code>- #todo :: plan trip</code> and the lines nested under it ⏎ - <b>Off</b> — no Bars. The settings below are kept ⏎ Bars use the colors you already gave the Values, so you color nothing twice
  - старые названия для поиска: «Activate strip», «Strip», «Hierarchy Bars», «Level Bars»
- **Which Field draws Bars** — `bars-field`, `dropdown`, path `visual.tagBars.fieldId`, default `""`
  - desc: Bars work with tag Fields only, and only for the one chosen here
  - tip: Pick the one tag Field you look for on a page, usually progress or urgency ⏎ - <b>None</b> — no Field is chosen, so no Bars are drawn ⏎ - <b>A tag Field</b> — a line with <code>#urgent</code> gets a Bar in the color of <code>#urgent</code> ⏎ Only tag Fields are listed: links and dates have no colors
  - варианты: `` None
  - видна если: `visual.tagBars.active`
  - см. также: `field-editor` — Bar colors are the Value colors under Fields
  - старые названия для поиска: «Strip Field»
- **Number of Bars** — `bars-count`, `slider`, path `visual.tagBars.stripesToShow`, default `2`
  - desc: How far down the nesting to keep drawing them
  - tip: How many levels of a list can show a Bar ⏎ - <b>1</b> — one Bar: <code>- #todo :: plan trip</code> and all lines under it show the color of <code>#todo</code> ⏎ - <b>2</b> — a child line with its own Value, like <code>#urgent</code>, adds a second Bar ⏎ - <b>3</b> — a grandchild with its own Value adds a third
  - диапазон: 1–3, шаг 1
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Stripes to show»
- **Show the Field’s tag** — `bars-show-tag`, `toggle`, path `visual.tagBars.tagVisibility`, default `true`
  - desc: Keep the tag on the line, or let the Bar speak for it
  - tip: - <b>On</b> — <code>- #todo :: call Anna</code> shows both the tag and the Bar ⏎ - <b>Off</b> — the line shows <code>- :: call Anna</code>, and the Bar alone tells you it is <code>#todo</code> ⏎ The tag stays in your note and stays searchable
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip tag visibility»
- **Hide the leftover marker** — `bars-hide-separator`, `toggle`, path `visual.tagBars.hideSeparatorWhenOnlyStripToken`, default `false`
  - desc: Tidy away a Separator that has nothing left beside it
  - tip: Works when the Field’s tag is hidden and was the only thing on that side of your text ⏎ - <b>On</b> — <code>- #todo :: call Anna</code> shows as <code>- call Anna</code> ⏎ - <b>Off</b> — it shows as <code>- :: call Anna</code>
  - видна если: `visual.tagBars.active, visual.tagBars.tagVisibility`
  - старые названия для поиска: «Hide Separator?»
- **Bar arrangement** — `bars-mode`, `dropdown`, path `visual.tagBars.mode`, default `default`
  - desc: Which lane each level of the tree draws its Bar in
  - tip: - <b>Parent outside</b> — every level of the list has its own lane, so you can count the nesting from the left. A level without a Value leaves its lane empty ⏎ - <b>Rotate</b> — only lines with a Value take a lane, so the Bars sit side by side. Deep lists stay narrower, but a lane no longer tells you the level
  - варианты: `default` Parent outside · `crossing` Rotate
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip mode»
- **Bar thickness** — `bars-thickness`, `slider`, path `visual.tagBars.thickness`, default `2`
  - desc: How wide each Bar is
  - tip: One width for all Bars ⏎ - <b>2</b> — thin Bars that suit dense notes ⏎ - <b>6</b> — wide Bars, easier to tell apart when your Value colors are similar
  - диапазон: 1–12, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip thickness»
- **Space between Bars** — `bars-gap`, `slider`, path `visual.tagBars.childOffset`, default `12`
  - desc: The gap between one level and the next
  - tip: The space between the Bars of two levels ⏎ - <b>2</b> — the Bars of a deep list almost touch and look like one ribbon ⏎ - <b>12</b> — the levels stay clearly apart ⏎ More space leaves less room for your text
  - диапазон: 2–20, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Parent/child strip distance»
- **Distance from the text** — `bars-distance`, `slider`, path `visual.tagBars.spacing`, default `20`
  - desc: How far the Bars sit from where your line begins
  - tip: Moves all the Bars together, away from where your line begins ⏎ - <b>8</b> — the Bars sit close to your list ⏎ - <b>30</b> — more room, useful when your notes are indented and the Bars crowd the bullets
  - диапазон: 8–48, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip spacing»
- **Vertical gap between Bars** — `bars-line-gap`, `slider`, path `visual.tagBars.lineGap`, default `2`
  - desc: Blank left above and below a Bar, so two lines in a row stay apart
  - tip: Blank space above and below each Bar, so lines one under another stay apart ⏎ - <b>0</b> — the Bars of two lines in a row merge into one long Bar ⏎ - <b>2</b> — a small break between the lines ⏎ - <b>8</b> — a big break, and each Bar gets shorter
  - диапазон: 0–8, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Bar height»
- **Bars for the whole tree** — `bars-whole-tree`, `toggle`, path `visual.tagBars.drawWholeTree`, default `true`
  - desc: A Bar runs down everything nested under its line, not just the line itself
  - tip: Example: <code>- #todo :: plan trip</code> with <code>- book hotel</code> nested under it ⏎ - <b>On</b> — the Bar of <code>#todo</code> runs down both lines ⏎ - <b>Off</b> — only <code>plan trip</code> gets a Bar. <code>book hotel</code> has no Value of its own, so it gets none, and <code>Join Bars in a tree</code> has no effect
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Draw bars for the whole tree», «Bars for subtree»
- **Join Bars in a tree** — `bars-join-tree`, `toggle`, path `visual.tagBars.joinTree`, default `true`
  - desc: A parent and its own children draw one unbroken Bar
  - tip: Example: <code>- #todo :: plan trip</code> with <code>- book hotel</code> nested under it ⏎ - <b>On</b> — the Bar of <code>#todo</code> runs unbroken from <code>plan trip</code> down into <code>book hotel</code> ⏎ - <b>Off</b> — the Bar has a small break between the two lines, from <code>Vertical gap between Bars</code> ⏎ Lines that are not nested in each other stay apart either way
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Tree gap»

#### tagWheel — `tagwheel` (вкладка `visual`)

_Intro:_ tagWheel is a picker that opens over the line. Your Fields run across it and the Values of the current Field run down. You pick a Value by looking instead of remembering a hotkey for each Field

_Tip:_ Every Field has its own pair of hotkeys, which is too many to remember. Instead, one command opens the picker over the line. Left and right move between Fields, and up and down move between Values. <code>Tab</code> jumps to the Fields on the other side of your text, and <code>Escape</code> closes it without changing anything. The settings below control how it looks

- **`wheel-preview`** — свой блок, рендерер `renderWheelPreview`
- **`panel-sub`** — свой блок, рендерер `?`
- **Show tag markers** — `panel-markers`, `toggle`, path `visual.tagWheel.showMarkers`, default `true`
  - desc: Show the hash and emoji in the picker, or just the words
  - tip: Changes only what the picker shows. What goes into your note is the same ⏎ - <b>On</b> — the picker shows <code>#todo</code> ⏎ - <b>Off</b> — the picker shows <code>todo</code>, which is quicker to read
  - старые названия для поиска: «Show Prefix»
- **tagWheel Value names** — `panel-value-names`, `dropdown`, path `visual.tagWheel.valueNames`, default `default`
  - desc: What the picker prints for a Field that already carries a Value
  - tip: What the picker shows for a Field that has a Value. Example: <code>#idea</code> with the custom text <code>💡</code> under Fields (<code>Show</code> = <code>custom</code>) ⏎ - <b>Default</b> — <code>#idea</code> ⏎ - <b>Custom</b> — <code>💡</code> ⏎ - <b>Custom + default</b> — <code>💡#idea</code> ⏎ A Value without custom text always shows as written
  - варианты: `default` Default · `custom` Custom · `both` Custom + default
  - старые названия для поиска: «Value names», «Custom text in the picker», «Printed name»
- **Highlight the tagWheel line** — `panel-highlight`, `toggle`, path `visual.tagWheel.highlightLine`, default `true`
  - desc: Mark the line while the picker is open, so it stands out from the page
  - tip: - <b>On</b> — while the picker is open, its line is wrapped in <code>==</code> and shows as highlighted, so it stands out from your note ⏎ - <b>Off</b> — the picker looks like plain text on a busy page ⏎ <code>Background color</code> below sets the color. The marks go away when the picker closes, and nothing is left in your note
  - старые названия для поиска: «Highlight the line»
- **Inactive Field text color** — `panel-text-color`, `color`, path `visual.tagWheel.textColor`, default `""`
  - desc: The color of the Field names you are not standing on, while the line is marked
  - tip: Colors the Fields you are not on. In the picker <code>#todo [-Due] -Imp</code> you stand on <code>Due</code>, so this colors <code>-Imp</code> ⏎ - <b>Empty</b> — your theme’s text color ⏎ - <b>A color</b> — those Fields take that color ⏎ Works only while <code>Highlight the tagWheel line</code> is on. The box of neighboring Values is not affected
  - старые названия для поиска: «Text color»
- **Bold Field names** — `panel-bold-names`, `toggle`, path `visual.tagWheel.boldFieldNames`, default `false`
  - desc: Print every Field that shows its own name in bold, while the line is marked
  - tip: Example picker: <code>#todo [-Due] -Imp</code>, you stand on <code>Due</code> ⏎ - <b>Off</b> — only the Field you are on, <code>[-Due]</code>, is bold ⏎ - <b>On</b> — <code>-Imp</code> is bold too, so empty Fields stand out. <code>#todo</code> has a Value and stays regular ⏎ Needs <code>Highlight the tagWheel line</code> on
  - старые названия для поиска: «Bold names», «Empty Fields in bold»
- **Active Field text color** — `panel-active-color`, `color`, path `visual.tagWheel.activeTextColor`, default `""`
  - desc: The color of the Field you are on, while the line is marked
  - tip: Colors the Field you are on, the one the up and down keys change. In <code>#todo [-Due] -Imp</code> that is <code>[-Due]</code> ⏎ - <b>Empty</b> — it uses <code>Inactive Field text color</code> and is easy to miss on a line with many Fields ⏎ - <b>A color</b> — it stands out at a glance
  - старые названия для поиска: «Current Field color»
- **Chosen Value text color** — `panel-chosen-color`, `color`, path `visual.tagWheel.chosenValueColor`, default `""`
  - desc: The color of a Field that already carries a Value, while the line is marked
  - tip: Colors Fields that already have a Value, so you see at a glance what is filled in. In <code>#todo [-Due] -Imp</code> that is <code>#todo</code> ⏎ - <b>Empty</b> — they use <code>Inactive Field text color</code> ⏎ - <b>A color</b> — <code>#todo</code> takes that color, <code>-Imp</code> does not ⏎ The Field you are on has its own row above
  - старые названия для поиска: «Chosen value color», «Picked value color»
- **Background color** — `panel-background`, `color`, path `visual.tagWheel.fillColor`, default `""`
  - desc: The color behind the picker, while the line is marked
  - tip: The color behind the picker line while it is open ⏎ - <b>Empty</b> — Obsidian’s own highlight color ⏎ - <b>A color</b> — that color. Pick one solid enough to read on ⏎ Needs <code>Highlight the tagWheel line</code> on
  - старые названия для поиска: «Background»
- **`scroller-sub`** — свой блок, рендерер `?`
- **Scroller** — `scroller-enabled`, `toggle`, path `visual.tagWheel.scroller.enabled`, default `false`
  - desc: Show the next and previous Values around the current one
  - tip: - <b>On</b> — a box next to the Field you are on lists the Values that come next, so long lists are quicker to go through ⏎ - <b>Off</b> — you see only the current Value and step through blindly
  - старые названия для поиска: «tagWheel Scroller»
- **Scroller opening direction** — `scroller-direction`, `dropdown`, path `visual.tagWheel.scroller.direction`, default `full`
  - desc: Which way the Values unroll from the Field you are on
  - tip: - <b>Up</b> — one box above your line, with the Values the up key brings next. Your note below stays in view ⏎ - <b>Down</b> — one box below your line, with the Values the down key brings next ⏎ - <b>Both</b> — a box above and a box below, so the current Value sits in the middle. Easiest to read when a Field has many Values
  - варианты: `up` Up · `down` Down · `full` Both
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller direction», «Opens»
- **Scroller Value names** — `scroller-labels`, `dropdown`, path `visual.tagWheel.scroller.labels`, default `value`
  - desc: What the box shows for each neighboring Value
  - tip: What the box shows for each Value. Example: <code>#idea</code> with the custom text <code>💡</code> under Fields (<code>Show</code> = <code>custom</code>) ⏎ - <b>Default</b> — <code>#idea</code> ⏎ - <b>Custom</b> — <code>💡</code> ⏎ - <b>Custom + default</b> — <code>💡#idea</code> ⏎ A Value without custom text always shows as written
  - варианты: `value` Default · `custom` Custom · `both` Custom + default
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller names», «Custom text in the scroller», «Printed name», «As written», «Custom text when set»
- **Scroller background color** — `scroller-fill`, `color`, path `visual.tagWheel.scroller.fillColor`, default `""`
  - desc: The color behind the box of neighboring Values
  - tip: - <b>Empty</b> — the box uses your theme’s popup color ⏎ - <b>A color</b> — the box gets that color, for example to stand out on a pale theme. Without its own text color the text turns black or white so you can read it
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller background»
- **Scroller text color** — `scroller-text`, `color`, path `visual.tagWheel.scroller.textColor`, default `""`
  - desc: The color of the Values you are not on, inside the box
  - tip: Colors the Values listed in the box ⏎ - <b>Empty</b> — your theme’s text color, or black or white on your own <code>Scroller background color</code> ⏎ - <b>A color</b> — the Values in the box take that color ⏎ The Value you are on is not in the box. It shows in the line, colored by <code>Active Field text color</code>
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller text»
- **Scroller size** — `scroller-size`, `slider`, path `visual.tagWheel.scroller.size`, default `3`
  - desc: How many neighboring Values stay visible around the current one
  - tip: How many Values the box shows on each side of the current one, not in total ⏎ - <b>1</b> — one Value above and one below, with <code>Both</code> ⏎ - <b>3</b> — up to three above and three below ⏎ - <b>20</b> — every Value of a short Field at once
  - диапазон: 1–20, шаг 1
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Values per side»

#### Text cursor — `text-cursor` (вкладка `visual`)

_Intro:_ The blinking line that shows where your typing goes. Give it its own color so it stops getting lost on the page

_Tip:_ By default the cursor is the same color as your text, so in long notes or one-color themes it is easy to lose. Pick a color you use nowhere else and it stands out at a glance. This changes the cursor in your notes only. This window and the search box keep their usual cursor

- **Color the text cursor** — `caret-enabled`, `toggle`, path `visual.caret.enabled`, default `false`
  - desc: Draw the blinking caret in a color you pick instead of the color of your text
  - tip: - <b>On</b> — the blinking cursor in your notes takes the color you pick below, for example bright orange ⏎ - <b>Off</b> — your theme decides the cursor color ⏎ This window and the search box keep their usual cursor
  - старые названия для поиска: «Caret color», «Cursor color»
- **Cursor color** — `caret-color`, `color`, path `visual.caret.color`, default `""`
  - desc: The color of the blinking caret in your notes
  - tip: - <b>Empty</b> — the cursor keeps your theme’s color ⏎ - <b>A color</b> — the cursor takes it. Pick a color your page does not already use, and it stands out at a glance
  - видна если: `visual.caret.enabled`
  - старые названия для поиска: «Caret»
- **Shape the text cursor** — `caret-shape`, `toggle`, path `visual.caret.shapeEnabled`, default `false`
  - desc: Set how thick the caret is and how fast it blinks, instead of taking both from your theme
  - tip: Works apart from the color, so you can use either one alone ⏎ - <b>On</b> — the cursor uses <code>Cursor width</code> and <code>Blink speed</code> below ⏎ - <b>Off</b> — the cursor keeps the thickness and blinking your theme and Obsidian give it
  - старые названия для поиска: «Caret width», «Cursor blink», «Caret thickness»
- **Cursor width** — `caret-width`, `slider`, path `visual.caret.width`, default `2`
  - desc: How thick the caret is drawn, in pixels
  - tip: Obsidian’s cursor is about one pixel wide and easy to miss on a bright background or a large screen ⏎ - <b>1</b> — a thin line, like Obsidian’s own ⏎ - <b>2</b> or <b>3</b> — easy to find and still not like a selection ⏎ - <b>8</b> — a thick line
  - диапазон: 1–8, шаг 1, ед. px
  - видна если: `visual.caret.shapeEnabled`
  - старые названия для поиска: «Caret thickness»
- **Blink speed** — `caret-blink`, `slider`, path `visual.caret.blinkSpeed`, default `5`
  - desc: How fast the caret blinks, from not blinking at all to very fast
  - tip: - <b>0</b> — the cursor does not blink. The calmest setting ⏎ - <b>1</b> — a slow blink, once every 2 seconds ⏎ - <b>5</b> — Obsidian’s usual speed, once every 1.2 seconds ⏎ - <b>10</b> — a fast blink, five times a second
  - диапазон: 0–10, шаг 1
  - видна если: `visual.caret.shapeEnabled`
  - старые названия для поиска: «Blink rate», «Cursor blinking»
- **`caret-preview`** — свой блок, рендерер `renderCaretPreview`

#### Cursor jump highlight — `jump-highlight` (вкладка `visual`)

_Intro:_ After a jump, the cursor is hard to find again. This shows a circle where it lands, and the circle shrinks away by itself

_Tip:_ The circle only appears on screen for a moment. Nothing is written into your note. It shows only on jumps, not when you type or use the arrow keys. The last row decides whether short hops within one line count as jumps too

- **Highlight where you land** — `jump-flash`, `toggle`, path `visual.jumpFlash.enabled`, default `false`
  - desc: Draw a fading circle where the cursor lands, so you do not hunt for it
  - tip: - <b>On</b> — after a jump like <code>Jump down</code>, a colored circle appears on the cursor and shrinks away ⏎ - <b>Off</b> — no circle ⏎ Typing and the arrow keys never show it. Nothing is written into your note
  - старые названия для поиска: «Flash on jump», «Highlight the jump target», «Show me where the cursor went»
- **Highlight color** — `jump-flash-color`, `color`, path `visual.jumpFlash.color`, default `""`
  - desc: Leave it unset to use the accent color of your theme
  - tip: - <b>Unset</b> — the circle takes your theme’s accent color and matches the editor ⏎ - <b>A color</b> — the circle takes that color. Useful when the accent color is too faint on your background
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Color of the jump circle»
- **Highlight size** — `jump-flash-radius`, `slider`, path `visual.jumpFlash.radius`, default `18`
  - desc: How wide the circle is at the moment it appears
  - tip: How big the circle is when it appears. The number is the distance from the cursor to its edge ⏎ - <b>6</b> — a small dot, not much easier to spot than the cursor ⏎ - <b>18</b> — a circle about 36 pixels across ⏎ - <b>40</b> — a big circle that covers the words around until it fades
  - диапазон: 6–40, шаг 1, ед. px
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Size of the jump circle»
- **How long it lasts** — `jump-flash-fade`, `slider`, path `visual.jumpFlash.fadeMs`, default `450`
  - desc: The time the circle takes to shrink and disappear
  - tip: - <b>100</b> — a quick flash that just catches the corner of your eye ⏎ - <b>450</b> — the circle shrinks away in about half a second ⏎ - <b>1500</b> — a slow fade that gets annoying when you jump several times in a row ⏎ To skip circles while you jump quickly, use the row below
  - диапазон: 100–1500, шаг 50, ед. ms
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Fade speed of the jump circle»
- **Minimum time between jumps** — `jump-flash-delay`, `slider`, path `visual.jumpFlash.quietMs`, default `0`
  - desc: Jumps closer together than this get no circle at all
  - tip: Waits this long after a jump before the circle shows. A new jump in that time cancels it, so only the jump you stop on gets a circle ⏎ - <b>0</b> — every jump gets a circle at once, even when you hold a key down ⏎ - <b>300</b> — the circle shows 0.3 seconds after your last jump
  - диапазон: 0–1000, шаг 50, ед. ms
  - видна если: `visual.jumpFlash.enabled`
  - старые названия для поиска: «Do not flash on every jump», «Quiet time»
- **Use inside current line** — `jump-flash-inline`, `toggle`, path `visual.jumpFlash.inLine`, default `false`
  - desc: Also mark the cursor when it hops between the parts of one line
  - tip: <code>Jump left</code> and <code>Jump right</code> move the cursor a short way along one line ⏎ - <b>On</b> — those short hops show a circle too. Helps if you lose the cursor on long lines ⏎ - <b>Off</b> — short hops show no circle, since the cursor usually stays where you are looking
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
