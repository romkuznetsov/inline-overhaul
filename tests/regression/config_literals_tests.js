"use strict";

/**
 * **Настройка человека не пишется в коде готовой.**
 *
 * Его слово 2026-09-14: «мне не нравится, что в коде есть константы (пример с
 * `||`) — этого быть не должно».
 *
 * Повод он назвал сам: правило «вернуть пустой слот под текст» было написано
 * тремя образцами с литеральным `||`, и у него, с разделителем `::`, оно не
 * срабатывало **ни разу** (10.13.123). То есть литерал — это не стилистика:
 * это правило, работающее ровно у тех, чей выбор совпал с написанным в коде, и
 * молчащее у всех остальных. Ошибка этого рода не видна ни одной проверке на
 * фикстуре, у которой разделитель тот же самый (У-147), и находится она
 * пробоем, а не чтением (У-146).
 *
 * **Что здесь считается местом.** Разделитель, записанный внутри строкового
 * или регулярного литерала, в файле рантайма. Комментарии стираются, литералы
 * остаются — предмет живёт именно в них, а `||` в коде это ещё и «или».
 *
 * **Долг закреплён по файлам и умеет только убывать.** Новое место роняет
 * проверку там, где его завели; разобранное обязано уйти из списка тем же
 * коммитом. Список — не оправдание, а адрес: пока он не пуст, правило
 * исполнено наполовину.
 *
 * **Три рода мест, и лечатся они по-разному** (разбор — `docs/REMAINING_WORK.md`):
 *
 *   1. **правило читает разделитель готовым** — дефект того же рода, что нашёл
 *      он: у человека с другим разделителем правило не работает;
 *   2. **запасное значение при отсутствии настройки** — умолчание, повторённое
 *      по месту вызова; у умолчания должен быть один дом;
 *   3. **текст для человека** — строка руководства, называющая разделитель
 *      примером. Это не чтение настройки, но и не правда: у человека он свой.
 *
 * Запуск отдельно печатает список: `node tests/regression/config_literals_tests.js`.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const RUNTIME = ["main.js", "navigation_runtime.js", "pkm_runtime_v2.js", "src", "pkm_v2"];

/**
 * Долг на 2026-09-14, по файлам. Число — сколько строк с готовым разделителем
 * в файле осталось. Меньше — можно и нужно, больше — проверка краснеет.
 */
const DEBT = {
  "navigation_runtime.js": 6,
  "src/core/config_normalize.js": 2,
  "src/core/pkm_line_finalize_unified.js": 1,
  "src/core/pkm_macro_shared.js": 2,
  "src/core/status_runtime_common.js": 2,
  "src/ui/settings/custom/previews.ts": 10,
  "src/ui/settings/howto.ts": 2,
  "src/ui/settings/schema/pkm.ts": 2,
  "pkm_v2/status_tags.js": 2,
  "pkm_v2/TagWheel/tagwheel_core.js": 1,
};

function files() {
  const out = [];
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) { for (const n of fs.readdirSync(p)) walk(path.join(p, n)); return; }
    if (/\.(ts|js)$/.test(p)) out.push(p);
  };
  for (const entry of RUNTIME) walk(path.join(root, entry));
  return out;
}

/**
 * Тот же файл, где стёрты **только комментарии**. Литералы остаются: предмет
 * живёт в них, и маска сторожа молчаливых отказов тут не годится — она стирает
 * ровно то, что здесь ищется.
 */
function maskComments(body) {
  const out = body.split("");
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i++) {
      if (out[i] !== "\n") out[i] = " ";
    }
  };
  const lineEnd = (from) => {
    const nl = body.indexOf("\n", from);
    return nl < 0 ? body.length : nl;
  };
  let i = 0;
  while (i < body.length) {
    const two = body.slice(i, i + 2);
    if (two === "//") {
      const end = lineEnd(i);
      blank(i, end);
      i = end;
      continue;
    }
    if (two === "/*") {
      const end = body.indexOf("*/", i + 2);
      blank(i, end < 0 ? body.length : end + 2);
      i = end < 0 ? body.length : end + 2;
      continue;
    }
    const ch = body[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      /* Литерал перешагивается целиком, но не стирается: кавычка внутри него
         иначе открыла бы мнимую строку. Граница — конец строки файла (У-139). */
      const stop = lineEnd(i);
      let j = i + 1;
      while (j < stop) {
        if (body[j] === "\\") { j += 2; continue; }
        if (body[j] === ch) break;
        j++;
      }
      i = j >= stop ? i + 1 : j + 1;
      continue;
    }
    i++;
  }
  return out.join("");
}

