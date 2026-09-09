# inlineOverhaul: design brief for an LLM

Load this file into an LLM together with a request like "design a set of Fields
for me". It carries three things: **the assignment** (section 0), **the rules of
the plugin** that must not be broken (sections 1–11), and **the required shape
of the answer** (sections 12–14).

Everything here is taken from the plugin's own code, not paraphrased from
memory: the limits, the thresholds and the palette are measured. If an answer to
some question is not in this file, the plugin cannot do it, and it must not be
proposed.

---

## 0. The assignment

**Your role.** You design a set of Fields for the Obsidian plugin
`inlineOverhaul`, for one particular person. The plugin is already installed;
they will type your recommendations into its settings panel by hand.

**Your task.** Get answers to the questions in section 1, then produce one
document in the shape of section 13. The document must be ready to type into the
panel with nothing left to guess: every name, every color, every format
concrete.

**The order of work is not optional:**

1. **Read the vault, if you were given it.** Section 1.0. It is optional, and
   most people will not give it to you — but when they do, their notes answer
   half of the interview and answer it better. Read before you ask, so the
   questions become confirmations.
2. **Ask.** Put the questions of section 1.1 to the person (a single list is
   fine). Do not design before you have answers: a set of Fields follows from
   what this person scans for in their own notes, not from general ideas about
   productivity. If they answer only some of it, say plainly which assumptions
   you made on their behalf — do not go quiet about it.
3. **Then do the budget.** Section 11: how many Fields fit, how many Values, how
   many hotkeys this person is willing to remember. Cut the design down to the
   budget **before** you start writing tables.
4. **Then design.** Sections 2–10 are the rules. Every rule you break is a
   recommendation the person will type into the panel and watch not work.
5. **Then check yourself** against section 12, item by item, and only then
   answer.

**What you must not do:**

- propose capabilities that are not in this file — the plugin does not have
  them;
- propose more Fields than the budget of section 11 allows "so the person can
  choose" — choosing is your job;
- leave a color to taste, or write "pick anything with good contrast": colors
  are hexadecimal literals, and measuring the contrast is your job;
- propose Field names in a non-Latin script. A Field name accepts Latin letters
  only (section 3.3). Values, and the prose of your document, may be in any
  language the person uses — and if their notes are not in English, write the
  document in their language while keeping every identifier Latin.

---

## 1. What to learn about the person

### 1.0. If you are given the vault (optional, and it changes the interview)

The vault is a bonus, never a requirement: if the person does not offer it, go
straight to 1.1 and design from the answers. But if they do offer it, read it
first — their notes already contain most of the answers, and in a form nobody
can misremember.

**What "access" can mean.** Three forms, and they are not equal:

- **A path to the vault folder**, when you are an agent that can read files.
  The best case: everything below is answerable.
- **Pasted material** — the tag pane, a few real notes, the frontmatter of a
  typical note. Most of the value for a fraction of the access.
- **Nothing**, which is the default.

If the person offers the vault and you cannot read files, say so in one line and
ask for three cheap substitutes instead:

1. the tag list **with counts**, from Obsidian's tag pane;
2. 10–20 real lines, copied verbatim, from the notes they work in most;
3. the property names already in use — the properties list in Obsidian's
   settings, or the frontmatter of two or three typical notes.

Those three answer most of what a full read would.

**What to look for, and what each finding decides.** Twelve things. Every one of
them is a decision you would otherwise have to guess.

| What you look for | What it decides |
|---|---|
| The tag inventory **with counts** | tags used often are candidate Values; a tag used once or twice is noise and must not become one. The ranking matters more than the list |
| Which tags **never** occur together | a mutually exclusive group is exactly one Field, and its members are its Values. This is the one derivation an interview almost never gets right |
| A tag that occurs **only** alongside one other | a Prerequisite Field, or a child Value of that other tag |
| Nested tags already in use (`#area/sub`) | the person already thinks in two levels; those pairs are parent and child Values, and `Child tag format` should stay `combined` so their existing lines keep matching |
| Where on the line the tags sit | Left Block or Right Block, decided by evidence instead of by the rule in 3.4 |
| How many lines are already tasks (`- [ ]`, `- [x]`) | whether a Value `Prefix` should tie to the checkbox, and whether `Strict` is safe. A vault where every line is already a task does not need a `#done` tag at all |
| Dates typed by hand, **and their format** | the `Value format` of an `Element` must match the format already in the notes. `27.08.2026` in the notes means `DD.MM.YYYY`, whatever you would have preferred |
| Emoji already used as markers | the marker of every new `Element` has to avoid them (5.1) |
| Wikilink targets that **repeat** on lines | the Values of a `Link` Field. A target that appears once is not a Value: it is something the person will go on typing with `[[` |
| Frontmatter keys already in use, and whether they hold lists | reuse those names. Do not invent `due` where the vault says `deadline`; let cardinality follow what is already there |
| Punctuation already used as a divider (`\|`, `::`, `//`) | a warning if the plugin's Separator would collide with something they type on purpose |
| Volume: how many notes, how many tagged lines | the budget of 11.1 scales down. A vault of forty notes does not need six Fields |

**And the plugin's own state, if it is already installed.**
`<vault>/.obsidian/plugins/inline-overhaul/data.json` holds the current
configuration: `pkm.fields.order` (which Fields exist, their side, type and
labels), `pkm.fields.tags` and `pkm.fields.links` (their Values), and
`visual.tags.byTag` (the colors, keyed with the hash). Read it before proposing
anything: a person who already has Fields wants a **diff**, not a design from
scratch. `generated_rules.md` in the same folder is a projection of the same
data and is easier to skim. Note that Obsidian does not index `.obsidian/**`, so
none of this turns up in vault search — the path has to be opened directly.

