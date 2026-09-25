var START_SETTING_OPTION = 'Start setting'
var START_MODE_OPTION = 'Start mode override'
var SUBTAG_FORMAT_OPTION = 'Subtag format'
var CYCLE_END_BEHAVIOR_OPTION = 'Cycle end behavior'
var CURSOR_POLICY_OPTION = 'Cursor policy'
var ORDER_CONFIG_OPTION = 'Order config'
/* Правила для панели: ключ кладёт слой команд, файла панель не читает
   (PRD 10.13.52, П-8, шаг третий). */
var RULES_DATA_OPTION = 'Rules data'
var DATE_RUNTIME_CONFIG_OPTION = 'Date runtime config'
var TAGWHEEL_SCROLLER_ENABLED_OPTION = 'TagWheel scroller enabled'
var TAGWHEEL_SCROLLER_DIRECTION_OPTION = 'TagWheel scroller direction'
var TAGWHEEL_SCROLLER_SIZE_OPTION = 'TagWheel scroller size'
var TAGWHEEL_SCROLLER_LABELS_OPTION = 'TagWheel scroller labels'
/* Карта своих текстов у значений — её спрашивают двое: коробка скроллера
   и полоса панели (`З-38`). Имя ключа названо по предмету, а не по первому
   читателю (У-165). */
var TAGWHEEL_CUSTOM_VALUE_TEXT_OPTION = 'TagWheel custom value text'
/* Чем подписано значение в самой полосе панели — его заказ 2026-09-21
   (`З-38`): `default`, `custom`, `both`. */
var TAGWHEEL_VALUE_NAMES_OPTION = 'TagWheel value names'
/* Цвета коробки скроллера: десятое исключение к З3, разрешение заказчика
   2026-09-02 по замечанию D6 (PRD 10.13.15). Пусто — цвета темы. */
var TAGWHEEL_SCROLLER_FILL_OPTION = 'TagWheel scroller fill color'
var TAGWHEEL_SCROLLER_TEXT_OPTION = 'TagWheel scroller text color'
/* Что делает стрелка на краю панели: двадцать первое исключение к З3,
   разрешение заказчика 2026-09-05 (PRD 10.13.35). */
var TAGWHEEL_EDGE_MODE_OPTION = 'TagWheel edge mode'
var TAGWHEEL_ACTIVE_FIELD_MODE_OPTION = 'TagWheel active field mode'
var TAGWHEEL_ACTIVE_FIELD_LEFT_OPTION = 'TagWheel active field left'
var TAGWHEEL_ACTIVE_FIELD_RIGHT_OPTION = 'TagWheel active field right'
/* Custom block (PRD 10.13.260): какой блок открыть, все блоки ради `Tab`,
   шаг команды Field блока, правила Left/Right ради `Values in the other
   Block` и сам `Tab`. */
var CUSTOM_BLOCK_OPTION = 'Custom block'
var CUSTOM_BLOCKS_OPTION = 'Custom blocks'
var CUSTOM_CYCLE_OPTION = 'Custom cycle'
var LINE_RULES_DATA_OPTION = 'Line rules data'
var TAGWHEEL_CUSTOM_TAB_OPTION = 'TagWheel custom tab'
/*
 * Свои модули — литеральным `require`, по одному на модуль (У-89).
 *
 * Было: пять путей внутри vault и шесть асинхронных загрузок, каждая со
 * своей проверкой годности и своим кешем. Три из них просили модуль с
 * `forceReload = true` — то есть заново на каждый вызов, — и в сборке это
 * ничего не значило: реестр забандленных модулей отдаёт один и тот же
 * объект независимо от флага.
 */
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

