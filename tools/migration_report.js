"use strict";

/**
 * Отчёт о миграции конкретного `data.json`: по каждой ветке — переехало,
 * осталось, удалено, легло в `_unmigrated` или уступило форме версии 2.
 *
 * Зачем инструмент, а не разовый скрипт. Приёмка фазы 2 делается на копии
 * настоящего конфига заказчика (PRD фаза 2, решение 2026-08-30), и такой прогон
 * понадобится ещё раз — после переименования ID команд и перед релизом. Отчёт
 * считается из данных: маршруты берутся у самой миграции, приёмник старой формы
 * — у `main.js` через загрузчик `tests/harness/plugin_internals.ts`. Второй
 * копии ни того, ни другого в проекте нет.
 *
 * Сам файл конфига в репозиторий не коммитится: в нём имена папок, тегов и
 * путей. Строка исключения стоит в `.gitignore`.
 *
 *   node tools/migration_report.js tests/fixtures/config_v1_realistic.json
 *
 * По умолчанию в отчёт попадают только пути. Ключ `--values` добавляет
 * значения — им отчёт становится показываемым только тому, чей это конфиг.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const target = process.argv[2];
const withValues = process.argv.includes("--values");

if (!target) {
  console.error("нужен путь к data.json");
  process.exit(2);
}

const migration = require(path.join(ROOT, "src", "core", "config_migration_v2.ts"));
const harness = require(path.join(ROOT, "tests", "harness", "plugin_internals.ts"));
const { ROUTES } = migration;
const internals = harness.loadPluginInternals();

function isObj(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/** Все листья объекта точечными путями. Пустой объект — тоже лист. */
function leaves(node, prefix, out) {
  if (!isObj(node)) {
    out.push(prefix);
    return out;
  }
  const keys = Object.keys(node);
  if (!keys.length) {
    out.push(prefix);
    return out;
  }
  for (const key of keys) leaves(node[key], prefix ? prefix + "." + key : key, out);
  return out;
}

function getIn(obj, dotted) {
  return String(dotted || "").split(".").reduce((acc, key) => {
    if (!isObj(acc) && !Array.isArray(acc)) return undefined;
    return acc[key];
  }, obj);
}

/** Ближайший маршрут, накрывающий путь: самый длинный подходящий источник. */
function routeFor(dotted) {
  let best = null;
  for (const [from, route] of ROUTES) {
    if (dotted === from || dotted.startsWith(from + ".")) {
      if (!best || from.length > best[0].length) best = [from, route];
    }
  }
  return best;
}

const raw = JSON.parse(fs.readFileSync(target, "utf8"));
const version = Number(raw.schemaVersion) || 0;
const alreadyV2 = version >= migration.SCHEMA_VERSION_V2;

/* Вход миграции — то же, что видит плагин: файл, доведённый первой ступенью до
   ровной формы версии 1. Для файла, который уже версии 2, ступень не идёт. */
const input = alreadyV2 ? raw : internals.normalizeConfigV1(raw);
const report = { unknown: [], contested: [], migrated: false };
const migrated = migration.migrate(input, { report, log: () => {} });
/* И полный путь плагина целиком — на нём проверяется, что ничего не падает. */
const finalConfig = internals.migrateConfig(raw);

const unmigrated = isObj(migrated._unmigrated) ? migrated._unmigrated : {};
const contested = new Set(report.contested);
const rows = [];
const counts = { moved: 0, kept: 0, dropped: 0, unmigrated: 0, contested: 0, differed: 0 };

/**
 * Спор двух форм за один путь бывает двух видов, и они не равноценны.
 *
 * Чаще всего значения совпадают, и уступка ничего не меняет: старый ключ лежал
 * нетронутым умолчанием. Но там, где значения **разные**, человек увидит после
 * переезда то, что стоит в новой панели, а не то, к чему он привык в старой.
 * Только эти строки и стоит показывать заказчику, поэтому они помечены.
 *
 * Сравниваются значения после пересчёта единиц (`cast`): прозрачность в v1
 * дробь `1`, в v2 проценты `100` — это одно и то же число, а не расхождение.
 */