**Reading does not replace the interview.** It turns open questions into
confirmations, which are cheaper to answer and much harder to answer wrongly:

- instead of "what do you scan for": "`#urgent` is on 148 lines and `#someday`
  on 6 — so urgency is what you scan for?"
- instead of "which entities have their own notes": "lines link to
  `[[Client A]]` forty times, and to sixty other notes once each — so a Link
  Field with four clients, and the rest typed by hand?"

Then ask the questions of 1.1 that no vault can answer: how many hotkeys they
will remember, whether they use Transform, which theme they run.

**Rules of engagement.**

- **Adopt the existing vocabulary before inventing one.** A Field whose Values
  are the tags the person already types costs nothing to learn. A
  better-designed vocabulary that renames three tags costs a migration.
- **Price every rename, with the line count.** The plugin does not edit notes:
  lines already written keep the old tag. "`#wip` → `doing` affects 34 lines
  you would have to fix by hand, or leave as they are" is the sentence they
  need.
- **Counts, not impressions.** "Often" is not a finding. If you could not count
  it, say the number is unknown.
- **Say what you read and what you did not** — how many notes, whether you
  opened `data.json`, which folders you skipped.
- **Do not quote note content beyond short line examples**, and prefer the
  person's own examples. You are reading a private vault in order to design for
  it, not to summarise it.
- **When the vault contradicts an answer, put both on the table.** "You said you
  do not tag by hand, but 60% of tagged lines carry tags no Field would have
  produced" — and let them settle it.

### 1.1. The questions to ask

Ask these before designing. There are nine, and each one changes the result. If
you read the vault, ask the ones it could not answer and turn the rest into
confirmations.

1. **What kind of notes.** Work tasks, a journal, lecture notes, a knowledge
   base, a CRM, everything at once? Ask for 3–5 examples of typical lines, in
   the shape they write them today.
2. **What they scan for.** Opening a long list of lines, what do they want to
   see instantly, without reading the text? This becomes the main Field and the
   color of the Tag Bars. Usually one or two things: "what is on fire" or "how
   far along it is".
3. **What they search for.** Which of these do they expect to find through
   Obsidian search, Dataview or Bases? This tells you which Values have to stay
   tags, and what belongs in a note property instead.
4. **Entities that deserve their own note.** Projects, people, clients, books,
   companies — do these have notes of their own? If so they are Fields of type
   `Link`, not tags.
5. **Dates and numbers.** Do they need a deadline, a created date, a time, an
   estimate in hours, a counter, an id? Which ones exactly, and in what shape do
   they want to see them on the line.
6. **Mutually dependent facts.** Is there anything that only makes sense given
   something else — the kind of a meeting, only on lines that are meetings? That
   is a Prerequisite Field, not another independent Field.
7. **How many hotkeys they will remember.** One (TagWheel only) or five or six
   (a key per frequent Field)? This decides how many Fields are worth having and
   which of them should be `Commands only`.
8. **Transform.** Do they plan to turn lines into notes of their own
   (`Inline to note`)? If not, the note-properties section and Smart Rules do
   not belong in your answer at all, and you should not mention them.
9. **Theme.** Light, dark or both? This decides the text color paired with each
   fill (section 7).

Plus two questions people rarely put to themselves, and should:

10. **What they already tag by hand.** Those tags either become Values of a
    Field, or get colors as free tags (section 7.8).
11. **What they are willing to leave unmarked.** A fact that turns up on one
    line in twenty is not worth a Field: it takes up room in TagWheel on every
    line.

---

## 2. How a line is put together

```
- #todo #high || buy milk || [[Project A]] 📅2026-08-29
^  ^^^^^^^^^^    ^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^^^^^^
|  Left Block    your text   Right Block
Prefix
```

- **Prefix** — what the line starts with: a list bullet, a checkbox, a heading
  mark. Some Values are allowed to change it (section 4.4).
- **Left Block** — everything written **before** the person's text.
- **Right Block** — everything written **after** it.
- **Separator** — the two markers that fence the text off from the Blocks, `||`
  and `||` by default. They are not decoration: they are how the plugin finds
  where the text ends.
- Every Field lives in exactly one Block. The order of Fields inside a Block is
  the order of the tokens on the line.

**What matters about the Separator when designing.** Lines already written with
the old Separator are not rewritten when it changes — the plugin does not edit
notes. So the Separator is chosen once and left alone. Two or more characters
that nobody types by accident and that Markdown does not claim: `||` and `::`
are good, `==` is not, because Obsidian reads it as a highlight. **Do not
propose changing the Separator unless asked** — leave `||`.

An `element` Field sits **flush against its marker**: `📅2026-08-29`, with no
space between the emoji and the value.

---

## 3. Field

**A Field is one slot on a line.** The slot has a type, and the type decides
what the slot can do. One Field carries Values of exactly one type: tags, or
links, or elements, never a mix.

### 3.1. The three types

| Type in the panel | Writes | What it can do | Good for |
|---|---|---|---|
| `Tag` | `#todo` | a list of Values, child Values, colors, `Show`, `Prefix` | states, contexts, anything searched for and worth seeing in color |
| `Link` | `[[Project A]]` | a list of Values, child Values, `Prefix`. **No colors** | pointing at another note |
| `Element` (`Emoji` in the list) | `📅2026-08-29` | one Value: an emoji marker, a format and a stepping rule. **No list of Values, no colors, no children** | dates, times, counters, ids |

### 3.2. How to choose the type — the rule

- The set of values is **closed and small** (3–7) and the values are words
  rather than entities → **`Tag`**.
- The set is **open** and the values are entities that deserve a note of their
  own (a project, a person, a book, a client) → **`Link`**.
