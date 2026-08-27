/**
 * Карта записей НОВОГО редактора Fields и сверка её со старой (фаза 3b, п.4).
 *
 * Зачем вторая карта. Первая, `order_board_write_map.txt`, снята со старой
 * доски и обязана остаться посимвольно прежней: она доказывает, что перенос
 * записей в модель ничего не сдвинул. Но она ничего не говорит о новой
 * вёрстке — та рисует другие контролы в другом порядке, и сравнивать её с
 * прежней построчно бессмысленно.
 *
 * Поэтому сверка идёт по существу: **множество путей конфига**, до которых
 * человек может дотянуться. Новый редактор не имеет права писать туда, куда
 * старая доска не писала, и не имеет права потерять ни одного пути — кроме
 * тех, что перечислены ниже поимённо и с причиной.
 *
 * Своя карта у нового редактора всё-таки есть: она читается глазами в diff и
 * обновляется через `IO_UPDATE_WRITE_MAP=1`, как и первая.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { createFieldsModel } from "../../src/ui/settings/custom/fields_model.ts";
import { renderFieldsEditor } from "../../src/ui/settings/custom/fields_editor_view.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";
import * as deepStateModule from "../../src/core/order_deep_editor_state.js";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const GOLDEN = path.join(root, "tests", "fixtures", "fields_editor_write_map.txt");
const OLD_MAP = path.join(root, "tests", "fixtures", "order_board_write_map.txt");

const deepState = (deepStateModule as { default?: unknown }).default || deepStateModule;

/* ---- окружение --------------------------------------------------------- */

function normalizePkmOrder(raw: Any): Any {
  const o = raw && typeof raw === "object" ? raw : {};
  const map = (x: Any) => (x && typeof x === "object" ? { ...x } : {});
  return {
    left: Array.isArray(o.left) ? o.left.slice() : [],
    right: Array.isArray(o.right) ? o.right.slice() : [],
    lead: map(o.lead), labels: map(o.labels), strictNames: map(o.strictNames),
    types: map(o.types), active: map(o.active), freeRoam: map(o.freeRoam),
    enabled: map(o.enabled), propertiesByField: map(o.propertiesByField),
  };
}

/** Тот же набор Fields, что у карты старой доски: три типа и один дочерний. */
/**
 * Режим шага у Field типа `element`. Новая вёрстка показывает только то поле,
 * которым шагает выбранный режим, поэтому обход идёт по разу на каждый режим:
 * иначе две трети записей элемента остались бы за картой.
 */
type StepMode = "increment" | "command" | "custom";

function makeConfig(step: StepMode = "command"): Any {
  return JSON.parse(JSON.stringify({
    ui: { pkmSubTab: "main" },
    pkm: {
      behavior: {
        order: {
          left: ["status", "status_sub"],
          right: ["project", "due"],
          lead: { left: "status", right: "due" },
          labels: { status: "Status", status_sub: "Status sub", project: "Project", due: "Due" },
          strictNames: { status: "status", project: "project", due: "due" },
          types: { status: "tag", status_sub: "tag", project: "wikilink", due: "element" },
          active: { status: "yes", status_sub: "yes", project: "yes", due: "yes" },
          freeRoam: { status: "off", status_sub: "off", project: "off", due: "off" },
          enabled: { status: true, status_sub: true, project: true, due: true },
          propertiesByField: { status: "status" },
        },
        leftMode: {
          fields: [
            { id: "status", orderKey: "status", prefix: "#", values: [{ token: "todo", active: true }, { token: "doing", active: true }] },
            { id: "status_sub", orderKey: "status_sub", prefix: "#", dependsOn: "status", values: [{ token: "early", allowedParentValues: ["todo"], active: true }] },
          ],
        },
        rightMode: {
          fields: [
            { id: "project", orderKey: "project", source: "wikilinks:project", values: [{ token: "ClientA", active: true }] },
            { id: "due", orderKey: "due", values: [] },
          ],
        },
        elements: {
          fields: ["due"],
          /*
           * Форма строки — как у старой карты, вместе с её же лишними ключами
           * верхнего уровня: они попадают в каждую запись, и без них наборы
           * путей у двух карт разошлись бы на пустом месте.
           */
          byField: {
            due: { emoji: "!", format: "YYYY-MM-DD", mode: step, command: "now", increment: { mode: step } },
          },
        },
        tagVisuals: { byTag: { status: { "#todo": { fillColor: "#222222", textColor: "#ffffff" } } }, userTags: {} },
        prefixRules: { checkboxByFieldValue: {} },
      },
    },
  }));
}

