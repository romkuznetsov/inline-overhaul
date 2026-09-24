/**
 * Left Block и Right Block: попадает ли токен туда, куда его поставил человек
 * (находка Н-3 из проверки в vault, 2026-08-28).
 *
 * Что выяснил разбор. «Ссылки и элементы уходят вправо» — жалоба про строку, а
 * не про панель: и панель, и конфиг честны, ключ Field остаётся в том Block,
 * куда его перетащили, и переживает `migrateConfig`. Расходится конфиг с
 * движком, и расходится **только у ссылок**:
 *
 *   элементы — `relocateDateLikeByOrder` берёт Block из Order и кладёт токен
 *              туда; работало и до правки, здесь это закреплено;
 *   ссылки   — `collectSelectedRightEntries` ставила `panel: 'right'`
 *              литералом, и Block не читался вовсе.
 *
 * Инструмент перекладывания у обеих половин один и тот же и живёт в
 * `src/core/line_pipeline.js`. Здесь зовутся именно настоящие функции: сам
 * `tagwheel.js` вне Obsidian не запускается — он просит редактор, — поэтому
 * его вызов закреплён отдельно, по исходнику, в `bootstrap_loader_tests.js`.
 * Это названное ограничение, а не умолчание.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = createRequire(import.meta.url);

const pipeline = requireCjs(path.join(root, "src", "core", "line_pipeline.js")) as Any;
const helpers = requireCjs(path.join(root, "src", "core", "pkm_rules_runtime_helpers.js")) as Any;
const macroShared = requireCjs(path.join(root, "src", "core", "pkm_macro_shared.js")) as Any;

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok " + what); };

/* Форма снята с настоящего конфига в тестовом vault: оба разделителя `||`. */
const rules: Any = {
  io: { separator1: "||", separator2: "||" },
  behavior: { defaultMode: "left" },
  leftMode: { fields: [{ id: "Importance", orderKey: "Importance", prefix: "#", values: [] }] },
  rightMode: {
    fields: [
      /*
       * **Значение ссылки объявлено, и с 2026-09-18 это обязательно** (В-141).
       * Прежде список был пуст, а `[[test1]]` числился значением поля **по
       * форме** — то есть фикстура опиралась ровно на то правило, которое он
       * велел снять: ссылка считается значением поля только тогда, когда она
       * значением названа. Пустой список делал проверку слепой к разнице между
       * его значением и ссылкой, которую поставил `Inline to note` (У-147).
       */
      { id: "Project", orderKey: "Project", source: "wikilinks:Project",
        values: [{ id: "test1", token: "test1", active: true }] },
      { id: "date_due", orderKey: "date_due", kind: "genericElement", marker: "@", values: [] },
      /* Поле, у которого значение занимает два слова: до 2026-09-12 перенос
         брал у него только первое (PRD 10.13.71). */
      { id: "when", orderKey: "when", kind: "dateOffset", marker: "📅", values: [] },
    ],
  },
};

/* Формат живёт там же, откуда его берёт движок, — в ветке рантайма. */
rules.behavior.dateRuntimeConfig = {
  fields: ["when"],
  byField: { when: { emoji: "📅", format: "YYYY-MM-DD hh:mm" } },
};

const order = (left: string[], right: string[]): Any => ({
  left, right, labels: {}, strictNames: {}, lead: {}, freeRoam: {},
  types: { Importance: "tag", Project: "wikilink", date_due: "element", when: "element" },
  active: { Importance: "yes", Project: "yes", date_due: "yes", when: "yes" },
  enabled: { Importance: true, Project: true, date_due: true, when: true },
});

/** Сегменты строки по настоящему разбору: что слева от текста, что справа. */
function segments(line: string): { left: string; text: string; dates: string } {
  const seg = pipeline.splitSegments(line, rules);
  return {
    left: String(seg.left || "").trim(),
    text: String(seg.text || "").trim(),
    dates: String(seg.dates || "").trim(),
  };
}

/* ======================================================================
 * Элементы: Block читается, и это работало до Н-3.
 * ====================================================================== */

/* Образец значения берётся у продукта — из формата поля, — а не пишется
   здесь заново: своя копия догадки проверяла бы саму себя (У-4). */
