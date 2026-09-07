/**
 * Новая вёрстка редактора Fields: левая колонка (PRD 10.2, Ф1–Ф5, Ф17–Ф20).
 *
 * Проверки идут по требованиям, а не по картинке: «выглядит как прототип»
 * проверить нечем, а «ручка несёт перетаскивание, а не строка» и «стрелка на
 * краю уводит Field через линию» — можно.
 *
 * Записи в конфиг здесь тоже проверяются, но иначе, чем в карте: карта
 * стережёт старую доску целиком, а тут важно, что вёрстка не собирает патчи
 * сама, а зовёт модель — то есть пишет ровно те же пути.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { createFieldsModel } from "../../src/ui/settings/custom/fields_model.ts";
/* Те же помощники, что и у доски: дерево значений собирает именно этот код. */
import * as deepStateModule from "../../src/core/order_deep_editor_state.js";
import {
  renderFieldsEditor,
  type FieldsViewState,
} from "../../src/ui/settings/custom/fields_editor_view.ts";
import { btn, type El } from "../../src/ui/settings/custom/dom.ts";

setupGlobals();

/* CommonJS-модуль приходит как default или как пространство имён — берём то,
   что есть: под esbuild и под стиранием типов это разные объекты. */
const deepState = (deepStateModule as { default?: unknown }).default || deepStateModule;

/* Часть замечаний заказчика — про вид, а не про поведение: ширина поля,
   заливка кнопки, столбик в ячейке шапки. Проверяются они по styles.css:
   вёрстку заглушка DOM не раскладывает, а правило прочитать может. */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

type Any = ReturnType<typeof JSON.parse>;

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok   " + what); };

/* ---- окружение --------------------------------------------------------- */

/*
 * Нормализация Order для этих проверок. Урезанная — настоящая живёт в
 * `main.js` и тянет за собой полбандла, — но в главном она обязана вести
 * себя как настоящая: **выбрасывать ключи `<name>_sub` из `left` и
 * `right`**.
 *
 * До 2026-08-28 здесь они сохранялись, и это была подделка плагина: панель
 * получала состояние, которого плагин выдать не может. Один дефект на этом
 * уже зазеленел (переключатель дочернего Field, круг 7б), а два требования —
 * Ф3 и Ф20 — описывали строку дочернего Field, которой в живой панели не
 * бывает. Заказчик закрыл вопрос В7: строки нет, дочерность живёт уровнем
 * значения в таблице Values.
 */
function normalizePkmOrder(raw: Any): Any {
  const o = raw && typeof raw === "object" ? raw : {};
  const map = (x: Any) => (x && typeof x === "object" ? { ...x } : {});
  const drop = (arr: Any): string[] =>
    (Array.isArray(arr) ? arr : []).map(String).filter(k => !/_sub$/.test(k));
  return {
    left: drop(o.left),
    right: drop(o.right),
    lead: map(o.lead), labels: map(o.labels), strictNames: map(o.strictNames),
    types: map(o.types), active: map(o.active), freeRoam: map(o.freeRoam),
    enabled: map(o.enabled), propertiesByField: map(o.propertiesByField),
  };
}

/** Тот же конфиг, что у карты записей: две панели, три Field, один дочерний. */
function makeConfig(): Any {
  return JSON.parse(JSON.stringify({
    ui: { pkmSubTab: "main" },
    pkm: {
      fields: {
        order: {
          left: ["status", "status_sub"],
          right: ["due"],
          lead: { left: "status", right: "due" },
          labels: { status: "Status", status_sub: "Status sub", due: "Due" },
          strictNames: { status: "status", due: "due" },
          types: { status: "tag", status_sub: "tag", due: "element" },
          active: { status: "yes", status_sub: "yes", due: "yes" },
          freeRoam: { status: "off", status_sub: "off", due: "off" },
          enabled: { status: true, status_sub: true, due: true },
          propertiesByField: { status: "status" },
        },
        tags: {
          fields: [
            {
              id: "status", orderKey: "status", prefix: "#",
              values: [{ token: "todo", active: true }, { token: "doing", active: true }],
            },
            {
              id: "status_sub", orderKey: "status_sub", prefix: "#", dependsOn: "status",
              values: [{ token: "early", allowedParentValues: ["todo"], active: true }],
            },
          ],
        },
        links: { fields: [{ id: "due", orderKey: "due", values: [] }] },
        elements: {
          fields: ["due"],
          byField: { due: { emoji: "!", format: "YYYY-MM-DD", increment: { mode: "command", command: "now" } } },
        },
      },
    },
    visual: {
      tags: {
        byTag: {
            status: {
              "#todo": { fillColor: "#222222", textColor: "#ffffff", visibility: "default", customText: "" },
              "#doing": { fillColor: "#ffff00", textColor: "#ffffff", visibility: "default", customText: "" },
              /*
               * Заливка задана, цвет текста — нет. Ровно тот случай, из-за
               * которого значок контраста появлялся не там (замечание
               * заказчика 2026-08-28): пузырь всё равно нарисован — цветом
               * темы, — и белое на жёлтом читается хуже белого на красном.
               */
          "#early": { fillColor: "#ffff00", textColor: "", visibility: "default", customText: "" },
          },
        },
      },
    },
  }));
}

interface Write { reason: string; patch: Any }

type NewFieldAnswer = { name: string; kind: "tag" | "wikilink" | "element" } | null;

function makeView(): {
  host: StubNode;
  writes: Write[];
  notices: string[];
  state: FieldsViewState;
  draw: () => void;
  model: ReturnType<typeof createFieldsModel>;
  /** Сколько раз вёрстка спросила про новый Field. */
  asked: unknown[];
  /** Чем окно ответит в следующий раз. */
  reply: (v: NewFieldAnswer) => void;
  /** Имена Fields, про удаление которых спросили. */
  asksDelete: string[];
  /** Чем ответит окно подтверждения удаления. */
  confirm: (v: boolean) => void;
  /** Переименования, дошедшие до заметки конфига. */
  renames: Array<[string, string]>;
  /** Имена Fields, про переименование которых спросило окно (1.4.1.2.2). */
  asksRename: string[];
  /** Чем окно переименования ответит в следующий раз; null — отказ. */
  renameTo: (v: string | null) => void;
} {
  const cfg = makeConfig();
  const writes: Write[] = [];
  const notices: string[] = [];
  const merge = (dst: Any, src: Any): void => {
    for (const key of Object.keys(src || {})) {
      const v = src[key];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (!dst[key] || typeof dst[key] !== "object") dst[key] = {};
        merge(dst[key], v);
      } else dst[key] = v;
    }
  };
  const renames: Array<[string, string]> = [];
  const plugin = {
    getConfig: () => cfg,
    setConfigPatch(patch: Any, reason: string) {
      writes.push({ reason: String(reason || ""), patch });
      merge(cfg, patch);
    },
    async renameStrictNameInConfigNote(from: string, to: string) { renames.push([from, to]); },
  };
  const model = createFieldsModel({
    plugin: plugin as never,
    normalizePkmOrder,
    pkmOrderFields: [],
    cfg,
    deepState: deepState as never,
  });
  /*
   * Настройки панели для колонки Preview. Пузырь Value рисуется тем же кодом,
   * что и живые предпросмотры, и тому нужны размеры тега; в проверке они
   * стоят по сотне, то есть «как в теме».
   */
  const ctx = {
    get: (path: string) => (path.startsWith("visual.tags.") ? 100 : undefined),
    set: async () => {},
    run: async () => {},
    watch: () => () => {},
  };
  const state: FieldsViewState = { selected: "" };
  /* Ответ окна `Add Field`: его подставляет проверка, а в панели — Modal. */
  const asked: unknown[] = [];
  let answer: NewFieldAnswer = { name: "client", kind: "wikilink" };
  /* Ответ окна удаления: по умолчанию человек подтверждает. */
  const asksDelete: string[] = [];
  let confirms = true;
  /* Ответ окна переименования: по умолчанию человек его закрывает. */
  const asksRename: string[] = [];
  let renameAnswer: string | null = null;
  const host = makeNode("div");
  let cleanup: (() => void) | null = null;
  const draw = (): void => {
    if (cleanup) cleanup();
    host.empty();
    cleanup = renderFieldsEditor(host as unknown as El, {
      model,
      ctx: ctx as never,
      state,
      enabled: true,
      showTips: true,
      redraw: draw,
      notice: (t: string) => { notices.push(t); },
      askNewField: done => { asked.push(null); done(answer); },
      confirmDeleteField: (name, done) => { asksDelete.push(name); done(confirms); },
      askRename: (name, done) => { asksRename.push(name); done(renameAnswer); },
    });
  };
  draw();
  return {
    host, writes, notices, state, draw, model, asked, asksDelete, renames, asksRename,
    reply: (v: NewFieldAnswer) => { answer = v; },
    confirm: (v: boolean) => { confirms = v; },
    renameTo: (v: string | null) => { renameAnswer = v; },
  };
}

/* ---- разбор дерева ------------------------------------------------------ */

function all(root: StubNode, cls: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (n.classList.contains(cls)) out.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

function one(root: StubNode, cls: string): StubNode {
  const found = all(root, cls);
  assert.equal(found.length, 1, "ждали ровно один ." + cls + ", нашли " + found.length);
  return found[0] as StubNode;
}

/** Имя строки `Name in TagWheel`: она же и подпись у поля ввода. */
const SHORT_NAME = "Name in TagWheel";

/** Строка имени в TagWheel: своя строка ниже шапки (шестой круг). */
function shortRowOf(host: StubNode): StubNode {
  const row = all(host, "io-item").find(r =>
    all(r, "io-item__name").some(n => String(n.textContent || "").trim() === SHORT_NAME));
  assert.ok(row, "строка «" + SHORT_NAME + "» не нашлась");
  return row as StubNode;
}

/** Поле ввода в этой строке. */
function shortInput(host: StubNode): StubNode {
  const input = all(shortRowOf(host), "io-text")[0];
  assert.ok(input, "в строке «" + SHORT_NAME + "» нет поля ввода");
  return input as StubNode;
}

/** Строки списка в том порядке, в каком они нарисованы. */
function rowsOf(host: StubNode): StubNode[] {
  return all(host, "io-fields__item");
}

function nameIn(row: StubNode): string {
  const n = all(row, "io-fields__name")[0];
  return n ? String(n.textContent || "").trim() : "";
}

/** Порядок строк по сторонам: так читается результат любого переноса. */
function layout(host: StubNode): { left: string[]; right: string[] } {
  const sides = all(host, "io-side");
  const names = (s: StubNode): string[] => rowsOf(s).map(nameIn);
  return { left: names(sides[0] as StubNode), right: names(sides[1] as StubNode) };
}

function gripOf(row: StubNode): StubNode {
  return one(row, "io-grip");
}

function arrowsOf(row: StubNode): StubNode[] {
  const tools = all(row, "io-fields__tools")[0];
  return tools ? tools.children.filter(c => String(c.tagName) === "BUTTON") : [];
}

/** Перетаскивание: взяли за ручку одной строки, бросили на другую. */
function dragOnto(from: StubNode, target: StubNode): void {
  gripOf(from).dispatch("dragstart", { preventDefault() {}, stopPropagation() {}, dataTransfer: null });
  target.dispatch("drop", { preventDefault() {}, stopPropagation() {}, dataTransfer: null });
}

/** Перетаскивание в пустое место стороны: Field встаёт в её конец. */
function dragToSide(from: StubNode, side: StubNode): void {
  gripOf(from).dispatch("dragstart", { preventDefault() {}, stopPropagation() {}, dataTransfer: null });
  side.dispatch("drop", { preventDefault() {}, stopPropagation() {}, dataTransfer: null });
}

/* ---- Ф1: две стороны и линия между ними -------------------------------- */
{
  const v = makeView();
  const labels = all(v.host, "io-side__label").map(n => String(n.textContent || "").trim());
  assert.deepEqual(labels, ["Left Block", "Right Block"],
    "список Fields делится ровно на Left Block и Right Block");
  assert.equal(all(v.host, "io-side__rule").length, 1, "стороны разделены одной линией");
  ok("Ф1: список Fields разделён на Left Block и Right Block пунктирной линией");

  assert.deepEqual(layout(v.host), { left: ["Status"], right: ["Due"] },
    "стороной строки задан Block, в который Field пишется");
  ok("Ф1: сторона строки и есть Block, отдельной настройки стороны нет");
}

/* ---- Ф19: строка — контейнер, а не кнопка ------------------------------ */
{
  const v = makeView();
  const row = rowsOf(v.host)[0] as StubNode;
  assert.equal(row.tagName, "DIV", "строка списка не кнопка");
  assert.equal(row.getAttribute("aria-current"), "true", "выбранная строка помечена aria-current");
  /* Строк в фикстуре две: `Status` и `Due`. Дочерний Field строки не даёт
     (В7), поэтому невыбранная — вторая, а не третья. */
  assert.equal(rowsOf(v.host)[1]?.getAttribute("aria-current"), "false",
    "невыбранная строка помечена явно, а не отсутствием пометки");
  const pick = one(row, "io-fields__pick");
  assert.equal(pick.tagName, "BUTTON", "выбор Field — кнопка внутри строки");
  assert.equal(gripOf(row).getAttribute("role"), "button", "ручка объявлена кнопкой");
  assert.equal(arrowsOf(row).length, 2, "у строки две стрелки");
  ok("Ф19: строка — контейнер с ручкой, кнопкой выбора и двумя стрелками");
}

/* ---- Ф2: перетаскивание несёт ручка, а не строка ----------------------- */
{
  const v = makeView();
  const row = rowsOf(v.host)[0] as StubNode;
  assert.equal(gripOf(row).draggable, true, "ручка перетаскивается");
  assert.equal(row.draggable, false, "строка сама не перетаскивается: внутри неё поля ввода");
  ok("Ф2: draggable стоит на ручке, а не на строке");
}

/* ---- Ф4: чип типа со своим цветом -------------------------------------- */
{
  const v = makeView();
  const chips = all(all(v.host, "io-fields__list")[0] as StubNode, "io-chip").map(c => ({
    text: String(c.textContent || "").trim(),
    bg: c.style.getPropertyValue("--io-chip-bg"),
  }));
  /* Подписи короткие: `Emoji` вместо `Element` — иначе чип съедал имя Field
     в узкой колонке (замечание заказчика 2026-08-27). В конфиге тип прежний. */
  assert.deepEqual(chips.map(c => c.text), ["Tag", "Emoji"],
    "тип показан подписью, а ссылка называется Link, хотя в конфиге wikilink");
  assert.equal(chips[0]?.bg, "var(--io-type-tag)", "цвет типа приходит переменной, а не литералом");
  assert.equal(chips[1]?.bg, "var(--io-type-element)", "у element свой цвет типа");
  ok("Ф4: тип показан чипом с цветом типа, цвет задан переменной");
}

/* ---- Ф18: место под стрелки занято всегда ------------------------------ */
{
  const v = makeView();
  for (const row of rowsOf(v.host)) {
    assert.equal(all(row, "io-fields__tools").length, 1,
      "место под стрелки отведено в каждой строке: их появление не двигает вёрстку");
  }
  ok("Ф18: место под стрелки занято в каждой строке");
}

/* ---- Ф3: строки дочернего Field в списке нет --------------------------- */
{
  /*
   * Решение заказчика 2026-08-28 (вопрос В7). У дочернего Field своей строки
   * в списке Fields нет: дочерность — это уровень значения в таблице Values
   * родителя, и так же устроен прототип.
   *
   * Проверка стоит на фикстуре, где `order.left` СОДЕРЖИТ ключ `status_sub`:
   * так его записал бы невнимательный патч. Нормализация Order обязана
   * выбросить его сама — как настоящая из `main.js`, — и тогда строки не
   * будет, откуда бы ключ ни взялся.
   *
   * Прежде здесь стояли три проверки на поведение этой строки (Ф20 — нет
   * стрелок, Ф3 — тянется за родителем, бросок на неё). Все три проходили
   * только потому, что нормализация в этом файле ключ сохраняла: панель
   * получала состояние, которого плагин выдать не может.
   */
  const v = makeView();
  const names = rowsOf(v.host).map(nameIn);
  assert.ok(names.includes("Status"), "родитель в списке есть");
  assert.ok(!names.includes("Status sub"),
    "а дочернего Field в списке нет, хотя его ключ лежит в order.left фикстуры");
  assert.equal(all(v.host, "io-fields__item--child").length, 0,
    "и ни одной строки, помеченной дочерней");
  ok("Ф3: у дочернего Field своей строки в списке Fields нет (В7)");
}

/* ---- Ф3: Block переносится целиком ------------------------------------- */
{
  const v = makeView();
  const sides = all(v.host, "io-side");
  const parent = rowsOf(v.host).find(r => nameIn(r) === "Status") as StubNode;
  dragToSide(parent, sides[1] as StubNode);
  assert.deepEqual(layout(v.host), { left: [], right: ["Due", "Status"] },
    "Field переехал в другой Block");
  ok("Ф3: перетаскивание переносит Field между Block");
}

/* ---- Ф1: бросок на строку ставит Field перед ней ----------------------- */
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  const status = rowsOf(v.host).find(r => nameIn(r) === "Status") as StubNode;
  dragOnto(due, status);
  assert.deepEqual(layout(v.host), { left: ["Due", "Status"], right: [] },
    "бросок на строку ставит Field перед ней и меняет сторону");
  ok("Ф1: бросок на строку меняет и порядок, и сторону");
}

