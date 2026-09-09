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
/*
 * Метки элементов собираются **функцией плагина**, а не литералом: образец
 * хвоста — это правило, и рукописная копия его тут разошлась бы с продуктом
 * молча (У-4, У-32). Ровно на таком расхождении и стоял дефект, с которым
 * заказчик пришёл во второй раз по S7.
 */
const ELEMENT_FIELDS = {
  due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD" },
  /* Поле заказчика дословно: метка, формат из шести единиц и команда
     `Random characters` — именно она решает, чем заполнены слоты. */
  rnd: { emoji: "\u{1F923}", format: "111111", increment: { command: "randomE" } },
};
const MARKERS = visuals.buildElementMarkersFromConfig({
  pkm: { fields: { elements: { byField: ELEMENT_FIELDS } } },
});

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

/*
 * Конфиг подделки и метки элементов — **одно объявление**: `blockFillDocRanges`
 * собирает метки сам, из конфига, и фикстура, называвшая поля элементов только
 * в `MARKERS`, слепа к элементам вовсе (У-47). Проверки при этом были зелёные:
 * в правом блоке примера стоит ещё и ссылка, а её сканер находит без меток.
 */
function fakePlugin(blockFill) {
  return {
    getConfig: () => ({
      pkm: {
        lineFormat: { separator1: SEP, separator2: SEP },
        fields: { elements: { byField: ELEMENT_FIELDS } },
      },
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
})();

(function testDefaultsMakeTheBandVisible() {
  /* Умолчание, при котором функция невидима, — не умолчание. */
  const look = visuals.blockFillLookFromConfig({
    visual: { tags: { blockFill: { enabled: true } } },
  });
  assertTrue(look.heightPct > 0, "высота по умолчанию больше нуля: иначе подложку закроет пузырь");
  assertTrue(look.widthPct > 0, "и ширина тоже");
  assertEq(look.heightPct, visuals.BLOCK_FILL_DEFAULT_HEIGHT_PCT, "и это умолчание из схемы");
  assertEq(look.widthPct, visuals.BLOCK_FILL_DEFAULT_WIDTH_PCT, "и это тоже");
})();

(function testGrowthReadFromConfig() {
  const look = visuals.blockFillLookFromConfig({
    visual: { tags: { blockFill: { enabled: true, heightPct: 40, widthPct: 25 } } },
  });
  assertEq(look.heightPct, 40, "высота читается");
  assertEq(look.widthPct, 25, "ширина читается");

  const junk = visuals.blockFillLookFromConfig({
    visual: { tags: { blockFill: { enabled: true, heightPct: 900, widthPct: -3 } } },
  });
  assertEq(junk.heightPct, visuals.BLOCK_FILL_MAX_HEIGHT_PCT,
    "высота выше шкалы прижимается к её верху");
  assertEq(junk.widthPct, 0, "ширина ниже нуля прижимается к нулю");

  const words = visuals.blockFillLookFromConfig({
    visual: { tags: { blockFill: { enabled: true, heightPct: "три", widthPct: null } } },
  });
  assertEq(words.heightPct, visuals.BLOCK_FILL_DEFAULT_HEIGHT_PCT,
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

(function testPadXHasThreeLandmarks() {
  /*
   * **Шкалу откалибровал заказчик сам** (2026-09-09): «при минимальном
   * значении полоска в block начиналась от начала первого элемента до
   * конца последнего, при среднем положении — была до сепаратора… а при
   * максимальном — включала separator». Отсюда две меры и перелом на
   * середине: ближняя граница разделителя и дальняя.
   */
  const pad = (pct, near, far) => visuals.blockFillPadXPx({ widthPct: pct }, near, far);
  assertEq(pad(0, 8, 20), 0, "ноль — подложка кончается на написанном");
  assertEq(pad(25, 8, 20), 4, "первая половина шкалы тратится на промежуток");
  assertEq(pad(50, 8, 20), 8, "середина — ровно до разделителя");
  assertEq(pad(75, 8, 20), 14, "вторая половина — на сам разделитель");
  assertEq(pad(100, 8, 20), 20, "сотня — разделитель входит в подложку целиком");

  /* Меры нет или она бессмысленна — своей части шкалы нет. */
  assertEq(pad(100, 0, 0), 0, "промежутка нет — нет и роста");
  assertEq(pad(100, -5, -1), 0, "отрицательные меры не бывают ростом");
  assertEq(pad(100, NaN, NaN), 0, "неизмеренные тоже");
  assertEq(pad(100, 8, NaN), 8, "разделитель не измерен — подложка стоит у его края, а не за ним");
  assertEq(visuals.blockFillPadXPx({}, 8, 20), 0, "настройки нет — роста нет");

  /*
   * Верхняя граница держится и здесь, а не только нормализацией: рукописный
   * `data.json` мимо панели дал бы подложку на пол-экрана.
   */
  assertEq(pad(400, 8, 20), 20, "выше сотни всё равно по дальней границе, а не за неё");
})();

(function testSpansCarryTheSeparatorFarEdgeAndThePrefix() {
  /*
   * Две новые меры его замечания живут в том же разборе строки: дальняя
   * граница разделителя и конец знака начала строки. Второй разбор
   * того же разошёлся бы с этим молча (У-32).
   */
  const at = visuals.lineSeparatorBounds(LINE, SEP, SEP);
  const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
  assertEq(spans[0].sepFar, at.firstEnd, "слева дальняя граница — конец первого разделителя");
  assertEq(spans[1].sepFar, at.last, "справа — начало последнего");
  assertEq(LINE.slice(spans[0].gapTo, spans[0].sepFar), SEP,
    "между ближней и дальней границей стоит ровно разделитель");

  /* Префикс — без пробелов за ним: в них подложке расти можно. */
  assertEq(visuals.blockFillPrefixGlyphEnd("- [ ] #todo"), 5, "буллит с чекбоксом");
  assertEq(visuals.blockFillPrefixGlyphEnd("- #todo"), 1, "один буллит");
  assertEq(visuals.blockFillPrefixGlyphEnd("\t\t- [x] #todo"), 7, "с отступом");
  assertEq(visuals.blockFillPrefixGlyphEnd("#todo :: text"), 0, "знака начала строки нет вовсе");
  assertEq(visuals.blockFillPrefixGlyphEnd("3) [ ] #todo"), 6, "номер со скобкой и чекбокс");
})();

/* ---- перенос строки: по куску на зрительную строку --------------------- */

(function testElementValueIsFoundWhateverTheFormatShape() {
  /*
   * **Сверка двух ходов на одних входах, а не пример** (У-92): значение
   * элемента пишет `renderCommandValueByFormat`, а находит его на строке
   * сканер. Разошлись они молча и стоили заказчику второго захода по S7: у
   * поля с командой `Random characters` формат `111111`, и прежний разбор
   * сканера искал на строке литерал `111111`, а движок пишет туда шесть
   * случайных знаков — «в right block с только одним value из field=emoji
   * Random полоска вообще не нарисовалась».
   *
   * Гоняются все четыре формы формата и все три команды: форма решает разбор,
   * команда решает, чем заполнены слоты.
   */
  const shared = require(path.join(__dirname, "..", "..", "src", "core", "shared_utils.js"));
  const shapes = ["YYYY-MM-DD hh:mm", "1111", "12:34", "abc"];
  const commands = ["now", "randomN", "randomE"];
  let checked = 0;
  for (const format of shapes) {
    for (const command of commands) {
      /* Метки собираются **из того же поля**, каким пишется значение: команда
         решает, чем заполнены слоты, и фикстура, её не назвавшая, проверяла бы
         другое поле (У-2). */
      const markers = visuals.buildElementMarkersFromConfig({
        pkm: { fields: { elements: { byField: {
          f: { emoji: "\u{1F923}", format, increment: { command } },
        } } } },
      });
      const value = shared.renderCommandValueByFormat(format, command);
      const line = "- #a " + SEP + " text " + SEP + " \u{1F923}" + value;
      const hits = visuals.scanLineVisualTokens(line, SEP, SEP, markers)
        .filter(h => h.zone === "right");
      assertEq(hits.map(h => h.token), ["\u{1F923}" + value],
        "формат " + JSON.stringify(format) + ", команда " + command
          + ": значение найдено целиком, одним токеном");
      checked += 1;
    }
  }
  /* У-110: сверка обязана что-то сверить, а не пройти по пустому списку. */
  assertTrue(checked === shapes.length * commands.length,
    "сверены все формы формата и все команды, а не часть");

  /* И его собственный случай целиком: блок из одного такого значения. */
  const rnd = visuals.blockFillSpansInLine(
    "- #a " + SEP + " text " + SEP + " \u{1F923}XIInR_", SEP, SEP, MARKERS);
  assertEq(rnd.map(s => s.zone), ["left", "right"],
    "блок из одного значения `Random characters` подложку получает");
})();

/* ---- прямоугольники: что уходит платформе и что возвращается ----------- */

/*
 * Здесь **подделана ровно платформенная половина** и она названа (У-1):
 * `RectangleMarker.forRange` меряет положение на экране кодом самого
 * CodeMirror, и позвать его вне окна нечем.
 *
 * **Вертикаль подделка считает тем же правилом, что платформа** — объединением
 * строчных ящиков **краёв** отрезка (`rectanglesForRange` в
 * `@codemirror/view`, прочитано в нём, а не выведено из типов). Прежняя версия
 * отдавала постоянные `top` и `height`, то есть была слепа ровно к тому
 * дефекту, с которым заказчик пришёл вторым заходом по S7: «если в block
 * встречается wikilink, то полоска становится выше, чем в строке, в которой
 * нет wikilink».
 *
 * **И слой считает свои координаты не от экрана.** `getBase` вычитает начало
 * прокручиваемого содержимого, поэтому подделка вычитает `LAYER_OFFSET_PX`:
 * без этого «вертикаль от зрительной строки» сошлась бы с экранной случайно, и
 * проба смещения оказалась бы непроверенной.
 */
const LAYER_OFFSET_PX = 3;
const ROW_H = 40;
const TEXT_H = 30;
const DOC_TOP = 7;
/* Ссылка в замечании выше написанного ровно на столько — обмерено по 18.png. */
const TALL_BUMP_PX = 5;
/*
 * **На сколько строка бывает выше умолчания редактора.** `defaultLineHeight`
 * платформа мерит на пробной строке из одних букв (`measureTextSize` в
 * `@codemirror/view`), а строка со ссылкой, эмодзи или высоким пузырём выше
 * его. Прежняя фикстура отдавала высоту блока ровно `rows * ROW_H`, то есть
 * предмета этого замечания в ней не было вовсе (У-113), и подложка, встававшая
 * по середине **умолчания**, уезжала вверх на половину разницы при зелёном
 * наборе. Обмерено браузером: 5 точек из 42 на строке со ссылкой.
 */
const TALL_ROW_BUMP_PX = 10;

function withFakeRectangleMarker(body) {
  const cmView = require("@codemirror/view");
  const realMarker = cmView.RectangleMarker;
  const asked = [];
  const made = [];
  const returned = [];

  function FakeMarker(cls, left, top, width, height) {
    this.className = cls;
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
    made.push({ left, top, width, height });
  }
  FakeMarker.forRange = (view, cls, range) => {
    /*
     * Пустой отрезок — это **проба смещения слоя**, а не кусок подложки:
     * платформа отвечает на него одним прямоугольником по `coordsAtPos`
     * (`forRange` в `@codemirror/view`). В список отданных отрезков она не
     * идёт, иначе проба читалась бы как ещё один кусок.
     */
    if (range.empty === true) {
      const c = view.coordsAtPos(range.head, range.assoc || 1);
      if (!c) return [];
      return [{ className: cls, left: c.left, top: c.top - LAYER_OFFSET_PX,
        width: null, height: c.bottom - c.top }];
    }
    asked.push({ from: range.from, to: range.to });
    const a = view.coordsAtPos(range.from, 2);
    const b = view.coordsAtPos(range.to, -2);
    const top = Math.min(a.top, b.top);
    const bottom = Math.max(a.bottom, b.bottom);
    const rect = {
      className: cls,
      left: Number(a.left),
      top: top - LAYER_OFFSET_PX,
      width: Number(b.right) - Number(a.left),
      height: bottom - top,
    };
    returned.push({ top: rect.top, height: rect.height, left: rect.left, width: rect.width });
    return [rect];
  };

  cmView.RectangleMarker = FakeMarker;
  try {
    return body({ asked, made, returned });
  } finally {
    cmView.RectangleMarker = realMarker;
  }
}

/**
 * Тот же поддельный документ, плюс измерения, которые спрашивает слой.
 *
 * `wraps` — положения, с которых начинается новая **зрительная** строка.
 * `bubbles` — отрезки, у которых своя высота: так рисуется пузырь тега, и
 * вертикаль его положений отличается от вертикали обычного текста **на той же**
 * зрительной строке. `talls` — отрезки, чей строчный ящик **выше** написанного:
 * так Obsidian рисует ссылку, и по скриншоту заказчика она выше на пять точек.
 *
 * **Пузыри и ссылка тут — не украшение фикстуры, а починка** (У-47). Фикстура,
 * отдающая одну вертикаль на строку, отдаёт то, чего в редакторе не бывает, и
 * оба захода по S7 стоили ровно этого.
 *
 * Границы зрительных строк фикстура отдаёт **тем же швом, каким их отдаёт
 * платформа** — `moveToLineBoundary`; геометрию строки — теми же
 * `lineBlockAt`, `documentTop`, `defaultLineHeight` и
 * `viewState.heightOracle.textHeight`, какие спрашивает слой.
 */
function fakeViewWithCoords(lines, wraps, bubbles, talls, tallLines) {
  const view = fakeView(lines);
  const cuts = (Array.isArray(wraps) ? wraps : (wraps == null ? [] : [wraps]))
    .map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const bumps = Array.isArray(bubbles) ? bubbles : [];
  const highs = Array.isArray(talls) ? talls : [];
  const docEnd = lines.reduce((at, text) => at + text.length + 1, 0) - 1;
  const inList = (list, pos) => list.some((b) => pos >= b.from && pos < b.to);
  /* Номера строк, которые выше умолчания редактора: так ведёт себя строка со
     ссылкой или эмодзи. Лишняя высота у такой строки висит **под**
     написанным — это подделка, и она названа: где именно окажется текст
     внутри выросшей строки, решает начертание, а подложке важна строка. */
  const tallSet = new Set((Array.isArray(tallLines) ? tallLines : []).map(Number));
  const rowHeightOfLine = (n) => ROW_H + (tallSet.has(Number(n)) ? TALL_ROW_BUMP_PX : 0);
  const rowsOfLine = (line) =>
    1 + cuts.filter((c) => c > line.from && c < line.from + line.text.length).length;
  const blockTopOfLine = (line) => {
    let top = 0;
    for (let n = 1; n < line.number; n++) {
      const prev = view.state.doc.line(n);
      top += rowsOfLine(prev) * rowHeightOfLine(n);
    }
    return top;
  };
  /*
   * **Сторона обязательна** (У-76): платформа меряет либо знак ПЕРЕД
   * положением (сторона меньше нуля), либо знак НА нём. Фикстура, мерившая
   * одинаково, слепа к вертикали края блока — а именно на ней и терялся рост
   * подложки в сторону разделителя.
   */
  view.coordsAtPos = (pos, side) => {
    const at = Number(side) < 0 ? Math.max(0, pos - 1) : pos;
    const line = view.state.doc.lineAt(at);
    const rowInLine = cuts.filter((c) => c > line.from && c <= at).length;
    const rowTop = DOC_TOP + blockTopOfLine(line) + rowInLine * rowHeightOfLine(line.number);
    let top = rowTop + (ROW_H - TEXT_H) / 2;
    let bottom = top + TEXT_H;
    /* Пузырь тега ниже написанного и стоит внутри его ящика. */
    if (inList(bumps, at)) { top += 4; bottom -= 4; }
    /* Ссылка выше написанного, и выше **только сверху** — как на 18.png. */
    if (inList(highs, at)) { top -= TALL_BUMP_PX; }
    return { left: at * 10, right: at * 10 + 8, top, bottom };
  };
  view.moveToLineBoundary = (at, forward, includeWrap) => {
    if (forward !== true || includeWrap !== true) throw new Error("слой спрашивает конец строки вперёд и с переносом");
    const head = Number(at && at.head);
    const next = cuts.find((c) => c > head);
    return { head: next === undefined ? docEnd : next };
  };
  view.defaultLineHeight = ROW_H;
  view.documentTop = DOC_TOP;
  view.viewState = { heightOracle: { textHeight: TEXT_H } };
  view.lineBlockAt = (pos) => {
    const line = view.state.doc.lineAt(pos);
    /* Высота блока — своя высота строки, а не умолчание: именно этим строка со
       ссылкой отличается от строки без неё. */
    return {
      top: blockTopOfLine(line),
      height: rowsOfLine(line) * rowHeightOfLine(line.number),
      from: line.from,
      to: line.from + line.text.length,
    };
  };
  return view;
}

/** Вертикаль зрительной строки в координатах слоя, по правилу самой фикстуры. */
function rowBoxOf(row) {
  const top = DOC_TOP + row * ROW_H - LAYER_OFFSET_PX;
  return { top, height: ROW_H };
}

(function testWholeSpanGoesToThePlatformAsOnePiece() {
  const view = fakeViewWithCoords([LINE], null, null, null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 0, widthPct: 0 });
  withFakeRectangleMarker(({ asked, made }) => {
    const markers = decorations.blockFillMarkersFor(view, plugin);
    assertEq(asked.length, 2, "переноса нет — по одному отрезку на сторону");
    assertEq(markers.length, 2, "и по одному прямоугольнику");
    const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
    assertEq(asked[0], { from: spans[0].start, to: spans[0].end },
      "платформе отдан весь отрезок стороны, как и раньше");
    /*
     * Прямоугольники пересобираются **всегда**, потому что вертикаль подложки
     * больше не берётся из измеренного отрезка: она считается от зрительной
     * строки (замечание про ссылку). Это и проверяется ниже; здесь только
     * число.
     */
    assertEq(made.length, 2, "оба прямоугольника пересобраны: вертикаль своя");
  });
})();

(function testBubbleHeightIsNotAWrap() {
  /*
   * **Его слова дословно:** «сейчас полоска для block идёт с разрывами — я
   * хочу, чтобы для block она была единой для всех values и одинаковой по
   * размеру и без смещений… для values=tags и values=wikilink эта полоска
   * рисуется на разной высоте — у wikilink она смещена выше».
   *
   * Причина была в способе: куски отрезка группировались по **измеренной
   * вертикали**, а у пузыря тега она своя. Здесь оба тега левого блока —
   * пузыри, ссылка рядом с ними — нет, и всё это на одной зрительной строке.
   * Отрезок обязан уйти платформе одним куском: два куска — это две отрисовки
   * `forRange`, то есть две разные высоты и разрыв между ними.
   */
  const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
  const left = spans[0];
  /* Пузырь — на первом значении блока, а не на всём блоке: разные вертикали
     нужны ВНУТРИ одной зрительной строки, иначе предмета нет. */
  const bubbles = [{ from: left.start, to: LINE.indexOf(" ", left.start) }];
  const view = fakeViewWithCoords([LINE], null, bubbles, null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 0, widthPct: 0 });
  withFakeRectangleMarker(({ asked }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(asked[0], { from: left.start, to: left.end },
      "блок с пузырём и обычным значением на одной строке — один кусок, а не кусок на значение");
    assertEq(asked.length, 2, "и всего кусков по-прежнему два: по одному на сторону");
    /* У-110: вертикали внутри блока и правда разошлись, иначе проверка мерит
       пустоту. */
    assertTrue(view.coordsAtPos(left.start).top !== view.coordsAtPos(left.end - 1).top,
      "вертикали двух значений блока в фикстуре различаются: предмет есть");
  });
})();

/* ---- высота подложки: одна на все строки ------------------------------- */

/*
 * **Второй заход заказчика по S7, 2026-09-09:** «если в block встречается
 * wikilink, то полоска становится выше, чем в строке, в которой нет wikilink.
 * Визуально — над block эта полоска уходит сильно выше — так быть не должно,
 * она должна быть одинаковая во всех строках».
 *
 * Причина прочитана в платформе, а не угадана: `rectanglesForRange` берёт
 * вертикаль как объединение строчных ящиков **краёв** отрезка, а у ссылки,
 * которую рисует Obsidian, ящик выше ящика соседнего текста. То есть высота
 * подложки зависела от того, что в блоке лежит.
 */
(function testBandHeightIsTheSameWhateverIsInTheBlock() {
  const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
  const left = spans[0];
  /* Ссылка — на последнем значении блока: именно край отрезка и решает. */
  const talls = [{ from: LINE.lastIndexOf("#todo"), to: left.end }];
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 40, widthPct: 0 });

  const run = (list) => withFakeRectangleMarker(({ made, returned }) => {
    decorations.blockFillMarkersFor(fakeViewWithCoords([LINE], null, null, list), plugin);
    return { made: made[0], returned: returned[0] };
  });

  const plain = run(null);
  const withLink = run(talls);

  /*
   * **Положительный контроль стоит первым** (У-110): фикстура и правда отдаёт
   * платформе разные прямоугольники. Без него «высоты равны» выполнялось бы и
   * от слепой фикстуры — ровно этим была прежняя подделка.
   */
  assertEq(withLink.returned.top, plain.returned.top - TALL_BUMP_PX,
    "платформа и правда отдаёт со ссылкой прямоугольник выше: предмет есть");
  assertEq(withLink.returned.height, plain.returned.height + TALL_BUMP_PX,
    "и выше он именно сверху, как на скриншоте");

  assertEq(withLink.made.top, plain.made.top,
    "а подложка встаёт на ту же вертикаль: она считается от зрительной строки");
  assertEq(withLink.made.height, plain.made.height,
    "и той же высоты — «одинаковая во всех строках»");
})();

(function testBandSitsInTheMiddleOfItsVisualRow() {
  /*
   * И сама вертикаль: подложка стоит по середине своей зрительной строки, а
   * высота её — написанное плюс заданные точки вверх и вниз. Числа выписаны
   * отдельно от того, из чего слой их считает (У-5).
   */
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 40, widthPct: 0 });
  const view = fakeViewWithCoords([LINE], null, null, null);
  withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(view, plugin);
    const row = rowBoxOf(0);
    const height = 34;
    assertEq(made[0].height, height,
      "высота — написанное плюс две пятых того, что осталось от строки");
    assertEq(made[0].top, row.top + (row.height - height) / 2,
      "и стоит она по середине своей зрительной строки");
  });
})();