- The value is a **datum behind a marker**: a date, a time, a number, an id →
  **`Element`**.

The test to run before calling something a tag: "will there be a twentieth value
six months from now?" If yes it is a `Link`, not a `Tag` — cycling
`next`/`previous` through twenty values is useless, and TagWheel becomes
unreadable.

### 3.3. The name of a Field

- Allowed: **Latin letters (any case), digits, space, `-`, `_`**. Cyrillic, CJK,
  `/`, `.`, `#`, `:` are rejected by the panel.
- The name is **unique** among all Fields.
- The name **must not end in `_sub`** — that suffix is reserved for child
  Fields.
- The name is what the person sees in the panel, and it goes into the **names of
  the commands**: a Field `Priority` gets `Priority next` and
  `Priority previous`.
- **Renaming is expensive, and you must say so:** lines already written keep the
  old tag (the plugin does not edit notes), and a hotkey given to this Field's
  commands comes loose — Obsidian keeps hotkeys by command id, and the id is
  built from the name. So the names in your document have to be the ones this
  person will live with: short, unambiguous, no "v2", no alternatives offered.
- There is also **`Name in TagWheel`** — a shorter label for the TagWheel row,
  where Fields stand side by side and a long name crowds its neighbours.
  `Status` → `Stat`. **Always give one when the name is longer than 6
  characters.** Notes keep the full name.

### 3.4. Left Block or Right Block

The rule is simple and it holds:

- **Left Block** — what the person **scans**: state, urgency, the kind of line.
  It stands before the text, it is what the eye meets first, and it is where the
  color of the Tag Bars comes from.
- **Right Block** — what the person **refers to**: dates, links to projects and
  people, ids. It stands after the text and does not get in the way of reading.

The Fields of each Block appear on the line in the order they stand in the
panel's list. State the order explicitly in your answer: it decides both the
look of the line and how Prefix conflicts are settled (section 4.4).

---

## 4. Values

### 4.1. What a Value of each type has

| Column | `Tag` | `Link` | `Element` |
|---|---|---|---|
| `Value` (the token itself) | yes | yes | one value, defined by the format |
| `Level` (parent / child) | yes | yes | no |
| `Prefix` (line checkbox) | yes | yes | no |
| `Show` (default / empty / custom) | yes | **no** | no |
| `Fill`, `Text` (colors) | yes | **no** | no |

The design consequence of that table is the important one: **only tags speak in
color.** Links and elements stay ordinary text on the line. If the person wants
to see something in color, that something has to be a Field of type `Tag`.

A tag token may be written with `#` or without — both read the same. A link may
be written `[[link]]` or `link` — the same. **A tag never contains a space**;
that is Obsidian's rule, not the plugin's: `in progress` is not a tag,
`in-progress` is.

### 4.2. Child Values

- There are **exactly two levels**: a top-level Value and a child Value. **There
  is no grandchild** — three-level trees must not be proposed.
- Only `Tag` and `Link` have child Values.
- A child Value is live only once its parent is on the line.
- A child Value lives in the same Block and takes its parent's `Behavior`.
- For child Values to reach TagWheel, **two** things must hold: the Field has
  `Child Field` switched on, and the parent Value is already picked on the line.
- How a child Value is written is **one setting for the whole plugin** —
  `Tags & PKM → Writing rules → Child tag format`: either `#doing #review` (two
  tags) or `#doing/review` (one tag). **It is not per Field**, so two Fields
  cannot behave differently — if it matters, state the one choice for the whole
  set. `#parent/child` keeps the pair together in Obsidian's tag list but makes
  a search for the parent need a slash; two separate tags are found by searching
  the parent.

### 4.3. `Show`: default / empty / custom

Tags only.

- `default` — the Value itself is printed.
- `empty` — a colored bubble with **no text**. The tag stays in the file, search
  still finds it, and the line is shorter.
- `custom` — the text you give is printed instead.

**This is a working tool, not decoration.** A Value that is obvious anyway
(`#queued` on a book not yet started; `#todo` on a task that is todo by default)
goes to `empty`: the color stays, the noise goes. Use it deliberately and tell
the person why.

### 4.4. `Prefix` on a Value

A Value may change the start of the line, usually into a checkbox.

- Shape: **brackets with exactly one character inside** — `[ ]`, `[x]`, `[/]`,
  `[!]`. That is how Obsidian itself reads a task; brackets with two characters
  or more are not a task to it, and the panel will not accept such a value.
- Empty leaves the line's usual list marker.
- If two Values on one line both want the Prefix, one wins, and
  `Tags & PKM → Prefix priority` decides which: either by the order of the
  Fields (simpler, and the default) or by a ranked list of markers. **Avoid
  designs where two Fields compete for the Prefix** — it is an extra setting the
  person has to reason about. Let one Field own the Prefix, usually `Status`.
- A useful pairing: `Status = done` with Prefix `[x]` — one keypress both closes
  the task for Obsidian and colors the tag.

---

## 5. The `Element` type in detail

An element has no list of values — it has **a marker, a format and a stepping
rule**.

### 5.1. `Emoji-prefix`

One character or emoji standing in front of the value: `📅`, `⏰`, `🔁`, `#️⃣`.

**The marker must be unique across all Fields.** The plugin recognises an
element on a line **by its marker alone**: `📅2026-08-29` is the Field `Due`
precisely because `📅` stands in front. Two Fields with one marker will be taken
for one Field. Keep a list of markers you have used and check it before you
answer.

### 5.2. `Value format`

The grammar is closed. Do not invent additions to it:

