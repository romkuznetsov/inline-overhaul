/**
 * Выбиралка знака (`В-182`, его пункты 9 и 10 от 2026-09-22).
 *
 * Что здесь настоящее: окно новой строки Binder — `renderAddForm`, тот самый,
 * что рисует Obsidian в модальном окне, и сама выбиралка. Подделан DOM
 * (`dom_stub.ts`): блок рисуется в Obsidian, нажать его иначе нечем.
 *
 * Ожидания выписаны из его слов, а не из кода: «при `→` должно быть
 * `Arrow right`», «пользователь может скорректировать его», «дефолтное
 * название всегда должно быть предложено», «он по прежнему может вписать в
 * text block что угодно». У знака Field — «выпадающий список с эмодзи».
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLOCK_TEXTS } from "../../src/ui/settings/texts_blocks.ts";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { renderAddForm } from "../../src/ui/settings/custom/binder_view.ts";
import { attachPicker, escapeScope, pickFilter, pickItems, pickName, PICK_SETS, type PickKind } from "../../src/ui/settings/custom/char_picker.ts";
import type { El, ElInput } from "../../src/ui/settings/custom/dom.ts";

setupGlobals();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

function all(node: StubNode, cls: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (n.classList.contains(cls)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}
const byLabel = (node: StubNode, label: string): StubNode | undefined =>
  all(node, "io-pick__item").concat(all(node, "io-pick__tab"))
    .find(n => String(n.getAttribute("aria-label") || "") === label);

/* `hidden` у заглушки узла не объявлен: его ставит сам блок (`dom.ts`). */
const shut = (n: StubNode): boolean => Boolean((n as unknown as { hidden?: boolean }).hidden);

function form(showTips = false): { box: StubNode; insert: StubNode; name: StubNode; panel: () => StubNode; got: () => unknown } {
  const box = makeNode("div");
  let got: unknown = null;
  renderAddForm(box as unknown as El, { add: d => { got = d; }, cancel: () => {}, showTips });
  const inputs = all(box, "io-text");
  assert.equal(inputs.length, 3, "поле поиска выбиралки не должно считаться полем окна");
  return {
    box,
    insert: inputs[0] as StubNode,
    name: inputs[1] as StubNode,
    panel: () => all(box, "io-pick")[0] as StubNode,
    got: () => got,
  };
}

/* ---- данные ------------------------------------------------------------- */

{
  const chars = new Set<string>();
  const names = new Set<string>();
  for (const kind of Object.keys(PICK_SETS) as PickKind[]) {
    assert.ok(pickItems(kind).length >= 20, "вкладка " + kind + " почти пуста");
    for (const [char, name] of pickItems(kind)) {
      assert.ok(char.trim() && name.trim(), "у знака пустое имя или сам знак");
      assert.ok(!chars.has(char), "знак дважды: " + char);
      /* Имя — ещё и имя команды: два одинаковых имени дали бы окну повтор,
         который оно тут же назвало бы ошибкой. */
      assert.ok(!names.has(name.toLowerCase()), "имя дважды: " + name);
      chars.add(char);
      names.add(name.toLowerCase());
    }
  }
  assert.equal(pickName("→"), "Arrow right", "его пример из пункта 9.4");
  assert.equal(pickName("  → "), "Arrow right", "пробелы по краям имени не меняют");
  assert.equal(pickName("abc"), "", "чужой текст имени из выбиралки не получает");
  ok("знаки и имена не повторяются, и `→` зовётся `Arrow right`");
}

