/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 *
 * Видимые тексты своих блоков. У записи `kind: "custom"` нет ни `name`,
 * ни `desc`, поэтому её текстам нужен свой дом — и он тоже генерируется,
 * чтобы согласованная формулировка не переписывалась руками (Р8).
 */

/** Вводный коллаут вкладки (10.1): фраза, подсказка и абзац. */
export interface CalloutText {
  head: string;
  tip: string;
  body: string;
}

export const TAB_CALLOUTS: Readonly<Record<string, CalloutText>> = {
  general: {
    head: "inlineOverhaul lets one line of a note carry its own status, dates and links",
    tip: "Start here: switch off what you don’t need, press <code>Read</code> for a worked example, then set up your first Field on <b>Tags & PKM</b>. The parts work on their own. No command has a key at first, so bind the ones you want on <b>Keyboard</b>. Only <b>Transform</b> creates and edits files",
    body: "Turn on the parts of the plugin you want, pick a language and find help. Nothing is written into your notes until you press a key, and the one part that creates files stays off until you switch it on"
  },
  navigation: {
    head: "Move around lines and notes without the mouse",
    tip: "<b>None of these commands has a key by default</b>. Set keys in <code>Settings → Hotkeys</code>. Each command chip below shows the key it has now",
    body: "Move lines and whole trees up and down, change indents, slide text along a line and jump between headings, all from the keyboard. Keep the groups that suit the way you write"
  },
  keyboard: {
    head: "Everything about keys lives here",
    tip: "Hotkeys are set in Obsidian, not here. This tab shows you what to bind and takes you to <code>Settings → Hotkeys</code>. Your keys stay when the plugin updates",
    body: "Make <code>Ctrl/Cmd + A</code> select a line before the whole note, keep snippets you insert with one key, and see every command with the hotkey it has now"
  },
  pkm: {
    head: "The heart of the plugin: your tags, links and dates",
    tip: "Make a Field for each thing you track, such as a status, a priority or a due date. Then one keypress puts the right Value on the line, and the next press moves it on to the next Value. You never stop writing to fill things in",
    body: "Set up once which tags, links and dates your lines can have, and where they go. After that, tagging a line takes one keypress instead of typing"
  },
  visual: {
    head: "How a tagged line looks while you are writing",
    tip: "Nothing on this tab changes your files. Open the same note without this plugin and you see plain text with ordinary tags",
    body: "Show tags as colored bubbles, add a colored Bar in the margin so you can see what a block of lines is about at a glance, and set up tagWheel, the picker for choosing a Value with the arrow keys"
  },
  transform: {
    head: "Turn a line you have already written into a note of its own",
    tip: "This is the only part of the plugin that creates and changes files. Everything here is off until you switch it on. Make a backup and try it first on a note you do not mind breaking",
    body: "Turn a thought you jotted on one line into a proper note, made from a template, with its properties filled in from the line’s tags. The line keeps a link to the new note"
  },
  advanced: {
    head: "Housekeeping you rarely need",
    tip: "You don’t need anything here day to day. Come back when something behaves oddly, or when you want to see what the plugin wrote into your vault",
    body: "Back up your settings and restore them, or record a log when you need to report a problem"
  }
};

/**
 * Видимые тексты живого предпросмотра (10.3). `line`, `element` и `link` —
 * содержимое выдуманной строки: предпросмотр показывает результат настроек
 * на ней, а не на заметке пользователя (П1). Fields и Values при этом
 * настоящие, из конфига.
 */
/** Строка выдуманного дерева: какие Fields несёт и что под ней вложено. */
export interface PreviewNode {
  text: string;
  fields: readonly string[];
  children: readonly PreviewNode[];
}

export interface PreviewText {
  cap: string;
  tip: string;
  line?: string;
  element?: string;
  link?: string;
  note?: string;
  wikilink?: string;
  label?: string;
  address?: string;
  bare?: string;
  tree?: readonly PreviewNode[];
}

