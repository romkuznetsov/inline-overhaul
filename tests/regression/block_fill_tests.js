"use strict";
/**
 * Заливка Left и Right Block (задача заказчика З-7, 2026-09-08).
 *
 * Заказчик: «хочу добавить опцию, чтобы left and right blocks можно было
 * добавить цветовую заливку (до сепаратора и после сепаратора)… должна
 * начинаться в left block (от первого value до сепаратора1) и right block (от
 * сепаратора2 до последнего value)… Если values left\\right block отсутствуют,
 * то эта подложка не должна появляться». Способ рисования он выбрал сам: свой
 * слой прямоугольников за текстом.
 *
 * **Что здесь проверяется и что нет.** Наша половина — какие отрезки красить и
 * какими правилами их красить; её и проверяем на настоящих функциях плагина.
 * Платформенная половина — где эти отрезки на экране: её считает
 * `RectangleMarker.forRange` самого CodeMirror, и подделывать редактор ради
 * неё значило бы проверять подделку (У-1).
 */

const path = require("path");
const visuals = require(path.join(__dirname, "..", "..", "src", "core", "editor_visuals_config.js"));
const decorations = require(path.join(__dirname, "..", "..", "src", "ui", "editor", "decorations.js"));

function assertEq(actual, expected, name) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${name}: expected ${e} got ${a}`);
}

function assertTrue(value, name) {
  if (!value) throw new Error(`${name}: expected truthy`);
}

/* ---- границы подложки -------------------------------------------------- */

/*
 * Строка ровно того вида, о котором он писал:
 *
 *   - #/1 #todo || мой текст || 📅2026-09-01 [[Проект]]
 *     0123456789…
 */
const SEP = "||";
const LINE = "- #/1 #todo || my text || \u{1F4C5}2026-09-01 [[Project]]";
const MARKERS = [{ marker: "\u{1F4C5}", tail: "\\d{4}-\\d{2}-\\d{2}" }];

(function testBandRunsFromFirstValueToLast() {
  const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
  assertEq(spans.map(s => s.zone), ["left", "right"], "стороны обе, и в этом порядке");

  const left = spans[0];
  assertEq(LINE.slice(left.start, left.end), "#/1 #todo",
    "слева подложка идёт от первого значения до последнего");
  const right = spans[1];
  assertEq(LINE.slice(right.start, right.end), "\u{1F4C5}2026-09-01 [[Project]]",
    "справа — от первого значения после разделителя до последнего");
})();

(function testBandStopsBeforeTheSeparator() {
  const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
  const i1 = LINE.indexOf(SEP);
  const i2 = LINE.lastIndexOf(SEP);
  assertTrue(spans[0].end < i1, "левая подложка кончается до первого разделителя");
  assertTrue(spans[1].start > i2 + SEP.length - 1, "правая начинается после второго");
  assertTrue(LINE.slice(spans[0].end, i1).trim() === "",
    "между подложкой и разделителем только пробел: сам разделитель не закрашен");
})();

(function testEmptyBlockGetsNoBand() {
  /* Его условие дословно: значений в блоке нет — подложки нет. */
  const onlyRight = "- || my text || #done";
  const spans = visuals.blockFillSpansInLine(onlyRight, SEP, SEP, MARKERS);
  assertEq(spans.map(s => s.zone), ["right"], "пустой левый блок подложки не получает");

  const noValues = "- || my text ||";
  assertEq(visuals.blockFillSpansInLine(noValues, SEP, SEP, MARKERS), [],
    "нет значений ни там ни там — нет и подложки");

  const plain = "просто строка без разделителей";
  assertEq(visuals.blockFillSpansInLine(plain, SEP, SEP, MARKERS), [],
    "строка без разделителей: всё в ней — текст человека, а не блок");
})();

(function testYourTextIsNeverPainted() {
  /*
   * В тексте человека **есть свой тег** — так он и пишет: `#idea` посреди
   * фразы. Без него средняя зона в фикстуре пуста, и «красим только блоки»
   * было бы верно по отсутствию предмета (У-47).
   */
  const withOwnTag = "- #/1 " + SEP + " my #idea text " + SEP + " #done";
  const spans = visuals.blockFillSpansInLine(withOwnTag, SEP, SEP, MARKERS);
  assertEq(spans.map(s => s.zone), ["left", "right"],
    "тег внутри текста человека своей стороны не образует");
  const i1 = withOwnTag.indexOf(SEP);
  const i2 = withOwnTag.lastIndexOf(SEP);
  const own = withOwnTag.indexOf("#idea");
  for (const span of spans) {
    assertTrue(span.end <= i1 || span.start >= i2,
      "ни один отрезок не заходит в текст между разделителями");
    assertTrue(own < span.start || own >= span.end,
      "тег человека внутри его текста подложкой не закрашен");
  }
})();