(function testBandNeverGrowsPastItsRow() {
  /*
   * Его слово: «после высоты в 3px полоски на разных строках начинают наезжать
   * друг на друга, сделай максимальное значение 5px». Наезжать они не могут
   * вовсе — высота прижата к зрительной строке, — и это проверяется на верхе
   * шкалы.
   */
  const view = fakeViewWithCoords([LINE], null, null, null);
  const top = visuals.BLOCK_FILL_MAX_HEIGHT_PCT;
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: top, widthPct: 0 });
  withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(made[0].height, ROW_H,
      "верх шкалы — ровно зрительная строка: и не выше её, и не ниже");
    /* И положительный контроль: она и правда выросла, а не осталась прежней. */
    assertTrue(made[0].height > TEXT_H, "и выросла: иначе шкала ничего не делает");
  });
})();

(function testBandCentreFollowsItsOwnRowNotTheDefault() {
  /*
   * **Замечание третьего захода по S7 дословно:** «полоска выглядит
   * нецентрированной — она смещена выше (сверху строки она выглядит больше,
   * чем снизу строки)». Причина не в счёте высоты, а в том, от чего считалась
   * середина: у строки **без переноса** ею была середина `defaultLineHeight`,
   * а строка со ссылкой, эмодзи или высоким пузырём выше этого умолчания.
   *
   * Здесь эти строки стоят рядом: вторая выше умолчания на `TALL_ROW_BUMP_PX`.
   * Подложка обязана встать по середине **своей** строки на обеих.
   */
  const view = fakeViewWithCoords([LINE, LINE], null, null, null, [2]);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 0, widthPct: 0 });
  withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(made.length, 4, "по две стороны на каждой из двух строк");
    /* Обычная строка: середина умолчания и середина строки совпадают. */
    const plainRow = { top: DOC_TOP - LAYER_OFFSET_PX, height: ROW_H };
    assertEq(made[0].top + made[0].height / 2, plainRow.top + plainRow.height / 2,
      "на обычной строке подложка по её середине");
    /* Высокая строка: её собственная высота больше умолчания. */
    const tallTop = DOC_TOP + ROW_H - LAYER_OFFSET_PX;
    const tallHeight = ROW_H + TALL_ROW_BUMP_PX;
    assertEq(made[2].top + made[2].height / 2, tallTop + tallHeight / 2,
      "и на высокой — по середине высокой, а не по середине умолчания");
    /* Положительный контроль: строка и правда выше, иначе сверять нечего. */
    assertTrue(tallHeight > ROW_H, "высокая строка выше умолчания: предмет замечания на месте");
    assertEq(made[2].height, made[0].height,
      "а высота у обеих одна: «одинаковая во всех строках» — его же условие");
  });

  /*
   * И верх шкалы: высота считается от **умолчания** редактора, а не от высоты
   * этой строки, — иначе на строке со ссылкой полоса стала бы выше, а «она
   * должна быть одинаковая во всех строках» его же условие. Первая версия
   * правки смешала два вопроса, и браузерный гейт покраснел сразу: 24.19
   * против 28.19. Середина при этом по-прежнему у своей строки.
   */
  const fullPlugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 100, widthPct: 0 });
  withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(view, fullPlugin);
    assertEq(made[0].height, ROW_H, "на обычной строке верх шкалы — её высота");
    assertEq(made[2].height, ROW_H, "на высокой — та же: высота одна на все строки");
    const tallTop = DOC_TOP + ROW_H - LAYER_OFFSET_PX;
    assertEq(made[2].top + made[2].height / 2,
      tallTop + (ROW_H + TALL_ROW_BUMP_PX) / 2,
      "а середина — по середине высокой строки");
  });
})();

