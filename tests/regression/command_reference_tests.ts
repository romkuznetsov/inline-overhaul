/**
 * Справочник команд (PRD 10.5, К-1–К-4).
 *
 * **Что проверяется и почему именно это.** Справочник — таблица, к которой
 * человек приходит узнать правду: какие команды есть и какая клавиша у каждой.
 * Значит врать она не должна ни в одну сторону:
 *
 *   * **К-1.** В таблице ровно те команды, которые плагин регистрирует. Не
 *     больше (обещание того, чего нет) и не меньше (команда, о которой человек
 *     не узнает). Проверяется сверкой со списком `listOwnCommands`, а тот
 *     собран тем же реестром, которым команды и регистрируются.
 *   * **К-1.** Ни одного ID команды в тексте таблицы.
 *   * **К-2.** Колонка хоткея показывает назначенный или прочерк, и ведёт в
 *     настройки Obsidian. Без приватного API кнопка неактивна, а панель цела.
 *   * **К-4.** Строки сгруппированы по областям, порядок — из прототипа.
 *   * Описания взяты из прототипа (Р8), а не придуманы в коде.
 *   * Семьи развёрнуты: у каждого Field своя пара строк, у каждой строки Binder
 *     своя, у каждого модуля свой тумблер. Пустая семья даёт одну строку без
 *     кнопки — обещать клавишу там, где команды ещё нет, нельзя (З8).
 *
 * Подделаны DOM и менеджер хоткеев: первого в Node нет, второй — приватное API
 * Obsidian. Список команд и конфиг настоящие: реестр и `migrateConfig` берутся
 * из `main.js` загрузчиком `tests/harness/plugin_internals.ts`.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { commandReference } from "../../src/ui/settings/custom/command_reference.ts";
import { COMMAND_TEXTS } from "../../src/ui/settings/schema/custom_texts.ts";
import type { SettingsCtx } from "../../src/ui/settings/types.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const internals = loadPluginInternals();

setupGlobals();

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/** Модули плагина: столько же тумблеров ожидается в справочнике. */
const FEATURE_ORDER = ["navigation", "pkm", "visual", "transform"];

/** Конфиг с одним тегом, одним полем-датой и одной своей строкой Binder. */
function makeConfig(): Any {
  return internals.migrateConfig({
    schemaVersion: 1,
    ui: {
      binderRows: [
        { rowId: "r1", insertText: "()", commandName: "Round brackets", commandId: "" },
      ],
    },
    pkm: {
      behavior: {
        order: {
          left: ["status"],
          right: ["date_due"],
          labels: { status: "Status", date_due: "Due" },
          strictNames: { status: "status", date_due: "date_due" },
          types: { status: "tag", date_due: "element" },
          active: { status: "yes", date_due: "yes" },
          enabled: { status: true, date_due: true },
        },
        leftMode: { fields: [{ id: "status", orderKey: "status", prefix: "#", values: [{ token: "#todo" }] }] },
        rightMode: { fields: [{ id: "date_due", orderKey: "date_due", kind: "dateOffset", values: [] }] },
        elements: { fields: ["date_due"], byField: { date_due: {} } },
        io: { separator1: "||", separator2: "||" },
      },
    },
  }) as Any;
}

/** Конфиг без Fields и без своих строк Binder: семьи пустые. */
function emptyConfig(): Any {
  return internals.migrateConfig({ schemaVersion: 1 }) as Any;
}

/**
 * Список команд — **настоящий**, из `main.js`.
 *
 * Первая версия проверки собирала его здесь тем же реестром: тринадцать строк,
 * повторяющих плагин. Мутационная проверка это и вскрыла — три дефекта в
 * `buildOwnCommandList` выжили, потому что проверялась копия, а не плагин. Это
 * ровно та ошибка, о которой предупреждает CLAUDE.md, и здесь она успела
 * появиться заново.
 */
function ownCommands(cfg: Any): Any[] {
  const plugin = {
    app: {},
    manifest: { id: "inline-overhaul" },
    store: { getSnapshot: () => cfg },
    getConfig: () => cfg,
  };
  return internals.buildOwnCommandList(plugin);
}