{
  /*
   * Его слово 2026-09-23: эмодзи — «столько же, сколько есть в эмодзи
   * windows 11», символов — «больше популярных», и рубрики в обеих вкладках.
   * Порог — не число из генератора, а величина его слов: в панели Windows 11
   * полторы с лишним тысячи эмодзи без оттенков кожи; прежняя выбиралка несла
   * 136 и порог не прошла бы.
   */
  assert.ok(pickItems("emoji").length >= 1500, "эмодзи меньше, чем в панели Windows: " + pickItems("emoji").length);
  assert.ok(pickItems("symbols").length >= 300, "символов мало: " + pickItems("symbols").length);
  for (const kind of ["emoji", "symbols"] as PickKind[]) {
    assert.ok(PICK_SETS[kind].length >= 8, kind + ": рубрик почти нет");
    for (const g of PICK_SETS[kind]) assert.ok(g.title.trim() && g.items.length, kind + ": рубрика без имени или пустая");
  }
  const arrows = PICK_SETS.symbols.find(g => g.title === "Arrows");
  assert.ok(arrows, "в символах нет рубрики стрелок — его пример");
  for (const c of ["→", "←", "⤷", "⇄"]) assert.ok(arrows!.items.some(([x]) => x === c), "в стрелках нет " + c + " из его примера");
  /* Его замечание 2026-09-23: «в symbol встречаются эмодзи — убери». Знаки —
     с его скриншота: Obsidian рисует их цветом. Отбор делает генератор
     пробой Chromium; `©` и `♠` рисуются текстом и остаются — контроль того,
     что отбор идёт по виду, а не по свойству Emoji из Unicode. */
  const symbolSet = new Set(pickItems("symbols").map(([c]) => c));
  for (const c of "☁☂☃☄☎✉✏✂⚙⚛☯☮♻☢☣⚕⚖⚔♀♂") assert.ok(!symbolSet.has(c), "в символах цветной " + c + " с его скриншота");
  for (const c of ["©", "™", "♠", "→"]) assert.ok(symbolSet.has(c), "текстовый " + c + " выпал из символов");
  /* Флаги стран шрифт Windows рисует двумя буквами — их в выбиралке нет. */
  assert.ok(!pickItems("emoji").some(([c]) => /[\u{1F1E6}-\u{1F1FF}]/u.test(c)), "флаг страны в эмодзи");
  assert.ok(!pickItems("emoji").some(([c]) => /[\u{1F3FB}-\u{1F3FF}]/u.test(c)), "оттенок кожи в эмодзи");
  ok("эмодзи столько, сколько в панели Windows, символов вдвое больше прежнего, и у обеих вкладок рубрики");
}

{
  const found = pickFilter(["emoji", "symbols", "faces"], "emoji", "arrow").flatMap(g => g.items);
  assert.ok(found.length >= 5, "поиск по слову не нашёл стрелок");
  assert.ok(found.every(([, name]) => /arrow/i.test(name)), "поиск принёс лишнее");
  assert.ok(found.some(([c]) => c === "→"), "поиск ищет по всем вкладкам, а не по открытой");
  /* У эмодзи свои стрелки (`⬆️`), и найтись они обязаны; символы — нет. */
  const emojiOnly = pickFilter(["emoji"], "emoji", "arrow").flatMap(g => g.items);
  const symbolChars = new Set(pickItems("symbols").map(([c]) => c));
  assert.ok(emojiOnly.length > 0, "у эмодзи стрелки есть — поиск обязан их найти");
  assert.ok(!emojiOnly.some(([c]) => symbolChars.has(c)),
    "у знака Field только эмодзи — стрелки из символов туда приезжать не должны");
  assert.equal(pickFilter(["emoji"], "emoji", "").length, PICK_SETS.emoji.length, "пустой запрос — вся вкладка");
  assert.ok(pickFilter(["emoji", "symbols"], "emoji", "arrow").every(g => g.items.length && g.title),
    "в найденном рубрика без знаков или без имени");
  ok("поиск ищет по имени во всех вкладках этой выбиралки и только в них");
}

/* ---- окно Binder -------------------------------------------------------- */

{
  const f = form();
  assert.equal(shut(f.panel()), true, "выбиралка раскрыта до нажатия");
  f.insert.dispatch("focus");
  assert.equal(shut(f.panel()), false, "нажатие в поле выбиралку не раскрыло");
  assert.deepEqual(all(f.box, "io-pick__tab").map(t => t.getAttribute("aria-label")),
    ["Symbol", "Emoji", "Kaomoji"], "его имена и порядок вкладок, 2026-09-23");
  assert.equal((f.insert as unknown as { placeholder?: string }).placeholder, "Type anything or choose below",
    "в пустом поле — его слова, а не знак");
  assert.ok(all(f.box, "io-pick__head").some(h => h.textContent === "Arrows"),
    "первая вкладка — символы, и у неё рубрики");

  (byLabel(f.box, "Symbol") as StubNode).dispatch("click");
  const arrow = byLabel(f.box, "Arrow right");
  assert.ok(arrow, "во вкладке символов нет стрелки");
  arrow.dispatch("click");
  assert.equal(f.insert.value, "→", "знак не лёг в поле");
  assert.equal(f.name.value, "Arrow right", "имя команды не предложено");
  assert.equal(shut(f.panel()), true, "выбрал — выбиралка обязана свернуться");
  assert.equal(f.insert.classList.contains("io-text--needed"), false,
    "красная рамка осталась над выбранным знаком");
  const add = all(f.box, "io-btn--cta").find(n => n.getAttribute("aria-label") === "Add command") as StubNode;
  assert.equal(add.disabled, false, "с выбранным знаком `Add` обязана ожить");
  add.click();
  assert.deepEqual(f.got(), { insertText: "→", commandName: "Arrow right", description: "" },
    "окно отдало не то, что показало");
  ok("выбранный знак ложится в поле, а имя команды предлагается само");
}