interface Write { reason: string; paths: string[] }

/** Пути патча точечными строками: карта сверяет пути, а не форму объекта. */
function pathsOf(patch: Any, prefix = ""): string[] {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return [prefix || "<value>"];
  const out: string[] = [];
  for (const key of Object.keys(patch).sort()) {
    out.push(...pathsOf(patch[key], prefix ? prefix + "." + key : key));
  }
  return out.length ? out : [prefix + " = {}"];
}

function render(
  selected: string,
  writes: Write[],
  answer: { name: string; kind: "tag" | "wikilink" | "element" } | null = null,
  confirm = false,
  step: StepMode = "command",
): StubNode {
  const cfg = makeConfig(step);
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
      writes.push({ reason: String(reason || "<без причины>"), paths: pathsOf(patch) });
      merge(cfg, patch);
    },
    renameStrictNameInConfigNote: async () => {},
    registerPkmCommands: () => {},
  };
  const model = createFieldsModel({
    plugin: plugin as never,
    normalizePkmOrder,
    pkmOrderFields: [],
    cfg,
    deepState: deepState as never,
  });
  const host = makeNode("div");
  renderFieldsEditor(host as unknown as El, {
    model,
    ctx: { get: () => 100, set: async () => {}, run: async () => {}, watch: () => () => {} } as never,
    state: { selected },
    enabled: true,
    showTips: false,
    redraw: () => {},
    notice: () => {},
    /*
     * Окна в обходе отвечают отказом — ровно как у старой карты, где диалоги
     * не подтверждаются: там важно, что кнопка спрашивает. Добавление Field
     * снимается отдельным сценарием ниже: одним нажатием его не снять.
     */
    askNewField: done => done(answer),
    confirmDeleteField: (_name, done) => done(confirm),
  });
  return host;
}

/* ---- обход контролов --------------------------------------------------- */

function controls(root_: StubNode): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    const tag = String(n.tagName || "");
    if (tag === "INPUT" || tag === "SELECT" || tag === "BUTTON" || tag === "TEXTAREA") out.push(n);
    n.children.forEach(walk);
  };
  walk(root_);
  return out;
}

