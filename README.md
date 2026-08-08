# Inline Overhaul

Inline Overhaul adds desktop Obsidian commands for inline-note navigation, PKM field and tag cycling, TagWheel editing, and opt-in inline-to-note transforms.

See [Setup and user guide](instructions.md) for installation, configuration, feature examples, Transform safety, and troubleshooting.

> [!WARNING]
> This is a public beta. Back up your vault before installing or updating. Test important workflows on non-critical notes first.

## Requirements

- Obsidian desktop 1.5.0 or newer
- Desktop only; mobile is not supported

## Install with BRAT

1. Install and enable the BRAT community plugin.
2. In BRAT, choose **Add Beta plugin**.
3. Enter `romkuznetsov/inline-overhaul`.
4. Enable **Inline Overhaul** in Obsidian's Community plugins settings.

## Transform opt-in

Transform is disabled by default. Enable it explicitly in **Settings → Inline Overhaul → Transform** before using `Transform: inline2note`. Review output and backup policy before transforming production notes.

## Build and test

```powershell
npm install
npm run test:version
npm run build
npm run test:release
node --check dist/main.js
```

Release assets are written to `dist/`.

## Current beta limitations

- Flying button is disabled.
- Visual styling is disabled.
- Obsidian-only manual cases, including clean-vault startup and Transform workflows, still require verification.
