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
  /*
   * **Значение узнаётся в любом Block, а в слоте текста — не узнаётся** (его
   * решение В-132, 2026-09-16: «должны уходить только те values, которые не
   * отмечены в source-fields-head»).
   *
   * До этого Transform видел значение, **только** стоя в том Block, который
   * назначил ему Order: всё остальное не уходило со строки по `Fields to keep`
   * и не попадало в свойства заметки. На его заметках таких значений 110 из
   * 337 — он перенёс Fields в правый Block, а строки, написанные прежде,
   * держат их слева.
   *
   * Обе половины правила проверяются вместе: без второй запрет выполнялся бы
   * и кодом, который тащит в значения слово человека (У-127).
   */
  const cfg = {
    pkm: {
      lineFormat: { separator1: "::", separator2: "::" },
      fields: {
        order: {
          left: [], right: ["status"],
          strictNames: { status: "status" }, types: { status: "tag" },
          active: { status: "yes" }, enabled: { status: true },
        },
        tags: { fields: [{ id: "status", orderKey: "status", prefix: "#", values: [{ token: "#todo" }] }] },
        links: { fields: [] },
        elements: { fields: [], byField: {} },
      },
    },
  } as Any;
  const idsOf = (line: string): string[] => transform
    .buildTransformContext(transform.parseInlineLine(line, cfg), cfg)
    .matches.map((row: Any) => String(row.fieldId) + "@" + String(row.span && row.span.panel));

  assert.deepEqual(idsOf("- :: текст :: #todo"), ["status@right"],
    "значение в своём Block узнано");
  assert.deepEqual(idsOf("- #todo :: текст"), ["status@left"],
    "значение в соседнем Block узнано тоже: Block назначает Order, а пишет человек");
  assert.deepEqual(idsOf("- :: слово #todo слово :: "), [],
    "то же значение внутри слова человека значением не считается");

  /* И поведение, ради которого правило и нужно: неотмеченный Field уходит со
     строки, где бы он ни стоял, а отмеченный остаётся. */
  const sweep = (line: string, keep: string[]): string => transform.applySourceCleanupByFieldIds(
    line, transform.buildTransformContext(transform.parseInlineLine(line, cfg), cfg), keep,
    { separator1: "::", separator2: "::" });
  assert.ok(!sweep("- #todo :: текст", []).includes("#todo"),
    "неотмеченный ушёл и из соседнего Block: " + sweep("- #todo :: текст", []));
  assert.ok(sweep("- #todo :: текст", ["status"]).includes("#todo"),
    "отмеченный остался: " + sweep("- #todo :: текст", ["status"]));
  assert.ok(sweep("- :: слово #todo слово :: ", []).includes("#todo"),
    "слово человека не трогает никто: " + sweep("- :: слово #todo слово :: ", []));
  ok("значение узнаётся в любом Block и не узнаётся в слоте текста (В-132)");
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

  {
    /*
     * **Начало строки принадлежит платформе, и номер списка — тоже** (его
     * решение В-133, 2026-09-16: «да», считать номер разметкой, как буллит).
     * Прежний образец знал знак списка, задачу и заголовок, а номера не знал:
     * `1. текст` уезжало в заметку и в её имя вместе с `1.`.
     *
     * Здесь же вторая половина, которая шире его слова и названа вслух:
     * цитата и каллаут — такое же внешнее оформление строки, и дом снимает их
     * заодно. И третья: знак заголовка, за которым ничего нет, текстом не
     * становится — иначе именем заметки станет одинокая решётка.
     */
    const same = (line: string): string => String(transform.parseInlineLine(line, cfg).payloadText || "");
    assert.equal(same("1. текст заметки"), "текст заметки", "номер списка — разметка, а не слово");
    assert.equal(same("1) текст заметки"), "текст заметки", "вторая форма номера — тоже разметка");
    assert.equal(same("- текст заметки"), "текст заметки", "знак списка как был");
    assert.equal(same("## текст заметки"), "текст заметки", "знак заголовка как был");
    assert.equal(same("> [!note] текст заметки"), "текст заметки", "каллаут — внешнее оформление строки");
    assert.equal(same("#"), "", "одинокая решётка словом человека не становится");
    assert.equal(same("1."), "", "и одинокий номер тоже");
    ok("номер списка, цитата и каллаут — разметка строки, а не текст для имени заметки (В-133)");
  }

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

