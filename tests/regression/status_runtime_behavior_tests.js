"use strict";

const fs = require("fs");
const path = require("path");
const runtime = require(path.join(__dirname, "..", "..", "pkm_runtime_v2.js"));

function assertEq(actual, expected, name) {
  if (actual !== expected) {
    throw new Error(name + ": expected '" + expected + "' got '" + actual + "'");
  }
}

function assertTrue(v, name) {
  if (!v) throw new Error(name + ": expected truthy");
}

function makeEditor(line, ch) {
  let cur = { line: 0, ch: Number(ch || 0) };
  let text = String(line || "");
  return {
    getCursor() { return { line: cur.line, ch: cur.ch }; },
    getLine() { return text; },
    setLine(_lineNo, value) { text = String(value || ""); },
    replaceRange(value, _from, _to) { text = String(value || ""); },
    setCursor(next) { cur = { line: Number(next.line || 0), ch: Number(next.ch || 0) }; },
    snapshot() { return { line: text, cursor: { line: cur.line, ch: cur.ch } }; },
  };
}

function makeWindowMock() {
  const listeners = {};
  return {
    __tagWheelState: { active: false },
    addEventListener(type, handler) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(handler);
    },
    removeEventListener(type, handler) {
      const arr = listeners[type] || [];
      listeners[type] = arr.filter((h) => h !== handler);
    },
    fire(type, evt) {
      const arr = listeners[type] || [];
      arr.slice().forEach((h) => h(evt));
    },
  };
}

function makeAppForRuntime(editor) {
  const vaultRoot = path.resolve(__dirname, "..", "..", "..", "..", "..");
  const fixtureRulesPath = path.resolve(__dirname, "..", "fixtures", "InlineOverhaul_Generated_RULES_TagWheel.md");
  function toAbs(vaultPath) {
    const src = String(vaultPath || "").trim();
    if (src === "InlineOverhaul_Generated_RULES_TagWheel.md") {
      return fixtureRulesPath;
    }
    return path.resolve(vaultRoot, src);
  }
  return {
    workspace: {
      activeLeaf: { view: { editor } },
      activeEditor: { editor },
    },
    vault: {
      getAbstractFileByPath(vaultPath) {
        const abs = toAbs(vaultPath);
        return fs.existsSync(abs) ? { path: vaultPath } : null;
      },
      async read(fileLike) {
        const vaultPath = fileLike && typeof fileLike === "object" ? fileLike.path : fileLike;
        return fs.promises.readFile(toAbs(vaultPath), "utf8");
      },
      adapter: {
        async read(vaultPath) {
          return fs.promises.readFile(toAbs(vaultPath), "utf8");
        },
      },
    },
  };
}

function buildOrderConfig(overrides) {
  function mapToSides(panelMap) {
    function aliasesFor(key) {
      const k = String(key || "").trim();
      if (k === "importance") return ["importance", "priority"];
      if (k === "category") return ["category", "context"];
      if (k === "category_sub") return ["category_sub", "nestedContext"];
      if (k === "type_sub") return ["type_sub", "modal"];
      return [k];
    }
    const left = [];
    const right = [];
    Object.keys(panelMap || {}).forEach((k) => {
      const bucket = String(panelMap[k] || "").toLowerCase() === "right" ? right : left;
      aliasesFor(k).forEach((name) => {
        if (!name) return;
        if (bucket.indexOf(name) === -1) bucket.push(name);
      });
    });
    return { left, right };
  }
  const base = {
    active: {
      importance: "yes",
      type: "yes",
      category: "yes",
      project: "yes",
      client: "yes",
      client1: "yes",
    },
    panel: {
      importance: "left",
      type: "left",
      category: "left",
      project: "left",
      client: "left",
      client1: "left",
      date_due: "right",
      date_start: "right",
      time: "right",
      effort: "right",
    },
    left: ["importance", "type", "category", "project", "client", "client1"],
    right: ["date_due", "date_start", "time", "effort"],
    enabled: {
      importance: true,
      type: true,
      category: true,
      project: true,
      client: true,
      client1: true,
      date_due: true,
      date_start: true,
      time: true,
      effort: true,
    },
    freeRoam: {
      importance: "off",
      type: "off",
      category: "off",
      project: "off",
      client: "off",
      client1: "off",
      date_due: "off",
      date_start: "off",
      time: "off",
      effort: "off",
    },
    freeRoamBehavior: {
      minimalSeparator: true,
      minimalPrefix: true,
      offPrefix: false,
      fullPlacement: "smart",
    },
  };
  /*
   * Ключ Order и имя Field в фикстуре **разные**: ключ `category`, а поле
   * названо `context` (и так же `importance`/`priority`,
   * `category_sub`/`nestedContext`, `type_sub`/`modal`). Связь между ними
   * объявляется здесь тем же каналом, каким её несёт продукт, — `strictNames`:
   * его пишет `setStrictName` при переименовании Field, и по нему движок
   * находит поле по ключу (A17).
   *
   * До 2026-09-04 связи здесь не было вовсе, и движок угадывал поле по номеру
   * в списке. В фикстуре догадка попадала верно, поэтому двадцать проверок
   * были зелёными на совпадении (У-49). Совпадение в фикстуре — не упрощение,
   * а снятая проверка (У-47).
   */
  const STRICT_NAMES_BY_KEY = {
    importance: "priority",
    category: "context",
    category_sub: "nestedContext",
    type_sub: "modal",
  };
  const src = overrides && typeof overrides === "object" ? overrides : {};
  const out = JSON.parse(JSON.stringify(base));
  ["active", "panel", "freeRoam", "freeRoamBehavior"].forEach((k) => {
    if (src[k] && typeof src[k] === "object") Object.assign(out[k], src[k]);
  });
  if (Array.isArray(src.left)) out.left = src.left.slice();
  if (Array.isArray(src.right)) out.right = src.right.slice();
  if (src.enabled && typeof src.enabled === "object") Object.assign(out.enabled, src.enabled);
  if (!Array.isArray(src.left) && !Array.isArray(src.right)) {
    const sides = mapToSides(out.panel);
    out.left = sides.left;
    out.right = sides.right;
  }
  out.strictNames = { ...(out.strictNames || {}) };
  for (const k of out.left.concat(out.right)) {
    const key = String(k || "").trim();
    if (!key) continue;
    out.strictNames[key] = STRICT_NAMES_BY_KEY[key] || key;
  }
  return JSON.stringify(out);
}