/** Имя контрола для карты: то, что видит человек, и что читает скринридер. */
function nameOf(node: StubNode, index: number): string {
  const own = String(node.getAttribute("aria-label") || node.title || node.placeholder || "").trim();
  const text = String(node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
  const kind = String(node.tagName || "").toLowerCase() + (node.type ? ":" + node.type : "");
  return kind + " [" + (own || text || "<без подписи>") + "] #" + index;
}

const TYPED = "io-map";

/** Нажать контрол так, как это сделал бы человек. */
function poke(node: StubNode): string {
  const tag = String(node.tagName || "");
  try {
    if (tag === "INPUT" && node.type === "color") {
      node.value = "#123456";
      node.dispatch("change");
      return "";
    }
    if (tag === "INPUT" || tag === "TEXTAREA") {
      /* В поле Prefix человек пишет чекбокс, а не что попало: со случайной
         строкой контрол отвечает уведомлением, и запись остаётся за картой. */
      const label = String(node.getAttribute("aria-label") || "");
      node.value = label.startsWith("Prefix for") ? "[x]" : TYPED;
      node.dispatch("input");
      node.dispatch("change");
      return "";
    }
    if (tag === "SELECT") {
      const options = node.children.filter(c => String(c.tagName) === "OPTION");
      const next = options.find(o => String(o.value || "") !== String(node.value || ""));
      if (!next) return "нет второго варианта";
      node.value = String(next.value || "");
      node.dispatch("change");
      return "";
    }
    node.dispatch("click");
    return "";
  } catch (e) {
    return "падает: " + String((e as Error).message || e).slice(0, 60);
  }
}

function sweep(selected: string, label: string, rows: string[], step: StepMode = "command"): number {
  const list = controls(render(selected, [], null, false, step));
  list.forEach((_node, index) => {
    const writes: Write[] = [];
    const fresh = render(selected, writes, null, false, step);
    const target = controls(fresh)[index];
    if (!target) {
      rows.push(label + " #" + index + " пропал при повторной отрисовке");
      return;
    }
    const name = label + " " + nameOf(target, index);
    const trouble = poke(target);
    const parts: string[] = [];
    if (trouble) parts.push(trouble);
    for (const w of writes) parts.push(w.reason + " -> " + w.paths.join(", "));
    rows.push(name + "\n    " + (parts.length ? parts.join(" | ") : "без записи"));
  });
  return list.length;
}

/**
 * Составные сценарии: добавление и удаление Field спрашивают окном, и одним
 * нажатием их не снять. У старой карты ровно та же графа и та же причина.
 */
function scenarios(rows: string[]): void {
  const press = (host: StubNode, label: string): boolean => {
    const hit = controls(host).find(n =>
      String(n.getAttribute("aria-label") || "") === label);
    if (!hit) return false;
    hit.dispatch("click");
    return true;
  };

  {
    const writes: Write[] = [];
    const host = render("status", writes, { name: "io_new", kind: "tag" });
    rows.push("сценарий [добавить Field с именем io_new]");
    rows.push("    " + (press(host, "Add a Field")
      ? writes.map(w => w.reason + " -> " + w.paths.join(", ")).join(" | ") || "без записи"
      : "не нашёл кнопку добавления"));
  }
  {
    const writes: Write[] = [];
    const host = render("due", writes, null, true);
    rows.push("сценарий [удалить Field due с подтверждением]");
    rows.push("    " + (press(host, "Delete the Field due")
      ? writes.map(w => w.reason + " -> " + w.paths.join(", ")).join(" | ") || "без записи"
      : "не нашёл кнопку удаления"));
  }
  {
    /*
     * Предусловие Field (10.13.4). Одним нажатием его не снять: строка
     * `Choose prerequisite Field` появляется только после `Yes`, а строка
     * `Prerequisite Value` — только после выбора Field. Обход рисует каждый
     * контрол на свежей отрисовке и до второй строки не доходит никогда,
     * поэтому сценарий держит одно состояние и перерисовывается сам.
     */
    const live = liveRender("project");
    rows.push("сценарий [поставить Field предусловием и выбрать его значение]");
    const steps: string[] = [];
    const pick = (label: string, value: string): boolean => {
      const hit = controls(live.host()).find(n =>
        String(n.getAttribute("aria-label") || "") === label);
      if (!hit) return false;
      hit.value = value;
      hit.dispatch("change");
      return true;
    };
    steps.push(pick("Prerequisite Field for project", "yes") ? "yes" : "не нашёл строку предусловия");
    steps.push(pick("Choose prerequisite Field for project", "due") ? "due" : "не нашёл список Fields");
    steps.push(pick("Prerequisite Value for project", "") ? "any" : "не нашёл список значений");
    rows.push("    " + (live.writes.map(w => w.reason + " -> " + w.paths.join(", ")).join(" | ")
      || "без записи [" + steps.join(", ") + "]"));
  }
  {
    /* И обратный ход: `No` снимает предусловие из конфига. */
    const live = liveRender("project");
    const pick = (label: string, value: string): boolean => {
      const hit = controls(live.host()).find(n =>
        String(n.getAttribute("aria-label") || "") === label);
      if (!hit) return false;
      hit.value = value;
      hit.dispatch("change");
      return true;
    };
    pick("Prerequisite Field for project", "yes");
    pick("Choose prerequisite Field for project", "due");
    live.writes.length = 0;
    rows.push("сценарий [снять предусловие Field]");
    rows.push("    " + (pick("Prerequisite Field for project", "no")
      ? live.writes.map(w => w.reason + " -> " + w.paths.join(", ")).join(" | ") || "без записи"
      : "не нашёл строку предусловия"));
  }
}

/**
 * Отрисовка, которая переживает перерисовку: один конфиг, одно состояние вида
 * и свежее дерево на каждый `redraw`. Нужна сценариям из двух шагов — обычный
 * `render` перерисовку глушит, и второй шаг некуда сделать.
 */
function liveRender(selected: string): { host: () => StubNode; writes: Write[] } {
  const cfg = makeConfig();
  const writes: Write[] = [];
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
      writes.push({ reason: String(reason || "<без причины>"), paths: pathsOf(patch) });
      merge(cfg, patch);
    },
  };
  const state = { selected };
  let host = makeNode("div");
  const draw = (): void => {
    host = makeNode("div");
    renderFieldsEditor(host as unknown as El, {
      model: createFieldsModel({
        plugin: plugin as never, normalizePkmOrder, pkmOrderFields: [], cfg,
        deepState: deepState as never,
      }),
      ctx: { get: () => 100, set: async () => {}, run: async () => {}, watch: () => () => {} } as never,
      state, enabled: true, showTips: false, redraw: draw,
      notice: () => {},
      askNewField: done => done(null),
      confirmDeleteField: (_name, done) => done(false),
    });
  };
  draw();
  return { host: () => host, writes };
}

