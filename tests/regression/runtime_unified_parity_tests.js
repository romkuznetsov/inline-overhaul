"use strict";

const path = require("path");
const shared = require(path.join(__dirname, "..", "..", "src", "core", "pkm_macro_shared.js"));
const unified = require(path.join(__dirname, "..", "..", "src", "core", "pkm_line_finalize_unified.js"));
const tokenGraph = require(path.join(__dirname, "..", "..", "src", "core", "token_graph_unified.js"));
const statusLineRuntime = require(path.join(__dirname, "..", "..", "src", "core", "status_line_runtime_unified.js"));
const runtimeHelpers = require(path.join(__dirname, "..", "..", "src", "core", "pkm_rules_runtime_helpers.js"));
const tagwheelCore = require(path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel_core.js"));
const linePipeline = require(path.join(__dirname, "..", "..", "src", "core", "line_pipeline.js"));

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(name + ": expected '" + expected + "' got '" + actual + "'");
}

/* Общие данные для проверок правой части строки. */
const DATE_PAYLOAD = String.fromCodePoint(0x1F4C5) + "2026-09-06 10:21";
const SEP_RULES = {
  io: { separator1: "::", separator2: "::" },
  dates: { markers: [String.fromCodePoint(0x1F4C5)] },
};
function run() {
  assertEq(shared.normalizeCycleEndBehavior("OFF"), "clear-prefix", "cycle-end normalizer maps OFF alias to clear-prefix");
  assertEq(shared.normalizeCycleEndBehavior("ON"), "keep-bullet", "cycle-end normalizer maps ON alias to keep-bullet");

  assertEq(
    unified.applyPrefixPolicy("111", "- [a] #area-alpha :: 111", { mode: "preserve-original" }),
    "#area-alpha :: 111",
    "preserve-original removes synthetic prefix on plain raw"
  );
  assertEq(
    unified.applyPrefixPolicy("- [ ] 111", "#area-alpha :: 111", { mode: "reapply-original" }),
    "- [ ] #area-alpha :: 111",
    "reapply-original keeps list+checkbox from raw"
  );
  assertEq(
    unified.preserveOriginalPrefixShape("- [ ] 111", "- [a] #area-alpha :: 111"),
    shared.preserveOriginalPrefixShape("- [ ] 111", "- [a] #area-alpha :: 111"),
    "unified preserveOriginalPrefixShape parity with macro shared"
  );

  const mixed = unified.resolveMixedSelectionPolicy(
    [
      { id: "importance", mode: "off" },
      { id: "type", mode: "minimal" },
    ],
    { minimalSeparator: false, minimalPrefix: false }
  );
  assertEq(String(!!mixed.hasOffSelected), "true", "mixed policy flags off selection");
  assertEq(String(!!mixed.applyMinimalSeparatorCollapse), "true", "mixed policy enables minimal separator collapse without full selection");
  assertEq(String(!!mixed.applyMinimalPrefixPreserve), "false", "mixed policy disables minimal prefix preserve when off selection present");

  const effective = unified.resolveEffectiveSelectionPolicy({
    selectedEntries: [],
    freeRoamBehavior: { minimalSeparator: true, minimalPrefix: false },
    activeMode: "minimal",
  });
  assertEq(String(!!effective.hasMinimalSelected), "true", "effective selection policy includes active minimal mode when selectedEntries is empty");

  const collapsed = unified.applyMixedPostPolicies("111", "#todo || 111", { io: { separator1: "||", separator2: "||" } }, {
    applyMinimalSeparatorCollapse: true,
    applyMinimalPrefixPreserve: false,
  });
  assertEq(collapsed, "#todo 111", "applyMixedPostPolicies collapses separators when policy flag is enabled");

  const cyclePost = unified.applyCycleEndPostProcessing({
    finalLine: "- ||",
    rules: { io: { separator1: "::", separator2: "::" } },
    cycleEndBehavior: "clear-prefix",
    parsedLine: {},
    parseLine: function() { return { tags: [], text: "", dates: "" }; },
    isBulletLikeEmptyResult: function() { return true; },
    buildBulletOnlyLine: function() { return "- "; },
  });
  assertEq(cyclePost.finalLine, "", "cycle-end helper clears line for clear-prefix empty result");

  const keepBulletPost = unified.applyCycleEndPostProcessing({
    finalLine: "- ",
    rules: { io: { separator1: "::", separator2: "::" } },
    cycleEndBehavior: "keep-bullet",
    parsedLine: {},
    parseLine: function() { return { tags: [], text: "", dates: "" }; },
    isBulletLikeEmptyResult: function() { return false; },
    buildBulletOnlyLine: function() { return "- "; },
    shouldKeepBulletLine: function(line) { return /^\s*-\s*$/.test(String(line || "")); },
  });
  assertEq(String(!!keepBulletPost.applyKeepBullet), "true", "cycle-end helper signals keep-bullet application");

  const stripPrefixPost = unified.applyCycleEndPostProcessing({
    finalLine: "- [ ] 111",
    rules: { io: { separator1: "::", separator2: "::" } },
    cycleEndBehavior: "clear-prefix",
    parsedLine: {},
    sourceHasPrefix: false,
    stripPrefixWhenSourceHasNoPrefix: true,
    stripPrefixKeepIndent: function(line, removeCheckbox) {
      var src = String(line || "").replace(/^\s*[-*+]\s+/, "");
      return removeCheckbox ? src.replace(/^\[[^\]]\]\s+/, "") : src;
    },
    parseLine: function() { return { tags: [], text: "111", dates: "" }; },
    isBulletLikeEmptyResult: function() { return false; },
    buildBulletOnlyLine: function() { return "- "; },
  });
  assertEq(stripPrefixPost.finalLine, "111", "cycle-end helper strips synthetic prefix payload for clear-prefix when source had no prefix");

  const stripPrefixPostOwnCheckbox = unified.applyCycleEndPostProcessing({
    finalLine: "- [b] 1",
    rules: { io: { separator1: "::", separator2: "::" } },
    cycleEndBehavior: shared.normalizeCycleEndBehavior("OFF"),
    parsedLine: {},
    sourceHasPrefix: false,
    stripPrefixWhenSourceHasNoPrefix: true,
    stripPrefixKeepIndent: function(line, removeCheckbox) {
      var src = String(line || "").replace(/^\s*[-*+]\s+/, "");
      return removeCheckbox ? src.replace(/^\[[^\]]\]\s+/, "") : src;
    },
    parseLine: function() { return { tags: [], text: "1", dates: "" }; },
    isBulletLikeEmptyResult: function() { return false; },
    buildBulletOnlyLine: function() { return "- "; },
  });
  assertEq(stripPrefixPostOwnCheckbox.finalLine, "1", "cycle-end helper strips stale own checkbox prefix for OFF alias on text-bearing line");

  const stripPrefixPostOwnCheckboxWithSeparatorTail = unified.applyCycleEndPostProcessing({
    finalLine: "- [b] 1",
    rules: { io: { separator1: "::", separator2: "::" } },
    cycleEndBehavior: "clear-prefix",
    parsedLine: {},
    parseLine: function(line) {
      var src = String(line || "").trim();
      if (src === "- [b] 1") return { tags: [], text: "1", dates: "", bulletToken: "-", checkboxToken: "[b]" };
      if (src === "1") return { tags: [], text: "1", dates: "", bulletToken: "-", checkboxToken: "" };
      return { tags: [], text: src, dates: "" };
    },
    isBulletLikeEmptyResult: function() { return false; },
    buildBulletOnlyLine: function() { return "- "; },
  });
  assertEq(stripPrefixPostOwnCheckboxWithSeparatorTail.finalLine, "1", "cycle-end helper strips list+checkbox prefix for clear-prefix text-bearing terminal line");

  const keepPrefixWhenTagged = unified.applyCycleEndPostProcessing({
    finalLine: "- [a] #area-alpha 111",
    rules: { io: { separator1: "::", separator2: "::" } },
    cycleEndBehavior: "clear-prefix",
    parsedLine: {},
    sourceHasPrefix: false,
    stripPrefixWhenSourceHasNoPrefix: true,
    stripPrefixKeepIndent: function(line) {
      return String(line || "").replace(/^\s*[-*+]\s+/, "").replace(/^\[[^\]]\]\s+/, "");
    },
    parseLine: function() { return { tags: ["#area-alpha"], text: "111", dates: "" }; },
    isBulletLikeEmptyResult: function() { return false; },
    buildBulletOnlyLine: function() { return "- "; },
  });
  assertEq(keepPrefixWhenTagged.finalLine, "- [a] #area-alpha 111", "cycle-end helper keeps resolver prefix when tags remain on line");

  assertEq(
    unified.normalizeMinimalOffFinalLine("\t- [c] #area-gamma 111", "\t- [c] 111", { io: { separator1: "::", separator2: "::" } }, {
      shouldKeepCheckbox: true,
      clearedOwnCheckbox: true,
    }),
    "\t- 111",
    "minimal-off normalizer drops cleared field-owned checkbox while preserving indent"
  );

  /*
   * И-3: выход из цикла у Field, у которого есть правило чекбокса.
   *
   * Решение принимает этот модуль, а два хода расходились ровно на одном
   * аргументе: `status_tags.js` считал `clearedOwnCheckbox`, а `tagwheel.js`
   * передавал литерал `false` — и строка `- [ ] #todo || text` после выхода
   * из цикла оставалась с `- [ ]` вместо `- `.
   *
   * Пин держит **контракт аргумента** на настоящих функциях модуля: снятое
   * значение уносит чекбокс, несnятое — сохраняет. То, что оба хода этот
   * аргумент считают, а не подставляют константой, держит пин на исходники
   * (`bootstrap_loader_tests.js`).
   */
  const offRules = {
    behavior: {
      prefixRules: {
        resolver: "priority-first",
        priorityTargets: ["type"],
        checkboxByFieldValue: { type: { "#todo": "[ ]" } },
      },
    },
    leftMode: { fields: [{ id: "type", prefix: "#", values: [{ id: "#todo", token: "#todo" }] }] },
  };
  const offParsed = { bulletToken: "-", checkboxToken: "[ ]" };
  /* Префикс собирается той же функцией плагина, которую зовут оба хода
     (`core.buildPrefix` → `buildPrefixUnified`), а не пересобирается здесь
     своими зависимостями (У-4). */
  const buildOffPrefix = (session) => tagwheelCore.buildPrefix(offParsed, offRules, session, { prefixShared: unified });

  const clearedFlags = unified.resolveOffPrefixFlagsUnified({
    mode: "off",
    freeRoamBehavior: { offPrefix: false },
    hasOwnCheckbox: false,
    clearedOwnCheckbox: true,
  });
  assertEq(clearedFlags.forceBulletPrefix, true, "cleared field checkbox forces the bullet prefix");
  assertEq(clearedFlags.preserveCheckboxPrefix, false, "cleared field checkbox does not preserve the old one");
  assertEq(
    buildOffPrefix({
      selected: {},
      __forceBulletPrefix: clearedFlags.forceBulletPrefix,
      __preserveCheckboxPrefix: clearedFlags.preserveCheckboxPrefix,
    }),
    "- ",
    "cycle exit on a checkbox-owning field leaves the bullet, not the old checkbox"
  );

  const keptFlags = unified.resolveOffPrefixFlagsUnified({
    mode: "off",
    freeRoamBehavior: { offPrefix: false },
    hasOwnCheckbox: false,
    clearedOwnCheckbox: false,
  });
  assertEq(keptFlags.preserveCheckboxPrefix, true, "untouched line keeps its own checkbox");
  assertEq(
    buildOffPrefix({
      selected: {},
      __forceBulletPrefix: keptFlags.forceBulletPrefix,
      __preserveCheckboxPrefix: keptFlags.preserveCheckboxPrefix,
    }),
    "- [ ] ",
    "a line nobody cleared keeps the checkbox it came with"
  );

  assertEq(
    buildOffPrefix({ selected: { type: "#todo" }, __forceBulletPrefix: false, __preserveCheckboxPrefix: false }),
    "- [ ] ",
    "a selected value still writes its own checkbox"
  );

  const noContentFinalizePost = unified.applyCycleEndPostProcessing({
    finalLine: "",
    rules: { io: { separator1: "::", separator2: "::" } },
    cycleEndBehavior: "keep-bullet",
    parsedLine: {},
    parseLine: function(line) {
      if (!String(line || "").trim()) return { tags: [], text: "", dates: "" };
      return { tags: [], text: String(line || ""), dates: "" };
    },
    isNoContentParsed: function(parsed) {
      return !String(parsed && parsed.text ? parsed.text : "").trim();
    },
    enforceNoContentFinalization: true,
    isBulletLikeEmptyResult: function() { return false; },
    buildBulletOnlyLine: function() { return "- "; },
  });
  assertEq(noContentFinalizePost.finalLine, "- ", "cycle-end helper enforces no-content keep-bullet finalization");

  assertEq(
    unified.applyModePrefixImmutability("## 111", "- #/1 || 111", { preserveOff: true }),
    "## #/1 || 111",
    "mode prefix immutability keeps heading prefix in off mode"
  );
  assertEq(
    unified.applyModePrefixImmutability("111", "- #todo 111", { preserveOff: true }),
    "- #todo 111",
    "mode prefix immutability keeps resolver prefix in off mode for plain source"
  );
  assertEq(
    unified.normalizeSeparatorTopology("- [ ] #todo :: :: ", { io: { separator1: "::", separator2: "::" } }),
    "- [ ] #todo :: ",
    "separator topology helper collapses duplicated trailing separator"
  );
  assertEq(
    unified.normalizeStructuredSlots({
      rawLine: "## 111",
      line: "## #/1 111 ::",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "off",
    }),
    "## #/1 :: 111",
    "structured slot helper keeps heading text in text-slot for off mode"
  );
  assertEq(
    unified.normalizeStructuredSlots({
      rawLine: "## #/3 :: 111",
      line: "## :: 111",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "off",
    }),
    "## 111",
    "structured slot helper removes dangling separator after heading off cycle-end"
  );
  assertEq(
    unified.normalizeStructuredSlots({
      rawLine: "## #/3 :: 111",
      line: "- ## :: 111",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "off",
    }),
    "## 111",
    "structured slot helper removes synthetic list+heading leftovers on heading reset"
  );
  assertEq(
    unified.normalizeStructuredSlots({
      rawLine: "## #/3 :: 111",
      line: "## :: 111",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "full",
    }),
    "## 111",
    "structured slot helper also normalizes heading reset residue in full mode"
  );
  assertEq(
    unified.normalizeStructuredSlots({
      rawLine: "==`тип` `категория` `проект` `client1` **[/3]**== :: 111",
      line: "## :: 111",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "full",
    }),
    "## 111",
    "structured slot helper normalizes heading residue even when raw line is non-heading control form"
  );
  assertEq(
    unified.normalizeStructuredSlots({
      rawLine: "==`тип` `категория` `проект` `client1` **[/3]**== :: 111",
      line: "- ## :: 111",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "full",
    }),
    "## 111",
    "structured slot helper normalizes heading residue when synthetic list prefix leaks before heading"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "==`тип` `категория` `проект` `client1` **[/3]**== :: 111",
      line: "- ## :: 111",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "full",
    }),
    "## 111",
    "final-line invariants helper guarantees heading residue cleanup"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "- 11",
      line: "- 11 11 :: ➕2026-05-04 13-21-17",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["➕"] } },
      mode: "off",
    }),
    "- 11 :: ➕2026-05-04 13-21-17",
    "final-line invariants move marker payload to right slot and remove duplicated plain text"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "11",
      line: "11 11 ➕2026-05-04 15-02-34 ::",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["➕"] } },
      mode: "off",
    }),
    "11 :: ➕2026-05-04 15-02-34",
    "final-line invariants normalize trailing-separator payload leak back to right slot"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "  - 11",
      line: "  - 11 11 ➕2026-05-04 17-04-35 :: ",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["➕"] } },
      mode: "off",
    }),
    "  - 11 :: ➕2026-05-04 17-04-35",
    "final-line invariants normalize exact logged TagWheel effort leak shape"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "11",
      line: "11 11 ➕2026-05-04 15-02-34 ::",
      rules: {
        io: { separator1: "::", separator2: "::" },
        dates: { markers: [] },
        behavior: {
          dateRuntimeConfig: {
            byField: {
              effort: { emoji: "➕", format: "YYYY-MM-DD hh-mm-ss" },
            },
            canonical: { date_due: "date_due", date_start: "date_start", time: "time" },
          },
        },
        rightMode: {
          fields: [
            { id: "effort", orderKey: "effort", kind: "genericElement", marker: "", enabled: true },
          ],
        },
      },
      mode: "off",
    }),
    "11 :: ➕2026-05-04 15-02-34",
    "final-line invariants derive right marker from runtime config when dates.markers is empty"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "- [ ] 111",
      line: "111 :: 📅2026-04-24",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "off",
    }),
    "- [ ] 111 :: 📅2026-04-24",
    "final-line invariants helper preserves source list+checkbox prefix for date-right payload"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "- [ ] 111",
      line: "111 :: :: ",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "off",
    }),
    "- [ ] 111 :: ",
    "final-line invariants helper preserves source list+checkbox prefix after separator topology collapse"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "- [ ] 111",
      line: "- [ ] #topic-alpha 111 :: ",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "minimal",
    }),
    "- [ ] #topic-alpha :: 111",
    "final-line invariants helper moves plain text spill from left slot into text slot"
  );
  /*
   * Строка без текста получает ОБА разделителя, когда слева тег (10.13.34,
   * заказ заказчика 2026-09-05).
   *
   * Здесь закреплены обе половины правила сразу, потому что дефект и был в
   * том, что осталась одна: слева тег — два разделителя и место под текст
   * между ними; слева обычный текст — один, писать уже написано.
   *
   * Случай заказчика взят слово в слово из его записи, с одинаковыми
   * разделителями: разошлись два объявления правила именно на них.
   */
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "",
      line: "- #/1 :: 📅2026-09-05 21:19",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "off",
    }),
    "#/1 ::  :: 📅2026-09-05 21:19",
    "final-line invariants keep both separators when the left slot holds a tag"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "",
      line: "- #/1 ::  :: 📅2026-09-05 21:19",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "off",
    }),
    "#/1 ::  :: 📅2026-09-05 21:19",
    "final-line invariants do not collapse a line that already has both separators"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "",
      line: "- #/1 :: 📅2026-09-05 21:19",
      rules: { io: { separator1: "::", separator2: "||" }, dates: { markers: ["📅"] } },
      mode: "off",
    }),
    "#/1 :: || 📅2026-09-05 21:19",
    "different separators keep a single space between them, the same as before"
  );
  /*
   * Обратная половина: слева обычный текст — один разделитель. Это и есть
   * пять прежних утверждений набора, но сказанное прямо: без него правка
   * «два разделителя всегда» была бы зелёной.
   */
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "- 11",
      line: "- 11 :: 📅2026-09-05 21:19",
      rules: { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } },
      mode: "off",
    }),
    "- 11 :: 📅2026-09-05 21:19",
    "plain text in the left slot keeps one separator: there is nowhere to type"
  );
  assertEq(
    unified.collapseEmptyLeftSeparatorToText({
      line: "- || 111",
      parsedFinal: { tags: [], text: "111", dates: "" },
      rules: { io: { separator1: "||", separator2: "||" } },
      shouldCollapse: function() { return true; },
    }),
    "111",
    "shared left-empty separator collapse helper normalizes to plain text"
  );
  assertEq(
    unified.normalizeFullTagLineByEntries({
      line: "#a 111",
      entries: [{ token: "#b", tokens: ["#a", "#b"] }],
      placement: "line_end",
      cursorCh: 0,
      removeTokenWholeLine: function(line, token) {
        const t = String(token || "").trim();
        if (!t) return String(line || "");
        return String(line || "").replace(new RegExp(`(^|\\s)${t}(?=\\s|$)`, "g"), " ").replace(/\s{2,}/g, " ").trim();
      },
      resolveInsertIndexByPlacement: function(line) { return String(line || "").length; },
      insertTokenAtIndex: function(line, token, idx) {
        const src = String(line || "");
        const i = Math.max(0, Math.min(src.length, Number(idx) || 0));
        const left = src.slice(0, i);
        const right = src.slice(i);
        const sep = left && !/\s$/.test(left) ? " " : "";
        return `${left}${sep}${String(token || "")}${right}`;
      },
      remapCursorByLineDiff: function(_from, to) { return String(to || "").length; },
    }).line,
    "111 #b",
    "shared full-tag normalization helper repositions selected full token"
  );
  assertEq(
    unified.normalizeFullTagLineByEntries({
      line: "#a 111",
      entries: [{ token: "#b", tokens: ["#a", "#b"] }],
      placement: "line_end",
      cursorCh: 0,
      remapCursorByLineDiff: function(_from, to) { return String(to || "").length; },
    }).line,
    "111 #b",
    "shared full-tag normalization helper fallback path works without injected token helpers"
  );
  assertEq(
    unified.normalizeFullTagLineByEntries({
      line: "    - 111",
      entries: [{ token: "#b", tokens: ["#b"] }],
      placement: "line_end",
      cursorCh: 0,
      remapCursorByLineDiff: function(_from, to) { return String(to || "").length; },
    }).line,
    "    - 111 #b",
    "shared full-tag normalization helper preserves leading indent while appending token"
  );
  assertEq(
    String(unified.isSimplePlainRaw("111", { io: { separator1: "::", separator2: "::" } }, { requireNoSeparator: true })),
    "true",
    "shared plain-raw helper accepts plain no-separator input"
  );
  assertEq(
    String(unified.isSimplePlainRaw("## 111", { io: { separator1: "::", separator2: "::" } }, { requireNoSeparator: true })),
    "false",
    "shared plain-raw helper rejects heading input"
  );
  assertEq(
    String(unified.isSimplePlainRaw("111 :: x", { io: { separator1: "::", separator2: "::" } }, { requireNoSeparator: true })),
    "false",
    "shared plain-raw helper rejects separator-bearing input when no-separator required"
  );
  assertEq(
    String(unified.hasAnySeparator("111 :: x", { io: { separator1: "::", separator2: "::" } })),
    "true",
    "shared separator-presence helper detects configured separator"
  );

  const cursor = unified.resolveCursorByPolicy({
    finalLine: "abc def",
    rules: { io: { separator1: "::", separator2: "::" } },
    cursorPolicy: "text_end",
    getCursorAtTextEnd: function() { return 3; },
  });
  assertEq(String(cursor), "3", "cursor helper respects text_end policy");

  const cursorBootstrap = unified.resolveCursorByPolicy({
    finalLine: "- [ ] #todo :: ",
    rules: { io: { separator1: "::", separator2: "::" } },
    cursorPolicy: "current_position",
    originalLine: "",
    originalCursorCh: 0,
    bootstrapToTextEndWhenSourceEmpty: true,
    getCursorAtTextEnd: function(line) { return String(line || "").length; },
    remapCursorByLineDiff: function() { return 0; },
  });
  assertEq(String(cursorBootstrap), String("- [ ] #todo :: ".length), "cursor helper bootstraps to text end on empty source");

  const graphRules = {
    io: { separator1: "::", separator2: "::" },
    rightMode: {
      fields: [
        { id: "due", orderKey: "date_due", marker: "📅" },
        { id: "effort1", orderKey: "effort1", marker: "⛏️" },
      ],
    },
  };
  const facts = tokenGraph.buildTokenFactsFromLine("- [ ] #todo [[Entity-Alpha]] :: text :: 📅2026-04-27 ⛏️001", graphRules);
  const rawList = facts.map((f) => f.raw);
  assertEq(String(rawList.indexOf("#todo") !== -1), "true", "token graph extracts left tag token fact");
  assertEq(String(rawList.indexOf("[[Entity-Alpha]]") !== -1), "true", "token graph keeps raw-exact wikilink token fact");
  assertEq(String(rawList.indexOf("📅2026-04-27") !== -1), "true", "token graph extracts right date marker token fact");
  const dueFact = facts.find((f) => f.raw === "📅2026-04-27");
  assertEq(String(dueFact && dueFact.panel), "right", "token graph classifies marker token into right panel");

  const lookalikeFacts = tokenGraph.buildTokenFactsFromLine("[[EntityAlpha]] [[Entity-Alpha]]", graphRules);
  const lookalikeRaw = lookalikeFacts.map((f) => f.raw).join(" |");
  assertEq(String(/\[\[EntityAlpha\]\]/.test(lookalikeRaw)), "true", "token graph preserves latin lookalike token");
  assertEq(String(/\[\[Entity-Alpha\]\]/.test(lookalikeRaw)), "true", "token graph preserves cyrillic lookalike token");

  const dynamicDateRules = {
    behavior: {
      dateRuntimeConfig: {
        canonical: { due: "slotA", start: "slotB", time: "slotClock" },
      },
    },
    rightMode: {
      fields: [
        { id: "alpha_due_like", orderKey: "alpha_due_like", kind: "genericElement", marker: "⚙️" },
        { id: "fieldA", orderKey: "slotA", kind: "dateOffset", marker: "📆" },
        { id: "fieldB", orderKey: "slotB", kind: "dateOffset", marker: "🛫" },
        { id: "fieldClock", orderKey: "slotClock", kind: "nowTime", marker: "🕒" },
      ],
    },
  };
  const dateFields = runtimeHelpers.getDateFieldsFromRules(dynamicDateRules);
  assertEq(String(dateFields.due && dateFields.due.id), "fieldA", "date resolver uses canonical runtime mapping for due without name heuristics");
  assertEq(String(dateFields.start && dateFields.start.id), "fieldB", "date resolver uses canonical runtime mapping for start without name heuristics");
  assertEq(String(dateFields.timeNow && dateFields.timeNow.id), "fieldClock", "date resolver uses kind metadata for time without name heuristics");

  let ambiguousThrow = "";
  try {
    runtimeHelpers.getDateFieldsFromRules({
      rightMode: {
        fields: [
          { id: "d1", orderKey: "slot1", kind: "dateOffset", marker: "📅" },
          { id: "d2", orderKey: "slot2", kind: "dateOffset", marker: "🛫" },
        ],
      },
    }, { strict: true });
  } catch (e) {
    ambiguousThrow = String(e && e.message || "");
  }
  assertEq(String(/ambiguous dateOffset mapping/.test(ambiguousThrow)), "true", "date resolver fails fast when due/start canonical mapping is missing for multiple date fields");

  const selected = statusLineRuntime.selectTokenByPanelOrder({
    line: "- [ ] #todo #note || text",
    rules: { io: { separator1: "||", separator2: "||" } },
    panel: "left",
    tokenMap: [
      { id: "todo", token: "#todo" },
      { id: "note", token: "#note" },
    ],
    deps: {
      splitSegments: function (line) {
        const src = String(line || "");
        const parts = src.split("||");
        return {
          left: String(parts[0] || "").trim(),
          text: String(parts[1] || "").trim(),
          dates: String(parts[2] || "").trim(),
        };
      },
    },
  });
  assertEq(String(selected && selected.id), "note", "shared panel token resolver uses last token occurrence in preferred segment");

  const selectedByFacts = statusLineRuntime.selectTokenByPanelOrder({
    line: "#todo #note :: text",
    rules: { io: { separator1: "::", separator2: "::" } },
    panel: "left",
    tokenMap: [
      { id: "todo", token: "#todo" },
      { id: "note", token: "#note" },
    ],
    tokenFacts: [
      { raw: "#todo", panel: "left", position: 1 },
      { raw: "#note", panel: "left", position: 2 },
    ],
    deps: {
      splitSegments: function (line) {
        const src = String(line || "");
        const parts = src.split("::");
        return {
          left: String(parts[0] || "").trim(),
          text: String(parts[1] || "").trim(),
          dates: String(parts[2] || "").trim(),
        };
      },
    },
  });
  assertEq(String(selectedByFacts && selectedByFacts.id), "note", "shared panel token resolver prioritizes tokenFacts deterministic last occurrence");

  const selectedArbitraryIds = statusLineRuntime.selectTokenByPanelOrder({
    line: "#zeta #omega :: payload",
    rules: { io: { separator1: "::", separator2: "::" } },
    panel: "left",
    tokenMap: [
      { id: "fld_custom_42_val_a", token: "#zeta" },
      { id: "fld_custom_42_val_b", token: "#omega" },
    ],
    tokenFacts: [
      { raw: "#zeta", fieldId: "fld_custom_42", orderKey: "slot_x", panel: "left", position: 1 },
      { raw: "#omega", fieldId: "fld_custom_42", orderKey: "slot_x", panel: "left", position: 2 },
    ],
    deps: {
      splitSegments: function (line) {
        const src = String(line || "");
        const parts = src.split("::");
        return {
          left: String(parts[0] || "").trim(),
          text: String(parts[1] || "").trim(),
          dates: String(parts[2] || "").trim(),
        };
      },
    },
  });
  assertEq(String(selectedArbitraryIds && selectedArbitraryIds.id), "fld_custom_42_val_b", "shared panel token resolver remains deterministic for arbitrary non-canonical field ids/order keys");

  const markerByFacts = statusLineRuntime.selectMarkerValueByPanelOrder({
    line: "111 :: 📅2026-04-08 📅2026-04-10",
    rules: { io: { separator1: "::", separator2: "::" } },
    panel: "right",
    marker: "📅",
    valueRxSource: "\\d{4}-\\d{2}-\\d{2}",
    tokenFacts: [
      { raw: "📅2026-04-08", sourceKind: "marker", markerKind: "📅", panel: "right", position: 3 },
      { raw: "📅2026-04-10", sourceKind: "marker", markerKind: "📅", panel: "right", position: 4 },
    ],
    deps: {
      splitSegments: function (line) {
        const src = String(line || "");
        const parts = src.split("::");
        return {
          left: String(parts[0] || "").trim(),
          text: String(parts[1] || "").trim(),
          dates: String(parts[2] || "").trim(),
        };
      },
    },
  });
  assertEq(String(markerByFacts && markerByFacts.value), "2026-04-10", "shared marker resolver prioritizes tokenFacts deterministic last occurrence");

  /*
   * Пустой слот текста у строки, где Field завели на пустой (замечание
   * заказчика 2026-09-06). Слева один списочный знак, справа дата — значит,
   * между ними стоит пустой слот, и виден он вторым пробелом.
   */
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "- ",
      line: "- :: " + DATE_PAYLOAD,
      rules: SEP_RULES,
      mode: "off",
    }),
    "-  :: " + DATE_PAYLOAD,
    "final-line invariants keep an empty text slot on a bullet-only line"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "- [ ] ",
      line: "- [ ] :: " + DATE_PAYLOAD,
      rules: SEP_RULES,
      mode: "off",
    }),
    "- [ ]  :: " + DATE_PAYLOAD,
    "final-line invariants keep an empty text slot on a checkbox-only line"
  );
  /* И готовую строку не схлопывают обратно: именно это и происходило. */
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "- ",
      line: "-  :: " + DATE_PAYLOAD,
      rules: SEP_RULES,
      mode: "off",
    }),
    "-  :: " + DATE_PAYLOAD,
    "final-line invariants do not collapse an already correct empty slot"
  );

  /*
   * Сторож на само расхождение (У-32). Правило «как выглядит строка без
   * текста с правой частью» объявлено в двух местах и расходилось уже дважды:
   * 2026-09-05 на паре одинаковых разделителей, 2026-09-06 на пустом слоте.
   * Пин сверяет два хода на одних и тех же входах, а не каждый сам с собой:
   * третье расхождение покраснеет здесь, а не у заказчика на экране.
   */
  for (const left of ["-", "- [ ]", "- [x]", "* ", "1.", "- #todo", "- один", ""]) {
    const built = linePipeline.buildFromSegments(
      { indent: "", left: left, text: "", dates: DATE_PAYLOAD }, SEP_RULES);
    const finalized = unified.applyFinalLineInvariants({
      rawLine: (left || "-") + " ",
      line: built,
      rules: SEP_RULES,
      mode: "off",
    });
    assertEq(finalized, built,
      "right-payload line rule agrees between line_pipeline and finalize for left '" + left + "'");
  }
  console.log("Runtime unified parity tests: OK");
}

run();
