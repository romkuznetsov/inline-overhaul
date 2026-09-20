/**
 * Значение поля-ссылки, показанное своим текстом (его заказ 2026-09-20,
 * пункт 14: «добавить для field=link в таблицы io-values колонку
 * io-values-col-show… при нажатии на этот заменённый элемент должна
 * открываться соответствующая wikilink»).
 *
 * **Что здесь закреплено и почему именно это.**
 *
 *   1. *Ключ вида у ссылки один на панель и на заметку.* Панель пишет вид по
 *      ключу `[[имя]]`, и тем же ключом его ищет слой оформления. Разойдись
 *      они — настройка писалась бы в один ключ, а читалась из другого, и не
 *      работала бы никогда, молча (У-216: шов обязан переносить, а не
 *      перечислять). Поэтому спрашиваются **обе стороны** шва.
 *   2. *Замена случается только при `custom` с непустым текстом.* При
 *      `default` ссылка остаётся ссылкой Obsidian — со своим кликом,
 *      наведением и перетаскиванием. Это отрицательный контроль к первому
 *      утверждению: без него «вид доезжает» выполнялось бы и кодом, который
 *      заменяет ссылку всегда.
 *   3. *Клик открывает ту самую заметку.* Ради него замена и делается: правило
 *      И-2.2 запрещало трогать ссылку именно потому, что клик вернуть было
 *      нечем. Проверяется тем же вызовом платформы, каким его делает Obsidian
 *      (`workspace.openLinkText`), и с модификатором — им человек открывает
 *      заметку в новой вкладке.
 *
 * Подделан DOM и рабочая область Obsidian: виджет живёт в редакторе, и другого
 * способа посмотреть на его узел и его клик вне Obsidian нет (У-1). Сам виджет,
 * карты видов и правило ключа — настоящие, из `main.js`.
 */

import assert from "node:assert/strict";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import sharedUtils from "../../src/core/shared_utils.js";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;
const I = loadPluginInternals();

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok " + what); };

/** Конфиг с полем-ссылкой и полем-тегом: обе корзины заполнены. */
function makeConfig(over?: Any): Any {
  const cfg = I.migrateConfig({
    schemaVersion: 1,
    pkm: {
      behavior: {
        order: {
          left: ["status"],
          right: ["project"],
          labels: { status: "Status", project: "Project" },
          strictNames: { status: "status", project: "project" },
          types: { status: "tag", project: "wikilink" },
          active: { status: "yes", project: "yes" },
          enabled: { status: true, project: true },
        },
        leftMode: { fields: [{ id: "status", orderKey: "status", prefix: "#", values: [{ token: "#todo" }] }] },
        io: { separator1: "||", separator2: "||" },
      },
    },
  }) as Any;
  /* Значения поля-ссылки лежат голыми именами — так их пишет панель. */
  const links = cfg.pkm.fields.links.fields as Any[];
  const project = links.find((f: Any) => String(f.id) === "project");
  assert.ok(project, "в конфиге не оказалось поля-ссылки — фикстура не о том");
  project.values = [{ token: "test1" }, { token: "test2" }];
  if (over) Object.assign(cfg.visual.tags.byTag, over);
  return cfg;
}

/* ---- 1. шов: чем панель пишет, тем слой и ищет -------------------------- */

{
  /*
   * Ключ вида ссылки строит один помощник, и зовут его обе стороны. Здесь
   * спрашивается не «одинаково ли они написаны», а **сходятся ли ответы**:
   * ключ, построенный от значения таблицы, обязан оказаться в карте, которую
   * собирает слой оформления из того же конфига.
   */
  const key = String(sharedUtils.wikilinkVisualToken("test1"));
  assert.equal(key, "[[test1]]", "ключ вида ссылки собран не так: " + key);
  assert.equal(sharedUtils.wikilinkVisualToken("[[test1]]"), key,
    "готовая ссылка вторых скобок не получает");
  assert.equal(sharedUtils.wikilinkVisualToken("#test1"), key,
    "решётка старой формы в ключ не идёт");
  assert.equal(sharedUtils.wikilinkVisualToken("  "), "", "пустое значение ключа не даёт");

  const cfg = makeConfig({ project: { "[[test1]]": { visibility: "custom", customText: "👤" } } });
  const fieldMap = I.buildFieldTagVisualMap(cfg);
  assert.ok(Object.prototype.hasOwnProperty.call(fieldMap, key),
    "ключа ссылки нет в карте видов: слой оформления настройку не найдёт");
  const row = I.readTagVisualRowByTokenMaps(key, fieldMap, {}, I.buildGlobalTagVisualMap(cfg));
  assert.ok(row, "вид ссылки не прочитался");
  assert.equal(I.resolveEffectiveTagVisualMode(row), "custom", "режим ссылки прочитан не как custom");
  assert.equal(String(row.customText), "👤", "текст ссылки прочитан не тот");
  ok("шов: ключ, которым панель пишет вид ссылки, находит слой оформления");
}

