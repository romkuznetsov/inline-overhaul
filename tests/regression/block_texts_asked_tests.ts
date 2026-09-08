/**
 * Строка каталога, которую никто не спрашивает, — это дефект на экране, а не
 * лишняя строка в файле.
 *
 * **Куплено 2026-09-08.** Подсказки колонок таблицы Values лежали в каталоге
 * пятью строками — `LEVEL_TIP`, `VALUE_TAG_TIP`, `VALUE_LINK_TIP`,
 * `VALUE_PREFIX_TIP`, `VALUE_SHOWN_TIP`, — а `columnTips` в
 * `fields_editor_view.ts` отдавала те же слова **литералами**. То есть строки
 * в файле языка были, человек мог их перевести, и **перевод не применялся
 * никогда**: на экране оставалось английское. Ни одна из 56 проверок этого не
 * видела, потому что каждая смотрела на нарисованный текст, а нарисованный
 * текст был правильный — просто не тот, который спрашивали.
 *
 * **Чем это ловится.** Признак у такого дефекта один и он статический: имя
 * строки объявлено в таблице текстов и **не встречается больше нигде** (У-80).
 * Поэтому проверка идёт сплошным обходом `src/**`: у каждого имени из
 * `BLOCK_TEXTS`, `DIALOG_TEXTS`, `FRAME_TEXTS` и `RUNTIME_TEXTS` спрашивается,
 * зовёт ли его хоть одно место, кроме самой таблицы.
 *
 * **Имена, которые собираются по ходу, названы списком с причиной.** Молчаливый
 * список исключений и есть тот способ, каким «проверено автоматически»
 * превращается в «проверено ничего» — поэтому у каждой записи стоит образец,
 * место сборки и число попавших под него имён. Число вырастет — проверка
 * скажет.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const SRC = path.join(root, "src");

const { BLOCK_TEXTS } = await import(pathToFileURL(
  path.join(SRC, "ui", "settings", "texts_blocks.ts")).href);
const { DIALOG_TEXTS } = await import(pathToFileURL(
  path.join(SRC, "ui", "settings", "texts_dialogs.ts")).href);
const { FRAME_TEXTS } = await import(pathToFileURL(
  path.join(SRC, "ui", "settings", "texts_custom.ts")).href);

type Any = ReturnType<typeof JSON.parse>;

let passed = 0;
const ok = (label: string): void => { passed++; console.log("  ok   " + label); };

/* ---- исходники, в которых можно спрашивать ------------------------------ */

/** Файлы, где имена ОБЪЯВЛЕНЫ: в них искать нельзя, там объявление и лежит. */
const HOMES = new Set([
  "src/ui/settings/texts_blocks.ts",
  "src/ui/settings/texts_dialogs.ts",
  "src/ui/settings/texts_custom.ts",
  "src/ui/settings/texts_runtime.ts",
  "src/ui/settings/texts_seed_ru.ts",
]);

function sources(dir: string, out: Array<{ rel: string; body: string }>): Array<{ rel: string; body: string }> {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) { sources(p, out); continue; }
    if (!/\.(ts|js)$/.test(name)) continue;
    const rel = path.relative(root, p).replace(/\\/g, "/");
    if (HOMES.has(rel)) continue;
    out.push({ rel, body: fs.readFileSync(p, "utf8") });
  }
  return out;
}

const FILES = sources(SRC, []);
assert.ok(FILES.length > 40, "исходников слоя нашлось " + FILES.length + " — обход не туда смотрит");

/** Зовёт ли хоть один файл это имя как литерал. */
function askedBy(name: string): string {
  const needle = new RegExp('(^|[^A-Za-z0-9_])' + name + '([^A-Za-z0-9_]|$)');
  for (const f of FILES) if (needle.test(f.body)) return f.rel;
  return "";
}

/* ---- имена, собираемые по ходу ------------------------------------------ */

