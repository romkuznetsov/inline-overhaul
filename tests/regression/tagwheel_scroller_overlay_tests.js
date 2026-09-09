"use strict";
/**
 * Коробка скроллера TagWheel: цвета из настроек (PRD 10.13.15, замечание
 * заказчика D6 от 2026-09-02).
 *
 * До этого коробка не читала **ни одной** настройки цвета: она была целиком
 * собрана из переменных темы, а подпись `Text color` обещала как раз её.
 *
 * Проверка на НАСТОЯЩЕМ оверлее: `createTagWheelScrollerOverlay` берётся из
 * `src/ui/tagwheel_scroller_overlay.js`. Подделан только DOM — оверлей живёт в
 * окне Obsidian, и другого способа посмотреть на его узлы нет (У-1). Подделка
 * решений не принимает: она создаёт узлы и запоминает стили.
 */

const path = require("path");

/* ---- DOM ровно в том объёме, в каком его зовёт оверлей ----------------- */

function makeNode(tag) {
  /*
   * **Переменные и список классов — тот же объём, в каком их зовёт оверлей**
   * (Р7, 2026-09-09): вид уехал в классы, цвета — в свойства `--io-*`.
   * Заглушка добрее браузера не бывает (У-45): `setProperty` запоминает,
   * `getPropertyValue` отдаёт, `classList` ведёт себя как список, а `className`
   * с ним согласован — иначе добавленный класс был бы невидим проверке.
   */
  const vars = {};
  const classes = new Set();
  const node = {
    tagName: String(tag || "div").toUpperCase(),
    children: [],
    style: {
      setProperty(k, v) { vars[k] = String(v); },
      removeProperty(k) { delete vars[k]; },
      getPropertyValue(k) { return vars[k] === undefined ? "" : vars[k]; },
    },
    classList: {
      add(...c) { c.forEach((x) => classes.add(x)); },
      remove(...c) { c.forEach((x) => classes.delete(x)); },
      contains(c) { return classes.has(c); },
    },
    textContent: "",
    appendChild(child) { node.children.push(child); return child; },
    removeChild(child) {
      const at = node.children.indexOf(child);
      if (at >= 0) node.children.splice(at, 1);
      return child;
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 }),
  };
  Object.defineProperty(node, "innerHTML", {
    get: () => "",
    set: () => { node.children.length = 0; },
  });
  Object.defineProperty(node, "className", {
    get: () => Array.from(classes).join(" "),
    set: (v) => {
      classes.clear();
      String(v || "").split(/\s+/).filter(Boolean).forEach((x) => classes.add(x));
    },
  });
  return node;
}

const body = makeNode("body");
globalThis.document = {
  body,
  createElement: (tag) => makeNode(tag),
  documentElement: makeNode("html"),
};
globalThis.window = { innerWidth: 1200, innerHeight: 800, setTimeout: (fn, ms) => setTimeout(fn, ms) };

const overlayMod = require(path.join(__dirname, "..", "..", "src", "ui", "tagwheel_scroller_overlay.js"));

let passed = 0;
function ok(what) { passed++; console.log("  ok " + what); }
function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

/**
 * Собрать оверлей, показать ему пару значений и вернуть то, что видно:
 * цвет коробки и цвета строк в ней.
 */
function paint(colors) {
  body.children.length = 0;
  const overlay = overlayMod.createTagWheelScrollerOverlay(Object.assign({
    direction: "down",
    size: 3,
  }, colors || {}));

  /*
   * Оверлей сам считает, где стоять: он просит у редактора смещение строки и
   * координаты у CodeMirror. Подделано ровно это — координаты. Решений
   * подделка не принимает.
   */
  const editor = {
    posToOffset: () => 0,
    cm: {
      coordsAtPos: () => ({ left: 10, top: 10, right: 60, bottom: 26 }),
      dom: null,
    },
  };

  overlay.update({
    editor,
    lineNumber: 0,
    controlLine: "==`#todo` **[work]**==",
    downItems: [{ label: "#todo" }, { label: "#doing" }],
    upItems: [],
  });

  /*
   * Коробки лежат в теле документа; берём ту, что показана. Показ — класс,
   * а не свойство узла (Р7): прежде здесь спрашивался `style.display`, и
   * после переноса этот вопрос не нашёл бы ни одной коробки — то есть
   * утверждение краснело бы не по делу (У-94).
   */
  const shown = body.children.filter(n => n.classList.contains("io-twscroller--shown"));
  if (!shown.length) throw new Error("оверлей не показал ни одной коробки");
  const box = shown[0];
  const rows = (box.children[0] || { children: [] }).children;
  return {
    fill: String(box.style.getPropertyValue("--io-twscroller-fill") || ""),
    rowColors: rows.map(r => String(r.style.getPropertyValue("--io-twscroller-text") || "")),
    rowTexts: rows.map(r => String(r.textContent || "")),
    boxClass: String(box.className || ""),
    rowClasses: rows.map(r => String(r.className || "")),
  };
}

