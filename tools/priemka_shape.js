"use strict";

/**
 * Форма листа приёмки: у пункта три строки, и ни одной моей.
 *
 * **Зачем отдельный сторож.** Правило «в листе только то, что он проверяет»
 * куплено дважды. 2026-09-11 он сказал «этот файл превратился в какой-то
 * длинный лог текста — не раздувай», 2026-09-20 — «я не понимаю, что мне
 * делать в файле приёмки». Между этими словами в лист поехали строки `→`:
 * объяснение к каждому пункту, разбор причины, «что я не делал и почему».
 * Каждая была верной, и ни одна не была ему нужна. Правило без сторожа живёт
 * на моей памяти, а срок у неё кончается (У-202, правило 122).
 *
 * **Почему не в наборе проверок.** Лист лежит в его vault, а не в репозитории:
 * проверка набора зависела бы от приватного файла и краснела бы у всех, кроме
 * меня (`repo_completeness_tests.js` это и запрещает). Поэтому — стенд, и зовут
 * его руками: при правке листа и первым шагом завершения сессии.
 *
 * **У стенда есть положительный контроль, и он встроен:** перед разбором
 * настоящего файла разбирается заведомо плохой пункт, и стенд обязан назвать
 * все четыре его беды. Не назвал — мерить нечем, и это отказ, а не «всё
 * хорошо» (У-88).
 *
 * Запуск (из `repo/`):
 *   node tools/priemka_shape.js
 *   node tools/priemka_shape.js "<путь к листу>"
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SHEET = path.resolve(ROOT, "..", "test-vault", "Приёмка.md");

/**
 * Служебный раздел: ниже него пункты не ищутся.
 *
 * Ищется **слово**, а не заголовок: по его слову 2026-09-20 промпт переехал из
 * раздела в свёрнутый коллаут (`> [!note]- Служебное …`), и признак, написанный
 * по `#`, потерял бы предмет молча (У-94).
 */
const SERVICE_WORD = "Служебное";

/** Сколько вложенных строк у пункта: «Сделайте», «Должно получиться» и `💬`. */
const NESTED_PER_ITEM = 3;

/** Слова, которых в пункте быть не должно: это рассказ, а не проверка. */
const MY_WORDS = ["причина", "измерен", "потому что", "разбор", "я не делал"];

/**
 * Пункты листа: заголовок с чекбоксом и всё, что под ним с отступом.
 *
 * Служебный раздел отрезается **до** разбора: в нём лежит промпт сессии, и
 * его строки к пунктам отношения не имеют.
 */
function itemsOf(text) {
  const src = String(text || "");
  const cut = src.indexOf(SERVICE_WORD);
  const body = cut === -1 ? src : src.slice(0, cut);
  const lines = body.split("\n");
  const items = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^- \[[ xX]\] /.test(line)) {
      current = { head: line, at: i + 1, nested: [] };
      items.push(current);
      continue;
    }
    if (!current) continue;
    if (/^\s+- /.test(line)) { current.nested.push(line.replace(/^\s+/, "")); continue; }
    if (line.trim() === "") continue;
    current = null;
  }
  return items;
}

/** Беды одного пункта, каждая своим словом. */
function troublesOf(item) {
  const out = [];
  const nested = item.nested;
  if (nested.length > NESTED_PER_ITEM) {
    out.push("вложенных строк " + nested.length + ", а должно быть " + NESTED_PER_ITEM);
  }
  if (nested.some((l) => l.indexOf("- →") === 0)) {
    out.push("есть строка `→` — моё объяснение живёт в docs/AWAITING_OWNER_CHECK.md");
  }
  if (!nested.some((l) => l.indexOf("**Сделайте:**") !== -1)) {
    out.push("нет строки «Сделайте» — непонятно, что нажать");
  }
  if (!nested.some((l) => l.indexOf("**Должно получиться:**") !== -1)) {
    out.push("нет строки «Должно получиться» — непонятно, с чем сверять");
  }
  if (!nested.some((l) => l.indexOf("💬") !== -1)) {
    out.push("нет строки `💬` — замечание писать некуда");
  }
  const head = item.head.toLowerCase();
  for (const word of MY_WORDS) {
    if (head.indexOf(word) !== -1) out.push("в заголовке слово «" + word + "» — это рассказ, а не проверка");
  }
  return out;
}

/** Положительный контроль: заведомо плохой пункт обязан быть назван. */
function selfCheck() {
  const bad = [
    "- [ ] **S11.** 🕐 Дочернее поле — причина была в отборе",
    "\t- → По вашему заказу сделано вот что",
    "\t- → Как проверить, за минуту: нажмите что-нибудь",
    "\t- → И ещё одно объяснение",
    "\t- 💬",
  ].join("\n");
  const items = itemsOf(bad);
  if (items.length !== 1) throw new Error("контроль: плохой пункт не разобрался");
  const troubles = troublesOf(items[0]);
  const want = ["вложенных строк", "строка `→`", "«Сделайте»", "«Должно получиться»", "слово «причина»"];
  for (const w of want) {
    if (!troubles.some((t) => t.indexOf(w) !== -1)) {
      throw new Error("контроль: стенд не заметил беду «" + w + "» — мерить нечем");
    }
  }
  return troubles.length;
}

function main() {
  const found = selfCheck();
  console.log("положительный контроль: на заведомо плохом пункте названо бед " + found);

  const file = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SHEET;
  if (!fs.existsSync(file)) {
    console.error("листа нет по пути " + file + " — укажите его аргументом");
    process.exitCode = 1;
    return;
  }
  const text = fs.readFileSync(file, "utf8");
  const items = itemsOf(text);
  /* Ноль пунктов — не «всё хорошо», а «мерить нечем» (У-88). */
  if (!items.length) {
    console.error("в листе нет ни одного пункта с чекбоксом — разбирать нечего");
    process.exitCode = 1;
    return;
  }

  let bad = 0;
  for (const item of items) {
    const troubles = troublesOf(item);
    if (!troubles.length) continue;
    bad++;
    console.log("РАЗОШЛОСЬ строка " + item.at + ": " + item.head.slice(0, 70));
    for (const t of troubles) console.log("    " + t);
  }
  const chars = text.length;
  console.log("пунктов " + items.length + ", расходится " + bad + "; знаков в листе " + chars);
  if (bad) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { itemsOf, troublesOf, selfCheck, DEFAULT_SHEET };