{
  const f = form();
  f.insert.dispatch("focus");
  (byLabel(f.box, "Emoji") as StubNode).dispatch("click");
  (byLabel(f.box, "Fire") as StubNode).dispatch("click");
  assert.equal(f.name.value, "Fire");
  /* Второй выбор меняет и имя: предложенное им не тронуто. */
  f.insert.dispatch("focus");
  (byLabel(f.box, "Emoji") as StubNode).dispatch("click");
  (byLabel(f.box, "Rocket") as StubNode).dispatch("click");
  assert.equal(f.name.value, "Rocket", "предложенное имя не сменилось вслед за знаком");
  /* А своё имя человека окно не трогает. */
  f.name.value = "My launch";
  f.name.dispatch("input");
  f.insert.dispatch("focus");
  (byLabel(f.box, "Emoji") as StubNode).dispatch("click");
  (byLabel(f.box, "Star") as StubNode).dispatch("click");
  assert.equal(f.name.value, "My launch", "окно переписало имя, набранное человеком");
  ok("предложенное имя едет за знаком, набранное человеком — остаётся");
}

{
  const f = form();
  f.insert.value = "→";
  f.insert.dispatch("input");
  assert.equal(f.name.value, "Arrow right", "знак, набранный руками, тоже узнаётся");
  f.insert.value = "см. выше";
  f.insert.dispatch("input");
  assert.equal(f.name.value, "Insert см. выше", "для своего текста имя обязано быть предложено всё равно");
  f.insert.value = "";
  f.insert.dispatch("input");
  assert.equal(f.name.value, "", "стёр текст — стёрлось и предложенное имя");
  ok("своё можно вписать всегда, и имя предлагается и ему");
}

{
  const f = form();
  f.insert.dispatch("focus");
  const search = all(f.box, "io-pick__search")[0] as StubNode;
  search.value = "zzzz";
  search.dispatch("input");
  assert.equal(all(f.box, "io-pick__item").length, 0);
  assert.equal(all(f.box, "io-pick__empty").length, 1, "пустой поиск молчит пустотой (У-80)");
  search.value = "check";
  search.dispatch("input");
  assert.ok(all(f.box, "io-pick__item").length >= 3, "поиск по слову не нашёл галочек");
  f.insert.dispatch("focusout", { relatedTarget: null });
  assert.equal(shut(f.panel()), true, "фокус ушёл из окна, а выбиралка осталась раскрытой");
  ok("поиск отвечает и тогда, когда ответа нет, а уход фокуса сворачивает");
}

/* ---- `Escape` сворачивает выбиралку, а не окно (`В-196`) ---------------- */

{
  /*
   * Подделаны `Scope` и `app.keymap` Obsidian — в Node их нет. Подделка
   * запоминает всё, что keymap делает на самом деле (`app.js` 1.13.7): кто
   * поставлен сверху, с каким родителем, и что вернул обработчик — `false`
   * значит «клавиша погашена».
   */
  const stack: FakeScope[] = [];
  let pops = 0;
  class FakeScope {
    parent: unknown;
    keys: Array<{ key: string; fn: () => boolean | void }> = [];
    constructor(parent?: unknown) { this.parent = parent; }
    register(_mods: string[], key: string, fn: () => boolean | void): void { this.keys.push({ key, fn }); }
  }
  const app = { keymap: {
    pushScope: (s: FakeScope) => { stack.push(s); },
    popScope: (s: FakeScope) => { pops++; const i = stack.indexOf(s); if (i !== -1) stack.splice(i, 1); },
  } };
  const windowScope = { name: "окно Binder" };

  assert.equal(escapeScope(undefined, app), undefined, "нет класса `Scope` — клавиша остаётся окну");
  assert.equal(escapeScope(FakeScope, {}), undefined, "нет `keymap` — тоже");

  const box = makeNode("div");
  const drop = renderAddForm(box as unknown as El, {
    add: () => {}, cancel: () => {},
    holdKeys: escapeScope(FakeScope, app, windowScope)!,
  });
  const insert = all(box, "io-text")[0] as StubNode;
  const panelOf = () => all(box, "io-pick")[0] as StubNode;

  assert.equal(stack.length, 0, "свёрнутая выбиралка клавиш не берёт");
  insert.dispatch("focus");
  insert.dispatch("click");
  assert.equal(stack.length, 1, "раскрытие ставит одну область, и повторное нажатие вторую не ставит");
  assert.equal(stack[0]!.parent, windowScope, "остальные клавиши уходят окну: родитель — его область");
  const esc = stack[0]!.keys.find(k => k.key === "Escape");
  assert.ok(esc, "область берёт `Escape`");
  assert.equal(esc!.fn(), false, "обработчик гасит клавишу — окно её не получит");
  assert.equal(shut(panelOf()), true, "`Escape` свернул выбиралку");
  assert.equal(stack.length, 0, "и отдал клавишу окну: второй `Escape` закроет окно");

  insert.dispatch("focus");

  (byLabel(box, "Emoji") as StubNode).dispatch("click");
  (byLabel(box, "Fire") as StubNode).dispatch("click");
  assert.equal(stack.length, 0, "выбор знака тоже отдаёт клавишу");
  insert.dispatch("focus");
  insert.dispatch("focusout", { relatedTarget: null });
  assert.equal(stack.length, 0, "и уход фокуса");
  insert.dispatch("focus");
  drop();
  assert.equal(stack.length, 0, "закрытое окно с раскрытой выбиралкой не оставляет пойманный `Escape`");
  assert.equal(pops, 4, "каждое раскрытие снято ровно один раз");
  ok("`Escape` сворачивает выбиралку, второй — окно, и область не переживает окна");
}

