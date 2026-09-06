/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Тексты согласованы заказчиком и совпадают с Приложением B PRD.
 */

import type { SettingsGroup } from "../types.ts";
import { on } from "../types.ts";
import { callout } from "../custom/callouts.ts";

export const GENERAL_GROUPS: readonly SettingsGroup[] = [
{ id: "general-intro",   tab: "general",    order: 10, heading: "Before you start",
  items: [
    { kind:"custom", id:"general-callout", render: callout("general") }
  ],
  visible: on("general.help.showCallouts") },
{
  id: "language", tab: "general", order: 50, heading: "Language",
  intro: "The panel, its tips and the messages this plugin shows can speak another language, and the words behind them live in a file you can edit yourself",
  tip: "Every visible line of this panel has a name of its own, and the words behind those names sit in a small text file inside the plugin folder \u2014 one file per language. Change a line there, reload the plugin, and the panel says what you wrote: rewording a setting is no longer something you have to ask for. To add a language, copy the English file under a new name and translate the right-hand side. Anything you leave alone keeps its English wording, so a half-finished translation is still worth using",
  items: [
    { kind:"dropdown", id:"ui-language", path:"general.language", default:"en",
      options:[], optionsFrom:"languages",
      name:"Language", desc:"What language this panel and the plugin messages speak",
      tip:"The list holds English plus every language file found in the plugin folder, and it is built from the files themselves \u2014 nothing has to be registered anywhere. Switching takes effect at once, without a reload. A line that has no translation yet keeps its English wording rather than showing you a blank" }
  ]
},
{
  id: "help", tab: "general", order: 100, heading: "Help",
  intro: "Where to start, and how much hand-holding you want along the way",
  tip: "<code>Read</code> writes a guide into your vault the first time you press it and opens it every time after, and the note is yours from then on — the plugin never overwrites it. <code>Show tips</code> controls these very boxes: off, the panel keeps only the one-line descriptions, which is what you want once you know your way around",
  items: [
    { kind:"buttons", id:"howto",
      name:"Guide", desc:"Worked examples of the things people set up first",
      tip:"<code>Read</code> writes the guide into your vault the first time you press it, and opens it every time " +
          "after that. Inside is the practical side: which commands are worth a key, how to lay out your first few " +
          "Fields, what TagWheel feels like once it is set up, and a couple of complete setups you can copy. From " +
          "then on the note is yours — scribble in it, move it, rename it. The plugin never writes over it again, " +
          "so nothing you add there can be lost by pressing this button",
      buttons:[ {label:"Read", action:"open-howto", cta:true} ] },
    { kind:"toggle", id:"show-callouts", path:"general.help.showCallouts", default:true,
      name:"Show callouts", desc:"Keep the boxes that say what a tab or a block of settings is for",
      searchTerms:["Show intro boxes"],
      tip:"The boxes are the ones with a coloured edge: one at the top of every tab saying what the tab is for, and one under each block of settings saying what that block does. Turn this off once you know your way around and the panel keeps the settings and the one-line descriptions under their names. It is a separate switch from <code>Show tips</code>: that one hides the <code>?</code> marks, this one hides the boxes" },
    { kind:"toggle", id:"show-tips", path:"general.help.showTips", default:true,
      name:"Show tips", desc:"Put a ? beside anything that needs more explanation",
      tip:"Click a ? and a short explanation opens underneath, usually with an example. Turn this off once you no longer need them: the one-line descriptions stay either way" }
  ]
},
{
  id: "modules", tab: "general", order: 200, heading: "Modules",
  intro: "Four separate things live in this plugin. Turn off the ones you do not want and they stop adding commands and stop touching your notes",
  tip: "Turning an area off is not the same as leaving it alone. Its commands disappear from the palette, so a hotkey you gave them stops doing anything, and its settings are hidden here until you turn it back on. Nothing you configured is lost — the settings come back exactly as they were. Use this to keep the palette short: if you only ever wanted the tags, three of the four can go",
  items: [
    { kind:"toggle", id:"module-navigation", path:"features.navigation.enabled", default:true,
      name:"Navigation", desc:"Move lines, text and the cursor without reaching for the mouse",
      tip:"Nothing here writes anything new. It only moves text you have already written \u2014 a line up, a word along, the cursor across. Safe to leave on" },
    { kind:"toggle", id:"module-pkm", path:"features.pkm.enabled", default:true,
      name:"Tags & PKM", desc:"Set up your PKM tags, wikilinks and emoji elements, and insert them inline with one key",
      tip:"This is the part that puts tags and dates onto a line for you, and steps them forward with a keypress. Turning it off changes nothing you have already written \u2014 those keys simply stop working" },
    { kind:"toggle", id:"module-visual", path:"features.visual.enabled", default:true,
      name:"Visual", desc:"Customize and beautify your inline text with tag colors, Bars and much more",
      tip:"Appearance only. Your notes contain exactly the same text either way \u2014 this decides how it looks on screen. Anyone opening the file elsewhere sees the plain text" },
    { kind:"toggle", id:"module-transform", path:"features.transform.enabled", default:true,
      name:"Transform", desc:"Turn an inline entry into a note, with templates, YAML properties, rules and more",
      tip:"Leaving this on does not let anything happen yet. Making notes needs one more switch, on the Transform tab, because it is the one thing here that writes new files" }
  ]
}
];
