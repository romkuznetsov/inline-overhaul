"use strict";

/**
 * Ссылки и картинки в документах, которые читает человек снаружи.
 *
 * **Зачем проверка.** Битая относительная ссылка на GitHub не сообщает о себе:
 * ведёт в 404, а битый якорь молча открывает начало файла. Заметить это может
 * только человек, и заметит он это уже после того, как пришёл по ссылке из
 * README. 2026-09-20 из README уехал раздел с шестнадцатью якорями, появились
 * `docs/TUTORIAL.md` и `docs/SETTINGS.md` со своими ссылками, и число адресов,
 * которые некому спросить, выросло втрое.
 *
 * Спрашивается три вещи:
 *
 *   1. **Цель относительной ссылки существует** — файл или папка на диске.
 *   2. **Якорь внутри репозитория ведёт к заголовку**, собранному по правилу
 *      GitHub: в нижний регистр, пунктуация выброшена, пробелы в дефисы.
 *   3. **Картинка существует** — у гифки в README цена ошибки та же.
 *
 * Чего проверка **не** делает: не ходит в сеть. Внешний адрес проверяется
 * глазами один раз, а прогон, зависящий от сети, краснеет от чужого простоя.
 *
 * **Сюда же переехала сверка якорей `SHOWCASE.md`** — она стояла в
 * `docs_terms_tests.ts` отдельным блоком и спрашивала один README. Предмет у
 * неё тот же, что здесь, и два объявления одного правила расходятся молча
 * (У-32): там остался указатель, здесь — сама проверка.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const docs = require("../harness/user_docs.js");

const root = docs.root;

let passed = 0;
function ok(label) { passed++; console.log("  ok " + label); }

/* Список один на весь набор — `tests/harness/user_docs.js`. */
const USER_DOCS = docs.USER_DOCS;

/** Якорь GitHub: нижний регистр, пунктуация выброшена, пробелы в дефисы. */
function anchorOf(title) {
  /* Пробелы меняются по одному, а не группой: `Install & setup` даёт
     `install--setup` — знак выброшен, а оба пробела вокруг него остались.
     Это самая частая поломка ссылки, написанной руками. */
  return String(title).toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s/g, "-");
}