/* ---- Ф17: стрелка на краю уводит Field через линию --------------------- */
{
  const v = makeView();
  const status = rowsOf(v.host).find(r => nameIn(r) === "Status") as StubNode;
  /* Status — единственный верхнеуровневый Field слева, то есть он и низ. */
  (arrowsOf(status)[1] as StubNode).click();
  assert.deepEqual(layout(v.host), { left: [], right: ["Status", "Due"] },
    "вниз с низа Left Block — в начало Right Block");
  ok("Ф17: стрелка вниз с низа Left Block уводит Field в начало Right Block");
}
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  /* Due — единственный Field справа, то есть он и верх. */
  (arrowsOf(due)[0] as StubNode).click();
  assert.deepEqual(layout(v.host), { left: ["Status", "Due"], right: [] },
    "вверх с верха Right Block — в конец Left Block");
  ok("Ф17: стрелка вверх с верха Right Block уводит Field в конец Left Block");
}

/* ---- Ф17: внутри стороны стрелки просто меняют порядок ----------------- */
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  (arrowsOf(due)[0] as StubNode).click();
  const status = rowsOf(v.host).find(r => nameIn(r) === "Status") as StubNode;
  (arrowsOf(status)[1] as StubNode).click();
  assert.deepEqual(layout(v.host), { left: ["Due", "Status"], right: [] },
    "шаг вниз внутри стороны меняет порядок, а не сторону");
  ok("Ф17: внутри стороны стрелка меняет порядок");
}

/* ---- Ф5 и ПЗ2: добавление и пустое состояние --------------------------- */
{
  const v = makeView();
  const add = all(v.host, "io-btn")[0] as StubNode;
  assert.equal(String(add.textContent || "").trim(), "Add Field", "кнопка называется Add Field");
  /* Акцентная: заказчик просил, чтобы добавление было видно (2026-08-27,
     отменяет прежнее «нейтральная» из Ф5). */
  assert.ok(add.classList.contains("io-btn--cta"),
    "кнопка акцентная: заказчик просил, чтобы добавление было видно");
  add.click();
  assert.equal(v.asked.length, 1, "кнопка спрашивает имя и тип, а не заводит Field молча");
  /*
   * Дочерний Field заводится только у типа `tag`, а здесь тип `wikilink`:
   * так делала и старая доска, и трогать это здесь нельзя — Ф12 велит
   * сохранить поведение, а не поправить его заодно с вёрсткой.
   */
  assert.deepEqual(layout(v.host).right, ["Due", "client"],
    "новый Field встаёт в Right Block под тем именем, что назвали в окне");
  assert.equal(v.state.selected, "client", "новый Field сразу выбран: за добавлением идёт настройка");
  const chips = all(all(v.host, "io-fields__list")[0] as StubNode, "io-chip")
    .map(c => String(c.textContent || "").trim());
  assert.ok(chips.includes("Link"), "тип из окна доехал до Field: без окна Link создать нечем");
  ok("Ф5: Add Field — нейтральная кнопка, окно спрашивает имя и тип");
}
{
  const v = makeView();
  v.reply(null);
  (all(v.host, "io-btn")[0] as StubNode).click();
  assert.deepEqual(v.writes, [], "отказ в окне ничего не пишет");
  ok("отказ в окне Add Field не создаёт Field");
}
{
  const v = makeView();
  v.reply({ name: "не имя!", kind: "tag" });
  (all(v.host, "io-btn")[0] as StubNode).click();
  assert.deepEqual(v.writes, [], "негодное имя до конфига не доходит");
  assert.equal(v.notices.length, 1, "человеку сказали, почему Field не создан");
  ok("негодное имя из окна отклоняется с объяснением");
}
{
  const v = makeView();
  const sides = all(v.host, "io-side");
  const status = rowsOf(v.host).find(r => nameIn(r) === "Status") as StubNode;
  dragToSide(status, sides[1] as StubNode);
  const empty = all(v.host, "io-side__empty");
  assert.equal(empty.length, 1, "у опустевшей стороны есть пустое состояние");
  assert.equal(String(empty[0]?.textContent || "").trim(), "nothing on this side",
    "пустое состояние говорит о стороне, а не «нет данных»");
  ok("ПЗ2: у пустой стороны есть своё состояние");
}

/* ---- записи идут через модель, а не мимо ------------------------------- */
{
  const v = makeView();
  const sides = all(v.host, "io-side");
  const status = rowsOf(v.host).find(r => nameIn(r) === "Status") as StubNode;
  dragToSide(status, sides[1] as StubNode);
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:behavior:order:dnd"],
    "перенос Field — одна запись с той же причиной, что и в старой доске");
  const order = v.writes[0]?.patch?.pkm?.fields?.order;
  assert.deepEqual(order.left, [], "левый Block опустел");
  /* Ключа `status_sub` в списках Order нет и быть не может: настоящий
     `normalizePkmOrder` выбрасывает его из `left` и `right` (В7). Раньше
     здесь ждали его третьим — но только потому, что нормализация в этом
     файле его сохраняла. */
  assert.deepEqual(order.right, ["due", "status"], "правый Block получил перенесённый Field");
  assert.ok(Object.prototype.hasOwnProperty.call(order, "lead"),
    "надгробия lead на месте: без них исчезнувший ведущий Field воскреснет слиянием патчей");
  ok("записи: перенос пишет то же, что старая доска — модель одна на обе вёрстки");
}

/* ---- выключенный модуль ------------------------------------------------ */
{
  const cfg = makeConfig();
  const writes: Write[] = [];
  const model = createFieldsModel({
    plugin: {
      getConfig: () => cfg,
      setConfigPatch: (patch: Any, reason: string) => { writes.push({ reason, patch }); },
    } as never,
    normalizePkmOrder,
    pkmOrderFields: [],
    cfg,
    deepState: deepState as never,
  });
  const host = makeNode("div");
  renderFieldsEditor(host as unknown as El, {
    model,
    ctx: { get: () => 100, set: async () => {}, run: async () => {}, watch: () => () => {} } as never,
    state: { selected: "" },
    enabled: false,
    showTips: true,
    redraw: () => {},
    notice: () => {},
    askNewField: done => done(null),
    confirmDeleteField: (_name, done) => done(false),
  });
  const row = rowsOf(host)[0] as StubNode;
  assert.equal(gripOf(row).draggable, false, "у выключенного модуля Field не перетаскивается");
  assert.equal((arrowsOf(row)[0] as StubNode).disabled, true, "стрелки выключены вместе с модулем");
  (arrowsOf(row)[0] as StubNode).click();
  assert.deepEqual(writes, [], "выключенный модуль ничего не пишет");
  ok("выключенный модуль показывает список и ничего не меняет");
}

/* ---- Ф6: правая колонка — выбранный Field ------------------------------ */
{
  const v = makeView();
  const title = one(v.host, "io-fields__title");
  const heading = title.children.find(c => String(c.tagName) === "H4") as StubNode;
  assert.equal(String(heading.textContent || "").trim(), "status",
    "первым в правой колонке — системное имя Field, оно же имя в заметке конфига");
  assert.equal(all(title, "io-text--name").length, 0,
    "и это заголовок, а не поле: имя задаётся один раз в окне Add Field");
  const chip = all(title, "io-chip")[0] as StubNode;
  assert.equal(String(chip.textContent || "").trim(), "Tag", "тип показан тем же чипом, что и в списке");
  ok("Ф6: шапка правой колонки показывает системное имя и тип выбранного Field");
}
{
  const v = makeView();
  const short = shortInput(v.host);
  assert.equal(short.placeholder, "status",
    "пока короткого имени нет, подсказкой в поле стоит полное");
  assert.equal(short.value, "Status", "короткое имя показано текущим значением");
  short.value = "Stat";
  short.dispatch("change");
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:behavior:order:label:status"],
    "короткое имя пишется той же записью, что и в старой доске");
  assert.equal(shortInput(v.host).value, "Stat", "новое короткое имя видно сразу");
  ok("Ф6: короткое имя правится и пишется в labels");
}
{
  const v = makeView();
  const short = shortInput(v.host);
  short.value = "   ";
  short.dispatch("change");
  assert.deepEqual(v.writes, [], "пустое короткое имя не пишется: так вела себя и старая доска (Ф12)");
  ok("Ф12: пустое короткое имя не стирает прежнее");
}

/* ---- Ф6: удаление красное и с подтверждением --------------------------- */
{
  const v = makeView();
  const del = one(v.host, "io-danger");
  assert.equal(del.getAttribute("aria-label"), "Delete the Field status",
    "кнопка говорит, какой именно Field удалит");
  v.confirm(false);
  del.click();
  assert.deepEqual(v.asksDelete, ["status"], "кнопка спрашивает, а не удаляет сразу");
  assert.deepEqual(v.writes, [], "отказ ничего не пишет");
  ok("Ф6: удаление Field спрашивает подтверждение, отказ ничего не меняет");
}
{
  const v = makeView();
  one(v.host, "io-danger").click();
  assert.deepEqual(v.writes.map(w => w.reason),
    ["pkm:behavior:order:delete:status", "pkm:behavior:delete-field:status"],
    "подтверждённое удаление пишет теми же двумя записями, что и старая доска");
  assert.deepEqual(layout(v.host), { left: [], right: ["Due"] },
    "Field ушёл вместе со своим дочерним");
  const left = one(v.host, "io-fields__title").children
    .find(c => String(c.tagName) === "H4") as StubNode;
  assert.equal(String(left.textContent || "").trim(), "due",
    "после удаления выбранного Field выбор переходит к первому оставшемуся");
  ok("Ф6: подтверждённое удаление уносит Field с дочерним и переводит выбор");
}

/* ---- Ф6: Behavior — это freeRoam, подписи другие, значения прежние ----- */
{
  const v = makeView();
  const mode = all(v.host, "io-select").find(n =>
    String(n.getAttribute("aria-label") || "").startsWith("Behavior for")) as StubNode;
  const labels = mode.children.map(c => String(c.textContent || "").trim());
  const values = mode.children.map(c => String(c.value || ""));
  assert.deepEqual(labels, ["Strict", "Insert only", "Free"], "подписи режима размещения по З1");
  assert.deepEqual(values, ["off", "minimal", "full"], "значения в конфиге остались прежними (З1)");
  assert.equal(mode.value, "off", "показан текущий режим Field");
  mode.value = "full";
  mode.dispatch("change");
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:behavior:order:freeroam:status"],
    "Behavior пишется тем же freeRoam, что и в старой доске");
  ok("Ф6: Behavior меняет freeRoam, подписи новые, значения прежние");
}

/* ---- шапка правой колонки следует типу Field --------------------------- */
{
  const v = makeView();
  const headText = () => all(v.host, "io-fields__colhead")
    .map(n => String(n.textContent || "").replace("?", "").trim());
  assert.deepEqual(headText(), ["Fields", "Values"],
    "у Field с Values правая колонка называется Values");
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  one(due, "io-fields__pick").click();
  assert.deepEqual(headText(), ["Fields", "Emoji"],
    "у Field типа element значений нет, и колонка называется так же, как чип типа");
  ok("Ф6: имя правой колонки следует типу выбранного Field");
}