interface Drawn {
  host: StubNode;
  close: () => void;
  opened: string[];
  areas: string[];
  /** Подписи частей области: стандартные команды и созданные из Fields. */
  subs: string[];
  /** Подзаголовки Fields внутри второй части: `task (tag)`. */
  fields: string[];
  rows: Array<{
    name: string; does: string; hotkey: string; disabled: boolean; button: boolean;
    /** Под какой подписью строка стоит: по ней и видно деление. */
    under: string;
    /** Под каким подзаголовком Field строка стоит. */
    field: string;
  }>;
}

/** Отрисовать справочник на заглушке DOM с заданным менеджером хоткеев. */
function draw(cfg: Any, o?: { hotkeys?: Record<string, Any>; noPrivateApi?: boolean }): Drawn {
  const opened: string[] = [];
  const keys = (o && o.hotkeys) || {};
  const app = (o && o.noPrivateApi)
    ? {}
    : {
      hotkeyManager: { customKeys: keys, getHotkeys: () => [] },
      setting: {
        open: () => {},
        openTabById: () => ({ setQuery: (q: string) => { opened.push(String(q)); } }),
      },
    };
  const plugin: Any = {
    app,
    manifest: { id: "inline-overhaul" },
    getConfig: () => cfg,
    store: { getSnapshot: () => cfg },
    listOwnCommands: () => ownCommands(cfg),
  };

  const host = makeNode("div");
  const ctx = {
    get: () => undefined,
    set: async () => {},
    run: async () => {},
    watch: () => () => {},
    platform: { plugin, Modal: class {}, Notice: class {} },
  } as unknown as SettingsCtx;

  const close = commandReference(host as unknown as El, ctx);

  const areas: string[] = [];
  const subs: string[] = [];
  const fields: string[] = [];
  let under = "";
  let field = "";
  const rows: Drawn["rows"] = [];
  const walk = (node: StubNode): void => {
    const cls = String((node as Any).className || "");
    if (cls.includes("io-cmd__area")) {
      areas.push(String(node.textContent || "").trim());
      under = "";
      field = "";
    }
    if (cls.includes("io-cmd__sub")) {
      under = String(node.textContent || "").trim();
      subs.push(under);
      field = "";
    }
    if (cls.includes("io-cmd__field")) {
      field = String(node.textContent || "").trim();
      fields.push(field);
    }
    if (cls.includes("io-cmd__row")) {
      const cells = node.children;
      const hk = node.querySelectorAll("BUTTON")[0]
        || node.querySelectorAll("SPAN").find(n => String((n as Any).className || "").includes("io-hk"));
      rows.push({
        name: String(cells[0]?.textContent || "").trim(),
        does: String(cells[1]?.textContent || "").trim(),
        hotkey: String(hk?.textContent || "").trim(),
        disabled: Boolean((hk as Any)?.disabled),
        button: String((hk as Any)?.tagName || "") === "BUTTON",
        under,
        field,
      });
    }
    node.children.forEach(walk);
  };
  walk(host);

  return { host, close, opened, areas, subs, fields, rows };
}

/* ---- К-1: в таблице ровно то, что плагин регистрирует -------------------- */

