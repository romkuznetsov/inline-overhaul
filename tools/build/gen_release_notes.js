"use strict";

/**
 * Разделы `CHANGELOG.md` — в сборку, одним файлом.
 *
 * **Зачем.** Заказчик 2026-09-16: «хочу, чтобы при обновлении версии плагина в
 * obsidian появлялся changelog, где лаконично объясняется что изменилось».
 * Текст у этого окна один — тот, что уже написан в `CHANGELOG.md`, и второго
 * дома ему заводить нельзя (У-32): разойдутся они в первый же выпуск, и
 * человек прочтёт не то, что уехало в релиз.
 *
 * **Почему генерируется, а не читается на ходу.** В релизе три файла —
 * `manifest.json`, `main.js`, `styles.css`, — и `CHANGELOG.md` среди них нет:
 * у человека на диске его просто не существует. Значит, текст обязан приехать
 * **внутри** сборки, и единственное место, где это можно сделать, не заводя
 * второго дома, — шаг сборки.
 *
 * **Почему JSON, а не модуль.** Сплошные обходы набора читают `.js` и `.ts`
 * всего репозитория и спрашивают у каждого файла форму: узкое написание
 * чекбокса, литералы настроек, мёртвые экспорты. Сгенерированный модуль с
 * чужим текстом внутри отвечал бы на эти вопросы как код, которым он не
 * является. JSON они не читают, а `require` его разрешает и есбилд вкладывает
 * в бандл литералом.
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join("src", "generated");
const OUT_NAME = "release_notes.json";

/**
 * Разобрать `CHANGELOG.md` на разделы версий.
 *
 * Заголовок раздела — `## <версия>`; `## Unreleased` разделом версии не
 * является и в сборку не едет: у него нет номера, с которым его можно было бы
 * сравнить, а показывать «ещё не выпущенное» человеку нечестно.
 */