/* ---- 6: слова, ставшие названием, уходят вместе со ссылкой -------------- */

/**
 * Замечание заказчика по T1, 2026-09-07. Его настройки — `wordCount` = 6,
 * `words`, `keepWords` = 2, — его строка и три записи одного результата:
 *
 *   было    `- [ ] #/1 #todo :: тест-трансформ4 тест1 … тест6 :: 📅…`
 *   видел   `- #/1 :: тест-трансформ4 тест1 [[333/тест-трансформ4 … тест5]] :: 📅…`
 *   хочет   `- #/1 :: [[333/тест-трансформ4 … тест5]] тест6 :: 📅…`
 *
 * Название собралось из первых шести слов текста — и эти же слова остались на
 * строке, а ссылка встала за первыми двумя из них. Его слова: «wikilink на
 * новую заметку должен заменить слова, из которых получилась заметка, иначе
 * преобразование получается странным».
 *
 * Закреплено здесь: ссылка встаёт **на место** слов названия, `keepWords`
 * считает остаток, а `leave` и `remove` не меняются ни на пробел.
 */
const I2N_WORDS = { noteName: { mode: "auto", delimiters: "[]", wordCount: 6 } } as Any;

{
  const line = "- [ ] || тест-трансформ4 тест1 тест2 тест3 тест4 тест5 тест6 || \u{1F4C5}2026-09-07 13:27";
  const parsed = { line, payloadText: "тест-трансформ4 тест1 тест2 тест3 тест4 тест5 тест6" };
  const titled = transform.resolveAutoTitleInfo(parsed, I2N_WORDS);
  assert.equal(titled.origin, "words", "название собралось из слов текста, а не из скобок");
  assert.equal(titled.title, "тест-трансформ4 тест1 тест2 тест3 тест4 тест5",
    "в название пошли первые шесть слов");

  const fate = (o: Any): string => transform.applySourceTextFate(
    line, "333/" + titled.title, SEP, { i2n: I2N_WORDS, ...o });

  assert.equal(fate({ text: "words", keepWords: 2, link: true, titleWords: titled.title }),
    "- [ ] || [[333/тест-трансформ4 тест1 тест2 тест3 тест4 тест5]] тест6 || \u{1F4C5}2026-09-07 13:27",
    "ссылка встала на место слов названия, а на строке остался остаток");

  /* Та же строка без нового знания — то, что заказчик видел. Отрицательная
     сторона: без него ответ другой, значит правка достижима и работает. */
  assert.equal(fate({ text: "words", keepWords: 2, link: true }),
    "- [ ] || тест-трансформ4 тест1 [[333/тест-трансформ4 тест1 тест2 тест3 тест4 тест5]] || \u{1F4C5}2026-09-07 13:27",
    "положительный контроль: не назвав слова названия, получаем прежний ответ");

  assert.equal(fate({ text: "leave", link: true, titleWords: titled.title }),
    "- [ ] || тест-трансформ4 тест1 тест2 тест3 тест4 тест5 тест6 "
    + "[[333/тест-трансформ4 тест1 тест2 тест3 тест4 тест5]] || \u{1F4C5}2026-09-07 13:27",
    "`leave` обещает строку как была: слова названия из неё не снимаются");

  assert.equal(fate({ text: "remove", link: true, titleWords: titled.title }),
    "- [ ] || [[333/тест-трансформ4 тест1 тест2 тест3 тест4 тест5]] || \u{1F4C5}2026-09-07 13:27",
    "`remove` не изменился: текста не остаётся, остаётся ссылка");
  ok("ссылка встаёт на место слов, ставших названием, и только при `words`");
}

