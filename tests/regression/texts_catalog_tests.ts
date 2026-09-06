/**
 * Каталог видимых текстов и язык панели (PRD 10.13.38).
 *
 * Проверяется настоящий код: ключи строит тот же модуль, что и продукт, файл
 * собирается и разбирается теми же функциями, а подстановка идёт через
 * настоящую `SettingsPane` на настоящей схеме.
 *
 * Три вопроса, ради которых эта проверка заведена:
 *
 *   1. **Ключ уникален и стабилен.** Два текста под одним ключом — это один
 *      перевод на два разных места, и заметно это только на экране.
 *   2. **Файл, который правит человек, читается обратно ровно тем же.** Он
 *      бывает сломан, сохранён формой Windows, дописан комментарием — и ни
 *      одно из этого не имеет права уронить панель (Я1).
 *   3. **Ключ, который панель спрашивает, в каталоге есть.** Опечатка в
 *      месте вызова даёт мёртвую строку каталога: человек её переводит, а на
 *      экране ничего не меняется.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SCHEMA, TABS } from "../../src/ui/settings/schema/index.ts";
import { COMMAND_TEXTS, PREVIEW_TEXTS, TAB_CALLOUTS } from "../../src/ui/settings/schema/custom_texts.ts";
import {
  BASE_LANG,
  LANGUAGE_NAME_KEY,
  catalogEntries,
  catalogFile,
  groupKey,
  itemKey,
  languageOptions,
  localizeSchema,
  localizeTabs,
  makeResolve,
  optionKey,
  parseCatalog,
  reportCatalog,
  tabKey,
} from "../../src/ui/settings/texts.ts";
import {
  SINGLE_KEYS,
  calloutKey,
  commandKey,
  previewKey,
} from "../../src/ui/settings/texts_custom.ts";
import { panelCatalog } from "../../src/ui/settings/texts_panel.ts";
import { DEFAULT_FILE } from "../../src/ui/settings/texts.ts";
import { dialogKey } from "../../src/ui/settings/texts_dialogs.ts";
import { SettingsPane } from "../../src/ui/settings/settings_tab.ts";
import { MemoryStore } from "../../src/ui/settings/store.ts";
import { makeNode } from "../harness/dom_stub.ts";
import { ensureCatalogFiles, readCatalogs, type TextFiles } from "../../src/ui/settings/texts_files.ts";
import { RU_SEED } from "../../src/ui/settings/texts_seed_ru.ts";
import { BASE_LANG_SEED } from "../../src/ui/settings/texts.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

const ENTRIES = panelCatalog(SCHEMA, TABS);
const KEYS = new Set(ENTRIES.map(e => e.key));

/* ---- 1. ключи ---------------------------------------------------------- */

{
  const seen = new Map<string, number>();
  for (const e of ENTRIES) seen.set(e.key, (seen.get(e.key) || 0) + 1);
  const twice = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  assert.deepEqual(twice, [], "один ключ на два текста: " + twice.join(", "));
  assert.ok(ENTRIES.length > 700, "строк в каталоге подозрительно мало: " + ENTRIES.length);
  for (const e of ENTRIES) assert.ok(e.text.trim() !== "", "пустой текст под ключом " + e.key);
  ok("ключи не повторяются, и за каждым стоит текст");
}

{
  /*
   * Ключ строки — `<группа>.<строка>.<слот>`, ключ группы — `<группа>.<слот>`.
   * Строка с id `heading`, `intro` или `tip` в своей же группе дала бы ключ,
   * неотличимый от группового: `visual-caret.tip` — это подсказка группы или
   * имя строки `tip`? Такой строки нет, и завестись она не должна молча.
   */
  const clash: string[] = [];
  for (const g of SCHEMA) {
    for (const it of g.items) {
      if (["heading", "intro", "tip"].indexOf(it.id) >= 0) clash.push(g.id + "." + it.id);
    }
  }
  assert.deepEqual(clash, [], "id строки совпал со слотом группы: " + clash.join(", "));

  /* Пустое значение выпадающего списка называется знаком `-`, и настоящего
     значения `-` быть не должно: иначе два варианта делят один ключ. */
  const dashed: string[] = [];
  for (const g of SCHEMA) {
    for (const it of g.items) {
      const options = (it as unknown as { options?: ReadonlyArray<{ value: string }> }).options;
      if (!Array.isArray(options)) continue;
      for (const o of options) if (o.value === "-") dashed.push(g.id + "." + it.id);
    }
  }
  assert.deepEqual(dashed, [], "значение `-` занято по-настоящему: " + dashed.join(", "));
  ok("схема адресации не сталкивает два текста в один ключ");
}

