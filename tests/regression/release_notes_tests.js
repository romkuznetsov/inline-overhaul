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
const gen = require(path.join(root, "build", "gen_release_notes.js"));

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
  /* Подделка узлов: окно строит их вызовами Obsidian, и без них шов упал бы не
     на своём предмете. Считается только то, что окно открылось. */
  const node = () => ({
    setText() {},
    createEl() { return node(); },
    createDiv() { return node(); },
    classList: { add() {} },
    addEventListener() {},
    empty() {},
  });
  FakeModal.prototype.contentEl = node();

  (async () => {
    const first = makePlugin("");
    const planFirst = await notes.showReleaseNotesOnUpdate(first, { version, Modal: FakeModal });
    assert.equal(planFirst.decision, "show", "первый запуск после обновления открывает окно");
    assert.equal(opened.length, 1, "окно открылось ровно один раз");
    assert.equal(first.patches.length, 1, "версия запомнена");
    assert.equal(first.patches[0].opts.undoable, false,
      "запись состояния не идёт в отмену: это не выбор человека");

    const again = await notes.showReleaseNotesOnUpdate(first, { version, Modal: FakeModal });
    assert.equal(again.decision, "done", "второй запуск на той же версии окна не открывает");
    assert.equal(opened.length, 1, "и окна больше не появилось");
    assert.equal(first.patches.length, 1, "и лишней записи тоже");

    const fresh = makePlugin("");
    const planFresh = await notes.showReleaseNotesOnUpdate(fresh, {
      version, Modal: FakeModal, freshInstall: true,
    });
    assert.equal(planFresh.decision, "remember", "на свежей установке окна нет");
    assert.equal(opened.length, 1, "и окно не открывалось");
    assert.equal(fresh.patches.length, 1, "а версия всё равно запомнена");
    ok("шов загрузки: окно открывается один раз на версию и записывает состояние");

    console.log("\n" + (passed) + " проверок пройдено");
  })().catch((e) => {
    console.error(String((e && e.stack) || e));
    process.exit(1);
  });
}