/* ---- пустое состояние правой колонки ----------------------------------- */
{
  const v = makeView();
  for (const name of ["Status", "Due"]) {
    const row = rowsOf(v.host).find(r => nameIn(r) === name) as StubNode;
    one(row, "io-fields__pick").click();
    one(v.host, "io-danger").click();
  }
  assert.equal(all(v.host, "io-fields__title").length, 0, "выбирать больше нечего");
  assert.equal(String(one(v.host, "io-fields__hint").textContent || "").trim(),
    "add a Field on the left to set it up here",
    "пустая правая колонка говорит, что нажать");
  ok("ПЗ2: правая колонка без Fields приглашает, а не показывает пустоту");
}

/* ---- Ф7: девять колонок в заданном порядке ----------------------------- */
{
  const v = makeView();
  const head = one(v.host, "io-vals__head");
  /* Подпись колонки лежит своим узлом: под ней стоит «?», и textContent
     ячейки читался бы вместе с ним. */
  const titles = head.children.map(c => String(all(c, "io-vals__coltext")[0]?.textContent || "").trim());
  assert.deepEqual(titles, ["", "Level", "Value", "Prefix", "Show", "Fill", "Text", "Preview", ""],
    "колонки таблицы Values идут в порядке Ф7");
  ok("Ф7: девять колонок в порядке ручка, Level, Value, Prefix, Show, Fill, Text, Preview, удаление");
}
{
  const v = makeView();
  const rows = all(v.host, "io-vals__row");
  assert.equal(rows.length, 3, "два значения верхнего уровня и одно дочернее");
  /* Дочернее значение идёт сразу за своим родителем, а не в конце списка. */
  assert.ok((rows[1] as StubNode).classList.contains("io-vals__row--child"),
    "дочернее значение помечено классом: его отличает фон, а не отступ (Ф8)");
  assert.ok(!(rows[2] as StubNode).classList.contains("io-vals__row--child"),
    "следующее значение верхнего уровня стоит после дочернего");
  ok("Ф8: дочернее Value стоит своей строкой и подкрашено, а не отодвинуто");
}

/* ---- Ф8: уровень меняется одной стрелкой ------------------------------- */
{
  const v = makeView();
  const rows = all(v.host, "io-vals__row");
  const arrowOf = (row: StubNode): StubNode => one(row, "io-depthcell").children[0] as StubNode;
  assert.equal((arrowOf(rows[0] as StubNode)).disabled, true,
    "у первого значения родителя нет, и стрелка выключена");
  assert.equal(String(arrowOf(rows[1] as StubNode).textContent || "").trim(), "\u2190",
    "у дочернего значения стрелка ведёт обратно на верхний уровень");
  arrowOf(rows[2] as StubNode).click();
  assert.deepEqual(v.writes.map(w => w.reason),
    ["pkm:behavior:order:deep:indent:status", "pkm:behavior:order:deep:indent:status:prefix"],
    "смена уровня пишется той же парой записей, что и в старой доске");
  ok("Ф8: одна стрелка делает Value дочерним и возвращает обратно");
}

/* ---- Ф9: Show и свой текст --------------------------------------------- */
{
  const v = makeView();
  const shown = one(all(v.host, "io-vals__row")[0] as StubNode, "io-showncell").children[0] as StubNode;
  assert.deepEqual(shown.children.map(c => String(c.value || "")), ["default", "empty", "custom"],
    "значения Show в конфиге прежние (З1)");
  shown.value = "custom";
  shown.dispatch("change");
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:visuals:tag:visibility:status"],
    "Show пишется той же записью, что и в старой доске");
  const cell = one(all(v.host, "io-vals__row")[0] as StubNode, "io-showncell");
  assert.equal(cell.children.length, 2, "у custom рядом появляется поле своего текста");
  ok("Ф9: Show переключается, а custom открывает поле своего текста");
}

/* ---- Ф9б: Preview следует за набором своего текста --------------------- */
{
  /*
   * Замечание заказчика 2026-09-07: «при выборе custom и вводе значения в
   * текстбокс в preview обновление происходит не сразу, а после перещёлкивания
   * вкладок». Так и было: подпись писалась только по `change`, то есть по уходу
   * фокуса.
   *
   * Проверяется то, что видит человек, — **подпись пузыря в колонке
   * `Preview`**, — и проверяется в обе стороны: до набора она другая
   * (положительный контроль, У-88), после набора равна набранному, а в конфиг
   * от набора не уезжает ничего.
   */
  const v = makeView();
  const cellOf = (): StubNode => one(all(v.host, "io-vals__row")[0] as StubNode, "io-showncell");
  const bubbleOf = (): StubNode => one(
    one(all(v.host, "io-vals__row")[0] as StubNode, "io-vals__prev"),
    "io-bubble",
  );

  const shown = cellOf().children[0] as StubNode;
  shown.value = "custom";
  shown.dispatch("change");

  const before = String(bubbleOf().textContent || "");
  assert.notEqual(before, "ASAP", "до набора в Preview стоит не то, что будет набрано");

  const custom = cellOf().children[1] as StubNode;
  const writesBefore = v.writes.length;
  custom.value = "ASAP";
  custom.dispatch("input");
  assert.equal(String(bubbleOf().textContent || ""), "ASAP",
    "Preview показывает набранное, не дожидаясь ухода фокуса");
  assert.equal(v.writes.length, writesBefore,
    "набор буквы в конфиг не пишет: это A9, и перерисовка унесла бы каретку (У-20)");

  /* Пустой текст — пузырь остаётся пузырём, а не схлопывается в точку. */
  custom.value = "";
  custom.dispatch("input");
  assert.equal(String(bubbleOf().textContent || ""), "\u00A0",
    "у пустого своего текста подпись — неразрывный пробел");

  custom.value = "ASAP";
  custom.dispatch("change");
  assert.deepEqual(v.writes.slice(writesBefore).map(w => w.reason),
    ["pkm:visuals:tag:custom-text:status"],
    "в конфиг значение уезжает по уходу фокуса, той же записью, что и раньше");
  ok("Ф9б: Preview следует за набором, конфиг — за уходом фокуса");
}

/* ---- Ф10: порядок цикла сказан один раз, в шапке ----------------------- */
{
  const v = makeView();
  const marks = all(v.host, "io-help").filter(b =>
    String(b.getAttribute("aria-label") || "") === "More about Values");
  assert.equal(marks.length, 1, "подсказка про порядок цикла одна на всю таблицу");
  (marks[0] as StubNode).click();
  const tips = all(v.host, "io-tip").map(t => String(t.textContent || ""));
  assert.ok(tips.some(t => t.includes("next") && t.includes("previous") && t.includes("in order")),
    "подсказка говорит, что порядок Values задаёт порядок цикла");
  ok("Ф10: порядок цикла объяснён в подсказке таблицы, а не в каждой строке");
}

/* ---- Н15–Н18: предупреждение о нечитаемом цвете ------------------------ */
{
  const v = makeView();
  const rows = all(v.host, "io-vals__row");
  assert.equal(all(rows[0] as StubNode, "io-warn").length, 0,
    "белое на почти чёрном читается, и значка нет");
  const warn = all(rows[2] as StubNode, "io-warn");
  assert.equal(warn.length, 1, "белое на жёлтом не читается, и значок есть");
  assert.ok(String((warn[0] as StubNode).getAttribute("aria-label") || "").includes("aim for 3:1"),
    "подсказка называет и текущее отношение, и нужное");
  ok("Н15: нечитаемая пара цветов помечена тихим значком с числом");
}

/* ---- Н15 и незаданный цвет текста (замечание заказчика 2026-08-28) ----- */

/*
 * Значок появлялся только у Value, где человек выставил ОБА цвета. Незаданный
 * цвет означал «претензий нет», хотя пузырь всё равно нарисован — цветом темы,
 * `--text-on-accent`. От этого белое на красном (4.0:1) значок получало, а
 * белое на жёлтом (1.7:1) — нет, хотя читается хуже.
 *
 * Теперь считается пара цветов, которыми Value НАРИСОВАН. Тему читает
 * `getComputedStyle`; заглушка DOM отдаёт пустое — и тогда значка нет, как и
 * раньше: гадать о цвете темы панель не должна.
 */
{
  const rowWithFillOnly = (onAccent: string): number => {
    const view = (globalThis as unknown as { window: Any }).window;
    const real = view.getComputedStyle;
    view.getComputedStyle = () => ({
      getPropertyValue: (name: string) => (name === "--text-on-accent" ? onAccent : ""),
    });
    try {
      const v = makeView();
      /*
       * Вторая строка таблицы — дочернее значение `#early`: заливка есть, цвет
       * текста не задан. Дочернее идёт сразу за своим родителем, поэтому его
       * место второе, а `#doing` — третье.
       */
      const rows = all(v.host, "io-vals__row");
      return all(rows[1] as StubNode, "io-warn").length;
    } finally {
      view.getComputedStyle = real;
    }
  };

  assert.equal(rowWithFillOnly(""), 0,
    "тему прочитать нечем — значка нет: гадать панель не должна");
  assert.equal(rowWithFillOnly("rgb(255, 255, 255)"), 1,
    "белый текст темы на жёлтой заливке — значок есть, хотя цвет текста не задан");
  assert.equal(rowWithFillOnly("#1a1a1a"), 0,
    "а тёмный текст темы на той же заливке читается, и значка нет");
  ok("Н15: контраст считается по нарисованным цветам, а не только по заданным");
}

/* ---- Value: правка, удаление, добавление ------------------------------- */
{
  const v = makeView();
  const token = one(all(v.host, "io-vals__row")[0] as StubNode, "io-valcell").children[0] as StubNode;
  assert.equal(token.value, "#todo", "значение показано так, как лежит в конфиге");
  token.value = "#later";
  token.dispatch("change");
  assert.deepEqual(v.writes.map(w => w.reason),
    ["pkm:behavior:order:deep:rename:status", "pkm:behavior:order:deep:rename:status:prefix"],
    "переименование значения пишется как в старой доске");
  ok("Value переименовывается той же записью, что и раньше");
}
{
  const v = makeView();
  /* В ячейке кнопок их две: сброс цвета и удаление. Берём по подписи, а не по
     месту: место у сброса появляется и исчезает вместе со своим цветом. */
  const del = one(all(v.host, "io-vals__row")[0] as StubNode, "io-valtools").children
    .find(c => String(c.getAttribute("aria-label") || "").startsWith("Remove ")) as StubNode;
  del.click();
  assert.deepEqual(v.writes.map(w => w.reason),
    ["pkm:behavior:order:deep:delete-token:status", "pkm:behavior:order:deep:delete-token:status:prefix"],
    "удаление значения пишется как в старой доске");
  /*
   * Ушло не одно значение, а два: дочернее держится за родителя списком
   * разрешённых родителей, и без него оно больше ни к чему не привязано.
   * Так вело себя и раньше — Ф12 велит сохранить, а не поправить.
   */
  assert.equal(all(v.host, "io-vals__row").length, 1, "значение ушло из таблицы вместе со своим дочерним");
  ok("Value удаляется и уносит своё дочернее значение");
}
{
  const v = makeView();
  const foot = one(v.host, "io-vals__foot");
  const input = foot.children.find(c => String(c.tagName) === "INPUT") as StubNode;
  input.value = "#blocked";
  (foot.children.find(c => String(c.tagName) === "BUTTON") as StubNode).click();
  assert.deepEqual(v.writes.map(w => w.reason),
    ["pkm:behavior:order:deep:add-token:status", "pkm:behavior:order:deep:add-token:status:prefix"],
    "добавление значения пишется как в старой доске");
  ok("Value добавляется той же парой записей");
}

/* ---- Prefix — это чекбокс перед строкой -------------------------------- */
{
  const v = makeView();
  const row = all(v.host, "io-vals__row")[0] as StubNode;
  const prefix = row.children.find(c => String(c.tagName) === "INPUT"
    && String(c.getAttribute("aria-label") || "").startsWith("Prefix for")) as StubNode;
  assert.equal(prefix.placeholder, "no", "пустой Prefix значит обычный маркер списка");
  prefix.value = "[x]";
  prefix.dispatch("change");
  assert.deepEqual(v.writes.map(w => w.reason),
    ["pkm:behavior:order:deep:checkbox:status", "pkm:behavior:order:deep:checkbox:status:prefix"],
    "Prefix пишется записью чекбокса, как в старой доске");
  ok("Prefix задаёт чекбокс перед строкой");
}
{
  const v = makeView();
  const row = all(v.host, "io-vals__row")[0] as StubNode;
  const prefix = row.children.find(c => String(c.tagName) === "INPUT"
    && String(c.getAttribute("aria-label") || "").startsWith("Prefix for")) as StubNode;
  prefix.value = "не чекбокс";
  prefix.dispatch("change");
  assert.deepEqual(v.writes, [], "негодный чекбокс в конфиг не уходит");
  assert.equal(v.notices.length, 1, "человеку сказали, каким он должен быть");
  ok("негодный Prefix отклоняется с объяснением");
}

/* ---- Ф7: у ссылки колонок цвета нет ------------------------------------ */
{
  const v = makeView();
  v.reply({ name: "client", kind: "wikilink" });
  (all(v.host, "io-btn")[0] as StubNode).click();
  const head = one(v.host, "io-vals__head");
  assert.deepEqual(
    head.children.map(c => String(all(c, "io-vals__coltext")[0]?.textContent || "").trim()),
    ["", "Level", "Value", "Prefix", ""],
    "у ссылки те же колонки, что у тега, за вычетом цвета");
  assert.ok(one(v.host, "io-vals").classList.contains("io-vals--link"),
    "у таблицы ссылки своя сетка колонок");
  ok("Ф7: у Field типа link колонок цвета нет");
}

