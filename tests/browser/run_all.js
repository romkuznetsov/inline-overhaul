"use strict";

/**
 * Браузерный гейт: `npm run gate:browser`.
 *
 * Два прогона одной и той же проверки, и второй важнее первого:
 *
 *   1. **на нынешнем виде** — обязана пройти;
 *   2. **на каждой подмене** — обязана упасть.
 *
 * Подмена возвращает панель в то состояние, из которого заказчик уже приносил
 * замечание: подсказка шириной с имя, подсказка в спрятанном узле, шапка серым
 * по серому, знак `%` на второй строке. Проверка, которая не краснеет ни на
 * одной из них, не проверяет ничего (У-88).
 *
 * **Проверок здесь две, и открывают они разные вещи.**
 *
 *   * `check_panel.js` — **прототип**: панель нормативна по виду (Р8), и это
 *     наш HTML с нашим CSS. Панель плагина в браузер не поднять — её рисует
 *     Obsidian по декларациям;
 *   * `check_editor.js` — **редактор**: слой оформления заметки это чистый
 *     CodeMirror, и он в браузер поднимается. Строка «как это выглядит в самой
 *     заметке — решает ваш глаз» кончала лист приёмки дважды; с 2026-09-09
 *     она неверна (У-98: «проверить нечем» — это оценка, а не факт).
 *
 * В CI шаг не включён: Chromium — 115 МБ на машину, и это решение заказчика
 * 2026-09-08. Но и пропуска здесь нет: без браузера шаг падает и говорит, чем
 * его поставить (A15 — тихо пропущенная проверка это проверка, которой нет).
 */

const path = require("path");
const { spawnSync } = require("child_process");
const { INJECTIONS } = require("./harness.js");
const { EDITOR_INJECTIONS } = require("./editor_harness.js");

const root = path.resolve(__dirname, "..", "..");

/** Две проверки, у каждой свой список подмен. */
const SUITES = [
  { name: "вид панели", script: path.join(__dirname, "check_panel.js"), injections: INJECTIONS },
  { name: "подложка в редакторе", script: path.join(__dirname, "check_editor.js"), injections: EDITOR_INJECTIONS },
];

function run(script, injection) {
  return spawnSync(process.execPath, injection ? [script, injection] : [script],
    { cwd: root, encoding: "utf8", timeout: 300000 });
}

let failed = 0;

for (const suite of SUITES) {
  /* 1. Нынешний вид. */
  {
    const r = run(suite.script, "");
    const tail = ((r.stdout || "") + (r.stderr || "")).trim().split("\n");
    if (r.status === 0) {
      console.log("ok    " + suite.name.padEnd(22) + (tail[tail.length - 1] || "").trim());
    } else {
      failed++;
      console.log("FAIL  " + suite.name);
      tail.slice(-14).forEach((l) => console.log("      " + l));
    }
  }

  /* 2. Подмены: каждая обязана уронить проверку. */
  for (const name of Object.keys(suite.injections)) {
    const r = run(suite.script, name);
    if (r.status === 1) {
      const first = ((r.stdout || "") + "").split("\n").find((l) => l.indexOf("FAIL") >= 0) || "";
      console.log("ok    подмена " + name.padEnd(18) + "проверка краснеет: "
        + first.replace(/^\s*FAIL\s*/, "").slice(0, 70));
    } else {
      failed++;
      console.log("FAIL  подмена " + name.padEnd(18)
        + (r.status === 0
          ? "проверка осталась зелёной — она не смотрит на то, что подменили"
          : "проверка не запустилась (код " + r.status + ")"));
      ((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-6).forEach((l) => console.log("      " + l));
    }
  }
}

console.log(failed
  ? "\n" + failed + " problem(s)"
  : "\nпанель и подложка в заметке проверены браузером, и проверки умеют краснеть");
process.exit(failed ? 1 : 0);
