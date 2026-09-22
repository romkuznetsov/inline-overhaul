"use strict";

/**
 * Страница стенда прокрутки: **настоящий CodeMirror и настоящий перенос
 * текста**.
 *
 * Собирается `tools/move_scroll_bench.js`; сама по себе не запускается.
 *
 * **Что здесь настоящее и что подделано** (У-1):
 *
 *   * настоящие — `EditorView` и `EditorState` из `@codemirror/view` и
 *     `@codemirror/state`, то есть тот самый редактор, на котором собрана
 *     заметка Obsidian, и `moveSelection` из `src/navigation_runtime.js` без
 *     единой копии;
 *   * подделан — **редактор Obsidian**, обёртка `Editor`. Её тут нет, и
 *     каждый её метод ниже списан с `app.js` 1.13.7: не по смыслу слова, а по
 *     телу (У-170). Важны в ней ровно две строки — `setValue` шлёт замену
 *     всего документа, `replaceRange` шлёт окно с `scrollIntoView`, — и
 *     подделка, написавшая их «как удобно», отвечала бы на свой вопрос, а не
 *     на его.
 *
 * Чисел страница не толкует: она отдаёт прокрутку до и после, а утверждения о
 * них живут в стенде.
 */

const { EditorState } = require("@codemirror/state");
const { EditorView } = require("@codemirror/view");
const { codeFolding, foldEffect, foldedRanges } = require("@codemirror/language");
const nav = require("../src/navigation_runtime.js");

/* `AL` из `app.js` 1.13.7: место документа по строке и знаку. */
function posToOffset(doc, p) {
  if (p.line < 0) return 0;
  const n = p.line + 1;
  if (n > doc.lines) return doc.length;
  const line = doc.line(n);
  if (!Number.isFinite(p.ch)) return line.to;
  return p.ch < 0 ? line.from + Math.max(0, line.length + p.ch) : line.from + p.ch;
}

/* `PL` из `app.js` 1.13.7: строка и знак по месту документа. */
function offsetToPos(doc, off) {
  const at = Math.max(0, Math.min(doc.length, Number(off) || 0));
  const line = doc.lineAt(at);
  return { line: line.number - 1, ch: at - line.from };
}

/**
 * Обёртка `Editor` Obsidian, списанная с `app.js` 1.13.7.
 *
 * Две строки, ради которых стенд и заведён:
 *
 *   * `setValue` — `dispatch({changes:{from:0,to:doc.length,insert:e}})`, то
 *     есть замена **всего** документа;
 *   * `replaceRange` — `dispatch({changes:{…}, scrollIntoView:!0, userEvent:i})`,
 *     то есть окно и просьба показать выделение «ближайшим» образом.
 */
function obsidianEditor(view) {
  const doc = () => view.state.doc;
  const ed = {
    getValue: () => doc().toString(),
    setValue: (v) => { view.dispatch({ changes: { from: 0, to: doc().length, insert: v } }); },
    getLine: (n) => (n >= doc().lines ? "" : doc().line(n + 1).text),
    lineCount: () => doc().lines,
    lastLine: () => doc().lines - 1,
    getSelection: () => {
      const m = view.state.selection.main;
      return doc().sliceString(m.from, m.to);
    },
    getRange: (a, b) => doc().sliceString(posToOffset(doc(), a), posToOffset(doc(), b)),
    replaceRange: (text, from, to, userEvent) => {
      const d = doc();
      const a = posToOffset(d, from);
      const b = to ? posToOffset(d, to) : a;
      view.dispatch({ changes: { from: a, to: b, insert: text }, scrollIntoView: true, userEvent: userEvent });
    },
    getCursor: (which) => {
      const m = view.state.selection.main;
      const d = doc();
      if (which === "from") return offsetToPos(d, m.from);
      if (which === "to") return offsetToPos(d, m.to);
      if (which === "anchor") return offsetToPos(d, m.anchor);
      return offsetToPos(d, m.head);
    },
    listSelections: () => view.state.selection.ranges.map((r) => ({
      anchor: offsetToPos(doc(), r.anchor),
      head: offsetToPos(doc(), r.head),
    })),
    setSelection: (a, b) => {
      const d = doc();
      const anchor = posToOffset(d, a);
      const head = b ? posToOffset(d, b) : anchor;
      view.dispatch({ selection: { anchor: anchor, head: head }, scrollIntoView: true });
    },
    setCursor: (p, ch) => ed.setSelection(typeof p === "number" ? { line: p, ch: ch || 0 } : p),
    setLine: (n, t) => ed.replaceRange(t, { line: n, ch: 0 }, { line: n, ch: ed.getLine(n).length }),
    posToOffset: (p) => posToOffset(doc(), p),
    offsetToPos: (off) => offsetToPos(doc(), off),
    getScrollInfo: () => {
      const s = view.scrollDOM;
      return {
        top: s.scrollTop, left: s.scrollLeft,
        clientHeight: s.clientHeight, clientWidth: s.clientWidth,
        height: s.offsetHeight, width: s.offsetWidth,
      };
    },
    scrollTo: (x, y) => {
      const s = view.scrollDOM;
      s.scroll(x == null ? s.scrollLeft : x, y == null ? s.scrollTop : y);
    },
    scrollIntoView: (range, center) => {
      view.dispatch({
        effects: EditorView.scrollIntoView(posToOffset(doc(), range.from), { y: center ? "center" : "nearest" }),
      });
    },
    focus: () => view.focus(),
    cm: view,
  };
  return ed;
}