/**
 * Имя, которое в коде не написано целиком, а склеено: `say("HEAD_" +
 * title.toUpperCase())`. Литерала такого имени в исходниках нет и быть не
 * может, и это законно — но названо здесь поимённо, с местом сборки.
 */
const BUILT: ReadonlyArray<{ owner: string; match: RegExp; where: string; count: number }> = [
  {
    owner: "user-tag-list",
    match: /^HEAD_/,
    where: 'custom/user_tags.ts: say("HEAD_" + title.toUpperCase()) — подпись колонки по её имени',
    count: 5,
  },
];

/* ---- долг, а не решение: строки, которые пока никто не спрашивает -------- */

/**
 * **Список пуст, и это состояние, а не пожелание** (дефект A46 закрыт
 * 2026-09-08).
 *
 * Здесь лежали шестьдесят четыре имени: каждое объявлено в таблице текстов,
 * попадает в `default.js` на диск — и рисовалось в панели **литералом**,
 * вторым объявлением тех же слов. Человек мог перевести любую строку, и на
 * экране не менялось ничего.
 *
 * Пятьдесят девять из них теперь спрашиваются по имени; три строки удалены —
 * `ROW_HOTKEY_ARIA`, `VALUE_PREFIX_HINT` и с ними одна пара половинок, —
 * потому что места на экране у них не было ни одного дня, и переводить человек
 * стал бы то, чего не увидит (У-71). Две уехали в подстановку примера.
 *
 * Список работает в обе стороны и потому оставлен пустым, а не удалён:
 *
 *   * появилось новое осиротевшее имя — проверка краснеет сразу;
 *   * имя починено, а из списка не убрано — проверка тоже краснеет, и список
 *     может только убывать.
 *
 * Разбор — PRD, строка A46.
 */
const KNOWN_ORPHANS: readonly string[] = [];

/* ---- сама проверка ------------------------------------------------------- */

{
  const orphans: string[] = [];
  const built: string[] = [];
  let checked = 0;

  const sweep = (label: string, owner: string, table: Readonly<Record<string, string>>): void => {
    for (const name of Object.keys(table)) {
      checked++;
      const rule = BUILT.find(b => b.owner === owner && b.match.test(name));
      if (rule) { built.push(owner + "." + name); continue; }
      if (!askedBy(name)) orphans.push(label + " " + owner + "." + name);
    }
  };

  for (const [owner, table] of Object.entries(BLOCK_TEXTS)) {
    sweep("блок", owner, table as Readonly<Record<string, string>>);
  }
  for (const [owner, table] of Object.entries(DIALOG_TEXTS)) {
    sweep("окно", owner, table as Readonly<Record<string, string>>);
  }
  sweep("панель", "frame", FRAME_TEXTS as Readonly<Record<string, string>>);

  /* Имя без пометки «блок»/«окно»/«панель»: список долга держит адрес, а не
     род таблицы. */
  const bare = orphans.map(o => o.split(" ").slice(1).join(" "));
  const fresh = bare.filter(n => !KNOWN_ORPHANS.includes(n));
  assert.deepEqual(fresh, [],
    "строка каталога объявлена и никем не спрашивается — человек её переведёт, а на экране\n"
    + "ничего не изменится (У-80, У-82). Новые осиротевшие:\n  " + fresh.join("\n  "));

  /* Список может только убывать: починили — уберите имя. Иначе долг однажды
     станет описанием состояния, которого нет (У-71). */
  const healed = KNOWN_ORPHANS.filter(n => !bare.includes(n));
  assert.deepEqual(healed, [],
    "эти имена уже спрашиваются — уберите их из KNOWN_ORPHANS тем же коммитом:\n  "
    + healed.join("\n  "));

  /* Число собираемых имён закреплено: вырастет — исключение надо обновить и
     объяснить, а не молча расширить. */
  for (const rule of BUILT) {
    const mine = built.filter(n => n.startsWith(rule.owner + ".") && rule.match.test(n.split(".")[1] || ""));
    assert.equal(mine.length, rule.count,
      "имён, собираемых по ходу, у " + rule.owner + " стало " + mine.length
      + " вместо " + rule.count + " (" + rule.where + ")");
  }

  assert.ok(checked > 250, "проверено имён " + checked + " — таблицы текстов не прочитались");
  ok("новых осиротевших строк нет: проверено " + checked + " имён, собираемых по ходу "
     + built.length + ", в долге A46 осталось " + KNOWN_ORPHANS.length);
}

