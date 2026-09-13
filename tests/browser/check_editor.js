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

    /*
     * ---- 0б. Строка-заголовок: подложка стоит по написанному ------------
     *
     * Его замечание 2026-09-13: «в строке хедера полоска tags-block-fill
     * смещена наверх — выглядит отвратительно», и рядом «`##` стал пузырьком».
     * Обмерено по его скриншоту картой прямоугольников: подложка занимала
     * `6…35`, а буквы и пузыри — `20…43`, то есть середины разошлись на десять
     * точек из сорока.
     *
     * **Эталон — написанное, и отдаёт его браузер.** `Range` по содержимому
     * строки — объединение строчных ящиков, то есть место букв и пузырей; ни
     * одного нашего числа в нём нет. Ящик **узла** эталоном быть не может:
     * отступ заголовка Obsidian задаёт `padding`
     * (`.cm-s-obsidian .cm-line.HyperMD-header { padding-top: … }`), а тот
     * лежит внутри границы. Прежняя мерка сверяла середину подложки с
     * серединой ящика узла, и на настоящем правиле Obsidian она зелена у
     * дефекта: заказчик получил «полоса по прежнему выше» на починенном по
     * ней гейте.
     *
     * Пузырь тут тоже не годится: он выровнен по базовой линии крупного кегля
     * и сам стоит ниже середины строки.
     */
    const head = base.heading;
    if (!head) {
      bad("строки-заголовка на странице нет — вертикаль подложки на ней проверять не на чем");
    } else {
      if (!(head.line.height > head.ink.height + 4)) {
        bad("подделка заголовка ничего не подделала: ящик строки " + head.line.height
          + " точек против написанного " + head.ink.height + " — предмета замечания нет");
      }
      /*
       * **Контроль к самой подделке: отступ обязан быть `padding`** (У-151).
       * На `margin` этой проверке нечего было бы находить — ящик узла совпал
       * бы с написанным, и совпадающей стороной стало бы моё предположение о
       * форме отступа.
       */
      if (!(head.padTop > 4)) {
        bad("у строки-заголовка нет внутреннего отступа сверху (" + head.padTop
          + ") — предмета замечания нет, отступ задан не тем свойством");
      }
      if (!(head.line.top < head.ink.top - 4)) {
        bad("ящик строки-заголовка не выше написанного: узел " + head.line.top
          + ", написанное " + head.ink.top + " — мерить расхождение не на чем");
      }
      if (head.tagBubblesInPrefix !== 0) {
        bad("знак заголовка получил пузырь тега (" + head.tagBubblesInPrefix
          + ") — решётки в начале строки принадлежат Obsidian, а не нам");
      }
      if (!head.token) {
        bad("на строке-заголовке нет ни одного пузыря — строка не наша, мерить нечего");
      } else if (!head.bands.length) {
        bad("на строке-заголовке нет подложки — мерить нечего");
      } else {
        /*
         * **Правило в двух половинах, и обе — его слова.**
         *
         *   * подложка ниже написанного — стоит по его середине;
         *   * подложка выше написанного (так у него и есть: в заголовке
         *     написанное ниже обычной строки, а высота подложки одна на все
         *     строки) — **накрывает** написанное целиком.
         *
         * И в обоих случаях не выходит за строку: «полоски на разных строках
         * наезжают друг на друга» — про соседей, и соседняя строка начинается
         * там, где кончается эта.
         */
        for (const b of head.bands) {
          const bandMid = (b.top + b.bottom) / 2;
          const rowMid = (head.ink.top + head.ink.bottom) / 2;
          if (b.height <= head.ink.height + 0.6) {
            if (!near(bandMid, rowMid, 1.5)) {
              bad("на строке-заголовке подложка не по середине написанного: её середина "
                + bandMid + ", середина написанного " + rowMid + " (разница "
                + Math.round((bandMid - rowMid) * 100) / 100 + ")");
            }
          } else if (b.top > head.ink.top + 0.6 || b.bottom < head.ink.bottom - 0.6) {
            bad("на строке-заголовке подложка выше написанного, но его не накрывает: "
              + b.top + "…" + b.bottom + " при написанном " + head.ink.top + "…"
              + head.ink.bottom);
          }
          /* И она не вылезает из строки: прижим по написанному это нарушал. */
          if (b.top < head.line.top - 0.6 || b.bottom > head.line.bottom + 0.6) {
            bad("на строке-заголовке подложка вышла за строку: " + b.top + "…" + b.bottom
              + " при строке " + head.line.top + "…" + head.line.bottom);
          }
        }
      }
    }

    /*
     * ---- 0в. Запасной путь даёт то же, что основной --------------------
     *
     * Платформа отвечает «где кончается зрительная строка» не всегда: у
     * заказчика она отдавала конец строки документа, и подложка съезжала вниз
     * (10.13.102), а нарисованная прямоугольниками платформы растягивалась во
     * всю ширину окна (10.13.103). В браузере этот отказ сам не случается —
     * значит его надо устроить, иначе запасной путь не проверяет никто.
     *
     * Сверяются **прямоугольники**: на сломанной границе они обязаны встать
     * там же, где стояли. Возврат границы — тут же, иначе все следующие
     * измерения пойдут по другому редактору.
     */
    const fallback = await page.evaluate(async () => {
      await window.__ioBreakRowBoundary(true);
      const probe = window.__ioEditorProbe();
      await window.__ioBreakRowBoundary(false);
      return probe;
    });
    const sameBands = (a, b) => a.length === b.length && a.every((band, i) => near(band.top, b[i].top, 0.6)
      && near(band.bottom, b[i].bottom, 0.6) && near(band.left, b[i].left, 0.6)
      && near(band.right, b[i].right, 0.6));
    if (!sameBands(base.bands, fallback.bands)) {
      const diff = fallback.bands.map((band, i) => {
        const was = base.bands[i];
        return was && near(band.top, was.top, 0.6) && near(band.left, was.left, 0.6)
          ? null
          : "[" + (was ? was.top + "…" + was.bottom + " x " + was.left + "…" + was.right : "нет")
            + " → " + band.top + "…" + band.bottom + " x " + band.left + "…" + band.right + "]";
      }).filter(Boolean);
      bad("без ответа платформы о конце зрительной строки подложки встали иначе ("
        + base.bands.length + " против " + fallback.bands.length + "): " + diff.slice(0, 3).join(" "));
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
    /*
     * **Вопрос задан к написанному, а не к краю ящика** — и это правка 2026-09-11,
     * купленная первым же прогоном в CI (У-78).
     *
     * Было: «ни одна подложка не доходит до правого края содержимого». У
     * выделения прямоугольник и правда доходит туда независимо от текста, так
     * что признак верный, — но у **порядной** отрисовки он тоже доходит, если
     * написанное на этой зрительной строке само упирается в край. Где встанет
     * перенос — решает не только наш CSS, и на Linux-раннере шаг упал,
     * оставаясь зелёным у меня.
     *
     * **Записанная тогда причина неверна, и это измерено, а не выведено.** В
     * отчёте стояло, что гейт меряет вертикаль, зависящую от шрифтов: «строка
     * со ссылкой даёт высоту 24 против 19 у текста». По журналу того самого
     * прогона CI эти числа — и высота подложки 24.19, и высота строки 32 —
     * **совпадают с моими до точки**. Значит вертикаль ни при чём, и причина
     * названа была из диагностической строки, а не из падения.
     *
     * **Чего я пока не знаю, и говорю это прямо.** Воспроизвести падение у
     * себя не вышло: восемь семейств шрифтов (`IO_GATE_FONT`) и семнадцать
     * ширин ящика (`IO_GATE_WIDTH`) — везде зелено и на старой проверке тоже.
     * То есть предположение «дело в месте переноса» **не подтверждено**, и
     * возвращать шаг в CI на нём было бы той же ошибкой во второй раз (У-78).
     *
     * Что сделано: вопрос очищен от того, что машине принадлежит, — подложка,
     * дошедшая до края ящика, считается нарушением только там, где
     * **написанное на той же зрительной строке до края не дошло**; и к падению
     * приложены числа, чтобы следующий прогон в CI назвал предмет, а не
     * количество.
     */
    const visualRowAt = (probe, band) => {
      const mid = (band.top + band.bottom) / 2;
      for (const row of probe.rows) {
        for (const vr of row.visualRows || []) {
          if (mid >= vr.top - 0.5 && mid <= vr.bottom + 0.5) return vr;
        }
      }
      return null;
    };
    /*
     * **Два разных ответа, и раньше они были одним** (У-173, правка
     * 2026-09-13). «Подложка убежала» и «зрительная строка под подложкой не
     * нашлась» — это находка и невозможность померить, а `visualRowAt`
     * отдавал `null` в обоих случаях, и `null` засчитывался нарушением.
     * Разойтись им есть на чём: строку он ищет попаданием середины подложки в
     * её вертикаль с допуском в полточки, а вертикаль считает машина. То есть
     * на чужом железе проверка могла назвать дефектом собственную слепоту — и
     * ровно это она сделала бы в CI, где до сих пор непонятно, что упало
     * (строка `Т5`).
     *
     * Теперь у каждого ответа своё сообщение. Оба роняют гейт: неизмеримое —
     * это не «сошлось».
     */
    const atEdge = wrapped.probe.bands.filter((b) => b.right > wrapped.contentRight - 0.5);
    const unmeasured = atEdge.filter((b) => !visualRowAt(wrapped.probe, b));
    const runaway = atEdge.filter((b) => {
      const vr = visualRowAt(wrapped.probe, b);
      return vr && !(vr.right > wrapped.contentRight - 0.5);
    });
    if (unmeasured.length) {
      bad("под подложкой не нашлось зрительной строки " + unmeasured.length
        + " раз(а): померить, дошло ли до края написанное, нечем — вертикали"
        + " строк и подложек разошлись."
        + " Подложки " + unmeasured.slice(0, 4).map((b) => "[" + b.left + "…" + b.right
          + " по вертикали " + b.top + "…" + b.bottom + "]").join(" ")
        + "; вертикали строк " + wrapped.probe.rows.map((r) => (r.visualRows || [])
          .map((v) => v.top + "…" + v.bottom).join(",")).join(" | "));
    }
    if (runaway.length) {
      /*
       * Числа при падении — не украшение. Прошлый прогон в CI сказал только
       * «1 раз(а)», и разбор пришлось делать догадкой; с этими строками
       * следующий назовёт, какой прямоугольник, где кончается написанное на
       * его зрительной строке и где край ящика (У-109).
       */
      const shown = runaway.slice(0, 4).map((b) => {
        const vr = visualRowAt(wrapped.probe, b);
        return "[" + b.left + "…" + b.right + " по вертикали " + b.top + "…" + b.bottom
          + "; написанное на строке кончается на " + (vr ? vr.right : "строка не нашлась") + "]";
      });
      bad("подложка дошла до правого края содержимого " + runaway.length
        + " раз(а) там, где написанное до края не дошло — перенесённый блок"
        + " нарисован выделением, а не по строкам."
        + " Край ящика " + wrapped.contentRight + "; " + shown.join(" "));
    }
    /*
     * Порог: у вопроса должен быть предмет (У-88). Строка, которая **и правда
     * переносится**, на странице одна, и без неё «выделения нет» выполнялось бы
     * отсутствием переноса — на машине с узким шрифтом строка уместилась бы в
     * одну зрительную, и проверка мерила бы пустоту.
     */
    const wrappedRows = wrapped.probe.rows.filter((r) => (r.visualRows || []).length > 1);
    if (!wrappedRows.length) {
      bad("ни одна строка страницы не переносится — предмета проверки про"
        + " перенесённый блок нет вовсе");
    } else {
      /*
       * **Подложки перенесённой строки стоят не на одной её зрительной
       * строке.** Прежде спрашивалось «на второй зрительной строке подложка
       * есть», и это было неверно дважды: на второй строке может лежать один
       * текст человека — подложке там взяться неоткуда, — а сама «вторая
       * строка» считалась по сломанной группировке рядов, где рядом объявлялся
       * каждый строчный ящик. Обещано другое: левый Block на своей строке,
       * правый на своей.
       */
      const rowsWithBands = wrappedRows.map((row) => {
        const rowBands = wrapped.probe.bands.filter((b) => b.top < row.rowTop + row.rowHeight - 1
          && b.bottom > row.rowTop + 1);
        const hosts = new Set();
        for (const b of rowBands) {
          const mid = (b.top + b.bottom) / 2;
          row.visualRows.forEach((v, i) => { if (mid > v.top - 2 && mid < v.bottom + 2) hosts.add(i); });
        }
        return { line: row.line, hosts: hosts.size, bands: rowBands.length };
      });
      const spread = rowsWithBands.filter((r) => r.hosts > 1);
      if (!spread.length) {
        bad("подложки каждой перенесённой строки собрались на одной её зрительной строке: "
          + rowsWithBands.map((r) => "строка " + r.line + " — рядов " + r.hosts
            + " при " + r.bands + " подложках").join("; "));
      }
      /*
       * **И каждая подложка перенесённой строки лежит на своей зрительной
       * строке, а не где придётся.** Его слова 2026-09-13: «полоска в left
       * block съезжает вниз». Прежде спрашивалось только «на второй строке
       * подложка есть»; это выполняется и тогда, когда **все** подложки строки
       * съехали на неё же.
       */
      for (const row of wrappedRows) {
        const rowBands = wrapped.probe.bands.filter((b) => b.top < row.rowTop + row.rowHeight - 1
          && b.bottom > row.rowTop + 1);
        for (const b of rowBands) {
          const mid = (b.top + b.bottom) / 2;
          const host = row.visualRows.filter((v) => mid > v.top - 2 && mid < v.bottom + 2);
          if (host.length !== 1) {
            bad("подложка перенесённой строки " + row.line + " не лежит ни на одной её"
              + " зрительной строке: " + b.top + "…" + b.bottom + " при рядах "
              + row.visualRows.map((v) => v.top + "…" + v.bottom).join(", "));
            continue;
          }
          const rowMid = (host[0].top + host[0].bottom) / 2;
          if (!near(mid, rowMid, 2.5)) {
            bad("подложка перенесённой строки " + row.line + " не по середине своего ряда: "
              + mid + " против " + rowMid);
          }
        }
      }
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
    /*
     * Строки **с блоками** и в одну зрительную строку. Седьмая строка страницы
     * разделителей не имеет вовсе — подложке там взяться неоткуда, и требовать
     * её значило бы требовать того, чего правило не обещает.
     */
    const singleRows = centred.rows.filter((r) => r.rowHeight < centred.lineHeight * 1.9
      && r.blockStart);
    /* Контроль к самому отбору: строк с блоками на странице большинство, и
       если их вдруг стало мало — молчать об этом нельзя (У-88). */
    if (singleRows.length < 4) {
      bad("строк с блоками для проверки середины осталось " + singleRows.length
        + " — отбор съел предмет, а не лишнее");
    }
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

    /* ---- 10. Размеры `Inline appearance` — про Blocks, а не про ваш текст -- */
    /*
     * Его слова 2026-09-12: «tags-text-size меняет высоту не только left и
     * right blocks, но и тегов между сепараторами… то, что внутри сепараторов,
     * изменяться от этой опции не должно». Пузырю размеры передавались
     * безусловно, и правило про зону знала только вторая отрисовка —
     * `buildBlockStyleCss` (У-159, правило 80).
     *
     * Мерит браузер: кегль и ящик каждого пузыря на своей зоне.
     */
    const zonesAt = async (patch) => page.evaluate(async (p) => {
      await window.__ioSetTags(p);
      return window.__ioBubblesByZone();
    }, patch);
    const smallZones = await zonesAt({ textSizePct: 100, bubbleHeightPct: 100, bubbleWidthPct: 100 });
    const bigZones = await zonesAt({ textSizePct: 140, bubbleHeightPct: 140, bubbleWidthPct: 140 });
    const pick = (rows, zone) => rows.filter((b) => b.zone === zone);
    /*
     * Порог до вывода (У-88): предмет обязан быть на странице. Пузырь в тексте
     * человека там ровно один — тот, ради которого заведена шестая строка.
     */
    if (!pick(smallZones, "middle").length) {
      bad("на странице нет ни одного пузыря между разделителями — правило"
        + " «размеры про Blocks» проверялось бы отсутствием предмета");
    } else if (!pick(smallZones, "left").length && !pick(smallZones, "right").length) {
      bad("на странице нет ни одного пузыря в Block — сравнивать середину не с чем");
    } else {
      const midSmall = pick(smallZones, "middle")[0];
      const midBig = pick(bigZones, "middle")[0];
      const blockSmall = pick(smallZones, "left")[0];
      const blockBig = pick(bigZones, "left")[0];
      /* Положительный контроль: в Block шкала и правда двигает пузырь. */
      if (!(blockBig.height >= blockSmall.height + 1)) {
        bad("положительный контроль: в Block пузырь на верху шкал не вырос ("
          + blockBig.height + " против " + blockSmall.height + ") — мерить нечего");
      }
      if (!(midBig.height > midSmall.height + 0.5)) {
        bad("ползунок высоты пузыря не дошёл до вашего текста: " + midBig.height
          + " против " + midSmall.height);
      }
      if (midBig.fontSize !== midSmall.fontSize) {
        bad("кегль пузыря между разделителями сменился с " + midSmall.fontSize
          + " на " + midBig.fontSize + " — `Text size` доехал до вашего текста");
      }
      /*
       * **А ширина и высота пузыря — доезжают**, и это его уточнение того же
       * дня: «да, должны. Не должен действовать только tags-text-size».
       * Поэтому предыдущее утверждение спрашивает кегль, а это — ящик.
       */
      if (!(midBig.width > midSmall.width + 0.5)) {
        bad("ползунки ширины пузыря не дошли до вашего текста: " + midBig.width
          + " против " + midSmall.width);
      }
    }
    /* ---- 10а. Тег без своего цвета: пузырь наш, вид темы --------------- */
    /*
     * Его слова 2026-09-12: «теги, у которых стоит дефолтный fill и text, не
     * подчиняются настройкам tag-appearance (высота и ширина пузырька не
     * изменилась и т.д.)». Пузырь такому тегу рисовала тема, и наши величины
     * до него не доезжали: они живут в нашем узле.
     *
     * Решение выбрал заказчик: рисует плагин, цвет берётся у темы. Здесь
     * спрашивается браузер — какой узел нарисован, каким фоном и растёт ли он
     * от шкалы.
     */
    const plainSmall = pick(smallZones, "left").find((b) => b.token === "#plain");
    const plainBig = pick(bigZones, "left").find((b) => b.token === "#plain");
    if (!plainSmall || !plainBig) {
      bad("тегу без своего цвета в Block пузырь не нарисован вовсе — настройки"
        + " размера до него по-прежнему не доезжают");
    } else {
      if (!(plainBig.height >= plainSmall.height + 1)) {
        bad("пузырь тега без цвета на верху шкал не вырос (" + plainBig.height
          + " против " + plainSmall.height + ") — настройки его не двигают");
      }
      if (/rgba\(0, 0, 0, 0\)|transparent/.test(String(plainSmall.background))) {
        bad("пузырь тега без цвета прозрачен («" + plainSmall.background
          + "») — акцентная заливка до него не доехала, и тег на странице пропал");
      }
      /*
       * **И главное его требование: «хочу, чтобы они были одинаковые».**
       * Пузырь без своего цвета и пузырь со своим стоят в одном Block, и
       * отличаться им можно только цветом: высота и поля обязаны совпасть.
       * Первая версия правки брала фон у переменной тега темы, и на его теме
       * (Minimal) она `transparent` — пузырь вышел невидимым.
       */
      const colouredSmall = pick(smallZones, "left").find((b) => b.token === "#todo");
      if (!colouredSmall) {
        bad("на странице нет пузыря со своим цветом в Block — сравнивать не с чем");
      } else {
        if (!near(plainSmall.height, colouredSmall.height, 0.05)) {
          bad("пузырь без своего цвета и пузырь со своим разной высоты: "
            + plainSmall.height + " против " + colouredSmall.height);
        }
        if (plainSmall.padTop !== colouredSmall.padTop
          || plainSmall.padLeft !== colouredSmall.padLeft) {
          bad("поля у двух пузырей разошлись: " + plainSmall.padTop + "/" + plainSmall.padLeft
            + " против " + colouredSmall.padTop + "/" + colouredSmall.padLeft);
        }
      }
      if (plainSmall.cursor !== "pointer") {
        bad("у пузыря тега указатель «" + plainSmall.cursor
          + "», а не указатель ссылки — по тегу не видно, что он щёлкается");
      }
    }
    /*
     * **Тег без цвета в вашем тексте между разделителями — тоже наш пузырь.**
     * Его слово 2026-09-12, второй заход: «все теги такой строки рисует
     * плагин». До этого там оставался разнобой — цветной тег рисовали мы, а
     * дефолтный тема, — и он принёс скриншот.
     */
    const bareMid = smallZones.find((b) => b.token === "#bare");
    const colouredMid = smallZones.find((b) => b.token === "#work" && b.zone === "middle");
    if (!bareMid) {
      bad("тег без цвета между разделителями пузыря не получил — в вашем тексте"
        + " остался разнобой: цветной рисуем мы, дефолтный тема");
    } else if (colouredMid) {
      if (!near(bareMid.height, colouredMid.height, 0.05)) {
        bad("в вашем тексте дефолтный и цветной теги разной высоты: "
          + bareMid.height + " против " + colouredMid.height);
      }
      if (bareMid.padTop !== colouredMid.padTop || bareMid.padLeft !== colouredMid.padLeft) {
        bad("в вашем тексте поля двух тегов разошлись: " + bareMid.padTop + "/" + bareMid.padLeft
          + " против " + colouredMid.padTop + "/" + colouredMid.padLeft);
      }
    }
    /*
     * **И граница, которую он провёл сам:** «обычные заметки без разделителей
     * плагин не трогает вовсе». Тег без цвета в такой строке остаётся тегом
     * темы; тег со своим цветом красится там по-прежнему — цвет значения виден
     * всюду, и отнимать его никто не просил.
     */
    /*
     * **Строка с одним разделителем — тоже наша.** Ровно её он и прислал
     * скриншотом: `📅… #123 || 1231 #авв #new`. Правило «есть хотя бы один
     * разделитель» на строках с двумя вхождениями неотличимо от «нужны оба» —
     * и проверка была бы слепа к подмене (У-147).
     */
    if (!smallZones.some((b) => b.token === "#single")) {
      bad("в строке с одним разделителем тег без цвета пузыря не получил —"
        + " строка с одним `||` перестала считаться строкой плагина");
    }
    if (!smallZones.some((b) => b.token === "#bare3")) {
      bad("в строке с одним разделителем правая часть осталась без пузыря");
    }
    if (smallZones.some((b) => b.token === "#bare2")) {
      bad("тег без цвета в строке без разделителей получил наш пузырь —"
        + " плагин полез в обычную заметку");
    }
    if (!smallZones.some((b) => b.token === "#todo" && b.zone === "middle")) {
      bad("положительный контроль: в строке без разделителей нет ни одного нашего"
        + " пузыря — значит «дефолтного нет» выполняется тем, что слой туда не дошёл вовсе");
    }
    await page.evaluate(async () => {
      await window.__ioSetTags({ textSizePct: 80, bubbleHeightPct: 80, bubbleWidthPct: 80 });
    });

    /* ---- 11. Оверлей скроллера TagWheel ------------------------------- */
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
