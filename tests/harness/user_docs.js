"use strict";

/**
 * Документы, которые читает человек снаружи — **один список на весь набор**.
 *
 * Он стоял в двух проверках копиями (`docs_terms_tests.ts` и
 * `docs_links_tests.js`), и это ровно то второе объявление одного правила,
 * которое расходится молча (У-32): завели новый документ, вписали в одну из
 * двух — и вторая о нём не знает, оставаясь зелёной.
 *
 * **Правило имени — его слово 2026-09-20:** «если этот файл для чтения
 * человеком, то название должно быть капсом». Поэтому здесь же живёт признак
 * `isShoutingName`, и сторож на него — в `docs_links_tests.js`.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");

/**
 * Три документа плагина. К ним — и только к ним — предъявляются требования
 * «каждая команда названа» и «названа требуемая версия Obsidian»: лист
 * возможностей и руководства отвечают на «что он умеет» и «как его поставить»,
 * а учебник и справочник панели — нет.
 */
const PLUGIN_DOCS = ["README.md", "INSTRUCTIONS.md", "FEATURES.md"];

/**
 * Всё, что человек читает снаружи. Запреты терминологии и сверка адресов
 * действуют на весь список: снятое имя контрола посылает его в пустоту из
 * справочника ровно так же, как из README.
 *
 * `docs/SHOWCASE.md` в запреты терминологии не входит (его текст — материал
 * заказчика, и отчёт о снятых записях намеренно называет старые имена), но
 * адреса и имя у него спрашиваются наравне со всеми.
 */
const USER_DOCS = PLUGIN_DOCS.concat([
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/TUTORIAL.md",
  "docs/SETTINGS.md",
  "docs/SHOWCASE.md",
  "docs/COMMAND_IDS_V1_V2.md",
]);

/** Те же, на которые действуют запреты терминологии 7.3 и снятых контролов. */
const TERM_DOCS = PLUGIN_DOCS.concat(["docs/SETTINGS.md", "docs/TUTORIAL.md"]);

/**
 * Признак имени: **буквы заглавные**. Цифры, `_`, `-` и `.` разрешены, строчных
 * букв быть не должно — ни в имени, ни в расширении не считая самого `.md`.
 *
 * Спрашивается **свойство**, а не список имён (правило 151): иначе новый
 * документ в строчных буквах пройдёт мимо, потому что его в список не вписали.
 */
function isShoutingName(name) {
  const base = path.basename(String(name), ".md");
  return /^[A-Z0-9][A-Z0-9_.-]*$/.test(base);
}

/**
 * Все `.md`, которые видит человек, открыв репозиторий: корень и `docs/` без
 * папок с рабочими документами, медиа, прототипом и знаком.
 *
 * `docs/dev/**` исключён нарочно — это то, что читаю я, и правило заказчика
 * на него не распространяется. `docs/brand/README.md` уже отвечает правилу и
 * лежит в папке с картинками, а не с заметками.
 */
const NOT_FOR_PEOPLE = new Set(["dev", "media", "prototype", "brand"]);

/**
 * Исключение ровно одно, и у него есть причина: `read_map.md` собирается
 * инструментом (`node tools/read_map_v1.js`), под контролем версий не лежит и
 * человеку не показывается. Появится второе — впишут сюда вместе с причиной.
 */
const NOT_A_NOTE = new Set(["read_map.md"]);

function userMarkdownFiles() {
  const out = [];
  for (const name of fs.readdirSync(root)) {
    if (!/\.md$/i.test(name) || NOT_A_NOTE.has(name)) continue;
    if (fs.statSync(path.join(root, name)).isFile()) out.push(name);
  }
  const docs = path.join(root, "docs");
  for (const name of fs.readdirSync(docs)) {
    if (NOT_FOR_PEOPLE.has(name)) continue;
    if (!/\.md$/i.test(name)) continue;
    out.push("docs/" + name);
  }
  return out.sort();
}

module.exports = { root, PLUGIN_DOCS, USER_DOCS, TERM_DOCS, isShoutingName, userMarkdownFiles };
