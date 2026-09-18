/**
 * Внешняя правка `data.json` не затирается, а принимается (Р-2).
 *
 * **Что было.** Платформа с 1.5.7 зовёт у плагина `onExternalSettingsChange()`,
 * когда файл настроек изменён снаружи — синхронизацией, вторым компьютером,
 * правкой руками. В репозитории этого имени не было ни разу: `ConfigStore.config`
 * оставался прежним, и ближайшая отложенная запись клала **старое поверх
 * нового**. Разбор — `docs/AUDIT_2026-09-18.md`, 4.2.
 *
 * **Его слово — «диск сильнее»** (В-142, 2026-09-18): перечитать, перерисовать
 * панель и сказать об этом `Notice`. Окна с выбором «чьё оставить» нет.
 *
 * **Что здесь настоящее** (У-1). Настоящие: `ConfigStore` целиком с его
 * таймером и стеком отмены, настоящий `config_write.applyExternalChange`,
 * настоящий класс плагина из `main.js` — то есть шов `onExternalSettingsChange`
 * исполняется, а не проверяется на наличие (У-141). Подделаны два шва: `saveData`
 * и `loadData`, то есть диск, которого в Node нет, и `registerCommands` —
 * реестру команд Obsidian здесь взяться неоткуда.
 *
 * **Чем закреплено — написано до правки** (`docs/AUDIT_2026-09-18.md`, Р-2):
 * внешняя правка доезжает до конфига; подписчик панели просыпается; `Notice`
 * сказан один раз, а не на каждый ключ; и отрицательный контроль — **наша
 * собственная** запись не выглядит внешней и перечитывания по кругу не будит.
 * Плюс то, ради чего всё это: отложенная запись после приёма не кладёт на диск
 * вчерашнее.
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
const requireCjs = Module.createRequire(path.join(root, "main.js"));

const { ConfigStore } = requireCjs("./src/core/config_store.js") as Any;
const su = requireCjs("./src/core/shared_utils.js") as Any;
const configNormalize = requireCjs("./src/core/config_normalize.js") as Any;

let passed = 0;
function ok(what: string): void { passed++; console.log("  ok " + what); }
function assertEq(actual: Any, expected: Any, name: string): void {
  if (actual !== expected) {
    throw new Error(name + ": expected " + JSON.stringify(expected) + " got " + JSON.stringify(actual));
  }
}

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
const clone = (x: Any): Any => JSON.parse(JSON.stringify(x));

/**
 * Класс плагина из `main.js`, собранный своим же загрузчиком. Подменяются два
 * модуля: `obsidian` — заглушкой набора, CodeMirror — общей заглушкой (она нужна
 * уже при загрузке, а к настройкам отношения не имеет).
 */
function loadPluginClass(): Any {
  const mainPath = path.join(root, "main.js");
  const src = fs.readFileSync(mainPath, "utf8");
  const platform = { ...obsidianStub, setIcon: (): void => {}, MarkdownView: class {} };
  const loader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    _nodeModulePaths: (dir: string) => string[];
  };
  const origLoad = loader._load;
  loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
    if (request === "obsidian") return platform;
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
    return mod.exports;
  } finally {
    loader._load = origLoad;
  }
}

/**
 * Плагин с подделанным диском.
 *
 * `disk.data` — то, что лежит в `data.json`. `loadData` читает оттуда **копию**:
 * иначе принятое было бы тем же объектом, что и записанное, и сравнение
 * содержимого зеленело бы само (У-92).
 */
function makePlugin(PluginClass: Any, opts?: { realMigration?: boolean }): Any {
  const disk: { data: Any; writes: Any[] } = { data: null, writes: [] };
  const plugin = new PluginClass(obsidianStub.makeApp(), { id: "inline-overhaul", version: "0.0.0-test" });
  plugin.loadData = async (): Promise<Any> => (disk.data === null ? null : clone(disk.data));
  plugin.saveData = async (cfg: Any): Promise<void> => {
    disk.data = clone(cfg);
    disk.writes.push(clone(cfg));
  };
  /* Подделка шва: реестра команд Obsidian в Node нет. Счётчик нужен сам по
     себе — набор команд PKM строится из конфига один раз (У-79). */
  let commandRebuilds = 0;
  plugin.registerCommands = (): void => { commandRebuilds++; };
  plugin.commandRebuilds = (): number => commandRebuilds;
  plugin.disk = disk;

  plugin.store = new ConfigStore(plugin, {
    defaults: opts && opts.realMigration
      ? clone(configNormalize.DEFAULT_CONFIG)
      : { configVersion: 2, general: { language: "en" } },
    cloneJson: su.cloneJson,
    isObj: su.isObj,
    deepMerge: su.deepMerge,
    /*
     * Тождество там, где предмет — таймер, стек отмены и сравнение содержимого:
     * миграция к ним отношения не имеет. Там, где предмет — «своя запись не
     * выглядит внешней», берётся **настоящая** миграция: если она не идемпотентна,
     * каждая наша запись читалась бы как чужая и плагин ходил бы по кругу.
     */
    migrateConfig: opts && opts.realMigration
      ? (c: Any): Any => configNormalize.migrateConfig(c)
      : (c: Any): Any => su.cloneJson(c),
    Notice: obsidianStub.Notice,
    saveDebounceMs: 60,
  });
  return plugin;
}