/** Заголовки файла как множество якорей. Пусто — значит файла нет или он не markdown. */
const anchorCache = new Map();
function anchorsOf(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  let out = new Set();
  const full = path.join(root, file);
  if (/\.md$/i.test(file) && fs.existsSync(full)) {
    const text = fs.readFileSync(full, "utf8");
    for (const h of text.match(/^#{1,6}\s+.*$/gm) || []) {
      out.add(anchorOf(h.replace(/^#+\s+/, "").trim()));
    }
  }
  anchorCache.set(file, out);
  return out;
}

/**
 * Все ссылки и картинки документа: `[текст](цель)` и `<img src="цель">`.
 *
 * Обход — объявление правила, и у него есть контроль на образце ниже
 * (правило 51, У-119). Ссылки внутри забора кода не выбрасываются нарочно:
 * пример с настоящим адресом в заборе — такой же адрес, по которому человек
 * пойдёт, скопировав строку.
 */
function linksOf(text) {
  const out = [];
  for (const m of String(text).matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    out.push(String(m[1]));
  }
  for (const m of String(text).matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) out.push(String(m[1]));
  for (const m of String(text).matchAll(/<source\b[^>]*\bsrcset="([^"]+)"/g)) out.push(String(m[1]));
  return out;
}

/* ---- контроль обхода до первого вывода ---------------------------------- */

{
  const sample = [
    "[текст](FEATURES.md)",
    "![гиф](docs/media/showcase/pkm-cycle.gif)",
    '<img src="docs/brand/io-wordmark-light.svg" width="560" alt="знак">',
    '<source media="(prefers-color-scheme: dark)" srcset="docs/brand/io-wordmark-dark.svg">',
    "[внешняя](https://obsidian.md)",
    "[якорь](docs/SHOWCASE.md#header-jumps)",
  ].join("\n");
  const found = linksOf(sample);
  assert.equal(found.length, 6, "обход нашёл " + found.length + " адресов из шести");
  assert.ok(found.includes("docs/brand/io-wordmark-dark.svg"),
    "обход не видит тёмную версию знака в `<source>`");
  assert.ok(!linksOf("просто текст без адресов").length,
    "обход находит адреса там, где их нет");
  ok("обход адресов находит markdown, `<img>` и `<source>` и не выдумывает лишнего");
}

/* ---- сами документы ------------------------------------------------------ */

{
  const broken = [];
  let checked = 0;

  for (const doc of USER_DOCS) {
    const full = path.join(root, doc);
    assert.ok(fs.existsSync(full), "документа нет на месте: " + doc);
    const text = fs.readFileSync(full, "utf8");
    assert.ok(text.length > 500, "положительный контроль: документ прочитан пустым: " + doc);
    const dir = path.posix.dirname(doc.split(path.sep).join("/"));

    for (const raw of linksOf(text)) {
      /* Внешнее, почта и ссылка на якорь в самом документе. */
      if (/^(https?:|mailto:|#)/.test(raw)) {
        if (raw.startsWith("#")) {
          checked++;
          if (!anchorsOf(doc).has(raw.slice(1))) broken.push(doc + " → " + raw + " (свой якорь)");
        }
        continue;
      }
      checked++;
      const [target, anchor] = raw.split("#");
      const rel = path.posix.normalize(dir === "." ? target : dir + "/" + target);
      if (!fs.existsSync(path.join(root, rel))) {
        broken.push(doc + " → " + raw + " (нет файла " + rel + ")");
        continue;
      }
      if (anchor && !anchorsOf(rel).has(anchor)) {
        broken.push(doc + " → " + raw + " (нет заголовка в " + rel + ")");
      }
    }
  }

  /*
   * Порог на **той стороне, которая спрашивает** (У-88): пустой список адресов
   * делает «битых нет» правдой, которую никто не проверял.
   */
  assert.ok(checked >= 40,
    "положительный контроль: адресов внутри репозитория найдено " + checked + " — сверять нечего");

  assert.deepEqual(broken, [],
    "битый адрес в документе, который читает человек — на GitHub он ведёт в 404,\n"
    + "а битый якорь молча открывает начало файла:\n  " + broken.join("\n  "));
  ok("каждый адрес внутри репозитория ведёт к существующему файлу и заголовку ("
    + checked + " адресов в " + USER_DOCS.length + " документах)");
}

/* ---- запрет обязан краснеть --------------------------------------------- */

{
  /*
   * Отрицательные контроли на образце, а не на долге в самих документах
   * (правило 51): такой контроль умирает вместе с долгом.
   */
  assert.ok(!fs.existsSync(path.join(root, "docs", "net-takogo-fayla.md")),
    "контроль: выдуманный файл внезапно существует");
  assert.ok(!anchorsOf("docs/SHOWCASE.md").has("zagolovka-takogo-net"),
    "контроль: выдуманный якорь считается живым");
  assert.ok(anchorsOf("docs/SHOWCASE.md").has("header-jumps"),
    "контроль: настоящий якорь showcase не найден — разбор заголовков сломан");
  assert.ok(anchorsOf("docs/SHOWCASE.md").size >= 10,
    "контроль: заголовков в showcase найдено " + anchorsOf("docs/SHOWCASE.md").size);
  assert.equal(anchorOf("Install & setup"), "install--setup",
    "правило якоря GitHub: пунктуация выброшена, пробелы в дефисы");
  assert.equal(anchorOf("Expanded 'Ctrl+A'"), "expanded-ctrla",
    "правило якоря GitHub: апостроф и плюс выброшены");
  ok("разбор якорей повторяет правило GitHub, и выдуманное живым не считается");
}

/* ---- имя документа для человека — капсом ------------------------------- */

{
  /**
   * **Его слово 2026-09-20:** «мне не нравится, что все заметки для чтения
   * пользователем написаны капсом (README.md), а instructions.md — маленькими
   * буквами; хочу, чтобы был общий стиль с правилом "если этот файл для чтения
   * человеком, то название должно быть капсом"».
   *
   * Спрашивается **свойство имени**, а не список файлов (правило 151): список
   * пропустил бы ровно то место, где предмет не назван, — новый документ,
   * который забыли в него вписать. Поэтому обход идёт по корню и по `docs/`, а
   * всё, что человеку не показывается, названо в `user_docs.js` поимённо и с
   * причиной.
   */
  const files = docs.userMarkdownFiles();
  assert.ok(files.length >= 8,
    "положительный контроль: заметок для человека найдено " + files.length
    + " — обход смотрит не туда");

  /* Контроль признака до первого вывода: он обязан различать обе стороны. */
  assert.ok(docs.isShoutingName("README.md"), "контроль: признак не узнаёт README.md");
  assert.ok(docs.isShoutingName("docs/COMMAND_IDS_V1_V2.md"),
    "контроль: признак не узнаёт имя с цифрами и подчёркиваниями");
  assert.ok(!docs.isShoutingName("instructions.md"),
    "контроль: признак пропускает строчное имя");
  assert.ok(!docs.isShoutingName("docs/Tutorial.md"),
    "контроль: признак пропускает имя с одной заглавной");

  const lower = files.filter((f) => !docs.isShoutingName(f));
  assert.deepEqual(lower, [],
    "заметку для человека зовут не капсом — его правило 2026-09-20:\n  " + lower.join("\n  "));
  ok("имя каждой заметки для человека написано капсом (" + files.length + " файлов)");
}

console.log("\n" + passed + " проверок пройдено");
