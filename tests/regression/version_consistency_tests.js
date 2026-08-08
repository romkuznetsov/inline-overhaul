"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const expectedVersion = "0.1.0-beta.1";
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

const manifest = readJson("manifest.json");
const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const versions = readJson("versions.json");

assert.strictEqual(manifest.version, expectedVersion, "manifest version matches beta release");
assert.strictEqual(pkg.version, expectedVersion, "package version matches beta release");
assert.strictEqual(lock.version, expectedVersion, "package-lock version matches beta release");
assert.strictEqual(lock.packages[""].version, expectedVersion, "package-lock root package version matches beta release");
assert.strictEqual(versions[expectedVersion], manifest.minAppVersion, "versions.json maps beta release to minimum Obsidian version");

const distManifestPath = path.join(root, "dist", "manifest.json");
if (fs.existsSync(distManifestPath)) {
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(distManifestPath, "utf8")), manifest, "dist manifest matches versioned source manifest");
}

console.log(`Version consistency tests: OK (${expectedVersion})`);
