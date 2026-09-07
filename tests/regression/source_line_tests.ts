/**
 * Исходная строка после `inline2note` (замечание заказчика 1.6.5.1).
 *
 * **Что здесь закреплено.** Заказчик помнил настройки, которых не нашёл в
 * панели, и был прав дважды:
 *
 *   1. `sourceProcessing.cleanupFieldIds` — какие Fields остаются на строке —
 *      движок читает с самого начала, а контрола к ней не было **ни в одной**
 *      панели. Настройку потеряли при переносе, а не убрали решением (З2).
 *   2. Судьба текста и ссылка жили в одном тумблере `replaceWithLink`, и из
 *      четырёх сочетаний были достижимы два. Заказчику нужны остальные:
 *      оставить текст И получить ссылку, оставить первые слова.
 *
 * Проверка идёт на **настоящих функциях движка** из `transform_feature.js`:
 * подделать разбор строки значило бы проверять свою копию правил, а разбор
 * здесь тонкий — Separator, маркер списка, пустой хвост.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = createRequire(import.meta.url);
const transform = requireCjs(path.join(root, "src", "features", "transform_feature.js")) as Any;
/* Вторая сторона сверки образца: тот самый модуль, у которого движок и
   спрашивает длину хвоста. */
const helpers = requireCjs(path.join(root, "src", "core", "pkm_rules_runtime_helpers.js")) as Any;

const SEP = { separator1: "||", separator2: "||" };

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/* ---- 1: судьба текста и ссылка развязаны -------------------------------- */

{
  const line = "- [ ] #todo || buy milk in the shop || \u{1F4C5}2026-08-31";
  const fate = (o: Any): string => transform.applySourceTextFate(line, "Notes/Milk", SEP, o);

  assert.equal(fate({ text: "remove", link: true }),
    "- [ ] #todo || [[Notes/Milk]] || \u{1F4C5}2026-08-31",
    "текст ушёл, ссылка встала на его место — прежнее поведение при включённом тумблере");

  assert.equal(fate({ text: "leave", link: false }), line,
    "текст остался, ссылки нет — прежнее поведение при выключенном тумблере, "
    + "и строка не тронута ни одним пробелом");

  /* Ради этих двух сочетаний всё и делалось: раньше их получить было нельзя. */
  assert.equal(fate({ text: "leave", link: true }),
    "- [ ] #todo || buy milk in the shop [[Notes/Milk]] || \u{1F4C5}2026-08-31",
    "текст остался И появилась ссылка");

  assert.equal(fate({ text: "words", keepWords: 2, link: true }),
    "- [ ] #todo || buy milk [[Notes/Milk]] || \u{1F4C5}2026-08-31",
    "остались первые два слова и ссылка");

  assert.equal(fate({ text: "remove", link: false }),
    "- [ ] #todo || || \u{1F4C5}2026-08-31",
    "текст убран без ссылки: строка остаётся, но искать заметку по ней нечем "
    + "— об этом сказано в подсказке контрола");
  ok("судьба текста и ссылка — независимые настройки, все четыре сочетания различны");
}

{
  /* Слов в тексте меньше, чем просили оставить: берём сколько есть. */
  const short = "- [ ] || two words || ";
  assert.equal(
    transform.applySourceTextFate(short, "N", SEP, { text: "words", keepWords: 9, link: false }),
    "- [ ] || two words",
    "просили больше слов, чем есть — строка не ломается");
  assert.equal(
    transform.applySourceTextFate(short, "N", SEP, { text: "words", keepWords: 0, link: false }),
    "- [ ] || two",
    "ноль слов не бывает: остаётся одно");
  ok("число слов зажато снизу и не требует, чтобы слов хватало");
}

/* ---- 2: старая функция замены не изменилась ----------------------------- */