const tailByMarker: Any = helpers.getDateMarkersFromRules(rules).tailByMarker || {};

function relocateElements(line: string, orderCfg: Any): string {
  return pipeline.relocateMarkerSetByFieldOrder({
    line,
    rules,
    fields: rules.leftMode.fields.concat(rules.rightMode.fields),
    getOrderKey: (f: Any) => String(f && f.orderKey || f && f.id || "").trim(),
    getPanelForKey: (key: string) => helpers.resolvePanelForField(orderCfg, key, { defaultPanel: "right" }),
    getValueRx: (f: Any) => {
      const kind = String(f && f.kind || "");
      if (kind !== "dateOffset" && kind !== "nowTime" && kind !== "estimatedCycle" && kind !== "genericElement") return null;
      return String(tailByMarker[String(f && f.marker || "").trim()] || "");
    },
    removeMarkerTokens: (segLine: string, mk: string, rx: string) => helpers.removeMarkerTokensFromSegment(segLine, mk, rx),
    takeFirstToken: (segLine: string, mk: string, rx: string) => macroShared.firstTokenByPattern(segLine, mk, rx),
  });
}

{
  const line = "#/1 || купить молоко || @30.08";
  const out = segments(relocateElements(line, order(["Importance", "date_due"], [])));
  assert.match(out.left, /@30\.08/, "элемент в Left Block встал слева от текста");
  assert.doesNotMatch(out.dates, /@30\.08/, "и справа его не осталось");
  ok("элемент: Left Block уводит токен влево");
}

{
  const line = "#/1 @30.08 || купить молоко";
  const out = segments(relocateElements(line, order(["Importance"], ["date_due"])));
  assert.match(out.dates, /@30\.08/, "элемент в Right Block встал справа");
  assert.doesNotMatch(out.left, /@30\.08/, "и слева его не осталось");
  ok("элемент: Right Block уводит токен вправо");
}

/*
 * Значение из двух слов переносится целиком.
 *
 * **Куплено мутацией, а не чтением.** Сторож ряда в движке дат остаётся
 * зелёным, когда «взять первый токен» снова режет по первому пробелу: до
 * этого места тот путь не доходит. А у человека доходит — этим переносом
 * работает TagWheel.
 */
{
  const line = "#/1 || купить молоко || 📅2026-09-11 21:32";
  const out = segments(relocateElements(line, order(["Importance", "when"], [])));
  assert.match(out.left, /📅2026-09-11 21:32/, "значение из двух слов уехало влево целиком");
  assert.doesNotMatch(out.dates, /21:32/, "и второй половины справа не осталось");
  assert.match(out.text, /купить молоко/, "текст человека на месте");
  ok("элемент из двух слов: Left Block уводит значение целиком");
}

