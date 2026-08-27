/**
 * Карта записей редактора Fields (PRD фаза 3b, перед переписыванием UI).
 *
 * Пины до этого закрепили удаление Field, черновики, историю и диалог
 * конфликта. Всё остальное, что редактор пишет в конфиг — ярлыки, значения,
 * уровни, префиксы, цвета, режимы поведения, элементы, — не было закреплено
 * ничем, а это семнадцать путей конфига (Ф16). Переписывать UI поверх такого
 * — значит переписывать наугад.
 *
 * Как это работает. Тест отрисовывает доску на заглушке, обходит её дерево,
 * находит каждый интерактивный узел, нажимает его на СВЕЖЕЙ отрисовке со
 * свежим конфигом и записывает, что из этого вышло: причина записи и пути,
 * которых она коснулась. Получается таблица «контрол → запись», которая
 * лежит рядом файлом и сверяется посимвольно.
 *
 * Почему золотой файл, а не набор ручных проверок: контролов больше сотни,
 * руками их перечислять — значит half забыть. Таблица же меняется вместе с
 * поведением, и любое изменение видно построчно в diff.
 *
 * Обновлять таблицу осмысленно только вместе с намеренным изменением
 * поведения: `IO_UPDATE_WRITE_MAP=1 node tests/regression/order_board_write_map_tests.ts`.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { Modal, Notice, Setting, setupGlobals } from "../harness/obsidian_stub.ts";

type Any = ReturnType<typeof JSON.parse>;

const require_ = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const GOLDEN = path.join(root, "tests", "fixtures", "order_board_write_map.txt");

setupGlobals();
const renderer = require_("../../src/ui/settings/custom/fields_editor_legacy.js");

/* ---- окружение доски -------------------------------------------------- */

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

/** Один и тот же конфиг для каждой отрисовки: карта обязана быть повторяемой. */
/**
 * Три типа Field и один дочерний.
 *
 * **Field типа `wikilink` добавлен 2026-08-27, и это намеренное расширение
 * карты.** До него в фикстуре были только `tag`, `tag_sub` и `element`, а
 * значит обход ни разу не нажимал контролы, которые есть только у ссылки — два
 * выпадающих списка родителя (`__ioParentBinding`). Их потерю в новой вёрстке
 * сверка причин записи назвать не могла: она сравнивает причины из этой карты,
 * а причин, которых обход не снял, в карте нет. Сверка честна ровно настолько,
 * насколько полна фикстура — поэтому фикстура и расширена.
 *
 * Ссылка лежит справа и имеет одно значение, а тег слева даёт этому значению
 * выбор родителя: без родительского Field с заведёнными значениями список
 * родителей пуст, и списки в доске не рисуются вовсе.
 */
function makeConfig(): Any {
  return JSON.parse(JSON.stringify({
    ui: { pkmSubTab: "main", orderShowInfoTips: true, orderShowDeepEditor: true, orderShowColorSettings: true },
    pkm: {
      taxonomy: {},
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
            { id: "status", orderKey: "status", prefix: "#", values: [{ token: "#todo", active: true }] },
            { id: "status_sub", orderKey: "status_sub", prefix: "#", values: [{ token: "#early", allowedParentValues: ["#todo"], active: true }] },
          ],
        },
        rightMode: {
          fields: [
            {
              id: "project", orderKey: "project", source: "wikilinks:project", placeholder: "project",
              values: [{ token: "ClientA", active: true }],
            },
            { id: "due", orderKey: "due", values: [] },
          ],
        },
        elements: { fields: ["due"], byField: { due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD", mode: "command", command: "now" } } },
        io: { separator1: "||", separator2: "||" },
        tagVisuals: { byTag: {}, byField: {}, userTags: {} },
      },
    },
    visual: { tags: { byTag: {}, userTags: {} } },
  }));
}

interface Write { reason: string; paths: string[] }

/** Пути патча в виде точечных строк: карта сравнивает пути, не форму объекта. */
function pathsOf(patch: Any, prefix = ""): string[] {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return [prefix || "<value>"];
  const out: string[] = [];
  for (const key of Object.keys(patch).sort()) {
    out.push(...pathsOf(patch[key], prefix ? prefix + "." + key : key));
  }
  return out.length ? out : [prefix + " = {}"];
}

