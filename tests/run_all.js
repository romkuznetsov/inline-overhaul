"use strict";
/**
 * Одна команда на все тесты (PRD фаза 0, пункт 3).
 *
 * Запускает каждый файл с именем на _tests.js или _tests.ts внутри tests/
 * в своём процессе и печатает сводку.
 * Пропуски объявлены здесь списком и печатаются громко: тихо пропущенный
 * тест — это тест, которого нет.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");

/**
 * Почему пропущено — обязательная часть записи, а не комментарий.
 *
 * Список пуст с 2026-09-01. Последним в нём был
 * `status_runtime_behavior_tests.js` (A15): он падал не на своём предмете, а на
 * загрузке — вне Obsidian плагин не находил собственные модули. Причина снята в
 * `src/core/vault_module_bridge.js`, тест включён, все 60 его проверок зелёные.
 */
const SKIP = {};

function collect(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "fixtures" || name === "prototype") continue;
      collect(p, out);
    } else if (/_tests\.(js|ts)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * **Отбор по подстроке имени — только для итерации** (его решение 2026-09-21).
 *
 * Полный прогон идёт минуту, и правка одной проверки стоила минуты ожидания
 * каждый раз. `npm test -- tagwheel` гоняет то, что названо, за секунду.
 *
 * **Отбор не бывает тихим.** Пропуск, о котором не сказано вслух, — это тест,
 * которого нет (A15), и та же опасность здесь: прогон «зелёный» после отбора
 * читался бы как полный. Поэтому при отборе печатается, сколько файлов взято
 * из скольких, а итоговая строка говорит, что набор был неполон. Перед каждым
 * коммитом гоняется полный — это правило, а не привычка.
 */
const PICK = process.argv.slice(2).filter((a) => !a.startsWith("-"));

const allFiles = collect(path.join(root, "tests"), []).sort();
const files = PICK.length
  ? allFiles.filter((f) => PICK.some((p) => path.basename(f).includes(p)))
  : allFiles;

if (PICK.length) {
  console.log("отбор по " + JSON.stringify(PICK) + ": взято "
    + files.length + " файлов из " + allFiles.length);
  if (!files.length) {
    console.log("НАБОР НЕПОЛОН: под отбор не подошёл ни один файл");
    process.exit(1);
  }
}

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

console.log("\n" + passed + " passed, " + failed + " failed, " + skipped + " skipped"
  + (PICK.length ? "  — НАБОР НЕПОЛОН: мимо прошло " + (allFiles.length - files.length) + " файлов" : ""));
process.exit(failed ? 1 : 0);
