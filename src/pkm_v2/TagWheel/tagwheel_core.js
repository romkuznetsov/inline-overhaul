function err(msg) {
  throw new Error('[tagwheel] ' + msg)
}

/* Свои модули — литеральным `require`: путь в переменной сборка не
   разрешает (У-89, A33, У-90). */
var __sharedUtils = require('../../core/shared_utils.js')
var __statusLineRuntimeUnified = require('../../core/status_line_runtime_unified.js')
var __rulesRuntimeHelpers = require('../../core/pkm_rules_runtime_helpers.js')
var __tokenGraphUnified = require('../../core/token_graph_unified.js')
var __pkmDomainRegistry = require('../../core/pkm_domain_registry.js')
var __statusRuntimeCommonMod = require('../../core/status_runtime_common.js')
var __linePipeline = require('../../core/line_pipeline.js')

function getSharedUtils() {
  return __sharedUtils
}

function getStatusLineRuntimeUnified() {
  return __statusLineRuntimeUnified
}

function getRulesRuntimeHelpers() {
  return __rulesRuntimeHelpers
}

function getTokenGraphUnified() {
  return __tokenGraphUnified
}

function getDomainRegistry() {
  return __pkmDomainRegistry
}

function getStatusRuntimeCommon() {
  return __statusRuntimeCommonMod
}

function resolveSourceKind(field) {
  var helpers = getRulesRuntimeHelpers()
  if (!helpers || typeof helpers.normalizeFieldSourceKind !== 'function') {
    throw new Error('pkm_rules_runtime_helpers unavailable: normalizeFieldSourceKind')
  }
  return String(helpers.normalizeFieldSourceKind(field) || '').trim() || 'none'
}

/* Какие виды источника ссылочные — решает общий дом, спрашивается готовый
   ответ (10.13.161). */
function isProjectsSourceField(field) {
  return getRulesHelpersOrThrow().isProjectsSourceField(field)
}

function isWikilinkSourceField(field) {
  return getRulesHelpersOrThrow().isWikilinkSourceField(field)
}

function isSourceDrivenField(field) {
  return getRulesHelpersOrThrow().isSourceDrivenField(field)
}

/* Не приехали — падаем громко (A33, У-90). Приставка `get` — по ней мера
   копий (`tools/rule_copies.js`) узнаёт доставалку (У-191). */
function getRulesHelpersOrThrow() {
  var helpers = getRulesRuntimeHelpers()
  if (!helpers || typeof helpers.isProjectsSourceField !== 'function') {
    throw new Error('pkm_rules_runtime_helpers unavailable: isProjectsSourceField')
  }
  return helpers
}

function getPrimaryFieldIds(mode) {
  var fields = mode && Array.isArray(mode.fields) ? mode.fields : []
  var primaries = []
  var i
  for (i = 0; i < fields.length; i++) {
    var f = fields[i]
    if (!f) continue
    if (String(f.dependsOn || '').trim()) continue
    if (isProjectsSourceField(f)) continue
    primaries.push(String(f.id || '').trim())
  }
  var subs = fields.filter(function (f) { return !!(f && String(f.dependsOn || '').trim()) })
  return {
    first: String(primaries[0] || '').trim(),
    second: String(primaries[1] || '').trim(),
    third: String(primaries[2] || '').trim(),
    firstSub: String(subs[0] && subs[0].id || '').trim(),
    secondSub: String(subs[1] && subs[1].id || '').trim(),
  }
}

function resolvePrefixBehaviorShared(rules, state, deps) {
  var d = deps && typeof deps === 'object' ? deps : {}
  var candidate = d.prefixShared
  if (!candidate && state && typeof state === 'object' && state.__prefixShared && typeof state.__prefixShared === 'object') {
    candidate = state.__prefixShared
  }
  if (!candidate && rules && typeof rules === 'object' && rules.__prefixShared && typeof rules.__prefixShared === 'object') {
    candidate = rules.__prefixShared
  }
  return candidate
}

function isObj(x) {
  /* Одно объявление — `shared_utils.js` (10.13.135). */
  return __sharedUtils.isObj(x);
}

function ensureStatusRuntimeCommonFns() {
  if (globalThis.__inlineStatusRuntimeCommonFns && typeof globalThis.__inlineStatusRuntimeCommonFns === 'object') return globalThis.__inlineStatusRuntimeCommonFns
  var mod = getStatusRuntimeCommon()
  /* Отказ громкий, с именем модуля (10.13.166). */
  if (!mod || typeof mod.createStatusRuntimeCommon !== 'function') {
    throw new Error('status_runtime_common unavailable: createStatusRuntimeCommon')
  }
  /* Нормализатор ключа и `isObj` фабрика берёт у дома сама (10.13.168). */
  var fns = mod.createStatusRuntimeCommon({
    defaultPanel: 'left',
    loadRuntimePreloadFacade: async function () { return null }
  })
  globalThis.__inlineStatusRuntimeCommonFns = fns
  return fns
}

function getDateLikeMarkers(rules) {
  var out = []
  var seen = {}
  var helpers = getRulesRuntimeHelpers()
  var i
  /* Пустой список — «дат нет», не «дом не приехал» (10.13.167). */
  if (!helpers || typeof helpers.getDateMarkersFromRules !== 'function') {
    throw new Error('pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules')
  }
  var markers = helpers.getDateMarkersFromRules(rules)
  var buckets = [
    markers && markers.due,
    markers && markers.start,
    markers && markers.time,
  ]
  var j
  for (i = 0; i < buckets.length; i++) {
    var arr = Array.isArray(buckets[i]) ? buckets[i] : []
    for (j = 0; j < arr.length; j++) {
      var mkShared = String(arr[j] || '').trim()
      if (!mkShared || seen[mkShared]) continue
      seen[mkShared] = true
      out.push(mkShared)
    }
  }

  /* `rules.dates.markers` не пишет никто — не читаем (10.13.158). */
  return out
}

function isDateLikeOrBareDateToken(token, rules) {
  var src = String(token || '').trim()
  if (!src) return false
  var markers = getDateLikeMarkers(rules)
  if (!markers || !markers.length) {
    markers = []
    var right = rules && rules.rightMode ? rules.rightMode : null
    var fields = right && Array.isArray(right.fields) ? right.fields : []
    var mi0
    for (mi0 = 0; mi0 < fields.length; mi0++) {
      var mf = fields[mi0]
      if (!mf) continue
      var mk0 = getFieldMarkerByRuntimeCfg(rules, mf)
      if (!mk0) continue
      if (markers.indexOf(mk0) === -1) markers.push(mk0)
    }
  }
  /* Без запасной копии правила: была недостижима (У-146, У-56); не приехал
     модуль — падаем громко (A33, У-90). */
  var helpers = getRulesRuntimeHelpers()
  if (!helpers || typeof helpers.isDateLikeToken !== 'function') {
    throw new Error('pkm_rules_runtime_helpers unavailable: isDateLikeToken')
  }
  if (helpers.isDateLikeToken(src, { markers: markers })) return true
  return /^\d{4}-\d{2}-\d{2}$/.test(src) || /^\d{2}:\d{2}$/.test(src)
}

/* Правила приезжают из настроек (`Rules data`, 10.13.52, П-8); досыпка формы —
   `normalizeMode` из `src/core/tagwheel_rules_normalizer.js` через
   `buildRulesForEngines` (У-32). */