(function testEveryStepOfTheHeightScaleMovesTheBand() {
  /*
   * Его слово: «tags-block-fill-height изменяются только при значениях
   * ползунка от 0 до 2 px, а при значениях от 3 до 5 высота как при 2px».
   * Шкала в точках упиралась в высоту строки, и сколько её делений останется
   * живым, решало начертание темы. Доля свободного места живёт вся и на тесной
   * строке, и на просторной — обе тут и проверяются.
   */
  const look = (heightPct) => ({ heightPct });
  for (const [rowH, textH] of [[32, 30], [60, 30]]) {
    let prev = -1;
    for (const pct of [0, 20, 40, 60, 80, 100]) {
      const h = visuals.blockFillBandHeightPx(look(pct), rowH, textH, 0);
      assertTrue(h > prev,
        "на строке высотой " + rowH + " деление " + pct + " двигает высоту (" + h + " после " + prev + ")");
      prev = h;
    }
    assertEq(prev, rowH, "и верх шкалы заполняет строку целиком");
  }
})();

(function testBandHeightRule() {
  /* Само правило — без окна и без слоя. */
  const look = (heightPct) => ({ heightPct });
  assertEq(visuals.blockFillBandHeightPx(look(0), 40, 30, 20), 30,
    "на нуле подложка ровно по написанному");
  assertEq(visuals.blockFillBandHeightPx(look(50), 40, 30, 20), 35,
    "половина шкалы — половина того, что осталось от строки");
  assertEq(visuals.blockFillBandHeightPx(look(100), 40, 30, 20), 40,
    "сотня — строка целиком, ни точкой больше");
  assertEq(visuals.blockFillBandHeightPx(look(100), 30, 40, 20), 30,
    "выше своей зрительной строки не растёт: соседние подложки не пересекаются");
  assertEq(visuals.blockFillBandHeightPx(look(0), 40, 20, 30), 30,
    "пузырь выше написанного — подложка берёт его: цветные края наружу не торчат");
  assertEq(visuals.blockFillBandHeightPx(look(0), 40, NaN, 0),
    40 * visuals.BLOCK_FILL_TEXT_HEIGHT_SHARE,
    "меры написанного нет — берётся доля строки, и она названа");
  assertEq(visuals.blockFillBandHeightPx(look(60), NaN, 28, 20), 0,
    "высоты строки нет — считать нечего, и это не NaN в стилях");
})();

