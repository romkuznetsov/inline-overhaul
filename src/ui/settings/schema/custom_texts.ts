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
    head: "Inline Overhaul is about writing a note and tagging it in the same breath",
    tip: "Everything the plugin does is built on one idea: a line can carry more than words. Put a status, a due date " +
         "or a link on the same line as the thought, and you never break off to fill in a form. The tabs across the " +
         "top go from moving text around, through setting up those slots, to turning a line into a note of its own",
    body: "Nothing here changes your notes on its own. Each area below can be switched off, and the one part that " +
          "creates files asks again before it will run. If you are new to it, start with the guide"
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
    body: "Draw tags as coloured bubbles instead of raw text, put a Bar in the margin so you can see what a block of " +
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
  "line-preview": {
    cap: "Live preview",
    tip: "One chip per Field, in the order they are written. Everything you change below shows up here: rename a Field, " +
    "give it a short name, move it to the other side, or change a Separator"
  },
  "tag-preview": {
    cap: "Live preview",
    tip: "Real Values here, because that is what these settings style. The date and the link are not tags, so they get no " +
    "bubble — but the two opacity settings dim a whole side of the line, including them. Priority is set to " +
    "<code>empty</code>, which is why it shows as a bare color",
    line: "Rewrite the settings copy",
    element: "\u{1F4C5} 2026-08-24",
    link: "[[ClientA]]"
  },
  "bars-preview": {
    cap: "Live preview",
    tip: "A Bar belongs to the line that carries the Field, and runs the full height of that line and everything nested " +
    "under it \u2014 tagged or not. Deeper lines with a Value of their own get a Bar in the next lane along. Every Bar " +
    "sits in the margin, so the text column never moves",
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
    "settings ask for: <code>Values per side</code> rows on each side that <code>Opens</code> allows. The list is a " +
    "loop, so it keeps going past the last Value and starts again"
  },
  "i2n-button-preview": {
    cap: "Live preview",
    tip: "The button is part of the editor, not the note: nothing is written into your file until you press it",
    note: "Shown on the line the cursor is on"
  },
};

/** П9: предпросмотр рисует панель, а не редактор, и говорит об этом. */
export const PREVIEW_NOTE = "Close to what the editor draws, not the editor itself";

/** ПЗ2: Fields в предпросмотре примерные, пока не настроены свои. */
export const PREVIEW_EXAMPLE = "Example Fields, until you set up your own under Fields on the Tags & PKM tab";

/** Текст выдуманной строки в предпросмотрах формы линии. */
export const PREVIEW_LINE_TEXT = "your text";

/** Пустое состояние правого Block: что здесь бывает (ПЗ2). */
export const PREVIEW_EMPTY_RIGHT = "nothing on the right yet";
