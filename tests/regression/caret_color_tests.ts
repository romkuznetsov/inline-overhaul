/**
 * Текстовый курсор: цвет, толщина и мерцание (PRD 10.13.33).
 *
 * Проверка на настоящих функциях плагина: `buildCaretStyleCss`,
 * `caretLookFromConfig` и `caretBlinkMsFromSpeed` берутся из `main.js`
 * загрузчиком `tests/harness/plugin_internals.ts`. Живого окна здесь нет и
 * быть не может, поэтому закреплено то, что от окна не зависит: **что уезжает
 * в блок стилей** и **когда он пуст**.
 *
 * Три объявления цвета — не перестраховка, а разбор (Ц3): Obsidian рисует
 * каретку сам (`.cm-cursor` с `border-left`), при выключенном `drawSelection`
 * показывается родная каретка браузера (`caret-color`), а часть тем читает
 * переменную `--caret-color`. Пин держит все три: пропади одно, и каретка
 * перестанет краситься у части людей, а у остальных всё будет хорошо, —
 * то есть дефект придёт замечанием через неделю.
 *
 * Толщина и мерцание — вторая половина группы, со своим тумблером (Ц6). Обе
 * прочитаны в `app.js` Obsidian 1.13.7, а не выведены из типов (У-44), и обе
 * закреплены по **целым строкам объявлений**, а не по вхождению подстроки:
 * `caret-color` есть начало `--caret-color`, и поиск подстрокой был зелёным
 * ровно тогда, когда из трёх объявлений оставалось одно (У-61).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { SCHEMA } from "../../src/ui/settings/schema/index.ts";
import { caretBlinkMs } from "../../src/ui/settings/custom/previews.ts";
/*
 * Настоящий `RectangleMarker` из `@codemirror/view`, а не его копия здесь.
 * Каретку меряет он, и меряет её ровно этим кодом: в `app.js` Obsidian
 * 1.13.7 объявление `forRange` **одно** на обе копии CodeMirror, и оно
 * совпадает со здешним (`coordsAtPos(head, assoc || 1)`). Написать своё
 * измерение значило бы проверять свою копию правила (У-4).
 */
import { Direction, RectangleMarker } from "@codemirror/view";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;
const I = loadPluginInternals();

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok " + what); };

/** Объявления блока стилей целыми строками: подстрокой тут искать нельзя. */
const linesOf = (css: string): Set<string> =>
  new Set(css.split("\n").map(l => l.trim()));

/* ---- что уезжает в блок стилей ----------------------------------------- */

{
  const css = I.buildCaretStyleCss({ color: "#ff0000" });
  const declared = linesOf(css);
  for (const line of ["--caret-color: #ff0000;", "caret-color: #ff0000;", "border-left-color: #ff0000;"]) {
    assert.ok(declared.has(line), "в блоке стилей нет объявления " + line + ":\n" + css);
  }
  for (const selector of [".cm-content", ".cm-cursor", ".cm-cursor-primary", ".cm-dropCursor"]) {
    assert.ok(css.includes(selector), "в блоке стилей нет селектора " + selector);
  }
  /* Только редактор: каретка в полях панели настроек остаётся своей (Ц4). */
  const stray = css.split("\n")
    .filter(l => l.trim().endsWith("{"))
    .filter(l => !l.includes(".markdown-source-view"));
  assert.deepEqual(stray, [], "правило вышло за пределы редактора:\n  " + stray.join("\n  "));
  ok("цвет уезжает тремя объявлениями и не выходит за редактор");
}

{
  assert.equal(I.buildCaretStyleCss({ color: "" }), "", "без цвета блок стилей обязан быть пуст");
  assert.equal(I.buildCaretStyleCss({ color: "   " }), "", "пробелы цветом не являются");
  assert.equal(I.buildCaretStyleCss({}), "", "пустой вид даёт пустой блок стилей");
  ok("пустой вид даёт пустой блок стилей, а не правило с пустотой");
}

/* ---- толщина: ширина рамки и парный сдвиг (Ц6) -------------------------- */

