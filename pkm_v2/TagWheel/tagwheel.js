var START_SETTING_OPTION = 'Start setting'
var START_MODE_OPTION = 'Start mode override'
var SUBTAG_FORMAT_OPTION = 'Subtag format'
var CYCLE_END_BEHAVIOR_OPTION = 'Cycle end behavior'
var CURSOR_POLICY_OPTION = 'Cursor policy'
var ORDER_CONFIG_OPTION = 'Order config'
var RULES_PATH_OPTION = 'Rules path'
var DATE_RUNTIME_CONFIG_OPTION = 'Date runtime config'
var TAGWHEEL_SCROLLER_ENABLED_OPTION = 'TagWheel scroller enabled'
var TAGWHEEL_SCROLLER_DIRECTION_OPTION = 'TagWheel scroller direction'
var TAGWHEEL_SCROLLER_SIZE_OPTION = 'TagWheel scroller size'
/* Цвета коробки скроллера: десятое исключение к З3, разрешение заказчика
   2026-09-02 по замечанию D6 (PRD 10.13.15). Пусто — цвета темы. */
var TAGWHEEL_SCROLLER_FILL_OPTION = 'TagWheel scroller fill color'
var TAGWHEEL_SCROLLER_TEXT_OPTION = 'TagWheel scroller text color'
/* Что делает стрелка на краю панели: двадцать первое исключение к З3,
   разрешение заказчика 2026-09-05 (PRD 10.13.35). */
var TAGWHEEL_EDGE_MODE_OPTION = 'TagWheel edge mode'
var DEFAULT_RULES_PATH = 'InlineOverhaul_Generated_RULES_TagWheel.md'
/*
 * Свои модули — литеральным `require`, по одному на модуль (У-89).
 *
 * Было: пять путей внутри vault и шесть асинхронных загрузок, каждая со
 * своей проверкой годности и своим кешем. Три из них просили модуль с
 * `forceReload = true` — то есть заново на каждый вызов, — и в сборке это
 * ничего не значило: реестр забандленных модулей отдаёт один и тот же
 * объект независимо от флага.
 */
var __lineFinalizeUnifiedMod = require('../../src/core/pkm_line_finalize_unified.js')
var __statusLineRuntimeUnifiedMod = require('../../src/core/status_line_runtime_unified.js')
var __dateRuntimeSharedMod = require('../../src/core/date_runtime_shared.js')
var __linePipelineMod = require('../../src/core/line_pipeline.js')
var __tagwheelScrollerOverlayMod = require('../../src/ui/tagwheel_scroller_overlay.js')
var __tagwheelCoreMod = require('./tagwheel_core.js')
var __pkmOptionKeysMod = require('../../src/core/pkm_option_keys.js')
var __pkmDomainRegistryMod = require('../../src/core/pkm_domain_registry.js')
/* Пакет даёт сам Obsidian: в сборке он объявлен внешним и в бандл не идёт. */
var __cmState = require('@codemirror/state')

/**
 * Что именно переписать, чтобы строка стала другой: **только различие**.
 *
 * Пометка «мимо истории» говорит истории не заводить ступень — и ничего не
 * говорит про **чужие** ступени. Изменение всё равно случилось, и все прежние
 * ступени CodeMirror переносит через него (`addMapping` в `app.js` 1.13.7):
 * то, что мы удалили, из чужой ступени пропадает, а ступень, у которой после
 * переноса не осталось изменений, **выбрасывается совсем**.
 *
 * Перезапись строки целиком удаляла всё, что человек на ней набрал. Его
 * `Ctrl+Z` после панели упирался в это: «вторая строка пропала, а первая
 * стала `- 1- 2`» — набранное на строке из истории выпало, а от Enter в ней
 * остался один перевод строки (замечание по W3, дефект A41).
 *
 * Поэтому пишется различие: общее начало и общий конец строки не трогаются
 * вовсе, и набранное человеком остаётся тем же символом, что и было. Границу
 * различия отодвигает `alignSurrogate`: разрезать пару UTF-16 нельзя — в
 * строках живут эмодзи (`📅`), и половина пары испортила бы текст.
 *
 * Одного различия оказалось мало, и это выяснила вторая проверка заказчика:
 * общего начала у строки и вида панели не было **ни одного символа**, потому
 * что знака списка `renderControlLine` не рисует. Начало строки бережёт
 * `withKeptPrefix` ниже (A43); вместе с ним история после панели совпадает с
 * историей без панели посимвольно — и при быстром наборе тоже.
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
   * Пара UTF-16 неделима: если граница встала между её половинами, отрезок
   * расширяется так, чтобы пара целиком оказалась внутри него. Условие с двух
   * сторон одно и то же — «на границе стоит вторая половина пары», — и обе
   * стороны проверены мутацией: у эмодзи `📅` и `📆` совпадает первая половина,
   * у `📅` и `🣅` — вторая.
   */
  if (head > 0 && head < a.length && isLowSurrogate(a.charCodeAt(head))) head--
  if (tail > 0 && tail < a.length && isLowSurrogate(a.charCodeAt(a.length - tail))) tail--
  return {
    from: from + head,
    to: from + a.length - tail,
    insert: b.slice(head, b.length - tail)
  }
}

function isHighSurrogate(code) {
  return code >= 0xd800 && code <= 0xdbff
}