{
  /*
   * `applySourcePayloadReplace` осталась на месте и обязана давать ровно то же,
   * что и раньше: разбор строки из неё вынесен в общую функцию, и вынос не
   * должен был ничего сдвинуть. Проверяются все четыре ветки разбора.
   */
  const same = (line: string, want: string, why: string): void => {
    assert.equal(transform.applySourcePayloadReplace(line, "T", SEP), want, why);
  };
  same("\t- [ ] #todo || old || tail", "\t- [ ] #todo || [[T]] || tail",
    "оба Separator на месте, хвост сохранён");
  same("- [ ] #todo || old", "- [ ] #todo || [[T]]",
    "второго Separator нет — и он не дописывается");
  same("- plain text", "- [[T]]", "маркер списка без Separator");
  same("plain text", "plain text || [[T]]",
    "ни маркера, ни Separator: ссылка дописывается в конец");
  assert.equal(transform.applySourcePayloadReplace("- x", "", SEP), "- x",
    "без имени заметки строка не трогается");

  /*
   * Две мелочи, которые вынос разбора всё-таки поправил, и это записано, а
   * не пропущено: пустых мест в строке больше не остаётся.
   */
  same("|| old ||", "|| [[T]]",
    "строка начинается с Separator — ведущего пробела больше нет");
  assert.equal(
    transform.applySourceTextFate("- [ ] a || old || b", "N", SEP, { text: "remove", link: false }),
    "- [ ] a || || b",
    "текст убран целиком — между Separator один пробел, а не два");
  ok("замена текста ссылкой ведёт себя ровно как до разделения");
}

/* ---- 3: настройка судьбы текста выводится из старого тумблера ----------- */

{
  /*
   * Ключа `text` в старых настройках нет. Умолчание схемы тут не годится: до
   * разделения судьбу текста решал тот же тумблер, что и ссылку, и человек,
   * выключивший ссылку, ждёт, что текст остаётся. Взять умолчание схемы
   * значило бы начать стирать ему текст после обновления.
   */
  const withLink = transform.normalizeInline2Note({ sourceProcessing: { replaceWithLink: true } });
  assert.equal(withLink.sourceProcessing.text, "remove",
    "ссылка была включена — значит текст уходил, и так и остаётся");

  const noLink = transform.normalizeInline2Note({ sourceProcessing: { replaceWithLink: false } });
  assert.equal(noLink.sourceProcessing.text, "leave",
    "ссылка была выключена — значит текст оставался, и обновление его не унесёт");

  const explicit = transform.normalizeInline2Note({
    sourceProcessing: { replaceWithLink: false, text: "remove" },
  });
  assert.equal(explicit.sourceProcessing.text, "remove",
    "заданный ключ сильнее вывода из тумблера");

  const words = transform.normalizeInline2Note({ sourceProcessing: { keepWords: 99 } });
  assert.equal(words.sourceProcessing.keepWords, 20, "число слов зажато сверху");
  ok("после обновления строка ведёт себя так же, как вела: ключ выводится из тумблера");
}

/* ---- 4: какие Fields остаются на строке --------------------------------- */

{
  /*
   * Имя ключа говорит `cleanup`, а список в нём — тех, кого НЕ убирают. Это
   * поведение движка, менять его нельзя (З1), поэтому правду говорит подпись
   * контрола. Проверка держит именно смысл: отмеченный Field остаётся.
   */
  const line = "- [ ] #/1 #todo || text123 || \u{1F4C5}2026-08-31";
  const ctxOf = (): Any => ({
    matches: [
      { fieldId: "importance", span: { start: 6, end: 10 } },
      { fieldId: "status", span: { start: 11, end: 16 } },
    ],
  });

  const keptNone = transform.applySourceCleanupByFieldIds(line, ctxOf(), [], SEP);
  assert.ok(!keptNone.includes("#/1") && !keptNone.includes("#todo"),
    "ничего не отмечено — со строки уходят все Values: " + keptNone);

  const keptOne = transform.applySourceCleanupByFieldIds(line, ctxOf(), ["importance"], SEP);
  assert.ok(keptOne.includes("#/1"), "отмеченный Field остался: " + keptOne);
  assert.ok(!keptOne.includes("#todo"), "неотмеченный ушёл: " + keptOne);
  ok("отмеченные Fields остаются на строке, остальные уходят");
}

