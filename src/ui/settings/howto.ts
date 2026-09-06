/**
 * Заметка-руководство (PRD 5.1, пункт 1; действие `open-howto`).
 *
 * **Текст переписан заказчиком 2026-09-05** и вычитан здесь: он прислал свою
 * версию файлом (`test-vault/inlineOverhaul Guide.md`, замечание F2) и просил
 * убрать опечатки и длинные тире. Правки сверх вычитки — только там, где текст
 * расходился с панелью: три подписи устарели (`Values per side` и `Opens` у
 * скроллера, `Child tag` как уровень пути, `Start over` вне `Settings backup`),
 * и две фразы расходились с механикой (чем красятся Bars, как складываются
 * условия Smart Rules).
 *
 * **Вечером того же дня он дописал в свой файл ещё пять кусков**, и они здесь:
 * группа настроек у `Move line up` и `Move line down`, закрытие TagWheel тем же
 * хоткеем, порядок Fields и колонки цвета, как Value делается дочерним и когда
 * дочерний доезжает до TagWheel, и целый абзац про команды, которые Field
 * заводит себе сам. Имена контролов при переносе приведены к панели: у Field
 * тумблер называется `Child Field`, а не `Child Fields`, и команды строки
 * называются `Move line up` и `Move line down`, а не `Move up` и `Move down`.
 *
 * **Пути к настройкам сверяются со схемой, а не вычиткой** (`actions_tests.ts`).
 * Три устаревших пути в присланном тексте нашлись глазами, то есть случайно;
 * пин разбирает `Вкладка → Группа → Строка` и спрашивает схему.
 *
 * Правила текста те же, что у панели (раздел 7): сущности плагина с заглавной
 * (`Field`, `Value`, `Block`, `Prefix`, `Separator`, `TagWheel`, `Binder`,
 * `Transform`, `Smart Rules`), слова Obsidian и обычного языка — со строчной.
 * Отличие одно: это заметка, а не подпись контрола, поэтому предложения
 * обычные, с точками.
 *
 * **Длинного тире в тексте заметки быть не должно** — прямая просьба заказчика
 * («убери ИИ-змы»). Пин на это стоит в `actions_tests.ts`.
 *
 * **Обещать в ней можно только то, что работает** (то же правило, что З8 в
 * панели). Обратное стареет тише всего и стоило проекту двух находок подряд:
 * README четверо суток писал, что плавающей кнопки нет, — а пин руководства
 * до 2026-09-05 **запрещал** её называть, хотя она сделана 2026-09-01. Список
 * снятого ведётся одним местом — `REMOVED` в `docs_terms_tests.ts`, — и текст
 * этой заметки сверяется с ним наравне с README и `instructions.md`.
 */

/** Куда кладётся заметка. Имя видное: человек найдёт её поиском по vault. */
export const HOWTO_PATH = "inlineOverhaul Guide.md";

/*
 * Прежнее имя заметки (до переименования 2026-09-06). Нужно одному:
 * открыть старую заметку, если новой ещё нет. Заметка принадлежит человеку и
 * в ней его пометки; завести вторую рядом и молча осиротить первую — хужее
 * из двух состояний (тот же довод, что у сироты служебного файла в В-39).
 */
export const HOWTO_LEGACY_PATH = "Inline Overhaul Guide.md";

/**
 * Текст руководства. Собирается функцией, а не константой, чтобы длинные
 * куски можно было держать рядом с тем, что они объясняют.
 */
export function howtoMarkdown(): string {
  return [
    intro(),
    firstSteps(),
    fieldsAndValues(),
    theLine(),
    tagWheel(),
    bars(),
    binder(),
    transform(),
    proTips(),
    recipes(),
  ].join("\n\n");
}

function intro(): string {
  return [
    "> [!Guide] inlineOverhaul: a practical guide",
    "> The mission of this plugin is to improve quality of life while working in Obsidian",
    "> and to reduce the friction of making notes.",
    ">",
    "> This note is yours. The plugin writes it once and never overwrites it, so you can",
    "> scribble in the margins, delete what you do not need, and keep your own recipes at",
    "> the bottom.",
    ">",
    "> The plugin does a lot of things:",
    "> - **Keyboard**: extends what global hotkeys can do, and lets you bind your own",
    ">   insert commands to keys",
    "> - **Navigation**: travel inside a line and around the whole note, move lines and",
    ">   move text",
    "> - **Tags & PKM**: the heart of the plugin, where you set up your tags, wikilinks",
    ">   and emoji-elements and decide how they behave",
    "> - **Visual**: not only makes a note nicer to look at, but also gives you Tag Bars",
    ">   and TagWheel",
    "> - **Transform**: turns a line into a note of its own, with properties and a",
    ">   template, in one press",
  ].join("\n");
}

