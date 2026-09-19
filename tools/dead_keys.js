"use strict";

/**
 * Ключи его `data.json`, которых не читает никто.
 *
 * **Его заказ 2026-09-19:** «я хочу, чтобы ты проверил, что в data.json и в
 * генерируемых файлах бэкапа нет других мёртвых веток. В целом ты ранее
 * выполнял аудит кода, я ожидал, что после его завершения и выполнения всех
 * выявленных проблем подобных ситуаций не будет».
 *
 * **Почему ревизия этого не нашла.** Она смотрела на код: мёртвые экспорты,
 * тихие отказы, копии правил, объявленное и незваное. Предмет «ключ, который
 * лежит в файле **человека** и не читается ничем» в ней не мерился ни разу —
 * у него другая сторона: не код без вызова, а **данные** без читателя. Это и
 * есть ответ на его «я ожидал, что подобных ситуаций не будет»: сторона была
 * не измерена, и потому обещание было пустым.
 *
 * **Чем меряется «читает».** Двумя источниками, и оба выводятся, а не
 * вспоминаются:
 *
 *   1. **Схема панели.** Путь строки панели и всё, что лежит под ним, читает
 *      панель. Схема выводится из прототипа, то есть это не список имён, а
 *      сам продукт.
 *   2. **Рантайм.** Все строковые литералы вида `a.b.c` во всех файлах `src`:
 *      именно так движки спрашивают конфиг (`readCfgPath`, `getIn`, ключи
 *      маршрутов). Литерал ищется по маске, где комментарии и строки кода
 *      различены (У-138): иначе объяснение в комментарии само считается
 *      чтением.
 *
 * **У обхода есть контроль, и он стоит до первого вывода** (У-119): в конфиг
 * подсаживается заведомо мёртвая ветка и заведомо живая, и обход обязан
 * назвать ровно первую. Не назвал — печатается отказ, а не список.
 *
 * Запуск: `node tools/dead_keys.js <путь к data.json>`; без пути берётся
 * `data.json` тестового vault рядом с репозиторием.
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }

/**
 * Ключи, которые читаются **не литералом пути**, а свойством.
 *
 * Обход ищет строки вида `"a.b.c"` — так спрашивают конфиг движки и панель. Но
 * есть и второй способ: обращение свойством (`raw.schemaVersion`), и его маска
 * не видит. Список закрытый и у каждой записи названо место: пока он виден, его
 * можно оспорить, а молчаливое исключение превратило бы «мёртвых нет» в
 * «мерили не всё» (У-119).
 */
const READ_BY_PROPERTY = [
  { path: "schemaVersion", why: "версия файла: `raw.schemaVersion` в config_migration_v2.ts" },
  /*
   * Правила приставок движки читают свойствами объекта правил
   * (`src.checkboxByFieldValue`, `src.priorityTargets` — `pkm_line_finalize_unified.js`),
   * а собирает их `pkm_rules_shape.js` целой веткой. Литерала пути нет ни у
   * кого, и потому маска их не видит.
   */
  { path: "pkm.prefixRules.checkboxByFieldValue", why: "`src.checkboxByFieldValue` в pkm_line_finalize_unified.js" },
  { path: "pkm.prefixRules.priorityTargets", why: "`src.priorityTargets` там же" },
  { path: "pkm.prefixRules.priorityCheckboxes", why: "`src.priorityCheckboxes` там же" },
  { path: "pkm.prefixRules.resolver", why: "`src.resolver` там же" },
];

/** Пути, которые читает панель: строки схемы и всё, что под ними. */
function schemaPaths() {
  const { SCHEMA } = require(path.join(root, "src", "ui", "settings", "schema", "index.ts"));
  const out = new Set();
  for (const group of SCHEMA || []) {
    for (const item of group.items || []) {
      if (item && item.path) out.add(String(item.path));
      /* Предусловие строки читает те же пути, что и она сама. */
      const pred = item && (item.visible || item.disabled);
      for (const dep of (pred && pred.deps) || []) out.add(String(dep));
    }
  }
  return out;
}

/** Маска кода: комментарии стёрты, строковые литералы оставлены (У-138). */
function maskComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const two = src.slice(i, i + 2);
    if (two === "//") {
      const end = src.indexOf("\n", i);
      i = end === -1 ? n : end;
      continue;
    }
    if (two === "/*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === quote) break;
        /* Кавычка не ищет пару дальше конца строки: своя неполнота стоит
           одной строки, а не целого файла (У-139). */
        if (quote !== "`" && src[j] === "\n") break;
        j += 1;
      }
      out += src.slice(i, Math.min(j + 1, n));
      i = j + 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Файлы, чьи литералы путей — **бухгалтерия переезда, а не чтение**.
 *
 * `config_migration_v2.ts` перечисляет пути, чтобы перенести или снять их:
 * `keepV2("pkm.fields.taxonomy")` значит «донести до формы версии 2», а не
 * «прочитать значение». Считать такие литералы читателями — значит объявить
 * живым всё, что когда-либо переезжало: именно поэтому кеш конфиг-заметки
 * обход **не нашёл**, и нашёл его глаз. Нормализация сюда не входит: её
 * `int`/`bool`/`oneOf` — настоящие читатели, они правят значение.
 */