(function testBubbleHeightComesFromTheSameFunctionAsItsStyle() {
  /*
   * Слагаемое «высота пузыря» считается **той же** функцией, что задаёт пузырю
   * стиль: второе объявление его размера разошлось бы с первым молча (У-32) и
   * оставило бы подложку ниже пузыря ровно на разницу.
   */
  const visualsOf = (textSizePct, bubbleHeightPct) => visuals.getTagVisualsFromConfig({
    visual: { tags: { textSizePct, bubbleHeightPct } },
  });
  const st = visuals.computeTagVisualStyle(140, 100, 140, 0);
  assertEq(visuals.blockFillBubbleHeightPx(visualsOf(140, 140)),
    st.fontSizePx * st.lineHeight + st.verticalPaddingPx * 2,
    "высота пузыря выведена из его же стиля");
  assertTrue(visuals.blockFillBubbleHeightPx(visualsOf(140, 140))
    > visuals.blockFillBubbleHeightPx(visualsOf(50, 20)),
    "и она правда зависит от настроек: иначе слагаемое мертво");
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
  const wrap = line.indexOf("#three");
  const view = fakeViewWithCoords([line], [wrap], null, null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 0, widthPct: 0 });

  withFakeRectangleMarker(({ asked }) => {
    decorations.blockFillMarkersFor(view, plugin);

    /* Слева переноса нет — сторона отдана одним отрезком. */
    assertEq(asked[0], { from: spans[0].start, to: spans[0].end },
      "нетронутая сторона отдана одним куском");

    /* Справа — два куска, и границы у них его: до конца первой зрительной
       строки, и от начала второй до конца блока. */
    assertEq(asked.slice(1), [
      { from: right.start, to: wrap },
      { from: wrap, to: right.end },
    ], "перенесённая сторона отдана по куску на зрительную строку");
  });
})();

