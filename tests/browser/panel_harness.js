"use strict";

/**
 * Сборка страницы с настоящей сессией TagWheel и её подмены.
 *
 * **Фикстура считается здесь, в Node, а не на странице.** Конфиг для проверки
 * берётся из фикстуры репозитория через `migrateConfig` (правило 2), а тот
 * тянет за собой пол-ядра и чтение файла. Страница получает готовый ответ
 * модулем `virtual:panel-fixture`; своих правил у неё нет ни одного.
 *
 * **Фикстура — та, что лежит в репозитории** (`config_v1_realistic.json`).
 * Первая версия этого файла взяла соседний снимок настроек заказчика, и
 * `repo_completeness_tests.js` уронил набор той же минутой: имя того снимка —
 * маска **приватного**, его нет ни в репозитории, ни у CI, ни на свежем клоне.
 * Это ровно тот класс, ради которого сторож заведён (У-78), и он сработал
 * раньше, чем я успел объявить работу сохранённой.
 */

const fs = require("fs");
const path = require("path");

const { root, openEditor } = require("./editor_harness.js");

const normalize = require(path.join(root, "src", "core", "config_normalize.js"));
const orderCfg = require(path.join(root, "src", "core", "pkm_order_config.js"));
const registry = require(path.join(root, "src", "features", "command_registry.js"));
const shared = require(path.join(root, "src", "core", "shared_utils.js"));
const panelBench = require(path.join(root, "tests", "harness", "panel_bench.js"));

const FIXTURE_PATH = path.join(root, "tests", "fixtures", "config_v1_realistic.json");

/* Свой текст значения для коробки скроллера — одно объявление на фикстуру и
   на утверждение о нём (У-32). */
const SCROLLER_CUSTOM_TEXT = "\u{1F3AF}";

/**
 * Строки страницы — те же, на которых он приносил замечание про `Ctrl+Z`:
 * значения стоят **в противоположном Block**. Второй строкой стоит та, где
 * значения есть и в том Block, на котором панель открывается, — разница между
 * ними и есть граница дефекта (У-164), и стенд отмены уже знает обе.
 *
 * **Разделители берутся из самой фикстуры.** Написанные рядом литералом, они
 * разошлись бы с её настройками молча: панель тогда считает всю строку текстом
 * человека, и страница проверяла бы случай, которого у него нет.
 */
function linesFor(cfg) {
  const sep1 = String(shared.readCfgPath(cfg, "pkm.lineFormat.separator1") || "::");
  const sep2 = String(shared.readCfgPath(cfg, "pkm.lineFormat.separator2") || "::");
  return [
    "- " + sep1 + " 1231 " + sep2 + " \u{1F464}111",
    "- #work " + sep1 + " 1231 " + sep2 + " \u{1F464}111",
    /*
     * Третья строка — **та, на которой окно отрисовки разрывается**. Маска
     * панели прячет значения противоположного Block, а CodeMirror считает
     * отрисованное окно по декорациям состояния и режет его там, где стоит
     * замена **длиной от двадцати знаков** (`minPointSize` в
     * `computeVisibleRanges`). У первых двух строк прятать нечего или почти
     * нечего — девять знаков, — и разрыва там не бывает ни разу: то есть
     * правило «строку обходим по разу» проверялось бы на строках, где
     * обходить её дважды не с чего (У-113).
     *
     * Заказчик принёс это 2026-09-13 как «при наличии values в left block при
     * открытии tagwheel right я вижу две кнопки i2n-floating».
     */
    "- [ ] #work #new #todo #/1 " + sep1 + " 1231 " + sep2 + " \u{1F464}111",
  ];
}

/**
 * Подмены страницы панели.
 *
 * Пока полоса панели есть разметка в тексте заметки, проверять на ней нечего,
 * кроме того, что сессия вообще живёт и доезжает до экрана. Поэтому подмены
 * здесь ломают **дорогу**, а не вид: сессию, запись на экран и оверлей. Каждая
 * обязана уронить проверку — иначе проверка не смотрит на то, что подменили.
 */
