/**
 * Заметка-руководство (PRD 5.1, пункт 1; действие `open-howto`).
 *
 * Черновик пишет исполнитель, вычитывает заказчик — так записано в Приложении
 * A. Здесь только текст и путь: создаёт и открывает заметку действие реестра,
 * а vault приходит к нему швом.
 *
 * Правила текста те же, что у панели (раздел 7): сущности плагина с заглавной
 * (`Field`, `Value`, `Block`, `Prefix`, `TagWheel`, `Binder`, `Transform`,
 * `Smart Rules`), слова Obsidian и обычного языка — со строчной. Отличие одно:
 * это заметка, а не подпись контрола, поэтому предложения обычные, с точками.
 *
 * **Обещать в ней можно только то, что работает.** Плавающей кнопки Transform
 * здесь нет: за ней нет декорации CM6 (Ж3). Справочника команд нет: он ждёт
 * имён команд из фазы 2. То же правило, что и в панели (З8), только на другом
 * материале.
 */

/** Куда кладётся заметка. Имя видное: человек найдёт её поиском по vault. */
export const HOWTO_PATH = "Inline Overhaul Guide.md";

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
    recipes(),
    footer(),
  ].join("\n\n");
}

function intro(): string {
  return [
    "# Inline Overhaul: a practical guide",
    "",
    "This note is yours. The plugin creates it once and never overwrites it, so you can",
    "scribble in the margins, delete the parts you do not need, and keep your own recipes",
    "at the bottom.",
    "",
    "The idea behind the plugin is one line long: **a line of a note can carry more than",
    "words**. A status, a due date, a link to a project — put them on the same line as the",
    "thought, and you never break off to fill in a form.",
  ].join("\n");
}

function firstSteps(): string {
  return [
    "## What to set up first",
    "",
    "In this order. Each step takes a minute and makes the next one obvious.",
    "",
    "1. **Give two commands a key.** `Move left` and `Move right` are the two you will press",
    "   most: they move text inside a line, change the indent, and cycle the Prefix. Nothing",
    "   in this plugin has a key by default — that is deliberate, so it cannot fight with",
    "   what you already use. Open `Settings → Hotkeys`, type `Inline Overhaul`, and bind",
    "   those two.",
    "2. **Look at your Fields.** A fresh install comes with `Status` and `Priority`. Open",
    "   `Settings → Inline Overhaul → Tags & PKM` and see what they hold.",
    "3. **Type a line and watch it.** Write `- buy milk #todo` in any note. The tag turns",
    "   into a coloured bubble; the text stays text.",
    "4. **Open TagWheel on that line.** Bind the command that opens it, press it, and pick a",
    "   Value with the arrow keys.",
    "",
    "Everything else — Bars, Binder, Transform — is worth reading only after those four.",
  ].join("\n");
}

function fieldsAndValues(): string {
  return [
    "## Fields and Values",
    "",
    "A **Field** is a slot on the line: `Status`, `Priority`, `Project`, `Due`. A **Value**",
    "is what you put in that slot: `todo`, `doing`, `done`.",
    "",
    "A Field is one of three types, and the type decides what lands in the line:",
    "",
    "| Type | Writes | Good for |",
    "|---|---|---|",
    "| `Tag` | `#todo` | states, contexts, anything you want to search by |",
    "| `Link` | `[[Project A]]` | pointing at another note |",
    "| `Element` | `📅 2026-08-29` | dates and anything with a marker in front |",
    "",
    "Two things about Values that are worth knowing early.",
    "",
    "**A Value can have a child.** Under `Status` you can keep `open` and, under `open`, a",
    "`wip`. In the line they appear either as two bubbles or as one `#open/wip` — that is the",
    "`Child tag format` setting.",
    "",
    "**A Value can be shown as empty.** It still occupies its place in the line, but prints",
    "nothing. Useful for the state that means \"nothing special\": you see the slot is there",
    "and it is not shouting at you.",
  ].join("\n");
}

function theLine(): string {
  return [
    "## How a line is put together",
    "",
    "```",
    "- #todo #high || buy milk || [[Project A]] 📅 2026-08-29",
    "^  ^^^^^^^^^^    ^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^^^^^^^",
    "|  Left Block    your text   Right Block",
    "Prefix",
    "```",
    "",
    "* the **Prefix** is what the line starts with: a bullet, a checkbox, a heading mark;",
    "* the **Left Block** and the **Right Block** hold Fields, and each Field sits in one of",
    "  them — drag it across the line in the editor to move it;",
    "* the two `||` are **Separators**. They are what tells the plugin where your text ends",
    "  and the Fields begin, so pick something you would never type by accident.",
    "",
    "Nothing here is written into the file twice: what you see in the line is what is in the",
    "file.",
  ].join("\n");
}

