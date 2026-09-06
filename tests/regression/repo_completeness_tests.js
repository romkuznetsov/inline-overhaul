"use strict";

/**
 * Репозиторий полон: проверка не читает того, чего в нём нет.
 *
 * **Дефект, который здесь закреплён, 2026-09-06.** `live_preview_wake_tests.ts`
 * читала копию настоящего конфига из `tests/fixtures/`, закрытую `.gitignore`
 * по маске приватных снимков. На машине, где файл лежал, все 48 проверок были
 * зелёными; в CI и на свежем клоне та же проверка падала с `ENOENT`, и падала
 * десять дней. Увидеть это своими глазами было нельзя ничем: файл есть, набор
 * зелёный, повод усомниться отсутствует.
 *
 * Поэтому сторож спрашивает не файловую систему, а **git**: это и есть разница
 * между «файл есть у меня» и «файл есть у всех».
 *
 * **Правило написано о папке, а не о тексте проверок, и это не лень.** Первая
 * версия искала в исходниках литерал `tests` + `/fixtures/` + имя — и была
 * зелёной при снятой фикстуре: путь к ней собран из кусков через `path.join`,
 * и литерала в тексте нет вовсе. Мутация это показала сразу. Папку подделать
 * нечем: что в ней лежит, то проверка и может прочитать.
 *
 * **Приватный снимок конфига в папке лежать может** — по маске из `.gitignore`,
 * его читает `tools/migration_report.js` по пути из аргумента. Нельзя другого:
 * чтобы от такого снимка зависела проверка. Это и есть второе правило.
 *
 * **Git обязателен, и его отсутствие — красный, а не пропуск.** Тихо
 * пропущенная проверка — это проверка, которой нет (У-36, У-41); а здесь тихий
 * пропуск вернул бы ровно тот дефект, ради которого сторож заведён.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");
const FIXTURES = path.join(root, "tests", "fixtures");

/** Маска приватных снимков — та же, что в `.gitignore`. Собрана, а не написана:
 *  литерал в этом файле поймало бы второе правило, и поймало бы законно. */
const PRIVATE_PREFIX = "data" + "_owner_";

/** Файлы под контролем версий — списком от самого git, а не разбором `.gitignore`. */
function trackedFiles() {
  let out;
  try {
    out = execFileSync("git", ["ls-files", "-z"], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    assert.fail(
      "не удалось спросить git о списке файлов (" + String(e && e.message) + ").\n" +
      "Эта проверка отвечает на вопрос «есть ли файл у всех, а не только у меня», " +
      "и без git ответа на него нет. Пропускать её нельзя: ради этого она и написана."
    );
  }
  /* `-z` разделяет имена нулевым байтом: в путях бывают пробелы и кириллица.
     Сам байт в исходник не пишется — гейт репозитория запрещает нулевой байт. */
  const NUL = String.fromCharCode(0);
  return new Set(String(out).split(NUL).filter(Boolean).map((p) => p.replace(/\\/g, "/")));
}

const tracked = trackedFiles();
assert.ok(tracked.size > 100, "git отдал подозрительно короткий список файлов: " + tracked.size);

/* ---- правило первое: в папке фикстур нет ничего, чего нет у всех ---------- */

const inFolder = fs.readdirSync(FIXTURES, { withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => e.name);
assert.ok(inFolder.length > 0, "папка фикстур пуста — сторожить нечего, и это само по себе странно");

const untracked = inFolder
  .filter((name) => !name.startsWith(PRIVATE_PREFIX))
  .filter((name) => !tracked.has("tests/fixtures/" + name));

assert.deepStrictEqual(
  untracked,
  [],
  "в папке фикстур лежит файл, которого нет в репозитории — у вас он есть, у CI и на свежем клоне его не будет:\n  " +
  untracked.join("\n  ") + "\n" +
  "Либо добавьте его под контроль версий, либо, если он приватный, назовите его по маске приватных снимков."
);

/* ---- правило второе: от приватного снимка не зависит ни одна проверка ----- */

function sourcesUnder(dir) {
  const found = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|js|mjs)$/.test(entry.name)) found.push(full);
    }
  };
  walk(dir);
  return found;
}

const sources = sourcesUnder(path.join(root, "tests"));
assert.ok(sources.length > 20, "файлов проверок нашлось подозрительно мало: " + sources.length);

const dependsOnPrivate = sources
  .filter((file) => fs.readFileSync(file, "utf8").includes(PRIVATE_PREFIX))
  .map((file) => path.relative(root, file).replace(/\\/g, "/"));

assert.deepStrictEqual(
  dependsOnPrivate,
  [],
  "проверка зависит от приватного снимка конфига, а он в репозиторий не попадает:\n  " +
  dependsOnPrivate.join("\n  ")
);

console.log(
  "Repo completeness tests: OK (файлов в папке фикстур " + inFolder.length +
  ", все под контролем версий; проверок, зависящих от приватных снимков, нет)"
);