/* ---- 2. файл ----------------------------------------------------------- */

{
  const file = catalogFile(BASE_LANG, ENTRIES);
  const back = parseCatalog(file);
  assert.ok(back, "собранный файл не разобрался обратно");
  assert.equal(Object.keys(back as Record<string, string>).length, ENTRIES.length,
    "круг файла потерял строки");
  for (const e of ENTRIES) {
    assert.equal((back as Record<string, string>)[e.key], e.text, "текст изменился на круге: " + e.key);
  }

  /*
   * Форма Windows и одиночный возврат каретки: файл правит человек, и в чём
   * его сохранит его редактор, мы не решаем (У-77). Пару `\r\n` `JSON.parse`
   * пережил бы и сам — возврат каретки для него пробел, — а вот файл, где
   * перевода строки нет вовсе, распадается на одну строку, и границы объекта
   * по строкам искать негде.
   */
  const crlf = parseCatalog(file.replace(/\n/g, "\r\n"));
  assert.deepEqual(crlf, back, "файл с возвратом каретки прочитался иначе");
  const crOnly = parseCatalog(file.replace(/\n/g, "\r"));
  assert.deepEqual(crOnly, back, "файл, где перевод строки — один возврат каретки, не прочитался");

  /* Шапка с фигурными скобками — та самая, что стоит в файле: поиск первой
     скобки в файле приводил в неё, а не в объект. */
  assert.ok(file.indexOf("window.IO_TEXTS || {}") >= 0,
    "шапка файла изменилась — проверка границ объекта потеряла предмет");
  ok("файл каталога читается обратно ровно тем же, и в форме Windows тоже");
}

{
  /* Сломанный файл — не исключение, а «нет перевода» (Я1). */
  for (const broken of [
    "",
    "не файл вовсе",
    'window.IO_TEXTS["ru"] =\n{\n  "a": "b",\n};',        /* запятая после последней строки */
    'window.IO_TEXTS["ru"] =\n{\n  "a": "b"  // заметка\n};',
    'window.IO_TEXTS["ru"] =\n{\n  "a": 5\n};',
  ]) {
    let out: unknown = "не вызывалось";
    assert.doesNotThrow(() => { out = parseCatalog(broken); }, "разбор бросил на файле: " + broken.slice(0, 30));
    if (broken.indexOf('"a": 5') >= 0) {
      assert.deepEqual(out, {}, "не строка приехала текстом");
    } else {
      assert.equal(out, null, "сломанный файл прочитался: " + broken.slice(0, 30));
    }
  }
  ok("сломанный файл не роняет чтение и не приносит мусора");
}

/* ---- 3. подстановка ---------------------------------------------------- */

{
  const t = makeResolve({
    ru: { "a.b.name": "по-русски" },
    en: { "a.b.name": "in English", "a.b.desc": "only English" },
  }, "ru");
  assert.equal(t("a.b.name", "схема"), "по-русски", "свой язык не выиграл");
  assert.equal(t("a.b.desc", "схема"), "only English", "английский файл не подставился");
  assert.equal(t("a.b.tip", "схема"), "схема", "ответом должно быть написанное в схеме");

  const empty = makeResolve({ ru: { "a.b.name": "" } }, "ru");
  assert.equal(empty("a.b.name", "схема"), "схема", "пустая строка перевода должна уступать");

  const none = makeResolve({}, "ru");
  assert.equal(none("a.b.name", "схема"), "схема", "без каталогов ответ — схема");
  ok("порядок подстановки: свой язык, английский файл, схема");
}