/**
 * Причины записи, а не только пути (замечание заказчика 2026-08-27).
 *
 * Сверка по путям пропустила потерянный контрол видимости дочернего Field, и
 * пропустила объяснимо: `toggleSub` пишет в те же ветки конфига, что и
 * соседние контролы, — `order.active`, `order.enabled`, `leftMode.fields`, —
 * а перенос Field перетаскиванием пишет `orderState` целиком, то есть все эти
 * ветки разом. Множество путей осталось полным, контрола не стало.
 *
 * Причина записи, в отличие от пути, называет **контрол**: у каждого своя.
 * Поэтому вторая сверка идёт по множеству причин, и потерянный контрол роняет
 * её сразу.
 */
function collectReasons(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/(pkm:[A-Za-z0-9:_.#-]+) ->/g)) out.add(String(m[1]));
  return out;
}

/** Причины, у которых имени Field в хвосте нет. Список закрытый. */
const NAMELESS = new Set(["pkm:visuals:user-tags:add", "pkm:behavior:order:dnd"]);

/**
 * Причина без имени Field и Value: имена в двух картах разные, а сверять надо
 * контролы. Хвост `:prefix` — часть причины, а не имя: им помечена вторая
 * запись пары, и без него две записи одного контрола слились бы в одну.
 */
function reasonShape(raw: string): string {
  if (NAMELESS.has(raw)) return raw;
  let s = raw;
  let tail = "";
  if (s.endsWith(":prefix")) {
    tail = ":prefix";
    s = s.slice(0, -":prefix".length);
  }
  return s.replace(/:[^:]+$/, ":*") + tail;
}

function reasonShapes(raw: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const r of raw) out.add(reasonShape(r));
  return out;
}

/** Контролы, которых у старой доски не было. Каждый — с причиной. */
const NEW_REASONS: Array<{ shape: string; why: string }> = [
  { shape: "pkm:behavior:order:dnd", why: "перетаскивание Field за ручку (Ф2): в старой доске его не было" },
  { shape: "pkm:behavior:order:deep:checkbox:*", why: "чекбокс Prefix под своим именем: старая доска писала ту же ветку причиной deep:prefix-mode" },
  { shape: "pkm:behavior:order:deep:checkbox:*:prefix", why: "вторая запись того же контрола" },
  { shape: "pkm:visuals:tag:fill:*", why: "пикер заливки: в старой доске он писал по другому событию и в карту попадал как «без записи»" },
  { shape: "pkm:visuals:tag:text:*", why: "пикер цвета текста, то же самое" },
  { shape: "pkm:visuals:tag:color-reset:*", why: "сброс цвета одной кнопкой вместо двух — fill-reset и text-reset (решение заказчика 2026-08-27)" },
  { shape: "pkm:behavior:order:delete:*", why: "удаление Field: старая карта диалог не подтверждала" },
  { shape: "pkm:behavior:delete-field:*", why: "вторая запись удаления Field, там же" },
  {
    shape: "pkm:behavior:order:prerequisite:*",
    why: "предусловие Field (10.13.4): новая настройка, принятая заказчиком 2026-08-27. "
      + "Снимается сценарием из двух шагов: строка выбора Field появляется только после `Yes`",
  },
];

/**
 * Контролы, которых в новом редакторе нет намеренно. Список закрытый: любой
 * не названный здесь потерянный контрол роняет проверку.
 */
const DROPPED_REASONS: Array<{ shape: string; why: string }> = [
  { shape: "pkm:behavior:order:strict:*", why: "переименование системного имени Field снято решением заказчика 2026-08-27: имя задаётся один раз в окне Add Field" },
  { shape: "pkm:visuals:user-tags:add", why: "блок «Color your Tags» уезжает своим блоком на вкладку Visual в фазе 3c" },
  { shape: "pkm:behavior:order:deep:yaml:*", why: "свойство заметки у отдельного Value: приезжает с блоком Note properties (10.9) на этапе Transform, решение заказчика 2026-08-27" },
  { shape: "pkm:behavior:order:deep:yaml:*:prefix", why: "вторая запись того же контрола" },
  {
    shape: "pkm:behavior:order:deep:wikilink-parent-field:*",
    why: "колонка Parent убрана 2026-08-27: заказчик её отклонил, и движок эту привязку не читает "
      + "вовсе — `__ioParentBinding` не встречается ни в main.js, ни в pkm_v2, ни в src/core",
  },
  {
    shape: "pkm:behavior:order:deep:wikilink-parent-token:*",
    why: "та же колонка. Родителя значению ссылки теперь задаёт колонка Level, и её "
      + "`allowedParentValues` у дочернего Field рантайм действительно читает",
  },
  { shape: "pkm:visuals:tag:fill-reset:*", why: "заменена одной кнопкой сброса: pkm:visuals:tag:color-reset" },
  { shape: "pkm:visuals:tag:text-reset:*", why: "заменена той же одной кнопкой" },
];

/**
 * Причины, до которых обход не добирается одним нажатием, хотя контрол на
 * месте. Каждая проверяется по исходнику вёрстки: пропала строка — упала
 * проверка. Без этого «не снято обходом» стало бы вторым именем для «потеряно».
 */
const UNSWEPT_REASONS: Array<{ shape: string; literal: string; why: string }> = [
  {
    shape: "pkm:behavior:order:deep:prefix-mode:*",
    literal: "pkm:behavior:order:deep:prefix-mode:",
    why: "пишется, когда поле Prefix очищают, а обход вписывает в него чекбокс [x]",
  },
  {
    shape: "pkm:behavior:order:deep:prefix-mode:*:prefix",
    literal: "pkm:behavior:order:deep:prefix-mode:",
    why: "вторая запись того же контрола",
  },
  {
    shape: "pkm:visuals:tag:custom-text:*",
    literal: "pkm:visuals:tag:custom-text:",
    why: "поле своего текста появляется только у Show = custom, то есть после перерисовки",
  },
];

function buildMap(): { text: string; paths: Set<string>; reasons: Set<string> } {
  const rows: string[] = [];
  const counts: string[] = [];
  counts.push("tag: " + sweep("status", "tag", rows));
  counts.push("link: " + sweep("project", "link", rows));
  for (const step of ["increment", "command", "custom"] as const) {
    counts.push("element/" + step + ": " + sweep("due", "element/" + step, rows, step));
  }
  scenarios(rows);
  const head = [
    "# Карта записей нового редактора Fields.",
    "# Снята с вёрстки fields_editor_view.ts на заглушке DOM: каждый контрол",
    "# нажат на свежей отрисовке, записано то, что ушло в конфиг. Обход идёт",
    "# трижды — по одному разу на каждый тип Field, потому что правая колонка",
    "# показывает только выбранный Field.",
    "# контролов: " + counts.join(", "),
    "",
  ];
  const body = rows.join("\n");
  const text = head.concat(rows).join("\n") + "\n";
  return { text, paths: collectPaths(body), reasons: collectReasons(body) };
}

/* ---- форма пути --------------------------------------------------------- */

/**
 * Путь без имён. Имена Fields и значений в двух картах разные — они и должны
 * быть разными, карты сняты на разных наборах, — а сверять надо ветки
 * конфига. Каждое правило названо: список закрытый, и путь, который под него
 * не подошёл, сравнивается как есть.
 */
function shape(raw: string): string {
  const p = raw.replace(/ = \{\}$/, "");
  /* Карты Order: ключ — имя Field. */
  const orderMaps = /^(pkm\.behavior\.order\.(?:labels|strictNames|types|active|freeRoam|enabled|propertiesByField))\./;
  if (orderMaps.test(p)) return p.replace(orderMaps, "$1.") .replace(/\.[^.]+$/, ".*");
  /* Элементы: ключ — имя Field, дальше своя форма. */
  if (/^pkm\.behavior\.elements\.byField\./.test(p)) {
    return "pkm.behavior.elements.byField.*" + p.replace(/^pkm\.behavior\.elements\.byField\.[^.]+/, "");
  }
  if (p === "pkm.behavior.elements.byField") return "pkm.behavior.elements.byField.*";
  /* Цвета: ключи — Field и значение, дальше имя свойства. */
  const byTag = /^pkm\.behavior\.tagVisuals\.byTag\.([^.]+)\.([^.]+)/;
  if (byTag.test(p)) return p.replace(byTag, "pkm.behavior.tagVisuals.byTag.*.*");
  if (/^pkm\.behavior\.tagVisuals\.userTags\./.test(p)) return "pkm.behavior.tagVisuals.userTags.*";
  /* Чекбоксы префикса: ключи — Field и значение. */
  const cb = /^pkm\.behavior\.prefixRules\.checkboxByFieldValue\.([^.]+)(\.[^.]+)?/;
  if (cb.test(p)) return p.replace(cb, "pkm.behavior.prefixRules.checkboxByFieldValue.*.*");
  return p;
}

function shapes(paths: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const p of paths) out.add(shape(p));
  return out;
}

