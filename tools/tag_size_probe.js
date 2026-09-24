"use strict";

/**
 * Стенд «какого размера тег»: **наш пузырь рядом с тегом самой Obsidian**.
 *
 *     node tools/tag_size_probe.js
 *     node tools/tag_size_probe.js --base 20
 *     node tools/tag_size_probe.js --theme "<путь к theme.css>" --base 20
 *
 * **Зачем он есть.** Его замечание 2026-09-21, вечер: «в режиме редактирования
 * тег визуально больше; хочу, чтобы при дефолтных значениях размер тегов в
 * режиме редактирования был такой же, как в режиме просмотра». Режим просмотра
 * рисует не плагин, а Obsidian с его темой, и сравнить два вида можно только
 * поставив их рядом на одной странице (У-227: вид, который мы не объявили,
 * объявляет тема).
 *
 * **Что здесь настоящее.** `app.css` из `obsidian-<версия>.asar` этой машины,
 * `theme.css` темы из его vault и `src/styles.css` плагина — три листа, ни
 * одной переменной руками. Страница задаёт ровно одно: кегль строки редактора.
 *
 * **Что сравнивается.** Пять предметов на одной строке:
 *
 *   * `word` — обычное слово строки, опора для отношений;
 *   * `read` — `a.tag`, как тег рисует **режим просмотра**;
 *   * `lp` — `span.cm-hashtag`, как тег рисует **Live Preview** там, где
 *     плагин не вмешивается;
 *   * `line` — наш пузырь, если кегль брать у строки (так было до 2026-09-21);
 *   * `tag` — наш пузырь, если кегль брать у платформы (`--tag-size`); **так
 *     он рисуется сейчас**, его словом «как в просмотре».
 *
 * **Имена строк называют модель, а не продукт.** Стенд не зовёт код плагина —
 * он одевает узел руками, — и потому подпись «так сейчас» в нём стареет молча
 * (У-246). Что до пузыря и правда доезжает, спрашивает браузерный шаг:
 * `npm run gate:browser`, подмена `bubble-takes-line-size`.
 *
 * **Контроль стоит до первого вывода** (правило 44): если `--tag-size` темы не
 * прочиталось или `read` и `word` вышли одного кегля, стенд падает громко —
 * такая страница отвечала бы «расхождения нет» от того, что сравнивать нечем.
 *
 * **Чего стенд не заменяет.** Он читает `app.css` **этой** машины и тему из
 * указанного vault: другая версия или другая тема — другой ответ. Это не
 * слабость, а его предмет.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VAULT = path.resolve(ROOT, "..", "test-vault");

function arg(name, fallback) {
  const at = process.argv.indexOf(name);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}

/** Где лежит сборка Obsidian этой машины — то же правило, что у `renumber_bench`. */
function findAsar(explicit) {
  if (explicit) return explicit;
  const dir = path.join(os.homedir(), "AppData", "Roaming", "obsidian");
  const names = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((n) => /^obsidian-.*\.asar$/.test(n)).sort()
    : [];
  if (!names.length) {
    console.error("не нашёл obsidian-<версия>.asar рядом с настройками Obsidian.");
    console.error("укажите путь: node tools/tag_size_probe.js --asar <путь>");
    process.exit(2);
  }
  return path.join(dir, names[names.length - 1]);
}

/** Один файл из архива сборки по имени. */
function readFromAsar(asar, wanted) {
  const buf = fs.readFileSync(asar);
  const header = JSON.parse(buf.slice(16, 16 + buf.readUInt32LE(12)).toString("utf8"));
  const base = 8 + buf.readUInt32LE(4);
  let found = null;
  const walk = (node) => {
    for (const [name, entry] of Object.entries(node.files || {})) {
      if (entry.files) { walk(entry); continue; }
      if (name === wanted && !found) {
        const off = base + Number(entry.offset);
        found = buf.slice(off, off + entry.size).toString("utf8");
      }
    }
  };
  walk(header);
  if (!found) throw new Error("в архиве нет " + wanted + ": " + asar);
  return found;
}

/** Тема из vault: та, что выбрана в `appearance.json`. */
function findTheme(explicit) {
  if (explicit) return explicit;
  const appearance = path.join(VAULT, ".obsidian", "appearance.json");
  if (!fs.existsSync(appearance)) return "";
  const name = String(JSON.parse(fs.readFileSync(appearance, "utf8")).cssTheme || "").trim();
  if (!name) return "";
  const file = path.join(VAULT, ".obsidian", "themes", name, "theme.css");
  return fs.existsSync(file) ? file : "";
}

