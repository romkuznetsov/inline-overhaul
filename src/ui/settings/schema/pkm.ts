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
  tip: "A <b>Field</b> is one slot on a line. There are three kinds of Field: <b>tag</b>, <b>link</b> (wikilink), and <b>Emoji</b> — such as a date or a time. Each Field automatically gets two <b>cycle commands</b>, <code>next</code> and <code>previous</code>, which insert the Value and cycle it back or forth — it is worth a hotkey for the ones you use often, so a <code>#todo</code> tag is one keypress away. <b>tagWheel</b> opens all of your Fields over the line at once, so you can pick with the arrow keys instead of remembering which key does what",
  items: [
    { kind:"custom", id:"line-preview", render: linePreview },
    { kind:"custom", id:"field-editor", render: fieldsEditor }
  ]
},
{
  id: "line-format", tab: "pkm", order: 200, heading: "Separators",
  intro: "Two markers of your choosing carve out the middle of a line. Whatever you write goes between them; the Fields sit outside. Which Fields land on which side is set under <code>Fields</code>, by dragging one across the line",
  tip: "Choose these carefully and then leave them alone. Lines you have already written keep their old Separator, so changing it later means the plugin no longer recognizes them. Use two or more characters that Markdown does not already claim: <code>||</code> and <code>::</code> are good, <code>==</code> is not, because Obsidian reads it as a highlight",
  items: [
    { kind:"text", id:"separator-1", path:"pkm.lineFormat.separator1", default:"||", mono:true,
      name:"First Separator", desc:"Goes between the tags at the front and the start of your sentence",
      tip:"Pick something you would never type on purpose in a sentence. Two pipe characters are the default for exactly that reason \u2014 nobody writes them by accident" },
    { kind:"text", id:"separator-2", path:"pkm.lineFormat.separator2", default:"||", mono:true,
      name:"Second Separator", desc:"Goes at the end of your sentence, before the dates and links",
      tip:"Using exactly the same one as the first is fine. Which is which is decided by where it sits on the line, not by what it looks like" }
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
      tip:"Step a Field back past its first Value and the tag comes off the line. If that was the only thing on it, you are left with <code>- </code> and nothing else. <code>Keep the list bullet</code> leaves it as a list item ready for typing; <code>Clear the line</code> leaves a blank line" },
    { kind:"dropdown", id:"cursor-policy", path:"pkm.behavior.cursorPolicy", default:"text_end",
      name:"Cursor after an action", desc:"Where the cursor waits once a tag or date has been set",
      searchTerms:["Cursor behavior"],
      /* Приписка «(recommended)» снята его словом 2026-09-21: панель сама
         помечает стандартный вариант «(default)», и два ответа на один вопрос
         читались подряд — `End of your text (recommended) (default)`. Какой
         вариант чаще всего нужен, говорит `tip` ниже. */
      options:[ {value:"text_end",label:"End of your text"},
                {value:"current_position",label:"Leave it where it was"},
                {value:"line_end",label:"End of the line"} ],
      tip:"Almost always what you want is <b>end of your text</b>: the cursor lands right where you stopped writing, in front of the tags, so you can carry straight on. The other two put it somewhere you usually have to move it from" }
  ]
},
{
  /* **Поведение tagWheel — своя группа на `Tags & PKM`** (его пункт 2026-09-24,
     PRD 10.13.260): «нужно создать новый хедер в Tags & PKM `tagWheel behavior`
     (должен быть над хедером `placement-modes`)». Сюда из `Visual` → `tagWheel`
     → `Panel` переехали три строки и две подчинённые; ключи конфига не
     тронуты (З1), переехали только строки панели. */
  id: "tagwheel-behavior", tab: "pkm", order: 350, heading: "tagWheel behavior",
  intro: "Where tagWheel lands when it opens, what happens to the Values it is not picking, and what the arrow keys do at the edge of a Block. How it looks is set on the Visual tab",
  tip: "tagWheel is the picker that opens over your line with your Fields laid out across it. These settings decide how it moves, not how it looks: the Field it opens on, whether the Values of the other Block stay in sight, and where the arrows take you past the last Field. Colors, sizes and the scroller live under <code>Visual</code> → <code>tagWheel</code>",
  items: [
    { kind:"dropdown", id:"wheel-active-field", path:"visual.tagWheel.activeField.mode", default:"first",
      name:"Active Field on opening", desc:"Which Field the picker lands on when it opens",
      searchTerms:["Lead Field","Starting Field","Active Field"],
      options:[ {value:"first",label:"First Field of the Block"},
                {value:"middle",label:"Middle Field of the Block"},
                {value:"custom",label:"A Field you choose"} ],
      tip:"tagWheel opens on one of the Fields of the Block, and the up and down keys start moving through that Field’s Values. <code>First Field of the Block</code> lands on the one standing first in your order. <code>Middle Field of the Block</code> lands nearer the middle, so neither end is far: with two Fields it is the first, with three the second, with four the second, with five the third. <code>A Field you choose</code> opens two more settings, one per Block. A custom block opens on its first or its middle Field the same way, and with <code>A Field you choose</code> on its first; with the cursor on one of its Values it opens on that Value’s Field" },
    { kind:"dropdown", id:"wheel-active-left", path:"visual.tagWheel.activeField.left", default:"",
      name:"Left Block active Field", desc:"The Field tagWheel lands on when it opens on the left",
      searchTerms:["Lead Field left"],
      options:[ {value:"",label:"First Field of the Block"} ], optionsFrom:"left-block-fields",
      visible: eq("visual.tagWheel.activeField.mode","custom"),
      tip:"Only Fields standing in the Left Block are offered. A Field you later move to the other Block stops being the one it lands on, and the Left Block falls back to its first" },
    { kind:"dropdown", id:"wheel-active-right", path:"visual.tagWheel.activeField.right", default:"",
      name:"Right Block active Field", desc:"The Field tagWheel lands on when it opens on the right",
      searchTerms:["Lead Field right"],
      options:[ {value:"",label:"First Field of the Block"} ], optionsFrom:"right-block-fields",
      visible: eq("visual.tagWheel.activeField.mode","custom"),
      tip:"Only Fields standing in the Right Block are offered. Leave it on <code>First Field of the Block</code> and the right side opens on its first Field" },
    { kind:"dropdown", id:"wheel-opposite-block", path:"visual.tagWheel.oppositeBlock", default:"hide",
      name:"Values in the other Block", desc:"What happens to the Values you are not picking while the picker is open",
      searchTerms:["Opposite Block","Other Block","Hide values"],
      options:[ {value:"hide",label:"Hide them while the picker is open"},
                {value:"keep",label:"Keep them in sight"} ],
      tip:"tagWheel draws itself over the line, and the Block it is standing in gives up its place to the picker. <code>Hide them while the picker is open</code> is how it has always worked: the other Block leaves the line for as long as you are choosing. <code>Keep them in sight</code> leaves it written where it belongs, so you can see what the line already carries on the other side of your text. Either way nothing is written or removed — what you pick lands on the line when the picker closes. A custom block hides or keeps the Values of Left and Right Block the same way; the Values it has already written always stay in sight, as part of your text" },
    { kind:"dropdown", id:"wheel-edge", path:"visual.tagWheel.edgeMode", default:"stay",
      name:"tagWheel navigation behavior", desc:"What the arrow keys do when there is no next Field on this side",
      searchTerms:["Edge of a Block","Wrap around","Move to the next Block","At the last Field"],
      options:[ {value:"stay",label:"Stay in the same Block"},
                {value:"next-block",label:"Move to the next Block"} ],
      tip:"The left and right Blocks each hold their own Fields, and the arrows walk along one of them. <code>Stay in the same Block</code> keeps you there: past the last Field you land back on the first. <code>Move to the next Block</code> makes the two into one ring — step right off the end of the Left Block and you arrive at the first Field of the right one, step left off its start and you arrive at the last. <code>Tab</code> switches Blocks either way. A custom block is not part of the ring: there the arrows always stay in the same Block" },
    { kind:"toggle", id:"wheel-custom-tab", path:"visual.tagWheel.customTab", default:false,
      name:"Switch custom blocks on Tab", desc:"Tab in a custom block’s tagWheel moves on to the next custom block",
      searchTerms:["Custom block","Tab","Next custom block"],
      visible:{ deps:["pkm.fields.order.custom"],
                test: c => Boolean(Object(c.get("pkm.fields.order.custom")).length) },
      tip:"Off, <code>Tab</code> does nothing while a custom block’s tagWheel is open. On, it moves on to the next custom block in the order of the Fields list, and from the last one back to the first; the picker stays where the cursor is, and what you picked in the block you leave is dropped — only <code>Enter</code> writes. The tagWheel of Left and Right Block never moves into a custom block" }
  ]
},
{
  id: "placement-modes", tab: "pkm", order: 400, heading: "Placement modes",
  intro: "Every Field in Left or Right Block has a <code>Prefix behavior</code> mode: <code>Strict</code> or <code>Insert only</code>. These options define how exactly those modes work",
  tip: "You choose the mode for each Field over in <code>Fields</code>. What you set here is the fine print of each mode \u2014 mainly whether it is allowed to change the very start of the line, the part that makes it a bullet or a checkbox",
  items: [
    { kind:"toggle", id:"placement-bullet-strict", path:"pkm.placement.bulletInStrict", default:false,
      name:"Strict: add a bullet", desc:"Start the line with a bullet when the Field has nothing of its own to put there",
      searchTerms:["OFF mode Prefix"],
      tip:"Headings are always left alone. This only decides what happens to a plain line: on, it becomes a list item; off, it stays as it is",
      seeAlso:{ id:"field-editor", label:"Each Field’s Prefix behavior is set under Fields" } },
    { kind:"toggle", id:"placement-keep-prefix", path:"pkm.placement.keepPrefixInsertOnly", default:true,
      name:"Insert only: keep the Prefix", desc:"Put the Value where it belongs and do not touch the start of the line",
      tip:"A Value may carry a Prefix of its own — a checkbox, for instance — and normally it replaces what stands at the start of the line. With this on, the line keeps the marker you typed and the Value goes to its place in the Block anyway. Useful when your lists already carry markers you care about",
      searchTerms:["Minimal mode Separators"] },
    { kind:"toggle", id:"placement-field-prefix", path:"pkm.placement.fieldPrefixInsertOnly", default:true,
      name:"Insert only: use Field Prefix", desc:"Allow a Value to change the start of the line after all, if it has its own",
      searchTerms:["Minimal mode Prefix"],
      tip:"Some Values carry their own opening, like <code>- [x]</code> for done. On, choosing that Value ticks the checkbox for you. Off, the line keeps whatever it started with and only the tag changes" }
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
      tip:"Two Values may both want to change the start of the line, and then one of them has to win. <code>By Field order</code> settles it by the order your Fields already stand in, so there is one list to keep. <code>Manual order</code> gives this question its own list, independent of the Blocks",
      searchTerms:["Field order mode"],
      visible: eq("pkm.prefixPriority.decideBy","by-section"),
      options:[ {value:"auto",label:"By Field order"}, {value:"manual",label:"Manual order"} ] },
    { kind:"custom", id:"field-order-list", render: fieldOrderList,
      visible:{ deps:["pkm.prefixPriority.decideBy","pkm.prefixPriority.fieldOrderSource"],
                test: c => c.get("pkm.prefixPriority.decideBy") === "by-section"
                        && c.get("pkm.prefixPriority.fieldOrderSource") === "manual" } },
    { kind:"custom", id:"prefix-order-list", render: prefixOrderList,
      visible: eq("pkm.prefixPriority.decideBy","by-checkbox-list") },
    { kind:"dropdown", id:"prefix-priority-parent", path:"pkm.prefixPriority.parentOrChild", default:"subtag-over-tag",
      name:"Parent or child wins", desc:"When a tag and its child Value both carry a Prefix",
      tip:"A child Value stands under its parent, and both may carry a Prefix. <code>Parent tag</code> keeps the line marked by the wider meaning; <code>Child tag</code> lets the narrower one speak, so a child marked as done wins over a parent that is merely open",
      searchTerms:["Tag/Subtag priority"],
      options:[ {value:"tag-over-subtag",label:"Parent tag"}, {value:"subtag-over-tag",label:"Child tag"} ] }
  ]
}
];
