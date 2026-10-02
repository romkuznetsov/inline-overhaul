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
  intro: "A Field is one thing a line can have: a tag, a link to a note, or an emoji item such as a date. Add the Fields you want, the Values each one offers, and where on the line they go",
  tip: "There are three kinds of Field: <b>tag</b>, <b>link</b> and <b>Emoji</b> (such as a date). Each Field gets two commands, <code>next</code> and <code>previous</code>, that put a Value on the line and step through the rest. Give a hotkey to the ones you use often. Or open <b>tagWheel</b> to see all your Fields at once and pick with the arrow keys",
  items: [
    { kind:"custom", id:"line-preview", render: linePreview },
    { kind:"custom", id:"field-editor", render: fieldsEditor }
  ]
},
{
  id: "line-format", tab: "pkm", order: 200, heading: "Separators",
  intro: "Two markers split your line. Your own text goes between them, and the Fields sit before and after. To choose which side a Field goes on, drag it across the line under <code>Fields</code>",
  tip: "Pick these once and leave them. Lines you already wrote keep the old Separator, so if you change it the plugin stops recognizing them. Use two or more characters Markdown doesn’t use: <code>||</code> or <code>::</code> are good, but <code>==</code> is not, because Obsidian shows it as a highlight",
  items: [
    { kind:"text", id:"separator-1", path:"pkm.lineFormat.separator1", default:"||", mono:true,
      name:"First Separator", desc:"Goes between the tags at the front and the start of your sentence",
      tip:"Pick something you would never type in a sentence by accident. That is why the default is two pipe characters" },
    { kind:"text", id:"separator-2", path:"pkm.lineFormat.separator2", default:"||", mono:true,
      name:"Second Separator", desc:"Goes at the end of your sentence, before the dates and links",
      tip:"It may match the first one: the plugin tells them apart by where they stand on the line, not by how they look" }
  ]
},
{
  id: "writing-rules", tab: "pkm", order: 300, heading: "Writing rules",
  intro: "The small habits: how nested tags are written, what is left when a line empties, and where the cursor waits afterwards",
  tip: "Set these once and forget them. Which Fields you have is set under <code>Fields</code>. Here you choose how things land on the line: <code>#parent #child</code> or <code>#parent/child</code>, what is left when you step past the last Value, and where the cursor ends up",
  items: [
    { kind:"dropdown", id:"child-tag-format", path:"pkm.behavior.childTagFormat", default:"separate",
      name:"Child tag format", desc:"When a Value sits under another one, whether they are written as two tags or one",
      searchTerms:["Subtag format"],
      options:[ {value:"separate",label:"Separate (#doing #review)"},
                {value:"combined",label:"Nested (#doing/review)"} ],
      tip:"Say <code>doing</code> has <code>review</code> under it. <b>Separate</b> gives <code>#doing #review</code>, so a search for <code>#doing</code> finds the line. <b>Nested</b> gives <code>#doing/review</code>, which keeps the pair together in Obsidian’s tag list, but searching for the parent needs a slash. Previews on the Visual tab follow your choice",
      seeAlso:{ id:"tag-preview", label:"See it in the tag appearance preview" } },
    { kind:"dropdown", id:"cycle-end-behavior", path:"pkm.behavior.cycleEndBehavior", default:"keep-bullet",
      name:"When a line empties out", desc:"What is left behind when cycling removes the last Value",
      searchTerms:["Line Prefix after end of cycle"],
      options:[ {value:"keep-bullet",label:"Keep bullet"}, {value:"clear-prefix",label:"Clear line"} ],
      tip:"When the tag comes off and nothing is left but <code>- </code>: <code>Keep bullet</code> leaves an empty list item ready for typing, and <code>Clear line</code> leaves a blank line" },
    { kind:"dropdown", id:"cursor-policy", path:"pkm.behavior.cursorPolicy", default:"text_end",
      name:"Cursor after an action", desc:"Where the cursor waits once a tag or date has been set",
      searchTerms:["Cursor behavior"],
      /* Приписка «(recommended)» снята его словом 2026-09-21: панель сама
         помечает стандартный вариант «(default)», и два ответа на один вопрос
         читались подряд — `End of your text (recommended) (default)`. Какой
         вариант чаще всего нужен, говорит `tip` ниже. */
      options:[ {value:"text_end",label:"Text end"},
                {value:"current_position",label:"Don't move"},
                {value:"line_end",label:"Line end"} ],
      tip:"Pick <b>end of your text</b>: the cursor lands where you stopped writing, just before the tags, so you can keep typing. With the other two you usually have to move the cursor back" },
    { kind:"text", id:"done-marker", clearable:true, path:"pkm.behavior.doneMarker.token", default:"", mono:true,
      name:"Mark ticked line", desc:"A tag or emoji added when you tick a checkbox and taken off when you untick it",
      searchTerms:["Done marker", "Checkbox marker", "Mark the line as done"],
      tip:"Type a tag or emoji, such as <code>#done</code> or <code>✅</code>. Ticking <code>- [ ]</code> to <code>- [x]</code> adds it, and unticking removes it. If it is a Value of one of your Fields (say <code>#done</code> under <code>Status</code>), it goes where that Field is and replaces its Value. Leave this empty and ticking adds nothing" },
    { kind:"dropdown", id:"done-marker-position", path:"pkm.behavior.doneMarker.panel", default:"right",
      name:"Where the tick mark goes", desc:"Before your text, or after it",
      tip:"Left Block puts the mark with the tags before your text. Right Block keeps your sentence first. If the mark is a Value of one of your Fields, this setting doesn’t apply: the mark goes where that Field is",
      searchTerms:["Done marker panel"],
      visible:{ deps:["pkm.behavior.doneMarker.token"],
                test: c => String(c.get("pkm.behavior.doneMarker.token") || "").trim() !== "" },
      options:[ {value:"left",label:"Left Block"}, {value:"right",label:"Right Block"} ] },
    { kind:"toggle", id:"done-strike", path:"pkm.behavior.doneMarker.strike", default:false,
      name:"Strike through ticked line", desc:"Cross out the whole line once it carries the tick mark",
      searchTerms:["Cross out done lines"],
      visible:{ deps:["pkm.behavior.doneMarker.token"],
                test: c => String(c.get("pkm.behavior.doneMarker.token") || "").trim() !== "" },
      tip:"Only the look changes. Nothing is written into the note, and the strike goes away when the mark comes off the line" },
    { kind:"toggle", id:"done-dim", path:"pkm.behavior.doneMarker.visual.enabled", default:false,
      name:"Dim ticked line", desc:"Fade a line once it carries the tick mark, so your eye skips it",
      searchTerms:["Dim the lines already done"],
      visible:{ deps:["pkm.behavior.doneMarker.token"],
                test: c => String(c.get("pkm.behavior.doneMarker.token") || "").trim() !== "" },
      tip:"Ticked lines stay where they are and search still finds them, but they stop catching your eye. Only the look changes. Nothing is written into the note, and unticking brings the line back to full strength" },
    { kind:"slider", id:"done-dim-opacity", path:"pkm.behavior.doneMarker.visual.opacity", default:65,
      min:0, max:80, step:5, unit:"%", invert:100,
      name:"Opacity of ticked line", desc:"Zero leaves the line as it is, eighty makes it barely readable",
      searchTerms:["How much of a ticked line is left"],
      tip:"How strongly a ticked line fades. Only the look changes: the text stays whole and search still finds it",
      visible:{ deps:["pkm.behavior.doneMarker.token","pkm.behavior.doneMarker.visual.enabled"],
                test: c => String(c.get("pkm.behavior.doneMarker.token") || "").trim() !== ""
                  && Boolean(c.get("pkm.behavior.doneMarker.visual.enabled")) } },
    { kind:"color", id:"done-dim-color", path:"pkm.behavior.doneMarker.visual.color", default:"",
      name:"Color of ticked line", desc:"Leave it unset to keep the color your theme gives the text",
      allowReset:true,
      searchTerms:["Color of a done line"],
      tip:"Set a color only if fading alone doesn’t make ticked lines easy to spot. Your color replaces the theme’s color, and the fade still applies on top",
      visible:{ deps:["pkm.behavior.doneMarker.token","pkm.behavior.doneMarker.visual.enabled"],
                test: c => String(c.get("pkm.behavior.doneMarker.token") || "").trim() !== ""
                  && Boolean(c.get("pkm.behavior.doneMarker.visual.enabled")) } }
  ]
},
{
  /* **Поведение tagWheel — своя группа на `Tags & PKM`** (его пункт 2026-09-24,
     PRD 10.13.260): «нужно создать новый хедер в Tags & PKM `tagWheel behavior`
     (должен быть над хедером `placement-modes`)». Сюда из `Visual` → `tagWheel`
     → `Panel` переехали три строки и две подчинённые; ключи конфига не
     тронуты (З1), переехали только строки панели. */
  id: "tagwheel-behavior", tab: "pkm", order: 350, heading: "tagWheel behavior",
  intro: "How tagWheel behaves: which Field it opens on, what happens to the other Values while it is open, and where the arrow keys take you. Its look is set on the Visual tab",
  tip: "tagWheel is the picker that opens over your line and shows all your Fields. Here you set how it moves: the Field it opens on, whether the other Block stays visible, and where the arrows go after the last Field. Colors and sizes are under <code>Visual</code> → <code>tagWheel</code>",
  items: [
    { kind:"dropdown", id:"wheel-active-field", path:"visual.tagWheel.activeField.mode", default:"first",
      name:"Active Field on opening", desc:"Which Field the picker lands on when it opens",
      searchTerms:["Lead Field","Starting Field","Active Field"],
      options:[ {value:"first",label:"First Field"},
                {value:"middle",label:"Middle Field"},
                {value:"custom",label:"Chosen Field"} ],
      tip:"<code>First Field</code> opens on the first Field in your order. <code>Middle Field</code> opens near the middle, so neither end is far away, which helps if you have many Fields. <code>Chosen Field</code> lets you pick one Field for each Block in the two settings below" },
    { kind:"dropdown", id:"wheel-active-left", path:"visual.tagWheel.activeField.left", default:"",
      name:"Left Block active Field", desc:"The Field tagWheel lands on when it opens on the left",
      searchTerms:["Lead Field left"],
      options:[ {value:"",label:"First Field"} ], optionsFrom:"left-block-fields",
      visible: eq("visual.tagWheel.activeField.mode","custom"),
      tip:"You can only pick Fields that are in the Left Block. If you later move that Field to the right, tagWheel goes back to opening on the first Field on the left" },
    { kind:"dropdown", id:"wheel-active-right", path:"visual.tagWheel.activeField.right", default:"",
      name:"Right Block active Field", desc:"The Field tagWheel lands on when it opens on the right",
      searchTerms:["Lead Field right"],
      options:[ {value:"",label:"First Field"} ], optionsFrom:"right-block-fields",
      visible: eq("visual.tagWheel.activeField.mode","custom"),
      tip:"You can only pick Fields that are in the Right Block. Leave it on <code>First Field</code> to open on the first one" },
    { kind:"dropdown", id:"wheel-opposite-block", path:"visual.tagWheel.oppositeBlock", default:"hide",
      name:"Values in the other Block", desc:"What happens to the Values you are not picking while the picker is open",
      searchTerms:["Opposite Block","Other Block","Hide values"],
      options:[ {value:"hide",label:"Hide"},
                {value:"keep",label:"Show"} ],
      tip:"<code>Hide</code> (the usual way): the other Block disappears from the line while you choose. <code>Show</code>: it stays visible, so you can see what the line already has on the other side. With <code>Show</code>, the line is really changed while the picker is open, so a save at that moment writes it to the file. Closing the picker puts the line back" },
    { kind:"dropdown", id:"wheel-edge", path:"visual.tagWheel.edgeMode", default:"stay",
      name:"tagWheel navigation behavior", desc:"What the arrow keys do when there is no next Field on this side",
      searchTerms:["Edge of a Block","Wrap around","Move to the next Block","At the last Field"],
      options:[ {value:"stay",label:"Stay in Block"},
                {value:"next-block",label:"Next Block"} ],
      tip:"<code>Stay in Block</code>: after the last Field, the arrows go back to the first Field of the same Block. <code>Next Block</code>: the arrows carry on into the other Block, so both Blocks work as one loop. <code>Tab</code> switches Blocks either way. In a custom block the arrows always stay in that block" },
    { kind:"toggle", id:"wheel-custom-tab", path:"visual.tagWheel.customTab", default:false,
      name:"Switch custom blocks on Tab", desc:"Tab in a custom block’s tagWheel moves on to the next custom block",
      searchTerms:["Custom block","Tab","Next custom block"],
      visible:{ deps:["pkm.fields.order.custom"],
                test: c => Boolean(Object(c.get("pkm.fields.order.custom")).length) },
      tip:"Off: <code>Tab</code> does nothing in a custom block’s tagWheel. On: it moves to the next custom block in the order of your Fields list, and from the last one back to the first. Whatever you picked in the block you leave is lost, because only <code>Enter</code> saves it" }
  ]
},
{
  id: "placement-modes", tab: "pkm", order: 400, heading: "Placement modes",
  intro: "Each Field in the Left or Right Block has a <code>Prefix behavior</code> mode, either <code>Strict</code> or <code>Insert only</code>. Here you fine-tune how these modes work",
  tip: "You pick the mode for each Field under <code>Fields</code>. Here you set the details, mainly whether a mode can change the start of the line, where the bullet or checkbox is",
  items: [
    { kind:"toggle", id:"placement-bullet-strict", path:"pkm.placement.bulletInStrict", default:false,
      name:"Strict: add a bullet", desc:"Start the line with a bullet when the Field has nothing of its own to put there",
      searchTerms:["OFF mode Prefix"],
      tip:"Headings are never changed. On: a plain line becomes a list item. Off: it stays as it is",
      seeAlso:{ id:"field-editor", label:"Each Field’s Prefix behavior is set under Fields" } },
    { kind:"toggle", id:"placement-field-prefix", path:"pkm.placement.fieldPrefixInsertOnly", default:true,
      name:"Insert only: use Field Prefix", desc:"Allow a Value to change the start of the line after all, if it has its own",
      searchTerms:["Minimal mode Prefix"],
      tip:"Some Values come with their own line start, like <code>- [x]</code> for done. On: choosing that Value ticks the checkbox for you. Off: the line keeps its start and only the tag changes" },
    { kind:"toggle", id:"placement-typed-tags", path:"pkm.placement.typedTagsStayText", default:true,
      name:"Keep typed tags in text", desc:"A tag or link you type between words or at the end stays your word",
      searchTerms:["Value in text", "tag in the middle"],
      tip:"This works in both modes. On: <code>- buy #todo milk</code> stays as you wrote it, and the Field command adds its own Value in the Block. Off: a Field’s Value anywhere in your text moves out of the sentence into its Block. Tags at the very start of a line always count as Values" }
  ]
},
{
  id: "prefix-priority", tab: "pkm", order: 500, heading: "Prefix priority",
  intro: "Some Values change the start of the line, like a checkbox from Status or an exclamation mark from Priority. When two of them want it at once, these rules pick the winner",
  tip: "This only matters if two of your Values both want the start of the line. If not, you can skip it. <b>Decide by</b> is the main choice: go by your Field order, or by a list of line starts you rank yourself. The setting below it decides whether a nested Value beats its parent or the other way round",
  items: [
    { kind:"dropdown", id:"prefix-priority-decide", path:"pkm.prefixPriority.decideBy", default:"by-section",
      name:"Decide by", desc:"Settle it by the order of your Fields, or by a list of openings you rank yourself",
      searchTerms:["Main checkbox priority","Prefix Resolver"],
      options:[ {value:"by-section",label:"Field order"}, {value:"by-checkbox-list",label:"Prefix order"} ],
      tip:"<b>Field order</b> is the simple choice: the Field that comes first in your list wins. <b>Prefix order</b> is for when the line start itself matters, say an urgent mark should always beat a tick, whichever Field asked for it. Not sure? Keep <b>Field order</b>" },
    { kind:"dropdown", id:"prefix-priority-source", path:"pkm.prefixPriority.fieldOrderSource", default:"manual",
      name:"Field order source", desc:"Use the order your Fields are already in, or arrange a separate one",
      tip:"<code>Field order</code> uses the order your Fields are already in, so you only keep one list. <code>Manual</code> gives this its own list, separate from the Blocks. Not sure? Keep <code>Field order</code>",
      searchTerms:["Field order mode"],
      visible: eq("pkm.prefixPriority.decideBy","by-section"),
      options:[ {value:"auto",label:"Field order"}, {value:"manual",label:"Manual"} ] },
    { kind:"custom", id:"field-order-list", render: fieldOrderList,
      visible:{ deps:["pkm.prefixPriority.decideBy","pkm.prefixPriority.fieldOrderSource"],
                test: c => c.get("pkm.prefixPriority.decideBy") === "by-section"
                        && c.get("pkm.prefixPriority.fieldOrderSource") === "manual" } },
    { kind:"custom", id:"prefix-order-list", render: prefixOrderList,
      visible: eq("pkm.prefixPriority.decideBy","by-checkbox-list") },
    { kind:"dropdown", id:"prefix-priority-parent", path:"pkm.prefixPriority.parentOrChild", default:"subtag-over-tag",
      name:"Parent or child wins", desc:"When a tag and its child Value both carry a Prefix",
      tip:"<code>Parent tag</code>: the broader Value wins. <code>Child tag</code>: the more specific one wins, so a child marked as done beats a parent that is only open",
      searchTerms:["Tag/Subtag priority"],
      options:[ {value:"tag-over-subtag",label:"Parent tag"}, {value:"subtag-over-tag",label:"Child tag"} ] }
  ]
}
];
