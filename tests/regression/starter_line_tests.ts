/**
 * Строка на стартовом наборе Fields чистого vault (BUGHUNT 2026-09-26).
 *
 * **Зачем отдельный файл.** Прогон с чистого листа нашёл дефекты, которых не
 * было ни на его `data.json`, ни на синтетических фикстурах: у стартового
 * набора Value ссылки с пробелом (`Project A`, `Project B`), а у его конфига
 * таких нет. Фикстура здесь — не выписанный конфиг, а тот же путь, которым его
 * получает человек: `migrateConfig` пустого файла, `applyStarterSet`, снова
 * `migrateConfig` (правило 2). Команды идут через те же определения и тот же
 * рантайм, что у плагина (`tools/line_bench.js`, правило 1).
 *
 * Каждая строка таблицы — случай перечня; номер в имени — строка BUGHUNT.
 * Тот же случай стоит в `tools/obsidian_cases.js` и гоняется настоящим
 * Obsidian: там отвечает платформа, здесь — быстро и в семи шагах.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { applyStarterSet } from "../../src/core/starter_config.ts";

const require = createRequire(import.meta.url);
const bench = require("../../tools/line_bench.js");
const normalize = require("../../src/core/config_normalize.js");
const rulesShape = require("../../src/core/pkm_rules_shape.js");
const macroShared = require("../../src/core/pkm_macro_shared.js");

type Any = ReturnType<typeof JSON.parse>;

function starterConfig(): Any {
  const fresh = normalize.migrateConfig(null);
  assert.equal(applyStarterSet(fresh), true, "стартовый набор не встал — фикстура не та, что у человека");
  return normalize.migrateConfig(fresh);
}

const cfg = starterConfig();
/* Контроль фикстуры (У-147): Value с пробелом в ней есть — ради него файл и заведён. */
const projectValues = JSON.stringify(cfg.pkm.fields.links);
assert.ok(projectValues.includes("Project A"), "в стартовом наборе нет Value с пробелом");

let passed = 0;

async function cmd(id: string, line: string, want: string, ch?: number, title?: string): Promise<void> {
  const got = await bench.runCommandById(cfg, id, line, ch == null ? line.length : ch);
  assert.equal(got.line, want, (title || id) + ": " + JSON.stringify(line));
  passed++;
  console.log("  ok " + (title || id) + " — " + JSON.stringify(line) + " → " + JSON.stringify(want));
}