function tagWheel(): string {
  return [
    "## TagWheel",
    "",
    "TagWheel is the reason the Fields are worth setting up. Put the cursor on a line, press",
    "the key you bound to it, and a small panel opens over the line with your Fields in it.",
    "Arrow keys move between Fields and between Values; the line updates as you move.",
    "",
    "Two settings change how it feels:",
    "",
    "* **`Values per side`** — how many Values show above and below the current one. Three is",
    "  comfortable; more turns it into a list you have to read.",
    "* **`Opens`** — whether the scroller opens on every Field or only where it helps.",
    "",
    "If a Field does not appear in TagWheel, check its `Active` setting and whether it waits",
    "for another Field (`Prerequisite Field`).",
  ].join("\n");
}

function bars(): string {
  return [
    "## Tag Bars",
    "",
    "A Bar is a coloured stripe in the margin. It runs down the side of a line **and",
    "everything nested under it**, so a whole block of lines tells you what it is about",
    "without you reading a single tag.",
    "",
    "One Field draws the Bars — you pick which one. Colours come from that Field's Values, so",
    "the Bars and the bubbles agree by construction.",
  ].join("\n");
}

function binder(): string {
  return [
    "## Binder",
    "",
    "For text you type over and over. Put it in a row, give that row a key, and one press",
    "drops it in wherever the cursor is.",
    "",
    "The command is made from the row, so the text a row inserts cannot be changed",
    "afterwards: delete the row and add it again. The description is yours to edit at any",
    "time — it is there to remind you what the row is for.",
  ].join("\n");
}

function transform(): string {
  return [
    "## Transform: a line becomes a note",
    "",
    "One command turns the line the cursor is on into a note of its own. The Fields on the",
    "line become properties of the new note, and the line itself can keep a link back.",
    "",
    "Two things decide what the new note looks like:",
    "",
    "* the **template** it starts from — an ordinary note in your templates folder;",
    "* the **Smart Rules**, which pick a different template when the line carries certain",
    "  Values. A line with `#meeting` can start from a meeting template while everything else",
    "  starts from the plain one.",
    "",
    "Inside one kind of condition the rule fires when **any** of them matches; between kinds,",
    "**all** of them have to. The panel says this in words above the rules.",
  ].join("\n");
}

function recipes(): string {
  return [
    "## Three setups you can copy",
    "",
    "### A task list that sorts itself",
    "",
    "* `Status` (Tag): `todo`, `doing`, `done`. Left Block.",
    "* `Priority` (Tag): `low`, `med`, `high`. Left Block, and `high` in red.",
    "* Bars drawn by `Status`.",
    "* `Move left` and `Move right` on `Alt + ←` and `Alt + →`.",
    "",
    "You type a line, press the TagWheel key, pick a status, and the Bar tells you the state",
    "of the whole block from across the room.",
    "",
    "### A reading log",
    "",
    "* `Source` (Link): the notes of the books you read. Right Block.",
    "* `Read` (Element) with the calendar marker: the date you got to it.",
    "* `Status` (Tag): `queued`, `reading`, `finished`, and `queued` shown as empty — a book",
    "  you have not started needs no shouting.",
    "",
    "### Meeting notes that become their own notes",
    "",
    "* `Kind` (Tag): `standup`, `review`, `one-on-one`.",
    "* Transform on, a template per kind, and a Smart Rule per Value of `Kind`.",
    "* The source line keeps a link back, so the outline of the day stays readable.",
  ].join("\n");
}

function footer(): string {
  return [
    "## Where things live",
    "",
    "* **Settings** — `Settings → Inline Overhaul`. Seven tabs, and each one starts with a",
    "  short paragraph about what it is for.",
    "* **Hotkeys** — `Settings → Hotkeys`, search for `Inline Overhaul`. Everything the",
    "  plugin can do is there, and none of it has a key until you give it one.",
    "* **Your setup as a note** — the `Config note` group on the `Tags & PKM` tab writes your",
    "  Fields out to a note you can read, edit and carry to another vault.",
    "",
    "---",
    "",
    "*Written by the plugin the first time you asked for the guide. It will not be",
    "overwritten, so anything you add below is safe.*",
  ].join("\n");
}