function parseChangelogSections(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = {};
  let current = "";
  let buf = [];
  const flush = () => {
    if (!current) return;
    const body = buf.join("\n").replace(/^\s+|\s+$/g, "");
    if (body) out[current] = body;
  };
  for (const line of lines) {
    const m = line.match(/^##\s+(\S+)\s*$/);
    if (m) {
      flush();
      const name = String(m[1] || "").trim();
      current = /^\d/.test(name) ? name : "";
      buf = [];
      continue;
    }
    if (current) buf.push(line);
  }
  flush();
  return out;
}

/**
 * Знаки рода пункта — его слово 2026-09-20: «не хватает эмодзи в тексте (в
 * начале пунктов, чтобы дать яркое представление о том, что это (новая
 * функция, исправление бага, улучшение визуала и т.д.)».
 *
 * Дом у списка один, и он здесь: сводку по знакам собирает этот файл, а
 * сторож `release_notes_tests.js` читает список отсюда же. Вторая копия
 * разошлась бы молча (У-32).
 */
const CHANGE_MARKS = ["✨", "🐛", "🎨", "🚀", "🔧"];

/** Как род называется в сводке: один и много. */
const MARK_WORDS = {
  "🐛": ["bug fix", "bug fixes"],
  "🎨": ["change you can see", "changes you can see"],
  "✨": ["new thing", "new things"],
  "🚀": ["speed-up", "speed-ups"],
  "🔧": ["internal change", "internal changes"],
};

/** Порядок в сводке — его порядок слов: починки, потом вид, потом новое. */
const SUMMARY_ORDER = ["🐛", "🎨", "✨", "🚀", "🔧"];

/** Пункты раздела: номер, знак рода и текст. */
function sectionItems(body) {
  const out = [];
  for (const line of String(body || "").split(/\r?\n/)) {
    const m = line.match(/^\d+\.\s+(\S+)\s+(.+)$/);
    if (!m) continue;
    const mark = String(m[1]);
    if (CHANGE_MARKS.indexOf(mark) < 0) continue;
    out.push({ mark, text: String(m[2]) });
  }
  return out;
}

/** Заголовок пункта — то, что в нём выделено полужирным. */
function headlineOf(text) {
  const src = String(text || "");
  const m = src.match(/^\*\*(.+?)\*\*/);
  const head = m ? String(m[1]) : String(src.split(". ")[0] || src);
  return head.replace(/[\s.:,;]+$/, "");
}

/**
 * Сводка выпуска — коллаут под его заголовком.
 *
 * **Его слово 2026-09-22:** «в changelog мне не нравится как сделан коллаут —
 * куча склеенного текста. Нужно сделать более общее overview того, что
 * сделано, и сделать это более читаемым — буллиты, полужирный шрифт у ключевых
 * слов, суммаризировать инфу (исправлено Х багов, сделано У улучшений
 * интерфейса настроек, добавлены следующие возможности (список с буллитами))».
 *
 * **Числа считаются, а не пишутся.** Сводка выводится из пунктов **того же
 * раздела**: фраза о состоянии, набранная руками, становится ложной в день,
 * когда пункт дописали, и молчит об этом (У-246). Здесь у утверждения и его
 * предмета один дом, и разойтись им не на чем.
 *
 * Пусто значит «пунктов нет» — сводить нечего.
 */
function buildSummary(body) {
  const items = sectionItems(body);
  if (!items.length) return "";
  const counts = {};
  for (const it of items) counts[it.mark] = (counts[it.mark] || 0) + 1;
  const parts = [];
  for (const mark of SUMMARY_ORDER) {
    const n = counts[mark] || 0;
    if (!n) continue;
    const words = MARK_WORDS[mark];
    parts.push(mark + " **" + n + "** " + (n === 1 ? words[0] : words[1]));
  }
  const lines = ["> [!NOTE]", "> " + parts.join(" · ")];
  const fresh = items.filter((it) => it.mark === "✨");
  if (fresh.length) {
    lines.push(">", "> **New in this release**");
    for (const it of fresh) lines.push("> - **" + headlineOf(it.text) + "**");
  }
  return lines.join("\n");
}

/**
 * Где в файле стоит сводка каждого выпуска: строка коллаута, его конец и сам
 * текст. Разбор один на всех — им пользуются и переписывание, и сторож.
 *
 * Между заголовком и сводкой стоит строка с датой выпуска (курсивом); она
 * пропускается, но спрятать отсутствие сводки не должна.
 */
function summarySpots(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const head = String(lines[i] || "").match(/^##\s+(\S+)\s*$/);
    if (!head) continue;
    const version = String(head[1]);
    if (!/^\d/.test(version)) continue;
    let at = i + 1;
    while (at < lines.length && String(lines[at]).trim() === "") at++;
    if (/^_.+_$/.test(String(lines[at] || "").trim())) {
      at++;
      while (at < lines.length && String(lines[at]).trim() === "") at++;
    }
    let end = at;
    if (String(lines[at] || "").trim() === "> [!NOTE]") {
      end = at;
      while (end < lines.length && /^>/.test(String(lines[end] || ""))) end++;
    }
    out.push({ version, at, end, text: lines.slice(at, end).join("\n") });
  }
  return out;
}

/** Разделы, чья сводка разошлась с тем, что считается по их же пунктам. */
function summaryMismatch(text) {
  const sections = parseChangelogSections(text);
  const out = [];
  for (const spot of summarySpots(text)) {
    const want = buildSummary(sections[spot.version] || "");
    if (spot.text !== want) out.push(spot.version);
  }
  return out;
}

/** Переписать сводки всех выпусков по их пунктам. */
function applySummaries(text) {
  const lines = String(text || "").split(/\r?\n/);
  const sections = parseChangelogSections(text);
  const spots = summarySpots(text);
  for (let k = spots.length - 1; k >= 0; k--) {
    const spot = spots[k];
    const want = buildSummary(sections[spot.version] || "");
    if (!want) continue;
    const block = want.split("\n");
    /* Сводки не было вовсе — за ней оставляется пустая строка. */
    const tail = spot.end === spot.at ? block.concat([""]) : block;
    lines.splice(spot.at, spot.end - spot.at, ...tail);
  }
  return lines.join("\n");
}

function writeSummaries(root) {
  const file = path.join(root, "CHANGELOG.md");
  const text = fs.readFileSync(file, "utf8");
  const next = applySummaries(text);
  if (next !== text) fs.writeFileSync(file, next, "utf8");
  return { changed: next !== text, sections: summarySpots(next).length };
}

function writeReleaseNotes(root) {
  const text = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  const sections = parseChangelogSections(text);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const version = String(manifest.version || "").trim();
  /*
   * **Отказ вслух, а не пустой файл.** Раздела своей версии в `CHANGELOG.md`
   * не может не быть — этого требует сторож выпуска (В-125), — и если его нет,
   * то сборка собирает окно, которому нечего показать. Молчание тут
   * неотличимо от дефекта.
   */
  if (!sections[version]) {
    throw new Error("gen_release_notes: в CHANGELOG.md нет раздела `## " + version
      + "` — окну «что изменилось» нечего показать");
  }
  const dir = path.join(root, OUT_DIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, OUT_NAME), JSON.stringify(sections, null, 2) + "\n", "utf8");
  return { version, count: Object.keys(sections).length };
}

module.exports = {
  parseChangelogSections,
  writeReleaseNotes,
  buildSummary,
  summarySpots,
  summaryMismatch,
  applySummaries,
  writeSummaries,
  sectionItems,
  headlineOf,
  CHANGE_MARKS,
  OUT_DIR,
  OUT_NAME,
};

if (require.main === module) {
  const root = path.resolve(__dirname, "..", "..");
  if (process.argv.indexOf("--summaries") >= 0) {
    const done = writeSummaries(root);
    console.log("сводки выпусков собраны: разделов " + done.sections
      + (done.changed ? ", файл переписан" : ", менять было нечего"));
  } else {
    const done = writeReleaseNotes(root);
    console.log("заметки выпуска собраны: разделов " + done.count + ", нынешний — " + done.version);
  }
}