/* ---- что об этом говорит конфиг ---------------------------------------- */

(function testLookFromConfig() {
  const off = visuals.blockFillLookFromConfig({});
  assertEq(off.enabled, false, "по умолчанию выключено: это новая настройка");
  assertEq(off.opacity, visuals.BLOCK_FILL_DEFAULT_OPACITY_PCT / 100,
    "густота по умолчанию — та же, что в схеме");
  assertEq(off.color, "", "цвет по умолчанию пуст: значит «взять у темы»");

  const on = visuals.blockFillLookFromConfig({
    visual: { tags: { blockFill: { enabled: true, color: "#123456", opacity: 40 } } },
  });
  assertEq(on.enabled, true, "тумблер читается");
  assertEq(on.color, "#123456", "цвет читается");
  assertEq(on.opacity, 0.4, "проценты превращаются в долю");

  const junk = visuals.blockFillLookFromConfig({
    visual: { tags: { blockFill: { enabled: true, color: "не цвет", opacity: 900 } } },
  });
  assertEq(junk.color, "", "не цвет — значит цвета нет, а не мусор в стилях");
  assertEq(junk.opacity, 1, "густота выше ста прижимается к ста");
})();

(function testStyleRules() {
  assertEq(visuals.buildBlockFillStyleCss({ enabled: false }), "",
    "выключено — правил нет вовсе, и слой ничего не красит");

  const css = visuals.buildBlockFillStyleCss({ enabled: true, color: "#123456", opacity: 0.4 });
  assertTrue(css.indexOf("background-color: #123456;") >= 0, "цвет доезжает до правил");
  assertTrue(css.indexOf("opacity: 0.4;") >= 0, "и густота тоже");
  assertTrue(css.indexOf(visuals.BLOCK_FILL_MARKER_CLASS) >= 0,
    "правило адресует прямоугольник, а не слой целиком");

  const themed = visuals.buildBlockFillStyleCss({ enabled: true, color: "", opacity: 0.1 });
  assertTrue(themed.indexOf("var(--text-accent)") >= 0,
    "цвета нет — берётся тема, и это сказано переменной, а не литералом (З6)");
})();

/* ---- отрезки в документе ----------------------------------------------- */

/** Документ в том виде, в каком его читает слой: только то, что он зовёт. */
function fakeView(lines) {
  const starts = [];
  let at = 0;
  for (const text of lines) {
    starts.push(at);
    at += text.length + 1;
  }
  const doc = {
    line: (n) => ({ number: n, from: starts[n - 1], text: lines[n - 1] }),
    lineAt: (pos) => {
      let n = 1;
      for (let i = 0; i < starts.length; i++) if (starts[i] <= pos) n = i + 1;
      return { number: n, from: starts[n - 1], text: lines[n - 1] };
    },
  };
  return { state: { doc }, visibleRanges: [{ from: 0, to: at }] };
}

function fakePlugin(blockFill) {
  return {
    getConfig: () => ({
      pkm: { lineFormat: { separator1: SEP, separator2: SEP } },
      visual: { tags: { blockFill } },
    }),
  };
}

(function testDocRangesCountFromLineStart() {
  const lines = ["первая строка", LINE];
  const view = fakeView(lines);
  const ranges = decorations.blockFillDocRanges(view, fakePlugin({ enabled: true, opacity: 12 }));
  assertEq(ranges.length, 2, "две стороны второй строки");
  const base = lines[0].length + 1;
  const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, []);
  assertEq(ranges[0].from - base, spans[0].start, "отрезок отсчитан от начала своей строки");
  assertEq(ranges[0].to - base, spans[0].end, "и кончается там же, где кончается блок");
})();

(function testNothingWhenTurnedOff() {
  const view = fakeView([LINE]);
  assertEq(decorations.blockFillDocRanges(view, fakePlugin({ enabled: false })), [],
    "тумблер выключен — красить нечего");
  assertEq(decorations.blockFillDocRanges(view, { getConfig: () => null }), [],
    "конфига нет — тоже нечего, и это не падение");
})();