{
  /* Место ссылки видно только там, где до слов названия что-то стоит. */
  const withHead = "- [ ] || \u{1F4C5}2026-09-07 head one two tail || ";
  assert.equal(
    transform.applySourceTextFate(withHead, "N", SEP, {
      text: "words", keepWords: 5, link: true, i2n: I2N_WORDS, titleWords: "head one two",
    }),
    "- [ ] || \u{1F4C5}2026-09-07 [[N]] tail",
    "то, что в название не пошло, осталось слева от ссылки, а не пропало");

  /* Названием стал весь текст — на строке остаётся одна ссылка. */
  assert.equal(
    transform.applySourceTextFate("- [ ] || one two || ", "N", SEP, {
      text: "words", keepWords: 2, link: true, i2n: I2N_WORDS, titleWords: "one two",
    }),
    "- [ ] || [[N]]",
    "текст целиком стал названием — остатка нет");

  /* Слова названы, но на строке их нет: имя набрано в окне вручную, строка с
     тех пор изменилась. Прежний порядок «текст, потом ссылка» цел. */
  assert.equal(
    transform.applySourceTextFate("- [ ] || one two three || ", "N", SEP, {
      text: "words", keepWords: 2, link: true, i2n: I2N_WORDS, titleWords: "typed by hand",
    }),
    "- [ ] || one two [[N]]",
    "слов названия на строке нет — считаем по-старому");
  ok("остаток, пустой остаток и ненайденные слова названия");
}

{
  /* Разрез сам по себе: он же отвечает на «что стало названием» второму
     месту — предпросмотру в панели. */
  assert.deepEqual(
    transform.splitByTitleWords("one two three four", "one two"),
    { head: "", tail: "three four", found: true },
    "слова названия сняты с начала, остаток цел");
  assert.deepEqual(
    transform.splitByTitleWords("one two three", "one three"),
    { head: "two", tail: "", found: true },
    "то, что между словами названия, остаётся на строке");
  assert.deepEqual(
    transform.splitByTitleWords("one two", "one nine"),
    { head: "one two", tail: "", found: false },
    "нашлось не всё — разреза нет");
  assert.deepEqual(
    transform.splitByTitleWords("one two", ""),
    { head: "one two", tail: "", found: false },
    "слов не назвали — разреза нет");
  ok("разрез по словам названия: остаток, середина и отказ");
}

{
  /*
   * **Название из заголовка снимается со строки наравне со словами** — его
   * замечание `G2`, 2026-09-16: «исходное название `## #/1 :: dfdf ::
   * 📅2026-09-16 20:03`, после трансформации стало `- #/1 :: dfdf
   * [[222/dfdf]] :: 📅…`, а должно было быть `- #/1 :: [[222/dfdf]] :: 📅…`».
   *
   * **Здесь стояло обратное утверждение, и оно было верным до В-128.** Пока
   * названием из заголовка была строка целиком, вместе с Separator, слова
   * такого названия подпоследовательностью текста не бывали, и разрез не
   * находился ни при какой записи условия — то есть мутация между
   * `origin === "words"` и «всё, кроме скобок» молчала. С В-128 названием
   * становится **текст** заголовка, и с того дня оно на строке есть: прежнее
   * утверждение стало охранять дефект (У-193 по смыслу — проверка пережила
   * свой предмет).
   *
   * Ответ теперь один на перенос и на предпросмотр — `resolveTitleSwap`, и
   * спрашивается он здесь, а не переписывается.
   */
  const I2N_HEADER = {
    noteName: { mode: "auto", delimiters: "[]", wordCount: 6, preferHeaderTitle: true },
  } as Any;
  const parsedHeader = {
    line: "## #/1 :: dfdf :: \u{1F4C5}2026-09-16 20:03",
    payloadText: "dfdf",
    separators: { separator1: "::", separator2: "::" },
    tagOccurrences: [{ start: 3, end: 7 }],
    emojiOccurrences: [{ start: 15, end: 36 }],
  } as Any;
  const header = transform.resolveAutoTitleInfo(parsedHeader, I2N_HEADER);
  assert.equal(header.origin, "header", "заголовок сильнее первых слов текста");
  assert.equal(header.title, "dfdf", "названием стал текст заголовка, а не строка целиком");

  const swapHeader = transform.resolveTitleSwap(parsedHeader, I2N_HEADER, header.title);
  assert.equal(swapHeader.titleWords, "dfdf",
    "слово, ставшее названием, снимается со строки — на его место встанет ссылка");
  assert.equal(swapHeader.explicitTitle, "", "скобок на строке не было");

  /* Название, набранное человеком в окне, слов на строке не касается: его на
     ней не было. Это вторая половина правила, и без неё запрет выполнялся бы
     и кодом, снимающим что попало (У-127). */
  assert.equal(transform.resolveTitleSwap(parsedHeader, I2N_HEADER, "имя от руки").titleWords, "",
    "имя, набранное вручную, со строки ничего не снимает");

  /* И поведение целиком — на той же строке, теми же функциями движка. */
  const SEP2 = { separator1: "::", separator2: "::" };
  assert.equal(
    transform.applySourceTextFate(parsedHeader.line, "222/dfdf", SEP2, {
      text: "leave_named", link: true, i2n: I2N_HEADER, titleWords: swapHeader.titleWords,
    }),
    "## #/1 :: [[222/dfdf]] :: \u{1F4C5}2026-09-16 20:03",
    "на месте текста заголовка стоит ссылка, остальное на строке цело");
  ok("название из заголовка снимается со строки, ссылка встаёт на его место (G2)");
}