(function testWrappedPiecesSitOnTheirOwnRows() {
  /*
   * И вертикаль у кусков разная — по своей зрительной строке. Номер строки
   * слой считает **счётом границ от начала строки документа**, а не по
   * координатам: ровно координаты и врут (замечание про ссылку).
   */
  const line = "- #a " + SEP + " text " + SEP + " #one #two";
  const spans = visuals.blockFillSpansInLine(line, SEP, SEP, MARKERS);
  const right = spans[1];
  const wrap = line.indexOf("#two");
  /* Ссылка стоит на первом куске: под прежним правилом он уехал бы вверх. */
  const talls = [{ from: right.start, to: right.start + 4 }];
  const view = fakeViewWithCoords([line], [wrap], null, talls);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 20, widthPct: 0 });
  withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(made.length, 3, "три куска: левая сторона и две зрительные строки правой");
    const height = TEXT_H + 2;
    const boxOf = (row) => {
      const r = rowBoxOf(row);
      return r.top + (r.height - height) / 2;
    };
    assertEq(made[0].top, boxOf(0), "левая сторона — на первой зрительной строке");
    assertEq(made[1].top, boxOf(0), "первый кусок правой — тоже, и ссылка его не подняла");
    assertEq(made[2].top, boxOf(1), "второй кусок — на второй зрительной строке");
    assertEq(made[1].height, made[2].height, "и высота у кусков одна");
  });
})();

