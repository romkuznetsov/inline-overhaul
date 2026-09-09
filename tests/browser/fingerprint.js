"use strict";

/**
 * Отпечаток отрисовки редактора: вычисленный стиль каждого узла, который рисует
 * плагин.
 *
 * **Зачем это отдельная команда, а не гейт.** Нужен он одной работе — переносу
 * инлайновых объявлений оформления в классы (правило каталога Р7). Перенос вида
 * не меняет, если сделан верно, и до 2026-09-09 проверить это было нечем, кроме
 * глаза заказчика: так и написано в самом Р7. Теперь есть чем — снимок «до» и
 * снимок «после» на настоящем браузере, и разница между ними обязана быть
 * пустой.
 *
 * Золотым файлом отпечаток **не становится нарочно**: числа в нём зависят от
 * версии Chromium, и закоммиченный снимок начал бы краснеть от обновления
 * браузера, а не от правки кода. Он снимается на время работы и выбрасывается.
 *
 *   node tests/browser/fingerprint.js before.json      — снять
 *   node tests/browser/fingerprint.js before.json --check   — сверить с ним
 */

const fs = require("fs");
const { openEditor } = require("./editor_harness.js");

async function main() {
  const file = process.argv[2];
  const check = process.argv.indexOf("--check") >= 0;
  if (!file) {
    console.error("укажите файл снимка: node tests/browser/fingerprint.js <файл> [--check]");
    process.exit(2);
  }
  const { browser, page, pageErrors } = await openEditor("");
  let taken;
  try {
    /*
     * Снимается **дважды, при разных настройках**: у части узлов вид зависит
     * от ползунков, и снимок на одних умолчаниях был бы слеп к переносу того,
     * что видно только в другом состоянии (У-112).
     */
    taken = await page.evaluate(() => {
      const out = { default: window.__ioFingerprint() };
      window.__ioSetTags({ textSizePct: 140, bubbleWidthPct: 140, bubbleHeightPct: 140, cornersPct: 100 });
      window.__ioSetBand({ heightPx: 5, widthPct: 100, opacity: 40, color: "#123456" });
      out.loud = window.__ioFingerprint();
      window.__ioSetTags({ textSizePct: 50, bubbleWidthPct: 20, bubbleHeightPct: 20, cornersPct: 0 });
      window.__ioSetBand({ heightPx: 0, widthPct: 0, opacity: 75, color: "#908e8e" });
      out.tight = window.__ioFingerprint();
      return out;
    });
  } finally {
    await browser.close();
  }
  /*
   * Ненайденные ресурсы не считаются: с `IO_GATE_EXTRA_CSS` в страницу
   * вкладывается настоящий `app.css` Obsidian, а он ссылается на свои шрифты и
   * значки по путям его установки. На вычисленный стиль это не влияет, и
   * ронять из-за этого сверку значило бы отказаться от самой сверки каскада.
   */
  const real = pageErrors.filter((e) => !/Failed to load resource|ERR_FILE_NOT_FOUND/.test(e));
  if (real.length) {
    console.error("страница ругается: " + real.slice(0, 3).join(" ;; "));
    process.exit(1);
  }
  const counts = Object.keys(taken).map((k) => k + ":" + taken[k].length).join(", ");
  if (!check) {
    fs.writeFileSync(file, JSON.stringify(taken, null, 1));
    console.log("снимок снят: " + file + " (" + counts + ")");
    /* У-110: снимок обязан что-то содержать, иначе сверка ниже пуста. */
    if (!taken.default.length) {
      console.error("в снимке ноль узлов — сверять будет нечего");
      process.exit(1);
    }
    return;
  }
  const was = JSON.parse(fs.readFileSync(file, "utf8"));
  const diffs = [];
  for (const state of Object.keys(was)) {
    const a = was[state] || [];
    const b = taken[state] || [];
    if (a.length !== b.length) {
      diffs.push(state + ": узлов было " + a.length + ", стало " + b.length);
      continue;
    }
    for (let i = 0; i < a.length; i++) {
      for (const key of Object.keys(a[i])) {
        if (String(a[i][key]) !== String(b[i][key])) {
          diffs.push(state + " #" + i + " " + (a[i].token || a[i].cls || a[i].tag)
            + ": " + key + " было «" + a[i][key] + "», стало «" + b[i][key] + "»");
        }
      }
    }
  }
  if (diffs.length) {
    for (const d of diffs.slice(0, 40)) console.log("РАЗНИЦА  " + d);
    console.log("всего расхождений: " + diffs.length);
    process.exit(1);
  }
  console.log("отпечаток совпал до последнего свойства (" + counts + ")");
}

main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(3); });
