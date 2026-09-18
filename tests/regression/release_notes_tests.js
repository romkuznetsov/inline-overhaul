"use strict";

/**
 * Окно «что изменилось» после обновления плагина (Р14, его слово 2026-09-16).
 *
 * **Что здесь закреплено и почему именно это.**
 *
 *   1. *Текст доезжает до сборки.* В релизе три файла, `CHANGELOG.md` среди них
 *      нет, и единственный способ показать раздел человеку — вложить его при
 *      сборке. Проверка спрашивает **ту же функцию**, которой его спрашивает
 *      продукт, а не читает файл рядом (У-4).
 *   2. *Раздел своей версии есть.* Выпуск без рассказа о том, что изменилось,
 *      открыл бы пустое окно — молчание, неотличимое от дефекта.
 *   3. *Решение «показывать ли»* — три случая, и у каждого свой контроль.
 *      Без второго и третьего запрет «один раз на версию» выполнялся бы и
 *      кодом, который не показывает никогда (У-127).
 *   4. *Разбор `CHANGELOG.md`* режет по разделам версий и не берёт
 *      `## Unreleased`: у него нет номера, с которым его можно сравнить.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const notes = require(path.join(root, "src", "features", "release_notes.js"));
const gen = require(path.join(root, "tools", "build", "gen_release_notes.js"));

let passed = 0;
function ok(label) { passed++; console.log("  ok " + label); }

{
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const version = String(manifest.version || "").trim();
  const text = notes.releaseNotesFor(version);
  assert.ok(text.length > 40,
    "раздел версии " + version + " не доехал до сборки (" + text.length + " знаков)");
  /*
   * **Контроль к первому утверждению** (У-127): функция отвечает пустотой
   * там, где раздела нет. Иначе «раздел есть» выполнялось бы кодом, который
   * отдаёт что угодно на любой вопрос.
   */
  assert.equal(notes.releaseNotesFor("0.0.0-нет-такой"), "",
    "на неизвестную версию заметки обязаны быть пустыми");
  assert.equal(notes.releaseNotesFor(""), "", "и на пустую версию тоже");
  ok("раздел своей версии лежит в сборке, чужой — нет");
}

{
  const version = "9.9.9";
  const planned = (o) => notes.planReleaseNotes(Object.assign({ version }, o));
  /* Раздела для выдуманной версии нет — значит «запомнить», а не «показать». */
  assert.equal(planned({ shownFor: "" }).decision, "remember",
    "выпуск без раздела окна не открывает: показывать нечего");

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const real = String(manifest.version || "").trim();
  assert.equal(notes.planReleaseNotes({ version: real, shownFor: "" }).decision, "show",
    "версия сменилась и раздел есть — окно открывается");
  assert.equal(notes.planReleaseNotes({ version: real, shownFor: real }).decision, "done",
    "ту же версию второй раз не показываем");
  assert.equal(notes.planReleaseNotes({ version: real, shownFor: "0.1.0" }).decision, "show",
    "после обновления с прошлой версии — показываем");
  assert.equal(
    notes.planReleaseNotes({ version: real, shownFor: "", freshInstall: true }).decision,
    "remember",
    "на свежей установке окна нет: прошлой версии у человека не было");
  assert.ok(notes.planReleaseNotes({ version: real, shownFor: "" }).text.length > 40,
    "решение «показать» несёт с собой сам текст");
  ok("решение об окне: показать, запомнить, не показывать второй раз");
}