/* ---- нормализация конфига ---------------------------------------------- */

/*
 * Границы слайдера соблюдает не панель, а нормализация: рукописный `data.json`
 * иначе уехал бы за шкалу, и правило стилей получило бы `opacity: 9`.
 */
(function testOpacityIsClamped() {
  const normalize = require(path.join(__dirname, "..", "..", "src", "core", "config_normalize.js"));
  const out = normalize.migrateConfig({
    schemaVersion: 2,
    visual: { tags: { blockFill: { enabled: true, color: "#123456", opacity: 900 } } },
  });
  const band = out.visual.tags.blockFill;
  assertEq(band.opacity, 100, "густота выше ста прижимается к ста");
  assertEq(band.enabled, true, "тумблер переживает нормализацию");
  assertEq(band.color, "#123456", "и цвет тоже");

  const junk = normalize.migrateConfig({
    schemaVersion: 2,
    visual: { tags: { blockFill: { color: "не цвет", opacity: -50 } } },
  }).visual.tags.blockFill;
  assertEq(junk.opacity, 0, "густота ниже нуля прижимается к нулю");
  assertEq(junk.color, "", "не цвет становится пустотой, а не мусором в стилях");
  assertEq(junk.enabled, false, "умолчание тумблера — выключено");
})();

/* ====================================================================== */
/* Замечание заказчика по S7 (2026-09-09): подложка меньше написанного и    */
/* разъезжается на переносе строки                                         */
/* ====================================================================== */

/*
 * Три вещи в одном замечании, и первые две — одна причина.
 *
 *   1. «если символов в block мало (например, стоит 1 тег), то полоска не
 *      появляется (либо она появляется но сливается с пузырьками тегов)»;
 *   2. «хочу, чтобы была настройка высоты и ширины этой полосы… в крайнем
 *      правом положении она должна границей достигать начала сепаратора (и
 *      быть зеркальной с обратной стороны этого block)»;
 *   3. «если right block переносится на другую строку… полоска на первой
 *      строке идёт до границы экрана вправо, а на следующей начинается от
 *      левой границы экрана».
 *
 * Первое **не** значит, что отрезка нет: он есть, и проверка ниже это
 * показывает. Прямоугольник ложился ровно по написанному, а у пузыря тега свой
 * непрозрачный цвет — блок из одного тега закрывал подложку целиком. То есть
 * первое лечится вторым, и умолчания обеих новых величин больше нуля.
 */

(function testOneTokenBlockDoesGetASpan() {
  /*
   * Предмет правила «мало символов» в прежней фикстуре отсутствовал: в ней у
   * каждой стороны по два значения (У-113). Здесь блок ровно из одного тега.
   */
  const one = "- #todo " + SEP + " my text " + SEP + " #done";
  const spans = visuals.blockFillSpansInLine(one, SEP, SEP, MARKERS);
  assertEq(spans.map(s => one.slice(s.start, s.end)), ["#todo", "#done"],
    "блок из одного значения отрезок получает: невидим он был, а не отсутствовал");
  assertEq(spans[0].parts.length, 1, "и часть у него одна");
})();

(function testDefaultsMakeTheBandVisible() {
  /* Умолчание, при котором функция невидима, — не умолчание. */
  const look = visuals.blockFillLookFromConfig({
    visual: { tags: { blockFill: { enabled: true } } },
  });
  assertTrue(look.heightPx > 0, "высота по умолчанию больше нуля: иначе подложку закроет пузырь");
  assertTrue(look.widthPct > 0, "и ширина тоже");
  assertEq(look.heightPx, visuals.BLOCK_FILL_DEFAULT_HEIGHT_PX, "и это умолчание из схемы");
  assertEq(look.widthPct, visuals.BLOCK_FILL_DEFAULT_WIDTH_PCT, "и это тоже");
})();

