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
  const node = {
    tagName: String(tag || "div").toUpperCase(),
    children: [],
    style: {},
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

  /* Коробки лежат в теле документа; берём ту, что показана. */
  const shown = body.children.filter(n => n.style.display === "block");
  if (!shown.length) throw new Error("оверлей не показал ни одной коробки");
  const box = shown[0];
  const rows = (box.children[0] || { children: [] }).children;
  return {
    fill: String(box.style.background || ""),
    rowColors: rows.map(r => String(r.style.color || "")),
    rowTexts: rows.map(r => String(r.textContent || "")),
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
  assertEq(plain.fill, "var(--background-primary)",
    "без своего цвета коробка берёт фон темы");
  assertEq(plain.rowColors.join(","), ",",
    "и цвет строк не задаётся вовсе: " + JSON.stringify(plain.rowColors));
  ok("пустой цвет означает «как в теме», а не «прозрачный»");
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
  assertEq(junk.fill, "var(--background-primary)", "мусор в фоне уступает теме");
  assertEq(junk.rowColors.join(","), ",", "и короткий hex не становится цветом строк");
  ok("неверный цвет не доезжает до стиля");
}

console.log("\n" + passed + " проверок пройдено");
