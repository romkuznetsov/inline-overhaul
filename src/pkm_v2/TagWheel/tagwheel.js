var START_SETTING_OPTION = 'Start setting'
var START_MODE_OPTION = 'Start mode override'
var SUBTAG_FORMAT_OPTION = 'Subtag format'
var CYCLE_END_BEHAVIOR_OPTION = 'Cycle end behavior'
var CURSOR_POLICY_OPTION = 'Cursor policy'
var ORDER_CONFIG_OPTION = 'Order config'
/* Правила панели — ключом от слоя команд, файла панель не читает (10.13.52, П-8). */
var RULES_DATA_OPTION = 'Rules data'
var DATE_RUNTIME_CONFIG_OPTION = 'Date runtime config'
var TAGWHEEL_SCROLLER_ENABLED_OPTION = 'TagWheel scroller enabled'
var TAGWHEEL_SCROLLER_DIRECTION_OPTION = 'TagWheel scroller direction'
var TAGWHEEL_SCROLLER_SIZE_OPTION = 'TagWheel scroller size'
var TAGWHEEL_SCROLLER_LABELS_OPTION = 'TagWheel scroller labels'
/* Карта своих текстов у значений: читают коробка скроллера и полоса панели (`З-38`, У-165). */
var TAGWHEEL_CUSTOM_VALUE_TEXT_OPTION = 'TagWheel custom value text'
/* Подпись значения в полосе панели: `default`, `custom`, `both` (`З-38`). */
var TAGWHEEL_VALUE_NAMES_OPTION = 'TagWheel value names'
/* Цвета коробки скроллера: исключение № 10 к З3 (D6, 10.13.15). Пусто — цвета темы. */
var TAGWHEEL_SCROLLER_FILL_OPTION = 'TagWheel scroller fill color'
var TAGWHEEL_SCROLLER_TEXT_OPTION = 'TagWheel scroller text color'
/* Стрелка на краю панели: исключение № 21 к З3 (10.13.35). */
var TAGWHEEL_EDGE_MODE_OPTION = 'TagWheel edge mode'
var TAGWHEEL_ACTIVE_FIELD_MODE_OPTION = 'TagWheel active field mode'
var TAGWHEEL_ACTIVE_FIELD_LEFT_OPTION = 'TagWheel active field left'
var TAGWHEEL_ACTIVE_FIELD_RIGHT_OPTION = 'TagWheel active field right'
/* Custom block (10.13.260): какой блок открыть, все блоки ради `Tab`, шаг
   команды Field блока, правила Left/Right ради `Values in the other Block`, сам `Tab`. */
var CUSTOM_BLOCK_OPTION = 'Custom block'
var CUSTOM_BLOCKS_OPTION = 'Custom blocks'
var COMMAND_FIELDS_OPTION = 'Command fields'
var CUSTOM_CYCLE_OPTION = 'Custom cycle'
var LINE_RULES_DATA_OPTION = 'Line rules data'
var TAGWHEEL_CUSTOM_TAB_OPTION = 'TagWheel custom tab'
/* Строка выделения, на которой открывается панель (цикл 121). */
var TAGWHEEL_SELECTION_LINE_OPTION = 'TagWheel selection line'
/* Свои модули — литеральным `require`, по одному на модуль (У-89). */
var __sharedUtils = require('../../core/shared_utils.js')
var __lineFinalizeUnifiedMod = require('../../core/pkm_line_finalize_unified.js')
var __statusLineRuntimeUnifiedMod = require('../../core/status_line_runtime_unified.js')
var __dateRuntimeSharedMod = require('../../core/date_runtime_shared.js')
var __linePipelineMod = require('../../core/line_pipeline.js')
var __tagwheelScrollerOverlayMod = require('../../ui/tagwheel_scroller_overlay.js')
var __tagwheelCoreMod = require('./tagwheel_core.js')
var __pkmOptionKeysMod = require('../../core/pkm_option_keys.js')
var __pkmDomainRegistryMod = require('../../core/pkm_domain_registry.js')
var __sayModule = require('../../core/say.js')
var __say = __sayModule.say
var __activeEditorMod = require('../../core/active_editor.js')
/* Пакет даёт сам Obsidian: в сборке он объявлен внешним и в бандл не идёт. */
var __cmState = require('@codemirror/state')
var __panelLineWriteMod = require('../../core/panel_line_write.js')
var __panelMaskMod = require('../../ui/editor/panel_mask.js')
/* Command Field в колесе (4.5, исключение к З3 № 199). */
var __commandFieldWheel = require('../../features/command_field_wheel.js')

/**
 * Что переписать, чтобы строка стала другой: только различие. Запись «мимо
 * истории» не заводит ступень, но CodeMirror переносит через изменение чужие
 * ступени (`addMapping`, `app.js` 1.13.7): удалённое пропадает из них, пустая
 * ступень выбрасывается. Перезапись целиком съедала набранное человеком из
 * `Ctrl+Z` (W3, A41). Граница не режет пару UTF-16 (`📅`). Начало строки
 * бережёт `withKeptPrefix` (A43).
 */
function lineDiffChange(from, oldText, newText) {
  var a = String(oldText == null ? '' : oldText)
  var b = String(newText == null ? '' : newText)
  var head = 0
  while (head < a.length && head < b.length && a.charCodeAt(head) === b.charCodeAt(head)) head++
  var tail = 0
  while (tail < a.length - head && tail < b.length - head
    && a.charCodeAt(a.length - 1 - tail) === b.charCodeAt(b.length - 1 - tail)) tail++
  /*
   * Пара UTF-16 неделима: граница между половинами расширяет отрезок. Условие
   * с двух сторон одно; проверено мутацией (`📅`/`📆` — общая первая
   * половина, `📅`/`🣅` — вторая).
   */
  if (head > 0 && head < a.length && isLowSurrogate(a.charCodeAt(head))) head--
  if (tail > 0 && tail < a.length && isLowSurrogate(a.charCodeAt(a.length - tail))) tail--
  return {
    from: from + head,
    to: from + a.length - tail,
    insert: b.slice(head, b.length - tail)
  }
}

/**
 * Начало строки, которое панель не переписывает: отступ, знак списка или
 * заголовка и чекбокс — в написании человека. `renderControlLine` знака
 * списка не рисует, и без этого из чужой ступени отмены пропадал перенос
 * строки (W4, A43). Знак — из строки, а не из разбора: `parseLine` досыпает
 * `bulletToken: '-'` и строке без знака. Чекбокс — один знак в скобках (У-91).
 */
function keptLinePrefix(line) {
  var m = /^(\s*(?:[-*+]|\d+[.)]|#{1,6})[ \t]+(?:\[.\][ \t]+)?)/.exec(String(line == null ? '' : line))
  return m ? m[1] : ''
}

/** Вид панели с сохранённым началом: знак встаёт после отступа (`parsedLine.indent`), иначе отступ удвоился бы. */
function withKeptPrefix(originalLine, control) {
  var kept = keptLinePrefix(originalLine)
  var text = String(control == null ? '' : control)
  if (!kept || text.indexOf(kept) === 0) return text
  var indent = /^[ \t]*/.exec(text)[0]
  return kept + text.slice(indent.length)
}

/**
 * Отрезок подсветки `==` полосы панели. Метки ставит движок — ищутся только
 * внутри отрезков плана записи: `==` человек пишет и сам. Нет плана, отрезков
 * или пары — подсветки нет (ответ, а не отказ).
 */
function panelStripHighlightSpan(src, plan) {
  var ranges = plan && Array.isArray(plan.inserted) ? plan.inserted : []
  if (!ranges.length) return null
  var marks = []
  var i
  for (i = 0; i < ranges.length; i++) {
    var from = Math.max(0, Number(ranges[i][0]) || 0)
    var to = Math.min(src.length, Number(ranges[i][1]) || 0)
    var at
    for (at = from; at + 1 < to; at++) {
      if (src.charAt(at) === '=' && src.charAt(at + 1) === '=') { marks.push(at); at++ }
    }
  }
  if (marks.length < 2) return null
  return [marks[0], marks[marks.length - 1] + 2]
}

/**
 * Каретка не стоит внутри полосы панели (2026-09-21): иначе Obsidian
 * показывает `==` сырыми. Метки прячет Obsidian, пока выделение не перекрывает
 * узел; край считается перекрытием (`app.js` 1.13.7: `IL(range, from, to)` =
 * `range.from <= to && range.to >= from`, имена `"highlight"` — `a3`; разбор
 * `.io-twline` в `styles.css`).
 *
 * Спрашивается сама подсветка, а не границы вставки (`node tools/line_matrix.js`,
 * У-174, правило 125). Есть знак слева от подсветки — каретка туда, иначе за
 * конец; обе стороны строго снаружи. Строки, целиком из подсветки, у панели
 * нет: разделитель полоса ставит всегда.
 *
 * `forward` — custom block: каретка за полосой (2026-09-24, тест 5), то есть
 * за знаком после неё; этот знак полоса ставит всегда.
 */
function cursorOutsidePanelStrip(text, plan, ch, forward) {
  var src = String(text || '')
  var span = panelStripHighlightSpan(src, plan)
  if (!span) return ch
  if (ch < span[0] || ch > span[1]) return ch
  if (forward && span[1] < src.length) return span[1] + 1
  if (span[0] > 0) return span[0] - 1
  if (span[1] < src.length) return span[1] + 1
  return ch
}

/**
 * Слово под кареткой custom block (10.13.260): `|aaa`, `aa|a`, `aaa|`. Каретка
 * между пробелами — `null`. Ссылка `[[две части]]` — целиком. Что слово
 * значит, решает разбор строки — `customHitAtCaret`.
 */
function customWordSpan(line, ch) {
  var src = String(line == null ? '' : line)
  var at = Math.max(0, Math.min(src.length, Number(ch) || 0))
  var open = src.lastIndexOf('[[', at)
  if (open !== -1) {
    var close = src.indexOf(']]', open)
    var closedBefore = src.lastIndexOf(']]', at - 1)
    if (close !== -1 && close + 2 >= at && !(closedBefore > open && closedBefore + 2 < at)) {
      return { from: open, to: close + 2, text: src.slice(open, close + 2) }
    }
  }
  var from = at
  var to = at
  while (from > 0 && !/\s/.test(src.charAt(from - 1))) from--
  while (to < src.length && !/\s/.test(src.charAt(to))) to++
  if (from === to) return null
  return { from: from, to: to, text: src.slice(from, to) }
}

/**
 * Вставка custom block в строку (10.13.260, п. 6): пробел до и после, если там
 * не пробел и не край строки. Пустая вставка на месте значения — снятие,
 * из двух пробелов остаётся один.
 *
 * @returns {{from:number, to:number, insert:string, caret:number}|null}
 *   `null` — писать нечего
 */
function customInsertPlan(line, from, to, text) {
  var src = String(line == null ? '' : line)
  var before = src.slice(0, from)
  var after = src.slice(to)
  var body = String(text == null ? '' : text)
  if (!body) {
    if (from === to) return null
    if (/\s$/.test(before) && /^\s/.test(after)) to += 1
    /* В конце строки уходит и пробел перед значением, но не за знаком списка или чекбоксом (A6). */
    else if (/\s$/.test(before) && !after && from - 1 > __sharedUtils.lineStartOf(src).at) from -= 1
    return { from: from, to: to, insert: '', caret: from }
  }
  var lead = before && !/\s$/.test(before) ? ' ' : ''
  var tail = after && !/^\s/.test(after) ? ' ' : ''
  return { from: from, to: to, insert: lead + body + tail, caret: from + lead.length + body.length }
}

function isLowSurrogate(code) {
  /* Правило объявлено один раз — `shared_utils.js` (10.13.137). */
  return __sharedUtils.isLowSurrogate(code)
}

/**
 * Строка мимо истории отмен (2026-09-07): иначе `Ctrl+Z` после панели шёл по
 * каждому нажатию (У-64). История CodeMirror не берёт изменение с
 * `addToHistory = false` (`app.js` 1.13.7); `editor.transaction(tx, origin)`
 * не годится — `origin` становится `userEvent` (У-44). Поэтому `editor.cm` —
 * сам `EditorView`. Нет `cm` (вне Obsidian) — обычный `setLine`, ступеней
 * снова много; это не заглушка модуля (У-90).
 */
function setLineOutsideHistory(editor, lineNumber, text) {
  var view = editor ? editor.cm : null
  var Transaction = __cmState ? __cmState.Transaction : null
  if (view && view.state && typeof view.dispatch === 'function'
    && Transaction && Transaction.addToHistory && typeof Transaction.addToHistory.of === 'function') {
    try {
      var docLine = view.state.doc.line(Number(lineNumber) + 1)
      var next = String(text == null ? '' : text)
      /* Различие — от того, что на строке сейчас; не прочитали — пишем целиком:
         пустая «прежняя» дала бы вставку поверх текста человека. */
      var current = typeof docLine.text === 'string'
        ? docLine.text
        : (view.state.doc && typeof view.state.doc.sliceString === 'function'
          ? String(view.state.doc.sliceString(docLine.from, docLine.to))
          : null)
      var change = current === null
        ? { from: docLine.from, to: docLine.to, insert: next }
        : lineDiffChange(docLine.from, current, next)
      /* Строка уже такая: пустое изменение историю не переносит. */
      if (change.from === change.to && change.insert === '') return
      view.dispatch({
        changes: change,
        annotations: Transaction.addToHistory.of(false)
      })
      return
    } catch (e) {
      reportTagWheelError(e)
    }
  }
  editor.setLine(lineNumber, text)
}

/*
 * Уведомление TagWheel — текст из каталога (10.13.50, В-74):
 * `notice(key, english, ...args)`; английское на месте — слой настроек может
 * не загрузиться. Шов — `src/core/say.js` (В-100). Ключ — `tagWheelNoticeKey` (У-82).
 */
function tagWheelNoticeKey(name) {
  return __sayModule.noticeKey('tagwheel', name)
}

function makeTagWheelNotice(NoticeRef) {
  return function notice(key, english, ...args) {
    /* Текст — у `src/core/say.js` (В-100, исключение № 37 к З3). Своё у панели —
       нет `Notice` платформы, строка уходит в консоль. */
    var text = __say(key, english, ...args)
    if (typeof NoticeRef === 'function') new NoticeRef(text)
    else console.log('[tagwheel] ' + text)
  }
}

function reportTagWheelError(err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return
    console.error(err)
  } catch (_) {
    /*
     * Молчать обязательно: это сам отчётчик об отказе. Сказать ли человеку о
     * первом отказе, решает место вызова: двое зовут `notice`, двое молчат
     * нарочно (запасной путь записи, пропажа украшения).
     */
  }
}

function resolveTagWheelDevLogger(app_) {
  try {
    var plugins = app_ && app_.plugins && app_.plugins.plugins && typeof app_.plugins.plugins === 'object'
      ? app_.plugins.plugins
      : null
    if (!plugins) return null
    var keys = Object.keys(plugins)
    var i
    for (i = 0; i < keys.length; i++) {
      var plugin = plugins[keys[i]]
      if (!plugin || typeof plugin.devLogEvent !== 'function') continue
      return plugin
    }
  } catch (_) {
    /* Проба: реестр плагинов — приватное API, его может не быть; `null` — записи не будет. */
  }
  return null
}

function emitTagWheelDevEvent(app_, eventName, payload) {
  try {
    var plugin = resolveTagWheelDevLogger(app_)
    if (!plugin || typeof plugin.devLogEvent !== 'function') return
    var cfg = typeof plugin.getConfig === 'function' ? plugin.getConfig() : null
    plugin.devLogEvent(String(eventName || ''), payload || {}, 'info', cfg)
  } catch (_) {
    /* Украшение: след в журнале (`run.start`, `run.result`); не записался — работа та же. */
  }
}

/*
 * Приложение — из вызова: `x` или `x.app` (макро-рантайм, QuickAdd).
 * `globalThis.app` каталог Obsidian запрещает (П1); не передали — «TagWheel: no app context».
 */
function resolveTagWheelApp(x) {
  if (x && x.vault && x.workspace) return x
  if (x && x.app && x.app.vault && x.app.workspace) return x.app
  return null
}

/* Где взять редактор — `src/core/active_editor.js` (П8: `getActiveViewOfType` первым). */
function getTagWheelEditor(app_) {
  return __activeEditorMod.activeEditorFrom(app_)
}

/**
 * Открыто ли дочернее поле нажатием `Alt` (`З-36`). Возвращает, сменилось ли
 * что-нибудь. Переключатель, а не удержание (2026-09-23): `Alt+↑/↓` заняты
 * хоткеями человека. Закрыл на дочернем — курсор на родителя, а не на первое
 * поле полосы. `Show always` от `Alt` не зависит. Нажатие принадлежит полю,
 * где его сделали (`altFor`); снимает его `ensureActiveFieldId`.
 */
function setAltOpen(state, open) {
  var session = state && state.session
  if (!session) return false
  var now = open === true
  if (session.altOpen === now) return false
  session.altOpen = now
  var id = String(session.activeFieldId || '')
  var owner = altOwnerOf(state, id)
  if (now) session.altFor = owner
  else session.activeFieldId = owner
  return true
}

/**
 * Чьё дочернее поле открывает `Alt`, нажатый на поле `id`: у дочернего —
 * родителя, у остальных — самого поля. `Show always` (`freeOfParent`) от
 * `Alt` не зависит и считается полем само по себе.
 */
function altOwnerOf(state, id) {
  var modes = state && state.rules ? [state.rules.leftMode, state.rules.rightMode] : []
  var mi
  for (mi = 0; mi < modes.length; mi++) {
    var fields = modes[mi] && Array.isArray(modes[mi].fields) ? modes[mi].fields : []
    var fi
    for (fi = 0; fi < fields.length; fi++) {
      var f = fields[fi]
      if (f && f.id === id && f.dependsOn && f.freeOfParent !== true) return String(f.dependsOn)
    }
  }
  return id
}