const PANEL_INJECTIONS = {
  /*
   * Панель не открывается вовсе: `runTagWheel` уходит на ветку отказа. Ровно
   * это состояние двенадцать проверок применения считали зелёным (У-152) —
   * движок возвращал строку нетронутой, и «ничего не сломано» читалось как
   * «работает».
   */
  "panel-never-opens": {
    file: "src/pkm_v2/TagWheel/tagwheel.js",
    find: "    window.__tagWheelState = state",
    replace: "    window.__tagWheelState = state\n    if (state) { state.active = false; return }",
  },
  /*
   * Запись вида панели до экрана не доезжает: сессия жива, строка прежняя.
   * Это то состояние, в которое переезд на накладку легко превратить
   * наполовину — панель есть, а человек её не видит.
   */
  "panel-draws-nothing": {
    file: "src/pkm_v2/TagWheel/tagwheel.js",
    find: "  function drawPanelLine(state, controlLine) {",
    replace: "  function drawPanelLine(state, controlLine) {\n    if (state) return",
  },
  /*
   * `Esc` перестаёт возвращать строку человека: сессия закрывается, а в
   * заметке остаётся вид панели. Так она и оставалась при выгрузке плагина до
   * Д-2, и человек находил это уже в файле.
   */
  "cancel-keeps-panel": {
    file: "src/pkm_v2/TagWheel/tagwheel.js",
    find: "    clearPanelMask(state)\n    unwritePanelLine(state)\n"
      + "    state.editor.setCursor({ line: state.lineNumber, ch: state.originalLine.length })",
    replace: "    state.editor.setCursor({ line: state.lineNumber, ch: state.originalLine.length })",
  },
  /*
   * Полоса обратно встаёт **на место** значений, а не рядом: план записи не
   * складывается, и панель уходит на свой запасной путь — тот самый, каким она
   * писала до 2026-09-13. Это и есть состояние, из которого пришло замечание
   * «нажимал ctrl+z — получил строку, которой не было».
   */
  "panel-writes-over-values": {
    file: "src/core/panel_line_write.js",
    find: "function planPanelLineWrite(originalLine, controlLine) {",
    replace: "function planPanelLineWrite(originalLine, controlLine) {\n  if (originalLine !== null) return null;",
  },
  /*
   * План есть, а маски нет: в заметке всё цело, но человек видит и полосу, и
   * значения, которые она закрывает. Половина правки, и видна она только
   * глазами — то есть ровно то, ради чего эта страница заведена.
   */
  "panel-mask-never-hides": {
    file: "src/ui/editor/panel_mask.js",
    find: "  const ranges = maskRanges(state);",
    replace: "  const ranges = [];",
  },
  /*
   * Нажатие до панели не доезжает: перехват у окна не поставлен. Сессия при
   * этом жива и нарисована — то есть проверка, спрашивающая только «панель
   * открылась», осталась бы зелёной.
   */
  "keys-never-arrive": {
    file: "src/pkm_v2/TagWheel/tagwheel.js",
    find: "    window.addEventListener('keydown', state.keyHandler, true)",
    replace: "    if (!state) window.addEventListener('keydown', state.keyHandler, true)",
  },
  /*
   * Оверлей скроллера не рисуется: якоря нет, коробке негде встать. Он стоит
   * поверх редактора и переезжает вместе с панелью — правка, которая забудет
   * его, оставит человека без подсказки о том, какие значения есть у поля.
   */
  /*
   * Обход отрисованного окна возвращается к тому виду, в котором он жил в
   * четырёх местах до 2026-09-14: по отрезку, без памяти о пройденном. На
   * строке, где маска панели разрывает окно надвое, строка проходится дважды —
   * и в её конце встают две кнопки `→`. Это ровно то, что заказчик увидел.
   */
  "viewport-pieces-revisited": {
    file: "src/ui/editor/decorations.js",
    find: "    for (let n = Math.max(from, done + 1); n <= to; n += 1) out.push(n);",
    replace: "    for (let n = from; n <= to; n += 1) out.push(n);",
  },
  /*
   * Кнопка `→` снова рисуется поверх открытой панели — состояние до
   * 2026-09-14. Его слово: «при открытии tagwheel кнопка i2n-floating не
   * должна отображаться»; и нажатие по ней унесло бы в новую заметку разметку
   * полосы вместе с текстом человека.
   */
  "flybtn-during-panel": {
    file: "src/ui/editor/decorations.js",
    find: "  if (tagwheelPanelSegmentInLine(text)) return -1;",
    replace: "  if (!text) return -1;",
  },
  "scroller-silent": {
    file: "src/ui/tagwheel_scroller_overlay.js",
    find: "function getAnchorRect(editor, lineNumber, controlLine) {\n  try {",
    replace: "function getAnchorRect(editor, lineNumber, controlLine) {\n  if (editor) return null;\n  try {",
  },
};

