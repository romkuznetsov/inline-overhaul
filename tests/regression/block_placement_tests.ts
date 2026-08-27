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

console.log("\n" + passed + " проверок пройдено");
