/**
 * Копии настроек: сохранение и восстановление (PRD 10.13.2).
 *
 * Проверяется настоящий код — модуль `src/features/settings_backup.js` и
 * настоящий реестр действий `buildActions`. Подделаны только швы, которые без
 * Obsidian не бывают: файлы, окно подтверждения и окно выбора. Это те же швы,
 * которыми панель пользуется в жизни, и заполняет их `obsidian_tab.ts`.
 *
 * Хранилище подделывать не пришлось: замена конфига идёт мутатором `update`
 * (CS10), и здесь он тот же — объект и функция, которая его переписывает.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildActions, ACTION_TEXTS, type ActionDeps, type BackupFile, type ConfirmRequest, type HotkeySeam, type PickRequest } from "../../src/ui/settings/actions.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = createRequire(import.meta.url);
const backup = requireCjs(path.join(root, "src", "features", "settings_backup.js")) as Any;
const { migrate } = await import("../../src/core/config_migration_v2.ts");

/**
 * Папка копий в проверках — **не** та, что по умолчанию. С умолчанием
 * мутация «настройку не читаем, всегда берём умолчание» была не видна, и это
 * нашлось мутацией, а не чтением.
 */
const FOLDER = "My Backups/IO";

/**
 * Обращение по индексу с проверкой: `noUncheckedIndexedAccess` включён, и
 * `list[0]` здесь `T | undefined`. Отсутствие элемента — это и есть
 * провалившаяся проверка, поэтому оно падает с внятным текстом, а не с
 * `Cannot read properties of undefined`.
 */
function at<T>(list: readonly T[], i: number, what: string): T {
  const value = list[i];
  assert.ok(value !== undefined, what + ": нет элемента " + i);
  return value as T;
}

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/* ---- поддельный vault: карта путь → текст ------------------------------ */

interface Fake {
  files: Map<string, string>;
  mtimes: Map<string, number>;
  folders: Set<string>;
  notes: string[];
  asked: number;
  picked: number;
  /** Запросы подтверждения целиком: сбросу важно, **что** в окне сказано. */
  confirmed: ConfirmRequest[];
}

function makeFake(): Fake {
  return {
    files: new Map(),
    mtimes: new Map(),
    folders: new Set(),
    notes: [],
    asked: 0,
    picked: 0,
    confirmed: [],
  };
}

interface Wiring {
  fake: Fake;
  cfg: Record<string, unknown>;
  deps: ActionDeps;
  run: (action: string) => Promise<void>;
}

/**
 * Проводка как в `obsidian_tab.ts`: те же швы, те же имена. `answer` — что
 * ответит окно подтверждения, `choose` — какую копию выберет человек.
 */
function wire(o?: {
  config?: Record<string, unknown>;
  answer?: boolean;
  choose?: (req: PickRequest) => string | null;
  /** Шов хоткеев: без него копия обходится, и это отдельная проверка. */
  hotkeys?: HotkeySeam;
}): Wiring {
  const fake = makeFake();
  const opts = o || {};
  let cfg: Record<string, unknown> = JSON.parse(JSON.stringify(opts.config || sampleConfig()));

  const deps: ActionDeps = {
    notify: (message: string) => { fake.notes.push(message); },
    pluginVersion: "0.1.0-test",
    ...(opts.hotkeys ? { hotkeys: opts.hotkeys } : {}),
    vault: {
      exists: (p: string) => fake.files.has(p) || fake.folders.has(p),
      create: (p: string, text: string) => {
        if (fake.files.has(p)) throw new Error("файл уже есть: " + p);
        fake.files.set(p, text);
        fake.mtimes.set(p, fake.files.size);
      },
      open: () => undefined,
      read: (p: string) => {
        const text = fake.files.get(p);
        if (text === undefined) throw new Error("нет файла: " + p);
        return text;
      },
      ensureFolder: (p: string) => { fake.folders.add(p); },
      list: (folder: string): BackupFile[] => {
        const out: BackupFile[] = [];
        for (const p of fake.files.keys()) {
          if (p.indexOf(folder + "/") !== 0) continue;
          out.push({ path: p, mtime: fake.mtimes.get(p) || 0 });
        }
        return out;
      },
    },
    confirm: async (req: ConfirmRequest) => {
      fake.asked++;
      fake.confirmed.push(req);
      return opts.answer !== false;
    },
    pick: async (req: PickRequest) => {
      fake.picked++;
      const pickOne = opts.choose || ((r: PickRequest) => (r.options[0] ? r.options[0].value : null));
      return pickOne(req);
    },
    config: {
      get: () => JSON.parse(JSON.stringify(cfg)) as Record<string, unknown>,
      replace: (next: Record<string, unknown>) => {
        const before = JSON.stringify(cfg);
        cfg = JSON.parse(JSON.stringify(next));
        return JSON.stringify(cfg) !== before;
      },
    },
  };

  const actions = buildActions(deps) as Record<string, () => Promise<void>>;
  return {
    fake,
    get cfg() { return cfg; },
    deps,
    run: async (action: string) => {
      const call = actions[action];
      assert.ok(typeof call === "function", "нет действия " + action);
      await call();
    },
  } as Wiring;
}