- `YYYY` year, `MM` month, `DD` day, `HH` hour, `mm` minute, `ss` second, with
  any separators between them. `YYYY-MM-DD` → `2026-08-27`, `DD.MM` → `27.08`,
  `HHmm` → `1435`, `YYYY-MM-DD HH:mm` → `2026-08-27 14:35`.
- **Digits alone** make a counter, and the number of digits is the width it
  keeps: `1` counts `1, 2, 3`, while `001` counts `001, 002, 003`.
- Anything else is taken as plain text and **never steps**.

### 5.3. `Steps by` — what a keypress does

| Mode | What it does | What else you set |
|---|---|---|
| `Fixed step` | adds the same amount on every press | `Amount`. What one unit means comes from the format: a day for `YYYY-MM-DD`, a minute for `HHmm`, one for a counter |
| `Command` | throws the old value away and writes a fresh one | `Command`: `The current date and time` (the moment of the press, in the format set), `Random numbers`, `Random characters` — the last two are what an id needs |
| `Custom step` | walks a list of steps written by the person | `Steps`: one step per line. A number in brackets says how many presses stay on that step — `1 (3)` moves by one for three presses. `END` ends the cycle and removes the value from the line |

`next` adds, `previous` takes the same back.

**How to choose:** a deadline the person nudges from today — `Fixed step` with
`Amount 1`. A "when I finished it" stamp — `Command → The current date and
time`. A line id — `Command → Random characters`. An estimate in hours or
points — `Custom step` with a ladder that means something (`1`, `2`, `3`, `5`,
`8`, `END`).

---

## 6. How a Field behaves

Four settings, and there are no others.

### 6.1. `Active`

- `Yes` — the Field works everywhere: in TagWheel and through its commands.
- `Commands only` — the Field is out of TagWheel, its commands still work. **For
  what is needed rarely, or what the person sets with one key**, so it does not
  take up room in the panel.
- `No` — off entirely, but not deleted.

This is the first way to save room in TagWheel: a Field driven by a hotkey does
not have to stand in the panel.

### 6.2. `Prefix behavior`

| Mode | What it does |
|---|---|
| `Strict` | writes the Value in its own Block and **changes** the line Prefix |
| `Insert only` | writes the Value in its own Block and leaves the Prefix alone |
| `Free` | inserts the Value **where the cursor is** |

`Strict` is the default. `Free` is rarely right — only for a Field the person
wants to drop mid-sentence. **Do not set `Free` without a reason**, or the token
lands in the text rather than in a Block and the line stops parsing
predictably.

### 6.3. `Child Field`

`Yes` gives the Field a child Field (key `<Name>_sub`) and lets child Values
reach TagWheel. It also adds two commands, `<Name>-sub next` and
`<Name>-sub previous`. The child takes its short name from the parent and adds
`_sub`.

Switch it on only where child Values actually exist: an empty child Field that
is switched on is two more commands cluttering the hotkeys screen.

### 6.4. `Prerequisite Field`

A Field with a prerequisite appears **nowhere** — not in TagWheel, not through
its commands, not on the line — until the Field it waits for has a Value.

- **A type limit that cannot be bent:** a `Tag` Field may wait **only for
  another `Tag`**. `Link` and `Element` may wait for any Field.
- It can wait for **any Value** (`Any Value`) or for **one named Value**.
  Exactly one: there is no list here.
- Changing the Value of the Field it waits for **clears** the dependent Field.
- Two tags tied this way are also kept next to each other on the line.
- A Field cannot wait for itself, and loops are rejected.

**This is the main tool against a bloated TagWheel.** A fact that matters on one
line in ten (the kind of a meeting, the stage of a deal, the chapter of a book)
gets a prerequisite and stops bothering the other nine lines.

---

## 7. Colors

This is the section that decides whether the result is any good. "Pick a
contrasting color" is not an acceptable output here — literals and measured
contrast are.

### 7.1. What actually gets colored

- **The Values of a tag Field** — `Fill` (the bubble behind it) and `Text` (the
  writing inside it).
- **The person's own tags**, belonging to no Field — the same pair (section
  7.8).
- **Tag Bars** — stripes in the note margin, taking the Value colors of one
  chosen tag Field (section 7.7).
- Links, elements and the person's text are **not colored at all**.

### 7.2. The form colors are written in

- `#rrggbb` only. No color names, no `rgb()`, no theme variables: the panel's
  color control accepts a hexadecimal literal and nothing else.
- **Give both columns — `Fill` and `Text`.** A text color left to the theme
  disappears on a colored fill: in a light theme the theme hands you dark text,
  and on a dark blue bubble it is gone. This is not taste; it is a bug the
  plugin already had to fix in its own starter set.
- An empty value means "take it from the theme". That is only right where there
  is no fill.

### 7.3. Contrast — the floor is 3:1

The panel shows a warning when the contrast of a `Fill`/`Text` pair falls below
**3:1** (the WCAG 2.1 threshold for large text and interface elements). Your
recommendation must not raise that warning on a single Value.

Compute the ratio the WCAG way: relative luminance
`L = 0.2126·R + 0.7152·G + 0.0722·B` with each channel normalised to 0…1 and
linearised (`c ≤ 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`), then
`(L_lighter + 0.05) / (L_darker + 0.05)`.

**Aim for ≥ 4:1, not 3:1**: 3:1 is where the warning starts, not where reading
is comfortable. Every pair in the palette below is measured and quoted with its
number.

### 7.4. Meaning: a color must say what the person already thinks

| Meaning | Color |
|---|---|
| urgent, on fire, blocked, error | red |
| attention, waiting, soon, medium | amber / orange |
| in progress, moving | orange or blue (pick one and stay with it) |
| done, closed, succeeded | green |
| neutral, planned, informational | blue |
| unimportant, deferred, archived, draft | grey / muted |
| a category of its own, personal | violet, magenta, teal |