function buildHtml(appCss, themeCss, pluginCss, basePx) {
  /* Величины пузыря — те же, что ставит слой при 100 % (`computeTagVisualStyle`
     и `TagVisualTokenWidget.toDOM`). Литералами они стоят нарочно: стенд
     спрашивает «что человек увидит при умолчаниях», а не «что посчитает код». */
  return [
    "<!doctype html><meta charset=utf-8>",
    "<style>" + appCss + "</style>",
    themeCss ? "<style>" + themeCss + "</style>" : "",
    "<style>" + pluginCss + "</style>",
    "<style>",
    "  body { margin: 0; background: var(--background-primary, #fff); }",
    "  .markdown-source-view.mod-cm6 { width: 700px; }",
    "  .cm-editor, .cm-content, .cm-line { font-size: " + basePx + "px; font-family: sans-serif; }",
    "  .cm-line { line-height: 1.7; }",
    "  .probe { display: block; padding: 8px 12px; }",
    "</style>",
    "<body class='theme-light mod-windows'>",
    "<div class='markdown-source-view mod-cm6'><div class='cm-editor'><div class='cm-content'>",
    "<div class='cm-line probe'>",
    "  <span id='word'>test2</span>",
    "  <a class='tag' id='read' href='#'>#work</a>",
    "  <span class='cm-hashtag cm-hashtag-begin cm-hashtag-end' id='lp'>#work</span>",
    "  <span class='io-tagbubble io-tagbubble--theme io-tagbubble--clickable' id='line'>#work</span>",
    "  <span class='io-tagbubble io-tagbubble--theme io-tagbubble--clickable' id='tag'>#work</span>",
    "</div></div></div></div>",
    "<script>",
    "  function dress(el, font) {",
    "    el.style.setProperty('--io-tagbubble-radius', '16px');",
    "    el.style.setProperty('--io-tagbubble-pad-y', '3px');",
    "    el.style.setProperty('--io-tagbubble-pad-x', '6px');",
    "    el.style.setProperty('--io-tagbubble-font', font);",
    "    el.style.setProperty('--io-tagbubble-rise', '0px');",
    "    el.style.setProperty('--io-tagbubble-line', '1.2');",
    "  }",
    "  dress(document.getElementById('line'), '" + basePx + "px');",
    "  dress(document.getElementById('tag'), 'var(--tag-size, 0.875em)');",
    "</script>",
  ].join("\n");
}

async function main() {
  const asar = findAsar(arg("--asar", ""));
  const themeFile = findTheme(arg("--theme", ""));
  const basePx = Number(arg("--base", "16")) || 16;
  const appCss = readFromAsar(asar, "app.css");
  const themeCss = themeFile ? fs.readFileSync(themeFile, "utf8") : "";
  const pluginCss = fs.readFileSync(path.join(ROOT, "src", "styles.css"), "utf8");

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "io-tagsize-"));
  const page = path.join(outDir, "probe.html");
  fs.writeFileSync(page, buildHtml(appCss, themeCss, pluginCss, basePx));

  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch (_ePlaywright) {
    console.error("нет playwright — поставьте: npm i -D playwright && npx playwright install chromium");
    process.exit(2);
  }
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage();
    await p.goto("file:///" + page.replace(/\\/g, "/"));
    const out = await p.evaluate(() => {
      const res = {};
      for (const id of ["word", "read", "lp", "line", "tag"]) {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        res[id] = {
          font: parseFloat(cs.fontSize),
          w: Math.round(r.width * 100) / 100,
          h: Math.round(r.height * 100) / 100,
          bg: cs.backgroundColor,
          border: cs.borderTopWidth,
        };
      }
      res.tagSizeVar = getComputedStyle(document.querySelector(".cm-line"))
        .getPropertyValue("--tag-size").trim();
      return res;
    });

    /* Контроль до первого вывода (правило 44): страница обязана нести предмет. */
    if (!out.tagSizeVar) {
      throw new Error("тема не объявила `--tag-size` — сравнивать нечего, и «расхождения нет» здесь ничего не значит");
    }
    if (out.read.font === out.word.font) {
      throw new Error("тег режима просмотра и обычное слово одного кегля — вопрос заказчика на такой странице не ставится вовсе");
    }

    console.log("сборка: " + path.basename(asar)
      + (themeFile ? ";  тема: " + path.basename(path.dirname(themeFile)) : ";  темы нет")
      + ";  кегль строки: " + basePx + "px;  --tag-size: " + out.tagSizeVar);
    for (const id of ["word", "read", "lp", "line", "tag"]) {
      const v = out[id];
      console.log("  " + id.padEnd(5)
        + " кегль " + String(v.font).padStart(7)
        + "  ящик " + String(v.w).padStart(7) + " × " + String(v.h).padEnd(7)
        + "  фон " + v.bg.padEnd(22) + " рамка " + v.border);
    }
    const r = (a, b) => Math.round((a / b) * 1000) / 1000;
    console.log("отношения к тегу режима просмотра: кегль у строки — ×"
      + r(out.line.font, out.read.font) + ", высота ×" + r(out.line.h, out.read.h)
      + ";  кегль у платформы (так сейчас) — ×" + r(out.tag.font, out.read.font)
      + ", высота ×" + r(out.tag.h, out.read.h));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(1);
});
