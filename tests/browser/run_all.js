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
 * одной из них, не проверяет ничего — за неделю таких было две (У-88).
 *
 * В CI шаг не включён: Chromium — 115 МБ на машину, и это решение заказчика
 * 2026-09-08. Но и пропуска здесь нет: без браузера шаг падает и говорит, чем
 * его поставить (A15 — тихо пропущенная проверка это проверка, которой нет).
 */

const path = require("path");
const { spawnSync } = require("child_process");
const { INJECTIONS } = require("./harness.js");

const root = path.resolve(__dirname, "..", "..");
const check = path.join(__dirname, "check_panel.js");

function run(injection) {
  return spawnSync(process.execPath, injection ? [check, injection] : [check],
    { cwd: root, encoding: "utf8", timeout: 300000 });
}

let failed = 0;

/* 1. Нынешний вид. */
{
  const r = run("");
  const tail = ((r.stdout || "") + (r.stderr || "")).trim().split("\n");
  if (r.status === 0) {
    console.log("ok    вид панели      " + (tail[tail.length - 1] || "").trim());
  } else {
    failed++;
    console.log("FAIL  вид панели");
    tail.slice(-14).forEach((l) => console.log("      " + l));
  }
}

/* 2. Подмены: каждая обязана уронить проверку. */
for (const name of Object.keys(INJECTIONS)) {
  const r = run(name);
  if (r.status === 1) {
    const first = ((r.stdout || "") + "").split("\n").find((l) => l.indexOf("FAIL") >= 0) || "";
    console.log("ok    подмена " + name.padEnd(16) + "проверка краснеет: " + first.replace(/^\s*FAIL\s*/, "").slice(0, 74));
  } else {
    failed++;
    console.log("FAIL  подмена " + name.padEnd(16)
      + (r.status === 0
        ? "проверка осталась зелёной — она не смотрит на то, что подменили"
        : "проверка не запустилась (код " + r.status + ")"));
    ((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-6).forEach((l) => console.log("      " + l));
  }
}

console.log(failed ? "\n" + failed + " problem(s)" : "\nвид панели проверен браузером, и проверка умеет краснеть");
process.exit(failed ? 1 : 0);