(function testGrowthReadFromConfig() {
  const look = visuals.blockFillLookFromConfig({
    visual: { tags: { blockFill: { enabled: true, heightPx: 7, widthPct: 25 } } },
  });
  assertEq(look.heightPx, 7, "высота читается");
  assertEq(look.widthPct, 25, "ширина читается");

  const junk = visuals.blockFillLookFromConfig({
    visual: { tags: { blockFill: { enabled: true, heightPx: 900, widthPct: -3 } } },
  });
  assertEq(junk.heightPx, 10, "высота выше шкалы прижимается к её верху");
  assertEq(junk.widthPct, 0, "ширина ниже нуля прижимается к нулю");

  const words = visuals.blockFillLookFromConfig({
    visual: { tags: { blockFill: { enabled: true, heightPx: "три", widthPct: null } } },
  });
  assertEq(words.heightPx, visuals.BLOCK_FILL_DEFAULT_HEIGHT_PX,
    "не число — значит умолчание, а не NaN в стилях");
  assertEq(words.widthPct, visuals.BLOCK_FILL_DEFAULT_WIDTH_PCT, "то же и у ширины");
})();

/* ---- промежуток до разделителя: та мера, которой мерят ширину ---------- */

(function testGapBoundsPointAtTheSeparator() {
  const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
  const at = visuals.lineSeparatorBounds(LINE, SEP, SEP);

  const left = spans[0];
  assertEq(left.gapFrom, left.end, "слева промежуток начинается там, где кончился блок");
  assertEq(left.gapTo, at.first, "и кончается на первом разделителе");
  assertEq(LINE.slice(left.gapFrom, left.gapTo), " ",
    "между ними только пробел — его ширина и есть шкала ширины подложки");

  const right = spans[1];
  assertEq(right.gapFrom, at.lastEnd, "справа промежуток начинается за вторым разделителем");
  assertEq(right.gapTo, right.start, "и кончается там, где начался блок");
  assertEq(LINE.slice(right.gapFrom, right.gapTo), " ", "и здесь тоже пробел");
})();

(function testNoGapWhenBlockTouchesTheSeparator() {
  /*
   * Пробела между блоком и разделителем нет вовсе — законный случай, и расти
   * подложке тогда некуда. Предмет создан нарочно: в остальных примерах
   * пробел есть везде (У-113).
   */
  const tight = "- #todo" + SEP + " my text " + SEP + "#done";
  const spans = visuals.blockFillSpansInLine(tight, SEP, SEP, MARKERS);
  assertEq(spans.map(s => s.zone), ["left", "right"], "стороны на месте");
  for (const span of spans) {
    assertEq(span.gapFrom, -1, "промежутка нет, и он назван отсутствующим, а не пустым");
    assertEq(span.gapTo, -1, "с обеих сторон");
  }
})();

(function testSeparatorBoundsAreOneRule() {
  /*
   * Слева берётся **первое** вхождение, справа **последнее**, и при
   * одинаковых разделителях это разные места. Правило одно на зону токена и на
   * промежуток: второй такой же поиск разошёлся бы с этим молча (У-32).
   */
  const at = visuals.lineSeparatorBounds(LINE, SEP, SEP);
  assertEq(at.first, LINE.indexOf(SEP), "первый разделитель — первое вхождение");
  assertEq(at.last, LINE.lastIndexOf(SEP), "последний — последнее");
  assertTrue(at.first < at.last, "и на этой строке это разные места");
  assertEq(at.firstEnd, at.first + SEP.length, "конец первого посчитан по его длине");
  assertEq(at.lastEnd, at.last + SEP.length, "и конец последнего тоже");

  const none = visuals.lineSeparatorBounds("строка без разделителей", SEP, SEP);
  assertEq(none.first, -1, "нет разделителя — нет и места");
  assertEq(none.firstEnd, -1, "и конца у него нет, а не ноль");
})();

/* ---- на сколько подложка выходит за написанное ------------------------- */

(function testPadXIsAShareOfTheGap() {
  assertEq(visuals.blockFillPadXPx({ widthPct: 100 }, 8), 8,
    "сотня — вплотную к разделителю: весь промежуток");
  assertEq(visuals.blockFillPadXPx({ widthPct: 50 }, 8), 4, "половина — половина промежутка");
  assertEq(visuals.blockFillPadXPx({ widthPct: 0 }, 8), 0, "ноль — подложка кончается на написанном");

  /* Промежутка нет или его нечем измерить — расти некуда, и это не догадка. */
  assertEq(visuals.blockFillPadXPx({ widthPct: 100 }, 0), 0, "промежутка нет — нет и роста");
  assertEq(visuals.blockFillPadXPx({ widthPct: 100 }, -5), 0, "отрицательный промежуток не бывает ростом");
  assertEq(visuals.blockFillPadXPx({ widthPct: 100 }, NaN), 0, "неизмеренный промежуток тоже");
  assertEq(visuals.blockFillPadXPx({}, 8), 0, "настройки нет — роста нет");

  /*
   * Верхняя граница держится и здесь, а не только нормализацией: рукописный
   * `data.json` мимо панели дал бы подложку на пол-экрана.
   */
  assertEq(visuals.blockFillPadXPx({ widthPct: 400 }, 8), 8,
    "выше сотни всё равно вплотную к разделителю, а не за него");
})();

