"use strict";

const path = require("path");
const transform = require(path.join(__dirname, "..", "..", "src", "features", "transform_feature.js"));
const lineFinalize = require(path.join(__dirname, "..", "..", "src", "core", "pkm_line_finalize_unified.js"));

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

function assertDeepEq(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}

function assertTrue(value, name) {
  if (!value) throw new Error(`${name}: expected truthy`);
}

function makeConfig() {
  return {
    transform: { inline2note: { yamlNoteFormat: "clean" } },
    pkm: {
      behavior: {
        io: { separator1: "::", separator2: "::" },
        order: {
          left: ["kind", "child"],
          right: ["link", "when"],
          active: {},
          enabled: {},
          types: { kind: "tag", child: "tag", link: "wikilink", when: "element" },
          propertiesByField: { kind: "tags", child: "tags", link: "project", when: "when" },
        },
        leftMode: {
          fields: [
            { id: "kind", prefix: "#", values: [{ token: "todo" }] },
            { id: "child", dependsOn: "kind", prefix: "#", values: [{ token: "next" }] },
          ],
        },
        rightMode: {
          fields: [
            { id: "link", type: "wikilink", values: [{ token: "ProjectA" }] },
            { id: "when", type: "element", marker: "@", prefix: "!", values: [] },
          ],
        },
      },
    },
  };
}

(function testMissingInline2NoteConfigRequiresExplicitOptIn() {
  assertEq(transform.DEFAULT_INLINE2NOTE.enabled, false, "default transform disabled");
  assertEq(transform.normalizeInline2Note(undefined).enabled, false, "missing transform config disabled");
  assertEq(transform.normalizeTransformConfig({}).transform.inline2note.enabled, false, "migration adds disabled transform config");
  assertEq(transform.normalizeInline2Note({ enabled: true }).enabled, true, "explicit transform opt-in preserved");
})();

(function testPreviewUsesConfiguredSeparators() {
  const cfg = makeConfig();
  assertEq(transform.buildPreviewBaseLine(cfg), "#todo #next :: Text :: [[ProjectA]] @value", "preview separator contract");
})();

(function testDisabledRulesDoNotConflict() {
  const rules = transform.validateSmartRules([
    { id: "off", enabled: false, conditions: { tags: ["#todo"] }, targetTemplate: "off.md" },
    { id: "on", enabled: true, conditions: { tags: ["#todo"] }, targetTemplate: "on.md" },
  ]);
  assertEq(rules[0].enabled, false, "disabled rule remains disabled");
  assertEq(rules[0].validation.isConflict, false, "disabled rule excluded from conflicts");
  assertEq(rules[1].enabled, true, "active rule remains enabled");
})();

(function testConflictValidationUsesFullOverlapGraph() {
  const chain = transform.validateSmartRules([
    { id: "a", enabled: true, conditions: { tags: ["#x"], emojiFields: ["@a"] } },
    { id: "b", enabled: true, conditions: { tags: ["#x"], wikilinks: ["P"] } },
    { id: "c", enabled: true, conditions: { emojiFields: ["@b"], wikilinks: ["P"] } },
  ]);
  assertDeepEq(chain.map((rule) => rule.enabled), [false, false, false], "three-rule conflict chain disables every involved rule");
  assertDeepEq(chain.map((rule) => rule.validation.isConflict), [true, true, true], "chain marks every involved rule conflicted");

  const triangle = transform.validateSmartRules([
    { id: "x", enabled: true, conditions: { tags: ["#same"] } },
    { id: "y", enabled: true, conditions: { tags: ["#same"] } },
    { id: "z", enabled: true, conditions: { tags: ["#same"] } },
  ]);
  assertDeepEq(triangle.map((rule) => rule.enabled), [false, false, false], "conflict triangle disables every involved rule");
  assertTrue(triangle.every((rule) => rule.validation.details.length === 2), "triangle records all peer edges");
})();