/* ---- пути старой доски -------------------------------------------------- */

/**
 * Пути из старой карты. Стрелка `->` встречается и внутри подсказок к полям
 * ввода, поэтому берётся не всё подряд: путь конфига — это точечная цепочка
 * без пробелов, и всё остальное отбрасывается.
 */
const PATH_SHAPE = /^[A-Za-z0-9_$#[\]-]+(\.[A-Za-z0-9_$#[\]-]+)*( = \{\})?$/;

function collectPaths(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/ -> ([^|\n]+)/g)) {
    for (const p of String(m[1]).split(",")) {
      const clean = p.trim();
      /* Пустой объект — не путь записи, а пометка ветки: значения в нём нет,
         и сравнивать по нему две карты значит сравнивать формы фикстур. */
      if (clean.endsWith(" = {}")) continue;
      if (clean && PATH_SHAPE.test(clean)) out.add(clean);
    }
  }
  return out;
}

function oldPaths(): Set<string> {
  return collectPaths(fs.readFileSync(OLD_MAP, "utf8"));
}

/**
 * Пути, которых у нового редактора нет намеренно. Каждый — с причиной; список
 * закрытый, и любой новый пропавший путь роняет проверку.
 */
const DROPPED: Array<{ path: string; why: string }> = [
  { path: "ui.pkmSubTab", why: "подвкладки Main/Behavior удалены решением Р5" },
  { path: "ui.orderShowInfoTips", why: "тумблер вида удалён по Ф15: описания показываются всегда" },
  { path: "ui.orderShowDeepEditor", why: "тумблер вида удалён по Ф15" },
  { path: "ui.orderShowColorSettings", why: "тумблер вида удалён по Ф15" },
  { path: "pkm.behavior.tagVisuals.userTags", why: "блок «Color your Tags» уезжает своим блоком на вкладку Visual в фазе 3c — решение заказчика 2026-08-27" },
];

