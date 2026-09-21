"use strict";

/**
 * Форма заметки тестов — его шаблон, и держится он не моей памятью.
 *
 * **Откуда форма.** Заказчик выписал её сам, 2026-09-20, прямо в заметке
 * («ХХХ. измени файл testing ниже пример типового пункта и в дальнейшем
 * придерживайся этой структуры»). До этого он трижды правил её по кускам:
 * 2026-09-11 «не раздувай», 2026-09-20 «я не понимаю, что мне делать в файле
 * приёмки», и шесть пометок внутри самой заметки. Правило без сторожа живёт на
 * моей памяти, а срок у неё кончается (У-202, правило 122).
 *
 * **Карточка теста, сверху вниз.**
 *   1. `## N. Короткое название`;
 *   2. **сразу** под ним, без пустой строки, `- [ ] принято` и `- 💬` — статус
 *      виден мгновенно, и комментарий пишется, не трогая галочку;
 *   3. четыре свёрнутых коллаута: `[!question]- Описание задачи`,
 *      `[!example]- Журнал` (по сессиям, у каждой дата), `[!settings]- Настройки`
 *      (списком по вкладкам), `[!action]- Действие` (нумерованными шагами);
 *   4. три раздела: `### 🎯А. Ожидаемый результат`,
 *      `### 🛠️Б. Эталонная исходная строка`, `### 💥В. Тест`.
 *
 * **В — посимвольная копия Б**, и это не украшение: Б он не трогает, работает
 * на В, а расхождение между В и А разбираю я. Разъехавшиеся Б и В означают, что
 * прошлую сессию я закрыл, не почистив заметку.
 *
 * **Чего сторож не проверяет и почему.** Содержания он не понимает: верно ли
 * описана задача, тот ли эталон. Это решает заказчик галочкой. Сторож отвечает
 * на один вопрос — «форма та, о которой он просил».
 *
 * **Почему не в наборе проверок.** Заметка лежит в его vault, а не в
 * репозитории: проверка набора зависела бы от приватного файла и краснела бы у
 * всех, кроме меня. Поэтому — стенд, и зовут его руками: при правке заметки и
 * первым шагом завершения сессии.
 *
 * **Положительный контроль встроен:** перед разбором настоящего файла
 * разбирается заведомо плохой тест, и стенд обязан назвать все его беды. Не
 * назвал — мерить нечем, и это отказ, а не «всё хорошо» (У-88).
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
 * Ищется **слово**, а не заголовок: промпт уже переезжал из раздела в
 * свёрнутый коллаут, и признак по `#` потерял бы предмет молча (У-94).
 */
const SERVICE_WORD = "Служебное";

/**
 * Разделы, которые тестами не являются и заголовок делят с ними.
 *
 * `Мои вопросы к вам` стал заголовком 2026-09-21 его словом: «сделай
 * `[!question]- Мои вопросы к вам · разверните` не в виде коллаута, а
 * отдельного хедера». Свёрнутый коллаут он не разворачивал.
 */
const NOT_A_TEST = ["Новое пишите сюда", "Мои вопросы к вам"];

/** Форма галочки приёмки. Своя, чтобы не считать чекбоксы эталона в разделе А. */
const ACCEPT_BOX = /^- \[[ xX]\] принято\s*$/;
const SAY = "💬";

/** Четыре коллаута карточки: ключ — что искать, значение — как назвать беду. */
const CALLOUTS = [
  { mark: "> [!question]- Описание задачи", name: "«Описание задачи»" },
  { mark: "> [!example]- Журнал", name: "«Журнал»" },
  { mark: "> [!settings]- Настройки", name: "«Настройки»" },
  { mark: "> [!action]- Действие", name: "«Действие»" },
];

const HEAD_EXPECT = "### 🎯А.";
/**
 * Строка заметки, а не проза.
 *
 * Его слово 2026-09-21: «я хочу, чтобы `🎯А. Ожидаемый результат` выглядел как
 * ожидаемая результирующая строка после выполнения Действий», и рядом два
 * примера — `- #high :: [[test1]] текст`. До этого там стояло описание
 * словами, и сверять его с экраном приходилось ему в голове.
 *
 * Спрашивается **начало строки**, а не смысл: у строки заметки оно есть — знак
 * списка, номер, цитата или заголовок, — а у прозы нет. Признак по форме, а не
 * по словам (У-201).
 */
const LINE_START = /^\s*(?:[-*+]|\d+[.)]|>|#{1,6})\s/;
/** Пустой раздел он пишет тире: производить нечего, значит и ждать нечего. */
const NOTHING = /^[—-]\s*$/;
const HEAD_SAMPLE = "### 🛠️Б.";
const HEAD_LIVE = "### 💥В.";

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