function firstSteps(): string {
  return [
    "## What to set up first",
    "",
    "In this order. Each step takes a minute and makes the next one obvious.",
    "",
    "1. **Bind a few commands to keys.** Nothing in this plugin has a key by default, and",
    "   that is deliberate: it cannot fight with what you already use. Open",
    "   `Settings → Hotkeys`, type `inlineOverhaul` and bind what you want. The other way",
    "   round works too: `inlineOverhaul → Keyboard → Commands & Hotkeys`, find the",
    "   command and press `not set` in its `Hotkey` column, and Obsidian opens its own",
    "   Hotkeys screen already filtered to that command.",
    "\t1. `Open TagWheel on the left` is the one you will press most. It opens the",
    "\t   TagWheel panel over your line, where you pick the tags, wikilinks and",
    "\t   emoji-elements you set up in `Tags & PKM → Fields`. (*I use `Alt + Arrow down`*)",
    "\t2. `Move left` and `Move right` do three things at once: they move selected text",
    "\t   inside a line, change the indent of a line, and cycle the line Prefix.",
    "\t   (*I use `Shift + Ctrl + Arrow left` and `Shift + Ctrl + Arrow right`*)",
    "\t3. `Move line up` and `Move line down` move the line you are on. Whether its tree",
    "\t   comes along, and whether a heading takes its whole section with it, is yours to",
    "\t   set in `Navigation → Moving lines (up and down)`.",
    "\t   (*I use `Shift + Ctrl + Arrow up` and `Shift + Ctrl + Arrow down`*)",
    "2. **Look at your Fields.** A fresh install comes with four of them: `Status` and",
    "   `Priority` before your text, `Due` and `Project` after it. Open",
    "   `inlineOverhaul → Tags & PKM → Fields` and see what they hold. Once you have the",
    "   idea, delete the ones you do not want with the bin button, or go to",
    "   `Advanced → Settings backup → Start over` and begin from scratch. They come with a",
    "   fresh install only: `Start over` does not bring them back.",
    "3. **Type a line and open TagWheel.** Write `- buy milk` in any note, put the cursor",
    "   on it and press your TagWheel key. The panel opens over the line. `Arrow left` and",
    "   `Arrow right` move between Fields, `Arrow up` and `Arrow down` turn the Values of",
    "   the Field you are on. Fields live in two places, the `Left Block` before your text",
    "   and the `Right Block` after it, and `Tab` switches between them. `Enter`, or your",
    "   TagWheel key a second time, closes the panel and keeps what you picked. `Esc`",
    "   closes it and keeps nothing.",
    "4. **Look at the result.** The line has changed: your text `buy milk` is now fenced",
    "   off from the tags by `||`. Those are the Separators, and you can change them later",
    "   in `Tags & PKM → Separators`. Each tag stands where its Field stands, and that",
    "   order is the left column of `Tags & PKM → Fields`: drag a Field there, or use the",
    "   arrow buttons if you prefer, and the line follows. The colours come from the",
    "   `Fill` and `Text` columns of that Field `Values` table.",
    "5. **Type a few more lines.** Try `Move left`, `Move right`, `Move line up` and",
    "   `Move line down` on them. They are close to intuitive, and every part of them is",
    "   adjustable in `inlineOverhaul → Navigation`. Worth doing: change one option, then",
    "   go straight back to a real note and try it out.",
    "",
    "Everything else is worth reading only after those five steps.",
  ].join("\n");
}

