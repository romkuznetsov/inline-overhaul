"use strict";

/**
 * Стенд прокрутки при переносе текста: **что видит экран, а не документ**.
 *
 *     node tools/move_scroll_bench.js
 *     node tools/move_scroll_bench.js --legacy
 *
 * **Зачем он есть.** Его замечание 2026-09-22: «при переносе выделенного
 * текста move left\right прыгает экран — так быть не должно, он должен
 * оставаться где и был». Текст при этом получался верный: все проверки
 * переноса были зелёные и остались бы зелёными, потому что подделка редактора
 * пикселей не считает, а замечание — ровно про них (У-98).
 *
 * **Что он делает.** Поднимает настоящий `EditorView` с заметкой в двести
 * строк, ставит рабочую строку в середину экрана, зовёт настоящий
 * `moveSelection` через обёртку `Editor`, списанную с `app.js` 1.13.7, и
 * печатает прокрутку до и после каждого нажатия.
 *
 * **Что он показал.** Замена документа целиком сама по себе экран не двигает:
 * на заметке без свёрнутых кусков прокрутка стоит при обеих записях. Двигает
 * его то, что переносить через такое изменение **нечего**: свёрнутый кусок
 * выше рабочей строки разворачивается от одного нажатия, заметка вырастает, и
 * экран уезжает на его высоту — свёрток 1 → 0, прокрутка 1006 → 2840.
 *
 * **Контроли — четыре, и каждый на свой шаг** (правило 64):
 *
 *   * `--legacy` возвращает прежнюю запись (документ целиком) и обязан
 *     показать уезжающий экран. Порог проверяется возвратом прежнего кода, а
 *     не рассуждением (У-223); подмена применяется к тексту модуля, и стенд
 *     громко падает, если образец не совпал (У-265);
 *   * заметка **без** свёрнутых кусков — граница правки: там обе записи
 *     держат экран, и стенд падает, если уехал и там (У-164);
 *   * нажатие в стену — слово уже у начала строки — обязано не сдвинуть ни
 *     текст, ни прокрутку **ни в одном** из режимов: иначе стенд мерил бы сам
 *     факт нажатия, а не запись;
 *   * страница обязана быть прокручиваемой и стоять не у края: `до` больше
 *     нуля и меньше предела. Ноль означал бы, что ехать было некуда, и
 *     «прокрутка не изменилась» ничего не значило бы (У-88).
 *
 * **Чего стенд не заменяет.** Здесь нет Obsidian: её декораций, её тем и её
 * фильтров. Он отвечает на один вопрос — держится ли прокрутка при той
 * записи, какую делает перенос текста.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LEGACY = process.argv.includes("--legacy");

/*
 * Прежняя запись — подмена в текст модуля, а не вторая дорога в продукте.
 * Ищется тело помощника целиком: образец, совпавший с половиной, подменил бы
 * не то, о чём отчитывается (У-151).
 */
const NOW = [
  "  if (doc.slice(from, to) === insert) return;",
  "  editor.replaceRange(insert, editor.offsetToPos(from), editor.offsetToPos(to));",
].join("\n");
const BEFORE = [
  "  const newDoc = doc.slice(0, from) + insert + doc.slice(to);",
  "  if (newDoc !== doc) editor.setValue(newDoc);",
].join("\n");

const NAV = path.join(ROOT, "src", "navigation_runtime.js");

function legacyPlugin() {
  return {
    name: "io-move-legacy",
    setup(build) {
      build.onLoad({ filter: /navigation_runtime\.js$/ }, (args) => {
        if (path.resolve(args.path) !== path.resolve(NAV)) return null;
        const src = fs.readFileSync(args.path, "utf8");
        if (src.indexOf(NOW) < 0) {
          throw new Error("подмена `--legacy` не нашла своего образца в navigation_runtime.js — она подменила бы не то");
        }
        return { contents: src.replace(NOW, BEFORE), loader: "js" };
      });
    },
  };
}