/** Конфиг, в котором есть что терять: Fields, Values, Binder и вид. */
function sampleConfig(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    advanced: { backups: { folder: FOLDER } },
    pkm: {
      fields: {
        order: { left: ["status", "status_sub"], right: ["project"] },
        tags: { status: ["todo", "doing", "done"] },
        links: { project: ["alpha"] },
        elements: {},
      },
    },
    editor: { binder: { rows: [{ id: "row-1", text: "->" }] } },
    visual: { tags: { textSizePct: 90 } },
    /* Ветки состояния устройства: в копию попасть не должны (Б4). */
    viewState: { activeTab: "visual", commandIdsNotice: true },
    backups: { tagWheelConfigApplies: [{ at: 1 }] },
    meta: { lastSeen: 7 },
  };
}

/* ---- 1. круг: конфиг → заметка → конфиг --------------------------------- */

{
  const cfg = sampleConfig();
  const note = backup.buildBackupNote({ config: cfg, pluginVersion: "0.1.0-test", savedAt: new Date() });
  const back = backup.parseBackupNote(note);
  assert.deepEqual(back, backup.stripDeviceLocal(cfg),
    "заметка вернула не то, что в неё положили");
  ok("круг: конфиг → заметка → конфиг даёт то же самое");
}

/* ---- 2. состояние устройства ------------------------------------------- */

{
  const cfg = sampleConfig();
  const note = backup.buildBackupNote({ config: cfg });
  for (const key of backup.DEVICE_LOCAL) {
    assert.ok(!(key in backup.parseBackupNote(note)),
      "ветка состояния устройства попала в копию: " + key);
  }
  /* Текст заметки тоже не должен их называть: копия уезжает на другое устройство. */
  assert.ok(note.indexOf("commandIdsNotice") < 0, "заметка называет viewState в тексте");

  const restored = backup.keepDeviceLocal(cfg, backup.parseBackupNote(note));
  assert.deepEqual((restored as Any).viewState, (cfg as Any).viewState,
    "восстановление подменило состояние устройства");
  assert.deepEqual((restored as Any).pkm, (cfg as Any).pkm, "восстановление потеряло Fields");
  ok("состояние устройства в копию не попало и при восстановлении осталось своим");
}

/* ---- 3. забор ---------------------------------------------------------- */

