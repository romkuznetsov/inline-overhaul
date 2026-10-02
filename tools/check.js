"use strict";
/**
 * **Всё, что гоняется перед коммитом, — одной командой** (ревизия 2026-10-03,
 * Э-3): `npm run check`.
 *
 * Сборка идёт первой и одна: набор и проверки прототипа читают её результат.
 * Остальные пять шагов независимы и идут одновременно — друг за другом они
 * стоили около двух минут. Вывод шага печатается целиком, только если шаг
 * упал; код выхода — ненулевой, если упал хоть один.
 *
 * Браузерный шаг сюда не входит нарочно: он гоняется руками и по одному
 * (`CLAUDE.md`, «Проверки»).
 */
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const node = (...args) => [process.execPath, args];
const STEPS = {
  lint: node("node_modules/eslint/bin/eslint.js", "."),
  typecheck: node("node_modules/typescript/bin/tsc", "--noEmit"),
  test: node("tests/run_all.js"),
  gate: node("tests/gates/settings_layer_gates.ts"),
  "gate:prototype": node("tests/prototype/run_all.js"),
};

function run(name, [cmd, args]) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: root });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (code) => resolve({ name, code, out, s: ((Date.now() - t0) / 1000).toFixed(0) }));
  });
}

async function main() {
  const build = await run("build", node("tools/build/release.js"));
  const results = build.code === 0
    ? await Promise.all(Object.entries(STEPS).map(([n, s]) => run(n, s)))
    : [];
  let failed = 0;
  for (const r of [build, ...results]) {
    if (r.code !== 0) { failed++; console.log("\n---- " + r.name + "\n" + r.out.trim()); }
  }
  console.log("");
  for (const r of [build, ...results]) console.log((r.code === 0 ? "ok    " : "FAIL  ") + r.name + "  " + r.s + " с");
  if (build.code !== 0) console.log("сборка упала — остальные шаги не запускались");
  process.exit(failed ? 1 : 0);
}

main();
