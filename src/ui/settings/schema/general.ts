/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Тексты согласованы заказчиком и совпадают с Приложением B PRD.
 */

import type { SettingsGroup } from "../types.ts";
import { on } from "../types.ts";
import { brandMark } from "../custom/brand_mark.ts";
import { callout } from "../custom/callouts.ts";

export const GENERAL_GROUPS: readonly SettingsGroup[] = [
{ id: "brand-intro",     tab: "general",    order: 5, heading: "inlineOverhaul",
  items: [
    { kind:"custom", id:"brand-mark", render: brandMark }
  ] },
{ id: "general-intro",   tab: "general",    order: 10, heading: "Before you start",
  items: [
    { kind:"custom", id:"general-callout", render: callout("general") }
  ],
  visible: on("general.help.showCallouts") },
{
  id: "help", tab: "general", order: 100, heading: "Help",
  intro: "The language of the panel, where to start, and how much help you want along the way",
  tip: "Where to start and how much help you see\n- <code>Read</code> — opens the guide note <code>inlineOverhaul Guide.md</code> in your vault. It is yours to change, and the plugin never writes over it\n- <code>Show tips</code>, <code>Show callouts</code> — hide the help boxes once you know your way around. The one-line descriptions stay",
  items: [
    { kind:"dropdown", id:"ui-language", path:"general.language", default:"en",
      options:[], optionsFrom:"languages",
      name:"Language", desc:"Of this panel and the plugin messages",
      tip:"The language of this panel and of the plugin messages. The switch works at once\n- <b>English</b> — always in the list\n- <b>Other languages</b> — one small text file each in the plugin folder. Change a line there, reload the plugin, and the panel shows your words\nTo add a language, copy the English file under a new name and translate it. Lines you leave untranslated stay in English, never blank" },
    { kind:"toggle", id:"show-callouts", path:"general.help.showCallouts", default:true,
      name:"Show callouts", desc:"Keep the boxes that say what a tab or a block of settings is for",
      searchTerms:["Show intro boxes"],
      tip:"Callouts are the boxes with a colored edge at the top of each tab and under each block of settings\n- <b>On</b> — the boxes show\n- <b>Off</b> — all of them hide, the one at the top of each tab too. The one-line descriptions stay\nThe <code>?</code> marks have their own switch, <code>Show tips</code>" },
    { kind:"toggle", id:"show-tips", path:"general.help.showTips", default:true,
      name:"Show tips", desc:"Put a ? beside anything that needs more explanation",
      tip:"- <b>On</b> — a <code>?</code> stands beside settings that need more explanation. Click it for a short tip, usually with an example\n- <b>Off</b> — no <code>?</code> marks. The one-line descriptions stay" },
    { kind:"buttons", id:"howto",
      name:"Guide", desc:"Worked examples of the things people set up first",
      tip:"- <code>Read</code> — the first press creates the note <code>inlineOverhaul Guide.md</code> in your vault, later presses open it\nInside: which commands are worth a key, how to set up your first Fields, how tagWheel feels, and ready setups to copy\nEdit it freely, the plugin never writes over it. If you move or rename it, the next press makes a fresh copy",
      buttons:[ {label:"Read", action:"open-howto", cta:true} ] },
    { kind:"buttons", id:"changelog",
      name:"Changelog", desc:"What changed in this version, and in every one before it",
      tip:"- <code>Open</code> — opens <code>CHANGELOG.md</code> in your browser: every release, newest first\nThe window you see after an update shows the same text for the newest release",
      buttons:[ {label:"Open", action:"open-changelog"} ] }
  ]
},
{
  id: "modules", tab: "general", order: 200, heading: "Modules",
  intro: "The plugin has four separate parts. Turn off the ones you don’t want, and they stop adding commands and stop touching your notes",
  tip: "Each part turns on and off on its own\n- <b>On</b> — its commands and hotkeys work, and its tab shows all its settings\n- <b>Off</b> — a command or hotkey only shows a message such as <code>Navigation is switched off</code>, and its tab shows just the switch. Nothing is lost: turn it back on and everything is as it was",
  items: [
    { kind:"toggle", id:"module-navigation", path:"features.navigation.enabled", default:true,
      name:"Navigation", desc:"Move lines, text and the cursor without reaching for the mouse",
      tip:"It only moves text you already wrote: a line up, a word along, the cursor across. It never adds anything\n- <b>On</b> — the Navigation commands and their hotkeys work\n- <b>Off</b> — a press only shows <code>Navigation is switched off</code>\nSafe to leave on" },
    { kind:"toggle", id:"module-pkm", path:"features.pkm.enabled", default:true,
      name:"Tags & PKM", desc:"Set up your PKM tags, wikilinks and emoji elements, and insert them inline with one key",
      tip:"This part puts tags, links and dates on a line and steps them forward with a keypress\n- <b>On</b> — tagWheel and the Field commands write on the line\n- <b>Off</b> — a press only shows <code>Tags & PKM is switched off</code>. Everything you already wrote stays as it is" },
    { kind:"toggle", id:"module-transform", path:"features.transform.enabled", default:true,
      name:"Transform", desc:"Turn an inline entry into a note, with templates, YAML properties, rules and more",
      tip:"This is the only part that writes new files\n- <b>On</b> — still nothing happens until you also turn on <code>Inline to note</code> on the Transform tab\n- <b>Off</b> — <code>Transform inline to note</code> only shows <code>Transform is switched off</code>" },
    { kind:"toggle", id:"module-visual", path:"features.visual.enabled", default:true,
      name:"Visual", desc:"Customize and beautify your inline text with tag colors, Bars and much more",
      tip:"Looks only: your notes keep exactly the same text, and other apps show it plain\n- <b>On</b> — tag colors, Bars and the rest of the Visual tab show while you write\n- <b>Off</b> — the editor goes back to your theme’s look. The tagWheel colors stay, because the panel needs them to stay readable" }
  ]
}
];