/**
 * Ветки, до которых старая карта не добралась, хотя старая доска в них
 * писала. Причина одна: обход не подтверждает диалоги, и удаление Field в
 * старую карту не попало ни разу. Новая карта его снимает сценарием, поэтому
 * ветки появляются — но это не новая возможность редактора.
 */
const UNSEEN: Array<{ path: string; why: string }> = [
  { path: "pkm.behavior.elements.fields", why: "удаление Field: старая карта диалог не подтверждала" },
];

/* ---- сверка ------------------------------------------------------------- */

const built = buildMap();
const before = shapes(oldPaths());
const now = shapes(built.paths);

/* Новый редактор не пишет туда, куда старая доска не писала. */
const unseen = new Set(UNSEEN.map(u => shape(u.path)));
const strangers = [...now].filter(p => !before.has(p) && !unseen.has(p)).sort();
assert.deepEqual(strangers, [],
  "новый редактор пишет в пути, которых у старой доски не было:\n  " + strangers.join("\n  "));
console.log("  ok   новых путей конфига не появилось");
for (const u of UNSEEN) console.log("       — " + u.path + ": " + u.why);

/* И не теряет ни одного, кроме перечисленных поимённо. */
const dropped = new Set(DROPPED.map(d => shape(d.path)));
const lost = [...before].filter(p => {
  if (now.has(p)) return false;
  for (const d of dropped) if (p === d || p.startsWith(d + ".")) return false;
  return true;
}).sort();
assert.deepEqual(lost, [],
  "новый редактор потерял пути, которых нет в списке намеренных:\n  " + lost.join("\n  "));