(function testAutoTitlePriority() {
  const i2n = transform.normalizeInline2Note({ noteName: { explicitNameDelimiters: "{}", autoWordsCount: 3 } });
  assertEq(transform.resolveAutoTitle({ line: "- #todo :: payload words {Explicit Name}", payloadText: "payload words" }, i2n), "Explicit Name", "delimiter title priority");
  const checkboxI2n = transform.normalizeInline2Note({ noteName: { explicitNameDelimiters: "[]", autoWordsCount: 3 } });
  assertEq(transform.resolveAutoTitle({ line: "- [x] :: payload words", payloadText: "payload words" }, checkboxI2n), "payload words", "task checkbox is not explicit title");
  assertEq(transform.resolveAutoTitle({ line: "## Header Name", payloadText: "fallback words" }, i2n), "Header Name", "header title priority");
  assertEq(transform.resolveAutoTitle({ line: "plain", payloadText: "one two three four" }, i2n), "one two three", "word title fallback");
  assertEq(transform.resolveAutoTitle({ line: "plain", payloadText: "" }, i2n), "", "empty title stays empty");
})();

(function testCrLfFrontmatterAndMultilineReplacement() {
  const parsed = transform.parseFrontmatter("---\r\ntags:\r\n  - old\r\nsummary: |\r\n  old text\r\nkeep: yes\r\n---\r\nBody\r\n");
  assertEq(parsed.newline, "\r\n", "CRLF detected");
  const lines = transform.renderYamlBlockWithOrder(parsed.yamlLines, { tags: ["todo"], summary: "new" }, makeConfig());
  assertDeepEq(lines, ["tags: [\"todo\"]", "summary: \"new\"", "keep: yes"], "multiline YAML value replaced as block");
})();

(function testYamlMergeAppendsTokenOverrideOutsidePropertiesByField() {
  const cfg = makeConfig();
  cfg.pkm.behavior.leftMode.fields[0].values[0].yamlProperty = "token override";
  const parsed = transform.parseInlineLine("- #todo :: work", cfg);
  const patch = transform.buildYamlMapFromContext(transform.buildTransformContext(parsed, cfg), cfg);
  assertDeepEq(patch, { "token override": "todo" }, "token-level YAML override enters patch");
  assertDeepEq(
    transform.renderYamlBlockWithOrder(["keep: yes"], patch, cfg),
    ["keep: yes", '"token override": "todo"'],
    "remaining token override key appended"
  );
})();

(function testYamlTopLevelKeyParserSupportsSafeKeysAndRejectsDuplicates() {
  const lines = [
    '"quoted key": old',
    "'single key': old",
    "ключ: old",
    "project.name: old",
    "spaced key: old",
  ];
  const patch = { "quoted key": 1, "single key": 2, "ключ": 3, "project.name": 4, "spaced key": 5 };
  assertDeepEq(transform.renderYamlBlockWithOrder(lines, patch, makeConfig()), [
    '"quoted key": 1',
    "'single key': 2",
    "ключ: 3",
    "project.name: 4",
    "spaced key: 5",
  ], "quoted Unicode dotted and spaced keys update in place");
  let duplicateError = "";
  try { transform.renderYamlBlockWithOrder(["name: one", '"name": two'], { name: "next" }, makeConfig()); } catch (error) { duplicateError = String(error.message || error); }
  assertTrue(/duplicate YAML top-level key/.test(duplicateError), "decoded duplicate YAML keys fail fast");
  let invalidError = "";
  try { transform.renderYamlBlockWithOrder(['"unterminated: value'], { other: "x" }, makeConfig()); } catch (error) { invalidError = String(error.message || error); }
  assertTrue(/invalid quoted YAML top-level key/.test(invalidError), "malformed quoted YAML key fails fast");
})();

(function testSourceCleanupUsesMatchedPanelSpansOnly() {
  const cfg = makeConfig();
  const source = "- #todo :: payload #todo";
  const parsed = transform.parseInlineLine(source, cfg);
  const ctx = transform.buildTransformContext(parsed, cfg);
  assertEq(
    transform.applySourceCleanupByFieldIds(source, ctx, [], { separator1: "::", separator2: "::" }),
    "- :: payload #todo",
    "cleanup removes left field span but preserves duplicate payload text"
  );

  cfg.pkm.behavior.leftMode.fields.push({ id: "alias", prefix: "#", values: [{ token: "todo" }] });
  cfg.pkm.behavior.order.left.push("alias");
  cfg.pkm.behavior.order.types.alias = "tag";
  const sharedCtx = transform.buildTransformContext(transform.parseInlineLine(source, cfg), cfg);
  assertEq(
    transform.applySourceCleanupByFieldIds(source, sharedCtx, ["kind"], { separator1: "::", separator2: "::" }),
    source,
    "span shared with preserved field is not removed by unchecked peer field"
  );
})();