/* ---- положительный контроль -------------------------------------------- */

{
  /*
   * Проверка «не осталось осиротевших» зелена и тогда, когда искать нечем:
   * сломанный образец, пустой список файлов, опечатка в имени поля. Поэтому
   * тут спрашивается обратное — что имя, которого никто не зовёт, проверка
   * находит. Имя выдуманное и в исходниках его нет.
   */
  assert.equal(askedBy("IO_NO_SUCH_TEXT_NAME_2026"), "",
    "обход нашёл имя, которого в исходниках нет — образец ловит лишнее");
  assert.ok(askedBy("VALUE_FILL_TIP"),
    "обход не находит имя, которое точно спрашивается: сломан образец или список файлов");
  /*
   * И то, ради чего проверка написана: пять подсказок колонок таблицы Values
   * обязаны спрашиваться по имени. Верни `columnTips` литералы — покраснеет
   * именно здесь, названными именами.
   */
  for (const name of ["LEVEL_TIP", "VALUE_TAG_TIP", "VALUE_LINK_TIP",
    "VALUE_PREFIX_TIP", "VALUE_SHOWN_TIP", "VALUE_FILL_TIP", "VALUE_TEXT_TIP",
    "VALUE_PREVIEW_TIP"]) {
    const where = askedBy(name);
    assert.ok(where.endsWith("fields_editor_view.ts"),
      "подсказку колонки " + name + " спрашивает не таблица Values, а " + (where || "никто"));
  }
  ok("положительный контроль: выдуманное имя проверка называет, живое находит");
}

/* ---- вторая половина: перевод доезжает до нарисованного ----------------- */

