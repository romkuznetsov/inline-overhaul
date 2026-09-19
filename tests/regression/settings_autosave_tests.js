"use strict";

/**
 * Автоматическая копия `data.json` (З-11, его ответ на `В-147`).
 *
 * **Что здесь закреплено и почему именно это.**
 *
 *   1. *Тумблер решает.* Выключен — ни одной записи в vault; это не
 *      украшение, а обещание: плагин без спроса в чужой vault не пишет.
 *   2. *Сравнение идёт с тем, что лежит в заметке.* Полный конфиг против
 *      отбора по вкладкам расходился бы **всегда**, то есть копия снималась бы
 *      при каждом запуске (У-147: сторона сравнения должна быть той же).
 *   3. *«Что изменилось» называет предмет, а не количество.* «Строк три» верно
 *      и тогда, когда это не те три (У-58).
 *   4. *Предел копий соблюдается, и старые снимаются.* Иначе папка растёт
 *      вечно, а предел остаётся словом в подсказке.
 *   5. *Отказ шва не роняет загрузку.* Копия — страховка поверх работы
 *      плагина, и её отказ уходит в журнал, а не человеку.
 *
 * Подделан ровно один предмет — vault, и он назван (У-1). Настройки, заметка,
 * разбор и сравнение — настоящие функции плагина.
 */

const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const autosave = require(path.join(root, "src", "features", "settings_autosave.js"));
const backup = require(path.join(root, "src", "features", "settings_backup.js"));
const normalize = require(path.join(root, "src", "core", "config_normalize.js"));

let passed = 0;
function ok(label) { passed++; console.log("  ok " + label); }

/** Конфиг настоящий: собирается нормализацией, а не пишется здесь (У-2). */
function configWith(patch) {
  const raw = { schemaVersion: 2, advanced: { backups: { autosave: true } } };
  const cfg = normalize.migrateConfig(raw, { log: () => {} });
  if (patch) patch(cfg);
  return cfg;
}

/** Подделка vault: помнит, что ей отдали, и умеет отказывать по просьбе. */
function fakeVault(files) {
  const store = new Map(Object.entries(files || {}));
  const events = { created: [], removed: [], folders: [] };
  return {
    events,
    store,
    seam: {
      list: async (folder) => Array.from(store.keys())
        .filter((p) => p.indexOf(folder + "/") === 0)
        .map((p) => ({ path: p })),
      read: async (p) => {
        if (!store.has(p)) throw new Error("нет файла: " + p);
        return store.get(p);
      },
      create: async (p, text) => {
        if (store.has(p)) throw new Error("копия не перезаписывается: " + p);
        store.set(p, text);
        events.created.push(p);
      },
      ensureFolder: async (folder) => { events.folders.push(folder); },
      remove: async (p) => { store.delete(p); events.removed.push(p); },
      hotkeys: () => ({ "inline-overhaul:open-tagwheel-left": [{ modifiers: ["Mod"], key: "1" }] }),
    },
  };
}

function pluginWith(cfg) {
  return { getConfig: () => cfg, manifest: { version: "0.3.2" } };
}

/** Заметка автокопии из этого конфига — тем же способом, каким её пишет продукт. */
function noteFor(cfg, when) {
  return backup.buildBackupNote({
    config: cfg,
    parts: backup.allPartIds(),
    hotkeyScope: "own",
    hotkeys: {},
    pluginVersion: "0.3.2",
    savedAt: when || new Date(2026, 8, 19, 10, 0, 0),
    comment: "Saved by Autosave, because the settings on disk were not the ones in the last autosave",
    details: ["first autosave in this folder, so there is nothing to compare with"],
  });
}

const FOLDER = "inlineOverhaul/Backups";