function validateRules(rules) {
  if (!isObj(rules)) err('Rules must be object')
  if (!isObj(rules.io)) err('io section is required')
  if (typeof rules.io.separator1 !== 'string' || !rules.io.separator1) err('io.separator1 must be non-empty string')
  if (typeof rules.io.separator2 !== 'string' || !rules.io.separator2) err('io.separator2 must be non-empty string')

  if (rules.inlineLayout !== undefined && !isObj(rules.inlineLayout)) err('inlineLayout must be object when provided')
  if (isObj(rules.inlineLayout) && rules.inlineLayout.techOrder !== undefined && !Array.isArray(rules.inlineLayout.techOrder)) {
    err('inlineLayout.techOrder must be array when provided')
  }

  if (!isObj(rules.behavior)) err('behavior section is required')
  if (typeof rules.behavior.defaultMode !== 'string') err('behavior.defaultMode must be string')
  if (rules.behavior.defaultMode !== 'left' && rules.behavior.defaultMode !== 'right') {
    err('behavior.defaultMode must be left or right')
  }

  /* Оба списка ищут родителя в обоих: разбор у `validateMode`. */
  var leftScope = Array.isArray(rules.leftMode && rules.leftMode.fields) ? rules.leftMode.fields : []
  var rightScope = Array.isArray(rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : []
  validateMode(rules.leftMode, 'leftMode', leftScope.concat(rightScope))
  validateMode(rules.rightMode, 'rightMode', leftScope.concat(rightScope))

  if (!isObj(rules.projects)) err('projects section is required')
  if (rules.projects.items !== undefined && !Array.isArray(rules.projects.items)) err('projects.items must be array when provided')
  if (rules.projects.defaults !== undefined && !Array.isArray(rules.projects.defaults)) err('projects.defaults must be array when provided')
  if (rules.projects.default !== undefined && !Array.isArray(rules.projects.default)) err('projects.default must be array when provided')
  if (rules.projects.rules !== undefined && !Array.isArray(rules.projects.rules)) err('projects.rules must be array when provided')
  if (rules.projects.byContext !== undefined && !isObj(rules.projects.byContext)) err('projects.byContext must be object when provided')
}

function getTechOrder(rules) {
  var il = rules && isObj(rules.inlineLayout) ? rules.inlineLayout : {}
  var raw = Array.isArray(il.techOrder) ? il.techOrder : null
  if (!raw || !raw.length) {
    var profile = getPrimaryFieldIds(rules && rules.leftMode)
    var out = [
      String(profile.first || '').trim(),
      String(profile.second || '').trim(),
      String(profile.third || '').trim(),
      'otherTags'
    ].filter(Boolean)
    return out.length ? out : ['otherTags']
  }
  return raw.slice()
}

function normalizeTechOrderSlot(slot, rules) {
  var key = String(slot || '').trim()
  if (!key) return ''
  if (key === 'otherTags') return key
  var leftFields = Array.isArray(rules && rules.leftMode && rules.leftMode.fields) ? rules.leftMode.fields : []
  var rightFields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : []
  var fields = leftFields.concat(rightFields)
  var f = fields.find(function (x) { return x && String(x.id || '').trim() === key })
  if (f && String(f.orderKey || '').trim()) return String(f.orderKey || '').trim()
  return key
}

function getKeepUnknownTags(rules) {
  var il = rules && isObj(rules.inlineLayout) ? rules.inlineLayout : {}
  return il.keepUnknownTags !== false
}


/* Пара «родитель и ребёнок» объявлена один раз — в общем модуле (У-150). */
function splitCombinedTagToken(tag) {
  return __sharedUtils.splitCombinedTagToken(tag)
}

function buildPanelGroupsFromTechOrder(rules, mode, panelName) {
  var panel = panelName === 'right' ? 'right' : 'left'
  var primaryMode = panel === 'right' ? rules.rightMode : mode
  var secondaryMode = panel === 'right' ? rules.leftMode : rules.rightMode
  var groups = []
  var used = {}
  var techOrder = getTechOrder(rules)
  var orderCfg = isObj(rules && rules.behavior && rules.behavior.order) ? rules.behavior.order : {}
  var thisOrderSet = {}
  var otherOrderSet = {}
  var thisArr = Array.isArray(panel === 'right' ? orderCfg.right : orderCfg.left)
    ? (panel === 'right' ? orderCfg.right : orderCfg.left)
    : []
  var otherArr = Array.isArray(panel === 'right' ? orderCfg.left : orderCfg.right)
    ? (panel === 'right' ? orderCfg.left : orderCfg.right)
    : []
  var oi
  for (oi = 0; oi < thisArr.length; oi++) thisOrderSet[String(thisArr[oi] || '')] = true
  for (oi = 0; oi < otherArr.length; oi++) otherOrderSet[String(otherArr[oi] || '')] = true
  var hasOrderPanels = thisArr.length > 0 || otherArr.length > 0

  var allFields = []
  var seenAll = {}
  function pushFieldFromMode(field) {
    if (!field || !field.id) return
    if (seenAll[field.id]) return
    seenAll[field.id] = true
    allFields.push(field)
  }
  var ai
  var pFields = primaryMode && Array.isArray(primaryMode.fields) ? primaryMode.fields : []
  var sFields = secondaryMode && Array.isArray(secondaryMode.fields) ? secondaryMode.fields : []
  for (ai = 0; ai < pFields.length; ai++) pushFieldFromMode(pFields[ai])
  for (ai = 0; ai < sFields.length; ai++) pushFieldFromMode(sFields[ai])

  function getFieldByIdAny(fieldId) {
    var i
    for (i = 0; i < allFields.length; i++) {
      if (allFields[i] && allFields[i].id === fieldId) return allFields[i]
    }
    return null
  }

  function getFieldBySourceAny(source) {
    var i
    for (i = 0; i < allFields.length; i++) {
      var f = allFields[i]
      if (f && f.source === source) return f
    }
    return null
  }

  function parentFieldFor(field) {
    if (!field || !field.dependsOn) return null
    var pi
    for (pi = 0; pi < allFields.length; pi++) {
      var pf = allFields[pi]
      if (!pf) continue
      if (String(pf.id || '') === String(field.dependsOn || '')) return pf
    }
    return null
  }

  /*
   * Стоит ли Field в Block своим ключом (10.13.4, Н-1). `dependsOn` двузначен:
   * у `_sub` ключа в Block нет — идёт за родителем; у Field с предусловием
   * ключ свой, и Block берётся по нему, иначе Field пропадает из обеих панелей.
   */
  function ownOrderKeyPlaced(field) {
    var ownKey = String(field && field.orderKey || '').trim()
    if (!ownKey) return false
    return !!(thisOrderSet[ownKey] || otherOrderSet[ownKey])
  }

  function allowInPanel(field) {
    if (!field) return false
    var explicitPanel = String(field.panel || '').trim().toLowerCase()
    if (explicitPanel && explicitPanel !== panel) return false
    if (field.orderKey && otherOrderSet[String(field.orderKey || '')]) return false
    if (!hasOrderPanels) return true
    if (field.dependsOn && !ownOrderKeyPlaced(field)) {
      var parent = parentFieldFor(field)
      if (!parent) return false
      var pKey = String(parent.orderKey || '').trim()
      if (pKey && thisOrderSet[pKey]) return true
      if (pKey && otherOrderSet[pKey]) return false
      return false
    }
    var key = String(field.orderKey || '').trim()
    if (key && thisOrderSet[key]) return true
    if (key && otherOrderSet[key]) return false
    return false
  }

  function pushGroup(fields, hideWhenDisabled, placeholderOverride) {
    var existing = []
    var i
    for (i = 0; i < fields.length; i++) {
      var fid = fields[i]
      var f = getFieldByIdAny(fid)
      if (!f) continue
      if (!allowInPanel(f)) continue
      existing.push(fid)
      used[fid] = true
    }
    if (!existing.length) return
    var first = getFieldByIdAny(existing[0])
    groups.push({
      id: existing[0],
      placeholder: placeholderOverride || (first && first.placeholder ? first.placeholder : existing[0]),
      fields: existing,
      hideWhenDisabled: hideWhenDisabled === true
    })
  }

  function pushFieldGroup(field, hideWhenDisabled, placeholderOverride) {
    if (!field || !field.id) return
    if (used[field.id]) return
    if (!allowInPanel(field)) return
    groups.push({
      id: field.id,
      placeholder: placeholderOverride || field.placeholder || field.id,
      fields: [field.id],
      hideWhenDisabled: hideWhenDisabled === true
    })
    used[field.id] = true
  }

  function pushChildrenForParent(parentId) {
    var j
    for (j = 0; j < allFields.length; j++) {
      var child = allFields[j]
      if (!child || used[child.id]) continue
      if (String(child.dependsOn || '') !== String(parentId || '')) continue
      if (!allowInPanel(child)) continue
      pushFieldGroup(child, true, child.placeholder || 'sub')
    }
  }

  function pushFieldsByOrderKeyStrict(orderKey) {
    var k = normalizeTechOrderSlot(orderKey)
    if (!k) return
    var i
    for (i = 0; i < allFields.length; i++) {
      var f = allFields[i]
      if (!f || used[f.id]) continue
      if (String(f.orderKey || '').trim() !== k) continue
      if (f.dependsOn) continue
      pushFieldGroup(f, false)
      pushChildrenForParent(f.id)
    }
    for (i = 0; i < allFields.length; i++) {
      var dep = allFields[i]
      if (!dep || used[dep.id]) continue
      if (String(dep.orderKey || '').trim() !== k) continue
      /* `sub` — только дочернему; Field с предусловием — своим именем
         (см. `ownOrderKeyPlaced`). */
      var depIsChild = !!dep.dependsOn && !ownOrderKeyPlaced(dep)
      pushFieldGroup(dep, !!dep.dependsOn, depIsChild ? (dep.placeholder || 'sub') : dep.placeholder)
      /* Дочерний Field с предусловием — рядом с ним, не в хвосте (цикл 95). */
      pushChildrenForParent(dep.id)
    }
  }

  var i
  if (hasOrderPanels && thisArr.length) {
    for (i = 0; i < thisArr.length; i++) {
      pushFieldsByOrderKeyStrict(thisArr[i])
    }
  } else {
    var project = getFieldBySourceAny('projects')
    var projectId = project && project.id ? project.id : ''
    var projectInOtherPanel = project && (
      String(project.panel || '').trim().toLowerCase() === (panel === 'right' ? 'left' : 'right') ||
      otherOrderSet.project === true
    )
    for (i = 0; i < techOrder.length; i++) {
      var slot = techOrder[i]
      if (slot === 'otherTags' && projectId && !projectInOtherPanel) {
        pushGroup([projectId])
      } else {
        pushFieldsByOrderKeyStrict(slot)
      }
    }
  }

  for (i = 0; i < allFields.length; i++) {
    var f = allFields[i]
    if (!f || used[f.id]) continue
    if (f.dependsOn) continue
    if (!allowInPanel(f)) continue
    pushFieldGroup(f, false)
    pushChildrenForParent(f.id)
  }

  for (i = 0; i < allFields.length; i++) {
    var rest = allFields[i]
    if (!rest || used[rest.id]) continue
    if (!allowInPanel(rest)) continue
    groups.push({ id: rest.id, placeholder: rest.placeholder || rest.id, fields: [rest.id] })
    used[rest.id] = true
  }

  var strictGroups = []
  for (i = 0; i < groups.length; i++) {
    var g = groups[i]
    var ids = []
    var gi
    var srcFields = g && Array.isArray(g.fields) ? g.fields : []
    for (gi = 0; gi < srcFields.length; gi++) {
      var gf = getFieldByIdAny(srcFields[gi])
      if (!allowInPanel(gf)) continue
      ids.push(srcFields[gi])
    }
    if (!ids.length) continue
    strictGroups.push({
      id: ids[0],
      placeholder: g && g.placeholder ? g.placeholder : ids[0],
      fields: ids,
      hideWhenDisabled: !!(g && g.hideWhenDisabled)
    })
  }

  return strictGroups
}

/*
 * `scopeFields` — где искать предусловие `dependsOn` (10.13.4, Н24): оба
 * списка — они разложены по типу, а не по Block. Граница открыта в обе
 * стороны, как в `reconcileModeDependencies` (цикл 93): иначе один стирает
 * связь, а второй бросает. `dependsOn` в никуда — отказ.
 */
function validateMode(mode, modeName, scopeFields) {
  var fieldIds = {}
  var i
  for (i = 0; i < mode.fields.length; i++) {
    var f = mode.fields[i]
    if (fieldIds[f.id]) err(modeName + '.fields duplicate id: ' + f.id)
    fieldIds[f.id] = true
  }
  var depIds = {}
  var scope = Array.isArray(scopeFields) ? scopeFields : mode.fields
  for (i = 0; i < scope.length; i++) {
    var sf = scope[i]
    if (sf && sf.id) depIds[sf.id] = true
  }
  for (i = 0; i < mode.fields.length; i++) {
    var field = mode.fields[i]
    if (field.dependsOn && !depIds[field.dependsOn]) {
      err(modeName + '.fields[' + field.id + '].dependsOn references missing field: ' + field.dependsOn)
    }
  }
}

function getMode(rules, modeName) {
  return modeName === 'right' ? rules.rightMode : rules.leftMode
}

function getFieldById(mode, fieldId) {
  var i
  for (i = 0; i < mode.fields.length; i++) {
    if (mode.fields[i].id === fieldId) return mode.fields[i]
  }
  return null
}

function getDateOffsetFallbackMarker(rules, field) {
  if (field && typeof field.marker === 'string' && field.marker) return field.marker
  var right = rules && rules.rightMode ? rules.rightMode : null
  var fields = right && Array.isArray(right.fields) ? right.fields : []
  var i
  for (i = 0; i < fields.length; i++) {
    var f = fields[i]
    if (!f || f.kind !== 'dateOffset') continue
    if (typeof f.marker === 'string' && f.marker) return f.marker
  }
  return ''
}

/* «Правый груз или текст» — в `line_pipeline.js`, копий здесь нет (У-90). */
function getFieldIndexById(mode, fieldId) {
  var i
  for (i = 0; i < mode.fields.length; i++) {
    if (mode.fields[i].id === fieldId) return i
  }
  return -1
}

function getFirstEnabledFieldIndex(mode, state, rules) {
  var i
  for (i = 0; i < mode.fields.length; i++) {
    if (isFieldEnabled(mode, state, mode.fields[i], rules)) return i
  }
  return 0
}

function getEnabledFieldIndexById(mode, state, fieldId, rules) {
  if (!fieldId) return -1
  var idx = getFieldIndexById(mode, fieldId)
  if (idx === -1) return -1
  if (!isFieldEnabled(mode, state, mode.fields[idx], rules)) return -1
  return idx
}

function getLeadFieldIdByOrderKey(mode, state, orderKey, rules) {
  var key = String(orderKey || '').trim()
  if (!key) return ''
  var i
  for (i = 0; i < mode.fields.length; i++) {
    var f = mode.fields[i]
    if (!f) continue
    var candidateOrderKey = String(f.orderKey || f.id || '').trim()
    if (!candidateOrderKey || candidateOrderKey !== key) continue
    if (!isFieldEnabled(mode, state, f, rules)) continue
    return String(f.id || '').trim()
  }
  return ''
}

/** Выбор «на каком Field открывать панель» — в правила (10.13.76); пусто = `first`. */
function applyActiveFieldChoiceToRules(rules, choice) {
  if (!rules || typeof rules !== 'object') return rules
  var src = isObj(choice) ? choice : {}
  var mode = String(src.mode || '').trim().toLowerCase()
  if (mode !== 'middle' && mode !== 'custom') mode = 'first'
  var ui = isObj(rules.ui) ? rules.ui : {}
  ui.activeField = {
    mode: mode,
    left: String(src.left || '').trim(),
    right: String(src.right || '').trim()
  }
  rules.ui = ui
  return rules
}

/**
 * Ведущее поле при открытии: `first` (умолчание), `middle` — индекс
 * `ceil(n / 2) - 1`, `custom` — названное. По видимым полям, не по списку
 * правил (10.13.69, Т-8).
 */
function activeFieldChoiceMode(rules) {
  var ui = isObj(rules && rules.ui) ? rules.ui : {}
  var choice = isObj(ui.activeField) ? ui.activeField : {}
  var mode = String(choice.mode || 'first').trim().toLowerCase()
  return mode === 'middle' || mode === 'custom' ? mode : 'first'
}

function chooseActiveFieldId(rules, modeName, visible) {
  var list = Array.isArray(visible) ? visible : []
  if (!list.length) return ''
  var ui = isObj(rules && rules.ui) ? rules.ui : {}
  var choice = isObj(ui.activeField) ? ui.activeField : {}
  var mode = activeFieldChoiceMode(rules)
  if (mode === 'custom') {
    return String(choice[modeName === 'right' ? 'right' : 'left'] || '').trim()
  }
  if (mode === 'middle') {
    var idx = Math.ceil(list.length / 2) - 1
    if (idx < 0) idx = 0
    return String(list[idx] || '')
  }
  /* `first` — ответ, а не молчание, иначе решает старый ключ правил (S5). */
  return String(list[0] || '')
}

function resolveInitialActiveField(rules, state, modeName) {
  var mode = getMode(rules, modeName)
  if (!mode.fields.length) return 0

  /*
   * Неназванное активное поле берётся из видимых (по Order), а не индексом
   * списка по типу — множества разные (2026-09-12). Названное настройкой —
   * остаётся и невидимым: догадка спрашивает панель, явный выбор — нет (У-33).
   */
  var visible = getNavigableFieldSequence(rules, state)
  var pick = function (fieldId) {
    var fid = String(fieldId || '').trim()
    if (!fid) return -1
    var idx = getEnabledFieldIndexById(mode, state, fid, rules)
    if (idx === -1) return -1
    state.activeFieldId = fid
    return idx
  }

  /* Выбор человека — первым (10.13.76); `behavior.order.lead` писать некому
     (10.13.69, Т-5), но у кого он проставлен руками — работает. */
  var chosenId = chooseActiveFieldId(rules, modeName, visible)
  var chosenIsNamed = activeFieldChoiceMode(rules) === 'custom'
  /* Порядок: `A Field you choose`, затем `lead`, затем посчитанное (У-33). */
  if (!chosenIsNamed) {
    var behaviorEarly = isObj(rules.behavior) ? rules.behavior : {}
    var orderEarly = isObj(behaviorEarly.order) ? behaviorEarly.order : {}
    var leadEarly = isObj(orderEarly.lead) ? orderEarly.lead : {}
    var leadKeyEarly = String(leadEarly[modeName] || '').trim()
    if (leadKeyEarly) {
      var leadIdxEarly = pick(getLeadFieldIdByOrderKey(mode, state, leadKeyEarly, rules))
      if (leadIdxEarly !== -1) return leadIdxEarly
    }
  }
  if (chosenId) {
    var chosenIdx = pick(chosenId)
    if (chosenIdx !== -1) return chosenIdx
    /* Видимый, но не в списке по типу (элемент слева) — решает имя (10.13.69, Т-8). */
    if (visible.indexOf(chosenId) !== -1) {
      state.activeFieldId = chosenId
      return 0
    }
  }

  var behavior = isObj(rules.behavior) ? rules.behavior : {}
  var order = isObj(behavior.order) ? behavior.order : {}
  var lead = isObj(order.lead) ? order.lead : {}
  var leadOrderKey = String(lead[modeName] || '').trim()
  if (leadOrderKey) {
    var leadIdx = pick(getLeadFieldIdByOrderKey(mode, state, leadOrderKey, rules))
    if (leadIdx !== -1) return leadIdx
  }

  var ui = isObj(rules.ui) ? rules.ui : {}
  var activation = isObj(ui.activationFocus) ? ui.activationFocus : {}
  var modeCfg = isObj(activation[modeName]) ? activation[modeName] : {}

  if (modeName === 'left') {
    var preferChild = isObj(modeCfg.preferChildWhenParentSelected)
      ? modeCfg.preferChildWhenParentSelected
      : null
    if (preferChild && preferChild.enabled !== false) {
      var defaultParentId = ''
      var defaultChildId = ''
      var dfi
      for (dfi = 0; dfi < mode.fields.length; dfi++) {
        var childCandidate = mode.fields[dfi]
        if (!childCandidate) continue
        var parentCandidateId = String(childCandidate.dependsOn || '').trim()
        if (!parentCandidateId) continue
        var parentIdx = getFieldIndexById(mode, parentCandidateId)
        if (parentIdx === -1) continue
        var parentField = mode.fields[parentIdx]
        if (isWikilinkSourceField(parentField)) continue
        defaultParentId = parentCandidateId
        defaultChildId = String(childCandidate.id || '').trim()
        break
      }
      var parentFieldId = typeof preferChild.parentFieldId === 'string' && preferChild.parentFieldId
        ? preferChild.parentFieldId
        : defaultParentId
      var childFieldId = typeof preferChild.childFieldId === 'string' && preferChild.childFieldId
        ? preferChild.childFieldId
        : defaultChildId
      if (state.selected[parentFieldId]) {
        var childIdx = pick(childFieldId)
        if (childIdx !== -1) return childIdx
      }
    }
  }

  var defaultFieldId = typeof modeCfg.defaultFieldId === 'string' && modeCfg.defaultFieldId
    ? modeCfg.defaultFieldId
    : ''
  if (defaultFieldId) {
    var idx = pick(defaultFieldId)
    if (idx !== -1) return idx
  }

  if (visible.length) {
    var firstIdx = pick(visible[0])
    if (firstIdx !== -1) return firstIdx
    state.activeFieldId = String(visible[0] || '')
    return 0
  }

  return markActiveFieldId(mode, state, getFirstEnabledFieldIndex(mode, state, rules))
}
function markActiveFieldId(mode, state, index) {
  var i = Number(index)
  if (!state || !isFinite(i) || i < 0) return index
  var fields = mode && Array.isArray(mode.fields) ? mode.fields : []
  var field = fields[i]
  if (field && field.id) state.activeFieldId = String(field.id)
  return index
}

/**
 * Разбор строки: границы зон — у `line_pipeline` (строка только с правым
 * Block `-  :: 👤111`, исключения 45 и 62 к З3; 2026-09-12, У-150). Своё здесь —
 * раскладка левого сегмента на теги, значения элементов и текст.
 */
function parseLine(rawLine, rules) {
  var line = String(rawLine || '')
  var seg = __linePipeline.splitSegments(line, rules)
  var indent = String(seg && seg.indent || '')
  var leftBody = String(seg && seg.left || '').trim()

  /*
   * Начало строки — у общего объявления `lineStartOf` (10.13.94, 10.13.118,
   * У-91, В-115): у Obsidian `#### [ ] test` — заголовок с текстом `[ ] test`,
   * не чекбокс; цитата и номер со скобкой — тоже начало строки.
   */
  var lineStart = __sharedUtils.lineStartOf(leftBody)
  var headingToken = String(lineStart.heading || '').trim()
  var bulletToken = String(lineStart.marker || '').trim()
  var checkboxToken = String(lineStart.checkbox || '').trim()
  /* Цитату `splitSegments` уже сняла в отступ — берём оттуда. */
  var indentStart = __sharedUtils.lineStartOf(indent)
  var quoteToken = String(lineStart.quote || '') + String(lineStart.callout || '')
    || (String(indentStart.quote || '') + String(indentStart.callout || ''))
  if (lineStart.at > 0) leftBody = String(lineStart.body || '')

  /* Левый сегмент: тег, значение элемента или текст. `values` — значения в
     порядке строки, то есть левый Block как есть. */
  function classifyLeftPartTokens(raw) {
    var src = String(raw || '').trim()
    var out = { tags: [], dates: [], text: [], values: [] }
    if (!src) return out
    var parts = __sharedUtils.lineWords(src)
    /* Ссылка — значение, только если названа значением (В-141, У-164);
       признак общий с командами. */
    var isLinkValue = __rulesRuntimeHelpers.makeWikilinkValueTest(rules)
    var i
    for (i = 0; i < parts.length; i++) {
      var t = String(parts[i] || '').trim()
      if (!t) continue
      if (__sharedUtils.isTagToken(t) || isLinkValue(t)) {
        out.tags.push(t)
        out.values.push(t)
        continue
      }
      if (isDateLikeOrBareDateToken(t, rules)) {
        out.dates.push(t)
        out.values.push(t)
        continue
      }
      out.text.push(t)
    }
    return out
  }

  var leftClassified = classifyLeftPartTokens(leftBody)
  var tags = leftClassified.tags.slice()
  var text = String(seg && seg.text || '').trim()
  var dates = String(seg && seg.dates || '').trim()

  if (leftClassified.text.length) {
    var leftText = leftClassified.text.join(' ').trim()
    if (leftText) text = (leftText + ' ' + text).trim()
  }
  if (leftClassified.dates.length) {
    var leftDates = leftClassified.dates.join(' ').trim()
    if (leftDates) dates = (leftDates + ' ' + dates).trim()
  }

  /*
   * `tags`/`dates` — корзины узнавания (элемент слева тоже в `dates`), по Block
   * не разложены. `left`/`right` — сами Block в строке (10.13.87, S27).
   */
  return {
    indent: indent,
    headingToken: headingToken,
    /* Цитата и каллаут — впереди нашего знака: значение между `>` и
       `[!note]` ломает каллаут (В-115). */
    quoteToken: quoteToken,
    bulletToken: (headingToken || quoteToken) ? bulletToken : (bulletToken || '-'),
    checkboxToken: checkboxToken,
    left: leftClassified.values.join(' ').trim(),
    right: String(seg && seg.dates || '').trim(),
    tags: tags,
    text: text,
    dates: dates
  }
}

function extractTagLikeTokens(text) {
  var s = String(text || '').trim()
  if (!s) return []
  var parts = __sharedUtils.lineWords(s)
  var out = []
  var i
  for (i = 0; i < parts.length; i++) {
    var t = parts[i]
    if (__sharedUtils.isTagToken(t) || __sharedUtils.isWikilinkToken(t)) out.push(t)
  }
  return out
}

function makeInitialState(rules, modeName) {
  var selected = {}
  var i
  for (i = 0; i < rules.leftMode.fields.length; i++) selected[rules.leftMode.fields[i].id] = ''
  for (i = 0; i < rules.rightMode.fields.length; i++) selected[rules.rightMode.fields[i].id] = ''
  return {
    mode: modeName,
    activeField: 0,
    activeFieldId: '',
    selected: selected
  }
}

function getFieldModeById(rules, state, fieldId) {
  var pref = state && state.mode === 'right' ? [rules.rightMode, rules.leftMode] : [rules.leftMode, rules.rightMode]
  var mi
  for (mi = 0; mi < pref.length; mi++) {
    var m = pref[mi]
    var f = getFieldById(m, fieldId)
    if (f) return { mode: m, field: f }
  }
  return null
}

function buildPrefix(parsedLine, rules, state, deps) {
  var shared = resolvePrefixBehaviorShared(rules, state, deps)
  if (!shared || typeof shared.buildPrefixUnified !== 'function') {
    err('pkm_line_finalize_unified unavailable: buildPrefixUnified required')
  }
  return shared.buildPrefixUnified(parsedLine, rules, state, {
    isObj: isObj,
    getFieldById: getFieldById,
  })
}

/**
 * Поле включено человеком — без вопроса о предусловии (В-137). Спрашивают
 * `field_relocation.js` и `buildManagedTokenSet`; остальные — `isFieldEnabled`.
 */
function isFieldSwitchedOn(mode, state, field, rules) {
  if (field.enabled === false) return false
  var order = rules && isObj(rules.behavior) && isObj(rules.behavior.order) ? rules.behavior.order : {}
  var active = isObj(order.active) ? order.active : {}
  var orderKey = String(field && (field.orderKey || field.id) || '').trim()
  if (orderKey) {
    var activeRaw = String(active[orderKey] || '').trim().toLowerCase()
    if (activeRaw === 'no' || activeRaw === 'hotkey_only') return false
  }
  if (rules && (field.kind === 'dateOffset' || field.kind === 'nowTime' || field.kind === 'estimatedCycle' || field.kind === 'genericElement')) {
    var cfg = getDateRuntimeCfg(rules, field)
    if (cfg.activeMode === 'no' || cfg.activeMode === 'hotkey_only') return false
  }
  return true
}

function isFieldEnabled(mode, state, field, rules) {
  if (!isFieldSwitchedOn(mode, state, field, rules)) return false
  /*
   * Пока `Alt` открывает дочернее поле, родитель не нужен (`В-195`) — через
   * то же `freeOfParent`. Закрыл — поле снова ждёт родителя; выбранное не
   * пропадает (`collectSelectedTagEntries`).
   */
  var ask = field && field.freeOfParent !== true && altOpensChild(state, field)
    ? Object.assign({}, field, { freeOfParent: true })
    : field
  /* Предусловие — одно с командами, `pkm_rules_runtime_helpers.js` (2026-09-12). */
  return __rulesRuntimeHelpers.isFieldPrerequisiteMet(ask, state && state.selected, allRuleFields(rules))
}

/* Оба списка полей: навигатор ищется по всем (`В-222`). */
function allRuleFields(rules) {
  return [].concat(
    rules && rules.leftMode && Array.isArray(rules.leftMode.fields) ? rules.leftMode.fields : [],
    rules && rules.rightMode && Array.isArray(rules.rightMode.fields) ? rules.rightMode.fields : [])
}

function projectMatches(item, state) {
  var match = isObj(item.match) ? item.match : {}
  var keys = Object.keys(match)
  var i
  for (i = 0; i < keys.length; i++) {
    var key = keys[i]
    var allowed = match[key]
    var selected = state.selected[key] || ''
    if (!Array.isArray(allowed) || !allowed.length) continue
    if (!selected) return false
    if (allowed.indexOf(selected) === -1) return false
  }
  return true
}

function parseWikilink(raw) {
  return __sharedUtils.wikilinkTargetOf(raw)
}

function normalizeProjectEntry(item, fallbackId) {
  if (typeof item === 'string') {
    var wl = parseWikilink(item)
    var linkOnly = wl || String(item || '').trim()
    if (!linkOnly) return null
    return {
      id: fallbackId || linkOnly,
      token: linkOnly,
      label: linkOnly,
      link: linkOnly,
      allowedParentValues: null
    }
  }
  if (!isObj(item)) return null

  var fromWl = typeof item.wikilink === 'string' ? parseWikilink(item.wikilink) : ''
  var link = ''
  if (typeof item.link === 'string' && item.link) link = item.link
  else if (fromWl) link = fromWl
  else if (typeof item.token === 'string' && item.token) link = item.token
  else if (typeof item.label === 'string' && item.label) link = item.label
  else if (typeof item.id === 'string' && item.id) link = item.id
  link = String(link || '').trim()
  if (!link) return null

  var token = typeof item.token === 'string' && item.token ? item.token : link
  var id = typeof item.id === 'string' && item.id ? item.id : (fallbackId || link)
  var label = typeof item.label === 'string' && item.label ? item.label : link
  return {
    id: id,
    token: String(token || '').trim(),
    label: label,
    link: link,
    allowedParentValues: null
  }
}

function addProjectValue(bucket, seen, item, fallbackId) {
  var v = normalizeProjectEntry(item, fallbackId)
  if (!v || !v.id) return
  if (seen[v.id]) return
  seen[v.id] = true
  bucket.push(v)
}

function resolveProjectFilterKeys(projects, rules) {
  var configured = Array.isArray(projects && projects.filterKeys)
    ? projects.filterKeys.map(function(k) { return String(k || '').trim() }).filter(Boolean)
    : []
  if (configured.length) return configured

  var mode = rules && rules.leftMode && Array.isArray(rules.leftMode.fields)
    ? rules.leftMode
    : (rules && rules.rightMode && Array.isArray(rules.rightMode.fields) ? rules.rightMode : { fields: [] })
  var fields = mode && Array.isArray(mode.fields) ? mode.fields : []
  var projectField = null
  var i
  for (i = 0; i < fields.length; i++) {
    var f = fields[i]
    if (!f || !f.id) continue
    if (!isProjectsSourceField(f)) continue
    projectField = f
    break
  }
  if (!projectField) return []
  var out = []
  var first = String(projectField.dependsOn || '').trim()
  if (first) out.push(first)
  if (first) {
    for (i = 0; i < fields.length; i++) {
      var parent = fields[i]
      if (!parent || !parent.id) continue
      if (String(parent.id || '').trim() !== first) continue
      var second = String(parent.dependsOn || '').trim()
      if (second && out.indexOf(second) === -1) out.push(second)
      break
    }
  }
  return out
}

function getProjectFilterState(projects, state, rules) {
  var keys = resolveProjectFilterKeys(projects, rules)
  var selected = {}
  var hasAny = false
  var i
  for (i = 0; i < keys.length; i++) {
    var key = keys[i]
    var v = state && state.selected ? (state.selected[key] || '') : ''
    if (!v) continue
    selected[key] = v
    hasAny = true
  }
  return { keys: keys, selected: selected, hasAny: hasAny }
}

function collectContextProjects(out, seen, ctxEntry) {
  if (!isObj(ctxEntry)) return
  var branchList = Array.isArray(ctxEntry.branch) ? ctxEntry.branch : (Array.isArray(ctxEntry.projects) ? ctxEntry.projects : [])
  var i
  for (i = 0; i < branchList.length; i++) addProjectValue(out, seen, branchList[i], '')

  var leafMap = isObj(ctxEntry.leaf) ? ctxEntry.leaf : (isObj(ctxEntry.byNested) ? ctxEntry.byNested : {})
  var nestedKeys = Object.keys(leafMap)
  var j
  for (j = 0; j < nestedKeys.length; j++) {
    var nk = nestedKeys[j]
    var arr = Array.isArray(leafMap[nk]) ? leafMap[nk] : []
    var k
    for (k = 0; k < arr.length; k++) addProjectValue(out, seen, arr[k], '')
  }
}

function matchSelectedProjectFilters(when, selectedFilters) {
  var selKeys = Object.keys(selectedFilters || {})
  if (!selKeys.length) return true
  if (!isObj(when)) return false
  var i
  for (i = 0; i < selKeys.length; i++) {
    var key = selKeys[i]
    var selected = selectedFilters[key]
    var allowed = when[key]
    var arr = Array.isArray(allowed) ? allowed : [allowed]
    if (!arr.length) return false
    if (arr.indexOf(selected) === -1) return false
  }
  return true
}

function getProjectValues(rules, state) {
  var out = [{ id: '', token: '', allowedParentValues: null }]
  var seen = {}
  var projects = isObj(rules.projects) ? rules.projects : {}
  var items = Array.isArray(projects.items) ? projects.items : null
  var defaults = Array.isArray(projects.defaults) ? projects.defaults : (Array.isArray(projects.default) ? projects.default : [])
  var rulesList = Array.isArray(projects.rules) ? projects.rules : []
  var byContext = isObj(projects.byContext) ? projects.byContext : null
  var catalogArr = Array.isArray(projects.catalog) ? projects.catalog : []
  var catalog = {}
  var filterState = getProjectFilterState(projects, state, rules)
  var hasFilter = filterState.hasAny
  var includeDefaultsWhenFiltered = projects.includeDefaultsWhenFiltered === true
  var i

  for (i = 0; i < catalogArr.length; i++) {
    var cv = normalizeProjectEntry(catalogArr[i], '')
    if (cv && cv.id) catalog[cv.id] = cv
  }

  if (items && !byContext) {
    for (i = 0; i < items.length; i++) {
      var it = items[i]
      if (typeof it === 'string') {
        addProjectValue(out, seen, it, '')
        continue
      }
      if (!isObj(it) || typeof it.token !== 'string' || !it.token) continue
      if (!hasFilter || projectMatches(it, state)) {
        addProjectValue(out, seen, it, typeof it.id === 'string' ? it.id : it.token)
      }
    }
    return out
  }

  if (byContext) {
    if (!hasFilter || includeDefaultsWhenFiltered) {
      for (i = 0; i < defaults.length; i++) {
        var d0 = defaults[i]
        if (typeof d0 === 'string' && catalog[d0]) addProjectValue(out, seen, catalog[d0], d0)
        else addProjectValue(out, seen, d0, '')
      }
    }

    if (!hasFilter) {
      var allCtxKeys = Object.keys(byContext)
      for (i = 0; i < allCtxKeys.length; i++) {
        collectContextProjects(out, seen, byContext[allCtxKeys[i]])
      }
      return out
    }

    var selectedContext = ''
    var contextKeyIndex = -1
    var fk
    for (fk = 0; fk < filterState.keys.length; fk++) {
      var scopeKey = filterState.keys[fk]
      var scopeSelected = filterState.selected[scopeKey] || ''
      if (!scopeSelected) continue
      if (byContext[scopeSelected]) {
        selectedContext = scopeSelected
        contextKeyIndex = fk
        break
      }
    }
    if (selectedContext && byContext[selectedContext]) {
      var ctxEntry = byContext[selectedContext]
      var selectedNested = ''
      var leafMapScan = isObj(ctxEntry.leaf) ? ctxEntry.leaf : (isObj(ctxEntry.byNested) ? ctxEntry.byNested : {})
      var leafKeys = Object.keys(leafMapScan)
      if (contextKeyIndex !== -1) {
        for (fk = contextKeyIndex + 1; fk < filterState.keys.length; fk++) {
          var nestedKey = filterState.keys[fk]
          var nestedSelected = filterState.selected[nestedKey] || ''
          if (!nestedSelected) continue
          if (leafKeys.indexOf(nestedSelected) !== -1) {
            selectedNested = nestedSelected
            break
          }
        }
      }
      if (selectedNested) {
        var leafMap1 = isObj(ctxEntry.leaf) ? ctxEntry.leaf : (isObj(ctxEntry.byNested) ? ctxEntry.byNested : {})
        var leafList = Array.isArray(leafMap1[selectedNested]) ? leafMap1[selectedNested] : []
        var li
        for (li = 0; li < leafList.length; li++) addProjectValue(out, seen, leafList[li], '')
      } else {
        collectContextProjects(out, seen, ctxEntry)
      }
    }

    return out
  }

  if (!hasFilter || includeDefaultsWhenFiltered) {
    for (i = 0; i < defaults.length; i++) {
      var d = defaults[i]
      if (typeof d === 'string' && catalog[d]) addProjectValue(out, seen, catalog[d], d)
      else addProjectValue(out, seen, d, '')
    }
  }

  for (i = 0; i < rulesList.length; i++) {
    var rule = rulesList[i]
    if (!isObj(rule)) continue
    if (hasFilter && !matchSelectedProjectFilters(rule.when, filterState.selected)) continue
    var addList = Array.isArray(rule.add) ? rule.add : (Array.isArray(rule.projects) ? rule.projects : [])
    var j
    for (j = 0; j < addList.length; j++) {
      var p = addList[j]
      if (typeof p === 'string' && catalog[p]) addProjectValue(out, seen, catalog[p], p)
      else addProjectValue(out, seen, p, '')
    }
  }

  return out
}

/**
 * Значения поля, которые предлагает панель. `opts.ignoreParent` снимает только
 * отбор по родителю: при узнавании строки (В-137; годность решает
 * `sanitizeState`) и при `Add the parent Value`, где родителя дописали мы
 * (`parentValueEchoesChildValue`).
 */
function getAllowedValues(mode, state, field, rules, opts) {
  var ignoreParent = !!(opts && opts.ignoreParent)
  var base = isProjectsSourceField(field) ? getProjectValues(rules, state) : field.values
  var cfgValues = Array.isArray(field && field.values) ? field.values : []
  var allowedByField = {}
  var hasFieldCatalog = false
  var ci
  for (ci = 0; ci < cfgValues.length; ci++) {
    var cv = cfgValues[ci]
    if (!cv) continue
    var cid = String(cv.id || '')
    var ctoken = String(cv.token || '')
    if (cid) {
      allowedByField['id:' + cid] = true
      hasFieldCatalog = true
    }
    if (ctoken) {
      allowedByField['token:' + ctoken] = true
      hasFieldCatalog = true
    }
  }
  var out = []
  var parentValue = field.dependsOn ? (state.selected[field.dependsOn] || '') : ''
  var i

  for (i = 0; i < base.length; i++) {
    var v = base[i]
    if (v.id === '') {
      out.push(v)
      continue
    }
    if (hasFieldCatalog && !isSourceDrivenField(field)) {
      var keyId = 'id:' + String(v.id || '')
      var keyToken = 'token:' + String(v.token || '')
      if (!allowedByField[keyId] && !allowedByField[keyToken]) continue
    }
    if (!field.dependsOn) {
      out.push(v)
      continue
    }
    /* Родитель не выбран — все значения (2026-09-19); пустой список ломал
       чистку строки и давал двойную печать. */
    if (ignoreParent || !parentValue
      || !Array.isArray(v.allowedParentValues) || !v.allowedParentValues.length) {
      out.push(v)
      continue
    }
    if (v.allowedParentValues.indexOf(parentValue) !== -1) out.push(v)
  }
  return out
}

function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseIsoDate(s) {
  var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function getSessionNow(state) {
  if (state.__nowHHmm) return state.__nowHHmm
  var d = new Date()
  var h = String(d.getHours())
  var m = String(d.getMinutes())
  if (h.length < 2) h = '0' + h
  if (m.length < 2) m = '0' + m
  return h + ':' + m
}

function getSessionToday(state) {
  if (state.__todayIso) {
    var p = parseIsoDate(state.__todayIso)
    if (p) return p
  }
  return toDateOnly(new Date())
}

function getDateRuntimeCfg(rules, field) {
  var behavior = rules && isObj(rules.behavior) ? rules.behavior : {}
  var rt = behavior && isObj(behavior.dateRuntimeConfig) ? behavior.dateRuntimeConfig : {}
  var byField = rt && isObj(rt.byField) ? rt.byField : {}
  if (!Object.keys(byField).length && rt && isObj(rt.dates) && isObj(rt.dates.byField)) {
    byField = rt.dates.byField
  }
  var canonical = rt && isObj(rt.canonical) ? rt.canonical : {}
  var orderKey = String(field && field.orderKey || '').trim()
  var fieldId = String(field && field.id || '').trim()
  var key = ''
  if (orderKey) key = orderKey
  else if (field && field.kind === 'estimatedCycle') key = 'time_estimated'
  else if (field && field.kind === 'nowTime') key = 'time_now'
  else if (field && field.kind === 'genericElement') key = fieldId
  if (!key && fieldId && canonical) {
    var names = Object.keys(canonical)
    var i
    for (i = 0; i < names.length; i++) {
      var v = String(canonical[names[i]] || '').trim()
      if (v && v === fieldId) {
        key = v
        break
      }
    }
  }
  if (!key) return {
    activeMode: 'yes',
    format: field && field.kind === 'dateOffset' ? 'YYYY-MM-DD' : (field && field.kind === 'genericElement' ? '1' : 'HH:mm'),
    increment: { mode: 'standard', incrementBy: field && field.kind === 'dateOffset' ? 1 : (field && field.kind === 'genericElement' ? 1 : 5), command: 'now', custom: [], customRaw: [] }
  }
  var src = byField && isObj(byField[key]) ? byField[key] : {}
  if (!Object.keys(src).length && fieldId && byField && isObj(byField[fieldId])) {
    src = byField[fieldId]
  }
  var isTime = field && (field.kind === 'nowTime' || field.kind === 'estimatedCycle')
  var activeRaw = String(src.activeMode || src.active || 'yes').trim().toLowerCase()
  var activeMode = (activeRaw === 'no' || activeRaw === 'hotkey_only') ? activeRaw : 'yes'
  var inc = src.increment && isObj(src.increment) ? src.increment : {}
  var modeRaw = String(inc.mode || 'standard').trim().toLowerCase()
  var mode = (modeRaw === 'custom' || modeRaw === 'command') ? modeRaw : 'standard'
  var custom = Array.isArray(inc.custom) ? inc.custom.slice() : []
  var customRaw = Array.isArray(inc.customRaw) ? inc.customRaw.slice() : []
  var incrementBy = Math.max(0, Math.trunc(Number(inc.incrementBy || 0)))
  var command = String(inc.command || 'now').trim() || 'now'
  var isGeneric = field && field.kind === 'genericElement'
  var defaultFormat = isTime ? 'HH:mm' : (isGeneric ? '1' : 'YYYY-MM-DD')
  var hasOwnFormat = Object.prototype.hasOwnProperty.call(src, 'format')
  var out = {
    activeMode: activeMode,
    emoji: String(src.emoji || field && field.marker || '').trim(),
    format: hasOwnFormat ? String(src.format == null ? '' : src.format).trim() : defaultFormat,
    hotkey: {
      increase: String(src.hotkey && src.hotkey.increase || '').trim(),
      decrease: String(src.hotkey && src.hotkey.decrease || '').trim()
    },
    increment: {
      mode: mode,
      incrementBy: incrementBy > 0 ? incrementBy : (isTime ? 5 : 1),
      command: command,
      custom: custom,
      customRaw: customRaw
    }
  }
  return out
}

function getFieldMarkerByRuntimeCfg(rules, field) {
  var cfg = getDateRuntimeCfg(rules, field)
  var marker = String(cfg && cfg.emoji || '').trim()
  if (marker) return marker
  return String(field && field.marker || '').trim()
}

/* Тело — в `shared_utils`, общее с предпросмотром диалога (Н-3 ревизии 2026-10-03). */
function addByUnit(base, unit, delta) {
  return getSharedUtils().addByUnit(base, unit, delta)
}

function getReferenceDateForUnit(state, unit) {
  if (unit === 'second' || unit === 'minute' || unit === 'hour') return new Date()
  return getSessionToday(state)
}

/* Правило — в общем модуле, без своей копии (У-32, Д-4). */
function getSearchLimitByUnit(unit) {
  return ensureStatusRuntimeCommonFns().getSearchLimitByUnit(unit, getSharedUtils())
}

function formatNowByMask(mask) {
  var su = getSharedUtils()
  if (su && typeof su.formatNowByMask === 'function') return su.formatNowByMask(mask)
  throw new Error('shared_utils unavailable: formatNowByMask')
}

function renderCommandValueByFormat(format, commandRaw) {
  var su = getSharedUtils()
  if (su && typeof su.renderCommandValueByFormat === 'function') return su.renderCommandValueByFormat(format, commandRaw)
  throw new Error('shared_utils unavailable: renderCommandValueByFormat')
}

/* Без запасного `false`: он молча стирал бы значение человека (A33, У-90,
   У-137). Без `!!` — иначе мера копий считает делегат телом. */
function shouldHydrateGenericElementRaw(format, commandRaw, rawValue) {
  var su = getSharedUtils()
  if (su && typeof su.shouldHydrateGenericElementRaw === 'function') {
    return su.shouldHydrateGenericElementRaw(format, commandRaw, rawValue)
  }
  throw new Error('shared_utils unavailable: shouldHydrateGenericElementRaw')
}

function buildCustomPlan(cfg) {
  var su = getSharedUtils()
  if (su && typeof su.buildCustomPlanFromIncrement === 'function') return su.buildCustomPlanFromIncrement(cfg)
  throw new Error('shared_utils unavailable: buildCustomPlanFromIncrement')
}

function endTotal(cfg) {
  var plan = buildCustomPlan(cfg)
  if (!plan.hasEnd || !plan.steps.length) return null
  var i, total = 0
  for (i = 0; i < plan.steps.length; i++) total += Math.max(0, Math.trunc(Number(plan.steps[i] || 0)))
  return total
}

/** Дата по формату поля — общий дом (исключения № 136, № 138). */
function fmtDateByFormat(d, format) {
  var su = getSharedUtils()
  if (su && typeof su.formatDateByMask === 'function') return su.formatDateByMask(d, format)
  throw new Error('shared_utils unavailable: formatDateByMask')
}

function buildFormatValueRegexSource(format) {
  var su = getSharedUtils()
  if (su && typeof su.buildFormatValueRegexSource === 'function') return su.buildFormatValueRegexSource(format)
  throw new Error('shared_utils unavailable: buildFormatValueRegexSource')
}

function hasFormatTokens(format) {
  var su = getSharedUtils()
  if (su && typeof su.hasFormatTokens === 'function') return su.hasFormatTokens(format)
  throw new Error('shared_utils unavailable: hasFormatTokens')
}

function buildTokenlessValueRegexSource(format) {
  var su = getSharedUtils()
  if (su && typeof su.buildTokenlessValueRegexSource === 'function') return su.buildTokenlessValueRegexSource(format)
  throw new Error('shared_utils unavailable: buildTokenlessValueRegexSource')
}

function renderTokenlessValueByProgress(format, progressRaw) {
  var su = getSharedUtils()
  if (su && typeof su.renderTokenlessValueByProgress === 'function') return su.renderTokenlessValueByProgress(format, progressRaw)
  throw new Error('shared_utils unavailable: renderTokenlessValueByProgress')
}

function parseTokenlessProgress(value, format) {
  var su = getSharedUtils()
  if (su && typeof su.parseTokenlessProgress === 'function') return su.parseTokenlessProgress(value, format)
  throw new Error('shared_utils unavailable: parseTokenlessProgress')
}

/* Алгоритм — `resolveOffsetByFormatValue` (10.13.159); здесь календарь
   сессии. */
function resolveDateOffsetByFormatValue(state, rawValue, format, maxDays) {
  return getSharedUtils().resolveOffsetByFormatValue(rawValue, format, maxDays, {
    reference: function (unit) { return getReferenceDateForUnit(state, unit) },
    add: function (base, unit, delta) { return addByUnit(base, unit, delta) },
    format: function (dt, mask) { return fmtDateByFormat(dt, mask) },
  })
}

/**
 * Что положить в сессию по значению элемента на строке. Сессия хранит
 * смещение от «сегодня», найденное перебором вперёд; значение, не выразимое
 * смещением (прошлая дата), остаётся собой — `buildDateLikeTokenByOffset`
 * отдаёт его как `маркер + текст`, иначе правая часть строки исчезала.
 * Предел — `getSearchLimitByUnit` (У-32). Исключение № 28 к З3, 2026-09-07.
 */
function resolveElementSelectionFromRaw(state, field, rawValue, cfgDate) {
  var raw = String(rawValue || '').trim()
  if (!raw) return ''
  var fmt = String(cfgDate && cfgDate.format == null ? '' : cfgDate.format)
  var incMode = String(cfgDate && cfgDate.increment && cfgDate.increment.mode || '').trim().toLowerCase()
  var incCommand = String(cfgDate && cfgDate.increment && cfgDate.increment.command || '').trim()
  if (hasFormatTokens(fmt)) {
    var diff = resolveDateOffsetByFormatValue(state, raw, fmt, getSearchLimitByUnit(detectDateUnit(fmt)))
    if (diff !== null && isFinite(diff)) return String(Math.max(0, Math.trunc(diff)))
  } else {
    if (field && field.kind === 'genericElement' && incMode === 'command'
      && shouldHydrateGenericElementRaw(fmt, incCommand, raw)) {
      return raw
    }
    var progress = parseTokenlessProgress(raw, cfgDate ? cfgDate.format : '')
    /* Ниже начала формата-числа прогресс отрицательный и таким остаётся (`В-268`). */
    if (progress !== null && isFinite(progress)) return String(Math.trunc(progress))
  }
  return raw
}

function buildDateLikeTokenByOffset(state, rules, field, rawOffset) {
  var off = Number(rawOffset)
  if (isNaN(off)) {
    var markerRaw = getFieldMarkerByRuntimeCfg(rules, field)
    var rawToken = String(rawOffset || '').trim()
    if (!rawToken) return ''
    return markerRaw ? markerRaw + rawToken : rawToken
  }
  var cfgDateToken = getDateRuntimeCfg(rules, field)
  var fmt = String(cfgDateToken.format == null ? '' : cfgDateToken.format).trim()
  var tokenVal = ''
  if (!hasFormatTokens(fmt)) {
    var fallbackMarker = getDateOffsetFallbackMarker(rules, field)
    tokenVal = fmt
      ? renderTokenlessValueByProgress(fmt, off)
      : (fallbackMarker ? String(fallbackMarker).repeat(Math.max(0, Math.trunc(off))) : '')
  } else {
    var unit = detectDateUnit(fmt)
    var ref = getReferenceDateForUnit(state, unit)
    if (!ref || isNaN(ref.getTime())) return ''
    tokenVal = fmtDateByFormat(addByUnit(ref, unit, off), fmt)
  }
  if (!tokenVal) return ''
  var marker = getFieldMarkerByRuntimeCfg(rules, field)
  return marker ? marker + tokenVal : tokenVal
}

function parseHhmm(s) {
  var su = getSharedUtils()
  if (su && typeof su.parseHhmm === 'function') return su.parseHhmm(s)
  throw new Error('shared_utils unavailable: parseHhmm')
}

function addMinutesHhmm(s, delta) {
  var su = getSharedUtils()
  if (su && typeof su.addMinutesHhmm === 'function') return su.addMinutesHhmm(s, delta)
  throw new Error('shared_utils unavailable: addMinutesHhmm')
}

function stepByCustom(custom, current, direction) {
  var arr = Array.isArray(custom) ? custom : []
  if (!arr.length) return 1
  if (direction > 0) {
    return stepByCustomForward(arr, current)
  }
  var su = getSharedUtils()
  if (su && typeof su.backwardStepByCurrent === 'function') return su.backwardStepByCurrent(arr, current)
  throw new Error('shared_utils unavailable: backwardStepByCurrent')
}

function stepByCustomForward(custom, current) {
  var su = getSharedUtils()
  if (su && typeof su.forwardStepByCurrent === 'function') return su.forwardStepByCurrent(custom, current)
  throw new Error('shared_utils unavailable: forwardStepByCurrent')
}

function stepByIncrementCfg(cfg, current, direction) {
  var c = isObj(cfg) ? cfg : {}
  var modeRaw = String(c.mode || 'standard').trim().toLowerCase()
  if (modeRaw === 'command') return 0
  if (modeRaw !== 'custom') {
    var by = Math.max(0, Math.trunc(Number(c.incrementBy || 0)))
    return by > 0 ? by : 1
  }
  var plan = buildCustomPlan(c)
  var arr = plan.steps
  if (!arr.length) return 1
  if (direction > 0) {
    var cur = Number(current)
    if (plan.hasEnd) {
      var total = endTotal(c)
      if (total !== null && isFinite(cur) && cur >= total) return -1
    }
    return stepByCustomForward(arr, current)
  }
  return stepByCustom(arr, current, direction)
}

/* Правило — в общем модуле, без своей копии (У-32, Д-4). */
function detectDateUnit(format) {
  return ensureStatusRuntimeCommonFns().detectDateUnit(format, getSharedUtils())
}

/* Правило — в общем модуле, без своей копии (У-32, Д-4). */
function getDateProgressForStep(state, fieldId, format) {
  return ensureStatusRuntimeCommonFns().getDateProgressForStep(state, fieldId, format)
}

function mutateDateSelectionByFormat(state, fieldId, format, direction, stepRaw) {
  var step = Math.max(0, Math.trunc(Number(stepRaw || 1))) || 1
  var cur = String(state && state.selected ? (state.selected[fieldId] || '') : '')
  var val = cur === '' ? null : Number(cur)
  if (direction > 0) {
    if (val === null || isNaN(val)) {
      state.selected[fieldId] = '0'
      return
    }
  } else if (val === null || isNaN(val)) {
    state.selected[fieldId] = ''
    return
  }
  /* Ниже начала формата-числа — счёт от числа на строке, как у команды (`В-268`). */
  if (val < 0) {
    state.selected[fieldId] = getSharedUtils().stepBelowNumberStart(format, Math.trunc(val), direction > 0, step)
    return
  }

  /* Пусто — со «сегодня», не когда шаг дошёл до нуля: завтра → сегодня →
     пусто, как `mutateDateOffsetByFormat` (H1.3). */
  var curNum = Math.max(0, Math.trunc(Number(val || 0)))
  if (direction < 0 && curNum <= 0) {
    state.selected[fieldId] = ''
    return
  }
  var next = direction > 0 ? (curNum + step) : Math.max(0, curNum - step)
  state.selected[fieldId] = String(Math.max(0, next))
}

/**
 * Смена родителя чистит зависимых по обоим спискам — дом
 * `clearDependentSelections` в `status_line_runtime_unified.js` (В-116).
 */
function clearDependentSelectionsShared(rules, state, parentFieldId) {
  var runtime = getStatusLineRuntimeUnified()
  if (!runtime || typeof runtime.clearDependentSelections !== 'function') {
    throw new Error('status_line_runtime_unified unavailable: clearDependentSelections')
  }
  return runtime.clearDependentSelections({ rules: rules, state: state, parentFieldId: parentFieldId })
}

function cycleValue(rules, state, direction) {
  var mode = getMode(rules, state.mode)
  var fieldMode = mode
  var field = null
  if (state && state.activeFieldId) {
    var hit = getFieldModeById(rules, state, state.activeFieldId)
    if (hit) {
      fieldMode = hit.mode
      field = hit.field
    }
  }
  if (!field) field = mode.fields[state.activeField]
  if (!field) return
  if (!isFieldEnabled(fieldMode, state, field, rules)) return
  /* В этом Field крутили: пустая ячейка теперь `[-]`, а не имя (цикл 136); снимает `nextVirtualField`. */
  state.scrolledFieldId = String(field.id || '')

  if (field.kind === 'nowTime') {
    var cfgNow = getDateRuntimeCfg(rules, field)
    if (cfgNow.activeMode === 'no' || cfgNow.activeMode === 'hotkey_only') return
    var curNow = state.selected[field.id] || ''
    if (cfgNow.increment && String(cfgNow.increment.mode || '').toLowerCase() === 'command') {
      if (direction > 0 && String(cfgNow.increment.command || '').toLowerCase() === 'now') {
        state.selected[field.id] = formatNowByMask(cfgNow.format || 'HH:mm')
      } else {
        state.selected[field.id] = ''
      }
      return
    }
    var stepNow = stepByIncrementCfg(cfgNow.increment, curNow ? '1' : '', direction)
    if (stepNow < 0) {
      state.selected[field.id] = ''
      return
    }
    if (direction > 0) {
      if (!curNow) state.selected[field.id] = getSessionNow(state)
      else state.selected[field.id] = addMinutesHhmm(curNow, stepNow) || curNow
    } else if (direction < 0) {
      if (!curNow) state.selected[field.id] = ''
      else state.selected[field.id] = addMinutesHhmm(curNow, -stepNow) || ''
    }
    return
  }

  if (field.kind === 'estimatedCycle') {
    var cfgEst = getDateRuntimeCfg(rules, field)
    if (cfgEst.activeMode === 'no' || cfgEst.activeMode === 'hotkey_only') return
    var curEst = state.selected[field.id] || ''
    if (cfgEst.increment && String(cfgEst.increment.mode || '').toLowerCase() === 'command') {
      if (direction > 0 && String(cfgEst.increment.command || '').toLowerCase() === 'now') {
        state.selected[field.id] = formatNowByMask(cfgEst.format || 'HH:mm')
      } else {
        state.selected[field.id] = ''
      }
      return
    }
    var stepEst = stepByIncrementCfg(cfgEst.increment, curEst ? '1' : '', direction)
    if (stepEst < 0) {
      state.selected[field.id] = ''
      return
    }
    if (direction > 0) {
      if (!curEst) state.selected[field.id] = getSessionNow(state)
      else state.selected[field.id] = addMinutesHhmm(curEst, stepEst) || curEst
    } else if (direction < 0) {
      if (!curEst) state.selected[field.id] = ''
      else state.selected[field.id] = addMinutesHhmm(curEst, -stepEst) || ''
    }
    return
  }

  if (field.kind === 'dateOffset') {
    var cfgDate = getDateRuntimeCfg(rules, field)
    if (cfgDate.activeMode === 'no' || cfgDate.activeMode === 'hotkey_only') return
    if (cfgDate.increment && String(cfgDate.increment.mode || '').toLowerCase() === 'command') {
      if (direction > 0 && String(cfgDate.increment.command || '').toLowerCase() === 'now') {
        state.selected[field.id] = '0'
      } else {
        state.selected[field.id] = ''
      }
      return
    }
    var dateProgress = getDateProgressForStep(state, field.id, String(cfgDate.format == null ? 'YYYY-MM-DD' : cfgDate.format))
    var step = stepByIncrementCfg(cfgDate.increment, dateProgress, direction)
    if (step < 0) {
      state.selected[field.id] = ''
      return
    }
    mutateDateSelectionByFormat(state, field.id, String(cfgDate.format == null ? 'YYYY-MM-DD' : cfgDate.format), direction, step)
    return
  }

  if (field.kind === 'genericElement') {
    var cfgGeneric = getDateRuntimeCfg(rules, field)
    if (cfgGeneric.activeMode === 'no' || cfgGeneric.activeMode === 'hotkey_only') return
    var fmtGeneric = String(cfgGeneric.format == null ? '1' : cfgGeneric.format).trim() || '1'
    var curGeneric = state.selected[field.id] || ''
    if (cfgGeneric.increment && String(cfgGeneric.increment.mode || '').toLowerCase() === 'command') {
      if (direction <= 0) {
        state.selected[field.id] = ''
        return
      }
      var cmdRaw = renderCommandValueByFormat(fmtGeneric, String(cfgGeneric.increment.command || 'now'))
      var cmdProgress = hasFormatTokens(fmtGeneric)
        ? resolveDateOffsetByFormatValue(state, cmdRaw, fmtGeneric, getSearchLimitByUnit(detectDateUnit(fmtGeneric)))
        : parseTokenlessProgress(cmdRaw, fmtGeneric)
      if (cmdProgress !== null && isFinite(cmdProgress)) state.selected[field.id] = String(Math.max(0, Math.trunc(cmdProgress)))
      else if (String(cfgGeneric.increment.command || '').trim().toLowerCase() === 'randome') state.selected[field.id] = String(cmdRaw || '').trim()
      else state.selected[field.id] = ''
      return
    }
    var genericProgress = curGeneric === '' ? '' : String(Math.max(0, Math.trunc(Number(curGeneric || 0))))
    var genericStep = stepByIncrementCfg(cfgGeneric.increment, genericProgress, direction)
    if (genericStep < 0) {
      state.selected[field.id] = ''
      return
    }
    mutateDateSelectionByFormat(state, field.id, fmtGeneric, direction, genericStep)
    return
  }

  /* Родитель, дописанный нами (`Add the parent Value`), круг дочернего не
     сужает (2026-09-19); «наш ли» — общий с командой ответ. */
  var parentKeyCycle = String(field.dependsOn || '')
  var parentIsOurs = false
  if (parentKeyCycle) {
    parentIsOurs = __rulesRuntimeHelpers.parentValueEchoesChildValue(
      getFieldById(fieldMode, parentKeyCycle),
      field,
      state.selected[parentKeyCycle] || '',
      findValueById(Array.isArray(field.values) ? field.values : [], state.selected[field.id] || '')
    )
  }

  /* Спрятанные глазом шаг пропускает (В-278); разбор строки берёт `getAllowedValues` целиком. */
  var values = __rulesRuntimeHelpers.valuesForStep(
    getAllowedValues(fieldMode, state, field, rules, parentIsOurs ? { ignoreParent: true } : null),
    state.selected[field.id] || '')
  if (!values.length) return

  var currentId = state.selected[field.id] || ''
  var idx = 0
  var i
  for (i = 0; i < values.length; i++) {
    if (values[i].id === currentId) {
      idx = i
      break
    }
  }

  var nextIdx = (idx + direction + values.length) % values.length
  var nextId = values[nextIdx].id || ''
  state.selected[field.id] = nextId

  /* `Parent Value` = `Add the parent Value`: дописать родителя; условие и
     ответ «чей ребёнок» — общие с командой (10.13.214). */
  if (field.freeOfParent === true && field.addsParentValue === true && parentKeyCycle) {
    if (parentIsOurs || !(state.selected[parentKeyCycle] || '')) {
      var parentFieldAdd = getFieldById(fieldMode, parentKeyCycle)
      var childValueAdd = nextId ? findValueById(values, nextId) : null
      var parentIdAdd = parentFieldAdd && childValueAdd
        ? String(__rulesRuntimeHelpers.parentValueIdForChildValue(parentFieldAdd, childValueAdd) || '')
        : ''
      if (parentIdAdd) state.selected[parentKeyCycle] = parentIdAdd
      /* Пустое место круга (10.13.215): наш родитель уходит со значением. */
      else if (parentIsOurs) state.selected[parentKeyCycle] = ''
    }
  }

  /* Условие — как у команды: чистим зависимых, только если значение сменилось. */
  if (nextId !== currentId) {
    clearDependentSelectionsShared(rules, state, field.id)
  }
}

function nextField(rules, state, direction) {
  var mode = getMode(rules, state.mode)
  if (!mode.fields.length) return
  var idx = state.activeField
  var tries = mode.fields.length
  while (tries > 0) {
    idx = (idx + direction + mode.fields.length) % mode.fields.length
    var f = mode.fields[idx]
    var skipDisabled = rules.behavior.skipDisabledFieldsOnNavigate !== false
    if (!skipDisabled || isFieldEnabled(mode, state, f, rules)) {
      state.activeField = idx
      return
    }
    tries--
  }
}

function findValueById(values, id) {
  var i
  for (i = 0; i < values.length; i++) {
    if (values[i].id === id) return values[i]
  }
  return null
}

/* Пары «родитель — дочерний с навигатором» (`Parent is Navigator`, 10.13.269) по обоим спискам. */
function forEachNavigatorPair(rules, fn) {
  var all = allRuleFields(rules)
  var i
  var j
  for (i = 0; i < all.length; i++) {
    var child = all[i]
    if (!child || child.parentIsNavigator !== true || !child.dependsOn) continue
    for (j = 0; j < all.length; j++) {
      if (all[j] && all[j].id === child.dependsOn) { fn(all[j], child); break }
    }
  }
}

/**
 * Навигатор перед записью снимается — он виртуальный; кроме уже стоявшего на
 * строке (правило 107, нюанс 9).
 */
function dropNavigatorSelections(rules, state, originalLine) {
  if (!state || !state.selected) return
  var words = __sharedUtils.lineWords(originalLine)
  forEachNavigatorPair(rules, function (parent, child) {
    var pid = state.selected[parent.id] || ''
    if (!pid) return
    var pv = findValueById(Array.isArray(parent.values) ? parent.values : [], pid)
    if (!pv || !__rulesRuntimeHelpers.isNavigatorValue(parent, child, pv)) return
    var tok = buildOutputToken(parent, pv, rules)
    if (tok && words.indexOf(tok) !== -1) return
    state.selected[parent.id] = ''
  })
}

/**
 * Токены полей, которыми панель управляет. С `state` выключенное поле не
 * распоряжается — написанное переживает действие как чужое (10.13.129); без
 * `state` — по конфигу.
 */
function buildManagedTokenSet(mode, rules, state) {
  var set = {}
  function pushToken(tok) {
    var t = String(tok || '').trim()
    if (t) set[t] = true
  }
  function addValueTokens(field, value) {
    var primary = buildOutputToken(field, value, rules)
    /* Ссылка с подписью и без неё — одно Value (10.13.277). */
    __sharedUtils.wikilinkLineForms(primary).forEach(pushToken)
    var tokenRaw = value && value.token ? String(value.token) : ''
    if (!tokenRaw) return
    var pref = typeof field.prefix === 'string' ? field.prefix : '#'
    var fallback = pref ? (pref + tokenRaw) : (/^\//.test(tokenRaw) ? ('#' + tokenRaw) : tokenRaw)
    if (fallback !== primary) pushToken(fallback)
  }
  function collectProjectCatalogTokens(projectsCfg) {
    var out = []
    var seen = {}
    function pushRaw(v) {
      var s = String(v || '').trim()
      if (!s || seen[s]) return
      seen[s] = true
      out.push(s)
    }
    var cfg = isObj(projectsCfg) ? projectsCfg : {}
    var defaults = Array.isArray(cfg.defaults) ? cfg.defaults : (Array.isArray(cfg.default) ? cfg.default : [])
    var di
    for (di = 0; di < defaults.length; di++) pushRaw(defaults[di])

    var byContext = isObj(cfg.byContext) ? cfg.byContext : {}
    var ctxKeys = Object.keys(byContext)
    var ci
    for (ci = 0; ci < ctxKeys.length; ci++) {
      var node = isObj(byContext[ctxKeys[ci]]) ? byContext[ctxKeys[ci]] : {}
      var branch = Array.isArray(node.branch) ? node.branch : (Array.isArray(node.projects) ? node.projects : [])
      var bi
      for (bi = 0; bi < branch.length; bi++) pushRaw(branch[bi])
      var leaf = isObj(node.leaf) ? node.leaf : (isObj(node.byNested) ? node.byNested : {})
      var leafKeys = Object.keys(leaf)
      var li
      for (li = 0; li < leafKeys.length; li++) {
        var arr = Array.isArray(leaf[leafKeys[li]]) ? leaf[leafKeys[li]] : []
        var ai
        for (ai = 0; ai < arr.length; ai++) pushRaw(arr[ai])
      }
    }

    var items = Array.isArray(cfg.items) ? cfg.items : []
    var ii
    for (ii = 0; ii < items.length; ii++) {
      var item = items[ii]
      if (typeof item === 'string') {
        pushRaw(item)
        continue
      }
      if (!isObj(item)) continue
      pushRaw(item.wikilink)
      pushRaw(item.link)
      pushRaw(item.token)
      pushRaw(item.id)
    }

    var rulesList = Array.isArray(cfg.rules) ? cfg.rules : []
    var ri
    for (ri = 0; ri < rulesList.length; ri++) {
      var rule = rulesList[ri]
      if (!isObj(rule)) continue
      var addList = Array.isArray(rule.add) ? rule.add : (Array.isArray(rule.projects) ? rule.projects : [])
      var aj
      for (aj = 0; aj < addList.length; aj++) {
        var p = addList[aj]
        if (typeof p === 'string') pushRaw(p)
        else if (isObj(p)) {
          pushRaw(p.wikilink)
          pushRaw(p.link)
          pushRaw(p.token)
          pushRaw(p.id)
        }
      }
    }

    var catalog = Array.isArray(cfg.catalog) ? cfg.catalog : []
    var ci2
    for (ci2 = 0; ci2 < catalog.length; ci2++) {
      var c = catalog[ci2]
      if (typeof c === 'string') pushRaw(c)
      else if (isObj(c)) {
        pushRaw(c.wikilink)
        pushRaw(c.link)
        pushRaw(c.token)
        pushRaw(c.id)
      }
    }
    return out
  }
  var i
  for (i = 0; i < mode.fields.length; i++) {
    var field = mode.fields[i]
    if (!field) continue
    /* В-137: только «поле включено»; скрытое предусловием поле своим
       значением распоряжается (исключение № 89, 10.13.188). */
    if (state && !isFieldSwitchedOn(mode, state, field, rules)) continue
    if (isProjectsSourceField(field)) {
      var projectTokens = collectProjectCatalogTokens(rules && rules.projects)
      var pt
      for (pt = 0; pt < projectTokens.length; pt++) {
        var raw = String(projectTokens[pt] || '').trim()
        if (!raw) continue
        var normalized = normalizeProjectEntry(raw, '')
        if (!normalized) continue
        addValueTokens(field, normalized)
      }
      continue
    }
    var vals = Array.isArray(field.values) ? field.values : []
    var k
    for (k = 0; k < vals.length; k++) {
      var token = vals[k] && vals[k].token ? vals[k].token : ''
      if (!token) continue
      addValueTokens(field, vals[k])
    }
  }
  return set
}

function getUnmanagedTailTokens(parsedLine, mode, rules, state) {
  var tags = parsedLine && Array.isArray(parsedLine.tags) ? parsedLine.tags : []
  var known = buildManagedTokenSet(mode, rules, state)
  var out = []
  var i
  for (i = 0; i < tags.length; i++) {
    var t = String(tags[i] || '').trim()
    if (!t) continue
    if (!known[t]) {
      var comb = splitCombinedTagToken(t)
      if (!comb || !known[comb.parent] || !known[comb.child]) out.push(t)
    }
  }
  return out
}

function getBehaviorBool(rules, snakeKey, camelKey) {
  var behavior = rules && isObj(rules.behavior) ? rules.behavior : {}
  if (snakeKey && behavior[snakeKey] === true) return true
  if (camelKey && behavior[camelKey] === true) return true
  return false
}

function getProjectFieldId(mode) {
  var i
  for (i = 0; i < mode.fields.length; i++) {
    var f = mode.fields[i]
    if (f && isProjectsSourceField(f) && f.id) return f.id
  }
  return ''
}

function resolveCanonicalFieldIds(mode, rules) {
  var profile = getPrimaryFieldIds(mode)
  var out = {
    importance: String(profile.first || ''),
    type: String(profile.second || ''),
    type_sub: String(profile.firstSub || ''),
    category: String(profile.third || ''),
    category_sub: String(profile.secondSub || '')
  }
  var orderCfg = rules && isObj(rules.behavior) && isObj(rules.behavior.order) ? rules.behavior.order : {}
  var fields = mode && Array.isArray(mode.fields) ? mode.fields : []

  function resolveByOrderKey(orderKey, fallbackId) {
    var i
    for (i = 0; i < fields.length; i++) {
      var f = fields[i]
      if (!f) continue
      if (String(f.orderKey || '') === String(orderKey || '')) return String(f.id || fallbackId || '')
    }
    if (isObj(orderCfg) && isObj(orderCfg.enabled) && Object.prototype.hasOwnProperty.call(orderCfg.enabled, orderKey)) {
      for (i = 0; i < fields.length; i++) {
        var fx = fields[i]
        if (!fx) continue
        if (String(fx.id || '') === String(fallbackId || '')) return String(fx.id || fallbackId || '')
      }
    }
    return String(fallbackId || '')
  }

  out.importance = resolveByOrderKey(String(mode && mode.fields && mode.fields[0] && mode.fields[0].orderKey || ''), out.importance)
  out.type = resolveByOrderKey(String(mode && mode.fields && mode.fields[1] && mode.fields[1].orderKey || ''), out.type)
  out.type_sub = resolveByOrderKey(String(mode && mode.fields && mode.fields[2] && mode.fields[2].orderKey || ''), out.type_sub)
  out.category = resolveByOrderKey(String(mode && mode.fields && mode.fields[3] && mode.fields[3].orderKey || ''), out.category)
  out.category_sub = resolveByOrderKey(String(mode && mode.fields && mode.fields[4] && mode.fields[4].orderKey || ''), out.category_sub)
  return out
}

function buildTags(mode, state, rules, parsedLine) {
  var tags = []
  var canonical = resolveCanonicalFieldIds(mode, rules)
  var selected = {
    byFieldId: {},
    byOrderKey: {},
    project: '',
    otherManaged: []
  }
  var orderKeyByFieldId = {}
  var subTokenByParentOrderKey = {}

  function resolveFieldOrderKey(field) {
    if (!field) return ''
    var direct = String(field.orderKey || '').trim()
    if (direct) return direct
    var regLocal = getDomainRegistry()
    if (!regLocal || typeof regLocal.resolveOrderKeyFromFieldId !== 'function') {
      throw new Error('pkm_domain_registry unavailable: resolveOrderKeyFromFieldId')
    }
    var mapped = String(regLocal.resolveOrderKeyFromFieldId(String(field.id || '').trim()) || '').trim()
    if (mapped) return mapped
    return String(field.id || '').trim()
  }
  var removeSubtagAfterProject = getBehaviorBool(rules, 'delete_subtag_after_project', 'deleteSubtagAfterProject')
  var removeCategoryAfterProject = getBehaviorBool(rules, 'delete_category_after_project', 'deleteCategoryAfterProject')
  if (removeCategoryAfterProject) removeSubtagAfterProject = true

  var projectFieldId = getProjectFieldId(mode)
  var hasProjectSelected = !!(projectFieldId && state && state.selected && state.selected[projectFieldId])

  var projectFilters = resolveProjectFilterKeys(isObj(rules && rules.projects) ? rules.projects : {}, rules)
  var categoryFieldId = String(projectFilters[0] || canonical.category || '')
  var subcategoryFieldId = String(projectFilters[1] || canonical.category_sub || '')
  var nestedBySubKey = {}
  var i
  for (i = 0; i < mode.fields.length; i++) {
    var field = mode.fields[i]
    if (!field) continue

    if (hasProjectSelected && removeCategoryAfterProject && field.id === categoryFieldId) continue
    if (hasProjectSelected && removeSubtagAfterProject && field.id === subcategoryFieldId) continue

    /* В-137: скрытое предусловием поле печатается, как у команд; выключенное
       молчит (10.13.188). */
    if (!isFieldSwitchedOn(mode, state, field, rules)) continue
    var valId = state.selected[field.id] || ''
    if (!valId) continue

    /* Без отбора по родителю; годность решает `sanitizeState` (В-137, 10.13.188). */
    var values = getAllowedValues(mode, state, field, rules, { ignoreParent: true })
    var v = findValueById(values, valId)
    if (!v) continue
    var token = v.token || ''
    if (!token) continue
    var outToken = buildOutputToken(field, v, rules)
    if (!outToken) continue

    selected.byFieldId[field.id] = outToken
    var key = resolveFieldOrderKey(field)
    orderKeyByFieldId[String(field.id || '').trim()] = key
    if (isProjectsSourceField(field)) selected.project = outToken
    if (resolveSourceKind(field) === 'wikilinks') selected.otherManaged.push(outToken)
    if (key) selected.byOrderKey[key] = outToken
    else selected.otherManaged.push(outToken)
    /* `Nested` — у каждого дочернего Field (10.13.309). */
    var nestedHere = __sharedUtils.isNestedChildField(rules, field)
    if (key && nestedHere) nestedBySubKey[key] = true

    var dependsOnId = String(field.dependsOn || '').trim()
    if (dependsOnId && outToken) {
      var parentKey = String(orderKeyByFieldId[dependsOnId] || '').trim()
      if (!parentKey) {
        var parentField = null
        var pi
        for (pi = 0; pi < mode.fields.length; pi++) {
          var pf = mode.fields[pi]
          if (!pf) continue
          if (String(pf.id || '').trim() !== dependsOnId) continue
          parentField = pf
          break
        }
        parentKey = resolveFieldOrderKey(parentField)
        if (parentKey) orderKeyByFieldId[dependsOnId] = parentKey
      }
      if (parentKey) {
        var subKey = parentKey + '_sub'
        if (!subTokenByParentOrderKey[subKey]) subTokenByParentOrderKey[subKey] = outToken
        if (nestedHere) nestedBySubKey[subKey] = true
      }
    }
  }

  var tail = getUnmanagedTailTokens(parsedLine, mode, rules, state)
  var techOrder = getTechOrder(rules)
  var keepUnknown = getKeepUnknownTags(rules)
  var hasOtherSlot = techOrder.indexOf('otherTags') !== -1

  function pushUniq(v) {
    if (!v) return
    if (tags.indexOf(v) === -1) tags.push(v)
  }

  for (i = 0; i < techOrder.length; i++) {
    var slot = normalizeTechOrderSlot(techOrder[i], rules)
    if (slot === 'otherTags') {
      pushUniq(selected.project)
      var j
      for (j = 0; j < selected.otherManaged.length; j++) pushUniq(selected.otherManaged[j])
      for (j = 0; j < tail.length; j++) pushUniq(tail[j])
    } else {
      var parentTok = selected.byOrderKey[slot]
      var subTok = selected.byOrderKey[slot + '_sub'] || subTokenByParentOrderKey[slot + '_sub']
      if (nestedBySubKey[slot + '_sub'] && parentTok && subTok) {
        pushUniq(parentTok + '/' + String(subTok).replace(/^#/, ''))
      } else {
        pushUniq(parentTok)
        pushUniq(subTok)
      }
    }
  }

  if (!hasOtherSlot && keepUnknown) {
    pushUniq(selected.project)
    for (i = 0; i < selected.otherManaged.length; i++) pushUniq(selected.otherManaged[i])
    for (i = 0; i < tail.length; i++) pushUniq(tail[i])
  }

  if (__sharedUtils.hasNestedChildField(rules, mode.fields)) {
    var statusLineRuntime = getStatusLineRuntimeUnified()
    if (statusLineRuntime
      && typeof statusLineRuntime.buildCombinedSelectionSet === 'function'
      && typeof statusLineRuntime.applyCombinedToTokenList === 'function') {
      var combinedEntries = statusLineRuntime.buildCombinedSelectionSet({
        fields: mode.fields,
        state: state,
        rules: rules,
        deps: {
          findValueById: findValueById,
          resolveSelectedValue: function (field, selectedId, runtimeState, runtimeRules) {
            var values = getAllowedValues(mode, runtimeState || state, field, runtimeRules || rules)
            return findValueById(values, selectedId)
          },
          buildOutputTokenForField: buildOutputToken,
          /* «Приставка плюс значение» — общий дом (10.13.152). */
          composeToken: function (prefix, rawToken) {
            return __sharedUtils.composeToken(prefix, rawToken)
          }
        }
      })
      tags = statusLineRuntime.applyCombinedToTokenList(tags, combinedEntries)
    }
  }

  return tags
}

/* «Каким выводом печатается поле» — общий дом (10.13.139). */
function resolveFieldOutputMode(field, rules) {
  var helpers = getRulesRuntimeHelpers()
  if (!helpers || typeof helpers.resolveFieldOutputMode !== 'function') {
    throw new Error('pkm_rules_runtime_helpers unavailable: resolveFieldOutputMode')
  }
  return helpers.resolveFieldOutputMode(field, rules)
}

function buildOutputToken(field, value, rules) {
  if (!field || !value) return ''
  var outputMode = resolveFieldOutputMode(field, rules)
  var tokenRaw = String(value.token || '').trim()
  if (__sharedUtils.isWikilinkToken(tokenRaw)) return tokenRaw
  if (__sharedUtils.startsWithTagToken(tokenRaw)) return tokenRaw
  if (outputMode === 'wikilink') {
    /* Цель — общим домом, иначе `[[[[X]]]]` (У-150). */
    var linkTarget = __sharedUtils.unwrapWikilinkToken(value.link || value.token || value.id || '')
    if (!linkTarget) return ''
    /* Вид ссылки в строке — общий дом: Value с папкой пишется с подписью (10.13.277). */
    return __sharedUtils.wikilinkLineToken(linkTarget)
  }
  var token = tokenRaw
  if (!token) return ''
  var prefix = typeof field.prefix === 'string' ? field.prefix : '#'
  if (!prefix && /^\//.test(String(token))) return '#' + String(token)
  return prefix + token
}

function assembleFinalLine(parts, tags, rules, options) {
  var out = []
  var opts = options || {}
  var prefix = String(parts.prefix || '').replace(/\s+$/, '')
  if (prefix) out.push(prefix)

  if (tags.length) out.push(tags.join(' '))

  var forceSep = Boolean(opts.forceSeparatorWhenTags)
  var needSep1 = tags.length && (parts.text || parts.dates || forceSep)
  if (needSep1) out.push(rules.io.separator1)

  if (parts.text) out.push(parts.text)
  if (parts.dates) {
    if (parts.text) {
      out.push(rules.io.separator2)
    } else if (!needSep1) {
      out.push(rules.io.separator1)
    }
    out.push(parts.dates)
  }

  return (parts.indent || '') + out.join(' ').replace(/\s+/g, ' ').trim()
}

function getValueTokenForField(mode, state, field, rules) {
  var valId = state.selected[field.id] || ''
  if (!valId) return ''

  if (field.kind === 'nowTime') {
    return field.marker ? field.marker + valId : valId
  }

  if (field.kind === 'estimatedCycle') {
    return field.marker ? field.marker + valId : valId
  }

  if (field.kind === 'dateOffset' || field.kind === 'genericElement') {
    return buildDateLikeTokenByOffset(state, rules, field, valId)
  }

  var values = getAllowedValues(mode, state, field, rules)
  var v = findValueById(values, valId)
  if (!v) return ''
  return String(buildOutputToken(field, v, rules) || v.token || '')
}

function getDisplayTokenByFieldId(rules, state, fieldId) {
  var hit = getFieldModeById(rules, state, fieldId)
  if (!hit || !hit.field || !hit.mode) return ''
  return String(getValueTokenForField(hit.mode, state, hit.field, rules) || '')
}

/**
 * Своя подпись + написанное — один дом для полосы и коробки скроллера
 * (У-159, правило 80). Дому передаётся уже посчитанное написанное: коробка и
 * полоса считают его по-разному. Нет своего текста — написанное (У-188).
 * Соединитель — волосяной пробел U+200A: у эмодзи своё пустое поле, обычный
 * пробел давал лишний зазор (цикл 110, мера стендом Obsidian).
 */
var VALUE_LABEL_JOINER = '\u200A'

function joinValueLabel(printed, written, mode) {
  var custom = String(printed == null ? '' : printed).trim()
  if (!custom) return written
  if (mode === 'both') return custom + VALUE_LABEL_JOINER + written
  if (mode === 'custom') return custom
  return written
}

/**
 * Подпись значения в полосе (`З-38`): `Default name`, `Only custom name`,
 * `Custom+Default name`. Карта — готовая `buildTagCustomTextMap` (У-32); нет
 * своего текста — написанное (У-188). Подпись — вид, токен уходит отдельно
 * (`tokens`), им чистится противоположный Block.
 */
function valueLabelInStrip(token, labels) {
  var raw = String(token == null ? '' : token)
  if (!raw) return raw
  var mode = labels && typeof labels.mode === 'string' ? labels.mode : 'default'
  if (mode !== 'custom' && mode !== 'both') return raw
  var map = labels && labels.customText && typeof labels.customText === 'object'
    ? labels.customText
    : null
  return joinValueLabel(map ? map[raw.trim()] : '', raw, mode)
}

/**
 * Видно ли поле сейчас (`З-36`): `Show when press Alt` — только пока `Alt`
 * открыт у родителя или у него самого. Здесь, а не в `isFieldEnabled`: тот
 * отвечает и чистке (`sanitizeState`), и `field_relocation`. `altOpen` ставит
 * только панель (`setAltOpen`).
 */
function shownInPanel(state, field) {
  if (!field || field.showOnAlt !== true) return true
  return altOpensChild(state, field)
}

/**
 * Открыл ли `Alt` дочернее поле (нажат у родителя/у него, курсор не уходил).
 * Для любого дочернего, не только `Show when press Alt` (2026-09-23).
 */
function altOpensChild(state, field) {
  if (!field || !field.dependsOn || !state || state.altOpen !== true) return false
  /* `altFor` — поле, у которого нажали; ушёл курсор с него и его дочерних —
     нажатие снимает панель (`setAltOpen` в `tagwheel.js`). */
  return String(state.altFor || '') === String(field.dependsOn)
}

function buildGroupDisplay(group, mode, state, rules, labels) {
  var tokens = []
  var hasActive = false
  var hasVisibleField = false
  var altMode = mode === rules.leftMode ? rules.rightMode : rules.leftMode
  var i
  for (i = 0; i < group.fields.length; i++) {
    var fid = group.fields[i]
    var field = getFieldById(mode, fid)
    var fieldMode = mode
    if (!field && altMode) {
      field = getFieldById(altMode, fid)
      if (field) fieldMode = altMode
    }
    if (!field) continue
    if (field.enabled === false) continue
    if (!isFieldEnabled(fieldMode, state, field, rules)) continue
    if (!shownInPanel(state, field)) continue
    if (field.dependsOn) {
      var allowed = getAllowedValues(fieldMode, state, field, rules)
      var hasChildValues = false
      var ai
      for (ai = 0; ai < allowed.length; ai++) {
        var av = allowed[ai]
        var tok = String(av && av.token || '')
        if (tok) { hasChildValues = true; break }
      }
      if (!hasChildValues) continue
    }
    hasVisibleField = true
    if (state && state.activeFieldId) {
      if (state.activeFieldId === fid) hasActive = true
    } else if (mode.fields[state.activeField] && mode.fields[state.activeField].id === fid) {
      hasActive = true
    }
    var tk = getValueTokenForField(fieldMode, state, field, rules)
    if (tk) tokens.push(tk)
  }

  if (!hasVisibleField) {
    return { hidden: true, active: false, text: '', tokens: [] }
  }

  var text = ''
  if (tokens.length) {
    var shown = []
    var ti
    for (ti = 0; ti < tokens.length; ti++) shown.push(valueLabelInStrip(tokens[ti], labels))
    text = shown.join('+')
  } else {
    /* Пустая ячейка — имя Field; активная после прокрутки в ней — `-`, как умолчание скроллера
       (его пункт «Новое» цикла 135, откат `-` перед именем З3 № 205). */
    var ph = String(group.placeholder || '')
    if (hasActive) {
      var scrolled = state && state.scrolledFieldId && group.fields.indexOf(state.scrolledFieldId) !== -1
      text = scrolled ? '-' : ph
    } else {
      var phStyle = rules.ui && rules.ui.placeholderStyle ? String(rules.ui.placeholderStyle) : 'code'
      if (phStyle === 'plain') text = ph
      else text = '`' + ph + '`'
    }
  }
  return {
    hidden: false,
    active: hasActive,
    text: text,
    /* Значения ячейки, не подпись: ими чистится противоположный Block. */
    tokens: tokens.slice()
  }
}

function getRenderedGroupsForMode(rules, state, mode) {
  if (state.mode === 'left') return buildPanelGroupsFromTechOrder(rules, mode, 'left')
  if (state.mode === 'right') return buildPanelGroupsFromTechOrder(rules, mode, 'right')
  var groups = []
  var i
  for (i = 0; i < mode.fields.length; i++) {
    groups.push({ id: mode.fields[i].id, placeholder: mode.fields[i].placeholder, fields: [mode.fields[i].id] })
  }
  return groups
}

function getNavigableFieldSequence(rules, state) {
  var mode = getMode(rules, state.mode)
  var altMode = mode === rules.leftMode ? rules.rightMode : rules.leftMode
  var groups = getRenderedGroupsForMode(rules, state, mode)
  var out = []
  var seen = {}
  var gi
  for (gi = 0; gi < groups.length; gi++) {
    var group = groups[gi]
    var disp = buildGroupDisplay(group, mode, state, rules)
    if (disp.hidden) continue
    var fields = group && Array.isArray(group.fields) ? group.fields : []
    var chosen = ''
    var fi
    for (fi = 0; fi < fields.length; fi++) {
      var fid = String(fields[fi] || '')
      if (!fid) continue
      if (state.activeFieldId && state.activeFieldId === fid) {
        chosen = fid
        break
      }
      if (!chosen) {
        if (getFieldById(mode, fid) || (altMode && getFieldById(altMode, fid))) {
          chosen = fid
        }
      }
    }
    if (!chosen || seen[chosen]) continue
    seen[chosen] = true
    out.push(chosen)
  }
  return out
}

/**
 * Полоса панели без строки вокруг — общая для `renderControlLine` и custom
 * block у каретки (10.13.260).
 *
 * @param {object} [labels] чем подписывать выбранные значения (`З-38`)
 * @returns {{head: string, shownTokens: string[], keepOpposite: boolean}}
 */
function renderPanelStrip(rules, state, labels) {
  var mode = getMode(rules, state.mode)
  var groups = getRenderedGroupsForMode(rules, state, mode)

  var cells = []
  var shownTokens = []
  var gi
  for (gi = 0; gi < groups.length; gi++) {
    var g = groups[gi]
    var disp = buildGroupDisplay(g, mode, state, rules, labels)
    if (disp.hidden) continue
    if (disp.active) cells.push('**[' + disp.text + ']**')
    else cells.push(disp.text)
    if (Array.isArray(disp.tokens)) shownTokens = shownTokens.concat(disp.tokens)
  }

  var head = cells.join(' ')
  var panelCfg = rules.ui && rules.ui.activePanel ? rules.ui.activePanel : null
  var keepOpposite = false
  if (panelCfg && panelCfg.enabled !== false) {
    var showMarkers = panelCfg.showMarkers === true
    var pfx = typeof panelCfg.prefix === 'string' ? panelCfg.prefix : '{TW}'
    var sfx = typeof panelCfg.suffix === 'string' ? panelCfg.suffix : '{/TW}'
    if (showMarkers) head = pfx + ' ' + head + ' ' + sfx
    /* `==…==` — метка полосы для слоёв редактора; без неё полоса читалась тегами Block (В-287). Фон гасит слой. */
    head = '==' + head + '=='
    keepOpposite = panelCfg.keepOppositeBlock === true
  }
  return { head: head, shownTokens: shownTokens, keepOpposite: keepOpposite }
}

/**
 * @param {object} [labels] чем подписывать выбранные значения (`З-38`); не
 *   передан — печатается написанное, как было до 2026-09-21
 */
function renderControlLine(rules, state, parsedLine, labels) {
  var strip = renderPanelStrip(rules, state, labels)
  var shownTokens = strip.shownTokens
  var tail = parsedLine.text || ''
  var head = strip.head
  var keepOpposite = strip.keepOpposite

  /*
   * Противоположный Block на виду (10.13.87): из `parsedLine` открытия, не с
   * экрана — там вид панели (У-157); из `left`/`right`, не из корзин
   * `tags`/`dates` (см. возврат `parseLine`).
   */
  var other = ''
  if (keepOpposite) {
    other = state.mode === 'right'
      ? String(parsedLine.left || '').trim()
      : String(parsedLine.right || '').trim()
    /* Взятое полосой (значение могло стоять в чужом Block) снимается
       `removeExactTokens`, как у команд (У-32). */
    if (other && shownTokens.length && __linePipeline && typeof __linePipeline.removeExactTokens === 'function') {
      other = String(__linePipeline.removeExactTokens(other, shownTokens) || '').trim()
    }
  }

  /*
   * Своя сборка, не `joinLineParts`: разделитель у полосы стоит всегда, и на
   * пустой строке (2026-09-12); знака начала строки нет — его вернёт
   * `withKeptPrefix`. Пустой текст между двумя зонами — два пробела.
   */
  var leftZone = state.mode === 'right' ? other : head
  var rightZone = state.mode === 'right' ? head : other
  var out = parsedLine.indent
  if (leftZone) out += leftZone + ' ' + rules.io.separator1
  if (tail) out += (out === parsedLine.indent ? '' : ' ') + tail
  else if (leftZone && rightZone) out += ' '
  if (rightZone) out += (out === parsedLine.indent ? '' : ' ') + rules.io.separator2 + ' ' + rightZone
  return out
}

function hydrateStateFromParsedLine(rules, state, parsedLine) {
  // Universal Order Engine v2 contract:
  // - token identity is raw-exact (no transliteration/canonicalization)
  // - hydration conflict resolution is deterministic: last token occurrence wins per field
  // - panel affects UI grouping/navigation only; hydration is position-based on the unified token stream
  var allModes = [rules.leftMode, rules.rightMode]
  var tags = Array.isArray(parsedLine.tags) ? parsedLine.tags.slice() : []
  /* Корзина узнавания `dates` первой, не правый Block: в ней и элементы слева. */
  var rightRaw = String(parsedLine.dates || parsedLine.right || '')
  /* Разделитель — только из настроек, без запасного литерала (У-186). */
  var graphSep2 = __sharedUtils.resolveSeparatorsOrThrow(rules, 'tagwheel_core').sep2
  var graphLine = tags.join(' ') + (rightRaw ? (' ' + graphSep2 + ' ' + rightRaw) : '')
  var rightTags = extractTagLikeTokens(rightRaw)
  var statusLineRuntime = getStatusLineRuntimeUnified()
  var linePipeline = globalThis.__inlineLinePipeline
  var ti
  for (ti = 0; ti < rightTags.length; ti++) {
    if (tags.indexOf(rightTags[ti]) === -1) tags.push(rightTags[ti])
  }
  var lastIndexByToken = {}
  var tokenGraph = getTokenGraphUnified()
  var tokenFacts = []
  var canUseSharedTokenSelect = !!(statusLineRuntime
    && typeof statusLineRuntime.selectTokenByPanelOrder === 'function'
    && linePipeline
    && typeof linePipeline.splitSegments === 'function')
  /* Пустые факты — «нашего нет», не «граф не приехал» (10.13.167). */
  if (!tokenGraph || typeof tokenGraph.buildTokenFactsFromLine !== 'function') {
    throw new Error('token_graph_unified unavailable: buildTokenFactsFromLine')
  }
  var facts = tokenGraph.buildTokenFactsFromLine(graphLine, rules)
  tokenFacts = Array.isArray(facts) ? facts : []
  if (!canUseSharedTokenSelect) {
    var fi
    for (fi = 0; fi < tokenFacts.length; fi++) {
      var fact = tokenFacts[fi]
      var rawToken = String(fact && fact.raw || '').trim()
      if (!rawToken) continue
      lastIndexByToken[rawToken] = Number(fact && fact.position || 0)
    }
  }
  if (!canUseSharedTokenSelect && !tokenFacts.length) {
    for (ti = 0; ti < tags.length; ti++) {
      var orderedToken = String(tags[ti] || '').trim()
      if (!orderedToken) continue
      if (!Object.prototype.hasOwnProperty.call(lastIndexByToken, orderedToken)) {
        lastIndexByToken[orderedToken] = ti
      }
    }
  }
  var mi
  for (mi = 0; mi < allModes.length; mi++) {
    var mode = allModes[mi]
    var panelName = mi === 0 ? 'left' : 'right'
    var fi
    for (fi = 0; fi < mode.fields.length; fi++) {
      var field = mode.fields[fi]
      /* Без отбора по родителю — дочернее бывает написано без него (В-137);
         годность решает `sanitizeState` (10.13.188). */
      var values = getAllowedValues(mode, state, field, rules, { ignoreParent: true })
      if (canUseSharedTokenSelect) {
        var tokenMap = []
        var viMap
        for (viMap = 0; viMap < values.length; viMap++) {
          var vm = values[viMap]
          if (!vm || !vm.token) continue
          var fullToken = buildOutputToken(field, vm, rules)
          if (!fullToken) continue
          __sharedUtils.wikilinkLineForms(fullToken).forEach(function (form) {
            tokenMap.push({ id: String(vm.id || ''), token: form })
          })
        }
        if (tokenMap.length) {
          var hitField = statusLineRuntime.selectTokenByPanelOrder({
            line: graphLine,
            rules: rules,
            panel: panelName,
            tokenMap: tokenMap,
            tokenFacts: tokenFacts,
            deps: { splitSegments: linePipeline.splitSegments }
          })
          if (hitField && hitField.id) {
            state.selected[field.id] = String(hitField.id || '')
            continue
          }
          continue
        }
        continue
      }
      var bestId = ''
      var bestPos = -1
      var vi
      for (vi = 0; vi < values.length; vi++) {
        var v = values[vi]
        if (!v.token) continue
        var pos = -1
        __sharedUtils.wikilinkLineForms(buildOutputToken(field, v, rules)).forEach(function (full) {
          if (Object.prototype.hasOwnProperty.call(lastIndexByToken, full)) pos = Math.max(pos, Number(lastIndexByToken[full]))
        })
        if (pos < 0) continue
        if (pos >= bestPos) {
          bestPos = pos
          bestId = String(v.id || '')
        }
      }
      if (bestPos >= 0) state.selected[field.id] = bestId
    }
  }

  // Backward/forward compatibility: parse combined subtag tokens (#parent/#child)
  // for any dependsOn pair from active left field set.
  var left = rules.leftMode
  /* Без шага `#parent/#child` не разберётся — отказ громкий (10.13.167). */
  if (!statusLineRuntime || typeof statusLineRuntime.hydrateSelectionFromCombinedTokens !== 'function') {
    throw new Error('status_line_runtime_unified unavailable: hydrateSelectionFromCombinedTokens')
  }
  statusLineRuntime.hydrateSelectionFromCombinedTokens({
    fields: left && Array.isArray(left.fields) ? left.fields : [],
    state: state,
    tags: tags,
    rules: rules,
    deps: {
      getAllowedValues: function (fieldsList, runtimeState, runtimeField, runtimeRules) {
        return getAllowedValues({ fields: fieldsList }, runtimeState, runtimeField, runtimeRules)
      },
      buildOutputTokenForField: buildOutputToken,
    }
  })

  var datesText = String(parsedLine.dates || '')
  if (!datesText) return

  var right = rules.rightMode
  var canUseSharedMarkerSelect = !!(statusLineRuntime
    && typeof statusLineRuntime.selectMarkerValueByPanelOrder === 'function'
    && linePipeline
    && typeof linePipeline.splitSegments === 'function')
  var fj
  for (fj = 0; fj < right.fields.length; fj++) {
    var f = right.fields[fj]
    if (!f) continue
    var fieldMarker = getFieldMarkerByRuntimeCfg(rules, f)
    if (!fieldMarker && f.kind !== 'genericElement') continue
    if (f.kind === 'nowTime') {
      if (canUseSharedMarkerSelect) {
        var hitNow = statusLineRuntime.selectMarkerValueByPanelOrder({
          line: graphLine,
          rules: rules,
          panel: 'right',
          marker: fieldMarker,
          valueRxSource: '\\d{2}:\\d{2}',
          tokenFacts: tokenFacts,
          validateValue: function (v) { return !!parseHhmm(v) },
          deps: { splitSegments: linePipeline.splitSegments }
        })
        if (hitNow && hitNow.value) state.selected[f.id] = String(hitNow.value || '')
      }
    } else if (f.kind === 'estimatedCycle') {
      if (canUseSharedMarkerSelect) {
        var hitEst = statusLineRuntime.selectMarkerValueByPanelOrder({
          line: graphLine,
          rules: rules,
          panel: 'right',
          marker: fieldMarker,
          valueRxSource: '\\d{2}:\\d{2}',
          tokenFacts: tokenFacts,
          validateValue: function (v) { return !!parseHhmm(v) },
          deps: { splitSegments: linePipeline.splitSegments }
        })
        if (hitEst && hitEst.value) state.selected[f.id] = String(hitEst.value || '')
      }
    } else if (f.kind === 'dateOffset' || f.kind === 'genericElement') {
      var cfgDateHydrate = getDateRuntimeCfg(rules, f)
      var fmtHydrate = String(cfgDateHydrate.format == null ? '' : cfgDateHydrate.format)
      var cmdHydrate = String(cfgDateHydrate.increment && cfgDateHydrate.increment.command || '').trim()
      var modeHydrate = String(cfgDateHydrate.increment && cfgDateHydrate.increment.mode || '').trim().toLowerCase()
      var cmdHydrateLower = cmdHydrate.toLowerCase()
      var genericRawCommand = (f.kind === 'genericElement' && modeHydrate === 'command' && cmdHydrateLower === 'randome')
      var valueRxSrc = hasFormatTokens(fmtHydrate)
        ? buildFormatValueRegexSource(cfgDateHydrate.format)
        : buildTokenlessValueRegexSource(cfgDateHydrate.format)
      if (genericRawCommand) valueRxSrc = '[^\\s]+'
      if (canUseSharedMarkerSelect && fieldMarker) {
        var hitDate = statusLineRuntime.selectMarkerValueByPanelOrder({
          line: graphLine,
          rules: rules,
          panel: 'right',
          marker: fieldMarker,
          valueRxSource: valueRxSrc || '[^\\s]+',
          tokenFacts: tokenFacts,
          deps: { splitSegments: linePipeline.splitSegments }
        })
        if (hitDate && hitDate.value) {
          state.selected[f.id] = resolveElementSelectionFromRaw(state, f, hitDate.value, cfgDateHydrate)
        }
        continue
      }
      var rDate
      if (!fmtHydrate) {
        rDate = fieldMarker
          ? new RegExp(escapeRe(fieldMarker) + '(' + escapeRe(fieldMarker) + '*)(?=\\s|$)', 'u')
          : new RegExp('(?:^|\\s)([^\\s]+)(?=\\s|$)', 'u')
      } else {
        if (fieldMarker) {
          rDate = valueRxSrc
            ? new RegExp(escapeRe(fieldMarker) + '(' + valueRxSrc + ')(?=\\s|$)', 'u')
            : new RegExp(escapeRe(fieldMarker) + '([^\\s]+)', 'u')
        } else {
          rDate = valueRxSrc
            ? new RegExp('(?:^|\\s)(' + valueRxSrc + ')(?=\\s|$)', 'u')
            : new RegExp('(?:^|\\s)([^\\s]+)(?=\\s|$)', 'u')
        }
      }
      var mDate = datesText.match(rDate)
      if (mDate) {
        state.selected[f.id] = resolveElementSelectionFromRaw(state, f, mDate[1], cfgDateHydrate)
      }
    }
  }
}

function sanitizeState(rules, state) {
  var modes = [rules.leftMode, rules.rightMode]
  var mi
  for (mi = 0; mi < modes.length; mi++) {
    var mode = modes[mi]
    var fi
    for (fi = 0; fi < mode.fields.length; fi++) {
      var field = mode.fields[fi]
      if (!isFieldEnabled(mode, state, field, rules)) {
        /* Поле, которым панель не управляет, не чистится: пустой выбор у поля
           с источником вычищает его токены со строки (Н-5). Предусловие решает,
           можно ли менять, а не выживет ли написанное. */
        continue
      }
      var cur = state.selected[field.id] || ''
      if (!cur) continue
      if (field.kind === 'nowTime' || field.kind === 'estimatedCycle' || field.kind === 'dateOffset' || field.kind === 'genericElement') {
        continue
      }
      var values = getAllowedValues(mode, state, field, rules)
      if (!findValueById(values, cur)) state.selected[field.id] = ''
    }
  }
}

/* Экранирование — общий модуль, без своей копии (2026-09-11). */
function escapeRe(s) {
  var su = getSharedUtils()
  if (su && typeof su.escapeRe === 'function') return su.escapeRe(s)
  throw new Error('shared_utils unavailable: escapeRe')
}

/**
 * Чужое в правом Block: панель собирает его заново (`buildRightDates`) и
 * теряла бы, например, `#processed` от `Inline to note` (У-185, У-187).
 * Как `getUnmanagedTailTokens` слева.
 */
function getUnmanagedRightTokens(parsedLine, rules) {
  var raw = String(parsedLine && parsedLine.dates || '').trim()
  if (!raw) return []
  var helpers = __rulesRuntimeHelpers
  if (!helpers || typeof helpers.buildTagTokenKeyMap !== 'function'
    || typeof helpers.getDefaultTagTokenKeyMapOptions !== 'function') {
    throw new Error('pkm_rules_runtime_helpers unavailable: buildTagTokenKeyMap')
  }
  var map = helpers.buildTagTokenKeyMap(rules, helpers.getDefaultTagTokenKeyMapOptions()) || {}
  var parts = __sharedUtils.lineWords(raw)
  var out = []
  var i
  for (i = 0; i < parts.length; i++) {
    var t = String(parts[i] || '').trim()
    if (!t) continue
    /* Значение поля панель построит из выбранного. */
    if (map[t]) continue
    /* Значение элемента — тоже (бывает из двух слов). */
    if (isDateLikeOrBareDateToken(t, rules)) continue
    out.push(t)
  }
  return out
}

function buildRightDates(rules, state) {
  var mode = rules.rightMode
  var out = []
  var i
  for (i = 0; i < mode.fields.length; i++) {
    var f = mode.fields[i]
    if (!f) continue
    var fieldMarker = getFieldMarkerByRuntimeCfg(rules, f)
    if (!fieldMarker && f.kind !== 'genericElement') continue
    var v = state.selected[f.id] || ''
    if (!v) continue
    if (f.kind === 'nowTime') {
      if (fieldMarker) out.push(fieldMarker + v)
    } else if (f.kind === 'estimatedCycle') {
      if (fieldMarker) out.push(fieldMarker + v)
    } else if (f.kind === 'dateOffset' || f.kind === 'genericElement') {
      var token = buildDateLikeTokenByOffset(state, rules, f, v)
      if (token) out.push(token)
    }
  }
  return out
}

module.exports = {
  validateRules: validateRules,
  /* Три экспорта ниже — для `tools/form_divergence.js` (У-151). */
  getDateLikeMarkers: getDateLikeMarkers,
  resolveDateOffsetByFormatValue: resolveDateOffsetByFormatValue,
  isDateLikeOrBareDateToken: isDateLikeOrBareDateToken,
  parseLine: parseLine,
  makeInitialState: makeInitialState,
  resolveInitialActiveField: resolveInitialActiveField,
  applyActiveFieldChoiceToRules: applyActiveFieldChoiceToRules,
  chooseActiveFieldId: chooseActiveFieldId,
  hydrateStateFromParsedLine: hydrateStateFromParsedLine,
  dropNavigatorSelections: dropNavigatorSelections,
  sanitizeState: sanitizeState,
  buildPrefix: buildPrefix,
  isFieldEnabled: isFieldEnabled,
  isFieldSwitchedOn: isFieldSwitchedOn,
  getAllowedValues: getAllowedValues,
  cycleValue: cycleValue,
  nextField: nextField,
  getNavigableFieldSequence: getNavigableFieldSequence,
  shownInPanel: shownInPanel,
  buildTags: buildTags,
  /* Один дом «как значение выглядит в строке» (2026-09-15). */
  buildOutputToken: buildOutputToken,
  /* Для меры расхождения с панелью. */
  resolveFieldOutputMode: resolveFieldOutputMode,
  buildRightDates: buildRightDates,
  getUnmanagedRightTokens: getUnmanagedRightTokens,
  assembleFinalLine: assembleFinalLine,
  renderControlLine: renderControlLine,
  /* Полоса без строки вокруг — её ставит у каретки custom block (10.13.260). */
  renderPanelStrip: renderPanelStrip,
  /* Для проверки `З-38` без Obsidian (правило 122). */
  valueLabelInStrip: valueLabelInStrip,
  /* Зовёт и коробка скроллера в `tagwheel.js` (правило 80). */
  joinValueLabel: joinValueLabel,
  getDisplayTokenByFieldId: getDisplayTokenByFieldId
}