function contestedNote(leaf) {
  const found = routeFor(leaf);
  if (!found) return "сохранено в `_unmigrated`";
  const [from, route] = found;
  const to = route.to ? route.to + leaf.slice(from.length) : "";
  if (!to) return "сохранено в `_unmigrated`";
  const was = getIn(input, leaf);
  const cast = typeof route.cast === "function" ? route.cast(was) : was;
  const now = getIn(migrated, to);
  const same = JSON.stringify(cast) === JSON.stringify(now);
  if (!same) counts.differed++;
  return "сохранено в `_unmigrated`, "
    + (same ? "значение то же" : "ЗНАЧЕНИЕ РАЗОШЛОСЬ, в панели по " + to + " стоит другое");
}

for (const leaf of leaves(input, "", []).sort()) {
  if (leaf === "schemaVersion") continue;
  const show = withValues ? " = " + JSON.stringify(getIn(input, leaf)) : "";

  if (contested.has(leaf)) {
    rows.push(["уступило форме v2", leaf, contestedNote(leaf) + show]);
    counts.contested++;
    continue;
  }
  if (Object.prototype.hasOwnProperty.call(unmigrated, leaf)) {
    rows.push(["_unmigrated", leaf, "маршрута нет, ветка сохранена" + show]);
    counts.unmigrated++;
    continue;
  }

  const found = routeFor(leaf);
  if (!found) {
    rows.push(["без маршрута", leaf, "смотреть глазами" + show]);
    counts.unmigrated++;
    continue;
  }
  const [from, route] = found;
  if (route.drop) {
    rows.push(["удалено", leaf, "ветка удаляется по 8.1" + show]);
    counts.dropped++;
    continue;
  }
  const to = route.to + leaf.slice(from.length);
  if (to === leaf) {
    rows.push(["осталось", leaf, "путь не менялся" + show]);
    counts.kept++;
    continue;
  }
  if (getIn(migrated, to) === undefined) {
    rows.push(["ПОТЕРЯ", leaf, "маршрут есть, значения по " + to + " нет" + show]);
    counts.moved++;
    continue;
  }
  rows.push(["переехало", leaf, "→ " + to + show]);
  counts.moved++;
}

const lost = rows.filter(r => r[0] === "ПОТЕРЯ");

console.log("# Отчёт о миграции: " + path.basename(target));
console.log("");
console.log("Версия исходного файла: " + version + ". Листьев на входе миграции: " + rows.length + ".");
console.log("Идемпотентность: "
  + (JSON.stringify(internals.migrateConfig(finalConfig)) === JSON.stringify(finalConfig) ? "да" : "НЕТ"));
console.log("");
console.log("переехало " + counts.moved
  + ", осталось " + counts.kept
  + ", удалено " + counts.dropped
  + ", без маршрута " + counts.unmigrated
  + ", уступило форме v2 " + counts.contested
  + " (из них с другим значением " + counts.differed + ")");
console.log("");

/*
 * Сколько листьев лежит в `_unmigrated` итогового конфига — отдельной строкой
 * и **числом из самого конфига**, а не суммой счётчиков отчёта.
 *
 * 2026-09-05 строка выше читалась как «в `_unmigrated` ноль», потому что
 * маршрута не было ни у одной ветки, — и я сказал заказчику «ничего не
 * теряется, `_unmigrated` пуст», пока в его конфиге там лежали 22 листа,
 * уступивших форме v2. Счётчики отчёта и содержимое конфига — разные вещи, и
 * теперь они названы разными строками, а расхождение между ними отчёт называет
 * сам.
 */
const inConfig = Object.keys(unmigrated).length;
const expected = counts.unmigrated + counts.contested;
console.log("В `_unmigrated` итогового конфига " + inConfig
  + " — это уступившие форме v2 и оставшиеся без маршрута вместе."
  + (inConfig === expected ? "" : " РАСХОЖДЕНИЕ: по счётчикам их " + expected + "."));
console.log("");

if (lost.length) {
  console.log("## ПОТЕРИ — " + lost.length);
  for (const [, leaf, note] of lost) console.log("- `" + leaf + "` " + note);
  console.log("");
}

const byKind = new Map();
for (const [kind, leaf, note] of rows) {
  if (!byKind.has(kind)) byKind.set(kind, []);
  byKind.get(kind).push([leaf, note]);
}
for (const kind of ["переехало", "осталось", "удалено", "уступило форме v2", "_unmigrated", "без маршрута"]) {
  const list = byKind.get(kind);
  if (!list || !list.length) continue;
  console.log("## " + kind + " — " + list.length);
  for (const [leaf, note] of list) console.log("- `" + leaf + "` " + note);
  console.log("");
}

process.exit(lost.length ? 1 : 0);
