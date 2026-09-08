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

function makeConfig(overrides, pkmExtra) {
  const i2n = {
    enabled: true,
    outputFolder: "Notes",
    defaultTemplate: "",
    smartRules: [],
    noteName: { mode: "auto", delimiters: "[]", wordCount: 6, preferHeaderTitle: true },
    nameCollision: { mode: "new_note" },
    placement: { position: "end", headerMode: "none", customHeader: "", datetimeFormat: "YYYY-MM-DD" },
    sourceProcessing: { cleanupFieldIds: [], token: "", panel: "right", replaceWithLink: true },
    sublines: "stay",
    ...(overrides || {}),
  };
  return {
    features: { transform: { enabled: true } },
    transform: { inline2note: i2n },
    pkm: {
      lineFormat: { separator1: "::", separator2: "::" },
      ...(pkmExtra || {}),
      fields: (pkmExtra && pkmExtra.fields) || { order: { left: [], right: [], active: {}, enabled: {}, types: {}, propertiesByField: {} }, tags: { fields: [] }, links: { fields: [] } },
    },
  };
}

/**
 * Конфиг с настоящими Fields: без них уборка Values не находит ни одного
 * совпадения и левый сегмент со строки не уходит — то есть предмет проверки не
 * возникает вовсе, а проверка при этом зелёная (У-88).
 */