function fieldsAndValues(): string {
  return [
    "## Fields and Values",
    "",
    "Open `inlineOverhaul → Tags & PKM → Fields`.",
    "",
    "A **Field** is a slot on the line: `Status`, `Priority`, `Project`, `Due`, whatever",
    "you want. A **Value** is what you put in that slot. One Field carries one kind of",
    "Value, so it is tags, or wikilinks, or emoji-elements, never a mix.",
    "",
    "| Type | Writes | Good for |",
    "|---|---|---|",
    "| `Tag` | `#todo` | states, contexts, anything you want to search by |",
    "| `Link` | `[[Project A]]` | pointing at another note |",
    "| `Element` | `\u{1F4C5} 2026-08-29` | dates and anything with a marker in front |",
    "",
    "Three things about Values that are worth knowing early.",
    "",
    "**A Value can have a child.** Under `Status` you can keep `#open`, and under `#open`",
    "a `#wip`. Tag Values and link Values can do this; an emoji-element has no list of",
    "Values to do it in. You make a Value a child with the arrows in the `Level` column of",
    "the `Values` table: it steps to the right and turns grey, so you cannot miss it. On",
    "the line the two show up either as separate bubbles or as one `#open/wip`, and which",
    "one it is is `Tags & PKM → Writing rules → Child tag format`.",
    "",
    "A child reaches TagWheel only when both of these are true: the Field has",
    "`Child Field` turned on in its `Behavior` block, and you have already picked the",
    "parent Value on that line.",
    "",
    "**A tag Value can be shown as empty.** Pick a tag Field in",
    "`Tags & PKM → Fields` and use the `Show` column of its `Values` table. The tag stays",
    "in the file and search still finds it, but the line prints an empty bubble instead of",
    "the name. Useful for the values that are obvious to you, and it keeps the line short.",
    "",
    "**A new Field brings its own commands.** Add one and two commands appear by",
    "themselves, `<Name> next` and `<Name> previous`, called after the Field `Name` and",
    "not after its shorter `Name in TagWheel`. Turn `Child Field` on and there are two",
    "more, `<Name>-sub next` and `<Name>-sub previous`. Each of them walks the Values of",
    "that Field in a circle: nothing, the first Value, the last one, nothing again. One",
    "key per Field is therefore enough, and you do not turn your keyboard into a piano.",
    "This is how you set a Value without opening TagWheel at all. They are listed in",
    "`Keyboard → Commands & Hotkeys`, and deleting the Field takes its commands with it.",
  ].join("\n");
}

function theLine(): string {
  return [
    "## How a line is put together",
    "",
    "```",
    "- #todo #high || buy milk || [[Project A]] \u{1F4C5} 2026-08-29",
    "^  ^^^^^^^^^^    ^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^^^^^^^",
    "|  Left Block    your text   Right Block",
    "Prefix",
    "```",
    "",
    "* the **Prefix** is what the line starts with: a bullet, a checkbox, a heading mark;",
    "* the **Left Block** and the **Right Block** hold Fields, and each Field sits in one",
    "  of them. Drag it across the line in `Tags & PKM → Fields` to move it;",
    "* the two `||` are the **Separators**. They are what tells the plugin where your text",
    "  ends and the Fields begin, so pick something you would never type by accident. They",
    "  live in `Tags & PKM → Separators`.",
  ].join("\n");
}

function tagWheel(): string {
  return [
    "## TagWheel",
    "",
    "TagWheel is the reason the Fields are worth setting up. Put the cursor on a line,",
    "press the key you bound to it, and a small panel opens over the line with your Fields",
    "in it. Arrow keys move between Fields and between Values, and the line updates as you",
    "move.",
    "",
    "How it looks is `inlineOverhaul → Visual → TagWheel`:",
    "",
    "* **`Scroller`** turns on a second small panel beside the Field you are on, showing",
    "  the Values above and below the current one;",
    "* **`Scroller size`** is how many Values it shows on each side;",
    "* **`Scroller opening direction`** is which way it opens;",
    "* **`Highlight the TagWheel line`** fills the line while the panel is open, so you can",
    "  see at a glance what you are editing;",
    "* **`Active Field text color`** and **`Non-active Field text color`** are what tells",
    "  the current Field from the rest. Your tag colours are not drawn inside the panel, so",
    "  these two are the whole difference there.",
    "",
    "If a Field does not show up in TagWheel, open its `Behavior` block in",
    "`Tags & PKM → Fields`: check that it is `Active`, and that it is not waiting for",
    "another Field through `Prerequisite Field`.",
  ].join("\n");
}

function bars(): string {
  return [
    "## Tag Bars",
    "",
    "`inlineOverhaul → Visual → Tag Bars`",
    "",
    "A Bar is a coloured stripe in the margin of a note. It runs down the side of a line",
    "**and everything nested under it**, so a whole block of lines tells you what it is",
    "about without you reading a single tag.",
    "",
    "One tag Field draws the Bars, and you say which one in `Which Field draws Bars`. The",
    "colours come from the Values of that Field, so a Bar and a bubble can never disagree.",
    "`Number of Bars` is how many levels deep it goes, and `Bars for the whole tree`",
    "decides whether the stripe carries on into the lines nested under it.",
  ].join("\n");
}