console.log("  ok   потерянных путей нет, кроме " + DROPPED.length + " намеренных");
for (const d of DROPPED) console.log("       — " + d.path + ": " + d.why);

/* ---- сверка по контролам, а не по ветвям конфига ------------------------ */

/*
 * Вторая сверка, купленная потерянным контролом дочернего Field. Множество
 * путей у двух карт совпадало, а контрола не было: `toggleSub` пишет в те же
 * ветки, что и соседние контролы. Причина записи называет контрол, и по ней
 * потеря видна сразу.
 */
{
  const view = fs.readFileSync(
    path.join(root, "src", "ui", "settings", "custom", "fields_editor_view.ts"), "utf8");

  const beforeReasons = reasonShapes(collectReasons(fs.readFileSync(OLD_MAP, "utf8")));
  const nowReasons = reasonShapes(built.reasons);

  /* Новых контролов ровно столько, сколько названо. */
  const allowedNew = new Set(NEW_REASONS.map(n => n.shape));
  const strangeReasons = [...nowReasons].filter(r => !beforeReasons.has(r) && !allowedNew.has(r)).sort();
  assert.deepEqual(strangeReasons, [],
    "новый редактор пишет причинами, которых не было ни у старой доски, ни в списке новых:\n  "
    + strangeReasons.join("\n  "));
  const unusedNew = NEW_REASONS.filter(n => !nowReasons.has(n.shape)).map(n => n.shape);
  assert.deepEqual(unusedNew, [],
    "в списке новых причин есть та, которой в карте нет — список разошёлся с кодом:\n  "
    + unusedNew.join("\n  "));
  console.log("  ok   новых причин записи ровно " + NEW_REASONS.length + ", и все названы");

  /*
   * Причина, до которой обход не добирается одним нажатием, обязана быть в
   * исходнике вёрстки. Иначе «не снято обходом» стало бы вторым именем для
   * «потеряно» — ровно тем, чем оказался контрол дочернего Field.
   */
  for (const u of UNSWEPT_REASONS) {
    assert.ok(view.includes(u.literal),
      "причина " + u.shape + " считается недоснятой обходом, но её нет и в вёрстке: "
      + "контрол пропал, а проверка молчит");
    assert.ok(!nowReasons.has(u.shape),
      "причина " + u.shape + " теперь снимается обходом — вычеркните её из UNSWEPT_REASONS");
  }
  console.log("  ok   недоснятых обходом причин " + UNSWEPT_REASONS.length
    + ", и каждая на месте в вёрстке");

  const droppedReasons = new Set(DROPPED_REASONS.map(d => d.shape));
  const unsweptReasons = new Set(UNSWEPT_REASONS.map(u => u.shape));
  const lostReasons = [...beforeReasons].filter(r =>
    !nowReasons.has(r) && !droppedReasons.has(r) && !unsweptReasons.has(r)).sort();
  assert.deepEqual(lostReasons, [],
    "новый редактор потерял контролы, которых нет в списке намеренных:\n  " + lostReasons.join("\n  "));
  console.log("  ok   потерянных контролов нет, кроме " + DROPPED_REASONS.length + " намеренных");
  for (const d of DROPPED_REASONS) console.log("       — " + d.shape + ": " + d.why);

  const unusedDropped = DROPPED_REASONS.filter(d => !beforeReasons.has(d.shape)).map(d => d.shape);
  assert.deepEqual(unusedDropped, [],
    "в списке намеренных потерь есть причина, которой не было и у старой доски:\n  "
    + unusedDropped.join("\n  "));
}