function makeFieldsConfig() {
  return {
    /* Правила префикса — как у заказчика: без них общий сборщик префикса не
       зовётся вовсе, и маркер списка на схлопнутой строке не возвращается. */
    prefixRules: {
      checkboxByFieldValue: { type: { "#todo": "[ ]" } },
      resolver: "priority-first",
      priorityTargets: ["type"],
      priorityMode: "by-section",
    },
    fields: {
      order: {
        left: ["type", "Category", "Project"], right: [], active: {}, enabled: {},
        types: { type: "tag", Category: "tag", Project: "wikilink" },
        propertiesByField: {},
      },
      tags: {
        fields: [
          { id: "type", prefix: "#", values: [{ token: "#todo" }] },
          { id: "Category", prefix: "#", values: [{ token: "#work" }, { token: "#new" }] },
        ],
      },
      links: { fields: [{ id: "Project", type: "wikilink", values: [{ token: "test1" }] }] },
    },
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
  /* Ходы `process`: по ним видно, что правка собрана из прочитанного. */
  const processCalls = [];
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
    /*
     * `Vault.process` — то же, что у платформы: читает, отдаёт функции и
     * пишет её ответ **одним ходом** (правило каталога Obsidian, Р8).
     *
     * Заглушка обязана вести себя так же, а не проще: если бы она просто
     * писала то, что ей передали, ветка «правка собирается из прочитанного»
     * осталась бы непроверенной, а именно она и отличает `process` от
     * `modify`. Заглушка не бывает добрее браузера (У-45).
     */
    async process(file, fn) {
      const before = String(files.get(file.path) || "");
      const after = String(fn(before));
      files.set(file.path, after);
      processCalls.push({ path: file.path, before, after });
      return after;
    },
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
    processCalls,
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
  const plugin = makePlugin(makeConfig({ sourceProcessing: { cleanupFieldIds: [], token: "#done", panel: "right", replaceWithLink: false } }), editor);
  await transform.runInline2Note(plugin, { lineFinalize });
  assertEq(editor.text(), "- [ ] :: Keep me :: #done", "replaceWithLink false preserves payload and inserts processed token");
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
    placement: { position: "end", headerMode: "custom", customHeader: "### Custom", datetimeFormat: "YYYY" },
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

/**
 * T1 целиком: от команды до строки в заметке (замечание заказчика 2026-09-07).
 *
 * Проверка сквозная не для красоты: правка живёт в двух местах — в самой
 * `applySourceTextFate` и в том, что место вызова спрашивает у
 * `resolveAutoTitleInfo`, откуда взялось название. Единичная проверка зелена и
 * тогда, когда второе забыли, — а тогда правка недостижима (У-56).
 */
async function testTitleWordsReplacedByLink() {
  const line = "- :: тест-трансформ4 тест1 тест2 тест3 тест4 тест5 тест6 :: \u{1F4C5}2026-09-07 13:27";
  const editor = makeEditor(line);
  const plugin = makePlugin(makeConfig({
    sourceProcessing: { cleanupFieldIds: [], token: "#processed", panel: "right", replaceWithLink: true, text: "words", keepWords: 2 },
  }), editor);
  await transform.runInline2Note(plugin, { lineFinalize });
  assertTrue(plugin.files.has("Notes/тест-трансформ4 тест1 тест2 тест3 тест4 тест5.md"),
    "заметка названа первыми шестью словами: " + Array.from(plugin.files.keys()).join(", "));
  assertEq(editor.text(),
    "- :: [[Notes/тест-трансформ4 тест1 тест2 тест3 тест4 тест5]] тест6 :: \u{1F4C5}2026-09-07 13:27 #processed",
    "ссылка встала на место слов названия, остаток текста остался на строке");
  /* Слова названия — текст человека, и в заметку они уезжают целиком: имя
     заметки их повторяет, а содержимым остаются они же. */
  const note = String(plugin.files.get("Notes/тест-трансформ4 тест1 тест2 тест3 тест4 тест5.md"));
  assertTrue(note.includes("тест6"), "в заметку уехала вся строка, вместе с остатком: " + note);
  assertTrue(note.includes("тест-трансформ4"), "и вместе со словами, ставшими названием: " + note);
}

/**
 * `leave` не тронут: слова названия — это текст, и человек попросил его
 * оставить. Обратное молча отменило бы смысл настройки.
 */
async function testTitleWordsSurviveLeave() {
  const editor = makeEditor("- :: one two three :: tail");
  const plugin = makePlugin(makeConfig({
    sourceProcessing: { cleanupFieldIds: [], token: "", panel: "right", replaceWithLink: true, text: "leave" },
  }), editor);
  await transform.runInline2Note(plugin, { lineFinalize });
  assertEq(editor.text(), "- :: one two three [[Notes/one two three]] :: tail",
    "при `leave` текст остаётся целиком, ссылка идёт за ним");
}

/**
 * Третье положение целиком, от команды до строки (решение В-78, 2026-09-07).
 *
 * Сквозная не для красоты: значение приходит из конфига, а нормализация
 * значений и разбор их в движке — два разных списка. Разойдутся — положение
 * будет в панели и не будет в заметке.
 */
async function testLeaveNamedKeepsRestAndSwapsName() {
  const editor = makeEditor("- :: one two three four five six seven :: tail");
  const plugin = makePlugin(makeConfig({
    sourceProcessing: { cleanupFieldIds: [], token: "", panel: "right", replaceWithLink: true, text: "leave_named" },
  }), editor);
  await transform.runInline2Note(plugin, { lineFinalize });
  assertTrue(plugin.files.has("Notes/one two three four five six.md"),
    "заметка названа первыми шестью словами: " + Array.from(plugin.files.keys()).join(", "));
  assertEq(editor.text(), "- :: [[Notes/one two three four five six]] seven :: tail",
    "ссылка встала на место названия, остаток текста цел и не обрезан");
}

/**
 * Строка заказчика к T4, 2026-09-07 вечер (дефект A39).
 *
 *   было    `- [ ] #todo #work #new [[test1]] :: ывыв ывы :: 📅2026-09-07 18:56`
 *   стало   `- ывыв ывы :: 📅2026-09-07 18:56 [[333/ывыв ывы]] :: #processed`
 *
 * Уборка снимает **весь** левый сегмент, пустой слот схлопывается — и
 * Separator у строки остаётся один, тот, что стоит между текстом и правой
 * частью. Три шага ниже разбирали строку заново и читали её наоборот: текст
 * как левый сегмент, правую часть как текст. Ссылка вставала за дату, а метка
 * дописывалась через ещё один Separator.
 *
 * Проверка **сквозная**: знание о слотах живёт не в функции, а в том, кто её
 * зовёт, — единичная проверка `applySourceTextFate` зелена и тогда, когда
 * знание забыли передать (У-56). Разделители здесь одинаковые (`::` и `::`,
 * умолчание и выбор заказчика): при разных строку ещё можно разобрать буквами,
 * при одинаковых — нельзя ничем, кроме этого знания.
 */
async function testCleanedLeftSegmentKeepsTextAndTailApart() {
  const line = "- [ ] #todo #work #new [[test1]] :: ывыв ывы :: \u{1F4C5}2026-09-07 18:56";
  const runWith = async (text) => {
    const editor = makeEditor(line);
    const plugin = makePlugin(makeConfig({
      outputFolder: "333",
      noteName: { mode: "auto", delimiters: "[]", wordCount: 4, preferHeaderTitle: true },
      sourceProcessing: { cleanupFieldIds: [], token: "#processed", panel: "right", replaceWithLink: true, text, keepWords: 2 },
    }, makeFieldsConfig()), editor);
    await transform.runInline2Note(plugin, { lineFinalize });
    return editor.text();
  };

  assertEq(await runWith("words"),
    "- [[333/ывыв ывы]] :: \u{1F4C5}2026-09-07 18:56 #processed",
    "дата осталась правой частью, ссылка встала на место текста, метка не завела второй Separator");

  /*
   * То же положение с другой стороны: при `leave` текст остаётся, и ссылка
   * обязана встать **за ним**, а не за датой. Одной строки мало — обе ветки
   * склейки читают один и тот же разбор, и ошибка в нём видна только там, где
   * текст не пуст.
   */
  assertEq(await runWith("leave"),
    "- ывыв ывы [[333/ывыв ывы]] :: \u{1F4C5}2026-09-07 18:56 #processed",
    "текст остался на своём слоте, дата — на своём");
}

/** Метка `#processed` в левой панели: слота больше нет, и она заводит его заново. */
async function testProcessedTokenLeftPanelAfterCleanedLeftSegment() {
  const editor = makeEditor("- [ ] #todo :: text words :: tail");
  const plugin = makePlugin(makeConfig({
    sourceProcessing: { cleanupFieldIds: [], token: "#processed", panel: "left", replaceWithLink: false, text: "leave" },
  }, makeFieldsConfig()), editor);
  await transform.runInline2Note(plugin, { lineFinalize });
  assertEq(editor.text(), "- #processed :: text words :: tail",
    "метка встала в левый слот, а не в текст");
}

/**
 * Р8 правил каталога: правка чужой заметки идёт **одним ходом** `Vault.process`,
 * и текст собирается из прочитанного, а не приходит готовым.
 *
 * **Зачем это отдельной проверкой.** Прежний ход был `read`, потом `modify`, и
 * поведение у него на первый взгляд то же: заметка получает нужный текст. Что
 * изменилось, видно только в двух местах, и оба здесь.
 *
 *   1. **Дописывание собирается внутри хода.** `process` отдаёт функции то, что
 *      лежит в файле сейчас; если бы правка приходила готовой строкой, чужая
 *      правка между чтением и записью пропала бы.
 *   2. **Откат возвращает то, что мы перезаписали.** Прежнее содержимое
 *      запоминается внутри того же хода, а не читается заранее.
 *
 * Спрашивается у заглушки, которая ведёт себя как платформа: она записывает
 * каждый ход вместе с тем, что было до него.
 */
async function testForeignNoteWrittenByProcessFromWhatWasRead() {
  const editor = makeEditor("- [ ] :: Дописать");
  const config = makeConfig({
    nameCollision: { mode: "add_to_note" },
    placement: { position: "end", headerMode: "none", customHeader: "", datetimeFormat: "YYYY" },
  });
  const plugin = makePlugin(config, editor, {
    initialFiles: { "Notes/Дописать.md": "старое тело заметки" },
  });
  await transform.runInline2Note(plugin, { lineFinalize });

  const calls = plugin.processCalls;
  assertEq(calls.length, 1, "правка чужой заметки прошла одним ходом process");
  assertEq(calls[0].path, "Notes/Дописать.md", "и по тому пути, который выбран");
  assertEq(calls[0].before, "старое тело заметки", "ходу отдано то, что лежало в файле");
  assertTrue(calls[0].after.indexOf("старое тело заметки") === 0,
    "новое содержимое собрано из прочитанного, а не пришло готовым: " + calls[0].after);
  assertTrue(calls[0].after.length > calls[0].before.length,
    "дописанное и правда дописалось");
  assertEq(plugin.files.get("Notes/Дописать.md"), calls[0].after,
    "на диске то же, что вернул ход");
}

/**
 * И откат: он возвращает содержимое, запомненное **внутри** хода записи.
 *
 * Тот же приём, что у соседней проверки отката перезаписи, но спрашивается
 * другое: сколько ходов было и что каждый из них увидел. Прежний порядок
 * (`read` до записи) дал бы то же итоговое содержимое — и не отличался бы.
 */
async function testRollbackRestoresWhatProcessSaw() {
  const editor = makeEditor("- [ ] :: Откат", { failReplace: true });
  const config = makeConfig({ nameCollision: { mode: "overwrite" } });
  const plugin = makePlugin(config, editor, {
    initialFiles: { "Notes/Откат.md": "исходное" },
  });
  try { await transform.runInline2Note(plugin, { lineFinalize }); } catch (_) { /* уборка: отказ строки нас тут не интересует */ }

  const calls = plugin.processCalls;
  assertEq(calls.length, 2, "ходов было два: запись и откат");
  assertEq(calls[0].before, "исходное", "первый ход увидел то, что лежало в файле");
  assertEq(calls[1].after, "исходное", "второй вернул ровно это");
  assertEq(plugin.files.get("Notes/Откат.md"), "исходное", "и на диске снова исходное");
}

/* ====================================================================== */
/* Положение `At custom header` (задача заказчика З-4)                     */
/* ====================================================================== */

/*
 * Проверки зовут **те же функции**, что и движок (У-4): `composeBodyWithPlacement`
 * для новой заметки и `appendBlockIntoNote` для дописывания в существующую.
 * Правило укладки одно на оба пути, и проверяются оба: положение, доехавшее
 * только до новых заметок, — это ровно тот дефект, ради которого разбор
 * назвал второе место.
 */

function i2nAtHeader(targetHeader, fallback) {
  return {
    placement: {
      position: "custom-header",
      headerMode: "none",
      customHeader: "",
      datetimeFormat: "YYYY-MM-DD",
      headerLevel: "0",
      targetHeader: String(targetHeader || ""),
      fallback: String(fallback || "end"),
    },
  };
}

const NOTE_WITH_SECTIONS = [
  "intro line",
  "",
  "## Log",
  "- first entry",
  "- second entry",
  "",
  "## Other",
  "- not mine",
].join("\n");

function runCustomHeaderPlacementSuite() {
  /* 1. Заголовок найден: блок ложится в конец его секции, а не под строку. */
  {
    const out = transform.composeBodyWithPlacement(NOTE_WITH_SECTIONS, "- new entry", i2nAtHeader("## Log"), "\n");
    assertEq(out, [
      "intro line",
      "",
      "## Log",
      "- first entry",
      "- second entry",
      "",
      "- new entry",
      "",
      "## Other",
      "- not mine",
    ].join("\n"), "запись ложится в конец секции названного заголовка");
  }

  /* 2. Без решёток годится заголовок любого уровня. */
  {
    const out = transform.composeBodyWithPlacement(NOTE_WITH_SECTIONS, "- new entry", i2nAtHeader("log"), "\n");
    assertTrue(out.indexOf("- second entry\n\n- new entry") >= 0,
      "имя без решёток находит заголовок любого уровня, и регистр не важен");
  }

  /* 3. С решётками — только заголовок этой глубины. */
  {
    const out = transform.composeBodyWithPlacement(NOTE_WITH_SECTIONS, "- new entry", i2nAtHeader("### Log", "end"), "\n");
    assertTrue(out.trimEnd().endsWith("- new entry"),
      "`### Log` не находит заголовок второго уровня и уходит в запасное положение");
  }

  /* 4. Заголовок последней строкой заметки: секция пуста, блок встаёт под ним. */
  {
    const out = transform.composeBodyWithPlacement("intro\n\n## Log", "- new entry", i2nAtHeader("## Log"), "\n");
    assertEq(out, "intro\n\n## Log\n\n- new entry", "секция без содержимого получает запись сразу под заголовком");
  }

  /* 5. Два одноимённых заголовка — берётся первый. */
  {
    const twice = ["## Log", "- one", "", "## Log", "- two"].join("\n");
    const out = transform.composeBodyWithPlacement(twice, "- new entry", i2nAtHeader("## Log"), "\n");
    assertEq(out, ["## Log", "- one", "", "- new entry", "", "## Log", "- two"].join("\n"),
      "из двух одноимённых заголовков берётся первый");
  }

  /* 6. Заголовка нет: оба запасных положения. */
  {
    const noHeader = "intro line\n\n- something";
    const atEnd = transform.composeBodyWithPlacement(noHeader, "- new entry", i2nAtHeader("## Log", "end"), "\n");
    assertEq(atEnd, "intro line\n\n- something\n\n- new entry", "заголовка нет, запасное положение — конец");
    const atStart = transform.composeBodyWithPlacement(noHeader, "- new entry", i2nAtHeader("## Log", "beginning"), "\n");
    assertEq(atStart, "- new entry\n\nintro line\n\n- something", "заголовка нет, запасное положение — начало");
  }

  /* 7. Имя не задано вовсе — то же, что «не найден». */
  {
    const out = transform.composeBodyWithPlacement(NOTE_WITH_SECTIONS, "- new entry", i2nAtHeader("", "beginning"), "\n");
    assertTrue(out.startsWith("- new entry"), "пустое имя заголовка работает как запасное положение");
  }

  /* 8. Строка над текстом не отменяется: заголовок блока ложится внутрь секции. */
  {
    const withHead = {
      placement: {
        ...i2nAtHeader("## Log").placement,
        headerMode: "custom",
        customHeader: "Captured",
        headerLevel: "3",
      },
    };
    const out = transform.composeBodyWithPlacement(NOTE_WITH_SECTIONS, "- new entry", withHead, "\n");
    assertTrue(out.indexOf("- second entry\n\n### Captured\n- new entry") >= 0,
      "`Line above the text` продолжает работать и внутри найденной секции");
  }

  /* ---- дописывание в существующую заметку ---- */

  /* 9. Тот же путь у `Add to the existing one`. */
  {
    const before = "---\ntags: [a]\n---\n" + NOTE_WITH_SECTIONS + "\n";
    const out = transform.appendBlockIntoNote(before, "- new entry", i2nAtHeader("## Log"), "\n");
    assertTrue(out.startsWith("---\ntags: [a]\n---\n"), "frontmatter существующей заметки не тронут");
    assertTrue(out.indexOf("- second entry\n\n- new entry") >= 0,
      "дописывание в существующую заметку тоже ложится в конец секции");
  }

  /* 10. Решётки внутри frontmatter заголовками не считаются. */
  {
    const before = "---\nnote: '## Log'\n---\n\n- plain text\n";
    const out = transform.appendBlockIntoNote(before, "- new entry", i2nAtHeader("## Log", "beginning"), "\n");
    assertTrue(out.startsWith("---\nnote: '## Log'\n---\n"),
      "строка внутри frontmatter не принимается за заголовок");
    assertTrue(out.indexOf("---\n\n- new entry") >= 0 || out.indexOf("---\n- new entry") >= 0,
      "запасное положение `начало` считается от тела, а не от файла");
  }

  /* 11. Остальные два положения при дописывании работают как работали. */
  {
    const before = "## Log\n- first entry\n";
    const asBefore = transform.appendBlockIntoNote(before, "- new entry", { placement: { position: "beginning" } }, "\n");
    assertEq(asBefore, "## Log\n- first entry\n\n- new entry\n",
      "дописывание всегда шло в конец, и `At the beginning` этого не менял");
  }

  /* 12. Нормализация знает новое значение и обе новые строки. */
  {
    const normalized = transform.normalizeInline2Note({
      placement: { position: "custom-header", targetHeader: "  ## Log  ", fallback: "beginning" },
    });
    assertEq(normalized.placement.position, "custom-header",
      "`custom-header` — законное значение положения");
    assertEq(normalized.placement.targetHeader, "## Log",
      "имя заголовка чистится от пробелов, но решётки остаются: ими задан уровень");
    assertEq(normalized.placement.fallback, "beginning",
      "запасное положение переживает нормализацию");
    const empty = transform.normalizeInline2Note({});
    assertEq(empty.placement.targetHeader, "", "имя заголовка по умолчанию пусто");
    assertEq(empty.placement.fallback, "end", "запасное положение по умолчанию — конец");
  }

  console.log("  ok  положение `At custom header` (З-4)");
}

/*
 * Шов: настройка доезжает от конфига до самой заметки.
 *
 * Проверка зовёт **настоящую** запись `writeInline2Note` с поддельным vault:
 * подделан только он, потому что другого способа позвать запись вне Obsidian
 * нет (У-1). Без этой проверки «положение до записи не доехало» не краснело
 * бы нигде: чистые функции выше о том, кто их зовёт, не знают (У-56).
 */
async function testCustomHeaderReachesTheWrittenNote() {
  const before = ["## Log", "- first entry", "", "## Other", "- not mine"].join("\n") + "\n";
  let written = "";
  const file = { path: "Notes/Log.md" };
  const plugin = {
    app: {
      vault: {
        getAbstractFileByPath: (p) => (p === file.path ? file : null),
        process: async (af, fn) => { written = fn(written || before); return written; },
      },
    },
  };
  const i2n = i2nAtHeader("## Log");
  await transform.writeInline2Note(
    plugin,
    { mode: "add_to_note", path: file.path, exists: true },
    "не используется на этом пути",
    "- new entry",
    i2n);
  assertEq(written, ["## Log", "- first entry", "", "- new entry", "", "## Other", "- not mine"].join("\n") + "\n",
    "положение доезжает до записи в существующую заметку");
}

async function run() {
  await testNewNoteRaceUsesActualPathLink();
  await testReplacePayloadFalse();
  await testSourceFailureRollsBackCreatedTarget();
  await testSourceFailureRestoresOverwrittenTarget();
  await testStaleEditorStopsBeforeTargetMutation();
  await testAddToNoteDoesNotDuplicateTemplateOrHeader();
  await testForeignNoteWrittenByProcessFromWhatWasRead();
  await testRollbackRestoresWhatProcessSaw();
  await testTemplateErrorSurfacesBeforeMutation();
  await testManualCancelDoesNotMutate();
  await testTitleWordsReplacedByLink();
  await testTitleWordsSurviveLeave();
  await testLeaveNamedKeepsRestAndSwapsName();
  await testCleanedLeftSegmentKeepsTextAndTailApart();
  await testProcessedTokenLeftPanelAfterCleanedLeftSegment();
  runCustomHeaderPlacementSuite();
  await testCustomHeaderReachesTheWrittenNote();
  console.log("Transform runtime regression tests: OK");
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