{
  const parsed = gen.parseChangelogSections([
    "# Changelog",
    "",
    "## Unreleased",
    "",
    "- ещё не выпущено",
    "",
    "## 1.2.3",
    "",
    "### Раздел",
    "",
    "- строка выпуска",
    "",
    "## 1.2.2",
    "",
    "- прошлое",
  ].join("\n"));
  assert.deepEqual(Object.keys(parsed), ["1.2.3", "1.2.2"],
    "разделы версий разобраны по порядку, `Unreleased` не взят");
  assert.ok(parsed["1.2.3"].indexOf("строка выпуска") !== -1, "тело раздела на месте");
  assert.ok(parsed["1.2.3"].indexOf("ещё не выпущено") === -1,
    "чужое тело в раздел не затекло");
  assert.ok(parsed["1.2.3"].indexOf("## 1.2.2") === -1,
    "раздел кончается на следующем заголовке версии, а не на конце файла (У-134)");
  ok("разбор CHANGELOG.md: только разделы версий, каждый со своим телом");
}

{
  /*
   * **У адреса один дом.** Его знают двое — ссылка в окне и кнопка панели, — и
   * второй литерал разошёлся бы с первым при первом же переезде репозитория.
   * Спрашивается свойство, а не список файлов: во всём рантайме адрес объявлен
   * ровно один раз, и это объявление — здесь.
   */
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) { walk(full); continue; }
      if (/\.(js|ts)$/.test(name)) files.push(full);
    }
  };
  walk(path.join(root, "src"));
  assert.ok(files.length > 50, "обход рантайма нашёл " + files.length + " файлов — ищет не то");
  const host = "github.com/romkuznetsov";
  const carriers = files.filter((f) => fs.readFileSync(f, "utf8").includes(host));
  assert.deepEqual(
    carriers.map((f) => path.relative(root, f).split(path.sep).join("/")),
    ["src/features/release_notes.js"],
    "адрес репозитория объявлен не в одном месте");
  ok("адрес полного рассказа объявлен один раз на весь рантайм");
}

{
  /*
   * **Сравнение версий** — то, чем окно решает, о каких выпусках человеку ещё
   * не рассказывали. Ответы разведены нарочно: сравнение, у которого все
   * ответы одинаковы, прошло бы на одном примере (У-147).
   */
  const cmp = notes.compareVersions;
  assert.equal(cmp("0.3.2", "0.3.1"), 1, "старшая заплатка больше младшей");
  assert.equal(cmp("0.3.1", "0.3.2"), -1, "и наоборот");
  assert.equal(cmp("0.4.0", "0.3.9"), 1, "второй знак сильнее третьего");
  assert.equal(cmp("1.0.0", "0.9.9"), 1, "первый сильнее второго");
  assert.equal(cmp("0.3.2", "0.3.2"), 0, "равные равны");
  /* Бета слабее своего выпуска — это правило `docs/VERSIONING.md`. */
  assert.equal(cmp("0.1.0", "0.1.0-beta.6"), 1, "выпуск старше своей беты");
  assert.equal(cmp("0.1.0-beta.6", "0.1.0-beta.5"), 1, "и беты сравнимы между собой");
  /* Мусор не роняет сравнение: окно — украшение, и падать ему не за что. */
  assert.equal(cmp("", ""), 0, "пустые равны");
  assert.equal(cmp("0.3.2", ""), 1, "номер больше пустоты");
  ok("сравнение версий: три знака, бета слабее выпуска, мусор не роняет");
}

