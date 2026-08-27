function err(msg) {
  throw new Error('[tagwheel] ' + msg)
}

function loadCoreHelperFromGlobalOrRequire(globalKey, requirePath) {
  try {
    var key = String(globalKey || '').trim()
    var modPath = String(requirePath || '').trim()
    var g = key && globalThis ? globalThis[key] : null
    if (g && typeof g === 'object') return g
    if (typeof require === 'function' && modPath) {
      try {
        var mod = require(modPath)
        if (mod && typeof mod === 'object') return mod
      } catch (_) {}
    }
    return null
  } catch (_) {
    return null
  }
}

function getSharedUtils() {
  return loadCoreHelperFromGlobalOrRequire('__inlineOverhaulSharedUtils', '../../src/core/shared_utils.js')
}

function getStatusLineRuntimeUnified() {
  return loadCoreHelperFromGlobalOrRequire('__inlineStatusLineRuntimeUnified', '../../src/core/status_line_runtime_unified.js')
}

function getRulesRuntimeHelpers() {
  return loadCoreHelperFromGlobalOrRequire('__inlinePkmRulesHelpers', '../../src/core/pkm_rules_runtime_helpers.js')
}

function getMarkdownJsonBlockParser() {
  return loadCoreHelperFromGlobalOrRequire('__inlineMarkdownJsonBlockParser', '../../src/core/markdown_json_block_parser.js')
}

function getTagwheelRulesNormalizer() {
  return loadCoreHelperFromGlobalOrRequire('__inlineTagwheelRulesNormalizer', '../../src/core/tagwheel_rules_normalizer.js')
}

function getTokenGraphUnified() {
  return loadCoreHelperFromGlobalOrRequire('__inlineTokenGraphUnified', '../../src/core/token_graph_unified.js')
}

function getDomainRegistry() {
  return loadCoreHelperFromGlobalOrRequire('__inlinePkmDomainRegistry', '../../src/core/pkm_domain_registry.js')
}

function getStatusRuntimeCommon() {
  return loadCoreHelperFromGlobalOrRequire('__inlineStatusRuntimeCommon', '../../src/core/status_runtime_common.js')
}

function resolveSourceKind(field) {
  var helpers = getRulesRuntimeHelpers()
  if (!helpers || typeof helpers.normalizeFieldSourceKind !== 'function') {
    throw new Error('pkm_rules_runtime_helpers unavailable: normalizeFieldSourceKind')
  }
  return String(helpers.normalizeFieldSourceKind(field) || '').trim() || 'none'
}

function isProjectsSourceField(field) {
  return resolveSourceKind(field) === 'projects'
}

function isWikilinkSourceField(field) {
  var kind = resolveSourceKind(field)
  return kind === 'projects' || kind === 'wikilinks'
}

function isSourceDrivenField(field) {
  var kind = resolveSourceKind(field)
  return kind === 'projects' || kind === 'wikilinks'
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
  return x && typeof x === 'object' && !Array.isArray(x)
}

function ensureStatusRuntimeCommonFns() {
  if (globalThis.__inlineStatusRuntimeCommonFns && typeof globalThis.__inlineStatusRuntimeCommonFns === 'object') return globalThis.__inlineStatusRuntimeCommonFns
  var mod = getStatusRuntimeCommon()
  if (!mod || typeof mod.createStatusRuntimeCommon !== 'function') return null
  var fns = mod.createStatusRuntimeCommon({
    isObj: isObj,
    normalizeOrderKey: function (k) { return String(k || '').trim() },
    defaultPanel: 'left',
    loadOrderKeyNormalizer: async function () { return function (k) { return String(k || '').trim() } },
    loadRuntimePreloadFacade: async function () { return null },
    loadVaultModule: async function () { throw new Error('tagwheel_core: loadVaultModule not available for local shared helper bootstrap') }
  })
  globalThis.__inlineStatusRuntimeCommonFns = fns
  return fns
}

function getDateLikeMarkers(rules) {
  var out = []
  var seen = {}
  var helpers = getRulesRuntimeHelpers()
  var i
  if (helpers && typeof helpers.getDateMarkersFromRules === 'function') {
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
  }

  var fallback = Array.isArray(rules && rules.dates && rules.dates.markers)
    ? rules.dates.markers
    : []
  for (i = 0; i < fallback.length; i++) {
    var mk = String(fallback[i] || '').trim()
    if (!mk || seen[mk]) continue
    seen[mk] = true
    out.push(mk)
  }
  return out
}

