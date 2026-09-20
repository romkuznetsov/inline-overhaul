# Contributing

inlineOverhaul is a one-person project in public beta. That shapes what is useful:
**bug reports and concrete suggestions help most; large unsolicited pull requests help
least**, because the architecture is still moving under them.

## Reporting a bug

Open an [issue](https://github.com/romkuznetsov/inline-overhaul/issues/new/choose) with
the bug template. What makes a report actionable:

- **The line.** Paste the actual markdown, not a description of it. Whitespace and
  Separators matter.
- **What you pressed**, and what you expected instead of what happened.
- **Your versions** — Obsidian and the plugin, both from
  **Settings → inlineOverhaul → Advanced → Diagnostics**.
- **Whether it survives a restart** with other plugins disabled. A conflict with
  another plugin is a different bug from one of ours.

A GIF of the moment beats three paragraphs describing it.

> [!IMPORTANT]
> Do not paste vault content you would not publish. An issue is public and permanent.

## Suggesting a feature

Say what you are trying to do, not what control you want added. The plugin already has
a lot of surface, and half of the good suggestions turn out to be a setting that exists
under another name.

## Pull requests

Small and focused are welcome — a typo, a wrong caption, a broken link, a failing edge
case with a test. For anything larger, **open an issue first** and let us agree on the
shape; a rewrite that arrives unannounced usually cannot be merged as it is.

### Setting up

```bash
git clone https://github.com/romkuznetsov/inline-overhaul
cd inline-overhaul
npm install
npm run build      # bundles to dist/main.js
npm test           # build, then the full suite
```

To try your build in Obsidian, point a vault's
`.obsidian/plugins/inline-overhaul/` at your `dist/main.js`, `manifest.json` and
`src/styles.css`, then reload the plugin.

### Before you open the PR

- `npm test` passes. It is not a formality — the suite guards documentation terms,
  release notes and settings shape, and a green run is what makes a small PR easy to
  accept.
- Documentation changed in the same commit as the behaviour it describes. A control
  renamed without its reference entry is a defect, not a follow-up.
- Anything people read — README, FEATURES, instructions, tutorial, settings reference,
  changelog — follows
  [`.claude/skills/repo-docs/SKILL.md`](.claude/skills/repo-docs/SKILL.md).

## Translations

The plugin's interface lives in plain text files, one per language, inside the plugin
folder in your vault. Adding a language does not require a pull request and does not
require touching this repository at all — copy `texts/default.js` under a new name and
change its first line. The
[user guide](INSTRUCTIONS.md#the-words-the-panel-uses) has the details.

If you want your translation shipped with the plugin, open an issue with the file
attached.

## Code of conduct

Be decent. Assume the other person is trying to help. Disagreement about the software
is welcome; contempt for the person is not.

## License

By contributing you agree your work is published under the [MIT license](LICENSE) that
covers the rest of the project.
