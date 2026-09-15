"use strict";

const path = require("path");
const shared = require(path.join(__dirname, "..", "..", "src", "core", "pkm_macro_shared.js"));
const unified = require(path.join(__dirname, "..", "..", "src", "core", "pkm_line_finalize_unified.js"));
const tokenGraph = require(path.join(__dirname, "..", "..", "src", "core", "token_graph_unified.js"));
const statusLineRuntime = require(path.join(__dirname, "..", "..", "src", "core", "status_line_runtime_unified.js"));
const runtimeHelpers = require(path.join(__dirname, "..", "..", "src", "core", "pkm_rules_runtime_helpers.js"));
const tagwheelCore = require(path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel_core.js"));
const tagwheelPanel = require(path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel.js"));
const preloadFacade = require(path.join(__dirname, "..", "..", "src", "core", "pkm_runtime_preload_facade.js"));
const linePipeline = require(path.join(__dirname, "..", "..", "src", "core", "line_pipeline.js"));
const runtimeHelpersShared = require(path.join(__dirname, "..", "..", "src", "core", "shared_utils.js"));

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
      let src = String(line || "").replace(/^\s*[-*+]\s+/, "");
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
      let src = String(line || "").replace(/^\s*[-*+]\s+/, "");
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
      let src = String(line || "").trim();
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

  /*
   * **Слово человека приклеивается к знаку заголовка, а значения полей — нет**
   * (10.13.156, 2026-09-15).
   *
   * Правило выше снимает висящий разделитель на строке-заголовке с пустой
   * зоной значений, и спрашивало оно **место в строке**, а не то, что там
   * стоит. У заказчика оба разделителя записаны одинаково (`::` и `::`), и
   * правый Block в делении на три зоны попадает в слот текста — то есть
   * правило приклеивало к заголовку **значения полей**: команда отдавала
   * `# #work #aaa`, панель на той же строке — `# #work #aaa :: `.
   *
   * На разведённых разделителях этого не видно ни на одной паре (У-147),
   * поэтому ниже пары стоят в обеих формах: одинаковые разделители и разные.
   */
  for (const [sep2, name] of [["::", "одинаковые разделители"], ["~~", "разные разделители"]]) {
    const rules = { io: { separator1: "::", separator2: sep2 }, dates: { markers: ["📅"] } };
    assertEq(
      unified.normalizeStructuredSlots({ rawLine: "# #aaa", line: "#  :: #work #aaa", rules, mode: "minimal" }),
      "#  :: #work #aaa",
      "значения полей к заголовку не приклеиваются (" + name + ")"
    );
    assertEq(
      unified.normalizeStructuredSlots({ rawLine: "# слово", line: "#  :: слово", rules, mode: "minimal" }),
      "# слово",
      "слово человека к заголовку приклеивается по-прежнему (" + name + ")"
    );
  }

  /*
   * **Пустой слот под текст держится у любого знака начала строки**
   * (10.13.156). Условие было написано литералом `left === "-"` и знало одну
   * форму начала из пяти: на заголовке слот схлопывался в один пробел, и
   * команда отдавала `# :: 📅…` там, где панель отдавала `#  :: 📅…`.
   *
   * Ниже — по строке на каждую форму начала, плюс контроль обратной стороны:
   * там, где слева стоит **значение**, а не начало, слот не удваивается.
   */
  const SLOT_RULES = { io: { separator1: "::", separator2: "::" }, dates: { markers: ["📅"] } };
  const SLOT_CASES = [
    ["- :: 📅2026-01-02", "-  :: 📅2026-01-02", "знак списка"],
    ["# :: 📅2026-01-02", "#  :: 📅2026-01-02", "заголовок"],
    ["### :: 📅2026-01-02", "###  :: 📅2026-01-02", "заголовок третьего уровня"],
    ["1. :: 📅2026-01-02", "1.  :: 📅2026-01-02", "номер списка"],
    ["- [ ] :: 📅2026-01-02", "- [ ]  :: 📅2026-01-02", "знак задачи"],
    ["- #work :: 📅2026-01-02", "- #work :: 📅2026-01-02", "слева значение — слот не удваивается"],
  ];
  for (const [input, expected, name] of SLOT_CASES) {
    assertEq(unified.normalizeSingleSeparatorLayout(input, SLOT_RULES), expected,
      "пустой слот под текст: " + name);
  }
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
  /*
   * **Текст человека остаётся текстом человека, даже если он из двух цифр.**
   *
   * Его слова 2026-09-13: «была строка `- 12`, после активации Due получил
   * `-  :: 📅2026-09-13 16:38 12`». Значение Due стояло слева целиком, а
   * ветка «значение разорвано разделителем» всё равно приклеивала к нему
   * текст: «чем бывает хвост значения» было написано рукописным образцом, и
   * `12` под него подходило (У-150 — правило, объявленное второй раз).
   *
   * Правила здесь с форматом поля, как у него: длину значения решает формат,
   * а не догадка.
   */
  const dueRules = {
    io: { separator1: "||", separator2: "::" },
    dates: { markers: ["\u{1F4C5}"] },
    behavior: {
      dateRuntimeConfig: { byField: { due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD hh:mm" } } },
    },
    leftMode: { fields: [] },
    rightMode: { fields: [] },
  };
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "- 12",
      line: "- \u{1F4C5}2026-09-13 16:38 || 12",
      rules: dueRules,
      mode: "off",
    }),
    "- \u{1F4C5}2026-09-13 16:38 || 12",
    "final-line invariants keep a two-digit human text out of the element value"
  );
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "- 16:38",
      line: "- \u{1F4C5}2026-09-13 16:55 || 16:38",
      rules: dueRules,
      mode: "off",
    }),
    "- \u{1F4C5}2026-09-13 16:55 || 16:38",
    "final-line invariants keep a time-looking human text out of a complete element value"
  );
  /*
   * И **положительный контроль к обоим**: значение, которое разделитель и
   * правда разорвал, склеивается обратно. Без него оба утверждения выполнялись
   * бы кодом, который не склеивает ничего и никогда (У-88).
   */
  assertEq(
    unified.applyFinalLineInvariants({
      rawLine: "- \u{1F4C5}2026-09-13",
      line: "- \u{1F4C5}2026-09-13 || 16:57",
      rules: dueRules,
      mode: "off",
    }),
    "-  :: \u{1F4C5}2026-09-13 16:57",
    "positive control: a value really torn by the separator is glued back"
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
    /*
     * **Здесь стояло ожидание одного пробела, и оно закрепляло дефект**
     * (У-58). Пустой слот под текст отмечается двумя пробелами; при
     * совпадающих разделителях так и было, при разведённых — нет, и
     * проверка честно охраняла «как было». Заказчик увидел это на экране
     * 2026-09-11: `- #/1 || :: 🤣…` с одним пробелом.
     */
    "#/1 ::  || 📅2026-09-05 21:19",
    "разведённые разделители держат пустой слот под текст — два пробела"
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

  /*
   * **«Как значение поля выглядит в строке» — одно объявление, и вот его
   * таблица форм.**
   *
   * До 2026-09-15 объявлений было два: своё у панели и своё у команд, и оба
   * кормили один общий модуль. Сверены на 189 парах — все значения его
   * конфига и шесть форм полей, которых у него нет, — разошлись на нуле, и
   * копия снята. Здесь закреплены формы, на которых копии могли разойтись:
   * готовый тег и готовая ссылка проходят насквозь, источник решает вывод,
   * приставка подставляется, а косая черта без приставки получает решётку.
   */
  const outToken = (field, value, rules) => tagwheelCore.buildOutputToken(field, value, rules || {});
  assertEq(outToken({ id: "f", prefix: "#" }, { token: "#todo" }), "#todo",
    "готовый тег проходит насквозь");
  assertEq(outToken({ id: "f", prefix: "#" }, { token: "[[note]]" }), "[[note]]",
    "готовая ссылка проходит насквозь");
  assertEq(outToken({ id: "f", prefix: "#" }, { token: "plain" }), "#plain",
    "приставка подставляется");
  assertEq(outToken({ id: "f", prefix: "@" }, { token: "plain" }), "@plain",
    "приставка не обязана быть решёткой");
  assertEq(outToken({ id: "f", prefix: "" }, { token: "/1" }), "#/1",
    "косая черта без приставки получает решётку");
  assertEq(outToken({ id: "f", prefix: "#", source: "wikilinks:f" }, { token: "note" }), "[[note]]",
    "поле-источник «ссылки» печатает ссылку");
  assertEq(outToken({ id: "f", prefix: "#", source: "wikilinks:f" }, { token: "note", link: "Другая заметка" }), "[[Другая заметка]]",
    "подпись значения сильнее его токена");
  /*
   * **Поле-источник «проекты» печатает ссылку при любом `output`, и это
   * измеренный ответ, а не догадка.** Здесь копии и правда расходились:
   * панель печатала ссылку всегда, а команды читали `rules.projects.output` и
   * при `tag` (умолчании!) печатали тег. Победило написание панели, а контрола
   * у `projects.output` в панели нет вовсе и не пишет его никто.
   *
   * **Имя третьего объявления здесь было неверным.** Строка звала
   * `resolveOutputKind` в `pkm_rules_runtime_helpers.js` — функции с таким
   * именем в репозитории нет ни одной, и объяснение стояло над пустотой.
   * На деле третьим было замыкание `resolveFieldOutputMode` внутри
   * `buildTagTokenKeyMap`. С 2026-09-15 объявление одно: все три дороги
   * спрашивают `helpers.resolveFieldOutputMode` (10.13.139).
   *
   * Досягаемость названа честно: `source: "projects"` нынешний редактор Fields
   * не создаёт — он делает только `wikilinks:<ключ>`, — так что форма эта
   * приезжает разве что из конфига версии 1.
   */
  assertEq(outToken({ id: "f", prefix: "#", source: "projects" }, { token: "note" }, { projects: { output: "wikilink", items: [] } }), "[[note]]",
    "поле-источник «проекты» печатает ссылку при выводе ссылкой");
  assertEq(outToken({ id: "f", prefix: "#", source: "projects" }, { token: "note" }, { projects: { output: "tag", items: [] } }), "[[note]]",
    "и при выводе тегом — тоже ссылку: контрола у этой настройки нет");
  assertEq(outToken({ id: "f", prefix: "#" }, { token: "" }), "",
    "пустое значение токена не даёт");

  /*
   * **Третье объявление того же правила — у самой панели**, и до 2026-09-15
   * его не считал никто: запись выше говорила «объявлений было два».
   * `tagwheel.js` держит `buildOutputTokenForFieldValue`, и ветвь ссылки у
   * него разворачивала цель (`normalizeWikilinkTarget`), а здесь, в ядре,
   * цель бралась **как есть**. На `link` со скобками ядро собирало
   * `[[[[X]]]]`, панель — `[[X]]`: один вопрос, два ответа, и какой человек
   * получит, решала кнопка (У-150, У-159).
   *
   * **Сторожей здесь два, и второй не лишний** (У-92). Сверка «панель равна
   * ядру» после сведения зеленеет сама: обе стороны спрашивают один дом, и
   * поломка дома ломает их одинаково. Поэтому рядом стоит ожидание,
   * написанное **числом, а не сравнением**: цель разворачивается ровно один
   * раз. Первый сторож ловит новое расхождение, второй — общую поломку.
   *
   * Формы взяты те, на которых расхождение было измерено настоящими телами
   * обоих движков: скобки в `link`, пробелы вокруг цели и подпись после
   * вертикальной черты.
   */
  /*
   * Панель спрашивает «какого рода этот источник» через шов
   * `__inlinePkmRulesHelpers`, и ставит его сам плагин — прослойкой
   * предзагрузки. Зовём её, а не пишем присваивание своей рукой: своя копия
   * установки шва разошлась бы с продуктом ровно так же, как разошлось
   * правило, ради которого этот сторож заведён (У-42).
   *
   * Загрузчик объявлен асинхронным, но `await` в его теле нет, поэтому шов
   * встаёт синхронно. Это утверждение о чужом коде, и оно проверяется строкой
   * ниже, а не принимается на веру: появится там `await` — сторож покраснеет
   * здесь, а не там, где панель молча не найдёт помощников.
   */
  preloadFacade.loadRulesRuntimeHelpers();
  assertEq(typeof (globalThis.__inlinePkmRulesHelpers || {}).normalizeFieldSourceKind, "function",
    "шов помощников встал синхронно — иначе панель звать нечем");

  const panelToken = (field, value, rules) =>
    tagwheelPanel.buildOutputTokenForFieldValue(field, value, rules || {});
  const LINK_FIELD = { id: "f", prefix: "#", source: "wikilinks:f" };
  const UNWRAP_CASES = [
    [{ token: "X", link: "[[X]]" }, "[[X]]", "скобки в подписи значения не удваиваются"],
    [{ token: "X " }, "[[X]]", "пробел у токена в цель ссылки не уезжает"],
    [{ token: "X", link: " X " }, "[[X]]", "пробелы вокруг цели снимаются"],
    [{ token: "X", link: "[[X|подпись]]" }, "[[X|подпись]]", "подпись ссылки переживает разворот"],
    [{ id: "Y" }, "[[Y]]", "цель берётся у идентификатора, когда токена и подписи нет"],
  ];
  for (const [value, expected, name] of UNWRAP_CASES) {
    assertEq(outToken(LINK_FIELD, value), expected, "ядро: " + name);
    assertEq(panelToken(LINK_FIELD, value), expected, "панель: " + name);
  }

  /*
   * **Готовое значение проходит насквозь — и у панели тоже.**
   *
   * У ядра это закреплено выше; у панели не было закреплено ничем, а внутри
   * она склеивает приставку со значением своим `composeToken`, у которого
   * охраны «это уже тег» нет вовсе — она стоит **у звавшего**, ранним
   * возвратом. Правило одно, а охрана у четырёх его объявлений распределена
   * по-разному (10.13.147), и держится всё на том, что до склейки дело не
   * доходит. Вот это и закрепляется: его значения хранятся **с решёткой**
   * (`#todo`, `#/1`), и удвоиться она не должна ни на одном пути.
   */
  const TAG_FIELD = { id: "f", prefix: "#" };
  assertEq(panelToken(TAG_FIELD, { token: "#todo" }), "#todo",
    "панель: готовый тег проходит насквозь, решётка не удваивается");
  assertEq(panelToken(TAG_FIELD, { token: "#/1" }), "#/1",
    "панель: готовый тег с косой чертой проходит насквозь");
  assertEq(panelToken(TAG_FIELD, { token: "[[note]]" }), "[[note]]",
    "панель: готовая ссылка проходит насквозь");
  assertEq(panelToken(TAG_FIELD, { token: "plain" }), "#plain",
    "панель: приставка подставляется значению без неё");

  /*
   * **И с 2026-09-15 это правило объявлено один раз** (10.13.152, его слово
   * «убирать лишнее в самом правиле»). Четыре тела сведены к дому в
   * `shared_utils.js`; охрана переехала из ранних возвратов у звавших в само
   * правило.
   *
   * Сравнивать четыре дороги между собой после сведения бессмысленно — они
   * ломаются одинаково (У-92, У-194). Поэтому здесь написан **ответ**, а не
   * равенство сторон, и по строке на каждое условие правила: пустота,
   * готовая ссылка, стоящая приставка, значение без приставки и «косая черта
   * без приставки вовсе». Возврат копии ловит не это, а обход по форме в
   * `bootstrap_loader_tests.js` (У-195).
   */
  const COMPOSE_CASES = [
    ["#", "#todo", "#todo", "стоящая приставка не удваивается"],
    ["#", "#/1", "#/1", "стоящая приставка не удваивается и перед косой чертой"],
    ["#", "plain", "#plain", "значению без приставки она подставляется"],
    ["#", "  #todo  ", "#todo", "пробелы вокруг значения в строку не уезжают"],
    ["#", "", "", "пустое значение остаётся пустым, приставка сама значением не становится"],
    ["#", "   ", "", "значение из одних пробелов тоже пусто"],
    ["#", "[[note]]", "[[note]]", "готовая ссылка проходит насквозь"],
    ["#", "[[note|подпись]]", "[[note|подпись]]", "ссылка с подписью проходит насквозь"],
    ["", "/1", "#/1", "приставки нет вовсе, а значение с косой черты — ставится решётка"],
    ["", "plain", "plain", "приставки нет — значение остаётся как есть"],
    /*
     * Тот самый край, ради которого сведение назвало свою цену: прежнее тело
     * у помощников пропускало насквозь **любой** готовый тег и при приставке,
     * не равной решётке, теряло её. У заказчика приставка одна, и он этого не
     * увидел бы; теперь приставка применяется.
     */
    ["@", "#todo", "@#todo", "приставка, не равная решётке, применяется и к значению с решёткой"],
    ["@", "@todo", "@todo", "своя приставка не удваивается и когда она не решётка"],
  ];
  for (const [prefix, raw, expected, name] of COMPOSE_CASES) {
    assertEq(runtimeHelpersShared.composeToken(prefix, raw), expected, "склейка приставки: " + name);
  }
  assertEq(runtimeHelpersShared.composeToken(undefined, "todo"), "#todo",
    "склейка приставки: приставки не передали — берётся решётка");

  /*
   * **«Каким выводом печатается это поле» — одно объявление на три дороги**
   * (10.13.139). Было три: панель, ядро и замыкание внутри
   * `buildTagTokenKeyMap` у самих помощников. Сверены на 150 парах
   * «поле × правила» — все поля его `data.json` и десять форм, которых у него
   * нет, на шести наборах правил — и разошлись на нуле, поэтому сведение
   * поведения не изменило.
   *
   * **Сравнение трёх сторон после сведения ничего не доказывает** — они
   * спрашивают один дом и ломаются одинаково (У-92). Вес несут ожидания,
   * написанные ответом, а не равенством; сравнение оставлено рядом затем,
   * чтобы поймать возврат своего тела в один из движков.
   */
  const OUT_MODE_CASES = [
    [{ id: "f", source: "wikilinks:X" }, {}, "wikilink", "источник-ссылка печатает ссылку"],
    [{ id: "f", source: "projects" }, {}, "wikilink", "источник-проекты печатает ссылку"],
    [{ id: "f" }, {}, "tag", "поле без источника печатает тег"],
    [{ id: "f", source: "s" }, { s: { output: "wikilink" } }, "wikilink", "источник решает вывод по правилам"],
    [{ id: "f", source: "s" }, { s: { output: "" } }, "tag", "пустой вывод источника читается как тег"],
    [{ id: "f", outputMode: "  WIKILINK  " }, {}, "wikilink", "свой вывод поля сильнее источника и не боится регистра"],
  ];
  const outModeSides = [
    ["панель", (f, r) => tagwheelPanel.resolveFieldOutputMode(f, r)],
    ["ядро", (f, r) => tagwheelCore.resolveFieldOutputMode(f, r)],
    ["дом", (f, r) => runtimeHelpers.resolveFieldOutputMode(f, r)],
  ];
  for (const [field, rules, expected, name] of OUT_MODE_CASES) {
    for (const [side, fn] of outModeSides) {
      assertEq(String(fn(field, rules)), expected, side + ": " + name);
    }
  }

  /*
   * **«Как начало строки склеивается с её телом» — одно объявление**
   * (10.13.145). Приватная копия в `pkm_line_finalize_unified.js` была слово в
   * слово равна дому: сверены на 113 490 парах «начало × тело» — все начала и
   * тела строк его заметок, все строковые значения его конфига и тринадцать
   * краёв, — расхождений ноль.
   *
   * **Сторож нужен был именно здесь, и это выяснила мутация, а не чтение.**
   * Возврат копии, разошедшейся на одном крае — «начало есть, тела нет», —
   * набор не заметил вовсе: 70 проверок из 70 зелёные, обход строки 0
   * расхождений. А край этот виден глазом: он даёт **хвостовой пробел** после
   * знака списка на пустой строке, то есть `"- "` вместо `"-"`.
   *
   * Ожидания написаны ответом, а не равенством дома и копии (У-194): после
   * сведения обе стороны — один код.
   */
  {
    const join = linePipeline.joinLeftPrefix;
    assertEq(join("-", "text"), "- text", "начало и тело склеиваются одним пробелом");
    assertEq(join("- [x]", "text"), "- [x] text", "знак задачи остаётся частью начала");
    assertEq(join("-", ""), "-", "начало без тела не отращивает хвостовой пробел");
    assertEq(join("", "text"), "text", "тело без начала идёт как есть");
    assertEq(join("", ""), "", "пусто с пустым даёт пусто");
    assertEq(join("  -  ", "  text  "), "- text", "пробелы по краям обеих частей снимаются");
    assertEq(join(null, undefined), "", "отсутствующие части не превращаются в слово");
  }

  /*
   * **«Как нормализуется ключ Order» — одно объявление** (10.13.146). До
   * 2026-09-15 то же тело стояло шесть раз под тремя именами; сверены текстом,
   * совпали все шесть.
   *
   * Ожидание написано ответом, а не равенством шести сторон (У-194): после
   * сведения они один код.
   */
  {
    const normKey = runtimeHelpersShared.normalizeOrderKey;
    assertEq(normKey("  imp  "), "imp", "пробелы по краям ключа снимаются");
    assertEq(normKey("Imp"), "Imp", "регистр ключа не трогается: он значим");
    assertEq(normKey("imp_sub"), "imp_sub", "подпись дочернего ключа остаётся частью ключа");
    assertEq(normKey(""), "", "пустой ключ остаётся пустым");
    assertEq(normKey(null), "", "отсутствующий ключ не превращается в слово");
    assertEq(normKey(0), "", "ноль ключом не становится");
  }

  console.log("Runtime unified parity tests: OK");
}

run();
