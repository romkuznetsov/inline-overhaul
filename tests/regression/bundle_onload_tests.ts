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

    {
      /*
       * TagWheel открывается первым вызовом и применяет выбор вторым — тем же
       * порядком, каким его гоняют проверки исходников. Спрашивается не вид
       * панели, а то, что строка после двух вызовов цела: панель, не доехавшая
       * до бандла, роняет вызов, а не портит строку.
       */
      const editor = makeEditorStub("- [ ] #todo :: моя строка", 8);
      await run(editor, "tagWheel", {});
      await run(editor, "tagWheel", {});
      const line = editor.snapshot();
      assert.ok(line.includes("моя строка"), "TagWheel из сборки не потерял текст человека");
      ok("TagWheel из сборки открылся и применился, строка цела");
    }
  }

  console.log(`Bundle onload tests: OK (${passed} checks)`);
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