/* ---- перенос строки: по куску на зрительную строку --------------------- */

(function testPartsGroupByVisualLine() {
  const parts = [
    { from: 10, to: 15 },
    { from: 16, to: 22 },
    { from: 23, to: 30 },
  ];

  /* Всё на одной строке — одна группа от первого значения до последнего. */
  assertEq(visuals.blockFillGroupPartsByLine(parts, [100, 100, 100]),
    [{ from: 10, to: 30, top: 100 }],
    "части на одной зрительной строке дают один прямоугольник");

  /*
   * Перенос: третья часть уехала. Его слова — «на следующей строке начиналась
   * от начала первого перенесённого элемента до конца последнего».
   */
  assertEq(visuals.blockFillGroupPartsByLine(parts, [100, 100, 120]),
    [{ from: 10, to: 22, top: 100 }, { from: 23, to: 30, top: 120 }],
    "перенесённое встаёт своим прямоугольником от своего начала до своего конца");

  /* Доли точки — та же строка: надстрочные знаки дают разницу в дробях. */
  assertEq(visuals.blockFillGroupPartsByLine(parts, [100, 100.2, 100.1]),
    [{ from: 10, to: 30, top: 100 }],
    "разница в доли точки — это по-прежнему одна строка");

  /* Неизмеренное встаёт своей группой: догадка хуже лишнего прямоугольника. */
  assertEq(visuals.blockFillGroupPartsByLine(parts, [100, null, 100]),
    [{ from: 10, to: 15, top: 100 }, { from: 16, to: 22, top: null }, { from: 23, to: 30, top: 100 }],
    "часть без измерения не приклеивается к соседям");

  /* Пустая часть в группировку не попадает вовсе. */
  assertEq(visuals.blockFillGroupPartsByLine([{ from: 5, to: 5 }], [100]), [],
    "часть нулевой длины прямоугольника не образует");
})();

/* ---- прямоугольники: что уходит платформе и что возвращается ----------- */

/*
 * Здесь **подделана ровно платформенная половина** и она названа (У-1):
 * `RectangleMarker.forRange` меряет положение на экране кодом самого
 * CodeMirror, и позвать его вне окна нечем. Подделка запоминает, какие
 * отрезки ей отдали, и отдаёт заранее известные прямоугольники.
 *
 * Проверяется при этом **наша** половина, и обе её части:
 *
 *   * платформе уходят только отрезки, целиком лежащие на одной зрительной
 *     строке. Это и есть починка переноса: отрезок через строку `forRange`
 *     рисует **выделением**, то есть до края экрана, и починить это можно
 *     только не давая ей такого отрезка;
 *   * прямоугольник, который она вернула, вырастает ровно на заданные
 *     величины.
 */
function withFakeRectangleMarker(body) {
  const cmView = require("@codemirror/view");
  const realMarker = cmView.RectangleMarker;
  const asked = [];
  const made = [];

  function FakeMarker(cls, left, top, width, height) {
    this.className = cls;
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
    made.push({ left, top, width, height });
  }
  /* Один прямоугольник на отрезок, с числами, выведенными из его границ: так
     ясно видно, какой отрезок породил какой прямоугольник. */
  FakeMarker.forRange = (view, cls, range) => {
    asked.push({ from: range.from, to: range.to });
    return [{
      className: cls,
      left: range.from * 10,
      top: 100,
      width: (range.to - range.from) * 10,
      height: 20,
    }];
  };

  cmView.RectangleMarker = FakeMarker;
  try {
    return body({ asked, made });
  } finally {
    cmView.RectangleMarker = realMarker;
  }
}

