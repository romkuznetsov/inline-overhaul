"use strict";

/**
 * Свои блоки `<style>`: ставятся, обновляются и снимаются (кусок четвёртый
 * разбора `main.js`, 2026-09-07).
 *
 * **Чего здесь не было до сегодня.** Правила каретки закрыты проверкой
 * (`caret_color_tests.ts` — она про текст правил), а вот **постановка** узла
 * не проверялась ничем: ни того, что узел один, ни того, что он обновляется
 * при правке настройки, ни того, что при выгрузке он снимается. Между «правила
 * собраны верно» и «человек видит цвет» лежит ровно этот шов, и он трижды был
 * местом дефекта (У-67 каскад, У-75 две копии CodeMirror, У-76 сторона
 * измерения каретки).
 *
 * **Что подделано:** `document` — его в Node нет. Всё остальное настоящее:
 * сам модуль, его состояние на объекте плагина, подписка на хранилище (У-1).
 */

const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const visuals = require(path.join(ROOT, "src", "core", "editor_visuals_config.js"));

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

function assertTrue(value, name) {
  if (!value) throw new Error(`${name}: expected truthy`);
}

/** Голова документа: только то, о чём модуль её и просит. */
function installDocumentStub() {
  const head = {
    children: [],
    appendChild(node) {
      node.parentNode = head;
      head.children.push(node);
      return node;
    },
    removeChild(node) {
      const i = head.children.indexOf(node);
      if (i >= 0) head.children.splice(i, 1);
      node.parentNode = null;
      return node;
    },
  };
  const previous = globalThis.document;
  globalThis.document = {
    head,
    createElement() {
      return {
        attrs: {},
        textContent: "",
        parentNode: null,
        setAttribute(name, value) { this.attrs[String(name)] = String(value); },
      };
    },
  };
  return { head, restore() { globalThis.document = previous; } };
}

/**
 * Голова документа, в которой создать узел нельзя.
 *
 * Настоящий случай, а не выдумка: `createElement` бросает, когда документа уже
 * нет — окно выгружается, а подписка ещё жива.
 */
function installBrokenDocumentStub() {
  const previous = globalThis.document;
  globalThis.document = {
    head: { appendChild() { throw new Error("головы документа больше нет"); } },
    createElement() { throw new Error("документа больше нет"); },
  };
  return { restore() { globalThis.document = previous; } };
}

function makePlugin(cfg) {
  const listeners = [];
  const unregistered = [];
  return {
    cfg,
    listeners,
    unregistered,
    getConfig() { return this.cfg; },
    register(fn) { unregistered.push(fn); },
    store: {
      subscribe(listener) {
        listeners.push(listener);
        return () => { listeners.splice(listeners.indexOf(listener), 1); };
      },
    },
    devLogEvent() {},
  };
}

function configWithCaret(color, width) {
  return {
    visual: { caret: { enabled: true, color, widthPx: width } },
    advanced: { devMode: { enabled: false } },
  };
}

