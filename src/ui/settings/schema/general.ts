/**
 * Вкладка General (PRD 6.1, 6.2). Тексты — из Приложения B, менять их здесь
 * нельзя: сначала правится прототип, потом опись перегенерируется.
 *
 * Чего пока нет: вводный коллаут `general-callout` и строка `Guide` с
 * кнопкой. Коллаут — свой блок, он появится вместе с `custom/callouts.ts`;
 * кнопка ждёт действие `open-howto`, которое делается в фазе 5. Показывать
 * кнопку, которая ничего не открывает, запрещено (З8).
 */

import type { SettingsGroup } from "../types.ts";

export const GENERAL_GROUPS: readonly SettingsGroup[] = [
  {
    id: "help",
    tab: "general",
    order: 100,
    heading: "Help",
    intro: "Where to start, and how much hand-holding you want along the way",
    items: [
      {
        kind: "toggle",
        id: "show-tips",
        path: "general.help.showTips",
        default: true,
        name: "Show tips",
        desc: "Put a ? beside anything that needs more explanation",
        tip: "Click a ? and a short explanation opens underneath, usually with an example. " +
          "Turn this off once you no longer need them: the one-line descriptions stay either way",
      },
    ],
  },
  {
    id: "modules",
    tab: "general",
    order: 200,
    heading: "Modules",
    intro: "Four separate things live in this plugin. Turn off the ones you do not want and they stop adding commands and stop touching your notes",
    items: [
      {
        kind: "toggle",
        id: "module-navigation",
        path: "features.navigation.enabled",
        default: true,
        name: "Navigation",
        desc: "Move lines, text and the cursor without reaching for the mouse",
        tip: "Nothing here writes anything new. It only moves text you have already written — " +
          "a line up, a word along, the cursor across. Safe to leave on",
      },
      {
        kind: "toggle",
        id: "module-pkm",
        path: "features.pkm.enabled",
        default: true,
        name: "Tags & PKM",
        desc: "Set up your PKM tags, wikilinks and emoji elements, and insert them inline with one key",
        tip: "This is the part that puts tags and dates onto a line for you, and steps them forward " +
          "with a keypress. Turning it off changes nothing you have already written — those keys " +
          "simply stop working",
      },
      {
        kind: "toggle",
        id: "module-visual",
        path: "features.visual.enabled",
        default: true,
        name: "Visual",
        desc: "Customize and beautify your inline text with tag colors, Bars and much more",
        tip: "Appearance only. Your notes contain exactly the same text either way — this decides " +
          "how it looks on screen. Anyone opening the file elsewhere sees the plain text",
      },
      {
        kind: "toggle",
        id: "module-transform",
        path: "features.transform.enabled",
        default: true,
        name: "Transform",
        desc: "Turn an inline entry into a note, with templates, YAML properties, rules and more",
        tip: "Leaving this on does not let anything happen yet. Making notes needs one more switch, " +
          "on the Transform tab, because it is the one thing here that writes new files",
      },
    ],
  },
];
