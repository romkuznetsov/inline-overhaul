"use strict";

/**
 * Форма заметки тестов: у теста эталон, живая строка и место для замечания.
 *
 * **Зачем отдельный сторож.** Правило «в заметке только то, что он делает
 * руками» куплено трижды. 2026-09-11 он сказал «этот файл превратился в
 * какой-то длинный лог текста — не раздувай», 2026-09-20 — «я не понимаю, что
 * мне делать в файле приёмки», и тем же днём — «после каждой доработки
 * формировать перечень необходимых тестов… настройки плагина, что нужно
 * сделать, исходная строка (эталон), ожидаемый результат (эталон), проверка».
 * Между первыми двумя в лист по строке за заход уезжали мои объяснения, и
 * каждая была верной. Правило без сторожа живёт на моей памяти, а срок у неё
 * кончается (У-202, правило 122).
 *
 * **Что проверяется, и каждое — его словом.**
 *   1. у теста есть галочка и вложенная строка `💬` — иначе отмечать и
 *      возражать негде;
 *   2. в таблице есть все четыре строки: `Настройки`, `Действие`, `Исходная`,
 *      `Ожидается`. Эталон — половина его заказа: без него не с чем сверять;
 *   3. у теста есть **живая строка**, на которой он выполняет действие, либо
 *      сказано прямо, что её здесь нет (проверка идёт в панели или на GitHub).
 *      Молчание тут читается как «забыли»;
 *   4. **ни одна строка не начинается с обратной кавычки** — его прямое
 *      требование к нотации;
 *   5. моих объяснений (строк `→`) нет вовсе: их дом — `docs/AWAITING_OWNER_CHECK.md`.
 *
 * **Почему не в наборе проверок.** Заметка лежит в его vault, а не в
 * репозитории: проверка набора зависела бы от приватного файла и краснела бы у
 * всех, кроме меня (`repo_completeness_tests.js` это и запрещает). Поэтому —
 * стенд, и зовут его руками: при правке заметки и первым шагом завершения
 * сессии.
 *
 * **У стенда есть положительный контроль, и он встроен:** перед разбором
 * настоящего файла разбирается заведомо плохой тест, и стенд обязан назвать все
 * его беды. Не назвал — мерить нечем, и это отказ, а не «всё хорошо» (У-88).
 *
 * Запуск (из `repo/`):
 *   node tools/testing_shape.js
 *   node tools/testing_shape.js "<путь к заметке>"
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SHEET = path.resolve(ROOT, "..", "test-vault", "testing.md");

/**
 * Служебный раздел: ниже него тесты не ищутся.
 *
 * Ищется **слово**, а не заголовок: по его слову 2026-09-20 промпт переехал из
 * раздела в свёрнутый коллаут, и признак, написанный по `#`, потерял бы предмет
 * молча (У-94).
 */
const SERVICE_WORD = "Служебное";

/** Разделы, которые тестами не являются и заголовок делят с ними. */
const NOT_A_TEST = ["Новое пишите сюда"];

/** Строки таблицы, без которых сверять не с чем. */
const TABLE_ROWS = ["Настройки", "Действие", "Исходная", "Ожидается"];

/** Как объявлена живая строка и как объявлено её законное отсутствие. */
const LIVE_LEAD = "Живая строка";
const LIVE_NONE = "Живой строки здесь нет";

/**
 * Тесты заметки: заголовок второго уровня и всё до следующего такого же.
 */
function testsOf(text) {
  const src = String(text || "");
  const cut = src.indexOf(SERVICE_WORD);
  const body = cut === -1 ? src : src.slice(0, cut);
  const lines = body.split("\n");
  const out = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^## /.test(line)) {
      const title = line.slice(3).trim();
      current = NOT_A_TEST.some((n) => title.indexOf(n) !== -1)
        ? null
        : { title, at: i + 1, body: [] };
      if (current) out.push(current);
      continue;
    }
    if (current) current.body.push(line);
  }
  return out;
}