export const PREVIEW_TEXTS: Readonly<Record<string, PreviewText>> = {
  "source-preview": {
    cap: "Live preview",
    tip: "The line you pressed on, before and after. <b>Before</b> is a made-up line carrying every Field you have set up, with two sub-lines under it; <b>After</b> is what stays on the page once the note is written. Everything in this group changes it, and so does <code>Sub-lines (tree) behavior</code> under <code>Source line</code>: take the sub-lines along and they leave the page with the text. The panel draws this itself, so read it as a close likeness of what the editor shows rather than as the editor"
  },
  "line-preview": {
    cap: "Live preview",
    tip: "The shape of a line once your Fields are set up: one chip per Field, in the order they are written, " +
    "with your text in the middle and a Separator marking each end of it. Chips to the left of your text belong to " +
    "the Left Block, chips to the right to the Right Block. Chips at the end of the arrow under your text are your " +
    "custom blocks: they are written where the cursor is, by their own tagWheel command. Everything you do below shows up here at once — add a " +
    "Field, rename one, give it a short name for tagWheel, drag it across the line, change a Separator — so you can " +
    "see what a tagged line will look like before you type one. The panel draws this itself, so read it as a close likeness of what the editor shows rather than as the editor"
  },
  "tag-preview": {
    cap: "Live preview",
    tip: "Real Values here, because that is what these settings style. The date and the link are not tags, so they get no " +
    "bubble — but the two opacity settings dim a whole side of the line, including them. Priority is set to " +
    "<code>empty</code>, which is why it shows as a bare color. The panel draws this itself, so read it as a close likeness of what the editor shows rather than as the editor",
    line: "Rewrite the settings copy",
    element: "\u{1F4C5} 2026-08-24",
    link: "[[ClientA]]"
  },
  "bars-preview": {
    cap: "Live preview",
    tip: "A Bar belongs to the line that carries the Field, and runs the full height of that line and everything nested " +
    "under it \u2014 tagged or not. Deeper lines with a Value of their own get a Bar in the next lane along. Every Bar " +
    "sits in the margin, so the text column never moves. The panel draws this itself, so read it as a close likeness of what the editor shows rather than as the editor",
    tree: [
      { text: "Ship the settings overhaul", fields: ["status", "priority"], children: [
        { text: "Rewrite every description", fields: ["status"], children: [
          { text: "Tag Bars", fields: ["status", "priority"], children: [] },
          { text: "tagWheel panel", fields: ["status"], children: [] },
          { text: "Proofread the tips", fields: ["priority"], children: [] }
        ] }
      ] },
      { text: "Merge the prototype into the PRD", fields: [], children: [] },
      { text: "Publish the next beta", fields: ["status", "priority"], children: [
        { text: "Check the migration on a copy", fields: ["status"], children: [
          { text: "and on an empty vault", fields: ["status", "priority"], children: [] }
        ] },
        { text: "Write the release notes", fields: [], children: [] }
      ] }
    ]
  },
  "link-preview": {
    cap: "Live preview",
    tip: "Three links and five colors. The first row is a wikilink — a Value of a link Field left on <code>Show</code> = <code>default</code> — and it takes <code>Link target color</code> and <code>Link brackets color</code>. The second row is a Markdown link: its text, its brackets and its address each take a row of their own above. The third is an address written on its own: it is an address, so <code>Hyperlink address color</code> paints it, the same row as the address in the second. The panel draws this itself, so read it as a close likeness of what the editor shows rather than as the editor",
    wikilink: "[[the note name]]",
    label: "a link",
    address: "https://example.com",
    bare: "www.example.com"
  },
  "wheel-preview": {
    cap: "Live preview",
    tip: "The middle row is your line. The scroller sits on the second Field from the left and shows exactly what the " +
    "settings ask for: <code>Scroller size</code> rows on each side that <code>Scroller opening direction</code> allows. The list is a " +
    "loop, so it keeps going past the last Value and starts again. The panel draws this itself, so read it as a close likeness of what the editor shows rather than as the editor"
  },
  "i2n-button-preview": {
    cap: "Live preview",
    tip: "The button is part of the editor, not the note: nothing is written into your file until you press it. The panel draws this itself, so read it as a close likeness of what the editor shows rather than as the editor",
    note: "Shown on the line the cursor is on"
  },
  "jump-flash-preview": {
    cap: "Live preview",
    tip: "The circle below is drawn with the color, the size and the time set above, and it starts again whenever you change one of them. In a note it appears where the cursor lands after a jump and shrinks away on its own. The panel draws this itself, so read it as a close likeness of what the editor shows rather than as the editor"
  },
  "caret-preview": {
    cap: "Live preview",
    tip: "The caret below is drawn with the color, the width and the blink speed set above, and it changes while you drag. It blinks the way the editor blinks: on for half the time, off for the other half, with no fading in between. The panel draws this itself, so read it as a close likeness of what the editor shows rather than as the editor",
    note: "The caret as it will look in a note"
  },
};