function requireEsbuild() {
  try {
    return require("esbuild");
  } catch (_e) {
    console.error("нет esbuild — он ставится вместе с зависимостями: npm ci");
    process.exit(2);
  }
  return null;
}

function requirePlaywright() {
  try {
    return require("playwright");
  } catch (_e) {
    console.error("нет playwright — поставьте: npm i -D playwright && npx playwright install chromium");
    process.exit(2);
  }
  return null;
}

/**
 * Заметка в двести строк: рабочая стоит посередине, ехать есть куда в обе
 * стороны.
 *
 * Длина строк **нарочно разная**: короткая, средняя и такая, что переносится
 * по ширине. У заметки из одинаковых строк высота каждой одна и та же, и
 * ответ «прокрутка не изменилась» получался бы сам собой (У-147).
 */
function buildDoc(lineNo, working) {
  const lines = [];
  const long = "длинная строка, которая заведомо не помещается в ширину окна и переносится на несколько"
    + " зрительных строк, чтобы у карты высот было что считать, а не таблица одинаковых чисел";
  for (let i = 0; i < 200; i++) {
    if (i === lineNo) { lines.push(working); continue; }
    const kind = i % 3;
    if (kind === 0) lines.push("строка " + (i + 1));
    else if (kind === 1) lines.push("строка " + (i + 1) + " обычного текста заметки");
    else lines.push("строка " + (i + 1) + " — " + long);
  }
  return lines.join("\n");
}

/**
 * Две заметки на один вопрос, и вторая — граница правки.
 *
 * Свёрнутый кусок выше рабочей строки и есть то, что запись документом целиком
 * теряет: перенести свёртку через изменение, накрывшее весь документ, не на
 * что, заметка разворачивается разом, и экран уезжает. На заметке **без**
 * свёрток обе записи держат экран одинаково — значит правка чинит именно это,
 * а не «прокрутку вообще» (У-164).
 */
const SCENES = [
  { name: "со свёрнутым куском выше строки", fold: { from: 10, to: 90 } },
  { name: "без свёрнутых кусков (граница)", fold: null },
];

const CFG = {
  enabled: true,
  inlineEnabled: true,
  inlineMoveMode: "word",
  prefixCyclerEnabled: false,
  indentFallbackEnabled: false,
};