/** Тот же поддельный документ, плюс измерения, которые спрашивает слой. */
function fakeViewWithCoords(lines, wrapAt) {
  const view = fakeView(lines);
  /*
   * `wrapAt` — положение в документе, с которого начинается вторая зрительная
   * строка. Ниже него вертикаль одна, от него и дальше — другая. Так
   * переносится строка на экране, и больше слою ничего знать не нужно.
   */
  view.coordsAtPos = (pos) => ({
    left: pos * 10,
    right: pos * 10 + 8,
    top: wrapAt != null && pos >= wrapAt ? 120 : 100,
    bottom: wrapAt != null && pos >= wrapAt ? 140 : 120,
  });
  return view;
}

(function testWholeSpanGoesToThePlatformAsOnePiece() {
  const view = fakeViewWithCoords([LINE], null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 0, widthPct: 0 });
  withFakeRectangleMarker(({ asked, made }) => {
    const markers = decorations.blockFillMarkersFor(view, plugin);
    assertEq(asked.length, 2, "переноса нет — по одному отрезку на сторону");
    assertEq(markers.length, 2, "и по одному прямоугольнику");
    const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
    assertEq(asked[0], { from: spans[0].start, to: spans[0].end },
      "платформе отдан весь отрезок стороны, как и раньше");
    /* Рост нулевой — прямоугольник обязан остаться тем, что вернула платформа:
       это положительный контроль к проверке ниже (У-110). */
    assertEq(made.length, 0, "при нулевом росте прямоугольник не пересобирается");
  });
})();

(function testRectangleGrowsByTheSetAmounts() {
  const view = fakeViewWithCoords([LINE], null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 4, widthPct: 100 });
  withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(made.length, 2, "по прямоугольнику на сторону");

    const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
    /*
     * Промежуток на этой подделке: правый край последнего знака блока стоит на
     * `gapFrom * 10 + 8`, левый край разделителя — на `gapTo * 10`. Между ними
     * один пробел, то есть две точки. Сотня процентов берёт их целиком.
     */
    const gapPx = spans[0].gapTo * 10 - (spans[0].gapFrom * 10 + 8);
    assertEq(gapPx, 2, "промежуток на подделке равен двум точкам");

    const bareLeft = spans[0].start * 10;
    const bareWidth = (spans[0].end - spans[0].start) * 10;
    assertEq(made[0].left, bareLeft - gapPx, "влево подложка выросла на промежуток");
    assertEq(made[0].width, bareWidth + gapPx * 2, "и в ширину — на него с обеих сторон");
    assertEq(made[0].top, 100 - 4, "вверх — на заданные точки");
    assertEq(made[0].height, 20 + 4 * 2, "и в высоту на них же с обеих сторон");

    /* У-110: величина обязана измениться, иначе проверка мерит пустоту. */
    assertTrue(made[0].width > bareWidth, "ширина и правда стала больше");
    assertTrue(made[0].height > 20, "и высота тоже");
  });
})();

(function testWrappedSpanIsCutByVisualLines() {
  /*
   * Его случай дословно: правый блок переносится. Прежде отрезок уходил
   * платформе целиком, и она рисовала его выделением — до края экрана на
   * первой строке и от края на второй.
   */
  const line = "- #a " + SEP + " text " + SEP + " #one #two #three";
  const spans = visuals.blockFillSpansInLine(line, SEP, SEP, MARKERS);
  const right = spans[1];
  assertEq(right.parts.length, 3, "справа три значения");

  /* Перенос ставим ровно перед третьим значением. */
  const wrapAt = right.parts[2].from;
  const view = fakeViewWithCoords([line], wrapAt);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 0, widthPct: 0 });

  withFakeRectangleMarker(({ asked }) => {
    decorations.blockFillMarkersFor(view, plugin);

    /* Слева переноса нет — сторона отдана одним отрезком. */
    assertEq(asked[0], { from: spans[0].start, to: spans[0].end },
      "нетронутая сторона отдана одним куском");

    /* Справа — два куска, и границы у них его: до последнего элемента на этой
       строке, и от первого перенесённого до последнего. */
    assertEq(asked.slice(1), [
      { from: right.parts[0].from, to: right.parts[1].to },
      { from: right.parts[2].from, to: right.parts[2].to },
    ], "перенесённая сторона отдана по куску на зрительную строку");

    /*
     * И главное утверждение, ради которого всё: **ни один** отрезок, отданный
     * платформе, не лежит на двух зрительных строках. Именно такой отрезок она
     * и рисует до края экрана.
     */
    for (const range of asked) {
      assertEq(view.coordsAtPos(range.from).top, view.coordsAtPos(range.to - 1).top,
        "отрезок " + JSON.stringify(range) + " лежит на одной зрительной строке");
    }
  });
})();

