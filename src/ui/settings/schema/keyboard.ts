/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Тексты согласованы заказчиком и совпадают с Приложением B PRD.
 */

import type { SettingsGroup } from "../types.ts";
import { on, not, eq, neither } from "../types.ts";
import { binderTable } from "../custom/binder.ts";
import { callout } from "../custom/callouts.ts";
import { commandReference } from "../custom/command_reference.ts";
import { selectAllCustom } from "../custom/select_all_custom.ts";
import { subheader } from "../custom/subheader.ts";

export const KEYBOARD_GROUPS: readonly SettingsGroup[] = [
{ id: "keyboard-intro",  tab: "keyboard",   order: 50, heading: "Before you start",
  items: [
    { kind:"custom", id:"keyboard-callout", render: callout("keyboard") }
  ],
  visible: on("general.help.showCallouts") },
{
  id: "global-hotkeys", tab: "keyboard", order: 100, heading: "Global hotkeys",
  intro: "Four keys Obsidian already gives you — <code>Ctrl/Cmd + A</code>, <code>Del</code> with <code>Backspace</code>, <code>Enter</code> and <code>Ctrl/Cmd + V</code> — taught to do the obvious thing inside a line of yours",
  tip: "Nothing here rebinds a key: all four stay Obsidian’s own, and each setting changes what happens in one case and leaves the rest alone. That is also why every one of them starts switched off — a key that belongs to the editor should not change its mind without being asked. The sections below are independent: switch on the one you want and the others stay as they were",
  items: [
    { kind:"custom", id:"select-all-sub", render: subheader("Expanded 'Ctrl+A' ('⌘+A')",
        "<code>Ctrl/Cmd + A</code> selects the whole note in one go. This setting changes how it works: the first press takes the word or the line you are on, and every further press widens the selection. Obsidian gives that key one step: the whole note. Here it becomes a ladder — the word under the cursor, the line you are on, then more of the note with each press — so you can grab one word, one task, or a task with everything indented under it, without reaching for the mouse. The settings below decide which rungs the ladder has, whether pausing between presses sends you back to the bottom, and whether one press past the top lets the selection go. Pick <code>Custom</code> in the list of steps and you choose the rungs yourself, one tick each. The key itself is Obsidian’s, and nothing here rebinds it") },
    { kind:"toggle", id:"select-all-enabled", path:"editor.selectAll.enabled", default:false,
      name:"Expanded 'Ctrl+A'", desc:"Change what <code>Ctrl/Cmd + A</code> does: take the line first, then widen",
      searchTerms:["Enhanced Mod+A","Expanded select all"],
      tip:"On a task list the first press takes just the task you are on, the second the task and its tree, and the last the whole note. Press <code>Ctrl/Cmd + A</code> once more with the last option below on, and the cursor goes back where it started" },
    { kind:"dropdown", id:"select-all-steps", path:"editor.selectAll.mode", default:"line-note",
      name:"Selection steps", desc:"How much more gets picked up on each press",
      searchTerms:["Select-all mode"], disabled: not("editor.selectAll.enabled"),
      options:[
        { value:"line-note", label:"Line, then note" },
        { value:"line-tree-note", label:"Line, tree, then note" },
        { value:"line-tree-header-note", label:"Line, tree, heading, then note" },
        { value:"word-line-tree-header-note", label:"Word, line, tree, heading, then note" },
        { value:"custom", label:"Custom" }
      ],
      tip:"<b>Word</b> is the word nearest the cursor, so the first press takes one word instead of the whole line. <b>Tree</b> means the line plus everything indented under it. <b>Heading</b> means everything under the nearest heading. <b>Custom</b> opens the list of all five steps below and cycles through the ones you tick, in the order they are shown. Pick the shortest sequence you actually use — every extra step is one more press before you reach the whole note" },
    { kind:"note", id:"select-all-custom-head",
      name:"Steps to cycle through", desc:"Which of the five a press stops at",
      tip:"The order is fixed — word, line, tree, heading, note — and the ticks decide which of them a press stops at. Tick <b>word</b>, <b>line</b> and <b>note</b>, and the key goes from the word under the cursor to the whole line to the whole note, skipping the two in between. Tick nothing and the key stays Obsidian’s own: one press, the whole note",
      visible: eq("editor.selectAll.mode","custom") },
    { kind:"custom", id:"select-all-custom", render: selectAllCustom,
      visible: eq("editor.selectAll.mode","custom") },
    { kind:"toggle", id:"select-all-timer", path:"editor.selectAll.useDelay", default:false,
      name:"Count presses by timer", desc:"Decide the next step by how quickly you press, rather than by what is selected",
      searchTerms:["Use multi-press delay"], disabled: not("editor.selectAll.enabled"),
      tip:"Off is the forgiving setting: pause as long as you like, and the next press still widens the selection. On, pausing longer than the time below means you start again from the line \u2014 handy if you often select something, walk away, and come back" },
    { kind:"slider", id:"select-all-delay", path:"editor.selectAll.delayMs", default:700,
      min:250, max:2000, step:50, unit:"ms",
      name:"Time between presses", desc:"How long you can pause and still be in the middle of a sequence",
      tip:"Only used when the timer above is on. Around three quarters of a second suits most people; raise it if you keep losing your place",
      searchTerms:["Multi-press delay"],
      visible: on("editor.selectAll.useDelay"), disabled: not("editor.selectAll.enabled") },
    { kind:"toggle", id:"select-all-clear", path:"editor.selectAll.clearOnLast", default:false,
      name:"Last press clears highlighting", desc:"After the last step, pressing again drops the selection and returns the cursor",
      tip:"Lets you get out of a selection with the same key you got into it, instead of clicking somewhere to deselect",
      searchTerms:["Last press clears selection", "One more press clears it"], disabled: not("editor.selectAll.enabled") },
    { kind:"custom", id:"smart-delete-sub", render: subheader("Smart Delete\\Backspace",
        "<code>Del</code> at the end of a line, and <code>Backspace</code> at the start of one, pull two lines together. This makes them bring the words and leave the indent and the bullet behind. Press <code>Del</code> with the cursor at the end of a line and Obsidian joins the line below to it exactly as that line is written: its indent, its bullet, its checkbox and all. What you wanted was the words, so you press <code>Del</code> another six times to clear the rest out of the way. With this on, the first press does that for you: the indent and the Prefix of the arriving line go, and its text lands right after your cursor. <code>Backspace</code> at the start of a line is the same thing from the other side, and it has a switch of its own: you can have either key doing this, or both. A line with nothing but a Prefix on it disappears whole, so a run of empty bullets clears one press at a time. Standing on an empty line the key stays Obsidian’s own: there is nothing to join the words to, so the line below arrives exactly as it is written, its indent and its marker included. Everywhere else the two keys are untouched: in the middle of a line, or with something selected, they delete one character the way they always did") },
    { kind:"toggle", id:"smart-delete-enabled", path:"editor.smartDelete.enabled", default:false,
      name:"Smart Delete", desc:"Let <code>Del</code> at the end of a line bring up the words without the indent and the Prefix",
      searchTerms:["Smart Del","Delete the junk"],
      tip:"Nothing here rebinds the key: <code>Del</code> stays Obsidian’s, and this only changes what happens in the one case where it joins two lines. Off, the key behaves as it always has. <code>Smart Backspace</code> below is a switch of its own and does not need this one" },
    { kind:"toggle", id:"smart-delete-backspace", path:"editor.smartDelete.onBackspace", default:false,
      name:"Smart Backspace", desc:"Let <code>Backspace</code> at the start of a line send it up without its own indent and Prefix",
      searchTerms:["Smart Backspace","Do the same on Backspace"],
      tip:"The same thing from the other side, and it stands on its own: <code>Smart Delete</code> above can stay off and this still works. <code>Backspace</code> at the start of a line joins it to the line above, and by default it takes the indent and the bullet along. On, they stay behind and only the words go up. A line with nothing on it disappears, which is the quickest way to close a gap" },
    { kind:"toggle", id:"smart-delete-prefix", path:"editor.smartDelete.dropPrefix", default:true,
      name:"Drop the line Prefix", desc:"Take the bullet, checkbox, number or quote mark off the arriving line, not only its indent",
      searchTerms:["Drop the bullet"], disabled: neither("editor.smartDelete.enabled", "editor.smartDelete.onBackspace"),
      tip:"On, <code>- [ ] read the docs</code> arrives as <code>read the docs</code>. Off, only the indent goes and the line keeps its Prefix, which is what you want when the two lines are meant to stay two list items. This one answers to both keys above" },
    { kind:"toggle", id:"smart-delete-space", path:"editor.smartDelete.joinWithSpace", default:true,
      name:"Join with a space", desc:"Put one space between your text and the text that arrives, so the two do not run together",
      searchTerms:["Add a space"], disabled: neither("editor.smartDelete.enabled", "editor.smartDelete.onBackspace"),
      tip:"Only when both sides have something on them and your line does not already end in a space. Off, the two pieces of text meet with nothing between them, which is what you want when you are joining a word that got split. This one answers to both keys above" },
    { kind:"custom", id:"smart-enter-sub", render: subheader("Smart Enter",
        "<code>Enter</code> in the middle of one of your lines splits it in two. This makes it start a new line below instead, and leave the line you are on alone. A line carrying Fields is a record, not a paragraph: split it in half and the Block after your text is torn away from the Block before it, and neither half is a record any more. With this on, <code>Enter</code> adds an empty line underneath and leaves the one you are on exactly as it was. <code>Where it works</code> decides how much of the line counts: all of it, or your own text only. In every line that carries no Separator of yours the key stays Obsidian’s own and behaves as it always has") },
    { kind:"toggle", id:"smart-enter-enabled", path:"editor.smartEnter.enabled", default:false,
      name:"Smart Enter", desc:"Let <code>Enter</code> add a line instead of splitting the one you are on",
      searchTerms:["Smart Enter","Do not split the line"],
      tip:"Nothing here rebinds the key: <code>Enter</code> stays Obsidian’s, and this only changes what happens inside a line of yours. Off, the key behaves as it always has" },
    { kind:"dropdown", id:"smart-enter-scope", path:"editor.smartEnter.scope", default:"line",
      name:"Where it works", desc:"How much of the line the key treats as one record",
      searchTerms:["Smart Enter scope","Only in your text"],
      disabled: not("editor.smartEnter.enabled"),
      options:[ {value:"line",label:"Anywhere in the line"},
                {value:"text",label:"Only in your text"} ],
      tip:"<b>Anywhere in the line</b> keeps the whole line together: wherever the cursor stands — in a Block, on a Separator or in your text — the key adds a line below. <b>Only in your text</b> narrows it to the text slot, the part between your Separators, so <code>Enter</code> inside a Block goes back to being Obsidian’s own. If a line carries only one Separator, the text slot is whatever lies after the first or before the second" },
    { kind:"dropdown", id:"smart-enter-prefix", path:"editor.smartEnter.newLinePrefix", default:"same",
      name:"Prefix on the new line", desc:"What the line <code>Smart Enter</code> adds starts with",
      searchTerms:["Keep the bullet","New line Prefix","Carry the Prefix over"],
      disabled: not("editor.smartEnter.enabled"),
      options:[ {value:"same",label:"Same as the line above"},
                {value:"none",label:"None"},
                {value:"number-only",label:"None, unless the line is numbered"} ],
      tip:"<b>Same as the line above</b> repeats the marker exactly as Obsidian does it on its own: a bullet stays a bullet, a numbered item gets the next number, and a checkbox arrives empty, because a line you have not written yet is not a task you have done. <b>None</b> starts the new line bare. <b>None, unless the line is numbered</b> does the same but keeps the count going, so a numbered list does not lose its place — a checkbox still goes. The indent is kept by all three: a line three levels deep has no business jumping to the left margin" },
    { kind:"custom", id:"smart-paste-sub", render: subheader("Smart paste",
        "Paste a numbered list you cut from somewhere else and it arrives carrying the numbers it had there: a list that started at nine goes on starting at nine. With this on, a pasted list is counted from one, and pasting it right under a list you already have carries that list's count on instead. The other half is the single item: paste <code>1. text</code> into a line that already starts with a number and you get <code>2. 1. text</code>, two markers in a row. With this on the pasted marker is dropped and only the text lands. Everything else you paste — plain text, a link, a table — arrives exactly as it always did") },
    { kind:"toggle", id:"smart-paste-enabled", path:"editor.smartPaste.enabled", default:false,
      name:"Smart paste", desc:"Count a pasted numbered list from one, and drop a pasted marker where the line has one",
      searchTerms:["Smart insert","Paste a numbered list","Renumber on paste"],
      tip:"Nothing here rebinds the key: <code>Ctrl/Cmd + V</code> stays Obsidian’s, and this only changes what arrives when what you paste is a numbered list or a list item. Off, the key behaves as it always has. A paste that neither starts a numbered list nor lands on a line with a marker is not touched at all, whatever this is set to" }
  ]
},
{
  id: "binder", tab: "keyboard", order: 200, heading: "Binder (custom insert commands)",
  intro: "For text you type over and over. Put it in a row here, give that row a key, and one press drops it in wherever your cursor is",
  tip: "Binder turns a snippet into a command of its own. Add a row, type the text you want dropped in, and the plugin registers a command for that row; give the command a key in <code>Settings \u2192 Hotkeys</code>, and from then on one press inserts the text wherever the cursor is. An arrow, a callout opener, a signature, a table skeleton \u2014 anything you retype often is worth a row. The <code>Hotkey</code> column shows the key a row has now, and clicking it takes you to Obsidian\u2019s list to change it. Afterwards you change only the description \u2014 to change the text a row inserts, delete the row and add it again, because the command is created from the row and disappears with it",
  items: [
    { kind:"custom", id:"binder-table", render: binderTable }
  ]
},
{
  id: "command-reference", tab: "keyboard", order: 300, heading: "Commands & Hotkeys",
  intro: "Everything this plugin can do, in one list. None of it has a key until you give it one \u2014 click in the <code>Hotkey</code> column to do that",
  tip: "One row per command this build actually registers, so the list answers two questions at once: what the plugin can do, and which of it you have already put on a key. The <code>Hotkey</code> column is the only thing you set here \u2014 click a cell and Obsidian\u2019s own hotkey screen opens on that command. Rows appear and disappear with your setup: every Field adds a pair of cycle commands, every Binder row adds one, and turning a module off takes its commands away. In Obsidian\u2019s own hotkey list these all appear under <b>inlineOverhaul</b>, so typing that in its search box brings up the whole set at once. tagWheel is the exception: once it is open you steer it with the arrow keys, so it needs only the one command that opens it",
  items: [
    { kind:"custom", id:"command-list", render: commandReference }
  ]
}
];