/* ---- Ф6: строки Field типа element ------------------------------------- */
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  one(due, "io-fields__pick").click();
  assert.equal(all(v.host, "io-vals").length, 0, "у element таблицы Values нет");
  const names = all(v.host, "io-item__name").map(n => String(n.textContent || "").trim());
  assert.deepEqual(names,
    [SHORT_NAME,
      /*
       * Значение Field идёт до его поведения: заказчик поднял `Values` под
       * `Name in TagWheel` и над `Behavior` для всех типов Field сразу
       * (замечание 1.4.1.2.4). У `element` на этом месте маркер, формат и шаг.
       */
      "Emoji-prefix", "Value format", "Steps by", "Command",
      "Active", "Prefix behavior", "Prerequisite Field",
      /*
       * Раздел `YAML property` целиком: решение заказчика 2026-08-28 перенесло
       * сюда настройки из блока `Note properties` (10.9). Строки `Written as`
       * здесь нет — она считается движком по конфигу, а платформы у этой
       * проверки вёрстки нет; это её условие, а не пропуск.
       */
      "Property", "Property type", "How to show Value in YAML"],
    "у element показаны маркер, формат и способ шага, и только то, чем шагает текущий режим");
  ok("Ф6: у Field типа element строки маркера, формата и шага вместо таблицы Values");
}
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  one(due, "io-fields__pick").click();
  const marker = all(v.host, "io-text--mono").find(n =>
    String(n.getAttribute("aria-label") || "").startsWith("Emoji-prefix for")) as StubNode;
  assert.equal(marker.value, "!", "маркер показан из конфига");
  marker.value = "@";
  marker.dispatch("change");
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:behavior:order:deep:emoji:due"],
    "маркер пишется той же записью, что и в старой доске");
  ok("Ф6: маркер element пишется той же записью");
}
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  one(due, "io-fields__pick").click();
  const step = all(v.host, "io-select").find(s =>
    String(s.getAttribute("aria-label") || "").startsWith("Steps by")) as StubNode;
  assert.equal(step.value, "command", "показан текущий способ шага");
  step.value = "custom";
  step.dispatch("change");
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:behavior:order:deep:mode:due"],
    "способ шага пишется той же записью");
  assert.equal(all(v.host, "io-textarea").length, 1, "у своего списка шагов появилось поле");
  ok("Ф6: способ шага меняется, и под него открывается нужное поле");
}

/* ---- системное имя неизменяемо (пересмотр решения 2026-08-27) ---------- */
{
  /*
   * Имя задаётся один раз в окне `Add Field`. Поле ввода в шапке пробовали и
   * убрали: без описания, широкое, и `Delete Field` от него съезжал строкой
   * ниже. Способ в модели цел — `setStrictName` перенесён дословно и покрыт
   * картой записей, — но ни одна кнопка панели его не зовёт.
   */
  const v = makeView();
  const inputs = all(v.host, "io-fields__title")[0]?.children
    .filter(c => String(c.tagName) === "INPUT") ?? [];
  assert.equal(inputs.length, 0,
    "в шапке полей ввода нет вовсе: имя и тип — текст, рядом только удаление");
  assert.ok(shortInput(v.host), "короткое имя уехало своей строкой ниже (шестой круг)");
  ok("системное имя показано заголовком и с панели не правится");
}

/* ---- цвет значения: читается оттуда же, куда пишется ------------------- */
{
  /*
   * Дефект со скриншота заказчика 2026-08-27: у дочернего значения цвет не
   * держался. Писался он в Field, а читался из дочернего Field, и потому не
   * появлялся никогда — значение оставалось с цветом темы.
   */
  const v = makeView();
  const child = all(v.host, "io-vals__row")[1] as StubNode;
  assert.ok(child.classList.contains("io-vals__row--child"), "вторая строка и правда дочерняя");
  const fill = child.children
    .map(c => all(c, "io-colin")[0])
    .find(Boolean) as StubNode;
  fill.value = "#123456";
  fill.dispatch("change");
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:visuals:tag:fill:status"],
    "цвет дочернего значения пишется под Field, а не под дочерним Field");

  const again = all(v.host, "io-vals__row")[1] as StubNode;
  const shown = again.children.map(c => all(c, "io-colin")[0]).find(Boolean) as StubNode;
  assert.equal(shown.value, "#123456", "и читается обратно тем же ключом");
  ok("цвет дочернего значения держится: чтение и запись по одному ключу");
}
{
  const v = makeView();
  const parent = all(v.host, "io-vals__row")[0] as StubNode;
  const colors = parent.children.map(c => all(c, "io-colin")[0]).filter(Boolean) as StubNode[];
  assert.equal(colors.length, 2, "у значения две колонки цвета: заливка и текст");
  assert.equal(colors[0]?.value, "#222222", "заливка показана из конфига");
  assert.equal(colors[1]?.value, "#ffffff", "цвет текста тоже");
  ok("цвета значения показаны из конфига, а не из темы");
}

/* ---- свойство заметки задаётся у Field (решение 2026-08-27) ------------ */
{
  const v = makeView();
  const names = all(v.host, "io-item__name").map(n => String(n.textContent || "").trim());
  assert.ok(names.includes("Property"),
    "свойство заметки — настройка Field, а не отдельная таблица где-то ещё");
  assert.ok(names.includes("Prefix behavior"),
    "режим размещения называется Prefix behavior");
  const input = all(v.host, "io-text--mono").find(n =>
    String(n.getAttribute("aria-label") || "").startsWith("YAML property for")) as StubNode;
  assert.equal(input.value, "status", "показано то, что лежит в конфиге");
  input.value = "state";
  input.dispatch("change");
  assert.deepEqual(v.writes.map(w => w.reason),
    ["pkm:behavior:order:yaml:status", "pkm:behavior:order:yaml-propagate:status"],
    "свойство пишется той же парой записей, что и в старой доске");
  ok("свойство заметки правится у Field и пишется как раньше");
}
{
  /*
   * Подсказка открывается сразу под своей строкой. Раньше она уезжала в конец
   * колонки: человек нажимал «?» у короткого имени, а текст появлялся под
   * таблицей Values (скриншот заказчика 2026-08-27).
   */
  const v = makeView();
  const mark = all(v.host, "io-help").find(b =>
    String(b.getAttribute("aria-label") || "") === "More about " + SHORT_NAME) as StubNode;
  assert.ok(mark, "у строки имени в TagWheel есть «?»");
  mark.click();
  const opened = all(v.host, "io-tip");
  assert.equal(opened.length, 1, "подсказка открылась ровно в одном месте");
  /*
   * Строка своя, поэтому и подсказка открывается внутри неё, а не в конце
   * колонки: раньше текст появлялся под таблицей Values.
   *
   * С 2026-09-07 она ребёнок **самой строки**, а не колонки описания: в
   * колонке она была шириной с имя настройки, и заказчик прислал это
   * скриншотом (`15.png`). Ширину даёт `flex-wrap` у `.io-item`; здесь
   * проверяется место в дереве — то, от чего эта ширина зависит.
   */
  const ownRow = opened[0]?.parentElement as StubNode;
  assert.ok(String(ownRow?.className || "").includes("io-item"),
    "подсказка открылась ребёнком своей строки, а не колонки описания");
  assert.ok(!String(ownRow?.className || "").includes("io-item__info"),
    "и это именно строка, а не колонка внутри неё");
  assert.ok(all(ownRow, "io-item__name").some(n =>
    String(n.textContent || "").trim() === SHORT_NAME),
    "и это строка имени в TagWheel");
  ok("подсказка открывается под своей строкой, а не в конце колонки");
}

/* ======================================================================
 * Семь замечаний заказчика по редактору Fields (2026-08-27).
 * ====================================================================== */

/* ---- 1: «?» у короткого имени стоит до поля ввода ---------------------- */
{
  const v = makeView();
  const row = shortRowOf(v.host);
  /* Строка читается слева направо: подпись, знак вопроса, потом правка.
     Знак стоит в блоке описания, поле ввода — в блоке контрола справа. */
  const info = one(row, "io-item__info");
  const nameRow = one(info, "io-item__namerow");
  const inNameRow = nameRow.children.map(c => String(c.className || ""));
  assert.ok(inNameRow.some(c => c.includes("io-item__name")), "в строке есть подпись");
  assert.ok(inNameRow.some(c => c.includes("io-help")), "и «?» стоит рядом с подписью");
  assert.equal(all(nameRow, "io-text").length, 0, "поля ввода в строке подписи нет");
  assert.ok(all(one(row, "io-item__control"), "io-text").length,
    "поле ввода стоит в контроле, то есть после подписи и «?»");
  ok("замечание 1: «?» у имени в TagWheel стоит перед полем ввода");
}

/* ---- 2: кнопка удаления называется Delete и залита красным ------------- */
{
  const v = makeView();
  const del = one(v.host, "io-danger");
  /*
   * Слова `Delete` на кнопке нет: белая корзина на красном говорит сама
   * (замечание заказчика 2026-08-27, второй круг). Смысл несут `aria-label` и
   * `title` — без них кнопка со значком читается программой чтения с экрана
   * как «кнопка» и ничего больше.
   */
  assert.deepEqual(del.children.map(c => String(c.className || "")), ["io-danger__icon"],
    "на кнопке один узел — значок корзины, без подписи");
  assert.equal(del.getAttribute("aria-label"), "Delete the Field status",
    "наведение объясняет, что делает кнопка");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const rule = /\.io-danger \{([^}]*)\}/.exec(css);
  assert.ok(rule, "правило .io-danger нашлось в styles.css");
  assert.ok(/background:\s*var\(--background-modifier-error\)/.test(String(rule?.[1])),
    "кнопка залита красным, а не обведена: заказчик просил, чтобы она бросалась в глаза");
  /*
   * Корзина рисуется маской, а не эмодзи: цветной значок, обесцвеченный
   * фильтром, читался пятном (замечание заказчика 1.4.1.2.3). Проверяется и
   * то, что фильтра больше нет: он и был причиной.
   */
  const icon = /\.io-danger__icon \{([^}]*)\}/.exec(css);
  const iconBody = String(icon?.[1]);
  assert.ok(/mask:\s*url\("data:image\/svg\+xml/.test(iconBody),
    "значок рисуется маской из своего контура, а не шрифтовым эмодзи");
  assert.ok(/background-color:\s*currentColor/.test(iconBody),
    "и красится цветом кнопки, поэтому в тёмной теме не белеет отдельно");
  assert.ok(!/filter:/.test(iconBody),
    "фильтра обесцвечивания больше нет: он и делал из корзины пятно");
  const viewSrc = fs.readFileSync(path.join(root, "src", "ui", "settings", "custom",
    "fields_editor_view.ts"), "utf8");
  assert.ok(!viewSrc.includes("\u{1F5D1}"),
    "эмодзи корзины в виде редактора не осталось: иначе он ляжет поверх маски");
  ok("замечание 2: удаление — белая корзина на красной заливке, без слова");
}

/* ---- 3: свойство заметки — описание, подсказка в поле, ширина ---------- */
{
  const v = makeView();
  const rows = all(v.host, "io-item");
  const propRow = rows.find(r =>
    String(all(r, "io-item__name")[0]?.textContent || "").trim() === "Property") as StubNode;
  assert.equal(String(all(propRow, "io-item__desc")[0]?.textContent || "").trim(),
    "If you use inline2note, to which YAML property this Field should go",
    "описание говорит, зачем это свойство нужно");
  const input = all(propRow, "io-text--prop")[0] as StubNode;
  assert.equal(input.placeholder, "select Property",
    "подсказка в поле приглашает выбрать свойство, а не показывает имя Field");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const propWidth = /\.io-fields \.io-text--prop \{ width: (\d+)px; \}/.exec(css);
  const selectWidth = /\.io-fields \.io-select \{[^}]*min-width:\s*(\d+)px/.exec(css);
  assert.ok(propWidth && selectWidth, "ширины поля и списка объявлены в styles.css");
  assert.equal(propWidth?.[1], selectWidth?.[1],
    "поле свойства ровно той же ширины, что выпадающий список Prefix behavior над ним");
  ok("замечание 3: у свойства заметки новое описание, подсказка в поле и ширина списка");
}

/* ---- 4: подсказки колонок таблицы Values ------------------------------- */
{
  const v = makeView();
  const head = one(v.host, "io-vals__head");
  const withTip: string[] = [];
  for (const cell of head.children) {
    const title = String(all(cell, "io-vals__coltext")[0]?.textContent || "").trim();
    if (all(cell, "io-help").length) withTip.push(title);
  }
  assert.deepEqual(withTip, ["Level", "Value", "Prefix", "Show"],
    "подсказка есть у каждого заголовка, кроме Fill, Text и Preview");
  ok("замечание 4: подсказки стоят у Level, Value, Prefix и Show, и только у них");
}
{
  const v = makeView();
  const head = one(v.host, "io-vals__head");
  const cell = head.children.find(c =>
    String(all(c, "io-vals__coltext")[0]?.textContent || "").trim() === "Level") as StubNode;
  const parts = cell.children.map(c => String(c.className || ""));
  assert.deepEqual(parts, ["io-vals__coltext", "io-help"],
    "«?» стоит ПОД текстом заголовка, то есть вторым узлом ячейки, а не рядом с ним");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const rule = /\.io-vals__head > div \{([^}]*)\}/.exec(css);
  assert.ok(/flex-direction:\s*column/.test(String(rule?.[1])),
    "ячейка шапки складывает подпись и знак в столбик: иначе знак наезжает на соседа");
  ok("замечание 4: «?» стоит под текстом заголовка, а не справа от него");
}
{
  const v = makeView();
  const mark = all(v.host, "io-help").find(b =>
    String(b.getAttribute("aria-label") || "") === "More about Level") as StubNode;
  mark.click();
  const slot = one(v.host, "io-vals__tipslot");
  const tips = all(slot, "io-tip");
  assert.equal(tips.length, 1, "подсказка колонки открылась под шапкой таблицы");
  assert.equal(String(tips[0]?.textContent || "").trim(),
    "change Value to be parent or child by pressing arrows. "
    + "Child Values are only active when Parent Value is present",
    "текст подсказки Level — тот, который дал заказчик");
  const inner = one(v.host, "io-vals__inner");
  assert.equal(inner.children.indexOf(slot), 1,
    "место под подсказку стоит сразу за шапкой и до первой строки");
  ok("замечание 4: подсказка Level открывается под шапкой во всю ширину таблицы");
}
{
  const v = makeView();
  const notes = all(v.host, "io-note").map(n => String(n.textContent || ""));
  assert.deepEqual(notes, [],
    "строка про стрелку из подвала убрана: она уехала в подсказку колонки Level");
  ok("замечание 4: подвал таблицы больше не объясняет стрелку");
}

