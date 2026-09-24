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
 * **Что проверяется.** Что сессия живёт и доезжает до экрана: панель
 * открывается, человек её видит, стрелка меняет показанное, оверлей скроллера
 * нарисован и стоит у своей строки, `Esc` возвращает документ в исходное.
 *
 * **И то, ради чего страница заведена** (переезд сделан 2026-09-13): полоса
 * встаёт **рядом** со значениями, а не вместо них. Отсюда четыре утверждения,
 * которых прежде не было и которые прежней панели были бы красными: строка
 * человека во время сессии цела и только выросла; часть её спрятана
 * оформлением, то есть на экране прежняя картинка; значение противоположного
 * Block с экрана ушло; `Ctrl+Z` после применения возвращает ровно то, с чего
 * человек начал.
 */

const { openPanel, PANEL_INJECTIONS, SCROLLER_CUSTOM_TEXT, CUSTOM_VALUE } = require("./panel_harness.js");

/* Значение, которое панель закрывает собой на строке страницы: оно стоит в
   противоположном Block и на экране появиться не должно. Берётся из той же
   фикстуры, что и строки, — литерал здесь разошёлся бы с ней молча. */
const HIDDEN_VALUE = "👤111";

const injection = process.argv[2] || "";
const problems = [];
function bad(message) { problems.push(message); }