/* ---- знак Field --------------------------------------------------------- */

{
  const row = makeNode("div");
  const input = row.createEl("input", { cls: "io-text", type: "text" }) as unknown as StubNode;
  let got = "";
  attachPicker(input as unknown as ElInput, row as unknown as El, {
    kinds: ["emoji"],
    say: n => n,
    onPick: c => { got = c; },
  });
  input.dispatch("click");
  assert.equal(all(row, "io-pick__tabs").length, 0, "у одной вкладки полосы вкладок быть не должно");
  assert.equal(all(row, "io-pick__item").length, pickItems("emoji").length, "показаны не все эмодзи");
  assert.deepEqual(all(row, "io-pick__head").map(h => h.textContent), PICK_SETS.emoji.map(g => g.title),
    "у знака Field те же рубрики эмодзи (его слово: «учти комментарии из пункта 1»)");
  assert.equal(all(row, "io-pick__item--wide").length, 0, "эмодзи из нескольких кодовых точек растянулся на четыре клетки");
  (all(row, "io-pick__item")[0] as StubNode).dispatch("click");
  assert.equal(got, pickItems("emoji")[0]![0], "выбранный знак не отдан");
  ok("у знака Field одни эмодзи, без вкладок");
}

{
  /*
   * Прототип нормативен и рисует ту же выбиралку сам (У-116): список там —
   * копия, и разойтись ей не на чем, кроме этой сверки. Слова пустого ответа
   * и поиска сверяются с каталогом того блока, что рисует знак.
   */
  const html = fs.readFileSync(path.join(root, "docs", "prototype", "settings_prototype.html"), "utf8");
  const m = /const PICK_EMOJI = (\[[\s\S]*?\n\]);/.exec(html);
  assert.ok(m, "в прототипе нет списка эмодзи — сверять не с чем");
  const proto = JSON.parse(m[1]!.replace(/,\s*\]$/, "]")) as [string, string[][]][];
  assert.ok(proto.flatMap(([, items]) => items).length > 1000, "из прототипа прочитано подозрительно мало");
  assert.deepEqual(proto, PICK_SETS.emoji.map(g => [g.title, g.items.map(([c, n]) => [c, n])]),
    "эмодзи прототипа разошлись с панелью");
  const own = BLOCK_TEXTS["field-editor"] as Record<string, string>;
  for (const name of ["PICK_SEARCH", "PICK_EMPTY"]) {
    const text = String(own[name] || "");
    assert.ok(text, "в каталоге редактора Fields нет " + name);
    /* Прототип пишет тире escape-последовательностью, как и все свои тексты. */
    assert.ok(html.includes(text.replace("—", "\\u2014")),
      "прототип говорит не то, что каталог: " + name);
  }
  ok("список эмодзи и слова выбиралки в прототипе те же, что в панели");
}

{
  /*
   * «?» у каждого поля окна — его слово 2026-09-23: «чтобы была единая логика
   * tip во всем плагине». Текст — тот же, что у колонки таблицы; выключенный
   * `Show tips` гасит их, как везде.
   */
  const on = form(true);
  assert.equal(all(on.box, "io-help").length, 3, "у трёх полей окна обязаны стоять три «?»");
  (all(on.box, "io-help")[0] as StubNode).dispatch("click");
  const own = BLOCK_TEXTS["binder-table"] as Record<string, string>;
  const deep = (n: StubNode): string => String(n.textContent || "") + n.children.map(deep).join("");
  const opened = all(on.box, "io-tip").map(deep).join(" ");
  assert.ok(opened.includes(String(own.COL_INSERTS_TIP).slice(0, 30)), "у `Inserts` раскрылась не та подсказка: " + opened);
  assert.equal(all(form(false).box, "io-help").length, 0, "`Show tips` выключен, а «?» стоят");
  ok("у полей окна Binder есть «?» с подсказками колонок таблицы");
}

console.log("\n" + passed + " passed");
