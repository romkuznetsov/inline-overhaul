"use strict";

/**
 * Номер версии совпадает везде, где он записан.
 *
 * **Источник истины — `manifest.json`:** его читает Obsidian, и он же уезжает
 * вложением в релиз. Остальные три файла обязаны с ним совпасть.
 *
 * Раньше здесь стоял пятый экземпляр номера — литерал в этой самой проверке, —
 * и его тоже приходилось править руками при каждом выпуске. Пятое место в
 * ритуале из пяти шагов не страхует от ошибки, а добавляет шаг, который можно
 * забыть. Ставится версия одной командой: `node build/set_version.js <версия>`.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

const manifest = readJson("manifest.json");
const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const versions = readJson("versions.json");

const version = manifest.version;

/* Форма номера проверяется отдельно: Obsidian ждёт `x.y.z`, суффикс беты
   разрешён. Без этого опечатка вида `0.1.0 beta` разъехалась бы по всем
   четырём файлам согласованно и осталась бы зелёной. */
assert.match(
  String(version),
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
  "версия в manifest.json не похожа на номер версии: " + JSON.stringify(version)
);

assert.strictEqual(pkg.version, version, "package.json разошёлся с manifest.json");
assert.strictEqual(lock.version, version, "package-lock.json разошёлся с manifest.json");
assert.strictEqual(
  lock.packages[""].version,
  version,
  "корневой пакет в package-lock.json разошёлся с manifest.json"
);
assert.strictEqual(
  versions[version],
  manifest.minAppVersion,
  "в versions.json нет строки для этой версии или она обещает другую минимальную версию Obsidian"
);

/* Собранный манифест — тот же файл, что и исходный: сборка его копирует, а не
   пересобирает. Расхождение значит, что dist собран из другой версии. */
const distManifestPath = path.join(root, "dist", "manifest.json");
if (fs.existsSync(distManifestPath)) {
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(distManifestPath, "utf8")),
    manifest,
    "манифест в dist собран не из нынешнего исходного манифеста"
  );
}

console.log(`Version consistency tests: OK (${version})`);
