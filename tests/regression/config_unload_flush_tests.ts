/**
 * Отложенная запись настроек доживает до диска при выгрузке плагина (CS7).
 *
 * **Что было.** `ConfigStore.scheduleSave` откладывает запись на
 * `saveDebounceMs`, а `ConfigStore.unload()` тот же таймер снимает и ничего не
 * пишет. То есть правка, сделанная человеком в последнюю четверть секунды перед
 * выключением плагина, его обновлением через BRAT или закрытием Obsidian,
 * пропадала — и пропадала молча. Воспроизведено 2026-09-18, разбор —
 * `docs/dev/AUDIT_2026-09-18.md`, раздел 4.1.
 *
 * **Почему этого не видел ни один сторож.** `flushNow()` рядом лежал с самого
 * начала, и PRD (CS7) прямо говорит, что он «нужен в `onunload`». Звать его не
 * звал никто. Мёртвый метод класса — форма, которой `dead_exports_tests.js` не
 * видит: он считает экспорты модуля и честно печатает «0 из 866».
 *
 * **Что здесь настоящее** (У-1). Настоящие: `ConfigStore` целиком, его таймер,
 * его миграция патча, и — во второй половине — настоящий `onunload` из
 * `main.js`, исполненный своим же модульным загрузчиком. Подделан ровно один
 * шов: `saveData` у плагина, то есть граница с диском, которой в Node нет.
 *
 * **Проверяется поведение, а не вызов.** Утверждение звучит «после выгрузки на
 * диске лежит то, что человек написал», а не «`flushNow` был позван»: второе
 * зеленело бы и от вызова, который ничего не пишет.
 */

import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as obsidianStub from "../harness/obsidian_stub.ts";
import { cmStub } from "../harness/plugin_internals.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = Module.createRequire(path.join(root, "src", "main.js"));

const { ConfigStore } = requireCjs("./core/config_store.js") as Any;
const su = requireCjs("./core/shared_utils.js") as Any;

let passed = 0;
function ok(what: string): void { passed++; console.log("  ok " + what); }
function assertEq(actual: Any, expected: Any, name: string): void {
  if (actual !== expected) {
    throw new Error(name + ": expected " + JSON.stringify(expected) + " got " + JSON.stringify(actual));
  }
}

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

/** Хранилище с настоящим таймером; на диск вместо записи кладём в список. */
function makeStore(saved: Any[], debounceMs?: number): Any {
  const plugin = {
    loadData: async (): Promise<Any> => ({ configVersion: 2 }),
    saveData: async (cfg: Any): Promise<void> => { saved.push(JSON.parse(JSON.stringify(cfg))); },
  };
  return new ConfigStore(plugin, {
    defaults: { configVersion: 2, general: { language: "en" } },
    cloneJson: su.cloneJson,
    isObj: su.isObj,
    deepMerge: su.deepMerge,
    /*
     * Миграция здесь не предмет: берём тождество, чтобы мерить только запись.
     * Настоящую миграцию патча проверяет `settings_layer_tests.ts`.
     */
    migrateConfig: (c: Any): Any => su.cloneJson(c),
    Notice: function (): void { /* сообщений в этой проверке нет */ },
    saveDebounceMs: debounceMs === undefined ? 250 : debounceMs,
  });
}

function langOf(saved: Any[]): string {
  const last = saved[saved.length - 1];
  return last && last.general ? String(last.general.language) : "(ничего не записано)";
}