async function runPkmCommandWithEditor(command, editor, settings) {
  const app = makeAppForRuntime(editor);
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  if (!global.window) global.window = makeWindowMock();
  if (typeof global.Notice !== "function") {
    global.Notice = function Notice() {};
  }
  try {
    await runtime.runCommand({ app, command, settings: settings || {} });
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
}

async function runTagWheelApply(editor, settings) {
  const app = makeAppForRuntime(editor);
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  if (!global.window) global.window = makeWindowMock();
  if (typeof global.Notice !== "function") global.Notice = function Notice() {};
  try {
    await runtime.runCommand({ app, command: "tagWheel", settings: settings || {} });
    await runtime.runCommand({ app, command: "tagWheel", settings: settings || {} });
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
}

async function testImportanceRespectsCustomSeparatorsAndCursorClamp() {
  const editor = makeEditor("- [ ] #/1 #todo :: text ~~ 📅2026-04-08", 9);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      panel: { importance: "left" },
      freeRoam: { importance: "off" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "current_position",
  });
  const shot = editor.snapshot();
  assertTrue(/#\/2/.test(shot.line) && /#todo/.test(shot.line), "importance cycle updates token and preserves non-priority payload");
  assertTrue(shot.cursor.ch >= 0 && shot.cursor.ch <= shot.line.length, "importance cycle returns valid cursor range");
}

async function testStatusTagsRunCommandPathCyclesType() {
  const editor = makeEditor("- [ ] #todo || text", 4);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:type",
    "Direction": "increase",
    "Order config": buildOrderConfig({ panel: { type: "left" } }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "current_position",
  });
  const shot = editor.snapshot();
  assertTrue(/\|\|\s+text$/.test(shot.line), "status_tags runCommand path preserves text-slot separator contract");
  assertTrue(/#\S+/.test(shot.line), "status_tags runCommand path keeps type token in output");
  assertTrue(shot.cursor.ch >= 0 && shot.cursor.ch <= shot.line.length, "status_tags runCommand path keeps valid cursor");
}

async function testStatusTagsRunCommandPathCyclesTypeGenericAction() {
  const editor = makeEditor("- [ ] #todo || text", 4);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:type",
    "Direction": "increase",
    "Order config": buildOrderConfig({ panel: { type: "left" } }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "current_position",
  });
  const shot = editor.snapshot();
  assertTrue(/\|\|\s+text$/.test(shot.line), "status_tags generic cycle_field:type preserves text-slot separator contract");
  assertTrue(/#\S+/.test(shot.line), "status_tags generic cycle_field:type keeps type token in output");
  assertTrue(shot.cursor.ch >= 0 && shot.cursor.ch <= shot.line.length, "status_tags generic cycle_field:type keeps valid cursor");
}

async function testStatusTagsTypeHydrationUsesLastTokenOccurrence() {
  const editor = makeEditor("- [ ] #todo #note || text", 11);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:type",
    "Direction": "increase",
    "Order config": buildOrderConfig({ panel: { type: "left" }, freeRoam: { type: "off" } }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  const typeTokens = line.match(/#(todo|idea|note|open|source)/g) || [];
  assertEq(typeTokens.length, 1, "type cycle should keep single managed type token when source has duplicate type tokens");
  assertEq(typeTokens[0], "#open", "type cycle should continue from last source occurrence token (#note -> #open)");
}

async function testStatusDateRunCommandPathIncrementsDue() {
  const before = "- [ ] #todo || text || 📅2026-04-08";
  const editor = makeEditor(before, 2);
  await runPkmCommandWithEditor("statusDate", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "field_inc:date_due",
    "Order config": buildOrderConfig({ panel: { date_due: "right" } }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "line_end",
  });
  const shot = editor.snapshot();
  assertTrue(/2026-04-\d{2}/.test(shot.line), "status_date runCommand path keeps due date tokenized");
  assertTrue(shot.cursor.ch >= 0 && shot.cursor.ch <= shot.line.length, "status_date runCommand path keeps valid cursor");
}

async function testStatusDateHydrationUsesLastDueOccurrence() {
  const fixtureRules = fs.readFileSync(path.join(__dirname, "..", "fixtures", "InlineOverhaul_Generated_RULES_TagWheel.md"), "utf8");
  const hasDueField = /"id"\s*:\s*"due"/.test(fixtureRules);
  assertTrue(hasDueField, "status_date duplicate-due regression requires fixture field id=due");
  const before = "- [ ] #todo || text || 📅2026-04-08 📅2026-04-10";
  const editor = makeEditor(before, 2);
  await runPkmCommandWithEditor("statusDate", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "field_inc:date_due",
    "Order config": buildOrderConfig({ panel: { date_due: "right" }, active: { date_due: "yes" }, enabled: { date_due: true } }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "line_end",
  });
  const line = editor.snapshot().line;
  const dueTokens = line.match(/📅\d{4}-\d{2}-\d{2}/g) || [];
  assertEq(dueTokens.length, 1, "status_date should keep single managed due token when duplicate due tokens exist in source; line=" + line);
  assertEq(dueTokens[0], "📅2026-04-11", "status_date should continue from last due token occurrence on increase");
}

async function testStatusDateRunCommandPathIncrementsDueGenericAction() {
  const before = "- [ ] #todo || text || 📅2026-04-08";
  const editor = makeEditor(before, 2);
  await runPkmCommandWithEditor("statusDate", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "field_inc:date_due",
    "Order config": buildOrderConfig({ panel: { date_due: "right" } }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "line_end",
  });
  const shot = editor.snapshot();
  assertTrue(/2026-04-\d{2}/.test(shot.line), "status_date generic field_inc:date_due keeps due date tokenized");
  assertTrue(shot.cursor.ch >= 0 && shot.cursor.ch <= shot.line.length, "status_date generic field_inc:date_due keeps valid cursor");
}

async function testStatusDateConfiguredSeparatorTreatsDoublePipeAsPlainText() {
  const before = "- [ ] #todo :: || text || :: 📅2026-04-27";
  const editor = makeEditor(before, 2);
  await runPkmCommandWithEditor("statusDate", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "field_inc:due",
    "Order config": buildOrderConfig({ panel: { due: "right" }, active: { due: "yes" }, enabled: { due: true } }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "line_end",
  });
  const line = editor.snapshot().line;
  assertTrue(line.indexOf("|| text ||") !== -1, "status_date keeps non-config double-pipe payload as plain text when active separator is ::");
}

async function testStatusTagsOffHeadingDoesNotInjectBullet() {
  const editor = makeEditor("## heading", 3);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:type",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { type: "off" },
      panel: { type: "left" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s*##\s+/.test(line), "status_tags off heading should keep heading prefix");
  assertTrue(!/^\s*[-*+]\s+/.test(line), "status_tags off heading should not convert to list prefix");
}

async function testStatusImportanceOffHeadingRewritesWithoutHeadingLeak() {
  const editor = makeEditor("## heading", 3);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "off" },
      panel: { importance: "left" },
      freeRoamBehavior: { minimalSeparator: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s*##\s+/.test(line), "status_tags importance off heading left should keep heading prefix");
  assertTrue(/#\/1/.test(line), "status_tags importance off heading left should still apply priority token");
  assertTrue(!/^\s*[-*+]\s+/.test(line), "status_tags importance off heading left should not convert to list prefix");
  assertTrue(/^\s*##\s+#\/1\s+\S+\s+heading(?:\s+\S+\s+\S+)?\s*$/.test(line), "status_tags importance off heading left should keep text in text-slot after separator");
}

async function testStatusImportanceOffHeadingRightPanelKeepsSeparator() {
  const editor = makeEditor("## heading", 3);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "off" },
      panel: { importance: "right" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s*##\s+/.test(line), "status_tags importance off heading right should keep heading prefix");
  assertTrue(/#\/1/.test(line), "status_tags importance off heading right should still apply priority token");
  assertTrue(!/^\s*[-*+]\s+/.test(line), "status_tags importance off heading right should not convert to list prefix");
  assertTrue(/^\s*##\s+\S+\s+heading\s+\S+\s+#\/1\s*$/.test(line), "status_tags importance off heading right should keep heading text before token and retain separator structure");
}

async function testStatusContextMinimalHeadingKeepsTextSlotAfterSeparator() {
  const editor = makeEditor("## 111", 3);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s*##\s+/.test(line), "status_tags minimal heading should keep heading prefix");
  assertTrue(!/^\s*[-*+]\s+/.test(line), "status_tags minimal heading should not convert heading to list prefix");
  assertTrue(/^\s*##\s+#\S+\s+\S+\s+111(?:\s+\S+\s+\S+)?\s*$/.test(line), "status_tags minimal heading should keep source text in text-slot after separator");
  assertTrue(!/^\s*##\s+#\S+\s+111\s+\S+/.test(line), "status_tags minimal heading should not place text into left slot before separator");
}

async function testStatusImportanceOffHeadingCycleEndRemovesDanglingSeparator() {
  const editor = makeEditor("## #/3 :: 111", 5);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "off" },
      panel: { importance: "left" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "current_position",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s*##\s+111\s*$/.test(line), "status_tags importance off heading cycle-end should drop dangling separator and keep plain heading text");
}

async function testStatusImportanceFullDoesNotDropAllTokens() {
  const editor = makeEditor("#/3 111 #/2", 8);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "full" },
      panel: { importance: "left" },
      freeRoamBehavior: { fullPlacement: "smart" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/#\/\d/.test(line), "full importance cycle should keep at least one priority token");
}

async function testStatusTagsImportanceOffHeadingNoMarkerLeak() {
  const editor = makeEditor("## heading", 3);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "off" },
      panel: { importance: "right" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s*##\s+/.test(line), "status_tags importance off heading right keeps heading prefix");
  assertTrue(/#\/1/.test(line), "status_tags importance off heading right keeps priority token present");
  assertTrue(!/^\s*[-*+]\s+/.test(line), "status_tags importance off heading right should not inject list prefix");
}

async function testStatusTagsImportanceOffHeadingLeftPanelAddsSeparator() {
  const editor = makeEditor("## heading", 3);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "off" },
      panel: { importance: "left" },
      left: ["importance", "priority", "type", "category", "project", "client", "client1"],
      right: ["date_due", "date_start", "time", "effort"],
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s*##\s+/.test(line), "status_tags importance off heading left keeps heading prefix");
  assertTrue(/#\/1/.test(line), "status_tags importance off heading left keeps priority token present");
  assertTrue(!/^\s*[-*+]\s+/.test(line), "status_tags importance off heading left should not inject list prefix");
}

async function testStatusTagsImportanceMinimalOffNoSeparatorInjection() {
  const editor = makeEditor("111", 1);
  const settings = {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "minimal" },
      panel: { importance: "right" },
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  };
  await runPkmCommandWithEditor("statusTags", editor, settings);
  const firstLine = editor.snapshot().line;
  assertEq(firstLine, "111 #/1", "status_tags importance minimal OFF should avoid separator on first press");
  await runPkmCommandWithEditor("statusTags", editor, settings);
  const secondLine = editor.snapshot().line;
  assertEq(secondLine, "111 #/2", "status_tags importance minimal OFF should rotate existing token on repeat");
  assertTrue(!/#\/\d\s+#\/\d/.test(secondLine), "status_tags importance minimal OFF should not duplicate priority tokens");
}

async function testStatusTagsContextMinimalOffNoSeparatorInjection() {
  const editor = makeEditor("111", 1);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "- [a] #area-alpha 111", "status_tags context minimal-off should not inject separators for plain source");
}

async function testStatusTagsContextMinimalOffNoSeparatorInjectionWithIndent() {
  const editor = makeEditor("    111", 6);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: false, minimalPrefix: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "    - [a] #area-alpha 111", "status_tags context minimal-off with indent should still apply resolver prefix and keep indent");
}

async function testStatusTagsContextMinimalOffNoSeparatorRewritesCustomCheckboxPrefix() {
  const editor = makeEditor("    - [x] 111", 9);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: false, minimalPrefix: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "    - [a] #area-alpha 111", "status_tags context minimal-off should replace custom checkbox prefix with resolver prefix and keep indent");
}

async function testStatusTagsContextMinimalOffUpdatesCheckboxPrefix() {
  const editor = makeEditor("- [a] #area-alpha 111", 8);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "- [b] #area-beta 111", "status_tags context minimal-off should update checkbox prefix with category token");
}

async function testStatusTagsContextMinimalOffCycleEndResetsToDefaultBullet() {
  const editor = makeEditor("- [c] #area-gamma 111", 8);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "- 111", "status_tags context minimal-off cycle end should reset checkbox prefix to default bullet");
}

async function testStatusTagsContextMinimalOffCycleEndResetsToDefaultBulletWithIndent() {
  const editor = makeEditor("\t- [c] #area-gamma 111", 9);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "\t- 111", "status_tags context minimal-off cycle end with indent should drop field-owned checkbox and keep indent");
}

async function testStatusTagsContextMinimalPrefixOffDoesNotCreatePrefix() {
  const editor = makeEditor("111", 1);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: true, minimalPrefix: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^#area-alpha\s+\S+\s+111$/.test(line), "status_tags context minimal prefix off should keep separator-form output for plain source");
  assertTrue(!/^\s*[-*+]\s+\[[^\]]\]/.test(line), "status_tags context minimal prefix off should not create checkbox prefix");
}

async function testStatusTagsContextMinimalPrefixOffPreservesExistingPrefix() {
  const editor = makeEditor("- [ ] 111", 4);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: true, minimalPrefix: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s*-\s+\[\s*\]\s+#area-alpha\s+\S+\s+111$/.test(line), "status_tags context minimal prefix off should preserve existing list checkbox prefix");
}

async function testTagWheelMinimalPrefixOffDoesNotCreatePrefix() {
  const editor = makeEditor("111", 1);
  await runTagWheelApply(editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: true, minimalPrefix: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/111/.test(line), "tagwheel minimal prefix off should preserve source text payload");
  assertTrue(!/^\s*[-*+]\s+\[[^\]]\]/.test(line), "tagwheel minimal prefix off should not create checkbox prefix");
}



async function testStatusTagsImportanceMinimalOffPreservesExistingSeparators() {
  const editor = makeEditor("- [ ] #todo || 111 || tail", 11);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "minimal" },
      panel: { importance: "left", type: "left" },
      left: ["type", "importance", "category", "project", "client", "client1"],
      right: ["date_due", "date_start", "time", "effort"],
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "- [ ] #todo #/1 || 111 || tail", "status_tags importance minimal-off should preserve existing separators");
}

async function testStatusTagsCycleMixedOffAndMinimalKeepsBulletNoCheckboxNoSeparator() {
  const editor = makeEditor("111", 1);
  const orderConfig = buildOrderConfig({
    active: { importance: "yes", type: "yes", category: "no", project: "no", client: "no", client1: "no" },
    panel: { importance: "left", type: "left" },
    left: ["type", "importance"],
    right: ["date_due", "date_start", "time", "effort"],
    freeRoam: { importance: "off", type: "minimal" },
    freeRoamBehavior: { minimalSeparator: false, minimalPrefix: false },
  });
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:type",
    "Direction": "increase",
    "Order config": orderConfig,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": orderConfig,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "- #todo #/1 111", "status_tags mixed off+minimal should keep resolver prefix and avoid separators when minimalSeparator is off");
}

async function testStatusTagsCycleMixedMinimalOrderParityTypeBeforeImportance() {
  const editor = makeEditor("111", 1);
  const orderConfig = buildOrderConfig({
    active: { importance: "yes", type: "yes", category: "no", project: "no", client: "no", client1: "no" },
    panel: { importance: "left", type: "left" },
    left: ["type", "importance"],
    right: ["date_due", "date_start", "time", "effort"],
    freeRoam: { importance: "minimal", type: "minimal" },
    freeRoamBehavior: { minimalSeparator: false, minimalPrefix: false },
  });
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:type",
    "Direction": "increase",
    "Order config": orderConfig,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": orderConfig,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "#todo #/1 111", "status_tags mixed minimal should follow left order type->importance for cycle parity with tagwheel");
}


async function testStatusImportanceMinimalOffRespectsLeftOrderPanel() {
  const editor = makeEditor("111", 1);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "minimal" },
      panel: { importance: "left" },
      left: ["importance", "priority", "type", "category", "project", "client", "client1"],
      right: ["date_due", "date_start", "time", "effort"],
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "#/1 111", "status_tags importance minimal-off should place token on left panel by Order");
}