{
  /* Отмеченный Field, которого больше нет, молча отбрасывается. */
  const cfg = {
    pkm: {
      fields: {
        order: { left: ["status"], strictNames: { status: "status" }, types: { status: "tag" } },
        tags: { fields: [{ id: "status", orderKey: "status", values: [{ token: "#todo" }] }] },
      },
    },
  } as Any;
  const alive = transform.resolveSourceCleanupFieldIds(
    { sourceProcessing: { cleanupFieldIds: ["status", "gone_field"] } }, cfg,
  );
  assert.deepEqual(alive, ["status"],
    "Field, которого нет, из списка выпадает, а не роняет перенос");
  ok("удалённый Field в списке не мешает: он просто не считается");
}

/* ---- 5: имя в скобках — название заметки, а не текст строки ------------- */

/**
 * Замечание заказчика по R4, 2026-09-07. Его строка и его ожидание:
 *
 *   было    `- [ ] #todo :: [тест-трансформ] тест1 :: 📅2026-09-07 11:25`
 *   стало   `- [[333/тест-трансформ]] тест1 :: #processed`
 *
 * Здесь закреплены обе половины: имя со строки уходит, а ссылка встаёт **на
 * его место**, а не в конец текста. Место видно только по строкам, где до
 * имени что-то стоит: если ссылку приписывать в конец, обе строки ниже дают
 * один и тот же ответ и проверка слепнет.
 */
const I2N_BRACKETS = { noteName: { mode: "auto", delimiters: "[]" } } as Any;

{
  const line = "- [ ] #todo || [тест-трансформ] tail text || \u{1F4C5}2026-08-31";
  const title = "тест-трансформ";
  assert.equal(transform.explicitTitleOf(line, I2N_BRACKETS), title,
    "имя читается из скобок");

  const fate = (o: Any): string => transform.applySourceTextFate(
    line, "333/" + title, SEP, { explicitTitle: title, i2n: I2N_BRACKETS, ...o });

  assert.equal(fate({ text: "words", keepWords: 2, link: true }),
    "- [ ] #todo || [[333/тест-трансформ]] tail text || \u{1F4C5}2026-08-31",
    "имя ушло, ссылка встала на его место, слова считаны без имени");

  assert.equal(fate({ text: "remove", link: true }),
    "- [ ] #todo || [[333/тест-трансформ]] || \u{1F4C5}2026-08-31",
    "текст убран целиком — остаётся одна ссылка");

  assert.equal(fate({ text: "leave", link: false }),
    "- [ ] #todo || tail text || \u{1F4C5}2026-08-31",
    "ссылки нет, текст остаётся — но имя всё равно уходит: оно стало названием");
  ok("явное имя уходит со строки, а ссылка встаёт на его место");
}

{
  /* Имя в середине и в конце: место ссылки повторяет место имени. */
  const mid = "- [ ] || head [name] tail ||";
  assert.equal(
    transform.applySourceTextFate(mid, "N", SEP,
      { text: "leave", link: true, explicitTitle: "name", i2n: I2N_BRACKETS }),
    "- [ ] || head [[N]] tail",
    "имя стояло между словами — ссылка встала между ними же");

  const last = "- [ ] || head words [name] ||";
  assert.equal(
    transform.applySourceTextFate(last, "N", SEP,
      { text: "leave", link: true, explicitTitle: "name", i2n: I2N_BRACKETS }),
    "- [ ] || head words [[N]]",
    "имя стояло в конце — ссылка встала в конец");
  ok("ссылка повторяет место имени, а не приписывается в конец");
}

