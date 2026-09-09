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

/**
 * Тот же поддельный документ, плюс измерения, которые спрашивает слой.
 *
 * `wraps` — положения, с которых начинается новая **зрительная** строка.
 * `bubbles` — отрезки, у которых своя высота: так рисуется пузырь тега, и
 * вертикаль его положений отличается от вертикали обычного текста **на той же**
 * зрительной строке.
 *
 * **Пузыри тут — не украшение фикстуры, а починка** (У-47). Прежняя фикстура
 * отдавала одну вертикаль на всю зрительную строку, то есть ровно то, чего в
 * редакторе не бывает: слой сравнивал вертикали, читал разницу пузыря как
 * перенос и рвал блок на кусок под каждым значением. Проверки при этом были
 * зелёные, а заказчик написал «полоска идёт с разрывами… для values=tags и
 * values=wikilink она рисуется на разной высоте».
 *
 * Границы зрительных строк фикстура отдаёт **тем же швом, каким их отдаёт
 * платформа** — `moveToLineBoundary`.
 */
function fakeViewWithCoords(lines, wraps, bubbles) {
  const view = fakeView(lines);
  const cuts = (Array.isArray(wraps) ? wraps : (wraps == null ? [] : [wraps]))
    .map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const bumps = Array.isArray(bubbles) ? bubbles : [];
  const docEnd = lines.reduce((at, text) => at + text.length + 1, 0) - 1;
  const rowOf = (pos) => cuts.filter((c) => c <= pos).length;
  const inBubble = (pos) => bumps.some((b) => pos >= b.from && pos < b.to);
  /*
   * **Сторона обязательна** (У-76): платформа меряет либо знак ПЕРЕД
   * положением (сторона меньше нуля), либо знак НА нём. Фикстура, мерившая
   * одинаково, слепа к вертикали края блока — а именно на ней и терялся рост
   * подложки в сторону разделителя.
   */
  view.coordsAtPos = (pos, side) => {
    const at = Number(side) < 0 ? Math.max(0, pos - 1) : pos;
    const top = 100 + rowOf(at) * 20 + (inBubble(at) ? 2 : 0);
    return { left: at * 10, right: at * 10 + 8, top, bottom: top + 20 };
  };
  view.moveToLineBoundary = (at, forward, includeWrap) => {
    if (forward !== true || includeWrap !== true) throw new Error("слой спрашивает конец строки вперёд и с переносом");
    const head = Number(at && at.head);
    const next = cuts.find((c) => c > head);
    return { head: next === undefined ? docEnd : next };
  };
  return view;
}

(function testWholeSpanGoesToThePlatformAsOnePiece() {
  const view = fakeViewWithCoords([LINE], null, null);
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
  const view = fakeViewWithCoords([LINE], null, bubbles);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 0, widthPct: 0 });
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
  const view = fakeViewWithCoords([line], [wrap], null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 0, widthPct: 0 });

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
  const view = fakeViewWithCoords([line], [wrap], null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 0, widthPct: 0 });
  withFakeRectangleMarker(({ asked }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(asked.slice(1), [
      { from: right.start, to: wrap },
      { from: wrap, to: right.end },
    ], "значение, перенесённое само, тоже режется по зрительной строке");
  });
})();

