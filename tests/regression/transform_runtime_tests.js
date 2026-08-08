"use strict";

const path = require("path");
const transform = require(path.join(__dirname, "..", "..", "src", "features", "transform_feature.js"));
const lineFinalize = require(path.join(__dirname, "..", "..", "src", "core", "pkm_line_finalize_unified.js"));

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

function assertTrue(value, name) {
  if (!value) throw new Error(`${name}: expected truthy`);
}

function makeConfig(overrides) {
  const i2n = {
    enabled: true,
    outputFolder: "Notes",
    defaultTemplate: "",
    smartRules: [],
    noteName: { mode: "auto", explicitNameDelimiters: "[]", autoWordsCount: 6, preferHeaderTitle: true },
    nameCollision: { mode: "new_note" },
    placement: { position: "end", headerMode: "none", customHeaderText: "", datetimeHeaderFormat: "YYYY-MM-DD" },
    sourceProcessing: { cleanupFieldIds: [], processedToken: "", processedTokenPanel: "right", replacePayloadWithLink: true },
    sublinesBehavior: "stay",
    ...(overrides || {}),
  };
  return {
    features: { transform: { enabled: true } },
    transform: { inline2note: i2n },
    pkm: { behavior: { io: { separator1: "::", separator2: "::" }, order: { left: [], right: [], active: {}, enabled: {}, types: {}, propertiesByField: {} }, leftMode: { fields: [] }, rightMode: { fields: [] } } },
  };
}

function makeEditor(initial, options) {
  let lines = String(initial || "").split("\n");
  const opts = options || {};
  return {
    getCursor(which) { return which === "to" ? { line: 0, ch: lines[0].length } : { line: 0, ch: 0 }; },
    somethingSelected() { return false; },
    getLine(n) { return lines[n] || ""; },
    lineCount() { return lines.length; },
    replaceRange(value, from, to) {
      if (opts.failReplace) throw new Error("editor write failed");
      if (from.line === to.line) lines[from.line] = lines[from.line].slice(0, from.ch) + value + lines[to.line].slice(to.ch);
      else lines.splice(from.line, to.line - from.line + 1, ...String(value).split("\n"));
    },
    text() { return lines.join("\n"); },
  };
}

function makePlugin(config, editor, vaultOptions) {
  const files = new Map();
  const opts = vaultOptions || {};
  let createCalls = 0;
  const vault = {
    getAbstractFileByPath(filePath) { return files.has(filePath) ? { path: filePath } : null; },
    async createFolder(folderPath) { files.set(folderPath, { folder: true }); },
    async create(filePath, content) {
      createCalls += 1;
      if (opts.raceFirstCreate && createCalls === 1) {
        files.set(filePath, "racer");
        throw new Error("already exists");
      }
      if (files.has(filePath)) throw new Error("already exists");
      files.set(filePath, String(content));
    },
    async read(file) { return String(files.get(file.path) || ""); },
    async modify(file, content) { files.set(file.path, String(content)); },
    async delete(file) { files.delete(file.path); },
  };
  if (opts.initialFiles) for (const [key, value] of Object.entries(opts.initialFiles)) files.set(key, value);
  const notices = [];
  let activeEditorCalls = 0;
  return {
    app: {
      vault,
      workspace: { getActiveFile() { return { parent: { path: "" } }; } },
    },
    getConfig() { return config; },
    getActiveEditor() {
      activeEditorCalls += 1;
      return opts.staleEditor || opts.staleAfterFirst && activeEditorCalls > 1 ? {} : editor;
    },
    notice(message) { notices.push(String(message)); },
    files,
    notices,
  };
}

async function testNewNoteRaceUsesActualPathLink() {
  const editor = makeEditor("\t- [ ] :: Task");
  const plugin = makePlugin(makeConfig(), editor, { raceFirstCreate: true });
  await transform.runInline2Note(plugin, { lineFinalize });
  assertTrue(plugin.files.has("Notes/Task-01.md"), "race-safe suffix created");
  assertEq(plugin.files.get("Notes/Task.md"), "racer", "racing file not overwritten");
  assertEq(editor.text(), "\t- [ ] :: [[Notes/Task-01]]", "source uses actual target path and indent");
}

async function testReplacePayloadFalse() {
  const editor = makeEditor("- [ ] :: Keep me");
  const plugin = makePlugin(makeConfig({ sourceProcessing: { cleanupFieldIds: [], processedToken: "#done", processedTokenPanel: "right", replacePayloadWithLink: false } }), editor);
  await transform.runInline2Note(plugin, { lineFinalize });
  assertEq(editor.text(), "- [ ] :: Keep me :: #done", "replacePayloadWithLink false preserves payload and inserts processed token");
}

