"use strict";

/**
 * Сборка и открытие страницы редактора настоящим Chromium.
 *
 * Отдельно от `harness.js` нарочно: тот открывает **прототип**, файл без
 * сборки, а здесь надо собрать страницу из `src/**` — иначе в браузер не
 * попадёт ни одного нашего модуля.
 *
 * **Подмены здесь правят исходник, а не стили.** У панели дефект жил в
 * правилах CSS, и подменить их достаточно; у слоя редактора он живёт в коде,
 * считающем прямоугольники. Поэтому подмена — замена куска текста модуля
 * **при сборке страницы**: та же мутация, которой правка проверяется в Node,
 * только доведённая до браузера. Анкер, которого нет, роняет сборку: тихо
 * пропущенная подмена — это подмена, которой нет (A15).
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
/*
 * Страница собирается **во временную папку машины**, а не в `dist/`: в `dist/`
 * лежит релиз, и там разрешены ровно три файла — это держит
 * `release_bundle_tests.js`, и держит верно. Первая версия гейта положила
 * страницу туда и уронила его.
 */
const outDir = path.join(os.tmpdir(), "inline-overhaul-editor-gate");

/**
 * Подмены: каждая возвращает слой в то состояние, из которого заказчик уже
 * приносил замечание по S7.
 *
 * `file` — путь от корня репозитория, `find` и `replace` — текст. Ровно одно
 * вхождение, иначе подмена не адресует предмет.
 */
const EDITOR_INJECTIONS = {
  /*
   * Вертикаль подложки обратно из измеренного отрезка. Ровно это и было до
   * 2026-09-09: «если в block встречается wikilink, то полоска становится
   * выше, чем в строке, в которой нет wikilink».
   */
  "vertical-measured": {
    file: "src/ui/editor/decorations.js",
    find: "      const box = geom ? blockFillPieceBox(geom, piece) : null;",
    replace: "      const box = null;",
  },
  /*
   * Рост обратно односторонний, только к разделителю: «вне зависимости от
   * tags-block-fill-width в left block полоска начинается от начала первого
   * элемента».
   */
  "growth-onesided": {
    file: "src/ui/editor/decorations.js",
    find: "      const growLeft = span.zone === \"right\" ? (first ? padX : 0) : (first ? outward : 0);\n"
      + "      const growRight = span.zone === \"left\" ? (last ? padX : 0) : (last ? outward : 0);",
    replace: "      const growLeft = span.zone === \"right\" && first ? padX : 0;\n"
      + "      const growRight = span.zone === \"left\" && last ? padX : 0;",
  },
  /* Прижим к знаку начала строки снят: подложка заезжает на чекбокс. */
  "no-prefix-clamp": {
    file: "src/ui/editor/decorations.js",
    find: "    const outward = Math.min(padX, room);",
    replace: "    const outward = padX;",
  },
  /*
   * Прижим высоты к зрительной строке снят: «после высоты в 3px полоски на
   * разных строках начинают наезжать друг на друга».
   */
  "no-row-clamp": {
    file: "src/core/editor_visuals_config.js",
    find: "  return Math.max(1, Math.min(lineH, written + grow * 2));",
    replace: "  return Math.max(1, written + grow * 2);",
  },
  /* Шкала ширины обратно без перелома на середине: разделитель в подложку не
     входит ни при каком положении ползунка. */
  "width-no-midpoint": {
    file: "src/core/editor_visuals_config.js",
    find: "  if (pct <= 50) return (nearOk * pct) / 50;",
    replace: "  return (nearOk * pct) / 100;\n  if (pct <= 50) return (nearOk * pct) / 50;",
  },
};

function requireEsbuild() {
  try {
    return require("esbuild");
  } catch (_e) {
    console.error("сборщика в наборе нет: npm i");
    process.exit(2);
  }
  return null;
}

function requirePlaywright() {
  try {
    return require("playwright");
  } catch (_e) {
    console.error("браузера в наборе нет. Поставьте его двумя командами:");
    console.error("  npm i -D playwright");
    console.error("  npx playwright install chromium");
    process.exit(2);
  }
  return null;
}