async function main() {
  const esbuild = requireEsbuild();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "io-movescroll-"));
  const bundle = path.join(outDir, "page.bundle.js");
  await esbuild.build({
    entryPoints: [path.join(__dirname, "move_scroll_page.js")],
    bundle: true,
    format: "iife",
    outfile: bundle,
    platform: "browser",
    absWorkingDir: ROOT,
    logLevel: "silent",
    plugins: LEGACY ? [legacyPlugin()] : [],
  });
  const html = [
    "<!doctype html><meta charset=utf-8>",
    "<style>",
    "  html, body { margin: 0; padding: 0; }",
    /* Высота редактора задана: без неё прокручивается окно, а не `.cm-scroller`. */
    "  #host, .cm-editor { height: 300px; }",
    "  .cm-content { font-family: sans-serif; font-size: 16px; }",
    "</style>",
    "<div id=host></div>",
    "<script src='page.bundle.js'></script>",
  ].join("\n");
  const page = path.join(outDir, "page.html");
  fs.writeFileSync(page, html);

  const { chromium } = requirePlaywright();
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error("Chromium не запустился: npx playwright install chromium");
    console.error(String((e && e.message) || e));
    process.exit(2);
  }
  try {
    const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
    const errors = [];
    p.on("pageerror", (e) => errors.push(String((e && e.message) || e)));
    await p.goto("file:///" + page.replace(/\\/g, "/"));
    await p.waitForFunction(() => !!window.__ioMoveBench);

    const LINE = 120;
    const WORKING = "- (слово1 слово2 слово3)";
    const doc = buildDoc(LINE, WORKING);

    console.log("запись: " + (LEGACY ? "документ целиком (прежняя, --legacy)" : "окно строки (нынешняя)"));

    let movedWithFold = 0;
    for (const scene of SCENES) {
      const built = await p.evaluate(
        (spec) => window.__ioMoveBench.build(spec),
        { doc: doc, lineNo: LINE, phrase: "слово3", fold: scene.fold },
      );

      /* Контроли до первого вывода: ехать обязано быть куда (правило 44). */
      const room = built.height - built.client;
      if (room <= 0) throw new Error("страница не прокручивается вовсе — «прокрутка не изменилась» тут ничего не значит");
      if (built.scroll <= 0 || built.scroll >= room) {
        throw new Error("рабочая строка стоит у края прокрутки (" + built.scroll + " из " + room + ") — экрану некуда уехать");
      }
      if (built.folds !== (scene.fold ? 1 : 0)) {
        throw new Error(scene.name + ": свёрнутых кусков " + built.folds + ", а заказано " + (scene.fold ? 1 : 0));
      }

      const steps = [];
      for (let i = 0; i < 4; i++) {
        const r = await p.evaluate(
          (a) => window.__ioMoveBench.press(a.direction, a.cfg, a.lineNo),
          { direction: "left", cfg: CFG, lineNo: LINE },
        );
        steps.push(r);
      }
      if (errors.length) throw new Error("страница ругалась: " + errors.join(" | "));

      console.log(scene.name + ":  строка " + (LINE + 1) + " из 200,  прокрутка при старте "
        + built.scroll + " из " + room + ",  свёрнутых кусков " + built.folds);
      let moved = 0;
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const d = s.after - s.before;
        if (d !== 0) moved++;
        console.log("  нажатие " + (i + 1)
          + ":  прокрутка " + String(s.before).padStart(5) + " → " + String(s.after).padStart(5)
          + " (" + (d === 0 ? "на месте" : (d > 0 ? "+" : "") + d) + ")"
          + "  высота " + String(s.height).padStart(5) + "  свёрток " + s.folds
          + "   строка: " + s.line);
      }

      /*
       * Нажатие в стену — четвёртое: слово уже стоит у знака списка, дальше
       * ему некуда. Текст обязан быть тем же, что после третьего, и прокрутка
       * тоже: иначе стенд мерил бы сам факт нажатия, а не запись.
       */
      const wall = steps[3];
      if (wall.line !== steps[2].line) {
        throw new Error(scene.name + ": четвёртое нажатие изменило строку — стены нет, и отрицательного контроля у стенда тоже");
      }
      if (wall.after !== wall.before) {
        throw new Error(scene.name + ": нажатие, ничего не написавшее, сдвинуло прокрутку — стенд мерит нажатие, а не запись");
      }

      console.log("  " + (moved === 0
        ? "экран не сдвинулся ни на одном нажатии"
        : "экран уехал на " + moved + " нажатии(ях) из " + steps.length)
        + ",  свёртка " + (steps[steps.length - 1].folds === built.folds ? "цела" : "пропала"));

      if (scene.fold) {
        movedWithFold = moved;
        if (!LEGACY && steps[steps.length - 1].folds !== built.folds) {
          throw new Error("нынешняя запись потеряла свёртку — то самое, чем экран и уезжал");
        }
      } else if (moved !== 0) {
        /*
         * Граница правки названа вслух (У-164): на заметке без свёрнутых
         * кусков **обе** записи держат экран, и «починилось» здесь было бы
         * ответом не на его замечание.
         */
        throw new Error("на заметке без свёрнутых кусков экран уехал — предмет стенда шире, чем сказано в его шапке");
      }
    }

    if (LEGACY && movedWithFold === 0) {
      throw new Error("прежняя запись экран не сдвинула — подмена применилась, а предмет не тот (У-265)");
    }
    if (!LEGACY && movedWithFold !== 0) {
      throw new Error("нынешняя запись сдвинула экран — его замечание живо");
    }
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(1);
});