Two rules on top of that table:

- **An ordinal scale is a monotone ladder.** If the Values are `low → med →
  high`, the colors must climb in meaning **and in luminance**, so the scale
  still reads in greyscale. Check that luminance moves one way only.
- **A nominal set is different hues at similar luminance.** If the Values are
  `#work`, `#home`, `#study` there is no order between them, so no ladder:
  different hues at a similar saturation.

### 7.5. Telling colors apart

- **Two fills that can appear on the same line differ in hue by at least
  25–30°.** Red `#c0392b` (H6) and orange `#c05a1e` (H22) are 16° apart — never
  side by side.
- A difference in saturation counts too: grey `#6b7280` (H220, S9%) and blue
  `#3b6fd4` (H220, S64%) are formally the same hue and still read apart.
- **Do not repeat a hue across two Fields that meet on one line.** Red on
  `Priority` and red on `Status` means one color carrying two meanings — exactly
  the kind of contradiction that must not survive your self-check.
- A red / green pair side by side is a problem for colorblind readers. Keep it
  inside a single ordinal ladder where luminance moves monotonically, and do not
  let color be the only signal: at the ends of a scale a `Prefix` (`[x]`, `[!]`)
  earns its keep.
- There are no more than nine simultaneously distinguishable fills. If a Field
  has more than nine Values, that is not a palette problem — those are extra
  Values (section 11).

### 7.6. The measured palette

Contrast computed with the formula in 7.3. Take colors from here: they are
measured, and laid out in hue so that they do not argue with each other.

**The core — nine fills, all distinguishable at once** (any two are ≥ 25° apart
in hue):

| Role | `Fill` | `Text` | Contrast | Hue |
|---|---|---|---|---|
| red | `#c0392b` | `#ffffff` | 5.4:1 | 6° |
| amber | `#b07d10` | `#1a1a1a` | 4.8:1 | 41° |
| green | `#2f8a4c` | `#ffffff` | 4.3:1 | 139° |
| teal | `#17807a` | `#ffffff` | 4.8:1 | 177° |
| blue | `#3b6fd4` | `#ffffff` | 4.8:1 | 220° |
| violet | `#7146c4` | `#ffffff` | 6.2:1 | 260° |
| magenta | `#9c3d92` | `#ffffff` | 6.0:1 | 306° |
| pink | `#bb3f6e` | `#ffffff` | 5.2:1 | 337° |
| grey | `#6b7280` | `#ffffff` | 4.8:1 | 220°, S9% |

**Substitutes** — fine instead of their neighbour in hue, never next to it:

| Role | `Fill` | `Text` | Contrast | Hue | Not next to |
|---|---|---|---|---|---|
| orange | `#c05a1e` | `#ffffff` | 4.5:1 | 22° | red, amber |
| olive | `#7d7a14` | `#ffffff` | 4.5:1 | 58° | amber |
| cyan | `#1a7594` | `#ffffff` | 5.2:1 | 195° | teal |
| indigo | `#4a52c8` | `#ffffff` | 6.3:1 | 236° | blue, violet |
| brown | `#8a5a3c` | `#ffffff` | 5.8:1 | 23° | orange, red |
| slate | `#4a5568` | `#ffffff` | 7.5:1 | 218° | grey |

**Muted fills** — for "unimportant", "archive", and `Show: empty`:

| Role | `Fill` | `Text` | Contrast |
|---|---|---|---|
| light grey | `#cdd2d8` | `#1a1a1a` | 11.4:1 |
| blue grey | `#9ba8b8` | `#1a1a1a` | 7.2:1 |

**Ready-made ladders.** Relative luminance is given for each step, and it moves
one way only — that is what makes the ladder survive greyscale:

- three steps, "calm → attention → urgent":
  `#9ba8b8`/`#1a1a1a` (7.2:1, L 0.384) → `#b07d10`/`#1a1a1a` (4.8:1, L 0.239) →
  `#a8231b`/`#ffffff` (7.2:1, L 0.096)
- three steps, "planned → in progress → done":
  `#3b6fd4`/`#ffffff` (4.8:1, L 0.171) → `#c05a1e`/`#ffffff` (4.5:1, L 0.186) →
  `#2f8a4c`/`#ffffff` (4.3:1, L 0.193)
- five steps of importance:
  `#8a9099`/`#1a1a1a` (5.4:1, L 0.276) → `#5f8ac7`/`#1a1a1a` (4.9:1, L 0.248) →
  `#b07d10`/`#1a1a1a` (4.8:1, L 0.239) → `#c05a1e`/`#ffffff` (4.5:1, L 0.186) →
  `#a8231b`/`#ffffff` (7.2:1, L 0.096)

**The obvious version of the first ladder is not monotone, and this is worth
knowing before you build one of your own.** Grey `#6b7280` → amber `#b07d10` →
red `#c0392b` reads perfectly well as meaning, and its luminance goes
0.167 → 0.239 → 0.143: up, then down. In greyscale the middle step becomes the
lightest of the three and the scale stops being a scale. A color ladder is
measured, not eyeballed — and a ladder assembled from three colors that each
pass 4:1 against their text is not thereby a ladder.

**The plugin's own starter set**, as a sense of what "fine" looks like:
`#todo` `#3b6fd4`, `#doing` `#c77b26`, `#done` `#2f8a4c`, `#low` `#6b7280`,
`#med` `#b07d10`, `#high` `#c0392b`, all with `#ffffff` text.

**Both themes.** Every fill in the core set is mid-toned and works on a light
page and a dark one. If the person said "dark theme only", the muted light fills
of the third table can be used more freely; if "light only", go carefully with
slate and indigo — they are heavy there.

