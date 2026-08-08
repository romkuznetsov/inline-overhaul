function err(msg) {
  throw new Error('[triggerwheel] ' + msg)
}

function isObj(x) {
  return x && typeof x === 'object' && !Array.isArray(x)
}

function getMarkdownJsonBlockParser() {
  try {
    if (typeof require === 'function') {
      var mod = require('../../src/core/markdown_json_block_parser.js')
      if (mod && typeof mod === 'object') return mod
    }
  } catch (_) {}
  return null
}

function cleanJsonText(s) {
  var parser = getMarkdownJsonBlockParser()
  if (parser && typeof parser.cleanJsonText === 'function') {
    return parser.cleanJsonText(s)
  }
  return String(s || '')
    .replace(/\uFEFF/g, '')
    .replace(/^\s*>\s?/gm, '')
    .trim()
}

function parseJsonBlock(content, blockName, required) {
  var parser = getMarkdownJsonBlockParser()
  if (parser && typeof parser.parseJsonBlock === 'function') {
    return parser.parseJsonBlock(content, blockName, required, function(message) {
      err(message)
    })
  }
  var re = new RegExp('```' + blockName + '\\s*([\\s\\S]*?)```')
  var m = String(content || '').match(re)
  if (!m) {
    if (required) err('Block `' + blockName + '` not found')
    return null
  }
  try {
    return JSON.parse(cleanJsonText(m[1]))
  } catch (e) {
    err('Invalid JSON in `' + blockName + '`: ' + e.message)
  }
}

function parseRulesFromMarkdown(content) {
  var raw = parseJsonBlock(content, 'triggerwheel-triggers', true)
  return isObj(raw) ? raw : {}
}

function validateRules(rules) {
  if (!isObj(rules)) err('rules must be object')
  if (!isObj(rules.behavior)) rules.behavior = {}
  if (!isObj(rules.behavior.keymap)) rules.behavior.keymap = {}
  if (!Array.isArray(rules.categories)) rules.categories = []
  if (!Array.isArray(rules.items)) err('items must be array')
  var i
  for (i = 0; i < rules.items.length; i++) {
    var it = rules.items[i]
    if (!isObj(it)) err('items[' + i + '] must be object')
    if (typeof it.trigger !== 'string' || !it.trigger) err('items[' + i + '].trigger must be non-empty string')
    if (typeof it.category !== 'string') err('items[' + i + '].category must be string')
    if (typeof it.alias !== 'string') it.alias = ''
    if (typeof it.label !== 'string' || !it.label) {
      it.label = '`' + it.trigger + '` - ' + (it.alias || 'без alias')
    }
  }
}

function parseLine(rawLine) {
  var line = String(rawLine || '')
  var indent = (line.match(/^(\s*)/) || ['', ''])[1]
  var text = line.slice(indent.length)
  return { indent: indent, text: text }
}

function uniq(arr) {
  var out = []
  var seen = {}
  var i
  for (i = 0; i < arr.length; i++) {
    var v = String(arr[i] || '')
    if (seen[v]) continue
    seen[v] = true
    out.push(v)
  }
  return out
}

function getCategoryValues(rules) {
  var cats = ['']
  var fromRules = Array.isArray(rules.categories) ? rules.categories : []
  var i
  for (i = 0; i < fromRules.length; i++) {
    if (fromRules[i]) cats.push(String(fromRules[i]))
  }
  for (i = 0; i < rules.items.length; i++) {
    var c = String(rules.items[i].category || '')
    if (c) cats.push(c)
  }
  return uniq(cats)
}

function getTriggerValues(rules, state) {
  var cat = state.selected.category || ''
  var out = ['']
  var i
  for (i = 0; i < rules.items.length; i++) {
    var it = rules.items[i]
    if (!cat || it.category === cat) out.push(it.trigger)
  }
  return uniq(out)
}

function getItemByTrigger(rules, trigger) {
  var i
  for (i = 0; i < rules.items.length; i++) {
    if (rules.items[i].trigger === trigger) return rules.items[i]
  }
  return null
}

function makeInitialState() {
  return {
    activeField: 0,
    selected: {
      category: '',
      trigger: ''
    }
  }
}

function nextField(state, direction) {
  var fieldsCount = 2
  state.activeField = (state.activeField + direction + fieldsCount) % fieldsCount
}

function cycleValue(rules, state, direction) {
  var field = state.activeField === 0 ? 'category' : 'trigger'
  var values = field === 'category' ? getCategoryValues(rules) : getTriggerValues(rules, state)
  var cur = state.selected[field] || ''
  var idx = values.indexOf(cur)
  if (idx === -1) idx = 0
  var nextIdx = (idx + direction + values.length) % values.length
  state.selected[field] = values[nextIdx]

  if (field === 'category') {
    var available = getTriggerValues(rules, state)
    if (available.indexOf(state.selected.trigger) === -1) state.selected.trigger = ''
  }
}

function renderCell(label, value, active) {
  var text = value || '`' + label + '`'
  if (active) return '**[' + text + ']**'
  return text
}

function renderControlLine(rules, state, parsedLine) {
  var categoryText = state.selected.category || ''
  var trig = state.selected.trigger || ''
  var trigItem = trig ? getItemByTrigger(rules, trig) : null
  var triggerText = trigItem ? trigItem.label : ''

  var catCell = renderCell('категория', categoryText, state.activeField === 0)
  var trigCell = renderCell('триггер', triggerText, state.activeField === 1)

  return parsedLine.indent + catCell + ' ' + trigCell
}

function hydrateFromParsedLine(rules, state, parsedLine) {
  var text = String(parsedLine.text || '').trim()
  var m = text.match(/`([^`]+)`/)
  if (!m) return
  var trigger = m[1]
  var it = getItemByTrigger(rules, trigger)
  if (!it) return
  state.selected.trigger = it.trigger
  state.selected.category = it.category || ''
}

function buildOutput(state) {
  var trigger = String(state.selected.trigger || '').trim()
  if (!trigger) return ''
  return '`' + trigger + '`'
}

module.exports = {
  parseRulesFromMarkdown: parseRulesFromMarkdown,
  validateRules: validateRules,
  parseLine: parseLine,
  makeInitialState: makeInitialState,
  nextField: nextField,
  cycleValue: cycleValue,
  renderControlLine: renderControlLine,
  hydrateFromParsedLine: hydrateFromParsedLine,
  buildOutput: buildOutput,
  getCategoryValues: getCategoryValues,
  getTriggerValues: getTriggerValues
}