/** Беды одного теста, каждая своим словом. */
function troublesOf(test) {
  const out = [];
  const body = test.body;
  const joined = body.join("\n");

  if (!body.some((l) => /^- \[[ xX]\] /.test(l))) {
    out.push("нет галочки — отмечать результат негде");
  }
  if (!body.some((l) => l.indexOf("💬") !== -1)) {
    out.push("нет строки `💬` — замечание писать некуда");
  }
  for (const row of TABLE_ROWS) {
    if (!body.some((l) => l.indexOf("|") === 0 && l.indexOf("**" + row + "**") !== -1)) {
      out.push("в таблице нет строки «" + row + "»");
    }
  }
  const hasLive = body.some((l) => l.indexOf(LIVE_LEAD) !== -1);
  const saysNone = joined.indexOf(LIVE_NONE) !== -1;
  if (!hasLive && !saysNone) {
    out.push("не сказано ни про живую строку, ни про то, что её здесь нет");
  }
  if (hasLive) {
    const at = body.findIndex((l) => l.indexOf(LIVE_LEAD) !== -1);
    const after = body.slice(at + 1).filter((l) => l.trim() !== "");
    /*
     * **Разделитель живой строкой не является**, и первая версия признака
     * считала его ею: «строка есть, начинается не с пробела» выполнялось на
     * `---`, и контроль «убрать живую строку» был зелёным. Признак спрашивает
     * предмет, а не вместилище (У-177): живая строка — та, на которой человек
     * может вызвать команду плагина, то есть не разделитель, не заголовок, не
     * строка таблицы и не цитата.
     */
    const first = after.length ? after[0] : "";
    const notALine = !first
      || /^-{3,}\s*$/.test(first)
      || /^#{1,6}\s/.test(first)
      || first.indexOf("|") === 0
      || first.indexOf(">") === 0;
    if (notALine) out.push("живая строка объявлена, а самой строки под ней нет");
  }
  for (const line of body) {
    if (line.indexOf("`") === 0) {
      out.push("строка начинается с обратной кавычки: " + line.slice(0, 40));
      break;
    }
  }
  if (body.some((l) => l.trim().indexOf("- →") === 0)) {
    out.push("есть строка `→` — моё объяснение живёт в docs/AWAITING_OWNER_CHECK.md");
  }
  return out;
}

/** Положительный контроль: заведомо плохой тест обязан быть назван. */
function selfCheck() {
  const bad = [
    "## 1. Плохой тест",
    "`- текст` — строка начинается с кавычки",
    "\t- → и моё объяснение здесь же",
    "",
    "| | |",
    "|---|---|",
    "| **Действие** | нажать что-нибудь |",
    "",
  ].join("\n");
  const tests = testsOf(bad);
  if (tests.length !== 1) throw new Error("контроль: плохой тест не разобрался");
  const troubles = troublesOf(tests[0]);
  const want = [
    "нет галочки", "нет строки `💬`", "«Настройки»", "«Исходная»", "«Ожидается»",
    "ни про живую строку", "начинается с обратной кавычки", "строка `→`",
  ];
  for (const w of want) {
    if (!troubles.some((t) => t.indexOf(w) !== -1)) {
      throw new Error("контроль: стенд не заметил беду «" + w + "» — мерить нечем");
    }
  }
  return troubles.length;
}

function main() {
  const found = selfCheck();
  console.log("положительный контроль: на заведомо плохом тесте названо бед " + found);

  const file = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SHEET;
  if (!fs.existsSync(file)) {
    console.error("заметки нет по пути " + file + " — укажите её аргументом");
    process.exitCode = 1;
    return;
  }
  const text = fs.readFileSync(file, "utf8");
  const tests = testsOf(text);
  /* Ноль тестов — не «всё хорошо», а «мерить нечем» (У-88). */
  if (!tests.length) {
    console.error("в заметке нет ни одного теста — разбирать нечего");
    process.exitCode = 1;
    return;
  }

  let bad = 0;
  for (const test of tests) {
    const troubles = troublesOf(test);
    if (!troubles.length) continue;
    bad++;
    console.log("РАЗОШЛОСЬ строка " + test.at + ": " + test.title.slice(0, 70));
    for (const t of troubles) console.log("    " + t);
  }
  console.log("тестов " + tests.length + ", расходится " + bad
    + "; знаков в заметке " + text.length);
  if (bad) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { testsOf, troublesOf, selfCheck, DEFAULT_SHEET };
