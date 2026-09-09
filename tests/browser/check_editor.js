"use strict";

/**
 * Подложка Left и Right Block **в настоящем редакторе** (S7).
 *
 * Что здесь спрашивается у браузера, а не у нашего кода:
 *
 *   1. высота подложки одна на все строки — в том числе на той, где в блоке
 *      стоит ссылка. Его слова: «если в block встречается wikilink, то полоска
 *      становится выше, чем в строке, в которой нет wikilink… она должна быть
 *      одинаковая во всех строках»;
 *   2. подложки соседних строк не пересекаются — даже на верху шкалы высоты:
 *      «после высоты в 3px полоски на разных строках начинают наезжать друг на
 *      друга»;
 *   3. рост зеркальный: «слева… должна отступать от первого элемента на такое
 *      же расстояние, как у правой границы этого block»;
 *   4. и одно исключение зеркальности: «полоска в left block не должна
 *      наезжать на префикс (буллит, чекбокс)»;
 *   5. перенесённый блок режется по зрительным строкам, а не идёт до края;
 *   6. подложка стоит по середине **своей** зрительной строки — в том числе на
 *      строке, которая выше умолчания редактора: «полоска выглядит
 *      нецентрированной — она смещена выше»;
 *   7. каждое деление шкалы высоты двигает подложку, а верх шкалы заполняет
 *      строку: «изменяются только при значениях ползунка от 0 до 2 px»;
 *   8. подложка правого блока не заезжает за спину кнопке `→`, а на строке без
 *      кнопки растёт наружу по-прежнему;
 *   9. высота пузыря тега двигается и в нижней трети своей шкалы: «при 20 %
 *      высота такая же как при 40 %».
 *
 * Запускается `npm run gate:browser` дважды: на нынешнем коде обязан пройти,
 * на каждой подмене — упасть.
 */

const { openEditor, EDITOR_INJECTIONS } = require("./editor_harness.js");

const injection = process.argv[2] || "";

const problems = [];
function bad(msg) { problems.push(msg); }
function near(a, b, eps) { return Math.abs(Number(a) - Number(b)) <= (eps === undefined ? 0.6 : eps); }

