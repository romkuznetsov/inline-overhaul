# Tutorial: your first inline field

Fifteen minutes, one path, no choices to make. By the end you will have a line that
carries a status, a priority and a due date, and a key that walks the status forward
without your hands leaving the keyboard.

This is a guided walk, not a reference. Where you could do something three ways, this
page picks one. The [feature list](../FEATURES.md) and the
[settings reference](SETTINGS.md) are where the other two live.

> [!WARNING]
> inlineOverhaul is in public beta. Do this tutorial in a scratch vault, or back up
> the one you use.

## Before you start

You need Obsidian **1.13.0** or newer on desktop, and inlineOverhaul installed and
enabled. If it is not installed yet, the four steps are in the
[README](../README.md#install-with-brat).

Make a new note called `Tutorial` and leave it open. Everything below happens in it.

## 1. Look at what you already have

Open **Settings → inlineOverhaul → Tags & PKM → Fields**.

A fresh install put four Fields there:

| Field | What it writes | Where it sits |
|---|---|---|
| `Status` | `#todo`, `#doing`, `#done` | before your text |
| `Priority` | `#low`, `#med`, `#high` | before your text |
| `Due` | 📅 and a date | after your text |
| `Project` | `[[Project A]]`, `[[Project B]]` | after your text |

A **Field** is one slot on a line. A **Value** is one thing that slot can hold. That is
the whole model — everything else in the plugin is about filling those slots quickly.

Leave all four as they are for now.

## 2. Write a line by hand

In your `Tutorial` note, type this exactly:

```markdown
- [ ] #todo #high || call the bank || [[Project A]] 📅 2026-09-15
```

Read what you just wrote. It is plain markdown — Obsidian sees two real tags, a real
link and text. Nothing is hidden. Open the file in any other editor and it looks the
same.

The `||` are **Separators**: they mark where your own text starts and ends, so the
plugin knows which part is the thought and which parts are structure.

## 3. Give the status command a key

Put the cursor anywhere on that line.

1. Open **Settings → inlineOverhaul → Keyboard → Commands & Hotkeys**.
2. Find **Tags & PKM: Status next** in the list. Every command carries the name of
   its area, so the list of one area stays together.
3. Click the key area next to it. Obsidian’s own **Hotkeys** screen opens with that
   command already found.
4. Press the plus, then press `Alt+S`.
5. Close settings.

The plugin ships with no hotkeys at all, so nothing you already use was overwritten.

## 4. Walk the status

Cursor still on the line. Press `Alt+S`.

`#todo` becomes `#doing`. Press again: `#done`. Press again: back to `#todo`.

That is the core of the plugin. The value under your cursor walks its own list, in
place, without a dialog and without your hands moving.

<img src="media/showcase/pkm-cycle.gif" width="720" alt="A status tag cycling through its values in place">

## 5. Move the line without losing its structure

Give **Navigation: Move down** a key the same way — use `Alt+Down`.

Type two more lines under the first one, any text, then put the cursor back on the
original line and press `Alt+Down` twice.

The line travels with everything it carries: both tags, the link, the date. Indentation
travels too, and so do indented children if the line has any.

## 6. Pick a value without remembering it

You will not remember every Value by heart once you have more than a handful. That is
what the **tagWheel** is for.

`Status` and `Priority` sit in the Left Block, before your text, so the command you want
is **Tags & PKM: tagWheel Left**. Give it a key — use `Alt+W` — then put the
cursor on the line and press it.

The wheel appears over the line. Left and right move between Fields, up and down between
that Field’s Values, `Tab` jumps to the Fields on the other side of your text, and
`Esc` closes it without changing anything.

<img src="media/showcase/tagwheel.gif" width="720" alt="The tagWheel opening at the cursor and a value being chosen">

## 7. Make a Field of your own

Back to **Tags & PKM → Fields**.

1. Press **Add Field**.
2. Name it `Area` and set `Type` to `Tag`.
3. Press **Add**. The new Field lands in the list on the left.
4. Drag it across the line into `Left Block`, so it is written before your text.
5. Press **Add Value** three times and fill in `work`, `home`, `errand`.
6. Close settings.

Two commands appeared in the palette on their own: **Tags & PKM: Area next** and
**Tags & PKM: Area previous**. Every Field you add brings its own pair. Give
**Tags & PKM: Area next** a key if you want to try it — the walk works exactly as the
status did in step 4.

## 8. Save what you built

**Advanced → Backup → Save a backup** writes your whole setup into a note in the vault.

Do it now. Settings live in one file, and one file is one accident away from gone.

## You are done

You have a line that carries structure, a key that walks it, a wheel for the values you
do not remember, and a copy of the setup.

What to read next, in the order it becomes useful:

| | |
|---|---|
| [**Setup and user guide**](../INSTRUCTIONS.md) | Separators, Transform safety, recovery |
| [**Settings reference**](SETTINGS.md) | The panel, tab by tab |
| [**Feature list**](../FEATURES.md) | Everything else the plugin does |
| [**Visual showcase**](SHOWCASE.md) | Thirty animations, grouped by workflow |

One thing deliberately left out: **Transform**, which turns a line into a whole note.
It is powerful and it edits your files, so it stays off until you have read
[its section in the guide](../INSTRUCTIONS.md#transform-a-line-becomes-a-note).
