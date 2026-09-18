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
const requireCjs = Module.createRequire(path.join(root, "src", "main.js"));

const { ConfigStore } = requireCjs("./core/config_store.js") as Any;
/*
 * Берётся **после** загрузки класса плагина: `config_write.js` требует
 * `obsidian`, а заглушка на его месте живёт только внутри `loadPluginClass`.
 * Там модуль и попадает в кеш — здесь достаётся уже загруженным.
 */
let configWrite: Any = null;
const su = requireCjs("./core/shared_utils.js") as Any;
const configNormalize = requireCjs("./core/config_normalize.js") as Any;

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
  const mainPath = path.join(root, "src", "main.js");
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
function makePlugin(PluginClass: Any, opts?: { realMigration?: boolean; guarded?: boolean }): Any {
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
    /*
     * Тот же шов, каким его ставит загрузка. Заводится по просьбе, а не всегда:
     * без него проверяется хранилище само по себе, с ним — вторая точка, где
     * спрашивается «диск сильнее».
     */
    beforeWrite: opts && opts.guarded
      ? async (): Promise<boolean> => !(await configWrite.adoptIfDiskChanged(plugin))
      : undefined,
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
  configWrite = requireCjs("./core/config_write.js") as Any;
  if (typeof configWrite.adoptIfDiskChanged !== "function") {
    throw new Error("config_write не отдал adoptIfDiskChanged");
  }

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

  /* ---- диск сильнее и тогда, когда платформа промолчала (`C1`) ---------- */
  /*
   * **Его случай, и он воспроизводится буквально.** Он скопировал `data.json`
   * из другого vault поверх файла — и не увидел ничего. Причина не в нашем
   * коде: `_onConfigFileChange` платформы (`app.js` 1.13.7) зовёт шов только у
   * файла **новее** нашей записи, а копирование переносит время источника.
   * Здесь платформа молчит буквально: `onExternalSettingsChange` не зовётся ни
   * разу, а файл на диске подменяется чужим.
   */
  {
    const plugin = makePlugin(PluginClass, { guarded: true });
    await plugin.store.init();
    obsidianStub.notices.length = 0;

    /* Человек что-то поменял в панели — запись отложена. */
    plugin.store.patch({ general: { language: "ru" } }, "проба");
    /* И ровно в это время файл подменили снаружи, не тронув сигнал платформы. */
    plugin.disk.data = { configVersion: 2, general: { language: "de" } };
    const writesBefore = plugin.disk.writes.length;
    await sleep(200);

    assertEq(langOf(plugin.getConfig()), "de", "принято то, что лежит на диске");
    assertEq(plugin.disk.writes.length, writesBefore,
      "отложенная запись брошена: вчерашнее на диск не легло");
    assertEq(langOf(plugin.disk.data), "de", "и файл остался тем, который принесли");
    assertEq(obsidianStub.notices.length, 1, "человеку сказано один раз");
    ok("`C1`: чужой файл принимается и без сигнала платформы, своя запись брошена");
  }

  /* ---- и отрицательный контроль к нему: своя запись доходит до диска ----- */
  /*
   * Без этого «диск сильнее» выполнял бы и код, который не пишет **никогда**
   * (У-127): правка в панели обязана лечь в файл, а не быть принята за чужую.
   */
  {
    const plugin = makePlugin(PluginClass, { guarded: true });
    await plugin.store.init();
    obsidianStub.notices.length = 0;
    const writesBefore = plugin.disk.writes.length;

    plugin.store.patch({ general: { language: "ru" } }, "проба");
    await sleep(200);

    assertEq(plugin.disk.writes.length, writesBefore + 1, "правка человека записана");
    assertEq(langOf(plugin.disk.data), "ru", "и на диске лежит именно она");
    assertEq(langOf(plugin.getConfig()), "ru", "а в памяти она же");
    assertEq(obsidianStub.notices.length, 0, "и никакого «настройки перечитаны» человеку");

    /* Вторая запись подряд — тем же путём: первая не должна была объявить
       диск чужим и тем самым сломать следующую. */
    plugin.store.patch({ general: { language: "fr" } }, "проба");
    await sleep(200);
    assertEq(langOf(plugin.disk.data), "fr", "и следующая правка тоже доехала");
    assertEq(obsidianStub.notices.length, 0, "и по-прежнему без уведомлений");
    ok("отрицательный контроль: своя правка доезжает до файла и чужой не считается");
  }

  /* ---- после приёма чужого плагин снова умеет писать --------------------- */
  /*
   * Мутация нашла эту дыру раньше заказчика: если после приёма не запомнить,
   * что теперь лежит в файле, следующая запись объявит принятое чужим ещё раз —
   * и так по кругу, а правка человека не ляжет на диск **никогда**.
   */
  {
    const plugin = makePlugin(PluginClass, { guarded: true });
    await plugin.store.init();
    obsidianStub.notices.length = 0;

    plugin.disk.data = { configVersion: 2, general: { language: "de" } };
    assertEq(await plugin.onExternalSettingsChange(), true, "чужое принято");
    assertEq(obsidianStub.notices.length, 1, "и об этом сказано");

    const writesBefore = plugin.disk.writes.length;
    plugin.store.patch({ general: { language: "it" } }, "проба");
    await sleep(200);
    assertEq(plugin.disk.writes.length, writesBefore + 1, "следующая правка записана");
    assertEq(langOf(plugin.disk.data), "it", "и лежит на диске именно она");
    assertEq(obsidianStub.notices.length, 1, "второго «перечитаны» не было");
    ok("после приёма чужого запись плагина снова доезжает до файла");
  }

  /* ---- настоящая миграция: своя запись не читается как чужая ------------- */
  /*
   * Взгляд на диск сравнивает **мигрированное** дерево. Если бы миграция не
   * была идемпотентной, каждая наша запись читалась бы как чужая, и плагин
   * ходил бы по кругу на его настоящем конфиге.
   */
  {
    const plugin = makePlugin(PluginClass, { guarded: true, realMigration: true });
    await plugin.store.init();
    obsidianStub.notices.length = 0;
    plugin.store.patch({ general: { language: "ru" } }, "проба");
    await sleep(200);
    assertEq(obsidianStub.notices.length, 0, "своя запись через настоящую миграцию чужой не выглядит");
    assertEq(plugin.store.diskChangedUnderUs(clone(plugin.disk.data)), false,
      "и прямой вопрос о диске отвечает «наше»");
    ok("настоящая миграция: запись плагина не читается как внешняя правка");
  }

  console.log("Config external change tests: OK (" + passed + " checks)");
}

run().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