async function run(): Promise<void> {

  /* ---- контроль: обычный путь записи работает --------------------------- */
  {
    const saved: Any[] = [];
    const store = makeStore(saved);
    await store.init();
    saved.length = 0;
    store.patch({ general: { language: "ru" } }, "проба");
    await sleep(400);
    assertEq(saved.length, 1, "контроль: обычная отложенная запись прошла");
    assertEq(langOf(saved), "ru", "контроль: на диске то, что написали");
    ok("контроль: без выгрузки правка доезжает до диска");
  }

  /* ---- предмет: выгрузка внутри окна отложенной записи ------------------ */
  {
    const saved: Any[] = [];
    const store = makeStore(saved);
    await store.init();
    saved.length = 0;
    store.patch({ general: { language: "ru" } }, "проба");
    await sleep(50);                       // человек не досидел до 250 мс
    const written = await store.flushNow();
    store.unload();
    assertEq(written, true, "flushNow сказал, что дописывать было что");
    assertEq(saved.length, 1, "отложенная запись дописана");
    assertEq(langOf(saved), "ru", "на диске лежит правка человека");
    ok("правка, сделанная перед выгрузкой, дописана");
  }

  /* ---- дописывать нечего: лишней записи не появляется ------------------- */
  {
    const saved: Any[] = [];
    const store = makeStore(saved);
    await store.init();
    saved.length = 0;
    const written = await store.flushNow();
    assertEq(written, false, "flushNow сказал, что дописывать нечего");
    assertEq(saved.length, 0, "лишней записи на ровном месте нет");
    ok("ничего не отложено — ничего и не пишется");
  }

  /* ---- сам `unload` по-прежнему только снимает таймер ------------------- */
  {
    const saved: Any[] = [];
    const store = makeStore(saved);
    await store.init();
    saved.length = 0;
    store.patch({ general: { language: "ru" } }, "проба");
    store.unload();
    await sleep(400);
    assertEq(saved.length, 0, "unload сам по себе не пишет — правило живёт в onunload");
    ok("отрицательный контроль: снятие таймера само записи не делает");
  }

  /* ---- настоящий `onunload` из `main.js` -------------------------------- */
  {
    const mainPath = path.join(root, "src", "main.js");
    const src = fs.readFileSync(mainPath, "utf8");
    const platform = { ...obsidianStub, setIcon: (): void => {}, MarkdownView: class {} };
    const loader = Module as unknown as {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
      _nodeModulePaths: (dir: string) => string[];
    };
    const origLoad = loader._load;
    let PluginClass: Any = null;
    loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
      if (request === "obsidian") return platform;
      /* CodeMirror требует настоящий `document` уже при загрузке, а к записи
         настроек отношения не имеет. Заглушка берётся общая — своя копия здесь
         уже разошлась бы с ней: плоский `{}` рвёт цепочку прототипов у
         виджетов декораций (У-32). */
      if (request === "@codemirror/view" || request === "@codemirror/state") return cmStub();
      return origLoad.call(this, request, parent, isMain);
    };
    try {
      const mod = new (Module as unknown as new (id: string, parent: unknown) => {
        filename: string; paths: string[]; exports: Any;
        _compile: (code: string, filename: string) => void;
      })(mainPath, null);
      mod.filename = mainPath;
      mod.paths = loader._nodeModulePaths(path.dirname(mainPath));
      mod._compile(src, mainPath);
      PluginClass = mod.exports;
    } finally {
      loader._load = origLoad;
    }
    if (typeof PluginClass !== "function") throw new Error("main.js не отдал класс плагина");

    obsidianStub.setupGlobals();

    const saved: Any[] = [];
    const store = makeStore(saved);
    await store.init();
    saved.length = 0;

    const plugin = new PluginClass(obsidianStub.makeApp(), { id: "inline-overhaul", version: "0.0.0-test" });
    plugin.store = store;

    store.patch({ general: { language: "ru" } }, "проба");
    plugin.onunload();
    /* `saveData` асинхронна; ждём такт, а не заглядываем внутрь обещания. */
    await sleep(50);

    assertEq(saved.length, 1, "onunload дописал отложенную запись");
    assertEq(langOf(saved), "ru", "на диске после выгрузки — правка человека");
    ok("настоящий onunload из main.js дописывает отложенную запись");

    /* Отрицательный контроль к самой фикстуре: выгрузка без хранилища не
       падает и ничего не пишет. Без него «записей 1» могло бы получаться и от
       чего-то, что пишет само. */
    const saved2: Any[] = [];
    const bare = new PluginClass(obsidianStub.makeApp(), { id: "inline-overhaul", version: "0.0.0-test" });
    bare.store = null;
    bare.onunload();
    await sleep(20);
    assertEq(saved2.length, 0, "без хранилища выгрузка ничего не пишет");
    ok("отрицательный контроль: без хранилища выгрузка молчит и не падает");
  }

  console.log("Config unload flush tests: OK (" + passed + " checks)");
}

run().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