{
  const cfg = makeConfig();
  const d = draw(cfg);
  const commands = ownCommands(cfg);

  /*
   * Каждая команда — своей строкой. Не меньше, кроме названных поимённо.
   *
   * Прототип (Р8) описывает не всё, что зарегистрировано, и это его решение,
   * а не пропуск: `Open settings` удаляется в фазе 6 вместе с вызовом
   * `app.setting.open()` (T8), и обещать её в справочнике значило бы описать
   * то, чего через релиз не станет. Придумать ей описание нельзя — тексты
   * берутся из прототипа, а не из кода.
   *
   * Список закрытый: команда, которую прототип не описывает, обязана попасть
   * сюда с причиной, а не пропасть молча.
   */
  const UNDESCRIBED: Record<string, string> = {
    "Open settings": "удаляется в фазе 6, пункт 5 (T8): прототип её не описывает",
  };
  const shown = new Set(d.rows.map(r => r.name));
  const missing = commands
    .map(c => String(c.name))
    .filter(n => !shown.has(n) && !Object.prototype.hasOwnProperty.call(UNDESCRIBED, n));
  assert.deepEqual(missing, [],
    "эти команды плагин регистрирует, а справочник о них молчит:\n  " + missing.join("\n  "));

  /* И обратное: исключение не переживает саму команду. */
  const registered = new Set(commands.map(c => String(c.name)));
  const staleExceptions = Object.keys(UNDESCRIBED).filter(n => !registered.has(n));
  assert.deepEqual(staleExceptions, [],
    "команды уже нет — уберите её из списка неописанных: " + staleExceptions.join(", "));

  /* И не больше: ни одной строки без команды. */
  const known = new Set(commands.map(c => String(c.name)));
  const extra = d.rows.map(r => r.name).filter(n => !known.has(n));
  assert.deepEqual(extra, [],
    "справочник обещает команды, которых нет (З8):\n  " + extra.join("\n  "));

  assert.equal(d.rows.length, commands.length - Object.keys(UNDESCRIBED).length,
    "строк и команд разное число: " + d.rows.length + " и " + commands.length);
  ok("К-1: в таблице ровно те команды, которые плагин регистрирует");
}

{
  /* Ни одного идентификатора команды в тексте таблицы (К-1). */
  const cfg = makeConfig();
  const d = draw(cfg);
  const idSet = new Set(ownCommands(cfg).map(c => String(c.id)));
  const leaked: string[] = [];
  for (const row of d.rows) {
    for (const id of idSet) {
      if (row.name === id || row.does.includes(id)) leaked.push(row.name + " → " + id);
    }
    if (/inlineOverhaul_/.test(row.name + row.does)) leaked.push(row.name + " → старая форма ID");
  }
  assert.deepEqual(leaked, [],
    "ID команды виден в таблице:\n  " + leaked.join("\n  "));
  ok("К-1: ни одного ID команды в тексте таблицы");
}

/* ---- К-4: области и их порядок ------------------------------------------ */

{
  const d = draw(makeConfig());
  const expected = COMMAND_TEXTS.map(a => a.area);
  assert.deepEqual(d.areas, expected,
    "порядок областей разошёлся с прототипом: " + d.areas.join(", "));
  ok("К-4: области идут в порядке прототипа");
}

/* ---- описания взяты из прототипа ---------------------------------------- */

{
  const d = draw(makeConfig());
  const known = new Set<string>();
  for (const area of COMMAND_TEXTS) for (const row of area.list) known.add(row.does);
  const invented = d.rows.map(r => r.does).filter(t => !known.has(t));
  assert.deepEqual(invented, [],
    "описание придумано в коде, а не взято из прототипа (Р8):\n  " + invented.join("\n  "));
  const empty = d.rows.filter(r => !r.does).map(r => r.name);
  assert.deepEqual(empty, [], "команда без описания: " + empty.join(", "));
  ok("описания взяты из прототипа, и ни одна строка не осталась без него");
}

/* ---- семьи развёрнуты по данным ---------------------------------------- */

