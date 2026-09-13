"use strict";

const fs = require("fs");
const path = require("path");
const runtime = require(path.join(__dirname, "..", "..", "pkm_runtime_v2.js"));

/*
 * **Правила приезжают движку ключом `Rules data`** — тем же, каким их кладёт
 * слой команд (PRD 10.13.52, П-8, шаг третий). Прежде здесь стоял путь к
 * заметке правил, и движок читал её с диска; служебного файла не читает больше
 * никто, и фикстуры переехали в ту форму, в какой правила приезжают теперь.
 * Значения не менялись ни одного: файлы фикстур сняты разбором тех же заметок
 * в день переезда.
 *
 * **Печатаются в строку нарочно.** Движок дорабатывает правила на ходу
 * (`applyOrderToRules`, `subtagFormat`), и один объект на весь прогон приехал
 * бы во вторую проверку уже доработанным первой. Строка даёт каждому вызову
 * свой разбор — ровно как `buildRulesForEngines(cfg)` даёт свою форму каждой
 * команде.
 */
const SYNTHETIC_RULES = JSON.stringify(require(path.join(__dirname, "..", "fixtures", "rules_synthetic.js")));
const OWNER_SHAPE_RULES = JSON.stringify(require(path.join(__dirname, "..", "fixtures", "rules_owner_shape.js")));

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

/*
 * `app` Obsidian, и в нём **ловушка вместо чтения vault**.
 *
 * Движки перестали читать служебный файл правил (PRD 10.13.52, П-8, шаг
 * третий), и это утверждение проверяется не чтением кода, а тем, что читать
 * стало нечем: любое обращение к vault здесь роняет прогон с именем пути.
 * Прежде тут лежала подделка, отдававшая заметку правил с диска, и она же
 * была единственным, что отличало «правила приехали ключом» от «правила
 * дочитались с диска» (У-56).
 */