const BS = String.fromCharCode(92);

/*
 * Формы, в которых разделитель попадает в код: внутри строки любой из трёх
 * кавычек и внутри регулярного выражения, где каждый знак экранирован.
 *
 * Список разделителей — те, что плагин когда-либо ставил умолчанием, и те, что
 * выбрал заказчик. Ищется не «любая строка из двух знаков»: тогда в список
 * попала бы половина кода, и правило перестало бы что-либо значить.
 */
const SEPARATORS = ["||", "::", "~~"];

function needles() {
  const out = [];
  for (const sep of SEPARATORS) {
    for (const quote of ['"', "'", "`"]) out.push(quote + sep + quote);
    out.push(sep.split("").map((ch) => BS + ch).join(""));
  }
  return out;
}

/**
 * Не всякое совпадение — настройка. `key + "::" + marker` собирает ключ для
 * своей же таблицы, и разделитель человека тут ни при чём.
 *
 * Исключение называется **местом**, а не образцом: образец «ключ таблицы»
 * закрыл бы и настоящие места, а этот список виден и стареет вслух.
 */
const NOT_A_SEPARATOR = [
  { rel: "src/core/line_pipeline.js", needle: 'key + "::" + marker' },
];

function isExcused(rel, text) {
  return NOT_A_SEPARATOR.some((x) => x.rel === rel && text.indexOf(x.needle) !== -1);
}

function found() {
  const list = needles();
  const rows = [];
  for (const file of files()) {
    const body = fs.readFileSync(file, "utf8");
    const masked = maskComments(body);
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const lines = body.split("\n");
    const maskedLines = masked.split("\n");
    for (let n = 0; n < maskedLines.length; n++) {
      const hit = list.some((needle) => maskedLines[n].indexOf(needle) !== -1);
      if (!hit) continue;
      const text = lines[n].trim();
      if (isExcused(rel, text)) continue;
      rows.push({ rel, line: n + 1, text });
    }
  }
  return rows;
}

function run() {
  /*
   * Положительный контроль, и стоит он **до** первого вывода (У-119): образец
   * обязан находить предмет в коде и не находить его в рассказе о коде.
   */
  const probe = maskComments('/* тут "||" в комментарии */\nconst a = "||";\n').split("\n");
  assert.ok(probe[0].indexOf('"||"') === -1,
    "контроль: комментарий не стёрт, и обход будет считать объяснения местами");
  assert.ok(probe[1].indexOf('"||"') !== -1,
    "контроль: литерал стёрт вместе с комментарием, и обход не найдёт ничего");

  const rows = found();
  const byFile = {};
  for (const r of rows) byFile[r.rel] = (byFile[r.rel] || 0) + 1;

  console.log("  разделитель записан готовым: мест " + rows.length
    + " в " + Object.keys(byFile).length + " файлах; долг на 2026-09-14 — "
    + Object.keys(DEBT).reduce((a, k) => a + DEBT[k], 0));

  const grew = [];
  for (const rel of Object.keys(byFile)) {
    const allowed = Object.prototype.hasOwnProperty.call(DEBT, rel) ? DEBT[rel] : 0;
    if (byFile[rel] > allowed) {
      grew.push(rel + ": было не больше " + allowed + ", стало " + byFile[rel]
        + "\n      " + rows.filter((r) => r.rel === rel).map((r) => r.rel + ":" + r.line).join("\n      "));
    }
  }
  assert.deepStrictEqual(grew, [],
    "настройка человека записана в коде готовой — новое место:\n    " + grew.join("\n    "));

  /*
   * И вторая сторона долга: файл, из которого места ушли, обязан уйти и из
   * списка. Иначе список стареет молча и перестаёт быть адресом (У-127).
   */
  const stale = Object.keys(DEBT).filter((rel) => (byFile[rel] || 0) < DEBT[rel]);
  assert.deepStrictEqual(stale, [],
    "долг уменьшился, а список нет — поправьте DEBT тем же коммитом: " + stale.join(", "));

  console.log("Config literal regression tests: OK");
}

if (require.main === module) {
  /* Список печатается по просьбе, а не всегда: в общем прогоне он был бы шумом,
     а адрес нужен тому, кто сел разбирать долг. */
  if (process.argv.includes("--list")) {
    for (const r of found()) console.log(r.rel + ":" + r.line + "   " + r.text.slice(0, 120));
  }
  run();
}

module.exports = { run };