/**
 * **Отрезок подсветки, которым нарисована полоса панели.**
 *
 * Метки `==` ставит сам движок панели вокруг своей полосы, значит они лежат
 * во **вставленном**, а не в тексте человека: искать их во всей строке
 * нельзя — `==` человек пишет и сам. Поэтому границы берутся из плана записи,
 * а внутри его отрезков ищется первая и последняя пара знаков.
 *
 * Плана нет, отрезков нет, пары одной — подсветки нет, и уводить каретку
 * неоткуда. Это ответ, а не отказ.
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
 * **Каретка не стоит внутри полосы панели** (его замечание 2026-09-21:
 * «при открытии tagwheel left панель открывается без `====`, а right — с
 * ними; хочу, чтобы `====` не отображались при открытии»).
 *
 * Полоса обёрнута в `==…==`, и заливку ей рисует сама Obsidian этой
 * подсветкой (разбор — `.io-twline` в `styles.css`, три захода). Прятать
 * метки `==` — работа Obsidian, и делает она это по одному правилу:
 * прячущие декорации ставятся, **пока выделение не перекрывает узел**.
 * Прочитано в `app.js` 1.13.7, предикат `IL(range, from, to)` =
 * `range.from <= to && range.to >= from`, то есть **край считается
 * перекрытием**, и набор имён с `"highlight"` — `a3`.
 *
 * Каретка после отрисовки встаёт в конец строки. У левого Block полоса
 * стоит в начале, и конец строки от неё далеко — метки спрятаны. У правого
 * полоса **кончает** строку, каретка садится на её закрывающее `==` — и
 * Obsidian показывает метки сырыми. Разница между Block была ровно в этом.
 *
 * **Спрашивается сама подсветка, а не границы вставки.** Первая версия
 * считала полосой весь вставленный кусок и на строке, где вставка начинается
 * с нулевого знака, уводила каретку в её **конец** — то есть ровно на
 * закрывающее `==`. Форму нашёл обход строки (`node tools/line_matrix.js`) на
 * пустой строке с правым Block: `:: ==**[Due]** ` + '`' + `Now` + '`' + `==`, каретка 22
 * при подсветке [3, 22]. Починка вида открывает следующую форму того же
 * дефекта (У-174), и увидеть её могла только мера шире четырёх образцов
 * (правило 125).
 *
 * Сторона выбирается по месту: есть знак слева от подсветки — каретка туда,
 * иначе за её конец. Обе стороны строго снаружи, потому что край перекрывает.
 * Выйти некуда только у строки, которая **вся** подсветка, — такой у панели
 * не бывает: свой разделитель полоса ставит всегда.
 *
 * `forward` — панель custom block: каретка стоит **за** полосой (его пункт
 * 2026-09-24, тест 5: «чтобы каретка курсора визуально была после
 * вызываемой custom panel»). Край перекрывает и там, поэтому за полосой
 * значит за знаком после неё; этот знак полоса custom block ставит всегда.
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
 * **Значение под кареткой custom block** — отрезок слова, на котором она стоит
 * (PRD 10.13.260, правка 2026-09-24). Его слова: «каретка стоит в тексте
 * value, сразу после него, либо до него» — `|aaa`, `aa|a`, `aaa|`. Каретка
 * между двумя пробелами слова не касается, и ответ тогда `null`: это
 * «отсутствие значения».
 *
 * Слово — то, что стоит между пробелами, кроме ссылки: `[[две части]]`
 * берётся целиком, иначе значение-ссылку с пробелом не узнать вовсе. Что это
 * слово значит, решает не этот помощник, а разбор строки — `customHitAtCaret`.
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
 * **Как вставка custom block встаёт в строку** (PRD 10.13.260, пункт 6):
 * пробел до, если перед ней не пробел и не начало строки, и после, если за
 * ней не пробел и не конец строки. Пустая вставка на месте значения — это
 * снятие значения, и из двух пробелов вокруг остаётся один.
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
 * обязан увидеть сообщение, а не ключ. Сам шов спрашивает общий код —
 * `src/core/say.js`, — а не этот файл: с 2026-09-10 своей копии тут нет
 * (В-100).
 *
 * Ключ собирает `tagWheelNoticeKey`, а не литерал на месте вызова (У-82).
 */
function tagWheelNoticeKey(name) {
  return __sayModule.noticeKey('tagwheel', name)
}

function makeTagWheelNotice(NoticeRef) {
  return function notice(key, english, ...args) {
    /*
     * Текст спрашивается у общего кода, своей копии здесь нет (В-100,
     * 2026-09-10, тридцать седьмое исключение к З3). Правило «спросить шов,
     * при отказе остаться на английском, подставить `{0}` по номеру, а не
     * склейкой» живёт в `src/core/say.js` и было объявлено четыре раза: там и
     * в трёх движках.
     *
     * Своё у панели остаётся только одно — куда сказанное девать, если
     * `Notice` платформы не достался: тогда строка уходит в консоль, а не
     * пропадает.
     */
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
     * Здесь молчать обязательно: это сам отчётчик об отказе панели, и отчёт о
     * его собственном отказе девать некуда, кроме него же. Сказать ли о
     * первом отказе человеку — решает место вызова, и решает по-разному: из
     * четырёх два зовут рядом `notice` (ошибка панели, ошибка запуска), а два
     * молчат нарочно — там за отказом стоит запасной путь (запись строки
     * мимо истории) или пропажа украшения (коробка скроллера не собралась).
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
    /*
     * Проба: реестра плагинов у платформы может не быть вовсе — это приватное
     * API, и оно не обязано существовать. «Нет журнала» — ответ, а не отказ:
     * ниже возвращается `null`, и записи просто не будет.
     */
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
    /*
     * Украшение: это след в журнале разработчика — и до работы (`run.start`),
     * и после неё (`run.result`). Не записался — работа от этого не меняется
     * ни в одну сторону. В сам журнал о его отказе не напишешь, а говорить
     * человеку про пропавший след — шум вместо дела.
     */
  }
}

/*
 * Приложение приходит вызовом: либо само (`x`), либо на объекте вызывающего
 * (`x.app` — так его передают и макро-рантайм, и QuickAdd). Третьим путём
 * здесь стояло `globalThis.app` — прямое обращение к глобальному приложению,
 * которое каталог Obsidian запрещает (П1). Снято 2026-09-11: ни один живой
 * вызов до него не доходил, а если приложение и правда не передали, человек
 * теперь видит названную причину — «TagWheel: no app context», — а не тихую
 * работу с чужим приложением.
 */
function resolveTagWheelApp(x) {
  if (x && x.vault && x.workspace) return x
  if (x && x.app && x.app.vault && x.app.workspace) return x.app
  return null
}

/*
 * Где взять редактор — одно объявление на весь плагин, `src/core/active_editor.js`.
 *
 * Здесь лежала четвёртая копия этого правила, и она спрашивала
 * `workspace.activeLeaf` первым, а `getActiveViewOfType` — последним, через
 * приватный реестр плагинов. Каталог Obsidian требует обратного порядка (П8);
 * проба у реестра переехала в общий модуль и осталась там последней.
 */