{
  const d = draw(makeConfig());
  const names = d.rows.map(r => r.name);

  /*
   * Пара команд на каждый Field, названная его **строгим** именем (`Name`), а
   * не коротким для TagWheel (`Name in TagWheel`).
   *
   * До 2026-09-04 имя собиралось из короткого, и заказчик написал ровно это:
   * «io-field-short должен влиять только на отображение field в TagWheel».
   * Фикстура для того и держит два разных имени — `status` против `Status`,
   * `date_due` против `Due`: на фикстуре, где они совпадают, эта проверка
   * слепа к их расхождению (У-47).
   */
  assert.ok(names.includes("status next") && names.includes("status previous"),
    "команды тега не развёрнуты или названы не строгим именем: " + names.join(", "));
  assert.ok(names.includes("date_due next") && names.includes("date_due previous"),
    "команды поля-даты не развёрнуты или названы не строгим именем: " + names.join(", "));
  assert.deepEqual(names.filter(n => /^(Status|Due) /.test(n)), [],
    "короткое имя для TagWheel попало в имя команды: " + names.join(", "));
  /* Шаблонных строк прототипа в таблице нет. */
  assert.ok(!names.includes("<your rows>"), "шаблонная строка Binder попала в таблицу");
  assert.ok(!names.includes("Toggle <module> module"), "шаблонная строка тумблера попала в таблицу");
  /* Своя строка Binder и тумблеры модулей — настоящими именами. */
  assert.ok(names.includes("Round brackets"), "своя строка Binder не показана: " + names.join(", "));
  assert.equal(names.filter(n => /^Toggle .+ module$/.test(n)).length, FEATURE_ORDER.length,
    "тумблеров модулей не столько, сколько модулей: " + names.join(", "));
  ok("семьи развёрнуты: по строке на каждый Field, строку Binder и модуль");
}

{
  /*
   * Пустая семья: Fields не заведены, своих строк Binder нет. Строки нет вовсе.
   *
   * До 2026-09-05 на её месте стояла шаблонная строка прототипа с подписью
   * вместо кнопки хоткея. Заказчик увидел `<your rows>` в свежем vault и
   * попросил убрать: в справочнике должны быть только команды, которые есть.
   * Это то же З8, которым выше отбирается `Open settings`.
   */
  const d = draw(emptyConfig());
  const names = d.rows.map(r => r.name);

  assert.ok(!names.includes("<your rows>"),
    "шаблонная строка Binder осталась при пустой семье: " + names.join(", "));
  assert.ok(!names.includes("Status next") && !names.includes("Status previous"),
    "шаблонная строка Fields осталась при пустой семье: " + names.join(", "));
  /* Строк без команды не бывает ни одной: у каждой есть кнопка хоткея. */
  assert.deepEqual(d.rows.filter(r => !r.button).map(r => r.name), [],
    "строка без кнопки хоткея — это строка без команды за ней");
  /* Область при этом не пустеет: стандартные команды на месте. */
  assert.ok(names.includes("Move line up"), "стандартные команды пропали вместе с шаблонными");
  ok("пустая семья: строки нет, и ни одной строки без команды не осталось");
}

{
  /*
   * Команда не зарегистрирована — строки нет (З8).
   *
   * Сегодня прототип описывает всё, что плагин регистрирует, и обратный случай
   * проверить на настоящем списке нельзя. Но он наступит: фаза 6 удаляет
   * `Open settings`, а фаза 5 добавит `Floating button`, и между правкой
   * прототипа и правкой кода справочник обещал бы то, чего нет. Поэтому список
   * команд здесь урезан намеренно.
   */
  const cfg = makeConfig();
  const full = ownCommands(cfg);
  const without = full.filter((c: Any) => String(c.name) !== "Move line up");
  assert.equal(without.length, full.length - 1, "не нашёл команду, которую убираю");

  const host = makeNode("div");
  const ctx = {
    get: () => undefined, set: async () => {}, run: async () => {}, watch: () => () => {},
    platform: {
      plugin: {
        app: { hotkeyManager: { customKeys: {}, getHotkeys: () => [] } },
        manifest: { id: "inline-overhaul" },
        getConfig: () => cfg,
        listOwnCommands: () => without,
      },
      Modal: class {}, Notice: class {},
    },
  } as unknown as SettingsCtx;
  const close = commandReference(host as unknown as El, ctx);

  const names: string[] = [];
  const walk = (node: StubNode): void => {
    if (String((node as Any).className || "").includes("io-cmd__row")) {
      names.push(String(node.children[0]?.textContent || "").trim());
    }
    node.children.forEach(walk);
  };
  walk(host);
  close();

  assert.ok(!names.includes("Move line up"),
    "справочник показал команду, которой плагин не регистрирует: " + names.join(", "));
  assert.ok(names.includes("Move line down"), "и заодно потерял соседнюю: " + names.join(", "));
  ok("команды нет — строки нет: справочник не обещает лишнего (З8)");
}