function run() {
  const dom = installDocumentStub();
  try {
    const styles = require(path.join(ROOT, "src", "ui", "editor", "styles.js"));

    /* --- каретка: узел один, текст из настройки, обновление по подписке --- */
    {
      const plugin = makePlugin(configWithCaret("#ff0000", 3));
      styles.ensureCaret(plugin);
      const nodes = dom.head.children.filter((n) => n.attrs["data-inline-overhaul"] === "caret");
      assertEq(nodes.length, 1, "узел каретки поставлен один");
      const expected = visuals.buildCaretStyleCss(visuals.caretLookFromConfig(plugin.cfg));
      assertTrue(String(expected).length > 0, "положительный контроль: правила каретки непусты");
      assertEq(nodes[0].textContent, expected, "в узле — те же правила, что собирает движок вида");

      /* Второй вызов узла не плодит: ветка «уже стоит» и есть та, что держит
         голову документа чистой. */
      styles.ensureCaret(plugin);
      assertEq(dom.head.children.filter((n) => n.attrs["data-inline-overhaul"] === "caret").length, 1,
        "повторный вызов второго узла не заводит");

      /* Человек поменял цвет: подписка на хранилище обязана обновить текст —
         не перерисовкой панели, она откладывается до ухода фокуса. */
      const before = nodes[0].textContent;
      plugin.cfg = configWithCaret("#00ff00", 3);
      assertTrue(plugin.listeners.length > 0, "подписка на хранилище оформлена");
      for (const listener of plugin.listeners) listener();
      assertTrue(nodes[0].textContent !== before, "текст правил обновился под рукой");
      assertEq(nodes[0].textContent,
        visuals.buildCaretStyleCss(visuals.caretLookFromConfig(plugin.cfg)),
        "и обновился на то, что говорит новая настройка");
    }

    /* --- заливка панели и полосы: свой узел с готовым текстом ------------- */
    {
      /* Своя голова документа: узел прошлого блока принадлежит другому
         объекту плагина, и в счёте он был бы чужим. */
      dom.head.children.length = 0;
      const plugin = makePlugin(configWithCaret("#ff0000", 2));
      styles.ensureTagwheelFill(plugin);
      styles.ensureStripLine(plugin);
      const fill = dom.head.children.find((n) => n.attrs["data-inline-overhaul"] === "tagwheel-fill");
      const strip = dom.head.children.find((n) => n.attrs["data-inline-overhaul"] === "strip-line");
      assertTrue(fill, "узел заливки панели поставлен");
      assertTrue(strip, "узел полос поставлен");
      assertEq(fill.textContent, visuals.TAGWHEEL_FILL_STYLE_CSS, "в заливке — её правила");
      assertEq(strip.textContent, visuals.STRIP_LINE_STYLE_CSS, "в полосах — их правила");

      /* --- выгрузка: все три узла снимаются, и снимает их одно место ------ */
      styles.ensureCaret(plugin);
      const mine = () => dom.head.children.filter((n) => n.attrs["data-inline-overhaul"]).length;
      assertEq(mine(), 3, "положительный контроль: до снятия все три узла в голове документа");
      styles.removeAll(plugin);
      assertEq(mine(), 0, "после снятия своих узлов в голове документа нет");
      assertEq(plugin._caretStyleEl, null, "и ссылки на узлы забыты");
      assertEq(plugin._stripLineStyleEl, null, "все три");
      assertEq(plugin._tagwheelFillStyleEl, null, "до последней");
    }

    /*
     * --- отказ постановки называется вслух (Д-4, 2026-09-09) ---
     *
     * Прежде все четыре постановки молчали по-разному: `ensureStripLine`
     * писала в журнал, три соседки — ничего. Человек, у которого оформление не
     * встало, приходит со словами «перестало работать», и журнал —
     * единственное, из чего можно узнать, почему.
     *
     * Ломается **создание узла**: другого способа заставить постановку
     * отказать в этой подделке нет, а способ этот настоящий — `createElement`
     * бросает, когда документа уже нет (выгрузка окна).
     */
    {
      const broken = installBrokenDocumentStub();
      try {
        for (const [what, call] of [
          ["tagwheel-fill", (p) => styles.ensureTagwheelFill(p)],
          ["caret", (p) => styles.ensureCaret(p)],
          ["block-fill", (p) => styles.ensureBlockFill(p)],
        ]) {
          const plugin = makePlugin(configWithCaret("#ff0000", 3));
          const said = [];
          plugin.devLogEvent = (name, payload, level) => said.push({ name, payload, level });

          /* Отказ не выходит наружу: постановка стилей не имеет права уронить
             загрузку плагина. */
          call(plugin);

          const errors = said.filter((s) => s.level === "error");
          assertEq(errors.length, 1, "отказ постановки `" + what + "` назван один раз");
          assertEq(errors[0].name, "styles.inject", "и назван общим событием");
          assertEq(errors[0].payload.what, what, "с именем того блока, который не встал");
          assertTrue(String(errors[0].payload.message).length > 0,
            "и с причиной, а не пустой пометкой: " + JSON.stringify(errors[0].payload));
        }

        /*
         * И положительный контроль к этому: **пересборка** молчит нарочно. Она
         * зовётся на каждое движение ползунка, и запись отсюда залила бы
         * журнал целиком. Отличить «молчит нарочно» от «забыли сказать» можно
         * только так — спросив обе стороны (У-88).
         */
        const quiet = makePlugin(configWithCaret("#ff0000", 3));
        const heard = [];
        quiet.devLogEvent = (name, payload, level) => heard.push(level);
        quiet._caretStyleEl = { textContent: "" };
        Object.defineProperty(quiet._caretStyleEl, "textContent", {
          get() { return ""; },
          set() { throw new Error("узел отсоединён"); },
        });
        styles.refreshCaret(quiet);
        assertEq(heard.filter((l) => l === "error").length, 0,
          "пересборка каретки молчит: журнал не заливается движением ползунка");
      } finally {
        broken.restore();
      }
    }

    console.log("  ok свои блоки правил: один узел, обновление под рукой, снятие при выгрузке");
    console.log("Editor styles tests: OK");
  } finally {
    dom.restore();
  }
}

run();
