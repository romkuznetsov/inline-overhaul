/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Тексты согласованы заказчиком и совпадают с Приложением B PRD.
 */

import type { SettingsGroup } from "../types.ts";
import { on, eq } from "../types.ts";
import { callout } from "../custom/callouts.ts";
import { fieldsEditor } from "../custom/fields_editor.ts";
import { fieldOrderList, prefixOrderList } from "../custom/order_lists.ts";
import { linePreview } from "../custom/previews.ts";

export const PKM_GROUPS: readonly SettingsGroup[] = [
{ id: "pkm-intro",       tab: "pkm",        order: 50, heading: "Before you start",
  items: [
    { kind:"custom", id:"pkm-callout", render: callout("pkm") }
  ],
  visible: on("general.help.showCallouts") },
{
  id: "fields", tab: "pkm", order: 100, heading: "Fields",
  intro: "A Field is one slot a line can hold: a tag, a link to another note, or an element such as a date. Set out the slots you want, the Values each one offers, and where on the line they go",
  tip: "A <b>Field</b> is one slot on a line. There are three kinds of Field: <b>tag</b>, <b>link</b> (wikilink), and <b>emoji-element</b> — such as a date or a time. Each Field automatically gets two <b>cycle commands</b>, <code>next</code> and <code>previous</code>, which insert the Value and cycle it back or forth — it is worth a hotkey for the ones you use often, so a <code>#todo</code> tag is one keypress away. <b>TagWheel</b> opens all of your Fields over the line at once, so you can pick with the arrow keys instead of remembering which key does what",
  items: [
    { kind:"custom", id:"line-preview", render: linePreview },
    { kind:"custom", id:"field-editor", render: fieldsEditor }
  ]
},
{
  id: "line-format", tab: "pkm", order: 200, heading: "Separators",
  intro: "Two markers of your choosing carve out the middle of a line. Whatever you write goes between them; the Fields sit outside. Which Fields land on which side is set under <code>Fields</code>, by dragging one across the line",
  tip: "Choose these carefully and then leave them alone. Lines you have already written keep their old Separator, so changing it later means the plugin no longer recognises them. Use two or more characters that Markdown does not already claim: <code>||</code> and <code>::</code> are good, <code>==</code> is not, because Obsidian reads it as a highlight",
  items: [
    { kind:"text", id:"separator-1", path:"pkm.lineFormat.separator1", default:"||", mono:true,
      name:"First Separator", desc:"Goes between the tags at the front and the start of your sentence",
      tip:"Pick something you would never type on purpose in a sentence. Two pipe characters are the default for exactly that reason \u2014 nobody writes them by accident" },
    { kind:"text", id:"separator-2", path:"pkm.lineFormat.separator2", default:"||", mono:true,
      name:"Second Separator", desc:"Goes at the end of your sentence, before the dates and links",
      tip:"It can be exactly the same as the first one. Which is which is decided by where it sits on the line, not by what it looks like" }
  ]
},
{
  id: "writing-rules", tab: "pkm", order: 300, heading: "Writing rules",
  intro: "The small habits: how a tag is written when it has a Value underneath it, what is left when you clear a line, and where the cursor waits for you afterwards",
  tip: "These are the settings you set once and forget. They do not decide which Fields you have or what they offer — that is the <code>Fields</code> block above. They decide the shape of what lands on the line: whether a nested Value is written as <code>#parent #child</code> or <code>#parent/child</code>, what a Field leaves behind when you step it past its last Value, and where the cursor ends up so you can keep typing",
  items: [
    { kind:"dropdown", id:"child-tag-format", path:"pkm.behavior.childTagFormat", default:"separate",
      name:"Child tag format", desc:"When a Value sits under another one, whether they are written as two tags or one",
      searchTerms:["Subtag format"],
      options:[ {value:"separate",label:"Separate tags (#doing #review)"},
                {value:"combined",label:"One tag (#doing/review)"} ],
      tip:"Say <code>doing</code> has <code>review</code> under it. Two separate tags give you <code>#doing #review</code>, and searching for <code>#doing</code> finds the line. One combined tag gives <code>#doing/review</code>, which keeps the pair together in Obsidian\u2019s tag list but means a search for the parent needs a slash. Every preview on the Visual tab follows whichever you pick",
      seeAlso:{ id:"tag-preview", label:"See it in the tag appearance preview" } },
    { kind:"dropdown", id:"cycle-end-behavior", path:"pkm.behavior.cycleEndBehavior", default:"keep-bullet",
      name:"When a line empties out", desc:"What is left behind when cycling removes the last Value",
      searchTerms:["Line Prefix after end of cycle"],
      options:[ {value:"keep-bullet",label:"Keep the list bullet"}, {value:"clear-prefix",label:"Clear the line"} ],
      tip:"Step a Field back past its first Value and the tag comes off the line. If that was the only thing on it, you are left with <code>- </code> and nothing else. Keep the bullet leaves it as a list item ready for typing; clear the line leaves a blank line" },
    { kind:"dropdown", id:"cursor-policy", path:"pkm.behavior.cursorPolicy", default:"text_end",
      name:"Cursor after an action", desc:"Where the cursor waits once a tag or date has been set",
      searchTerms:["Cursor behavior"],
      options:[ {value:"text_end",label:"End of your text (recommended)"},
                {value:"current_position",label:"Leave it where it was"},
                {value:"line_end",label:"End of the line"} ],
      tip:"Almost always what you want is <b>end of your text</b>: the cursor lands right where you stopped writing, in front of the tags, so you can carry straight on. The other two put it somewhere you will usually have to move it from" }
  ]
},
{
  id: "placement-modes", tab: "pkm", order: 400, heading: "Placement modes",
  intro: "Every Field has a <code>Behavior</code> mode: <code>Strict</code>, <code>Insert only</code> or <code>Free</code>. These options define how exactly those modes work",
  tip: "You choose the mode for each Field over in <code>Fields</code>. What you set here is the fine print of each mode \u2014 mainly whether it is allowed to change the very start of the line, the part that makes it a bullet or a checkbox",
  items: [
    { kind:"toggle", id:"placement-bullet-strict", path:"pkm.placement.bulletInStrict", default:false,
      name:"Strict: add a bullet", desc:"Start the line with a bullet when the Field has nothing of its own to put there",
      searchTerms:["OFF mode Prefix"],
      tip:"Headings are always left alone. This only decides what happens to a plain line: on, it becomes a list item; off, it stays as it is",
      seeAlso:{ id:"field-editor", label:"Each Field's Behavior is set under Fields" } },
    { kind:"toggle", id:"placement-keep-prefix", path:"pkm.placement.keepPrefixInsertOnly", default:true,
      name:"Insert only: keep the Prefix", desc:"Put the Value where it belongs and do not touch the start of the line",
      searchTerms:["Minimal mode Separators"] },
    { kind:"toggle", id:"placement-field-prefix", path:"pkm.placement.fieldPrefixInsertOnly", default:true,
      name:"Insert only: use Field Prefix", desc:"Allow a Value to change the start of the line after all, if it has its own",
      searchTerms:["Minimal mode Prefix"],
      tip:"Some Values carry their own opening, like <code>- [x]</code> for done. On, choosing that Value ticks the checkbox for you. Off, the line keeps whatever it started with and only the tag changes" },
    { kind:"dropdown", id:"placement-free-position", path:"pkm.placement.freeInsertPosition", default:"smart",
      name:"Free: insert position", desc:"Which end of the line a Value goes to when the cursor is mid-sentence",
      searchTerms:["Full mode"],
      options:[ {value:"smart",label:"Whichever side is closer"}, {value:"left",label:"Always left"},
                {value:"right",label:"Always right"} ] }
  ]
},
{
  id: "prefix-priority", tab: "pkm", order: 500, heading: "Prefix priority",
  intro: "Some Values want to change the start of the line \u2014 a checkbox from Status, an exclamation mark from Priority. When two of them ask at once, only one can win. These rules decide who",
  tip: "This block matters only if two of your Values both want the start of the line. If none of them do, or only one ever does, nothing here changes anything. <b>Decide by</b> is the main choice: settle it by where the Fields stand in your own order, or by a list of openings you rank yourself. The row below it decides whether a nested Value outranks its parent or the other way round",
  items: [
    { kind:"dropdown", id:"prefix-priority-decide", path:"pkm.prefixPriority.decideBy", default:"by-section",
      name:"Decide by", desc:"Settle it by the order of your Fields, or by a list of openings you rank yourself",
      searchTerms:["Main checkbox priority","Prefix Resolver"],
      options:[ {value:"by-section",label:"Field order"}, {value:"by-checkbox-list",label:"Prefix order"} ],
      tip:"<b>Field order</b> is the simple answer: whichever Field comes first in your list gets its way. <b>Prefix order</b> is for when you care about the openings themselves \u2014 say an urgent mark should always beat a tick, no matter which Field asked for it" },
    { kind:"dropdown", id:"prefix-priority-source", path:"pkm.prefixPriority.fieldOrderSource", default:"manual",
      name:"Field order source", desc:"Use the order your Fields are already in, or arrange a separate one",
      searchTerms:["Fields order mode"],
      visible: eq("pkm.prefixPriority.decideBy","by-section"),
      options:[ {value:"auto",label:"By Fields order"}, {value:"manual",label:"Manual order"} ] },
    { kind:"custom", id:"field-order-list", render: fieldOrderList,
      visible:{ deps:["pkm.prefixPriority.decideBy","pkm.prefixPriority.fieldOrderSource"],
                test: c => c.get("pkm.prefixPriority.decideBy") === "by-section"
                        && c.get("pkm.prefixPriority.fieldOrderSource") === "manual" } },
    { kind:"custom", id:"prefix-order-list", render: prefixOrderList,
      visible: eq("pkm.prefixPriority.decideBy","by-checkbox-list") },
    { kind:"dropdown", id:"prefix-priority-parent", path:"pkm.prefixPriority.parentOrChild", default:"subtag-over-tag",
      name:"Parent or child wins", desc:"When a tag and its child Value both carry a Prefix",
      searchTerms:["Tag/Subtag priority"],
      options:[ {value:"tag-over-subtag",label:"Parent tag"}, {value:"subtag-over-tag",label:"Child tag"} ] }
  ]
}
];
