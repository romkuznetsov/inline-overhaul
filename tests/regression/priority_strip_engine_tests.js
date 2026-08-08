"use strict";

const path = require("path");
const engine = require(path.join(__dirname, "..", "..", "src", "core", "priority_strip_engine.js"));

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name}: expected '${expected}' got '${actual}'`);
}

function assertTrue(v, name) {
  if (!v) throw new Error(`${name}: expected truthy`);
}

function buildSpecs(lines) {
  const tokenSet = new Set(["#/1", "#/2", "#/3", "#todo"]);
  const colorMap = {
    "#/1": "#e74c3c",
    "#/2": "#f39c12",
    "#/3": "#2ecc71",
    "#todo": "#1d4ed8",
  };
  return engine.buildStripSpecs(lines, {
    tokenSet,
    readRowForToken: (token) => ({ fillColor: colorMap[token] || "" }),
    isHardBoundary: (text) => !String(text || "").trim() || /^---+$/.test(String(text || "").trim()),
  });
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

  console.log("Priority strip engine tests: OK");
}

run();