/** Клавиша печатает — знак, `Backspace` или `Delete` без `Ctrl`/`Cmd`/`Alt` (сочетания — хоткеи человека). */
function isTypingKey(e) {
  if (!e || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return false
  var k = String(e.key || '')
  return k.length === 1 || k === 'Backspace' || k === 'Delete'
}

/** Событие пришло из редактора своей сессии, а не из поля ввода или окна. */
function insideSessionEditor(state, target) {
  var cm = state && state.editor ? state.editor.cm : null
  var root = cm && cm.dom ? cm.dom : null
  return !!(root && target && typeof root.contains === 'function' && root.contains(target))
}

function cleanupTagWheelState(state) {
  if (!state) return
  if (state.keyHandler) window.removeEventListener('keydown', state.keyHandler, true)
  if (state.keyUpHandler) window.removeEventListener('keyup', state.keyUpHandler, true)
  if (state.mouseHandler) window.removeEventListener('mousedown', state.mouseHandler, true)
  /* Крючок выгрузки заметки снимается, только если он всё ещё наш (R7). */
  if (state.view && state.unloadHook && state.view.onUnloadFile === state.unloadHook) delete state.view.onUnloadFile
  try {
    if (state.scrollerOverlay && typeof state.scrollerOverlay.destroy === 'function') {
      state.scrollerOverlay.destroy()
    }
  } catch (_) {
    /*
     * Уборка: коробки скроллера может уже не быть. Порядок не случаен: перехват
     * `keydown` снят выше, сессия гасится ниже — сбой картинки им не мешает (Д-2, В-91).
     */
  }
  /* Сохранённое выделение гаснет с панелью (цикл 121). */
  if (state.keptSelection) __panelMaskMod.applyKeptSelection(state.editor ? state.editor.cm : null, null)
  state.active = false
}

/**
 * Выделение при открытии панели — его пункт цикла 121: оно остаётся видно, а
 * панель встаёт на одну его строку (`top`, `bottom`, `head` — где кончил
 * выделять). Выделение до начала следующей строки эту строку не берёт.
 */
function selectionToKeep(editor, mode) {
  var sels = editor && typeof editor.listSelections === 'function' ? (editor.listSelections() || []) : []
  var s = sels[0]
  if (!s || !s.anchor || !s.head) return null
  if (s.anchor.line === s.head.line && s.anchor.ch === s.head.ch) return null
  var down = s.anchor.line < s.head.line || (s.anchor.line === s.head.line && s.anchor.ch < s.head.ch)
  var top = down ? s.anchor : s.head
  var bottom = down ? s.head : s.anchor
  var bottomLine = bottom.ch === 0 && bottom.line > top.line ? bottom.line - 1 : bottom.line
  var line = mode === 'bottom' || (mode === 'head' && down) ? bottomLine : top.line
  return {
    line: line,
    anchor: { line: s.anchor.line, ch: s.anchor.ch },
    head: { line: s.head.line, ch: s.head.ch },
    from: editor.posToOffset(top),
    to: editor.posToOffset(bottom),
  }
}

/* Нормализатор ключа Order — `normalizeOrderKey` в `shared_utils.js`, доводом не передаётся (10.13.168). */

function makeFieldById(fields) {
  var list = Array.isArray(fields) ? fields : []
  return function byId(id) {
    var i
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i]
    }
    return null
  }
}

/* «Приставка плюс значение» — общий дом (10.13.152). */
function composeToken(prefix, rawToken) {
  return __sharedUtils.composeToken(prefix, rawToken)
}

/* «Снять скобки, если есть» — общий дом (`unwrapWikilinkToken`), тело побайтно. */
function normalizeWikilinkTarget(raw) {
  return __sharedUtils.unwrapWikilinkToken(raw)
}