/* ---- цвета из настроек ------------------------------------------------- */

/*
 * Ожидание выписано отдельно от того, из чего оно считается (У-5): здесь
 * названы сами цвета, а не пересчитан их разбор.
 */
{
  const painted = paint({ fillColor: "#988925", textColor: "#a5a0d4" });
  assertEq(painted.fill, "#988925", "коробка красится заданным фоном");
  assertEq(painted.rowColors.join(","), "#a5a0d4,#a5a0d4",
    "и строки — заданным цветом текста");
  assertEq(painted.rowTexts.join(","), "#todo,#doing",
    "а сами значения остались теми же");
  ok("D6: цвета скроллера доходят до коробки");
}

/* ---- пусто означает «взять у темы», а не «прозрачный» ------------------ */

/*
 * Обратная сторона, и она важнее прямой: пока человек цвета не задал, коробка
 * обязана выглядеть как раньше. Иначе правка меняет вид у всех, кто её не
 * просил (PRD 10.13.15 Н2).
 */
{
  const plain = paint({});
  assertEq(plain.fill, "", "без своего цвета оверлей не задаёт ничего");
  assertEq(plain.rowColors.join(","), ",",
    "и цвет строк не задаётся вовсе: " + JSON.stringify(plain.rowColors));
  /*
   * **И положительная половина** (У-71): «ничего не задано» без неё
   * выполнялось бы и у оверлея без фона вовсе. Умолчание «взять у темы»
   * переехало в само правило (Р7), и спрашивается оно там же, где живёт.
   */
  const css = require("fs").readFileSync(
    path.join(__dirname, "..", "..", "styles.css"), "utf8");
  assertEq(css.indexOf("var(--io-twscroller-fill, var(--background-primary))") >= 0, true,
    "фон коробки без своего цвета — фон темы, и это сказано правилом");
  assertEq(css.indexOf("var(--io-twscroller-text, inherit)") >= 0, true,
    "а цвет строк без своего — унаследованный, а не прозрачный");
  ok("пустой цвет означает «как в теме», а не «прозрачный»");
}

/* ---- вид живёт в классах, а не в свойствах узла (Р7) ---------- */

/*
 * Перенос закреплён швом, а не только планкой бюджета: планка знает
 * число, а не то, что именно уехало и нашло себе правило.
 */
{
  const painted = paint({ fillColor: "#988925", textColor: "#a5a0d4" });
  assertEq(painted.boxClass.split(/\s+/).includes("io-twscroller"), true,
    "коробка названа своим классом");
  assertEq(painted.rowClasses.join(","), "io-twscroller__row,io-twscroller__row",
    "и каждая строка тоже");
  const css = require("fs").readFileSync(
    path.join(__dirname, "..", "..", "styles.css"), "utf8");
  for (const cls of ["io-twscroller", "io-twscroller--shown", "io-twscroller__list",
    "io-twscroller__row", "io-twscroller__probe"]) {
    assertEq(css.indexOf("." + cls) >= 0, true,
      "у класса `" + cls + "` есть правило: иначе вид уехал в пустоту");
  }
  /*
   * И одно начертание на коробку и мерку длины строки: мерка считает
   * ширину коробки, и разное начертание здесь дало бы не ту ширину
   * молча (У-32).
   */
  assertEq(/\.io-twscroller,\s*\n\.io-twscroller__probe \{/.test(css), true,
    "начертание объявлено одним правилом на коробку и на мерку");
  ok("Р7: вид оверлея живёт в классах, а цвета — в переменных");
}

/* ---- мусор не доезжает до стиля --------------------------------------- */

/*
 * Форма проверяется и здесь, и в `tagwheel.js`, и это не дублирование
 * правила: там она нужна, чтобы в оверлей не уехало лишнее, а здесь — чтобы
 * оверлей не сломался от чужого вызова. Браузер на неверный цвет молча
 * оставляет прежний, и такую ошибку ищут глазами.
 */
{
  const junk = paint({ fillColor: "красный", textColor: "#12345" });
  assertEq(junk.fill, "", "мусор в фоне не становится цветом, и коробка уступает теме");
  assertEq(junk.rowColors.join(","), ",", "и короткий hex не становится цветом строк");
  ok("неверный цвет не доезжает до стиля");
}

console.log("\n" + passed + " проверок пройдено");
