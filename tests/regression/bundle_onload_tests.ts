/**
 * Плагин включается — и включается ИЗ СБОРКИ (дефект A33, 2026-09-07).
 *
 * **Дырка, которую эта проверка закрывает.** Весь остальной набор гоняет
 * исходное дерево: `tests/harness/plugin_internals.ts` читает `main.js` из
 * корня репозитория, и все его `require("./src/...")` там разрешаются. У
 * человека же стоит плоский бандл: одна `main.js` и ни одной папки рядом.
 * Значит вопрос «работает ли у меня» набор задавал исходникам, а «включается
 * ли у человека» — никому (У-78, тот же класс).
 *
 * **Чем это кончилось.** 2026-09-06 из загрузчика модулей убрали мост, оставив
 * `require(requirePath)`. Путь в переменной esbuild не разрешает: в бандле этот
 * вызов остаётся вызовом `require` хоста, а папки `src/` рядом с плагином нет.
 * Все четырнадцать загрузчиков стали отдавать заглушки, и заказчик увидел
 * плагин без единой команды — при 51 зелёной проверке.
 *
 * **Что проверяется.** Собранный файл берётся как есть, `onload` зовётся
 * целиком, и дальше спрашивается то, что видит человек:
 *
 *   * команды, которые плагин зарегистрировал в Obsidian, — их список не пуст
 *     и в нём есть поимённо названные; пустой список и есть тот дефект;
 *   * список справочника, собранный СБОРКОЙ, слово в слово равен списку,
 *     собранному ИСХОДНИКАМИ на том же конфиге. Это и есть положительный
 *     контроль (У-88): исходный список проверен своими проверками и не пуст,
 *     поэтому равенство не может быть зелёным от пустоты;
 *   * движки навигации и PKM доехали до полей плагина. На заглушке там `null`,
 *     и ни одна команда редактора не работает.
 *
 * **Что здесь подделано и почему это законно.** `obsidian` в Node нет вовсе
 * (пакет — одни типы), CodeMirror требует браузерный `document` при загрузке,
 * DOM подделан общей заглушкой набора. Всё остальное — настоящее: конфиг идёт
 * через `migrateConfig`, команды строит реестр, модули приезжают тем самым
 * загрузчиком, который стоит в бандле.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import * as obsidianStub from "../harness/obsidian_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { cmStub, loadPluginInternals } from "../harness/plugin_internals.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const distMain = path.join(root, "dist", "main.js");

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/**
 * Команды, названные поимённо: перемещение строки и текста, переход по
 * заголовкам, курсор внутри строки, TagWheel в обе стороны, системная строка
 * Binder, превращение строки в заметку и тумблер модуля.
 *
 * Пары команд Field здесь нет намеренно: их строит конфиг, а у свежей
 * установки Field не заведено ни одного. Про них отвечает равенство со
 * списком исходников ниже — оно сверяет ровно тот конфиг, что собрался.
 *
 * Отсутствие этих тринадцати и есть замечание заказчика 2026-09-07: из
 * палитры Obsidian исчезло всё, кроме `Transform inline to note`, — та
 * единственная команда, которую справочник добавляет литералом, минуя реестр.
 */
const REQUIRED_COMMAND_IDS = [
  "move-line-up",
  "move-line-down",
  "move-left",
  "move-right",
  "jump-next",
  "jump-back",
  "move-cursor-left-in-line",
  "move-cursor-right-in-line",
  "open-tagwheel-left",
  "open-tagwheel-right",
  "smart-bracket",
  "transform-inline-to-note",
  "toggle-feature-navigation",
];

/**
 * Заглушка `@codemirror/state` с настоящим `Compartment`.
 *
 * Общая заглушка набора отдаёт под `new` объект с прототипом наследника — это
 * нужно виджетам декораций (`class ... extends cmView.WidgetType`). Отсеку
 * настроек этого мало: `registerGlobalFunctions` зовёт `.of()` у созданного
 * `Compartment`, и без него `onload` падает не на своём предмете.
 */
function cmStateStub(): Any {
  const any = cmStub();
  class Compartment {
    of(ext: Any): Any {
      return ext;
    }
    reconfigure(ext: Any): Any {
      return ext;
    }
  }
  return new Proxy({} as Any, {
    get: (_target: Any, prop: string | symbol) => (prop === "Compartment" ? Compartment : any[prop]),
  });
}

/** База плагина Obsidian: ровно те методы, которые зовёт `main.js`. */
function makePluginBase(): Any {
  return class PluginBase {
    app: Any;
    manifest: Any;
    commands: Any[] = [];
    settingTabs: Any[] = [];
    editorExtensions: Any[] = [];
    cleanups: Array<() => void> = [];
    saved: Any = null;
    constructor(app: Any, manifest: Any) {
      this.app = app;
      this.manifest = manifest;
    }
    addCommand(c: Any): Any {
      this.commands.push(c);
      return c;
    }
    addSettingTab(t: Any): void {
      this.settingTabs.push(t);
    }
    registerEditorExtension(ext: Any): void {
      this.editorExtensions.push(ext);
    }
    register(cb: () => void): void {
      this.cleanups.push(cb);
    }
    registerEvent(_e: Any): void { /* заглушка */ }
    async loadData(): Promise<Any> {
      return {};
    }
    async saveData(data: Any): Promise<void> {
      this.saved = data;
    }
  };
}

/**
 * Vault без диска: запись запоминается, чтения не находят ничего.
 *
 * Так и выглядит свежая установка — служебного файла правил ещё нет, — и
 * именно на ней `onload` обязан дойти до конца.
 */