{
  /*
   * **Отрицательный контроль к шву** (правило 125): карта не должна называть
   * ссылкой что попало. Тег в неё приходит своим ключом, и скобочного у него
   * не появляется.
   */
  const cfg = makeConfig({ status: { "#todo": { visibility: "custom", customText: "✅" } } });
  const fieldMap = I.buildFieldTagVisualMap(cfg);
  assert.ok(Object.prototype.hasOwnProperty.call(fieldMap, "#todo"), "тег потерялся из карты видов");
  const bracketed = Object.keys(fieldMap).filter((k) => k.indexOf("[[") === 0);
  assert.deepEqual(bracketed, [],
    "у тега завёлся скобочный ключ: " + bracketed.join(", "));
  ok("контроль: у тега ключ прежний, скобочного не появляется");
}

{
  /* Вид, записанный не тому значению, чужому не достаётся. */
  const cfg = makeConfig({ project: { "[[test1]]": { visibility: "custom", customText: "👤" } } });
  const fieldMap = I.buildFieldTagVisualMap(cfg);
  const other = I.readTagVisualRowByTokenMaps("[[test2]]", fieldMap, {}, I.buildGlobalTagVisualMap(cfg));
  const mode = other ? I.resolveEffectiveTagVisualMode(other) : "default";
  assert.equal(mode, "default", "вид одной ссылки достался другой");
  ok("контроль: вид принадлежит своему значению, а не всем ссылкам поля");
}

/* ---- 2. узел: что человек видит и куда он ведёт ------------------------- */

/** Виджет с поддельной рабочей областью, запоминающей открытое. */
function paintLink(token: string, text: string, vars?: Any): Any {
  const opened: Any[] = [];
  const plugin = {
    app: {
      workspace: {
        getActiveFile: () => ({ path: "Заметки/строка.md" }),
        openLinkText: (link: string, source: string, leaf: Any) => { opened.push({ link, source, leaf }); },
      },
    },
  };
  const w = new I.LinkVisualTokenWidget(token, text, vars || {}, "io-blockvalue", plugin);
  return { el: w.toDOM(), opened, widget: w };
}

{
  const { el } = paintLink("[[Client A]]", "👤", { opacity: 0.5, fontSizePx: 12, risePx: 2 });
  assert.equal(String(el.tagName).toLowerCase(), "a", "заменённое значение — не ссылка по тегу узла");
  assert.equal(String(el.textContent), "👤", "на экране не текст человека");
  assert.ok(String(el.className).includes("io-linkshown"), "класс вида не поставлен: " + el.className);
  assert.ok(String(el.className).includes("io-blockvalue"),
    "правило Block до заменённого значения не доехало: " + el.className);
  assert.equal(el.getAttribute("data-io-link-target"), "Client A", "цель ссылки прочитана не та");
  /* Величины — переменными, а не строкой стиля (Р7 каталога). */
  assert.equal(el.getAttribute("style"), null, "вид приехал строкой атрибута, а не переменными");
  assert.equal(String(el.style.getPropertyValue("--io-blockvalue-opacity")), "0.5", "прозрачность не доехала");
  assert.equal(String(el.style.getPropertyValue("--io-blockvalue-font")), "12px", "кегль не доехал");
  assert.equal(String(el.style.getPropertyValue("--io-blockvalue-rise")), "2px", "подъём не доехал");
  ok("узел: ссылка с текстом человека, классом Block и величинами в переменных");
}

{
  /* Подпись с вертикальной чертой: цель — имя заметки, а не подпись. */
  const { el } = paintLink("[[Client A|клиент]]", "👤");
  assert.equal(el.getAttribute("data-io-link-target"), "Client A",
    "подпись после черты попала в цель перехода");
  ok("цель перехода — имя заметки, а не подпись после черты");
}