(function testBothBlocksOfAWrappedLineSitOnTheSameRow() {
  /*
   * **Найдено браузерным гейтом, а не глазами** (`check_editor.js`, 2026-09-09).
   * Обход зрительных строк останавливался на конце **отрезка**, а левый блок
   * кончается на первой строке — то есть у левого блока перенесённая строка
   * считалась однострочной, а у правого двустрочной. Высота зрительной строки
   * выводится делением высоты строки на их число, и подложка левого блока
   * встала на 4.5 точки выше подложки правого **на той же строке**.
   *
   * Утверждение — равенство вертикалей двух блоков одной зрительной строки, а
   * не число строк: число бывает верным и при неверной вертикали (У-58).
   */
  const line = "- #a #b " + SEP + " text " + SEP + " #one #two";
  const spans = visuals.blockFillSpansInLine(line, SEP, SEP, MARKERS);
  const wrap = line.indexOf("#two");
  assertTrue(wrap > spans[1].start, "перенос стоит внутри правого блока: предмет есть");
  assertTrue(spans[0].end < wrap, "а левый блок кончается до него: предмет есть и с этой стороны");
  const view = fakeViewWithCoords([line], [wrap], null, null);
  /*
   * **Зрительные строки одной строки документа не всегда равной высоты**, и
   * без этого предмет отсутствует (У-47): пока высота блока ровно кратна
   * высоте строки, деление и запасное значение дают одно и то же число, и
   * ошибка в числе строк не видна. Браузер это и показал: у перенесённой
   * строки с крупным пузырём высота блока была 82 при высоте строки 32.
   */
  const realBlockAt = view.lineBlockAt;
  view.lineBlockAt = (pos) => {
    const b = realBlockAt(pos);
    return { top: b.top, height: b.height + 8, from: b.from, to: b.to };
  };
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 20, widthPct: 0 });
  withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(made.length, 3, "три куска: левый блок и две зрительные строки правого");
    assertEq(made[0].top, made[1].top,
      "левый и правый блоки первой зрительной строки стоят на одной вертикали");
    assertTrue(made[2].top > made[1].top, "а перенесённый кусок — ниже");
  });
})();

(function testBandStaysInsideItsOwnDocumentLine() {
  /*
   * И прижим к блоку своей строки: высота зрительной строки внутри переноса
   * выводится делением, и на строке с неравными зрительными строками подложка
   * последнего куска иначе уехала бы в соседнюю строку документа. Его слова —
   * про **разные строки**: «полоски на разных строках начинают наезжать друг
   * на друга».
   */
  const line = "- #a " + SEP + " text " + SEP + " #one #two";
  const wrap = line.indexOf("#two");
  const view = fakeViewWithCoords([line, "вторая строка"], [wrap], null, null);
  const realBlockAt = view.lineBlockAt;
  /* Блок ниже двух зрительных строк: так бывает, когда одна из них выше. */
  view.lineBlockAt = (pos) => {
    const b = realBlockAt(pos);
    return { top: b.top, height: b.height - 12, from: b.from, to: b.to };
  };
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 100, widthPct: 0 });
  withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(view, plugin);
    const block = view.lineBlockAt(0);
    const top = DOC_TOP + block.top - LAYER_OFFSET_PX;
    const bottom = top + block.height;
    for (const m of made) {
      assertTrue(m.top >= top - 0.001,
        "подложка не выше блока своей строки (" + m.top + " при " + top + ")");
      assertTrue(m.top + m.height <= bottom + 0.001,
        "и не ниже него (" + (m.top + m.height) + " при " + bottom + ")");
    }
    /* У-110: предмет есть — без прижима последний кусок вышел бы за блок. */
    assertTrue(made.length >= 2, "кусков больше одного: прижиму есть что прижимать");
  });
})();

(function testWrapInsideOneValueIsCutToo() {
  /*
   * **Второй заход по тому же:** «по-прежнему при переносе на другую строку
   * полоска отображается плохо — идёт до конца экрана первой строки и
   * начинается от левой границы второй».
   *
   * Причина: резали по границам **наших значений**, а перенос случился внутри
   * одного значения — `\u{1F4C5}2026-09-09 11:14` рвётся по своему же пробелу.
   * Резать было нечем, отрезок уходил целиком, и платформа рисовала его
   * выделением. Прежняя проверка это самое и утверждала — «одно значение
   * резать нечем» — то есть охраняла дефект (У-58).
   */
  const line = "- #a " + SEP + " text " + SEP + " \u{1F4C5}2026-09-09";
  const spans = visuals.blockFillSpansInLine(line, SEP, SEP, MARKERS);
  const right = spans[1];
  const wrap = line.indexOf("2026") + 5;
  assertTrue(wrap > right.start && wrap < right.end,
    "перенос стоит внутри единственного значения блока: предмет есть");
  const view = fakeViewWithCoords([line], [wrap], null, null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 0, widthPct: 0 });
  withFakeRectangleMarker(({ asked }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(asked.slice(1), [
      { from: right.start, to: wrap },
      { from: wrap, to: right.end },
    ], "значение, перенесённое само, тоже режется по зрительной строке");
  });
})();

/* ---- ширина: три ориентира шкалы и одно исключение --------------------- */

