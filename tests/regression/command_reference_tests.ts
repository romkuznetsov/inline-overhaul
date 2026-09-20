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
import { hotkeyQueryFor, matchesHotkeyQuery } from "../../src/ui/settings/custom/hotkeys.ts";
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
    manifest: { id: "inline-overhaul", name: "inlineOverhaul" },
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
  /** Кнопки `to hotkeys` заголовков: уровень, подпись заголовка и сам узел. */
  jumps: Array<{ level: string; title: string; node?: StubNode }>;
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
    manifest: { id: "inline-overhaul", name: "inlineOverhaul" },
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
  const jumps: Array<{ level: string; title: string; node?: StubNode }> = [];
  let under = "";
  let field = "";
  const rows: Drawn["rows"] = [];
  /* Подпись заголовка — его первый `span`: рядом с ней в строке стоят «?» и
     кнопка `to hotkeys`, и `textContent` строки склеивал бы их вместе. */
  const title = (node: StubNode): string => {
    const span = node.children.find(n => String((n as Any).tagName || "") === "SPAN");
    return String((span || node).textContent || "").trim();
  };
  /* Кнопка `to hotkeys` заголовка, если она есть. */
  const jumpOf = (node: StubNode): StubNode | undefined =>
    node.children.find(n => String((n as Any).className || "").includes("io-tohk"));
  const walk = (node: StubNode): void => {
    const cls = String((node as Any).className || "");
    if (cls.includes("io-cmd__area")) {
      areas.push(title(node));
      jumps.push({ level: "area", title: title(node), node: jumpOf(node) });
      under = "";
      field = "";
    }
    if (cls.includes("io-cmd__sub")) {
      under = title(node);
      subs.push(under);
      jumps.push({ level: "part", title: under, node: jumpOf(node) });
      field = "";
    }
    if (cls.includes("io-cmd__field")) {
      field = title(node);
      fields.push(field);
      jumps.push({ level: "field", title: field, node: jumpOf(node) });
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

  return { host, close, opened, areas, subs, fields, rows, jumps };
}

/* ---- К-1: в таблице ровно то, что плагин регистрирует -------------------- */

{
  const cfg = makeConfig();
  const d = draw(cfg);
  const commands = ownCommands(cfg);

  /*
   * Каждая команда — своей строкой. Не меньше, кроме названных поимённо.
   *
   * **Список пуст с 2026-09-06, и это не «нечего проверять».** В нём стояла
   * одна запись — `Open settings`, команда, которой прототип (Р8) не описывал,
   * потому что она удаляется в фазе 6. Её удалили (T8, пункт 5), и запись
   * ушла — не сама, а по требованию проверки ниже: та упала на устаревшем
   * исключении и назвала его. Так и должно быть; исключение не переживает свой
   * предмет молча (У-71).
   *
   * Список остаётся закрытым: команда, которую прототип не описывает, обязана
   * попасть сюда с причиной, а не пропасть молча.
   */
  const UNDESCRIBED: Record<string, string> = {};
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
  assert.ok(names.includes("Tags & PKM: status next") && names.includes("Tags & PKM: status previous"),
    "команды тега не развёрнуты или названы не строгим именем: " + names.join(", "));
  assert.ok(names.includes("Tags & PKM: date_due next") && names.includes("Tags & PKM: date_due previous"),
    "команды поля-даты не развёрнуты или названы не строгим именем: " + names.join(", "));
  assert.deepEqual(names.filter(n => /^(Status|Due) /.test(n)), [],
    "короткое имя для TagWheel попало в имя команды: " + names.join(", "));
  /* Шаблонных строк прототипа в таблице нет. */
  assert.ok(!names.includes("<your rows>"), "шаблонная строка Binder попала в таблицу");
  assert.ok(!names.includes("Toggle <module> module"), "шаблонная строка тумблера попала в таблицу");
  /* Своя строка Binder и тумблеры модулей — настоящими именами. */
  assert.ok(names.includes("Binder: Round brackets"), "своя строка Binder не показана: " + names.join(", "));
  assert.equal(names.filter(n => /^General: Toggle .+ module$/.test(n)).length, FEATURE_ORDER.length,
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
   * Это то же З8, которым 2026-09-06 из справочника сама ушла снятая
   * `Open settings`.
   */
  const d = draw(emptyConfig());
  const names = d.rows.map(r => r.name);

  assert.ok(!names.includes("<your rows>"),
    "шаблонная строка Binder осталась при пустой семье: " + names.join(", "));
  assert.ok(!names.includes("Tags & PKM: Status next") && !names.includes("Tags & PKM: Status previous"),
    "шаблонная строка Fields осталась при пустой семье: " + names.join(", "));
  /* Строк без команды не бывает ни одной: у каждой есть кнопка хоткея. */
  assert.deepEqual(d.rows.filter(r => !r.button).map(r => r.name), [],
    "строка без кнопки хоткея — это строка без команды за ней");
  /* Область при этом не пустеет: стандартные команды на месте. */
  assert.ok(names.includes("Navigation: Move line up"), "стандартные команды пропали вместе с шаблонными");
  ok("пустая семья: строки нет, и ни одной строки без команды не осталось");
}

{
  /*
   * Команда не зарегистрирована — строки нет (З8).
   *
   * Прототип описывает всё, что плагин регистрирует, и обратный случай
   * проверить на настоящем списке нельзя. А наступает он каждый раз, когда
   * команда уходит или приходит: 2026-09-06 так ушла `Open settings`, и строка
   * исчезла сама, без правки справочника. Между правкой прототипа и правкой
   * кода справочник обещал бы то, чего нет, поэтому список команд здесь урезан
   * намеренно.
   */
  const cfg = makeConfig();
  const full = ownCommands(cfg);
  const without = full.filter((c: Any) => String(c.name) !== "Navigation: Move line up");
  assert.equal(without.length, full.length - 1, "не нашёл команду, которую убираю");

  const host = makeNode("div");
  const ctx = {
    get: () => undefined, set: async () => {}, run: async () => {}, watch: () => () => {},
    platform: {
      plugin: {
        app: { hotkeyManager: { customKeys: {}, getHotkeys: () => [] } },
        manifest: { id: "inline-overhaul", name: "inlineOverhaul" },
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

  assert.ok(!names.includes("Navigation: Move line up"),
    "справочник показал команду, которой плагин не регистрирует: " + names.join(", "));
  assert.ok(names.includes("Navigation: Move line down"), "и заодно потерял соседнюю: " + names.join(", "));
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

  assert.equal(byName.get("Navigation: Move line up")?.hotkey, "Alt + ArrowUp",
    "назначенный хоткей не показан: " + byName.get("Navigation: Move line up")?.hotkey);
  /* `Mod` показывается словом платформы: `hotkeys.ts` переводит его в `Ctrl`. */
  assert.equal(byName.get("Tags & PKM: date_due next")?.hotkey, "Ctrl + ]",
    "хоткей команды поля не показан: " + byName.get("Tags & PKM: date_due next")?.hotkey);
  assert.equal(byName.get("Navigation: Move line down")?.hotkey, "not set",
    "у команды без хоткея должен быть прочерк словами");
  assert.equal(byName.get("Navigation: Move line down")?.disabled, false,
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
    ["Tags & PKM: Open TagWheel on the left", "Tags & PKM: Open TagWheel on the right"],
    "в стандартных не те команды: " + standard.join(", "));
  assert.ok(fromFields.length >= 2,
    "команд из Fields нет вовсе: " + fromFields.join(", "));
  assert.ok(!fromFields.some(n => n.includes("Open TagWheel")),
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
  /* Имя команды теперь начинается с области (`Tags & PKM: type next`), и
     направление — последнее слово: берём его, а не «всё после первого». */
  assert.deepEqual(ofType.slice(0, 2).map(n => n.replace(/^.*\s/, "")),
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

  const pluginCss = fs.readFileSync(path.join(root2, "src", "styles.css"), "utf8");
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

/* ======================================================================
 * Кнопка `to hotkeys` в заголовке любого уровня (его заказ 2026-09-20,
 * пункт 12.3) и серый `not set` (пункт 12.4).
 *
 * Язык отбора экрана `Hotkeys` прочитан в `app.js` (правило 101) и набора
 * команд не выражает: он умеет только «все эти слова есть в имени». Поэтому
 * проверяется **охват** — каждая команда заголовка отвечает запросу, — а не
 * равенство множеств; и отдельно проверяется, что там, где общее слово есть,
 * запрос им и сужен, а не оставлен именем плагина.
 * ====================================================================== */

{
  const cfg = makeConfig();
  const d = draw(cfg);
  const commands = ownCommands(cfg);

  /* Заголовок без кнопки — это заголовок, из которого никуда не уйти. */
  const without = d.jumps.filter(j => !j.node).map(j => j.level + " «" + j.title + "»");
  assert.deepEqual(without, [], "у этих заголовков нет кнопки `to hotkeys`:\n  " + without.join("\n  "));
  assert.equal(d.jumps.length, d.areas.length + d.subs.length + d.fields.length,
    "кнопок и заголовков разное число: " + d.jumps.length);
  for (const level of ["area", "part", "field"]) {
    assert.ok(d.jumps.some(j => j.level === level),
      "уровня заголовков `" + level + "` в отрисованном нет — проверка смотрит не туда (У-200)");
  }

  /* Уровень назван классом: цвет у каждого свой (его слово о хедерах). */
  const classOf = (level: string): string => {
    const found = d.jumps.find(j => j.level === level);
    return String((found && found.node ? (found.node as Any).className : "") || "");
  };
  assert.ok(/io-tohk(\s|$)/.test(classOf("area")), "кнопка раздела: " + classOf("area"));
  assert.ok(/io-tohk--part/.test(classOf("part")), "кнопка части: " + classOf("part"));
  assert.ok(/io-tohk--field/.test(classOf("field")), "кнопка Field: " + classOf("field"));

  /*
   * Охват: нажали кнопку — и на экране `Hotkeys` видны **все** команды этого
   * заголовка. Считается тем же правилом, каким считает Obsidian, и на полном
   * имени команды: плагин дописывает своё имя сам.
   */
  const full = (c: Any): string => "inlineOverhaul: " + String(c.name);
  const byRows = (pick: (r: Drawn["rows"][number]) => boolean): Any[] => {
    const names = new Set(d.rows.filter(pick).map(r => r.name));
    return commands.filter(c => names.has(String(c.name)));
  };
  const missed: string[] = [];
  for (const j of d.jumps) {
    if (!j.node) continue;
    d.opened.length = 0;
    (j.node as StubNode).click();
    const query = String(d.opened[0] || "");
    assert.ok(query, "кнопка «" + j.title + "» не открыла экран хоткеев");
    const members = j.level === "area"
      ? commands.filter(c => String(c.area) === j.title)
      : j.level === "part"
        ? byRows(r => r.under === j.title)
        : byRows(r => r.field === j.title);
    assert.ok(members.length, "у заголовка «" + j.title + "» не нашлось команд — проверка ищет не то");
    for (const c of members) {
      if (!matchesHotkeyQuery(query, full(c), "inline-overhaul:" + String(c.id))) {
        missed.push(j.title + " → «" + query + "» не покажет «" + String(c.name) + "»");
      }
    }
  }
  assert.deepEqual(missed, [],
    "запрос не покрывает команды своего заголовка:\n  " + missed.join("\n  "));
  ok("кнопка `to hotkeys` есть у каждого заголовка, и её запрос показывает все его команды");
}

{
  /*
   * **И показывает только их** — его замечание 2026-09-20: «я хотел, чтобы при
   * нажатии в хедере `Navigation` у меня открылись только команды, относящиеся
   * к этому хедеру».
   *
   * Стало возможным после того, как имя команды начало нести свою область
   * (его решение того же дня): у заголовка появилось общее слово, а у области —
   * общее начало с двоеточием, которого нет у похожего слова в чужом имени
   * (`Navigation:` против `General: Toggle Navigation module`).
   *
   * Проверяется **на всех заголовках разом** и по числу лишних, а не на
   * образце: заголовок, заведённый завтра, попадёт сюда сам.
   */
  const cfg = makeConfig();
  const d = draw(cfg);
  const commands = ownCommands(cfg);
  const full = (c: Any): string => "inlineOverhaul: " + String(c.name);
  const byRows = (pick: (r: Drawn["rows"][number]) => boolean): Any[] => {
    const names = new Set(d.rows.filter(pick).map(r => r.name));
    return commands.filter(c => names.has(String(c.name)));
  };
  const loose: string[] = [];
  for (const j of d.jumps) {
    if (!j.node) continue;
    d.opened.length = 0;
    (j.node as StubNode).click();
    const query = String(d.opened[0] || "");
    const members = j.level === "area"
      ? commands.filter(c => String(c.area) === j.title)
      : j.level === "part"
        ? byRows(r => r.under === j.title)
        : byRows(r => r.field === j.title);
    const own = new Set(members.map((c: Any) => String(c.id)));
    const extra = commands
      .filter((c: Any) => !own.has(String(c.id))
        && matchesHotkeyQuery(query, full(c), "inline-overhaul:" + String(c.id)))
      .map((c: Any) => String(c.name));
    if (!extra.length) continue;
    /*
     * **Одно исключение, и оно не про недосмотр, а про язык отбора.** Часть
     * «Commands from your Fields» — это область **минус** её стандартные
     * команды, то есть дополнение. Ни одно слово так не отбирает: у команд
     * полей общее с областью, а своего общего слова у них нет. Поэтому здесь
     * разрешено ровно одно — показать заодно стандартные команды той же
     * области; всё прочее лишнее по-прежнему беда.
     */
    if (j.level === "part" && j.title === "Commands from your Fields") {
      const standardNames = new Set(byRows(r => r.under === "Standard commands")
        .map((c: Any) => String(c.name)));
      const foreign = extra.filter(n => !standardNames.has(n));
      if (!foreign.length) continue;
      loose.push(j.level + " «" + j.title + "» тащит чужое: " + foreign.join(", "));
      continue;
    }
    loose.push(j.level + " «" + j.title + "» → «" + query + "» тащит лишнее: " + extra.join(", "));
  }
  assert.deepEqual(loose, [],
    "запрос заголовка показывает чужие команды:\n  " + loose.join("\n  "));
  ok("запрос заголовка показывает только его команды — с одним названным исключением");
}

{
  /*
   * **Отрицательный контроль к охвату** (правило 125): проверка выше зелена и
   * на запросе, который показывает вообще всё. Здесь спрашивается обратное —
   * что запрос **сужен** там, где сузить его есть чем, и что предложенное
   * правилом слово действительно отсекает чужие команды.
   */
  const scope = "inlineOverhaul";
  const all = [
    { name: "Type next", id: "type-next" },
    { name: "Type previous", id: "type-previous" },
    { name: "Type-sub next", id: "type-sub-next" },
    { name: "Move line up", id: "move-line-up" },
    { name: "Open TagWheel on the left", id: "open-tagwheel-left" },
  ];
  const typed = all.filter(c => /^Type/.test(c.name));
  assert.equal(hotkeyQueryFor(scope, typed, all), scope + " type",
    "общее слово заголовка не попало в запрос");
  assert.equal(hotkeyQueryFor(scope, [all[4] as Any], all), scope + " tagwheel",
    "у одной команды запрос сужается её самым длинным словом");
  /* Общего слова нет — остаётся имя плагина, и это всё ещё сужение. */
  assert.equal(hotkeyQueryFor(scope, [all[3] as Any, all[4] as Any], all), scope,
    "без общего слова запрос обязан остаться именем плагина");
  assert.equal(hotkeyQueryFor(scope, [], all), scope, "пустой заголовок не даёт запроса");

  /* Само правило отбора: слова через И, имя или идентификатор, регистр не в счёт. */
  assert.equal(matchesHotkeyQuery("inlineoverhaul type", "inlineOverhaul: Type next", "x"), true,
    "оба слова в имени — команда видна");
  assert.equal(matchesHotkeyQuery("inlineoverhaul type", "inlineOverhaul: Move line up", "x"), false,
    "второго слова в имени нет — команда скрыта");
  assert.equal(matchesHotkeyQuery("type-next", "чужое имя", "inline-overhaul:type-next"), true,
    "идентификатор отвечает наравне с именем");
  assert.equal(matchesHotkeyQuery("", "что угодно", "id"), true, "пустой запрос не отбирает");
  ok("запрос сужен там, где есть чем, и правило отбора то же, что у Obsidian");
}

{
  /* Без приватного API кнопки заголовков неактивны — то же, что у строк (К-2). */
  const d = draw(makeConfig(), { noPrivateApi: true });
  const live = d.jumps.filter(j => j.node && !(j.node as Any).disabled).map(j => j.title);
  assert.ok(d.jumps.length > 0, "кнопок заголовков нет вовсе — проверка смотрит не туда");
  assert.deepEqual(live, [], "без `app.setting` кнопка обязана быть неактивной: " + live.join(", "));
  ok("без приватного API кнопки заголовков неактивны");
}

{
  /*
   * Вид: кнопка заголовка отличается от кнопки хоткея, и уровни — друг от
   * друга (его слово «визуально должна отличаться… для каждого хедера должен
   * отличаться»). И `not set` читается как пустое место, а не как кнопка со
   * значением (пункт 12.4): одного цвета оказалось мало.
   */
  const here2 = path.dirname(fileURLToPath(import.meta.url));
  const root2 = path.resolve(here2, "..", "..");
  const pluginCss = fs.readFileSync(path.join(root2, "src", "styles.css"), "utf8");
  const protoCss = fs.readFileSync(path.join(root2, "docs", "prototype", "settings_prototype.html"), "utf8");
  const rule = (css: string, cls: string): string => {
    const found = new RegExp("\\." + cls.replace(/-/g, "\\-") + "\\s*\\{[^}]*\\}", "m").exec(css);
    assert.ok(found, "правило ." + cls + " на месте");
    return String(found ? found[0] : "");
  };
  const accent = (css: string, cls: string): number => {
    const mix = /background:\s*color-mix\(in srgb, var\(--interactive-accent\) (\d+)%/.exec(rule(css, cls));
    assert.ok(mix, "заливка ." + cls + " взята у акцента темы, а не написана цветом");
    return Number(mix ? mix[1] : 0);
  };
  for (const [css, where] of [[pluginCss, "панель"], [protoCss, "прототип"]] as const) {
    const area = accent(css, "io-tohk");
    const part = accent(css, "io-tohk--part");
    const field = accent(css, "io-tohk--field");
    assert.ok(area > part && part > field,
      where + ": уровни кнопки идут по убыванию, " + area + " > " + part + " > " + field);
    assert.ok(field > 0, where + ": у Field кнопка тоже крашена, иначе уровней два");
    /* Кнопка хоткея в строке — не акцентная: иначе отличия нет. */
    assert.ok(!/--interactive-accent/.test(rule(css, "io-hk\\b").split("hover")[0] || ""),
      where + ": кнопка хоткея стала акцентной — отличать её от `to hotkeys` нечем");
    const none = rule(css, "io-hk--none");
    assert.ok(/background:\s*transparent/.test(none), where + ": у `not set` осталась заливка кнопки");
    assert.ok(/border-style:\s*dashed/.test(none), where + ": у `not set` сплошная рамка");
    assert.ok(/var\(--text-faint\)/.test(none), where + ": `not set` не бледный");
  }
  ok("кнопка заголовка отличается от кнопки хоткея и уровнями, а `not set` — пустое место");
}

console.log("\n" + passed + " проверок пройдено");
