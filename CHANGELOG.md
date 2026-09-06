# Changelog

## 0.1.0-beta.3

- **The plugin is now called `inlineOverhaul`.** Its id is unchanged, so every hotkey you have set keeps working. The backup folder default moved to `inlineOverhaul/Backups` for fresh installs only; the guide note was renamed, and the old one still opens instead of a duplicate being made.
- **`Save a backup` now asks what to save**: an optional comment, a checkbox per settings tab, and how much of your hotkeys to keep. Everything is picked by default, so pressing the button straight away does what it always did.
- **Restoring a partial backup leaves the tabs you did not save alone**, and the confirmation window lists both sides: what comes back and what stays.
- **Restoring can free up keys other commands are holding** — a checkbox, off by default, with the clashing commands named one by one.
- **Restoring re-registers the plugin commands**, so hotkeys for Fields that came with the backup show up on Obsidian’s `Hotkeys` screen without a restart, and a window afterwards says what came back.
- **The generated rules file no longer reappears in the vault root** after restoring a backup taken before it moved into the plugin folder.
- **A Field added on an empty line now leaves room for text**: `-  :: 📅…` instead of `- :: 📅…`.
- **The in-line cursor jump lands in that empty text slot** instead of behind the separator. Field markers are now read from your Fields, not only from the four named date rules.

Known limitations: unchanged from 0.1.0-beta.2.

## 0.1.0-beta.2

- Released from the current code as a normal release with all three assets, so BRAT installs the plugin from one link.
- Releases are cut by tag from then on: CI builds from the tagged commit, runs the whole suite and attaches the files.

## 0.1.0-beta.1

- Added BRAT-ready bundled release assets and release regressions.
- Stabilized shared PKM, TagWheel, and Transform runtime paths for beta testing.
- Kept Transform explicit opt-in and disabled by default.
- Documented beta safety, installation, build, testing, and known limitations.

Known limitations: Flying button and visual styling are disabled; Obsidian manual beta cases remain open.
