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
    /*
     * Папка шаблонов названа, и без неё фикстура незаконна (У-38): с 2026-09-16
     * выбранный шаблон, не лежащий в назначенной папке, снимается нормализацией
     * (В-127), и `defaultTemplate: "Templates/Missing.md"` при пустой папке
     * означал бы «шаблон не выбран» — то есть проверка отказа при ненайденном
     * шаблоне проверяла бы отсутствие предмета.
     */
    templatesFolder: "Templates",
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
  let cursor = null;
  return {
    getCursor(which) {
      if (cursor) return { line: cursor.line, ch: cursor.ch };
      return which === "to" ? { line: 0, ch: lines[0].length } : { line: 0, ch: 0 };
    },
    /*
     * **Каретка у подделки есть, потому что она есть у платформы** (У-45).
     * Без неё не видно, куда Transform ставит курсор, — а он его ставит с
     * 2026-09-18 по его замечанию: «после transform курсор стоит в начале
     * строки, а должен в конце текста».
     */
    setCursor(pos) { cursor = { line: Number(pos && pos.line || 0), ch: Number(pos && pos.ch || 0) }; },
    cursorNow() { return cursor ? { line: cursor.line, ch: cursor.ch } : null; },
    somethingSelected() { return false; },
    getLine(n) { return lines[n] || ""; },
    lineCount() { return lines.length; },
    /*
     * Замена считается **по смещениям в тексте**, а не строками.
     *
     * Прежняя заглушка на многострочной замене выбрасывала строки от `from.line`
     * по `to.line` включительно и `to.ch` не смотрела вовсе — то есть съедала
     * на строку больше, чем платформа: у CodeMirror конец `{line: N, ch: 0}`
     * означает **начало** строки `N`, и сама она уцелеет. Видно это стало на
     * первой же проверке, где за снятым блоком стоит ещё текст (У-45: заглушка
     * не бывает ни добрее, ни строже настоящего редактора).
     */
    replaceRange(value, from, to) {
      if (opts.failReplace) throw new Error("editor write failed");
      const text = lines.join("\n");
      const offsetOf = (pos) => {
        const line = Math.max(0, Math.min(lines.length - 1, Number(pos && pos.line || 0)));
        let at = 0;
        for (let i = 0; i < line; i++) at += lines[i].length + 1;
        return at + Math.max(0, Math.min(lines[line].length, Number(pos && pos.ch || 0)));
      };
      lines = (text.slice(0, offsetOf(from)) + String(value) + text.slice(offsetOf(to))).split("\n");
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
      /*
       * Подделка резолвера ссылок. Правило у неё **списано у платформы**, а не
       * выведено из смысла слова (У-170): Obsidian ищет сперва точный путь, и
       * только потом файл с таким именем в любой папке. Ответ `null` — это
       * ответ: заметки с таким именем в vault нет.
       */
      metadataCache: {
        getFirstLinkpathDest(linkpath) {
          const wanted = String(linkpath || "").trim().replace(/\.md$/i, "");
          if (!wanted) return null;
          const notes = [...files.keys()].filter((key) => typeof files.get(key) === "string");
          for (const key of notes) {
            if (key.replace(/\.md$/i, "") === wanted) return { path: key };
          }
          for (const key of notes) {
            if (key.replace(/\.md$/i, "").replace(/^.*\//, "") === wanted) return { path: key };
          }
          return null;
        },
      },
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

/**
 * Откат **дописывания** в существующую заметку.
 *
 * Ревизия 2026-09-14 (строка Д4) сняла покрытие настоящим прогоном: из четырёх
 * замыканий отката набор исполнял **два** — создание новой заметки и
 * перезапись. Дописывание и создание при `add_to_note` не исполнял ни один
 * прогон, а цена отказа здесь дороже всего: заметка человека остаётся с
 * дописанным блоком, которого он не просил, и об этом никто не говорит.
 *
 * Мера не «файл цел», а **равенство тому, что в нём лежало**: дописывание
 * меняет содержимое в середине, и «непусто» было бы правдой и при половине
 * отката.
 */
async function testSourceFailureRestoresAppendedNote() {
  const editor = makeEditor("- [ ] :: Дописать", { failReplace: true });
  const config = makeConfig({ nameCollision: { mode: "add_to_note" } });
  const plugin = makePlugin(config, editor, {
    initialFiles: { "Notes/Дописать.md": "было до нас\n" },
  });
  try { await transform.runInline2Note(plugin, { lineFinalize }); } catch (_) {
    /* Уборка: отказ правки строки здесь и есть условие проверки. */
  }
  const calls = plugin.processCalls;
  assertEq(calls.length, 2, "ходов было два: дописывание и откат");
  assertTrue(calls[0].after.length > calls[0].before.length,
    "положительный контроль: дописывание и правда что-то добавило");
  assertEq(plugin.files.get("Notes/Дописать.md"), "было до нас\n",
    "заметка после отката не равна тому, что в ней лежало");
}

/**
 * Откат создания заметки, которой ещё не было, при режиме `add_to_note`.
 *
 * Дописывать не во что — плагин создаёт заметку, и тогда откат обязан её
 * убрать. Ветка эта отдельная от `new_note`, и её не исполнял ни один прогон.
 */
async function testSourceFailureRemovesNoteCreatedForAppend() {
  const editor = makeEditor("- [ ] :: Создать", { failReplace: true });
  const config = makeConfig({ nameCollision: { mode: "add_to_note" } });
  const plugin = makePlugin(config, editor);
  let message = "";
  try { await transform.runInline2Note(plugin, { lineFinalize }); } catch (error) {
    message = String(error.message || error);
  }
  assertTrue(/rolled back/.test(message), "об откате сказано вслух");
  assertEq(plugin.files.has("Notes/Создать.md"), false,
    "созданная под дописывание заметка после отказа осталась на диске");
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
/**
 * Строка-заголовок целиком, от имени заметки до того, что осталось в исходной
 * (замечание заказчика 2026-09-16, решения В-128 и В-129).
 *
 * Его слова: «при активации inline2note из хедера получилась ерунда — название
 * заметки стало полностью содержание исходной инлайн записи, включая
 * технические блоки; содержание исходного хедера не переместилось в новую
 * заметку». Ответ на второе он дал сам: «весь раздел под заголовком», и тем же
 * словом — «исходная строка-хедер должна преобразовываться в строку-буллит».
 *
 * Проверка **сквозная** нарочно: имя считает один код, границу блока второй,
 * знак начала третий, и по отдельности каждый зелен на своей фикстуре (У-56).
 */
async function testHeaderLineTakesItsSectionAndBecomesBullet() {
  const editor = makeEditor([
    "## #/1 #todo :: Отчёт за неделю :: \u{1F4C5}2026-09-16 17:58",
    "Первая строка раздела",
    "\tвложенная строка",
    "",
    "### Внутренний заголовок",
    "и его строка",
    "## Следующий раздел",
    "чужая строка",
  ].join("\n"));
  /*
   * Поле-элемент с меткой `📅` объявлено нарочно: без него метка даты для
   * разбора не значение, а обычный текст, и утверждение «технические блоки не
   * попали в имя» проверяло бы отсутствие предмета (У-88). У заказчика такое
   * поле есть — `date_due` с этой самой меткой и этим форматом.
   */
  const plugin = makePlugin(makeConfig({
    sublines: "remove",
    noteName: { mode: "auto", delimiters: "[]", wordCount: 6, preferHeaderTitle: true },
    sourceProcessing: { cleanupFieldIds: [], token: "", panel: "right", replaceWithLink: true, text: "words", keepWords: 2 },
  }, {
    fields: {
      order: {
        left: [], right: ["date_due"], active: {}, enabled: {},
        types: { date_due: "element" }, propertiesByField: {},
      },
      elements: { byField: { date_due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD hh:mm" } } },
      tags: { fields: [] },
      /* Поле-элемент объявляется там же, где его объявил заказчик: метки
         движок собирает обходом самих Fields, а не ветки `elements`. */
      links: { fields: [{ id: "date_due", kind: "genericElement", marker: "\u{1F4C5}", format: "YYYY-MM-DD hh:mm" }] },
    },
  }), editor);
  await transform.runInline2Note(plugin, { lineFinalize });

  /* Имя — текст заголовка, без значений полей и без метки даты. */
  assertTrue(plugin.files.has("Notes/Отчёт за неделю.md"),
    "заметка названа текстом заголовка: " + Array.from(plugin.files.keys()).join(", "));
  const note = String(plugin.files.get("Notes/Отчёт за неделю.md") || "");
  assertTrue(/Первая строка раздела/.test(note), "первая строка раздела уехала в заметку");
  assertTrue(/Внутренний заголовок/.test(note), "младший заголовок — часть того же раздела");
  /*
   * Граница раздела: заголовок того же уровня и всё за ним остаются на месте.
   * Без этого утверждения правило выполнял бы и обход «до конца заметки», а
   * тогда одно нажатие уносило бы всю заметку целиком.
   */
  assertTrue(!/Следующий раздел/.test(note), "следующий раздел в заметку не уехал");
  assertTrue(!/чужая строка/.test(note), "и его строки тоже");

  const left = editor.text().split("\n");
  /*
   * Утверждения про **знак начала и ссылку**, а не про строку целиком.
   * Строка целиком сюда не годится: значения полей с неё уносит отдельный
   * давний дефект (`📅…` пропадает и с обычной строки при пустом списке
   * `cleanupFieldIds`; воспроизведено на коммите `73beb1d`, то есть он старше
   * этой сессии). Записать его ожиданием значило бы охранять дефект, а чинить
   * его здесь — чинить не то, о чём эта проверка.
   */
  assertTrue(left[0].startsWith("- "), "на месте заголовка знак списка: " + JSON.stringify(left[0]));
  assertTrue(!/^#/.test(left[0]), "знака заголовка на строке не осталось");
  assertTrue(left[0].includes("[[Notes/Отчёт за неделю]]"), "и ссылка на новую заметку");
  assertEq(left[1], "## Следующий раздел", "следующий раздел остался в заметке нетронутым");
  assertEq(left[2], "чужая строка", "и его содержимое");
  assertEq(left.length, 3, "раздел уехал целиком: " + JSON.stringify(editor.text()));
}

/**
 * Отрицательный контроль к правилу раздела: у обычной строки своим остаётся
 * записанное **с отступом**, а соседняя строка без отступа — чужая. Без него
 * утверждения выше выполнял бы и обход, забирающий всё до конца заметки у
 * любой строки (У-127: контроль ставится на предмете, который есть всегда).
 */
async function testPlainLineStillTakesOnlyIndentedLines() {
  const editor = makeEditor([
    "- :: Отчёт :: tail",
    "\tвложенная",
    "соседняя без отступа",
  ].join("\n"));
  const plugin = makePlugin(makeConfig({
    sublines: "remove",
    sourceProcessing: { cleanupFieldIds: [], token: "", panel: "right", replaceWithLink: true, text: "words", keepWords: 2 },
  }), editor);
  await transform.runInline2Note(plugin, { lineFinalize });
  const note = String(plugin.files.get("Notes/Отчёт.md") || "");
  assertTrue(/вложенная/.test(note), "вложенная строка уехала");
  assertTrue(!/соседняя без отступа/.test(note), "строка без отступа осталась");
  const left = editor.text().split("\n");
  assertEq(left[left.length - 1], "соседняя без отступа", "и стоит на месте");
  assertTrue(!/^#/.test(left[0]), "знак списка у обычной строки не менялся");
}

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
 * **Метка слева встаёт за началом строки, каким бы оно ни было** — его
 * замечание 2026-09-18: «в хедере при `source-marker-position = left block`
 * получилось `#processed ## [[ыва ыфва]]`, ожидалось `- #processed :: [[ыва
 * ыфва]]`; и при трансформации нумерованной — `#processed 1. [[123111]]`
 * вместо `1. #processed :: [[123111]]`».
 *
 * Прежний образец начала строки знал дефис, звёздочку, плюс и чекбокс за ними
 * — и не знал ни номера списка, ни знака заголовка, ни цитаты: метка вставала
 * **перед** ними, то есть внутрь чужой разметки (У-184). И первого разделителя
 * между меткой и текстом не появлялось вовсе.
 *
 * **Спрашивается само правило, а не весь ход `Inline to note`:** судьба текста
 * и имя новой заметки решаются другими настройками, и проверка через весь ход
 * говорила бы о них, а не о метке. Формы стоят все пять — на одной дефекта не
 * видно (У-113).
 */
function testProcessedTokenLeftPanelKeepsLineStart() {
  const separators = { separator1: "::", separator2: "::" };
  const cfg = makeConfig({}, makeFieldsConfig());
  const left = (line) => transform.insertProcessedToken(line, "#processed", "left", separators, { payloadFirst: false }, cfg);
  const right = (line) => transform.insertProcessedToken(line, "#processed", "right", separators, { payloadFirst: false }, cfg);

  assertEq(left("1. [[123111]]"), "1. #processed :: [[123111]]",
    "номер списка остался началом строки, метка встала за ним");
  assertEq(left("## [[ыва ыфва]]"), "## #processed :: [[ыва ыфва]]",
    "знак заголовка остался началом строки (в список его превращает следующий шаг, В-129)");
  assertEq(left("- [ ] [[123111]]"), "- [ ] #processed :: [[123111]]",
    "знак задачи пережил метку");
  assertEq(left("> - [[123111]]"), "> - #processed :: [[123111]]",
    "цитата пережила метку");
  assertEq(left("* [[123111]]"), "* #processed :: [[123111]]",
    "звёздочка — такой же знак списка, как дефис");

  /* Контроль: правый Block собирается по-своему и правкой не тронут (У-164). */
  assertEq(right("1. [[123111]]"), "1. [[123111]] :: #processed",
    "метка справа стоит за разделителем, как и стояла");
}

/**
 * **Курсор после `Inline to note` стоит в конце текста** — его замечание
 * 2026-09-18: «после transform на исходной строке курсор стоит `|- [[13]] ::
 * #/1 #processed`, а должен был `- [[13]]| :: #/1 #processed`».
 *
 * Строка переписывается целиком, от нулевого столбца, и платформа оставляет
 * каретку там же, где кусок начался. Проверка идёт **через весь ход**: ставит
 * курсор тот, кто пишет строку, и подделка редактора умеет его запомнить (У-45).
 */
async function testCursorStandsAtEndOfTextAfterTransform() {
  const editor = makeEditor("- ывыв ывы :: \u{1F4C5}2026-09-07 18:56");
  const plugin = makePlugin(makeConfig({
    sourceProcessing: { cleanupFieldIds: [], token: "#processed", panel: "right", replaceWithLink: true, text: "words", keepWords: 2 },
  }, makeFieldsConfig()), editor);
  await transform.runInline2Note(plugin, { lineFinalize });

  const line = editor.text();
  const at = editor.cursorNow();
  assertTrue(!!at, "курсор поставлен, а не оставлен там, где был");
  assertEq(at.line, 0, "и на той же строке");
  /*
   * Ожидание выписано текстом, а не вычислено тем же правилом, каким ставится
   * курсор: иначе проверка сверяла бы правило само с собой (У-5). Строка
   * выходит `- ывыв ывы :: [[Notes/…]] :: #processed`, и слот текста здесь —
   * ссылка между разделителями: курсор обязан стоять сразу за ней, а не в
   * начале строки и не за меткой.
   */
  const upToCursor = line.slice(0, at.ch);
  assertTrue(/\]\]$/.test(upToCursor),
    "курсор стоит сразу за текстом: " + JSON.stringify(line) + ", до курсора " + JSON.stringify(upToCursor));
  assertEq(line.slice(at.ch), " :: #processed",
    "а за курсором остаётся только правый Block: " + JSON.stringify(line.slice(at.ch)));
  assertTrue(at.ch > 0, "и это не нулевой столбец, с которого начиналась запись");
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
    assertTrue(out.trimEnd().endsWith("### Log\n- new entry"),
      "`### Log` не находит заголовок второго уровня, заводит свой и кладёт запись под него: " + out);
    assertTrue(out.indexOf("## Log\n- first entry\n- second entry") >= 0,
      "и чужую секцию второго уровня при этом не трогает");
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

  /*
   * 6. Заголовка нет — он **заводится сам**, и запасное положение говорит, где
   * (замечание заказчика по S4, 2026-09-08: «если `At custom header` не
   * найден, то тогда он должен сам добавиться в заметке в зависимости от
   * варианта `If header not found`»).
   */
  {
    const noHeader = "intro line\n\n- something";
    const atEnd = transform.composeBodyWithPlacement(noHeader, "- new entry", i2nAtHeader("## Log", "end"), "\n");
    assertEq(atEnd, "intro line\n\n- something\n\n## Log\n- new entry",
      "заголовка нет: он заведён в конце, и запись стоит под ним");
    const atStart = transform.composeBodyWithPlacement(noHeader, "- new entry", i2nAtHeader("## Log", "beginning"), "\n");
    assertEq(atStart, "## Log\n- new entry\n\nintro line\n\n- something",
      "то же в начале заметки");
  }

  /*
   * 6а. Уровень заведённого заголовка берётся из имени, а не выдумывается.
   *
   * Это и есть **положительный контроль** к правилу «заведённый заголовок
   * находится следующим запуском»: заведи мы всегда первый уровень, `## Log`
   * во второй раз не нашёлся бы и заметка получила бы второй заголовок.
   */
  {
    const first = transform.composeBodyWithPlacement("intro", "- one", i2nAtHeader("### Log", "end"), "\n");
    assertTrue(first.indexOf("### Log") >= 0, "решётки имени задают уровень заведённого заголовка: " + first);
    const second = transform.composeBodyWithPlacement(first, "- two", i2nAtHeader("### Log", "end"), "\n");
    assertEq(second.match(/### Log/g).length, 1,
      "второй запуск находит свой же заголовок, а не заводит второй: " + second);
    assertTrue(second.indexOf("- one\n\n- two") >= 0,
      "и вторая запись ложится в конец той же секции: " + second);
  }

  /* 6б. Решёток в имени нет — уровень первый, ровно как в плейсхолдере. */
  {
    const out = transform.composeBodyWithPlacement("intro", "- one", i2nAtHeader("Log", "end"), "\n");
    assertEq(out, "intro\n\n# Log\n- one",
      "имя без решёток заводит заголовок первого уровня");
    const again = transform.composeBodyWithPlacement(out, "- two", i2nAtHeader("Log", "end"), "\n");
    assertEq(again.match(/# Log/g).length, 1, "и он же находится в следующий раз: " + again);
  }

  /*
   * 6в. Новая заметка без шаблона: тело пустое, заголовка в нём нет — значит
   * это тот же случай «не нашёл», а не исключение из него. Раньше ветка пустого
   * тела стояла выше и до заведения заголовка дело не доходило вовсе.
   */
  {
    const out = transform.composeBodyWithPlacement("", "- new entry", i2nAtHeader("## Log", "end"), "\n");
    assertEq(out, "## Log\n- new entry\n", "у новой заметки без шаблона заголовок тоже заводится");
    const atStart = transform.composeBodyWithPlacement("", "- new entry", i2nAtHeader("## Log", "beginning"), "\n");
    assertEq(atStart, "## Log\n- new entry\n", "положение в пустом теле одно и то же с любой стороны");
  }

  /* 7. Имя не задано вовсе — заводить нечего, работает запасное положение. */
  {
    const out = transform.composeBodyWithPlacement(NOTE_WITH_SECTIONS, "- new entry", i2nAtHeader("", "beginning"), "\n");
    assertTrue(out.startsWith("- new entry"), "пустое имя заголовка работает как запасное положение");
    assertTrue(out.indexOf("#") === out.indexOf("## Log"),
      "и своего заголовка при пустом имени не появляется: " + out);
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
    assertTrue(out.indexOf("---\n## Log\n- new entry") >= 0,
      "заголовок заводится в начале **тела**, а не файла: " + out);
  }

  /* 10а. Дописывание с заведением заголовка в конце заметки. */
  {
    const before = "---\ntags: [a]\n---\nplain body\n";
    const out = transform.appendBlockIntoNote(before, "- new entry", i2nAtHeader("## Log", "end"), "\n");
    assertEq(out, "---\ntags: [a]\n---\nplain body\n\n## Log\n- new entry\n",
      "дописывание тоже заводит заголовок, и в том же виде");
    const again = transform.appendBlockIntoNote(out, "- second", i2nAtHeader("## Log", "end"), "\n");
    assertEq(again.match(/## Log/g).length, 1,
      "и второй раз находит свой же заголовок: " + again);
    assertTrue(again.indexOf("- new entry\n\n- second") >= 0,
      "вторая запись ложится в конец той же секции: " + again);
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
/* ====================================================================== */
/* Своя ветка `Note content` у правила Smart Rules (З-5)                    */
/* ====================================================================== */

function runRulePlacementSuite() {
  const common = {
    placement: {
      position: "end", headerMode: "none", headerLevel: "0",
      customHeader: "", datetimeFormat: "YYYY-MM-DD",
      targetHeader: "", fallback: "end",
    },
  };

  /* 1. Правило молчит — работает общая настройка. */
  {
    assertEq(transform.resolvePlacementSource(common, null), common, "правила нет — конфиг тот же");
    const quiet = { placementMode: "default", placement: { position: "beginning" } };
    assertEq(transform.resolvePlacementSource(common, quiet), common,
      "правило со своей веткой, но в режиме `default`, общую настройку не трогает");
  }

  /* 2. Правило говорит — работает его ветка, и остальное в ней нормализовано. */
  {
    const own = { placementMode: "custom", placement: { position: "beginning", headerMode: "none" } };
    const used = transform.resolvePlacementSource(common, own);
    assertEq(used.placement.position, "beginning", "положение берётся у правила");
    assertEq(used.placement.headerMode, "none", "и остальное тоже");
    assertEq(common.placement.position, "end", "а общая настройка не тронута");
  }

  /* 3. Два правила на одной строке дают разные заметки — это и есть смысл. */
  {
    const body = "intro";
    const quiet = transform.composeBodyWithPlacement(
      body, "- entry", transform.resolvePlacementSource(common, { placementMode: "default" }), "\n");
    const own = transform.composeBodyWithPlacement(
      body, "- entry", transform.resolvePlacementSource(common, {
        placementMode: "custom",
        placement: { position: "beginning", headerMode: "none", headerLevel: "0" },
      }), "\n");
    assertEq(quiet, "intro\n\n- entry", "правило без своей ветки кладёт запись в конец");
    assertEq(own, "- entry\n\nintro", "правило со своей веткой — в начало");
  }

  /* 4. Через настоящую нормализацию конфига: ключи правила переживают патч. */
  {
    const cfg = transform.normalizeTransformConfig({
      transform: {
        inline2note: {
          enabled: true,
          smartRules: [{ id: "r1", enabled: true, placementMode: "custom",
            placement: { position: "custom-header", targetHeader: "## Log" },
            conditions: { tags: ["#todo"] } }],
        },
      },
    });
    const rule = cfg.transform.inline2note.smartRules[0];
    assertEq(rule.placementMode, "custom", "режим ветки переживает нормализацию конфига");
    assertEq(rule.placement.position, "custom-header", "и её значения тоже");
    assertEq(rule.placement.targetHeader, "## Log", "имя заголовка не теряет решёток");
    const quiet = transform.normalizeTransformConfig({
      transform: { inline2note: { enabled: true, smartRules: [{ id: "r2", enabled: true, conditions: { tags: ["#x"] } }] } },
    }).transform.inline2note.smartRules[0];
    assertEq(quiet.placementMode, "default", "правило без ветки получает `default`");
    assertEq(quiet.placement.position, "end", "а сама ветка досыпается умолчаниями движка");
  }

  console.log("  ok  своя ветка `Note content` у правила (З-5)");
}

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

/*
 * **Ссылка на новую заметку в тех заметках, на которые ссылается строка** —
 * его заказ Н4 (2026-09-16) и его ответы В-135: путь полный, заметки-цели нет
 * — создать пустой и дописать, искать только там, где ссылка есть значение
 * поля типа link.
 *
 * Проверка гоняет **весь путь**, а не одну функцию: конфиг едет через
 * нормализацию, строку читает настоящий разбор, запись идёт настоящим
 * `Vault.process`. Отдельные куски спрашиваются ниже поимённо — по одному
 * ответу на вопрос, который может сломаться сам.
 */
function backlinkConfig(extra) {
  return makeConfig({
    backlink: { enabled: true, placement: { position: "end", ...(extra || {}) } },
    sourceProcessing: { cleanupFieldIds: [], token: "", panel: "right", replaceWithLink: true },
  }, makeFieldsConfig());
}

async function testBacklinkWrittenIntoEveryReferencedNote() {
  const editor = makeEditor("- #todo [[test1]] :: Отчёт");
  const plugin = makePlugin(backlinkConfig(), editor, { initialFiles: { "test1.md": "# test1\n" } });
  await transform.runInline2Note(plugin, { lineFinalize });
  assertTrue(plugin.files.has("Notes/Отчёт.md"), "новая заметка создана");
  assertTrue(String(plugin.files.get("test1.md")).includes("- [[Notes/Отчёт]]"),
    "в заметку, на которую ссылалась строка, дописана ссылка полным путём");
  assertTrue(String(plugin.files.get("test1.md")).startsWith("# test1"),
    "и её прежнее содержимое цело");
}

async function testBacklinkCreatesMissingNote() {
  const editor = makeEditor("- #todo [[test1]] :: Отчёт");
  const plugin = makePlugin(backlinkConfig(), editor);
  await transform.runInline2Note(plugin, { lineFinalize });
  assertTrue(plugin.files.has("test1.md"), "заметки-цели не было — создана (его ответ В-135)");
  assertTrue(String(plugin.files.get("test1.md")).includes("- [[Notes/Отчёт]]"),
    "и ссылка в неё дописана");
}

async function testBacklinkDoesNotDuplicate() {
  const editor = makeEditor("- #todo [[test1]] :: Отчёт");
  const plugin = makePlugin(backlinkConfig(), editor,
    { initialFiles: { "test1.md": "уже есть: [[Notes/Отчёт]]\n" } });
  await transform.runInline2Note(plugin, { lineFinalize });
  const body = String(plugin.files.get("test1.md"));
  assertEq((body.match(/Notes\/Отчёт/g) || []).length, 1, "ссылка не дублируется (его условие)");
}

async function testBacklinkOffWritesNothing() {
  const editor = makeEditor("- #todo [[test1]] :: Отчёт");
  const plugin = makePlugin(makeConfig({
    sourceProcessing: { cleanupFieldIds: [], token: "", panel: "right", replaceWithLink: true },
  }, makeFieldsConfig()), editor, { initialFiles: { "test1.md": "# test1\n" } });
  await transform.runInline2Note(plugin, { lineFinalize });
  assertEq(String(plugin.files.get("test1.md")), "# test1\n",
    "выключенная настройка не трогает чужую заметку ни одним знаком");
}

function runBacklinkPiecesSuite() {
  /*
   * **Ссылка внутри слова человека — не значение поля**, и это его уточнение
   * В-135. Отрицательный контроль здесь важнее положительного: без него
   * правило «пишем в каждую ссылку строки» выглядело бы работающим.
   */
  const cfg = makeConfig({}, makeFieldsConfig());
  const inBlock = transform.buildTransformContext(
    transform.parseInlineLine("- #todo [[test1]] :: Отчёт", cfg), cfg);
  assertEq(JSON.stringify(transform.backlinkTargetsFromContext(inBlock)), JSON.stringify(["test1"]),
    "ссылка-значение поля в Block называется целью");

  const inText = transform.buildTransformContext(
    transform.parseInlineLine("- #todo :: Отчёт про [[test1]]", cfg), cfg);
  assertEq(JSON.stringify(transform.backlinkTargetsFromContext(inText)), JSON.stringify([]),
    "ссылка внутри слова человека целью не становится");

  /* Повтор одного значения на строке — одна заметка, а не две записи. */
  const twice = transform.buildTransformContext(
    transform.parseInlineLine("- #todo [[test1]] [[test1]] :: Отчёт", cfg), cfg);
  assertEq(JSON.stringify(transform.backlinkTargetsFromContext(twice)), JSON.stringify(["test1"]),
    "одно значение дважды на строке — одна цель");

  /* «Ссылка уже есть» сверяется целью, а не текстом строки. */
  assertTrue(transform.noteAlreadyLinksTo("хвост [[Notes/Отчёт]] хвост", "Notes/Отчёт.md"),
    "полный путь узнаётся");
  assertTrue(transform.noteAlreadyLinksTo("[[Отчёт]]", "Notes/Отчёт.md"),
    "короткое имя без папки — та же заметка");
  assertTrue(!transform.noteAlreadyLinksTo("[[Архив/Отчёт]]", "Notes/Отчёт.md"),
    "а имя из другой папки — другая заметка");
  assertTrue(!transform.noteAlreadyLinksTo("Notes/Отчёт", "Notes/Отчёт.md"),
    "путь без скобок ссылкой не считается");
  assertEq(transform.backlinkLineFor("Notes/Отчёт.md"), "- [[Notes/Отчёт]]",
    "строка ссылки — знак списка и полный путь");
  console.log("  ok Н4: цели, повторы и «ссылка уже есть» — по одному ответу на вопрос");
}

/*
 * **Заметка в корне vault.** Найдено при работе над Н4: правило «какая у пути
 * папка» отвечало именем самой заметки, когда косой черты в пути нет вовсе, —
 * плагин заводил папку с именем заметки и на ней же спотыкался. Место было
 * одно и то же в двух записях (У-32), и проверок на корень не было ни одной:
 * во всех фикстурах стоит `outputFolder: "Notes"` (У-113).
 */
async function testNoteAtVaultRootIsCreated() {
  const editor = makeEditor("- [ ] :: Отчёт");
  const plugin = makePlugin(makeConfig({ outputFolder: "" }), editor);
  await transform.runInline2Note(plugin, { lineFinalize });
  assertTrue(plugin.files.has("Отчёт.md"), "заметка в корне vault создана");
  assertTrue(!plugin.files.has("Отчёт.md") || typeof plugin.files.get("Отчёт.md") === "string",
    "и это заметка, а не папка с её именем");
  assertEq(editor.text(), "- [ ] :: [[Отчёт]]", "ссылка на неё встала в строку");
}

async function testBacklinkNoteAtVaultRoot() {
  const editor = makeEditor("- #todo [[test1]] :: Отчёт");
  const plugin = makePlugin(backlinkConfig(), editor);
  await transform.runInline2Note(plugin, { lineFinalize });
  assertEq(typeof plugin.files.get("test1.md"), "string",
    "заметка-цель в корне vault заведена заметкой, а не папкой");
}

async function runBacklinkSuite() {
  await testNoteAtVaultRootIsCreated();
  await testBacklinkNoteAtVaultRoot();
  await testBacklinkWrittenIntoEveryReferencedNote();
  await testBacklinkCreatesMissingNote();
  await testBacklinkDoesNotDuplicate();
  await testBacklinkOffWritesNothing();
  runBacklinkPiecesSuite();
  console.log("  ok Н4: ссылка на новую заметку уезжает в заметки, на которые ссылалась строка");
}

async function run() {
  await testNewNoteRaceUsesActualPathLink();
  await testReplacePayloadFalse();
  await testSourceFailureRollsBackCreatedTarget();
  await testSourceFailureRestoresOverwrittenTarget();
  await testSourceFailureRestoresAppendedNote();
  await testSourceFailureRemovesNoteCreatedForAppend();
  await testStaleEditorStopsBeforeTargetMutation();
  await testAddToNoteDoesNotDuplicateTemplateOrHeader();
  await testForeignNoteWrittenByProcessFromWhatWasRead();
  await testRollbackRestoresWhatProcessSaw();
  await testTemplateErrorSurfacesBeforeMutation();
  await testManualCancelDoesNotMutate();
  await testTitleWordsReplacedByLink();
  await testHeaderLineTakesItsSectionAndBecomesBullet();
  await testPlainLineStillTakesOnlyIndentedLines();
  await testTitleWordsSurviveLeave();
  await testLeaveNamedKeepsRestAndSwapsName();
  await testCleanedLeftSegmentKeepsTextAndTailApart();
  await testProcessedTokenLeftPanelAfterCleanedLeftSegment();
  testProcessedTokenLeftPanelKeepsLineStart();
  await testCursorStandsAtEndOfTextAfterTransform();
  runCustomHeaderPlacementSuite();
  await testCustomHeaderReachesTheWrittenNote();
  runRulePlacementSuite();
  await runBacklinkSuite();
  console.log("Transform runtime regression tests: OK");
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