/** Строка `a` встречается в `b` в том же порядке: то есть `b` — это `a` со вставками. */
function isSubsequence(a, b) {
  let i = 0;
  for (let j = 0; j < b.length && i < a.length; j++) if (b[j] === a[i]) i += 1;
  return i === a.length;
}

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
      /*
       * **Чем подписаны строки коробки** — его заказ 2026-09-20. Страница
       * открывает режим `custom` и даёт свой текст одному значению из двух.
       * Спрашиваются обе половины: заданный текст на экране есть, а значение
       * без своего текста осталось написанным. Без второй половины зелёным
       * было бы и «подписывать всё своим текстом».
       */
      const texts = Array.isArray(stepped.overlayTexts) ? stepped.overlayTexts : [];
      if (texts.indexOf(SCROLLER_CUSTOM_TEXT) === -1) {
        bad("режим подписей `custom` до коробки не доехал: строки " + JSON.stringify(texts));
      }
      if (!texts.some((t) => /^#/.test(String(t || "")))) {
        bad("значение без своего текста перестало быть написанным: " + JSON.stringify(texts));
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

    /* ---- 6. Строка человека цела, и только выросла --------------------- */
    if (!(stepped.lineText.length > before.lineText.length)) {
      bad("строка во время сессии не выросла: «" + stepped.lineText
        + "» — полоса всё ещё встаёт на место значений, а не рядом");
    }
    if (!isSubsequence(before.lineText, stepped.lineText)) {
      bad("строка человека во время сессии порвана: из «" + before.lineText
        + "» получилось «" + stepped.lineText + "» — это не одна вставка");
    }

    /* ---- 7. Лишнее спрятано, то есть на экране прежняя картинка -------- */
    if (!(stepped.hiddenChars > 0)) {
      bad("маска ничего не спрятала: человек видит и полосу, и значения, которые она закрывает");
    }
    if (String(stepped.lineDrawn || "").indexOf(HIDDEN_VALUE) >= 0) {
      bad("значение противоположного Block видно на экране: «" + stepped.lineDrawn + "»");
    }

    /* ---- 7а. Соседний слой на разорванном окне отрисовки --------------- */
    /*
     * **Маска панели рвёт отрисованное окно, и платит за это сосед.**
     * CodeMirror считает окно по декорациям состояния и режет его там, где
     * стоит замена длиной от двадцати знаков. Маска — единственная такая
     * замена в плагине, и на строке, где в противоположном Block значений
     * набралось на два десятка знаков, кусков окна становится два. Каждый слой,
     * который ходит по строкам, проходит такую строку дважды — и рисует на ней
     * всё по два раза. Заказчик увидел это кнопкой: «при наличии values в left
     * block при открытии tagwheel right я вижу две кнопки i2n-floating».
     *
     * Порядок здесь обязателен: сперва **условие** (окно и правда разорвано),
     * потом утверждение. Без первого «кнопка одна» было бы правдой от того, что
     * рвать окно было нечем (У-143).
     */
    const torn = await page.evaluate(async () => {
      await window.__ioPanelKey("Escape");
      return window.__ioPanelOpen("right", 2);
    });
    if (!torn.active) {
      bad("панель не открылась на строке с длинным противоположным Block"
        + (torn.said.length ? ", и сказала: " + JSON.stringify(torn.said) : ""));
    } else if (!(torn.viewportPieces > 1)) {
      bad("окно отрисовки не разорвалось (кусков " + torn.viewportPieces
        + ") — значит проверять на этой строке нечего: маска прячет мало");
    } else {
      /*
       * **Пока панель открыта, кнопки на строке нет вовсе** — его слово
       * 2026-09-13. Считается она на **той же** строке и тем же прогоном, что
       * и разрыв окна: ноль здесь обязан быть от правила, а не от того, что
       * кнопку нечем нарисовать, — поэтому ниже, после `Esc`, спрашивается
       * обратное (У-113).
       */
      if (torn.flyOnLine !== 0) {
        bad("во время сессии панели на строке плавающих кнопок `→` " + torn.flyOnLine
          + ", а не должно быть ни одной: нарисовано «" + torn.lineDrawn + "»");
      }
      /*
       * Кнопка — слой, которым дефект нашли; спрашивается он у **всех**, кто
       * ходит по строкам (У-159). У подложки Blocks второй проход даёт
       * прямоугольник, ложащийся на первый до точки: глазами его не видно, а
       * счёт видит.
       */
      if (torn.bandTwins > 0) {
        bad("подложек Blocks, стоящих ровно на своей копии, " + torn.bandTwins
          + " — слой прошёл строку дважды");
      }
    }
    /*
     * **Контроль к предыдущему нулю:** сессия закрыта, курсор на той же
     * строке — кнопка обязана вернуться. Без него «кнопок ноль» было бы
     * правдой и при выключенном тумблере, и при кнопке, снятой совсем.
     */
    const closed = await page.evaluate(() => window.__ioPanelKey("Escape"));
    if (closed.flyTotal !== 1) {
      bad("после закрытия панели плавающих кнопок `→` на странице " + closed.flyTotal
        + ", а должна быть одна — значит ноль во время сессии ничего не доказывает");
    }

    /* ---- 8. `Esc` возвращает документ человека ------------------------- */
    const done = await page.evaluate(async () => {
      await window.__ioPanelOpen("left", 0);
      await window.__ioPanelKey("ArrowUp");
      return window.__ioPanelKey("Escape");
    });
    if (done.active) bad("после `Esc` сессия осталась открытой");
    if (!done.docUnchanged) {
      bad("после `Esc` документ не вернулся к исходному: «" + done.doc
        + "» вместо «" + done.startDoc + "»");
    }

    /* ---- 9. `Ctrl+Z` после применения — то самое нажатие заказчика ----- */
    const applied = await page.evaluate(async () => {
      await window.__ioPanelOpen("left", 0);
      await window.__ioPanelKey("ArrowUp");
      await window.__ioPanelKey("Enter");
      return window.__ioPanelProbe();
    });
    if (applied.active) bad("после `Enter` сессия осталась открытой");
    if (applied.docUnchanged) {
      bad("после применения документ не изменился — применять было нечего, и `Ctrl+Z` проверять не на чем");
    }
    const undone = await page.evaluate(() => window.__ioPanelUndo());
    if (!undone.unchanged) {
      bad("`Ctrl+Z` после панели вернул не то, с чего человек начал: «" + undone.doc
        + "» вместо «" + applied.startDoc + "»");
    }

    /* ---- 10. Третье положение подписей коробки ------------------------ */
    /*
     * `Custom+Default name` — его слово 2026-09-21, вечер: «добавь опцию
     * `Custom+Default`, чтобы работал как `panel-value-names=Custom+Default
     * name` (т.е. чтобы в скроллере тоже было видно `💡#idea`)».
     *
     * От второго положения оно отличается ровно тем, что рядом со своим
     * текстом стоит написанное, и спрашивается это **на том значении, у
     * которого свой текст задан**: там, где своего текста нет, все три
     * положения печатают одно и то же, и утверждение было бы зелёным от
     * совпадения сторон (У-147). Вторая половина — то самое значение без
     * своего текста: оно обязано остаться написанным.
     */
    const both = await page.evaluate(async () => {
      await window.__ioPanelKey("Escape");
      window.__ioPanelScrollerLabels("both");
      await window.__ioPanelOpen("left", 0);
      return window.__ioPanelKey("ArrowUp");
    });
    const bothTexts = Array.isArray(both.overlayTexts) ? both.overlayTexts : [];
    const paired = bothTexts.filter((t) => String(t || "").indexOf(SCROLLER_CUSTOM_TEXT) === 0);
    if (!paired.length) {
      bad("в положении `Custom+Default name` своего текста в коробке нет вовсе: "
        + JSON.stringify(bothTexts));
    } else if (!/^\S+\s+\S/.test(paired[0])) {
      bad("в положении `Custom+Default name` рядом со своим текстом нет написанного значения: "
        + JSON.stringify(paired));
    }
    if (!bothTexts.some((t) => /^#/.test(String(t || "")))) {
      bad("значение без своего текста в положении `Custom+Default name` перестало быть написанным: "
        + JSON.stringify(bothTexts));
    }

    /* ---- 11. `Alt` — переключатель (`З-36`, его слово 2026-09-23) ------- */
    /*
     * Его слово: «первое нажатие открывает sub-field активного field, второе
     * нажатие закрывает его». Видимость поля спрашивает Node
     * (`runAltChildSuite`); здесь — только то, до чего Node не достаёт:
     * настоящие события окна доезжают до панели. Одиночное нажатие открывает
     * и держится без клавиши; второе закрывает; `Alt` вместе с другой
     * клавишей — это хоткей (у него `Alt+↑` занят командой), и поле он не
     * трогает.
     */
    const alt = await page.evaluate(async () => {
      const down = await window.__ioPanelKey("Alt");
      const tapped = await window.__ioPanelKeyUp("Alt");
      /* Клавиша, которая с поля не уводит: уход закрывает нажатие (ниже). */
      const after = await window.__ioPanelKey("ArrowUp");
      await window.__ioPanelKey("Alt");
      const closed = await window.__ioPanelKeyUp("Alt");
      await window.__ioPanelKey("Alt");
      await window.__ioPanelKey("ArrowUp");
      const chord = await window.__ioPanelKeyUp("Alt");
      return { opened: down.active, down: down.altOpen, tapped: tapped.altOpen, after: after.altOpen,
        closed: closed.altOpen, chord: chord.altOpen, active: chord.active };
    });
    if (!alt.opened) bad("сессии нет — `Alt` проверять не на чем");
    if (!alt.active) bad("`Alt` закрыл сессию панели, а должен был только открыть дочернее поле");
    if (alt.down) bad("поле открылось на нажатии `Alt`, а не на отпускании: `Alt+↑` открывал бы его");
    if (!alt.tapped) bad("одиночное нажатие `Alt` не открыло дочернее поле");
    if (!alt.after) bad("открытое `Alt` поле закрылось следующей клавишей, а должно держаться до второго `Alt`");
    if (alt.closed) bad("второе нажатие `Alt` не закрыло дочернее поле");
    if (alt.chord) bad("`Alt` вместе со стрелкой открыл поле, а это хоткей человека");

    /*
     * Его замечание 2026-09-23 к тесту 3: нажал `Alt` на поле, ушёл `←` на
     * другое и вернулся `→` — дочернее поле «не возникало, т.е. мне нужно было
     * бы повторно нажать alt». Нажатие принадлежит полю, у которого его
     * сделали. Контроль «открылось» стоит первым: без него «закрыто» верно и
     * у панели, где `Alt` не работает вовсе (У-152).
     */
    const back = await page.evaluate(async () => {
      await window.__ioPanelKey("Alt");
      const opened = await window.__ioPanelKeyUp("Alt");
      const away = await window.__ioPanelKey("ArrowLeft");
      const returned = await window.__ioPanelKey("ArrowRight");
      return { opened: opened.altOpen, at: opened.activeFieldId, away: away.activeFieldId,
        back: returned.activeFieldId, open: returned.altOpen };
    });
    if (!back.opened) bad("`Alt` не открыл дочернее поле — проверять возврат не на чем");
    else if (back.away === back.at) bad("`←` не увёл курсор с поля `" + back.at + "` — возврат не проверен");
    else if (back.back !== back.at) bad("`→` не вернул курсор на `" + back.at + "`, а поставил на `" + back.back + "`");
    else if (back.open) bad("ушёл с поля `" + back.at + "` на `" + back.away + "` и вернулся — дочернее поле открылось снова без `Alt`");

    /* ---- 12. Custom block: панель у каретки посреди строки (PRD 10.13.260) --
     *
     * Каретка ставится **после `1231`**, в середину текста, и спрашивается то,
     * чего Left/Right не делают: полоса стоит у каретки, а не в зоне Block;
     * `Hide` прячет значение правого Block; `Enter` вставляет выбранное между
     * словами одной ступенью, и `Ctrl+Z` возвращает строку, с которой начали.
     * Контроль «открылось» первым (У-152). */
    const custom = await page.evaluate(async () => {
      await window.__ioPanelKey("Escape");
      const line0 = window.__ioPanelProbe().lineText;
      const at = line0.indexOf("1231") + 4;
      const opened = await window.__ioPanelOpenCustom(0, at);
      const stepped2 = await window.__ioPanelKey("ArrowUp");
      const applied2 = await window.__ioPanelKey("Enter");
      const undone2 = await window.__ioPanelUndo();
      return { line0, opened, stepped: stepped2, applied: applied2, undone: undone2 };
    });
    if (!custom.opened.active) {
      bad("панель custom block не открылась" + (custom.opened.said.length
        ? ", и сказала: " + JSON.stringify(custom.opened.said) : ", и промолчала"));
    } else {
      const drawn = String(custom.opened.lineDrawn || "");
      if (!/1231\s*\*\*\[Mood\]\*\*/.test(drawn.replace(/==/g, ""))) {
        bad("полоса custom block не встала у каретки после `1231`: «" + drawn + "»");
      }
      if (drawn.indexOf(HIDDEN_VALUE) >= 0) {
        bad("`Hide` не спрятал значение правого Block при панели custom block: «" + drawn + "»");
      }
      const want = custom.line0.replace("1231", "1231 #" + CUSTOM_VALUE);
      if (custom.applied.lineText !== want) {
        bad("`Enter` custom block записал «" + custom.applied.lineText + "» вместо «" + want + "»");
      }
      if (!custom.undone.unchanged) {
        bad("`Ctrl+Z` после custom block вернул «" + custom.undone.doc + "», а не исходную строку");
      }
    }

    if (pageErrors.length) bad("страница ругается: " + pageErrors.slice(0, 3).join(" ;; "));

    if (problems.length) {
      for (const p of problems) console.log("FAIL  " + p);
      process.exit(1);
    }
    console.log("  сессия открылась, нарисовано «" + open.lineDrawn
      + "», спрятано знаков " + stepped.hiddenChars + ", оверлей "
      + (stepped.overlayBox ? stepped.overlayBox.width + "×" + stepped.overlayBox.height : "нет")
      + " на " + stepped.overlayRows + " строк " + JSON.stringify(stepped.overlayTexts)
      + ", Ctrl+Z вернул исходное; окно"
      + " отрисовки на строке с длинным Block порвано на " + torn.viewportPieces
      + ", подложек " + torn.bandTotal + " и ни одной вдвойне, кнопки `→` при"
      + " открытой панели нет и после закрытия она вернулась; в положении"
      + " `Custom+Default name` коробка печатает " + JSON.stringify(bothTexts)
      + "; custom block у каретки нарисован «" + custom.opened.lineDrawn + "», Enter дал «"
      + custom.applied.lineText + "», Ctrl+Z вернул исходное");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(3);
});