/* ---- К-2: колонка хоткея ------------------------------------------------ */

{
  const cfg = makeConfig();
  const d = draw(cfg, {
    hotkeys: {
      "inline-overhaul:move-line-up": [{ modifiers: ["Alt"], key: "ArrowUp" }],
      /* И идентификатор, и подпись в таблице собраны из СТРОГОГО имени Field
         (`date_due`). Ключ менеджера — по идентификатору. */
      "inline-overhaul:date-due-next": [{ modifiers: ["Mod"], key: "]" }],
    },
  });
  const byName = new Map(d.rows.map(r => [r.name, r]));

  assert.equal(byName.get("Move line up")?.hotkey, "Alt + ArrowUp",
    "назначенный хоткей не показан: " + byName.get("Move line up")?.hotkey);
  /* `Mod` показывается словом платформы: `hotkeys.ts` переводит его в `Ctrl`. */
  assert.equal(byName.get("date_due next")?.hotkey, "Ctrl + ]",
    "хоткей команды поля не показан: " + byName.get("date_due next")?.hotkey);
  assert.equal(byName.get("Move line down")?.hotkey, "not set",
    "у команды без хоткея должен быть прочерк словами");
  assert.equal(byName.get("Move line down")?.disabled, false,
    "кнопка активна, когда приватное API на месте");
  ok("К-2: назначенный хоткей показан, у остальных прочерк словами");
}

{
  /* Приватного API нет: кнопка неактивна, панель цела (К-2). */
  const d = draw(makeConfig(), { noPrivateApi: true });
  const withButton = d.rows.filter(r => r.button);
  assert.ok(withButton.length, "кнопок хоткея не осталось вовсе");
  assert.deepEqual(withButton.filter(r => !r.disabled).map(r => r.name), [],
    "без приватного API кнопка хоткея обязана быть неактивной");
  assert.deepEqual(withButton.filter(r => r.hotkey !== "not set").map(r => r.name), [],
    "без менеджера хоткеев показывать нечего, кроме прочерка");
  ok("К-2: без приватного API кнопки неактивны, а панель отрисована");
}

{
  /* Нажатие ведёт в настройки Obsidian на имени этой команды. */
  const d = draw(makeConfig());
  const buttons = d.host.querySelectorAll("BUTTON");
  const target = buttons.find(b => String(b.textContent || "").trim() === "not set");
  assert.ok(target, "не нашёл кнопку хоткея");
  (target as StubNode).click();
  assert.equal(d.opened.length, 1, "нажатие не открыло список хоткеев");
  ok("К-2: нажатие ведёт в настройки Obsidian на этой команде");
}

/* ---- блок снимается за собой ------------------------------------------- */

{
  const d = draw(makeConfig());
  assert.ok(d.host.children.length, "блок ничего не нарисовал");
  d.close();
  assert.equal(d.host.querySelectorAll("BUTTON").length, 0,
    "после снятия блока в дереве остались кнопки");
  ok("блок снимается за собой");
}

{
  /* Плагин не отдаёт списка — таблица пустая, но панель цела. */
  const host = makeNode("div");
  const ctx = {
    get: () => undefined, set: async () => {}, run: async () => {},
    watch: () => () => {},
    platform: { plugin: { app: {}, manifest: { id: "inline-overhaul" } }, Modal: class {}, Notice: class {} },
  } as unknown as SettingsCtx;
  const close = commandReference(host as unknown as El, ctx);
  assert.ok(host.children.length, "без списка команд блок должен нарисовать хотя бы каркас");
  close();

  /* И без платформы: спрашивать команды не у кого. */
  const bare = makeNode("div");
  const closeBare = commandReference(bare as unknown as El, {
    get: () => undefined, set: async () => {}, run: async () => {}, watch: () => () => {},
  } as unknown as SettingsCtx);
  closeBare();
  ok("без списка команд и без платформы блок не падает");
}

/* ---- заголовки колонок сняты с прототипа ------------------------------- */