function binder(): string {
  return [
    "## Binder",
    "",
    "`inlineOverhaul → Keyboard → Binder (custom insert commands)`",
    "",
    "For text you type over and over. Put it in a row, give that row a key in",
    "`Settings → Hotkeys`, and one press drops it in wherever the cursor is.",
    "",
    "The command is made out of the row, so the text a row inserts cannot be changed",
    "afterwards: delete the row and add it again. The description is yours to edit at any",
    "time, and it is there to remind you what the row is for.",
    "",
    "One row is there from the start. `Smart bracket` cycles the brackets around the",
    "cursor or the selection: `text`, then `[text]`, then `[[text]]`, then back to `text`.",
  ].join("\n");
}

function transform(): string {
  return [
    "## Transform: a line becomes a note",
    "",
    "`inlineOverhaul → Transform`",
    "",
    "The command `Transform inline to note` turns the line the cursor is on into a note of",
    "its own. The Fields on the line become properties of the new note, and the line",
    "itself can keep a link back to it.",
    "",
    "Three things decide what the new note looks like:",
    "",
    "* the **template** it starts from, an ordinary note in the folder you name in",
    "  `Transform → Inline to note → Templates folder` and pick in `Default template`;",
    "* where it lands, which is `New notes folder` in the same group;",
    "* the **Smart Rules** in `Transform → Smart Rules`, which pick a different template",
    "  when the line carries certain Fields or Values. A line with `#meeting` can start",
    "  from a meeting template while everything else starts from the plain one. Inside one",
    "  kind of condition the rule fires when **any** of them matches; between kinds, **all**",
    "  of them have to.",
    "",
    "Which Field becomes which property of the new note is set per Field, in the",
    "`YAML property` row of that Field in `Tags & PKM → Fields`.",
    "",
    "What happens to the line you started from is `Transform → Source line`.",
  ].join("\n");
}

function proTips(): string {
  return [
    "## Some pro tips to make things smoother",
    "",
    "* **Turn the explanations on.** `General → Help → Show callouts` and `Show tips`. If",
    "  inlineOverhaul is new to you, both are worth having on: a callout explains a whole",
    "  group, a tip explains one setting.",
    "* **Do not forget to make backups.** `Advanced → Settings backup → Save a backup`",
    "  writes an ordinary note with everything you have set up. You can type into it, for",
    "  instance a reminder of why you took this copy.",
    "* **A backup brings everything back**, including the keys you gave to plugin commands.",
    "  Copy that note into another vault and restore it there, and the other vault is set",
    "  up exactly the same.",
    "* **Change one thing at a time.** Do not touch every option at once. One change, then",
    "  straight back to a real note to see whether you like the result, then the next one.",
    "* **Use the hotkeys.** You cannot get much out of this plugin without them. It is",
    "  awkward for the first day and pays for itself every day after that.",
  ].join("\n");
}

function recipes(): string {
  return [
    "## Three setups you can copy",
    "",
    "### A task list that sorts itself",
    "",
    "* `Status` (Tag): `#todo`, `#doing`, `#done`. Left Block.",
    "* `Priority` (Tag): `#low`, `#med`, `#high`. Left Block, with `#high` in red.",
    "* Bars drawn by `Priority`.",
    "* `Move left` and `Move right` on `Alt + Arrow left` and `Alt + Arrow right`.",
    "",
    "You type a line, press the TagWheel key, pick a status, and the Bar tells you the",
    "state of the whole block from across the room.",
    "",
    "### A reading log",
    "",
    "* `Source` (Link): the notes of the books you read. Right Block.",
    "* `Read` (Element) with the calendar marker: the date you got to it.",
    "* `Status` (Tag): `#queued`, `#reading`, `#finished`, with `#queued` shown as empty.",
    "  A book you have not started needs no shouting.",
    "",
    "### Meeting notes that become their own notes",
    "",
    "* `Kind` (Tag): `#standup`, `#review`, `#one-on-one`.",
    "* Transform on, a template per kind, and a Smart Rule per Value of `Kind`.",
    "* The source line keeps a link back, so the outline of the day stays readable.",
  ].join("\n");
}
