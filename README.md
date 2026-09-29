<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/io-wordmark-dark-anim.svg">
  <img alt="inlineOverhaul" src="docs/brand/io-wordmark-light-anim.svg" width="560">
</picture>

**Keep tags, links and dates on the same line as the thought.**

[![Obsidian 1.13+](https://img.shields.io/badge/Obsidian-1.13%2B-4a7b9b?style=flat-square&labelColor=1d1b30)](https://obsidian.md)
[![Release](https://img.shields.io/github/v/release/romkuznetsov/inline-overhaul?style=flat-square&labelColor=1d1b30&color=4a7b9b)](https://github.com/romkuznetsov/inline-overhaul/releases)
[![Public beta](https://img.shields.io/badge/status-public%20beta-ffb547?style=flat-square&labelColor=1d1b30)](#install)
[![MIT](https://img.shields.io/github/license/romkuznetsov/inline-overhaul?style=flat-square&labelColor=1d1b30&color=4a7b9b)](LICENSE)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/line-dark.png">
  <img alt="One line in Obsidian with inlineOverhaul: a checkbox, a status and a priority drawn as colored bubbles, the text, a project link and a due date" src="docs/media/readme/line-light.png" width="588">
</picture>

[**See it in motion →**](docs/SHOWCASE.md)

</div>

Most task plugins ask you to leave the sentence you are writing: open a modal, fill a
form, come back. inlineOverhaul does the opposite — it keeps you on the line. A status,
a priority, a due date and a link to a project live next to the thought itself, and you
move, cycle and edit all of it from the keyboard.

The line above is ordinary markdown in the file:

```markdown
- [ ] #todo #high || call the bank || [[Project A]] 📅2026-09-15
```

The tags are searchable by Obsidian, the link is a real link, the date is text your
other plugins can read. Nothing is hidden, and nothing is stored in a database of ours.

## What you get

The sections follow the tabs of the settings panel, so what you read here is where you
find it later.

### Tags & PKM — a line that carries its own data

- **Fields you design.** A status, a priority, a project, a due date: each is a Field
  with its own Values, and the plugin ships no methodology of its own.
- **A key for every Field.** `Status next` walks `#todo → #doing → #done` in place,
  without touching the words around it.
- **Three kinds of Value.** Tags, links to notes, and elements such as `📅2026-09-15`
  that step by a day, a counter or your own list.

[▸ Watch it in the showcase](docs/SHOWCASE.md#direct-taglink-field-cycle-increasedecrease)

### tagWheel — choose instead of typing

When you do not remember the Values by heart, the wheel lays every Field out over the
line. Arrows move between Fields and Values, `Enter` writes the line back as plain
markdown.

[▸ Watch it in the showcase](docs/SHOWCASE.md#tagwheel-leftrightnavigationapplycancel)

### Navigation — move a line with everything it carries

- **Move up and down** with the tags, the link, the date and the whole indented tree.
- **Move left and right** cycles the Prefix — bullet, checkbox, quote, heading — so
  restructuring a note does not mean retyping it.
- **Jump** between headings, and through the parts of one line.

[▸ Watch it in the showcase](docs/SHOWCASE.md#move-linestrees)

### Keyboard — the keys you press all day, made smarter

- **Expanded `Ctrl+A`** widens the selection a step at a time: word, line, block, note.
- **Smart Enter** adds a line below instead of splitting yours; **Delete** and **Backspace** step over the indent and the Prefix.
- **Binder** puts any snippet on a hotkey; `Smart bracket` ships with it.

[▸ Watch it in the showcase](docs/SHOWCASE.md#smart-bracket)

### Transform — turn a line into a note

Transform takes the line, your template and the Values on it, and writes a note — the
Values become its properties. Smart Rules pick the template, so a `#meeting` line and a
`#bug` line become different notes.

[▸ Watch it in the showcase](docs/SHOWCASE.md#transform-inline2note)

### Visual — see the structure at a glance

Tags drawn as bubbles in your colors, a Stripe behind a Block, Tag Bars down the margin,
and a caret you can restyle. Drawing only: the file on disk stays untouched.

[▸ Watch it in the showcase](docs/SHOWCASE.md#tagwheel-panelscroller)

## Where to go next

| | |
|---|---|
| [**Tutorial**](docs/TUTORIAL.md) | Fifteen minutes from install to a line that works |
| [**Feature list**](FEATURES.md) | Everything the plugin can do, in full |
| [**Visual showcase**](docs/SHOWCASE.md) | Thirty animations, grouped by workflow |
| [**Setup and user guide**](INSTRUCTIONS.md) | Configuration, Transform safety, troubleshooting |
| [**Settings reference**](docs/SETTINGS.md) | The panel, tab by tab |
| [**Changelog**](CHANGELOG.md) | What changed in every release |

## Install

> [!WARNING]
> This is a public beta. Back up your vault before installing or updating, and try
> important workflows on notes you can afford to lose.

You need Obsidian desktop **1.13.0** or newer; mobile is not supported.

1. Install the **BRAT** community plugin and enable it.
2. In BRAT, choose **Add Beta plugin** and enter `romkuznetsov/inline-overhaul`.
3. Enable **inlineOverhaul** under **Settings → Community plugins**.

A fresh install arrives with four Fields, so there is something to press on the first
day: `Status` and `Priority` before your text, `Due` and `Project` after it. The plugin
assigns no hotkeys — **Keyboard → Commands & Hotkeys** lists every command, and you give
keys to the ones you use. Hotkeys set before `0.2.0` may have come loose: the
[command id map](docs/COMMAND_IDS_V1_V2.md) shows the old and new names.

<details>
<summary><b>Build from source and contribute</b></summary>

```bash
npm install
npm run build      # bundles to dist/main.js
npm test           # build, then the full suite
```

`dist/` is build output and is not in the repository. What ships is attached to the
GitHub release: `main.js`, `manifest.json`, `styles.css`.

Bug reports and ideas are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Security
issues go through [SECURITY.md](SECURITY.md) instead of a public issue.

</details>

## License

MIT — see [LICENSE](LICENSE).
