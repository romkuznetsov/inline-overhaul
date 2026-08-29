/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Тексты согласованы заказчиком и совпадают с Приложением B PRD.
 */

import type { SettingsGroup } from "../types.ts";
import { on } from "../types.ts";
import { callout } from "../custom/callouts.ts";
import { barsPreview, tagPreview, wheelPreview } from "../custom/previews.ts";
import { userTagColors } from "../custom/user_tags.ts";

export const VISUAL_GROUPS: readonly SettingsGroup[] = [
{ id: "visual-intro",    tab: "visual",     order: 50, heading: "Before you start",
  items: [
    { kind:"custom", id:"visual-callout", render: callout("visual") }
  ] },
{
  id: "tag-appearance", tab: "visual", order: 100, heading: "Tag appearance",
  intro: "How a tagged line looks while you write. Tags are drawn as small coloured bubbles; links and dates stay ordinary text. Nothing here changes a single character in your file",
  items: [
    { kind:"custom", id:"tag-preview", render: tagPreview },
    { kind:"slider", id:"tags-opacity-left", path:"visual.tags.opacityLeft", default:100,
      min:0, max:100, step:1, unit:"%",
      name:"Opacity before the text", desc:"Dims everything written before your text, tags and elements alike",
      searchTerms:["Opacity Left"],
      seeAlso:{ id:"field-editor", label:"Tag colors are set per Value under Fields" } },
    { kind:"slider", id:"tags-opacity-right", path:"visual.tags.opacityRight", default:100,
      min:0, max:100, step:1, unit:"%",
      name:"Opacity after the text", desc:"Dims everything written after your text, tags and elements alike",
      searchTerms:["Opacity Right"] },
    { kind:"slider", id:"tags-text-size", path:"visual.tags.textSizePct", default:100,
      min:80, max:140, step:5, unit:"%",
      name:"Text size", desc:"How big the writing inside a bubble is, next to the rest of your note",
      tip:"Below 100 the tags step back and your sentence leads. Above 100 they compete with it. Most people end up a little under 100",
      searchTerms:["Tag text size"] },
    { kind:"slider", id:"tags-bubble-width", path:"visual.tags.bubbleWidthPct", default:100,
      min:80, max:140, step:5, unit:"%",
      name:"Bubble width", desc:"How much breathing room there is either side of the word",
      searchTerms:["Tag bubble size - width"] },
    { kind:"slider", id:"tags-bubble-height", path:"visual.tags.bubbleHeightPct", default:100,
      min:80, max:140, step:5, unit:"%",
      name:"Bubble height", desc:"How tall the bubble is around the word",
      tip:"Keep this modest: a tall bubble pushes the lines of your note apart and the page starts to feel airy in a way that is hard to read",
      searchTerms:["Tag bubble size - height"] },
    { kind:"slider", id:"tags-empty-bubble", path:"visual.tags.emptyBubblePct", default:100,
      min:50, max:180, step:5, unit:"%",
      name:"Empty bubble width", desc:"Width of a bubble whose <code>Show</code> is set to <code>empty</code>",
      searchTerms:["Empty bubble size"],
      tip:"Under <code>Fields</code> a Value can be set to <code>empty</code>, which draws its color but no text — a marker instead of a word. This is how wide that marker gets",
      seeAlso:{ id:"field-editor", label:"Set a Value to empty under Fields" } },
    { kind:"slider", id:"tags-corners", path:"visual.tags.cornersPct", default:0,
      min:0, max:100, step:1,
      name:"Bubble corners", desc:"Slide from fully rounded to completely square",
      searchTerms:["Tag shape"] }
  ]
},
{
  id: "user-tag-colors", tab: "visual", order: 150, heading: "Color your Tags",
  intro: "Colours for tags that are not a Value of any Field. A tag you type straight into a line still gets a bubble, and this is where you say what that bubble looks like",
  tip: "A Field gives its own Values their colours under <code>Tags &amp; PKM</code>. Everything else \u2014 a tag you typed once, a tag another plugin put there \u2014 has no Field to belong to, so it lives here. Leave a colour unset and the tag takes the colour of your theme, and keeps following it when the theme changes",
  items: [
    { kind:"custom", id:"user-tag-list", render: userTagColors }
  ]
},
{
  id: "tag-bars", tab: "visual", order: 200, heading: "Tag Bars",
  intro: "A coloured Bar in the margin, so you can see at a glance what a whole block of lines is about without reading their tags. The Bar runs down the side of the line and everything nested under it",
  items: [
    { kind:"custom", id:"bars-preview", render: barsPreview },
    { kind:"toggle", id:"bars-active", path:"visual.tagBars.active", default:true,
      name:"Tag Bars", desc:"Draw the Bars",
      searchTerms:["Activate strip","Strip","Hierarchy Bars","Level Bars"] },
    { kind:"dropdown", id:"bars-field", path:"visual.tagBars.fieldId", default:"status",
      name:"Which Field draws Bars", desc:"Bars are drawn for one Field only. Lines without a Value for it get none",
      searchTerms:["Strip Field"], visible: on("visual.tagBars.active"),
      options:[ {value:"status",label:"Status"}, {value:"priority",label:"Priority"} ],
      tip:"Pick the one thing you scan a page for \u2014 usually how far along something is, or how urgent it is. Switch between the two in the preview above and you will see the Bars change shape, not just colour, because different lines carry different Fields",
      seeAlso:{ id:"field-editor", label:"Bar colors are the Value colors under Fields" } },
    { kind:"slider", id:"bars-count", path:"visual.tagBars.stripesToShow", default:2,
      min:1, max:3, step:1,
      name:"Number of Bars", desc:"How far down the nesting to keep drawing them",
      searchTerms:["Stripes to show"], visible: on("visual.tagBars.active"),
      tip:"At 1 only the parent line gets a Bar, however deep the tree goes. At 2 a child with a Value of its own gets a second Bar beside the first. At 3 a grandchild gets a third. A line with no Value never gets one" },
    { kind:"toggle", id:"bars-show-tag", path:"visual.tagBars.tagVisibility", default:true,
      name:"Show the Field's tag", desc:"Keep the tag on the line, or let the Bar speak for it",
      searchTerms:["Strip tag visibility"], visible: on("visual.tagBars.active"),
      tip:"With the Bar already showing you the Value by color, the tag itself is often redundant. Hiding it buys back room on the line; the text stays in your note and stays searchable" },
    { kind:"toggle", id:"bars-hide-separator", path:"visual.tagBars.hideSeparatorWhenOnlyStripToken", default:false,
      name:"Hide the leftover marker", desc:"Tidy away a Separator that has nothing left beside it",
      searchTerms:["Hide Separator?"],
      visible:{ deps:["visual.tagBars.active","visual.tagBars.tagVisibility"],
                test: c => Boolean(c.get("visual.tagBars.active")) && !c.get("visual.tagBars.tagVisibility") },
      tip:"If the hidden tag was the only thing in front of your text, the line is left starting with a bare Separator and nothing before it. This clears that up" },
    { kind:"dropdown", id:"bars-mode", path:"visual.tagBars.mode", default:"default",
      name:"Bar arrangement", desc:"Which lane each level of the tree draws its Bar in",
      searchTerms:["Strip mode"], visible: on("visual.tagBars.active"),
      options:[ {value:"default",label:"Parent keeps the outer lane"}, {value:"crossing",label:"Lanes rotate"} ],
      tip:"Bars are drawn in lanes, one per level, left to right. With <b>parent keeps the outer lane</b> the top line of a tree always owns the leftmost lane, its child the next one in, and so on \u2014 so a lane always means the same depth, and you can read nesting by counting from the left. With <b>lanes rotate</b> each new level takes the next lane round in turn, which keeps deep trees narrower but means a lane no longer tells you the depth" },
    { kind:"slider", id:"bars-thickness", path:"visual.tagBars.thickness", default:3,
      min:1, max:12, step:1, unit:"px",
      name:"Bar thickness", desc:"How wide each Bar is",
      searchTerms:["Strip thickness"], visible: on("visual.tagBars.active") },
    { kind:"slider", id:"bars-gap", path:"visual.tagBars.childOffset", default:11,
      min:2, max:20, step:1, unit:"px",
      name:"Space between Bars", desc:"The gap between one level and the next",
      searchTerms:["Parent/child strip distance"], visible: on("visual.tagBars.active") },
    { kind:"slider", id:"bars-distance", path:"visual.tagBars.spacing", default:14,
      min:8, max:48, step:1, unit:"px",
      name:"Distance from the text", desc:"How far the Bars sit from where your line begins",
      searchTerms:["Strip spacing"], visible: on("visual.tagBars.active") }
  ]
},
{
  id: "tagwheel", tab: "visual", order: 300, heading: "TagWheel",
  intro: "TagWheel opens over the line and lays your Fields out across it, with the Values of the Field you are on running down",
  tip: "Steer it with the arrow keys: left and right move between Fields, up and down between that Field\u2019s Values. <code>Tab</code> jumps across to the Fields on the other side of your text, and <code>Escape</code> closes it without changing anything",
  commands: ["Open TagWheel on the left", "Open TagWheel on the right"],
  items: [
    { kind:"custom", id:"wheel-preview", render: wheelPreview },
    { kind:"toggle", id:"panel-markers", path:"visual.tagWheel.showMarkers", default:true,
      name:"Show tag markers", desc:"Show the hash and emoji in the picker, or just the words",
      searchTerms:["Show Prefix"],
      tip:"A column of words reads faster than a column of words with hashes in front. What actually goes into your note is the same either way" },
    { kind:"color", id:"panel-text-color", path:"visual.tagWheel.textColor", default:"#5d5b6b",
      name:"Text color", desc:"The colour of the Values you are not on", allowReset:true },
    { kind:"color", id:"panel-background", path:"visual.tagWheel.fillColor", default:"#f1e596",
      name:"Background", desc:"The colour behind the picker",
      tip:"Pick something solid enough to read against your note, since the picker is drawn on top of your text", allowReset:true },
    { kind:"toggle", id:"scroller-enabled", path:"visual.tagWheel.scroller.enabled", default:true,
      name:"Scroller", desc:"Show the next and previous Values around the current one, in a box you can style",
      tip:"Off, you see only where you are and step blindly. On, you see what is coming, which makes a long list much quicker to work through",
      searchTerms:["TagWheel Scroller"] },
    { kind:"dropdown", id:"scroller-direction", path:"visual.tagWheel.scroller.direction", default:"full",
      name:"Opens", desc:"Which way the Values unroll from the Field you are on",
      searchTerms:["Scroller direction"], visible: on("visual.tagWheel.scroller.enabled"),
      options:[ {value:"up",label:"Upwards"}, {value:"down",label:"Downwards"},
                {value:"full",label:"Both ways"} ] },
    { kind:"slider", id:"scroller-size", path:"visual.tagWheel.scroller.size", default:3,
      min:1, max:20, step:1,
      name:"Values per side", desc:"How many neighbouring Values stay visible around the current one",
      searchTerms:["Scroller size"], visible: on("visual.tagWheel.scroller.enabled") }
  ]
}
];