const BOOKKEEPING_FILES = [
  { rel: "src/core/config_migration_v2.ts", why: "карта маршрутов и список снятых ключей" },
];

/** Все пути-литералы рантайма: `"a.b.c"` в любом файле `src`. */
function runtimePaths() {
  const out = new Set();
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!/\.(js|ts)$/.test(name)) continue;
      const rel = path.relative(root, full).split(path.sep).join("/");
      if (BOOKKEEPING_FILES.some((x) => x.rel === rel)) continue;
      const masked = maskComments(fs.readFileSync(full, "utf8"));
      for (const m of masked.matchAll(/["'`]([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)["'`]/g)) {
        out.add(String(m[1]));
      }
    }
  };
  walk(path.join(root, "src"));
  return out;
}

/** Листья конфига путями. */
function leaves(node, prefix, out) {
  if (!isObj(node)) { out.push(prefix); return out; }
  const keys = Object.keys(node);
  if (!keys.length) { out.push(prefix); return out; }
  for (const key of keys) leaves(node[key], prefix ? prefix + "." + key : key, out);
  return out;
}

/**
 * Читает ли кто-нибудь этот лист.
 *
 * Читается лист, если известен он сам или **любой его предок**: движок,
 * спросивший ветку целиком (`pkm.fields.order`), читает и всё, что внутри. И
 * наоборот — известный путь под листом (карты, где ключи пишет человек) тоже
 * считается чтением.
 */
function isRead(leafPath, known) {
  const parts = leafPath.split(".");
  for (let i = parts.length; i > 0; i--) {
    if (known.has(parts.slice(0, i).join("."))) return true;
  }
  for (const p of known) if (p.indexOf(leafPath + ".") === 0) return true;
  return false;
}

/**
 * Ветки, которые **нарочно** никто не читает, и потому мёртвыми не считаются.
 *
 * `_unmigrated` — названное место для ключей, которых переезд не понял (МГ3):
 * их там держат, чтобы не потерять, и читать их никто и не должен. Это не
 * ловушка для человека: ветка помечена подчёркиванием и о ней сказано в
 * отчёте о миграции.
 */
const BY_DESIGN_UNREAD = [
  { branch: "_unmigrated", why: "МГ3: ключи без маршрута держатся здесь, чтобы не потеряться" },
];

function sweep(cfg, known) {
  const dead = [];
  for (const leaf of leaves(cfg, "", [])) {
    if (!leaf) continue;
    if (BY_DESIGN_UNREAD.some((x) => leaf === x.branch || leaf.indexOf(x.branch + ".") === 0)) continue;
    if (!isRead(leaf, known)) dead.push(leaf);
  }
  return dead;
}

function main() {
  const file = process.argv[2] || path.join(root, "..", "test-vault", ".obsidian",
    "plugins", "inline-overhaul", "data.json");
  const known = new Set([...schemaPaths(), ...runtimePaths(),
    ...READ_BY_PROPERTY.map((x) => x.path)]);

  /*
   * **Контроль до первого вывода** (У-119). Живое — путь строки панели; мёртвое
   * — ветка, которой нет ни в схеме, ни в рантайме. Обход обязан назвать ровно
   * второе.
   */
  const alive = "visual.tags.opacityLeft";
  const dead = "zzzDeadBranch.zzzKey";
  const probe = sweep({ visual: { tags: { opacityLeft: 100 } }, zzzDeadBranch: { zzzKey: 1 } }, known);
  if (probe.length !== 1 || probe[0] !== dead) {
    console.error("контроль обхода не прошёл: на паре «" + alive + "» и «" + dead
      + "» обход назвал " + JSON.stringify(probe) + " — мерить нечем");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const normalize = require(path.join(root, "src", "core", "config_normalize.js"));
  const cfg = normalize.migrateConfig(raw, { log: () => {} });
  const found = sweep(cfg, known);
  const all = leaves(cfg, "", []).filter(Boolean);

  console.log("файл: " + file);
  console.log("известных путей: схема " + schemaPaths().size + ", рантайм "
    + runtimePaths().size + ", читаемых свойством " + READ_BY_PROPERTY.length);
  for (const x of READ_BY_PROPERTY) console.log("  свойством: " + x.path + " — " + x.why);
  for (const x of BY_DESIGN_UNREAD) console.log("  нарочно не читается: " + x.branch + " — " + x.why);
  console.log("листьев в файле: " + all.length + ", без читателя: " + found.length);
  if (!found.length) {
    console.log("мёртвых веток не найдено");
    return;
  }
  const byBranch = new Map();
  for (const leaf of found) {
    const top = leaf.split(".").slice(0, 2).join(".");
    byBranch.set(top, (byBranch.get(top) || 0) + 1);
  }
  console.log("\nпо ветвям:");
  for (const [branch, count] of [...byBranch.entries()].sort((a, b) => b[1] - a[1])) {
    console.log("  " + branch + " — " + count);
  }
  console.log("\nсписок:");
  for (const leaf of found) console.log("  " + leaf);
}

module.exports = { READ_BY_PROPERTY, BY_DESIGN_UNREAD, BOOKKEEPING_FILES, maskComments, schemaPaths, runtimePaths, leaves, isRead, sweep, knownPaths: () => new Set([...schemaPaths(), ...runtimePaths(), ...READ_BY_PROPERTY.map((x) => x.path)]) };

if (require.main === module) main();
