/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Тексты согласованы заказчиком и совпадают с Приложением B PRD.
 * Не перенесено (свои блоки и кнопки без действий, З8):
 *   inline-to-note: i2n-floating (toggle, нет декорации CM6), i2n-button-preview (custom)
 */

import type { SettingsGroup } from "../types.ts";
import { on, eq } from "../types.ts";
import { callout } from "../custom/callouts.ts";
import { smartRules } from "../custom/smart_rules.ts";

export const TRANSFORM_GROUPS: readonly SettingsGroup[] = [
{ id: "transform-intro", tab: "transform",  order: 50, heading: "Before you start",
  items: [
    { kind:"custom", id:"transform-callout", render: callout("transform") }
  ] },
{
  id: "inline-to-note", tab: "transform", order: 100, heading: "Inline to note",
  tip: "One keypress does three things in a row: it works out which note to use, it puts your text into that note, and it tidies up the line you pressed on. The groups below follow that order, so you can read down the page and see the whole journey. Nothing runs until <code>Inline to note</code> just below is switched on",
  intro: "You write a thought on one line. Press the key, and that line becomes a note of its own \u2014 or gets added to a note you already have. The line stays where it was, with a link to the new note in its place if you want one",
  commands: ["Transform inline to note"],
  items: [
    { kind:"toggle", id:"i2n-enabled", path:"transform.inline2note.enabled", default:true,
      name:"Inline to note", desc:"Allow this to create notes and add to notes you already have",
      searchTerms:["Inline2Note enabled"],
      tip:"This is the switch that lets the plugin write to your vault. Everything else on this tab only decides how. Make a backup and try it on a note you do not mind breaking: one keypress can add a note, change a note, and edit the line you were on" },
    { kind:"text", id:"i2n-templates-folder", path:"transform.inline2note.templatesFolder", default:"Templates",
      name:"Templates folder", desc:"The folder your note templates live in",
      tip:"A template is an ordinary note that a new note starts out as a copy of. Whatever you keep in this folder shows up in the lists below",
      visible: on("transform.inline2note.enabled") },
    { kind:"text", id:"i2n-output-folder", path:"transform.inline2note.outputFolder", default:"",
      name:"New notes folder", desc:"Where to put the notes this creates. Leave it empty to keep them next to the note you are in",
      searchTerms:["Output folder for new notes"], visible: on("transform.inline2note.enabled") },
    { kind:"dropdown", id:"i2n-default-template", path:"transform.inline2note.defaultTemplate", default:"task.md",
      name:"Default template", desc:"The template on creation of new note when no special rules apply (see <code>Smart Rules</code> below)",
      tip:"You can set up rules further down that pick a different template for certain lines. This one is used for everything else",
      visible: on("transform.inline2note.enabled"),
      options:[ {value:"",label:"None"}, {value:"task.md",label:"task.md"}, {value:"meeting.md",label:"meeting.md"} ] }
  ]
},
{
  id: "naming", tab: "transform", order: 200, heading: "Naming",
  intro: "The new note needs a name. This block defines how to choose a name of a new note",
  tip: "Three ways of finding one are tried in turn, and the first that works wins: the text between your chosen brackets, then a heading on the line, then simply the first few words",
  visible: on("transform.inline2note.enabled"),
  items: [
    { kind:"dropdown", id:"naming-mode", path:"transform.inline2note.noteName.mode", default:"auto",
      name:"Note name", desc:"Take the name from the line, or stop and ask you for it",
      tip:"<b>Ask me</b> opens a small box with the suggested name already filled in, so you can accept it or type your own",
      searchTerms:["Note name mode"],
      options:[ {value:"auto",label:"From the line"}, {value:"manual",label:"Ask me"} ] },
    { kind:"text", id:"naming-delimiters", path:"transform.inline2note.noteName.delimiters", default:"()", mono:true,
      name:"Name brackets", desc:"Two characters. Whatever you put between them becomes the name",
      searchTerms:["Title delimiters", "Explicit name delimiters"],
      tip:"Put <code>()</code> here, write the line <code>- call (Anna about the contract) || text</code>, and you get a note called <b>Anna about the contract</b>. Leave this box empty and the name comes from the heading or the first words instead" },
    { kind:"number", id:"naming-word-count", path:"transform.inline2note.noteName.wordCount", default:5, min:1, max:20,
      name:"Words to use instead", desc:"How many of the first words to use when there are no brackets",
      searchTerms:["Auto title word count"],
      tip:"Set this to 3 and the line <code>- draft the settings prototype today</code> becomes a note called <b>draft the settings</b>. Too few and the names all look alike; too many and they get unwieldy" },
    { kind:"dropdown", id:"naming-collision", path:"transform.inline2note.nameCollision.mode", default:"new_note",
      name:"If the name is taken", desc:"What to do when you already have a note with that name",
      searchTerms:["Name collision mode"],
      options:[ {value:"new_note",label:"Create a second note"}, {value:"add_to_note",label:"Add to the existing one"},
                {value:"overwrite",label:"Replace what is in it"} ],
      tip:"<b>Create a second note</b> adds a number to the name and never touches what you already wrote \u2014 the safe choice. <b>Add to the existing one</b> is what you want for a running log. <b>Replace what is in it</b> throws the old contents away, and this plugin cannot give them back" }
  ]
},
{
  id: "note-content", tab: "transform", order: 300, heading: "Note content",
  intro: "What the note looks like inside: where your text goes, and what sits above it",
  visible: on("transform.inline2note.enabled"),
  items: [
    { kind:"dropdown", id:"content-position", path:"transform.inline2note.placement.position", default:"beginning",
      name:"Where to put the text", desc:"At the top of the note, or after whatever is already there",
      searchTerms:["Where to place inline text?"],
      options:[ {value:"beginning",label:"At the beginning"}, {value:"end",label:"At the end"} ],
      tip:"If you are adding to a note over and over \u2014 a diary, a log of calls \u2014 pick <b>at the end</b> so the entries stay in the order you wrote them. For a brand new note it makes no difference" },
    { kind:"dropdown", id:"content-header-mode", path:"transform.inline2note.placement.headerMode", default:"custom",
      name:"Line above the text", desc:"Something to put above your text so entries stay apart",
      tip:"Useful when a note collects many entries: a date, or a word like <code>## Captured</code>, keeps them from running together",
      searchTerms:["Inserted block header"],
      options:[ {value:"custom",label:"Fixed text"}, {value:"datetime",label:"Date and time"},
                {value:"none",label:"Nothing"} ] },
    { kind:"text", id:"content-header-text", path:"transform.inline2note.placement.customHeader", default:"## Captured", mono:true,
      name:"What it says", desc:"Typed into the note exactly as you write it here",
      tip:"Start it with <code>##</code> and Obsidian treats it as a heading you can fold. Without the hashes it is just a line of text",
      visible: eq("transform.inline2note.placement.headerMode","custom") },
    { kind:"text", id:"content-datetime", path:"transform.inline2note.placement.datetimeFormat", default:"## YYYY-MM-DD HH:mm", mono:true,
      name:"Date format", desc:"Today\u2019s date, written the way you set out here",
      searchTerms:["Datetime header format"],
      visible: eq("transform.inline2note.placement.headerMode","datetime"),
      tip:"<code>YYYY</code> is the year, <code>MM</code> the month, <code>DD</code> the day, and <code>HH mm ss</code> the time. Anything else you type is kept as it is, so <code>## YYYY-MM-DD</code> gives you a heading like <b>## 2026-08-21</b>, and adding a third hash makes it a smaller heading" },
    { kind:"dropdown", id:"content-sublines", path:"transform.inline2note.sublines", default:"stay",
      name:"Lines indented under it", desc:"Leave them where they are, or take them into the note too",
      tip:"Say the line has three sub-points under it. <b>Take them along</b> moves all four into the note and leaves the place they came from empty. <b>Leave them</b> moves only the line you pressed on",
      searchTerms:["Sublines behavior"],
      options:[ {value:"stay",label:"Leave them"}, {value:"remove",label:"Take them along"} ] },
    { kind:"toggle", id:"content-open", path:"transform.inline2note.openTarget", default:true,
      name:"Open the note afterwards", desc:"Jump straight to the note once it is written",
      tip:"Handy while you are still setting this up, so you can see what came out. Turn it off once you trust it and you can keep writing without losing your place",
      searchTerms:["Open transformed note"] }
  ]
},
{
  id: "source-line", tab: "transform", order: 400, heading: "Source line",
  intro: "What happens to the line you pressed on, once the note is safely written",
  visible: on("transform.inline2note.enabled"),
  items: [
    { kind:"toggle", id:"source-link", path:"transform.inline2note.sourceProcessing.replaceWithLink", default:true,
      name:"Leave a link behind", desc:"Put a link to the new note where your text used to be",
      searchTerms:["Replace payload with note link"],
      tip:"On, the line becomes a tidy pointer: click the link and you are in the note. Off, the text stays where it is \u2014 which means you can press again by mistake and get a second note. The marker below is the usual way to guard against that" },
    { kind:"text", id:"source-marker", path:"transform.inline2note.sourceProcessing.token", default:"", mono:true,
      name:"Mark the line as done", desc:"A word or tag added to the line so you can see it has been handled",
      searchTerms:["Processed token"],
      tip:"Type something like <code>#moved</code>. Afterwards you can search for it to find everything you have filed, or hide those lines from a list of things still to do. Leave the box empty and nothing is added" },
    { kind:"dropdown", id:"source-marker-position", path:"transform.inline2note.sourceProcessing.panel", default:"right",
      name:"Where the mark goes", desc:"Before your text, or after it",
      searchTerms:["Processed token panel"],
      visible:{ deps:["transform.inline2note.sourceProcessing.token"],
                test: c => String(c.get("transform.inline2note.sourceProcessing.token") || "").trim() !== "" },
      options:[ {value:"left",label:"Left, before the text"}, {value:"right",label:"Right, after the text"} ] }
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