function makeAppForRuntime(editor) {
  const trap = (vaultPath) => {
    const shown = vaultPath && typeof vaultPath === "object" ? vaultPath.path : vaultPath;
    throw new Error(
      "движок полез в vault за '" + String(shown) + "', а правила приезжают ключом `Rules data`"
    );
  };
  return {
    workspace: {
      activeLeaf: { view: { editor } },
      activeEditor: { editor },
    },
    vault: {
      getAbstractFileByPath: trap,
      read: trap,
      adapter: { read: trap },
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
  /* Имя поля под ключом Order называет сам вызывающий, если оно не совпадает
     с ключом: у элементов первой фикстуры ключ `date_due`, а поле зовут `due`. */
  if (src.strictNames && typeof src.strictNames === "object") Object.assign(out.strictNames, src.strictNames);
  /* Тип поля под ключом: у элемента он «element», и без него порядок считает
     его тегом. */
  if (src.types && typeof src.types === "object") out.types = { ...(out.types || {}), ...src.types };
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

/*
 * Элементам фикстуры нужен значок, иначе панель **не открывается вовсе**.
 *
 * Это стоило целой семьи проверок: двенадцать утверждений о применении
 * TagWheel были зелёными, потому что панель отказывалась открыться со
 * словами «these Fields need an emoji», строка оставалась прежней — а
 * утверждения спрашивали ровно её (У-146). Дефект, который заказчик принёс
 * 2026-09-12 («через tagwheel изменил Imp, получил другое значение»), прошёл
 * мимо всех.
 *
 * Значки здесь — данные фикстуры, а не подделка поведения: у заказчика они
 * приезжают тем же ключом из настроек.
 */
const TAGWHEEL_FIXTURE_DATE_RUNTIME = JSON.stringify({
  byField: {
    due: { emoji: "\uD83D\uDCC5", format: "YYYY-MM-DD" },
    start: { emoji: "\uD83D\uDEEB", format: "YYYY-MM-DD" },
    timeNow: { emoji: "\u23F0", format: "HH:mm" },
    estimated: { emoji: "\u26CF\uFE0F", format: "000" },
  },
  canonical: {},
});

async function runTagWheelApply(editor, settings) {
  const app = makeAppForRuntime(editor);
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  const said = [];
  if (!global.window) global.window = makeWindowMock();
  global.Notice = function Notice(m) { said.push(String(m)); };
  const withDates = Object.assign(
    { "Date runtime config": TAGWHEEL_FIXTURE_DATE_RUNTIME },
    settings || {}
  );
  let opened = false;
  try {
    await runtime.runCommand({ app, command: "tagWheel", settings: withDates });
    opened = !!(global.window && global.window.__tagWheelState && global.window.__tagWheelState.active === true);
    await runtime.runCommand({ app, command: "tagWheel", settings: withDates });
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
  /*
   * Положительный контроль: пока панель не открылась, любое утверждение ниже
   * проверяет неизменённую строку и зелено само по себе.
   */
  if (!opened) {
    throw new Error(
      "TagWheel не открылся, и проверка ниже спрашивала бы неизменённую строку.\n"
      + "  Что сказал движок: " + JSON.stringify(said)
    );
  }
}

/*
 * То же, что `runTagWheelApply`, но с нажатиями между открытием и применением:
 * стрелка вправо ведёт по полям, стрелка вверх крутит значение. Нужна там, где
 * спрашивают **значение**, которое панель ставит, а не только префикс строки.
 *
 * Своё окно здесь заводится всегда: обработчик клавиш панель вешает на него, и
 * чужое окно из прошлой проверки нажатий не услышит. Контроль «панель
 * открылась» тот же (У-152).
 */
async function runTagWheelKeys(editor, settings, keys) {
  const app = makeAppForRuntime(editor);
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  const said = [];
  global.window = makeWindowMock();
  global.Notice = function Notice(m) { said.push(String(m)); };
  const withDates = Object.assign(
    { "Date runtime config": TAGWHEEL_FIXTURE_DATE_RUNTIME },
    settings || {}
  );
  let opened = false;
  try {
    await runtime.runCommand({ app, command: "tagWheel", settings: withDates });
    opened = !!(global.window.__tagWheelState && global.window.__tagWheelState.active === true);
    for (const key of (keys || [])) {
      global.window.fire("keydown", {
        key,
        code: key,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
      });
    }
    await runtime.runCommand({ app, command: "tagWheel", settings: withDates });
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
  if (!opened) {
    throw new Error(
      "TagWheel не открылся, и проверка ниже спрашивала бы неизменённую строку.\n"
      + "  Что сказал движок: " + JSON.stringify(said)
    );
  }
}

async function testImportanceRespectsCustomSeparatorsAndCursorClamp() {
  const editor = makeEditor("- [ ] #/1 #todo :: text ~~ 📅2026-04-08", 9);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
  /* Положительный контроль на саму фикстуру: без Field `due` этой проверке
     нечего мерить, и она зеленела бы от пустоты (У-88). */
  const hasDueField = /"id"\s*:\s*"due"/.test(SYNTHETIC_RULES);
  assertTrue(hasDueField, "status_date duplicate-due regression requires fixture field id=due");
  const before = "- [ ] #todo || text || 📅2026-04-08 📅2026-04-10";
  const editor = makeEditor(before, 2);
  await runPkmCommandWithEditor("statusDate", editor, {
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
  /*
   * **Первого разделителя в этой строке быть не должно, и прежде он тут
   * требовался** (2026-09-13, 10.13.94). Утверждение было написано по
   * поведению кода: знак заголовка подходил под наше правило «что такое тег»,
   * зона значений считалась непустой, и строка получала разделитель, за
   * которым слева ничего не стоит. Заказчик принёс это словом «чини»:
   * `## test` после `Imp` давало `## || test :: #/1`.
   *
   * Правило то же, что у строки без знака заголовка: значений слева нет —
   * правый Block отделяется **вторым** разделителем, и только им.
   */
  assertTrue(/^\s*##\s+heading\s+\S+\s+#\/1\s*$/.test(line),
    "у строки-заголовка без значений слева первого разделителя быть не должно: " + JSON.stringify(line));
  assertTrue(line.indexOf("||") === -1,
    "первый разделитель в строке-заголовке без значений слева: " + JSON.stringify(line));
}

/*
 * **Скобки за знаком заголовка — текст человека, и он их не теряет**
 * (2026-09-13, 10.13.94).
 *
 * Задача у Obsidian — это скобки за знаком **списка**; у заголовка знака
 * списка нет, и `#### [ ] heading` есть заголовок с текстом `[ ] heading`.
 * Возврат знака заголовка снимал их безусловно, и текст человека пропадал из
 * строки — тот же класс, что У-91.
 *
 * Нашлось это **обходом по симптому**: каждый экспорт модулей доводки обёрнут
 * и спрошен «вход нёс скобки, выход не несёт». Чтением трёх дорог сборки
 * место не находилось.
 */
async function testStatusHeadingKeepsBracketsThatAreNotACheckbox() {
  const source = "#### [ ] heading";
  const editor = makeEditor(source, source.length);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules data": SYNTHETIC_RULES,
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
  assertTrue(/#\/1/.test(line),
    "контроль: команда не сработала, мерить нечего — " + JSON.stringify(line));
  assertTrue(line.indexOf("[ ]") !== -1,
    "скобки за знаком заголовка — текст человека, и они обязаны остаться: " + JSON.stringify(line));
  assertTrue(/^\s*####\s+\[ \]\s+heading\s/.test(line),
    "текст человека за знаком заголовка обязан остаться на своём месте: " + JSON.stringify(line));
}

async function testStatusContextMinimalHeadingKeepsTextSlotAfterSeparator() {
  const editor = makeEditor("## 111", 3);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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

/*
 * **Знак задачи человека переживает команду поля — и на строке без текста.**
 *
 * Замечание заказчика 2026-09-13: `- [ ] ` после `importance next` давала
 * `-  :: #/1`. Прежняя починка того же правила (10.13.92) закрыла случай со
 * строкой, у которой текст есть, и на ней чекбокс и правда переживал весь цикл
 * — а на пустой пропадал: разбор отдавал построителю префикса строку **без**
 * знака, и флаг `preserveCheckboxPrefix` решал судьбу того, чего уже не было
 * (У-164).
 *
 * Случаев здесь два, и второй — граница: `[x]` не значение ни одного Field, а
 * `[ ]` в этой фикстуре — вид значения `type`. Ни тот, ни другой полю
 * `priority` не принадлежат, и уносить их оно не вправе.
 */
async function testStatusTagsKeepsUserCheckboxOnEmptyLine() {
  for (const token of ["[ ]", "[x]"]) {
    const editor = makeEditor("- " + token + " ", 6);
    await runPkmCommandWithEditor("statusTags", editor, {
      "Rules data": SYNTHETIC_RULES,
      "Action type": "cycle_field:priority",
      "Direction": "increase",
      "Order config": buildOrderConfig({
        freeRoam: { priority: "off" },
        panel: { priority: "left" },
      }),
      "Cycle end behavior": "keep-bullet",
      "Cursor policy": "text_end",
    });
    const line = editor.snapshot().line;
    assertTrue(line.indexOf("- " + token + " ") === 0,
      "знак задачи человека пропал со строки без текста: " + JSON.stringify(line)
      + " (ожидалось начало " + JSON.stringify("- " + token + " ") + ")");
  }
}

/*
 * **Конец цикла уносит знак значения и не трогает чужой.**
 *
 * Пара, и вторая половина — контроль: у одной и той же команды на одной и той
 * же строке знак либо принадлежит полю `type` (`[ ]` — вид значения `#todo`),
 * либо не принадлежит (`[x]` человека). Снятое значение уносит только первый.
 * Без пары «уносить всегда» и «уносить своё» выглядят одинаково (У-164).
 *
 * Режим здесь `off` — тот самый `io-field-behavior=strict`, о котором говорил
 * заказчик. В режиме `minimal` слот знака принадлежит самому Field: он рисует
 * им своё значение и переписывает чужой знак на первом же шаге, — и там на
 * выходе из цикла знак уходит по-прежнему. Обе дороги в этом сходятся, и
 * трогать это правило замечание не просило.
 */
async function testStatusTagsCycleEndKeepsForeignCheckbox() {
  /* Четыре случая, а не два: строка с текстом идёт одной дорогой, а строка без
     текста сворачивается до «знак списка и знак задачи» — другой, и знак там
     ставит отдельная сборка (`buildBulletOnlyLine`). Без второй пары половина
     правки остаётся без проверки (У-164). */
  const cases = [
    { line: "- [x] #todo || 111", keeps: "[x]", why: "знак человека" },
    { line: "- [ ] #todo || 111", keeps: "", why: "знак значения #todo" },
    { line: "- [x] #todo", keeps: "[x]", why: "знак человека на строке без текста" },
    { line: "- [ ] #todo", keeps: "", why: "знак значения #todo на строке без текста" },
  ];
  for (const c of cases) {
    const editor = makeEditor(c.line, c.line.length);
    await runPkmCommandWithEditor("statusTags", editor, {
      "Rules data": SYNTHETIC_RULES,
      "Action type": "cycle_field:type",
      "Direction": "decrease",
      "Order config": buildOrderConfig({
        freeRoam: { type: "off" },
        panel: { type: "left" },
      }),
      "Cycle end behavior": "keep-bullet",
      "Cursor policy": "text_end",
    });
    const line = editor.snapshot().line;
    assertTrue(!/#todo/.test(line),
      "контроль: значение поля не снялось, и спрашивать про знак не о чем: " + JSON.stringify(line));
    if (c.keeps) {
      assertTrue(line.indexOf(c.keeps) !== -1,
        "конец цикла унёс " + c.why + ": " + JSON.stringify(line));
    } else {
      assertTrue(!/\[[^\]]\]/.test(line),
        "конец цикла оставил на строке " + c.why + ": " + JSON.stringify(line));
    }
  }
}

/*
 * **Панель отвечает на тот же вопрос тем же ответом.**
 *
 * Та же пара строк и тот же выход из цикла, что у команды поля выше, только
 * ход другой: стрелка вправо ведёт на `type`, стрелка вниз доводит его
 * значение до конца. Ровно здесь два хода уже расходились однажды — в панели
 * стоял литерал `false` (И-3), — и расхождение стоило заказчику захода; вторая
 * половина пары сторожит, что знак значения панель по-прежнему уносит.
 */
async function testTagWheelCycleEndKeepsForeignCheckbox() {
  /* Четыре случая, а не два: строка с текстом идёт одной дорогой, а строка без
     текста сворачивается до «знак списка и знак задачи» — другой, и знак там
     ставит отдельная сборка (`buildBulletOnlyLine`). Без второй пары половина
     правки остаётся без проверки (У-164). */
  const cases = [
    { line: "- [x] #todo || 111", keeps: "[x]", why: "знак человека" },
    { line: "- [ ] #todo || 111", keeps: "", why: "знак значения #todo" },
    { line: "- [x] #todo", keeps: "[x]", why: "знак человека на строке без текста" },
    { line: "- [ ] #todo", keeps: "", why: "знак значения #todo на строке без текста" },
  ];
  for (const c of cases) {
    const editor = makeEditor(c.line, c.line.length);
    await runTagWheelKeys(editor, {
      "Rules data": SYNTHETIC_RULES,
      "Order config": buildOrderConfig({
        freeRoam: { type: "off" },
        panel: { type: "left" },
      }),
      "Cycle end behavior": "keep-bullet",
      "Cursor policy": "text_end",
    }, ["ArrowRight", "ArrowDown"]);
    const line = editor.snapshot().line;
    assertTrue(!/#todo/.test(line),
      "контроль: панель не сняла значение поля, и спрашивать про знак не о чем: " + JSON.stringify(line));
    if (c.keeps) {
      assertTrue(line.indexOf(c.keeps) !== -1,
        "панель унесла " + c.why + ": " + JSON.stringify(line));
    } else {
      assertTrue(!/\[[^\]]\]/.test(line),
        "панель оставила на строке " + c.why + ": " + JSON.stringify(line));
    }
  }
}

async function testStatusTagsContextMinimalPrefixOffDoesNotCreatePrefix() {
  const editor = makeEditor("111", 1);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
    "Action type": "cycle_field:type",
    "Direction": "increase",
    "Order config": orderConfig,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
    "Action type": "cycle_field:type",
    "Direction": "increase",
    "Order config": orderConfig,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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

/*
 * Замечание заказчика 2026-09-12 (лист приёмки, `S12`): «в строке `- #work || `
 * через tagwheel изменил Imp, получил `- #/1 || `» — значение соседнего Field
 * исчезло. И обратное: «изменил value у field Cat, но ничего не произошло» —
 * там пропадало только что выбранное.
 *
 * **Что здесь проверяется.** Значение важности в его настройках записано как
 * `#/1` — решётка, а сразу за ней косая черта. Перенос значения по Block
 * считал такой токен **родительско-дочерним** («родитель/ребёнок») по одному
 * признаку «в строке есть косая черта» — и родителем получалась одна решётка.
 * Дальше уборка «снять всё, что начинается с родителя» выносила из строки
 * **каждый** тег.
 *
 * Мутация: вернуть в `relocateTokenSetByPanel` признак
 * `selectedToken.indexOf("/") !== -1` — и эта проверка краснеет.
 */
/**
 * Открыть панель и вернуть её состояние, ничего не применяя.
 *
 * Нужна там, где предмет проверки — сама панель: на каком Field она встала.
 * Положительный контроль тот же, что у применения: панель, которая не
 * открылась, отвечает на любой вопрос молчанием.
 */
async function openTagWheelPanel(editor, settings) {
  const app = makeAppForRuntime(editor);
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  const said = [];
  if (!global.window) global.window = makeWindowMock();
  global.Notice = function Notice(m) { said.push(String(m)); };
  const withDates = Object.assign(
    { "Date runtime config": TAGWHEEL_FIXTURE_DATE_RUNTIME },
    settings || {}
  );
  let snapshot = null;
  try {
    await runtime.runCommand({ app, command: "tagWheel", settings: withDates });
    const st = global.window.__tagWheelState;
    if (st && st.active === true && st.session) {
      snapshot = {
        activeFieldId: String(st.session.activeFieldId || ""),
        mode: String(st.session.mode || ""),
        /* Вид панели читается до `Esc`: после него на строке исходная. */
        control: editor.getLine(0),
        /* Что панель узнала в строке, а не только куда встала. */
        selected: Object.assign({}, st.session.selected || {}),
        parsed: st.parsedLine || null,
      };
    }
    if (st && typeof st.cancel === "function") st.cancel();
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
  if (!snapshot) {
    throw new Error("TagWheel не открылся: спрашивать не о чем.\n  Что сказал движок: " + JSON.stringify(said));
  }
  return snapshot;
}

/*
 * Замечание заказчика 2026-09-12 (`S5`): «при `First field` в моём порядке
 * при открытии в левом Block активным было второе поле, хотя должно было быть
 * первое».
 *
 * Его порядок начинается с элемента-даты. Поле выбиралось по имени верно, а
 * следом имя бралось заново — номером в списке **по типу**, где элемента нет
 * вовсе, — и активным вставал первый тег.
 *
 * Мутация: вернуть в месте открытия панели строку, берущую имя по номеру, — и
 * эта проверка краснеет.
 */
/* Элемент второй фикстуры: значок и формат из двух слов — как у заказчика. */
const OWNER_SHAPE_DATE_RUNTIME = JSON.stringify({
  fields: ["date_due"],
  byField: { date_due: { emoji: "\uD83D\uDCC5", format: "YYYY-MM-DD hh:mm" } },
  canonical: { date_due: "date_due" },
});

/* Порядок заказчика: элемент-дата первым, следом теги. */
function ownerShapeOrder(extra) {
  return buildOrderConfig(Object.assign({
    left: ["date_due", "Category", "Importance", "type"],
    right: ["Project"],
    types: { date_due: "element", Category: "tag", Importance: "tag", type: "tag", Project: "wikilink" },
    panel: { date_due: "left", Category: "left", Importance: "left", type: "left", Project: "right" },
    freeRoam: { date_due: "off", Category: "off", Importance: "off", type: "off", Project: "off" },
    active: { date_due: "yes", Category: "yes", Importance: "yes", type: "yes", Project: "yes" },
    enabled: { date_due: true, Category: true, Importance: true, type: true, Project: true },
  }, extra || {}));
}

/*
 * **Строка без знака списка: текст человека остаётся текстом.**
 *
 * Замечание заказчика 2026-09-12: он печатал слово на пустой строке и жал
 * команду поля правого Block, а получал `- 1231 :: :: 📅…` — два разделителя
 * подряд; панелью — пять. Он назвал это артефактами и сказал: «мне надоело,
 * что постоянно ломается».
 *
 * Причина не в записи, а в разборе. Развязка «слева нет значений Field, значит
 * слева текст» делалась **только у строк со знаком списка**: опасались, что у
 * строки без знака левый сегмент станет пустым, а сборка подставит `-`. На
 * строке `1231` развязки не было, слово человека считалось зоной значений, и
 * правый Block приклеивался к ней вторым разделителем поверх уже стоявшего.
 *
 * **Обход этого не видел, потому что все три его исходные строки начинались с
 * `- `.** Это У-147 в чистом виде: пример, у которого одна и та же сторона
 * везде, слеп к правилу, которое эту сторону и решает.
 *
 * Вторая половина — положительный контроль и он же ответ на прежнее опасение:
 * при выключенном `Strict: add a bullet` знак списка не появляется. Без него
 * проверка не отличила бы починку от плагина, который ставит буллит всегда.
 *
 * Мутация: вернуть в `demoteLeftBodyToText` требование знака списка — и первая
 * половина краснеет на втором разделителе.
 */
async function testTextLineWithoutListMarkerKeepsOneSeparator() {
  const rightElement = {
    left: ["Category", "Importance", "type"],
    right: ["date_due", "Project"],
    panel: { date_due: "right", Category: "left", Importance: "left", type: "left", Project: "right" },
  };
  const bulletOn = Object.assign({
    freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true, offPrefix: true, fullPlacement: "smart" },
  }, rightElement);
  const bulletOff = Object.assign({
    freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true, offPrefix: false, fullPlacement: "smart" },
  }, rightElement);

  const settings = (extra) => ({
    "Rules data": OWNER_SHAPE_RULES,
    "Order config": ownerShapeOrder(extra),
    "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });

  async function byCommand(extra) {
    const editor = makeEditor("1231", 4);
    await runPkmCommandWithEditor("statusDate", editor, Object.assign(settings(extra), {
      "Action type": "field_inc:date_due",
    }));
    return editor.snapshot().line;
  }

  async function byPanel(extra) {
    const editor = makeEditor("1231", 4);
    await runTagWheelKeys(editor, Object.assign(settings(extra), {
      "Start setting": "right",
      "Start mode override": "right",
    }), ["ArrowUp"]);
    return editor.snapshot().line;
  }

  const cmdOn = await byCommand(bulletOn);
  const panOn = await byPanel(bulletOn);
  assertTrue(cmdOn.indexOf("📅") !== -1 && panOn.indexOf("📅") !== -1,
    "контроль: значение элемента не встало ни одной дорогой, и считать разделители не на чем:\n"
    + "  команда: " + JSON.stringify(cmdOn) + "\n  панель:  " + JSON.stringify(panOn));
  assertEq((cmdOn.match(/::/g) || []).length, 1,
    "команда поставила не один разделитель на строке без знака списка: " + JSON.stringify(cmdOn));
  assertEq((panOn.match(/::/g) || []).length, 1,
    "панель поставила не один разделитель на строке без знака списка: " + JSON.stringify(panOn));
  assertTrue(cmdOn.indexOf("1231") !== -1 && panOn.indexOf("1231") !== -1,
    "текст человека пропал со строки:\n"
    + "  команда: " + JSON.stringify(cmdOn) + "\n  панель:  " + JSON.stringify(panOn));
  assertEq(cmdOn, panOn,
    "обе дороги обязаны дать одну строку:\n"
    + "  команда: " + JSON.stringify(cmdOn) + "\n  панель:  " + JSON.stringify(panOn));

  /*
   * Прежнее опасение проверяется прямо: знак списка решает настройка, и при
   * выключенной он на строке человека не появляется.
   */
  const cmdOff = await byCommand(bulletOff);
  assertTrue(!/^\s*-\s/.test(cmdOff),
    "при выключенном `Strict: add a bullet` строка человека получила знак списка: "
    + JSON.stringify(cmdOff));
  assertEq((cmdOff.match(/::/g) || []).length, 1,
    "при выключенном `Strict: add a bullet` разделитель снова не один: " + JSON.stringify(cmdOff));
}

/*
 * **Разделитель у полосы панели виден с обеих сторон.**
 *
 * Замечание заказчика 2026-09-12: «при открытии в пустой строке правого блока
 * слева от него показывает сепаратор, а при открытии левого блока справа не
 * возникает сепаратора — хочу, чтобы возникал».
 *
 * У правой панели ветка «текста нет» ставила разделитель всегда, у левой —
 * не ставила вовсе. Правило одно на обе: разделитель стоит с той стороны,
 * где остальная строка, и стоит там даже когда остальная строка пуста.
 *
 * Правая сторона спрашивается рядом и есть положительный контроль: без неё
 * утверждение было бы зелёным и у плагина, который сыплет разделители где
 * попало.
 *
 * Мутация: вернуть в `renderControlLine` ветку «текста нет — отдать одну полосу»,
 * и левая половина краснеет.
 */
async function testPanelShowsItsSeparatorOnBothSides() {
  const settings = (side) => ({
    "Rules data": OWNER_SHAPE_RULES,
    "Order config": ownerShapeOrder(),
    "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
    "Start setting": side,
    "Start mode override": side,
  });

  const left = await openTagWheelPanel(makeEditor("- ", 2), settings("left"));
  assertTrue(/==\s*\|\|$/.test(String(left.control || "").trim()),
    "\u043f\u0440\u0438 \u043e\u0442\u043a\u0440\u044b\u0442\u0438\u0438 \u043b\u0435\u0432\u043e\u0433\u043e Block \u0440\u0430\u0437\u0434\u0435\u043b\u0438\u0442\u0435\u043b\u044c \u0441\u043f\u0440\u0430\u0432\u0430 \u043e\u0442 \u043f\u043e\u043b\u043e\u0441\u044b \u043d\u0435 \u043f\u043e\u044f\u0432\u0438\u043b\u0441\u044f: "
    + JSON.stringify(left.control));

  const right = await openTagWheelPanel(makeEditor("- ", 2), settings("right"));
  assertTrue(/(^|\s)::\s+==/.test(String(right.control || "")),
    "\u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c: \u0443 \u043f\u0440\u0430\u0432\u043e\u0433\u043e Block \u0440\u0430\u0437\u0434\u0435\u043b\u0438\u0442\u0435\u043b\u044f \u0441\u043b\u0435\u0432\u0430 \u0442\u043e\u0436\u0435 \u043d\u0435\u0442, \u0437\u043d\u0430\u0447\u0438\u0442 \u0432\u0435\u0440\u0445\u043d\u0435\u0435\n"
    + "  \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u0442 \u043d\u0435 \u0442\u043e: " + JSON.stringify(right.control));

  /* И разделитель один, а не два: полоса растёт, если их копить. */
  assertEq((String(left.control || "").match(/\|\|/g) || []).length, 1,
    "\u0443 \u043b\u0435\u0432\u043e\u0439 \u043f\u0430\u043d\u0435\u043b\u0438 \u0440\u0430\u0437\u0434\u0435\u043b\u0438\u0442\u0435\u043b\u0435\u0439 \u043d\u0435 \u043e\u0434\u0438\u043d: " + JSON.stringify(left.control));
  assertEq((String(right.control || "").match(/::/g) || []).length, 1,
    "\u0443 \u043f\u0440\u0430\u0432\u043e\u0439 \u043f\u0430\u043d\u0435\u043b\u0438 \u0440\u0430\u0437\u0434\u0435\u043b\u0438\u0442\u0435\u043b\u0435\u0439 \u043d\u0435 \u043e\u0434\u0438\u043d: " + JSON.stringify(right.control));
}

/*
 * **Панель обязана узнавать то, что плагин написал сам.**
 *
 * Замечание заказчика 2026-09-12: «был баг, когда в right block были выбраны
 * элементы, но при активации TagWheel right они не распознались как выбранные
 * values, а отображались как текст».
 *
 * Строка, у которой заполнен **только** правый Block, отделяется **вторым**
 * разделителем: первого в ней взяться неоткуда (исключения 45 и 62 к З3). Это
 * ровно та строка, которую пишет команда поля правого Block на пустой строке, —
 * то есть плагин сам её и создаёт. Разбор строки был объявлен дважды: общий в
 * `line_pipeline.splitSegments` и своя копия в `parseLine` TagWheel. Копию
 * правило обошло стороной, и она объявляла текстом человека всё вместе с
 * разделителем: панель показывала значения текстом, а убрать их не давала.
 *
 * Набор этого не видел ни дня, и видеть не мог: строку панель не портит — `Esc`
 * возвращает исходную, — а все проверки спрашивали **строку**. Спрашивать надо
 * состав выбранного.
 *
 * Контроль стоит первой половиной: если команда ничего не написала, узнавать
 * нечего, и утверждение ниже было бы красным не по делу.
 *
 * Мутация: вернуть в `parseLine` свой поиск разделителей — и обе половины
 * краснеют.
 */
async function testPanelRecognizesTheLineThePluginWroteItself() {
  /* Элемент уезжает в правый Block: там и живёт случай заказчика. */
  const rightElement = {
    left: ["Category", "Importance", "type"],
    right: ["date_due", "Project"],
    panel: { date_due: "right", Category: "left", Importance: "left", type: "left", Project: "right" },
  };
  const settings = () => ({
    "Rules data": OWNER_SHAPE_RULES,
    "Order config": ownerShapeOrder(rightElement),
    "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });

  const written = makeEditor("", 0);
  await runPkmCommandWithEditor("statusDate", written, Object.assign(settings(), {
    "Action type": "field_inc:date_due",
  }));
  const line = written.snapshot().line;
  assertTrue(line.indexOf("📅") !== -1,
    "контроль: команда правого Block ничего не написала, и узнавать нечего: " + JSON.stringify(line));

  const seen = await openTagWheelPanel(makeEditor(line, 2), Object.assign(settings(), {
    "Start setting": "right",
    "Start mode override": "right",
  }));
  assertTrue(String(seen.selected && seen.selected.date_due || "") !== "",
    "панель не узнала значение, которое плагин написал сам, и показывает его текстом:\n"
    + "  строка: " + JSON.stringify(line) + "\n"
    + "  разбор: " + JSON.stringify(seen.parsed && seen.parsed.text) + " / "
    + JSON.stringify(seen.parsed && seen.parsed.dates));

  /*
   * Та же строка с текстом человека: первого разделителя в ней тоже нет, и
   * прежде текстом объявлялось всё вместе со значением.
   */
  const withText = makeEditor("- \u0442\u0435\u043a\u0441\u0442", 7);
  await runPkmCommandWithEditor("statusDate", withText, Object.assign(settings(), {
    "Action type": "field_inc:date_due",
  }));
  const textLine = withText.snapshot().line;
  const seenText = await openTagWheelPanel(makeEditor(textLine, 2), Object.assign(settings(), {
    "Start setting": "right",
    "Start mode override": "right",
  }));
  assertTrue(String(seenText.selected && seenText.selected.date_due || "") !== "",
    "на строке с текстом человека панель значение правого Block тоже не узнала: "
    + JSON.stringify(textLine));
  assertTrue(String(seenText.parsed && seenText.parsed.text || "").indexOf("📅") === -1,
    "значение правого Block уехало в текст человека: "
    + JSON.stringify(seenText.parsed && seenText.parsed.text));
}

/*
 * Вторая половина того же контрола: `First Field of the Block` обязан быть
 * **ответом**, а не отсутствием ответа.
 *
 * В правилах бывает старый ключ «поле по умолчанию» (`activationFocus`), и
 * пока выбор «первое поле» возвращал пустоту, решал он. Контрол при этом
 * показывал человеку одно, а панель делала другое.
 *
 * Мутация: вернуть в `chooseActiveFieldId` пустой ответ для `first` — и эта
 * проверка краснеет, потому что победит ключ фикстуры.
 */
async function testTagWheelFirstFieldBeatsRulesDefaultFieldId() {
  const editor = makeEditor("- [ ] #todo :: 111", 6);
  const seen = await openTagWheelPanel(editor, {
    "Rules data": SYNTHETIC_RULES,
    "Order config": buildOrderConfig({
      left: ["category", "context", "importance", "priority", "type"],
      right: ["clients"],
      panel: { category: "left", importance: "left", type: "left" },
      freeRoam: { category: "off", importance: "off", type: "off" },
    }),
    "TagWheel active field mode": "first",
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  assertEq(seen.activeFieldId, "context",
    "панель открылась на поле из правил, а не на первом поле Order: выбор человека слабее старого ключа");
}

/*
 * Замечание заказчика 2026-09-12 (`S12`): шаг по дате уносил его теги за
 * разделитель, а вторым нажатием — в правый Block.
 *
 *   было:  - [N] даты2026-09-12 09:05 #/2 #note || 
 *   стало: - [N] даты2026-09-12 09:06 || #/2 #note
 *
 * Причина: доводка строки спрашивала «что здесь текст человека» у своего
 * объявления, а оно снимало токены только **с начала** строки и
 * останавливалось на первом, который не узнало. Всё, что стояло за датой,
 * объявлялось прозой и уезжало в слот текста.
 *
 * Мутация: вернуть в `cleanOriginalTextForLeftDate` свой обход — и эта
 * проверка краснеет.
 */
/*
 * Настройка `Strict: add a bullet` — одна на все способы поставить значение.
 *
 * Замечание заказчика 2026-09-12 (`S12`): «на пустой строке без префикса
 * активировал command due next и получил строку без буллита, а с учётом
 * настроек должен был с буллитом». Измерено: шаг по **тегу** настройку
 * спрашивает и буллит ставит, шаг по **элементу** не спрашивал её вовсе.
 *
 * Контроль стоит рядом в самой проверке: сначала шаг по тегу — если и он
 * перестанет ставить буллит, красным станет контроль, а не предмет.
 *
 * Мутация: снять вызов `enforceOffModeFinalPrefixUnified` в `status_date.js` —
 * и эта проверка краснеет.
 */
/*
 * Замечание заказчика 2026-09-12 (`S12`): «на пустой строке активировал
 * tagwheel и выбрал due — получил значение в правом Block, а должен был в
 * левом, поскольку Due находится в left block». Командой то же самое встаёт
 * слева.
 *
 * Правая доводка строки решала, что хвост из значений элементов принадлежит
 * правому Block, **по записи правил**: метки берутся у полей правого списка,
 * а Order при этом говорит «слева». Значение, только что поставленное на своё
 * место, эта доводка уносила обратно.
 *
 * Мутация: вернуть в `normalizeRightPayloadTailToDates` метки по стороне
 * списка — и эта проверка краснеет.
 */
async function testTagWheelKeepsElementInLeftBlockByOrder() {
  const editor = makeEditor("- \uD83D\uDCC52026-01-02 03:04 || ", 2);
  await runTagWheelApply(editor, {
    "Rules data": OWNER_SHAPE_RULES,
    "Order config": ownerShapeOrder(),
    "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(line.indexOf("::") === -1,
    "панель увела значение элемента в правый Block, хотя по Order его место слева: " + JSON.stringify(line));
  assertTrue(/^-\s\uD83D\uDCC5/.test(line),
    "значение элемента не осталось в левом Block: " + JSON.stringify(line));
}

/*
 * **Строка, собранная плагином, обязана быть неподвижной**: разобрать её и
 * собрать заново обязано дать её же.
 *
 * Замечание заказчика 2026-09-12: «в пустой строке активировал Random, получил
 * `:: :: :: :: :: 🤣ZdK1x-` — это что вообще за артефакты? Полностью
 * проанализируй поведение строки». Артефакт был ровно этим: строка `-  :: 👤111`
 * собиралась верно, а разбор читал её иначе — для строки, у которой заполнен
 * только правый Block, ветки не было вовсе, и весь текст вместе с разделителем
 * уезжал в левый сегмент. Доводки строки устроены как «разобрать — поправить —
 * собрать» и зовутся по нескольку раз подряд: каждый круг дописывал по
 * разделителю.
 *
 * Проверка спрашивает **свойство**, а не случай: у каждой строки из списка
 * разбор и сборка обязаны сойтись. Список закрывает все три зоны — только
 * правый Block, только левый, обе с текстом.
 *
 * Мутация: снять в `splitSegments` ветку «перед вторым разделителем ничего
 * нет» — и проверка краснеет на первых двух строках.
 */
function testBuiltLineSurvivesParseAndBuild() {
  const linePipeline = require(path.join(__dirname, "..", "..", "src", "core", "line_pipeline.js"));
  const rules = {
    io: { separator1: "||", separator2: "::" },
    dates: { markers: ["📅", "👤"] },
    leftMode: { fields: [] },
    rightMode: { fields: [] },
  };
  /*
   * **Заголовки куплены его словом «чини» 2026-09-13** (10.13.94). Список был
   * из одних строк со знаком списка, и целого класса не видел: знак заголовка
   * — чужая разметка, а наше правило «что такое тег» (решётка плюс непробел)
   * ложится на `##` целиком. Одна решётка под него не подходит, две и больше —
   * подходят, поэтому `# текст` вела себя верно, а `## текст` получала
   * разделитель при пустой зоне значений и знак списка впереди заголовка.
   *
   * Скобки за знаком заголовка — отдельная строка списка: задача у Obsidian
   * это скобки за знаком **списка**, и `#### [ ] текст` есть заголовок с
   * текстом `[ ] текст`.
   */
  const lines = [
    "-  :: 👤111",
    "-  :: 📅2026-01-02 03:04",
    "- #work || ",
    "- #work || текст",
    "- #work || текст :: 📅2026-01-02 03:04",
    "- текст :: 👤111",
    "# текст",
    "## текст",
    "###### текст",
    "## текст :: 👤111",
    "## #work || текст",
    "## #work || текст :: 📅2026-01-02 03:04",
    "#### [ ] текст",
    "#### [ ] текст :: 👤111",
  ];
  const moved = [];
  for (const line of lines) {
    const seg = linePipeline.splitSegments(line, rules);
    const again = linePipeline.buildFromSegments(seg, rules);
    if (again !== line) moved.push(JSON.stringify(line) + " -> " + JSON.stringify(again));
  }
  assertTrue(moved.length === 0,
    "строка, собранная плагином, разбором и сборкой меняется — каждый круг доводки будет её растить:\n  "
    + moved.join("\n  "));
}

/*
 * **Знак заголовка — начало строки, а не зона значений** (2026-09-13,
 * 10.13.94).
 *
 * Неподвижности на этот класс не хватает: строка `#### [ ] текст :: 👤111`
 * собирается обратно одинаково и тогда, когда текст человека объявлен зоной
 * значений. Разница видна только в самом разборе — и видна она заказчику
 * позже, когда панель показывает его слова ячейками.
 *
 * Спрашивается **равенство двум дорогам**: у строки со знаком заголовка зоны
 * обязаны лечь так же, как у строки со знаком списка. Рядом положительный
 * контроль: у строки со знаком списка они и правда ложатся так.
 */
function testHeadingPrefixIsNotAValueZone() {
  const linePipeline = require(path.join(__dirname, "..", "..", "src", "core", "line_pipeline.js"));
  const rules = {
    io: { separator1: "||", separator2: "::" },
    dates: { markers: ["📅", "👤"] },
    leftMode: { fields: [] },
    rightMode: { fields: [] },
  };
  /*
   * Пара «заголовок — список» с ожидаемыми зонами у каждой. Третья пара
   * разводит формы нарочно: скобки за знаком **списка** это задача, а за
   * знаком заголовка — текст человека, и совпадать эти две строки не обязаны
   * (иначе проверка требовала бы ровно того дефекта, который чинится).
   */
  const pairs = [
    { head: "## текст :: 👤111", list: "- текст :: 👤111",
      headLeft: "##", listLeft: "-", headText: "текст", listText: "текст" },
    { head: "## текст", list: "- текст",
      headLeft: "##", listLeft: "-", headText: "текст", listText: "текст" },
    { head: "#### [ ] текст :: 👤111", list: "- [ ] текст :: 👤111",
      headLeft: "####", listLeft: "- [ ]", headText: "[ ] текст", listText: "текст" },
  ];
  for (const row of pairs) {
    const head = linePipeline.splitSegments(row.head, rules);
    const list = linePipeline.splitSegments(row.list, rules);
    assertTrue(String(list.left || "") === row.listLeft && String(list.text || "") === row.listText,
      "контроль: у строки со знаком списка зоны легли не так, как ожидалось — "
        + JSON.stringify(row.list) + " -> " + JSON.stringify(list));
    assertTrue(String(head.left || "") === row.headLeft,
      "знак заголовка обязан быть началом строки, а не зоной значений: "
        + JSON.stringify(row.head) + " -> " + JSON.stringify(head));
    assertTrue(String(head.text || "") === row.headText,
      "текст человека у заголовка лёг не в слот текста: "
        + JSON.stringify(row.head) + " -> " + JSON.stringify(head));
  }
}

/*
 * Пустая строка и значение **правого** Block: обе дороги дают одну строку, и в
 * ней остаётся пустой слот текста — два пробела.
 *
 * Его случай: `- :: :: :: :: :: 🤣…` панелью и `- :: 🤣…` командой, при том что
 * ждал он `-  :: 🤣…`. Два пробела здесь не косметика: слот — это место, куда
 * встанет слово, и по нему же строку читает разбор.
 *
 * Мутация: снять вызов `restoreEmptyTextSlot` в доводке префикса — и проверка
 * краснеет на одном пробеле.
 */
async function testRightBlockOnEmptyLineKeepsTextSlotOnBothPaths() {
  const withBullet = { freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true, offPrefix: true, fullPlacement: "smart" } };
  /* Элемент переезжает в правый Block: там и живёт его случай. */
  const rightElement = Object.assign({
    left: ["Category", "Importance", "type"],
    right: ["date_due", "Project"],
    panel: { date_due: "right", Category: "left", Importance: "left", type: "left", Project: "right" },
  }, withBullet);

  const byCmd = makeEditor("", 0);
  await runPkmCommandWithEditor("statusDate", byCmd, {
    "Rules data": OWNER_SHAPE_RULES,
    "Action type": "field_inc:date_due",
    "Order config": ownerShapeOrder(rightElement),
    "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const cmdLine = byCmd.snapshot().line;

  const byPanel = makeEditor("", 0);
  await runTagWheelKeys(byPanel, {
    "Rules data": OWNER_SHAPE_RULES,
    "Order config": ownerShapeOrder(rightElement),
    "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
    "Start setting": "right",
    "Start mode override": "right",
  }, ["ArrowUp"]);
  const panelLine = byPanel.snapshot().line;

  assertTrue(panelLine.indexOf("📅") !== -1,
    "контроль: панель не поставила значение элемента, и сверять не с чем: " + JSON.stringify(panelLine));
  assertTrue((cmdLine.match(/::/g) || []).length === 1,
    "команда поставила не один разделитель: " + JSON.stringify(cmdLine));
  assertTrue((panelLine.match(/::/g) || []).length === 1,
    "панель поставила не один разделитель — строка растёт от круга к кругу: " + JSON.stringify(panelLine));
  assertTrue(/^-\s\s::\s/.test(cmdLine),
    "команда схлопнула пустой слот текста: " + JSON.stringify(cmdLine));
  assertTrue(/^-\s\s::\s/.test(panelLine),
    "панель схлопнула пустой слот текста: " + JSON.stringify(panelLine));
}

/*
 * **Предусловие Field спрашивает и команда, а не только панель.**
 *
 * Правило записано в PRD 10.13.4, Н21, слово в слово: Field с предусловием не
 * показывается «ни в TagWheel, ни в своих командах», пока у Field-предусловия
 * нет значения. Панель его спрашивала — и только она: обход строки 2026-09-12
 * показал, что на пустой строке команда пишет значение поля, которого панель в
 * том же месте не показывает вовсе. Правило было объявлено в документе и на
 * живом пути команд не спрошено ни разу (У-141).
 *
 * Контроль стоит второй половиной проверки: как только значение предусловия
 * появляется на строке, та же команда обязана сработать. Без него утверждение
 * «строка не изменилась» было бы зелёным и у команды, сломанной насовсем.
 *
 * Мутация: снять вызов `isFieldPrerequisiteMet` в `status_tags.js` — и
 * проверка краснеет на первой половине.
 */
async function testFieldCommandAsksPrerequisiteLikePanelDoes() {
  const settings = () => ({
    "Rules data": OWNER_SHAPE_RULES,
    "Action type": "cycle_field:Project",
    "Direction": "increase",
    "Order config": ownerShapeOrder(),
    "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });

  const withoutParent = makeEditor("", 0);
  await runPkmCommandWithEditor("statusTags", withoutParent, settings());
  assertEq(withoutParent.snapshot().line, "",
    "команда Field с предусловием сработала, хотя у Field-предусловия значения нет:"
    + " панель этого Field в том же месте не показывает вовсе (Н21)");

  const withParent = makeEditor("- #work || ", 2);
  await runPkmCommandWithEditor("statusTags", withParent, settings());
  const done = withParent.snapshot().line;
  assertTrue(done.indexOf("alpha") !== -1,
    "контроль: со значением предусловия на строке команда тоже ничего не поставила — значит верхнее утверждение зелено\n"
    + "  оттого, что команда сломана насовсем: " + JSON.stringify(done));
}

async function testStatusDateAsksBulletSettingLikeTagStepDoes() {
  const withBullet = { freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true, offPrefix: true, fullPlacement: "smart" } };

  const byTag = makeEditor("", 0);
  await runPkmCommandWithEditor("statusTags", byTag, {
    "Rules data": OWNER_SHAPE_RULES,
    "Action type": "cycle_field:Category",
    "Direction": "increase",
    "Order config": ownerShapeOrder(withBullet),
    "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const tagLine = byTag.snapshot().line;
  assertTrue(/^-\s/.test(tagLine),
    "контроль: шаг по тегу тоже перестал ставить буллит, сверять не с чем: " + JSON.stringify(tagLine));

  const byDate = makeEditor("", 0);
  await runPkmCommandWithEditor("statusDate", byDate, {
    "Rules data": OWNER_SHAPE_RULES,
    "Action type": "field_inc:date_due",
    "Order config": ownerShapeOrder(withBullet),
    "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const dateLine = byDate.snapshot().line;
  assertTrue(/^-\s/.test(dateLine),
    "шаг по элементу не спросил настройку «Strict: add a bullet»: " + JSON.stringify(dateLine));
}

/*
 * Настройку `Strict: add a bullet` спрашивают **обе** дороги, и отвечают они
 * одинаково.
 *
 * Замечание заказчика 2026-09-12 (`S15`): «при активации в пустой строке
 * command due next я получил `📅… || `, а должен был `- 📅… || `. При активации
 * через tagwheel буллит появился. Мне не нравится, что расходится поведение
 * строки у tagwheel и commands field next/previous — оно должно быть
 * идентичным и определяться settings».
 *
 * Настройку спрашивали обе, но у панели рядом стояло второе объявление того же
 * правила, из двух литералов: `preserveSyntheticPrefix: true` уводило в ветку
 * «префикс сохранить» до того, как настройка спрошена, а запасное `'-'`
 * подставляло буллит там, где общее правило подставляет пустоту (У-150).
 *
 * Проверка спрашивает **обе** стороны тумблера, и вторая сторона и есть
 * положительный контроль: при выключенном обе дороги дают строку без буллита,
 * и одного этого мало — так же выглядел бы плагин, который буллит не ставит
 * никогда.
 *
 * Мутация: вернуть в `tagwheel.js` любой из двух литералов — и эта проверка
 * краснеет на выключенном тумблере.
 */
async function testBulletSettingAnswersTheSameForPanelAndCommand() {
  const bulletOn = { freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true, offPrefix: true, fullPlacement: "smart" } };
  const bulletOff = { freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true, offPrefix: false, fullPlacement: "smart" } };

  async function byCommand(extra) {
    const editor = makeEditor("", 0);
    await runPkmCommandWithEditor("statusDate", editor, {
      "Rules data": OWNER_SHAPE_RULES,
      "Action type": "field_inc:date_due",
      "Order config": ownerShapeOrder(extra),
      "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
      "Cycle end behavior": "keep-bullet",
      "Cursor policy": "text_end",
    });
    return editor.snapshot().line;
  }

  /*
   * Панель берётся на строке, где значение элемента уже стоит: применение без
   * выбора отдаёт ту же строку, и спрашиваем мы ровно префикс. Контроль
   * «панель открылась» стоит внутри `runTagWheelApply` (У-152).
   */
  async function byPanel(extra) {
    const editor = makeEditor("📅2026-01-02 03:04 || ", 2);
    await runTagWheelApply(editor, {
      "Rules data": OWNER_SHAPE_RULES,
      "Order config": ownerShapeOrder(extra),
      "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
      "Cycle end behavior": "keep-bullet",
      "Cursor policy": "text_end",
    });
    return editor.snapshot().line;
  }

  const hasBullet = (line) => /^\s*-\s/.test(String(line || ""));

  const cmdOff = await byCommand(bulletOff);
  const panOff = await byPanel(bulletOff);
  assertTrue(!hasBullet(cmdOff) && !hasBullet(panOff),
    "при выключенном `Strict: add a bullet` буллит поставила одна из дорог:\n"
    + "  команда: " + JSON.stringify(cmdOff) + "\n"
    + "  панель:  " + JSON.stringify(panOff));

  const cmdOn = await byCommand(bulletOn);
  const panOn = await byPanel(bulletOn);
  assertTrue(hasBullet(cmdOn) && hasBullet(panOn),
    "контроль: при включённом `Strict: add a bullet` буллита нет у одной из дорог,\n"
    + "  значит верхнее утверждение зелено оттого, что буллита не бывает вовсе:\n"
    + "  команда: " + JSON.stringify(cmdOn) + "\n"
    + "  панель:  " + JSON.stringify(panOn));
}

/*
 * «Сейчас» у элемента — часы человека, и одни и те же у панели и у команды.
 *
 * Замечание заказчика 2026-09-12 (`S15`, вторая половина): «при `command due
 * previous` время не исчезло, когда оно стало ниже текущего — в tagwheel, когда
 * делаешь previous относительно первого значения, field становится пустым».
 *
 * Причина не в шаге вниз. Панель писала **местное** время, а шаг по элементу
 * печатал тот же момент гринвичскими: в общем модуле значение разбирается
 * `Date.UTC(...)` и пишется `getUTC*`, то есть `Date` там несёт настенные часы,
 * а ветка времени отдавала в него настоящий момент. На `+03:00` значение,
 * поставленное панелью, стояло на три часа выше нуля, от которого команда
 * считает, и шаг вниз до него не доходил никогда.
 *
 * **Часовой пояс проверка задаёт сама, и без этого она слепа**: на машине с
 * `UTC` обе стороны совпадают, и «совпали» получается само (У-147). CI как раз
 * такая машина. Взят `Asia/Tokyo` — у него нет перехода на летнее время, и
 * смещение постоянно круглый год.
 *
 * Мутация: вернуть `new Date()` в `getReferenceDateForUnit` — и проверка
 * краснеет на девять часов.
 */
async function testElementNowSpeaksTheHumanClockOnBothPaths() {
  const prevTz = process.env.TZ;
  process.env.TZ = "Asia/Tokyo";
  try {
    /* Контроль: пояс и правда сменился, иначе спрашивать нечего. */
    assertEq(new Date().getTimezoneOffset(), -540,
      "часовой пояс проверки не сменился, и она спрашивала бы про совпадение с самой собой");

    const stampNow = () => {
      const d = new Date();
      const two = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} `
        + `${two(d.getHours())}:${two(d.getMinutes())}`;
    };

    const byCommand = makeEditor("", 0);
    const beforeCmd = stampNow();
    await runPkmCommandWithEditor("statusDate", byCommand, {
      "Rules data": OWNER_SHAPE_RULES,
      "Action type": "field_inc:date_due",
      "Order config": ownerShapeOrder(),
      "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
      "Cycle end behavior": "keep-bullet",
      "Cursor policy": "text_end",
    });
    const afterCmd = stampNow();
    const cmdLine = byCommand.snapshot().line;
    assertTrue(cmdLine.indexOf(beforeCmd) !== -1 || cmdLine.indexOf(afterCmd) !== -1,
      "шаг по элементу написал не то время, которое человек видит на часах:\n"
      + "  строка: " + JSON.stringify(cmdLine) + "\n"
      + "  часы:   " + JSON.stringify(beforeCmd) + " … " + JSON.stringify(afterCmd));

    /* Панель: дойти стрелкой до элемента и поставить его первое значение. */
    const byPanel = makeEditor("", 0);
    const beforePanel = stampNow();
    await runTagWheelKeys(byPanel, {
      "Rules data": OWNER_SHAPE_RULES,
      "Order config": ownerShapeOrder(),
      "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
      "Cycle end behavior": "keep-bullet",
      "Cursor policy": "text_end",
    }, ["ArrowUp"]);
    const afterPanel = stampNow();
    const panelLine = byPanel.snapshot().line;
    assertTrue(panelLine.indexOf("📅") !== -1,
      "контроль: панель не поставила значение элемента, и сверять время не с чем: "
      + JSON.stringify(panelLine));
    assertTrue(panelLine.indexOf(beforePanel) !== -1 || panelLine.indexOf(afterPanel) !== -1,
      "панель написала не то время, которое человек видит на часах:\n"
      + "  строка: " + JSON.stringify(panelLine) + "\n"
      + "  часы:   " + JSON.stringify(beforePanel) + " … " + JSON.stringify(afterPanel));
  } finally {
    if (prevTz === undefined) delete process.env.TZ;
    else process.env.TZ = prevTz;
  }
}

async function testStatusDateKeepsManagedTagsInLeftBlock() {
  const editor = makeEditor("- [N] \uD83D\uDCC52026-09-12 09:05 #/2 #note || ", 5);
  await runPkmCommandWithEditor("statusDate", editor, {
    "Rules data": OWNER_SHAPE_RULES,
    "Action type": "field_inc:date_due",
    "Order config": ownerShapeOrder(),
    "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  const left = line.split("||")[0];
  assertTrue(/#\/2/.test(left) && /#note/.test(left),
    "шаг по дате унёс значения Fields за разделитель: " + JSON.stringify(line));
  assertTrue(line.indexOf("::") === -1,
    "шаг по дате завёл правый Block, которого в строке не было: " + JSON.stringify(line));
}

async function testTagWheelOpensOnFirstFieldOfOrderEvenWhenItIsElement() {
  const editor = makeEditor("- [ ] #todo || 111", 6);
  const seen = await openTagWheelPanel(editor, {
    "Rules data": OWNER_SHAPE_RULES,
    "Order config": ownerShapeOrder(),
    "TagWheel active field mode": "first",
    "Date runtime config": OWNER_SHAPE_DATE_RUNTIME,
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  assertEq(seen.activeFieldId, "date_due",
    "панель открылась не на первом поле его порядка: первым там стоит элемент-дата");
}

async function testTagWheelApplyKeepsNeighbourTagWhenValueHasSlash() {
  const editor = makeEditor("- [ ] #/1 #area-alpha :: 111", 7);
  await runTagWheelApply(editor, {
    "Rules data": SYNTHETIC_RULES,
    /*
     * Порядок здесь важен: Field со значением через косую черту стоит
     * **вторым**. Уборка выносит из строки всё, а каждый следующий Field
     * возвращает своё значение — поэтому теряет только тот, кто прошёл
     * раньше. В порядке по умолчанию важность идёт первой, и та же поломка
     * не видна ни одним утверждением (У-47).
     */
    "Order config": buildOrderConfig({
      left: ["category", "context", "importance", "priority", "type"],
      right: ["date_due"],
      panel: { importance: "left", category: "left" },
      freeRoam: { importance: "off", category: "off" },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  });
  const line = editor.snapshot().line;
  assertTrue(/#\/1/.test(line),
    "значение важности пропало из строки после применения панели: " + JSON.stringify(line));
  assertTrue(/#area-alpha/.test(line),
    "значение соседнего Field стёрто переносом по Block: " + JSON.stringify(line));
}

async function testTagWheelKeepsTagTokensAsTagsOnApply() {
  const editor = makeEditor("- [ ] #todo #area-alpha :: 111", 8);
  await runTagWheelApply(editor, {
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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

/**
 * `Strict: add a bullet` — «добавить, когда нечего», а не «заменить то, что
 * стоит» (замечание заказчика 2026-09-13, 10.13.92).
 *
 * **Прежняя версия этой проверки охраняла дефект** (У-58): она требовала, чтобы
 * включённая настройка переписывала начало строки дефисом, и была зелёной,
 * когда `- [ ] Task A` теряла чекбокс, а `1. test` превращалась в `- test`.
 * Написана она была по поведению кода, а не по тому, что говорит сама
 * настройка: «Start the line with a bullet **when the Field has nothing of its
 * own to put there**».
 *
 * Поэтому мерится не одна строка, а **четыре формы начала** обоими положениями
 * тумблера: разница между положениями обязана быть ровно в строке, у которой
 * начала нет вовсе. Рядом положительный контроль: положения обязаны разойтись
 * хоть на одной строке — иначе тумблер не делает ничего и всё это зелено само
 * собой (У-88).
 */
async function testStatusTagsOffPrefixToggleAddsBulletOnlyWhenThereIsNone() {
  async function run(source, offPrefix) {
    const editor = makeEditor(source, Math.max(0, source.length));
    await runPkmCommandWithEditor("statusTags", editor, {
      "Rules data": SYNTHETIC_RULES,
      "Action type": "cycle_field:topic",
      "Direction": "increase",
      "Order config": buildOrderConfig({
        active: { topic: "yes" },
        panel: { topic: "left" },
        left: ["topic"],
        enabled: { topic: true },
        freeRoam: { topic: "off" },
        freeRoamBehavior: { offPrefix },
      }),
      "Cycle end behavior": "keep-bullet",
      "Cursor policy": "text_end",
    });
    return editor.snapshot().line;
  }

  /* [строка человека, начало при ON, начало при OFF] */
  const cases = [
    ["- [ ] Task A", "- [ ] ", "- [ ] "],
    ["1. Task A", "1. ", "1. "],
    ["* Task A", "* ", "* "],
    ["Task A", "- ", ""],
  ];

  let differ = 0;
  for (const [source, onPrefix, offPrefix] of cases) {
    const on = await run(source, true);
    const off = await run(source, false);
    assertTrue(/#topic-alpha/.test(on),
      "контроль: команда и правда сработала при ON — " + JSON.stringify(on));
    assertTrue(/#topic-alpha/.test(off),
      "контроль: команда и правда сработала при OFF — " + JSON.stringify(off));
    assertTrue(on.indexOf(onPrefix) === 0,
      "`Strict: add a bullet` ON: начало строки " + JSON.stringify(source)
        + " обязано быть " + JSON.stringify(onPrefix) + ", а вышло " + JSON.stringify(on));
    assertTrue(off.indexOf(offPrefix) === 0,
      "`Strict: add a bullet` OFF: начало строки " + JSON.stringify(source)
        + " обязано быть " + JSON.stringify(offPrefix) + ", а вышло " + JSON.stringify(off));
    if (on !== off) differ += 1;
  }
  assertTrue(differ > 0, "оба положения тумблера дают одно и то же — мерить нечего");
}

async function testStatusTagsCycleFieldClientsRendersWikilinkToken() {
  const editor = makeEditor("- [ ] Task B", 6);
  await runPkmCommandWithEditor("statusTags", editor, {
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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
    "Rules data": SYNTHETIC_RULES,
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



/**
 * Повторный шаг по элементу-дате не копит хвостов и не двигает его между Block.
 *
 * **Куплено дефектом, которого набор не видел.** 2026-09-12 заказчик прислал
 * ряд: он жал шаг по дате раз за разом, и строка росла — с каждым нажатием в
 * ней оставался хвост предыдущего значения, а сам элемент прыгал слева
 * направо и обратно:
 *
 *   1. `- 📅…21:32 || `
 *   2. `-  :: 📅…21:33 21:32`
 *   3. `- 📅…21:34 ||  :: 21:32`
 *   4. `- 📅…21:35 || 21:34 :: 21:32`
 *
 * Причина была в моей же правке того дня, и найдена она перебором по истории
 * коммитов, а не чтением. Правка снята; здесь стоит сторож, которого тогда не
 * было: **четыре шага подряд обязаны оставить ровно одно значение**.
 */
async function testStatusDateRepeatedStepKeepsOneValue() {
  /*
   * **Условия те же, что у заказчика, и обе стороны разведены нарочно.**
   * Первая версия этого сторожа гоняла фикстуру набора — там оба разделителя
   * `::`, а элемент стоит справа, — и мутация «снять уборку» её не роняла:
   * сторож был слеп к тому самому дефекту, ради которого заведён (У-146).
   * Правила приезжают ключом `Rules data`, разделители `||` и `::`.
   */
  const normalize = require(path.join(__dirname, "..", "..", "src", "core", "config_normalize.js"));
  const rulesShape = require(path.join(__dirname, "..", "..", "src", "core", "pkm_rules_shape.js"));
  const cfgRepeat = normalize.migrateConfig(JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "fixtures", "config_v1_realistic.json"), "utf8")));
  cfgRepeat.pkm.lineFormat.separator1 = "||";
  cfgRepeat.pkm.lineFormat.separator2 = "::";
  const rulesRepeat = rulesShape.buildRulesForEngines(cfgRepeat);

  const editor = makeEditor("- ", 2);
  const settings = {
    "Rules data": SYNTHETIC_RULES,
    "Rules data": JSON.stringify(rulesRepeat),
    "Action type": "field_inc:date_due",
    /* Элемент уведён в ЛЕВЫЙ Block — ровно как у него. */
    "Order config": JSON.stringify({
      left: ["date_due", "Importance", "type"],
      right: ["Project"],
      active: { date_due: "yes", Importance: "yes", type: "yes", Project: "yes" },
      enabled: { date_due: true, Importance: true, type: true, Project: true },
      labels: {}, strictNames: {}, types: { date_due: "element", Project: "wikilink" }, lead: {},
    }),
    /*
     * **Формат даты задан, и это часть условий.** У фикстуры конфига ветка
     * элементов пуста, а у заказчика — `YYYY-MM-DD hh:mm` со счётчиком
     * «сейчас»: без формата шаг не собирает значение, и дефект не
     * проявляется вовсе. Первая версия этого сторожа это и пропустила —
     * мутация её не роняла (У-146).
     */
    "Date runtime config": JSON.stringify({
      fields: ["date_due"],
      byField: {
        date_due: {
          emoji: "\u{1F4C5}",
          format: "YYYY-MM-DD hh:mm",
          increment: { mode: "standard", incrementBy: 1, command: "now", customRaw: [], custom: [] },
        },
      },
    }),
    "Cycle end behavior": "keep-bullet",
    "Cursor policy": "text_end",
  };
  const seen = [];
  for (let i = 0; i < 4; i++) {
    await runPkmCommandWithEditor("statusDate", editor, settings);
    seen.push(editor.snapshot().line);
  }
  const last = seen[seen.length - 1];

  /* Контроль: движок и правда что-то писал, иначе сторож мерит пустоту. */
  assertTrue(/\d{4}-\d{2}-\d{2}/.test(last), "положительный контроль: после шагов в строке нет даты вовсе: " + last);

  const dates = last.match(/\d{4}-\d{2}-\d{2}/g) || [];
  assertEq(dates.length, 1, "после четырёх шагов дат в строке должно остаться одна, а их " + dates.length + ": " + last);
  const times = last.match(/\b\d{2}:\d{2}\b/g) || [];
  assertTrue(times.length <= 1, "после четырёх шагов в строке накопились хвосты времени: " + last);

  /* И длина не растёт от нажатия к нажатию: накопление видно ею раньше всего. */
  assertTrue(seen[3].length <= seen[1].length + 2,
    "строка растёт с каждым шагом — значит старое значение не вычищается:\n  " + seen.join("\n  "));
}

/**
 * Значение элемента из двух слов убирается целиком — и когда оно записано
 * нынешним форматом, и когда прежним.
 *
 * **Куплено разбором Т7** (PRD 10.13.71). Заказчик прислал растущий ряд, и
 * сторож рядом его не видел: он начинает с пустой строки, а дефект живёт на
 * строке, где элемент **уже стоит слева**. Терял половину не перенос, а
 * уборка «исходного текста»: она узнавала метку плюс одно слово, а формат
 * `YYYY-MM-DD hh:mm` занимает два. Хвост `21:32` объявлялся текстом человека
 * и возвращался в строку.
 *
 * Здесь три случая, и у каждого своя причина стоять:
 *
 * 1. нынешний формат из двух слов, элемент слева, слот текста пуст — ряд
 *    заказчика символ в символ;
 * 2. формат в настройках из **одного** слова, а в строке лежит значение,
 *    записанное прежним форматом из двух: условия шире первого случая —
 *    ни левый Block, ни пустой текст тут не нужны;
 * 3. парное: у кого формат из одного слова и значение тоже, строка меняется
 *    **только** значением. Правка не имеет права трогать их текст.
 */
async function testStatusDateKeepsWholeValueOfTwoWordFormat() {
  const normalize = require(path.join(__dirname, "..", "..", "src", "core", "config_normalize.js"));
  const rulesShape = require(path.join(__dirname, "..", "..", "src", "core", "pkm_rules_shape.js"));

  /*
   * Обе стороны разведены нарочно (У-147): разделители разные, элемент уведён
   * в ЛЕВЫЙ Block, формат задан со счётчиком «сейчас». На фикстуре набора
   * разделители совпадают, элемент стоит справа, а ветка элементов пуста —
   * там этому дефекту неоткуда взяться.
   */
  const buildSettings = (format) => {
    const cfg = normalize.migrateConfig(JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "fixtures", "config_v1_realistic.json"), "utf8")));
    cfg.pkm.lineFormat.separator1 = "||";
    cfg.pkm.lineFormat.separator2 = "::";
    return {
      "Rules data": SYNTHETIC_RULES,
      "Rules data": JSON.stringify(rulesShape.buildRulesForEngines(cfg)),
      "Action type": "field_inc:date_due",
      "Order config": JSON.stringify({
        left: ["date_due", "Importance", "type"],
        right: ["Project"],
        active: { date_due: "yes", Importance: "yes", type: "yes", Project: "yes" },
        enabled: { date_due: true, Importance: true, type: true, Project: true },
        labels: {}, strictNames: {}, types: { date_due: "element", Project: "wikilink" }, lead: {},
      }),
      "Date runtime config": JSON.stringify({
        fields: ["date_due"],
        byField: {
          date_due: {
            emoji: "\u{1F4C5}",
            format,
            increment: { mode: "standard", incrementBy: 1, command: "now", customRaw: [], custom: [] },
          },
        },
      }),
      "Cycle end behavior": "keep-bullet",
      "Cursor policy": "text_end",
    };
  };

  const runSteps = async (startLine, format, times) => {
    const editor = makeEditor(startLine, startLine.length);
    const settings = buildSettings(format);
    const seen = [];
    for (let i = 0; i < times; i++) {
      await runPkmCommandWithEditor("statusDate", editor, settings);
      seen.push(editor.snapshot().line);
    }
    return seen;
  };

  const orphanTimes = (line, valueCount) => {
    const times = String(line || "").match(/\b\d{2}:\d{2}\b/g) || [];
    return times.length - valueCount;
  };

  /* 1. Ряд заказчика: элемент уже стоит слева, текста нет. */
  const own = await runSteps("- \u{1F4C5}2026-09-11 21:32 || ", "YYYY-MM-DD hh:mm", 4);
  const ownLast = own[own.length - 1];
  assertTrue(/\d{4}-\d{2}-\d{2}/.test(ownLast),
    "положительный контроль: после шагов в строке нет даты вовсе: " + ownLast);
  assertEq((ownLast.match(/\d{4}-\d{2}-\d{2}/g) || []).length, 1,
    "элемент слева, нынешний формат: дат в строке должно остаться одна:\n  " + own.join("\n  "));
  assertEq(orphanTimes(ownLast, 1), 0,
    "элемент слева, нынешний формат: вторая половина значения осталась в строке:\n  " + own.join("\n  "));

  /* 2. Значение прежнего формата: в настройках одно слово, в строке два. */
  const legacy = await runSteps("-  :: \u{1F4C5}2026-09-11 21:32", "YYYY-MM-DD", 3);
  const legacyLast = legacy[legacy.length - 1];
  assertTrue(/\d{4}-\d{2}-\d{2}/.test(legacyLast),
    "положительный контроль: после шагов прежнего формата в строке нет даты вовсе: " + legacyLast);
  assertEq(orphanTimes(legacyLast, 0), 0,
    "значение прежнего формата: хвост времени не убран:\n  " + legacy.join("\n  "));

  /*
   * 3. Формат, которого общий вид даты не знает: `DD.MM.YYYY hh:mm`.
   *
   * **Куплено мутацией, а не соображением.** Первые два случая оставались
   * зелёными, когда формат поля переставали спрашивать вовсе: значение
   * заказчика записано в ISO, и его узнавал общий образец. То есть сторож
   * проверял запасной ответ вместо главного. Здесь ISO нет, и ответить может
   * только формат.
   */
  const dotted = await runSteps("- \u{1F4C5}11.09.2026 21:32 || ", "DD.MM.YYYY hh:mm", 3);
  const dottedLast = dotted[dotted.length - 1];
  assertTrue(/\d{2}\.\d{2}\.\d{4}/.test(dottedLast),
    "положительный контроль: после шагов в строке нет значения этого формата вовсе: " + dottedLast);
  assertEq((dottedLast.match(/\d{2}\.\d{2}\.\d{4}/g) || []).length, 1,
    "формат без ISO: значений в строке должно остаться одно:\n  " + dotted.join("\n  "));
  assertEq(orphanTimes(dottedLast, 1), 0,
    "формат без ISO: вторая половина значения осталась в строке:\n  " + dotted.join("\n  "));

  /*
   * 4. Парное утверждение: у кого формат из одного слова и значение тоже,
   * правка не имеет права трогать ни его текст, ни размещение.
   */
  const plain = await runSteps("- \u{1F4C5}2026-09-11 || купить молоко", "YYYY-MM-DD", 2);
  const plainLast = plain[plain.length - 1];
  assertTrue(/купить молоко/.test(plainLast),
    "формат из одного слова: текст человека пропал из строки: " + plainLast);
  assertEq(orphanTimes(plainLast, 0), 0,
    "формат из одного слова: в строке появилось время, которого не было: " + plainLast);
  assertEq((plainLast.match(/\d{4}-\d{2}-\d{2}/g) || []).length, 1,
    "формат из одного слова: дат в строке должно остаться одна: " + plainLast);
}

/**
 * Элемент встаёт в тот Block, куда его поставил человек, — и на пустой строке
 * тоже.
 *
 * **Куплено дважды.** Замечание заказчика 2026-09-12: «due появляется в right
 * block, хотя в fields order стоит в левом». Уносила его доводка строки, в
 * ветке «ни текста, ни правых значений» — отсюда и границы: со своим текстом
 * элемент оставался слева, а на пустой строке уезжал.
 *
 * Первый запрет в этом месте пришлось **снять** в тот же день: перенос вправо
 * входил в уборку старого значения, и строка начинала расти (PRD 10.13.70).
 * Поэтому здесь два утверждения, а не одно: элемент слева **и** ряд подряд
 * остаётся чистым. Без второго сторож охранял бы половину правила.
 *
 * **И парное утверждение обязательно:** у кого элемент по Order справа,
 * поведение не меняется. Запрет, поставленный безусловно, ломает их строку, и
 * увидеть это можно только так.
 */
async function testStatusDateKeepsElementInItsOrderBlock() {
  const normalize = require(path.join(__dirname, "..", "..", "src", "core", "config_normalize.js"));
  const rulesShape = require(path.join(__dirname, "..", "..", "src", "core", "pkm_rules_shape.js"));

  const settingsWithElementIn = (panel) => {
    const cfg = normalize.migrateConfig(JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "fixtures", "config_v1_realistic.json"), "utf8")));
    /* Разделители разведены нарочно: на совпадающих Block не различить (У-147). */
    cfg.pkm.lineFormat.separator1 = "||";
    cfg.pkm.lineFormat.separator2 = "::";
    const left = panel === "left" ? ["date_due", "Importance", "type"] : ["Importance", "type"];
    const right = panel === "left" ? ["Project"] : ["date_due", "Project"];
    return {
      "Rules data": SYNTHETIC_RULES,
      "Rules data": JSON.stringify(rulesShape.buildRulesForEngines(cfg)),
      "Action type": "field_inc:date_due",
      "Order config": JSON.stringify({
        left,
        right,
        active: { date_due: "yes", Importance: "yes", type: "yes", Project: "yes" },
        enabled: { date_due: true, Importance: true, type: true, Project: true },
        labels: {}, strictNames: {}, types: { date_due: "element", Project: "wikilink" }, lead: {},
      }),
      "Date runtime config": JSON.stringify({
        fields: ["date_due"],
        byField: {
          date_due: {
            emoji: "\u{1F4C5}",
            format: "YYYY-MM-DD hh:mm",
            increment: { mode: "standard", incrementBy: 1, command: "now", customRaw: [], custom: [] },
          },
        },
      }),
      "Cycle end behavior": "keep-bullet",
      "Cursor policy": "text_end",
    };
  };

  const stepsFrom = async (startLine, panel, times) => {
    const editor = makeEditor(startLine, startLine.length);
    const settings = settingsWithElementIn(panel);
    const seen = [];
    for (let i = 0; i < times; i++) {
      await runPkmCommandWithEditor("statusDate", editor, settings);
      seen.push(editor.snapshot().line);
    }
    return seen;
  };

  /* 1. Его случай: Block левый, строка пустая. */
  const leftSeen = await stepsFrom("- ", "left", 1);
  const leftLine = leftSeen[0];
  assertTrue(/\d{4}-\d{2}-\d{2}/.test(leftLine),
    "положительный контроль: движок не записал значение вовсе: " + leftLine);
  const leftIdx = leftLine.indexOf("\u{1F4C5}");
  const sepIdx = leftLine.indexOf("||");
  assertTrue(leftIdx !== -1 && sepIdx !== -1 && leftIdx < sepIdx,
    "элемент по Order слева, а встал не слева от разделителя: " + leftLine);

  /*
   * 2. И ряд подряд остаётся чистым. Без этого утверждения сторож охранял бы
   * половину правила: первый запрет в этом месте как раз и ломал уборку.
   */
  const rowSeen = await stepsFrom("- ", "left", 4);
  const rowLast = rowSeen[rowSeen.length - 1];
  assertEq((rowLast.match(/\d{4}-\d{2}-\d{2}/g) || []).length, 1,
    "элемент слева: после четырёх шагов значений в строке не одно:\n  " + rowSeen.join("\n  "));
  assertTrue(rowSeen[3].length <= rowSeen[1].length + 2,
    "элемент слева: строка растёт с каждым шагом:\n  " + rowSeen.join("\n  "));

  /* 3. Парное: у кого элемент по Order справа — он справа и остаётся. */
  const rightSeen = await stepsFrom("- ", "right", 1);
  const rightLine = rightSeen[0];
  const rightIdx = rightLine.indexOf("\u{1F4C5}");
  const sep2Idx = rightLine.indexOf("::");
  assertTrue(rightIdx !== -1 && sep2Idx !== -1 && sep2Idx < rightIdx,
    "элемент по Order справа, а встал не справа от второго разделителя: " + rightLine);

  /*
   * 4. И то же парное на случае, который **доходит до спорной ветки**.
   *
   * Утверждение 3 её не проверяет вовсе: когда значение пишет сам движок дат,
   * оно уже лежит справа, и ветка «ни текста, ни правых значений» не
   * выполняется. Нашлось это мутацией: запрет, поставленный **безусловно**,
   * утверждение 3 не ронял. Ветку доходит другой случай — строку правит
   * соседняя команда, а метка уже лежит слева: тогда её и уносит вправо
   * доводка, и делать это она обязана, раз Block у поля правый.
   */
  const strandedEditor = makeEditor("- \u{1F4C5}2026-09-11 21:32", 0);
  await runPkmCommandWithEditor("statusTags", strandedEditor, {
    ...settingsWithElementIn("right"),
    "Action type": "cycle_field:type",
    "Direction": "increase",
  });
  const strandedLine = strandedEditor.snapshot().line;
  const strandedMarker = strandedLine.indexOf("\u{1F4C5}");
  const strandedSep2 = strandedLine.indexOf("::");
  assertTrue(strandedMarker !== -1,
    "положительный контроль: значение пропало из строки вовсе: " + strandedLine);
  assertTrue(strandedSep2 !== -1 && strandedSep2 < strandedMarker,
    "метка, чей Block по Order правый, осталась слева: " + strandedLine);

  /*
   * 5. Метка выбирается **самая длинная** из подошедших.
   *
   * Спрошено у функции прямо, а не через строку, и вот почему: в конфиге
   * заказчика двух меток, где одна — начало другой, нет вовсе, и подмена
   * «брать первую попавшуюся» ни одну строку не меняла. То есть через
   * поведение это правило проверить было **не на чем** (У-147), а правило
   * настоящее: короткая метка не должна откусывать начало длинной — тем же
   * правилом живёт разбор блока на токены.
   */
  const finalizeMod = require(path.join(__dirname, "..", "..", "src", "core", "pkm_line_finalize_unified.js"));
  /* Короткая метка стоит ПЕРВОЙ в обходе: иначе порядок списков спасал бы
     неверное правило сам, и подмена ничего бы не показала. */
  const twoMarkerRules = {
    io: { separator1: "||", separator2: "::" },
    leftMode: { fields: [{ id: "short", marker: "\u{1F4C5}", panel: "left" }] },
    rightMode: { fields: [{ id: "long", marker: "\u{1F4C5}\u{1F4CC}", panel: "right" }] },
  };
  assertEq(finalizeMod.panelOfMarkerToken("\u{1F4C5}\u{1F4CC}42", twoMarkerRules), "right",
    "длинная метка проиграла короткой: Block взят не у того поля");
  assertEq(finalizeMod.panelOfMarkerToken("\u{1F4C5}2026-09-11", twoMarkerRules), "left",
    "короткая метка взяла Block длинной");
  assertEq(finalizeMod.panelOfMarkerToken("#todo", twoMarkerRules), "",
    "токен без метки обязан отвечать пустым, а не Block-ом наугад");
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
  await testStatusHeadingKeepsBracketsThatAreNotACheckbox();
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
  await testStatusTagsKeepsUserCheckboxOnEmptyLine();
  await testStatusTagsCycleEndKeepsForeignCheckbox();
  await testTagWheelCycleEndKeepsForeignCheckbox();
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
  await testTagWheelApplyKeepsNeighbourTagWhenValueHasSlash();
  await testTagWheelOpensOnFirstFieldOfOrderEvenWhenItIsElement();
  await testTagWheelFirstFieldBeatsRulesDefaultFieldId();
  await testPanelRecognizesTheLineThePluginWroteItself();
  await testTextLineWithoutListMarkerKeepsOneSeparator();
  await testPanelShowsItsSeparatorOnBothSides();
  await testStatusDateKeepsManagedTagsInLeftBlock();
  testBuiltLineSurvivesParseAndBuild();
  testHeadingPrefixIsNotAValueZone();
  await testFieldCommandAsksPrerequisiteLikePanelDoes();
  await testRightBlockOnEmptyLineKeepsTextSlotOnBothPaths();
  await testStatusDateAsksBulletSettingLikeTagStepDoes();
  await testBulletSettingAnswersTheSameForPanelAndCommand();
  await testElementNowSpeaksTheHumanClockOnBothPaths();
  await testTagWheelKeepsElementInLeftBlockByOrder();
  await testStatusTagsRightOrderUsesRuntimeDateMarkerConfig();
  await testStatusTagsImportanceMinimalOffNoTrailingSeparator();
  await testStatusTagsImportanceMinimalOffPreservesListPrefixAndIndent();
  await testStatusTagsImportanceMinimalSeparatorOnPreservesCheckboxPrefix();
  await testStatusTagsMinimalOffRemovesSeparatorsForPrefixedSource();
  await testStatusTagsImportanceKeepsDependentAdjacencyAfterTagWheelApply();
  await testStatusTagsParentCycleClearsDependentSubtagSelection();
  await testStatusTagsOffPrefixTogglePreservesCheckboxWhenDisabled();
  await testStatusTagsOffPrefixToggleAddsBulletOnlyWhenThereIsNone();
  await testStatusTagsCycleFieldClientsRendersWikilinkToken();
  await testStatusTagsOffCycleEndClearsOwnCheckboxPrefix();
  await testStatusTagsImportanceHydrationUsesLastTokenOccurrence();
  await testStatusTagsClientsHydrationUsesLastTokenOccurrence();
  await testStatusTagsClientsRepeatedCycleDoesNotAccumulateDuplicates();
  await testStatusTagsKeepsBracketedTextThatIsNotCheckbox();
  await testStatusDateRepeatedStepKeepsOneValue();
  await testStatusDateKeepsWholeValueOfTwoWordFormat();
  await testStatusDateKeepsElementInItsOrderBlock();
  await testFailedNoticeReachesTheConsole();
  assertTrue(typeof runtime.runCommand === "function", "runtime exports runCommand");
  console.log("Status runtime behavior tests: OK");
}

/*
 * Отчёт о сбое, который не удалось показать, обязан уехать в консоль
 * (третий кусок В-97, 2026-09-10).
 *
 * **Что здесь проверяется поведением, а не текстом.** Правил с командой не
 * приехало, и движок обязан сказать об этом человеку. Показ сообщения при этом
 * отказывает: `Notice` платформы бросает. Прежде тут стоял пустой `catch`, и
 * человек оставался без результата **и** без причины — команда молча не делала
 * ничего. Теперь причина уезжает в журнал разработчика.
 *
 * **Отказ тот же, а повод другой** (2026-09-13): прежде поводом был
 * ненайденный файл правил, теперь — пустой ключ `Rules data`. Служебного файла
 * движки не читают вовсе, и «файла нет» перестало быть случаем, который
 * возможен (У-94).
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
      /* Ключа `Rules data` здесь нет нарочно: это и есть отказ. */
      settings: {
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
  assertTrue(/No rules came with the command/.test(said),
    "в консоль уехало что-то другое, а не само сообщение об отсутствии правил:\n"
    + "  " + JSON.stringify(said.slice(0, 200)));
}

if (require.main === module) {
  run().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