{
  /* Копия, а не правка на месте: переключение языка обязано быть обратимым. */
  const t = makeResolve({ ru: { [groupKey("help", "heading")]: "Помощь" } }, "ru");
  const ru = localizeSchema(SCHEMA, t);
  const help = SCHEMA.find(g => g.id === "help");
  const helpRu = ru.find(g => g.id === "help");
  assert.ok(help && helpRu, "группы help нет ни там, ни там");
  assert.equal((helpRu as Any).heading, "Помощь", "заголовок не перевёлся");
  assert.equal((help as Any).heading, "Help", "исходная схема изменилась — язык не вернуть");

  /* Функции переносятся, а не клонируются: предикат и рендерер — код. */
  for (let i = 0; i < SCHEMA.length; i++) {
    const was = SCHEMA[i] as Any;
    const now = ru[i] as Any;
    assert.equal(now.id, was.id, "порядок групп изменился");
    assert.equal(now.visible, was.visible, "предикат группы подменён: " + was.id);
    for (let k = 0; k < was.items.length; k++) {
      assert.equal(now.items[k].id, was.items[k].id, "порядок строк изменился в " + was.id);
      assert.equal(now.items[k].render, was.items[k].render, "рендерер подменён: " + was.items[k].id);
      assert.equal(now.items[k].visible, was.items[k].visible, "предикат строки подменён: " + was.items[k].id);
      assert.equal(now.items[k].path, was.items[k].path, "путь конфига изменился: " + was.items[k].id);
      assert.equal(
        JSON.stringify(now.items[k]["default"]),
        JSON.stringify(was.items[k]["default"]),
        "умолчание изменилось: " + was.items[k].id,
      );
    }
  }
  ok("перевод — копия: пути, умолчания, предикаты и рендереры те же");
}

{
  /* Варианты списка и старые имена для поиска переводятся тоже. */
  const steps = SCHEMA.flatMap(g => g.items.map(it => ({ g, it })))
    .find(x => (x.it as Any).options && (x.it as Any).options.length
      && (x.it as Any).searchTerms && (x.it as Any).searchTerms.length);
  assert.ok(steps, "в схеме нет строки со списком и старым именем — проверять нечего");
  const { g, it } = steps as Any;
  const value = String(it.options[0].value);
  const t = makeResolve({
    ru: {
      [optionKey(g.id, it.id, value)]: "вариант",
      [itemKey(g.id, it.id, "search.0")]: "старое имя",
    },
  }, "ru");
  const ru = localizeSchema(SCHEMA, t);
  const now = ru.find(x => x.id === g.id)?.items.find(x => x.id === it.id) as Any;
  assert.equal(now.options[0].label, "вариант", "подпись варианта не перевелась");
  assert.equal(now.searchTerms[0], "старое имя", "старое имя для поиска не перевелось");
  ok("подписи вариантов и слова поиска тоже уезжают в каталог");
}

{
  const t = makeResolve({ ru: { [tabKey("visual", "label")]: "Вид" } }, "ru");
  const tabs = localizeTabs(TABS, t);
  assert.equal(tabs.find(x => x.id === "visual")?.label, "Вид", "подпись вкладки не перевелась");
  assert.equal(TABS.find(x => x.id === "visual")?.label, "Visual", "исходные вкладки изменились");
  ok("полоса вкладок говорит на выбранном языке");
}

/* ---- 4. панель --------------------------------------------------------- */

/** Описания рисуются в узел платформы; здесь его роль играет заглушка DOM. */
const FRAGMENTS = { createFragment: () => makeNode("fragment") };

function paneWith(catalogs: Any, config?: Any): SettingsPane {
  return new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store: new MemoryStore(config || {}),
    actions: {},
    fragments: FRAGMENTS as never,
    texts: () => catalogs,
  });
}

{
  /* Язык из конфига доезжает до того, что человек видит в панели. */
  const catalogs = { ru: { [groupKey("help", "heading")]: "Помощь" } };
  const english = paneWith(catalogs);
  const russian = paneWith(catalogs, { general: { language: "ru" } });

  const headingsOf = (pane: SettingsPane): string[] =>
    (pane.getSettingDefinitions() as Any[]).map(d => String(d.heading || ""));
  assert.ok(headingsOf(english).indexOf("Help") >= 0, "по умолчанию панель обязана быть английской");
  assert.ok(headingsOf(russian).indexOf("Помощь") >= 0,
    "выбранный язык не доехал до панели: " + headingsOf(russian).join(", "));
  /* Ключ, которого в каталоге нет, остаётся английским, а не пустым (Я4). */
  assert.ok(headingsOf(russian).indexOf("Modules") >= 0,
    "непереведённый заголовок пропал вместо того, чтобы остаться английским");
  ok("панель говорит выбранным языком, а непереведённое остаётся английским");
}