### 7.7. Tag Bars

A stripe in the note margin, running alongside a line **and everything nested
under it**. It reads from across the page without anyone reading a tag.

- Bars are drawn by **exactly one Field**, and only a `Tag` Field.
- The Bar colors *are* the Value colors of that Field. They have no palette of
  their own.

The design consequence: **the Field chosen for Bars carries the most important
palette in the set.** Pick the one thing the person scans a page for (the answer
to intake question 2) and make its colors the most contrasting and least
ambiguous of all. Name that Field explicitly in your answer.

### 7.8. The person's own tags

Tags typed by hand, belonging to no Field, still get a bubble:
`Visual → Color your Tags`. There is `Fill`, `Text` and `Show` (only `default`
and `empty` there), but no `Level` and no `Prefix`.

If the intake shows they will keep typing certain tags by hand, give colors for
those in a section of their own — by the same rules, and **without reusing the
hues of the Fields**.

---

## 8. Note properties and Transform

Only relevant to someone who uses `Transform → Inline to note` (intake question
8). If they do not, leave this out of your answer.

`Inline to note` turns a line into a note of its own. Each Field can be written
into a **property** of that note (the ones Obsidian shows at the top of a note).
It is set per Field, in three rows:

| Row | Values | What it decides |
|---|---|---|
| `Property` | a name, or empty | where the Field goes. Empty means the Field is **not copied** at all |
| `Property type` | `Auto` / `One Value` / `A list` | one value or a list. `Auto` makes it a list when more than one Field writes to the same property |
| `How to show Value in YAML` | `Raw` / `Clean` | `Raw` copies it as it appears on the line, hash and emoji included. `Clean` strips the decoration: no `#` on a tag, no emoji on a date, no `[[ ]]` around a link |

Rules to respect:

- **`Clean` for anything that will be sorted or filtered** (dates, numbers,
  values destined for Dataview or Bases). `Raw` for what should stay a tag or a
  link inside the property.
- **The `tags` property does not take links** — Obsidian will flag the value in
  the note. Never send a `Link` Field to `tags`.
- Send a date as `Clean` with the format `YYYY-MM-DD`: that is the only way
  Obsidian reads it as a date.
- Several Fields may write to one property, and `Auto` will make it a list. That
  is a legitimate move (every context into one `context`), but say so out loud.
- Give property names in lower case without spaces (`due`, `project`, `status`)
  — easier to write in queries.

---

## 9. Smart Rules

`Transform → Smart Rules` choose **a different template and a different folder**
for the new note, based on what stands on the line.

- A condition is one particular Value of one particular Field (or "any Value" of
  that Field).
- **How conditions combine:** within one kind (`Tag`, `Element`, `Link`,
  `Field`) it fires on **any** of the listed ones; between kinds **all** the
  kinds have to match. That is the whole logic — there is no manual `and` / `or`.
- Rules are checked in order; a line matching none gets the default template.

When designing: one rule per Value of the Field that answers "what kind of line
is this" (meeting, task, idea, book). Do not breed rules for intersections —
nobody will maintain them.

---

## 10. Commands and hotkeys

- **Every Field creates two commands of its own**: `<Name> next` and
  `<Name> previous`. A switched-on `Child Field` adds two more. A command walks
  the Values in a circle: nothing → the first Value → … → the last → nothing
  again.
- **The plugin assigns no hotkeys at all** — deliberately, so it cannot fight
  what the person has already bound. Everything is assigned by hand in
  `Settings → Hotkeys`.
- The one key that matters most is `Open TagWheel on the left`: one key for all
  Fields.
- Hence the budget: **Fields are limited not by room but by memory.** If the
  intake said one key, design so that everything is reachable through TagWheel,
  and do not lay out six hotkeys.

In your answer, say for each Field whether it deserves a key of its own, and
propose 1–3 concrete combinations only for the most frequent ones (usually
`Status` and `Priority`). You cannot know what is already taken — say so: "if it
is taken, Obsidian will show the conflict".

---

## 11. Budgets and anti-patterns

### 11.1. Budgets

The plugin enforces no hard limits. The limits are the person and the width of a
line.

| What | Recommended | Why |
|---|---|---|
| Fields in Left Block | 2–3 | all of it is printed before the text; four tags and a sentence are no longer findable |
| Fields in Right Block | 2–3 | the same after the text |
| Fields active in TagWheel | up to 5–6 | TagWheel stands them in a row; past that the labels stop reading |
| Values in one Field | 3–7 | `next`/`previous` walk the list linearly: the eighth Value is seven presses away |
| Levels of Values | 2 (parent + child) | the plugin does no more |
| Fields drawing Bars | 1 | the plugin does no more |
| Simultaneously distinguishable fills | up to 9 | section 7.5 |

Over budget? First move rare Fields to `Commands only`, then to a
`Prerequisite Field`, and only then drop a Field.

### 11.2. Anti-patterns — what makes a set redundant or self-contradictory

1. **Two Fields about one thing.** `Status` with `#done` plus a separate
   `Completed` Field says it twice. The tell: the Values of one Field can be
   derived from the Values of another.
2. **A tag where a link belongs.** A `Project` Field of type `Tag` with fifteen
   Values: cycling is useless, TagWheel is unreadable, and the project has no
   note. That is a `Link`.
3. **A Field for something rare.** It takes up room on every line. That is a
   `Prerequisite Field`, or `Commands only`.
4. **A Field with one Value.** That is a flag, not a slot. Either give it a
   second meaningful Value, or make it one of the person's own tags (section
   7.8) or a Binder row.
5. **Duplicating Obsidian's checkbox.** `#done` **and** `[x]` — pick one, or
   bind them deliberately through the Value's `Prefix` (section 4.4). Two
   independent ways to say "done" will disagree on the first line.