function getTagWheelEditor(app_) {
  return __activeEditorMod.activeEditorFrom(app_)
}

/**
 * Открыто ли дочернее поле нажатием `Alt` (`З-36`). Возвращает, сменилось ли
 * что-нибудь.
 *
 * **Переключатель, а не удержание** — его слово 2026-09-23: «чтобы sub-field
 * активировался не удержанием кнопки alt, а однократным нажатием (первое
 * нажатие открывает sub-field активного field, второе нажатие закрывает его)».
 * Удержание сталкивалось с его хоткеями: `Alt+↑` и `Alt+↓` у него заняты
 * командами, и под зажатым `Alt` стрелки уходили им.
 *
 * Закрыл, стоя на дочернем поле, — курсор панели уходит на его родителя: поле
 * сейчас может исчезнуть, и без этого `ensureActiveFieldId` поставил бы курсор
 * на первое поле полосы, далеко от того места, где человек только что был.
 * Поле в положении `Show always` от `Alt` не зависит, и курсор с него не
 * уводится.
 *
 * **Нажатие принадлежит полю, у которого его сделали** — `altFor`, — его
 * слово 2026-09-23 к тесту 3: ушёл стрелкой на другое поле и вернулся — «я
 * хочу, чтобы в таком случае дочернее поле не возникало, т.е. мне нужно было
 * бы повторно нажать alt». Снимает его `ensureActiveFieldId`: через него
 * проходит каждое движение курсора панели.
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

function cleanupTagWheelState(state) {
  if (!state) return
  if (state.keyHandler) window.removeEventListener('keydown', state.keyHandler, true)
  if (state.keyUpHandler) window.removeEventListener('keyup', state.keyUpHandler, true)
  try {
    if (state.scrollerOverlay && typeof state.scrollerOverlay.destroy === 'function') {
      state.scrollerOverlay.destroy()
    }
  } catch (_) {
    /*
     * Уборка: коробки скроллера может уже не быть — заметку закрыли, узел
     * сняли, сессия кончилась другим путём. Цель достигнута в любом случае.
     * И порядок здесь не случаен: перехват `keydown` на всё окно снимается
     * **выше** этого блока, а сессия гасится строкой ниже — ни то, ни другое
     * не имеет права остаться несделанным из-за неудавшейся уборки картинки
     * (шов Д-2, В-91).
     */
  }
  state.active = false
}

/*
 * Довода «вот мой нормализатор ключа Order» здесь больше нет (10.13.168):
 * переходник к дому передавался через пять слоёв, и каждое «иначе своё» на
 * каждом слое вело в тот же дом — `normalizeOrderKey` в `shared_utils.js`.
 */

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

/* «Приставка плюс значение» — общий дом (10.13.152). Тело панели не
   пропускало насквозь даже готовую ссылку и удваивало приставку; от `##todo`
   на экране берегли ранние возвраты у звавших, а не оно. */
function composeToken(prefix, rawToken) {
  return __sharedUtils.composeToken(prefix, rawToken)
}

/* «Снять скобки, если они есть» — общий дом (`unwrapWikilinkToken`). Тело
   уехало туда побайтно: сверка на 17 195 входах дала ноль расхождений. До
   этого правило стояло здесь, а ядро цель ссылки не разворачивало вовсе. */
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
  /* Custom block (PRD 10.13.260). */
  if (!out.customBlock && typeof qa[CUSTOM_BLOCK_OPTION] === 'string') out.customBlock = qa[CUSTOM_BLOCK_OPTION]
  if (out.customBlocks == null && qa[CUSTOM_BLOCKS_OPTION] != null) out.customBlocks = qa[CUSTOM_BLOCKS_OPTION]
  if (!out.customCycle && typeof qa[CUSTOM_CYCLE_OPTION] === 'string') out.customCycle = qa[CUSTOM_CYCLE_OPTION]
  if (out.lineRulesData == null && qa[LINE_RULES_DATA_OPTION] != null) out.lineRulesData = qa[LINE_RULES_DATA_OPTION]
  if (out.customTab == null && qa[TAGWHEEL_CUSTOM_TAB_OPTION] != null) out.customTab = qa[TAGWHEEL_CUSTOM_TAB_OPTION] === true
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

/**
 * Карта «чем печатается это значение вместо себя» — **один разбор на двоих**.
 *
 * Спрашивают её коробка скроллера (его заказ 2026-09-20) и сама полоса панели
 * (`З-38`, его заказ 2026-09-21). Собирает карту дом правила
 * (`buildTagCustomTextMap`), тот же, каким пузырь в заметке решает то же
 * самое; сюда она приезжает строкой настройки.
 *
 * Разбор стоял внутри конфига коробки и выполнялся **только** при
 * `Scroller Value names = custom`: второму читателю карта при выключенной
 * коробке приезжала бы пустой, а выглядело бы это как «своих текстов нет».
 *
 * Строку правит не человек, но сломанной она быть может: это проба, и ответ
 * «нет» здесь ответ — значения подписываются как написано.
 */