{
  const proto = fs.readFileSync(path.join(root, "docs", "prototype", "settings_prototype.html"), "utf8");
  assert.ok(proto.includes('["Command", "Description", "Hotkey"]'),
    "заголовки колонок в прототипе изменились — приведите их и в блоке");
  const d = draw(makeConfig());
  const head = d.host.querySelectorAll("DIV").find(n =>
    String((n as Any).className || "").includes("io-cmd__head"));
  assert.ok(head, "нет строки заголовков");
  assert.deepEqual(head?.children.map(c => String(c.textContent || "").trim()),
    ["Command", "Description", "Hotkey"], "заголовки колонок разошлись с прототипом");
  ok("заголовки колонок совпадают с прототипом");
}

/* ---- 1.2.3.4: две части области Tags & PKM ------------------------------ */

{
  /*
   * Заказчик просил разделить область на стандартные команды и те, что плагин
   * заводит сам из Fields, и поставить стандартные выше (1.2.3.4.1, 1.2.3.4.2).
   * До этого пара команд каждого Field шла первой, а `Open TagWheel` — после
   * них, и по списку нельзя было понять, что появится и исчезнет само.
   */
  const d = draw(makeConfig());
  assert.deepEqual(d.subs, ["Standard commands", "Commands from your Fields"],
    "подписей частей нет или они не в том порядке: " + d.subs.join(" | "));

  const pkm = d.rows.filter(r => r.under);
  const standard = pkm.filter(r => r.under === "Standard commands").map(r => r.name);
  const fromFields = pkm.filter(r => r.under === "Commands from your Fields").map(r => r.name);

  assert.deepEqual(standard,
    ["Open TagWheel on the left", "Open TagWheel on the right"],
    "в стандартных не те команды: " + standard.join(", "));
  assert.ok(fromFields.length >= 2,
    "команд из Fields нет вовсе: " + fromFields.join(", "));
  assert.ok(!fromFields.some(n => n.startsWith("Open TagWheel")),
    "стандартная команда попала во вторую часть");

  /* Стандартные и правда выше: первая строка второй части идёт после последней
     строки первой. */
  const firstUser = d.rows.findIndex(r => r.under === "Commands from your Fields");
  const lastStd = d.rows.map(r => r.under).lastIndexOf("Standard commands");
  assert.ok(lastStd >= 0 && firstUser > lastStd,
    "части перепутаны местами: стандартные обязаны идти выше");
  ok("1.2.3.4.1 и 1.2.3.4.2: область поделена на две части, стандартные выше");
}

{
  /*
   * 1.2.3.4.3: команды одного Field стоят рядом, дочерние — сразу за
   * родительскими, и в каждой паре `next` раньше `previous`. Раньше список шёл
   * семьями: сперва все `next`, потом все `previous`, и пара одного Field
   * оказывалась в разных концах таблицы.
   */
  const cfg = internals.migrateConfig({
    schemaVersion: 1,
    pkm: {
      behavior: {
        order: {
          left: ["type", "importance"],
          right: [],
          labels: { type: "type", importance: "importance" },
          strictNames: { type: "type", importance: "importance" },
          types: { type: "tag", importance: "tag" },
          active: { type: "yes", importance: "yes" },
          enabled: { type: true, importance: true },
          sub: { type: true },
        },
        leftMode: {
          fields: [
            { id: "type", orderKey: "type", prefix: "#", values: [{ token: "#a", children: [{ token: "#a1" }] }] },
            { id: "type_sub", orderKey: "type", prefix: "#", values: [{ token: "#a1" }] },
            { id: "importance", orderKey: "importance", prefix: "#", values: [{ token: "#hi" }] },
          ],
        },
        io: { separator1: "||", separator2: "||" },
      },
    },
  }) as Any;

  const rows = draw(cfg).rows
    .filter(r => r.under === "Commands from your Fields")
    .map(r => r.name);
  assert.ok(rows.length >= 4, "команд из Fields слишком мало: " + rows.join(", "));

  /*
   * Имя Field, к которому относится строка, берётся У ПЛАГИНА, а не выводится
   * здесь второй раз. Первая версия этой проверки резала имя своей регуляркой,
   * промахнулась мимо `-sub` — и зелено пропустила ровно тот порядок, который
   * заказчик просил исправить.
   */
  const groupByName = new Map<string, string>();
  const subByName = new Map<string, boolean>();
  for (const c of ownCommands(cfg) as Any[]) {
    groupByName.set(String(c.name), String(c.group || ""));
    subByName.set(String(c.name), Boolean(c.sub));
  }
  const base = (name: string): string => String(groupByName.get(name) || name);
  const seen: string[] = [];
  for (const name of rows) {
    const b = base(name);
    if (seen[seen.length - 1] !== b) {
      assert.ok(!seen.includes(b),
        "команды Field " + b + " разорваны другими: " + rows.join(", "));
      seen.push(b);
    }
  }

  /* Внутри Field: сам Field, потом дочерний; в паре `next` раньше `previous`. */
  const ofType = rows.filter(n => base(n) === base(rows[0] as string));
  assert.deepEqual(ofType.slice(0, 2).map(n => n.replace(/^\S+ /, "")),
    ["next", "previous"],
    "в паре Field `next` обязан идти раньше `previous`: " + ofType.join(", "));
  const subAt = ofType.findIndex(n => subByName.get(n) === true);
  assert.ok(subAt >= 2,
    "дочерние команды Field встали не сразу за родительскими: " + ofType.join(", "));
  assert.equal(ofType.length, 4,
    "у Field с дочерним ожидались четыре команды подряд: " + ofType.join(", "));
  ok("1.2.3.4.3: команды одного Field стоят рядом, дочерние за родительскими");
}