{
  const css = I.buildCaretStyleCss({ color: "", width: 4, blinkMs: NaN });
  const declared = linesOf(css);
  assert.ok(declared.has("border-left-width: 4px;"),
    "толщина не уехала в блок стилей:\n" + css);
  /*
   * Сдвиг — половина толщины, и он обязателен. У Obsidian стоит
   * `borderLeft: 1.2px` с парным `marginLeft: -0.6px`: он центрирует каретку
   * на границе символа. Толщина без сдвига роняет каретку вправо тем сильнее,
   * чем она толще, и заметно это только глазами — то есть придёт замечанием.
   */
  assert.ok(declared.has("margin-left: -2px;"),
    "сдвиг не пересчитан под толщину, каретка съедет вправо:\n" + css);
  assert.ok(!css.includes("border-left-color"),
    "цвет не задавали, а он объявлен: выключенная половина обязана молчать");

  const both = linesOf(I.buildCaretStyleCss({ color: "#00ff00", width: 3, blinkMs: NaN }));
  assert.ok(both.has("border-left-color: #00ff00;") && both.has("border-left-width: 3px;")
    && both.has("margin-left: -1.5px;"),
    "цвет и толщина вместе обязаны стоять в одном правиле");
  ok("толщина уезжает шириной рамки и парным сдвигом в половину неё");
}

/* ---- мерцание: длительность на слое, а не на каретке (Ц7) --------------- */

{
  const css = I.buildCaretStyleCss({ color: "", width: NaN, blinkMs: 800 });
  const declared = linesOf(css);
  /*
   * `!important` тут не украшение: CodeMirror пишет длительность прямо в
   * `style` узла `.cm-cursorLayer` (`animationDuration = cursorBlinkRate`),
   * а инлайновый стиль обычному правилу не уступает. Без `!important` строка
   * есть, а мерцание прежнее — то самое «не работает, а гейт зелёный».
   */
  assert.ok(declared.has("animation-duration: 800ms !important;"),
    "длительность мерцания не уехала или уехала без !important:\n" + css);
  assert.ok(css.includes(".cm-cursorLayer"),
    "мерцание объявлено не на слое каретки, а где-то ещё");

  const still = linesOf(I.buildCaretStyleCss({ color: "", width: NaN, blinkMs: 0 }));
  /*
   * «Не мигает» — это снятая анимация, а не нулевая длительность: ноль в CSS
   * означает «мгновенно», а не «никогда», и каретка от него замерла бы
   * невидимой ровно в половине случаев.
   */
  assert.ok(still.has("animation: none !important;"),
    "ноль обязан снимать анимацию, а не ставить нулевую длительность");
  assert.ok(!still.has("animation-duration: 0ms !important;"),
    "нулевая длительность оставила бы каретку мигать мгновенно");
  ok("мерцание задаётся на слое каретки, а ноль снимает анимацию целиком");
}

/* ---- своя каретка на строке без выделения (Ц9) -------------------------- */

