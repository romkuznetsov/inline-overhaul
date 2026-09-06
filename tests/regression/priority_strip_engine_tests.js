"use strict";

const path = require("path");
const engine = require(path.join(__dirname, "..", "..", "src", "core", "priority_strip_engine.js"));

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name}: expected '${expected}' got '${actual}'`);
}

function assertTrue(v, name) {
  if (!v) throw new Error(`${name}: expected truthy`);
}

function buildSpecs(lines, over) {
  const tokenSet = new Set(["#/1", "#/2", "#/3", "#todo"]);
  const colorMap = {
    "#/1": "#e74c3c",
    "#/2": "#f39c12",
    "#/3": "#2ecc71",
    "#todo": "#1d4ed8",
  };
  return engine.buildStripSpecs(lines, Object.assign({
    tokenSet,
    readRowForToken: (token) => ({ fillColor: colorMap[token] || "" }),
    isHardBoundary: (text) => !String(text || "").trim() || /^---+$/.test(String(text || "").trim()),
  }, over || {}));
}

function run() {
  {
    const specs = buildSpecs([{ lineNo: 1, text: "#/1 :: a" }]);
    assertEq(specs.length, 1, "non-list own spec count");
    assertEq(specs[0].mode, "standalone-own", "non-list mode");
    assertEq(specs[0].rails.length, 1, "non-list own rails count");
    assertEq(specs[0].rails[0].role, "own", "non-list own role");
  }

  {
    const specs = buildSpecs([{ lineNo: 1, text: "- #/1 :: a" }]);
    assertEq(specs.length, 1, "own-only spec count");
    assertEq(specs[0].mode, "list-own", "list own mode");
    assertEq(specs[0].rails.length, 1, "own-only rails count");
    assertEq(specs[0].rails[0].role, "own", "own-only role");
  }

  {
    const specs = buildSpecs([
      { lineNo: 1, text: "- #/1 :: a" },
      { lineNo: 2, text: "  - child no token" },
    ]);
    assertEq(specs.length, 2, "inherit-only spec count");
    assertEq(specs[1].mode, "list-inherit", "inherit-only mode");
    assertEq(specs[1].rails.length, 1, "inherit-only rails count");
    assertEq(specs[1].rails[0].role, "inherit", "inherit-only role");
  }

  {
    const specs = buildSpecs([
      { lineNo: 1, text: "- #/1 :: a" },
      { lineNo: 2, text: "  - #/2 child" },
    ]);
    assertEq(specs.length, 2, "own+inherit spec count");
    assertEq(specs[1].mode, "list-own+inherit", "own+inherit mode");
    assertEq(specs[1].rails.length, 2, "own+inherit rails count");
    assertEq(specs[1].rails[0].role, "inherit", "own+inherit first role");
    assertEq(specs[1].rails[1].role, "own", "own+inherit second role");
  }

  {
    const specs = buildSpecs([
      { lineNo: 1, text: "- #/1 :: a" },
      { lineNo: 2, text: "---" },
      { lineNo: 3, text: "  - child no token" },
    ]);
    assertEq(specs.length, 1, "boundary reset spec count");
    assertEq(specs[0].lineNo, 1, "boundary reset keeps only first line" );
  }

  {
    const specs = buildSpecs([
      { lineNo: 1, text: "#/1 #todo :: mixed" },
    ]);
    assertEq(specs.length, 1, "mixed non-list count");
    assertEq(specs[0].mode, "standalone-own", "mixed non-list mode");
    assertEq(specs[0].ownToken, "#/1", "mixed non-list first matched token");
  }

  {
    const specs = buildSpecs([
      { lineNo: 1, text: "- #/1 #todo mixed" },
      { lineNo: 2, text: "- #todo sibling" },
    ]);
    assertTrue(specs.length >= 2, "mixed-neighbor coverage");
  }

  /*
   * Слитное дерево и зазор между полосами (PRD 10.13.16, замечание B22
   * второго захода).
   *
   * Зазор появился заходом раньше: полосы двух родительских строк подряд
   * стыковались и читались как одна. У дерева тот же зазор рвёт полосу,
   * которая по смыслу непрерывна, — и заказчик попросил опцию, снимающую его
   * там. «Полоса продолжается» считает движок; вёрстка читает только пометку.
   */
  {
    const specs = buildSpecs([
      { lineNo: 1, text: "- #/1 parent" },
      { lineNo: 2, text: "\t- #/2 child" },
      { lineNo: 3, text: "\t\t- #/3 grandchild" },
    ]);
    assertEq(specs.length, 3, "tree run: spec count");
    assertTrue(specs[0].inTree, "tree run: parent joins the run below");
    assertTrue(specs[1].inTree, "tree run: child joins on both sides");
    assertTrue(specs[2].inTree, "tree run: grandchild joins the run above");
    assertTrue(specs[0].joinsBelow, "tree run: parent hands the bar down");
    assertTrue(specs[2].joinsAbove, "tree run: grandchild takes it from above");
  }

  {
    /* Обратная сторона: две несвязанные строки подряд зазор сохраняют — иначе
       вернулось бы то, на что заказчик жаловался первым. */
    const specs = buildSpecs([
      { lineNo: 1, text: "- #/1 first parent" },
      { lineNo: 2, text: "- #/2 second parent" },
    ]);
    assertEq(specs.length, 2, "siblings: spec count");
    assertTrue(!specs[0].inTree, "siblings: first keeps its gap");
    assertTrue(!specs[1].inTree, "siblings: second keeps its gap");
  }

  {
    /* Родительская, дочерняя, снова родительская: у средней связь только
       сверху, у последней — никакой. Это второй случай из замечания. */
    const specs = buildSpecs([
      { lineNo: 1, text: "- #/1 parent" },
      { lineNo: 2, text: "\t- #/2 child" },
      { lineNo: 3, text: "- #/3 next parent" },
    ]);
    assertEq(specs.length, 3, "parent-child-parent: spec count");
    assertTrue(specs[0].inTree, "parent-child-parent: first is in the run");
    assertTrue(specs[1].inTree, "parent-child-parent: child is in the run");
    assertTrue(!specs[2].inTree, "parent-child-parent: the next parent is not");
  }

  {
    /* Границы слайдера и умолчания: ноль остаётся нулём, лишнее отсекается. */
    assertEq(engine.normalizeStripConfig({}).lineGap, 2, "lineGap default");
    assertEq(engine.normalizeStripConfig({}).joinTree, true, "joinTree default");
    assertEq(engine.normalizeStripConfig({ lineGap: 0 }).lineGap, 0, "lineGap zero survives");
    assertEq(engine.normalizeStripConfig({ lineGap: 99 }).lineGap, 8, "lineGap clamped up");
    assertEq(engine.normalizeStripConfig({ lineGap: -5 }).lineGap, 0, "lineGap clamped down");
    assertEq(engine.normalizeStripConfig({ joinTree: false }).joinTree, false, "joinTree can be off");
  }

  {
    /* Адаптер: у строки дерева зазор снят, у одиночной — нет, и выключенный
       тумблер возвращает зазор всем. Проверяется то, что уезжает в стиль. */
    const adapter = require(path.join(__dirname, "..", "..", "src", "core", "priority_strip_cm6_adapter.js"));
    const rails = [{ color: "#e74c3c", role: "own" }];
    const gapOf = (spec, cfg) => {
      const style = adapter.buildStripLineStyle(spec, cfg);
      const hit = /--io-strip-line-gap:(-?\d+)px/.exec(style);
      return hit ? Number(hit[1]) : null;
    };
    const cfg = { thickness: 2, spacing: 20, childOffset: 12, lineGap: 3, joinTree: true };
    assertEq(gapOf({ rails, inTree: false }, cfg), 3, "adapter: lone line keeps the gap");
    assertEq(gapOf({ rails, inTree: true }, cfg), 0, "adapter: tree line loses it");
    assertEq(gapOf({ rails, inTree: true }, { ...cfg, joinTree: false }), 3,
      "adapter: with the toggle off the gap comes back");
  }

  /*
   * H1: полоса дочерней строки доходит до её поддерева (PRD 10.13.21).
   *
   * Замечание заказчика: «bar дочерней и внучатой строки применяются только
   * для своей строки». Спрашиваются **цвета рельсов внучатой строки**, а не
   * их число: прежняя проверка держала ровно то, что делала заплатка («у
   * строки без значения один рельс»), и была зелёной при неработающей
   * функции.
   */
  {
    const specs = buildSpecs([
      { lineNo: 1, text: "- #/1 parent" },
      { lineNo: 2, text: "\t- #/2 child" },
      { lineNo: 3, text: "\t\t- grandchild" },
    ]);
    assertEq(specs.length, 3, "subtree: spec count");
    const rails = specs[2].rails.map((r) => r.color).join(",");
    assertEq(rails, "#e74c3c,#f39c12",
      "у внучатой строки полосы родителя И дочки, в этом порядке");
    assertEq(specs[2].rails.map((r) => r.role).join(","), "inherit,inherit",
      "обе унаследованы: своего значения у строки нет");
  }

  {
    /* `Number of Bars` = 1 по-прежнему оставляет одну полосу верхней строки. */
    const specs = buildSpecs([
      { lineNo: 1, text: "- #/1 parent" },
      { lineNo: 2, text: "\t- #/2 child" },
      { lineNo: 3, text: "\t\t- grandchild" },
    ], { stripesToShow: 1 });
    assertEq(specs.map((s) => s.rails.map((r) => r.color).join("+")).join(" "),
      "#e74c3c #e74c3c #e74c3c",
      "при одной полосе у всех трёх строк цвет верхней");
  }

  {
    /* Обратная сторона добивки повтором: одинаковых рельсов не бывает. */
    const specs = buildSpecs([
      { lineNo: 1, text: "- #/1 parent" },
      { lineNo: 2, text: "  - child no token" },
    ], { stripesToShow: 3 });
    assertEq(specs[1].rails.length, 1,
      "над строкой один уровень — один рельс, а не три одинаковых");
  }

  {
    /* Выключенный `Draw bars for the whole tree`: полоса только у своей строки. */
    const specs = buildSpecs([
      { lineNo: 1, text: "- #/1 parent" },
      { lineNo: 2, text: "\t- #/2 child" },
      { lineNo: 3, text: "\t\t- grandchild" },
    ], { drawWholeTree: false });
    assertEq(specs.length, 2, "строка без своего значения полосы не получает вовсе");
    assertEq(specs.map((s) => s.lineNo + ":" + s.rails.map((r) => r.color).join("+")).join(" "),
      "1:#e74c3c 2:#f39c12",
      "у каждой строки её собственный цвет и ровно один рельс");
    assertEq(specs.some((s) => s.inTree), false,
      "и слитного дерева нет: полоса из строки в строку не переходит");
    assertEq(engine.normalizeStripConfig({}).drawWholeTree, true,
      "умолчание включено: выключенное отменило бы поведение родителя (У-57)");
    assertEq(engine.normalizeStripConfig({ drawWholeTree: false }).drawWholeTree, false,
      "и тумблер можно выключить");
  }

  console.log("Priority strip engine tests: OK");
}

run();
