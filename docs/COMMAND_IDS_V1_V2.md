# Command id map: version 1 to version 2

**Generated** by `node tools/command_ids_doc.js --write` from
`src/features/command_ids.js`. Do not edit it by hand — edit the module.

Obsidian binds a hotkey to a command's **identifier**, not to its name. In `0.2.0`
the identifiers moved to kebab-case without the plugin prefix, so every key you had
assigned to an inlineOverhaul command stopped working after that update. Migrating the
plugin's own settings does not cover it: hotkeys live in Obsidian's settings, and the
plugin does not edit another plugin's files. So it shows a notice once and prints this
map to the developer console.

**What to do.** Open `Settings` → `Hotkeys`, search for `inlineOverhaul` and assign
the keys again from the table below. The full identifier in the hotkey manager reads
`inline-overhaul:<id>`.

## Renamed commands

Names below are written without the area in front. In the command palette and in
Obsidian's `Hotkeys` screen each one carries it — `Navigation: Move line up` — and
Obsidian puts the plugin name before that.

| Was | Now | Name |
|---|---|---|
| `inlineOverhaul_Navigation_MoveUp` | `move-line-up` | `Move line up` |
| `inlineOverhaul_Navigation_MoveDown` | `move-line-down` | `Move line down` |
| `inlineOverhaul_Navigation_MoveLeft` | `move-left` | `Move left` |
| `inlineOverhaul_Navigation_MoveRight` | `move-right` | `Move right` |
| `inlineOverhaul_Navigation_JumpHeaderUp` | `jump-back` | `Jump back` |
| `inlineOverhaul_Navigation_JumpHeaderDown` | `jump-next` | `Jump next` |
| `inlineOverhaul_Navigation_InlineLeft` | `move-cursor-left-in-line` | `Move cursor left in line` |
| `inlineOverhaul_Navigation_InlineRight` | `move-cursor-right-in-line` | `Move cursor right in line` |
| `inlineOverhaul_Hotkey_tagwheel_left` | `open-tagwheel-left` | `Open TagWheel on the left` |
| `inlineOverhaul_Hotkey_tagwheel_right` | `open-tagwheel-right` | `Open TagWheel on the right` |
| `inlineOverhaul_Transform_inline2note` | `transform-inline-to-note` | `Transform inline to note` |
| `inlineOverhaul_Binder_Smart_bracket` | `smart-bracket` | `Smart bracket` |

## Commands whose identifier did not change

These identifiers were already kebab-case without the plugin prefix, and renaming them
would have broken a working hotkey for nothing, so they were left alone. What changed for
them is the **name**, and a name is not what a hotkey is bound to.

| Identifier | Name in version 1 | Name now |
|---|---|---|
| `undo-last-settings-change` | `General: Undo last settings change` | `General: Undo last settings change` |
| `toggle-feature-<module>` | `General: Toggle <Module> module` | `General: Toggle <Module> module` |

Both columns say the same thing, and that is not a mistake. Between `0.2.0` and
`0.4.0` these commands were listed without the area in front — `Undo last settings
change` — and since `0.5.0` every command carries the name of its area again, so that
Obsidian's `Hotkeys` search can be narrowed to one area at a time.

## One command was removed

`open-inline-overhaul-settings`, listed as `General: Open settings`, was **removed on
2026-09-06**. It is no longer in the command palette, and a hotkey assigned to it does
nothing — you can drop it.

The reason is not taste: it called an Obsidian API that is not declared in the public
types, which is a standard objection in a community review. Open the plugin's settings
the ordinary way — **Settings → Community plugins → inlineOverhaul**.

## Commands that are not in the table: they are built from your own data

**Field commands.** Every Field has a pair of commands, forward and back through its
Values. The identifier is built from the Field's strict name:

| Was | Now |
|---|---|
| `inlineOverhaul_Hotkey_<field>_increase` | `<field>-next` |
| `inlineOverhaul_Hotkey_<field>_decrease` | `<field>-previous` |
| `inlineOverhaul_Binder_<name>` | `<name>` |

The strict name is lowered to kebab-case: `date_due` gives `date-due-next` and
`date-due-previous`. In the command list they read `Tags & PKM: <Field> next` and
`Tags & PKM: <Field> previous`.

**Binder rows.** The identifier is built from the row's name by the last rule in the
table above, in kebab-case. It is stored in the plugin's settings
(`editor.binder.rows[].commandId`), and the old form there counts as absent: it is
rebuilt from the row name on the next load.

**Clashes are separated.** Two Fields whose strict names give the same kebab
(`date_due` and `date-due`) get `date-due-next` and `date-due-2-next`. A Binder row
named after a core command gets a suffix too: your own row cannot shadow navigation.