(function testGrowthIsMirrored() {
  /*
   * **Его слова, второй заход по S7:** «в среднем положении ползунка width в
   * left block полоска справа должна быть до начала separator1, а слева… должна
   * отступать от первого элемента на такое же расстояние, как у правой границы
   * этого block»; «то же самое у right block, но зеркально… должен быть такой
   * же дополнительный выход вправо».
   *
   * Прежде рост был односторонним — только к разделителю, — и это было его же
   * прежнее слово, которое он этим замечанием уточнил.
   */
  const view = fakeViewWithCoords([LINE], null, null, null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 0, widthPct: 50 });
  withFakeRectangleMarker(({ made, returned }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(made.length, 2, "по прямоугольнику на сторону");

    const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
    /*
     * Промежуток **спрашивается у той же фикстуры**, что меряет его слою:
     * пересчитать его тут значило бы объявить второе правило (У-32).
     */
    const gapPx = view.coordsAtPos(spans[0].gapTo, 1).left
      - view.coordsAtPos(spans[0].gapFrom, -1).right;
    assertTrue(gapPx > 0, "промежуток на подделке больше нуля");
    /* Место, до которого левому блоку разрешено расти наружу. */
    const roomPx = view.coordsAtPos(spans[0].start, 1).left
      - view.coordsAtPos(spans[0].prefixEnd, -1).right;
    assertTrue(roomPx >= gapPx, "до знака начала строки места больше промежутка: прижим не мешает");

    /* Левый блок: к разделителю вправо, наружу влево, и одинаково. */
    assertEq(made[0].left, returned[0].left - gapPx, "левый блок вырос наружу, влево");
    assertEq(made[0].width, returned[0].width + gapPx * 2,
      "и к разделителю — на столько же: зеркально");

    /* Правый блок — зеркально: влево к разделителю, вправо наружу. */
    assertEq(made[1].left, returned[1].left - gapPx, "правый блок вырос влево, к разделителю");
    assertEq(made[1].width, returned[1].width + gapPx * 2, "и наружу вправо на столько же");
  });
})();

(function testLeftBandNeverReachesThePrefix() {
  /*
   * Единственное исключение зеркальности, его словами: «при любом значении
   * tags-block-fill-width полоска в left block не должна наезжать на префикс
   * (буллит, чекбокс) — т.е. даже в максимальном положении ползунка полоска
   * должна начинаться после префикса не включая его».
   *
   * Предмет создан нарочно: строка с чекбоксом, у которой первое значение
   * стоит вплотную к нему (У-113).
   */
  const line = "- [ ] #todo " + SEP + " text " + SEP + " #done";
  const spans = visuals.blockFillSpansInLine(line, SEP, SEP, MARKERS);
  const left = spans[0];
  assertEq(line.slice(0, left.prefixEnd), "- [ ]",
    "знак начала строки — буллит с чекбоксом, и пробел за ним в него не входит");
  const view = fakeViewWithCoords([line], null, null, null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 0, widthPct: 100 });
  withFakeRectangleMarker(({ made, returned }) => {
    decorations.blockFillMarkersFor(view, plugin);
    const roomPx = view.coordsAtPos(left.start, 1).left
      - view.coordsAtPos(left.prefixEnd, -1).right;
    const grown = returned[0].left - made[0].left;
    assertEq(grown, roomPx, "наружу подложка выросла ровно до знака начала строки, и не дальше");
    /*
     * И два контроля к этому числу: рост наружу и правда прижат — он **меньше**
     * роста к разделителю, — и он больше нуля, иначе «не наехала» выполнялось
     * бы отсутствием роста вовсе (У-88).
     */
    const toSep = made[0].width - returned[0].width - grown;
    assertTrue(toSep > grown,
      "к разделителю подложка выросла больше, чем наружу: прижим и правда сработал");
    assertTrue(grown > 0, "но наружу она всё же выросла: прижим — не запрет");
  });
})();

(function testGrowthTouchesOnlyTheOuterPieces() {
  /*
   * У перенесённого блока рост достаётся краям, у которых он есть: к
   * разделителю — куску, который разделителя касается, наружу — куску на
   * внешнем конце. Середина не растёт ни в одну сторону, иначе подложка
   * выросла бы в месте переноса.
   */
  const line = "- #a " + SEP + " text " + SEP + " #one #two #three";
  const spans = visuals.blockFillSpansInLine(line, SEP, SEP, MARKERS);
  const right = spans[1];
  const cut1 = line.indexOf("#two");
  const cut2 = line.indexOf("#three");
  const view = fakeViewWithCoords([line], [cut1, cut2], null, null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 0, widthPct: 50 });
  withFakeRectangleMarker(({ asked, made, returned }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(asked, [
      { from: spans[0].start, to: spans[0].end },
      { from: right.start, to: cut1 },
      { from: cut1, to: cut2 },
      { from: cut2, to: right.end },
    ], "четыре куска: левая сторона и три зрительные строки правой");
    const grewLeft = (i) => Math.round((returned[i].left - made[i].left) * 100) / 100;
    const grewWidth = (i) => Math.round((made[i].width - returned[i].width) * 100) / 100;
    assertEq(grewLeft(2), 0, "средний кусок наружу не вырос");
    assertEq(grewWidth(2), 0, "и в ширину тоже: у него обоих краёв блока нет");
    assertTrue(grewLeft(1) > 0, "первый кусок правого блока вырос влево, к разделителю");
    assertTrue(grewWidth(3) > 0, "последний — вправо, наружу");
    assertEq(grewLeft(3), 0, "и влево последний не вырос: там середина блока");
  });
})();

(function testGrowthIsZeroWhenTheSliderIsZero() {
  /*
   * Тот же случай при нулевой ширине: по горизонтали прямоугольник обязан
   * остаться тем, что вернула платформа. Без этого «вырос на промежуток»
   * выполнялось бы и ростом, которого человек не просил.
   */
  const view = fakeViewWithCoords([LINE], null, null, null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 0, widthPct: 0 });
  withFakeRectangleMarker(({ made, returned }) => {
    decorations.blockFillMarkersFor(view, plugin);
    for (let i = 0; i < made.length; i++) {
      assertEq(made[i].left, returned[i].left, "ширина ноль — левый край там, где его дала платформа");
      assertEq(made[i].width, returned[i].width, "и ширина та же");
    }
  });
})();