let view = null;
let editor = null;

const frame = () => new Promise((done) => window.requestAnimationFrame(() => done()));

window.__ioMoveBench = {
  /** Собрать заметку и поставить выделение на слово рабочей строки. */
  async build(spec) {
    const host = document.getElementById("host");
    host.textContent = "";
    view = new EditorView({
      /*
       * Перенос по ширине включён: так рисует заметку и Obsidian. Он тут не
       * украшение — у строк разная высота, и карта высот перестаёт быть
       * таблицей одинаковых чисел. На заметке из строк одного роста «прокрутка
       * не изменилась» выполнялось бы само (У-147).
       */
      state: EditorState.create({
        doc: spec.doc,
        /*
         * Свёрнутые куски — не украшение страницы, а вторая половина вопроса.
         * Свёртка живёт полем состояния и переносится через изменение: у
         * записи, которая заменяет документ целиком, переносить её не на что,
         * и заметка разворачивается вся разом. Ровно это человек и видит как
         * «прыгает экран».
         */
        extensions: [EditorView.lineWrapping, codeFolding()],
      }),
      parent: host,
    });
    editor = obsidianEditor(view);
    /*
     * Фокус — не украшение: у CodeMirror от него зависит и то, как он
     * возвращает прокрутку, и то, рисует ли он каретку. Редактор без фокуса —
     * подделка добрее браузера (У-45): человек работает в том, где курсор его.
     */
    view.focus();
    if (spec.fold) {
      const a = view.state.doc.line(spec.fold.from + 1);
      const b = view.state.doc.line(spec.fold.to + 1);
      view.dispatch({ effects: foldEffect.of({ from: a.to, to: b.to }) });
    }
    const at = view.state.doc.line(spec.lineNo + 1);
    const ch = at.text.indexOf(spec.phrase);
    if (ch < 0) throw new Error("на рабочей строке нет переносимого слова: " + at.text);
    /* Строка ставится в середину экрана: сверху и снизу обязано быть куда ехать. */
    view.dispatch({
      selection: { anchor: at.from + ch, head: at.from + ch + spec.phrase.length },
      effects: EditorView.scrollIntoView(at.from + ch, { y: "center" }),
    });
    await frame();
    await frame();
    return {
      scroll: view.scrollDOM.scrollTop,
      height: view.scrollDOM.scrollHeight,
      client: view.scrollDOM.clientHeight,
      folds: foldedRanges(view.state).size,
      line: at.text,
    };
  },

  /**
   * Одно нажатие, и обе величины сняты **в одном ходу** (правило 133).
   *
   * Прокрутка читается после кадра: платформа откладывает свою фазу измерения
   * до него, и число, снятое сразу за записью, описывает прежний экран
   * (У-130).
   */
  async press(direction, cfg, lineNo) {
    const before = view.scrollDOM.scrollTop;
    nav.moveSelection(editor, direction, cfg, null);
    await frame();
    await frame();
    return {
      before: before,
      after: view.scrollDOM.scrollTop,
      height: view.scrollDOM.scrollHeight,
      folds: foldedRanges(view.state).size,
      line: view.state.doc.line(lineNo + 1).text,
      selection: editor.getSelection(),
    };
  },
};
