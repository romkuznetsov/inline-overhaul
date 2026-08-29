/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Тексты согласованы заказчиком и совпадают с Приложением B PRD.
 * Не перенесено (свои блоки и кнопки без действий, З8):
 *   command-reference: command-list (custom)
 */

import type { SettingsGroup } from "../types.ts";
import { on, not } from "../types.ts";
import { binderTable } from "../custom/binder.ts";
import { callout } from "../custom/callouts.ts";

export const KEYBOARD_GROUPS: readonly SettingsGroup[] = [
{ id: "keyboard-intro",  tab: "keyboard",   order: 50, heading: "Before you start",
  items: [
    { kind:"custom", id:"keyboard-callout", render: callout("keyboard") }
  ] },
{
  id: "select-all", tab: "keyboard", order: 100, heading: "Expanded 'Ctrl+A'",
  intro: "<code>Ctrl/Cmd + A</code> selects the whole note in one go. This setting changes how it works: the first press selects the line you are on, and every further press widens the selection",
  items: [
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
        { value:"line-tree-header-note", label:"Line, tree, heading, then note" }
      ],
      tip:"<b>Tree</b> means the line plus everything indented under it. <b>Heading</b> means everything under the nearest heading. Pick the shortest sequence you will actually use — every extra step is one more press before you reach the whole note" },
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
      name:"One more press clears it", desc:"After the last step, pressing again drops the selection and returns the cursor",
      tip:"Lets you get out of a selection with the same key you got into it, instead of clicking somewhere to deselect",
      searchTerms:["Last press clears selection"], disabled: not("editor.selectAll.enabled") }
  ]
},
{
  id: "binder", tab: "keyboard", order: 200, heading: "Binder (custom insert commands)",
  intro: "For text you type over and over. Put it in a row here, give that row a key, and one press drops it in wherever your cursor is",
  tip: "The <code>Hotkey</code> column shows the key a row has now; click it to go and set one. Only the description can be changed afterwards \u2014 to change the text a row inserts, delete the row and add it again, because the command is created from the row and disappears with it",
  items: [
    { kind:"custom", id:"binder-table", render: binderTable }
  ]
}
];