{
  /* Смена языка на лету: пересборка обязана случиться, и текст — смениться. */
  const catalogs = { ru: { [groupKey("help", "heading")]: "Помощь" } };
  let rebuilds = 0;
  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store: new MemoryStore({}),
    actions: {},
    fragments: FRAGMENTS as never,
    texts: () => catalogs,
    rebuild: () => { rebuilds++; },
  });
  const headings = (): string[] => (pane.getSettingDefinitions() as Any[]).map(d => String(d.heading || ""));
  assert.ok(headings().indexOf("Help") >= 0, "панель не собралась по-английски");
  await pane.setControlValue("general.language", "ru");
  assert.ok(rebuilds > 0, "смена языка не попросила пересборку");
  assert.ok(headings().indexOf("Помощь") >= 0, "после смены языка текст остался прежним");
  await pane.setControlValue("general.language", "en");
  assert.ok(headings().indexOf("Help") >= 0, "возврат к английскому не сработал");
  ok("язык переключается на лету и переключается обратно");
}

{
  /* Список языков собирается из файлов, а не из списка в коде. */
  const options = languageOptions({
    en: { [LANGUAGE_NAME_KEY]: "English" },
    de: { [LANGUAGE_NAME_KEY]: "Deutsch" },
    xx: {},
  });
  assert.deepEqual(options.map(o => o.value), ["de", "en", "xx"], "список языков собран не из папки");
  assert.equal(options.find(o => o.value === "de")?.label, "Deutsch", "имя языка берётся не из файла");
  assert.equal(options.find(o => o.value === "xx")?.label, "xx",
    "файл без имени языка обязан называться хотя бы своим кодом");
  assert.deepEqual(languageOptions({}).map(o => o.value), [BASE_LANG],
    "без единого файла в списке обязан остаться английский");
  ok("языки берутся из папки, а имя языка — из самого файла");
}

/* ---- 5. ключи своих блоков --------------------------------------------- */

{
  /*
   * Ключ, который спрашивает свой блок, обязан быть в каталоге. Иначе строка
   * каталога мертва: человек её переводит, а на экране ничего не меняется —
   * и понять это по экрану нельзя.
   */
  const asked: string[] = [];
  for (const tab of Object.keys(TAB_CALLOUTS)) {
    for (const slot of ["head", "tip", "body"] as const) asked.push(calloutKey(tab, slot));
  }
  for (const single of Object.values(SINGLE_KEYS)) asked.push(single);
  /* Ровно те ключи, которые стоят в `previews.ts` литералами. */
  asked.push(previewKey("tag-preview", "line"));
  asked.push(previewKey("tag-preview", "element"));
  asked.push(previewKey("tag-preview", "link"));
  asked.push(previewKey("i2n-button-preview", "note"));
  asked.push(previewKey("caret-preview", "note"));
  for (const id of Object.keys(PREVIEW_TEXTS)) {
    asked.push(previewKey(id, "cap"));
    asked.push(previewKey(id, "tip"));
  }
  COMMAND_TEXTS.forEach((area, i) => {
    asked.push(commandKey(i, "area"));
    if (area.parts) {
      asked.push(commandKey(i, "parts.standard"));
      asked.push(commandKey(i, "parts.user"));
    }
    area.list.forEach((_cmd, k) => asked.push(commandKey(i, "list." + k + ".does")));
  });

  const missing = asked.filter(key => !KEYS.has(key));
  assert.deepEqual(missing, [], "свой блок спрашивает ключ, которого в каталоге нет: " + missing.join(", "));
  ok("каждый ключ, который спрашивает свой блок, в каталоге есть");
}