function makeApp(): Any {
  const written = new Map<string, string>();
  return {
    written,
    vault: {
      configDir: ".obsidian",
      adapter: {
        async exists(): Promise<boolean> {
          return false;
        },
        async read(p: string): Promise<string> {
          if (written.has(p)) return written.get(p) as string;
          throw new Error("ENOENT " + p);
        },
        async write(p: string, data: string): Promise<void> {
          written.set(p, String(data));
        },
        async mkdir(): Promise<void> { /* заглушка */ },
        async list(): Promise<Any> {
          return { files: [], folders: [] };
        },
      },
      getAbstractFileByPath: () => null,
      async create(p: string, data: string): Promise<Any> {
        written.set(p, String(data));
        return { path: p };
      },
    },
    workspace: {
      activeEditor: null,
      getActiveViewOfType: () => null,
      getLeavesOfType: () => [],
      on: () => ({}),
      iterateAllLeaves: () => {},
    },
    metadataTypeManager: undefined,
    setting: undefined,
  };
}

/**
 * Редактор одной строки. Настоящий у Obsidian, здесь — то же, что в
 * `status_runtime_behavior_tests.js`: движку от него нужны курсор, строка
 * и запись строки обратно.
 */
function makeEditorStub(line: string, ch: number): Any {
  let text = String(line || "");
  let cur = { line: 0, ch: Number(ch || 0) };
  return {
    getCursor: () => ({ line: cur.line, ch: cur.ch }),
    getLine: () => text,
    setLine: (_n: number, v: string) => { text = String(v || ""); },
    replaceRange: (v: string) => { text = String(v || ""); },
    setCursor: (n: Any) => { cur = { line: Number(n.line || 0), ch: Number(n.ch || 0) }; },
    lineCount: () => 1,
    getValue: () => text,
    snapshot: () => text,
  };
}

/**
 * Редактор для Transform: ему нужны выделение, отрезки и запись по диапазону —
 * однострочной заглушки выше не хватает.
 */
function makeTransformEditorStub(line: string): Any {
  const lines: string[] = [String(line || "")];
  const at = (n: number): string => String(lines[n] ?? "");
  return {
    getCursor: (which: string) => (which === "to" ? { line: 0, ch: at(0).length } : { line: 0, ch: 0 }),
    somethingSelected: () => false,
    getLine: (n: number) => at(n),
    setLine: (n: number, v: string) => { lines[n] = String(v || ""); },
    setCursor: () => {},
    lineCount: () => lines.length,
    replaceRange(value: string, from: Any, to: Any) {
      const end = to || from;
      if (from.line === end.line) {
        lines[from.line] = at(from.line).slice(0, from.ch) + value + at(end.line).slice(end.ch);
      } else {
        lines.splice(from.line, end.line - from.line + 1, ...String(value).split("\n"));
      }
    },
    snapshot: () => lines.join("\n"),
  };
}

/**
 * Редактор, у которого видно **историю отмен**.
 *
 * От заглушки выше отличается одним: у него есть `cm`. У Obsidian это
 * `EditorView`, и TagWheel пишет через него свои транзакции с пометкой «не
 * запоминать»; в Node такого объекта нет вовсе, поэтому он подделан — и
 * подделан ровно настолько, чтобы записать, что ему послали (У-1).
 *
 * `plainWrites` — записи, идущие в историю обычным путём. Их и считаем: одна
 * ступень на всю сессию панели и есть то, чего просил заказчик.
 */
function makeHistoryEditorStub(line: string, ch: number): Any {
  let text = String(line || "");
  let cur = { line: 0, ch: Number(ch || 0) };
  const plainWrites: string[] = [];
  const dispatched: Any[] = [];
  /* Строка **до** каждой записи: без неё «различие это или строка целиком»
     не отличить — отрезок сравнивать не с чем. */
  const dispatchedBefore: string[] = [];
  const view: Any = {
    /*
     * `text` у строки — не украшение: панель считает от него **различие**, и
     * заглушка без него была бы добрее браузера (У-45). У настоящей строки
     * CodeMirror это поле есть всегда.
     */
    state: {
      doc: {
        line: (_n: number) => ({ from: 0, to: text.length, text }),
        sliceString: (from: number, to: number) => text.slice(from, to),
      },
    },
    dispatch: (spec: Any) => {
      dispatched.push(spec);
      dispatchedBefore.push(text);
      const from = Number(spec.changes.from || 0);
      const to = Number(spec.changes.to || 0);
      text = text.slice(0, from) + String(spec.changes.insert == null ? "" : spec.changes.insert) + text.slice(to);
    },
  };
  return {
    cm: view,
    getCursor: () => ({ line: cur.line, ch: cur.ch }),
    getLine: () => text,
    setLine: (_n: number, v: string) => { text = String(v || ""); plainWrites.push(text); },
    replaceRange: (v: string) => { text = String(v || ""); plainWrites.push(text); },
    setCursor: (n: Any) => { cur = { line: Number(n.line || 0), ch: Number(n.ch || 0) }; },
    lineCount: () => 1,
    getValue: () => text,
    snapshot: () => text,
    plainWrites,
    dispatched,
    dispatchedBefore,
  };
}

/**
 * Заметки Transform пишет через `vault`, а не через адаптер: свежая установка
 * из `makeApp` этих методов не знает, потому что до сих пор их никто не звал.
 * Хранилище то же самое — `app.written`, — чтобы созданную заметку можно было
 * прочитать там же, где всё остальное.
 */