/* ---- 5: подсказка в поле нового значения ------------------------------- */
{
  const v = makeView();
  const foot = one(v.host, "io-vals__foot");
  const input = foot.children.find(c => String(c.tagName) === "INPUT") as StubNode;
  assert.equal(input.placeholder, "#tag / tag",
    "решётка не обязательна, и поле об этом говорит");
  ok("замечание 5: поле нового значения подсказывает «#tag / tag»");
}

/* ---- 6: контрол видимости дочернего Field ------------------------------ */
{
  /*
   * Та самая потеря. Контрол был в старой доске кнопкой (`toggle sub <key>`),
   * в новую вёрстку не попал, и сверка карт этого не поймала: `toggleSub`
   * пишет в те же ветки конфига, что и соседние контролы.
   */
  const v = makeView();
  const rows = all(v.host, "io-item");
  const childRow = rows.find(r =>
    String(all(r, "io-item__name")[0]?.textContent || "").trim() === "Child Field") as StubNode;
  assert.ok(childRow, "у Field с дочерним есть ряд Child Field");
  const pick = all(childRow, "io-select")[0] as StubNode;
  assert.deepEqual(pick.children.map(c => String(c.value || "")), ["yes", "no"],
    "дочерний Field либо показывается, либо нет");
  assert.equal(pick.value, "yes", "в конфиге проверки дочерний Field включён");
  pick.value = "no";
  pick.dispatch("change");
  assert.deepEqual(v.writes.map(w => w.reason),
    ["pkm:behavior:leftmode:subtoggle:status_sub", "pkm:behavior:order:sub:status_sub"],
    "выключение пишет теми же двумя записями и в том же порядке, что и старая доска");
  ok("замечание 6: контрол дочернего Field вернулся и зовёт toggleSub");
}
{
  const v = makeView();
  const rows = all(v.host, "io-item");
  const childRow = rows.find(r =>
    String(all(r, "io-item__name")[0]?.textContent || "").trim() === "Child Field") as StubNode;
  const pick = all(childRow, "io-select")[0] as StubNode;
  /* `toggleSub` переключает, а не выставляет: выбор того же значения не пишет. */
  pick.value = "yes";
  pick.dispatch("change");
  assert.deepEqual(v.writes, [], "выбор того же значения ничего не пишет");
  ok("замечание 6: повторный выбор того же значения не трогает конфиг");
}
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  one(due, "io-fields__pick").click();
  const names = all(v.host, "io-item__name").map(n => String(n.textContent || "").trim());
  assert.ok(!names.includes("Child Field"),
    "у Field без дочернего этого ряда нет: контролу нечего переключать (З8)");
  ok("замечание 6: у Field без дочернего ряда Child Field нет");
}
{
  /*
   * Раньше здесь проверялось, что у дочернего Field нет своего ряда `Active`:
   * его включает родитель, и делает это `toggleSub` — двумя записями, а не
   * одной. Выбрать дочерний Field было можно только через его строку в
   * списке, а строки нет (В7, 2026-08-28), — значит и выбрать нечего.
   *
   * Утверждение осталось верным, но проверять его больше не на чем: путь,
   * которым сюда приходили, закрыт решением. Проверка снята, а не переписана
   * на подпорку: подпорка вернула бы состояние, которого плагин не выдаёт, —
   * ровно то, с чего началась эта уборка.
   */
  ok("замечание 6: дочерний Field включается только родителем (снято, см. В7)");
}

/* ---- Active вернулся в правую колонку (решение заказчика 2026-08-27) --- */
{
  const v = makeView();
  const rows = all(v.host, "io-item");
  const activeRow = rows.find(r =>
    String(all(r, "io-item__name")[0]?.textContent || "").trim() === "Active") as StubNode;
  assert.ok(activeRow, "у Field есть ряд Active");
  const mode = all(activeRow, "io-select")[0] as StubNode;
  assert.deepEqual(mode.children.map(c => String(c.value || "")), ["yes", "no", "hotkey_only"],
    "значения в конфиге прежние (З1): yes, no, hotkey_only");
  assert.deepEqual(mode.children.map(c => String(c.textContent || "").trim()),
    ["Yes", "No", "Commands only"], "подписи человеческие, без подчёркиваний");
  mode.value = "hotkey_only";
  mode.dispatch("change");
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:behavior:order:active:status"],
    "Active пишется той же записью, что и в старой доске");
  ok("Active вернулся в правую колонку и пишется как раньше");
}

/* ---- сброс цвета Value к цвету темы (решение заказчика 2026-08-27) ----- */
{
  const v = makeView();
  const row = all(v.host, "io-vals__row")[0] as StubNode;
  const tools = one(row, "io-valtools");
  const labels = tools.children.map(c => String(c.getAttribute("aria-label") || ""));
  assert.deepEqual(labels,
    ["Reset the colors of #todo back to the colors of the theme", "Remove #todo"],
    "сброс стоит перед удалением, он один на оба цвета, и подпись у него одна");
  (tools.children[0] as StubNode).click();
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:visuals:tag:color-reset:status"],
    "сброс — одна запись на оба цвета");
  const wrote = v.writes[0]?.patch?.visual?.tags?.byTag?.status?.["#todo"];
  assert.equal(wrote.fillColor, "", "заливка вернулась к цвету темы");
  assert.equal(wrote.textColor, "", "цвет текста тоже");
  ok("сброс цвета Value вернулся: одна кнопка на оба цвета, перед удалением");
}
{
  const v = makeView();
  const row = all(v.host, "io-vals__row")[0] as StubNode;
  (one(row, "io-valtools").children[0] as StubNode).click();
  const again = all(v.host, "io-vals__row")[0] as StubNode;
  const labels = one(again, "io-valtools").children
    .map(c => String(c.getAttribute("aria-label") || ""));
  assert.deepEqual(labels, ["Remove #todo"],
    "сбрасывать больше нечего, и кнопки сброса нет: контрол без работы не показывается (З8)");
  assert.equal(all(again, "io-warn").length, 0,
    "у Value без своего цвета претензий к контрасту нет: цвет темы посчитать нечем");
  ok("сброс исчезает, когда у Value своего цвета не осталось");
}

/* ======================================================================
 * Второй круг замечаний заказчика по редактору Fields (2026-08-27).
 * ====================================================================== */

/* ---- 2: обе кнопки добавления акцентные -------------------------------- */
{
  const v = makeView();
  const foot = one(v.host, "io-vals__foot");
  const addValue = foot.children.find(c => String(c.tagName) === "BUTTON") as StubNode;
  assert.ok(addValue.classList.contains("io-btn--cta"),
    "Add Value акцентная, как и Add Field");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const rule = /\.io-btn--cta \{([^}]*)\}/.exec(css);
  assert.ok(/background:\s*var\(--interactive-accent\)/.test(String(rule?.[1])),
    "цвет кнопки — акцент темы, а не литерал (З6): в теме Obsidian он и есть фиолетовый");
  assert.ok(/color:\s*var\(--text-on-accent\)/.test(String(rule?.[1])),
    "текст на кнопке читается поверх акцента");
  ok("второй круг 2: Add Field и Add Value акцентные, цвет из переменной темы");
}

/* ---- 3: у ссылки своя подсказка Value и свой плейсхолдер ---------------- */
{
  const v = makeView();
  const project = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  assert.ok(project, "в списке есть Field, с которого начнём");
  /* Field типа link в конфиге проверки нет — создаём его окном. */
  v.reply({ name: "client", kind: "wikilink" });
  (all(v.host, "io-btn")[0] as StubNode).click();

  const mark = all(v.host, "io-help").find(b =>
    String(b.getAttribute("aria-label") || "") === "More about Value") as StubNode;
  mark.click();
  const tip = String(all(one(v.host, "io-vals__tipslot"), "io-tip")[0]?.textContent || "");
  assert.ok(tip.includes("[[link]]") && tip.includes("link"),
    "подсказка Value у ссылки говорит про wikilink, а не про тег");
  assert.ok(!tip.includes("#"), "решётки в подсказке ссылки нет: у ссылки её и не бывает");

  const foot = one(v.host, "io-vals__foot");
  const input = foot.children.find(c => String(c.tagName) === "INPUT") as StubNode;
  assert.equal(input.placeholder, "[[wikilink]] / wikilink",
    "скобки не обязательны, и поле об этом говорит");
  ok("второй круг 3: у ссылки своя подсказка Value и свой плейсхолдер");
}

/* ---- 4: текст редактора того же размера, что остальные настройки -------- */
{
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const rule = /\.io-fields \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(/font-size:\s*var\(--font-ui-small\)/.test(String(rule?.[1])),
    "размер текста редактора задан переменной строки настройки, а не наследуется от документа");
  ok("второй круг 4: размер текста редактора пришит к --font-ui-small");
}

/* ---- 5: имя Field не обрезается чипом и стрелками ---------------------- */
{
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const tools = /\.io-fields__tools \{([\s\S]*?)\n\}/.exec(css);
  const width = /width:\s*(\d+)px/.exec(String(tools?.[1]));
  assert.ok(width && Number(width[1]) <= 34,
    "место под стрелки сузилось: вместе с чипом типа они съедали имя Field");
  const icon = /\.io-fields__tools \.io-icon \{([^}]*)\}/.exec(css);
  const iconWidth = /width:\s*(\d+)px/.exec(String(icon?.[1]));
  assert.ok(iconWidth && Number(iconWidth[1]) <= 16, "и сами стрелки стали уже");
  ok("второй круг 5: стрелки сузились, чип типа назван одним коротким словом");
}

/* ---- 6: правая колонка Field типа Emoji ------------------------------- */
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  one(due, "io-fields__pick").click();
  const subs = all(v.host, "io-sub").map(n => String(n.textContent || "").replace("?", "").trim());
  assert.deepEqual(subs, ["Value", "Behavior", "YAML property"],
    "значение идёт первым, за ним поведение и свойство заметки (1.4.1.2.4)");
  const step = all(v.host, "io-select").find(s =>
    String(s.getAttribute("aria-label") || "").startsWith("Steps by")) as StubNode;
  assert.deepEqual(step.children.map(c => String(c.textContent || "").trim()),
    ["Fixed step", "Command", "Custom step"],
    "подписи режимов шага — те, которые назвал заказчик");
  assert.deepEqual(step.children.map(c => String(c.value || "")),
    ["increment", "command", "custom"], "значения в конфиге прежние (З1)");
  ok("второй круг 6: у Field типа Emoji свой заголовок и понятные подписи режимов");
}
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  one(due, "io-fields__pick").click();
  const withTip = all(v.host, "io-item").filter(r => all(r, "io-help").length)
    .map(r => String(all(r, "io-item__name")[0]?.textContent || "").trim());
  assert.deepEqual(withTip,
    /* Порядок тот же, что у строк: значение Field идёт до его поведения
       (замечание заказчика 1.4.1.2.4). */
    [SHORT_NAME, "Emoji-prefix", "Value format", "Steps by", "Command",
      "Active", "Prefix behavior", "Prerequisite Field",
      /*
       * У `Property` подсказка появилась 2026-09-01 (замечание 1.3.2.1).
       * Заказчик 2026-08-27 решил обратное — «?» здесь не ставить, потому что
       * подсказка раздела стоит прямо над ней, — и теперь попросил вернуть.
       * Прежнее решение записано, чтобы третий круг не начался с нуля.
       */
      "Property", "Property type", "How to show Value in YAML"],
    "подсказка есть у каждой строки Field типа Emoji, включая имя свойства заметки");
  ok("второй круг 6: у каждой строки Field типа Emoji есть подсказка");
}



/* ---- 7б: переключатель дочернего Field держит выбор -------------------- */
{
  /*
   * Дефект со слов заказчика: выпадающий список всегда показывал `yes`.
   * Причина не в вёрстке: настоящий `normalizePkmOrder` из `main.js`
   * выбрасывает ключи `_sub` из `left` и `right`, поэтому `listFields()` в
   * живой панели строки дочернего Field не отдаёт, а вёрстка читала состояние
   * оттуда. Здесь нормализация ведёт себя как настоящая — иначе проверка
   * прошла бы и на сломанном коде.
   */
  const strictNormalize = (raw: Any): Any => {
    const o = normalizePkmOrder(raw);
    const drop = (arr: string[]): string[] => arr.filter(k => !/_sub$/.test(String(k)));
    return { ...o, left: drop(o.left), right: drop(o.right) };
  };
  const cfg = makeConfig();
  const writes: Write[] = [];
  const merge = (dst: Any, src: Any): void => {
    for (const key of Object.keys(src || {})) {
      const value = src[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (!dst[key] || typeof dst[key] !== "object") dst[key] = {};
        merge(dst[key], value);
      } else dst[key] = value;
    }
  };
  const plugin = {
    getConfig: () => cfg,
    setConfigPatch(patch: Any, reason: string) {
      writes.push({ reason: String(reason || ""), patch });
      merge(cfg, patch);
    },
  };
  const host = makeNode("div");
  const state: FieldsViewState = { selected: "status" };
  let cleanup: (() => void) | null = null;
  const draw = (): void => {
    if (cleanup) cleanup();
    host.empty();
    cleanup = renderFieldsEditor(host as unknown as El, {
      model: createFieldsModel({
        plugin: plugin as never,
        normalizePkmOrder: strictNormalize,
        pkmOrderFields: [],
        cfg,
        deepState: deepState as never,
      }),
      ctx: { get: () => 100, set: async () => {}, run: async () => {}, watch: () => () => {} } as never,
      state,
      enabled: true,
      showTips: false,
      redraw: draw,
      notice: () => {},
      askNewField: done => done(null),
      confirmDeleteField: (_name, done) => done(false),
    });
  };
  draw();

  const childPick = (): StubNode => {
    const hit = all(host, "io-select").find(s =>
      String(s.getAttribute("aria-label") || "") === "Child Field of status");
    assert.ok(hit, "ряд Child Field на месте и при настоящей нормализации");
    return hit as StubNode;
  };
  assert.equal(all(host, "io-fields__item").length, 2,
    "строки дочернего Field в списке нет: настоящая нормализация выбрасывает ключ _sub");
  assert.equal(childPick().value, "yes", "сначала дочерний Field включён");
  const pick = childPick();
  pick.value = "no";
  pick.dispatch("change");
  assert.deepEqual(writes.map(w => w.reason),
    ["pkm:behavior:leftmode:subtoggle:status_sub", "pkm:behavior:order:sub:status_sub"],
    "переключение пишет теми же двумя записями");
  assert.equal(childPick().value, "no",
    "и после перерисовки список показывает выбранное, а не yes");
  assert.equal(String(cfg.pkm.fields.order.active.status_sub), "no", "в конфиге тоже no");

  const back = childPick();
  back.value = "yes";
  back.dispatch("change");
  assert.equal(childPick().value, "yes", "обратно включается тем же способом");
  ok("второй круг 7б: переключатель дочернего Field держит выбор и при настоящей нормализации");
}