{
  /*
   * Ключи строятся одной функцией на оба конца. Строковый литерал в месте
   * вызова — это второе объявление ключа, и расходятся такие молча (У-32).
   */
  const files = ["src/ui/settings/custom/callouts.ts", "src/ui/settings/custom/previews.ts",
    "src/ui/settings/custom/command_reference.ts", "src/ui/settings/to_definitions.ts"];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    /*
     * Предмет — **ключ**, а не слот: `say("head")` внутри блока законен, там
     * слот и превращается в ключ функцией `calloutKey`. Незаконно другое —
     * литеральная строка там, где ждут готовый ключ.
     */
    const literal = [
      ...text.matchAll(/\.t\(\s*"/g),
      ...text.matchAll(/say\(\s*ctx\s*,\s*"/g),
    ];
    assert.equal(literal.length, 0,
      rel + ": ключ каталога записан литералом, а не собран функцией ключей");
  }
  ok("ключ собирается функцией, а не пишется литералом в месте вызова");
}

/* ---- 6. отчёт о недостающем -------------------------------------------- */

{
  const first = ENTRIES[0];
  const second = ENTRIES[1];
  assert.ok(first && second, "каталог пуст");
  const report = reportCatalog("ru", {
    [first.key]: "переведено",
    [second.key]: second.text,
    "сюда.никто.не.смотрит": "старьё",
  }, ENTRIES);
  assert.equal(report.total, ENTRIES.length, "всего ключей посчитано неверно");
  assert.equal(report.missing.length, ENTRIES.length - 2, "недостающие посчитаны неверно");
  assert.deepEqual(report.untranslated, [second.key], "совпавший с английским не назван непереведённым");
  assert.deepEqual(report.unknown, ["сюда.никто.не.смотрит"], "лишний ключ не назван");
  /* Имя языка лишним не считается: оно и не должно быть в английской ветке. */
  const named = reportCatalog("ru", { [LANGUAGE_NAME_KEY]: "Русский" }, ENTRIES);
  assert.deepEqual(named.unknown, [], "имя языка сочтено лишним ключом");
  ok("отчёт называет недостающее, лишнее и непереведённое");
}

/* ---- 7. каталоги на диске ---------------------------------------------- */

/** Поддельное хранилище: карта путь → текст, как в проверках копий настроек. */
function makeFiles(): { files: TextFiles; map: Map<string, string>; dirs: Set<string>; reads: string[] } {
  const map = new Map<string, string>();
  const dirs = new Set<string>();
  const reads: string[] = [];
  return {
    map,
    dirs,
    reads,
    files: {
      exists: (p: string) => map.has(p) || dirs.has(p),
      read: (p: string) => {
        reads.push(p);
        const text = map.get(p);
        if (text === undefined) throw new Error("нет файла: " + p);
        return text;
      },
      write: (p: string, data: string) => { map.set(p, data); },
      mkdir: (p: string) => { dirs.add(p); },
      list: (p: string) => ({ files: [...map.keys()].filter(k => k.indexOf(p + "/") === 0) }),
    },
  };
}

const FOLDER = ".obsidian/plugins/inline-overhaul";

{
  /* Первый запуск: файлов нет, и плагин кладёт оба своих языка. */
  const fake = makeFiles();
  const written = await ensureCatalogFiles(fake.files, FOLDER, ENTRIES, { en: BASE_LANG_SEED, ru: RU_SEED });
  /*
   * Английского снимка среди них нет и быть не должно (10.13.46): файл
   * человека не перезаписывается, и такой снимок замораживал бы каждую
   * позднейшую переформулировку — в подстановке он стоит раньше схемы.
   */
  assert.deepEqual(written.slice().sort(),
    [FOLDER + "/texts/" + DEFAULT_FILE + ".js", FOLDER + "/texts/ru.js"],
    "первый запуск положил не те файлы: " + written.join(", "));
  assert.ok(fake.dirs.has(FOLDER + "/texts"), "папка каталогов не заведена");

  const read = await readCatalogs(fake.files, FOLDER);
  assert.deepEqual(read.broken, [], "свой же файл не прочитался: " + read.broken.join(", "));
  /* `default.js` языком не считается: английский живёт в схеме. */
  assert.deepEqual(Object.keys(read.catalogs).sort(), ["ru"],
    "прочитались не те языки: " + Object.keys(read.catalogs).join(", "));
  const mine = parseCatalog(fake.map.get(FOLDER + "/texts/" + DEFAULT_FILE + ".js") || "");
  assert.ok(mine, "файл плагина не разобрался");
  assert.equal(mine![ENTRIES[0]!.key], ENTRIES[0]!.text, "файл плагина вернул не тот текст");
  assert.equal(Object.keys(mine!).length, ENTRIES.length, "файл плагина потерял строки");
  assert.equal(read.catalogs["ru"]?.[LANGUAGE_NAME_KEY], "Русский",
    "русский файл не назвал своего языка");
  /* Английский в списке есть всегда, и подписан он именем, а не кодом. */
  assert.deepEqual(languageOptions(read.catalogs).map(o => o.label), ["English", "Русский"],
    "список языков подписан не именами из файлов");
  assert.equal(read.catalogs["ru"]?.[tabKey("visual", "label")], "Вид",
    "переведённая строка не доехала до файла");
  /* Ключ **вне** засева: непереведённая строка обязана лежать в файле
     английской, а не пустой — так её и переводят, строка за строкой. */
  const untouched = ENTRIES.find(e => !RU_SEED[e.key]);
  assert.ok(untouched, "в засеве переведено всё — проверять нечего");
  assert.equal(read.catalogs["ru"]?.[untouched!.key], untouched!.text,
    "непереведённая строка обязана лежать в файле английской, а не пустой");
  ok("первый запуск кладёт файл плагина и русский, и они читаются обратно");
}

{
  /*
   * Второй запуск ничего не перезаписывает: в файле правка человека, и
   * обновление плагина не имеет права её унести.
   */
  const fake = makeFiles();
  await ensureCatalogFiles(fake.files, FOLDER, ENTRIES, { en: BASE_LANG_SEED, ru: RU_SEED });
  const mine = 'window.IO_TEXTS["en"] =\n{\n  ' + JSON.stringify(ENTRIES[0]!.key) + ': "моё слово"\n};';
  fake.map.set(FOLDER + "/texts/en.js", mine);

  const again = await ensureCatalogFiles(fake.files, FOLDER, ENTRIES, { en: BASE_LANG_SEED, ru: RU_SEED });
  assert.deepEqual(again, [], "второй запуск переписал существующие файлы");
  assert.equal(fake.map.get(FOLDER + "/texts/en.js"), mine, "правка человека не пережила запуск");

  const read = await readCatalogs(fake.files, FOLDER);
  assert.equal(read.catalogs["en"]?.[ENTRIES[0]!.key], "моё слово", "правка человека не доехала");
  /* И ключ, которого в его файле нет, обязан уступить схеме, а не пропасть. */
  const t = makeResolve(read.catalogs, "en");
  assert.equal(t(ENTRIES[1]!.key, ENTRIES[1]!.text), ENTRIES[1]!.text,
    "ключа нет в файле человека — ответом обязана быть схема");
  ok("файл человека переживает запуск, а недостающие строки берутся из схемы");
}

{
  /* Чужой файл в папке — это новый язык, и регистрировать его негде. */
  const fake = makeFiles();
  fake.map.set(FOLDER + "/texts/de.js",
    'window.IO_TEXTS["de"] =\n{\n  ' + JSON.stringify(LANGUAGE_NAME_KEY) + ': "Deutsch"\n};');
  fake.dirs.add(FOLDER + "/texts");
  const read = await readCatalogs(fake.files, FOLDER);
  assert.deepEqual(Object.keys(read.catalogs), ["de"], "принесённый язык не подхватился");
  assert.deepEqual(languageOptions(read.catalogs).map(o => o.value), ["de", BASE_LANG],
    "принесённый язык не попал в список");
  ok("язык, принесённый человеком, подхватывается сам");
}

{
  /* Сломанный файл называется по имени, а не роняет чтение. */
  const fake = makeFiles();
  fake.dirs.add(FOLDER + "/texts");
  fake.map.set(FOLDER + "/texts/ru.js", "здесь человек всё сломал");
  fake.map.set(FOLDER + "/texts/notes.txt", "не каталог вовсе");
  const read = await readCatalogs(fake.files, FOLDER);
  assert.deepEqual(read.broken, ["ru.js"], "сломанный файл не назван: " + read.broken.join(", "));
  assert.deepEqual(Object.keys(read.catalogs), [], "из сломанного файла что-то прочиталось");
  assert.ok(fake.reads.indexOf(FOLDER + "/texts/notes.txt") < 0,
    "прочитан файл, который каталогом не является");
  ok("сломанный файл назван по имени, а посторонний не читается вовсе");
}

/* ---- 8. файл плагина держится в строю (10.13.46) ----------------------- */

{
  /*
   * Новая строка каталога обязана доехать до `default.js` **сама**: ради этого
   * файл и заведён. Заказчик: «убедись, что в нём будут автоматически
   * выполняться изменения, происходящие в ходе дальнейшей доработки плагина».
   */
  const fake = makeFiles();
  const half = ENTRIES.slice(0, ENTRIES.length - 5);
  await ensureCatalogFiles(fake.files, FOLDER, half, { en: BASE_LANG_SEED, ru: RU_SEED });
  const path = FOLDER + "/texts/" + DEFAULT_FILE + ".js";
  assert.equal(Object.keys(parseCatalog(fake.map.get(path) || "") || {}).length, half.length,
    "файл плагина записан не тем составом");

  const grown = await ensureCatalogFiles(fake.files, FOLDER, ENTRIES, { en: BASE_LANG_SEED, ru: RU_SEED });
  assert.ok(grown.indexOf(path) >= 0, "новые строки не доехали до файла плагина");
  const now = parseCatalog(fake.map.get(path) || "") || {};
  assert.equal(Object.keys(now).length, ENTRIES.length, "файл плагина отстал на новые строки");
  const fresh = ENTRIES[ENTRIES.length - 1]!;
  assert.equal(now[fresh.key], fresh.text, "последняя строка каталога в файл плагина не попала");

  /* И третий заход, когда всё совпало, не пишет ничего. */
  const quiet = await ensureCatalogFiles(fake.files, FOLDER, ENTRIES, { en: BASE_LANG_SEED, ru: RU_SEED });
  assert.deepEqual(quiet, [], "запуск без изменений всё равно писал файлы: " + quiet.join(", "));
  ok("файл плагина догоняет каталог сам, а без расхождения не пишется вовсе");
}

{
  /*
   * Файл языка, в котором ничего не тронуто, тоже держится в строю: держать
   * его отставшим незачем. А правка человека замораживает файл навсегда
   * — в нём его работа, и обновление плагина не имеет права её унести.
   */
  const fake = makeFiles();
  const half = ENTRIES.slice(0, ENTRIES.length - 5);
  await ensureCatalogFiles(fake.files, FOLDER, half, { en: BASE_LANG_SEED, ru: RU_SEED });
  const ru = FOLDER + "/texts/ru.js";

  const caught = await ensureCatalogFiles(fake.files, FOLDER, ENTRIES, { en: BASE_LANG_SEED, ru: RU_SEED });
  assert.ok(caught.indexOf(ru) >= 0, "нетронутый файл языка не догнал каталог");
  assert.equal(Object.keys(parseCatalog(fake.map.get(ru) || "") || {}).length, ENTRIES.length + 1,
    "нетронутый файл языка отстал на новые строки");

  /* Теперь человек правит одну строку — и файл становится его. */
  const mine = String(fake.map.get(ru) || "")
    .replace(JSON.stringify(ENTRIES[0]!.text), JSON.stringify("моё слово"));
  assert.notEqual(mine, fake.map.get(ru), "правку в файл внести не удалось");
  fake.map.set(ru, mine);
  const more = ENTRIES.concat([{ key: "выдуманный.ключ.name", text: "one more line" }]);
  const after = await ensureCatalogFiles(fake.files, FOLDER, more, { en: BASE_LANG_SEED, ru: RU_SEED });
  assert.ok(after.indexOf(ru) < 0, "файл с правкой человека переписан");
  assert.equal(fake.map.get(ru), mine, "правка человека не пережила запуск");
  ok("нетронутый файл языка догоняет каталог, а тронутый плагин больше не трогает");
}

{
  /* Сломанный файл не переписывается: разобрать его нельзя, а стереть недописанное — можно. */
  const fake = makeFiles();
  await ensureCatalogFiles(fake.files, FOLDER, ENTRIES, { en: BASE_LANG_SEED, ru: RU_SEED });
  const ru = FOLDER + "/texts/ru.js";
  fake.map.set(ru, "здесь человек всё сломал");
  const more = ENTRIES.concat([{ key: "ещё.один.ключ.name", text: "one more line" }]);
  const after = await ensureCatalogFiles(fake.files, FOLDER, more, { en: BASE_LANG_SEED, ru: RU_SEED });
  assert.ok(after.indexOf(ru) < 0, "сломанный файл переписан");
  assert.equal(fake.map.get(ru), "здесь человек всё сломал", "сломанный файл не сохранился как был");
  ok("сломанный файл языка плагин не переписывает");
}

/* ---- 9. порядок каталога = порядок панели (10.13.46) ------------------- */

{
  /*
   * Заказчик: «файл логично сгруппирован — callouts и tips элемента находятся
   * рядом с названием хедера или опции». Проверяется это порядком: все строки
   * одной вкладки идут подряд, внутри вкладки все строки группы идут подряд, и
   * тексты своего блока стоят там же, где сам блок.
   */
  const tabOf = new Map<string, string>();
  const groupOf = new Map<string, string>();
  for (const tab of TABS) {
    for (const g of SCHEMA.filter(x => x.tab === tab.id)) {
      groupOf.set(g.id, tab.id);
    }
    tabOf.set(tab.id, tab.id);
  }

  /*
   * К какой вкладке относится ключ. Три ответа, а не два: вкладка, «своё
   * место у соседа» (тексты окна, предпросмотра и справочника команд идут
   * внутри строки и вкладку не называют) и общий хвост.
   */
  const NEUTRAL = "";
  const whose = (key: string): string | null => {
    if (key.indexOf("tab.") === 0) return key.split(".")[1] || null;
    if (key.indexOf("callout.") === 0) return key.split(".")[1] || null;
    if (key.indexOf("frame.") === 0 || key.indexOf("text.") === 0 || key.indexOf("dialog.shared.") === 0) {
      return null;
    }
    if (key.indexOf("dialog.") === 0 || key.indexOf("preview.") === 0 || key.indexOf("commands.") === 0) {
      return NEUTRAL;
    }
    const group = key.split(".")[0] || "";
    return groupOf.get(group) || null;
  };

  const seen: string[] = [];
  let tailStarted = false;
  for (const entry of ENTRIES) {
    const tab = whose(entry.key);
    if (tab === null) { tailStarted = true; continue; }
    assert.ok(!tailStarted, "строка вкладки стоит после общего хвоста: " + entry.key);
    if (tab === NEUTRAL) continue;
    if (seen[seen.length - 1] !== tab) {
      assert.ok(seen.indexOf(tab) < 0, "строки вкладки " + tab + " разорваны: " + entry.key);
      seen.push(tab);
    }
  }
  assert.deepEqual(seen, TABS.map(t => t.id).filter(id => SCHEMA.some(g => g.tab === id)),
    "порядок вкладок в каталоге не тот, что в панели");

  /* Коллаут вкладки стоит в её первой группе, а не в общем разделе. */
  for (const tab of TABS) {
    const head = ENTRIES.findIndex(e => e.key === tabKey(tab.id, "label"));
    const callout = ENTRIES.findIndex(e => e.key === calloutKey(tab.id, "head"));
    if (callout < 0) continue;
    assert.ok(callout > head && callout - head < 12,
      "коллаут вкладки " + tab.id + " стоит далеко от её заголовка: " + (callout - head) + " строк");
  }

  /* Тексты окна стоят сразу за кнопкой, которая его открывает. */
  const save = ENTRIES.findIndex(e => e.key === dialogKey("SAVE_TITLE"));
  const button = ENTRIES.findIndex(e => e.text === "Save a backup" && e.key.indexOf("dialog.") !== 0);
  assert.ok(save > 0 && button > 0 && save - button < 10,
    "заголовки окна `Save a backup` встали не рядом со своей кнопкой");
  ok("каталог сгруппирован так же, как панель: вкладка, группа, строка и её окно");
}

console.log("\n" + passed + " проверок пройдено");
