"use strict";

/**
 * Общая часть стендов, гоняющих настоящую панель TagWheel.
 *
 * **Зачем одно место.** Стендов стало три — `tools/line_bench.js`,
 * `tools/undo_bench.js` и страница браузерного гейта, — и каждый объявлял по
 * своей копии одного и того же: какие ключи досыпает рантайм поверх команды и
 * как выглядит редактор, который плагин получает от Obsidian. Две копии
 * `paneSettings` уже разъехались на одну строку, и заметить это было нечем:
 * расхождение видно только тем, что панель на одном стенде ведёт себя иначе,
 * чем на другом (У-32).
 *
 * **Что здесь есть и чего нет.** Здесь только то, что одинаково у всех трёх и
 * не зависит от файловой системы: браузеру `fs` не отдать. Всё, что читает
 * vault, остаётся у того стенда, который его читает.
 */

const runtimeSettings = require("../../src/core/runtime_settings.js");
const cmState = require("@codemirror/state");
const cmCommands = require("@codemirror/commands");

/**
 * Ключи, которые досыпает `runPkmRuntime` поверх определения команды.
 *
 * Список неполный по устройству: команда приносит своё, а это — общее для
 * всех. Разойтись с рантаймом он может только вместе с самим рантаймом,
 * поэтому сверяется он поведением стенда, а не переписью.
 */
function paneSettings(cfg) {
  return runtimeSettings.runtimeSettingsFromConfig(cfg);
}

/**
 * Редактор Obsidian поверх настоящего документа CodeMirror с историей отмен.
 *
 * Подделан здесь **Obsidian**, а не CodeMirror (У-1): документ, история и
 * ступени — настоящие (`@codemirror/state`, `@codemirror/commands` — та же
 * реализация, что лежит в сборке Obsidian), а поддельна прослойка `editor`,
 * которой Obsidian отдаёт плагину строки и курсор.
 *
 * **Часы двигаются на шаг перед каждым действием.** CodeMirror склеивает
 * соседние по времени изменения в одну ступень, и без этого набор человека и
 * запись плагина оказались бы одной ступенью — то есть половина дефекта была
 * бы не видна (У-104).
 *
 * `view` можно отдать снаружи: на странице браузера редактор настоящий и
 * нарисованный, и подделывать его нечем и незачем.
 */
function makeCmEditor(initial, existingView) {
  const view = existingView || {
    state: cmState.EditorState.create({
      doc: String(initial || ""),
      extensions: [cmCommands.history()],
    }),
  };
  if (!existingView) {
    view.dispatch = function (spec) { view.state = view.state.update(spec).state; };
  }
  /*
   * Отмена отдаёт **готовую ступень**, а не описание правки, и принимают их
   * по-разному: настоящий `EditorView.dispatch` берёт и то и другое, а
   * подделка выше умеет только описание. Поэтому путь применения ступени
   * назван отдельно — иначе `Ctrl+Z` на странице браузера молча не сделал бы
   * ничего.
   */
  const applyTransaction = existingView
    ? (tr) => { view.dispatch(tr); }
    : (tr) => { view.state = tr.state; };
  let clock = 1000;
  let cur = { line: 0, ch: 0 };
  const lineAt = (n) => view.state.doc.line(Number(n || 0) + 1);
  const tick = () => { clock += 1000; return cmState.Transaction.time.of(clock); };
  return {
    cm: view,
    doc() { return view.state.doc.toString(); },
    getCursor() { return { line: cur.line, ch: cur.ch }; },
    /*
     * У настоящего редактора курсор не только запоминается, но и **ставится**:
     * Obsidian двигает выделение, и от него зависит всё, что рисуется по
     * координатам курсора, — оверлей скроллера в первую очередь. На подделке
     * ставить нечего, и там остаётся только память.
     */
    setCursor(next) {
      cur = { line: Number((next && next.line) || 0), ch: Number((next && next.ch) || 0) };
      if (!existingView) return;
      const line = lineAt(cur.line);
      const at = line.from + Math.max(0, Math.min(line.length, cur.ch));
      view.dispatch({ selection: { anchor: at, head: at } });
    },
    getLine(n) { return lineAt(n === undefined ? cur.line : n).text; },
    lastLine() { return view.state.doc.lines - 1; },
    lineCount() { return view.state.doc.lines; },
    /*
     * Перевод «строка и столбец» ↔ «смещение» Obsidian отдаёт плагину наравне
     * с чтением строк, и без него **оверлей скроллера не рисуется вовсе**:
     * место коробки он спрашивает у координат смещения. Пока этой пары в
     * прослойке не было, страница показывала пустой прямоугольник, и это
     * читалось бы как «оверлея нет» — то есть проверка мерила бы отсутствие
     * предмета (У-88).
     */
    posToOffset(pos) {
      const line = lineAt((pos && pos.line) || 0);
      return line.from + Math.max(0, Math.min(line.length, Number((pos && pos.ch) || 0)));
    },
    offsetToPos(offset) {
      const at = Math.max(0, Math.min(view.state.doc.length, Number(offset) || 0));
      const line = view.state.doc.lineAt(at);
      return { line: line.number - 1, ch: at - line.from };
    },
    setLine(n, v) {
      const line = lineAt(n);
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: String(v == null ? "" : v) },
        userEvent: "input", annotations: tick(),
      });
    },
    replaceRange(v, from, to) {
      const line = lineAt(from && from.line !== undefined ? from.line : cur.line);
      const a = line.from + Math.max(0, Math.min(line.length, Number((from && from.ch) || 0)));
      const b = to && to.ch !== undefined
        ? line.from + Math.max(0, Math.min(line.length, Number(to.ch)))
        : a;
      view.dispatch({
        changes: { from: a, to: Math.max(a, b), insert: String(v == null ? "" : v) },
        userEvent: "input", annotations: tick(),
      });
    },
    /** Нажатия человека: настоящая вставка, своей ступенью. */
    type(text, at) {
      view.dispatch({
        changes: { from: at, insert: String(text) },
        userEvent: "input.type", annotations: tick(),
      });
    },
    undo() {
      return cmCommands.undo({ state: view.state, dispatch: applyTransaction });
    },
    /*
     * Возврат отменённого. Заведён по его пункту 13, 2026-09-22: «сейчас
     * обычный ctrl+y не антагонистичен ctrl+z… я могу отменить ввод с ctrl+z,
     * но потом ctrl+y не возвращает обратно». Ответ на это меряется, а не
     * выводится, и мерить его нечем, пока у стенда есть только отмена.
     */
    redo() {
      return cmCommands.redo({ state: view.state, dispatch: applyTransaction });
    },
  };
}

module.exports = { paneSettings, makeCmEditor };