/* ---- золотой файл ------------------------------------------------------- */

if (process.env["IO_UPDATE_WRITE_MAP"] === "1" || !fs.existsSync(GOLDEN)) {
  fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
  fs.writeFileSync(GOLDEN, built.text, "utf8");
  console.log("карта записей нового редактора записана: " + path.relative(root, GOLDEN));
} else {
  const expected = fs.readFileSync(GOLDEN, "utf8");
  if (expected !== built.text) {
    const e = expected.split("\n");
    const a = built.text.split("\n");
    const diff: string[] = [];
    for (let i = 0; i < Math.max(e.length, a.length); i++) {
      if (e[i] !== a[i]) {
        diff.push("  строка " + (i + 1));
        diff.push("    было:  " + String(e[i]));
        diff.push("    стало: " + String(a[i]));
        if (diff.length > 30) break;
      }
    }
    console.log("Карта записей нового редактора разошлась с закреплённой:");
    console.log(diff.join("\n"));
    console.log("\nЕсли поведение изменено намеренно:");
    console.log("  IO_UPDATE_WRITE_MAP=1 node tests/regression/fields_editor_write_map_tests.ts");
    assert.fail("карта записей нового редактора разошлась");
  }
  console.log("карта записей нового редактора совпадает: " +
    (/# контролов: (.+)/.exec(expected) || ["", "?"])[1]);
}
