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
  tip: "Each Field gets two commands, <code>next</code> and <code>previous</code>, that put a Value on the line and step through the rest:\n- <b>next</b> — <code>- call Anna</code> → <code>- [ ] #todo :: call Anna</code> → <code>- #idea :: call Anna</code>\n- <b>previous</b> — the same list from the end: <code>- call Anna</code> → <code>- [x] #done :: call Anna</code>\nA Field is a tag, a link or an Emoji such as a date. Give a hotkey to the ones you use often, or open <b>tagWheel</b> to pick with the arrow keys",
  items: [
    { kind:"custom", id:"line-preview", render: linePreview },
    { kind:"custom", id:"field-editor", render: fieldsEditor }
  ]
},
{
  id: "line-format", tab: "pkm", order: 200, heading: "Separators", folded: true,
  intro: "Two markers split your line. Your own text goes between them, and the Fields sit before and after. To choose which side a Field goes on, drag it across the line under <code>Fields</code>",
  tip: "Pick these once and leave them. With <code>::</code> on both sides a line looks like <code>- #high :: call Anna :: 📅2026-10-04</code>\n- <b>Good</b> — <code>||</code> or <code>::</code>, characters Markdown doesn’t use\n- <b>Bad</b> — <code>==</code>, because Obsidian shows it as a highlight\nLines you already wrote keep the old Separator, so if you change it the plugin stops recognizing them",
  items: [
    { kind:"text", id:"separator-1", path:"pkm.lineFormat.separator1", default:"||", mono:true,
      name:"First Separator", desc:"Goes between the tags at the front and the start of your sentence",
      tip:"Pick something you would never type in a sentence by accident. That is why the default is two pipe characters\n- <b>||</b> — <code>- #high || call Anna</code>\n- <b>::</b> — <code>- #high :: call Anna</code>" },
    { kind:"text", id:"separator-2", path:"pkm.lineFormat.separator2", default:"||", mono:true,
      name:"Second Separator", desc:"Goes at the end of your sentence, before the dates and links",
      tip:"It may match the first one: the plugin tells them apart by where they stand on the line, not by how they look. With <code>::</code> for both:\n<code>- #high :: call Anna :: 📅2026-10-04</code>" }
  ]
},
{
  id: "writing-rules", tab: "pkm", order: 300, heading: "Writing rules",
  intro: "The small habits: what is left when a line empties, and where the cursor waits afterwards",
  tip: "Set these once and forget them. Which Fields you have is set under <code>Fields</code>, and each Field there chooses <code>#parent #child</code> or <code>#parent/child</code> for itself. Here you choose what is left when you step past the last Value, and where the cursor ends up",
  items: [
    { kind:"dropdown", id:"cycle-end-behavior", path:"pkm.behavior.cycleEndBehavior", default:"keep-bullet",
      name:"When a line empties out", desc:"What is left behind when cycling removes the last Value",
      searchTerms:["Line Prefix after end of cycle"],
      options:[ {value:"keep-bullet",label:"Keep bullet"}, {value:"clear-prefix",label:"Clear line"} ],
      tip:"When stepping takes off the last tag and nothing else is left on the line:\n- <b>Keep bullet</b> — <code>- #done ::</code> → <code>- </code>, an empty list item ready for typing\n- <b>Clear line</b> — <code>- #done ::</code> → a blank line\nYour own text always stays: <code>- #done :: call Anna</code> → <code>- call Anna</code>" },
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
      tip:"Where the cursor <code>|</code> waits after a command. Say it stands in <code>- ca|ll Anna</code> and you add a date:\n- <b>Text end</b> — <code>- call Anna| :: 📅2026-10-04</code>, ready to keep typing\n- <b>Don't move</b> — <code>- ca|ll Anna :: 📅2026-10-04</code>\n- <b>Line end</b> — <code>- call Anna :: 📅2026-10-04|</code>\nNot sure? Keep <b>Text end</b>" },
    { kind:"text", id:"done-marker", clearable:true, path:"pkm.behavior.doneMarker.token", default:"", mono:true,
      name:"Mark ticked line", desc:"A tag or emoji added when you tick a checkbox and taken off when you untick it",
      searchTerms:["Done marker", "Checkbox marker", "Mark the line as done"],
      tip:"Type a tag or emoji. Ticking the checkbox adds it, unticking takes it off:\n- <b>✅</b> — <code>- [x] call Anna</code> → <code>- [x] call Anna :: ✅</code>\n- <b>#done</b> — a Value of <code>Type</code>, so it takes that Field’s place: <code>- [x] #todo :: call Anna</code> → <code>- [x] #done :: call Anna</code>\n- <b>Empty</b> — ticking adds nothing" },
    { kind:"dropdown", id:"done-marker-position", path:"pkm.behavior.doneMarker.panel", default:"right",
      name:"Where the tick mark goes", desc:"Before your text, or after it",
      tip:"Say the mark is <code>✅</code> and you tick <code>- [x] call Anna</code>:\n- <b>Left Block</b> — with the tags before your text: <code>- [x] ✅ :: call Anna</code>\n- <b>Right Block</b> — after your sentence: <code>- [x] call Anna :: ✅</code>\nIf the mark is a Value of one of your Fields, this setting doesn’t apply: the mark goes where that Field is",
      searchTerms:["Done marker panel"],
      visible:{ deps:["pkm.behavior.doneMarker.token"],
                test: c => String(c.get("pkm.behavior.doneMarker.token") || "").trim() !== "" },
      options:[ {value:"left",label:"Left Block"}, {value:"right",label:"Right Block"} ] },
    { kind:"toggle", id:"done-strike", path:"pkm.behavior.doneMarker.strike", default:false,
      name:"Strike through ticked line", desc:"Cross out the whole line once it carries the tick mark",
      searchTerms:["Cross out done lines"],
      visible:{ deps:["pkm.behavior.doneMarker.token"],
                test: c => String(c.get("pkm.behavior.doneMarker.token") || "").trim() !== "" },
      tip:"Only the look changes. Nothing is written into the note\n- <b>On</b> — <code>- [x] #done :: call Anna</code> shows crossed out\n- <b>Off</b> — the line looks like any other\nUnticking takes the mark off, and the strike goes with it" },
    { kind:"toggle", id:"done-dim", path:"pkm.behavior.doneMarker.visual.enabled", default:false,
      name:"Dim ticked line", desc:"Fade a line once it carries the tick mark, so your eye skips it",
      searchTerms:["Dim the lines already done"],
      visible:{ deps:["pkm.behavior.doneMarker.token"],
                test: c => String(c.get("pkm.behavior.doneMarker.token") || "").trim() !== "" },
      tip:"Only the look changes. Nothing is written into the note, and search still finds the line\n- <b>On</b> — <code>- [x] #done :: call Anna</code> fades, so your eye skips it\n- <b>Off</b> — it stays at full strength\nUnticking brings a faded line back" },
    { kind:"slider", id:"done-dim-opacity", path:"pkm.behavior.doneMarker.visual.opacity", default:65,
      min:0, max:80, step:5, unit:"%", invert:100,
      name:"Opacity of ticked line", desc:"Zero leaves the line as it is, eighty makes it barely readable",
      searchTerms:["How much of a ticked line is left"],
      tip:"How strongly a ticked line fades. Only the look changes: the text stays whole and search still finds it\n- <b>0</b> — the line looks as usual\n- <b>35</b> — clearly faded, the default\n- <b>80</b> — barely readable",
      visible:{ deps:["pkm.behavior.doneMarker.token","pkm.behavior.doneMarker.visual.enabled"],
                test: c => String(c.get("pkm.behavior.doneMarker.token") || "").trim() !== ""
                  && Boolean(c.get("pkm.behavior.doneMarker.visual.enabled")) } },
    { kind:"color", id:"done-dim-color", path:"pkm.behavior.doneMarker.visual.color", default:"",
      name:"Color of ticked line", desc:"Leave it unset to keep the color your theme gives the text",
      allowReset:true,
      searchTerms:["Color of a done line"],
      tip:"Set a color only if fading alone doesn’t make ticked lines easy to spot\n- <b>Unset</b> — <code>- [x] #done :: call Anna</code> keeps your theme’s text color, only faded\n- <b>A color</b> — the line takes your color instead, and the fade still applies on top",
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
      tip:"Say your Left Block has <code>Imp</code>, <code>Type</code>, <code>People</code>, <code>Project</code>, <code>Due</code>:\n- <b>First Field</b> — opens on <code>Imp</code>\n- <b>Middle Field</b> — opens on <code>People</code>, so neither end is far away. Handy with many Fields\n- <b>Chosen Field</b> — opens on the Field you pick for each Block in the two settings below" },
    { kind:"dropdown", id:"wheel-active-left", path:"visual.tagWheel.activeField.left", default:"",
      name:"Left Block active Field", desc:"The Field tagWheel lands on when it opens on the left",
      searchTerms:["Lead Field left"],
      options:[ {value:"",label:"First Field"} ], optionsFrom:"left-block-fields",
      visible: eq("visual.tagWheel.activeField.mode","custom"),
      tip:"You can only pick Fields that are in the Left Block\n- <b>First Field</b> — opens on the first Field on the left, say <code>Imp</code>\n- <b>People</b> — opens on <code>People</code> instead\nIf you later move the chosen Field to the right, tagWheel goes back to opening on the first Field on the left" },
    { kind:"dropdown", id:"wheel-active-right", path:"visual.tagWheel.activeField.right", default:"",
      name:"Right Block active Field", desc:"The Field tagWheel lands on when it opens on the right",
      searchTerms:["Lead Field right"],
      options:[ {value:"",label:"First Field"} ], optionsFrom:"right-block-fields",
      visible: eq("visual.tagWheel.activeField.mode","custom"),
      tip:"You can only pick Fields that are in the Right Block\n- <b>First Field</b> — opens on the first Field on the right\n- <b>Due</b> — opens on <code>Due</code> instead" },
    { kind:"dropdown", id:"wheel-opposite-block", path:"visual.tagWheel.oppositeBlock", default:"hide",
      name:"Values in the other Block", desc:"What happens to the Values you are not picking while the picker is open",
      searchTerms:["Opposite Block","Other Block","Hide values"],
      options:[ {value:"hide",label:"Hide"},
                {value:"keep",label:"Show"} ],
      tip:"Say the line is <code>- #high :: call Anna :: 📅2026-10-04</code> and you open tagWheel on the left:\n- <b>Hide</b> — the usual way: <code>:: 📅2026-10-04</code> disappears while you choose\n- <b>Show</b> — the date stays in view. The line is really changed while the picker is open, so a save at that moment writes it to the file\nClosing the picker puts the line back" },
    { kind:"dropdown", id:"wheel-selection-line", path:"visual.tagWheel.selectionLine", default:"top",
      name:"Line for a selection", desc:"Which selected line tagWheel opens on when you start it with lines selected",
      searchTerms:["Selection","Selected lines"],
      options:[ {value:"top",label:"Top line"},
                {value:"bottom",label:"Bottom line"},
                {value:"head",label:"Where selecting ended"} ],
      tip:"Say lines 2 to 5 are selected when you open tagWheel:\n- <b>Top line</b> — it opens on line 2\n- <b>Bottom line</b> — it opens on line 5\n- <b>Where selecting ended</b> — line 5 if you dragged down, line 2 if you dragged up\nPicking a Value changes only that one line. The selection stays, and <code>Esc</code> gives it back" },
    { kind:"dropdown", id:"wheel-edge", path:"visual.tagWheel.edgeMode", default:"stay",
      name:"tagWheel navigation behavior", desc:"What the arrow keys do when there is no next Field on this side",
      searchTerms:["Edge of a Block","Wrap around","Move to the next Block","At the last Field"],
      options:[ {value:"stay",label:"Stay in Block"},
                {value:"next-block",label:"Next Block"} ],
      tip:"Say you are on the last Field on the left and move on:\n- <b>Stay in Block</b> — you go back to the first Field on the left, say <code>Imp</code>\n- <b>Next Block</b> — you go on to the first Field on the right, so both Blocks work as one loop\n<code>Tab</code> switches Blocks either way. In a custom block the arrows always stay in that block" },
    { kind:"toggle", id:"wheel-custom-tab", path:"visual.tagWheel.customTab", default:false,
      name:"Switch custom blocks on Tab", desc:"Tab in a custom block’s tagWheel moves on to the next custom block",
      searchTerms:["Custom block","Tab","Next custom block"],
      visible:{ deps:["pkm.fields.order.custom"],
                test: c => Boolean(Object(c.get("pkm.fields.order.custom")).length) },
      tip:"Say you have two custom blocks, <code>Tasks</code> and <code>Notes</code>:\n- <b>On</b> — <code>Tab</code> goes <code>Tasks</code> → <code>Notes</code> → <code>Tasks</code>, in the order of your Fields list\n- <b>Off</b> — <code>Tab</code> does nothing in a custom block’s tagWheel\nWhatever you picked in the block you leave is lost, because only <code>Enter</code> saves it" }
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
      tip:"For a Field in <code>Strict</code> mode whose Value has no line start of its own:\n- <b>On</b> — a plain line becomes a list item: <code>call Anna</code> → <code>- #high :: call Anna</code>\n- <b>Off</b> — it stays as it is: <code>call Anna</code> → <code>#high :: call Anna</code>\nHeadings are never changed: <code>## Plan</code> → <code>## #high :: Plan</code>",
      seeAlso:{ id:"field-editor", label:"Each Field’s Prefix behavior is set under Fields" } },
    { kind:"toggle", id:"placement-field-prefix", path:"pkm.placement.fieldPrefixInsertOnly", default:true,
      name:"Insert only: use Field Prefix", desc:"Allow a Value to change the start of the line after all, if it has its own",
      searchTerms:["Minimal mode Prefix"],
      tip:"Some Values come with their own line start, like <code>[ ]</code> on <code>#todo</code>. For a Field in <code>Insert only</code> mode:\n- <b>On</b> — <code>- call Anna</code> → <code>- [ ] #todo :: call Anna</code>\n- <b>Off</b> — <code>- call Anna</code> → <code>- #todo :: call Anna</code>, the line start stays as it was" },
    { kind:"toggle", id:"placement-typed-tags", path:"pkm.placement.typedTagsStayText", default:true,
      name:"Keep typed tags in text", desc:"A tag or link you type between words or at the end stays your word",
      searchTerms:["Value in text", "tag in the middle"],
      tip:"Say <code>#idea</code> is a Value of <code>Type</code> and you add <code>#high</code> to <code>- call Anna #idea</code>:\n- <b>On</b> — <code>#idea</code> stays your word: <code>- #high :: call Anna #idea</code>\n- <b>Off</b> — it moves into its Block: <code>- #high #idea :: call Anna</code>\nThis works in both modes. Tags at the very start of a line always count as Values" }
  ]
},
{
  id: "prefix-priority", tab: "pkm", order: 500, heading: "Prefix priority",
  intro: "Some Values change the start of the line, like a checkbox from Status or an exclamation mark from Priority. When two of them want it at once, these rules pick the winner",
  tip: "This only matters if two of your Values both want the start of the line, say <code>#todo</code> gives <code>[ ]</code> and <code>#high</code> gives <code>[!]</code>. If not, you can skip it\n<b>Decide by</b> is the main choice. The setting at the bottom decides whether a nested Value beats its parent or the other way round",
  items: [
    { kind:"dropdown", id:"prefix-priority-decide", path:"pkm.prefixPriority.decideBy", default:"by-section",
      name:"Decide by", desc:"Settle it by the order of your Fields, or by a list of openings you rank yourself",
      searchTerms:["Main checkbox priority","Prefix Resolver"],
      options:[ {value:"by-section",label:"Field order"}, {value:"by-checkbox-list",label:"Prefix order"} ],
      tip:"Say <code>#high</code> gives <code>[!]</code>, <code>#todo</code> gives <code>[ ]</code>, and you add <code>#high</code> to <code>- [ ] #todo :: call Anna</code>:\n- <b>Field order</b> — <code>Imp</code> comes before <code>Type</code>, so you get <code>- [!] #high #todo :: call Anna</code>\n- <b>Prefix order</b> — your list of line starts decides. With <code>[ ]</code> above <code>[!]</code>: <code>- [ ] #high #todo :: call Anna</code>\nNot sure? Keep <b>Field order</b>" },
    { kind:"dropdown", id:"prefix-priority-source", path:"pkm.prefixPriority.fieldOrderSource", default:"manual",
      name:"Field order source", desc:"Use the order your Fields are already in, or arrange a separate one",
      tip:"Which list of Fields decides. Say <code>#high</code> gives <code>[!]</code> and <code>#todo</code> gives <code>[ ]</code>:\n- <b>Field order</b> — the order of your Blocks. <code>Imp</code> comes before <code>Type</code>, so <code>[!]</code> wins\n- <b>Manual</b> — its own list below. Put <code>Type</code> on top and <code>[ ]</code> wins\nNot sure? Keep <b>Field order</b>",
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
      tip:"Say <code>#task</code> gives <code>[ ]</code> and its child <code>#ready</code> gives <code>[x]</code>:\n- <b>Parent tag</b> — the broader Value wins: <code>- [ ] #task #ready :: call Anna</code>\n- <b>Child tag</b> — the more specific one wins: <code>- [x] #task #ready :: call Anna</code>",
      searchTerms:["Tag/Subtag priority"],
      options:[ {value:"tag-over-subtag",label:"Parent tag"}, {value:"subtag-over-tag",label:"Child tag"} ] }
  ]
}
];
