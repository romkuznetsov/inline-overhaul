"use strict";

/**
 * Маркер отмеченной строки: `- [ ]` → `- [x]` ставит, обратное снимает
 * (2026-09-30, контролы `done-marker*` в `Writing rules`).
 *
 * Своего правила места нет — пишет движок `<Field> next` (У-32, правило 72):
 * - маркер — Value одного из Fields → шаги `next` этого Field; сторона из
 *   настройки не спрашивается;
 * - иначе — временный Field из одного Value в конце выбранного Block, на копии
 *   конфига: один `next` ставит, второй снимает.
 *
 * Движок на строке в памяти, в документ — различие (`lineDiffChange`, правило
 * 29). Своя ступень отмены: первый `Ctrl+Z` снимает маркер, второй — галочку.
 *
 * ponytail: только нажатие в редакторе; галочка, поставленная в режиме чтения
 * или другим плагином мимо редактора, маркера не получает — добавить слушатель
 * `vault.on("modify")`, если он об этом попросит. Element-список как Field
 * маркера не узнаётся: такой маркер встанет временным Field.
 */

const cmView = require("@codemirror/view");
const __sharedUtils = require("../core/shared_utils.js");
const __configNormalize = require("../core/config_normalize.js");
const __pkmOrderConfig = require("../core/pkm_order_config.js");
const __runtimeSettings = require("../core/runtime_settings.js");
const __registry = require("./command_registry.js");
const __tagwheel = require("../pkm_v2/TagWheel/tagwheel.js");
const __pkmRuntime = require("../pkm_runtime_v2.js");
const __doneMarkerConfig = require("../core/done_marker_config.js");

const readDoneMarker = __doneMarkerConfig.readDoneMarker;
const fieldOfMarker = __doneMarkerConfig.fieldOfMarker;

/** Свои правки помечаются, чтобы слушатель не принял их за нажатие человека. */
const OWN_WRITE = "input.done-marker";

/** Имя временного Field: в идентификатор команды оно не выходит — команда не заводится. */
const MARK_FIELD = "IoDoneMarker";


/** Состояние галочки строки: `null` — задачи нет, иначе отмечена ли. */
function checkState(text) {
  const box = String(__sharedUtils.lineStartOf(text).checkbox || "");
  if (!box) return null;
  return box.charAt(1) !== " ";
}

/** Строки, где сменилась только галочка — отличает щелчок от набора `- [x] `. */
function toggledLines(update) {
  const out = [];
  if (update.startState.doc.lines !== update.state.doc.lines) return out;
  const seen = new Set();
  update.changes.iterChangedRanges((_fa, _ta, fromB, toB) => {
    const a = update.state.doc.lineAt(fromB).number;
    const b = update.state.doc.lineAt(toB).number;
    for (let n = a; n <= b; n++) {
      if (seen.has(n)) continue;
      seen.add(n);
      const was = update.startState.doc.line(n).text;
      const now = update.state.doc.line(n).text;
      const before = checkState(was);
      const after = checkState(now);
      if (before === null || after === null || before === after) continue;
      const at = String(__sharedUtils.lineStartOf(now).prefix).lastIndexOf("]") - 1;
      if (was.slice(0, at) + was.slice(at + 1) !== now.slice(0, at) + now.slice(at + 1)) continue;
      out.push({ number: n, text: now, checked: after });
    }
  });
  return out;
}

/** Копия конфига с временным Field маркера в конце выбранного Block. */
function withMarkField(cfg, token, panel) {
  const raw = __sharedUtils.cloneJson(cfg);
  const f = raw.pkm.fields;
  const tag = token.startsWith("#");
  f.tags.fields.push({
    id: MARK_FIELD, prefix: tag ? "#" : "", placeholder: MARK_FIELD,
    values: [{ token: tag ? token.slice(1) : token, subtags: [], active: true }],
  });
  f.order[panel] = (f.order[panel] || []).concat(MARK_FIELD);
  for (const [k, v] of [["active", "yes"], ["freeRoam", "off"], ["enabled", true], ["types", "tag"],
    ["labels", MARK_FIELD], ["strictNames", MARK_FIELD]]) {
    f.order[k] = Object.assign({}, f.order[k], { [MARK_FIELD]: v });
  }
  return __configNormalize.migrateConfig(raw);
}