async function testStatusTagsImportanceFullKeepsFocusedTokenSet() {
  const editor = makeEditor("#/3 111 #/2", 8);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "full" },
      panel: { importance: "left" },
      freeRoamBehavior: { fullPlacement: "smart" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "#/3 111 #/3", "status_tags importance full should replace focused token only");
}

async function testStatusTagsImportanceFullRepeatSingleKeepsExistingAndAddsNext() {
  const editor = makeEditor("#/3 111", 7);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "full" },
      panel: { importance: "right" },
      freeRoamBehavior: { fullPlacement: "smart" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "#/3 111 #/1", "status_tags importance full repeat should keep existing token and append next");
}

async function testStatusTagsImportanceFullSmartTextCursorInsertDoesNotReplaceExisting() {
  const src = "#/2 111 222";
  const editor = makeEditor(src, src.indexOf("222"));
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "full" },
      panel: { importance: "right" },
      freeRoamBehavior: { fullPlacement: "smart" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "#/2 111 #/1 222", "status_tags importance full smart text cursor should insert next token and keep existing");
}

async function testStatusTagsImportanceFullSmartCursorAtEndAppendsSeedToken() {
  const src = "#/2 111 #/1 222";
  const editor = makeEditor(src, src.length);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "full" },
      panel: { importance: "right" },
      freeRoamBehavior: { fullPlacement: "smart" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "#/2 111 #/1 222 #/1", "status_tags importance full smart line-end cursor should append seed token without replacing existing");
}

