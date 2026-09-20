# Brand assets

Everything people see — the README, release notes, banners, images — follows
[`.claude/skills/repo-docs/SKILL.md`](../../.claude/skills/repo-docs/SKILL.md). That is
the rulebook; this is the inventory.

## Files

| File | Use |
|---|---|
| `io-wordmark-light-anim.svg` | README header, light theme. The caret blinks |
| `io-wordmark-dark-anim.svg` | The same, dark theme |
| `io-wordmark-light.svg` | Static, for places where animation does not belong |
| `io-wordmark-dark.svg` | The same, dark theme |
| `io-wordmark-light.png`, `io-wordmark-dark.png` | 1030×136, where SVG is not supported |
| `social-preview.png` | 1280×640. Upload under **Settings → General → Social preview** |

## The mark

`[[#iO]]` — the short name inside a wikilink, with `#` making it a tag. The same
grammar as the wordmark, in a square.

| File | Use |
|---|---|
| `io-mark-light.svg` | Light grounds |
| `io-mark-dark.svg` | Dark grounds |
| `io-mark-{light,dark}-{512,256,128,64,32}.png` | Where SVG is not supported |

**The wordmark comes first.** The mark is for places that need a square and cannot show
a name: a favicon, a plugin card, an avatar. Anywhere a line of space exists, the
wordmark says more.

> [!NOTE]
> Below 24 px the brackets close up and `#iO` stops being readable — seven glyphs in a
> square is simply too many. The 32 px export is the smallest honest size; a 16 px
> favicon would need a different drawing, and there is not one.

## In markdown

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/io-wordmark-dark-anim.svg">
  <img alt="inlineOverhaul" src="docs/brand/io-wordmark-light-anim.svg" width="560">
</picture>
```

Always set the width. Minimum legible size is **360 px** — below that the caret and the
brackets collapse.

## Palette

| Token | Hex | Where |
|---|---|---|
| amber | `#ffb547` | the tag pill. The only warm colour |
| tag-ink | `#3a2400` | text inside the pill |
| link | `#4a7b9b` | the wikilink, on light |
| link-dark | `#6ba8d6` | the wikilink, on dark |
| caret | `#cb06c4` | the text caret |
| ink | `#111111` | ordinary text on light |
| cream | `#f7f4ff` | ordinary text on dark |
| night | `#141221` | dark ground: banners, social preview |
| night-soft | `#1d1b30` | badge label background, code chip |
| mark-io | `#35617d` | `iO` inside the mark, on light |
| mark-io-dark | `#7fb6db` | the same, on dark |

The steel and the magenta were sampled from a screenshot of Obsidian: that is how a
wikilink and the caret actually look in the editor. The brackets are not a separate
colour — they are `link` mixed toward the background, 55 % on light and 45 % on dark,
the way Obsidian dims markup.

**Amber appears once per image.** Two amber accents next to each other cancel out.

## Geometry

Kept so the wordmark can be rebuilt exactly rather than traced.

- **Type** — TeX Gyre Cursor Bold, outlined, so no font is needed to render it.
- **Text** — `#inline[[Overhaul]]` at 44 units, with the four brackets given 68 % of the
  mono advance and shifted by half the difference, so `[[` and `]]` sit tight.
- **Gap** — 11 units after `#in`, so the pill does not touch `line`.
- **Pill** — 8 units of padding left and right, 5 top and bottom, fully rounded ends.
- **Caret** — 11 % of the wordmark height wide, 74 % tall, set 20 % of the height after
  the last bracket.
- **Blink** — 1.6 s, `steps(1, end)`, 45 % on and 55 % off, disabled under
  `prefers-reduced-motion: reduce`.
- **Frame** — 12 units of clear space inside the viewBox on every side.

### The mark

- **Tile** — superellipse of exponent 4.6 in a 128 box, white on light, `#141221` on
  dark.
- **Text** — `[[#iO]]`, the same TeX Gyre Cursor Bold, with the four brackets given
  55 % of the mono advance so the pair reads as one bracket, not two.
- **Fit** — 106 × 62 units inside the tile, centred on its bounding box.
- **Colours** — `#` amber, `iO` `#35617d` on light and `#7fb6db` on dark, brackets the
  `iO` colour mixed 50 % toward the tile.

## Clear space

The height of the `#in` pill, on every side. Nothing enters it. For the mark, a quarter
of the tile's width.