/** Плагин сборки, который правит текст модуля по имени подмены. */
function injectionPlugin(name) {
  if (!name) return null;
  if (!Object.prototype.hasOwnProperty.call(EDITOR_INJECTIONS, name)) {
    throw new Error("нет подмены с именем " + name
      + "; есть: " + Object.keys(EDITOR_INJECTIONS).join(", "));
  }
  const spec = EDITOR_INJECTIONS[name];
  const target = path.join(root, spec.file);
  return {
    name: "io-injection",
    setup(build) {
      build.onLoad({ filter: /\.js$/ }, (args) => {
        if (path.resolve(args.path) !== path.resolve(target)) return null;
        const src = fs.readFileSync(args.path, "utf8");
        const hits = src.split(spec.find).length - 1;
        if (hits !== 1) {
          throw new Error("подмена " + name + ": вхождений " + hits
            + ", а нужно ровно одно — она больше не адресует предмет");
        }
        return { contents: src.replace(spec.find, spec.replace), loader: "js" };
      });
    },
  };
}

const PAGE_CSS = [
  "html, body { margin: 0; padding: 0; background: #ffffff; }",
  /*
   * Ящик, который снаружи выглядит редактором заметки: правила плагина
   * адресуют именно эти два класса, и без них ни одно из них не применится.
   */
  ".markdown-source-view.mod-cm6 { width: 520px; }",
  /*
   * Начертание задано числами нарочно: «как у меня в Obsidian» — это
   * состояние чужой машины, а гейт обязан мерить одно и то же на любой.
   * Отношение междустрочия к кеглю взято близким к его теме (33 к 16 точкам),
   * потому что именно оно решает, сколько места у подложки над написанным.
   */
  ".cm-editor { font-size: 16px; font-family: monospace; }",
  /*
   * Междустрочие задаётся на `.cm-line`, а не на редакторе: своё правило
   * CodeMirror ставит именно туда, и с редактора оно не переопределяется —
   * первая версия этих стилей поставила `line-height` на `.cm-editor` и
   * получила прежнюю высоту строки до точки (У-110).
   */
  ".cm-content, .cm-line { line-height: 2 !important; }",
  ".cm-content { padding: 4px 8px; }",
  /*
   * ПОДДЕЛКА OBSIDIAN: строчный ящик ссылки выше ящика соседнего текста.
   * Величина обмерена по 18.png — пять точек, — и она меньше междустрочия,
   * то есть высоту самой строки ссылка не двигает. Ровно так ведёт себя
   * ссылка у заказчика: подложка стала выше, а строки остались на месте.
   */
  ".io-probe-link { font-size: 21px; }",
].join("\n");

async function buildPage(injection) {
  const esbuild = requireEsbuild();
  fs.mkdirSync(outDir, { recursive: true });
  const plugins = [];
  const p = injectionPlugin(injection);
  if (p) plugins.push(p);
  await esbuild.build({
    entryPoints: [path.join(__dirname, "editor_page.js")],
    bundle: true,
    format: "iife",
    outfile: path.join(outDir, "editor_page.bundle.js"),
    platform: "browser",
    absWorkingDir: root,
    logLevel: "silent",
    plugins,
  });
  const html = [
    "<!doctype html><meta charset=utf-8>",
    "<style>", PAGE_CSS, "</style>",
    "<div class='markdown-source-view mod-cm6'><div id=host></div></div>",
    "<script src='editor_page.bundle.js'></script>",
  ].join("\n");
  const page = path.join(outDir, "editor_page.html");
  fs.writeFileSync(page, html);
  return "file:///" + page.replace(/\\/g, "/");
}

async function openEditor(injection) {
  const url = await buildPage(injection);
  const { chromium } = requirePlaywright();
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error("Chromium не запустился. Поставьте сборку браузера:");
    console.error("  npx playwright install chromium");
    console.error(String((e && e.message) || e));
    process.exit(2);
  }
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String((e && e.message) || e)));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console.error: " + m.text()); });
  await page.goto(url);
  await page.waitForSelector(".cm-content");
  await page.waitForFunction(() => typeof window.__ioEditorProbe === "function");
  return { browser, page, pageErrors };
}

module.exports = { root, outDir, EDITOR_INJECTIONS, buildPage, openEditor };
