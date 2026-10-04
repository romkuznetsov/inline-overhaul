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
      tip:"- <b>On</b> — the first press selects the line <code>- call Anna #todo</code>, the next press the whole note\n- <b>Off</b> — one press selects the whole note, as in Obsidian\nWant more stops, like a task with its subtasks? Pick them in <b>Selection steps</b> below" },
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
      tip:"Each press selects the next step. Say the cursor is on <code>milk</code> in a subtask of <code>- shopping</code>\n- <b>Line, note</b> — the line, then the whole note\n- <b>Line, tree, note</b> — the line, then <code>- shopping</code> with all its subtasks, then the note\n- <b>Line, tree, heading, note</b> — adds everything under the heading above before the note\n- <b>Word, line, tree, heading, note</b> — starts with just <code>milk</code>\n- <b>Custom</b> — tick your own steps below" },
    { kind:"note", id:"select-all-custom-head",
      name:"Steps to cycle through", desc:"Which of the five a press stops at",
      tip:"The order never changes: word, line, tree, heading, note. Your ticks choose where a press stops. For example, tick <b>word</b>, <b>line</b> and <b>note</b> to skip the other two. Tick nothing and the key works as usual: one press selects the whole note",
      visible: eq("editor.selectAll.mode","custom") },
    { kind:"custom", id:"select-all-custom", render: selectAllCustom,
      visible: eq("editor.selectAll.mode","custom") },
    { kind:"toggle", id:"select-all-timer", path:"editor.selectAll.useDelay", default:false,
      name:"Count presses by timer", desc:"Decide the next step by how quickly you press, rather than by what is selected",
      searchTerms:["Use multi-press delay"], visible: on("editor.selectAll.enabled"),
      tip:"- <b>Off</b> — pause as long as you like and the next press still selects more\n- <b>On</b> — pause longer than the time below and the next press starts over from the first step\nNot sure? Leave it off" },
    { kind:"slider", id:"select-all-delay", path:"editor.selectAll.delayMs", default:700,
      min:250, max:2000, step:50, unit:"ms",
      name:"Time between presses", desc:"How long you can pause and still be in the middle of a sequence",
      tip:"Only used when <b>Count presses by timer</b> is on. Raise it if you keep starting over\n- <b>700 ms</b> — the default, suits most people\n- <b>1200 ms</b> — for a slower hand: you may pause over a second between presses",
      searchTerms:["Multi-press delay"],
      visible: both(on("editor.selectAll.enabled"), on("editor.selectAll.useDelay")) },
    { kind:"toggle", id:"select-all-clear", path:"editor.selectAll.clearOnLast", default:false,
      name:"Last press clears highlighting", desc:"After the last step, pressing again drops the selection and returns the cursor",
      tip:"Get out of a selection with the same key you used to make it\n- <b>On</b> — after the whole note is selected, one more press drops the selection and puts the cursor back where it was\n- <b>Off</b> — one more press starts over from the first step",
      searchTerms:["Last press clears selection", "One more press clears it"], visible: on("editor.selectAll.enabled") },
    { kind:"custom", id:"smart-delete-sub", render: subheader("Smart Delete\\Backspace",
        "Normally <code>Del</code> at the end of a line pulls up the next line with its indent, bullet and checkbox, and you have to delete them by hand. With this on, only the words come up. <code>Backspace</code> at the start of a line has its own switch. An empty bullet disappears in one press. In the middle of a line, or when text is selected, both keys work as usual") },
    { kind:"toggle", id:"smart-delete-enabled", path:"editor.smartDelete.enabled", default:false,
      name:"Smart Delete", desc:"Let <code>Del</code> at the end of a line bring up the words without the indent and the Prefix",
      searchTerms:["Smart Del","Delete the junk"],
      tip:"The cursor is at the end of <code>- call Anna|</code> and the next line is <code>- [ ] buy milk</code>. You press <code>Del</code>\n- <b>On</b> — only the words come up: <code>- call Anna buy milk</code>\n- <b>Off</b> — the line comes up whole: <code>- call Anna- [ ] buy milk</code>\n<code>Smart Backspace</code> below has its own switch" },
    { kind:"toggle", id:"smart-delete-backspace", path:"editor.smartDelete.onBackspace", default:false,
      name:"Smart Backspace", desc:"Let <code>Backspace</code> at the start of a line send it up without its own indent and Prefix",
      searchTerms:["Smart Backspace","Do the same on Backspace"],
      tip:"The cursor is at the start of <code>- [ ] buy milk</code> and the line above is <code>- call Anna</code>. You press <code>Backspace</code>\n- <b>On</b> — only the words go up: <code>- call Anna buy milk</code>. An empty bullet just disappears\n- <b>Off</b> — <code>Backspace</code> works as usual\nWorks even if <code>Smart Delete</code> is off" },
    { kind:"toggle", id:"smart-delete-prefix", path:"editor.smartDelete.dropPrefix", default:true,
      name:"Drop the line Prefix", desc:"Take the bullet, checkbox, number or quote mark off the arriving line, not only its indent",
      searchTerms:["Drop the bullet"], visible: either("editor.smartDelete.enabled", "editor.smartDelete.onBackspace"),
      tip:"Joining <code>- call Anna</code> and <code>- [ ] buy milk</code>\n- <b>On</b> — <code>- call Anna buy milk</code>\n- <b>Off</b> — only the indent goes: <code>- call Anna - [ ] buy milk</code>\nWorks for both keys above" },
    { kind:"toggle", id:"smart-delete-space", path:"editor.smartDelete.joinWithSpace", default:true,
      name:"Join with a space", desc:"Put one space between your text and the text that arrives, so the two do not run together",
      searchTerms:["Add a space"], visible: either("editor.smartDelete.enabled", "editor.smartDelete.onBackspace"),
      tip:"- <b>On</b> — <code>- call Anna</code> and <code>- buy milk</code> join as <code>- call Anna buy milk</code>\n- <b>Off</b> — nothing goes between them, handy for a split word: <code>- inter</code> and <code>- view</code> join as <code>- interview</code>\nWorks for both keys above" },
    { kind:"custom", id:"smart-enter-sub", render: subheader("Smart Enter",
        "Normally <code>Enter</code> in the middle of a line cuts it in two, and the tags and dates end up split between two lines. With Smart Enter, <code>Enter</code> starts a new line below and leaves yours untouched. In code, tables and empty list items <code>Enter</code> works as usual") },
    { kind:"toggle", id:"smart-enter-enabled", path:"editor.smartEnter.enabled", default:false,
      name:"Smart Enter", desc:"Let <code>Enter</code> add a line instead of splitting the one you are on",
      searchTerms:["Smart Enter","Do not split the line"],
      tip:"The cursor is in <code>- call| Anna #todo</code> and you press <code>Enter</code>\n- <b>On</b> — your line stays as it is and a new line <code>- </code> starts below\n- <b>Off</b> — the line splits in two: <code>- call</code> and <code>- Anna #todo</code>\nCode, tables and empty list items always work as usual" },
    { kind:"dropdown", id:"smart-enter-scope", path:"editor.smartEnter.scope", default:"line",
      name:"Where it works", desc:"How much of the line the key treats as one record",
      searchTerms:["Smart Enter scope","Only in your text"],
      visible: on("editor.smartEnter.enabled"),
      options:[ {value:"line",label:"Whole line"},
                {value:"text",label:"Text only"} ],
      tip:"On the line <code>- #todo :: call Anna</code>\n- <b>Whole line</b> — wherever the cursor is, even in <code>#todo</code>, <code>Enter</code> adds a line below\n- <b>Text only</b> — only in <code>call Anna</code>. In <code>#todo</code> the line splits as usual\nA line without Separators counts as all text. Not sure? Keep <b>Whole line</b>" },
    { kind:"dropdown", id:"smart-enter-prefix", path:"editor.smartEnter.newLinePrefix", default:"same",
      name:"Prefix on the new line", desc:"What the line <code>Smart Enter</code> adds starts with",
      searchTerms:["Keep the bullet","New line Prefix","Carry the Prefix over"],
      visible: on("editor.smartEnter.enabled"),
      options:[ {value:"same",label:"Same as above"},
                {value:"none",label:"None"},
                {value:"number-only",label:"Numbered lines only"} ],
      tip:"What the new line below starts with\n- <b>Same as above</b> — like Obsidian: <code>3. call Anna</code> → <code>4. </code>, <code>- [x] call Anna</code> → <code>- [ ] </code>\n- <b>None</b> — bare: <code>3. call Anna</code> → empty line\n- <b>Numbered lines only</b> — <code>3. call Anna</code> → <code>4. </code>, <code>- call Anna</code> → empty line\nAll three keep the indent" },
    { kind:"toggle", id:"smart-enter-use-shift", path:"editor.smartEnter.useShift", default:false,
      name:"Use Shift+Enter instead", desc:"Make <code>Shift+Enter</code> the Smart Enter key and leave <code>Enter</code> as usual",
      searchTerms:["Shift+Enter","Smart Enter key"],
      visible: on("editor.smartEnter.enabled"),
      tip:"- <b>On</b> — <code>Enter</code> splits the line as usual and <code>Shift+Enter</code> adds a line below\n- <b>Off</b> — <code>Enter</code> adds a line below and <code>Shift+Enter</code> works as it always did" },
    { kind:"toggle", id:"smart-enter-shift", path:"editor.smartEnter.shiftPlainEnter", default:false,
      name:"Shift+Enter as usual Enter", desc:"Let <code>Shift+Enter</code> split the line the way <code>Enter</code> does without <code>Smart Enter</code>",
      searchTerms:["Shift+Enter","Plain Enter"],
      visible: both(on("editor.smartEnter.enabled"), not("editor.smartEnter.useShift")),
      tip:"The cursor is in <code>- call| Anna</code>\n- <b>On</b> — <code>Shift+Enter</code> splits it like Obsidian's normal <code>Enter</code>: <code>- call</code> and <code>- Anna</code>\n- <b>Off</b> — <code>Shift+Enter</code> works as it always did" },
    { kind:"custom", id:"smart-paste-sub", render: subheader("Smart Paste (Ctrl+V)",
        "Normally a pasted numbered list keeps its old numbers, and pasting <code>1. text</code> onto a numbered line gives <code>2. 1. text</code>. With this on, a pasted list starts from one, or keeps counting if you paste it right under a list. A doubled number is dropped. Anything else you paste comes in as usual") },
    { kind:"toggle", id:"smart-paste-enabled", path:"editor.smartPaste.enabled", default:false,
      name:"Smart paste", desc:"Count a pasted numbered list from one, and drop a pasted marker where the line has one",
      searchTerms:["Smart insert","Paste a numbered list","Renumber on paste"],
      tip:"- <b>On</b> — a copied <code>5. milk</code>, <code>6. bread</code> pastes as <code>1. milk</code>, <code>2. bread</code>. <code>1. milk</code> pasted after <code>2. </code> gives <code>2. milk</code>\n- <b>Off</b> — numbers stay as copied, and <code>1. milk</code> pasted after <code>2. </code> gives <code>2. 1. milk</code>\nPlain text, links and everything else paste as usual either way" }
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