/** ПЗ2: Fields в предпросмотре примерные, пока не настроены свои. */
export const PREVIEW_EXAMPLE = "Example Fields, until you set up your own under Fields on the Tags & PKM tab";

/** Текст выдуманной строки в предпросмотрах формы линии. */
export const PREVIEW_LINE_TEXT = "your text";

/** Пустое состояние правого Block: что здесь бывает (ПЗ2). */
export const PREVIEW_EMPTY_RIGHT = "nothing on the right yet";

/**
 * Что вкладка говорит, когда её модуль выключен (замечание заказчика C7).
 *
 * Калитка модуля живёт в прототипе с самого начала, а в панели её не было
 * ни одной строкой: поле `module` у вкладки не читалось нигде. Текст едет
 * отсюда, чтобы панель и прототип говорили одно.
 */
export const MODULE_OFF_NOTE = "This module is off, so its settings are hidden. Turn it on to configure it";

/**
 * Справочник команд (10.5): области, имена и описания.
 *
 * Имена здесь — те же, что в `src/features/command_ids.js`: и тот, и этот
 * список выведены из одного прототипа, и их совпадение проверяется
 * (`command_ids_tests.ts`). Описания живут только здесь.
 *
 * Три записи описывают не команду, а **семью**: у Field пара команд, у
 * строки Binder своя, у каждого модуля свой тумблер. Их имена в прототипе
 * — примеры и шаблоны (`Status next`, `<your rows>`,
 * `Toggle <module> module`), а настоящие строки собираются из данных.
 */
export interface CommandText {
  name: string;
  does: string;
}

export interface CommandArea {
  area: string;
  /**
   * Подписи двух частей области: стандартные команды и созданные из
   * данных человека. Есть только там, где деление есть (10.5, замечания
   * заказчика 1.2.3.4.1 и 1.2.3.4.2).
   */
  parts?: { standard: string; user: string };
  list: readonly CommandText[];
}

export const COMMAND_TEXTS: readonly CommandArea[] = [
  { area:"Navigation", list:[
    { name:"Move up",                   does:"Move the line you are on, or its whole tree, up" },
    { name:"Move down",                 does:"The same, downwards" },
    { name:"Move left",                 does:"Move selected text, cycle the line Prefix, or unindent" },
    { name:"Move right",                does:"Move selected text, cycle the line Prefix, or indent" },
    { name:"Jump up",                 does:"Move the cursor to the heading or line above" },
    { name:"Jump down",                 does:"Move the cursor to the heading or line below" },
    { name:"Jump left",                 does:"Step the cursor back through the parts of the line" },
    { name:"Jump right",                does:"Step the cursor on through the parts of the line" }
  ]},
  /* Две части, и подписи у них видимые, поэтому живут здесь (Р8).
     Стандартные команды — те, что есть всегда; ваши — пара на каждый Field,
     она заводится сама (замечания 1.2.3.4.1 и 1.2.3.4.2). */
  { area:"Tags & PKM",
    parts:{ standard:"Main commands", user:"Commands from your Fields" }, list:[
    { name:"Status next",     does:"One pair per Field, created automatically from your Field list" },
    { name:"Status previous", does:"The same Field, backwards through its Values" },
    { name:"tagWheel Left",  does:"Open tagWheel starting on the Fields before your text" },
    { name:"tagWheel Right", does:"Open tagWheel starting on the Fields after your text" },
    /* Custom block (PRD 10.13.260): по команде на блок, имя — имя блока. */
    { name:"tagWheel <block>", does:"Open a custom block’s tagWheel where the cursor is" }
  ]},
  /* Область `Config` снята вместе с конфиг-заметкой 2026-09-03 (В-28): команды
     `Apply config note` и `Open config template` из палитры убраны. */
  { area:"Transform", list:[
    { name:"Transform inline to note", does:"Turn the current line into a note, or append it to one" }
  ]},
  { area:"Binder", list:[
    { name:"Smart bracket", does:"Cycle the brackets around the cursor or selection: none, then [], then a wikilink" },
    { name:"<your rows>",   does:"One command per row you add under Keyboard" }
  ]},
  { area:"General", list:[
    { name:"Toggle <module> module",     does:"One command per module, for turning a whole area off quickly" },
    { name:"Undo last settings change",  does:"Roll back the most recent change made in these settings" }
  ]}
];