6. **One hue in two Fields.** Section 7.5.
7. **A fight over the Prefix.** Two Fields whose Values both change the start of
   the line force the person into `Prefix priority`. Let one Field own it.
8. **A Field for something that belongs to the whole note.** Author, note type,
   language — that is the note's frontmatter, not an inline Field. A Field
   describes **a line**.
9. **An open time scale in a tag.** `#week1`, `#week2` is an `Element` with a
   format or a counter.
10. **Child Values for the sake of nesting.** A child Value is justified when it
    only makes sense under its parent (`#doing/review`). Otherwise it is another
    Field, or simply one more top-level Value.

---

## 12. Check yourself before answering

Go through this list item by item. Each item is something that will otherwise
fail on the person's screen.

**Names and types**

1. Every Field name uses Latin letters, digits, space, `-`, `_` only; none ends
   in `_sub`; all are distinct.
2. Every Field has a type, and the type follows the rule in 3.2.
3. Every name longer than 6 characters has a `Name in TagWheel`.
4. Every Field has a Block (`Left` / `Right`) and a position in the order.

**Values**

5. No tag Value contains a space.
6. No tree of Values is deeper than two levels.
7. No `Link` or `Element` Field has been given a `Show` or any colors.
8. No `Element` Field has a list of Values — only a marker, a format and a
   stepping rule.
9. Every `Element` emoji marker is distinct from all the others.
10. Every `Element` format is built from the pieces allowed in 5.2.
11. Every Value `Prefix` is brackets with exactly one character.

**Colors**

12. Every tag Value has **both** `Fill` **and** `Text`, both as `#rrggbb`.
13. Every pair has a computed contrast, and it is **not below 4:1** (3:1 is the
    warning threshold, not the goal).
14. Ordinal sets of Values climb monotonically in luminance.
15. Fills that can meet on one line are ≥ 25° apart in hue.
16. No hue is repeated across two Fields.
17. Exactly one Field is named for Tag Bars, and it is a `Tag`.

**Behavior**

18. No `Tag` waits on a Field of another type.
19. No loops in prerequisites; no Field waits for itself.
20. `Child Field` is on only where child Values exist.
21. No two Fields compete for the Prefix.

**Budget and coherence**

22. The budgets of 11.1 hold; if not, you have said what was given up.
23. No anti-pattern from 11.2 is reproduced.
24. The note-properties section exists only if the person uses Transform, and no
    `Link` Field is sent to `tags`.
25. Every recommendation follows from something the person said, not from
    general reasoning. Where there was nothing to follow, the assumption is
    stated out loud.

**If you read the vault (section 1.0)**

26. Every Value that replaces a tag they already use is named as a rename, with
    the number of lines it affects.
27. Property names already in the vault are reused, not reinvented.
28. Every `Element` format matches a date or number format already in their
    notes, or you have said why you are changing it.
29. No new `Element` marker collides with an emoji already used in the notes.
30. If the plugin was already configured, your answer is a diff against
    `data.json` — what stays, what changes, what goes — not a fresh design that
    silently discards their setup.
31. Every finding is a count, and you have said what you read and what you
    skipped.

---

## 13. The shape of the answer

Answer with **one Markdown document** in exactly this structure. Write the prose
in the person's language; write Field names, Values, property names and colors
exactly as they will be typed into the panel.

```markdown
# PKM for <who / what> — a set of Fields for inlineOverhaul

## What I understood about your work
3–6 lines: what kind of notes, what you scan for, what you search for.
A separate paragraph for the assumptions I made where your answers ran out.

## The result in one picture
3–4 real lines as they will look once this is set up.

## Fields

### 1. <Name> — <type>
| Setting | Value |
|---|---|
| Name | <Latin> |
| Name in TagWheel | <short, or "not needed"> |
| Type | Tag / Link / Element |
| Block | Left / Right, position N |
| Active | Yes / Commands only / No |
| Prefix behavior | Strict / Insert only / Free |
| Child Field | Yes / No |
| Prerequisite Field | "none", or "<Field> = <Value>" |
| Property | <name> / not written |
| Property type | Auto / One Value / A list |
| Value form | Raw / Clean |

Values (for a Tag):
| Level | Value | Prefix | Show | Fill | Text | Contrast | Means |
|---|---|---|---|---|---|---|---|
| 0 | todo | | empty | #3b6fd4 | #ffffff | 4.8:1 | not started |

Values (for a Link): Level, Value, Prefix — no colors.

Element (for an Element):
| Emoji-prefix | Value format | Steps by | Amount / Command / Steps |

**Why this Field:** one or two lines, tied to what the person actually said.

### 2. ... (one per Field)

## Tag Bars
Which Field draws the stripes, and why that one.

## Colors: the whole set at a glance
Every color of the set in one table, so it is visible that no hue argues:
| Field | Value | Fill | Text | Contrast | Hue |

## Your own tags (if any)
The tags you type by hand, and colors for them.

## Note properties and Transform (only if you use it)
| Field | Property | Type | Form | What lands in the note |
Plus Smart Rules if needed: condition → template → folder.

## Hotkeys
What is worth a key, 1–3 entries, no more.

## Set-up order: do it in this sequence
A numbered list of exactly what to click, in the right order:
1. Tags & PKM → Fields → Add Field: <Name>, type <type>
2. ... Values, colors, Behavior
3. Visual → Tag Bars → Which Field draws Bars: <Name>
4. ...
The order is not cosmetic: a prerequisite Field is created before the Field that
waits for it, a parent Value before its child, Bars last.

## What I deliberately left out
2–5 entries: what asked to be included but did not fit the budget or duplicated
something else, and what to do if the person wants it anyway.

## How to start living with it
What to set up today (minimum: one Field and one hotkey) and what to leave for a
week from now, once it is clear what is missing.
```