/*
 * И сосед по блоку переносом не задет: значение кончается там, где кончается,
 * а не «до конца блока».
 */
{
  const line = "📅2026-09-11 21:32 #/1 || купить молоко";
  const out = segments(relocateElements(line, order(["Importance"], ["when"])));
  assert.match(out.dates, /📅2026-09-11 21:32/, "значение из двух слов уехало вправо целиком");
  assert.match(out.left, /#\/1/, "сосед по блоку остался слева");
  assert.doesNotMatch(out.left, /21:32/, "и половины значения слева не осталось");
  ok("элемент из двух слов: сосед по блоку переносом не съеден");
}

/* ======================================================================
 * Ссылки: тот же инструмент умеет то же самое.
 *
 * Проверяется именно инструмент. Дефект Н-3 был в том, что `tagwheel.js`
 * звал его с литералом `'right'` вместо посчитанной панели, — а сам
 * инструмент работал всегда.
 * ====================================================================== */

function relocateLink(line: string, targetPanel: "left" | "right"): string {
  return pipeline.relocateTokenSetByPanel({
    line,
    rules,
    targetPanel,
    selectedToken: "[[test1]]",
    allTokens: ["[[test1]]", "[[test2]]"],
    rightToText: false,
    stripTokens: (seg: string, list: string[]) => macroShared.removeTokensFromSegment(seg, list),
  });
}

{
  const out = segments(relocateLink("#/1 || купить молоко || [[test1]]", "left"));
  assert.match(out.left, /\[\[test1\]\]/, "ссылка встала слева от текста");
  assert.doesNotMatch(out.dates, /\[\[test1\]\]/, "и справа её не осталось");
  ok("ссылка: инструмент умеет поставить токен в Left Block");
}

{
  const out = segments(relocateLink("#/1 [[test1]] || купить молоко", "right"));
  assert.match(out.dates, /\[\[test1\]\]/, "ссылка встала справа");
  assert.doesNotMatch(out.left, /\[\[test1\]\]/, "и слева её не осталось");
  ok("ссылка: и обратно в Right Block");
}

{
  /* Панель, которую движок обязан посчитать вместо литерала `'right'`. */
  assert.equal(helpers.resolvePanelForField(order(["Importance", "Project"], []), "Project", { defaultPanel: "right" }),
    "left", "ссылка в Left Block опознаётся как левая");
  assert.equal(helpers.resolvePanelForField(order(["Importance"], ["Project"]), "Project", { defaultPanel: "right" }),
    "right", "ссылка в Right Block опознаётся как правая");
  ok("ссылка: Block читается из Order той же функцией, что и у тегов");
}

/* ======================================================================
 * Выход из цикла: пустое значение обязано убрать старый токен (Н-5).
 * ====================================================================== */

{
  /*
   * Инструмент это умеет: пустой `selectedToken` значит «вычистить набор и
   * ничего не ставить». Дефект Н-5 был в том, что `tagwheel.js` вовсе не
   * заводил запись для Field с пустым значением — вычищать было некому.
   */
  const out = pipeline.relocateTokenSetByPanel({
    line: "#/1 || купить молоко || [[test1]]",
    rules,
    targetPanel: "right",
    selectedToken: "",
    allTokens: ["[[test1]]", "[[test2]]"],
    rightToText: false,
    stripTokens: (seg: string, list: string[]) => macroShared.removeTokensFromSegment(seg, list),
  });
  assert.doesNotMatch(out, /\[\[test1\]\]/, "старая ссылка убрана из строки");
  assert.match(out, /купить молоко/, "а текст на месте");
  ok("выход из цикла: пустое значение вычищает старый токен");
}

{
  /* И то же самое, когда ссылка стояла слева. */
  const out = pipeline.relocateTokenSetByPanel({
    line: "#/1 [[test1]] || купить молоко",
    rules,
    targetPanel: "left",
    selectedToken: "",
    allTokens: ["[[test1]]", "[[test2]]"],
    rightToText: false,
    stripTokens: (seg: string, list: string[]) => macroShared.removeTokensFromSegment(seg, list),
  });
  assert.doesNotMatch(out, /\[\[test1\]\]/, "ссылка убрана и из левого сегмента");
  assert.match(out, /#\/1/, "а тег на месте");
  ok("выход из цикла: то же самое для Left Block");
}

/* ======================================================================
 * Разбор строки: текст не считается левым сегментом (Н-6, Н-8).
 * ====================================================================== */

{
  /*
   * Корень обеих находок. Левый сегмент — зона токенов; когда токенов нет,
   * разбор считал левым сегментом сам текст, и дописывание в эту зону
   * склеивало токен с текстом: `- [ ] 111 [[test1]] ||  || #todo`.
   */
  const seg = segments("- [ ] 111 || #todo");
  assert.equal(seg.left, "- [ ]", "слева остался только маркер списка");
  assert.equal(seg.text, "111", "а `111` опознан текстом, а не токеном");
  ok("разбор: текст без токенов не считается левым сегментом");
}

{
  /* Когда токен слева есть, разбор прежний и трогать его нечего. */
  const seg = segments("- [ ] #/1 || 111 || #todo");
  assert.equal(seg.left, "- [ ] #/1", "левый сегмент с токеном разбирается как был");
  assert.equal(seg.text, "111", "текст на своём месте");
  ok("разбор: строка с токеном слева разбирается как прежде");
}

{
  /* Итог обеих находок на настоящем инструменте перекладывания. */
  const link = pipeline.relocateTokenSetByPanel({
    line: "- [ ] 111 || #todo",
    rules,
    targetPanel: "left",
    selectedToken: "[[test1]]",
    allTokens: ["[[test1]]"],
    rightToText: false,
    stripTokens: (seg: string, list: string[]) => macroShared.removeTokensFromSegment(seg, list),
  });
  assert.equal(link, "- [ ] [[test1]] || 111 || #todo",
    "ссылка встала слева, а текст остался текстом");
  ok("Н-6: ссылка в Left Block больше не склеивается с текстом");

  const elem = segments(relocateElements("- [ ] 111 || @30.08", order(["Importance", "date_due"], [])));
  assert.match(elem.left, /@30\.08/, "элемент встал в левый сегмент");
  assert.equal(elem.text, "111", "и текст не уехал вместе с ним");
  ok("Н-8: элемент в Left Block больше не склеивается с текстом");
}

{
  /*
   * **В-141: ссылка, которой нет ни в одном списке значений, — слово человека.**
   * Его слово 2026-09-17 про строку после `Inline to note`: «она должна
   * считаться текстом… имя преобразованной заметки и текст не должны
   * подмешиваться в left block». Такую ссылку в строку ставит сам плагин
   * **вместо** текста, и значением она не бывает ни у кого.
   *
   * Обе стороны правила стоят рядом нарочно (У-147): выше `[[test1]]` объявлен
   * значением `Project` и ведёт себя как значение, здесь `[[333/имя]]` не
   * объявлен и ведёт себя как текст. Разница между ними и есть правило.
   */
  const own = segments("- [[test1]] || #todo");
  assert.equal(own.left, "- [[test1]]", "объявленное значение — левый Block");
  assert.equal(own.text, "", "и текста на такой строке нет");

  const foreign = segments("- [[333/имя]] || #todo");
  assert.equal(foreign.left, "-", "ссылка `Inline to note` левым Block не становится");
  assert.equal(foreign.text, "[[333/имя]]", "она стоит в слоте текста — там, где её и поставили");
  assert.equal(foreign.dates, "#todo", "а правый Block читается по-прежнему");

  ok("В-141: значением считается названная ссылка, остальные — текст человека");
}

/*
 * **Разделители разведены нарочно** (У-147, правило 69). Во всех примерах выше
 * первый разделитель равен второму, и на таком примере переворот правила
 * «каким разделителем отделяется правый Block» **не виден вовсе**: подмена
 * `sep1` на `sep2` ничего не меняет. Замечание заказчика 2026-09-11 пришло
 * ровно оттуда — у него `||` и `::`, и он увидел на экране то, чего не видела
 * ни одна из 68 проверок.
 *
 * Правило: зона тегов слева есть — строка полная, `теги || текст :: правый`.
 * Зоны тегов нет — первому разделителю взяться неоткуда, и правый Block
 * отделяется **вторым**.
 */
{
  const split: Any = { ...rules, io: { separator1: "||", separator2: "::" } };

  /* Положительный контроль: на этих правилах разделители и правда различимы. */
  assert.notEqual(split.io.separator1, split.io.separator2,
    "положительный контроль: разделители в примере обязаны различаться");

  const build = (seg: Any): string => pipeline.buildFromSegments(seg, split);

  assert.equal(
    build({ indent: "", left: "- [ ] 1244", text: "", dates: "\u{1F4C5}2026-09-11" }),
    "- [ ] 1244 :: \u{1F4C5}2026-09-11",
    "слева текст, а не теги: правый Block отделяется вторым разделителем",
  );
  assert.equal(
    build({ indent: "", left: "- [ ] #/1", text: "", dates: "\u{1F4C5}2026-09-11" }),
    /*
     * **Здесь стоял один пробел, и это было ожидание, закреплявшее дефект**
     * (У-58). Пустой слот под текст отмечается двумя пробелами — так он
     * виден человеку; при совпадающих разделителях так и было, при
     * разведённых терялся один пробел. Замечание заказчика 2026-09-11.
     */
    "- [ ] #/1 ||  :: \u{1F4C5}2026-09-11",
    "слева тег, текста нет: оба разделителя, и между ними пустой слот под текст",
  );
  assert.equal(
    build({ indent: "", left: "- [ ] 1244", text: "текст", dates: "\u{1F4C5}2026-09-11" }),
    "- [ ] 1244 текст :: \u{1F4C5}2026-09-11",
    "текст с обеих сторон склеивается, и правый Block всё равно за вторым",
  );
  assert.equal(
    build({ indent: "", left: "- [ ] #/1", text: "текст", dates: "\u{1F4C5}2026-09-11" }),
    "- [ ] #/1 || текст :: \u{1F4C5}2026-09-11",
    "полная строка не изменилась",
  );
  ok("разделители разведены: правый Block отделяется вторым, когда слева текст");

  /*
   * **Пустая строка: два замечания заказчика 2026-09-11.** Оба того же
   * класса, что и первое: на совпадающих разделителях правило верно, на
   * разведённых — нет, и потому его не видела ни одна проверка (У-147).
   *
   *   - значение слева есть, текста нет: между разделителями обязан быть
   *     **пустой слот** под текст — два пробела (исключение 20, 10.13.34);
   *   - слева нет ничего, кроме знака списка: правый Block отделяется
   *     **вторым** разделителем, а не первым.
   */
  const empty = (left: string): string =>
    build({ indent: "", left, text: "", dates: "\u{1F4C5}2026-09-11" });

  assert.equal(empty("- [ ] #todo"), "- [ ] #todo ||  :: \u{1F4C5}2026-09-11",
    "значение слева есть, текста нет: оба разделителя и пустой слот между ними");
  assert.equal(empty("- [ ]"), "- [ ]  :: \u{1F4C5}2026-09-11",
    "слева только чекбокс: правый Block отделяется вторым разделителем");
  assert.equal(empty("-"), "-  :: \u{1F4C5}2026-09-11",
    "слева только знак списка: то же самое");

  /*
   * Контроль (У-147): на совпадающих разделителях обе строки выглядят
   * так же, как выглядели до правки, — значит правка не меняет поведение
   * тем, у кого разделитель один.
   */
  const sameSep: Any = { ...rules, io: { separator1: "::", separator2: "::" } };
  const emptySame = (left: string): string =>
    pipeline.buildFromSegments({ indent: "", left, text: "", dates: "\u{1F4C5}2026-09-11" }, sameSep);
  assert.equal(emptySame("- [ ] #todo"), "- [ ] #todo ::  :: \u{1F4C5}2026-09-11",
    "у кого разделитель один, строка с тегом не изменилась");
  assert.equal(emptySame("- [ ]"), "- [ ]  :: \u{1F4C5}2026-09-11",
    "и пустая строка у него не изменилась");
  ok("пустая строка: пустой слот под текст и второй разделитель у правого Block");

  /*
   * **И то же самое вторым путём** — через доводку строки
   * (`applyFinalLineInvariants`). Правило «чем разделены зоны» было
   * объявлено трижды: в сборке строки, в доводке и своим способом в
   * TagWheel. 2026-09-11 я починил одно объявление из трёх и объявил работу
   * сделанной; заказчик получил строку, собранную другим путём, и написал
   * «результат становится всё хуже». Он был прав.
   *
   * Теперь правило одно — `joinLineParts`, — и эта проверка спрашивает
   * **оба** пути на одних входах. Разойдутся снова — покраснеет здесь.
   */
  const finalize: Any = requireCjs(path.join(root, "src", "core", "pkm_line_finalize_unified.js"));
  const viaFinalize = (line: string): string => finalize.applyFinalLineInvariants({
    rawLine: line, line, rules: split, mode: "off",
  });

  assert.equal(viaFinalize("- [ ] #todo || @30.08"), "- [ ] #todo ||  :: @30.08",
    "доводка строки держит пустой слот под текст так же, как сборка");
  assert.equal(viaFinalize("- [ ] || @30.08"), "- [ ]  :: @30.08",
    "и второй разделитель у правого Block — так же, как сборка");

  /*
   * Контроль (У-88): доводка и правда что-то делает с этими строками —
   * иначе равенство выполнялось бы тем, что она вернула вход как есть.
   */
  assert.notEqual(viaFinalize("- [ ] #todo || @30.08"), "- [ ] #todo || @30.08",
    "положительный контроль: доводка строку не тронула — сверять нечего");
  ok("сборка строки и её доводка держат одно правило, а не два");

  /*
   * **Куда встаёт курсор после сборки** — замечание заказчика 2026-09-11:
   * «при активации в пустой строке value из right block курсор прыгает в
   * конец строки, а должен быть до сепаратора 2». Границы слота под текст
   * искались от **первого** разделителя, и в строке, где его нет, границ не
   * находилось вовсе. Это пятое место, где то же правило было записано
   * заново.
   */
  const macroShared: Any = requireCjs(path.join(root, "src", "core", "pkm_macro_shared.js"));
  const slotOf = (line: string): Any => macroShared.getTextSlotBounds(line, split);

  const emptySlot = slotOf("- [ ]  :: @30.08");
  assert.ok(emptySlot, "слот под текст не найден там, где первого разделителя нет");
  assert.equal(emptySlot.start, 6, "слот начинается сразу за знаком списка");
  assert.equal(emptySlot.end, 6, "и он пуст: курсор встанет перед вторым разделителем");

  const textSlot = slotOf("- [ ] 1244 :: @30.08");
  assert.ok(textSlot, "слот под текст не найден у строки с текстом");
  assert.equal(textSlot.end, "- [ ] 1244".length, "конец слота — конец написанного, а не конец строки");

  /*
   * Контроль (У-147): у кого оба разделителя одинаковы, этой ветки не
   * бывает — первый разделитель находится тем же знаком.
   */
  assert.equal(macroShared.getTextSlotBounds("- [ ]  :: @30.08", sameSep).start, 10,
    "контроль: на одинаковых разделителях слот ищется прежней веткой — за разделителем, а не перед ним");
  ok("слот под текст находится и в строке, где первого разделителя нет");

  /*
   * **Здесь стояли пять утверждений про Order в доводке строки, и они сняты
   * вместе с правкой 2026-09-12.**
   *
   * Правка отвечала на верное замечание — элемент, уведённый в левый Block,
   * уезжал вправо, — но сломала уборку: перенос вправо входит в неё, и без
   * него старое значение элемента переставало вычищаться. Заказчик прислал
   * ряд, где с каждым шагом в строке оставался хвост предыдущего значения.
   * Виновный коммит найден перебором по истории, а не чтением: до него ряд
   * чистый, после — с мусором.
   *
   * Утверждения сняты, а не переписаны под новое поведение: их предмета в
   * продукте больше нет (У-94). Вернутся они вместе с правильной правкой —
   * той, что научит движок искать старое значение там, куда Order увёл
   * элемент. Разбор — PRD 10.13.70.
   */

  /*
   * И разбор той же строки: первого разделителя в ней нет, второй есть.
   * Прежде разбор второго не искал вовсе, и `::` уезжал в левый сегмент
   * вместе с текстом — отсюда `- [ ] 1244 :: || 📅…` на экране заказчика.
   */
  const seg = pipeline.splitSegments("- [ ] 1244 :: \u{1F4C5}2026-09-11", split);
  assert.equal(seg.left, "- [ ]", "зоны тегов в строке нет — слева остался знак списка");
  assert.equal(seg.text, "1244", "а `1244` опознан текстом");
  assert.equal(seg.dates, "\u{1F4C5}2026-09-11", "правый Block отделён вторым разделителем");
  ok("разбор: строка без первого разделителя читает второй");

  /*
   * Элемент, уведённый в левый Block, признаётся значением Field — а не
   * текстом. Тогда зона тегов слева есть, и текста в строке нет вовсе: первому
   * разделителю взяться неоткуда, раз его в строке нет.
   *
   * Первая версия этого утверждения ждала, что элемент останется в левом
   * сегменте, а `📅` уедет в правый, — и была наивнее разбора: я написал
   * ожидание раньше, чем спросил, что он делает. Разбор оказался прав.
   */
  const leftElem = pipeline.splitSegments("- [ ] @30.08 :: \u{1F4C5}2026-09-11", split);
  assert.equal(leftElem.left, "- [ ] @30.08", "метка элемента слева — значение Field, а не текст");
  assert.equal(leftElem.text, "", "текста в строке нет: первого разделителя в ней не было");
  assert.equal(leftElem.dates, "\u{1F4C5}2026-09-11", "правый Block отделён вторым разделителем");
  ok("метка элемента в левом Block опознаётся как Field");

  /*
   * **И образец, где элемент объявлен ТОЛЬКО слева** (У-147). Выше он стоит в
   * правом Block, и потому утверждение прошло бы и на прежнем коде, который
   * собирал метки одной правой стороны: мутация «брать только правые» его не
   * роняла. Здесь правая сторона пуста, и метке взяться больше неоткуда.
   */
  const leftOnly: Any = {
    ...split,
    leftMode: { fields: [{ id: "date_due", orderKey: "date_due", kind: "genericElement", marker: "@", values: [] }] },
    rightMode: { fields: [] },
  };
  assert.equal(pipeline.splitSegments("- [ ] @30.08 :: текст", leftOnly).left, "- [ ] @30.08",
    "метка Field, объявленного только в левом Block, опознаётся как значение Field");
  assert.equal(pipeline.splitSegments("- [ ] 1244 :: текст", leftOnly).text, "1244",
    "контроль: то же место на тексте без метки отдаёт текст, а не токены");
  ok("метки собираются у обеих сторон Order, а не у одной правой");
}

{
  /*
   * `В-211`, его ответ «чинить в следующем цикле» (10.13.265). Одно значение
   * где угодно объявляло зоной значений всю строку без разделителей: панель
   * Left дописывала посторонний тег копией в свой Block, команда Right рвала
   * текст. Теперь значения подряд в начале — Block, дальше текст, и из текста
   * в Block уходят только значения Field.
   */
  const withValue: Any = JSON.parse(JSON.stringify(rules));
  withValue.leftMode.fields[0].values = [{ id: "high", token: "high" }];
  const split: Any = { ...withValue, io: { separator1: "||", separator2: "::" } };
  const seg = (line: string, r: Any): string[] => {
    const s = pipeline.splitSegments(line, r);
    return [String(s.left || "").trim(), String(s.text || "").trim(), String(s.dates || "").trim()];
  };
  assert.deepEqual(seg("- купить #random хлеб", withValue), ["-", "купить #random хлеб", ""],
    "посторонний тег посреди текста уехал из текста");
  assert.deepEqual(seg("- #random купить хлеб", withValue), ["- #random", "купить хлеб", ""],
    "тег в начале строки — Block, как и прежде");
  assert.deepEqual(seg("- купить #high хлеб", withValue), ["- #high", "купить хлеб", ""],
    "значение Field посреди текста — значение, а не текст");
  assert.deepEqual(seg("- #random", withValue), ["- #random", "", ""],
    "строка из одних значений разбирается как прежде");
  assert.deepEqual(seg("купить #random хлеб", withValue), ["купить #random хлеб", "", ""],
    "без знака списка развязки нет: сборка подставила бы `-`");
  assert.deepEqual(seg("- купить #random хлеб :: \u{1F4C5}2026-09-11", split),
    ["-", "купить #random хлеб", "\u{1F4C5}2026-09-11"],
    "с одним вторым разделителем тот же ответ");
  assert.deepEqual(seg("- купить #random хлеб || \u{1F4C5}2026-09-11", withValue),
    ["-", "купить #random хлеб", "\u{1F4C5}2026-09-11"],
    "одинаковые разделители: за единственным правый Block — тот же ответ");
  /* Отрицательный контроль: первый разделитель есть, слот текста пуст — эту
     строку доводит `normalizeStructuredSlots`, и разбор её не трогает. */
  assert.deepEqual(seg("- #random купить ||", withValue), ["- #random купить", "", ""],
    "строка с первым разделителем разобрана по-новому");
  ok("В-211: посторонний тег посреди текста строки без разделителей остаётся текстом");
}

console.log("\n" + passed + " проверок пройдено");