(function testWrapCutIsNotDoneWhenThereIsNothingToCut() {
  /*
   * Положительный контроль к предыдущей: **та же** подделка с тем же
   * переносом, но сторона из одного значения. Резать её нечем, и отрезок
   * уходит целиком — то есть проверка выше поймала перенос, а не «всегда режем
   * на части».
   */
  const line = "- #a " + SEP + " text " + SEP + " #one";
  const spans = visuals.blockFillSpansInLine(line, SEP, SEP, MARKERS);
  const view = fakeViewWithCoords([line], spans[1].start + 1);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 0, widthPct: 0 });
  withFakeRectangleMarker(({ asked }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(asked[1], { from: spans[1].start, to: spans[1].end },
      "одно значение резать нечем, и отрезок уходит целиком");
  });
})();

/* ---- шов: новые ползунки доезжают до перерисовки слоя ------------------ */

(function testLayerRedrawsWhenGrowthChanges() {
  /*
   * Правка настройки состояния редактора не меняет: пересборка присылает
   * пустую правку выделения. Значит `docChanged`, `viewportChanged` и
   * `geometryChanged` на ней все ложны, и решает **только** подпись слоя. Без
   * неё новые ползунки доезжали бы до заметки лишь после первой её правки —
   * ровно тот класс дефекта, что У-56.
   */
  const quiet = { docChanged: false, viewportChanged: false, geometryChanged: false };
  const dom = {};
  let band = { enabled: true, opacity: 12, heightPx: 3, widthPct: 60 };
  const plugin = {
    getConfig: () => ({
      pkm: { lineFormat: { separator1: SEP, separator2: SEP } },
      visual: { tags: { blockFill: band } },
    }),
  };
  const ask = (u, d) => decorations.blockFillLayerNeedsRedraw(plugin, u, d);

  assertEq(ask(quiet, dom), true, "первый вопрос — перерисовать: подписи ещё не было");
  assertEq(ask(quiet, dom), false, "ничего не поменялось — перерисовывать нечего");

  band = { enabled: true, opacity: 12, heightPx: 8, widthPct: 60 };
  assertEq(ask(quiet, dom), true, "сдвинули высоту — слой перерисовывается");
  assertEq(ask(quiet, dom), false, "и успокаивается");

  band = { enabled: true, opacity: 12, heightPx: 8, widthPct: 20 };
  assertEq(ask(quiet, dom), true, "сдвинули ширину — тоже");

  /* А густота живёт в стилях, и слою до неё дела нет: перерисовки не будет. */
  band = { enabled: true, opacity: 90, heightPx: 8, widthPct: 20 };
  assertEq(ask(quiet, dom), false,
    "густота меняется правилом стилей, а не геометрией: слой не трогается");

  band = { enabled: false, opacity: 90, heightPx: 8, widthPct: 20 };
  assertEq(ask(quiet, dom), true, "выключили тумблер — слой убирает прямоугольники");
})();

(function testGrowthSurvivesNormalization() {
  const normalize = require(path.join(__dirname, "..", "..", "src", "core", "config_normalize.js"));
  const out = normalize.migrateConfig({
    schemaVersion: 2,
    visual: { tags: { blockFill: { enabled: true, heightPx: 900, widthPct: -20 } } },
  }).visual.tags.blockFill;
  assertEq(out.heightPx, 10, "высота выше шкалы прижимается к её верху");
  assertEq(out.widthPct, 0, "ширина ниже нуля прижимается к нулю");

  const fresh = normalize.migrateConfig({ schemaVersion: 2 }).visual.tags.blockFill;
  assertEq(fresh.heightPx, visuals.BLOCK_FILL_DEFAULT_HEIGHT_PX,
    "умолчание высоты досыпается схемой, а не выдумывается слоем");
  assertEq(fresh.widthPct, visuals.BLOCK_FILL_DEFAULT_WIDTH_PCT, "и умолчание ширины тоже");
})();

console.log("Block fill regression tests: OK");
