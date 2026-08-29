/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Тексты согласованы заказчиком и совпадают с Приложением B PRD.
 * Не перенесено (свои блоки и кнопки без действий, З8):
 *   diagnostics: restore-backup (buttons, нет действия: restore-backup)
 */

import type { SettingsGroup } from "../types.ts";
import { on } from "../types.ts";
import { callout } from "../custom/callouts.ts";

export const ADVANCED_GROUPS: readonly SettingsGroup[] = [
{ id: "advanced-intro",  tab: "advanced",   order: 50, heading: "Before you start",
  items: [
    { kind:"custom", id:"advanced-callout", render: callout("advanced") }
  ] },
{
  id: "generated-files", tab: "advanced", order: 100, heading: "Generated files",
  intro: "The plugin keeps its own compiled copy of your setup inside the vault. You never need to touch it, but it can be rebuilt from here if it ever falls out of step",
  tip: "It is not the same thing as the config note on the Tags & PKM tab. That one is for you to read and edit; this one is written for the plugin and is overwritten on every change, so editing it by hand has no lasting effect",
  items: [
    { kind:"buttons", id:"config-template",
      name:"Template note", desc:"A reference note showing every block the config note understands",
      searchTerms:["Open Detailed Template"],
      tip:"Open this when you want to write a config note by hand and need to know what the blocks are called",
      buttons:[ {label:"Open", action:"open-config-template"} ] },
    { kind:"buttons", id:"regenerate-rules",
      name:"Regenerate", desc:"Rewrite the file from your current Field setup",
      searchTerms:["Regenerate Rules Now"],
      tip:"Use this if a command stops recognising a Field you know you configured. It usually means the file and the settings have drifted apart",
      buttons:[ {label:"Regenerate", action:"regenerate-rules"} ] }
  ]
},
{
  id: "setting-ids", tab: "advanced", order: 150, heading: "Setting ids",
  intro: "Every setting and every group here has a short id. Turn this on and you can name one instead of describing where it sits on screen",
  tip: "Ids are what the plugin\u2019s own notes, reports and issues call settings by. They never change when a name or a description is reworded, so they are the safe way to point at a setting \u2014 in a bug report, in a question, or when someone walks you through a fix",
  items: [
    { kind:"toggle", id:"show-setting-ids", path:"advanced.showSettingIds", default:false,
      name:"Show setting ids in tips", desc:"Put the id of each setting and group at the end of its tip",
      tip:"The id goes into the tip, so <code>Show tips</code> on the General tab has to be on as well. Settings without a tip of their own get one with just the id in it" }
  ]
},
{
  id: "diagnostics", tab: "advanced", order: 200, heading: "Diagnostics",
  intro: "If something misbehaves, a log helps work out why. Be aware the log is saved into your vault and will contain the text of the lines you were working on",
  items: [
    { kind:"toggle", id:"dev-mode", path:"advanced.devMode.enabled", default:false,
      name:"Developer logging", desc:"Record what the plugin did, to help track down a problem",
      searchTerms:["Enable Dev Mode"],
      tip:"Leave this off day to day. Turn it on, reproduce the problem once, then turn it off and attach the log to a bug report after checking what is in it" },
    { kind:"toggle", id:"dev-ai-log", path:"advanced.devMode.aiLog", default:true,
      name:"Machine-readable log", desc:"Also keep a second, denser log meant for tools rather than people",
      tip:"Only worth turning on if someone has asked you for it. The plain log is the one you can read yourself",
      searchTerms:["Generate log for AI?"], visible: on("advanced.devMode.enabled") },
    { kind:"text", id:"dev-log-path", path:"advanced.devMode.logPath", default:"InlineOverhaul_DevLog", wide:true,
      name:"Log file", desc:"Where in your vault the logs are put",
      tip:"They are ordinary notes, so they show up in search and in your graph. Keep them in a folder you exclude if that bothers you",
      searchTerms:["Log Path"], visible: on("advanced.devMode.enabled") }
  ]
}
];
