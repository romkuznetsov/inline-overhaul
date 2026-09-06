/**
 * Скролл и фокус переживают перерисовку (дефект A8, замечание заказчика
 * 2026-08-27: «панель прыгает к началу при нажатии на любой контрол»).
 *
 * Две части. Сначала сам помощник `keepView` — на голом дереве, где видно,
 * что именно он снимает и что возвращает. Потом редактор Fields целиком: его
 * контролы зовут `redraw`, и проверять надо тот путь, по которому ходит
 * человек, а не только помощник в отдельности.
 *
 * Заглушка DOM научена двум свойствам настоящего: `scrollTop` у узлов и
 * `document.activeElement`. Без них проверка была бы зелёной ни о чём —
 * помощник читает ровно их.
 */

import assert from "node:assert/strict";
import { makeNode, clearFocus, focusedNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals, Setting, Notice, Modal } from "../harness/obsidian_stub.ts";
import { keepView } from "../../src/ui/settings/custom/keepview.ts";
import { fieldsEditor } from "../../src/ui/settings/custom/fields_editor.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";
import type { SettingsCtx } from "../../src/ui/settings/types.ts";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

function all(root: StubNode, cls: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (n.classList.contains(cls)) out.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

/** Узел с такой подписью: контролы редактора отличаются именно ею. */
function byLabel(root: StubNode, label: string): StubNode {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (String(n.getAttribute("aria-label") || "") === label) out.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  assert.ok(out.length, "не нашёлся узел с подписью " + label);
  return out[0] as StubNode;
}

/** Прокручиваемый предок: у блока прокрутки нет, она у панели. */
function makeScroller(): { pane: StubNode; box: StubNode } {
  const pane = makeNode("div");
  pane.scrollHeight = 2000;
  pane.clientHeight = 400;
  const box = pane.createEl("div", { cls: "io-block" });
  return { pane, box };
}

/* ======================================================================
 * Сам помощник.
 * ====================================================================== */

{
  const { pane, box } = makeScroller();
  const mount = box.createEl("div");
  mount.createEl("input", { attr: { "aria-label": "Value of #todo" } });
  pane.scrollTop = 320;

  const keep = keepView(box as unknown as El);
  const next = box.createEl("div");
  next.createEl("input", { attr: { "aria-label": "Value of #todo" } });
  mount.remove();
  /* Подмена узла: браузер в этот момент и сбрасывает прокрутку. */
  pane.scrollTop = 0;
  keep.restore();

  assert.equal(pane.scrollTop, 320, "прокрутка вернулась туда, где была");
  ok("keepView: прокрутка переживает подмену узла");
}

{
  const { box } = makeScroller();
  const mount = box.createEl("div");
  const row = mount.createEl("div");
  row.createEl("input", { attr: { "aria-label": "Value of #doing" } });
  clearFocus();
  byLabel(box, "Value of #doing").focus();

  const keep = keepView(box as unknown as El);
  /*
   * Новое поддерево другой формы: строка уехала вниз, как после стрелки
   * `Level`. Фокус обязан найтись по подписи, а не по месту в дереве.
   */
  const next = box.createEl("div");
  next.createEl("div").createEl("input", { attr: { "aria-label": "Value of #todo" } });
  const moved = next.createEl("div").createEl("input", { attr: { "aria-label": "Value of #doing" } });
  mount.remove();
  clearFocus();
  keep.restore();

  assert.equal(focusedNode(), moved, "фокус вернулся на тот же контрол, хотя он переехал");
  ok("keepView: фокус ищется по подписи, а не по месту в дереве");
}

{
  const { box } = makeScroller();
  const mount = box.createEl("div");
  const input = mount.createEl("input", { attr: { "aria-label": "Property of Status" } });
  input.value = "status";
  input.selectionStart = 3;
  input.selectionEnd = 3;
  clearFocus();
  input.focus();

  const keep = keepView(box as unknown as El);
  const next = box.createEl("div");
  const again = next.createEl("input", { attr: { "aria-label": "Property of Status" } });
  again.value = "status";
  mount.remove();
  clearFocus();
  keep.restore();

  assert.equal(again.selectionStart, 3, "каретка вернулась туда же");
  assert.equal(again.selectionEnd, 3, "и выделения не появилось");
  ok("keepView: каретка в поле ввода не прыгает в начало");
}

{
  /*
   * Фокус возвращается с `preventScroll`. Без него браузер сам прокрутит
   * панель к узлу, то есть починка скролла сама же его и сдвинет.
   */
  const { box } = makeScroller();
  const mount = box.createEl("div");
  const input = mount.createEl("input", { attr: { "aria-label": "Value of #todo" } });
  clearFocus();
  input.focus();

  const keep = keepView(box as unknown as El);
  const next = box.createEl("div");
  const again = next.createEl("input", { attr: { "aria-label": "Value of #todo" } }) as StubNode & {
    focus: (opts?: { preventScroll?: boolean }) => void;
  };
  let seen: Any = "не звали";
  again.focus = (opts?: { preventScroll?: boolean }) => { seen = opts; };
  mount.remove();
  clearFocus();
  keep.restore();

  assert.deepEqual(seen, { preventScroll: true }, "фокус вернулся, не двигая прокрутку");
  ok("keepView: возврат фокуса не прокручивает панель к узлу");
}

{
  /* Фокус был вне блока — трогать его нельзя: человек ушёл в другое место. */
  const { box } = makeScroller();
  const outside = makeNode("input");
  box.createEl("div").createEl("input", { attr: { "aria-label": "Value of #todo" } });
  clearFocus();
  outside.focus();

  const keep = keepView(box as unknown as El);
  box.empty();
  box.createEl("div").createEl("input", { attr: { "aria-label": "Value of #todo" } });
  keep.restore();

  assert.equal(focusedNode(), outside, "фокус остался там, куда его поставил человек");
  ok("keepView: фокус вне блока не перехватывается");
}

{
  /* Прокручиваемого предка нет вовсе — помощник обязан промолчать, а не упасть. */
  const box = makeNode("div");
  box.createEl("div");
  const keep = keepView(box as unknown as El);
  keep.restore();
  ok("keepView: без прокручиваемого предка ничего не ломается");
}

/* ======================================================================
 * Редактор Fields целиком: тот путь, по которому ходит человек.
 * ====================================================================== */

/**
 * Браузер, когда старое поддерево уходит из дерева, пересчитывает высоту и
 * зажимает прокрутку — это и есть вторая половина дефекта A8. Заглушка ничего
 * не раскладывает, поэтому сброс изображается здесь, на том же событии.
 *
 * Без него проверка была бы зелёной ни о чём: скролл никто бы не сдвинул, и
 * помощник можно было бы выбросить, не уронив ни одной строки.
 */
function resetScrollOnSwap(pane: StubNode, box: StubNode): void {
  /* Подменяемый узел лежит в собственном контейнере блока, а не прямо в
     строке настройки: снимать старый будет он. */
  const holder = all(box, "io-fieldsblock")[0] as StubNode;
  assert.ok(holder, "блок завёл свой контейнер");
  const original = holder.removeChild.bind(holder);
  (holder as unknown as { removeChild: (c: StubNode) => StubNode }).removeChild = (c: StubNode) => {
    pane.scrollTop = 0;
    return original(c);
  };
}

function makeEditor(): { pane: StubNode; box: StubNode; close: () => void } {
  const cfg: Any = {
    ui: {},
    pkm: {
      fields: {
        order: {
          left: ["status"], right: [], lead: {},
          labels: { status: "Status" }, strictNames: { status: "status" },
          types: { status: "tag" }, active: { status: "yes" },
          freeRoam: { status: "off" }, enabled: { status: true },
          propertiesByField: {},
        },
        tags: {
          fields: [{
            id: "status", orderKey: "status", prefix: "#",
            values: [{ token: "#todo", active: true }, { token: "#doing", active: true }],
          }],
        },
        links: { fields: [] },
        elements: { fields: [], byField: {} },
      },
    },
    visual: {
      tags: { byTag: {}, byField: {}, userTags: {} },
    },
  };
  const merge = (dst: Any, src: Any): void => {
    for (const key of Object.keys(src || {})) {
      const value = src[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (!dst[key] || typeof dst[key] !== "object") dst[key] = {};
        merge(dst[key], value);
      } else dst[key] = value;
    }
  };
  const normalizePkmOrder = (raw: Any): Any => {
    const o = raw && typeof raw === "object" ? raw : {};
    const map = (x: Any) => (x && typeof x === "object" ? { ...x } : {});
    return {
      left: Array.isArray(o.left) ? o.left.slice() : [],
      right: Array.isArray(o.right) ? o.right.slice() : [],
      lead: map(o.lead), labels: map(o.labels), strictNames: map(o.strictNames),
      types: map(o.types), active: map(o.active), freeRoam: map(o.freeRoam),
      enabled: map(o.enabled), propertiesByField: map(o.propertiesByField),
    };
  };
  const plugin = {
    app: { workspace: {}, vault: {} },
    getConfig: () => cfg,
    setConfigPatch: (patch: Any) => { merge(cfg, patch); },
  };
  const ctx = {
    get: (path: string) => (path === "features.pkm.enabled" ? true : false),
    set: async () => {},
    run: async () => {},
    watch: () => () => {},
    platform: {
      Setting, Notice, Modal,
      setIcon: () => {},
      plugin,
      getConfig: () => cfg,
      normalizePkmOrder,
      pkmOrderFields: [] as string[],
    },
  } as unknown as SettingsCtx;

  const pane = makeNode("div");
  pane.scrollHeight = 2400;
  pane.clientHeight = 420;
  const box = pane.createEl("div", { cls: "io-block" });
  const close = fieldsEditor(box as unknown as El, ctx);
  return { pane, box, close };
}

{
  const e = makeEditor();
  resetScrollOnSwap(e.pane, e.box);
  e.pane.scrollTop = 540;
  /* Любой контрол: нажатие на выбор Field перерисовывает блок целиком. */
  const pick = all(e.box, "io-fields__pick")[0] as StubNode;
  assert.ok(pick, "в списке есть кнопка выбора Field");
  pick.click();
  assert.equal(e.pane.scrollTop, 540, "панель осталась там, где её оставил человек");
  e.close();
  ok("редактор Fields: нажатие на контрол не бросает панель к началу");
}

{
  const e = makeEditor();
  resetScrollOnSwap(e.pane, e.box);
  e.pane.scrollTop = 210;
  clearFocus();
  /* Стрелка уровня — тот контрол, который меняет форму дерева: после него
     строка переезжает, и фокус искать по месту уже нельзя. */
  const rows = all(e.box, "io-vals__row");
  assert.equal(rows.length, 2, "у Field два значения");
  const arrowLabel = String(
    (all(rows[1] as StubNode, "io-depthcell")[0] as StubNode).children[0]?.getAttribute("aria-label") || "",
  );
  assert.ok(arrowLabel, "у стрелки уровня есть подпись");
  const arrow = byLabel(e.box, arrowLabel);
  arrow.focus();
  arrow.click();

  assert.equal(e.pane.scrollTop, 210, "прокрутка на месте и после перестройки таблицы");
  const now = focusedNode();
  assert.ok(now, "фокус не потерялся");
  /*
   * Подпись стрелки после нажатия обратная — «вернуть наверх» вместо «сделать
   * дочерним», — и по ней узел не найти. Фокус вернулся запасным путём, по
   * месту в дереве: ячейка та же, значение то же.
   */
  const nowLabel = String(now?.getAttribute("aria-label") || "");
  assert.notEqual(nowLabel, "", "у контрола под фокусом есть подпись");
  assert.ok(nowLabel.includes("#doing"),
    "фокус стоит на стрелке того же значения: " + nowLabel);
  const cell = all(e.box, "io-depthcell").find(c => c.children[0] === now);
  assert.ok(cell, "и это по-прежнему ячейка уровня, а не соседний контрол");
  e.close();
  ok("редактор Fields: фокус остаётся на нажатой стрелке уровня");
}

{
  const e = makeEditor();
  resetScrollOnSwap(e.pane, e.box);
  e.pane.scrollTop = 180;
  clearFocus();
  /* Поле ввода значения: человек печатает, панель перерисовывается, каретка
     обязана остаться там, где была. */
  const input = all(e.box, "io-valcell")[0]?.children[0] as StubNode;
  assert.ok(input, "у первого значения есть поле ввода");
  input.focus();
  input.value = "#todos";
  input.selectionStart = 6;
  input.selectionEnd = 6;
  input.dispatch("change");

  const now = focusedNode();
  /* Подпись поля собрана из самого значения и переименованием меняется, так
     что узнаётся оно по месту: та же ячейка той же строки. */
  assert.equal(String(now?.getAttribute("aria-label") || ""), "Value #todos of status",
    "фокус остался в поле того же значения, уже под новым именем");
  assert.equal(all(e.box, "io-valcell")[0]?.children[0], now,
    "и это первая ячейка значения, а не соседний контрол");
  assert.equal(now?.selectionStart, 6, "и каретка не прыгнула в начало");
  assert.equal(e.pane.scrollTop, 180, "панель не сдвинулась");
  e.close();
  ok("редактор Fields: правка значения не уносит каретку и не двигает панель");
}

console.log("\n" + passed + " проверок пройдено");
