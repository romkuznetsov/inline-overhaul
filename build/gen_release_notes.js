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

module.exports = { parseChangelogSections, writeReleaseNotes, OUT_DIR, OUT_NAME };

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const done = writeReleaseNotes(root);
  console.log("заметки выпуска собраны: разделов " + done.count + ", нынешний — " + done.version);
}