{
  /*
   * **Окно показывает все пропущенные выпуски** — его слово 2026-09-19: «если
   * последнее обновление было 2 релиза назад, то в этом чейнджлоге должны
   * показываться изменения в этих двух версиях».
   *
   * Спрашивается не количество, а **номера**: «разделов два» верно и тогда,
   * когда это не те два (У-58). Разделы берутся те же, что уехали в сборку —
   * своих номеров проверка не придумывает.
   */
  const known = notes.knownVersions();
  assert.ok(known.length >= 3,
    "выпусков в сборке " + known.length + " — сравнивать было бы нечем (У-200)");
  assert.deepEqual(known.slice().sort((a, b) => notes.compareVersions(b, a)), known,
    "список выпусков идёт от новых к старым");

  const newest = known[0];
  const prev = known[1];
  const older = known[2];

  const since = (from, to) => notes.releaseNotesSince(from, to).map((s) => s.version);
  assert.deepEqual(since(prev, newest), [newest],
    "обновился на один выпуск — рассказ про один");
  assert.deepEqual(since(older, newest), [newest, prev],
    "обновился через выпуск — рассказ про оба, новый сверху");
  assert.deepEqual(since("", newest), [newest],
    "прежней версии не знаем — только нынешняя, а не вся история");
  assert.deepEqual(since(newest, newest), [newest],
    "та же версия — рассказ про неё (решение «показывать ли» принято раньше)");
  assert.deepEqual(since("9.9.9", newest), [newest],
    "версия из будущего в состоянии — ведём себя как при неизвестной");
  assert.deepEqual(since(prev, ""), [], "без нынешней версии рассказывать нечего");

  /* Предел назван числом в одном месте, и проверка спрашивает его, а не
     повторяет: иначе она закрепила бы свою копию правила. */
  assert.ok(notes.MAX_SECTIONS >= 2 && notes.MAX_SECTIONS <= 10,
    "предел числа разделов похож на предел, а не на случайность: " + notes.MAX_SECTIONS);
  const all = notes.releaseNotesSince("0.0.1", newest);
  assert.ok(all.length <= notes.MAX_SECTIONS,
    "обновление через всю историю отдало " + all.length + " разделов при пределе "
    + notes.MAX_SECTIONS);

  /*
   * Сборка текста: один выпуск — без номера в теле (его сказал заголовок
   * окна), несколько — каждый под своим.
   */
  const one = notes.buildReleaseNotesText([{ version: "1.2.3", text: "тело" }]);
  assert.equal(one, "тело", "один раздел идёт как есть");
  const two = notes.buildReleaseNotesText([
    { version: "1.2.3", text: "новое" },
    { version: "1.2.2", text: "старое" },
  ]);
  assert.ok(two.indexOf("## 1.2.3") === 0, "первым стоит заголовок новой версии");
  assert.ok(two.indexOf("## 1.2.2") > 0, "и заголовок второй тоже есть");
  assert.equal(notes.buildReleaseNotesText([]), "", "пустой набор даёт пустой текст");
  assert.equal(notes.buildReleaseNotesText([{ version: "1.0.0", text: "" }]), "",
    "раздел без тела в текст не попадает");
  ok("пропущенные выпуски: номера те самые, предел соблюдён, текст собран");
}

{
  /*
   * **Форма самого `CHANGELOG.md`** — его замечание 2026-09-19 по окну «что
   * изменилось»: «текст с разрывами на предложениях… префикс исправлений
   * должен быть нумерацией… текста много — нужны буллиты с понятным, но
   * лаконичным описанием».
   *
   * Разрывы — не вкус: Obsidian показывает одиночный перевод строки переносом
   * (`strictLineBreaks` выключен по умолчанию), и абзац, свёрстанный по
   * восемьдесят знаков, приезжает человеку лестницей. Поэтому пункт — **одна
   * строка**, и проверка спрашивает именно это, а не длину файла.
   *
   * Предмет — разделы выпусков и `## Unreleased`: и то и другое человек
   * читает, а первое ещё и уезжает в окно.
   */
  const text = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  const lines = text.split(/\r?\n/);
  let section = "";
  const wrapped = [];
  const unnumbered = [];
  const long = [];
  let items = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = String(lines[i] || "");
    const head = line.match(/^##\s+(\S+)\s*$/);
    if (head) { section = String(head[1]); continue; }
    if (!section) continue;
    /* Продолжение пункта: строка, начинающаяся с пробелов, под пунктом. */
    if (/^\s+\S/.test(line) && items) {
      wrapped.push(section + ": «" + line.trim().slice(0, 40) + "…»");
      continue;
    }
    const item = line.match(/^(\S+)\s+(.+)$/);
    if (!item) continue;
    const prefix = String(item[1]);
    if (prefix === "-" || prefix === "*") {
      unnumbered.push(section + ": «" + String(item[2]).slice(0, 40) + "…»");
      continue;
    }
    if (!/^\d+\.$/.test(prefix)) continue;
    items++;
    if (line.length > 400) {
      long.push(section + ": пункт в " + line.length + " знаков");
    }
  }
  assert.ok(items >= 10, "нумерованных пунктов найдено " + items + " — обход ищет не то (У-200)");
  assert.deepEqual(wrapped, [],
    "пункт разорван переносом строки — в Obsidian человек увидит лестницу:\n  "
    + wrapped.join("\n  "));
  assert.deepEqual(unnumbered, [],
    "пункт без номера — по его слову «префикс исправлений должен быть нумерацией»:\n  "
    + unnumbered.join("\n  "));
  assert.deepEqual(long, [],
    "пункт длиннее четырёхсот знаков — это уже не лаконично:\n  " + long.join("\n  "));
  ok("CHANGELOG.md: " + items + " нумерованных пунктов, ни одного разрыва и ни одного длинного");
}