async function main(): Promise<void> {
  /* R1: пробел в Value-ссылке не рвёт её надвое. */
  await cmd("project-next", "- x", "- x || [[Project A]]", undefined, "F1.a Project встаёт за разделителем");
  await cmd("status-next", "- x || [[Project A]]", "- #todo || x || [[Project A]]", undefined, "F1.b правый Block со ссылкой узнаётся");
  await cmd("project-next", "- x || [[Project A]]", "- x || [[Project B]]", undefined, "F1.c круг идёт дальше");
  await cmd("priority-next", "- позвонить в банк || 📅2026-09-30 [[Project B]]", "- #low || позвонить в банк || 📅2026-09-30 [[Project B]]", 5, "F3.a текст на месте");
  await cmd("status-next", "- позвонить в банк || 📅2026-09-30 [[Project B]]", "- #todo || позвонить в банк || 📅2026-09-30 [[Project B]]", 5, "F3.b ссылка не удваивается");
  /* F15 = S14: `Clear line` чистит только опустевшую строку — задача и номер
     с текстом остаются собой. Отрицательный контроль — строка без текста. */
  const clear = JSON.parse(JSON.stringify(cfg));
  clear.pkm.behavior.cycleEndBehavior = "clear-prefix";
  const clearCfg = normalize.migrateConfig(clear);
  const viaClear = async (line: string, want: string, title: string): Promise<void> => {
    const got = await bench.runCommandById(clearCfg, "status-previous", line, line.length);
    assert.equal(got.line, want, title);
    passed++;
    console.log("  ok " + title);
  };
  await viaClear("- [ ] #todo || купить", "- [ ] купить", "F15 чекбокс остаётся, когда текст есть");
  await viaClear("1. #todo || пункт", "1. пункт", "F15 номер остаётся, когда текст есть");
  await viaClear("- [ ] #todo", "", "F15 опустевшая строка чистится");
  /* A18, его ответ `В-260`: опустевшая строка пустая, отступ и цитата остаются —
     одним правилом у команды тега, команды даты и панели. */
  for (const [line, want] of [["- #todo || ", ""], ["> #todo || ", "> "], ["> - #todo || ", "> "], ["\t- #todo || ", "\t"]] as const) {
    await viaClear(line, want, "A18 команда тега: " + JSON.stringify(line) + " → " + JSON.stringify(want));
    const tw = await bench.runTagWheel(clearCfg, "left", line, line.length, ["ArrowDown"]);
    assert.ok(tw.opened, "панель не открылась");
    assert.equal(tw.line, want, "A18 панель: " + JSON.stringify(line));
    passed++;
  }
  for (const [line, want] of [["\t- || 📅2026-10-01", "\t"], ["> - || 📅2026-10-01", "> "]] as const) {
    const got = await bench.runCommandById(clearCfg, "due-previous", line, line.length);
    assert.equal(got.line, want, "A18 команда даты: " + JSON.stringify(line));
    passed++;
  }
  console.log("  ok A18 Clear line: пусто, отступ и цитата остаются — команды и панель");
  /* K4, K5: одиночный разделитель, за которым правый Block, — второй; слот
     текста слева (так же отвечает разбор строки). Smart Enter `Text only`
     спрашивает именно его. */
  const rules = rulesShape.buildRulesForEngines(cfg);
  const slot = (l: string) => JSON.stringify(macroShared.getTextSlotBounds(l, rules));
  assert.equal(slot("- позвонить || 📅2026-09-30"), JSON.stringify({ start: 2, end: 11 }), "K4 слот текста слева от единственного разделителя");
  assert.equal(slot("- позвонить || [[Project A]]"), JSON.stringify({ start: 2, end: 11 }), "K4 то же со ссылкой с пробелом");
  assert.equal(slot("- #todo || 📅2026-09-30"), JSON.stringify({ start: 7, end: 7 }), "K4 слева значения — слот пуст");
  assert.equal(slot("- #todo || позвонить"), JSON.stringify({ start: 11, end: 20 }), "K4 отрицательный контроль: за разделителем текст");
  passed += 4;
  console.log("  ok K4 слот текста при одном разделителе");
  /* S13: Value, заведённое панелью, хранится с решёткой (`#todo`), стартовое —
     без. При `Nested` вид собирался склейкой, и выходило `##todo/kitchen`. */
  const nested = JSON.parse(JSON.stringify(cfg));
  const tagFields = nested.pkm.fields.tags.fields;
  const status = tagFields.find((f: Any) => f.id === "Status");
  status.values = status.values.map((v: Any) => ({ ...v, token: "#" + String(v.token).replace(/^#/, "") }));
  const sub = tagFields.find((f: Any) => f.id === "Status_sub");
  sub.values = [{ token: "#kitchen", allowedParentValues: ["#todo"], active: true }];
  sub.enabled = true;
  nested.pkm.fields.order.enabled.Status_sub = true;
  nested.pkm.fields.order.active.Status_sub = "yes";
  nested.pkm.behavior.childTagFormat = "combined";
  const nestedCfg = normalize.migrateConfig(nested);
  const got = await bench.runCommandById(nestedCfg, "status-sub-next", "- #todo || x", 12);
  assert.equal(got.line, "- #todo/kitchen || x", "S13: Nested с Value панели");
  passed++;
  /* Второе нажатие читает написанное (У-157): пара узнаётся, круг идёт дальше. */
  const again = await bench.runCommandById(nestedCfg, "status-sub-next", got.line, got.line.length);
  assert.equal(again.line, "- #todo || x", "S13: написанное Nested не узнаётся вторым нажатием");
  passed++;
  console.log("  ok S13 Nested: Value с решёткой не удваивает её");
  /* K2 (`В-242`): склейка строк с полями сливает поля в блоки, одинаковое поле —
     побеждает первая строка; без полей во второй — склейка обычная (null). */
  const sd = require("../../src/features/smart_delete_engine.js");
  const m = (a: string, b: string): string | null => { const r = sd.mergeLinesWithFields(a, b, rules); return r ? r.line : null; };
  assert.equal(m("- #todo || a", "- #low || b"), "- #todo #low || a b", "K2: поля второй строки не встали в блоки");
  assert.equal(m("- #todo || a", "- #done || b"), "- #todo || a b", "K2: одинаковое поле — не первая строка");
  assert.equal(m("- a", "- #low || b || 📅2026-09-30"), "- #low || a b || 📅2026-09-30", "K2: правый Block второй строки потерян");
  assert.equal(m("- #todo || a", "- b"), null, "отрицательный контроль: у второй строки полей нет");
  /* Его пункт «Новое» 2026-09-29: строка без Prefix не уезжает в Block целиком —
     значения подряд в начале Block, слово — текст, как у строки с Prefix. */
  assert.equal(m("- #todo || a", "  hello world"), null, "строка без Prefix объявлена Block: слова уехали в поля");
  assert.equal(m("- #todo || a", "  #low b"), "- #todo #low || a b", "строка без Prefix: слово уехало в Block");
  passed += 6;
  console.log("  ok K2 склейка строк с полями сливает поля в блоки");
  /* F4: план записи полосы режет строку словами, и ссылка с пробелом — одно
     слово; иначе ` B]]` прятался посреди ссылки и Obsidian рисовал хвост. */
  const plw = require("../../src/core/panel_line_write.js");
  const src = "- #todo || позвонить || 📅2026-09-30 [[Project B]]";
  const words = plw.splitWords(src);
  assert.equal(words.join(""), src, "F4 склейка слов не даёт исходную строку");
  assert.ok(words.includes(" [[Project B]]"), "F4 ссылка с пробелом разрезана: " + JSON.stringify(words));
  passed += 2;
  console.log("  ok F4 ссылка с пробелом — одно слово плана записи полосы");
  /* В-248: чекбокс из Prefix у Value-ссылки встаёт в строку, как у тега. Ключ —
     в том написании, в каком его пишет панель (`[[Project A]]`). */
  {
    const raw = JSON.parse(JSON.stringify(cfg));
    const proj = (raw.pkm.fields.links.fields as Any[]).find(f => JSON.stringify(f.values).includes("Project A"));
    assert.ok(proj, "контроль фикстуры: Field со Value `Project A` есть");
    raw.pkm.prefixRules = raw.pkm.prefixRules || {};
    raw.pkm.prefixRules.checkboxByFieldValue = { ...(raw.pkm.prefixRules.checkboxByFieldValue || {}), [proj.id]: { "[[Project A]]": "[x]" } };
    const cbCfg = normalize.migrateConfig(raw);
    const plain = await bench.runCommandById(cfg, "project-next", "- x", 3);
    assert.equal(plain.line, "- x || [[Project A]]", "контроль: без правила чекбокса нет");
    const got = await bench.runCommandById(cbCfg, "project-next", "- x", 3);
    assert.equal(got.line, "- [x] x || [[Project A]]", "В-248: чекбокс Value-ссылки не встал");
    passed++;
    console.log("  ok В-248 чекбокс из Prefix у Value-ссылки встаёт в строку");
  }
  /* F2, `В-235`: Value посреди текста — слово человека. Не читается текущим
     значением, не уезжает в Block, не копируется туда полем другого Field и
     не пропадает из фразы — ни командой, ни панелью. Стартовый набор, а не его
     конфиг: у него значения записаны так, что разбор строки их посреди текста
     не узнавал, и правка разбора на нём не видна. */
  await cmd("project-next", "- встреча по [[Project A]] вчера", "- встреча по [[Project A]] вчера || [[Project A]]", undefined, "F2.a ссылка посреди текста на месте, поле пустое");
  await cmd("status-next", "- купить #todo молоко", "- #todo || купить #todo молоко", undefined, "F2.b тег посреди текста на месте, поле пустое");
  await cmd("priority-next", "- купить #todo молоко", "- #low || купить #todo молоко", undefined, "F2.c значение другого Field из фразы в Block не копируется");
  await cmd("status-next", "- встреча по [[Project A]] вчера", "- #todo || встреча по [[Project A]] вчера", undefined, "F2.d ссылка из фразы в правый Block не дописывается");
  await cmd("status-next", "- #low || купить #todo молоко", "- #todo #low || купить #todo молоко", undefined, "F2.e тег в зоне текста за левым Block");
  await cmd("project-next", "- #todo || встреча по [[Project A]] вчера", "- #todo || встреча по [[Project A]] вчера || [[Project A]]", undefined, "F2.f ссылка в зоне текста за левым Block");
  /* Отрицательный контроль: значения, стоящие подряд в начале строки, — Block. */
  await cmd("status-next", "- #todo купить молоко", "- #doing || купить молоко", undefined, "F2 контроль: тег в начале строки — значение поля");
  await cmd("status-next", "- #todo #low купить молоко", "- #doing #low || купить молоко", undefined, "F2 контроль: значения подряд в начале — Block");
  {
    const p = await bench.runTagWheel(cfg, "left", "- купить #todo молоко", 21, ["ArrowUp"]);
    assert.ok(p.opened, "F2 панель не открылась");
    assert.equal(p.line, "- #todo || купить #todo молоко", "F2.g панель: тег посреди текста");
    const r = await bench.runTagWheel(cfg, "right", "- встреча по [[Project A]] вчера", 32, ["ArrowUp"]);
    assert.ok(r.opened, "F2 панель справа не открылась");
    assert.ok(r.line.startsWith("- встреча по [[Project A]] вчера || "), "F2.h панель справа: ссылка ушла из фразы: " + JSON.stringify(r.line));
    assert.ok(!r.line.slice(r.line.indexOf("||")).includes("[[Project A]]"), "F2.h панель справа дописала ссылку из фразы: " + JSON.stringify(r.line));
    passed += 3;
    console.log("  ok F2.g, F2.h панель не трогает значение посреди текста");
  }
  /* T5: Transform на строке без разделителей — Value посреди текста и в конце
     остаётся в имени и значением не заявляется (`В-235`, `В-249`); дата в
     конце, как прежде, в имя не идёт. */
  {
    const transform = require("../../src/features/transform_feature.js");
    const t5 = transform.parseInlineLine("- встреча по [[Project A]] и [[Другое]] вчера", cfg);
    assert.equal(t5.payloadText, "встреча по [[Project A]] и [[Другое]] вчера", "T5 Value-ссылка выпала из текста");
    assert.ok(t5.wikilinkOccurrences.every((o: Any) => o.panel === "payload"), "T5 ссылка посреди текста заявлена значением");
    assert.equal(transform.parseInlineLine("- встреча 📅 2026-09-30", cfg).payloadText, "встреча", "F9.t дата в конце вошла в имя");
    assert.equal(transform.parseInlineLine("- купить молоко #todo", cfg).payloadText, "купить молоко #todo", "В-249 тег в конце — слово человека");
    assert.equal(transform.parseInlineLine("- #todo купить молоко", cfg).payloadText, "купить молоко", "контроль: тег в начале — значение");
    passed += 5;
    console.log("  ok T5 Transform: Value посреди и в конце текста — в имени, в начале — нет");
  }
  /* `Keep typed tags in text` выключен (его заказ 2026-09-28): Value поля из
     текста переезжает в свой Block и из фразы уходит — и командой, и панелью,
     и Transform. Контроль — ключ доехал до правил движков. */
  {
    const raw = JSON.parse(JSON.stringify(cfg));
    raw.pkm.placement.typedTagsStayText = false;
    const offCfg = normalize.migrateConfig(raw);
    assert.equal(rulesShape.buildRulesForEngines(offCfg).behavior.freeRoam.typedTagsStayText, false, "ключ не доехал до правил движков");
    const off = async (id: string, line: string, want: string, title: string): Promise<void> => {
      const got = await bench.runCommandById(offCfg, id, line, line.length);
      assert.equal(got.line, want, title);
      passed++;
      console.log("  ok " + title);
    };
    await off("status-next", "- купить #todo молоко", "- #doing || купить молоко", "выкл.: тег из фразы — текущее значение, переехал в Block");
    await off("priority-next", "- купить #todo молоко", "- #todo #low || купить молоко", "выкл.: значение другого Field переехало, не скопировалось");
    await off("project-next", "- встреча по [[Project A]] вчера", "- встреча по вчера || [[Project B]]", "выкл.: ссылка из фразы — в правый Block");
    const p = await bench.runTagWheel(offCfg, "left", "- купить #todo молоко", 21, ["ArrowRight", "ArrowUp"]);
    assert.ok(p.opened, "выкл.: панель не открылась");
    assert.ok(!/купить #todo молоко/.test(p.line) && /#todo/.test(p.line), "выкл.: панель оставила тег во фразе: " + JSON.stringify(p.line));
    const transform = require("../../src/features/transform_feature.js");
    assert.equal(transform.parseInlineLine("- встреча по [[Project A]] вчера", offCfg).payloadText, "встреча по вчера", "выкл.: Transform оставил Value в имени");
    passed += 2;
    console.log("  ok выкл.: панель и Transform переносят значение из фразы");
  }
  /*
   * `В-247`: Element в режиме списка — Values со своим знаком каждое, без
   * решётки. Узнаётся списком (`makeWikilinkValueTest`), шагает как тег, стоит
   * среди тегов (`ensureBehaviorModesFromOrder`). Отрицательный контроль —
   * круг рядом с `#todo`: без правки дома Value уезжало в текст и множилось.
   */
  const VALS = ["\u{1F642}‍↕️да", "\u{1F642}‍↔️нет", "\u{1F4A1}"];
  const withList = (side: "left" | "right"): Any => {
    const c = JSON.parse(JSON.stringify(cfg));
    const order = c.pkm.fields.order;
    order[side].push("Mood");
    order.types.Mood = "element";
    order.active.Mood = "yes";
    c.pkm.fields.elements.byField.Mood = { emoji: "", format: "", increment: { mode: "list" }, list: [...VALS, " ", VALS[0] as string] };
    return normalize.migrateConfig(c);
  };
  const sep = cfg.pkm.lineFormat.separator1;
  for (const side of ["left", "right"] as const) {
    const lc = withList(side);
    assert.deepEqual(lc.pkm.fields.elements.byField.Mood.list, VALS, side + ": Values списка без пустых и повторов");
    assert.ok(lc.pkm.fields.tags.fields.some((f: Any) => f.id === "Mood"), side + ": Element-список не встал среди тегов");
    assert.ok(!lc.pkm.fields.links.fields.some((f: Any) => f.id === "Mood"), side + ": Element-список остался среди элементов");
    const start = side === "left" ? `- #todo ${sep} купить` : `- купить ${sep} 📅2026-09-30`;
    const put = (v: string): string => (side === "left" ? `- #todo ${v} ${sep} купить` : `- купить ${sep} 📅2026-09-30 ${v}`);
    let line = start;
    for (const want of [put(VALS[0]!), put(VALS[1]!), put(VALS[2]!), start]) {
      line = (await bench.runCommandById(lc, "mood-next", line, line.length)).line;
      assert.equal(line, want, side + ": круг Element-списка командой");
      passed++;
    }
    assert.equal((await bench.runCommandById(lc, "mood-previous", start, start.length)).line, put(VALS[2]!), side + ": previous с пустого — последнее Value");
    const walk: string[] = await bench.fieldWalk(lc, side, put(VALS[0]!), put(VALS[0]!).length, 12);
    const at = walk.indexOf("Mood");
    assert.ok(at >= 0, side + ": панель не дошла до Element-списка");
    const keys = Array(at).fill("ArrowRight").concat(["ArrowUp"]);
    const byPanel = await bench.runTagWheel(lc, side, put(VALS[0]!), put(VALS[0]!).length, keys);
    assert.equal(byPanel.line, put(VALS[1]!), side + ": панель шагает Element-список");
    passed += 3;
  }
  const hd = withList("left");
  const hdLine = `# ${VALS[0]} #aaa ${sep}`;
  const hdWalk: string[] = await bench.fieldWalk(hd, "left", hdLine, hdLine.length, 12);
  const hdPanel = await bench.runTagWheel(hd, "left", hdLine, hdLine.length, Array(hdWalk.indexOf("Mood")).fill("ArrowRight").concat(["ArrowUp"]));
  assert.equal(hdPanel.line.trimEnd(), `# ${VALS[1]} #aaa ${sep}`, "тег за Value списка в начале строки — тоже значение (extractOriginalTextFromRawLine)");
  passed++;
  /* Transform: Value из Block — в свойство, из фразы — в имени (`В-235`). */
  const tf = require("../../src/features/transform_feature.js");
  const yamlOf = (c: Any, l: string): string[] => tf.renderYamlBlockWithOrder([], tf.buildYamlMapFromContext(tf.buildTransformContext(tf.parseInlineLine(l, c), c), c), c);
  const hdYaml = JSON.parse(JSON.stringify(hd));
  hdYaml.pkm.fields.order.propertiesByField = { ...(hdYaml.pkm.fields.order.propertiesByField || {}), Mood: "mood" };
  const ty = normalize.migrateConfig(hdYaml);
  assert.ok(yamlOf(ty, `- ${VALS[0]} ${sep} купить`).some((r) => r === "mood: " + VALS[0]), "Transform не записал Value списка в свойство");
  assert.equal(tf.parseInlineLine(`- ${VALS[0]} ${sep} купить`, ty).payloadText, "купить", "Transform оставил Value списка из Block в имени");
  assert.equal(tf.parseInlineLine(`- купить ${VALS[2]} молоко`, ty).payloadText, `купить ${VALS[2]} молоко`, "Transform унёс Value списка из фразы");
  /* Оформление: Value списка в своём Block — значение Element, во фразе — текст. */
  const vis = require("../../src/core/editor_visuals_config.js");
  const zones = (l: string): string => vis.scanLineVisualTokens(l, sep, sep, vis.buildElementMarkersFromConfig(hd),
    vis.buildBlockKindsFromConfig(hd), vis.buildWikilinkValueTestFromConfig(hd), vis.buildLineSplitFromConfig(hd))
    .map((h: Any) => h.token + ":" + h.kind + ":" + h.zone).join(" ");
  assert.equal(zones(`- ${VALS[0]} ${sep} купить`), `${VALS[0]}:element:left`, "оформление не узнало Value списка в Block");
  assert.equal(zones(`- купить ${VALS[2]} молоко`), `${VALS[2]}:element:middle`, "Value списка во фразе оформлено как Block");
  passed += 5;
  console.log("  ok В-247 Element-список: команда, панель, Transform и оформление");
  /*
   * Тег в правом Block, набранный посреди фразы, панель не стирает (`В-235`,
   * `relocateOffEntriesToRightPanel`). У его конфига и стартового набора тегов
   * справа нет — обход этого не видел.
   */
  const tr = JSON.parse(JSON.stringify(cfg));
  tr.pkm.fields.order.left = tr.pkm.fields.order.left.filter((k: string) => k !== "Status");
  tr.pkm.fields.order.right.push("Status");
  const trCfg = normalize.migrateConfig(tr);
  const phrase = "- купить #todo молоко";
  const trWalk: string[] = await bench.fieldWalk(trCfg, "right", phrase, phrase.length, 12);
  assert.ok(trWalk.indexOf("Status") >= 0, "панель справа не дошла до Status");
  const trPanel = await bench.runTagWheel(trCfg, "right", phrase, phrase.length, Array(trWalk.indexOf("Status")).fill("ArrowRight").concat(["ArrowUp"]));
  assert.ok(/купить #todo молоко/.test(trPanel.line), "панель стёрла тег из фразы у поля правого Block: " + JSON.stringify(trPanel.line));
  passed++;
  console.log("  ok тег правого Block посреди фразы — слово человека и у панели");
  /*
   * `Insert only` (BUGHUNT 2026-09-30, E1, E2): цитата и чекбокс человека
   * остаются, меняется только тег — командой и панелью, при обоих положениях
   * `use Field Prefix`. Контроль — ключи доехали до правил движков.
   */
  for (const usePrefix of [true, false]) {
    const io = JSON.parse(JSON.stringify(cfg));
    io.pkm.fields.order.freeRoam.Priority = "minimal";
    io.pkm.placement.fieldPrefixInsertOnly = usePrefix;
    const ioCfg = normalize.migrateConfig(io);
    assert.equal(rulesShape.buildRulesForEngines(ioCfg).behavior.freeRoam.minimalPrefix, usePrefix, "use Field Prefix не доехал до правил движков");
    const tag = usePrefix ? "с Prefix" : "без Prefix";
    const walk: string[] = await bench.fieldWalk(ioCfg, "left", "- x", 3, 12);
    assert.ok(walk.indexOf("Priority") >= 0, "панель не дошла до Priority");
    const keys = Array(walk.indexOf("Priority")).fill("ArrowRight").concat(["ArrowDown"]);
    for (const [line, want, name] of [
      ["> позвонить", "> #low || позвонить", "E1 цитата"],
      ["- [ ] позвонить", "- [ ] #low || позвонить", "E2 чекбокс"],
    ] as const) {
      const byCmd = await bench.runCommandById(ioCfg, "priority-next", line, line.length);
      assert.equal(byCmd.line, want, "Insert only " + tag + ", команда, " + name);
      const byPanel = await bench.runTagWheel(ioCfg, "left", line, line.length, keys);
      /* Панель шагает в свою сторону круга: спрашивается начало строки, а не какое Value. */
      assert.ok(byPanel.opened, "панель не открылась");
      assert.equal(String(byPanel.line).replace(/#(?:high|med|low)\b/, "#low"), want, "Insert only " + tag + ", панель, " + name + ": " + byPanel.line);
      passed += 2;
    }
    console.log("  ok Insert only " + tag + ": цитата и чекбокс остаются — командой и панелью");
  }
  /* C13 перечня 2026-09-30: предпросмотр `Source line` и команда — одна
     дорога (`composeSourceRoot`); чекбокс человека предпросмотр не снимает (`В-239`). */
  {
    const transform = require("../../src/features/transform_feature.js");
    const preview = transform.buildSourcePreviewLine(cfg.transform.inline2note, cfg);
    assert.ok(/^- \[ \] /.test(preview.before), "строка предпросмотра без чекбокса — проверять нечего: " + preview.before);
    assert.equal(preview.after, "- [ ] [[Preview]] || #processed", "предпросмотр After снял чекбокс: " + preview.after);
    passed++;
    console.log("  ok C13 предпросмотр Source line оставляет чекбокс, как команда");
  }
  console.log(passed + " проверок");
}

main().catch((e) => { console.error(e); process.exit(1); });