async function testSourceFailureRollsBackCreatedTarget() {
  const editor = makeEditor("- [ ] :: Rollback", { failReplace: true });
  const plugin = makePlugin(makeConfig(), editor);
  let message = "";
  try { await transform.runInline2Note(plugin, { lineFinalize }); } catch (error) { message = String(error.message || error); }
  assertTrue(/rolled back/.test(message), "rollback failure surfaced");
  assertEq(plugin.files.has("Notes/Rollback.md"), false, "created target removed after source failure");
}

async function testSourceFailureRestoresOverwrittenTarget() {
  const editor = makeEditor("- [ ] :: Restore", { failReplace: true });
  const config = makeConfig({ nameCollision: { mode: "overwrite" } });
  const plugin = makePlugin(config, editor, { initialFiles: { "Notes/Restore.md": "original" } });
  try { await transform.runInline2Note(plugin, { lineFinalize }); } catch (_) {}
  assertEq(plugin.files.get("Notes/Restore.md"), "original", "overwrite target restored after source failure");
}

async function testStaleEditorStopsBeforeTargetMutation() {
  const editor = makeEditor("- [ ] :: Stale");
  const plugin = makePlugin(makeConfig(), editor, { staleAfterFirst: true });
  let message = "";
  try { await transform.runInline2Note(plugin, { lineFinalize }); } catch (error) { message = String(error.message || error); }
  assertTrue(/source editor changed/.test(message), "stale editor guard surfaced");
  assertEq(plugin.files.has("Notes/Stale.md"), false, "stale editor prevents target mutation");
}

async function testAddToNoteDoesNotDuplicateTemplateOrHeader() {
  const editor = makeEditor("- [ ] :: Existing");
  const config = makeConfig({
    defaultTemplate: "Templates/Missing.md",
    nameCollision: { mode: "add_to_note" },
    placement: { position: "end", headerMode: "custom", customHeaderText: "### Custom", datetimeHeaderFormat: "YYYY" },
  });
  const plugin = makePlugin(config, editor, { initialFiles: { "Notes/Existing.md": "---\nkeep: yes\n---\nTemplate body\n" } });
  await transform.runInline2Note(plugin, { lineFinalize });
  const note = String(plugin.files.get("Notes/Existing.md"));
  assertEq((note.match(/Template body/g) || []).length, 1, "template body not duplicated on add");
  assertEq((note.match(/^### /gm) || []).length, 1, "one append header added");
  assertEq((note.match(/- \[ \] :: Existing/g) || []).length, 1, "source block appended once");
}

async function testTemplateErrorSurfacesBeforeMutation() {
  const editor = makeEditor("- [ ] :: Missing template");
  const plugin = makePlugin(makeConfig({ defaultTemplate: "Templates/Missing.md" }), editor);
  let message = "";
  try { await transform.runInline2Note(plugin, { lineFinalize }); } catch (error) { message = String(error.message || error); }
  assertTrue(/template not found/.test(message), "missing template error surfaced");
  assertEq(plugin.files.has("Notes/Missing template.md"), false, "missing template does not mutate target");
}

async function testManualCancelDoesNotMutate() {
  const editor = makeEditor("- [ ] :: Cancel me");
  const plugin = makePlugin(makeConfig({ noteName: { mode: "manual" } }), editor);
  const makeElement = () => ({
    style: {},
    value: "",
    setAttribute() {},
    addEventListener() {},
    classList: { add() {} },
    focus() {},
    createEl() { return makeElement(); },
    createDiv() { return makeElement(); },
    empty() {},
  });
  class CancelModal {
    constructor() { this.titleEl = { setText() {} }; this.contentEl = makeElement(); }
    open() { this.onOpen(); this.close(); }
    close() { this.onClose(); }
  }
  await transform.runInline2Note(plugin, { Modal: CancelModal, lineFinalize });
  assertEq(plugin.files.size, 0, "manual cancel creates no target");
  assertEq(editor.text(), "- [ ] :: Cancel me", "manual cancel preserves source");
}

async function run() {
  await testNewNoteRaceUsesActualPathLink();
  await testReplacePayloadFalse();
  await testSourceFailureRollsBackCreatedTarget();
  await testSourceFailureRestoresOverwrittenTarget();
  await testStaleEditorStopsBeforeTargetMutation();
  await testAddToNoteDoesNotDuplicateTemplateOrHeader();
  await testTemplateErrorSurfacesBeforeMutation();
  await testManualCancelDoesNotMutate();
  console.log("Transform runtime regression tests: OK");
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