{
  const cfg = sampleConfig();
  /* Три обратные кавычки в тексте строки Binder — законный текст. */
  ((cfg as Any).editor.binder.rows as Any[])[0].text = "```";
  const note = backup.buildBackupNote({ config: cfg });
  const fence = /^(`{3,})json$/m.exec(note);
  assert.ok(fence, "в заметке нет забора блока json");
  const width = at(fence as unknown as string[], 1, "забор").length;
  assert.ok(width >= 4,
    "забор длиной " + width + ": три кавычки внутри закрыли бы его посреди настроек");
  assert.deepEqual(backup.parseBackupNote(note), backup.stripDeviceLocal(cfg),
    "заметка с кавычками внутри не разобралась");
  ok("забор длиннее трёх кавычек, когда три кавычки лежат в настройках");
}

{
  /*
   * Разобранное обязано быть объектом. Массив и строка — законный JSON, и
   * молчаливое «ну и ладно» вместо отказа записало бы в конфиг список.
   */
  for (const body of ["[1, 2, 3]", '"just text"', "42", "null"]) {
    assert.throws(() => backup.parseBackupNote("```json\n" + body + "\n```\n"),
      (e: Any) => String(e.message) === backup.NO_SETTINGS,
      "разбор принял не объект: " + body);
  }
  ok("настройками считается только объект, а не любой разобранный JSON");
}

{
  /* Папка берётся из настройки, а умолчание — только когда её нет (Б2). */
  assert.equal(backup.backupFolder(sampleConfig()), FOLDER,
    "папка копий взялась не из настройки");
  assert.equal(backup.backupFolder({ advanced: { backups: { folder: "  " } } }),
    backup.DEFAULT_FOLDER, "пустая настройка не дала умолчания");
  assert.equal(backup.backupFolder({}), backup.DEFAULT_FOLDER,
    "конфиг без настройки не дал умолчания");
  assert.equal(backup.backupFolder({ advanced: { backups: { folder: "/Deep/Down/" } } }),
    "Deep/Down", "косые по краям не убраны");
  ok("папка копий читается из настройки, а умолчание подставляется только без неё");
}

/* ---- 4. сохранение ------------------------------------------------------ */

{
  const w = wire();
  await w.run("save-backup");
  const written = [...w.fake.files.keys()];
  assert.equal(written.length, 1, "сохранение записало не один файл: " + written.join(", "));
  /* Имя обязано нести и дату, и секунды (Б5): без секунд два сохранения в
     одну минуту спорят за одно имя. */
  const name = at(written, 0, "копия");
  assert.ok(new RegExp("^" + FOLDER + "/Settings \\d{4}-\\d\\d-\\d\\d \\d\\d-\\d\\d-\\d\\d\\.md$").test(name),
    "копия легла не туда или имя без секунд: " + name);
  assert.ok(w.fake.folders.has(FOLDER), "папку копий никто не создал");
  assert.ok(w.fake.notes.some(n => n.indexOf(ACTION_TEXTS.BACKUP_SAVED) === 0),
    "сохранение промолчало: " + w.fake.notes.join(" | "));
  assert.equal(w.fake.asked, 0, "сохранение спросило подтверждение, а спрашивать не о чем");
  ok("сохранение пишет заметку в папку копий и говорит куда");
}

{
  /* Существующий файл не перезаписывается никогда (Б6). */
  const w = wire();
  await w.run("save-backup");
  const first = at([...w.fake.files.keys()], 0, "первая копия");
  /* Второе сохранение в ту же секунду: имя занято. */
  const was = w.fake.files.get(first);
  await w.run("save-backup");
  const all = [...w.fake.files.keys()];
  assert.equal(all.length, 2, "после двух сохранений файлов не два: " + all.join(", "));
  assert.equal(w.fake.files.get(first), was, "второе сохранение переписало первое");
  assert.equal(w.fake.notes.filter(n => n.indexOf(ACTION_TEXTS.BACKUP_SAVED) === 0).length, 2,
    "второе сохранение не сказало, что записало: " + w.fake.notes.join(" | "));
  ok("сохранение не переписывает существующую копию");
}

/* ---- 5. восстановление -------------------------------------------------- */

{
  const w = wire();
  await w.run("save-backup");
  const saved = at([...w.fake.files.keys()], 0, "копия");

  /* Настройки меняются после снятия копии — их и должно вернуть. */
  ((w.cfg as Any).visual.tags as Any).textSizePct = 140;
  const before = [...w.fake.files.keys()].length;

  await w.run("restore-backup");

  assert.equal(w.fake.picked, 1, "окно выбора не показали");
  assert.equal(w.fake.asked, 1, "подтверждение не спросили");
  assert.equal([...w.fake.files.keys()].length, before + 1,
    "копия текущего состояния перед записью не появилась (Б12)");
  assert.equal(((w.cfg as Any).visual.tags as Any).textSizePct, 90,
    "настройки из копии не вернулись");
  assert.deepEqual((w.cfg as Any).viewState, sampleConfig().viewState,
    "восстановление подменило состояние устройства");
  assert.ok(w.fake.notes.indexOf(ACTION_TEXTS.RESTORE_DONE) >= 0,
    "про перезапуск не сказали: " + w.fake.notes.join(" | "));
  assert.ok(w.fake.files.has(saved), "восстановление стёрло копию, из которой читало");
  ok("восстановление спросило, сняло копию текущего и вернуло настройки");
}

/* ---- 5а. копия перед восстановлением: тумблер и постфикс (C56) ---------- */

/*
 * Замечание заказчика C56 от 2026-09-04: копия перед записью «только мешает»,
 * и такие копии в списке ничем не отличались от снятых руками.
 *
 * Проверяется поведение действия, а не строка исходника: при выключенном
 * тумблере нового файла нет вовсе, а вопрос обязан говорить правду — обещать
 * копию, которой не будет, нельзя.
 */
{
  const off = JSON.parse(JSON.stringify(sampleConfig())) as Any;
  off.advanced = off.advanced || {};
  off.advanced.backups = { ...(off.advanced.backups || {}), beforeRestore: false };

  const w = wire({ config: off as Record<string, unknown> });
  await w.run("save-backup");
  ((w.cfg as Any).visual.tags as Any).textSizePct = 140;
  const before = [...w.fake.files.keys()].length;

  await w.run("restore-backup");

  assert.equal([...w.fake.files.keys()].length, before,
    "тумблер выключен, а копия перед записью всё равно появилась");
  assert.equal(((w.cfg as Any).visual.tags as Any).textSizePct, 90,
    "настройки из копии не вернулись");
  assert.equal(at(w.fake.confirmed, 0, "вопрос").body, ACTION_TEXTS.RESTORE_BODY_NO_BACKUP,
    "вопрос обещает копию, которой не будет: " + at(w.fake.confirmed, 0, "вопрос").body);
  ok("выключенный тумблер снимает копию перед восстановлением, и вопрос об этом говорит");
}

{
  /* Включён — как было, и вопрос обещает копию. */
  const w = wire();
  await w.run("save-backup");
  const before = [...w.fake.files.keys()].length;
  await w.run("restore-backup");
  assert.equal([...w.fake.files.keys()].length, before + 1,
    "при включённом тумблере копия перед записью обязана быть (Б12)");
  assert.equal(at(w.fake.confirmed, 0, "вопрос").body, ACTION_TEXTS.RESTORE_BODY,
    "вопрос не сказал про копию");
  ok("включённый тумблер оставляет прежнее поведение");
}

{
  /*
   * Постфикс `Autogenerated` — у копии, которую человек не заказывал, и
   * только у неё. Имя проверяется у обеих: кнопка `Save a backup` его иметь
   * не должна, иначе метка перестанет что-либо различать.
   *
   * Ожидание выписано словом заказчика, а не взято из `AUTO_SUFFIX` (У-5):
   * пин на саму константу пустую строку считает постфиксом и не краснеет.
   */
  const AUTO = " Autogenerated";
  assert.equal(backup.AUTO_SUFFIX, AUTO, "постфикс автоматической копии переименован");
  const w = wire();
  await w.run("save-backup");
  const byHand = at([...w.fake.files.keys()], 0, "копия руками");
  assert.ok(byHand.indexOf(AUTO) < 0,
    "копия, снятая кнопкой, помечена как автоматическая: " + byHand);

  await w.run("restore-backup");
  const auto = [...w.fake.files.keys()].filter(p => p !== byHand);
  assert.equal(auto.length, 1, "копий перед записью не одна: " + auto.join(", "));
  assert.ok(new RegExp(
    "^" + FOLDER + "/Settings \\d{4}-\\d\\d-\\d\\d \\d\\d-\\d\\d-\\d\\d"
    + AUTO + "\\.md$",
  ).test(at(auto, 0, "копия перед записью")),
  "у копии перед записью нет постфикса Autogenerated: " + auto[0]);
  ok("копия перед восстановлением помечена постфиксом, снятая руками — нет");
}

{
  /* Сброс копию пишет всегда — тумблер его не касается, — и тоже помечает. */
  const off = JSON.parse(JSON.stringify(sampleConfig())) as Any;
  off.advanced = off.advanced || {};
  off.advanced.backups = { ...(off.advanced.backups || {}), beforeRestore: false };

  const w = wire({ config: off as Record<string, unknown> });
  await w.run("reset-settings");
  const files = [...w.fake.files.keys()];
  assert.equal(files.length, 1, "сброс не написал копию: " + files.join(", "));
  assert.ok(at(files, 0, "копия сброса").indexOf(" Autogenerated") > 0,
    "копия сброса не помечена: " + files[0]);
  ok("сброс пишет копию всегда, и она тоже помечена постфиксом");
}

{
  /* Отказ — это отказ: ни записи, ни копии (Б11). */
  const w = wire({ answer: false });
  await w.run("save-backup");
  ((w.cfg as Any).visual.tags as Any).textSizePct = 140;
  const files = [...w.fake.files.keys()].length;

  await w.run("restore-backup");

  assert.equal([...w.fake.files.keys()].length, files, "отказ всё-таки что-то записал");
  assert.equal(((w.cfg as Any).visual.tags as Any).textSizePct, 140,
    "отказ всё-таки заменил настройки");
  ok("без подтверждения восстановление не пишет ничего");
}

{
  /* Закрытое окно выбора — тоже отказ, и раньше подтверждения. */
  const w = wire({ choose: () => null });
  await w.run("save-backup");
  const files = [...w.fake.files.keys()].length;
  await w.run("restore-backup");
  assert.equal(w.fake.asked, 0, "у закрытого окна выбора всё равно спросили подтверждение");
  assert.equal([...w.fake.files.keys()].length, files, "закрытое окно выбора что-то записало");
  /*
   * И ни слова в ответ: отказ человека — не событие, о котором ему сообщают.
   * Проверка на этом и держится — без неё выживала мутация, где отказ не
   * останавливал ход, а спотыкался дальше об ошибку чтения.
   */
  assert.deepEqual(w.fake.notes.slice(1), [],
    "после отказа плагин что-то сказал: " + w.fake.notes.join(" | "));
  ok("закрытое окно выбора останавливает восстановление молча и до вопроса");
}

/* ---- 6. чужая заметка --------------------------------------------------- */

{
  const w = wire();
  w.fake.files.set(FOLDER + "/Notes.md", "# Just a note\n\nNothing here\n");
  await w.run("restore-backup");
  assert.equal(w.fake.asked, 0, "про чужую заметку спросили подтверждение");
  assert.ok(w.fake.notes.indexOf(backup.NO_SETTINGS) >= 0,
    "чужую заметку отвергли молча: " + w.fake.notes.join(" | "));
  ok("чужая заметка отвергается словами и до вопроса");
}

{
  const w = wire();
  w.fake.files.set(FOLDER + "/Broken.md", "```json\n{ oops\n```\n");
  await w.run("restore-backup");
  assert.ok(w.fake.notes.indexOf(backup.BROKEN) >= 0,
    "битый JSON отвергли не тем сообщением: " + w.fake.notes.join(" | "));
  ok("битый блок настроек отвергается словами, а не исключением");
}

/* ---- 7. пустая папка ---------------------------------------------------- */

{
  const w = wire();
  await w.run("restore-backup");
  assert.equal(w.fake.picked, 0, "показали пустое окно выбора");
  assert.ok(w.fake.notes.some(n => n.indexOf(ACTION_TEXTS.BACKUP_NONE) === 0),
    "про пустую папку не сказали: " + w.fake.notes.join(" | "));
  ok("пустая папка даёт сообщение, а не пустое окно");
}

/* ---- 8. список ---------------------------------------------------------- */

{
  const seen: PickRequest[] = [];
  const w = wire({ choose: (req: PickRequest) => { seen.push(req); return null; } });
  await w.run("save-backup");
  await w.run("save-backup");
  const paths = [...w.fake.files.keys()];
  const older = at(paths, 0, "первая копия");
  const newer = at(paths, 1, "вторая копия");
  /* Второй файл — свежее первого: список обязан поставить его выше. */
  w.fake.mtimes.set(older, 10);
  w.fake.mtimes.set(newer, 20);
  /*
   * Копия переезда лежит в папке плагина и заметкой не является. С 2026-09-04
   * она в списке **не показывается**: заказчик снял пункт
   * `Before the update to this version` — в окне он читался как случайная
   * строка без даты и состава.
   */
  w.fake.files.set(".obsidian/plugins/inline-overhaul/data.backup.v1.json",
    JSON.stringify({ schemaVersion: 1 }));

  await w.run("restore-backup");

  assert.equal(seen.length, 1, "окно выбора показали не один раз");
  const shown = at(seen, 0, "запрос выбора");
  const values = shown.options.map(o => o.value);
  assert.deepEqual(values.slice(0, 2), [newer, older],
    "список не отсортирован новыми вверх: " + values.join(", "));
  assert.equal(values.length, 2,
    "в списке не только заметки копий: " + values.join(", "));
  assert.ok(values.indexOf(".obsidian/plugins/inline-overhaul/data.backup.v1.json") < 0,
    "снятый пункт переезда снова показывается: " + values.join(", "));
  assert.ok(values.every(v => /[.]md$/.test(v)),
    "в списке есть не заметка: " + values.join(", "));
  /* Состав проверяется числами: «0 Fields» тоже содержит слово `Field`, и
     первая версия проверки на этом попалась. */
  const expected = backup.summaryLine(backup.stripDeviceLocal(sampleConfig()));
  assert.equal(expected, "2 Fields, 4 Values and 1 Binder row",
    "состав примера посчитан иначе, чем ждёт проверка: " + expected);
  const top = at(shown.options, 0, "первая строка списка");
  assert.ok(top.sub !== undefined && top.sub.indexOf(expected) === 0,
    "строка списка не говорит, что внутри: " + JSON.stringify(top));
  /*
   * Две копии одной минуты по дате и составу не различить: у заказчика в окне
   * стояли ровно такие две. Различает их имя файла, и оно в строке есть.
   */
  const names = shown.options.map(o => o.note || "");
  assert.ok(names.every(n => /^Settings .*[.]md$/.test(n)),
    "в строке списка нет имени файла: " + JSON.stringify(names));
  assert.equal(new Set(names).size, names.length,
    "имена файлов в списке совпали, две копии не различить: " + names.join(", "));
  ok("список идёт новыми вверх, знает состав, различает копии по имени файла и содержит только заметки");
}

{
  /*
   * Голый JSON читается тем же кодом, что и заметка (Б13). Пункта переезда в
   * окне выбора больше нет, но само умение никуда не делось: путь сюда
   * приходит выбором, и им может оказаться любой файл, который человек
   * положил в папку копий — в том числе `data.json` из другого vault.
   */
  const v1 = ".obsidian/plugins/inline-overhaul/data.backup.v1.json";
  const w = wire({ choose: () => v1 });
  w.fake.files.set(v1, JSON.stringify({ schemaVersion: 1, visual: { tagSizePct: 55 } }));
  /*
   * Одна заметка в папке нужна, чтобы окно выбора вообще открылось: пустой
   * список — это отказ ещё до вопроса. Выбор при этом отдаёт путь голого
   * JSON: так же поступит человек, положивший туда `data.json`.
   */
  await w.run("save-backup");
  await w.run("restore-backup");
  assert.equal(w.fake.asked, 1, "про голый JSON не спросили");
  assert.equal(((w.cfg as Any).visual as Any).tagSizePct, 55,
    "голый JSON не восстановился: " + JSON.stringify(w.cfg));
  ok("голый JSON читается тем же кодом, что и заметка");
}

/* ---- 9. второе восстановление ничего не меняет -------------------------- */

{
  const w = wire();
  await w.run("save-backup");
  const saved = at([...w.fake.files.keys()], 0, "копия");
  const only = (): string => saved;
  const w2 = wire({ choose: only });
  w2.fake.files.set(saved, w.fake.files.get(saved) as string);

  ((w2.cfg as Any).visual.tags as Any).textSizePct = 140;
  await w2.run("restore-backup");
  const after = JSON.stringify(w2.cfg);
  await w2.run("restore-backup");
  assert.equal(JSON.stringify(w2.cfg), after, "второе восстановление подряд что-то поменяло");
  assert.ok(w2.fake.notes.indexOf(ACTION_TEXTS.RESTORE_SAME) >= 0,
    "про то, что менять нечего, не сказали: " + w2.fake.notes.join(" | "));
  ok("второе восстановление подряд ничего не меняет и говорит об этом");
}

/* ---- швов нет — действие говорит об этом -------------------------------- */

{
  const said: string[] = [];
  const deaf = buildActions({ notify: (m: string) => { said.push(m); } });
  const save = deaf["save-backup"];
  assert.ok(typeof save === "function", "действие сохранения пропало из реестра");
  await save();
  assert.ok(said.indexOf(ACTION_TEXTS.NO_METHOD) >= 0,
    "без vault сохранение промолчало: " + said.join(" | "));
  ok("без доступа к vault обе кнопки говорят, что не умеют");
}

/* ---- раздел человека в заметке (Б17) ----------------------------------- */

{
  const cfg = sampleConfig();
  const note = backup.buildBackupNote({ config: cfg, pluginVersion: "0.1.0-test" });
  const lines = note.split("\n");
  const front = lines.indexOf("---", 1);
  const heading = lines.indexOf(backup.NOTES_HEADING);
  assert.ok(heading > front, "раздел для пометок человека стоит не сразу после frontmatter");
  assert.ok(lines.indexOf("# Inline Overhaul settings backup") > heading,
    "раздел человека стоит не первым: его пометки должны быть сверху");
  assert.ok(note.indexOf(backup.NOTES_HINT) > 0, "под заголовком нет подсказки, что там можно писать");
  assert.ok(note.indexOf(backup.SETTINGS_MARK) > 0, "перед блоком настроек нет метки");
  ok("в заметке есть раздел `Your notes` — сверху, с подсказкой, и блок настроек помечен");
}

{
  /*
   * Главное свойство раздела: что бы человек в нём ни написал, восстановление
   * не меняется. Проверяется самым злым текстом, какой он может написать, —
   * своим блоком с забором и словом json и подделкой ключей шапки.
   */
  const cfg = sampleConfig();
  const note = backup.buildBackupNote({ config: cfg, pluginVersion: "0.1.0-test" });
  const mine = [
    "Сделал копию перед экспериментом с Fields.",
    "plugin: сломанная сборка",
    "saved: никогда",
    backup.MARKER + ": 0",
    "",
    "```json",
    '{ "mine": "это мой блок, а не настройки" }',
    "```",
    "",
  ].join("\n");
  const edited = note.replace(backup.NOTES_HINT, mine);

  assert.deepEqual(backup.parseBackupNote(edited), backup.stripDeviceLocal(cfg),
    "текст человека в его разделе подменил восстанавливаемые настройки");

  const about = backup.describeBackup(edited);
  assert.equal(about.pluginVersion, "0.1.0-test",
    "подделка `plugin:` в разделе человека подменила версию в окне выбора: " + about.pluginVersion);
  assert.ok(about.savedAt.length > 0 && about.savedAt !== "никогда",
    "подделка `saved:` в разделе человека подменила дату в окне выбора: " + about.savedAt);
  assert.ok(backup.looksLikeBackup(edited),
    "заметка перестала опознаваться как копия из-за текста человека");
  ok("что бы человек ни написал в своём разделе, восстановление и окно выбора не меняются");
}

{
  /*
   * Копия, снятую прежней версией, — без метки и с единственным блоком, —
   * читается тем же кодом. Иначе правка отрезала бы человека от всего, что он
   * уже сохранил.
   */
  const cfg = sampleConfig();
  const old = [
    "---",
    backup.MARKER + ": 1",
    "saved: 2026-09-01 10:00",
    "plugin: 0.0.9",
    "---",
    "",
    "# Inline Overhaul settings backup",
    "",
    "```json",
    JSON.stringify(backup.stripDeviceLocal(cfg), null, 2),
    "```",
    "",
  ].join("\n");
  assert.deepEqual(backup.parseBackupNote(old), backup.stripDeviceLocal(cfg),
    "копия прежней версии, без метки, перестала читаться");
  assert.equal(backup.describeBackup(old).pluginVersion, "0.0.9",
    "шапка копии прежней версии перестала читаться");
  ok("копия, снятая прежней версией без метки, читается тем же кодом");
}

{
  /* Frontmatter отдаётся без ограждающих строк, а без него — пустая строка. */
  assert.equal(backup.frontmatter("---\na: 1\n---\nтело"), "a: 1", "frontmatter прочитался неверно");
  assert.equal(backup.frontmatter("тело без шапки"), "", "текст без frontmatter отдал не пустую строку");
  assert.equal(backup.frontmatter("---\na: 1\nбез закрытия"), "",
    "незакрытый frontmatter принят за шапку");
  ok("frontmatter читается только когда он есть и закрыт");
}

/* ---- хоткеи в копии (Б18) ---------------------------------------------- */

{
  /*
   * Круг: что назначено — то в заметке, то и вернулось. Хоткеи живут не в
   * настройках плагина, поэтому и в заметке они отдельным блоком, и на
   * восстановлении идут отдельным швом.
   */
  const assigned: Record<string, unknown[]> = {
    "inline-overhaul:tagwheel-left": [{ modifiers: ["Mod", "Alt"], key: "1" }],
    "inline-overhaul:date-due-next": [{ modifiers: ["Mod"], key: "ArrowUp" }],
    /* Пустой список — «человек снял хоткей, который плагин ставит сам». */
    "inline-overhaul:type-next": [],
  };
  let written: Record<string, unknown[]> | null = null;
  const w = wire({
    hotkeys: {
      read: () => JSON.parse(JSON.stringify(assigned)) as Record<string, unknown[]>,
      write: (map: Record<string, unknown[]>) => { written = map; return Object.keys(map).length; },
    },
  });

  await w.run("save-backup");
  const saved = at([...w.fake.files.keys()], 0, "копия");
  const note = w.fake.files.get(saved) as string;

  assert.deepEqual(backup.parseBackupHotkeys(note), assigned,
    "хоткеи не дошли до заметки или вернулись изменёнными");
  assert.ok(note.indexOf("# Hotkeys") > 0, "в заметке нет читаемого раздела хоткеев");
  assert.ok(note.indexOf("Mod + Alt + 1") > 0, "в заметке нет привязки словами: " + note);
  assert.ok(note.indexOf("no hotkey") > 0, "снятый хоткей в заметке не назван");
  /* Настройки от появления второго блока не пострадали. */
  assert.deepEqual(backup.parseBackupNote(note), backup.stripDeviceLocal(sampleConfig()),
    "блок хоткеев сбил разбор настроек");
  ok("хоткеи попадают в заметку — и блоком, и словами, — а настройки читаются как раньше");

  const back = wire({
    choose: () => saved,
    hotkeys: {
      read: () => ({}),
      write: (map: Record<string, unknown[]>) => { written = map; return Object.keys(map).length; },
    },
  });
  back.fake.files.set(saved, note);
  await back.run("restore-backup");
  assert.deepEqual(written, assigned, "восстановление отдало шву не те хоткеи: " + JSON.stringify(written));
  assert.ok(back.fake.notes.join(" | ").indexOf(ACTION_TEXTS.HOTKEYS_DONE) >= 0,
    "про вернувшиеся хоткеи не сказали: " + back.fake.notes.join(" | "));
  ok("восстановление возвращает хоткеи и говорит об этом");
}

{
  /* Хоткеи в копии есть, а шва нет: настройки всё равно восстанавливаются. */
  const withKeys = wire({
    hotkeys: {
      read: () => ({ "inline-overhaul:tagwheel-left": [{ modifiers: ["Mod"], key: "9" }] }),
      write: () => 1,
    },
  });
  await withKeys.run("save-backup");
  const saved = at([...withKeys.fake.files.keys()], 0, "копия");
  const note = withKeys.fake.files.get(saved) as string;

  const deaf = wire({ choose: () => saved, config: { advanced: { backups: { folder: FOLDER } }, visual: { tagSizePct: 11 } } });
  deaf.fake.files.set(saved, note);
  await deaf.run("restore-backup");
  assert.deepEqual((deaf.cfg as Any).pkm, (sampleConfig() as Any).pkm,
    "без шва хоткеев настройки не восстановились");
  assert.ok(deaf.fake.notes.join(" | ").indexOf(ACTION_TEXTS.HOTKEYS_NO_METHOD) >= 0,
    "не сказали, что хоткеи вернуть нечем: " + deaf.fake.notes.join(" | "));
  ok("без шва хоткеев настройки восстанавливаются, а про хоткеи говорится прямо");
}

{
  /* Копия без хоткеев про них и не заговаривает. */
  const w = wire();
  await w.run("save-backup");
  const saved = at([...w.fake.files.keys()], 0, "копия");
  const note = w.fake.files.get(saved) as string;
  assert.ok(note.indexOf("# Hotkeys") < 0, "раздел хоткеев появился в копии без хоткеев");
  assert.ok(note.indexOf(backup.HOTKEYS_MARK) < 0, "метка хоткеев появилась в копии без хоткеев");

  const back = wire({ choose: () => saved, config: { advanced: { backups: { folder: FOLDER } }, visual: { tagSizePct: 11 } } });
  back.fake.files.set(saved, note);
  await back.run("restore-backup");
  const said = back.fake.notes.join(" | ");
  assert.ok(said.indexOf(ACTION_TEXTS.HOTKEYS_DONE) < 0 && said.indexOf(ACTION_TEXTS.HOTKEYS_NO_METHOD) < 0,
    "про хоткеи заговорили там, где их нет: " + said);
  ok("копия без хоткеев про них молчит на обоих концах");
}

{
  /*
   * Ограничение «только свои команды» живёт в шве на служебном API
   * (`obsidian_tab.ts`), и без Obsidian его поведение не прогнать. Поэтому
   * оно закреплено по исходнику — тем же приёмом, каким закреплены файлы под
   * З3 в `bootstrap_loader_tests.js`. Это второе исключение к 7.2, и молча
   * расшириться оно не должно.
   */
  const src = requireCjs("node:fs").readFileSync(
    path.join(root, "src", "ui", "settings", "obsidian_tab.ts"), "utf8") as string;
  assert.ok(/function commandPrefixOf/.test(src), "префикс команд плагина больше не вычисляется");
  assert.ok(/const mine = \(id: string\): boolean => String\(id \|\| ""\)\.startsWith\(prefix\)/.test(src),
    "проверка «команда наша» из шва хоткеев исчезла");
  /* Три места: чтение, назначение и снятие. Снятие — самое опасное из них. */
  assert.equal((src.match(/if \(!mine\(id\)/g) || []).length, 3,
    "проверка «только свои команды» стоит не во всех трёх местах шва: чтении, назначении и снятии");
  assert.ok(/hm\.setHotkeys\(id, bindings\)/.test(src) && /hm\.removeHotkeys\(id\)/.test(src),
    "запись хоткеев больше не идёт через setHotkeys/removeHotkeys");
  assert.ok(/typeof hm\.save === "function"/.test(src),
    "hotkeys.json не сохраняется: назначение жило бы до конца сеанса");
  ok("шов хоткеев трогает только команды плагина — и на чтении, и на записи");
}

/* ---- сброс до умолчаний (Б19) ------------------------------------------ */

{
  /*
   * Сброс забирает работу, поэтому проверяется весь порядок: спросил — записал
   * копию — только потом заменил. Копия здесь не вежливость, а единственный
   * путь назад.
   */
  let cleared: Record<string, unknown[]> | null = null;
  const w = wire({
    hotkeys: {
      read: () => ({ "inline-overhaul:tagwheel-left": [{ modifiers: ["Mod"], key: "1" }] }),
      write: (map: Record<string, unknown[]>) => { cleared = map; return 1; },
    },
  });
  const had = JSON.parse(JSON.stringify(w.cfg)) as Any;

  await w.run("reset-settings");

  assert.equal(w.fake.asked, 1, "про сброс не спросили ровно один раз");
  const req = at(w.fake.confirmed, 0, "запрос подтверждения");
  assert.equal(req.danger, true, "кнопка согласия на сбросе не красная");
  assert.ok(req.rows !== undefined && req.rows.join(" | ").indexOf("Deleting ") === 0,
    "окно не говорит, что именно удаляется: " + JSON.stringify(req.rows));
  assert.ok(req.rows !== undefined && req.rows.join(" | ").indexOf("hotkey") > 0,
    "окно не говорит про хоткеи, которые тоже уйдут: " + JSON.stringify(req.rows));

  const written = [...w.fake.files.keys()];
  assert.equal(written.length, 1, "копия перед сбросом не записалась или записалась не одна: " + written.join(", "));
  const saved = at(written, 0, "копия перед сбросом");
  assert.deepEqual(backup.parseBackupNote(w.fake.files.get(saved) as string), backup.stripDeviceLocal(had),
    "копия перед сбросом сняла не то, что было");
  assert.deepEqual(backup.parseBackupHotkeys(w.fake.files.get(saved) as string),
    { "inline-overhaul:tagwheel-left": [{ modifiers: ["Mod"], key: "1" }] },
    "копия перед сбросом не сохранила хоткеи");

  /*
   * После сброса от настроек человека не остаётся ничего, кроме ветвей
   * состояния устройства: открытая вкладка и развёрнутые группы не настройки.
   * Умолчания дальше подставляет миграция на записи — здесь её нет, и это
   * правильно: второго объявления умолчаний в продукте быть не должно.
   */
  assert.deepEqual(w.cfg, backup.keepDeviceLocal(had, {}),
    "сброс оставил что-то из настроек человека: " + JSON.stringify(w.cfg));
  for (const key of backup.DEVICE_LOCAL) {
    if ((had as Any)[key] === undefined) continue;
    assert.deepEqual((w.cfg as Any)[key], (had as Any)[key],
      "сброс тронул ветку состояния устройства: " + key);
  }
  assert.deepEqual(cleared, {}, "хоткеи своих команд при сбросе не снялись: " + JSON.stringify(cleared));
  assert.ok(w.fake.notes.join(" | ").indexOf(ACTION_TEXTS.RESET_DONE) >= 0,
    "про сброс не сказали: " + w.fake.notes.join(" | "));
  assert.ok(w.fake.notes.join(" | ").indexOf(saved) >= 0,
    "не сказали, куда легла копия: " + w.fake.notes.join(" | "));
  ok("сброс спрашивает, пишет копию, стирает настройки и хоткеи своих команд и говорит, куда легла копия");
}

{
  /* Отказ в окне — и ничего не произошло. Ни копии, ни записи, ни хоткеев. */
  let touched = false;
  const w = wire({
    answer: false,
    hotkeys: { read: () => ({}), write: () => { touched = true; return 0; } },
  });
  const had = JSON.stringify(w.cfg);
  await w.run("reset-settings");
  assert.equal(w.fake.asked, 1, "про сброс не спросили");
  assert.equal(JSON.stringify(w.cfg), had, "отказ в окне всё равно сбросил настройки");
  assert.equal(w.fake.files.size, 0, "отказ в окне всё равно записал копию");
  assert.equal(touched, false, "отказ в окне всё равно тронул хоткеи");
  ok("отказ в окне подтверждения не сбрасывает ничего");
}

{
  /* Окна подтверждения нет — сброса нет. Молчаливое согласие тут недопустимо. */
  const said: string[] = [];
  const deaf = buildActions({ notify: (m: string) => { said.push(m); } });
  const reset = deaf["reset-settings"];
  assert.ok(typeof reset === "function", "действие сброса пропало из реестра");
  await reset();
  assert.ok(said.indexOf(ACTION_TEXTS.NO_METHOD) >= 0,
    "без швов сброс промолчал: " + said.join(" | "));
  ok("без vault и конфига сброс говорит, что не умеет, и ничего не делает");
}

{
  /*
   * Крайняя проверка и суть замечания: пустой конфиг после миграции — это
   * полный конфиг по умолчанию. Иначе сброс оставлял бы плагин без настроек
   * вовсе, а не в состоянии свежей установки.
   */
  const fresh = migrate({}) as Any;
  assert.ok(Object.keys(fresh).length > 5,
    "миграция пустого конфига не собрала умолчаний: " + Object.keys(fresh).join(", "));
  for (const tab of ["general", "navigation", "pkm", "visual", "transform", "advanced", "editor"]) {
    assert.ok(fresh[tab] !== undefined, "после сброса нет ветки " + tab);
  }
  assert.deepEqual(fresh.pkm.fields.order, {}, "после сброса остались Fields");
  assert.deepEqual(fresh.pkm.fields.tags, {}, "после сброса остались Values");
  assert.deepEqual(fresh.editor.binder.rows, [], "после сброса остались строки Binder");
  ok("пустой конфиг после миграции — это плагин, каким он бывает сразу после установки");
}

console.log("\n" + passed + " проверок пройдено");