{
  const { el, opened } = paintLink("[[Client A]]", "👤");
  let prevented = 0;
  el.dispatch("mousedown", {
    button: 0,
    preventDefault() { prevented++; },
    stopPropagation() {},
  });
  assert.equal(opened.length, 1, "клик не открыл заметку");
  assert.equal(opened[0].link, "Client A", "открыта не та заметка: " + opened[0].link);
  assert.equal(opened[0].source, "Заметки/строка.md", "путь исходной заметки не передан");
  assert.equal(opened[0].leaf, false, "обычный клик открыл в новой вкладке");
  assert.equal(prevented, 1, "клик не перехвачен: редактор поставит каретку вместо перехода");
  ok("клик открывает ту самую заметку тем же вызовом, каким это делает Obsidian");
}

{
  const { el, opened } = paintLink("[[Client A]]", "👤");
  el.dispatch("mousedown", { button: 0, ctrlKey: true, preventDefault() {}, stopPropagation() {} });
  el.dispatch("mousedown", { button: 1, preventDefault() {}, stopPropagation() {} });
  el.dispatch("mousedown", { button: 2, preventDefault() {}, stopPropagation() {} });
  assert.equal(opened.length, 2, "средняя кнопка и `Ctrl` открыли не два раза: " + opened.length);
  assert.equal(opened[0].leaf, "tab", "`Ctrl` не открыл в новой вкладке");
  assert.equal(opened[1].leaf, "tab", "средняя кнопка не открыла в новой вкладке");
  ok("модификатор и средняя кнопка открывают в новой вкладке, правая не открывает ничего");
}

{
  /*
   * Без рабочей области переход невозможен, и это **проба**, а не поломка:
   * узел рисуется, клик не перехватывается, панель цела.
   */
  const w = new I.LinkVisualTokenWidget("[[Client A]]", "👤", {}, "", { app: {} });
  const el = w.toDOM();
  let prevented = 0;
  el.dispatch("mousedown", { button: 0, preventDefault() { prevented++; }, stopPropagation() {} });
  assert.equal(prevented, 0, "без рабочей области клик перехвачен, а открыть нечем");
  assert.equal(String(el.textContent), "👤", "узел всё равно нарисован");
  ok("без рабочей области Obsidian клик не перехватывается, а узел цел");
}

{
  /* Два одинаковых виджета равны, разные — нет: иначе CodeMirror перерисует
     строку лишний раз или, хуже, не перерисует нужный раз. */
  const a = new I.LinkVisualTokenWidget("[[A]]", "👤", { opacity: 0.5 }, "c", null);
  const b = new I.LinkVisualTokenWidget("[[A]]", "👤", { opacity: 0.5 }, "c", null);
  const c = new I.LinkVisualTokenWidget("[[A]]", "🙂", { opacity: 0.5 }, "c", null);
  const d = new I.LinkVisualTokenWidget("[[A]]", "👤", { opacity: 0.2 }, "c", null);
  assert.equal(a.eq(b), true, "одинаковые виджеты объявлены разными");
  assert.equal(a.eq(c), false, "смена текста виджет не меняет");
  assert.equal(a.eq(d), false, "смена прозрачности виджет не меняет");
  ok("равенство виджетов считает и текст, и величины");
}

/* ---- 3. `Link view`: две повадки ссылки, каждая своим контролом ---------- */

/**
 * Виджет с поддельной платформой, запоминающей **всё**, о чём его просили:
 * открытие заметки, событие предпросмотра и постановку перетаскивания.
 *
 * Подделан Obsidian (У-1): `workspace.trigger` — его шина событий,
 * `dragManager` — его приватное API. Решений подделка не принимает.
 */
function paintWithPowers(o: { hover?: boolean; drag?: boolean; dragManager?: boolean }): Any {
  const events: Any[] = [];
  const drags: Any[] = [];
  const app: Any = {
    workspace: {
      activeEditor: { hoverPopover: null },
      getActiveFile: () => ({ path: "Заметки/строка.md" }),
      openLinkText: () => {},
      trigger: (name: string, payload: Any) => { events.push({ name, payload }); },
    },
  };
  if (o.dragManager) {
    app.dragManager = {
      handleDrag: (node: Any, make: (ev: Any) => Any) => {
        node.draggable = true;
        drags.push({ node, made: make({ dataTransfer: null }) });
      },
      dragLink: (ev: Any, link: string, source: string) => ({ type: "link", link, source }),
    };
  }
  const w = new I.LinkVisualTokenWidget("[[Client A]]", "👤", {}, "", { app },
    o.hover === true, o.drag === true);
  return { el: w.toDOM(), events, drags };
}

