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

console.log("Block fill regression tests: OK");
