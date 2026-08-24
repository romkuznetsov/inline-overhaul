"use strict";
/**
 * Одна команда на все тесты (PRD фаза 0, пункт 3).
 *
 * Запускает каждый tests/**\/*_tests.js в своём процессе и печатает сводку.
 * Пропуски объявлены здесь списком и печатаются громко: тихо пропущенный
 * тест — это тест, которого нет.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");

/** Почему пропущено — обязательная часть записи, а не комментарий. */
const SKIP = {
  "status_runtime_behavior_tests.js":
    "падает на чистом чекауте до наших правок: vault_module_bridge не находит " +
    "модуль по пути вида .obsidian/plugins/... в этом окружении. Файл под " +
    "запретом З3, и в фазе 6 сам мост удаляется (A1, A2). Включить обратно " +
    "после фазы 6 или отдельным разбором.",
};

function collect(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "fixtures" || name === "prototype") continue;
      collect(p, out);
    } else if (/_tests\.js$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const files = collect(path.join(root, "tests"), []).sort();
let failed = 0, passed = 0, skipped = 0;

for (const file of files) {
  const name = path.basename(file);
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (SKIP[name]) {
    skipped++;
    console.log("SKIP  " + rel);
    console.log("      " + SKIP[name]);
    continue;
  }
  const r = spawnSync(process.execPath, [file], { cwd: root, encoding: "utf8", timeout: 180000 });
  if (r.status === 0) {
    passed++;
    console.log("ok    " + rel);
  } else {
    failed++;
    console.log("FAIL  " + rel);
    const out = ((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-12);
    out.forEach(l => console.log("      " + l));
  }
}

console.log("\n" + passed + " passed, " + failed + " failed, " + skipped + " skipped");
process.exit(failed ? 1 : 0);