/**
 * Начало строки, которое панель переписывать не имеет права: отступ, знак
 * списка или заголовка и чекбокс — ровно в том написании, в каком их набрал
 * человек.
 *
 * **Зачем это здесь.** `lineDiffChange` бережёт общий край строки, и этого
 * оказалось мало: `renderControlLine` знака списка не рисует вовсе, поэтому
 * общего начала у строки и вида панели не было ни одного символа. Панель
 * снимала `- `, а вместе с ним из чужой ступени отмены пропадал перенос
 * строки, которым человек эту строку и завёл. Его вторая проверка (W4,
 * дефект A43): «строка 1 `- 3`, строка 2 `- 4`… ctrl-z second `- 3- 4`».
 * Ступень Enter теряла две трети себя, а при быстром наборе — вместе с
 * напечатанной цифрой, потому что Enter и цифра склеиваются CodeMirror в одну
 * ступень.
 *
 * **Почему знак берётся из строки, а не из разбора.** `parseLine` досыпает
 * `bulletToken: '-'` и строке, у которой знака списка не было вовсе
 * (`plain text`), — по разбору знак не отличить от придуманного, и панель
 * приписала бы человеку маркер, которого он не ставил.
 *
 * Чекбокс — ровно один знак в скобках: это правило платформы, а не наше
 * (У-91).
 */