{
  /*
   * **Чего статический обход не видит.** Он спрашивает «зовёт ли это имя хоть
   * один файл» — и имя, которое зовёт **другой** блок, считает живым. Имена у
   * блоков и правда повторяются: `VALUES_EMPTY`, `ROW_ARIA`, `REMOVE` есть у
   * нескольких владельцев. Значит литерал в одном блоке может прятаться за
   * честным вызовом в другом.
   *
   * Поэтому вторая половина — поведенческая, и вопрос у неё другой: панель
   * рисуется целиком с подстановкой, которая **на всё** отвечает одним редким
   * словом, и в нарисованном не должно остаться ни одной длинной английской
   * строки из каталога. Длинных, потому что `Yes`, `No` и `default` встречаются
   * в разметке и по другим поводам.
   *
   * Это и есть проверка на симптом: не «имя названо», а «человек увидел
   * перевод» (У-96).
   */
  const { makeNode } = await import("../harness/dom_stub.ts");
  const { setupGlobals, Setting, Modal, Notice: StubNotice } = await import("../harness/obsidian_stub.ts");
  const { MemoryStore } = await import("../../src/ui/settings/store.ts");
  const { SettingsPane } = await import("../../src/ui/settings/settings_tab.ts");
  const { SCHEMA, TABS } = await import("../../src/ui/settings/schema/index.ts");
  const { loadPluginInternals } = await import("../harness/plugin_internals.ts");

  setupGlobals();
  const internals: Any = loadPluginInternals();
  const cfg: Any = internals.migrateConfig(JSON.parse(
    fs.readFileSync(path.join(root, "tests", "fixtures", "config_v1_full.json"), "utf8")));

  const plugin: Any = {
    app: { workspace: {}, vault: {} },
    manifest: { id: "inline-overhaul", version: "test", dir: ".obsidian/plugins/inline-overhaul" },
    getConfig: () => cfg,
    setConfigPatch: () => {},
    listOwnCommands: () => internals.buildOwnCommandList(plugin),
  };
  const platform: Any = {
    Setting, Notice: StubNotice, Modal, setIcon: () => {}, plugin,
    getConfig: () => cfg, normalizePkmOrder: internals.normalizePkmOrder, pkmOrderFields: [],
  };

  const MARK = "\u2039translated\u203a";
  /*
   * Каталог, в котором **каждый** ключ переведён одним редким словом. Он
   * собирается из `panelCatalog` — из того же списка, который панель кладёт
   * человеку в `default.js`, — а не пишется здесь: второй список ключей
   * разошёлся бы с первым молча (У-32), и часть строк осталась бы
   * непереведённой не потому, что дефект, а потому, что забыли ключ.
   */
  const { panelCatalog } = await import("../../src/ui/settings/texts_panel.ts");
  const allMarked: Record<string, string> = {};
  for (const entry of panelCatalog(SCHEMA, TABS) as ReadonlyArray<{ key: string }>) {
    allMarked[entry.key] = MARK;
  }
  assert.ok(Object.keys(allMarked).length > 900,
    "ключей в каталоге " + Object.keys(allMarked).length + " — список собрался не весь");

  const store = new MemoryStore(JSON.parse(JSON.stringify(cfg)));
  await store.set("general.help.showTips", true);
  for (const tab of TABS as Any[]) if (tab.module) await store.set(tab.module, true);
  const pane = new SettingsPane({
    schema: SCHEMA, tabs: TABS, store, actions: {},
    fragments: { createFragment: () => makeNode("fragment") }, platform,
    texts: () => ({ en: allMarked }),
  } as Any);

  const drawn: string[] = [];
  for (const tab of TABS as Any[]) {
    pane.setActiveTab(tab.id);
    const defs = pane.getSettingDefinitions() as Any[];
    const rows: Any[] = [];
    for (const def of defs) { if (Array.isArray(def.items)) rows.push(...def.items); else rows.push(def); }
    for (const row of rows) {
      if (typeof row.render !== "function") continue;
      const host = makeNode("div");
      const setting = new Setting(host);
      let close: Any;
      /*
       * Второй аргумент платформа не передаёт: контекст свой блок получает от
       * панели, замыканием. Значит подстановка обязана приехать **через
       * панель** — то есть каталогом, а не подделкой контекста здесь (У-1).
       */
      try { close = row.render(setting, {}); } catch { continue; }
      drawn.push(String(setting.settingEl.textContent || ""));
      if (typeof close === "function") close();
    }
  }
  const text = drawn.join("\n");
  assert.ok(text.length > 500, "своих блоков нарисовано на " + text.length + " знаков — рисовать не удалось");
  assert.ok(text.includes(MARK),
    "подстановка не доехала ни до одной строки: проверка ниже мерила бы пустоту");

  /* Английское из каталога, что длиннее двенадцати знаков и не с подстановкой. */
  const leaked: string[] = [];
  for (const [owner, table] of Object.entries(BLOCK_TEXTS)) {
    for (const [name, value] of Object.entries(table as Record<string, string>)) {
      const plain = String(value).replace(/<[^>]+>/g, "").split("{")[0]?.trim() || "";
      if (plain.length < 13) continue;
      if (text.includes(plain)) leaked.push(owner + "." + name + ": " + JSON.stringify(plain.slice(0, 40)));
    }
  }
  assert.deepEqual(leaked, [],
    "нарисовано английское при переведённом каталоге — значит место рисует литерал,\n"
    + "а не спрашивает строку (У-82):\n  " + leaked.join("\n  "));
  ok("перевод доезжает до нарисованного: своих блоков на " + text.length
     + " знаков, английского из каталога в них нет");
}

console.log("\n" + passed + " проверок пройдено");
