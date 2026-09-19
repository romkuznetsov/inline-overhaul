"use strict";

/**
 * Форма заметки тестов: у теста статус, эталон, живая строка и журнал.
 *
 * **Зачем отдельный сторож.** Правило «в заметке только то, что он делает
 * руками» куплено четырьмя его словами подряд. 2026-09-11: «этот файл
 * превратился в какой-то длинный лог текста — не раздувай». 2026-09-20: «я не
 * понимаю, что мне делать в файле приёмки»; в тот же день — заказ на шаблоны
 * тестов («настройки плагина, что нужно сделать, исходная строка (эталон),
 * ожидаемый результат (эталон), проверка»); и тем же днём шесть пометок прямо
 * внутри заметки, каждая про форму. Правило без сторожа живёт на моей памяти, а
 * срок у неё кончается (У-202, правило 122).
 *
 * **Что проверяется, и каждое — его словом.**
 *   1. **статус виден сразу**: под заголовком теста идут две строки одним
 *      уровнем — галочка и `💬`, и ничего между ними («чтобы я сразу
 *      идентифицировал статус проверки»);
 *   2. **свёрнутый коллаут «Откуда эта задача»** — почему тест появился
 *      («добавь callout (свернутый) с описанием этой задачи… лаконично»);
 *   3. **подзаголовок «Настройки и действие»** — чтобы свернуть его и не
 *      отвлекаться, а настройки внутри разложены **по вкладкам** таблицей
 *      («сделай под субхедером… в таблицах используй списки… структурируй по
 *      вкладкам»);
 *   4. **подзаголовок «Эталон и проверка»**, и в нём либо живая строка, либо
 *      прямо сказано, что её здесь нет;
 *   5. **в эталоне и в живой строке нет обратных кавычек** («ты сделал текст в
 *      `кавычках` — надо без них… строка без кавычек, чтобы я сразу видел»), и
 *      ни одна строка заметки не начинается с обратной кавычки;
 *   6. **свёрнутый коллаут «Журнал»** с хотя бы одной датой («тут должен быть
 *      коллаут с логом — он должен обновляться после каждой проходки»);
 *   7. моих объяснений (строк `→`) нет вовсе: их дом — `docs/AWAITING_OWNER_CHECK.md`.
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

const CHECKBOX = /^- \[[ xX]\] /;
const SAY = "💬";
const WHY_CALLOUT = "> [!question]- Откуда эта задача";
const LOG_CALLOUT = "> [!example]- Журнал";
const HEAD_SETUP = "### Настройки и действие";
const HEAD_CHECK = "### Эталон и проверка";
const TABLE_HEAD = "| Вкладка | Контрол | Значение |";
const LIVE_LEAD = "Ваша строка, работайте на ней";
const LIVE_NONE = "Живой строки здесь нет";

/** Тесты заметки: заголовок второго уровня и всё до следующего такого же. */
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

