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

  console.log(`Bundle onload tests: OK (${passed} checks)`);
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
