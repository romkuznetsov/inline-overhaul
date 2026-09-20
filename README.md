<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/io-wordmark-dark-anim.svg">
  <img alt="inlineOverhaul" src="docs/brand/io-wordmark-light-anim.svg" width="560">
</picture>

**Keep tags, links and dates on the same line as the thought.**

[![Obsidian 1.13+](https://img.shields.io/badge/Obsidian-1.13%2B-4a7b9b?style=flat-square&labelColor=1d1b30)](https://obsidian.md)
[![Release](https://img.shields.io/github/v/release/romkuznetsov/inline-overhaul?style=flat-square&labelColor=1d1b30&color=4a7b9b)](https://github.com/romkuznetsov/inline-overhaul/releases)
[![Public beta](https://img.shields.io/badge/status-public%20beta-ffb547?style=flat-square&labelColor=1d1b30)](#before-you-install)
[![MIT](https://img.shields.io/github/license/romkuznetsov/inline-overhaul?style=flat-square&labelColor=1d1b30&color=4a7b9b)](LICENSE)

<img src="docs/media/showcase/pkm-cycle.gif" width="720" alt="A status tag cycling through todo, doing and done under the cursor, without leaving the line">

</div>

Most task plugins ask you to leave the sentence you are writing: open a modal, fill a
form, come back. inlineOverhaul does the opposite — it keeps you on the line. A status,
a priority, a due date and a link to a project live next to the thought itself, and you
move, cycle and edit all of it from the keyboard.

```markdown
- [ ] #todo #high || call the bank || [[Project A]] 📅 2026-09-15
```

Everything above is ordinary markdown in the file. The tags are searchable by Obsidian,
the link is a real link, the date is text your other plugins can read. Nothing is
hidden, and nothing is stored in a database of ours.

## Before you install

> [!WARNING]
> This is a public beta. Back up your vault before installing or updating, and try
> important workflows on notes you can afford to lose.

## Install with BRAT

1. Install the **BRAT** community plugin and enable it.
2. In BRAT, choose **Add Beta plugin**.
3. Enter `romkuznetsov/inline-overhaul`.
4. Enable **inlineOverhaul** under **Settings → Community plugins**.

A fresh install arrives with four Fields, so there is something to press on the first
day: `Status` and `Priority` before your text, `Due` and `Project` after it. They are
yours to change or delete in **Tags & PKM → Fields**.

**No command has a key until you give it one.** The plugin assigns no default hotkeys,
so it cannot fight with what you already use. **Keyboard → Commands & Hotkeys** lists
every command with the key it has now. The single exception is **Expanded `Ctrl/Cmd+A`**,
which takes over a key Obsidian already owns, and it is off until you turn it on.

New here? The [tutorial](docs/tutorial.md) takes you from install to a line that works
in about fifteen minutes.

## What you get

### Move lines, and their structure with them

A line moves with everything it carries: tags, links, the date. Indentation and children
follow.

<img src="docs/media/showcase/move-lines.gif" width="720" alt="Lines moving up and down with their tags and links intact">

### Pick a value from the TagWheel

When you do not remember the values by heart, the wheel shows them around the cursor and
you choose without typing.

<img src="docs/media/showcase/tagwheel.gif" width="720" alt="The TagWheel opening at the cursor and a value being chosen">

### Cycle the prefix of a line

Bullet, checkbox, quote, heading — the line's Prefix walks its own list, so restructuring
a note does not mean retyping it.

<img src="docs/media/showcase/prefix-cycle.gif" width="720" alt="The prefix of a line cycling between bullet, checkbox and quote">

### Turn a line into a note

Transform takes the line, your template and the Values on it, and writes a note — then
cleans up the source the way you told it to.

<img src="docs/media/showcase/transform-preview.gif" width="720" alt="A line being previewed and then turned into a new note">

## Where to go next

| | |
|---|---|
| [**Tutorial**](docs/tutorial.md) | Fifteen minutes from install to a line that works |
| [**Feature list**](FEATURES.md) | Everything the plugin can do, in full |
| [**Visual showcase**](docs/showcase.md) | Thirty animations, grouped by workflow |
| [**Setup and user guide**](instructions.md) | Configuration, Transform safety, troubleshooting |
| [**Settings reference**](docs/settings.md) | The panel, tab by tab |
| [**Command id map**](docs/command_ids_v1_v2.md) | Hotkeys that came loose when identifiers changed in `0.2.0` |
| [**Changelog**](CHANGELOG.md) | What changed in every release |

## Requirements

- Obsidian desktop **1.13.0** or newer. The settings pane uses the declarative settings
  API that arrived in 1.13.
- Desktop only. Mobile is not supported.

## Build

```bash
npm install
npm run build      # bundles to dist/main.js
npm test           # build, then the full suite
```

`dist/` is build output and is not in the repository. What ships is attached to the
GitHub release: `main.js`, `manifest.json`, `styles.css`.

## Contributing

Bug reports and ideas are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Security
issues go through [SECURITY.md](SECURITY.md) instead of a public issue.

## License

MIT — see [LICENSE](LICENSE).