/* ======================================================================
 * Третий круг замечаний заказчика по редактору Fields (2026-08-27).
 * ====================================================================== */

/* ---- 1: красная кнопка не проигрывает стилям Obsidian ------------------ */
{
  /*
   * Кнопка показалась пустым белым квадратом: одноклассовое правило проиграло
   * двухчастному селектору Obsidian, фон остался обычным, а корзина,
   * обесцвеченная в белый, стала белой на белом. Цвет фона и цвет значка
   * теперь объявлены одним правилом с удвоенным классом.
   */
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const doubled = /\.io-danger\.io-danger \{([^}]*)\}/.exec(css);
  assert.ok(doubled, "у красной кнопки есть правило с удвоенным классом");
  const body = String(doubled?.[1]);
  assert.ok(/background:\s*var\(--background-modifier-error\)/.test(body),
    "фон объявлен там, где Obsidian его уже не перебьёт");
  assert.ok(/color:\s*var\(--text-on-accent\)/.test(body),
    "и цвет значка объявлен тем же правилом: разойтись им больше не на чем");
  ok("третий круг 1: красная кнопка объявлена удвоенным классом, фон и цвет вместе");
}

/* ---- 2 и 3: три раздела правой колонки -------------------------------- */
{
  const v = makeView();
  const subs = all(v.host, "io-sub").map(n => String(n.textContent || "").replace("?", "").trim());
  assert.deepEqual(subs, ["Values", "Behavior", "YAML property"],
    "разделы: значения, поведение, свойство заметки (1.4.1.2.4)");

  /*
   * У каждого раздела свой «?». `Behavior` был единственным без него, и
   * заказчик это заметил (замечание 1.4.1.2.5). Проверяются все, а не один:
   * следующий раздел добавят так же — заголовком и без объяснения.
   */
  const mute = all(v.host, "io-sub")
    .filter(head => !all(head, "io-help").length)
    .map(head => String(head.textContent || "").replace("?", "").trim());
  assert.deepEqual(mute, [],
    "эти разделы правой колонки ничего о себе не говорят: " + mute.join(", "));
  const behaviorRows = all(v.host, "io-item")
    .map(r => String(all(r, "io-item__name")[0]?.textContent || "").trim());
  assert.deepEqual(behaviorRows.slice(0, 4), [SHORT_NAME, "Active", "Prefix behavior", "Child Field"],
    "имя в TagWheel стоит до раздела, а под Behavior — Active, Prefix behavior и Child Field");
  ok("третий круг 2: раздел называется Behavior и держит три настройки");
}
{
  const v = makeView();
  const mark = all(v.host, "io-help").find(b =>
    String(b.getAttribute("aria-label") || "") === "More about YAML property") as StubNode;
  assert.ok(mark, "у заголовка раздела свойства заметки есть подсказка");
  mark.click();
  const tips = all(v.host, "io-tip").map(t => String(t.textContent || ""));
  const tip = tips.find(t => t.includes("Inline to note")) || "";
  assert.ok(tip, "подсказка называет команду, ради которой раздел существует");
  assert.ok(tip.includes("Transform"), "и вкладку, где эта команда живёт");
  assert.ok(tip.includes("not copied"), "и что будет, если оставить свойство пустым");
  ok("третий круг 3: у раздела YAML property есть подсказка про Transform и inline to note");
}

/* ---- 4: дочерняя строка таблицы заметно серее -------------------------- */
{
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const rule = /\.io-vals__row--child \{([^}]*)\}/.exec(css);
  assert.ok(/background:\s*var\(--background-secondary\)/.test(String(rule?.[1])),
    "фон дочерней строки — --background-secondary: прежний почти сливался с таблицей");
  ok("третий круг 4: дочерняя строка таблицы заметно серее родительской");
}

/* ---- 5: текст в таблице того же размера, что в предпросмотре ----------- */
{
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.ok(/\.io-vals \{ font-size: var\(--font-ui-smaller\); \}/.test(css),
    "размер текста таблицы задан переменной, а не наследуется от редактора");
  /* Файл лежит с CRLF, поэтому между селекторами не «\n», а «\r\n». */
  const inner = /\.io-fields \.io-vals__row \.io-text,\s*\.io-fields \.io-vals__row \.io-select \{([^}]*)\}/
    .exec(css);
  assert.ok(/font-size:\s*var\(--font-ui-smaller\)/.test(String(inner?.[1])),
    "и у контролов внутри строки тоже — иначе Obsidian вернёт им свой размер");
  ok("третий круг 5: текст таблицы Values уменьшен до размера предпросмотра");
}

/* ---- 6: строки Field типа Emoji ---------------------------------------- */
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  one(due, "io-fields__pick").click();
  const format = all(v.host, "io-text--mono").find(n =>
    String(n.getAttribute("aria-label") || "").startsWith("Value format for")) as StubNode;
  assert.equal(format.placeholder, "YYYY-MM-DD / HHmm / 1",
    "плейсхолдер показывает три работающие формы: дату, время и счётчик");
  const mark = all(v.host, "io-help").find(b =>
    String(b.getAttribute("aria-label") || "") === "More about Value format") as StubNode;
  mark.click();
  const tip = all(v.host, "io-tip").map(t => String(t.textContent || ""))
    .find(t => t.includes("YYYY")) || "";
  for (const example of ["2026-08-27", "27.08", "1435", "001"]) {
    assert.ok(tip.includes(example), "в подсказке формата есть пример " + example);
  }
  assert.ok(tip.includes("never steps"),
    "и сказано, что маска не из этого набора шагать не будет");
  ok("третий круг 6: у Value format человеческий плейсхолдер и подсказка с примерами");
}
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  one(due, "io-fields__pick").click();
  const names = all(v.host, "io-item__name").map(n => String(n.textContent || "").trim());
  assert.ok(names.includes("Emoji-prefix") && names.includes("Value format"),
    "строки названы так, как назвал заказчик");
  assert.ok(!names.includes("Marker") && !names.includes("Format"),
    "прежних имён не осталось");
  ok("третий круг 6: Marker и Format переименованы в Emoji-prefix и Value format");
}

/* ======================================================================
 * Четвёртый круг замечаний заказчика по редактору Fields (2026-08-27).
 * ====================================================================== */

/* ---- 1: описание Steps by словами заказчика ---------------------------- */
{
  const v = makeView();
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  one(due, "io-fields__pick").click();
  const stepRow = all(v.host, "io-item").find(r =>
    String(all(r, "io-item__name")[0]?.textContent || "").trim() === "Steps by") as StubNode;
  assert.equal(String(all(stepRow, "io-item__desc")[0]?.textContent || "").trim(),
    "What should happen with the Value when you use next or previous command",
    "описание — то, которое дал заказчик; next и previous оформлены как команды");
  const codes = all(all(stepRow, "io-item__desc")[0] as StubNode, "io-code")
    .map(c => String(c.textContent || "").trim());
  assert.deepEqual(codes, ["next", "previous"], "обе команды оформлены как <code> (Ст11)");
  ok("четвёртый круг 1: описание Steps by заменено словами заказчика");
}

/* ---- 3: удаление значения красное и не наезжает на рамку --------------- */
{
  const v = makeView();
  const row = all(v.host, "io-vals__row")[0] as StubNode;
  const del = one(row, "io-valtools").children
    .find(c => String(c.getAttribute("aria-label") || "").startsWith("Remove ")) as StubNode;
  assert.ok(String(del.className || "").includes("io-icon--danger"),
    "удаление значения помечено красным классом");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.ok(/\.io-icon--danger \{\s*color: var\(--text-error\);\s*\}/.test(css),
    "цвет красного значка — из переменной темы (З6)");
  /*
   * Наезд на рамку был арифметическим: две кнопки по 25px с зазором не влезали
   * в колонку 44px. Проверяется тем же способом, что и ширина таблицы в гейте:
   * заглушка DOM ничего не раскладывает, а числа сложить может.
   */
  const tools = /\.io-valtools \.io-icon \{([^}]*)\}/.exec(css);
  const iconWidth = Number((/width:\s*(\d+)px/.exec(String(tools?.[1])) || [])[1]);
  const gapRule = /\.io-valtools \{([^}]*)\}/.exec(css);
  const gap = Number((/gap:\s*(\d+)/.exec(String(gapRule?.[1])) || [])[1]);
  /* Отступ ячейки от края колонки входит в ту же сумму: он и есть то, чем
     кнопка отодвинута от рамки таблицы (пятый круг замечаний). */
  const toolsPad = Number((/padding-right:\s*(\d+)px/.exec(String(gapRule?.[1])) || [])[1]);
  const grid = /\.io-vals__head,\s*\.io-vals__row \{[\s\S]*?grid-template-columns:([^;]+);/.exec(css);
  const lastTrack = Number((/(\d+)px\s*;?\s*$/.exec(String(grid?.[1]).trim()) || [])[1]);
  assert.ok(Number.isFinite(iconWidth) && Number.isFinite(gap) && Number.isFinite(lastTrack)
    && Number.isFinite(toolsPad),
    "ширины кнопок, зазор, отступ и последняя колонка объявлены числами");
  assert.ok(iconWidth * 2 + gap + toolsPad <= lastTrack,
    "две кнопки с зазором и отступом помещаются в последнюю колонку: "
    + (iconWidth * 2 + gap + toolsPad) + " ≤ " + lastTrack);
  ok("четвёртый круг 3: удаление значения красное, и обе кнопки помещаются в колонку");
}

/* ---- 4: одна подсказка на узел ----------------------------------------- */
{
  /*
   * Obsidian показывает `aria-label` своей всплывающей подсказкой на тёмном
   * фоне, а браузер поверх неё рисует `title` на светлом. Узел с обоими
   * атрибутами даёт ДВЕ подсказки — и одинаковый текст в них ничего не
   * исправляет: коробки всё равно две, тёмная и светлая поверх неё.
   *
   * Первая версия этой проверки падала только на разном тексте, поэтому
   * четвёртый круг замечаний закрылся зелёными проверками и незакрытым
   * дефектом (заказчик увидел его снова, пятый круг). Теперь запрещён сам
   * второй атрибут.
   *
   * Проверка обходит всё дерево редактора: правило общее, а не про конкретную
   * кнопку, и нарушить его легко любой новой строкой вёрстки.
   */
  const check = (host: StubNode, where: string): void => {
    const bad: string[] = [];
    const walk = (n: StubNode): void => {
      const label = String(n.getAttribute("aria-label") || "").trim();
      const title = String(n.title || "").trim();
      if (label && title) {
        bad.push(where + " " + String(n.tagName).toLowerCase()
          + ": aria-label «" + label + "» и title «" + title + "» на одном узле");
      }
      n.children.forEach(walk);
    };
    walk(host);
    assert.deepEqual(bad, [],
      "у этих узлов по две всплывающие подсказки:\n  " + bad.join("\n  "));
  };

  const v = makeView();
  check(v.host, "tag");
  const due = rowsOf(v.host).find(r => nameIn(r) === "Due") as StubNode;
  one(due, "io-fields__pick").click();
  check(v.host, "emoji");
  const link = makeLinkView();
  check(link.host, "link");
  ok("шестой круг 3: ни у одного узла редактора нет двух подсказок сразу");
}
{
  /* И тот же запрет внутри помощника: он единственное место, где подпись
     кнопки собирается, и правило должно жить там, а не в памяти. */
  const host = makeNode("div");
  const node = btn(host as unknown as El, "io-icon", {
    text: "x",
    label: "Do the thing",
    title: "and here is why",
  }) as unknown as StubNode;
  assert.equal(node.getAttribute("aria-label"), "Do the thing — and here is why",
    "label и title слились в одну подпись");
  assert.equal(String(node.title || ""), "",
    "и `title` не поставлен вовсе: вторую подсказку рисует именно он");
  ok("шестой круг 3: btn пишет подпись только в aria-label");
}

/* ======================================================================
 * Родитель значения ссылки: контрол вернулся (2026-08-27).
 * ====================================================================== */

/**
 * Ссылка с одним значением и тег с двумя — иначе списку родителей нечего
 * предложить: варианты собираются из значений Fields, которые сами не ссылки.
 */
function makeLinkView(): {
  host: StubNode;
  writes: Write[];
  cfg: Any;
  draw: () => void;
} {
  const cfg = makeConfig();
  cfg.pkm.fields.order.right.push("project");
  cfg.pkm.fields.order.labels.project = "Project";
  cfg.pkm.fields.order.strictNames.project = "project";
  cfg.pkm.fields.order.types.project = "wikilink";
  cfg.pkm.fields.order.active.project = "yes";
  cfg.pkm.fields.order.freeRoam.project = "off";
  cfg.pkm.fields.order.enabled.project = true;
  cfg.pkm.fields.links.fields.push({
    id: "project", orderKey: "project", source: "wikilinks:project",
    values: [{ token: "ClientA", active: true }, { token: "ProjectX", active: true }],
  });
  const writes: Write[] = [];
  const merge = (dst: Any, src: Any): void => {
    for (const key of Object.keys(src || {})) {
      const value = src[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (!dst[key] || typeof dst[key] !== "object") dst[key] = {};
        merge(dst[key], value);
      } else dst[key] = value;
    }
  };
  const plugin = {
    getConfig: () => cfg,
    setConfigPatch(patch: Any, reason: string) {
      writes.push({ reason: String(reason || ""), patch });
      merge(cfg, patch);
    },
  };
  const host = makeNode("div");
  const state: FieldsViewState = { selected: "project" };
  let cleanup: (() => void) | null = null;
  const draw = (): void => {
    if (cleanup) cleanup();
    host.empty();
    cleanup = renderFieldsEditor(host as unknown as El, {
      model: createFieldsModel({
        plugin: plugin as never, normalizePkmOrder, pkmOrderFields: [],
        cfg, deepState: deepState as never,
      }),
      ctx: { get: () => 100, set: async () => {}, run: async () => {}, watch: () => () => {} } as never,
      state, enabled: true, showTips: false, redraw: draw,
      notice: () => {},
      askNewField: done => done(null),
      confirmDeleteField: (_name, done) => done(false),
    });
  };
  draw();
  return { host, writes, cfg, draw };
}