function keptLinePrefix(line) {
  var m = /^(\s*(?:[-*+]|\d+[.)]|#{1,6})[ \t]+(?:\[.\][ \t]+)?)/.exec(String(line == null ? '' : line))
  return m ? m[1] : ''
}

/**
 * Вид панели с сохранённым началом строки.
 *
 * `renderControlLine` начинает с отступа (`parsedLine.indent`), поэтому знак
 * списка встаёт **после** отступа, а не перед ним: иначе отступ удвоился бы.
 */
function withKeptPrefix(originalLine, control) {
  var kept = keptLinePrefix(originalLine)
  var text = String(control == null ? '' : control)
  if (!kept || text.indexOf(kept) === 0) return text
  var indent = /^[ \t]*/.exec(text)[0]
  return kept + text.slice(indent.length)
}

function isLowSurrogate(code) {
  return code >= 0xdc00 && code <= 0xdfff
}

/**
 * Написать строку **мимо истории отмен**.
 *
 * Пока панель открыта, TagWheel переписывает строку в заметке на каждое
 * нажатие — иначе человек не увидит, что он выбирает. Каждая такая запись была
 * своей ступенью отмены, и после применения `Ctrl+Z` возвращал не строку, а
 * панель: столько раз, сколько было нажатий. Слова заказчика 2026-09-07: «мне
 * приходится нажимать ctrl+z столько раз, сколько действий я совершил в
 * tagwheel... я хочу, чтобы ctrl+z сразу возвращал исходное состояние строки».
 *
 * Рядом стоял комментарий «схлопнуть историю отмен» и две записи подряд — они
 * историю не схлопывали, а добавляли к ней ещё две (У-64: утверждение о
 * состоянии, переставшее быть верным).
 *
 * **Как это делается на самом деле.** История у CodeMirror отказывается брать
 * изменение, помеченное `addToHistory = false`: в коде Obsidian 1.13.7 это
 * `!1 === t.annotation(addToHistory)` — ветка, которая возвращает историю
 * нетронутой. Пометка ставится только на своей транзакции, а её надо послать
 * самому: `editor.transaction(tx, origin)` для этого не годится — `origin` там
 * становится `userEvent`, а не пометкой истории (проверено по `app.js`, У-44).
 * Отсюда `editor.cm` — сам `EditorView`, тот же, которым Obsidian пользуется
 * внутри `transaction`.
 *
 * **Запасной путь — обычный `setLine`.** Это не заглушка на месте модуля
 * (У-90): `cm` — не наш модуль, а поле чужого редактора, и вне Obsidian его
 * нет вовсе. Без него всё работает как раньше, только ступеней отмены снова
 * много.
 */
function setLineOutsideHistory(editor, lineNumber, text) {
  var view = editor ? editor.cm : null
  var Transaction = __cmState ? __cmState.Transaction : null
  if (view && view.state && typeof view.dispatch === 'function'
    && Transaction && Transaction.addToHistory && typeof Transaction.addToHistory.of === 'function') {
    try {
      var docLine = view.state.doc.line(Number(lineNumber) + 1)
      var next = String(text == null ? '' : text)
      /*
       * Различие считается от того, что на строке **сейчас**. Не удалось
       * прочитать — пишем строку целиком, как писали до 2026-09-07: пустая
       * «прежняя строка» дала бы вставку без удаления, то есть панель поверх
       * текста человека.
       */
      var current = typeof docLine.text === 'string'
        ? docLine.text
        : (view.state.doc && typeof view.state.doc.sliceString === 'function'
          ? String(view.state.doc.sliceString(docLine.from, docLine.to))
          : null)
      var change = current === null
        ? { from: docLine.from, to: docLine.to, insert: next }
        : lineDiffChange(docLine.from, current, next)
      /* Строка уже такая: пустое изменение историю не переносит вовсе. */
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
 * Уведомление TagWheel. С 2026-09-06 оно спрашивает текст у каталога
 * (PRD 10.13.50, третий кусок; ответ заказчика на В-74).
 *
 * Форма вызова: `notice(key, english, ...args)`. Английское остаётся здесь же,
 * вторым аргументом: слой настроек может не загрузиться вовсе, и тогда человек
 * обязан увидеть сообщение, а не ключ. Шов — `globalThis.__inlineSay`, тот же
 * способ доставки, каким этот файл получает всё остальное.
 *
 * Ключ собирает `tagWheelNoticeKey`, а не литерал на месте вызова (У-82).
 */
function tagWheelNoticeKey(name) {
  return 'notice.tagwheel.' + name
}

function makeTagWheelNotice(NoticeRef) {
  return function notice(key, english, ...args) {
    var text = String(english == null ? '' : english)
    var ask = globalThis.__inlineSay
    if (typeof ask === 'function') {
      try {
        var said = ask(String(key), text)
        if (typeof said === 'string' && said !== '') text = said
      } catch (_) {}
    }
    /* Подстановка по номеру, а не склейка через `+`: по-русски то, что
       по-английски стоит в конце фразы, встаёт в начало. */
    for (var i = 0; i < args.length; i++) {
      text = text.split('{' + i + '}').join(String(args[i] == null ? '' : args[i]))
    }
    if (typeof NoticeRef === 'function') new NoticeRef(text)
    else console.log('[tagwheel] ' + text)
  }
}

function reportTagWheelError(err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return
    console.error(err)
  } catch (_) {}
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
  } catch (_) {}
  return null
}

function emitTagWheelDevEvent(app_, eventName, payload) {
  try {
    var plugin = resolveTagWheelDevLogger(app_)
    if (!plugin || typeof plugin.devLogEvent !== 'function') return
    var cfg = typeof plugin.getConfig === 'function' ? plugin.getConfig() : null
    plugin.devLogEvent(String(eventName || ''), payload || {}, 'info', cfg)
  } catch (_) {}
}

function resolveTagWheelApp(x) {
  if (x && x.vault && x.workspace) return x
  if (x && x.app && x.app.vault && x.app.workspace) return x.app
  if (globalThis.app && globalThis.app.vault && globalThis.app.workspace) return globalThis.app
  return null
}

function getTagWheelEditor(app_) {
  var leaf = app_ && app_.workspace ? app_.workspace.activeLeaf : null
  var view = leaf && leaf.view ? leaf.view : null

  if (view && view.editor) return view.editor
  if (view && view.currentMode && view.currentMode.editor) return view.currentMode.editor

  if (app_ && app_.workspace && app_.workspace.activeEditor && app_.workspace.activeEditor.editor) {
    return app_.workspace.activeEditor.editor
  }

  try {
    var mdPlugin = app_ && app_.plugins && app_.plugins.plugins ? app_.plugins.plugins.markdown : null
    var MdCtor = mdPlugin && mdPlugin.constructor ? mdPlugin.constructor : null
    if (MdCtor && app_.workspace && typeof app_.workspace.getActiveViewOfType === 'function') {
      var mdView = app_.workspace.getActiveViewOfType(MdCtor)
      if (mdView && mdView.editor) return mdView.editor
      if (mdView && mdView.currentMode && mdView.currentMode.editor) return mdView.currentMode.editor
    }
  } catch (_) {}

  return null
}

function cleanupTagWheelState(state) {
  if (!state) return
  if (state.keyHandler) window.removeEventListener('keydown', state.keyHandler, true)
  try {
    if (state.scrollerOverlay && typeof state.scrollerOverlay.destroy === 'function') {
      state.scrollerOverlay.destroy()
    }
  } catch (_) {}
  state.active = false
}

function normalizeOrderKeyLocal(key) {
  return String(key || '').trim()
}

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

function composeToken(prefix, rawToken) {
  var p = (typeof prefix === 'string') ? prefix : '#'
  var t = String(rawToken || '')
  if (!t) return ''
  if (!p && /^\//.test(t)) return '#' + t
  return p + t
}

function normalizeWikilinkTarget(raw) {
  var src = String(raw || '').trim()
  if (!src) return ''
  var m = src.match(/^\[\[([^\]]+)\]\]$/)
  return m ? String(m[1] || '').trim() : src
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
  if (!out.rulesPath && typeof qa[RULES_PATH_OPTION] === 'string') {
    out.rulesPath = qa[RULES_PATH_OPTION]
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
  if (out.scrollerFillColor == null && typeof qa[TAGWHEEL_SCROLLER_FILL_OPTION] === 'string') {
    out.scrollerFillColor = qa[TAGWHEEL_SCROLLER_FILL_OPTION]
  }
  if (out.scrollerTextColor == null && typeof qa[TAGWHEEL_SCROLLER_TEXT_OPTION] === 'string') {
    out.scrollerTextColor = qa[TAGWHEEL_SCROLLER_TEXT_OPTION]
  }
  if (!out.edgeMode && typeof qa[TAGWHEEL_EDGE_MODE_OPTION] === 'string') {
    out.edgeMode = qa[TAGWHEEL_EDGE_MODE_OPTION]
  }
  return out
}

/**
 * Что делает стрелка, когда следующего Field в этом Block нет (10.13.35).
 *
 * `stay` — прежнее поведение: кольцо замкнуто внутри своей стороны.
 * `next-block` — кольцо через обе стороны. Умолчание прежнее: менять
 * поведение всем, кто обновится, без спроса нельзя.
 */
function normalizeEdgeMode(value) {
  return String(value || '').trim().toLowerCase() === 'next-block' ? 'next-block' : 'stay'
}

/**
 * Куда встанет активный Field на следующем шаге стрелки (10.13.35).
 *
 * Чистая функция: на входе два списка Field и то, где мы стоим, на выходе
 * сторона и Field. Так решение проверяется без Obsidian и без открытой
 * панели, а запись остаётся отдельно (тот же порядок, что у `Smart Delete`).
 *
 * Заказчик описал все четыре границы, и они складываются в **одно кольцо**
 * «левая сторона, затем правая»: с последнего левого вправо — первый правый,
 * с первого левого влево — последний правый, и зеркально. Поэтому здесь нет
 * четырёх случаев, а есть один переход.
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
    /* Соседняя сторона пуста — уходить некуда, и кольцо замыкается на своей.
       Молча ничего не делать здесь было бы тем самым тихим отказом (У-41). */
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

function normalizeScrollerConfig(input) {
  var raw = input && typeof input === 'object' ? input : {}
  var directionRaw = String(raw.scrollerDirection || '').trim().toLowerCase()
  var direction = (directionRaw === 'up' || directionRaw === 'down' || directionRaw === 'full') ? directionRaw : 'full'
  var sizeNum = Math.trunc(Number(raw.scrollerSize))
  var size = isFinite(sizeNum) ? Math.max(1, Math.min(20, sizeNum)) : 3
  /*
   * Цвета коробки. Пустая строка — «взять у темы», и это не «прозрачный»:
   * второго смысла у пустоты в панели быть не должно (PRD 10.13.15 Н2).
   * Проверка формы здесь же: в коробку не должно уехать ничего, кроме
   * `#rrggbb`, — иначе браузер молча оставит прежний цвет.
   */
  var hex = function(value) {
    var v = String(value == null ? '' : value).trim().toLowerCase()
    return /^#[0-9a-f]{6}$/.test(v) ? v : ''
  }
  return {
    enabled: raw.scrollerEnabled === true,
    direction: direction,
    size: size,
    fillColor: hex(raw.scrollerFillColor),
    textColor: hex(raw.scrollerTextColor),
  }
}

async function loadDateRuntimeShared() {
  return __dateRuntimeSharedMod
}

async function loadTagWheelScrollerOverlay() {
  return __tagwheelScrollerOverlayMod
}

function resolveFieldOutputMode(field, rules) {
  if (field && typeof field.outputMode === 'string') {
    var local = String(field.outputMode).trim().toLowerCase()
    if (local) return local
  }
  var source = String(field && field.source ? field.source : '').trim()
  var sourceKind = resolveFieldSourceKind(field)
  if (sourceKind === 'projects' || sourceKind === 'wikilinks') return 'wikilink'
  if (source && rules && rules[source] && typeof rules[source].output === 'string') {
    return String(rules[source].output).trim().toLowerCase() || 'tag'
  }
  return 'tag'
}

function buildOutputTokenForFieldValue(field, value, rules) {
  if (!field || !value) return ''
  var outputMode = resolveFieldOutputMode(field, rules)
  var tokenRaw = String(value.token || '').trim()
  if (/^\[\[[^\]]+\]\]$/.test(tokenRaw)) return tokenRaw
  if (/^#\S+/.test(tokenRaw)) return tokenRaw
  if (outputMode === 'wikilink') {
    var target = normalizeWikilinkTarget(value.link || value.token || value.id || '')
    if (!target) return ''
    return '[[' + target + ']]'
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
    RULES_PATH_OPTION = String(keys.RULES_PATH || RULES_PATH_OPTION)
    DATE_RUNTIME_CONFIG_OPTION = String(keys.DATE_RUNTIME_CONFIG || DATE_RUNTIME_CONFIG_OPTION)
    TAGWHEEL_SCROLLER_ENABLED_OPTION = String(keys.TAGWHEEL_SCROLLER_ENABLED || TAGWHEEL_SCROLLER_ENABLED_OPTION)
    TAGWHEEL_SCROLLER_DIRECTION_OPTION = String(keys.TAGWHEEL_SCROLLER_DIRECTION || TAGWHEEL_SCROLLER_DIRECTION_OPTION)
    TAGWHEEL_SCROLLER_SIZE_OPTION = String(keys.TAGWHEEL_SCROLLER_SIZE || TAGWHEEL_SCROLLER_SIZE_OPTION)
    TAGWHEEL_SCROLLER_FILL_OPTION = String(keys.TAGWHEEL_SCROLLER_FILL || TAGWHEEL_SCROLLER_FILL_OPTION)
    TAGWHEEL_SCROLLER_TEXT_OPTION = String(keys.TAGWHEEL_SCROLLER_TEXT || TAGWHEEL_SCROLLER_TEXT_OPTION)
    TAGWHEEL_EDGE_MODE_OPTION = String(keys.TAGWHEEL_EDGE_MODE || TAGWHEEL_EDGE_MODE_OPTION)
    DEFAULT_RULES_PATH = String(mod.DEFAULT_RULES_PATH || DEFAULT_RULES_PATH)
  }

  function getDomainRegistry() {
    return domainRegistry
  }

  function resolveOrderKeyFromFieldId(fieldId) {
    var reg = getDomainRegistry()
    if (reg && typeof reg.resolveOrderKeyFromFieldId === 'function') {
      return String(reg.resolveOrderKeyFromFieldId(fieldId) || '').trim()
    }
    return String(fieldId || '').trim()
  }

  async function loadMacroRuntime(app_) {
    var globalGetter = globalThis.__inlineGetPkmMacroRuntime
    if (typeof globalGetter === 'function') {
      return globalGetter(app_, normalizeOrderKeyLocal)
    }
    var entry = globalThis.__inlinePkmMacroRuntimeEntryMod
    if (entry && typeof entry.bootstrapMacroRuntime === 'function') {
      return entry.bootstrapMacroRuntime(app_, normalizeOrderKeyLocal)
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

  /*
   * Модули приехали `require` при загрузке файла. Публикация в
   * `globalThis` остаётся швом: оттуда их читает `tagwheel_core`.
   */
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

  function panelFieldIds(state) {
    var core = state && state.core
    var rules = state && state.rules
    var session = state && state.session
    if (core && typeof core.getNavigableFieldSequence === 'function') {
      return core.getNavigableFieldSequence(rules, session)
    }
    var mode = session && session.mode === 'right' ? rules.rightMode : rules.leftMode
    var arr = mode && Array.isArray(mode.fields) ? mode.fields : []
    var out = []
    var i
    for (i = 0; i < arr.length; i++) {
      if (!arr[i] || !arr[i].id) continue
      out.push(arr[i].id)
    }
    return out
  }

  function ensureActiveFieldId(state) {
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
   * Список Field соседней стороны (10.13.35).
   *
   * Считается тем же способом, что и свой, — иначе два списка одних и тех же
   * Field разошлись бы молча (У-32). Копия сессии, а не подмена поля в живой:
   * `getNavigableFieldSequence` смотрит на `activeFieldId`, выбирая Field
   * внутри группы, и с чужой стороной он тут ни при чём.
   */
  function panelFieldIdsFor(state, mode) {
    var session = state && state.session
    if (!session) return []
    if (session.mode === mode) return panelFieldIds(state)

    var core = state.core
    var rules = state.rules
    if (core && typeof core.getNavigableFieldSequence === 'function') {
      var probe = {}
      var key
      for (key in session) {
        if (Object.prototype.hasOwnProperty.call(session, key)) probe[key] = session[key]
      }
      probe.mode = mode
      probe.activeFieldId = ''
      return core.getNavigableFieldSequence(rules, probe)
    }

    var alt = mode === 'right' ? rules.rightMode : rules.leftMode
    var arr = alt && Array.isArray(alt.fields) ? alt.fields : []
    var out = []
    var i
    for (i = 0; i < arr.length; i++) {
      if (!arr[i] || !arr[i].id) continue
      out.push(arr[i].id)
    }
    return out
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
    /* Номер активного Field пересчитывает `ensureActiveFieldId` — по стороне,
       которая теперь стоит в сессии. Второй такой пересчёт здесь разошёлся бы
       с ним молча. */
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
        if (linkTarget) return '[[' + linkTarget + ']]'
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
    if (reg && typeof reg.collapseSubOrderKey === 'function') {
      var collapsed = String(reg.collapseSubOrderKey(key) || '').trim()
      if (collapsed) return collapsed
    }
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
       * Пустое значение — это выход из цикла, и запись всё равно нужна
       * (находка Н-5, 2026-08-28).
       *
       * Раньше Field с пустым значением сюда не попадал вовсе, и старый
       * `[[wikilink]]` оставался в строке навсегда: вычищать его было некому.
       * Теперь запись заводится с пустым токеном и полным набором токенов —
       * перекладывание уберёт старый и не поставит нового.
       *
       * У Field, который не ведётся источником (элементы), старое значение
       * убирает разбор по маркеру, и заводить пустую запись ему незачем.
       */
      if (!selected && !isSourceDriven) continue
      var token = isSourceDriven && selected ? selectedTagTokenForField(field, session, rules, byId) : ''
      var tokens = isSourceDriven ? fieldTagTokenMap(field, rules, session, state && state.core ? state.core : null) : []
      /*
       * Block берётся из Order, а не ставится литералом (находка Н-3,
       * 2026-08-28; третье исключение из З3).
       *
       * `rightMode.fields` — это список определений по типу Field: ссылки и
       * элементы. Это НЕ Right Block, в который Field пишется. Литерал
       * `'right'` смешивал одно с другим, и ссылка, перетащенная в Left
       * Block, всё равно печаталась справа от текста — при том что и панель,
       * и конфиг держали её слева честно.
       *
       * У тегов рядом (`collectSelectedTagEntries`) панель считается ровно
       * так же. Элементы этим не задеты: их кладёт `relocateDateLikeByOrder`,
       * и она Block читала всегда.
       */
      var entryOrderKey = String(field.orderKey || field.id || '').trim()
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
      if (primary) out.push(primary)
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
    if (typeof rulesHelpers.getDateValuePatterns !== 'function') {
      throw new Error('pkm_rules_runtime_helpers unavailable: getDateValuePatterns')
    }
    var patterns = rulesHelpers.getDateValuePatterns()
    var dateIso = String(patterns && patterns.dateIso ? patterns.dateIso : '\\d{4}-\\d{2}-\\d{2}')
    var timeHm = String(patterns && patterns.timeHm ? patterns.timeHm : '\\d{2}:\\d{2}')
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
          return ''
        }
        return (kind === 'nowTime' || kind === 'estimatedCycle')
          ? timeHm
          : ('[^\\s]+' + '(?:\\s+' + timeHm + ')?')
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
    if (!statusRt || typeof statusRt.enforceDependentAdjacencyForStatusLine !== 'function') {
      return String(finalLine || '')
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
          if (!runtimeCore || typeof runtimeCore.getAllowedValues !== 'function') {
            return field && Array.isArray(field.values) ? field.values : []
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
   * У Field вообще есть правило чекбокса — хоть у одного значения.
   *
   * Отличается от `fieldHasOwnCheckbox` тем, что не смотрит на выбранное:
   * вопрос не «даёт ли выбранное значение чекбокс», а «мог ли этот Field его
   * давать». Ровно это и нужно на выходе из цикла, когда значения уже нет.
   *
   * Форма повторяет `fieldHasAnyCheckboxRule` из `status_tags.js` намеренно:
   * два хода обязаны отвечать на один вопрос одинаково (И-3).
   */
  function fieldHasAnyCheckboxRule(rules, fieldId) {
    var fid = String(fieldId || '').trim()
    if (!fid) return false
    var byField = rules && rules.behavior && rules.behavior.prefixRules && rules.behavior.prefixRules.checkboxByFieldValue
      ? rules.behavior.prefixRules.checkboxByFieldValue
      : {}
    var row = byField && typeof byField === 'object' ? byField[fid] : null
    if (!row || typeof row !== 'object') return false
    var keys = Object.keys(row)
    var i
    for (i = 0; i < keys.length; i++) {
      if (String(row[keys[i]] || '').trim()) return true
    }
    return false
  }

  function applySelection(state, core) {
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
    /* Пустой `token` здесь допустим и означает «убрать набор из строки»:
       это выход из цикла (Н-5). Набор токенов при этом обязателен. */
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
    if (hasOffSelected) {
      var activeFieldId = String(state && state.session ? state.session.activeFieldId || '' : '')
      var activeField = activeFieldId ? getFieldByIdAny(state.rules, activeFieldId) : null
      var fieldKey = activeField ? String(activeField.orderKey || activeField.id || '').trim() : ''
      var mode = fieldKey ? rulesHelpers.resolveFieldFreeRoamMode(state.orderCfg, fieldKey) : 'off'
      var hasOwnCheckbox = activeFieldId ? fieldHasOwnCheckbox(state.rules, state.session, activeFieldId) : false
      /*
       * Выход из цикла: значение у Field снято, а правило чекбокса у него
       * есть. Тогда чекбокс уходит вместе со значением, и префикс собирается
       * по настройкам — остаётся буллит.
       *
       * Здесь стоял литерал `false`, и это была вся разница между двумя
       * ходами: хоткей (`status_tags.js`) считает то же самое выражение и
       * поэтому оставлял `- text`, а TagWheel сохранял исходный `- [ ]`
       * (замечание И-3, исключение № 6 из З3, разрешено 2026-09-01).
       *
       * Значения нет — значит и своего чекбокса нет: `hasOwnCheckbox` в этот
       * момент уже `false`, и два флага не спорят.
       */
      var clearedOwnCheckbox = !!activeFieldId
        && !selectedTokenForField(state.rules, state.session, activeField)
        && fieldHasAnyCheckboxRule(state.rules, activeFieldId)
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
        /* Панель посчитана в `collectSelectedRightEntries` по Order — здесь
           она и берётся. Литерал `'right'` был второй половиной Н-3. */
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

    var cyclePost = finalize.applyCycleEndAndInvariants({
      rawLine: state.originalLine,
      finalLine: finalLine,
      rules: state.rules,
      mode: selectedMode,
      cycleEndBehavior: macroShared.normalizeCycleEndBehavior(state.cycleEndBehavior),
      parsedLine: state.parsedLine,
      parseLine: core.parseLine,
      isBulletLikeEmptyResult: macroShared.isBulletLikeEmptyResult,
      buildBulletOnlyLine: function(parsed) { return macroShared.buildBulletOnlyLine(parsed, { keepParsedPrefix: true, keepCheckbox: false }) },
      enforceNoContentFinalization: macroShared.isNoContentParsed(state.parsedLine, { includeTags: true }),
      isNoContentParsed: function(parsed) { return macroShared.isNoContentParsed(parsed, { includeTags: true }) },
      shouldKeepBulletLine: function(line) {
        return /^\s*-\s*$/.test(String(line || ''))
      },
    })
    finalLine = String(cyclePost && cyclePost.finalLine != null ? cyclePost.finalLine : finalLine)
    if (hasRightSelected) {
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
    finalLine = finalize.enforceOffModeFinalPrefixUnified({
      line: finalLine,
      rawLine: state.originalLine,
      mode: selectedMode,
      freeRoamBehavior: freeRoamBehavior,
      hasOwnCheckbox: finalPrefixOwnCheckbox,
      resolvedPrefix: finalPrefixResolved || (finalPrefixOwnCheckbox ? '- [ ]' : '-'),
      cycleEndBehavior: macroShared.normalizeCycleEndBehavior(state.cycleEndBehavior),
      parseLine: core.parseLine,
      rules: state.rules,
      preserveSyntheticPrefix: true,
    })

    /*
     * Один `Ctrl+Z` возвращает исходную строку.
     *
     * Ступень отмены здесь ровно одна, и делают её две записи: сначала строка
     * возвращается к исходной **мимо истории** — все записи панели туда тоже
     * не попадали, значит для истории документ и так стоит на исходной, — а
     * потом итог пишется обычным путём. История получает «исходная → итог»,
     * и первое же нажатие возвращает то, с чего человек начал.
     */
    setLineOutsideHistory(state.editor, state.lineNumber, state.originalLine)
    if (cyclePost && cyclePost.applyKeepBullet) {
      macroShared.applyKeepBullet(state.editor, state.lineNumber, state.parsedLine, { keepParsedPrefix: true, keepCheckbox: false })
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
    state.editor.setCursor({ line: state.lineNumber, ch: nextCh })
    cleanupTagWheelState(state)
  }

  function getControlCursorCh(state, controlLine) {
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
      var m = t.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/)
      if (m) return m[1]
      if (showPrefix) return src
      if (/^#\//.test(t)) return t.replace(/^#\//, '')
      if (/^#\S+/.test(t)) return t.replace(/^#/, '')
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
      return formatVisualToken(token || '-') || '-'
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
    } catch (_) {}
  }

  function cancelSelection(state) {
    /* Отмена возвращает строку как была — и следа в истории не оставляет:
       отменять после неё нечего. */
    setLineOutsideHistory(state.editor, state.lineNumber, state.originalLine)
    state.editor.setCursor({ line: state.lineNumber, ch: state.originalLine.length })
    cleanupTagWheelState(state)
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

  var preApp = resolveTagWheelApp(input)
  /*
   * Имена ключей настроек берутся у модуля, который лежит в бандле, — работа
   * синхронная и отказать ей нечем. Прежде здесь стояли два `await` в пустых
   * `catch`: остатки эпохи загрузчика по пути внутри vault. Второй из них звал
   * функцию с пустым телом, а оба принимали `preApp`, которого не читали.
   */
  applyPkmOptionKeys(__pkmOptionKeysMod)

  var runtimeInput = buildTagWheelRuntimeInput(input, quickAddSettings)
  var scrollerCfg = normalizeScrollerConfig(runtimeInput)

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
    if (typeof rulesHelpers.normalizeRulesPath !== 'function') throw new Error('pkm_rules_runtime_helpers unavailable: normalizeRulesPath')
    if (typeof rulesHelpers.readRulesMarkdownWithFallback !== 'function') throw new Error('pkm_rules_runtime_helpers unavailable: readRulesMarkdownWithFallback')
    var normalizeRulesPathFn = function(raw) { return rulesHelpers.normalizeRulesPath(raw, DEFAULT_RULES_PATH) }
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
    var rp = String(runtimeInput && runtimeInput.rulesPath ? runtimeInput.rulesPath : DEFAULT_RULES_PATH).trim()
    var loadedRules
    try {
      loadedRules = await rulesHelpers.readRulesMarkdownWithFallback(app_, rp, DEFAULT_RULES_PATH)
    } catch (e) {
      if (e && e.message) notice('', e.message)
      else notice(tagWheelNoticeKey('rules-missing'),
        'TagWheel: rules file not found: {0}', normalizeRulesPathFn(rp))
      return
    }
    if (loadedRules && loadedRules.path && loadedRules.path !== normalizeRulesPathFn(rp)) {
      notice(tagWheelNoticeKey('rules-fallback'),
        'TagWheel: using the rules file at {0}', loadedRules.path)
    }
    var rulesMd = loadedRules.markdown
    var rules = core.parseRulesFromMarkdown(rulesMd)
    var dateRuntimeShared = await loadDateRuntimeShared()
    var dateRuntimeCfg = dateRuntimeShared.parseDateRuntimeConfigJson(runtimeInput.dateRuntimeConfig)
    if (!rules.behavior || typeof rules.behavior !== 'object') rules.behavior = {}
    rules.behavior.dateRuntimeConfig = dateRuntimeCfg
    var normalizeOrderKey = await callRuntimeApi(app_, 'loadOrderKeyNormalizer')
    var facade = await callRuntimeApi(app_, 'loadRuntimePreloadFacade')
    var parseOrderConfigFn = function(raw, normalizeKey) {
      if (!rulesHelpers || typeof rulesHelpers.parseOrderConfig !== 'function') {
        throw new Error('pkm_rules_runtime_helpers unavailable: parseOrderConfig')
      }
      return rulesHelpers.parseOrderConfig(raw, normalizeKey)
    }
    var rawOrder = runtimeInput ? runtimeInput.orderConfig : undefined
    if (!rawOrder && rules && rules.behavior && rules.behavior.order) {
      try { rawOrder = JSON.stringify(rules.behavior.order) } catch (_) {}
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

    var cursor = editor.getCursor()
    var lineNumber = cursor.line
    var originalLine = String(editor.getLine(lineNumber) || '')
    var parsedLine = core.parseLine(originalLine, rules)

    var modeName = resolveStartMode(runtimeInput, rules)
    var targetPanel = rulesHelpers.resolvePanelForField(orderCfg, runtimeInput.targetFieldKey, { defaultPanel: modeName })
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
    core.sanitizeState(rules, session)
    session.activeField = core.resolveInitialActiveField(rules, session, session.mode)
    var modeNow = session.mode === 'right' ? rules.rightMode : rules.leftMode
    session.activeFieldId = modeNow && modeNow.fields && modeNow.fields[session.activeField]
      ? modeNow.fields[session.activeField].id
      : ''

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
      edgeMode: normalizeEdgeMode(runtimeInput.edgeMode),
      scrollerOverlay: null
    }

    if (scrollerCfg.enabled) {
      try {
        var scrollerMod = await loadTagWheelScrollerOverlay()
        state.scrollerOverlay = scrollerMod.createTagWheelScrollerOverlay({
          direction: scrollerCfg.direction,
          size: scrollerCfg.size,
          /* Цвета коробки (10.13.15). Пусто — оверлей оставляет цвета темы. */
          fillColor: scrollerCfg.fillColor,
          textColor: scrollerCfg.textColor,
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
        } else if (e.key === (keymap.switchMode || 'Tab')) {
          state.session.mode = state.session.mode === 'left' ? 'right' : 'left'
          state.session.activeField = state.core.resolveInitialActiveField(state.rules, state.session, state.session.mode)
          var switchedMode = state.session.mode === 'right' ? state.rules.rightMode : state.rules.leftMode
          var switchedFields = switchedMode && Array.isArray(switchedMode.fields) ? switchedMode.fields : []
          var switchedField = switchedFields[state.session.activeField]
          state.session.activeFieldId = switchedField && switchedField.id ? String(switchedField.id) : ''
          ensureActiveFieldId(state)
          handled = true
        } else if (e.key === (keymap.apply || 'Enter')) {
          applySelection(state, state.core)
          handled = true
        } else if (e.key === (keymap.cancel || 'Escape')) {
          cancelSelection(state)
          handled = true
        }
      } catch (err) {
        try { cleanupTagWheelState(state) } catch (_) {}
        notice(tagWheelNoticeKey('error'), 'TagWheel error: {0}',
          (err && err.message) ? err.message : err)
        reportTagWheelError(err)
        handled = true
      }

      if (handled) {
        state.core.sanitizeState(state.rules, state.session)
        ensureActiveFieldId(state)
        if (state.active) {
          var control = withKeptPrefix(state.originalLine,
            state.core.renderControlLine(state.rules, state.session, state.parsedLine))
          /* Вид панели — не правка человека, и в историю отмен он не идёт. */
          setLineOutsideHistory(state.editor, state.lineNumber, control)
          state.editor.setCursor({ line: state.lineNumber, ch: getControlCursorCh(state, control) })
          updateScrollerOverlay(state, control)
        }
        e.preventDefault()
        e.stopPropagation()
      }
    }

    /*
     * Закрыть сессию снаружи (Д-2 разбора готовности, 2026-09-08).
     *
     * Панель вешает `keydown` на этап перехвата, и обработчик снимает только
     * `cleanupTagWheelState`. Выгрузка плагина его не звала: человек выключал
     * плагин с открытой панелью, и перехват продолжал съедать стрелки и Enter
     * до перезагрузки окна, а строка оставалась с видом панели в тексте
     * заметки.
     *
     * Шов — одна функция на самом состоянии, и она зовёт **тот же**
     * `cancelSelection`, которым сессию закрывает `Esc`: второе объявление
     * «как закрывается панель» разошлось бы с первым молча (У-32). Снятие
     * перехвата важнее возврата строки, поэтому при отказе записи
     * `cleanupTagWheelState` зовётся всё равно — редактора при выгрузке может
     * уже не быть.
     */
    state.cancel = function() {
      try { cancelSelection(state) } catch (_) { cleanupTagWheelState(state) }
    }
    window.__tagWheelState = state
    ensureActiveFieldId(state)
    window.addEventListener('keydown', state.keyHandler, true)

    var initialControl = withKeptPrefix(originalLine,
      core.renderControlLine(rules, session, parsedLine))
    setLineOutsideHistory(editor, lineNumber, initialControl)
    editor.setCursor({ line: lineNumber, ch: getControlCursorCh(state, initialControl) })
    updateScrollerOverlay(state, initialControl)
    /*
     * Успешное открытие молчит.
     *
     * Здесь стояло уведомление «TagWheel: режим активирован (left)» на каждое
     * нажатие. Строка и так меняется на глазах — панель рисуется поверх неё, —
     * так что сообщение не говорило ничего нового и мешало (замечание И-1,
     * исключение № 5 из З3, разрешено 2026-09-01).
     *
     * Уведомления остаются там, где человеку без них не понять, почему ничего
     * не произошло: нет редактора, не нашлись правила, ошибка конфигурации.
     */
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
/* Решение о шаге стрелки — чистая функция, и проверяется она без Obsidian
   (10.13.35). Запись остаётся внутри, у `nextVirtualField`. */
module.exports.planFieldStep = planFieldStep
module.exports.normalizeEdgeMode = normalizeEdgeMode
/* Запись строки мимо истории отмен — чистая функция над чужим редактором, и
   проверяется она без Obsidian (10.13.53). */
module.exports.setLineOutsideHistory = setLineOutsideHistory
module.exports.lineDiffChange = lineDiffChange
module.exports.keptLinePrefix = keptLinePrefix
module.exports.withKeptPrefix = withKeptPrefix
