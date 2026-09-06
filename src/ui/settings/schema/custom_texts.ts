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
    tip: "The tabs across the top follow the order in which people usually set the plugin up, so reading them left " +
         "to right is reading the plugin. Nothing here depends on anything else: a Field you set up on " +
         "<b>Tags & PKM</b> works with the keys off, and the keys work with no Fields at all. The two areas worth " +
         "knowing about before you start are <b>Transform</b>, the only one that creates and edits files, and " +
         "<b>Keyboard</b>: none of the commands has a key by default, so until you bind one nothing responds",
    body: "Four areas, and one of them is enough. <b>Keyboard</b> gives you the keys and shows what each one is " +
          "bound to. <b>Navigation</b> moves lines, text and the cursor without the mouse. <b>Tags & PKM</b> is the " +
          "heart of it: you lay out the slots a line can hold — a status, a priority, a due date — and " +
          "afterwards one keypress fills one in and steps it forward. <b>Visual</b> decides how those slots look " +
          "while you write, and <b>Transform</b> turns a finished line into a note of its own. Three steps to get " +
          "going: switch off any area you do not want, press <code>Read</code> above for a worked example, then lay " +
          "out your first Field on <b>Tags & PKM</b>. Nothing is written into your notes until you press a key, and " +
          "the one area that creates files stays off until you switch it on"
  },
  navigation: {
    head: "This menu helps to make inline navigation in Obsidian comfortable",
    tip: "<b>None of these commands has a key by default</b> \u2014 bind them under <code>Settings \u2192 Hotkeys</code> " +
         "so they work. Each group below names the commands it uses, and every command chip shows the key it has now",
    body: "Moving lines and whole trees up and down, changing line indent levels, shifting text inside the line, " +
          "jumping between headings to navigate easier and much more. Experiment, and set up the workspace of your dreams!"
  },
  keyboard: {
    head: "Everything about keys lives here",
    tip: "Obsidian owns the hotkeys themselves, so this tab tells you what to bind and takes you there; the binding " +
         "is done in <code>Settings \u2192 Hotkeys</code> and survives updates of this plugin",
    body: "Take over Ctrl/Cmd + A so it selects a line before the whole note, keep a row of snippets you drop in with " +
          "one press, and read the full list of commands with the key each one currently has"
  },
  pkm: {
    head: "This is the plugin\u2019s main feature",
    tip: "The idea is that you never stop writing to fill in metadata. You define your slots once here \u2014 a status, " +
         "a priority, a due date \u2014 and afterwards one keypress puts the right Value on the line and steps it forward",
    body: "Lay out your PKM here once, and tagging a line becomes a keypress instead of typing. Decide which slots a " +
          "line can hold, what Values each one offers, where they sit, and how they are written"
  },
  visual: {
    head: "How a tagged line looks while you are writing",
    tip: "Nothing on this tab changes a character in your files. Open the same note on another device without this " +
         "plugin and you will see plain text with ordinary tags",
    body: "Draw tags as colored bubbles instead of raw text, put a Bar in the margin so you can see what a block of " +
          "lines is about at a glance, and set up the picker that lets you choose a Value with the arrow keys"
  },
  transform: {
    head: "Turn a line you have already written into a note of its own",
    tip: "This is the one part of the plugin that creates and edits files. Everything here is off until you switch it " +
         "on, and it is worth a backup and a practice run on a note you do not mind breaking",
    body: "A thought you jotted on one line becomes a proper note, from a template, with its properties already " +
          "filled in from the tags on that line \u2014 and the line itself left holding a link to it"
  },
  advanced: {
    head: "Housekeeping you will rarely need",
    tip: "Nothing here is required for day-to-day use. Come back when something is behaving oddly, or when you want " +
         "to look at what the plugin has written into your vault",
    body: "Where the plugin keeps the file it generates from your setup, how to rebuild it if it drifts, and how to " +
          "record a log when something needs reporting"
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
  tree?: readonly PreviewNode[];
}

export const PREVIEW_TEXTS: Readonly<Record<string, PreviewText>> = {
  "source-preview": {
    cap: "Live preview",
    tip: "The line you pressed on, before and after. <b>Before</b> is a made-up line carrying every Field you have set up, with two sub-lines under it; <b>After</b> is what stays on the page once the note is written. Everything in this group changes it, and so does <code>Sub-lines (tree) behavior</code> under <code>Note content</code>: take the sub-lines along and they leave the page with the text. The panel draws this itself, so read it as a close likeness of what the editor shows rather than as the editor"
  },
  "line-preview": {
    cap: "Live preview",
    tip: "The shape of a line once your Fields are set up: one chip per Field, in the order they will be written, " +
    "with your text in the middle and a Separator marking each end of it. Chips to the left of your text belong to " +
    "the Left Block, chips to the right to the Right Block. Everything you do below shows up here at once — add a " +
    "Field, rename one, give it a short name for TagWheel, drag it across the line, change a Separator — so you can " +
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
          { text: "TagWheel panel", fields: ["status"], children: [] },
          { text: "proof-read the tips", fields: ["priority"], children: [] }
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
    { name:"Move line up",              does:"Move the line you are on, or its whole tree, up" },
    { name:"Move line down",            does:"The same, downwards" },
    { name:"Move left",                 does:"Move selected text, cycle the line Prefix, or unindent" },
    { name:"Move right",                does:"Move selected text, cycle the line Prefix, or indent" },
    { name:"Jump back",                 does:"Move the cursor to the heading or line above" },
    { name:"Jump next",                 does:"Move the cursor to the heading or line below" },
    { name:"Move cursor left in line",  does:"Step the cursor back through the parts of the line" },
    { name:"Move cursor right in line", does:"Step the cursor on through the parts of the line" }
  ]},
  /* Две части, и подписи у них видимые, поэтому живут здесь (Р8).
     Стандартные команды — те, что есть всегда; ваши — пара на каждый Field,
     она заводится сама (замечания 1.2.3.4.1 и 1.2.3.4.2). */
  { area:"Tags & PKM",
    parts:{ standard:"Standard commands", user:"Commands from your Fields" }, list:[
    { name:"Status next",     does:"One pair per Field, created automatically from your Field list" },
    { name:"Status previous", does:"The same Field, backwards through its Values" },
    { name:"Open TagWheel on the left",  does:"Open TagWheel starting on the Fields before your text" },
    { name:"Open TagWheel on the right", does:"Open TagWheel starting on the Fields after your text" }
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