/** Однострочный `editor` для движка: строка в памяти и каретка в её конце. */
function lineEditor(line) {
  let text = String(line);
  let cur = { line: 0, ch: text.length };
  return {
    getCursor() { return { line: cur.line, ch: cur.ch }; },
    getLine() { return text; },
    lastLine() { return 0; },
    setLine(_n, v) { text = String(v == null ? "" : v); },
    replaceRange(v, from, to) {
      const value = String(v == null ? "" : v);
      if (!from || !Number.isFinite(Number(from.ch))) { text = value; return; }
      const a = Math.max(0, Math.min(text.length, from.ch));
      const b = to && Number.isFinite(Number(to.ch)) ? Math.max(a, Math.min(text.length, to.ch)) : a;
      text = text.slice(0, a) + value + text.slice(b);
    },
    setCursor(next) { cur = { line: 0, ch: Number(next && next.ch) || 0 }; },
    text() { return text; },
  };
}

/** Один шаг `next` поля `fieldId` на строке `line`; ответ — новая строка. */
async function stepNext(rt, cfg, fieldId, line) {
  const def = __registry.buildPkmCommandDefs(
    __pkmOrderConfig.serializePkmOrderForMacro, __pkmOrderConfig.serializeDateRuntimeConfigForMacro,
    __pkmOrderConfig.normalizePkmOrder, cfg, __configNormalize.FEATURE_ORDER
  ).find((d) => d && d.orderKey === fieldId && d.direction === "increase");
  if (!def) throw new Error("no next command for Field " + fieldId);
  const editor = lineEditor(line);
  await rt.runCommand({
    app: { workspace: { activeEditor: { editor } }, vault: null },
    command: def.v2Command,
    settings: Object.assign(__runtimeSettings.runtimeSettingsFromConfig(cfg), def.makeSettings(cfg)),
    Notice: function SilentNotice() { /* украшение: своя запись, человек её не звал */ },
    devLog: () => { /* уборка: журнал ведёт зовущий */ },
  });
  return editor.text();
}

function hasWord(line, token) {
  return new RegExp("(^|\\s)" + __sharedUtils.escapeRe(token) + "(?=\\s|$)").test(line);
}

/**
 * Строка после смены галочки; `null` — писать нечего. Шагов — Values + 1:
 * столько длится круг `next` с пустотой.
 */
async function lineAfterToggle(rt, cfg, line, checked) {
  const { token, panel } = readDoneMarker(cfg);
  if (!token) return null;
  const has = hasWord(line, token);
  if (checked === has) return null;
  /* Опустевшая строка остаётся задачей: `Clear line` здесь снял бы саму галочку. */
  const base = __sharedUtils.cloneJson(cfg);
  base.pkm.behavior.cycleEndBehavior = "keep-bullet";
  const own = fieldOfMarker(base, token);
  const run = own ? __configNormalize.migrateConfig(base) : withMarkField(base, token, panel);
  const fieldId = own ? own.id : MARK_FIELD;
  const limit = own ? own.tokens.length + 1 : 1;
  const done = (s) => (checked ? hasWord(s, token) : own ? !own.tokens.some((t) => hasWord(s, t)) : !hasWord(s, token));
  /*
   * Начало строки — человека: галочку поставил он, а шаги `next` переписывают
   * его по Prefix Values (`- [x] text` → `- [ ] #done :: text`, тест 7 цикла 126).
   */
  const start = __sharedUtils.lineStartOf(line).prefix;
  let cur = line;
  for (let i = 0; i < limit; i++) {
    cur = await stepNext(rt, run, fieldId, cur);
    if (done(cur)) {
      const out = start + __sharedUtils.lineStartOf(cur).body;
      return out === line ? null : out;
    }
  }
  return null;
}

/** Слушатель редактора. Движок асинхронный: перед записью строка сверяется заново. */
function createDoneMarkerExtension(plugin) {
  return cmView.EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    if (update.transactions.some((tr) => tr.isUserEvent(OWN_WRITE))) return;
    const cfg = plugin.getConfig();
    if (!cfg || !cfg.features || !cfg.features.pkm || !cfg.features.pkm.enabled) return;
    if (!readDoneMarker(cfg).token) return;
    const view = update.view;
    for (const hit of toggledLines(update)) {
      (async () => {
        const next = await lineAfterToggle(__pkmRuntime, cfg, hit.text, hit.checked);
        if (next == null || hit.number > view.state.doc.lines) return;
        const line = view.state.doc.line(hit.number);
        if (line.text !== hit.text) return;
        view.dispatch({
          changes: __tagwheel.lineDiffChange(line.from, line.text, next),
          userEvent: OWN_WRITE,
        });
      })().catch((e) => {
        /* Невидимое: человек не звал команду — в журнал (отказ вида второго). */
        plugin.devLogEvent("pkm.done-marker.error", { message: String(e && e.message ? e.message : e) }, "error", cfg);
      });
    }
  });
}

module.exports = { createDoneMarkerExtension, lineAfterToggle, toggledLines };