/* ---- подзаголовок на каждый Field (замечание 2026-08-31) ---------------- */

{
  /*
   * Соседства пар оказалось мало: когда Fields много, по списку не видно, где
   * кончается один и начинается другой. Заказчик попросил свой подзаголовок на
   * каждый Field, вида `task (tag)` — подпись Field и его тип.
   *
   * Команды дочернего Field стоят под тем же подзаголовком: это тот же Field,
   * только его дочерние значения, и своего заголовка у него быть не должно.
   */
  const cfg = internals.migrateConfig({
    schemaVersion: 1,
    pkm: {
      behavior: {
        order: {
          left: ["type", "client"],
          right: ["date_due"],
          labels: { type: "task", client: "Client", date_due: "Due" },
          strictNames: { type: "type", client: "client", date_due: "date_due" },
          types: { type: "tag", client: "wikilink", date_due: "element" },
          active: { type: "yes", client: "yes", date_due: "yes" },
          enabled: { type: true, client: true, date_due: true },
          sub: { type: true },
        },
        leftMode: {
          fields: [
            { id: "type", orderKey: "type", prefix: "#", values: [{ token: "#a", children: [{ token: "#a1" }] }] },
            { id: "type_sub", orderKey: "type", prefix: "#", values: [{ token: "#a1" }] },
            { id: "client", orderKey: "client", kind: "wikilink", values: [{ token: "[[one]]" }] },
          ],
        },
        rightMode: { fields: [{ id: "date_due", orderKey: "date_due", kind: "dateOffset", values: [] }] },
        elements: { fields: ["date_due"], byField: { date_due: {} } },
        io: { separator1: "||", separator2: "||" },
      },
    },
  }) as Any;

  const d = draw(cfg);

  /*
   * Подпись — та же, что в имени команды, плюс тип словом панели: строгое имя
   * Field, а не короткое для TagWheel. Заказчик: «название хедера fields …
   * используется как в io-field-short, но это неправильно».
   */
  assert.ok(d.fields.includes("type (tag)"),
    "подзаголовка Field нет или он назван иначе: " + d.fields.join(" | "));
  assert.deepEqual(d.fields.filter(f => /^(task|Client|Due) /.test(f)), [],
    "короткое имя для TagWheel попало в подзаголовок: " + d.fields.join(" | "));
  assert.ok(d.fields.some(f => /\(link\)$/.test(f)),
    "у Field типа wikilink тип назван не словом панели: " + d.fields.join(" | "));
  assert.ok(d.fields.some(f => /\(element\)$/.test(f)),
    "Field типа element остался без подзаголовка: " + d.fields.join(" | "));

  /* Ни одного подзаголовка над стандартными командами. */
  const standardRows = d.rows.filter(r => r.under === "Standard commands");
  assert.deepEqual(standardRows.map(r => r.field).filter(Boolean), [],
    "подзаголовок Field залез в стандартные команды");

  /* Каждая команда из Fields стоит под подзаголовком, и он один на Field. */
  const userRows = d.rows.filter(r => r.under === "Commands from your Fields");
  assert.ok(userRows.length >= 6, "команд из Fields мало: " + userRows.length);
  assert.deepEqual(userRows.filter(r => !r.field).map(r => r.name), [],
    "эти команды остались без подзаголовка Field");
  assert.equal(new Set(d.fields).size, d.fields.length,
    "подзаголовок Field повторился: " + d.fields.join(" | "));

  /* Дочерние команды — под подзаголовком родителя, а не под своим. */
  const ofTask = userRows.filter(r => r.field === "type (tag)").map(r => r.name);
  assert.ok(ofTask.some(n => /-sub /.test(n)),
    "дочерние команды ушли из-под подзаголовка родителя: " + ofTask.join(", "));
  assert.deepEqual(d.fields.filter(f => /sub/i.test(f)), [],
    "у дочернего Field появился свой подзаголовок: " + d.fields.join(" | "));
  ok("подзаголовок на каждый Field, дочерние команды под родительским");
}


