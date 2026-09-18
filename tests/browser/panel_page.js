"use strict";

/**
 * Страница гейта: **настоящая сессия TagWheel в настоящем CodeMirror**.
 *
 * **Зачем она заведена.** Заказчик выбрал переезд панели с текста заметки на
 * накладку поверх строки (В-108), и порядок работ задал сам: сперва путь
 * измерения, потом переезд. Причина порядка названа в 114у и повторяется
 * здесь, потому что она и есть смысл этого файла: **вид панели не меряет ни
 * один из семи шагов**. Её рисует Obsidian из текста строки, и как только
 * полоса станет узлом, мерить её будет нечем — а TagWheel самая используемая
 * часть плагина. Недоделанная накладка дороже нынешнего дефекта.
 *
 * **Что здесь настоящее** (У-1): документ, история отмен
 * (`@codemirror/commands` — та же реализация, что в сборке Obsidian), слой
 * оформления заметки, рантайм `pkm_runtime_v2`, сама панель, разбор правил,
 * оверлей скроллера. Конфиг берётся из фикстуры репозитория **через
 * `migrateConfig`** (правило 2), правила собирает тот же строитель, что и
 * плагин, ключи рантайма досыпает общий `tests/harness/panel_bench.js`.
 *
 * **Что подделано и почему это ровно одна вещь.** Подделан `app` Obsidian:
 * `workspace` с активным редактором и `vault`, отдающий текст правил. Всё
 * остальное, что панель трогает, — настоящее. Прослойка `editor`, которой
 * Obsidian отдаёт плагину строки и курсор, взята из того же общего модуля,
 * что у стенда отмены, и лежит **поверх настоящего `EditorView`**: то есть
 * запись панели доезжает до экрана, а не до переменной.
 *
 * Числа наружу не выводятся: страница отдаёт измерения, утверждения о них
 * живут в `check_tagwheel.js`.
 */

const { EditorState } = require("@codemirror/state");
const { EditorView } = require("@codemirror/view");
const { history } = require("@codemirror/commands");
const decorations = require("../../src/ui/editor/decorations.js");
const visuals = require("../../src/core/editor_visuals_config.js");
const panelMask = require("../../src/ui/editor/panel_mask.js");
const runtime = require("../../src/pkm_runtime_v2.js");
const panelBench = require("../harness/panel_bench.js");

/* Посчитано в Node сборкой страницы: конфиг фикстуры после `migrateConfig`,
   текст правил и ключи рантайма. Своей копии этих правил у страницы нет. */
const FIXTURE = require("virtual:panel-fixture");

const CFG = FIXTURE.cfg;
/* `runInlineToNote` кнопка `→` зовёт по нажатию; на этой странице по ней не
   нажимают, но виджет спрашивает имя команды у реестра при отрисовке. */
const plugin = { getConfig: () => CFG, runInlineToNote: () => {} };

const view = new EditorView({
  state: EditorState.create({
    doc: FIXTURE.lines.join("\n"),
    extensions: [
      EditorView.lineWrapping,
      history(),
      decorations.createTagVisualDecorationExtension(plugin),
      /*
       * Отметки строки, и среди них плавающая кнопка `→`. Слой этот к панели
       * отношения не имеет — и потому здесь он и нужен: окно отрисовки рвёт
       * надвое **маска панели**, а платит за это сосед, который рисует по
       * строкам. Пока страница его не ставила, две кнопки заказчика ни один
       * из семи шагов увидеть не мог.
       */
      decorations.createSourceMarkDecorationExtension(plugin),
      decorations.createBlockFillLayerExtension(plugin),
      /*
       * Маска панели: что её полоса закрывает собой, прячется оформлением.
       * Ставится тем же вызовом, каким её ставит плагин (`mount.js`) — иначе
       * страница проверяла бы редактор, которого у человека нет.
       */
      panelMask.createPanelMaskExtension(),
    ],
  }),
  parent: document.getElementById("host"),
});

/* Прослойка Obsidian поверх настоящего редактора — общая со стендом отмены. */
const editor = panelBench.makeCmEditor(null, view);

/*
 * ПОДДЕЛКА OBSIDIAN, И ОНА НАЗВАНА (У-1). Панель спрашивает у `app` одно: где
 * активный редактор. Это наш редактор.
 *
 * **Vault под панелью — ловушка** (2026-09-13). Здесь лежала заметка правил, и
 * панель читала её с диска; правила приезжают ключом `Rules data`, который
 * кладёт слой команд (PRD 10.13.52, П-8, шаг третий). Ловушка и есть проверка:
 * пока страница отдавала текст правил, «панель взяла правила из настроек» и
 * «панель дочитала их с диска» выглядели одинаково (У-56).
 */
const vaultTrap = (p) => {
  throw new Error("панель полезла в vault за '" + String(p && p.path ? p.path : p) + "'");
};
const app = {
  workspace: { activeLeaf: { view: { editor } }, activeEditor: { editor } },
  vault: { getAbstractFileByPath: vaultTrap, read: vaultTrap, adapter: { read: vaultTrap } },
};

/* Панель говорит с человеком `Notice`-ами, и на странице их некому показать.
   Они не выбрасываются, а собираются: «панель промолчала» и «панель сказала,
   почему не открылась» — разные ответы (У-152). */
const said = [];
window.Notice = function Notice(message) { said.push(String(message)); };
globalThis.Notice = window.Notice;