async function testStatusTagsImportanceFullSmartCursorLeftPrefersLeftInsert() {
  const editor = makeEditor("111 #/2", 0);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "full" },
      panel: { importance: "right" },
      freeRoamBehavior: { fullPlacement: "smart" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "#/1 111 #/2", "status_tags importance full smart should insert left token when cursor on left text side");
}

async function testStatusTagsImportanceFullSmartNoTokenInsertLeft() {
  const editor = makeEditor("111 222", 0);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "full" },
      panel: { importance: "right" },
      freeRoamBehavior: { fullPlacement: "smart" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "#/1 111 222", "status_tags importance full smart without tokens should insert left of active word");
}

async function testStatusImportanceFullSmartNoTokenInsertLeftEvenWhenMinimalSeparatorOff() {
  const editor = makeEditor("111 222", 0);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "full" },
      panel: { importance: "right" },
      freeRoamBehavior: { fullPlacement: "smart", minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "#/1 111 222", "status_tags importance full smart should ignore minimalSeparator and insert left by smart");
}

async function testStatusImportanceFullSmartTextCursorWithTwoTokensRepositionsDeterministically() {
  const src = "#/2 #/1 111 222";
  const editor = makeEditor(src, src.indexOf("222"));
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "full" },
      panel: { importance: "right" },
      freeRoamBehavior: { fullPlacement: "smart", minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "#/3 111 #/1 222", "status_tags importance full smart text cursor should cycle primary token and place secondary before active word");
}

