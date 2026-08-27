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
      { id: "Project", orderKey: "Project", source: "wikilinks:Project", values: [] },
      { id: "date_due", orderKey: "date_due", kind: "genericElement", marker: "@", values: [] },
    ],
  },
};

const order = (left: string[], right: string[]): Any => ({
  left, right, labels: {}, strictNames: {}, lead: {}, freeRoam: {},
  types: { Importance: "tag", Project: "wikilink", date_due: "element" },
  active: { Importance: "yes", Project: "yes", date_due: "yes" },
  enabled: { Importance: true, Project: true, date_due: true },
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

const timeHm = String(helpers.getDateValuePatterns()?.timeHm || "\\d{2}:\\d{2}");

function relocateElements(line: string, orderCfg: Any): string {
  return pipeline.relocateMarkerSetByFieldOrder({
    line,
    rules,
    fields: rules.leftMode.fields.concat(rules.rightMode.fields),
    getOrderKey: (f: Any) => String(f && f.orderKey || f && f.id || "").trim(),
    getPanelForKey: (key: string) => helpers.resolvePanelForField(orderCfg, key, { defaultPanel: "right" }),
    getValueRx: (f: Any) => {
      const kind = String(f && f.kind || "");
      if (kind !== "dateOffset" && kind !== "nowTime" && kind !== "estimatedCycle" && kind !== "genericElement") return "";
      return (kind === "nowTime" || kind === "estimatedCycle") ? timeHm : ("[^\\s]+" + "(?:\\s+" + timeHm + ")?");
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

console.log("\n" + passed + " проверок пройдено");