const round = (n) => Math.round(Number(n) * 100) / 100;
const boxOf = (el) => {
  if (!el || typeof el.getBoundingClientRect !== "function") return null;
  const r = el.getBoundingClientRect();
  return {
    top: round(r.top), bottom: round(r.bottom), left: round(r.left),
    right: round(r.right), height: round(r.height), width: round(r.width),
  };
};

/** Узел строки документа по её номеру (с нуля). */
function lineEl(n) {
  const line = view.state.doc.line(Number(n) + 1);
  const at = view.domAtPos(line.from);
  const node = at && at.node ? (at.node.nodeType === 1 ? at.node : at.node.parentElement) : null;
  return node && node.closest ? node.closest(".cm-line") : null;
}

const START_DOC = view.state.doc.toString();

/** Открыть панель на строке: то же, что делает хоткей. */
window.__ioPanelOpen = async function (side, lineNumber) {
  const n = Number(lineNumber || 0);
  editor.setCursor({ line: n, ch: editor.getLine(n).length });
  said.length = 0;
  await runtime.runCommand({
    app,
    command: "tagWheel",
    settings: side === "right" ? FIXTURE.settingsRight : FIXTURE.settingsLeft,
  });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return window.__ioPanelProbe();
};

/**
 * Нажатие человека — **настоящее событие окна**, а не вызов обработчика.
 *
 * Панель вешает `keydown` на этап перехвата у `window`, и путь от клавиши до
 * неё есть часть предмета: подделка, зовущая обработчик напрямую, проверяла бы
 * половину дороги.
 */
window.__ioPanelKey = async function (key) {
  window.dispatchEvent(new KeyboardEvent("keydown", {
    key: String(key), code: String(key), bubbles: true, cancelable: true,
  }));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return window.__ioPanelProbe();
};

/**
 * `Ctrl+Z` на настоящей истории CodeMirror — то самое нажатие заказчика.
 *
 * Стенд `tools/undo_bench.js` меряет это же в Node и на большем числе случаев;
 * здесь оно спрашивается ещё раз, потому что здесь редактор **нарисован**: до
 * 2026-09-13 запись панели шла мимо экрана, и разойтись этим двум дорогам было
 * на чём.
 */
window.__ioPanelUndo = async function () {
  const ok = editor.undo();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { ok, doc: view.state.doc.toString(), unchanged: view.state.doc.toString() === START_DOC };
};

/**
 * Измерения, и все они — вопрос к браузеру.
 *
 * `lineText` — текст строки в документе, `lineDrawn` — то, что на этой строке
 * **нарисовано**. С 2026-09-13 это разные вещи, и в этом вся правка: полоса
 * панели встаёт **рядом** со значениями, а не вместо них, и документ получает
 * только вставку; всё, что полоса закрывает собой, прячется оформлением. То
 * есть написанное содержит строку человека целиком, а нарисованное равно тому
 * виду, который панель рисовала и прежде.
 */
window.__ioPanelProbe = function () {
  const st = window.__tagWheelState || null;
  const active = !!(st && st.active === true);
  const n = st && Number.isFinite(Number(st.lineNumber)) ? Number(st.lineNumber) : 0;
  const el = lineEl(n);
  const overlay = document.querySelector(".io-twscroller");
  const sel = view.state.selection.main;
  const line = view.state.doc.line(n + 1);
  return {
    active,
    said: said.slice(),
    lineNumber: n,
    lineText: line.text,
    lineDrawn: el ? String(el.textContent || "") : null,
    lineBox: boxOf(el),
    /* Спрятанное маской: сколько знаков строки человек не видит. */
    hiddenChars: Math.max(0, line.text.length - String(el ? el.textContent || "" : "").length),
    /*
     * **Сколько кусков у отрисованного окна** — условие, при котором живёт
     * дефект двух кнопок. Спрашивается у платформы, а не выводится из длины
     * спрятанного: порог `minPointSize` принадлежит CodeMirror, и своя копия
     * этого числа разошлась бы с ним молча (У-32).
     */
    viewportPieces: view.visibleRanges.length,
    /* Плавающих кнопок `→` на этой строке — вопрос к браузеру. */
    flyOnLine: el ? el.querySelectorAll(".io-flybtn").length : -1,
    flyTotal: document.querySelectorAll(".io-flybtn").length,
    /*
     * **Сколько подложек Blocks стоит ровно на своей копии.** Кнопка — не
     * единственный слой, который ходит по строкам; у подложки второй проход
     * даёт прямоугольник, совпадающий с первым до точки, и на экране его не
     * видно. Считается он здесь, чтобы правило держалось за **все** слои, а не
     * за тот, которым дефект нашли (У-159).
     */
    bandTotal: document.querySelectorAll("." + visuals.BLOCK_FILL_MARKER_CLASS).length,
    bandTwins: (() => {
      const seen = Object.create(null);
      let twins = 0;
      for (const node of document.querySelectorAll("." + visuals.BLOCK_FILL_MARKER_CLASS)) {
        const r = node.getBoundingClientRect();
        const key = [round(r.top), round(r.left), round(r.width), round(r.height)].join("/");
        if (seen[key]) twins += 1;
        seen[key] = true;
      }
      return twins;
    })(),
    overlayBox: boxOf(overlay),
    overlayRows: overlay ? overlay.querySelectorAll(".io-twscroller__row").length : 0,
    doc: view.state.doc.toString(),
    docUnchanged: view.state.doc.toString() === START_DOC,
    cursor: { head: sel.head, ch: sel.head - line.from },
    startDoc: START_DOC,
  };
};
