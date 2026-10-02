/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Тексты согласованы заказчиком и совпадают с Приложением B PRD.
 */

import type { SettingsGroup } from "../types.ts";
import { on, not, eq, either, both } from "../types.ts";
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
  intro: "Four keys you already use — <code>Ctrl/Cmd + A</code>, <code>Del</code> and <code>Backspace</code>, <code>Enter</code> and <code>Ctrl/Cmd + V</code> — can do the obvious thing inside your lines",
  tip: "None of this rebinds a key. Each setting changes what a key does in one case only. All of them start off, and each section works on its own, so turn on only the ones you want",
  items: [
    { kind:"custom", id:"select-all-sub", render: subheader("Smart SelectAll (Ctrl+A)",
        "Normally <code>Ctrl/Cmd + A</code> selects the whole note at once. Here each press selects a bit more: the word, then the line, then a task with everything under it, then the whole note. The settings below choose the steps, whether a pause starts you over, and whether one more press drops the selection") },
    { kind:"toggle", id:"select-all-enabled", path:"editor.selectAll.enabled", default:false,
      name:"Smart Ctrl+A", desc:"Change what <code>Ctrl/Cmd + A</code> does: take the line first, then widen",
      searchTerms:["Enhanced Mod+A","Expanded select all","Expanded 'Ctrl+A'"],
      tip:"With the default steps, the first press takes the line and the second takes the whole note. Want more stops, like a task with its subtasks? Choose them in <b>Selection steps</b> below. If the last option below is on, one more press puts the cursor back where it was" },
    { kind:"dropdown", id:"select-all-steps", path:"editor.selectAll.mode", default:"line-note",
      name:"Selection steps", desc:"How much more gets picked up on each press",
      searchTerms:["Select-all mode"], visible: on("editor.selectAll.enabled"),
      options:[
        { value:"line-note", label:"Line, note" },
        { value:"line-tree-note", label:"Line, tree, note" },
        { value:"line-tree-header-note", label:"Line, tree, heading, note" },
        { value:"word-line-tree-header-note", label:"Word, line, tree, heading, note" },
        { value:"custom", label:"Custom" }
      ],
      tip:"<b>Word</b>: the word at the cursor. <b>Tree</b>: the line plus everything indented under it. <b>Heading</b>: everything under the nearest heading. <b>Custom</b>: tick your own steps below. Pick as few steps as you need, because each extra step is one more press" },
    { kind:"note", id:"select-all-custom-head",
      name:"Steps to cycle through", desc:"Which of the five a press stops at",
      tip:"The order never changes: word, line, tree, heading, note. Your ticks choose where a press stops. For example, tick <b>word</b>, <b>line</b> and <b>note</b> to skip the other two. Tick nothing and the key works as usual: one press selects the whole note",
      visible: eq("editor.selectAll.mode","custom") },
    { kind:"custom", id:"select-all-custom", render: selectAllCustom,
      visible: eq("editor.selectAll.mode","custom") },
    { kind:"toggle", id:"select-all-timer", path:"editor.selectAll.useDelay", default:false,
      name:"Count presses by timer", desc:"Decide the next step by how quickly you press, rather than by what is selected",
      searchTerms:["Use multi-press delay"], visible: on("editor.selectAll.enabled"),
      tip:"<b>Off</b>: pause as long as you like and the next press still selects more. <b>On</b>: if you pause longer than the time below, you start over from the line. Not sure? Leave it off" },
    { kind:"slider", id:"select-all-delay", path:"editor.selectAll.delayMs", default:700,
      min:250, max:2000, step:50, unit:"ms",
      name:"Time between presses", desc:"How long you can pause and still be in the middle of a sequence",
      tip:"Only used when the timer above is on. About three quarters of a second suits most people. Raise it if you keep starting over",
      searchTerms:["Multi-press delay"],
      visible: both(on("editor.selectAll.enabled"), on("editor.selectAll.useDelay")) },
    { kind:"toggle", id:"select-all-clear", path:"editor.selectAll.clearOnLast", default:false,
      name:"Last press clears highlighting", desc:"After the last step, pressing again drops the selection and returns the cursor",
      tip:"Get out of a selection with the same key you used to make it, so you don't have to click somewhere else",
      searchTerms:["Last press clears selection", "One more press clears it"], visible: on("editor.selectAll.enabled") },
    { kind:"custom", id:"smart-delete-sub", render: subheader("Smart Delete\\Backspace",
        "Normally <code>Del</code> at the end of a line pulls up the next line with its indent, bullet and checkbox, and you have to delete them by hand. With this on, only the words come up. <code>Backspace</code> at the start of a line has its own switch. An empty bullet disappears in one press. In the middle of a line, or when text is selected, both keys work as usual") },
    { kind:"toggle", id:"smart-delete-enabled", path:"editor.smartDelete.enabled", default:false,
      name:"Smart Delete", desc:"Let <code>Del</code> at the end of a line bring up the words without the indent and the Prefix",
      searchTerms:["Smart Del","Delete the junk"],
      tip:"When it's off, <code>Del</code> works as it always has. <code>Smart Backspace</code> below has its own switch and works without this one" },
    { kind:"toggle", id:"smart-delete-backspace", path:"editor.smartDelete.onBackspace", default:false,
      name:"Smart Backspace", desc:"Let <code>Backspace</code> at the start of a line send it up without its own indent and Prefix",
      searchTerms:["Smart Backspace","Do the same on Backspace"],
      tip:"This works even if <code>Smart Delete</code> is off. Normally the line goes up with its indent and bullet. With this on, only the words go up. An empty line just disappears, which is the quickest way to close a gap" },
    { kind:"toggle", id:"smart-delete-prefix", path:"editor.smartDelete.dropPrefix", default:true,
      name:"Drop the line Prefix", desc:"Take the bullet, checkbox, number or quote mark off the arriving line, not only its indent",
      searchTerms:["Drop the bullet"], visible: either("editor.smartDelete.enabled", "editor.smartDelete.onBackspace"),
      tip:"<b>On</b>: <code>- [ ] read the docs</code> comes up as <code>read the docs</code>. <b>Off</b>: only the indent goes, so leave it off if both lines should stay list items. Works for both keys above" },
    { kind:"toggle", id:"smart-delete-space", path:"editor.smartDelete.joinWithSpace", default:true,
      name:"Join with a space", desc:"Put one space between your text and the text that arrives, so the two do not run together",
      searchTerms:["Add a space"], visible: either("editor.smartDelete.enabled", "editor.smartDelete.onBackspace"),
      tip:"No space is added if your line already ends with one. <b>Off</b>: the two texts join with nothing between them, which is handy for putting a split word back together. Works for both keys above" },
    { kind:"custom", id:"smart-enter-sub", render: subheader("Smart Enter",
        "Normally <code>Enter</code> in the middle of a line cuts it in two, and the tags and dates end up split between two lines. With Smart Enter, <code>Enter</code> starts a new line below and leaves yours untouched. In code, tables and empty list items <code>Enter</code> works as usual") },
    { kind:"toggle", id:"smart-enter-enabled", path:"editor.smartEnter.enabled", default:false,
      name:"Smart Enter", desc:"Let <code>Enter</code> add a line instead of splitting the one you are on",
      searchTerms:["Smart Enter","Do not split the line"],
      tip:"This doesn't rebind <code>Enter</code>. It only changes what happens inside your lines. When it's off, the key works as it always has" },
    { kind:"dropdown", id:"smart-enter-scope", path:"editor.smartEnter.scope", default:"line",
      name:"Where it works", desc:"How much of the line the key treats as one record",
      searchTerms:["Smart Enter scope","Only in your text"],
      visible: on("editor.smartEnter.enabled"),
      options:[ {value:"line",label:"Whole line"},
                {value:"text",label:"Text only"} ],
      tip:"<b>Whole line</b>: wherever the cursor is, <code>Enter</code> adds a line below. <b>Text only</b>: only in your text between the Separators; among the tags <code>Enter</code> works as usual. Not sure — keep <b>Whole line</b>" },
    { kind:"dropdown", id:"smart-enter-prefix", path:"editor.smartEnter.newLinePrefix", default:"same",
      name:"Prefix on the new line", desc:"What the line <code>Smart Enter</code> adds starts with",
      searchTerms:["Keep the bullet","New line Prefix","Carry the Prefix over"],
      visible: on("editor.smartEnter.enabled"),
      options:[ {value:"same",label:"Same as above"},
                {value:"none",label:"None"},
                {value:"number-only",label:"Numbered lines only"} ],
      tip:"<b>Same as above</b>: works like Obsidian, so a bullet stays a bullet, a number goes up by one and a checkbox comes empty. <b>None</b>: the new line starts bare. <b>Numbered lines only</b>: bare too, but numbered lists keep counting. All three keep the indent" },
    { kind:"toggle", id:"smart-enter-use-shift", path:"editor.smartEnter.useShift", default:false,
      name:"Use Shift+Enter instead", desc:"Make <code>Shift+Enter</code> the Smart Enter key and leave <code>Enter</code> as usual",
      searchTerms:["Shift+Enter","Smart Enter key"],
      visible: on("editor.smartEnter.enabled"),
      tip:"<b>On</b>: <code>Enter</code> splits the line as usual and <code>Shift+Enter</code> adds a line below. <b>Off</b>: it's the other way round" },
    { kind:"toggle", id:"smart-enter-shift", path:"editor.smartEnter.shiftPlainEnter", default:false,
      name:"Shift+Enter as usual Enter", desc:"Let <code>Shift+Enter</code> split the line the way <code>Enter</code> does without <code>Smart Enter</code>",
      searchTerms:["Shift+Enter","Plain Enter"],
      visible: both(on("editor.smartEnter.enabled"), not("editor.smartEnter.useShift")),
      tip:"<b>On</b>: <code>Shift+Enter</code> works like Obsidian's normal <code>Enter</code>. It splits the line at the cursor and continues the list. <b>Off</b>: <code>Shift+Enter</code> works as it always did" },
    { kind:"custom", id:"smart-paste-sub", render: subheader("Smart Paste (Ctrl+V)",
        "Normally a pasted numbered list keeps its old numbers, and pasting <code>1. text</code> onto a numbered line gives <code>2. 1. text</code>. With this on, a pasted list starts from one, or keeps counting if you paste it right under a list. A doubled number is dropped. Anything else you paste comes in as usual") },
    { kind:"toggle", id:"smart-paste-enabled", path:"editor.smartPaste.enabled", default:false,
      name:"Smart paste", desc:"Count a pasted numbered list from one, and drop a pasted marker where the line has one",
      searchTerms:["Smart insert","Paste a numbered list","Renumber on paste"],
      tip:"This doesn't rebind <code>Ctrl/Cmd + V</code>. It only changes pasted numbered lists and list items. Plain text, links and everything else paste as usual, whether this is on or off" }
  ]
},
{
  id: "binder", tab: "keyboard", order: 200, heading: "Binder (custom insert commands)",
  intro: "For text you type over and over. Put it in a row here, give that row a key, and one press drops it in wherever your cursor is",
  tip: "Each Binder row becomes a command. Type your text, then give it a key in <code>Settings → Hotkeys</code>, or click the <code>Hotkey</code> column to get there. Good for arrows, callouts, signatures and table templates. You can't change a row's text later. Delete the row and add it again, and know that deleting a row also deletes its command",
  items: [
    { kind:"custom", id:"binder-table", render: binderTable }
  ]
},
{
  id: "command-reference", tab: "keyboard", order: 300, heading: "Commands & Hotkeys",
  intro: "Everything this plugin can do, in one list. None of it has a key until you give it one \u2014 click in the <code>Hotkey</code> column to do that",
  tip: "Shows every command and which ones already have a key. Click a <code>Hotkey</code> cell to set the key in Obsidian's hotkey screen. The list changes with your setup: each Field and each Binder row adds commands, and turning a module off removes them. To see them all in Obsidian's hotkey list, search for <b>inlineOverhaul</b>",
  items: [
    { kind:"custom", id:"command-list", render: commandReference }
  ]
}
];