(function testBubbleAtTheBlockEndKeepsTheGap() {
  /*
   * И четвёртое место того же приёма: промежуток до разделителя мерился со
   * сверкой вертикалей, а у блока, кончающегося пузырём тега, вертикали
   * последнего знака и разделителя разные — на одной и той же строке. Рост в
   * сторону разделителя пропадал молча, то есть ползунок `Band width` ничего
   * не делал.
   */
  const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
  const left = spans[0];
  const view = fakeViewWithCoords([LINE], null, [{ from: left.start, to: left.end }], null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 0, widthPct: 50 });
  withFakeRectangleMarker(({ made, returned }) => {
    decorations.blockFillMarkersFor(view, plugin);
    const gapPx = view.coordsAtPos(left.gapTo, 1).left
      - view.coordsAtPos(left.gapFrom, -1).right;
    assertTrue(gapPx > 0, "промежуток на подделке больше нуля: предмет есть");
    assertEq(made[0].width - returned[0].width, gapPx * 2,
      "блок, кончающийся пузырём, рост в сторону разделителя не теряет");
  });
})();

(function testGapIsDroppedWhenTheSeparatorWrappedAway() {
  /*
   * Обратная сторона предыдущей: разделитель, уехавший на другую зрительную
   * строку, промежутка не задаёт. Без этого условия расстояние считалось бы
   * между точками разных строк — величина бессмысленная и часто
   * отрицательная.
   *
   * Утверждение — **разница двух прогонов на одной фикстуре**: перенос ставится
   * ровно на первый разделитель, и вырасти после этого должен только правый
   * блок. Одного числа тут мало: «вырос один» бывает и от слепой проверки.
   */
  const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
  const left = spans[0];
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPct: 0, widthPct: 50 });

  const grown = (wraps) => withFakeRectangleMarker(({ made, returned }) => {
    decorations.blockFillMarkersFor(fakeViewWithCoords([LINE], wraps, null, null), plugin);
    let n = 0;
    for (let i = 0; i < made.length; i++) {
      if (Math.abs(made[i].width - returned[i].width) > 0.01) n += 1;
    }
    return n;
  });

  assertEq(grown(null), 2, "переноса нет — выросли оба блока");
  assertEq(grown([left.gapTo]), 1,
    "разделитель уехал на другую строку — левый блок роста не получил");
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
  let band = { enabled: true, opacity: 12, heightPct: 60, widthPct: 60 };
  let tags = {};
  const plugin = {
    getConfig: () => ({
      pkm: { lineFormat: { separator1: SEP, separator2: SEP } },
      visual: { tags: Object.assign({ blockFill: band }, tags) },
    }),
  };
  const ask = (u, d) => decorations.blockFillLayerNeedsRedraw(plugin, u, d);

  assertEq(ask(quiet, dom), true, "первый вопрос — перерисовать: подписи ещё не было");
  assertEq(ask(quiet, dom), false, "ничего не поменялось — перерисовывать нечего");

  band = { enabled: true, opacity: 12, heightPct: 100, widthPct: 60 };
  assertEq(ask(quiet, dom), true, "сдвинули высоту — слой перерисовывается");
  assertEq(ask(quiet, dom), false, "и успокаивается");

  band = { enabled: true, opacity: 12, heightPct: 100, widthPct: 20 };
  assertEq(ask(quiet, dom), true, "сдвинули ширину — тоже");

  /*
   * И размер пузыря: высота подложки берёт его слагаемым, значит его правка
   * обязана дойти до слоя. Без этой части подписи `Text size` доезжал бы до
   * подложки только после первой правки заметки (тот же У-56).
   */
  tags = { textSizePct: 60 };
  assertEq(ask(quiet, dom), true, "сдвинули размер текста блока — слой перерисовывается");
  tags = { textSizePct: 60, bubbleHeightPct: 40 };
  assertEq(ask(quiet, dom), true, "и высоту пузыря — тоже");

  /* А густота живёт в стилях, и слою до неё дела нет: перерисовки не будет. */
  band = { enabled: true, opacity: 90, heightPct: 100, widthPct: 20 };
  assertEq(ask(quiet, dom), false,
    "густота меняется правилом стилей, а не геометрией: слой не трогается");

  band = { enabled: false, opacity: 90, heightPct: 100, widthPct: 20 };
  assertEq(ask(quiet, dom), true, "выключили тумблер — слой убирает прямоугольники");
})();

(function testGrowthSurvivesNormalization() {
  const normalize = require(path.join(__dirname, "..", "..", "src", "core", "config_normalize.js"));
  const out = normalize.migrateConfig({
    schemaVersion: 2,
    visual: { tags: { blockFill: { enabled: true, heightPct: 900, widthPct: -20 } } },
  }).visual.tags.blockFill;
  assertEq(out.heightPct, visuals.BLOCK_FILL_MAX_HEIGHT_PCT,
    "высота выше шкалы прижимается к её верху");
  assertEq(out.widthPct, 0, "ширина ниже нуля прижимается к нулю");

  const fresh = normalize.migrateConfig({ schemaVersion: 2 }).visual.tags.blockFill;
  assertEq(fresh.heightPct, visuals.BLOCK_FILL_DEFAULT_HEIGHT_PCT,
    "умолчание высоты досыпается схемой, а не выдумывается слоем");
  assertEq(fresh.widthPct, visuals.BLOCK_FILL_DEFAULT_WIDTH_PCT, "и умолчание ширины тоже");
})();

(function testOldHeightInPointsBecomesShareOfTheRoom() {
  /*
   * Переезд ключа `heightPx` → `heightPct` на файле **версии 2**: карту
   * маршрутов такой файл не проходит вовсе, перевод делает третья ступень.
   * У заказчика в `data.json` стояла единица из пяти — она обязана стать
   * двадцатью процентами, то есть тем же видом на экране.
   */
  const normalize = require(path.join(__dirname, "..", "..", "src", "core", "config_normalize.js"));
  const moved = normalize.migrateConfig({
    schemaVersion: 2,
    visual: { tags: { blockFill: { enabled: true, heightPx: 1, widthPct: 100 } } },
  }).visual.tags.blockFill;
  assertEq(moved.heightPct, 20, "единица из пяти точек стала пятой частью шкалы");
  assertEq(moved.heightPx, undefined, "а старый ключ снят: иначе перевод случался бы каждый раз");
  assertEq(moved.widthPct, 100, "и соседнюю шкалу переезд не тронул");

  /* И то, что человек уже выставил в новой шкале, переезд не отменяет. */
  const kept = normalize.migrateConfig({
    schemaVersion: 2,
    visual: { tags: { blockFill: { enabled: true, heightPct: 40 } } },
  }).visual.tags.blockFill;
  assertEq(kept.heightPct, 40, "без старого ключа новое значение остаётся своим");
})();

console.log("Block fill regression tests: OK");