Two demands on the tone:

- **No "you could do this, or alternatively that".** They asked for a decision.
  Alternatives live in "what I deliberately left out", one line each.
- **Explain every Field in the person's own words**, not through productivity
  theory.

---

## 14. A model fragment of a correct answer

On the input "work tasks and meeting notes; I scan for what is on fire; projects
have their own notes; I need deadlines; meetings are rare; I will learn two
hotkeys; I do use Transform".

### Fields

**1. `Status` — Tag, Left Block, position 1**

| Setting | Value |
|---|---|
| Name | `Status` |
| Name in TagWheel | not needed (6 characters) |
| Active | `Yes` |
| Prefix behavior | `Strict` |
| Child Field | `No` |
| Prerequisite Field | none |
| Property | `status`, `One Value`, `Clean` |

| Level | Value | Prefix | Show | Fill | Text | Contrast | Means |
|---|---|---|---|---|---|---|---|
| 0 | `todo` | `[ ]` | `empty` | `#3b6fd4` | `#ffffff` | 4.8:1 | not started — the default, so no text |
| 0 | `doing` | `[/]` | `default` | `#c05a1e` | `#ffffff` | 4.5:1 | in progress |
| 0 | `done` | `[x]` | `default` | `#2f8a4c` | `#ffffff` | 4.3:1 | closed |

**Why:** you said you scan for "what is on fire", and this is the first of the
two things you scan for. It also sets the checkbox, so your tasks stay tasks to
Obsidian itself. `todo` is shown as an empty bubble: a line is `todo` by
default, and spelling that out earns nothing.

**2. `Priority` — Tag, Left Block, position 2** — this is the Field that draws
Bars.

| Level | Value | Prefix | Show | Fill | Text | Contrast | Means |
|---|---|---|---|---|---|---|---|
| 0 | `low` | | `empty` | `#6b7280` | `#ffffff` | 4.8:1 | later |
| 0 | `med` | | `default` | `#b07d10` | `#1a1a1a` | 4.8:1 | this week |
| 0 | `high` | `[!]` | `default` | `#c0392b` | `#ffffff` | 5.4:1 | on fire |

The ladder is monotone in luminance (grey → amber → red), so the scale reads
even where the color does not.

**3. `Due` — Element, Right Block, position 1**

| Emoji-prefix | Value format | Steps by | Amount |
|---|---|---|---|
| `📅` | `YYYY-MM-DD` | `Fixed step` | `1` (one day per press) |

Property `due`, `One Value`, `Clean` — otherwise Obsidian will not read it as a
date.

**4. `Project` — Link, Right Block, position 2** — Values `[[Project A]]`,
`[[Project B]]`; a link has no colors. Property `project`, `Auto`, `Raw`.

**5. `Meeting` — Tag, Left Block, position 3, `Prerequisite Field`: `Kind` =
`meeting`**

Meetings are rare for you, so the kind of a meeting does not take up room in
TagWheel on every line: it appears only once a line has been marked as a
meeting.

### Colors: the whole set at a glance

| Field | Value | Fill | Text | Contrast | Hue |
|---|---|---|---|---|---|
| Status | todo | `#3b6fd4` | `#ffffff` | 4.8:1 | 220° |
| Status | doing | `#c05a1e` | `#ffffff` | 4.5:1 | 22° |
| Status | done | `#2f8a4c` | `#ffffff` | 4.3:1 | 139° |
| Priority | low | `#6b7280` | `#ffffff` | 4.8:1 | 220°, S9% |
| Priority | med | `#b07d10` | `#1a1a1a` | 4.8:1 | 41° |
| Priority | high | `#c0392b` | `#ffffff` | 5.4:1 | 6° |

Hues: 6, 22, 41, 139, 220. `doing` (22°) and `high` (6°) are 16° apart, and that
is the only close pair in the set. It is allowed on purpose: `Status` and
`Priority` do stand next to each other, but `doing` is warmer and lighter, and
`high` also carries `[!]` at the start of the line. If the pair still blurs for
you, move `doing` to `#b07d10` and `med` to `#7d7a14`.

*(The rest of the answer follows the same structure as section 13.)*

---

## Appendix A. Glossary

| Term | What it is |
|---|---|
| **Field** | one slot on a line: a tag, a link or an emoji-element |
| **Value** | what goes in that slot |
| **Block** | half of a line: `Left Block` before the text, `Right Block` after |
| **Prefix** | what a line starts with: a list bullet, a checkbox, a heading mark |
| **Separator** | the two markers fencing the person's text off from the Blocks |
| **TagWheel** | a panel over the line, Fields side by side, Values picked with the arrow keys |
| **Tag Bars** | colored stripes in the note margin, drawn in the Value colors of one Field |
| **Binder** | custom commands that insert text you type often |
| **Transform** | turning a line into a note of its own |
| **Smart Rules** | rules that pick the Transform template from what is on the line |

## Appendix B. What the plugin cannot do — do not propose it

- more than two levels of Values (there is no grandchild);
- a different `Child tag format` per Field — it is one setting for the whole
  plugin;
- colors on `Link` Values or on an `Element`;
- `Show: empty` or `custom` on anything but a tag (and on the person's own tags,
  only `default` and `empty`);
- more than one Field drawing Tag Bars;
- more than one Value in a prerequisite;
- a tag waiting on a Field of another type;
- a color that depends on a condition, gradients, icons inside a bubble;
- theme variables in a color control — `#rrggbb` only;
- rewriting lines already written when a Field name or a Separator changes: the
  plugin does not edit notes.