function readCustomValueTextMap(raw) {
  try {
    var parsed = JSON.parse(String((raw && raw.customValueText) || '{}'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch (_eCustomText) {
    /* Карта приезжает строкой настройки и бывает сломанной; пустая карта —
       законное значение, а не отказ. */
  }
  return {}
}

/**
 * Чем подписано значение **в самой полосе** — его заказ 2026-09-21 (`З-38`).
 *
 * Три положения, названные его словами: `Default name` (как написано, прежнее
 * поведение), `Only custom name` (свой текст из `Color your tags`) и
 * `Custom+Default name` (оба, свой текст первым).
 *
 * Вопрос это **не тот же**, что у коробки: коробка подписывает соседние
 * значения, полоса — выбранное. Два контрола, одна карта.
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
  /*
   * **Чем подписаны соседние значения** — его заказ 2026-09-20: «в настройках
   * скроллера нужно добавить режим отображения (дефолтные названия или custom
   * (при наличии))». Своего правила «у этого значения есть свой текст» здесь
   * нет: карта приезжает готовой (`buildTagCustomTextMap`), и собрана она тем
   * же ответом, каким пузырь в заметке решает то же самое (У-32).
   *
   * Карта читается как JSON и бывает сломанной — её собирает не человек, но
   * приезжает она строкой настройки: пустой ответ значит «своих текстов нет»,
   * и коробка подпишет значения как раньше.
   */
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

/* «Каким выводом печатается это поле» — общий дом у помощников. Правило было
   объявлено трижды: здесь, в ядре и замыканием у самих помощников. Три тела
   сверены на 150 парах «поле × правила» и разошлись на нуле (10.13.139). */
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
    /* Три ключа подписей стояли тут же и не переносились: значение совпадало с
       литералом, и расхождения не было **пока**. Ключ, которого нет в этом
       переносе, молча остаётся на своём литерале (У-237). */
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
    CUSTOM_CYCLE_OPTION = String(keys.CUSTOM_CYCLE || CUSTOM_CYCLE_OPTION)
    LINE_RULES_DATA_OPTION = String(keys.LINE_RULES_DATA || LINE_RULES_DATA_OPTION)
    TAGWHEEL_CUSTOM_TAB_OPTION = String(keys.TAGWHEEL_CUSTOM_TAB || TAGWHEEL_CUSTOM_TAB_OPTION)
  }

  function getDomainRegistry() {
    return domainRegistry
  }

  function resolveOrderKeyFromFieldId(fieldId) {
    var reg = getDomainRegistry()
    /* Идентификатор поля вместо ключа Order — не «почти то же»: на паре ключей
       это разные значения, и разница видна только в строке (10.13.167). */
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

  /*
   * Какие Field панель считает проходимыми, решает ядро, и только оно.
   *
   * Здесь стоял запасной ход, и правило у него было **у́же дома**: он выдавал
   * подряд все `id` из списка стороны, не спрашивая ни групп, ни спрятанных,
   * ни активного Field. Исполнись он хоть раз — человек ходил бы стрелкой по
   * полям, которых на экране нет.
   *
   * Недостижимость снята пробоем (У-146): бросок внутри запасной ветки не
   * уронил ни одной проверки, ни одного сочетания обхода строки и ни одного
   * шага браузерного стенда, а положительный контроль — бросок на входе —
   * уронил их сразу. Ядро приезжает литеральным `require` (A33, У-90).
   */
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
    /* Курсор ушёл с поля, у которого нажали `Alt`, и с его дочерних — нажатие
       кончилось (`setAltOpen`). Раньше списка полей: от него зависит, видно
       ли дочернее поле. */
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
    /* Тот же запасной ход и та же цена, что у своего списка выше; пробой
       сделан тем же стендом — `node tools/line_bench.js panel left … шесть
       раз ArrowRight`, на его настройке `Move to the next Block`. Набор эту
       функцию не исполняет вовсе, и зелёный прогон по ней ничего не значил бы
       (У-56). */
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
      /* Дочерний Field ссылки своего ключа в Block не имеет и пишется в Block
         родителя — как дочерний тег (`resolvePanelKeyForField`). Field с
         предусловием стоит в Block своим ключом и остаётся там (PRD 10.13.269). */
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
        /*
         * Образец значения выводится из формата поля, а не угадывается.
         * Стояла догадка «слово, а за ним, может быть, время»: она верна
         * ровно на `YYYY-MM-DD hh:mm` и неверна на любом другом формате с
         * пробелом (PRD 10.13.71). Формата у поля нет — образца нет, и это
         * ответ: где кончается значение, дальше решает общий обход.
         */
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
    /* Сосед по той же переменной — `relocateTagLikeByOrder` — отказывает здесь
       громко, а это место отдавало строку нетронутой: правило соседства
       дочернего поля молча переставало работать, и отличить это от «нечего
       менять» нельзя было ничем (10.13.166). */
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
          /* Тот же отказ, что у команд тегов (10.13.166): молчаливый ответ
             здесь был **копией правила** — «значения поля это то, что у него
             записано», — а дом спрашивает ещё и предусловие и активность. */
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
   * Наш ли знак задачи, стоящий на строке, — вид значения этого Field.
   *
   * Отличается от `fieldHasOwnCheckbox` тем, что не смотрит на выбранное:
   * значения на выходе из цикла уже нет, а знак на строке ещё стоит, и вопрос
   * к нему — чей он.
   *
   * Правило живёт в общем доме (`pkm_line_finalize_unified`), и оба хода
   * спрашивают его одной функцией: своя копия здесь уже расходилась с
   * командами литералом (И-3), а прежний вопрос «у поля знаки бывают» уносил
   * со строки знак человека (10.13.105).
   */
  function checkboxBelongsToField(rules, fieldId, token, finalize) {
    if (!finalize || typeof finalize.checkboxBelongsToFieldUnified !== 'function') {
      throw new Error('pkm_line_finalize_unified unavailable: checkboxBelongsToFieldUnified')
    }
    return finalize.checkboxBelongsToFieldUnified(rules, fieldId, token)
  }

  /* ---- custom block (PRD 10.13.260) ----------------------------------- */

  /*
   * Панель custom block — **та же панель на своих правилах**: Field блока
   * записаны в них левым Block (`scopeToBlock` в `pkm_rules_shape.js`), и ядро
   * ходит по ним тем же `getNavigableFieldSequence`, рисует ту же полосу, те же
   * `Alt` и дочерние поля. Своё у блока — только место полосы (у каретки, а не
   * в зоне Block) и запись: `Enter` пишет вставку у каретки обычной правкой, а
   * не пересборку строки.
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
   * На значении ли какого-нибудь Field блока стоит каретка. Слово под ней
   * узнаёт **разбор строки** — тот же вопрос, которым панель узнаёт значения
   * Left/Right (правило 72), а не своё сравнение написаний.
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
   * Где в строке текст человека — для `Values in the other Block = Hide`:
   * прячется всё, что вокруг него. Зоны считает разбор Left/Right на их
   * правилах. Каретка не в тексте — ответ `null`, и прятать нечего: полосу
   * некуда поставить так, чтобы спрятанное не накрыло её место.
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

  /**
   * Вид строки с полосой custom block: **текст разрывается на месте каретки**
   * (его пункт 2026-09-24) — слева и справа всё, что было, и полоса между.
   * Стоит каретка на значении — полоса встаёт на его место.
   */
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
    /* Знак за полосой есть всегда, и в конце строки тоже: каретка встаёт за
       ним (его пункт 2026-09-24), а на самом краю Obsidian показала бы `==`. */
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
   * `Tab` в панели custom block (пункт 8): выключен контрол — ничего; включён —
   * следующий блок по порядку, с последнего на первый. Выбранное в прежнем
   * блоке выбрасывается (`В-208`), панель остаётся у той же каретки.
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

  /**
   * Правила соседнего блока — тем же порядком шагов, что у открытого:
   * порядок, `applyOrderToRules`, выбор ведущего поля. Готовятся при открытии,
   * чтобы `Tab` менял блок без ожидания.
   */
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

  /*
   * `Active Field on opening` в custom block (пункт 10): первый или средний
   * Field блока, а `A Field you choose` — как первый. Его слово: «не стоит
   * усложнять логику».
   */
  function customActiveFieldChoice(input_) {
    var mode = String(input_.activeFieldMode || '').trim().toLowerCase()
    return { mode: mode === 'middle' ? 'middle' : 'first', left: '', right: '' }
  }

  /**
   * Команда `next`/`previous` Field блока — **по месту каретки** (правка
   * 2026-09-24): на значении этого Field меняет его на соседнее, иначе ставит
   * у каретки первое (`next`) или последнее (`previous`) новой копией.
   */
  function runCustomCycle(o, line, cursor_) {
    var cycle = null
    try { cycle = JSON.parse(String(o.runtimeInput.customCycle || '')) } catch (_eCycle) {
      /* Шаг приходит строкой настройки, её собирает реестр команд; сломанная —
         значит команда не наша, и ниже человеку скажут об этом вслух. */
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
   * Открыть панель custom block у каретки (PRD 10.13.260). Каретка на
   * значении Field блока — панель открывается на нём и показывает его
   * выбранным (пункт 5); иначе пустой (пункт 4).
   */
  async function openCustomBlock(o) {
    var input_ = o.runtimeInput
    /* Выделение — каретка на его конце, выделенный текст не трогается. */
    var cursor_ = o.editor.getCursor('to')
    var line = String(o.editor.getLine(cursor_.line) || '')
    if (input_.customCycle) { runCustomCycle(o, line, cursor_); return }

    var blockId = String(input_.customBlock || '')
    var raw = input_.customBlocks
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw) } catch (_eBlocks) {
        /* Список блоков собирает реестр команд; сломанный значит «соседей нет»:
           `Tab` ничего не сделает, а сам блок откроется. */
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
      /* `tagWheel navigation behavior` к custom block не относится (пункт 11). */
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
    if (state && state.custom) {
      /* Навигатор не пишется и в custom block (`В-221`). Вставка идёт у
         каретки, поэтому «стоял на строке» — только слово, которое она
         заменяет (правило 107). */
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
       * Выход из цикла: значение у Field снято, а знак, стоящий на строке, —
       * вид значения этого самого Field. Тогда знак уходит вместе со
       * значением, и префикс собирается по настройкам — остаётся буллит.
       *
       * Здесь стоял литерал `false`, и это была вся разница между двумя
       * ходами: хоткей (`status_tags.js`) считает то же самое выражение и
       * поэтому оставлял `- text`, а TagWheel сохранял исходный `- [ ]`
       * (замечание И-3, исключение № 6 из З3, разрешено 2026-09-01).
       *
       * А спрошено было «бывают ли у поля знаки вообще», и на строке
       * `- [x] #area-gamma` этого хватало, чтобы унести `[x]` человека
       * (10.13.105). Вопрос теперь о самом знаке.
       *
       * Значения нет — значит и своего чекбокса нет: `hasOwnCheckbox` в этот
       * момент уже `false`, и два флага не спорят.
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
    /*
     * **Чужое в правом Block панель не строит и терять не вправе.** Метка
     * `#processed` от `Inline to note` пропадала с первого шага панели, а
     * команда того же поля её сохраняла (обход строки, формы В-141).
     */
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
      /* Свёрнутая строка — это «знак списка и, если он человека, знак задачи»:
         оба вида пишутся одной записью, иначе пробел за `[x]` теряется по
         дороге и Obsidian перестаёт считать строку задачей (10.13.105). */
      shouldKeepBulletLine: function(line) {
        return /^\s*-\s*(?:\[[^\]]\]\s*)?$/.test(String(line || ''))
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
    /*
     * Префикс строки в режиме `Strict` решает настройка `Strict: add a bullet`,
     * и решает она его **один раз** — внутри `enforceOffModeFinalPrefixUnified`.
     *
     * Здесь стояло второе объявление того же правила: `preserveSyntheticPrefix`
     * литеральным `true` уводило вычисление в ветку «префикс сохранить любой
     * ценой» ещё до того, как спрашивалась настройка. Панель ставила буллит на
     * пустой строке при выключенном тумблере, команда поля — не ставила, и
     * заказчик получал разный результат от одинакового действия (замечание
     * `S15` 2026-09-12, У-150). Теперь признак считается так же, как у шага по
     * тегу (`status_tags.js`): сохранять синтетический префикс просят только
     * выбранные поля режима `minimal`.
     *
     * Запасное `'-'` рядом снято тем же заходом, но дефектом оно не было:
     * подмена, вернувшая его одно, набор не покраснела — до этой строки
     * вычисление доходит только там, где буллит и так назначен настройкой.
     * Снято оно как вторая запись того же ответа, а не как причина.
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
     * Один `Ctrl+Z` возвращает исходную строку.
     *
     * Ступень отмены здесь ровно одна, и делают её две записи: сначала строка
     * возвращается к исходной **мимо истории** — все записи панели туда тоже
     * не попадали, значит для истории документ и так стоит на исходной, — а
     * потом итог пишется обычным путём. История получает «исходная → итог»,
     * и первое же нажатие возвращает то, с чего человек начал.
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
    state.editor.setCursor({ line: state.lineNumber, ch: nextCh })
    cleanupTagWheelState(state)
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
      /* Цель ссылки называет общий дом. */
      var linkTarget = __sharedUtils.wikilinkTargetOf(t)
      if (linkTarget) return linkTarget
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
       * Свой текст значения сильнее написания — но только когда человек об этом
       * попросил контролом `Scroller Value names`. Спрашивается сам токен, а не
       * то, что из него сделала `formatVisualToken`: карта собрана по токенам.
       *
       * Положений три, и третье — его слово 2026-09-21, вечер: «добавь опцию
       * `Custom+Default`, чтобы работал как `panel-value-names=Custom+Default
       * name`». Соединяет их общий дом `core.joinValueLabel` — тот же, каким
       * подписывает значение полоса панели; написанное считается здесь,
       * потому что у коробки оно своё (`formatVisualToken`).
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
      /*
       * Украшение: оверлей скроллера рисуется поверх текста человека и права
       * его уронить не имеет. Не обновился — на экране останется прежний
       * кадр коробки, а сама строка и выбор в панели целы.
       */
    }
  }

  /**
   * Нарисовать панель на строке: полоса **рядом** со значениями, а не вместо.
   *
   * Решение заказчика 2026-09-13. Прежде вид панели писался в строку целиком, и
   * значения, на место которых встаёт полоса, из документа на время выбора
   * исчезали; ступень истории, которая их когда-то написала, переносилась через
   * их удаление и схлопывалась (У-160). Теперь документ получает только
   * вставку, а всё, что полоса собой закрывает, прячется оформлением.
   *
   * **Что панель показывает, здесь не решается.** Вид считает
   * `renderControlLine`, он не тронут; здесь только превращение «показать вот
   * это» в запись без удаления — одним объявлением, `planPanelLineWrite`.
   *
   * **Плана может не быть**, и тогда пишем по-старому: свойства плана не
   * сошлись — значит на экране получилось бы не то, что нарисовал движок, а вид
   * человек видит сейчас, история же понадобится ему потом. Это проба, и ответ
   * «нет» здесь ответ, а не отказ.
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
    /*
     * **Прежний вид снимается точными отрезками, новый ставится точными
     * вставками.** Написать различие двух своих видов было бы проще и
     * неверно: между кусками полосы стоит значение, которое человек написал
     * сам, и различие уносит его вместе с прежним видом — ступень истории,
     * которая это значение написала, схлопывается. Стенд считает это пятью
     * лишними состояниями ровно там, где значение есть и в своём Block.
     */
    if (plan) unwritePanelLine(state)
    state.panelPlan = plan
    if (!plan || !insertPanelPlan(state, plan)) {
      state.panelPlan = plan
      setLineOutsideHistory(state.editor, state.lineNumber, text)
    }
    /*
     * Маска ставится **после** записи: отрезки считаны по новой строке, и
     * прижимаются они к её длине. Порядок наоборот дал бы маску по прежней
     * строке на один кадр.
     */
    __panelMaskMod.applyPanelMask(state.editor ? state.editor.cm : null,
      state.lineNumber, plan ? plan.hidden : [])
    state.editor.setCursor({
      line: state.lineNumber,
      ch: cursorOutsidePanelStrip(text, plan,
        visibleChToTextCh(text, plan ? plan.hidden : [], getControlCursorCh(state, control)),
        Boolean(state.custom)),
    })
    /*
     * Оверлею отдаётся **записанная** строка, а не вид: место своей коробки он
     * считает столбцами документа, и по виду они разошлись бы ровно на длину
     * вставки.
     */
    updateScrollerOverlay(state, text)
  }


  /**
   * Столбец в записанной строке по столбцу в том, что человек видит.
   *
   * Спрятанное места на экране не занимает, но в строке стоит: курсор,
   * поставленный по видимому столбцу без пересчёта, уехал бы внутрь
   * спрятанного — то есть встал бы там, где его не видно.
   */
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
   * Поставить вид панели **точными вставками** в строку человека.
   *
   * Зовётся сразу за снятием прежнего вида, то есть на строке, равной
   * исходной. Не равна — значит человек правил её сам или прежний вид снять не
   * вышло; тогда `false`, и зовущий пишет строку целиком, как писал до
   * 2026-09-13. Это проба, и ответ «нет» здесь ответ, а не отказ.
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
   * Снять вставку панели — **ровно теми отрезками, какими она вставлена**.
   *
   * Общее различие двух строк (`lineDiffChange`) для этого не годится: оно
   * бережёт общее начало и конец и режет всё остальное одним куском. А между
   * кусками вставки стоит то, что панель показала **чужим** токеном — значение,
   * которое человек написал сам. Один кусок уносит и его, и ступень истории,
   * которая его написала, схлопывается. На стенде это стоило пяти лишних
   * состояний в случае «значения есть и в том Block, где открылась панель», при
   * нуле в соседнем: разница между случаями и есть эта середина (У-164).
   *
   * Плана нет или строка на экране не та, что план обещал, — возвращаемся
   * по-старому, целой строкой. Это проба: человек мог править строку сам.
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
    /* Отмена возвращает строку как была — и следа в истории не оставляет:
       отменять после неё нечего. */
    clearPanelMask(state)
    unwritePanelLine(state)
    state.editor.setCursor({ line: state.lineNumber,
      ch: state.custom ? state.custom.caretCh : state.originalLine.length })
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

  /**
   * На каком Block панель откроется на самом деле.
   *
   * **Решение заказчика 2026-09-16 (В-130).** Его слова: «для теста я
   * перетащил все Field в right block и открыл tagwheel left — он открылся как
   * `====`… думаю, было бы лучше, чтобы tagwheel был умнее и сразу открывал
   * другой block, если текущий (который пользователь вызывает командой) пустой».
   *
   * **«Пусто» спрашивается тем же вопросом, каким панель рисуется** —
   * `getNavigableFieldSequence`. Списки `leftMode`/`rightMode` на этот вопрос
   * не отвечают: сторону Field решает Order, а не то, в каком списке правил он
   * объявлен, — правка, считавшая по спискам, на его же случае не срабатывала
   * вовсе. Два ответа на «что покажет панель» разошлись бы молча (У-32).
   *
   * Отсюда и ширина: пустым Block считается и тогда, когда все его поля на
   * этой строке спрятаны предусловием. Это шире слов заказчика («перетащил все
   * Field в right block»), но ровно по его смыслу: открывать полосу, в которой
   * нечего выбрать, незачем ни в том, ни в другом случае.
   *
   * Сосед проверяется так же: если показывать нечего ни там, ни там,
   * открывается то, что человек и просил, — уходить некуда, и молчаливая
   * подмена Block была бы враньём.
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
   * **Подключить сессию панели**: коробка скроллера, перехват клавиш, `Alt`,
   * шов закрытия снаружи и первая отрисовка. Вынесено 2026-09-24 из открытия
   * Left/Right без правки тела — тот же порядок шагов нужен панели custom
   * block (PRD 10.13.260), и второе объявление «как панель подключается»
   * разошлось бы с первым молча (У-32).
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
      /*
       * Нажатие `Alt` считается, только если между нажатием и отпусканием не
       * было другой клавиши (`З-36`): `Alt+↑` — это его хоткей, а не
       * открытие поля. И `Alt+Tab` поэтому поля не переключает.
       */
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
          /* Панель Left/Right сюда не приходит никогда (пункт 8). */
          switchCustomBlock(state)
          handled = true
        } else if (e.key === (keymap.switchMode || 'Tab')) {
          state.session.mode = state.session.mode === 'left' ? 'right' : 'left'
          /* Имя ведущего поля кладёт разрешитель; согласование — за
             `ensureActiveFieldId`. Второе объявление здесь теряло элемент
             ровно так же, как на открытии. */
          state.session.activeField = state.core.resolveInitialActiveField(state.rules, state.session, state.session.mode)
          ensureActiveFieldId(state)
          handled = true
        } else if (e.key === (keymap.apply || 'Enter')) {
          applySelection(state, state.core)
          handled = true
        } else if (e.key === (keymap.cancel || 'Escape')) {
          cancelSelection(state)
          handled = true
        } else if (e.key === 'Alt') {
          /* Переключает поле отпускание (`keyUpHandler` ниже), здесь только
             отметка «началось нажатие». Своя обработка гасит и то, что
             Windows делает с одиночным `Alt`, — фокус на меню окна. */
          if (!e.repeat) state.altTap = true
          handled = true
        }
      } catch (err) {
        try {
          cleanupTagWheelState(state)
        } catch (_) {
          /*
           * Уборка, и она обязана быть тихой: об отказе, из-за которого мы
           * сюда попали, человеку говорится следующей строкой, и второй
           * отказ — самой уборки — не имеет права съесть это сообщение.
           */
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
    /*
     * Отпущенный `Alt` (`З-36`) переключает дочернее поле, если это было
     * одиночное нажатие. Живёт и снимается вместе с перехватом `keydown` —
     * `cleanupTagWheelState`, в том числе при выгрузке плагина.
     */
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

    drawPanelLine(state, panelView(state))
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
      /*
       * Второе нажатие применяет выбор — но только своей командой (PRD
       * 10.13.260, пункт 12). Блоки друг с другом не взаимодействуют: команда
       * чужого блока, `tagWheel Left`/`Right` при панели блока и шаг Field
       * блока при любой панели отказывают вслух.
       */
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
     * **Правила приезжают из настроек** (PRD 10.13.52, П-8, шаг третий;
     * 2026-09-13). Служебного файла панель не читает вовсе: ни пути, ни
     * разбора, ни запасных кандидатов. Ключ кладёт слой команд —
     * `buildRulesForEngines(cfg)` в `command_registry.js`, — и он же кормит
     * движки тегов и элементов с шага второго.
     *
     * **Ключа нет — отказ громкий, а не тихий переход на файл.** Панель
     * открывает человек, и работать по правилам, которых он не задавал, хуже,
     * чем не открыться (Д-4 разбора готовности). Случай этот один: панель
     * позвали не нашей командой.
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
    /* Нормализатор ключа Order спрашивается у дома напрямую (10.13.168):
       через рантайм он приезжал пятью слоями и был тем же самым. */
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
      /*
       * Без охраны, и вот почему (третий кусок В-97). `behavior` целиком
       * пришёл из JSON-блока заметки правил — `parseJsonBlock` → `JSON.parse`,
       * — а у разобранного JSON не бывает ни круга, ни `BigInt`, то есть
       * бросить здесь нечем. Прежний пустой `catch` при отказе оставлял
       * `rawOrder` пустым, и порядок Fields тихо не применялся бы вовсе:
       * охрана, которая не может сработать, но, сработав, портит молча.
       */
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
    /*
     * Настройка «на каком Field открывать» кладётся в правила тем же
     * приёмом, каким туда кладётся порядок: движок читает правила, а не
     * настройки (10.13.76).
     */
    core.applyActiveFieldChoiceToRules(rules, {
      mode: runtimeInput.activeFieldMode,
      left: runtimeInput.activeFieldLeft,
      right: runtimeInput.activeFieldRight
    })
    /*
     * Ведущее поле выбирает `resolveInitialActiveField`, и **имя** выбранного
     * поля кладёт он же: у элемента места в списке по типу нет вовсе, и по
     * индексу его не найти.
     *
     * Здесь стояло второе объявление того же правила — имя бралось заново,
     * индексом в списке по типу, — и оно перетирало верный ответ. При выборе
     * `First Field of the Block` заказчик получал не первое поле своего
     * порядка, а первый **тег**: его порядок начинается с элемента-даты, и
     * активным вставал сосед (замечание `S5` 2026-09-12, У-150).
     *
     * Согласование имени с номером и с тем, что панель рисует, делает
     * `ensureActiveFieldId` ниже — одно место на оба входа.
     */
    /* Пустой Block открывается соседним (В-130). Решается до выбора ведущего
       поля: иначе оно выбиралось бы среди полей той стороны, которую панель в
       итоге не покажет. */
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
      scrollerOverlay: null
    }

    await mountSession(state)
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
module.exports.setAltOpen = setAltOpen
module.exports.normalizeEdgeMode = normalizeEdgeMode
/* Запись строки мимо истории отмен — чистая функция над чужим редактором, и
   проверяется она без Obsidian (10.13.53). */
module.exports.setLineOutsideHistory = setLineOutsideHistory
module.exports.lineDiffChange = lineDiffChange
/* Custom block: слово под кареткой и форма вставки — чистые функции (10.13.260). */
module.exports.customWordSpan = customWordSpan
module.exports.customInsertPlan = customInsertPlan
module.exports.keptLinePrefix = keptLinePrefix
module.exports.withKeptPrefix = withKeptPrefix
/* Место каретки при открытой панели — чистая функция над планом записи, и
   проверяется она без Obsidian: правило про `====` иначе жило бы только в
   моей памяти (правило 122). */
module.exports.cursorOutsidePanelStrip = cursorOutsidePanelStrip
/* «Как значение поля выглядит в строке» объявлено и здесь, и в ядре
   (`buildOutputToken`). Отдаётся наружу затем, чтобы расхождение между двумя
   объявлениями меряла программа, а не чтение: стенд `tools/form_divergence.js`
   зовёт оба настоящих тела на одних входах. Поведения этот экспорт не меняет. */
module.exports.buildOutputTokenForFieldValue = buildOutputTokenForFieldValue
module.exports.resolveFieldOutputMode = resolveFieldOutputMode