{
  /* Оба контрола выключены — оба обработчика отсутствуют. Это **база**: с неё
     плагин и жил до его слова, и она обязана оставаться достижимой. */
  const off = paintWithPowers({});
  off.el.dispatch("mouseover", { preventDefault() {}, stopPropagation() {} });
  assert.equal(off.events.length, 0, "предпросмотр попросили при выключенном контроле");
  assert.ok(!off.el.draggable, "узел стал перетаскиваемым при выключенном контроле");
  ok("`Link view` выключен: ни предпросмотра, ни перетаскивания");
}

{
  const on = paintWithPowers({ hover: true });
  on.el.dispatch("mouseover", { preventDefault() {}, stopPropagation() {} });
  assert.equal(on.events.length, 1, "предпросмотр не попрошен");
  const ev = on.events[0];
  assert.equal(ev.name, "hover-link", "попрошено не то событие: " + ev.name);
  assert.equal(ev.payload.source, "editor",
    "источник не `editor` — значение не послушается настроек `Page preview` для заметки");
  assert.equal(ev.payload.linktext, "Client A", "предпросмотр попрошен не той заметки");
  assert.equal(ev.payload.sourcePath, "Заметки/строка.md", "путь исходной заметки не передан");
  assert.equal(ev.payload.targetEl, on.el, "окно предпросмотра встанет не у того узла");
  assert.ok(ev.payload.hoverParent, "некому отдать открытое окно: `hoverParent` пуст");
  ok("`Preview on hover` включён: событие то же, каким его просит сам редактор");
}

{
  /* Без открытого редактора просить некого — и это проба, а не отказ. */
  const w = new I.LinkVisualTokenWidget("[[Client A]]", "👤", {}, "",
    { app: { workspace: { trigger: () => { throw new Error("звать не должны"); } } } }, true, false);
  const el = w.toDOM();
  el.dispatch("mouseover", { preventDefault() {}, stopPropagation() {} });
  ok("без открытого редактора предпросмотр не просится, и узел цел");
}

{
  const drag = paintWithPowers({ drag: true, dragManager: true });
  assert.equal(drag.drags.length, 1, "перетаскивание не поставлено ходом платформы");
  assert.equal(drag.drags[0].node, drag.el, "перетаскивание повешено не на тот узел");
  assert.equal(drag.drags[0].made.link, "Client A", "платформе отдана не та заметка");
  assert.equal(drag.drags[0].made.source, "Заметки/строка.md", "путь исходной заметки не отдан");
  assert.ok(drag.el.draggable, "узел не стал перетаскиваемым");
  ok("`Drag to move` включён: ход платформы, и в нём цель и путь");
}

{
  /*
   * `dragManager` — приватное API, и его может не быть. Запасной ход кладёт в
   * обмен сам токен: сброс такого в другую заметку даёт ту же ссылку текстом.
   */
  const plain = paintWithPowers({ drag: true });
  assert.ok(plain.el.draggable, "без приватного API узел не стал перетаскиваемым");
  const carried: Record<string, string> = {};
  plain.el.dispatch("dragstart", {
    dataTransfer: { setData: (kind: string, value: string) => { carried[kind] = value; } },
  });
  assert.equal(carried["text/plain"], "[[Client A]]",
    "запасной ход не положил в обмен ссылку: " + JSON.stringify(carried));
  ok("без приватного API перетаскивание кладёт в обмен сам токен");
}

{
  /* Настройки доезжают до слоя: два ключа, два ответа, и умолчание — выкл. */
  const cfg = makeConfig();
  const off = I.getTagVisualsFromConfig(cfg);
  assert.equal(off.linkShownHover, false, "предпросмотр включён по умолчанию");
  assert.equal(off.linkShownDrag, false, "перетаскивание включено по умолчанию");
  cfg.visual.tags.linkShown = { hoverPreview: true, draggable: false };
  const half = I.getTagVisualsFromConfig(cfg);
  assert.equal(half.linkShownHover, true, "включённый предпросмотр до слоя не доехал");
  assert.equal(half.linkShownDrag, false, "выключенное перетаскивание доехало включённым");
  ok("оба контрола `Link view` доезжают до слоя порознь");
}

console.log("\n" + passed + " проверок пройдено");