/* ======================================================================
 * Три ступени заливки у рубрикаторов (замечание заказчика 1.2.1.2).
 *
 * Цвет один, меняется доля: раздел заметнее части, часть заметнее Field.
 * Читается текст CSS — как это выглядит, машина не видит, но что ступеней три
 * и что они идут по убыванию, она проверить может. Прототип и плагин сверяются
 * между собой: разъехавшись, они дадут в панели не то, что согласовано (Р8).
 * ====================================================================== */

{
  const here2 = path.dirname(fileURLToPath(import.meta.url));
  const root2 = path.resolve(here2, "..", "..");
  const readShare = (css: string, cls: string): number => {
    const rule = new RegExp("\\." + cls + "\\s*\\{[^}]*\\}", "m").exec(css);
    assert.ok(rule, "правило ." + cls + " на месте");
    const mix = /color-mix\(in srgb, var\(--text-normal\) (\d+)%, var\(--background-primary\)\)/
      .exec(String(rule ? rule[0] : ""));
    assert.ok(mix, "заливка ." + cls + " собрана из переменной темы, а не из литерального серого");
    return Number(mix ? mix[1] : 0);
  };

  const pluginCss = fs.readFileSync(path.join(root2, "styles.css"), "utf8");
  const protoCss = fs.readFileSync(path.join(root2, "docs", "prototype", "settings_prototype.html"), "utf8");

  for (const [css, where] of [[pluginCss, "панель"], [protoCss, "прототип"]] as const) {
    const area = readShare(css, "io-cmd__area");
    const sub = readShare(css, "io-cmd__sub");
    const field = readShare(css, "io-cmd__field");
    assert.ok(area > sub && sub > field,
      where + ": ступени идут по убыванию, " + area + " > " + sub + " > " + field);
    assert.ok(field > 0, where + ": у Field заливка тоже есть, иначе ступеней две");
  }

  assert.equal(readShare(pluginCss, "io-cmd__area"), readShare(protoCss, "io-cmd__area"),
    "панель и прототип красят раздел одинаково");
  assert.equal(readShare(pluginCss, "io-cmd__sub"), readShare(protoCss, "io-cmd__sub"),
    "панель и прототип красят часть раздела одинаково");
  assert.equal(readShare(pluginCss, "io-cmd__field"), readShare(protoCss, "io-cmd__field"),
    "панель и прототип красят Field одинаково");
  ok("три ступени заливки рубрикаторов, и панель с прототипом согласны");
}

console.log("\n" + passed + " проверок пройдено");