function makePlugin(cfg: Any, writes: Write[]): Any {
  const merge = (dst: Any, src: Any): void => {
    for (const key of Object.keys(src || {})) {
      const v = src[key];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (!dst[key] || typeof dst[key] !== "object") dst[key] = {};
        merge(dst[key], v);
      } else dst[key] = v;
    }
  };
  const plugin: Any = {
    app: { workspace: {}, vault: {} },
    getConfig: () => cfg,
    setConfigPatch(patch: Any, reason: string) {
      writes.push({ reason: String(reason || "<без причины>"), paths: pathsOf(patch) });
      merge(cfg, patch);
    },
    async applyTagWheelConfigNote() { /* карта записей о ней не спрашивает */ },
    async openTagWheelConfigNote() { return "config.md"; },
    /*
     * Остальное, что доска зовёт у плагина. Подделки пустые и считаются:
     * карта показывает записи в конфиг, а вызовы наружу — отдельная графа,
     * иначе «падает: нет функции» скрыло бы настоящую запись.
     */
    calls: [] as string[],
    renameStrictNameInConfigNote(...args: Any[]) {
      plugin.calls.push("renameStrictNameInConfigNote(" + args.length + ")");
    },
    registerPkmCommands() { plugin.calls.push("registerPkmCommands()"); },
  };
  return plugin;
}

function render(writes: Write[], expand = false): { host: StubNode; cfg: Any; plugin: Any } {
  const cfg = makeConfig();
  const host = makeNode("div");
  const plugin = makePlugin(cfg, writes);
  renderer.renderPkmOrderBoardSection({
    Setting, Notice, Modal,
    containerEl: host,
    cfg,
    enabled: true,
    plugin,
    normalizePkmOrder,
    pkmOrderFields: [] as string[],
    setIcon: () => {},
    refreshSettings: () => {},
  });
  if (expand) {
    /* Раскрытие само пишет в конфиг черновики; в карту это попадать не должно. */
    const mark = writes.length;
    expandAll(host);
    writes.length = mark;
    (plugin.calls as string[]).length = 0;
  }
  return { host, cfg, plugin };
}

/* ---- опознание контролов --------------------------------------------- */

/**
 * Имя контрола для карты. Берётся то, что видит человек: подпись строки
 * настройки, `aria-label`, подсказка, надпись на кнопке. Опознание по
 * `textContent` целых блоков (то, что Ф14 велит убрать) здесь не годится:
 * оно не устоит ни при одной правке вёрстки.
 */