{
  /*
   * **Водитель шва пишется вместе с починкой** (У-203, правило 124). Решение
   * `planReleaseNotes` чистое и проверено выше, но зовёт его загрузка плагина,
   * и до неё из набора не дотянуться ничем. Поэтому сам шов исполняется здесь:
   * поддельны ровно два чужих предмета — окно Obsidian и хранилище, — а всё
   * остальное настоящее.
   */
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const version = String(manifest.version || "").trim();

  function makePlugin(shownFor) {
    const cfg = { viewState: shownFor ? { releaseNotesShownFor: shownFor } : {} };
    const patches = [];
    return {
      app: { workspace: {} },
      getConfig: () => cfg,
      store: {
        patch: async (patch, reason, opts) => {
          patches.push({ patch, reason, opts });
          const v = patch && patch.viewState ? patch.viewState.releaseNotesShownFor : "";
          cfg.viewState = Object.assign({}, cfg.viewState, { releaseNotesShownFor: v });
        },
      },
      patches,
    };
  }
  const opened = [];
  class FakeModal {
    constructor(app) { this.app = app; this.titleEl = { setText() {} }; }
    open() { opened.push(this); if (typeof this.onOpen === "function") this.onOpen(); }
    close() {}
  }
  /*
   * Подделка узлов: окно строит их вызовами Obsidian, и без них шов упал бы не
   * на своём предмете.
   *
   * **Она запоминает, что ей отдали** — подпись, свойства, детей. Первая
   * версия молчала обо всём, кроме факта открытия, и ссылка на полный рассказо
   * (его слово 2026-09-19) прошла бы мимо неё незаметно: подделка не бывает
   * добрее браузера (У-45).
   */
  const made = [];
  const node = (tag) => {
    const self = {
      tag: String(tag || ""),
      text: "",
      attrs: {},
      kids: [],
      setText(t) { self.text = String(t); },
      setAttribute(name, value) { self.attrs[String(name)] = String(value); },
      createEl(t, o) {
        const kid = node(t);
        if (o && o.text) kid.text = String(o.text);
        if (o && o.cls) kid.attrs.class = String(o.cls);
        self.kids.push(kid);
        made.push(kid);
        return kid;
      },
      createDiv(o) { return self.createEl("div", o); },
      classList: { add() {} },
      addEventListener() {},
      empty() { self.kids = []; },
    };
    return self;
  };
  FakeModal.prototype.contentEl = node("div");

  /*
   * Разборщик markdown — предмет пункта 8 его листа. Подделка считает не имя
   * вызова, а то, что ему отдали: текст раздела и живой компонент. И у
   * компонента спрашивается выгрузка: окно, оставившее его загруженным, течёт.
   */
  const rendered = [];
  class FakeComponent {
    constructor() { this.loaded = false; this.unloaded = 0; }
    load() { this.loaded = true; }
    unload() { this.loaded = false; this.unloaded += 1; }
  }
  const FakeRenderer = {
    render(app, markdown, elNode, sourcePath, component) {
      rendered.push({ app, markdown, elNode, sourcePath, component });
      return Promise.resolve();
    },
  };
  const uiParts = { Component: FakeComponent, MarkdownRenderer: FakeRenderer };

  (async () => {
    const first = makePlugin("");
    const planFirst = await notes.showReleaseNotesOnUpdate(first,
      Object.assign({ version, Modal: FakeModal }, uiParts));
    assert.equal(planFirst.decision, "show", "первый запуск после обновления открывает окно");
    assert.equal(opened.length, 1, "окно открылось ровно один раз");
    assert.equal(first.patches.length, 1, "версия запомнена");
    assert.equal(first.patches[0].opts.undoable, false,
      "запись состояния не идёт в отмену: это не выбор человека");

    /* Разметку разбирает платформа, а не мы: раздел уехал в `render` целиком,
       и компонент под ним был загружен. */
    assert.equal(rendered.length, 1, "раздел отдан разборщику markdown платформы");
    assert.equal(rendered[0].markdown, planFirst.text,
      "разборщику отдан тот самый раздел, а не его часть");
    assert.equal(rendered[0].component.loaded, true,
      "компонент, которым живёт разбор, загружен");
    /*
     * **Ссылка на полный рассказ** — его слово 2026-09-19. Спрашивается сам
     * узел и его адрес, а не то, что в окне вообще что-то нарисовано: адрес
     * ведёт человека наружу, и опечатка в нём не отличима от отсутствия.
     */
    const links = made.filter((n) => n.tag === "a");
    assert.equal(links.length, 1, "в окне ровно одна ссылка");
    assert.equal(links[0].attrs.href, notes.CHANGELOG_URL,
      "ссылка ведёт на тот же адрес, который знает кнопка панели");
    assert.ok(/changelog/i.test(links[0].text),
      "и подписана так, что понятно, куда она ведёт: «" + links[0].text + "»");

    opened[0].onClose();
    assert.equal(rendered[0].component.unloaded, 1,
      "и выгружен при закрытии окна: иначе окно течёт");
    ok("окно `what changed`: markdown разбирает платформа, компонент выгружается, ссылка на месте");

    /* Отрицательный контроль: платформы без разборщика. Раздел показывается как
       написан, и молчать об этом нельзя. */
    const loud = [];
    const realError = console.error;
    console.error = (...a) => { loud.push(a.map(String).join(" ")); };
    try {
      const bare = makePlugin("");
      await notes.showReleaseNotesOnUpdate(bare, { version, Modal: FakeModal });
    } finally {
      console.error = realError;
    }
    assert.equal(rendered.length, 1, "без разборщика платформы его никто не звал");
    assert.equal(loud.length, 1, "и об этом сказано в журнал разработчика");
    assert.ok(/MarkdownRenderer/.test(loud[0]), "в журнале названо, чего не хватило");
    ok("без разборщика платформы окно показывает раздел как написан и говорит об этом");

    const again = await notes.showReleaseNotesOnUpdate(first,
      Object.assign({ version, Modal: FakeModal }, uiParts));
    assert.equal(again.decision, "done", "второй запуск на той же версии окна не открывает");
    assert.equal(opened.length, 2, "и окно открылось только у отрицательного контроля");
    assert.equal(first.patches.length, 1, "и лишней записи тоже");

    const fresh = makePlugin("");
    const planFresh = await notes.showReleaseNotesOnUpdate(fresh, Object.assign(
      { version, Modal: FakeModal, freshInstall: true }, uiParts));
    assert.equal(planFresh.decision, "remember", "на свежей установке окна нет");
    assert.equal(opened.length, 2, "и окно не открывалось");
    assert.equal(fresh.patches.length, 1, "а версия всё равно запомнена");
    ok("шов загрузки: окно открывается один раз на версию и записывает состояние");

    console.log("\n" + (passed) + " проверок пройдено");
  })().catch((e) => {
    console.error(String((e && e.stack) || e));
    process.exit(1);
  });
}