(function testSourceLinkAndIndentPreserved() {
  const out = transform.applySourcePayloadReplace("\t- [ ] #todo :: old :: tail", "Notes/Actual-01", { separator1: "::", separator2: "::" });
  assertEq(out, "\t- [ ] #todo :: [[Notes/Actual-01]] :: tail", "actual path wikilink preserves indent");
})();

(function testProcessedTokenPanels() {
  const sep = { separator1: "::", separator2: "::" };
  assertEq(transform.insertProcessedToken("- [ ] #todo :: text", "#done", "left", sep), "- [ ] #todo #done :: text", "processed token left");
  assertEq(transform.insertProcessedToken("- [ ] #todo :: text", "#done", "right", sep), "- [ ] #todo :: text :: #done", "processed token right");
})();

(function testSourcePrefixUsesSharedResolverAfterCleanup() {
  const cfg = makeConfig();
  cfg.pkm.behavior.prefixRules = {
    resolver: "priority-first",
    priorityTargets: ["kind"],
    checkboxByFieldValue: { kind: { todo: "[ ]" } },
  };
  const parsed = transform.parseInlineLine("- [I] #todo :: work", cfg);
  const ctx = transform.buildTransformContext(parsed, cfg);
  const out = transform.applySourcePrefixResolution("- [I] #todo :: work", parsed.line, ctx, ["kind"], cfg, lineFinalize);
  assertEq(out, "- [ ] #todo :: work", "shared prefix resolver replaces stale checkbox");
})();

(function testDataDrivenDependsOnAndWikilinkMatching() {
  const cfg = makeConfig();
  const parsed = transform.parseInlineLine("- #todo #next :: work :: [[Unknown]] @2026", cfg);
  const ctx = transform.buildTransformContext(parsed, cfg);
  assertTrue(ctx.byFieldId.child, "dependsOn child matched without suffix convention");
  assertEq(ctx.byFieldId.link, undefined, "unmatched wikilink not assigned to field");
  assertEq(ctx.byFieldId.when.rawToken, "@2026", "marker resolver consistently prefers marker");
  assertDeepEq(transform.buildYamlMapFromContext(ctx, cfg), { tags: ["todo", "next"], when: "2026" }, "data-driven YAML cardinality");
})();

(function testSmartTemplateSelection() {
  const parsed = { tags: ["#todo"], emojis: [{ marker: "@", value: "2026" }], wikilinks: ["ProjectA"] };
  const rules = transform.validateSmartRules([
    { id: "disabled", enabled: false, conditions: { tags: ["#todo"] }, targetTemplate: "disabled.md" },
    { id: "match", enabled: true, conditions: { tags: ["#todo"], wikilinks: ["[[ProjectA]]"] }, targetTemplate: "match.md" },
  ]);
  assertEq(transform.selectSmartTemplate(parsed, rules, "default.md"), "match.md", "smart template runtime selection");
})();

(function testSelectionRangeExpandsWholeLinesAndDescendants() {
  const lines = ["root", "  child", "    grandchild", "sibling"];
  const ed = {
    getLine(n) { return lines[n] || ""; },
    lineCount() { return lines.length; },
  };
  const info = transform.deriveSelectionRangeFromEditor(ed, { line: 0, ch: 2 }, { line: 1, ch: 3 });
  assertEq(info.blockStart, 0, "partial selection starts at full line");
  assertEq(info.blockEnd, 2, "selection expands through descendant tree");
  assertEq(info.blockText, "root\n  child\n    grandchild", "selection body preserves tree");
})();

(function testBodyIndentAndNewlineNormalization() {
  assertEq(transform.normalizeInlineBlockForBody("\t- root\n\t\t- child", "\r\n"), "- root\r\n\t- child", "body keeps relative indent and requested newline");
})();

(function testDatetimeHeaderUsesConfiguredFormat() {
  const header = transform.formatHeaderByMode({ placement: { headerMode: "datetime", datetimeHeaderFormat: "DD.MM.YYYY HH:mm" } }, new Date(2026, 7, 8, 9, 5));
  assertEq(header, "### 08.08.2026 09:05", "datetime header format");
})();

console.log("Transform feature regression tests: OK");
