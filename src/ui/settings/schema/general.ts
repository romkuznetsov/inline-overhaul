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
  tip: "- <code>Read</code> — opens a guide note in your vault; it is yours to change, and the plugin never overwrites it\n- <code>Show tips</code>, <code>Show callouts</code> — hide the help boxes once you know your way around; the one-line descriptions stay",
  items: [
    { kind:"dropdown", id:"ui-language", path:"general.language", default:"en",
      options:[], optionsFrom:"languages",
      name:"Language", desc:"Of this panel and the plugin messages",
      tip:"The list shows English plus every language file in the plugin folder, and the switch works at once. Each language is a small text file there: change a line, reload the plugin, and the panel shows your words. To add a language, copy the English file under a new name and translate it. Lines you leave untranslated stay in English, never blank" },
    { kind:"toggle", id:"show-callouts", path:"general.help.showCallouts", default:true,
      name:"Show callouts", desc:"Keep the boxes that say what a tab or a block of settings is for",
      searchTerms:["Show intro boxes"],
      tip:"Callouts are the boxes with a colored edge at the top of each tab and under each block of settings. <code>Show tips</code> is a separate switch for the <code>?</code> marks. Know your way around? Turn both off; the one-line descriptions stay" },
    { kind:"toggle", id:"show-tips", path:"general.help.showTips", default:true,
      name:"Show tips", desc:"Put a ? beside anything that needs more explanation",
      tip:"Click a <code>?</code> to open a short explanation, usually with an example. Turn this off when you no longer need them; the one-line descriptions stay either way" },
    { kind:"buttons", id:"howto",
      name:"Guide", desc:"Worked examples of the things people set up first",
      tip:"The first press creates the guide note in your vault, later presses open it. Inside: which commands are worth a key, how to set up your first Fields, how tagWheel feels, and ready setups to copy. Edit, move or rename it freely — the plugin never writes over it",
      buttons:[ {label:"Read", action:"open-howto", cta:true} ] },
    { kind:"buttons", id:"changelog",
      name:"Changelog", desc:"What changed in this version, and in every one before it",
      tip:"Opens <code>CHANGELOG.md</code> in your browser: every release, newest first. The window you see after an update shows the same text for the newest release",
      buttons:[ {label:"Open", action:"open-changelog"} ] }
  ]
},
{
  id: "modules", tab: "general", order: 200, heading: "Modules",
  intro: "The plugin has four separate parts. Turn off the ones you don’t want, and they stop adding commands and stop touching your notes",
  tip: "When a part is off, its commands leave the palette, its hotkeys stop working and its settings are hidden here. Nothing is lost: turn it back on and everything is as it was. Only want the tags? Turn the other three off to keep the palette short",
  items: [
    { kind:"toggle", id:"module-navigation", path:"features.navigation.enabled", default:true,
      name:"Navigation", desc:"Move lines, text and the cursor without reaching for the mouse",
      tip:"It only moves text you already wrote: a line up, a word along, the cursor across. It never adds anything. Safe to leave on" },
    { kind:"toggle", id:"module-pkm", path:"features.pkm.enabled", default:true,
      name:"Tags & PKM", desc:"Set up your PKM tags, wikilinks and emoji elements, and insert them inline with one key",
      tip:"This part puts tags and dates on a line and steps them forward with a keypress. Turning it off keeps everything you already wrote; only the keys stop working" },
    { kind:"toggle", id:"module-transform", path:"features.transform.enabled", default:true,
      name:"Transform", desc:"Turn an inline entry into a note, with templates, YAML properties, rules and more",
      tip:"On here alone, nothing happens yet. To make notes you also need the switch on the Transform tab, because this is the only part that writes new files" },
    { kind:"toggle", id:"module-visual", path:"features.visual.enabled", default:true,
      name:"Visual", desc:"Customize and beautify your inline text with tag colors, Bars and much more",
      tip:"Looks only: your notes keep exactly the same text, and other apps show it plain. Off, the Visual tab goes back to your theme’s look, except the tagWheel colors, which the panel needs to stay readable" }
  ]
}
];
