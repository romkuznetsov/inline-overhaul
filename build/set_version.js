"use strict";

/**
 * Номер версии задаётся одной командой:
 *
 *     node build/set_version.js 0.1.0-beta.2
 *
 * **Зачем.** Версия записана в четырёх файлах, и до 2026-09-06 её правили
 * руками. Ровно этот ритуал и стоил августовскому релизу забытого
 * `styles.css`: когда шагов много, забывается тот, который не кричит.
 * `versions.json` — карта «версия плагина → минимальная версия Obsidian», её
 * читает сам Obsidian, поэтому новая строка туда добавляется, а старые
 * остаются: они про прошлые выпуски.
 *
 * Сверку всех четырёх мест держит `tests/regression/version_consistency_tests.js`.
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

/** Номер версии плагина. Obsidian ждёт `x.y.z`, суффикс беты разрешён. */
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

/** Пишем с тем же отступом и переводом строки, каким файл лежит: иначе правка
 *  версии в две цифры даёт diff во весь файл. */
function writeJson(rel, value) {
  fs.writeFileSync(path.join(root, rel), JSON.stringify(value, null, 2) + "\n");
}

function main(argv) {
  const next = String(argv[0] || "").trim();
  if (!next) {
    console.error("укажите версию: node build/set_version.js <версия>");
    console.error("сейчас в manifest.json: " + readJson("manifest.json").version);
    process.exit(1);
  }
  if (!SEMVER.test(next)) {
    console.error("не похоже на номер версии: " + JSON.stringify(next));
    console.error("ожидается x.y.z, при желании с суффиксом: 0.1.0-beta.2");
    process.exit(1);
  }

  const manifest = readJson("manifest.json");
  const previous = manifest.version;
  if (previous === next) {
    console.error("версия уже " + next + " — менять нечего");
    process.exit(1);
  }

  manifest.version = next;
  writeJson("manifest.json", manifest);

  const pkg = readJson("package.json");
  pkg.version = next;
  writeJson("package.json", pkg);

  const lock = readJson("package-lock.json");
  lock.version = next;
  if (lock.packages && lock.packages[""]) lock.packages[""].version = next;
  writeJson("package-lock.json", lock);

  /* Старые строки остаются: карта версий — история, а не текущее состояние. */
  const versions = readJson("versions.json");
  versions[next] = manifest.minAppVersion;
  writeJson("versions.json", versions);

  console.log("версия: " + previous + " → " + next);
  console.log("правлены manifest.json, package.json, package-lock.json, versions.json");
  /* Тег **без** `v`: `release.yml` слушает `tags: ["[0-9]*"]`, и `v0.1.0` под
     этот образец не подходит вовсе — выпуск просто не запустился бы. */
  console.log("дальше: npm run test:release, затем тег " + next + " — сборку релиза сделает CI");
}

main(process.argv.slice(2));