async function testStatusTagsCycleFieldClientOffRespectsRightPanelSeparator() {
  const editor = makeEditor("111", 1);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:client",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { client: "off" },
      panel: { client: "right" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^111\s+\S+\s+#/.test(line), "cycle_field client off should preserve separator contract");
  assertTrue(/^111\s+\S+\s+#\S+/.test(line), "cycle_field client off should place token in right panel");
}

async function testStatusTagsCycleFieldClientMinimalOffRespectsLeftPanel() {
  const editor = makeEditor("111", 1);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:client",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { client: "minimal" },
      panel: { client: "left" },
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^#\S+\s+111$/.test(line), "cycle_field client minimal-off should respect left panel placement");
}

async function testStatusTagsCycleFieldClientOffRightReapplyDoesNotDuplicate() {
  const editor = makeEditor("111", 1);
  const settings = {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:client",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { client: "off" },
      panel: { client: "right" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  };
  await runPkmCommandWithEditor("statusTags", editor, settings);
  await runPkmCommandWithEditor("statusTags", editor, settings);
  const line = editor.snapshot().line;
  const separatorParts = line.split(/::|\|\|/);
  assertTrue(separatorParts.length >= 2, "cycle_field client off reapply should keep right-panel separator topology");
  const rightSegment = String(separatorParts[separatorParts.length - 1] || "").trim();
  const rightTags = rightSegment.match(/#\S+/g) || [];
  assertEq(rightTags.length, 1, "cycle_field client off reapply should keep single managed client token in right segment");
}

async function testTagWheelMinimalOffNoDuplicatePriorityOnReapply() {
  const editor = makeEditor("#tenant-alpha plain #/1", 6);
  await runTagWheelApply(editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "minimal", client: "off" },
      panel: { importance: "right", client: "left" },
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(!/#\/1\s+#\/1/.test(line), "tagwheel reapply should not duplicate same priority token");
  assertTrue(!/\|\|\s+#\/1/.test(line), "minimalSeparator off should not force right separator slot for priority");
}

/*
 * A18. Токен, стоящий в строке **после** прозы, не должен уносить прозу с
 * собой: разбор исходного текста снимает объявленные токены по всему телу, а не
 * только с начала (`line_pipeline.extractOriginalTextFromRawLine`). До правки
 * вход ниже давал `- [a] #/2 #area-alpha 111 111 || :: 111 111 || #/2` — проза
 * в строке дважды.
 */
async function testStatusTagsManagedTokenAfterTextDoesNotDuplicateText() {
  const editor = makeEditor("- 111 111 || #/2", 2);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq((line.match(/111 111/g) || []).length, 1, "managed token after text must not duplicate source text");
  assertEq((line.match(/#\/2/g) || []).length, 1, "managed token after text must not duplicate the token itself");
  assertTrue(/#area-alpha/.test(line), "managed token after text must not block the cycled token");
}

async function testStatusTagsManagedTokenInsideTextKeepsTail() {
  const editor = makeEditor("- 111 #/2 tail", 2);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq((line.match(/\btail\b/g) || []).length, 1, "text after a managed token must stay once");
  assertEq((line.match(/\b111\b/g) || []).length, 1, "text before a managed token must stay once");
  assertTrue(/#area-alpha\s+\S+\s+111 tail\s*$/.test(line), "text around a managed token must land in the text slot in source order");
}

/*
 * У-51. Тег человека — часть его текста, и правка A18 не имеет права его
 * снимать: снимается только то, что объявлено в документе правил. Наивная
 * версия правки стирала `#myownhashtag` и `[[Проект]]`, и ни одна из
 * тогдашних 45 проверок этого не показывала.
 */
async function testStatusTagsForeignTagInTextIsPreserved() {
  const editor = makeEditor("- text #myownhashtag [[SomeNote]] more", 2);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq((line.match(/#myownhashtag/g) || []).length, 1, "an undeclared tag must survive exactly once");
  assertEq((line.match(/\[\[SomeNote\]\]/g) || []).length, 1, "an undeclared wikilink must survive exactly once");
  /*
   * Наивная версия правки A18 роняла не тег, а прозу: чужой токен уходил из
   * «исходного текста», и текстовый слот получал урезанную копию, тогда как
   * левый сегмент нёс полную. Поэтому проза считается пословно.
   */
  assertEq((line.match(/\btext\b/g) || []).length, 1, "text before an undeclared tag must stay exactly once");
  assertEq((line.match(/\bmore\b/g) || []).length, 1, "text after an undeclared tag must stay exactly once");
}

/*
 * Чужой тег принадлежит тексту человека, а не панели: он остаётся **за**
 * разделителем, вместе с прозой, и в левый сегмент не переезжает. Наивная
 * версия правки A18 давала `- [a] #area-alpha #myownhashtag :: 111` — тег
 * человека в панели поля.
 */
async function testStatusTagsForeignTagStaysInTextSlot() {
  const editor = makeEditor("- 111 #myownhashtag", 2);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal" },
      panel: { category: "left" },
      freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  const textAt = line.indexOf("111");
  const foreignAt = line.indexOf("#myownhashtag");
  assertTrue(textAt !== -1 && foreignAt !== -1, "both the text and the undeclared tag must stay on the line");
  assertTrue(textAt < foreignAt, "an undeclared tag must stay with the text, not move into the field panel");
  assertTrue(/#area-alpha\s+\S+\s+111 #myownhashtag\s*$/.test(line), "the text slot must hold the prose and the undeclared tag in source order");
}

/*
 * A16. Разобрана и включена 2026-09-04. Пока она лежала невключённой, за её
 * падением стояли два дефекта движка и ошибка в её собственном ожидании.
 *
 * Ожидание требовало разделитель `||`, которого фикстура не объявляет: у неё
 * `separator1 = separator2 = "::"`, то есть `||` в ней обычный текст. Поэтому
 * разделитель здесь больше не пишется буквой — проверяется **порядок**: токен
 * поля слева, исходный текст после разделителя и ровно один раз, токен правой
 * панели за ним (У-48).
 *
 * Дефекты: A17 — ключ Order сопоставлялся с Field по номеру в списке, и при
 * `panel: {importance: right}` команда категории уходила в чужое поле `modal`
 * с пустым циклом, отчего строка не менялась вовсе; A18 — проза попадала в
 * строку дважды, когда управляемый токен стоял после неё.
 */
async function testStatusTagsMinimalContextKeepsTextAfterSeparator() {
  const editor = makeEditor("- 111 111 || #/2", 2);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal", importance: "minimal" },
      panel: { category: "left", importance: "right" },
      freeRoamBehavior: { minimalSeparator: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq((line.match(/111 111/g) || []).length, 1, "status_tags minimal context must keep the source text exactly once");
  const tokenAt = line.indexOf("#area-alpha");
  const textAt = line.indexOf("111 111");
  const rightAt = line.lastIndexOf("#/2");
  assertTrue(tokenAt !== -1, "status_tags minimal context must place the cycled token on the line");
  assertTrue(rightAt !== -1, "status_tags minimal context must keep the right-panel token on the line");
  assertTrue(tokenAt < textAt, "status_tags minimal context must keep the cycled token left of the text slot");
  assertTrue(textAt < rightAt, "status_tags minimal context must keep the text slot left of the right-panel token");
  assertTrue(/^-\s+\[[^\]]\]\s+#area-alpha\s+\S+\s+111 111/.test(line), "status_tags minimal context must keep a separator between the token and the text slot");
}

/*
 * A17. Ключ Order и имя Field — разные имена, и после переименования Field
 * связь между ними несёт только `strictNames`. Проверка стоит ровно на том
 * конфиге, на котором ломалась позиционная догадка: `importance` уходит в
 * правую панель, из левого списка порядка исчезают два имени, и номер ключа
 * `category` начинает указывать на чужое поле.
 *
 * Сама фикстура эту связь объявляет — ключ `category` при поле `context`
 * (`buildOrderConfig`, `STRICT_NAMES_BY_KEY`). Совпади они, проверка была бы
 * слепа к их расхождению (У-47).
 */
async function testStatusTagsOrderKeyResolvesRenamedFieldNotNeighbour() {
  const settings = (panelOverride) => ({
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    /*
     * Списки порядка задаются **явно и без синонимов**: у ключа `category`
     * нет в них соседа `context`, который мог бы его выручить. Значит
     * разрешение может пройти только через `strictNames`, и пин держит именно
     * его, а не удачное соседство. Без него последняя ветка отдаёт
     * единственное поле, похожее на важность, — это и проверяется ниже.
     */
    "Order config": buildOrderConfig({
      freeRoam: { category: "minimal", importance: "minimal" },
      panel: panelOverride,
      left: ["category"],
      right: ["importance"],
      freeRoamBehavior: { minimalSeparator: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const importanceLeft = makeEditor("111", 1);
  await runPkmCommandWithEditor("statusTags", importanceLeft, settings({ category: "left" }));
  const importanceRight = makeEditor("111", 1);
  await runPkmCommandWithEditor("statusTags", importanceRight, settings({ category: "left", importance: "right" }));
  const lineLeft = importanceLeft.snapshot().line;
  const lineRight = importanceRight.snapshot().line;
  assertTrue(/#area-alpha/.test(lineLeft), "cycle_field:category must reach its own field when importance sits left");
  assertTrue(/#area-alpha/.test(lineRight), "cycle_field:category must reach its own field when importance sits right");
  assertTrue(lineRight !== "111", "moving another field to the right panel must not silence cycle_field:category");
  assertTrue(!/#todo|#idea|#note|#\/\d/.test(lineRight), "cycle_field:category must not cycle a neighbouring field's values");
}


async function testTagWheelPreservesCheckboxPrefix() {
  const editor = makeEditor("- [ ] checkbox", 6);
  await runTagWheelApply(editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Order config": buildOrderConfig({
      freeRoam: { client: "minimal" },
      panel: { client: "left" },
      freeRoamBehavior: { minimalSeparator: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s*-\s+\[[^\]]\]\s+/.test(line), "tagwheel apply should preserve checkbox prefix on list source");
}

async function testTagWheelKeepsTagTokensAsTagsOnApply() {
  const editor = makeEditor("- [ ] #todo #area-alpha :: 111", 8);
  await runTagWheelApply(editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Order config": buildOrderConfig({
      freeRoam: { type: "off", category: "off", project: "off" },
      panel: { type: "left", category: "left", project: "left" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/#todo/.test(line) && /#area-alpha/.test(line), "tagwheel apply keeps tag tokens in tag format");
  assertTrue(line.indexOf("[[todo]]") === -1 && line.indexOf("[[area-alpha]]") === -1, "tagwheel apply must not convert tag tokens to wikilink format");
}

async function testStatusTagsRightOrderUsesRuntimeDateMarkerConfig() {
  const editor = makeEditor("- [ ] #/1 #todo #area-beta [[EntityThree]] #topic-alpha #topic-alpha-child :: 1 :: [[EntityAlpha]] ⛏️001 📅2026-04-27", 8);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:clients",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      active: {
        importance: "yes",
        type: "yes",
        category: "yes",
        project: "yes",
        topic: "yes",
        due: "yes",
        clients: "yes",
        effort1: "yes",
      },
      panel: {
        importance: "left",
        type: "left",
        category: "left",
        project: "left",
        topic: "left",
        due: "right",
        clients: "right",
        effort1: "right",
      },
      left: ["importance", "type", "category", "project", "topic"],
      right: ["due", "clients", "effort1"],
      enabled: {
        importance: true,
        type: true,
        category: true,
        project: true,
        topic: true,
        due: true,
        clients: true,
        effort1: true,
      },
      freeRoam: {
        importance: "off",
        type: "off",
        category: "off",
        project: "off",
        topic: "off",
        due: "off",
        clients: "off",
        effort1: "off",
      },
    }),
    "Date runtime config": JSON.stringify({
      byField: {
        due: { emoji: "📅", format: "YYYY-MM-DD" },
        effort1: { emoji: "⛏️", format: "000" },
      },
      canonical: {},
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/::\s+1\s+::\s+📅2026-04-27(?:\s+\[\[[^\]]+\]\])+\s+⛏️001/.test(line), "status_tags right segment follows configured right order due -> clients -> effort1; line=" + line);
}

async function testStatusTagsImportanceMinimalOffNoTrailingSeparator() {
  const editor = makeEditor("- [ ] #/2 Synthetic text", 8);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "minimal" },
      panel: { importance: "left" },
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/#\/3/.test(line), "importance minimal-off should cycle priority token");
  assertTrue(!/\|\|\s*$/.test(line), "importance minimal-off should not leave trailing separator");
}

async function testStatusTagsImportanceMinimalOffPreservesListPrefixAndIndent() {
  const editor = makeEditor("    - [ ] Synthetic line", 8);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "minimal" },
      panel: { importance: "left" },
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s{4}-\s+\[[^\]]\]\s+/.test(line), "importance minimal should preserve original list+checkbox prefix with indent");
  assertTrue(/#\/1|#\/2|#\/3/.test(line), "importance minimal should inject priority token into prefixed line");
}

async function testStatusTagsImportanceMinimalSeparatorOnPreservesCheckboxPrefix() {
  const editor = makeEditor("    - [ ] Synthetic line", 8);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "minimal" },
      panel: { importance: "left" },
      freeRoamBehavior: { minimalSeparator: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s{4}-\s+\[[^\]]\]\s+#\/\d\s+\S+\s+/.test(line), "importance minimal separator-on should preserve checkbox prefix and separator slot");
}

async function testStatusTagsMinimalOffRemovesSeparatorsForPrefixedSource() {
  const editor = makeEditor("#/1 Synthetic line", 4);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:client1",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { client1: "minimal" },
      panel: { client1: "left", importance: "left" },
      freeRoamBehavior: { minimalSeparator: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(!/\|\|/.test(line), "minimal-off should remove separators for prefixed source lines");
  assertTrue(/#\/\d+/.test(line) && /#account-alpha/.test(line) && /Synthetic line/.test(line), "minimal-off should keep both tokens and text for non-list source without separator drift");
}

async function testStatusTagsImportanceKeepsDependentAdjacencyAfterTagWheelApply() {
  const editor = makeEditor("- [ ] #todo #/1 #account-alpha #tenant-alpha #tenant-alpha-child 11", 20);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "off", client: "off", client1: "off" },
      panel: { importance: "left", client: "left", client1: "left" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/#\/2/.test(line), "importance cycle should still update target token");
  assertTrue(/#tenant-alpha\s+#tenant-alpha-child/.test(line), "dependent child token should stay adjacent to parent after cycle_field mutation");
}

async function testStatusTagsParentCycleClearsDependentSubtagSelection() {
  const editor = makeEditor("- [ ] #topic-alpha #topic-alpha-child :: Task A", 8);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:topic",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      active: { topic: "yes", topic_sub: "yes" },
      panel: { topic: "left", topic_sub: "left" },
      left: ["topic", "topic_sub"],
      enabled: { topic: true, topic_sub: true },
      freeRoam: { topic: "off", topic_sub: "off" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/#topic-beta/.test(line), "parent topic cycles to next token");
  assertTrue(!/#topic-alpha-child/.test(line), "old dependent subtag is cleared when parent changes");
}

async function testStatusTagsOffPrefixTogglePreservesCheckboxWhenDisabled() {
  const editor = makeEditor("- [ ] Task A", 6);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:topic",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      active: { topic: "yes" },
      panel: { topic: "left" },
      left: ["topic"],
      enabled: { topic: true },
      freeRoam: { topic: "off" },
      freeRoamBehavior: { offPrefix: false },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s*-\s+\[[^\]]\]\s+#topic-alpha\s+::\s+Task A\s*$/.test(line), "offPrefix=OFF preserves original checkbox prefix for off-mode tag without own checkbox");
}

async function testStatusTagsOffPrefixToggleForcesBulletWhenEnabled() {
  const editor = makeEditor("- [ ] Task A", 6);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:topic",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      active: { topic: "yes" },
      panel: { topic: "left" },
      left: ["topic"],
      enabled: { topic: true },
      freeRoam: { topic: "off" },
      freeRoamBehavior: { offPrefix: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/^\s*-\s+#topic-alpha\s+::\s+Task A\s*$/.test(line), "offPrefix=ON rewrites prefix to bullet for off-mode tag without own checkbox");
  assertTrue(!/^\s*-\s+\[[^\]]\]/.test(line), "offPrefix=ON removes preserved checkbox prefix for tag without own checkbox");
}

async function testStatusTagsCycleFieldClientsRendersWikilinkToken() {
  const editor = makeEditor("- [ ] Task B", 6);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:clients",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      active: { clients: "yes" },
      panel: { clients: "right" },
      right: ["clients"],
      left: [],
      enabled: { clients: true },
      freeRoam: { clients: "off" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/\[\[[^\]]+\]\]/.test(line), "cycle_field:clients should output wikilink token for wikilink field");
  assertTrue(!/\s#[^\s]+/.test(line), "cycle_field:clients should not fallback to tag token output");
}

async function testStatusTagsOffCycleEndClearsOwnCheckboxPrefix() {
  const editor = makeEditor("- [c] #area-gamma :: 111", 8);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:category",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { category: "off" },
      panel: { category: "left" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertEq(line, "- 111", "off-mode cycle end should drop field-owned checkbox prefix when target token is cleared");
}

async function testStatusTagsImportanceHydrationUsesLastTokenOccurrence() {
  const editor = makeEditor("- [ ] #/3 #todo #/1 :: 111", 20);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:importance",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { importance: "off" },
      panel: { importance: "left" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  const priorities = line.match(/#\/\d/g) || [];
  assertEq(priorities.length, 1, "importance cycle should keep single managed priority token when duplicates exist in source");
  assertEq(priorities[0], "#/2", "importance cycle should continue from last source occurrence token (#/1 -> #/2)");
}

async function testStatusTagsClientsHydrationUsesLastTokenOccurrence() {
  const editor = makeEditor("- [ ] #todo :: [[EntityAlpha]] [[EntityBeta]]", 18);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:clients",
    "Direction": "decrease",
    "Order config": buildOrderConfig({
      panel: { clients: "right" },
      active: { clients: "yes" },
      freeRoam: { clients: "off" },
      enabled: { clients: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  const clients = line.match(/\[\[(EntityAlpha|EntityBeta)\]\]/g) || [];
  assertEq(clients.length, 1, "clients cycle should keep single managed token when source has duplicates");
  assertEq(clients[0], "[[EntityAlpha]]", "clients cycle should continue from last source occurrence token on decrease ([[EntityBeta]] -> [[EntityAlpha]])");
}

async function testStatusTagsClientsRepeatedCycleDoesNotAccumulateDuplicates() {
  const editor = makeEditor("- [ ] #todo :: [[EntityAlpha]]", 14);
  const settingsInc = {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:clients",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      panel: { clients: "right" },
      active: { clients: "yes" },
      freeRoam: { clients: "off" },
      enabled: { clients: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  };
  const settingsDec = { ...settingsInc, "Direction": "decrease" };
  await runPkmCommandWithEditor("statusTags", editor, settingsInc);
  await runPkmCommandWithEditor("statusTags", editor, settingsDec);
  const line = editor.snapshot().line;
  const clients = line.match(/\[\[(EntityAlpha|EntityBeta)\]\]/g) || [];
  assertEq(clients.length, 1, "repeated clients cycle should keep one managed source token in output");
}




/*
 * Знак чекбокса — ровно один, и это правило платформы, а не наше
 * (У-91). `- [test-transform] test1 test2` — законная строка человека:
 * Obsidian задачей её не считает, значит `[test-transform]` это его
 * текст. Правило было объявлено 72 раза в трёх расходящихся написаниях,
 * и то из них, что стояло в разборе строки, съедало первую пару скобок
 * целиком: заказчик получил `- [ ] #todo :: test1 test2` и потерял свой
 * текст. Набор при этом был зелёный весь, 53 из 53.
 *
 * Положительный контроль здесь обязателен (У-88): настоящий чекбокс из
 * ОДНОГО знака по-прежнему заменяется тем, что задан у Value, — иначе
 * проверка была бы зелёной и у движка, который префикс не трогает вовсе.
 */
async function testStatusTagsKeepsBracketedTextThatIsNotCheckbox() {
  const settings = {
    "Rules path": "InlineOverhaul_Generated_RULES_TagWheel.md",
    "Action type": "cycle_field:type",
    "Direction": "increase",
    "Order config": buildOrderConfig({
      freeRoam: { type: "off" },
      panel: { type: "left" },
      freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  };

  /* Замечание заказчика 2026-09-07, слово в слово по его строке. */
  const owner = makeEditor("- [test-transform] test1 test2", 20);
  await runPkmCommandWithEditor("statusTags", owner, settings);
  const ownerLine = owner.snapshot().line;
  assertTrue(ownerLine.indexOf("[test-transform]") !== -1,
    "bracketed text that is not a one-character checkbox belongs to the human and must survive");
  assertTrue(/\btest1\b/.test(ownerLine) && /\btest2\b/.test(ownerLine),
    "and the prose after it survives too");

  /* Два знака — уже не чекбокс, и это та же строка человека. */
  const twoChars = makeEditor("- [aa] test1", 8);
  await runPkmCommandWithEditor("statusTags", twoChars, settings);
  assertTrue(twoChars.snapshot().line.indexOf("[aa]") !== -1,
    "two characters in brackets are not a checkbox either");

  /*
   * Положительный контроль: чекбокс из одного знака — наш, и Value
   * `todo` меняет его на свой `[ ]`. Обязано быть больше нуля работы.
   */
  const realCheckbox = makeEditor("- [n] test1 test2", 6);
  await runPkmCommandWithEditor("statusTags", realCheckbox, settings);
  const realLine = realCheckbox.snapshot().line;
  assertTrue(/^-\s+\[ \]\s/.test(realLine),
    "a real one-character checkbox is still replaced by the one configured for the Value");
  assertTrue(realLine.indexOf("[n]") === -1,
    "and the old one is gone, not kept as text");
}


async function run() {
  await testImportanceRespectsCustomSeparatorsAndCursorClamp();
  await testStatusTagsRunCommandPathCyclesType();
  await testStatusTagsRunCommandPathCyclesTypeGenericAction();
  await testStatusTagsTypeHydrationUsesLastTokenOccurrence();
  await testStatusDateRunCommandPathIncrementsDue();
  await testStatusDateHydrationUsesLastDueOccurrence();
  await testStatusDateRunCommandPathIncrementsDueGenericAction();
  await testStatusDateConfiguredSeparatorTreatsDoublePipeAsPlainText();
  await testStatusTagsOffHeadingDoesNotInjectBullet();
  await testStatusImportanceOffHeadingRewritesWithoutHeadingLeak();
  await testStatusImportanceOffHeadingRightPanelKeepsSeparator();
  await testStatusImportanceFullDoesNotDropAllTokens();
  await testStatusTagsImportanceOffHeadingNoMarkerLeak();
  await testStatusTagsImportanceOffHeadingLeftPanelAddsSeparator();
  await testStatusContextMinimalHeadingKeepsTextSlotAfterSeparator();
  await testStatusImportanceOffHeadingCycleEndRemovesDanglingSeparator();
  await testStatusTagsImportanceMinimalOffNoSeparatorInjection();
  await testStatusTagsContextMinimalOffNoSeparatorInjection();
  await testStatusTagsContextMinimalOffNoSeparatorInjectionWithIndent();
  await testStatusTagsContextMinimalOffNoSeparatorRewritesCustomCheckboxPrefix();
  await testStatusTagsContextMinimalOffUpdatesCheckboxPrefix();
  await testStatusTagsContextMinimalOffCycleEndResetsToDefaultBullet();
  await testStatusTagsContextMinimalOffCycleEndResetsToDefaultBulletWithIndent();
  await testStatusTagsContextMinimalPrefixOffDoesNotCreatePrefix();
  await testStatusTagsContextMinimalPrefixOffPreservesExistingPrefix();
  await testTagWheelMinimalPrefixOffDoesNotCreatePrefix();
  await testStatusTagsImportanceMinimalOffPreservesExistingSeparators();
  await testStatusTagsCycleMixedOffAndMinimalKeepsBulletNoCheckboxNoSeparator();
  await testStatusTagsCycleMixedMinimalOrderParityTypeBeforeImportance();
  await testStatusImportanceMinimalOffRespectsLeftOrderPanel();
  await testStatusTagsImportanceFullKeepsFocusedTokenSet();
  await testStatusTagsImportanceFullRepeatSingleKeepsExistingAndAddsNext();
  await testStatusTagsImportanceFullSmartTextCursorInsertDoesNotReplaceExisting();
  await testStatusTagsImportanceFullSmartCursorAtEndAppendsSeedToken();
  await testStatusTagsImportanceFullSmartCursorLeftPrefersLeftInsert();
  await testStatusTagsImportanceFullSmartNoTokenInsertLeft();
  await testStatusImportanceFullSmartNoTokenInsertLeftEvenWhenMinimalSeparatorOff();
  await testStatusImportanceFullSmartTextCursorWithTwoTokensRepositionsDeterministically();
  await testStatusTagsCycleFieldClientOffRespectsRightPanelSeparator();
  await testStatusTagsCycleFieldClientMinimalOffRespectsLeftPanel();
  await testStatusTagsCycleFieldClientOffRightReapplyDoesNotDuplicate();
  await testTagWheelMinimalOffNoDuplicatePriorityOnReapply();
  await testStatusTagsMinimalContextKeepsTextAfterSeparator();
  await testStatusTagsOrderKeyResolvesRenamedFieldNotNeighbour();
  await testStatusTagsManagedTokenAfterTextDoesNotDuplicateText();
  await testStatusTagsManagedTokenInsideTextKeepsTail();
  await testStatusTagsForeignTagInTextIsPreserved();
  await testStatusTagsForeignTagStaysInTextSlot();
  await testTagWheelPreservesCheckboxPrefix();
  await testTagWheelKeepsTagTokensAsTagsOnApply();
  await testStatusTagsRightOrderUsesRuntimeDateMarkerConfig();
  await testStatusTagsImportanceMinimalOffNoTrailingSeparator();
  await testStatusTagsImportanceMinimalOffPreservesListPrefixAndIndent();
  await testStatusTagsImportanceMinimalSeparatorOnPreservesCheckboxPrefix();
  await testStatusTagsMinimalOffRemovesSeparatorsForPrefixedSource();
  await testStatusTagsImportanceKeepsDependentAdjacencyAfterTagWheelApply();
  await testStatusTagsParentCycleClearsDependentSubtagSelection();
  await testStatusTagsOffPrefixTogglePreservesCheckboxWhenDisabled();
  await testStatusTagsOffPrefixToggleForcesBulletWhenEnabled();
  await testStatusTagsCycleFieldClientsRendersWikilinkToken();
  await testStatusTagsOffCycleEndClearsOwnCheckboxPrefix();
  await testStatusTagsImportanceHydrationUsesLastTokenOccurrence();
  await testStatusTagsClientsHydrationUsesLastTokenOccurrence();
  await testStatusTagsClientsRepeatedCycleDoesNotAccumulateDuplicates();
  await testStatusTagsKeepsBracketedTextThatIsNotCheckbox();
  await testFailedNoticeReachesTheConsole();
  assertTrue(typeof runtime.runCommand === "function", "runtime exports runCommand");
  console.log("Status runtime behavior tests: OK");
}

/*
 * Отчёт о сбое, который не удалось показать, обязан уехать в консоль
 * (третий кусок В-97, 2026-09-10).
 *
 * **Что здесь проверяется поведением, а не текстом.** Файла правил нет, и
 * движок обязан сказать об этом человеку. Показ сообщения при этом отказывает:
 * `Notice` платформы бросает. Прежде тут стоял пустой `catch`, и человек
 * оставался без результата **и** без причины — команда молча не делала
 * ничего. Теперь причина уезжает в журнал разработчика.
 *
 * Мутация: вернуть `catch (_) {}` вокруг показа — и эта проверка краснеет,
 * потому что в консоли не окажется ни строки.
 */
async function testFailedNoticeReachesTheConsole() {
  const editor = makeEditor("- [ ] #todo || text", 5);
  const app = makeAppForRuntime(editor);
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  const prevError = console.error;
  const reported = [];
  if (!global.window) global.window = makeWindowMock();
  global.Notice = function Notice() { throw new Error("Notice is not available"); };
  console.error = function () {
    reported.push(Array.prototype.slice.call(arguments).map(String).join(" "));
  };
  try {
    await runtime.runCommand({
      app,
      command: "statusTags",
      settings: {
        "Rules path": "no-such-rules-file.md",
        "Action type": "cycle_field:importance",
        "Direction": "increase",
      },
    });
  } catch (_) {
    /*
     * Проба: до правки эта ветка кончалась `return`, и бросить было нечему.
     * Если движок однажды начнёт бросать наружу — это тоже громкий отказ, а
     * не тихий, и утверждения ниже всё равно спросят про консоль.
     */
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
    console.error = prevError;
  }
  const said = reported.join("\n");
  assertTrue(/\[inline-overhaul\]/.test(said),
    "отказ показа сообщения не попал в консоль: человек остался без причины,\n"
    + "  а в журнале нет ни строки. Что записано: " + JSON.stringify(said.slice(0, 200)));
  assertTrue(/no-such-rules-file|Rules file not found/.test(said),
    "в консоль уехало что-то другое, а не само сообщение о ненайденном файле правил:\n"
    + "  " + JSON.stringify(said.slice(0, 200)));
}

if (require.main === module) {
  run().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
