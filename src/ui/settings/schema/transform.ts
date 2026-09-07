/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Тексты согласованы заказчиком и совпадают с Приложением B PRD.
 */

import type { SettingsGroup } from "../types.ts";
import { on, eq } from "../types.ts";
import { callout } from "../custom/callouts.ts";
import { floatingButton, sourcePreview } from "../custom/previews.ts";
import { smartRules } from "../custom/smart_rules.ts";
import { sourceFields } from "../custom/source_fields.ts";

export const TRANSFORM_GROUPS: readonly SettingsGroup[] = [
{ id: "transform-intro", tab: "transform",  order: 50, heading: "Before you start",
  items: [
    { kind:"custom", id:"transform-callout", render: callout("transform") }
  ],
  visible: on("general.help.showCallouts") },
{
  id: "inline-to-note", tab: "transform", order: 100, heading: "Inline to note",
  tip: "One keypress does three things in a row: it works out which note to use, it puts your text into that note, and it tidies up the line you pressed on. The groups below follow that order, so you can read down the page and see the whole journey. Nothing runs until <code>Inline to note</code> just below is switched on",
  intro: "You write a thought on one line. Press the key, and that line becomes a note of its own \u2014 or gets added to a note you already have. The line stays where it was, with a link to the new note in its place if you want one",
  commands: ["Transform inline to note"],
  items: [
    { kind:"toggle", id:"i2n-enabled", path:"transform.inline2note.enabled", default:false,
      name:"Inline to note", desc:"Allow this to create notes and add to notes you already have",
      searchTerms:["Inline2Note enabled"],
      tip:"This is the switch that lets the plugin write to your vault. Everything else on this tab only decides how. Make a backup and try it on a note you do not mind breaking: one keypress can add a note, change a note, and edit the line you were on" },
    { kind:"folder", id:"i2n-output-folder", path:"transform.inline2note.outputFolder", default:"",
      name:"New notes folder", desc:"Where to put the notes this creates. Leave it empty to keep them next to the note you are in",
      placeholder:"Next to the note you are in",
      tip:"Start typing and Obsidian suggests the folders you already have; a name it does not know is kept as it is, and the folder is made the first time a note goes into it. Left empty, a new note lands beside the note you pressed the key in",
      searchTerms:["Output folder for new notes"], visible: on("transform.inline2note.enabled") },
    { kind:"folder", id:"i2n-templates-folder", path:"transform.inline2note.templatesFolder", default:"",
      name:"Templates folder", desc:"The folder your note templates live in",
      placeholder:"Pick or type a folder",
      tip:"A template is an ordinary note that a new note starts out as a copy of. Whatever you keep in this folder shows up in the lists below. Start typing and Obsidian suggests the folders you already have; a name it does not know is kept as it is, and the folder is made the first time it is needed",
      visible: on("transform.inline2note.enabled") },
    { kind:"dropdown", id:"i2n-default-template", path:"transform.inline2note.defaultTemplate", default:"",
      name:"Default template", desc:"The template on creation of new note when no special rules apply (see <code>Smart Rules</code> below)",
      tip:"You can set up rules further down that pick a different template for certain lines. This one is used for everything else. The list holds the notes from the folder above and nothing else \u2014 set that folder first, and the list fills itself",
      visible: on("transform.inline2note.enabled"),
      /* Только заметки из назначенной папки (1.6.2.4). Постоянных строк
         нет: что показать, когда папки нет, решает сам источник. */
      options:[], optionsFrom:"templates" },
    { kind:"toggle", id:"i2n-floating", path:"transform.inline2note.floatingButton", default:false,
      name:"Floating button", desc:"Put a small button at the end of the line you are on",
      searchTerms:["Flying button"],
      visible: on("transform.inline2note.enabled"),
      tip:"Click it and the line turns into a note, the same as pressing the key would. The button is only drawn on screen \u2014 it is never saved into your note, so nothing changes if you open the file elsewhere",
      seeAlso:{ id:"i2n-button-preview", label:"See where it appears" } },
    { kind:"slider", id:"i2n-floating-gap", path:"transform.inline2note.floatingButtonGap", default:12,
      min:0, max:40, step:1, unit:"px",
      name:"Distance from the text", desc:"How much room to leave between the line and the button",
      searchTerms:["Floating button gap","Button offset"],
      visible:{ deps:["transform.inline2note.enabled","transform.inline2note.floatingButton"],
                test: c => Boolean(c.get("transform.inline2note.enabled") && c.get("transform.inline2note.floatingButton")) },
      tip:"The button is drawn after the last character of the line you are on, and on a short line it can sit close enough to read as part of the text. This is how much room to leave between them. At <code>0</code> it sits right against the text; the widest setting puts it a whole word away",
      seeAlso:{ id:"i2n-button-preview", label:"The preview below moves with it" } },
    { kind:"custom", id:"i2n-button-preview", render: floatingButton,
      visible:{ deps:["transform.inline2note.enabled","transform.inline2note.floatingButton"],
                test: c => Boolean(c.get("transform.inline2note.enabled") && c.get("transform.inline2note.floatingButton")) } },
    { kind:"toggle", id:"content-open", path:"transform.inline2note.openTarget", default:false,
      name:"Open note after creation", desc:"Jump straight to the note once it is written",
      tip:"Handy while you are still setting this up, so you can see what came out. Turn it off once you trust it and you can keep writing without losing your place",
      searchTerms:["Open transformed note", "Open the note afterwards"],
      visible: on("transform.inline2note.enabled") }
  ]
},
{
  id: "naming", tab: "transform", order: 200, heading: "New note naming",
  intro: "The new note needs a name. This block defines how to choose a name of a new note",
  tip: "Three ways of finding one are tried in turn, and the first that works wins: the text between your chosen brackets, then a heading on the line, then simply the first few words",
  visible: on("transform.inline2note.enabled"),
  items: [
    { kind:"dropdown", id:"naming-mode", path:"transform.inline2note.noteName.mode", default:"auto",
      name:"Note name", desc:"Take the name from the line, or stop and ask you for it",
      tip:"<b>Ask me</b> opens a small box with the suggested name already filled in, so you can accept it or type your own",
      searchTerms:["Note name mode"],
      options:[ {value:"auto",label:"From the line"}, {value:"manual",label:"Ask me"} ] },
    { kind:"text", id:"naming-delimiters", path:"transform.inline2note.noteName.delimiters", default:"[]", mono:true,
      name:"Name placeholders", desc:"Two characters. Whatever you put between them becomes the name",
      searchTerms:["Title delimiters", "Explicit name delimiters", "Name brackets"],
      tip:"Put <code>()</code> here, write the line <code>- call (Anna about the contract) || text</code>, and you get a note called <b>Anna about the contract</b>. Leave this box empty and the name comes from the heading or the first words instead" },
    { kind:"number", id:"naming-word-count", path:"transform.inline2note.noteName.wordCount", default:6, min:1, max:20,
      name:"Words to use instead", desc:"How many of the first words to use when there are no brackets",
      searchTerms:["Auto title word count"],
      tip:"Set this to 3 and the line <code>- draft the settings prototype today</code> becomes a note called <b>draft the settings</b>. Too few and the names all look alike; too many and they get unwieldy" },
    { kind:"dropdown", id:"naming-collision", path:"transform.inline2note.nameCollision.mode", default:"new_note",
      name:"If the name already taken", desc:"What to do when you already have a note with that name",
      searchTerms:["Name collision mode", "If the name is taken"],
      options:[ {value:"new_note",label:"Create a second note"}, {value:"add_to_note",label:"Add to the existing one"},
                {value:"overwrite",label:"Replace what is in it"} ],
      tip:"<b>Create a second note</b> adds a number to the name and never touches what you already wrote \u2014 the safe choice. <b>Add to the existing one</b> is what you want for a running log. <b>Replace what is in it</b> throws the old contents away, and this plugin cannot give them back" }
  ]
},
{
  id: "note-content", tab: "transform", order: 300, heading: "Note content",
  intro: "What the note looks like inside: where your text goes, and what sits above it",
  tip: "Two decisions live here. The first is where in the note your line lands — at the top, or after whatever is already there, which is what you want when one note collects many entries. The second is what goes on the line above it, so entries in a collecting note do not run together: a date, a fixed word of your own, or nothing at all. The rest of the note comes from the template, and the template is chosen further up",
  visible: on("transform.inline2note.enabled"),
  items: [
    { kind:"dropdown", id:"content-position", path:"transform.inline2note.placement.position", default:"end",
      name:"Where to put the text", desc:"At the top of the note, or after whatever is already there",
      searchTerms:["Where to place inline text?"],
      options:[ {value:"beginning",label:"At the beginning"}, {value:"end",label:"At the end"} ],
      tip:"If you are adding to a note over and over \u2014 a diary, a log of calls \u2014 pick <b>at the end</b> so the entries stay in the order you wrote them. For a brand new note it makes no difference" },
    { kind:"dropdown", id:"content-header-mode", path:"transform.inline2note.placement.headerMode", default:"datetime",
      name:"Line above the text", desc:"Something to put above your text so entries stay apart",
      tip:"Useful when a note collects many entries: a date, or a word of your own, keeps them from running together. Whether that line is a heading is a separate question, and the row below answers it",
      searchTerms:["Inserted block header"],
      options:[ {value:"custom",label:"Fixed text"}, {value:"datetime",label:"Date and time"},
                {value:"none",label:"Nothing"} ] },
    { kind:"dropdown", id:"content-header-level", path:"transform.inline2note.placement.headerLevel", default:"3",
      name:"Line above is header", desc:"Make that line a heading you can fold, or leave it as plain text",
      tip:"A heading can be folded, shows up in the outline, and is what you want when one note collects many entries. The number is how deep the heading sits: <code>1</code> is the biggest. You do not type the hashes yourself \u2014 this row puts them in, so the boxes below hold only the text",
      visible:{ deps:["transform.inline2note.placement.headerMode"],
                test: c => String(c.get("transform.inline2note.placement.headerMode") || "") !== "none" },
      options:[ {value:"0",label:"No (plain text)"}, {value:"1",label:"1"}, {value:"2",label:"2"},
                {value:"3",label:"3"}, {value:"4",label:"4"}, {value:"5",label:"5"}, {value:"6",label:"6"} ] },
    { kind:"text", id:"content-header-text", path:"transform.inline2note.placement.customHeader", default:"Captured", mono:true,
      name:"Text of the line above", desc:"Typed into the note exactly as you write it here",
      tip:"Just the words \u2014 hashes are added by <code>Line above is header</code> above, and any you type here are taken back out",
      visible: eq("transform.inline2note.placement.headerMode","custom") },
    { kind:"text", id:"content-datetime", path:"transform.inline2note.placement.datetimeFormat", default:"YYYY-MM-DD HH:mm", mono:true,
      name:"Date format", desc:"Today\u2019s date, written the way you set out here",
      searchTerms:["Datetime header format"],
      visible: eq("transform.inline2note.placement.headerMode","datetime"),
      tip:"<code>YYYY</code> is the year, <code>MM</code> the month, <code>DD</code> the day, and <code>HH mm ss</code> the time. Anything else you type is kept as it is, so <code>YYYY-MM-DD</code> gives you <b>2026-08-21</b>. Whether that line is a heading is decided by <code>Line above is header</code> above" }
  ]
},
{
  id: "source-line", tab: "transform", order: 400, heading: "Source line",
  intro: "What happens to the line you pressed on, once the note is safely written",
  tip: "The note is written first, and only then is your line touched, so nothing is lost if the writing fails. Two things can happen to it: your text can be swapped for a link to the new note, and a marker of your choosing can be added so you can see at a glance that this line has already been filed. Both are optional, but leaving both off means the line looks untouched and you can press again by mistake and get a second note",
  visible: on("transform.inline2note.enabled"),
  items: [
    { kind:"custom", id:"source-preview", render: sourcePreview },
    { kind:"dropdown", id:"content-sublines", path:"transform.inline2note.sublines", default:"stay",
      name:"Sub-lines (tree) behavior", desc:"Leave them where they are, or take them into the note too",
      tip:"Say the line has three sub-points under it. <b>Take them along</b> moves all four into the note and leaves the place they came from empty. <b>Leave them</b> moves only the line you pressed on",
      searchTerms:["Sublines behavior"],
      options:[ {value:"stay",label:"Leave them"}, {value:"remove",label:"Take them along"} ],
      visible: on("transform.inline2note.enabled") },
    { kind:"dropdown", id:"source-text", path:"transform.inline2note.sourceProcessing.text", default:"remove",
      name:"What happens with current line", desc:"The text goes into the note either way \u2014 this is about the line you pressed on",
      searchTerms:["What happens to your text"],
      options:[ {value:"remove",label:"Take it away"}, {value:"leave",label:"Leave it"},
                {value:"leave_named",label:"Leave it, but not the name"},
                {value:"words",label:"Keep the first words"} ],
      tip:"<b>Take it away</b> leaves the line short and tidy, and with the link below it still points at what you wrote. <b>Leave it</b> keeps the line readable on its own \u2014 useful when the note is an addition, not a move, and it is the one choice that keeps every word, including the words the name was made of. <b>Leave it, but not the name</b> keeps the rest of your text and lets the link stand where the name came from, so nothing is said twice. <b>Keep the first words</b> does the same and trims what is left to the number of words below. Sub-lines are a separate question, and the row above answers it",
      visible: on("transform.inline2note.enabled") },
    { kind:"number", id:"source-keep-words", path:"transform.inline2note.sourceProcessing.keepWords", default:3, min:1, max:20,
      name:"Words to keep", desc:"How much of the line stays behind",
      tip:"Counted from what is left of your text once the words that became the note name are gone \u2014 the link to the note stands where they were. The rest goes into the note and leaves the line. A line whose whole text became the name keeps the link alone: there is nothing left to count",
      visible: eq("transform.inline2note.sourceProcessing.text","words") },
    { kind:"note", id:"source-fields-head",
      name:"Fields to keep", desc:"Which Fields stay on the line you pressed on",
      tip:"Everything you tick here is left behind on the line; everything you do not goes into the note with the text. A Field you keep is still written into the note as well — keeping it does not take it away from the note, it only leaves a copy where you were. Ticking nothing leaves the line with your text and the marker and nothing else",
      visible: on("transform.inline2note.enabled") },
    { kind:"custom", id:"source-fields", render: sourceFields,
      visible: on("transform.inline2note.enabled") },
    { kind:"toggle", id:"source-link", path:"transform.inline2note.sourceProcessing.replaceWithLink", default:true,
      name:"Insert wikilink in current line", desc:"Put a link to the new note on the line you pressed on",
      searchTerms:["Replace payload with note link", "Leave a link behind"],
      tip:"On, the line keeps a pointer: click the link and you are in the note. Off with the text taken away, nothing on the line says where it went \u2014 and you can press again by mistake and get a second note. The marker below is the usual way to guard against that" },
    { kind:"text", id:"source-marker", path:"transform.inline2note.sourceProcessing.token", default:"#processed", mono:true,
      name:"Mark transformed line", desc:"A word or tag added to the line so you can see it has been handled",
      searchTerms:["Processed token", "Mark the line as done"],
      tip:"Type something like <code>#moved</code>. Afterwards you can search for it to find everything you have filed, or hide those lines from a list of things still to do. Leave the box empty and nothing is added" },
    { kind:"dropdown", id:"source-marker-position", path:"transform.inline2note.sourceProcessing.panel", default:"right",
      name:"Where the mark goes", desc:"Before your text, or after it",
      searchTerms:["Processed token panel"],
      visible:{ deps:["transform.inline2note.sourceProcessing.token"],
                test: c => String(c.get("transform.inline2note.sourceProcessing.token") || "").trim() !== "" },
      options:[ {value:"left",label:"Left Block"}, {value:"right",label:"Right Block"} ] },
    { kind:"toggle", id:"source-dim", path:"transform.inline2note.sourceProcessing.visual.enabled", default:false,
      name:"Dim transformed line", desc:"Fade a line once it carries the mark above, so your eye skips it",
      searchTerms:["Dim the lines already filed"],
      visible:{ deps:["transform.inline2note.sourceProcessing.token"],
                test: c => String(c.get("transform.inline2note.sourceProcessing.token") || "").trim() !== "" },
      tip:"A page you have worked through fills up with lines that <code>Inline to note</code> has already taken, and they still read as loudly as the rest. Faded, they stay where they are \u2014 you can find them, search them, undo them \u2014 but stop competing for attention. Only the look changes: nothing is written into the note, and taking the mark off a line by hand brings it back to full strength" },
    { kind:"slider", id:"source-dim-opacity", path:"transform.inline2note.sourceProcessing.visual.opacity", default:65,
      min:0, max:80, step:5, unit:"%", invert:100,
      name:"Opacity of transformed line", desc:"Zero leaves the line as it is, eighty makes it barely readable",
      searchTerms:["How much is left"],
      tip:"How far the line fades. It is only a look: the text stays whole, search still finds it, and <code>Undo</code> still works. Pick as little as lets your eye skip the line \u2014 too much and you stop noticing a line you still have to fix",
      visible:{ deps:["transform.inline2note.sourceProcessing.token","transform.inline2note.sourceProcessing.visual.enabled"],
                test: c => String(c.get("transform.inline2note.sourceProcessing.token") || "").trim() !== ""
                  && Boolean(c.get("transform.inline2note.sourceProcessing.visual.enabled")) } },
    { kind:"color", id:"source-dim-color", path:"transform.inline2note.sourceProcessing.visual.color", default:"",
      name:"Color of transformed line", desc:"Leave it unset to keep the color your theme gives the text",
      allowReset:true,
      searchTerms:["Color of a filed line"],
      tip:"Set this only if fading alone is not enough to tell a taken line at a glance. A color of your own is read instead of the theme one, and the fade above still applies to it",
      visible:{ deps:["transform.inline2note.sourceProcessing.token","transform.inline2note.sourceProcessing.visual.enabled"],
                test: c => String(c.get("transform.inline2note.sourceProcessing.token") || "").trim() !== ""
                  && Boolean(c.get("transform.inline2note.sourceProcessing.visual.enabled")) } }
  ]
},
{
  id: "smart-rules", tab: "transform", order: 500, heading: "Smart Rules",
  intro: "Different kinds of line deserve different notes. A rule spots a kind of line and picks the template for it",
  tip: "Rules are read from the top, the first one that fits is used, and anything that fits none of them gets the default template. So put your narrow rules above your broad ones, or the broad one will answer first. Drag a rule by its handle to change which one is tried first",
  visible: on("transform.inline2note.enabled"),
  items: [
    { kind:"custom", id:"smart-rules-list", render: smartRules }
  ]
}
];