function nameOf(node: Any, index: number): string {
  const own = String(
    node.ariaLabel || node.getAttribute("aria-label") || node.title || node.placeholder || "",
  ).trim();
  const text = String(node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
  /* Если у контрола нет своей подписи, берём начало строки, в которой он
     стоит: без этого половина карты называется «без подписи» и читать её
     нельзя. Ф14 запрещает опознавать элементы по тексту в коде — здесь это
     не опознание, а только имя в отчёте. */
  let around = "";
  let up = node.parent;
  for (let i = 0; i < 4 && up && !around; i++) {
    around = String(up.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34);
    up = up.parent;
  }
  const kind = String(node.tagName || "").toLowerCase() + (node.type ? ":" + node.type : "");
  const label = own || text || around || "<без подписи>";
  return kind + " [" + label + "] #" + index;
}

function controls(root: StubNode): Any[] {
  const out: Any[] = [];
  const walk = (n: StubNode): void => {
    const tag = String(n.tagName || "");
    if (tag === "INPUT" || tag === "SELECT" || tag === "BUTTON" || tag === "TEXTAREA") out.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

/** Значение, которое подставляется в поле ввода: заметное и без случайности. */
const TYPED = "io-map";

/**
 * Раскрыть все редакторы значений. Без этого карта не видит самого важного:
 * таблица Values, уровни, префиксы и цвета живут под раскрытием `▸`, а
 * переписывать предстоит именно их (Ф7–Ф9).
 *
 * Раскрытие перерисовывает строку, поэтому после каждого нажатия узлы
 * собираются заново, а уже раскрытые узнаются по надписи `▾`.
 */
function expandAll(host: StubNode): void {
  for (let round = 0; round < 8; round++) {
    const closed = controls(host).filter(n => String(n.textContent || "").trim() === "\u25B8");
    if (!closed.length) return;
    const first = closed[0];
    try {
      if (typeof first.onclick === "function") first.onclick();
      else first.click();
    } catch {
      return;
    }
  }
}

/**
 * Нажать контрол так, как это сделал бы человек, и вернуть, что случилось.
 * Диалоги не подтверждаются: удаление Field закреплено отдельным пином, а
 * здесь важно, что кнопка именно спрашивает.
 */
function poke(node: Any): string {
  const tag = String(node.tagName || "");
  try {
    if (tag === "INPUT" && node.type === "checkbox") {
      if (typeof node.onclick === "function") node.onclick();
      else node.click();
      if (typeof node.onchange === "function") node.onchange();
      return "";
    }
    if (tag === "INPUT" || tag === "TEXTAREA") {
      node.value = TYPED;
      if (typeof node.oninput === "function") node.oninput();
      if (typeof node.onchange === "function") node.onchange();
      if (typeof node.onblur === "function") node.onblur();
      return "";
    }
    if (tag === "SELECT") {
      const options = node.children.filter((c: Any) => String(c.tagName) === "OPTION");
      const next = options.find((o: Any) => String(o.value || "") !== String(node.value || ""));
      if (!next) return "нет второго варианта";
      node.value = String(next.value || "");
      if (typeof node.onchange === "function") node.onchange();
      return "";
    }
    if (typeof node.onclick === "function") node.onclick();
    else node.click();
    return "";
  } catch (e) {
    return "падает: " + String((e as Error).message || e).slice(0, 60);
  }
}

/** Числа времени и случайные хвосты в путях приводятся к виду без даты. */
function steady(text: string): string {
  /* Единственная неустойчивая часть — метка времени в сгенерированных id.
     Правило про «случайный хвост» пришлось убрать: оно съедало осмысленные
     причины записи вроде `settings:pkm-subtab`. */
  return text.replace(/\d{10,}/g, "<time>");
}

/* ---- карта ------------------------------------------------------------ */

function sweep(expand: boolean, rows: string[]): number {
  const probe: Write[] = [];
  const { host } = render(probe, expand);
  const list = controls(host);
  const label = expand ? "раскрыто" : "свёрнуто";

  list.forEach((_node, index) => {
    /* Каждый контрол — на своей отрисовке: иначе нажатия влияют друг на друга. */
    const writes: Write[] = [];
    const fresh = render(writes, expand);
    const target = controls(fresh.host)[index];
    if (!target) {
      rows.push(label + " #" + index + " пропал при повторной отрисовке");
      return;
    }
    const name = label + " " + nameOf(target, index);
    const before = writes.length;
    const trouble = poke(target);
    const made = writes.slice(before);
    const calls = (fresh.plugin.calls as string[]).slice();

    const parts: string[] = [];
    if (trouble) parts.push(trouble);
    for (const w of made) parts.push(w.reason + " -> " + w.paths.join(", "));
    for (const c of calls) parts.push("вызов " + c);
    const outcome = parts.length ? parts.join(" | ") : "без записи";
    rows.push(name + "\n    " + steady(outcome));
  });
  return list.length;
}

/**
 * Составные сценарии: одиночного нажатия им не хватает. Добавление Field
 * требует имени, добавление своего тега — тоже; без этого две самые важные
 * записи редактора остались бы за картой.
 */
function scenarios(rows: string[]): void {
  const fill = (host: StubNode, placeholder: string, value: string): boolean => {
    const input = controls(host).find(n =>
      String(n.tagName) === "INPUT" && String(n.placeholder || "").includes(placeholder));
    if (!input) return false;
    input.value = value;
    if (typeof input.oninput === "function") input.oninput();
    if (typeof input.onchange === "function") input.onchange();
    return true;
  };
  const press = (host: StubNode, text: string): boolean => {
    const btn = controls(host).find(n => String(n.textContent || "").trim() === text);
    if (!btn) return false;
    try {
      if (typeof btn.onclick === "function") btn.onclick();
      else btn.click();
    } catch (e) {
      rows.push("    падает: " + String((e as Error).message || e).slice(0, 60));
    }
    return true;
  };

  {
    const writes: Write[] = [];
    const fresh = render(writes);
    const named = fill(fresh.host, "name_strict", "io_new");
    const pressed = press(fresh.host, "+ Add field");
    rows.push("сценарий [добавить Field с именем io_new]");
    rows.push("    " + (!named || !pressed
      ? "не нашёл контролы добавления"
      : writes.length
        ? steady(writes.map(w => w.reason + " -> " + w.paths.join(", ")).join(" | "))
        : "без записи"));
  }

  {
    const writes: Write[] = [];
    const fresh = render(writes);
    const named = fill(fresh.host, "#tag", "#io_map");
    const pressed = press(fresh.host, "+ user tag");
    rows.push("сценарий [добавить свой тег #io_map]");
    rows.push("    " + (!named || !pressed
      ? "не нашёл контролы добавления"
      : writes.length
        ? steady(writes.map(w => w.reason + " -> " + w.paths.join(", ")).join(" | "))
        : "без записи"));
  }

  /*
   * Родитель значения ссылки. Двух списков одиночным нажатием не снять: второй
   * наполняется только после выбора в первом, и на свежей отрисовке в нём один
   * вариант-заглушка. Поэтому сценарий: выбрать родительский Field, потом его
   * значение — и отдельно снять сброс, потому что пишет он другой причиной.
   */
  const choose = (raw: StubNode | undefined, index: number): StubNode | null => {
    if (!raw) return null;
    /* Обработчики доска ставит свойством (`onchange`), а не подписчиком, и в
       типах заглушки их нет: то же `Any`, что и в `poke`. */
    const sel: Any = raw;
    const options = sel.children.filter((c: Any) => String(c.tagName) === "OPTION");
    const opt = options[index];
    if (!opt) return null;
    sel.value = String(opt.value || "");
    if (typeof sel.onchange === "function") sel.onchange();
    else sel.dispatch("change");
    return sel as StubNode;
  };
  /** Список родительского Field узнаётся по подсказке: её он не меняет. */
  const parentFieldSelect = (host: StubNode): StubNode | undefined => controls(host).find(n =>
    String(n.tagName) === "SELECT" && String(n.title || "").includes("parent field for link binding"));
  /*
   * А список значений родителя — по своим вариантам: после выбора Field он
   * перезаписывает свой же `title` подписью выбранного значения, и по подсказке
   * его больше не найти. Значения биндинга начинаются с `p:` или `s:` — это
   * его форма, и она устойчивее любого текста.
   */
  const parentTokenSelect = (host: StubNode): StubNode | undefined => controls(host).find(n =>
    String(n.tagName) === "SELECT"
    && n.children.some((c: StubNode) => /^[ps]:/.test(String(c.value || ""))));

  {
    const writes: Write[] = [];
    const fresh = render(writes, true);
    const field = choose(parentFieldSelect(fresh.host), 1);
    const token = field ? choose(parentTokenSelect(fresh.host), 1) : null;
    rows.push("сценарий [привязать значение ссылки к родительскому значению]");
    rows.push("    " + (!field || !token
      ? "не нашёл списки родителя ссылки"
      : writes.length
        ? steady(writes.map(w => w.reason + " -> " + w.paths.join(", ")).join(" | "))
        : "без записи"));
  }

  {
    const writes: Write[] = [];
    const fresh = render(writes, true);
    const chosen = choose(parentFieldSelect(fresh.host), 1);
    const cleared = chosen ? choose(parentFieldSelect(fresh.host), 0) : null;
    rows.push("сценарий [снять родителя у значения ссылки]");
    rows.push("    " + (!chosen || !cleared
      ? "не нашёл список родительского Field"
      : writes.length
        ? steady(writes.map(w => w.reason + " -> " + w.paths.join(", ")).join(" | "))
        : "без записи"));
  }
}

function buildMap(): string {
  const rows: string[] = [];
  const collapsed = sweep(false, rows);
  const expanded = sweep(true, rows);
  scenarios(rows);

  const head = [
    "# Карта записей редактора Fields.",
    "# Снята с доски Order на заглушке DOM: каждый контрол нажат на свежей",
    "# отрисовке, записано то, что ушло в конфиг. Файл сверяется тестом",
    "# order_board_write_map_tests.ts и меняется только вместе с намеренным",
    "# изменением поведения редактора.",
    "# контролов: " + collapsed + " свёрнуто, " + expanded + " раскрыто",
    "",
  ];
  return head.concat(rows).join("\n") + "\n";
}

/* ---- запуск ----------------------------------------------------------- */

const actual = buildMap();

if (process.env["IO_UPDATE_WRITE_MAP"] === "1" || !fs.existsSync(GOLDEN)) {
  fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
  fs.writeFileSync(GOLDEN, actual, "utf8");
  console.log("карта записей записана: " + path.relative(root, GOLDEN));
  console.log("строк: " + actual.split("\n").length);
} else {
  const expected = fs.readFileSync(GOLDEN, "utf8");
  if (expected !== actual) {
    const e = expected.split("\n");
    const a = actual.split("\n");
    const diff: string[] = [];
    for (let i = 0; i < Math.max(e.length, a.length); i++) {
      if (e[i] !== a[i]) {
        diff.push("  строка " + (i + 1));
        diff.push("    было:  " + String(e[i]));
        diff.push("    стало: " + String(a[i]));
        if (diff.length > 30) break;
      }
    }
    console.log("Карта записей редактора Fields разошлась с закреплённой:");
    console.log(diff.join("\n"));
    console.log("\nЕсли поведение изменено намеренно:");
    console.log("  IO_UPDATE_WRITE_MAP=1 node tests/regression/order_board_write_map_tests.ts");
    assert.fail("карта записей разошлась");
  }
  console.log("карта записей совпадает: " +
    (/# контролов: (.+)/.exec(expected) || ["", "?"])[1]);
}