{
  /*
   * Замечание заказчика 2026-09-06: «толщина и мерцание работают только когда
   * я выделяю текст». Причина прочитана в `app.js` 1.13.7: редактор заметки
   * собран на копии `drawSelection`, у которой слой каретки спрашивает
   * `range.empty ? !isMain : drawRangeCursor` — главный пустой отрезок она не
   * рисует вовсе, и курсор там родная каретка браузера. Из CSS у родной
   * настраивается только `caret-color`, поэтому цвет и работал.
   *
   * Закреплено то, что от окна не зависит: включённая форма заводит свой слой
   * и **гасит родную каретку**, а выключенная не делает ни того, ни другого.
   */
  const shaped = I.buildCaretStyleCss({ color: "", width: 4, blinkMs: 900 });
  const declared = linesOf(shaped);
  assert.ok(declared.has("caret-color: transparent;"),
    "родная каретка не погашена: своя встанет рядом с ней, и на строке будет две:\n" + shaped);
  assert.ok(shaped.includes(".io-editor-caretlayer") && shaped.includes(".io-editor-caret "),
    "правил своего слоя каретки в блоке стилей нет:\n" + shaped);
  /*
   * Класс каретки в заметке и класс каретки в предпросмотре панели обязаны
   * быть разными, и это не вкусовщина. У предпросмотра `.io-caret` — обычное
   * глобальное правило со своей высотой, своим `display` и **своей**
   * анимацией; возьми слой в заметке то же имя, и оно легло бы на его метки
   * поверх размеров, которые считает CodeMirror, а мерцаний стало бы два.
   * Первая версия правки так и была написана (У-65).
   */
  assert.ok(!/\.io-caret[\s{,]/.test(shaped),
    "каретка в заметке взяла класс предпросмотра панели:\n" + shaped);
  assert.ok(declared.has("border-left: 4px solid var(--caret-color);"),
    "своя каретка не получила толщину или взяла цвет литералом вместо переменной:\n" + shaped);
  assert.ok(declared.has("margin-left: -2px;"),
    "сдвиг своей каретки не пересчитан под толщину");
  assert.ok(declared.has("animation: steps(1) io-caret-blink 900ms infinite;"),
    "мерцание своего слоя не объявлено:\n" + shaped);

  /*
   * Ноль — «не мигает вовсе», и на своём слое это тоже снятая анимация, а не
   * нулевая длительность: с нулём каретка замирает невидимой в половине
   * случаев.
   */
  assert.ok(linesOf(I.buildCaretStyleCss({ color: "", width: 2, blinkMs: 0 })).has("animation: none;"),
    "ноль на своём слое обязан снимать анимацию");

  /*
   * Один цвет без формы родную каретку гасить не смеет: своей каретки в этом
   * случае нет, и человек остался бы вовсе без курсора. Это самый дорогой
   * способ ошибиться в этой правке, поэтому пин отдельный.
   */
  const colorOnly = I.buildCaretStyleCss({ color: "#ff0000", width: NaN, blinkMs: NaN });
  assert.ok(!colorOnly.includes("transparent"),
    "цвет без формы погасил родную каретку — курсора не останется вовсе:\n" + colorOnly);
  assert.ok(!colorOnly.includes(".io-caret"),
    "свой слой объявлен там, где его никто не рисует");

  /*
   * Имя кадров мерцания живёт в `styles.css`, а объявление анимации — в блоке
   * стилей. Разойдись они, и строка `animation` осталась бы на месте, а
   * каретка перестала бы мигать молча (У-56).
   *
   * Имя берётся **из самого объявления**, а не пишется в проверке вторым
   * литералом, и ищется **целым словом**: поиск подстрокой тут зелен ровно
   * тогда, когда мёртвое имя оказалось началом живого (У-61) — первая версия
   * этого пина так и не заметила переименованных кадров.
   */
  const named = /animation: steps\(1\) ([A-Za-z0-9_-]+) \d+ms infinite;/.exec(shaped);
  assert.ok(named, "в объявлении анимации не разобрать имя кадров:\n" + shaped);
  const cssFile = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
  assert.ok(new RegExp("@keyframes\\s+" + named![1] + "\\s*\\{").test(cssFile),
    "кадров " + named![1] + " нет в styles.css: анимация назвала бы несуществующее имя");

  ok("включённая форма заводит свой слой и гасит родную каретку, один цвет — нет");
}

{
  /*
   * Что именно рисует свой слой. Рисовать всё подряд нельзя: непустой отрезок
   * и вторые курсоры Obsidian рисует сам, и вторая каретка встала бы поверх
   * его собственной.
   */
  const plugin = (caret: Any): Any => ({ getConfig: () => ({ visual: { caret } }) });
  const state = (empty: boolean): Any => ({ selection: { main: { empty, head: 3 } } });
  const shapeOn = plugin({ shapeEnabled: true, width: 3, blinkSpeed: 5 });
  const shapeOff = plugin({ shapeEnabled: false, width: 3, blinkSpeed: 5 });

  assert.equal(I.caretShapeActive(shapeOn), true, "включённая форма не опознана");
  assert.equal(I.caretShapeActive(shapeOff), false, "выключенная форма опознана как включённая");
  assert.equal(I.caretShapeActive({ getConfig: () => { throw new Error("нет конфига"); } }), false,
    "без конфига слой обязан молчать, а не падать");

  assert.ok(I.caretLayerRangeFor(shapeOn, state(true)),
    "на строке без выделения своя каретка не рисуется — то самое замечание заказчика");
  assert.equal(I.caretLayerRangeFor(shapeOn, state(false)), null,
    "своя каретка рисуется поверх выделения, а там уже есть каретка Obsidian");
  assert.equal(I.caretLayerRangeFor(shapeOff, state(true)), null,
    "выключенная форма всё равно рисует свою каретку");
  assert.equal(I.caretLayerRangeFor(shapeOn, {}), null,
    "без выделения в состоянии слой обязан молчать");

  ok("свой слой рисует главный пустой отрезок и только его");
}

/* ---- сторона измерения на конце строки (Ц10) ---------------------------- */

{
  /*
   * Замечание заказчика 2026-09-06, критичный дефект: каретка «приклеена к
   * началу `i2n-floating button`», набранный текст появляется слева от неё, а
   * выключение кнопки «чинит» каретку.
   *
   * Причина не в кнопке и не в стилях: `forRange` меряет пустой отрезок
   * **справа** от позиции, а справа от конца строки стоит виджет кнопки со
   * своим отступом от текста. Поэтому на конце непустой строки отрезок
   * обязан просить измерение слева.
   */
  const plugin = (caret: Any): Any => ({ getConfig: () => ({ visual: { caret } }) });
  const shapeOn = plugin({ shapeEnabled: true, width: 3, blinkSpeed: 5 });

  /** Строки документа — списком: у документа редактора они и есть список. */
  const docOfLines = (lines: readonly string[]): Any => ({
    lineAt(pos: number): Any {
      let from = 0;
      for (const line of lines) {
        const to = from + line.length;
        if (pos <= to) return { from, to, text: line };
        from = to + 1;
      }
      throw new Error("позиция вне текста: " + pos);
    },
  });
  const stateAt = (lines: readonly string[], head: number): Any => ({
    doc: docOfLines(lines),
    selection: { main: { empty: true, head, anchor: head, assoc: 0 } },
  });

  /* «первая строка» — 13 символов, дальше пустая строка и ещё одна. */
  const lines = ["первая строка", "", "третья"];
  assert.equal(I.caretLayerRangeFor(shapeOn, stateAt(lines, 13)).assoc, -1,
    "на конце строки каретка меряется справа — там кнопка, а не текст");
  assert.notEqual(I.caretLayerRangeFor(shapeOn, stateAt(lines, 5)).assoc, -1,
    "внутри строки сторона измерения тронута зря");
  assert.notEqual(I.caretLayerRangeFor(shapeOn, stateAt(lines, 0)).assoc, -1,
    "в начале строки слева текста нет, и мерить оттуда нечего");
  assert.notEqual(I.caretLayerRangeFor(shapeOn, stateAt(lines, 14)).assoc, -1,
    "на пустой строке слева текста нет, и кнопка там не рисуется");
  assert.notEqual(I.caretLayerRangeFor(shapeOn, { selection: { main: { empty: true, head: 3 } } }).assoc, -1,
    "без документа сторону измерения решать не из чего");
  ok("на конце непустой строки каретка меряется слева, а не справа");
}

{
  /*
   * То же самое, но до конца: отрезок отдаётся настоящему `forRange`, и
   * проверяется **число**, которое увидит человек, — левая граница каретки.
   *
   * Подделано ровно одно и названо тем, что подделывает (У-1): окно. Его
   * `coordsAtPos` отвечает так же, как отвечает живое, когда за концом строки
   * стоит виджет с `side: 1`, — справа от позиции граница кнопки, слева
   * граница последнего символа. Это и есть разбор из `app.js`, а не догадка.
   */
  const TEXT_EDGE = 120;
  const BUTTON_EDGE = 132; /* `Distance from the text`, умолчание 12px */

  const windowWithFloatingButton = (): Any => ({
    textDirection: Direction.LTR,
    scaleX: 1,
    scaleY: 1,
    scrollDOM: {
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
      clientWidth: 800,
      scrollLeft: 0,
      scrollTop: 0,
    },
    coordsAtPos: (_pos: number, assoc: number): Any => {
      const left = assoc < 0 ? TEXT_EDGE : BUTTON_EDGE;
      return { left, right: left, top: 10, bottom: 26 };
    },
  });

  const plugin: Any = { getConfig: () => ({ visual: { caret: { shapeEnabled: true, width: 3, blinkSpeed: 5 } } }) };
  const state: Any = {
    doc: { lineAt: () => ({ from: 0, to: 13 }) },
    selection: { main: { empty: true, head: 13, anchor: 13, assoc: 0 } },
  };

  const range = I.caretLayerRangeFor(plugin, state);
  const markers = RectangleMarker.forRange(windowWithFloatingButton(), "io-editor-caret", range as Any);
  assert.equal(markers.length, 1, "каретка на конце строки не нарисовалась вовсе");
  const marker: Any = markers[0];
  assert.equal(marker.left, TEXT_EDGE,
    "каретка встала у начала плавающей кнопки, а не у последнего символа: "
    + marker.left + " вместо " + TEXT_EDGE);
  ok("каретка на конце строки встаёт у текста, а не у плавающей кнопки");
}

/* ---- скорость 0..10 в миллисекунды (Ц7) --------------------------------- */

{
  /*
   * Пятёрка — то, чем Obsidian мерцает сейчас (`cursorBlinkRate` 1200).
   * Это и есть умолчание слайдера: включённый тумблер сам по себе мерцание
   * не меняет, пока человек не подвинул ползунок.
   */
  assert.equal(I.caretBlinkMsFromSpeed(5), 1200, "пятёрка обязана совпадать с мерцанием Obsidian");
  assert.equal(I.caretBlinkMsFromSpeed(10), 200, "десятка — самое быстрое");
  assert.equal(I.caretBlinkMsFromSpeed(1), 2000, "единица — самое медленное");
  assert.ok(I.caretBlinkMsFromSpeed(3) > I.caretBlinkMsFromSpeed(7),
    "больше скорость — короче интервал, иначе ползунок читается наоборот");

  /*
   * Формула объявлена дважды — в `main.js` для заметки и в предпросмотре
   * панели, — и разойтись они молча не должны: предпросмотр показывал бы одно
   * мерцание, а заметка мигала бы другим (У-32).
   */
  for (const s of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    assert.equal(caretBlinkMs(s), I.caretBlinkMsFromSpeed(s),
      "предпросмотр и заметка считают скорость " + s + " по-разному");
  }
  ok("скорость переводится в миллисекунды одним правилом на панель и на заметку");
}

/* ---- когда красить и формовать нечем (Ц2, Ц6) --------------------------- */

{
  const cfg = (caret: Any): Any => ({ visual: { caret } });

  assert.equal(I.caretLookFromConfig(cfg({ enabled: true, color: "#00ff00" })).color, "#00ff00",
    "включённая функция обязана отдать свой цвет");
  assert.equal(I.caretLookFromConfig(cfg({ enabled: false, color: "#00ff00" })).color, "",
    "выключенная функция красит вопреки тумблеру");
  assert.equal(I.caretLookFromConfig(cfg({ enabled: true, color: "" })).color, "",
    "пусто означает «взять у темы», а не «покрасить пустотой»");
  assert.equal(I.caretLookFromConfig(cfg({ enabled: true, color: "красный" })).color, "",
    "не цвет обязан стать пустотой, а не уехать в стили как есть");
  assert.equal(I.caretLookFromConfig({}).color, "", "ветки в конфиге нет: красить нечем");

  /*
   * Две половины группы независимы. Форма без своего тумблера не объявляется
   * вовсе — иначе включённый цвет менял бы заодно толщину, о которой человека
   * не спрашивали.
   */
  const colorOnly = I.caretLookFromConfig(cfg({ enabled: true, color: "#00ff00", width: 5, blinkSpeed: 9 }));
  assert.ok(Number.isNaN(colorOnly.width), "форма поехала без своего тумблера");
  assert.ok(Number.isNaN(colorOnly.blinkMs), "мерцание поехало без своего тумблера");

  const shapeOnly = I.caretLookFromConfig(cfg({ enabled: false, color: "#00ff00", shapeEnabled: true, width: 5, blinkSpeed: 10 }));
  assert.equal(shapeOnly.color, "", "цвет поехал вопреки своему тумблеру");
  assert.equal(shapeOnly.width, 5, "толщина не доехала при включённой форме");
  assert.equal(shapeOnly.blinkMs, 200, "скорость не доехала при включённой форме");

  const stillCfg = I.caretLookFromConfig(cfg({ shapeEnabled: true, width: 2, blinkSpeed: 0 }));
  assert.equal(stillCfg.blinkMs, 0, "ноль обязан доехать нулём, а не превратиться в скорость");
  ok("цвет и форма читаются каждый своим тумблером и друг друга не включают");
}

/* ---- строки в панели (Ц1, Ц2, Ц6–Ц8) ------------------------------------ */

{
  const group = SCHEMA.find((g: Any) => g.id === "text-cursor");
  assert.ok(group, "группы `Text cursor` в схеме нет");
  assert.equal(group.tab, "visual", "группа встала не на ту вкладку: " + group.tab);
  assert.ok(group.intro, "у группы нет вводной фразы, а заказчик просил коллаут");
  assert.ok(group.tip, "у группы нет подсказки, а заказчик просил её отдельно");

  const byId = new Map((group.items || []).map((i: Any) => [i.id, i]));
  const toggle = byId.get("caret-enabled");
  const color = byId.get("caret-color");
  assert.ok(toggle && color, "в группе нет тумблера и поля цвета");
  assert.equal(toggle.default, false, "умолчание обязано быть выключенным (Ц2)");
  assert.equal(color.default, "", "умолчание цвета — пусто, то есть цвет темы");
  assert.ok(toggle.tip && color.tip, "у строки нет подсказки, а заказчик просил её у каждой");

  /* Поле цвета уходит вместе с выключенным тумблером: настраивать нечего. */
  assert.ok(color.visible, "поле цвета показывается при выключенной функции");
  assert.equal(color.visible.test({ get: (p: string) => p === "visual.caret.enabled" }), true,
    "при включённой функции поле цвета обязано быть видно");
  assert.equal(color.visible.test({ get: () => false }), false,
    "при выключенной функции поля цвета быть не должно");

  /* Вторая половина: форма, две её строки и предпросмотр (Ц6–Ц8). */
  const shape = byId.get("caret-shape");
  const width = byId.get("caret-width");
  const blink = byId.get("caret-blink");
  const preview = byId.get("caret-preview");
  assert.ok(shape && width && blink, "толщины и мерцания в группе нет");
  assert.equal(shape.default, false, "форма обязана быть выключена из коробки");
  assert.equal(width.default, 2, "умолчание толщины разошлось с описанным");
  assert.equal(blink.default, 5, "умолчание скорости обязано совпадать с мерцанием Obsidian");
  assert.equal(blink.min, 0, "ноль обязан быть достижим ползунком: это «не мигает»");
  assert.equal(width.min, 1, "нулевой толщины у каретки быть не может");
  assert.ok(width.tip && blink.tip && shape.tip, "у новых строк нет подсказок");

  for (const item of [width, blink]) {
    assert.ok(item.visible, "строка формы показывается при выключенном тумблере формы");
    assert.equal(item.visible.test({ get: (p: string) => p === "visual.caret.shapeEnabled" }), true,
      "при включённой форме строка обязана быть видна");
    assert.equal(item.visible.test({ get: () => false }), false,
      "при выключенной форме строки быть не должно");
  }

  assert.ok(preview, "предпросмотра каретки в группе нет, а заказчик просил его");
  assert.equal(preview.kind, "custom", "предпросмотр обязан быть своим блоком");
  ok("в группе `Text cursor` стоят цвет, форма, скорость и живой предпросмотр");
}

console.log("\n" + passed + " проверок пройдено");