function normalizeComparableToken(raw) {
  return normalizeWikilinkTarget(raw).replace(/^#/, '').trim()
}

function resolveFieldSourceKind(field) {
  var helpers = globalThis.__inlinePkmRulesHelpers
  if (!helpers || typeof helpers.normalizeFieldSourceKind !== 'function') {
    throw new Error('pkm_rules_runtime_helpers unavailable: normalizeFieldSourceKind')
  }
  return String(helpers.normalizeFieldSourceKind(field) || '').trim() || 'none'
}

function buildTagWheelRuntimeInput(input_, settings_) {
  var out = {}
  var k
  if (input_ && typeof input_ === 'object') {
    for (k in input_) out[k] = input_[k]
  }

  var qa = settings_ && typeof settings_ === 'object' ? settings_ : {}
  if (!out.startSetting && typeof qa[START_SETTING_OPTION] === 'string') {
    out.startSetting = qa[START_SETTING_OPTION]
  }
  if (!out.startMode && typeof qa[START_MODE_OPTION] === 'string') {
    out.startMode = qa[START_MODE_OPTION]
  }
  if (!out.subtagFormat && typeof qa[SUBTAG_FORMAT_OPTION] === 'string') {
    out.subtagFormat = qa[SUBTAG_FORMAT_OPTION]
  }
  if (!out.cycleEndBehavior && typeof qa[CYCLE_END_BEHAVIOR_OPTION] === 'string') {
    out.cycleEndBehavior = qa[CYCLE_END_BEHAVIOR_OPTION]
  }
  if (!out.cursorPolicy && typeof qa[CURSOR_POLICY_OPTION] === 'string') {
    out.cursorPolicy = qa[CURSOR_POLICY_OPTION]
  }
  if (!out.orderConfig && typeof qa[ORDER_CONFIG_OPTION] === 'string') {
    out.orderConfig = qa[ORDER_CONFIG_OPTION]
  }
  if (!out.targetFieldKey && typeof qa['Target field key'] === 'string') {
    out.targetFieldKey = qa['Target field key']
  }
  if (out.rulesData == null && qa[RULES_DATA_OPTION] != null) {
    out.rulesData = qa[RULES_DATA_OPTION]
  }
  if (!out.dateRuntimeConfig && typeof qa[DATE_RUNTIME_CONFIG_OPTION] === 'string') {
    out.dateRuntimeConfig = qa[DATE_RUNTIME_CONFIG_OPTION]
  }
  if (out.scrollerEnabled == null && qa[TAGWHEEL_SCROLLER_ENABLED_OPTION] != null) {
    out.scrollerEnabled = qa[TAGWHEEL_SCROLLER_ENABLED_OPTION] === true
  }
  if (!out.scrollerDirection && typeof qa[TAGWHEEL_SCROLLER_DIRECTION_OPTION] === 'string') {
    out.scrollerDirection = qa[TAGWHEEL_SCROLLER_DIRECTION_OPTION]
  }
  if (out.scrollerSize == null && qa[TAGWHEEL_SCROLLER_SIZE_OPTION] != null) {
    out.scrollerSize = qa[TAGWHEEL_SCROLLER_SIZE_OPTION]
  }
  if (!out.scrollerLabels && typeof qa[TAGWHEEL_SCROLLER_LABELS_OPTION] === 'string') {
    out.scrollerLabels = qa[TAGWHEEL_SCROLLER_LABELS_OPTION]
  }
  if (out.customValueText == null && typeof qa[TAGWHEEL_CUSTOM_VALUE_TEXT_OPTION] === 'string') {
    out.customValueText = qa[TAGWHEEL_CUSTOM_VALUE_TEXT_OPTION]
  }
  if (!out.valueNames && typeof qa[TAGWHEEL_VALUE_NAMES_OPTION] === 'string') {
    out.valueNames = qa[TAGWHEEL_VALUE_NAMES_OPTION]
  }
  if (out.scrollerFillColor == null && typeof qa[TAGWHEEL_SCROLLER_FILL_OPTION] === 'string') {
    out.scrollerFillColor = qa[TAGWHEEL_SCROLLER_FILL_OPTION]
  }
  if (out.scrollerTextColor == null && typeof qa[TAGWHEEL_SCROLLER_TEXT_OPTION] === 'string') {
    out.scrollerTextColor = qa[TAGWHEEL_SCROLLER_TEXT_OPTION]
  }
  if (!out.edgeMode && typeof qa[TAGWHEEL_EDGE_MODE_OPTION] === 'string') {
    out.edgeMode = qa[TAGWHEEL_EDGE_MODE_OPTION]
  }
  /* На каком Field открывается панель (10.13.76). */
  if (!out.activeFieldMode && typeof qa[TAGWHEEL_ACTIVE_FIELD_MODE_OPTION] === 'string') {
    out.activeFieldMode = qa[TAGWHEEL_ACTIVE_FIELD_MODE_OPTION]
  }
  if (out.activeFieldLeft == null && typeof qa[TAGWHEEL_ACTIVE_FIELD_LEFT_OPTION] === 'string') {
    out.activeFieldLeft = qa[TAGWHEEL_ACTIVE_FIELD_LEFT_OPTION]
  }
  if (out.activeFieldRight == null && typeof qa[TAGWHEEL_ACTIVE_FIELD_RIGHT_OPTION] === 'string') {
    out.activeFieldRight = qa[TAGWHEEL_ACTIVE_FIELD_RIGHT_OPTION]
  }
  /* Custom block (10.13.260). */
  if (!out.customBlock && typeof qa[CUSTOM_BLOCK_OPTION] === 'string') out.customBlock = qa[CUSTOM_BLOCK_OPTION]
  if (out.customBlocks == null && qa[CUSTOM_BLOCKS_OPTION] != null) out.customBlocks = qa[CUSTOM_BLOCKS_OPTION]
  if (out.commandFields == null && qa[COMMAND_FIELDS_OPTION] != null) out.commandFields = qa[COMMAND_FIELDS_OPTION]
  if (!out.customCycle && typeof qa[CUSTOM_CYCLE_OPTION] === 'string') out.customCycle = qa[CUSTOM_CYCLE_OPTION]
  if (out.lineRulesData == null && qa[LINE_RULES_DATA_OPTION] != null) out.lineRulesData = qa[LINE_RULES_DATA_OPTION]
  if (out.customTab == null && qa[TAGWHEEL_CUSTOM_TAB_OPTION] != null) out.customTab = qa[TAGWHEEL_CUSTOM_TAB_OPTION] === true
  if (!out.selectionLine && typeof qa[TAGWHEEL_SELECTION_LINE_OPTION] === 'string') out.selectionLine = qa[TAGWHEEL_SELECTION_LINE_OPTION]
  return out
}

/**
 * Стрелка, когда следующего Field в Block нет (10.13.35). `stay` — кольцо
 * внутри стороны (умолчание, прежнее поведение); `next-block` — через обе.
 */
function normalizeEdgeMode(value) {
  return String(value || '').trim().toLowerCase() === 'next-block' ? 'next-block' : 'stay'
}

/**
 * Куда встанет активный Field на следующем шаге стрелки (10.13.35). Чистая
 * функция — проверяется без Obsidian. Четыре границы складываются в одно
 * кольцо «левая, затем правая» и зеркально — один переход, не четыре случая.
 */
function planFieldStep(input) {
  var o = input && typeof input === 'object' ? input : {}
  var ids = Array.isArray(o.ids) ? o.ids : []
  if (!ids.length) return null

  var mode = o.mode === 'right' ? 'right' : 'left'
  var dir = Number(o.dir) < 0 ? -1 : 1
  var idx = ids.indexOf(String(o.activeFieldId || ''))
  if (idx === -1) idx = 0
  var next = idx + dir

  if (normalizeEdgeMode(o.edgeMode) === 'next-block' && (next < 0 || next >= ids.length)) {
    var otherIds = Array.isArray(o.otherIds) ? o.otherIds : []
    /* Соседняя сторона пуста — кольцо замыкается на своей, не тихий отказ (У-41). */
    if (otherIds.length) {
      return {
        mode: mode === 'right' ? 'left' : 'right',
        activeFieldId: dir > 0 ? otherIds[0] : otherIds[otherIds.length - 1],
        crossed: true
      }
    }
  }

  return {
    mode: mode,
    activeFieldId: ids[(next + ids.length) % ids.length],
    crossed: false
  }
}

/**
 * Карта «чем печатается значение вместо себя» — один разбор для коробки
 * скроллера и полосы панели (`З-38`). Собирает её `buildTagCustomTextMap`,
 * сюда она едет строкой настройки; разбор вне конфига коробки, иначе при
 * выключенной коробке второй читатель получил бы пустую карту.
 */
function readCustomValueTextMap(raw) {
  try {
    var parsed = JSON.parse(String((raw && raw.customValueText) || '{}'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch (_eCustomText) {
    /* Карта бывает сломанной; пустая карта — законное значение, не отказ. */
  }
  return {}
}

/**
 * Подпись значения в самой полосе (`З-38`): `Default name`, `Only custom name`
 * (из `Color your tags`), `Custom+Default name` (свой первым). Коробка
 * подписывает соседние значения, полоса — выбранное: два контрола, одна карта.
 */
function normalizeValueNamesConfig(raw) {
  var modeRaw = String((raw && raw.valueNames) || '').trim().toLowerCase()
  var mode = modeRaw === 'custom' || modeRaw === 'both' ? modeRaw : 'default'
  return { mode: mode, customText: mode === 'default' ? {} : readCustomValueTextMap(raw) }
}

function normalizeScrollerConfig(input) {
  var raw = input && typeof input === 'object' ? input : {}
  var directionRaw = String(raw.scrollerDirection || '').trim().toLowerCase()
  var direction = (directionRaw === 'up' || directionRaw === 'down' || directionRaw === 'full') ? directionRaw : 'full'
  var sizeNum = Math.trunc(Number(raw.scrollerSize))
  var size = isFinite(sizeNum) ? Math.max(1, Math.min(20, sizeNum)) : 3
  /* Пустая строка — «взять у темы», не «прозрачный» (10.13.15 Н2). Только `#rrggbb`:
     иначе браузер молча оставит прежний цвет. */
  var hex = function(value) {
    var v = String(value == null ? '' : value).trim().toLowerCase()
    return /^#[0-9a-f]{6}$/.test(v) ? v : ''
  }
  /* Подписи соседних значений (2026-09-20); карта готовая (`buildTagCustomTextMap`, У-32),
     сломанная — «своих текстов нет». */
  var labelsRaw = String(raw.scrollerLabels || '').trim().toLowerCase()
  var labels = (labelsRaw === 'custom' || labelsRaw === 'both') ? labelsRaw : 'value'
  var customText = readCustomValueTextMap(raw)
  return {
    enabled: raw.scrollerEnabled === true,
    direction: direction,
    size: size,
    fillColor: hex(raw.scrollerFillColor),
    textColor: hex(raw.scrollerTextColor),
    labels: labels,
    customText: customText,
  }
}

async function loadDateRuntimeShared() {
  return __dateRuntimeSharedMod
}

async function loadTagWheelScrollerOverlay() {
  return __tagwheelScrollerOverlayMod
}

/* «Каким выводом печатается поле» — общий дом у помощников (10.13.139). */
function resolveFieldOutputMode(field, rules) {
  var helpers = globalThis.__inlinePkmRulesHelpers
  if (!helpers || typeof helpers.resolveFieldOutputMode !== 'function') {
    throw new Error('pkm_rules_runtime_helpers unavailable: resolveFieldOutputMode')
  }
  return helpers.resolveFieldOutputMode(field, rules)
}

function buildOutputTokenForFieldValue(field, value, rules) {
  if (!field || !value) return ''
  var outputMode = resolveFieldOutputMode(field, rules)
  var tokenRaw = String(value.token || '').trim()
  if (__sharedUtils.isWikilinkToken(tokenRaw)) return tokenRaw
  if (__sharedUtils.startsWithTagToken(tokenRaw)) return tokenRaw
  if (outputMode === 'wikilink') {
    var target = normalizeWikilinkTarget(value.link || value.token || value.id || '')
    if (!target) return ''
    /* Вид ссылки в строке — общий дом (10.13.277). */
    return __sharedUtils.wikilinkLineToken(target)
  }
  var token = tokenRaw
  if (!token) return ''
  var prefix = typeof field.prefix === 'string' ? field.prefix : '#'
  return composeToken(prefix, token)
}

function appendToken(seg, token) {
  var s = String(seg || '').trim()
  if (!token) return s
  if (!s) return token
  return s + ' ' + token
}

async function runTagWheel(input, quickAddSettings) {
  var NoticeRef = globalThis.Notice
  var notice = makeTagWheelNotice(NoticeRef)
  var macroShared = globalThis.__inlinePkmMacroShared
  var rulesHelpers = globalThis.__inlinePkmRulesHelpers
  var linePipeline = globalThis.__inlineLinePipeline
  var statusLineRuntime = globalThis.__inlineStatusLineRuntimeUnified
  var domainRegistry = __pkmDomainRegistryMod

  function applyPkmOptionKeys(mod) {
    var keys = mod && mod.KEYS && typeof mod.KEYS === 'object' ? mod.KEYS : null
    if (!keys) return
    SUBTAG_FORMAT_OPTION = String(keys.SUBTAG_FORMAT || SUBTAG_FORMAT_OPTION)
    CYCLE_END_BEHAVIOR_OPTION = String(keys.CYCLE_END_BEHAVIOR || CYCLE_END_BEHAVIOR_OPTION)
    CURSOR_POLICY_OPTION = String(keys.CURSOR_POLICY || CURSOR_POLICY_OPTION)
    ORDER_CONFIG_OPTION = String(keys.ORDER_CONFIG || ORDER_CONFIG_OPTION)
    RULES_DATA_OPTION = String(keys.RULES_DATA || RULES_DATA_OPTION)
    DATE_RUNTIME_CONFIG_OPTION = String(keys.DATE_RUNTIME_CONFIG || DATE_RUNTIME_CONFIG_OPTION)
    TAGWHEEL_SCROLLER_ENABLED_OPTION = String(keys.TAGWHEEL_SCROLLER_ENABLED || TAGWHEEL_SCROLLER_ENABLED_OPTION)
    TAGWHEEL_SCROLLER_DIRECTION_OPTION = String(keys.TAGWHEEL_SCROLLER_DIRECTION || TAGWHEEL_SCROLLER_DIRECTION_OPTION)
    TAGWHEEL_SCROLLER_SIZE_OPTION = String(keys.TAGWHEEL_SCROLLER_SIZE || TAGWHEEL_SCROLLER_SIZE_OPTION)
    /* Ключи подписей переносятся вместе с остальными: ключ вне переноса молча остаётся литералом (У-237). */
    TAGWHEEL_SCROLLER_LABELS_OPTION = String(keys.TAGWHEEL_SCROLLER_LABELS || TAGWHEEL_SCROLLER_LABELS_OPTION)
    TAGWHEEL_CUSTOM_VALUE_TEXT_OPTION = String(keys.TAGWHEEL_CUSTOM_VALUE_TEXT || TAGWHEEL_CUSTOM_VALUE_TEXT_OPTION)
    TAGWHEEL_VALUE_NAMES_OPTION = String(keys.TAGWHEEL_VALUE_NAMES || TAGWHEEL_VALUE_NAMES_OPTION)
    TAGWHEEL_SCROLLER_FILL_OPTION = String(keys.TAGWHEEL_SCROLLER_FILL || TAGWHEEL_SCROLLER_FILL_OPTION)
    TAGWHEEL_SCROLLER_TEXT_OPTION = String(keys.TAGWHEEL_SCROLLER_TEXT || TAGWHEEL_SCROLLER_TEXT_OPTION)
    TAGWHEEL_EDGE_MODE_OPTION = String(keys.TAGWHEEL_EDGE_MODE || TAGWHEEL_EDGE_MODE_OPTION)
    TAGWHEEL_ACTIVE_FIELD_MODE_OPTION = String(keys.TAGWHEEL_ACTIVE_FIELD_MODE || TAGWHEEL_ACTIVE_FIELD_MODE_OPTION)
    TAGWHEEL_ACTIVE_FIELD_LEFT_OPTION = String(keys.TAGWHEEL_ACTIVE_FIELD_LEFT || TAGWHEEL_ACTIVE_FIELD_LEFT_OPTION)
    TAGWHEEL_ACTIVE_FIELD_RIGHT_OPTION = String(keys.TAGWHEEL_ACTIVE_FIELD_RIGHT || TAGWHEEL_ACTIVE_FIELD_RIGHT_OPTION)
    CUSTOM_BLOCK_OPTION = String(keys.CUSTOM_BLOCK || CUSTOM_BLOCK_OPTION)
    CUSTOM_BLOCKS_OPTION = String(keys.CUSTOM_BLOCKS || CUSTOM_BLOCKS_OPTION)
    COMMAND_FIELDS_OPTION = String(keys.COMMAND_FIELDS || COMMAND_FIELDS_OPTION)
    CUSTOM_CYCLE_OPTION = String(keys.CUSTOM_CYCLE || CUSTOM_CYCLE_OPTION)
    LINE_RULES_DATA_OPTION = String(keys.LINE_RULES_DATA || LINE_RULES_DATA_OPTION)
    TAGWHEEL_CUSTOM_TAB_OPTION = String(keys.TAGWHEEL_CUSTOM_TAB || TAGWHEEL_CUSTOM_TAB_OPTION)
    TAGWHEEL_SELECTION_LINE_OPTION = String(keys.TAGWHEEL_SELECTION_LINE || TAGWHEEL_SELECTION_LINE_OPTION)
  }

  function getDomainRegistry() {
    return domainRegistry
  }

  function resolveOrderKeyFromFieldId(fieldId) {
    var reg = getDomainRegistry()
    /* Идентификатор поля вместо ключа Order — разные значения на паре ключей (10.13.167). */
    if (!reg || typeof reg.resolveOrderKeyFromFieldId !== 'function') {
      throw new Error('pkm_domain_registry unavailable: resolveOrderKeyFromFieldId')
    }
    return String(reg.resolveOrderKeyFromFieldId(fieldId) || '').trim()
  }

  async function loadMacroRuntime(app_) {
    var globalGetter = globalThis.__inlineGetPkmMacroRuntime
    if (typeof globalGetter === 'function') {
      return globalGetter(app_)
    }
    var entry = globalThis.__inlinePkmMacroRuntimeEntryMod
    if (entry && typeof entry.bootstrapMacroRuntime === 'function') {
      return entry.bootstrapMacroRuntime(app_)
    }
    throw new Error('pkm_macro_runtime_entry unavailable: bootstrapMacroRuntime')
  }

  async function callRuntimeApi(app_, method) {
    var args = Array.prototype.slice.call(arguments, 2)
    var rt = await loadMacroRuntime(app_)
    var fn = rt && rt[method]
    if (typeof fn !== 'function') {
      throw new Error('pkm_macro_runtime_entry unavailable: ' + String(method || 'unknown'))
    }
    return fn.apply(rt, args)
  }

  /* Публикация в `globalThis` — шов для `tagwheel_core`. */
  async function loadLineFinalizeUnified() {
    return __lineFinalizeUnifiedMod
  }

  async function loadLinePipelineFresh() {
    globalThis.__inlineLinePipeline = __linePipelineMod
    return __linePipelineMod
  }

  async function loadStatusLineRuntimeUnified() {
    globalThis.__inlineStatusLineRuntimeUnified = __statusLineRuntimeUnifiedMod
    return __statusLineRuntimeUnifiedMod
  }

  /* Проходимые Field решает только ядро (У-146; ядро — литеральным `require`, A33, У-90). */
  function panelFieldIds(state) {
    var core = state && state.core
    var rules = state && state.rules
    var session = state && state.session
    if (!core || typeof core.getNavigableFieldSequence !== 'function') {
      throw new Error('tagwheel_core unavailable: getNavigableFieldSequence')
    }
    return core.getNavigableFieldSequence(rules, session)
  }

  function ensureActiveFieldId(state) {
    /* Курсор ушёл с поля, где нажали `Alt`, и его дочерних — нажатие кончилось
       (`setAltOpen`). Раньше списка полей: от него зависит видимость дочернего. */
    if (state.session.altOpen === true &&
        altOwnerOf(state, String(state.session.activeFieldId || '')) !== state.session.altFor) {
      state.session.altOpen = false
    }
    var ids = panelFieldIds(state)
    if (!ids.length) {
      state.session.activeFieldId = ''
      state.session.activeField = 0
      return
    }
    var cur = String(state.session.activeFieldId || '')
    if (ids.indexOf(cur) === -1) cur = ids[0]
    state.session.activeFieldId = cur

    var mode = state.session.mode === 'right' ? state.rules.rightMode : state.rules.leftMode
    var fields = mode && Array.isArray(mode.fields) ? mode.fields : []
    var i
    for (i = 0; i < fields.length; i++) {
      if (fields[i] && fields[i].id === cur) {
        state.session.activeField = i
        return
      }
    }
    state.session.activeField = 0
  }

  /**
   * Список Field соседней стороны (10.13.35) — тем же способом, что свой (У-32).
   * Копия сессии, а не подмена поля в живой: `getNavigableFieldSequence`
   * смотрит на `activeFieldId`.
   */
  function panelFieldIdsFor(state, mode) {
    var session = state && state.session
    if (!session) return []
    if (session.mode === mode) return panelFieldIds(state)

    var core = state.core
    var rules = state.rules
    /* Отказ, как у своего списка выше; набор эту функцию не исполняет (У-56),
       проверка — `node tools/line_bench.js panel left …`. */
    if (!core || typeof core.getNavigableFieldSequence !== 'function') {
      throw new Error('tagwheel_core unavailable: getNavigableFieldSequence')
    }
    var probe = {}
    var key
    for (key in session) {
      if (Object.prototype.hasOwnProperty.call(session, key)) probe[key] = session[key]
    }
    probe.mode = mode
    probe.activeFieldId = ''
    return core.getNavigableFieldSequence(rules, probe)
  }

  function nextVirtualField(state, dir) {
    var ids = panelFieldIds(state)
    if (!ids.length) return
    var mode = state.session.mode === 'right' ? 'right' : 'left'
    var plan = planFieldStep({
      ids: ids,
      otherIds: state.edgeMode === 'next-block'
        ? panelFieldIdsFor(state, mode === 'right' ? 'left' : 'right')
        : [],
      activeFieldId: state.session.activeFieldId,
      mode: mode,
      dir: dir,
      edgeMode: state.edgeMode
    })
    if (!plan) return

    state.session.mode = plan.mode
    state.session.activeFieldId = plan.activeFieldId
    /* Номер активного Field пересчитывает `ensureActiveFieldId` по стороне сессии; второй пересчёт разошёлся бы. */
    ensureActiveFieldId(state)
  }

  function selectedTagTokenForField(field, session, rules, byId) {
    if (!field || !session || !session.selected) return ''
    var id = String(session.selected[field.id] || '')
    if (!id) return ''
    var vals = Array.isArray(field.values) ? field.values : []
    var i
    var hit = null
    for (i = 0; i < vals.length; i++) {
      var v = vals[i]
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue
      var vid = (typeof v.id === 'string' && v.id) ? v.id : (typeof v.token === 'string' ? v.token : '')
      if (vid === id) { hit = v; break }
    }
    if (!hit) {
      var normalizedRaw = normalizeComparableToken(session.selected[field.id] || '')
      for (i = 0; i < vals.length; i++) {
        var pv = vals[i]
        if (!pv || typeof pv !== 'object' || Array.isArray(pv)) continue
        var pid = normalizeComparableToken((typeof pv.id === 'string' && pv.id) ? pv.id : (typeof pv.token === 'string' ? pv.token : ''))
        var ptok = normalizeComparableToken(typeof pv.token === 'string' ? pv.token : '')
        var plink = normalizeComparableToken(pv.link || '')
        if (normalizedRaw && (normalizedRaw === pid || normalizedRaw === ptok || normalizedRaw === plink)) {
          hit = pv
          break
        }
      }
    }
    if (!hit || typeof hit.token !== 'string' || !hit.token) {
      var rawSelected = String(session.selected[field.id] || '').trim()
      if (!rawSelected) return ''
      var outputModeFallback = resolveFieldOutputMode(field, rules)
      if (outputModeFallback === 'wikilink') {
        var linkTarget = normalizeComparableToken(rawSelected)
        if (linkTarget) return __sharedUtils.wikilinkLineToken(linkTarget)
      }
      if (/^\/.+/.test(rawSelected)) return '#' + rawSelected
      if (/^(#|\[\[|\d{4}-\d{2}-\d{2}|\d{2}:\d{2})/.test(rawSelected)) return rawSelected
      var prefFallback = typeof field.prefix === 'string' ? field.prefix : '#'
      return composeToken(prefFallback, rawSelected)
    }
    var pref = typeof field.prefix === 'string' ? field.prefix : '#'
    var base = buildOutputTokenForFieldValue(field, hit, rules) || composeToken(pref, String(hit.token))
    var subFmt = rules && rules.behavior && typeof rules.behavior.subtagFormat === 'string'
      ? String(rules.behavior.subtagFormat).toLowerCase().trim()
      : 'separate'
    if (subFmt === 'combined') {
      var statusRt = statusLineRuntime
      if (!statusRt && globalThis && globalThis.__inlineStatusLineRuntimeUnified) {
        statusRt = globalThis.__inlineStatusLineRuntimeUnified
      }
      if (statusRt
        && typeof statusRt.buildCombinedSelectionSet === 'function'
        && typeof statusRt.applyCombinedToTokenList === 'function') {
        var leftFields = rules && rules.leftMode && Array.isArray(rules.leftMode.fields)
          ? rules.leftMode.fields
          : []
        var combinedEntries = statusRt.buildCombinedSelectionSet({
          fields: leftFields,
          state: { selected: (session && session.selected) ? session.selected : {} },
          rules: rules,
          deps: {
            resolveSelectedValue: function (runtimeField, selectedId) {
              if (!runtimeField || !selectedId) return null
              var vals = Array.isArray(runtimeField.values) ? runtimeField.values : []
              var i
              for (i = 0; i < vals.length; i++) {
                var v = vals[i]
                if (!v || typeof v !== 'object' || Array.isArray(v)) continue
                var vid = (typeof v.id === 'string' && v.id) ? v.id : (typeof v.token === 'string' ? v.token : '')
                if (String(vid) === String(selectedId)) return v
              }
              return null
            },
            buildOutputTokenForField: function (runtimeField, value) {
              return buildOutputTokenForFieldValue(runtimeField, value, rules)
            },
            composeToken: composeToken
          }
        })
        var ci
        for (ci = 0; ci < combinedEntries.length; ci++) {
          var entry = combinedEntries[ci]
          if (!entry) continue
          if (String(entry.parentId || '') === String(field.id || '') && String(entry.combinedToken || '').trim()) {
            return String(entry.combinedToken).trim()
          }
        }
      }
    }
    return base
  }

  function resolveOrderKeyForTagField(field) {
    if (!field) return ''
    var key = String(field.orderKey || '').trim()
    if (key) return key
    return resolveOrderKeyFromFieldId(field.id)
  }

  function normalizePanelKey(orderKey) {
    var key = String(orderKey || '').trim()
    var reg = getDomainRegistry()
    if (!reg || typeof reg.collapseSubOrderKey !== 'function') {
      throw new Error('pkm_domain_registry unavailable: collapseSubOrderKey')
    }
    var collapsed = String(reg.collapseSubOrderKey(key) || '').trim()
    if (collapsed) return collapsed
    return key
  }

  function resolvePanelKeyForField(field, byId) {
    var ownKey = normalizePanelKey(resolveOrderKeyForTagField(field))
    if (!field || !field.dependsOn || typeof byId !== 'function') return ownKey
    var parent = byId(field.dependsOn)
    if (!parent) return ownKey
    var parentKey = normalizePanelKey(resolveOrderKeyForTagField(parent))
    return parentKey || ownKey
  }

  function applyMinimalLeftTagNormalization(finalLine, state, core, options) {
    var opts = options && typeof options === 'object' ? options : {}
    var finalize = opts.finalize && typeof opts.finalize === 'object' ? opts.finalize : null
    if (!finalize || typeof finalize.applyMinimalSelectionNormalization !== 'function') {
      throw new Error('pkm_line_finalize_unified unavailable: applyMinimalSelectionNormalization')
    }
    return finalize.applyMinimalSelectionNormalization({
      line: finalLine,
      rules: state && state.rules ? state.rules : null,
      parsedBase: state && state.parsedLine ? state.parsedLine : null,
      originalLine: state && state.originalLine ? state.originalLine : '',
      orderCfg: state && state.orderCfg ? state.orderCfg : null,
      session: state && state.session ? state.session : {},
      prefixState: state && state.prefixState ? state.prefixState : (state && state.session ? state.session : {}),
      preserveExistingTokens: opts.preserveExistingTokens === true,
      deps: {
        parseLine: function(lineInput, runtimeRules) {
          return core.parseLine(lineInput, runtimeRules)
        },
        buildPrefix: function(parsed, runtimeRules, runtimePrefixState) {
          return core.buildPrefix(parsed, runtimeRules, runtimePrefixState, { prefixShared: finalize })
        },
        resolveFreeRoamBehavior: function(runtimeOrderCfg) { return rulesHelpers.resolveFreeRoamBehavior(runtimeOrderCfg) },
        splitThreeSegments: function(lineInput, runtimeRules) {
          return linePipeline.splitSegments(lineInput, runtimeRules)
        },
        resolveOrderKeyForField: resolveOrderKeyForTagField,
        resolvePanelKeyForField: resolvePanelKeyForField,
        resolveFieldFreeRoamMode: function(runtimeOrderCfg, fieldKey) { return rulesHelpers.resolveFieldFreeRoamMode(runtimeOrderCfg, fieldKey) },
        resolvePanelForField: function(runtimeOrderCfg, fieldKey, defaultPanel) { return rulesHelpers.resolvePanelForField(runtimeOrderCfg, fieldKey, { defaultPanel: defaultPanel }) },
        selectedTokenForField: selectedTagTokenForField,
        makeFieldById: makeFieldById,
      }
    })
  }

  function collectSelectedTagEntries(state) {
    var rules = state && state.rules
    var session = state && state.session
    var leftFields = rules && rules.leftMode && Array.isArray(rules.leftMode.fields) ? rules.leftMode.fields : []
    var out = []
    var byId = makeFieldById(leftFields)
    var subFmtNow = rules && rules.behavior && typeof rules.behavior.subtagFormat === 'string'
      ? String(rules.behavior.subtagFormat).toLowerCase().trim()
      : 'separate'
    var i
    for (i = 0; i < leftFields.length; i++) {
      var field = leftFields[i]
      if (!field || !field.id) continue
      var orderKey = resolveOrderKeyForTagField(field)
      if (!orderKey) continue
      if (subFmtNow === 'combined' && field.dependsOn) continue
      var panelKey = resolvePanelKeyForField(field, byId)
      var token = selectedTagTokenForField(field, session, rules, byId)
      if (!token) continue
      var tokens = fieldTagTokenMap(field, rules, session, state && state.core ? state.core : null)
      var panel = rulesHelpers.resolvePanelForField(state.orderCfg, panelKey, { defaultPanel: 'right' })
      var mode = rulesHelpers.resolveFieldFreeRoamMode(state.orderCfg, panelKey)
      if (panel === 'right') mode = 'off'
      out.push({
        id: field.id,
        orderKey: panelKey,
        panel: panel,
        mode: mode,
        token: token,
        tokens: tokens
      })
    }
    return out
  }

  function ownKeyPlaced(orderCfg, key) {
    var o = orderCfg && typeof orderCfg === 'object' ? orderCfg : {}
    var lists = [o.left, o.right].concat((Array.isArray(o.custom) ? o.custom : []).map(function (b) { return b && b.keys }))
    return lists.some(function (arr) { return Array.isArray(arr) && arr.indexOf(key) !== -1 })
  }

  function collectSelectedRightEntries(state) {
    var rules = state && state.rules
    var session = state && state.session
    var rightFields = rules && rules.rightMode && Array.isArray(rules.rightMode.fields) ? rules.rightMode.fields : []
    var out = []
    var byId = makeFieldById(rightFields)
    var i
    for (i = 0; i < rightFields.length; i++) {
      var field = rightFields[i]
      if (!field || !field.id) continue
      var selected = String(session && session.selected ? session.selected[field.id] || '' : '').trim()
      var sourceKind = resolveFieldSourceKind(field)
      var isSourceDriven = sourceKind === 'projects' || sourceKind === 'wikilinks' || sourceKind === 'tag'
      /*
       * Пустое значение — выход из цикла, запись нужна (Н-5): с пустым токеном
       * и полным набором — старый `[[wikilink]]` уберётся, новый не встанет.
       * Элементы (не источник) убирает разбор по маркеру.
       */
      if (!selected && !isSourceDriven) continue
      var token = isSourceDriven && selected ? selectedTagTokenForField(field, session, rules, byId) : ''
      var tokens = isSourceDriven ? fieldTagTokenMap(field, rules, session, state && state.core ? state.core : null) : []
      /*
       * Block — из Order, не литералом (Н-3, исключение № 3 из З3).
       * `rightMode.fields` — определения по типу Field, а не Right Block. Так же
       * у тегов (`collectSelectedTagEntries`); элементы кладёт `relocateDateLikeByOrder`.
       */
      var entryOrderKey = String(field.orderKey || field.id || '').trim()
      /* Дочерний Field ссылки пишется в Block родителя (`resolvePanelKeyForField`);
         Field с предусловием — в Block своего ключа (10.13.269). */
      if (field.dependsOn && !ownKeyPlaced(state.orderCfg, entryOrderKey)) {
        entryOrderKey = resolvePanelKeyForField(field, byId)
      }
      out.push({
        id: field.id,
        orderKey: entryOrderKey,
        panel: rulesHelpers.resolvePanelForField(state.orderCfg, entryOrderKey, { defaultPanel: 'right' }),
        kind: String(field.kind || '').trim(),
        sourceKind: sourceKind,
        token: token,
        tokens: tokens
      })
    }
    return out
  }

  function applyFullTagNormalization(finalLine, state, finalize) {
    var entries = collectSelectedTagEntries(state).filter(function(e) { return e.mode === 'full' })
    if (!entries.length) return String(finalLine || '')
    var behavior = rulesHelpers.resolveFreeRoamBehavior(state.orderCfg)
    var placement = String(behavior && behavior.fullPlacement ? behavior.fullPlacement : 'smart').toLowerCase().trim()
    var normalized = finalize.normalizeFullTagLineByEntries({
      line: finalLine,
      entries: entries,
      placement: placement,
      cursorCh: macroShared.remapCursorByLineDiff(state.originalLine, finalLine, state.originalCursorCh),
      remapCursorByLineDiff: macroShared.remapCursorByLineDiff,
    })
    return String(normalized && normalized.line != null ? normalized.line : finalLine)
  }

  function fieldTagTokenMap(field, rules, session, core) {
    var vals = []
    if (core && typeof core.getAllowedValues === 'function') {
      var left = rules && rules.leftMode ? rules.leftMode : { fields: [] }
      var right = rules && rules.rightMode ? rules.rightMode : { fields: [] }
      var mode = left
      var fid = String(field && field.id || '').trim()
      if (fid && right && Array.isArray(right.fields)) {
        var inRight = right.fields.some(function (f) { return f && String(f.id || '').trim() === fid })
        if (inRight) mode = right
      }
      vals = core.getAllowedValues(mode, { selected: session && session.selected ? session.selected : {} }, field, rules)
    } else {
      vals = field && Array.isArray(field.values) ? field.values : []
    }
    var pref = field && typeof field.prefix === 'string' ? field.prefix : '#'
    var out = []
    var i
    for (i = 0; i < vals.length; i++) {
      var v = vals[i]
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue
      if (v.active === false) continue
      if (typeof v.token !== 'string' || !v.token) continue
      var primary = buildOutputTokenForFieldValue(field, v, rules)
      var fallback = composeToken(pref, String(v.token))
      /* Ссылка с подписью и без неё — одно Value (10.13.277). */
      if (primary) out.push.apply(out, __sharedUtils.wikilinkLineForms(primary))
      if (fallback && fallback !== primary) out.push(fallback)
    }
    return out
  }

  function reorderLineByOrder(line, rules, orderCfg) {
    var shared = rulesHelpers
    if (typeof shared.getDateMarkersFromRules !== 'function') throw new Error('pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules')
    if (typeof shared.buildTagTokenKeyMap !== 'function' || typeof shared.getDefaultTagTokenKeyMapOptions !== 'function') throw new Error('pkm_rules_runtime_helpers unavailable: buildTagTokenKeyMap')
    if (typeof shared.reorderSegmentTokensByOrder !== 'function' || typeof shared.getTagWheelMixedReorderOptions !== 'function') throw new Error('pkm_rules_runtime_helpers unavailable: reorderSegmentTokensByOrder')
    var seg = linePipeline.splitSegments(line, rules)
    var markers = shared.getDateMarkersFromRules(rules)
    var tokenToKey = shared.buildTagTokenKeyMap(rules, shared.getDefaultTagTokenKeyMapOptions())
    var leftParts = linePipeline.splitLeftPrefix(seg.left)
    var orderedLeft = shared.reorderSegmentTokensByOrder(leftParts.body, orderCfg, 'left', tokenToKey, shared.getTagWheelMixedReorderOptions(markers))
    seg.left = linePipeline.joinLeftPrefix(leftParts.prefix, orderedLeft)
    seg.dates = shared.reorderSegmentTokensByOrder(seg.dates, orderCfg, 'right', tokenToKey, shared.getTagWheelMixedReorderOptions(markers))
    return linePipeline.buildFromSegments(seg, rules)
  }

  function relocateTagFieldByPanel(line, rules, tokens, selectedToken, panel, options) {
    var opts = options && typeof options === 'object' ? options : {}
    var shared = linePipeline
    return shared.relocateTokenSetByPanel({
      line: line,
      rules: rules,
      targetPanel: panel,
      selectedToken: selectedToken,
      allTokens: Array.isArray(tokens) ? tokens : [],
      rightToText: opts.rightToText === true,
      stripTokens: function(seg, tokenList) {
        if (typeof macroShared.removeTokensFromSegment !== 'function') {
          throw new Error('pkm_macro_shared unavailable: removeTokensFromSegment')
        }
        return macroShared.removeTokensFromSegment(seg, tokenList)
      },
      removeCombinedByParentToken: function(seg, parentToken) {
        if (typeof rulesHelpers.removeMarkerTokensFromSegment !== 'function') {
          throw new Error('pkm_rules_runtime_helpers unavailable: removeMarkerTokensFromSegment')
        }
        return rulesHelpers.removeMarkerTokensFromSegment(seg, parentToken, '/\\S+')
      },
    })
  }

  function relocateTagLikeByOrder(line, rules, orderCfg, session, core) {
    var leftFields = rules && rules.leftMode && Array.isArray(rules.leftMode.fields) ? rules.leftMode.fields : []
    if (!leftFields.length) return String(line || '')
    var statusRt = statusLineRuntime
    if (!statusRt && globalThis && globalThis.__inlineStatusLineRuntimeUnified) {
      statusRt = globalThis.__inlineStatusLineRuntimeUnified
    }
    if (!statusRt || typeof statusRt.relocateCoreTagsByOrder !== 'function') {
      throw new Error('status_line_runtime_unified unavailable: relocateCoreTagsByOrder')
    }
    var byId = makeFieldById(leftFields)
    var freeRoamBehavior = rulesHelpers.resolveFreeRoamBehavior(orderCfg)
    function selectedFromLine(segLine, panel, tokens) {
      var seg = linePipeline.splitSegments(segLine, rules)
      var list = panel === 'right' ? [seg.dates, seg.text, seg.left] : [seg.left, seg.dates, seg.text]
      var i
      var j
      for (i = 0; i < list.length; i++) {
        var s = String(list[i] || '')
        for (j = 0; j < tokens.length; j++) {
          var t = tokens[j]
          if (typeof macroShared.segmentHasToken !== 'function') {
            throw new Error('pkm_macro_shared unavailable: segmentHasToken')
          }
          if (macroShared.segmentHasToken(s, t)) return t
        }
      }
      return ''
    }
    var subFmtNow = rules && rules.behavior && typeof rules.behavior.subtagFormat === 'string'
      ? String(rules.behavior.subtagFormat).toLowerCase().trim()
      : 'separate'
    var relocationFields = []
    var i
    for (i = 0; i < leftFields.length; i++) {
      var field = leftFields[i]
      if (!field) continue
      var orderKey = resolveOrderKeyForTagField(field)
      if (!orderKey) continue
      if (subFmtNow === 'combined' && field.dependsOn) continue
      var panelKey = resolvePanelKeyForField(field, byId)
      var panelNow = rulesHelpers.resolvePanelForField(orderCfg, panelKey, { defaultPanel: 'right' })
      var mode = rulesHelpers.resolveFieldFreeRoamMode(orderCfg, panelKey)
      if (panelNow === 'right') mode = 'off'
      if (mode === 'full') continue
      relocationFields.push(field)
    }
    return statusRt.relocateCoreTagsByOrder({
      line: String(line || ''),
      rules: rules,
      orderCfg: orderCfg,
      state: session,
      fields: relocationFields,
      activeKey: '',
      activeFieldId: '',
      deps: {
        panelForTagKey: function(runtimeOrderCfg, key) {
          return rulesHelpers.resolvePanelForField(runtimeOrderCfg, key, { defaultPanel: 'right' })
        },
        fieldTokenMap: function(field, runtimeRules, runtimeState) {
          return fieldTagTokenMap(field, runtimeRules, runtimeState, core)
        },
        selectedTokenFromState: function(field, runtimeState, runtimeRules) {
          return selectedTagTokenForField(field, runtimeState, runtimeRules, byId)
        },
        selectedTokenFromLineByPanel: selectedFromLine,
        relocateFieldByPanel: function(runtimeLine, runtimeRules, runtimeOrderCfg, panel, selected, map, field) {
          var panelKey = resolvePanelKeyForField(field, byId)
          var mode = rulesHelpers.resolveFieldFreeRoamMode(runtimeOrderCfg, panelKey)
          return relocateTagFieldByPanel(runtimeLine, runtimeRules, map, selected, panel, {
            rightToText: mode === 'minimal' && freeRoamBehavior && freeRoamBehavior.minimalSeparator === false
          })
        },
        removeCombinedByParentTokens: function(runtimeLine) {
          return String(runtimeLine || '')
        },
        resolveFieldOrderKey: resolveOrderKeyForTagField,
      },
    })
  }

  function relocateDateLikeByOrder(finalLine, rules, orderCfg) {
    if (typeof rulesHelpers.getDateMarkersFromRules !== 'function') {
      throw new Error('pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules')
    }
    /* Хвост значения — из формата поля, одной картой на все метки. */
    var tailByMarker = rulesHelpers.getDateMarkersFromRules(rules).tailByMarker || {}
    var shared = linePipeline
    var all = []
    if (rules && rules.leftMode && Array.isArray(rules.leftMode.fields)) all = all.concat(rules.leftMode.fields)
    if (rules && rules.rightMode && Array.isArray(rules.rightMode.fields)) all = all.concat(rules.rightMode.fields)

    function resolveOrderKeyForField(field) {
      if (!field) return ''
      var key = String(field.orderKey || '').trim()
      if (key) return key
      return resolveOrderKeyFromFieldId(field.id)
    }
    return shared.relocateMarkerSetByFieldOrder({
      line: String(finalLine || ''),
      rules: rules,
      fields: all,
      getOrderKey: resolveOrderKeyForField,
      getPanelForKey: function(key) {
        return rulesHelpers.resolvePanelForField(orderCfg, key, { defaultPanel: 'right' })
      },
      getValueRx: function(field) {
        var kind = String(field && field.kind || '')
        if (kind !== 'dateOffset' && kind !== 'nowTime' && kind !== 'estimatedCycle' && kind !== 'genericElement') {
          /* Не элемент — переносу тут делать нечего. */
          return null
        }
        /* Образец значения — из формата поля (10.13.71); нет формата — конец значения решает общий обход. */
        return String(tailByMarker[String(field && field.marker || '').trim()] || '')
      },
      removeMarkerTokens: function(segLine, mk, valueRx) {
        if (typeof rulesHelpers.removeMarkerTokensFromSegment !== 'function') {
          throw new Error('pkm_rules_runtime_helpers unavailable: removeMarkerTokensFromSegment')
        }
        return rulesHelpers.removeMarkerTokensFromSegment(segLine, mk, valueRx)
      },
      takeFirstToken: function(segLine, mk, valueRx) {
        if (typeof macroShared.firstTokenByPattern !== 'function') {
          throw new Error('pkm_macro_shared unavailable: firstTokenByPattern')
        }
        return macroShared.firstTokenByPattern(segLine, mk, valueRx)
      },
    })
  }

  function enforceDependentAdjacencyBySelection(finalLine, state, core) {
    var rules = state && state.rules
    var statusRt = statusLineRuntime
    if (!statusRt && globalThis && globalThis.__inlineStatusLineRuntimeUnified) {
      statusRt = globalThis.__inlineStatusLineRuntimeUnified
    }
    /* Отказ громкий, как у `relocateTagLikeByOrder`: иначе правило соседства молча не работает (10.13.166). */
    if (!statusRt || typeof statusRt.enforceDependentAdjacencyForStatusLine !== 'function') {
      throw new Error('status_line_runtime_unified unavailable: enforceDependentAdjacencyForStatusLine')
    }
    return statusRt.enforceDependentAdjacencyForStatusLine({
      finalLine: String(finalLine || ''),
      rules: rules,
      state: state && state.session ? state.session : { selected: {} },
      core: core,
      deps: {
        splitSegments: function(lineInput, runtimeRules) { return linePipeline.splitSegments(lineInput, runtimeRules) },
        splitLeftPrefix: linePipeline.splitLeftPrefix,
        joinLeftPrefix: linePipeline.joinLeftPrefix,
        buildFromSegments: function(seg, runtimeRules) { return linePipeline.buildFromSegments(seg, runtimeRules) },
        buildOutputTokenForField: buildOutputTokenForFieldValue,
        composeToken: composeToken,
        selectedTokenFromState: function(field, runtimeState, runtimeRules) {
          var leftFields = runtimeRules && runtimeRules.leftMode && Array.isArray(runtimeRules.leftMode.fields)
            ? runtimeRules.leftMode.fields
            : []
          var byId = makeFieldById(leftFields)
          return selectedTagTokenForField(field, runtimeState, runtimeRules, byId)
        },
        getAllowedValues: function(runtimeCore, runtimeRules, runtimeState, field) {
          var mode = runtimeRules && runtimeRules.leftMode ? runtimeRules.leftMode : { fields: [] }
          /* Отказ, как у команд тегов (10.13.166): дом спрашивает ещё предусловие и активность. */
          if (!runtimeCore || typeof runtimeCore.getAllowedValues !== 'function') {
            throw new Error('tagwheel_core unavailable: getAllowedValues')
          }
          return runtimeCore.getAllowedValues(mode, { selected: runtimeState && runtimeState.selected ? runtimeState.selected : {} }, field, runtimeRules)
        },
      }
    })
  }

  function getFieldByIdAny(rules, fieldId) {
    var fid = String(fieldId || '').trim()
    if (!fid) return null
    var all = []
    if (rules && rules.leftMode && Array.isArray(rules.leftMode.fields)) all = all.concat(rules.leftMode.fields)
    if (rules && rules.rightMode && Array.isArray(rules.rightMode.fields)) all = all.concat(rules.rightMode.fields)
    var i
    for (i = 0; i < all.length; i++) {
      var f = all[i]
      if (f && String(f.id || '') === fid) return f
    }
    return null
  }

  function selectedTokenForField(rules, session, field) {
    if (!field || !session || !session.selected) return ''
    var selectedId = String(session.selected[field.id] || '')
    if (!selectedId) return ''
    var values = Array.isArray(field.values) ? field.values : []
    var i
    for (i = 0; i < values.length; i++) {
      var v = values[i]
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue
      if (String(v.id || '') !== selectedId && String(v.token || '') !== selectedId) continue
      var tok = buildOutputTokenForFieldValue(field, v, rules)
      if (tok) return String(tok).trim()
      var pref = typeof field.prefix === 'string' ? field.prefix : '#'
      return composeToken(pref, String(v.token || ''))
    }
    return ''
  }

  function fieldHasOwnCheckbox(rules, session, fieldId) {
    var field = getFieldByIdAny(rules, fieldId)
    if (!field) return false
    var byField = rules && rules.behavior && rules.behavior.prefixRules && rules.behavior.prefixRules.checkboxByFieldValue
      ? rules.behavior.prefixRules.checkboxByFieldValue
      : {}
    var row = byField && typeof byField === 'object' ? byField[field.id] : null
    if (!row || typeof row !== 'object') return false
    var token = selectedTokenForField(rules, session, field)
    if (!token) return false
    return !!String(row[token] || '').trim()
  }

  /**
   * Наш ли знак задачи на строке — вид значения этого Field. В отличие от
   * `fieldHasOwnCheckbox` не смотрит на выбранное: на выходе из цикла значения
   * нет, а знак стоит. Правило — `pkm_line_finalize_unified` (И-3, 10.13.105).
   */
  function checkboxBelongsToField(rules, fieldId, token, finalize) {
    if (!finalize || typeof finalize.checkboxBelongsToFieldUnified !== 'function') {
      throw new Error('pkm_line_finalize_unified unavailable: checkboxBelongsToFieldUnified')
    }
    return finalize.checkboxBelongsToFieldUnified(rules, fieldId, token)
  }

  /* ---- custom block (PRD 10.13.260) ----------------------------------- */

  /*
   * Панель custom block — та же панель на своих правилах: Field блока лежат в
   * левом Block (`scopeToBlock` в `pkm_rules_shape.js`), ядро ходит
   * `getNavigableFieldSequence`, те же `Alt` и дочерние. Своё — место полосы
   * (у каретки) и запись: `Enter` вставляет у каретки обычной правкой.
   */

  /** Часы сессии: из них элементы-даты считают «сегодня» и «сейчас». */
  function stampClock(session) {
    var now = new Date()
    var hh = String(now.getHours())
    var mm = String(now.getMinutes())
    if (hh.length < 2) hh = '0' + hh
    if (mm.length < 2) mm = '0' + mm
    session.__nowHHmm = hh + ':' + mm
    var y = now.getFullYear()
    var m = String(now.getMonth() + 1)
    var d = String(now.getDate())
    if (m.length < 2) m = '0' + m
    if (d.length < 2) d = '0' + d
    session.__todayIso = y + '-' + m + '-' + d
    return session
  }

  function newCustomSession(core_, rules_) {
    var session_ = stampClock(core_.makeInitialState(rules_, 'left'))
    session_.altOpen = false
    return session_
  }

  /** Field блока в его порядке: родитель, за ним его дочерние. */
  function customBlockFields(rules_) {
    var keys = rules_ && rules_.behavior && rules_.behavior.order && Array.isArray(rules_.behavior.order.left)
      ? rules_.behavior.order.left
      : []
    var all = (rules_.leftMode && Array.isArray(rules_.leftMode.fields) ? rules_.leftMode.fields : [])
      .concat(rules_.rightMode && Array.isArray(rules_.rightMode.fields) ? rules_.rightMode.fields : [])
    var out = []
    var push = function (f) { if (f && f.id && out.indexOf(f) === -1) out.push(f) }
    var ki
    for (ki = 0; ki < keys.length; ki++) {
      var key = String(keys[ki] || '')
      var f = all.find(function (x) { return x && String(x.orderKey || '') === key })
        || all.find(function (x) { return x && String(x.id || '') === key })
      if (!f) continue
      push(f)
      all.filter(function (x) { return x && String(x.dependsOn || '') === String(f.id) }).forEach(push)
    }
    return out
  }

  /**
   * На значении ли Field блока стоит каретка. Слово узнаёт разбор строки, как
   * значения Left/Right (правило 72), а не сравнение написаний.
   */
  function customHitAtCaret(core_, rules_, line, ch) {
    var span = customWordSpan(line, ch)
    if (!span) return null
    var probe = newCustomSession(core_, rules_)
    core_.hydrateStateFromParsedLine(rules_, probe, core_.parseLine(span.text, rules_))
    var ids = customBlockFields(rules_)
      .filter(function (f) { return String(probe.selected[f.id] || '') })
      .map(function (f) { return f.id })
    return ids.length ? { span: span, selected: probe.selected, fieldIds: ids } : null
  }

  /** Как значение Field пишется в строку: тем же текстом, что в его Block. */
  function customTokenFor(core_, rules_, session_, field) {
    if (!field || !String(session_.selected[field.id] || '')) return ''
    var kind = String(field.kind || '')
    if (kind === 'nowTime' || kind === 'estimatedCycle' || kind === 'dateOffset' || kind === 'genericElement') {
      var only = {}
      var key
      for (key in session_) {
        if (Object.prototype.hasOwnProperty.call(session_, key)) only[key] = session_[key]
      }
      only.selected = {}
      only.selected[field.id] = session_.selected[field.id]
      return String(core_.buildRightDates(rules_, only)[0] || '')
    }
    var all = rules_.leftMode.fields.concat(rules_.rightMode.fields)
    return selectedTagTokenForField(field, session_, rules_, makeFieldById(all))
  }

  /** Вставка `Enter`: выбранное всех Field блока в порядке блока. */
  function customTokens(state_) {
    var combined = String(state_.rules.behavior && state_.rules.behavior.subtagFormat || '') === 'combined'
    return customBlockFields(state_.rules)
      .filter(function (f) { return !(combined && f.dependsOn) })
      .map(function (f) { return customTokenFor(state_.core, state_.rules, state_.session, f) })
      .filter(Boolean)
  }

  /** Обычная правка — одна ступень отмены; каретка встаёт за вставкой. */
  function writeCustomInsert(editor_, lineNo, line, from, to, text) {
    var plan = customInsertPlan(line, from, to, text)
    if (!plan) return false
    editor_.replaceRange(plan.insert, { line: lineNo, ch: plan.from }, { line: lineNo, ch: plan.to })
    editor_.setCursor({ line: lineNo, ch: plan.caret })
    return true
  }

  /**
   * Где текст человека — для `Values in the other Block = Hide`: прячется всё
   * вокруг. Зоны — разбор Left/Right. Каретка не в тексте — `null`: полосу
   * некуда поставить, не накрыв спрятанным.
   */
  function customTextZone(line, from, to, lineRules) {
    if (!lineRules || !linePipeline || typeof linePipeline.splitSegments !== 'function') return null
    var seg = linePipeline.splitSegments(line, lineRules)
    var text = String(seg && seg.text || '')
    if (!text) return null
    var at = line.indexOf(text)
    while (at !== -1) {
      if (at <= from && to <= at + text.length) return { from: at, to: at + text.length }
      at = line.indexOf(text, at + 1)
    }
    return null
  }

  /** Вид строки custom block: текст разрывается на месте каретки, полоса между; на значении — на его месте. */
  function customControlLine(state_) {
    var c = state_.custom
    var line = state_.originalLine
    var strip = state_.core.renderPanelStrip(state_.rules, state_.session, state_.valueNamesCfg)
    var from = c.span ? c.span.from : c.caretCh
    var to = c.span ? c.span.to : c.caretCh
    var lo = 0
    var hi = line.length
    var prefix = ''
    if (!strip.keepOpposite) {
      var zone = customTextZone(line, from, to, c.lineRules)
      if (zone) {
        lo = zone.from
        hi = zone.to
        prefix = keptLinePrefix(line)
      }
    }
    var before = prefix + line.slice(lo, from)
    var after = line.slice(to, hi)
    var l = before && !/\s$/.test(before) ? ' ' : ''
    /* Знак за полосой есть всегда: каретка встаёт за ним, на краю Obsidian показала бы `==`. */
    var r = !/^\s/.test(after) ? ' ' : ''
    c.caretVisibleCh = before.length + l.length + strip.head.length
    return before + l + strip.head + r + after
  }

  /** Вид строки для любой панели: Left/Right — как было, custom — у каретки. */
  function panelView(state_) {
    if (state_.custom) return customControlLine(state_)
    return withKeptPrefix(state_.originalLine,
      state_.core.renderControlLine(state_.rules, state_.session, state_.parsedLine, state_.valueNamesCfg))
  }

  function applyCustomSelection(state_) {
    var c = state_.custom
    var text = customTokens(state_).join(' ')
    clearPanelMask(state_)
    unwritePanelLine(state_)
    var from = c.span ? c.span.from : c.caretCh
    var to = c.span ? c.span.to : c.caretCh
    if (!writeCustomInsert(state_.editor, state_.lineNumber, state_.originalLine, from, to, text)) {
      state_.editor.setCursor({ line: state_.lineNumber, ch: c.caretCh })
    }
    cleanupTagWheelState(state_)
  }

  /**
   * `Tab` в custom block (п. 8): контрол выключен — ничего; включён — следующий
   * блок по кругу. Выбранное в прежнем блоке выбрасывается (`В-208`).
   */
  function switchCustomBlock(state_) {
    var c = state_.custom
    if (!state_.customTab || !c.blocks.length) return
    var at = c.blocks.findIndex(function (b) { return b.id === c.blockId })
    var next = c.blocks[(at + 1) % c.blocks.length]
    if (!next || next.id === c.blockId) return
    c.blockId = next.id
    c.span = null
    state_.rules = next.rules
    state_.orderCfg = next.orderCfg
    state_.parsedLine = state_.core.parseLine(state_.originalLine, next.rules)
    state_.session = newCustomSession(state_.core, next.rules)
    state_.session.activeField = state_.core.resolveInitialActiveField(next.rules, state_.session, 'left')
  }

  /** Правила соседнего блока — теми же шагами, что у открытого; готовятся при открытии ради быстрого `Tab`. */
  function prepareBlockRules(raw, o) {
    var next = JSON.parse(JSON.stringify(raw))
    if (!next.behavior || typeof next.behavior !== 'object') next.behavior = {}
    next.behavior.dateRuntimeConfig = o.dateRuntimeCfg
    var orderNext = o.parseOrderConfigFn(JSON.stringify(next.behavior.order || {}), o.normalizeOrderKey)
    rulesHelpers.applyOrderToRules(next, orderNext)
    if (o.sf === 'separate' || o.sf === 'combined') next.behavior.subtagFormat = o.sf
    o.core.validateRules(next)
    o.core.applyActiveFieldChoiceToRules(next, customActiveFieldChoice(o.runtimeInput))
    return { rules: next, orderCfg: orderNext }
  }

  /* `Active Field on opening` в custom block (п. 10): первый или средний; `A Field you choose` — как первый. */
  function customActiveFieldChoice(input_) {
    var mode = String(input_.activeFieldMode || '').trim().toLowerCase()
    return { mode: mode === 'middle' ? 'middle' : 'first', left: '', right: '' }
  }

  /**
   * Команда `next`/`previous` Field блока — по месту каретки: на значении
   * меняет его на соседнее, иначе ставит у каретки первое/последнее.
   */
  function runCustomCycle(o, line, cursor_) {
    var cycle = null
    try { cycle = JSON.parse(String(o.runtimeInput.customCycle || '')) } catch (_eCycle) {
      /* Шаг — строка настройки от реестра команд; сломанная — команда не наша, ниже скажут вслух. */
    }
    var key = String(cycle && cycle.key || '')
    var field = customBlockFields(o.rules).find(function (f) {
      return String(f.orderKey || '') === key || String(f.id || '') === key
    })
    if (!field) {
      notice(tagWheelNoticeKey('custom-no-field'), 'tagWheel: this Field is not in a custom block any more')
      return
    }
    var session_ = newCustomSession(o.core, o.rules)
    var hit = customHitAtCaret(o.core, o.rules, line, cursor_.ch)
    var span = hit && hit.fieldIds.indexOf(field.id) !== -1 ? hit.span : null
    if (span) session_.selected[field.id] = hit.selected[field.id]
    session_.activeFieldId = field.id
    o.core.cycleValue(o.rules, session_, cycle.direction === 'decrease' ? -1 : 1)
    o.core.sanitizeState(o.rules, session_)
    var token = customTokenFor(o.core, o.rules, session_, field)
    writeCustomInsert(o.editor, cursor_.line, line,
      span ? span.from : cursor_.ch, span ? span.to : cursor_.ch, token)
  }

  /**
   * Открыть панель custom block у каретки (10.13.260): на значении Field блока —
   * с ним выбранным (п. 5), иначе пустой (п. 4).
   */
  async function openCustomBlock(o) {
    var input_ = o.runtimeInput
    /* Выделение — каретка на его конце, выделенный текст не трогается. */
    var cursor_ = o.editor.getCursor('to')
    var line = String(o.editor.getLine(cursor_.line) || '')
    /* Каретка в начале строки (отступ, цитата, знак, чекбокс, заголовок) встаёт за него:
       значение не встаёт перед `- `. Команда и панель берут каретку отсюда. */
    var lead = __sharedUtils.lineStartOf(line).at
    if (cursor_.ch < lead) cursor_ = { line: cursor_.line, ch: lead }
    /* Каретка внутри слова встаёт за ним — значение не режет слово (BUGHUNT A6).
       У края слова остаётся: там значение узнаётся (`|aaa`, `aaa|`). */
    var word = customWordSpan(line, cursor_.ch)
    if (word && word.from < cursor_.ch && cursor_.ch < word.to) cursor_ = { line: cursor_.line, ch: word.to }
    if (input_.customCycle) { runCustomCycle(o, line, cursor_); return }

    var blockId = String(input_.customBlock || '')
    var raw = input_.customBlocks
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw) } catch (_eBlocks) {
        /* Список блоков сломан — «соседей нет»: `Tab` ничего не делает, блок откроется. */
        raw = []
      }
    }
    o.core.applyActiveFieldChoiceToRules(o.rules, customActiveFieldChoice(input_))
    var blocks = (Array.isArray(raw) ? raw : []).filter(function (b) { return b && b.id && b.rules })
      .map(function (b) {
        if (String(b.id) === blockId) return { id: blockId, rules: o.rules, orderCfg: o.orderCfg }
        var ready = prepareBlockRules(b.rules, o)
        return { id: String(b.id), rules: ready.rules, orderCfg: ready.orderCfg }
      })

    var session_ = newCustomSession(o.core, o.rules)
    session_.activeField = o.core.resolveInitialActiveField(o.rules, session_, 'left')
    var hit = customHitAtCaret(o.core, o.rules, line, cursor_.ch)
    if (hit) {
      hit.fieldIds.forEach(function (fid) { session_.selected[fid] = hit.selected[fid] })
      session_.activeFieldId = hit.fieldIds[0]
    }
    o.core.sanitizeState(o.rules, session_)

    var state = {
      active: true,
      core: o.core,
      editor: o.editor,
      rules: o.rules,
      lineNumber: cursor_.line,
      originalLine: line,
      parsedLine: o.core.parseLine(line, o.rules),
      session: session_,
      cycleEndBehavior: input_.cycleEndBehavior,
      cursorPolicy: input_.cursorPolicy,
      orderCfg: o.orderCfg,
      app: o.app,
      lineFinalize: o.lineFinalize,
      targetPanel: 'left',
      originalCursorCh: cursor_.ch,
      keyHandler: null,
      scrollerCfg: o.scrollerCfg,
      valueNamesCfg: o.valueNamesCfg,
      /* `tagWheel navigation behavior` к custom block не относится (п. 11). */
      edgeMode: 'stay',
      scrollerOverlay: null,
      customTab: input_.customTab === true,
      custom: {
        blockId: blockId,
        blocks: blocks,
        lineRules: __pkmOptionKeysMod.rulesFromSettings(input_, 'lineRulesData'),
        span: hit ? hit.span : null,
        caretCh: cursor_.ch,
        caretVisibleCh: cursor_.ch,
      },
    }
    await mountSession(state)
  }

  function applySelection(state, core) {
    /* Command Field на строку не пишется ничем, кроме своего Enter (№ 199). */
    if (state && state.rules && state.session) __commandFieldWheel.clearSelections(state.rules, state.session)
    if (state && state.custom) {
      /* Навигатор не пишется и в custom block (`В-221`); «стоял на строке» — только заменяемое слово (правило 107). */
      var sp = state.custom.span
      ;(core || state.core).dropNavigatorSelections(state.rules, state.session,
        sp ? String(state.originalLine || '').slice(sp.from, sp.to) : '')
      applyCustomSelection(state)
      return
    }
    /* Навигатор на строку не пишется (PRD 10.13.269). */
    (core || state.core).dropNavigatorSelections(state.rules, state.session, state.originalLine)
    var applyStartedAt = Date.now()
    var beforeSourceLine = String(state && state.originalLine ? state.originalLine : '')
    var beforeControlLine = ''
    try {
      beforeControlLine = String(state && state.editor && typeof state.editor.getLine === 'function'
        ? (state.editor.getLine(state.lineNumber) || '')
        : '')
    } catch (_) {
      beforeControlLine = ''
    }
    var activeFieldIdForLog = String(state && state.session && state.session.activeFieldId ? state.session.activeFieldId : '')
    emitTagWheelDevEvent(state && state.app ? state.app : null, 'pkm.run.start', {
      command: 'tagWheel',
      lineNo: state ? state.lineNumber : -1,
      cursorCh: state ? state.originalCursorCh : -1,
      beforeLine: beforeSourceLine,
      actionType: activeFieldIdForLog ? ('apply_field:' + activeFieldIdForLog) : 'apply_field:unknown',
      direction: null,
      cycleEndBehavior: String(state && state.cycleEndBehavior ? state.cycleEndBehavior : ''),
      subtagFormat: String(state && state.rules && state.rules.behavior ? state.rules.behavior.subtagFormat || '' : ''),
      cursorPolicy: String(state && state.cursorPolicy ? state.cursorPolicy : ''),
      controlBeforeLine: beforeControlLine,
    })

    var selectedEntries = collectSelectedTagEntries(state)
    var rightEntries = collectSelectedRightEntries(state)
    /* Пустой `token` — «убрать набор из строки», выход из цикла (Н-5); набор токенов обязателен. */
    var rightSourceEntries = rightEntries.filter(function (e) {
      return !!(e && Array.isArray(e.tokens) && e.tokens.length && (e.sourceKind === 'projects' || e.sourceKind === 'wikilinks' || e.sourceKind === 'tag'))
    })
    var hasRightSelected = rightEntries.length > 0
    var freeRoamBehavior = rulesHelpers.resolveFreeRoamBehavior(state.orderCfg)
    var finalize = state && state.lineFinalize ? state.lineFinalize : null
    if (!finalize || typeof finalize.resolveMixedSelectionPolicy !== 'function' || typeof finalize.applyUnifiedPostFinalize !== 'function') {
      throw new Error('pkm_line_finalize_unified unavailable: mixed policy api')
    }
    var activeFieldIdForPolicy = String(state && state.session ? state.session.activeFieldId || '' : '')
    var activeFieldForPolicy = activeFieldIdForPolicy ? getFieldByIdAny(state.rules, activeFieldIdForPolicy) : null
    var activeFieldKeyForPolicy = activeFieldForPolicy ? String(activeFieldForPolicy.orderKey || activeFieldForPolicy.id || '').trim() : ''
    var activeFieldModeForPolicy = activeFieldKeyForPolicy ? rulesHelpers.resolveFieldFreeRoamMode(state.orderCfg, activeFieldKeyForPolicy) : 'off'
    var policy = typeof finalize.resolveEffectiveSelectionPolicy === 'function'
      ? finalize.resolveEffectiveSelectionPolicy({
        selectedEntries: selectedEntries,
        freeRoamBehavior: freeRoamBehavior,
        activeMode: activeFieldModeForPolicy,
      })
      : finalize.resolveMixedSelectionPolicy(selectedEntries, freeRoamBehavior)
    var hasOffSelected = !!policy.hasOffSelected
    var hasFullSelected = !!policy.hasFullSelected
    var hasMinimalSelected = !!policy.hasMinimalSelected
    var prefixState = state.session
    var ignoreByField = policy && policy.minimalPrefixIgnoreFieldIds ? policy.minimalPrefixIgnoreFieldIds : {}
    if (Object.keys(ignoreByField).length) {
      prefixState = Object.assign({}, state.session, { __prefixIgnoreFieldIds: ignoreByField })
      }
    var offPrefixFlags = { preserveCheckboxPrefix: false, forceBulletPrefix: false, preserveOffImmutability: false }
    /* `Insert only` спрашивает те же флаги, что `Strict`: иначе чекбокс человека уходил (E2). */
    if (hasOffSelected || hasMinimalSelected) {
      var activeFieldId = String(state && state.session ? state.session.activeFieldId || '' : '')
      var activeField = activeFieldId ? getFieldByIdAny(state.rules, activeFieldId) : null
      var fieldKey = activeField ? String(activeField.orderKey || activeField.id || '').trim() : ''
      var mode = fieldKey ? rulesHelpers.resolveFieldFreeRoamMode(state.orderCfg, fieldKey) : 'off'
      var hasOwnCheckbox = activeFieldId ? fieldHasOwnCheckbox(state.rules, state.session, activeFieldId) : false
      /*
       * Выход из цикла: значение снято, а знак на строке — вид значения этого
       * Field; знак уходит со значением, префикс — по настройкам. Так же
       * считает хоткей (`status_tags.js`) (И-3, исключение № 6 из З3).
       * Спрашивается о самом знаке, не «бывают ли у поля знаки» (10.13.105).
       * Значения нет — `hasOwnCheckbox` уже `false`, флаги не спорят.
       */
      var clearedOwnCheckbox = !!activeFieldId
        && !selectedTokenForField(state.rules, state.session, activeField)
        && checkboxBelongsToField(state.rules, activeFieldId,
          state.parsedLine && state.parsedLine.checkboxToken, finalize)
      offPrefixFlags = finalize.resolveOffPrefixFlagsUnified({
        mode: mode,
        freeRoamBehavior: freeRoamBehavior,
        hasOwnCheckbox: hasOwnCheckbox,
        clearedOwnCheckbox: clearedOwnCheckbox
      })
    }
    prefixState = Object.assign({}, prefixState, {
      __preserveCheckboxPrefix: offPrefixFlags.preserveCheckboxPrefix,
      __forceBulletPrefix: offPrefixFlags.forceBulletPrefix
    })
    state.prefixState = prefixState
    var parsedForBuild = state.parsedLine
    var tags = core.buildTags(state.rules.leftMode, state.session, state.rules, parsedForBuild)
    var rightDates = core.buildRightDates(state.rules, state.session)
    var datesText = rightDates.join(' ').trim()
    /* Чужое в правом Block (`#processed` от `Inline to note`) панель терять не вправе (В-141). */
    if (typeof core.getUnmanagedRightTokens !== 'function') {
      throw new Error('tagwheel_core unavailable: getUnmanagedRightTokens')
    }
    var keptRight = core.getUnmanagedRightTokens(parsedForBuild, state.rules)
    if (keptRight.length) datesText = (datesText + ' ' + keptRight.join(' ')).trim()
    var nextPrefix = core.buildPrefix(parsedForBuild, state.rules, prefixState, { prefixShared: finalize })
    var finalLine = core.assembleFinalLine(
      {
        indent: parsedForBuild.indent,
        prefix: nextPrefix,
        text: parsedForBuild.text,
        dates: datesText
      },
      tags,
      state.rules,
      { forceSeparatorWhenTags: state.rules.behavior.forceSeparatorWhenTags !== false }
    )
    if (rightSourceEntries.length) {
      var rsi
      for (rsi = 0; rsi < rightSourceEntries.length; rsi++) {
        var rs = rightSourceEntries[rsi]
        /* Панель посчитана по Order в `collectSelectedRightEntries` (Н-3). */
        finalLine = relocateTagFieldByPanel(finalLine, state.rules, rs.tokens, rs.token, rs.panel, { rightToText: false })
      }
    }
    finalLine = relocateDateLikeByOrder(finalLine, state.rules, state.orderCfg)
    finalLine = relocateTagLikeByOrder(finalLine, state.rules, state.orderCfg, state.session, core)
    finalLine = reorderLineByOrder(finalLine, state.rules, state.orderCfg)
    finalLine = enforceDependentAdjacencyBySelection(finalLine, state, core)

    if (hasOffSelected) {
      var offEntries = selectedEntries.filter(function(e) { return e && e.mode === 'off' })
      var offHasLeft = offEntries.some(function(e) { return e && e.panel === 'left' })
      var offHasRight = offEntries.some(function(e) { return e && e.panel === 'right' })
      finalLine = finalize.applyOffSelectionPostPolicies({
        rawLine: state.originalLine,
        finalLine: finalLine,
        rules: state.rules,
        offEntries: offEntries,
        offHasLeft: offHasLeft,
        offHasRight: offHasRight,
        extractOriginalText: function(rawLineInput, runtimeRules) {
          return linePipeline.extractOriginalTextFromRawLine(rawLineInput, runtimeRules)
        },
        enforceTextSegmentForLeftTag: function(lineInput, runtimeRules, originalText) {
          return linePipeline.enforceTextSegmentForLeftTag(lineInput, runtimeRules, originalText)
        },
        removeTokens: function(seg, tokenList) {
          if (typeof macroShared.removeTokensFromSegment !== 'function') {
            throw new Error('pkm_macro_shared unavailable: removeTokensFromSegment')
          }
          return macroShared.removeTokensFromSegment(seg, tokenList)
        },
        appendToken: appendToken,
        buildFromSegments: function(seg, rules, sep1, sep2) {
          return linePipeline.buildFromSegments(seg, rules)
        },
      })
    }

    if (hasMinimalSelected) {
      finalLine = applyMinimalLeftTagNormalization(finalLine, state, core, {
        preserveExistingTokens: hasOffSelected,
        finalize: finalize,
      })
    }
    finalLine = applyFullTagNormalization(finalLine, state, finalize)
    var selectedMode = hasFullSelected ? 'full' : (hasOffSelected ? 'off' : (hasMinimalSelected ? 'minimal' : 'off'))
    finalLine = finalize.applyUnifiedPostFinalize({
      rawLine: state.originalLine,
      line: finalLine,
      rules: state.rules,
      mode: selectedMode,
      mixedPolicy: policy,
      preserveOff: offPrefixFlags.preserveOffImmutability || /^\s*#{1,6}\s+/.test(String(state.originalLine || '')),
      preserveMinimalHeading: hasMinimalSelected,
    })
    if (hasFullSelected) {
      finalLine = finalize.applyFullNoSourceNormalization({
        rawLine: state.originalLine,
        finalLine: finalLine,
        rules: state.rules,
      })
    }

    if (macroShared.isNoContentParsed(state.parsedLine, { includeTags: true })) {
      var parsedFinal = core.parseLine(finalLine, state.rules)
      finalLine = finalize.applyTrailingSeparatorPolicy({
        line: finalLine,
        rules: state.rules,
        parsedFinal: parsedFinal,
        freeRoamMode: hasFullSelected ? 'full' : (hasMinimalSelected ? 'minimal' : 'off'),
        mixedMinimalSeparatorOff: policy.applyMinimalSeparatorCollapse,
        ensureTrailingSeparatorSpace: macroShared.ensureTrailingSeparatorSpace,
      })
    }

    if (hasRightSelected) {
      if (!linePipeline || typeof linePipeline.normalizeRightPayloadTailToDates !== 'function') {
        throw new Error('line_pipeline unavailable: normalizeRightPayloadTailToDates')
      }
      finalLine = linePipeline.normalizeRightPayloadTailToDates({ line: finalLine, rules: state.rules })
      finalLine = reorderLineByOrder(finalLine, state.rules, state.orderCfg)
    }

    /* Знак задачи человека переживает и конец цикла: уносится только знак
       значения того Field, который сейчас крутят (10.13.105). */
    var keepForeignCheckbox = !checkboxBelongsToField(state.rules, activeFieldId,
      state.parsedLine && state.parsedLine.checkboxToken, finalize)

    var cyclePost = finalize.applyCycleEndAndInvariants({
      rawLine: state.originalLine,
      finalLine: finalLine,
      rules: state.rules,
      mode: selectedMode,
      cycleEndBehavior: macroShared.normalizeCycleEndBehavior(state.cycleEndBehavior),
      parsedLine: state.parsedLine,
      parseLine: core.parseLine,
      isBulletLikeEmptyResult: macroShared.isBulletLikeEmptyResult,
      buildBulletOnlyLine: function(parsed) { return macroShared.buildBulletOnlyLine(parsed, { keepParsedPrefix: true, keepCheckbox: keepForeignCheckbox }) },
      enforceNoContentFinalization: macroShared.isNoContentParsed(state.parsedLine, { includeTags: true }),
      isNoContentParsed: function(parsed) { return macroShared.isNoContentParsed(parsed, { includeTags: true }) },
      /* Знак списка и знак задачи человека — одной записью, иначе пробел за `[x]`
         теряется и строка перестаёт быть задачей (10.13.105). */
      shouldKeepBulletLine: function(line) {
        return /^\s*-\s*(?:\[[^\]]\]\s*)?$/.test(String(line || ''))
      },
    })
    finalLine = String(cyclePost && cyclePost.finalLine != null ? cyclePost.finalLine : finalLine)
    /* Строке после `Clear line` правый Block собирать не из чего; инварианты вернули бы знак списка (`В-260`, BUGHUNT A18). */
    if (hasRightSelected && !(cyclePost && cyclePost.cleared)) {
      if (!linePipeline || typeof linePipeline.normalizeRightPayloadTailToDates !== 'function') {
        throw new Error('line_pipeline unavailable: normalizeRightPayloadTailToDates')
      }
      finalLine = linePipeline.normalizeRightPayloadTailToDates({ line: finalLine, rules: state.rules })
      finalLine = reorderLineByOrder(finalLine, state.rules, state.orderCfg)
      if (!finalize || typeof finalize.applyFinalLineInvariants !== 'function') {
        throw new Error('pkm_line_finalize_unified unavailable: applyFinalLineInvariants')
      }
      finalLine = finalize.applyFinalLineInvariants({
        rawLine: state.originalLine,
        line: finalLine,
        rules: state.rules,
        mode: selectedMode,
      })
    }

    var finalPrefixFieldId = String(state && state.session && state.session.activeFieldId ? state.session.activeFieldId : '')
    var finalPrefixOwnCheckbox = finalPrefixFieldId ? fieldHasOwnCheckbox(state.rules, state.session, finalPrefixFieldId) : false
    var finalPrefixParsed = core.parseLine(String(finalLine || ''), state.rules)
    var finalPrefixResolved = String(core.buildPrefix(finalPrefixParsed, state.rules, state.prefixState || state.session, { prefixShared: finalize }) || '').trim()
    /*
     * Префикс в `Strict` решает `Strict: add a bullet` один раз — внутри
     * `enforceOffModeFinalPrefixUnified` (S15, У-150). Как у шага по тегу
     * (`status_tags.js`): синтетический префикс сохраняют только выбранные
     * поля режима `minimal`.
     */
    finalLine = finalize.enforceOffModeFinalPrefixUnified({
      line: finalLine,
      rawLine: state.originalLine,
      mode: selectedMode,
      freeRoamBehavior: freeRoamBehavior,
      hasOwnCheckbox: finalPrefixOwnCheckbox,
      resolvedPrefix: finalPrefixResolved,
      cycleEndBehavior: macroShared.normalizeCycleEndBehavior(state.cycleEndBehavior),
      parseLine: core.parseLine,
      rules: state.rules,
      preserveSyntheticPrefix: hasMinimalSelected,
    })

    /*
     * Один `Ctrl+Z` возвращает исходную строку: сначала возврат к исходной мимо
     * истории (записи панели туда тоже не шли), потом итог обычным путём —
     * история получает «исходная → итог».
     */
    clearPanelMask(state)
    unwritePanelLine(state)
    if (cyclePost && cyclePost.applyKeepBullet) {
      macroShared.applyKeepBullet(state.editor, state.lineNumber, state.parsedLine, { keepParsedPrefix: true, keepCheckbox: keepForeignCheckbox })
      emitTagWheelDevEvent(state && state.app ? state.app : null, 'pkm.run.result', {
        command: 'tagWheel',
        lineNo: state ? state.lineNumber : -1,
        beforeLine: beforeSourceLine,
        afterLine: String(state && state.editor && typeof state.editor.getLine === 'function' ? (state.editor.getLine(state.lineNumber) || '') : ''),
        changed: beforeSourceLine !== String(state && state.editor && typeof state.editor.getLine === 'function' ? (state.editor.getLine(state.lineNumber) || '') : ''),
        durationMs: Date.now() - applyStartedAt,
        actionType: activeFieldIdForLog ? ('apply_field:' + activeFieldIdForLog) : 'apply_field:unknown',
        direction: null,
        controlBeforeLine: beforeControlLine,
        cycleAppliedKeepBullet: true,
      })
      cleanupTagWheelState(state)
      return
    }
    state.editor.setLine(state.lineNumber, finalLine)
    emitTagWheelDevEvent(state && state.app ? state.app : null, 'pkm.run.result', {
      command: 'tagWheel',
      lineNo: state ? state.lineNumber : -1,
      beforeLine: beforeSourceLine,
      afterLine: String(finalLine || ''),
      changed: beforeSourceLine !== String(finalLine || ''),
      durationMs: Date.now() - applyStartedAt,
      actionType: activeFieldIdForLog ? ('apply_field:' + activeFieldIdForLog) : 'apply_field:unknown',
      direction: null,
      controlBeforeLine: beforeControlLine,
    })
    var nextCh = finalize.resolveCursorByPolicy({
      finalLine: finalLine,
      rules: state.rules,
      cursorPolicy: macroShared.normalizeCursorPolicy(state.cursorPolicy),
      originalLine: state.originalLine,
      originalCursorCh: state.originalCursorCh,
      bootstrapToTextEndWhenSourceEmpty: true,
      getCursorAtTextEnd: macroShared.getCursorAtTextEnd,
      remapCursorByLineDiff: macroShared.remapCursorByLineDiff,
    })
    /* Ничего не поставлено — каретка там, где была до панели (его `🐛` цикла 121). */
    if (String(finalLine) === String(state.originalLine)) nextCh = caretBeforePanel(state)
    state.editor.setCursor({ line: state.lineNumber, ch: nextCh })
    cleanupTagWheelState(state)
  }

  /** Каретка до открытия панели — в строке, вернувшейся к исходной. */
  function caretBeforePanel(state) {
    if (state.custom) return state.custom.caretCh
    var ch = Math.trunc(Number(state.originalCursorCh))
    var len = String(state.originalLine || '').length
    return isFinite(ch) && ch >= 0 ? Math.min(ch, len) : len
  }

  function getControlCursorCh(state, controlLine) {
    /* Панель custom block держит каретку у полосы, а не по правилу курсора. */
    if (state && state.custom) return state.custom.caretVisibleCh
    var cp = macroShared.normalizeCursorPolicy(state && state.cursorPolicy)
    var control = String(controlLine || '')
    if (cp === 'text_end') return macroShared.getCursorAtTextEnd(control, state && state.rules ? state.rules : {})
    if (cp === 'line_end') return control.length
    var ch = Number(state && state.originalCursorCh)
    if (!isFinite(ch) || ch < 0) return control.length
    return Math.min(control.length, Math.max(0, Math.trunc(ch)))
  }

  function getFieldByIdFromRules(rules, fieldId) {
    var fid = String(fieldId || '').trim()
    if (!fid) return null
    var modes = [rules && rules.leftMode, rules && rules.rightMode]
    var mi
    for (mi = 0; mi < modes.length; mi++) {
      var mode = modes[mi]
      var fields = mode && Array.isArray(mode.fields) ? mode.fields : []
      var i
      for (i = 0; i < fields.length; i++) {
        if (String(fields[i] && fields[i].id || '') === fid) return { field: fields[i], mode: mode }
      }
    }
    return null
  }

  function buildScrollerItems(state) {
    if (!state || !state.session || !state.core || !state.rules) return null
    var activeFieldId = String(state.session.activeFieldId || '').trim()
    if (!activeFieldId) return null
    var hit = getFieldByIdFromRules(state.rules, activeFieldId)
    if (!hit || !hit.field || !hit.mode) return null

    function cloneSessionForScroller(src) {
      var raw = src && typeof src === 'object' ? src : {}
      var cloned = JSON.parse(JSON.stringify(raw))
      if (!cloned.selected || typeof cloned.selected !== 'object') cloned.selected = {}
      cloned.activeFieldId = activeFieldId
      return cloned
    }

    function formatVisualToken(rawToken) {
      var src = String(rawToken || '')
      var showPrefix = true
      try {
        showPrefix = !(state && state.rules && state.rules.colors && state.rules.colors.tagwheelHeader && state.rules.colors.tagwheelHeader.showPrefix === false)
      } catch (_) {
        showPrefix = true
      }
      var t = src.trim()
      if (!t) return src
      /* Подпись ссылки — то, что покажет строка (общий дом). */
      var linkShown = __sharedUtils.wikilinkShownOf(t)
      if (linkShown) return linkShown
      if (showPrefix) return src
      if (/^#\//.test(t)) return t.replace(/^#\//, '')
      if (__sharedUtils.startsWithTagToken(t)) return t.replace(/^#/, '')
      if (/^[^A-Za-zА-Яа-я0-9\[]+/.test(t)) {
        var stripped = t.replace(/^[^A-Za-zА-Яа-я0-9\[]+/, '')
        if (/^(\d{4}-\d{2}-\d{2}|\d{2}:\d{2}|\d)/.test(stripped)) return stripped
      }
      return t
    }

    function getDisplayLabel(sessionNow) {
      if (!state.core || typeof state.core.getDisplayTokenByFieldId !== 'function') return '-'
      var token = String(state.core.getDisplayTokenByFieldId(state.rules, sessionNow, activeFieldId) || '')
      if (!token) {
        var selectedId = String(sessionNow && sessionNow.selected ? sessionNow.selected[activeFieldId] || '' : '')
        if (selectedId) {
          var vals = state.core.getAllowedValues(hit.mode, sessionNow, hit.field, state.rules)
          var vi
          for (vi = 0; vi < vals.length; vi++) {
            var vv = vals[vi]
            if (!vv || String(vv.id || '') !== selectedId) continue
            token = String(vv.label || vv.token || '')
            break
          }
        }
      }
      /*
       * Свой текст значения сильнее написания — только по `Scroller Value names`.
       * Спрашивается токен, а не `formatVisualToken`: карта собрана по токенам.
       * Положения соединяет `core.joinValueLabel`, как у полосы панели (2026-09-21).
       */
      var written = formatVisualToken(token || '-') || '-'
      var scroller = state && state.scrollerCfg ? state.scrollerCfg : null
      if (!scroller || (scroller.labels !== 'custom' && scroller.labels !== 'both')) return written
      var printed = String((scroller.customText || {})[String(token || '').trim()] || '')
      return state.core.joinValueLabel(printed, written, scroller.labels) || '-'
    }

    function buildBranch(direction, size) {
      var rows = []
      var work = cloneSessionForScroller(state.session)
      var i
      var maxAttempts = Math.max(size * 8, 8)
      var attempts = 0
      var seenKeys = {}
      for (i = 0; i < size && attempts < maxAttempts; attempts++) {
        var beforeVal = String(work.selected && work.selected[activeFieldId] || '')
        var beforeLabel = getDisplayLabel(work)
        state.core.cycleValue(state.rules, work, direction)
        state.core.sanitizeState(state.rules, work)
        var afterVal = String(work.selected && work.selected[activeFieldId] || '')
        var afterLabel = getDisplayLabel(work)
        if (beforeVal === afterVal && beforeLabel === afterLabel) break
        var key = afterVal + '|' + afterLabel
        if (seenKeys[key]) continue
        seenKeys[key] = true
        rows.push({ id: afterVal, label: afterLabel || '-' })
        i++
      }
      return rows
    }

    var size = state && state.scrollerCfg ? Math.max(1, Math.min(20, Math.trunc(Number(state.scrollerCfg.size || 3)))) : 3
    var activeLabel = getDisplayLabel(state.session)
    var upItems = buildBranch(+1, size)
    var downItems = buildBranch(-1, size)

    return {
      fieldId: hit.field.id,
      activeLabel: activeLabel,
      upItems: upItems,
      downItems: downItems,
    }
  }

  function updateScrollerOverlay(state, controlLine) {
    if (!state || !state.active || !state.scrollerOverlay || typeof state.scrollerOverlay.update !== 'function') return
    try {
      var snapshot = buildScrollerItems(state)
      var hasAnyRows = !!(snapshot
        && (String(snapshot.activeLabel || '').trim()
          || (Array.isArray(snapshot.upItems) && snapshot.upItems.length)
          || (Array.isArray(snapshot.downItems) && snapshot.downItems.length)))
      if (!hasAnyRows) {
        if (typeof state.scrollerOverlay.hide === 'function') state.scrollerOverlay.hide()
        return
      }
      state.scrollerOverlay.update({
        editor: state.editor,
        lineNumber: state.lineNumber,
        controlLine: String(controlLine || ''),
        anchorFieldId: snapshot.fieldId,
        activeLabel: snapshot.activeLabel,
        upItems: snapshot.upItems,
        downItems: snapshot.downItems,
      })
    } catch (_) {
      /* Украшение: оверлей не роняет работу — останется прежний кадр коробки, строка и выбор целы. */
    }
  }

  /**
   * Нарисовать панель на строке: полоса рядом со значениями, а не вместо
   * (2026-09-13, У-160): документ получает только вставку, закрытое полосой
   * прячется оформлением. Вид считает `renderControlLine`; запись без
   * удаления — `planPanelLineWrite`. Плана нет (свойства не сошлись) — пишем
   * целой строкой; это проба, а не отказ.
   */
  function drawPanelLine(state, controlLine) {
    var control = String(controlLine == null ? '' : controlLine)
    var plan = null
    try {
      plan = __panelLineWriteMod.planPanelLineWrite(state.originalLine, control)
    } catch (e) {
      reportTagWheelError(e)
    }
    var text = plan ? plan.text : control
    /* Прежний вид снимается точными отрезками, новый — точными вставками: различие
       унесло бы значение человека между кусками полосы, и его ступень истории схлопнулась бы. */
    if (plan) unwritePanelLine(state)
    state.panelPlan = plan
    if (!plan || !insertPanelPlan(state, plan)) {
      state.panelPlan = plan
      setLineOutsideHistory(state.editor, state.lineNumber, text)
    }
    /* Маска — после записи: отрезки считаны по новой строке; иначе кадр маски по прежней. */
    __panelMaskMod.applyPanelMask(state.editor ? state.editor.cm : null,
      state.lineNumber, plan ? plan.hidden : [])
    state.editor.setCursor({
      line: state.lineNumber,
      ch: cursorOutsidePanelStrip(text, plan,
        visibleChToTextCh(text, plan ? plan.hidden : [], getControlCursorCh(state, control)),
        Boolean(state.custom)),
    })
    /* Оверлею — записанная строка, а не вид: столбцы документа разошлись бы на длину вставки. */
    updateScrollerOverlay(state, text)
  }


  /** Столбец в записанной строке по видимому: спрятанное стоит в строке, но места на экране не занимает. */
  function visibleChToTextCh(text, hidden, visibleCh) {
    var want = Math.max(0, Number(visibleCh) || 0)
    var ranges = Array.isArray(hidden) ? hidden : []
    var seen = 0
    var at = 0
    var i
    for (i = 0; i < ranges.length; i++) {
      var from = Number(ranges[i][0]) || 0
      var to = Number(ranges[i][1]) || 0
      var visible = from - at
      if (seen + visible >= want) return at + (want - seen)
      seen += visible
      at = to
    }
    return Math.min(String(text || '').length, at + (want - seen))
  }

  /**
   * Вид панели точными вставками в строку человека; зовётся на строке, равной
   * исходной. Не равна (человек правил или снятие не вышло) — `false`, зовущий
   * пишет строку целиком. Проба, а не отказ.
   */
  function insertPanelPlan(state, plan) {
    if (!plan || !Array.isArray(plan.insertAt) || !plan.insertAt.length) return false
    var view = state && state.editor ? state.editor.cm : null
    var Transaction = __cmState ? __cmState.Transaction : null
    if (!view || !view.state || typeof view.dispatch !== 'function'
      || !Transaction || !Transaction.addToHistory || typeof Transaction.addToHistory.of !== 'function') return false
    try {
      var docLine = view.state.doc.line(Number(state.lineNumber) + 1)
      if (String(docLine.text) !== String(state.originalLine)) return false
      var changes = []
      var i
      for (i = 0; i < plan.insertAt.length; i++) {
        changes.push({
          from: docLine.from + Number(plan.insertAt[i][0]),
          insert: String(plan.insertAt[i][1]),
        })
      }
      view.dispatch({ changes: changes, annotations: Transaction.addToHistory.of(false) })
      return true
    } catch (e) {
      reportTagWheelError(e)
      return false
    }
  }

  function clearPanelMask(state) {
    __panelMaskMod.applyPanelMask(state && state.editor ? state.editor.cm : null,
      state ? state.lineNumber : 0, [])
  }

  /**
   * Снять вставку панели ровно её отрезками: `lineDiffChange` режет середину
   * одним куском и уносит значение человека между кусками вставки (У-164).
   * Плана нет или строка не та — целой строкой (человек мог править сам).
   */
  function unwritePanelLine(state) {
    var plan = state ? state.panelPlan : null
    state.panelPlan = null
    var view = state && state.editor ? state.editor.cm : null
    var Transaction = __cmState ? __cmState.Transaction : null
    if (plan && Array.isArray(plan.inserted) && plan.inserted.length
      && view && view.state && typeof view.dispatch === 'function'
      && Transaction && Transaction.addToHistory && typeof Transaction.addToHistory.of === 'function') {
      try {
        var docLine = view.state.doc.line(Number(state.lineNumber) + 1)
        if (String(docLine.text) === String(plan.text)) {
          var changes = []
          var i
          for (i = 0; i < plan.inserted.length; i++) {
            changes.push({
              from: docLine.from + Number(plan.inserted[i][0]),
              to: docLine.from + Number(plan.inserted[i][1]),
            })
          }
          view.dispatch({ changes: changes, annotations: Transaction.addToHistory.of(false) })
          return
        }
      } catch (e) {
        reportTagWheelError(e)
      }
    }
    setLineOutsideHistory(state.editor, state.lineNumber, state.originalLine)
  }

  function cancelSelection(state) {
    /* Отмена возвращает строку как была, следа в истории не оставляет. */
    clearPanelMask(state)
    unwritePanelLine(state)
    state.editor.setCursor({ line: state.lineNumber, ch: caretBeforePanel(state) })
    cleanupTagWheelState(state)
    /* Отмена возвращает и выделение: строка уже прежняя (цикл 121). */
    if (state.keptSelection && typeof state.editor.setSelection === 'function') {
      state.editor.setSelection(state.keptSelection.anchor, state.keptSelection.head)
    }
  }

  function resolveStartMode(input_, rules) {
    var behavior = rules && rules.behavior ? rules.behavior : {}
    var inputKey = (typeof behavior.startModeInputKey === 'string' && behavior.startModeInputKey)
      ? behavior.startModeInputKey
      : 'startMode'
    var settingInputKey = (typeof behavior.startSettingInputKey === 'string' && behavior.startSettingInputKey)
      ? behavior.startSettingInputKey
      : 'startSetting'
    var explicit = ''

    if (input_ && typeof input_[inputKey] === 'string') explicit = input_[inputKey]
    else if (input_ && typeof input_.mode === 'string') explicit = input_.mode

    explicit = String(explicit || '').toLowerCase().trim()
    if (explicit === 'left' || explicit === 'right') return explicit

    var settingName = ''
    if (input_ && typeof input_[settingInputKey] === 'string') settingName = input_[settingInputKey]
    else if (input_ && typeof input_.setting === 'string') settingName = input_.setting
    else if (input_ && typeof input_.profile === 'string') settingName = input_.profile

    settingName = String(settingName || '').trim()
    var startSettings = behavior && behavior.startSettings && typeof behavior.startSettings === 'object'
      ? behavior.startSettings
      : null
    var profiles = startSettings && startSettings.profiles && typeof startSettings.profiles === 'object'
      ? startSettings.profiles
      : null

    function modeFromProfile(name) {
      if (!profiles || !name || !profiles[name] || typeof profiles[name] !== 'object') return ''
      var m = String(profiles[name].startMode || '').toLowerCase().trim()
      if (m === 'left' || m === 'right') return m
      return ''
    }

    var fromSetting = modeFromProfile(settingName)
    if (fromSetting) return fromSetting

    var defaultSetting = startSettings ? String(startSettings.default || '').trim() : ''
    var fromDefaultSetting = modeFromProfile(defaultSetting)
    if (fromDefaultSetting) return fromDefaultSetting

    var fallback = String(behavior.defaultMode || 'left').toLowerCase().trim()
    if (fallback === 'right') return 'right'
    return 'left'
  }

  /**
   * На каком Block панель откроется на самом деле (В-130): пустой Block —
   * открывается соседний. «Пусто» — тем же `getNavigableFieldSequence`, каким
   * панель рисуется, а не по спискам `leftMode`/`rightMode`: сторону решает
   * Order (У-32). Пусто и тогда, когда все поля спрятаны предусловием. Пусто с
   * обеих сторон — открывается запрошенный.
   */
  function resolvePanelOpeningMode(core_, rules_, session_) {
    if (core_.getNavigableFieldSequence(rules_, session_).length) return session_.mode
    var other = session_.mode === 'right' ? 'left' : 'right'
    var probe = {}
    var key
    for (key in session_) {
      if (Object.prototype.hasOwnProperty.call(session_, key)) probe[key] = session_[key]
    }
    probe.mode = other
    probe.activeFieldId = ''
    if (!core_.getNavigableFieldSequence(rules_, probe).length) return session_.mode
    return other
  }

  /**
   * Подключить сессию панели: коробка скроллера, перехват клавиш, `Alt`, шов
   * закрытия снаружи, первая отрисовка. Общий для Left/Right и custom block
   * (10.13.260, У-32).
   */
  async function mountSession(state) {
    if (state.scrollerCfg.enabled) {
      try {
        var scrollerMod = await loadTagWheelScrollerOverlay()
        state.scrollerOverlay = scrollerMod.createTagWheelScrollerOverlay({
          direction: state.scrollerCfg.direction,
          size: state.scrollerCfg.size,
          /* Цвета коробки (10.13.15). Пусто — оверлей оставляет цвета темы. */
          fillColor: state.scrollerCfg.fillColor,
          textColor: state.scrollerCfg.textColor,
        })
      } catch (eScroller) {
        state.scrollerOverlay = null
        reportTagWheelError(eScroller)
      }
    }

    state.keyHandler = function(e) {
      if (!state.active) return

      var keymap = state.rules.behavior.keymap || {}
      var handled = false
      /* `Alt` считается, только если между нажатием и отпусканием не было другой
         клавиши (`З-36`): `Alt+↑` — хоткей, `Alt+Tab` поле не переключает. */
      if (e.key !== 'Alt') state.altTap = false

      try {
        if (e.key === (keymap.nextField || 'ArrowRight')) {
          nextVirtualField(state, 1)
          handled = true
        } else if (e.key === (keymap.prevField || 'ArrowLeft')) {
          nextVirtualField(state, -1)
          handled = true
        } else if (e.key === (keymap.valueUp || 'ArrowUp')) {
          state.core.cycleValue(state.rules, state.session, 1)
          handled = true
        } else if (e.key === (keymap.valueDown || 'ArrowDown')) {
          state.core.cycleValue(state.rules, state.session, -1)
          handled = true
        } else if (e.key === (keymap.switchMode || 'Tab') && state.custom) {
          /* Панель Left/Right сюда не приходит (п. 8). */
          switchCustomBlock(state)
          handled = true
        } else if (e.key === (keymap.switchMode || 'Tab')) {
          state.session.mode = state.session.mode === 'left' ? 'right' : 'left'
          /* Имя ведущего поля кладёт разрешитель; согласование — `ensureActiveFieldId`. */
          state.session.activeField = state.core.resolveInitialActiveField(state.rules, state.session, state.session.mode)
          ensureActiveFieldId(state)
          handled = true
        } else if (e.key === (keymap.apply || 'Enter')) {
          /* Enter на Command Field: полоса снимается, пресет — одной правкой (№ 199). */
          if (!__commandFieldWheel.enter(state, cancelSelection)) applySelection(state, state.core)
          handled = true
        } else if (e.key === (keymap.cancel || 'Escape')) {
          cancelSelection(state)
          handled = true
        } else if (e.key === 'Alt') {
          /* Переключает отпускание (`keyUpHandler`); своя обработка гасит и фокус
             Windows на меню окна от одиночного `Alt`. */
          if (!e.repeat) state.altTap = true
          handled = true
        } else if (isTypingKey(e) && insideSessionEditor(state, e.target)) {
          /* Печать закрывает панель как Enter (`В-237`, BUGHUNT F7): выбор
             записывается, клавиша уходит редактору — знак встаёт у каретки. */
          applySelection(state, state.core)
          return
        }
      } catch (err) {
        try {
          cleanupTagWheelState(state)
        } catch (_) {
          /* Уборка тихая: об исходном отказе говорит следующая строка, второй отказ не съедает сообщение. */
        }
        notice(tagWheelNoticeKey('error'), 'TagWheel error: {0}',
          (err && err.message) ? err.message : err)
        reportTagWheelError(err)
        handled = true
      }

      if (handled) {
        state.core.sanitizeState(state.rules, state.session)
        ensureActiveFieldId(state)
        if (state.active) {
          /* Вид панели — не правка человека, и в историю отмен он не идёт. */
          drawPanelLine(state, panelView(state))
        }
        e.preventDefault()
        e.stopPropagation()
      }
    }

    /*
     * Закрыть сессию снаружи (Д-2, 2026-09-08): выгрузка плагина с открытой
     * панелью иначе оставляла перехват `keydown` и вид панели в заметке. Зовёт
     * тот же `cancelSelection`, что `Esc` (У-32); `cleanupTagWheelState` — при
     * любом отказе записи: перехват важнее строки, редактора может не быть.
     */
    state.cancel = function() {
      try { cancelSelection(state) } catch (_) { cleanupTagWheelState(state) }
    }
    /* Щелчок в заметке закрывает панель как Enter (`В-237`, BUGHUNT F7), вне заметки — не трогает. */
    state.mouseHandler = function(e) {
      if (!state.active || !insideSessionEditor(state, e && e.target)) return
      try { applySelection(state, state.core) } catch (err) { state.cancel(); reportTagWheelError(err) }
    }
    /*
     * Сессия привязана к своей заметке (BUGHUNT R7: F5, F6). Уходя с заметки,
     * Obsidian её сохраняет (`loadFile` → `onUnloadFile` → `save`, `TextFileView`
     * в `app.js` 1.13.7). Крючок на виде до сохранения закрывает сессию как `Esc`.
     */
    var sessionView = state.app && state.app.workspace ? state.app.workspace.activeEditor : null
    if (sessionView && sessionView.editor === state.editor && typeof sessionView.onUnloadFile === 'function') {
      var ownUnload = sessionView.onUnloadFile
      state.view = sessionView
      state.unloadHook = function(file) {
        var wasActive = state.active
        var panelText = null
        try { panelText = wasActive ? String(state.editor.getLine(state.lineNumber)) : null } catch (_) { panelText = null /* проба: строки может уже не быть */ }
        if (wasActive) state.cancel()
        var res = ownUnload.call(this, file)
        if (!wasActive || panelText === null || !file) return res
        /* Второй шаг — на диске: `save(true)` молчит при идущем сохранении
           (`if (this.saving) return`, `app.js` 1.13.7). Строка, равная полосе, — к исходной. */
        return Promise.resolve(res).then(function() {
          var vault = state.app && state.app.vault
          if (!vault || typeof vault.process !== 'function') return
          return vault.process(file, function(data) {
            var lines = String(data).split('\n')
            if (lines[state.lineNumber] !== panelText) return data
            lines[state.lineNumber] = state.originalLine
            return lines.join('\n')
          })
        }).catch(reportTagWheelError)
      }
      sessionView.onUnloadFile = state.unloadHook
    }
    /* Отпущенный `Alt` (`З-36`) переключает дочернее поле при одиночном нажатии;
       снимается вместе с `keydown` в `cleanupTagWheelState`. */
    state.keyUpHandler = function(e) {
      if (!e || e.key !== 'Alt' || !state.active) return
      var tap = state.altTap === true
      state.altTap = false
      if (tap && setAltOpen(state, state.session.altOpen !== true)) {
        ensureActiveFieldId(state)
        drawPanelLine(state, panelView(state))
      }
      e.preventDefault()
      e.stopPropagation()
    }
    state.session.altOpen = false
    window.__tagWheelState = state
    ensureActiveFieldId(state)
    window.addEventListener('keydown', state.keyHandler, true)
    window.addEventListener('keyup', state.keyUpHandler, true)
    window.addEventListener('mousedown', state.mouseHandler, true)

    drawPanelLine(state, panelView(state))
  }

  var preApp = resolveTagWheelApp(input)
  /* Имена ключей — у модуля из бандла: синхронно, отказать нечем. */
  applyPkmOptionKeys(__pkmOptionKeysMod)

  var runtimeInput = buildTagWheelRuntimeInput(input, quickAddSettings)
  var scrollerCfg = normalizeScrollerConfig(runtimeInput)
  var valueNamesCfg = normalizeValueNamesConfig(runtimeInput)

  var app_ = resolveTagWheelApp(runtimeInput) || preApp
  if (!app_) {
    notice(tagWheelNoticeKey('no-app'), 'TagWheel: no app context')
    return
  }

  var editor = getTagWheelEditor(app_)
  if (!editor) {
    notice(tagWheelNoticeKey('no-editor'), 'TagWheel: open a note first')
    return
  }

  if (!window.__tagWheelState) {
    window.__tagWheelState = { active: false }
  }

  var activeState = window.__tagWheelState
  if (activeState.active) {
    macroShared = globalThis.__inlinePkmMacroShared
    rulesHelpers = globalThis.__inlinePkmRulesHelpers
    linePipeline = globalThis.__inlineLinePipeline
    statusLineRuntime = globalThis.__inlineStatusLineRuntimeUnified
    var activeHelpersReady = !!(macroShared
      && typeof macroShared.isNoContentParsed === 'function'
      && typeof macroShared.buildBulletOnlyLine === 'function'
      && typeof macroShared.applyKeepBullet === 'function'
      && typeof macroShared.normalizeCycleEndBehavior === 'function'
      && typeof macroShared.normalizeCursorPolicy === 'function'
      && typeof macroShared.ensureTrailingSeparatorSpace === 'function'
      && typeof macroShared.getCursorAtTextEnd === 'function'
      && typeof macroShared.isBulletLikeEmptyResult === 'function'
      && typeof macroShared.remapCursorByLineDiff === 'function'
      && rulesHelpers
      && typeof rulesHelpers.resolvePanelForField === 'function'
      && typeof rulesHelpers.resolveFieldFreeRoamMode === 'function'
      && typeof rulesHelpers.resolveFreeRoamBehavior === 'function'
      && typeof rulesHelpers.parseOrderConfig === 'function'
      && typeof rulesHelpers.applyOrderToRules === 'function'
      && linePipeline
      && typeof linePipeline.splitSegments === 'function'
      && typeof linePipeline.buildFromSegments === 'function'
      && typeof linePipeline.splitLeftPrefix === 'function'
      && typeof linePipeline.joinLeftPrefix === 'function'
      && typeof linePipeline.relocateTokenSetByPanel === 'function'
      && statusLineRuntime
      && typeof statusLineRuntime.relocateCoreTagsByOrder === 'function'
      && typeof statusLineRuntime.enforceDependentAdjacencyForStatusLine === 'function')
    if (!activeHelpersReady) {
      activeState.active = false
    } else {
  /* Второе нажатие применяет выбор только своей командой (10.13.260, п. 12); чужие
     команды при панели блока и наоборот отказывают вслух. */
      var wantBlock = String(runtimeInput.customBlock || '')
      var haveBlock = activeState.custom ? String(activeState.custom.blockId) : ''
      if (runtimeInput.customCycle || wantBlock !== haveBlock) {
        notice(__sayModule.noticeKey('pkm', 'tagwheel-open'),
          'tagWheel is open on this line: finish it with Enter or close it with Escape first')
        return
      }
      applySelection(activeState, activeState.core)
      return
    }
  }

  try {
    await callRuntimeApi(app_, 'loadRulesRuntimeHelpers')
    rulesHelpers = globalThis.__inlinePkmRulesHelpers
    if (!rulesHelpers || typeof rulesHelpers.resolvePanelForField !== 'function') throw new Error('pkm_rules_runtime_helpers unavailable: resolvePanelForField')
    if (typeof rulesHelpers.resolveFieldFreeRoamMode !== 'function') throw new Error('pkm_rules_runtime_helpers unavailable: resolveFieldFreeRoamMode')
    if (typeof rulesHelpers.resolveFreeRoamBehavior !== 'function') throw new Error('pkm_rules_runtime_helpers unavailable: resolveFreeRoamBehavior')
    if (typeof rulesHelpers.parseOrderConfig !== 'function') throw new Error('pkm_rules_runtime_helpers unavailable: parseOrderConfig')
    if (typeof rulesHelpers.applyOrderToRules !== 'function') throw new Error('pkm_rules_runtime_helpers unavailable: applyOrderToRules')
    await callRuntimeApi(app_, 'loadMacroShared')
    macroShared = globalThis.__inlinePkmMacroShared
    if (!macroShared || typeof macroShared.isNoContentParsed !== 'function') throw new Error('pkm_macro_shared unavailable: isNoContentParsed')
    if (typeof macroShared.buildBulletOnlyLine !== 'function') throw new Error('pkm_macro_shared unavailable: buildBulletOnlyLine')
    if (typeof macroShared.applyKeepBullet !== 'function') throw new Error('pkm_macro_shared unavailable: applyKeepBullet')
    if (typeof macroShared.normalizeCycleEndBehavior !== 'function') throw new Error('pkm_macro_shared unavailable: normalizeCycleEndBehavior')
    if (typeof macroShared.normalizeCursorPolicy !== 'function') throw new Error('pkm_macro_shared unavailable: normalizeCursorPolicy')
    if (typeof macroShared.ensureTrailingSeparatorSpace !== 'function') throw new Error('pkm_macro_shared unavailable: ensureTrailingSeparatorSpace')
    if (typeof macroShared.getCursorAtTextEnd !== 'function') throw new Error('pkm_macro_shared unavailable: getCursorAtTextEnd')
    if (typeof macroShared.isBulletLikeEmptyResult !== 'function') throw new Error('pkm_macro_shared unavailable: isBulletLikeEmptyResult')
    if (typeof macroShared.remapCursorByLineDiff !== 'function') throw new Error('pkm_macro_shared unavailable: remapCursorByLineDiff')
    await callRuntimeApi(app_, 'loadLinePipeline')
    linePipeline = await loadLinePipelineFresh(app_)
    if (!linePipeline || typeof linePipeline.splitSegments !== 'function') throw new Error('line_pipeline unavailable: splitSegments')
    if (typeof linePipeline.buildFromSegments !== 'function') throw new Error('line_pipeline unavailable: buildFromSegments')
    if (typeof linePipeline.splitLeftPrefix !== 'function') throw new Error('line_pipeline unavailable: splitLeftPrefix')
    if (typeof linePipeline.joinLeftPrefix !== 'function') throw new Error('line_pipeline unavailable: joinLeftPrefix')
    if (typeof linePipeline.relocateTokenSetByPanel !== 'function') throw new Error('line_pipeline unavailable: relocateTokenSetByPanel')
    if (typeof linePipeline.relocateMarkerSetByFieldOrder !== 'function') throw new Error('line_pipeline unavailable: relocateMarkerSetByFieldOrder')
    if (typeof linePipeline.extractOriginalTextFromRawLine !== 'function') throw new Error('line_pipeline unavailable: extractOriginalTextFromRawLine')
    if (typeof linePipeline.enforceTextSegmentForLeftTag !== 'function') throw new Error('line_pipeline unavailable: enforceTextSegmentForLeftTag')
    var lineFinalize = await loadLineFinalizeUnified(app_)
    statusLineRuntime = await loadStatusLineRuntimeUnified(app_)
    var core = __tagwheelCoreMod
    /*
     * Правила из настроек (10.13.52, П-8): ключ кладёт `buildRulesForEngines(cfg)`
     * в `command_registry.js`. Ключа нет (позвали не нашей командой) — отказ
     * громкий (Д-4).
     */
    var rules = __pkmOptionKeysMod.rulesFromSettings(runtimeInput, 'rulesData')
    if (!rules) {
      notice(tagWheelNoticeKey('rules-missing'),
        'TagWheel: no rules came with the command - open it from the command list or its hotkey')
      return
    }
    var dateRuntimeShared = await loadDateRuntimeShared()
    var dateRuntimeCfg = dateRuntimeShared.parseDateRuntimeConfigJson(runtimeInput.dateRuntimeConfig)
    if (!rules.behavior || typeof rules.behavior !== 'object') rules.behavior = {}
    rules.behavior.dateRuntimeConfig = dateRuntimeCfg
    /* Нормализатор ключа Order — у дома напрямую (10.13.168). */
    var normalizeOrderKey = __sharedUtils.normalizeOrderKey
    var facade = await callRuntimeApi(app_, 'loadRuntimePreloadFacade')
    var parseOrderConfigFn = function(raw, normalizeKey) {
      if (!rulesHelpers || typeof rulesHelpers.parseOrderConfig !== 'function') {
        throw new Error('pkm_rules_runtime_helpers unavailable: parseOrderConfig')
      }
      return rulesHelpers.parseOrderConfig(raw, normalizeKey)
    }
    var rawOrder = runtimeInput ? runtimeInput.orderConfig : undefined
    if (!rawOrder && rules && rules.behavior && rules.behavior.order) {
      /* Без охраны (В-97): `behavior` — из `JSON.parse`, круга и `BigInt` нет;
         пустой `catch` тихо не применил бы порядок Fields. */
      rawOrder = JSON.stringify(rules.behavior.order)
    }
    var orderCfg
    if (facade && typeof facade.resolveOrderConfig === 'function') {
      var settingsLike = {}
      settingsLike[ORDER_CONFIG_OPTION] = rawOrder
      orderCfg = await facade.resolveOrderConfig(app_, settingsLike, {
        orderConfigKey: ORDER_CONFIG_OPTION,
        parseOrderConfig: parseOrderConfigFn,
        normalizeKey: normalizeOrderKey
      })
    } else {
      orderCfg = parseOrderConfigFn(rawOrder, normalizeOrderKey)
    }
    rulesHelpers.applyOrderToRules(rules, orderCfg)
    var missingEmojiFields = dateRuntimeShared.collectMissingEmojiFieldsFromRules(rules, dateRuntimeCfg)
    if (missingEmojiFields.length) {
      notice(tagWheelNoticeKey('emoji-required'),
        'TagWheel: these Fields need an emoji: {0}. Set it in Settings -> inlineOverhaul -> Tags & PKM -> Fields',
        missingEmojiFields.join(', '))
      return
    }
    var sf = String(runtimeInput && runtimeInput.subtagFormat ? runtimeInput.subtagFormat : '').toLowerCase().trim()
    if (sf === 'separate' || sf === 'combined') {
      if (!rules.behavior || typeof rules.behavior !== 'object') rules.behavior = {}
      rules.behavior.subtagFormat = sf
    }
    core.validateRules(rules)

    var customBlockId = String(runtimeInput.customBlock || '').trim()
    if (customBlockId) {
      await openCustomBlock({
        core: core, editor: editor, rules: rules, orderCfg: orderCfg, app: app_,
        runtimeInput: runtimeInput, lineFinalize: lineFinalize, scrollerCfg: scrollerCfg,
        valueNamesCfg: valueNamesCfg, dateRuntimeCfg: dateRuntimeCfg, sf: sf,
        parseOrderConfigFn: parseOrderConfigFn, normalizeOrderKey: normalizeOrderKey,
      })
      return
    }

    var kept = selectionToKeep(editor, runtimeInput.selectionLine)
    var cursor = kept ? { line: kept.line, ch: 0 } : editor.getCursor()
    var lineNumber = cursor.line
    var originalLine = String(editor.getLine(lineNumber) || '')
    var parsedLine = core.parseLine(originalLine, rules)
    /* С выделением каретка — в конце текста строки панели, как без выделения (цикл 121). */
    if (kept) cursor = { line: lineNumber, ch: macroShared.getCursorAtTextEnd(originalLine, rules) }

    var modeName = resolveStartMode(runtimeInput, rules)
    var targetPanel = rulesHelpers.resolvePanelForField(orderCfg, runtimeInput.targetFieldKey, { defaultPanel: modeName })
    /* После разбора строки: Values Command Field в строке не ищутся (№ 199). */
    __commandFieldWheel.inject(rules, runtimeInput.commandFields)
    var session = core.makeInitialState(rules, modeName)
    var now = new Date()
    var hh = String(now.getHours())
    var mm = String(now.getMinutes())
    if (hh.length < 2) hh = '0' + hh
    if (mm.length < 2) mm = '0' + mm
    session.__nowHHmm = hh + ':' + mm
    var y = now.getFullYear()
    var m = String(now.getMonth() + 1)
    var d = String(now.getDate())
    if (m.length < 2) m = '0' + m
    if (d.length < 2) d = '0' + d
    session.__todayIso = y + '-' + m + '-' + d
    core.hydrateStateFromParsedLine(rules, session, parsedLine)
    /* Каретка в результате категории — её пресет выбран сразу (№ 199). */
    __commandFieldWheel.hydrate(session, runtimeInput.commandFields, editor)
    core.sanitizeState(rules, session)
    /* «На каком Field открывать» кладётся в правила, как порядок: движок читает правила (10.13.76). */
    core.applyActiveFieldChoiceToRules(rules, {
      mode: runtimeInput.activeFieldMode,
      left: runtimeInput.activeFieldLeft,
      right: runtimeInput.activeFieldRight
    })
    /*
     * Ведущее поле и его имя выбирает `resolveInitialActiveField`: у элемента
     * места в списке по типу нет, индексом не найти (S5, У-150). Согласование
     * с номером и видом — `ensureActiveFieldId` ниже.
     */
    /* Пустой Block открывается соседним (В-130) — до выбора ведущего поля, иначе
       оно выбиралось бы на стороне, которую панель не покажет. */
    var openingMode = resolvePanelOpeningMode(core, rules, session)
    if (openingMode !== session.mode) {
      session.mode = openingMode
      session.activeFieldId = ''
    }
    session.activeField = core.resolveInitialActiveField(rules, session, session.mode)

    var state = {
      active: true,
      core: core,
      editor: editor,
      rules: rules,
      lineNumber: lineNumber,
      originalLine: originalLine,
      parsedLine: parsedLine,
      session: session,
      cycleEndBehavior: runtimeInput.cycleEndBehavior,
      cursorPolicy: runtimeInput.cursorPolicy,
      orderCfg: orderCfg,
      app: app_,
      lineFinalize: lineFinalize,
      targetPanel: targetPanel,
      originalCursorCh: cursor.ch,
      keyHandler: null,
      scrollerCfg: scrollerCfg,
      valueNamesCfg: valueNamesCfg,
      edgeMode: normalizeEdgeMode(runtimeInput.edgeMode),
      scrollerOverlay: null,
      keptSelection: kept,
      commandFields: runtimeInput.commandFields
    }

    /* До панели: отрезок считан по строке человека и едет через вставки панели. */
    if (kept) __panelMaskMod.applyKeptSelection(editor.cm, { from: kept.from, to: kept.to })
    await mountSession(state)
    /* Успешное открытие молчит (И-1, исключение № 5 из З3); уведомления — где без
       них непонятно, почему ничего не произошло. */
  } catch (e) {
    notice(tagWheelNoticeKey('error'), 'TagWheel error: {0}', e.message || e)
    reportTagWheelError(e)
  }
}

module.exports = runTagWheel
module.exports.settings = {
  name: 'TagWheel',
  author: 'you',
  options: {}
}
module.exports.settings.options[START_SETTING_OPTION] = {
  type: 'dropdown',
  defaultValue: 'left',
  options: ['left', 'right'],
  description: 'Стартовая панель для этого хоткея.'
}
module.exports.settings.options[START_MODE_OPTION] = {
  type: 'dropdown',
  defaultValue: '',
  options: ['', 'left', 'right'],
  description: 'Опциональный override mode (обычно оставлять пустым).'
}
module.exports.settings.options[SUBTAG_FORMAT_OPTION] = {
  type: 'dropdown',
  defaultValue: '',
  options: ['', 'separate', 'combined'],
  description: 'Опциональный override формата субтегов. Пусто = по rules.behavior.subtagFormat.'
}
module.exports.settings.options[CYCLE_END_BEHAVIOR_OPTION] = {
  type: 'dropdown',
  defaultValue: 'keep-bullet',
  options: ['keep-bullet', 'clear-prefix'],
  description: 'Поведение при выходе из цикла на empty-like строке: оставить bullet (- ) или очистить строку.'
}
module.exports.settings.options[CURSOR_POLICY_OPTION] = {
  type: 'dropdown',
  defaultValue: 'text_end',
  options: ['text_end', 'current_position', 'line_end'],
  description: 'Cursor behavior after apply.'
}
module.exports.settings.options[ORDER_CONFIG_OPTION] = {
  type: 'text',
  defaultValue: '',
  description: 'Optional JSON order config from plugin.'
}
module.exports.entry = async function(QuickAdd, settings) {
  return await runTagWheel(QuickAdd, settings)
}
/* Решение шага стрелки — чистая функция, проверяется без Obsidian (10.13.35); запись — `nextVirtualField`. */
module.exports.planFieldStep = planFieldStep
module.exports.setAltOpen = setAltOpen
module.exports.normalizeEdgeMode = normalizeEdgeMode
/* Запись мимо истории — проверяется без Obsidian (10.13.53). */
module.exports.setLineOutsideHistory = setLineOutsideHistory
module.exports.lineDiffChange = lineDiffChange
/* Custom block: слово под кареткой и форма вставки — чистые функции (10.13.260). */
module.exports.customWordSpan = customWordSpan
module.exports.customInsertPlan = customInsertPlan
module.exports.keptLinePrefix = keptLinePrefix
module.exports.withKeptPrefix = withKeptPrefix
/* Место каретки при открытой панели — чистая функция над планом записи (правило 122). */
module.exports.cursorOutsidePanelStrip = cursorOutsidePanelStrip
/* Второе объявление «значение в строке» (у ядра — `buildOutputToken`): наружу для
   `tools/form_divergence.js`. Поведения не меняет. */
module.exports.buildOutputTokenForFieldValue = buildOutputTokenForFieldValue
module.exports.resolveFieldOutputMode = resolveFieldOutputMode
