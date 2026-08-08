"use strict";

const path = require("path");

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(name + ": expected '" + expected + "' got '" + actual + "'");
}

function assertTrue(v, name) {
  if (!v) throw new Error(name + ": expected truthy");
}

function run() {
  const modPath = path.join(__dirname, "..", "..", "src", "core", "order_deep_editor_state.js");
  const mod = require(modPath);

  const tag = mod.normalizeToken("abc", "tag");
  const wl = mod.normalizeToken("abc", "wikilink");
  assertEq(tag, "#abc", "normalize tag token");
  assertEq(wl, "[[abc]]", "normalize wikilink token");
  assertEq(mod.normalizeCheckboxToken("- [I]"), "[I]", "normalize checkbox token accepts bullet-prefixed input");

  const tree = mod.buildTagTree(
    { prefix: "#", values: [{ token: "#p1" }, { token: "#p2" }] },
    { values: [{ token: "#s", allowedParentValues: ["#p1"] }] },
    "tag",
    { checkboxByToken: { "#p1": "[I]", "#s": "[ ]" } }
  );
  assertEq(tree.length, 2, "tree parent count");
  assertEq(tree[0].children.length, 1, "tree child count");
  assertEq(tree[0].prefixMode, "checkbox", "tree parent prefix mode hydrated");
  assertEq(tree[0].children[0].prefixMode, "checkbox", "tree child prefix mode hydrated");

  const applied = mod.applyTagTreeToFields(tree, { id: "parent", values: [] }, { id: "sub", values: [] }, "tag");
  assertEq(Array.isArray(applied.parentField.values), true, "applied parent values array");
  assertEq(Array.isArray(applied.subField.values), true, "applied sub values array");
  assertEq(applied.checkboxByToken["#p1"], "[I]", "applied checkbox map contains parent token");
  assertEq(applied.checkboxByToken["#s"], "[ ]", "applied checkbox map contains child token");

  const okDraft = mod.validateDraft({
    rows: [
      {
        key: "effort",
        kind: "element",
        emoji: "➕",
        format: "1",
        behaviorMode: "command",
        command: "now",
      },
    ],
  });
  assertTrue(okDraft.ok === true, "valid draft accepted");

  const badDraft = mod.validateDraft({
    rows: [
      {
        key: "effort",
        kind: "element",
        emoji: "",
        format: "",
        behaviorMode: "command",
        command: "bad",
      },
    ],
  });
  assertTrue(badDraft.ok === false, "invalid draft rejected");

  let h = mod.createHistory(3);
  h = mod.pushHistory(h, { a: 1 });
  h = mod.pushHistory(h, { a: 2 });
  const un = mod.undoHistory(h, { a: 3 });
  assertTrue(un.changed === true, "undo changed");
  assertEq(un.snapshot.a, 2, "undo snapshot value");
  const rd = mod.redoHistory(un.history, un.snapshot);
  assertTrue(rd.changed === true, "redo changed");
  assertEq(rd.snapshot.a, 3, "redo snapshot value");

  const partitioned = mod.partitionWikilinkRows(
    [
      { token: "[[Entity Alpha]]", parentToken: "#group-alpha" },
      { token: "[[Entity Beta]]", parentToken: "#missing" },
      { token: "[[Entity Alpha]]", parentToken: "#group-alpha" },
    ],
    ["#group-alpha"]
  );
  assertEq(partitioned.linked.length, 1, "wikilink partition linked count");
  assertEq(partitioned.orphans.length, 1, "wikilink partition orphan count");
  assertEq(partitioned.orphans[0].token, "[[Entity Beta]]", "wikilink partition keeps orphan token");

  console.log("Order deep editor state tests: OK");
}

run();