{
  /*
   * Третье положение судьбы текста — решение заказчика по В-78, 2026-09-07.
   * Он выбрал завести его отдельно, а не менять `Leave it`: «текст остаётся,
   * но ссылку на место названия».
   *
   * Здесь же закреплена вторая половина правила, которой не было до этого дня:
   * слова названия снимаются **только там, где на их место встаёт ссылка**.
   * Без ссылки на их месте не окажется ничего, а «заменить» значит поставить
   * что-то вместо.
   */
  const line = "- [ ] || тест-трансформ4 тест1 тест2 тест3 тест4 тест5 тест6 || \u{1F4C5}2026-09-07 13:27";
  const words = "тест-трансформ4 тест1 тест2 тест3 тест4 тест5";
  const fate = (o: Any): string => transform.applySourceTextFate(
    line, "333/" + words, SEP, { i2n: I2N_WORDS, titleWords: words, ...o });

  assert.equal(fate({ text: "leave_named", link: true }),
    "- [ ] || [[333/тест-трансформ4 тест1 тест2 тест3 тест4 тест5]] тест6 || \u{1F4C5}2026-09-07 13:27",
    "`leave_named`: ссылка на месте названия, остаток текста цел и не обрезан по числу слов");

  assert.equal(fate({ text: "leave_named", link: false }), line,
    "`leave_named` без ссылки строку не трогает: ставить на место снятых слов нечего");

  /* Прежние два положения не изменились — в этом и был смысл его выбора. */
  assert.equal(fate({ text: "leave", link: true }),
    "- [ ] || тест-трансформ4 тест1 тест2 тест3 тест4 тест5 тест6 "
    + "[[333/тест-трансформ4 тест1 тест2 тест3 тест4 тест5]] || \u{1F4C5}2026-09-07 13:27",
    "`leave` по-прежнему оставляет каждое слово, включая слова названия");

  assert.equal(fate({ text: "words", keepWords: 2, link: false }),
    "- [ ] || тест-трансформ4 тест1 || \u{1F4C5}2026-09-07 13:27",
    "`words` без ссылки считает первые слова самого текста, как считал всегда");

  assert.equal(fate({ text: "words", keepWords: 2, link: true }),
    "- [ ] || [[333/тест-трансформ4 тест1 тест2 тест3 тест4 тест5]] тест6 || \u{1F4C5}2026-09-07 13:27",
    "`words` со ссылкой считает остаток");
  ok("третье положение: текст цел, кроме слов названия; без ссылки слова не снимаются");
}

{
  /* Значение читается нормализацией: незнакомое падает в умолчание, известное
     переживает круг. Иначе положение есть в панели и нет в движке. */
  for (const value of ["leave", "remove", "words", "leave_named"]) {
    assert.equal(
      transform.normalizeInline2Note({ sourceProcessing: { text: value } }).sourceProcessing.text,
      value, "положение «" + value + "» переживает нормализацию");
  }
  assert.equal(
    transform.normalizeInline2Note({ sourceProcessing: { text: "не-положение" } }).sourceProcessing.text,
    "remove", "незнакомое значение падает в умолчание");
  ok("четыре положения судьбы текста доезжают до движка");
}

/* ---- 7: строка, у которой уборка снесла левый сегмент ------------------- */