/** Строки раздела между двумя подзаголовками `###`, без пустых по краям. */
function sectionOf(body, head) {
  const from = body.findIndex((l) => l.indexOf(head) === 0);
  if (from === -1) return null;
  const out = [];
  for (let i = from + 1; i < body.length; i++) {
    if (/^### /.test(body[i]) || /^---\s*$/.test(body[i])) break;
    out.push(body[i]);
  }
  while (out.length && out[0].trim() === "") out.shift();
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  return out;
}

/** Беды одного теста, каждая своим словом. */
function troublesOf(test) {
  const out = [];
  const body = test.body;
  const joined = body.join("\n");

  /*
   * **Статус — первое, что видно, и без пустой строки над ним.** Его слово:
   * «у задачи наверху должен быть чекбокс с приёмкой… чтобы я сразу
   * идентифицировал статус проверки», и отдельно — «максимально компактно,
   * т.е. без лишних пустых строк между элементами».
   */
  if (!body.length || !ACCEPT_BOX.test(body[0])) {
    out.push("первой строкой под заголовком нет `- [ ] принято` — статус не виден сразу");
  }
  if (body.length < 2 || body[1].indexOf("- " + SAY) !== 0) {
    out.push("второй строкой нет `- " + SAY + "` — замечание писать некуда");
  }
  for (const c of CALLOUTS) {
    if (joined.indexOf(c.mark) === -1) out.push("нет свёрнутого коллаута " + c.name);
  }
  if (joined.indexOf(CALLOUTS[1].mark) !== -1) {
    const log = body.slice(body.findIndex((l) => l.indexOf(CALLOUTS[1].mark) === 0) + 1);
    if (!log.some((l) => /^>.*\d{4}-\d{2}-\d{2}/.test(l))) {
      out.push("в журнале нет ни одной сессии с датой");
    }
  }
  if (joined.indexOf(CALLOUTS[3].mark) !== -1) {
    const act = body.slice(body.findIndex((l) => l.indexOf(CALLOUTS[3].mark) === 0) + 1);
    if (!act.some((l) => /^>\s*\d+\.\s/.test(l))) {
      out.push("действие не разложено по нумерованным шагам");
    }
  }

  const expect = sectionOf(body, HEAD_EXPECT);
  const sample = sectionOf(body, HEAD_SAMPLE);
  const live = sectionOf(body, HEAD_LIVE);
  if (!expect) out.push("нет раздела «🎯А. Ожидаемый результат»");
  else if (!expect.length) out.push("раздел 🎯А пуст — сверять не с чем");
  /*
   * **🎯А — строки, и столько же, сколько в эталоне** (его слово 2026-09-21).
   * Там, где производить нечего (эталон — тире), правило не применяется:
   * у теста про документы строки нет вовсе, и требовать её значило бы
   * требовать выдумки.
   */
  if (expect && sample && sample.length && !sample.every((l) => NOTHING.test(l.trim()))) {
    const want = sample.filter((l) => l.trim() !== "");
    const got = expect.filter((l) => l.trim() !== "");
    const prose = got.filter((l) => !LINE_START.test(l));
    if (prose.length) {
      out.push("🎯А описан словами, а не строкой: " + JSON.stringify(prose[0].slice(0, 50)));
    } else if (got.length < want.length) {
      out.push("в 🎯А строк " + got.length + ", а в 🛠️Б — " + want.length
        + ": у каждой строки свой ожидаемый результат");
    }
  }
  if (!sample) out.push("нет раздела «🛠️Б. Эталонная исходная строка»");
  if (!live) out.push("нет раздела «💥В. Тест»");
  /*
   * **В — посимвольная копия Б.** Разъехались — значит прошлую сессию я закрыл,
   * не почистив заметку, и он сверяет свою работу с чужой строкой. Это его
   * прямое слово: «идентичная копия Б, на которой пользователь будет выполнять
   * действия».
   */
  if (sample && live) {
    const a = sample.join("\n");
    const b = live.join("\n");
    if (a !== b) {
      out.push("💥В не совпадает с 🛠️Б: " + JSON.stringify(b.slice(0, 40))
        + " против " + JSON.stringify(a.slice(0, 40)));
    }
  }

  /*
   * **Команда называется так, как её видно в палитре.** Ключ Order оканчивается
   * на `_sub`, а имя команды — на `-sub`, и на этой разнице он потерял проверку
   * целиком: искал `Cat_sub previous`, а в палитре стоит `Category-sub previous`
   * (его пометка «нет команда sub»).
   */
  if (/[A-Za-zА-Яа-я]_sub\b/.test(joined)) {
    out.push("команда названа ключом Order (`_sub`), а в палитре она через дефис");
  }
  if (body.some((l) => l.indexOf("`") === 0)) {
    out.push("строка начинается с обратной кавычки");
  }
  if (body.some((l) => l.trim().indexOf("- →") === 0)) {
    out.push("есть строка `→` — моё объяснение живёт в docs/dev/AWAITING_OWNER_CHECK.md");
  }
  /* Лишняя пустота: две пустые строки подряд — это «раздуто» его словом. */
  for (let i = 1; i < body.length; i++) {
    if (body[i].trim() === "" && body[i - 1].trim() === "") {
      out.push("две пустые строки подряд — он просил максимально компактно");
      break;
    }
  }
  return out;
}

/** Положительный контроль: заведомо плохой тест обязан быть назван. */
function selfCheck() {
  const bad = [
    "## 1. Плохой тест",
    "",
    "- [ ] принято",
    "- нет строки замечания",
    "",
    "",
    "`строка с кавычки`",
    "\t- → и моё объяснение здесь же",
    "Команда Cat_sub previous",
    "### 🎯А. Ожидаемый результат",
    "### 🛠️Б. Эталонная исходная строка",
    "- текст",
    "### 💥В. Тест",
    "- другой текст",
  ].join("\n");
  const tests = testsOf(bad);
  if (tests.length !== 1) throw new Error("контроль: плохой тест не разобрался");
  const troubles = troublesOf(tests[0]);
  const want = [
    "первой строкой", "второй строкой", "«Описание задачи»", "«Журнал»",
    "«Настройки»", "«Действие»", "🎯А пуст", "💥В не совпадает",
    "ключом Order", "обратной кавычки", "строка `→`", "две пустые строки",
  ];
  for (const w of want) {
    if (!troubles.some((t) => t.indexOf(w) !== -1)) {
      throw new Error("контроль: стенд не заметил беду «" + w + "» — мерить нечем");
    }
  }

  /*
   * **Своя пара контролей на правило про 🎯А**, положительный и отрицательный.
   * Общий плохой пример его не проверяет: там раздел 🎯А пуст, и до счёта
   * строк дело не доходит.
   */
  const card = (expectLines) => [
    "## 1. Тест",
    "- [ ] принято",
    "- 💬 ",
    "> [!question]- Описание задачи",
    "> текст",
    "",
    "> [!example]- Журнал",
    "> **Сессия 1 · 2026-09-21**",
    "",
    "> [!settings]- Настройки",
    "> нет",
    "",
    "> [!action]- Действие",
    "> 1. нажать",
    "### 🎯А. Ожидаемый результат",
  ].concat(expectLines, [
    "### 🛠️Б. Эталонная исходная строка",
    "- #low :: текст",
    "### 💥В. Тест",
    "- #low :: текст",
  ]).join(String.fromCharCode(10));

  /** Та же карточка, но эталон из двух строк: проверять недостачу больше нечем. */
  const cardTwoSamples = (expectLines) => card(expectLines)
    .replace("### 🛠️Б. Эталонная исходная строка" + String.fromCharCode(10) + "- #low :: текст",
      "### 🛠️Б. Эталонная исходная строка" + String.fromCharCode(10)
      + "- #low :: текст" + String.fromCharCode(10) + "- #med :: текст")
    .replace("### 💥В. Тест" + String.fromCharCode(10) + "- #low :: текст",
      "### 💥В. Тест" + String.fromCharCode(10)
      + "- #low :: текст" + String.fromCharCode(10) + "- #med :: текст");

  const good = troublesOf(testsOf(card(["- #high :: текст"]))[0]);
  if (good.length) {
    throw new Error("контроль: на верной карточке стенд нашёл беды — " + JSON.stringify(good));
  }
  const proseCard = troublesOf(testsOf(card(["Строка получает значение и текст цел"]))[0]);
  if (!proseCard.some((t) => t.indexOf("описан словами") !== -1)) {
    throw new Error("контроль: проза в 🎯А не названа — мерить нечем");
  }
  /*
   * **Больше строк, чем в эталоне, — законно**, и это не послабление: у теста
   * про вид панели ожидаемых строк две — как строка выглядит при открытой
   * панели и какой она становится после `Esc`. Считается недостача, а не
   * избыток.
   */
  const twoCard = troublesOf(testsOf(card(["- #high :: текст", "- #low :: текст"]))[0]);
  if (twoCard.length) {
    throw new Error("контроль: две ожидаемые строки объявлены бедой — " + JSON.stringify(twoCard));
  }
  const shortCard = troublesOf(testsOf(cardTwoSamples(["- #high :: текст"]))[0]);
  if (!shortCard.some((t) => t.indexOf("а в 🛠️Б") !== -1)) {
    throw new Error("контроль: недостача строк в 🎯А не названа — мерить нечем");
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
  const open = (text.match(/^- \[ \] принято\s*$/gm) || []).length;
  console.log("тестов " + tests.length + ", расходится " + bad
    + "; не принято " + open + "; знаков в заметке " + text.length);
  if (bad) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { testsOf, troublesOf, sectionOf, selfCheck, ACCEPT_BOX, DEFAULT_SHEET };