async function main() {
  if (injection && !Object.prototype.hasOwnProperty.call(EDITOR_INJECTIONS, injection)) {
    console.error("нет подмены с именем " + injection);
    process.exit(2);
  }
  const { browser, page, pageErrors } = await openEditor(injection);
  try {
    /* ---- 0. Предмет проверки существует ------------------------------- */
    const base = await page.evaluate(() => window.__ioEditorProbe());
    if (!(base.bands.length >= 6)) {
      bad("прямоугольников подложки " + base.bands.length
        + ", а строк с блоками пять — слой не нарисовал ничего или почти ничего");
    }
    /*
     * **Положительный контроль к подделке ссылки** (У-110, У-113). Она обязана
     * быть выше соседнего текста, иначе «высоты равны» выполняется отсутствием
     * предмета — тем самым способом, каким прежний набор не видел дефекта.
     */
    if (!(base.linkBoxHeight > base.textBoxHeight + 1)) {
      bad("подделка ссылки ничего не подделала: её ящик " + base.linkBoxHeight
        + " точек против " + base.textBoxHeight + " у текста — предмета замечания нет");
    }
    if (!(base.linkBoxHeight < base.lineHeight)) {
      bad("подделка ссылки выше самой зрительной строки (" + base.linkBoxHeight
        + " против " + base.lineHeight + ") — у заказчика строки от неё не раздвигались");
    }

    /* ---- 1. Высота подложки одна на все строки ------------------------ */
    const heights = Array.from(new Set(base.bands.map((b) => b.height)));
    if (heights.length !== 1) {
      const withLink = base.rows.filter((r) => r.hasLink).map((r) => r.line);
      bad("высоты подложек разошлись: " + heights.join(", ")
        + " (строки со ссылкой: " + withLink.join(", ") + ")");
    }

    /* ---- 2. Соседние подложки не пересекаются ------------------------- */
    const top = await page.evaluate(async () => {
      await window.__ioSetBand({ heightPct: 100 });
      return window.__ioEditorProbe();
    });
    const sorted = top.bands.slice().sort((a, b) => a.top - b.top);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      /* Один и тот же ряд — не пересечение: там два блока одной строки. */
      if (near(prev.top, cur.top, 0.5)) continue;
      if (cur.top < prev.bottom - 0.5) {
        bad("на верху шкалы высоты подложки строк пересеклись: " + prev.top + "…"
          + prev.bottom + " и " + cur.top + "…" + cur.bottom);
        break;
      }
    }
    /* И контроль: она правда выросла, иначе «не пересеклись» ничего не стоит. */
    if (!(top.bands[0].height > base.bands[0].height)) {
      bad("на верху шкалы высота подложки не выросла (" + top.bands[0].height
        + " против " + base.bands[0].height + ") — ползунок ничего не делает");
    }
    /*
     * **И состояние, в котором прижим к строке действительно решает** (У-88).
     * На умолчаниях сумма «написанное плюс десять точек» до высоты строки не
     * доходит, и снятый прижим ничего бы не изменил — то есть проверка была бы
     * зелёной у дефекта. Пузырь ставится на верх обеих своих шкал: тогда он
     * сам выше строки, и без прижима подложки соседних строк наезжают.
     */
    const fat = await page.evaluate(async () => {
      await window.__ioSetTags({ textSizePct: 140, bubbleHeightPct: 140 });
      await window.__ioSetBand({ heightPct: 100 });
      return window.__ioEditorProbe();
    });
    const fatSorted = fat.bands.slice().sort((a, b) => a.top - b.top);
    let overlap = 0;
    for (let i = 1; i < fatSorted.length; i++) {
      const prev = fatSorted[i - 1];
      const cur = fatSorted[i];
      if (near(prev.top, cur.top, 0.5)) continue;
      if (cur.top < prev.bottom - 0.5) overlap += 1;
    }
    if (overlap) {
      bad("на крупном пузыре и верху шкалы высоты подложки строк наехали друг на друга "
        + overlap + " раз(а) — прижим к зрительной строке не держит");
    }
    if (!(fat.bands[0].height >= fat.lineHeight - 0.6)) {
      bad("положительный контроль: на крупном пузыре подложка (" + fat.bands[0].height
        + ") до высоты строки (" + fat.lineHeight + ") не дошла — прижим не при чём, и проверка слепа");
    }
    /*
     * И сам прижим, а не только его следствие. Пузырь на верху обеих своих
     * шкал **выше** зрительной строки, то есть без прижима подложка вылезает
     * за неё — но всего на несколько десятых точки, и «наехали друг на друга»
     * этого не замечает: допуск проверки больше самого перелива. Поэтому
     * правило спрашивается прямо (У-110: у контроля есть свой контроль).
     */
    if (!(fat.bands[0].height <= fat.lineHeight + 0.05)) {
      bad("на крупном пузыре подложка выше зрительной строки: " + fat.bands[0].height
        + " при строке " + fat.lineHeight + " — прижим снят");
    }
    await page.evaluate(async () => {
      await window.__ioSetTags({ textSizePct: 80, bubbleHeightPct: 80 });
      await window.__ioSetBand({ heightPct: 40 });
    });

    /* ---- 3. Рост зеркальный, и 4. прижат к знаку начала строки -------- */
    const mid = await page.evaluate(async () => {
      await window.__ioSetBand({ heightPct: 40, widthPct: 50 });
      return window.__ioEditorProbe();
    });
    /* Берётся строка без ссылки и без переноса: второй ряд, левый блок. */
    const rowOf = (probe, line) => probe.rows.find((r) => r.line === line);
    const leftBandOf = (probe, line) => {
      const row = rowOf(probe, line);
      if (!row || !row.blockStart) return null;
      /* Левый блок — тот прямоугольник, что стоит на этой строке левее всех. */
      const onRow = probe.bands.filter((b) => b.top < row.blockStart.bottom
        && b.bottom > row.blockStart.top);
      return onRow.length ? onRow.slice().sort((a, b) => a.left - b.left)[0] : null;
    };
    const midRow = rowOf(mid, 2);
    const midBand = leftBandOf(mid, 2);
    if (!midRow || !midBand || !midRow.sepStart || !midRow.prefixGlyphEnd) {
      bad("вторую строку нечем обмерить: блок, разделитель или знак начала строки не найдены");
    } else {
      const inward = midBand.right - (midRow.sepStart.left - (midRow.sepStart.left - midRow.sepStart.left));
      /* Рост к разделителю — от правого края блока до правого края подложки;
         правый край блока браузер отдаёт как левый край разделителя минус
         пробел, поэтому мерится проще: подложка обязана дойти до разделителя. */
      if (!near(midBand.right, midRow.sepStart.left, 1.2)) {
        bad("в середине шкалы подложка не дошла до разделителя: её правый край "
          + midBand.right + ", разделитель начинается на " + midRow.sepStart.left
          + " (" + inward + ")");
      }
      const outward = midRow.blockStart.left - midBand.left;
      const inwardPx = midBand.right - midRow.blockStart.left;
      if (!(outward > 0.5)) {
        bad("в середине шкалы подложка наружу не выросла вовсе (" + outward
          + " точек) — рост не зеркален");
      }
      if (midBand.left < midRow.prefixGlyphEnd.right - 0.5) {
        bad("подложка левого блока заехала на знак начала строки: её левый край "
          + midBand.left + ", чекбокс кончается на " + midRow.prefixGlyphEnd.right);
      }
      if (!(inwardPx > outward)) {
        bad("положительный контроль: рост к разделителю " + inwardPx
          + " не больше роста наружу " + outward + " — мерить нечего");
      }
    }

    /* Верх шкалы ширины: разделитель входит в подложку, а прижим держится. */
    const full = await page.evaluate(async () => {
      await window.__ioSetBand({ heightPct: 40, widthPct: 100 });
      return window.__ioEditorProbe();
    });
    const fullRow = rowOf(full, 2);
    const fullBand = leftBandOf(full, 2);
    if (fullRow && fullBand && fullRow.sepEnd && fullRow.prefixGlyphEnd) {
      if (!(fullBand.right >= fullRow.sepEnd.right - 1.2)) {
        bad("на сотне подложка не включила разделитель: её правый край "
          + fullBand.right + ", разделитель кончается на " + fullRow.sepEnd.right);
      }
      if (fullBand.left < fullRow.prefixGlyphEnd.right - 0.5) {
        bad("на сотне подложка левого блока заехала на знак начала строки: "
          + fullBand.left + " против " + fullRow.prefixGlyphEnd.right);
      }
    } else {
      bad("на сотне вторую строку нечем обмерить");
    }

    /* ---- 5. Перенесённый блок режется по зрительным строкам ----------- */
    const wrapped = await page.evaluate(async () => {
      await window.__ioSetBand({ heightPct: 40, widthPct: 50 });
      const probe = window.__ioEditorProbe();
      const w = document.querySelector(".cm-content").getBoundingClientRect();
      return { probe, contentRight: Math.round(w.right * 100) / 100 };
    });
    const runaway = wrapped.probe.bands.filter((b) => b.right > wrapped.contentRight - 0.5);
    if (runaway.length) {
      bad("подложка дошла до правого края содержимого " + runaway.length
        + " раз(а) — перенесённый блок нарисован выделением, а не по строкам");
    }

    /* ---- 6. Подложка по середине СВОЕЙ зрительной строки -------------- */
    /*
     * Замечание третьего захода дословно: «полоска выглядит нецентрированной —
     * она смещена выше (сверху строки она выглядит больше, чем снизу строки)».
     * Серединой была середина `defaultLineHeight`, а строка со ссылкой или
     * эмодзи **выше** этого умолчания — подложка уезжала вверх на половину
     * разницы. Здесь спрашивается ящик каждой строки у платформы и середина
     * каждой подложки у браузера.
     */
    const centred = await page.evaluate(async () => {
      await window.__ioSetBand({ heightPct: 0, widthPct: 0 });
      return window.__ioEditorProbe();
    });
    const singleRows = centred.rows.filter((r) => r.rowHeight < centred.lineHeight * 1.9);
    /* Положительный контроль (У-110): среди них есть строка ВЫШЕ умолчания,
       иначе «середина совпала» выполняется отсутствием предмета. */
    const tallRows = singleRows.filter((r) => r.rowHeight > centred.lineHeight + 0.6);
    if (!tallRows.length) {
      bad("ни одна строка страницы не выше умолчания редактора (" + centred.lineHeight
        + ") — предмета замечания про смещённую вверх подложку нет");
    }
    for (const row of singleRows) {
      const onRow = centred.bands.filter((b) => b.top >= row.rowTop - 1
        && b.bottom <= row.rowTop + row.rowHeight + 1);
      if (!onRow.length) {
        bad("на строке " + row.line + " подложки не нашлось вовсе");
        continue;
      }
      const rowMid = row.rowTop + row.rowHeight / 2;
      for (const b of onRow) {
        const mid = (b.top + b.bottom) / 2;
        if (!near(mid, rowMid, 0.6)) {
          bad("подложка строки " + row.line + " не по её середине: середина подложки "
            + mid + ", середина строки " + rowMid + " (высота строки " + row.rowHeight
            + " при умолчании " + centred.lineHeight + ")");
        }
      }
    }

    /* ---- 7. Каждое деление шкалы высоты двигает подложку --------------- */
    const steps = [];
    for (const pct of [0, 20, 40, 60, 80, 100]) {
      const probe = await page.evaluate(async (p) => {
        await window.__ioSetBand({ heightPct: p });
        return window.__ioEditorProbe();
      }, pct);
      steps.push({ pct, height: probe.bands[0].height, rowHeight: probe.rows[0].rowHeight });
    }
    for (let i = 1; i < steps.length; i++) {
      if (!(steps[i].height > steps[i - 1].height + 0.05)) {
        bad("деление шкалы высоты " + steps[i].pct + " не двигает подложку: "
          + steps[i].height + " после " + steps[i - 1].height
          + " — это и есть «от 3 до 5 высота как при 2px»");
      }
    }
    const last = steps[steps.length - 1];
    if (!near(last.height, last.rowHeight, 0.6)) {
      bad("верх шкалы высоты не заполняет строку: подложка " + last.height
        + " при строке " + last.rowHeight);
    }

    /* ---- 8. Подложка правого блока и кнопка `→` ----------------------- */
    /*
     * Решение заказчика 2026-09-09: «прижать к кнопке, как прижата к чекбоксу
     * слева». На строке с кнопкой наружный рост кончается на её левом краю; на
     * строке без кнопки он остаётся полным — иначе прижим отменил бы
     * зеркальность всюду.
     */
    const rightBandOf = (probe, line) => {
      const row = probe.rows.find((r) => r.line === line);
      if (!row) return null;
      const onRow = probe.bands.filter((b) => b.top >= row.rowTop - 1
        && b.bottom <= row.rowTop + row.rowHeight + 1);
      return onRow.length ? onRow.slice().sort((a, b) => b.left - a.left)[0] : null;
    };
    const withButton = await page.evaluate(async () => {
      await window.__ioPutCaret(1);
      await window.__ioSetBand({ heightPct: 40, widthPct: 100 });
      return window.__ioEditorProbe();
    });
    if (!withButton.fly) {
      bad("кнопки `→` на странице нет — прижим к ней проверялся бы отсутствием предмета");
    } else {
      const band = rightBandOf(withButton, 1);
      if (!band) {
        bad("подложки правого блока на строке с кнопкой не нашлось");
      } else if (band.right > withButton.fly.left + 0.6) {
        bad("подложка правого блока заехала кнопке `→` за спину: её правый край "
          + band.right + ", кнопка начинается на " + withButton.fly.left);
      }
    }
    /* И вторая половина: на строке без кнопки рост наружу остался. */
    const noButtonTight = await page.evaluate(async () => {
      await window.__ioSetBand({ heightPct: 40, widthPct: 0 });
      return window.__ioEditorProbe();
    });
    const noButtonWide = await page.evaluate(async () => {
      await window.__ioSetBand({ heightPct: 40, widthPct: 100 });
      return window.__ioEditorProbe();
    });
    const tightRight = rightBandOf(noButtonTight, 2);
    const wideRight = rightBandOf(noButtonWide, 2);
    if (!tightRight || !wideRight) {
      bad("подложку правого блока на строке без кнопки нечем обмерить");
    } else if (!(wideRight.right > tightRight.right + 0.5)) {
      bad("на строке без кнопки подложка правого блока наружу не выросла ("
        + wideRight.right + " против " + tightRight.right
        + ") — прижим к кнопке отменил зеркальность всюду");
    }

    /* ---- 9. Нижняя треть шкалы высоты пузыря ------------------------- */
    /*
     * Замечание по V1: «tags-bubble-height при значении ниже 40 % не меняется
     * (т.е. при 20 % высота такая же как при 40 %)». Ограничение платформы тут
     * ни при чём — поле пузыря считалось целым числом точек, и `round(3 * 0.2)`
     * равно `round(3 * 0.4)`. Мерит браузер, а не наша формула.
     */
    const bubbleAt = async (pct) => {
      const probe = await page.evaluate(async (p) => {
        await window.__ioSetTags({ bubbleHeightPct: p });
        return window.__ioEditorProbe();
      }, pct);
      return probe.bubbleHeight;
    };
    const b20 = await bubbleAt(20);
    const b40 = await bubbleAt(40);
    const b100 = await bubbleAt(100);
    /*
     * **Целая точка, а не любое число.** Округление поля до точки оставляло
     * между двадцатью и сорока процентами четыре сотых точки: формально шкала
     * «двигалась», а на экране это то самое «высота такая же». Порог назван по
     * тому, что видно: разница меньше точки на экране не видна.
     */
    if (!(b40 >= b20 + 1)) {
      bad("пузырь на 40 % выше, чем на 20 %, меньше чем на точку (" + b40
        + " против " + b20 + ") — это и есть «высота такая же»");
    }
    if (!(b100 >= b40 + 1)) {
      bad("положительный контроль: пузырь на сотне выше, чем на 40 %, меньше чем на точку ("
        + b100 + " против " + b40 + ") — шкала не работает вовсе");
    }
    await page.evaluate(async () => {
      await window.__ioSetTags({ bubbleHeightPct: 80 });
      await window.__ioSetBand({ heightPct: 40, widthPct: 50 });
    });

    /* ---- 10. Оверлей скроллера TagWheel ------------------------------- */
    /*
     * **Он тоже поднят в браузер** (Р7). Про него в самом правиле каталога
     * написано: «перенос 32 его объявлений в классы вида не меняет, если сделан
     * верно, — но проверить это можно только глазами заказчика». После переноса
     * его вид живёт в `styles.css`, а набор на заглушке DOM стилей не читает
     * вовсе: эту половину видит только браузер.
     */
    const overlay = await page.evaluate(() => {
      window.__ioShowScroller({ direction: "full" });
      const themed = window.__ioFingerprintScroller();
      window.__ioShowScroller({ direction: "full", fillColor: "#988925", textColor: "#a5a0d4" });
      const colored = window.__ioFingerprintScroller();
      return { themed, colored };
    });
    const boxes = overlay.themed.filter((n) => /\bio-twscroller\b/.test(String(n.cls)));
    const rows = overlay.themed.filter((n) => /\bio-twscroller__row\b/.test(String(n.cls)));
    if (boxes.length !== 2) {
      bad("коробок оверлея " + boxes.length + ", а их две: вверх и вниз");
    } else {
      for (const b of boxes) {
        if (b.display !== "block") {
          bad("показанная коробка оверлея нарисована как «" + b.display
            + "», а не блоком — правило показа не сработало");
        }
        if (b.position !== "fixed") bad("коробка оверлея не закреплена на экране: " + b.position);
        if (b["padding-top"] !== "4px") bad("поле коробки сверху " + b["padding-top"] + ", а было 4px");
        if (b["font-size"] !== "12px") bad("кегль коробки " + b["font-size"] + ", а был 12px");
        /*
         * Пустой цвет значит «взять у темы», а не «прозрачный»: это его
         * условие (Н2), и после переноса умолчание живёт в правиле.
         */
        if (/rgba\(0, 0, 0, 0\)|transparent/.test(String(b["background-color"]))) {
          bad("без своего цвета коробка оверлея прозрачна («" + b["background-color"]
            + "») — умолчание «взять у темы» потеряно");
        }
      }
    }
    if (rows.length !== 5) {
      bad("строк в коробках оверлея " + rows.length + ", а их пять: две вверх и три вниз");
    } else {
      for (const r of rows) {
        if (r["padding-left"] !== "8px") bad("поле строки оверлея " + r["padding-left"] + ", а было 8px");
        if (r["text-overflow"] !== "ellipsis") bad("длинная строка оверлея больше не обрезается многоточием");
        if (r.opacity !== "0.95") bad("густота строки оверлея " + r.opacity + ", а была 0.95");
      }
    }
    /* И положительный контроль: заданный цвет доезжает до вычисленного стиля. */
    const coloredBox = overlay.colored.find((n) => /\bio-twscroller\b/.test(String(n.cls)));
    const coloredRow = overlay.colored.find((n) => /\bio-twscroller__row\b/.test(String(n.cls)));
    if (!coloredBox || !coloredRow) {
      bad("оверлей со своими цветами не нарисовался — контроль не поставлен");
    } else {
      if (coloredBox["background-color"] !== "rgb(152, 137, 37)") {
        bad("заданный фон коробки не доехал: " + coloredBox["background-color"]);
      }
      if (coloredRow.color !== "rgb(165, 160, 212)") {
        bad("заданный цвет строки не доехал: " + coloredRow.color);
      }
    }

    if (pageErrors.length) bad("страница ругается: " + pageErrors.slice(0, 3).join(" ;; "));

    if (problems.length) {
      for (const p of problems) console.log("FAIL  " + p);
      console.log("  прямоугольников " + base.bands.length + ", высота "
        + heights.join("/") + ", ссылка " + base.linkBoxHeight
        + " против текста " + base.textBoxHeight);
      process.exit(1);
    }
    console.log("  прямоугольников " + base.bands.length + ", высота одна ("
      + heights[0] + "), ссылка " + base.linkBoxHeight + " против текста "
      + base.textBoxHeight + ", строка " + base.lineHeight);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(3);
});