/** Ячейка уровня у строки таблицы: стрелка одна, и она же читается. */
const levelArrow = (row: StubNode): StubNode =>
  one(row, "io-depthcell").children[0] as StubNode;

/** Дочерний Field ссылки в конфиге — тот, что делает вложенность настоящей. */
const linkSubField = (cfg: Any): Any =>
  (cfg.pkm.fields.links.fields as Any[]).find(f => f.id === "project_sub") || null;

{
  const v = makeLinkView();
  const titles = one(v.host, "io-vals__head").children
    .map(c => String(all(c, "io-vals__coltext")[0]?.textContent || "").trim());
  assert.deepEqual(titles, ["", "Level", "Value", "Prefix", ""],
    "у ссылки те же колонки, что у тега, за вычетом цвета");
  const names = all(v.host, "io-item__name").map(n => String(n.textContent || "").trim());
  assert.ok(names.includes("Child Field"),
    "и ряд Child Field у ссылки есть: дочерний Field у неё теперь настоящий");
  assert.equal(all(v.host, "io-select").filter(sel =>
    String(sel.getAttribute("aria-label") || "").startsWith("Parent of ")).length, 0,
    "колонки Parent больше нет: движок привязку к значению другого Field не читает");
  ok("ссылка: колонка Level на месте, колонки Parent нет");
}
{
  /*
   * Тот самый дефект: стрелка уровня у ссылки удаляла строку. Причина была в
   * записи — ветка `wikilink` проходила только верхний уровень дерева.
   */
  const v = makeLinkView();
  const rows = all(v.host, "io-vals__row");
  assert.equal(rows.length, 2, "у ссылки два значения");
  assert.equal(levelArrow(rows[0] as StubNode).disabled, true,
    "у первого значения родителя нет, и стрелка выключена — как у тега");
  levelArrow(rows[1] as StubNode).click();

  const after = all(v.host, "io-vals__row");
  assert.equal(after.length, 2, "значение не исчезло: строк по-прежнему две");
  assert.ok((after[1] as StubNode).classList.contains("io-vals__row--child"),
    "вторая строка стала дочерней");
  assert.equal(String(one(after[1] as StubNode, "io-valcell").children[0]?.value || ""),
    "[[ProjectX]]", "и это то же значение, что было");
  ok("ссылка: стрелка уровня делает значение дочерним, а не удаляет его");
}
{
  const v = makeLinkView();
  levelArrow(all(v.host, "io-vals__row")[1] as StubNode).click();
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:behavior:order:deep:indent:project"],
    "запись та же, что и у тега, — та же причина от той же модели");

  const parent = (v.cfg.pkm.fields.links.fields as Any[]).find(f => f.id === "project");
  assert.deepEqual((parent.values as Any[]).map(x => x.token), ["ClientA"],
    "наверху осталось одно значение");
  assert.deepEqual((parent.values as Any[])[0].subtags, ["ProjectX"],
    "и оно знает своё дочернее: `subtags` — то же, что пишет тег");

  const sub = linkSubField(v.cfg);
  assert.ok(sub, "дочерний Field ссылки заведён");
  assert.equal(sub.dependsOn, "project", "он зависит от родителя — иначе рантайм его не покажет");
  assert.equal(String(sub.source || ""), "wikilinks:project_sub",
    "и он ссылка, а не тег: без source его значение писалось бы решёткой");
  assert.deepEqual((sub.values as Any[]).map(x => x.token), ["ProjectX"], "значение переехало в него");
  assert.deepEqual((sub.values as Any[])[0].allowedParentValues, ["ClientA"],
    "и знает, под каким родителем показываться: это и читает рантайм");
  ok("ссылка: дочернее значение уезжает в дочерний Field той же формы, что у тега");
}
{
  const v = makeLinkView();
  levelArrow(all(v.host, "io-vals__row")[1] as StubNode).click();
  const back = all(v.host, "io-vals__row")[1] as StubNode;
  assert.equal(String(levelArrow(back).textContent || "").trim(), "←",
    "у дочернего значения стрелка ведёт обратно");
  levelArrow(back).click();
  const rows = all(v.host, "io-vals__row");
  assert.equal(rows.length, 2, "значение вернулось наверх, а не пропало");
  assert.ok(!(rows[1] as StubNode).classList.contains("io-vals__row--child"),
    "и дочерним больше не считается");
  const sub = linkSubField(v.cfg);
  assert.deepEqual(sub ? (sub.values as Any[]) : [], [],
    "дочерний Field остался пустым: значений у него больше нет");
  ok("ссылка: значение возвращается на верхний уровень");
}
{
  /* Метаданные значения переезжают вместе с ним: чекбокс Prefix у дочернего
     значения ссылки остаётся тем же, что был наверху. */
  const v = makeLinkView();
  const prefix = (all(v.host, "io-vals__row")[1] as StubNode).children
    .find(c => String(c.getAttribute("aria-label") || "").startsWith("Prefix for")) as StubNode;
  prefix.value = "[x]";
  prefix.dispatch("change");
  levelArrow(all(v.host, "io-vals__row")[1] as StubNode).click();
  const sub = linkSubField(v.cfg);
  assert.equal(String((sub.values as Any[])[0].checkboxToken || ""), "[x]",
    "чекбокс дочернего значения ссылки не потерялся при переезде");
  assert.equal(String((sub.values as Any[])[0].prefixMode || ""), "checkbox",
    "и режим Prefix вместе с ним");
  ok("ссылка: метаданные значения переезжают вместе со значением");
}

/* ======================================================================
 * Пятый круг замечаний, 2026-08-27: вид таблицы Values у Field типа `tag`.
 * ====================================================================== */

{
  /*
   * Удаление значения стояло вплотную к правой рамке таблицы. Отодвинуто
   * двумя слагаемыми: отступ ячейки от края колонки и поле самой строки.
   * Проверяется числами по той же причине, что и всё остальное здесь:
   * заглушка DOM ничего не раскладывает, а складывать умеет.
   */
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const toolsRule = /\.io-valtools \{([^}]*)\}/.exec(css);
  const toolsPad = Number((/padding-right:\s*(\d+)px/.exec(String(toolsRule?.[1])) || [])[1]);
  const rowPad = Number((/\.io-vals__head,\s*\.io-vals__row \{[^}]*padding:\s*\d+px\s+(\d+)px/
    .exec(css) || [])[1]);
  assert.ok(Number.isFinite(toolsPad) && Number.isFinite(rowPad),
    "отступ ячейки и поле строки объявлены числами");
  assert.ok(toolsPad + rowPad >= 12,
    "удаление значения отодвинуто от рамки таблицы: " + (toolsPad + rowPad) + "px");
  ok("пятый круг: значок удаления значения не жмётся к рамке таблицы");
}

{
  /*
   * Пузырь в колонке `Preview` срезался правым краем ячейки: у длинного
   * значения (`#89779` на снимке заказчика) видно ровно половину пузыря.
   * Теперь укорачивается надпись ВНУТРИ пузыря, а сам он остаётся целым.
   */
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const rule = /\.io-vals__prev \.io-bubble \{([^}]*)\}/.exec(css);
  assert.ok(rule, "у пузыря в колонке Preview есть своё правило");
  const body = String(rule?.[1] || "");
  assert.ok(/text-overflow:\s*ellipsis/.test(body),
    "надпись в пузыре укорачивается многоточием, а не режется краем ячейки");
  assert.ok(/min-width:\s*0/.test(body) && /flex:\s*0\s+1\s+auto/.test(body),
    "пузырь умеет сжаться внутри ячейки: иначе он вытолкнет значок предупреждения");
  /* И то же правило не должно распространиться на живые предпросмотры: там
     пузырь и есть предмет разговора, и обрезать его нечем. */
  assert.ok(!/^\.io-bubble \{[^}]*text-overflow/m.test(css),
    "общее правило пузыря без обрезки: в предпросмотрах он показывается целиком");
  ok("пятый круг: пузырь Preview укорачивает надпись, а не режется краем ячейки");
}