/**
 * Замечание заказчика по T4, 2026-09-07 вечер (дефект A39).
 *
 * Уборка Values снимает весь левый сегмент, и пустой слот схлопывается: на
 * строке остаётся **один** Separator, и он второй. Дальше три шага разбирали
 * строку заново — и читали её наоборот: текст как левый сегмент, правую часть
 * как текст.
 *
 * Буквами такую строку не разобрать: `text :: right` и `left :: text`
 * различаются только тем, какой Separator уцелел, а у заказчика оба `::`.
 * Поэтому знание едет с ней от того, кто её схлопнул. Здесь закреплены обе
 * стороны: и что `planSourceCleanup` про это говорит, и что разбор без этого
 * знания читает ту же строку иначе.
 */
{
  const cleaned = "\u002d ывыв ывы :: \u{1F4C5}2026-09-07 18:56";
  const both = { separator1: "::", separator2: "::" };

  const blind = transform.splitSourcePayload(cleaned, both);
  assert.equal(blind.kind, "left-only",
    "без знания о слотах разбор читает единственный Separator как первый");
  assert.equal(blind.payload, "\u{1F4C5}2026-09-07 18:56",
    "и тогда текстом строки оказывается дата — вот что заказчик и увидел");

  const knowing = transform.splitSourcePayload(cleaned, both, { payloadFirst: true });
  assert.equal(knowing.kind, "payload-right", "со знанием разбор другой");
  assert.equal(knowing.prefix, "- ", "маркер списка остался префиксом, а не текстом");
  assert.equal(knowing.payload, "ывыв ывы", "текст — это текст");
  assert.equal(knowing.right, "\u{1F4C5}2026-09-07 18:56", "правая часть — правая часть");
  ok("один Separator на строке — два устройства, и различает их только знание о слотах");
}

{
  /*
   * Само знание не выдумывается на месте: его отдаёт та же функция, что и
   * схлопывает слот. Проверка спрашивает у неё, а не повторяет её правило
   * (У-4).
   */
  const line = "- [ ] #/1 #todo || text || \u{1F4C5}2026-08-31";
  const ctx = {
    matches: [
      { fieldId: "importance", span: { start: 6, end: 9 } },
      { fieldId: "status", span: { start: 10, end: 15 } },
    ],
  } as Any;

  const swept = transform.planSourceCleanup(line, ctx, [], SEP);
  assert.equal(swept.line, "text || \u{1F4C5}2026-08-31",
    "левый сегмент ушёл целиком, пустой слот схлопнулся");
  assert.equal(swept.payloadFirst, true, "и функция говорит, что текст теперь до Separator");

  const keptOne = transform.planSourceCleanup(line, ctx, ["importance"], SEP);
  assert.equal(keptOne.payloadFirst, false,
    "остался хоть один Value — слот на месте, и устройство строки прежнее");

  const tailless = { matches: [{ fieldId: "status", span: { start: 6, end: 11 } }] } as Any;
  const noRight = transform.planSourceCleanup("- [ ] #todo || text ||", tailless, [], SEP);
  assert.equal(noRight.payloadFirst, false,
    "правой части нет — Separator на строке не остаётся вовсе, и знание ни при чём");
  ok("`planSourceCleanup` отдаёт устройство строки, а не только строку");
}

{
  /* Метка `#processed` в правой панели: правая часть человека — не текст, и
     второй Separator метке не нужен. */
  const cleaned = "\u002d ывыв ывы :: \u{1F4C5}2026-09-07 18:56";
  const both = { separator1: "::", separator2: "::" };
  assert.equal(
    transform.insertProcessedToken(cleaned, "#processed", "right", both, { payloadFirst: true }),
    "\u002d ывыв ывы :: \u{1F4C5}2026-09-07 18:56 #processed",
    "метка встала в конец правой части");
  assert.equal(
    transform.insertProcessedToken(cleaned, "#processed", "left", both, { payloadFirst: true }),
    "\u002d #processed :: ывыв ывы :: \u{1F4C5}2026-09-07 18:56",
    "в левой панели метка заводит слот заново: она и есть его содержимое");
  ok("метка знает, где правая часть, и не заводит ей второй Separator");
}

console.log("\n" + passed + " проверок пройдено");