(async () => {
  /* ---- 1. тумблер ------------------------------------------------------ */
  {
    const cfg = configWith((c) => { c.advanced.backups.autosave = false; });
    const v = fakeVault({});
    const done = await autosave.autosaveOnLoad(pluginWith(cfg), v.seam);
    assert.equal(done.decision, "off", "тумблер выключен — решение `off`");
    assert.deepEqual(v.events.created, [], "и ни одной записи в vault");
    ok("выключенный тумблер не пишет в vault ничего");
  }

  /* ---- 2. первая копия ------------------------------------------------- */
  {
    const cfg = configWith();
    const v = fakeVault({});
    const when = new Date(2026, 8, 19, 23, 40, 1);
    const done = await autosave.autosaveOnLoad(pluginWith(cfg), Object.assign({ now: when }, v.seam));
    assert.equal(done.decision, "saved", "копий не было — снимается первая");
    assert.equal(done.path, FOLDER + "/Settings 2026-09-19 23-40-01_autosave.md",
      "имя с приставкой `_autosave` — его слово: " + done.path);
    assert.deepEqual(v.events.created, [done.path], "записана ровно одна заметка");

    const text = v.store.get(done.path);
    assert.ok(text.indexOf(backup.CHANGED_HEADING) !== -1,
      "в заметке есть раздел «что изменилось» — он же его просьба");
    assert.ok(text.indexOf(backup.CHANGED_HEADING) < text.indexOf(backup.SETTINGS_MARK),
      "и стоит он **над** блоком настроек, как он и сказал");
    assert.ok(text.indexOf("nothing to compare with") !== -1,
      "первая копия честно говорит, что сравнивать было не с чем");
    /* Копия максимальная — его слово: все вкладки и хоткеи. */
    assert.ok(text.indexOf("parts: " + backup.allPartIds().join(", ")) !== -1,
      "в шапке перечислены все вкладки");
    assert.ok(text.indexOf("# Hotkeys") !== -1, "и раздел хоткеев на месте");
    /* И она читается тем же разбором, которым читается копия человека. */
    const back = backup.parseBackupNote(text);
    assert.equal(
      JSON.stringify(autosave.comparableConfig(back)),
      JSON.stringify(autosave.comparableConfig(cfg)),
      "написанное читается обратно и совпадает с настройками (свойство «собрать и разобрать»)");
    ok("первая копия: имя с приставкой, все вкладки, раздел «что изменилось» над блоком");
  }

  /* ---- 3. ничего не менялось ------------------------------------------- */
  {
    const cfg = configWith();
    const older = FOLDER + "/Settings 2026-09-19 10-00-00_autosave.md";
    const v = fakeVault({ [older]: noteFor(cfg) });
    const done = await autosave.autosaveOnLoad(pluginWith(cfg), v.seam);
    assert.equal(done.decision, "same", "файл совпал с последней копией — новой не надо");
    assert.deepEqual(v.events.created, [], "и в vault ничего не дописано");
    ok("совпадение с последней копией: новая заметка не пишется");
  }

  /* ---- 4. расхождение: что именно изменилось --------------------------- */
  {
    const before = configWith();
    const older = FOLDER + "/Settings 2026-09-19 10-00-00_autosave.md";
    const cfg = configWith((c) => {
      c.visual.tags.blockFill.enabled = true;
      c.visual.tags.blockFill.direction = "left";
    });
    const v = fakeVault({ [older]: noteFor(before) });
    const when = new Date(2026, 8, 19, 23, 45, 30);
    const done = await autosave.autosaveOnLoad(pluginWith(cfg), Object.assign({ now: when }, v.seam));
    assert.equal(done.decision, "saved", "настройки разошлись — снимается новая копия");
    /*
     * Спрашивается **предмет**, а не количество: «строк две» верно и тогда,
     * когда это не те две.
     */
    assert.deepEqual(done.details.slice().sort(), [
      "visual.tags.blockFill.direction: both → left",
      "visual.tags.blockFill.enabled: false → true",
    ], "«что изменилось» называет оба изменившихся листа: " + done.details.join(" | "));
    const text = v.store.get(done.path);
    for (const line of done.details) {
      assert.ok(text.indexOf(line) !== -1, "строка уехала в заметку: " + line);
    }
    ok("расхождение: копия снята, и «что изменилось» называет те самые листья");
  }

  /* ---- 5. предел копий ------------------------------------------------- */
  {
    const before = configWith();
    const cfg = configWith((c) => { c.general.help.showTips = false; });
    const files = {};
    /* Копий на одну больше предела — значит после записи новой уйдут две. */
    for (let i = 0; i <= autosave.AUTOSAVE_KEEP; i++) {
      const stamp = "2026-09-0" + (i % 10) + " 10-0" + (i % 10) + "-00";
      files[FOLDER + "/Settings " + stamp + "_autosave.md"] = noteFor(before);
    }
    /* И чужая копия — снятая руками: её предел не касается. */
    const handmade = FOLDER + "/Settings 2026-09-01 09-00-00.md";
    files[handmade] = noteFor(before);
    const v = fakeVault(files);
    const done = await autosave.autosaveOnLoad(pluginWith(cfg),
      Object.assign({ now: new Date(2026, 8, 19, 23, 59, 59) }, v.seam));
    assert.equal(done.decision, "saved", "настройки разошлись — копия снята");
    const left = Array.from(v.store.keys()).filter(backup.isAutosavePath);
    assert.equal(left.length, autosave.AUTOSAVE_KEEP,
      "автокопий осталось ровно " + autosave.AUTOSAVE_KEEP + ", а не " + left.length);
    assert.ok(left.indexOf(done.path) !== -1, "новая копия среди оставшихся");
    assert.ok(v.store.has(handmade), "копия, снятая руками, не тронута: предел не про неё");
    assert.ok(v.events.removed.every(backup.isAutosavePath), "снято только своё");
    ok("предел: держится " + autosave.AUTOSAVE_KEEP + " автокопий, чужие не трогаются");
  }

  /* ---- 6. прежняя копия испорчена -------------------------------------- */
  {
    const cfg = configWith();
    const broken = FOLDER + "/Settings 2026-09-19 10-00-00_autosave.md";
    const v = fakeVault({ [broken]: "# Моя заметка\n\nтут нет настроек" });
    const loud = [];
    const realError = console.error;
    console.error = (...a) => { loud.push(a.map(String).join(" ")); };
    let done;
    try {
      done = await autosave.autosaveOnLoad(pluginWith(cfg), v.seam);
    } finally {
      console.error = realError;
    }
    assert.equal(done.decision, "saved",
      "прежняя копия не читается — значит нынешнее состояние не сохранено нигде, копия нужна");
    assert.equal(loud.length, 1, "и об этом сказано в журнал разработчика");
    ok("нечитаемая прежняя копия — повод снять новую, а не отказ");
  }

  /* ---- 7. шва нет ------------------------------------------------------ */
  {
    const cfg = configWith();
    const loud = [];
    const realError = console.error;
    console.error = (...a) => { loud.push(a.map(String).join(" ")); };
    let done;
    try {
      done = await autosave.autosaveOnLoad(pluginWith(cfg), {});
    } finally {
      console.error = realError;
    }
    assert.equal(done.decision, "no-vault", "шва нет — копия не снята, и это сказано");
    assert.equal(loud.length, 1, "громко в журнал, а не человеку");
    ok("без шва к vault загрузка не падает, а говорит в журнал");
  }

  /* ---- 8. запись отказала ---------------------------------------------- */
  {
    const cfg = configWith();
    const v = fakeVault({});
    const loud = [];
    const realError = console.error;
    console.error = (...a) => { loud.push(a.map(String).join(" ")); };
    let done;
    try {
      done = await autosave.autosaveOnLoad(pluginWith(cfg), Object.assign({}, v.seam, {
        create: async () => { throw new Error("диск только для чтения"); },
      }));
    } finally {
      console.error = realError;
    }
    assert.equal(done.decision, "failed", "запись отказала — решение `failed`, а не бросок наружу");
    assert.equal(loud.length, 1, "и причина в журнале");
    ok("отказ записи не роняет загрузку плагина");
  }

  /* ---- 9. шов к vault ------------------------------------------------- */
  {
    /*
     * **Водитель пишется вместе с починкой** (правило 124): у шва один
     * звавший, и тот в загрузке плагина, куда из набора не дотянуться. Поэтому
     * шов исполняется здесь, а подделан ровно один предмет — `app` Obsidian.
     *
     * Спрашивается не «вызвался ли метод», а **что он сделал**: путь, который
     * дошёл до адаптера, и то, что папка создаётся до записи.
     */
    /*
     * Загрузка плагина требует `obsidian` и CodeMirror — в Node их нет вовсе.
     * Подделаны ровно они, и ровно на время `require`: предмет проверки —
     * `autosaveVaultSeam`, и ни того ни другого он не касается (У-1).
     */
    const Module = require("node:module");
    /*
     * Заглушка CodeMirror той же формы, что у общей оснастки: она обязана
     * отдавать объект с прототипом наследника, иначе `class X extends
     * cmView.WidgetType` падает при загрузке — то есть подмена рушила бы
     * программу вместо проверки (У-175).
     */
    const cmStub = () => new Proxy(function cmAny() { return cmStub(); }, {
      get: (target, prop) => (prop === "prototype" ? target.prototype : cmStub()),
      apply: () => cmStub(),
      construct: (_t, _a, newTarget) => Object.create((newTarget && newTarget.prototype) || Object.prototype),
    });
    const origLoad = Module._load;
    let bootstrap;
    try {
      Module._load = function (request, parent, isMain) {
        if (request === "obsidian") return { Modal: class {}, Notice: class {}, Component: class {}, MarkdownRenderer: {} };
        if (request === "@codemirror/state" || request === "@codemirror/view") return cmStub();
        return origLoad.call(this, request, parent, isMain);
      };
      bootstrap = require(path.join(root, "src", "features", "plugin_bootstrap.js"));
    } finally {
      Module._load = origLoad;
    }
    const calls = [];
    const disk = new Set([FOLDER, FOLDER + "/Settings 2026-09-19 10-00-00_autosave.md"]);
    const app = {
      vault: {
        adapter: {
          exists: async (p) => { calls.push("exists " + p); return disk.has(p); },
          list: async (p) => {
            calls.push("list " + p);
            return { files: Array.from(disk).filter((f) => f !== FOLDER), folders: [] };
          },
          read: async (p) => { calls.push("read " + p); return "текст"; },
          remove: async (p) => { calls.push("remove " + p); disk.delete(p); },
        },
        create: async (p, text) => { calls.push("create " + p + " (" + text.length + ")"); },
        createFolder: async (p) => { calls.push("createFolder " + p); disk.add(p); },
        getAbstractFileByPath: () => null,
      },
      hotkeyManager: { customKeys: { "inline-overhaul:x": [{ modifiers: ["Mod"], key: "1" }] } },
    };
    const seam = bootstrap.autosaveVaultSeam({ app });
    const listed = await seam.list(FOLDER);
    assert.deepEqual(listed, [{ path: FOLDER + "/Settings 2026-09-19 10-00-00_autosave.md" }],
      "шов отдаёт пути файлами папки копий: " + JSON.stringify(listed));
    assert.equal(await seam.read("любой"), "текст", "чтение идёт адаптером");
    await seam.ensureFolder("inlineOverhaul/Новая");
    assert.ok(calls.indexOf("createFolder inlineOverhaul/Новая") !== -1,
      "папка создаётся, когда её нет: " + calls.join(" | "));
    await seam.ensureFolder(FOLDER);
    assert.equal(calls.filter((c) => c === "createFolder " + FOLDER).length, 0,
      "существующая папка второй раз не создаётся");
    await seam.create("inlineOverhaul/Новая/файл.md", "тело");
    assert.ok(calls.indexOf("create inlineOverhaul/Новая/файл.md (4)") !== -1,
      "запись идёт через vault, а не через адаптер: " + calls.join(" | "));
    await seam.remove(FOLDER + "/Settings 2026-09-19 10-00-00_autosave.md");
    assert.ok(calls.some((c) => c.indexOf("remove ") === 0), "снятие дошло до адаптера");
    assert.deepEqual(Object.keys(seam.hotkeys()), ["inline-overhaul:x"],
      "хоткеи берутся у реестра платформы");

    /* Отрицательный контроль: платформы нет — шов пуст, и это не падение. */
    assert.deepEqual(bootstrap.autosaveVaultSeam({}), {},
      "без app шов пустой, а не наполовину собранный");
    assert.deepEqual(bootstrap.autosaveVaultSeam(null), {}, "и без плагина тоже");
    ok("шов к vault: список, чтение, папка, запись, снятие и хоткеи — все шесть");
  }

  console.log("\n" + passed + " проверок пройдено");
})().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(1);
});