/** Конфиг фикстуры, правила и ключи — всё теми же функциями, что у плагина. */
function buildFixture() {
  const cfg = normalize.migrateConfig(JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")));
  /*
   * **Режим подписей коробки открывает сама страница** (У-112): умолчание контрола —
   * то состояние, в котором проверять нечего. Свой текст задан **одному** значению
   * нарочно: второе остаётся отрицательным контролем — коробка обязана показать
   * его как написано, иначе «при наличии» было бы не проверено ничем.
   */
  cfg.visual.tagWheel.scroller.labels = "custom";
  cfg.visual.tags.byTag = cfg.visual.tags.byTag || {};
  cfg.visual.tags.byTag.Importance = Object.assign({}, cfg.visual.tags.byTag.Importance, {
    "#/2": { visibility: "custom", customText: SCROLLER_CUSTOM_TEXT, fillColor: "", textColor: "" },
  });
  const defs = registry.buildPkmCommandDefs(
    orderCfg.serializePkmOrderForMacro,
    orderCfg.serializeDateRuntimeConfigForMacro,
    orderCfg.normalizePkmOrder,
    cfg,
    ["navigation", "editor", "pkm", "visual", "transform", "advanced"]
  );
  const defById = (id) => {
    const hit = defs.filter((d) => d.id === id)[0];
    if (!hit) throw new Error("в фикстуре нет команды " + id + " — панель этой страницей не открыть");
    return hit;
  };
  const pane = panelBench.paneSettings(cfg);
  const settingsLeft = Object.assign({}, pane, defById("open-tagwheel-left").makeSettings(cfg));
  /*
   * Положительный контроль на саму фикстуру: правила приезжают панели ключом
   * `Rules data` (PRD 10.13.52, П-8, шаг третий), и если слой команд их не
   * положил, панель не откроется вовсе — а страница показала бы это как «нет
   * подсветки» и увела бы разбор в сторону (У-152).
   */
  const rules = settingsLeft["Rules data"];
  if (!rules || !rules.io || !rules.behavior) {
    throw new Error("в настройках команды нет правил — панели нечего было бы показать");
  }
  return {
    cfg,
    lines: linesFor(cfg),
    settingsLeft,
    settingsRight: Object.assign({}, pane, defById("open-tagwheel-right").makeSettings(cfg)),
  };
}

async function openPanel(injection) {
  return openEditor(injection, {
    entry: "panel_page.js",
    injections: PANEL_INJECTIONS,
    ready: "__ioPanelProbe",
    virtual: { "virtual:panel-fixture": buildFixture() },
  });
}

module.exports = { PANEL_INJECTIONS, openPanel, buildFixture, SCROLLER_CUSTOM_TEXT };