function langOf(cfg: Any): string {
  return cfg && cfg.general ? String(cfg.general.language) : "(нет ветки general)";
}

async function run(): Promise<void> {
  obsidianStub.setupGlobals();
  const PluginClass = loadPluginClass();
  if (typeof PluginClass !== "function") throw new Error("main.js не отдал класс плагина");

  /* ---- шов существует и это метод плагина ------------------------------ */
  {
    const plugin = makePlugin(PluginClass);
    assertEq(typeof plugin.onExternalSettingsChange, "function",
      "у плагина есть onExternalSettingsChange");
    ok("шов, по наличию которого платформа решает, следить ли за файлом, есть");
  }

  /* ---- предмет: внешняя правка доезжает до конфига ---------------------- */
  {
    const plugin = makePlugin(PluginClass);
    await plugin.store.init();
    obsidianStub.notices.length = 0;

    /* Кто-то снаружи переписал файл целиком. */
    plugin.disk.data = { configVersion: 2, general: { language: "ru" } };
    const took = await plugin.onExternalSettingsChange();

    assertEq(took, true, "приём сказал, что что-то изменилось");
    assertEq(langOf(plugin.getConfig()), "ru", "в памяти плагина то, что лежит на диске");
    assertEq(obsidianStub.notices.length, 1, "человеку сказано ровно один раз");
    assertEq(plugin.commandRebuilds(), 1, "набор команд пересобран: Fields могли приехать другие");
    ok("внешняя правка доезжает до конфига, и об этом сказано один раз");
  }

  /* ---- то, ради чего всё: отложенная запись не кладёт вчерашнее --------- */
  {
    const plugin = makePlugin(PluginClass);
    await plugin.store.init();
    plugin.disk.writes.length = 0;

    /* Человек только что поправил настройку: запись отложена на 60 мс. */
    plugin.store.patch({ general: { language: "de" } }, "проба");
    /* И в это окно приехала правка снаружи. */
    plugin.disk.data = { configVersion: 2, general: { language: "ru" } };
    await plugin.onExternalSettingsChange();

    /* Ждём дольше окна отложенной записи: если таймер выжил, он допишет "de". */
    await sleep(200);

    assertEq(langOf(plugin.disk.data), "ru", "на диске осталось принесённое снаружи");
    assertEq(plugin.disk.writes.length, 0, "приём внешней правки сам ничего не записывает");
    assertEq(langOf(plugin.getConfig()), "ru", "в памяти тоже принесённое");
    ok("отложенная запись после приёма не кладёт на диск вчерашнее");
  }

  /* ---- ступени отмены: нечего отменять в документ, которого нет --------- */
  {
    const plugin = makePlugin(PluginClass);
    await plugin.store.init();
    plugin.store.patch({ general: { language: "de" } }, "проба");
    assertEq(plugin.store.undo() === true, true, "контроль: обычная отмена работает");

    plugin.store.patch({ general: { language: "de" } }, "проба");
    plugin.disk.data = { configVersion: 2, general: { language: "ru" } };
    await plugin.onExternalSettingsChange();
    assertEq(plugin.store.undo(), false, "отменять принесённое снаружи нечем");
    assertEq(langOf(plugin.getConfig()), "ru", "отмена не вернула наше вчерашнее состояние");
    ok("после приёма Ctrl+Z не записывает наше состояние поверх принесённого");
  }

  /* ---- панель просыпается ---------------------------------------------- */
  {
    const plugin = makePlugin(PluginClass);
    await plugin.store.init();
    /* Тем же швом, каким подписана панель: `ConfigStoreAdapter` зовёт
       `store.subscribe`, а `SettingsPane` по нему будит свои блоки. */
    let wakes = 0;
    let lastReason = "";
    plugin.store.subscribe((payload: Any) => { wakes++; lastReason = String(payload.reason); });

    plugin.disk.data = { configVersion: 2, general: { language: "ru" } };
    await plugin.onExternalSettingsChange();

    assertEq(wakes, 1, "подписчик разбужен ровно один раз, а не по разу на ключ");
    assertEq(lastReason, "external", "причина названа своим именем");
    ok("панель узнаёт о внешней правке тем же швом, каким узнаёт обо всех");
  }

  /* ---- отрицательный контроль: своя запись не выглядит внешней ---------- */
  {
    const plugin = makePlugin(PluginClass, { realMigration: true });
    await plugin.store.init();
    obsidianStub.notices.length = 0;

    /* Человек поправил настройку, запись дошла до диска. */
    plugin.store.patch({ general: { language: "ru" } }, "проба");
    await sleep(200);
    assertEq(langOf(plugin.disk.data), "ru", "контроль: наша запись и правда на диске");

    /* Платформа зовёт шов: время файла она сравнивает сама, и на неточных
       файловых системах наша запись доезжает сюда. */
    const took = await plugin.onExternalSettingsChange();
    assertEq(took, false, "своя запись внешней не считается");
    assertEq(obsidianStub.notices.length, 0, "и человеку про неё ничего не сказано");

    /* Второй заход по тому же файлу: если бы приём был не идемпотентен, здесь
       начался бы круг «перечитали — записали — перечитали». */
    assertEq(await plugin.onExternalSettingsChange(), false, "и на втором заходе тоже");
    ok("отрицательный контроль: своя запись не будит перечитывание по кругу");
  }

  /* ---- нечитаемый файл настроек не стирает ------------------------------ */
  /*
   * **Охран здесь две, и это не копия — у них разные дела**: путь записи
   * отказывается вслух (в журнал разработчика), хранилище защищает своё дерево.
   * Первая мутация показала, что обе неразличимы поведением: снимаешь любую —
   * вторая держит, и проверка зелёная (У-134). Поэтому у каждой спрашивается
   * **её** признак: у первой — сказанный отказ, у второй — прямой вызов.
   */
  {
    const plugin = makePlugin(PluginClass);
    await plugin.store.init();
    plugin.store.patch({ general: { language: "ru" } }, "проба");
    await sleep(200);
    obsidianStub.notices.length = 0;

    /*
     * `Vault.readJson` в `app.js` 1.13.7 отдаёт `null` на пропавший файл и
     * `undefined` на сломанный JSON — то есть ровно то, из чего `migrateConfig`
     * собрал бы умолчания и стёр бы человеку всё дерево настроек.
     */
    const said: string[] = [];
    const origError = console.error;
    console.error = (...args: Any[]): void => { said.push(args.map(String).join(" ")); };
    try {
      for (const bad of [null, undefined, "строка", 42]) {
        plugin.loadData = async (): Promise<Any> => bad as Any;
        assertEq(await plugin.onExternalSettingsChange(), false,
          "нечитаемый файл (" + String(bad) + ") приёмом не считается");
        assertEq(langOf(plugin.getConfig()), "ru", "настройки остались прежними");
      }
    } finally {
      console.error = origError;
    }
    assertEq(obsidianStub.notices.length, 0, "и человеку ничего не обещано");
    assertEq(said.filter(s => s.includes("[config:external]")).length, 4,
      "отказ сказан вслух на каждом заходе, а не проглочен");
    ok("нечитаемый или пропавший файл настройки не стирает, и отказ сказан вслух");
  }

  /* ---- та же охрана у самого хранилища, спрошенная прямо ---------------- */
  {
    const plugin = makePlugin(PluginClass);
    await plugin.store.init();
    plugin.store.patch({ general: { language: "ru" } }, "проба");
    for (const bad of [null, undefined, "строка", 42, []]) {
      assertEq(plugin.store.adoptExternal(bad), false,
        "хранилище не принимает " + JSON.stringify(bad) + " за конфиг");
      assertEq(langOf(plugin.store.getSnapshot()), "ru", "дерево настроек цело");
    }
    ok("хранилище защищает своё дерево само, не полагаясь на звавшего");
  }

  /* ---- отказ чтения не роняет плагин ------------------------------------ */
  {
    const plugin = makePlugin(PluginClass);
    await plugin.store.init();
    plugin.store.patch({ general: { language: "ru" } }, "проба");
    await sleep(200);
    plugin.loadData = async (): Promise<Any> => { throw new Error("диск отвалился"); };
    assertEq(await plugin.onExternalSettingsChange(), false, "отказ чтения приёмом не считается");
    assertEq(langOf(plugin.getConfig()), "ru", "настройки остались прежними");
    ok("отказ чтения файла не роняет плагин и не трогает настройки");
  }

  console.log("Config external change tests: OK (" + passed + " checks)");
}

run().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
