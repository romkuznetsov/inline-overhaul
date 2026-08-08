# BRAT release build

## Contract

BRAT release assets are generated in `dist/`:

- `main.js` — self-contained CommonJS bundle;
- `manifest.json` — unchanged source manifest;
- `styles.css` — copied only when source file exists.

`data.json`, runtime logs, local settings, source modules, and build metadata are not copied.

## Build

```powershell
npm install
npm run test:version
npm run test:release
node --check dist/main.js
```

`obsidian`, `@codemirror/view`, and `@codemirror/state` remain external because Obsidian provides them at runtime.

## Runtime module resolution

`test:release` builds fresh assets before running release regressions. `build/release_entry.js` statically bundles plugin-local modules and replaces `globalThis.__inlineOverhaulBundledVaultModules` on every bundle evaluation. `src/core/vault_module_bridge.js` resolves current bundled registry before global vault-module caches, so BRAT hot reload cannot return stale source modules. Source multi-file mode retains existing cache and vault-read fallbacks.

`tests/regression/version_consistency_tests.js` verifies the release version across source metadata, lock metadata, `versions.json`, and the built manifest. `tests/regression/release_bundle_tests.js` scans production JavaScript for plugin-local runtime vault paths, fails on registry gaps, verifies release asset allowlist behavior, and smoke-loads bundled `main.js` with host externals stubbed.

## Versioning

Build copies current versioned `manifest.json` unchanged. `test:release` rebuilds assets, verifies version consistency, then runs bundle regressions.