function attachTransformVault(app: Any): void {
  const written = app.written as Map<string, string>;
  app.vault.getAbstractFileByPath = (p: string) => (written.has(p) ? { path: p } : null);
  app.vault.create = async (p: string, data: string): Promise<Any> => {
    if (written.has(p)) throw new Error("already exists: " + p);
    written.set(p, String(data));
    return { path: p };
  };
  app.vault.createFolder = async (p: string): Promise<void> => { written.set(p, ""); };
  app.vault.read = async (f: Any): Promise<string> => String(written.get(f && f.path ? f.path : f) || "");
  app.vault.modify = async (f: Any, data: string): Promise<void> => { written.set(f.path, String(data)); };
  app.vault.delete = async (f: Any): Promise<void> => { written.delete(f.path); };
  app.vault.getMarkdownFiles = (): Any[] => Array.from(written.keys())
    .filter((p) => /\.md$/.test(p))
    .map((p) => ({ path: p }));
}

async function run(): Promise<void> {
  assert.ok(fs.existsSync(distMain), "dist/main.js собран");

  setupGlobals();
  const internals = loadPluginInternals();

  const platform: Any = {
    ...obsidianStub,
    Plugin: makePluginBase(),
    setIcon: () => {},
    MarkdownView: class {},
  };

  const loader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const origLoad = loader._load;
  loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
    if (request === "obsidian") return platform;
    if (request === "@codemirror/view") return cmStub();
    if (request === "@codemirror/state") return cmStateStub();
    return origLoad.call(this, request, parent, isMain);
  };

  let PluginClass: Any = null;
  try {
    const nodeRequire = Module.createRequire(import.meta.url);
    delete nodeRequire.cache[nodeRequire.resolve(distMain)];
    PluginClass = nodeRequire(distMain);
  } finally {
    loader._load = origLoad;
  }

  assert.strictEqual(typeof PluginClass, "function", "сборка отдаёт класс плагина");
  ok("сборка отдаёт класс плагина");

  const app = makeApp();
  const plugin = new PluginClass(app, { id: "inline-overhaul", version: "0.0.0-test" });

  loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
    if (request === "obsidian") return platform;
    if (request === "@codemirror/view") return cmStub();
    if (request === "@codemirror/state") return cmStateStub();
    return origLoad.call(this, request, parent, isMain);
  };
  try {
    await plugin.onload();
  } finally {
    loader._load = origLoad;
  }
  ok("onload сборки дошёл до конца");

  /* Команды, зарегистрированные в Obsidian. Пустой список — тот самый дефект. */
  const registered = plugin.commands.map((c: Any) => String(c && c.id ? c.id : ""));
  assert.ok(registered.length > 0, "плагин зарегистрировал хотя бы одну команду");
  for (const id of REQUIRED_COMMAND_IDS) {
    assert.ok(registered.includes(id), `команда зарегистрирована: ${id}`);
  }
  ok(`команд зарегистрировано: ${registered.length}, среди них все названные поимённо`);

  /*
   * Справочник команд: сборка против исходников на одном конфиге.
   *
   * Ожидание выписано отдельно от того, что проверяется (У-5): список слева
   * собирает бандл, список справа — `buildOwnCommandList` из `main.js`, взятая
   * загрузчиком проверок. Разойтись им можно только тем, что в бандле модуль не
   * доехал.
   */
  const cfg = plugin.getConfig();
  const fromBundle = plugin.listOwnCommands().map((c: Any) => String(c.id));
  const fromSource = internals
    .buildOwnCommandList({ getConfig: () => cfg })
    .map((c: Any) => String(c.id));
  assert.ok(fromSource.length > 1, "список исходников не пуст: положительный контроль равенства");
  assert.deepStrictEqual(fromBundle, fromSource, "список справочника у сборки равен списку исходников");
  ok(`справочник сборки равен справочнику исходников (${fromSource.length} команд)`);

  /*
   * Движки редактора. На заглушке загрузчика здесь `null`, и это ровно тот
   * случай, когда плагин «включился», а в заметке не делает ничего.
   */
  assert.ok(plugin.navRuntime && typeof plugin.navRuntime === "object", "движок навигации загружен");
  assert.strictEqual(typeof plugin.navRuntime.moveLine, "function", "движок навигации — тот самый модуль");
  assert.ok(plugin.pkmRuntimeV2 && typeof plugin.pkmRuntimeV2 === "object", "движок PKM загружен");
  ok("движки навигации и PKM доехали до полей плагина");

  /*
   * Шов макро-рантайма: его ставит загрузчик, и по нему движки PKM находят
   * друг друга. Заглушка оставляет его неопределённым, и это тоже «включился,
   * но не работает».
   */
  assert.strictEqual(
    typeof (globalThis as Any).__inlineGetPkmMacroRuntime,
    "function",
    "шов макро-рантайма опубликован",
  );
  ok("шов макро-рантайма опубликован");


  /*
   * Панель настроек собирается из сборки.
   *
   * Своя проверка панели (`npm run gate`) гоняет исходники слоя настроек на
   * заглушке DOM — то есть отвечает на «схема цела», а не на «панель доехала до
   * бандла». Разница между этими двумя вопросами и есть дефект A33.
   *
   * Спрашивается декларативный путь Obsidian 1.13: платформа зовёт
   * `getSettingDefinitions()`, и пустой список для неё — панель без строк.
   */
  assert.strictEqual(plugin.settingTabs.length, 1, "плагин отдал платформе одну вкладку настроек");
  const tab = plugin.settingTabs[0];
  assert.strictEqual(typeof tab.getSettingDefinitions, "function", "вкладка идёт декларативным путём 1.13");
  const defs = tab.getSettingDefinitions();
  assert.ok(Array.isArray(defs) && defs.length > 0, "панель отдала непустой список определений");
  ok(`панель настроек собралась из сборки (${defs.length} определений верхнего уровня)`);

  /*
   * Расширения редактора: ими нарисованы цвета Values, полоса приоритета,
   * подсветка строки при открытой панели TagWheel, отметки на строке и
   * перехваты `Ctrl+A`, `Del`, `Backspace`. Ни одного — значит в заметке плагин
   * не делает ничего, и это то же «включился, но не работает».
   */
  assert.ok(plugin.editorExtensions.length > 0, "плагин зарегистрировал расширения редактора");
  ok(`расширений редактора зарегистрировано: ${plugin.editorExtensions.length}`);

  /*
   * Служебный файл правил. Это единственный канал между настройками и
   * движками `pkm_v2/**` (PRD 10.13.52), и пишет его сборщик — тот самый, у
   * которого до правки была своя заглушка, бросавшая исключение.
   *
   * Спрашивается не «файл записан», а **сколько в нём блоков**: пустой или
   * обрезанный файл записывается так же успешно, как полный.
   */
  const rulesPath = ".obsidian/plugins/inline-overhaul/generated_rules.md";
  const rules = String(app.written.get(rulesPath) || "");
  assert.ok(rules.length > 0, `сборка записала служебный файл правил: ${rulesPath}`);
  const blocks = (rules.match(/```tagwheel-[a-z-]+/g) || []).length;
  assert.strictEqual(blocks, 10, "в файле правил все десять блоков");
  ok(`служебный файл правил записан из сборки, блоков: ${blocks}`);

  /*
   * И наконец то, что человек делает в заметке: движок PKM из СБОРКИ получает
   * строку и переписывает её.
   *
   * Зачем это здесь, а не только в проверках исходников (У-91): 53 проверки
   * были зелёными, пока TagWheel съедал текст заказчика, и одна из причин та
   * же, что у A33 — набор спрашивал исходное дерево. Строка взята из его
   * замечания 2026-09-07 слово в слово.
   *
   * Правила берутся из фикстуры репозитория, а не из файла, который плагин
   * только что записал: у свежей установки Field не заведено ни одного, и цикл
   * по Field на ней не тронул бы ничего (У-88 — предмет измерения обязан
   * существовать).
   */
  {
    const rulesFixture = fs.readFileSync(
      path.join(root, "tests", "fixtures", "InlineOverhaul_Generated_RULES_TagWheel.md"),
      "utf8",
    );
    const rulesPath = "InlineOverhaul_Generated_RULES_TagWheel.md";
    app.written.set(rulesPath, rulesFixture);
    app.vault.getAbstractFileByPath = (p: string) => (app.written.has(p) ? { path: p } : null);
    app.vault.read = async (f: Any) => String(app.written.get(f && f.path ? f.path : f) || "");

    const orderConfig = JSON.stringify({
      active: { type: "yes" },
      panel: { type: "left" },
      left: ["type"],
      right: [],
      types: { type: "tag" },
      strictNames: { type: "type" },
      freeRoam: { type: "off" },
      freeRoamBehavior: { minimalSeparator: true, minimalPrefix: true },
    });

    const run = async (editor: Any, command: string, extra: Any): Promise<void> => {
      app.workspace.activeEditor = { editor };
      app.workspace.activeLeaf = { view: { editor } };
      await plugin.pkmRuntimeV2.runCommand({
        app,
        command,
        settings: {
          "Rules path": rulesPath,
          "Order config": orderConfig,
          "Cycle end behavior": "keep-bullet",
          "Cursor policy": "text_end",
          ...extra,
        },
      });
    };

    const drive = async (line: string, ch: number): Promise<string> => {
      const editor = makeEditorStub(line, ch);
      await run(editor, "statusTags", {
        "Action type": "cycle_field:type",
        "Direction": "increase",
      });
      return editor.snapshot();
    };

    /* Положительный контроль: движок из сборки вообще что-то делает. */
    const real = await drive("- [n] test1 test2", 6);
    assert.match(real, /^- \[ \] #todo/,
      "движок из сборки переписывает строку и ставит чекбокс, заданный у Value");

    /* Замечание заказчика 2026-09-07: его текст в скобках обязан выжить. */
    const owner = await drive("- [test-transform] test1 test2", 20);
    assert.ok(owner.includes("[test-transform]"),
      "сборка не съедает текст человека в скобках: чекбокс — ровно один знак");
    assert.ok(owner.includes("test1") && owner.includes("test2"),
      "и проза за ним остаётся");
    ok("движок PKM из сборки переписал строку и сохранил текст человека");

    /*
     * Три движка, а не один.
     *
     * `statusTags` выше отвечает за свой файл. `statusDate` и `tagWheel` —
     * отдельные модули, и загрузка у каждого своя: в дефекте A33 они умерли
     * все три, а сборка при этом собиралась и включалась. Поэтому каждый
     * спрашивается тем же способом — переписал строку или нет.
     *
     * Ожидание у каждого выписано по тому, что делает именно он (У-5): дата
     * сдвигается, TagWheel помечает строку своей панелью.
     */
    {
      const dateOrder = JSON.stringify({
        active: { date_due: "yes" },
        panel: { date_due: "right" },
        left: [],
        right: ["date_due"],
        types: { date_due: "element" },
        strictNames: { date_due: "date_due" },
      });
      const editor = makeEditorStub("- [ ] #todo :: text :: 📅2026-04-08", 2);
      app.workspace.activeEditor = { editor };
      app.workspace.activeLeaf = { view: { editor } };
      await plugin.pkmRuntimeV2.runCommand({
        app,
        command: "statusDate",
        settings: {
          "Rules path": rulesPath,
          "Action type": "field_inc:date_due",
          "Order config": dateOrder,
          "Cycle end behavior": "keep-bullet",
          "Cursor policy": "line_end",
        },
      });
      const line = editor.snapshot();
      assert.match(line, /📅2026-04-\d{2}/, "движок дат из сборки оставил дату токеном");
      assert.ok(line.includes("text"), "и текст человека на месте");
      ok("движок дат из сборки переписал строку");
    }

    /*
     * Все метки элементов, объявленные фикстурой.
     *
     * Без них TagWheel **не запускается вовсе**: он проверяет, что у каждого
     * Field-элемента есть эмодзи, и молча возвращается с сообщением. Проверка
     * ниже была от этого зелёной — строка оставалась целой потому, что её никто
     * не трогал (У-88: у измерения обязан быть предмет). Заодно это отвечает на
     * вопрос, ради которого проверка заведена: доехал ли TagWheel до сборки.
     */
    const dateRuntimeAll = JSON.stringify({
      byField: {
        timeNow: { emoji: "\u{1F552}", format: "hh:mm", increment: { mode: "standard", incrementBy: 1 } },
        estimated: { emoji: "\u{231B}", format: "hh:mm", increment: { mode: "standard", incrementBy: 1 } },
        start: { emoji: "\u{1F6EB}", format: "YYYY-MM-DD", increment: { mode: "standard", incrementBy: 1 } },
        due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD hh:mm", increment: { mode: "standard", incrementBy: 1 } },
      },
      canonical: { date_due: "due", date_start: "start", time: "timeNow" },
    });

    {
      /*
       * TagWheel открывается первым вызовом и применяет выбор вторым — тем же
       * порядком, каким его гоняют проверки исходников. Спрашивается не вид
       * панели, а то, что строка после двух вызовов цела: панель, не доехавшая
       * до бандла, роняет вызов, а не портит строку.
       */
      const editor = makeEditorStub("- [ ] #todo :: моя строка", 8);
      const settings = { "Date runtime config": dateRuntimeAll };
      await run(editor, "tagWheel", settings);
      await run(editor, "tagWheel", settings);
      const line = editor.snapshot();
      assert.ok(line.includes("моя строка"), "TagWheel из сборки не потерял текст человека");
      ok("TagWheel из сборки открылся и применился, строка цела");
    }

    {
      /*
       * Вся сессия панели — **одна** ступень истории отмен (A37, замечание
       * заказчика 2026-09-07: «я хочу, чтобы активация tagwheel воспринималась
       * как одно действие»).
       *
       * Что здесь нового по сравнению с прежней проверкой. Поведением было
       * закреплено только применение; открытие панели и нажатия внутри неё
       * держал сплошной обход по тексту исходника — сторож в
       * `bootstrap_loader_tests.js` сам называл, чего ему не хватает. Здесь
       * гоняется сессия целиком: открытие, три нажатия, применение — и
       * считается то, что видит история.
       *
       * Обработчик нажатий берётся оттуда, куда его повесил сам движок, —
       * `window.listeners.keydown`. Событие подделано (в Node нет клавиатуры),
       * но путь до записи строки настоящий.
       *
       * Сам `Ctrl+Z` с 2026-09-07 нажимается проверкой — на настоящей истории
       * CodeMirror, в `tagwheel_tests.js` (`runUndoAfterPanelSuite`). Здесь
       * спрашивается то, что видно **у сборки**: сколько записей просит
       * запомнить плагин и какой отрезок он для них выбрал.
       */
      const editor = makeHistoryEditorStub("- [ ] #todo :: моя строка", 8);
      const settings = { "Date runtime config": dateRuntimeAll };
      const keydowns = ((globalThis as Any).window.listeners.keydown || []) as Any[];
      const before = keydowns.length;
      await run(editor, "tagWheel", settings);
      const handler = keydowns[keydowns.length - 1];
      assert.ok(typeof handler === "function" && keydowns.length === before + 1,
        "панель открылась и повесила свой обработчик нажатий");
      const opened = editor.snapshot();
      assert.notStrictEqual(opened, "- [ ] #todo :: моя строка",
        "положительный контроль: панель нарисована, строка на экране изменилась");

      const press = (key: string): void => {
        handler({ key, preventDefault: () => {}, stopPropagation: () => {} });
      };
      press("ArrowUp");
      press("ArrowUp");
      press("ArrowRight");
      const drawsAfterKeys = editor.dispatched.length;
      /*
       * Записей столько, сколько нажатий **что-то изменили**: с 2026-09-07
       * строка, уже равная тому, что просят, не пишется вовсе — пустое
       * изменение всё равно заставило бы историю переносить чужие ступени
       * (A41). Прежнее «каждое нажатие перерисовало строку» после этого
       * перестало быть верным, а не сломалось (У-94).
       */
      assert.ok(drawsAfterKeys >= 3,
        "открытие и нажатия перерисовали строку (записей мимо истории " + drawsAfterKeys + ")");
      const emptyDraws = (editor.dispatched as Any[]).filter((spec: Any) => {
        const ch = spec && spec.changes ? spec.changes : {};
        return Number(ch.from) === Number(ch.to) && String(ch.insert || "") === "";
      });
      assert.strictEqual(emptyDraws.length, 0, "пустых записей панель не посылает");
      /*
       * И записи эти — **различия**, а не строка целиком (A41, У-97). Если
       * хоть одна пришла бы отрезком «вся строка», прежние ступени отмены
       * человека она бы и снесла. Спрашивается у сборки: правка живёт в
       * `tagwheel.js`, а у человека стоит бандл (У-89).
       */
      const shapes = (editor.dispatched as Any[]).map((spec: Any, i: number) => ({
        from: Number(spec.changes.from), to: Number(spec.changes.to),
        was: String((editor.dispatchedBefore as string[])[i] || "").length,
      }));
      const wholeLineDraws = shapes.filter((sh) => sh.from === 0 && sh.to === sh.was);
      assert.strictEqual(wholeLineDraws.length, 0,
        "ни одна запись панели из сборки не покрывает строку целиком: " + JSON.stringify(shapes));
      /*
       * И то, ради чего всё это: текст человека за отрезком остаётся. У первой
       * записи — вида панели поверх строки — конец отрезка обязан быть **до**
       * конца строки: там стоит `:: моя строка`.
       */
      assert.ok(shapes[0] && shapes[0].to < shapes[0].was,
        "вид панели пишется, не задевая текст человека: " + JSON.stringify(shapes[0]));
      assert.strictEqual(editor.plainWrites.length, 0,
        "пока панель открыта, история не получила ни одной записи: " + editor.plainWrites.join(" | "));

      press("Enter");
      const after = editor.snapshot();
      assert.ok(after.includes("моя строка"), "текст человека на месте: " + after);
      /*
       * Одна запись в историю на всю сессию — и это итог, а не вид панели.
       * Ступень истории читается как «исходная строка → итог»: возврат к
       * исходной послан мимо истории прямо перед ней.
       */
      assert.strictEqual(editor.plainWrites.length, 1,
        "история получила ровно одну запись на всю сессию: " + editor.plainWrites.join(" | "));
      assert.strictEqual(editor.plainWrites[0], after,
        "и это итоговая строка, а не вид панели");
      assert.ok(editor.dispatched.length > drawsAfterKeys,
        "перед итогом строка возвращена к исходной мимо истории");
      ok("вся сессия TagWheel из сборки — одна ступень истории отмен");
    }

  }

  /*
   * Transform из сборки — и он тоже на строке заказчика (R4, 2026-09-07).
   *
   * Четвёртый движок, и загрузка у него своя. Здесь он к тому же спрашивает
   * длину хвоста элемента у общего модуля: у Field формат `YYYY-MM-DD hh:mm`,
   * а `require` не разрешившийся в бандле оставил бы старое «до пробела» — и
   * половина даты осталась бы на строке текстом человека.
   *
   * Спрашивается то, что видит человек: строка после команды и содержимое
   * созданной заметки. Ожидание выписано словами заказчика, а не собрано тем
   * же кодом (У-5).
   */
  {
    /*
     * Конфиг пишется настоящим путём — `store.patch`, тем же, каким пишет
     * панель, и через ту же `migrateConfig`. Своего в нём ровно то, что
     * проверке нужно: один тег, один элемент **с пробелом в формате** и папка
     * для новых заметок. У свежей установки Fields нет ни одного, и без этого
     * проверка была бы зелёной оттого, что мерить нечего (У-88).
     */
    const dueMarker = "\u{1F4C5}";
    plugin.store.patch({
      pkm: {
        lineFormat: { separator1: "::", separator2: "::" },
        fields: {
          order: {
            left: ["type"], right: ["due"],
            types: { type: "tag", due: "element" },
            active: { type: "yes", due: "yes" },
            enabled: { type: true, due: true },
            strictNames: { type: "type", due: "due" },
          },
          tags: { fields: [{ id: "type", prefix: "#", values: [{ id: "todo", token: "todo", active: true }] }] },
          /*
           * Определения Field-элемента здесь нет нарочно: его строит сам
           * плагин по Order (`ensureBehaviorModesFromOrder`). Написанное руками
           * приезжает без `kind`, а по `kind` движки и узнают элемент — то есть
           * проверка гоняла бы Field, которого у человека не бывает (У-2).
           */
          elements: {
            fields: ["due"],
            byField: {
              due: {
                emoji: dueMarker,
                format: "YYYY-MM-DD hh:mm",
                increment: { mode: "standard", incrementBy: 1, command: "now", customRaw: [], custom: [] },
              },
            },
          },
        },
      },
      transform: {
        inline2note: {
          enabled: true,
          outputFolder: "Filed",
          defaultTemplate: "",
          smartRules: [],
          noteName: { mode: "auto", delimiters: "[]", wordCount: 6, preferHeaderTitle: false },
          placement: { position: "end", headerMode: "none", customHeader: "", datetimeFormat: "YYYY-MM-DD" },
          sourceProcessing: {
            cleanupFieldIds: [], token: "#processed", panel: "right",
            replaceWithLink: true, text: "words", keepWords: 2,
          },
          sublines: "stay",
          openTarget: false,
        },
      },
    }, "bundle test: Fields и Transform");
    const elementCfg = plugin.getConfig().pkm.fields.elements.byField.due;
    assert.strictEqual(elementCfg && elementCfg.format, "YYYY-MM-DD hh:mm",
      "формат с пробелом записался: иначе у проверки нет предмета");

    const line = `- [ ] #todo :: [моё имя] ещё текст :: ${dueMarker}2026-09-07 11:25`;
    const editor = makeTransformEditorStub(line);
    app.workspace.activeEditor = { editor };
    app.workspace.activeLeaf = { view: { editor } };
    app.workspace.getActiveFile = () => ({ parent: { path: "" } });
    app.workspace.getLeaf = () => null;
    attachTransformVault(app);

    const cmd = plugin.commands.find((c: Any) => String(c && c.id) === "transform-inline-to-note");
    assert.ok(cmd && typeof cmd.callback === "function", "команда Transform есть в сборке");
    loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
      if (request === "obsidian") return platform;
      if (request === "@codemirror/view") return cmStub();
      if (request === "@codemirror/state") return cmStateStub();
      return origLoad.call(this, request, parent, isMain);
    };
    try {
      await cmd.callback();
    } finally {
      loader._load = origLoad;
    }

    const after = editor.snapshot();
    /* Положительный контроль: команда вообще отработала, а не тихо вернулась. */
    assert.notStrictEqual(after, line, "Transform из сборки переписал исходную строку");
    assert.ok(!after.includes("11:25"),
      "от даты не осталось половины: элемент снят целиком, вместе со временем — " + after);
    assert.ok(!after.includes("[моё имя]"),
      "имя новой заметки не осталось на строке текстом — " + after);
    assert.ok(after.includes("[[") && after.includes("моё имя"),
      "на строке стоит ссылка на созданную заметку — " + after);

    const writtenPaths = Array.from(app.written.keys()).map((p: unknown) => String(p));
    const notePath = writtenPaths.find((p) => /моё имя\.md$/.test(p));
    assert.ok(notePath, "заметка создана: " + writtenPaths.join(", "));
    const note = String(app.written.get(notePath) || "");
    assert.ok(note.includes("ещё текст"), "текст человека уехал в заметку");
    assert.ok(!note.includes("[моё имя]"),
      "название не продублировано текстом внутри заметки — " + note);
    assert.ok(note.includes("2026-09-07 11:25"),
      "дата уехала в заметку целиком, вместе со временем — " + note);
    ok("Transform из сборки: дата снята целиком, название не осталось текстом");
  }

  /*
   * Та же команда из той же сборки — и второе правило про название (T1,
   * 2026-09-07). Имени в скобках здесь нет: название собирается из первых
   * шести слов текста, и ссылка обязана встать **на их место**, а не за ними.
   *
   * Заказчик видел `тест-трансформ4 тест1 [[…]]` — слова названия остались на
   * строке, а ссылка встала за первыми двумя из них. Настройки те же, что у
   * него: `wordCount` = 6, `words`, `keepWords` = 2.
   */
  {
    const dueMarker = "\u{1F4C5}";
    const line = `- [ ] #todo :: слово1 слово2 слово3 слово4 слово5 слово6 слово7 :: ${dueMarker}2026-09-07 13:27`;
    const editor = makeTransformEditorStub(line);
    app.workspace.activeEditor = { editor };
    app.workspace.activeLeaf = { view: { editor } };

    const cmd = plugin.commands.find((c: Any) => String(c && c.id) === "transform-inline-to-note");
    assert.ok(cmd && typeof cmd.callback === "function", "команда Transform есть в сборке");
    loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
      if (request === "obsidian") return platform;
      if (request === "@codemirror/view") return cmStub();
      if (request === "@codemirror/state") return cmStateStub();
      return origLoad.call(this, request, parent, isMain);
    };
    try {
      await cmd.callback();
    } finally {
      loader._load = origLoad;
    }

    const after = editor.snapshot();
    assert.notStrictEqual(after, line, "положительный контроль: команда отработала, а не вернулась молча");
    const link = "[[Filed/слово1 слово2 слово3 слово4 слово5 слово6]]";
    assert.ok(after.includes(link), "ссылка на созданную заметку стоит на строке — " + after);
    /* Слова названия со строки ушли: до ссылки от них не осталось ничего. */
    assert.ok(!/слово1 слово2/.test(after.slice(0, after.indexOf(link))),
      "слова, ставшие названием, до ссылки не остались — " + after);
    /* А остаток остался, и стоит он ПОСЛЕ ссылки — на месте, где был. */
    assert.ok(after.indexOf("слово7") > after.indexOf(link),
      "остаток текста стоит после ссылки, а не до неё — " + after);
    ok("Transform из сборки: ссылка встала на место слов, ставших названием");
  }

  /*
   * И третья строка заказчика той же командой из той же сборки (A39,
   * 2026-09-07 вечер): уборка Values снимает со строки **весь** левый сегмент.
   *
   * Тогда пустой слот схлопывается, Separator у строки остаётся один — и он
   * второй. Он прислал `- ывыв ывы :: 📅2026-09-07 18:56 [[333/ывыв ывы]] ::
   * #processed`: ссылка уехала за дату, а метка завела ещё один Separator,
   * потому что дальше строку разбирали заново и читали наоборот.
   *
   * Здесь спрашивается сборка: правка живёт в `transform_feature.js`, а у
   * человека лежит бандл (У-89). Дату оставляем на строке — `cleanupFieldIds`
   * с одним Field, — иначе правой части не останется и предмета у проверки
   * нет вовсе (У-88).
   */
  {
    const dueMarker = "\u{1F4C5}";
    plugin.store.patch({
      transform: {
        inline2note: {
          sourceProcessing: {
            cleanupFieldIds: ["due"], token: "#processed", panel: "right",
            replaceWithLink: true, text: "words", keepWords: 2,
          },
        },
      },
    }, "bundle test: уборка снимает левый сегмент");
    const kept = plugin.getConfig().transform.inline2note.sourceProcessing.cleanupFieldIds;
    assert.deepStrictEqual(kept, ["due"], "дата остаётся на строке: иначе мерить нечего");

    const line = `- [ ] #todo :: ывыв ывы :: ${dueMarker}2026-09-07 18:56`;
    const editor = makeTransformEditorStub(line);
    app.workspace.activeEditor = { editor };
    app.workspace.activeLeaf = { view: { editor } };

    const cmd = plugin.commands.find((c: Any) => String(c && c.id) === "transform-inline-to-note");
    loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
      if (request === "obsidian") return platform;
      if (request === "@codemirror/view") return cmStub();
      if (request === "@codemirror/state") return cmStateStub();
      return origLoad.call(this, request, parent, isMain);
    };
    try {
      await cmd.callback();
    } finally {
      loader._load = origLoad;
    }

    const after = editor.snapshot();
    assert.notStrictEqual(after, line, "положительный контроль: команда отработала");
    const link = "[[Filed/ывыв ывы]]";
    const date = `${dueMarker}2026-09-07 18:56`;
    assert.ok(after.includes(link), "ссылка на созданную заметку стоит на строке — " + after);
    assert.ok(after.includes(date), "дата человека на строке цела — " + after);
    /* Главное: ссылка стоит **до** даты, то есть на месте текста. */
    assert.ok(after.indexOf(link) < after.indexOf(date),
      "ссылка встала на место текста, а не за правой частью — " + after);
    /* И метка не завела второй Separator: она приписана к правой части. */
    assert.strictEqual((after.match(/::/g) || []).length, 1,
      "Separator на строке остался один — " + after);
    assert.ok(after.trimEnd().endsWith("#processed"),
      "метка стоит в конце правой части — " + after);
    ok("Transform из сборки: текст и правая часть не поменялись местами");
  }

  /*
   * Правая часть строки переживает TagWheel — и переживает В СБОРКЕ
   * (замечание заказчика 2026-09-07).
   *
   * Строка та же, что у него, и время в ней **в прошлом**: значение элемента
   * хранится смещением от «сегодня», смещение ищется перебором вперёд, и такая
   * запись им не выражается никогда. Раньше в сессию не попадало ничего, а
   * правую часть TagWheel собирает заново из сессии — и она исчезала. Дата с
   * временем нужна ещё и затем, что граф токенов резал её пополам по пробелу.
   *
   * **Правила берутся не из фикстуры, а те, что плагин пишет сам** из конфига,
   * заданного выше: у фикстуры репозитория Due объявлен другой формой, и на
   * ней предмета измерения нет вовсе — проверка была бы зелёной от пустоты
   * (У-88), что и показали две мутации, её не уронившие.
   */
  {
    const ownRulesPath = ".obsidian/plugins/inline-overhaul/generated_rules.md";
    await plugin.ensureGeneratedRulesNow("bundle test: правила по своему конфигу");
    const ownRules = String(app.written.get(ownRulesPath) || "");
    assert.ok(/```tagwheel-/.test(ownRules), "плагин переписал служебный файл под новый конфиг");

    const vaultRulesPath = "OwnRules.md";
    app.written.set(vaultRulesPath, ownRules);

    const payload = "\u{1F4C5}2000-01-02 03:04";
    const editor = makeTransformEditorStub(`- 11 :: ${payload}`);
    app.workspace.activeEditor = { editor };
    app.workspace.activeLeaf = { view: { editor } };

    const cfgNow = plugin.getConfig();
    const twSettings = {
      "Rules path": vaultRulesPath,
      "Order config": JSON.stringify(cfgNow.pkm.fields.order),
      "Date runtime config": JSON.stringify({
        byField: { due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD hh:mm", increment: { mode: "standard", incrementBy: 1 } } },
        canonical: { date_due: "due" },
      }),
      "Cycle end behavior": "keep-bullet",
      "Cursor policy": "text_end",
    };
    const wheel = async (): Promise<void> => {
      await plugin.pkmRuntimeV2.runCommand({ app, command: "tagWheel", settings: twSettings });
    };

    await wheel();
    /*
     * Между вызовами человек выбирает значение стрелкой. Без выбора второй
     * вызов применяет пустое, строка не меняется вовсе — и проверка зеленеет
     * оттого, что мерить нечего. Выбор ставится в **настоящем** объекте сессии,
     * который завёл сам движок: нажатия клавиши в Node нет.
     */
    const session = (globalThis as Any).window
      && (globalThis as Any).window.__tagWheelState
      && (globalThis as Any).window.__tagWheelState.session;
    assert.ok(session && session.selected, "TagWheel в сборке завёл сессию: панель открылась");
    assert.ok(Object.prototype.hasOwnProperty.call(session.selected, "due"),
      "Field-элемент доехал до сессии: есть что терять — " + Object.keys(session.selected).join(", "));
    assert.strictEqual(String(session.selected.due || ""), "2000-01-02 03:04",
      "значение элемента прочитано со строки целиком, вместе со временем");
    session.selected.type = "todo";
    session.activeFieldId = "type";
    await wheel();

    const line = editor.snapshot();
    assert.notStrictEqual(line, `- 11 :: ${payload}`,
      "TagWheel в сборке отработал, а не вернулся молча — " + line);
    assert.ok(line.includes("11"), "текст человека на месте — " + line);
    assert.ok(line.includes(payload),
      "правая часть строки пережила TagWheel в сборке целиком, вместе со временем — " + line);
    ok("TagWheel из сборки не съедает правую часть строки");
  }

  console.log(`Bundle onload tests: OK (${passed} checks)`);
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