function isDateLikeToken(token, rules) {
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
  var helpers = getRulesRuntimeHelpers()
  if (helpers && typeof helpers.isDateLikeToken === 'function') {
    if (helpers.isDateLikeToken(src, { markers: markers })) return true
  } else {
    var i
    for (i = 0; i < markers.length; i++) {
      var mk = markers[i]
      if (mk && src.indexOf(mk) === 0 && src.length > mk.length) return true
    }
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(src) || /^\d{2}:\d{2}$/.test(src)
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

function normalizeValue(v) {
  var normalizer = getTagwheelRulesNormalizer()
  if (normalizer && typeof normalizer.normalizeValue === 'function') {
    return normalizer.normalizeValue(v, { isObj: isObj, err: err })
  }
  if (typeof v === 'string') {
    return { id: v, token: v, allowedParentValues: null }
  }
  if (!isObj(v)) err('Field value must be string or object')
  var token = typeof v.token === 'string' ? v.token : ''
  if (!token && token !== '') err('Value token must be string')
  var id = typeof v.id === 'string' ? v.id : token
  if (typeof id !== 'string') err('Value id must be string')
  return {
    id: id,
    token: token,
    allowedParentValues: Array.isArray(v.allowedParentValues) ? v.allowedParentValues : null
  }
}

function normalizeImportanceValueToken(raw) {
  var normalizer = getTagwheelRulesNormalizer()
  if (normalizer && typeof normalizer.normalizeImportanceValueToken === 'function') {
    return normalizer.normalizeImportanceValueToken(raw)
  }
  var src = String(raw || '').trim()
  if (!src) return ''
  if (/^#\//.test(src)) return src
  if (/^\//.test(src)) return '#' + src
  if (src.charAt(0) === '#') return '#/' + src.slice(1)
  return '#/' + src
}

function normalizeField(field, modeName, idx) {
  var normalizer = getTagwheelRulesNormalizer()
  if (normalizer && typeof normalizer.normalizeField === 'function') {
    return normalizer.normalizeField(field, modeName, idx, { isObj: isObj, err: err })
  }
  if (!isObj(field)) err(modeName + '.fields[' + idx + '] must be object')
  if (typeof field.id !== 'string' || !field.id) err(modeName + '.fields[' + idx + '].id must be non-empty string')

  var out = {
    id: field.id,
    orderKey: typeof field.orderKey === 'string' ? field.orderKey : '',
    prefix: typeof field.prefix === 'string' ? field.prefix : '#',
    dependsOn: typeof field.dependsOn === 'string' ? field.dependsOn : '',
    source: typeof field.source === 'string' ? field.source : '',
    enabled: field.enabled !== false,
    enabledForParentValues: Array.isArray(field.enabledForParentValues) ? field.enabledForParentValues.slice() : null,
    disabledForParentValues: Array.isArray(field.disabledForParentValues) ? field.disabledForParentValues.slice() : null,
    kind: typeof field.kind === 'string' ? field.kind : '',
    marker: typeof field.marker === 'string' ? field.marker : '',
    placeholder: typeof field.placeholder === 'string' && field.placeholder ? field.placeholder : field.id,
    values: []
  }

  var rawValues = Array.isArray(field.values)
    ? field.values
    : (isProjectsSourceField(out) ? [] : null)
  if (!rawValues) err(modeName + '.fields[' + field.id + '].values must be array')

  var hasEmpty = false
  var importanceLike = false
  var j
  for (j = 0; j < rawValues.length; j++) {
    var vv = rawValues[j]
    var tkn = String(vv && vv.token || '').trim()
    if (/^#\//.test(tkn) || /^\//.test(tkn)) {
      importanceLike = true
      break
    }
  }
  var i
  for (i = 0; i < rawValues.length; i++) {
    var nv = normalizeValue(rawValues[i])
    if (importanceLike && nv.token) {
      var before = String(nv.token || '')
      nv.token = normalizeImportanceValueToken(before)
      if (String(nv.id || '') === before || String(nv.id || '') === before.replace(/^#/, '')) nv.id = nv.token
    }
    if (nv.token === '') hasEmpty = true
    out.values.push(nv)
  }
  if (!hasEmpty) out.values.unshift({ id: '', token: '', allowedParentValues: null })
  return out
}

function normalizeMode(mode, modeName) {
  var normalizer = getTagwheelRulesNormalizer()
  if (normalizer && typeof normalizer.normalizeMode === 'function') {
    return normalizer.normalizeMode(mode, modeName, { isObj: isObj, err: err })
  }
  if (!isObj(mode)) err(modeName + ' must be object')
  if (!Array.isArray(mode.fields)) err(modeName + '.fields must be array')
  var out = { fields: [] }
  var i
  for (i = 0; i < mode.fields.length; i++) {
    out.fields.push(normalizeField(mode.fields[i], modeName, i))
  }
  return out
}

function parseRulesFromMarkdown(content) {
  var io = parseJsonBlock(content, 'tagwheel-io', true)
  var inlineLayout = parseJsonBlock(content, 'tagwheel-inline-layout', false)
  var behavior = parseJsonBlock(content, 'tagwheel-behavior', true)
  var ui = parseJsonBlock(content, 'tagwheel-ui', true)
  var leftMode = parseJsonBlock(content, 'tagwheel-left-mode', true)
  var rightMode = parseJsonBlock(content, 'tagwheel-right-mode', true)
  var projects = parseJsonBlock(content, 'tagwheel-projects', true)
  var colors = parseJsonBlock(content, 'tagwheel-colors', false)
  var meta = parseJsonBlock(content, 'tagwheel-meta', false)

  return {
    meta: isObj(meta) ? meta : {},
    io: isObj(io) ? io : {},
    inlineLayout: isObj(inlineLayout) ? inlineLayout : {},
    behavior: isObj(behavior) ? behavior : {},
    ui: isObj(ui) ? ui : {},
    leftMode: normalizeMode(leftMode, 'leftMode'),
    rightMode: normalizeMode(rightMode, 'rightMode'),
    projects: isObj(projects) ? projects : { items: [] },
    colors: isObj(colors) ? colors : {}
  }
}

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

  /* Левый список ищет родителя только у себя, правый — в обоих: разбор
     у `validateMode`. */
  var leftScope = Array.isArray(rules.leftMode && rules.leftMode.fields) ? rules.leftMode.fields : []
  var rightScope = Array.isArray(rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : []
  validateMode(rules.leftMode, 'leftMode', leftScope)
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

function getSubtagFormat(rules) {
  var common = ensureStatusRuntimeCommonFns()
  if (common && typeof common.resolveSubtagFormat === 'function') {
    return common.resolveSubtagFormat(null, rules)
  }
  var behavior = rules && isObj(rules.behavior) ? rules.behavior : {}
  var v = String(behavior.subtagFormat || 'separate').trim().toLowerCase()
  return v === 'combined' ? 'combined' : 'separate'
}

function splitCombinedTagToken(tag) {
  var t = String(tag || '').trim()
  var i = t.indexOf('/')
  if (i <= 0) return null
  var parent = t.slice(0, i)
  var child = t.slice(i + 1)
  if (!parent || !child) return null
  if (parent[0] !== '#') return null
  var childTag = child[0] === '#' ? child : ('#' + child)
  return { parent: parent, child: childTag }
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
   * Стоит ли Field в Block своим собственным ключом (PRD 10.13.4, Н-1).
   *
   * `dependsOn` значит для движка две разные вещи, и различать их надо здесь.
   * У дочернего Field (`<name>_sub`) своего ключа в Block нет вовсе:
   * `normalizePkmOrder` выбрасывает `_sub` из `left` и `right`, — и он обязан
   * идти за родителем. У Field с предусловием свой ключ в Block есть, и
   * поставил его туда человек.
   *
   * До 2026-08-28 различия не было, Block всегда брался у родителя — и
   * ссылка в Right Block, ждущая тег из Left Block, пропадала из ОБЕИХ
   * панелей: слева из-за своего ключа в чужом Block, справа из-за отсутствия
   * там ключа родителя. Молча, без единого сообщения.
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
      /* Подпись `sub` принадлежит дочернему Field, а не всякому, у кого есть
         `dependsOn`: Field с предусловием стоит в Block своим ключом и
         показывается своим именем. Тот же разбор, что у `ownOrderKeyPlaced`. */
      var depIsChild = !!dep.dependsOn && !ownOrderKeyPlaced(dep)
      pushFieldGroup(dep, !!dep.dependsOn, depIsChild ? (dep.placeholder || 'sub') : dep.placeholder)
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
 * `scopeFields` — где `dependsOn` разрешено искать Field-предусловие
 * (PRD 10.13.4, Н24).
 *
 * Определения тегов лежат в `leftMode.fields`, ссылок и элементов — в
 * `rightMode.fields`: их раскладывает по типу `ensureBehaviorModesFromOrder`
 * в `main.js`, и это НЕ Block, в который Field пишется. До 2026-08-28 каждый
 * список проверялся сам по себе, и связь через границу списков считалась
 * сломанной — с той разницей, что здесь это не молчаливое выключение Field,
 * а исключение: TagWheel не открывался вовсе.
 *
 * Граница открыта в ту же одну сторону, что и в `reconcileModeDependencies`
 * (`src/core/pkm_rules_runtime_helpers.js`): правый список ищет родителя в
 * обоих, левый — только у себя. Два прохода обязаны сходиться, иначе один
 * стирает связь, а второй на неё ругается.
 *
 * Сама проверка остаётся: `dependsOn` на Field, которого нет нигде, — отказ.
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

function getRightFieldByMarker(rules, marker) {
  var right = rules && rules.rightMode ? rules.rightMode : null
  var fields = right && Array.isArray(right.fields) ? right.fields : []
  var i
  for (i = 0; i < fields.length; i++) {
    var f = fields[i]
    if (f && typeof f.marker === 'string' && f.marker === marker) return f
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

function isLikelyDatesSegment(segment, rules) {
  var s = String(segment || '').trim()
  if (!s) return false

  var tokens = s.split(/\s+/)
  if (!tokens.length) return false

  var right = rules && rules.rightMode ? rules.rightMode : null
  var fields = right && Array.isArray(right.fields) ? right.fields : []
  var markers = []
  var markerToField = {}
  var i
  for (i = 0; i < fields.length; i++) {
    var f = fields[i]
    var mk = getFieldMarkerByRuntimeCfg(rules, f)
    if (!mk) continue
    markers.push(mk)
    if (!Object.prototype.hasOwnProperty.call(markerToField, mk)) markerToField[mk] = f
  }
  if (!markers.length) return false

  for (i = 0; i < tokens.length; i++) {
    var t = tokens[i]
    var j
    var found = ''
    for (j = 0; j < markers.length; j++) {
      if (t.indexOf(markers[j]) === 0) {
        found = markers[j]
        break
      }
    }
    if (!found) return false

    var field = markerToField[found] || getRightFieldByMarker(rules, found)
    var raw = t.slice(found.length)
    if (!raw) return false
    if (field && field.kind === 'dateOffset') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false
    } else if (field && (field.kind === 'nowTime' || field.kind === 'estimatedCycle')) {
      if (!/^\d{2}:\d{2}$/.test(raw)) return false
    }
  }

  return true
}

function isLikelyRightPayloadSegment(segment, rules) {
  var s = String(segment || '').trim()
  if (!s) return false
  var tokens = s.split(/\s+/)
  if (!tokens.length) return false
  function isContinuationToken(tok) {
    var v = String(tok || '').trim()
    if (!v) return false
    if (/^\d{2}$/.test(v)) return true
    if (/^\d{2}[-:]\d{2}(?:[-:]\d{2})?$/.test(v)) return true
    return false
  }
  var markers = getDateLikeMarkers(rules)
  var markerAnchored = false
  var i
  for (i = 0; i < tokens.length; i++) {
    var t = tokens[i]
    if (/^#\S+$/.test(t)) continue
    if (/^\[\[[^\]]+\]\]$/.test(t)) continue
    if (i === 0) {
      var mi
      for (mi = 0; mi < markers.length; mi++) {
        var mk = String(markers[mi] || '')
        if (!mk) continue
        if (String(t || '').indexOf(mk) === 0 && String(t || '').length > mk.length) {
          markerAnchored = true
          break
        }
      }
      if (!markerAnchored) {
        var t0 = String(t || '')
        if (/^[^A-Za-z0-9#\[]/.test(t0) && /\d/.test(t0)) markerAnchored = true
      }
    } else if (markerAnchored && isContinuationToken(t)) {
      continue
    }
    if (isDateLikeToken(t, rules)) continue
    return false
  }
  return true
}

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

function resolveInitialActiveField(rules, state, modeName) {
  var mode = getMode(rules, modeName)
  if (!mode.fields.length) return 0

  var behavior = isObj(rules.behavior) ? rules.behavior : {}
  var order = isObj(behavior.order) ? behavior.order : {}
  var lead = isObj(order.lead) ? order.lead : {}
  var leadOrderKey = String(lead[modeName] || '').trim()
  if (leadOrderKey) {
    var leadFieldId = getLeadFieldIdByOrderKey(mode, state, leadOrderKey, rules)
    if (leadFieldId) {
      var leadIdx = getEnabledFieldIndexById(mode, state, leadFieldId, rules)
      if (leadIdx !== -1) return leadIdx
    }
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
        var childIdx = getEnabledFieldIndexById(mode, state, childFieldId, rules)
        if (childIdx !== -1) return childIdx
      }
    }
  }

  var defaultFieldId = typeof modeCfg.defaultFieldId === 'string' && modeCfg.defaultFieldId
    ? modeCfg.defaultFieldId
    : ''
  if (defaultFieldId) {
    var idx = getEnabledFieldIndexById(mode, state, defaultFieldId, rules)
    if (idx !== -1) return idx
  }

  return getFirstEnabledFieldIndex(mode, state, rules)
}

function parseLine(rawLine, rules) {
  var line = String(rawLine || '')
  var indent = (line.match(/^(\s*)/) || ['', ''])[1]
  var body = line.slice(indent.length)

  var headingToken = ''
  var mh = body.match(/^(#{1,6})\s+(.*)$/)
  if (mh) {
    headingToken = mh[1]
    body = String(mh[2] || '')
  }

  var bulletToken = ''
  var checkboxToken = ''

  var mb = body.match(/^([-*+])\s+/)
  if (mb) {
    bulletToken = mb[1]
    body = body.slice(mb[0].length)
  } else {
    var mn = body.match(/^(\d+\.)(?:\s+|$)/)
    if (mn) {
      bulletToken = mn[1]
      body = body.slice(mn[0].length)
    }
  }

  var mcb = body.match(/^(\[[^\]]\])\s+/)
  if (mcb) {
    checkboxToken = mcb[1]
    body = body.slice(mcb[0].length)
  }

  var tags = []
  while (true) {
    var mt = body.match(/^#\S+\s*/)
    if (mt) {
      tags.push(mt[0].trim())
      body = body.slice(mt[0].length)
      continue
    }
    var mw = body.match(/^\[\[[^\]]+\]\]\s*/)
    if (mw) {
      tags.push(mw[0].trim())
      body = body.slice(mw[0].length)
      continue
    }
    break
  }

  var text = ''
  var dates = ''
  var sep1 = rules.io.separator1
  var sep2 = rules.io.separator2
  var rest = body.trim()

  if (rest) {
    function classifyLeftPartTokens(raw) {
      var src = String(raw || '').trim()
      var out = { tags: [], dates: [], text: [] }
      if (!src) return out
      var parts = src.split(/\s+/)
      var i
      for (i = 0; i < parts.length; i++) {
        var t = String(parts[i] || '').trim()
        if (!t) continue
        if (/^#\S+$/.test(t) || /^\[\[[^\]]+\]\]$/.test(t)) {
          out.tags.push(t)
          continue
        }
        if (isDateLikeToken(t, rules)) {
          out.dates.push(t)
          continue
        }
        out.text.push(t)
      }
      return out
    }

    var idx1 = rest.indexOf(sep1)
    if (idx1 !== -1) {
      var leftPart = rest.slice(0, idx1).trim()
      var after1 = rest.slice(idx1 + sep1.length).trim()
      var idx2 = after1.indexOf(sep2)
      var leftClassified = classifyLeftPartTokens(leftPart)
      if (idx2 !== -1) {
        text = after1.slice(0, idx2).trim()
        dates = after1.slice(idx2 + sep2.length).trim()
      } else {
        if (isLikelyDatesSegment(after1, rules) || isLikelyRightPayloadSegment(after1, rules)) {
          dates = after1
        } else if (!tags.length && leftPart) {
          text = (leftPart + ' ' + after1).trim()
        } else {
          text = after1
        }
      }
      var li
      for (li = 0; li < leftClassified.tags.length; li++) {
        if (tags.indexOf(leftClassified.tags[li]) === -1) tags.push(leftClassified.tags[li])
      }
      if (leftClassified.text.length) {
        var leftText = leftClassified.text.join(' ').trim()
        if (leftText) text = (leftText + ' ' + text).trim()
      }
      if (leftClassified.dates.length) {
        var leftDates = leftClassified.dates.join(' ').trim()
        if (leftDates) dates = (leftDates + ' ' + dates).trim()
      }
    } else {
      text = rest
    }
  }

  return {
    indent: indent,
    headingToken: headingToken,
    bulletToken: headingToken ? '' : (bulletToken || '-'),
    checkboxToken: checkboxToken,
    left: tags.slice(),
    right: dates,
    tags: tags,
    text: text,
    dates: dates
  }
}

function extractTagLikeTokens(text) {
  var s = String(text || '').trim()
  if (!s) return []
  var parts = s.split(/\s+/)
  var out = []
  var i
  for (i = 0; i < parts.length; i++) {
    var t = parts[i]
    if (/^#\S+$/.test(t) || /^\[\[[^\]]+\]\]$/.test(t)) out.push(t)
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

function getPrefixRules(rules, state, deps) {
  var shared = resolvePrefixBehaviorShared(rules, state, deps)
  if (!shared || typeof shared.getPrefixRulesUnified !== 'function') {
    err('pkm_line_finalize_unified unavailable: getPrefixRulesUnified required')
  }
  return shared.getPrefixRulesUnified(rules, { isObj: isObj })
}

function selectedTokenByFieldId(rules, state, fieldId, deps) {
  var shared = resolvePrefixBehaviorShared(rules, state, deps)
  if (!shared || typeof shared.selectedTokenByFieldIdUnified !== 'function') {
    err('pkm_line_finalize_unified unavailable: selectedTokenByFieldIdUnified required')
  }
  return shared.selectedTokenByFieldIdUnified(rules, state, fieldId, {
    isObj: isObj,
    getFieldById: getFieldById,
  })
}

function resolvePrefixCheckbox(rules, state, deps) {
  var shared = resolvePrefixBehaviorShared(rules, state, deps)
  if (!shared || typeof shared.resolvePrefixCheckboxUnified !== 'function') {
    err('pkm_line_finalize_unified unavailable: resolvePrefixCheckboxUnified required')
  }
  return shared.resolvePrefixCheckboxUnified(rules, state, {
    isObj: isObj,
    getFieldById: getFieldById,
  })
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

function isFieldEnabled(mode, state, field, rules) {
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
  if (!field.dependsOn) return true
  var parentValue = state.selected[field.dependsOn] || ''
  if (!parentValue) return false
  if (Array.isArray(field.enabledForParentValues) && field.enabledForParentValues.length) {
    if (field.enabledForParentValues.indexOf(parentValue) === -1) return false
  }
  if (Array.isArray(field.disabledForParentValues) && field.disabledForParentValues.length) {
    if (field.disabledForParentValues.indexOf(parentValue) !== -1) return false
  }
  return true
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
  var s = String(raw || '').trim()
  var m = s.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/)
  if (!m) return ''
  return String(m[1] || '').trim()
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

function getAllowedValues(mode, state, field, rules) {
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
    if (!Array.isArray(v.allowedParentValues) || !v.allowedParentValues.length) {
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

function normalizeFormatMask(format) {
  var su = getSharedUtils()
  if (su && typeof su.normalizeFormatMask === 'function') return su.normalizeFormatMask(format)
  var f = String(format == null ? '' : format).trim()
  if (!f) return ''
  f = f.replace(/yyyy/gi, 'YYYY')
  f = f.replace(/dd/gi, 'DD')
  f = f.replace(/hh/gi, 'HH')
  f = f.replace(/ss/gi, 'ss')
  f = f.replace(/mm/gi, 'MM')
  f = f.replace(/HHMMSS/g, 'HHmmss')
  f = f.replace(/HHMM/g, 'HHmm')
  f = f.replace(/HH([^A-Za-z0-9]?)(MM)/g, 'HH$1mm')
  return f
}

function addByUnit(base, unit, delta) {
  var dt = new Date(base.getTime())
  var d = Math.trunc(Number(delta || 0))
  if (unit === 'second') dt.setSeconds(dt.getSeconds() + d)
  else if (unit === 'minute') dt.setMinutes(dt.getMinutes() + d)
  else if (unit === 'hour') dt.setHours(dt.getHours() + d)
  else if (unit === 'month') dt.setMonth(dt.getMonth() + d)
  else if (unit === 'year') dt.setFullYear(dt.getFullYear() + d)
  else dt.setDate(dt.getDate() + d)
  return dt
}

function getReferenceDateForUnit(state, unit) {
  if (unit === 'second' || unit === 'minute' || unit === 'hour') return new Date()
  return getSessionToday(state)
}

function getSearchLimitByUnit(unit) {
  var common = ensureStatusRuntimeCommonFns()
  if (common && typeof common.getSearchLimitByUnit === 'function') {
    return common.getSearchLimitByUnit(unit, getSharedUtils())
  }
  var su = getSharedUtils()
  if (su && typeof su.getSearchLimitByUnit === 'function') return su.getSearchLimitByUnit(unit)
  if (unit === 'second') return 172800
  if (unit === 'minute') return 10080
  if (unit === 'hour') return 720
  return 3660
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

function shouldHydrateGenericElementRaw(format, commandRaw, rawValue) {
  var su = getSharedUtils()
  if (su && typeof su.shouldHydrateGenericElementRaw === 'function') {
    return !!su.shouldHydrateGenericElementRaw(format, commandRaw, rawValue)
  }
  return false
}

function buildCustomPlan(cfg) {
  var su = getSharedUtils()
  if (su && typeof su.buildCustomPlanFromIncrement === 'function') return su.buildCustomPlanFromIncrement(cfg)
  var c = isObj(cfg) ? cfg : {}
  var raw = Array.isArray(c.customRaw) ? c.customRaw : []
  var steps = []
  var hasEnd = false
  var i
  for (i = 0; i < raw.length; i++) {
    var t = String(raw[i] || '').trim()
    if (!t) continue
    if (/^END$/i.test(t)) { hasEnd = true; break }
    var m = t.match(/^(-?\d+)(?:\s*\(\s*(\d+)\s*\))?$/)
    if (!m) continue
    var s = Math.max(0, Math.trunc(Number(m[1] || 0)))
    var rep = Math.max(1, Math.trunc(Number(m[2] || 1)))
    var r
    for (r = 0; r < rep; r++) steps.push(s)
  }
  if (!steps.length && Array.isArray(c.custom)) {
    for (i = 0; i < c.custom.length; i++) steps.push(Math.max(0, Math.trunc(Number(c.custom[i] || 0))))
  }
  return { steps: steps, hasEnd: hasEnd }
}

function endTotal(cfg) {
  var plan = buildCustomPlan(cfg)
  if (!plan.hasEnd || !plan.steps.length) return null
  var i, total = 0
  for (i = 0; i < plan.steps.length; i++) total += Math.max(0, Math.trunc(Number(plan.steps[i] || 0)))
  return total
}

function fmtDateByFormat(d, format) {
  var f = normalizeFormatMask(String(format == null ? 'YYYY-MM-DD' : format))
  var y = String(d.getFullYear())
  var m = String(d.getMonth() + 1)
  var day = String(d.getDate())
  var HH = String(d.getHours())
  var mm = String(d.getMinutes())
  var ss = String(d.getSeconds())
  if (m.length < 2) m = '0' + m
  if (day.length < 2) day = '0' + day
  if (HH.length < 2) HH = '0' + HH
  if (mm.length < 2) mm = '0' + mm
  if (ss.length < 2) ss = '0' + ss
  return f
    .replace(/YYYY/g, y)
    .replace(/MM/g, m)
    .replace(/DD/g, day)
    .replace(/HH/g, HH)
    .replace(/mm/g, mm)
    .replace(/ss/g, ss)
}

function buildFormatValueRegexSource(format) {
  var su = getSharedUtils()
  if (su && typeof su.buildFormatValueRegexSource === 'function') return su.buildFormatValueRegexSource(format)
  var f = normalizeFormatMask(String(format == null ? '' : format))
  if (!f) return ''
  var esc = function (x) { return String(x || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
  var tokenRe = /(YYYY|MM|DD|HH|mm|ss)/g
  var src = ''
  var last = 0
  var hit
  var hasToken = false
  while ((hit = tokenRe.exec(f)) !== null) {
    hasToken = true
    src += esc(f.slice(last, hit.index))
    var tk = String(hit[1] || '')
    src += tk === 'YYYY' ? '\\d{4}' : '\\d{2}'
    last = hit.index + tk.length
  }
  src += esc(f.slice(last))
  return hasToken ? src : ''
}

function hasFormatTokens(format) {
  var su = getSharedUtils()
  if (su && typeof su.hasFormatTokens === 'function') return su.hasFormatTokens(format)
  return /(YYYY|MM|DD|HH|mm|ss)/.test(normalizeFormatMask(String(format == null ? '' : format)))
}

function parseNumericLiteralSpec(format) {
  var su = getSharedUtils()
  if (su && typeof su.parseNumericLiteralSpec === 'function') return su.parseNumericLiteralSpec(format)
  var f = String(format || '').trim()
  if (!/^\d+$/.test(f)) return null
  var base = Number(f)
  if (!isFinite(base)) return null
  return { base: base, width: f.length }
}

function parseNumericPatternSpec(format) {
  var su = getSharedUtils()
  if (su && typeof su.parseNumericPatternSpec === 'function') return su.parseNumericPatternSpec(format)
  var f = String(format || '').trim()
  if (!f) return null
  if (/[A-Za-z]/.test(f)) return null
  var chars = Array.from(f)
  var slots = chars.map(function (ch) { return /\d/.test(ch) })
  if (!slots.some(function (x) { return !!x })) return null
  var baseDigits = chars.filter(function (ch) { return /\d/.test(ch) }).join('')
  if (!/^\d+$/.test(baseDigits)) return null
  var base = Number(baseDigits)
  if (!isFinite(base)) return null
  return { format: f, slots: slots, width: baseDigits.length, base: base }
}

function buildNumericPatternRegexSource(spec) {
  var su = getSharedUtils()
  if (su && typeof su.buildNumericPatternRegexSource === 'function') return su.buildNumericPatternRegexSource(spec)
  if (!spec || !Array.isArray(spec.slots)) return ''
  var chars = Array.from(String(spec.format || ''))
  var esc = function (x) { return String(x || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
  var out = ''
  var i
  for (i = 0; i < chars.length; i++) out += spec.slots[i] ? '\\d' : esc(chars[i])
  return out
}

function renderNumericPatternValue(spec, progressRaw) {
  var su = getSharedUtils()
  if (su && typeof su.renderNumericPatternValue === 'function') return su.renderNumericPatternValue(spec, progressRaw)
  if (!spec) return ''
  var p = Math.max(0, Math.trunc(Number(progressRaw || 0)))
  var value = spec.base + p
  var digits = String(value)
  if (digits.length < spec.width) digits = digits.padStart(spec.width, '0')
  if (digits.length > spec.width) digits = digits.slice(-spec.width)
  var chars = Array.from(String(spec.format || ''))
  var di = 0
  var out = ''
  var i
  for (i = 0; i < chars.length; i++) {
    if (spec.slots[i]) out += digits.charAt(di++) || '0'
    else out += chars[i]
  }
  return out
}

function parseNumericPatternProgress(value, spec) {
  var su = getSharedUtils()
  if (su && typeof su.parseNumericPatternProgress === 'function') return su.parseNumericPatternProgress(value, spec)
  if (!spec) return null
  var raw = String(value || '').trim()
  var rxSrc = buildNumericPatternRegexSource(spec)
  if (!rxSrc) return null
  var re = new RegExp('^' + rxSrc + '$', 'u')
  if (!re.test(raw)) return null
  var digits = Array.from(raw).filter(function (ch) { return /\d/.test(ch) }).join('')
  if (!/^\d+$/.test(digits)) return null
  var got = Number(digits)
  if (!isFinite(got) || got < spec.base) return null
  return Math.max(0, Math.trunc(got - spec.base))
}

function buildTokenlessValueRegexSource(format) {
  var su = getSharedUtils()
  if (su && typeof su.buildTokenlessValueRegexSource === 'function') return su.buildTokenlessValueRegexSource(format)
  throw new Error('shared_utils unavailable: buildTokenlessValueRegexSource')
}

function renderTokenlessValueByProgress(format, progressRaw) {
  var su = getSharedUtils()
  if (su && typeof su.renderTokenlessValueByProgress === 'function') return su.renderTokenlessValueByProgress(format, progressRaw)
  var f = String(format || '').trim()
  if (!f) return ''
  var numPattern = parseNumericPatternSpec(f)
  if (numPattern) return renderNumericPatternValue(numPattern, progressRaw)
  var num = parseNumericLiteralSpec(f)
  if (num) {
    var p = Math.max(0, Math.trunc(Number(progressRaw || 0)))
    var v = num.base + p
    var s = String(v)
    return s.length >= num.width ? s : s.padStart(num.width, '0')
  }
  var chars = Array.from(f)
  var last = chars[chars.length - 1] || ''
  var extra = Math.max(0, Math.trunc(Number(progressRaw || 0)))
  return f + (last ? last.repeat(extra) : '')
}

function parseTokenlessProgress(value, format) {
  var su = getSharedUtils()
  if (su && typeof su.parseTokenlessProgress === 'function') return su.parseTokenlessProgress(value, format)
  throw new Error('shared_utils unavailable: parseTokenlessProgress')
}

function resolveDateOffsetByFormatValue(state, rawValue, format, maxDays) {
  var raw = String(rawValue || '').trim()
  var fmt = normalizeFormatMask(String(format == null ? 'YYYY-MM-DD' : format))
  if (!raw || !fmt || !hasFormatTokens(fmt)) return null
  var unit = detectDateUnit(fmt)
  var ref = getReferenceDateForUnit(state, unit)
  if (!ref || isNaN(ref.getTime())) return null
  var limit = Math.max(0, Math.trunc(Number(maxDays || getSearchLimitByUnit(unit))))
  var d
  for (d = 0; d <= limit; d++) {
    var dt = addByUnit(ref, unit, d)
    if (fmtDateByFormat(dt, fmt) === raw) return d
  }
  return null
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
  var c = Number(current)
  if (!isFinite(c) || c <= 0) return 1
  var front = [0]
  var i
  for (i = 0; i < arr.length; i++) {
    var s = Math.max(0, Math.trunc(Number(arr[i] || 0)))
    front.push(front[front.length - 1] + s)
  }
  for (i = 1; i < front.length; i++) {
    if (c <= front[i]) return Math.max(1, c - front[i - 1])
  }
  var tail = Math.max(0, Math.trunc(Number(arr[arr.length - 1] || 0)))
  return Math.max(1, tail || 1)
}

function stepByCustomForward(custom, current) {
  var su = getSharedUtils()
  if (su && typeof su.forwardStepByCurrent === 'function') return su.forwardStepByCurrent(custom, current)
  var arr = Array.isArray(custom) ? custom : []
  if (!arr.length) return 1
  var cur = Number(current)
  var safeCur = isFinite(cur) ? Math.max(0, Math.trunc(cur)) : 0
  var front = []
  var i
  var acc = 0
  for (i = 0; i < arr.length; i++) {
    var s = Math.max(0, Math.trunc(Number(arr[i] || 0)))
    acc += s
    front.push(acc)
  }
  for (i = 0; i < front.length; i++) {
    if (safeCur < front[i]) return Math.max(1, front[i] - safeCur)
  }
  var tail = Math.max(0, Math.trunc(Number(arr[arr.length - 1] || 0)))
  return Math.max(1, tail || 1)
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

function detectDateUnit(format) {
  var common = ensureStatusRuntimeCommonFns()
  if (common && typeof common.detectDateUnit === 'function') {
    return common.detectDateUnit(format, normalizeFormatMask, hasFormatTokens, getSharedUtils())
  }
  var su = getSharedUtils()
  if (su && typeof su.detectDateUnit === 'function') return su.detectDateUnit(format)
  var f = normalizeFormatMask(String(format == null ? '' : format))
  if (!hasFormatTokens(f)) return 'tokenless'
  if (/ss/.test(f)) return 'second'
  if (/mm/.test(f)) return 'minute'
  if (/HH/.test(f)) return 'hour'
  if (/YYYY/.test(f) && !/(MM|DD)/.test(f)) return 'year'
  if (/MM/.test(f) && !/DD/.test(f)) return 'month'
  return 'day'
}

function getDateProgressForStep(state, fieldId, format) {
  var common = ensureStatusRuntimeCommonFns()
  if (common && typeof common.getDateProgressForStep === 'function') {
    return common.getDateProgressForStep(state, fieldId, format)
  }
  var cur = String(state && state.selected ? (state.selected[fieldId] || '') : '')
  if (!cur) return ''
  var off = Number(cur)
  if (!isFinite(off)) return ''
  return String(Math.max(0, Math.trunc(off)))
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

  var next = direction > 0
    ? (Math.max(0, Math.trunc(Number(val || 0))) + step)
    : Math.max(0, Math.trunc(Number(val || 0)) - step)
  if (direction < 0 && next <= 0) {
    state.selected[fieldId] = ''
    return
  }
  state.selected[fieldId] = String(Math.max(0, next))
}

function collectChildren(mode, parentId) {
  var out = []
  var i
  for (i = 0; i < mode.fields.length; i++) {
    if (mode.fields[i].dependsOn === parentId) out.push(mode.fields[i].id)
  }
  return out
}

function clearChildrenRecursive(mode, state, parentId) {
  var children = collectChildren(mode, parentId)
  var i
  for (i = 0; i < children.length; i++) {
    state.selected[children[i]] = ''
    clearChildrenRecursive(mode, state, children[i])
  }
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
    var cur = state.selected[field.id] || ''
    var val = cur === '' ? null : Number(cur)
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

  var values = getAllowedValues(fieldMode, state, field, rules)
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

  if (nextId !== currentId || nextId === '') {
    clearChildrenRecursive(mode, state, field.id)
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

function buildManagedTokenSet(mode, rules) {
  var set = {}
  function pushToken(tok) {
    var t = String(tok || '').trim()
    if (t) set[t] = true
  }
  function addValueTokens(field, value) {
    var primary = buildOutputToken(field, value, rules)
    pushToken(primary)
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

function getUnmanagedTailTokens(parsedLine, mode, rules) {
  var tags = parsedLine && Array.isArray(parsedLine.tags) ? parsedLine.tags : []
  var known = buildManagedTokenSet(mode, rules)
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
    if (regLocal && typeof regLocal.resolveOrderKeyFromFieldId === 'function') {
      var mapped = String(regLocal.resolveOrderKeyFromFieldId(String(field.id || '').trim()) || '').trim()
      if (mapped) return mapped
    }
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
  var i
  for (i = 0; i < mode.fields.length; i++) {
    var field = mode.fields[i]
    if (!field) continue

    if (hasProjectSelected && removeCategoryAfterProject && field.id === categoryFieldId) continue
    if (hasProjectSelected && removeSubtagAfterProject && field.id === subcategoryFieldId) continue

    if (!isFieldEnabled(mode, state, field, rules)) continue
    var valId = state.selected[field.id] || ''
    if (!valId) continue

    var values = getAllowedValues(mode, state, field, rules)
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
      }
    }
  }

  var tail = getUnmanagedTailTokens(parsedLine, mode, rules)
  var techOrder = getTechOrder(rules)
  var keepUnknown = getKeepUnknownTags(rules)
  var subtagFormat = getSubtagFormat(rules)
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
      if (subtagFormat === 'combined' && parentTok && subTok) {
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

  if (subtagFormat === 'combined') {
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
          composeToken: function (prefix, rawToken) {
            var p = typeof prefix === 'string' ? prefix : '#'
            return p + String(rawToken || '')
          }
        }
      })
      tags = statusLineRuntime.applyCombinedToTokenList(tags, combinedEntries)
    }
  }

  return tags
}

function resolveFieldOutputMode(field, rules) {
  if (field && typeof field.outputMode === 'string') {
    var local = String(field.outputMode).trim().toLowerCase()
    if (local) return local
  }
  var source = String(field && field.source ? field.source : '').trim()
  if (isWikilinkSourceField(field)) return 'wikilink'
  if (source && rules && rules[source] && typeof rules[source].output === 'string') {
    return String(rules[source].output).toLowerCase().trim() || 'tag'
  }
  return 'tag'
}

function buildOutputToken(field, value, rules) {
  if (!field || !value) return ''
  var outputMode = resolveFieldOutputMode(field, rules)
  var tokenRaw = String(value.token || '').trim()
  if (/^\[\[[^\]]+\]\]$/.test(tokenRaw)) return tokenRaw
  if (/^#\S+/.test(tokenRaw)) return tokenRaw
  if (outputMode === 'wikilink') {
    var linkTarget = value.link || value.token || value.id || ''
    if (!linkTarget) return ''
    return '[[' + linkTarget + ']]'
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

function buildGroupDisplay(group, mode, state, rules) {
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
    return { hidden: true, active: false, text: '' }
  }

  var text = ''
  if (tokens.length) {
    text = tokens.join('+')
  } else {
    var ph = String(group.placeholder || '')
    if (hasActive) {
      text = ph
    } else {
      var phStyle = rules.ui && rules.ui.placeholderStyle ? String(rules.ui.placeholderStyle) : 'code'
      if (phStyle === 'plain') text = ph
      else text = '`' + ph + '`'
    }
  }
  return {
    hidden: false,
    active: hasActive,
    text: text
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

function renderControlLine(rules, state, parsedLine) {
  var mode = getMode(rules, state.mode)
  var groups = getRenderedGroupsForMode(rules, state, mode)

  var cells = []
  var gi
  for (gi = 0; gi < groups.length; gi++) {
    var g = groups[gi]
    var disp = buildGroupDisplay(g, mode, state, rules)
    if (disp.hidden) continue
    if (disp.active) cells.push('**[' + disp.text + ']**')
    else cells.push(disp.text)
  }

  var tail = parsedLine.text || ''
  var head = cells.join(' ')
  var panelCfg = rules.ui && rules.ui.activePanel ? rules.ui.activePanel : null
  if (panelCfg && panelCfg.enabled !== false) {
    var useHighlight = panelCfg.useHighlight === true
    var showMarkers = panelCfg.showMarkers === true
    var pfx = typeof panelCfg.prefix === 'string' ? panelCfg.prefix : '{TW}'
    var sfx = typeof panelCfg.suffix === 'string' ? panelCfg.suffix : '{/TW}'
    if (showMarkers) head = pfx + ' ' + head + ' ' + sfx
    if (useHighlight) head = '==' + head + '=='
  }

  if (state.mode === 'right') {
    if (tail) return parsedLine.indent + tail + ' ' + rules.io.separator2 + ' ' + head
    return parsedLine.indent + rules.io.separator2 + ' ' + head
  }

  if (tail) return parsedLine.indent + head + ' ' + rules.io.separator1 + ' ' + tail
  return parsedLine.indent + head
}

function hydrateStateFromParsedLine(rules, state, parsedLine) {
  // Universal Order Engine v2 contract:
  // - token identity is raw-exact (no transliteration/canonicalization)
  // - hydration conflict resolution is deterministic: last token occurrence wins per field
  // - panel affects UI grouping/navigation only; hydration is position-based on the unified token stream
  var allModes = [rules.leftMode, rules.rightMode]
  var tags = Array.isArray(parsedLine.tags) ? parsedLine.tags.slice() : []
  var rightRaw = String(parsedLine.right || parsedLine.dates || '')
  var graphLine = tags.join(' ') + (rightRaw ? (' ' + String(rules && rules.io && rules.io.separator2 || '||') + ' ' + rightRaw) : '')
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
  if (tokenGraph && typeof tokenGraph.buildTokenFactsFromLine === 'function') {
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
      var values = getAllowedValues(mode, state, field, rules)
      if (canUseSharedTokenSelect) {
        var tokenMap = []
        var viMap
        for (viMap = 0; viMap < values.length; viMap++) {
          var vm = values[viMap]
          if (!vm || !vm.token) continue
          var fullToken = buildOutputToken(field, vm, rules)
          if (!fullToken) continue
          tokenMap.push({ id: String(vm.id || ''), token: fullToken })
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
        var full = buildOutputToken(field, v, rules)
        var pos = Object.prototype.hasOwnProperty.call(lastIndexByToken, full)
          ? Number(lastIndexByToken[full])
          : -1
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
  if (statusLineRuntime && typeof statusLineRuntime.hydrateSelectionFromCombinedTokens === 'function') {
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
  }

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
          var selectedRaw = String(hitDate.value || '').trim()
          if (hasFormatTokens(fmtHydrate)) {
            var diffSelected = resolveDateOffsetByFormatValue(state, selectedRaw, fmtHydrate, 3660)
            if (diffSelected !== null && isFinite(diffSelected)) {
              state.selected[f.id] = String(Math.max(0, Math.trunc(diffSelected)))
              continue
            }
          } else {
            if (f.kind === 'genericElement' && modeHydrate === 'command' && shouldHydrateGenericElementRaw(fmtHydrate, cmdHydrate, selectedRaw)) {
              state.selected[f.id] = selectedRaw
              continue
            }
            var selectedProgress = parseTokenlessProgress(selectedRaw, fmtHydrate)
            if (selectedProgress !== null && isFinite(selectedProgress)) {
              state.selected[f.id] = String(Math.max(0, Math.trunc(selectedProgress)))
              continue
            }
          }
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
        if (hasFormatTokens(fmtHydrate)) {
          var diff = resolveDateOffsetByFormatValue(state, mDate[1], fmtHydrate, getSearchLimitByUnit(detectDateUnit(fmtHydrate)))
          if (diff !== null && isFinite(diff)) state.selected[f.id] = String(Math.max(0, Math.trunc(diff)))
        } else {
          if (f.kind === 'genericElement' && modeHydrate === 'command' && shouldHydrateGenericElementRaw(fmtHydrate, cmdHydrate, mDate[1])) {
            state.selected[f.id] = String(mDate[1] || '').trim()
            continue
          }
          var p = parseTokenlessProgress(mDate[1], cfgDateHydrate.format)
          if (p !== null && isFinite(p)) state.selected[f.id] = String(Math.max(0, Math.trunc(p)))
        }
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
        state.selected[field.id] = ''
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

function escapeRe(s) {
  var su = getSharedUtils()
  if (su) return su.escapeRe(s)
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  parseRulesFromMarkdown: parseRulesFromMarkdown,
  validateRules: validateRules,
  parseLine: parseLine,
  makeInitialState: makeInitialState,
  resolveInitialActiveField: resolveInitialActiveField,
  hydrateStateFromParsedLine: hydrateStateFromParsedLine,
  sanitizeState: sanitizeState,
  buildPrefix: buildPrefix,
  isFieldEnabled: isFieldEnabled,
  getAllowedValues: getAllowedValues,
  cycleValue: cycleValue,
  nextField: nextField,
  getNavigableFieldSequence: getNavigableFieldSequence,
  buildTags: buildTags,
  buildRightDates: buildRightDates,
  assembleFinalLine: assembleFinalLine,
  renderControlLine: renderControlLine,
  getDisplayTokenByFieldId: getDisplayTokenByFieldId
}