/** Строки раздела между двумя подзаголовками `###`. */
function sectionOf(body, head) {
  const from = body.indexOf(head);
  if (from === -1) return null;
  const out = [];
  for (let i = from + 1; i < body.length; i++) {
    if (/^### /.test(body[i])) break;
    out.push(body[i]);
  }
  return out;
}

/** Беды одного теста, каждая своим словом. */
function troublesOf(test) {
  const out = [];
  const body = test.body;
  const joined = body.join("\n");

  /*
   * **Статус — первое, что видно.** Спрашивается не «есть ли где-то галочка», а
   * стоит ли она **сразу** под заголовком: его слово было про то, чтобы
   * опознавать статус мгновенно, а галочка в середине теста этого не даёт.
   */
  const meaningful = body.filter((l) => l.trim() !== "");
  if (!meaningful.length || !CHECKBOX.test(meaningful[0])) {
    out.push("под заголовком нет галочки — статус теста не виден сразу");
  }
  if (meaningful.length < 2 || meaningful[1].indexOf(SAY) === -1 || meaningful[1].indexOf("- ") !== 0) {
    out.push("под галочкой нет строки `" + SAY + "` тем же уровнем — замечание писать некуда");
  }
  if (joined.indexOf(WHY_CALLOUT) === -1) {
    out.push("нет свёрнутого коллаута «Откуда эта задача»");
  }
  if (joined.indexOf(LOG_CALLOUT) === -1) {
    out.push("нет свёрнутого коллаута «Журнал»");
  } else {
    const log = body.slice(body.indexOf(LOG_CALLOUT) + 1);
    if (!log.some((l) => /^>\s*- \d{4}-\d{2}-\d{2}/.test(l))) {
      out.push("в журнале нет ни одной записи с датой");
    }
  }

  const setup = sectionOf(body, HEAD_SETUP);
  if (!setup) {
    out.push("нет подзаголовка «Настройки и действие» — свернуть настройку нечем");
  } else {
    if (!setup.some((l) => l.indexOf(TABLE_HEAD) === 0)) {
      out.push("в «Настройках» нет таблицы по вкладкам");
    }
    if (!setup.some((l) => /^\d+\.\s/.test(l))) {
      out.push("действие не разложено по шагам");
    }
  }

  const check = sectionOf(body, HEAD_CHECK);
  if (!check) {
    out.push("нет подзаголовка «Эталон и проверка»");
  } else {
    const hasLive = check.some((l) => l.indexOf(LIVE_LEAD) !== -1);
    const saysNone = check.some((l) => l.indexOf(LIVE_NONE) !== -1);
    if (!hasLive && !saysNone) {
      out.push("не сказано ни про живую строку, ни про то, что её здесь нет");
    }
    if (hasLive) {
      const at = check.findIndex((l) => l.indexOf(LIVE_LEAD) !== -1);
      const after = check.slice(at + 1).filter((l) => l.trim() !== "");
      /*
       * **Разделитель живой строкой не является**, и первая версия признака
       * считала его ею: «строка есть, начинается не с пробела» выполнялось на
       * `---`, и контроль «убрать живую строку» был зелёным. Признак
       * спрашивает предмет, а не вместилище (У-177): живая строка — та, на
       * которой он может вызвать команду плагина.
       */
      const first = after.length ? after[0] : "";
      const notALine = !first
        || /^-{3,}\s*$/.test(first)
        || /^#{1,6}\s/.test(first)
        || first.indexOf("|") === 0
        || first.indexOf(">") === 0;
      if (notALine) out.push("живая строка объявлена, а самой строки под ней нет");
    }
    /*
     * **Эталон пишется без обратных кавычек** — его слово: «ты сделал текст в
     * кавычках — надо без них… строка без кавычек, чтобы я сразу видел».
     * Предмет здесь — строки списка: именно они изображают строку заметки.
     * Обычный текст раздела кавычки носить вправе, он про имена настроек.
     */
    for (const line of check) {
      if (!/^\s*- /.test(line)) continue;
      if (line.indexOf("`") !== -1) {
        out.push("в эталоне есть обратные кавычки: " + line.trim().slice(0, 45));
        break;
      }
    }
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
    "",
    "Сразу текст вместо галочки.",
    "",
    "`- текст` — строка начинается с кавычки",
    "\t- → и моё объяснение здесь же",
    "",
    "### Настройки и действие",
    "",
    "| что-то | другое |",
    "",
  ].join("\n");
  const tests = testsOf(bad);
  if (tests.length !== 1) throw new Error("контроль: плохой тест не разобрался");
  const troubles = troublesOf(tests[0]);
  const want = [
    "нет галочки", "нет строки `" + SAY + "`", "«Откуда эта задача»", "«Журнал»",
    "таблицы по вкладкам", "по шагам", "«Эталон и проверка»",
    "начинается с обратной кавычки", "строка `→`",
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

module.exports = { testsOf, troublesOf, sectionOf, selfCheck, DEFAULT_SHEET };
