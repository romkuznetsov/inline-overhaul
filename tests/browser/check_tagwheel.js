"use strict";

/**
 * Браузерная проверка сессии TagWheel: **путь измерения к переезду панели**.
 *
 * Заказчик выбрал переезд панели с текста заметки на накладку поверх строки
 * (В-108) и задал порядок: сперва путь измерения, потом переезд. Причина
 * порядка — в 114у: вид панели не меряет ни один из семи шагов, её рисует
 * Obsidian из текста строки, и как только полоса станет узлом, мерить её будет
 * нечем. TagWheel — самая используемая часть плагина, и недоделанная накладка
 * дороже нынешнего дефекта.
 *
 * **Что проверяется сегодня.** Что сессия живёт и доезжает до экрана: панель
 * открывается, человек её видит, стрелка меняет показанное, оверлей скроллера
 * нарисован и стоит у своей строки, `Esc` возвращает документ в исходное.
 *
 * **Что из этого переживёт переезд, а что сменится.** Переживёт всё, кроме
 * одной строки: сегодня нарисованное равно написанному, потому что полоса есть
 * разметка в тексте заметки. После переезда написанное перестанет меняться
 * вовсе — и вот это здесь названо отдельным измерением (`docUnchanged`), чтобы
 * в день переезда поменялось одно утверждение, а не вся проверка.
 */

const { openPanel, PANEL_INJECTIONS } = require("./panel_harness.js");

const injection = process.argv[2] || "";
const problems = [];
function bad(message) { problems.push(message); }

async function main() {
  if (injection && !Object.prototype.hasOwnProperty.call(PANEL_INJECTIONS, injection)) {
    console.error("нет подмены с именем " + injection);
    process.exit(2);
  }
  const { browser, page, pageErrors } = await openPanel(injection);
  try {
    /* ---- 0. Предмет проверки существует ------------------------------- */
    const before = await page.evaluate(() => window.__ioPanelProbe());
    if (before.active) bad("панель считает себя открытой ещё до того, как её открыли");
    if (!before.lineText || before.lineText.indexOf("1231") < 0) {
      bad("на странице нет строки заказчика: " + JSON.stringify(before.lineText));
    }

    /* ---- 1. Панель открывается, и это контроль ко всему дальнейшему ---- */
    const open = await page.evaluate(() => window.__ioPanelOpen("left", 0));
    if (!open.active) {
      bad("панель не открылась" + (open.said.length
        ? ", и сказала: " + JSON.stringify(open.said)
        : ", и промолчала — то есть отказ тихий"));
    }
    if (open.said.length) {
      bad("панель открылась с жалобой: " + JSON.stringify(open.said));
    }

    /* ---- 2. Человек её видит ------------------------------------------ */
    if (open.lineDrawn === before.lineDrawn) {
      bad("на экране ничего не сменилось: строка как была «" + before.lineDrawn
        + "» — сессия есть, а панели человек не видит");
    }
    if (!/\*\*\[[^\]]+\]\*\*/.test(String(open.lineDrawn || ""))) {
      bad("в нарисованном нет пометки активного поля: " + JSON.stringify(open.lineDrawn));
    }

    /* ---- 3. Стрелка доезжает до панели -------------------------------- */
    const stepped = await page.evaluate(() => window.__ioPanelKey("ArrowUp"));
    if (!stepped.active) bad("после стрелки сессия закрылась");
    if (stepped.lineDrawn === open.lineDrawn) {
      bad("стрелка ничего не изменила: «" + stepped.lineDrawn
        + "» — нажатие до панели не доезжает");
    }

    /* ---- 4. Оверлей скроллера нарисован и стоит у своей строки --------- */
    const box = stepped.overlayBox;
    if (!box || !(box.width > 0 && box.height > 0)) {
      bad("оверлей скроллера не нарисован: " + JSON.stringify(box));
    } else {
      if (!(stepped.overlayRows > 0)) {
        bad("в оверлее ноль строк — коробка есть, а показывать ей нечего");
      }
      const line = stepped.lineBox;
      if (!line) {
        bad("узла строки на странице нет — оверлей не с чем сверить");
      } else if (box.bottom < line.top - 400 || box.top > line.bottom + 400) {
        bad("оверлей уехал от своей строки: он " + box.top + "…" + box.bottom
          + " при строке " + line.top + "…" + line.bottom);
      }
    }

    /* ---- 5. Курсор стоит внутри того, что нарисовано ------------------- */
    if (!(stepped.cursor.ch >= 0 && stepped.cursor.ch <= String(stepped.lineText || "").length)) {
      bad("курсор вне строки: " + stepped.cursor.ch + " при длине "
        + String(stepped.lineText || "").length);
    }

    /* ---- 6. `Esc` возвращает документ человека ------------------------- */
    const done = await page.evaluate(() => window.__ioPanelKey("Escape"));
    if (done.active) bad("после `Esc` сессия осталась открытой");
    if (!done.docUnchanged) {
      bad("после `Esc` документ не вернулся к исходному: «" + done.doc
        + "» вместо «" + done.startDoc + "»");
    }

    if (pageErrors.length) bad("страница ругается: " + pageErrors.slice(0, 3).join(" ;; "));

    if (problems.length) {
      for (const p of problems) console.log("FAIL  " + p);
      process.exit(1);
    }
    console.log("  сессия открылась, нарисовано «" + open.lineDrawn
      + "», оверлей " + (stepped.overlayBox ? stepped.overlayBox.width + "×"
        + stepped.overlayBox.height : "нет") + " на " + stepped.overlayRows
      + " строк, документ во время сессии " + (open.docUnchanged ? "не менялся" : "менялся"));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(3);
});