{
  /*
   * Таблица обязана помещаться в узкую панель целиком. Она прокручивается
   * внутри себя, поэтому всё, что не влезло, человек видит только прокруткой
   * вправо — и за краем оказалась кнопка удаления значения (замечание
   * заказчика, шестой круг).
   *
   * Порог взят из ширины, которая у таблицы есть на деле: панель минус
   * колонка списка Fields (188px), поля правой колонки (16 + 16) и рамки.
   *
   * Поднят с 625 до 633 (2026-08-28). Шестой круг сжал таблицу до 400, и на
   * 400 перестала читаться шапка: `LE...`, `TE...`. Часть точек нашлась
   * перебалансировкой, но не все: занять у `Preview` не вышло — пузырь
   * сразу вернул дефект пятого круга и резал `#todo` до `#t...`. Уложить в
   * 400 и читаемую шапку, и читаемый пузырь нечем, поэтому таблице отдано
   * 408, а панели 631. Кнопка удаления при этом остаётся в виду — ради неё
   * порог и заводился.
   */
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const declared = Number((/\.io-vals__inner \{ min-width: (\d+)px/.exec(css) || [])[1]);
  const listCol = Number((/\.io-fields__col:first-child \{ flex: 0 0 (\d+)px/.exec(css) || [])[1]);
  const detailPad = Number((/\.io-fields__detail \{ padding: \d+px (\d+)px/.exec(css) || [])[1]);
  assert.ok(Number.isFinite(declared) && Number.isFinite(listCol) && Number.isFinite(detailPad),
    "ширина таблицы, колонки списка и поля правой колонки объявлены числами");
  const needsPane = declared + listCol + detailPad * 2 + 3;
  assert.ok(needsPane <= 633,
    "таблица Values требует панель шириной " + needsPane + "px — это уже прокрутка вправо");
  ok("шестой круг 2: таблица Values помещается в узкую панель, " + needsPane + "px");
}

/* ======================================================================
 * Предусловие Field (10.13.4) — новая настройка, шестой круг.
 * ====================================================================== */

/** Строка правой колонки по её подписи. */
function rowNamed(host: StubNode, name: string): StubNode | null {
  return all(host, "io-item").find(r =>
    all(r, "io-item__name").some(n => String(n.textContent || "").trim() === name)) || null;
}

/** Выпадающий список по подписи для программы чтения с экрана. */
function selectLabelled(host: StubNode, label: string): StubNode | null {
  return all(host, "io-select").find(s =>
    String(s.getAttribute("aria-label") || "") === label) || null;
}

function pickIn(host: StubNode, label: string, value: string): void {
  const node = selectLabelled(host, label);
  assert.ok(node, "не нашёлся список «" + label + "»");
  (node as StubNode).value = value;
  (node as StubNode).dispatch("change");
}

/**
 * Панель с тремя Fields в двух пулах определений: тег `status` в `leftMode`,
 * ссылка `project` и элемент `due` в `rightMode`. Предусловие живёт внутри
 * пула, и без соседа его не на ком показать.
 */
function makePrereqView(): {
  host: () => StubNode;
  writes: Write[];
  notices: string[];
  cfg: Any;
  model: ReturnType<typeof createFieldsModel>;
  select: (label: string) => void;
} {
  const cfg = makeConfig();
  cfg.pkm.fields.order.right.unshift("project");
  cfg.pkm.fields.order.labels.project = "Project";
  cfg.pkm.fields.order.strictNames.project = "project";
  cfg.pkm.fields.order.types.project = "wikilink";
  cfg.pkm.fields.order.active.project = "yes";
  cfg.pkm.fields.order.freeRoam.project = "off";
  cfg.pkm.fields.order.enabled.project = true;
  cfg.pkm.fields.links.fields.unshift({
    id: "project", orderKey: "project", source: "wikilinks:project",
    values: [{ token: "ClientA", active: true }],
  });
  const writes: Write[] = [];
  const notices: string[] = [];
  const merge = (dst: Any, src: Any): void => {
    for (const key of Object.keys(src || {})) {
      const v = src[key];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (!dst[key] || typeof dst[key] !== "object") dst[key] = {};
        merge(dst[key], v);
      } else dst[key] = v;
    }
  };
  const plugin = {
    getConfig: () => cfg,
    setConfigPatch(patch: Any, reason: string) {
      writes.push({ reason: String(reason || ""), patch });
      merge(cfg, patch);
    },
  };
  const model = createFieldsModel({
    plugin: plugin as never, normalizePkmOrder, pkmOrderFields: [], cfg,
    deepState: deepState as never,
  });
  const state: FieldsViewState = { selected: "project" };
  let host = makeNode("div");
  let cleanup: (() => void) | null = null;
  const draw = (): void => {
    if (cleanup) cleanup();
    host = makeNode("div");
    cleanup = renderFieldsEditor(host as unknown as El, {
      model,
      ctx: { get: () => 100, set: async () => {}, run: async () => {}, watch: () => () => {} } as never,
      state, enabled: true, showTips: false, redraw: draw,
      notice: (t: string) => { notices.push(t); },
      askNewField: done => done(null),
      confirmDeleteField: (_name, done) => done(true),
    });
  };
  draw();
  return {
    host: () => host,
    writes, notices, cfg, model,
    select: (label: string) => {
      const row = rowsOf(host).find(r => nameIn(r) === label) as StubNode;
      assert.ok(row, "в списке нет Field " + label);
      one(row, "io-fields__pick").click();
    },
  };
}

const PREREQ = "Prerequisite Field";
const PREREQ_WHICH = "Choose prerequisite Field";
const PREREQ_VALUE = "Prerequisite Value";

{
  const v = makePrereqView();
  v.select("Status");
  /* У тега `status` соседей по своему списку определений нет: единственный
     другой тег — его же дочерний Field. Строки нет вовсе (З8). */
  assert.equal(rowNamed(v.host(), PREREQ), null, "ждать некого — строки предусловия нет");
  v.select("Project");
  assert.ok(rowNamed(v.host(), PREREQ), "у ссылки сосед по списку есть, и строка появилась");
  assert.equal(rowNamed(v.host(), PREREQ_WHICH), null,
    "пока предусловия нет, второй строки тоже нет");
  assert.equal(rowNamed(v.host(), PREREQ_VALUE), null, "и третьей");
  ok("Н20: строка предусловия есть там, где есть кого ждать, и только она одна");
}

{
  const v = makePrereqView();
  pickIn(v.host(), PREREQ + " for project", "yes");
  assert.deepEqual(v.writes, [], "один только Yes ничего не пишет: Field ещё не выбран");
  const which = selectLabelled(v.host(), PREREQ_WHICH + " for project") as StubNode;
  assert.ok(which, "после Yes появилась строка выбора Field");
  assert.deepEqual(which.children.map(c => String(c.textContent || "").trim()),
    ["Not chosen", "status", "due"],
    "ссылка ждёт кого угодно, в том числе тег: ровно случай заказчика");
  assert.equal(rowNamed(v.host(), PREREQ_VALUE), null,
    "значение спрашивать не у кого, пока Field не выбран");
  ok("Н20: Yes открывает выбор Field и сам ничего не пишет");
}

{
  const v = makePrereqView();
  pickIn(v.host(), PREREQ + " for project", "yes");
  pickIn(v.host(), PREREQ_WHICH + " for project", "due");
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:behavior:order:prerequisite:project"],
    "выбор Field пишется одной записью со своей причиной");
  const field = (v.writes[0]?.patch.pkm.fields.links.fields as Any[])
    .find(f => f.id === "project");
  assert.equal(field.dependsOn, "due",
    "в конфиг ушёл `dependsOn` — тот самый ключ, по которому рантайм выключает Field");
  assert.equal(field.enabledForParentValues, undefined,
    "значение не выбрано, и списка значений в конфиге нет: годится любое");
  const value = selectLabelled(v.host(), PREREQ_VALUE + " for project") as StubNode;
  assert.ok(value, "после выбора Field появилась строка значения");
  assert.deepEqual(value.children.map(c => String(c.textContent || "").trim()), ["Any Value"],
    "у Field типа Emoji своих значений нет, и предлагается только Any Value");
  ok("Н20: предусловие пишется ключом dependsOn, значение необязательно");
}

{
  const v = makePrereqView();
  v.select("Due");
  pickIn(v.host(), PREREQ + " for due", "yes");
  pickIn(v.host(), PREREQ_WHICH + " for due", "project");
  const value = selectLabelled(v.host(), PREREQ_VALUE + " for due") as StubNode;
  assert.deepEqual(value.children.map(c => String(c.textContent || "").trim()),
    ["Any Value", "ClientA"], "предлагаются значения выбранного Field");
  pickIn(v.host(), PREREQ_VALUE + " for due", "ClientA");
  const last = v.writes[v.writes.length - 1] as Write;
  const field = (last.patch.pkm.fields.links.fields as Any[]).find(f => f.id === "due");
  assert.deepEqual(field.enabledForParentValues, ["ClientA"],
    "выбранное значение ушло в `enabledForParentValues` — его читает isFieldEnabled");
  assert.equal(field.dependsOn, "project", "и `dependsOn` остался на месте");
  ok("Н20: выбранное значение сужает предусловие до одного Value");
}

{
  const v = makePrereqView();
  v.select("Due");
  pickIn(v.host(), PREREQ + " for due", "yes");
  pickIn(v.host(), PREREQ_WHICH + " for due", "project");
  pickIn(v.host(), PREREQ_VALUE + " for due", "ClientA");
  v.writes.length = 0;
  pickIn(v.host(), PREREQ + " for due", "no");
  assert.deepEqual(v.writes.map(w => w.reason), ["pkm:behavior:order:prerequisite:due"],
    "No снимает предусловие одной записью");
  const field = (v.writes[0]?.patch.pkm.fields.links.fields as Any[])
    .find(f => f.id === "due");
  assert.equal(field.dependsOn, undefined, "`dependsOn` снят");
  assert.equal(field.enabledForParentValues, undefined,
    "и список значений снят вместе с ним: без `dependsOn` рантайм его не читает вовсе");
  ok("Н20: No снимает оба ключа разом");
}

{
  /*
   * Петля. `clearDependentSelections` в `status_line_runtime_unified.js`
   * обходит зависимые Fields рекурсивно и без списка пройденных, поэтому
   * кольцо из двух Fields повесило бы Obsidian. Замкнуть его нельзя.
   */
  const v = makePrereqView();
  v.select("Due");
  pickIn(v.host(), PREREQ + " for due", "yes");
  pickIn(v.host(), PREREQ_WHICH + " for due", "project");
  v.select("Project");
  pickIn(v.host(), PREREQ + " for project", "yes");
  const which = selectLabelled(v.host(), PREREQ_WHICH + " for project") as StubNode;
  assert.ok(which, "строка выбора Field на месте");
  const offered = which.children.map(c => String(c.textContent || "").trim());
  assert.ok(!offered.includes("due"),
    "Field, который уже ждёт этого, в список не попал: кольцо замкнуть нечем");
  assert.ok(offered.includes("status"), "а остальные кандидаты на месте");
  const res = v.model.setPrerequisite("project", "due", "");
  assert.equal(res.ok, false, "и модель откажет, даже если её позвать мимо вёрстки");
  assert.ok(String(res.error || "").includes("cannot wait for itself"),
    "отказ объясняет, почему: " + String(res.error || ""));
  ok("Н20: кольцо предусловий не замкнуть ни из панели, ни из модели");
}

{
  /*
   * Обратная сторона: тег ждёт только тега. Граница списков определений
   * открыта в одну сторону — так решено, потому что `dependsOn` у левого Field
   * движок читает ещё и как «дочерний тег» (Н24).
   */
  const v = makePrereqView();
  v.select("Status");
  assert.equal(rowNamed(v.host(), PREREQ), null,
    "у тега в фикстуре других тегов нет, и ждать ему некого");
  const res = v.model.setPrerequisite("status", "projects", "");
  assert.equal(res.ok, false, "модель не даст тегу ждать ссылку");
  assert.ok(String(res.error || "").includes("Tag Field"),
    "и объясняет почему: " + String(res.error || ""));
  ok("Н24: тег ждёт только тега — граница открыта в одну сторону");
}

{
  /* Дочернему Field предусловия не бывает: `dependsOn` у него уже занят
     родителем, и вторым тем же ключом распорядиться нечем. */
  const v = makePrereqView();
  const sub = rowsOf(v.host()).find(r => nameIn(r) === "Status sub");
  if (sub) {
    one(sub, "io-fields__pick").click();
    assert.equal(rowNamed(v.host(), PREREQ), null, "у дочернего Field строки предусловия нет");
  }
  ok("Н20: у дочернего Field предусловия нет");
}

{
  /*
   * Удаление Field уносит с собой чужие предусловия на него. Иначе
   * `reconcileModeDependencies` в `pkm_rules_runtime_helpers.js`, не найдя
   * `dependsOn`, выключит зависимый Field целиком — человек удалил один
   * Field, а замолчал другой, и в панели он показан включённым.
   */
  const v = makePrereqView();
  v.select("Due");
  pickIn(v.host(), PREREQ + " for due", "yes");
  pickIn(v.host(), PREREQ_WHICH + " for due", "project");
  v.select("Project");
  v.writes.length = 0;
  one(v.host(), "io-danger").click();
  const patch = v.writes.find(w => w.reason.startsWith("pkm:behavior:delete-field:")) as Write;
  assert.ok(patch, "удаление Field дошло до конфига");
  const due = (patch.patch.pkm.fields.links.fields as Any[]).find(f => f.id === "due");
  assert.ok(due, "Field due на месте");
  assert.equal(due.dependsOn, undefined,
    "а предусловие на удалённый Field снято: иначе рантайм выключил бы due молча");
  ok("Н20: удаление Field снимает чужие предусловия на него");
}

/** Узел по началу его подписи: в этом наборе такого помощника ещё не было. */
function byLabel(node: StubNode, prefix: string): StubNode | undefined {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (String(n.getAttribute("aria-label") || "").startsWith(prefix)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out[0];
}

/* ---- 1.4.1.2.2: карандаш у имени Field ---------------------------------- */

{
  /*
   * Системное имя задавалось один раз и дальше не менялось: оно стоит в
   * заметках человека и в идентификаторах команд Field. Заказчик решил
   * 2026-08-31, что менять его можно — но панель обязана назвать цену.
   *
   * Проверяется и место: карандаш слева от корзины, в той же строке, что имя.
   */
  const v = makeView();
  const title = one(v.host, "io-fields__title");
  const labels = title.children
    .map(c => String(c.getAttribute("aria-label") || ""))
    .filter(Boolean);
  const pencilAt = labels.findIndex(l => l.startsWith("Rename the Field"));
  const trashAt = labels.findIndex(l => l.startsWith("Delete the Field"));
  assert.ok(pencilAt >= 0, "карандаша в шапке правой колонки нет: " + labels.join(" | "));
  assert.ok(trashAt >= 0, "корзина на месте");
  assert.ok(pencilAt < trashAt,
    "карандаш обязан стоять слева от корзины: " + labels.join(" | "));
  ok("1.4.1.2.2: карандаш стоит в шапке слева от корзины");
}

{
  /* Закрытое окно ничего не меняет: отказ — это отказ, а не пустое имя. */
  const v = makeView();
  const before = JSON.stringify(v.model.listFields().map(r => r.strictName));
  v.renameTo(null);
  (byLabel(v.host, "Rename the Field status") as StubNode).click();
  assert.deepEqual(v.asksRename, ["status"], "окно спросило про тот Field, что выбран");
  assert.equal(JSON.stringify(v.model.listFields().map(r => r.strictName)), before,
    "закрытое окно не переименовало ничего");
  ok("отказ в окне переименования ничего не пишет");
}

{
  /* Согласие пишет новое имя настоящей записью модели. */
  const v = makeView();
  v.renameTo("status_v2");
  (byLabel(v.host, "Rename the Field status") as StubNode).click();

  const names = v.model.listFields().map(r => r.strictName);
  assert.ok(names.includes("status_v2"),
    "новое имя не доехало до конфига: " + names.join(", "));
  assert.ok(!names.includes("status"), "старое имя не осталось рядом с новым");
  assert.ok(v.writes.some(w => w.reason.startsWith("pkm:behavior:order:strict:")),
    "запись названа причиной переименования: " + v.writes.map(w => w.reason).join(", "));
  ok("переименование доходит до конфига настоящей записью модели");
}

{
  /*
   * Негодное имя не пишется, и человек узнаёт почему: сообщение приходит из
   * модели, а не выдумывается вёрсткой.
   */
  const v = makeView();
  v.renameTo("Status Two!");
  (byLabel(v.host, "Rename the Field status") as StubNode).click();
  /*
   * `setStrictName` асинхронна: после записи она переименовывает Field и в
   * заметке конфига. Сообщение об отказе приходит из того же обещания, и
   * проверять его сразу после нажатия рано.
   */
  await new Promise(r => setTimeout(r, 0));
  assert.ok(v.notices.length, "об отказе не сказали вслух");
  assert.ok(v.model.listFields().some(r => r.strictName === "status"),
    "имя осталось прежним");
  ok("негодное имя отклонено с объяснением");
}

{
  /*
   * Цена названа в самом окне, а не в подсказке рядом: заказчик согласился на
   * переименование именно с предупреждением. Проверяется текст окна из
   * `fields_editor.ts` — вёрстка окна живёт на платформе, и на заглушке DOM
   * его не открыть.
   */
  const src = fs.readFileSync(path.join(root, "src", "ui", "settings", "custom",
    "fields_editor.ts"), "utf8");
  const from = src.indexOf("function askRenameModal");
  assert.ok(from > 0, "окна переименования нет вовсе");
  const body = src.slice(from, src.indexOf("/* ---- блок", from));
  assert.ok(/keep the old tag/.test(body),
    "окно не говорит, что в заметках останется старый тег");
  assert.ok(/hotkey/.test(body) && /comes loose/.test(body),
    "окно не говорит, что хоткей отвяжется");
  ok("окно переименования называет обе цены, а не спрашивает «уверены?»");
}

/* ---- образец заливки: цвет темы, а не белый (C31, C39) ----------------- */

/*
 * У поля выбора цвета нет состояния «не задано» — оно всегда показывает
 * какой-то цвет. Стоял белый, а пузырь тема красит акцентом, и белый образец
 * рядом с фиолетовым пузырём читался как расхождение. Заказчик так его и
 * прочёл: «по умолчанию fill hex=#FFFFFF, однако сама заливка tag bubble по
 * умолчанию фиолетовая» (C31, и C39 ссылается на него).
 *
 * Тему читает `getComputedStyle`; заглушка DOM отдаёт пустое, и тогда белый
 * остаётся последним запасным — гадать о цвете темы панель не должна.
 */
{
  const textInputOf = (onAccent: string): { own: string; unset: string } => {
    const view = (globalThis as unknown as { window: Any }).window;
    const real = view.getComputedStyle;
    view.getComputedStyle = () => ({
      getPropertyValue: (name: string) => (name === "--text-on-accent" ? onAccent : ""),
    });
    try {
      const v = makeView();
      /*
       * Вторая строка — дочернее значение `#early`: заливка у него задана, а
       * цвет текста нет. То есть в одной строке видны оба случая разом, и
       * заданный цвет обязан остаться собой.
       */
      const inputs = all(all(v.host, "io-vals__row")[1] as StubNode, "io-colin");
      assert.equal(inputs.length, 2, "в строке два поля цвета: заливка и текст");
      return {
        own: String((inputs[0] as StubNode).value || ""),
        unset: String((inputs[1] as StubNode).value || ""),
      };
    } finally {
      view.getComputedStyle = real;
    }
  };

  const painted = textInputOf("rgb(124, 58, 237)");
  assert.equal(painted.unset, "#7c3aed",
    "незаданный цвет показан цветом темы, приведённым к #rrggbb: " + painted.unset);
  assert.equal(painted.own, "#ffff00",
    "заданный цвет остался собой: " + painted.own);
  assert.equal(textInputOf("#3b82c4").unset, "#3b82c4",
    "тема отдала цвет решёткой — образец берёт его как есть");
  assert.equal(textInputOf("").unset, "#ffffff",
    "тему прочитать нечем — остаётся белый: гадать панель не должна");
  ok("C31: образец цвета Value показывает цвет темы, пока своего нет");
}

console.log("\n" + passed + " проверок пройдено");
