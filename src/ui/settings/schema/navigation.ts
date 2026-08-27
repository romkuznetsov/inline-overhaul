/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Тексты согласованы заказчиком и совпадают с Приложением B PRD.
 * Не перенесено (свои блоки и кнопки без действий, З8):
 *   left-right: left-right-order (custom), cycle-order (custom)
 */

import type { SettingsGroup } from "../types.ts";
import { not, eq } from "../types.ts";
import { callout } from "../custom/callouts.ts";

export const NAVIGATION_GROUPS: readonly SettingsGroup[] = [
{ id: "nav-intro",       tab: "navigation", order: 50, heading: "Before you start",
  items: [
    { kind:"custom", id:"nav-callout", render: callout("navigation") }
  ] },
{
  id: "move-lines", tab: "navigation", order: 100, heading: "Moving lines",
  intro: "Reorder a note without cutting and pasting: pick up a line and walk it up or down",
  tip: "When a line has other lines indented beneath it, the whole bundle is called its <b>tree</b>. That word turns up in a few places here. The setting below is where you decide whether the bundle travels with the line or stays behind",
  commands: ["Move line up", "Move line down"],
  items: [
    { kind:"toggle", id:"move-lines-enabled", path:"navigation.moveLine.enabled", default:true,
      name:"Move lines", desc:"Let the keys pick up a line and move it",
      searchTerms:["Enable Move Line"] },
    { kind:"dropdown", id:"move-lines-no-selection", path:"navigation.moveLine.noSelectionMode", default:"line-only",
      name:"Moving behavior", desc:"Whether the tree under the line travels with it",
      searchTerms:["No-selection mode"], disabled: not("navigation.moveLine.enabled"),
      options:[ {value:"line-only",label:"The line only"}, {value:"with-children",label:"The whole tree"} ],
      tip:"Say a line has three lines indented under it. <b>The line only</b> lifts that one line out and leaves the three where they are, so the order changes around them. <b>The whole tree</b> keeps the four together and moves them as one block" },
    { kind:"dropdown", id:"move-lines-heading", path:"navigation.moveLine.headerMode", default:"move-as-line",
      name:"Moving headers", desc:"If you are moving a header, this decides whether the whole section moves or just the header line",
      searchTerms:["Header mode"], disabled: not("navigation.moveLine.enabled"),
      options:[ {value:"move-as-line",label:"Heading only"}, {value:"move-with-section",label:"Heading with its section"} ],
      tip:"With <b>heading with its section</b>, one press swaps two whole sections of a note, content and all. With <b>heading only</b> the heading text moves on its own and the paragraphs under it stay put, which is what you want when you are only renaming the running order" },
    { kind:"toggle", id:"move-lines-cross", path:"navigation.moveLine.crossSectionAllowed", default:true,
      name:"Cross heading boundaries", desc:"Let a line travel past a heading into the part of the note below it",
      searchTerms:["Cross-section allowed"], disabled: not("navigation.moveLine.enabled"),
      tip:"Leave it on and a line keeps going wherever you push it. Turn it off and it stops at the heading, which is what you want in a note where each heading has to keep its own contents" },
    { kind:"toggle", id:"move-lines-select", path:"navigation.moveLine.highlightMovedLines", default:false,
      name:"Select after moving", desc:"Keep the lines highlighted once they land, so you can see what moved",
      tip:"Useful when you move a tree of several lines and want to be sure the whole thing came along",
      searchTerms:["Highlight moved lines"], disabled: not("navigation.moveLine.enabled") }
  ]
},
{
  id: "left-right", tab: "navigation", order: 200, heading: "Move left and move right",
  intro: "Two keys, one for left and one for right, and between them they do three jobs: nudge a piece of text along a line, change the marker at the start of a line, or change how far the line is indented. Which one you get depends on what is selected \u2014 the two lists below spell it out",
  commands: ["Move left", "Move right"],
  items: [
    { kind:"toggle", id:"move-text-enabled", path:"navigation.moveSelection.inlineEnabled", default:true,
      name:"Move selected text", desc:"Slide a highlighted phrase along its line",
      searchTerms:["Enable inline text move"],
      tip:"Highlight two words in the middle of a sentence and press <code>Move right</code>: they trade places with the word after them, and stay highlighted, so you can keep pressing until they are where you want" },
    { kind:"dropdown", id:"move-text-step", path:"navigation.moveSelection.inlineMoveMode", default:"auto",
      name:"Movement step", desc:"How far the highlighted text goes on each press",
      searchTerms:["Inline move mode"], disabled: not("navigation.moveSelection.inlineEnabled"),
      options:[ {value:"auto",label:"Automatic"}, {value:"char",label:"One character"},
                {value:"word",label:"Whole word"}, {value:"disabled",label:"Off"} ],
      tip:"<b>Automatic</b> reads what you highlighted: part of a word moves letter by letter, a whole word hops over whole words. Pick one of the others if you would rather it always behave the same way" },
    { kind:"toggle", id:"prefix-cycle-enabled", path:"navigation.moveSelection.prefixCyclerEnabled", default:true,
      name:"Cycle line Prefixes", desc:"Turn a line into a heading, a bullet, a numbered item or plain text, one press at a time",
      searchTerms:["Enable PrefixCycler"],
      tip:"<code>Move right</code> walks down the list below, <code>Move left</code> walks back up, and an empty row in it means plain text with no Prefix at all. <code>Move left</code> cycles whenever the line has no indent; <code>Move right</code> only cycles when the line is not already a list item, because on a list item it indents instead" },
    { kind:"toggle", id:"right-cycles", path:"navigation.moveSelection.rightCycles", default:true,
      name:"Cycle in both directions", desc:"Off: <code>Move right</code> only ever indents, and cycling becomes a <code>Move left</code> job",
      disabled: not("navigation.moveSelection.prefixCyclerEnabled"),
      tip:"On a plain line <code>Move right</code> walks down the list and <code>Move left</code> walks back up. Switch this off and the two keys split the work: <code>Move left</code> changes the marker, <code>Move right</code> only ever indents. Some people find that easier to keep in their head" },
    { kind:"dropdown", id:"prefix-cycle-end", path:"navigation.moveSelection.onCycleEnd", default:"indent",
      name:"After the last one", desc:"What happens when you reach the bottom of the list below",
      tip:"<b>Start over</b> loops back to the top, so you can keep pressing until you find what you want. <b>Increase indent</b> stops cycling and starts pushing the line to the right instead",
      searchTerms:["On cycle end"], disabled: not("navigation.moveSelection.prefixCyclerEnabled"),
      options:[ {value:"indent",label:"Increase indent"}, {value:"wrap",label:"Start over"} ] },
    { kind:"toggle", id:"indent-fallback", path:"navigation.moveSelection.indentFallbackEnabled", default:true,
      name:"Change the indent", desc:"When neither of the two jobs above applies, move the line right or left instead",
      searchTerms:["Indent fallback"],
      tip:"On, the keys always do something. Off, they sit quiet unless there is text to move or a marker to change \u2014 pick that if you indent with Tab and would rather these keys never touched it" }
  ]
},
{
  id: "heading-jumps", tab: "navigation", order: 300, heading: "Jumping between headings",
  intro: "Skip through a long note by its headings instead of scrolling",
  commands: ["Jump back", "Jump next"],
  items: [
    { kind:"toggle", id:"heading-jumps-enabled", path:"navigation.jumpToHeader.enabled", default:true,
      name:"Jump between headings", desc:"Turn on the <code>Jump back</code> and <code>Jump next</code> commands",
      searchTerms:["Enable Jump To Header"] },
    { kind:"toggle", id:"heading-jumps-center", path:"navigation.jumpToHeader.centerCursor", default:true,
      name:"Center the target", desc:"After a jump, scroll the note so the line you landed on sits mid-screen",
      tip:"Without it you often arrive at the very bottom of the window, with the section you jumped to still off screen below \u2014 so you have to scroll anyway. With it on, you can read straight away",
      disabled: not("navigation.jumpToHeader.enabled") },
    { kind:"dropdown", id:"heading-jumps-mode", path:"navigation.jumpToHeader.jumpMode", default:"edge",
      name:"Jump target", desc:"Hop between headings, or crawl line by line",
      searchTerms:["Jump mode"], disabled: not("navigation.jumpToHeader.enabled"),
      options:[ {value:"edge",label:"Heading to heading"}, {value:"line",label:"Line by line"} ],
      tip:"<b>Heading to heading</b> is for finding your way around a long note. <b>Line by line</b> turns the same keys into a slow walk through the text, which some people prefer to the arrow keys" },
    { kind:"dropdown", id:"heading-jumps-edge", path:"navigation.jumpToHeader.edgeMode", default:"start-end",
      name:"Where in the section", desc:"Land at the start of the part you jump to, or at its end",
      tip:"<b>Alternate</b> means one press takes you to the start, the next to the end, so you can reach both without changing the setting",
      searchTerms:["Edge behavior"],
      visible: eq("navigation.jumpToHeader.jumpMode","edge"), disabled: not("navigation.jumpToHeader.enabled"),
      options:[ {value:"start-end",label:"Alternate start and end"},
                {value:"start",label:"Start only"}, {value:"end",label:"End only"} ] },
    { kind:"dropdown", id:"heading-jumps-cursor", path:"navigation.jumpToHeader.jumpCursorPosition", default:"start",
      name:"Cursor on arrival", desc:"Where on that line the cursor ends up",
      searchTerms:["Jump cursor position"], disabled: not("navigation.jumpToHeader.enabled"),
      options:[ {value:"start",label:"Line start"}, {value:"end",label:"Line end"},
                {value:"section-end",label:"End of your text"} ],
      tip:"<b>End of your text</b> puts the cursor after the last word you wrote but before the tags and dates at the end of the line, so you can carry on typing without having to step back over them",
      seeAlso:{ id:"separator-2", label:"Where your text ends is set by the second Separator" } }
  ]
},
{
  id: "in-line", tab: "navigation", order: 400, heading: "Moving inside a line",
  intro: "A line can hold tags before your text and dates after it. These keys walk the cursor between those parts without leaving the line",
  commands: ["Move cursor left in line", "Move cursor right in line"],
  items: [
    { kind:"toggle", id:"in-line-enabled", path:"navigation.navigateInline.enabled", default:true,
      name:"Move cursor inside a line", desc:"Let the keys walk the cursor along the line",
      searchTerms:["Enable Navigate Inline"] },
    { kind:"dropdown", id:"in-line-step", path:"navigation.navigateInline.stepMode", default:"word",
      name:"Step size", desc:"How big a hop the cursor makes each time",
      tip:"<b>Word</b> is the everyday choice. <b>Sentence</b> suits long paragraphs. <b>Straight to the start or end</b> skips the middle entirely and lands at one end of your text",
      searchTerms:["Step mode"], disabled: not("navigation.navigateInline.enabled"),
      options:[ {value:"word",label:"Word"}, {value:"sentence",label:"Sentence"},
                {value:"begin-end",label:"Straight to the start or end"} ] },
    { kind:"toggle", id:"in-line-cross", path:"navigation.navigateInline.boundaryJump", default:false,
      name:"Continue past a Separator", desc:"Let the cursor leave your text and walk into the tags at either end",
      searchTerms:["Allow crossing Separators"], disabled: not("navigation.navigateInline.enabled"),
      tip:"Off is the safer setting while you are writing: the cursor stays in your sentence and cannot wander into the tags. Turn it on when you want to reach a tag with the same keys instead of the mouse" },
    { kind:"dropdown", id:"in-line-boundary", path:"navigation.navigateInline.onBoundary", default:"wrap",
      name:"At the far end", desc:"What to do when there is nowhere further to go",
      searchTerms:["On boundary"], disabled: not("navigation.navigateInline.enabled"),
      tip:"Say the cursor is on the last word before the closing Separator and you press again. <b>Stay put</b> does nothing. <b>Wrap</b> sends it back to the first word of the same stretch. <b>Next line</b> leaves the line entirely",
      options:[ {value:"stay",label:"Stay put"}, {value:"wrap",label:"Wrap to the other end"},
                {value:"next-line",label:"Go to the next line"} ] }
  ]
}
];