{
  /* Имени нет — прежний порядок «текст, потом ссылка» не тронут. */
  const plain = "- [ ] || buy milk in the shop ||";
  assert.equal(
    transform.applySourceTextFate(plain, "N", SEP,
      { text: "words", keepWords: 2, link: true, explicitTitle: "", i2n: I2N_BRACKETS }),
    "- [ ] || buy milk [[N]]",
    "без имени ссылка по-прежнему идёт за текстом");

  /* Имя названо, но на строке его нет — например, набрано в окне вручную. */
  assert.equal(
    transform.applySourceTextFate(plain, "N", SEP,
      { text: "leave", link: true, explicitTitle: "typed by hand", i2n: I2N_BRACKETS }),
    "- [ ] || buy milk in the shop [[N]]",
    "имя, которого на строке нет, скобок не трогает");
  ok("строки без явного имени ведут себя как раньше");
}

{
  /* Текст, уезжающий в заметку: имя из корневой строки уходит, дерево цело. */
  const block = "- [ ] #todo || [name] tail || \u{1F4C5}2026-08-31\n\t- дочка [name]";
  assert.equal(
    transform.stripExplicitTitleFromBlock(block, "name", I2N_BRACKETS),
    "- [ ] #todo || tail || \u{1F4C5}2026-08-31\n\t- дочка [name]",
    "в заметку уезжает строка без названия; дочерние строки не тронуты");
  ok("название не дублируется в тексте заметки");
}

/* ---- 6: значение элемента читается по формату поля ---------------------- */

/**
 * Дефект той же строки заказчика: у Due формат `YYYY-MM-DD hh:mm`, а движок
 * искал значение «от метки до пробела». Снималась половина, `11:25` оставалось
 * на строке текстом человека, а в свойства заметки дата уезжала обрезанной.
 *
 * Ниже — обе стороны одного правила: образец, по которому значение читается, и
 * пример, который панель по тому же формату показывает. Сверка их друг с
 * другом и есть то, чем ловится расхождение (У-92).
 */
{
  const cfg = {
    pkm: {
      lineFormat: { separator1: "::", separator2: "::" },
      fields: {
        order: { left: [], right: ["due"], types: { due: "element" }, active: { due: "yes" }, enabled: { due: true } },
        tags: { fields: [] },
        links: { fields: [{ id: "due", marker: "\u{1F4C5}", values: [{ token: "", active: true }] }] },
        elements: { fields: ["due"], byField: { due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD hh:mm" } } },
      },
    },
  } as Any;

  const parsed = transform.parseInlineLine("- 11 :: \u{1F4C5}2026-09-07 11:25", cfg);
  assert.deepEqual(parsed.emojis, [{ marker: "\u{1F4C5}", value: "2026-09-07 11:25" }],
    "значение элемента прочитано целиком, вместе со временем");
  assert.equal(parsed.emojiOccurrences[0].end - parsed.emojiOccurrences[0].start,
    "\u{1F4C5}2026-09-07 11:25".length,
    "отрезок покрывает и время: по нему элемент со строки и снимают");

  const rules = transform.getElementMarkerRulesFromConfig(cfg);
  assert.equal(rules.length, 1, "метка одна");
  assert.equal(rules[0].tail, "\\d{4}-\\d{2}-\\d{2}[ ]\\d{2}:\\d{2}",
    "хвост выведен из формата тем же правилом, что у разбора строки");

  for (const format of ["YYYY-MM-DD", "YYYY-MM-DD hh:mm", "YYYY-MM-DD HH-mm-ss", "DD.MM.YYYY", "hh:mm"]) {
    const sample = transform.elementSampleValueFromFormat(format);
    const tail = helpers.elementTailPatternFromFormat(format);
    assert.ok(new RegExp("^(?:" + tail + ")$").test(sample),
      "пример «" + sample + "» законен для формата «" + format + "» (образец " + tail + ")");
  }
  /* Отрицательная сторона той же сверки: маска, которая тут стояла раньше,
     под образец не подходит — иначе проверка была бы зелёной от того, что
     подходит всё. */
  assert.ok(!new RegExp("^(?:" + helpers.elementTailPatternFromFormat("YYYY-MM-DD") + ")$").test("YYYY-MM-DD"),
    "сама маска значением не является");
  ok("значение элемента и его пример выведены из формата поля, и они сходятся");
}

console.log("\n" + passed + " проверок пройдено");