(function testGrowthGoesOnlyTowardsTheSeparator() {
  /*
   * **Его слова:** «полоска захватывает i2n-floating — а не должна, она должна
   * заканчиваться на последнем value right block». Рост односторонний: у
   * левого блока вправо, к разделителю, у правого влево, к нему же. Наружный
   * край блока стоит на его крайнем значении.
   */
  const view = fakeViewWithCoords([LINE], null, null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 4, widthPct: 100 });
  withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(made.length, 2, "по прямоугольнику на сторону");

    const spans = visuals.blockFillSpansInLine(LINE, SEP, SEP, MARKERS);
    /*
     * Промежуток **спрашивается у той же фикстуры**, что меряет его слою:
     * пересчитать его тут значило бы объявить второе правило (У-32) — и
     * разошлось бы оно на первой же поправке к подделке.
     */
    const gapPx = view.coordsAtPos(spans[0].gapTo, 1).left
      - view.coordsAtPos(spans[0].gapFrom, -1).right;
    assertTrue(gapPx > 0, "промежуток на подделке больше нуля");

    const bare = (i) => ({
      left: spans[i].start * 10,
      width: (spans[i].end - spans[i].start) * 10,
    });

    /* Левый блок: наружный край на месте, к разделителю выросло. */
    assertEq(made[0].left, bare(0).left,
      "левый блок начинается там же, где его первое значение: наружу подложка не растёт");
    assertEq(made[0].width, bare(0).width + gapPx,
      "и вырос он ровно на промежуток, и только в сторону разделителя");

    /* Правый блок — зеркально: влево выросло, правый край на месте. */
    assertEq(made[1].left, bare(1).left - gapPx,
      "правый блок вырос влево, к разделителю");
    assertEq(made[1].width, bare(1).width + gapPx,
      "и наружу не вырос: подложка кончается на последнем значении");

    /* Высота растёт в обе стороны: у неё границы снаружи нет. */
    assertEq(made[0].top, 100 - 4, "вверх — на заданные точки");
    assertEq(made[0].height, 20 + 4 * 2, "и в высоту на них же с обеих сторон");

    /* У-110: величины и правда изменились, иначе проверка мерит пустоту. */
    assertTrue(made[0].width > bare(0).width, "ширина и правда стала больше");
    assertTrue(made[0].height > 20, "и высота тоже");
  });
})();

(function testGrowthTouchesOnlyThePieceNextToTheSeparator() {
  /*
   * Положительный контроль к односторонности на перенесённом блоке: рост
   * достаётся тому куску, который разделителя касается, а не каждому. Иначе
   * подложка выросла бы посреди строки, в месте переноса.
   */
  const line = "- #a " + SEP + " text " + SEP + " #one #two";
  const spans = visuals.blockFillSpansInLine(line, SEP, SEP, MARKERS);
  const right = spans[1];
  const wrap = line.indexOf("#two");
  const view = fakeViewWithCoords([line], [wrap], null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 0, widthPct: 100 });
  withFakeRectangleMarker(({ asked, made }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(asked, [
      { from: spans[0].start, to: spans[0].end },
      { from: right.start, to: wrap },
      { from: wrap, to: right.end },
    ], "три куска: левая сторона и две зрительные строки правой");
    /*
     * Пересобраны **два** прямоугольника из трёх: левая сторона и первый кусок
     * правой. Перенесённый кусок платформа вернула, и слой его не тронул — то
     * есть рост и правда достался только тем краям, что смотрят на
     * разделитель.
     */
    assertEq(made.length, 2, "рост достался двум кускам из трёх");
    const gapPx = view.coordsAtPos(right.start, 1).left
      - view.coordsAtPos(right.gapFrom, -1).right;
    assertTrue(gapPx > 0, "промежуток измерен: предмет есть");
    assertEq(made[1].left, right.start * 10 - gapPx,
      "первый кусок правого блока вырос влево, к разделителю");
  });
})();

(function testGrowthIsZeroWhenTheSliderIsZero() {
  /*
   * Тот же случай при нулевой ширине: прямоугольник обязан остаться тем, что
   * вернула платформа. Без этого «вырос на промежуток» выполнялось бы и
   * ростом, которого человек не просил.
   */
  const view = fakeViewWithCoords([LINE], null, null);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 0, widthPct: 0 });
  withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(view, plugin);
    assertEq(made.length, 0, "ширина ноль и высота ноль — расти нечему");
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
  const view = fakeViewWithCoords([LINE], null, [{ from: left.start, to: left.end }]);
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 0, widthPct: 100 });
  withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(view, plugin);
    const gapPx = view.coordsAtPos(left.gapTo, 1).left
      - view.coordsAtPos(left.gapFrom, -1).right;
    assertTrue(gapPx > 0, "промежуток на подделке больше нуля: предмет есть");
    assertEq(made[0].width, (left.end - left.start) * 10 + gapPx,
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
  const plugin = fakePlugin({ enabled: true, opacity: 12, heightPx: 0, widthPct: 100 });

  const grown = (wraps) => withFakeRectangleMarker(({ made }) => {
    decorations.blockFillMarkersFor(fakeViewWithCoords([LINE], wraps, null), plugin);
    return made.length;
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
